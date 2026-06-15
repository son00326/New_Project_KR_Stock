"""Unittest for scripts/dart_backfill.py — DART 실적 PIT 백필 (B+C)."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

import dart_backfill as B
import dart_signals as D


class _FakeResp:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code} for url: "
                               f"https://opendart.fss.or.kr/api/x?crtfc_key=SECRETKEY&corp=1")

    def json(self):
        return self._payload


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


class TestFetchOneClassification(unittest.TestCase):
    """omxy BC-R3 #1·#2: status 분류 — fatal hard-stop / malformed-000 / genuine ok / no_data."""

    def _run(self, payloads, parsed=None):
        # payloads = scope별(CFS, OFS) 응답 list. parsed = parse_dart_financial_response 반환 dict.
        first_key = D.FINANCIAL_KEYS[0]
        with mock.patch("requests.get", side_effect=[_FakeResp(p) for p in payloads]), \
             mock.patch.object(D, "parse_dart_financial_response",
                               return_value=(parsed if parsed is not None else {}, None)):
            return B._fetch_one("00126380", "2023", "11011", "KEY")

    def test_fatal_status_011_raises_fatal(self):
        with self.assertRaises(B.FatalConfigError):
            self._run([{"status": "011", "message": "사용할 수 없는 키"}])

    def test_fatal_status_901_raises_fatal(self):
        with self.assertRaises(B.FatalConfigError):
            self._run([{"status": "901"}])

    def test_quota_020_raises_ratelimit(self):
        with self.assertRaises(B.RateLimitError):
            self._run([{"status": "020"}])

    def test_genuine_000_with_content_is_ok(self):
        payload = {"status": "000", "list": [{"rcept_no": "20230315000123"}]}
        row, http = self._run([payload], parsed={D.FINANCIAL_KEYS[0]: 1000})
        self.assertEqual(row["status"], "ok")
        self.assertEqual(row["rcept_dt"], "20230315")
        self.assertEqual(row[D.FINANCIAL_KEYS[0]], 1000)
        self.assertEqual(http, 1)

    def test_000_no_content_both_scopes_is_schema_empty(self):
        # rcept_no는 있으나 파싱된 재무 0 → malformed-000. 양 scope 모두 → schema_empty(ok 아님).
        payload = {"status": "000", "list": [{"rcept_no": "20230315000123"}]}
        row, http = self._run([payload, payload], parsed={})
        self.assertEqual(row["status"], "schema_empty")
        self.assertIsNone(row["rcept_dt"])
        self.assertEqual(http, 2)

    def test_000_no_rcept_no_is_schema_empty(self):
        # 재무는 있으나 rcept_no 결여(rcept_dt None) → genuine ok 금지 → schema_empty.
        payload = {"status": "000", "list": []}
        row, _http = self._run([payload, payload], parsed={D.FINANCIAL_KEYS[0]: 5})
        self.assertEqual(row["status"], "schema_empty")

    def test_both_013_is_no_data(self):
        row, http = self._run([{"status": "013"}, {"status": "013"}])
        self.assertEqual(row["status"], "no_data")
        self.assertEqual(http, 2)

    def test_unexpected_status_is_transient_runtimeerror(self):
        # 100/800/900 등 → transient(캐시 금지). FatalConfigError/RateLimitError 아님.
        with self.assertRaises(RuntimeError) as cm:
            self._run([{"status": "900", "message": "정의되지 않은 오류"}])
        self.assertNotIsInstance(cm.exception, B.FatalConfigError)
        self.assertNotIsInstance(cm.exception, B.RateLimitError)


class TestRedact(unittest.TestCase):
    """omxy BC-R3 #3: 예외/URL 문자열의 crtfc_key 노출 차단."""

    def test_redacts_api_key_value(self):
        out = B._redact("error for url ...crtfc_key=SECRETKEY&corp=1", "SECRETKEY")
        self.assertNotIn("SECRETKEY", out)
        self.assertIn("***", out)

    def test_redacts_crtfc_key_param_even_without_key_arg(self):
        out = B._redact("url?crtfc_key=ABC123&x=1", None)
        self.assertNotIn("ABC123", out)
        self.assertIn("crtfc_key=***", out)

    def test_raise_for_status_url_leak_is_redacted(self):
        # raise_for_status가 query 포함 URL을 담는 경로를 _redact가 가리는지.
        try:
            _FakeResp({}, status_code=500).raise_for_status()
        except RuntimeError as exc:
            self.assertNotIn("SECRETKEY", B._redact(exc, "SECRETKEY"))
        else:
            self.fail("expected RuntimeError")


if __name__ == "__main__":
    unittest.main()
