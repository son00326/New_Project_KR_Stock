#!/usr/bin/env bash
# pg_smoke_0042.sh — docker-free local PG16 smoke for m12a_ticker_assessment (0042).
#   Asserts: table + CHECK constraints (ticker/surface/scope/levels/actions) + GAP2 price-consistency CHECK
#   + FK to news_event (cascade) + optional alert_event FK (set null) + RLS enabled + rollback drops clean.
#   Mirrors pg_smoke_0040 pattern: createdb temp → minimal dep schema + is_admin stub → apply 0042 → assert → dropdb.
#   Requires a LOCAL running PostgreSQL (createdb/psql on PATH). NOT a production test.
set -euo pipefail
DB="pg_smoke_0042_$$"
cleanup() { dropdb --if-exists "$DB" 2>/dev/null || true; }
trap cleanup EXIT
createdb "$DB"

# minimal dependency schema: is_admin stub + news_event(id) + alert_event(id) so FKs resolve.
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
create function public.is_admin() returns boolean language sql stable as $f$ select true $f$;
create table public.news_event (
  id uuid primary key default gen_random_uuid(),
  url text not null
);
create table public.alert_event (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null
);
SQL

MIG="$(dirname "$0")/../tudal/supabase/migrations"
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0042_m12a_ticker_assessment.sql"

# assertions — all server-side (raise exception on failure).
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$
declare
  v_news uuid;
  v_alert uuid;
  v_id uuid;
  v_count int;
  v_failed boolean;
begin
  insert into public.news_event(url) values ('https://news/1') returning id into v_news;
  insert into public.alert_event(alert_type) values ('news_critical') returning id into v_alert;

  -- 1) valid shadowed row (would-remove, no price) → OK
  insert into public.m12a_ticker_assessment(
    news_event_id, run_id, month, ticker, surface, scope, severity, confidence, materiality,
    directness, thesis_break, recommended_action, action_taken
  ) values (
    v_news, 'run-1', '2026-06-01', '005930', 'list', 'company', 'critical', 'high', 'high',
    'direct', true, 'auto_remove', 'shadowed'
  ) returning id into v_id;

  -- 2) valid removed row WITH price 3-tuple + alert link → OK
  insert into public.m12a_ticker_assessment(
    news_event_id, run_id, month, ticker, surface, scope, severity, confidence, materiality,
    directness, thesis_break, recommended_action, action_taken,
    price_basis_date, price_source, execution_assumption, alert_event_id
  ) values (
    v_news, 'run-1', '2026-06-01', '000660', 'portfolio', 'company', 'critical', 'high', 'high',
    'direct', true, 'auto_remove', 'removed',
    '20260625', 'KRX_EOD', 'virtual_eod', v_alert
  );

  -- 3) removed WITHOUT price → GAP2 consistency CHECK must reject
  v_failed := false;
  begin
    insert into public.m12a_ticker_assessment(
      news_event_id, run_id, month, ticker, surface, scope, severity, confidence, materiality,
      directness, thesis_break, recommended_action, action_taken
    ) values (
      v_news, 'run-1', '2026-06-01', '035720', 'list', 'company', 'critical', 'high', 'high',
      'direct', true, 'auto_remove', 'removed'  -- no price → must fail
    );
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: removed without price should violate price-consistency CHECK'; end if;

  -- 4) removed WITH malformed price_basis_date → KRX EOD basis CHECK must reject
  v_failed := false;
  begin
    insert into public.m12a_ticker_assessment(
      news_event_id, run_id, month, ticker, surface, scope, severity, confidence, materiality,
      directness, thesis_break, recommended_action, action_taken,
      price_basis_date, price_source, execution_assumption
    ) values (
      v_news, 'run-1', '2026-06-01', '051910', 'list', 'company', 'critical', 'high', 'high',
      'direct', true, 'auto_remove', 'removed', '2026-06-25', 'KRX_EOD', 'virtual_eod'
    );
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: malformed price_basis_date should violate CHECK'; end if;

  -- 5) shadowed WITH price → consistency CHECK must reject
  v_failed := false;
  begin
    insert into public.m12a_ticker_assessment(
      news_event_id, run_id, month, ticker, surface, scope, severity, confidence, materiality,
      directness, thesis_break, recommended_action, action_taken,
      price_basis_date, price_source, execution_assumption
    ) values (
      v_news, 'run-1', '2026-06-01', '051910', 'list', 'company', 'critical', 'high', 'high',
      'direct', true, 'auto_remove', 'shadowed', '20260625', 'KRX_EOD', 'virtual_eod'
    );
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: shadowed with price should violate price-consistency CHECK'; end if;

  -- 6) bad month (not YYYY-MM-01) → CHECK reject
  v_failed := false;
  begin
    insert into public.m12a_ticker_assessment(
      news_event_id, run_id, month, ticker, surface, scope, severity, confidence, materiality,
      directness, thesis_break, recommended_action, action_taken
    ) values (
      v_news, 'run-1', '2026-06', '005380', 'list', 'company', 'critical', 'high', 'high',
      'direct', true, 'auto_remove', 'shadowed'
    );
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: malformed month should violate CHECK'; end if;

  -- 7) bad ticker (non 6-digit) → CHECK reject
  v_failed := false;
  begin
    insert into public.m12a_ticker_assessment(
      news_event_id, run_id, month, ticker, surface, scope, severity, confidence, materiality,
      directness, thesis_break, recommended_action, action_taken
    ) values (
      v_news, 'run-1', '2026-06-01', '12345', 'list', 'company', 'critical', 'high', 'high',
      'direct', true, 'auto_remove', 'shadowed'
    );
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: 5-digit ticker should violate CHECK'; end if;

  -- 8) bad action_taken enum → CHECK reject
  v_failed := false;
  begin
    insert into public.m12a_ticker_assessment(
      news_event_id, run_id, month, ticker, surface, scope, severity, confidence, materiality,
      directness, thesis_break, recommended_action, action_taken
    ) values (
      v_news, 'run-1', '2026-06-01', '005380', 'list', 'company', 'critical', 'high', 'high',
      'direct', true, 'auto_remove', 'deleted'
    );
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: invalid action_taken should violate CHECK'; end if;

  -- 9) RLS enabled
  select relrowsecurity into v_failed from pg_class where relname = 'm12a_ticker_assessment';
  if not v_failed then raise exception 'FAIL: RLS not enabled on m12a_ticker_assessment'; end if;

  -- 10) FK cascade: deleting news_event removes its assessments
  delete from public.news_event where id = v_news;
  select count(*) into v_count from public.m12a_ticker_assessment;
  if v_count <> 0 then raise exception 'FAIL: news_event delete should cascade (got %)', v_count; end if;

  raise notice 'PASS: 0042 m12a_ticker_assessment — 10 assertions';
end $$;
SQL

# 9) rollback drops table cleanly
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0042_m12a_ticker_assessment.rollback.sql"
psql -v ON_ERROR_STOP=1 -d "$DB" -c "do \$\$ begin if exists (select 1 from information_schema.tables where table_name='m12a_ticker_assessment') then raise exception 'FAIL: rollback did not drop table'; end if; raise notice 'PASS: 0042 rollback clean'; end \$\$;"

echo "ALL_0042_SMOKE_PASS"
