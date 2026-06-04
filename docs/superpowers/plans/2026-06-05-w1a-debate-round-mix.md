# W1a — Q4 토론 loop ①: D28 모델 mix 배선 + R2 선택적 반박 라운드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Core 11 단발 채점을 **D28 B-final 혼합 패널(Claude Sonnet 4.6 ×6 + GPT mid ×5)** 로 배선하고, R1 전부 완료 후 **선택적 R2 반박 라운드**(트랙별 top10 경계 ±5 ∪ persona 점수 분산 상위 20%, ≤2라운드)를 큐 기반으로 실행해 — incumbent thesis context와 동일 seam으로 — 타 위원 R1 주장을 반박/수정한 점수로 최종 선정한다.

**Architecture:** W2a/W2b 청크 워커 seam 위 additive. `tier1_selection_job`에 `round`(1|2) 컬럼 추가(마이그 0032 — **0031 RPC 본체 무변경**, TS enqueue onConflict만 round 포함으로 확장). R1 전부 terminal → 저장 panel로 **결정론 R2 대상 계산(순수 함수)** → round=2 jobs idempotent enqueue → R2 완료 후 finalize(replay panel = R2 우선/R1 fallback). 최종 점수 집계 = 기존 결정론 consensus(computeWeightedScores+assignBadge) **유지**(HANDOFF W1: 합의 점수는 선택 — judge 대체는 W1b).

**Tech Stack:** Next.js 16 · Supabase Postgres · Vitest · zod · W0 LlmProvider(anthropic/openai) + model-registry.

**SoT:** `Document/Process/HANDOFF.md` ⭐ 65차 W1(:51-55) + D26 Q4 + D28 B-final + `model-registry.ts` `D28_DEBATE_CONFIG`(slots 6/5 · r2BoundaryWindow 5 · r2VarianceTopFraction 0.2 · maxRounds 2) + `projectD28MonthlyReservationKrw`(350,167≤50만 — R1 mix+R2 worst 이미 포함).

**ROUND 6 fact-check anchors (direct-edit):**
- `tudal/supabase/migrations/0031_tier1_selection_worker.sql:50` is inline `unique (period_key, ticker)`, so the generated 0031 constraint name to drop is `tier1_selection_job_period_key_ticker_key`; 0032 must add its own named `round` check/unique constraints and must not edit 0031 RPC bodies.
- `0031_tier1_selection_worker.sql:125-126` returns `setof public.tier1_selection_job` and `:174` uses `returning *`; after 0032 `ALTER TABLE`, `claim_next_selection_jobs` returns `round` automatically. TS must cast/read `round` directly — no fallback row lookup.
- Current worker `tudal/src/lib/screening/tier1-selection-batch-worker.ts:655-669` finalizes with `select("ticker, status, panel_result")` and a ticker-only map; W1a must select `round` and use `pickFinalPanels` so R2 done wins without collapsing R1/R2 rows.
- Current `persona-eval.ts:80,115,237-243` uses exact/prefix error checks, and `retry-with-backoff.ts:8-26` retries `TRANSIENT_CODES` by `message.includes`; W1a must add `ai_call_failed:transient` while preserving `ai_key_unavailable`/`cost_hardcap_exceeded` systemic includes.

---

## 범위 (W1a) vs 분리 (W1b)

**W1a (이 계획):**
1. **D28 ① mix 배선** — tier1_panel 단일 모델(opus-4-7) → per-slot 혼합: CORE_11 순서 interleave(짝수 idx=Sonnet 4.6 ×6 / 홀수 idx=GPT mid ×5, **가설 기본값 — 레지스트리 1곳 조정**). GPT 미가용 시 auto-detect 전 슬롯 Sonnet(Claude-only fallback, D28 C).
2. **D28 ② R2 선택적 반박 라운드** — R1 완료 후 결정론 trigger(config 소비) → 대상 ticker만 11명 재토론(타 위원 R1 rationale/score 컨텍스트 주입 → 반박/수정 점수) → 최종 panel = R2 우선. incumbent ticker는 reflectionContext(W2b thesis context)도 R2에 동반 주입.
3. **마이그 0032** — `tier1_selection_job.round` + unique(period_key, ticker, round). RPC 7종 **무변경**.
4. **provider transient retry classifier** (66차 W1 follow-up ⑤) — provider raw 에러를 transient/permanent로 분류해 `ai_call_failed:transient:*` 코드로 보존 → worker `retryWithBackoff`의 transient 재시도 실질 활성화(GPT 추가로 중요도 상승).
5. 비용 가드 정합 — reservation을 mix worst-slot 단가로(역할 단일 단가 supersede), R2 jobs 자동 포함(job-count 기반 유지).

**W1b (다음 별도 계획 — 명시 DEFER):**
- D28 ③ **debate_judge**(Opus 4.8 per-ticker 최종 판정) + **경계 ±2 GPT 최고급 dual-judge**(불일치 시 Opus 최종) — 최종 점수 의미론 변경이라 분리.
- 단발 orchestrator/`upsertShortList30` 정리(67차 ②) + `trackOfPeriod` 처분 + calibration 실측 보정(track-record 후).

**근거:** W2a/W2b 분할 전례. W1a 단독으로 working/testable(혼합 패널 + 반박 loop = Q4 코어 "멀티라운드 반박 loop 필수" 충족, 결정론 집계는 기존 유지라 의미론 무변경). judge는 "최종 점수를 누가 정하는가"를 바꾸는 별도 단위 — 한 PR에 섞으면 리뷰 불가 크기.

**W1a 범위 밖:** 실 AI 가동/cron go-live/Vercel env/마이그 production apply = USER 게이트(0032는 dormant 작성, 머지 후 USER apply). W3 portfolio. Reflection/PR-K.

## 핵심 설계 결정

- **D1 slot 배분 = 레지스트리 순수 함수.** `resolveTier1PanelSlot(slotIndex)` — CORE_11 배열 index 기준 **interleave**: 짝수(0,2,4,6,8,10)=Sonnet 4.6 ×6 / 홀수(1,3,5,7,9)=GPT mid(gpt-5.4) ×5 (`D28_DEBATE_CONFIG.claudeSonnetModel/gptMidModel` 소비). 시간대 가중 페르소나(단기 Druckenmiller·Burry / 중기 Lynch / 장기 Buffett·Munger·Fisher·Pabrai)가 양 프로바이더에 분산되는 가설 기본값. GPT 미가용 → 해당 슬롯 Sonnet binding 반환(전원 Claude). 반환 = `ResolvedRole` 동형(provider/model/pricingKey/maxTokens).
- **D2 callPersona per-call binding override.** `CallPersonaInput.modelBinding?: ResolvedRole` 추가 — 지정 시 `resolveRole('tier1_panel')` 대신 사용. cost_log.model = per-slot 실모델 기록(W0 감사: downstream은 stored cost_krw만 소비 → gpt-* row 안전 기확인). 미지정 경로(리포트 writer 등 비패널 caller)는 무회귀. **ANTHROPIC_API_KEY 부재 시 기존 `ai_key_unavailable` throw 불변**(D28 A — GPT-only 미지원).
- **D3 R2 대상 = 결정론 순수 함수 `computeR2Targets`.** 입력 = R1 done rows의 `(ticker, panel)` + 트랙. ① 트랙 활성 tf마다 `computeWeightedScores(panel)[tf]` desc 순위(동점 ticker asc) → **rank ∈ [10−w+1, 10+w]** (w=`r2BoundaryWindow`=5 → 6..15위) ② persona 11명 점수 분산(해당 ticker의 active tf 중 최대 가중점수 tf 기준 모표준편차) 상위 `r2VarianceTopFraction`(20%, ceil) ③ 합집합 + ticker asc 정렬. **degraded(panel null/failed) ticker 제외**(R1 없음 → 반박 불가, ⚪ 유지). pool < 10+w여도 안전(rank 범위 교집합). `TRACK_TIMEFRAMES`는 이미 `tier1-schema.ts:28-32` 존재(short→short, midlong→mid+long)하므로 재정의 금지. `computeWeightedScores`는 persona-eval 모듈 private → **export로 승격**(이동 없음, 재구현 금지).
- **D4 R2 = round=2 jobs, 큐 메커니즘 재사용.** R1 nonTerminal==0 && terminal>0 시점(현 finalize 게이트 지점)에서: targets = computeR2Targets(round=1 done rows only, track) → **targets 비어있으면 즉시 finalize**(현행 동일) / 있으면 missing round=2 rows만 idempotent enqueue(onConflict `period_key,ticker,round`) 후 **이번 invocation은 finalize 안 함**(다음 invocation/self-continue가 R2 claim). claim/mark/mutex/preflight RPC 무변경 — claim은 period_key 단위라 round 무관 pending을 집는데, R2 rows는 R1 전부 terminal 후에만 존재 → 라운드 순서 자연 보장. **finalize 게이트 확장**: 전 라운드 nonTerminal==0 && terminal>0 **&& (R2 불필요 ∨ R2 targets 전부 round=2 row 존재 && round2 nonTerminal==0)** — targets는 R1 저장 panel의 순수 함수라 매 invocation 재계산 가능(저장 플래그 불필요, 결정론 멱등). R2 job 실패(attempts 소진 failed)는 terminal → 해당 ticker R1 점수 유지(graceful).
- **D5 R2 프롬프트 = 신규 템플릿 + 신규 placeholder.** `DEBATE_R2_USER_PROMPT_TEMPLATE` — `{{TICKER}}/{{FINANCIALS}}/{{REFLECTION_CONTEXT}}/{{PEER_ARGUMENTS}}/{{OWN_PRIOR}}`. PEER_ARGUMENTS = 타 위원 10명의 R1 `{label, scores, winning_timeframe, rationale_kr, conviction}` 한국어 요약(위원당 1-2줄, slot 모델명 비노출). OWN_PRIOR = 본인 R1 평가. 지시 = "동료 평가를 읽고 반박하거나 본인 점수를 수정하라 — 동조 압력이 아닌 근거 기반 수정만". 출력 = **PersonaScore 동일 JSON 스키마**(parsePersonaScore 재사용). `renderUserPrompt`에 optional `peerArguments`/`ownPrior` 추가(renderInputSchema optional — 기존 callers 무회귀).
- **D6 최종 집계 = R2 우선 replay.** finalizeSelection의 storedPanels: ticker별 round=2 done panel 있으면 그것, 없으면 round=1. 이후 기존 runTier1Screening replay(LLM 0콜) — 결정론 consensus/배지/top10 무변경. delta/incumbent meta/removed 로그(W2b) 무회귀.
- **D7 마이그 0032 (0031 applied → ALTER 신규).** `round smallint not null default 1` 컬럼 + **named check** `tier1_selection_job_round_chk` + 0031 실제 unique `tier1_selection_job_period_key_ticker_key` drop → `tier1_selection_job_period_ticker_round_key unique (period_key, ticker, round)` + 기존 (period_key, status) 인덱스 유지. **RPC 7종 본체 무변경** — claim/mark/acquire/release/finalized/replace/carry 전부 round 무인지(설계상 불필요). rollback은 round=2 삭제 후 unique/check/column drop + old unique 원복. dormant 작성 → USER apply 게이트.
- **D8 비용 가드.** worker reservation = (open+deferred jobs[round 무관]) × 11 × **`getTier1PanelWorstSlotCostKrw()`**(신설 — Sonnet/GPT mid/GPT-off 시나리오 포함 슬롯 단가 max; 현 opus-4-7 단가 supersede ↓ — undercount 아님을 테스트로 증명: max(slot) ≥ 실제 mix 평균). R2 jobs는 job-count에 자동 포함(W2b 동일 원리). projection(350,167)은 이미 R1 mix+R2 worst 포함 — 산식 변화 없음, 테스트 박제 유지 확인만.
- **D9 retry classifier.** anthropic-provider/openai-provider가 SDK 에러를 그대로 throw(현행) → callPersona catch에서 일괄 `ai_call_failed` collapse가 retryWithBackoff transient 감지(429/529/network hint)를 무력화. fix: callPersona catch에서 **에러 message/status 검사 → transient면 `ai_call_failed:transient:<hint>` / 아니면 `ai_call_failed`**. retry-with-backoff TRANSIENT_CODES에 `ai_call_failed:transient` 추가. systemic abort 분기(`ai_key_unavailable`/`cost_hardcap_exceeded`)는 무변경(worker는 `includes` 매칭이라 suffix 무영향 확인). 양 SDK(Anthropic 2회 auto-retry/OpenAI) 자체 retry와 중복 허용(보수).

## File Structure

**신규:**
- `tudal/supabase/migrations/0032_tier1_selection_round.sql` + `.rollback.sql` — D7.
- `tudal/src/lib/screening/debate-round.ts` — `computeR2Targets`(D3) + `pickFinalPanels`(D6 R2-우선 병합) 순수 함수.
- `tudal/src/lib/screening/__tests__/debate-round.test.ts`
- `tudal/src/lib/ai/prompts/debate-round-template.ts` — D5 템플릿 + `renderPeerArguments`/`renderOwnPrior` 순수 렌더.
- `tudal/src/lib/ai/prompts/__tests__/debate-round-template.test.ts`

**수정:**
- `tudal/src/lib/ai/model-registry.ts` — `resolveTier1PanelSlot(slotIndex)` + `getTier1PanelWorstSlotCostKrw()` (D1/D8).
- `tudal/src/lib/ai/anthropic-client.ts` — `CallPersonaInput.modelBinding?` override + retry classifier (D2/D9).
- `tudal/src/lib/report/retry-with-backoff.ts` — TRANSIENT_CODES + `ai_call_failed:transient`.
- `tudal/src/lib/ai/prompts/render-user-prompt.ts` — optional `peerArguments`/`ownPrior` placeholder (D5).
- `tudal/src/lib/screening/persona-panel-adapter.ts` — slot binding 주입(R1) + `makeCallDebatePanel` factory(R2 — per-persona peer/own 컨텍스트) (D1/D5).
- `tudal/src/lib/screening/persona-eval.ts` — `computeWeightedScores` export 승격(이동 없음).
- `tudal/src/lib/screening/tier1-selection-batch-worker.ts` — round-aware enqueue/카운트(전 라운드) + R1 완료 시 R2 enqueue 게이트 + R2 chunk 처리(debate panel) + finalize R2-우선 replay (D4/D6).
- `tudal/src/app/api/cron/monthly-batch/selection-worker/route.ts` — debate panel DI 배선.
- `tudal/src/lib/admin/format-error.ts` — 신규 코드 매핑(`r2_enqueue_failed` 등 + transient suffix prefix handler).
- 동반 테스트: model-registry/anthropic-client/adapter/worker/route/retry-with-backoff 각 기존 파일 확장.

**무변경(DoD diff/grep 검증):** 0031 RPC 7종 본체 · `admin-shortlist.ts`(reader) · `tier1-schema.ts` factory · `consensus.ts` · W2b incumbent 모듈(`incumbent-merge`/`admin-shortlist-incumbents`) · `upsertShortListTrack` 계약.

---

## Task 0: 착수 가드

- [ ] **Step 1**: `git rev-parse --abbrev-ref HEAD` → `feat/w1a-debate-mix`. main 게이트 1745+2skip 기준 분기 확인.
- [ ] **Step 2**: `mcp__supabase__list_migrations`로 0031 applied·0032 부재 확인(read-only). 0032가 이미 존재하면 STOP + 0033 전환 보고.

---

## Task 1: 레지스트리 slot 배분 + worst-slot 단가 (TDD)

**Files:** Modify `tudal/src/lib/ai/model-registry.ts` / Test `tudal/src/lib/ai/__tests__/model-registry.test.ts` (기존 확장)

- [ ] **Step 1: 실패 테스트**
```typescript
describe('resolveTier1PanelSlot (D28 ① mix)', () => {
  it('interleave: 짝수 idx=Sonnet 4.6 ×6 / 홀수 idx=gpt-5.4 ×5 (OPENAI 가용 시)', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const slots = Array.from({ length: 11 }, (_, i) => resolveTier1PanelSlot(i));
    expect(slots.filter((s) => s.model === 'claude-sonnet-4-6')).toHaveLength(6);
    expect(slots.filter((s) => s.model === 'gpt-5.4')).toHaveLength(5);
    expect(slots[0].model).toBe('claude-sonnet-4-6');
    expect(slots[1].model).toBe('gpt-5.4');
    expect(slots[1].provider.id).toBe('openai');
  });
  it('GPT 미가용 → 전 슬롯 Sonnet (Claude-only fallback, D28 C)', () => {
    delete process.env.OPENAI_API_KEY;
    const slots = Array.from({ length: 11 }, (_, i) => resolveTier1PanelSlot(i));
    expect(slots.every((s) => s.model === 'claude-sonnet-4-6')).toBe(true);
  });
  it('slotIndex 범위 밖(11) → throw', () => {
    expect(() => resolveTier1PanelSlot(11)).toThrow('tier1_panel_slot_out_of_range');
  });
});
describe('getTier1PanelWorstSlotCostKrw (D8)', () => {
  it('= max(Sonnet, GPT mid) calibration 단가 — env 무관 (reservation undercount 금지)', () => {
    const worst = getTier1PanelWorstSlotCostKrw();
    const cal = { input_tokens: 1500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 2000 };
    expect(worst).toBe(Math.max(
      calculateCostKrw(cal, 'claude-sonnet-4-6'),
      calculateCostKrw(cal, 'gpt-5.4'),
    ));
    expect(worst).toBeGreaterThan(0);
  });
});
```
- [ ] **Step 2: 실패 확인** — vitest run, FAIL(미정의).
- [ ] **Step 3: 구현** — model-registry.ts에 추가:
```typescript
// W1a (D28 ①) — Core 11 혼합 슬롯. CORE_11 배열 index 기준 interleave(가설 기본값 — 여기 1곳 조정):
//   짝수 idx = Claude Sonnet 4.6 (6 슬롯) / 홀수 idx = GPT mid (5 슬롯). GPT 미가용 → 전원 Sonnet.
//   calibration/maxTokens는 tier1_panel 역할 공유.
export function resolveTier1PanelSlot(slotIndex: number): ResolvedRole {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 10) {
    throw new Error(`tier1_panel_slot_out_of_range:${slotIndex}`);
  }
  const entry = MODEL_REGISTRY.tier1_panel;
  const useGpt = slotIndex % 2 === 1 && isOpenAiAvailable();
  const binding: ModelBinding = useGpt
    ? O(D28_DEBATE_CONFIG.gptMidModel)
    : A(D28_DEBATE_CONFIG.claudeSonnetModel);
  const provider = binding.provider === 'openai' ? openaiProvider : anthropicProvider;
  return { role: 'tier1_panel', provider, model: binding.model, pricingKey: binding.pricingKey, maxTokens: entry.maxTokens };
}

// W1a (D8) — reservation 보수 단가: mix 슬롯(Sonnet/GPT mid) 중 최고가, env 무관.
export function getTier1PanelWorstSlotCostKrw(): number {
  const cal = MODEL_REGISTRY.tier1_panel.calibration;
  const usage: TokenUsage = {
    input_tokens: cal.inputTokens, cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0, output_tokens: cal.outputTokens,
  };
  return Math.max(
    calculateCostKrw(usage, D28_DEBATE_CONFIG.claudeSonnetModel),
    calculateCostKrw(usage, D28_DEBATE_CONFIG.gptMidModel),
  );
}
```
(D28_DEBATE_CONFIG 선언이 함수보다 아래면 선언 순서 조정 — config를 위로. `tier1_panel.preferred`는 opus-4-7 유지: 비패널 fallback 경로 + W1b judge 전 무회귀. slot이 panel 경로의 SoT.)
- [ ] **Step 4: 통과 확인** + 기존 registry 테스트 무회귀.
- [ ] **Step 5: commit** `feat(w1a): resolveTier1PanelSlot interleave 6/5 + worst-slot reservation 단가 (D28 ①, TDD)`

---

## Task 2: callPersona modelBinding override + retry classifier (TDD)

**Files:** Modify `tudal/src/lib/ai/anthropic-client.ts` + `tudal/src/lib/report/retry-with-backoff.ts` / Test 각 기존 테스트 확장

- [ ] **Step 1: 실패 테스트**
```typescript
// anthropic-client.test.ts
it('modelBinding 지정 시 해당 provider/model로 호출 + cost_log.model=per-slot 모델', async () => {
  // mock provider.call 주입 가능하게 — resolveTier1PanelSlot(1) 반환형 binding 전달
  // 검증: provider.call({model:'gpt-5.4'}) + insertCostLog({model:'gpt-5.4', cost_krw: gpt 단가})
});
it('modelBinding 미지정 → 기존 resolveRole(tier1_panel) 경로 무회귀', async () => {});
it('provider 429/529/“rate limit”/ECONNRESET 류 → ai_call_failed:transient:* throw', async () => {});
it('provider 4xx invalid_request 류 → ai_call_failed (non-transient)', async () => {});
// retry-with-backoff.test.ts
it('ai_call_failed:transient:429는 TRANSIENT — 재시도 발생', async () => {});
it('ai_call_failed(무suffix)는 non-transient — 즉시 throw', async () => {});
```
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현**
- `CallPersonaInput`에 `modelBinding?: ResolvedRole` 추가. `const resolved = input.modelBinding ?? resolveRole('tier1_panel');`
- catch 분류(D9):
```typescript
  } catch (err) {
    // W1a (D9) — transient 분류 보존: worker retryWithBackoff가 재시도 판단 가능하게.
    const msg = err instanceof Error ? err.message : String(err);
    const status = (err as { status?: number; statusCode?: number }).status ?? (err as { statusCode?: number }).statusCode;
    const transient =
      status === 429 || (status !== undefined && status >= 500) ||
      /rate.?limit|overloaded|timeout|timed out|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(msg);
    throw new Error(transient ? `ai_call_failed:transient:${status ?? 'network'}` : 'ai_call_failed');
  }
```
- retry-with-backoff.ts `TRANSIENT_CODES`(`retry-with-backoff.ts:8-12`)에 `'ai_call_failed:transient'` 추가(`message.includes` 기반이라 prefix 전체 재시도).
- **worker systemic abort 무회귀 확인**: `msg.includes('ai_key_unavailable')`/`includes('cost_hardcap_exceeded')` 분기는 suffix 무영향 — `ai_call_failed:transient`는 per-ticker fail 경로(기존 `ai_call_failed`와 동일 분류, persona-eval/runMonthlyPersonaEval의 `=== 'ai_call_failed'` 동등비교 지점은 `startsWith('ai_call_failed')`로 갱신).
- [ ] **Step 4: 통과 확인** — 양 파일 + persona-eval 기존 테스트(에러 분류 동등비교 갱신분) 전부 PASS.
- [ ] **Step 5: commit** `feat(w1a): callPersona modelBinding override + transient retry classifier (D2/D9, TDD)`

---

## Task 3: adapter — R1 slot binding + makeCallDebatePanel(R2) (TDD)

**Files:** Modify `tudal/src/lib/screening/persona-panel-adapter.ts` + `tudal/src/lib/ai/prompts/render-user-prompt.ts` + Create `tudal/src/lib/ai/prompts/debate-round-template.ts` / Test 각 확장+신규

- [ ] **Step 1: 실패 테스트**
```typescript
// persona-panel-adapter.test.ts
it('R1: persona idx별 resolveTier1PanelSlot binding이 callPersona에 전달 (idx0=Sonnet, idx1=GPT)', async () => {});
it('R1: slotResolver 미주입(legacy deps) → modelBinding undefined 무회귀', async () => {});
// makeCallDebatePanel
it('R2: 각 persona에 OWN_PRIOR=본인 R1 + PEER_ARGUMENTS=타 위원 10명 R1 요약이 주입', async () => {});
it('R2: incumbent reflectionContext 동반 주입 + PersonaScore 스키마 출력 파싱', async () => {});
// debate-round-template.test.ts
it('renderPeerArguments: 10명 라벨/점수/근거 1줄씩 + 모델명 비노출', () => {});
it('템플릿 placeholder 5종 존재 + renderUserPrompt 치환 (peer/own 미지정 기존 caller 무회귀)', () => {});
```
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현**
- `render-user-prompt.ts`: renderInputSchema에 `peerArguments: z.string().optional()` + `ownPrior: z.string().optional()` → `.replaceAll('{{PEER_ARGUMENTS}}', validated.peerArguments ?? '')` 등(기존 caller 무회귀 — placeholder 없는 템플릿은 no-op).
- `debate-round-template.ts`:
```typescript
export const DEBATE_R2_USER_PROMPT_TEMPLATE = `다음 종목에 대한 1차 평가 후 위원회 반박 라운드입니다.

티커: {{TICKER}}

재무 데이터:
{{FINANCIALS}}

지난달 성과 컨텍스트:
{{REFLECTION_CONTEXT}}

당신의 1차 평가:
{{OWN_PRIOR}}

동료 위원 1차 평가:
{{PEER_ARGUMENTS}}

지시: 동료 평가의 논거를 검토해 동의하지 않는 부분은 반박하고, 설득력 있는 반론이 있으면 본인 점수를 수정하세요. 동조 압력이 아닌 근거 기반 수정만 하세요. 출력은 동일 JSON 스키마(scores/winning_timeframe/rationale_kr/conviction)로만.`;
export function renderOwnPrior(own: PersonaScore): string { /* 점수/근거 2줄 */ }
export function renderPeerArguments(peers: ReadonlyArray<{ label: string; score: PersonaScore }>): string {
  /* 위원당 "- {label}: 단{s}/중{m}/장{l}, 확신{c} — {rationale}" — 모델명/slot 비노출 */
}
```
- adapter: `CallPersonaPanelDeps.slotResolver?: (slotIndex: number) => ResolvedRole` — R1 closure에서 `modelBinding: deps.slotResolver?.(i)` 전달(personas.map의 index). 신규 `makeCallDebatePanel(deps)` factory: input `{ticker, financials, reflectionContext?, r1Panel: PersonaScore[]}` → personas.map((p, i) → callPersona({..., modelBinding: deps.slotResolver?.(i), userPromptTemplate: DEBATE_R2_USER_PROMPT_TEMPLATE, peerArguments: renderPeerArguments(타위원), ownPrior: renderOwnPrior(본인)})) → parsePersonaScore. callPersona에 `peerArguments/ownPrior` pass-through 추가(Task 2 input 확장에 포함).
- [ ] **Step 4: 통과 확인.**
- [ ] **Step 5: commit** `feat(w1a): R1 slot binding 주입 + makeCallDebatePanel R2 반박 어댑터 + 템플릿 (D1/D5, TDD)`

---

## Task 4: computeR2Targets + pickFinalPanels 순수 함수 (TDD)

**Files:** Create `tudal/src/lib/screening/debate-round.ts` / Modify `tudal/src/lib/screening/persona-eval.ts`(computeWeightedScores export) / Test 신규

- [ ] **Step 1: 실패 테스트**
```typescript
it('경계 ±5: 트랙 활성 tf rank 6..15만 (short fresh50+incumbent≤10 pool에서도 10명)', () => {});
it('분산 상위 20%: argmax-tf 11점수 모표준편차 ceil(pool*0.2)명', () => {});
it('합집합 dedupe + ticker asc 정렬 + degraded(panel null) 제외', () => {});
it('midlong: TRACK_TIMEFRAMES[midlong]=mid,long 각 tf 경계 합집합 (최대 20명)', () => {});
it('pool 12 (<10+5): rank 범위 교집합으로 안전', () => {});
it('pickFinalPanels: round2 done 우선 / 없으면 round1 / 양쪽 없으면 미포함', () => {});
```
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — persona-eval `computeWeightedScores` 앞에 `export` 추가(시그니처 무변경). debate-round.ts:
```typescript
import { D28_DEBATE_CONFIG } from '@/lib/ai/model-registry';
import { TRACK_TIMEFRAMES, type SelectionTrack, type PersonaScore } from '@/lib/screening/tier1-schema';
import { computeWeightedScores } from '@/lib/screening/persona-eval';

export interface R1PanelRow { ticker: string; panel: PersonaScore[] | null; }
export function computeR2Targets(rows: readonly R1PanelRow[], track: SelectionTrack): string[] {
  const scored = rows.filter((r): r is { ticker: string; panel: PersonaScore[] } => r.panel !== null)
    .map((r) => ({ ticker: r.ticker, weighted: computeWeightedScores(r.panel), panel: r.panel }));
  const targets = new Set<string>();
  const w = D28_DEBATE_CONFIG.r2BoundaryWindow;
  for (const tf of TRACK_TIMEFRAMES[track]) {
    const ranked = [...scored].sort((a, b) =>
      b.weighted[tf] !== a.weighted[tf] ? b.weighted[tf] - a.weighted[tf] : a.ticker.localeCompare(b.ticker));
    ranked.forEach((r, i) => { const rank = i + 1; if (rank >= 10 - w + 1 && rank <= 10 + w) targets.add(r.ticker); });
  }
  const byVariance = [...scored].map((r) => {
    const tf = TRACK_TIMEFRAMES[track].reduce((best, t) => (r.weighted[t] > r.weighted[best] ? t : best), TRACK_TIMEFRAMES[track][0]);
    const xs = r.panel.map((p) => p.scores[tf]); const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    return { ticker: r.ticker, v: Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length) };
  }).sort((a, b) => (b.v !== a.v ? b.v - a.v : a.ticker.localeCompare(b.ticker)));
  byVariance.slice(0, Math.ceil(scored.length * D28_DEBATE_CONFIG.r2VarianceTopFraction)).forEach((r) => targets.add(r.ticker));
  return [...targets].sort();
}
export function pickFinalPanels(r1: ReadonlyMap<string, PersonaScore[]>, r2: ReadonlyMap<string, PersonaScore[]>): Map<string, PersonaScore[]> { /* r2 우선 병합 */ }
```
(model-registry는 `import 'server-only'` — debate-round가 import하면 클라이언트 번들 가드 유지. worker/route만 소비라 OK. D28_DEBATE_CONFIG/TRACK_TIMEFRAMES import.)
- [ ] **Step 4: 통과 확인.**
- [ ] **Step 5: commit** `feat(w1a): computeR2Targets(경계±5 ∪ 분산20%) + pickFinalPanels — 결정론 R2 trigger (D3/D6, TDD)`

---

## Task 5: 마이그 0032 — round 컬럼 (dormant)

**Files:** Create `tudal/supabase/migrations/0032_tier1_selection_round.sql` + `.rollback.sql`

- [ ] **Step 1: SQL 작성**
```sql
-- 0032_tier1_selection_round.sql — W1a: tier1_selection_job 멀티라운드(R1 채점/R2 반박) 확장.
-- 0031 RPC 7종 본체 무변경 (claim/mark는 id/period_key 기준 — round 무인지 설계).
-- production apply = USER 게이트 (dormant 작성).
alter table public.tier1_selection_job
  add column if not exists round smallint not null default 1;
alter table public.tier1_selection_job
  alter column round set default 1;
update public.tier1_selection_job set round = 1 where round is null;
alter table public.tier1_selection_job
  alter column round set not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tier1_selection_job'::regclass
      and conname = 'tier1_selection_job_round_chk'
  ) then
    alter table public.tier1_selection_job
      add constraint tier1_selection_job_round_chk check (round in (1, 2));
  end if;
end $$;

alter table public.tier1_selection_job
  drop constraint if exists tier1_selection_job_period_key_ticker_key;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tier1_selection_job'::regclass
      and conname = 'tier1_selection_job_period_ticker_round_key'
  ) then
    alter table public.tier1_selection_job
      add constraint tier1_selection_job_period_ticker_round_key unique (period_key, ticker, round);
  end if;
end $$;
```
(rollback = 아래 순서 고정. **주의**: round=2 rows 존재 시 rollback의 unique(period_key,ticker) 원복이 충돌 → 선두에서 삭제 후 원복.)
```sql
delete from public.tier1_selection_job where round > 1;
alter table public.tier1_selection_job
  drop constraint if exists tier1_selection_job_period_ticker_round_key;
alter table public.tier1_selection_job
  drop constraint if exists tier1_selection_job_round_chk;
alter table public.tier1_selection_job
  drop column if exists round;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tier1_selection_job'::regclass
      and conname = 'tier1_selection_job_period_key_ticker_key'
  ) then
    alter table public.tier1_selection_job
      add constraint tier1_selection_job_period_key_ticker_key unique (period_key, ticker);
  end if;
end $$;
```
- [ ] **Step 2: grep 가드** — `grep -n "create or replace function" 0032*.sql` → 0 (RPC 무변경 증명).
- [ ] **Step 3: commit** `feat(w1a): 마이그 0032 — tier1_selection_job.round + unique(period,ticker,round) (RPC 무변경, dormant)`

---

## Task 6: worker round-aware — R2 enqueue 게이트 + R2 chunk + finalize R2-우선 (TDD)

**Files:** Modify `tudal/src/lib/screening/tier1-selection-batch-worker.ts` / Test 기존 확장

- [ ] **Step 1: 실패 테스트**
```typescript
it('R1 enqueue rows에 round:1 명시 + onConflict period_key,ticker,round', async () => {});
it('claim_next_selection_jobs returning * → claimed job에 round 포함(별도 조회 금지)', async () => {});
it('R1 전부 terminal + R2 targets>0 + round2 미존재 → round2 enqueue(대상만) + finalize 안 함', async () => {});
it('R1 전부 terminal + R2 targets=0 → 기존처럼 즉시 finalize (무회귀)', async () => {});
it('round2 일부 비terminal → finalize 차단', async () => {});
it('round2 전부 terminal → finalize: storedPanels가 R2 done 우선/R1 fallback으로 replay', async () => {});
it('R2 chunk 처리: claimed round=2 job은 makeCallDebatePanel 경유(r1Panel 주입) + incumbent ctx 동반', async () => {});
it('R2 job failed(attempts 소진) → 해당 ticker R1 점수로 finalize (graceful)', async () => {});
it('reservation: (open+deferred) × 11 × worst-slot 단가 (R2 jobs 자동 포함)', async () => {});
```
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현**
- DI 추가: `callDebatePanel: (input: {ticker, financials, reflectionContext?, r1Panel}) => Promise<PersonaScore[]>`.
- enqueue: rows에 `round: 1`, onConflict `'period_key,ticker,round'`.
- TS row types: `SelectionJobRow { id; ticker; round: 1 | 2 }`, `SelectionFullRow { ticker; status; panel_result; round: 1 | 2 }`.
- claim 후 chunk loop: job에 `round` 포함(0031 RPC는 `returns setof tier1_selection_job` + `returning *`라 ALTER 후 자동 반환 — **별도 조회/폴백 금지**). round===2면: 같은 (period_key, ticker) round=1 done row의 panel_result 로드 → 없으면 `debate_r1_panel_missing`으로 failed 처리 → 있으면 `callDebatePanel`; round===1이면 기존 `callPersonaPanel`.
- R1 완료 감지(현 finalize 게이트 지점): `roundTerminal(1)==전체 && targets=computeR2Targets(round1 rows, track)`:
  - targets ∖ (round2 존재 tickers) 비어있지 않으면 → round2 enqueue(해당 tickers, bucket carry) 후 `finalized:false` 반환.
  - targets 전부 round2 존재 && round2 nonTerminal==0 → finalize: `pickFinalPanels(r1Map, r2Map)` → 기존 replay.
  - targets 0 → 기존 finalize.
- finalize SELECT는 `select("ticker, status, panel_result, round")`로 변경. 현재 ticker-only map은 R1/R2 row를 덮어쓰므로 금지; `r1Map`/`r2Map` 분리 후 `pickFinalPanels` 사용.
- 카운트 헬퍼: 기존 period_key 단위(라운드 무관) 유지 — finalize/R2 enqueue 게이트는 라운드별 보조 카운트/row 조회 추가(`countByStatusRound`, `selectRoundRows`).
- reservation 단가: `getRoleMaxCostPerCallKrw('tier1_panel')` → `getTier1PanelWorstSlotCostKrw()` swap.
- [ ] **Step 4: 통과 확인** — 기존 38 + 신규, cold-start/W2b incumbent 테스트 무회귀(기본 DI `callDebatePanel: async()=>makePanel()` 추가만).
- [ ] **Step 5: commit** `feat(w1a): worker 멀티라운드 — R2 enqueue 게이트 + debate chunk + finalize R2-우선 replay (D4/D6, TDD)`

---

## Task 7: route DI 배선 + format-error (TDD)

**Files:** Modify route.ts + format-error.ts / Test 기존 확장

- [ ] **Step 1: 실패 테스트** — route: guarded 인자에 `callDebatePanel` 함수 존재 + slotResolver가 makeCallPersonaPanel deps에 주입. format-error: `tier1_panel_slot_out_of_range`/`r2_enqueue_failed`/`debate_r1_panel_missing` 매핑 + `ai_call_failed:transient:*` prefix handler(기존 ai_call_failed 메시지 재사용).
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — route: `makeCallPersonaPanel({..., slotResolver: resolveTier1PanelSlot})` + `callDebatePanel: makeCallDebatePanel({callPersona, personas: CORE_11_PERSONAS, slotResolver: resolveTier1PanelSlot, adminUserId, costClient})` 배선. format-error 매핑+prefix.
- [ ] **Step 4: 통과 확인.**
- [ ] **Step 5: commit** `feat(w1a): route 토론 DI 배선 + format-error 신규 코드 매핑 (TDD)`

---

## Task 8: 통합 게이트 + DoD

- [ ] **Step 1**: `npm run build && npm run lint && npm run test:ci && npx tsc --noEmit` ALL GREEN.
- [ ] **Step 2**: 무변경 확인 — `git diff --stat main -- tudal/supabase/migrations/0031* tudal/src/lib/data/admin-shortlist.ts tudal/src/lib/screening/consensus.ts tudal/src/lib/screening/incumbent-merge.ts tudal/src/lib/data/admin-shortlist-incumbents.ts` → 0.
- [ ] **Step 3**: grep 가드 — `grep -rn "resolveRole('tier1_panel')" src/lib/screening` → 0(패널 경로는 slot 경유) / `grep -n "getRoleMaxCostPerCallKrw(\"tier1_panel\")" src/lib/screening` → 0(worst-slot swap).
- [ ] **Step 4**: projection 테스트(`d28-reservation-projection.test.ts`) 무변경 PASS — 350,167 ≤ 50만 유지.
- [ ] **Step 5**: commit 잔여.

## Self-Review 체크 (작성자 수행)

1. **Spec coverage:** HANDOFF W1(:51-55) → D28 mix(Task 1,2,3,7) / 멀티라운드 반박 ≤2(Task 4,5,6 — maxRounds=2는 R1+R2 구조 자체로 박제) / R2 선택적 config 소비(Task 4) / incumbent context 토론 주입(Task 3,6 — reflectionContext seam 재사용) / consensus 결정론 유지(Task 6 replay 무변경) / judge·dual-judge=W1b 명시 분리 / follow-up ⑤ retry classifier(Task 2).
2. **Placeholder scan:** 전 Task 실코드/시그니처. R2 프롬프트 전문 포함.
3. **Type consistency:** `ResolvedRole`(Task 1 = Task 2 modelBinding = Task 3 slotResolver) / `PersonaScore` 재사용(R2 출력 = parsePersonaScore) / `R1PanelRow`(Task 4 = Task 6 소비) / round 1|2(Task 5 DDL = Task 6 TS).
4. **무회귀 invariant:** step-0 fail-closed / run-mutex / 순차 loop / preflight-first / deferred 게이트 / W2b incumbent union·delta·meta / 0031 RPC 무변경 / cold-start / flag-off+mock=cost0 — Task 6 기존 테스트 무변경 통과로 증명.

## 검증 게이트 (DoD)

- build+lint+test:ci+tsc ALL GREEN. 마이그 0032 dormant(작성만) + 0031 무변경.
- mix 배선: R1 11콜 = Sonnet×6+GPT×5(가용 시)/전원 Sonnet(미가용) 테스트.
- R2 loop: targets 결정론 + enqueue 멱등 + R2-우선 finalize + graceful R1 fallback 테스트.
- reservation ≤50만 projection 테스트 무변경 PASS + worst-slot 단가 undercount 금지 테스트.
- 실 AI 0 · cost 0 (flag-off + mock).

## Execution Handoff

§2.0a + 사용자 명시: plan = ① Claude 작성 → ② omxy 검토 → ③ omxy 수정(direct-edit) → ④ Claude 검증. impl 동일 4-step. 이후 배선 교차감사(Claude Workflow + omxy blind) + docs-sync omxy 검증까지 동일 프로세스.
