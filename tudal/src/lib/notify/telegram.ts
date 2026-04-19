// ---------------------------------------------------------------------------
// 텔레그램 Bot 어댑터 (S5b T5b.1·T5b.3)
// ref: https://core.telegram.org/bots/api#sendmessage
//
// 설계 원칙:
//   - TELEGRAM_BOT_TOKEN·TELEGRAM_CHAT_ID 미설정 시 mock-mode (success 반환).
//   - 실 fetch 기반(외부 dep 미추가).
//   - 어드민 3명 → 공용 채팅방 1 ID 운용 (admin별 분기는 추후).
// ---------------------------------------------------------------------------

export interface SendTelegramPayload {
  text: string;
  chatId?: string; // override용 (기본: TELEGRAM_CHAT_ID env)
  parseMode?: "Markdown" | "HTML";
  disablePreview?: boolean;
}

export interface SendTelegramResult {
  success: boolean;
  mockMode: boolean;
  error?: string;
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegram(
  payload: SendTelegramPayload,
): Promise<SendTelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = payload.chatId ?? process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn(
      "[telegram] TELEGRAM_BOT_TOKEN/CHAT_ID 미설정 — mock-mode. preview:",
      payload.text.slice(0, 60),
    );
    return { success: true, mockMode: true };
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: payload.text,
          parse_mode: payload.parseMode,
          disable_web_page_preview: payload.disablePreview ?? true,
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "<no body>");
      return {
        success: false,
        mockMode: false,
        error: `telegram HTTP ${res.status}: ${text}`,
      };
    }
    return { success: true, mockMode: false };
  } catch (err) {
    return {
      success: false,
      mockMode: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
