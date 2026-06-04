# W2a — 주간/월간 선정 트랙 split + rolling composite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 월 1회·150 고정·top10×3=30 단일 선정 엔진을 **단기(short) 주 1회 / 중장기(mid+long) 월 1회 2-트랙**으로 분해하고, short_list_30를 rolling composite(short 주간 갱신 시 mid/long 20 보존)로 만든다.

**Architecture:** 키 모델을 `month` 단일 → 트랙별 `period_key`로 확장하되 **short_list_30 출력 테이블의 `month` 키는 그대로 유지**(short bucket 행만 주간 in-place 교체 = reader 무변경). 선정 job/run 큐(dormant 0031)는 직접 수정해 트랙별 독립 run-mutex 부여. cron은 Vercel Hobby 제약상 daily 단일 route + due-gate(월요일=short / 매월1일=midlong)로 분기.

**Tech Stack:** Next.js 16 (App Router, server actions, route handlers) · Supabase Postgres (SECURITY DEFINER RPC, RLS is_admin) · Vitest · zod.

**SoT:** `Document/Process/HANDOFF.md` ⭐ 65차 MVP 엔진 W2 (:37-57) + D26 Q1 + D27 Q5 + D28 + `model-registry.ts:140-206` W2_TRACK_VOLUME/projectD28MonthlyReservationKrw(350,167≤50만, W2 비용가정 SoT).

---

## 범위 (W2a) vs 분리 (W2b)

**W2a (이 계획):** 트랙 split + rolling composite. **incumbent(D27 Q5) 미포함.** fresh Tier0만으로 short 주간 / midlong 월간 선정 → short_list_30 rolling 30 보존. 끝에서 테스트로 "short 주간 갱신 시 mid/long 20 보존" DoD 관측.

**W2b (다음 별도 계획):** D27 Q5 incumbent thesis 재점검 — fresh Tier0 ∪ incumbents union + dynamic expected_total + per-ticker reflectionContext(thesis context) builder + delta_status hold/removed 실계산. W2a의 트랙 seam 위에 additive.

**근거:** 두 단위는 logically separable하고, W2a 자체가 working/testable 산출(주간/월간 selection + rolling 30). incumbent union은 후보풀/expected_total을 가변으로 만들어 W2a의 고정-count invariant 위에 별도로 얹는 게 리뷰/머지 안전. (writing-plans Scope Check.)

## W2a 범위 밖 (명시적 DEFER)

- **D27 Q5 incumbent 전체** → W2b.
- **tier0 weekly producer 자동화** (Python `--emit-candidates` 주간 실행 + 외부 스케줄러): Q1 "Tier0 단기 후보 50 매주 새로 뽑아"의 *데이터 생산*은 ops/USER 게이트. W2a는 **소비측 트랙 분기 + period_key job 큐**만 구현하고, tier0_candidates는 month-keyed로 두되 short bucket이 주간 갱신(producer가 월중 overwrite)된다는 계약만 전제. 첫 검증은 seeded fixture. (HANDOFF: S1/S2/universe=KRX REST(TS 가능), S3=pykrx(Python)→주간 자동화는 GitHub Actions 등 별도.)
- **실 AI 가동 / cron go-live / 마이그 production apply / Vercel env** = USER 게이트 (CLAUDE.md ⚙️). W2a 코드는 flag-off·mock·cost0로 머지.

## 핵심 설계 결정 (omxy 검증 대상)

- **D1 마이그 전략:** 0031은 **dormant(written-not-applied)** — 착수 시 `mcp__supabase__list_migrations`로 미적용 재확인(read-only, USER-apply 아님) 후 **직접 수정**(rollback 짝 동반). 만약 이미 applied면 신규 0032 강제(가드: Task 0). 0028(tier0)·0002(short_list_30)는 **applied → 무변경**(W2a는 두 테이블 스키마 안 건드림).
- **D2 short_list_30 키 = `month`(YYYY-MM-01) 유지.** short bucket 행만 주간 in-place 교체. ∴ `getActiveShortList`(admin-shortlist.ts:171-204) **무변경** — 단일 month reader가 그대로 정확한 30 반환(숨은 함정 회피). 주간 short 히스토리 미보존은 MVP 허용 tradeoff(track-record/W2b snapshot 별개).
- **D3 period_key 모델:** job/run 큐에만 도입. short = `s:YYYY-MM-DD`(해당 주 KST 월요일) / midlong = `m:YYYY-MM`. 접두사로 트랙 구분 + 서로 다른 period_key ⇒ 트랙별 독립 run-mutex(동시 가동 허용). `track` 컬럼도 명시 저장.
- **D4 rolling writer = bucket-scoped DELETE.** 신규 `upsertShortListTrack(monthYM, track, selected, options)` — DELETE 범위를 `bucket IN (트랙 buckets) AND ticker NOT IN (new)`로 한정 → 타 트랙 행 무손상. count gate 트랙별(short=10 / midlong=20). `upsertShortList30`는 재사용 금지(보존, 단발 경로용으로 잔존하되 W2a 청크 finalize는 신규 writer 사용).
- **D5 cron due-gate(Hobby-safe):** selection-worker daily route 유지(schedule 추가 0). route가 KST 기준 `isShortDue`(월요일)·`isMidlongDue`(1일) 판정 → due 트랙마다 period_key로 `runGuardedSelectionChunk` 호출. 둘 다 due(1일=월요일)면 순차 2회(각 독립 mutex).
- **D6 expected_total = enqueue 실측.** 고정 `=== 150` 하드비교 → **enqueue된 job 행 수**를 SoT로(`run.expected_total` 컬럼 신설). finalize 게이트 = `terminal.length === run.expected_total`. (W2a는 fresh-only라 short=50/midlong=100 고정이지만, W2b incumbent 가변 대비 + DRY.)
- **D7 Tier1ScreeningResultSchema 트랙별 factory.** `makeTier1ScreeningResultSchema(track)` — short: selected=10·shortCount=10·mid/long=0·notSelected=poolSize-10 / midlong: selected=20·mid=10·long=10·short=0·notSelected=poolSize-20. 11개 cross-field refine을 트랙별로 동등 강도 유지(53차 §5 corruption 방어 회귀 금지).

---

## File Structure

**신규 생성:**
- `tudal/src/lib/screening/selection-period.ts` — period_key + due-gate 순수 유틸 (KST).
- `tudal/src/lib/screening/__tests__/selection-period.test.ts`
- `tudal/src/lib/data/__tests__/admin-shortlist-track-persist.test.ts` (rolling writer DoD)

**수정 (트랙 파라미터화):**
- `tudal/supabase/migrations/0031_tier1_selection_worker.sql` + `.rollback.sql` — period_key/track/expected_total.
- `tudal/src/lib/screening/tier1-schema.ts` — `Track` 타입 + `makeTier1ScreeningResultSchema(track)`.
- `tudal/src/lib/screening/persona-eval.ts` — `runTier1Screening` track 파라미터 + 활성 timeframe subset + 트랙 backfill.
- `tudal/src/lib/screening/monthly-batch-orchestrator.ts` — track 전파(단발, 동기 유지).
- `tudal/src/lib/screening/tier1-selection-batch-worker.ts` — EXPECTED_TOTAL→expected_total(enqueue) + period_key/track enqueue/claim/finalize + upsertShortListTrack swap.
- `tudal/src/lib/data/admin-shortlist-persist.ts` — 신규 `upsertShortListTrack` + bucket-scoped DELETE 헬퍼.
- `tudal/src/lib/data/admin-tier0-candidates.ts` — `getTier0Candidates(track, ...)` + 트랙별 assert.
- `tudal/src/app/api/cron/monthly-batch/selection-worker/route.ts` — due-gate + 트랙 루프.
- 동반 테스트: `tier1-screening.test.ts` · `tier1-selection-batch-worker.test.ts` · `monthly-batch-orchestrator.test.ts` · `selection-worker route.test.ts` 트랙 fixture 갱신.

**무변경(D2):** `admin-shortlist.ts`(getActiveShortList) · 0028 · 0002 · 0029 · 홈/포트/리포트헤더/성능 소비자 4 · `vercel.json`(due-gate라 schedule 무변경).

---

## Task 0: 착수 가드 — 0031 미적용 재확인 + 트랙 타입 SoT

**Files:**
- Read-verify: `mcp__supabase__list_migrations` (read-only)
- Modify: `tudal/src/lib/screening/tier1-schema.ts` (Track 타입 export)

- [ ] **Step 1: 0031 dormant 재확인 (read-only, USER-apply 아님)**

`mcp__supabase__list_migrations`로 remote applied 목록 조회. `0031_tier1_selection_worker` 부재 확인.
- 부재(기대) → D1대로 0031 직접 수정 진행.
- **만약 존재** → STOP, 신규 0032로 전환(이 계획의 0031 수정 Task를 0032 ALTER로 재작성) + 사용자 보고.

- [ ] **Step 2: Track 타입 정의**

`tier1-schema.ts` 상단(TIMEFRAMES 선언 부근, :22)에 추가:
```typescript
// W2a — 선정 트랙. short = 단기(주간) / midlong = 중장기(월간, mid+long).
export const SELECTION_TRACKS = ['short', 'midlong'] as const;
export type SelectionTrack = (typeof SELECTION_TRACKS)[number];
// 트랙별 활성 timeframe (bucket) subset.
export const TRACK_TIMEFRAMES: Record<SelectionTrack, readonly Timeframe[]> = {
  short: ['short'],
  midlong: ['mid', 'long'],
};
// 트랙별 selected 목표 수.
export const TRACK_SELECT_COUNT: Record<SelectionTrack, number> = {
  short: 10,
  midlong: 20,
};
// 트랙별 fresh 후보 풀 크기 (W2a fresh-only; W2b는 +incumbent로 가변).
export const TRACK_FRESH_POOL: Record<SelectionTrack, number> = {
  short: 50,
  midlong: 100,
};
```

- [ ] **Step 3: tsc + lint 확인 후 commit**

Run: `cd tudal && npx tsc --noEmit && npm run lint`
Expected: clean (미사용 export 경고 없도록 후속 Task에서 소비).
```bash
git add tudal/src/lib/screening/tier1-schema.ts
git commit -m "feat(w2a): SelectionTrack 타입 SoT + 트랙별 상수 (timeframe subset/select count/fresh pool)"
```

---

## Task 1: period_key + due-gate 순수 유틸 (TDD)

**Files:**
- Create: `tudal/src/lib/screening/selection-period.ts`
- Test: `tudal/src/lib/screening/__tests__/selection-period.test.ts`

설계: 모든 함수는 `Date` 인자를 받는 순수 함수(테스트 결정성). KST = UTC+9 명시 보정.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { describe, it, expect } from 'vitest';
import {
  toKstParts, currentShortPeriodKey, currentMidlongPeriodKey,
  isShortDue, isMidlongDue, monthYMOfPeriod,
} from '../selection-period';

describe('selection-period', () => {
  // 2026-06-04는 목요일(KST). 직전 월요일 = 2026-06-01.
  const thu = new Date('2026-06-04T01:00:00Z'); // KST 10:00 목
  const mon = new Date('2026-06-01T01:00:00Z'); // KST 10:00 월 (= 6월 1일)
  const sun = new Date('2026-06-07T15:30:00Z'); // KST 2026-06-08 00:30 월요일 (UTC+9 날짜 넘김)

  it('short period key = 해당 주 KST 월요일 (s: 접두)', () => {
    expect(currentShortPeriodKey(thu)).toBe('s:2026-06-01');
    expect(currentShortPeriodKey(mon)).toBe('s:2026-06-01');
  });
  it('UTC 저녁이 KST 다음날 월요일로 넘어가는 경계', () => {
    expect(currentShortPeriodKey(sun)).toBe('s:2026-06-08');
    expect(isShortDue(sun)).toBe(true);
  });
  it('midlong period key = m:YYYY-MM (KST)', () => {
    expect(currentMidlongPeriodKey(thu)).toBe('m:2026-06');
  });
  it('isShortDue = KST 월요일만 true', () => {
    expect(isShortDue(mon)).toBe(true);
    expect(isShortDue(thu)).toBe(false);
  });
  it('isMidlongDue = KST 매월 1일만 true', () => {
    expect(isMidlongDue(mon)).toBe(true);   // 6/1
    expect(isMidlongDue(thu)).toBe(false);
  });
  it('monthYMOfPeriod: 두 트랙 모두 short_list_30 month(YYYY-MM) 반환', () => {
    expect(monthYMOfPeriod('s:2026-06-01')).toBe('2026-06');
    expect(monthYMOfPeriod('m:2026-06')).toBe('2026-06');
    expect(monthYMOfPeriod('s:2026-06-29')).toBe('2026-06'); // 월말 주 → 해당 월
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd tudal && npx vitest run src/lib/screening/__tests__/selection-period.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: 구현**

```typescript
// W2a — 선정 트랙 period_key + due-gate. 전부 순수 함수(KST=UTC+9 명시 보정).
import type { SelectionTrack } from './tier1-schema';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface KstParts { y: number; m: number; d: number; dow: number; } // dow 0=일..6=토
export function toKstParts(now: Date): KstParts {
  const k = new Date(now.getTime() + KST_OFFSET_MS);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth() + 1, d: k.getUTCDate(), dow: k.getUTCDay() };
}
function pad(n: number): string { return String(n).padStart(2, '0'); }

/** 해당 시각이 속한 KST 주의 월요일 date(YYYY-MM-DD). */
export function kstMondayOf(now: Date): string {
  const k = new Date(now.getTime() + KST_OFFSET_MS);
  const dow = k.getUTCDay();              // 0=일..6=토
  const deltaToMon = dow === 0 ? -6 : 1 - dow; // 월요일까지 보정
  const mon = new Date(k.getTime() + deltaToMon * 86400000);
  return `${mon.getUTCFullYear()}-${pad(mon.getUTCMonth() + 1)}-${pad(mon.getUTCDate())}`;
}

export function currentShortPeriodKey(now: Date): string { return `s:${kstMondayOf(now)}`; }
export function currentMidlongPeriodKey(now: Date): string {
  const { y, m } = toKstParts(now);
  return `m:${y}-${pad(m)}`;
}
export function isShortDue(now: Date): boolean { return toKstParts(now).dow === 1; }   // 월요일
export function isMidlongDue(now: Date): boolean { return toKstParts(now).d === 1; }    // 매월 1일

/** period_key → short_list_30.month 용 YYYY-MM (short는 월요일이 속한 달). */
export function monthYMOfPeriod(periodKey: string): string {
  const body = periodKey.slice(2); // 's:' | 'm:' 제거
  return body.slice(0, 7);         // YYYY-MM-DD → YYYY-MM, YYYY-MM → 그대로
}

export function trackOfPeriod(periodKey: string): SelectionTrack {
  return periodKey.startsWith('s:') ? 'short' : 'midlong';
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd tudal && npx vitest run src/lib/screening/__tests__/selection-period.test.ts`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add tudal/src/lib/screening/selection-period.ts tudal/src/lib/screening/__tests__/selection-period.test.ts
git commit -m "feat(w2a): selection-period 유틸 — period_key(s:월요일/m:YYYY-MM) + KST due-gate (TDD)"
```

---

## Task 2: Tier1ScreeningResultSchema 트랙별 factory (TDD)

**Files:**
- Modify: `tudal/src/lib/screening/tier1-schema.ts:216-321` (Tier1ScreeningResultSchema)
- Test: `tudal/src/lib/screening/__tests__/tier1-schema.test.ts` (신규 또는 기존에 추가)

핵심: 기존 `Tier1ScreeningResultSchema`(selected=30/notSelected=120/short=mid=long=10)를 **`makeTier1ScreeningResultSchema(track, poolSize)` factory**로 교체. 11개 cross-field refine을 트랙별로 동등 강도 유지.

- [ ] **Step 1: 실패 테스트 작성**

short 트랙: selected=10(전부 bucket short), mid/long count=0, notSelected=poolSize-10. midlong: selected=20(mid10+long10), short count=0, notSelected=poolSize-20. 각 트랙에서 count 위반(예: short selected=9, midlong mid=11) → parse throw. 기존 disjoint/unique/assigned-metadata refine 유지 검증.

```typescript
import { makeTier1ScreeningResultSchema } from '../tier1-schema';
// fixtures: makeAgg(ticker, tf) 헬퍼로 selected/notSelected 구성 (기존 tier1-screening.test.ts makeCandidates 패턴 차용)
it('short 트랙: selected 10 + short 10 통과', () => {
  const ok = makeTier1ScreeningResultSchema('short', 50).safeParse(shortResult10);
  expect(ok.success).toBe(true);
});
it('short 트랙: selected 9 → fail', () => {
  expect(makeTier1ScreeningResultSchema('short', 50).safeParse(shortResult9).success).toBe(false);
});
it('midlong: mid10+long10=20 통과 / mid11 fail', () => {
  expect(makeTier1ScreeningResultSchema('midlong', 100).safeParse(mlResult).success).toBe(true);
  expect(makeTier1ScreeningResultSchema('midlong', 100).safeParse(mlResultMid11).success).toBe(false);
});
```

- [ ] **Step 2: 실패 확인** — Run vitest, FAIL(factory 미정의).

- [ ] **Step 3: 구현**

`tier1-schema.ts`에서 기존 단일 스키마를 factory로. 시그니처/refine 골격:
```typescript
export function makeTier1ScreeningResultSchema(track: SelectionTrack, poolSize: number) {
  const selectCount = TRACK_SELECT_COUNT[track];          // short 10 / midlong 20
  const activeTfs = TRACK_TIMEFRAMES[track];              // ['short'] / ['mid','long']
  const perTf = 10;
  return baseShape
    .refine(v => v.selected.length === selectCount, `selected_must_be_${selectCount}`)
    .refine(v => v.notSelected.length === poolSize - selectCount, 'notSelected_count_mismatch')
    .refine(v => activeTfs.every(tf => v.selected.filter(s => s.assigned_timeframe === tf).length === perTf),
            'per_active_timeframe_must_be_10')
    .refine(v => v.selected.filter(s => !activeTfs.includes(s.assigned_timeframe)).length === 0,
            'no_inactive_timeframe_in_selected')
    // 기존 disjoint(selected∩notSelected=∅) / unique ticker / selectionMeta count==assigned 실분포 / backfill 매칭 refine 유지
    ;
}
// 하위호환: 기존 호출부가 남아있다면 임시 alias (Task 4 이후 제거)
```
notSelected가 가변(poolSize 인자)인 점, selectionMeta(shortCount/midCount/longCount)도 트랙 활성 tf만 검사하도록 갱신.

- [ ] **Step 4: 통과 확인** — Run vitest, PASS.

- [ ] **Step 5: commit**
```bash
git add tudal/src/lib/screening/tier1-schema.ts tudal/src/lib/screening/__tests__/tier1-schema.test.ts
git commit -m "feat(w2a): makeTier1ScreeningResultSchema(track, poolSize) — 트랙별 count refine 동등 강도 (TDD)"
```

---

## Task 3: runTier1Screening 트랙 파라미터화 (TDD)

**Files:**
- Modify: `tudal/src/lib/screening/persona-eval.ts:286-308`(RunTier1ScreeningInput) + `:411-625`(runTier1Screening)
- Test: `tudal/src/lib/screening/__tests__/tier1-screening.test.ts` (makeCandidates를 트랙별로 split)

- [ ] **Step 1: 실패 테스트** — `runTier1Screening({track:'short', candidates: 50개 bucket=short, ...})` → selected 10(전부 short). `{track:'midlong', candidates: 100개 bucket∈{mid,long}, ...}` → selected 20(mid10+long10). short 트랙에 mid candidate 섞이면 무시/에러. 후보 수 != 트랙 pool → throw.

- [ ] **Step 2: 실패 확인.**

- [ ] **Step 3: 구현**
- `RunTier1ScreeningInput`에 `track: SelectionTrack` 추가.
- `:414` `length !== 150` → `length !== TRACK_FRESH_POOL[track]`(W2a) — 단, W2b 가변 대비 주석: "expected는 caller가 enqueue 수로 보장; 여기선 distinct + 비음수만 강하게, count는 schema가 최종 검증". distinct-ticker assert(:418) 유지.
- `:556-603` step4-6: `TIMEFRAMES` 전체 루프 → `TRACK_TIMEFRAMES[track]`만. `slice(0,10)` 유지(트랙 활성 tf만). backfill `needed=10-len`은 **트랙 활성 tf의 global unselected pool 내에서만**(cross-track 차용 금지 — short 트랙은 short 후보만).
- 반환 `.parse` → `makeTier1ScreeningResultSchema(track, candidates.length).parse(...)`.
- short 트랙 단일 timeframe: `primary_timeframe`/`assigned_by`(primary/backfill) 개념 유지하되 단일 tf라 argmax=short 자명. assigned_timeframe='short' 전부.

- [ ] **Step 4: 통과 확인.**

- [ ] **Step 5: commit**
```bash
git add tudal/src/lib/screening/persona-eval.ts tudal/src/lib/screening/__tests__/tier1-screening.test.ts
git commit -m "feat(w2a): runTier1Screening track 파라미터 — 활성 timeframe subset + 트랙 내 backfill (TDD)"
```

---

## Task 4: monthly-batch-orchestrator 트랙 전파 (단발, 동기 유지) (TDD)

**Files:**
- Modify: `tudal/src/lib/screening/monthly-batch-orchestrator.ts:81-179` (:89-93 150 throw, :117-122 completedPanels)
- Test: `tudal/src/lib/screening/__tests__/monthly-batch-orchestrator.test.ts:115`

- [ ] **Step 1: 실패 테스트** — orchestrator에 track 인자 → candidates 길이 게이트가 `TRACK_FRESH_POOL[track]`, runTier1Screening에 track 전파.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — `:89-93` 150 리터럴 → 트랙값. `:103-109` runTier1Screening 호출에 `track` 추가. `:117-122` completedPanels는 이미 candidates.length 기준이라 OK. persist는 Task 6에서 트랙 writer로 swap(여기선 시그니처만 정합). 단발 경로는 NON-VIABLE이나 코드/테스트 동기.
- [ ] **Step 4: 통과 확인.**
- [ ] **Step 5: commit**
```bash
git commit -am "feat(w2a): monthly-batch-orchestrator track 전파 (단발 동기 유지, TDD)"
```

---

## Task 5: 마이그 0031 직접 수정 — period_key/track/expected_total (dormant)

**Files:**
- Modify: `tudal/supabase/migrations/0031_tier1_selection_worker.sql` + `0031_tier1_selection_worker.rollback.sql`

> **사전조건:** Task 0 Step 1에서 0031 미적용 확인 완료. **마이그 production apply는 USER 게이트** — 본 Task는 파일 작성만(머지 후 USER가 apply).

- [ ] **Step 1: tier1_selection_job 키 변경**
- `month text check ^YYYY-MM$` → 유지 + 신규 `period_key text not null check (period_key ~ '^[sm]:')` + `track text not null check (track in ('short','midlong'))`.
- `unique (month, ticker)` → `unique (period_key, ticker)`.
- 인덱스 `(month, status)` → `(period_key, status)`.

- [ ] **Step 2: tier1_selection_run 키 변경 (트랙별 독립 mutex)**
- `month text primary key` → `period_key text primary key check (period_key ~ '^[sm]:')` + `track text not null` + `month text not null`(short_list_30 month 파생 보관) + 신규 `expected_total int`(D6 enqueue 실측 SoT, nullable→enqueue 후 set).

- [ ] **Step 3: 4 RPC 시그니처 period_key화**
- `claim_next_selection_jobs(p_period_key text, p_limit int)` — month regex → period_key regex, where `period_key = p_period_key`. SECURITY DEFINER + `set search_path=public,pg_temp` + **revoke public/anon + grant authenticated/service_role 명시 재선언**(0027 Kepler B2: CREATE OR REPLACE는 과거 grant 보존 안 됨).
- `mark_selection_job(p_id uuid, ...)` — 변경 없음(id 기준), grant 재선언만.
- `acquire_selection_worker_lock(p_period_key text, p_track text, p_month text, p_expected_total int) returns uuid` — ON CONFLICT (period_key) DO UPDATE, finalized_at null + (status<>'running' or claimed_at<15min) 가드. INSERT 시 track/month/expected_total 기록.
- `release_selection_worker_lock(p_period_key text, p_run_id uuid, p_status text)` — run_id fencing.
- `mark_selection_finalized`(존재 시) period_key화.

- [ ] **Step 4: rollback.sql 동반 갱신** — 정확히 역연산(drop 신규 컬럼/인덱스, RPC 원형 복원).

- [ ] **Step 5: SQL lint(수동) + grep 가드**

Run: `cd tudal && grep -n "p_month\|primary key (month)\|unique (month, ticker)" supabase/migrations/0031_tier1_selection_worker.sql`
Expected: 0 매치(전부 period_key로 전환). + `grep -c "grant " 0031...sql`로 4 RPC grant 재선언 확인.

- [ ] **Step 6: commit**
```bash
git add tudal/supabase/migrations/0031_tier1_selection_worker.sql tudal/supabase/migrations/0031_tier1_selection_worker.rollback.sql
git commit -m "feat(w2a): 마이그 0031 period_key/track/expected_total 재구성 — 트랙별 독립 run-mutex (dormant, apply=USER)"
```

---

## Task 6: rolling composite writer — upsertShortListTrack (TDD, DoD 핵심)

**Files:**
- Modify: `tudal/src/lib/data/admin-shortlist-persist.ts` (신규 export, upsertShortList30 보존)
- Test: `tudal/src/lib/data/__tests__/admin-shortlist-track-persist.test.ts`

- [ ] **Step 1: 실패 테스트 (DoD 관측)**

mock Supabase client(SelectChain/UpdateChain/QueryResult 인터페이스 — feedback_test_mock_typing 준수, any 금지)로:
1. `upsertShortListTrack('2026-06','midlong', 20개 mid/long, {client})` → DELETE filter가 `bucket in (mid,long)` + upsert 20.
2. 이어 `upsertShortListTrack('2026-06','short', 10개 short, {client})` → **DELETE filter가 `bucket in (short)`만** (mid/long 미포함 검증) + upsert 10.
3. short selected=9 → throw `shortlist_track_count_mismatch`. midlong=19 → throw.
4. ticker 형식 위반 → throw(TICKER_RE carry). degraded ticker comment 없음 → null.

```typescript
it('short 갱신 DELETE는 bucket=short만 (mid/long 보존 DoD)', async () => {
  await upsertShortListTrack('2026-06', 'short', tenShort, { client });
  expect(deleteSpy.inFilter).toEqual({ column: 'bucket', values: ['short'] });
  expect(deleteSpy.notInTickers).toEqual(tenShort.map(a => a.ticker));
});
```

- [ ] **Step 2: 실패 확인.**

- [ ] **Step 3: 구현**

기존 `upsertShortList30`의 row-building/메타 lookup 로직을 공유 헬퍼로 추출하되 **DELETE 범위만 트랙화**:
```typescript
const TRACK_BUCKETS: Record<SelectionTrack, readonly Bucket[]> = {
  short: ['short'], midlong: ['mid', 'long'],
};
export async function upsertShortListTrack(
  monthYM: string, track: SelectionTrack,
  selected: readonly TickerAggregate[],
  options: { client?: SupabaseClient; commentsByTicker?: TickerCommentMap } = {},
): Promise<void> {
  const expected = TRACK_SELECT_COUNT[track];
  if (selected.length !== expected) {
    throw new Error(`shortlist_track_count_mismatch:${track}:${selected.length}!=${expected}`);
  }
  // selected가 트랙 활성 bucket만 포함하는지 검증 (cross-track 오염 차단)
  // rows 빌드(기존 byTf/rank/AI컬럼/메타lookup 재사용) — month=YYYY-MM-01 유지(D2)
  // ⚠ DELETE: bucket-scoped
  const buckets = TRACK_BUCKETS[track];
  const { error: delErr } = await supabase.from('short_list_30').delete()
    .eq('month', monthDate).in('bucket', buckets as string[])
    .not('ticker', 'in', `(${newTickers.map(t => `"${t}"`).join(',')})`);
  // ... upsert onConflict 'month,ticker'
}
```
공통화: `buildShortListRows`/메타 lookup을 private 헬퍼로 뽑아 `upsertShortList30`(전체 30, month-wide DELETE 유지)와 `upsertShortListTrack`(트랙, bucket-scoped DELETE) 둘 다 사용. upsertShortList30은 단발 경로(monthly-batch/route.ts)용으로 보존.

- [ ] **Step 4: 통과 확인** — Run vitest, PASS. DoD 테스트(short 갱신이 mid/long DELETE 안 함) green.

- [ ] **Step 5: commit**
```bash
git add tudal/src/lib/data/admin-shortlist-persist.ts tudal/src/lib/data/__tests__/admin-shortlist-track-persist.test.ts
git commit -m "feat(w2a): upsertShortListTrack rolling writer — bucket-scoped DELETE로 mid/long 20 보존 (DoD, TDD)"
```

---

## Task 7: getTier0Candidates 트랙 파라미터화 (TDD)

**Files:**
- Modify: `tudal/src/lib/data/admin-tier0-candidates.ts:20-21,63-153`
- Test: `tudal/src/lib/data/__tests__/admin-tier0-candidates.test.ts`

- [ ] **Step 1: 실패 테스트** — `getTier0Candidates({track:'short', month, client})` → bucket='short' 50 + assert(50, rank 1..50). `{track:'midlong'}` → bucket in (mid,long) 100 + assert(mid 50/long 50). 잘못된 count → 트랙별 throw.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — `getTier0Candidates`에 track 인자. SELECT에 `.in('bucket', TRACK_BUCKETS[track])`. `assertTier0CandidateRows`를 트랙별(short: 50/rank1..50 / midlong: 100=mid50+long50/각 rank1..50)로 분기. 상수 EXPECTED_TOTAL_CANDIDATES(150) 제거, 트랙 유도. month는 monthYMOfPeriod로 받은 YYYY-MM(기존 YYYY-MM-01 변환 유지).
- [ ] **Step 4: 통과 확인.**
- [ ] **Step 5: commit**
```bash
git commit -am "feat(w2a): getTier0Candidates track 파라미터 + 트랙별 assert(short50/midlong100) (TDD)"
```

---

## Task 8: tier1-selection-batch-worker 트랙/period_key 재구성 (TDD)

**Files:**
- Modify: `tudal/src/lib/screening/tier1-selection-batch-worker.ts:39-42,277-566`
- Test: `tudal/src/lib/screening/__tests__/tier1-selection-batch-worker.test.ts`

가장 큰 변경면. step-0 fail-closed / run-mutex / 순차 for-loop / preflight 비용가드는 **무회귀 유지**.

- [ ] **Step 1: 실패 테스트** — 워커 input에 `{track, periodKey, month}` 추가. enqueue가 period_key/track 기록. claim이 p_period_key 사용. countOpenJobs가 period_key 필터. finalize 게이트 = `terminal.length === run.expected_total`(enqueue 실측). finalize가 `runScreening({track})` 후 `upsertShortListTrack(month, track, selected)`. short 트랙: 50 enqueue → 10 selected → short bucket persist. preflight callCount = openJobs(period_key) × 11.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현**
- `:41 EXPECTED_TOTAL=150` 제거 → input.expectedTotal(enqueue 후 run row에 기록, D6). `:322-327` candidates count abort → `getTier0Candidates(track)` 반환 길이 = TRACK_FRESH_POOL[track] 검증.
- enqueue(:329-342): rows에 `period_key, track` 추가, onConflict `period_key,ticker`. acquire 시 expected_total=enqueueCount 전달.
- claim(:345): `claim_next_selection_jobs(periodKey, chunkSize)`.
- countOpenJobs(:258-271): `.eq('period_key', periodKey)`.
- preflight(:356-375): callCount = openJobs(periodKey) × 11 × `getRoleMaxCostPerCallKrw('tier1_panel')`(W0 무회귀).
- finalize(:515-566): select where period_key; `terminal.length === run.expected_total` 게이트; `runScreening({candidates, track, ...replay})`; persist = `upsertShortListTrack(month, track, selected, {client, commentsByTicker})`; markFinalized(period_key).
- runGuardedSelectionChunk(:575): `acquire_selection_worker_lock(periodKey, track, month, expectedTotal)`.
- step-0(:285-302) + 순차 for-loop(:412) + systemic abort + per-ticker 실패 console.error 전부 유지.
- [ ] **Step 4: 통과 확인** — 기존 테스트 트랙 fixture로 갱신, 전부 PASS.
- [ ] **Step 5: commit**
```bash
git commit -am "feat(w2a): selection-batch-worker period_key/track + expected_total(enqueue 실측) + upsertShortListTrack finalize (TDD)"
```

---

## Task 9: selection-worker route due-gate + 트랙 루프 (TDD)

**Files:**
- Modify: `tudal/src/app/api/cron/monthly-batch/selection-worker/route.ts:46-99`
- Test: `tudal/src/app/api/cron/monthly-batch/selection-worker/__tests__/route.test.ts`

- [ ] **Step 1: 실패 테스트** (Date 주입 가능하게 — `now` seam 또는 테스트용 헬퍼)
- 월요일(KST) → short 트랙 runGuardedSelectionChunk(periodKey=`s:...`) 호출.
- 1일(KST) → midlong 트랙 호출.
- 1일이면서 월요일 → 둘 다 순차 호출(독립 period_key).
- 둘 다 not due → 200 no-op(claimed 0).
- `SELECTION_CRON_AUTO_ENABLED!=='true'` → 200 skip(기존 게이트 무회귀).
- 인증(CRON_SECRET) 무회귀.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현**
- `currentMonthYM()` 단일 → `now=new Date()` 기준 due 트랙 배열 구성:
```typescript
const now = new Date();
const dueTracks: { track: SelectionTrack; periodKey: string; month: string }[] = [];
if (isShortDue(now))   dueTracks.push({ track:'short',   periodKey: currentShortPeriodKey(now),   month: monthYMOfPeriod(currentShortPeriodKey(now)) });
if (isMidlongDue(now)) dueTracks.push({ track:'midlong', periodKey: currentMidlongPeriodKey(now), month: monthYMOfPeriod(currentMidlongPeriodKey(now)) });
```
- 각 due 트랙에 대해 `runGuardedSelectionChunk({ periodKey, track, month, tier0Source: (o)=>getTier0Candidates({track, month: o.month, client}), persist: upsertShortListTrack, runScreening: runTier1Screening, reflectionContext:'' /* W2b */, ... })` 순차 호출.
- self-continue(:119)는 due 트랙 중 forward-progress 있으면 유지.
- flag-off/인증/dormant 무회귀.
- [ ] **Step 4: 통과 확인.**
- [ ] **Step 5: commit**
```bash
git commit -am "feat(w2a): selection-worker route KST due-gate(월=short/1일=midlong) + 트랙별 청크 호출 (TDD)"
```

---

## Task 10: 통합 검증 + 잔여 소비자 정합 + 게이트

**Files:**
- Modify: 필요 시 `monthly-batch/route.ts`(단발 경로) 트랙 호출 정합 / 잔여 호출부.

- [ ] **Step 1: 전체 게이트**

Run: `cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit`
Expected: build 26 routes / lint 0·0 / test:ci 전부 PASS(트랙 fixture 갱신분 포함) / tsc clean.

- [ ] **Step 2: grep 가드 (월단일 잔재 0)**

Run:
```bash
cd tudal && grep -rn "!== 150\|=== 150\|EXPECTED_TOTAL = 150\|tier1_candidates_must_be_150" src/lib/screening src/lib/data
```
Expected: 0 (전부 트랙/expected_total 유도) — 단발 orchestrator 포함. legacy 잔존 의도 시 주석 allowlist.

- [ ] **Step 3: getActiveShortList 무변경 확인 (D2)**

Run: `cd tudal && git diff --stat src/lib/data/admin-shortlist.ts`
Expected: 변경 0 (rolling composite는 writer-side만, reader 무변경).

- [ ] **Step 4: DoD 재확인** — `admin-shortlist-track-persist.test.ts`의 "short 주간 갱신 시 mid/long 20 보존" 테스트가 통과하는지 단독 실행.

- [ ] **Step 5: 최종 commit (잔여)**
```bash
git commit -am "test(w2a): 통합 게이트 GREEN + 월단일 잔재 grep 0 + getActiveShortList 무변경 검증"
```

---

## Self-Review 체크 (작성자 수행)

1. **Spec coverage:** W2 HANDOFF :37-42 각 항목 → Task 매핑: 2트랙 split(Task 3,8) / 마이그 period_key(Task 5) / tier0 트랙(Task 7) / rolling writer mid·long 보존(Task 6 DoD) / cron 주간 추가(Task 9 due-gate). D27 Q5 incumbent = **W2b로 명시 분리**(범위 밖).
2. **Placeholder scan:** 각 Task에 실제 코드/시그니처/grep 명령 포함. 미정 항목(incumbent)은 범위 밖으로 명시.
3. **Type consistency:** `SelectionTrack`('short'|'midlong'), `TRACK_SELECT_COUNT`(10/20), `TRACK_FRESH_POOL`(50/100), `period_key`('s:YYYY-MM-DD'|'m:YYYY-MM') 전 Task 일관.
4. **무회귀 invariant:** step-0 fail-closed / run-mutex+fencing / 순차 for-loop / preflightHardcap+model-aware reservation(W0) / 인증 / dormant default-off / RLS service-role DI / Tier1 corruption refine(트랙별 동등) — Task별 명시.

## 검증 게이트 (DoD)

- `build + lint + test:ci + tsc` ALL GREEN.
- DoD 테스트: short 주간 갱신 시 mid/long 20 보존 (Task 6).
- `getActiveShortList` 무변경 (Task 10 Step 3).
- 월단일 150 잔재 grep 0 (Task 10 Step 2).
- 마이그 0031 grep: p_month/month-PK/unique(month,ticker) 0 (Task 5 Step 5).
- **마이그 production apply = USER 게이트** (머지 후 별도). 실 AI/cron go-live = USER 게이트.

## Execution Handoff

§2.0a 적용: 본 plan = ① Claude 작성 완료 → ② omxy catch-only 검토 → ③ Claude fix → impl 단계(①Claude Workflow/TDD ②omxy 검토 ③omxy 수정 ④Claude 검증 ⑤Claude 수정).
