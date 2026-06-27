// G1 Tier0 Reflection Lab — B++ funnel 가중치 champion/challenger 회고 (순수 로직, D33).
// 범주 분리: G1(numeric funnel 가중치 회고) ≠ PR-K reflection(prompt 주입). 별 타입·별 출력.
// diagnostic only · 예측 아님(forward-validate) · 자동 적용 금지. challenger δ는 bounded(과적합 방지).
// I/O 없음 — 과거 candidates + realized returns 주입형. Vitest 친화.

export type FunnelConfig = Record<string, number>;

export interface FunnelCandidate {
  ticker: string;
  /** factor명 → exposure 값 (예: { trend: 0.8, size: -0.3, momentum: 1.2 }) */
  factorExposures: Record<string, number>;
}

export interface FunnelReflectionInput {
  periodKey: string;
  championConfig: FunnelConfig;
  candidates: FunnelCandidate[];
  /** ticker → 실현 수익률(percentage points). */
  realizedReturns: Map<string, number>;
}

export interface FunnelReflectionEvidence {
  pricedCount: number;
  /** factor명 → (exposure, return) 순위상관 [-1,1] */
  factorReturnRankCorr: Record<string, number>;
}

export interface FunnelReflectionOutput {
  periodKey: string;
  championConfig: FunnelConfig;
  challengerConfig: FunnelConfig;
  rationale: string;
  evidence: FunnelReflectionEvidence;
}

const CORR_THRESHOLD = 0.1; // |corr| 이 값 이상이면 nudge.
const NUDGE_DELTA = 0.05; // bounded — 과적합 방지(작은 1-step 제안).
const WEIGHT_MIN = 0;
const WEIGHT_MAX = 1;

function rank(values: number[]): number[] {
  // average-rank (tie-aware).
  const idx = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
    const avg = (i + j) / 2 + 1; // 1-based average rank
    for (let k = i; k <= j; k++) ranks[idx[k].i] = avg;
    i = j + 1;
  }
  return ranks;
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return 0;
  return num / Math.sqrt(dx * dy);
}

/** Spearman rank correlation. n<2 또는 분산 0 → 0. */
export function rankCorrelation(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  return Number(pearson(rank(xs), rank(ys)).toFixed(4));
}

function clamp(n: number): number {
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, n));
}

/**
 * 과거 candidates + 실현 수익률 → champion 대비 challenger 가중치 제안(bounded nudge).
 *   factor↔return 순위상관 부호로 가중치를 작게 nudge(양상관↑ → weight +δ).
 * diagnostic·예측 아님: rationale에 자동 적용 금지·forward-validate 박제.
 */
export function buildFunnelReflection(
  input: FunnelReflectionInput,
): FunnelReflectionOutput {
  // realized return이 있는 candidate만 산입.
  const priced = input.candidates.filter((c) =>
    input.realizedReturns.has(c.ticker),
  );
  const returns = priced.map((c) => input.realizedReturns.get(c.ticker) as number);

  const factors = Object.keys(input.championConfig);
  const corr: Record<string, number> = {};
  const challenger: FunnelConfig = { ...input.championConfig };
  const moved: string[] = [];

  for (const factor of factors) {
    const exposures = priced.map((c) => c.factorExposures[factor] ?? 0);
    const c = priced.length >= 2 ? rankCorrelation(exposures, returns) : 0;
    corr[factor] = c;
    if (c >= CORR_THRESHOLD) {
      const next = clamp(input.championConfig[factor] + NUDGE_DELTA);
      challenger[factor] = Number(next.toFixed(4));
      if (next !== input.championConfig[factor]) moved.push(`${factor}↑`);
    } else if (c <= -CORR_THRESHOLD) {
      const next = clamp(input.championConfig[factor] - NUDGE_DELTA);
      challenger[factor] = Number(next.toFixed(4));
      if (next !== input.championConfig[factor]) moved.push(`${factor}↓`);
    }
  }

  const rationale =
    priced.length < 2
      ? `표본 부족(${priced.length}종) — 제안 없음. [diagnostic only · 자동 적용 금지 · 예측 아님 · forward-validate 필요]`
      : `factor↔실현수익 순위상관 기반 bounded nudge(${moved.length > 0 ? moved.join(", ") : "변화 없음"}). ` +
        `[diagnostic only · 자동 적용 금지 · 예측 아님 · forward-validate 후에만 채택]`;

  return {
    periodKey: input.periodKey,
    championConfig: input.championConfig,
    challengerConfig: challenger,
    rationale,
    evidence: {
      pricedCount: priced.length,
      factorReturnRankCorr: corr,
    },
  };
}
