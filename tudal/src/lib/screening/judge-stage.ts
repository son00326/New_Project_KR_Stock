// W1b (D28 ③ / D3) — dual-judge 경계 산정 + 결정론 불일치 판정 (순수 함수).
// 경계 = judge 점수 기준 활성 timeframe bucket별 rank ∈ [10-w+1, 10+w] (w=dualJudgeBoundaryWindow=2 → 9..12).
// 불일치 = winning_timeframe 상이 OR Opus argmax-tf 점수 차 > dualJudgeDisagreeDelta(15).
// 최종은 항상 Opus verdict — dual-judge는 관측층 (D28 "불일치 시 Opus 최종").
import 'server-only';
import { D28_DEBATE_CONFIG } from '@/lib/ai/model-registry';
import type { JudgeVerdict } from '@/lib/ai/judge-client';
import { TRACK_TIMEFRAMES, type SelectionTrack, type Timeframe } from './tier1-schema';

/**
 * dual-judge 대상 ticker (결정론, ticker asc 정렬).
 * judge 점수 기준 트랙 활성 tf별 desc 랭킹(동점 ticker asc) → rank 9..12 합집합 dedupe.
 * 호출 상한: short ≤4 / midlong ≤8 (= bucket당 2×window) — projection 정합.
 */
export function computeDualJudgeBoundary(
  judgeScoresByTicker: ReadonlyMap<string, Record<Timeframe, number>>,
  track: SelectionTrack,
): string[] {
  if (judgeScoresByTicker.size === 0) return [];
  const w = D28_DEBATE_CONFIG.dualJudgeBoundaryWindow;
  const targets = new Set<string>();
  const entries = [...judgeScoresByTicker.entries()];
  for (const tf of TRACK_TIMEFRAMES[track]) {
    const ranked = [...entries].sort((a, b) =>
      b[1][tf] !== a[1][tf] ? b[1][tf] - a[1][tf] : a[0].localeCompare(b[0]),
    );
    ranked.forEach(([ticker], i) => {
      const rank = i + 1;
      if (rank >= 10 - w + 1 && rank <= 10 + w) targets.add(ticker);
    });
  }
  return [...targets].sort();
}

/**
 * 결정론 불일치 판정 — winning_timeframe 상이 OR Opus argmax-tf 점수 차 > delta.
 * 결과는 점수에 미반영(Opus 최종) — 구조화 로그/track-record 입력용.
 */
export function isDualJudgeDisagreement(
  opus: JudgeVerdict,
  gpt: JudgeVerdict,
): boolean {
  if (opus.winning_timeframe !== gpt.winning_timeframe) return true;
  const tfs: Timeframe[] = ['short', 'mid', 'long'];
  const argmaxTf = tfs.reduce(
    (best, tf) => (opus.scores[tf] > opus.scores[best] ? tf : best),
    'short' as Timeframe,
  );
  return (
    Math.abs(opus.scores[argmaxTf] - gpt.scores[argmaxTf]) >
    D28_DEBATE_CONFIG.dualJudgeDisagreeDelta
  );
}
