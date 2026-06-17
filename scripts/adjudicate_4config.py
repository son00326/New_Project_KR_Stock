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
    CONFIGS,
    FREEZE_TAG,
    HORIZONS,
    REGIMES,
    VALID_GATE_VERDICTS,
    _ci_excludes_zero,
    _ci_positive,
    _num,
    adjudicate,
    artifact_audit,
    gate_a_summary,
    input_issues,
    invalid_result,
    load_matrix,
)


def fmt_table(m):
    lines = ["| config × regime | Gate A | Gate B | Gate C | triple | recall | per-horizon recall s/m/l | ic_ir | baseline_recall | leaders |",
             "|---|---|---|---|---|---|---|---|---|---|"]
    for cfg in CONFIGS:
        for reg in REGIMES:
            c = m[(cfg, reg)]
            if c.get("_missing"):
                lines.append(f"| {cfg} {reg} | — MISSING — | | | | | | | | |")
                continue
            invalid = " INVALID" if c.get("_invalid") else ""
            lt = f"{c['leader_hits']}/{c['leader_total']}" if c['leader_total'] else "—"
            def f(x): return "—" if x is None else f"{x:.3f}"
            hr = "/".join(f(c["per_horizon_recall"].get(h)) for h in HORIZONS)
            lines.append(f"| {cfg} {reg} | {c['ga_verdict']}{invalid} | {c['gb_verdict']} | {c['gc_verdict']} | "
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
    if missing or invalid:
        result = invalid_result(args.lock_hash, missing, invalid)
        exit_code = 2
    else:
        result = adjudicate(m, args.lock_hash)
        result["gate_a_summary"] = gate_a_summary(m)
        result["artifact_audit"] = artifact_audit(m)
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
    print(f"MISSING: {missing}" if missing else "all 12 present")
    if invalid:
        print(f"INVALID: {invalid}")
    print(f"VERDICT: {result['verdict']}  winners={result['winners']}")
    print(result["decision"])
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
