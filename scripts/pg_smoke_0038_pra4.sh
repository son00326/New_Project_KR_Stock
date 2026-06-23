#!/usr/bin/env bash
# pg_smoke_0038_pra4.sh — docker-free local PG16 smoke for Track 1 PR-A4 reconcile.
#   Proves the gap-SQL ↔ classifier contract end-to-end: apply 0038 + stub tier1_selection_run +
#   seed complete/partial/missing finalized periods via the RPC → run shadow_arm_reconcile's OWN
#   --print-sql gap query (wrapped in json_agg) → feed back to its --coverage-json classifier → assert.
#   This closes the contract the pure unit tests cannot prove against real SQL (PR-B4 prb4 pattern).
#
# report-only: reconcile writes NOTHING (owner/service-role READ + pure classify). No production touch.
# Usage: bash scripts/pg_smoke_0038_pra4.sh   (PG 16; psql/createdb/dropdb on PATH; python3)
set -euo pipefail

DB="tier0_0038_pra4_smoke_$$"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="${HERE}/../tudal/supabase/migrations/0038_shadow_arm_log.sql"
RECONCILE="${HERE}/shadow_arm_reconcile.py"
WORK="$(mktemp -d)"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

PSQL="psql -v ON_ERROR_STOP=1 -X -q -d $DB"
say() { printf '\n=== %s ===\n' "$1"; }
fail() { printf 'PRA4 SMOKE FAIL: %s\n' "$1" >&2; exit 1; }
PYBIN="$(command -v python3)"

[ -f "$MIG" ] || fail "migration not found: $MIG"
[ -f "$RECONCILE" ] || fail "reconcile not found: $RECONCILE"

say "createdb $DB + bootstrap + apply 0038"
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
-- minimal tier1_selection_run stub (0031): the finalize signal the gap SQL joins on.
create table if not exists public.tier1_selection_run (
  period_key text primary key,
  track text not null,
  finalized_at timestamptz
);
SQL
$PSQL -f "$WORK/bootstrap.sql"
$PSQL -f "$MIG"
echo "ok: 0038 + tier1_selection_run stub applied"

# seed a finalized period + N arms via the RPC. arm names cycle the 4 canonical arms.
ARMS=(production-snapshot sector-soft-reserve regime-sector-soft-reserve candidate-pool-hard-gate)
SEL='[{"ticker":"000001","assigned_timeframe":"short"},{"ticker":"000002","assigned_timeframe":"short"},{"ticker":"000003","assigned_timeframe":"short"},{"ticker":"000004","assigned_timeframe":"short"},{"ticker":"000005","assigned_timeframe":"short"},{"ticker":"000006","assigned_timeframe":"short"},{"ticker":"000007","assigned_timeframe":"short"},{"ticker":"000008","assigned_timeframe":"short"},{"ticker":"000009","assigned_timeframe":"short"},{"ticker":"000010","assigned_timeframe":"short"}]'
seed_period() {
  local period="$1" narms="$2"
  $PSQL -c "insert into public.tier1_selection_run(period_key,track,finalized_at) values ('$period','short',now());"
  for ((i=0; i<narms; i++)); do
    local arm="${ARMS[$i]}"
    $PSQL -t -c "select public.upsert_shadow_arm_log('{\"month\":\"2026-06\",\"period_key\":\"$period\",\"track\":\"short\",\"arm\":\"$arm\",\"run_id\":\"r\",\"status\":\"logged\",\"selected\":$SEL}'::jsonb);" >/dev/null
  done
}

# A4: seed a finalized period with all 4 arms present but the hard-gate arm status='incomplete_run'
#   (the realistic PR-A1 underfill / §6.5 degradation-drop state). production-snapshot + soft + regime
#   logged; hard-gate incomplete_run (RPC-allowed for non-production arms; selected=[] skips count check).
#   Expect: still 'complete' (incomplete_run = consumable §2.2 terminal, NOT a gap) with logged_arm_count=3.
seed_incomplete_hardgate() {
  local period="$1"
  $PSQL -c "insert into public.tier1_selection_run(period_key,track,finalized_at) values ('$period','short',now());"
  for arm in production-snapshot sector-soft-reserve regime-sector-soft-reserve; do
    $PSQL -t -c "select public.upsert_shadow_arm_log('{\"month\":\"2026-06\",\"period_key\":\"$period\",\"track\":\"short\",\"arm\":\"$arm\",\"run_id\":\"r\",\"status\":\"logged\",\"selected\":$SEL}'::jsonb);" >/dev/null
  done
  # hard-gate incomplete_run (underfill) — selected=[] (non-logged status skips count check).
  $PSQL -t -c "select public.upsert_shadow_arm_log('{\"month\":\"2026-06\",\"period_key\":\"$period\",\"track\":\"short\",\"arm\":\"candidate-pool-hard-gate\",\"run_id\":\"r\",\"status\":\"incomplete_run\",\"selected\":[]}'::jsonb);" >/dev/null
}

say "seed: complete(4)/partial(2)/missing(0)/complete-with-hardgate-incomplete_run(4 arms,3 logged)"
seed_period "s:2026-06-01" 4   # complete
seed_period "s:2026-06-08" 2   # partial
seed_period "s:2026-06-15" 0   # missing (finalized, no shadow rows)
seed_incomplete_hardgate "s:2026-06-22"  # complete (4 arms, hard-gate incomplete_run → logged_arm_count=3)
echo "ok: seeded 4 finalized periods"

say "run reconcile gap SQL (the script's own --print-sql) → json_agg → classifier"
# capture the script's gap SQL, strip trailing ';', wrap in json_agg(row_to_json) so the classifier
# receives the EXACT rows the script's RECONCILE_GAP_SQL produces against the real schema.
GAP_SQL="$("$PYBIN" "$RECONCILE" --print-sql | sed 's/;[[:space:]]*$//')"
$PSQL -t -A -c "select coalesce(json_agg(row_to_json(t)),'[]'::json) from ( $GAP_SQL ) t;" > "$WORK/coverage.json"
[ -s "$WORK/coverage.json" ] || fail "gap SQL produced empty output"

# classify (exit 1 expected: partial present → stage-1 blocking).
set +e
REPORT="$("$PYBIN" "$RECONCILE" --coverage-json "$WORK/coverage.json")"
CODE=$?
set -e
echo "$REPORT"
[ "$CODE" = "1" ] || fail "expected exit 1 (partial present), got $CODE"

# assert per-period classification.
chk_status() {
  local period="$1" expect="$2"
  local got
  got="$(echo "$REPORT" | "$PYBIN" -c "import sys,json;d=json.load(sys.stdin);print(next(r['status'] for r in d['rows'] if r['period_key']==sys.argv[1]))" "$period")"
  [ "$got" = "$expect" ] || fail "period $period: expected $expect, got $got"
  echo "ok: $period -> $expect"
}
chk_status "s:2026-06-01" complete
chk_status "s:2026-06-08" partial
chk_status "s:2026-06-15" missing
chk_status "s:2026-06-22" complete

# A4: hard-gate incomplete_run period classifies 'complete' with logged_arm_count=3 (NOT blocking) —
#   proves §2.2/§6.5 (incomplete_run = consumable terminal state, surfaced for PR-A5 via logged_arm_count).
echo "$REPORT" | "$PYBIN" -c "
import sys,json
d=json.load(sys.stdin)
r=next(x for x in d['rows'] if x['period_key']=='s:2026-06-22')
assert r['status']=='complete', r
assert r['arm_count']==4 and r['logged_arm_count']==3, r
print('ok: hard-gate incomplete_run -> complete, logged_arm_count=3 (A4)')
"

# summary counts.
echo "$REPORT" | "$PYBIN" -c "
import sys,json
d=json.load(sys.stdin)
c=d['summary']['counts']
assert c=={'complete':2,'partial':1,'missing':1,'anomaly':0}, c
assert d['summary']['total_finalized_periods']==4
assert len(d['summary']['stage1_blocked_periods'])==2  # partial + missing (anomaly 0)
print('ok: summary counts + stage1_blocked')
"

# non-finalized period must NOT appear (gap SQL filters finalized_at not null).
say "non-finalized period excluded"
$PSQL -c "insert into public.tier1_selection_run(period_key,track,finalized_at) values ('s:2026-05-25','short',null);" >/dev/null
GAP2="$($PSQL -t -A -c "select coalesce(json_agg(row_to_json(t)),'[]'::json) from ( $GAP_SQL ) t;")"
echo "$GAP2" | "$PYBIN" -c "import sys,json;d=json.load(sys.stdin);assert not any(r['period_key']=='s:2026-05-25' for r in d),'non-finalized leaked';print('ok: non-finalized excluded')"

printf '\nPRA4 SMOKE PASS\n'
