# W0 — 모델/프로바이더 추상화 + hardcap 50만 + D28 비용가드 3종 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 65차 LOCKED 결정(D26 Q3 + D28)의 W0 토대 — 모델 하드코딩 제거(레지스트리 1곳), Claude+GPT 멀티프로바이더 추상화(+auto-detect), hardcap 40만→50만 전 SoT 동기화, D28 비용 undercount 방지 3종(GPT/Opus4.8 단가 등록 · unknown model fail-closed · model-aware reservation), D28 배분 기준 reservation ≤50만 projection 검증.

**Architecture:** 4개 AI client(callPersona/full-report/critic/revise)가 직접 들고 있던 Anthropic SDK 호출 + 하드코딩 모델을 `LlmProvider` 인터페이스(anthropic/openai 2 구현) + `model-registry.ts`(역할→provider+model 매핑 단일 SoT) 뒤로 이동. 단가표는 `anthropic-pricing.ts`를 멀티프로바이더 `MODEL_PRICING`으로 확장(파일명 유지 — HANDOFF 포인터·import 경로 churn 최소화). preflight reservation은 역할별 (콜수 × 해당 모델 단가) 합산으로 격상.

**Tech Stack:** Next.js 16 / TypeScript strict / Vitest / `@anthropic-ai/sdk` ^0.96 (기존) / `openai` ^6.42 (신규) — OpenAI는 **Responses API** (`client.responses.create`) 사용 (2026 공식 권장).

**Branch:** `feat/w0-provider-model-registry`

---

## 0. LOCKED 제약 (변경 금지 — HANDOFF ⭐ 65차 / memory `project_mvp_engine_4workstreams_2026_06_04`)

- **D28 (A)**: Claude = 필수 primary / GPT = 선택 secondary / **GPT-only 미지원** (`ANTHROPIC_API_KEY` 없으면 AI 기능 비활성 — fail-closed `ai_key_unavailable` 유지).
- **D28 (C)**: MVP 기본 = 두 키 동시 사용. provider auto-detect fallback (GPT 키 없으면 자동 Claude-only). 설정 UI 토글 = 후순위(이번 scope 아님).
- **D28 (B-final) 역할→모델 기본 배분** (전부 "초기 기본값(가설), track-record 후 레지스트리에서 조정"):
  ① 토론참가 Core 11 = Sonnet 4.6 ×6 + GPT mid ×5 혼합 (W1 배선 — W0은 config 상수 박제만)
  ② R2 선택적 — trigger = top10 경계 ±5 + persona 점수 분산 상위 20% (config 상수 박제)
  ③ 최종 judge = Opus 4.8 + 경계 ±2 GPT 최고급 dual-judge (W1 배선 — W0은 registry role 정의만)
  ④ 풀 리포트 writer·revise = Opus 4.8
  ⑤ critic = GPT mid 교차 (GPT off 시 Haiku fallback)
  ⑥ W3 포트 판단 = Opus 4.8 (W3 배선 — W0은 registry role 정의만)
- **hardcap 50만** (warning 임계는 파생값 — 본 plan 결정 #5).
- **W0 비용가드 3종 (DoD 필수)**: ① GPT + Opus 4.8 단가 등록 ② unknown model fail-closed (silent Sonnet fallback 제거) ③ model-aware reservation.
- **W0 행동변화 가드**: 실 AI 호출 0회(production cost_log=0) + 모든 실호출 게이트 USER-gated → 관측 가능 행동변화 0 유지. mock/flag-off 경로 무회귀 (test:ci).

## 0.1 리서치 확정 사실 (2026-06-04 Workflow 3-agent + 공식 docs, confidence high)

| 항목 | 값 |
|---|---|
| OpenAI top | `gpt-5.5` — $5 input / $30 output / cached input $0.50 (×0.1) |
| OpenAI mid (≈Sonnet급 — 가정 검증 TRUE) | `gpt-5.4` — $2.50 / $15 / cached $0.25 (×0.1) |
| OpenAI small (cheap smoke용) | `gpt-5.4-mini` — $0.75 / $4.50 / cached $0.075 (×0.1) |
| Anthropic Opus 4.8 | `claude-opus-4-8` (dateless id) — $5 / $25 (opus-4-7과 동일 단가). cache write ×1.25 / read ×0.1 확인 |
| Sonnet 4.6 / Haiku 4.5 | `claude-sonnet-4-6` $3/$15 · `claude-haiku-4-5-20251001`(API) / `claude-haiku-4-5`(pricing key) $1/$5 — 기존 코드 정합 확인 |
| OpenAI SDK | npm `openai` ^6.42.0, **Responses API** (`responses.create({model, instructions, input, max_output_tokens})` → `response.output_text` + `response.usage`) |
| OpenAI usage 정규화 ⚠️ | `usage.input_tokens`는 **cached 포함 total** (Anthropic은 uncached만) → normalize 시 `uncached = input_tokens - input_tokens_details.cached_tokens`. cache_creation 개념 없음(자동 캐시) → 0 고정 |
| OpenAI 에러 | `OpenAI.APIError` 서브클래스 (RateLimitError 429 / AuthenticationError 401 / InternalServerError 5xx / APIConnectionError). SDK 자체 retry 2회 default |
| ⚠️ Opus 4.7+ tokenizer | 동일 텍스트 ~최대 35% 토큰 증가 가능 — projection 비고로 박제 (기존 calibration은 opus-4-7 기준이라 pre-existing) |

## 0.2 Plan 결정 사항 (omxy ② 검토 대상)

1. **registry 기본값 = D28 B-final 그대로 박제하되, 현 runtime 배선 role만 즉시 소비**: `full_report`/`revise` → `claude-opus-4-8`(D28 ④ — opus-4-7과 동일 단가라 비용 가드 영향 0), `critic` → `gpt-5.4` preferred + `claude-haiku-4-5` fallback(D28 ⑤ — GPT 키 없으면 현행 Haiku 그대로 = 무회귀), `tier1_panel` → `claude-opus-4-7` **현행 유지**(D28 ① 토론 mix는 W1 멀티라운드 구조에서 배선 — HANDOFF W1 명시). `debate_judge`/`dual_judge_gpt`/`portfolio` = W1/W3 소비용 정의만. **명시 (omxy R1)**: W0 runtime에서 GPT를 실제 소비할 수 있는 경로는 critic뿐 — D28 C "두 키 동시 사용"의 본격 소비(Core 11 mix)는 W1이며, W0은 registry/projection/smoke 수준에서만 두 키를 다룬다.
2. **hardcap throw 키 rename**: `cost_hardcap_40man` → **`cost_hardcap_exceeded`** (HANDOFF가 허용한 두 선택지 중 rename 채택 — 근거: cap-agnostic으로 향후 cap 변경 시 키 churn 재발 방지 + 50만 메시지에 "40man" 키 잔존하는 어휘 부정합 제거). 안전 주장(production DB row 0)은 **구현 시점 Supabase 실측 verify가 게이트** (Step 6.4c — report_batch_job count=0 확인, tier1_selection_job은 0031 미적용=부재). 18+개 파일 일괄 (workers 문자열 매칭 + portfolio/actions.ts 포함).
3. **OpenAI usage 정규화**: `input_tokens = total - cached` (uncached), `cache_read_input_tokens = cached`, `cache_creation_input_tokens = 0` → 기존 `calculateCostKrw` 산식(uncached×1.0 + read×readMult) 그대로 재사용.
4. **cache multiplier를 per-model 단가표 필드로 이동**: Anthropic write ×1.25/read ×0.1, OpenAI write 0(개념 없음)/read ×0.1.
5. **COST_WARNING_THRESHOLD_KRW = 450,000** (hardcap 90%, 구 87.5%에서 라운딩 — **가정**: 50만 LOCKED의 파생값, 사용자 veto 가능).
6. **`anthropic-pricing.ts` 파일명 유지** + 내부 `MODEL_PRICING` 멀티프로바이더 확장 (HANDOFF file:line 포인터 + import 경로 churn 최소화). `ANTHROPIC_PRICING` export는 하위호환 alias로 보존.
7. **provider SDK 재시도는 SDK default 유지** (Anthropic 기존 동작과 대칭 — worker 레벨 retryWithBackoff와 이중이지만 기존 Anthropic 경로도 동일 구조였음. 변경 시 W1에서).
8. **D28 reservation projection = 실행 가능한 함수 + 테스트** (`projectD28MonthlyReservationKrw()` — config 상수에서 닫힌 산식, `≤ HARDCAP_KRW` assert). HANDOFF "W0에서 실 단가 등록 후 reservation 재검증 = DoD 게이트" 충족.
9. **W0 smoke = env-gated live 테스트 파일** (`W0_LIVE_SMOKE=true` 시에만, cheap model 1 ticker/provider, persist 금지 — cost_log insert만). 실행은 USER 비용 승인 게이트.

## 0.3 파일 구조 맵

```
[신규]
tudal/src/lib/ai/provider.ts                    — LlmProvider 인터페이스 + LlmCallParams/Result + provider 가용성 헬퍼
tudal/src/lib/ai/anthropic-provider.ts          — Anthropic SDK wrapper (cache_control + usage 정규화, 기존 4 client 로직 추출)
tudal/src/lib/ai/openai-provider.ts             — OpenAI SDK wrapper (Responses API + usage 정규화)
tudal/src/lib/ai/model-registry.ts              — AiRole → {provider, model, pricingKey, calibration} 매핑 SoT + auto-detect resolve + 역할별 reservation + D28 config + projection
tudal/src/lib/ai/__tests__/provider-anthropic.test.ts
tudal/src/lib/ai/__tests__/provider-openai.test.ts
tudal/src/lib/ai/__tests__/model-registry.test.ts
tudal/src/lib/ai/__tests__/d28-reservation-projection.test.ts
tudal/src/lib/ai/__tests__/w0-provider-smoke.live.test.ts  — env-gated (CI에서 skip)

[수정 — 코어]
tudal/src/lib/cost/anthropic-pricing.ts         — MODEL_PRICING 멀티프로바이더 + opus-4-8/gpt-5.5/gpt-5.4/gpt-5.4-mini + getPricing fail-closed throw
tudal/src/lib/cost/pricing.ts                   — calculateCostKrw per-model mult + HARDCAP_KRW 500_000 + COST_WARNING 450_000
tudal/src/lib/cost/cost-logger.ts               — preflightHardcap: throw 키 rename + reservation lines(역할별 합산) 수용
tudal/src/types/admin.ts                        — COST_HARDCAP_KRW 500_000 + COST_WARNING_THRESHOLD_KRW 450_000 + 주석
tudal/src/lib/ai/anthropic-client.ts            — callPersona → registry(tier1_panel) + provider 경유
tudal/src/lib/ai/full-report-client.ts          — registry(full_report) 경유
tudal/src/lib/ai/critic-client.ts               — registry(critic) 경유 (GPT preferred/Haiku fallback)
tudal/src/lib/ai/revise-client.ts               — registry(revise) 경유

[수정 — 키 rename + reservation 배선 + 표면]
tudal/src/lib/screening/tier1-selection-batch-worker.ts   — 키 rename + model-aware reservation lines
tudal/src/lib/report/full-report-batch-worker.ts          — 키 rename (reservation은 기존 ORCHESTRATE budget 유지 — registry 파생으로 전환)
tudal/src/lib/report/retry-with-backoff.ts                — 키 rename (주석)
tudal/src/lib/report/full-report-writer.ts                — 주석 갱신 (40만원 → 50만원)
tudal/src/app/(admin)/admin/report/[ticker]/regenerate/actions.ts — 키 rename
tudal/src/lib/admin/format-error.ts             — 키 rename 매핑 + 신규 코드(`pricing_unknown_model`) 한국어
tudal/src/app/(admin)/admin/settings/cost/page.tsx — 35만/40만 → 45만/50만 문구
tudal/src/app/(admin)/admin/alerts/page.tsx + alerts/[id]/page.tsx — 라벨 (40만)→(50만), (35만)→(45만)
tudal/src/lib/cost/aggregate.ts + dry-run-estimate.ts — 주석 + unknown-model 테스트 정합
tudal/package.json                              — `openai` 의존성
tudal/.env.example                              — `OPENAI_API_KEY` (선택 secondary)

[수정 — 테스트 (기존)]
persona-eval.test / tier1-selection-batch-worker.test / full-report-batch-worker.test /
full-report-writer.test / actions.test / orchestrate-wire.test / trigger-full-report-action.test /
monthly-batch-action.test / retry-with-backoff.test / format-error.test / cost-logger.test /
cost-logger-step2-rpc.test / pricing.test / dry-run-estimate.test / aggregate.test /
full-report-client.test / critic-client.test / revise-client.test / full-report-orchestrator.test
— 400_000→500_000 mock값, cost_hardcap_40man→cost_hardcap_exceeded, 모델 id 갱신(writer/revise=opus-4-8, critic resolve), unknown-model fallback→throw
```

---

## Task 1: 단가표 멀티프로바이더 확장 + fail-closed (D28 ①②)

**Files:**
- Modify: `tudal/src/lib/cost/anthropic-pricing.ts`
- Test: `tudal/src/lib/cost/__tests__/pricing.test.ts`, `tudal/src/lib/cost/__tests__/dry-run-estimate.test.ts`

- [ ] **Step 1.1: 실패 테스트 작성** — pricing.test.ts에 추가:

```ts
import { MODEL_PRICING, getPricing } from '../anthropic-pricing';

describe('W0 multi-provider pricing registry (D28)', () => {
  it('registers claude-opus-4-8 at $5/$25', () => {
    expect(MODEL_PRICING['claude-opus-4-8']).toMatchObject({
      provider: 'anthropic', inputPerMTokUsd: 5, outputPerMTokUsd: 25,
      cacheWriteMult: 1.25, cacheReadMult: 0.1,
    });
  });
  it('registers gpt-5.5 / gpt-5.4 / gpt-5.4-mini with openai provider', () => {
    expect(MODEL_PRICING['gpt-5.5']).toMatchObject({ provider: 'openai', inputPerMTokUsd: 5, outputPerMTokUsd: 30, cacheWriteMult: 0, cacheReadMult: 0.1 });
    expect(MODEL_PRICING['gpt-5.4']).toMatchObject({ provider: 'openai', inputPerMTokUsd: 2.5, outputPerMTokUsd: 15 });
    expect(MODEL_PRICING['gpt-5.4-mini']).toMatchObject({ provider: 'openai', inputPerMTokUsd: 0.75, outputPerMTokUsd: 4.5 });
  });
  it('getPricing throws pricing_unknown_model on unregistered model (D28 ② fail-closed)', () => {
    expect(() => getPricing('not-a-model')).toThrow('pricing_unknown_model:not-a-model');
  });
});
```

- [ ] **Step 1.2: 테스트 실패 확인** — `npx vitest run src/lib/cost/__tests__/pricing.test.ts` → FAIL (MODEL_PRICING undefined)

- [ ] **Step 1.3: 구현** — `anthropic-pricing.ts` 전체 교체:

```ts
// ---------------------------------------------------------------------------
// 멀티프로바이더 AI API 가격표 + KRW 환산 (S6 M17 → W0 D28 확장)
// ref Anthropic: https://platform.claude.com/docs/en/about-claude/pricing (2026-06 검증)
// ref OpenAI:   https://developers.openai.com/api/docs/pricing (2026-06 검증)
//
// ⚠️ 파일명은 historical (S6 당시 Anthropic 단독). W0(65차 Q3/D28)부터 멀티프로바이더
//    MODEL_PRICING SoT. 이름 변경은 import 경로 churn 대비 이득 없어 유지.
//
// D28 ② fail-closed: getPricing은 미등록 모델에서 throw (구 silent Sonnet fallback 제거
//    — reservation undercount 차단).
// ---------------------------------------------------------------------------

import { COST_USD_TO_KRW } from "@/types/admin";

export type AiProviderId = "anthropic" | "openai";

export interface ModelPricing {
  provider: AiProviderId;
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
  // prompt cache 승수 (input 단가 기준):
  //   anthropic: write(5m) ×1.25 / read ×0.10 (공식 docs 2026-06 재검증)
  //   openai:    자동 캐시 — write 개념 없음(0) / cached input ×0.10
  cacheWriteMult: number;
  cacheReadMult: number;
}

// 2026-06 기준 표준 단가 (각 공식 docs). 배치/규모 할인 미적용.
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  "claude-opus-4-8":  { provider: "anthropic", inputPerMTokUsd: 5,    outputPerMTokUsd: 25,  cacheWriteMult: 1.25, cacheReadMult: 0.1 },
  "claude-opus-4-7":  { provider: "anthropic", inputPerMTokUsd: 5,    outputPerMTokUsd: 25,  cacheWriteMult: 1.25, cacheReadMult: 0.1 },
  "claude-sonnet-4-6":{ provider: "anthropic", inputPerMTokUsd: 3,    outputPerMTokUsd: 15,  cacheWriteMult: 1.25, cacheReadMult: 0.1 },
  "claude-haiku-4-5": { provider: "anthropic", inputPerMTokUsd: 1,    outputPerMTokUsd: 5,   cacheWriteMult: 1.25, cacheReadMult: 0.1 },
  // OpenAI (D28 ① GPT 단가 등록 — gpt-5.4 ≈ Sonnet급 검증 TRUE)
  "gpt-5.5":          { provider: "openai",    inputPerMTokUsd: 5,    outputPerMTokUsd: 30,  cacheWriteMult: 0,    cacheReadMult: 0.1 },
  "gpt-5.4":          { provider: "openai",    inputPerMTokUsd: 2.5,  outputPerMTokUsd: 15,  cacheWriteMult: 0,    cacheReadMult: 0.1 },
  "gpt-5.4-mini":     { provider: "openai",    inputPerMTokUsd: 0.75, outputPerMTokUsd: 4.5, cacheWriteMult: 0,    cacheReadMult: 0.1 },
};

// 하위호환 alias (기존 import 보존 — 신규 코드는 MODEL_PRICING 사용)
export const ANTHROPIC_PRICING = MODEL_PRICING;

// dry-run 견적 기본 모델 (settings/cost 견적 화면용 — fallback 아님)
export const DEFAULT_MODEL = "claude-sonnet-4-6";

// D28 ② fail-closed: silent fallback 제거 — 미등록 모델 = throw.
export function getPricing(model: string): ModelPricing {
  const p = MODEL_PRICING[model];
  if (!p) throw new Error(`pricing_unknown_model:${model}`);
  return p;
}

// USD 비용 계산 (cache 미반영 단순 견적 — dry-run-estimate 전용)
export function computeCostUsd(
  model: string,
  tokensPrompt: number,
  tokensCompletion: number,
): number {
  const p = getPricing(model);
  return (
    (tokensPrompt * p.inputPerMTokUsd) / 1_000_000 +
    (tokensCompletion * p.outputPerMTokUsd) / 1_000_000
  );
}

// KRW 환산 (소수점 2자리 round)
export function computeCostKrw(
  model: string,
  tokensPrompt: number,
  tokensCompletion: number,
  usdToKrw: number = COST_USD_TO_KRW,
): number {
  const usd = computeCostUsd(model, tokensPrompt, tokensCompletion);
  return Math.round(usd * usdToKrw * 100) / 100;
}
```

- [ ] **Step 1.4: dry-run-estimate.test.ts:32 갱신** — `computeCostKrw("unknown-model", …)`이 Sonnet fallback을 기대하던 테스트 → throw 기대로 교체:

```ts
it("미등록 모델은 throw (D28 ② fail-closed — 구 Sonnet fallback 제거)", () => {
  expect(() => computeCostKrw("unknown-model", 1_000_000, 1_000_000)).toThrow("pricing_unknown_model:unknown-model");
});
```

- [ ] **Step 1.5: 테스트 통과 확인** — `npx vitest run src/lib/cost/__tests__/` → PASS
- [ ] **Step 1.6: Commit** — `feat(w0): multi-provider MODEL_PRICING + opus-4.8/gpt 단가 등록 + unknown model fail-closed (D28 ①②)`

---

## Task 2: hardcap 50만 + warning 45만 + per-model cache mult (calculateCostKrw)

**Files:**
- Modify: `tudal/src/lib/cost/pricing.ts`, `tudal/src/types/admin.ts`
- Test: `tudal/src/lib/cost/__tests__/pricing.test.ts`, `aggregate.test.ts`

- [ ] **Step 2.1: 실패 테스트** — pricing.test.ts:

```ts
it('HARDCAP_KRW = 500_000 (65차 LOCKED #5)', () => {
  expect(HARDCAP_KRW).toBe(500_000);
  expect(COST_WARNING_THRESHOLD_KRW).toBe(450_000);
});
it('calculateCostKrw는 openai 모델에서 cacheWrite 0 / cacheRead 0.1 적용', () => {
  // gpt-5.4: input $2.5/M. cached 1M tok → 2.5 × 0.1 = $0.25 → ×1430 = 357.5
  const krw = calculateCostKrw(
    { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 1_000_000, output_tokens: 0 },
    'gpt-5.4',
  );
  expect(krw).toBe(357.5);
});
```

- [ ] **Step 2.2: 구현** — `pricing.ts` 변경점:
  - `CACHE_CREATION_MULT`/`CACHE_READ_MULT` 모듈 상수 삭제 → `calculateCostKrw` 내부에서 `pricing.cacheWriteMult`/`pricing.cacheReadMult` 사용.
  - `HARDCAP_KRW = 500_000` (주석: `// 65차 LOCKED #5 (2026-06-04) — 40만 → 50만. 구 "M17 Q2 40만"은 supersede.`)
  - `COST_WARNING_THRESHOLD_KRW = 450_000` (주석: hardcap 90% 파생).
  - `S7A_MODEL`/`CRITIC_PRICING_KEY`/`REVISE_PRICING_KEY`의 `in ANTHROPIC_PRICING` 가드는 `in MODEL_PRICING`으로 정리(동작 동일). **주의**: `REVISE_PRICING_KEY`는 Task 5에서 registry로 대체되기 전까지 `"claude-opus-4-8"`로 갱신 (D28 ④ revise=Opus 4.8 — calibration 동일, 단가 동일).

```ts
export function calculateCostKrw(usage: TokenUsage, model: string = S7A_MODEL): number {
  const pricing = getPricing(model); // D28 ② 미등록 모델 throw
  const inUsdPerTok = pricing.inputPerMTokUsd / 1_000_000;
  const outUsdPerTok = pricing.outputPerMTokUsd / 1_000_000;

  const inputUsd = usage.input_tokens * inUsdPerTok;
  const cacheCreationUsd = usage.cache_creation_input_tokens * inUsdPerTok * pricing.cacheWriteMult;
  const cacheReadUsd = usage.cache_read_input_tokens * inUsdPerTok * pricing.cacheReadMult;
  const outputUsd = usage.output_tokens * outUsdPerTok;
  const totalUsd = inputUsd + cacheCreationUsd + cacheReadUsd + outputUsd;

  return Math.round(totalUsd * COST_USD_TO_KRW * 100) / 100;
}
```

- [ ] **Step 2.3: types/admin.ts 동기화**:

```ts
// M17 임계치 상수 (R3.12-1·R3.12-2) — 65차 LOCKED #5 (2026-06-04): hardcap 40만 → 50만, 경보 35만 → 45만(90% 파생)
export const COST_WARNING_THRESHOLD_KRW = 450_000;
export const COST_HARDCAP_KRW = 500_000;
```
  + `:27` 주석 `"35만 경보 (40만 hardcap 직전)"` → `"45만 경보 (50만 hardcap 직전)"`, `:350-353` 주석 350,000/400,000 → 450,000/500,000.

- [ ] **Step 2.4: aggregate.test.ts / dry-run-estimate.test.ts 임계 가정 확인** — 상수 참조면 무수정, 리터럴 400000/350000이면 갱신. PASS 확인.
- [ ] **Step 2.5: Commit** — `feat(w0): hardcap 50만 + warning 45만 + per-model cache mult (65차 LOCKED #5)`

---

## Task 3: provider 계층 (LlmProvider + anthropic/openai 구현) + openai 의존성

**Files:**
- Create: `tudal/src/lib/ai/provider.ts`, `anthropic-provider.ts`, `openai-provider.ts`
- Modify: `tudal/package.json` (+`openai`)
- Test: `__tests__/provider-anthropic.test.ts`, `__tests__/provider-openai.test.ts`

- [ ] **Step 3.1: `npm install openai`** (^6.42.0) — package.json diff 확인.

- [ ] **Step 3.2: `provider.ts`**:

```ts
// W0 (65차 Q3/D28) — LLM provider 추상화 인터페이스.
// Claude = 필수 primary / GPT = 선택 secondary / GPT-only 미지원 (D28 A).
import type { TokenUsage } from '@/lib/cost/pricing';
import type { AiProviderId } from '@/lib/cost/anthropic-pricing';

export interface LlmCallParams {
  model: string;          // 공급자별 API model id (registry가 resolve)
  maxTokens: number;
  systemPrompt: string;
  userPrompt: string;
  // Anthropic prompt cache opt-in (AI_PROMPT_CACHE_ENABLED). OpenAI는 자동 캐시라 무시.
  enablePromptCache?: boolean;
}

export interface LlmCallResult {
  text: string;
  usage: TokenUsage;      // 정규화: input=uncached, cache_read, cache_creation(openai=0), output
}

export interface LlmProvider {
  readonly id: AiProviderId;
  /** env 키 존재 여부 (auto-detect — D28 C) */
  isAvailable(): boolean;
  /** 단발 system+user 호출. SDK 원시 에러를 그대로 throw (코드 매핑은 caller 책임). */
  call(params: LlmCallParams): Promise<LlmCallResult>;
}

export function isAnthropicAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
export function isOpenAiAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
```

- [ ] **Step 3.3: `anthropic-provider.ts`** — 기존 4 client의 SDK 로직 추출 (동작 동일):

```ts
import Anthropic from '@anthropic-ai/sdk';
import type { TokenUsage } from '@/lib/cost/pricing';
import { isAnthropicAvailable, type LlmCallParams, type LlmCallResult, type LlmProvider } from './provider';

export const anthropicProvider: LlmProvider = {
  id: 'anthropic',
  isAvailable: isAnthropicAvailable,
  async call(params: LlmCallParams): Promise<LlmCallResult> {
    // D28 A fail-closed: Claude 키 부재 = AI 기능 비활성 (기존 ai_key_unavailable 계약은 caller가 throw)
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemBlocks = params.enablePromptCache
      ? [{ type: 'text' as const, text: params.systemPrompt, cache_control: { type: 'ephemeral' as const } }]
      : [{ type: 'text' as const, text: params.systemPrompt }];
    const response = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system: systemBlocks,
      messages: [{ role: 'user', content: params.userPrompt }],
    });
    const text = response.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');
    const usageWithCache = response.usage as typeof response.usage & {
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    const usage: TokenUsage = {
      input_tokens: response.usage.input_tokens ?? 0,
      cache_creation_input_tokens: usageWithCache.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: usageWithCache.cache_read_input_tokens ?? 0,
      output_tokens: response.usage.output_tokens ?? 0,
    };
    return { text, usage };
  },
};
```

  ⚠️ 기존 full-report/critic/revise는 `system: input.systemPrompt` (string)이었고 callPersona만 blocks+cache였다 — provider는 blocks 통일 (cache off 시 plain text block = string과 SDK 동작 동일). 회귀 없음을 client 테스트로 증명.

- [ ] **Step 3.4: `openai-provider.ts`**:

```ts
import OpenAI from 'openai';
import type { TokenUsage } from '@/lib/cost/pricing';
import { isOpenAiAvailable, type LlmCallParams, type LlmCallResult, type LlmProvider } from './provider';

export const openaiProvider: LlmProvider = {
  id: 'openai',
  isAvailable: isOpenAiAvailable,
  async call(params: LlmCallParams): Promise<LlmCallResult> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: params.model,
      instructions: params.systemPrompt,
      input: params.userPrompt,
      max_output_tokens: params.maxTokens,
    });
    const text = response.output_text ?? '';
    const u = response.usage;
    const cached = u?.input_tokens_details?.cached_tokens ?? 0;
    const totalInput = u?.input_tokens ?? 0;
    // ⚠️ OpenAI input_tokens = cached 포함 total / Anthropic = uncached만.
    //    calculateCostKrw 산식(uncached ×1.0 + read ×0.1) 재사용 위해 분리 정규화.
    const usage: TokenUsage = {
      input_tokens: Math.max(0, totalInput - cached),
      cache_creation_input_tokens: 0, // OpenAI 자동 캐시 — write tier 없음
      cache_read_input_tokens: cached,
      output_tokens: u?.output_tokens ?? 0,
    };
    return { text, usage };
  },
};
```

- [ ] **Step 3.5: provider 테스트** — SDK를 `vi.mock`으로 대체:
  - anthropic: cache on→blocks에 cache_control 존재 / off→부재, usage 정규화(4필드), text join.
  - openai: `responses.create` 호출 인자(instructions/input/max_output_tokens), `input_tokens=총-캐시` 정규화, cached 없는 usage shape(undefined details) → 0 처리, output_text 부재 → ''.
- [ ] **Step 3.6: 게이트** — `npx vitest run src/lib/ai/__tests__/provider-*.test.ts` PASS + `npm run build` (openai dep 포함 빌드 통과).
- [ ] **Step 3.7: Commit** — `feat(w0): LlmProvider 추상화 + anthropic/openai provider (Responses API + usage 정규화)`

---

## Task 4: model-registry (역할→모델 SoT + auto-detect + reservation + D28 config/projection)

**Files:**
- Create: `tudal/src/lib/ai/model-registry.ts`
- Test: `__tests__/model-registry.test.ts`, `__tests__/d28-reservation-projection.test.ts`

- [ ] **Step 4.1: `model-registry.ts`** (전체):

```ts
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
// ORCHESTRATE_TOTAL_COST_BUDGET_KRW supersede: critic이 GPT mid로 resolve되면 Haiku 고정
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
```

- [ ] **Step 4.2: registry 테스트**:
  - 역할 7종 resolve 기본값 = D28 표 (writer/revise/judge/portfolio=opus-4-8, critic preferred=gpt-5.4, tier1_panel=opus-4-7).
  - `OPENAI_API_KEY` unset → critic resolve = haiku fallback / dual_judge_gpt = opus-4-8 fallback (`vi.stubEnv`).
  - `OPENAI_API_KEY` set → critic = gpt-5.4.
  - `getRoleMaxCostPerCallKrw('tier1_panel')` = 기존 `MAX_COST_PER_CALL_KRW`와 동일값 (≈82.23) — 무회귀 anchor.
  - registry pricingKey 전수 MODEL_PRICING 존재 (모듈 로드 invariant — import가 안 터지는 것 자체가 증명 + 명시 assert).
- [ ] **Step 4.3: projection 테스트** (`d28-reservation-projection.test.ts`):

```ts
it('D28 B-final 배분 기준 월간 reservation ≤ HARDCAP_KRW 50만 (W0 DoD 게이트)', () => {
  const p = projectD28MonthlyReservationKrw();
  expect(p.totalKrw).toBeLessThanOrEqual(HARDCAP_KRW);
  expect(p.totalKrw).toBeGreaterThan(100_000); // 산식 공동(空) 방지 sanity
});
it('all-Opus 2라운드면 50만 초과 (HANDOFF 비용 가드 근거 재현 — 혼합 필수성 증명)', () => {
  // 60×4.345 + 120 tickers × 11콜 × 2라운드 × 82.23 ≈ 69만 > 50만
  const tickers = (50 + 10) * 4.345 + (100 + 20);
  const allOpus2R = tickers * 11 * 2 * getRoleMaxCostPerCallKrw('tier1_panel');
  expect(allOpus2R).toBeGreaterThan(HARDCAP_KRW);
});
```

- [ ] **Step 4.4: PASS 확인 + Commit** — `feat(w0): model-registry (역할→모델 SoT + auto-detect + D28 config/projection ≤50만)`

---

## Task 5: 4 AI client 레지스트리/프로바이더 배선 (행동 계약 보존)

**Files:**
- Modify: `anthropic-client.ts`, `full-report-client.ts`, `critic-client.ts`, `revise-client.ts`
- Test: 각 `__tests__/*.test.ts` 갱신

**공통 패턴** (각 client의 public 계약 — input/result/throw 코드/cost_log 필드 — 불변):

- [ ] **Step 5.1: `anthropic-client.ts` (callPersona)**:
  - `const MODEL = 'claude-opus-4-7'` 삭제 → `const resolved = resolveRole('tier1_panel')`.
  - `if (!process.env.ANTHROPIC_API_KEY) throw new Error('ai_key_unavailable')` **유지** (D28 A fail-closed — provider 가용성과 별개로 Claude 필수 게이트).
  - SDK 직접 호출 → `resolved.provider.call({ model: resolved.model, maxTokens: resolved.maxTokens, systemPrompt: persona.systemPrompt, userPrompt, enablePromptCache: promptCacheEnabled })`, `catch { throw new Error('ai_call_failed') }` 유지.
  - `calculateCostKrw(usage)` → `calculateCostKrw(usage, resolved.pricingKey)` (암묵 S7A_MODEL 결합 제거).
  - `insertCostLog({... model: MODEL ...})` → `model: resolved.model`.
- [ ] **Step 5.2: `full-report-client.ts`** — 동일 패턴, role=`full_report`, throw 코드 `full_report_llm_failed` + console.warn 유지. `MAX_TOKENS = 8192` → registry maxTokens.
- [ ] **Step 5.3: `revise-client.ts`** — role=`revise`. `REVISE_API_MODEL` export는 registry 파생으로 유지(`export const REVISE_API_MODEL = resolveRole('revise').model` — 기존 import 호환) 또는 import 0이면 제거.
- [ ] **Step 5.4: `critic-client.ts`** — role=`critic`. `CRITIC_API_MODEL`/`CRITIC_PRICING_KEY` 상수 → resolve 시점 파생 (GPT 가용 시 gpt-5.4 / 아니면 haiku). zod parse + `critic_*` throw 코드 + reason 500자 cap 전부 유지. cost_log `model` = resolved.model.
  ⚠️ critic은 **호출 시점 resolve** (모듈 로드 시점 고정 금지 — 테스트에서 env stub 가변).
- [ ] **Step 5.5: client 테스트 갱신** — SDK mock 대신 provider mock(`vi.mock('@/lib/ai/anthropic-provider')` 등) 또는 SDK mock 유지(provider가 SDK를 쓰므로 기존 SDK-level mock 그대로 동작할 수 있음 — **기존 mock 방식 유지 우선**, 모델 id assert만 갱신: writer/revise = `claude-opus-4-8`, critic = env에 따라 분기 테스트 추가).
- [ ] **Step 5.6: 게이트** — `npx vitest run src/lib/ai` PASS. **Commit** — `feat(w0): 4 AI client → model-registry/provider 배선 (D28 ④⑤ 기본 배분)`

---

## Task 6: model-aware reservation + hardcap 키 rename (D28 ③)

**Files:**
- Modify: `cost-logger.ts`, `tier1-selection-batch-worker.ts`, `full-report-batch-worker.ts`, `retry-with-backoff.ts`, `regenerate/actions.ts`, `full-report-writer.ts`(주석), `persona-eval.ts`(주석/무변경 확인), `format-error.ts`
- Test: 해당 `__tests__` 일괄

- [ ] **Step 6.1: `cost-logger.ts` preflightHardcap**:

```ts
export interface ReservationLine { callCount: number; maxCostPerCallKrw: number }

export async function preflightHardcap(
  opts: {
    month: string;
    callCount?: number;            // 단일 라인 (기존 호환)
    maxCostPerCallKrw?: number;
    lines?: ReservationLine[];     // D28 ③ 역할별 (콜수 × 해당 모델 단가) 합산
  },
  options: CostHelperOptions = {},
): Promise<{ currentTotal: number; reservation: number; remaining: number }> {
  // fail-open 차단 (omxy R1 HIGH fix): lines/callCount 둘 다 부재, lines: [], 음수/비유한 값
  // 전부 reservation 0/오염으로 hardcap 무력화 가능 → 명시 throw.
  if (!opts.lines && opts.callCount == null) {
    throw new Error('preflight_reservation_missing');
  }
  if (opts.lines) {
    if (opts.lines.length === 0) throw new Error('preflight_reservation_missing');
    for (const l of opts.lines) {
      if (
        !Number.isFinite(l.callCount) || l.callCount < 0 ||
        !Number.isFinite(l.maxCostPerCallKrw) || l.maxCostPerCallKrw < 0
      ) {
        throw new Error('preflight_reservation_invalid');
      }
    }
  } else if (
    !Number.isFinite(opts.callCount!) || opts.callCount! < 0 ||
    (opts.maxCostPerCallKrw != null && (!Number.isFinite(opts.maxCostPerCallKrw) || opts.maxCostPerCallKrw < 0))
  ) {
    throw new Error('preflight_reservation_invalid');
  }
  const currentTotal = await getMonthlyTotal(opts.month, options);
  const reservation = opts.lines
    ? opts.lines.reduce((s, l) => s + l.callCount * l.maxCostPerCallKrw, 0)
    : (opts.callCount ?? 0) * (opts.maxCostPerCallKrw ?? MAX_COST_PER_CALL_KRW);
  if (currentTotal + reservation > HARDCAP_KRW) {
    throw new Error('cost_hardcap_exceeded'); // 구 cost_hardcap_40man — 65차 50만 + cap-agnostic rename
  }
  return { currentTotal, reservation, remaining: HARDCAP_KRW - currentTotal - reservation };
}
```

- [ ] **Step 6.2: `tier1-selection-batch-worker.ts`** — 균일 `MAX_COST_PER_CALL_KRW` supersede:
  - `projectedKrw = callCount * MAX_COST_PER_CALL_KRW` → `pendingCount * CORE_11_CALLS_PER_TICKER * getRoleMaxCostPerCallKrw('tier1_panel')` (W1에서 mix lines로 진화할 단일 지점).
  - `input.preflightHardcap({ month, callCount }, …)` → `{ month, lines: [{ callCount, maxCostPerCallKrw: getRoleMaxCostPerCallKrw('tier1_panel') }] }`.
  - `cost_hardcap_40man` 문자열 7곳 → `cost_hardcap_exceeded`.
- [ ] **Step 6.3: `full-report-batch-worker.ts` + `full-report-orchestrator.ts`** — `ORCHESTRATE_TOTAL_COST_BUDGET_KRW`(pricing.ts 고정 키 합산 — critic GPT resolve 시 undercount) import → **registry `getOrchestrateBudgetKrw()`(worst-case 합산)로 교체**. pricing.ts의 구 상수는 importer 0 확인 후 제거(또는 deprecated 주석 + registry 위임). `cost_hardcap_40man` 7곳 rename.
- [ ] **Step 6.4: 나머지 rename 일괄** — `retry-with-backoff.ts`(비transient 판정 — `msg.includes` 패턴 확인 후 키 교체), `regenerate/actions.ts:129`, `format-error.ts`:

```ts
cost_hardcap_exceeded: "월 AI 비용 한도(50만원)를 초과했습니다",
pricing_unknown_model: "미등록 AI 모델 단가입니다 — 모델 레지스트리 등록이 필요합니다",
```

- [ ] **Step 6.4b: `portfolio/actions.ts` 포함** (omxy R1 MEDIUM catch — sweep 누락): `tudal/src/app/(admin)/admin/portfolio/actions.ts` 주석 "40만원" + 관련 키 사용처 rename. 그 테스트(trigger-full-report-action.test / monthly-batch-action.test)도 Step 6.5에 포함.
- [ ] **Step 6.4c: rename 안전성 production verify** (omxy R1 MEDIUM — 주장만으로 rename 금지): 구현 시점에 Supabase MCP로 `select count(*) from report_batch_job;` = 0 확인 (tier1_selection_job은 마이그 0031 미적용 = 테이블 부재 → 해당 없음). 0이 아니면 rename 중단 + 보고.
- [ ] **Step 6.5: 테스트 일괄 갱신** — `rg -l "cost_hardcap_40man" src`로 잔존 0 확인하며 테스트 12파일 교체 + 400_000 리터럴 mock → 500_000. persona-eval.test의 reservation 기대값 무회귀 확인. **preflight 검증 테스트 추가**: lines `[]` → throw / 음수 callCount → throw / NaN maxCost → throw / callCount 0 (단일) → throw 아님(예약 0 정상 의미 없음 — `lines` 경로와 달리 기존 호환: 단일 경로 callCount 0은 reservation 0 통과 유지 여부를 omxy와 확정 — 기본은 0 허용·음수만 차단).
- [ ] **Step 6.6: 게이트 + Commit** — `feat(w0): model-aware reservation lines + cost_hardcap_exceeded rename (D28 ③)`

---

## Task 7: 표면 동기화 (UI 라벨 + env + 주석 sweep)

**Files:**
- Modify: `settings/cost/page.tsx`, `alerts/page.tsx`, `alerts/[id]/page.tsx`, `.env.example`, `aggregate.ts`/`dry-run-estimate.ts`(주석), `full-report-writer.ts:146`(주석)

- [ ] **Step 7.1: UI 문구** — `40만`→`50만`, `35만`→`45만`, `400,000`→`500,000` (settings/cost 6곳 + alerts 라벨 2파일).
- [ ] **Step 7.2: `.env.example`** — `[S7a]` 섹션에 추가:

```bash
# W0 (65차 Q3/D28): GPT = 선택 secondary (Claude 필수 primary — GPT-only 미지원).
# 미설정 시 GPT 역할(critic 등) 자동 Claude fallback (auto-detect).
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 7.3: 주석 sweep** — `rg -n "40만|400_000|400000|40man|35만|350_000" tudal/src tudal/package.json tudal/.env.example` 잔존 0 (mock 재무 fixture의 `40_0000…` 우연 일치 등 화이트리스트 제외 — 검증 스크립트에 grep 패턴 박제).
- [ ] **Step 7.4: Commit** — `feat(w0): hardcap 50만 표면 동기화 (UI/env/주석)`

---

## Task 8: W0 live smoke **구현만** (실행 = 별도 USER 비용 승인 게이트 — W0 완료 게이트에 미포함) + 최종 게이트

> ⚠️ omxy R1 catch 명확화: 본 Task의 산출물은 **smoke 테스트 파일 + 실행 가이드**다. 실 API 호출은
> W0 머지/완료 판정에 포함되지 않으며(DoD #6 "실 AI 호출 0" 유지), USER가 비용 승인 후 별도 실행한다.

**Files:**
- Create: `__tests__/w0-provider-smoke.live.test.ts`

- [ ] **Step 8.1: smoke 테스트** — `describe.skipIf(process.env.W0_LIVE_SMOKE !== 'true')`:
  - provider별 cheap model 1콜 (anthropic: `claude-haiku-4-5-20251001` / openai: `gpt-5.4-mini` — 키 가용 시만), 삼성전자(005930) 단일 ticker 한 줄 평가 프롬프트.
  - assert: text 비공백 + usage 4필드 ≥0 + `calculateCostKrw` 양수.
  - **persist 금지** — short_list/report 쓰기 없음. cost_log는 `AI_COST_LOG_REAL_INSERT_ENABLED=true`+service-role 시만 (옵션 B: smoke는 cost_log도 생략하고 콘솔 출력 — **기본은 생략** 채택, 게이트 단순화).
  - CI(test:ci)에서는 skip → 게이트 영향 0.
- [ ] **Step 8.2: 실행 가이드 박제** (plan 하단 + HANDOFF):

```bash
cd tudal && set -a && source .env.local && set +a
W0_LIVE_SMOKE=true npx vitest run src/lib/ai/__tests__/w0-provider-smoke.live.test.ts
# 예상 비용: haiku 1콜 + gpt-5.4-mini 1콜 ≈ 10~20원 미만. USER 비용 승인 후 실행.
```

- [ ] **Step 8.3: 최종 게이트** — `npm run build && npm run lint && npm run test:ci && npx tsc --noEmit` ALL GREEN.
- [ ] **Step 8.4: DoD 검증 명령 일괄**:

```bash
rg -n "40만|400_000|40man" tudal/src tudal/package.json tudal/.env.example   # 잔존 0
rg -n "cost_hardcap_40man" tudal/src                                          # 잔존 0
rg -n "claude-opus-4-7" tudal/src -g '!__tests__' | grep -v "tier1_panel\|registry\|pricing"  # 하드코딩 잔존 = registry/pricing만
npx vitest run src/lib/ai/__tests__/d28-reservation-projection.test.ts        # ≤50만 PASS
```

- [ ] **Step 8.5: Commit** — `feat(w0): live smoke (env-gated) + DoD 게이트`

---

## Task 9 (구현 후): omxy §2.0a ②③ + Claude ④ + PR + 문서 동기화

- [ ] omxy 적대 검토 (catch+direct-edit) → Claude ④ 재검증 loop (잔여 0까지).
- [ ] PR create → rebase FF merge → branch cleanup.
- [ ] 문서 동기화: `HANDOFF.md`(W0 완료 박제 + 다음 = W2), `ProgressDashboard.md`, `CodebaseStatus.md`(신규 모듈 4), `CLAUDE.md` 진행 포인터, `.env.example` 반영 확인. 과거 timeline bulk 수정 금지(supersede 포인터만).

## DoD (HANDOFF ⭐ W0 — 전 항목 충족 필수)

1. `rg "40만|400_000|40man" tudal/src tudal/package.json tudal/.env.example` 잔존 0 (의도 보존 allowlist 명시 시 예외).
2. provider 추상화 뒤 Claude 경로 무회귀 — test:ci 전체 PASS (1621+).
3. GPT 키 없을 때 auto Claude-only 검증 (registry fallback 테스트).
4. D28 3종: GPT/Opus4.8 단가 등록 + unknown model fail-closed + model-aware reservation.
5. D28 B-final 배분 기준 reservation ≤50만 projection 테스트 PASS.
6. 실 AI 호출 0 — **W0 완료/머지 판정은 smoke "구현"까지** (smoke "실행"은 별도 USER 비용 승인 게이트, CI에서 skip — DoD와 충돌 없음).

## 리스크 / 비고

- **Opus 4.7+ tokenizer +35%**: calibration 토큰 수는 텍스트→토큰 환산 가정 — projection에 안전여유 ~30% 존재(omxy R1 fix 반영 3트랙+worst-case+incumbent 산식 기준 총 ≈35만 vs 50만 — 정확값은 테스트 출력 박제). W1 실측 후 calibration 보정.
- **OpenAI Responses API 응답 변형**(reasoning 모델의 output_tokens에 reasoning 포함): cost는 output 전체 과금이라 정규화 무영향. output_text 빈 응답 가드.
- **critic GPT 전환은 W0에서 호출 경로 없음**(실 AI 0회) — 첫 실 critic 호출은 Task 7 Smoke Stage 2(별도 트랙)에서 검증되며, 그 전 W0 smoke가 provider 계층을 선검증.
- **B85 hardcode 모델 verify 문서**(audit-catalog §9.4)의 `claude-opus-4-7` 표기는 W0 머지 후 registry 파생으로 stale → 문서 동기화에 포함.
