// shortlist-gate.ts — D15 Accept 게이트 공유 순수 로직 (page display gate ↔ actions enforcement gate 단일 소스).
// 77차 Accept-gate 진단(Workflow HIGH + omxy): page.tsx / actions.ts가 게이트 대상 티커·anchor·viewer-min을
//   각자 중복 정의(split-brain)해 (a) legacy mock 하드코딩 (b) anchor 불일치 (c) 실 열람 무시 버그가 있었다.
//   본 모듈로 단일화한다. Supabase/Next 호출 없음 — 순수 함수.

import type { ShortListItem } from "@/types/admin";

/** active = deltaStatus !== 'removed' (removed 종목은 게이트/anchor 대상 제외). */
export function filterActiveShortlist(
  shortlist: ShortListItem[],
): ShortListItem[] {
  return shortlist.filter((r) => r.deltaStatus !== "removed");
}

/**
 * D15 Hold anchor = active 행 중 가장 최근(MAX) created_at.
 * W2a Task 9.5 (R4 HIGH-3): 트랙 split로 같은 월에 mixed createdAt 공존(오래된 mid/long + 주간
 *   refresh된 short=now()) → '첫 활성 행' anchor면 오래된 mid가 freshly-refreshed short의 24h/D+4
 *   Hold를 우회시킨다. anchor를 MAX로 통일(page display gate ↔ actions enforcement gate 동일).
 */
export function resolveShortlistGeneratedAt(
  shortlist: ShortListItem[],
): Date | null {
  const active = filterActiveShortlist(shortlist);
  let latest: number | null = null;
  for (const item of active) {
    if (!item.createdAt) continue;
    const t = new Date(item.createdAt).getTime();
    if (Number.isNaN(t)) continue;
    if (latest === null || t > latest) latest = t;
  }
  return latest === null ? null : new Date(latest);
}

/**
 * 2인 열람 게이트 대상 티커 = 현 선정의 active 전 종목 (deterministic).
 * 77차 fix: 구 REQUIRED_GATE_TICKERS(legacy mock 5종) 하드코딩 제거. 그 방식은 (i) 선정에 우연히
 *   잔존한 legacy 티커 수에 따라 strictness가 비결정적으로 요동(교집합 0이면 all-30로 폭증)하고
 *   (ii) 실제 열람한 리포트(report_view_log)를 무시했다. Accept하는 가상 포트가 active 30종 전체에서
 *   구성되므로, 게이트 대상도 active 전 종목으로 정합한다 — 안전게이트 약화가 아니라 정합/강화이며
 *   교집합-fallback의 비결정성을 제거한 결정론적 규칙이다.
 */
export function getGateTickers(shortlist: ShortListItem[]): string[] {
  return filterActiveShortlist(shortlist).map((item) => item.ticker);
}

/** 게이트 대상 티커들의 distinct viewer 최소값 (하나라도 2인 미만이면 게이트 미달). 빈 목록=0. */
export function computeMinimumViewerCount(
  tickers: string[],
  viewerCountsByTicker: Map<string, number>,
): number {
  if (tickers.length === 0) return 0;
  return Math.min(...tickers.map((t) => viewerCountsByTicker.get(t) ?? 0));
}
