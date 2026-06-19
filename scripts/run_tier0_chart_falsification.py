#!/usr/bin/env python3
"""(D) CHART/TECHNICAL-INDICATOR COMPOSITE FALSIFICATION driver (2026-06-18).

SoT: docs/superpowers/2026-06-18-tier0-chart-technical.md (pre-registered, frozen before run).

EXPLORATORY / diagnostic-only. no --apply, no Supabase, no DART HTTP, no AI, cost 0, cache-only
scripts/out/pit_cache. ORIGINAL git-tag tier0-multiregime-freeze + decision-rules doc + cfg1-4
metric path unchanged by this D driver. Chart indicators live in tier0_chart.py (standalone read-only
consumer). validate_tier0_ic.py consumed IMPORT-ONLY.

ORDER (blocking, mirrors (C)):
  (1) KILL-SWITCH (PRIMARY, runs FIRST, gates everything) — by-sleeve + by-month corr(chart_rank,
      {trend, full_bpp[largemid/top-50 context], size, foreign(BLOCKED/OFF),
      cfg7(N/A by construction)}). FROZEN FAIL RULE: FIRES if for trend OR full_bpp ANY scope in ANY
      regime has |mean corr| >= 0.5 OR corr CI90 UPPER crosses 0.5. Kill-switch result IS the headline.
  (2) SELECTOR (runs ONLY if kill-switch PASSES) — chart-composite-as-SELECTOR top-50 on large+mid,
      recall-LIFT vs same-count random + rank-IC IR co-gate. REUSES the (가) selective-largemid framing
      VERBATIM (V.gate_a_pass_selective_largemid + V._ci90).
  (3) SECONDARY (non-binding) — marginal B++ vs chart on largemid-50 + direct chart-vs-(가)-B++.
  (4) DIAGNOSTICS — sub-indicator pairwise corr + leave-one-out recall (diagnostic only, NO removal).

This driver does NOT use validate_tier0_ic.harvest_pit_months / process_month — it re-implements the
same deterministic pooled-top-N sort + recall-lift + V.gate_a_pass_selective_largemid call (composing
frozen building blocks) without editing cfg1-4 / all-universe / largemid / selective paths.
"""
from __future__ import annotations

import argparse
import math
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional, Sequence

_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_DIR))
import tier0_factors as F  # noqa: E402
import tier0_chart as Ch  # noqa: E402
import validate_tier0_ic as V  # noqa: E402

# PRE-REGISTERED fail wording forbidden tokens (SoT §7).
FORBIDDEN_VERDICT_WORDS = ("rescue", "apply", "상승 예측")
DEFAULT_REPORT_PATH = Path("scripts/out/chart_technical/chart_technical_report.json")
SMOKE_REPORT_PATH = Path("scripts/out/chart_technical/chart_technical_smoke_report.json")

HARVEST_BUCKETS = V.HARVEST_BUCKETS
ADJUDICATED_N = 50
SENSITIVITY_N = (30, 75)

# Kill-switch (SoT §4).
KILL_FACTORS = ("trend", "full_bpp", "size", "foreign", "cfg7")
KILL_PRIMARY = ("trend", "full_bpp")  # only these two are binding fire triggers
KILL_THRESHOLD = 0.5


# ============================================================================
# (1) KILL-SWITCH — by-sleeve + by-month corr(chart, {trend, full_bpp, size, foreign, cfg7})
# ============================================================================

def _size_rank(stocks: Sequence[F.StockRaw], eligible_mask: list[bool]) -> list[float]:
    raw = [math.log(s.market_cap) if (eligible_mask[i] and s.market_cap and s.market_cap > 0) else math.nan
           for i, s in enumerate(stocks)]
    return F.percentile_rank(raw)


def month_killswitch(stocks: Sequence[F.StockRaw], bucket: str, *, with_foreign: bool) -> dict:
    """One month × bucket: corr(chart_composite_rank, X) overall + by-sleeve over eligible cross-section.

    chart eligibility == B++ eligibility (same liquidity floor) → identical eligible set. We anchor the
    cross-section on the CHART scored objects' eligibility (the selector universe) and read trend/full_bpp
    from the B++ scorer for the SAME tickers. cfg7 is N/A by construction (not a B++ factor_rank).
    Returns {scope: {factor: corr|None(N/A)}} for scope in (overall, large, mid, small).
    """
    chart = Ch.score_chart_universe(stocks, bucket)
    bpp = F.score_bpp_universe(stocks, bucket)
    bpp_by_t = {sc.ticker: sc for sc in bpp}

    elig_idx = [i for i, sc in enumerate(chart) if sc.eligible]
    elig_mask = [chart[i].eligible for i in range(len(chart))]
    size = _size_rank(stocks, elig_mask)

    chart_rank = [chart[i].score for i in range(len(chart))]
    trend = [bpp_by_t[stocks[i].ticker].factor_ranks.get("trend", math.nan) for i in range(len(chart))]
    full_bpp = [bpp_by_t[stocks[i].ticker].score for i in range(len(chart))]
    foreign = [bpp_by_t[stocks[i].ticker].factor_ranks.get("foreign", math.nan) for i in range(len(chart))]
    sleeve = {i: chart[i].sleeve for i in elig_idx}

    fac_vals = {"trend": trend, "full_bpp": full_bpp, "size": size}
    if with_foreign:
        fac_vals["foreign"] = foreign

    def corr_over(idxs: list[int], fac: str) -> float:
        xs, ys = [], []
        for i in idxs:
            a, b = chart_rank[i], fac_vals[fac][i]
            if not V._is_nan(a) and not V._is_nan(b):
                xs.append(a)
                ys.append(b)
        return F._pearson(xs, ys)

    out: dict[str, dict[str, float]] = {}
    measurable = list(fac_vals)
    out["overall"] = {f: corr_over(elig_idx, f) for f in measurable}
    for sl in ("large", "mid", "small"):
        sl_idx = [i for i in elig_idx if sleeve.get(i) == sl]
        out[sl] = {f: corr_over(sl_idx, f) for f in measurable}
    return out


def aggregate_killswitch(per_month: list[dict], *, with_foreign: bool) -> dict:
    """Per-month corr → scope×factor mean + CI90 + FIRE rule. FIRES on trend/full_bpp only."""
    scopes = ("overall", "large", "mid", "small")
    measurable = ["trend", "full_bpp", "size"] + (["foreign"] if with_foreign else [])
    agg: dict[str, dict] = {}
    fire_reasons: list[str] = []
    block_reasons: list[str] = []
    for scope in scopes:
        agg[scope] = {}
        for fac in KILL_FACTORS:
            if fac == "cfg7":
                agg[scope][fac] = {"status": "N/A", "note": "cfg7 surge is not a B++ factor_rank in this composition (N/A, not a failure)"}
                continue
            if fac == "foreign" and not with_foreign:
                agg[scope][fac] = {"status": "BLOCKED/OFF", "note": "foreign unavailable (no --with-foreign); MUST NOT block trend/full_bpp/size"}
                continue
            series = [m[scope][fac] for m in per_month if scope in m and fac in m[scope]]
            mean = V._mean(series)
            ci90 = V._ci90(series)
            ci_upper = ci90[1] if isinstance(ci90, (list, tuple)) and len(ci90) == 2 else math.nan
            n_samples = sum(1 for v in series if not V._is_nan(v))
            agg[scope][fac] = {
                "mean": V._json_number(mean, 4),
                "ci90": ci90,
                "n_samples": n_samples,
                "sample_unit": "bucket_month",
                "raw": [V._json_number(v, 4) for v in series],
            }
            if fac in KILL_PRIMARY and n_samples == 0:
                block_reasons.append(f"{scope}/{fac} has no measurable bucket-month samples")
            if fac in KILL_PRIMARY and n_samples > 0:
                if not V._is_nan(mean) and abs(mean) >= KILL_THRESHOLD:
                    fire_reasons.append(f"{scope}/{fac} |mean corr| {abs(mean):.3f} >= {KILL_THRESHOLD}")
                elif not V._is_nan(ci_upper) and ci_upper >= KILL_THRESHOLD:
                    fire_reasons.append(f"{scope}/{fac} corr CI90 upper {ci_upper:.3f} crosses {KILL_THRESHOLD}")
    fired = len(fire_reasons) > 0
    blocked = (not fired) and len(block_reasons) > 0
    return {
        "threshold": KILL_THRESHOLD,
        "primary_factors": list(KILL_PRIMARY),
        "fired": fired,
        "blocked": blocked,
        "fire_reasons": fire_reasons,
        "block_reasons": block_reasons,
        "by_scope": agg,
        "note": (
            "PRIMARY OUTCOME. FIRES (=already-tested OHLCV momentum) iff for trend OR full_bpp ANY scope "
            "in ANY regime has |mean corr| >= 0.5 OR CI90 upper crosses 0.5. Correlation samples are "
            "bucket-months; sleeve scopes are relative sleeves inside the PIT large+mid universe. size reported (sleeve-collapse "
            "= size restatement) but NOT a binding fire trigger. foreign unavailable=BLOCKED/OFF (never blocks "
            "primary). cfg7=N/A (not a failure). If FIRED or BLOCKED, selector gates run as APPENDIX only."
        ),
    }


# ============================================================================
# (2) SELECTOR — chart-composite-as-SELECTOR top-N on large+mid (REUSE (가) VERBATIM)
# ============================================================================

class _LegAcc:
    """Per-month recall/IC accumulator for one leg (chart selector or B++ baseline)."""

    def __init__(self):
        self.months: list[dict] = []

    def add_month(self, month, n_universe, sel_all, fwd, winners_by_h, winners_all,
                  tier_of, comp_ic, leader_basket):
        recall_m = V._pooled_recall(len(sel_all & winners_all), len(winners_all))
        lm_winners = {tk for tk in winners_all if tier_of.get(tk) in ("large", "mid")}
        lm_selected = {tk for tk in sel_all if tier_of.get(tk) in ("large", "mid")}
        lm_recall = V._pooled_recall(len(lm_selected & lm_winners), len(lm_winners))
        # analytic same-count random baseline: E[recall] = n_selected / n_universe.
        random_baseline = (len(sel_all) / n_universe) if n_universe else math.nan
        self.months.append({
            "month": month, "recall": recall_m, "largemid_recall": lm_recall,
            "composite_ic": comp_ic, "random_baseline": random_baseline,
            "n_selected": len(sel_all), "n_universe": n_universe, "n_winners": len(winners_all),
            "num": len(sel_all & winners_all), "den": len(winners_all),
            "lm_num": len(lm_selected & lm_winners), "lm_den": len(lm_winners),
            "leader_hits": len(set(leader_basket) & sel_all),
        })

    def pooled(self) -> dict:
        num = sum(m["num"] for m in self.months)
        den = sum(m["den"] for m in self.months)
        overall = V._pooled_recall(num, den)
        lm = V._pooled_recall(sum(m["lm_num"] for m in self.months), sum(m["lm_den"] for m in self.months))
        ics = [m["composite_ic"] for m in self.months]
        return {
            "overall_recall": V._json_number(overall, 4),
            "largemid_recall": V._json_number(lm, 4),
            "ic_ir": V._json_number(V.ic_information_ratio(ics), 4),
            "ic_mean": V._json_number(V._mean(ics), 4),
            "leader_hits_total": sum(m["leader_hits"] for m in self.months),
            "recall_ci90": V._ci90([m["recall"] for m in self.months]),
        }


def _pooled_topn_select(scored_by_b: dict[str, list], select_count: int) -> set[str]:
    """(가) FROZEN truncation VERBATIM: select_size_sleeves L20/M20/S10 cross-bucket-disjoint, then
    pooled top-N by score over the disjoint union via deterministic (-score, ticker) sort."""
    used: set[str] = set()
    ranked_by_b: dict[str, list] = {}
    for b in HARVEST_BUCKETS:
        scored = scored_by_b[b]
        by_t = {sc.ticker: sc for sc in scored}
        picked = F.select_size_sleeves(
            [sc.ticker for sc in scored], [sc.score for sc in scored],
            [sc.sleeve for sc in scored], quota=dict(F.SLEEVE_QUOTA), exclude=used)
        ranked = sorted((by_t[t] for t in picked), key=lambda sc: (-sc.score, sc.ticker))
        ranked_by_b[b] = ranked
        used |= set(picked)
    pooled: list[tuple[float, str]] = []
    for b in HARVEST_BUCKETS:
        for sc in ranked_by_b[b]:
            pooled.append((sc.score, sc.ticker))
    pooled.sort(key=lambda x: (-x[0], x[1]))  # deterministic: score desc, ticker asc
    return {tk for _s, tk in pooled[:select_count]}


def _composite_ic_for(scored_by_b: dict[str, list], fwd: dict) -> float:
    """rank-IC IR co-gate input: composite IC over the FULL scored largemid universe (NOT shrunk by N)."""
    ic_by_b = {}
    for b in HARVEST_BUCKETS:
        sc_map = {x.ticker: x.score for x in scored_by_b[b] if x.eligible}
        common = [tk for tk in sc_map if tk in fwd[b]]
        ic_by_b[b] = F.spearman_ic([sc_map[tk] for tk in common], [fwd[b][tk] for tk in common])
    return V._composite_ic(ic_by_b)


def run_harvest(
    start_month: date, end_month: date, panel, *,
    universe_at, foreign_at, dart_at, with_foreign: bool,
    leader_basket: dict[str, str], progress: bool,
) -> dict:
    """Kill-switch (always) + selector legs (chart + B++ baseline) on largemid, N=50/30/75.

    Both selector legs share the same months/winners/forward denominator (honest comparison). Selector
    metrics are computed for all N but only N=50 is adjudicated downstream.
    """
    dates = V.panel_trading_days(panel)
    if len(dates) < 2:
        raise RuntimeError("panel 거래일 부족 (>=2).")
    series = V.build_series_by_ticker(panel, dates)
    months = V.iter_selection_months(start_month, end_month)

    kill_per_month: list[dict] = []
    # selector legs keyed by N then label.
    legs: dict[int, dict[str, _LegAcc]] = {n: {"chart": _LegAcc(), "bpp": _LegAcc()} for n in (ADJUDICATED_N, *SENSITIVITY_N)}
    chart_ic_by_b: dict[str, list[float]] = {b: [] for b in HARVEST_BUCKETS}
    n_processed = 0
    # diagnostics accumulators
    diag_pair_acc: list[dict] = []
    diag_loo_num: dict[str, int] = {s: 0 for s in Ch.SUB_INDICATORS}
    diag_loo_den = 0

    for t in months:
        sel_idx = V.selection_index(dates, t)
        if sel_idx < 0:
            continue
        sel_date = dates[sel_idx]
        sel_date_obj = datetime.strptime(sel_date, "%Y%m%d").date()
        universe_rows = universe_at(sel_date_obj)
        if not universe_rows:
            continue
        stocks_all, _name_by, _qmeta = V.build_month_stockraws(
            sel_date_obj, series, sel_date, universe_rows, foreign_at=foreign_at, dart_at=dart_at)
        if not stocks_all:
            continue

        # KILL-SWITCH: largemid / top-50 context = the SAME largemid restriction (가) uses.
        full_tier_of = V.canonical_size_tiers(stocks_all)
        stocks = [s for s in stocks_all if full_tier_of.get(s.ticker) in ("large", "mid")]
        if not stocks:
            continue
        tickers = [s.ticker for s in stocks]
        fwd, _status = V.compute_month_forward(panel, dates, tickers, sel_idx)
        winners_by_h = {b: V.top_decile_winners(fwd[b]) for b in HARVEST_BUCKETS}
        winners_all = set().union(*winners_by_h.values()) if winners_by_h else set()
        if not winners_all:
            continue

        for b in HARVEST_BUCKETS:
            kill_per_month.append(month_killswitch(stocks, b, with_foreign=with_foreign))

        # score both generators once per bucket on the largemid universe.
        chart_by_b = {b: Ch.score_chart_universe(stocks, b) for b in HARVEST_BUCKETS}
        bpp_by_b = {b: F.score_bpp_universe(stocks, b) for b in HARVEST_BUCKETS}
        comp_ic_chart = _composite_ic_for(chart_by_b, fwd)
        comp_ic_bpp = _composite_ic_for(bpp_by_b, fwd)
        for b in HARVEST_BUCKETS:
            sc_map = {x.ticker: x.score for x in chart_by_b[b] if x.eligible}
            common = [tk for tk in sc_map if tk in fwd[b]]
            if len(common) >= 3:
                chart_ic_by_b[b].append(F.spearman_ic([sc_map[tk] for tk in common], [fwd[b][tk] for tk in common]))

        for n in (ADJUDICATED_N, *SENSITIVITY_N):
            chart_sel = _pooled_topn_select(chart_by_b, n)
            bpp_sel = _pooled_topn_select(bpp_by_b, n)
            legs[n]["chart"].add_month(t.isoformat(), len(stocks), chart_sel, fwd, winners_by_h,
                                       winners_all, full_tier_of, comp_ic_chart, leader_basket)
            legs[n]["bpp"].add_month(t.isoformat(), len(stocks), bpp_sel, fwd, winners_by_h,
                                     winners_all, full_tier_of, comp_ic_bpp, leader_basket)

        # DIAGNOSTICS (constraint 5) — pairwise corr + leave-one-out recall on N=50 (diagnostic only).
        diag_pair_acc.append(_pairwise_one_month(chart_by_b))
        loo = _leave_one_out_recall(stocks, fwd, winners_all, full_tier_of, ADJUDICATED_N)
        for s in Ch.SUB_INDICATORS:
            diag_loo_num[s] += loo[s]["num"]
        diag_loo_den += loo["_den"]

        n_processed += 1
        if progress:
            print(f"  [{t.isoformat()}] largemid={len(stocks)} winners={len(winners_all)} "
                  f"chart50_recall={legs[ADJUDICATED_N]['chart'].months[-1]['recall']:.3f} "
                  f"bpp50_recall={legs[ADJUDICATED_N]['bpp'].months[-1]['recall']:.3f}",
                  file=sys.stderr, flush=True)

    if n_processed == 0:
        raise RuntimeError("처리된 선정월 0개 (universe/panel/forward 확인).")

    killswitch = aggregate_killswitch(kill_per_month, with_foreign=with_foreign)
    selector = _selector_report(legs, chart_ic_by_b, fired=killswitch["fired"])
    secondary = _secondary_report(legs[ADJUDICATED_N])
    diagnostics = _diagnostics_report(diag_pair_acc, diag_loo_num, diag_loo_den)
    return {
        "months_processed": n_processed,
        "killswitch": killswitch,
        "selector": selector,
        "secondary": secondary,
        "diagnostics": diagnostics,
    }


def _selector_recall_lift(chart: _LegAcc) -> dict:
    """Per-month recall-LIFT = recall - same-count random baseline; CI90 via V._ci90 (LOCKED method)."""
    lift_series = [m["recall"] - m["random_baseline"]
                   for m in chart.months
                   if not V._is_nan(m["recall"]) and not V._is_nan(m["random_baseline"])]
    return {
        "per_month_recall_lift": [V._json_number(v, 4) for v in lift_series],
        "recall_lift_mean": V._json_number(V._mean(lift_series), 4),
        "recall_lift_ci90": V._ci90(lift_series),
    }


def _selector_report(legs: dict, chart_ic_by_b: dict, *, fired: bool) -> dict:
    """N=50 adjudicated via V.gate_a_pass_selective_largemid VERBATIM; 30/75 sensitivity-only."""
    bucket_ic_ir = V.ic_information_ratio([v for b in HARVEST_BUCKETS for v in chart_ic_by_b[b]])
    out: dict = {
        "adjudicated_n": ADJUDICATED_N,
        "by_n": {},
        "bucket_ic_ir_diagnostic": V._json_number(bucket_ic_ir, 4),
    }
    for n in (ADJUDICATED_N, *SENSITIVITY_N):
        chart = legs[n]["chart"]
        lift = _selector_recall_lift(chart)
        pooled = chart.pooled()
        lift_ci = lift["recall_lift_ci90"]
        lift_mean = lift["recall_lift_mean"] if lift["recall_lift_mean"] is not None else math.nan
        ic_ir = V.ic_information_ratio([m["composite_ic"] for m in chart.months])
        adjudicated = (n == ADJUDICATED_N)
        entry = {
            "adjudicated": adjudicated,
            "chart_pooled": pooled,
            "recall_lift": lift,
            "rank_ic_ir": V._json_number(ic_ir, 4),
        }
        if adjudicated:
            passed, fails = V.gate_a_pass_selective_largemid(lift_ci, lift_mean, ic_ir)
            entry["gate"] = {
                "metric": "gate_a_pass_selective_largemid (VERBATIM): recall-lift CI90 lower>0 (fallback +5pp) AND IC IR>=0.30",
                "pass": passed,
                "fails": fails,
                "decision_grade": False,
                "appendix_only": fired,  # if kill-switch fired, this gate is APPENDIX, not the headline
            }
        else:
            entry["note"] = "NON-ADJUDICATED sensitivity (never pass/fail) — SoT §5/§6"
        out["by_n"][str(n)] = entry
    out["note"] = (
        "Selector runs as PRIMARY measurement ONLY if the kill-switch PASSES. If the kill-switch FIRED, "
        "this whole block is APPENDIX diagnostics (decision_grade=False). N=50 adjudicated; 30/75 sensitivity."
    )
    return out


def _secondary_report(adj_legs: dict) -> dict:
    """Non-binding marginal (B++ vs chart on largemid-50) + direct chart-vs-(가)-B++ recall/IC."""
    chart, bpp = adj_legs["chart"].pooled(), adj_legs["bpp"].pooled()

    def d(a, b):
        if a is None or b is None:
            return None
        return round(a - b, 4)

    return {
        "binding": False,
        "chart_pooled": chart,
        "bpp_baseline_pooled": bpp,
        "delta_chart_minus_bpp": {
            "overall_recall": d(chart["overall_recall"], bpp["overall_recall"]),
            "largemid_recall": d(chart["largemid_recall"], bpp["largemid_recall"]),
            "ic_ir": d(chart["ic_ir"], bpp["ic_ir"]),
            "ic_mean": d(chart["ic_mean"], bpp["ic_mean"]),
            "leader_hits": chart["leader_hits_total"] - bpp["leader_hits_total"],
        },
        "note": "SECONDARY / non-binding. Direct chart-selector vs (가) B++-selector over same months/winners denom.",
    }


# ============================================================================
# (4) DIAGNOSTICS — sub-indicator pairwise corr + leave-one-out recall (NO removal/reweighting)
# ============================================================================

def _pairwise_one_month(chart_by_b: dict) -> dict:
    """Sub-indicator pairwise Pearson on the short-bucket eligible cross-section (one month)."""
    scored = chart_by_b["short"]
    elig = [sc for sc in scored if sc.eligible]
    fv = {s: [sc.factor_ranks.get(s, math.nan) for sc in elig] for s in Ch.SUB_INDICATORS}
    pw = F.pairwise_correlation(fv)
    return {f"{a}|{b}": V._json_number(v, 4) for (a, b), v in pw.items()}


def _leave_one_out_recall(stocks, fwd, winners_all, tier_of, n) -> dict:
    """Recall when each sub-indicator is dropped from the equal-rank composite (diagnostic only).

    Re-scores by recomputing the composite over the remaining 7 sub-indicators (NO reweighting beyond
    equal-rank over the survivors), selects top-N, measures recall. Emitted as a diagnostic ratio only.
    """
    den = len(winners_all)
    out: dict = {"_den": den}
    full_ranks = {b: {sub: None for sub in Ch.SUB_INDICATORS} for b in HARVEST_BUCKETS}
    # precompute per-bucket sub rank vectors once.
    sub_ranks_by_b: dict[str, dict] = {}
    sleeve_by_b: dict[str, dict] = {}
    ticker_by_b: dict[str, list] = {}
    for b in HARVEST_BUCKETS:
        scored = Ch.score_chart_universe(stocks, b)
        ticker_by_b[b] = [sc.ticker for sc in scored]
        sleeve_by_b[b] = {sc.ticker: sc.sleeve for sc in scored}
        sub_ranks_by_b[b] = {sub: [sc.factor_ranks.get(sub, math.nan) if sc.eligible else math.nan for sc in scored]
                             for sub in Ch.SUB_INDICATORS}
        full_ranks[b] = scored
    for drop in Ch.SUB_INDICATORS:
        keep = [s for s in Ch.SUB_INDICATORS if s != drop]
        scored_by_b: dict[str, list] = {}
        for b in HARVEST_BUCKETS:
            scored = full_ranks[b]
            comp = F._combine_ranks([sub_ranks_by_b[b][s] for s in keep])
            rebuilt = []
            for i, sc in enumerate(scored):
                if not sc.eligible or V._is_nan(comp[i]):
                    rebuilt.append(F.ScoredStock(sc.ticker, sc.sector, sc.market_cap, "small", math.nan, sc.adv60, eligible=False))
                else:
                    rebuilt.append(F.ScoredStock(sc.ticker, sc.sector, sc.market_cap, sc.sleeve, comp[i], sc.adv60,
                                                 factor_ranks=sc.factor_ranks, eligible=True))
            scored_by_b[b] = rebuilt
        sel = _pooled_topn_select(scored_by_b, n)
        out[drop] = {"num": len(sel & winners_all)}
    return out


def _diagnostics_report(pair_acc: list[dict], loo_num: dict, loo_den: int) -> dict:
    keys: set[str] = set()
    for m in pair_acc:
        keys |= set(m)
    pairwise_mean = {}
    for k in sorted(keys):
        series = [m[k] for m in pair_acc if k in m and m[k] is not None]
        pairwise_mean[k] = V._json_number(V._mean(series), 4) if series else None
    loo = {s: V._json_number(V._pooled_recall(loo_num[s], loo_den), 4) for s in Ch.SUB_INDICATORS}
    return {
        "decision_grade": False,
        "diagnostic_only": True,
        "subindicator_pairwise_corr_mean": pairwise_mean,
        "leave_one_out_recall_n50": loo,
        "note": (
            "DIAGNOSTIC ONLY. NO post-hoc cluster removal, NO reweighting, NO best-indicator selection. "
            "leave-one-out is equal-rank over the surviving 7 sub-indicators (emergent), reported as a ratio."
        ),
    }


# ============================================================================
# Verdict + fail-closed guard
# ============================================================================

def build_verdict(killswitch: dict, selector: dict) -> dict:
    fired = killswitch.get("fired", False)
    blocked = killswitch.get("blocked", False)
    adj = selector.get("by_n", {}).get(str(ADJUDICATED_N), {})
    gate = adj.get("gate", {})
    gate_pass = bool(gate.get("pass", False))

    if fired:
        verdict = ("FIRED — objective classical technicals are mostly already-tested OHLCV momentum "
                   "in this monthly PIT harness (kill-switch). Selector gates are APPENDIX only.")
        decision = "KILLSWITCH_FIRED"
    elif blocked:
        verdict = ("BLOCKED — objective technical kill-switch lacked required trend/full-B++ coverage "
                   "in at least one scope. Selector gates are APPENDIX only.")
        decision = "KILLSWITCH_BLOCKED"
    elif gate_pass:
        verdict = ("EXPLORATORY: kill-switch passed AND selector gate passed (diagnostic only, "
                   "NOT decision-grade)")
        decision = "SELECTOR_GATE_PASS"
    else:
        verdict = ("EXPLORATORY: kill-switch passed but selector gate did not pass "
                   "(no selection skill over the (가) B++ baseline)")
        decision = "SELECTOR_GATE_FAIL"

    return {
        "killswitch_fired": fired,
        "killswitch_blocked": blocked,
        "killswitch_fire_reasons": killswitch.get("fire_reasons", []),
        "killswitch_block_reasons": killswitch.get("block_reasons", []),
        "selector_gate_pass": gate_pass if not (fired or blocked) else None,
        "selector_gate_appendix_only": fired or blocked,
        "raw_decision": decision,
        "decision_grade": False,
        "verdict": verdict,
        "wording_constraint": (
            "FALSIFICATION not rescue · exploratory · no --apply · no Tier1 cost · no '상승 예측' claim. "
            "PRIMARY=orthogonality kill-switch; selector=measured only if kill-switch passes."
        ),
    }


def _assert_verdict_wording(report: dict) -> None:
    """fail-closed: forbidden tokens must not leak into the verdict string."""
    v = report["verdict"]["verdict"].lower()
    for w in FORBIDDEN_VERDICT_WORDS:
        if w in v:
            raise AssertionError(f"verdict에 금지어 누설: {w!r}")


def _resolve_output_path(repo_root: Path, raw_out: Optional[str], smoke: bool,
                         parser: Optional[argparse.ArgumentParser] = None) -> Path:
    raw = Path(raw_out) if raw_out is not None else (SMOKE_REPORT_PATH if smoke else DEFAULT_REPORT_PATH)
    out = raw if raw.is_absolute() else repo_root / raw
    canonical = (repo_root / DEFAULT_REPORT_PATH).resolve(strict=False)
    if smoke and raw_out is not None and out.resolve(strict=False) == canonical:
        msg = "--smoke cannot write the canonical chart_technical_report.json; use a smoke-specific --out path"
        if parser is not None:
            parser.error(msg)
        raise ValueError(msg)
    return out


def _build_chart_cache_only_providers(start_month: date, end_month: date, cache_dir: Path,
                                      universe_limit: Optional[int]):
    import screen_shortlist_tier0 as S
    import dart_signals as D

    cache_dir.mkdir(parents=True, exist_ok=True)
    panel_start = date(start_month.year, start_month.month, 1) - timedelta(days=S.BPP_LOOKBACK_CALENDAR_DAYS)
    panel_end = min(date.today(), end_month + timedelta(days=210))
    span = (panel_end - panel_start).days + 1
    bas_dds = sorted((panel_end - timedelta(days=o)).strftime("%Y%m%d")
                     for o in range(span) if (panel_end - timedelta(days=o)).weekday() < 5)

    def cache_miss(market: str, bas_dd: str) -> list[dict]:
        raise RuntimeError(f"missing PIT cache file for chart run: {cache_dir / f'{market}_{bas_dd}.json'}")

    print(f"[panel] loading cache-only PIT panel {bas_dds[0]}~{bas_dds[-1]} ({len(bas_dds)} weekdays × 2 markets) → {cache_dir}",
          file=sys.stderr, flush=True)
    panel = V.load_pit_panel(bas_dds, cache_dir=cache_dir, fetch=cache_miss, progress=True)
    print(f"[panel] {len(panel)} trading days loaded (cache-only)", file=sys.stderr, flush=True)

    _uni_cache: dict[str, list[dict]] = {}

    def universe_at(sel: date) -> list[dict]:
        key = sel.strftime("%Y%m%d")
        if key in _uni_cache:
            return _uni_cache[key]
        rows = []
        for tk, row in panel.get(key, {}).items():
            name = row.name or tk
            mcap = row.mktcap
            if not mcap or mcap < S.UNIVERSE_FILTERS["min_market_cap_won"]:
                continue
            if S.is_excluded_universe_name(name):
                continue
            rows.append({"ticker": tk, "name": name, "market": row.market, "market_cap_won": mcap})
        rows.sort(key=lambda r: r["market_cap_won"], reverse=True)
        if universe_limit is not None and universe_limit > 0:
            rows = rows[:universe_limit]
        S.resolve_sectors_for_universe(rows, supabase_client=None)
        _uni_cache[key] = rows
        return rows

    def foreign_at(_tk: str, _sel: date) -> tuple[float, bool]:
        return (math.nan, True)

    def dart_at(_tk: str, _sel: date):
        return D.DartSignalsResult()

    coverage_meta = {
        "provider": "chart_cache_only",
        "panel_cache_only": True,
        "universe_source": "PIT panel cache rows filtered by market cap/name; no live fetch",
        "foreign_enabled": False,
        "foreign_note": "BLOCKED/OFF for D OHLCV-only run; no pykrx/live foreign fetch",
        "earnings_enabled": False,
        "dart_cache_only": False,
    }
    return panel, universe_at, foreign_at, dart_at, coverage_meta


def main() -> None:
    parser = argparse.ArgumentParser(
        description="(D) CHART/TECHNICAL composite FALSIFICATION (kill-switch PRIMARY; selector reuses (가)). "
                    "Smoke: --start-month 2023-01-01 --end-month 2023-03-01 --smoke --universe-limit 400.")
    parser.add_argument("--start-month", required=True, type=_parse_month, help="YYYY-MM-01")
    parser.add_argument("--end-month", required=True, type=_parse_month, help="YYYY-MM-01")
    parser.add_argument("--cache-dir", default="scripts/out/pit_cache")
    parser.add_argument("--out", default=None)
    parser.add_argument("--smoke", action="store_true", help="패널/로직 smoke")
    parser.add_argument("--universe-limit", type=int, default=None, help="universe cap (smoke 전용)")
    parser.add_argument("--with-foreign", action="store_true",
                        help="blocked for D: objective technical run is OHLCV-only; foreign remains BLOCKED/OFF")
    args = parser.parse_args()

    repo_root = _DIR.parent
    if args.with_foreign:
        parser.error("--with-foreign is blocked for D because the objective-technical protocol is OHLCV-only")
    if args.universe_limit is not None and not args.smoke:
        parser.error("--universe-limit is smoke-only for D; full runs must use the complete PIT cache universe")

    def repo_path(raw: str) -> Path:
        p = Path(raw)
        return p if p.is_absolute() else repo_root / p

    cache_dir = repo_path(args.cache_dir)
    out_path = _resolve_output_path(repo_root, args.out, args.smoke, parser)
    out_dir = out_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    V._load_env()

    panel, universe_at, foreign_at, dart_at, coverage_meta = _build_chart_cache_only_providers(
        args.start_month, args.end_month, cache_dir, args.universe_limit)

    results = run_harvest(
        args.start_month, args.end_month, panel,
        universe_at=universe_at, foreign_at=foreign_at, dart_at=dart_at,
        with_foreign=args.with_foreign, leader_basket=V.LEADER_BASKET_2026_06, progress=True)

    verdict = build_verdict(results["killswitch"], results["selector"])

    import json
    report = {
        "version": "chart-technical-falsification-1",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "task": "(D) CHART/TECHNICAL-INDICATOR COMPOSITE FALSIFICATION (selector)",
        "exploratory": True,
        "decision_grade": False,
        "diagnostic_only": True,
        "smoke": args.smoke,
        "months": {"start": args.start_month.isoformat(), "end": args.end_month.isoformat(),
                   "processed": results["months_processed"]},
        "frozen_params": {
            "ma_periods": list(Ch.MA_PERIODS),
            "gc_recency_window": Ch.GC_RECENCY_WINDOW,
            "rsi_period": Ch.RSI_PERIOD,
            "macd": [Ch.MACD_FAST, Ch.MACD_SLOW, Ch.MACD_SIGNAL],
            "bb_period": Ch.BB_PERIOD, "bb_k": Ch.BB_K,
            "donchian_n": Ch.DONCHIAN_N,
            "vol_avg_window": Ch.VOL_AVG_WINDOW, "vol_confirm_mult": Ch.VOL_CONFIRM_MULT,
            "atr_contraction_fast": Ch.ATR_CONTRACTION_FAST, "atr_contraction_slow": Ch.ATR_CONTRACTION_SLOW,
            "warmup_neutral": Ch.CHART_WARMUP_NEUTRAL,
            "composite": "equal-rank mean over present sub-indicator ranks (NO weights, NO grid, NO mining)",
            "atr_proxy_note": "true-range ATR needs low (not on panel) → close-to-close realized-vol contraction proxy (SoT §1)",
            "killswitch_threshold": KILL_THRESHOLD,
            "adjudicated_n": ADJUDICATED_N, "sensitivity_n": list(SENSITIVITY_N),
            "triple_gate": "(가) gate_a_pass_selective_largemid (recall-lift CI90 lower>0 + IC IR>=0.30), UNCHANGED",
        },
        "with_foreign": args.with_foreign,
        "killswitch": results["killswitch"],
        "selector": results["selector"],
        "secondary": results["secondary"],
        "diagnostics": results["diagnostics"],
        "coverage_meta": coverage_meta,
        "freeze_tag": "tier0-multiregime-freeze",
        "verdict": verdict,
        "sot": "docs/superpowers/2026-06-18-tier0-chart-technical.md",
    }
    _assert_verdict_wording(report)

    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2))

    k = results["killswitch"]
    print("\n=== (D) CHART/TECHNICAL FALSIFICATION ===", file=sys.stderr)
    print(f"  months={results['months_processed']} · smoke={args.smoke} · with_foreign={args.with_foreign}", file=sys.stderr)
    print(f"  KILL-SWITCH fired={k['fired']} reasons={k['fire_reasons']}", file=sys.stderr)
    for fac in ("trend", "full_bpp", "size"):
        ov = k["by_scope"]["overall"].get(fac, {})
        print(f"    overall corr(chart,{fac}) mean={ov.get('mean')} ci90={ov.get('ci90')}", file=sys.stderr)
    adj = results["selector"]["by_n"].get(str(ADJUDICATED_N), {})
    if not k["fired"]:
        print(f"  SELECTOR(N=50) recall_lift_ci90={adj.get('recall_lift',{}).get('recall_lift_ci90')} "
              f"IC_IR={adj.get('rank_ic_ir')} gate_pass={adj.get('gate',{}).get('pass')}", file=sys.stderr)
    else:
        print("  SELECTOR = APPENDIX only (kill-switch fired)", file=sys.stderr)
    print(f"  VERDICT: {verdict['verdict']}", file=sys.stderr)
    print(f"  report → {out_path}", file=sys.stderr)
    print("\n⚠️  EXPLORATORY/diagnostic FALSIFICATION — no --apply, no Tier1, no '상승 예측' claim.", file=sys.stderr)


def _parse_month(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date().replace(day=1)


if __name__ == "__main__":
    main()
