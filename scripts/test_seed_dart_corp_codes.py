"""Unittest for scripts/seed_dart_corp_codes.py — corp_cls mapping + filtering."""
from __future__ import annotations

import io
import os
import unittest
import zipfile
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


class TestParseCorpCodeXml(unittest.TestCase):
    def test_kospi_kosdaq_konex_mapping(self):
        from scripts.seed_dart_corp_codes import parse_corp_code_xml

        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <result>
          <list>
            <corp_code>00126380</corp_code>
            <corp_name>삼성전자</corp_name>
            <stock_code>005930</stock_code>
            <corp_cls>Y</corp_cls>
          </list>
          <list>
            <corp_code>00164779</corp_code>
            <corp_name>셀트리온헬스케어</corp_name>
            <stock_code>091990</stock_code>
            <corp_cls>K</corp_cls>
          </list>
          <list>
            <corp_code>00111111</corp_code>
            <corp_name>코넥스기업</corp_name>
            <stock_code>222222</stock_code>
            <corp_cls>N</corp_cls>
          </list>
        </result>
        """
        rows = parse_corp_code_xml(xml)
        markets = {r["ticker"]: r["market"] for r in rows}
        self.assertEqual(markets["005930"], "KOSPI")
        self.assertEqual(markets["091990"], "KOSDAQ")
        self.assertEqual(markets["222222"], "KONEX")
        self.assertEqual(len(rows), 3)

    def test_exclude_unlisted_e_class(self):
        from scripts.seed_dart_corp_codes import parse_corp_code_xml

        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <result>
          <list>
            <corp_code>99999999</corp_code>
            <corp_name>유한회사예시</corp_name>
            <stock_code> </stock_code>
            <corp_cls>E</corp_cls>
          </list>
          <list>
            <corp_code>00126380</corp_code>
            <corp_name>삼성전자</corp_name>
            <stock_code>005930</stock_code>
            <corp_cls>Y</corp_cls>
          </list>
        </result>
        """
        rows = parse_corp_code_xml(xml)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["ticker"], "005930")

    def test_unknown_corp_cls_excluded(self):
        from scripts.seed_dart_corp_codes import parse_corp_code_xml

        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <result>
          <list>
            <corp_code>00126380</corp_code>
            <corp_name>알수없는회사</corp_name>
            <stock_code>123456</stock_code>
            <corp_cls>X</corp_cls>
          </list>
        </result>
        """
        rows = parse_corp_code_xml(xml)
        self.assertEqual(rows, [])

    def test_missing_corp_cls_uses_ticker_market_map(self):
        from scripts.seed_dart_corp_codes import parse_corp_code_xml

        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <result>
          <list>
            <corp_code>00126380</corp_code>
            <corp_name>삼성전자</corp_name>
            <stock_code>005930</stock_code>
          </list>
        </result>
        """
        rows = parse_corp_code_xml(xml, ticker_market_map={"005930": "KOSPI"})
        self.assertEqual(rows[0]["market"], "KOSPI")


class TestDownloadAndUpsert(unittest.TestCase):
    def test_extract_xml_from_zip_bytes(self):
        from scripts.seed_dart_corp_codes import extract_xml_from_zip

        xml_body = "<result><list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><stock_code>005930</stock_code><corp_cls>Y</corp_cls></list></result>"
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("CORPCODE.xml", xml_body)
        text = extract_xml_from_zip(buf.getvalue())
        self.assertIn("삼성전자", text)
        self.assertIn("005930", text)

    def test_upsert_batches_rows(self):
        from scripts.seed_dart_corp_codes import upsert_corp_codes

        client = MagicMock()
        table = MagicMock()
        client.table.return_value = table
        table.upsert.return_value = table
        table.execute.return_value = MagicMock(data=[{}])

        rows = [
            {"ticker": f"{i:06d}", "corp_code": f"{i:08d}", "corp_name": f"co{i}", "market": "KOSPI"}
            for i in range(1200)
        ]
        n = upsert_corp_codes(client, rows, batch_size=500)
        self.assertEqual(n, 1200)
        self.assertEqual(table.upsert.call_count, 3)


class TestFetchInduty(unittest.TestCase):
    """Plan §7.2 status matrix tests — DART company.json mocked."""

    def _mock_response(self, status_code: int, body: dict | None = None, raises_on_get: bool = False):
        mod = MagicMock()
        if raises_on_get:
            mod.get.side_effect = TimeoutError("simulated network failure")
            return mod
        resp = MagicMock()
        resp.status_code = status_code
        resp.json.return_value = body or {}
        mod.get.return_value = resp
        return mod

    def test_status_000_success_3_digit(self):
        from scripts.seed_dart_corp_codes import fetch_induty
        m = self._mock_response(200, {"status": "000", "induty_code": "264"})
        r = fetch_induty("00126380", "TESTKEY", requests_module=m)
        self.assertEqual(r["induty_code"], "264")
        self.assertEqual(r["induty_last_status"], "000")
        self.assertIsNone(r["error_kind"])

    def test_status_000_success_5_digit(self):
        from scripts.seed_dart_corp_codes import fetch_induty
        m = self._mock_response(200, {"status": "000", "induty_code": "70113"})
        r = fetch_induty("00126380", "TESTKEY", requests_module=m)
        self.assertEqual(r["induty_code"], "70113")
        self.assertIsNone(r["error_kind"])

    def test_status_000_with_non_numeric_induty_returns_none(self):
        from scripts.seed_dart_corp_codes import fetch_induty
        m = self._mock_response(200, {"status": "000", "induty_code": "ABC"})
        r = fetch_induty("00126380", "TESTKEY", requests_module=m)
        # status 000이라 last_status 보존되나, induty_code는 정합 안 됨 → None.
        self.assertIsNone(r["induty_code"])
        self.assertEqual(r["induty_last_status"], "000")
        self.assertIsNone(r["error_kind"])

    def test_status_013_no_data(self):
        from scripts.seed_dart_corp_codes import fetch_induty
        m = self._mock_response(200, {"status": "013", "message": "조회된 데이터 없음"})
        r = fetch_induty("00126380", "TESTKEY", requests_module=m)
        self.assertIsNone(r["induty_code"])
        self.assertEqual(r["induty_last_status"], "013")
        self.assertEqual(r["error_kind"], "no_data")

    def test_status_010_fail_fast(self):
        from scripts.seed_dart_corp_codes import fetch_induty
        m = self._mock_response(200, {"status": "010"})
        r = fetch_induty("00126380", "TESTKEY", requests_module=m)
        self.assertEqual(r["error_kind"], "fail_fast")
        self.assertEqual(r["induty_last_status"], "010")
        # retry 안 함 — 단 한 번만 호출.
        self.assertEqual(m.get.call_count, 1)

    def test_status_011_fail_fast(self):
        from scripts.seed_dart_corp_codes import fetch_induty
        m = self._mock_response(200, {"status": "011"})
        r = fetch_induty("00126380", "TESTKEY", requests_module=m)
        self.assertEqual(r["error_kind"], "fail_fast")

    def test_status_012_fail_fast(self):
        from scripts.seed_dart_corp_codes import fetch_induty
        m = self._mock_response(200, {"status": "012"})
        r = fetch_induty("00126380", "TESTKEY", requests_module=m)
        self.assertEqual(r["error_kind"], "fail_fast")
        self.assertEqual(m.get.call_count, 1)

    def test_status_901_fail_fast(self):
        from scripts.seed_dart_corp_codes import fetch_induty
        m = self._mock_response(200, {"status": "901"})
        r = fetch_induty("00126380", "TESTKEY", requests_module=m)
        self.assertEqual(r["error_kind"], "fail_fast")

    def test_status_020_retries(self):
        from scripts.seed_dart_corp_codes import fetch_induty, INDUTY_FETCH_MAX_RETRIES

        mod = MagicMock()
        # 모든 호출 020 → retry 모두 소진 → retry_exhausted.
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = {"status": "020"}
        mod.get.return_value = resp
        # Patch time.sleep to avoid real wait
        import scripts.seed_dart_corp_codes as mod_under_test
        from unittest.mock import patch
        with patch.object(mod_under_test, "time") as mock_time:
            mock_time.sleep = lambda *a, **k: None
            r = fetch_induty("00126380", "TESTKEY", requests_module=mod)
        self.assertEqual(r["error_kind"], "retry_exhausted")
        self.assertEqual(r["induty_last_status"], "020")
        # 1 + N retries
        self.assertEqual(mod.get.call_count, INDUTY_FETCH_MAX_RETRIES + 1)

    def test_status_800_and_900_retry(self):
        from scripts.seed_dart_corp_codes import fetch_induty, INDUTY_FETCH_MAX_RETRIES
        import scripts.seed_dart_corp_codes as mod_under_test
        from unittest.mock import patch

        for status in ("800", "900"):
            with self.subTest(status=status):
                mod = MagicMock()
                resp = MagicMock()
                resp.status_code = 200
                resp.json.return_value = {"status": status}
                mod.get.return_value = resp
                with patch.object(mod_under_test, "time") as mock_time:
                    mock_time.sleep = lambda *a, **k: None
                    r = fetch_induty("00126380", "TESTKEY", requests_module=mod)
                self.assertEqual(r["error_kind"], "retry_exhausted")
                self.assertEqual(r["induty_last_status"], status)
                self.assertEqual(mod.get.call_count, INDUTY_FETCH_MAX_RETRIES + 1)

    def test_network_timeout_all_attempts(self):
        from scripts.seed_dart_corp_codes import fetch_induty, INDUTY_FETCH_MAX_RETRIES

        mod = MagicMock()
        mod.get.side_effect = TimeoutError("net fail")
        import scripts.seed_dart_corp_codes as mod_under_test
        from unittest.mock import patch
        with patch.object(mod_under_test, "time") as mock_time:
            mock_time.sleep = lambda *a, **k: None
            r = fetch_induty("00126380", "TESTKEY", requests_module=mod)
        self.assertEqual(r["error_kind"], "timeout")
        self.assertEqual(mod.get.call_count, INDUTY_FETCH_MAX_RETRIES + 1)

    def test_api_key_redaction_in_url_logging(self):
        from scripts.seed_dart_corp_codes import _redact_key

        msg = "GET https://opendart.fss.or.kr/api/company.json?crtfc_key=MYSECRETKEY&corp_code=00126380 failed"
        redacted = _redact_key(msg, "MYSECRETKEY")
        self.assertNotIn("MYSECRETKEY", redacted)
        self.assertIn("***REDACTED***", redacted)

    def test_recovery_after_retry_then_success(self):
        """020 1회 retry → 000 성공 시나리오."""
        from scripts.seed_dart_corp_codes import fetch_induty

        mod = MagicMock()
        responses = [
            MagicMock(status_code=200, json=MagicMock(return_value={"status": "020"})),
            MagicMock(status_code=200, json=MagicMock(return_value={"status": "000", "induty_code": "264"})),
        ]
        mod.get.side_effect = responses
        import scripts.seed_dart_corp_codes as mod_under_test
        from unittest.mock import patch
        with patch.object(mod_under_test, "time") as mock_time:
            mock_time.sleep = lambda *a, **k: None
            r = fetch_induty("00126380", "TESTKEY", requests_module=mod)
        self.assertEqual(r["induty_code"], "264")
        self.assertEqual(r["induty_last_status"], "000")
        self.assertIsNone(r["error_kind"])
        self.assertEqual(mod.get.call_count, 2)


class TestBackfillIndutyMain(unittest.TestCase):
    """Process-level safety tests for --backfill-induty CLI wrapper."""

    class _FakeTable:
        def __init__(self):
            self.rows = [
                {"ticker": "005930", "corp_code": "00126380", "corp_name": "삼성전자", "induty_code": None},
            ]
            self.updates: list[dict] = []

        def select(self, *_args, **_kwargs):
            return self

        def update(self, payload):
            self.updates.append(payload)
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def execute(self):
            return SimpleNamespace(data=self.rows)

    class _FakeClient:
        def __init__(self):
            self.table_obj = TestBackfillIndutyMain._FakeTable()

        def table(self, _name):
            return self.table_obj

    def test_backfill_induty_dry_run_never_updates(self):
        import scripts.seed_dart_corp_codes as mod_under_test

        client = self._FakeClient()
        with (
            patch.object(mod_under_test, "fetch_induty", return_value={"induty_code": "264", "induty_last_status": "000", "error_kind": None}),
            patch.object(mod_under_test.time, "sleep", lambda *_args, **_kwargs: None),
        ):
            counts = mod_under_test.backfill_induty(client, "TESTKEY", dry_run=True)
        self.assertEqual(counts["ok"], 1)
        self.assertEqual(counts["written"], 0)
        self.assertEqual(client.table_obj.updates, [])

    def test_backfill_induty_writes_when_not_dry_run(self):
        import scripts.seed_dart_corp_codes as mod_under_test

        client = self._FakeClient()
        with (
            patch.object(mod_under_test, "fetch_induty", return_value={"induty_code": "264", "induty_last_status": "000", "error_kind": None}),
            patch.object(mod_under_test.time, "sleep", lambda *_args, **_kwargs: None),
        ):
            counts = mod_under_test.backfill_induty(client, "TESTKEY", dry_run=False)
        self.assertEqual(counts["ok"], 1)
        self.assertEqual(counts["written"], 1)
        self.assertEqual(client.table_obj.updates[0]["induty_code"], "264")

    def test_main_returns_nonzero_when_backfill_hits_fail_fast(self):
        import scripts.seed_dart_corp_codes as mod_under_test

        with (
            patch.dict(os.environ, {"DART_API_KEY": "TESTKEY"}, clear=False),
            patch.object(mod_under_test, "make_supabase_client", return_value=MagicMock()),
            patch.object(
                mod_under_test,
                "backfill_induty",
                return_value={
                    "processed": 1,
                    "ok": 0,
                    "no_data": 0,
                    "retry_exhausted": 0,
                    "fail_fast": 1,
                    "timeout": 0,
                    "written": 0,
                },
            ),
        ):
            self.assertEqual(mod_under_test.main(["--backfill-induty", "--dry-run"]), 1)


if __name__ == "__main__":
    unittest.main()
