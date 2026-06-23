#!/usr/bin/env bash
# pg_smoke_0038_pra5.sh — docker-free local PG16 connection smoke for Track 1 PR-A5 evaluator.
#
# WHAT THIS PROVES (end-to-end, local throwaway temp DB):
#   The SHIPPED PR-A5 extract SQL (shadow_arm_eval.SHADOW_ARM_EXTRACT_SQL, MATERIALIZED CTE, emitted by
#   `validate_tier0_ic.py --print-shadow-arm-sql-inline`) run on a DB with the APPLIED migration-0038
#   shadow_arm_log + a seeded 4-arm complete period (via the real upsert_shadow_arm_log RPC) returns the
#   per-arm facts the evaluator consumes; then shadow_arm_eval.parse_shadow_arm_extract → harvest →
#   aggregate on a SYNTHETIC in-Python panel produces a structurally-correct (no_apply) verdict. Closes the
#   0038-RPC ↔ extract-SQL ↔ Python-parser ↔ evaluator contract the pure unit tests cannot prove vs real SQL.
#
# WHAT THIS DOES NOT PROVE (USER-only, real Supabase):
#   The PR-A5 evaluator RUNTIME writes no DB; production extraction is a USER owner/service-role psql run.
#   PR-A5 adds NO migration and NO grant; it READS via the 0038 service_role/owner SELECT + evaluates in pure Python.
#
# Usage: bash scripts/pg_smoke_0038_pra5.sh   (PG 16; psql/createdb/dropdb on PATH; python3)
set -euo pipefail

DB="tier0_0038_pra5_smoke_$$"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="${HERE}/../tudal/supabase/migrations/0038_shadow_arm_log.sql"
WORK="$(mktemp -d)"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

PSQL="psql -v ON_ERROR_STOP=1 -X -q -d $DB"
say() { printf '\n=== %s ===\n' "$1"; }
fail() { printf 'PRA5 SMOKE FAIL: %s\n' "$1" >&2; exit 1; }
PYBIN="${PYBIN:-$HERE/.venv/bin/python}"
[ -x "$PYBIN" ] || PYBIN="$(command -v python3)"

[ -f "$MIG" ] || fail "migration not found: $MIG"

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
SQL
$PSQL -f "$WORK/bootstrap.sql" >/dev/null
$PSQL -f "$MIG" >/dev/null
echo "ok: 0038 applied"

say "local service_role shadow SELECT allowed (Track-1 §5.2 grant) — read-only contract"
DB_USER="$($PSQL -t -A -c "select current_user")"
$PSQL -c "grant service_role to \"$DB_USER\";" >/dev/null
$PSQL -c "set role service_role; select count(*) from public.shadow_arm_log;" >/dev/null \
  || fail "service_role SELECT on shadow_arm_log unexpectedly denied (0038 grants it for Track-1 reconcile/extract)"
echo "ok: service_role SELECT granted (PR-A5 extract runs on owner OR service-role psql)"

say "negative grant matrix: anon denied + no table-level write (write only via DEFINER RPC)"
# (a) anon has no SELECT (grant absent + RESTRICTIVE deny policy).
if $PSQL -c "set role anon; select count(*) from public.shadow_arm_log;" >/dev/null 2>"$WORK/anon.err"; then
  fail "anon SELECT on shadow_arm_log unexpectedly succeeded"
fi
grep -Eiq "permission denied|insufficient privilege|policy" "$WORK/anon.err" \
  || fail "anon SELECT failed for unexpected reason: $(cat "$WORK/anon.err")"
# (b) service_role has SELECT but NO table-level INSERT (all writes go through the DEFINER RPC).
if $PSQL -c "set role service_role; insert into public.shadow_arm_log(month,period_key,track,arm,run_date,selected) values ('2026-06','s:2026-06-01','short','production-snapshot',now(),'[]'::jsonb);" \
   >/dev/null 2>"$WORK/sr_insert.err"; then
  fail "service_role table-level INSERT unexpectedly succeeded (no DML grant expected; write = RPC only)"
fi
grep -Eiq "permission denied|insufficient privilege" "$WORK/sr_insert.err" \
  || fail "service_role INSERT failed for unexpected reason: $(cat "$WORK/sr_insert.err")"
# (c) the DEFINER RPC is the only EXECUTE-granted write path (service_role has EXECUTE).
$PSQL -t -A -c "select has_function_privilege('service_role','public.upsert_shadow_arm_log(jsonb)','execute');" \
  | grep -qx 't' || fail "service_role lacks EXECUTE on the upsert_shadow_arm_log DEFINER RPC"
echo "ok: anon denied · no table-level write grant · DEFINER RPC is the sole write path"

# ---------------------------------------------------------------------------
# Seed a 4-arm COMPLETE short period (s:2026-06-01) via the real upsert_shadow_arm_log RPC.
#   selected = full SelectedRow[] (ticker/assigned_timeframe/assigned_by/weighted_score/sector) the
#   evaluator parser requires. hard-gate carries a counterfactual_cut; regime arm a regime_context.
# ---------------------------------------------------------------------------
PERIOD="s:2026-06-01"
ASOF="2026-05-25"
sel_rows() { # $1=tf  $2=base
  "$PYBIN" - "$1" "$2" <<'PY'
import json, sys
tf, base = sys.argv[1], int(sys.argv[2])
print(json.dumps([{"ticker": f"{base+i:06d}", "assigned_timeframe": tf, "assigned_by": "primary",
                   "weighted_score": 50.0 + i, "sector": "반도체"} for i in range(10)]))
PY
}
SEL_SHORT="$(sel_rows short 1)"
rpc_arm() { # $1=arm  $2=selected_json  $3=extra_json(merged)
  local payload
  payload="$("$PYBIN" - "$1" "$2" "$3" "$PERIOD" "$ASOF" <<'PY'
import json, sys
arm, sel, extra, period, asof = sys.argv[1], json.loads(sys.argv[2]), json.loads(sys.argv[3]), sys.argv[4], sys.argv[5]
p = {"month": "2026-06", "period_key": period, "track": "short", "arm": arm, "status": "logged",
     "selected": sel, "sector_view": {"source": "manual_pre_registered", "leadingSectors": ["반도체"], "asOf": asof}}
if arm == "production-snapshot":
    p["sector_view"] = {"source": "absent", "leadingSectors": []}
p.update(extra)
print(json.dumps(p, ensure_ascii=False))
PY
)"
  { printf 'select public.upsert_shadow_arm_log($jq$'; printf '%s' "$payload"; printf '$jq$::jsonb);\n'; } > "$WORK/_rpc.sql"
  $PSQL -t -A -f "$WORK/_rpc.sql" >/dev/null
}

say "seed 4-arm complete period $PERIOD via upsert_shadow_arm_log RPC"
$PSQL -c "set role service_role; select 1;" >/dev/null  # confirm role switch usable
rpc_arm production-snapshot "$SEL_SHORT" '{}'
rpc_arm sector-soft-reserve "$SEL_SHORT" '{"shadow_eval_k": 2}'
rpc_arm regime-sector-soft-reserve "$SEL_SHORT" '{"shadow_eval_k": 2, "regime_context": {"source": "manual_pre_registered", "stage": "bull", "asOf": "2026-05-25"}}'
rpc_arm candidate-pool-hard-gate "$SEL_SHORT" '{"counterfactual_cut": ["000099", "000098"]}'
CNT="$($PSQL -t -A -c "select count(*) from public.shadow_arm_log where period_key='$PERIOD';")"
[ "$CNT" = "4" ] || fail "expected 4 seeded arm rows, got $CNT"
echo "ok: 4 arms seeded"

# ---------------------------------------------------------------------------
# Run the SHIPPED PR-A5 extract SQL (--print-shadow-arm-sql-inline), $1 → the period, wrap as a 1-elem
# array, and feed it to the REAL parser + a synthetic-panel harvest+aggregate.
# ---------------------------------------------------------------------------
say "PR-A5 extract SQL on owner conn → parser → synthetic-panel evaluator"
Q="$("$PYBIN" "$HERE/validate_tier0_ic.py" --start-month 2026-06-01 --end-month 2026-06-01 --print-shadow-arm-sql-inline)"
Q_SUB="${Q//\$1/'$PERIOD'}"
# wrap the 1-row extract (single json column) into a 1-elem ARRAY of bare period objects (alias the column).
$PSQL -t -A -c "select coalesce(json_agg(s.obj), '[]'::json) from ( $Q_SUB ) s(obj);" > "$WORK/extract.json"
[ -s "$WORK/extract.json" ] || fail "extract SQL produced empty output"

PYTHONPATH="$HERE" "$PYBIN" - "$WORK/extract.json" "$PERIOD" <<'PY' || fail "PR-A5 evaluator pipeline failed on real extract"
import json, sys
import shadow_arm_eval as SAE
from validate_tier0_ic import PanelRow
from datetime import date, timedelta

arr = json.load(open(sys.argv[1]))           # [ {period_key, arms:[...]} ]  (json_agg of the 1-row extract)
period = sys.argv[2]
assert isinstance(arr, list) and len(arr) == 1, arr
ext = SAE.parse_shadow_arm_extract(arr)
e = ext[period]
assert set(e.per_arm) == set(SAE._ALL_ARMS), sorted(e.per_arm)
assert len(e.per_arm["production-snapshot"].picks_by_tf["short"]) == 10
assert e.per_arm["candidate-pool-hard-gate"].counterfactual_cut == {"000099", "000098"}, "cut not parsed"
assert e.per_arm["sector-soft-reserve"].sector_source == "manual_pre_registered"

# synthetic weekday panel covering the period + short forward maturity (no network).
dates, d = [], date(2026, 4, 1)
while len(dates) < 150:
    if d.weekday() < 5:
        dates.append(d.strftime("%Y%m%d"))
    d += timedelta(days=1)
tickers = {tk for af in e.per_arm.values() for tks in af.picks_by_tf.values() for tk in tks}
tickers |= {f"{900000+i:06d}" for i in range(40)}   # filler so a winner basket exists
panel = {}
for di, dk in enumerate(dates):
    panel[dk] = {tk: PanelRow(close=100.0 + di * (hash(tk) % 7 + 1) * 0.3, high=100.0, trdval=1e9,
                              mktcap=1e12, name=tk, market="KOSPI", list_shrs=1e6) for tk in tickers}

coverage = {"rows": [{"period_key": period, "track": "short", "status": "complete"}]}
kr = {"freeze_tag": "pra5-smoke", "parameter_lock_commit_hash": "smoke", "arms": list(SAE._ALL_ARMS),
      "run_date_stale_max_days": 60, "timeframes": ["short", "mid", "long"], "fwer_family_m": 9,
      "return_contract": "raw close t+1→t+1+h, 0bps",
      "tracks": {"short": {"cadence": "weekly", "power_floor_n": 6},
                 "midlong": {"cadence": "monthly", "power_floor_n": 6}},
      "regime_by_period_key": {period: "bull"}, "regime_vocab": ["bull", "bear", "sideways"],
      "leading_sectors_benchmark": {"by_period_key": {period: {"short": 0.01}}}}
pr = SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage=coverage, kill_rule=kr,
                                    arms=list(SAE._ALL_ARMS))
assert pr[0].eligible, ("period not eligible", pr[0].reason_code)
rep = SAE.aggregate_shadow_arm_verdict(pr, kill_rule=kr, arms=list(SAE._ALL_ARMS),
                                       generated_at="2026-06-23T00:00:00", survivorship={"exit_status": 0, "label": "smoke"})
SAE.assert_verdict_integrity(rep)
# single eligible period ⇒ n<data_floor ⇒ INCOMPLETE_RUN; PASS is structurally unreachable; no_apply pinned.
assert rep["run_verdict"] in ("INCOMPLETE_RUN", "DIRECTIONAL"), rep["run_verdict"]
assert rep["run_verdict"] != "PASS"
assert rep["no_apply"] is True and rep["triple_gate_all_pass"] is False
assert "verification pending" in rep["claim_discipline"]
print(f"ok: extract→parse→harvest→aggregate run_verdict={rep['run_verdict']} (no_apply, PASS-unreachable)")
PY

printf '\nPRA5 SMOKE PASS\n'
echo "USER-only (NOT executed here): real Supabase service_role-key semantics; production owner-psql extraction."
echo "PR-A5 adds NO migration and NO grant; it READS (0038 grant) + evaluates in pure Python (no DB write)."
