#!/usr/bin/env bash
# TASK A — LARGE+MID investable-universe FROZEN PROTOCOL driver (2026-06-17).
#
# Runs cfg1 (trend+size, best recall) × 3 regimes with --universe largemid. EXPLORATORY / diagnostic-only:
# no --apply, no Supabase (offline scripts/out/pit_cache), cost 0. Output → scripts/out/largemid/ so it
# NEVER collides with the all-universe FAILED verdict (scripts/out/bc/). Does NOT edit the 6-config matrix
# runner (run_tier0_6config_matrix.sh) — separate isolated driver.
#
# SoT: docs/superpowers/2026-06-17-tier0-largemid-freeze.md (pre-registered before run).
# NOTE: full 3-regime harvest is a LATER step; this driver is for that run when invoked.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PY=${PY:-scripts/.venv/bin/python}
HARVEST=${HARVEST:-scripts/validate_tier0_ic.py}
CACHE=${CACHE:-scripts/out/pit_cache}
OUT=${OUT:-scripts/out/largemid}
MAXJOBS=${MAXJOBS:-2}
FAILS=$(mktemp "${TMPDIR:-/tmp}/tier0-largemid-fails.XXXXXX")
trap 'rm -f "$FAILS"' EXIT

mkdir -p "$OUT"

# cfg1 (trend+size) — earnings/foreign OFF → trend+size. --universe largemid on all 3 regimes.
jobs=(
  "cfg1_largemid_bear2022|2022-01-01|2022-12-01"
  "cfg1_largemid_recov2023|2023-01-01|2023-12-01"
  "cfg1_largemid_bull2425|2024-01-01|2025-12-01"
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
  echo "[start] $(date +%H:%M:%S) $name $start..$end --universe largemid"
  if $PY "$HARVEST" --start-month "$start" --end-month "$end" --cache-dir "$CACHE" \
        --out "$outjson" --universe largemid > "$OUT/$name.log" 2>&1; then
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
echo "=== all largemid-freeze runs complete → $OUT ==="
echo "⚠️  diagnostic only — no --apply / Tier1 / '상승 예측' claim. SoT: docs/superpowers/2026-06-17-tier0-largemid-freeze.md"
