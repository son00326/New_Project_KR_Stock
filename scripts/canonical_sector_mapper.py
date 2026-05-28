#!/usr/bin/env python3
"""
주픽(JooPick) — canonical 14 sector mapper (B66 C 하이브리드).
========================================================

목적
----
short_list_30.sector를 placeholder("코스피"/"코스닥")에서 canonical 14로 전환하기 위한
deterministic mapper.

플로우 (plan §5.3 priority):
    final_sector = override.json[ticker]            # 1순위
                else longest-prefix KSIC mapper     # 2순위
                else "unresolved"                   # B89 strict block

박제
----
- plan SoT: `docs/superpowers/plans/2026-05-28-task5-b66-c-hybrid-sector-mapper.md`
- canonical 14 SoT: `tudal/src/lib/screening/canonical-sectors.ts::CANONICAL_SECTORS`
  (cross-language drift는 TS Vitest drift test가 본 모듈을 읽어 검증)
- KSIC: 한국표준산업분류 (DART `company.json` 응답의 `induty_code` field).
  실측 자리수는 3~5자리 혼재 — `^[0-9]{3,5}$` 정규화 후 longest-prefix.

설계 원칙 (PR #55 R1 lock-in)
-----------------------------
1. **Deterministic**: 동일 입력 → 동일 출력. 외부 state / I/O 없음.
2. **No ticker/name string parsing**: ticker 이름으로 추정 금지. ticker-level 보정은 override.json만.
3. **Longest-prefix**: 5자리 → 4자리 → 3자리 → 2자리 순서로 첫 매칭. 2자리는 broad fallback.
4. **Override 최소화**: mapper rule이 맞히는 ticker는 override 금지 (regression fixture로만 사용).
5. **Unresolved strict block**: mapper unresolved + override 없으면 unresolved 반환.
   호출자(screen_shortlist_tier0.py)가 --apply를 거부.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Optional


# ============================================================================
# Canonical 14 sectors — must stay in 1:1 sync with TS SoT
# (tudal/src/lib/screening/canonical-sectors.ts::CANONICAL_SECTORS)
# ============================================================================

CANONICAL_SECTORS: tuple[str, ...] = (
    "바이오",
    "반도체",
    "건설",
    "금융",
    "2차전지",
    "자동차",
    "IT/SW",
    "유통/소비재",
    "에너지",
    "엔터/미디어",
    "통신",
    "철강/소재",
    "운송/물류",
    "보험/증권",
)
"""canonical 14 sector enum. TS SoT와 1:1 정합 — drift test가 본 tuple을 읽어 검증."""


UNRESOLVED: str = "unresolved"
"""mapper + override 모두 매칭 실패 시 반환. B89 R1 lock-in: screen --apply가 unresolved 1+ 시 거부."""


# ============================================================================
# Induty code normalization
# ============================================================================

INDUTY_CODE_RE: re.Pattern = re.compile(r"^[0-9]{3,5}$")
"""DART company.json `induty_code` 정규화 contract. 실측 3~5자리 혼재 (PR #55 R1 evidence)."""


def normalize_induty(raw: Optional[str]) -> Optional[str]:
    """Trim + validate. 정합 안 되면 None.

    >>> normalize_induty("264")
    '264'
    >>> normalize_induty(" 70113 ")
    '70113'
    >>> normalize_induty("ABC") is None
    True
    >>> normalize_induty(None) is None
    True
    """
    if raw is None:
        return None
    s = raw.strip()
    if not INDUTY_CODE_RE.fullmatch(s):
        return None
    return s


# ============================================================================
# KSIC longest-prefix mapping table
# ============================================================================

# (prefix, canonical_sector_or_UNRESOLVED)
# prefix는 numeric string. longest-prefix match — 가장 긴 prefix가 먼저 매칭.
# UNRESOLVED 명시 = "이 prefix는 mapper가 결정 안 함, override 필수" 의미.
# plan §4.1 R1 fixed draft 정합.
_PREFIX_RULES: tuple[tuple[str, str], ...] = (
    # 5-digit / 4-digit / 3-digit specific 우선
    # 2차전지 일차전지·축전지 (KSIC 282/2820/28202)
    ("28202", "2차전지"),
    ("2820", "2차전지"),
    ("282", "2차전지"),
    # 반도체 — 261/2611/2612 등 전자부품 코어
    ("261", "반도체"),
    ("2611", "반도체"),
    ("2612", "반도체"),
    ("262", "반도체"),
    ("2629", "반도체"),
    # 통신·방송 장비 broad (264) — 통신 기본값. 가전 복합은 override.
    ("264", "통신"),
    # 자동차 부품·차체·특장 (29x 일부)
    ("291", "자동차"),
    ("303", "자동차"),
    ("304", "자동차"),
    # SW 개발·정보서비스 (KSIC 582/620/631)
    ("582", "IT/SW"),
    ("620", "IT/SW"),
    ("631", "IT/SW"),
    # 자연과학·공학 R&D — unresolved (제약/바이오는 override-required, 일반 R&D는 IT/SW 등 override)
    ("701", UNRESOLVED),
    ("7011", UNRESOLVED),
    ("70113", UNRESOLVED),
    # 26 기타 (반도체 기본값, 통신/가전 복합은 위 264 또는 override)
    ("26", "반도체"),
    # 27 의료/정밀/광학 (바이오 기본값, 산업장비는 override)
    ("27", "바이오"),
    # 28 기타 전기장비 — 에너지 기본값 (2차전지 282는 위에서 catch)
    ("281", "에너지"),
    ("283", "에너지"),
    ("284", "에너지"),
    ("285", "에너지"),
    ("289", "에너지"),
    # 29 기타 기계 — unresolved (반도체 장비/특수 장비 boundary 큼)
    ("29", UNRESOLVED),
    # 58 출판·게임·콘텐츠 (582 위에서 IT/SW catch / 58 일반은 엔터/미디어)
    ("58", "엔터/미디어"),
    # 69~75 전문/과학/기술 서비스 — unresolved 기본값 (광고/지주/R&D 혼재)
    ("69", UNRESOLVED),
    ("70", UNRESOLVED),
    ("71", UNRESOLVED),
    ("72", UNRESOLVED),
    ("73", UNRESOLVED),
    ("74", UNRESOLVED),
    ("75", UNRESOLVED),
    # 2-digit broad rules (last fallback)
    ("01", UNRESOLVED),  # 농업
    ("02", UNRESOLVED),  # 임업
    ("03", UNRESOLVED),  # 어업
    ("05", "에너지"),    # 광업
    ("06", "에너지"),
    ("07", "에너지"),
    ("08", "에너지"),
    ("09", "에너지"),
    ("10", "유통/소비재"),  # 식품
    ("11", "유통/소비재"),  # 음료
    ("12", "유통/소비재"),  # 담배
    ("13", "유통/소비재"),  # 섬유
    ("14", "유통/소비재"),  # 의복
    ("15", "유통/소비재"),  # 가죽
    ("16", "철강/소재"),    # 목재
    ("17", "철강/소재"),    # 펄프/종이
    ("18", "엔터/미디어"),  # 인쇄/출판
    ("19", "에너지"),       # 코크스/석유 정제
    ("20", "철강/소재"),    # 화학
    ("21", "바이오"),       # 의약품
    ("22", "철강/소재"),    # 고무/플라스틱
    ("23", "건설"),         # 비금속 광물
    ("24", "철강/소재"),    # 1차 금속
    ("25", "철강/소재"),    # 금속가공
    ("30", "자동차"),       # 자동차/트레일러
    ("31", "운송/물류"),    # 기타 운송장비 (선박/철도/항공)
    ("32", "유통/소비재"),  # 가구
    ("33", "유통/소비재"),  # 기타 제품
    ("35", "에너지"),       # 전기/가스/증기
    ("36", "에너지"),       # 수도/하수/폐기물
    ("41", "건설"),
    ("42", "건설"),
    ("45", "유통/소비재"),
    ("46", "유통/소비재"),
    ("47", "유통/소비재"),
    ("49", "운송/물류"),    # 육상운송
    ("50", "운송/물류"),    # 수상운송 (해운)
    ("51", "운송/물류"),    # 항공운송
    ("52", "운송/물류"),    # 창고/운송지원
    ("55", "유통/소비재"),  # 숙박
    ("56", "유통/소비재"),  # 음식점
    ("59", "엔터/미디어"),  # 영상/오디오
    ("60", "엔터/미디어"),  # 방송
    ("61", "통신"),
    ("62", "IT/SW"),        # 컴퓨터 SW
    ("63", "IT/SW"),        # IT 서비스
    ("64", "금융"),
    ("65", "보험/증권"),
    ("66", "보험/증권"),
    ("68", "건설"),         # 부동산
    ("85", "IT/SW"),        # 교육
    ("86", "바이오"),       # 보건
    ("90", "엔터/미디어"),  # 창작/예술/여가
)


def _mapper_lookup(induty_code: str) -> Optional[str]:
    """Longest-prefix match. 매칭된 prefix가 UNRESOLVED면 unresolved 반환.
    매칭 자체가 없으면 None 반환 (전체 fallback 없음).

    >>> _mapper_lookup("26110")
    '반도체'
    >>> _mapper_lookup("282")
    '2차전지'
    >>> _mapper_lookup("28202")
    '2차전지'
    >>> _mapper_lookup("70113")
    'unresolved'
    >>> _mapper_lookup("999") is None
    True
    """
    # Sort by descending length so longest prefix matches first.
    # Build a per-call sorted view; module-level cache acceptable since _PREFIX_RULES is immutable.
    for prefix, sector in _SORTED_RULES:
        if induty_code.startswith(prefix):
            return sector
    return None


_SORTED_RULES: tuple[tuple[str, str], ...] = tuple(
    sorted(_PREFIX_RULES, key=lambda kv: len(kv[0]), reverse=True)
)


# ============================================================================
# Override file loader
# ============================================================================

OVERRIDE_TICKER_RE: re.Pattern = re.compile(r"^[0-9]{6}$")
"""6-digit numeric ticker (KOSPI/KOSDAQ). 5/7+ digit 또는 alpha는 schema fail-fast."""


class OverrideSchemaError(ValueError):
    """sector_override.json schema 위반 — JSON parse 실패 / canonical 14 외 / 6-digit 위반 / reason 누락."""


def load_override(path: Optional[Path] = None) -> dict[str, dict[str, str]]:
    """`scripts/sector_override.json` 로드 + schema 검증.

    Returns: { "<6-digit ticker>": { "canonical": "<canonical14>", "reason": "<str>" }, ... }

    schema (TDD invariant T3):
      - 최상위 keys: "override_version" (str) + "override_date" (str) + "override_source" (str) + "tickers" (dict).
      - tickers value entries:
        - key = 6-digit numeric string
        - value.canonical ∈ CANONICAL_SECTORS (14개)
        - value.reason = non-empty string

    Raises:
      OverrideSchemaError on schema violations.
      FileNotFoundError if file missing (caller decides default).
    """
    if path is None:
        path = Path(__file__).with_name("sector_override.json")
    raw = path.read_text(encoding="utf-8")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise OverrideSchemaError(f"sector_override.json JSON parse 실패: {exc}") from exc

    if not isinstance(data, dict):
        raise OverrideSchemaError("최상위가 object여야 합니다.")

    tickers = data.get("tickers")
    if not isinstance(tickers, dict):
        raise OverrideSchemaError("`tickers` 필드는 dict여야 합니다.")

    result: dict[str, dict[str, str]] = {}
    for ticker, entry in tickers.items():
        if not isinstance(ticker, str) or not OVERRIDE_TICKER_RE.fullmatch(ticker):
            raise OverrideSchemaError(f"ticker key `{ticker}`는 6-digit numeric string이어야 합니다.")
        if not isinstance(entry, dict):
            raise OverrideSchemaError(f"ticker `{ticker}` 값이 object가 아닙니다.")
        canonical = entry.get("canonical")
        if canonical not in CANONICAL_SECTORS:
            raise OverrideSchemaError(
                f"ticker `{ticker}` canonical=`{canonical}`은 CANONICAL_SECTORS 14개 중 하나가 아닙니다."
            )
        reason = entry.get("reason")
        if not isinstance(reason, str) or not reason.strip():
            raise OverrideSchemaError(f"ticker `{ticker}` reason은 non-empty string이어야 합니다.")
        result[ticker] = {"canonical": canonical, "reason": reason}
    return result


# ============================================================================
# Resolve API
# ============================================================================

def resolve_sector(
    ticker: str,
    induty_code: Optional[str],
    override: Optional[dict[str, dict[str, str]]] = None,
) -> str:
    """B66 C 하이브리드 최종 sector 결정.

    Priority (plan §5.3):
      1. override[ticker] (있으면 최우선, mapper 우회)
      2. longest-prefix KSIC mapper (induty_code 정규화 + 매칭)
      3. UNRESOLVED ("unresolved" sentinel — 호출자가 strict block)

    Args:
      ticker: 6-digit string (정합 검증은 호출자 책임 — 본 함수는 그대로 lookup).
      induty_code: DART company.json `induty_code`. 3~5자리 numeric or None.
      override: load_override() 결과. None이면 빈 dict로 처리.

    Returns:
      canonical14 ∈ CANONICAL_SECTORS, OR "unresolved" sentinel.

    >>> resolve_sector("005930", "264", None)
    '통신'
    >>> resolve_sector("005930", "264", {"005930": {"canonical": "반도체", "reason": "삼성전자"}})
    '반도체'
    >>> resolve_sector("999999", None, None)
    'unresolved'
    >>> resolve_sector("452200", "27212", None)
    '바이오'
    >>> resolve_sector("452200", "27212", {"452200": {"canonical": "2차전지", "reason": "배터리 진단장비"}})
    '2차전지'
    """
    override = override or {}
    if ticker in override:
        return override[ticker]["canonical"]
    normalized = normalize_induty(induty_code)
    if normalized is None:
        return UNRESOLVED
    mapped = _mapper_lookup(normalized)
    if mapped is None:
        return UNRESOLVED
    return mapped


# ============================================================================
# Debugging helpers
# ============================================================================

def explain(ticker: str, induty_code: Optional[str], override: Optional[dict[str, dict[str, str]]] = None) -> dict:
    """Diagnostic helper — review CSV / log용. resolve_sector + trace info.

    Returns:
      {
        "ticker": str,
        "induty_code": str | None,
        "induty_normalized": str | None,
        "override_canonical": str | None,
        "override_reason": str | None,
        "mapper_prefix": str | None,
        "mapper_sector": str | None,
        "final_sector": str (canonical14 or "unresolved"),
        "source": "override" | "mapper" | "unresolved",
      }
    """
    override = override or {}
    if ticker in override:
        return {
            "ticker": ticker,
            "induty_code": induty_code,
            "induty_normalized": normalize_induty(induty_code),
            "override_canonical": override[ticker]["canonical"],
            "override_reason": override[ticker]["reason"],
            "mapper_prefix": None,
            "mapper_sector": None,
            "final_sector": override[ticker]["canonical"],
            "source": "override",
        }
    normalized = normalize_induty(induty_code)
    if normalized is None:
        return {
            "ticker": ticker,
            "induty_code": induty_code,
            "induty_normalized": None,
            "override_canonical": None,
            "override_reason": None,
            "mapper_prefix": None,
            "mapper_sector": None,
            "final_sector": UNRESOLVED,
            "source": "unresolved",
        }
    matched_prefix: Optional[str] = None
    matched_sector: Optional[str] = None
    for prefix, sector in _SORTED_RULES:
        if normalized.startswith(prefix):
            matched_prefix = prefix
            matched_sector = sector
            break
    final = matched_sector if matched_sector and matched_sector != UNRESOLVED else UNRESOLVED
    return {
        "ticker": ticker,
        "induty_code": induty_code,
        "induty_normalized": normalized,
        "override_canonical": None,
        "override_reason": None,
        "mapper_prefix": matched_prefix,
        "mapper_sector": matched_sector,
        "final_sector": final if final != UNRESOLVED else UNRESOLVED,
        "source": "mapper" if matched_sector and matched_sector != UNRESOLVED else "unresolved",
    }


__all__ = [
    "CANONICAL_SECTORS",
    "UNRESOLVED",
    "INDUTY_CODE_RE",
    "OverrideSchemaError",
    "normalize_induty",
    "load_override",
    "resolve_sector",
    "explain",
]
