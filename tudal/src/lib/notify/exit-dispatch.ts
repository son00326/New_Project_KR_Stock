import type { AlertEvent } from "@/types/admin";

// ---------------------------------------------------------------------------
// M15 Exit 시그널 2채널 디스패치 + D10 catch-up (S5b T5b.3)
// ref: ServicePlan-Admin §3.10 R3.10-11~15 · D10 (22차 재결정: SMS 제거)
//
// 22차 결정 (2026-04-19):
//   - BL-12 폐기: SMS 백업 제거. 어드민 3명·500cap·텔레그램 푸시가 잠금화면 대체.
//   - D10 catch-up = 이메일 1회 추가 재시도로 축소.
//   - 채널: 텔레그램 + 이메일 + /admin 배지(DB 기록).
//
// 플로우:
//   1. 텔·이메일 동시 발송 시도.
//   2. 1개 실패 시: 다른 채널은 정상 → catch-up 완료 (D10 발동 안 함).
//   3. 2개 모두 실패 시: 이메일 1회 재시도 (D10 발동). 성공 시 정상.
//   4. 재시도도 실패: allFailed=true. /admin 배지는 무조건 노출 (호출부 책임).
//
// 본 모듈은 순수 로직 — sendTelegram·sendEmail 주입형. Vitest 친화.
// ---------------------------------------------------------------------------

export type ExitChannel = "telegram" | "email";

export interface ExitChannelResult {
  channel: ExitChannel;
  success: boolean;
  mockMode: boolean;
  error?: string;
  attempts: number; // 이메일은 최대 2 (초기 + D10 재시도)
}

export interface ExitDispatchInput {
  alert: Omit<AlertEvent, "id" | "isRead">;
  telegramText: string;
  emailSubject: string;
  emailText: string;
  emailHtml?: string;
  recipients: string[]; // 어드민 이메일 배열
  sendTelegram: (text: string) => Promise<{ success: boolean; mockMode: boolean; error?: string }>;
  sendEmail: (payload: {
    to: string[];
    subject: string;
    text: string;
    html?: string;
  }) => Promise<{ success: boolean; mockMode: boolean; error?: string }>;
}

export interface ExitDispatchOutcome {
  telegram: ExitChannelResult;
  email: ExitChannelResult;
  d10Triggered: boolean; // 2채널 모두 초기 실패 시 true
  allFailed: boolean;    // 텔+이메일(재시도 포함) 모두 실패 시 true
  badgeRequired: boolean; // allFailed와 동일 (배지는 항상 DB 기록이지만 allFailed면 최소 1채널 보장 의미로 배지 필수)
}

export async function dispatchExitSignal(
  input: ExitDispatchInput,
): Promise<ExitDispatchOutcome> {
  const [telegramRes, emailRes] = await Promise.all([
    input.sendTelegram(input.telegramText),
    input.sendEmail({
      to: input.recipients,
      subject: input.emailSubject,
      text: input.emailText,
      html: input.emailHtml,
    }),
  ]);

  const telegram: ExitChannelResult = {
    channel: "telegram",
    success: telegramRes.success,
    mockMode: telegramRes.mockMode,
    error: telegramRes.error,
    attempts: 1,
  };

  let email: ExitChannelResult = {
    channel: "email",
    success: emailRes.success,
    mockMode: emailRes.mockMode,
    error: emailRes.error,
    attempts: 1,
  };

  const bothFailedInitially = !telegramRes.success && !emailRes.success;

  if (bothFailedInitially) {
    // D10 catch-up: 이메일 1회 추가 재시도 (텔레그램은 WebSocket/Bot 특성상 재시도로 해결될 가능성 낮음)
    const retry = await input.sendEmail({
      to: input.recipients,
      subject: input.emailSubject,
      text: input.emailText,
      html: input.emailHtml,
    });
    email = {
      channel: "email",
      success: retry.success,
      mockMode: retry.mockMode,
      error: retry.error,
      attempts: 2,
    };
  }

  const allFailed = !telegram.success && !email.success;
  return {
    telegram,
    email,
    d10Triggered: bothFailedInitially,
    allFailed,
    badgeRequired: allFailed,
  };
}

// AlertEvent → 텔레그램 텍스트 (짧게, 마크다운 안 씀)
export function buildExitTelegramText(
  alert: Omit<AlertEvent, "id" | "isRead">,
): string {
  const lines = [
    "🚨 Exit 시그널",
    alert.ticker ? `종목 ${alert.ticker}` : "시장 전체",
    `심각도: ${alert.severity.toUpperCase()}`,
    `트리거: ${alert.triggerReason}`,
    `발송: ${new Date(alert.signalSentAt).toLocaleString("ko-KR", { hour12: false })}`,
    "대시보드에서 대안 시나리오 3종(매도 전량/분할매도/홀딩) 확인 및 결정 기록 필요.",
  ];
  return lines.join("\n");
}

export function buildExitEmailText(
  alert: Omit<AlertEvent, "id" | "isRead">,
): string {
  return [
    `[주픽] Exit 시그널 — ${alert.ticker ?? "시장 전체"}`,
    "",
    `심각도: ${alert.severity.toUpperCase()}`,
    `트리거 사유: ${alert.triggerReason}`,
    `발송 시각: ${new Date(alert.signalSentAt).toLocaleString("ko-KR", { hour12: false })}`,
    "",
    "어드민 대시보드 /admin/alerts 에서 대안 시나리오(매도 전량/분할매도/홀딩)를 확인하고 결정 기록을 입력하세요.",
    "T+7일 후 해당 종목 가격 변화가 자동 적재되어 IM-3(Exit 시그널 신뢰도)에 반영됩니다.",
  ].join("\n");
}

export function buildExitEmailSubject(
  alert: Omit<AlertEvent, "id" | "isRead">,
): string {
  const prefix = alert.severity === "critical" ? "[Critical]" : "[Warning]";
  const label = alert.ticker ? `종목 ${alert.ticker}` : "시장 전체";
  return `${prefix} Exit 시그널 · ${label}`;
}
