import 'server-only';
// W0 (65차 Q3 + D28 B-final) — 역할 → provider+model 매핑 단일 SoT.
// 신모델 추가 = MODEL_PRICING 1줄 + 본 registry 1줄.
// 전 배분 = "초기 기본값(가설)" — track-record 적중률 측정 후 여기서만 조정.
import { MODEL_PRICING, type AiProviderId } from '@/lib/cost/anthropic-pricing';
import { calculateCostKrw, type TokenUsage } from '@/lib/cost/pricing';
import { anthropicProvider } from './anthropic-provider';
import { openaiProvider } from './openai-provider';
import { openrouterProvider } from './openrouter-provider';
import {
  isAnthropicAvailable,
  isOpenAiAvailable,
  isOpenRouterAvailable,
  type LlmProvider,
} from './provider';

// 항목1 — provider id → 인스턴스/가용성 맵 (구 삼항식 2곳 대체). 신 provider 추가 = 여기 1줄.
const PROVIDERS: Record<AiProviderId, LlmProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  openrouter: openrouterProvider,
};
const PROVIDER_AVAILABLE: Record<AiProviderId, () => boolean> = {
  anthropic: isAnthropicAvailable,
  openai: isOpenAiAvailable,
  openrouter: isOpenRouterAvailable,
};

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
// 항목1 — GLM 5.2 primary 바인딩 헬퍼 (OpenRouter slug "z-ai/glm-5.2", pricingKey='glm-5.2').
const G = (): ModelBinding => ({ provider: 'openrouter', model: 'z-ai/glm-5.2', pricingKey: 'glm-5.2' });

// 항목1 — 기존 Claude preferred 역할(judge/full_report/revise/portfolio)을 GLM primary + Claude fallback로 재바인딩.
//   GPT 역할(dual_judge_gpt/critic)·slot GPT는 불변. OPENROUTER 키 부재 시 resolveRole이 fallback(Claude)로 auto-detect.
//   tier1_panel은 W1 mix 배선 전 비패널 fallback 경로 보존용 — preferred=GLM/fallback=opus-4-7 (Sonnet slot은 resolveTier1PanelSlot).
export const MODEL_REGISTRY: Record<AiRole, RoleEntry> = {
  tier1_panel:    { preferred: G(), fallback: A('claude-opus-4-7'), calibration: { inputTokens: 1500, outputTokens: 2000 }, maxTokens: 3072 },
  debate_judge:   { preferred: G(), fallback: A('claude-opus-4-8'), calibration: { inputTokens: 4000, outputTokens: 2000 }, maxTokens: 3072 },
  dual_judge_gpt: { preferred: O('gpt-5.5'), fallback: A('claude-opus-4-8'), calibration: { inputTokens: 4000, outputTokens: 2000 }, maxTokens: 2048 },
  full_report:    { preferred: G(), fallback: A('claude-opus-4-8'), calibration: { inputTokens: 3000, outputTokens: 6000 }, maxTokens: 8192 },
  revise:         { preferred: G(), fallback: A('claude-opus-4-8'), calibration: { inputTokens: 8000, outputTokens: 6000 }, maxTokens: 8192 },
  critic:         { preferred: O('gpt-5.4'), fallback: A('claude-haiku-4-5-20251001', 'claude-haiku-4-5'), calibration: { inputTokens: 9000, outputTokens: 2048 }, maxTokens: 2048 },
  portfolio:      { preferred: G(), fallback: A('claude-opus-4-8'), calibration: { inputTokens: 8000, outputTokens: 4000 }, maxTokens: 6144 },
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

// 항목1 — provider 선택 일반화: preferred 미가용(env 키 부재)이면 fallback으로. (구 openai-only 삼항 대체.)
//   GLM primary → OPENROUTER 키 부재 시 Claude fallback / GPT preferred → OPENAI 키 부재 시 Claude fallback.
function pickBinding(entry: RoleEntry): ModelBinding {
  if (!PROVIDER_AVAILABLE[entry.preferred.provider]() && entry.fallback) {
    return entry.fallback;
  }
  return entry.preferred;
}

// resolve는 가용성 판단만 — 실 키 부재 시의 'ai_key_unavailable' throw는 caller 게이트(isRoleProviderAvailable) 책임.
export function resolveRole(role: AiRole): ResolvedRole {
  const entry = MODEL_REGISTRY[role];
  const binding = pickBinding(entry);
  const provider = PROVIDERS[binding.provider];
  return { role, provider, model: binding.model, pricingKey: binding.pricingKey, maxTokens: entry.maxTokens };
}

export function resolveRoleCandidates(role: AiRole): ResolvedRole[] {
  const entry = MODEL_REGISTRY[role];
  const bindings = [entry.preferred, entry.fallback].filter(
    (binding): binding is ModelBinding =>
      binding !== undefined && PROVIDER_AVAILABLE[binding.provider](),
  );
  return bindings.map((binding) => ({
    role,
    provider: PROVIDERS[binding.provider],
    model: binding.model,
    pricingKey: binding.pricingKey,
    maxTokens: entry.maxTokens,
  }));
}

// 항목1 — provider-agnostic 게이트 헬퍼. 역할이 실제로 resolve될 provider(preferred 또는 fallback)의
//   env 키가 있는지 판정. GLM primary 역할이 Claude fallback으로 내려가는 경우도 정상 가용으로 취급
//   (구 ANTHROPIC_API_KEY 하드 게이트가 GLM-only 배포에서 AI를 거짓 비활성화하던 문제 제거).
//   preferred·fallback 모두 미가용일 때만 false → caller가 'ai_key_unavailable' throw.
export function isRoleProviderAvailable(role: AiRole): boolean {
  const binding = pickBinding(MODEL_REGISTRY[role]);
  return PROVIDER_AVAILABLE[binding.provider]();
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
  /** W1b (D3) — dual-judge 불일치 판정: argmax-tf 점수 차 임계 (가설 기본값, projection 비영향) */
  dualJudgeDisagreeDelta: 15,
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

// ---------------------------------------------------------------------------
// W1a (D28 ①) — Core 11 혼합 슬롯. CORE_11 배열 index 기준 interleave(가설 기본값 —
// track-record 적중률 측정 후 여기 1곳 조정):
//   짝수 idx = Claude 슬롯 6개(0,2,4,6,8,10) / 홀수 idx = GPT mid 5개(1,3,5,7,9).
//   항목1: 짝수(Claude) 슬롯 = GLM 5.2 primary → OPENROUTER 키 부재 시 Sonnet 4.6 fallback(auto-detect).
//   홀수(GPT) 슬롯 = GPT 미가용 시 Sonnet 4.6 fallback (D28 C, GPT-only 미지원) — 불변.
//   calibration/maxTokens는 tier1_panel 역할 공유.
// ---------------------------------------------------------------------------
export function resolveTier1PanelSlot(slotIndex: number): ResolvedRole {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 10) {
    throw new Error(`tier1_panel_slot_out_of_range:${slotIndex}`);
  }
  const entry = MODEL_REGISTRY.tier1_panel;
  const isGptSlot = slotIndex % 2 === 1;
  let binding: ModelBinding;
  if (isGptSlot) {
    binding = isOpenAiAvailable()
      ? O(D28_DEBATE_CONFIG.gptMidModel)
      : A(D28_DEBATE_CONFIG.claudeSonnetModel);
  } else if (isOpenRouterAvailable()) {
    binding = G(); // 항목1 — Claude 슬롯 = GLM primary
  } else {
    binding = A(D28_DEBATE_CONFIG.claudeSonnetModel); // OpenRouter 부재 → Sonnet fallback
  }
  const provider = PROVIDERS[binding.provider];
  return {
    role: 'tier1_panel',
    provider,
    model: binding.model,
    pricingKey: binding.pricingKey,
    maxTokens: entry.maxTokens,
  };
}

export function getTier1PanelWorstSlotCostKrw(): number {
  const cal = MODEL_REGISTRY.tier1_panel.calibration;
  const usage: TokenUsage = {
    input_tokens: cal.inputTokens,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: cal.outputTokens,
  };
  return Math.max(
    calculateCostKrw(usage, 'glm-5.2'),
    calculateCostKrw(usage, D28_DEBATE_CONFIG.claudeSonnetModel),
    calculateCostKrw(usage, D28_DEBATE_CONFIG.gptMidModel),
  );
}

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
