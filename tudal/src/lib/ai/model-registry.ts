// W0 (65차 Q3 + D28 B-final) — 역할 → provider+model 매핑 단일 SoT.
// 신모델 추가 = MODEL_PRICING 1줄 + 본 registry 1줄.
// 전 배분 = "초기 기본값(가설)" — track-record 적중률 측정 후 여기서만 조정.
import { MODEL_PRICING, type AiProviderId } from '@/lib/cost/anthropic-pricing';
import { calculateCostKrw, type TokenUsage } from '@/lib/cost/pricing';
import { anthropicProvider } from './anthropic-provider';
import { openaiProvider } from './openai-provider';
import { isOpenAiAvailable, type LlmProvider } from './provider';

export type AiRole =
  | 'tier1_panel'     // Core 11 채점 (현 단발 — W1에서 D28 ① 토론 mix로 진화)
  | 'debate_judge'    // D28 ③ 최종 judge (W1 소비)
  | 'dual_judge_gpt'  // D28 ③ 경계 ±2 GPT 최고급 dual-judge (W1 소비)
  | 'full_report'     // D28 ④ writer
  | 'revise'          // D28 ④ revise
  | 'critic'          // D28 ⑤ GPT mid 교차 (GPT off → Haiku fallback)
  | 'portfolio';      // D28 ⑥ W3 자율 포트 판단 (W3 소비)

interface ModelBinding {
  provider: AiProviderId;
  model: string;       // API 호출용 id
  pricingKey: string;  // MODEL_PRICING 키 (대개 model과 동일 — haiku만 dateless alias)
}

interface RoleEntry {
  preferred: ModelBinding;
  /** preferred.provider 미가용 시 대체 (D28 C auto-detect). 없으면 preferred 고정. */
  fallback?: ModelBinding;
  /** preflight reservation calibration (보수적 upper-bound 토큰) */
  calibration: { inputTokens: number; outputTokens: number };
  maxTokens: number;
}

const A = (model: string, pricingKey: string = model): ModelBinding => ({ provider: 'anthropic', model, pricingKey });
const O = (model: string, pricingKey: string = model): ModelBinding => ({ provider: 'openai', model, pricingKey });

// D28 B-final 기본 배분. tier1_panel은 W1 토론 mix 배선 전까지 현행(opus-4-7) 유지 — W0 무회귀.
export const MODEL_REGISTRY: Record<AiRole, RoleEntry> = {
  tier1_panel:    { preferred: A('claude-opus-4-7'), calibration: { inputTokens: 1500, outputTokens: 2000 }, maxTokens: 1024 },
  debate_judge:   { preferred: A('claude-opus-4-8'), calibration: { inputTokens: 4000, outputTokens: 2000 }, maxTokens: 2048 },
  dual_judge_gpt: { preferred: O('gpt-5.5'), fallback: A('claude-opus-4-8'), calibration: { inputTokens: 4000, outputTokens: 2000 }, maxTokens: 2048 },
  full_report:    { preferred: A('claude-opus-4-8'), calibration: { inputTokens: 3000, outputTokens: 6000 }, maxTokens: 8192 },
  revise:         { preferred: A('claude-opus-4-8'), calibration: { inputTokens: 8000, outputTokens: 6000 }, maxTokens: 8192 },
  critic:         { preferred: O('gpt-5.4'), fallback: A('claude-haiku-4-5-20251001', 'claude-haiku-4-5'), calibration: { inputTokens: 9000, outputTokens: 2048 }, maxTokens: 2048 },
  portfolio:      { preferred: A('claude-opus-4-8'), calibration: { inputTokens: 8000, outputTokens: 4000 }, maxTokens: 4096 },
};

// 모듈 로드 시 invariant: 모든 binding의 pricingKey가 MODEL_PRICING에 존재 (호출 전 fail-closed —
// 호출 후 cost 계산 시점 throw로는 이미 spend 발생).
for (const [role, entry] of Object.entries(MODEL_REGISTRY)) {
  for (const b of [entry.preferred, entry.fallback].filter(Boolean) as ModelBinding[]) {
    if (!(b.pricingKey in MODEL_PRICING)) {
      throw new Error(`model_registry_pricing_missing:${role}:${b.pricingKey}`);
    }
  }
}

export interface ResolvedRole {
  role: AiRole;
  provider: LlmProvider;
  model: string;
  pricingKey: string;
  maxTokens: number;
}

// D28 A: Claude = 필수 primary. ANTHROPIC_API_KEY 부재 = AI 기능 전체 비활성 (caller가
// 기존 계약대로 'ai_key_unavailable' throw — resolve는 가용성 판단만).
export function resolveRole(role: AiRole): ResolvedRole {
  const entry = MODEL_REGISTRY[role];
  const useFallback = entry.preferred.provider === 'openai' && !isOpenAiAvailable() && entry.fallback;
  const binding = useFallback ? entry.fallback! : entry.preferred;
  const provider = binding.provider === 'openai' ? openaiProvider : anthropicProvider;
  return { role, provider, model: binding.model, pricingKey: binding.pricingKey, maxTokens: entry.maxTokens };
}

// D28 ③ model-aware reservation: 역할별 (콜수 × 해당 모델 calibration 단가).
export function getRoleMaxCostPerCallKrw(role: AiRole): number {
  const entry = MODEL_REGISTRY[role];
  const resolved = resolveRole(role);
  const usage: TokenUsage = {
    input_tokens: entry.calibration.inputTokens,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: entry.calibration.outputTokens,
  };
  return calculateCostKrw(usage, resolved.pricingKey);
}

// reservation 보수화: env 가변 resolve(critic GPT↔Haiku)에 무관하게 preferred/fallback 중
// 최고가 기준 — auto-detect로 단가가 더 싼 쪽이 잡혀도 reservation은 undercount 금지.
export function getRoleWorstCaseMaxCostPerCallKrw(role: AiRole): number {
  const entry = MODEL_REGISTRY[role];
  const bindings = [entry.preferred, entry.fallback].filter(Boolean) as ModelBinding[];
  const usage: TokenUsage = {
    input_tokens: entry.calibration.inputTokens,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: entry.calibration.outputTokens,
  };
  return Math.max(...bindings.map((b) => calculateCostKrw(usage, b.pricingKey)));
}

// 풀 리포트 1 ticker worst-case (writer + critic + revise) — 구 pricing.ts
// Legacy fixed orchestration budget supersede: critic이 GPT mid로 resolve되면 Haiku 고정
// 상수는 undercount(27.5원 vs 76원) → registry worst-case 합산으로 격상.
export function getOrchestrateBudgetKrw(): number {
  return (
    getRoleWorstCaseMaxCostPerCallKrw('full_report') +
    getRoleWorstCaseMaxCostPerCallKrw('critic') +
    getRoleWorstCaseMaxCostPerCallKrw('revise')
  );
}

// ---------------------------------------------------------------------------
// D28 config 상수 박제 (HANDOFF ⭐ 65차 — "config 상수 박제로 비용 산식 닫힘")
// W1(토론 loop)·W3(포트)가 소비. W0에서는 projection 검증에만 사용.
// ---------------------------------------------------------------------------
export const D28_DEBATE_CONFIG = {
  /** D28 ① Core 11 혼합: Claude Sonnet 4.6 슬롯 수 */
  claudeSonnetSlots: 6,
  /** D28 ① Core 11 혼합: GPT mid 슬롯 수 */
  gptMidSlots: 5,
  claudeSonnetModel: 'claude-sonnet-4-6',
  gptMidModel: 'gpt-5.4',
  /** D28 ② R2 trigger: 트랙별 top10 경계 ± N */
  r2BoundaryWindow: 5,
  /** D28 ② R2 trigger: persona 점수 분산 상위 비율 */
  r2VarianceTopFraction: 0.2,
  /** 멀티라운드 상한 (Q4 — ≤2라운드) */
  maxRounds: 2,
  /** D28 ③ dual-judge: 트랙별 top10 경계 ± N (≈4종목) */
  dualJudgeBoundaryWindow: 2,
} as const;

// Q1/W2 트랙 볼륨 + D27 Q5 incumbent 상한 (projection 입력)
// ⚠️ omxy R1 MEDIUM fix: R2 trigger "트랙별 top10 경계 ±5"는 per-track — mid/long을 120 단일
//    풀로 계산하면 10 ticker undercount. 3트랙(short/mid/long 각 pool 60 = 후보 50 + incumbent 10)
//    × 트랙별 빈도(short 4.345/월, mid·long 각 1/월)로 모델링.
export const W2_TRACK_VOLUME = {
  tracks: [
    { key: 'short', candidates: 50, incumbentMax: 10, runsPerMonth: 4.345 },
    { key: 'mid',   candidates: 50, incumbentMax: 10, runsPerMonth: 1 },
    { key: 'long',  candidates: 50, incumbentMax: 10, runsPerMonth: 1 },
  ],
  reportCount: 30,
  portfolioRunsPerMonth: 5, // 주1 + 월1 + 여유 (보수)
  // D27 Q5: incumbent당 직전 리포트 요약 주입 ~1-2k tok → 보수 2k input/콜 (omxy R1 MEDIUM fix)
  incumbentContextExtraInputTokens: 2000,
} as const;

export interface D28ProjectionLine { label: string; krw: number }
export interface D28Projection { lines: D28ProjectionLine[]; totalKrw: number }

// D28 B-final 배분 기준 월간 reservation projection (보수적 worst-case, 닫힌 산식).
// HANDOFF W0 DoD: "실 단가 등록 후 reservation ≤50만 재검증".
// ⚠️ omxy R1 HIGH fix: env-dependent resolveRole 금지 — CI(OPENAI_API_KEY unset)에서 critic=Haiku/
//    dual_judge=Opus fallback 단가로 계산되어 D28 기본(두 키 동시) 대비 undercount. 전 라인
//    worst-case(getRoleWorstCaseMaxCostPerCallKrw — preferred/fallback 중 최고가) 고정.
export function projectD28MonthlyReservationKrw(): D28Projection {
  const perCall = (pricingKey: string, inputTokens: number, outputTokens: number) =>
    calculateCostKrw(
      { input_tokens: inputTokens, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: outputTokens },
      pricingKey,
    );
  const cal = MODEL_REGISTRY.tier1_panel.calibration;
  const mixPerTicker =
    D28_DEBATE_CONFIG.claudeSonnetSlots * perCall(D28_DEBATE_CONFIG.claudeSonnetModel, cal.inputTokens, cal.outputTokens) +
    D28_DEBATE_CONFIG.gptMidSlots * perCall(D28_DEBATE_CONFIG.gptMidModel, cal.inputTokens, cal.outputTokens);
  // D27 Q5 incumbent 추가 input 토큰의 mix 1콜 평균 증분 (11콜 = Sonnet 6 + GPT mid 5)
  const extraIn = W2_TRACK_VOLUME.incumbentContextExtraInputTokens;
  const incumbentExtraPerTicker =
    D28_DEBATE_CONFIG.claudeSonnetSlots * perCall(D28_DEBATE_CONFIG.claudeSonnetModel, extraIn, 0) +
    D28_DEBATE_CONFIG.gptMidSlots * perCall(D28_DEBATE_CONFIG.gptMidModel, extraIn, 0);

  // R2 worst-case 대상 수 per-track (경계 ±5 = 10 + 분산 상위 20% — 겹침 없다고 가정한 상한)
  const r2Count = (pool: number) =>
    Math.min(pool, 2 * D28_DEBATE_CONFIG.r2BoundaryWindow + Math.ceil(pool * D28_DEBATE_CONFIG.r2VarianceTopFraction));

  const judgeKrw = getRoleWorstCaseMaxCostPerCallKrw('debate_judge');
  const dualJudgeKrw = getRoleWorstCaseMaxCostPerCallKrw('dual_judge_gpt');
  const reportKrw = getOrchestrateBudgetKrw(); // worst-case writer+critic+revise

  let r1Krw = 0, r2Krw = 0, judgeTotalKrw = 0, dualJudgeTotalKrw = 0, incumbentKrw = 0;
  for (const t of W2_TRACK_VOLUME.tracks) {
    const pool = t.candidates + t.incumbentMax; // D27 Q5 union
    r1Krw += pool * mixPerTicker * t.runsPerMonth;
    r2Krw += r2Count(pool) * mixPerTicker * t.runsPerMonth;
    judgeTotalKrw += pool * judgeKrw * t.runsPerMonth;
    dualJudgeTotalKrw += 2 * D28_DEBATE_CONFIG.dualJudgeBoundaryWindow * dualJudgeKrw * t.runsPerMonth;
    // incumbent context overhead: R1 + (worst) R2 동반 = ×2
    incumbentKrw += t.incumbentMax * incumbentExtraPerTicker * 2 * t.runsPerMonth;
  }

  const lines: D28ProjectionLine[] = [
    { label: 'R1 (3트랙 pool 60 × mix)', krw: r1Krw },
    { label: 'R2 worst (선택적, 트랙별 22)', krw: r2Krw },
    { label: 'judge (Opus 4.8, per-ticker)', krw: judgeTotalKrw },
    { label: 'dual-judge (경계 ±2/트랙, GPT top worst)', krw: dualJudgeTotalKrw },
    { label: 'D27 Q5 incumbent context (+2k tok, R1+R2)', krw: incumbentKrw },
    { label: '풀 리포트 30 (writer+critic+revise worst)', krw: W2_TRACK_VOLUME.reportCount * reportKrw },
    { label: 'W3 포트 판단 (Opus 4.8)', krw: W2_TRACK_VOLUME.portfolioRunsPerMonth * getRoleWorstCaseMaxCostPerCallKrw('portfolio') },
  ];
  const totalKrw = Math.round(lines.reduce((s, l) => s + l.krw, 0));
  return { lines, totalKrw };
}
