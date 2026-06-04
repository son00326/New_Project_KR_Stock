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

## 핵심 설계 결정 (omxy R1 CONTINUE 6-catch 반영 = R2 검증 대상)

- **D1 마이그 전략:** 0031은 **dormant(written-not-applied)** — 착수 시 `mcp__supabase__list_migrations`로 미적용 재확인(read-only, USER-apply 아님) 후 **직접 수정(=전면 재작성)**. 0028(tier0)·0002(short_list_30)는 **applied → 스키마 무변경**(W2a는 두 테이블 컬럼 안 건드림; 단 short_list_30용 신규 RPC는 0031에 추가 — 기존 테이블 참조는 later migration에서 정상). 만약 0031이 이미 applied면 신규 0032 강제(가드: Task 0). **(omxy R1 LOW-6)** 0031을 dormant 재작성하므로 `0031_*.rollback.sql` = **재작성본의 full-drop inverse**(drop job/run 테이블 + 신규 RPC 전부) — ALTER식 "신규 컬럼만 drop/원형 복원" 금지.
- **D2 short_list_30 키 = `month`(YYYY-MM-01) 유지 + 항상 30행 materialize.** short bucket 행만 주간 in-place 교체. ∴ `getActiveShortList`(admin-shortlist.ts:171-204) **무변경** — 단일 month reader가 그대로 정확한 30 반환. **(omxy R1 HIGH-2 보강 → D8 carry-forward로 "모든 월이 1일부터 30행 보유" 보장.)** 주간 short 히스토리 미보존은 MVP 허용 tradeoff.
- **D3 period_key 모델:** job/run 큐에만 도입. short = `s:YYYY-MM-DD`(해당 주 KST 월요일) / midlong = `m:YYYY-MM`. `track` 컬럼 명시 저장. **(omxy R1 MED-5)** CHECK는 **exact regex + track↔prefix 일치 강제**: `(track='short' AND period_key ~ '^s:\d{4}-\d{2}-\d{2}$') OR (track='midlong' AND period_key ~ '^m:\d{4}-\d{2}$')`. 서로 다른 period_key ⇒ 트랙별 독립 run-mutex(동시 가동 허용).
- **D4 rolling writer = 원자적 RPC (내부 guard + 내부 검증 + midlong carry fold).** 클라이언트측 DELETE-then-UPSERT(비원자) 폐기. 신규 SECURITY DEFINER RPC `replace_shortlist_track(p_month date, p_track text, p_rows jsonb)`가 **단일 트랜잭션**에서:
  - **(R2 HIGH-1)** 첫줄 내부 authz guard: `if auth.role()='service_role' then null; elsif public.is_admin() then null; else raise exception 'not_authorized'; end if;` (grant만으론 RLS 우회 미방지 — [[feedback_rls_cost_select_isadmin_gate]]).
  - **(R2 MED-4)** p_rows 내부 검증(직접호출 우회 방어): jsonb_array_length = `TRACK_SELECT_COUNT[track]`(short10/midlong20) / 모든 row bucket ∈ 트랙 buckets / ticker `~ '^\d{6}$'` / distinct ticker / rank 범위 — 위반 시 raise.
  - (R1 MED-4) cross-bucket overlap fail-closed: 신규 ticker가 **동일 month의 다른 bucket**에 존재(`s.month=p_month AND s.bucket <> 트랙 buckets`) → `shortlist_track_cross_bucket_overlap` raise.
  - **(R3 HIGH-3 — stale created_at 방지)** atomic = **DELETE-all-track + INSERT(fresh `created_at=now()`)**: `delete from short_list_30 where month=p_month AND bucket=any(트랙 buckets)`(트랙 전행 삭제) + `insert ...`(on-conflict-do-update 폐기 — 트랙 전행을 매 write마다 새로 INSERT하여 생존 ticker도 created_at 갱신). 단일 트랜잭션이라 부분상태 미관측. ⇒ 주간 short refresh 시 생존 ticker의 stale created_at이 portfolio accept 쿨다운(gating.ts createdAt)을 우회하던 결함 제거.
  - **(R2 HIGH-2)** p_track='midlong'이면 **동일 트랜잭션 내부**에서 carry 수행(아래 D8) — 별도 RPC 2회 호출 금지(사이 crash 시 20행 잔존 방지).
  - **(R3 MED-4)** INSERT 컬럼 매핑 = short_list_30 전 컬럼 **0002+0012+0020+0029** (0020 = `assigned_by`/`prompt_version_id`/`personas_version_id` NOT NULL 포함 — 누락 금지).
  count gate는 RPC가 SoT(TS writer는 보조 선검증). `upsertShortList30`(단발 경로용) 보존, W2a 청크 finalize는 신규 RPC writer 사용.
- **D5 cron due-gate(Hobby-safe):** selection-worker daily route 유지(schedule 추가 0). route가 KST 기준 `isShortDue`(월요일)·`isMidlongDue`(1일) 판정 → due 트랙마다 period_key로 `runGuardedSelectionChunk` 호출. 둘 다 due(1일=월요일)면 순차 2회(각 독립 mutex).
- **D6 finalize 게이트 = job count + deferred 차단 + deferred 재개(deadlock 해소).** (R1 HIGH-3) acquire 시점엔 enqueue 수 미상 → `run.expected_total`/acquire 인자 **신설 안 함**. (R2 MED-6) finalize 트리거 = `countNonTerminal(pending+running+deferred)===0 AND countTerminal(done+failed)>0` — deferred는 finalize 차단(degraded 조기 finalize 방지). **(R3 HIGH-1 deadlock + R4 HIGH-2 attempts-strand 해소)** deferred는 claim이 재개 안 해 영구 stuck 가능 → **preflightHardcap을 claim/reset 前에 먼저 실행**(reservation=`(openJobs+deferred)×11`). preflight **pass 시에만** `deferred → pending` 리셋(attempts 보존) 후 claim → 처리. preflight **fail(예산 초과)** → 즉시 aborted return(claim·reset 안 함 = **attempts 미소진**, deferred 유지, spend 0). 예산 회복(월 reset) 시 reset→처리→finalize. **budget-exhausted period가 그 주/달 finalize 안 되는 것은 cost guard 의도된 동작**(트랙별 독립 mutex라 타 period 미차단; stale period_key는 다음 주기에서 새 period로 진행 — MVP 허용). per-ticker 실패='failed'(terminal)→⚪. 최종 count 정합은 schema(D7).
- **D7 Tier1ScreeningResultSchema 트랙별 factory.** `makeTier1ScreeningResultSchema(track, poolSize)` — short: selected=10·shortCount=10·mid/long=0·notSelected=poolSize-10 / midlong: selected=20·mid=10·long=10·short=0·notSelected=poolSize-20. 11개 cross-field refine을 트랙별로 동등 강도 유지(53차 §5 corruption 방어 회귀 금지).
- **D8 월초 carry-forward + "always 30" 확정 (R1 HIGH-2 + R2 H2/M5 + R3 H2).** 월초(1일≠월요일)에 midlong이 새 월 `m:M`을 쓰면 그 주 short period는 직전 월이라 month M에 short 0 → 30 미달. **fix:** carry를 `replace_shortlist_track`의 **midlong 트랜잭션 내부**(`perform carry_short_into_month(p_month)`)에서 수행: month M에 short 부재 시 직전(`max(month<M) where bucket='short'`)의 short 중 month M에 미존재인 ticker만 short로 INSERT(`delta_status='hold'`, `created_at=now()`, rank 보존). 다음 월요일 short run이 in-place refresh.
  - **(R3 HIGH-2 — R2 push-back 철회)** 이전 "<30은 harmless(소비자 clean-abort)" 근거는 **unsound**(omxy 반박): report-worker route는 `!==30` 시 **502 반환**(clean success 아님) + portfolio accept는 빈 리스트만 거부해 **<30이 snapshot에 진입**. ∴ **"always 30"을 invariant로 확정**: ① steady-state = midlong write가 carry로 short 보장 → 항상 30 ② cold-start = **부트스트랩 순서 = short 먼저 → midlong**(go-live USER 1회, 문서화)로 30 보장 ③ 그래도 남는 일시 <30(운영자 순서 오류 등)은 **소비자 가드(Task 9.5)**로 안전: portfolio accept가 `shortlist.length<30` 거부(빈 리스트만 X) + report-worker route가 `!==30`을 **clean skip(200 not-ready)** 로(502 false-alarm 제거). carry는 best-effort(졸업 ticker 제외) + per-track 정합만 RPC가 보장(cross-track total은 소비자 가드가 최종 방어).

---

## File Structure

**신규 생성:**
- `tudal/src/lib/screening/selection-period.ts` — period_key + due-gate 순수 유틸 (KST).
- `tudal/src/lib/screening/__tests__/selection-period.test.ts`
- `tudal/src/lib/data/__tests__/admin-shortlist-track-persist.test.ts` (rolling writer DoD)

**수정 (트랙 파라미터화):**
- `tudal/supabase/migrations/0031_tier1_selection_worker.sql` + `.rollback.sql` — period_key/track + 원자적 `replace_shortlist_track`/`carry_short_into_month` RPC.
- `tudal/src/lib/report/full-report-batch-worker.ts` + `tudal/src/app/api/cron/monthly-batch/report-worker/route.ts` + `tudal/src/app/(admin)/admin/portfolio/actions.ts` + `tudal/src/lib/portfolio/gating.ts` — <30 소비자 가드 + per-ticker 쿨다운(Task 9.5).
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

## Task 5: 마이그 0031 직접 재작성 — period_key/track + 원자적 shortlist RPC (dormant)

**Files:**
- Modify (전면 재작성): `tudal/supabase/migrations/0031_tier1_selection_worker.sql` + `0031_tier1_selection_worker.rollback.sql`

> **사전조건:** Task 0 Step 1에서 0031 미적용 확인 완료. **마이그 production apply는 USER 게이트** — 본 Task는 파일 작성만(머지 후 USER가 apply). **(D1)** 0031은 dormant라 직접 재작성.

- [ ] **Step 1: tier1_selection_job 키 변경 (period_key/track, MED-5 exact CHECK)**
- 컬럼: `month text not null` 유지(short_list_30 month 파생) + 신규 `period_key text not null` + `track text not null check (track in ('short','midlong'))`.
- **track↔prefix 일치 CHECK** (D3/MED-5):
  ```sql
  constraint tier1_selection_job_period_key_track_chk check (
    (track = 'short'   and period_key ~ '^s:\d{4}-\d{2}-\d{2}$') or
    (track = 'midlong' and period_key ~ '^m:\d{4}-\d{2}$')
  )
  ```
- `unique (month, ticker)` → `unique (period_key, ticker)`. 인덱스 `(month, status)` → `(period_key, status)`.

- [ ] **Step 2: tier1_selection_run 키 변경 (트랙별 독립 mutex, expected_total 컬럼 신설 안 함)**
- `month text primary key` → `period_key text primary key` + `track text not null` + `month text not null` + 위와 동일한 track↔prefix CHECK.
- **(D6/HIGH-3)** `expected_total` 컬럼 **신설하지 않음** — finalize는 job count로 판정.

- [ ] **Step 3: 선정 job RPC 4종 period_key화 (grant 재선언 필수)**
- `claim_next_selection_jobs(p_period_key text, p_limit int)` — month regex → `p_period_key ~ '^[sm]:'` + where `period_key = p_period_key`.
- `mark_selection_job(p_id uuid, ...)` — id 기준 불변.
- `acquire_selection_worker_lock(p_period_key text, p_track text, p_month text) returns uuid` — **(HIGH-3)** `p_expected_total` 인자 제거. ON CONFLICT (period_key) DO UPDATE, finalized_at null + (status<>'running' or claimed_at<15min) 가드. INSERT 시 track/month 기록.
- `release_selection_worker_lock(p_period_key text, p_run_id uuid, p_status text)` — run_id fencing.
- `mark_selection_finalized(p_period_key text, p_run_id uuid)` — period_key화.
- **전 RPC**: SECURITY DEFINER + `set search_path = public, pg_temp` + **revoke execute from public, anon + grant execute to authenticated, service_role 명시 재선언**(0027 Kepler B2: CREATE OR REPLACE는 과거 grant 미보존) + **내부 authz guard 유지**(NULL-safe: `not (coalesce(auth.role(),'')='service_role' or coalesce(public.is_admin(),false)) then raise` — 기존 0031:124-132 패턴, 신규 RPC도 동일, R2 HIGH-1 + R4 MED-4).

- [ ] **Step 4: 신규 원자적 shortlist writer RPC (R1 H1/M4 + R2 H1/H2/M4)**

`replace_shortlist_track(p_month, p_track, p_rows)` — 단일 트랜잭션, **내부 authz guard + 내부 p_rows 검증 + midlong carry fold**:
```sql
create or replace function replace_shortlist_track(p_month date, p_track text, p_rows jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_buckets text[] := case p_track when 'short' then array['short']
                                   when 'midlong' then array['mid','long'] else null end;
  v_expected int := case p_track when 'short' then 10 when 'midlong' then 20 else -1 end;
  v_new_tickers text[];
begin
  -- (R2 HIGH-1 + R4 MED-4) 내부 authz, NULL-safe (둘 다 NULL이면 raise — bypass 차단)
  if not (coalesce(auth.role(),'') = 'service_role' or coalesce(public.is_admin(), false)) then
    raise exception 'not_authorized';
  end if;
  if v_buckets is null then raise exception 'replace_shortlist_track_bad_track:%', p_track; end if;
  -- (R4 HIGH-1) p_rows NULL/non-array 방어 — DELETE 전 (NULL이면 jsonb_array_length NULL → 비교 통과 → 트랙 전멸 차단)
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'replace_shortlist_track_rows_null_or_nonarray'; end if;
  -- (R2 MED-4) p_rows 내부 검증 (직접호출 우회 corruption 차단)
  if jsonb_array_length(p_rows) <> v_expected then
    raise exception 'replace_shortlist_track_count:%:%', p_track, jsonb_array_length(p_rows); end if;
  if exists (select 1 from jsonb_array_elements(p_rows) e
             where not ((e->>'bucket') = any(v_buckets)) or (e->>'ticker') !~ '^\d{6}$'
                or (e->>'rank')::int < 1) then
    raise exception 'replace_shortlist_track_row_invalid'; end if;
  select array_agg(distinct e->>'ticker') into v_new_tickers from jsonb_array_elements(p_rows) e;
  if array_length(v_new_tickers,1) <> v_expected then
    raise exception 'replace_shortlist_track_dup_ticker'; end if;
  -- (R1 MED-4) cross-bucket overlap: 신규 ticker가 동일 month 다른 bucket에 존재 → abort
  if exists (select 1 from short_list_30 s
             where s.month=p_month and s.ticker=any(v_new_tickers) and not (s.bucket=any(v_buckets))) then
    raise exception 'shortlist_track_cross_bucket_overlap'; end if;
  -- (R3 HIGH-3) atomic: 트랙 전행 DELETE + INSERT(fresh created_at) — 생존 ticker도 created_at 갱신(쿨다운 우회 차단)
  delete from short_list_30 s where s.month=p_month and s.bucket=any(v_buckets);
  -- (R3 MED-4) 컬럼 매핑 = 0002+0012+0020+0029 전부 (assigned_by/prompt_version_id/personas_version_id NOT NULL 포함)
  insert into short_list_30
    (month, ticker, bucket, rank, assigned_by, prompt_version_id, personas_version_id,
     delta_status, delta_reason, name, sector, composite_score, signal_label,
     consensus_badge, ai_score, weighted_score_short, weighted_score_mid, weighted_score_long,
     winning_timeframe, conviction, ai_comment_kr, created_at /* + 잔여 0002 numeric 컬럼 */)
  select p_month, e->>'ticker', e->>'bucket', (e->>'rank')::int,
         e->>'assigned_by', e->>'prompt_version_id', e->>'personas_version_id',
         coalesce(e->>'delta_status','new'), e->>'delta_reason', e->>'name', e->>'sector',
         (e->>'composite_score')::numeric, e->>'signal_label',
         e->>'consensus_badge', (e->>'ai_score')::numeric,
         (e->>'weighted_score_short')::numeric, (e->>'weighted_score_mid')::numeric,
         (e->>'weighted_score_long')::numeric, e->>'winning_timeframe',
         (e->>'conviction')::numeric, e->>'ai_comment_kr', now()
    from jsonb_array_elements(p_rows) e;
  -- (R2 HIGH-2) midlong은 동일 트랜잭션에서 carry (별도 RPC 2회 호출 금지)
  if p_track = 'midlong' then perform carry_short_into_month(p_month); end if;
end; $$;
revoke execute on function replace_shortlist_track(date,text,jsonb) from public, anon;
grant  execute on function replace_shortlist_track(date,text,jsonb) to authenticated, service_role;
```

`carry_short_into_month(p_month)` — (D8) best-effort bridge, replace의 midlong txn 내부 호출:
```sql
create or replace function carry_short_into_month(p_month date)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_src date;
begin
  if not (coalesce(auth.role(),'')='service_role' or coalesce(public.is_admin(),false)) then
    raise exception 'not_authorized'; end if;   -- (R4 MED-4) NULL-safe
  if exists (select 1 from short_list_30 where month=p_month and bucket='short') then return; end if;
  select max(month) into v_src from short_list_30 where month < p_month and bucket='short';
  if v_src is null then return; end if;                       -- (R2 MED-5) cold-start no-op (정당)
  -- 직전 short 전 컬럼 복사, month/created_at/delta_status만 교체 (0020 컬럼 포함, NOT NULL 보존)
  insert into short_list_30
    (month, ticker, bucket, rank, assigned_by, prompt_version_id, personas_version_id,
     delta_status, delta_reason, name, sector, composite_score, signal_label,
     consensus_badge, ai_score, weighted_score_short, weighted_score_mid, weighted_score_long,
     winning_timeframe, conviction, ai_comment_kr, created_at /* + 잔여 0002 numeric */)
  select p_month, c.ticker, 'short', c.rank, c.assigned_by, c.prompt_version_id, c.personas_version_id,
         'hold', c.delta_reason, c.name, c.sector, c.composite_score, c.signal_label,
         c.consensus_badge, c.ai_score, c.weighted_score_short, c.weighted_score_mid,
         c.weighted_score_long, c.winning_timeframe, c.conviction, c.ai_comment_kr, now()
    from short_list_30 c
   where c.month=v_src and c.bucket='short'
     and not exists (select 1 from short_list_30 x where x.month=p_month and x.ticker=c.ticker) -- (R2 HIGH-3) 졸업 ticker 제외
  on conflict (month, ticker) do nothing;
end; $$;
revoke execute on function carry_short_into_month(date) from public, anon;
grant  execute on function carry_short_into_month(date) to authenticated, service_role;
```
> jsonb→컬럼 매핑 = short_list_30 전 컬럼(0002+0012+0029), Task 6 writer row shape와 1:1, NULL 허용 컬럼 null-safe. **carry는 cross-track total=30 hard-raise 안 함** (D8 근거: cold-start/졸업 정당 + report worker clean-abort 소비자 게이트).

- [ ] **Step 5: rollback.sql = full-drop inverse (LOW-6)**

dormant 재작성이므로 rollback = 재작성본 전체 drop:
```sql
drop function if exists carry_short_into_month(date);
drop function if exists replace_shortlist_track(date, text, jsonb);
drop function if exists mark_selection_finalized(text, uuid);
drop function if exists release_selection_worker_lock(text, uuid, text);
drop function if exists acquire_selection_worker_lock(text, text, text);
drop function if exists mark_selection_job(uuid, text, jsonb, text);
drop function if exists claim_next_selection_jobs(text, int);
drop table if exists tier1_selection_run;
drop table if exists tier1_selection_job;
```

- [ ] **Step 6: grep 가드**

Run:
```bash
cd tudal && grep -nE "p_month text\)|primary key \(month\)|unique \(month, ticker\)|p_expected_total|'\^\[sm\]:'" supabase/migrations/0031_tier1_selection_worker.sql
```
Expected: 0 (월단일키/expected_total/약한 regex 잔재 없음 — 단 `~ '^[sm]:'`는 claim의 인자 sanity로 1회 허용 가능; track↔prefix exact CHECK가 본 검증). + `grep -c "grant execute" 0031...sql` ≥ RPC 수.

- [ ] **Step 7: commit**
```bash
git add tudal/supabase/migrations/0031_tier1_selection_worker.sql tudal/supabase/migrations/0031_tier1_selection_worker.rollback.sql
git commit -m "feat(w2a): 마이그 0031 재작성 — period_key/track 독립 mutex + 원자적 replace_shortlist_track/carry_short_into_month RPC (omxy R1 H1/H2/H3/M4/M5/L6, dormant apply=USER)"
```

---

## Task 6: rolling composite writer — upsertShortListTrack (TDD, DoD 핵심)

**Files:**
- Modify: `tudal/src/lib/data/admin-shortlist-persist.ts` (신규 export, upsertShortList30 보존)
- Test: `tudal/src/lib/data/__tests__/admin-shortlist-track-persist.test.ts`

- [ ] **Step 1: 실패 테스트 (DoD 관측, 원자적 RPC 경유)**

mock Supabase client(SelectChain/RpcChain/QueryResult 인터페이스 — feedback_test_mock_typing 준수, any 금지)로:
1. `upsertShortListTrack('2026-06','midlong', 20개, {client})` → `client.rpc('replace_shortlist_track', { p_month:'2026-06-01', p_track:'midlong', p_rows:[20] })` **단일 호출**. (carry는 RPC **내부** = TS에서 별도 호출 안 함, R2 HIGH-2.)
2. `upsertShortListTrack('2026-06','short', 10개, {client})` → `replace_shortlist_track('short', [10])` 단일 호출.
3. short selected=9 → throw `shortlist_track_count_mismatch:short:9!=10` (RPC 미호출, 선검증). midlong=19 → throw.
4. selected가 트랙 외 bucket 포함 → throw `shortlist_track_bucket_impurity` (RPC 미호출).
5. ticker 형식 위반(TICKER_RE) → throw(RPC 미호출). degraded ticker comment 없음 → row의 ai_comment_kr null.

```typescript
it('writer = replace_shortlist_track 단일 RPC (carry는 server-side 내부)', async () => {
  await upsertShortListTrack('2026-06', 'midlong', twentyMidLong, { client });
  expect(rpcSpy.calls.map(c => c.fn)).toEqual(['replace_shortlist_track']);
  expect(rpcSpy.calls[0].args).toMatchObject({ p_month: '2026-06-01', p_track: 'midlong' });
});
```
> atomic DELETE+UPSERT·cross-bucket overlap·p_rows 내부검증·authz guard·midlong carry는 전부 **RPC(Task 5 Step 4) 단일 트랜잭션 내부**. TS 단위테스트는 호출 계약 + 선검증을, RPC 로직은 Task 5 SQL(+선택 통합검증)로 커버.

- [ ] **Step 2: 실패 확인.**

- [ ] **Step 3: 구현**

`upsertShortListTrack` = 선검증(count/bucket purity/ticker) → row 빌드(기존 byTf/rank/AI컬럼/메타lookup 헬퍼 재사용, month=YYYY-MM-01) → **원자적 RPC 호출**:
```typescript
const TRACK_BUCKETS: Record<SelectionTrack, readonly Bucket[]> = {
  short: ['short'], midlong: ['mid', 'long'],
};
export async function upsertShortListTrack(
  monthYM: string, track: SelectionTrack,
  selected: readonly TickerAggregate[],
  options: { client?: SupabaseClient; commentsByTicker?: TickerCommentMap } = {},
): Promise<void> {
  const expected = TRACK_SELECT_COUNT[track];                 // 10 / 20
  if (selected.length !== expected)
    throw new Error(`shortlist_track_count_mismatch:${track}:${selected.length}!=${expected}`);
  const allowed = new Set<string>(TRACK_BUCKETS[track]);
  for (const a of selected) {
    if (!TICKER_RE.test(a.ticker)) throw new Error(`invalid_ticker:${a.ticker}`);
    if (a.assigned_timeframe === null || !allowed.has(a.assigned_timeframe))
      throw new Error(`shortlist_track_bucket_impurity:${track}:${a.ticker}:${a.assigned_timeframe}`);
  }
  const monthDate = toMonthDate(monthYM);
  const supabase = options.client ?? (await createClient());
  const rows = await buildShortListRows(supabase, monthDate, track, selected, options.commentsByTicker); // 공유 헬퍼(메타 lookup 포함)
  const { error } = await supabase.rpc('replace_shortlist_track',
    { p_month: monthDate, p_track: track, p_rows: rows });   // (R2 HIGH-2) carry는 midlong일 때 RPC 내부에서 수행
  if (error) throw new Error(`shortlist_persist_failed:${error.code ?? 'unknown'}`);
}
```
공통화: `buildShortListRows`를 private 헬퍼로 추출(기존 `upsertShortList30`의 byTf/rank/AI컬럼/메타lookup 로직 재사용). `upsertShortList30`(단발 경로용)은 보존하되 내부 DELETE+UPSERT는 기존 유지(W2a scope 밖 — 단발은 NON-VIABLE). W2a 청크 finalize는 신규 RPC writer 사용.

- [ ] **Step 4: 통과 확인** — Run vitest, PASS. (atomic·bucket-scope·overlap·carry는 RPC 책임 → Task 5; 본 단위테스트는 호출 계약 검증.)

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

- [ ] **Step 1: 실패 테스트** — 워커 input에 `{track, periodKey, month}` 추가. enqueue가 period_key/track 기록. claim이 p_period_key 사용. count 헬퍼가 period_key 필터. **(D6/R1 HIGH-3 + R2 MED-6 + R3 HIGH-1)** finalize 트리거 = `nonTerminalJobs(periodKey)===0 AND terminalJobs(periodKey)>0`(nonTerminal=pending|running|deferred=finalize 차단, terminal=done|failed). **deferred 잔존 시 finalize 미발동** + **run-start에서 deferred→pending 재개 후 preflight 통과 시 처리 재개**(deadlock 해소) 두 케이스 모두 테스트. finalize가 `runScreening({track})` 후 `upsertShortListTrack(month, track, selected)`. short: 50 enqueue → 10 selected. preflight callCount = openJobs(periodKey)×11. 빈 풀 finalize 미발동.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현**
- `:41 EXPECTED_TOTAL=150` 제거 → **저장 expected_total 없음(D6)**. `:322-327` candidates count abort → `getTier0Candidates(track)` 반환 길이 = `TRACK_FRESH_POOL[track]` 검증(W2a fresh-only).
- enqueue(:329-342): rows에 `period_key, track` 추가, onConflict `period_key,ticker`(idempotent).
- count 헬퍼(:258-271): `countOpenJobs(periodKey)`=pending+running + `countDeferredJobs(periodKey)` + **`countNonTerminalJobs`=pending+running+deferred** + `countTerminalJobs`=done+failed (전부 `.eq('period_key', periodKey)`).
- **(R4 HIGH-2 — preflight를 claim/reset 前으로, attempts 보존)** 순서 = **① preflight 먼저**: reservation callCount = `(countOpenJobs + countDeferredJobs)(periodKey) × 11 × getRoleMaxCostPerCallKrw('tier1_panel')`(W0). preflightHardcap **fail → 즉시 return aborted:'cost_hardcap'** (claim·reset 안 함 = **attempts 미소진**, deferred 그대로). **② preflight pass 시에만** `deferred → pending` 리셋(`update ... set status='pending' where period_key=$ and status='deferred'`, attempts 보존) → **③ claim** `claim_next_selection_jobs(periodKey, chunkSize)`(여기서 attempts++는 실제 처리 직전). ⇒ budget 초과 사이클에서 attempts 안 깎임(R4 HIGH-2 deadlock+strand 동시 해소).
- finalize(:515-566): **게이트 = `countNonTerminalJobs(periodKey)===0 && countTerminalJobs(periodKey)>0`** (`terminal.length === EXPECTED_TOTAL` 폐기; **deferred는 nonTerminal로 finalize 차단**, R2 MED-6). select where period_key; `runScreening({candidates, track, ...replay})`; persist = `upsertShortListTrack(month, track, selected, {client, commentsByTicker})`; `mark_selection_finalized(periodKey, runId)`.
- runGuardedSelectionChunk(:575): `acquire_selection_worker_lock(periodKey, track, month)` **(expected_total 인자 없음, HIGH-3)**.
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
- **(R3 MED-5) per-track 실패 격리** — short 호출이 throw해도 midlong은 실행(둘 다 due 시). short throw 주입 → midlong 호출 1회 확인 + route는 부분실패 보고(둘 중 하나 실패해도 502 단일화 금지).
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
- **(R3 MED-5)** 각 due 트랙을 **per-track try/catch/continue**로 순차 호출(한 트랙 throw가 다른 트랙을 막지 않음):
```typescript
const results: Array<{track: SelectionTrack; ok: boolean; error?: string; claimed?: number}> = [];
for (const t of dueTracks) {
  try {
    const r = await runGuardedSelectionChunk({ periodKey: t.periodKey, track: t.track, month: t.month,
      tier0Source: (o)=>getTier0Candidates({ track: t.track, month: o.month, client }),
      persist: upsertShortListTrack, runScreening: runTier1Screening, reflectionContext: '' /* W2b */, ... });
    results.push({ track: t.track, ok: true, claimed: r.claimed });
  } catch (e) { results.push({ track: t.track, ok: false, error: String(e) }); }
}
// 응답: 전부 성공/skip → 200; 일부 실패 → 부분실패 보고(트랙별 status), 전체 502 단일화 금지.
```
- self-continue(:119)는 due 트랙 중 forward-progress(claimed>0) 있으면 유지.
- flag-off/인증/dormant 무회귀.
- [ ] **Step 4: 통과 확인.**
- [ ] **Step 5: commit**
```bash
git commit -am "feat(w2a): selection-worker route KST due-gate + per-track 실패격리 (TDD, R3 MED-5)"
```

---

## Task 9.5: 소비자 <30 안전 가드 (R3 HIGH-2)

**Files:**
- Modify: `tudal/src/lib/report/full-report-batch-worker.ts` (shortlist<30 감지부) — **failure summarize/critical alert/pipeline-health-failed 발행 前** not-ready 분기(R4 MED-5) → route는 **200 not-ready**(502/critical 아님).
- Modify: `tudal/src/app/api/cron/monthly-batch/report-worker/route.ts:61-63` — worker의 not-ready 결과를 200 clean skip으로 매핑.
- Modify: `tudal/src/app/(admin)/admin/portfolio/actions.ts` accept 경로 — shortlist 빈 리스트만 거부 → **`length<30` 거부**(부분 리스트 snapshot 진입 차단).
- Modify: `tudal/src/lib/portfolio/gating.ts` (+ actions.ts 호출부) — **(R4 HIGH-3)** 쿨다운 anchor를 "첫 활성 행(bucket/rank 정렬) createdAt" → **accept 대상 ticker 본인 행의 createdAt(per-ticker)**. replace의 fresh `created_at=now()`와 결합해 ticker별 쿨다운 정확. (mixed-cadence에서 오래된 mid/long가 short 쿨다운을 anchor하던 우회 제거.)
- Test: 각 변경부 단위테스트.

> **근거:** W2a 트랙 split가 일시적 <30 + mixed createdAt을 도입(이전엔 단일 배치가 원자적 30·uniform createdAt). (a) report-worker route 502+critical false-alarm (R4 MED-5) (b) portfolio accept <30 진행 snapshot 오염 (R3 H2) (c) list-level createdAt 쿨다운 anchor 우회 (R4 H3). 소비자를 fail-safe + per-ticker로.

- [ ] **Step 1: 실패 테스트**
- worker/report-worker route: shortlist 20행 mock → 응답 **200 + skipped reason='shortlist_not_ready'**, **failure 텔레메트리(critical alert/pipeline-health 'failed') 미발행** 검증(R4 MED-5), spend 0.
- portfolio accept: shortlist 20행 → accept **거부**(`shortlist_incomplete`), snapshot 미생성.
- **(R4 HIGH-3)** gating per-ticker: 같은 month에 mid(오래된 createdAt) + short(now() refresh)가 공존할 때, short ticker accept 쿨다운이 **short 행 createdAt** 기준으로 평가(첫 행 아님). 오래된 mid가 anchor 안 됨 검증.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — worker가 shortlist<30을 **summarize/alert 전에** `{ skipped:true, reason:'shortlist_not_ready' }`로 early-return → route 200. portfolio accept 가드 `length===0` → `length<30`(또는 `!== SHORTLIST_TARGET_COUNT`). gating은 accept 대상 ticker의 ShortListItem.createdAt를 인자로 받아 per-ticker 쿨다운 계산(첫 행 createdAt 의존 제거). 정상(30·uniform) 경로 무회귀.
- [ ] **Step 4: 통과 확인.**
- [ ] **Step 5: commit**
```bash
git commit -am "feat(w2a): <30 소비자 가드 + per-ticker 쿨다운 — report not-ready(텔레메트리 前) + portfolio <30 거부 + gating per-ticker createdAt (R3 H2 / R4 H3 / R4 M5)"
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
