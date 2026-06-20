#!/usr/bin/env python3
# noqa: SIZE_OK - PR-B1 pure core is a self-contained review target; split in later PR if it grows.
"""주픽(JooPick) — Track 2 generator-shadow 순수 compute 코어 (PR-B1).

SoT: docs/superpowers/specs/2026-06-20-pathA-track2-generator-shadow.md

이 모듈은 **순수 함수**만 담는다 — DB 없음, LLM 없음, 입력 mutation 없음, 결정론.
forward-only diagnostic이며 D30 no-apply 원칙을 따른다: Tier1/portfolio/money-path로
절대 흐르지 않고 "상승 예측"/"아웃퍼폼" claim을 만들지 않는다. production runtime effect = NONE.

production 모듈은 byte-unchanged로 import만 한다 (모든 entry point는 __main__ 가드되어
import-safe임을 확인):
- screen_shortlist_tier0 (select_bpp_candidates / BUCKETS / CANDIDATE_POOL_PER_BUCKET)
- tier0_factors (StockRaw / ScoredStock / score_bpp_universe / select_size_sleeves /
  SLEEVE_QUOTA / SleeveShortfallError)
- canonical_sector_mapper (CANONICAL_SECTORS — 14)

D7 freeze (soft_tilt_v1):
- soft_tilt_v1의 D7 기본값은 "multiplier ×1.10"이었으나 rank ensemble score는 ≥0이 보장되지
  않는다 (rank base가 0 근처 + anti_pump_penalty 최대 25 → score ∈ ~[-25, +110], 구조적으로
  음수 가능). ×1.10 multiplier는 음수 score인 주도-섹터 종목을 **demote**한다 (−5 × 1.10 = −5.5,
  방향이 반대). ⇒ multiplier REJECT.
- FREEZE = D7-authorized equivalent = **additive +10.0** (0–100 rank-ensemble 척도의 +10pp).
  부호 경계를 가로질러 균일하게 위로 이동하며 order-preserving. 상수 SOFT_TILT_V1_ADDEND = 10.0,
  immutable. NaN score는 NaN으로 유지(tilt 미적용).

ARMS (spec §4):
- 'production-mirror'  : select_bpp_candidates 그대로 (zero drift). counterfactual_cut=[].
- 'sector-soft-tilt'   : 주도-섹터 ScoredStock.score에 SOFT_TILT_V1_ADDEND를 select_size_sleeves
                          score 배열 **및** 최종 정렬 양쪽에 적용 후 disjoint 50/bucket.
                          counterfactual_cut=[].
- 'sector-hard-gate'   : 스코어링 **전에** sector∈leading_sectors로 universe 필터 후 동일 B++ 선정.
                          counterfactual_cut = full−gated tickers. gate_eligible_size=distinct gated tickers.
                          DIAGNOSTIC-only.
"""
from __future__ import annotations

import hashlib
import math
import os
import sys
from collections import Counter
from dataclasses import replace
from datetime import date, datetime, time, timedelta, timezone
from typing import Callable, TypeAlias, TypedDict

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

import tier0_factors as TF                              # noqa: E402
import screen_shortlist_tier0 as SS                     # noqa: E402
from canonical_sector_mapper import CANONICAL_SECTORS   # noqa: E402  tuple[str, ...] (14)


# ============================================================================
# Public constants
# ============================================================================

# D7 freeze: 0–100 rank-ensemble 척도의 additive +10pp. multiplier(×1.10) 아님 —
# score는 음수 가능(rank base ≈ 0 + anti_pump_penalty 최대 25 → score ∈ ~[-25, +110]).
# multiplier는 음수 score 주도-섹터 종목을 demote(방향 반대). additive +10은 부호 경계를
# 가로질러 균일하게 위로, order-preserving. immutable. NaN score는 NaN 유지.
SOFT_TILT_V1_ADDEND: float = 10.0

# shadow 전용 15번째 sector 리터럴 (production = canonical-14만). leading_sector로는 불허.
UNRESOLVED: str = "unresolved"

_VALID_SOURCES = ("absent", "manual_pre_registered")
_VALID_ARMS = ("production-mirror", "sector-soft-tilt", "sector-hard-gate")
_SOFT_TILT_V1_VERSIONS = frozenset(("soft_tilt_v1", "v1-fixed"))
_CANONICAL_SET = frozenset(CANONICAL_SECTORS)   # 14, 'unresolved' 미포함
# 프로젝트 tz(KST). naive date/datetime hypothesis 필드는 KST로 해석해 tz-aware 값과
# 동일 basis(UTC)로 비교 — bare date vs +09:00 timestamp 혼용 시 as_of<selection_as_of
# forward-integrity 가드가 day-boundary에서 뒤집히는 것을 방지(spec §3.3/§3.4 anti-p-hacking).
_KST = timezone(timedelta(hours=9))


class UniverseRow(TypedDict):
    """fetch_universe + resolve_sectors_for_universe row 중 pure core가 쓰는 최소 shape."""

    ticker: str


UniverseInput: TypeAlias = list[str] | list[UniverseRow]
ShadowParams: TypeAlias = dict[str, str | int | float | bool | None]


class ShadowSelectionsResult(TypedDict):
    """compute_shadow_selections result shape (spec §4)."""

    selections: dict[str, list[TF.ScoredStock]]
    counterfactual_cut: list[str]
    sector_distribution: dict[str, int]
    universe_hash: str
    universe_size: int
    gate_eligible_size: int | None


# ============================================================================
# Exceptions
# ============================================================================

class ShadowInvalidInputError(ValueError):
    """잘못된 config/inputs (source/arm/leading_sectors/hypothesis/universe-mismatch).

    PR-B3는 이것을 hard validation failure로 매핑한다 (run-status 아님)."""


class ShadowIncompleteRunError(RuntimeError):
    """hard-gate cut이 universe를 줄여 sleeve quota를 채울 수 없을 때.

    TF.SleeveShortfallError를 감싼다. PR-B3는 이것을 status='incomplete_run'으로 매핑한다.
    arm=='sector-hard-gate'에서만 raise한다. production-mirror / sector-soft-tilt에서는
    TF.SleeveShortfallError가 raw로 propagate된다 (production B++ 동작과 동일).

    NOTE: SleeveShortfallError(RuntimeError)를 mirror하되 그 subclass는 아니다 — PR-B3가
    isinstance로 두 경로를 구분할 수 있어야 한다.
    """


# ============================================================================
# Score transform 기반 선정 엔진 (select_bpp_candidates re-parameterization)
# ============================================================================

def _select_with_score_transform(
    stocks: list[TF.StockRaw],
    *,
    transform: Callable[[TF.ScoredStock], float],
    pool_size: int = SS.CANDIDATE_POOL_PER_BUCKET,
) -> dict[str, list[TF.ScoredStock]]:
    """주입된 score transform을 가진 SS.select_bpp_candidates의 mirror.

    `transform(sc) -> float`를 (a) select_size_sleeves에 넣는 score 배열과
    (b) 최종 (-score, ticker) 정렬 **양쪽**에 동일하게 적용한다 — selection과 ranking이
    일관되게 유지된다(tilt-promoted leader가 untilted score로 재정렬되어 비단조 출력이 되는
    것을 방지). identity transform(lambda sc: sc.score)은 select_bpp_candidates를 정확히
    재현한다(테스트에서 assert). ScoredStock은 절대 mutate되지 않는다 — transform은 .score를
    **읽어** 새 float을 반환하고, transformed score는 별도 dict(tscore)에 보관한다.
    select_size_sleeves는 parallel 배열을 소비하므로 객체 mutation이 발생하지 않는다.
    """
    if sum(TF.SLEEVE_QUOTA.values()) != pool_size:
        # production select_bpp_candidates와 동일한 방어 (쿼터/풀 불일치).
        raise ValueError(  # noqa: GENERIC_ERR_OK - mirrors production select_bpp_candidates guard.
            f"SLEEVE_QUOTA 합 {sum(TF.SLEEVE_QUOTA.values())} != pool_size {pool_size}"
            " — 쿼터/풀 불일치"
        )
    result: dict[str, list[TF.ScoredStock]] = {}
    used: set[str] = set()
    for bucket in SS.BUCKETS:                                  # ("short","mid","long")
        scored = TF.score_bpp_universe(stocks, bucket)          # 입력 순서 유지
        by_ticker = {sc.ticker: sc for sc in scored}
        tscore = {sc.ticker: transform(sc) for sc in scored}    # transformed (NaN-safe)
        picked = TF.select_size_sleeves(
            [sc.ticker for sc in scored],
            [tscore[sc.ticker] for sc in scored],
            [sc.sleeve for sc in scored],
            quota=TF.SLEEVE_QUOTA,
            exclude=used,
        )
        # 최종 정렬은 selection과 **동일한** transformed score를 쓴다 (일관성).
        picked_scored = sorted(
            (replace(by_ticker[t], score=tscore[t]) for t in picked),
            key=lambda sc: (-sc.score, sc.ticker),
        )
        result[bucket] = picked_scored
        used |= {sc.ticker for sc in picked_scored}
    return result


def _make_soft_tilt_transform(
    leading_sectors: frozenset[str],
) -> Callable[[TF.ScoredStock], float]:
    """주도-섹터 ScoredStock에만 additive +SOFT_TILT_V1_ADDEND.

    NaN 보존 (NaN은 NaN으로 유지, 절대 NaN+10 안 함). 비주도-섹터는 그대로 통과.
    NaN 가드는 명시적이다 — `NaN + 10.0 == NaN`은 우연히 안전하지만, 향후 sentinel/fill
    회귀가 ineligible 종목을 sleeve 경쟁에 흘리지 않도록 명시 가드로 봉쇄한다.
    """
    def _t(sc: TF.ScoredStock) -> float:
        s = sc.score
        if math.isnan(s):              # 명시적 NaN 가드 (필수)
            return s                   # ineligible은 NaN 유지 → sleeve에서 skip
        if sc.sector in leading_sectors:
            return s + SOFT_TILT_V1_ADDEND
        return s
    return _t


# ============================================================================
# universe hash / size 헬퍼
# ============================================================================

def _universe_hash(stocks: list[TF.StockRaw]) -> str:
    """sorted distinct FULL-universe tickers(pre-cut)에 대한 sha256 hex.

    모든 arm에서 동일(hard-gate 포함) — hash는 full input universe 위에서 계산한다.
    NUL 구분자로 ticker 리스트에 대해 injective(("AB","C") vs ("A","BC") 충돌 방지).
    """
    distinct = sorted({s.ticker for s in stocks})
    h = hashlib.sha256()
    for t in distinct:
        h.update(t.encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()


def _universe_ticker_set(universe: UniverseInput) -> set[str]:
    """Spec-shaped universe rows or legacy ticker lists에서 ticker set을 추출한다."""
    if not isinstance(universe, list):
        raise ShadowInvalidInputError("universe must be a list")
    tickers: set[str] = set()
    row_kind: str | None = None
    for row in universe:
        if isinstance(row, str):
            current_kind = "ticker-list"
            ticker = row
        else:
            if not isinstance(row, dict):
                raise ShadowInvalidInputError(
                    "universe rows must be ticker strings or row dicts"
                )
            current_kind = "row-list"
            ticker = row.get("ticker")
            if not isinstance(ticker, str) or not ticker:
                raise ShadowInvalidInputError(
                    "universe rows must contain non-empty ticker strings"
                )
        if ticker in tickers:
            raise ShadowInvalidInputError(f"duplicate universe ticker: {ticker}")
        if row_kind is None:
            row_kind = current_kind
        elif row_kind != current_kind:
            raise ShadowInvalidInputError(
                "universe must not mix ticker strings and row dicts"
            )
        tickers.add(ticker)
    return tickers


def _parse_hypothesis_datetime(
    value: str | date | datetime | None,
    field_name: str,
) -> datetime:
    """Hypothesis date/timestamp parser; stale checks must not use string ordering."""
    if isinstance(value, datetime):
        return _normalize_datetime(value)
    if isinstance(value, date):
        return _normalize_datetime(datetime.combine(value, time.min))
    if isinstance(value, str):
        raw = value.removesuffix("Z") + "+00:00" if value.endswith("Z") else value
        try:
            if "T" in raw:
                return _normalize_datetime(datetime.fromisoformat(raw))
            return _normalize_datetime(datetime.combine(date.fromisoformat(raw), time.min))
        except ValueError as exc:
            raise ShadowInvalidInputError(
                f"{field_name} must be ISO date/timestamp"
            ) from exc
    raise ShadowInvalidInputError(f"{field_name} must be ISO date/timestamp")


def _normalize_datetime(value: datetime) -> datetime:
    """모든 hypothesis 시각을 단일 basis(UTC-naive)로 정규화한다.

    naive 값(bare date 포함)은 KST(_KST, 프로젝트 tz)로 해석한 뒤 UTC로 변환하고, tz-aware 값은
    그 instant를 UTC로 변환한다. 이렇게 해야 bare date(naive) as_of vs +09:00 timestamp
    selection_as_of 혼용 시 `as_of < selection_as_of` forward-integrity 가드가 day-boundary에서
    뒤집히지 않는다(spec §3.3/§3.4). 문자열 ordering(lexical) 비교는 금지 — instant 비교만 한다.
    """
    if value.tzinfo is None:
        value = value.replace(tzinfo=_KST)
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _parse_leading_sectors(hypothesis: dict) -> list[str]:
    """leading_sectors를 list[str]로 fail-closed 추출 (params/universe와 동일 contract).

    non-list(int 등)는 raw TypeError로, dict는 silent key-coercion으로 새던 경로를 차단한다 —
    모든 잘못된 입력은 ShadowInvalidInputError여야 PR-B3가 균일 매핑한다(spec §4.5 silent coerce 금지).
    """
    raw = hypothesis.get("leading_sectors")
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ShadowInvalidInputError("hypothesis.leading_sectors must be a list")
    if any(not isinstance(s, str) for s in raw):
        raise ShadowInvalidInputError("hypothesis.leading_sectors must be strings")
    return list(raw)


def _parse_hypothesis_params(hypothesis: dict) -> ShadowParams:
    raw_params = hypothesis.get("params", {})
    if not isinstance(raw_params, dict):
        raise ShadowInvalidInputError("hypothesis.params must be an object")
    if any(not isinstance(key, str) for key in raw_params):
        raise ShadowInvalidInputError("hypothesis.params keys must be strings")
    return dict(raw_params)


def _validate_soft_tilt_params(params: ShadowParams) -> None:
    """D7-frozen soft_tilt_v1 params: additive +10 only; multiplier silently rejected."""
    tilt_version = params.get("tilt_version")
    # isinstance 가드 선행: jsonb params의 tilt_version이 list/dict 같은 unhashable이면
    # `x not in frozenset(...)`이 raw TypeError(unhashable)로 새므로 str 여부를 먼저 확인.
    if not isinstance(tilt_version, str) or tilt_version not in _SOFT_TILT_V1_VERSIONS:
        raise ShadowInvalidInputError(
            f"unsupported sector-soft-tilt tilt_version: {tilt_version!r}"
        )
    if "tilt_multiplier" in params:
        raise ShadowInvalidInputError("soft_tilt_v1 rejects multiplier params")
    for addend_key in ("tilt_addend", "tilt_bonus"):
        if addend_key in params and params[addend_key] != SOFT_TILT_V1_ADDEND:
            raise ShadowInvalidInputError(
                f"{addend_key} must equal {SOFT_TILT_V1_ADDEND}"
            )


# ============================================================================
# Validation
# ============================================================================

def _validate_inputs(
    universe: UniverseInput,
    stocks: list[TF.StockRaw],
    hypothesis: dict,
    arm: str,
    leading_sectors: list[str],
    params: ShadowParams,
) -> None:
    """compute 전 모든 ShadowInvalidInputError 조건 검사 (spec §4, 첫 실패에서 raise)."""
    # 1. arm
    if arm not in _VALID_ARMS:
        raise ShadowInvalidInputError(f"unknown arm: {arm!r}")
    # 2. source
    source = hypothesis.get("source")
    if source not in _VALID_SOURCES:
        raise ShadowInvalidInputError(f"unknown source: {source!r}")
    # 3. leading_sectors는 canonical-14만 ('unresolved' 불허)
    bad = [s for s in leading_sectors if s not in _CANONICAL_SET]
    if bad:
        raise ShadowInvalidInputError(f"non-canonical leading sector(s): {bad!r}")
    # 3b. 중복 leading sector 거부 (silent dedup 금지, spec §4.5). [A]와 [A,A]가 서로 다른
    #     hypothesis_hash를 갖는데 동일 selection을 내는 p-registration 모호성을 source에서 차단.
    if len(leading_sectors) != len(set(leading_sectors)):
        raise ShadowInvalidInputError(
            f"duplicate leading sector(s): {leading_sectors!r}"
        )
    # 4. manual_pre_registered 요건
    if source == "manual_pre_registered":
        if not leading_sectors:
            raise ShadowInvalidInputError(
                "manual_pre_registered requires non-empty leading_sectors and"
                " as_of < selection_as_of"
            )
        as_of_date = _parse_hypothesis_datetime(hypothesis.get("as_of"), "as_of")
        selection_as_of_date = _parse_hypothesis_datetime(
            hypothesis.get("selection_as_of"), "selection_as_of"
        )
        if as_of_date >= selection_as_of_date:
            raise ShadowInvalidInputError(
                "manual_pre_registered requires non-empty leading_sectors and"
                " as_of < selection_as_of"
            )
    # 5. absent는 leading_sectors가 비어 있어야 함
    if source == "absent" and leading_sectors:
        raise ShadowInvalidInputError(
            "absent source must have empty leading_sectors"
        )
    # 6a. sector-soft-tilt arm은 실제 tilt가 적용될 때(leading_sectors 비어있지 않음) tilt_version 필수.
    #     source=='absent'(⟹ leading_sectors 빈 배열)에서는 soft-tilt가 mirror로 degrade(spec §3.3)하므로 불요.
    if arm == "sector-soft-tilt" and leading_sectors and not params.get("tilt_version"):
        raise ShadowInvalidInputError(
            "sector-soft-tilt requires tilt params (tilt_version)"
        )
    # 6b. D7-freeze 적합성은 **arm 무관**: immutable 가설이 tilt knob을 하나라도 선언하면 어느 arm에서든
    #     동일하게 검증한다(같은 hypothesis_id가 mirror에선 통과·soft-tilt에선 거부되는 비대칭 제거; spec §3.3
    #     anti-p-hack freeze). tilt knob 미선언(예: hard-gate 전용 manual 가설)은 검증 생략.
    if any(k in params for k in ("tilt_version", "tilt_multiplier", "tilt_addend", "tilt_bonus")):
        _validate_soft_tilt_params(params)
    # 7. mis-wiring 가드: universe ticker-set == stocks ticker-set, duplicate ticker 금지
    stock_tickers = [s.ticker for s in stocks]
    if len(stock_tickers) != len(set(stock_tickers)):
        raise ShadowInvalidInputError("stocks contain duplicate ticker(s)")
    if _universe_ticker_set(universe) != set(stock_tickers):
        raise ShadowInvalidInputError(
            "universe ticker-set != stocks ticker-set"
        )


# ============================================================================
# Public entry — compute_shadow_selections
# ============================================================================

def compute_shadow_selections(
    universe: UniverseInput,
    stocks: list[TF.StockRaw],
    hypothesis: dict,
    arm: str,
    pool_size: int = SS.CANDIDATE_POOL_PER_BUCKET,
) -> ShadowSelectionsResult:
    """Track 2 generator-shadow 순수 compute (spec §4).

    DB/LLM/입력 mutation 없음. 결정론.

    Args:
        universe: full-universe rows(fetch/sector-resolve dict) 또는 ticker 리스트 (mis-wiring 가드용).
        stocks: TF.StockRaw 리스트 (full universe).
        hypothesis: immutable DB row dict. keys: period_key, source('absent'|
            'manual_pre_registered'), leading_sectors:[canonical14], as_of,
            selection_as_of, params:{}, hypothesis_hash.
        arm: 'production-mirror' | 'sector-soft-tilt' | 'sector-hard-gate'.
        pool_size: bucket당 후보 수 (기본 50 → 150 distinct).

    Returns dict:
        selections: {bucket: [ScoredStock]}  — healthy universe면 50/bucket.
        counterfactual_cut: [ticker]  — hard-gate: sorted full−gated; 그 외 [].
        sector_distribution: {sector: count}  — 모든 pick의 sc.sector 카운트.
        universe_hash: str  — sorted distinct FULL-universe tickers sha256 (모든 arm 동일).
        universe_size: int  — FULL universe distinct ticker 수 (모든 arm 동일).
        gate_eligible_size: int|None  — hard-gate: distinct gated ticker 수(absent ⇒ full N); 그 외 None.

    Raises:
        ShadowInvalidInputError: 잘못된 config/inputs (spec §4 검증).
        ShadowIncompleteRunError: hard-gate cut으로 sleeve quota 미달 (이 arm 한정).
        TF.SleeveShortfallError: production-mirror/soft-tilt에서 sleeve 미달 시 raw propagate.
    """
    if not isinstance(hypothesis, dict):
        # 첫 hypothesis.get(...) 전에 fail-closed (non-dict → raw AttributeError 누수 차단).
        raise ShadowInvalidInputError("hypothesis must be an object")
    leading_sectors = _parse_leading_sectors(hypothesis)
    params = _parse_hypothesis_params(hypothesis)

    _validate_inputs(universe, stocks, hypothesis, arm, leading_sectors, params)

    source = hypothesis["source"]
    universe_hash = _universe_hash(stocks)                       # FULL, pre-cut, 모든 arm 동일
    universe_size = len({s.ticker for s in stocks})              # FULL distinct, 모든 arm 동일
    leading_set = frozenset(leading_sectors)

    counterfactual_cut: list[str] = []
    gate_eligible_size: int | None = None

    # ----- absent 또는 빈 leading_sectors: 모든 arm이 production-mirror처럼 동작 -----
    # validation이 absent⇒empty / manual⇒non-empty를 보장하므로 not leading_set은
    # 'absent'(또는 PLUMBING-evidence)와 동치.
    if source == "absent" or not leading_set:
        selections = SS.select_bpp_candidates(stocks, pool_size=pool_size)
        if arm == "sector-hard-gate":
            # absent hard-gate = no cut, gate_eligible_size = full N (PLUMBING evidence).
            gate_eligible_size = universe_size
        # counterfactual_cut은 [] 유지(모든 arm).

    # ----- production-mirror: select_bpp_candidates 직접 재사용 (zero drift) -----
    elif arm == "production-mirror":
        selections = SS.select_bpp_candidates(stocks, pool_size=pool_size)

    # ----- sector-soft-tilt: 주도-섹터에 additive +10, score 배열 + 최종 정렬 양쪽 -----
    elif arm == "sector-soft-tilt":
        selections = _select_with_score_transform(
            stocks,
            transform=_make_soft_tilt_transform(leading_set),
            pool_size=pool_size,
        )

    # ----- sector-hard-gate: 스코어링 전 sector 필터 후 동일 B++ (DIAGNOSTIC-only) -----
    else:  # arm == "sector-hard-gate" (validation으로 보장)
        full_tickers = sorted({s.ticker for s in stocks})
        gated = [s for s in stocks if s.sector in leading_set]
        gated_tickers = {s.ticker for s in gated}
        counterfactual_cut = sorted(t for t in full_tickers if t not in gated_tickers)
        gate_eligible_size = len(gated_tickers)
        try:
            selections = SS.select_bpp_candidates(gated, pool_size=pool_size)
        except TF.SleeveShortfallError as e:
            raise ShadowIncompleteRunError(
                f"hard-gate cut left sleeve quota unfillable: {e}"
            ) from e

    sector_distribution = dict(
        Counter(sc.sector for bucket in SS.BUCKETS for sc in selections[bucket])
    )

    return {
        "selections": selections,
        "counterfactual_cut": counterfactual_cut,
        "sector_distribution": sector_distribution,
        "universe_hash": universe_hash,
        "universe_size": universe_size,
        "gate_eligible_size": gate_eligible_size,
    }
