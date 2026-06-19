"""Unittest for (C) NET-SHARE-ISSUANCE — tier0_factors helpers + flag byte-identical + driver wiring.

SoT: docs/superpowers/2026-06-18-tier0-net-issuance.md
PIT-proof / split-detection / neutral-50 / signed-negated component / orthogonality / marginal+standalone
wiring / cfg1-4 byte-identical default-OFF.
"""
from __future__ import annotations

import math
import json
import sys
import tempfile
import unittest
from pathlib import Path

_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_DIR))
import tier0_factors as F  # noqa: E402
import run_net_issuance_falsification as R  # noqa: E402
import probe_list_shrs_pit as P  # noqa: E402


def _mk(tk, cap, closes, shrs, sector="제조"):
    return F.StockRaw(ticker=tk, sector=sector, market_cap=cap, closes=list(closes),
                      trdvals=[5e9] * len(closes), list_shrs=(list(shrs) if shrs is not None else None))


def _trend_universe(n_days=260, n=14, shrs_fn=None):
    """eligible-on-all-buckets universe: rising prices, fat ADV, distinct mcaps."""
    base = [100.0 * (1.0015 ** i) for i in range(n_days)]
    out = []
    for j in range(n):
        cl = [c * (1 + 0.02 * j) for c in base]
        shrs = shrs_fn(j, n_days) if shrs_fn else [1e8] * n_days
        out.append(_mk(f"T{j:02d}", 1e12 * (j + 1), cl, shrs))
    return out


# ============================================================================
# issuance_return / split_like / net_issuance_signed_raw
# ============================================================================

class TestIssuanceReturn(unittest.TestCase):
    def test_basic_ratio(self):
        s = [100.0] * 200 + [120.0]  # last/first-of-window
        # lookback 63: last=120, [-1-63] within the 100-block
        self.assertAlmostEqual(F.issuance_return(s, 63), 120.0 / 100.0 - 1.0, places=9)

    def test_insufficient_returns_nan(self):
        self.assertTrue(math.isnan(F.issuance_return([100.0] * 10, 63)))

    def test_nonpositive_denominator_nan(self):
        # denominator is list_shrs[-1-63]; put the 0.0 exactly there (index -64).
        s = [100.0] * 64
        s[-64] = 0.0  # = s[0], the lookback-63 reference for a 64-len series
        self.assertTrue(math.isnan(F.issuance_return(s, 63)))


class TestSplitLike(unittest.TestCase):
    def test_clean_split_detected(self):
        n = 260
        shrs = [1e8] * (n - 1) + [2e8]      # 2x shares
        closes = [100.0] * (n - 1) + [50.0]  # 1/2 price -> mcap continuous
        self.assertTrue(F.split_like(shrs, closes, 252))

    def test_split_inside_window_with_trend_detected(self):
        n = 260
        shrs = [1e8] * n
        closes = [100.0 * (1.002 ** i) for i in range(n)]
        split_i = 200
        for i in range(split_i, n):
            shrs[i] = 2e8
            closes[i] *= 0.5
        self.assertTrue(F.split_like(shrs, closes, 252))

    def test_extreme_jump_detected_regardless_of_price(self):
        n = 260
        shrs = [24450336.0] * (n - 1) + [97801344.0]  # ~4x
        closes = [110000.0] * n                        # flat price (NOT clean split)
        self.assertTrue(F.split_like(shrs, closes, 252))

    def test_reverse_split_detected(self):
        n = 260
        shrs = [2e8] * (n - 1) + [1e8]
        closes = [50.0] * (n - 1) + [100.0]
        self.assertTrue(F.split_like(shrs, closes, 252))

    def test_genuine_dilution_not_split(self):
        # 한화오션 type: ~2x shares, flat price, mcap doubles -> NOT split, NOT extreme.
        n = 260
        shrs = [107290669.0] * (n - 1) + [211729312.0]
        closes = [29000.0] * n
        self.assertFalse(F.split_like(shrs, closes, 252))

    def test_small_change_not_split(self):
        n = 260
        shrs = [1e8] * (n - 1) + [1.05e8]
        closes = [100.0] * n
        self.assertFalse(F.split_like(shrs, closes, 252))


class TestNetIssuanceSignedRaw(unittest.TestCase):
    def test_diluter_negative_raw(self):
        n = 260
        shrs = [1e8 * (1 + 0.0008 * i) for i in range(n)]  # +~20%/12m dilution
        raw, spl, ext = F.net_issuance_signed_raw(shrs, [100.0] * n)
        self.assertFalse(spl)
        self.assertFalse(ext)
        self.assertLess(raw, 0.0)  # negated: diluter -> negative -> low rank

    def test_shrinker_positive_raw(self):
        n = 260
        shrs = [1e8 * (1 - 0.0004 * i) for i in range(n)]  # buyback
        raw, _spl, _ext = F.net_issuance_signed_raw(shrs, [100.0] * n)
        self.assertGreater(raw, 0.0)  # negated: shrink -> positive -> high rank

    def test_none_list_shrs_is_nan(self):
        raw, spl, ext = F.net_issuance_signed_raw(None, [100.0] * 260)
        self.assertTrue(math.isnan(raw))
        self.assertFalse(spl or ext)

    def test_split_neutralized_to_nan(self):
        n = 260
        shrs = [1e8] * (n - 1) + [2e8]
        closes = [100.0] * (n - 1) + [50.0]
        raw, spl, ext = F.net_issuance_signed_raw(shrs, closes)
        self.assertTrue(math.isnan(raw))
        self.assertTrue(spl)

    def test_extreme_neutralized_to_nan(self):
        n = 260
        shrs = [24450336.0] * (n - 1) + [97801344.0]
        closes = [110000.0] * n
        raw, spl, ext = F.net_issuance_signed_raw(shrs, closes)
        self.assertTrue(math.isnan(raw))
        self.assertTrue(ext)

    def test_reverse_split_neutralized_to_nan(self):
        n = 260
        shrs = [2e8] * (n - 1) + [1e8]
        closes = [50.0] * (n - 1) + [100.0]
        raw, spl, ext = F.net_issuance_signed_raw(shrs, closes)
        self.assertTrue(math.isnan(raw))
        self.assertTrue(spl)

    def test_genuine_two_x_dilution_kept_negative(self):
        n = 260
        shrs = [107290669.0] * (n - 1) + [211729312.0]
        raw, spl, ext = F.net_issuance_signed_raw(shrs, [29000.0] * n)
        self.assertFalse(spl)
        self.assertFalse(ext)
        self.assertLess(raw, 0.0)


# ============================================================================
# score_bpp_universe — byte-identical default-OFF + equal signed-negated component ON
# ============================================================================

class TestScoreFlag(unittest.TestCase):
    def test_default_off_is_byte_identical(self):
        u = _trend_universe()
        for b in ("short", "mid", "long"):
            off = F.score_bpp_universe(u, b)                       # default
            off2 = F.score_bpp_universe(u, b, with_issuance=False)  # explicit
            for a, c in zip(off, off2):
                self.assertEqual(a.factor_ranks, c.factor_ranks)
                self.assertTrue(
                    (math.isnan(a.score) and math.isnan(c.score)) or a.score == c.score)
                self.assertNotIn("issuance", a.factor_ranks)

    def test_default_off_ignores_hostile_list_shrs(self):
        stable = _trend_universe()
        hostile = _trend_universe(shrs_fn=lambda j, n: [1e8 * (1 + (j + 1) * 0.002 * i) for i in range(n)])
        for b in ("short", "mid", "long"):
            a = F.score_bpp_universe(stable, b)
            c = F.score_bpp_universe(hostile, b)
            self.assertEqual([x.ticker for x in a], [x.ticker for x in c])
            self.assertEqual([x.factor_ranks for x in a], [x.factor_ranks for x in c])
            self.assertEqual([x.score for x in a], [x.score for x in c])

    def test_on_adds_exactly_one_equal_component(self):
        u = _trend_universe()
        on = F.score_bpp_universe(u, "short", with_issuance=True)
        elig = [x for x in on if x.eligible]
        self.assertTrue(elig)
        for x in elig:
            self.assertIn("issuance", x.factor_ranks)
            self.assertEqual(len(x.factor_ranks), 5)  # trend/foreign/earnings/quality/issuance
            # equal-mean: score == mean(present ranks) + bonus - penalty.
            present = [v for v in x.factor_ranks.values() if not math.isnan(v)]
            expected = sum(present) / len(present) + x.volume_bonus - max(0.0, x.penalty)
            self.assertAlmostEqual(x.score, expected, places=6)

    def test_diluter_ranks_below_shrinker(self):
        def shrs_fn(j, n):
            if j < 7:
                return [1e8 * (1 + 0.0008 * i) for i in range(n)]   # diluters
            return [1e8 * (1 - 0.0004 * i) for i in range(n)]       # shrinkers
        u = _trend_universe(shrs_fn=shrs_fn)
        on = {x.ticker: x for x in F.score_bpp_universe(u, "short", with_issuance=True) if x.eligible}
        dil = [on[t].factor_ranks["issuance"] for t in on if int(t[1:]) < 7]
        shr = [on[t].factor_ranks["issuance"] for t in on if int(t[1:]) >= 7]
        self.assertLess(sum(dil) / len(dil), sum(shr) / len(shr))

    def test_missing_window_is_neutral_50(self):
        # newly-listed: short list_shrs -> structural neutral-50 (not penalty-5).
        def shrs_fn(j, n):
            if j == 0:
                return [1e8] * n      # full history
            return [1e8] * 30         # too short for 63/252 -> NaN -> neutral 50
        u = _trend_universe(shrs_fn=shrs_fn)
        on = {x.ticker: x for x in F.score_bpp_universe(u, "short", with_issuance=True) if x.eligible}
        for t, x in on.items():
            if int(t[1:]) != 0:
                self.assertEqual(x.factor_ranks["issuance"], F.MISSING_STRUCTURAL_SCORE)

    def test_split_and_extreme_rank_neutral_but_dilution_low(self):
        n_days = 320

        def shrs_fn(j, n):
            split_i = 120
            if j == 0:
                return [1e8] * split_i + [2e8] * (n - split_i)
            if j == 1:
                return [24450336.0] * split_i + [97801344.0] * (n - split_i)
            if j == 2:
                return [107290669.0] * (n - 1) + [211729312.0]
            return [1e8] * n
        u = _trend_universe(n_days=n_days, shrs_fn=shrs_fn)
        split_i = 120
        for i in range(split_i, n_days):
            u[0].closes[i] *= 0.5
        on = {x.ticker: x for x in F.score_bpp_universe(u, "short", with_issuance=True) if x.eligible}
        self.assertEqual(on["T00"].factor_ranks["issuance"], F.MISSING_STRUCTURAL_SCORE)
        self.assertEqual(on["T01"].factor_ranks["issuance"], F.MISSING_STRUCTURAL_SCORE)
        self.assertLess(on["T02"].factor_ranks["issuance"], F.MISSING_STRUCTURAL_SCORE)


# ============================================================================
# Orthogonality wiring
# ============================================================================

class TestOrthogonality(unittest.TestCase):
    def test_month_orthogonality_shape(self):
        u = _trend_universe()
        o = R.month_orthogonality(u, "mid")
        for scope in ("overall", "large", "mid", "small"):
            self.assertIn(scope, o)
            for fac in R.ORTHO_FACTORS:
                self.assertIn(fac, o[scope])

    def test_aggregate_pass_when_low_corr(self):
        per_month = [{scope: {fac: 0.1 for fac in R.ORTHO_FACTORS}
                      for scope in ("overall", "large", "mid", "small")} for _ in range(3)]
        agg = R.aggregate_orthogonality(per_month)
        self.assertTrue(agg["pass"])
        self.assertEqual(agg["fails"], [])

    def test_aggregate_fail_when_size_proxy(self):
        per_month = []
        for _ in range(3):
            m = {scope: {fac: 0.1 for fac in R.ORTHO_FACTORS}
                 for scope in ("overall", "large", "mid", "small")}
            m["small"]["size"] = 0.8  # issuance is a size proxy within small sleeve
            per_month.append(m)
        agg = R.aggregate_orthogonality(per_month)
        self.assertFalse(agg["pass"])
        self.assertTrue(any("small/size" in f for f in agg["fails"]))

    def test_aggregate_fail_when_factor_data_missing(self):
        per_month = [{scope: {fac: math.nan for fac in R.ORTHO_FACTORS}
                      for scope in ("overall", "large", "mid", "small")}]
        agg = R.aggregate_orthogonality(per_month)
        self.assertFalse(agg["pass"])
        self.assertTrue(any("orthogonality data missing" in f for f in agg["fails"]))


# ============================================================================
# Marginal / standalone leg accumulator wiring
# ============================================================================

class TestMarginalWiring(unittest.TestCase):
    def _leg_with(self, recalls):
        leg = R._LegAcc()
        for i, rc in enumerate(recalls):
            leg.months.append({
                "month": f"2023-{i+1:02d}-01", "recall": rc, "largemid_recall": rc,
                "composite_ic": 0.05, "per_horizon": {b: rc for b in R.HARVEST_BUCKETS},
                "n_selected": 150, "n_universe": 1500, "n_winners": 50,
                "num": int(rc * 50), "den": 50, "lm_num": int(rc * 30), "lm_den": 30,
                "leader_hits": 1,
                "per_h_num": {b: 5 for b in R.HARVEST_BUCKETS},
                "per_h_den": {b: 20 for b in R.HARVEST_BUCKETS},
            })
        return leg

    def test_marginal_positive_lift(self):
        bpp = self._leg_with([0.10, 0.12, 0.11])
        iss = self._leg_with([0.14, 0.16, 0.15])  # +4pp each month
        m = R._marginal_report(bpp, iss, smoke=False)
        self.assertTrue(m["binding"])
        self.assertGreater(m["delta"]["overall_recall"], 0)
        self.assertGreater(m["recall_lift_mean"], 0)
        self.assertGreater(m["recall_lift_ci90"][0], 0)  # lower bound > 0

    def test_marginal_no_lift(self):
        bpp = self._leg_with([0.10, 0.12, 0.11])
        iss = self._leg_with([0.10, 0.12, 0.11])  # identical
        m = R._marginal_report(bpp, iss, smoke=False)
        self.assertEqual(m["delta"]["overall_recall"], 0.0)
        self.assertEqual(m["recall_lift_mean"], 0.0)

    def test_marginal_requires_identical_month_sets(self):
        bpp = self._leg_with([0.10, 0.12])
        iss = self._leg_with([0.14])
        with self.assertRaises(ValueError):
            R._marginal_report(bpp, iss, smoke=False)

    def test_marginal_requires_same_denominator_per_month(self):
        bpp = self._leg_with([0.10])
        iss = self._leg_with([0.14])
        iss.months[0]["den"] = 51
        with self.assertRaises(ValueError):
            R._marginal_report(bpp, iss, smoke=False)

    def test_standalone_pick_uses_150_funnel_shape(self):
        picks = R._standalone_issuance_pick(_trend_universe(n_days=320, n=220))
        self.assertEqual(len(picks), R.STANDALONE_PICK_COUNT)


# ============================================================================
# Verdict fail-closed guard
# ============================================================================

class TestVerdict(unittest.TestCase):
    def test_pit_assumed_blocks_pass(self):
        pit = {"pit_status": "PIT_ASSUMED"}
        ortho = {"pass": True}
        marginal = {"recall_lift_ci90": [0.02, 0.05], "delta": {"overall_recall": 0.03, "ic_ir": 0.1}}
        v = R.build_verdict(pit, ortho, marginal)
        self.assertTrue(v["blocked_by_pit_assumed"])
        self.assertFalse(v["decision_grade"])
        self.assertIn("BLOCKED", v["verdict"])

    def test_not_orthogonal_blocks_lift_claim(self):
        pit = {"pit_status": "PIT_PROVEN"}
        ortho = {"pass": False}
        marginal = {"recall_lift_ci90": [0.02, 0.05], "delta": {"overall_recall": 0.03, "ic_ir": 0.1}}
        v = R.build_verdict(pit, ortho, marginal)
        self.assertIn("NOT-ORTHOGONAL", v["verdict"])
        self.assertFalse(v["decision_grade"])

    def test_proven_orthogonal_lift_is_exploratory_only(self):
        pit = {"pit_status": "PIT_PROVEN"}
        ortho = {"pass": True}
        marginal = {"recall_lift_ci90": [0.02, 0.05], "delta": {"overall_recall": 0.03, "ic_ir": 0.1}}
        v = R.build_verdict(pit, ortho, marginal)
        self.assertEqual(v["raw_marginal_judgment"], "MARGINAL_LIFT")
        self.assertFalse(v["decision_grade"])
        self.assertIn("EXPLORATORY", v["verdict"])
        # never a decision-grade word
        self.assertNotIn("rescue", v["verdict"].lower())

    def test_proven_orthogonal_no_lift(self):
        pit = {"pit_status": "PIT_PROVEN"}
        ortho = {"pass": True}
        marginal = {"recall_lift_ci90": [-0.02, 0.01], "delta": {"overall_recall": -0.01, "ic_ir": -0.02}}
        v = R.build_verdict(pit, ortho, marginal)
        self.assertEqual(v["raw_marginal_judgment"], "NO_MARGINAL_LIFT")
        self.assertIn("no marginal lift", v["verdict"])

    def test_positive_delta_without_positive_ci_is_no_lift(self):
        pit = {"pit_status": "PIT_PROVEN"}
        ortho = {"pass": True}
        marginal = {"recall_lift_ci90": [-0.01, 0.04], "delta": {"overall_recall": 0.03, "ic_ir": 0.1}}
        v = R.build_verdict(pit, ortho, marginal)
        self.assertEqual(v["raw_marginal_judgment"], "NO_MARGINAL_LIFT")


# ============================================================================
# PIT-proof probe (offline cache; PROVEN on the real sampled tickers)
# ============================================================================

class TestPitProbe(unittest.TestCase):
    def test_shrs_at_reads_real_cache(self):
        cd = P.CACHE_DIR_DEFAULT
        if not (cd / "KOSPI_20230613.json").exists():
            self.skipTest("offline cache not present")
        st, v = P._shrs_at(cd, "KOSPI", "042660", "20230613")
        self.assertEqual(st, "present")
        self.assertEqual(v, 211729312.0)

    def test_probe_main_returns_proven_on_real_cache(self):
        cd = P.CACHE_DIR_DEFAULT
        if not (cd / "KOSPI_20230613.json").exists():
            self.skipTest("offline cache not present")
        # main() returns 0 on PIT_PROVEN.
        import io
        import contextlib
        argv = sys.argv
        sys.argv = ["probe_list_shrs_pit.py"]
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                rc = P.main()
        finally:
            sys.argv = argv
        self.assertEqual(rc, 0)

    def test_probe_negative_fixture_is_pit_assumed(self):
        with tempfile.TemporaryDirectory() as td:
            cache = Path(td)
            for market, dd in [
                ("KOSPI", "20230609"), ("KOSPI", "20230612"), ("KOSPI", "20230613"), ("KOSPI", "20230614"),
                ("KOSDAQ", "20220708"), ("KOSDAQ", "20220714"), ("KOSDAQ", "20220715"), ("KOSDAQ", "20220718"),
                ("KOSPI", "20220103"), ("KOSPI", "20220701"), ("KOSPI", "20221229"),
                ("KOSPI", "20220126"), ("KOSPI", "20220127"), ("KOSPI", "20220128"),
            ]:
                cache.joinpath(f"{market}_{dd}.json").write_text("[]")
            cache.joinpath("KOSPI_20230609.json").write_text(json.dumps([{"ISU_CD": "042660", "LIST_SHRS": "211729312"}]))
            cache.joinpath("KOSPI_20230612.json").write_text(json.dumps([{"ISU_CD": "042660", "LIST_SHRS": "107290669"}]))
            cache.joinpath("KOSPI_20230613.json").write_text(json.dumps([{"ISU_CD": "042660", "LIST_SHRS": "211729312"}]))
            cache.joinpath("KOSPI_20230614.json").write_text(json.dumps([{"ISU_CD": "042660", "LIST_SHRS": "211729312"}]))
            argv = sys.argv
            sys.argv = ["probe_list_shrs_pit.py", "--cache-dir", str(cache)]
            try:
                rc = P.main()
            finally:
                sys.argv = argv
            self.assertEqual(rc, 1)


class TestPitProofGuard(unittest.TestCase):
    def test_smoke_default_uses_smoke_report_path(self):
        root = Path("/repo")
        out = R._resolve_output_path(root, None, True)
        self.assertEqual(out, root / R.SMOKE_REPORT_PATH)

    def test_non_smoke_default_uses_canonical_report_path(self):
        root = Path("/repo")
        out = R._resolve_output_path(root, None, False)
        self.assertEqual(out, root / R.DEFAULT_REPORT_PATH)

    def test_smoke_rejects_canonical_report_path(self):
        root = Path("/repo")
        with self.assertRaises(ValueError):
            R._resolve_output_path(root, str(R.DEFAULT_REPORT_PATH), True)

    def test_stale_proven_artifact_does_not_survive_probe_failure(self):
        with tempfile.TemporaryDirectory() as td:
            out_dir = Path(td)
            artifact = out_dir / "list_shrs_pit.json"
            artifact.write_text(json.dumps({"pit_status": "PIT_PROVEN", "evidence": ["stale"]}))
            orig = R.subprocess.run

            def fake_run(*_args, **_kwargs):
                class Result:
                    returncode = 1
                return Result()

            try:
                R.subprocess.run = fake_run
                pit = R.run_pit_proof(out_dir, out_dir / "cache")
            finally:
                R.subprocess.run = orig
            self.assertEqual(pit["pit_status"], "PIT_ASSUMED")
            self.assertIn("probe 아티팩트 부재", pit["fails"][0])

    def test_probe_cache_mismatch_blocks_pit_proven(self):
        with tempfile.TemporaryDirectory() as td:
            out_dir = Path(td)
            artifact = out_dir / "list_shrs_pit.json"
            orig = R.subprocess.run

            def fake_run(*_args, **_kwargs):
                artifact.write_text(json.dumps({"pit_status": "PIT_PROVEN", "cache_dir": "/other/cache"}))

                class Result:
                    returncode = 0
                return Result()

            try:
                R.subprocess.run = fake_run
                pit = R.run_pit_proof(out_dir, out_dir / "cache")
            finally:
                R.subprocess.run = orig
            self.assertEqual(pit["pit_status"], "PIT_ASSUMED")
            self.assertIn("probe cache mismatch", pit["fails"][0])


if __name__ == "__main__":
    unittest.main()
