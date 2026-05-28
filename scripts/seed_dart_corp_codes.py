#!/usr/bin/env python3
"""One-time DART corp_code seed -> Supabase dart_corp_codes.

Run (default corp_code seed):
    cd /Users/yong/New_Project_KR_Stock
    set -a && eval "$(grep -E '^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|DART_API_KEY|KRX_ID|KRX_PW)=' tudal/.env.local)" && set +a
    SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" scripts/.venv/bin/python scripts/seed_dart_corp_codes.py [--dry-run]

Run (induty_code 백필 — B66 C 하이브리드, plan PR #55 `bbf102d`):
    SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" scripts/.venv/bin/python scripts/seed_dart_corp_codes.py --backfill-induty [--limit N] [--dry-run]

KRX_ID/KRX_PW는 pykrx의 KRX 영업일/티커 조회 인증에 필요하다 (default seed only — induty 백필은 불필요).
없으면 KRX 응답이 비어 ticker_market_map 생성이 실패한다.

Idempotent: ON CONFLICT (ticker) UPDATE.

spec: docs/superpowers/specs/2026-05-12-tier0-dart-signals-design.md (D1, D13).
plan (--backfill-induty): docs/superpowers/plans/2026-05-28-task5-b66-c-hybrid-sector-mapper.md §7.
"""
from __future__ import annotations

import argparse
import io
import os
import re
import sys
import time
import zipfile
from typing import Any, Optional
from xml.etree.ElementTree import fromstring


CORP_CLS_MAP = {"Y": "KOSPI", "K": "KOSDAQ", "N": "KONEX"}
DART_CORPCODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml"
DART_COMPANY_URL = "https://opendart.fss.or.kr/api/company.json"

# DART OpenAPI status matrix (plan §7.2)
# https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019002
DART_STATUS_SUCCESS = "000"
DART_STATUS_NO_DATA = "013"
DART_STATUS_RETRY_SET = frozenset({"020", "800", "900"})
DART_STATUS_FAIL_FAST_SET = frozenset({"010", "011", "012", "901"})

# induty_code format (plan §4.1 + 마이그 0026 CHECK constraint)
INDUTY_CODE_RE = re.compile(r"^[0-9]{3,5}$")

# rate limit baseline (plan §7.2)
INDUTY_FETCH_SLEEP_S = 0.2
INDUTY_FETCH_RETRY_BASE_S = 1.0
INDUTY_FETCH_MAX_RETRIES = 3


def parse_corp_code_xml(xml_text: str, ticker_market_map: dict[str, str] | None = None) -> list[dict]:
    """Parse DART corpCode.xml into rows for dart_corp_codes.

    Rules:
    - corp_cls Y/K/N -> KOSPI/KOSDAQ/KONEX when present
    - current DART corpCode.xml omits corp_cls, so ticker_market_map is the production path
    - empty stock_code -> excluded
    - listed tickers missing from ticker_market_map -> excluded
    """
    root = fromstring(xml_text)
    rows: list[dict] = []
    for item in root.findall("list"):
        corp_cls = (item.findtext("corp_cls") or "").strip()
        ticker = (item.findtext("stock_code") or "").strip()
        if not ticker:
            continue
        market = CORP_CLS_MAP.get(corp_cls) if corp_cls else None
        if market is None and ticker_market_map is not None:
            market = ticker_market_map.get(ticker)
        if market is None:
            continue
        rows.append({
            "ticker": ticker,
            "corp_code": (item.findtext("corp_code") or "").strip(),
            "corp_name": (item.findtext("corp_name") or "").strip(),
            "market": market,
        })
    return rows


def build_ticker_market_map() -> dict[str, str]:
    """Build ticker -> market mapping from KRX via pykrx.

    DART corpCode.xml currently provides stock_code but not corp_cls. Using KRX
    listed ticker sets keeps the Supabase table market column accurate.
    """
    from pykrx import stock

    mapping: dict[str, str] = {}
    for market in ("KOSPI", "KOSDAQ", "KONEX"):
        for ticker in stock.get_market_ticker_list(market=market):
            mapping[ticker] = market
    return mapping


def download_corp_code_zip(api_key: str) -> bytes:
    """Fetch corpCode.xml.zip from DART. Returns raw ZIP bytes."""
    import requests

    resp = requests.get(DART_CORPCODE_URL, params={"crtfc_key": api_key}, timeout=60)
    resp.raise_for_status()
    return resp.content


def extract_xml_from_zip(zip_bytes: bytes) -> str:
    """Extract CORPCODE.xml from ZIP. Returns decoded XML text."""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        with zf.open("CORPCODE.xml") as f:
            return f.read().decode("utf-8")


def upsert_corp_codes(client, rows: list[dict], batch_size: int = 500) -> int:
    """UPSERT into dart_corp_codes in batches. Returns total inserted/updated."""
    total = 0
    for i in range(0, len(rows), batch_size):
        chunk = rows[i:i + batch_size]
        client.table("dart_corp_codes").upsert(chunk, on_conflict="ticker").execute()
        total += len(chunk)
        print(f"  upserted batch {i // batch_size + 1} ({total}/{len(rows)})")
    return total


def make_supabase_client():
    """Build supabase-py client from env."""
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.")
    return create_client(url, key)


# ============================================================================
# --backfill-induty (B66 C 하이브리드, plan PR #55)
# ============================================================================

def _redact_key(url_or_msg: str, api_key: str) -> str:
    """crtfc_key 값을 로그에서 가린다 (security)."""
    if not api_key:
        return url_or_msg
    return url_or_msg.replace(api_key, "***REDACTED***")


def fetch_induty(corp_code: str, api_key: str, requests_module=None) -> dict[str, Optional[str]]:
    """DART company.json 단건 호출 + status matrix 해석.

    Returns:
      { "induty_code": str | None,           # ^[0-9]{3,5}$ 정합한 경우만 값. 그 외 None.
        "induty_last_status": str | None,    # DART status code. retry/timeout 끝까지 실패하면 None
                                              # 또는 마지막 status. 호출자가 운영 진단용으로 적재.
        "error_kind": str | None,            # 'fail_fast' (credential/IP) / 'retry_exhausted' /
                                              # 'no_data' / 'timeout' / None (성공).
      }

    Raises: never — caller-friendly dict 반환 only. fail-fast는 error_kind로 신호.
    """
    if requests_module is None:
        import requests
        requests_module = requests

    delay = INDUTY_FETCH_RETRY_BASE_S
    last_status: Optional[str] = None
    for attempt in range(INDUTY_FETCH_MAX_RETRIES + 1):
        try:
            resp = requests_module.get(
                DART_COMPANY_URL,
                params={"crtfc_key": api_key, "corp_code": corp_code},
                timeout=30,
            )
        except Exception as exc:  # noqa: BLE001 — network/timeout
            msg = _redact_key(str(exc), api_key)
            if attempt == INDUTY_FETCH_MAX_RETRIES:
                return {"induty_code": None, "induty_last_status": last_status, "error_kind": "timeout"}
            print(f"  [induty] corp_code={corp_code} attempt={attempt + 1} timeout/network ({msg[:80]}) → backoff {delay:.1f}s", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
            continue

        if resp.status_code != 200:
            if attempt == INDUTY_FETCH_MAX_RETRIES:
                return {"induty_code": None, "induty_last_status": last_status, "error_kind": "timeout"}
            print(f"  [induty] corp_code={corp_code} attempt={attempt + 1} HTTP {resp.status_code} → backoff {delay:.1f}s", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
            continue

        try:
            data = resp.json()
        except Exception:  # noqa: BLE001
            return {"induty_code": None, "induty_last_status": last_status, "error_kind": "timeout"}

        status = str(data.get("status", "")).strip()
        last_status = status

        if status == DART_STATUS_SUCCESS:
            raw = data.get("induty_code")
            if raw is None:
                # status 000인데 induty_code 필드가 없음 — 응답 형식 변경 또는 인증 미흡 corp.
                return {"induty_code": None, "induty_last_status": status, "error_kind": None}
            s = str(raw).strip()
            if INDUTY_CODE_RE.fullmatch(s):
                return {"induty_code": s, "induty_last_status": status, "error_kind": None}
            # 응답에 induty_code가 있으나 ^[0-9]{3,5}$ 정합 안 됨 — schema drift 알림.
            return {"induty_code": None, "induty_last_status": status, "error_kind": None}

        if status == DART_STATUS_NO_DATA:
            return {"induty_code": None, "induty_last_status": status, "error_kind": "no_data"}

        if status in DART_STATUS_FAIL_FAST_SET:
            return {"induty_code": None, "induty_last_status": status, "error_kind": "fail_fast"}

        if status in DART_STATUS_RETRY_SET:
            if attempt == INDUTY_FETCH_MAX_RETRIES:
                return {"induty_code": None, "induty_last_status": status, "error_kind": "retry_exhausted"}
            print(f"  [induty] corp_code={corp_code} attempt={attempt + 1} status={status} → backoff {delay:.1f}s", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
            continue

        # unknown status — retry 한 번만 + 그 후 retry_exhausted로 표시.
        if attempt == INDUTY_FETCH_MAX_RETRIES:
            return {"induty_code": None, "induty_last_status": status, "error_kind": "retry_exhausted"}
        print(f"  [induty] corp_code={corp_code} attempt={attempt + 1} status={status} (unknown) → backoff {delay:.1f}s", file=sys.stderr)
        time.sleep(delay)
        delay *= 2

    # loop exited without return — defensive
    return {"induty_code": None, "induty_last_status": last_status, "error_kind": "retry_exhausted"}


def backfill_induty(
    client: Any,
    api_key: str,
    *,
    dry_run: bool = False,
    limit: Optional[int] = None,
) -> dict[str, int]:
    """`dart_corp_codes` rows를 읽어 induty_code 없는 것만 DART company.json으로 백필.

    Args:
      client: supabase client (dry_run=True인 경우 안 쓰임)
      api_key: DART OpenAPI key (절대 로그에 노출 X)
      dry_run: True면 DB write 0 (조회만 + induty fetch만 측정용)
      limit: process할 최대 corp 수 (소량 smoke test용). None=전체.

    Returns:
      { "processed": N, "ok": N, "no_data": N, "retry_exhausted": N,
        "fail_fast": N, "timeout": N, "written": N }
    """
    from datetime import datetime, timezone

    # 1. fetch existing rows lacking induty_code (또는 강제 갱신은 별도 옵션 — 본 PR scope 외)
    # NOTE: supabase-py / PostgREST default LIMIT은 1000 — 2,766 corp_codes를 모두 읽으려면 명시 pagination 필요.
    # `.range(start, end)` 호출로 페이지 단위 fetch + 빈 페이지 도달 시 종료.
    rows: list[dict[str, Any]] = []
    page_size = 1000
    page_start = 0
    while True:
        page = (
            client.table("dart_corp_codes")
            .select("ticker, corp_code, corp_name, induty_code")
            .order("ticker")
            .range(page_start, page_start + page_size - 1)
            .execute()
        )
        page_rows = page.data or []
        if not page_rows:
            break
        rows.extend(page_rows)
        if len(page_rows) < page_size:
            break
        page_start += page_size
    rows_to_process = [r for r in rows if not r.get("induty_code")]
    if limit is not None and limit > 0:
        rows_to_process = rows_to_process[:limit]

    counts = {"processed": 0, "ok": 0, "no_data": 0, "retry_exhausted": 0, "fail_fast": 0, "timeout": 0, "written": 0}

    print(f"[induty] total rows {len(rows):,} · missing induty_code {len([r for r in rows if not r.get('induty_code')]):,} · process {len(rows_to_process):,}")

    for idx, row in enumerate(rows_to_process, start=1):
        corp_code = row["corp_code"]
        ticker = row["ticker"]
        result = fetch_induty(corp_code, api_key)
        counts["processed"] += 1
        kind = result["error_kind"]
        if kind == "fail_fast":
            # credential/IP 문제 — 더 진행하면 fail의 fail이라 즉시 중단.
            print(f"[induty] ABORT — fail_fast status={result['induty_last_status']} corp_code={corp_code} ticker={ticker} (DART credential/IP/account 문제)", file=sys.stderr)
            counts["fail_fast"] += 1
            break
        if result["induty_code"]:
            counts["ok"] += 1
        elif kind == "no_data":
            counts["no_data"] += 1
        elif kind == "retry_exhausted":
            counts["retry_exhausted"] += 1
        elif kind == "timeout":
            counts["timeout"] += 1

        # write (또는 dry-run 시 skip)
        if not dry_run:
            update_payload = {
                "induty_code": result["induty_code"],
                "induty_last_status": result["induty_last_status"],
                "induty_last_seen_at": datetime.now(timezone.utc).isoformat(),
            }
            client.table("dart_corp_codes").update(update_payload).eq("ticker", ticker).execute()
            counts["written"] += 1

        # rate limit + progress
        if idx % 50 == 0:
            print(f"  [induty] {idx}/{len(rows_to_process)} processed (ok={counts['ok']} no_data={counts['no_data']} retry_exhausted={counts['retry_exhausted']} timeout={counts['timeout']})")
        time.sleep(INDUTY_FETCH_SLEEP_S)

    return counts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed dart_corp_codes from DART corpCode.xml (+ optional --backfill-induty)")
    parser.add_argument("--dry-run", action="store_true", help="Fetch + parse only, no DB write")
    parser.add_argument(
        "--backfill-induty",
        action="store_true",
        help="(B66 C 하이브리드) DART company.json으로 induty_code 백필. default seed flow는 영향 0 — 이 flag 미사용 시 동작 변경 없음.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="(--backfill-induty 전용) 처리할 corp_code 최대 개수. smoke test/디버깅용.",
    )
    args = parser.parse_args(argv)

    api_key = os.environ.get("DART_API_KEY")
    if not api_key:
        sys.exit("DART_API_KEY 환경변수가 필요합니다.")

    # ----- B66 backfill mode (default seed와 완전 독립) -----
    if args.backfill_induty:
        print("[backfill-induty] DART company.json 단건 호출로 induty_code를 백필합니다.")
        print(f"[backfill-induty] rate-limit baseline {INDUTY_FETCH_SLEEP_S}s/req, retry up to {INDUTY_FETCH_MAX_RETRIES} with backoff.")
        if args.dry_run:
            print("[backfill-induty] --dry-run — Supabase write 생략 (induty 응답 통계만).")
        client = make_supabase_client()
        counts = backfill_induty(client, api_key, dry_run=args.dry_run, limit=args.limit)
        print(f"[backfill-induty] done: {counts}")
        if counts.get("fail_fast", 0) > 0:
            print(
                "[backfill-induty] abort: DART credential/IP/account fail-fast status detected. "
                "No further backfill attempted.",
                file=sys.stderr,
            )
            return 1
        return 0

    # ----- default corp_code seed (기존 동작 영향 0) -----
    if not os.environ.get("KRX_ID") or not os.environ.get("KRX_PW"):
        sys.exit("KRX_ID/KRX_PW 환경변수가 필요합니다 (pykrx 인증). tudal/.env.local에 박제됨.")

    print("[1/3] DART corpCode.xml.zip 다운로드 ...")
    zip_bytes = download_corp_code_zip(api_key)
    print(f"  {len(zip_bytes):,} bytes")

    print("[2/3] KRX ticker market map 생성 + XML 파싱/필터링 ...")
    ticker_market_map = build_ticker_market_map()
    print(f"  KRX listed tickers: {len(ticker_market_map):,}")
    xml_text = extract_xml_from_zip(zip_bytes)
    rows = parse_corp_code_xml(xml_text, ticker_market_map=ticker_market_map)
    print(f"  parsed rows: {len(rows):,}")
    by_market: dict[str, int] = {}
    for row in rows:
        by_market[row["market"]] = by_market.get(row["market"], 0) + 1
    for market, count in sorted(by_market.items()):
        print(f"  {market}: {count:,}")

    if args.dry_run:
        print("[3/3] --dry-run — Supabase write 생략")
        return 0

    print("[3/3] Supabase dart_corp_codes UPSERT ...")
    client = make_supabase_client()
    n = upsert_corp_codes(client, rows)
    print(f"  done: {n:,} rows upserted")
    return 0


if __name__ == "__main__":
    sys.exit(main())
