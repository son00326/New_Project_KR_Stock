// ---------------------------------------------------------------------------
// Resend 이메일 어댑터 (S5a BL-11, T5a.2)
// ref: https://resend.com/docs/api-reference/emails/send-email
//
// 설계 원칙:
//   - 외부 dep 미추가(fetch 기반). S5 실데이터 전환 시 필요하면 `resend` SDK로 교체.
//   - RESEND_API_KEY 미설정 시 dev/mock 모드 (console 로그 + success 반환).
//   - React Email 템플릿은 S5 실데이터 연결 시점에 도입.
// ---------------------------------------------------------------------------

export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tag?: string; // briefing·exit_signal 등 분석용 태그
}

export interface SendEmailResult {
  success: boolean;
  providerId: string | null;
  mockMode: boolean;
  error?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function resolveFrom(override?: string): string {
  return override ?? process.env.RESEND_FROM_EMAIL ?? "joopick@no-reply.local";
}

export async function sendEmail(
  payload: SendEmailPayload,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[resend] RESEND_API_KEY 미설정 — mock-mode. payload.subject:",
      payload.subject,
    );
    return { success: true, providerId: null, mockMode: true };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resolveFrom(payload.from),
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.replyTo,
        tags: payload.tag ? [{ name: "category", value: payload.tag }] : undefined,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "<no body>");
      return {
        success: false,
        providerId: null,
        mockMode: false,
        error: `resend HTTP ${res.status}: ${text}`,
      };
    }

    const json = (await res.json()) as { id?: string };
    return {
      success: true,
      providerId: json.id ?? null,
      mockMode: false,
    };
  } catch (err) {
    return {
      success: false,
      providerId: null,
      mockMode: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
