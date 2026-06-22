#!/usr/bin/env python3
# noqa: SIZE_OK - PR-B4 unittest matrix is intentionally self-contained (no shared fixtures).
"""shadow_reconcile (PR-B4) 테스트 매트릭스 — stdlib unittest (pytest 미설치).

Run:
    cd scripts && ./.venv/bin/python -m unittest test_shadow_reconcile -v

Covers the pure reconcile core: classification (complete/missing/anomaly), fail-closed symmetric
input validation (one negative per boundary field), no-mutation, determinism, report aggregation
(summary, ordering, coverage_completeness, remediation, no-verdict), and the gap-SQL constant
invariants (MATERIALIZED present, read-only). NO DB — the SQL itself is proven by
scripts/pg_smoke_0039_prb4.sh against applied 0039.
"""
from __future__ import annotations

import contextlib
import copy
import io
import json
import os
import sys
import tempfile
import unittest

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

import shadow_reconcile as RC  # noqa: E402

NOW = "2026-06-22T10:30:00Z"


def _row(**over) -> dict:
    """A valid COMPLETE coverage-fact row; override fields per test."""
    base = {
        "period_key": "2026-06",
        "month": "2026-06-01",
        "mirror_ticker_count": 150,
        "mirror_run_id_count": 1,
        "mirror_all_logged": True,
        "mirror_run_id": "shadow-20260601T000000Z",
        "mirror_universe_size": 200,
        "mirror_universe_hash_count": 1,
        "mirror_universe_hash": "uhash-200",
        "snapshot_distinct_tickers": 200,
        "snapshot_universe_size_min": 200,
        "snapshot_universe_size": 200,
        "snapshot_universe_hash_count": 1,
        "snapshot_universe_hash": "uhash-200",
    }
    base.update(over)
    return base


# ===========================================================================
class ClassifyCoverageRowTest(unittest.TestCase):
    def test_complete(self):
        out = RC.classify_coverage_row(_row())
        self.assertEqual(out["status"], "complete")
        self.assertIsNone(out["reason"])
        self.assertEqual(out["mirror_run_id"], "shadow-20260601T000000Z")

    def test_missing_zero_tickers(self):
        out = RC.classify_coverage_row(
            _row(mirror_ticker_count=0, mirror_run_id_count=0, mirror_all_logged=False, mirror_run_id=None)
        )
        self.assertEqual(out["status"], "missing")
        self.assertIsNone(out["mirror_run_id"])
        self.assertIn("no production-mirror", out["reason"])

    def test_anomaly_under_150(self):
        out = RC.classify_coverage_row(_row(mirror_ticker_count=149))
        self.assertEqual(out["status"], "anomaly")
        self.assertIn("149", out["reason"])

    def test_anomaly_multi_run_id(self):
        out = RC.classify_coverage_row(_row(mirror_run_id_count=2))
        self.assertEqual(out["status"], "anomaly")
        self.assertIn("run_ids=2", out["reason"])

    def test_anomaly_not_all_logged(self):
        out = RC.classify_coverage_row(_row(mirror_all_logged=False))
        self.assertEqual(out["status"], "anomaly")
        self.assertIn("all_logged=False", out["reason"])

    def test_anomaly_snapshot_missing(self):
        # candidates complete (150/1/logged) but NO matching snapshot run → not ready for PR-B5.
        out = RC.classify_coverage_row(
            _row(snapshot_distinct_tickers=0, snapshot_universe_size_min=0, snapshot_universe_size=0))
        self.assertEqual(out["status"], "anomaly")
        self.assertIn("snap_distinct=0", out["reason"])     # specific, not just "snapshot incomplete"

    def test_anomaly_snapshot_ticker_mismatch(self):
        # snapshot present, uniform universe_size, but distinct tickers < candidates' N (rows deleted).
        out = RC.classify_coverage_row(_row(snapshot_distinct_tickers=199))
        self.assertEqual(out["status"], "anomaly")
        self.assertIn("snap_distinct=199", out["reason"])

    def test_anomaly_universe_size_mismatch(self):
        # candidate universe_size != snapshot universe_size → torn/inconsistent run.
        out = RC.classify_coverage_row(_row(mirror_universe_size=201))
        self.assertEqual(out["status"], "anomaly")
        self.assertIn("mirror_universe_size=201", out["reason"])

    def test_anomaly_snapshot_nonuniform_universe_size(self):
        # snapshot rows carry mixed universe_size (min != max) → partial/buggy write → anomaly.
        out = RC.classify_coverage_row(_row(snapshot_universe_size_min=199, snapshot_universe_size=200))
        self.assertEqual(out["status"], "anomaly")
        self.assertIn("min=199", out["reason"])

    def test_anomaly_universe_hash_mismatch(self):
        out = RC.classify_coverage_row(_row(snapshot_universe_hash="uhash-other"))
        self.assertEqual(out["status"], "anomaly")
        self.assertIn("universe_hash mismatch/non-uniform", out["reason"])
        self.assertIn("uhash-other", out["reason"])

    def test_anomaly_mirror_universe_hash_nonuniform(self):
        out = RC.classify_coverage_row(_row(mirror_universe_hash_count=2))
        self.assertEqual(out["status"], "anomaly")
        self.assertIn("mirror_hash_count=2", out["reason"])

    def test_anomaly_snapshot_universe_hash_nonuniform(self):
        out = RC.classify_coverage_row(_row(snapshot_universe_hash_count=2))
        self.assertEqual(out["status"], "anomaly")
        self.assertIn("snapshot_hash_count=2", out["reason"])

    def test_anomaly_universe_hash_empty(self):
        out = RC.classify_coverage_row(_row(mirror_universe_hash="", snapshot_universe_hash=""))
        self.assertEqual(out["status"], "anomaly")
        self.assertIn("universe_hash mismatch/non-uniform", out["reason"])

    def test_anomaly_universe_hash_whitespace_only(self):
        # bool('   ') is True — whitespace-only (hand-fed) hash must still be rejected, not 'complete'.
        out = RC.classify_coverage_row(_row(mirror_universe_hash="   ", snapshot_universe_hash="   "))
        self.assertEqual(out["status"], "anomaly")
        self.assertIn("universe_hash mismatch/non-uniform", out["reason"])

    def test_anomaly_self_referential_tamper_caught(self):
        # the H1 hole: a lowered-but-self-consistent snapshot (distinct==max==150) must STILL be anomaly
        # because it disagrees with the candidates' declared universe_size (200) — anchored to candidates' N.
        out = RC.classify_coverage_row(
            _row(snapshot_distinct_tickers=150, snapshot_universe_size_min=150, snapshot_universe_size=150))
        self.assertEqual(out["status"], "anomaly")
        self.assertIn("mirror_universe_size=200", out["reason"])

    def test_anomaly_lists_both_problems(self):
        out = RC.classify_coverage_row(_row(mirror_ticker_count=149, snapshot_distinct_tickers=0,
                                            snapshot_universe_size_min=0, snapshot_universe_size=0))
        self.assertEqual(out["status"], "anomaly")
        self.assertIn("candidates not 150", out["reason"])
        self.assertIn("snap_distinct=0", out["reason"])

    def test_weekly_period_key_rejected(self):
        # MONTHLY-only scope (§8): a hand-fed weekly key must NOT be accepted/counted.
        with self.assertRaises(RC.ReconcileInputError):
            RC.classify_coverage_row(_row(period_key="2026-W25"))

    def test_deterministic(self):
        r = _row()
        self.assertEqual(RC.classify_coverage_row(r), RC.classify_coverage_row(copy.deepcopy(r)))

    def test_output_field_set(self):
        out = RC.classify_coverage_row(_row())
        self.assertEqual(
            set(out),
            {"period_key", "month", "status", "mirror_run_id",
             "mirror_ticker_count", "mirror_run_id_count", "mirror_all_logged",
             "mirror_universe_size", "mirror_universe_hash_count", "mirror_universe_hash",
             "snapshot_distinct_tickers", "snapshot_universe_size_min", "snapshot_universe_size",
             "snapshot_universe_hash_count", "snapshot_universe_hash", "reason"},
        )


# ===========================================================================
class FailClosedSymmetricTest(unittest.TestCase):
    """One negative per boundary field — feedback_failclosed_symmetric_completion."""

    def _bad(self, row):
        with self.assertRaises(RC.ReconcileInputError):
            RC.classify_coverage_row(row)

    def test_row_not_dict(self):
        self._bad(["not", "a", "dict"])

    def test_period_key_missing(self):
        r = _row(); del r["period_key"]; self._bad(r)

    def test_period_key_wrong_type(self):
        self._bad(_row(period_key=202606))

    def test_period_key_bad_format(self):
        self._bad(_row(period_key="2026/06"))

    def test_month_missing(self):
        r = _row(); del r["month"]; self._bad(r)

    def test_month_wrong_type(self):
        self._bad(_row(month=20260601))

    def test_month_bad_format(self):
        self._bad(_row(month="2026-06"))            # missing -01

    def test_month_not_first(self):
        self._bad(_row(month="2026-06-15"))

    def test_period_month_mismatch(self):
        self._bad(_row(period_key="2026-05", month="2026-06-01"))

    def test_impossible_month_13(self):
        self._bad(_row(period_key="2026-13", month="2026-13-01"))

    def test_impossible_month_00(self):
        self._bad(_row(period_key="2026-00", month="2026-00-01"))

    def test_ticker_count_missing(self):
        r = _row(); del r["mirror_ticker_count"]; self._bad(r)

    def test_ticker_count_wrong_type(self):
        self._bad(_row(mirror_ticker_count="150"))

    def test_ticker_count_bool_rejected(self):
        self._bad(_row(mirror_ticker_count=True))   # bool must not coerce to 1

    def test_ticker_count_negative(self):
        self._bad(_row(mirror_ticker_count=-1))

    def test_run_id_count_wrong_type(self):
        self._bad(_row(mirror_run_id_count="1"))

    def test_run_id_count_bool_rejected(self):
        self._bad(_row(mirror_run_id_count=True))

    def test_all_logged_missing(self):
        r = _row(); del r["mirror_all_logged"]; self._bad(r)

    def test_all_logged_wrong_type(self):
        self._bad(_row(mirror_all_logged="true"))   # str must not coerce

    def test_all_logged_int_rejected(self):
        self._bad(_row(mirror_all_logged=1))

    def test_mirror_run_id_wrong_type(self):
        self._bad(_row(mirror_run_id=123))

    def test_mirror_run_id_none_ok(self):
        out = RC.classify_coverage_row(
            _row(mirror_ticker_count=0, mirror_run_id_count=0, mirror_all_logged=False,
                 mirror_run_id=None, snapshot_distinct_tickers=0, snapshot_universe_size=0)
        )
        self.assertEqual(out["status"], "missing")

    def test_mirror_universe_size_missing(self):
        r = _row(); del r["mirror_universe_size"]; self._bad(r)

    def test_mirror_universe_size_wrong_type(self):
        self._bad(_row(mirror_universe_size="200"))

    def test_mirror_universe_size_bool_rejected(self):
        self._bad(_row(mirror_universe_size=True))

    def test_mirror_universe_size_negative(self):
        self._bad(_row(mirror_universe_size=-1))

    def test_mirror_universe_hash_count_missing(self):
        r = _row(); del r["mirror_universe_hash_count"]; self._bad(r)

    def test_mirror_universe_hash_count_wrong_type(self):
        self._bad(_row(mirror_universe_hash_count="1"))

    def test_mirror_universe_hash_count_bool_rejected(self):
        self._bad(_row(mirror_universe_hash_count=True))

    def test_mirror_universe_hash_count_negative(self):
        self._bad(_row(mirror_universe_hash_count=-1))

    def test_mirror_universe_hash_missing(self):
        r = _row(); del r["mirror_universe_hash"]; self._bad(r)

    def test_mirror_universe_hash_wrong_type(self):
        self._bad(_row(mirror_universe_hash=123))

    def test_snapshot_distinct_missing(self):
        r = _row(); del r["snapshot_distinct_tickers"]; self._bad(r)

    def test_snapshot_distinct_wrong_type(self):
        self._bad(_row(snapshot_distinct_tickers="200"))

    def test_snapshot_distinct_bool_rejected(self):
        self._bad(_row(snapshot_distinct_tickers=True))

    def test_snapshot_distinct_negative(self):
        self._bad(_row(snapshot_distinct_tickers=-1))

    def test_snapshot_universe_size_min_missing(self):
        r = _row(); del r["snapshot_universe_size_min"]; self._bad(r)

    def test_snapshot_universe_size_min_wrong_type(self):
        self._bad(_row(snapshot_universe_size_min="200"))

    def test_snapshot_universe_size_min_negative(self):
        self._bad(_row(snapshot_universe_size_min=-1))

    def test_snapshot_universe_size_missing(self):
        r = _row(); del r["snapshot_universe_size"]; self._bad(r)

    def test_snapshot_universe_size_wrong_type(self):
        self._bad(_row(snapshot_universe_size="200"))

    def test_snapshot_universe_size_bool_rejected(self):
        self._bad(_row(snapshot_universe_size=True))

    def test_snapshot_universe_hash_count_missing(self):
        r = _row(); del r["snapshot_universe_hash_count"]; self._bad(r)

    def test_snapshot_universe_hash_count_wrong_type(self):
        self._bad(_row(snapshot_universe_hash_count="1"))

    def test_snapshot_universe_hash_count_bool_rejected(self):
        self._bad(_row(snapshot_universe_hash_count=True))

    def test_snapshot_universe_hash_count_negative(self):
        self._bad(_row(snapshot_universe_hash_count=-1))

    def test_snapshot_universe_hash_missing(self):
        r = _row(); del r["snapshot_universe_hash"]; self._bad(r)

    def test_snapshot_universe_hash_wrong_type(self):
        self._bad(_row(snapshot_universe_hash=123))


# ===========================================================================
class BuildReportTest(unittest.TestCase):
    def _rows(self):
        return [
            _row(period_key="2026-04", month="2026-04-01"),                                   # complete
            _row(period_key="2026-05", month="2026-05-01", mirror_ticker_count=0,
                 mirror_run_id_count=0, mirror_all_logged=False, mirror_run_id=None,
                 snapshot_distinct_tickers=0, snapshot_universe_size=0),                        # missing
            _row(period_key="2026-06", month="2026-06-01", mirror_ticker_count=149),           # anomaly
        ]

    def test_summary_counts(self):
        rep = RC.build_reconcile_report(self._rows(), now_iso=NOW)
        self.assertEqual(rep["summary"], {"total": 3, "complete": 1, "missing": 1, "anomaly": 1})

    def test_order_preserved(self):
        rep = RC.build_reconcile_report(self._rows(), now_iso=NOW)
        self.assertEqual([p["period_key"] for p in rep["periods"]], ["2026-04", "2026-05", "2026-06"])

    def test_coverage_completeness_descriptive(self):
        rep = RC.build_reconcile_report(self._rows(), now_iso=NOW)
        cc = rep["coverage_completeness"]
        self.assertEqual(cc["complete_periods"], 1)
        self.assertEqual(cc["forward_floor"], RC.FORWARD_FLOOR_PERIODS)
        self.assertIn("NOT an evaluation outcome", cc["note"])

    def test_remediation_presence(self):
        # NOW = 2026-06 → 2026-05 is a PAST missing period.
        rep = RC.build_reconcile_report(self._rows(), now_iso=NOW)
        by_pk = {p["period_key"]: p for p in rep["periods"]}
        self.assertIsNone(by_pk["2026-04"]["remediation"])              # complete → none
        # PAST missing → UNBACKFILLABLE, NO runnable command (forward-only mechanical guard).
        self.assertIn("UNBACKFILLABLE", by_pk["2026-05"]["remediation"])
        self.assertIn("DO NOT re-run", by_pk["2026-05"]["remediation"])
        self.assertNotIn("--shadow-sector", by_pk["2026-05"]["remediation"])  # no pasteable command
        self.assertIn("integrity anomaly", by_pk["2026-06"]["remediation"])

    def test_remediation_current_period_gets_command_past_does_not(self):
        # forward-honesty is MECHANICAL: only the CURRENT period's missing remediation carries a runnable
        # command; a past period of the SAME report does not. now=2026-06 → 2026-06 current, 2026-05 past.
        rows = [
            _row(period_key="2026-05", month="2026-05-01", mirror_ticker_count=0,
                 mirror_run_id_count=0, mirror_all_logged=False, mirror_run_id=None,
                 snapshot_distinct_tickers=0, snapshot_universe_size_min=0, snapshot_universe_size=0),
            _row(period_key="2026-06", month="2026-06-01", mirror_ticker_count=0,
                 mirror_run_id_count=0, mirror_all_logged=False, mirror_run_id=None,
                 snapshot_distinct_tickers=0, snapshot_universe_size_min=0, snapshot_universe_size=0),
        ]
        rep = RC.build_reconcile_report(rows, now_iso=NOW)
        by_pk = {p["period_key"]: p for p in rep["periods"]}
        # current period 2026-06 → runnable command present
        self.assertIn("--shadow-sector --month 2026-06-01", by_pk["2026-06"]["remediation"])
        self.assertIn("CURRENT period", by_pk["2026-06"]["remediation"])
        # past period 2026-05 → NO command, marked unbackfillable
        self.assertNotIn("--shadow-sector", by_pk["2026-05"]["remediation"])
        self.assertIn("UNBACKFILLABLE", by_pk["2026-05"]["remediation"])

    def test_remediation_current_period_uses_kst_not_utc_month(self):
        missing = {
            "mirror_ticker_count": 0,
            "mirror_run_id_count": 0,
            "mirror_all_logged": False,
            "mirror_run_id": None,
            "mirror_universe_size": 0,
            "mirror_universe_hash_count": 0,
            "mirror_universe_hash": "",
            "snapshot_distinct_tickers": 0,
            "snapshot_universe_size_min": 0,
            "snapshot_universe_size": 0,
            "snapshot_universe_hash_count": 0,
            "snapshot_universe_hash": "",
        }
        rows = [
            _row(period_key="2026-06", month="2026-06-01", **missing),
            _row(period_key="2026-07", month="2026-07-01", **missing),
        ]
        rep = RC.build_reconcile_report(rows, now_iso="2026-06-30T16:00:00Z")
        by_pk = {p["period_key"]: p for p in rep["periods"]}
        self.assertNotIn("--shadow-sector", by_pk["2026-06"]["remediation"])
        self.assertIn("UNBACKFILLABLE", by_pk["2026-06"]["remediation"])
        self.assertIn("--shadow-sector --month 2026-07-01", by_pk["2026-07"]["remediation"])

    def test_no_forbidden_verdict_vocabulary_in_artifact(self):
        # §6.7 lexical discipline for stage-0 artifacts: the report's STRING VALUES must not carry
        # recall/verdict/outperform/predict or PASS/FAIL verdict labels (even negated). Code comments
        # may discuss them; the emitted artifact must not.
        rep = RC.build_reconcile_report(self._rows(), now_iso=NOW)
        blob = json.dumps(rep, ensure_ascii=False)
        for tok in ("recall", "verdict", "outperform", "predict"):
            self.assertNotIn(tok, blob.lower(), f"forbidden token {tok!r} leaked into artifact")
        for tok in ("PASS", "FAIL"):
            self.assertNotIn(tok, blob, f"forbidden verdict label {tok!r} leaked into artifact")

    def test_generated_at_stamped(self):
        rep = RC.build_reconcile_report(self._rows(), now_iso=NOW)
        self.assertEqual(rep["generated_at"], NOW)

    def test_no_verdict_keys(self):
        rep = RC.build_reconcile_report(self._rows(), now_iso=NOW)
        deny = {"verdict", "passed", "pass", "fail", "failed", "triple_gate",
                "gate_a", "gate_a_recall", "recall", "recall_lift", "ic_ir"}

        def walk(obj):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    self.assertNotIn(k.lower(), deny, f"verdict key leaked: {k}")
                    walk(v)
            elif isinstance(obj, list):
                for it in obj:
                    walk(it)
        walk(rep)

    def test_empty_rows_ok(self):
        rep = RC.build_reconcile_report([], now_iso=NOW)
        self.assertEqual(rep["summary"], {"total": 0, "complete": 0, "missing": 0, "anomaly": 0})
        self.assertEqual(rep["periods"], [])

    # fail-closed at report level
    def test_rows_not_list(self):
        with self.assertRaises(RC.ReconcileInputError):
            RC.build_reconcile_report({"period_key": "2026-06"}, now_iso=NOW)

    def test_duplicate_period_key(self):
        with self.assertRaises(RC.ReconcileInputError):
            RC.build_reconcile_report([_row(), _row()], now_iso=NOW)

    def test_now_iso_wrong_type(self):
        with self.assertRaises(RC.ReconcileInputError):
            RC.build_reconcile_report(self._rows(), now_iso=20260622)

    def test_now_iso_bad_format(self):
        with self.assertRaises(RC.ReconcileInputError):
            RC.build_reconcile_report(self._rows(), now_iso="2026-06-22")  # no time part

    def test_now_iso_unparseable(self):
        with self.assertRaises(RC.ReconcileInputError):
            RC.build_reconcile_report(self._rows(), now_iso="2026-13-99T99:99:99Z")

    def test_forward_floor_not_positive(self):
        with self.assertRaises(RC.ReconcileInputError):
            RC.build_reconcile_report(self._rows(), now_iso=NOW, forward_floor=0)

    def test_forward_floor_bool_rejected(self):
        with self.assertRaises(RC.ReconcileInputError):
            RC.build_reconcile_report(self._rows(), now_iso=NOW, forward_floor=True)

    def test_element_invalid_propagates(self):
        with self.assertRaises(RC.ReconcileInputError):
            RC.build_reconcile_report([_row(period_key="bad")], now_iso=NOW)


# ===========================================================================
class NoMutationTest(unittest.TestCase):
    def test_classify_no_mutation(self):
        r = _row()
        before = copy.deepcopy(r)
        RC.classify_coverage_row(r)
        self.assertEqual(r, before)

    def test_report_no_mutation(self):
        rows = [_row(period_key="2026-04", month="2026-04-01"),
                _row(period_key="2026-05", month="2026-05-01",
                     mirror_ticker_count=0, mirror_run_id_count=0, mirror_all_logged=False, mirror_run_id=None)]
        before = copy.deepcopy(rows)
        RC.build_reconcile_report(rows, now_iso=NOW)
        self.assertEqual(rows, before)

    def test_report_deterministic(self):
        rows = [_row()]
        self.assertEqual(
            RC.build_reconcile_report(rows, now_iso=NOW),
            RC.build_reconcile_report(copy.deepcopy(rows), now_iso=NOW),
        )


# ===========================================================================
class GapSqlConstantTest(unittest.TestCase):
    def test_materialized_on_all_ctes(self):
        self.assertEqual(RC.RECONCILE_GAP_SQL.count("as materialized"), 3)  # prod + mirror + snap

    def test_targets_production_mirror_only(self):
        self.assertIn("arm = 'production-mirror'", RC.RECONCILE_GAP_SQL)

    def test_verifies_universe_snapshot(self):
        # complete must verify the recall denominator PR-B5 consumes, not just candidates.
        self.assertIn("tier0_shadow_universe_snapshot", RC.RECONCILE_GAP_SQL)
        self.assertIn("sn.run_id = m.mirror_run_id", RC.RECONCILE_GAP_SQL)  # FIX-J same-run join
        self.assertIn("mirror_universe_hash_count", RC.RECONCILE_GAP_SQL)
        self.assertIn("snapshot_universe_hash_count", RC.RECONCILE_GAP_SQL)

    def test_read_only_no_mutation_or_claim(self):
        # check the EXECUTABLE form (comments stripped) — the comment legitimately names the
        # "SKIP-LOCKED over-claim root cause" anti-pattern, which must not trip a read-only assertion.
        upper = RC._sql_inline().upper()
        for forbidden in ("SKIP LOCKED", "FOR UPDATE", "UPDATE ", "INSERT ", "DELETE "):
            self.assertNotIn(forbidden, upper, f"gap SQL must be read-only; found {forbidden!r}")

    def test_normalizes_production_month(self):
        # production tier0_candidates_150.month has no day=1 CHECK (0028) → must date_trunc.
        self.assertIn("date_trunc('month', month)", RC.RECONCILE_GAP_SQL)

    def test_sql_inline_strips_comments_and_semicolon(self):
        inline = RC._sql_inline()
        self.assertNotIn("--", inline)
        self.assertFalse(inline.rstrip().endswith(";"))
        self.assertIn("as materialized", inline)
        self.assertNotIn("\n", inline)


# ===========================================================================
class MainEntrypointTest(unittest.TestCase):
    """The thin I/O boundary (argv → file read / print). main() returns an int exit code."""

    def _run(self, argv):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            rc = RC.main(argv)
        return rc, out.getvalue()

    def _write(self, content) -> str:
        fh = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
        if isinstance(content, str):
            fh.write(content)
        else:
            json.dump(content, fh)
        fh.close()
        self.addCleanup(os.unlink, fh.name)
        return fh.name

    def test_print_sql(self):
        rc, out = self._run(["--print-sql"])
        self.assertEqual(rc, 0)
        self.assertIn("as materialized", out)
        self.assertIn("tier0_shadow_universe_snapshot", out)

    def test_print_sql_inline_single_line_no_comments(self):
        rc, out = self._run(["--print-sql-inline"])
        self.assertEqual(rc, 0)
        line = out.strip()
        self.assertNotIn("--", line)
        self.assertNotIn("\n", line)

    def test_no_args_returns_2(self):
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            rc = RC.main([])
        self.assertEqual(rc, 2)
        self.assertIn("read-only", err.getvalue())

    def test_coverage_json_valid(self):
        path = self._write([_row(period_key="2026-06", month="2026-06-01")])
        rc, out = self._run(["--coverage-json", path])
        self.assertEqual(rc, 0)
        rep = json.loads(out)
        self.assertEqual(rep["summary"]["complete"], 1)

    def test_coverage_json_null_becomes_empty(self):
        # psql json_agg over zero rows → SQL NULL → JSON null → [] (no production periods).
        path = self._write("null")
        rc, out = self._run(["--coverage-json", path])
        self.assertEqual(rc, 0)
        rep = json.loads(out)
        self.assertEqual(rep["summary"], {"total": 0, "complete": 0, "missing": 0, "anomaly": 0})

    def test_coverage_json_malformed_aborts_2(self):
        path = self._write([{"period_key": "bad"}])
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            rc = RC.main(["--coverage-json", path])
        self.assertEqual(rc, 2)
        self.assertIn("ABORT", err.getvalue())


if __name__ == "__main__":
    unittest.main(verbosity=2)
