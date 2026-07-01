import { AlertTriangle, CalendarX, Clock, SearchX } from "lucide-react";
import type { ShortageReason } from "@/types/admin";
import { SHORTLIST_TARGET_COUNT } from "@/types/admin";

interface MissingCountBannerProps {
  activeCount: number;
  reason: ShortageReason;
  // 스케줄러 실패 시 전월 유지 정보
  fallbackMonth?: string;
}

// T1.6 30종 미달 경고 배너 (R3.8-5). 원인 3종 분리 + 전월 유지 표시.
// reason === "none" 또는 activeCount ≥ 30이면 렌더 안 함.
export function MissingCountBanner({
  activeCount,
  reason,
  fallbackMonth,
}: MissingCountBannerProps) {
  if (reason === "none" || activeCount >= SHORTLIST_TARGET_COUNT) return null;

  const shortage = SHORTLIST_TARGET_COUNT - activeCount;

  // W2a 트랙 분리(단기 주1회 / 중장기 월1회) finalize 시차 — 스크리닝 미달이 아님(정상 상태).
  if (reason === "track_pending") {
    return (
      <div
        role="status"
        className="flex flex-wrap items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm shadow-toss-sm"
      >
        <Clock
          className="mt-0.5 h-5 w-5 shrink-0 text-warning"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-warning">
            단기/중장기 선정 시차 — 갱신 진행 중
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            단기(주1회)·중장기(월1회) 선정 주기가 달라 일부 구간이 아직 갱신되지
            않았습니다 ({activeCount}/{SHORTLIST_TARGET_COUNT}종). 비어 있는
            구간은 다음 선정 주기에 채워집니다 (조건 미달 아님).
          </p>
        </div>
      </div>
    );
  }

  if (reason === "screening") {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm shadow-toss-sm"
      >
        <SearchX
          className="mt-0.5 h-5 w-5 shrink-0 text-warning"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-warning tabular-nums">
            추천 조건 미달 — {activeCount}/{SHORTLIST_TARGET_COUNT}종
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            선정 엔진이 이번 달 30종 조건을 충족한 종목을 {activeCount}개만
            반환했습니다. {shortage}개 자리는 공란으로 둡니다 (임의 보충하지
            않음).
          </p>
        </div>
      </div>
    );
  }

  // scheduler_fail
  return (
    <div
      role="alert"
      className="flex flex-wrap items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm shadow-toss-sm"
    >
      <CalendarX
        className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-destructive">
          <AlertTriangle
            className="-mt-0.5 mr-1 inline h-3.5 w-3.5"
            aria-hidden
          />
          자동 선정 실패 — 전월({fallbackMonth ?? "미확인"}) 목록 유지
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          월간 자동 선정이 이번 달 실행에 실패해 전월 추천 목록을 그대로
          유지합니다. 상세는 시스템 상태(/admin/settings/health)에서 확인하세요.
        </p>
      </div>
    </div>
  );
}
