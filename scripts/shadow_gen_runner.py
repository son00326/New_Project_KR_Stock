#!/usr/bin/env python3
# noqa: SIZE_OK - PR-B3 pure payload builders are a self-contained review target; split later if it grows.
"""주픽(JooPick) — Track 2 generator-shadow 순수 페이로드 빌더 (PR-B3).

SoT: docs/superpowers/specs/2026-06-20-pathA-track2-generator-shadow.md §4·§5·§7·§10·§11

이 모듈은 **순수 함수**만 담는다 — DB 없음, LLM 없음, 네트워크 없음, import-time I/O 없음.
PR-B1(`shadow_gen_core.compute_shadow_selections`)의 arm 결과를 받아, applied migration
`0039`의 `upsert_tier0_shadow_run(p_payload jsonb)` RPC가 **그대로 통과시키는** run-level envelope을
조립한다. 산출물은 전부 JSON-serializable dict/list이며, 잘못된 config은 ShadowRunnerError로 fail-closed.

D30 no-apply: forward-only diagnostic. production tier0_candidates_150/short_list_30/money-path로
절대 흐르지 않고 "상승 예측"/"아웃퍼폼" claim을 만들지 않는다. production runtime effect = NONE.

production 모듈/PR-B1은 byte-unchanged로 import만 한다 (모든 entry point는 __main__ 가드됨):
- screen_shortlist_tier0 (build_bpp_candidate_rows / candidate_row_to_db_dict / BUCKETS /
  CANDIDATE_POOL_PER_BUCKET / Tier0CandidateRow)
- tier0_factors (StockRaw / ScoredStock / score_bpp_universe)
- shadow_gen_core (ShadowSelectionsResult / SOFT_TILT_V1_ADDEND / UNRESOLVED 등 — type/const만)

핵심 contract 결정 (grounded findings 2026-06-21):
- F2/F1: orchestrator(impure)는 screen_shortlist_tier0에 남고, payload 조립은 전부 여기(pure)에 둔다.
- F3: arm rows = build_bpp_candidate_rows(arm.selections) → candidate_row_to_db_dict 그대로 (shape 일치).
      non-logged arm은 rows=[] + status. 'unresolved' sector는 shadow candidates에서 허용(production은 불허).
- F4: snapshot = 3× score_bpp_universe(FULL universe) → (ticker,bucket)당 1행. NaN-score ineligible은
      rank=None + tier0_score=None (CHECK-compliant; 모든 distinct ticker가 snapshot에 남아 count==N).
- F5: universe_hash/universe_size/run_id/hypothesis_id/period_key/month/sector_view/run_date는
      **run-level에만** 둔다 (RPC가 arm에 merge; run-level wins). arm은 disjoint per-arm 필드만.
- PRB3-3: hypothesis_hash = caller가 계산하는 identity 키. selection_as_of 제외, byte-exact 고정.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import sys
from datetime import date, datetime
from typing import Any, Callable

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

import tier0_factors as TF                                # noqa: E402
import screen_shortlist_tier0 as SS                       # noqa: E402
import shadow_gen_core as SG                              # noqa: E402

# 14 canonical + shadow-only 'unresolved'. snapshot/candidate sector CHECK 정합 (migration 0039).
from canonical_sector_mapper import CANONICAL_SECTORS     # noqa: E402

# RPC가 받는 arm 이름 (migration 0039 CHECK). PR-B1 _VALID_ARMS와 동일.
ARMS: tuple[str, ...] = ("production-mirror", "sector-soft-tilt", "sector-hard-gate")
_VALID_SOURCES: tuple[str, ...] = ("absent", "manual_pre_registered")
_VALID_STATUSES: tuple[str, ...] = ("logged", "invalid_input", "incomplete_run")
_CANONICAL_SET = frozenset(CANONICAL_SECTORS)             # 14, 'unresolved' 미포함
_CANONICAL_INDEX = {sector: idx for idx, sector in enumerate(CANONICAL_SECTORS)}


class ShadowRunnerError(ValueError):
    """PR-B3 payload-builder fail-closed: 잘못된 config/inputs.

    PR-B1의 ShadowInvalidInputError와 구분 — 이쪽은 envelope 조립 단계 invariant 위반이다.
    orchestrator는 둘 다 hard fail로 처리한다(generation을 production write로 흘리지 않음).
    """


# ============================================================================
# period_key / month
# ============================================================================

def derive_period_key(month: date, *, env: dict[str, str] | None = None) -> str:
    """SHADOW_PERIOD_KEY env override가 있으면 그것, 없으면 monthly `YYYY-MM`.

    migration 0039는 `^\\d{4}-\\d{2}$`(monthly) 또는 `^\\d{4}-W\\d{2}$`(weekly)만 허용한다.
    monthly의 경우 period_key는 to_char(month,'YYYY-MM')와 정확히 일치해야 한다(period_month_mismatch).
    weekly(`YYYY-Www`)는 SHADOW_PERIOD_KEY로 명시 주입하며 month=해당 production-compatible date를 쓴다.
    """
    if env is None:
        env = dict(os.environ)
    explicit = env.get("SHADOW_PERIOD_KEY")
    if explicit:
        pk = explicit.strip()
        if not _is_period_key(pk):
            raise ShadowRunnerError(
                f"SHADOW_PERIOD_KEY must match YYYY-MM or YYYY-Www: {pk!r}"
            )
        # monthly period_key는 month와 일치해야 RPC period_month_mismatch를 피한다.
        if _is_monthly_period_key(pk) and pk != month.strftime("%Y-%m"):
            raise ShadowRunnerError(
                f"monthly SHADOW_PERIOD_KEY {pk!r} != month {month.strftime('%Y-%m')}"
            )
        return pk
    return month.strftime("%Y-%m")


def _is_period_key(value: str) -> bool:
    return _is_monthly_period_key(value) or _is_weekly_period_key(value)


def _is_monthly_period_key(value: str) -> bool:
    return (
        len(value) == 7
        and value[4] == "-"
        and value[:4].isdigit()
        and value[5:].isdigit()
    )


def _is_weekly_period_key(value: str) -> bool:
    # YYYY-Www
    return (
        len(value) == 8
        and value[4] == "-"
        and value[5] == "W"
        and value[:4].isdigit()
        and value[6:].isdigit()
    )


def _month_str(month: date) -> str:
    """RPC가 받는 month: 'YYYY-MM'(RPC가 -01 부착) 또는 'YYYY-MM-01'. 1일 강제."""
    if month.day != 1:
        raise ShadowRunnerError(f"month must be the first of the month: {month.isoformat()}")
    return month.strftime("%Y-%m")


# ============================================================================
# hypothesis (PRB3-1 absent / PRB3-2 manual / PRB3-3 hash)
# ============================================================================

def compute_hypothesis_hash(
    period_key: str,
    source: str,
    leading_sectors: list[str],
    params: dict[str, Any],
    as_of: str | None,
) -> str:
    """identity 키 (PRB3-3). PR-B3가 유일한 computer — migration은 caller hash를 신뢰한다.

    byte-exact 고정 string: json.dumps of an ordered dict with
      - period_key
      - source
      - canonical-sector-ordered leading_sectors
      - params (key-sorted by json sort_keys)
      - as_of (ISO instant string or null)
    selection_as_of는 **제외** (선정 시각은 forward-integrity 가드이지 identity가 아님; 같은 가설을
    다른 run에서 재선정해도 같은 hash여야 idempotent register가 동작).
    sort_keys=True + compact separators + ensure_ascii=False (한국어 섹터 그대로).
    """
    payload = {
        "period_key": period_key,
        "source": source,
        "leading_sectors": _canonicalize_leading_sectors(leading_sectors),
        "params": params,
        "as_of": as_of,
    }
    encoded = json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _canonicalize_leading_sectors(sectors: list[str]) -> list[str]:
    # fail-closed (feedback_failclosed_symmetric_completion): non-canonical sector → typed ShadowRunnerError,
    #   not a raw KeyError, so compute_hypothesis_hash honors the module's "all bad input → ShadowRunnerError"
    #   contract even when called directly (orchestrator callers already validate; this guards external callers).
    bad = [s for s in sectors if s not in _CANONICAL_INDEX]
    if bad:
        raise ShadowRunnerError(f"non-canonical leading sector(s): {bad!r}")
    return sorted(sectors, key=lambda sector: _CANONICAL_INDEX[sector])


def build_absent_hypothesis(period_key: str, selection_as_of: str) -> dict[str, Any]:
    """deterministic absent hypothesis (PRB3-1, spec §3.3).

    leading_sectors=[], params={}, as_of=null. register_shadow_hypothesis가
    bad_absent_hypothesis 없이 받아들이는 shape. hypothesis_hash는 PR-B3가 계산.
    register payload shape (migration register_shadow_hypothesis가 읽는 키만).
    """
    if not _is_period_key(period_key):
        raise ShadowRunnerError(f"bad period_key: {period_key!r}")
    h = compute_hypothesis_hash(period_key, "absent", [], {}, None)
    return {
        "period_key": period_key,
        "source": "absent",
        "leading_sectors": [],
        "params": {},
        "as_of": None,
        "selection_as_of": selection_as_of,
        "hypothesis_hash": h,
    }


def build_hypothesis_from_env(
    period_key: str,
    selection_as_of: str,
    *,
    env: dict[str, str] | None = None,
) -> dict[str, Any]:
    """env에서 manual_pre_registered hypothesis 구성 (PRB3-2).

    NEVER SELECTs the DB — finalize RPC가 content-binding으로 drift를 잡는다. env만 읽는다:
      - SHADOW_SECTOR_SOURCE: 'absent' | 'manual_pre_registered' (그 외 → ShadowRunnerError)
      - SHADOW_LEADING_SECTORS: comma-separated canonical-14 (manual에서 non-empty 필수)
      - SHADOW_SECTOR_ASOF: as_of ISO instant (manual에서 필수, as_of < selection_as_of)
      - SHADOW_SOFT_TILT_PARAMS: JSON object (선택; D7-frozen tilt 파라미터)

    absent source면 build_absent_hypothesis로 위임한다(동일 deterministic shape).
    """
    if env is None:
        env = dict(os.environ)
    source = (env.get("SHADOW_SECTOR_SOURCE") or "absent").strip()
    if source not in _VALID_SOURCES:
        raise ShadowRunnerError(f"unsupported SHADOW_SECTOR_SOURCE: {source!r}")
    if source == "absent":
        return build_absent_hypothesis(period_key, selection_as_of)

    leading_sectors = _parse_leading_sectors_env(env.get("SHADOW_LEADING_SECTORS"))
    if not leading_sectors:
        raise ShadowRunnerError(
            "manual_pre_registered requires non-empty SHADOW_LEADING_SECTORS"
        )
    params = _parse_params_env(env.get("SHADOW_SOFT_TILT_PARAMS"))
    as_of = (env.get("SHADOW_SECTOR_ASOF") or "").strip() or None
    if as_of is None:
        raise ShadowRunnerError("manual_pre_registered requires SHADOW_SECTOR_ASOF")
    if not _asof_precedes(as_of, selection_as_of):
        raise ShadowRunnerError(
            f"as_of {as_of!r} must precede selection_as_of {selection_as_of!r}"
        )
    h = compute_hypothesis_hash(period_key, source, leading_sectors, params, as_of)
    return {
        "period_key": period_key,
        "source": source,
        "leading_sectors": leading_sectors,
        "params": params,
        "as_of": as_of,
        "selection_as_of": selection_as_of,
        "hypothesis_hash": h,
    }


def _parse_leading_sectors_env(raw: str | None) -> list[str]:
    if not raw:
        return []
    sectors = [s.strip() for s in raw.split(",") if s.strip()]
    bad = [s for s in sectors if s not in _CANONICAL_SET]
    if bad:
        raise ShadowRunnerError(f"non-canonical leading sector(s): {bad!r}")
    if len(sectors) != len(set(sectors)):
        raise ShadowRunnerError(f"duplicate leading sector(s): {sectors!r}")
    return _canonicalize_leading_sectors(sectors)


def _parse_params_env(raw: str | None) -> dict[str, Any]:
    if not raw or not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except (ValueError, TypeError) as exc:
        raise ShadowRunnerError(f"SHADOW_SOFT_TILT_PARAMS must be JSON object: {exc}") from exc
    if not isinstance(parsed, dict):
        raise ShadowRunnerError("SHADOW_SOFT_TILT_PARAMS must be a JSON object")
    if any(not isinstance(k, str) for k in parsed):
        raise ShadowRunnerError("SHADOW_SOFT_TILT_PARAMS keys must be strings")
    return parsed


def _asof_precedes(as_of: str, selection_as_of: str) -> bool:
    """instant 비교 (lexical 금지; PR-B1 _normalize_datetime와 동일 의도)."""
    try:
        a = SG._parse_hypothesis_datetime(as_of, "as_of")
        s = SG._parse_hypothesis_datetime(selection_as_of, "selection_as_of")
    except SG.ShadowInvalidInputError as exc:
        raise ShadowRunnerError(str(exc)) from exc
    return a < s


def build_sector_view(hypothesis: dict[str, Any]) -> dict[str, Any]:
    """RPC content-binding용 identity-subset sector_view (F5/PRB3-2, spec §5.4).

    PR-B3는 source/leadingSectors/hypothesisHash만 보낸다 — 저장값은 RPC가 hypothesis row에서
    derive하므로 (jsonb_set), present 필드만 content-bound. params/asOf/selectionAsOf는 보내지 않는다
    (보내면 정확히 일치해야만 통과; 불필요한 foot-gun). absent면 leadingSectors=[].
    """
    source = hypothesis["source"]
    return {
        "source": source,
        "leadingSectors": list(hypothesis.get("leading_sectors", [])),
        "hypothesisHash": hypothesis["hypothesis_hash"],
    }


# ============================================================================
# snapshot rows (F4)
# ============================================================================

def _isnan(x: Any) -> bool:
    return isinstance(x, float) and math.isnan(x)


def build_shadow_snapshot_rows(
    stocks: list[TF.StockRaw],
    uni_by_ticker: dict[str, dict],
    *,
    score_fn: Callable[[list[TF.StockRaw], str], list[TF.ScoredStock]] = TF.score_bpp_universe,
) -> list[dict[str, Any]]:
    """full-universe ranked snapshot — (ticker,bucket)당 1행 (F4, spec §3.7).

    bucket마다 score_bpp_universe(FULL universe) 1콜 → 입력 순서 ScoredStock(비eligible은 score=NaN).
    eligible(non-NaN)만 score desc로 rank(1..) 부여; NaN-score ineligible은 rank=None, tier0_score=None
    이지만 **여전히 snapshot에 포함**된다 → count(distinct ticker)==universe_size(분모 universe-wide).

    각 row: ticker / name / sector(sc.sector) / sector_source / induty_code / bucket / rank / tier0_score.
    sector_source·induty_code는 universe row(resolve_sectors_for_universe 결과)에서 가져온다.
    NaN-score는 JSON null로 — RPC snapshot_row CHECK는 rank null·score null을 허용한다.
    """
    rows: list[dict[str, Any]] = []
    for bucket in SS.BUCKETS:
        scored = score_fn(stocks, bucket)
        # eligible(non-NaN) score desc, tie-break ticker asc → full-universe rank within bucket.
        eligible = [sc for sc in scored if not _isnan(sc.score)]
        eligible.sort(key=lambda sc: (-sc.score, sc.ticker))
        rank_by_ticker = {sc.ticker: idx for idx, sc in enumerate(eligible, start=1)}
        for sc in scored:
            uni = uni_by_ticker.get(sc.ticker, {})
            score_present = not _isnan(sc.score)
            rows.append({
                "ticker": sc.ticker,
                "name": uni.get("name"),
                "sector": sc.sector,
                "sector_source": uni.get("sector_source"),
                "induty_code": uni.get("induty_code"),
                "bucket": bucket,
                "rank": rank_by_ticker.get(sc.ticker) if score_present else None,
                "tier0_score": round(sc.score, 2) if score_present else None,
            })
    return rows


# ============================================================================
# unresolved rows (CONTRACT-5)
# ============================================================================

def build_unresolved_rows(universe: list[dict]) -> list[dict[str, Any]]:
    """sector를 canonical-14로 못 푼 종목 진단 (spec §3.5, candidates와 미혼합).

    각 row: ticker / name / induty_code / sector_source. 'sector' 필드 없음(FIX-I).
    resolve_sectors_for_universe가 sector=='unresolved'로 표지한 행만 emit.
    """
    rows: list[dict[str, Any]] = []
    for u in universe:
        if u.get("sector") != SG.UNRESOLVED:
            continue
        rows.append({
            "ticker": u["ticker"],
            "name": u.get("name"),
            "induty_code": u.get("induty_code"),
            # resolve_sectors_for_universe sets sector_source in {override,mapper,unresolved};
            # unresolved 종목은 'unresolved'. fallback도 'unresolved'(RPC enum 안전).
            "sector_source": u.get("sector_source") or "unresolved",
        })
    return rows


def build_hard_gate_incomplete_result(
    stocks: list[TF.StockRaw],
    hypothesis: dict[str, Any],
) -> SG.ShadowSelectionsResult:
    leading = set(hypothesis.get("leading_sectors", []))
    full_tickers = sorted({s.ticker for s in stocks})
    gated_tickers = {s.ticker for s in stocks if s.sector in leading}
    h = hashlib.sha256()
    for ticker in full_tickers:
        h.update(ticker.encode("utf-8"))
        h.update(b"\x00")
    return {
        "selections": {bucket: [] for bucket in SS.BUCKETS},
        "counterfactual_cut": [
            ticker for ticker in full_tickers if ticker not in gated_tickers
        ],
        "sector_distribution": {},
        "universe_hash": h.hexdigest(),
        "universe_size": len(full_tickers),
        "gate_eligible_size": len(gated_tickers),
    }


# ============================================================================
# arm payload (F3, CONTRACT-2/3b, GOTCHA-2)
# ============================================================================

def build_arm_rows(
    arm_result: SG.ShadowSelectionsResult,
    name_by_ticker: dict[str, str],
    month: date,
) -> list[dict[str, Any]]:
    """arm.selections → 150 candidate row dicts (F3).

    build_bpp_candidate_rows(selections) → candidate_row_to_db_dict 그대로 재사용 →
    {month,ticker,name,sector,bucket,rank,tier0_score,signal_label}. RPC는 month 키를 무시한다.
    rank = enumerate(1..50) per bucket, tier0_score = round(sc.score,2) — build_bpp_candidate_rows가 산출.
    """
    candidate_rows = SS.build_bpp_candidate_rows(
        arm_result["selections"], name_by_ticker, month
    )
    return [SS.candidate_row_to_db_dict(r) for r in candidate_rows]


def build_arm_payload(
    arm: str,
    arm_result: SG.ShadowSelectionsResult | None,
    name_by_ticker: dict[str, str],
    month: date,
    *,
    status: str = "logged",
    error: str | None = None,
) -> dict[str, Any]:
    """단일 arm 객체 (CONTRACT-2). per-arm disjoint 필드만 — run-level 키는 절대 넣지 않는다(F5).

    포함 키: arm, status, rows, counterfactual_cut, sector_distribution, (hard-gate만)gate_eligible_size, error.
    - status=='logged' & arm_result 있음 → rows = 150 dicts.
    - status!='logged' (incomplete_run/invalid_input) 또는 arm_result None → rows=[], 진단 metadata 보존.
    - gate_eligible_size: hard-gate에서만 non-null(GOTCHA-2). mirror/soft-tilt에서는 키 자체를 안 넣는다.
    """
    if arm not in ARMS:
        raise ShadowRunnerError(f"unknown arm: {arm!r}")
    if status not in _VALID_STATUSES:
        raise ShadowRunnerError(f"unknown status: {status!r}")

    obj: dict[str, Any] = {"arm": arm, "status": status}

    if arm_result is not None:
        obj["rows"] = (
            build_arm_rows(arm_result, name_by_ticker, month) if status == "logged" else []
        )
        obj["counterfactual_cut"] = list(arm_result.get("counterfactual_cut", []))
        obj["sector_distribution"] = dict(arm_result.get("sector_distribution", {}))
        # gate_eligible_size: hard-gate non-null만 (RPC: gate_eligible_size_only_for_hard_gate).
        if arm == "sector-hard-gate":
            ges = arm_result.get("gate_eligible_size")
            if ges is None:
                raise ShadowRunnerError(
                    "sector-hard-gate arm_result missing gate_eligible_size"
                )
            obj["gate_eligible_size"] = int(ges)
    else:
        obj["rows"] = []
        obj["counterfactual_cut"] = []
        obj["sector_distribution"] = {}
        # ce-review LOW: a hard-gate arm with NO result (e.g. invalid_input) still needs gate_eligible_size,
        #   else the RPC's gate_eligible_size_required_for_hard_gate (fires for ANY hard-gate arm) aborts the whole
        #   finalize. Emit 0 so the arm is RPC-conformant for any status (incomplete_run path supplies a real
        #   count via build_hard_gate_incomplete_result; this is the no-result fallback only). Symmetric fail-closed.
        if arm == "sector-hard-gate":
            obj["gate_eligible_size"] = 0

    if error is not None:
        obj["error"] = error
    return obj


# ============================================================================
# run-level envelope (F5, CONTRACT-1, GOTCHA-1/3)
# ============================================================================

def assemble_finalize_payload(
    *,
    period_key: str,
    month: date,
    run_id: str,
    hypothesis_id: str,
    hypothesis: dict[str, Any],
    arm_payloads: list[dict[str, Any]],
    snapshot_rows: list[dict[str, Any]],
    unresolved_rows: list[dict[str, Any]],
    universe_hash: str,
    universe_size: int,
    run_date: str | None = None,
) -> dict[str, Any]:
    """run-level finalize envelope (CONTRACT-1). RPC upsert_tier0_shadow_run(p_payload)에 그대로 전달.

    run-level 키(period_key/month/run_id/hypothesis_id/universe_hash/universe_size/sector_view/run_date)는
    여기서만 1회 설정한다 — RPC가 각 arm에 merge(run-level wins)하므로 arm에 중복 주입 금지(F5).
    GOTCHA-1: non-mirror arm이 있으면 production-mirror도 반드시 포함되어야 RPC가 받아준다 — 여기서 선검증.
    GOTCHA-3: snapshot은 universe_size 이상 + distinct ticker == universe_size 여야 한다 — 여기서 선검증.
    """
    if not run_id:
        raise ShadowRunnerError("run_id required")
    if not hypothesis_id:
        raise ShadowRunnerError("hypothesis_id required")
    if not universe_hash:
        raise ShadowRunnerError("universe_hash required")
    if not isinstance(universe_size, int) or universe_size < 150:
        raise ShadowRunnerError(f"universe_size must be int >= 150: {universe_size!r}")
    if not _is_period_key(period_key):
        raise ShadowRunnerError(f"bad period_key: {period_key!r}")

    # arm-set guards (GOTCHA-1 + duplicate-arm + 1..3 count) — RPC도 강제하나 여기서 일찍 catch.
    if not (1 <= len(arm_payloads) <= 3):
        raise ShadowRunnerError(f"arms must be 1..3, got {len(arm_payloads)}")
    arm_names = [a["arm"] for a in arm_payloads]
    if len(arm_names) != len(set(arm_names)):
        raise ShadowRunnerError(f"duplicate arm in payload: {arm_names!r}")
    if any(a != "production-mirror" for a in arm_names) and "production-mirror" not in arm_names:
        raise ShadowRunnerError(
            "production_mirror_required_for_paired_run: non-mirror arm without production-mirror"
        )

    # snapshot completeness guard (GOTCHA-3).
    distinct_snapshot = {r["ticker"] for r in snapshot_rows}
    if len(snapshot_rows) < universe_size:
        raise ShadowRunnerError(
            f"snapshot_rows {len(snapshot_rows)} < universe_size {universe_size}"
        )
    if len(distinct_snapshot) != universe_size:
        raise ShadowRunnerError(
            f"snapshot distinct ticker {len(distinct_snapshot)} != universe_size {universe_size}"
        )

    payload: dict[str, Any] = {
        "period_key": period_key,
        "month": _month_str(month),
        "run_id": run_id,
        "hypothesis_id": hypothesis_id,
        "universe_hash": universe_hash,
        "universe_size": universe_size,
        "sector_view": build_sector_view(hypothesis),
        "snapshot_rows": snapshot_rows,
        "arms": arm_payloads,
        "unresolved_rows": unresolved_rows,
    }
    if run_date is not None:
        payload["run_date"] = run_date
    return payload
