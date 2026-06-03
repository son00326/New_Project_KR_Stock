#!/usr/bin/env python3
"""KRX 공식 Open API client — Tier 0 스크리닝 가격·거래량·universe 소스.

KRX 공식 Open API 전환 (`screen_shortlist_tier0.py` 지원). pykrx per-ticker 루프 →
KRX 공식 API 날짜별 전종목 1콜로 구조 역전. 외국인(S3)은 pykrx KEEP, DART(S4/S5) KEEP.

엔드포인트
----------
- `sto/stk_bydd_trd` / `sto/ksq_bydd_trd` : 코스피/코스닥 일별 전종목 시세
- `sto/stk_isu_base_info` / `sto/ksq_isu_base_info` : 코스피/코스닥 종목 기본정보(보통주 판별)

환경 변수
---------
- `KRX_OPENAPI_KEY` — KRX 공식 Open API 인증키 (`AUTH_KEY` 헤더). **평문 커밋 금지** —
  키를 로그·에러·CSV·테스트 픽스처에 절대 노출하지 않는다.

결정
----
- 빈 `OutBlock_1` (또는 키 부재) → `[]`. 주말/휴장/미갱신은 정상 케이스.
- 429/5xx만 지수 backoff 재시도. 4xx(401 등)는 즉시 raise — 키 문제를 숨기지 않는다.
- `_sleep` 주입으로 retry 테스트를 빠르게 한다.
"""

import os
import sys
import time

import requests


# ============================================================================
# Constants
# ============================================================================

KRX_GATEWAY = "https://data-dbg.krx.co.kr/svc/apis/"

EP_STK_BYDD = "sto/stk_bydd_trd"
EP_KSQ_BYDD = "sto/ksq_bydd_trd"
EP_STK_BASE = "sto/stk_isu_base_info"
EP_KSQ_BASE = "sto/ksq_isu_base_info"

MARKET_TO_BYDD = {"KOSPI": EP_STK_BYDD, "KOSDAQ": EP_KSQ_BYDD}
MARKET_TO_BASE = {"KOSPI": EP_STK_BASE, "KOSDAQ": EP_KSQ_BASE}

DEFAULT_TIMEOUT = 30
MAX_RETRIES = 4
BACKOFF_BASE_SEC = 1.5

_RETRYABLE_STATUS = (429, 500, 502, 503, 504)


# ============================================================================
# Auth
# ============================================================================

def _get_auth_key() -> str:
    """`KRX_OPENAPI_KEY` env → AUTH_KEY. 미설정 시 친절 메시지 후 종료.

    키 값은 절대 로그/에러 메시지에 출력하지 않는다.
    """
    key = os.environ.get("KRX_OPENAPI_KEY")
    if not key:
        sys.exit(
            "KRX_OPENAPI_KEY 환경변수가 설정되지 않았습니다. "
            "KRX 공식 Open API 인증키를 발급받아 KRX_OPENAPI_KEY로 설정한 뒤 재실행하세요 "
            "(평문 커밋 금지)."
        )
    return key


# ============================================================================
# HTTP
# ============================================================================

def _extract_outblock_1(resp, endpoint) -> list[dict]:
    """Return `OutBlock_1` rows from a 200 response.

    Missing/empty `OutBlock_1` is a normal KRX case for holidays or not-yet-updated
    basDd and returns `[]`. Malformed JSON or a non-list block is not silently
    accepted because downstream code depends on `list[dict]` rows.
    """
    try:
        payload = resp.json()
    except ValueError as exc:
        raise RuntimeError(f"KRX API JSON 파싱 실패 (endpoint={endpoint})") from exc

    if not isinstance(payload, dict):
        raise RuntimeError(f"KRX API 응답 형식 오류: object가 아닙니다 (endpoint={endpoint})")

    rows = payload.get("OutBlock_1") or []
    if not isinstance(rows, list):
        raise RuntimeError(f"KRX API 응답 형식 오류: OutBlock_1이 list가 아닙니다 (endpoint={endpoint})")
    if any(not isinstance(row, dict) for row in rows):
        raise RuntimeError(f"KRX API 응답 형식 오류: OutBlock_1 row가 object가 아닙니다 (endpoint={endpoint})")
    return rows


def _sleep_before_retry(attempt, _sleep) -> None:
    """Sleep only when another retry attempt remains."""
    if attempt < MAX_RETRIES - 1:
        _sleep(BACKOFF_BASE_SEC * (2 ** attempt))


def _krx_get(endpoint, params, *, timeout=DEFAULT_TIMEOUT, _sleep=time.sleep) -> list[dict]:
    """KRX 공식 API GET → `OutBlock_1` 리스트.

    - 200: `OutBlock_1` (없으면 []) 반환.
    - 429/5xx: 지수 backoff 후 재시도 (`MAX_RETRIES`회).
    - 4xx(401 등): 즉시 raise — 키 문제를 숨기지 않는다.
    - 모든 재시도 소진 시 RuntimeError.
    """
    headers = {"AUTH_KEY": _get_auth_key()}
    url = KRX_GATEWAY + endpoint
    last_exc: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=timeout)
        except requests.RequestException as exc:
            # 네트워크/타임아웃 등 일시 오류 → backoff 재시도.
            last_exc = exc
            _sleep_before_retry(attempt, _sleep)
            continue

        if resp.status_code == 200:
            return _extract_outblock_1(resp, endpoint)
        if resp.status_code in _RETRYABLE_STATUS:
            last_exc = RuntimeError(f"KRX API 일시 오류 status={resp.status_code}")
            _sleep_before_retry(attempt, _sleep)
            continue
        # 4xx 등 비재시도 → 즉시 raise (키/요청 문제 노출, _sleep 0회).
        resp.raise_for_status()
        # raise_for_status가 raise하지 않는 비정상 케이스 방어.
        return _extract_outblock_1(resp, endpoint)

    raise RuntimeError(f"KRX API 호출이 {MAX_RETRIES}회 재시도 후 실패했습니다 (endpoint={endpoint}): {last_exc}")


# ============================================================================
# Parsing
# ============================================================================

def _to_float(s) -> float:
    """KRX 문자열 숫자(콤마 포함) → float. None/빈값/'-'/'N/A' → 0.0."""
    if s is None:
        return 0.0
    s = str(s).strip().replace(",", "")
    if s in ("", "-", "N/A"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


# ============================================================================
# Fetch
# ============================================================================

def fetch_bydd_trd(market, bas_dd, *, _fetch=_krx_get) -> list[dict]:
    """일별 전종목 시세 rows. 빈 영업일 → [].

    row 예: {ISU_CD, ISU_NM, MKT_NM, TDD_CLSPRC, ACC_TRDVOL, MKTCAP, LIST_SHRS, ...}
    """
    return _fetch(MARKET_TO_BYDD[market], {"basDd": bas_dd})


def fetch_isu_base(market, bas_dd, *, _fetch=_krx_get) -> dict[str, dict]:
    """종목 기본정보 → {ISU_SRT_CD(6자리): row}. ISU_SRT_CD 없는 row는 제외."""
    rows = _fetch(MARKET_TO_BASE[market], {"basDd": bas_dd})
    return {r["ISU_SRT_CD"]: r for r in rows if r.get("ISU_SRT_CD")}


def is_common_stock(base_row) -> bool:
    """KRX 기본정보 row → 보통주 + 주권 여부. base_row None → False."""
    if not base_row:
        return False
    kind = (base_row.get("KIND_STKCERT_TP_NM") or "").strip()
    secugrp = (base_row.get("SECUGRP_NM") or "").strip()
    return kind == "보통주" and secugrp == "주권"
