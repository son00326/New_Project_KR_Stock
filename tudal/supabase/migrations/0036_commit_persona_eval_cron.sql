-- 0036 (P2 / PR5b) — commit_persona_eval_cron: service-role-callable Section 8 + committee_votes.
--
-- 배경 (omxy P2 design R4 BLOCKER 1): 기존 commit_persona_eval(0017)은 auth.uid()+is_admin()를 강제하고
--   grant도 authenticated only라, report-worker의 service-role cron 경로(auth.uid()=null)에서 호출 불가.
--   → cron 전용 변형 신설. 원 admin RPC(commit_persona_eval/commit_badge_only)는 무변경.
--
-- 차이점: auth.uid()/is_admin() 게이트 대신 p_called_by(cron-system user UUID)를 받아 auth.users 존재 검증
--   (worker step-0 cron-system-user 가드와 동일 의미). 그 외 검증/INSERT/committee_votes 매핑은 0017과 동일.
--   revoke public/anon + grant service_role only (worker cron path 전용; admin path는 0017 RPC 유지).
--
-- ⚠️ DORMANT: PR5B_SECTION8_ENABLED flag-off면 호출 0. USER가 production apply (live Section 8 가동 전).
--   미적용 상태에서 flag-on이면 commitSection8Step이 RPC 부재로 throw → fail-closed (spend는 Core-11 후
--   commit 단계라, 호출 전 schema preflight 권장 — 코드 측 가드).

create or replace function public.commit_persona_eval_cron(
  p_month text,
  p_ticker text,
  p_section_8 jsonb,
  p_votes jsonb,
  p_consensus_badge text,
  p_called_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report_id uuid;
  v_vote_count int;
begin
  -- cron 경로 인증: auth.uid() 대신 p_called_by(cron-system user) 존재 검증.
  if p_called_by is null then
    raise exception 'cron_called_by_required';
  end if;
  if not exists (select 1 from auth.users where id = p_called_by) then
    raise exception 'cron_system_user_not_found';
  end if;

  -- 이하 검증은 0017 commit_persona_eval과 동일 (null 가드 / 11-length / vote 값 / row / badge).
  if p_votes is null or jsonb_typeof(p_votes) is distinct from 'array' then
    raise exception 'votes_must_be_array';
  end if;
  if jsonb_array_length(p_votes) is distinct from 11 then
    raise exception 'votes_length_must_be_11';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_votes) v
    where coalesce(v->>'vote', '') not in ('BUY', 'HOLD', 'SELL')
  ) then
    raise exception 'invalid_vote_value';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_votes) v
    where coalesce(v->>'persona_id', '') = ''
       or coalesce(v->>'persona_layer', '') <> 'core'
       or coalesce(v->>'argument_excerpt', '') = ''
  ) then
    raise exception 'invalid_vote_row';
  end if;
  if p_consensus_badge is null or p_consensus_badge not in ('🟢', '🔵', '🟣', '🟡') then
    raise exception 'invalid_badge_for_full_report';
  end if;

  -- Section 8만 갱신 (section_0~7/appendix preserve — 0017과 동일 ON CONFLICT 타겟).
  insert into public.stock_reports (month, ticker, section_8, consensus_badge, generated_at)
  values (to_date(p_month || '-01', 'YYYY-MM-DD'), p_ticker, p_section_8, p_consensus_badge, now())
  on conflict (ticker, month) where is_latest = true do update
    set section_8 = excluded.section_8,
        consensus_badge = excluded.consensus_badge,
        generated_at = now()
  returning id into v_report_id;

  delete from public.committee_votes where report_id = v_report_id;

  insert into public.committee_votes (report_id, persona_id, persona_layer, vote, argument_excerpt)
  select
    v_report_id,
    (v ->> 'persona_id')::text,
    (v ->> 'persona_layer')::text,
    case (v ->> 'vote')
      when 'BUY' then 'approve'
      when 'HOLD' then 'abstain'
      when 'SELL' then 'reject'
    end,
    (v ->> 'argument_excerpt')::text
  from jsonb_array_elements(p_votes) as v;

  get diagnostics v_vote_count = row_count;

  return jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'votes_inserted', v_vote_count
  );
end;
$$;

revoke all on function public.commit_persona_eval_cron(text, text, jsonb, jsonb, text, uuid) from public;
revoke all on function public.commit_persona_eval_cron(text, text, jsonb, jsonb, text, uuid) from anon;
grant execute on function public.commit_persona_eval_cron(text, text, jsonb, jsonb, text, uuid) to service_role;

-- reset_section8_eligible_jobs (omxy P2 design R4 BLOCKER 2): enqueue-step reset.
--   배경: report_batch_job은 unique(month,ticker)+enqueue ignoreDuplicates라, 한 번 done/deferred면
--   다시 pending 안 됨(claim_next_report_jobs는 pending/stale-running만 claim). 따라서 Tier0(배지 null)
--   때 done/deferred 처리된 job은 나중에 P3가 canonical 배지를 채워도 영구 skip → Section 8 영구 누락.
--   → flag-on enqueue 단계에서 "body complete(section_0&&7) + section_8 null + canonical 배지 non-⚪"
--   인 done 또는 section8_not_ready deferred job만 pending reset(attempts/error/timestamps 초기화)해 재처리 가능하게 함.
--   ⚪/null 배지 row는 reset 안 함(배지 생긴 뒤에만 eligible). DORMANT: caller는 PR5B_SECTION8_ENABLED on일 때만.
create or replace function public.reset_section8_eligible_jobs(p_month text)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
  v_month_date date := to_date(p_month || '-01', 'YYYY-MM-DD');
begin
  update public.report_batch_job j
  set status = 'pending',
      attempts = 0,
      last_error = null,
      claimed_at = null,
      started_at = null,
      finished_at = null
  where j.month = p_month
    and (
      j.status = 'done'
      or (j.status = 'deferred' and j.last_error = 'section8_not_ready')
    )
    and exists (
      select 1 from public.stock_reports r
      where r.ticker = j.ticker
        and r.month = v_month_date
        and r.is_latest = true
        and r.section_0 is not null
        and r.section_7 is not null
        and r.section_8 is null
    )
    and exists (
      select 1 from public.short_list_30 s
      where s.ticker = j.ticker
        and s.month = v_month_date
        and s.consensus_badge in ('🟢', '🔵', '🟣', '🟡')
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.reset_section8_eligible_jobs(text) from public;
revoke all on function public.reset_section8_eligible_jobs(text) from anon;
grant execute on function public.reset_section8_eligible_jobs(text) to service_role;
