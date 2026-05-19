-- Rollback for 0016a. Recreates legacy cost_log = 0005 stub + 0008 hardening final shape.
--
-- ORDER: if 0017 has also been applied, run 0017 rollback FIRST (drops S7a cost_log),
-- then this 0016a rollback (recreates legacy cost_log). Reverse of forward apply order.

create table public.cost_log (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  month date not null,
  model text not null,
  purpose text,
  tokens_prompt int not null default 0,
  tokens_completion int not null default 0,
  cost_krw numeric(12, 2) not null default 0 check (cost_krw >= 0),
  meta jsonb,
  ticker text,
  persona_id text,
  section text
);

create index cost_log_month_idx on public.cost_log (month);
create index cost_log_ts_idx on public.cost_log (ts);
create index cost_log_month_purpose_idx on public.cost_log (month, purpose);
create index cost_log_persona_month_idx on public.cost_log (persona_id, month)
  where persona_id is not null;

alter table public.cost_log enable row level security;

create policy "cost_log admin all"
  on public.cost_log
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
