#!/usr/bin/env python3
# Runtime floor: Python 3.10+.
# Test floor: Python 3.12+ (typing.override).

import sys

if sys.version_info < (3, 10):
    print('{"level":"error","event":"prism_ingest_failed","error":"python_3_10_required"}', file=sys.stderr)
    raise SystemExit(1)

import argparse
import hashlib
import http.client
import json
import math
import os
import re
import time
from urllib import error as url_error, request as url_request
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import NoReturn, cast

SOURCE_COMMIT = "b8171a4e95314b2fc29b81af0ee74d47e8a705e9"
CONTRACT_VERSION = 1
KST = timezone(timedelta(hours=9))
MAX_PAYLOAD_BYTES, WARN_PAYLOAD_BYTES = 8 * 1024 * 1024, 4 * 1024 * 1024


class IngestError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class BootEnvironment:
    supabase_url: str
    service_role_key: str
    source_commit: str


def _fail(message: str) -> NoReturn:
    raise IngestError(message)


def _require_object(value: object, label: str) -> dict[str, object]:
    if not isinstance(value, dict):
        _fail(f"{label}_must_be_object")
    return cast(dict[str, object], value)


def _require_array(value: object, label: str) -> list[object]:
    if not isinstance(value, list):
        _fail(f"{label}_must_be_array")
    return cast(list[object], value)


def _parse_iso_date(value: str, label: str) -> date:
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        _fail(f"bad_{label}")
    if parsed.isoformat() != value:
        _fail(f"bad_{label}")
    return parsed


def require_boot_environment(environ: Mapping[str, str]) -> BootEnvironment:
    if environ.get("PRISM_INGEST_CONFIRM") != "1":
        _fail("confirm_required")
    supabase_url = environ.get("SUPABASE_URL")
    if not isinstance(supabase_url, str) or supabase_url == "":
        _fail("supabase_url_required")
    service_role_key = environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not isinstance(service_role_key, str) or service_role_key == "":
        _fail("service_role_key_required")
    source_commit = environ.get("PRISM_SOURCE_COMMIT")
    if not isinstance(source_commit, str) or len(source_commit) != 40:
        _fail("source_commit_invalid")
    if any(character not in "0123456789abcdef" for character in source_commit):
        _fail("source_commit_invalid")
    if source_commit != SOURCE_COMMIT:
        _fail("source_commit_pin_mismatch")
    return BootEnvironment(supabase_url.rstrip("/"), service_role_key, source_commit)


def read_stable_file(path: Path, now: datetime, sleep: Callable[[float], None]) -> bytes:
    try:
        first = path.stat()
    except OSError as error:
        raise IngestError(f"file_stat_error:{error.__class__.__name__}") from None
    age_seconds = now.timestamp() - first.st_mtime
    if age_seconds < 30:
        _fail("file_too_young")
    if age_seconds > 6 * 60 * 60:
        _fail("file_too_old")
    sleep(2)
    try:
        second = path.stat()
    except OSError as error:
        raise IngestError(f"file_stat_error:{error.__class__.__name__}") from None
    if second.st_mtime != first.st_mtime:
        _fail("file_too_young")
    if first.st_size != second.st_size:
        _fail("file_size_unstable")
    if second.st_size > MAX_PAYLOAD_BYTES:
        _fail("payload_too_large")
    try:
        raw = path.read_bytes()
    except OSError as error:
        raise IngestError(f"file_read_error:{error.__class__.__name__}") from None
    if len(raw) != second.st_size:
        _fail("file_size_unstable")
    return raw


def _parse_json_float(value: str) -> float:
    parsed = float(value)
    if not math.isfinite(parsed):
        _fail("invalid_json_number")
    return parsed


def decode_payload(raw: bytes) -> dict[str, object]:
    try:
        decoded = raw.decode("utf-8")
        value: object = json.loads(
            decoded,
            parse_constant=lambda value: _fail(f"invalid_json_constant:{value}"),
            parse_float=_parse_json_float,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise IngestError(f"invalid_json:{error.__class__.__name__}") from None
    return _require_object(value, "payload")


def validate_envelope(payload: dict[str, object], market: str) -> None:
    required_types: dict[str, type[object]] = {"generated_at": str, "trading_mode": str, "summary": dict, "holdings": list, "real_portfolio": list, "account_summary": dict, "trading_history": list, "watchlist": list}
    for key, expected_type in required_types.items():
        if not isinstance(payload.get(key), expected_type):
            _fail(f"bad_{key}_type")
    market_value = payload.get("market")
    if market_value is not None and not isinstance(market_value, str):
        _fail("bad_market_type")
    currency_value = payload.get("currency")
    if currency_value is not None and not isinstance(currency_value, str):
        _fail("bad_currency_type")
    if market not in ("kr", "us"):
        _fail("bad_market")
    if market == "us" and (market_value != "US" or currency_value != "USD"):
        _fail("market_payload_mismatch")
    if market == "kr" and (market_value not in (None, "KR") or currency_value not in (None, "KRW")):
        _fail("market_payload_mismatch")


def parse_generated_at(payload: dict[str, object]) -> datetime:
    value = payload.get("generated_at")
    if not isinstance(value, str):
        _fail("bad_generated_at_type")
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?", value) is None:
        _fail("bad_generated_at")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        _fail("bad_generated_at")
    return parsed.replace(tzinfo=KST)


def validate_generated_at_mtime(generated_at: datetime, file_mtime: float) -> None:
    if abs(generated_at.timestamp() - file_mtime) > 45 * 60:
        _fail("generated_at_mtime_mismatch")


def resolve_session_date(
    payload: dict[str, object], market: str, snapshot_date: date
) -> tuple[date, str]:
    if market not in ("kr", "us"):
        _fail("bad_market")
    nominal = snapshot_date if market == "kr" else snapshot_date - timedelta(days=1)
    market_condition = payload.get("market_condition")
    parsed_dates: list[date] = []
    if market_condition is not None:
        for value in _require_array(market_condition, "market_condition"):
            row = _require_object(value, "market_condition_row")
            date_value = row.get("date")
            if date_value is None:
                continue
            if not isinstance(date_value, str):
                _fail("bad_market_condition_date_type")
            parsed_dates.append(_parse_iso_date(date_value, "market_condition_date"))
    if len(parsed_dates) == 0:
        session_date, source = nominal, "nominal"
    else:
        session_date, source = max(parsed_dates), "payload"
    if session_date > snapshot_date:
        _fail("session_date_after_snapshot")
    if (nominal - session_date).days > 7:
        _fail("session_date_too_old")
    return session_date, source


def _require_finite_number(value: object) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        _fail("bad_terminal_number")
    if isinstance(value, float) and not math.isfinite(value):
        _fail("bad_terminal_number")


def extract_terminal_performance(
    payload: dict[str, object], session_date: date
) -> dict[str, object] | None:
    performance = payload.get("prism_performance")
    if performance is None:
        return None
    candidates: list[tuple[date, dict[str, object]]] = []
    for value in _require_array(performance, "prism_performance"):
        point = _require_object(value, "prism_performance_point")
        point_date_value = point.get("date")
        if not isinstance(point_date_value, str):
            _fail("bad_terminal_date_type")
        point_date = _parse_iso_date(point_date_value, "terminal_date")
        if point_date <= session_date:
            _require_finite_number(point.get("cumulative_realized_profit"))
            _require_finite_number(point.get("prism_simulator_return"))
            candidates.append((point_date, point))
    if len(candidates) == 0:
        return None
    return max(candidates, key=lambda item: item[0])[1]


def payload_sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def call_rpc(url: str, service_role_key: str, body: dict[str, object]) -> dict[str, object]:
    request = url_request.Request(
        f"{url}/rest/v1/rpc/upsert_prism_snapshot",
        data=json.dumps(body, allow_nan=False, separators=(",", ":")).encode(),
        headers={
            "apikey": service_role_key,
            "authorization": f"Bearer {service_role_key}",
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with url_request.urlopen(request, timeout=30) as response:
            raw_response = response.read()
    except url_error.HTTPError as error:
        if error.fp is None:
            excerpt = ""
        else:
            try:
                excerpt = error.read(200).decode("utf-8", errors="replace")
            except (TimeoutError, OSError, http.client.HTTPException) as read_error:
                excerpt = f"body_read_error:{read_error.__class__.__name__}"
        raise IngestError(f"http_error:{error.code}:{excerpt}") from None
    except url_error.URLError as error:
        raise IngestError(f"network_error:{error.reason.__class__.__name__}") from None
    except (TimeoutError, OSError, http.client.HTTPException) as error:
        raise IngestError(f"network_read_error:{error.__class__.__name__}") from None
    result = decode_payload(raw_response)
    status = result.get("status")
    if status not in ("inserted", "updated", "stale_rejected", "unchanged_noop"):
        _fail("bad_rpc_status")
    return result


def _send_telegram_alert(environ: Mapping[str, str], error_message: str) -> None:
    token = environ.get("PRISM_ALERT_TELEGRAM_BOT_TOKEN")
    chat_id = environ.get("PRISM_ALERT_TELEGRAM_CHAT_ID")
    if not isinstance(token, str) or token == "" or not isinstance(chat_id, str) or chat_id == "":
        return
    request = url_request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=json.dumps({"chat_id": chat_id, "text": f"PRISM ingest failed: {error_message}"}).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with url_request.urlopen(request, timeout=10) as response:
            response.read()
    except Exception:
        return


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ingest one PRISM sidecar dashboard snapshot")
    parser.add_argument("--market", required=True, choices=("kr", "us"))
    parser.add_argument("--file", required=True, type=Path)
    parser.add_argument("--slot", required=True, choices=("am", "pm", "daily"))
    args = parser.parse_args(argv)
    try:
        boot = require_boot_environment(os.environ)
        if (args.market == "kr" and args.slot == "daily") or (
            args.market == "us" and args.slot != "daily"
        ):
            _fail("market_slot_mismatch")
        raw = read_stable_file(args.file, datetime.now(KST), time.sleep)
        if len(raw) > WARN_PAYLOAD_BYTES:
            print(json.dumps({"level": "warning", "event": "payload_over_4mb", "bytes": len(raw)}), file=sys.stderr)
        payload = decode_payload(raw)
        validate_envelope(payload, args.market)
        generated_at = parse_generated_at(payload)
        try:
            file_mtime = args.file.stat().st_mtime
        except OSError as error:
            raise IngestError(f"file_stat_error:{error.__class__.__name__}") from None
        validate_generated_at_mtime(generated_at, file_mtime)
        snapshot_date = generated_at.date()
        session_date, session_source = resolve_session_date(payload, args.market, snapshot_date)
        terminal = extract_terminal_performance(payload, session_date)
        result = call_rpc(
            boot.supabase_url,
            boot.service_role_key,
            {
                "p_market": args.market,
                "p_snapshot_date": snapshot_date.isoformat(),
                "p_snapshot_slot": args.slot,
                "p_market_session_date": session_date.isoformat(),
                "p_session_date_source": session_source,
                "p_generated_at": generated_at.isoformat(),
                "p_payload": payload,
                "p_payload_sha256": payload_sha256(raw),
                "p_source_commit": boot.source_commit,
                "p_contract_version": str(CONTRACT_VERSION),
                "p_terminal_performance": terminal,
            },
        )
        if result["status"] == "stale_rejected":
            _fail("stale_rejected")
        print(json.dumps({"level": "info", "event": "prism_ingest", **result}, separators=(",", ":")))
        return 0
    except IngestError as error:
        error_message = str(error)
        print(
            json.dumps({"level": "error", "event": "prism_ingest_failed", "error": error_message}, separators=(",", ":")),
            file=sys.stderr,
        )
        _send_telegram_alert(os.environ, error_message)
        return 1
    except Exception as error:
        print(
            json.dumps({"level": "error", "event": "prism_ingest_failed", "error": f"unexpected_error:{error.__class__.__name__}"}, separators=(",", ":")),
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
