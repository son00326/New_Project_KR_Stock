// PR-H scope 2 — report input enrich helper.
// SoT spec: tasks/w99tzsvzw.output §2.2.
//
// 3 caller(triggerFullReport / regenerateReport / full-report-batch-worker)가 orchestrateFullReport에
// 넘기던 하드코딩 stub(tier1Verdict:"HOLD" · consensusBadge:"🟡" · summaries:"근거 부족"/"")을
// 실 source로 교체하는 공유 헬퍼. 실 source는 전부 기존 구현(cost 0):
//   - financialsSummary ← fetchFinancialsSummary(dart_corp_codes + dart_financial_cache SELECT)
//   - consensusBadge/tier1Verdict/technicals/sectorRef ← short_list_30 row(getActiveShortList) 파생
//   - macroSummary ← S7b 전까지 "근거 부족" (범위 밖)
//
// LLM 호출 0. 실 AI는 enrich 이후 orchestrate Step 2 writer에서 발생(flag-off면 그 앞단 fail-closed
// 게이트가 throw → cost 0). orchestrator/analyst/prompt 계약은 불변 — enrich는 caller-side에서 수행.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShortListItem } from "@/types/admin";
import { fetchFinancialsSummary } from "@/lib/data/dart-financials";
import { hasLevelABodyReference } from "@/lib/data/sector-reference-backlog";

// prompt 계약(FullReportUserPromptInput) 정합 — consensusBadge는 ⚪ 불허(4종).
export interface ReportEnrichResult {
  tier1Verdict: "BUY" | "HOLD" | "SELL";
  consensusBadge: "🟢" | "🔵" | "🟣" | "🟡";
  financialsSummary: string;
  technicalsSummary: string;
  macroSummary: string;
  sectorReference: string;
}

const NO_BASIS = "근거 부족";

/**
 * aiScore → BUY/HOLD/SELL enum.
 * 임계값(PR-H 신규 정의): null/undefined → HOLD(보수적), >=70 → BUY, <=30 → SELL, else HOLD.
 * ReportFramework §8 박제 권장(코드 상수, DB 컬럼 추가 아님).
 */
export function mapAiScoreToVerdict(
  aiScore: number | null | undefined,
): "BUY" | "HOLD" | "SELL" {
  if (aiScore === null || aiScore === undefined) return "HOLD";
  if (aiScore >= 70) return "BUY";
  if (aiScore <= 30) return "SELL";
  return "HOLD";
}

/**
 * short_list_30 consensusBadge(⚪ 포함 5종) → prompt-valid 4종.
 * null/undefined/⚪ → 🟡(관망) fallback. prompt 계약(full-report-prompt.ts)은 ⚪ 미포함.
 */
export function toPromptBadge(
  badge: ShortListItem["consensusBadge"],
): ReportEnrichResult["consensusBadge"] {
  if (badge === "🟢" || badge === "🔵" || badge === "🟣" || badge === "🟡") {
    return badge;
  }
  return "🟡";
}

/**
 * Tier0 점수 → 1줄 한국어 요약. 점수는 이미 row에 존재(추가 fetch 0).
 */
export function formatTechnicalsSummary(item: ShortListItem): string {
  return `종합 ${item.compositeScore} · 추세 ${item.trendScore} · 모멘텀 ${item.momentumScore} · 변동성 ${item.volatilityScore} · ${item.signalLabel || "신호 없음"}`;
}

/**
 * sector → Level A 본문 보유 시 1줄 ref, else "근거 부족".
 * 현재 Level A 보유 = 바이오·반도체 (sector-reference-backlog.ts LEVEL_A_SECTORS_WITH_BODY).
 * 신규 SECTOR_PHILOSOPHIES 본문 작성은 PR-H 범위 밖 — 기존 guard만 재사용.
 */
export function formatSectorReference(sector: string): string {
  if (hasLevelABodyReference(sector)) {
    return `${sector} 섹터 Level A 레퍼런스 적용`;
  }
  return NO_BASIS;
}

/**
 * shortlist row → enrich 결과(financials 제외). pure, I/O 0, LLM 0.
 */
export function deriveEnrichFromShortlist(
  item: ShortListItem,
): Omit<ReportEnrichResult, "financialsSummary"> {
  return {
    tier1Verdict: mapAiScoreToVerdict(item.aiScore),
    consensusBadge: toPromptBadge(item.consensusBadge),
    technicalsSummary: formatTechnicalsSummary(item),
    macroSummary: NO_BASIS,
    sectorReference: formatSectorReference(item.sector),
  };
}

export interface EnrichReportInputOptions {
  client: SupabaseClient;
  // DI seam (테스트). default = 실 fetchFinancialsSummary(dart_corp_codes + dart_financial_cache SELECT).
  fetchFinancials?: (
    ticker: string,
    options: { client: SupabaseClient },
  ) => Promise<string>;
}

/**
 * async DB-read enrich. caller가 shortlist row + client를 주입하면 financials만 추가 SELECT.
 * 미캐시 ticker는 fetchFinancialsSummary가 graceful "[ticker] 재무 데이터 없음" 반환(throw 아님).
 * corp/fin SELECT 에러(financials_corp_lookup_failed / financials_fetch_failed)는 throw 전파 —
 * silent degrade 방지(caller가 catch → action error 반환).
 *
 * LLM 호출 0 (Supabase SELECT만) = cost 0.
 */
export async function enrichReportInput(
  item: ShortListItem,
  options: EnrichReportInputOptions,
): Promise<ReportEnrichResult> {
  const fetchFinancials = options.fetchFinancials ?? fetchFinancialsSummary;
  const financialsSummary = await fetchFinancials(item.ticker, {
    client: options.client,
  });
  return {
    ...deriveEnrichFromShortlist(item),
    financialsSummary,
  };
}
