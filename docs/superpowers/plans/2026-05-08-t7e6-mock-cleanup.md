# T7e.6 Mock Cleanup (access-logs / performance / decision-tree) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 잔여 mock 3종(`mock-admin-access-logs.ts`·`mock-admin-performance.ts`·`mock-admin-decision-tree.ts`)을 Supabase boundary로 전환해 S7e 6/8 sub-task를 닫는다.

**Architecture:**
- 신규 마이그 0건. `portfolio_snapshot`(0005)을 단일 SoT로 사용해 performance / decision-tree 산출.
- access-logs는 `getRecentAdminAccessLogs()` boundary를 만들고 `[]` 반환 → BL-20 자동 바이패스 영구 비활성. 실 source는 T7e 범위 밖.
- Counterfactual은 `null` 반환 + UI '운용 데이터 누적 후 산출' 대기. 실 산출은 D11/S9 이후.
- 시드 부재 시 모든 페이지가 빈 상태/0% 게이지로 일관 동작 (T7e.3 boundary 패턴 재사용).
- Sharpe/MDD/Alpha/judge는 기존 순수 함수 (`@/lib/performance/{sharpe,mdd,alpha,judge,cap-months}`) 그대로 호출.

**Tech Stack:** Next.js 16 App Router · TypeScript strict · Supabase SSR (`@/lib/supabase/server`) · Vitest · 검증 게이트 = `npm run build` + `npm run lint` + `npm run test:ci` + `npx tsc --noEmit`.

---

## File Structure

**신규**:
- `tudal/src/lib/data/admin-access-logs.ts` — `getRecentAdminAccessLogs(now, windowDays)` boundary, 빈 배열 반환
- `tudal/src/lib/data/admin-performance.ts` — portfolio_snapshot SELECT + summary/monthly/bucket aggregation, counterfactual=null
- `tudal/src/lib/data/admin-decision-tree.ts` — portfolio_snapshot SELECT + judge/cap-months 호출
- `tudal/src/lib/data/__tests__/admin-access-logs.test.ts`
- `tudal/src/lib/data/__tests__/admin-performance.test.ts`
- `tudal/src/lib/data/__tests__/admin-decision-tree.test.ts`

**수정**:
- `tudal/src/app/(admin)/admin/track-record/page.tsx` — Supabase 전환 + Counterfactual 대기 UI
- `tudal/src/app/(admin)/admin/decision-tree/page.tsx` — Supabase 전환
- `tudal/src/app/(admin)/admin/portfolio/page.tsx` — `getRecentAdminAccessLogs()` 사용
- `tudal/src/app/(admin)/admin/portfolio/actions.ts` — `getRecentAdminAccessLogs()` 사용
- `tudal/src/lib/data/__tests__/mock-admin-consistency.test.ts` — performance/decision-tree mock 참조 정리

**삭제**:
- `tudal/src/lib/data/mock-admin-access-logs.ts`
- `tudal/src/lib/data/mock-admin-performance.ts`
- `tudal/src/lib/data/mock-admin-decision-tree.ts`

**문서 갱신** (Task 9):
- `Document/Process/HANDOFF.md` (S7e 6/8, 다음 1순위 = T7e.7 또는 T7e.8)
- `Document/Build/ProgressDashboard.md`
- `Document/Build/Slices/S7-RealData.md`
- `Document/Process/CodebaseStatus.md`
- `CLAUDE.md` (40차 완료 요약)

---

## Task 1: AccessLog boundary (빈 배열 wrapper)

**Files:**
- Create: `tudal/src/lib/data/admin-access-logs.ts`
- Test: `tudal/src/lib/data/__tests__/admin-access-logs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// admin-access-logs.test.ts
import { describe, expect, it } from "vitest";
import { getRecentAdminAccessLogs } from "@/lib/data/admin-access-logs";

describe("getRecentAdminAccessLogs", () => {
  it("returns an empty array (boundary stub until real source is wired)", async () => {
    const now = new Date("2026-04-17T10:00:00+09:00");
    const result = await getRecentAdminAccessLogs(now, 7);
    expect(result).toEqual([]);
  });

  it("does not throw when invoked without arguments (defaults)", async () => {
    const result = await getRecentAdminAccessLogs();
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tudal && npm run test:ci -- src/lib/data/__tests__/admin-access-logs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// admin-access-logs.ts — T7e.6 boundary
// 실제 어드민 접속 로그 source는 T7e 범위 밖으로 분리 (HANDOFF '신규 마이그 0건' 기조).
// 본 함수는 빈 배열을 반환하며, BL-20 7일 단일 어드민 자동 바이패스는 source 정의 전까지 영구 비활성.
import type { AdminAccessLog } from "@/lib/portfolio/auto-relief";

export async function getRecentAdminAccessLogs(
  _now: Date = new Date(),
  _windowDays: number = 7,
): Promise<AdminAccessLog[]> {
  return [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tudal && npm run test:ci -- src/lib/data/__tests__/admin-access-logs.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add tudal/src/lib/data/admin-access-logs.ts tudal/src/lib/data/__tests__/admin-access-logs.test.ts
git commit -m "feat(T7e.6): admin-access-logs boundary (empty array stub)"
```

---

## Task 2: Performance data layer — types + transformer

**Files:**
- Create: `tudal/src/lib/data/admin-performance.ts`
- Test: `tudal/src/lib/data/__tests__/admin-performance.test.ts`

- [ ] **Step 1: Write transformer tests**

```ts
// admin-performance.test.ts
import { describe, expect, it } from "vitest";
import {
  transformSnapshotRow,
  type PortfolioSnapshotRow,
} from "@/lib/data/admin-performance";

describe("transformSnapshotRow", () => {
  it("maps numeric strings to numbers", () => {
    const row: PortfolioSnapshotRow = {
      id: "snap-1",
      date: "2026-04-15",
      month: "2026-04-01",
      ticker: "005930",
      entry_price: "70000",
      current_price: "71500",
      weight: "0.05",
      is_cash: false,
      daily_return: "0.003",
      total_return: "0.021",
      kospi_return: "0.012",
      alpha: "0.009",
      sharpe: "0.65",
    };
    const out = transformSnapshotRow(row);
    expect(out.entryPrice).toBe(70000);
    expect(out.currentPrice).toBe(71500);
    expect(out.weight).toBeCloseTo(0.05);
    expect(out.totalReturn).toBeCloseTo(0.021);
  });

  it("treats nulls as 0", () => {
    const row: PortfolioSnapshotRow = {
      id: "snap-cash",
      date: "2026-04-15",
      month: "2026-04-01",
      ticker: null,
      entry_price: null,
      current_price: null,
      weight: "1.0",
      is_cash: true,
      daily_return: null,
      total_return: null,
      kospi_return: null,
      alpha: null,
      sharpe: null,
    };
    const out = transformSnapshotRow(row);
    expect(out.entryPrice).toBe(0);
    expect(out.alpha).toBe(0);
    expect(out.isCash).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `cd tudal && npm run test:ci -- src/lib/data/__tests__/admin-performance.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement minimal — transformer + DB row type**

```ts
// admin-performance.ts (Task 2 portion)
import { createClient } from "@/lib/supabase/server";
import { computeSharpeRatio } from "@/lib/performance/sharpe";
import { computeMaxDrawdown } from "@/lib/performance/mdd";

export interface PortfolioSnapshotRow {
  id: string;
  date: string;
  month: string;
  ticker: string | null;
  entry_price: string | number | null;
  current_price: string | number | null;
  weight: string | number | null;
  is_cash: boolean;
  daily_return: string | number | null;
  total_return: string | number | null;
  kospi_return: string | number | null;
  alpha: string | number | null;
  sharpe: string | number | null;
}

export interface SnapshotRow {
  id: string;
  date: string;
  month: string;
  ticker: string | null;
  entryPrice: number;
  currentPrice: number;
  weight: number;
  isCash: boolean;
  dailyReturn: number;
  totalReturn: number;
  kospiReturn: number;
  alpha: number;
  sharpe: number;
}

const COLUMNS =
  "id, date, month, ticker, entry_price, current_price, weight, is_cash, daily_return, total_return, kospi_return, alpha, sharpe";

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function transformSnapshotRow(row: PortfolioSnapshotRow): SnapshotRow {
  return {
    id: row.id,
    date: row.date,
    month: row.month,
    ticker: row.ticker,
    entryPrice: num(row.entry_price),
    currentPrice: num(row.current_price),
    weight: num(row.weight),
    isCash: row.is_cash,
    dailyReturn: num(row.daily_return),
    totalReturn: num(row.total_return),
    kospiReturn: num(row.kospi_return),
    alpha: num(row.alpha),
    sharpe: num(row.sharpe),
  };
}
```

- [ ] **Step 4: Run, expect pass**

Run: same command → PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add tudal/src/lib/data/admin-performance.ts tudal/src/lib/data/__tests__/admin-performance.test.ts
git commit -m "feat(T7e.6): admin-performance transformer + DB row type"
```

---

## Task 3: Performance summary + monthly + bucket aggregation

**Files:**
- Modify: `tudal/src/lib/data/admin-performance.ts` (append)
- Modify: `tudal/src/lib/data/__tests__/admin-performance.test.ts` (append)

**Aggregation contract**:
- `getPerformanceSummary()` → `PerformanceSummary | null` (시드 부재 = null)
- `getMonthlyPerformance()` → `MonthlyPerformanceRow[]` (시드 부재 = `[]`)
- `getBucketPerformance()` → `BucketPerformanceRow[]` (시드 부재 = `[]`)
- `getCounterfactual()` → 항상 `null` (시계열 저장 정책 D11/S9 이후)

**Type re-export**: 기존 `mock-admin-performance.ts`의 타입(`MonthlyPerformanceRow`·`BucketPerformanceRow`·`CounterfactualComparison`·`PerformanceSummary`)을 `admin-performance.ts`로 이전 (mock 삭제 시 다른 importer는 없음 — Step 0 검증).

**Aggregation rules**:
1. portfolio 행 (ticker IS NULL, is_cash=false 가정 — 0005 §1: 포트 전체 집계 행) 시계열을 시간순으로 SELECT.
2. `cumulativeReturn` = 마지막 행의 `total_return`.
3. `cumulativeKospi` = 마지막 행의 `kospi_return`.
4. `cumulativeAlpha` = 마지막 행의 `alpha`.
5. `dailyReturns` = 시간순 `daily_return` 배열 → `computeSharpeRatio()`.
6. `cumulativeValues` = 누적 1.0 base × (1+daily_return) → `computeMaxDrawdown()`.
7. `currentCapMonths` = monthly verdict 시계열 → `computeCapMonths()`.
8. **Monthly aggregation**: 같은 월의 portfolio 행만 그룹핑, 마지막 행의 total/kospi/alpha/sharpe 사용 + verdict per month → capStreak.
9. **Bucket aggregation**: ticker별 행을 join해 short/mid/long 버킷별로 cumulativeReturn 가중평균 + ticker 수.

**Bucket lookup**: ticker → bucket 매핑은 같은 month의 `short_list_30`에서 받아온다 (`getActiveShortList({ month })`). T7e.2에서 만든 `admin-shortlist.ts` 활용.

- [ ] **Step 1: Add tests for getPerformanceSummary (empty, single-month, multi-month)**

핵심 케이스:
- portfolio_snapshot 0행 → null
- portfolio 행 1개 (Day 0) → cumulativeReturn=0, sharpe=0(샘플 1), mdd=0
- 60일 시계열 → mock과 같은 ±0.001 오차 내 결과 (DAILY_RETURNS 재사용해 회귀 anchor 가능)
- supabase error → throw

- [ ] **Step 2: Add tests for getMonthlyPerformance / getBucketPerformance / getCounterfactual**

핵심 케이스:
- 빈 DB → []·[]·null
- bucket aggregation: shortlist가 없을 때 → []
- counterfactual: 항상 null

- [ ] **Step 3: Implement (use the same Supabase chain mock pattern as `admin-regen-counters.test.ts` — `SelectChain` interface, no `any`/eslint-disable)**

`getPerformanceSummary` skeleton:

```ts
export interface PerformanceSummary {
  cumulativeReturn: number;
  cumulativeKospi: number;
  cumulativeAlpha: number;
  cumulativeSharpe: number;
  cumulativeMdd: number;
  currentCapMonths: number;
  dailyReturns: number[];
  cumulativeValues: number[];
}

export async function getPerformanceSummary(): Promise<PerformanceSummary | null> {
  const client = await createClient();
  const { data, error } = await client
    .from("portfolio_snapshot")
    .select(COLUMNS)
    .is("ticker", null)
    .order("date", { ascending: true });

  if (error) {
    throw new Error(
      `portfolio_snapshot summary query failed: ${error.message ?? "unknown"}`,
    );
  }
  if (!data || data.length === 0) return null;

  const rows = (data as PortfolioSnapshotRow[]).map(transformSnapshotRow);
  const last = rows[rows.length - 1]!;
  const dailyReturns = rows.map((r) => r.dailyReturn);
  const cumulativeValues = rows.reduce<number[]>((acc, r) => {
    const prev = acc.length === 0 ? 1 : acc[acc.length - 1]!;
    acc.push(prev * (1 + r.dailyReturn));
    return acc;
  }, []);

  return {
    cumulativeReturn: last.totalReturn,
    cumulativeKospi: last.kospiReturn,
    cumulativeAlpha: last.alpha,
    cumulativeSharpe: computeSharpeRatio(dailyReturns),
    cumulativeMdd: computeMaxDrawdown(cumulativeValues),
    currentCapMonths: 0, // Filled by Task 4 once monthly verdicts are computed.
    dailyReturns,
    cumulativeValues,
  };
}
```

→ `currentCapMonths`는 Task 4의 `getDecisionTreeSnapshot()`에서 계산되는 monthly verdicts와 결합하므로, 페이지에서 둘을 합쳐 사용한다 (또는 summary 호출이 내부에서 monthly verdict를 함께 산출하도록 보강 — 구현 시 결정).

- [ ] **Step 4: Run all admin-performance tests, expect pass**

- [ ] **Step 5: Commit**

```bash
git add tudal/src/lib/data/admin-performance.ts tudal/src/lib/data/__tests__/admin-performance.test.ts
git commit -m "feat(T7e.6): admin-performance summary/monthly/bucket aggregation"
```

---

## Task 4: Decision Tree data layer

**Files:**
- Create: `tudal/src/lib/data/admin-decision-tree.ts`
- Test: `tudal/src/lib/data/__tests__/admin-decision-tree.test.ts`

**Contract**:
- `getDecisionTreeSnapshot()` → `DecisionTreeSnapshot | null` (시드 부재 = null)
- Snapshot 산출:
  - `cumulativeAlpha/Sharpe/Mdd` = portfolio 행 마지막
  - `monthlyHistory` = month별 마지막 portfolio 행 → judgeDecisionTree → verdict
  - `monthlyVerdicts` = 시간순 verdict 배열 → 페이지에서 `computeCapMonths()` 호출

- [ ] **Step 1: Tests** (empty=null · single-month=○ · `judge` 임계값 경계 회귀)

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement**

```ts
// admin-decision-tree.ts
import { createClient } from "@/lib/supabase/server";
import {
  judgeDecisionTree,
  type DecisionVerdict,
} from "@/lib/performance/judge";
import { computeMaxDrawdown } from "@/lib/performance/mdd";
import { computeSharpeRatio } from "@/lib/performance/sharpe";
import {
  transformSnapshotRow,
  type PortfolioSnapshotRow,
  type SnapshotRow,
} from "@/lib/data/admin-performance";

export interface MonthlyDecisionRow {
  month: string;
  alpha: number;
  sharpe: number;
  mdd: number;
  verdict: DecisionVerdict;
}

export interface DecisionTreeSnapshot {
  cumulativeAlpha: number;
  cumulativeSharpe: number;
  cumulativeMdd: number;
  monthlyHistory: MonthlyDecisionRow[];
  monthlyVerdicts: DecisionVerdict[];
}

const COLUMNS =
  "id, date, month, ticker, entry_price, current_price, weight, is_cash, daily_return, total_return, kospi_return, alpha, sharpe";

export async function getDecisionTreeSnapshot(): Promise<DecisionTreeSnapshot | null> {
  const client = await createClient();
  const { data, error } = await client
    .from("portfolio_snapshot")
    .select(COLUMNS)
    .is("ticker", null)
    .order("date", { ascending: true });

  if (error) {
    throw new Error(
      `decision_tree query failed: ${error.message ?? "unknown"}`,
    );
  }
  if (!data || data.length === 0) return null;

  const rows = (data as PortfolioSnapshotRow[]).map(transformSnapshotRow);
  const monthly = groupByMonth(rows);
  const monthlyHistory = monthly.map((m) => {
    const dailyReturns = m.rows.map((r) => r.dailyReturn);
    const cumulativeValues = m.rows.reduce<number[]>((acc, r) => {
      const prev = acc.length === 0 ? 1 : acc[acc.length - 1]!;
      acc.push(prev * (1 + r.dailyReturn));
      return acc;
    }, []);
    const last = m.rows[m.rows.length - 1]!;
    const sharpe = computeSharpeRatio(dailyReturns);
    const mdd = computeMaxDrawdown(cumulativeValues);
    const verdict = judgeDecisionTree({ alpha: last.alpha, sharpe, mdd }).overall;
    return { month: m.month, alpha: last.alpha, sharpe, mdd, verdict };
  });

  const last = rows[rows.length - 1]!;
  const dailyReturns = rows.map((r) => r.dailyReturn);
  const cumulativeValues = rows.reduce<number[]>((acc, r) => {
    const prev = acc.length === 0 ? 1 : acc[acc.length - 1]!;
    acc.push(prev * (1 + r.dailyReturn));
    return acc;
  }, []);

  return {
    cumulativeAlpha: last.alpha,
    cumulativeSharpe: computeSharpeRatio(dailyReturns),
    cumulativeMdd: computeMaxDrawdown(cumulativeValues),
    monthlyHistory,
    monthlyVerdicts: monthlyHistory.map((m) => m.verdict),
  };
}

function groupByMonth(rows: SnapshotRow[]): { month: string; rows: SnapshotRow[] }[] {
  const map = new Map<string, SnapshotRow[]>();
  for (const r of rows) {
    if (!map.has(r.month)) map.set(r.month, []);
    map.get(r.month)!.push(r);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([month, rows]) => ({ month, rows }));
}
```

- [ ] **Step 4: Run, expect pass**

- [ ] **Step 5: Commit**

```bash
git add tudal/src/lib/data/admin-decision-tree.ts tudal/src/lib/data/__tests__/admin-decision-tree.test.ts
git commit -m "feat(T7e.6): admin-decision-tree snapshot from portfolio_snapshot"
```

---

## Task 5: Switch `/admin/track-record` page

**Files:**
- Modify: `tudal/src/app/(admin)/admin/track-record/page.tsx`

- [ ] **Step 1: Replace mock import with `getPerformanceSummary` etc.**

  - Server Component이므로 `await` 사용.
  - summary===null 또는 monthly===[] 시 빈 상태 카드 (T7e.3 패턴, 0% 게이지 + "운용 데이터 누적 후 산출" 문구).
  - Counterfactual 카드: 항상 "운용 데이터 누적 후 산출" 대기 표시.
  - currentCapMonths는 monthlyVerdicts에서 `computeCapMonths()` 적용.

- [ ] **Step 2: Run page-level e2e via build**

```bash
cd tudal && npm run build
```

Expected: 25 routes (track-record 포함) PASS.

- [ ] **Step 3: Commit**

```bash
git add tudal/src/app/(admin)/admin/track-record/page.tsx
git commit -m "feat(T7e.6): track-record page → Supabase + counterfactual 대기 UI"
```

---

## Task 6: Switch `/admin/decision-tree` page

**Files:**
- Modify: `tudal/src/app/(admin)/admin/decision-tree/page.tsx`

- [ ] **Step 1: Replace `MOCK_DECISION_TREE_SNAPSHOT` with `getDecisionTreeSnapshot()`**
  - snap===null 시 게이지 0% + 빈 상태 안내.
  - capMonths: `computeCapMonths(snap.monthlyVerdicts)` 그대로.

- [ ] **Step 2: Build**

- [ ] **Step 3: Commit**

```bash
git add tudal/src/app/(admin)/admin/decision-tree/page.tsx
git commit -m "feat(T7e.6): decision-tree page → Supabase"
```

---

## Task 7: Switch `/admin/portfolio` page + actions to access-logs boundary

**Files:**
- Modify: `tudal/src/app/(admin)/admin/portfolio/page.tsx`
- Modify: `tudal/src/app/(admin)/admin/portfolio/actions.ts`

- [ ] **Step 1: Replace `MOCK_ADMIN_ACCESS_LOGS` import**

```ts
// page.tsx
import { getRecentAdminAccessLogs } from "@/lib/data/admin-access-logs";
// ...
const accessLogs = await getRecentAdminAccessLogs(now, 7);
const autoReliefResult = detectSingleAdminStreak(accessLogs, now, 7);
```

```ts
// actions.ts
import { getRecentAdminAccessLogs } from "@/lib/data/admin-access-logs";
// ...
const autoReliefActive = detectSingleAdminStreak(
  await getRecentAdminAccessLogs(now, 7),
  now,
  7,
).active;
```

- [ ] **Step 2: 빈 배열 반환 → autoReliefActive=false 회귀 단언**

기존 `__tests__`에 portfolio actions 테스트가 있다면 검증, 없다면 신규 unit 추가.

- [ ] **Step 3: Build + lint + test**

- [ ] **Step 4: Commit**

```bash
git add tudal/src/app/(admin)/admin/portfolio/page.tsx tudal/src/app/(admin)/admin/portfolio/actions.ts
git commit -m "feat(T7e.6): portfolio page+actions → access-logs boundary"
```

---

## Task 8: Delete mock files + update consistency test

**Files:**
- Delete: `tudal/src/lib/data/mock-admin-access-logs.ts`
- Delete: `tudal/src/lib/data/mock-admin-performance.ts`
- Delete: `tudal/src/lib/data/mock-admin-decision-tree.ts`
- Modify: `tudal/src/lib/data/__tests__/mock-admin-consistency.test.ts`

- [ ] **Step 1: grep for any remaining importers**

```bash
cd tudal && grep -rn "mock-admin-access-logs\|mock-admin-performance\|mock-admin-decision-tree\|MOCK_ADMIN_ACCESS_LOGS\|MOCK_ADMIN_PERFORMANCE_SUMMARY\|MOCK_ADMIN_MONTHLY_PERFORMANCE\|MOCK_ADMIN_BUCKET_PERFORMANCE\|MOCK_ADMIN_COUNTERFACTUAL\|MOCK_DECISION_TREE_SNAPSHOT" src
```

Expected after Tasks 5–7: only `__tests__/mock-admin-consistency.test.ts` remains.

- [ ] **Step 2: Update consistency test**

Performance·decision-tree 관련 단언을 제거(또는 boundary로 마이그). 다른 mock 모듈 일관성 단언은 유지.

- [ ] **Step 3: Delete mock files**

```bash
rm tudal/src/lib/data/mock-admin-access-logs.ts \
   tudal/src/lib/data/mock-admin-performance.ts \
   tudal/src/lib/data/mock-admin-decision-tree.ts
```

- [ ] **Step 4: Run full gate**

```bash
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

Expected: build 25 routes · lint 0 · test:ci ≥ 362 + 추가 테스트 · tsc 0.

- [ ] **Step 5: Commit**

```bash
git add -A tudal/src/lib/data/
git commit -m "feat(T7e.6): delete mock-admin-{access-logs,performance,decision-tree} + sync consistency test"
```

---

## Task 9: 검토 + 문서 동기화

- [ ] **Step 1: 독립 reviewer 에이전트 호출**

`general-purpose` 또는 `code-reviewer`(있다면)로 diff 검토. 검토 포인트:
1. 시드 부재 빈 상태 일관성 (T7e.3 boundary 패턴)
2. `getRecentAdminAccessLogs()` boundary가 BL-20 자동 바이패스 영구 비활성을 보장하는지
3. Counterfactual UI 대기 문구가 한국어 + Footer 면책 일관
4. Supabase chain mock에 `any`/eslint-disable 누락 (피드백 기준 위반)
5. `currentCapMonths` 산출 경로(summary vs decision-tree) 중복 없는지
6. `npm run build` 25 routes 그대로

- [ ] **Step 2: gstack-review 또는 codex review로 diff 검수**

- [ ] **Step 3: 문서 동기화**
  - `Document/Process/HANDOFF.md`: S7e 6/8, 다음 1순위 = T7e.7 RLS QA 또는 T7e.8 Tier 0 Python
  - `Document/Build/ProgressDashboard.md`: T7e.6 ✅, test:ci 신규 카운트
  - `Document/Build/Slices/S7-RealData.md`: T7e.6 박제 (boundary 패턴 + counterfactual deferred)
  - `Document/Process/CodebaseStatus.md`: 잔존 mock 목록 갱신
  - `CLAUDE.md`: 40차 완료 요약 1줄

- [ ] **Step 4: 메모리 갱신**

`feedback_doc_count_drift_sweep.md` 패턴 적용 — "N종 open" / "N/8" 카운트 grep 후 일괄 수정.

- [ ] **Step 5: Commit**

```bash
git add Document/ CLAUDE.md
git commit -m "docs(T7e.6): S7e 6/8 박제 + 다음 1순위 갱신"
```

---

## Self-Review 체크

1. **Spec coverage**:
   - ✅ access-logs mock 제거 + boundary 빈 배열 (Task 1·7·8)
   - ✅ performance mock 제거 + Supabase aggregation (Task 2·3·5·8)
   - ✅ decision-tree mock 제거 + Supabase snapshot (Task 4·6·8)
   - ✅ Counterfactual null + UI 대기 (Task 3·5)
   - ✅ 신규 마이그 0건 (Task 1·3·4 모두 portfolio_snapshot 재사용)
   - ✅ 검증 게이트 (Task 8·9)
   - ✅ 문서 동기화 (Task 9)

2. **Placeholder 스캔**: 코드 step에는 모두 실제 코드 블록 포함. Task 3·4의 일부 helper(`groupByMonth` 등)는 본문에 포함됨.

3. **Type 일관성**: `SnapshotRow`(camelCase)·`PortfolioSnapshotRow`(snake_case DB)가 Task 2·3·4 전체에서 동일 이름. `MonthlyDecisionRow`·`DecisionTreeSnapshot`은 기존 mock 타입과 같은 필드명 유지(소비 페이지가 그대로 동작).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-08-t7e6-mock-cleanup.md`.**

권장 실행 옵션 = **Subagent-Driven** (사용자 요청 "에이전트와 스킬 이용 + 검토까지 철저"와 정확히 일치). Task별 fresh subagent + Task 간 review.
