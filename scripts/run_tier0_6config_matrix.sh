#!/usr/bin/env bash
set -uo pipefail

PY=${PY:-scripts/.venv/bin/python}
HARVEST=${HARVEST:-scripts/validate_tier0_ic.py}
ADJUDICATOR=${ADJUDICATOR:-scripts/adjudicate_4config.py}
CACHE=${CACHE:-scripts/out/pit_cache}
OUT=${OUT:-scripts/out/bc}
BACKFILL=${BACKFILL:-scripts/out/dart_backfill.jsonl}
MAXJOBS=${MAXJOBS:-2}
FAILS=$(mktemp "${TMPDIR:-/tmp}/tier0-6config-fails.XXXXXX")
trap 'rm -f "$FAILS"' EXIT

mkdir -p "$OUT"

jobs=(
  "cfg1_bear2022|2022-01-01|2022-12-01|"
  "cfg1_recov2023|2023-01-01|2023-12-01|"
  "cfg1_bull2425|2024-01-01|2025-12-01|"
  "cfg2_bear2022|2022-01-01|2022-12-01|--with-foreign"
  "cfg2_recov2023|2023-01-01|2023-12-01|--with-foreign"
  "cfg2_bull2425|2024-01-01|2025-12-01|--with-foreign"
  "cfg3_bear2022|2022-01-01|2022-12-01|--earnings --dart-backfill-path $BACKFILL"
  "cfg3_recov2023|2023-01-01|2023-12-01|--earnings --dart-backfill-path $BACKFILL"
  "cfg3_bull2425|2024-01-01|2025-12-01|--earnings --dart-backfill-path $BACKFILL"
  "cfg4_bear2022|2022-01-01|2022-12-01|--with-foreign --earnings --dart-backfill-path $BACKFILL"
  "cfg4_recov2023|2023-01-01|2023-12-01|--with-foreign --earnings --dart-backfill-path $BACKFILL"
  "cfg4_bull2425|2024-01-01|2025-12-01|--with-foreign --earnings --dart-backfill-path $BACKFILL"
  "cfg6_bear2022|2022-01-01|2022-12-01|--generator cfg6 --with-foreign"
  "cfg6_recov2023|2023-01-01|2023-12-01|--generator cfg6 --with-foreign"
  "cfg6_bull2425|2024-01-01|2025-12-01|--generator cfg6 --with-foreign"
  "cfg7_bear2022|2022-01-01|2022-12-01|--generator cfg7"
  "cfg7_recov2023|2023-01-01|2023-12-01|--generator cfg7"
  "cfg7_bull2425|2024-01-01|2025-12-01|--generator cfg7"
)

run_one() {
  local spec=$1
  local name=${spec%%|*}
  local rest=${spec#*|}
  local start=${rest%%|*}
  rest=${rest#*|}
  local end=${rest%%|*}
  local extra=${rest#*|}
  local outjson="$OUT/$name.json"
  if [[ -s "$outjson" ]]; then
    echo "[skip] $name"
    return 0
  fi
  echo "[start] $(date +%H:%M:%S) $name $start..$end ${extra:-<none>}"
  if $PY "$HARVEST" --start-month "$start" --end-month "$end" --cache-dir "$CACHE" --out "$outjson" $extra > "$OUT/$name.log" 2>&1; then
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
    wait
    running=0
  fi
done
wait

if [[ -s "$FAILS" ]]; then
  cat "$FAILS"
  exit 1
fi

$PY "$ADJUDICATOR" --bc-dir "$OUT"
