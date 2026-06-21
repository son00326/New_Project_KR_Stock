#!/usr/bin/env python3
# noqa: SIZE_OK - PR-B3 unittest matrix is intentionally self-contained (no shared fixtures).
"""shadow_gen_runner (PR-B3) 테스트 매트릭스 — stdlib unittest (pytest 미설치).

실행:
    cd /Users/yong/New_Project_KR_Stock/scripts
    ./.venv/bin/python -m unittest test_shadow_gen_runner -v

커버리지:
- pure builders: derive_period_key / hypothesis (absent·manual·hash) / snapshot(F4) / unresolved /
  arm payload(F3·GOTCHA-2) / envelope(F5·GOTCHA-1·GOTCHA-3).
- default-OFF seam: --shadow-sector 미지정 → run_bpp_candidates 호출 + shadow 함수 미호출 (mock).
- ON seam: --shadow-sector → run_shadow_bpp_generation_path 호출 + run_bpp_candidates 미호출 (mock).
- §11 grep gate: run_shadow_bpp_generation_path 소스에 production writer 식별자 0건.
- mocked RPC: orchestrator가 build한 payload가 finalize RPC에 단 1회 {'p_payload': ...}로 전달되고
  CONTRACT shape(run-level keys + arms[] + snapshot_rows + unresolved_rows)을 만족.

self-contained: PR-B1 test와 동일하게 fixture builder를 본 파일에 둔다(공유 conftest 없음). 결정론.
"""
from __future__ import annotations

import hashlib
import inspect
import json
import math
import os
import sys
import unittest
from datetime import date
from typing import Any
from unittest import mock

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

import tier0_factors as TF                              # noqa: E402
import screen_shortlist_tier0 as SS                     # noqa: E402
import shadow_gen_core as SG                            # noqa: E402
import shadow_gen_runner as SR                          # noqa: E402
from canonical_sector_mapper import CANONICAL_SECTORS   # noqa: E402


_N = 280                                       # close 시계열 길이 ≥ long lookback
_SECTORS = ("반도체", "바이오", "IT/SW", "금융")   # 전부 canonical-14 (parity-safe)
_MONTH = date(2026, 6, 1)
_SELECTION_ASOF = "2026-06-01T00:05:00Z"


def _bpp_series(n: int, drift: float, wiggle: float = 0.01, phase: float = 0.0) -> list[float]:
    out, v = [], 100.0
    for i in range(n):
        v *= (1.0 + drift + wiggle * math.sin(phase + i * 0.3))
        out.append(v)
    return out


def _universe_stocks(count: int = 200) -> list[TF.StockRaw]:
    """≥150-distinct eligible B++ universe (PR-B1 _universe recipe 차용)."""
    stocks = []
    for k in range(count):
        closes = _bpp_series(_N, 0.0005 + 0.00002 * k, phase=k * 0.1)
        stocks.append(TF.StockRaw(
            ticker=f"{100000 + k:06d}",
            sector=_SECTORS[k % 4],
            market_cap=(k + 1) * 5e10,
            closes=closes,
            trdvals=[5e9 + k * 1e7] * _N,
            highs=list(closes),
            foreign_net_60d=1e9 + k * 1e6,
            earnings_raw=0.05 + 0.001 * k,
            quality_composite_raw=40.0 + (k % 30),
        ))
    return stocks


def _hardgate_universe(
    count: int = 210, *, leading: str = "반도체", other: str = "금융", n_other: int = 20
) -> list[TF.StockRaw]:
    """≥150 leading-sector eligible tickers + a minority `other` sleeve (so the gate cuts n_other)."""
    stocks = []
    for k in range(count):
        closes = _bpp_series(_N, 0.0005 + 0.00002 * k, phase=k * 0.1)
        sector = other if k < n_other else leading
        stocks.append(TF.StockRaw(
            ticker=f"{100000 + k:06d}",
            sector=sector,
            market_cap=(k + 1) * 5e10,
            closes=closes,
            trdvals=[5e9 + k * 1e7] * _N,
            highs=list(closes),
            foreign_net_60d=1e9 + k * 1e6,
            earnings_raw=0.05 + 0.001 * k,
            quality_composite_raw=40.0 + (k % 30),
        ))
    return stocks


def _universe_rows(stocks: list[TF.StockRaw], *, unresolved_tickers: set[str] | None = None) -> list[dict]:
    """fetch_universe + resolve_sectors_for_universe 결과 shape (sector/sector_source/induty_code/name)."""
    unresolved_tickers = unresolved_tickers or set()
    rows = []
    for s in stocks:
        if s.ticker in unresolved_tickers:
            rows.append({
                "ticker": s.ticker, "name": f"n{s.ticker}", "sector": SG.UNRESOLVED,
                "sector_source": "unresolved", "induty_code": None,
            })
        else:
            rows.append({
                "ticker": s.ticker, "name": f"n{s.ticker}", "sector": s.sector,
                "sector_source": "mapper", "induty_code": "264",
            })
    return rows


def _name_by_ticker(stocks: list[TF.StockRaw]) -> dict[str, str]:
    return {s.ticker: f"n{s.ticker}" for s in stocks}


def _absent_hyp() -> dict[str, Any]:
    return SR.build_absent_hypothesis("2026-06", _SELECTION_ASOF)


def _manual_hyp(leading=("반도체",)) -> dict[str, Any]:
    return SR.build_hypothesis_from_env(
        "2026-06", _SELECTION_ASOF,
        env={
            "SHADOW_SECTOR_SOURCE": "manual_pre_registered",
            "SHADOW_LEADING_SECTORS": ",".join(leading),
            "SHADOW_SECTOR_ASOF": "2026-05-31T00:00:00Z",
        },
    )


# ============================================================================
# derive_period_key
# ============================================================================

class DerivePeriodKeyTest(unittest.TestCase):
    def test_monthly_default(self):
        self.assertEqual(SR.derive_period_key(_MONTH, env={}), "2026-06")

    def test_env_monthly_must_match_month(self):
        self.assertEqual(
            SR.derive_period_key(_MONTH, env={"SHADOW_PERIOD_KEY": "2026-06"}), "2026-06"
        )

    def test_env_monthly_mismatch_rejected(self):
        with self.assertRaises(SR.ShadowRunnerError):
            SR.derive_period_key(_MONTH, env={"SHADOW_PERIOD_KEY": "2026-07"})

    def test_env_weekly_accepted(self):
        self.assertEqual(
            SR.derive_period_key(_MONTH, env={"SHADOW_PERIOD_KEY": "2026-W25"}), "2026-W25"
        )

    def test_env_garbage_rejected(self):
        with self.assertRaises(SR.ShadowRunnerError):
            SR.derive_period_key(_MONTH, env={"SHADOW_PERIOD_KEY": "2026/06"})


# ============================================================================
# hypothesis builders + hash (PRB3-1/2/3)
# ============================================================================

class HypothesisTest(unittest.TestCase):
    def test_absent_shape(self):
        h = _absent_hyp()
        self.assertEqual(h["source"], "absent")
        self.assertEqual(h["leading_sectors"], [])
        self.assertEqual(h["params"], {})
        self.assertIsNone(h["as_of"])
        self.assertEqual(h["selection_as_of"], _SELECTION_ASOF)
        self.assertTrue(h["hypothesis_hash"])

    def test_absent_hash_deterministic_excludes_selection_as_of(self):
        h1 = SR.build_absent_hypothesis("2026-06", "2026-06-01T00:05:00Z")
        h2 = SR.build_absent_hypothesis("2026-06", "2026-06-09T23:59:00Z")
        # selection_as_of가 달라도 hash는 동일 (identity에서 제외).
        self.assertEqual(h1["hypothesis_hash"], h2["hypothesis_hash"])

    def test_absent_hash_golden_vector(self):
        # byte-exact pin: 회귀 시 cross-period idempotent register 깨짐.
        expected = hashlib.sha256(
            json.dumps(
                {"period_key": "2026-06", "source": "absent",
                 "leading_sectors": [], "params": {}, "as_of": None},
                sort_keys=True, separators=(",", ":"), ensure_ascii=False,
            ).encode("utf-8")
        ).hexdigest()
        self.assertEqual(_absent_hyp()["hypothesis_hash"], expected)

    def test_manual_shape(self):
        h = _manual_hyp(("반도체", "2차전지"))
        self.assertEqual(h["source"], "manual_pre_registered")
        self.assertEqual(h["leading_sectors"], ["반도체", "2차전지"])
        self.assertEqual(h["as_of"], "2026-05-31T00:00:00Z")
        self.assertTrue(h["hypothesis_hash"])

    def test_manual_hash_canonical_sectors_order_invariant(self):
        a = _manual_hyp(("반도체", "금융"))["hypothesis_hash"]
        b = _manual_hyp(("금융", "반도체"))["hypothesis_hash"]
        self.assertEqual(a, b)

    def test_manual_leading_sectors_canonicalized_to_hash_order(self):
        a = _manual_hyp(("반도체", "금융"))
        b = _manual_hyp(("금융", "반도체"))
        self.assertEqual(a["leading_sectors"], b["leading_sectors"])
        self.assertEqual(a["leading_sectors"], ["반도체", "금융"])

    def test_manual_non_canonical_rejected(self):
        with self.assertRaises(SR.ShadowRunnerError):
            SR.build_hypothesis_from_env(
                "2026-06", _SELECTION_ASOF,
                env={"SHADOW_SECTOR_SOURCE": "manual_pre_registered",
                     "SHADOW_LEADING_SECTORS": "조선",
                     "SHADOW_SECTOR_ASOF": "2026-05-31T00:00:00Z"},
            )

    def test_manual_requires_leading_sectors(self):
        with self.assertRaises(SR.ShadowRunnerError):
            SR.build_hypothesis_from_env(
                "2026-06", _SELECTION_ASOF,
                env={"SHADOW_SECTOR_SOURCE": "manual_pre_registered",
                     "SHADOW_SECTOR_ASOF": "2026-05-31T00:00:00Z"},
            )

    def test_manual_requires_asof(self):
        with self.assertRaises(SR.ShadowRunnerError):
            SR.build_hypothesis_from_env(
                "2026-06", _SELECTION_ASOF,
                env={"SHADOW_SECTOR_SOURCE": "manual_pre_registered",
                     "SHADOW_LEADING_SECTORS": "반도체"},
            )

    def test_manual_asof_must_precede_selection(self):
        with self.assertRaises(SR.ShadowRunnerError):
            SR.build_hypothesis_from_env(
                "2026-06", "2026-06-01T00:05:00Z",
                env={"SHADOW_SECTOR_SOURCE": "manual_pre_registered",
                     "SHADOW_LEADING_SECTORS": "반도체",
                     "SHADOW_SECTOR_ASOF": "2026-06-01T00:05:00Z"},
            )

    def test_unknown_source_rejected(self):
        with self.assertRaises(SR.ShadowRunnerError):
            SR.build_hypothesis_from_env(
                "2026-06", _SELECTION_ASOF, env={"SHADOW_SECTOR_SOURCE": "sector_advisor"}
            )

    def test_env_absent_delegates_to_absent(self):
        h = SR.build_hypothesis_from_env("2026-06", _SELECTION_ASOF, env={})
        self.assertEqual(h["source"], "absent")

    def test_sector_view_identity_subset(self):
        sv = SR.build_sector_view(_manual_hyp(("반도체",)))
        self.assertEqual(set(sv.keys()), {"source", "leadingSectors", "hypothesisHash"})
        self.assertEqual(sv["source"], "manual_pre_registered")
        self.assertEqual(sv["leadingSectors"], ["반도체"])


# ============================================================================
# snapshot rows (F4)
# ============================================================================

class SnapshotRowsTest(unittest.TestCase):
    def setUp(self):
        self.stocks = _universe_stocks(200)
        self.uni = {u["ticker"]: u for u in _universe_rows(self.stocks)}

    def test_distinct_ticker_equals_universe_size(self):
        rows = SR.build_shadow_snapshot_rows(self.stocks, self.uni)
        distinct = {r["ticker"] for r in rows}
        self.assertEqual(len(distinct), 200)

    def test_one_row_per_ticker_bucket(self):
        rows = SR.build_shadow_snapshot_rows(self.stocks, self.uni)
        # 3 buckets × 200 tickers = 600 rows (all eligible in this fixture).
        self.assertEqual(len(rows), 600)
        pairs = {(r["ticker"], r["bucket"]) for r in rows}
        self.assertEqual(len(pairs), 600)

    def test_required_fields_present(self):
        rows = SR.build_shadow_snapshot_rows(self.stocks, self.uni)
        r = rows[0]
        self.assertEqual(set(r.keys()),
                         {"ticker", "name", "sector", "sector_source", "induty_code",
                          "bucket", "rank", "tier0_score"})
        self.assertEqual(r["sector_source"], "mapper")
        self.assertEqual(r["induty_code"], "264")

    def test_sector_source_passthrough_and_unresolved_ok(self):
        # one ticker resolves to 'unresolved' in universe but score 그대로(eligible).
        uni = {u["ticker"]: u for u in _universe_rows(self.stocks, unresolved_tickers={"100000"})}
        # ScoredStock.sector comes from StockRaw.sector (still canonical), but snapshot 'sector' uses sc.sector.
        # For this builder we use sc.sector, so this asserts sector_source/induty passthrough.
        rows = SR.build_shadow_snapshot_rows(self.stocks, uni)
        target = [r for r in rows if r["ticker"] == "100000"]
        self.assertTrue(all(r["sector_source"] == "unresolved" for r in target))

    def test_ineligible_ticker_has_null_rank_and_score(self):
        # craft a stock that is ineligible (ADV below floor → NaN score).
        bad = TF.StockRaw(
            ticker="999999", sector="반도체", market_cap=5e10,
            closes=_bpp_series(_N, 0.0005), trdvals=[1.0] * _N, highs=_bpp_series(_N, 0.0005),
            foreign_net_60d=1e9, earnings_raw=0.05, quality_composite_raw=40.0,
        )
        stocks = self.stocks + [bad]
        uni = {u["ticker"]: u for u in _universe_rows(stocks)}
        rows = SR.build_shadow_snapshot_rows(stocks, uni)
        target = [r for r in rows if r["ticker"] == "999999"]
        # still present in snapshot (distinct count preserved), with null rank+score.
        self.assertEqual(len(target), 3)
        self.assertTrue(all(r["rank"] is None and r["tier0_score"] is None for r in target))
        # distinct ticker still == 201.
        self.assertEqual(len({r["ticker"] for r in rows}), 201)

    def test_json_serializable(self):
        rows = SR.build_shadow_snapshot_rows(self.stocks, self.uni)
        json.dumps(rows)  # must not raise


# ============================================================================
# unresolved rows
# ============================================================================

class UnresolvedRowsTest(unittest.TestCase):
    def test_only_unresolved_emitted(self):
        stocks = _universe_stocks(200)
        universe = _universe_rows(stocks, unresolved_tickers={"100001", "100002"})
        rows = SR.build_unresolved_rows(universe)
        self.assertEqual({r["ticker"] for r in rows}, {"100001", "100002"})
        self.assertNotIn("sector", rows[0])  # FIX-I: no sector field
        self.assertEqual(set(rows[0].keys()), {"ticker", "name", "induty_code", "sector_source"})

    def test_empty_when_all_resolved(self):
        stocks = _universe_stocks(160)
        self.assertEqual(SR.build_unresolved_rows(_universe_rows(stocks)), [])


# ============================================================================
# arm payload (F3, GOTCHA-2)
# ============================================================================

class ArmPayloadTest(unittest.TestCase):
    def setUp(self):
        self.stocks = _universe_stocks(200)
        self.universe = _universe_rows(self.stocks)
        self.name_by_ticker = _name_by_ticker(self.stocks)
        self.absent = _absent_hyp()

    def _mirror_result(self) -> SG.ShadowSelectionsResult:
        return SG.compute_shadow_selections(self.universe, self.stocks, self.absent, "production-mirror")

    def test_logged_mirror_150_rows_50_per_bucket(self):
        result = self._mirror_result()
        arm = SR.build_arm_payload("production-mirror", result, self.name_by_ticker, _MONTH)
        self.assertEqual(arm["arm"], "production-mirror")
        self.assertEqual(arm["status"], "logged")
        self.assertEqual(len(arm["rows"]), 150)
        self.assertEqual(len({r["ticker"] for r in arm["rows"]}), 150)
        for bucket in SS.BUCKETS:
            brows = [r for r in arm["rows"] if r["bucket"] == bucket]
            self.assertEqual(len(brows), 50)
            self.assertEqual({r["rank"] for r in brows}, set(range(1, 51)))

    def test_row_dict_shape_matches_rpc_contract(self):
        result = self._mirror_result()
        arm = SR.build_arm_payload("production-mirror", result, self.name_by_ticker, _MONTH)
        r = arm["rows"][0]
        # candidate_row_to_db_dict keys (month harmless/ignored by RPC).
        self.assertEqual(set(r.keys()),
                         {"month", "ticker", "name", "sector", "bucket", "rank",
                          "tier0_score", "signal_label"})
        self.assertRegex(r["ticker"], r"^[0-9]{6}$")
        self.assertIn(r["bucket"], ("short", "mid", "long"))
        self.assertTrue(1 <= r["rank"] <= 50)

    def test_mirror_no_gate_eligible_size_key(self):
        result = self._mirror_result()
        arm = SR.build_arm_payload("production-mirror", result, self.name_by_ticker, _MONTH)
        self.assertNotIn("gate_eligible_size", arm)
        self.assertEqual(arm["counterfactual_cut"], [])

    def test_soft_tilt_unresolved_sector_legal(self):
        # candidate row sector may be 'unresolved' in shadow — set one stock's sector to unresolved.
        stocks = _universe_stocks(200)
        stocks[0] = TF.StockRaw(
            ticker=stocks[0].ticker, sector=SG.UNRESOLVED, market_cap=stocks[0].market_cap,
            closes=stocks[0].closes, trdvals=stocks[0].trdvals, highs=stocks[0].highs,
            foreign_net_60d=stocks[0].foreign_net_60d, earnings_raw=stocks[0].earnings_raw,
            quality_composite_raw=stocks[0].quality_composite_raw,
        )
        universe = _universe_rows(stocks, unresolved_tickers={stocks[0].ticker})
        result = SG.compute_shadow_selections(universe, stocks, self.absent, "production-mirror")
        arm = SR.build_arm_payload("production-mirror", result, _name_by_ticker(stocks), _MONTH)
        sectors = {r["sector"] for r in arm["rows"]}
        # 'unresolved' is among allowed shadow candidate sectors (canonical-14 ∪ unresolved).
        self.assertTrue(sectors.issubset(set(CANONICAL_SECTORS) | {SG.UNRESOLVED}))

    def test_hard_gate_carries_gate_eligible_size_and_counterfactual(self):
        # hard-gate needs ≥150 gated tickers across sleeves to log; use a mostly-반도체 universe with a
        # minority 금융 sleeve so the gate still cuts something (non-empty counterfactual_cut).
        stocks = _hardgate_universe(count=210, leading="반도체", other="금융", n_other=20)
        universe = _universe_rows(stocks)
        manual = _manual_hyp(("반도체",))
        result = SG.compute_shadow_selections(universe, stocks, manual, "sector-hard-gate")
        arm = SR.build_arm_payload("sector-hard-gate", result, _name_by_ticker(stocks), _MONTH)
        self.assertIn("gate_eligible_size", arm)
        self.assertIsInstance(arm["gate_eligible_size"], int)
        self.assertGreaterEqual(arm["gate_eligible_size"], 150)
        # counterfactual_cut = full−gated (the 20 금융 tickers cut).
        self.assertEqual(len(arm["counterfactual_cut"]), 20)

    def test_incomplete_run_status_no_150_gate(self):
        # status='incomplete_run' → rows=[] regardless of arm_result selections (150-gate skipped).
        # hard-gate arm still requires gate_eligible_size; forge a hard-gate-shaped result.
        result = {
            "selections": self._mirror_result()["selections"], "counterfactual_cut": ["999999"],
            "sector_distribution": {"반도체": 30}, "universe_hash": "h", "universe_size": 200,
            "gate_eligible_size": 10,
        }
        arm = SR.build_arm_payload(
            "sector-hard-gate", result, self.name_by_ticker, _MONTH,
            status="incomplete_run", error="sleeve unfillable",
        )
        self.assertEqual(arm["status"], "incomplete_run")
        self.assertEqual(arm["rows"], [])
        self.assertEqual(arm["error"], "sleeve unfillable")
        self.assertEqual(arm["gate_eligible_size"], 10)

    def test_none_result_empty_rows(self):
        arm = SR.build_arm_payload(
            "sector-soft-tilt", None, self.name_by_ticker, _MONTH,
            status="invalid_input", error="bad config",
        )
        self.assertEqual(arm["rows"], [])
        self.assertEqual(arm["counterfactual_cut"], [])
        self.assertEqual(arm["sector_distribution"], {})

    def test_unknown_arm_rejected(self):
        with self.assertRaises(SR.ShadowRunnerError):
            SR.build_arm_payload("evil-arm", None, self.name_by_ticker, _MONTH, status="invalid_input")

    def test_hard_gate_missing_gate_eligible_size_rejected(self):
        # forge a result dict with gate_eligible_size None for hard-gate → builder must reject.
        bad_result = {
            "selections": {b: [] for b in SS.BUCKETS}, "counterfactual_cut": [],
            "sector_distribution": {}, "universe_hash": "h", "universe_size": 200,
            "gate_eligible_size": None,
        }
        with self.assertRaises(SR.ShadowRunnerError):
            SR.build_arm_payload("sector-hard-gate", bad_result, self.name_by_ticker, _MONTH,
                                 status="incomplete_run")

    def test_hard_gate_incomplete_result_carries_gate_eligible_size(self):
        stocks = _hardgate_universe(count=200, leading="반도체", other="금융", n_other=180)
        manual = _manual_hyp(("반도체",))
        result = SR.build_hard_gate_incomplete_result(stocks, manual)
        arm = SR.build_arm_payload(
            "sector-hard-gate", result, _name_by_ticker(stocks), _MONTH,
            status="incomplete_run", error="underfill",
        )
        self.assertEqual(arm["gate_eligible_size"], 20)
        self.assertEqual(len(arm["counterfactual_cut"]), 180)
        self.assertEqual(arm["rows"], [])


# ============================================================================
# envelope (F5, GOTCHA-1/3, CONTRACT-1)
# ============================================================================

class AssembleFinalizePayloadTest(unittest.TestCase):
    def setUp(self):
        self.stocks = _universe_stocks(200)
        self.universe = _universe_rows(self.stocks)
        self.name_by_ticker = _name_by_ticker(self.stocks)
        self.absent = _absent_hyp()
        self.mirror_result = SG.compute_shadow_selections(
            self.universe, self.stocks, self.absent, "production-mirror"
        )
        self.snapshot = SR.build_shadow_snapshot_rows(
            self.stocks, {u["ticker"]: u for u in self.universe}
        )
        self.mirror_arm = SR.build_arm_payload(
            "production-mirror", self.mirror_result, self.name_by_ticker, _MONTH
        )

    def _envelope(self, arms, **over):
        kwargs = dict(
            period_key="2026-06", month=_MONTH, run_id="run-A", hypothesis_id="hyp-id",
            hypothesis=self.absent, arm_payloads=arms, snapshot_rows=self.snapshot,
            unresolved_rows=[], universe_hash=self.mirror_result["universe_hash"],
            universe_size=self.mirror_result["universe_size"], run_date=_SELECTION_ASOF,
        )
        kwargs.update(over)
        return SR.assemble_finalize_payload(**kwargs)

    def test_run_level_keys_present(self):
        env = self._envelope([self.mirror_arm])
        for key in ("period_key", "month", "run_id", "hypothesis_id", "universe_hash",
                    "universe_size", "sector_view", "snapshot_rows", "arms", "unresolved_rows",
                    "run_date"):
            self.assertIn(key, env)
        self.assertEqual(env["month"], "2026-06")
        self.assertEqual(env["universe_size"], 200)

    def test_run_level_keys_not_duplicated_in_arms(self):
        # F5: arm objects must NOT carry run-level keys.
        env = self._envelope([self.mirror_arm])
        run_level = {"period_key", "month", "run_id", "hypothesis_id", "universe_hash",
                     "universe_size", "sector_view", "run_date"}
        for arm in env["arms"]:
            self.assertEqual(set(arm.keys()) & run_level, set())

    def test_sector_view_is_identity_subset(self):
        env = self._envelope([self.mirror_arm])
        self.assertEqual(set(env["sector_view"].keys()),
                         {"source", "leadingSectors", "hypothesisHash"})

    def test_soft_only_rejected_gotcha1(self):
        soft = SR.build_arm_payload("sector-soft-tilt", self.mirror_result, self.name_by_ticker, _MONTH)
        with self.assertRaises(SR.ShadowRunnerError):
            self._envelope([soft])

    def test_duplicate_arm_rejected(self):
        with self.assertRaises(SR.ShadowRunnerError):
            self._envelope([self.mirror_arm, self.mirror_arm])

    def test_too_many_arms_rejected(self):
        soft = SR.build_arm_payload("sector-soft-tilt", self.mirror_result, self.name_by_ticker, _MONTH)
        hg = SR.build_arm_payload("sector-soft-tilt", self.mirror_result, self.name_by_ticker, _MONTH)
        with self.assertRaises(SR.ShadowRunnerError):
            self._envelope([self.mirror_arm, soft, hg, self.mirror_arm])

    def test_snapshot_too_small_rejected_gotcha3(self):
        with self.assertRaises(SR.ShadowRunnerError):
            self._envelope([self.mirror_arm], snapshot_rows=self.snapshot[:100])

    def test_snapshot_distinct_mismatch_rejected(self):
        # duplicate a ticker's bucket entry to keep length but break distinct count parity.
        dup = list(self.snapshot)
        dup.append(dict(self.snapshot[0], bucket="mid"))  # length 601, distinct still 200
        with self.assertRaises(SR.ShadowRunnerError):
            self._envelope([self.mirror_arm], snapshot_rows=dup, universe_size=201)

    def test_universe_size_below_150_rejected(self):
        with self.assertRaises(SR.ShadowRunnerError):
            self._envelope([self.mirror_arm], universe_size=149)

    def test_run_date_optional(self):
        env = self._envelope([self.mirror_arm], run_date=None)
        self.assertNotIn("run_date", env)

    def test_json_serializable_end_to_end(self):
        env = self._envelope([self.mirror_arm])
        json.dumps(env)


# ============================================================================
# seam: default-OFF byte-identical + ON dispatch (mock)
# ============================================================================

class SeamDispatchTest(unittest.TestCase):
    """main()의 B++ dispatch: --shadow-sector OFF → run_bpp_candidates / ON → shadow path.

    fetch/prefetch/signal 단계는 mock으로 우회하고 dispatch만 검증한다.
    """

    def _run_main(self, argv):
        def _resolve(u, **k):
            for row in u:
                row.setdefault("sector", "반도체")
                row.setdefault("sector_source", "mapper")
                row.setdefault("induty_code", "264")
            return u

        with mock.patch.object(sys, "argv", argv), \
             mock.patch.object(SS, "fetch_universe", return_value=[{"ticker": "100000", "name": "n", "market_cap_won": 5e10}]), \
             mock.patch.object(SS, "resolve_sectors_for_universe", side_effect=_resolve), \
             mock.patch.object(SS, "prefetch_price_series", return_value={}), \
             mock.patch.object(SS, "fetch_price_signals", return_value={"momentum_raw": 0.0, "volume_surge_raw": 0.0, "volatility_raw": 0.0}), \
             mock.patch.object(SS, "fetch_foreign_signal", return_value=(0.0, False)), \
             mock.patch.object(SS, "fetch_dart_signals") as dart, \
             mock.patch.object(SS, "run_bpp_candidates") as rbc, \
             mock.patch.object(SS, "run_shadow_bpp_generation_path") as shadow, \
             mock.patch.dict(os.environ, {}, clear=True):
            dart.return_value = mock.Mock(
                earnings_raw=0.0, quality_raw_metrics={}, signal_4_basis="not_applicable",
                quality_insufficient=True,
            )
            SS.main()
        return rbc, shadow

    def test_off_calls_run_bpp_candidates_only(self):
        argv = ["screen_shortlist_tier0.py", "--month", "2026-06-01", "--dry-run",
                "--csv-backup", "/tmp/x.csv", "--scoring", "bpp", "--emit-candidates"]
        rbc, shadow = self._run_main(argv)
        rbc.assert_called_once()
        shadow.assert_not_called()

    def test_on_calls_shadow_path_only(self):
        argv = ["screen_shortlist_tier0.py", "--month", "2026-06-01", "--dry-run",
                "--csv-backup", "/tmp/x.csv", "--scoring", "bpp", "--emit-candidates",
                "--shadow-sector"]
        rbc, shadow = self._run_main(argv)
        shadow.assert_called_once()
        rbc.assert_not_called()

    def test_off_default_no_shadow_no_finalize(self):
        # default (no --shadow-sector) under bpp: run_bpp_candidates only, shadow path never reached.
        argv = ["screen_shortlist_tier0.py", "--month", "2026-06-01", "--dry-run",
                "--csv-backup", "/tmp/x.csv", "--scoring", "bpp", "--emit-candidates"]
        rbc, shadow = self._run_main(argv)
        rbc.assert_called_once()
        shadow.assert_not_called()

    def test_shadow_sector_with_legacy_scoring_is_rejected(self):
        # ce-review HIGH/P1 (FINDING-A): --shadow-sector under the default --scoring legacy MUST hard-fail
        #   (parser.error → SystemExit), NOT silently fall through to the production money-path write.
        argv = ["screen_shortlist_tier0.py", "--month", "2026-06-01", "--apply",
                "--csv-backup", "/tmp/x.csv", "--scoring", "legacy", "--shadow-sector"]
        with self.assertRaises(SystemExit):
            self._run_main(argv)

    def test_shadow_sector_default_scoring_is_rejected(self):
        # FINDING-A: omitting --scoring (default legacy) + --shadow-sector also hard-fails.
        argv = ["screen_shortlist_tier0.py", "--month", "2026-06-01", "--dry-run",
                "--csv-backup", "/tmp/x.csv", "--shadow-sector"]
        with self.assertRaises(SystemExit):
            self._run_main(argv)


# ============================================================================
# §11 grep gate: orchestrator must not reference production writers.
# ============================================================================

class GrepGateTest(unittest.TestCase):
    def test_orchestrator_has_no_production_writers(self):
        src = inspect.getsource(SS.run_shadow_bpp_generation_path)
        for forbidden in (
            "upsert_candidates_supabase",
            "upsert_supabase",
            "enforce_b89_strict_block",
            "run_bpp_candidates",
        ):
            self.assertNotIn(forbidden, src,
                             f"shadow orchestrator must not reference {forbidden}")

    def test_orchestrator_uses_finalize_rpc(self):
        src = inspect.getsource(SS.run_shadow_bpp_generation_path)
        self.assertIn("upsert_tier0_shadow_run", src)
        self.assertIn("register_shadow_hypothesis", src)


# ============================================================================
# orchestrator → finalize RPC (mocked client): exactly one p_payload call, contract shape.
# ============================================================================

class OrchestratorRpcTest(unittest.TestCase):
    def _fake_client(self, captured):
        class _Exec:
            def __init__(self, data):
                self._data = data

            def execute(self):
                return mock.Mock(data=self._data)

        class _Client:
            def rpc(self, name, params):
                captured.append((name, params))
                if name == "register_shadow_hypothesis":
                    return _Exec({"id": "00000000-0000-0000-0000-000000000001"})
                return _Exec({"run_id": params["p_payload"]["run_id"], "snapshot": 600,
                              "candidates": 150, "unresolved": 0, "arms": 1})

        return _Client()

    def _run(self, env, *, stocks_override=None):
        stocks = stocks_override or _universe_stocks(200)
        universe = _universe_rows(stocks)
        signals = [
            SS.StockSignal(ticker=u["ticker"], name=u["name"], sector=u["sector"],
                           market_cap_won=u["market_cap_won"] if "market_cap_won" in u else 5e10)
            for u in universe
        ]
        # build_stock_raw_list needs price_series; supply directly via mocked build.
        captured: list = []
        args = mock.Mock(month=_MONTH)

        with mock.patch.object(SS, "build_stock_raw_list", return_value=stocks), \
             mock.patch.object(SS, "get_supabase_client", return_value=self._fake_client(captured)), \
             mock.patch.dict(os.environ, env, clear=True):
            SS.run_shadow_bpp_generation_path(
                args, signals, {}, universe, dart_available=False
            )
        return captured

    def test_requires_generator_enabled(self):
        with self.assertRaises(SystemExit):
            self._run({"SHADOW_GENERATOR_ENABLED": "false"})

    def test_absent_single_finalize_call_contract(self):
        captured = self._run({
            "SHADOW_GENERATOR_ENABLED": "true",
            "SHADOW_SECTOR_SOURCE": "absent",
            "SHADOW_RUN_ID": "run-T",
        })
        names = [c[0] for c in captured]
        self.assertEqual(names.count("register_shadow_hypothesis"), 1)
        self.assertEqual(names.count("upsert_tier0_shadow_run"), 1)
        finalize = [c for c in captured if c[0] == "upsert_tier0_shadow_run"][0]
        payload = finalize[1]["p_payload"]
        # CONTRACT-1 run-level keys.
        for key in ("period_key", "month", "run_id", "hypothesis_id", "universe_hash",
                    "universe_size", "sector_view", "snapshot_rows", "arms", "unresolved_rows"):
            self.assertIn(key, payload)
        self.assertEqual(payload["run_id"], "run-T")
        self.assertEqual(payload["hypothesis_id"], "00000000-0000-0000-0000-000000000001")
        # default arms = production-mirror only.
        self.assertEqual([a["arm"] for a in payload["arms"]], ["production-mirror"])
        self.assertEqual(len(payload["arms"][0]["rows"]), 150)
        json.dumps(payload)

    # F1: manual_pre_registered MUST use the USER-pre-registered SHADOW_HYPOTHESIS_ID and MUST NOT self-register
    # (run-time selection_as_of self-register would defeat forward-integrity + fail register content-recheck).
    _MANUAL_HID = "0000aaaa-0000-0000-0000-000000000099"
    _MANUAL_ENV = {
        "SHADOW_GENERATOR_ENABLED": "true",
        "SHADOW_SECTOR_SOURCE": "manual_pre_registered",
        "SHADOW_HYPOTHESIS_ID": _MANUAL_HID,
        "SHADOW_LEADING_SECTORS": "반도체",
        "SHADOW_SECTOR_ASOF": "2026-05-31T00:00:00Z",
    }

    def test_mirror_plus_soft_arms(self):
        captured = self._run({**self._MANUAL_ENV,
                              "SHADOW_GEN_ARMS": "production-mirror,sector-soft-tilt"})
        finalize = [c for c in captured if c[0] == "upsert_tier0_shadow_run"][0]
        arms = [a["arm"] for a in finalize[1]["p_payload"]["arms"]]
        self.assertEqual(arms, ["production-mirror", "sector-soft-tilt"])

    def test_non_mirror_first_still_includes_mirror(self):
        captured = self._run({**self._MANUAL_ENV, "SHADOW_GEN_ARMS": "sector-soft-tilt"})
        finalize = [c for c in captured if c[0] == "upsert_tier0_shadow_run"][0]
        arms = [a["arm"] for a in finalize[1]["p_payload"]["arms"]]
        self.assertIn("production-mirror", arms)

    def test_manual_uses_pre_registered_id_and_does_not_self_register(self):
        # F1: manual flow must NOT call register_shadow_hypothesis and must use SHADOW_HYPOTHESIS_ID verbatim.
        captured = self._run({**self._MANUAL_ENV, "SHADOW_GEN_ARMS": "production-mirror,sector-soft-tilt"})
        names = [c[0] for c in captured]
        self.assertEqual(names.count("register_shadow_hypothesis"), 0,
                         "manual_pre_registered must NOT self-register (USER pre-registers)")
        self.assertEqual(names.count("upsert_tier0_shadow_run"), 1)
        payload = [c for c in captured if c[0] == "upsert_tier0_shadow_run"][0][1]["p_payload"]
        self.assertEqual(payload["hypothesis_id"], self._MANUAL_HID)
        self.assertEqual(payload["sector_view"]["source"], "manual_pre_registered")
        self.assertEqual(payload["sector_view"]["leadingSectors"], ["반도체"])

    def test_manual_without_hypothesis_id_aborts(self):
        # F1: manual without SHADOW_HYPOTHESIS_ID is a hard fail (no silent self-register).
        env = {k: v for k, v in self._MANUAL_ENV.items() if k != "SHADOW_HYPOTHESIS_ID"}
        with self.assertRaises(SystemExit):
            self._run({**env, "SHADOW_GEN_ARMS": "production-mirror,sector-soft-tilt"})

    def test_hard_gate_underfill_finalizes_incomplete_with_gate_size(self):
        stocks = _hardgate_universe(count=200, leading="반도체", other="금융", n_other=180)
        captured = self._run(
            {**self._MANUAL_ENV, "SHADOW_GEN_ARMS": "sector-hard-gate"},
            stocks_override=stocks,
        )
        payload = [c for c in captured if c[0] == "upsert_tier0_shadow_run"][0][1]["p_payload"]
        hard_gate = [a for a in payload["arms"] if a["arm"] == "sector-hard-gate"][0]
        self.assertEqual(hard_gate["status"], "incomplete_run")
        self.assertEqual(hard_gate["gate_eligible_size"], 20)
        self.assertEqual(hard_gate["rows"], [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
