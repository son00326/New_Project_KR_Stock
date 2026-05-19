// tudal/src/lib/screening/consensus.ts
// D19 SoT = ServicePlan-Admin §1A.5
// 변경 시 별도 PR + SoT 동시 갱신
// Q5 + Q5b omxy 합의 박제

export const TOP_PERCENTILE_THRESHOLD = 0.30;

export type ConsensusBadge = '🟢' | '🔵' | '🟣' | '🟡' | '⚪';

export function isTopTier(rank: number, total: number): boolean {
  if (!Number.isInteger(rank) || !Number.isInteger(total)) throw new Error('consensus_rank_invalid');
  if (total <= 0) throw new Error('consensus_rank_invalid');
  if (rank < 1 || rank > total) throw new Error('consensus_rank_invalid');
  const cutoff = Math.ceil(total * TOP_PERCENTILE_THRESHOLD);
  return rank <= cutoff;
}

export interface AssignBadgeInput {
  tier1Available: boolean;
  tier0IsTop: boolean;
  tier1IsTop: boolean;
}

export function assignBadge(input: AssignBadgeInput): ConsensusBadge {
  if (!input.tier1Available) return '⚪';
  if (input.tier0IsTop && input.tier1IsTop) return '🟢';
  if (input.tier0IsTop && !input.tier1IsTop) return '🔵';
  if (!input.tier0IsTop && input.tier1IsTop) return '🟣';
  return '🟡'; // non-top + non-top + avail (Q5b)
}
