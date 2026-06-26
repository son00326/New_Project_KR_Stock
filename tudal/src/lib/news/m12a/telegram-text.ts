import type { RecommendedAction } from "@/lib/news/m12a/types";

// ---------------------------------------------------------------------------
// M12a 텔레그램 알림 본문 빌더 (R3.10-7d, telegram-only — 이메일 경로 없음).
// SoT: ServicePlan-Admin §3.10 R3.10-7d · docs/superpowers/specs/2026-06-26-m12a-news-auto-remove-shadow-first.md
//
// plain text(마크다운 금지) · 한국어 · src/lib/notify/telegram.ts 의 sendTelegram text 입력.
// ---------------------------------------------------------------------------

export interface M12aTelegramInput {
  ticker: string | null; // KRX 6자리 (시장 범위면 null)
  newsTitle: string;
  reason: string;
  action: RecommendedAction;
  shadow: boolean; // shadow 운용 단계면 헤더에 (shadow) 명시
  alertsUrl?: string; // 미지정 시 /admin/alerts
}

const TITLE_MAX = 30;

const ACTION_LABELS: Record<RecommendedAction, string> = {
  auto_remove: "🚫 뉴스 자동제외",
  alert_only: "⚠️ 뉴스 경보",
  hold_for_review: "🛑 대량 제외 감지·검토 요망",
};

function truncateTitle(title: string): string {
  return title.length > TITLE_MAX ? title.slice(0, TITLE_MAX) + "…" : title;
}

export function buildM12aTelegramText(input: M12aTelegramInput): string {
  const header = ACTION_LABELS[input.action] + (input.shadow ? " (shadow)" : "");
  const tickerLine = `종목: ${input.ticker ?? "시장 전체"}`;
  const titleLine = truncateTitle(input.newsTitle);
  const detailLine = `상세: ${input.alertsUrl ?? "/admin/alerts"}`;

  return [header, tickerLine, titleLine, input.reason, detailLine].join("\n");
}
