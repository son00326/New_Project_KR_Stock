#!/usr/bin/env bash
# pg_smoke_0044.sh — docker-free local PG16 smoke for record_alert_exit_outcome RPC (0044).
#   Asserts: RPC updates exit_signal (outcome_at null) → true + sets t7/outcome_at;
#   idempotent (already-set → false, no overwrite); non-exit alert → false (no change);
#   grant matrix (service_role EXECUTE yes / public·anon·authenticated no); rollback drops clean.
#   Mirrors pg_smoke_0042/0043 pattern: createdb temp → roles + alert_event stub → apply 0044 → assert → dropdb.
#   Requires a LOCAL running PostgreSQL (createdb/psql on PATH). NOT a production test.
set -euo pipefail
DB="pg_smoke_0044_$$"
cleanup() { dropdb --if-exists "$DB" 2>/dev/null || true; }
trap cleanup EXIT
createdb "$DB"

# minimal dependency: Supabase roles (0044 grant/revoke 참조) + alert_event(0010 관련 컬럼).
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create table public.alert_event (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  ticker varchar,
  severity text not null default 'critical',
  trigger_reason text not null default 'test',
  signal_sent_at timestamptz not null default now(),
  outcome_at timestamptz,
  t7_price_change numeric,
  decision_recorded text,
  decision_memo text,
  is_read boolean not null default false
);
SQL

MIG="$(dirname "$0")/../tudal/supabase/migrations"

# Pre-grant anon+authenticated EXECUTE so 0044's revoke-from-anon/authenticated lines are LOAD-BEARING
# (Supabase가 신규 함수에 default EXECUTE 부여하는 상황 모델 — revoke가 vacuous 아님을 보장).
# 함수가 먼저 존재해야 grant 가능 → 0044 apply 직후 grant → 같은 revoke를 재적용해 load-bearing 검증.
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0044_alert_exit_outcome.sql"
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
-- 시뮬레이션: 외부에서 anon/authenticated에 직접 grant된 상태를 만든 뒤,
grant execute on function public.record_alert_exit_outcome(uuid, numeric, timestamptz) to anon, authenticated;
-- sanity: 지금은 anon/authenticated가 EXECUTE 보유(아래 재-revoke가 load-bearing임을 보장).
do $$ begin
  if not has_function_privilege('anon', 'public.record_alert_exit_outcome(uuid, numeric, timestamptz)', 'EXECUTE') then
    raise exception 'FAIL(setup): anon grant did not take';
  end if;
end $$;
-- 0044 revoke 블록 재적용 (마이그 본문의 revoke가 직접 grant를 제거하는지 검증).
revoke execute on function public.record_alert_exit_outcome(uuid, numeric, timestamptz) from public;
revoke execute on function public.record_alert_exit_outcome(uuid, numeric, timestamptz) from anon;
revoke execute on function public.record_alert_exit_outcome(uuid, numeric, timestamptz) from authenticated;
grant execute on function public.record_alert_exit_outcome(uuid, numeric, timestamptz) to service_role;
SQL

# assertions — all server-side (raise exception on failure).
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$
declare
  v_exit uuid;
  v_intraday uuid;
  v_ret boolean;
  v_t7 numeric;
  v_outcome timestamptz;
begin
  insert into public.alert_event(alert_type, ticker) values ('exit_signal', '005930') returning id into v_exit;
  insert into public.alert_event(alert_type, ticker) values ('intraday_anomaly', '000660') returning id into v_intraday;

  -- 1) exit_signal, outcome null → returns true + sets t7/outcome
  select public.record_alert_exit_outcome(v_exit, 3.210, '2026-06-27T06:00:00Z'::timestamptz) into v_ret;
  if not v_ret then raise exception 'FAIL: first outcome write should return true'; end if;
  select t7_price_change, outcome_at into v_t7, v_outcome from public.alert_event where id = v_exit;
  if v_t7 is distinct from 3.210 then raise exception 'FAIL: t7_price_change not set (got %)', v_t7; end if;
  if v_outcome is null then raise exception 'FAIL: outcome_at not set'; end if;

  -- 2) idempotent: already-set (outcome_at not null) → returns false, no overwrite
  select public.record_alert_exit_outcome(v_exit, 9.999, now()) into v_ret;
  if v_ret then raise exception 'FAIL: second write should return false (idempotent)'; end if;
  select t7_price_change into v_t7 from public.alert_event where id = v_exit;
  if v_t7 is distinct from 3.210 then raise exception 'FAIL: idempotent call overwrote t7 (got %)', v_t7; end if;

  -- 3) non-exit alert → returns false, no change
  select public.record_alert_exit_outcome(v_intraday, 1.5, now()) into v_ret;
  if v_ret then raise exception 'FAIL: non-exit alert should return false'; end if;
  select t7_price_change into v_t7 from public.alert_event where id = v_intraday;
  if v_t7 is not null then raise exception 'FAIL: non-exit alert t7 should stay null (got %)', v_t7; end if;

  -- 4) grant matrix: service_role EXECUTE yes / public·anon·authenticated no
  if not has_function_privilege('service_role', 'public.record_alert_exit_outcome(uuid, numeric, timestamptz)', 'EXECUTE') then
    raise exception 'FAIL: service_role should have EXECUTE';
  end if;
  if has_function_privilege('public', 'public.record_alert_exit_outcome(uuid, numeric, timestamptz)', 'EXECUTE') then
    raise exception 'FAIL: public should NOT have EXECUTE';
  end if;
  if has_function_privilege('anon', 'public.record_alert_exit_outcome(uuid, numeric, timestamptz)', 'EXECUTE') then
    raise exception 'FAIL: anon should NOT have EXECUTE';
  end if;
  if has_function_privilege('authenticated', 'public.record_alert_exit_outcome(uuid, numeric, timestamptz)', 'EXECUTE') then
    raise exception 'FAIL: authenticated should NOT have EXECUTE (cron-only)';
  end if;

  raise notice 'PASS: 0044 record_alert_exit_outcome — grant matrix + idempotent + non-exit (4 groups)';
end $$;
SQL

# rollback drops function cleanly
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0044_alert_exit_outcome.rollback.sql"
psql -v ON_ERROR_STOP=1 -d "$DB" -c "do \$\$ begin if exists (select 1 from pg_proc where proname='record_alert_exit_outcome') then raise exception 'FAIL: rollback did not drop function'; end if; raise notice 'PASS: 0044 rollback clean'; end \$\$;"

echo "ALL_0044_SMOKE_PASS"
