-- migration: 0024_report_critic_findings
-- purpose: PR3c — critic 6축 verdict persistence + run_id pinning + target_stage 박제.
-- SoT: docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md (v6, omxy R6 CONVERGED, 누적 21 BLOCKERS)
-- ref: 0017 commit_persona_eval + 0021 acquire_batch_lock_v2 패턴 follow.
--
-- B6 fix (omxy R2): run_id uuid 컬럼 + 매 INSERT new run_id 발급 (findings 중복 누적 차단).
-- B7 fix (omxy R1): reason 한국어 500자 cap (zod max(500) + DB CHECK 양쪽).
-- B19 fix (omxy R4): target_stage text not null check ('writer_draft','revised') 컬럼 (pre-revise critic 명명).
-- B10 fix (omxy R2): v_caller_role text := auth.role() declare + service_role uid-null 허용.

create table public.report_critic_findings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.stock_reports(id) on delete cascade,
  run_id uuid not null,
  -- B19 fix (omxy R4): pre-revise vs post-revise critic 명명. PR3c는 1회 hard cap이라 항상 'writer_draft'.
  -- 미래 'revised' stage critic 도입 시 별도 PR + 마이그 확장.
  target_stage text not null check (target_stage in ('writer_draft', 'revised')),
  axis text not null check (axis in ('factuality', 'logic', 'completeness', 'structure', 'bias', 'reader_level')),
  verdict text not null check (verdict in ('PASS', 'WARN', 'FAIL')),
  -- B7 fix: reason 500자 cap (zod max(500) + DB CHECK 양쪽 defense-in-depth).
  reason text not null check (length(reason) <= 500),
  created_at timestamptz not null default now()
);

create index report_critic_findings_report_id_idx on public.report_critic_findings(report_id);
create index report_critic_findings_run_id_idx on public.report_critic_findings(run_id);
create index report_critic_findings_verdict_idx on public.report_critic_findings(verdict)
  where verdict in ('WARN', 'FAIL');

alter table public.report_critic_findings enable row level security;
revoke all on public.report_critic_findings from public;
revoke all on public.report_critic_findings from anon;
grant select on public.report_critic_findings to authenticated;
grant select on public.report_critic_findings to service_role;

create policy "admin select" on public.report_critic_findings
  for select using (public.is_admin());

comment on table public.report_critic_findings is
  'PR3c critic 6축 verdict persistence. orchestrateFullReport이 매 호출 시 RPC insert_critic_findings_run으로 new run_id + 6 row atomic INSERT. target_stage = ''writer_draft'' (PR3c 1회 hard cap).';

-- B6 + B19 fix: atomic RPC — run_id 발급 + 6 row INSERT atomic + target_stage validation.
-- B10 fix (omxy R2): service_role 호출은 auth.uid() null OK → role check 우선.
create or replace function public.insert_critic_findings_run(
  p_report_id uuid,
  p_verdict jsonb,
  p_target_stage text default 'writer_draft'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_role text := auth.role();
  v_caller text;
  v_run_id uuid := gen_random_uuid();
  v_axes text[] := array['factuality', 'logic', 'completeness', 'structure', 'bias', 'reader_level'];
  v_axis text;
  v_node jsonb;
begin
  -- B10 fix: service_role 호출 path
  if auth.uid() is null and coalesce(v_caller_role, '') <> 'service_role' then
    raise exception 'auth_unavailable';
  end if;
  v_caller := coalesce(v_caller_role, '');
  if not (public.is_admin() or v_caller = 'service_role') then
    raise exception 'admin_required';
  end if;
  if p_report_id is null then
    raise exception 'invalid_report_id';
  end if;
  if p_verdict is null or jsonb_typeof(p_verdict) <> 'object' then
    raise exception 'invalid_verdict';
  end if;
  -- B19 fix: target_stage validation
  if coalesce(p_target_stage, '') not in ('writer_draft', 'revised') then
    raise exception 'invalid_target_stage';
  end if;

  -- 6축 전부 존재 + verdict enum + reason 500자 validation (DB-level defense-in-depth)
  foreach v_axis in array v_axes loop
    if not p_verdict ? v_axis then
      raise exception 'verdict_missing_axis:%', v_axis;
    end if;
    v_node := p_verdict -> v_axis;
    if v_node is null or jsonb_typeof(v_node) <> 'object' then
      raise exception 'verdict_invalid_axis:%', v_axis;
    end if;
    if not (v_node ? 'verdict' and v_node ? 'reason') then
      raise exception 'verdict_missing_fields:%', v_axis;
    end if;
    if coalesce(v_node ->> 'verdict', '') not in ('PASS', 'WARN', 'FAIL') then
      raise exception 'verdict_invalid_value:%', v_axis;
    end if;
    if length(coalesce(v_node ->> 'reason', '')) > 500 then
      raise exception 'verdict_reason_too_long:%', v_axis;
    end if;
  end loop;

  -- 6 row INSERT atomic (PL/pgSQL transaction 안)
  foreach v_axis in array v_axes loop
    v_node := p_verdict -> v_axis;
    insert into public.report_critic_findings (report_id, run_id, target_stage, axis, verdict, reason)
    values (p_report_id, v_run_id, p_target_stage, v_axis, v_node ->> 'verdict', v_node ->> 'reason');
  end loop;

  return v_run_id;
end;
$$;

-- 4-grant for RPC
revoke all on function public.insert_critic_findings_run(uuid, jsonb, text) from public;
revoke all on function public.insert_critic_findings_run(uuid, jsonb, text) from anon;
grant execute on function public.insert_critic_findings_run(uuid, jsonb, text) to authenticated;
grant execute on function public.insert_critic_findings_run(uuid, jsonb, text) to service_role;
