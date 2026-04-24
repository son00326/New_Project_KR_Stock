-- =====================================================================
-- 0010_alert_event_rls_hardening.sql
-- S7 preflight hardening (2026-04-24)
--
-- Fixes:
--   1) Create E6 alert_event in the real migration chain. 0001 was a sketch.
--   2) Expand alert_event.alert_type for S5/S6 event types before real inserts.
--   3) Split admin-wide read from owner-bound writes for admin_id audit tables.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- E6 alert_event — real table creation + full current AlertType set
-- ---------------------------------------------------------------------
create table if not exists public.alert_event (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  ticker varchar,
  severity text not null check (severity in ('critical','warning','info')),
  trigger_reason text not null,
  signal_sent_at timestamptz not null default now(),
  outcome_at timestamptz,
  t7_price_change numeric,
  decision_recorded text check (decision_recorded in ('sell_all','partial_sell','hold')),
  decision_memo text,
  is_read boolean not null default false
);

alter table public.alert_event
  drop constraint if exists alert_event_alert_type_check;

alter table public.alert_event
  add constraint alert_event_alert_type_check
  check (alert_type in (
    'exit_signal',
    'news_critical',
    'news_warning',
    'price_anomaly',
    'intraday_anomaly',
    'briefing',
    'briefing_failed',
    'scheduler_fail',
    'gating_auto_relief',
    'cost_warning',
    'cost_hardcap',
    'heartbeat_missing'
  ));

create index if not exists alert_event_signal_sent_idx
  on public.alert_event (signal_sent_at desc);
create index if not exists alert_event_type_severity_idx
  on public.alert_event (alert_type, severity, signal_sent_at desc);

alter table public.alert_event enable row level security;

drop policy if exists "alert_event admin all" on public.alert_event;

create policy "alert_event admin select"
  on public.alert_event
  for select
  to authenticated
  using (public.is_admin());

create policy "alert_event admin insert"
  on public.alert_event
  for insert
  to authenticated
  with check (public.is_admin());

-- Alert events are operational audit rows. Do not expose generic UPDATE;
-- use narrow RPCs for mutable fields.
create or replace function public.mark_alert_read(
  p_alert_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  update public.alert_event
  set is_read = true
  where id = p_alert_id;

  if not found then
    raise exception 'alert_not_found';
  end if;
end;
$$;

create or replace function public.record_alert_exit_decision(
  p_alert_id uuid,
  p_decision text,
  p_memo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  if p_decision not in ('sell_all', 'partial_sell', 'hold') then
    raise exception 'invalid_decision';
  end if;

  update public.alert_event
  set
    decision_recorded = p_decision,
    decision_memo = nullif(btrim(coalesce(p_memo, '')), ''),
    is_read = true
  where id = p_alert_id
    and alert_type = 'exit_signal'
    and decision_recorded is null;

  if not found then
    raise exception 'alert_not_found_or_already_decided';
  end if;
end;
$$;

revoke execute on function public.mark_alert_read(uuid) from public;
revoke execute on function public.record_alert_exit_decision(uuid, text, text) from public;
grant execute on function public.mark_alert_read(uuid) to authenticated;
grant execute on function public.record_alert_exit_decision(uuid, text, text) to authenticated;

-- Cron route handlers authenticate with CRON_SECRET, not a Supabase user
-- session. S7 real inserts from cron must use service_role or a
-- security-definer RPC; the anon SSR client will not satisfy these policies.

-- ---------------------------------------------------------------------
-- Owner-bound audit tables — admin-wide read, self-only writes.
-- ---------------------------------------------------------------------
drop policy if exists "report_view_log admin all" on public.report_view_log;

create policy "report_view_log admin select"
  on public.report_view_log
  for select
  to authenticated
  using (public.is_admin());

create policy "report_view_log admin insert own"
  on public.report_view_log
  for insert
  to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

drop policy if exists "portfolio_approval admin all" on public.portfolio_approval;

create policy "portfolio_approval admin select"
  on public.portfolio_approval
  for select
  to authenticated
  using (public.is_admin());

create policy "portfolio_approval admin insert own"
  on public.portfolio_approval
  for insert
  to authenticated
  with check (
    public.is_admin()
    and admin_id = auth.uid()
    and (dispute_raised_by is null or dispute_raised_by = auth.uid())
  );

create policy "portfolio_approval admin update own"
  on public.portfolio_approval
  for update
  to authenticated
  using (public.is_admin() and admin_id = auth.uid())
  with check (
    public.is_admin()
    and admin_id = auth.uid()
  );

-- portfolio_approval is a shared decision row. Generic row updates remain
-- owner-bound above, while cross-admin dispute writes must go through narrow
-- security-definer RPCs so one admin can challenge another admin's approval
-- without gaining broad UPDATE rights on approval_type/is_final/admin_id.
create or replace function public.raise_portfolio_dispute(
  p_approval_id uuid,
  p_reason text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 20 then
    raise exception 'reason_too_short';
  end if;

  update public.portfolio_approval
  set
    dispute_raised_at = v_now,
    dispute_raised_by = auth.uid(),
    dispute_reason = btrim(p_reason),
    dispute_resolved_at = null
  where id = p_approval_id
    and admin_id <> auth.uid()
    and is_final = true
    and approval_type = 'accept'
    and (dispute_raised_at is null or dispute_resolved_at is not null);

  if not found then
    raise exception 'approval_not_found_or_already_disputed';
  end if;

  return v_now;
end;
$$;

create or replace function public.resolve_portfolio_dispute(
  p_approval_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  update public.portfolio_approval
  set dispute_resolved_at = v_now
  where id = p_approval_id
    and dispute_raised_by = auth.uid()
    and dispute_raised_at is not null
    and dispute_resolved_at is null;

  if not found then
    raise exception 'approval_not_found_or_no_open_dispute';
  end if;

  return v_now;
end;
$$;

revoke execute on function public.raise_portfolio_dispute(uuid, text) from public;
revoke execute on function public.resolve_portfolio_dispute(uuid) from public;
grant execute on function public.raise_portfolio_dispute(uuid, text) to authenticated;
grant execute on function public.resolve_portfolio_dispute(uuid) to authenticated;

drop policy if exists "briefing_view_event admin all" on public.briefing_view_event;

create policy "briefing_view_event admin select"
  on public.briefing_view_event
  for select
  to authenticated
  using (public.is_admin());

create policy "briefing_view_event admin insert own"
  on public.briefing_view_event
  for insert
  to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

commit;
