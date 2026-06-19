#!/usr/bin/env python3
"""B++ COMBINATION CAMPAIGN runner (P1/P3/P5) — campaign binding gate, frozen harness UNTOUCHED.

SoT (pre-registered): docs/superpowers/2026-06-18-tier0-combination-campaign.md.
Each combo = an additive selection overlay on the frozen B++/chart/earnings scorers (pure read-only reuse,
like run_tier0_p0_recovery.py). Binding gate (verbatim §2): per regime, recall-LIFT vs same-count random
empirical-monthly CI90 lower>0 AND rank-IC IR>=0.30, ALL 3 regimes; any pass = ADJUDICATE (family-wise K).
Diagnostic only: NO --apply, AI cost 0, offline. EXPLORATORY: decision_grade=False.

Combos:
  P1 = B++ ∪ chart-reserve-K (K=30): swap the lowest-ranked K B++ union picks for the top-K chart NON-B++ picks.
  P3 = regime-adaptive horizon: regime label (§3) sets cross-bucket priority order (bear→short-first,
       bull→long-first) so the regime-appropriate horizon claims contested names first. Same L20/M20/S10, same 150.
  P5 = binary bull/not-bull regime-conditional EARNINGS tilt: in bull, score = 0.5·rank(B++)+0.5·rank(earnings);
       else pure B++. (Needs DART earnings → run with allow_supabase + dart_backfill overlay.)
"""
from __future__ import annotations
import sys, json, argparse, dataclasses
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import validate_tier0_ic as V
import tier0_factors as F
import tier0_chart as Ch

REGIMES = {"bear2022": (date(2022, 1, 1), date(2022, 12, 1)),
           "recov2023": (date(2023, 1, 1), date(2023, 12, 1)),
           "bull2425": (date(2024, 1, 1), date(2025, 12, 1))}
RESERVE_K = 30  # frozen (campaign §4 P1)


# ---- PIT-safe regime label (§3, frozen cutpoints) ----------------------------------------------------
def regime_label(stocks) -> str:
    """median 120d return + breadth(%>MA120) of the liquidity-floor universe, as-of sel date (PIT-safe)."""
    rets, above = [], []
    for s in stocks:
        c = s.closes
        if len(c) < 121 or F._is_nan(c[-1]) or F._is_nan(c[-121]) or c[-121] <= 0:
            continue
        if not F.liquidity_floor_pass(F.adv60(s.trdvals)):
            continue
        rets.append(c[-1] / c[-121] - 1.0)
        ma120 = sum(c[-120:]) / 120.0
        above.append(1.0 if c[-1] >= ma120 else 0.0)
    if not rets:
        return "recovery"
    med = sorted(rets)[len(rets) // 2]
    breadth = sum(above) / len(above)
    if med > 0 and breadth > 0.50:
        return "bull"
    if med < 0 and breadth < 0.50:
        return "bear"
    return "recovery"


# ---- selection helpers (mirror select_bpp_for_harvest VERBATIM, frozen sleeves) ----------------------
def _sleeve_pick(scored, used):
    by_t = {sc.ticker: sc for sc in scored}
    picked = F.select_size_sleeves([sc.ticker for sc in scored], [sc.score for sc in scored],
                                    [sc.sleeve for sc in scored], quota=dict(F.SLEEVE_QUOTA), exclude=used)
    return sorted((by_t[t] for t in picked), key=lambda sc: (-sc.score, sc.ticker))


def _bpp_buckets(stocks, bucket_order=V.HARVEST_BUCKETS):
    """{bucket:(scored,ranked)} cross-disjoint in the given priority order. order=default → identical to harness."""
    used, res = set(), {}
    for b in bucket_order:
        scored = F.score_bpp_universe(stocks, b)
        ranked = _sleeve_pick(scored, used)
        res[b] = (scored, ranked)
        for sc in ranked:
            used.add(sc.ticker)
    return res


# ---- combo generators: return (selected_set, per_bucket_scored_for_IC) -------------------------------
def gen_bpp(stocks):  # reference (== frozen cfg1)
    res = _bpp_buckets(stocks)
    sel = set().union(*[{sc.ticker for sc in res[b][1]} for b in res])
    return sel, {b: res[b][0] for b in res}


def gen_p1_chart_reserve(stocks):
    res = _bpp_buckets(stocks)
    bpp_ranked = []  # (score, ticker) across union, ascending later
    for b in V.HARVEST_BUCKETS:
        for sc in res[b][1]:
            bpp_ranked.append((sc.score, sc.ticker))
    bpp_set = {t for _s, t in bpp_ranked}
    # chart standalone union (for the reserve candidates)
    cused, chart_union = set(), []
    for b in V.HARVEST_BUCKETS:
        cscored = Ch.score_chart_universe(stocks, b)
        cranked = _sleeve_pick(cscored, cused)
        for sc in cranked:
            chart_union.append((sc.score, sc.ticker))
            cused.add(sc.ticker)
    chart_nonbpp = [(s, t) for s, t in sorted(chart_union, key=lambda x: (-x[0], x[1])) if t not in bpp_set]
    reserve = [t for _s, t in chart_nonbpp[:RESERVE_K]]
    # drop the lowest-score K B++ names, add the reserve
    bpp_sorted = [t for _s, t in sorted(bpp_ranked, key=lambda x: (x[0], x[1]))]  # ascending score
    drop = set(bpp_sorted[:len(reserve)])
    sel = (bpp_set - drop) | set(reserve)
    return sel, {b: res[b][0] for b in res}  # IC co-gate over B++ scoring (ranking quality unchanged)


def gen_p3_regime_horizon(stocks):
    reg = regime_label(stocks)
    order = {"bear": ("short", "mid", "long"), "recovery": ("mid", "short", "long"),
             "bull": ("long", "mid", "short")}[reg]
    res = _bpp_buckets(stocks, bucket_order=order)
    sel = set().union(*[{sc.ticker for sc in res[b][1]} for b in res])
    return sel, {b: res[b][0] for b in res}


def gen_p5_regime_earnings(stocks):
    reg = regime_label(stocks)
    bull = (reg == "bull")
    used, res = set(), {}
    for b in V.HARVEST_BUCKETS:
        scored = F.score_bpp_universe(stocks, b)
        if bull:
            # 0.5*pctrank(bpp) + 0.5*pctrank(earnings YoY). earnings_raw present (DART active); missing → 50.
            # omxy combo-R1 HIGH fix: blend ONLY eligible finite-score rows; keep ineligible/NaN rows as-is so
            # _sleeve_pick still filters them (the blend must NOT resurrect liquidity-floor-barred names).
            # omxy combo-R2 MED: build BOTH percentile reference sets from the SAME eligible finite-score rows
            # (frozen B++ masks earnings to eligible first — tier0_factors.py:819). Ranking eligible candidates
            # against an all-stocks earnings distribution would distort P5's earnings component.
            ev = {s.ticker: s.earnings_raw for s in stocks}
            elig_t = {sc.ticker for sc in scored if sc.eligible and not F._is_nan(sc.score)}
            present = sorted(ev[t] for t in elig_t if ev.get(t) is not None and not F._is_nan(ev[t]))
            bpres = sorted(sc.score for sc in scored if sc.eligible and not F._is_nan(sc.score))
            def pct(x, arr):
                if not arr or x is None or F._is_nan(x):
                    return 50.0
                return 100.0 * sum(1 for a in arr if a <= x) / len(arr)
            blended = []
            for sc in scored:
                if not sc.eligible or F._is_nan(sc.score):
                    blended.append(sc)  # ineligible/NaN preserved → filtered by _sleeve_pick (no resurrection)
                    continue
                br = pct(sc.score, bpres)
                er = pct(ev.get(sc.ticker), present)
                blended.append(dataclasses.replace(sc, score=0.5 * br + 0.5 * er))  # only score changes
            scored = blended
        ranked = _sleeve_pick(scored, used)
        res[b] = (scored, ranked)
        for sc in ranked:
            used.add(sc.ticker)
    sel = set().union(*[{sc.ticker for sc in res[b][1]} for b in res])
    return sel, {b: res[b][0] for b in res}


GENERATORS = {"bpp": gen_bpp, "p1_chart_reserve": gen_p1_chart_reserve,
              "p3_regime_horizon": gen_p3_regime_horizon, "p5_regime_earnings": gen_p5_regime_earnings}


# FAMILY-WISE K (campaign §2): the GO gated combos in this campaign = {P1, P3, P5} → K=3. Persisted so any
# single pass is read at the family-corrected bar. Binding decision per spec = ANY pass = ADJUDICATE (never
# self-certified PASS); size-neutral sleeve gate is NOT implemented here → fail-closed (no auto-PASS possible).
FAMILY_K = 3
FAMILY_ALPHA = 0.10 / FAMILY_K  # Holm/Bonferroni target per-combo alpha (informational; CI is empirical)


def run_regime(combo: str, start: date, end: date, cache_dir: Path, with_earnings: bool) -> dict:
    """Collect per-month records (state, lift, ic) for one calendar window. No gating here — the caller
    aggregates per the combo's grouping (calendar for P1/P3; actual bull/not-bull STATE for P5)."""
    panel, universe_at, foreign_at, dart_at, _cov = V._build_real_providers(
        start, end, cache_dir, None, False, with_earnings=with_earnings,
        dart_backfill_path=("scripts/out/dart_backfill.jsonl" if with_earnings else None), allow_supabase=True)
    dates = V.panel_trading_days(panel)
    series = V.build_series_by_ticker(panel, dates)
    gen = GENERATORS[combo]
    recs, earn_present_months = [], 0
    for t in V.iter_selection_months(start, end):
        si = V.selection_index(dates, t)
        if si < 0:
            continue
        sd = dates[si]
        sdo = datetime.strptime(sd, "%Y%m%d").date()
        urows = universe_at(sdo)
        if not urows:
            continue
        stocks, _n, _m = V.build_month_stockraws(sdo, series, sd, urows, foreign_at=foreign_at, dart_at=dart_at)
        if not stocks:
            continue
        tickers = [s.ticker for s in stocks]
        fwd, _s = V.compute_month_forward(panel, dates, tickers, si)
        winners = set()
        for h in V.HARVEST_BUCKETS:
            winners |= V.top_decile_winners(fwd[h])
        if not winners:
            continue
        if any(s.earnings_raw is not None and not F._is_nan(s.earnings_raw) for s in stocks):
            earn_present_months += 1
        sel, scored_by_b = gen(stocks)
        recall_m = len(sel & winners) / len(winners)
        rand_m = len(sel) / len(tickers) if tickers else float("nan")
        ics = []
        for b in V.HARVEST_BUCKETS:
            scored = scored_by_b[b]
            sc_map = {sc.ticker: sc.score for sc in scored if sc.eligible and not F._is_nan(sc.score)}
            common = [tk for tk in sc_map if tk in fwd[b]]
            if len(common) >= 3:
                ics.append(F.spearman_ic([sc_map[tk] for tk in common], [fwd[b][tk] for tk in common]))
        valid_ics = [v for v in ics if not F._is_nan(v)]
        ic_m = (sum(valid_ics) / len(valid_ics)) if valid_ics else float("nan")
        recs.append({"month": sd, "state": regime_label(stocks), "lift": recall_m - rand_m, "ic": ic_m})
    return {"regime_window": start.year, "months": len(recs), "recs": recs,
            "earnings_present_months": earn_present_months}


def gate_group(recs: list) -> dict:
    lifts = [r["lift"] for r in recs]
    ics = [r["ic"] for r in recs]
    lift_ci = V._ci90(lifts)
    lift_mean = V._mean(lifts)
    ic_ir = V.ic_information_ratio(ics)
    primary = (lift_ci[0] > 0) if (lift_ci and not V._is_nan(lift_ci[0])) else (lift_mean >= 0.05)
    cogate = (not V._is_nan(ic_ir)) and ic_ir >= V.GATE_B_IC_IR_MIN
    # omxy combo-R2 HIGH: SIZE-NEUTRAL is a BINDING gate (§2) and is UNIMPLEMENTED here → it must BLOCK any
    # clean positive. So primary&cogate can at most reach ADJUDICATE_PENDING_SIZE_NEUTRAL (a non-clean state
    # that still requires the missing binding gate + human review) — NEVER a clean ADJUDICATE/PASS. else FAIL.
    verdict = "ADJUDICATE_PENDING_SIZE_NEUTRAL" if (primary and cogate) else "FAIL"
    return {"months": len(recs), "lift_ci90": lift_ci, "lift_mean": lift_mean, "ic_ir": ic_ir,
            "primary_pass": bool(primary), "cogate_pass": bool(cogate),
            "size_neutral_status": "UNIMPLEMENTED-blocks-clean-pass", "verdict": verdict}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--combo", required=True, choices=list(GENERATORS))
    args = ap.parse_args()
    V._load_env()
    cache_dir = Path("scripts/out/pit_cache")
    with_earnings = (args.combo == "p5_regime_earnings")
    all_recs, win_meta = [], []
    for name, (s, e) in REGIMES.items():
        print(f"[{args.combo}] {name} ...", file=sys.stderr, flush=True)
        r = run_regime(args.combo, s, e, cache_dir, with_earnings)
        for rec in r["recs"]:
            rec["window"] = name
        all_recs.extend(r["recs"])
        win_meta.append({"window": name, "months": r["months"], "earnings_present_months": r["earnings_present_months"]})
        print(f"[{args.combo}] {name}: {r['months']} months, earn_present={r['earnings_present_months']}",
              file=sys.stderr, flush=True)

    out = {"protocol": "combination-campaign", "combo": args.combo, "diagnostic_only": True,
           "decision_grade": False, "family_k": FAMILY_K, "family_alpha": FAMILY_ALPHA,
           "binding": "recall-lift CI90 lower>0 + IC IR>=0.30 in ALL groups; size-neutral UNIMPLEMENTED→fail-closed; any pass = ADJUDICATE (family-wise K=3)",
           "window_meta": win_meta, "groups": {}}

    # P5 DART fail-closed guard (omxy combo-R1 MED): earnings must actually load, else P5 is void.
    if args.combo == "p5_regime_earnings":
        tot_m = sum(w["months"] for w in win_meta)
        tot_e = sum(w["earnings_present_months"] for w in win_meta)
        if tot_m == 0 or tot_e == 0:
            out["verdict"] = "INVALID_RUN"
            out["invalid_reason"] = f"earnings never loaded ({tot_e}/{tot_m} months) — DART overlay silently dropped"
            Path("scripts/out/combo").mkdir(parents=True, exist_ok=True)
            Path(f"scripts/out/combo/{args.combo}.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
            print(f"\n[{args.combo}] INVALID_RUN: {out['invalid_reason']}", file=sys.stderr)
            return

    # grouping: P5 by ACTUAL bull/not-bull state (spec §4 P5, never pooled); P1/P3 by calendar regime.
    if args.combo == "p5_regime_earnings":
        groups = {"bull": [r for r in all_recs if r["state"] == "bull"],
                  "not_bull": [r for r in all_recs if r["state"] != "bull"]}
        out["grouping"] = "actual-state {bull, not_bull}"
    else:
        groups = {name: [r for r in all_recs if r["window"] == name] for name in REGIMES}
        out["grouping"] = "calendar-regime"

    for g, recs in groups.items():
        gg = gate_group(recs) if recs else {"months": 0, "verdict": "NO_DATA"}
        out["groups"][g] = gg
        ci = gg.get("lift_ci90")
        print(f"[{args.combo}] group={g}: months={gg.get('months')} lift_ci90={ci} "
              f"ic_ir={gg.get('ic_ir')} verdict={gg['verdict']}", file=sys.stderr, flush=True)

    verds = [gg["verdict"] for gg in out["groups"].values()]
    # any clean positive is impossible while size-neutral is unimplemented (omxy combo-R2 HIGH); the best a
    # group can be is ADJUDICATE_PENDING_SIZE_NEUTRAL. Campaign = that pending state iff ALL groups reach it.
    out["all_group_pending"] = all(v == "ADJUDICATE_PENDING_SIZE_NEUTRAL" for v in verds) and len(verds) > 0
    out["campaign_verdict"] = ("ADJUDICATE_PENDING_SIZE_NEUTRAL" if out["all_group_pending"] else "FAIL")
    outpath = Path(f"scripts/out/combo/{args.combo}.json")
    outpath.parent.mkdir(parents=True, exist_ok=True)
    outpath.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"\n[{args.combo}] campaign_verdict={out['campaign_verdict']} (groups: {verds}) → {outpath}", file=sys.stderr)


if __name__ == "__main__":
    main()
