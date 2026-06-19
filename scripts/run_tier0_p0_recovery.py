#!/usr/bin/env python3
"""P0 — MISSED-WINNER RECOVERY DIAGNOSTIC (kill-switch for the reserve/union combo family).

Campaign SoT (pre-registered): docs/superpowers/2026-06-18-tier0-combination-campaign.md §4 P0.

Question: of the top-decile winners that B++ (cfg1) MISSES (winners_all − B++150), what fraction does an
orthogonal signal's STANDALONE top-150 recover — and, more importantly for a RESERVE combo, what fraction do
the signal's NON-B++ picks (chart150 minus B++150) recover — expressed as a RATIO to the random expectation?

- ratio ≈ 1.0× random  → the signal's "different picks" are different NON-winners → its reserve/union combo is
  DEAD ON ARRIVAL (cannot raise union recall) → DROP it (shrinks family-wise K).
- ratio >> 1            → the signal genuinely recovers B++'s missed winners → its reserve combo (P1/P2/P7/P8)
  is worth building + gating.

Diagnostic only: NO pass/fail gate, NO --apply, AI cost 0, offline. Frozen harness/scorers UNTOUCHED (pure
read-only reuse). Primary signal = CHART (P1 best prior, clean standalone scorer, OHLCV-only → no foreign/DART).
"""
from __future__ import annotations
import sys, json
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import validate_tier0_ic as V
import tier0_factors as F
import tier0_chart as Ch


def select_150(stocks, scorer):
    """Generic cross-bucket-disjoint L20/M20/S10 = ~150 selection by an arbitrary ScoredStock scorer.
    MIRRORS select_bpp_for_harvest VERBATIM but with the injected scorer (B++ or chart). Returns the
    selected ticker set (union across the 3 horizon buckets)."""
    used: set[str] = set()
    for b in V.HARVEST_BUCKETS:
        scored = scorer(stocks, b)
        by_t = {sc.ticker: sc for sc in scored}
        picked = F.select_size_sleeves(
            [sc.ticker for sc in scored], [sc.score for sc in scored],
            [sc.sleeve for sc in scored], quota=dict(F.SLEEVE_QUOTA), exclude=used,
        )
        ranked = sorted((by_t[t] for t in picked), key=lambda sc: (-sc.score, sc.ticker))
        for sc in ranked:
            used.add(sc.ticker)
    return used


def run_regime(name: str, start: date, end: date, cache_dir: Path) -> dict:
    # cfg1-style providers: no foreign, no earnings (B++ and chart need neither). allow_supabase for universe.
    panel, universe_at, foreign_at, dart_at, _cov = V._build_real_providers(
        start, end, cache_dir, None, False, with_earnings=False, dart_backfill_path=None, allow_supabase=True)
    dates = V.panel_trading_days(panel)
    series = V.build_series_by_ticker(panel, dates)

    # pooled accumulators
    acc = dict(months=0, n_universe=0, n_missed=0,
               bpp_recall_num=0, bpp_recall_den=0,
               chart_recover_missed=0,              # |missed ∩ chart150|
               chart_nonbpp_recover_missed=0,        # |missed ∩ (chart150 \ B++150)|
               chart150=0, chart_nonbpp=0, nonbpp_universe=0)
    for t in V.iter_selection_months(start, end):
        sel_idx = V.selection_index(dates, t)
        if sel_idx < 0:
            continue
        sel_date = dates[sel_idx]
        sel_date_obj = datetime.strptime(sel_date, "%Y%m%d").date()
        universe_rows = universe_at(sel_date_obj)
        if not universe_rows:
            continue
        stocks, _name, _meta = V.build_month_stockraws(
            sel_date_obj, series, sel_date, universe_rows, foreign_at=foreign_at, dart_at=dart_at)
        if not stocks:
            continue
        tickers = [s.ticker for s in stocks]
        fwd, _status = V.compute_month_forward(panel, dates, tickers, sel_idx)
        winners = set()
        for h in V.HARVEST_BUCKETS:
            winners |= V.top_decile_winners(fwd[h])
        if not winners:
            continue
        bpp150 = select_150(stocks, F.score_bpp_universe)
        chart150 = select_150(stocks, Ch.score_chart_universe)
        uni = set(tickers)
        missed = winners - bpp150                      # winners B++ failed to surface
        chart_nonbpp = chart150 - bpp150               # chart's DIFFERENT picks (what a reserve would add)
        nonbpp_uni = uni - bpp150

        acc["months"] += 1
        acc["n_universe"] += len(uni)
        acc["n_missed"] += len(missed)
        acc["bpp_recall_num"] += len(winners & bpp150)
        acc["bpp_recall_den"] += len(winners)
        acc["chart_recover_missed"] += len(missed & chart150)
        acc["chart_nonbpp_recover_missed"] += len(missed & chart_nonbpp)
        acc["chart150"] += len(chart150)
        acc["chart_nonbpp"] += len(chart_nonbpp)
        acc["nonbpp_universe"] += len(nonbpp_uni)

    # pooled rates + random-baseline ratios
    def safe(a, b):
        return (a / b) if b else float("nan")
    bpp_recall = safe(acc["bpp_recall_num"], acc["bpp_recall_den"])
    # (1) simple: chart150 recovery of missed vs a random size-|chart150| draw from the universe
    simple_recovery = safe(acc["chart_recover_missed"], acc["n_missed"])
    simple_random = safe(acc["chart150"], acc["n_universe"])         # E[recovery] of random |chart150| set
    simple_ratio = safe(simple_recovery, simple_random)
    # (2) RESERVE-relevant: chart's NON-B++ picks recovery of missed vs random size-|chart\bpp| from non-B++ pool
    reserve_recovery = safe(acc["chart_nonbpp_recover_missed"], acc["n_missed"])
    reserve_random = safe(acc["chart_nonbpp"], acc["nonbpp_universe"])
    reserve_ratio = safe(reserve_recovery, reserve_random)
    return dict(regime=name, **acc,
                bpp_recall=bpp_recall,
                simple_recovery=simple_recovery, simple_random=simple_random, simple_ratio=simple_ratio,
                reserve_recovery=reserve_recovery, reserve_random=reserve_random, reserve_ratio=reserve_ratio)


def main():
    V._load_env()  # load .env.local (KRX_OPENAPI_KEY etc.) — mirrors harness main(); universe fetch needs it.
    cache_dir = Path("scripts/out/pit_cache")
    regimes = [("bear2022", date(2022, 1, 1), date(2022, 12, 1)),
               ("recov2023", date(2023, 1, 1), date(2023, 12, 1)),
               ("bull2425", date(2024, 1, 1), date(2025, 12, 1))]
    out = {"protocol": "P0-missed-winner-recovery", "signal": "chart(D)", "diagnostic_only": True,
           "decision_grade": False, "regimes": []}
    for name, s, e in regimes:
        print(f"[P0] {name} {s}..{e} ...", file=sys.stderr, flush=True)
        r = run_regime(name, s, e, cache_dir)
        out["regimes"].append(r)
        print(f"[P0] {name}: B++recall={r['bpp_recall']:.3f} | chart simple_ratio={r['simple_ratio']:.2f}x "
              f"| RESERVE_ratio={r['reserve_ratio']:.2f}x (reserve_recovery={r['reserve_recovery']:.3f} "
              f"vs random {r['reserve_random']:.3f})", file=sys.stderr, flush=True)
    outpath = Path("scripts/out/combo/p0_recovery_chart.json")
    outpath.parent.mkdir(parents=True, exist_ok=True)
    outpath.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"\n[P0] → {outpath}", file=sys.stderr)
    # kill-switch verdict
    ratios = [r["reserve_ratio"] for r in out["regimes"]]
    print("\n=== P0 KILL-SWITCH (chart reserve) ===", file=sys.stderr)
    print(f"  reserve_ratio per regime (chart's non-B++ picks vs random at recovering B++'s missed winners):",
          file=sys.stderr)
    for r in out["regimes"]:
        print(f"    {r['regime']}: {r['reserve_ratio']:.2f}x", file=sys.stderr)
    mx = max(x for x in ratios if x == x)
    if mx < 1.3:
        print(f"  → max {mx:.2f}x < 1.3 = chart's different picks are ~random NON-winners → P1/P2 chart reserve "
              f"DEAD ON ARRIVAL (drop, shrink K).", file=sys.stderr)
    else:
        print(f"  → max {mx:.2f}x ≥ 1.3 = chart genuinely recovers some missed winners → P1 chart reserve "
              f"worth building + gating.", file=sys.stderr)


if __name__ == "__main__":
    main()
