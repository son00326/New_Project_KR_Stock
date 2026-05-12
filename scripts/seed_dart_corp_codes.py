#!/usr/bin/env python3
"""One-time DART corp_code seed -> Supabase dart_corp_codes.

Run:
    cd /Users/yong/New_Project_KR_Stock
    set -a && eval "$(grep -E '^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|DART_API_KEY)=' tudal/.env.local)" && set +a
    SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" scripts/.venv/bin/python scripts/seed_dart_corp_codes.py [--dry-run]

Idempotent: ON CONFLICT (ticker) UPDATE.

spec: docs/superpowers/specs/2026-05-12-tier0-dart-signals-design.md (D1, D13).
"""
from __future__ import annotations

import argparse
import io
import os
import sys
import zipfile
from xml.etree.ElementTree import fromstring


CORP_CLS_MAP = {"Y": "KOSPI", "K": "KOSDAQ", "N": "KONEX"}
DART_CORPCODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml"


def parse_corp_code_xml(xml_text: str) -> list[dict]:
    """Parse DART corpCode.xml into rows for dart_corp_codes.

    Rules:
    - corp_cls Y/K/N -> KOSPI/KOSDAQ/KONEX
    - empty stock_code -> excluded
    - corp_cls E or unknown classes -> excluded
    """
    root = fromstring(xml_text)
    rows: list[dict] = []
    for item in root.findall("list"):
        corp_cls = (item.findtext("corp_cls") or "").strip()
        ticker = (item.findtext("stock_code") or "").strip()
        if not ticker:
            continue
        market = CORP_CLS_MAP.get(corp_cls)
        if market is None:
            continue
        rows.append({
            "ticker": ticker,
            "corp_code": (item.findtext("corp_code") or "").strip(),
            "corp_name": (item.findtext("corp_name") or "").strip(),
            "market": market,
        })
    return rows


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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed dart_corp_codes from DART corpCode.xml")
    parser.add_argument("--dry-run", action="store_true", help="Fetch + parse only, no DB write")
    args = parser.parse_args(argv)

    api_key = os.environ.get("DART_API_KEY")
    if not api_key:
        sys.exit("DART_API_KEY 환경변수가 필요합니다.")

    print("[1/3] DART corpCode.xml.zip 다운로드 ...")
    zip_bytes = download_corp_code_zip(api_key)
    print(f"  {len(zip_bytes):,} bytes")

    print("[2/3] XML 파싱 + 필터링 ...")
    xml_text = extract_xml_from_zip(zip_bytes)
    rows = parse_corp_code_xml(xml_text)
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
