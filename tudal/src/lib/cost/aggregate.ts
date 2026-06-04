// ---------------------------------------------------------------------------
// M17 cost_log 월간 집계 (S6 T6.2)
// ref: ServicePlan-Admin §3.12 R3.12-1~3
//
// 입력: CostLog[] (실 Supabase SELECT 또는 mock)
// 출력: CostMonthlySummary — total · 45만/50만 임계 도달 여부 · purpose 비중 · Top 5
//
// 동작:
//   1. month = YYYY-MM-01 으로 정규화 (입력 ts에서 추출)
//   2. SUM(cost_krw) 집계 + 45만 경보·50만 hardcap 플래그
//   3. byPurpose: purpose별 합계 + 비중(0~1)
//   4. topContributors: ticker·section·persona를 라벨로 합쳐 비용 Top 5
// ---------------------------------------------------------------------------

import {
  type CostLog,
  type CostMonthlySummary,
  type CostPurpose,
  COST_HARDCAP_KRW,
  COST_WARNING_THRESHOLD_KRW,
} from "@/types/admin";

export const COST_PURPOSE_ORDER: CostPurpose[] = [
  "report",
  "committee",
  "regenerate",
  "shortlist",
  "briefing",
  "other",
];

export const COST_PURPOSE_LABEL: Record<CostPurpose, string> = {
  shortlist: "Short List 선정",
  report: "리포트 본문",
  committee: "투심위 페르소나",
  briefing: "모닝 브리핑",
  regenerate: "재생성",
  other: "기타",
};

function normalizeMonth(monthOrTs: string): string {
  // 'YYYY-MM' · 'YYYY-MM-DD' · ISO timestamp 모두 → 'YYYY-MM-01'
  const m = monthOrTs.slice(0, 7);
  return `${m}-01`;
}

function buildContributorLabel(log: CostLog): string {
  const parts: string[] = [COST_PURPOSE_LABEL[log.purpose]];
  if (log.ticker) parts.push(log.ticker);
  if (log.section) parts.push(log.section);
  if (log.personaId) parts.push(log.personaId);
  return parts.join(" · ");
}

interface AggregateOptions {
  topN?: number;
  warningThresholdKrw?: number;
  hardcapKrw?: number;
}

export function aggregateMonthlyCost(
  logs: CostLog[],
  month: string,
  opts: AggregateOptions = {},
): CostMonthlySummary {
  const target = normalizeMonth(month);
  const topN = opts.topN ?? 5;
  const warning = opts.warningThresholdKrw ?? COST_WARNING_THRESHOLD_KRW;
  const hardcap = opts.hardcapKrw ?? COST_HARDCAP_KRW;

  const monthLogs = logs.filter((l) => normalizeMonth(l.month) === target);
  const total = monthLogs.reduce((sum, l) => sum + l.costKrw, 0);
  const totalRound = Math.round(total * 100) / 100;

  // byPurpose
  const purposeMap = new Map<CostPurpose, number>();
  for (const l of monthLogs) {
    purposeMap.set(l.purpose, (purposeMap.get(l.purpose) ?? 0) + l.costKrw);
  }
  const byPurpose = COST_PURPOSE_ORDER.filter((p) => purposeMap.has(p)).map(
    (purpose) => {
      const cost = purposeMap.get(purpose) ?? 0;
      return {
        purpose,
        costKrw: Math.round(cost * 100) / 100,
        share: total > 0 ? cost / total : 0,
      };
    },
  );

  // topContributors — 로그 단위가 아니라 (ticker, section, persona) 묶음으로 합산
  const groupMap = new Map<
    string,
    { label: string; costKrw: number; tokensTotal: number }
  >();
  for (const l of monthLogs) {
    const label = buildContributorLabel(l);
    const cur = groupMap.get(label) ?? {
      label,
      costKrw: 0,
      tokensTotal: 0,
    };
    cur.costKrw += l.costKrw;
    cur.tokensTotal += l.tokensPrompt + l.tokensCompletion;
    groupMap.set(label, cur);
  }
  const topContributors = [...groupMap.values()]
    .map((g) => ({ ...g, costKrw: Math.round(g.costKrw * 100) / 100 }))
    .sort((a, b) => b.costKrw - a.costKrw)
    .slice(0, topN);

  return {
    month: target,
    totalKrw: totalRound,
    warningThresholdKrw: warning,
    hardcapKrw: hardcap,
    warningTriggered: totalRound >= warning,
    hardcapTriggered: totalRound >= hardcap,
    remainingKrw: Math.round((hardcap - totalRound) * 100) / 100,
    byPurpose,
    topContributors,
  };
}

// hardcap 가드 — 재생성 핸들러에서 SELECT SUM 후 본 함수로 차단 결정
export function isHardcapBlocked(
  logs: CostLog[],
  month: string,
  hardcapKrw: number = COST_HARDCAP_KRW,
): boolean {
  const target = normalizeMonth(month);
  const total = logs
    .filter((l) => normalizeMonth(l.month) === target)
    .reduce((sum, l) => sum + l.costKrw, 0);
  return total >= hardcapKrw;
}
