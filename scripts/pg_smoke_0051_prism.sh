#!/usr/bin/env bash
set -euo pipefail

DB="prism_0051_smoke_$$"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="${HERE}/../tudal/supabase/migrations/0051_prism_snapshot.sql"
ROLLBACK="${HERE}/../tudal/supabase/migrations/0051_prism_snapshot.rollback.sql"
WORK="$(mktemp -d)"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

PSQL="psql -v ON_ERROR_STOP=1 -X -q -d $DB"
PIN="b8171a4e95314b2fc29b81af0ee74d47e8a705e9"
HASH_A="$(printf 'a%.0s' {1..64})"
HASH_B="$(printf 'b%.0s' {1..64})"
HASH_C="$(printf 'c%.0s' {1..64})"

say() { printf '\n=== %s ===\n' "$1"; }
fail() { printf 'PG0051 SMOKE FAIL: %s\n' "$1" >&2; exit 1; }
scalar() { $PSQL -t -A -c "$1" | tail -1; }
assert_ok() { $PSQL -c "$1" >/dev/null || fail "$2"; printf 'ok: %s\n' "$2"; }
assert_raises() {
  local sql="$1" needle="$2" label="$3" out
  out="$($PSQL -t -c "do \$smoke\$ begin
    $sql
    raise exception 'SMOKE_NO_ERROR';
  exception when others then
    if sqlerrm not like '%$needle%' then raise exception 'SMOKE_WRONG:%', sqlerrm; end if;
  end \$smoke\$;" 2>&1)" || true
  if grep -q "SMOKE_NO_ERROR" <<<"$out"; then fail "$label expected $needle but no error was raised"; fi
  if grep -q "SMOKE_WRONG" <<<"$out"; then fail "$label expected $needle but got: $out"; fi
  if grep -qiE "ERROR:|FATAL:|psql:" <<<"$out"; then fail "$label unexpected SQL failure: $out"; fi
  printf 'ok: %s -> %s\n' "$label" "$needle"
}

rpc_sql() {
  local market="$1" day="$2" slot="$3" session_day="$4" generated="$5" payload="$6" hash="$7" terminal="$8"
  printf "select public.upsert_prism_snapshot('%s','%s','%s','%s','payload','%s','%s'::jsonb,'%s','%s','1',%s);" \
    "$market" "$day" "$slot" "$session_day" "$generated" "$payload" "$hash" "$PIN" "$terminal"
}

service_scalar() {
  scalar "set role service_role; select set_config('smoke.role','service_role',false); $1"
}

[ -f "$MIG" ] || fail "migration missing"
[ -f "$ROLLBACK" ] || fail "rollback missing"

say "additive and rollback preflight"
if grep -niE '(alter|drop|insert into|update|delete from)[[:space:]]+public\.' "$MIG" \
  | grep -vE 'prism_snapshot|prism_benchmark_meta' >/dev/null; then
  fail "migration targets a non-PRISM public object"
fi
if grep -niE 'drop (table|function).*public\.' "$ROLLBACK" | grep -vE 'prism_snapshot|prism_benchmark_meta|upsert_prism_snapshot' >/dev/null; then
  fail "rollback targets a non-0051 object"
fi
printf 'ok: migration and rollback target only 0051 artifacts\n'

dropdb --if-exists "$DB" >/dev/null 2>&1 || true
createdb "$DB"
cat >"$WORK/bootstrap.sql" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth;
create or replace function auth.role() returns text language sql stable as
  $f$ select coalesce(nullif(current_setting('smoke.role', true), ''), 'unknown') $f$;
create or replace function public.is_admin() returns boolean language sql stable as
  $f$ select coalesce(nullif(current_setting('smoke.is_admin', true), '')::boolean, false) $f$;
SQL
$PSQL -f "$WORK/bootstrap.sql"
$PSQL -f "$MIG"
printf 'ok: 0051 compiles and applies on local PostgreSQL\n'

say "schema, RLS, grants, and RPC hardening"
[ "$(scalar "select count(*) from pg_class where relname in ('prism_snapshot','prism_benchmark_meta') and relrowsecurity")" = "2" ] \
  || fail "both tables must exist with RLS enabled"
for table in prism_snapshot prism_benchmark_meta; do
  [ "$(scalar "select count(*) from information_schema.role_table_grants where table_name='$table' and grantee='authenticated' and privilege_type='SELECT'")" = "1" ] \
    || fail "$table authenticated SELECT grant missing"
  [ "$(scalar "select count(*) from information_schema.role_table_grants where table_name='$table' and grantee in ('anon','authenticated','service_role') and privilege_type in ('INSERT','UPDATE','DELETE')")" = "0" ] \
    || fail "$table exposes direct write grants"
done
[ "$(scalar "select prosecdef from pg_proc where proname='upsert_prism_snapshot'")" = "t" ] || fail "RPC is not SECURITY DEFINER"
scalar "select array_to_string(proconfig,',') from pg_proc where proname='upsert_prism_snapshot'" \
  | grep -q 'search_path=public, pg_temp' || fail "RPC search_path is not pinned"
SIGNATURE="public.upsert_prism_snapshot(text,text,text,text,text,text,jsonb,text,text,text,jsonb)"
[ "$(scalar "select has_function_privilege('service_role','$SIGNATURE','execute')")" = "t" ] || fail "service_role EXECUTE missing"
[ "$(scalar "select has_function_privilege('authenticated','$SIGNATURE','execute')")" = "f" ] || fail "authenticated EXECUTE must be denied"
[ "$(scalar "select has_function_privilege('anon','$SIGNATURE','execute')")" = "f" ] || fail "anon EXECUTE must be denied"
assert_raises "perform public.upsert_prism_snapshot('kr','2026-07-15','am','2026-07-15','payload','2026-07-15T11:05:00+09:00','{}'::jsonb,'$HASH_A','$PIN','1',null);" "service_role_required" "owner RPC role gate"
assert_raises "set local role authenticated; perform public.upsert_prism_snapshot('kr','2026-07-15','am','2026-07-15','payload','2026-07-15T11:05:00+09:00','{}'::jsonb,'$HASH_A','$PIN','1',null);" "permission denied" "authenticated RPC denied"
assert_raises "set local role anon; perform public.upsert_prism_snapshot('kr','2026-07-15','am','2026-07-15','payload','2026-07-15T11:05:00+09:00','{}'::jsonb,'$HASH_A','$PIN','1',null);" "permission denied" "anon RPC denied"

say "happy path and immutable benchmark anchor"
KR_AM="$(rpc_sql kr 2026-07-15 am 2026-07-15 2026-07-15T11:05:00+09:00 '{"value":1}' "$HASH_A" '$json${"date":"2026-07-15","cumulative_realized_profit":10,"prism_simulator_return":1.5}$json$::jsonb')"
[ "$(service_scalar "$KR_AM" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')" = "inserted" ] || fail "KR am insert did not return inserted"
ANCHOR_ID="$(scalar "select anchored_snapshot_id from public.prism_benchmark_meta where market='kr'")"
[ -n "$ANCHOR_ID" ] || fail "first snapshot did not atomically create benchmark meta"
[ "$(scalar "select benchmark_session_date from public.prism_benchmark_meta where market='kr'")" = "2026-07-15" ] || fail "benchmark date mismatch"

KR_PM="$(rpc_sql kr 2026-07-15 pm 2026-07-15 2026-07-15T17:10:00+09:00 '{"value":2}' "$HASH_B" null)"
[ "$(service_scalar "$KR_PM" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')" = "inserted" ] || fail "KR pm insert did not return inserted"
[ "$(scalar "select count(*) from public.prism_snapshot where market='kr' and snapshot_date='2026-07-15'")" = "2" ] || fail "slot separation did not preserve two KR snapshots"
[ "$(scalar "select anchored_snapshot_id from public.prism_benchmark_meta where market='kr'")" = "$ANCHOR_ID" ] || fail "second slot changed benchmark anchor"

US="$(rpc_sql us 2026-07-16 daily 2026-07-15 2026-07-16T08:00:00+09:00 '{"value":3}' "$HASH_C" null)"
[ "$(service_scalar "$US" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')" = "inserted" ] || fail "US insert did not return inserted"
[ "$(scalar "select count(*) from public.prism_benchmark_meta")" = "2" ] || fail "benchmark meta must contain one row per market"
printf 'ok: first snapshot creates meta, slots split, markets anchor independently\n'

say "updated, unchanged_noop, and stale_rejected"
FIRST_AT="$(scalar "select first_ingested_at from public.prism_snapshot where id='$ANCHOR_ID'")"
UPDATED="$(rpc_sql kr 2026-07-15 am 2026-07-15 2026-07-15T11:06:00+09:00 '{"value":4}' "$HASH_B" null)"
[ "$(service_scalar "$UPDATED" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')" = "updated" ] || fail "newer changed payload did not return updated"
[ "$(scalar "select first_ingested_at from public.prism_snapshot where id='$ANCHOR_ID'")" = "$FIRST_AT" ] || fail "first_ingested_at changed on update"
META_BEFORE="$(scalar "select benchmark_session_date || '|' || anchored_snapshot_id || '|' || created_at from public.prism_benchmark_meta where market='kr'")"
LAST_BEFORE_NOOP="$(scalar "select last_ingested_at from public.prism_snapshot where id='$ANCHOR_ID'")"
$PSQL -c "select pg_sleep(0.01)" >/dev/null
NOOP="$(rpc_sql kr 2026-07-15 am 2026-07-14 2026-07-15T11:07:00+09:00 '{"value":999}' "$HASH_B" null)"
[ "$(service_scalar "$NOOP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')" = "unchanged_noop" ] || fail "same hash did not return unchanged_noop"
[ "$(scalar "select payload->>'value' from public.prism_snapshot where id='$ANCHOR_ID'")" = "4" ] || fail "unchanged_noop mutated payload"
[ "$(scalar "select market_session_date from public.prism_snapshot where id='$ANCHOR_ID'")" = "2026-07-15" ] || fail "unchanged_noop mutated session date"
[ "$(scalar "select (last_ingested_at > '$LAST_BEFORE_NOOP'::timestamptz)::text from public.prism_snapshot where id='$ANCHOR_ID'")" = "true" ] || fail "unchanged_noop did not advance last_ingested_at"
[ "$(scalar "select benchmark_session_date || '|' || anchored_snapshot_id || '|' || created_at from public.prism_benchmark_meta where market='kr'")" = "$META_BEFORE" ] || fail "reingest mutated benchmark meta"
LAST_BEFORE_STALE="$(scalar "select last_ingested_at from public.prism_snapshot where id='$ANCHOR_ID'")"
STALE="$(rpc_sql kr 2026-07-15 am 2026-07-15 2026-07-15T11:00:00+09:00 '{"value":5}' "$HASH_C" null)"
[ "$(service_scalar "$STALE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')" = "stale_rejected" ] || fail "older payload did not return stale_rejected"
[ "$(scalar "select last_ingested_at from public.prism_snapshot where id='$ANCHOR_ID'")" = "$LAST_BEFORE_STALE" ] || fail "stale_rejected changed last_ingested_at"
printf 'ok: monotonic statuses and ingestion timestamps\n'

say "fail-closed checks and terminal shape"
BAD_SLOT="$(rpc_sql kr 2026-07-17 daily 2026-07-17 2026-07-17T11:05:00+09:00 '{}' "$HASH_A" null)"
assert_raises "set local role service_role; perform set_config('smoke.role','service_role',true); perform ${BAD_SLOT#select }" "market_slot_mismatch" "RPC market-slot mismatch"
BAD_TERMINAL="$(rpc_sql kr 2026-07-17 am 2026-07-17 2026-07-17T11:05:00+09:00 '{}' "$HASH_A" '$json${"date":"2026-07-17","cumulative_realized_profit":1,"prism_simulator_return":"bad"}$json$::jsonb')"
assert_raises "set local role service_role; perform set_config('smoke.role','service_role',true); perform ${BAD_TERMINAL#select }" "bad_terminal_performance_shape" "terminal shape violation"
OLD_SESSION="$(rpc_sql kr 2026-07-17 am 2026-07-09 2026-07-17T11:05:00+09:00 '{}' "$HASH_A" null)"
assert_raises "set local role service_role; perform set_config('smoke.role','service_role',true); perform ${OLD_SESSION#select }" "market_session_too_old" "session-date freshness violation"
assert_raises "insert into public.prism_snapshot(market,snapshot_date,snapshot_slot,market_session_date,session_date_source,generated_at,payload,payload_sha256,source_commit,contract_version) values('us','2026-07-17','am','2026-07-16','nominal',now(),'{}','$HASH_A','$PIN',1);" "prism_snapshot_market_slot_check" "table market-slot CHECK"

say "direct DML, RLS SELECT, and anchor FK restrictions"
for role in service_role authenticated anon; do
  assert_raises "set local role $role; insert into public.prism_snapshot(market,snapshot_date,snapshot_slot,market_session_date,session_date_source,generated_at,payload,payload_sha256,source_commit,contract_version) values('kr','2026-07-18','am','2026-07-18','nominal',now(),'{}','$HASH_A','$PIN',1);" "permission denied" "$role snapshot INSERT denied"
  assert_raises "set local role $role; update public.prism_benchmark_meta set benchmark_session_date='2026-01-01' where market='kr';" "permission denied" "$role meta UPDATE denied"
done
NONADMIN="$(scalar "begin; set local role authenticated; select set_config('smoke.is_admin','false',true); select count(*) from public.prism_benchmark_meta; rollback;")"
[ "$NONADMIN" = "0" ] || fail "authenticated non-admin must see no meta rows"
ADMIN="$(scalar "begin; set local role authenticated; select set_config('smoke.is_admin','true',true); select count(*) from public.prism_benchmark_meta; rollback;")"
[ "$ADMIN" = "2" ] || fail "authenticated admin must see both meta rows"
assert_raises "delete from public.prism_snapshot where id='$ANCHOR_ID';" "violates foreign key constraint" "anchored snapshot delete restricted"
printf 'ok: write/execute blocks, admin SELECT, and FK RESTRICT\n'

say "rollback"
assert_ok "create table public.prism_0051_rollback_canary(id integer);" "rollback canary created"
$PSQL -f "$ROLLBACK"
[ "$(scalar "select count(*) from pg_class where relname in ('prism_snapshot','prism_benchmark_meta')")" = "0" ] || fail "rollback left PRISM tables"
[ "$(scalar "select count(*) from pg_proc where proname='upsert_prism_snapshot'")" = "0" ] || fail "rollback left PRISM RPC"
[ "$(scalar "select count(*) from pg_class where relname='prism_0051_rollback_canary'")" = "1" ] || fail "rollback touched unrelated object"
printf 'ok: rollback removes only 0051 artifacts\n'

printf '\nPG0051 PRISM SMOKE PASS\n'
