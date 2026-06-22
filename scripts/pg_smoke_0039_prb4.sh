#!/usr/bin/env bash
# pg_smoke_0039_prb4.sh — CLAUDE-runnable connection-verification: PR-B4 reconcile gap SQL + classifier.
#
# WHAT THIS PROVES (end-to-end, local throwaway temp DB):
#   The REAL PR-B4 gap-detection query (shadow_reconcile.RECONCILE_GAP_SQL, MATERIALIZED CTE) run on a
#   DB with the APPLIED migration-0039 shadow tables + a seeded PR-B1→PR-B3→0039 mirror run produces the
#   RAW per-period coverage facts that the REAL shipped Python classifier (shadow_reconcile.build_reconcile_report)
#   turns into the correct report: a production month WITHOUT a mirror run = 'missing', a month WITH a
#   complete (150/1-run/all-logged) mirror run = 'complete', and a corrupted partial mirror = 'anomaly'.
#   Also proves the date_trunc normalization (production tier0_candidates_150.month has NO day=1 CHECK, 0028).
#   This closes the PR-B4 gap-SQL ↔ classifier contract that the pure unit tests cannot prove against real SQL.
#
# WHAT THIS DOES NOT PROVE (USER-only, real Supabase — see pg_smoke_0039.sh epilogue B1/B2/B3):
#   real service_role SELECT denial / RPC owner=postgres / default-privilege non-re-grant. PR-B4 adds none.
#   PR-B4 production reconcile runs are USER-only (owner psql connection = external state, T2-I-6); this
#   local smoke is the CLAUDE-verifiable surface for the query form + classifier.
#   No production touch, no Supabase apply, no network (Python fixture is pure; psql = local socket).
#
# Usage: bash scripts/pg_smoke_0039_prb4.sh   (PG 16; psql/createdb/dropdb on PATH)
set -euo pipefail

DB="tier0_0039_prb4_smoke"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="${HERE}/../tudal/supabase/migrations/0039_tier0_candidates_150_shadow.sql"
FIXTURE="${HERE}/_prb3_smoke_fixture.py"
RECONCILE="${HERE}/shadow_reconcile.py"
WORK="$(mktemp -d)"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

PSQL="psql -v ON_ERROR_STOP=1 -X -q -d $DB"
say() { printf '\n=== %s ===\n' "$1"; }
fail() { printf 'PRB4 SMOKE FAIL: %s\n' "$1" >&2; exit 1; }
PYBIN="$(command -v python3)"

[ -f "$MIG" ] || fail "migration not found: $MIG"
[ -f "$FIXTURE" ] || fail "fixture not found: $FIXTURE"
[ -f "$RECONCILE" ] || fail "reconcile script not found: $RECONCILE"

say "createdb $DB + bootstrap + apply 0039 + production stub"
dropdb --if-exists "$DB" >/dev/null 2>&1 || true
createdb "$DB"
cat > "$WORK/bootstrap.sql" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('smoke.uid', true),'')::uuid $f$;
create or replace function auth.role() returns text language sql stable as
  $f$ select coalesce(nullif(current_setting('smoke.role', true),''), 'service_role') $f$;
create or replace function public.is_admin() returns boolean language sql stable as
  $f$ select coalesce(nullif(current_setting('smoke.is_admin', true),'')::boolean, false) $f$;
SQL
$PSQL -f "$WORK/bootstrap.sql" >/dev/null
$PSQL -f "$MIG" >/dev/null

# Minimal production-presence stub (gap SQL reads ONLY tier0_candidates_150.month). The 2026-05 row is
# inserted MID-month (2026-05-15) to prove the date_trunc('month',month) normalization (0028 has no day=1 CHECK).
cat > "$WORK/prod.sql" <<'SQL'
create table if not exists public.tier0_candidates_150 (
  month date not null, ticker text not null, bucket text not null, rank int not null
);
insert into public.tier0_candidates_150 (month, ticker, bucket, rank) values
  ('2026-05-15','005930','short',1), ('2026-05-15','000660','mid',1),   -- 2026-05 (mid-month → tests date_trunc)
  ('2026-06-01','005930','short',1), ('2026-06-01','000660','mid',1);   -- 2026-06
SQL
$PSQL -f "$WORK/prod.sql" >/dev/null
echo "ok: 0039 applied + production stub seeded (2026-05 mid-month, 2026-06)"

rpc() { # $1=fn  $2=json_file
  { printf 'select public.%s($jq$' "$1"; cat "$2"; printf '$jq$::jsonb);\n'; } > "$WORK/_rpc.sql"
  $PSQL -t -A -f "$WORK/_rpc.sql"
}

# ---------------------------------------------------------------------------
# 1. Seed shadow coverage for 2026-06 ONLY (leave 2026-05 with NO shadow run).
#    register absent hypothesis → finalize mirror-only via the PR-B1→PR-B3→0039 path.
# ---------------------------------------------------------------------------
say "seed shadow: 2026-06 mirror-only complete run (2026-05 left missing)"
"$PYBIN" "$FIXTURE" hypothesis > "$WORK/hyp.json"
HID="$(rpc register_shadow_hypothesis "$WORK/hyp.json" | "$PYBIN" -c 'import sys,json; print(json.loads(sys.stdin.read())["id"])')"
[ -n "$HID" ] || fail "register returned no id"
SMOKE_HYPOTHESIS_ID="$HID" SMOKE_ARMS="production-mirror" SMOKE_RUN_ID="prb4-jun" \
  "$PYBIN" "$FIXTURE" payload > "$WORK/mirror.json"
OUT="$(rpc upsert_tier0_shadow_run "$WORK/mirror.json")"
echo "$OUT" | "$PYBIN" -c 'import sys,json; d=json.loads(sys.stdin.read()); assert d["candidates"]==150, d' \
  || fail "seed finalize did not write 150 mirror candidates: $OUT"
echo "ok: 2026-06 mirror run seeded (run_id=prb4-jun, 150 candidates)"

# ---------------------------------------------------------------------------
# 2. Run the SHIPPED gap SQL (--print-sql-inline) wrapped in json_agg → feed the SHIPPED classifier.
#    Asserts: 2026-05 = missing (date_trunc normalized period_key '2026-05'), 2026-06 = complete.
# ---------------------------------------------------------------------------
say "reconcile: real gap SQL → real classifier → report (missing + complete)"
SQL_INLINE="$("$PYBIN" "$RECONCILE" --print-sql-inline)"
$PSQL -t -A -c "select coalesce(json_agg(t), '[]') from ( $SQL_INLINE ) t" > "$WORK/coverage.json"
"$PYBIN" "$RECONCILE" --coverage-json "$WORK/coverage.json" > "$WORK/report.json"
"$PYBIN" - "$WORK/coverage.json" "$WORK/report.json" <<'PY' || fail "reconcile report (missing+complete) wrong"
import json, sys
cov = {r["period_key"]: r for r in json.load(open(sys.argv[1]))}      # raw gap-SQL facts
rep = json.load(open(sys.argv[2]))
# real SQL emitted the snapshot facts the classifier needs (not just candidates):
assert cov["2026-06"]["snapshot_distinct_tickers"] == 200, cov["2026-06"]
assert cov["2026-06"]["snapshot_universe_size"] == 200, cov["2026-06"]
assert cov["2026-06"]["snapshot_universe_size_min"] == 200, cov["2026-06"]   # uniform universe_size
assert cov["2026-06"]["mirror_universe_size"] == 200, cov["2026-06"]
assert cov["2026-06"]["mirror_universe_hash_count"] == 1, cov["2026-06"]
assert cov["2026-06"]["snapshot_universe_hash_count"] == 1, cov["2026-06"]
assert cov["2026-06"]["mirror_universe_hash"], cov["2026-06"]
assert cov["2026-06"]["mirror_universe_hash"] == cov["2026-06"]["snapshot_universe_hash"], cov["2026-06"]
by = {p["period_key"]: p for p in rep["periods"]}
assert rep["summary"] == {"total": 2, "complete": 1, "missing": 1, "anomaly": 0}, rep["summary"]
assert set(by) == {"2026-05", "2026-06"}, sorted(by)
assert by["2026-05"]["status"] == "missing", by["2026-05"]
assert by["2026-05"]["month"] == "2026-05-01", by["2026-05"]   # date_trunc normalized mid-month
assert by["2026-06"]["status"] == "complete", by["2026-06"]
assert by["2026-06"]["mirror_run_id"] == "prb4-jun", by["2026-06"]
assert by["2026-05"]["remediation"] and "UNBACKFILLABLE" in by["2026-05"]["remediation"], by["2026-05"]
print("ok")
PY
echo "ok: 2026-05 missing + 2026-06 complete (candidates 150 + snapshot 200==universe_size, real SQL facts)"

say "reconcile: snapshot universe_hash tampered → anomaly (same universe identity)"
$PSQL -c "update public.tier0_shadow_universe_snapshot
          set universe_hash='prb4-tampered-hash'
          where run_id='prb4-jun'
            and ticker = (select ticker from public.tier0_shadow_universe_snapshot
                          where run_id='prb4-jun' order by ticker limit 1);" >/dev/null
$PSQL -t -A -c "select coalesce(json_agg(t), '[]') from ( $SQL_INLINE ) t" > "$WORK/coverage_hash.json"
"$PYBIN" "$RECONCILE" --coverage-json "$WORK/coverage_hash.json" > "$WORK/report_hash.json"
"$PYBIN" - "$WORK/report_hash.json" <<'PY' || fail "reconcile report (hash anomaly) wrong"
import json, sys
rep = json.load(open(sys.argv[1]))
by = {p["period_key"]: p for p in rep["periods"]}
assert rep["summary"] == {"total": 2, "complete": 0, "missing": 1, "anomaly": 1}, rep["summary"]
assert by["2026-06"]["status"] == "anomaly", by["2026-06"]
assert "universe_hash mismatch/non-uniform" in by["2026-06"]["reason"], by["2026-06"]
print("ok")
PY
OUT="$(rpc upsert_tier0_shadow_run "$WORK/mirror.json")"
echo "$OUT" | "$PYBIN" -c 'import sys,json; d=json.loads(sys.stdin.read()); assert d["candidates"]==150, d' \
  || fail "hash-tamper reset did not restore 150 mirror candidates: $OUT"
echo "ok: universe_hash tampering caught as anomaly, then mirror run reset for remaining checks"

# ---------------------------------------------------------------------------
# 3. SNAPSHOT-TAMPER ANOMALY (MED#1): candidates stay 150 but the universe snapshot PR-B5 needs is
#    corrupted (one ticker's rows deleted → distinct < universe_size) → 'anomaly', NOT silent 'complete'.
# ---------------------------------------------------------------------------
say "reconcile: candidates complete but snapshot tampered → anomaly (PR-B5 denominator integrity)"
$PSQL -c "delete from public.tier0_shadow_universe_snapshot
          where run_id='prb4-jun'
            and ticker = (select ticker from public.tier0_shadow_universe_snapshot
                          where run_id='prb4-jun' order by ticker limit 1);" >/dev/null
$PSQL -t -A -c "select coalesce(json_agg(t), '[]') from ( $SQL_INLINE ) t" > "$WORK/coverage_snap.json"
"$PYBIN" "$RECONCILE" --coverage-json "$WORK/coverage_snap.json" > "$WORK/report_snap.json"
"$PYBIN" - "$WORK/report_snap.json" <<'PY' || fail "reconcile report (snapshot anomaly) wrong"
import json, sys
rep = json.load(open(sys.argv[1]))
by = {p["period_key"]: p for p in rep["periods"]}
assert by["2026-06"]["status"] == "anomaly", by["2026-06"]
assert "snapshot incomplete" in by["2026-06"]["reason"], by["2026-06"]
assert "candidates not 150" not in by["2026-06"]["reason"], by["2026-06"]   # candidates still 150
print("ok")
PY
echo "ok: snapshot tampering caught as anomaly (candidates 150, snapshot 199 < universe_size 200)"

# ---------------------------------------------------------------------------
# 4. CANDIDATE-TAMPER ANOMALY: owner-level corruption (delete one mirror candidate → 149) detected too.
#    (Only the migration applier/owner can DML shadow tables — service_role/authenticated cannot, T2-I-6.)
# ---------------------------------------------------------------------------
say "reconcile: corrupted partial mirror (149) → anomaly (integrity catch)"
$PSQL -c "delete from public.tier0_candidates_150_shadow
          where period_key='2026-06' and arm='production-mirror' and bucket='short' and rank=50;" >/dev/null
$PSQL -t -A -c "select coalesce(json_agg(t), '[]') from ( $SQL_INLINE ) t" > "$WORK/coverage2.json"
"$PYBIN" "$RECONCILE" --coverage-json "$WORK/coverage2.json" > "$WORK/report2.json"
"$PYBIN" - "$WORK/report2.json" <<'PY' || fail "reconcile report (anomaly) wrong"
import json, sys
rep = json.load(open(sys.argv[1]))
assert rep["summary"] == {"total": 2, "complete": 0, "missing": 1, "anomaly": 1}, rep["summary"]
by = {p["period_key"]: p for p in rep["periods"]}
assert by["2026-06"]["status"] == "anomaly", by["2026-06"]
assert "149" in by["2026-06"]["reason"], by["2026-06"]
print("ok")
PY
echo "ok: corrupted mirror flagged 'anomaly' (149 != 150) — not silently complete"

# ---------------------------------------------------------------------------
say "PRB4 CONNECTION SMOKE PASS"
echo "USER-only (NOT executed here; see pg_smoke_0039.sh epilogue B1/B2/B3):"
echo "  - real service_role SELECT denial on shadow tables / RPC owner=postgres / default-priv non-re-grant."
echo "  - production reconcile runs use a real OWNER psql connection (external state, USER-only)."
echo "PR-B4 adds NO migration and NO new grant; it only READS via owner connection + classifies in pure Python."
