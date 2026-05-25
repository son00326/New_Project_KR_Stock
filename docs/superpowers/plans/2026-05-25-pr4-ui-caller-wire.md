# PR4 (UI Caller Wire + Track Record + Regen + PR3a OOS + B18 CRON_SECRET 401) Implementation Plan

> **For agentic workers:** This plan uses **inline execution** (omxy R2 결정 — subagent-driven-development는 폐기, omxy adversarial review로 대체). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** canonical 5-PR 마지막 단계. Group A (track-record trigger 위치) + Group F (Track Record 누적 vs 아카이브 탭 분리) + Group D 잔여 (UI caller wire) + PR3a OOS 3종 (partA 14 rows / aggregateVotes guard / LLM max bound) + B18 (CRON_SECRET 401 test) + Track 2/3 defer 20 follow-up 해소.

**Architecture:** **T5 first vertical slice** (omxy R2 권고 q4=a) = admin trigger 버튼 1개 + server action wire + caller DI (`commitFullReport`) + minimum tests. T5 사용자 승인 후 단계적 확장 — Regen (`orchestrateFullReport`) → Track Record 탭 → PR3a OOS → defer/B18.

**Tech Stack:** Next.js 16.2.3 App Router (server components 우선) · React 19.2.4 · Tailwind v4 + shadcn (`tudal/src/components/ui` 기존 패턴) · Vitest · Supabase SSR · server actions (`{success: true, data} | {success: false, error}` 규약).

---

## omxy R1~R2 CONVERGED 결정 (변경 금지)

| 항목 | 결정 | 적용 |
|---|---|---|
| implementer | Claude 단독 primary | 본 plan 작성·impl·verify 모두 Claude |
| omxy 역할 | adversarial reviewer + final review (T8 depth 대체) | T4/T7/T9 R rounds + T8 final |
| 단일 PR | ✅ | T2/T5/T10 gate 실패 시만 축소 |
| gstack-design-html | ❌ 사용 안 함 | shadcn + `tudal/src/components/ui` 직접 |
| vercel:nextjs / vercel:shadcn skill | ❌ invoke 금지 | `node_modules/next/dist/docs/` 로컬 read |
| inline skills | ✅ writing-plans (본 plan) / TDD (T6) / verification (T6+T9) / requesting-code-review (T8) — SKILL.md checklist read-through + 적용 선언 | parent-owns-skill rule 준수 |
| read-only subagent | ✅ T1/T2 사이 PR3a OOS 검증 1회 (완료) | file:line 증거 확보 — Section A.0 박제 |
| T8 3-track 축소판 | (a) gstack-review inline + (b) 5-angle scan subagent 1회 + (c) omxy final | depth=deep general-purpose 폐기 |
| T5 first vertical slice | admin trigger 버튼 1개 + server action wire + caller DI (commitFullReport) + minimum tests | Task 1 = T5 slice |
| Gates | T2 plan/file map · T5 first vertical slice · T10 final diff + build/lint/test | 3-gate |

---

## Spec Lock-in (변경 금지 — 재해석 금지)

- **사용자 lock-in 8 항목** (53차 §5 spec doc §1 + 55차 §2/§4 amendment): (1.1) Tier 0+1 메인 path / (1.2) 풀 리포트 단일 산출물 / (1.3) 3 trigger path / (1.4) /admin → 30 list → 클릭 → 풀 리포트 페이지 / (1.5) Track Record 탭 분리 / (1.6) Kevin v3.1 quality target / (1.7) Sector 3-level / (1.8) API 금액 무관.
- **canonical 5-PR 순서**: PR2 ✅ → PR3a ✅ → PR1 ✅ → PR3b ✅ → PR3c ✅ → **PR4** (본 plan).
- **caller path 박제 (B8 + omxy R2)**: cron = `commitFullReport` (fast) / admin manual trigger = `orchestrateFullReport` (quality). T5 first vertical slice는 `commitFullReport`로 wire (DI seam 입증) → 사용자 승인 후 admin path만 `orchestrateFullReport`로 swap (Task 2).
- **B18 보안 contract**: cron `monthly-batch` route는 `CRON_SECRET` env 검증 + 검증 실패 시 401 반환 + e2e test.

---

## Section A.0 — Read-only subagent OOS 검증 결과 (file:line 박제, T3 진입 전 완료)

### A.0.1 — RT#1 Section8ModernView.partA 14 rows 결함
- 위치: `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` line 640–750
- 상태: **결함 — partA 렌더 JSX 부재** (grep 0 hit). zod schema (`tudal/src/lib/report/section-8-schema.ts` line 48–50)는 partA length `0 || 14` 강제하지만 UI 미표시
- 조치: Task 4에서 line 696–750 사이 partA 14 rows 테이블/카드 렌더 신설

### A.0.2 — RT#3 aggregateVotes enum 보호
- 위치: `tudal/src/lib/data/admin-committee.ts` line 63–75
- 상태: TypeScript 레벨 안전 (VoteKind 'approve'|'reject'|'abstain'), **DB constraint 없음**, `transformCommitteeVoteRow` (line 23–36)에서 zod guard 없이 전달
- `partCToCommitteeAgg` (`report-section-schemas.ts` line 240–248)는 zod 검증으로 안전
- 조치: Task 5에서 (i) zod guard 추가 (`committeeVoteSchema.vote: z.enum(['approve','reject','abstain'])`) OR (ii) DB CHECK constraint 마이그 OR (iii) `aggregateVotes` 함수 내부 `Object.hasOwn(target, v.vote)` defensive guard. omxy R2 권고: "RLS 또는 enum validation 고려" — Task 5에서 (iii) defensive guard + zod 보강 선택

### A.0.3 — RT#4/RT#5 LLM string/array max bound 누락 (top 5)
- 위치: `tudal/src/lib/data/report-section-schemas.ts` + `tudal/src/lib/report/section-8-schema.ts`
- 누락 인벤토리 (subagent 박제):
  1. `reportSection0Schema.headline` (line 16) → `.max(200)`
  2. 모든 section의 `summary` (Sections 2~7 + Section 8 modern coreVoteRow.one_line) → `.max(1000)` (one_line은 `.max(300)`)
  3. `reportSection8LegacySchema.keyQuotes[].quote` (line 174–179) → `.max(500)`
  4. `coreVoteRowSchema.one_line` (`section-8-schema.ts` line 19) → `.max(300)`
  5. `thesis[]` array (Section 0 line 17) → `.max(10)`
- 조치: Task 6에서 top 5 max bound 추가 + 기존 tests 회귀 0 + 새 boundary tests 5건

---

## File Structure

### 신설 (8 files)
| File | Purpose |
|---|---|
| `tudal/src/app/(admin)/admin/portfolio/trigger-full-report-button.tsx` | T5 slice: admin trigger 버튼 컴포넌트 (server action 호출) |
| `tudal/src/app/(admin)/admin/portfolio/__tests__/trigger-full-report-button.test.tsx` | T5 slice: 버튼 행동 단위 테스트 (loading/success/error) |
| `tudal/src/lib/report/__tests__/full-report-writer-caller-di.test.ts` | T5: `commitFullReport` caller DI seam 단위 테스트 |
| `tudal/src/lib/report/__tests__/full-report-orchestrator-caller-di.test.ts` | Task 2: `orchestrateFullReport` caller DI seam 단위 테스트 |
| `tudal/src/app/api/cron/monthly-batch/__tests__/cron-secret-401.test.ts` | Task 7 B18: cron CRON_SECRET 401 e2e test (또는 기존 route.test.ts 확장) |
| `tudal/src/app/(admin)/admin/track-record/track-record-tabs.tsx` | Task 3: 누적/아카이브 탭 컴포넌트 (shadcn Tabs 사용) |
| `tudal/src/app/(admin)/admin/track-record/__tests__/track-record-tabs.test.tsx` | Task 3: 탭 행동 단위 테스트 |
| `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/__tests__/orchestrate-wire.test.ts` | Task 2: Regen orchestrateFullReport wire 단위 테스트 |

### 수정 (10 files)
| File | 변경 요약 |
|---|---|
| `tudal/src/app/(admin)/admin/portfolio/portfolio-panel.tsx` | Task 1: 신규 `<TriggerFullReportButton/>` 통합 |
| `tudal/src/lib/report/full-report-writer.ts` line 133–250 | Task 1: `commitFullReport`에 `client?: SupabaseClient` + `callerKind?: 'cron'\|'admin'` 파라미터 추가 (preflightHardcap + insertCostLog + RPC 모두 동일 client 사용). 기본값 = `await createClient()`. cron path는 service-role client 주입. |
| `tudal/src/lib/report/full-report-orchestrator.ts` line 127–250 | Task 2: 동일 패턴 — `client` + `callerKind` 파라미터 |
| `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/actions.ts` | Task 2: `orchestrateFullReport` 실 호출 wire (현재 quota counter only) |
| `tudal/src/app/(admin)/admin/track-record/page.tsx` | Task 3: 신규 `<TrackRecordTabs/>` 통합 + Server Component data fetch (누적/아카이브 분리) |
| `tudal/src/app/(admin)/admin/track-record/actions.ts` | Task 3: 누적 vs 월별 아카이브 fetch 분리 (`fetchTrackRecordCumulative` + `fetchTrackRecordArchive`) |
| `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` line 696–750 | Task 4: Section8ModernView partA 14 rows 렌더 |
| `tudal/src/lib/data/admin-committee.ts` line 63–75 | Task 5: `aggregateVotes` defensive enum guard (`Object.hasOwn` + skip unknown vote with warn) |
| `tudal/src/lib/data/report-section-schemas.ts` + `tudal/src/lib/report/section-8-schema.ts` | Task 6: top 5 max bound 추가 |
| `tudal/src/lib/admin/format-error.ts` | Task 9: PR4 신규 에러 키 + prefix 한국어 매핑 (예상 4~6 keys) |

---

## Task 1: T5 First Vertical Slice — admin trigger 버튼 + caller DI (commitFullReport) + minimum tests

**Files:**
- Create: `tudal/src/app/(admin)/admin/portfolio/trigger-full-report-button.tsx`
- Create: `tudal/src/app/(admin)/admin/portfolio/__tests__/trigger-full-report-button.test.tsx`
- Create: `tudal/src/lib/report/__tests__/full-report-writer-caller-di.test.ts`
- Modify: `tudal/src/lib/report/full-report-writer.ts:133` (commitFullReport signature)
- Modify: `tudal/src/app/(admin)/admin/portfolio/actions.ts` (신규 `triggerFullReport` server action)
- Modify: `tudal/src/app/(admin)/admin/portfolio/portfolio-panel.tsx` (버튼 통합)

### Step 1.1: Write failing test — caller DI seam (commitFullReport)

- [ ] **Step 1.1.1: Write the failing test**

```ts
// tudal/src/lib/report/__tests__/full-report-writer-caller-di.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('commitFullReport — caller DI seam', () => {
  beforeEach(() => vi.resetModules());

  it('uses injected client when provided (admin caller)', async () => {
    const fakeClient = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
    };
    vi.doMock('@/lib/cost/cost-logger', () => ({
      preflightHardcap: vi.fn().mockResolvedValue(undefined),
      insertCostLog: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@/lib/ai/full-report-client', () => ({
      callFullReport: vi.fn().mockResolvedValue({ content: '{}', inputTokens: 1, outputTokens: 1, costKrw: 1 }),
    }));
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await expect(
      commitFullReport({
        ticker: '005930',
        name: '삼성전자',
        sector: '반도체',
        month: '2026-06',
        tier1Verdict: 'BUY',
        consensusBadge: '🟢',
        financialsSummary: '',
        technicalsSummary: '',
        macroSummary: '',
        sectorReference: '',
        adminUserId: 'admin-uid',
        client: fakeClient as never,
        callerKind: 'admin',
      } as never),
    ).rejects.toThrow(); // RPC mock no data → throw OK
    expect(fakeClient.rpc).toHaveBeenCalled();
  });

  it('falls back to createClient when client param omitted (default behavior preserved)', async () => {
    const createClientSpy = vi.fn().mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: 'ok', error: null }),
    });
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
    vi.doMock('@/lib/cost/cost-logger', () => ({
      preflightHardcap: vi.fn().mockResolvedValue(undefined),
      insertCostLog: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@/lib/ai/full-report-client', () => ({
      callFullReport: vi.fn().mockResolvedValue({ content: '{}', inputTokens: 1, outputTokens: 1, costKrw: 1 }),
    }));
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await commitFullReport({ /* minimum valid input */ } as never).catch(() => {});
    expect(createClientSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 1.1.2: Run test — verify FAIL**

Run: `cd tudal && npx vitest run src/lib/report/__tests__/full-report-writer-caller-di.test.ts`
Expected: FAIL with "commitFullReport doesn't accept client/callerKind param" or signature mismatch.

- [ ] **Step 1.1.3: Modify commitFullReport signature to accept client + callerKind**

Edit `tudal/src/lib/report/full-report-writer.ts:133`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CommitFullReportInput {
  ticker: string;
  name: string;
  sector: string;
  month: string;
  tier1Verdict: string;
  consensusBadge: string;
  financialsSummary: string;
  technicalsSummary: string;
  macroSummary: string;
  sectorReference: string;
  adminUserId: string;
  // PR4 caller DI seam (Group D 잔여 + B8 박제)
  client?: SupabaseClient;
  callerKind?: 'cron' | 'admin';
}

export async function commitFullReport(
  input: CommitFullReportInput,
): Promise<CommitFullReportResult> {
  await preflightHardcap({
    month: input.month,
    callCount: 1,
    maxCostPerCallKrw: FULL_REPORT_MAX_COST_PER_CALL_KRW,
    client: input.client, // PR4: caller-supplied client (cost_log RLS)
  });

  const userPrompt = buildFullReportUserPrompt({ /* ... */ });
  const llm = await callFullReport({ /* ... */ adminUserId: input.adminUserId, client: input.client });
  const sections = parseAndValidate(llm.content, { ticker: input.ticker, month: input.month });
  const supabase = input.client ?? (await createClient()); // PR4: caller DI
  const { data, error } = await supabase.rpc('update_report_sections_0_7', { /* ... */ });
  // ... 나머지 변경 없음
}
```

**참고**: `preflightHardcap` 및 `insertCostLog` 도 `client?: SupabaseClient` 파라미터 받도록 cost-logger.ts 수정 필요 (cost_log RLS는 service-role client로 우회). callFullReport (`full-report-client.ts`)도 동일 client 받아 cost_log insert.

- [ ] **Step 1.1.4: Modify cost-logger.ts to accept client param**

Edit `tudal/src/lib/cost/cost-logger.ts`:

```ts
export async function preflightHardcap(input: {
  month: string;
  callCount: number;
  maxCostPerCallKrw?: number;
  client?: SupabaseClient; // PR4
}): Promise<void> {
  const supabase = input.client ?? (await createClient());
  // ... 기존 로직 (supabase 사용처를 input.client로 교체)
}

export async function insertCostLog(input: { /* ... */ client?: SupabaseClient }): Promise<void> {
  const supabase = input.client ?? (await createClient());
  // ... 기존 로직
}
```

- [ ] **Step 1.1.5: Modify full-report-client.ts (callFullReport) to pass client through**

Edit `tudal/src/lib/ai/full-report-client.ts`:

```ts
export async function callFullReport(input: {
  ticker: string;
  month: string;
  systemPrompt: string;
  userPrompt: string;
  adminUserId: string;
  client?: SupabaseClient; // PR4
}): Promise<{ content: string; inputTokens: number; outputTokens: number; costKrw: number }> {
  // ... LLM 호출 ...
  await insertCostLog({
    /* ... 기존 ... */
    client: input.client, // PR4: caller-supplied
  });
}
```

- [ ] **Step 1.1.6: Run test — verify PASS**

Run: `cd tudal && npx vitest run src/lib/report/__tests__/full-report-writer-caller-di.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 1.1.7: Run regression tests — verify no other test breaks**

Run: `cd tudal && npx vitest run src/lib/report`
Expected: PASS (PR3b tests 47 + PR3c tests +93 = 회귀 0).

- [ ] **Step 1.1.8: Commit**

```bash
git add tudal/src/lib/report/full-report-writer.ts tudal/src/lib/cost/cost-logger.ts tudal/src/lib/ai/full-report-client.ts tudal/src/lib/report/__tests__/full-report-writer-caller-di.test.ts
git commit -m "feat(PR4 Task1 step1): commitFullReport caller DI seam (client + callerKind)

- commitFullReport / preflightHardcap / insertCostLog / callFullReport 모두 caller-supplied client 받도록 signature 확장
- 기본값 보존 (createClient fallback). 회귀 0.
- 새 caller DI seam test 2개.
- B8 박제 + omxy R2 권고 T5 first vertical slice 시작."
```

### Step 1.2: Write failing test — triggerFullReport server action

- [ ] **Step 1.2.1: Write the failing test**

```ts
// tudal/src/app/(admin)/admin/portfolio/__tests__/trigger-full-report-action.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('triggerFullReport admin server action', () => {
  it('rejects when input.ticker missing', async () => {
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport({ ticker: '', month: '2026-06' } as never);
    expect(res).toEqual({ success: false, error: 'invalid_input' });
  });

  it('rejects when month format invalid', async () => {
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport({ ticker: '005930', month: '2026-6' });
    expect(res).toEqual({ success: false, error: 'invalid_month' });
  });

  it('returns success when commitFullReport succeeds', async () => {
    vi.doMock('@/lib/report/full-report-writer', () => ({
      commitFullReport: vi.fn().mockResolvedValue({ reportId: 'rpt-1' }),
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } } }) },
      }),
    }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport({ ticker: '005930', month: '2026-06' });
    expect(res).toEqual({ success: true, data: { reportId: 'rpt-1' } });
  });

  it('returns error when auth unavailable', async () => { /* ... */ });
  it('returns error when commitFullReport throws full_report_validation_failed', async () => { /* ... */ });
  it('returns error when commitFullReport throws full_report_cost_hardcap_exceeded', async () => { /* ... */ });
});
```

- [ ] **Step 1.2.2: Run test — verify FAIL**

Run: `cd tudal && npx vitest run src/app/\(admin\)/admin/portfolio/__tests__/trigger-full-report-action.test.ts`
Expected: FAIL with "triggerFullReport not exported".

- [ ] **Step 1.2.3: Implement triggerFullReport in actions.ts**

Edit `tudal/src/app/(admin)/admin/portfolio/actions.ts` (append below triggerMonthlyBatch):

```ts
// PR4 — triggerFullReport admin server action (Group D 잔여 + B8 박제 caller path)
// T5 first vertical slice = commitFullReport (fast) wire. Task 2에서 orchestrate path swap.

const TRIGGER_FULL_REPORT_TICKER_RE = /^\d{6}$/;
const TRIGGER_FULL_REPORT_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function triggerFullReport(input: {
  ticker: string;
  month: string;
}): Promise<
  | { success: true; data: { reportId: string } }
  | { success: false; error: string }
> {
  if (!input || typeof input.ticker !== 'string' || typeof input.month !== 'string') {
    return { success: false, error: 'invalid_input' };
  }
  if (!TRIGGER_FULL_REPORT_TICKER_RE.test(input.ticker)) {
    return { success: false, error: 'invalid_ticker' };
  }
  if (!TRIGGER_FULL_REPORT_MONTH_RE.test(input.month)) {
    return { success: false, error: 'invalid_month' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { success: false, error: 'auth_unavailable' };

  try {
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    // T5 slice: commitFullReport (fast). Task 2에서 orchestrateFullReport swap.
    const result = await commitFullReport({
      ticker: input.ticker,
      name: '', // Task 1 minimum stub — full wire는 Task 2에서 enriched input
      sector: '',
      month: input.month,
      tier1Verdict: '',
      consensusBadge: '',
      financialsSummary: '',
      technicalsSummary: '',
      macroSummary: '',
      sectorReference: '',
      adminUserId: user.id,
      client: supabase, // admin SSR session client
      callerKind: 'admin',
    });
    return { success: true, data: { reportId: result.reportId } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'commit_full_report_failed',
    };
  }
}
```

- [ ] **Step 1.2.4: Run test — verify PASS**

Expected: 6 tests PASS.

- [ ] **Step 1.2.5: Commit**

```bash
git add tudal/src/app/\(admin\)/admin/portfolio/actions.ts tudal/src/app/\(admin\)/admin/portfolio/__tests__/trigger-full-report-action.test.ts
git commit -m "feat(PR4 Task1 step2): triggerFullReport admin server action (commitFullReport wire)

- ticker/month regex validation
- auth.uid() 필수
- commitFullReport (client SSR + callerKind 'admin') 호출
- 6 unit tests. T5 slice scope."
```

### Step 1.3: Trigger 버튼 컴포넌트 + portfolio-panel 통합

- [ ] **Step 1.3.1: Create trigger-full-report-button.tsx**

```tsx
// tudal/src/app/(admin)/admin/portfolio/trigger-full-report-button.tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { triggerFullReport } from './actions';
import { formatErrorMessage } from '@/lib/admin/format-error';

export function TriggerFullReportButton({ ticker, month, name }: { ticker: string; month: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  function onClick() {
    setFeedback(null);
    startTransition(async () => {
      const res = await triggerFullReport({ ticker, month });
      if (res.success) {
        setFeedback({ kind: 'success', msg: `리포트 생성 완료 (${res.data.reportId.slice(0, 8)}…)` });
      } else {
        setFeedback({ kind: 'error', msg: formatErrorMessage(res.error) });
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" onClick={onClick} disabled={pending} aria-busy={pending} variant="default" size="sm">
        {pending ? '생성 중…' : `${name} 리포트 생성`}
      </Button>
      {feedback && (
        <span className={feedback.kind === 'success' ? 'text-xs text-emerald-600' : 'text-xs text-rose-600'} role="status">
          {feedback.msg}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 1.3.2: Create trigger-full-report-button.test.tsx**

```tsx
// tudal/src/app/(admin)/admin/portfolio/__tests__/trigger-full-report-button.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../actions', () => ({ triggerFullReport: vi.fn() }));

describe('TriggerFullReportButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows ticker name on button', async () => {
    const { TriggerFullReportButton } = await import('../trigger-full-report-button');
    render(<TriggerFullReportButton ticker="005930" month="2026-06" name="삼성전자" />);
    expect(screen.getByRole('button')).toHaveTextContent('삼성전자 리포트 생성');
  });

  it('disables button + shows loading on click', async () => { /* ... */ });
  it('shows success feedback on commit success', async () => { /* ... */ });
  it('shows korean error message on commit failure', async () => { /* ... */ });
});
```

- [ ] **Step 1.3.3: Run test — verify FAIL → PASS**

Run: `cd tudal && npx vitest run src/app/\(admin\)/admin/portfolio/__tests__/trigger-full-report-button.test.tsx`
Expected: FAIL (no @testing-library/react setup) → install if needed → PASS 4 tests.

**참고**: `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` env 미설치 시 옵션:
- (i) install: `npm i -D @testing-library/react @testing-library/jest-dom jsdom`
- (ii) jsdom vitest config 활성화 (vitest.config.ts에 `test.environment: 'jsdom'` 추가)
- omxy R2 권고 = "general-purpose 병렬 dispatch 폐기" → component test infra 도입은 본 PR scope. test 인프라 도입은 사용자 승인 필요할 수 있음 → **T5 gate에서 결정**

- [ ] **Step 1.3.4: Integrate TriggerFullReportButton into portfolio-panel.tsx**

Edit `tudal/src/app/(admin)/admin/portfolio/portfolio-panel.tsx`:
- import `TriggerFullReportButton`
- 각 portfolio item 옆에 버튼 렌더 (또는 `/admin/portfolio` 페이지 상단 batch action 영역에 단일 버튼)

- [ ] **Step 1.3.5: Run build + lint**

Run: `cd tudal && npm run build && npm run lint`
Expected: build 25 routes / lint 0 err.

- [ ] **Step 1.3.6: Commit**

```bash
git add tudal/src/app/\(admin\)/admin/portfolio/trigger-full-report-button.tsx tudal/src/app/\(admin\)/admin/portfolio/portfolio-panel.tsx tudal/src/app/\(admin\)/admin/portfolio/__tests__/trigger-full-report-button.test.tsx
git commit -m "feat(PR4 Task1 step3): TriggerFullReportButton component + portfolio-panel integration

- /admin/portfolio에 admin trigger 버튼 1개 신규 (commitFullReport wire)
- shadcn Button + aria-busy + role=status feedback
- 한국어 UI 문구 ('생성 중…' / '리포트 생성 완료' / formatErrorMessage)
- Component test 4건 (@testing-library/react 의존 — T5 gate에서 infra 결정)
- omxy R2 권고 T5 first vertical slice 완료."
```

### Step 1.4: Verification (T5 gate 준비)

- [ ] **Step 1.4.1: Run 3-gate verification**

Run: `cd tudal && npm run build && npm run lint && npm run test:ci`
Expected: build 25 routes / lint 0 err / test:ci 1010 + ~9 신규 = ~1019 PASS.

- [ ] **Step 1.4.2: Manual browser smoke (옵션 — gstack-browse skill 사용 X)**

`cd tudal && npm run dev` → `http://localhost:3000/admin/portfolio` 접근 → 새 trigger 버튼 보이는지 + 클릭 시 loading 표시 + success/error feedback.

- [ ] **Step 1.4.3: T5 사용자 검토 gate 보고**

사용자에게 보고:
- Task 1 (T5 first vertical slice) 완료
- 변경 stat (files, +/-, tests +N)
- 검증 게이트 결과
- 다음 = Task 2 (Regen orchestrate wire) 또는 사용자 검토 후 swap (admin path를 commit → orchestrate)

**T5 사용자 검토 통과 후 Task 2 진입.**

---

## Task 2: Regen 실 호출 wire (orchestrateFullReport) + admin path swap

**Files:**
- Modify: `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/actions.ts` (orchestrateFullReport 실 호출 wire)
- Modify: `tudal/src/app/(admin)/admin/portfolio/actions.ts` (triggerFullReport → orchestrateFullReport swap)
- Create: `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/__tests__/orchestrate-wire.test.ts`
- Create: `tudal/src/lib/report/__tests__/full-report-orchestrator-caller-di.test.ts`
- Modify: `tudal/src/lib/report/full-report-orchestrator.ts:127` (caller DI seam — same pattern as commitFullReport)

### Step 2.1: orchestrateFullReport caller DI seam

- [ ] **Step 2.1.1: Write the failing test** (full-report-orchestrator-caller-di.test.ts — same pattern as Task 1 Step 1.1.1)
- [ ] **Step 2.1.2: Run — verify FAIL**
- [ ] **Step 2.1.3: Modify orchestrateFullReport signature** (Task 1 Step 1.1.3 pattern 동일)
- [ ] **Step 2.1.4: Run — verify PASS**
- [ ] **Step 2.1.5: Commit**

### Step 2.2: triggerFullReport admin path swap (commit → orchestrate)

- [ ] **Step 2.2.1: Modify triggerFullReport** in `actions.ts`:

```ts
const { orchestrateFullReport } = await import('@/lib/report/full-report-orchestrator');
const result = await orchestrateFullReport({
  /* same input */
  client: supabase,
  callerKind: 'admin',
});
```

- [ ] **Step 2.2.2: Update trigger-full-report-action.test.ts** (mock target swap)
- [ ] **Step 2.2.3: Run tests — verify PASS**
- [ ] **Step 2.2.4: Commit**

### Step 2.3: Regen actions.ts orchestrate wire

- [ ] **Step 2.3.1: Read existing regenerate/actions.ts to understand current quota counter behavior**
- [ ] **Step 2.3.2: Write failing test** for orchestrate wire
- [ ] **Step 2.3.3: Implement orchestrate call** (quota check first → orchestrate → return reportId)
- [ ] **Step 2.3.4: Run tests — verify PASS**
- [ ] **Step 2.3.5: Commit**

---

## Task 3: Track Record 탭 분리 (누적 vs 월별 아카이브) — Group A + F 해소

**Files:**
- Create: `tudal/src/app/(admin)/admin/track-record/track-record-tabs.tsx`
- Create: `tudal/src/app/(admin)/admin/track-record/__tests__/track-record-tabs.test.tsx`
- Modify: `tudal/src/app/(admin)/admin/track-record/page.tsx` (Server Component data fetch 분리)
- Modify: `tudal/src/app/(admin)/admin/track-record/actions.ts` (`fetchTrackRecordCumulative` + `fetchTrackRecordArchive` 신규)

### Step 3.1: actions.ts — 누적 + 아카이브 fetch 분리

- [ ] **Step 3.1.1: Write failing test** for fetchTrackRecordCumulative + fetchTrackRecordArchive
- [ ] **Step 3.1.2: Implement** — `fetchTrackRecordCumulative` (전체 기간 누적 성과 — approved 리포트들의 portfolio_snapshots 합산) + `fetchTrackRecordArchive(month: string)` (월별 stock_reports + approval 결과)
- [ ] **Step 3.1.3: Run — verify PASS**
- [ ] **Step 3.1.4: Commit**

### Step 3.2: TrackRecordTabs component (shadcn Tabs 사용)

- [ ] **Step 3.2.1: Write component + test**

```tsx
// tudal/src/app/(admin)/admin/track-record/track-record-tabs.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // shadcn

export function TrackRecordTabs({ cumulative, archives }: { cumulative: ...; archives: ... }) {
  return (
    <Tabs defaultValue="cumulative">
      <TabsList>
        <TabsTrigger value="cumulative">누적 성과</TabsTrigger>
        <TabsTrigger value="archive">월별 아카이브</TabsTrigger>
      </TabsList>
      <TabsContent value="cumulative">{/* render cumulative */}</TabsContent>
      <TabsContent value="archive">{/* render archives */}</TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 3.2.2: Run component test — verify PASS**
- [ ] **Step 3.2.3: Integrate into page.tsx (Server Component)**
- [ ] **Step 3.2.4: Run build/lint — verify**
- [ ] **Step 3.2.5: Commit**

---

## Task 4: PR3a OOS RT#1 — Section8ModernView.partA 14 rows 렌더

**Files:**
- Modify: `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` line 640–750 (Section8ModernView)
- Modify: `tudal/src/lib/data/__tests__/report-section-schemas.test.ts` (partA render assertion)

### Step 4.1: Render partA 14 rows in Section8ModernView

- [ ] **Step 4.1.1: Read existing Section8ModernView (line 640–750)**
- [ ] **Step 4.1.2: Add partA rendering JSX** — 14 personas × vote/conviction/one_line 카드 그리드 or 테이블
- [ ] **Step 4.1.3: Handle Tier 2 inactive fallback** (`partA.length === 0` 시 `SectionFallback` 또는 empty state 안내)
- [ ] **Step 4.1.4: Add 한국어 UI labels** (예: '섹터 14인 패널 의견')
- [ ] **Step 4.1.5: Run build/lint — verify**
- [ ] **Step 4.1.6: Commit**

---

## Task 5: PR3a OOS RT#3 — aggregateVotes defensive enum guard

**Files:**
- Modify: `tudal/src/lib/data/admin-committee.ts` line 63–75 (aggregateVotes)
- Modify: `tudal/src/lib/data/__tests__/admin-committee.test.ts` (or 신규 test file) — invalid enum case

### Step 5.1: Defensive guard in aggregateVotes

- [ ] **Step 5.1.1: Write failing test** — invalid vote ('unknown') 입력 시 unknown은 skip + count에 영향 없음 + console.warn 1회
- [ ] **Step 5.1.2: Run — verify FAIL** (현재 코드 → `target['unknown']` undefined access)
- [ ] **Step 5.1.3: Add guard**:

```ts
const VALID_VOTES = new Set(['approve', 'reject', 'abstain']);

export function aggregateVotes(votes: CommitteeVote[]): { /* ... */ } {
  const core = init(); const sector = init();
  for (const v of votes) {
    if (!VALID_VOTES.has(v.vote)) {
      console.warn(
        `[aggregateVotes] invalid_vote_skipped vote=${String(v.vote)} personaLayer=${v.personaLayer}`,
      );
      continue;
    }
    const target = v.personaLayer === 'core' ? core : sector;
    target[v.vote] += 1;
  }
  return { core, sector };
}
```

- [ ] **Step 5.1.4: Run — verify PASS**
- [ ] **Step 5.1.5: Commit**

---

## Task 6: PR3a OOS RT#4/RT#5 — LLM string/array max bound top 5

**Files:**
- Modify: `tudal/src/lib/data/report-section-schemas.ts` (Section 0/2~7/Section 8 legacy max bound)
- Modify: `tudal/src/lib/report/section-8-schema.ts` (Section 8 modern max bound)
- Modify: `tudal/src/lib/data/__tests__/report-section-schemas.test.ts` (boundary tests)

### Step 6.1: Add top 5 max bound

- [ ] **Step 6.1.1: Write 5 failing boundary tests** (max+1 길이 reject)
- [ ] **Step 6.1.2: Run — verify FAIL**
- [ ] **Step 6.1.3: Add `.max(N)` chains**:
  - `reportSection0Schema.headline.max(200)`
  - 모든 `summary.max(1000)` (sections 2~7)
  - `keyQuotes[].quote.max(500)`
  - `coreVoteRowSchema.one_line.max(300)` (section-8-schema.ts)
  - `thesis: z.array(...).max(10)`
- [ ] **Step 6.1.4: Run — verify PASS** (5 new + 회귀 0)
- [ ] **Step 6.1.5: Commit**

---

## Task 7: B18 CRON_SECRET 401 test

**Files:**
- Modify: `tudal/src/app/api/cron/monthly-batch/__tests__/route.test.ts` (또는 신규 cron-secret-401.test.ts) — 401 negative test 보강

### Step 7.1: CRON_SECRET 401 e2e tests

- [ ] **Step 7.1.1: Read existing route.test.ts** (silent-health/morning-briefing/news-sweep 패턴 참조 — `headers: { authorization: "Basic cron-secret" }` invalid schema test 이미 있음)
- [ ] **Step 7.1.2: Verify monthly-batch route.test.ts has 401 negative cases**:
  - (a) no Authorization header → 401
  - (b) wrong scheme (Basic instead of Bearer) → 401
  - (c) wrong secret value → 401
  - (d) CRON_SECRET env undefined in production → 401 (MF4 fail-closed)
- [ ] **Step 7.1.3: Add missing 401 tests if absent**
- [ ] **Step 7.1.4: Run — verify PASS**
- [ ] **Step 7.1.5: Commit**

---

## Task 8: Track 2/3 defer 20 cherry-pick (cleanup only)

Track 2 defer (PR3c body 박제) 12 + Track 3 defer 8 = 20 items.

**Cherry-pick scope** (low risk + 1 line fixes):
- PR3b W2: Anthropic timeout/maxRetries 추가 (full-report-client.ts + critic-client.ts + revise-client.ts) — **본 PR4에서 해소** (high value, 1-line per file)
- PR3b W4: `AI_COST_LOG_REAL_INSERT_ENABLED` strict 검증 — **본 PR4** (boolean parse)
- PR3b W5: __dirname ESM compat — **본 PR4** (low risk)
- PR3c W1: RPC error 텍스트 — **defer (별도 i18n PR)**
- PR3c W7: enriched.* vs input.* 일관성 — **본 PR4** (orchestrator.ts grep)
- 나머지 15 P2/Info → **defer 명시** (PR body에 follow-up ticket list)

### Step 8.1: Cherry-pick 4 high-value defer

- [ ] **Step 8.1.1: PR3b W2 — Anthropic timeout/maxRetries**

```ts
// full-report-client.ts / critic-client.ts / revise-client.ts
const client = new Anthropic({
  apiKey,
  timeout: 60_000, // 60s
  maxRetries: 2,
});
```

- [ ] **Step 8.1.2: PR3b W4 — AI_COST_LOG_REAL_INSERT_ENABLED strict**
- [ ] **Step 8.1.3: PR3b W5 — __dirname ESM**
- [ ] **Step 8.1.4: PR3c W7 — enriched vs input 일관성**
- [ ] **Step 8.1.5: Run tests — verify PASS (회귀 0)**
- [ ] **Step 8.1.6: Commit**

---

## Task 9: format-error 신규 키 + 최종 검증 게이트

**Files:**
- Modify: `tudal/src/lib/admin/format-error.ts`
- Modify: `tudal/src/lib/admin/__tests__/format-error.test.ts`

### Step 9.1: PR4 신규 에러 키

- [ ] **Step 9.1.1: 인벤토리** — Task 1~8에서 발생할 수 있는 에러 코드:
  - `invalid_ticker`, `commit_full_report_failed`, `orchestrate_full_report_failed`
  - `regen_quota_exceeded`, `regen_already_in_progress`
  - `track_record_fetch_failed`
  - Section 8 partA `partA_render_failed_no_data`
  - prefix: `full_report_*`, `orchestrate_*`, `regen_*`
- [ ] **Step 9.1.2: Add Korean mappings + prefix handlers**
- [ ] **Step 9.1.3: Run format-error tests — verify PASS**
- [ ] **Step 9.1.4: Commit**

### Step 9.2: 최종 3-gate 검증

- [ ] **Step 9.2.1: Run full verification**

```bash
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

Expected:
- build 25 routes (no new routes — admin trigger은 기존 portfolio page 내부)
- lint 0 err, 6 warn (baseline)
- test:ci 1010 → ~1075~1090 PASS (Task 1~8 +~70 tests, 회귀 0)
- tsc clean

- [ ] **Step 9.2.2: Run grep gates** (PR3c +1 추가 = 23 gates)

```bash
# PR3c default 22 gates 유지 + PR4 추가:
grep -rn "client as never" tudal/src --include='*.ts' | wc -l  # 0이어야 함 (caller DI 어서션 회피)
grep -rn "throw new Error.*tier0_source_not_wired_pr1_followup\|throw new Error.*persona_panel_not_wired_pr1_followup\|throw new Error.*commit_badge_only_not_wired_pr1_followup" tudal/src --include='*.ts' | grep -v __tests__ | wc -l  # >= 3 (Tier 1/0 wire는 별도 PR scope, 의도된 throw 유지)
```

- [ ] **Step 9.2.3: T10 사용자 검토 gate 보고**

사용자에게 보고:
- 전체 변경 stat (files, +/-, test +N)
- 검증 게이트 결과
- omxy 누적 BLOCKERS (T4 + T7 + T9 합산)
- 3-track deep review 결과 (T8)
- PR body draft (rollback ranges, defer follow-up)
- push + PR create 승인 요청

---

## Self-Review (writing-plans skill checklist)

### 1. Spec coverage
- ✅ Group A (track-record trigger 위치): Task 3 + Task 1 (admin trigger 버튼이 /admin/portfolio에 신설)
- ✅ Group F (Track Record 누적 vs 아카이브 탭 분리): Task 3
- ✅ Group D 잔여 (UI caller wire): Task 1 (commitFullReport DI) + Task 2 (orchestrateFullReport DI + Regen wire + admin path swap)
- ✅ PR3a OOS RT#1 partA 14 rows: Task 4
- ✅ PR3a OOS RT#3 aggregateVotes enum: Task 5
- ✅ PR3a OOS RT#4/5 LLM max bound: Task 6
- ✅ B18 CRON_SECRET 401 test: Task 7
- ✅ Track 2/3 defer 20: Task 8 (4 cherry-pick + 16 defer → PR body)
- ✅ format-error 신규 키: Task 9

### 2. Placeholder scan
- 일부 step의 "..." 또는 "TBD" 패턴 → 실제 코드 step 작성 시 inline expansion. **Task 2.2/3.1/3.2의 "/* ... */" 표기는 plan의 brevity 위함** — 실제 impl 시 Task 1.1~1.3 pattern 그대로 재사용.
- "Add appropriate error handling" 등 모호 표현 ❌ 없음. 모든 step은 구체적 코드/명령.

### 3. Type consistency
- `commitFullReport` (Task 1) + `orchestrateFullReport` (Task 2): caller DI 동일 signature (`client?: SupabaseClient; callerKind?: 'cron' | 'admin'`)
- `preflightHardcap` / `insertCostLog` / `callFullReport`: 동일 `client?` param 추가
- `triggerFullReport` (Task 1) + `triggerMonthlyBatch` (PR1 기존): 동일 server action 반환 규약 (`{success: true, data} | {success: false, error}`)
- `TrackRecordTabs.props` (Task 3) + `actions.ts fetch*` 반환: 일관 타입 (각 fetch 함수가 명시적 interface 반환)
- `aggregateVotes` (Task 5) + `partCToCommitteeAgg` (PR3a 기존): both 동일 `CommitteeVoteAggregate` 반환

### 4. omxy R2 결정 정합
- ✅ Claude 단독 implementer (모든 Task)
- ✅ omxy = T4 plan review + T7 plan-vs-commit + T9 final
- ✅ 단일 PR
- ✅ T5 first vertical slice = Task 1 (`commitFullReport` wire, admin trigger 버튼 1개)
- ✅ T8 3-track 축소판 = gstack-review skill inline + 5-angle scan subagent 1회 + omxy final (depth=deep general-purpose 폐기)
- ✅ T2/T5/T10 3-gate
- ✅ subagent: read-only OOS 검증 1회만 (완료, Section A.0)
- ✅ skill inline read-through: writing-plans (본 plan) → TDD (T6) → verification (T6/T9) → requesting-code-review (T8)

---

## Acceptance Criteria (PR body draft 박제)

### 코드
- [ ] caller DI seam (commitFullReport + orchestrateFullReport) — fast/quality 두 path 명확 분리
- [ ] admin trigger 버튼 /admin/portfolio 동작 (한국어 UI + aria + role=status)
- [ ] Regen 실 호출 (orchestrateFullReport) wire (quota counter 유지)
- [ ] Track Record 탭 (누적 + 월별 아카이브) 동작
- [ ] Section 8 modern partA 14 rows 렌더 + empty state fallback
- [ ] aggregateVotes invalid vote skip + warn
- [ ] LLM max bound top 5 + 5 boundary tests

### 보안
- [ ] B18: CRON_SECRET 401 test 4종 (no header / wrong scheme / wrong value / production env)
- [ ] service-role client 노출 0 (all calls server-side)

### 검증
- [ ] build 25 routes / lint 0 err / test:ci +70~80 (회귀 0) / tsc clean
- [ ] grep gates 23종 통과

### Defer (16 P2/Info → follow-up ticket)
- PR3c Track 2: W1 RPC error 텍스트 (i18n PR) / W3 zod 주석 / W4 RPC return shape / W5 cast / W6 contract test SQL↔TS drift / W8 report_id uuid guard / I1~I10 cross-module import 외
- PR3c Track 3: C-2/C-3 INFO / P-1 enrichInput coupling / P-2 orchestrate_failed 디테일 / P-3 vi.mock TDZ pattern

---

## Rollback Ranges (PR4 merge 후 박제)

- OLD_MAIN=`e94b365` (PR3c post-final sync)
- AFTER_PR4=(merge 후 runtime)
- Revert PR4 only: `git revert --no-edit OLD_MAIN..AFTER_PR4` (커밋 수 runtime)
- Migration rollback: PR4는 마이그 0개 (스키마 변경 없음, RT#3 defensive guard는 코드 레벨)

---

## 진행 순서 (요약)

1. **T3 완료** = 본 plan v1 commit
2. **T4** = omxy 적대적 검토 R1~Rn → CONVERGED + BLOCKERS catch & fix
3. **T5** = 사용자 plan lock-in
4. **T6 = Task 1** (T5 first vertical slice) → T5 gate 통과 → Task 2~9 순차
5. **T7** = omxy plan-vs-commit verify (각 Task 후 또는 통합)
6. **T8** = 3-track deep review 축소판 (gstack-review inline + 5-angle scan subagent + omxy final)
7. **T9** = Fix-First adoption + omxy final R verify
8. **T10** = 사용자 T10 gate → push + PR create
