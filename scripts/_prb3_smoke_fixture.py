#!/usr/bin/env python3
"""PR-B3 ↔ PR-B2 connection-verification fixture (used by pg_smoke_0039_prb3.sh).

Builds a REAL Track 2 finalize payload through the production code path
  PR-B1 shadow_gen_core.compute_shadow_selections → PR-B3 shadow_gen_runner builders
and prints it as JSON so the smoke can feed it to the APPLIED migration-0039
upsert_tier0_shadow_run RPC on a throwaway local-PG temp DB.

This is verification ONLY (temp DB, no production, no Supabase apply, no network).
The universe recipe intentionally mirrors the proven ≥150-eligible unit-test shape,
but is local here so the smoke fixture does not import test modules.

Usage:
  python3 _prb3_smoke_fixture.py hypothesis            # → absent hypothesis register payload
  SMOKE_HYPOTHESIS_ID=<uuid> [SMOKE_ARMS=a,b] [SMOKE_MODE=mirror_only|...] \
    python3 _prb3_smoke_fixture.py payload             # → finalize payload
"""
from __future__ import annotations

import json
import math
import os
import sys
from datetime import date

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

import shadow_gen_core as SG          # noqa: E402
import shadow_gen_runner as SR        # noqa: E402
import tier0_factors as TF            # noqa: E402

PERIOD_KEY = "2026-06"
MONTH = date(2026, 6, 1)
SELECTION_AS_OF = "2026-06-01T00:05:00Z"
_N = 280
_SECTORS = ("반도체", "바이오", "IT/SW", "금융")


def _bpp_series(n: int, drift: float, wiggle: float = 0.01, phase: float = 0.0) -> list[float]:
    out, value = [], 100.0
    for i in range(n):
        value *= 1.0 + drift + wiggle * math.sin(phase + i * 0.3)
        out.append(value)
    return out


def _universe_stocks(count: int = 200) -> list[TF.StockRaw]:
    stocks = []
    for k in range(count):
        closes = _bpp_series(_N, 0.0005 + 0.00002 * k, phase=k * 0.1)
        stocks.append(TF.StockRaw(
            ticker=f"{100000 + k:06d}",
            sector=_SECTORS[k % len(_SECTORS)],
            market_cap=(k + 1) * 5e10,
            closes=closes,
            trdvals=[5e9 + k * 1e7] * _N,
            highs=list(closes),
            foreign_net_60d=1e9 + k * 1e6,
            earnings_raw=0.05 + 0.001 * k,
            quality_composite_raw=40.0 + (k % 30),
        ))
    return stocks


def _hardgate_underfill_stocks(count: int = 200) -> list[TF.StockRaw]:
    stocks = _universe_stocks(count)
    for idx, stock in enumerate(stocks):
        stock.sector = "반도체" if idx < 20 else "금융"
    return stocks


def _universe_rows(stocks: list[TF.StockRaw]) -> list[dict]:
    return [{
        "ticker": stock.ticker,
        "name": f"n{stock.ticker}",
        "sector": stock.sector,
        "sector_source": "mapper",
        "induty_code": "264",
    } for stock in stocks]


def _manual_underfill_hypothesis() -> dict:
    return {
        "period_key": PERIOD_KEY,
        "source": "manual_pre_registered",
        "leading_sectors": ["반도체"],
        "params": {},
        "as_of": "2026-05-31T00:00:00Z",
        "selection_as_of": SELECTION_AS_OF,
        "hypothesis_hash": SR.compute_hypothesis_hash(
            PERIOD_KEY, "manual_pre_registered", ["반도체"], {}, "2026-05-31T00:00:00Z"
        ),
    }


def _build_payload(
    hypothesis_id: str,
    arms: list[str],
    *,
    drop_mirror: bool = False,
    hardgate_underfill: bool = False,
) -> dict:
    stocks = _hardgate_underfill_stocks(200) if hardgate_underfill else _universe_stocks(200)
    universe = _universe_rows(stocks)
    name_by_ticker = {u["ticker"]: u["name"] for u in universe}
    uni_by_ticker = {u["ticker"]: u for u in universe}
    hypothesis = (
        _manual_underfill_hypothesis()
        if hardgate_underfill
        else SR.build_absent_hypothesis(PERIOD_KEY, SELECTION_AS_OF)
    )

    active = ["production-mirror"] + [a for a in arms if a != "production-mirror"]
    if drop_mirror:  # negative case: violate production_mirror_required_for_paired_run
        active = [a for a in active if a != "production-mirror"] or ["sector-soft-tilt"]

    arm_payloads = []
    mirror_result = None
    for arm in active:
        status, error, arm_result = "logged", None, None
        try:
            arm_result = SG.compute_shadow_selections(universe, stocks, hypothesis, arm)
        except SG.ShadowIncompleteRunError as exc:
            status, error = "incomplete_run", str(exc)
            if arm == "sector-hard-gate":
                arm_result = SR.build_hard_gate_incomplete_result(stocks, hypothesis)
        if arm == "production-mirror" and arm_result is not None:
            mirror_result = arm_result
        arm_payloads.append(
            SR.build_arm_payload(arm, arm_result, name_by_ticker, MONTH, status=status, error=error)
        )

    # for drop_mirror we still need universe_hash/size — compute mirror separately (not added to arms).
    if mirror_result is None:
        mirror_result = SG.compute_shadow_selections(universe, stocks, hypothesis, "production-mirror")

    snapshot_rows = SR.build_shadow_snapshot_rows(stocks, uni_by_ticker)
    unresolved_rows = SR.build_unresolved_rows(universe)
    return SR.assemble_finalize_payload(
        period_key=PERIOD_KEY,
        month=MONTH,
        run_id=os.environ.get("SMOKE_RUN_ID", "prb3-smoke"),
        hypothesis_id=hypothesis_id,
        hypothesis=hypothesis,
        arm_payloads=arm_payloads,
        snapshot_rows=snapshot_rows,
        unresolved_rows=unresolved_rows,
        universe_hash=mirror_result["universe_hash"],
        universe_size=mirror_result["universe_size"],
        run_date=SELECTION_AS_OF,
    )


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "payload"
    if mode == "hypothesis":
        print(json.dumps(SR.build_absent_hypothesis(PERIOD_KEY, SELECTION_AS_OF), ensure_ascii=False))
        return
    if mode == "hypothesis_manual_underfill":
        print(json.dumps(_manual_underfill_hypothesis(), ensure_ascii=False))
        return
    hid = os.environ.get("SMOKE_HYPOTHESIS_ID")
    if not hid:
        sys.exit("SMOKE_HYPOTHESIS_ID required for payload mode")
    arms = [a for a in (os.environ.get("SMOKE_ARMS", "production-mirror").split(",")) if a]
    # assemble_finalize_payload enforces production_mirror_required on the Python side for drop_mirror,
    # so build the drop-mirror negative as a raw dict bypassing that guard (to exercise the RPC guard).
    if os.environ.get("SMOKE_DROP_MIRROR") == "1":
        p = _build_payload(hid, ["sector-soft-tilt"])
        p["arms"] = [a for a in p["arms"] if a["arm"] != "production-mirror"]
        if not p["arms"]:  # ensure a non-mirror arm remains so the RPC sees the violation
            p["arms"] = [{"arm": "sector-soft-tilt", "status": "incomplete_run",
                          "rows": [], "counterfactual_cut": [], "sector_distribution": {}}]
        print(json.dumps(p, ensure_ascii=False))
        return
    print(json.dumps(
        _build_payload(
            hid,
            arms,
            hardgate_underfill=os.environ.get("SMOKE_MODE") == "hardgate_underfill",
        ),
        ensure_ascii=False,
    ))


if __name__ == "__main__":
    main()
