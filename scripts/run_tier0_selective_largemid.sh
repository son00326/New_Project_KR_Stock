#!/usr/bin/env bash
# TASK 가 — SELECTIVE LARGEMID driver (2026-06-18).
#
# Runs cfg1 (trend+size; --generator bpp + earnings/foreign OFF) × 3 regimes with --universe largemid
# AND --select-count, capping the largemid selection to the pooled top-N by cfg1 score (cross-bucket-
# disjoint union). N=50 is the ADJUDICATED count; 30/75 are NON-ADJUDICATED sensitivity (same driver,
# distinct out-files, never pass/fail). EXPLORATORY / diagnostic-only: no --apply, no Supabase (offline
# scripts/out/pit_cache), cost 0. Output → scripts/out/selective_largemid/ so it never collides with the
# all-universe FAILED verdict (scripts/out/bc/) or the largemid-freeze run (scripts/out/largemid/).
#
# NEGATIVE-HYPOTHESIS: the all-universe AND largemid-freeze Tier0 verdicts already FAILED. This asks a
# narrower falsification — does cfg1 ranking have SELECTION skill on large+mid when we actually SELECT N
# (not pick ~half the pond)? PASS = recall-LIFT CI90 lower>0 (fallback +5pp) AND co-gate rank-IC IR≥0.30.
# Absolute recall≥0.20 is NOT the binding bar here.
#
# SoT: docs/superpowers/2026-06-18-tier0-selective-largemid.md (pre-registered before run).
# Does NOT edit run_tier0_largemid_freeze.sh or run_tier0_6config_matrix.sh — separate isolated driver.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PY=${PY:-scripts/.venv/bin/python}
HARVEST=${HARVEST:-scripts/validate_tier0_ic.py}
CACHE=${CACHE:-scripts/out/pit_cache}
OUT=${OUT:-scripts/out/selective_largemid}
MAXJOBS=${MAXJOBS:-2}
FAILS=$(mktemp "${TMPDIR:-/tmp}/tier0-selective-fails.XXXXXX")
trap 'rm -f "$FAILS"' EXIT

mkdir -p "$OUT"

# (count|name|start|end). N=50 ADJUDICATED; 30/75 NON-ADJUDICATED sensitivity appendix.
jobs=(
  "50|selective50_bear2022|2022-01-01|2022-12-01"
  "50|selective50_recov2023|2023-01-01|2023-12-01"
  "50|selective50_bull2425|2024-01-01|2025-12-01"
  "30|selective30_bear2022|2022-01-01|2022-12-01"
  "30|selective30_recov2023|2023-01-01|2023-12-01"
  "30|selective30_bull2425|2024-01-01|2025-12-01"
  "75|selective75_bear2022|2022-01-01|2022-12-01"
  "75|selective75_recov2023|2023-01-01|2023-12-01"
  "75|selective75_bull2425|2024-01-01|2025-12-01"
)

run_one() {
  local spec=$1
  local count=${spec%%|*}
  local rest=${spec#*|}
  local name=${rest%%|*}
  rest=${rest#*|}
  local start=${rest%%|*}
  local end=${rest#*|}
  local outjson="$OUT/$name.json"
  if [[ -s "$outjson" ]]; then
    echo "[skip] $name"
    return 0
  fi
  echo "[start] $(date +%H:%M:%S) $name $start..$end --universe largemid --select-count $count"
  if $PY "$HARVEST" --start-month "$start" --end-month "$end" --cache-dir "$CACHE" \
        --out "$outjson" --universe largemid --select-count "$count" > "$OUT/$name.log" 2>&1; then
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
echo "=== all selective-largemid runs complete → $OUT ==="
echo "⚠️  diagnostic only — NEGATIVE-HYPOTHESIS, no --apply / Tier1 / '상승 예측' claim. Only N=50 adjudicated;"
echo "    N=30/75 are NON-ADJUDICATED sensitivity. SoT: docs/superpowers/2026-06-18-tier0-selective-largemid.md"
