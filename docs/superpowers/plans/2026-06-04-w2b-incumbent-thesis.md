# W2b — D27 Q5 incumbent thesis 재점검 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 트랙별 재선정 시 기존 리스트 종목(incumbent)을 fresh Tier0 후보와 union해 **반드시 평가에 포함**(무심사 탈락 금지)하고, 각 incumbent에 직전 논거·배지·점수·리포트 thesis·실현 성과를 "incumbent thesis context"로 주입해 재점검시키며, delta_status(hold/new)를 직전 row diff로 실계산한다.

**Architecture:** W2a 트랙 seam(period_key/track + rolling composite RPC) 위 **additive — 마이그 0 · RPC 무변경 · reader(getActiveShortList) 무변경**. 후보풀만 fresh(50/100) ∪ incumbent-only(≤10/≤20)로 가변화하고, per-ticker 컨텍스트는 기존 `reflectionContext` seam을 per-call 인자로 확장해 주입한다. 유지는 자동이 아님 — incumbent도 신규와 동일 랭킹 경쟁(top10 진입 시만 유지).

**Tech Stack:** Next.js 16 (server actions, route handlers) · Supabase Postgres (기존 0031 RPC 그대로) · Vitest · zod.

**SoT:** `Document/Process/HANDOFF.md` ⭐ 65차 W2b(:39-42) + LOCKED 결정 8(Q5 D27) + `model-registry.ts` `W2_TRACK_VOLUME`(incumbentMax 10/track + extra 2k tok — 비용 가정 SoT, projection 350,167≤50만에 이미 포함).

---

## 범위 (W2b) vs 범위 밖

**W2b (이 계획):**
1. 트랙별 후보풀 = fresh Tier0 ∪ incumbents(직전 short_list_30 트랙 rows) union+dedupe — incumbent 무심사 탈락 금지(탈락은 랭킹 결과로만).
2. expected_total 동적화 — short 50+≤10 / midlong 100+≤20 (pool range gate; selected count는 10/20 불변 → **0031 RPC 무변경**).
3. per-ticker incumbent thesis context builder(직전 ai_comment_kr/배지/ai_score/conviction + stock_reports `section_0`(headline/thesis) + 실현 성과[portfolio_snapshot `entry_price>0`시만 — W3 graceful]) → `reflectionContext` seam per-call 확장 주입.
4. delta_status 실계산 — selected ∩ incumbents = `'hold'` / 그 외 `'new'`. removed(incumbents − selected)는 **행 materialize 불가**(아래 D6) → finalize 구조화 로그.
5. W2a follow-up ①: vercel.json 옛 `/api/cron/monthly-batch` 스케줄 제거 (stub 200 route 자체는 보존).

**범위 밖 (명시적 DEFER):**
- **W1 토론 loop 전체** (멀티라운드 반박·D28 모델 mix·R2 trigger·dual-judge). incumbent context는 W1 토론 프롬프트에도 동일 seam으로 재사용된다(persona-panel-adapter 경유) — W2b는 단발 채점 경로에 주입.
- **W2a follow-up ②**(단발 orchestrator/`upsertShortList30` 본체 삭제) → W1 정리 후보 유지. W2b는 미호출 deprecated 상태 그대로 둔다(orchestrator는 fresh-only 경로로 동작 보존).
- **entry_price 실배선**(actions.ts `resolveRealEntryPrice` null TODO) = **W3**. W2b 실현 성과는 snapshot에 유효 데이터 있을 때만 graceful 포함(현 production 0 rows → 전부 생략 = 정상).
- 실 AI 가동 / cron go-live / Vercel env = USER 게이트. W2b 코드는 flag-off·mock·cost0로 머지.

## 핵심 설계 결정

- **D1 incumbent 식별 = "최신 month 그룹" 조회.** `short_list_30`에서 `bucket = any(트랙 buckets) AND month <= 선정월`을 month desc로 조회해 **최신 month의 rows만** 채택(short: 주중 재선정이라 보통 같은 달 = 직전 주 선정분, 월초 carry 후엔 carry분 / midlong: 직전 월분). cold start(0 rows) = incumbents `[]` → W2a fresh-only와 동일 동작(D27: cold start=신규 취급). 트랙 count gate(10/20)가 보장되므로 latest 그룹 > `TRACK_SELECT_COUNT` 시 fail-closed throw. `trackOfPeriod`(W2a 잔여 ③)는 worker가 track 인자를 직접 들고 있어 소비 불필요 — 보존만.
- **D2 union은 순수 함수, fresh 우선.** `mergeFreshWithIncumbents(fresh, incumbents)` — fresh ticker와 겹치는 incumbent는 fresh row 유지(tier0 score 보유), incumbent-only는 `Tier1Candidate` 합성: `tier0_buckets[직전 bucket]=true` + `tier0_scores` **전부 null**(Tier0 후보 아님 → `computeTier0Ranks`에서 자연 제외 → tier0IsTop=false → 배지는 🟣/⚪ 경로 = 의미 정합) + sector는 `isCanonicalSector` 통과분만.
- **D3 pool 동적화는 3단 게이트.** (a) worker: fresh 정확 count(`TRACK_FRESH_POOL`) 불변 + incumbents ≤ `TRACK_SELECT_COUNT` fail-closed → union 후 enqueue. (b) `runTier1Screening`: 고정 `!== TRACK_FRESH_POOL` → **range** `[FRESH, FRESH+SELECT_COUNT]`. (c) 최종 count 정합 = `makeTier1ScreeningResultSchema(track, candidates.length)` (W2a factory가 이미 poolSize 인자 — notSelected=poolSize−selectCount 자동).
- **D4 컨텍스트 주입 = per-call reflectionContext 인자.** `makeCallPersonaPanel` deps의 `reflectionContext: string`(invocation 고정)을 유지하되 **per-call override** 추가: `callPersonaPanel({ticker, financials, reflectionContext?})` → `reflectionContext ?? deps.reflectionContext`. worker chunk loop가 `incumbentContextByTicker[ticker] ?? ''` 전달. enqueue/claim/run-mutex/preflight 등 W2a 큐 메커니즘 **무변경**. finalize replay 콜백은 reflectionContext 미사용(LLM 0콜)이라 무영향.
- **D5 실현 성과는 graceful-by-construction.** `portfolio_snapshot`에서 incumbent ticker의 최신 행 중 `entry_price > 0`인 것만 `total_return` 사용. 현 production은 entry_price=0 placeholder(W3 TODO)라 전부 생략 — 별도 flag/stub 없이 데이터가 생기면 자동 포함.
- **D6 removed는 행으로 materialize하지 않는다.** `replace_shortlist_track` RPC count gate(10/20 정확) + "always 30" invariant + report-worker `!==30` not-ready 가드와 양립 불가(removed 행 추가 시 >30). ∴ delta_status 실계산 = 선정行에 `'hold'|'new'` persist(RPC는 이미 `coalesce(e->>'delta_status','new')` pass-through — **RPC 무변경**), removed set은 finalize에서 구조화 `console.info`(`incumbent_removed`) 로깅. UI `aggregateShortListDelta`의 removedCount는 현행대로 0 유지(소비자 무변경). carry rows의 `'hold'`(0031)와 의미 일관.
- **D7 비용 가드 무변경.** reservation = `(open+deferred jobs) × 11 × 역할 단가`(W2a) — incumbent job이 큐에 들어가므로 **job count 기반 산식이 자동 포함**. incumbent 컨텍스트 +2k input tok/콜은 W0 `projectD28MonthlyReservationKrw`에 이미 반영(350,167원 ≤ 50만). preflight 산식 변경 0.
- **D8 incumbent set의 invocation 간 미세 변동은 수렴.** enqueue는 매 invocation idempotent upsert — 중간에 incumbent set이 변해도(월초 carry 등) 신규 ticker는 새 job으로 추가되어 평가받고(무심사 탈락 금지 유지), 사라진 ticker의 기존 job은 잔존·평가됨(候補 재조회 시 pool 밖이면 replay에서 미사용 — 무해). finalize는 nonTerminal===0까지 대기하므로 정합 수렴.

## File Structure

**신규 생성:**
- `tudal/src/lib/screening/incumbent-merge.ts` — `IncumbentInfo` 타입 SoT + `mergeFreshWithIncumbents` 순수 함수. (screening→data 역참조 금지 — `Tier1Candidate`/`admin-tier0-candidates` 동일 패턴: 타입은 screening에, data 모듈이 import.)
- `tudal/src/lib/screening/__tests__/incumbent-merge.test.ts`
- `tudal/src/lib/data/admin-shortlist-incumbents.ts` — `getIncumbents`(D1) + `buildIncumbentThesisContexts`(D5) — client DI(SelectChain mock 타이핑, [[feedback_test_mock_typing]]).
- `tudal/src/lib/data/__tests__/admin-shortlist-incumbents.test.ts`

**수정:**
- `tudal/src/lib/screening/persona-panel-adapter.ts:162-185` — per-call `reflectionContext` override (D4).
- `tudal/src/lib/screening/persona-eval.ts:289-316`(RunTier1ScreeningInput.callPersonaPanel 타입) + `:424-429`(pool range gate, D3b).
- `tudal/src/lib/data/admin-shortlist-persist.ts:80-141`(buildShortListRows delta 인자) + `:245-307`(upsertShortListTrack options.incumbentTickers).
- `tudal/src/lib/screening/tier1-selection-batch-worker.ts` — DI 2종(`incumbentsSource`/`buildIncumbentContexts`) + union + per-call context + finalize delta/removed 로그.
- `tudal/src/app/api/cron/monthly-batch/selection-worker/route.ts:119-152` — 신규 DI 배선.
- `tudal/vercel.json` — 옛 `/api/cron/monthly-batch` 스케줄 제거 (follow-up ①).
- 동반 테스트: `persona-panel-adapter.test.ts` · `tier1-screening.test.ts` · `admin-shortlist-track-persist.test.ts` · `tier1-selection-batch-worker.test.ts` · `selection-worker route.test.ts`.

**무변경 (DoD grep/diff로 검증):** `supabase/migrations/`(0031 포함 전부) · `admin-shortlist.ts`(reader) · `tier1-schema.ts`(factory가 이미 poolSize 인자) · `monthly-batch-orchestrator.ts`(deprecated fresh-only 보존) · cost-logger/preflight.

---

## Task 0: 착수 가드

- [ ] **Step 1: main 게이트 GREEN + branch 확인**

Run: `cd tudal && git rev-parse --abbrev-ref HEAD`
Expected: `feat/w2b-incumbent-thesis`. (main 기준 test:ci 1703+2skip 확인된 상태에서 분기.)

- [ ] **Step 2: 마이그 디렉토리 무변경 baseline 기록**

Run: `git diff --stat main -- tudal/supabase/migrations/`
Expected: 출력 0 (W2b 전 과정 유지 — Task 10 Step 3에서 재검증).

---

## Task 1: IncumbentInfo 타입 + mergeFreshWithIncumbents 순수 함수 (TDD)

**Files:**
- Create: `tudal/src/lib/screening/incumbent-merge.ts`
- Test: `tudal/src/lib/screening/__tests__/incumbent-merge.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { describe, it, expect } from 'vitest';
import {
  mergeFreshWithIncumbents,
  type IncumbentInfo,
} from '../incumbent-merge';
import type { Tier1Candidate } from '../persona-eval';

function freshCandidate(ticker: string, bucket: 'short' | 'mid' | 'long'): Tier1Candidate {
  return {
    ticker,
    sector: '반도체',
    tier0_buckets: { short: bucket === 'short', mid: bucket === 'mid', long: bucket === 'long' },
    tier0_scores: { short: bucket === 'short' ? 80 : null, mid: bucket === 'mid' ? 80 : null, long: bucket === 'long' ? 80 : null },
  };
}
function incumbent(ticker: string, bucket: 'short' | 'mid' | 'long', sector: string | null = '반도체'): IncumbentInfo {
  return {
    ticker, bucket, rank: 1, month: '2026-06-01', sector,
    name: `종목${ticker}`, aiCommentKr: '직전 논거', consensusBadge: '🟢',
    aiScore: 78.2, conviction: 71, deltaStatus: 'new',
  };
}

describe('mergeFreshWithIncumbents', () => {
  it('incumbent-only ticker는 tier0_scores 전부 null + 직전 bucket true로 합성 추가', () => {
    const fresh = [freshCandidate('000001', 'short')];
    const merged = mergeFreshWithIncumbents(fresh, [incumbent('999999', 'short')]);
    expect(merged).toHaveLength(2);
    const synth = merged.find((c) => c.ticker === '999999')!;
    expect(synth.tier0_buckets).toEqual({ short: true, mid: false, long: false });
    expect(synth.tier0_scores).toEqual({ short: null, mid: null, long: null });
    expect(synth.sector).toBe('반도체');
  });
  it('fresh와 겹치는 incumbent는 fresh row 유지 (dedupe, tier0 score 보존)', () => {
    const fresh = [freshCandidate('000001', 'short')];
    const merged = mergeFreshWithIncumbents(fresh, [incumbent('000001', 'short')]);
    expect(merged).toHaveLength(1);
    expect(merged[0].tier0_scores.short).toBe(80);
  });
  it('비-canonical sector incumbent는 sector null로 합성', () => {
    const merged = mergeFreshWithIncumbents([], [incumbent('999999', 'mid', '미분류')]);
    expect(merged[0].sector).toBeNull();
  });
  it('incumbent 내부 중복 ticker는 1회만 합성 (방어적 dedupe)', () => {
    const merged = mergeFreshWithIncumbents(
      [],
      [incumbent('999999', 'long'), incumbent('999999', 'long')],
    );
    expect(merged).toHaveLength(1);
  });
  it('순서 결정성: fresh 전체 → incumbent-only (입력 순서 보존)', () => {
    const merged = mergeFreshWithIncumbents(
      [freshCandidate('000001', 'short'), freshCandidate('000002', 'short')],
      [incumbent('999998', 'short'), incumbent('999999', 'short')],
    );
    expect(merged.map((c) => c.ticker)).toEqual(['000001', '000002', '999998', '999999']);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd tudal && npx vitest run src/lib/screening/__tests__/incumbent-merge.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: 구현**

```typescript
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
```

- [ ] **Step 4: 통과 확인**

Run: `cd tudal && npx vitest run src/lib/screening/__tests__/incumbent-merge.test.ts`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add tudal/src/lib/screening/incumbent-merge.ts tudal/src/lib/screening/__tests__/incumbent-merge.test.ts
git commit -m "feat(w2b): IncumbentInfo + mergeFreshWithIncumbents — fresh∪incumbent union 순수 로직 (D27 Q5, TDD)"
```

---

## Task 2: persona-panel-adapter per-call reflectionContext (TDD)

**Files:**
- Modify: `tudal/src/lib/screening/persona-panel-adapter.ts:162-185` (makeCallPersonaPanel 반환 closure)
- Test: `tudal/src/lib/screening/__tests__/persona-panel-adapter.test.ts` (기존 파일에 추가)

- [ ] **Step 1: 실패 테스트 작성** (기존 테스트 파일의 mock callPersona 패턴 재사용)

```typescript
it('per-call reflectionContext가 deps default를 override해 callPersona에 전달', async () => {
  const calls: Array<{ personaId: string; reflectionContext: string }> = [];
  const panel = makeCallPersonaPanel({
    callPersona: async (input) => {
      calls.push({ personaId: input.personaId, reflectionContext: input.reflectionContext });
      return okPersonaResult(input.personaId); // 기존 헬퍼 — 유효 JSON content
    },
    personas: CORE_11_PERSONAS,
    reflectionContext: '',
    adminUserId: TEST_UUID,
  });
  await panel({ ticker: '000001', financials: 'f', reflectionContext: '[재점검] 직전 논거...' });
  expect(calls).toHaveLength(11);
  expect(calls.every((c) => c.reflectionContext === '[재점검] 직전 논거...')).toBe(true);
});

it('per-call reflectionContext 미지정 시 deps default 사용 (W2a 무회귀)', async () => {
  // 동일 mock — panel({ ticker, financials })만 호출 → reflectionContext '' 전달 검증.
});
```

- [ ] **Step 2: 실패 확인** — Run vitest 해당 파일. Expected: FAIL (closure가 3번째 필드 미수용 → reflectionContext가 ''로 고정).

- [ ] **Step 3: 구현** — 반환 closure 시그니처 확장:

```typescript
export function makeCallPersonaPanel(
  deps: CallPersonaPanelDeps,
): (input: { ticker: string; financials: string; reflectionContext?: string }) => Promise<PersonaScore[]> {
  const template = deps.userPromptTemplate ?? PERSONA_SCORE_USER_PROMPT_TEMPLATE;
  const runLimited = createLimiter(resolveMaxConcurrentCalls(deps.maxConcurrentCalls));
  return async ({ ticker, financials, reflectionContext }) => {
    return Promise.all(
      deps.personas.map(async (persona) => {
        const res = await runLimited(() =>
          deps.callPersona({
            personaId: persona.id,
            ticker,
            financials,
            // W2b (D27 Q5): per-call incumbent thesis context override. 미지정 시 invocation default.
            reflectionContext: reflectionContext ?? deps.reflectionContext,
            adminUserId: deps.adminUserId,
            userPromptTemplate: template,
            costClient: deps.costClient,
          }),
        );
        return parsePersonaScore(res.content, persona.id);
      }),
    );
  };
}
```

- [ ] **Step 4: 통과 확인** — Run vitest 해당 파일. Expected: PASS (기존 테스트 무회귀 포함).

- [ ] **Step 5: commit**

```bash
git add tudal/src/lib/screening/persona-panel-adapter.ts tudal/src/lib/screening/__tests__/persona-panel-adapter.test.ts
git commit -m "feat(w2b): makeCallPersonaPanel per-call reflectionContext override — incumbent context 주입 seam (TDD)"
```

---

## Task 3: runTier1Screening pool range gate + callPersonaPanel 타입 (TDD)

**Files:**
- Modify: `tudal/src/lib/screening/persona-eval.ts:306`(callPersonaPanel 타입) + `:424-429`(pool gate)
- Test: `tudal/src/lib/screening/__tests__/tier1-screening.test.ts` (기존에 추가)

- [ ] **Step 1: 실패 테스트 작성** (기존 makeCandidates/트랙 fixture 패턴 재사용)

```typescript
it('short 트랙: fresh 50 + incumbent 7 = 57 pool 허용 → selected 10 + notSelected 47', async () => {
  // candidates = 50 fresh(bucket short) + 7 incumbent 합성(bucket short, tier0_scores null)
  const result = await runTier1Screening({ track: 'short', candidates: pool57, ...okDeps });
  expect(result.selected).toHaveLength(10);
  expect(result.notSelected).toHaveLength(47);
});
it('pool < fresh(50) → throw tier1_candidates_pool_out_of_range', async () => {
  await expect(runTier1Screening({ track: 'short', candidates: pool49, ...okDeps }))
    .rejects.toThrow('tier1_candidates_pool_out_of_range:short:49');
});
it('pool > fresh+selectCount(60) → throw', async () => {
  await expect(runTier1Screening({ track: 'short', candidates: pool61, ...okDeps }))
    .rejects.toThrow('tier1_candidates_pool_out_of_range:short:61');
});
it('midlong: 100+20=120 허용 / 121 throw', async () => { /* 동일 패턴 */ });
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL (`tier1_candidates_must_be_50 (got 57)` — 현 고정 gate).

- [ ] **Step 3: 구현**

`:424-429` 고정 gate 교체:
```typescript
// W2b (D27 Q5) — pool 동적화: fresh(TRACK_FRESH_POOL) ∪ incumbent-only(≤TRACK_SELECT_COUNT).
// fresh 정확 count는 caller(worker)가 union 전에 보장. 여기는 range + distinct만 강하게,
// 최종 count 정합은 makeTier1ScreeningResultSchema(track, candidates.length)가 검증.
const minPool = TRACK_FRESH_POOL[track];
const maxPool = minPool + TRACK_SELECT_COUNT[track];
if (input.candidates.length < minPool || input.candidates.length > maxPool) {
  throw new Error(
    `tier1_candidates_pool_out_of_range:${track}:${input.candidates.length}`
  );
}
```
(`TRACK_SELECT_COUNT`는 tier1-schema에서 추가 import.)

`:306` callPersonaPanel 타입에 per-call context 추가(D4 — 어댑터와 계약 일치):
```typescript
callPersonaPanel: (input: {
  ticker: string;
  financials: string;
  /** W2b (D27 Q5) — incumbent thesis context per-call 주입. 미지정 = 비-incumbent. */
  reflectionContext?: string;
}) => Promise<PersonaScore[]>;
```
(runTier1Screening 내부 호출 `:456`은 reflectionContext 미전달 유지 — 단발 경로는 컨텍스트 없음. worker chunk 경로가 직접 전달.)

- [ ] **Step 4: 통과 확인** — 기존 tier1-screening 테스트 전부 + 신규 4건 PASS. (기존 "후보 수 != 150" 류 테스트는 메시지 `tier1_candidates_pool_out_of_range`로 갱신.)

- [ ] **Step 5: commit**

```bash
git add tudal/src/lib/screening/persona-eval.ts tudal/src/lib/screening/__tests__/tier1-screening.test.ts
git commit -m "feat(w2b): runTier1Screening pool range gate [fresh, fresh+selectCount] + per-call context 타입 (TDD)"
```

---

## Task 4: getIncumbents — 직전 트랙 rows 조회 (TDD)

**Files:**
- Create: `tudal/src/lib/data/admin-shortlist-incumbents.ts`
- Test: `tudal/src/lib/data/__tests__/admin-shortlist-incumbents.test.ts`

- [ ] **Step 1: 실패 테스트 작성** (SelectChain mock 인터페이스 — feedback_test_mock_typing, any 금지. `admin-tier0-candidates.test.ts`의 chain mock 패턴 차용)

```typescript
describe('getIncumbents', () => {
  it('midlong: month<=기준 최신 month 그룹의 mid/long rows만 반환 (이전 달 잔재 제외)', async () => {
    // mock rows: 2026-06-01 mid 10 + long 10, 2026-05-01 mid 10 + long 10 (month desc 정렬 반환)
    const result = await getIncumbents({ track: 'midlong', month: '2026-07', client });
    expect(result).toHaveLength(20);
    expect(result.every((r) => r.month === '2026-06-01')).toBe(true);
  });
  it('short: 최신 그룹 10 반환 + IncumbentInfo 필드 매핑(aiCommentKr/배지/aiScore/conviction)', async () => { /* 매핑 검증 */ });
  it('cold start: rows 0 → [] (throw 아님)', async () => {
    expect(await getIncumbents({ track: 'short', month: '2026-06', client })).toEqual([]);
  });
  it('최신 그룹이 TRACK_SELECT_COUNT 초과 → throw incumbents_count_exceeded (fail-closed)', async () => { /* short 11행 mock */ });
  it('invalid month → throw invalid_month_format', async () => { /* '2026-13' */ });
});
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL (module not found).

- [ ] **Step 3: 구현**

```typescript
// W2b (D27 Q5) — incumbent 식별 + per-ticker thesis context builder.
// DI seam (admin-tier0-candidates 패턴): options.client 미지정 시 session createClient.
//   cron worker = service-role 명시 주입. screening 타입(IncumbentInfo)을 import (역참조 금지 방향).
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { IncumbentInfo } from "@/lib/screening/incumbent-merge";
import type { SelectionTrack, Timeframe } from "@/lib/screening/tier1-schema";
import { TRACK_SELECT_COUNT } from "@/lib/screening/tier1-schema";

const MONTH_YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const TRACK_BUCKETS: Record<SelectionTrack, readonly Timeframe[]> = {
  short: ["short"],
  midlong: ["mid", "long"],
};

interface IncumbentDbRow {
  ticker: string;
  bucket: Timeframe;
  rank: number;
  month: string;
  sector: string | null;
  name: string | null;
  ai_comment_kr: string | null;
  consensus_badge: string | null;
  ai_score: string | number | null;
  conviction: string | number | null;
  delta_status: string;
}

function numOrNull(v: string | number | null): number | null {
  if (v === null) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * 직전 선정 리스트의 트랙 incumbent rows (D1 — 최신 month 그룹).
 * cold start(0 rows) = [] 반환(신규 취급). 그룹 크기 > TRACK_SELECT_COUNT = fail-closed throw.
 */
export async function getIncumbents(options: {
  track: SelectionTrack;
  month: string; // 선정 대상 YYYY-MM
  client?: SupabaseClient;
}): Promise<IncumbentInfo[]> {
  if (!MONTH_YM_RE.test(options.month)) {
    throw new Error(`invalid_month_format:${options.month}`);
  }
  const monthDate = `${options.month}-01`;
  const supabase = options.client ?? (await createClient());
  const { data, error } = await supabase
    .from("short_list_30")
    .select(
      "ticker, bucket, rank, month, sector, name, ai_comment_kr, consensus_badge, ai_score, conviction, delta_status",
    )
    .in("bucket", [...TRACK_BUCKETS[options.track]])
    .lte("month", monthDate)
    .order("month", { ascending: false })
    .order("bucket", { ascending: true })
    .order("rank", { ascending: true });
  if (error) {
    throw new Error(`incumbents_query_failed:${error.code ?? "unknown"}`);
  }
  const rows = (data ?? []) as IncumbentDbRow[];
  if (rows.length === 0) return [];
  const latestMonth = rows[0].month;
  const latest = rows.filter((r) => r.month === latestMonth);
  if (latest.length > TRACK_SELECT_COUNT[options.track]) {
    throw new Error(
      `incumbents_count_exceeded:${options.track}:${latest.length}`,
    );
  }
  return latest.map((r) => ({
    ticker: r.ticker,
    bucket: r.bucket,
    rank: r.rank,
    month: r.month,
    sector: r.sector,
    name: r.name,
    aiCommentKr: r.ai_comment_kr,
    consensusBadge: r.consensus_badge,
    aiScore: numOrNull(r.ai_score),
    conviction: numOrNull(r.conviction),
    deltaStatus: r.delta_status,
  }));
}
```

- [ ] **Step 4: 통과 확인** — Run vitest 해당 파일. Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add tudal/src/lib/data/admin-shortlist-incumbents.ts tudal/src/lib/data/__tests__/admin-shortlist-incumbents.test.ts
git commit -m "feat(w2b): getIncumbents — 직전 트랙 rows 최신 month 그룹 조회 (D1, fail-closed cap, TDD)"
```

---

## Task 5: buildIncumbentThesisContexts — per-ticker 컨텍스트 빌더 (TDD)

**Files:**
- Modify: `tudal/src/lib/data/admin-shortlist-incumbents.ts` (동일 모듈에 추가)
- Test: `tudal/src/lib/data/__tests__/admin-shortlist-incumbents.test.ts` (추가)

- [ ] **Step 1: 실패 테스트 작성**

```typescript
describe('buildIncumbentThesisContexts', () => {
  it('직전 row 필드 + 리포트 thesis + 실현 성과를 한국어 컨텍스트로 합성', async () => {
    // mock: stock_reports is_latest section_0 {headline, thesis: ['t1','t2','t3','t4']},
    //       portfolio_snapshot entry_price 50000 / total_return 0.052
    const map = await buildIncumbentThesisContexts([inc], { client });
    const ctx = map['005930'];
    expect(ctx).toContain('직전 선정 리스트에 포함');
    expect(ctx).toContain('🟢');
    expect(ctx).toContain('직전 논거');     // ai_comment_kr
    expect(ctx).toContain('t1');            // thesis bullet
    expect(ctx).not.toContain('t4');        // 최대 3개 cap
    expect(ctx).toContain('+5.2%');         // 실현 성과
    expect(ctx).toContain('유지가 자동이 아닙니다'); // 재점검 지시문
  });
  it('리포트 부재/section_0 파싱 실패 → thesis 줄 생략 (graceful)', async () => { /* not contain '핵심 thesis' */ });
  it('snapshot 부재/entry_price=0 → 실현 성과 줄 생략 (W3 graceful)', async () => { /* not contain '실현 성과' */ });
  it('보조 조회(reports/snapshot) 실패 → 컨텍스트는 직전 row 정보만으로 생성 (throw 금지 — best-effort)', async () => { /* error chain mock */ });
  it('incumbents [] → {} (조회 0회)', async () => { /* rpc/from 미호출 검증 */ });
});
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL (function not exported).

- [ ] **Step 3: 구현** (동일 파일에 추가)

```typescript
import { reportSection0Schema } from "@/lib/data/report-section-schemas";

const THESIS_BULLET_MAX = 3;
const COMMENT_MAX = 120;

interface ReportThesisRow {
  ticker: string;
  month: string;
  section_0: unknown;
}
interface SnapshotPerfRow {
  ticker: string;
  date: string;
  entry_price: string | number | null;
  total_return: string | number | null;
}

/**
 * incumbent별 직전 thesis 컨텍스트 (D27 Q5 — 토론/채점 프롬프트 {{REFLECTION_CONTEXT}} 주입용).
 * 구성: 직전 row(배지/점수/확신/논거) + stock_reports section_0(headline + thesis ≤3) +
 *      실현 성과(portfolio_snapshot entry_price>0시만 — W3 graceful) + 재점검 지시문.
 * 보조 조회(reports/snapshot)는 best-effort — 실패해도 직전 row 기반 컨텍스트는 생성 (throw 금지:
 * 컨텍스트 부분 결손이 선정 cron 전체를 막으면 안 됨. incumbent 평가 포함 자체는 union이 보장).
 */
export async function buildIncumbentThesisContexts(
  incumbents: readonly IncumbentInfo[],
  options: { client?: SupabaseClient } = {},
): Promise<Record<string, string>> {
  if (incumbents.length === 0) return {};
  const supabase = options.client ?? (await createClient());
  const tickers = incumbents.map((i) => i.ticker);

  // 1) 직전 리포트 section_0 (is_latest, ticker당 최신 month 1건) — best-effort.
  const thesisByTicker = new Map<string, { headline: string; bullets: string[] }>();
  try {
    const { data } = await supabase
      .from("stock_reports")
      .select("ticker, month, section_0")
      .in("ticker", tickers)
      .eq("is_latest", true)
      .order("month", { ascending: false });
    for (const row of (data ?? []) as ReportThesisRow[]) {
      if (thesisByTicker.has(row.ticker)) continue; // month desc — 첫 행이 최신
      const parsed = reportSection0Schema.safeParse(row.section_0);
      if (!parsed.success) continue;
      thesisByTicker.set(row.ticker, {
        headline: parsed.data.headline,
        bullets: parsed.data.thesis.slice(0, THESIS_BULLET_MAX),
      });
    }
  } catch {
    // best-effort — 리포트 결손 시 직전 row 정보만으로 컨텍스트 생성.
  }

  // 2) 실현 성과 (entry_price>0 최신 snapshot의 total_return) — W3 graceful.
  const realizedByTicker = new Map<string, number>();
  try {
    const { data } = await supabase
      .from("portfolio_snapshot")
      .select("ticker, date, entry_price, total_return")
      .in("ticker", tickers)
      .order("date", { ascending: false });
    for (const row of (data ?? []) as SnapshotPerfRow[]) {
      if (realizedByTicker.has(row.ticker)) continue; // date desc — 첫 행이 최신
      const entry = numOrNull(row.entry_price);
      const ret = numOrNull(row.total_return);
      if (entry !== null && entry > 0 && ret !== null) {
        realizedByTicker.set(row.ticker, ret);
      }
    }
  } catch {
    // best-effort — W3 entry_price 실배선 전까지 생략이 기본.
  }

  // 3) 합성 (한국어, incumbent당 ≤ ~1.5k tok — W0 W2_TRACK_VOLUME 2k 가정 內).
  const out: Record<string, string> = {};
  for (const inc of incumbents) {
    const lines: string[] = [
      `[기존 선정 종목 재점검] 이 종목은 직전 선정 리스트(${inc.month.slice(0, 7)}, ${inc.bucket} ${inc.rank}위)에 포함되어 있었습니다.`,
    ];
    const meta: string[] = [];
    if (inc.consensusBadge) meta.push(`합의 배지 ${inc.consensusBadge}`);
    if (inc.aiScore !== null) meta.push(`AI 점수 ${inc.aiScore}`);
    if (inc.conviction !== null) meta.push(`확신도 ${inc.conviction}`);
    if (meta.length > 0) lines.push(`- 직전 평가: ${meta.join(" / ")}`);
    if (inc.aiCommentKr) {
      lines.push(`- 직전 한 줄 논거: "${inc.aiCommentKr.slice(0, COMMENT_MAX)}"`);
    }
    const thesis = thesisByTicker.get(inc.ticker);
    if (thesis) {
      lines.push(`- 직전 리포트 핵심 thesis: ${thesis.headline}`);
      for (const b of thesis.bullets) lines.push(`  • ${b}`);
    }
    const realized = realizedByTicker.get(inc.ticker);
    if (realized !== undefined) {
      const pct = (realized * 100).toFixed(1);
      lines.push(`- 선정 이후 실현 성과: ${realized >= 0 ? "+" : ""}${pct}%`);
    }
    lines.push(
      "지시: 위 직전 논거가 여전히 유효한지 재점검하세요. 논거가 깨졌다면(더 이상 상승 여력이 없다면) 점수를 낮추고, 유효하다면 신규 후보와 동일 기준으로 점수화하세요. 유지가 자동이 아닙니다 — 이 종목도 다른 후보와 동일하게 랭킹 경쟁합니다.",
    );
    out[inc.ticker] = lines.join("\n");
  }
  return out;
}
```

- [ ] **Step 4: 통과 확인** — Run vitest 해당 파일. Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add tudal/src/lib/data/admin-shortlist-incumbents.ts tudal/src/lib/data/__tests__/admin-shortlist-incumbents.test.ts
git commit -m "feat(w2b): buildIncumbentThesisContexts — 직전 논거+리포트 thesis+실현성과 per-ticker 컨텍스트 (best-effort, W3 graceful, TDD)"
```

---

## Task 6: upsertShortListTrack delta_status 실계산 (TDD)

**Files:**
- Modify: `tudal/src/lib/data/admin-shortlist-persist.ts:80-141`(buildShortListRows) + `:245-307`(upsertShortListTrack)
- Test: `tudal/src/lib/data/__tests__/admin-shortlist-track-persist.test.ts` (기존에 추가)

- [ ] **Step 1: 실패 테스트 작성** (기존 RpcChain mock 패턴 재사용)

```typescript
it('incumbentTickers에 포함된 selected는 delta_status=hold, 그 외 new (RPC p_rows 검증)', async () => {
  await upsertShortListTrack('2026-06', 'short', tenShort, {
    client,
    incumbentTickers: new Set(['000001', '000002']),
  });
  const rows = rpcSpy.calls[0].args.p_rows as Array<{ ticker: string; delta_status: string }>;
  expect(rows.find((r) => r.ticker === '000001')!.delta_status).toBe('hold');
  expect(rows.find((r) => r.ticker === '000003')!.delta_status).toBe('new');
});
it('incumbentTickers 미지정 → 전부 new (W2a 무회귀)', async () => { /* 기존 동작 검증 */ });
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL (options.incumbentTickers 미수용 / delta_status 전부 'new').

- [ ] **Step 3: 구현**

`buildShortListRows`에 인자 추가(시그니처: `buildShortListRows(supabase, monthDate, buckets, selected, commentsByTicker?, incumbentTickers?)`):
```typescript
        // W2b (D27 Q5) — delta_status 실계산: 직전 리스트(incumbent)에 있던 ticker가 재선정되면 'hold'.
        delta_status: incumbentTickers?.has(agg.ticker) ? 'hold' : 'new',
```
(기존 하드코드 `'new'` 라인 교체. `delta_reason`은 null 유지 — UI 표시 스펙 미정, YAGNI.)

`upsertShortListTrack` options 확장:
```typescript
  options: {
    client?: SupabaseClient;
    commentsByTicker?: TickerCommentMap;
    /** W2b (D27 Q5) — 직전 리스트 ticker set. 포함 selected는 delta_status='hold'. */
    incumbentTickers?: ReadonlySet<string>;
  } = {},
```
→ `buildShortListRows(..., options.commentsByTicker, options.incumbentTickers)` 전달. `upsertShortList30`(단발 보존 경로)은 incumbentTickers 미전달 = 전부 'new' 유지.

- [ ] **Step 4: 통과 확인** — 기존 track-persist 테스트 전부 + 신규 2건 PASS.

- [ ] **Step 5: commit**

```bash
git add tudal/src/lib/data/admin-shortlist-persist.ts tudal/src/lib/data/__tests__/admin-shortlist-track-persist.test.ts
git commit -m "feat(w2b): upsertShortListTrack delta_status 실계산 — incumbent 재선정=hold / 신규=new (RPC pass-through, TDD)"
```

---

## Task 7: worker union + 컨텍스트 주입 + removed 로그 (TDD)

**Files:**
- Modify: `tudal/src/lib/screening/tier1-selection-batch-worker.ts` (DI 2종 + union + per-call context + finalize delta/removed)
- Test: `tudal/src/lib/screening/__tests__/tier1-selection-batch-worker.test.ts` (기존 fixture 확장)

- [ ] **Step 1: 실패 테스트 작성**

```typescript
it('union enqueue: fresh 50 + incumbent-only 5 = 55 jobs (무심사 탈락 금지)', async () => {
  // incumbentsSource → 5 incumbent (fresh와 미중첩), tier0Source → 50
  // upsert 호출 rows 길이 55 + incumbent ticker 포함 검증
});
it('incumbent ticker chunk 처리 시 callPersonaPanel에 reflectionContext 전달, 비-incumbent는 미전달(undefined)', async () => {
  // claimed jobs = [incumbent 1, fresh 1] — panelSpy.calls의 input.reflectionContext 검증
});
it('finalize: persist options.incumbentTickers = incumbent set + removed 구조화 로그', async () => {
  // selected에 incumbent 일부만 잔존 → console.info 'incumbent_removed' (탈락 ticker 목록) spy 검증
  // persistSpy options.incumbentTickers 검증
});
it('incumbents > TRACK_SELECT_COUNT → abortBeforeSpend(incumbents_count_exceeded) (fail-closed, spend 0)', async () => { /* 11개 mock */ });
it('incumbentsSource 실패 → throw 전파 (silent drop 금지 — D27 무심사 탈락 금지)', async () => { /* reject mock */ });
it('reservation: fresh 50 + incumbent 10 = 60 jobs × 11 = 660 callCount preflight (자동 포함)', async () => { /* preflightSpy lines 검증 */ });
it('cold start: incumbents [] → W2a fresh-only와 동일 (50 jobs, context 미전달)', async () => { /* 무회귀 */ });
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL (DI 필드 미존재).

- [ ] **Step 3: 구현**

(a) DI 타입 + input 필드 추가:
```typescript
import { mergeFreshWithIncumbents, type IncumbentInfo } from "@/lib/screening/incumbent-merge";
import { TRACK_SELECT_COUNT } from "@/lib/screening/tier1-schema";

type IncumbentsSource = (opts: {
  track: SelectionTrack;
  month: string;
  client: SupabaseClient;
}) => Promise<IncumbentInfo[]>;
type BuildIncumbentContexts = (
  incumbents: readonly IncumbentInfo[],
  opts: { client: SupabaseClient },
) => Promise<Record<string, string>>;
```
`RunTier1SelectionChunkInput`에 `incumbentsSource: IncumbentsSource;` + `buildIncumbentContexts: BuildIncumbentContexts;` 추가. `CallPersonaPanel` 타입에 `reflectionContext?: string` 추가(Task 3 계약 일치). `Persist` options에 `incumbentTickers?: ReadonlySet<string>` 추가(Task 6 계약 일치).

(b) `runTier1SelectionChunk` 후보 수집부(`:347-370`) — union (기존 fresh 검증 유지):
```typescript
  const fresh = await input.tier0Source({ month, client });
  if (fresh.length === 0) { /* 기존 not-seeded skip 유지 */ }
  // W2a 유지 — fresh 정확 count (트랙 fresh pool). union 전 검증.
  if (fresh.length !== TRACK_FRESH_POOL[track]) {
    return await abortBeforeSpend(input, `tier0_candidates_invalid_count:${fresh.length}`);
  }
  // W2b (D27 Q5) — incumbent union. 조회 실패는 throw 전파(무심사 탈락 금지 — silent drop이
  // incumbent를 평가에서 누락시키면 안 됨). cold start []는 fresh-only.
  const incumbents = await input.incumbentsSource({ track, month, client });
  if (incumbents.length > TRACK_SELECT_COUNT[track]) {
    return await abortBeforeSpend(
      input,
      `incumbents_count_exceeded:${incumbents.length}`,
    );
  }
  const candidates = mergeFreshWithIncumbents(fresh, incumbents);
  const incumbentTickers = new Set(incumbents.map((i) => i.ticker));
```
(이하 기존 `candidates` 사용처 — enqueue rows·finalize 인자 — 는 union 결과를 그대로 사용. `bucketOf(c)`는 합성 candidate의 직전 bucket을 반환 → enqueue bucket 정합.)

(c) chunk loop — per-call 컨텍스트(빌더는 claimed에 incumbent 있을 때만 1회):
```typescript
  // W2b — incumbent thesis context (claimed에 incumbent가 있을 때만 1회 빌드, ≤3 query).
  let incumbentContextByTicker: Record<string, string> = {};
  if (jobs.some((j) => incumbentTickers.has(j.ticker))) {
    incumbentContextByTicker = await input.buildIncumbentContexts(incumbents, { client });
  }
```
loop 내 호출부 교체:
```typescript
      const panel = await retryWithBackoff(async () => {
        const financials = await input.fetchFinancials(job.ticker);
        return input.callPersonaPanel({
          ticker: job.ticker,
          financials,
          // W2b — incumbent만 직전 thesis 컨텍스트 주입. 비-incumbent는 undefined(deps default '').
          reflectionContext: incumbentContextByTicker[job.ticker],
        });
      });
```

(d) `finalizeSelection` — incumbents 전달 + delta/removed (시그니처: `finalizeSelection(input, candidates, incumbentTickers)`):
```typescript
  await input.persist(month, track, result.selected, {
    client,
    commentsByTicker: result.commentsByTicker,
    incumbentTickers, // W2b — delta_status hold/new 실계산 (Task 6)
  });
  // W2b (D6) — removed는 행 materialize 불가(트랙 count gate + always-30) → 구조화 로그.
  const selectedSet = new Set(result.selected.map((s) => s.ticker));
  const removed = [...incumbentTickers].filter((t) => !selectedSet.has(t));
  if (removed.length > 0) {
    console.info(
      JSON.stringify({ event: "incumbent_removed", month, periodKey, track, tickers: removed }),
    );
  }
```

- [ ] **Step 4: 통과 확인** — 기존 worker 테스트(트랙/finalize/preflight/deferred 전부) + 신규 7건 PASS. 기존 테스트는 DI 2종 mock 추가(`incumbentsSource: async () => []` 기본) 외 기대값 무변경 = 무회귀 증명.

- [ ] **Step 5: commit**

```bash
git add tudal/src/lib/screening/tier1-selection-batch-worker.ts tudal/src/lib/screening/__tests__/tier1-selection-batch-worker.test.ts
git commit -m "feat(w2b): selection worker incumbent union + per-call thesis context + delta/removed 실계산 (D27 Q5, TDD)"
```

---

## Task 8: selection-worker route DI 배선 (TDD)

**Files:**
- Modify: `tudal/src/app/api/cron/monthly-batch/selection-worker/route.ts:119-152`
- Test: `tudal/src/app/api/cron/monthly-batch/selection-worker/__tests__/route.test.ts` (기존에 추가)

- [ ] **Step 1: 실패 테스트** — route 모듈 mock 경계에서 `runGuardedSelectionChunk` 호출 인자에 `incumbentsSource`/`buildIncumbentContexts` 함수 존재 검증 (기존 route 테스트의 vi.mock 패턴). flag-off/인증/due-gate 무회귀.

- [ ] **Step 2: 실패 확인.**

- [ ] **Step 3: 구현** — import + DI 2줄:
```typescript
import {
  getIncumbents,
  buildIncumbentThesisContexts,
} from "@/lib/data/admin-shortlist-incumbents";
// ... runGuardedSelectionChunk({...
        // W2b (D27 Q5) — incumbent union + per-ticker thesis context (service-role client 경유).
        incumbentsSource: (opts) => getIncumbents(opts),
        buildIncumbentContexts: (incumbents, opts) =>
          buildIncumbentThesisContexts(incumbents, opts),
```

- [ ] **Step 4: 통과 확인** — route 테스트 전부 PASS.

- [ ] **Step 5: commit**

```bash
git add "tudal/src/app/api/cron/monthly-batch/selection-worker/route.ts" "tudal/src/app/api/cron/monthly-batch/selection-worker/__tests__/route.test.ts"
git commit -m "feat(w2b): selection-worker route에 incumbent DI 배선 (getIncumbents + thesis context builder)"
```

---

## Task 9: vercel.json 옛 monthly-batch 스케줄 제거 (W2a follow-up ①)

**Files:**
- Modify: `tudal/vercel.json` (crons 배열에서 `/api/cron/monthly-batch` entry 1개 제거)

> 근거: 67차 배선 교차감사 follow-up ① — PR #90이 옛 단발 경로를 clean 200 no-op stub으로 박제(orchestrator/AI import 0). 스케줄은 무해하나 죽은 cron 호출 노이즈 제거. **route 파일 자체는 보존**(인증 + stub 계약 테스트 유지 — 외부 수동 호출 안전망).

- [ ] **Step 1: vercel.json에서 해당 entry만 제거**

```json
  "crons": [
    { "path": "/api/cron/monthly-batch/report-worker", "schedule": "0 1 * * *" },
    { "path": "/api/cron/monthly-batch/selection-worker", "schedule": "0 2 * * *" },
    { "path": "/api/cron/morning-briefing", "schedule": "0 23 * * *" },
    { "path": "/api/cron/news-sweep", "schedule": "0 0 * * *" },
    { "path": "/api/cron/silent-health", "schedule": "0 15 * * *" }
  ]
```
(functions 블록 무변경. `/api/cron/monthly-batch` 단독 entry만 삭제 — report-worker/selection-worker는 하위 경로 별개 entry.)

- [ ] **Step 2: JSON 유효성 확인**

Run: `cd tudal && node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('OK')"`
Expected: OK.

- [ ] **Step 3: commit**

```bash
git add tudal/vercel.json
git commit -m "chore(w2b): 옛 단발 monthly-batch cron 스케줄 제거 — stub route 보존 (67차 배선감사 follow-up ①)"
```

---

## Task 10: 통합 게이트 + DoD

- [ ] **Step 1: 전체 게이트**

Run: `cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit`
Expected: build 26 routes / lint 0·0 / test:ci 전부 PASS(1703+신규) / tsc clean.

- [ ] **Step 2: 마이그/Reader 무변경 확인**

Run: `git diff --stat main -- tudal/supabase/migrations/ tudal/src/lib/data/admin-shortlist.ts`
Expected: 출력 0 (마이그 0 · RPC 무변경 · getActiveShortList 무변경).

- [ ] **Step 3: grep 가드**

Run: `cd tudal && grep -rn "tier1_candidates_must_be" src/lib | grep -v __tests__`
Expected: 0 (고정 pool 잔재 제거 — range gate로 대체).

Run: `cd tudal && grep -n "delta_status: 'new'" src/lib/data/admin-shortlist-persist.ts`
Expected: 0 (하드코드 잔재 0 — incumbent 분기로 대체).

- [ ] **Step 4: DoD 핵심 테스트 단독 재실행**

Run: `cd tudal && npx vitest run src/lib/screening/__tests__/tier1-selection-batch-worker.test.ts src/lib/data/__tests__/admin-shortlist-incumbents.test.ts src/lib/screening/__tests__/incumbent-merge.test.ts`
Expected: PASS — ① incumbent union enqueue(무심사 탈락 금지) ② per-call context 주입 ③ delta hold/new ④ removed 로그 ⑤ cold-start 무회귀.

- [ ] **Step 5: 최종 commit (잔여)**

```bash
git commit -am "test(w2b): 통합 게이트 GREEN + 마이그/reader 무변경 + grep 가드 0"
```

---

## Self-Review 체크 (작성자 수행)

1. **Spec coverage (HANDOFF :39-42 → Task 매핑):** union+dedupe+expected_total 동적(Task 1,3,7) / 무심사 탈락 금지=enqueue 포함+silent drop 금지(Task 7) / per-ticker thesis context builder(직전 row+section_0+실현성과 graceful)(Task 4,5) / reflectionContext seam per-call 확장(Task 2,3,7,8) / delta_status hold/removed 실계산(Task 6,7 — removed는 D6 로그) / W2a follow-up ①(Task 9).
2. **Placeholder scan:** 전 Task 실제 코드/시그니처/명령 포함. delta_reason null 유지는 YAGNI 명시.
3. **Type consistency:** `IncumbentInfo`(Task 1 SoT) ↔ getIncumbents 반환(Task 4) ↔ worker DI(Task 7). `callPersonaPanel({ticker, financials, reflectionContext?})`(Task 2 adapter = Task 3 persona-eval 타입 = Task 7 worker DI). `incumbentTickers?: ReadonlySet<string>`(Task 6 persist = Task 7 Persist DI). `TRACK_SELECT_COUNT` import 일관.
4. **무회귀 invariant:** step-0 fail-closed / run-mutex+fencing / 순차 for-loop / preflight 순서(R4 HIGH-2) / deferred 게이트 / RPC count gate(10/20) / always-30 + 소비자 가드 / cold-start = W2a 동작 — Task 7 기존 테스트 무변경 통과로 증명.

## 검증 게이트 (DoD)

- `build + lint + test:ci + tsc` ALL GREEN.
- incumbent 무심사 탈락 금지: union enqueue + incumbentsSource 실패 throw 테스트 (Task 7).
- per-ticker context가 incumbent에만 주입 (Task 7).
- delta_status hold/new 실계산 + removed 구조화 로그 (Task 6,7).
- **마이그 0 · 0031 RPC 무변경 · getActiveShortList 무변경** (Task 10 Step 2).
- 실 AI 0 · cost 0 (flag-off + mock — 기존 step-0 fail-closed 무회귀).
- reservation은 job count 기반으로 incumbent 자동 포함 (Task 7 테스트).

## Execution Handoff

§2.0a + 사용자 명시(이번 세션): 본 plan = ① Claude 작성 → ② omxy 검토 → ③ **omxy 수정(direct-edit)** → ④ Claude 검증.
→ impl 단계(① Claude TDD → ② omxy 검토 → ③ omxy direct-edit → ④ Claude 코드근거 검증).
