begin;
-- ===========================================================================
-- migration: 0038_shadow_arm_log
-- purpose : Track 1 forward-shadow track-scoped counterfactual log (PR-A3).
--           Production tables 무변경 — 신규 shadow table + RPC만 추가.
-- SoT     : docs/superpowers/specs/2026-06-19-pathA-forward-shadow-sector-layer.md §5.2/§5.4
-- parity  : 0039_tier0_candidates_150_shadow (Track 2 sibling — grant/anon-deny/cast fail-closed 패턴)
--
-- 불변(§1):
--   I-1  money-path 무변경(shadow는 별도 table·RPC만).
--   I-5  production_k=0 강제(CHECK + RPC guard). shadow_eval_k만 nonzero 가능.
--   table-level write grant 부재: 모든 write는 SECURITY DEFINER `upsert_shadow_arm_log` 단일 경로.
--   feedback_supabase_security_definer_pattern: revoke public+anon+authenticated → grant 명시.
--
-- ⚠️ Track 1 vs Track 2 차이(의도적, 검토 대상): 0038은 `service_role`에 **SELECT를 부여**한다
--    (§5.2 — Stage 0 write caller = worker/reconcile의 service-role path; reconcile[PR-A4]이 shadow row를
--    읽어 누락 backfill). Track 2(0039)는 T2-I-6로 service_role SELECT를 거부(reconcile=owner psql)했다.
--    production tier0/Tier1 코드는 shadow_arm_log를 절대 조회하지 않으므로(별도 table·I-5 K=0) production
--    선정에 영향 0. write는 여전히 DEFINER RPC 단일 경로(table DML grant 없음).
-- 0038은 USER-applied only(Claude/omxy migration 실행 금지).
-- ===========================================================================

create table if not exists public.shadow_arm_log (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  period_key text not null,
  track text not null check (track in ('short','midlong')),
  -- 0031 패턴: track↔period_key prefix 일관성 강제 (weak '^[sm]:' 금지).
  constraint shadow_arm_log_track_period_consistent check (
    (track='short'   and period_key ~ '^s:\d{4}-\d{2}-\d{2}$') or
    (track='midlong' and period_key ~ '^m:\d{4}-\d{2}$')
  ),
  arm text not null check (
    arm in ('production-snapshot','sector-soft-reserve','regime-sector-soft-reserve','candidate-pool-hard-gate')
  ),
  run_id text,
  run_date timestamptz not null,
  sector_view jsonb not null default '{"source":"absent","leadingSectors":[]}'::jsonb,
  regime_context jsonb,
  production_k int not null default 0 check (production_k = 0),
  shadow_eval_k int not null default 0 check (shadow_eval_k >= 0),
  selected jsonb not null,
  not_selected jsonb,
  reserve_picks jsonb,
  counterfactual_cut jsonb,
  sector_distribution jsonb,
  status text not null default 'logged' check (status in ('logged','invalid_input','incomplete_run')),
  error text,
  created_by uuid,           -- stage 0 service_role path=null; future authenticated admin replay grant 시 auth.uid() 감사
  created_at timestamptz not null default now()
);

create unique index if not exists shadow_arm_log_period_track_arm_uniq
  on public.shadow_arm_log (period_key, track, arm);

-- ---------------------------------------------------------------------------
-- RLS + grants (feedback_supabase_security_definer_pattern)
-- ---------------------------------------------------------------------------
alter table public.shadow_arm_log enable row level security;

revoke all on table public.shadow_arm_log from public;
revoke all on table public.shadow_arm_log from anon;
revoke all on table public.shadow_arm_log from authenticated;
revoke all on table public.shadow_arm_log from service_role;
grant select on table public.shadow_arm_log to authenticated;   -- RLS admin gate (UI read)
grant select on table public.shadow_arm_log to service_role;    -- SELECT only; write는 RPC 단일 경로 (§5.2)

-- F7: policy DROP-first 멱등(0034/0039 패턴) — 부분 재적용/복구 재실행 안전.
drop policy if exists "shadow_arm_log admin select" on public.shadow_arm_log;
create policy "shadow_arm_log admin select"
  on public.shadow_arm_log for select to authenticated using (public.is_admin());

-- security(0034/0039 house 패턴): anon RESTRICTIVE deny backstop — anon은 grant 부재로 이미 막히나,
-- 미래 우발 grant/default-privilege 재부여에도 구조적으로 차단(grant 부재 단독 의존 제거).
drop policy if exists "shadow_arm_log anon block" on public.shadow_arm_log;
create policy "shadow_arm_log anon block"
  on public.shadow_arm_log as restrictive for all to anon using (false);

-- ---------------------------------------------------------------------------
-- upsert_shadow_arm_log(jsonb) — 단일 write 경로. SECURITY DEFINER.
--   production-snapshot arm = insert-only(ON CONFLICT DO NOTHING) immutable baseline.
--   나머지 arm = (period_key,track,arm) upsert(DO UPDATE).
--   symmetric fail-closed: 모든 cast(::timestamptz/::int)는 regex 선행 또는 begin/exception-wrap → typed error.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_shadow_arm_log(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role text;
  v_id uuid;
  v_arm text;
  v_track text;
  v_period text;
  v_month text;
  v_status text;
  v_created_by uuid;
  v_expected int;
  v_selected jsonb;
  v_sector_source text;
  v_regime_source text;
  v_run_date timestamptz;
  v_pk_text text;
  v_sek_text text;
  v_production_k int;
  v_shadow_eval_k int;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload_must_be_object';
  end if;

  -- authz: Stage 0 grants EXECUTE only to service_role. admin replay UI는 별도 PR에서 grant+caller spec.
  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then raise exception 'auth_unavailable'; end if;
    if not public.is_admin() then raise exception 'admin_required'; end if;
    v_created_by := auth.uid();
  end if;

  -- pre-validation (raise early; table CHECK/NOT NULL에만 의존하지 않음).
  v_month := p_payload->>'month'; v_period := p_payload->>'period_key';
  v_track := p_payload->>'track';  v_arm := p_payload->>'arm';
  v_status := coalesce(p_payload->>'status','logged');
  v_selected := p_payload->'selected';
  v_sector_source := coalesce(p_payload#>>'{sector_view,source}', 'absent');
  v_regime_source := coalesce(p_payload#>>'{regime_context,source}', 'absent');

  if v_month is null or v_month !~ '^\d{4}-\d{2}$' then raise exception 'bad_month'; end if;
  -- C1(ce-* MED): NULL guard 선행 — `NULL not in (...)`=NULL이라 typed bad_track 미발동 → INSERT가 raw 23502
  --   누수(symmetric fail-closed 위반). month/asOf 패턴과 동일하게 is null or 추가.
  if v_track is null or v_track not in ('short','midlong') then raise exception 'bad_track'; end if;
  v_expected := case when v_track='short' then 10 when v_track='midlong' then 20 end;
  if (v_track='short'   and (v_period is null or v_period !~ '^s:\d{4}-\d{2}-\d{2}$')) or
     (v_track='midlong' and (v_period is null or v_period !~ '^m:\d{4}-\d{2}$')) then
    raise exception 'bad_period_for_track';
  end if;
  if v_arm is null or v_arm not in ('production-snapshot','sector-soft-reserve','regime-sector-soft-reserve','candidate-pool-hard-gate') then
    raise exception 'bad_arm';
  end if;
  if v_status not in ('logged','invalid_input','incomplete_run') then raise exception 'bad_status'; end if;
  if v_sector_source not in ('absent','manual_pre_registered') then raise exception 'bad_sector_source'; end if;
  if v_regime_source not in ('absent','manual_pre_registered') then raise exception 'bad_regime_source'; end if;

  -- sector_view.leadingSectors: array + canonical-14 (silent coerce 금지).
  if jsonb_typeof(coalesce(p_payload#>'{sector_view,leadingSectors}', '[]'::jsonb)) <> 'array' then
    raise exception 'sector_leading_sectors_must_be_array';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(coalesce(p_payload#>'{sector_view,leadingSectors}', '[]'::jsonb)) s(sector)
    where s.sector not in ('바이오','반도체','건설','금융','2차전지','자동차','IT/SW','유통/소비재','에너지','엔터/미디어','통신','철강/소재','운송/물류','보험/증권')
  ) then raise exception 'bad_canonical_sector'; end if;
  if v_sector_source = 'manual_pre_registered' then
    if jsonb_array_length(coalesce(p_payload#>'{sector_view,leadingSectors}', '[]'::jsonb)) = 0 then
      raise exception 'sector_leading_sectors_required';
    end if;
    if nullif(p_payload#>>'{sector_view,asOf}', '') is null then raise exception 'sector_asof_required'; end if;
    begin perform (p_payload#>>'{sector_view,asOf}')::timestamptz;
    exception when others then raise exception 'bad_sector_asof'; end;
  end if;
  if v_regime_source = 'manual_pre_registered' then
    if coalesce(p_payload#>>'{regime_context,stage}', '') not in ('bear','sideways','bull') then raise exception 'bad_regime_stage'; end if;
    if nullif(p_payload#>>'{regime_context,asOf}', '') is null then raise exception 'regime_asof_required'; end if;
    begin perform (p_payload#>>'{regime_context,asOf}')::timestamptz;
    exception when others then raise exception 'bad_regime_asof'; end;
  end if;

  -- production_k / shadow_eval_k: regex 선행(raw ::int 누수 차단) 후 cast.
  v_pk_text := p_payload->>'production_k';
  if v_pk_text is not null then
    if v_pk_text !~ '^-?[0-9]+$' or length(v_pk_text) > 11 then raise exception 'bad_production_k'; end if;
    if v_pk_text::numeric < -2147483648 or v_pk_text::numeric > 2147483647 then raise exception 'bad_production_k'; end if;
  end if;
  v_production_k := coalesce(v_pk_text::int, 0);
  if v_production_k <> 0 then raise exception 'production_k_must_be_zero'; end if;
  v_sek_text := p_payload->>'shadow_eval_k';
  if v_sek_text is not null then
    if v_sek_text !~ '^-?[0-9]+$' or length(v_sek_text) > 11 then raise exception 'bad_shadow_eval_k'; end if;
    if v_sek_text::numeric < -2147483648 or v_sek_text::numeric > 2147483647 then raise exception 'bad_shadow_eval_k'; end if;
  end if;
  v_shadow_eval_k := coalesce(v_sek_text::int, 0);
  if v_shadow_eval_k < 0 then raise exception 'shadow_eval_k_must_be_nonnegative'; end if;

  -- run_date: 선택적, begin/exception-wrap. 없으면 now().
  if nullif(p_payload->>'run_date', '') is null then
    v_run_date := now();
  else
    begin v_run_date := (p_payload->>'run_date')::timestamptz;
    exception when others then raise exception 'bad_run_date'; end;
  end if;

  if pg_column_size(p_payload) > 4 * 1024 * 1024 then raise exception 'payload_too_large'; end if;

  -- selected: logged면 array + count==expected + 6-digit ticker + active-timeframe purity + distinct.
  if v_status = 'logged' then
    if v_selected is null or jsonb_typeof(v_selected) <> 'array' then raise exception 'selected_must_be_array'; end if;
    if jsonb_array_length(v_selected) <> v_expected then raise exception 'selected_count_mismatch:%:%', v_track, jsonb_array_length(v_selected); end if;
    if exists (
      select 1 from jsonb_array_elements(v_selected) e
      where coalesce(e->>'ticker','') !~ '^\d{6}$'
         or coalesce(e->>'assigned_timeframe','') not in ('short','mid','long')
         or (v_track='short' and e->>'assigned_timeframe' <> 'short')
         or (v_track='midlong' and e->>'assigned_timeframe' not in ('mid','long'))
    ) then raise exception 'selected_row_invalid'; end if;
    if (select count(distinct e->>'ticker') from jsonb_array_elements(v_selected) e) <> v_expected then
      raise exception 'selected_duplicate_ticker';
    end if;
    if v_track='midlong' and (
      (select count(*) from jsonb_array_elements(v_selected) e where e->>'assigned_timeframe'='mid') <> 10 or
      (select count(*) from jsonb_array_elements(v_selected) e where e->>'assigned_timeframe'='long') <> 10
    ) then raise exception 'selected_midlong_count_mismatch'; end if;
  elsif v_selected is not null and jsonb_typeof(v_selected) <> 'array' then
    raise exception 'selected_must_be_array';
  end if;

  -- production-snapshot: immutable baseline. first valid insert wins (ON CONFLICT DO NOTHING).
  if v_arm = 'production-snapshot' then
    if v_status <> 'logged' then raise exception 'production_snapshot_status_must_be_logged'; end if;
    if v_shadow_eval_k <> 0 then raise exception 'production_snapshot_shadow_eval_k_must_be_zero'; end if;

    insert into public.shadow_arm_log (
      month, period_key, track, arm, run_id, run_date, sector_view, regime_context,
      production_k, shadow_eval_k, selected, not_selected, reserve_picks, counterfactual_cut,
      sector_distribution, status, error, created_by
    ) values (
      v_month, v_period, v_track, v_arm, p_payload->>'run_id', v_run_date,
      coalesce(p_payload->'sector_view', '{"source":"absent","leadingSectors":[]}'::jsonb),
      p_payload->'regime_context', 0, 0,
      v_selected, p_payload->'not_selected', p_payload->'reserve_picks',
      p_payload->'counterfactual_cut', p_payload->'sector_distribution', v_status, p_payload->>'error', v_created_by
    )
    on conflict (period_key, track, arm) do nothing
    returning id into v_id;

    if v_id is null then
      select id into v_id from public.shadow_arm_log
       where period_key = v_period and track = v_track and arm = v_arm;
    end if;
    return v_id;
  end if;

  -- non-production arms: (period_key,track,arm) upsert.
  insert into public.shadow_arm_log (
    month, period_key, track, arm, run_id, run_date, sector_view, regime_context,
    production_k, shadow_eval_k, selected, not_selected, reserve_picks, counterfactual_cut,
    sector_distribution, status, error, created_by
  ) values (
    v_month, v_period, v_track, v_arm, p_payload->>'run_id', v_run_date,
    coalesce(p_payload->'sector_view', '{"source":"absent","leadingSectors":[]}'::jsonb),
    p_payload->'regime_context', 0, v_shadow_eval_k,
    coalesce(v_selected,'[]'::jsonb), p_payload->'not_selected', p_payload->'reserve_picks',
    p_payload->'counterfactual_cut', p_payload->'sector_distribution', v_status, p_payload->>'error', v_created_by
  )
  on conflict (period_key, track, arm) do update set
    run_id = excluded.run_id,
    run_date = excluded.run_date,
    sector_view = excluded.sector_view,
    regime_context = excluded.regime_context,
    shadow_eval_k = excluded.shadow_eval_k,
    selected = excluded.selected,
    not_selected = excluded.not_selected,
    reserve_picks = excluded.reserve_picks,
    counterfactual_cut = excluded.counterfactual_cut,
    sector_distribution = excluded.sector_distribution,
    status = excluded.status,
    error = excluded.error
  returning id into v_id;
  return v_id;
end; $$;

revoke all on function public.upsert_shadow_arm_log(jsonb) from public;
revoke all on function public.upsert_shadow_arm_log(jsonb) from anon;
revoke all on function public.upsert_shadow_arm_log(jsonb) from authenticated;
revoke all on function public.upsert_shadow_arm_log(jsonb) from service_role;
grant execute on function public.upsert_shadow_arm_log(jsonb) to service_role;

commit;
