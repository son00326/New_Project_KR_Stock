#!/usr/bin/env bash
# (D) CHART/TECHNICAL composite FALSIFICATION — per-regime invocation wrapper (2026-06-18).
#
# Runs the chart-composite kill-switch (PRIMARY) + selector (가-reuse) over 3 regime windows. The
# kill-switch by-regime requirement is satisfied by one run per regime window (distinct out-files).
# EXPLORATORY / diagnostic-only: no --apply, no Supabase (offline scripts/out/pit_cache), cost 0.
# Output → scripts/out/chart_technical/ (no collision with bc/ largemid/ selective_largemid/ net_issuance/).
#
# NEGATIVE-HYPOTHESIS: objective technicals are mostly already-tested OHLCV momentum. The kill-switch
# FIRES (= not new) if corr(chart, trend|full_bpp) >= 0.5 in any scope/regime. If it fires, the selector
# is APPENDIX only. SoT: docs/superpowers/2026-06-18-tier0-chart-technical.md (pre-registered before run).
#
# Does NOT edit any other driver — standalone isolated. tier0_factors.py / validate_tier0_ic.py import-only.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PY=${PY:-scripts/.venv/bin/python}
DRIVER=${DRIVER:-scripts/run_tier0_chart_falsification.py}
CACHE=${CACHE:-scripts/out/pit_cache}
OUT=${OUT:-scripts/out/chart_technical}
WITH_FOREIGN=${WITH_FOREIGN:-0}   # set WITH_FOREIGN=1 to also measure corr(chart, foreign)
MAXJOBS=${MAXJOBS:-2}
FAILS=$(mktemp "${TMPDIR:-/tmp}/tier0-chart-fails.XXXXXX")
trap 'rm -f "$FAILS"' EXIT

mkdir -p "$OUT"

# (name|start|end) — 3 regimes (bear 2022 / recovery 2023 / bull 2024-25).
jobs=(
  "chart_bear2022|2022-01-01|2022-12-01"
  "chart_recov2023|2023-01-01|2023-12-01"
  "chart_bull2425|2024-01-01|2025-12-01"
)

if [[ "$WITH_FOREIGN" == "1" ]]; then
  echo "WITH_FOREIGN=1 is blocked: (D) objective-technical protocol is OHLCV-only; foreign remains BLOCKED/OFF." >&2
  exit 2
fi

run_one() {
  local spec=$1
  local name=${spec%%|*}
  local rest=${spec#*|}
  local start=${rest%%|*}
  local end=${rest#*|}
  local outjson="$OUT/$name.json"
  echo "[start] $(date +%H:%M:%S) $name $start..$end"
  if $PY "$DRIVER" --start-month "$start" --end-month "$end" --cache-dir "$CACHE" \
        --out "$outjson" > "$OUT/$name.log" 2>&1; then
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
echo "=== all chart-technical runs complete → $OUT ==="
echo "⚠️  diagnostic only — kill-switch PRIMARY; if it fires the selector is APPENDIX. no --apply / Tier1 /"
echo "    '상승 예측' claim. N=50 adjudicated; N=30/75 sensitivity. SoT: docs/superpowers/2026-06-18-tier0-chart-technical.md"
