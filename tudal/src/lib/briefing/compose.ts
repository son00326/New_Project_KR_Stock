import type { BriefingLog, NewsEvent, PortfolioSnapshot } from "@/types/admin";

// ---------------------------------------------------------------------------
// 모닝 브리핑 작성기 (M11, S5a T5a.2)
// ref: ServicePlan-Admin §3.9 R3.9-1~5
//
// 입력: 전일 포트 스냅샷(E5) + 주의 종목 리스트 + 핵심 뉴스 3건
// 출력: 3~5줄 요약 텍스트 + email/telegram/dashboard 채널별 포맷
// ---------------------------------------------------------------------------

export interface BriefingInput {
  date: string; // YYYY-MM-DD
  portfolioSnapshot: PortfolioSnapshot | null;
  attentionTickers: Array<{ ticker: string; name: string; reason: string }>;
  topNews: NewsEvent[]; // 최대 3건 사용
}

export interface ComposedBriefing {
  date: string;
  contentSummary: string; // 대시보드 카드·로그용
  email: { subject: string; html: string; text: string };
  telegram: string;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function formatPortfolioLine(snap: PortfolioSnapshot | null): string {
  if (!snap) return "어제 포트 데이터 없음 (EOD 배치 확인 필요).";
  const portfolioPct = formatPercent(snap.totalReturn);
  const kospiPct = formatPercent(snap.kospiReturn);
  const alphaPp = (snap.alpha * 100).toFixed(2);
  const alphaSign = snap.alpha >= 0 ? "+" : "";
  return `어제 포트 ${portfolioPct} (KOSPI ${kospiPct}, alpha ${alphaSign}${alphaPp}pp).`;
}

function formatAttentionLine(
  items: BriefingInput["attentionTickers"],
): string {
  if (items.length === 0) return "주의 종목 0건.";
  const head = items
    .slice(0, 3)
    .map((t) => `${t.name}(${t.reason})`)
    .join(", ");
  const suffix = items.length > 3 ? ` 외 ${items.length - 3}건` : "";
  return `주의 종목 ${items.length}건: ${head}${suffix}.`;
}

function formatNewsLine(items: NewsEvent[]): string {
  if (items.length === 0) return "핵심 뉴스 없음.";
  const picks = items.slice(0, 3);
  const body = picks
    .map((n, i) => `${"①②③"[i] ?? `(${i + 1})`} ${n.title}`)
    .join(" · ");
  return `핵심 뉴스 ${picks.length}건: ${body}.`;
}

export function composeBriefing(input: BriefingInput): ComposedBriefing {
  const lines = [
    formatPortfolioLine(input.portfolioSnapshot),
    formatAttentionLine(input.attentionTickers),
    formatNewsLine(input.topNews),
  ];
  const contentSummary = lines.join(" ");

  const subject = `[주픽] ${input.date} 모닝 브리핑`;
  const text = [subject, "", ...lines].join("\n");
  const html = `<!doctype html><html lang="ko"><body>
<h2>${subject}</h2>
${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("\n")}
<hr>
<p style="color:#777;font-size:12px">정보 제공 목적이며, 투자 자문이 아닙니다.</p>
</body></html>`;

  // Telegram 4096 char 제한. 본 3줄 요약은 수백 자 수준 — 여유.
  const telegram = [`*${subject}*`, "", ...lines].join("\n");

  return {
    date: input.date,
    contentSummary,
    email: { subject, html, text },
    telegram,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// BriefingLog 레코드 페이로드 (briefing_log INSERT용)
export function toBriefingLogRecord(
  composed: ComposedBriefing,
  sentChannels: string[],
  generationFailed = false,
): Omit<BriefingLog, "id" | "viewEvents"> {
  return {
    date: composed.date,
    contentSummary: composed.contentSummary,
    generatedAt: new Date().toISOString(),
    sentChannels,
    generationFailed,
  };
}
