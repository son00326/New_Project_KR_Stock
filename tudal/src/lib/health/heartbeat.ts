// ---------------------------------------------------------------------------
// M19 Silent Health 일간 하트비트 (S6 T6.5)
// ref: ServicePlan-Admin §3.12 R3.12-7~8
//
// 자정 배치(00:00 KST = 15:00 UTC 전일) 실행:
//   1) 전일 24h 파이프라인 헬스 5종 집계 (S5a aggregatePipelineHealth 재사용)
//   2) Critical AlertEvent / Warning AlertEvent 카운트
//   3) status 결정:
//        - Critical 알림 ≥1 OR Warning ≥5 OR Critical 파이프라인 ≥1 → 'red_alert'
//        - 그 외 → 'ok' ("오늘 이상 없음")
//   4) 메시지 빌드 후 텔·이메일 2채널 발송 (BL-12 폐기)
//   5) 2채널 모두 실패 시 D10 catch-up = 이메일 1회 재시도 (exit-dispatch와 동일 패턴)
//   6) 그래도 실패 시 heartbeat_missing AlertEvent + sendFailed=true 적재
//
// 본 모듈은 순수 로직 — 실 발송은 호출부(/api/cron/silent-health)에서 주입.
// ---------------------------------------------------------------------------

import { aggregatePipelineHealth } from "@/lib/health/pipeline-health";
import {
  type AlertEvent,
  type HeartbeatLog,
  type HeartbeatStatus,
  type PipelineHealth,
  HEARTBEAT_RED_ALERT_CRITICAL_MIN,
  HEARTBEAT_RED_ALERT_WARNING_MIN,
} from "@/types/admin";

export interface HeartbeatInput {
  date: string; // YYYY-MM-DD (KST, 집계 대상일 = 전일)
  pipelineHealth: PipelineHealth[];
  recentAlerts: AlertEvent[]; // 24h window — 호출부가 필터링 후 주입
  referenceNow: Date; // 24h 윈도우 기준점 (테스트 가능)
}

export function classifyHeartbeat(input: HeartbeatInput): {
  status: HeartbeatStatus;
  pipelineSummary: HeartbeatLog["pipelineSummary"];
  criticalAlertCount: number;
  warningAlertCount: number;
} {
  const summaries = aggregatePipelineHealth(input.pipelineHealth, {
    now: input.referenceNow,
  });
  const criticalAlerts = input.recentAlerts.filter(
    (a) => a.severity === "critical",
  );
  const warningAlerts = input.recentAlerts.filter(
    (a) => a.severity === "warning",
  );
  const hasCriticalPipeline = summaries.some((s) => s.severity === "critical");
  const status: HeartbeatStatus =
    hasCriticalPipeline ||
    criticalAlerts.length >= HEARTBEAT_RED_ALERT_CRITICAL_MIN ||
    warningAlerts.length >= HEARTBEAT_RED_ALERT_WARNING_MIN
      ? "red_alert"
      : "ok";

  return {
    status,
    pipelineSummary: summaries.map((s) => ({
      pipeline: s.pipeline,
      successRate: s.successRate,
      severity: s.severity,
    })),
    criticalAlertCount: criticalAlerts.length,
    warningAlertCount: warningAlerts.length,
  };
}

export function buildHeartbeatMessage(
  classification: ReturnType<typeof classifyHeartbeat>,
  date: string,
): string {
  const { status, pipelineSummary, criticalAlertCount, warningAlertCount } =
    classification;
  if (status === "ok") {
    const lines = [
      `✅ [주픽] ${date} — 오늘 이상 없음`,
      "",
      "5개 파이프라인 모두 정상. Critical 알림 0건.",
      ...pipelineSummary.map(
        (p) => `· ${p.pipeline}: ${(p.successRate * 100).toFixed(1)}%`,
      ),
    ];
    return lines.join("\n");
  }
  const issues: string[] = [];
  pipelineSummary
    .filter((p) => p.severity !== "info")
    .forEach((p) =>
      issues.push(
        `· 파이프라인 ${p.pipeline}: ${(p.successRate * 100).toFixed(1)}% (${p.severity})`,
      ),
    );
  if (criticalAlertCount > 0) issues.push(`· Critical 알림 ${criticalAlertCount}건`);
  if (warningAlertCount > 0) issues.push(`· Warning 알림 ${warningAlertCount}건`);

  const lines = [
    `🚨 [주픽] ${date} — 적색 경보`,
    "",
    "최근 24h 이상 징후:",
    ...issues,
    "",
    "/admin/settings/health 와 /admin/alerts 에서 상세 확인.",
  ];
  return lines.join("\n");
}

export function buildHeartbeatEmailSubject(
  status: HeartbeatStatus,
  date: string,
): string {
  return status === "ok"
    ? `[주픽 하트비트] ${date} — 이상 없음`
    : `[주픽 하트비트] ${date} — 🚨 적색 경보`;
}

// HeartbeatLog INSERT 페이로드 빌드 (id 제외)
export function toHeartbeatLogRecord(
  classification: ReturnType<typeof classifyHeartbeat>,
  date: string,
  message: string,
  sentChannels: string[],
  sendFailed: boolean,
): Omit<HeartbeatLog, "id"> {
  return {
    date,
    status: classification.status,
    generatedAt: new Date().toISOString(),
    pipelineSummary: classification.pipelineSummary,
    criticalAlertCount: classification.criticalAlertCount,
    warningAlertCount: classification.warningAlertCount,
    sentChannels,
    sendFailed,
    message,
  };
}

// D10 catch-up 실패 시 heartbeat_missing AlertEvent 페이로드
export function buildHeartbeatMissingAlert(
  date: string,
  reason: string,
): Omit<AlertEvent, "id" | "isRead"> {
  return {
    alertType: "heartbeat_missing",
    ticker: null,
    severity: "critical",
    triggerReason: `일간 하트비트 발송 실패 (${date}). 텔·이메일 양쪽 catch-up도 실패. 사유: ${reason}`,
    signalSentAt: new Date().toISOString(),
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
  };
}
