#!/usr/bin/env bash
# cfg8 — SURGE ON LARGEMID driver (2026-06-18). USER-requested falsification (prism combined-recipe approx).
#
# cfg8 = the cfg7 daily-surge generator restricted to --universe largemid. Invoked as
# `--generator cfg7 --universe largemid`; output filenames are cfg8_<regime>.json (via --out) so the
# adjudicator keys them as cfg8 while the run JSON honestly carries generator="cfg7" + universe="largemid".
# 3 regimes, offline (scripts/out/pit_cache), no Supabase, cost 0. EXPLORATORY — excluded from decision
# winners + --apply (RUNNABLE_EXPLORATORY only). Surge-only generator → NO --earnings / --with-foreign
# (avoids the DART/foreign availability concern; cfg7 is trend/surge-only).
#
# Same gate (cfg7 funnel = recall + random-ratio + per-horizon + baseline-beat, via gate_a_pass_largemid)
# + cfg7 secondary metrics on largemid (recall-lift vs random AND vs high-volume baseline, lead-time, fwd
# 1d/5d/20d, churn). PRE-REGISTERED fail wording (addendum): "daily surge + largemid restriction adds no
# recall edge over liquidity/random in THIS offline monthly/daily harness" — NOT "prism fails". A fair
# prism comparison would need intraday triggers + executable entry/exit + slippage/fees/impact + position
# sizing + stops + P&L/risk (explicitly OUT of scope).
#
# NEGATIVE-HYPOTHESIS: TASK B (cfg7 all-universe) already FAILED; cfg8 is a falsification of surge-on-
# largemid, NOT a rescue. SoT: docs/superpowers/2026-06-18-tier0-cfg8-surge-largemid.md. Does NOT edit
# run_tier0_6config_matrix.sh / run_tier0_largemid_freeze.sh — separate driver.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PY=${PY:-scripts/.venv/bin/python}
HARVEST=${HARVEST:-scripts/validate_tier0_ic.py}
CACHE=${CACHE:-scripts/out/pit_cache}
OUT=${OUT:-scripts/out/cfg8}
MAXJOBS=${MAXJOBS:-2}
FAILS=$(mktemp "${TMPDIR:-/tmp}/tier0-cfg8-fails.XXXXXX")
trap 'rm -f "$FAILS"' EXIT

mkdir -p "$OUT"

# (name|start|end). name = cfg8_<regime> so adjudicator load_matrix keys them as cfg8.
jobs=(
  "cfg8_bear2022|2022-01-01|2022-12-01"
  "cfg8_recov2023|2023-01-01|2023-12-01"
  "cfg8_bull2425|2024-01-01|2025-12-01"
)

run_one() {
  local spec=$1
  local name=${spec%%|*}
  local rest=${spec#*|}
  local start=${rest%%|*}
  local end=${rest#*|}
  local outjson="$OUT/$name.json"
  if [[ -s "$outjson" ]]; then
    echo "[skip] $name"
    return 0
  fi
  echo "[start] $(date +%H:%M:%S) $name $start..$end --generator cfg7 --universe largemid"
  if $PY "$HARVEST" --start-month "$start" --end-month "$end" --cache-dir "$CACHE" \
        --out "$outjson" --generator cfg7 --universe largemid > "$OUT/$name.log" 2>&1; then
    [[ -s "$outjson" ]] && echo "[done]  $(date +%H:%M:%S) $name" && return 0
  fi
  echo "[FAIL]  $(date +%H:%M:%S) $name" | tee -a "$FAILS"
  return 1
}

running=0
for spec in "${jobs[@]}"; do
  (run_one "$spec" || true) &
  running=$((running + 1))
  if (( running >= MAXJOBS )); then
    wait -n 2>/dev/null || wait
    running=$((running - 1))
  fi
done
wait

if [[ -s "$FAILS" ]]; then
  echo "=== FAILED runs ==="
  cat "$FAILS"
  exit 1
fi
echo "=== all cfg8 surge-on-largemid runs complete → $OUT ==="
echo "⚠️  EXPLORATORY / NEGATIVE-HYPOTHESIS — no --apply / Tier1 / '상승 예측' / 'prism fails' claim."
echo "    SoT: docs/superpowers/2026-06-18-tier0-cfg8-surge-largemid.md."
