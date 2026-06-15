"""Unittest for scripts/dart_backfill.py — DART 실적 PIT 백필 (B+C)."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from datetime import date
from pathlib import Path

import dart_backfill as B


class TestRequiredPeriods(unittest.TestCase):
    def test_covers_annuals_and_quarters_with_yoy_lookback(self):
        p = B.required_periods(date(2022, 1, 1), date(2025, 12, 1))
        keys = {pk for (_pt, pk, _rc) in p}
        # omxy BC-R1 #3: annual start_year-3..end_year (2019..2025) — earliest month quality YoY base
        self.assertEqual({k for k in keys if "-" not in k},
                         {"2019", "2020", "2021", "2022", "2023", "2024", "2025"})
        # quarters start_year-2..end_year (2020..2025) — earliest month standalone + YoY prior-year quarter
        self.assertIn("2020-Q1", keys)   # YoY prior-year for the earliest selection months
        self.assertIn("2021-H1", keys)
        self.assertIn("2024-H1", keys)
        self.assertIn("2025-9M", keys)
        # report codes correct per type
        rc = {pk: rc for (_pt, pk, rc) in p}
        self.assertEqual(rc["2024"], "11011")      # annual
        self.assertEqual(rc["2024-Q1"], "11013")   # Q1
        self.assertEqual(rc["2024-H1"], "11012")   # H1
        self.assertEqual(rc["2024-9M"], "11014")   # 9M

    def test_period_type_tagging(self):
        p = B.required_periods(date(2024, 6, 1), date(2025, 12, 1))
        for pt, pk, _rc in p:
            self.assertEqual(pt, "annual" if "-" not in pk else "quarterly")


class TestLoadDone(unittest.TestCase):
    def test_resume_skips_completed(self):
        fd, path = tempfile.mkstemp(suffix=".jsonl")
        try:
            with os.fdopen(fd, "w") as f:
                f.write(json.dumps({"corp_code": "C1", "period_type": "annual", "period_key": "2023"}) + "\n")
                f.write(json.dumps({"corp_code": "C1", "period_type": "quarterly", "period_key": "2024-Q1"}) + "\n")
                f.write("\n")  # blank tolerated
            done = B.load_done(Path(path))
        finally:
            os.unlink(path)
        self.assertEqual(done, {("C1", "annual", "2023"), ("C1", "quarterly", "2024-Q1")})

    def test_load_done_missing_file_empty(self):
        self.assertEqual(B.load_done(Path("/tmp/_nope_does_not_exist.jsonl")), set())


if __name__ == "__main__":
    unittest.main()
