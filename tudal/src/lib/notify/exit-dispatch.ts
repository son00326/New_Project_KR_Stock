import type { AlertEvent } from "@/types/admin";

// ---------------------------------------------------------------------------
// M15 Exit 시그널 디스패치 — 텔레그램 best-effort + /admin durable 2-layer (S7c rework)
// ref: ServicePlan-Admin §3.10 R3.10-15 · D10 (72차 override 2026-06-XX)
//
// 72차 사용자 override: 이메일/Resend/SMS 전역 제거.
//   - 채널: 텔레그램 best-effort(실패해도 caller escalate 안 함) + `/admin/alerts` durable event
//           + 대시보드 unread badge.
//   - durable alert_event INSERT는 **항상** 호출부 책임(텔레그램 미설정/실패여도 catch-up 보장).
//   - 즉, telegram 실패 = badge/durable이 안전망(D10 재정의 = durable+badge, 이메일 재시도 폐기).
//
// 본 모듈은 순수 로직 — sendTelegram 주입형. Vitest 친화.
// ---------------------------------------------------------------------------

export interface ExitChannelResult {
  channel: "telegram";
  success: boolean;
  mockMode: boolean;
  error?: string;
}

export interface ExitDispatchInput {
  telegramText: string;
  sendTelegram: (
    text: string,
  ) => Promise<{ success: boolean; mockMode: boolean; error?: string }>;
}

export interface ExitDispatchOutcome {
  telegram: ExitChannelResult;
  /** durable alert_event INSERT는 항상 필요 (호출부 책임). */
  durableRequired: true;
  /** 텔레그램 실제 전달 여부 (mock-mode 성공은 전달 아님). */
  telegramDelivered: boolean;
}

export async function dispatchExitSignal(
  input: ExitDispatchInput,
): Promise<ExitDispatchOutcome> {
  let res: { success: boolean; mockMode: boolean; error?: string };
  try {
    res = await input.sendTelegram(input.telegramText);
  } catch (err) {
    // best-effort — 텔레그램 예외가 caller를 escalate하지 않음. durable이 안전망.
    res = {
      success: false,
      mockMode: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const telegram: ExitChannelResult = {
    channel: "telegram",
    success: res.success,
    mockMode: res.mockMode,
    error: res.error,
  };

  return {
    telegram,
    durableRequired: true,
    telegramDelivered: res.success && !res.mockMode,
  };
}

// AlertEvent → 텔레그램 텍스트 (짧게, 마크다운 안 씀). 대안 3종은 대시보드에서 확인.
export function buildExitTelegramText(
  alert: Omit<AlertEvent, "id" | "isRead">,
): string {
  const lines = [
    "🚨 Exit 시그널",
    alert.ticker ? `종목 ${alert.ticker}` : "시장 전체",
    `심각도: ${alert.severity.toUpperCase()}`,
    `트리거: ${alert.triggerReason}`,
    `발송: ${new Date(alert.signalSentAt).toLocaleString("ko-KR", { hour12: false })}`,
    "대시보드 /admin/alerts 에서 대안 3종(매도 전량/분할매도/홀딩) 확인 및 결정 기록.",
  ];
  return lines.join("\n");
}
