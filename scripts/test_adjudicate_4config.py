import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ADJUDICATOR_PATH = Path(__file__).with_name("adjudicate_4config.py")
if str(ADJUDICATOR_PATH.parent) not in sys.path:
    sys.path.insert(0, str(ADJUDICATOR_PATH.parent))
ADJUDICATOR_SPEC = importlib.util.spec_from_file_location("adjudicate_4config", ADJUDICATOR_PATH)
assert ADJUDICATOR_SPEC is not None
assert ADJUDICATOR_SPEC.loader is not None
adjudicator = importlib.util.module_from_spec(ADJUDICATOR_SPEC)
ADJUDICATOR_SPEC.loader.exec_module(adjudicator)
LOCK_HASH = "17dc6d9"
FREEZE_TAG = "tier0-multiregime-freeze"
_UNSET = object()


def mapping(value):
    assert isinstance(value, dict)
    return value


def make_cell(recall, ic_ir, gate_b="PASS", triple=None, ci=None):
    if triple is None:
        triple = (gate_b == "PASS")
    sleeve_ci = ci or {horizon: [0.01, 0.02] for horizon in adjudicator.HORIZONS}
    return {
        "_missing": False,
        "_invalid": False,
        "ga_verdict": "PASS",
        "gb_verdict": gate_b,
        "gc_verdict": "PASS",
        "triple": triple,
        "overall_recall": recall,
        "per_horizon_recall": {horizon: recall for horizon in adjudicator.HORIZONS},
        "binding_baseline_recall": recall,
        "leader_hits": 0,
        "leader_total": 0,
        "ic_ir": ic_ir,
        "sleeve_ci": sleeve_ci,
        "sleeve_ci_excl0": {
            horizon: adjudicator._ci_excludes_zero(sleeve_ci[horizon])
            for horizon in adjudicator.HORIZONS
        },
    }


def make_matrix():
    matrix = {}
    for regime in adjudicator.REGIMES:
        matrix[("cfg1", regime)] = make_cell(0.30, 0.30)
        matrix[("cfg2", regime)] = make_cell(0.40, 0.40)
        matrix[("cfg3", regime)] = make_cell(0.20, 0.20)
        matrix[("cfg4", regime)] = make_cell(0.20, 0.20)
        # EXPLORATORY configs (cfg5/cfg6/cfg7/cfg8) — default weak so they don't pass unless a test sets them.
        matrix[("cfg5", regime)] = make_cell(0.20, 0.20)
        matrix[("cfg6", regime)] = make_cell(0.20, 0.20)
        matrix[("cfg7", regime)] = make_cell(0.20, 0.20)
        matrix[("cfg8", regime)] = make_cell(0.20, 0.20)
    return matrix


def make_run(triple=None, gate_a="FAIL", gate_b="FAIL", gate_c="PASS", lock_hash=LOCK_HASH,
             freeze_tag=FREEZE_TAG, config="cfg1", generator=_UNSET, exploratory=_UNSET):
    if triple is None:
        triple = False
    # generator/exploratory를 명시하지 않으면 config에서 유도(cfg5/cfg6=EXPLORATORY, 나머지=bpp).
    if generator is _UNSET:
        # cfg8 runs the cfg7 generator (surge) restricted to largemid → carries generator="cfg7".
        generator = adjudicator.EXPECTED_GENERATOR.get(config, "bpp") if config in adjudicator.EXPLORATORY_CONFIGS else "bpp"
    if exploratory is _UNSET:
        exploratory = config in adjudicator.EXPLORATORY_CONFIGS
    run = {
        "parameter_lock_commit_hash": lock_hash,
        "freeze_tag": freeze_tag,
        "triple_gate_all_pass": triple,
        "generator": generator,
        "exploratory": exploratory,
        "gate_a": {"verdict": gate_a},
        "gate_b": {"verdict": gate_b},
        "gate_c": {"verdict": gate_c},
    }
    if config == "cfg8":
        run["universe"] = "largemid"  # cfg8 cross-check requires universe='largemid'
    return run


class TestAdjudicate4Config(unittest.TestCase):
    def test_rule_iii_requires_all_three_horizon_ci_positive(self):
        matrix = make_matrix()
        mixed_ci = {horizon: [0.01, 0.02] for horizon in adjudicator.HORIZONS}
        mixed_ci["long"] = [-0.02, -0.01]
        matrix[("cfg2", "bear2022")] = make_cell(0.40, 0.40, ci=mixed_ci)

        result = adjudicator.adjudicate(matrix, "test-lock")

        per_config = mapping(result["per_config"])
        cfg2 = mapping(per_config["cfg2"])
        by_regime = mapping(cfg2["by_regime"])
        bear = mapping(by_regime["bear2022"])
        self.assertEqual(result["verdict"], "NO-CONFIG-PASSES")
        self.assertTrue(bear["size_neutral_ci_excludes_0_all_horizons"])
        self.assertFalse(bear["size_neutral_all_positive_sig_ci"])
        self.assertFalse(bear["pass"])

    def test_clean_winner_without_p_evidence_is_adjudicate_not_pass(self):
        matrix = make_matrix()
        result = adjudicator.adjudicate(matrix, "test-lock")
        self.assertEqual(result["verdict"], "ADJUDICATE")
        self.assertEqual(result["winners"], ["cfg2"])
        self.assertIn("marginality", result["rule_5_marginal"])

    def test_triple_inconsistent_with_gates_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            bc_dir = Path(tmpdir)
            for config in adjudicator.CONFIGS:
                for regime in adjudicator.REGIMES:
                    run = make_run(config=config)
                    if config == "cfg2" and regime == "bear2022":
                        run = make_run(triple=True, config=config)
                    (bc_dir / f"{config}_{regime}.json").write_text(json.dumps(run), encoding="utf-8")

            matrix = adjudicator.load_matrix(bc_dir)
            missing, invalid = adjudicator.input_issues(matrix)
            result = adjudicator.invalid_result("test-lock", missing, invalid)

        self.assertEqual(missing, [])
        self.assertEqual(result["verdict"], "INVALID_INPUT")
        self.assertEqual(invalid[0]["run"], "cfg2_bear2022")
        self.assertTrue(any("불일치" in r for r in invalid[0]["reasons"]))

    def test_triple_false_with_all_pass_gates_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            bc_dir = Path(tmpdir)
            for config in adjudicator.CONFIGS:
                for regime in adjudicator.REGIMES:
                    run = make_run(config=config)
                    if config == "cfg2" and regime == "bear2022":
                        run = make_run(gate_a="PASS", gate_b="PASS", gate_c="PASS", config=config)
                    (bc_dir / f"{config}_{regime}.json").write_text(json.dumps(run), encoding="utf-8")

            matrix = adjudicator.load_matrix(bc_dir)
            missing, invalid = adjudicator.input_issues(matrix)
            result = adjudicator.invalid_result("test-lock", missing, invalid)

        self.assertEqual(missing, [])
        self.assertEqual(result["verdict"], "INVALID_INPUT")
        self.assertEqual(invalid[0]["run"], "cfg2_bear2022")
        self.assertTrue(any("불일치" in r for r in invalid[0]["reasons"]))

    def test_missing_run_is_incomplete_not_no_config_passes(self):
        matrix = make_matrix()
        matrix[("cfg4", "bull2425")] = {"_missing": True}

        missing, invalid = adjudicator.input_issues(matrix)
        result = adjudicator.invalid_result("test-lock", missing, invalid)

        self.assertEqual(missing, ["cfg4_bull2425"])
        self.assertEqual(result["verdict"], "INCOMPLETE_RUN")
        self.assertNotEqual(result["verdict"], "NO-CONFIG-PASSES")

    def test_non_boolean_triple_gate_all_pass_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            bc_dir = Path(tmpdir)
            for config in adjudicator.CONFIGS:
                for regime in adjudicator.REGIMES:
                    run = make_run(config=config)
                    if config == "cfg2" and regime == "bear2022":
                        run = make_run(triple="false", config=config)
                    (bc_dir / f"{config}_{regime}.json").write_text(
                        json.dumps(run),
                        encoding="utf-8",
                    )

            matrix = adjudicator.load_matrix(bc_dir)
            missing, invalid = adjudicator.input_issues(matrix)
            result = adjudicator.invalid_result("test-lock", missing, invalid)

        self.assertEqual(missing, [])
        self.assertEqual(result["verdict"], "INVALID_INPUT")
        self.assertEqual(invalid[0]["run"], "cfg2_bear2022")
        self.assertIn("triple_gate_all_pass must be bool", invalid[0]["reasons"])
        self.assertFalse(matrix[("cfg2", "bear2022")]["triple"])

    def test_provenance_stamp_mismatch_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            bc_dir = Path(tmpdir)
            for config in adjudicator.CONFIGS:
                for regime in adjudicator.REGIMES:
                    run = make_run(config=config)
                    if config == "cfg2" and regime == "bear2022":
                        run = make_run(lock_hash="wrong-lock", config=config)
                    (bc_dir / f"{config}_{regime}.json").write_text(json.dumps(run), encoding="utf-8")

            matrix = adjudicator.load_matrix(bc_dir)
            missing, invalid = adjudicator.input_issues(matrix)
            result = adjudicator.invalid_result("test-lock", missing, invalid)

        self.assertEqual(missing, [])
        self.assertEqual(result["verdict"], "INVALID_INPUT")
        self.assertEqual(invalid[0]["run"], "cfg2_bear2022")
        self.assertTrue(any("parameter_lock_commit_hash" in r for r in invalid[0]["reasons"]))


class TestExploratoryConfigs(unittest.TestCase):
    """cfg5/cfg6/cfg7 EXPLORATORY 추가 (2026-06-17). 7×3 matrix 로드 + diagnostic-only 판정."""

    def test_configs_include_cfg5_cfg6_exploratory(self):
        self.assertIn("cfg5", adjudicator.CONFIGS)
        self.assertIn("cfg6", adjudicator.CONFIGS)
        self.assertIn("cfg7", adjudicator.CONFIGS)  # TASK B daily surge proxy
        self.assertIn("cfg8", adjudicator.CONFIGS)  # cfg8 = cfg7 surge + largemid (un-deferred 2026-06-18)
        self.assertEqual(adjudicator.EXPLORATORY_CONFIGS, {"cfg5", "cfg6", "cfg7", "cfg8"})
        self.assertEqual(adjudicator.BLOCKED_CONFIGS, {"cfg5"})
        # cfg6 + cfg7 + cfg8 are offline-runnable (NOT blocked); cfg5 only is blocked.
        self.assertEqual(adjudicator.RUNNABLE_EXPLORATORY_CONFIGS, ("cfg6", "cfg7", "cfg8"))
        # cfg8 carries generator="cfg7" (its actual generator) in the cross-check.
        self.assertEqual(adjudicator.EXPECTED_GENERATOR["cfg8"], "cfg7")

    def test_six_config_matrix_loads_and_judges_vs_cfg1(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            bc_dir = Path(tmpdir)
            for config in adjudicator.CONFIGS:
                for regime in adjudicator.REGIMES:
                    (bc_dir / f"{config}_{regime}.json").write_text(
                        json.dumps(make_run(config=config)), encoding="utf-8")
            matrix = adjudicator.load_matrix(bc_dir)
            missing, invalid = adjudicator.input_issues(matrix)
            self.assertEqual(missing, [])
            self.assertEqual(invalid, [])
            # 24 cells (8 config × 3 regime) all loaded.
            self.assertEqual(
                len([k for k in matrix if not matrix[k].get("_missing")]), 24)
            result = adjudicator.adjudicate(matrix, "test-lock")
            # baseline comparison anchored to cfg1.
            self.assertIn("cfg5", result["per_config"])
            self.assertTrue(result["per_config"]["cfg5"]["exploratory"])
            self.assertTrue(result["per_config"]["cfg6"]["exploratory"])
            self.assertTrue(result["per_config"]["cfg7"]["exploratory"])
            self.assertTrue(result["per_config"]["cfg8"]["exploratory"])

    def test_exploratory_config_never_becomes_winner_even_if_all_pass(self):
        matrix = make_matrix()
        for regime in adjudicator.REGIMES:
            matrix[("cfg2", regime)] = make_cell(0.10, 0.10, gate_b="FAIL")
            matrix[("cfg3", regime)] = make_cell(0.10, 0.10, gate_b="FAIL")
            matrix[("cfg4", regime)] = make_cell(0.10, 0.10, gate_b="FAIL")
            matrix[("cfg5", regime)] = make_cell(0.60, 0.60)
            matrix[("cfg6", regime)] = make_cell(0.50, 0.50)
            matrix[("cfg7", regime)] = make_cell(0.55, 0.55)
            matrix[("cfg8", regime)] = make_cell(0.45, 0.45)
        result = adjudicator.adjudicate(matrix, "test-lock")
        self.assertEqual(result["verdict"], "NO-CONFIG-PASSES")
        self.assertEqual(result["winners"], [])
        self.assertNotIn("cfg5", result["winners"])
        self.assertNotIn("cfg6", result["winners"])
        self.assertNotIn("cfg7", result["winners"])
        self.assertNotIn("cfg8", result["winners"])  # exploratory → never winner even if all-pass
        self.assertNotIn("cfg5", result["exploratory_pass"])
        self.assertIn("cfg6", result["exploratory_pass"])
        self.assertIn("cfg7", result["exploratory_pass"])
        self.assertIn("cfg8", result["exploratory_pass"])
        self.assertIn("cfg5", result["blocked_configs"])
        self.assertIn("diagnostic-only", result["exploratory_note"])

    def test_exploratory_cell_with_bpp_generator_is_invalid(self):
        # cross-wired: cfg5 JSON labeled generator=bpp/exploratory=false → INVALID_INPUT (defense-in-depth).
        with tempfile.TemporaryDirectory() as tmpdir:
            bc_dir = Path(tmpdir)
            for config in adjudicator.CONFIGS:
                for regime in adjudicator.REGIMES:
                    run = make_run(config=config)
                    if config == "cfg5" and regime == "bear2022":
                        run = make_run(config="cfg5", generator="bpp", exploratory=False)
                    (bc_dir / f"{config}_{regime}.json").write_text(json.dumps(run), encoding="utf-8")
            matrix = adjudicator.load_matrix(bc_dir)
            missing, invalid = adjudicator.input_issues(matrix, include_exploratory=True)
            result = adjudicator.invalid_result("test-lock", missing, invalid)
        self.assertEqual(missing, [])
        self.assertEqual(result["verdict"], "INVALID_INPUT")
        runs = {item["run"] for item in invalid}
        self.assertIn("cfg5_bear2022", runs)
        cfg5_reasons = next(item["reasons"] for item in invalid if item["run"] == "cfg5_bear2022")
        self.assertTrue(any("generator='cfg5'" in r for r in cfg5_reasons))
        self.assertTrue(any("exploratory=true" in r for r in cfg5_reasons))

    def test_frozen_cell_with_exploratory_generator_is_invalid(self):
        # cross-wired: cfg2 JSON labeled generator=cfg6/exploratory=true → INVALID_INPUT.
        with tempfile.TemporaryDirectory() as tmpdir:
            bc_dir = Path(tmpdir)
            for config in adjudicator.CONFIGS:
                for regime in adjudicator.REGIMES:
                    run = make_run(config=config)
                    if config == "cfg2" and regime == "recov2023":
                        run = make_run(config="cfg2", generator="cfg6", exploratory=True)
                    (bc_dir / f"{config}_{regime}.json").write_text(json.dumps(run), encoding="utf-8")
            matrix = adjudicator.load_matrix(bc_dir)
            missing, invalid = adjudicator.input_issues(matrix)
        self.assertEqual(missing, [])
        runs = {item["run"] for item in invalid}
        self.assertIn("cfg2_recov2023", runs)
        cfg2_reasons = next(item["reasons"] for item in invalid if item["run"] == "cfg2_recov2023")
        self.assertTrue(any("generator in (None,'bpp')" in r for r in cfg2_reasons))

    def test_missing_cfg5_run_is_blocked_not_incomplete(self):
        matrix = make_matrix()
        matrix[("cfg5", "bull2425")] = {"_missing": True}
        missing, invalid = adjudicator.input_issues(matrix)
        result = adjudicator.adjudicate(matrix, "test-lock")
        self.assertEqual(missing, [])
        self.assertEqual(invalid, [])
        self.assertTrue(result["per_config"]["cfg5"]["blocked_offline"])

    def test_twelve_legacy_cells_missing_cfg5_cfg6_preserves_frozen_verdict(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            bc_dir = Path(tmpdir)
            for config in ("cfg1", "cfg2", "cfg3", "cfg4"):
                for regime in adjudicator.REGIMES:
                    (bc_dir / f"{config}_{regime}.json").write_text(
                        json.dumps(make_run(config=config)), encoding="utf-8")
            matrix = adjudicator.load_matrix(bc_dir)
            missing, invalid = adjudicator.input_issues(matrix)
            exploratory_missing, exploratory_invalid = adjudicator.exploratory_input_issues(matrix)
            result = adjudicator.adjudicate(matrix, "test-lock")
        self.assertEqual(missing, [])
        self.assertEqual(invalid, [])
        # RUNNABLE_EXPLORATORY_CONFIGS = cfg6, cfg7, cfg8 (cfg5 blocked) → all report missing here.
        self.assertEqual(exploratory_missing, [
            "cfg6_bear2022", "cfg6_recov2023", "cfg6_bull2425",
            "cfg7_bear2022", "cfg7_recov2023", "cfg7_bull2425",
            "cfg8_bear2022", "cfg8_recov2023", "cfg8_bull2425"])
        self.assertEqual(exploratory_invalid, [])
        self.assertEqual(result["verdict"], "NO-CONFIG-PASSES")

    def test_fmt_table_marks_cfg5_cfg6_as_exploratory(self):
        table = adjudicator.fmt_table(make_matrix())
        self.assertIn("cfg5 (EXPLORATORY)", table)
        self.assertIn("cfg6 (EXPLORATORY)", table)
        self.assertIn("cfg7 (EXPLORATORY)", table)
        self.assertIn("cfg8 (EXPLORATORY)", table)

    def test_cfg8_run_with_cfg7_generator_and_largemid_is_valid(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            bc_dir = Path(tmpdir)
            for config in adjudicator.CONFIGS:
                for regime in adjudicator.REGIMES:
                    (bc_dir / f"{config}_{regime}.json").write_text(
                        json.dumps(make_run(config=config)), encoding="utf-8")
            matrix = adjudicator.load_matrix(bc_dir)
            missing, invalid = adjudicator.input_issues(matrix, include_exploratory=True)
        self.assertEqual(missing, [])
        self.assertEqual(invalid, [])  # cfg8 with generator=cfg7 + universe=largemid is valid

    def test_cfg8_with_wrong_generator_is_invalid(self):
        # cfg8 JSON carrying generator="cfg8" (not its actual cfg7 generator) → INVALID_INPUT.
        with tempfile.TemporaryDirectory() as tmpdir:
            bc_dir = Path(tmpdir)
            for config in adjudicator.CONFIGS:
                for regime in adjudicator.REGIMES:
                    run = make_run(config=config)
                    if config == "cfg8" and regime == "bear2022":
                        run = make_run(config="cfg8", generator="cfg8", exploratory=True)
                        run["universe"] = "largemid"
                    (bc_dir / f"{config}_{regime}.json").write_text(json.dumps(run), encoding="utf-8")
            matrix = adjudicator.load_matrix(bc_dir)
            missing, invalid = adjudicator.input_issues(matrix, include_exploratory=True)
        runs = {item["run"] for item in invalid}
        self.assertIn("cfg8_bear2022", runs)
        reasons = next(item["reasons"] for item in invalid if item["run"] == "cfg8_bear2022")
        self.assertTrue(any("generator='cfg7'" in r for r in reasons))

    def test_cfg8_without_largemid_universe_is_invalid(self):
        # cfg8 JSON missing universe='largemid' → INVALID_INPUT (cfg8 = surge ON largemid).
        with tempfile.TemporaryDirectory() as tmpdir:
            bc_dir = Path(tmpdir)
            for config in adjudicator.CONFIGS:
                for regime in adjudicator.REGIMES:
                    run = make_run(config=config)
                    if config == "cfg8" and regime == "recov2023":
                        run = make_run(config="cfg8")  # generator=cfg7, exploratory=true
                        run.pop("universe", None)  # drop the largemid marker
                    (bc_dir / f"{config}_{regime}.json").write_text(json.dumps(run), encoding="utf-8")
            matrix = adjudicator.load_matrix(bc_dir)
            missing, invalid = adjudicator.input_issues(matrix, include_exploratory=True)
        runs = {item["run"] for item in invalid}
        self.assertIn("cfg8_recov2023", runs)
        reasons = next(item["reasons"] for item in invalid if item["run"] == "cfg8_recov2023")
        self.assertTrue(any("universe='largemid'" in r for r in reasons))

    def test_driver_runs_cfg6_with_foreign_and_excludes_blocked_cfg5(self):
        text = Path(__file__).with_name("run_tier0_6config_matrix.sh").read_text(encoding="utf-8")
        job_lines = [line.strip().strip('"') for line in text.splitlines() if line.strip().startswith('"cfg')]
        cfg5 = [line for line in job_lines if line.startswith("cfg5_")]
        cfg6 = [line for line in job_lines if line.startswith("cfg6_")]
        cfg7 = [line for line in job_lines if line.startswith("cfg7_")]
        self.assertEqual(cfg5, [])
        self.assertEqual(len(job_lines), 18)
        self.assertEqual(len(cfg6), 3)
        self.assertEqual(len(cfg7), 3)
        self.assertTrue(all("--with-foreign" in line for line in cfg6))
        self.assertTrue(all("--generator cfg6" in line for line in cfg6))
        self.assertTrue(all("--generator cfg7" in line for line in cfg7))


if __name__ == "__main__":
    unittest.main()
