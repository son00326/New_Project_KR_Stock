# W1b — Q4 토론 loop ②: debate_judge(Opus per-ticker) + 경계 dual-judge + 단발 경로 정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** R1/R2 토론 결과를 **per-ticker 최종 judge(Opus 4.8, round=3 jobs)** 가 판정해 최종 점수의 SoT로 삼고, **트랙별 top10 경계 ±2(≈4종목)** 만 GPT 최고급(gpt-5.5) **dual-judge** 로 2차 의견을 받아(불일치 시 Opus 최종 + 구조화 로그) 선정 신뢰도를 높인다. 동시에 67차 follow-up ②③(단발 orchestrator/`upsertShortList30`/`trackOfPeriod` dead-code 정리)을 수행한다.

**Architecture:** W1a 멀티라운드 큐 위 additive — **round=3(judge) 단계 추가**(마이그 0033: round check (1,2)→(1,2,3), **0031/0032 RPC·구조 무변경**). R2 게이트와 동일 패턴: R1·R2 전부 terminal → judge jobs enqueue(평가 가능 ticker만) → judge chunk(ticker당 Opus 1콜, 입력=R2-우선 최종 panel 요약) → judge 전부 terminal → finalize에서 **dual-judge ≤4/트랙 동기 실행**(GPT 1콜씩, 사전 preflight) → `runTier1Screening`에 **`judgeScoresByTicker` seam** 주입(있으면 해당 ticker 최종 점수 = judge, 없으면 기존 결정론 consensus fallback — graceful). 배지/랭킹/top10/persist 파이프라인은 기존 결정론 코드 그대로(점수 소스만 교체).

**Tech Stack:** Next.js 16 · Supabase Postgres · Vitest · zod · W0 LlmProvider + model-registry(`debate_judge`/`dual_judge_gpt` role 기정의).

**SoT:** HANDOFF ⭐ 65차 D28 ③("최종 judge = Opus 4.8 + 트랙별 top10 경계 ±2(≈4종목, config)만 GPT 최고급 dual-judge → 불일치 시 Opus 최종") + `model-registry.ts` `MODEL_REGISTRY.debate_judge/dual_judge_gpt`(calibration 4000/2000) + `D28_DEBATE_CONFIG.dualJudgeBoundaryWindow=2` + `projectD28MonthlyReservationKrw`(judge per-ticker pool×단가 + dual-judge 2×window — **이미 350,167에 포함**).

---

## 범위 (W1b) vs 범위 밖

**W1b (이 계획):**
1. **judge 단계**: `callJudge`(debate_judge role) — per-ticker 1콜, 입력 = R2-우선 최종 panel 11명 요약(+incumbent thesis context), 출력 = `JudgeVerdict {scores(short/mid/long 0-100), winning_timeframe, rationale_kr≤120, conviction}`. round=3 jobs로 청크 처리.
2. **dual-judge**: judge 완료 후 finalize에서 **트랙 활성 tf별 judge-점수 랭킹 rank 9..12(top10 경계 ±2)** ticker만 `callDualJudge`(dual_judge_gpt role, GPT-off 시 Opus fallback=auto-detect). **불일치 판정(결정론)**: `winning_timeframe 상이 OR 해당 ticker argmax-tf 점수 차 > DUAL_JUDGE_DISAGREE_DELTA(15, config 신설)` → **최종은 항상 Opus verdict**, 불일치는 구조화 로그 `dual_judge_disagreement`(관측·track-record 입력).
3. **judgeScoresByTicker seam**: runTier1Screening — judge verdict 있는 ticker는 `weighted_scores = judge.scores`(primary_timeframe = argmax 동일 로직), 없는 ticker는 기존 consensus(fallback). 배지의 tier1Ranks는 최종 점수 기준(기존 generic 코드 그대로).
4. **마이그 0033**(dormant): round check (1,2)→(1,2,3). RPC 무변경.
5. **정리(67차 ②③)**: `monthly-batch-orchestrator.ts`(+test) 삭제(live caller 0 — 주석 참조 4건 정리) · `upsertShortList30` 삭제(live caller 0, 공유 헬퍼 `buildShortListRows`/`TICKER_RE`/단일 RPC writer 경로 보존) · `trackOfPeriod` 삭제(live caller 0).

**범위 밖 (명시 DEFER):** calibration 실측 보정(track-record 후) · W3 포트 · judge 결과의 리포트 반영(W1c/리포트 측 후속 아님 — 선정 점수만) · 실 AI/cron go-live/마이그 apply = USER 게이트(0033 dormant).

## 핵심 설계 결정

- **D1 judge = round=3 jobs (큐 재사용).** 대상 = **최종 panel 보유 ticker만**(R2-우선/R1 fallback — 양쪽 모두 없는 degraded는 ⚪ 유지, judge 불가). enqueue 게이트 = R1·R2 전부 terminal && R2 targets 충족(기존 W1a finalize 진입 조건) && judge 미enqueue. claim/mark/mutex RPC 무변경(round 무인지). judge job 실패(attempts 소진) = terminal → 해당 ticker **consensus fallback**(graceful — fail-open 아님: 점수 소스 fallback일 뿐 선정은 진행).
- **D2 judge 입력/출력.** 입력 프롬프트 = ticker + 트랙 + 최종 panel 11명 요약(`renderPeerArguments` 재사용 — 11명 전원, label만) + incumbent thesis context(있으면) + "단기/중기/장기 매력도를 위원회 토론을 종합해 최종 판정하라. 다수결이 아니라 논거 품질로 판정하라". 출력 = JudgeVerdict JSON(zod `JudgeVerdictSchema` — PersonaScore에서 persona_id 제외 동형 + rationale 120자). `parseJudgeVerdict` = `extractJsonObject` 재사용(**export 승격**, persona-panel-adapter.ts:64 — 이동 없음). cost_log: `persona_id='debate-judge'`(text NOT NULL 충족) / dual-judge는 `'dual-judge'` / `prompt_version='judge@v1'` / model = resolved 실모델.
- **D3 dual-judge = finalize 내 동기 실행 (round 아님).** ≤ 2×dualJudgeBoundaryWindow(=4)/트랙 — 소량·종결 단계라 큐 불필요. **실행 전 전용 preflight**: `preflightHardcap({lines:[{callCount: 대상수, maxCostPerCallKrw: getRoleWorstCaseMaxCostPerCallKrw('dual_judge_gpt')}]})` — hardcap 초과 시 dual-judge **skip + 로그**(Opus 단독 최종 — 선정 차단 안 함: dual은 관측층). 경계 산정 = judge 점수 기준 트랙 활성 tf 랭킹 rank ∈ [10−2+1+2... 정확히 **rank 9..12**] (top10.5 ± 2 → 9,10,11,12 — config `dualJudgeBoundaryWindow` 소비, 동점 ticker asc).
- **D4 최종 점수 = judge SoT + consensus fallback.** `RunTier1ScreeningInput.judgeScoresByTicker?: Record<string, Record<Timeframe, number>>` — 해당 ticker의 `weighted_scores`를 judge 점수로 대체(available 유지), 부재 ticker는 기존 computeWeightedScores. **불일치 시 Opus 최종** = dual-judge 결과는 점수에 미반영(구조화 로그만 — D28 문구 충실). selectionMeta/배지/backfill/refine 전부 기존 코드(스키마 factory 무변경 — count 계약 동일).
- **D5 마이그 0033.** `alter ... drop constraint tier1_selection_job_round_chk` → `add ... check (round in (1,2,3))` (conrelid 가드 + rollback = round>2 삭제 후 (1,2) 원복). 0031/0032 본체 무변경. **0032 미적용 환경**: W1a의 `selection_round_schema_missing` fail-closed가 동일 적용(0033은 0032 위 누적 — apply 순서 0032→0033 문서화).
- **D6 비용.** judge reservation = judge open jobs × `getRoleWorstCaseMaxCostPerCallKrw('debate_judge')` — **worker preflight를 round-aware 2-line으로**: `lines = [{tier1 jobs(r1+r2)×11×worst-slot}, {judge jobs×judge단가}]` (preflightHardcap lines[] 기지원). projection 무변경(이미 포함) 박제 유지. dual-judge는 D3 전용 preflight.
- **D7 정리 안전성.** 삭제 3종 전부 live caller 0 실측(2026-06-05 grep — orchestrator: 주석 4건만 / upsertShortList30: 자기 모듈 내 정의만 / trackOfPeriod: 테스트만). 삭제와 함께: 잔존 주석 포인터 4건 정정(admin-tier0-candidates 2·worker 1·adapter 1 — "단발 orchestrator" 서술을 "구 단발 경로(삭제됨, W1b)"로), `tier1_panel_incomplete`/`orchestrator_failed` format-error 매핑·테스트는 **보존**(역사 코드 호환 — 매핑 삭제는 과잉), 관련 테스트 파일 삭제. cron monthly-batch **stub route는 보존**(외부 호출 안전망, PR #90 계약 테스트 유지).

## File Structure

**신규:**
- `tudal/src/lib/ai/judge-client.ts` — `callJudge`/`callDualJudge`(resolveRole + provider.call + insertCostLog) + `JudgeVerdictSchema`/`parseJudgeVerdict` + `JUDGE_USER_PROMPT`/`renderJudgeInput`.
- `tudal/src/lib/ai/__tests__/judge-client.test.ts`
- `tudal/src/lib/screening/judge-stage.ts` — `computeDualJudgeBoundary`(judge 점수 rank 9..12, 결정론) + `isDualJudgeDisagreement`(결정론 비교) + `DUAL_JUDGE_DISAGREE_DELTA` config.
- `tudal/src/lib/screening/__tests__/judge-stage.test.ts`
- `tudal/supabase/migrations/0033_tier1_selection_judge_round.sql` + `.rollback.sql`

**수정:**
- `tudal/src/lib/screening/persona-panel-adapter.ts` — `extractJsonObject` export 승격(이동 없음).
- `tudal/src/lib/screening/persona-eval.ts` — `RunTier1ScreeningInput.judgeScoresByTicker?` seam (D4).
- `tudal/src/lib/screening/tier1-selection-batch-worker.ts` — judge 단계(round=3 enqueue 게이트 + judge chunk + finalize dual-judge & judgeScores 주입) + 2-line preflight.
- `tudal/src/app/api/cron/monthly-batch/selection-worker/route.ts` — `callJudgePanel`/`callDualJudge` DI 배선.
- `tudal/src/lib/admin/format-error.ts` — `judge_verdict_parse_failed`/`dual_judge_skipped_hardcap`/`judge_panel_missing` 매핑.
- 동반 테스트 확장: worker/route/persona-eval(tier1-screening)/format-error.

**삭제(D7):** `monthly-batch-orchestrator.ts` + `__tests__/monthly-batch-orchestrator.test.ts` / `upsertShortList30`(admin-shortlist-persist.ts 내 함수 + 관련 테스트 블록) / `trackOfPeriod`(selection-period.ts 함수 + 테스트 블록).

**무변경(DoD 검증):** 0031·0032 마이그 본체 · `admin-shortlist.ts`(reader) · `tier1-schema.ts` factory · `consensus.ts` · W2b incumbent 모듈 · `upsertShortListTrack` 계약 · cron monthly-batch stub route.

---

## Task 0: 착수 가드
- [ ] Step 1: branch `feat/w1b-judge` + main 게이트 1789+2skip 기준 분기 확인.
- [ ] Step 2: `mcp__supabase__list_migrations` — 0032/0033 미적용 확인(read-only). 둘 다 dormant 전제(0033은 0032 누적).

## Task 1: judge-client — callJudge/callDualJudge + Verdict 파서 (TDD)

**Files:** Create `judge-client.ts` + test / Modify `persona-panel-adapter.ts`(extractJsonObject export)

- [ ] **Step 1: 실패 테스트**
```typescript
it('JudgeVerdictSchema: scores 0-100/winning_timeframe enum/rationale≤120/conviction — 위반 throw', () => {});
it('parseJudgeVerdict: 펜스/노이즈 JSON 추출 (extractJsonObject 재사용)', () => {});
it('callJudge: resolveRole(debate_judge)=opus-4-8 provider 호출 + cost_log(persona_id=debate-judge, model=실모델)', async () => {});
it('callDualJudge: GPT 가용=gpt-5.5 / 미가용=opus fallback (auto-detect) + persona_id=dual-judge', async () => {});
it('ANTHROPIC_API_KEY 부재 → ai_key_unavailable (D28 A 불변)', async () => {});
it('transient(429/5xx) → ai_call_failed:transient:* (W1a classifier 동일 패턴)', async () => {});
```
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — `judge-client.ts`:
```typescript
import 'server-only' 불필요(client가 server-only 모듈 import — model-registry가 이미 server-only); 구조는 anthropic-client.ts 패턴 복제:
export const JudgeVerdictSchema = z.object({
  scores: z.object({ short: score0to100, mid: score0to100, long: score0to100 }),
  winning_timeframe: z.enum(['short', 'mid', 'long']),
  rationale_kr: z.string().max(120).catch ... // graceful truncate는 parseJudgeVerdict에서 slice(0,120)
  conviction: z.number().min(0).max(100),
});
export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;
export function parseJudgeVerdict(content: string): JudgeVerdict { extractJsonObject → slice rationale → safeParse → throw `judge_verdict_parse_failed:<path>` }
export const JUDGE_USER_PROMPT = `다음 종목에 대한 투자위원회 토론(1차 평가 + 반박 라운드 반영 최종 패널)을 종합해 최종 판정하세요.\n\n티커: {{TICKER}}\n\n{{REFLECTION_CONTEXT}}\n\n위원 최종 평가:\n{{PEER_ARGUMENTS}}\n\n지시: 다수결이 아니라 논거 품질로 판정하세요. 소수 의견이 더 설득력 있으면 채택하세요.\n\n응답 JSON: {"scores":{"short":0,"mid":0,"long":0},"winning_timeframe":"short","rationale_kr":"판정 근거(120자)","conviction":0}`;
export async function callJudge(input: { ticker, panelSummary, reflectionContext?, adminUserId, costClient? }): Promise<JudgeVerdict>
export async function callDualJudge(동일 시그니처): Promise<JudgeVerdict>
  — 공통 내부 callJudgeRole(role: 'debate_judge'|'dual_judge_gpt', personaIdForLog) : resolveRole → renderUserPrompt 대신 직접 replaceAll(판정 입력은 ticker/REFLECTION_CONTEXT/PEER_ARGUMENTS 3 placeholder — renderUserPrompt의 financials required와 충돌하므로 자체 light 렌더) → provider.call(systemPrompt='당신은 투자위원회 최종 판정관입니다.') → W1a classifier 동일 catch → insertCostLog(persona_id, prompt_version 'judge@v1', model) → parseJudgeVerdict.
```
panelSummary 렌더 = `renderPeerArguments`(debate-round-template — 11명 전원 + label) 재사용(caller가 생성).
- [ ] **Step 4: 통과 확인 + tsc.**
- [ ] **Step 5: commit** `feat(w1b): judge-client — callJudge(Opus)/callDualJudge(GPT↔Opus auto-detect) + JudgeVerdict 파서 (D2, TDD)`

## Task 2: judge-stage — 경계 산정 + 불일치 판정 순수 함수 (TDD)

- [ ] **Step 1: 실패 테스트**
```typescript
it('computeDualJudgeBoundary: judge 점수 기준 트랙 활성 tf rank 9..12 (±2), 동점 ticker asc, 합집합 dedupe', () => {});
it('pool<12: rank 범위 교집합 안전', () => {});
it('isDualJudgeDisagreement: winning_timeframe 상이 → true / argmax-tf 점수차 >15 → true / 이하 → false (결정론)', () => {});
```
- [ ] **Step 2: 실패 확인.** / **Step 3: 구현**(debate-round.ts 패턴 — D28_DEBATE_CONFIG.dualJudgeBoundaryWindow 소비 + `export const DUAL_JUDGE_DISAGREE_DELTA = 15;` 가설 config) / **Step 4: 통과.** / **Step 5: commit** `feat(w1b): judge-stage — dual-judge 경계(rank 9..12) + 결정론 불일치 판정 (D3, TDD)`

## Task 3: 마이그 0033 (dormant)

- [ ] Step 1: SQL — `drop constraint if exists tier1_selection_job_round_chk` → conrelid 가드로 `check (round in (1,2,3))` 재생성. rollback = `delete where round>2` → (1,2) 원복.
- [ ] Step 2: grep 가드 — `create or replace function` 0건(RPC 무변경).
- [ ] Step 3: commit `feat(w1b): 마이그 0033 — round check (1,2,3) judge 라운드 (RPC 무변경, dormant)`

## Task 4: runTier1Screening judgeScoresByTicker seam (TDD)

- [ ] **Step 1: 실패 테스트**(tier1-screening.test.ts) — judge 점수 주입 ticker는 weighted_scores=judge(랭킹/배지/selected 반영), 미주입 ticker는 consensus 유지, available=false(⚪)는 judge 있어도 ⚪ 유지.
- [ ] **Step 2: 실패 확인.** / **Step 3: 구현** — partial build 단계에서 `const judge = input.judgeScoresByTicker?.[ticker]; weighted = judge ?? computeWeightedScores(...)` (available/degraded 분기 앞단 유지). / **Step 4: 기존 전부+신규 PASS.** / **Step 5: commit**

## Task 5: worker judge 단계 (TDD)

- [ ] **Step 1: 실패 테스트**
```typescript
it('R1·R2 terminal + judge targets(최종 panel 보유) 미enqueue → round=3 enqueue + finalize 안 함', async () => {});
it('judge chunk: claimed round=3 → callJudgePanel(최종 panel 요약+incumbent ctx) → verdict jsonb 저장', async () => {});
it('judge 전부 terminal → finalize: judgeScoresByTicker 주입 + dual-judge 경계만 GPT 콜 + 불일치 구조화 로그 + 최종=Opus', async () => {});
it('judge job failed → 해당 ticker consensus fallback (graceful)', async () => {});
it('dual-judge 전용 preflight fail → skip + dual_judge_skipped_hardcap 로그, 선정은 진행', async () => {});
it('preflight 2-line: tier1(r1+r2)×11×worst-slot + judge×judge단가', async () => {});
```
- [ ] **Step 2: 실패 확인.** / **Step 3: 구현** — DI `callJudgePanel`/`callDualJudge` 추가. 게이트 확장: W1a finalize 진입 조건 충족 시 → judge 대상 = pickFinalPanels(r1,r2).keys() → round=3 미존재분 enqueue / judge 전부 terminal 시 → judgeScores 수집(round=3 done의 verdict) → dual-judge(boundary, 전용 preflight, disagreement 로그) → runScreening({judgeScoresByTicker}) → persist. round 분기: 3=judge(verdict 저장 — panel_result에 JudgeVerdict jsonb), 2=debate, 1=R1. preflight lines 2종(round별 count 분리 — countByStatusRound 신설). / **Step 4: 기존 45+신규 PASS(기존 finalize 테스트는 judge fullset 보강).** / **Step 5: commit**

## Task 6: route DI + format-error (TDD)
- [ ] route: `callJudgePanel: ({ticker, panelSummary, reflectionContext}) => callJudge({...adminUserId, costClient})` + `callDualJudge` 배선 + 기존 mock 보강. format-error 3종+prefix. commit.

## Task 7: 정리 — 단발 경로 삭제 (D7)
- [ ] Step 1: `monthly-batch-orchestrator.ts`+test 삭제 → tsc/grep으로 잔존 참조 0 확인(주석 4건 정정).
- [ ] Step 2: `upsertShortList30` 함수+테스트 블록 삭제(buildShortListRows/TICKER_RE/upsertShortListTrack 보존).
- [ ] Step 3: `trackOfPeriod`+테스트 블록 삭제.
- [ ] Step 4: 게이트 + `grep -rn "runMonthlyBatchOrchestrator|upsertShortList30|trackOfPeriod" src` → 0. commit `chore(w1b): 단발 orchestrator/upsertShortList30/trackOfPeriod 제거 — live caller 0 (67차 follow-up ②③)`

## Task 8: 통합 게이트 + DoD
- [ ] build+lint+test:ci+tsc ALL GREEN / 0031·0032·reader·consensus·W2b·stub route diff 0 / projection 350,167 무변경 PASS / `d28-reservation-projection` + dual-judge 경계 config 소비 grep.

## Self-Review 체크 (작성자 수행)
1. **Spec coverage:** D28 ③ judge Opus per-ticker(Task 1,5) / 경계 ±2 dual-judge + 불일치 시 Opus 최종(Task 2,5 — 점수 미반영·로그 관측 = "Opus 최종" 충실) / config 소비(dualJudgeBoundaryWindow + DELTA 신설) / 67차 ②③ 정리(Task 7) / calibration defer 명시.
2. **Placeholder scan:** Task 1/2/5 실코드·시그니처 포함, Task 4 seam 1줄 수준 명시.
3. **Type consistency:** JudgeVerdict(Task 1 = Task 5 저장/수집 = Task 4 scores shape) / round 1|2|3(Task 3 DDL = Task 5 TS) / callJudgePanel DI(Task 5 = Task 6 route).
4. **무회귀:** W1a R2 게이트/W2b incumbent/0031·0032/결정론 fallback — 기존 테스트 무변경 통과(judge fullset 보강 제외).

## 검증 게이트 (DoD)
- ALL GREEN + 삭제 3종 잔존 참조 grep 0 + judge graceful fallback 테스트 + dual-judge skip-on-hardcap 테스트 + projection 무변경.
- 마이그 0033 dormant(USER apply 게이트 — 순서 0032→0033 문서화). 실 AI 0 · cost 0.

## Execution Handoff
§2.0a + 사용자 명시: plan ①Claude→②omxy 검토→③omxy direct-edit→④Claude 검증 → impl 동일 → 배선 교차감사(Claude Workflow + omxy blind) → docs-sync(omxy 검증).
