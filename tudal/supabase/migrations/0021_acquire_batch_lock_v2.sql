-- migration: 0021_acquire_batch_lock_v2
-- purpose: PR1 B1 fix — cron caller path 분리. service_role bypass + admin auth.uid() 두 caller 지원.
-- 기존 acquire_batch_lock(text)는 admin server action backward-compat 위해 보존 (0017).
-- cron route는 본 v2를 호출 (p_caller_kind='cron'), service-role client 필수.
-- ref: docs/superpowers/plans/2026-05-22-pr1-cron-real-path.md Task 1b · omxy R1 B1

-- monthly_batch_runs.started_by NOT NULL 제거 (cron caller v_caller=null INSERT 허용)
-- B11 fix (omxy R3): SECURITY DEFINER 4종 grant — service_role 명시.
alter table public.monthly_batch_runs alter column started_by drop not null;

create or replace function public.acquire_batch_lock_v2(
  p_month text,
  p_caller_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted timestamptz;
  v_status text;
  v_caller uuid;
  v_caller_role text := auth.role();
begin
  -- caller kind 검증
  if p_caller_kind not in ('admin', 'cron') then
    raise exception 'invalid_caller_kind';
  end if;

  if p_caller_kind = 'admin' then
    v_caller := auth.uid();
    if v_caller is null then raise exception 'auth_unavailable'; end if;
    if not public.is_admin() then raise exception 'admin_required'; end if;
  elsif p_caller_kind = 'cron' then
    -- service-role bypass — Vercel cron route만 호출 (service_role key 필수)
    if v_caller_role is distinct from 'service_role' then
      raise exception 'cron_caller_requires_service_role';
    end if;
    v_caller := null;
  end if;

  insert into public.monthly_batch_runs (month, status, started_at, started_by, call_count_done)
  values (p_month, 'running', now(), v_caller, 0)
  on conflict (month) do nothing
  returning started_at into v_inserted;

  if v_inserted is not null then
    return jsonb_build_object('acquired', true, 'resumed', false);
  end if;

  select status into v_status from public.monthly_batch_runs where month = p_month;
  if v_status = 'running' then raise exception 'batch_already_running'; end if;
  if v_status = 'succeeded' then raise exception 'batch_already_completed'; end if;
  if v_status = 'failed' then
    update public.monthly_batch_runs
      set status='running', started_at=now(), started_by=v_caller,
          finished_at=null, error_code=null, call_count_done=0
      where month = p_month;
    return jsonb_build_object('acquired', true, 'resumed', true);
  end if;
  raise exception 'batch_lock_unknown_state';
end;
$$;

-- B7 fix (omxy R2): SECURITY DEFINER 4종 세트 (revoke public/anon + grant authenticated + grant service_role).
-- 48차 lesson 박제 확장 (3종 → 4종).
revoke execute on function public.acquire_batch_lock_v2(text, text) from public;
revoke execute on function public.acquire_batch_lock_v2(text, text) from anon;
grant execute on function public.acquire_batch_lock_v2(text, text) to authenticated;
grant execute on function public.acquire_batch_lock_v2(text, text) to service_role;
