#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.adjudicate_4config_core import (
    BLOCKED_CONFIGS,
    CONFIGS,
    DECISION_CONFIGS,
    EXPECTED_GENERATOR,
    EXPLORATORY_CONFIGS,
    FREEZE_TAG,
    HORIZONS,
    REGIMES,
    RUNNABLE_EXPLORATORY_CONFIGS,
    VALID_GATE_VERDICTS,
    _ci_excludes_zero,
    _ci_positive,
    _num,
    adjudicate,
    artifact_audit,
    exploratory_input_issues,
    gate_a_summary,
    input_issues,
    invalid_result,
    load_matrix,
)


def fmt_table(m):
    lines = ["| config × regime | Gate A | Gate B | Gate C | triple | recall | per-horizon recall s/m/l | ic_ir | baseline_recall | leaders |",
             "|---|---|---|---|---|---|---|---|---|---|"]
    for cfg in CONFIGS:
        expl = " (EXPLORATORY)" if cfg in EXPLORATORY_CONFIGS else ""
        blocked = " (BLOCKED)" if cfg in BLOCKED_CONFIGS else ""
        for reg in REGIMES:
            c = m[(cfg, reg)]
            if cfg in BLOCKED_CONFIGS:
                lines.append(f"| {cfg}{expl}{blocked} {reg} | — BLOCKED OFFLINE — | | | | | | | | |")
                continue
            if c.get("_missing"):
                lines.append(f"| {cfg}{expl}{blocked} {reg} | — MISSING — | | | | | | | | |")
                continue
            invalid = " INVALID" if c.get("_invalid") else ""
            lt = f"{c['leader_hits']}/{c['leader_total']}" if c['leader_total'] else "—"
            def f(x): return "—" if x is None else f"{x:.3f}"
            hr = "/".join(f(c["per_horizon_recall"].get(h)) for h in HORIZONS)
            lines.append(f"| {cfg}{expl}{blocked} {reg} | {c['ga_verdict']}{invalid} | {c['gb_verdict']} | {c['gc_verdict']} | "
                         f"{'✓' if c['triple'] else '✗'} | {f(c['overall_recall'])} | {hr} | {f(c['ic_ir'])} | "
                         f"{f(c['binding_baseline_recall'])} | {lt} |")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bc-dir", default="scripts/out/bc")
    ap.add_argument("--lock-hash", default="17dc6d9")
    ap.add_argument("--out-json", default="scripts/out/bc/verdict_4config.json")
    ap.add_argument("--out-md", default="scripts/out/bc/verdict_4config.md")
    args = ap.parse_args()
    bc = Path(args.bc_dir)
    m = load_matrix(bc, args.lock_hash, FREEZE_TAG)
    missing, invalid = input_issues(m)
    exploratory_missing, exploratory_invalid = exploratory_input_issues(m)
    if missing or invalid:
        result = invalid_result(args.lock_hash, missing, invalid)
        exit_code = 2
    else:
        result = adjudicate(m, args.lock_hash)
        result["gate_a_summary"] = gate_a_summary(m)
        result["artifact_audit"] = artifact_audit(m)
        result["exploratory_missing_runs"] = exploratory_missing
        result["exploratory_invalid_runs"] = exploratory_invalid
        exit_code = 0
    table = fmt_table(m)
    Path(args.out_json).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    if "per_config" in result:
        md = (f"# B+C 4-config × 3-regime verdict\n\n"
              f"- parameter_lock_commit_hash: `{args.lock_hash}` (git-tag tier0-multiregime-freeze)\n"
              f"- VERDICT: **{result['verdict']}**  winners={result['winners']}\n"
              f"- {result['decision']}\n\n"
              f"{'⚠️ MISSING runs: ' + ', '.join(missing) if missing else ''}\n"
              f"{'⚠️ INVALID runs: ' + json.dumps(invalid, ensure_ascii=False) if invalid else ''}\n\n"
              f"{'EXPLORATORY missing runs: ' + ', '.join(exploratory_missing) if exploratory_missing else ''}\n"
              f"{'⚠️ EXPLORATORY invalid runs: ' + json.dumps(exploratory_invalid, ensure_ascii=False) if exploratory_invalid else ''}\n\n"
              f"## gate matrix\n\n{table}\n\n"
              f"## config 판정\n\n```json\n{json.dumps(result['per_config'], ensure_ascii=False, indent=2)}\n```\n")
    else:
        md = (f"# B+C 4-config × 3-regime verdict\n\n"
              f"- parameter_lock_commit_hash: `{args.lock_hash}` (git-tag tier0-multiregime-freeze)\n"
              f"- VERDICT: **{result['verdict']}**  winners=[]\n"
              f"- {result['decision']}\n\n"
              f"{'⚠️ MISSING runs: ' + ', '.join(missing) if missing else ''}\n"
              f"{'⚠️ INVALID runs: ' + json.dumps(invalid, ensure_ascii=False) if invalid else ''}\n\n"
              f"## gate matrix\n\n{table}\n")
    Path(args.out_md).write_text(md, encoding="utf-8")
    print(table)
    print()
    print(f"MISSING: {missing}" if missing else f"all {len(DECISION_CONFIGS) * len(REGIMES)} decision cells present")
    if invalid:
        print(f"INVALID: {invalid}")
    if exploratory_missing:
        print(f"EXPLORATORY_MISSING: {exploratory_missing}")
    if exploratory_invalid:
        print(f"EXPLORATORY_INVALID: {exploratory_invalid}")
    if BLOCKED_CONFIGS:
        print(f"BLOCKED: {sorted(BLOCKED_CONFIGS)}")
    if RUNNABLE_EXPLORATORY_CONFIGS:
        print(f"RUNNABLE_EXPLORATORY: {list(RUNNABLE_EXPLORATORY_CONFIGS)}")
    print(f"VERDICT: {result['verdict']}  winners={result['winners']}")
    print(result["decision"])
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
