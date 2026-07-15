import hashlib
import io
import json
import os
import tempfile
import unittest
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

        def mutate(_: float) -> None:
            with self.path.open("ab") as target:
                target.write(b" ")

        with self.assertRaisesRegex(prism_ingest.IngestError, "file_size_unstable"):
            prism_ingest.read_stable_file(self.path, self.now, mutate)

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
        payload["market_condition"] = [{"date": "bad"}, {"date": "2026-07-14"}]
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

    def test_session_date_rejects_future_and_more_than_7_day_delay(self) -> None:
        for market_date, expected in (("2026-07-16", "session_date_after_snapshot"), ("2026-07-07", "session_date_too_old")):
            with self.subTest(market_date=market_date):
                payload = self.kr_payload()
                payload["market_condition"] = [{"date": market_date}]
                with self.assertRaisesRegex(prism_ingest.IngestError, expected):
                    prism_ingest.resolve_session_date(payload, "kr", date(2026, 7, 15))

    def test_http_error_is_typed_and_body_is_not_required(self) -> None:
        error = HTTPError("https://example.test", 500, "boom", Message(), io.BytesIO(b"failure"))
        with mock.patch("urllib.request.urlopen", side_effect=error):
            with self.assertRaisesRegex(prism_ingest.IngestError, "http_error:500"):
                prism_ingest.call_rpc("https://example.test", "secret", {"p_market": "kr"})

    def test_confirm_gate_is_exact(self) -> None:
        for value in (None, "", "true", "0"):
            with self.subTest(value=value):
                env = {} if value is None else {"PRISM_INGEST_CONFIRM": value}
                with self.assertRaisesRegex(prism_ingest.IngestError, "confirm_required"):
                    prism_ingest.require_boot_environment(env)

    def test_sha256_hashes_exact_file_bytes(self) -> None:
        raw = self.write_payload(self.kr_payload())
        stable = prism_ingest.read_stable_file(self.path, self.now, lambda _: None)
        self.assertEqual(prism_ingest.payload_sha256(stable), hashlib.sha256(raw).hexdigest())

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
