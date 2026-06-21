#!/usr/bin/env bash
# pg_smoke_0039_prb3.sh — CLAUDE-runnable connection-verification: PR-B3 payload → applied-0039 RPC.
#
# WHAT THIS PROVES (end-to-end, local throwaway temp DB):
#   The REAL Track 2 finalize payload built by the production code path
#     PR-B1 shadow_gen_core.compute_shadow_selections → PR-B3 shadow_gen_runner builders
#   is ACCEPTED by the APPLIED migration-0039 upsert_tier0_shadow_run RPC (register → finalize),
#   with the expected snapshot/candidate/arm counts; and the RPC's guards reject deliberately
#   malformed-but-builder-shaped payloads (production_mirror_required_for_paired_run).
#   This closes the PR-B3 ↔ PR-B2 contract that the mocked unit tests cannot prove against real SQL.
#
# WHAT THIS DOES NOT PROVE (USER-only, real Supabase — see pg_smoke_0039.sh epilogue B1/B2/B3):
#   real service_role SELECT denial / RPC owner=postgres / default-privilege non-re-grant.
#   No production touch, no Supabase apply, no network (Python fixture is pure; psql = local socket).
#
# Usage: bash scripts/pg_smoke_0039_prb3.sh   (PG 16; psql/createdb/dropdb on PATH)
set -euo pipefail

DB="tier0_0039_prb3_smoke"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="${HERE}/../tudal/supabase/migrations/0039_tier0_candidates_150_shadow.sql"
FIXTURE="${HERE}/_prb3_smoke_fixture.py"
WORK="$(mktemp -d)"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

PSQL="psql -v ON_ERROR_STOP=1 -X -q -d $DB"
say() { printf '\n=== %s ===\n' "$1"; }
fail() { printf 'PRB3 SMOKE FAIL: %s\n' "$1" >&2; exit 1; }
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
echo "ok: 0039 applied to temp DB"

# helper: call an RPC with a JSON payload file, echo the returned jsonb. JSON is inlined as a
#   dollar-quoted literal ($jq$...$jq$) — robust to embedded double-quotes/UTF-8, no psql var interpolation.
rpc() { # $1=fn  $2=json_file
  { printf 'select public.%s($jq$' "$1"; cat "$2"; printf '$jq$::jsonb);\n'; } > "$WORK/_rpc.sql"
  $PSQL -t -A -f "$WORK/_rpc.sql"
}
# helper: assert RPC call RAISES with message containing $3.
rpc_raises() { # $1=fn $2=json_file $3=needle $4=label
  { printf 'select public.%s($jq$' "$1"; cat "$2"; printf '$jq$::jsonb);\n'; } > "$WORK/_rpcr.sql"
  local out
  out="$($PSQL -t -A -f "$WORK/_rpcr.sql" 2>&1)" && fail "$4 expected error '$3' but call succeeded: $out"
  echo "$out" | grep -q "$3" || fail "$4 expected '$3' but: $out"
  echo "ok: $4 -> $3"
}

# ---------------------------------------------------------------------------
# 1. register absent hypothesis (PR-B3 fixture builds it) → capture id.
# ---------------------------------------------------------------------------
say "register absent hypothesis (PR-B3 build_absent_hypothesis)"
"$PYBIN" "$FIXTURE" hypothesis > "$WORK/hyp.json"
HID="$(rpc register_shadow_hypothesis "$WORK/hyp.json" | "$PYBIN" -c 'import sys,json; print(json.loads(sys.stdin.read())["id"])')"
[ -n "$HID" ] || fail "register returned no id"
echo "ok: absent hypothesis registered id=$HID"

# ---------------------------------------------------------------------------
# 2. HAPPY: mirror-only finalize → snapshot=600 / candidates=150 / arms=1.
# ---------------------------------------------------------------------------
say "happy finalize: mirror-only (PR-B1→PR-B3→applied-0039 RPC)"
SMOKE_HYPOTHESIS_ID="$HID" SMOKE_ARMS="production-mirror" SMOKE_RUN_ID="prb3-mirror" \
  "$PYBIN" "$FIXTURE" payload > "$WORK/mirror.json"
OUT="$(rpc upsert_tier0_shadow_run "$WORK/mirror.json")"
echo "   RPC returned: $OUT"
echo "$OUT" | "$PYBIN" -c '
import sys,json
d=json.loads(sys.stdin.read())
assert d["arms"]==1, d
assert d["candidates"]==150, d
assert d["snapshot"]==600, d
print("ok: mirror-only arms=1 candidates=150 snapshot=600")
'
CN=$($PSQL -t -A -c "select count(*) from tier0_candidates_150_shadow where period_key='2026-06' and run_id='prb3-mirror';")
[ "$CN" = "150" ] || fail "candidate rows expected 150, got $CN"
SD=$($PSQL -t -A -c "select count(distinct ticker) from tier0_shadow_universe_snapshot where run_id='prb3-mirror';")
[ "$SD" = "200" ] || fail "snapshot distinct ticker expected 200(=universe_size), got $SD"
echo "ok: DB rows — candidates=150 / snapshot distinct ticker=200"

# ---------------------------------------------------------------------------
# 3. HAPPY: mirror+soft-tilt → candidates=300 / arms=2 (paired).
# ---------------------------------------------------------------------------
say "happy finalize: mirror + sector-soft-tilt (paired)"
SMOKE_HYPOTHESIS_ID="$HID" SMOKE_ARMS="production-mirror,sector-soft-tilt" SMOKE_RUN_ID="prb3-paired" \
  "$PYBIN" "$FIXTURE" payload > "$WORK/paired.json"
OUT2="$(rpc upsert_tier0_shadow_run "$WORK/paired.json")"
echo "   RPC returned: $OUT2"
echo "$OUT2" | "$PYBIN" -c '
import sys,json
d=json.loads(sys.stdin.read())
assert d["arms"]==2, d
assert d["candidates"]==300, d
print("ok: paired arms=2 candidates=300")
'
ARMS=$($PSQL -t -A -c "select string_agg(distinct arm,',' order by arm) from tier0_candidates_150_shadow where run_id='prb3-paired';")
[ "$ARMS" = "production-mirror,sector-soft-tilt" ] || fail "expected mirror+soft arms, got $ARMS"
echo "ok: DB arms = $ARMS"

# ---------------------------------------------------------------------------
# 4. HAPPY: mirror+hard-gate underfill → hard-gate incomplete_run metadata accepted.
# ---------------------------------------------------------------------------
say "happy finalize: mirror + sector-hard-gate underfill (incomplete_run)"
"$PYBIN" "$FIXTURE" hypothesis_manual_underfill > "$WORK/manual_underfill_hyp.json"
MAN_HID="$(rpc register_shadow_hypothesis "$WORK/manual_underfill_hyp.json" | "$PYBIN" -c 'import sys,json; print(json.loads(sys.stdin.read())["id"])')"
[ -n "$MAN_HID" ] || fail "manual underfill register returned no id"
SMOKE_HYPOTHESIS_ID="$MAN_HID" SMOKE_MODE="hardgate_underfill" SMOKE_ARMS="sector-hard-gate" SMOKE_RUN_ID="prb3-hard-underfill" \
  "$PYBIN" "$FIXTURE" payload > "$WORK/hard_underfill.json"
OUT3="$(rpc upsert_tier0_shadow_run "$WORK/hard_underfill.json")"
echo "   RPC returned: $OUT3"
echo "$OUT3" | "$PYBIN" -c '
import sys,json
d=json.loads(sys.stdin.read())
assert d["arms"]==2, d
assert d["candidates"]==150, d
assert d["snapshot"]==600, d
print("ok: hard-gate underfill arms=2 candidates=150 snapshot=600")
'

# ---------------------------------------------------------------------------
# 5. NEGATIVE: builder-shaped payload with mirror stripped → RPC rejects (paired guard).
# ---------------------------------------------------------------------------
say "negative: non-mirror arm without production-mirror → production_mirror_required_for_paired_run"
SMOKE_HYPOTHESIS_ID="$HID" SMOKE_DROP_MIRROR="1" SMOKE_RUN_ID="prb3-nomirror" \
  "$PYBIN" "$FIXTURE" payload > "$WORK/nomirror.json"
rpc_raises upsert_tier0_shadow_run "$WORK/nomirror.json" "production_mirror_required_for_paired_run" \
  "drop-mirror payload"

# ---------------------------------------------------------------------------
# 6. idempotent re-finalize (same period/run) → still 150, no duplication.
# ---------------------------------------------------------------------------
say "idempotent re-finalize (mirror-only, same run)"
rpc upsert_tier0_shadow_run "$WORK/mirror.json" >/dev/null
CN2=$($PSQL -t -A -c "select count(*) from tier0_candidates_150_shadow where period_key='2026-06' and arm='production-mirror';")
[ "$CN2" = "150" ] || fail "idempotent re-finalize duplicated candidates ($CN2)"
echo "ok: idempotent re-finalize (150, no dup)"

say "PRB3 CONNECTION SMOKE PASS"
echo "  proved: PR-B1 generator → PR-B3 envelope builders → applied-0039 upsert_tier0_shadow_run RPC (end-to-end)."
echo "  USER-only real-Supabase checks (B1/B2/B3) remain in pg_smoke_0039.sh epilogue."
