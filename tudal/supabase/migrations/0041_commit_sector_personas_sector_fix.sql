-- migration: 0041_commit_sector_personas_sector_fix
-- purpose: 0040 live-catch(2026-06-24)의 corrective를 repo migration으로 공식화 + 0019(admin) 동일
--          잠복 버그 동시 수정 (omxy R7 HIGH/MED).
--   배경: committee_votes_sector_required CHECK(0003)는 persona_layer='sector' row에 sector NOT NULL 요구.
--   commit_sector_personas(0019, admin) + commit_sector_personas_cron(0040, cron) 둘 다 INSERT에서 sector
--   컬럼을 누락 → 23514 check_violation. 0040은 cron live 경로(P4 Tier2 리포트)에서 발현해 0040.sql 인플레이스
--   수정 + prod one-off(ledger commit_sector_personas_cron_sector_fix) 적용됨. 0019는 dangling action
--   (track-record/actions.ts, UI caller 0)이라 미발현이나 동일 결함 잔존 → 본 마이그가 0019를 수정하고
--   0040을 re-affirm(idempotent)해 양 함수를 모든 env에서 정합화한다.
--   ref: 0003_s2_reports.sql(committee_votes_sector_required) · 0019 · 0040 · spec 2026-06-23 PR-T2a

-- ── admin RPC (0019) — sector=p_sector 추가 (auth.uid()/is_admin() 게이트는 0019 그대로) ──
create or replace function public.commit_sector_personas(
  p_month text,
  p_ticker text,
  p_sector text,
  p_part_a jsonb,
  p_sector_aggregate jsonb,
  p_votes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_report_id uuid;
  v_section_8 jsonb;
  v_partC jsonb;
  v_sector_count int;
begin
  if v_caller is null then raise exception 'auth_unavailable'; end if;
  if not public.is_admin() then raise exception 'admin_required'; end if;

  if p_sector is null or p_sector not in (
    '바이오','반도체','건설','금융','2차전지','자동차','IT/SW','유통/소비재',
    '에너지','엔터/미디어','통신','철강/소재','운송/물류','보험/증권'
  ) then
    raise exception 'invalid_sector';
  end if;

  if p_part_a is null or jsonb_typeof(p_part_a) is distinct from 'array' then
    raise exception 'part_a_must_be_array';
  end if;
  if jsonb_array_length(p_part_a) is distinct from 14 then
    raise exception 'part_a_length_must_be_14';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_part_a) v
    where coalesce(v->>'vote', '') not in ('BUY','HOLD','SELL')
  ) then
    raise exception 'invalid_part_a_vote';
  end if;

  if p_sector_aggregate is null or jsonb_typeof(p_sector_aggregate) is distinct from 'object' then
    raise exception 'sector_aggregate_must_be_object';
  end if;
  if (select count(*) from jsonb_object_keys(p_sector_aggregate)) is distinct from 3 then
    raise exception 'sector_aggregate_keys_must_be_exactly_3';
  end if;
  if not (p_sector_aggregate ? 'buy' and p_sector_aggregate ? 'hold' and p_sector_aggregate ? 'sell') then
    raise exception 'sector_aggregate_keys_invalid';
  end if;
  if jsonb_typeof(p_sector_aggregate->'buy') <> 'number'
     or jsonb_typeof(p_sector_aggregate->'hold') <> 'number'
     or jsonb_typeof(p_sector_aggregate->'sell') <> 'number' then
    raise exception 'sector_aggregate_values_must_be_number';
  end if;
  if mod((p_sector_aggregate->>'buy')::numeric, 1) <> 0
     or mod((p_sector_aggregate->>'hold')::numeric, 1) <> 0
     or mod((p_sector_aggregate->>'sell')::numeric, 1) <> 0 then
    raise exception 'sector_aggregate_values_must_be_int';
  end if;
  if (p_sector_aggregate->>'buy')::numeric < 0
     or (p_sector_aggregate->>'hold')::numeric < 0
     or (p_sector_aggregate->>'sell')::numeric < 0 then
    raise exception 'sector_aggregate_values_must_be_nonneg';
  end if;

  if p_votes is null or jsonb_typeof(p_votes) is distinct from 'array' then
    raise exception 'votes_must_be_array';
  end if;
  if jsonb_array_length(p_votes) is distinct from 14 then
    raise exception 'votes_length_must_be_14';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_votes) v
    where coalesce(v->>'persona_id', '') = ''
       or coalesce(v->>'persona_layer', '') <> 'sector'
       or coalesce(v->>'argument_excerpt', '') = ''
       or coalesce(v->>'vote', '') not in ('BUY','HOLD','SELL')
  ) then
    raise exception 'invalid_vote_row';
  end if;

  select id, section_8 into v_report_id, v_section_8
  from public.stock_reports
  where ticker = p_ticker
    and month = to_date(p_month || '-01', 'YYYY-MM-DD')
    and is_latest = true
  for update;

  if v_report_id is null then
    raise exception 'core_report_missing';
  end if;

  v_partC := coalesce(v_section_8->'partC', '{}'::jsonb) || jsonb_build_object('sector_aggregate', p_sector_aggregate);

  update public.stock_reports
  set section_8 = coalesce(section_8, '{}'::jsonb)
                  || jsonb_build_object('partA', p_part_a)
                  || jsonb_build_object('partC', v_partC),
      generated_at = now()
  where id = v_report_id;

  delete from public.committee_votes
  where report_id = v_report_id and persona_layer = 'sector';

  -- FIX: sector = p_sector (committee_votes_sector_required CHECK).
  insert into public.committee_votes (report_id, persona_id, persona_layer, sector, vote, argument_excerpt)
  select
    v_report_id,
    (v ->> 'persona_id')::text,
    'sector'::text,
    p_sector,
    case (v ->> 'vote')
      when 'BUY' then 'approve'
      when 'HOLD' then 'abstain'
      when 'SELL' then 'reject'
    end,
    (v ->> 'argument_excerpt')::text
  from jsonb_array_elements(p_votes) as v;

  get diagnostics v_sector_count = row_count;

  return jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'sector', p_sector,
    'votes_inserted', v_sector_count
  );
end;
$$;

-- 0019 SECURITY DEFINER triad 유지 (admin authenticated).
revoke execute on function public.commit_sector_personas(text, text, text, jsonb, jsonb, jsonb) from public;
revoke execute on function public.commit_sector_personas(text, text, text, jsonb, jsonb, jsonb) from anon;
grant execute on function public.commit_sector_personas(text, text, text, jsonb, jsonb, jsonb) to authenticated;

-- 0040 cron RPC는 0040.sql(인플레이스 수정) + prod one-off로 이미 sector fix 적용됨. 본 마이그는 admin(0019)
-- 정합화만 담당 (cron 함수는 0040.sql이 canonical). fresh DB는 0040.sql→0041 순으로 양 함수 모두 정합.
