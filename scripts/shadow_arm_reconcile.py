#!/usr/bin/env python3
"""주픽(JooPick) — Track 1 PR-A4: shadow_arm_log reconcile REPORT (report-only).

SoT: docs/superpowers/specs/2026-06-19-pathA-forward-shadow-sector-layer.md §2.2/§10(PR-A4)/§6.5.

목적: finalize된 selection period(tier1_selection_run.finalized_at != null) 중 shadow_arm_log가
  불완전한 period를 식별한다. PR-A2 worker seam은 4 arm을 **비원자적** 루프(per-arm upsert RPC)로
  기록하므로, 프로세스가 persist+markSelectionFinalized 후 shadow 루프 도중 죽으면 1~3 arm만 남는
  'partial' 상태가 발생할 수 있다(production money-path은 여전히 정확 — persist는 선행 완료).

**report-only (backfill EXECUTOR 폐기)** — PR-B4(Track 2 reconcile) 전례 정합. shadow arm 산출 입력
  (computeArmSelections의 full pool: candidates=fresh∪incumbents + productionResult + 그 시점 sector
  hypothesis config)은 worker 사망과 함께 소실되어 사후 재구성 불가하다. production-snapshot 한 arm은
  short_list_30에서 재유도 가능하나 sector/regime/hard-gate arm은 불가 → 진정한 backfill은 구조적 불능.
  따라서 reconcile은 gap을 REPORT하고, stage-1(PR-A5 harvest/kill)이 partial/missing/anomaly period를
  제외(INCOMPLETE_RUN)하도록 문서화만 한다. shadow_arm_log/production tables를 절대 write하지 않는다.

read 경로: shadow_arm_log는 0038에서 service_role SELECT 허용(§5.2 Track-1 reconcile reader) — 즉 이
  스크립트의 owner/service-role psql read 모두 가능. classification은 pure Python(단일 SoT).
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any

# computeArmSelections가 산출하는 arm 수(production-snapshot + sector-soft-reserve +
# regime-sector-soft-reserve + candidate-pool-hard-gate). logger는 매 finalize마다 4 arm 전부 upsert.
EXPECTED_ARMS = 4

# ===========================================================================
# OWNER/service-role psql gap-detection query (MATERIALIZED CTE — §259 race-stable single statement).
# ===========================================================================
RECONCILE_GAP_SQL = """\
-- PR-A4 reconcile gap detection (Track 1 forward-shadow). owner/service-role psql-run.
--   WITH ... AS MATERIALIZED: 각 CTE를 한 번만 평가해 단일 MVCC snapshot에서 LEFT JOIN의 양쪽을 읽는다
--   (동시 upsert_shadow_arm_log commit이 두 side를 다른 snapshot에서 읽는 read-side race 차단,
--   feedback_pg_skip_locked_claim_anti_pattern의 read 유사물). queue claim 아님: read-only, no SKIP
--   LOCKED, no UPDATE. RAW FACTS만 emit — 분류는 Python classify_coverage_row(단일 SoT).
with finalized as materialized (
  -- finalize 완료된 (period_key, track). period_key는 tier1_selection_run PK라 (period_key,track) unique.
  select period_key, track
  from public.tier1_selection_run
  where finalized_at is not null
),
arms as materialized (
  -- shadow_arm_log의 period+track별 arm 커버리지 facts. unique(period_key,track,arm)이라 arm당 1행 →
  -- count(*) == count(distinct arm). logged_arm_count는 PR-A5 observability(§6.5): counterfactual arm이
  -- incomplete_run이면 logged_arm_count < arm_count로 드러난다(stage-1이 sector-gate 효과 vs degradation-drop
  -- 혼동을 피하도록). complete 분류 gate는 아님(incomplete_run은 §2.2상 consumable terminal state).
  select
    period_key,
    track,
    count(distinct arm)                                              as arm_count,
    count(*) filter (where status = 'logged')                        as logged_arm_count,
    bool_or(arm = 'production-snapshot' and status = 'logged')       as production_snapshot_logged
  from public.shadow_arm_log
  group by period_key, track
)
select
  f.period_key,
  f.track,
  coalesce(a.arm_count, 0)                    as arm_count,
  coalesce(a.logged_arm_count, 0)             as logged_arm_count,
  coalesce(a.production_snapshot_logged, false) as production_snapshot_logged
from finalized f
left join arms a on a.period_key = f.period_key and a.track = f.track
order by f.period_key, f.track;
"""


class ShadowArmReconcileInputError(ValueError):
    """PR-A4 pure-core fail-closed: malformed coverage_rows. main()은 hard abort(write 0, verdict 0)."""


# ===========================================================================
# fail-closed field extractors (feedback_failclosed_symmetric_completion):
#   type-check BEFORE use; no truthiness coercion; reject wrong type, not just absence.
# ===========================================================================
def _require_dict(value: Any, what: str) -> dict:
    if not isinstance(value, dict):
        raise ShadowArmReconcileInputError(f"{what} must be a dict, got {type(value).__name__}")
    return value


def _require_str(row: dict, key: str, what: str) -> str:
    if key not in row:
        raise ShadowArmReconcileInputError(f"{what}: missing '{key}'")
    v = row[key]
    if not isinstance(v, str) or not v:
        raise ShadowArmReconcileInputError(f"{what}: '{key}' must be a non-empty str, got {v!r}")
    return v


def _require_int(row: dict, key: str, what: str) -> int:
    if key not in row:
        raise ShadowArmReconcileInputError(f"{what}: missing '{key}'")
    v = row[key]
    # bool은 int subclass — True/False가 1/0으로 coerce되지 않도록 명시 거부.
    if isinstance(v, bool) or not isinstance(v, int):
        raise ShadowArmReconcileInputError(f"{what}: '{key}' must be int, got {type(v).__name__}")
    if v < 0:
        raise ShadowArmReconcileInputError(f"{what}: '{key}' must be >= 0, got {v}")
    return v


def _require_bool(row: dict, key: str, what: str) -> bool:
    if key not in row:
        raise ShadowArmReconcileInputError(f"{what}: missing '{key}'")
    v = row[key]
    if not isinstance(v, bool):
        raise ShadowArmReconcileInputError(f"{what}: '{key}' must be bool, got {type(v).__name__}")
    return v


# ===========================================================================
# classification — single source of truth (gap SQL은 raw facts만 emit)
# ===========================================================================
def classify_coverage_row(row: dict) -> dict:
    """finalize된 ONE (period_key, track)의 shadow_arm_log 커버리지를 raw facts에서 분류.

    Input row = RECONCILE_GAP_SQL 한 줄: {period_key, track, arm_count, logged_arm_count,
    production_snapshot_logged}.
    Returns {period_key, track, arm_count, logged_arm_count, production_snapshot_logged, status, reason}
    where status ∈:
      - 'complete' : arm_count == 4 AND production-snapshot status='logged'. **NOTE(§2.2/§6.5)**: 4 arm이
                     전부 **존재**(logged 또는 incomplete_run으로 닫힘)하면 complete다 — counterfactual arm
                     (특히 hard-gate)이 incomplete_run인 것은 §2.2상 '닫힌'(consumable) terminal state이지
                     logging gap이 아니다. 그 경우 logged_arm_count < arm_count로 드러나며(PR-A5가 §6.5
                     degradation-drop 혼동 방지에 사용), complete 분류를 막지 않는다(과차단 회피).
      - 'partial'  : 0 < arm_count < 4. PR-A2 logger 루프가 비원자적이라 persist 후 shadow 루프 도중
                     사망 → 일부 arm만 기록. money-path은 정확(persist 선행). stage-1 제외 대상.
      - 'missing'  : arm_count == 0. shadow OFF(FORWARD_SHADOW_ENABLED 미설정)이거나 루프 진입 전 사망 —
                     **구분 불가(ambiguous)**. report-only(backfill 불능: 입력 소실).
      - 'anomaly'  : arm_count == 4 인데 production-snapshot이 logged 아님(RPC가 production-snapshot
                     status='logged'를 강제하므로 정상 경로상 불가 → 직접 tamper/out-of-contract write).
                     크게 surface(silent 'complete' 금지).
    Fail-closed(ShadowArmReconcileInputError): non-dict row / 누락·타입오류 field / period_key·track 부정.
    """
    row = _require_dict(row, "coverage row")
    period_key = _require_str(row, "period_key", "coverage row")
    track = _require_str(row, "track", "coverage row")
    if track not in ("short", "midlong"):
        raise ShadowArmReconcileInputError(f"coverage row: bad track {track!r}")
    # A3: period_key prefix ⟺ track 일관성(fail-closed; gap-SQL은 0031/0038 CHECK로 못 내지만 hand-fed
    #     --coverage-json은 가능 — classifier가 'single source of truth'이므로 out-of-contract row 거부).
    if (track == "short") != period_key.startswith("s:") or (track == "midlong") != period_key.startswith("m:"):
        raise ShadowArmReconcileInputError(
            f"coverage row: period_key {period_key!r} prefix does not match track {track!r}"
        )
    arm_count = _require_int(row, "arm_count", "coverage row")
    if arm_count > EXPECTED_ARMS:
        # arm CHECK가 4종으로 제한 → count(distinct arm) > 4는 구조적 불가. 방어적 거부.
        raise ShadowArmReconcileInputError(
            f"coverage row: arm_count {arm_count} > EXPECTED_ARMS {EXPECTED_ARMS}"
        )
    logged_arm_count = _require_int(row, "logged_arm_count", "coverage row")
    if logged_arm_count > arm_count:
        raise ShadowArmReconcileInputError(
            f"coverage row: logged_arm_count {logged_arm_count} > arm_count {arm_count}"
        )
    production_snapshot_logged = _require_bool(row, "production_snapshot_logged", "coverage row")

    if arm_count == 0:
        status, reason = "missing", (
            "finalize됐으나 shadow_arm_log row 0 — shadow OFF이거나 logger 루프 진입 전 사망(ambiguous). "
            "backfill 불능(입력 소실); stage-1 제외."
        )
    elif arm_count == EXPECTED_ARMS and production_snapshot_logged:
        status, reason = "complete", None
    elif 0 < arm_count < EXPECTED_ARMS:
        status, reason = "partial", (
            f"arm {arm_count}/{EXPECTED_ARMS} — logger 비원자적 루프가 shadow 기록 도중 사망. "
            "money-path은 정확(persist 선행); backfill 불능; stage-1 제외."
        )
    else:
        status, reason = "anomaly", (
            f"arm {arm_count}/{EXPECTED_ARMS}인데 production-snapshot logged 아님 — RPC가 강제하므로 "
            "정상 경로 불가. 직접 tamper/out-of-contract write 의심; harvest 전 조사."
        )

    return {
        "period_key": period_key,
        "track": track,
        "arm_count": arm_count,
        "logged_arm_count": logged_arm_count,
        "production_snapshot_logged": production_snapshot_logged,
        "status": status,
        "reason": reason,
    }


def summarize(classified: list[dict]) -> dict:
    counts = {"complete": 0, "partial": 0, "missing": 0, "anomaly": 0}
    for c in classified:
        counts[c["status"]] = counts.get(c["status"], 0) + 1
    return {
        "total_finalized_periods": len(classified),
        "counts": counts,
        # stage-1(PR-A5) 진입 가능 여부: partial/anomaly가 있으면 그 period 제외 필요(blocking).
        "stage1_blocked_periods": [
            {"period_key": c["period_key"], "track": c["track"], "status": c["status"]}
            for c in classified
            if c["status"] in ("partial", "anomaly", "missing")
        ],
    }


# ===========================================================================
# main — thin I/O (gap SQL은 owner/service-role psql이 실행; 본 스크립트는 분류·요약만)
# ===========================================================================
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Track 1 PR-A4 shadow_arm_log reconcile REPORT (report-only).")
    parser.add_argument("--print-sql", action="store_true", help="RECONCILE_GAP_SQL을 출력(owner psql 실행용).")
    parser.add_argument("--coverage-json", help="RECONCILE_GAP_SQL 결과(json_agg row 배열) 파일 경로.")
    args = parser.parse_args(argv)

    if args.print_sql:
        print(RECONCILE_GAP_SQL)
        return 0

    if not args.coverage_json:
        parser.error("either --print-sql or --coverage-json is required")

    try:
        with open(args.coverage_json, encoding="utf-8") as f:
            raw = json.load(f)
    except (OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        print(f"[ABORT] coverage-json read/parse failed: {exc}", file=sys.stderr)
        return 2

    # A2(PR-B4 parity): 0 finalized periods + bare `json_agg(...)`(coalesce 미적용) → SQL NULL → JSON null.
    #   빈 coverage report로 정규화(abort 아님). coalesce wrapper 사용 시엔 '[]'라 무관.
    if raw is None:
        raw = []
    if not isinstance(raw, list):
        print(f"[ABORT] coverage-json must be a JSON array, got {type(raw).__name__}", file=sys.stderr)
        return 2

    try:
        classified = [classify_coverage_row(r) for r in raw]
    except ShadowArmReconcileInputError as exc:
        print(f"[ABORT] {exc}", file=sys.stderr)
        return 2

    report = {"rows": classified, "summary": summarize(classified)}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    # partial/anomaly가 있으면 비-0 exit(stage-1 gating 신호) — missing은 ambiguous라 0(report-only).
    blocking = [c for c in classified if c["status"] in ("partial", "anomaly")]
    return 1 if blocking else 0


if __name__ == "__main__":
    raise SystemExit(main())
