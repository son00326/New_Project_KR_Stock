// W1a (D3/D6 — D26 Q4 멀티라운드 반박, D28 ② R2 선택적 trigger) — 결정론 순수 함수.
// R2 대상 = 트랙 활성 tf별 top10 경계 ±r2BoundaryWindow ∪ persona 점수 분산 상위 r2VarianceTopFraction.
// 모두 저장된 R1 panel의 순수 함수 — 매 invocation 재계산 가능(멱등, 저장 플래그 불필요).
import 'server-only';
import { D28_DEBATE_CONFIG } from '@/lib/ai/model-registry';
import {
  TRACK_TIMEFRAMES,
  type PersonaScore,
  type SelectionTrack,
} from './tier1-schema';
import { computeWeightedScores } from './persona-eval';

export interface R1PanelRow {
  ticker: string;
  panel: PersonaScore[] | null; // null = degraded (R1 실패) — 반박 불가, ⚪ 유지
}

/**
 * R2 반박 라운드 대상 ticker (결정론, ticker asc 정렬).
 *   ① 트랙 활성 tf마다 computeWeightedScores[tf] desc 순위(동점 ticker asc) → rank ∈ [10-w+1, 10+w]
 *   ② active tf 중 최대 가중점수 tf 기준 persona 11명 점수 모표준편차 상위 ceil(pool × fraction)
 *   ③ 합집합. degraded(panel null) 제외.
 */
export function computeR2Targets(
  rows: readonly R1PanelRow[],
  track: SelectionTrack,
): string[] {
  const scored = rows
    .filter((r): r is { ticker: string; panel: PersonaScore[] } => r.panel !== null)
    .map((r) => ({
      ticker: r.ticker,
      panel: r.panel,
      weighted: computeWeightedScores(r.panel),
    }));
  if (scored.length === 0) return [];

  const targets = new Set<string>();
  const w = D28_DEBATE_CONFIG.r2BoundaryWindow;
  const activeTfs = TRACK_TIMEFRAMES[track];

  // ① 경계 ±w (top10 경계 = rank 10.5 기준 [10-w+1 .. 10+w])
  for (const tf of activeTfs) {
    const ranked = [...scored].sort((a, b) =>
      b.weighted[tf] !== a.weighted[tf]
        ? b.weighted[tf] - a.weighted[tf]
        : a.ticker.localeCompare(b.ticker),
    );
    ranked.forEach((r, i) => {
      const rank = i + 1;
      if (rank >= 10 - w + 1 && rank <= 10 + w) targets.add(r.ticker);
    });
  }

  // ② 분산 상위 fraction (argmax-tf 11점수 모표준편차, 동률 ticker asc).
  //    v=0(위원 전원 동일 점수 = 이견 없음)은 반박 라운드 무의미 → 제외 (tie-break 유입 차단).
  const byVariance = scored
    .map((r) => {
      const tf = activeTfs.reduce(
        (best, t) => (r.weighted[t] > r.weighted[best] ? t : best),
        activeTfs[0],
      );
      const xs = r.panel.map((p) => p.scores[tf]);
      const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
      const v = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
      return { ticker: r.ticker, v };
    })
    .filter((r) => r.v > 0)
    .sort((a, b) => (b.v !== a.v ? b.v - a.v : a.ticker.localeCompare(b.ticker)));
  byVariance
    .slice(0, Math.ceil(scored.length * D28_DEBATE_CONFIG.r2VarianceTopFraction))
    .forEach((r) => targets.add(r.ticker));

  return [...targets].sort();
}

/**
 * 최종 replay panel 병합 (D6) — round2 done 우선, 없으면 round1 fallback.
 * R2 실패(failed/panel null)는 r2 map에 없음 → R1 점수 유지 (graceful).
 */
export function pickFinalPanels(
  r1: ReadonlyMap<string, PersonaScore[]>,
  r2: ReadonlyMap<string, PersonaScore[]>,
): Map<string, PersonaScore[]> {
  const out = new Map<string, PersonaScore[]>();
  for (const [ticker, panel] of r1) out.set(ticker, panel);
  for (const [ticker, panel] of r2) out.set(ticker, panel);
  return out;
}
