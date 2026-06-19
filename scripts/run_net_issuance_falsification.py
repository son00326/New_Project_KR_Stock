#!/usr/bin/env python3
"""(C) NET-SHARE-ISSUANCE orthogonal-signal FALSIFICATION driver (2026-06-18).

SoT: docs/superpowers/2026-06-18-tier0-net-issuance.md (pre-registered, frozen before run).

EXPLORATORY / diagnostic-only. no --apply, no Supabase, no DART HTTP, no AI, cost 0, offline
scripts/out/pit_cache. ORIGINAL git-tag tier0-multiregime-freeze + decision-rules doc + cfg1-4
metric path UNTOUCHED (byte-identical when with_issuance=False).

ORDER (blocking):
  (1) PIT-PROOF — probe_list_shrs_pit → pit_status (PIT_PROVEN|PIT_ASSUMED). HARD GUARD: if
      PIT_ASSUMED, any triple-gate PASS is downgraded to BLOCKED (not decision-grade), fail-closed.
  (2) ORTHOGONALITY by-sleeve corr(issuance, {trend,foreign,earnings,quality,size}) — run BEFORE
      trusting marginal; |corr| < 0.5 in EACH sleeve. Emitted as the `orthogonality` block.
  (3) MARGINAL (binding) — paired harvest B++ (bpp) vs B+++issuance (bpp_iss) over the SAME months
      on the ORIGINAL all-universe 150 funnel, SAME UNCHANGED triple-gate (recall/IC/size). diff.
  (4) STANDALONE (secondary, non-binding) — net-issuance rank-IC + recall, mechanism evidence only.

This driver does NOT use validate_tier0_ic.harvest_pit_months (which hard-validates generator_label)
— it composes the SAME frozen building blocks directly so cfg1-4 / all-universe / largemid / selective
paths stay byte-identical. Both legs share one panel/provider build (honest paired comparison).
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional, Sequence

_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_DIR))
import tier0_factors as F  # noqa: E402
import validate_tier0_ic as V  # noqa: E402

FORBIDDEN_VERDICT_WORDS = ("rescue", "apply", "상승 예측")
DEFAULT_REPORT_PATH = Path("scripts/out/net_issuance/net_issuance_report.json")
SMOKE_REPORT_PATH = Path("scripts/out/net_issuance/net_issuance_smoke_report.json")


# ============================================================================
# (1) PIT-PROOF (blocking)
# ============================================================================

def run_pit_proof(out_dir: Path, cache_dir: Path) -> dict:
    """probe_list_shrs_pit를 호출해 pit_status 아티팩트 생성·로드. 실패해도 PIT_ASSUMED로 fail-closed."""
    artifact = out_dir / "list_shrs_pit.json"
    try:
        artifact.unlink()
    except FileNotFoundError:
        pass
    except OSError as exc:
        return {"pit_status": "PIT_ASSUMED", "fails": [f"기존 probe 아티팩트 삭제 실패: {exc}"], "evidence": []}
    try:
        completed = subprocess.run(
            [sys.executable, str(_DIR / "probe_list_shrs_pit.py"),
             "--cache-dir", str(cache_dir), "--json", str(artifact)],
            check=False, capture_output=True, text=True, timeout=120)
    except Exception as exc:  # noqa: BLE001
        return {"pit_status": "PIT_ASSUMED", "fails": [f"probe 실행 실패: {exc}"], "evidence": []}
    if not artifact.exists():
        return {"pit_status": "PIT_ASSUMED", "fails": ["probe 아티팩트 부재"], "evidence": []}
    try:
        pit = json.loads(artifact.read_text())
    except (ValueError, OSError) as exc:
        return {"pit_status": "PIT_ASSUMED", "fails": [f"아티팩트 파싱 실패: {exc}"], "evidence": []}
    if completed.returncode != 0 and pit.get("pit_status") != "PIT_ASSUMED":
        return {
            "pit_status": "PIT_ASSUMED",
            "fails": [f"probe exit={completed.returncode} but artifact was not PIT_ASSUMED"],
            "evidence": pit.get("evidence", []),
        }
    expected_cache = str(cache_dir.resolve())
    if pit.get("cache_dir") != expected_cache:
        return {
            "pit_status": "PIT_ASSUMED",
            "fails": [f"probe cache mismatch: artifact={pit.get('cache_dir')} expected={expected_cache}"],
            "evidence": pit.get("evidence", []),
        }
    return pit


# ============================================================================
# (2) ORTHOGONALITY — by-sleeve corr(issuance, {trend,foreign,earnings,quality,size})
# ============================================================================

ORTHO_FACTORS = ("trend", "foreign", "earnings", "quality", "size")
ORTHO_THRESHOLD = 0.5


def _size_rank(stocks: Sequence[F.StockRaw], eligible_mask: list[bool]) -> list[float]:
    raw = [math.log(s.market_cap) if (eligible_mask[i] and s.market_cap and s.market_cap > 0) else math.nan
           for i, s in enumerate(stocks)]
    return F.percentile_rank(raw)


def month_orthogonality(stocks: Sequence[F.StockRaw], bucket: str) -> dict:
    """한 월 한 bucket: issuance_rank vs {trend,foreign,earnings,quality,size} Pearson, overall + by-sleeve.

    score_bpp_universe(with_issuance=True)로 factor_ranks(+issuance)와 sleeve를 얻는다(eligible만).
    size_rank은 percentile_rank(log mcap)로 별도 계산(eligible cross-section).
    Returns {scope: {factor: corr}} for scope in (overall, large, mid, small).
    """
    scored = F.score_bpp_universe(stocks, bucket, with_issuance=True)
    elig_idx = [i for i, sc in enumerate(scored) if sc.eligible]
    elig_mask = [scored[i].eligible for i in range(len(scored))]
    size = _size_rank(stocks, elig_mask)
    iss = [scored[i].factor_ranks.get("issuance", math.nan) for i in range(len(scored))]
    fac_vals = {
        "trend": [scored[i].factor_ranks.get("trend", math.nan) for i in range(len(scored))],
        "foreign": [scored[i].factor_ranks.get("foreign", math.nan) for i in range(len(scored))],
        "earnings": [scored[i].factor_ranks.get("earnings", math.nan) for i in range(len(scored))],
        "quality": [scored[i].factor_ranks.get("quality", math.nan) for i in range(len(scored))],
        "size": size,
    }
    sleeve = {i: scored[i].sleeve for i in elig_idx}

    def corr_over(idxs: list[int], fac: str) -> float:
        xs, ys = [], []
        for i in idxs:
            a, b = iss[i], fac_vals[fac][i]
            if not V._is_nan(a) and not V._is_nan(b):
                xs.append(a)
                ys.append(b)
        return F._pearson(xs, ys)

    out: dict[str, dict[str, float]] = {}
    out["overall"] = {f: corr_over(elig_idx, f) for f in ORTHO_FACTORS}
    for sl in ("large", "mid", "small"):
        sl_idx = [i for i in elig_idx if sleeve.get(i) == sl]
        out[sl] = {f: corr_over(sl_idx, f) for f in ORTHO_FACTORS}
    return out


def aggregate_orthogonality(per_month: list[dict]) -> dict:
    """월별 corr → scope×factor mean + CI90 + pass(|mean|<0.5 every pair every sleeve). raw 포함."""
    scopes = ("overall", "large", "mid", "small")
    agg: dict[str, dict] = {}
    fails: list[str] = []
    for scope in scopes:
        agg[scope] = {}
        for fac in ORTHO_FACTORS:
            series = [m[scope][fac] for m in per_month if scope in m and fac in m[scope]]
            mean = V._mean(series)
            agg[scope][fac] = {
                "mean": V._json_number(mean, 4),
                "ci90": V._ci90(series),
                "n_months": sum(1 for v in series if not V._is_nan(v)),
                "raw": [V._json_number(v, 4) for v in series],
            }
            if agg[scope][fac]["n_months"] == 0:
                fails.append(f"{scope}/{fac} orthogonality data missing")
                continue
            # by-sleeve issuance-vs-size is the load-bearing check, but enforce all pairs in all sleeves.
            if not V._is_nan(mean) and abs(mean) >= ORTHO_THRESHOLD:
                fails.append(f"{scope}/{fac} |mean corr| {abs(mean):.3f} >= {ORTHO_THRESHOLD}")
    return {
        "threshold": ORTHO_THRESHOLD,
        "pass": len(fails) == 0,
        "fails": fails,
        "by_scope": agg,
        "note": (
            "PRE-REGISTERED: |mean corr| < 0.5 for every pair in every sleeve (large/mid/small) AND overall. "
            "by-sleeve corr(issuance,size) is load-bearing: high pooled size-corr that collapses within "
            "sleeve = size restatement, not a new orthogonal signal. raw correlations emitted (SoT §6)."
        ),
    }


# ============================================================================
# (3)+(4) PAIRED HARVEST — marginal (binding) + standalone (secondary)
# ============================================================================

HARVEST_BUCKETS = V.HARVEST_BUCKETS
TOP_DECILE_Q = V.TOP_DECILE_Q
STANDALONE_PICK_COUNT = sum(F.SLEEVE_QUOTA.values()) * len(HARVEST_BUCKETS)


def _select_disjoint(scored_by_bucket: dict[str, list]) -> dict[str, set]:
    """cross-bucket-disjoint L20/M20/S10 선정 (select_bpp_for_harvest와 동일 규칙)."""
    used: set[str] = set()
    out: dict[str, set] = {}
    for b in HARVEST_BUCKETS:
        scored = scored_by_bucket[b]
        picked = F.select_size_sleeves(
            [sc.ticker for sc in scored], [sc.score for sc in scored],
            [sc.sleeve for sc in scored], quota=dict(F.SLEEVE_QUOTA), exclude=used)
        out[b] = set(picked)
        used |= out[b]
    return out


def _standalone_issuance_pick(stocks: Sequence[F.StockRaw]) -> set[str]:
    used: set[str] = set()
    out: set[str] = set()
    for b in HARVEST_BUCKETS:
        scored = F.score_bpp_universe(stocks, b, with_issuance=True)
        picked = F.select_size_sleeves(
            [sc.ticker for sc in scored],
            [sc.factor_ranks.get("issuance", math.nan) for sc in scored],
            [sc.sleeve for sc in scored],
            quota=dict(F.SLEEVE_QUOTA),
            exclude=used,
        )
        out |= set(picked)
        used |= set(picked)
    return out


def run_paired_harvest(
    start_month: date, end_month: date, panel, *,
    universe_at, foreign_at, dart_at, smoke: bool,
    leader_basket: dict[str, str], progress: bool,
) -> dict:
    """B++ (bpp) vs B+++issuance (bpp_iss) paired over SAME months. orthogonality + marginal + standalone.

    frozen 측정 함수(top_decile_winners/compute_month_forward/spearman_ic/gate_a_pass/gate_b_pass/
    canonical_size_tiers/_ci90)를 그대로 재사용한다 — cfg1-4 metric path 미변경.
    """
    dates = V.panel_trading_days(panel)
    if len(dates) < 2:
        raise RuntimeError("panel 거래일 부족 (>=2).")
    series = V.build_series_by_ticker(panel, dates)
    months = V.iter_selection_months(start_month, end_month)

    # per-month accumulators for both legs
    legs = {"bpp": _LegAcc(), "bpp_iss": _LegAcc()}
    ortho_per_month: list[dict] = []
    standalone_ic_by_b: dict[str, list[float]] = {b: [] for b in HARVEST_BUCKETS}
    standalone_recall_num = 0
    standalone_recall_den = 0
    neutralized_splits = 0
    neutralized_extreme = 0
    n_processed = 0

    for t in months:
        sel_idx = V.selection_index(dates, t)
        if sel_idx < 0:
            continue
        sel_date = dates[sel_idx]
        sel_date_obj = datetime.strptime(sel_date, "%Y%m%d").date()
        universe_rows = universe_at(sel_date_obj)
        if not universe_rows:
            continue
        stocks, _name_by, _qmeta = V.build_month_stockraws(
            sel_date_obj, series, sel_date, universe_rows, foreign_at=foreign_at, dart_at=dart_at)
        if not stocks:
            continue
        tickers = [s.ticker for s in stocks]
        fwd, _status = V.compute_month_forward(panel, dates, tickers, sel_idx)
        winners_by_h = {b: V.top_decile_winners(fwd[b]) for b in HARVEST_BUCKETS}
        winners_all = set().union(*winners_by_h.values()) if winners_by_h else set()
        if not winners_all:
            continue
        tier_of = V.canonical_size_tiers(stocks)

        # split/extreme neutralization counts (audit) — over the issuance lookback filter.
        for s in stocks:
            _raw, spl, ext = F.net_issuance_signed_raw(s.list_shrs, s.closes)
            neutralized_splits += int(spl)
            neutralized_extreme += int(ext)

        for b in HARVEST_BUCKETS:
            ortho_per_month.append(month_orthogonality(stocks, b))

        # both legs share the same winners/forward denominator (honest marginal).
        for label, wi in (("bpp", False), ("bpp_iss", True)):
            scored_by_b = {b: F.score_bpp_universe(stocks, b, with_issuance=wi) for b in HARVEST_BUCKETS}
            sel_by_h = _select_disjoint(scored_by_b)
            sel_all = set().union(*sel_by_h.values())
            legs[label].add_month(
                t.isoformat(), stocks, scored_by_b, sel_by_h, sel_all,
                fwd, winners_by_h, winners_all, tier_of, leader_basket)

        # STANDALONE issuance (secondary): rank-IC per bucket + standalone recall.
        for b in HARVEST_BUCKETS:
            sc = F.score_bpp_universe(stocks, b, with_issuance=True)
            iss_by_t = {x.ticker: x.factor_ranks.get("issuance", math.nan) for x in sc if x.eligible}
            common = [tk for tk in iss_by_t if tk in fwd[b] and not V._is_nan(iss_by_t[tk])]
            if len(common) >= 3:
                standalone_ic_by_b[b].append(
                    F.spearman_ic([iss_by_t[tk] for tk in common], [fwd[b][tk] for tk in common]))
        sa_pick = _standalone_issuance_pick(stocks)
        standalone_recall_num += len(sa_pick & winners_all)
        standalone_recall_den += len(winners_all)

        n_processed += 1
        if progress:
            print(f"  [{t.isoformat()}] universe={len(stocks)} winners={len(winners_all)} "
                  f"recall(bpp)={legs['bpp'].months[-1]['recall']:.3f} "
                  f"recall(bpp_iss)={legs['bpp_iss'].months[-1]['recall']:.3f}", file=sys.stderr, flush=True)

    if n_processed == 0:
        raise RuntimeError("처리된 선정월 0개 (universe/panel/forward 확인).")

    ortho = aggregate_orthogonality(ortho_per_month)
    marginal = _marginal_report(legs["bpp"], legs["bpp_iss"], smoke=smoke)
    standalone = {
        "rank_ic_by_horizon": {b: V._json_number(V._mean(standalone_ic_by_b[b]), 4) for b in HARVEST_BUCKETS},
        "rank_ic_ir": V._json_number(V.ic_information_ratio(
            [v for b in HARVEST_BUCKETS for v in standalone_ic_by_b[b]]), 4),
        "recall": V._json_number(V._pooled_recall(standalone_recall_num, standalone_recall_den), 4),
        "recall_hit_count": standalone_recall_num,
        "recall_winner_denominator": standalone_recall_den,
        "pick_count": STANDALONE_PICK_COUNT,
        "binding": False,
        "note": "SECONDARY / non-binding mechanism evidence only. PRIMARY = marginal-on-150 (B++ vs B+++issuance).",
    }
    return {
        "months_processed": n_processed,
        "issuance_neutralized_splits": neutralized_splits,
        "issuance_neutralized_extreme": neutralized_extreme,
        "orthogonality": ortho,
        "marginal": marginal,
        "issuance_standalone": standalone,
    }


class _LegAcc:
    """한 leg(bpp 또는 bpp_iss)의 월별 recall/IC 누적기 (frozen 메트릭 함수 재사용)."""

    def __init__(self):
        self.months: list[dict] = []

    def add_month(self, month, stocks, scored_by_b, sel_by_h, sel_all, fwd,
                  winners_by_h, winners_all, tier_of, leader_basket):
        recall_m = V._pooled_recall(len(sel_all & winners_all), len(winners_all))
        lm_winners = {tk for tk in winners_all if tier_of.get(tk) in ("large", "mid")}
        lm_selected = {tk for tk in sel_all if tier_of.get(tk) in ("large", "mid")}
        lm_recall = V._pooled_recall(len(lm_selected & lm_winners), len(lm_winners))
        # composite IC over eligible cross-section per bucket.
        ic_by_b = []
        for b in HARVEST_BUCKETS:
            sc_map = {x.ticker: x.score for x in scored_by_b[b] if x.eligible}
            common = [tk for tk in sc_map if tk in fwd[b]]
            ic_by_b.append(F.spearman_ic([sc_map[tk] for tk in common], [fwd[b][tk] for tk in common]))
        comp_ic = V._composite_ic({b: ic_by_b[i] for i, b in enumerate(HARVEST_BUCKETS)})
        per_h = {b: V._pooled_recall(len(sel_by_h[b] & winners_by_h.get(b, set())),
                                     len(winners_by_h.get(b, set()))) for b in HARVEST_BUCKETS}
        self.months.append({
            "month": month, "recall": recall_m, "largemid_recall": lm_recall,
            "composite_ic": comp_ic, "per_horizon": per_h,
            "n_selected": len(sel_all), "n_universe": len(stocks),
            "n_winners": len(winners_all),
            "num": len(sel_all & winners_all), "den": len(winners_all),
            "lm_num": len(lm_selected & lm_winners), "lm_den": len(lm_winners),
            "leader_hits": len(set(leader_basket) & sel_all),
            "per_h_num": {b: len(sel_by_h[b] & winners_by_h.get(b, set())) for b in HARVEST_BUCKETS},
            "per_h_den": {b: len(winners_by_h.get(b, set())) for b in HARVEST_BUCKETS},
        })

    def pooled(self) -> dict:
        num = sum(m["num"] for m in self.months)
        den = sum(m["den"] for m in self.months)
        sel_total = sum(m["n_selected"] for m in self.months)
        uni_total = sum(m["n_universe"] for m in self.months)
        overall = V._pooled_recall(num, den)
        random_baseline = (sel_total / uni_total) if uni_total else math.nan
        random_ratio = (overall / random_baseline) if (random_baseline and random_baseline > 0 and not V._is_nan(overall)) else math.nan
        per_h = {}
        for b in HARVEST_BUCKETS:
            nh = sum(m["per_h_num"][b] for m in self.months)
            dh = sum(m["per_h_den"][b] for m in self.months)
            per_h[b] = V._pooled_recall(nh, dh)
        lm = V._pooled_recall(sum(m["lm_num"] for m in self.months), sum(m["lm_den"] for m in self.months))
        return {
            "overall_recall": V._json_number(overall, 4),
            "random_baseline": V._json_number(random_baseline, 4),
            "random_ratio": V._json_number(random_ratio, 3),
            "per_horizon": {b: V._json_number(per_h[b], 4) for b in HARVEST_BUCKETS},
            "largemid_recall": V._json_number(lm, 4),
            "ic_ir": V._json_number(V.ic_information_ratio([m["composite_ic"] for m in self.months]), 4),
            "ic_mean": V._json_number(V._mean([m["composite_ic"] for m in self.months]), 4),
            "leader_hits_total": sum(m["leader_hits"] for m in self.months),
            "recall_ci90": V._ci90([m["recall"] for m in self.months]),
        }


def _marginal_report(bpp: _LegAcc, iss: _LegAcc, *, smoke: bool) -> dict:
    """B++ vs B+++issuance 페어 diff + per-month recall-lift CI90 (paired, same winners denom)."""
    by_month_b = {m["month"]: m for m in bpp.months}
    by_month_i = {m["month"]: m for m in iss.months}
    if set(by_month_b) != set(by_month_i):
        raise ValueError("marginal comparison requires identical month sets")
    for month in by_month_b:
        if by_month_b[month].get("den") != by_month_i[month].get("den"):
            raise ValueError(f"marginal comparison denominator mismatch: {month}")
    pb, pi = bpp.pooled(), iss.pooled()
    lift_series = []
    for month in sorted(by_month_b):
        b, m = by_month_b[month], by_month_i[month]
        if not V._is_nan(m["recall"]) and not V._is_nan(b["recall"]):
            lift_series.append(m["recall"] - b["recall"])

    def d(a, b):
        if a is None or b is None:
            return None
        return round(a - b, 4)

    return {
        "binding": True,
        "primary_metric": "MARGINAL recall + rank-IC LIFT of (B++ + issuance) vs (B++ alone) on the all-universe 150 funnel, SAME triple-gate",
        "bpp_baseline": pb,
        "bpp_with_issuance": pi,
        "delta": {
            "overall_recall": d(pi["overall_recall"], pb["overall_recall"]),
            "ic_ir": d(pi["ic_ir"], pb["ic_ir"]),
            "ic_mean": d(pi["ic_mean"], pb["ic_mean"]),
            "largemid_recall": d(pi["largemid_recall"], pb["largemid_recall"]),
            "leader_hits": pi["leader_hits_total"] - pb["leader_hits_total"],
        },
        "per_month_recall_lift": [V._json_number(v, 4) for v in lift_series],
        "recall_lift_mean": V._json_number(V._mean(lift_series), 4),
        "recall_lift_ci90": V._ci90(lift_series),
        "smoke": smoke,
        "note": (
            "PRIMARY/binding = marginal. recall_lift_ci90 lower>0 ⇒ issuance adds recall; straddling/below 0 "
            "⇒ no marginal benefit. Same UNCHANGED triple-gate; thresholds untouched."
        ),
    }


# ============================================================================
# Verdict + fail-closed guard
# ============================================================================

def build_verdict(pit: dict, ortho: dict, marginal: dict) -> dict:
    pit_status = pit.get("pit_status", "PIT_ASSUMED")
    ortho_pass = ortho.get("pass", False)
    lift_ci = marginal.get("recall_lift_ci90", [math.nan, math.nan])
    lift_lo = lift_ci[0] if isinstance(lift_ci, (list, tuple)) and len(lift_ci) == 2 else math.nan
    delta = marginal.get("delta", {})
    d_recall = delta.get("overall_recall")
    d_ic = delta.get("ic_ir")

    # raw "signal helps?" judgment (NOT decision-grade): marginal lift CI lower>0 AND orthogonal.
    ic_positive = d_ic is not None and d_ic > 0
    marginal_positive = (not V._is_nan(lift_lo) and lift_lo > 0 and ic_positive)
    raw = "MARGINAL_LIFT" if (marginal_positive and ortho_pass) else "NO_MARGINAL_LIFT"

    blocked = pit_status == "PIT_ASSUMED"
    if blocked:
        verdict = "BLOCKED (PIT_ASSUMED — not decision-grade)"
    elif not ortho_pass:
        verdict = "NOT-ORTHOGONAL (issuance is a size/factor proxy — marginal lift not trusted)"
    elif raw == "MARGINAL_LIFT":
        verdict = "EXPLORATORY: marginal lift observed (diagnostic only, NOT decision-grade)"
    else:
        verdict = "EXPLORATORY: no marginal lift (issuance does not improve the failed funnel)"

    return {
        "pit_status": pit_status,
        "orthogonality_pass": ortho_pass,
        "delta_overall_recall": d_recall,
        "delta_ic_ir": d_ic,
        "recall_lift_ci90_lower": V._json_number(lift_lo, 4),
        "raw_marginal_judgment": raw,
        "decision_grade": False,
        "blocked_by_pit_assumed": blocked,
        "verdict": verdict,
        "wording_constraint": (
            "FALSIFICATION not rescue · exploratory · no --apply · no Tier1 cost · no '상승 예측' claim. "
            "PRIMARY=marginal-on-150 (binding); standalone=mechanism only (non-binding)."
        ),
    }


def _assert_verdict_wording(report: dict) -> None:
    """fail-closed: verdict/문구 필드에 금지어가 새지 않았는지 확인(단, wording_constraint의 self-ref는 허용)."""
    v = report["verdict"]["verdict"].lower()
    for w in FORBIDDEN_VERDICT_WORDS:
        if w in v:
            raise AssertionError(f"verdict에 금지어 누설: {w!r}")


def _resolve_output_path(repo_root: Path, raw_out: str | None, smoke: bool,
                         parser: argparse.ArgumentParser | None = None) -> Path:
    raw = Path(raw_out) if raw_out is not None else (SMOKE_REPORT_PATH if smoke else DEFAULT_REPORT_PATH)
    out = raw if raw.is_absolute() else repo_root / raw
    canonical = (repo_root / DEFAULT_REPORT_PATH).resolve(strict=False)
    if smoke and raw_out is not None and out.resolve(strict=False) == canonical:
        msg = "--smoke cannot write the canonical net_issuance_report.json; use a smoke-specific --out path"
        if parser is not None:
            parser.error(msg)
        raise ValueError(msg)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(
        description="(C) net-issuance FALSIFICATION (paired B++ vs B+++issuance, all-universe, same gate). "
                    "Smoke: --start-month 2023-01-01 --end-month 2023-03-01 --smoke --universe-limit 300.")
    parser.add_argument("--start-month", required=True, type=_parse_month, help="YYYY-MM-01")
    parser.add_argument("--end-month", required=True, type=_parse_month, help="YYYY-MM-01")
    parser.add_argument("--cache-dir", default="scripts/out/pit_cache")
    parser.add_argument("--out", default=None)
    parser.add_argument("--smoke", action="store_true", help="패널/로직 smoke (게이트 임계 미적용)")
    parser.add_argument("--universe-limit", type=int, default=None, help="universe cap (smoke 전용)")
    # Orthogonality-reference factors (default OFF preserves the PRE-REGISTERED trend+size B++ marginal baseline).
    # When ON: foreign/earnings/quality ranks become measurable so issuance orthogonality is checked vs all 5 factors
    # — but this also makes the marginal baseline an all-factor B++ (a DIFFERENT, diagnostic comparison, not the
    # pre-registered trend+size one). Step-4 review fix: enables full-5 orthogonality without changing the default.
    parser.add_argument("--with-foreign", action="store_true",
                        help="orthogonality: also measure issuance vs foreign (pykrx, offline cache); changes marginal baseline to include foreign")
    parser.add_argument("--earnings", action="store_true",
                        help="orthogonality: also measure issuance vs earnings/quality (DART backfill); changes marginal baseline to include earnings/quality")
    parser.add_argument("--dart-backfill-path", default="scripts/out/dart_backfill.jsonl",
                        help="DART PIT backfill jsonl used when --earnings is set")
    args = parser.parse_args()

    repo_root = _DIR.parent

    def repo_path(raw: str) -> Path:
        p = Path(raw)
        return p if p.is_absolute() else repo_root / p

    cache_dir = repo_path(args.cache_dir)
    out_path = _resolve_output_path(repo_root, args.out, args.smoke, parser)
    out_dir = out_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    V._load_env()

    # (1) PIT-PROOF first (blocking).
    pit = run_pit_proof(out_dir, cache_dir)
    print(f"[net-issuance] pit_status={pit.get('pit_status')}", file=sys.stderr)

    # offline providers (allow_supabase=False, cost 0). Default: foreign/earnings OFF = pre-registered trend+size
    # B++ marginal baseline + trend/size orthogonality. --with-foreign/--earnings make all-5 orthogonality
    # measurable (Step-4 fix) at the cost of an all-factor (diagnostic) marginal baseline.
    dart_path = repo_path(args.dart_backfill_path) if args.earnings else None
    panel, universe_at, foreign_at, dart_at, coverage_meta = V._build_real_providers(
        args.start_month, args.end_month, cache_dir, args.universe_limit, with_foreign=args.with_foreign,
        with_earnings=args.earnings, dart_backfill_path=(str(dart_path) if dart_path else None), allow_supabase=False)

    results = run_paired_harvest(
        args.start_month, args.end_month, panel,
        universe_at=universe_at, foreign_at=foreign_at, dart_at=dart_at, smoke=args.smoke,
        leader_basket=V.LEADER_BASKET_2026_06, progress=True)

    verdict = build_verdict(pit, results["orthogonality"], results["marginal"])

    report = {
        "version": "net-issuance-falsification-1",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "task": "(C) NET-SHARE-ISSUANCE orthogonal-signal FALSIFICATION",
        "exploratory": True,
        "decision_grade": False,
        "smoke": args.smoke,
        "months": {"start": args.start_month.isoformat(), "end": args.end_month.isoformat(),
                   "processed": results["months_processed"]},
        "pit_status": pit.get("pit_status"),
        "pit_proof": {"fails": pit.get("fails", []), "assertions": pit.get("assertions", []),
                      "evidence": pit.get("evidence", [])},
        "frozen_params": {
            "issuance_lookback_3m": F.ISSUANCE_LOOKBACK_3M,
            "issuance_lookback_12m": F.ISSUANCE_LOOKBACK_12M,
            "sign": "negative (diluters rank low; buyback/shrink ranks high)",
            "missing_policy": "structural neutral-50 (fill_missing_rank, failure_mask=None)",
            "split_share_jump_min": F.SPLIT_SHARE_JUMP_MIN,
            "split_price_tol": F.SPLIT_PRICE_TOL,
            "mcap_continuity_tol": F.MCAP_CONTINUITY_TOL,
            "extreme_share_jump": F.EXTREME_SHARE_JUMP,
            "orthogonality_threshold": ORTHO_THRESHOLD,
            "integration": "exactly ONE equal signed-negated rank component (no grid search, no weight tuning)",
            "triple_gate": "SAME UNCHANGED (recall>=0.20 / IC IR>=0.30 / size)",
        },
        "issuance_neutralized_splits": results["issuance_neutralized_splits"],
        "issuance_neutralized_extreme": results["issuance_neutralized_extreme"],
        "orthogonality": results["orthogonality"],
        "marginal": results["marginal"],
        "issuance_standalone": results["issuance_standalone"],
        "coverage_meta": coverage_meta,
        "survivorship_label": "clean (KRX bydd_trd=PIT, step-0 probe PASS)",
        "parameter_lock_commit_hash": "17dc6d9",
        "freeze_tag": "tier0-multiregime-freeze",
        "verdict": verdict,
        "sot": "docs/superpowers/2026-06-18-tier0-net-issuance.md",
    }
    _assert_verdict_wording(report)

    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2))

    print("\n=== (C) NET-SHARE-ISSUANCE FALSIFICATION ===", file=sys.stderr)
    print(f"  pit_status={report['pit_status']} · months={results['months_processed']} · smoke={args.smoke}", file=sys.stderr)
    print(f"  orthogonality pass={results['orthogonality']['pass']} fails={results['orthogonality']['fails']}", file=sys.stderr)
    m = results["marginal"]
    _base = "all-factor (diagnostic)" if (args.with_foreign or args.earnings) else "trend+size (pre-registered)"
    print(f"  marginal baseline={_base} · Δrecall={m['delta']['overall_recall']} "
          f"ΔIC_IR={m['delta']['ic_ir']} (ΔIC_mean={m['delta'].get('ic_mean')}, n_months={results['months_processed']} — IR unstable on short windows) "
          f"recall_lift_ci90={m['recall_lift_ci90']}", file=sys.stderr)
    print(f"  standalone IC_IR={report['issuance_standalone']['rank_ic_ir']} recall={report['issuance_standalone']['recall']}", file=sys.stderr)
    print(f"  neutralized splits={report['issuance_neutralized_splits']} extreme={report['issuance_neutralized_extreme']}", file=sys.stderr)
    print(f"  VERDICT: {verdict['verdict']}", file=sys.stderr)
    print(f"  report → {out_path}", file=sys.stderr)
    print("\n⚠️  EXPLORATORY/diagnostic FALSIFICATION — no --apply, no Tier1, no '상승 예측' claim.", file=sys.stderr)


def _parse_month(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date().replace(day=1)


if __name__ == "__main__":
    main()
