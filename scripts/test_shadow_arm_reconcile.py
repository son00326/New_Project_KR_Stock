#!/usr/bin/env python3
"""Track 1 PR-A4 — shadow_arm_reconcile 분류/fail-closed/main 테스트 (stdlib unittest)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import shadow_arm_reconcile as R  # noqa: E402


def _row(**over):
    # logged_arm_count는 명시 override 없으면 arm_count와 동일(전 arm logged)로 기본값.
    arm_count = over.get("arm_count", 4)
    base = {
        "period_key": "m:2026-06", "track": "midlong",
        "arm_count": arm_count, "logged_arm_count": arm_count,
        "production_snapshot_logged": True,
    }
    base.update(over)
    return base


class TestClassify(unittest.TestCase):
    def test_complete(self):
        c = R.classify_coverage_row(_row(arm_count=4, production_snapshot_logged=True))
        self.assertEqual(c["status"], "complete")
        self.assertIsNone(c["reason"])

    def test_partial_1_to_3_arms(self):
        for n in (1, 2, 3):
            c = R.classify_coverage_row(_row(arm_count=n, production_snapshot_logged=True))
            self.assertEqual(c["status"], "partial", f"arm_count={n}")
            self.assertIn("비원자", c["reason"])

    def test_missing_zero_arms(self):
        c = R.classify_coverage_row(_row(arm_count=0, production_snapshot_logged=False))
        self.assertEqual(c["status"], "missing")
        self.assertIn("ambiguous", c["reason"])

    def test_anomaly_4_arms_no_logged_snapshot(self):
        # 4 arms present but production-snapshot not logged (structurally impossible via RPC → tamper).
        c = R.classify_coverage_row(_row(arm_count=4, production_snapshot_logged=False))
        self.assertEqual(c["status"], "anomaly")
        self.assertIn("tamper", c["reason"])

    def test_short_track(self):
        c = R.classify_coverage_row(_row(period_key="s:2026-06-15", track="short", arm_count=4))
        self.assertEqual(c["status"], "complete")

    def test_A1_hardgate_incomplete_run_still_complete(self):
        # 4 arms present but a counterfactual arm is incomplete_run (logged_arm_count=3).
        # §2.2/§6.5: incomplete_run = consumable terminal state → still 'complete' (NOT blocking),
        # and logged_arm_count<arm_count is surfaced for PR-A5.
        c = R.classify_coverage_row(_row(arm_count=4, logged_arm_count=3, production_snapshot_logged=True))
        self.assertEqual(c["status"], "complete")
        self.assertEqual(c["logged_arm_count"], 3)
        self.assertEqual(c["arm_count"], 4)

    def test_A1_logged_arm_count_in_output(self):
        c = R.classify_coverage_row(_row(arm_count=4, logged_arm_count=4))
        self.assertEqual(c["logged_arm_count"], 4)


class TestFailClosed(unittest.TestCase):
    def test_non_dict_row(self):
        for bad in (None, [], "x", 42):
            with self.assertRaises(R.ShadowArmReconcileInputError):
                R.classify_coverage_row(bad)

    def test_missing_field(self):
        for key in ("period_key", "track", "arm_count", "logged_arm_count", "production_snapshot_logged"):
            row = _row()
            del row[key]
            with self.assertRaises(R.ShadowArmReconcileInputError):
                R.classify_coverage_row(row)

    def test_wrong_type_arm_count(self):
        for bad in ("4", 4.0, True, None):
            with self.assertRaises(R.ShadowArmReconcileInputError):
                R.classify_coverage_row(_row(arm_count=bad))

    def test_bool_arm_count_rejected(self):
        # bool is int subclass — must be rejected (not coerced to 1/0).
        with self.assertRaises(R.ShadowArmReconcileInputError):
            R.classify_coverage_row(_row(arm_count=True))

    def test_negative_arm_count(self):
        with self.assertRaises(R.ShadowArmReconcileInputError):
            R.classify_coverage_row(_row(arm_count=-1))

    def test_arm_count_over_expected(self):
        with self.assertRaises(R.ShadowArmReconcileInputError):
            R.classify_coverage_row(_row(arm_count=5))

    def test_bad_track(self):
        with self.assertRaises(R.ShadowArmReconcileInputError):
            R.classify_coverage_row(_row(track="weekly"))

    def test_A3_prefix_track_mismatch(self):
        # A3: period_key prefix must match track (s:⟺short, m:⟺midlong). hand-fed mismatch → fail-closed.
        with self.assertRaises(R.ShadowArmReconcileInputError):
            R.classify_coverage_row(_row(period_key="s:2026-06-15", track="midlong", arm_count=4))
        with self.assertRaises(R.ShadowArmReconcileInputError):
            R.classify_coverage_row(_row(period_key="m:2026-06", track="short", arm_count=4))
        with self.assertRaises(R.ShadowArmReconcileInputError):
            R.classify_coverage_row(_row(period_key="garbage", track="short", arm_count=4))

    def test_logged_arm_count_exceeds_arm_count(self):
        with self.assertRaises(R.ShadowArmReconcileInputError):
            R.classify_coverage_row(_row(arm_count=2, logged_arm_count=4))

    def test_empty_period_key(self):
        with self.assertRaises(R.ShadowArmReconcileInputError):
            R.classify_coverage_row(_row(period_key=""))

    def test_wrong_type_production_snapshot_logged(self):
        with self.assertRaises(R.ShadowArmReconcileInputError):
            R.classify_coverage_row(_row(production_snapshot_logged="true"))


class TestSummarize(unittest.TestCase):
    def test_counts_and_blocking(self):
        rows = [
            R.classify_coverage_row(_row(period_key="m:2026-06", arm_count=4)),
            R.classify_coverage_row(_row(period_key="m:2026-07", arm_count=2)),  # partial
            R.classify_coverage_row(_row(period_key="m:2026-08", arm_count=0, production_snapshot_logged=False)),  # missing
            R.classify_coverage_row(_row(period_key="m:2026-09", arm_count=4, production_snapshot_logged=False)),  # anomaly
        ]
        s = R.summarize(rows)
        self.assertEqual(s["total_finalized_periods"], 4)
        self.assertEqual(s["counts"], {"complete": 1, "partial": 1, "missing": 1, "anomaly": 1})
        # partial/anomaly/missing all listed as stage-1-blocked.
        self.assertEqual(len(s["stage1_blocked_periods"]), 3)


class TestMain(unittest.TestCase):
    SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shadow_arm_reconcile.py")

    def _run(self, args, expect_code=None):
        p = subprocess.run([sys.executable, self.SCRIPT, *args], capture_output=True, text=True)
        if expect_code is not None:
            self.assertEqual(p.returncode, expect_code, p.stderr)
        return p

    def test_print_sql(self):
        p = self._run(["--print-sql"], expect_code=0)
        self.assertIn("with finalized as materialized", p.stdout)
        self.assertIn("shadow_arm_log", p.stdout)

    def test_coverage_json_clean_exit0(self):
        rows = [_row(arm_count=4), _row(period_key="s:2026-06-15", track="short", arm_count=4)]
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(rows, f)
            path = f.name
        try:
            p = self._run(["--coverage-json", path], expect_code=0)
            out = json.loads(p.stdout)
            self.assertEqual(out["summary"]["counts"]["complete"], 2)
        finally:
            os.unlink(path)

    def test_coverage_json_partial_exit1(self):
        rows = [_row(arm_count=4), _row(period_key="m:2026-07", arm_count=1)]  # partial → exit 1
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(rows, f)
            path = f.name
        try:
            self._run(["--coverage-json", path], expect_code=1)
        finally:
            os.unlink(path)

    def test_coverage_json_missing_only_exit0(self):
        # missing is ambiguous (could be shadow-off) → report-only, exit 0 (not blocking).
        rows = [_row(period_key="m:2026-08", arm_count=0, production_snapshot_logged=False)]
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(rows, f)
            path = f.name
        try:
            self._run(["--coverage-json", path], expect_code=0)
        finally:
            os.unlink(path)

    def test_A2_bare_null_normalized_to_empty_exit0(self):
        # A2: 0 finalized periods + bare json_agg (no coalesce) → SQL NULL → JSON null → empty report, exit 0.
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            f.write("null")
            path = f.name
        try:
            p = self._run(["--coverage-json", path], expect_code=0)
            out = json.loads(p.stdout)
            self.assertEqual(out["summary"]["total_finalized_periods"], 0)
        finally:
            os.unlink(path)

    def test_bad_json_abort_exit2(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            f.write("{not json")
            path = f.name
        try:
            self._run(["--coverage-json", path], expect_code=2)
        finally:
            os.unlink(path)

    def test_malformed_row_abort_exit2(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump([{"period_key": "m:2026-06"}], f)  # missing fields
            path = f.name
        try:
            self._run(["--coverage-json", path], expect_code=2)
        finally:
            os.unlink(path)

    def test_non_array_json_abort_exit2(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump({"not": "array"}, f)
            path = f.name
        try:
            self._run(["--coverage-json", path], expect_code=2)
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main()
