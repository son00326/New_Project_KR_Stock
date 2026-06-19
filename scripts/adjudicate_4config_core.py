"""B+C 4-config × 3-regime 동결 결정규칙 adjudicator (deterministic).

SoT(FROZEN): docs/superpowers/tier0-4config-decision-rules.md @ git-tag tier0-multiregime-freeze.
이 스크립트는 임계를 재정의하지 않는다 — 각 run JSON의 frozen-harness가 계산한 gate verdict를 읽고,
config-selection 규칙(cross-config recall&IC 우위 + 삼중게이트 + size-neutral skill CI≠0 + 모든 장세)을
기계적으로 적용한다. run 후 규칙/임계 수정 = p-hacking(금지). verdict JSON + markdown 표 emit.

사용: scripts/.venv/bin/python scripts/adjudicate_4config.py --bc-dir scripts/out/bc
"""
from __future__ import annotations

import json
import math
from pathlib import Path

CONFIGS = {
    "cfg1": "trend+size (binding baseline)",
    "cfg2": "+foreign",
    "cfg3": "+earnings",
    "cfg4": "+foreign+earnings",
    "cfg5": "regime/leading-sector tilt (EXPLORATORY)",
    "cfg6": "multi-net union (EXPLORATORY)",
    "cfg7": "daily surge proxy (EXPLORATORY, NOT prism)",
    "cfg8": "daily surge proxy + largemid (EXPLORATORY, USER falsification)",
}
DECISION_CONFIGS = ("cfg1", "cfg2", "cfg3", "cfg4")

EXPLORATORY_CONFIGS = {"cfg5", "cfg6", "cfg7", "cfg8"}
BLOCKED_CONFIGS = {"cfg5"}  # cfg5 only: no PIT-safe offline universe-wide sector source. cfg6/cfg7/cfg8 offline-runnable.
# cfg8 = cfg7 generator restricted to --universe largemid (un-deferred 2026-06-18). Its run JSON carries
# generator="cfg7" (the actual generator) + universe="largemid" — load_matrix special-cases the cross-check.
RUNNABLE_EXPLORATORY_CONFIGS = tuple(c for c in ("cfg5", "cfg6", "cfg7", "cfg8") if c not in BLOCKED_CONFIGS)
# config → expected generator field in its run JSON (cfg8 runs the cfg7 generator).
EXPECTED_GENERATOR = {"cfg5": "cfg5", "cfg6": "cfg6", "cfg7": "cfg7", "cfg8": "cfg7"}
REGIMES = {"bear2022": "2022 약세", "recov2023": "2023 회복", "bull2425": "2024-25 강세"}
HORIZONS = ("short", "mid", "long")
VALID_GATE_VERDICTS = {"PASS", "FAIL", "ADJUDICATE"}
FREEZE_TAG = "tier0-multiregime-freeze"


def _num(x):
    try:
        f = float(x)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def _ci_excludes_zero(ci):
    """ci = [lo, hi]. 0을 포함하지 않으면(전부 >0 또는 전부 <0) True. 결측/straddle → False."""
    if not isinstance(ci, (list, tuple)) or len(ci) != 2:
        return None
    lo, hi = _num(ci[0]), _num(ci[1])
    if lo is None or hi is None:
        return None
    return (lo > 0 and hi > 0) or (lo < 0 and hi < 0)


def _ci_positive(ci):
    """ci = [lo, hi]. 양(+)의 방향으로 0을 배제(lo>0 and hi>0)하면 True. 결측/straddle/음수 → False.
    rule iii는 '유의한 (양의) size-neutral skill'을 요구하므로 CI 부호를 직접 본다(별도 point-estimate AND 제거)."""
    if not isinstance(ci, (list, tuple)) or len(ci) != 2:
        return False
    lo, hi = _num(ci[0]), _num(ci[1])
    return lo is not None and hi is not None and lo > 0 and hi > 0


def load_matrix(bc_dir: Path, expected_lock_hash="17dc6d9", expected_freeze_tag=FREEZE_TAG):
    m = {}
    for cfg in CONFIGS:
        for reg in REGIMES:
            p = bc_dir / f"{cfg}_{reg}.json"
            if not p.exists():
                m[(cfg, reg)] = {"_missing": True}
                continue
            j = json.loads(p.read_text(encoding="utf-8"))
            ga, gb, gc = j.get("gate_a", {}), j.get("gate_b", {}), j.get("gate_c", {})
            sp = j.get("selection_performance", {})
            per_horizon = ga.get("per_horizon", {}) or {}
            triple_raw = j.get("triple_gate_all_pass")
            lock_hash = j.get("parameter_lock_commit_hash")
            freeze_tag = j.get("freeze_tag")
            invalid_reasons = []
            if not isinstance(triple_raw, bool):
                invalid_reasons.append("triple_gate_all_pass must be bool")
            if lock_hash != expected_lock_hash:
                invalid_reasons.append(
                    f"parameter_lock_commit_hash must be {expected_lock_hash}, got {lock_hash!r}")
            if freeze_tag != expected_freeze_tag:
                invalid_reasons.append(f"freeze_tag must be {expected_freeze_tag}, got {freeze_tag!r}")
            # defense-in-depth: filename(cfg) ↔ JSON generator/exploratory 정합 (cross-wired run JSON
            # 차단). cfg5/cfg6/cfg7/cfg8 = EXPLORATORY 생성기 JSON, cfg1-4 = bpp(frozen) JSON이어야 한다.
            gen_field = j.get("generator")
            expl_field = j.get("exploratory")
            if cfg in EXPLORATORY_CONFIGS:
                expected_gen = EXPECTED_GENERATOR[cfg]  # cfg8 expects 'cfg7' (its actual generator)
                if gen_field != expected_gen:
                    invalid_reasons.append(
                        f"exploratory config {cfg} requires generator={expected_gen!r}, got {gen_field!r}")
                if expl_field is not True:
                    invalid_reasons.append(
                        f"exploratory config {cfg} requires exploratory=true, got {expl_field!r}")
                if cfg == "cfg8" and j.get("universe") != "largemid":
                    invalid_reasons.append(
                        f"cfg8 requires universe='largemid', got {j.get('universe')!r}")
            else:
                if gen_field not in (None, "bpp"):
                    invalid_reasons.append(
                        f"frozen config {cfg} requires generator in (None,'bpp'), got {gen_field!r}")
                if expl_field not in (None, False):
                    invalid_reasons.append(
                        f"frozen config {cfg} must not be exploratory, got exploratory={expl_field!r}")
                # defense-in-depth (step-4 review): symmetric universe check — a largemid/selective JSON
                # (generator=None+exploratory=None but universe='largemid') must never be filed as a frozen
                # cfg1-4 decision cell. frozen decision cells are all-universe.
                if j.get("universe") not in (None, "all"):
                    invalid_reasons.append(
                        f"frozen config {cfg} requires universe in (None,'all'), got {j.get('universe')!r}")
            for gate_name, verdict in (
                ("gate_a.verdict", ga.get("verdict")),
                ("gate_b.verdict", gb.get("verdict")),
                ("gate_c.verdict", gc.get("verdict")),
            ):
                if verdict not in VALID_GATE_VERDICTS:
                    invalid_reasons.append(f"{gate_name} must be one of {sorted(VALID_GATE_VERDICTS)}")
            # 무결성 cross-check(step-4 HIGH): frozen harness는 triple_gate_all_pass = (ga·gb·gc 전부 PASS)로
            # 강제한다(validate_tier0_ic.py). harvest JSON이 triple과 게이트 verdict가 불일치하면(예: triple=true인데
            # 게이트 FAIL/ADJUDICATE) silent false-PASS fail-open이 발생 → INVALID_INPUT으로 fail-closed.
            derived_triple = (ga.get("verdict") == "PASS" and gb.get("verdict") == "PASS"
                              and gc.get("verdict") == "PASS")
            if isinstance(triple_raw, bool) and triple_raw != derived_triple:
                invalid_reasons.append(
                    "triple_gate_all_pass가 게이트 verdict(ga/gb/gc 전부 PASS 여부)와 불일치 — harness 무결성 위반")
            # size-neutral skill CI (frozen rule iii) — per-horizon, 0을 배제하는지
            sleeve_ci = {h: (sp.get(h, {}) or {}).get("bpp_sleeve_excess_monthly_ci90") for h in HORIZONS}
            m[(cfg, reg)] = {
                "_missing": False,
                "_invalid": bool(invalid_reasons),
                "invalid_reasons": invalid_reasons,
                "months": (j.get("harvest", {}) or {}).get("months_analyzed"),
                "ga_verdict": ga.get("verdict"), "gb_verdict": gb.get("verdict"), "gc_verdict": gc.get("verdict"),
                "triple": triple_raw is True,
                "overall_recall": _num(ga.get("overall_recall")),
                "per_horizon_recall": {h: _num(per_horizon.get(h)) for h in HORIZONS},
                "random_ratio": _num(ga.get("random_ratio")),
                "largemid_recall": _num(ga.get("largemid_recall")),
                "binding_baseline_recall": _num(ga.get("binding_baseline_recall")),
                "baseline_equal_recall": _num(ga.get("baseline_equal_recall")),
                "leader_hits": ga.get("leader_hits_total"), "leader_total": ga.get("leader_total"),
                "ic_ir": _num(gb.get("ic_ir")), "ic_mean": _num(gb.get("ic_mean")),
                "baseline_equal_ic_ir": _num(gb.get("baseline_equal_ic_ir")),
                "small_fraction": _num(gc.get("small_fraction")),
                "ga_fails": ga.get("fails"), "gb_fails": gb.get("fails"),
                "sleeve_excess": {h: _num((sp.get(h, {}) or {}).get("bpp_excess_vs_own_sleeve")) for h in HORIZONS},
                "sleeve_ci": sleeve_ci,
                "sleeve_ci_excl0": {h: _ci_excludes_zero(sleeve_ci[h]) for h in HORIZONS},
                "parameter_lock_commit_hash": lock_hash,
                "freeze_tag": freeze_tag,
            }
    return m


def _input_issues_for_configs(m, configs):
    missing = [f"{cfg}_{reg}" for cfg in configs for reg in REGIMES if m[(cfg, reg)].get("_missing")]
    invalid = []
    for cfg in configs:
        for reg in REGIMES:
            cell = m[(cfg, reg)]
            if cell.get("_missing") or not cell.get("_invalid"):
                continue
            invalid.append({"run": f"{cfg}_{reg}", "reasons": cell.get("invalid_reasons", [])})
    return missing, invalid


def input_issues(m, *, include_exploratory=False):
    configs = CONFIGS if include_exploratory else DECISION_CONFIGS
    return _input_issues_for_configs(m, configs)


def exploratory_input_issues(m):
    return _input_issues_for_configs(m, RUNNABLE_EXPLORATORY_CONFIGS)


def invalid_result(lock_hash, missing, invalid):
    verdict = "INVALID_INPUT" if invalid else "INCOMPLETE_RUN"
    return {
        "parameter_lock_commit_hash": lock_hash,
        "freeze_tag": FREEZE_TAG,
        "verdict": verdict,
        "winners": [],
        "decision": (
            "입력 evidence가 누락/비정상이라 과학적 NO-CONFIG-PASSES 결론을 emit하지 않음. "
            "missing/invalid runs를 먼저 복구한 뒤 adjudicate 필요."
        ),
        "missing_runs": missing,
        "invalid_runs": invalid,
    }


def gate_a_summary(m, configs=DECISION_CONFIGS):
    rows = [(cfg, reg, m[(cfg, reg)]) for cfg in configs for reg in REGIMES
            if not m[(cfg, reg)].get("_missing") and not m[(cfg, reg)].get("_invalid")]
    horizon_rows = []
    for cfg, reg, cell in rows:
        for horizon, value in cell.get("per_horizon_recall", {}).items():
            if value is not None:
                horizon_rows.append((value, f"{cfg}_{reg}", horizon))

    def metric_extreme(key, fn):
        values = [(cell.get(key), f"{cfg}_{reg}") for cfg, reg, cell in rows if cell.get(key) is not None]
        if not values:
            return None
        value, run = fn(values, key=lambda item: item[0])
        return {"value": value, "run": run}

    def horizon_extreme(fn):
        if not horizon_rows:
            return None
        value, run, horizon = fn(horizon_rows, key=lambda item: item[0])
        return {"value": value, "run": run, "horizon": horizon}

    # 주의: 이 count는 _ci_excludes_zero(부호 무관 — 음수 CI도 True) 진단용. rule-iii 게이트(ci_ok)는
    # _ci_positive(strict lo>0&hi>0)를 쓴다 — 이 진단 count를 pass 조건으로 재배선 금지.
    ci_values = [cell["sleeve_ci_excl0"].get(h) for _, _, cell in rows for h in HORIZONS]
    return {
        "runs_loaded": len(rows),
        "all_gate_a_fail": len(rows) == len(configs) * len(REGIMES)
        and all(cell["ga_verdict"] == "FAIL" for _, _, cell in rows),
        "max_overall_recall": metric_extreme("overall_recall", max),
        "max_random_ratio": metric_extreme("random_ratio", max),
        "per_horizon_recall_min": horizon_extreme(min),
        "per_horizon_recall_max": horizon_extreme(max),
        "size_neutral_ci_excludes_zero_count": sum(value is True for value in ci_values),
        "size_neutral_ci_horizon_cells": sum(value is not None for value in ci_values),
    }


def artifact_audit(m):
    loaded = [(cfg, reg, m[(cfg, reg)]) for cfg in CONFIGS for reg in REGIMES
              if not m[(cfg, reg)].get("_missing")]
    missing_lock = [f"{cfg}_{reg}" for cfg, reg, cell in loaded
                    if not cell.get("parameter_lock_commit_hash")]
    missing_freeze = [f"{cfg}_{reg}" for cfg, reg, cell in loaded if not cell.get("freeze_tag")]
    return {
        "harvest_json_missing_parameter_lock_commit_hash": missing_lock,
        "harvest_json_missing_freeze_tag": missing_freeze,
        "note": "adjudicator requires every run JSON to carry the frozen lock hash and freeze tag.",
    }


def adjudicate(m, lock_hash):
    """FROZEN config-selection 규칙 적용. 각 비교는 같은 regime 내 config-1 baseline 대비."""
    per_config = {}
    for cfg in CONFIGS:
        regime_eval = {}
        for reg in REGIMES:
            cell = m[(cfg, reg)]
            base = m[("cfg1", reg)]
            if cfg in BLOCKED_CONFIGS:
                regime_eval[reg] = {
                    "pass": False,
                    "input_status": "blocked_offline",
                    "gates_all_pass": False,
                    "triple_field": cell.get("triple"),
                    "beats_baseline_recall_and_ic": None,
                    "size_neutral_all_positive_sig_ci": False,
                    "size_neutral_ci_excludes_0_all_horizons": False,
                    "reasons": ["offline PIT-safe universe-wide sector source 없음"],
                    "ga": cell.get("ga_verdict"), "gb": cell.get("gb_verdict"), "gc": cell.get("gc_verdict"),
                }
                continue
            if cell.get("_missing") or base.get("_missing"):
                regime_eval[reg] = {
                    "pass": False,
                    "input_status": "missing",
                    "gates_all_pass": False,
                    "triple_field": cell.get("triple"),
                    "beats_baseline_recall_and_ic": None,
                    "size_neutral_all_positive_sig_ci": False,
                    "size_neutral_ci_excludes_0_all_horizons": False,
                    "reasons": ["run missing"],
                    "ga": cell.get("ga_verdict"), "gb": cell.get("gb_verdict"), "gc": cell.get("gc_verdict"),
                }
                continue
            if cell.get("_invalid") or base.get("_invalid"):
                regime_eval[reg] = {
                    "pass": False,
                    "input_status": "invalid",
                    "gates_all_pass": False,
                    "triple_field": cell.get("triple"),
                    "beats_baseline_recall_and_ic": None,
                    "size_neutral_all_positive_sig_ci": False,
                    "size_neutral_ci_excludes_0_all_horizons": False,
                    "reasons": cell.get("invalid_reasons", []) or ["invalid run schema"],
                    "ga": cell.get("ga_verdict"), "gb": cell.get("gb_verdict"), "gc": cell.get("gc_verdict"),
                }
                continue
            # (ii) 삼중 게이트 — triple 불리언을 직접 신뢰하지 않고 게이트 verdict 3개로 판정(defense-in-depth).
            # load_matrix가 triple↔게이트 불일치를 이미 INVALID 처리하므로 일관 데이터에서 둘은 동치.
            gates_all_pass = (cell["ga_verdict"] == "PASS" and cell["gb_verdict"] == "PASS"
                              and cell["gc_verdict"] == "PASS")
            # (i) config-1 대비 recall AND IC IR 우위 (config1 자신은 baseline → 우위 N/A)
            if cfg == "cfg1":
                beats_baseline = None  # baseline 자신 — '우위' 개념 N/A
            else:
                cr, br = cell["overall_recall"], base["overall_recall"]
                ci_, bi = cell["ic_ir"], base["ic_ir"]
                beats_recall = (cr is not None and br is not None and cr > br)
                beats_ic = (ci_ is not None and bi is not None and ci_ > bi)
                beats_baseline = bool(beats_recall and beats_ic)
            # (iii) size-neutral skill: short/mid/long 3개 horizon CI가 '모두' 양(+)으로 0을 배제(ANY-of-3 cherry-pick 금지).
            # point-estimate(excess>0) 별도 AND 제거 — CI 부호로 직접 판정(부호 불일치로 인한 silent-drop 방지).
            ci_ok = all(_ci_positive(cell["sleeve_ci"].get(h)) for h in HORIZONS)
            ci_excludes_zero_all = all(cell["sleeve_ci_excl0"].get(h) is True for h in HORIZONS)
            reasons = []
            if not gates_all_pass:
                reasons.append("삼중 게이트(ga/gb/gc 전부 PASS) 미충족")
            if cfg != "cfg1" and not beats_baseline:
                reasons.append("config-1 대비 recall&IC 우위 아님")
            if not ci_ok:
                reasons.append("size-neutral skill CI(3 horizon 모두 양+) 미충족")
            regime_pass = bool(gates_all_pass and (beats_baseline if cfg != "cfg1" else True) and ci_ok)
            regime_eval[reg] = {
                "pass": regime_pass, "gates_all_pass": gates_all_pass, "triple_field": cell["triple"],
                "beats_baseline_recall_and_ic": beats_baseline,
                "size_neutral_all_positive_sig_ci": ci_ok,
                "size_neutral_ci_excludes_0_all_horizons": ci_excludes_zero_all,
                "reasons": reasons,
                "ga": cell["ga_verdict"], "gb": cell["gb_verdict"], "gc": cell["gc_verdict"],
            }
        # (iv) 모든 장세에서 통과
        all_regimes_pass = all(regime_eval[reg].get("pass") for reg in REGIMES)
        per_config[cfg] = {"label": CONFIGS[cfg], "all_regimes_pass": all_regimes_pass,
                           "exploratory": cfg in EXPLORATORY_CONFIGS,
                           "blocked_offline": cfg in BLOCKED_CONFIGS,
                           "by_regime": regime_eval}

    # winner = cfg1(baseline) 제외 + EXPLORATORY 제외 + 4조건×3장세 전부 충족. EXPLORATORY config는
    # decision-grade 자격 없음 — PASS여도 winner에 오르지 못한다(addendum: PASS-or-FAIL → no-apply).
    winners = [c for c in DECISION_CONFIGS
               if c != "cfg1" and per_config[c]["all_regimes_pass"]]
    exploratory_pass = [c for c in RUNNABLE_EXPLORATORY_CONFIGS
                        if c in per_config and per_config[c]["all_regimes_pass"]]
    if winners:
        verdict = "ADJUDICATE"
        decision = (f"winner candidate(s): {winners} — 모든 장세에서 config-1 대비 recall&IC 우위 + 삼중게이트 + "
                    f"size-neutral skill 3-horizon 양(+) 유의. 단 FROZEN 규칙 5 marginal(p) 증거가 harvest JSON에 "
                    f"없어 비-marginal PASS를 자동 인증할 수 없음 → ADJUDICATE, --apply/Tier1 금지.")
    else:
        verdict = "NO-CONFIG-PASSES"
        decision = ("어떤 config도 4개 조건 × 3개 장세 전부 충족 못 함 → FROZEN 규칙 5: "
                    "'Tier0는 leader-inclusive 깔때기, 예측 스킬 미검증' 확정 + no-apply "
                    "(--apply/Tier1/'상승 예측' claim 금지). diagnostic generator 유지.")
    return {
        "parameter_lock_commit_hash": lock_hash,
        "freeze_tag": FREEZE_TAG,
        "rule_iii_interpretation": "3-horizon ALL positive-significant CI (conservative; current run non-binding — Gate A fails all cells)",
        "rule_5_marginal": ("harvest JSON에 p-marginality 필드 없음 → winner 후보가 있어도 PASS 대신 ADJUDICATE로 "
                            "fail-closed. (일관 데이터에서 도달 불가했던 harness-ADJUDICATE 강등 분기는 제거; "
                            "triple↔게이트 불일치는 load_matrix INVALID_INPUT으로 fail-closed.)"),
        "verdict": verdict, "winners": winners, "decision": decision,
        "exploratory_pass": exploratory_pass,
        "blocked_configs": sorted(BLOCKED_CONFIGS),
        "exploratory_note": (
            "cfg5/cfg6/cfg7/cfg8 = EXPLORATORY/diagnostic-only 생성기. cfg5는 offline PIT-safe sector source 부재로 "
            "BLOCKED이며, runnable appendix는 cfg6/cfg7/cfg8이다. 'exploratory_pass'에 오른 config는 "
            "frozen 4조건을 충족했더라도 decision-grade winner가 아니며 --apply/Tier1/'상승 예측' 금지. "
            "decision-grade PASS는 별도 re-frozen expanded protocol + new holdout + family/alpha 보정 필요 "
            "(addendum: docs/superpowers/2026-06-17-tier0-cfg5-cfg6-exploratory-addendum.md)."
        ),
        "per_config": per_config,
    }
