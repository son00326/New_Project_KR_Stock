// W2b (D27 Q5) — incumbent(직전 short_list_30 트랙 rows) ∪ fresh Tier0 union 순수 로직.
// IncumbentInfo는 screening 레이어 타입 SoT — data 모듈(admin-shortlist-incumbents)이 import
// (Tier1Candidate ↔ admin-tier0-candidates 동일 방향, screening→data 역참조 금지).
import { isCanonicalSector, type CanonicalSector } from './canonical-sectors';
import type { Timeframe } from './tier1-schema';
import type { Tier1Candidate } from './persona-eval';

/** 직전 선정 리스트의 incumbent 1행 — context builder + union + delta 계산 공용 shape. */
export interface IncumbentInfo {
  ticker: string;
  bucket: Timeframe;
  rank: number;
  month: string; // 직전 row의 month (YYYY-MM-01)
  sector: string | null;
  name: string | null;
  aiCommentKr: string | null;
  consensusBadge: string | null;
  aiScore: number | null;
  conviction: number | null;
  deltaStatus: string;
  /** incumbent-only 재선정 시 tier0_candidates_150 lookup 부재 fallback용 기존 display meta(sector 제외). */
  compositeScore: number | null;
  signalLabel: string | null;
}

/**
 * fresh Tier0 후보 ∪ incumbents (D27 Q5 무심사 탈락 금지).
 * - fresh ticker와 겹치는 incumbent는 fresh row 유지(tier0 score 보유 — 컨텍스트 주입은 별도 map).
 * - incumbent-only는 Tier1Candidate 합성: 직전 bucket true + tier0_scores 전부 null
 *   (computeTier0Ranks 자연 제외 → tier0IsTop=false → 배지 🟣/⚪ 경로).
 * - 반환 순서 결정성: fresh 입력 순서 → incumbent-only 입력 순서.
 */
export function mergeFreshWithIncumbents(
  fresh: readonly Tier1Candidate[],
  incumbents: readonly IncumbentInfo[],
): Tier1Candidate[] {
  const seen = new Set(fresh.map((c) => c.ticker));
  const merged: Tier1Candidate[] = [...fresh];
  for (const inc of incumbents) {
    if (seen.has(inc.ticker)) continue;
    seen.add(inc.ticker);
    const sector: CanonicalSector | null =
      inc.sector !== null && isCanonicalSector(inc.sector) ? inc.sector : null;
    merged.push({
      ticker: inc.ticker,
      sector,
      tier0_buckets: {
        short: inc.bucket === 'short',
        mid: inc.bucket === 'mid',
        long: inc.bucket === 'long',
      },
      tier0_scores: { short: null, mid: null, long: null },
    });
  }
  return merged;
}
