#!/usr/bin/env bash
# pg_smoke_0044.sh — docker-free local PG16 smoke for record_alert_exit_outcome RPC (0044).
#   Asserts: RPC updates exit_signal (outcome_at null) → true + sets t7/outcome_at;
#   idempotent (already-set → false, no overwrite); non-exit alert → false (no change);
#   grant matrix (service_role EXECUTE yes / public·anon·authenticated no); rollback drops clean.
#   Mirrors pg_smoke_0042/0043 pattern: createdb temp → roles + alert_event stub → apply 0044 → assert → dropdb.
#   Requires a LOCAL running PostgreSQL (createdb/psql on PATH). NOT a production test.
set -euo pipefail

if [[ "${PG_SMOKE_ALLOW_REMOTE:-}" != "1" ]]; then
  if [[ -n "${PGSERVICE:-}" ]]; then
    echo "Refusing pg smoke with PGSERVICE=${PGSERVICE}; set PG_SMOKE_ALLOW_REMOTE=1 to override" >&2
    exit 2
  fi
  case "${PGHOST:-}" in
    ""|localhost|127.0.0.1|::1|/*) ;;
    *)
      echo "Refusing pg smoke with non-local PGHOST=${PGHOST}; set PG_SMOKE_ALLOW_REMOTE=1 to override" >&2
      exit 2
      ;;
  esac
fi
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
-- LOAD-BEARING setup: 함수 STUB 선생성 + anon/authenticated 직접 grant.
-- 0044가 `create or replace`(grant 보존)이므로, 마이그 본문의 revoke가 이 grant를 제거해야 통과.
-- → 마이그 0044.sql의 revoke 줄을 삭제하면 anon/authenticated가 grant를 유지해 아래 assertion이 FAIL
--   (revoke가 vacuous-copy가 아니라 마이그 본문 자체를 load-bearing 검증).
create or replace function public.record_alert_exit_outcome(p_alert_id uuid, p_t7_price_change numeric, p_outcome_at timestamptz)
  returns boolean language sql as $f$ select false $f$;
grant execute on function public.record_alert_exit_outcome(uuid, numeric, timestamptz) to anon, authenticated;
do $$ begin
  if not has_function_privilege('anon', 'public.record_alert_exit_outcome(uuid, numeric, timestamptz)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.record_alert_exit_outcome(uuid, numeric, timestamptz)', 'EXECUTE') then
    raise exception 'FAIL(setup): pre-grant did not take';
  end if;
end $$;
SQL

MIG="$(dirname "$0")/../tudal/supabase/migrations"

# Apply migration — create-or-replace는 위 grant를 보존하고, 본문 revoke가 anon/authenticated를 제거해야 함.
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0044_alert_exit_outcome.sql"

# assertions — all server-side (raise exception on failure).
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$
declare
  v_exit uuid;
  v_intraday uuid;
  v_ret boolean;
  v_t7 numeric;
  v_outcome timestamptz;
  v_expected_outcome constant timestamptz := '2026-06-27T06:00:00Z'::timestamptz;
begin
  insert into public.alert_event(alert_type, ticker) values ('exit_signal', '005930') returning id into v_exit;
  insert into public.alert_event(alert_type, ticker) values ('intraday_anomaly', '000660') returning id into v_intraday;

  -- 1) exit_signal, outcome null → returns true + sets t7/outcome
  select public.record_alert_exit_outcome(v_exit, 3.210, v_expected_outcome) into v_ret;
  if not v_ret then raise exception 'FAIL: first outcome write should return true'; end if;
  select t7_price_change, outcome_at into v_t7, v_outcome from public.alert_event where id = v_exit;
  if v_t7 is distinct from 3.210 then raise exception 'FAIL: t7_price_change not set (got %)', v_t7; end if;
  if v_outcome is distinct from v_expected_outcome then
    raise exception 'FAIL: outcome_at mismatch (got %, want %)', v_outcome, v_expected_outcome;
  end if;

  -- 2) idempotent: already-set (outcome_at not null) → returns false, no overwrite(t7/outcome_at)
  select public.record_alert_exit_outcome(v_exit, 9.999, now()) into v_ret;
  if v_ret then raise exception 'FAIL: second write should return false (idempotent)'; end if;
  select t7_price_change, outcome_at into v_t7, v_outcome from public.alert_event where id = v_exit;
  if v_t7 is distinct from 3.210 then raise exception 'FAIL: idempotent call overwrote t7 (got %)', v_t7; end if;
  if v_outcome is distinct from v_expected_outcome then
    raise exception 'FAIL: idempotent call overwrote outcome_at (got %, want %)', v_outcome, v_expected_outcome;
  end if;

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
  if not exists (
    select 1
    from pg_proc
    where proname = 'record_alert_exit_outcome'
      and 'search_path=public, pg_temp' = any(coalesce(proconfig, '{}'))
  ) then
    raise exception 'FAIL: search_path should be public, pg_temp';
  end if;

  raise notice 'PASS: 0044 record_alert_exit_outcome — grant matrix + idempotent + non-exit + search_path (5 groups)';
end $$;
SQL

# rollback drops function cleanly
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0044_alert_exit_outcome.rollback.sql"
psql -v ON_ERROR_STOP=1 -d "$DB" -c "do \$\$ begin if exists (select 1 from pg_proc where proname='record_alert_exit_outcome') then raise exception 'FAIL: rollback did not drop function'; end if; raise notice 'PASS: 0044 rollback clean'; end \$\$;"

echo "ALL_0044_SMOKE_PASS"
