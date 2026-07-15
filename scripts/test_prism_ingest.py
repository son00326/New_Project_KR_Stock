import hashlib
import http.client
import io
import json
import os
import runpy
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import date, datetime, timedelta, timezone
from email.message import Message
from pathlib import Path
from typing import final, override
from unittest import mock
from urllib.error import HTTPError

from scripts import prism_ingest


@final
class PrismIngestTest(unittest.TestCase):
    @override
    def __init__(self, methodName: str = "runTest") -> None:
        super().__init__(methodName)
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.path = Path(self.temp_dir.name) / "dashboard.json"
        self.now = datetime(2026, 7, 15, 12, 0, tzinfo=timezone(timedelta(hours=9)))

    def write_payload(self, payload: dict[str, object], age_seconds: int = 60) -> bytes:
        raw = json.dumps(payload, separators=(",", ":")).encode()
        self.path.write_bytes(raw)
        mtime = self.now.timestamp() - age_seconds
        os.utime(self.path, (mtime, mtime))
        return raw

    def write_main_payload(self, payload: dict[str, object] | None = None) -> bytes:
        selected = self.kr_payload() if payload is None else payload
        raw = json.dumps(selected, separators=(",", ":")).encode()
        self.path.write_bytes(raw)
        generated_at = prism_ingest.parse_generated_at(selected).timestamp()
        os.utime(self.path, (generated_at, generated_at))
        return raw

    @staticmethod
    def boot_env() -> dict[str, str]:
        return {
            "PRISM_INGEST_CONFIRM": "1",
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "secret",
            "PRISM_SOURCE_COMMIT": prism_ingest.SOURCE_COMMIT,
        }

    @staticmethod
    def kr_payload() -> dict[str, object]:
        return {
            "generated_at": "2026-07-15T11:05:00",
            "trading_mode": "virtual",
            "summary": {},
            "holdings": [],
            "real_portfolio": [],
            "account_summary": {},
            "trading_history": [],
            "watchlist": [],
            "market": "KR",
            "currency": "KRW",
            "market_condition": [{"date": "2026-07-15"}],
            "prism_performance": [
                {
                    "date": "2026-07-15",
                    "cumulative_realized_profit": 1200.5,
                    "prism_simulator_return": 1.25,
                }
            ],
        }

    def test_freshness_rejects_file_younger_than_30_seconds(self) -> None:
        self.write_payload(self.kr_payload(), age_seconds=29)
        with self.assertRaisesRegex(prism_ingest.IngestError, "file_too_young"):
            prism_ingest.read_stable_file(self.path, self.now, lambda _: None)

    def test_freshness_rejects_file_older_than_6_hours(self) -> None:
        self.write_payload(self.kr_payload(), age_seconds=6 * 60 * 60 + 1)
        with self.assertRaisesRegex(prism_ingest.IngestError, "file_too_old"):
            prism_ingest.read_stable_file(self.path, self.now, lambda _: None)

    def test_freshness_rejects_size_change_during_probe(self) -> None:
        self.write_payload(self.kr_payload())
        original_mtime = self.path.stat().st_mtime

        def mutate(_: float) -> None:
            with self.path.open("ab") as target:
                target.write(b" ")
            os.utime(self.path, (original_mtime, original_mtime))

        with self.assertRaisesRegex(prism_ingest.IngestError, "file_size_unstable"):
            prism_ingest.read_stable_file(self.path, self.now, mutate)

    def test_freshness_rejects_mtime_change_and_short_read(self) -> None:
        self.write_payload(self.kr_payload())
        original_mtime = self.path.stat().st_mtime

        def touch(_: float) -> None:
            os.utime(self.path, (original_mtime + 1, original_mtime + 1))

        with self.assertRaisesRegex(prism_ingest.IngestError, "file_too_young"):
            prism_ingest.read_stable_file(self.path, self.now, touch)
        os.utime(self.path, (original_mtime, original_mtime))
        with mock.patch.object(Path, "read_bytes", return_value=b"{}"):
            with self.assertRaisesRegex(prism_ingest.IngestError, "file_size_unstable"):
                prism_ingest.read_stable_file(self.path, self.now, lambda _: None)

    def test_freshness_rejects_oversize_before_read(self) -> None:
        with self.path.open("wb") as target:
            target.truncate(prism_ingest.MAX_PAYLOAD_BYTES + 1)
        mtime = self.now.timestamp() - 60
        os.utime(self.path, (mtime, mtime))
        with mock.patch.object(Path, "read_bytes") as read_bytes:
            with self.assertRaisesRegex(prism_ingest.IngestError, "payload_too_large"):
                prism_ingest.read_stable_file(self.path, self.now, lambda _: None)
        read_bytes.assert_not_called()

    def test_market_cross_validation_accepts_only_matching_markets(self) -> None:
        kr = self.kr_payload()
        us = {**kr, "market": "US", "currency": "USD"}
        prism_ingest.validate_envelope(kr, "kr")
        prism_ingest.validate_envelope({k: v for k, v in kr.items() if k not in ("market", "currency")}, "kr")
        prism_ingest.validate_envelope(us, "us")
        with self.assertRaisesRegex(prism_ingest.IngestError, "market_payload_mismatch"):
            prism_ingest.validate_envelope(us, "kr")
        with self.assertRaisesRegex(prism_ingest.IngestError, "market_payload_mismatch"):
            prism_ingest.validate_envelope(kr, "us")

    def test_market_cross_validation_rejects_wrong_boundary_types(self) -> None:
        for key in ("market", "currency"):
            with self.subTest(key=key):
                payload = self.kr_payload()
                payload[key] = 1
                with self.assertRaisesRegex(prism_ingest.IngestError, f"bad_{key}_type"):
                    prism_ingest.validate_envelope(payload, "kr")

    def test_envelope_requires_all_common_top_level_fields(self) -> None:
        for key in ("trading_mode", "summary", "holdings", "real_portfolio", "account_summary", "trading_history", "watchlist"):
            with self.subTest(key=key):
                payload = self.kr_payload()
                del payload[key]
                with self.assertRaisesRegex(prism_ingest.IngestError, f"bad_{key}_type"):
                    prism_ingest.validate_envelope(payload, "kr")

    def test_generated_at_requires_naive_iso_datetime(self) -> None:
        for value in ("2026-07-15", "2026-07-15T11:05:00+09:00", 123):
            with self.subTest(value=value):
                payload = self.kr_payload()
                payload["generated_at"] = value
                with self.assertRaisesRegex(prism_ingest.IngestError, "generated_at"):
                    prism_ingest.parse_generated_at(payload)

    def test_generated_at_must_be_within_45_minutes_of_file_mtime(self) -> None:
        generated_at = prism_ingest.parse_generated_at(self.kr_payload())
        prism_ingest.validate_generated_at_mtime(generated_at, generated_at.timestamp() + 45 * 60)
        with self.assertRaisesRegex(prism_ingest.IngestError, "generated_at_mtime_mismatch"):
            prism_ingest.validate_generated_at_mtime(generated_at, generated_at.timestamp() + 9 * 60 * 60)
        raw = self.write_main_payload()
        shifted_mtime = generated_at.timestamp() + 9 * 60 * 60
        os.utime(self.path, (shifted_mtime, shifted_mtime))
        stderr = io.StringIO()
        with mock.patch.dict(os.environ, self.boot_env(), clear=True), \
             mock.patch.object(prism_ingest, "read_stable_file", return_value=raw), \
             mock.patch.object(prism_ingest, "call_rpc") as call_rpc, redirect_stderr(stderr):
            code = prism_ingest.main(["--market", "kr", "--file", str(self.path), "--slot", "am"])
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(stderr.getvalue())["error"], "generated_at_mtime_mismatch")
        call_rpc.assert_not_called()

    def test_terminal_extracts_last_point_not_after_session_boundary(self) -> None:
        payload = self.kr_payload()
        payload["prism_performance"] = [
            {"date": "2026-07-14", "cumulative_realized_profit": 1, "prism_simulator_return": 0.1},
            {"date": "2026-07-16", "cumulative_realized_profit": 3, "prism_simulator_return": 0.3},
            {"date": "2026-07-15", "cumulative_realized_profit": 2, "prism_simulator_return": 0.2},
        ]
        terminal = prism_ingest.extract_terminal_performance(payload, date(2026, 7, 15))
        self.assertEqual(terminal, payload["prism_performance"][2])

    def test_terminal_returns_none_for_absent_or_empty_array(self) -> None:
        payload = self.kr_payload()
        del payload["prism_performance"]
        self.assertIsNone(prism_ingest.extract_terminal_performance(payload, date(2026, 7, 15)))
        payload["prism_performance"] = []
        self.assertIsNone(prism_ingest.extract_terminal_performance(payload, date(2026, 7, 15)))

    def test_terminal_rejects_non_finite_and_wrong_types(self) -> None:
        for value in (True, float("inf"), "1"):
            with self.subTest(value=value):
                payload = self.kr_payload()
                payload["prism_performance"] = [{
                    "date": "2026-07-15",
                    "cumulative_realized_profit": 1200.5,
                    "prism_simulator_return": value,
                }]
                with self.assertRaisesRegex(prism_ingest.IngestError, "bad_terminal_number"):
                    prism_ingest.extract_terminal_performance(payload, date(2026, 7, 15))

    def test_session_date_uses_payload_max_and_nominal_fallback(self) -> None:
        payload = self.kr_payload()
        payload["market_condition"] = [{"date": "2026-07-13"}, {"date": "2026-07-14"}]
        self.assertEqual(
            prism_ingest.resolve_session_date(payload, "kr", date(2026, 7, 15)),
            (date(2026, 7, 14), "payload"),
        )
        del payload["market_condition"]
        self.assertEqual(
            prism_ingest.resolve_session_date(payload, "us", date(2026, 7, 15)),
            (date(2026, 7, 14), "nominal"),
        )
        with self.assertRaisesRegex(prism_ingest.IngestError, "bad_market"):
            prism_ingest.resolve_session_date(payload, "jp", date(2026, 7, 15))

    def test_session_date_rejects_present_unparseable_date(self) -> None:
        payload = self.kr_payload()
        payload["market_condition"] = [{}, {"date": "bad"}, {"date": "2026-07-14"}]
        with self.assertRaisesRegex(prism_ingest.IngestError, "bad_market_condition_date"):
            prism_ingest.resolve_session_date(payload, "kr", date(2026, 7, 15))

    def test_session_date_rejects_future_and_more_than_7_day_delay(self) -> None:
        for market_date, expected in (("2026-07-16", "session_date_after_snapshot"), ("2026-07-07", "session_date_too_old")):
            with self.subTest(market_date=market_date):
                payload = self.kr_payload()
                payload["market_condition"] = [{"date": market_date}]
                with self.assertRaisesRegex(prism_ingest.IngestError, expected):
                    prism_ingest.resolve_session_date(payload, "kr", date(2026, 7, 15))

    def test_http_error_includes_body_excerpt(self) -> None:
        error = HTTPError("https://example.test", 500, "boom", Message(), io.BytesIO(b"failure"))
        with mock.patch("urllib.request.urlopen", side_effect=error):
            with self.assertRaisesRegex(prism_ingest.IngestError, "http_error:500:failure"):
                prism_ingest.call_rpc("https://example.test", "secret", {"p_market": "kr"})

    def test_http_read_errors_are_typed(self) -> None:
        for error in (TimeoutError(), ConnectionResetError(), http.client.IncompleteRead(b"x", 2)):
            with self.subTest(error=error.__class__.__name__):
                response = mock.MagicMock()
                response.__enter__.return_value.read.side_effect = error
                with mock.patch("urllib.request.urlopen", return_value=response):
                    with self.assertRaisesRegex(prism_ingest.IngestError, f"network_read_error:{error.__class__.__name__}"):
                        prism_ingest.call_rpc("https://example.test", "secret", {"p_market": "kr"})

    def test_decode_payload_rejects_overflowing_float(self) -> None:
        with self.assertRaisesRegex(prism_ingest.IngestError, "invalid_json_number"):
            prism_ingest.decode_payload(b'{"value":1e999}')

    def test_confirm_gate_is_exact(self) -> None:
        for value in (None, "", "true", "0"):
            with self.subTest(value=value):
                env = {} if value is None else {"PRISM_INGEST_CONFIRM": value}
                with self.assertRaisesRegex(prism_ingest.IngestError, "confirm_required"):
                    prism_ingest.require_boot_environment(env)

    def test_sha256_hashes_exact_file_bytes(self) -> None:
        raw = b'{\n  "z": 1, "a" : [3, 2]\n}\n'
        self.path.write_bytes(raw)
        mtime = self.now.timestamp() - 60
        os.utime(self.path, (mtime, mtime))
        stable = prism_ingest.read_stable_file(self.path, self.now, lambda _: None)
        self.assertEqual(prism_ingest.payload_sha256(stable), hashlib.sha256(raw).hexdigest())

    def test_main_rpc_body_keys_match_sql_signature(self) -> None:
        raw = self.write_main_payload()
        with mock.patch.dict(os.environ, self.boot_env(), clear=True), \
             mock.patch.object(prism_ingest, "read_stable_file", return_value=raw), \
             mock.patch.object(prism_ingest, "call_rpc", return_value={"status": "inserted", "id": "snapshot"}) as call_rpc, \
             redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            self.assertEqual(prism_ingest.main(["--market", "kr", "--file", str(self.path), "--slot", "am"]), 0)
        self.assertEqual(set(call_rpc.call_args.args[2]), {
            "p_market", "p_snapshot_date", "p_snapshot_slot", "p_market_session_date",
            "p_session_date_source", "p_generated_at", "p_payload", "p_payload_sha256",
            "p_source_commit", "p_contract_version", "p_terminal_performance",
        })

    def test_main_rejects_market_slot_mutex_pairs(self) -> None:
        for market, slot in (("kr", "daily"), ("us", "am")):
            with self.subTest(market=market, slot=slot), \
                 mock.patch.dict(os.environ, self.boot_env(), clear=True), \
                 mock.patch.object(prism_ingest, "read_stable_file") as read_file, \
                 mock.patch.object(prism_ingest, "call_rpc") as call_rpc:
                stderr = io.StringIO()
                with redirect_stderr(stderr):
                    code = prism_ingest.main(["--market", market, "--file", str(self.path), "--slot", slot])
                self.assertEqual(code, 1)
                self.assertEqual(json.loads(stderr.getvalue())["error"], "market_slot_mismatch")
                read_file.assert_not_called()
                call_rpc.assert_not_called()

    def test_main_stale_rejected_returns_structured_error(self) -> None:
        raw = self.write_main_payload()
        stderr = io.StringIO()
        with mock.patch.dict(os.environ, self.boot_env(), clear=True), \
             mock.patch.object(prism_ingest, "read_stable_file", return_value=raw), \
             mock.patch.object(prism_ingest, "call_rpc", return_value={"status": "stale_rejected"}), \
             redirect_stderr(stderr):
            code = prism_ingest.main(["--market", "kr", "--file", str(self.path), "--slot", "am"])
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(stderr.getvalue()), {
            "level": "error", "event": "prism_ingest_failed", "error": "stale_rejected",
        })

    def test_main_emits_payload_over_4mb_warning(self) -> None:
        payload = self.kr_payload()
        payload["padding"] = "x" * (prism_ingest.WARN_PAYLOAD_BYTES + 1)
        raw = self.write_main_payload(payload)
        stderr = io.StringIO()
        with mock.patch.dict(os.environ, self.boot_env(), clear=True), \
             mock.patch.object(prism_ingest, "read_stable_file", return_value=raw), \
             mock.patch.object(prism_ingest, "call_rpc", return_value={"status": "inserted"}), \
             redirect_stdout(io.StringIO()), redirect_stderr(stderr):
            code = prism_ingest.main(["--market", "kr", "--file", str(self.path), "--slot", "am"])
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(stderr.getvalue())["event"], "payload_over_4mb")

    def test_main_unexpected_error_is_structured(self) -> None:
        raw = self.write_main_payload()
        stderr = io.StringIO()
        with mock.patch.dict(os.environ, self.boot_env(), clear=True), \
             mock.patch.object(prism_ingest, "read_stable_file", return_value=raw), \
             mock.patch.object(prism_ingest, "call_rpc", side_effect=ValueError()), \
             redirect_stderr(stderr):
            code = prism_ingest.main(["--market", "kr", "--file", str(self.path), "--slot", "am"])
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(stderr.getvalue())["error"], "unexpected_error:ValueError")

    def test_telegram_failure_does_not_mask_ingest_error(self) -> None:
        env = {**self.boot_env(), "PRISM_ALERT_TELEGRAM_BOT_TOKEN": "token", "PRISM_ALERT_TELEGRAM_CHAT_ID": "chat"}
        stderr = io.StringIO()
        with mock.patch.dict(os.environ, env, clear=True), \
             mock.patch("urllib.request.urlopen", side_effect=TimeoutError()) as send_alert, \
             redirect_stderr(stderr):
            code = prism_ingest.main(["--market", "kr", "--file", str(self.path), "--slot", "daily"])
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(stderr.getvalue())["error"], "market_slot_mismatch")
        send_alert.assert_called_once()

    def test_python_version_guard_is_structured(self) -> None:
        stderr = io.StringIO()
        with mock.patch.object(sys, "version_info", (3, 9, 0)), redirect_stderr(stderr):
            with self.assertRaisesRegex(SystemExit, "1"):
                runpy.run_path(str(prism_ingest.__file__), run_name="prism_version_guard_test")
        self.assertEqual(json.loads(stderr.getvalue())["error"], "python_3_10_required")

    def test_source_commit_must_match_full_pin(self) -> None:
        base = {
            "PRISM_INGEST_CONFIRM": "1",
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "secret",
        }
        for commit in ("b8171a4", "0" * 40, "g" * 40):
            with self.subTest(commit=commit):
                with self.assertRaisesRegex(prism_ingest.IngestError, "source_commit"):
                    prism_ingest.require_boot_environment({**base, "PRISM_SOURCE_COMMIT": commit})


if __name__ == "__main__":
    unittest.main()
