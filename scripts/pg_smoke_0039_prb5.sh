#!/usr/bin/env bash
# pg_smoke_0039_prb5.sh — CLAUDE-runnable connection-verification: PR-B5 Query 2 (shadow-run extract).
#
# WHAT THIS PROVES (end-to-end, local throwaway temp DB):
#   The REAL PR-B5 owner-psql Query 2 (shadow_eval.SHADOW_RUN_EXTRACT_SQL, MATERIALIZED CTE, emitted by
#   `validate_tier0_ic.py --print-shadow-sql-inline`) run on a DB with the APPLIED migration-0039 shadow
#   tables + a seeded multi-arm (production-mirror + sector-soft-tilt) PR-B1→PR-B3→0039 complete run
#   returns the per-period facts the evaluator consumes, with the FIX-J (period_key, run_id) anchor
#   (run_id_count==1), per-arm 150 candidates, snapshot distinct == universe_size, cross-arm universe_hash
#   uniform. Closes the PR-B5 Query-2 ↔ 0039-RPC contract that the pure unit tests cannot prove vs real SQL.
#
# WHAT THIS DOES NOT PROVE (USER-only, real Supabase — see pg_smoke_0039.sh epilogue B1/B2/B3):
#   The PR-B5 evaluator RUNTIME writes no DB; production extraction runs are USER-only (owner psql).
#
# Usage: bash scripts/pg_smoke_0039_prb5.sh   (PG 16; psql/createdb/dropdb on PATH)
set -euo pipefail

DB="tier0_0039_prb5_smoke"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="${HERE}/../tudal/supabase/migrations/0039_tier0_candidates_150_shadow.sql"
FIXTURE="${HERE}/_prb3_smoke_fixture.py"
WORK="$(mktemp -d)"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

PSQL="psql -v ON_ERROR_STOP=1 -X -q -d $DB"
say() { printf '\n=== %s ===\n' "$1"; }
fail() { printf 'PRB5 SMOKE FAIL: %s\n' "$1" >&2; exit 1; }
PYBIN="$(command -v python3)"

[ -f "$MIG" ] || fail "migration not found: $MIG"
[ -f "$FIXTURE" ] || fail "fixture not found: $FIXTURE"

say "createdb $DB + bootstrap + apply 0039"
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
echo "ok: 0039 applied"

say "local service_role shadow SELECT denied"
DB_USER="$($PSQL -t -A -c "select current_user")"
$PSQL -c "grant service_role to \"$DB_USER\";" >/dev/null
if $PSQL -v ON_ERROR_STOP=1 -c "set role service_role; select count(*) from public.tier0_candidates_150_shadow;" \
  >"$WORK/service_role_select.out" 2>"$WORK/service_role_select.err"; then
  fail "service_role SELECT unexpectedly succeeded on tier0_candidates_150_shadow"
fi
grep -Eiq "permission denied|insufficient privilege" "$WORK/service_role_select.err" \
  || fail "service_role SELECT failed for unexpected reason: $(cat "$WORK/service_role_select.err")"
echo "ok: local service_role role has no SELECT on shadow tables"

rpc() { # $1=fn  $2=json_file
  { printf 'select public.%s($jq$' "$1"; cat "$2"; printf '$jq$::jsonb);\n'; } > "$WORK/_rpc.sql"
  $PSQL -t -A -f "$WORK/_rpc.sql"
}

# ---------------------------------------------------------------------------
# 1. Seed a MULTI-ARM complete run (production-mirror + sector-soft-tilt) for 2026-06 via the 0039 RPC.
# ---------------------------------------------------------------------------
say "seed: 2026-06 multi-arm complete run (mirror + soft-tilt, run_id=prb5)"
"$PYBIN" "$FIXTURE" hypothesis > "$WORK/hyp.json"
HID="$(rpc register_shadow_hypothesis "$WORK/hyp.json" | "$PYBIN" -c 'import sys,json; print(json.loads(sys.stdin.read())["id"])')"
[ -n "$HID" ] || fail "register returned no id"
SMOKE_HYPOTHESIS_ID="$HID" SMOKE_ARMS="production-mirror,sector-soft-tilt" SMOKE_RUN_ID="prb5" \
  "$PYBIN" "$FIXTURE" payload > "$WORK/run.json"
OUT="$(rpc upsert_tier0_shadow_run "$WORK/run.json")"
echo "$OUT" | "$PYBIN" -c 'import sys,json; d=json.loads(sys.stdin.read()); assert d["arms"]==2 and d["candidates"]==300, d' \
  || fail "seed finalize wrong (expected arms=2, candidates=300): $OUT"
echo "ok: 2 arms × 150 candidates seeded (run_id=prb5)"

# ---------------------------------------------------------------------------
# 2. Run the SHIPPED PR-B5 Query 2 (--print-shadow-sql-inline) for period 2026-06 on the OWNER conn,
#    wrapped to return the json_build_object. $1 substituted to '2026-06'.
# ---------------------------------------------------------------------------
say "PR-B5 Query 2 on owner conn → FIX-J facts"
Q2="$("$PYBIN" "$HERE/validate_tier0_ic.py" --start-month 2026-06-01 --end-month 2026-06-01 --print-shadow-sql-inline)"
Q2_SUB="${Q2//\$1/'2026-06'}"
$PSQL -t -A -c "$Q2_SUB" > "$WORK/q2.json"
"$PYBIN" - "$WORK/q2.json" <<'PY' || fail "Query 2 facts wrong"
import json, sys
d = json.load(open(sys.argv[1]))
assert d["period_key"] == "2026-06", d
assert d["run_id"] == "prb5", d
assert d["run_id_count"] == 1, d                          # FIX-J: single run anchored from mirror
arms = {c["arm"] for c in d["candidates"]}
assert arms == {"production-mirror", "sector-soft-tilt"}, arms
for arm in arms:
    n = len({c["ticker"] for c in d["candidates"] if c["arm"] == arm})
    assert n == 150, (arm, n)                              # per-arm 150 candidates
snap_tickers = {s["ticker"] for s in d["snapshot"]}
usize = d["candidates"][0]["universe_size"]
assert len(snap_tickers) == usize, (len(snap_tickers), usize)   # snapshot distinct == universe_size
hashes = {c["universe_hash"] for c in d["candidates"]} | {s["universe_hash"] for s in d["snapshot"]}
assert len(hashes) == 1, hashes                            # cross-arm + snapshot universe_hash uniform
assert d["hypothesis"][0]["source"] in ("absent", "manual_pre_registered"), d["hypothesis"]
print("ok")
PY
echo "ok: Query 2 = FIX-J run_id_count==1 · 2×150 candidates · snapshot distinct==universe_size · uniform hash"

# ---------------------------------------------------------------------------
say "PRB5 CONNECTION SMOKE PASS"
echo "USER-only (NOT executed here; see pg_smoke_0039.sh epilogue B1/B2/B3):"
echo "  - real Supabase service_role-key denial semantics / RPC owner=postgres."
echo "  - the PR-B5 evaluator RUNTIME writes no DB; production Query-2 extraction is a USER owner-psql run."
echo "PR-B5 adds NO migration and NO grant; it READS via owner connection + evaluates in pure Python."
