#!/bin/bash
# 재검증 (a) — TRADABLE WINNER DENOMINATOR · 4-config × 3-regime harvest driver.
# Re-runs the 2026-06-17 4-config matrix with --winner-universe tradable: the Gate A winner denominator
# is restricted to the funnel's OWN liquidity-eligibility universe (ADV≥₩2B) = apples-to-apples. Binding
# metric REUSED VERBATIM from gate_a_pass_selective_largemid (lift-CI lower>0 + IC IR≥0.30); NO new
# threshold. SAME provider wiring as the 2026-06-17 bc run (Supabase READ-ONLY for universe/sector + DART
# cache/backfill overlay; no write, no --apply, no migration), AI cost 0. diagnostic_only / decision_grade=False.
# Pre-registered (FROZEN before run): docs/superpowers/2026-06-18-tier0-tradable-winner-denominator.md.
# Frozen invariants: git-tag tier0-multiregime-freeze · tier0_factors.py · decision-rules · cfg1-4/all-
# universe/no-flag path all UNTOUCHED. Idempotent (skip existing). Concurrency-limited (memory-safe).
set -u
PY=scripts/.venv/bin/python
SCRIPT=scripts/validate_tier0_ic.py
CACHE=scripts/out/pit_cache
OUT=scripts/out/tradable_winner
BACKFILL=scripts/out/dart_backfill.jsonl
MAXJOBS="${MAXJOBS:-2}"
mkdir -p "$OUT"

TW="--winner-universe tradable"  # the ONLY delta vs the 2026-06-17 bc run (denominator pre-registered)

# name|start|end|extra_flags  (config = factor set; params/thresholds identical = frozen; + tradable denom)
jobs=(
  "cfg1_bear2022|2022-01-01|2022-12-01|$TW"
  "cfg1_recov2023|2023-01-01|2023-12-01|$TW"
  "cfg1_bull2425|2024-01-01|2025-12-01|$TW"
  "cfg2_bear2022|2022-01-01|2022-12-01|--with-foreign $TW"
  "cfg2_recov2023|2023-01-01|2023-12-01|--with-foreign $TW"
  "cfg2_bull2425|2024-01-01|2025-12-01|--with-foreign $TW"
  "cfg3_bear2022|2022-01-01|2022-12-01|--earnings --dart-backfill-path $BACKFILL $TW"
  "cfg3_recov2023|2023-01-01|2023-12-01|--earnings --dart-backfill-path $BACKFILL $TW"
  "cfg3_bull2425|2024-01-01|2025-12-01|--earnings --dart-backfill-path $BACKFILL $TW"
  "cfg4_bear2022|2022-01-01|2022-12-01|--with-foreign --earnings --dart-backfill-path $BACKFILL $TW"
  "cfg4_recov2023|2023-01-01|2023-12-01|--with-foreign --earnings --dart-backfill-path $BACKFILL $TW"
  "cfg4_bull2425|2024-01-01|2025-12-01|--with-foreign --earnings --dart-backfill-path $BACKFILL $TW"
)

# omxy ROUND-1 LOW + ROUND-2 MEDIUM fix (fail-closed): cfg3/cfg4 carry --earnings. If DART silently failed to
# load (earnings_missing_fraction == 1.0), the config collapses to trend+size and the 5-signal experiment is
# void. This MUST be enforced on BOTH a fresh run AND a skipped pre-existing JSON (ROUND-2 MEDIUM: a stale/
# partial cfg3/cfg4 JSON with earnings dropped would otherwise be skipped and preserved as a fake matrix).
assert_earnings_loaded() {  # $1=name $2=outjson → 0 if ok or not-applicable, 1 if earnings void/unverifiable
  local name="$1" outjson="$2"
  [[ "$name" == cfg3_* || "$name" == cfg4_* ]] || return 0
  # omxy ROUND-3 MEDIUM: fully fail-closed. The Python ASSERTS the value is numeric AND 0<=v<1.0 and exits
  # non-zero otherwise; a malformed/truncated JSON, a missing key, a non-numeric, or emf>=1.0 ALL → rc!=0 →
  # FAIL (no longer silently "DART loaded OK" on an empty emf from a swallowed read error).
  local emf prc
  emf=$($PY -c "import json,sys; v=json.load(open('$outjson'))['data_quality'].get('earnings_missing_fraction'); sys.exit(1) if not (isinstance(v,(int,float)) and 0.0<=v<1.0) else print(v)" 2>/dev/null)
  prc=$?
  if [[ $prc -ne 0 || -z "$emf" ]]; then
    echo "[FAIL]  $name EARNINGS-CHECK-INVALID (unreadable/malformed JSON, missing/non-numeric earnings_missing_fraction, or >=1.0) — DART overlay not verifiably loaded; experiment void for this cell (delete the JSON and rerun)"
    return 1
  fi
  echo "[earn]  $name earnings_missing_fraction=$emf (DART loaded OK)"
  return 0
}

run_one() {
  local spec="$1"
  local name="${spec%%|*}"; local rest="${spec#*|}"
  local start="${rest%%|*}"; rest="${rest#*|}"
  local end="${rest%%|*}"; local extra="${rest#*|}"
  local outjson="$OUT/$name.json"
  if [[ -s "$outjson" ]]; then
    # ROUND-2 MEDIUM: validate the EXISTING JSON's earnings before honoring the skip (no fake-matrix preserve).
    if assert_earnings_loaded "$name" "$outjson"; then echo "[skip] $name (exists)"; return 0; fi
    echo "[FAIL]  $name skipped-but-INVALID (earnings void in existing JSON) — not treating as done"
    return 1
  fi
  echo "[start] $(date +%H:%M:%S) $name ($start..$end) ${extra:-<none>}"
  $PY $SCRIPT --start-month "$start" --end-month "$end" --cache-dir "$CACHE" --out "$outjson" $extra > "$OUT/$name.log" 2>&1
  local rc=$?
  if [[ "$rc" -eq 0 && -s "$outjson" ]]; then
    if ! assert_earnings_loaded "$name" "$outjson"; then return 1; fi
    echo "[done]  $(date +%H:%M:%S) $name exit=$rc OK"
    return 0
  fi
  if [[ -s "$outjson" ]]; then
    echo "[FAIL]  $(date +%H:%M:%S) $name exit=$rc JSON-WRITTEN"
  else
    echo "[FAIL]  $(date +%H:%M:%S) $name exit=$rc NO-JSON"
  fi
  return 1
}

wait_batch() {
  local rc=0
  local p
  for p in "${pids[@]}"; do
    if ! wait "$p"; then rc=1; fi
  done
  pids=()
  return "$rc"
}

i=0; pids=(); pending=0; overall=0
for spec in "${jobs[@]}"; do
  run_one "$spec" &
  pids+=("$!")
  pending=$((pending+1))
  i=$((i+1))
  if (( i % MAXJOBS == 0 )); then
    wait_batch || overall=1
    pending=0
  fi
done
if (( pending > 0 )); then
  wait_batch || overall=1
fi

echo ""
echo "=== tradable-winner harvest done (overall rc=$overall) ==="
ls -1 "$OUT"/*.json 2>/dev/null | sed "s#^#  #"
exit "$overall"
