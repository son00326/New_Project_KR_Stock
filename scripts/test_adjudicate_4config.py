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
    return matrix


def make_run(triple=None, gate_a="FAIL", gate_b="FAIL", gate_c="PASS", lock_hash=LOCK_HASH, freeze_tag=FREEZE_TAG):
    if triple is None:
        triple = False
    return {
        "parameter_lock_commit_hash": lock_hash,
        "freeze_tag": freeze_tag,
        "triple_gate_all_pass": triple,
        "gate_a": {"verdict": gate_a},
        "gate_b": {"verdict": gate_b},
        "gate_c": {"verdict": gate_c},
    }


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
                    run = make_run()
                    if config == "cfg2" and regime == "bear2022":
                        run = make_run(triple=True)
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
                    run = make_run()
                    if config == "cfg2" and regime == "bear2022":
                        run = make_run(gate_a="PASS", gate_b="PASS", gate_c="PASS")
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
                    run = make_run()
                    if config == "cfg2" and regime == "bear2022":
                        run = make_run(triple="false")
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
                    run = make_run()
                    if config == "cfg2" and regime == "bear2022":
                        run = make_run(lock_hash="wrong-lock")
                    (bc_dir / f"{config}_{regime}.json").write_text(json.dumps(run), encoding="utf-8")

            matrix = adjudicator.load_matrix(bc_dir)
            missing, invalid = adjudicator.input_issues(matrix)
            result = adjudicator.invalid_result("test-lock", missing, invalid)

        self.assertEqual(missing, [])
        self.assertEqual(result["verdict"], "INVALID_INPUT")
        self.assertEqual(invalid[0]["run"], "cfg2_bear2022")
        self.assertTrue(any("parameter_lock_commit_hash" in r for r in invalid[0]["reasons"]))


if __name__ == "__main__":
    unittest.main()
