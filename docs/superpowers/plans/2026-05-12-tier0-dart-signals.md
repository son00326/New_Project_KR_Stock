# Tier 0 DART Signal 4·5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tier 0 인디케이터 스크리닝의 Signal 4 (실적 모멘텀 YoY) + Signal 5 (재무 퀄리티)를 DART OpenAPI로 실 구현하고, production `short_list_30`의 2026-05-01 시드를 의미 있는 long bucket(spread > 0.5)로 재시드한다.

**Architecture:** 2개 신규 Supabase 테이블 (`dart_corp_codes`, `dart_financial_cache`) + 신규 모듈 `scripts/dart_signals.py` (DART fetch / 재무 캐시 / 퀄리티·실적 모멘텀 계산) + 1회 seed 스크립트 `scripts/seed_dart_corp_codes.py`. 기존 `scripts/screen_shortlist_tier0.py`는 `fetch_dart_signals()` hook을 새 모듈로 위임만 한다.

**Tech Stack:** Python 3.14 (`scripts/.venv`) · `supabase-py` 2.30 · `requests` 2.34 · `pykrx` 1.2.8 · Python `unittest` (Vitest는 본 plan에서 신규 0). Supabase remote (`rbrpcynhphrpljbjirfo`) · DART OpenAPI v1 · 마이그 0013·0014.

**Spec source of truth:** `docs/superpowers/specs/2026-05-12-tier0-dart-signals-design.md` (commit `76789dc`). 13개 결정 D1~D13 박제. 충돌 시 spec 우선.

**전제 조건 (이미 갖춰진 것)**:
- `tudal/.env.local`에 `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `KRX_ID` / `KRX_PW` / `DART_API_KEY` 5개 모두 박제됨 (43차).
- `scripts/.venv` Python 3.14 venv + `pykrx supabase requests` 설치 완료.
- 마이그 0012까지 production 적용 완료. `short_list_30`에 2026-05-01 시드 30 row 박제 (Signal 4·5 = 0 평탄화 상태).

**검증 게이트** (각 phase 종료 시):
- Python 측: `scripts/.venv/bin/python -m unittest scripts.test_seed_dart_corp_codes scripts.test_dart_signals scripts.test_screen_shortlist_tier0`
- 마이그 적용 검증: `mcp__supabase__execute_sql`로 schema introspection
- 시드 검증: production DB SQL count

---

## File Structure

**Create:**
- `tudal/supabase/migrations/0013_dart_corp_codes.sql` — corp_code 마스터 테이블 + RLS
- `tudal/supabase/migrations/0013_dart_corp_codes.rollback.sql` — `DROP TABLE`
- `tudal/supabase/migrations/0014_dart_financial_cache.sql` — 재무 캐시 + RLS
- `tudal/supabase/migrations/0014_dart_financial_cache.rollback.sql` — `DROP TABLE`
- `scripts/seed_dart_corp_codes.py` — DART corp_code.zip 다운로드·파싱·UPSERT (1회 실행)
- `scripts/test_seed_dart_corp_codes.py` — Python unittest (corp_cls 매핑 + 파싱)
- `scripts/dart_signals.py` — DART Signal 4·5 모듈 (fetch + cache + 계산)
- `scripts/test_dart_signals.py` — Python unittest ~15 케이스

**Modify:**
- `scripts/screen_shortlist_tier0.py` — `fetch_dart_signals()` hook을 `dart_signals` 모듈로 위임 + CSV summary에 `quality_insufficient_fields` 추가
- `scripts/test_screen_shortlist_tier0.py` — 기존 테스트 회귀 확인 (변경 없거나 minor wire 테스트만)
- `Document/Process/HANDOFF.md` — §1 상태 표 + §2.A 완료 박제 + §6 완료 요약
- `Document/Build/Slices/S7-RealData.md` — T7e.8 follow-up 완료 row + 의사결정 박제

---

## Phase A: Supabase 마이그레이션 (foundation)

### Task A1: 마이그 0013 — `dart_corp_codes`

**Files:**
- Create: `tudal/supabase/migrations/0013_dart_corp_codes.sql`
- Create: `tudal/supabase/migrations/0013_dart_corp_codes.rollback.sql`

- [ ] **Step 1: Write migration SQL**

Create `tudal/supabase/migrations/0013_dart_corp_codes.sql`:

```sql
-- ============================================================================
-- 0013 — dart_corp_codes
-- ============================================================================
-- Purpose: DART OpenAPI corp_code(회사고유번호) ↔ KRX ticker 매핑 마스터.
-- Driver:  spec 2026-05-12-tier0-dart-signals-design.md (D1, D5, D13).
-- 선행:    0002 (is_admin), 0012 (short_list_30 name/sector).
-- ============================================================================

create table if not exists public.dart_corp_codes (
  ticker          text primary key,                       -- KRX 종목코드 (예: '005930')
  corp_code       text not null unique,                   -- DART 회사고유번호 (예: '00126380')
  corp_name       text not null,
  market          text not null check (market in ('KOSPI', 'KOSDAQ', 'KONEX')),
    -- D13: DART corp_cls (Y/K/N) → KOSPI/KOSDAQ/KONEX. corp_cls='E' + stock_code 부재는 seed에서 제외.
  last_synced_at  timestamptz not null default now()
);

create index if not exists idx_dart_corp_codes_corp_code
  on public.dart_corp_codes(corp_code);

-- D5: RLS — service_role write + authenticated admin read
alter table public.dart_corp_codes enable row level security;

drop policy if exists "dart_corp_codes_service_write" on public.dart_corp_codes;
create policy "dart_corp_codes_service_write"
  on public.dart_corp_codes
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "dart_corp_codes_admin_read" on public.dart_corp_codes;
create policy "dart_corp_codes_admin_read"
  on public.dart_corp_codes
  for select
  to authenticated
  using (public.is_admin());
```

- [ ] **Step 2: Write rollback SQL**

Create `tudal/supabase/migrations/0013_dart_corp_codes.rollback.sql`:

```sql
-- Rollback for 0013_dart_corp_codes.sql
drop policy if exists "dart_corp_codes_admin_read"   on public.dart_corp_codes;
drop policy if exists "dart_corp_codes_service_write" on public.dart_corp_codes;
drop index  if exists public.idx_dart_corp_codes_corp_code;
drop table  if exists public.dart_corp_codes;
```

- [ ] **Step 3: Apply migration via MCP**

Run via `mcp__supabase__apply_migration` with name `0013_dart_corp_codes` and the body of step 1 SQL.

Expected: `Migration applied successfully`.

- [ ] **Step 4: Verify schema**

Run via `mcp__supabase__execute_sql`:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'dart_corp_codes'
order by ordinal_position;
```

Expected rows: `ticker text NO`, `corp_code text NO`, `corp_name text NO`, `market text NO`, `last_synced_at timestamptz NO`.

Then verify RLS:

```sql
select policyname, cmd, roles::text from pg_policies
where schemaname = 'public' and tablename = 'dart_corp_codes';
```

Expected: 2 policies — `dart_corp_codes_service_write` (`ALL` for `service_role`) + `dart_corp_codes_admin_read` (`SELECT` for `authenticated`).

- [ ] **Step 5: Commit**

```bash
git add tudal/supabase/migrations/0013_dart_corp_codes.sql tudal/supabase/migrations/0013_dart_corp_codes.rollback.sql
git commit -m "feat(T7e.8 follow-up): migration 0013 dart_corp_codes

DART 회사고유번호 ↔ KRX ticker 마스터. corp_cls Y/K/N → KOSPI/KOSDAQ/KONEX.
service_role write + authenticated admin read RLS. spec D1·D5·D13 박제.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A2: 마이그 0014 — `dart_financial_cache`

**Files:**
- Create: `tudal/supabase/migrations/0014_dart_financial_cache.sql`
- Create: `tudal/supabase/migrations/0014_dart_financial_cache.rollback.sql`

- [ ] **Step 1: Write migration SQL**

Create `tudal/supabase/migrations/0014_dart_financial_cache.sql`:

```sql
-- ============================================================================
-- 0014 — dart_financial_cache
-- ============================================================================
-- Purpose: DART OpenAPI 재무제표 캐시 + Signal 4·5 산출 메타.
-- Driver:  spec 2026-05-12-tier0-dart-signals-design.md (D4, D5, D6, D8, D12).
-- 선행:    0013 (dart_corp_codes), 0002 (is_admin).
-- ============================================================================

create table if not exists public.dart_financial_cache (
  id                  bigserial primary key,
  corp_code           text not null,
  period_type         text not null check (period_type in ('annual', 'quarterly')),
  period_key          text not null,
    -- 'YYYY' (annual, 11011) / 'YYYY-Q1' (11013) / 'YYYY-H1' (11012) / 'YYYY-9M' (11014)
    -- 'YYYY-QN' = standalone derived row (calculation_basis='standalone')

  -- 재무 7필드 (단위: 원, NULL 허용 — DART 미제공 또는 standalone 차분 결과)
  revenue             numeric,                  -- 매출액
  op_income           numeric,                  -- 영업이익
  net_income          numeric,                  -- 당기순이익
  total_assets        numeric,                  -- 자산총계
  total_equity        numeric,                  -- 자본총계
  total_debt          numeric,                  -- 부채총계
  interest_expense    numeric,                  -- 이자비용

  -- D6, D8, D15: DART fetch/parse 상태
  statement_scope     text not null check (statement_scope in ('CFS', 'OFS', 'NONE')),
    -- CFS=연결재무제표 우선, 없으면 OFS=별도 fallback, NONE=조회 불가
  status              text not null default 'ok' check (status in ('ok', 'no_data', 'not_yet_disclosed', 'parse_error', 'rate_limited')),
    -- 주의: DART fetch/parse 자체 상태만 표현. Signal 5 지표 누락 등 계산 실패는 'ok' 유지 (D8 Fix 1).
    -- not_yet_disclosed = (D15) quarterly + disclosure deadline 이내 미공시. 7일 TTL refresh 허용.
  error_code          text,                     -- DART status code (예: '013', '020')
  source_report_code  text,                     -- '11011'/'11012'/'11013'/'11014'/'derived'

  -- D12: Signal 4 계산 기반 추적 (follow-up 미루지 않음)
  calculation_basis   text not null default 'not_applicable' check (
    calculation_basis in ('standalone', 'cumulative_fallback', 'annual', 'not_applicable')
  ),
    -- annual              = 사업보고서 (11011), Signal 5 quality 소스
    -- standalone          = 분기 단독값 (raw 11013 또는 누적 차분 결과). Signal 4 정상 경로.
    -- cumulative_fallback = 단독 환산 불가, 누적 YoY로 fallback. 신뢰도 ↓ 추적용.
    -- not_applicable      = raw 누적 보고서 row (11012/11014). Signal 4 계산 전 상태.

  fetched_at          timestamptz not null default now(),

  unique (corp_code, period_type, period_key)
);

create index if not exists idx_dart_fc_lookup
  on public.dart_financial_cache(corp_code, period_type, period_key);

-- D5: RLS — service_role write + authenticated admin read
alter table public.dart_financial_cache enable row level security;

drop policy if exists "dart_financial_cache_service_write" on public.dart_financial_cache;
create policy "dart_financial_cache_service_write"
  on public.dart_financial_cache
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "dart_financial_cache_admin_read" on public.dart_financial_cache;
create policy "dart_financial_cache_admin_read"
  on public.dart_financial_cache
  for select
  to authenticated
  using (public.is_admin());
```

- [ ] **Step 2: Write rollback SQL**

Create `tudal/supabase/migrations/0014_dart_financial_cache.rollback.sql`:

```sql
-- Rollback for 0014_dart_financial_cache.sql
drop policy if exists "dart_financial_cache_admin_read"   on public.dart_financial_cache;
drop policy if exists "dart_financial_cache_service_write" on public.dart_financial_cache;
drop index  if exists public.idx_dart_fc_lookup;
drop table  if exists public.dart_financial_cache;
```

- [ ] **Step 3: Apply migration via MCP**

Run via `mcp__supabase__apply_migration` with name `0014_dart_financial_cache` and the body of step 1 SQL.

Expected: `Migration applied successfully`.

- [ ] **Step 4: Verify schema**

```sql
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'dart_financial_cache'
order by ordinal_position;
```

Expected: **17 columns** in order — `id, corp_code, period_type, period_key, revenue, op_income, net_income, total_assets, total_equity, total_debt, interest_expense, statement_scope, status, error_code, source_report_code, calculation_basis, fetched_at`.

```sql
select pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.dart_financial_cache'::regclass and contype = 'c';
```

Expected: 4 CHECK 제약 (period_type, statement_scope, status, calculation_basis).

- [ ] **Step 5: Commit**

```bash
git add tudal/supabase/migrations/0014_dart_financial_cache.sql tudal/supabase/migrations/0014_dart_financial_cache.rollback.sql
git commit -m "feat(T7e.8 follow-up): migration 0014 dart_financial_cache

재무 7필드 + statement_scope (CFS/OFS) + status (DART fetch 상태 + not_yet_disclosed D15) + calculation_basis
(standalone/cumulative_fallback/annual/not_applicable, D12). UNIQUE (corp_code, period_type, period_key).
service_role write + admin read RLS. spec D4·D5·D6·D8·D12·D15 박제.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase B: `seed_dart_corp_codes.py` — corp_code 1회 시드

### Task B1: `parse_corp_code_xml()` pure function + test

**Files:**
- Create: `scripts/seed_dart_corp_codes.py`
- Create: `scripts/test_seed_dart_corp_codes.py`

- [ ] **Step 1: Write the failing test**

Create `scripts/test_seed_dart_corp_codes.py`:

```python
"""Unittest for scripts/seed_dart_corp_codes.py — corp_cls 매핑 + 필터링."""
from __future__ import annotations

import unittest
from xml.etree.ElementTree import fromstring


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
        """corp_cls='E' (비상장 기타) + stock_code 부재는 제외."""
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
        """Y/K/N 외 다른 값은 제외 (방어적 처리)."""
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


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `scripts/.venv/bin/python -m unittest scripts.test_seed_dart_corp_codes -v`
Expected: `ModuleNotFoundError: No module named 'scripts.seed_dart_corp_codes'` 또는 ImportError.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/seed_dart_corp_codes.py`:

```python
"""One-time DART corp_code seed → Supabase dart_corp_codes.

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


def parse_corp_code_xml(xml_text: str) -> list[dict]:
    """Parse DART corpCode.xml → list of {ticker, corp_code, corp_name, market}.

    Rules (D13):
    - corp_cls Y/K/N → KOSPI/KOSDAQ/KONEX
    - corp_cls 'E' (기타) + stock_code 부재 → 제외
    - 알 수 없는 corp_cls → 제외 (방어적)
    - stock_code 공백/빈 문자열 → 제외
    """
    root = fromstring(xml_text)
    rows: list[dict] = []
    for li in root.findall("list"):
        corp_cls = (li.findtext("corp_cls") or "").strip()
        stock_code = (li.findtext("stock_code") or "").strip()
        if not stock_code:
            continue  # 비상장
        market = CORP_CLS_MAP.get(corp_cls)
        if market is None:
            continue  # E 또는 기타 — KRX universe 밖
        rows.append({
            "ticker": stock_code,
            "corp_code": (li.findtext("corp_code") or "").strip(),
            "corp_name": (li.findtext("corp_name") or "").strip(),
            "market": market,
        })
    return rows
```

- [ ] **Step 4: Run test to verify it passes**

Run: `scripts/.venv/bin/python -m unittest scripts.test_seed_dart_corp_codes -v`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed_dart_corp_codes.py scripts/test_seed_dart_corp_codes.py
git commit -m "feat(T7e.8 follow-up): scripts/seed_dart_corp_codes.py parse_corp_code_xml + tests

corp_cls Y/K/N → KOSPI/KOSDAQ/KONEX 매핑 (D13). 비상장 E + 알 수 없는 cls 제외.
3 unittest 통과.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task B2: `download_corp_code_zip()` + `upsert_corp_codes()` + main()

**Files:**
- Modify: `scripts/seed_dart_corp_codes.py`
- Modify: `scripts/test_seed_dart_corp_codes.py`

- [ ] **Step 1: Write the failing test for fetch + upsert orchestration**

Append to `scripts/test_seed_dart_corp_codes.py`:

```python
class TestDownloadAndUpsert(unittest.TestCase):
    def test_extract_xml_from_zip_bytes(self):
        """ZIP bytes → CORPCODE.xml 내용 추출."""
        import zipfile, io
        from scripts.seed_dart_corp_codes import extract_xml_from_zip

        # Build a fake ZIP containing CORPCODE.xml
        xml_body = "<result><list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><stock_code>005930</stock_code><corp_cls>Y</corp_cls></list></result>"
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("CORPCODE.xml", xml_body)
        zip_bytes = buf.getvalue()

        text = extract_xml_from_zip(zip_bytes)
        self.assertIn("삼성전자", text)
        self.assertIn("005930", text)

    def test_upsert_batches_rows(self):
        """upsert_corp_codes: Supabase client mock 호출 횟수 확인 (500 batch)."""
        from scripts.seed_dart_corp_codes import upsert_corp_codes
        from unittest.mock import MagicMock

        client = MagicMock()
        table = MagicMock()
        client.table.return_value = table
        table.upsert.return_value = table
        table.execute.return_value = MagicMock(data=[{}])

        rows = [{"ticker": f"{i:06d}", "corp_code": f"{i:08d}", "corp_name": f"co{i}", "market": "KOSPI"}
                for i in range(1200)]
        n = upsert_corp_codes(client, rows, batch_size=500)
        self.assertEqual(n, 1200)
        # 1200 / 500 → 3 batches (500 + 500 + 200)
        self.assertEqual(table.upsert.call_count, 3)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `scripts/.venv/bin/python -m unittest scripts.test_seed_dart_corp_codes -v`
Expected: 2 new failures (`AttributeError: module ... has no attribute 'extract_xml_from_zip'/'upsert_corp_codes'`).

- [ ] **Step 3: Add implementation**

Append to `scripts/seed_dart_corp_codes.py`:

```python
DART_CORPCODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml"


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
    for r in rows:
        by_market[r["market"]] = by_market.get(r["market"], 0) + 1
    for m, n in sorted(by_market.items()):
        print(f"  {m}: {n:,}")

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `scripts/.venv/bin/python -m unittest scripts.test_seed_dart_corp_codes -v`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed_dart_corp_codes.py scripts/test_seed_dart_corp_codes.py
git commit -m "feat(T7e.8 follow-up): scripts/seed_dart_corp_codes.py download+upsert main

DART corpCode.xml.zip fetch + ZIP 추출 + 500 batch UPSERT (on_conflict=ticker).
--dry-run 플래그 + 마켓별 카운트 미리보기. 2 unittest 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task B3: Run seed → verify ~6,000 rows in Supabase

**Files:**
- (no file changes)

- [ ] **Step 1: Dry-run first**

Run from repo root:

```bash
cd /Users/yong/New_Project_KR_Stock
set -a && eval "$(grep -E '^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|DART_API_KEY)=' tudal/.env.local)" && set +a
SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" scripts/.venv/bin/python scripts/seed_dart_corp_codes.py --dry-run
```

Expected: `parsed rows: ~3,000+` with KOSPI/KOSDAQ/KONEX breakdown.

- [ ] **Step 2: Apply**

```bash
SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" scripts/.venv/bin/python scripts/seed_dart_corp_codes.py
```

Expected: `done: ~3,000+ rows upserted` (DART includes only listed companies after filter).

- [ ] **Step 3: Verify Supabase**

Run via `mcp__supabase__execute_sql`:

```sql
select market, count(*) from dart_corp_codes group by market order by market;
```

Expected: KOSPI ~900+, KOSDAQ ~1,400+, KONEX ~100+. Total roughly matches dry-run output.

Also probe specific tickers:

**Probe ticker 선택 (Major 2 fix)**: KOSPI 대표 2종 + 현재 active KOSDAQ 1종 (091990 셀트리온헬스케어는 합병/상장 이슈 가능성 있어 제외). dry-run 결과를 보고 KOSDAQ 1종은 active 대형주 중 임의 선택.

```sql
select ticker, corp_code, corp_name, market
from dart_corp_codes
where ticker in ('005930', '000660', '247540')
order by ticker;
```

Expected: 삼성전자(KOSPI)·SK하이닉스(KOSPI)·에코프로비엠(KOSDAQ). 247540이 최근 매핑에 없으면 SELECT 결과를 사용자에게 보여주고 active KOSDAQ 대표 1종을 사용자가 선택.

- [ ] **Step 4: No commit (data seed, not code change)**

---

## Phase C: `dart_signals.py` — Signal 5 Quality 계산

### Task C1: `parse_dart_financial_response()` — DART JSON 응답 파싱

**Files:**
- Create: `scripts/dart_signals.py`
- Create: `scripts/test_dart_signals.py`

- [ ] **Step 1: Write the failing test**

Create `scripts/test_dart_signals.py`:

```python
"""Unittest for scripts/dart_signals.py — DART Signal 4·5 pure functions."""
from __future__ import annotations

import unittest


SAMPLE_DART_OK = {
    "status": "000",
    "message": "정상",
    "list": [
        {"account_nm": "매출액",      "sj_div": "IS", "thstrm_amount": "300,870,000,000,000"},
        {"account_nm": "영업이익",    "sj_div": "IS", "thstrm_amount": "32,730,000,000,000"},
        {"account_nm": "당기순이익",  "sj_div": "IS", "thstrm_amount": "34,450,000,000,000"},
        {"account_nm": "자산총계",    "sj_div": "BS", "thstrm_amount": "514,530,000,000,000"},
        {"account_nm": "자본총계",    "sj_div": "BS", "thstrm_amount": "402,190,000,000,000"},
        {"account_nm": "부채총계",    "sj_div": "BS", "thstrm_amount": "112,340,000,000,000"},
        {"account_nm": "이자비용",    "sj_div": "IS", "thstrm_amount": "1,200,000,000,000"},
    ],
}


class TestParseDartFinancialResponse(unittest.TestCase):
    def test_normal_parse(self):
        from scripts.dart_signals import parse_dart_financial_response
        parsed, aliases = parse_dart_financial_response(SAMPLE_DART_OK)
        self.assertEqual(parsed["revenue"], 300_870_000_000_000)
        self.assertEqual(parsed["op_income"], 32_730_000_000_000)
        self.assertEqual(parsed["net_income"], 34_450_000_000_000)
        self.assertEqual(parsed["total_assets"], 514_530_000_000_000)
        self.assertEqual(parsed["total_equity"], 402_190_000_000_000)
        self.assertEqual(parsed["total_debt"], 112_340_000_000_000)
        self.assertEqual(parsed["interest_expense"], 1_200_000_000_000)
        self.assertEqual(aliases, [])  # all primary names

    def test_missing_account_returns_none(self):
        from scripts.dart_signals import parse_dart_financial_response
        partial = {"status": "000", "list": [
            {"account_nm": "매출액", "sj_div": "IS", "thstrm_amount": "1,000"},
        ]}
        parsed, aliases = parse_dart_financial_response(partial)
        self.assertEqual(parsed["revenue"], 1000)
        self.assertIsNone(parsed["op_income"])
        self.assertIsNone(parsed["interest_expense"])
        self.assertEqual(aliases, [])

    def test_status_not_000_raises(self):
        from scripts.dart_signals import parse_dart_financial_response, DartNoDataError
        with self.assertRaises(DartNoDataError):
            parse_dart_financial_response({"status": "013", "message": "조회된 데이터가 없습니다."})

    def test_account_alias_match_logs_metadata(self):
        """**Major 1 fix**: 금융업 '영업수익' → revenue로 매칭되며 alias_meta에 기록."""
        from scripts.dart_signals import parse_dart_financial_response
        payload = {"status": "000", "list": [
            {"account_nm": "영업수익", "sj_div": "IS", "thstrm_amount": "5,000"},
            {"account_nm": "영업이익", "sj_div": "IS", "thstrm_amount": "500"},
        ]}
        parsed, aliases = parse_dart_financial_response(payload)
        self.assertEqual(parsed["revenue"], 5000)
        self.assertEqual(parsed["op_income"], 500)
        # '영업수익' is non-primary alias for revenue → recorded
        self.assertIn("account_alias_used:revenue=영업수익", aliases)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `scripts/.venv/bin/python -m unittest scripts.test_dart_signals -v`
Expected: ImportError (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `scripts/dart_signals.py`:

```python
"""DART Signal 4 (earnings momentum YoY) + Signal 5 (quality) 산출.

spec: docs/superpowers/specs/2026-05-12-tier0-dart-signals-design.md
"""
from __future__ import annotations

from typing import Optional


# DART 계정과목명 → 표준 키 매핑 (D16, Major 1 fix).
# 첫 번째 alias가 primary. primary가 아닌 alias 매칭 시 caller에서 메타 로그 기록.
DART_ACCOUNT_ALIASES = {
    "revenue":          (["매출액", "수익(매출액)", "영업수익", "수익", "보험영업수익"],   ("IS", "CIS")),
    "op_income":        (["영업이익", "영업이익(손실)"],                                  ("IS", "CIS")),
    "net_income":       (["당기순이익", "당기순이익(손실)"],                              ("IS", "CIS")),
    "total_assets":     (["자산총계"],                                                    ("BS",)),
    "total_equity":     (["자본총계"],                                                    ("BS",)),
    "total_debt":       (["부채총계"],                                                    ("BS",)),
    "interest_expense": (["이자비용", "이자비용(이자수익차감후)"],                          ("IS", "CIS")),
}

# Build reverse lookup: account_nm → (std_key, sj_divs, is_primary)
DART_ACCOUNT_MAP: dict[str, tuple[str, tuple[str, ...], bool]] = {}
for _std_key, (_aliases, _sj_divs) in DART_ACCOUNT_ALIASES.items():
    for _idx, _name in enumerate(_aliases):
        DART_ACCOUNT_MAP.setdefault(_name, (_std_key, _sj_divs, _idx == 0))

FINANCIAL_KEYS = ("revenue", "op_income", "net_income", "total_assets",
                  "total_equity", "total_debt", "interest_expense")


class DartNoDataError(Exception):
    """DART status != '000' (e.g. '013' = 조회 결과 없음)."""
    def __init__(self, status: str, message: str = ""):
        super().__init__(f"DART status={status} message={message}")
        self.status = status
        self.message = message


def parse_dart_financial_response(payload: dict) -> tuple[dict[str, Optional[float]], list[str]]:
    """Parse DART fnlttSinglAcntAll.json → 7 standard financial keys.

    Returns (parsed_dict, alias_metadata).
    - parsed_dict: {revenue, op_income, net_income, total_assets, total_equity, total_debt, interest_expense}
    - alias_metadata: list of strings like 'account_alias_used:revenue=영업수익' for non-primary matches (D16).

    Raises DartNoDataError if status != '000'.
    """
    status = payload.get("status")
    if status != "000":
        raise DartNoDataError(status or "unknown", payload.get("message", ""))

    out: dict[str, Optional[float]] = {k: None for k in FINANCIAL_KEYS}
    alias_meta: list[str] = []
    for item in payload.get("list", []):
        nm = item.get("account_nm", "")
        sj = item.get("sj_div", "")
        mapping = DART_ACCOUNT_MAP.get(nm)
        if mapping is None:
            continue
        std_key, allowed_sjs, is_primary = mapping
        if sj not in allowed_sjs:
            continue
        if out[std_key] is not None:
            continue
        raw = (item.get("thstrm_amount") or "").replace(",", "").strip()
        if not raw or raw == "-":
            continue
        try:
            out[std_key] = float(raw)
        except ValueError:
            continue
        if not is_primary:
            alias_meta.append(f"account_alias_used:{std_key}={nm}")
    return out, alias_meta
```

- [ ] **Step 4: Run test to verify it passes**

Run: `scripts/.venv/bin/python -m unittest scripts.test_dart_signals -v`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/dart_signals.py scripts/test_dart_signals.py
git commit -m "feat(T7e.8 follow-up): scripts/dart_signals.py parse_dart_financial_response

DART fnlttSinglAcntAll.json → 8 표준 재무 키. account_nm + sj_div 이중 매칭.
status != '000' → DartNoDataError. 3 unittest.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task C2: `compute_quality_score()` + 5지표 누락 정책

**Files:**
- Modify: `scripts/dart_signals.py`
- Modify: `scripts/test_dart_signals.py`

- [ ] **Step 1: Write the failing test**

Append to `scripts/test_dart_signals.py`:

```python
class TestComputeQualityScore(unittest.TestCase):
    """compute_quality_score(annual_X, annual_X_1) → (score_raw_dict, insufficient: bool)

    score_raw_dict는 5개 키 (roe, debt_ratio_inv, op_margin, revenue_growth, interest_coverage).
    각각 raw 비율값 (z-score 정규화 전). NaN/None은 universe-wide z-score에서 제외.
    """

    def _samsung_2024(self):
        # Samsung 2024 numbers
        return {
            "revenue": 300_870_000_000_000,
            "op_income": 32_730_000_000_000,
            "net_income": 34_450_000_000_000,
            "total_assets": 514_530_000_000_000,
            "total_equity": 402_190_000_000_000,
            "total_debt": 112_340_000_000_000,
            "interest_expense": 1_200_000_000_000,
        }

    def _samsung_2023(self):
        return {**self._samsung_2024(), "revenue": 258_900_000_000_000}

    def test_normal_5_metrics(self):
        from scripts.dart_signals import compute_quality_score
        raw, insufficient = compute_quality_score(self._samsung_2024(), self._samsung_2023())
        self.assertFalse(insufficient)
        self.assertAlmostEqual(raw["roe"], 34_450 / 402_190, places=4)
        self.assertAlmostEqual(raw["debt_ratio_inv"], -(112_340 / 402_190), places=4)
        self.assertAlmostEqual(raw["op_margin"], 32_730 / 300_870, places=4)
        self.assertAlmostEqual(raw["revenue_growth"], (300_870 - 258_900) / 258_900, places=4)
        self.assertAlmostEqual(raw["interest_coverage"], 32_730 / 1_200, places=2)

    def test_capital_impairment_skips_roe_debt(self):
        """자본잠식 (total_equity ≤ 0) → roe/debt_ratio_inv NaN, 나머지 정상."""
        from scripts.dart_signals import compute_quality_score
        import math
        cur = {**self._samsung_2024(), "total_equity": -1_000_000_000}
        prev = self._samsung_2023()
        raw, insufficient = compute_quality_score(cur, prev)
        self.assertTrue(math.isnan(raw["roe"]))
        self.assertTrue(math.isnan(raw["debt_ratio_inv"]))
        self.assertFalse(math.isnan(raw["op_margin"]))
        self.assertFalse(insufficient)  # 3 metrics still present (op_margin, growth, coverage)

    def test_zero_interest_skips_coverage(self):
        """무차입 (interest_expense=0) → interest_coverage 제외."""
        from scripts.dart_signals import compute_quality_score
        import math
        cur = {**self._samsung_2024(), "interest_expense": 0}
        prev = self._samsung_2023()
        raw, insufficient = compute_quality_score(cur, prev)
        self.assertTrue(math.isnan(raw["interest_coverage"]))
        self.assertFalse(insufficient)

    def test_three_missing_returns_insufficient(self):
        """5지표 중 3개 이상 누락 → insufficient=True (caller가 quality_raw=0 처리)."""
        from scripts.dart_signals import compute_quality_score
        cur = {**self._samsung_2024(), "total_equity": None, "interest_expense": None, "op_income": None}
        prev = self._samsung_2023()
        raw, insufficient = compute_quality_score(cur, prev)
        self.assertTrue(insufficient)

    def test_missing_prior_year_breaks_growth(self):
        from scripts.dart_signals import compute_quality_score
        import math
        raw, _ = compute_quality_score(self._samsung_2024(), None)
        self.assertTrue(math.isnan(raw["revenue_growth"]))

    def test_prior_year_revenue_zero(self):
        from scripts.dart_signals import compute_quality_score
        import math
        prev = {**self._samsung_2023(), "revenue": 0}
        raw, _ = compute_quality_score(self._samsung_2024(), prev)
        self.assertTrue(math.isnan(raw["revenue_growth"]))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `scripts/.venv/bin/python -m unittest scripts.test_dart_signals -v`
Expected: 6 new failures (ImportError on `compute_quality_score`).

- [ ] **Step 3: Add implementation**

Append to `scripts/dart_signals.py`:

```python
import math


QUALITY_METRIC_KEYS = ("roe", "debt_ratio_inv", "op_margin", "revenue_growth", "interest_coverage")


def _safe_div(numerator: Optional[float], denominator: Optional[float]) -> float:
    """Returns NaN when either operand is None or denominator is 0 / negative."""
    if numerator is None or denominator is None:
        return math.nan
    if denominator == 0:
        return math.nan
    return numerator / denominator


def compute_quality_score(
    annual_x: Optional[dict],
    annual_x_minus_1: Optional[dict],
) -> tuple[dict[str, float], bool]:
    """5-metric quality scoring (raw ratios, no z-score yet).

    Returns:
        (raw_metrics, insufficient)
        - raw_metrics: {roe, debt_ratio_inv, op_margin, revenue_growth, interest_coverage}
          Each value is a float or NaN. NaN means "exclude from this metric's z-score".
        - insufficient: True if 3+ metrics are NaN → caller should set quality_raw = 0
          and log 'quality_insufficient_fields' (D8 Fix 1).
    """
    out: dict[str, float] = {k: math.nan for k in QUALITY_METRIC_KEYS}
    if annual_x is None:
        return out, True

    equity = annual_x.get("total_equity")
    # 자본잠식: roe / debt_ratio_inv 제외
    if equity is not None and equity > 0:
        out["roe"] = _safe_div(annual_x.get("net_income"), equity)
        debt = annual_x.get("total_debt")
        if debt is not None:
            out["debt_ratio_inv"] = -(debt / equity)

    out["op_margin"] = _safe_div(annual_x.get("op_income"), annual_x.get("revenue"))

    # 매출성장률: 직전년 revenue > 0 필수
    if annual_x_minus_1 is not None:
        rev_x = annual_x.get("revenue")
        rev_x_1 = annual_x_minus_1.get("revenue")
        if rev_x is not None and rev_x_1 is not None and rev_x_1 > 0:
            out["revenue_growth"] = (rev_x - rev_x_1) / rev_x_1

    # 이자보상배율: 무차입(=0)이면 NaN (페널티 없음)
    interest = annual_x.get("interest_expense")
    if interest is not None and interest > 0:
        out["interest_coverage"] = _safe_div(annual_x.get("op_income"), interest)

    nan_count = sum(1 for v in out.values() if math.isnan(v))
    insufficient = nan_count >= 3
    return out, insufficient
```

- [ ] **Step 4: Run test to verify it passes**

Run: `scripts/.venv/bin/python -m unittest scripts.test_dart_signals -v`
Expected: 9 tests PASS total.

- [ ] **Step 5: Commit**

```bash
git add scripts/dart_signals.py scripts/test_dart_signals.py
git commit -m "feat(T7e.8 follow-up): compute_quality_score 5지표 + 누락 정책

ROE/부채비율(역방향)/영업이익률/매출성장률/이자보상배율. 자본잠식·무차입·prior 누락 분기.
3+ NaN → insufficient flag (caller 0 처리). 6 unittest (Fix 1 박제).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase D: `dart_signals.py` — Signal 4 Earnings Momentum (standalone YoY)

### Task D1: `compute_standalone_quarter()` 누적값 차분 (Q1~Q4)

**Files:**
- Modify: `scripts/dart_signals.py`
- Modify: `scripts/test_dart_signals.py`

- [ ] **Step 1: Write the failing test**

Append to `scripts/test_dart_signals.py`:

```python
class TestComputeStandaloneQuarter(unittest.TestCase):
    """Standalone quarter = cumulative_current - cumulative_prior_period.

    Q1 = Q1 (그대로)
    Q2 = H1 - Q1
    Q3 = 9M - H1
    Q4 = annual - 9M
    """

    def test_q1_is_already_standalone(self):
        from scripts.dart_signals import compute_standalone_quarter
        q1 = {"revenue": 100, "op_income": 10}
        out = compute_standalone_quarter("Q1", q1_cumulative=q1)
        self.assertEqual(out["revenue"], 100)
        self.assertEqual(out["op_income"], 10)

    def test_q2_subtracts_q1_from_h1(self):
        from scripts.dart_signals import compute_standalone_quarter
        h1 = {"revenue": 220, "op_income": 25}
        q1 = {"revenue": 100, "op_income": 10}
        out = compute_standalone_quarter("Q2", h1_cumulative=h1, q1_cumulative=q1)
        self.assertEqual(out["revenue"], 120)
        self.assertEqual(out["op_income"], 15)

    def test_q3_subtracts_h1_from_9m(self):
        from scripts.dart_signals import compute_standalone_quarter
        nine_m = {"revenue": 360, "op_income": 35}
        h1 = {"revenue": 220, "op_income": 25}
        out = compute_standalone_quarter("Q3", nine_m_cumulative=nine_m, h1_cumulative=h1)
        self.assertEqual(out["revenue"], 140)
        self.assertEqual(out["op_income"], 10)

    def test_q4_subtracts_9m_from_annual(self):
        from scripts.dart_signals import compute_standalone_quarter
        annual = {"revenue": 500, "op_income": 50}
        nine_m = {"revenue": 360, "op_income": 35}
        out = compute_standalone_quarter("Q4", annual_cumulative=annual, nine_m_cumulative=nine_m)
        self.assertEqual(out["revenue"], 140)
        self.assertEqual(out["op_income"], 15)

    def test_missing_input_returns_none(self):
        from scripts.dart_signals import compute_standalone_quarter
        self.assertIsNone(compute_standalone_quarter("Q3", nine_m_cumulative={"revenue": 360}, h1_cumulative=None))

    def test_negative_op_quarter(self):
        """적자 분기 — Q3 OP = 35 (9M) - 50 (H1) = -15 (Q3 적자)."""
        from scripts.dart_signals import compute_standalone_quarter
        nine_m = {"revenue": 360, "op_income": 35}
        h1 = {"revenue": 200, "op_income": 50}
        out = compute_standalone_quarter("Q3", nine_m_cumulative=nine_m, h1_cumulative=h1)
        self.assertEqual(out["op_income"], -15)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `scripts/.venv/bin/python -m unittest scripts.test_dart_signals -v`
Expected: 6 new failures.

- [ ] **Step 3: Add implementation**

Append to `scripts/dart_signals.py`:

```python
def _subtract_financial(a: dict, b: dict) -> dict[str, Optional[float]]:
    """Subtract financial dicts component-wise. None - X or X - None → None for that key."""
    out: dict[str, Optional[float]] = {}
    for k in ("revenue", "op_income", "net_income"):
        va, vb = a.get(k), b.get(k)
        if va is None or vb is None:
            out[k] = None
        else:
            out[k] = va - vb
    return out


def compute_standalone_quarter(
    target_quarter: str,
    *,
    q1_cumulative: Optional[dict] = None,
    h1_cumulative: Optional[dict] = None,
    nine_m_cumulative: Optional[dict] = None,
    annual_cumulative: Optional[dict] = None,
) -> Optional[dict[str, Optional[float]]]:
    """Compute standalone single-quarter financials from cumulative DART reports.

    target_quarter ∈ {'Q1', 'Q2', 'Q3', 'Q4'}.
    Required cumulative inputs depend on target:
      Q1 → q1_cumulative
      Q2 → h1_cumulative + q1_cumulative
      Q3 → nine_m_cumulative + h1_cumulative
      Q4 → annual_cumulative + nine_m_cumulative

    Returns dict {revenue, op_income, net_income} or None if any required input is missing.
    """
    if target_quarter == "Q1":
        if q1_cumulative is None:
            return None
        return {k: q1_cumulative.get(k) for k in ("revenue", "op_income", "net_income")}
    if target_quarter == "Q2":
        if h1_cumulative is None or q1_cumulative is None:
            return None
        return _subtract_financial(h1_cumulative, q1_cumulative)
    if target_quarter == "Q3":
        if nine_m_cumulative is None or h1_cumulative is None:
            return None
        return _subtract_financial(nine_m_cumulative, h1_cumulative)
    if target_quarter == "Q4":
        if annual_cumulative is None or nine_m_cumulative is None:
            return None
        return _subtract_financial(annual_cumulative, nine_m_cumulative)
    raise ValueError(f"Unknown target_quarter: {target_quarter!r}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `scripts/.venv/bin/python -m unittest scripts.test_dart_signals -v`
Expected: 15 tests PASS total.

- [ ] **Step 5: Commit**

```bash
git add scripts/dart_signals.py scripts/test_dart_signals.py
git commit -m "feat(T7e.8 follow-up): compute_standalone_quarter Q1~Q4 누적값 차분

DART 분기보고서는 H1/9M 누적이므로 단독 분기 = 누적 차분 (Q2=H1-Q1, Q3=9M-H1, Q4=annual-9M).
6 unittest. 적자 분기 + 누락 입력 분기 포함. spec D7 Fix 2 박제.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task D2: `compute_yoy_earnings_momentum()` + `determine_target_quarter()`

**Files:**
- Modify: `scripts/dart_signals.py`
- Modify: `scripts/test_dart_signals.py`

- [ ] **Step 1: Write the failing test**

Append to `scripts/test_dart_signals.py`:

```python
class TestYoyEarningsMomentum(unittest.TestCase):
    def test_normal_growth(self):
        """매출 +20%, OP +50% → avg = (0.2 + 0.5)/2 = 0.35."""
        from scripts.dart_signals import compute_yoy_earnings_momentum
        current = {"revenue": 120, "op_income": 15}
        prior = {"revenue": 100, "op_income": 10}
        out = compute_yoy_earnings_momentum(current, prior)
        self.assertAlmostEqual(out, 0.35, places=4)

    def test_prior_revenue_zero_nan(self):
        from scripts.dart_signals import compute_yoy_earnings_momentum
        import math
        prior = {"revenue": 0, "op_income": 10}
        out = compute_yoy_earnings_momentum({"revenue": 120, "op_income": 15}, prior)
        self.assertTrue(math.isnan(out))

    def test_turnaround_negative_to_positive(self):
        """흑자전환: prior OP = -10, current OP = +30 → 1.0 * 4 = 4.0."""
        from scripts.dart_signals import compute_yoy_earnings_momentum
        current = {"revenue": 110, "op_income": 30}
        prior = {"revenue": 100, "op_income": -10}
        out = compute_yoy_earnings_momentum(current, prior)
        # revenue_yoy = 0.1, op_yoy = (30 - (-10)) / 10 = 4.0 → avg = 2.05
        self.assertAlmostEqual(out, 2.05, places=4)

    def test_missing_current_returns_nan(self):
        from scripts.dart_signals import compute_yoy_earnings_momentum
        import math
        out = compute_yoy_earnings_momentum(None, {"revenue": 100, "op_income": 10})
        self.assertTrue(math.isnan(out))


class TestDetermineTargetQuarter(unittest.TestCase):
    """target_date(seed 실행일) → 공시 마감 + 30일 grace 통과한 최근 분기 (D14).

    1/1 ~ 5/1   → (year-1, Q3)
    5/2 ~ 6/15  → (year-1, Q4) — annual 공시 완료 후, Q1 미공시 가능
    6/16 ~ 9/15 → (year, Q1)
    9/16 ~ 12/15 → (year, Q2)
    12/16 ~ 12/31 → (year, Q3)
    """

    def test_early_february(self):
        from scripts.dart_signals import determine_target_quarter
        from datetime import date
        self.assertEqual(determine_target_quarter(date(2026, 2, 15)), (2025, "Q3"))

    def test_may_12_uses_prior_q4(self):
        """**Blocker 1 fix**: 2026-05-12 시드는 Q1 미공시 가능성 → (2025, Q4)."""
        from scripts.dart_signals import determine_target_quarter
        from datetime import date
        self.assertEqual(determine_target_quarter(date(2026, 5, 12)), (2025, "Q4"))

    def test_late_june(self):
        from scripts.dart_signals import determine_target_quarter
        from datetime import date
        self.assertEqual(determine_target_quarter(date(2026, 6, 20)), (2026, "Q1"))

    def test_october(self):
        from scripts.dart_signals import determine_target_quarter
        from datetime import date
        self.assertEqual(determine_target_quarter(date(2026, 10, 1)), (2026, "Q2"))

    def test_late_december(self):
        from scripts.dart_signals import determine_target_quarter
        from datetime import date
        self.assertEqual(determine_target_quarter(date(2026, 12, 20)), (2026, "Q3"))

    def test_january(self):
        from scripts.dart_signals import determine_target_quarter
        from datetime import date
        self.assertEqual(determine_target_quarter(date(2026, 1, 5)), (2025, "Q3"))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `scripts/.venv/bin/python -m unittest scripts.test_dart_signals -v`
Expected: 9 new failures.

- [ ] **Step 3: Add implementation**

Append to `scripts/dart_signals.py`:

```python
from datetime import date as _date


def compute_yoy_earnings_momentum(
    current_q_standalone: Optional[dict],
    prior_year_q_standalone: Optional[dict],
) -> float:
    """Signal 4 earnings_raw = avg of (revenue YoY, op_income YoY).

    Returns float, or NaN if inputs missing or denominators are zero.
    """
    if current_q_standalone is None or prior_year_q_standalone is None:
        return math.nan

    def _yoy(curr_key: str) -> float:
        curr = current_q_standalone.get(curr_key)
        prev = prior_year_q_standalone.get(curr_key)
        if curr is None or prev is None or prev == 0:
            return math.nan
        return (curr - prev) / abs(prev)

    rev_yoy = _yoy("revenue")
    op_yoy = _yoy("op_income")
    if math.isnan(rev_yoy) and math.isnan(op_yoy):
        return math.nan
    if math.isnan(rev_yoy):
        return op_yoy
    if math.isnan(op_yoy):
        return rev_yoy
    return (rev_yoy + op_yoy) / 2


def determine_target_quarter(target_date: _date) -> tuple[int, str]:
    """seed 실행일 → 공시 마감 + 30일 grace 통과한 최근 분기 (D14, Blocker 1 fix).

    한국 분기 공시 마감:
      Q1 (3월말) → 5월 15일 까지 (보고서 11013)
      Q2 (6월말) → 8월 15일 (반기보고서 11012)
      Q3 (9월말) → 11월 15일 (보고서 11014)
      Annual (12월말) → 다음해 3월 31일 (사업보고서 11011, Q4 = annual - 9M)

    + 30일 grace 적용:
      Q1 safe after 6/15
      Q2 safe after 9/15
      Q3 safe after 12/15
      Annual safe after 5/1
    """
    m, d = target_date.month, target_date.day
    y = target_date.year
    md = (m, d)
    if md >= (12, 16):
        return (y, "Q3")
    if md >= (9, 16):
        return (y, "Q2")
    if md >= (6, 16):
        return (y, "Q1")
    if md >= (5, 2):
        # annual 공시 완료, Q1 미공시 — Q4 standalone = annual - 9M
        return (y - 1, "Q4")
    # 1/1 ~ 5/1: 전년 annual도 안전하지 않음 (3/31 + grace 미경과 가능)
    return (y - 1, "Q3")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `scripts/.venv/bin/python -m unittest scripts.test_dart_signals -v`
Expected: 24 tests PASS total.

- [ ] **Step 5: Commit**

```bash
git add scripts/dart_signals.py scripts/test_dart_signals.py
git commit -m "feat(T7e.8 follow-up): compute_yoy_earnings_momentum + determine_target_quarter

Signal 4 = (revenue YoY + op_income YoY) / 2. NaN handling for 분모0·누락.
target_date → 가장 최근 공시 분기 (1~3월→직전Q3, 4~6월→Q1 등).
9 unittest.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase E: DART HTTP fetch + Supabase cache layer

### Task E1: `dart_fetch_financial()` + CFS→OFS fallback

**Files:**
- Modify: `scripts/dart_signals.py`
- Modify: `scripts/test_dart_signals.py`

- [ ] **Step 1: Write the failing test**

Append to `scripts/test_dart_signals.py`:

```python
class TestDartFetchFinancial(unittest.TestCase):
    """fetch_financial_with_fallback(corp_code, year, report_code, api_key) →
       returns (parsed_dict, statement_scope) — tries CFS then OFS.
    """

    def test_cfs_success(self):
        from unittest.mock import patch
        from scripts.dart_signals import fetch_financial_with_fallback
        ok = {"status": "000", "list": [
            {"account_nm": "매출액", "sj_div": "IS", "thstrm_amount": "100"},
        ]}
        with patch("scripts.dart_signals._dart_get", return_value=ok) as m:
            parsed, scope, alias = fetch_financial_with_fallback("00126380", "2024", "11011", "KEY")
            self.assertEqual(scope, "CFS")
            self.assertEqual(parsed["revenue"], 100)
            self.assertEqual(alias, [])
            self.assertEqual(m.call_count, 1)
            self.assertEqual(m.call_args.kwargs["fs_div"], "CFS")

    def test_ofs_fallback(self):
        from unittest.mock import patch
        from scripts.dart_signals import fetch_financial_with_fallback, DartNoDataError
        no_data = {"status": "013", "message": "조회된 데이터가 없습니다."}
        ofs_ok = {"status": "000", "list": [
            {"account_nm": "매출액", "sj_div": "IS", "thstrm_amount": "80"},
        ]}
        with patch("scripts.dart_signals._dart_get", side_effect=[no_data, ofs_ok]) as m:
            parsed, scope, alias = fetch_financial_with_fallback("00126380", "2024", "11011", "KEY")
            self.assertEqual(scope, "OFS")
            self.assertEqual(parsed["revenue"], 80)
            self.assertEqual(m.call_count, 2)
            self.assertEqual(m.call_args_list[0].kwargs["fs_div"], "CFS")
            self.assertEqual(m.call_args_list[1].kwargs["fs_div"], "OFS")

    def test_both_no_data_returns_none_scope(self):
        from unittest.mock import patch
        from scripts.dart_signals import fetch_financial_with_fallback
        no_data = {"status": "013", "message": "조회된 데이터가 없습니다."}
        with patch("scripts.dart_signals._dart_get", side_effect=[no_data, no_data]):
            parsed, scope, alias = fetch_financial_with_fallback("X", "2024", "11011", "KEY")
            self.assertIsNone(parsed)
            self.assertEqual(scope, "NONE")
            self.assertEqual(alias, [])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `scripts/.venv/bin/python -m unittest scripts.test_dart_signals -v`
Expected: 3 new failures.

- [ ] **Step 3: Add implementation**

Append to `scripts/dart_signals.py`:

```python
DART_FNLTT_URL = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json"


def _dart_get(*, url: str, params: dict, timeout: int = 30) -> dict:
    """HTTP GET DART JSON endpoint. Returns parsed dict. Raises requests exceptions."""
    import requests
    resp = requests.get(url, params=params, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def fetch_financial_with_fallback(
    corp_code: str,
    bsns_year: str,
    reprt_code: str,
    api_key: str,
) -> tuple[Optional[dict], str, list[str]]:
    """Fetch DART financial — CFS first, OFS fallback on status='013'.

    Returns (parsed_dict, statement_scope, alias_meta). statement_scope ∈ {'CFS','OFS','NONE'}.
    parsed_dict is None when both CFS and OFS return no_data.
    alias_meta is non-primary account_nm metadata (D16) — empty list when statement_scope='NONE'.
    """
    for scope in ("CFS", "OFS"):
        params = {
            "crtfc_key": api_key,
            "corp_code": corp_code,
            "bsns_year": bsns_year,
            "reprt_code": reprt_code,
            "fs_div": scope,
        }
        try:
            payload = _dart_get(url=DART_FNLTT_URL, params=params)
        except Exception:
            continue
        try:
            parsed, alias_meta = parse_dart_financial_response(payload)
            return parsed, scope, alias_meta
        except DartNoDataError as exc:
            if exc.status == "013":
                continue
            raise
    return None, "NONE", []
```

- [ ] **Step 4: Run test to verify it passes**

Run: `scripts/.venv/bin/python -m unittest scripts.test_dart_signals -v`
Expected: 27 tests PASS total.

- [ ] **Step 5: Commit**

```bash
git add scripts/dart_signals.py scripts/test_dart_signals.py
git commit -m "feat(T7e.8 follow-up): fetch_financial_with_fallback CFS→OFS

DART fnlttSinglAcntAll.json HTTP wrapper. CFS 1차 시도 → status='013' 시 OFS 자동 fallback.
statement_scope ∈ CFS/OFS/NONE 반환. 3 unittest.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task E2: `cache_get_or_fetch_annual()` + `cache_get_or_fetch_quarterly()` — Supabase cache layer

**Files:**
- Modify: `scripts/dart_signals.py`
- Modify: `scripts/test_dart_signals.py`

- [ ] **Step 1: Write the failing test**

Append to `scripts/test_dart_signals.py`:

```python
class TestCacheLayer(unittest.TestCase):
    def _make_client(self, select_data=None):
        from unittest.mock import MagicMock
        client = MagicMock()
        table = MagicMock()
        client.table.return_value = table
        # SELECT chain: client.table(X).select('*').eq().eq().eq().limit(1).execute()
        select = MagicMock()
        eq1 = MagicMock(); eq2 = MagicMock(); eq3 = MagicMock(); limit = MagicMock()
        table.select.return_value = select
        select.eq.return_value = eq1
        eq1.eq.return_value = eq2
        eq2.eq.return_value = eq3
        eq3.limit.return_value = limit
        limit.execute.return_value = MagicMock(data=select_data or [])
        # UPSERT chain
        table.upsert.return_value = table
        table.execute.return_value = MagicMock(data=[{}])
        return client, table

    def test_cache_hit_does_not_call_dart(self):
        """캐시에 row가 있으면 DART HTTP 호출 안 함."""
        from unittest.mock import patch
        from scripts.dart_signals import cache_get_or_fetch_annual
        cached_row = {
            "corp_code": "00126380", "period_type": "annual", "period_key": "2024",
            "revenue": 100, "op_income": 10, "net_income": 8,
            "total_assets": 500, "total_equity": 300, "total_debt": 200, "interest_expense": 1,
            "statement_scope": "CFS", "status": "ok", "calculation_basis": "annual",
        }
        client, table = self._make_client(select_data=[cached_row])

        with patch("scripts.dart_signals.fetch_financial_with_fallback") as mock_fetch:
            row = cache_get_or_fetch_annual(client, "00126380", 2024, api_key="KEY")
            self.assertEqual(row["revenue"], 100)
            mock_fetch.assert_not_called()

    def test_cache_miss_calls_dart_and_inserts(self):
        """캐시 miss → DART fetch → INSERT row + 반환."""
        from unittest.mock import patch
        from scripts.dart_signals import cache_get_or_fetch_annual
        client, table = self._make_client(select_data=[])  # miss

        parsed = {k: 1.0 for k in FINANCIAL_KEYS}
        with patch("scripts.dart_signals.fetch_financial_with_fallback", return_value=(parsed, "CFS", [])) as mock_fetch:
            row = cache_get_or_fetch_annual(client, "00126380", 2024, api_key="KEY")
            mock_fetch.assert_called_once_with("00126380", "2024", "11011", "KEY")
            self.assertEqual(row["revenue"], 1.0)
            self.assertEqual(row["statement_scope"], "CFS")
            self.assertEqual(row["calculation_basis"], "annual")
            self.assertEqual(row["status"], "ok")
            # Verify upsert was called
            table.upsert.assert_called_once()

    def test_quarterly_cache_with_correct_period_key(self):
        from unittest.mock import patch
        from scripts.dart_signals import cache_get_or_fetch_quarterly
        client, table = self._make_client(select_data=[])

        parsed = {k: 1.0 for k in FINANCIAL_KEYS}
        with patch("scripts.dart_signals.fetch_financial_with_fallback", return_value=(parsed, "CFS", [])):
            row = cache_get_or_fetch_quarterly(client, "00126380", 2025, "9M", api_key="KEY")
            # 9M = report_code 11014, period_key = '2025-9M'
            self.assertEqual(row["period_key"], "2025-9M")
            self.assertEqual(row["source_report_code"], "11014")
            # 9M is cumulative — calculation_basis = 'not_applicable'
            self.assertEqual(row["calculation_basis"], "not_applicable")

    def test_q1_cumulative_is_standalone(self):
        from unittest.mock import patch
        from scripts.dart_signals import cache_get_or_fetch_quarterly
        client, table = self._make_client(select_data=[])

        parsed = {k: 1.0 for k in FINANCIAL_KEYS}
        with patch("scripts.dart_signals.fetch_financial_with_fallback", return_value=(parsed, "CFS", [])):
            row = cache_get_or_fetch_quarterly(client, "00126380", 2025, "Q1", api_key="KEY")
            self.assertEqual(row["period_key"], "2025-Q1")
            self.assertEqual(row["source_report_code"], "11013")
            self.assertEqual(row["calculation_basis"], "standalone")  # Q1 is already standalone

    def test_annual_no_data_is_final(self):
        from unittest.mock import patch
        from scripts.dart_signals import cache_get_or_fetch_annual
        client, table = self._make_client(select_data=[])

        with patch("scripts.dart_signals.fetch_financial_with_fallback", return_value=(None, "NONE", [])):
            row = cache_get_or_fetch_annual(client, "X", 2024, api_key="KEY")
            self.assertIsNone(row.get("revenue"))
            self.assertEqual(row["status"], "no_data")  # annual = always final
            self.assertEqual(row["statement_scope"], "NONE")
            table.upsert.assert_called_once()

    def test_quarterly_no_data_within_disclosure_window_is_not_yet_disclosed(self):
        """**Blocker 2 fix**: quarterly + disclosure deadline 이내 미공시 → status='not_yet_disclosed'."""
        from unittest.mock import patch
        from datetime import date
        from scripts.dart_signals import cache_get_or_fetch_quarterly
        client, table = self._make_client(select_data=[])

        # today=2026-05-12, kind='Q1' for year 2026 → Q1 deadline 5/15 → 이내 → not_yet_disclosed
        with patch("scripts.dart_signals.fetch_financial_with_fallback", return_value=(None, "NONE", [])), \
             patch("scripts.dart_signals._today", return_value=date(2026, 5, 12)):
            row = cache_get_or_fetch_quarterly(client, "X", 2026, "Q1", api_key="KEY")
            self.assertEqual(row["status"], "not_yet_disclosed")

    def test_quarterly_no_data_past_grace_is_no_data(self):
        """disclosure deadline + 30일 경과 → 진짜 no_data (영구)."""
        from unittest.mock import patch
        from datetime import date
        from scripts.dart_signals import cache_get_or_fetch_quarterly
        client, table = self._make_client(select_data=[])

        # today=2026-07-01, Q1 2026 deadline 5/15 + 30일 = 6/14 경과 → no_data final
        with patch("scripts.dart_signals.fetch_financial_with_fallback", return_value=(None, "NONE", [])), \
             patch("scripts.dart_signals._today", return_value=date(2026, 7, 1)):
            row = cache_get_or_fetch_quarterly(client, "X", 2026, "Q1", api_key="KEY")
            self.assertEqual(row["status"], "no_data")

    def test_quarterly_not_yet_disclosed_ttl_refresh(self):
        """status='not_yet_disclosed' + fetched_at > 7일 → treat as cache miss, re-fetch."""
        from unittest.mock import patch
        from datetime import date, timedelta, timezone
        from scripts.dart_signals import cache_get_or_fetch_quarterly

        stale_row = {
            "corp_code": "X", "period_type": "quarterly", "period_key": "2026-Q1",
            "status": "not_yet_disclosed", "statement_scope": "NONE",
            "fetched_at": (date(2026, 5, 1)).isoformat(),
        }
        client, table = self._make_client(select_data=[stale_row])

        parsed = {k: 1.0 for k in FINANCIAL_KEYS}
        with patch("scripts.dart_signals.fetch_financial_with_fallback", return_value=(parsed, "CFS", [])) as mock_fetch, \
             patch("scripts.dart_signals._today", return_value=date(2026, 5, 12)):
            row = cache_get_or_fetch_quarterly(client, "X", 2026, "Q1", api_key="KEY")
            # 5/1 + 7일 < 5/12 → stale → refetch
            mock_fetch.assert_called_once()
            self.assertEqual(row["status"], "ok")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `scripts/.venv/bin/python -m unittest scripts.test_dart_signals -v`
Expected: 5 new failures.

- [ ] **Step 3: Add implementation**

Append to `scripts/dart_signals.py`:

```python
from datetime import date as _date3, timedelta

REPORT_CODE_MAP = {
    "annual": "11011",
    "Q1": "11013",
    "H1": "11012",
    "9M": "11014",
}

CALCULATION_BASIS_MAP = {
    "annual": "annual",
    "Q1": "standalone",   # Q1 report = Q1 standalone
    "H1": "not_applicable",
    "9M": "not_applicable",
}

# (D15) Disclosure deadline + 30일 grace per quarter kind
QUARTERLY_DEADLINE_MD = {
    "Q1": (5, 15),
    "H1": (8, 15),
    "9M": (11, 15),
}
DISCLOSURE_GRACE_DAYS = 30
NOT_YET_DISCLOSED_TTL_DAYS = 7


def _today() -> _date3:
    """Indirection for unittest patching."""
    return _date3.today()


def _is_within_disclosure_window(year: int, kind: str) -> bool:
    """True if today is before disclosure deadline + grace (D15 — Blocker 2 fix)."""
    md = QUARTERLY_DEADLINE_MD.get(kind)
    if md is None:
        return False
    deadline = _date3(year, *md) + timedelta(days=DISCLOSURE_GRACE_DAYS)
    return _today() <= deadline


def _is_ttl_stale(fetched_at_str: Optional[str]) -> bool:
    """Returns True if fetched_at is older than NOT_YET_DISCLOSED_TTL_DAYS days."""
    if not fetched_at_str:
        return True
    try:
        fetched = _date3.fromisoformat(fetched_at_str[:10])
    except ValueError:
        return True
    return (_today() - fetched).days >= NOT_YET_DISCLOSED_TTL_DAYS


def _cache_lookup(client, corp_code: str, period_type: str, period_key: str) -> Optional[dict]:
    res = (
        client.table("dart_financial_cache")
        .select("*")
        .eq("corp_code", corp_code)
        .eq("period_type", period_type)
        .eq("period_key", period_key)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    return rows[0] if rows else None


def _cache_upsert(client, row: dict) -> None:
    try:
        client.table("dart_financial_cache").upsert(row, on_conflict="corp_code,period_type,period_key").execute()
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] cache upsert failed for {row.get('corp_code')} {row.get('period_key')}: {exc}")


def cache_get_or_fetch_annual(client, corp_code: str, year: int, *, api_key: str) -> dict:
    """Annual report cache. no_data is ALWAYS final (no TTL refresh)."""
    period_key = str(year)
    hit = _cache_lookup(client, corp_code, "annual", period_key)
    if hit:
        return hit

    parsed, scope, alias_meta = fetch_financial_with_fallback(corp_code, period_key, "11011", api_key)
    if alias_meta:
        for m in alias_meta:
            print(f"[info] corp={corp_code} {period_key}: {m}")  # D16 메타 로그
    if parsed is None:
        row = _build_empty_row(corp_code, "annual", period_key, source_code="11011",
                               calc_basis="annual", scope="NONE", status="no_data")
    else:
        row = _build_full_row(corp_code, "annual", period_key, source_code="11011",
                              calc_basis="annual", scope=scope, parsed=parsed)
    _cache_upsert(client, row)
    return row


def cache_get_or_fetch_quarterly(
    client, corp_code: str, year: int, kind: str, *, api_key: str,
) -> dict:
    """kind ∈ {'Q1', 'H1', '9M'}.

    Blocker 2 fix: quarterly + disclosure deadline 이내 미공시 → 'not_yet_disclosed' + 7일 TTL.
    Stale 'not_yet_disclosed' row → treat as miss, re-fetch.
    """
    period_key = f"{year}-{kind}"
    hit = _cache_lookup(client, corp_code, "quarterly", period_key)
    if hit and hit.get("status") == "not_yet_disclosed" and _is_ttl_stale(hit.get("fetched_at")):
        hit = None  # force refresh
    if hit:
        return hit

    report_code = REPORT_CODE_MAP[kind]
    calc_basis = CALCULATION_BASIS_MAP[kind]
    parsed, scope, alias_meta = fetch_financial_with_fallback(corp_code, str(year), report_code, api_key)
    if alias_meta:
        for m in alias_meta:
            print(f"[info] corp={corp_code} {period_key}: {m}")
    if parsed is None:
        # Within disclosure window → not_yet_disclosed (refresh-eligible).
        # Past deadline + grace → no_data (final).
        status = "not_yet_disclosed" if _is_within_disclosure_window(year, kind) else "no_data"
        row = _build_empty_row(corp_code, "quarterly", period_key, source_code=report_code,
                               calc_basis=calc_basis, scope="NONE", status=status)
    else:
        row = _build_full_row(corp_code, "quarterly", period_key, source_code=report_code,
                              calc_basis=calc_basis, scope=scope, parsed=parsed)
    _cache_upsert(client, row)
    return row


def _build_full_row(corp_code, period_type, period_key, *, source_code, calc_basis, scope, parsed) -> dict:
    return {
        "corp_code": corp_code,
        "period_type": period_type,
        "period_key": period_key,
        **{k: parsed.get(k) for k in FINANCIAL_KEYS},
        "statement_scope": scope,
        "status": "ok",
        "error_code": None,
        "source_report_code": source_code,
        "calculation_basis": calc_basis,
    }


def _build_empty_row(corp_code, period_type, period_key, *, source_code, calc_basis, scope, status, error_code=None) -> dict:
    return {
        "corp_code": corp_code,
        "period_type": period_type,
        "period_key": period_key,
        **{k: None for k in FINANCIAL_KEYS},
        "statement_scope": scope,
        "status": status,
        "error_code": error_code,
        "source_report_code": source_code,
        "calculation_basis": calc_basis,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `scripts/.venv/bin/python -m unittest scripts.test_dart_signals -v`
Expected: 32 tests PASS total.

- [ ] **Step 5: Commit**

```bash
git add scripts/dart_signals.py scripts/test_dart_signals.py
git commit -m "feat(T7e.8 follow-up): cache_get_or_fetch_{annual,quarterly} layer

Supabase dart_financial_cache LOOKUP → miss → DART fetch → INSERT. Empty marker on no_data
방지 재호출. period_key 매핑 (annual='YYYY', quarterly='YYYY-Q1/H1/9M'). source_report_code
+ calculation_basis 정확 박제 (D12). 5 unittest.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase F: `fetch_dart_signals()` 통합 + 위임 wire

> **Blocker 3 fix**: 기존 plan은 `ScoreVec` dataclass를 가정했지만, 실제 코드는 `StockSignal`(line 172) + `ShortListRow`(line 194)이며 `row_to_db_dict()`가 CSV write와 Supabase upsert에 공용. 본 phase는 실제 이름 기준으로 작성됨.
>
> **Task 순서**: F1 → **F2 (quality composite 순수 함수, 의존 없음)** → **F3 (screen_shortlist_tier0 wire, F2 helper 사용)**. 이전 plan은 F2/F3 순서가 뒤집혀 있었음.

### Task F1: `fetch_dart_signals()` 통합 함수

**Files:**
- Modify: `scripts/dart_signals.py`
- Modify: `scripts/test_dart_signals.py`

- [ ] **Step 1: Write the failing test**

Append to `scripts/test_dart_signals.py`:

```python
class TestFetchDartSignalsIntegration(unittest.TestCase):
    def _setup_client(self, corp_code=None, financial_rows=None):
        """corp_code: ticker → corp_code lookup result. financial_rows: cache rows."""
        from unittest.mock import MagicMock

        client = MagicMock()

        def table_dispatch(name):
            t = MagicMock()
            if name == "dart_corp_codes":
                # SELECT chain: .select('*').eq('ticker', X).limit(1).execute()
                sel = MagicMock(); eq = MagicMock(); lim = MagicMock()
                t.select.return_value = sel
                sel.eq.return_value = eq
                eq.limit.return_value = lim
                lim.execute.return_value = MagicMock(
                    data=[{"corp_code": corp_code}] if corp_code else []
                )
            elif name == "dart_financial_cache":
                t.select.return_value = MagicMock()
                # default: miss
                chain = t.select.return_value
                for _ in range(3):
                    chain.eq.return_value = chain
                    chain = chain.eq.return_value
                chain.limit.return_value.execute.return_value = MagicMock(data=[])
                t.upsert.return_value = t
                t.execute.return_value = MagicMock(data=[{}])
            return t

        client.table.side_effect = table_dispatch
        return client

    def test_ticker_not_in_corp_codes_returns_zero(self):
        from datetime import date
        from scripts.dart_signals import fetch_dart_signals

        client = self._setup_client(corp_code=None)
        result = fetch_dart_signals(client, ticker="999999", target_date=date(2026, 5, 1), api_key="KEY")
        self.assertEqual(result.earnings_raw, 0.0)
        self.assertEqual(result.quality_raw, 0.0)
        self.assertEqual(result.quality_insufficient, True)  # No corp_code → metadata flag
        self.assertEqual(result.signal_4_basis, "not_applicable")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `scripts/.venv/bin/python -m unittest scripts.test_dart_signals -v`
Expected: 1 new failure.

- [ ] **Step 3: Add implementation**

Append to `scripts/dart_signals.py`:

```python
from dataclasses import dataclass
from datetime import date as _date2


@dataclass
class DartSignalsResult:
    """Output of fetch_dart_signals — Signal 4·5 raw values + metadata for logging."""
    earnings_raw: float                # Signal 4 (YoY 매출+OP 평균), raw ratio or 0.0
    quality_raw_metrics: dict[str, float]  # 5-metric raw dict for universe-wide z-score
    quality_insufficient: bool         # True → caller sets quality_raw composite = 0
    signal_4_basis: str                # 'standalone' / 'cumulative_fallback' / 'not_applicable'


def _lookup_corp_code(client, ticker: str) -> Optional[str]:
    res = (
        client.table("dart_corp_codes")
        .select("corp_code")
        .eq("ticker", ticker)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    return rows[0].get("corp_code") if rows else None


def fetch_dart_signals(
    client,
    *,
    ticker: str,
    target_date: _date2,
    api_key: str,
) -> DartSignalsResult:
    """Compute Signal 4 (earnings YoY) + Signal 5 raw metrics for one ticker.

    fail-soft: 데이터 누락 시 earnings_raw=0, quality_raw_metrics 모두 NaN, basis='not_applicable'.
    """
    corp_code = _lookup_corp_code(client, ticker)
    if corp_code is None:
        return DartSignalsResult(
            earnings_raw=0.0,
            quality_raw_metrics={k: math.nan for k in QUALITY_METRIC_KEYS},
            quality_insufficient=True,
            signal_4_basis="not_applicable",
        )

    target_year, target_q = determine_target_quarter(target_date)

    # ---- Signal 5: Quality (annual X + X-1) ----
    annual_x = cache_get_or_fetch_annual(client, corp_code, target_year, api_key=api_key)
    if annual_x.get("status") == "no_data":
        # try fallback one year back
        target_year -= 1
        annual_x = cache_get_or_fetch_annual(client, corp_code, target_year, api_key=api_key)
    annual_x_1 = cache_get_or_fetch_annual(client, corp_code, target_year - 1, api_key=api_key)

    quality_raw, insufficient = compute_quality_score(
        _row_to_financial_dict(annual_x) if annual_x.get("status") == "ok" else None,
        _row_to_financial_dict(annual_x_1) if annual_x_1.get("status") == "ok" else None,
    )

    # ---- Signal 4: Earnings YoY (standalone Q vs prior year same Q) ----
    earnings_raw, signal_4_basis = _compute_signal_4(
        client, corp_code, target_year, target_q, api_key=api_key,
    )

    return DartSignalsResult(
        earnings_raw=earnings_raw,
        quality_raw_metrics=quality_raw,
        quality_insufficient=insufficient,
        signal_4_basis=signal_4_basis,
    )


def _row_to_financial_dict(row: dict) -> dict:
    return {k: row.get(k) for k in FINANCIAL_KEYS}


QUARTER_ORDER = ("Q1", "Q2", "Q3", "Q4")


def _prior_quarter(year: int, q: str) -> tuple[int, str]:
    """One quarter back, possibly crossing year boundary."""
    idx = QUARTER_ORDER.index(q)
    if idx == 0:
        return (year - 1, "Q4")
    return (year, QUARTER_ORDER[idx - 1])


def _compute_signal_4(
    client, corp_code: str, target_year: int, target_q: str, *, api_key: str,
) -> tuple[float, str]:
    """Returns (earnings_raw, basis). basis ∈ {'standalone','cumulative_fallback','not_applicable'}.

    **Blocker 1 fix**: target Q standalone이 not_applicable이면 한 분기 뒤로 fallback (최대 2단계).
    """
    attempts = [(target_year, target_q)]
    yr, q = _prior_quarter(target_year, target_q)
    attempts.append((yr, q))
    yr, q = _prior_quarter(yr, q)
    attempts.append((yr, q))

    for try_year, try_q in attempts:
        target_standalone, basis_t = _standalone_for_quarter(client, corp_code, try_year, try_q, api_key=api_key)
        prior_standalone, basis_p = _standalone_for_quarter(client, corp_code, try_year - 1, try_q, api_key=api_key)
        if target_standalone is None or prior_standalone is None:
            continue
        momentum = compute_yoy_earnings_momentum(target_standalone, prior_standalone)
        if math.isnan(momentum):
            continue
        basis = "cumulative_fallback" if "cumulative_fallback" in (basis_t, basis_p) else "standalone"
        return momentum, basis

    return 0.0, "not_applicable"


def _standalone_for_quarter(
    client, corp_code: str, year: int, target_q: str, *, api_key: str,
) -> tuple[Optional[dict], str]:
    """Return ({revenue, op_income, net_income} standalone, basis).

    basis = 'standalone' on successful subtraction (or Q1 raw).
    basis = 'cumulative_fallback' if subtraction inputs missing — caller may use cumulative raw.
    """
    if target_q == "Q1":
        row = cache_get_or_fetch_quarterly(client, corp_code, year, "Q1", api_key=api_key)
        if row.get("status") != "ok":
            return None, "not_applicable"
        return _row_to_financial_dict(row), "standalone"

    if target_q == "Q2":
        h1 = cache_get_or_fetch_quarterly(client, corp_code, year, "H1", api_key=api_key)
        q1 = cache_get_or_fetch_quarterly(client, corp_code, year, "Q1", api_key=api_key)
        if h1.get("status") == "ok" and q1.get("status") == "ok":
            return compute_standalone_quarter("Q2",
                h1_cumulative=_row_to_financial_dict(h1),
                q1_cumulative=_row_to_financial_dict(q1),
            ), "standalone"
        if h1.get("status") == "ok":
            return _row_to_financial_dict(h1), "cumulative_fallback"
        return None, "not_applicable"

    if target_q == "Q3":
        nine_m = cache_get_or_fetch_quarterly(client, corp_code, year, "9M", api_key=api_key)
        h1 = cache_get_or_fetch_quarterly(client, corp_code, year, "H1", api_key=api_key)
        if nine_m.get("status") == "ok" and h1.get("status") == "ok":
            return compute_standalone_quarter("Q3",
                nine_m_cumulative=_row_to_financial_dict(nine_m),
                h1_cumulative=_row_to_financial_dict(h1),
            ), "standalone"
        if nine_m.get("status") == "ok":
            return _row_to_financial_dict(nine_m), "cumulative_fallback"
        return None, "not_applicable"

    if target_q == "Q4":
        # **Blocker 1**: 2026-05 시드는 (2025, Q4) 사용. annual_2025 - 9M_2025.
        annual = cache_get_or_fetch_annual(client, corp_code, year, api_key=api_key)
        nine_m = cache_get_or_fetch_quarterly(client, corp_code, year, "9M", api_key=api_key)
        if annual.get("status") == "ok" and nine_m.get("status") == "ok":
            return compute_standalone_quarter("Q4",
                annual_cumulative=_row_to_financial_dict(annual),
                nine_m_cumulative=_row_to_financial_dict(nine_m),
            ), "standalone"
        if annual.get("status") == "ok":
            # annual은 있는데 9M이 없는 경우 — annual 자체로 cumulative_fallback (전년 비교 정확도 ↓)
            return _row_to_financial_dict(annual), "cumulative_fallback"
        return None, "not_applicable"

    return None, "not_applicable"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `scripts/.venv/bin/python -m unittest scripts.test_dart_signals -v`
Expected: 33 tests PASS total.

- [ ] **Step 5: Commit**

```bash
git add scripts/dart_signals.py scripts/test_dart_signals.py
git commit -m "feat(T7e.8 follow-up): fetch_dart_signals 통합 + DartSignalsResult dataclass

ticker → corp_code → annual X+X-1 fetch → Signal 5 quality metrics + insufficient flag.
target Q standalone (H1-Q1, 9M-H1) → prior year same Q standalone → Signal 4 YoY.
누락 시 cumulative_fallback로 다운그레이드, 그것도 없으면 not_applicable. fail-soft.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task F2: Quality 5-metric universe-wide z-score → composite 0~100 (pure helper, no deps)

**Files:**
- Modify: `scripts/screen_shortlist_tier0.py`
- Modify: `scripts/test_screen_shortlist_tier0.py`

- [ ] **Step 1: Write failing test (universe-wide z-score normalization for quality composite)**

Append a new test class to `scripts/test_screen_shortlist_tier0.py`:

```python
class TestQualityCompositeNormalization(unittest.TestCase):
    def test_quality_composite_zscore_averages_metrics(self):
        """compute_quality_composite_for_universe takes list of metrics dicts and returns
        per-ticker composite score 0~100 = average of normalized 5 metrics, skipping NaN."""
        from scripts.screen_shortlist_tier0 import compute_quality_composite_for_universe
        metrics_per_ticker = [
            {"roe": 0.10, "debt_ratio_inv": -0.5, "op_margin": 0.10, "revenue_growth": 0.05, "interest_coverage": 5.0},
            {"roe": 0.20, "debt_ratio_inv": -0.3, "op_margin": 0.15, "revenue_growth": 0.20, "interest_coverage": 10.0},
            {"roe": 0.15, "debt_ratio_inv": -0.4, "op_margin": float("nan"), "revenue_growth": float("nan"), "interest_coverage": float("nan")},
        ]
        composites = compute_quality_composite_for_universe(metrics_per_ticker)
        self.assertEqual(len(composites), 3)
        self.assertGreater(composites[1], composites[0])
        for c in composites:
            self.assertGreaterEqual(c, 0.0)
            self.assertLessEqual(c, 100.0)

    def test_quality_composite_all_nan_returns_zero(self):
        from scripts.screen_shortlist_tier0 import compute_quality_composite_for_universe
        metrics_per_ticker = [
            {k: float("nan") for k in ("roe", "debt_ratio_inv", "op_margin", "revenue_growth", "interest_coverage")},
        ]
        composites = compute_quality_composite_for_universe(metrics_per_ticker)
        self.assertEqual(composites[0], 0.0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `scripts/.venv/bin/python -m unittest scripts.test_screen_shortlist_tier0 -v`
Expected: 2 new failures.

- [ ] **Step 3: Add implementation to `screen_shortlist_tier0.py`**

Add this function near `z_normalize_to_0_100`:

```python
def compute_quality_composite_for_universe(metrics_per_ticker: list[dict]) -> list[float]:
    """Universe-wide z-score normalize 5 quality metrics per ticker → 0~100 composite.

    metrics_per_ticker: list of dicts {roe, debt_ratio_inv, op_margin, revenue_growth, interest_coverage}.
    Returns list of composite scores in same order. NaN metrics excluded from that metric's z-score
    AND from per-ticker average. All-NaN ticker → composite=0.0.
    """
    keys = ("roe", "debt_ratio_inv", "op_margin", "revenue_growth", "interest_coverage")
    n = len(metrics_per_ticker)
    normalized: list[list[float]] = [[] for _ in range(n)]

    for k in keys:
        values = [(i, m.get(k)) for i, m in enumerate(metrics_per_ticker)
                  if m.get(k) is not None and not math.isnan(m.get(k))]
        if not values:
            continue
        vals = [v for _, v in values]
        mean = sum(vals) / len(vals)
        var = sum((v - mean) ** 2 for v in vals) / len(vals)
        stdev = math.sqrt(var) if var > 0 else 1.0
        for i, v in values:
            z = (v - mean) / stdev
            score = 50.0 + 50.0 * math.tanh(z / 2)  # tanh clamp ≈ z ±3 → 0~100
            normalized[i].append(score)

    return [
        (sum(scores) / len(scores)) if scores else 0.0
        for scores in normalized
    ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `scripts/.venv/bin/python -m unittest scripts.test_screen_shortlist_tier0 -v`
Expected: all PASS (2 new + existing).

- [ ] **Step 5: Commit**

```bash
git add scripts/screen_shortlist_tier0.py scripts/test_screen_shortlist_tier0.py
git commit -m "feat(T7e.8 follow-up): quality composite = z-score normalize 5 metrics universe-wide

각 지표(ROE/부채비율/영업이익률/매출성장률/이자보상배율)를 universe 전체에 대해 z-score → 0~100 tanh clamp.
NaN 자동 제외. 5 metric 모두 NaN인 ticker → composite=0. 2 unittest.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task F3: `screen_shortlist_tier0.py` wire — Signal 4·5 hook 위임 + StockSignal·CSV diagnostic 분리

**Files:**
- Modify: `scripts/screen_shortlist_tier0.py`
- Modify: `scripts/test_screen_shortlist_tier0.py`

**중요 (Blocker 3·4 fix)**:
- 실제 dataclass는 `StockSignal` (line 172) + `ShortListRow` (line 194). `ScoreVec`은 plan 작성 오류로 존재하지 않음.
- `row_to_db_dict()`는 CSV write(`write_csv`)와 Supabase upsert(`upsert_supabase`)에 **공용** 사용 중. CSV용 진단 컬럼을 그대로 섞으면 production `short_list_30` UPSERT가 컬럼 mismatch로 실패. → `row_to_csv_dict()`를 분리 신설.

- [ ] **Step 1: Investigation grep**

```bash
grep -n "class StockSignal\|class ShortListRow\|def row_to_db_dict\|def write_csv\|def upsert_supabase\|def fetch_dart_signals\|def main\b" scripts/screen_shortlist_tier0.py
```
Confirm 6 edit sites: dataclass StockSignal · dataclass ShortListRow · row_to_db_dict · write_csv · fetch_dart_signals hook · main loop.

- [ ] **Step 2: Replace `fetch_dart_signals()` hook to delegate**

Find existing `def fetch_dart_signals(ticker: str, dart_api_key: Optional[str]) -> tuple[float, float]:` (~line 390) and replace with:

```python
def fetch_dart_signals(
    ticker: str,
    dart_key: Optional[str],
    target_date: date,
    supabase_client=None,
) -> tuple[float, dict, str, bool]:
    """Returns (earnings_raw, quality_metrics_dict, signal_4_basis, quality_insufficient).

    spec: docs/superpowers/specs/2026-05-12-tier0-dart-signals-design.md

    Earlier hook returned (earnings, quality) floats with quality=0 평탄화.
    New tuple ships 5-metric raw dict back so main() can universe-wide z-score
    via compute_quality_composite_for_universe (Task F2). signal_4_basis +
    quality_insufficient are logged to CSV diagnostic columns (Task F3 Step 4).
    """
    if not dart_key or supabase_client is None:
        return 0.0, {}, "not_applicable", True

    from scripts.dart_signals import fetch_dart_signals as _dart_fetch
    result = _dart_fetch(
        supabase_client,
        ticker=ticker,
        target_date=target_date,
        api_key=dart_key,
    )
    return (
        result.earnings_raw,
        result.quality_raw_metrics,
        result.signal_4_basis,
        result.quality_insufficient,
    )
```

- [ ] **Step 3: Extend `StockSignal` dataclass with 3 new fields**

Find `class StockSignal` (~line 172) and add fields (use `field(default_factory=dict)` for dict default):

```python
from dataclasses import field   # ensure imported at top

@dataclass
class StockSignal:
    # ... existing fields (ticker, name, sector, momentum_raw, ... quality, ...) ...
    quality_metrics: dict = field(default_factory=dict)
    signal_4_basis: str = "not_applicable"
    quality_insufficient: bool = False
```

- [ ] **Step 4: Extend `ShortListRow` + add `row_to_csv_dict()` (Blocker 4 fix)**

Add fields to `ShortListRow` (~line 194):

```python
@dataclass
class ShortListRow:
    # ... existing fields ...
    signal_4_basis: str = "not_applicable"
    quality_insufficient: bool = False
```

Keep `row_to_db_dict()` **unchanged** (production DB schema unchanged — `short_list_30` doesn't have these diagnostic columns). Add a new function below it:

```python
def row_to_csv_dict(row: ShortListRow) -> dict:
    """CSV payload = DB columns + diagnostic columns (signal_4_basis, quality_insufficient).
    Used by write_csv ONLY. Do NOT pass to Supabase upsert — short_list_30 lacks these cols.
    """
    base = row_to_db_dict(row)
    base["signal_4_basis"] = row.signal_4_basis
    base["quality_insufficient"] = row.quality_insufficient
    return base
```

- [ ] **Step 5: Update `write_csv()` to use `row_to_csv_dict()`**

```python
def write_csv(path: str, rows: list[ShortListRow]) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(row_to_csv_dict(rows[0]).keys()) if rows else [])
        writer.writeheader()
        for r in rows:
            writer.writerow(row_to_csv_dict(r))
```

`upsert_supabase()` keeps using `row_to_db_dict(r)` unchanged — payload matches existing production schema exactly.

- [ ] **Step 6: Update `main()` to wire DART + universe-wide quality composite**

In `main()`:
1. After loading env, construct supabase client when `dart_key` present:
   ```python
   supabase_client = None
   if dart_key:
       try:
           from scripts.dart_signals import _supabase_client_or_none  # or inline create_client
           supabase_client = get_supabase_client()  # existing helper at line 155
       except Exception as exc:
           print(f"[warn] DART 키는 있지만 Supabase client 초기화 실패: {exc}")
   ```
2. Change call site `earnings, quality = fetch_dart_signals(u["ticker"], dart_key)` to:
   ```python
   earnings, q_metrics, sig4_basis, q_insuff = fetch_dart_signals(
       u["ticker"], dart_key, target_date, supabase_client,
   )
   ```
3. After universe iteration completes, compute quality composite for entire universe before z-score loop:
   ```python
   composites = compute_quality_composite_for_universe([s.quality_metrics for s in signals])
   for s, comp in zip(signals, composites):
       s.quality_raw = comp  # universe-wide normalized 0~100 (replaces 평탄화)
   ```
4. Propagate `s.signal_4_basis` and `s.quality_insufficient` into `ShortListRow` when calling `build_rows()` (find that call site and ensure these flow through).

- [ ] **Step 7: Update existing screening tests to expect new tuple signature**

Run: `scripts/.venv/bin/python -m unittest scripts.test_screen_shortlist_tier0 -v`

If any existing test calls `fetch_dart_signals(ticker, None)` and unpacks 2-tuple, update to 4-tuple. The `dart_key=None` short-circuit path returns `(0.0, {}, "not_applicable", True)` — same earnings=0/quality=0 semantics.

- [ ] **Step 8: Smoke test (Blocker 5 fix — universe-limit 100, expect 30 rows)**

`validate_shortlist_rows()` requires exactly 30 rows (10/10/10). Universe of 5 would fail validation. Use `--universe-limit 100` for smoke:

```bash
cd /Users/yong/New_Project_KR_Stock
set -a && eval "$(grep -E '^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|KRX_ID|KRX_PW|DART_API_KEY)=' tudal/.env.local)" && set +a
SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" scripts/.venv/bin/python scripts/screen_shortlist_tier0.py \
  --month 2026-05-01 --as-of 2026-05-12 --dry-run \
  --universe-limit 100 --csv-backup scripts/out/smoke_100.csv
```

Expected: 100 tickers processed (~500 DART HTTP hits with cache cold), `smoke_100.csv` has **30 rows** (10/10/10) with new columns `signal_4_basis` + `quality_insufficient` populated. Run completes ~2~5 minutes (cache cold).

- [ ] **Step 9: Commit**

```bash
git add scripts/screen_shortlist_tier0.py scripts/test_screen_shortlist_tier0.py
git commit -m "feat(T7e.8 follow-up): screen_shortlist_tier0 delegates Signal 4·5 to dart_signals

Hook이 (0,0) 반환하던 자리를 dart_signals.fetch_dart_signals 위임으로 교체.
StockSignal에 quality_metrics + signal_4_basis + quality_insufficient 부착.
ShortListRow + row_to_csv_dict 신규로 CSV 진단 컬럼과 DB upsert payload 분리 (Blocker 4).
universe-wide quality composite를 z-score 후 quality_raw로 주입. dart_key 부재 시 (0,{},'not_applicable',True) 안전 분기.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase G: Production dry-run + apply

### Task G1: Dry-run `--month 2026-05-01` 풀 universe + CSV preview

**Files:**
- (no code changes)

- [ ] **Step 1: Run dry-run**

```bash
cd /Users/yong/New_Project_KR_Stock
set -a && eval "$(grep -E '^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|KRX_ID|KRX_PW|DART_API_KEY)=' tudal/.env.local)" && set +a
SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" scripts/.venv/bin/python scripts/screen_shortlist_tier0.py \
  --month 2026-05-01 --dry-run --csv-backup scripts/out/short_list_30_2026-05_dart.csv 2>&1 | tee scripts/out/dryrun_2026-05.log
```

Expected: Run completes (~15-20 min). Log shows DART HTTP traces. CSV has 30 rows.

- [ ] **Step 2: Inspect CSV with Python**

```bash
scripts/.venv/bin/python -c "
import csv
from collections import Counter
with open('scripts/out/short_list_30_2026-05_dart.csv') as f:
    rows = list(csv.DictReader(f))
print('total:', len(rows))
print('bucket:', Counter(r['bucket'] for r in rows))
print('signal_4_basis:', Counter(r.get('signal_4_basis','-') for r in rows))
print('quality_insufficient:', Counter(r.get('quality_insufficient','-') for r in rows))
print()
for b in ['short','mid','long']:
    print(f'[{b}]')
    for r in [r for r in rows if r['bucket']==b][:5]:
        print(f\"  #{r['rank']} {r['ticker']} {r['name']} composite={r['composite_score']} signal={r['signal_label']} basis={r.get('signal_4_basis','-')}\")
    print()
"
```

Expected: 10/10/10 split. Long bucket spread should be > 0.5 (vs prior 0.16). Mid bucket also more differentiated.

- [ ] **Step 3: Verify Supabase cache populated**

```sql
select count(*) from dart_financial_cache;
select status, count(*) from dart_financial_cache group by status;
select statement_scope, count(*) from dart_financial_cache group by statement_scope;
select calculation_basis, count(*) from dart_financial_cache group by calculation_basis;
```

Expected: `count(*)` ≈ 4× universe (annual_X + annual_X-1 + 2 quarters per ticker). status=ok dominant, no_data minority. statement_scope=CFS dominant. calculation_basis 4종 분포.

- [ ] **Step 4: No commit (dry-run only)**

---

### Task G2: User approval gate

**Files:**
- (no changes)

- [ ] **Step 1: Show user the preview**

Present:
- CSV summary from G1 step 2
- Long bucket spread comparison: 이전 (composite 55.4~55.9) vs 새로 (예: 30~85)
- Top 3 종목 change list

- [ ] **Step 2: Wait for explicit "OK, --apply" approval from user**

Do not proceed without explicit user OK. If user requests adjustments (e.g., metric weights), iterate before --apply.

---

### Task G3: `--apply` to production + verify

**Files:**
- (no code changes; production data update)

- [ ] **Step 1: Apply**

```bash
SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" scripts/.venv/bin/python scripts/screen_shortlist_tier0.py \
  --month 2026-05-01 --apply --csv-backup scripts/out/short_list_30_2026-05_dart_apply.csv 2>&1 | tee scripts/out/apply_2026-05.log
```

Expected: `done: 30 rows upserted`.

- [ ] **Step 2: Verify Supabase**

```sql
select bucket, count(*) from short_list_30 where month='2026-05-01' group by bucket;
```
Expected: long 10, mid 10, short 10.

```sql
select bucket, rank, ticker, name, sector, composite_score, signal_label, delta_status
from short_list_30 where month='2026-05-01' order by bucket, rank;
```
Expected: long bucket top names differ from prior seed (실 우량주가 위로 올라옴). Composite spread > 0.5.

```sql
select bucket,
       round(max(composite_score::numeric) - min(composite_score::numeric), 2) as spread
from short_list_30 where month='2026-05-01' group by bucket;
```
Expected: long spread > 0.5, mid spread > 5, short spread > 5.

- [ ] **Step 3: `/admin` 홈 육안 확인 (선택)**

```bash
cd tudal && npm run dev
```

Open `http://localhost:3000/admin` and verify long/mid/short bucket cards show real Korean company names.

- [ ] **Step 4: No log commit (Major 3 fix) — summary만 문서에 박제**

`scripts/out/apply_2026-05.log`에는 KRX 로그인 ID·DART 응답·실행환경 등 민감 정보가 들어갈 수 있어 **commit 금지**. 대신 다음 summary를 §H1 단계에서 HANDOFF.md / S7-RealData.md에 박제:

- Apply 완료 시각 (UTC)
- 30 rows · long/mid/short composite spread (이전 0.16 vs 새 spread)
- DART 호출 총 횟수 (cache miss vs hit)
- `account_alias_used` ticker 수 + `cumulative_fallback` ticker 수 (D12·D16 신뢰도 메타)
- `quality_insufficient=true` ticker 수
- 다음 시드 시 cache hit 예상량

로컬 log 파일은 그대로 두고 `.gitignore`에 `scripts/out/*.log` 추가를 고려.

---

## Phase H: Documentation 박제

### Task H1: HANDOFF.md + S7-RealData.md 갱신

**Files:**
- Modify: `Document/Process/HANDOFF.md`
- Modify: `Document/Build/Slices/S7-RealData.md`

- [ ] **Step 1: Update HANDOFF.md §1 상태표**

Find the row for "S7e Supabase 실 I/O" and update to reflect T7e.8 follow-up done. Replace "Tier 0 실 시드 venv 대기" with "Tier 0 시드 + DART Signal 4·5 적용". Update "실데이터 Must" count.

Then update §2.A from "다음 1순위" to a "완료" section, with the new 1순위 being §2.B (T7e.7 RLS QA) — and add S7a Anthropic AI 키 발급으로 옵션 B 진입 안내.

- [ ] **Step 2: Update HANDOFF.md §6 최근 완료 요약**

Add at top:

```markdown
- **43차 T7e.8 follow-up DART Signal 4·5 실 구현**: 마이그 0013 `dart_corp_codes` + 0014 `dart_financial_cache` 적용. `scripts/seed_dart_corp_codes.py` 1회 실행으로 ~6,000 상장사 corp_code 박제. `scripts/dart_signals.py` 신규 (parse + cache_get_or_fetch + compute_quality_score + compute_standalone_quarter + compute_yoy_earnings_momentum + fetch_dart_signals 통합). `screen_shortlist_tier0.py` Signal 4·5 hook을 새 모듈에 위임. CFS 우선/OFS fallback (D6) + 분기 누적 차분 단독값 환산 (D7) + calculation_basis 추적 (D12) + 5지표 누락 ≠ no_data 분리 (D8 Fix 1). Python unittest 33케이스. 2026-05-01 시드 재적용으로 long bucket composite spread 회복.
```

- [ ] **Step 3: Update S7-RealData.md T7e.8 row**

Add follow-up row showing T7e.8 follow-up done with link to spec + plan.

- [ ] **Step 4: Commit doc updates**

```bash
git add Document/Process/HANDOFF.md Document/Build/Slices/S7-RealData.md
git commit -m "docs(T7e.8 follow-up): 43차 — DART Signal 4·5 실 구현 박제

마이그 0013·0014 + dart_signals.py + screen_shortlist_tier0.py wire 완료.
2026-05-01 시드 재적용 (long bucket spread 회복). 다음 1순위 = T7e.7 RLS QA
또는 S7a Anthropic AI 키 발급 후 Tier 1·2 plug-in.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (executor checklist)

After all tasks complete, the executor should verify:

**Spec coverage** (D1~D16 → task mapping):
- D1 (corp_code mapping in Supabase) → Task A1, B1, B2, B3
- D2 (Signal 4 = YoY rev + OP avg) → Task D2
- D3 (Signal 5 = 5 standard metrics) → Task C2, F2
- D4 (caching in dart_financial_cache) → Task A2, E2
- D5 (RLS service_role + admin) → Task A1, A2
- D6 (CFS preferred, OFS fallback) → Task E1
- D7 (standalone quarter via cumulative diff) → Task D1, F1
- D8 (cache status vs Signal failure separation, Fix 1) → Task A2, C2, F1
- D9 (Python unittest, Vitest 0) → All tasks
- D10 (dry-run → user approval → apply) → Task G1, G2, G3
- D11 (full universe DART call) → Task G1 (no pre-filter)
- D12 (calculation_basis tracking) → Task A2, E2, F1
- D13 (corp_cls Y/K/N mapping) → Task B1
- **D14 (target quarter — disclosure deadline + 30일 grace, Blocker 1 fix)** → Task D2, F1
- **D15 (quarterly not_yet_disclosed + 7일 TTL, Blocker 2 fix)** → Task A2, E2
- **D16 (DART account alias 매핑, Major 1 fix)** → Task C1, E1

**Test count target**: ~40 unittests
- parse_dart_financial_response: 4 (incl. alias)
- compute_quality_score: 6
- compute_standalone_quarter: 6
- compute_yoy_earnings_momentum: 4
- determine_target_quarter: 6 (Blocker 1 reflecting disclosure deadline)
- fetch_financial_with_fallback: 3 (3-tuple)
- cache layer: 8 (Blocker 2 추가 — not_yet_disclosed / no_data / TTL refresh / Q1 standalone / 9M not_applicable)
- fetch_dart_signals integration: 1
- compute_quality_composite_for_universe: 2

**Blocker fix 검증** (구현 후 grep으로 확인):
- B1: `grep "Q4" scripts/dart_signals.py` → determine_target_quarter + _standalone_for_quarter("Q4", ...)
- B2: `grep "not_yet_disclosed\|_is_within_disclosure_window\|_is_ttl_stale" scripts/dart_signals.py` → 3개 위치
- B3: `grep -c "ScoreVec" docs/superpowers/plans/2026-05-12-tier0-dart-signals.md` → 0 expected (모두 StockSignal로 교체됨)
- B4: `grep "row_to_csv_dict" scripts/screen_shortlist_tier0.py` → write_csv에서 사용, upsert_supabase는 row_to_db_dict 유지
- B5: `grep "universe-limit 100" docs/superpowers/plans/...` → smoke test에 100 사용
- B6: spec `Expected: 17 columns` 매칭
- M1: `grep "DART_ACCOUNT_ALIASES\|account_alias_used" scripts/dart_signals.py`
- M2: probe ticker '247540' 또는 사용자 검토한 active KOSDAQ
- M3: scripts/out/apply log commit 단계 제거됨

**Verification commands** (run as final gate):
```bash
scripts/.venv/bin/python -m unittest scripts.test_seed_dart_corp_codes scripts.test_dart_signals scripts.test_screen_shortlist_tier0 -v
```
Expected: all PASS.

```bash
cd tudal && npm run build && npm run lint && npm run test:ci
```
Expected: no regression (TS test count unchanged from 384).
