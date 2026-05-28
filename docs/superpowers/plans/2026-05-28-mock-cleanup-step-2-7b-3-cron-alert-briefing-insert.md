# Mock cleanup Step 2.7b.3 — Cron alert_event 3-source + briefing_log INSERT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3 cron route의 alert_event INSERT 실 path 가동 (silent-health heartbeat_missing + news-sweep news_critical + morning-briefing briefing_failed) + morning-briefing briefing_log INSERT 실 path 가동.

**Architecture:**
- (1) 통합 helper `insertAlertEvents(events, {client?})` — `Omit<AlertEvent,'id'|'isRead'>[]` array batch INSERT, camelCase→snake_case 매핑 단일 지점, ALERT_TYPE_SET enum guard.
- (2) `insertBriefingLog(record, {client?})` — `Omit<BriefingLog,'id'|'viewEvents'>` ON CONFLICT (date) DO UPDATE upsert (heartbeat_log Step 2.7b.2 패턴 정합).
- (3) 3 route wiring: silent-health (missingAlert) + news-sweep (alerts[]) + morning-briefing (alertPayload + logPayload). service-role client 재사용.
- (4) 0 migrations — alert_event schema 0010 + briefing_log schema 0006 production 적용 완료.

**Tech Stack:** Next.js 16 App Router · @supabase/supabase-js · service-role client (B17 boundary, 3 cron 모두 등록) · Vitest TDD.

---

## §0 Architectural Decisions (omxy R-debate scope guard)

### D1. alert_event idempotency = INSERT only (append-only audit, 마이그 0)
- **Why**: alert_event는 0010 schema상 **UNIQUE 인덱스 없음** (signal_sent_at desc + (type,severity,signal_sent_at) index만). operational audit log 본질 = append-only. cron은 daily 1회 (재실행은 예외 운영).
- **3-source 중복 위험 분석**:
  - heartbeat_missing: silent-health 일 1회, allFailed 시만 (2채널 발송 + catch-up 모두 실패) → 발생 빈도 매우 낮음. 중복 = cron 재실행 시만.
  - briefing_failed: morning-briefing 일 1회, generationFailed 시만 → 동일.
  - news_critical: news-sweep 일 1회, criticals만. news_event는 url-unique로 dedupe되지만 alert는 매 run 재발행 가능. 단 production news_event=0 + daily cron이라 실무상 미미.
- **결정**: INSERT only (append). dashboard noise는 `is_read` 토글 + mark_alert_read RPC로 관리. dedup unique index는 **W-defer** (`W-alert-event-dedup`, 마이그 0026 별도 트랙 — 본 PR scope = INSERT 실 path 가동이지 dedup 인프라 아님).
- **append-only 중복 risk 명시 (omxy R1 — dedup defer는 documented 시 non-blocker)**: cron 재실행(수동 또는 Vercel retry) 시 동일 heartbeat_missing/briefing_failed(date 동일) + news_critical(동일 criticals 재발행) 중복 row 가능. production news_event=0 + cron daily 1회 전제에서 실무 빈도 미미하나, PR5 cron 30 자동 가동 + 빈번한 alert 시점에 dashboard noise 가능 → W-alert-event-dedup에서 partial unique index로 차단 예정. 그 전까지는 `is_read` 운영으로 흡수.
- **Reject 대안 B (마이그 0026 dedup index)**: scope creep. heartbeat/briefing은 (type, signal_sent_at::date) partial unique 가능하나 news_critical은 dedup key 설계 복잡 (ticker+title hash). 별도 PR.
- **Reject 대안 C (pre-check SELECT)**: race condition + RLS 우회 SELECT 추가 비용.

### D2. briefing_log idempotency = ON CONFLICT (date) DO UPDATE (upsert)
- **Why**: briefing_log는 0006 schema상 **date UNIQUE** (briefing_log_date_uniq). heartbeat_log Step 2.7b.2 D1과 동일 — cron 재실행 / 수동 trigger 시 latest content로 갱신.
- **Update columns**: content_summary, generated_at, sent_channels, generation_failed. **Invariant**: date(UNIQUE) 키 보존.
- **Reject 대안 (DO NOTHING)**: 첫 generationFailed=true row가 영구 잔존 → 재실행 성공 시 false positive.

### D3. Helper design
- **alert_event 통합**: `tudal/src/lib/data/admin-alerts-insert.ts` 기존 file에 `insertAlertEvents(events, {client?})` 추가 (기존 `recordSchedulerFailAlert` DI-only 패턴은 보존 — scope creep 차단).
  - input = `Omit<AlertEvent,'id'|'isRead'>[]` (3-source 동일 shape).
  - empty array short-circuit (insertNewsEvents Step 2.7b.2 패턴).
  - ALERT_TYPE_SET enum guard (12종 alert_type CHECK 1:1 — pre-loop, invalid 섞인 batch도 DB 호출 전 차단).
  - camelCase→snake_case 매핑 (recordSchedulerFailAlert 9 컬럼 매핑 정합): alert_type / ticker / severity / trigger_reason / signal_sent_at / outcome_at / t7_price_change / decision_recorded / decision_memo.
  - batch `.insert(rows)` (UNIQUE 없으므로 onConflict 불필요).
- **briefing_log**: `tudal/src/lib/data/admin-briefing-log.ts` 신규 (heartbeat_log helper 패턴 정합).
  - `insertBriefingLog(record, {client?})`: `.upsert({onConflict:'date'})`.

### D4. Migration = 0
- alert_event schema 0010 (production 적용 완료, alert_type CHECK 12종 + RLS admin insert).
- briefing_log schema 0006 (production 적용 완료, date UNIQUE).
- RLS는 `is_admin()` → service-role client는 RLS 우회 (cron context 정합).

### D5. 3 route wiring
- **silent-health** (`route.ts`): `missingAlert` (allFailed 시 생성, line ~155) → `insertAlertEvents([missingAlert], {client: serviceRoleClient})`. missingAlert가 null이면 빈 배열 → short-circuit. 기존 heartbeat_log INSERT 직후 추가.
- **news-sweep** (`route.ts`): `alerts` (criticals map, line ~131) → `insertAlertEvents(alerts, {client: serviceRoleClient})`. 기존 news_event INSERT 직후 추가. serviceRoleClient lazy null-check 재사용.
- **morning-briefing** (`route.ts`): (a) `logPayload` (line ~109) → `insertBriefingLog(logPayload, {client: serviceRoleClient})` + (b) `alertPayload` (line ~112, generationFailed 시) → `insertAlertEvents(alertPayload ? [alertPayload] : [], {client})`. createServiceRoleClient는 이미 getRecentNewsEvents에서 사용 중 → 변수로 추출 재사용.

### D6. Retry / failure 처리 = **independent best-effort** (omxy R1 MED-2 fix)
- **결정 (dependent skip → independent best-effort 변경)**: alert_event INSERT는 heartbeat_log/news_event/briefing_log INSERT와 **독립 audit**. 각 INSERT는 **독립 try/catch**로 둘 다 시도. heartbeat_log INSERT 실패가 heartbeat_missing alert를 skip시키면 audit 유실 → 운영자가 발송 실패를 모르게 됨 (omxy 우려). 따라서 schema-specific 실패(CHECK 위반 등)에서는 독립적으로 적재.
- **dbError 집계**: 각 try/catch에서 `dbError ??= err.message` (첫 실패 메시지 보존, 둘 다 시도 보장). 둘 중 하나라도 실패 시 5xx.
- **DB 전체 장애 시**: 둘 다 같은 service-role client → 양쪽 실패 가능하나, 그래도 각각 시도 (best-effort). dbError는 첫 실패 기록.
- INSERT 실패 = `dbError` audit body + 5xx (Step 2.7b.2 D3 패턴 정합).
- **route test invariant**: "first INSERT(heartbeat_log/news_event/briefing_log) 실패 + second INSERT(alert) 성공 → 둘 다 호출됨(skip 0) + dbError = first error" (MED-2 검증).
- **Outer retry**: Vercel cron daily cadence. INSERT 자체 retry 없음.

### D7. service-role boundary (omxy R1 MED-3 fix — boundary contradiction 해소)
- **현재 모순**: `service-role.ts` B17 boundary가 `admin-alerts-insert.ts`를 **"금지 (DI-only 패턴 — supabase: SupabaseClient를 인자로 받음)"** 목록에 둠. 본 plan이 `insertAlertEvents`에 `options.client?` + createClient fallback 추가 → 모순.
- **해소**: `admin-alerts-insert.ts`를 service-role.ts "금지 DI-only" 목록 → **"허용 (DI seam을 통한 cron 호출자 service-role 주입)"** 목록으로 **이동**. 단 기존 `recordSchedulerFailAlert(input: {supabase})` DI-only 동작은 **그대로 보존** (별도 함수, 변경 0). 신규 `insertAlertEvents(events, {client?})`만 options.client? 패턴.
- `admin-briefing-log.ts`도 동일 "허용 DI seam" 목록 추가.
- 0 신규 service-role import (3 cron route는 이미 등록).

### D8. Scope-out (W-defer)
- **W-alert-event-dedup** (마이그 0026 별도 PR) — alert_event partial unique index (heartbeat/briefing date-based + news ticker+hash). 중복 alert 차단 인프라.
- **W-portfolio-snapshot-real** (S7b) — morning-briefing portfolioSnapshot 실 SELECT (잔존).

---

## §1 File Structure (touched files lock-in)

**Create**:
- `tudal/src/lib/data/admin-briefing-log.ts` — briefing_log INSERT helper + DI seam.
- `tudal/src/lib/data/__tests__/admin-briefing-log.test.ts` — TDD invariants.
- `tudal/src/lib/data/__tests__/admin-alerts-insert-batch.test.ts` — insertAlertEvents TDD invariants (기존 admin-alerts-insert.test.ts와 분리 — recordSchedulerFailAlert 테스트 보존).

**Modify**:
- `tudal/src/lib/data/admin-alerts-insert.ts` — `insertAlertEvents` + ALERT_TYPE_SET export 추가.
- `tudal/src/app/api/cron/silent-health/route.ts` — alert_event INSERT wiring (missingAlert).
- `tudal/src/app/api/cron/silent-health/__tests__/route.test.ts` — alert INSERT test.
- `tudal/src/app/api/cron/news-sweep/route.ts` — alert_event INSERT wiring (alerts[]).
- `tudal/src/app/api/cron/news-sweep/__tests__/route.test.ts` — alert INSERT test.
- `tudal/src/app/api/cron/morning-briefing/route.ts` — briefing_log + alert_event INSERT wiring + dbError.
- `tudal/src/app/api/cron/morning-briefing/__tests__/route.test.ts` — briefing_log + alert INSERT test.
- `tudal/src/lib/supabase/service-role.ts` — boundary 주석 갱신.

---

## §2 Tasks

### Task 1: insertAlertEvents 통합 helper + TDD

**Files:**
- Modify: `tudal/src/lib/data/admin-alerts-insert.ts`
- Test: `tudal/src/lib/data/__tests__/admin-alerts-insert-batch.test.ts`

- [ ] **Step 1.1: Write failing tests**

```typescript
// tudal/src/lib/data/__tests__/admin-alerts-insert-batch.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertEvent } from "@/types/admin";

describe("insertAlertEvents", () => {
  const events: Array<Omit<AlertEvent, "id" | "isRead">> = [
    {
      alertType: "news_critical",
      ticker: "005930",
      severity: "critical",
      triggerReason: "삼성전자 매출 급락 — critical (Naver)",
      signalSentAt: "2026-05-28T00:00:00.000Z",
      outcomeAt: null,
      t7PriceChange: null,
      decisionRecorded: null,
      decisionMemo: null,
    },
    {
      alertType: "heartbeat_missing",
      ticker: null,
      severity: "critical",
      triggerReason: "일간 하트비트 발송 실패",
      signalSentAt: "2026-05-28T15:00:00.000Z",
      outcomeAt: null,
      t7PriceChange: null,
      decisionRecorded: null,
      decisionMemo: null,
    },
  ];

  beforeEach(() => {
    vi.resetModules();
  });

  it("batch insert + camelCase → snake_case (9 columns)", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    await insertAlertEvents(events, { client });

    expect(fromMock).toHaveBeenCalledWith("alert_event");
    expect(insertMock).toHaveBeenCalledTimes(1);
    const [rows] = insertMock.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      alert_type: "news_critical",
      ticker: "005930",
      severity: "critical",
      trigger_reason: "삼성전자 매출 급락 — critical (Naver)",
      signal_sent_at: "2026-05-28T00:00:00.000Z",
      outcome_at: null,
      t7_price_change: null,
      decision_recorded: null,
      decision_memo: null,
    });
    expect(rows[1].alert_type).toBe("heartbeat_missing");
  });

  it("empty array → no DB call, no throw", async () => {
    const insertMock = vi.fn();
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    await insertAlertEvents([], { client });

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("alert_type enum guard rejects invalid type", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    await expect(
      insertAlertEvents(
        [{ ...events[0], alertType: "weird" as never }],
        { client },
      ),
    ).rejects.toThrow("alert_event_invalid_type:weird");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("severity enum guard rejects invalid severity (omxy R1 MED-5)", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    await expect(
      insertAlertEvents(
        [{ ...events[0], severity: "weird" as never }],
        { client },
      ),
    ).rejects.toThrow("alert_event_invalid_severity:weird");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("ALERT_TYPE_SET = exact 12-type invariant (omxy R1 MED-4)", async () => {
    const { ALERT_TYPE_SET } = await import("@/lib/data/admin-alerts-insert");
    expect([...ALERT_TYPE_SET].sort()).toEqual(
      [
        "briefing",
        "briefing_failed",
        "cost_hardcap",
        "cost_warning",
        "exit_signal",
        "gating_auto_relief",
        "heartbeat_missing",
        "intraday_anomaly",
        "news_critical",
        "news_warning",
        "price_anomaly",
        "scheduler_fail",
      ].sort(),
    );
  });

  it("error → throws alert_event_insert_failed:<code>", async () => {
    const insertMock = vi.fn().mockResolvedValue({
      error: { code: "23514", message: "check violation" },
    });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    await expect(insertAlertEvents(events, { client })).rejects.toThrow(
      "alert_event_insert_failed:23514",
    );
  });

  it("DI seam fallback (no client) uses session createClient", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({ from: fromMock }),
    }));

    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    await insertAlertEvents(events);

    expect(fromMock).toHaveBeenCalledWith("alert_event");
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `cd tudal && npx vitest run src/lib/data/__tests__/admin-alerts-insert-batch.test.ts`
Expected: FAIL (`insertAlertEvents` not exported).

- [ ] **Step 1.3: Implement insertAlertEvents**

Append to `tudal/src/lib/data/admin-alerts-insert.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import type { AlertEvent, AlertType, Severity } from '@/types/admin';

// 59차 Mock cleanup Step 2.7b.3: 3-source cron alert_event 통합 INSERT helper.
// silent-health (heartbeat_missing) + news-sweep (news_critical) + morning-briefing (briefing_failed).
// append-only audit (alert_event UNIQUE 없음 — plan §0 D1). dedup은 W-alert-event-dedup defer.
// service-role client 주입 시 RLS using(is_admin()) 우회.

// 0010 alert_event_alert_type_check 12종 1:1 (plan §0 D3 + omxy R1 MED-4 export + exact invariant).
export const ALERT_TYPE_SET: ReadonlySet<AlertType> = new Set<AlertType>([
  'exit_signal',
  'news_critical',
  'news_warning',
  'price_anomaly',
  'intraday_anomaly',
  'briefing',
  'briefing_failed',
  'scheduler_fail',
  'gating_auto_relief',
  'cost_warning',
  'cost_hardcap',
  'heartbeat_missing',
]);

// 0010 alert_event severity CHECK (critical/warning/info) 1:1 (omxy R1 MED-5).
const SEVERITY_SET: ReadonlySet<Severity> = new Set<Severity>([
  'critical',
  'warning',
  'info',
]);

export async function insertAlertEvents(
  events: Array<Omit<AlertEvent, 'id' | 'isRead'>>,
  options: { client?: SupabaseClient } = {},
): Promise<void> {
  if (events.length === 0) return;
  for (const e of events) {
    if (!ALERT_TYPE_SET.has(e.alertType)) {
      throw new Error(`alert_event_invalid_type:${e.alertType}`);
    }
    if (!SEVERITY_SET.has(e.severity)) {
      throw new Error(`alert_event_invalid_severity:${e.severity}`);
    }
  }
  const supabase = options.client ?? (await createClient());
  const rows = events.map((e) => ({
    alert_type: e.alertType,
    ticker: e.ticker,
    severity: e.severity,
    trigger_reason: e.triggerReason,
    signal_sent_at: e.signalSentAt,
    outcome_at: e.outcomeAt,
    t7_price_change: e.t7PriceChange,
    decision_recorded: e.decisionRecorded,
    decision_memo: e.decisionMemo,
  }));
  const { error } = await supabase.from('alert_event').insert(rows);
  if (error) {
    throw new Error(`alert_event_insert_failed:${error.code ?? 'unknown'}`);
  }
}
```

**Note (Task 1.3 검증)**: `AlertType` + `Severity` export 존재 확인 완료 (`tudal/src/types/admin.ts:14,27`). ALERT_TYPE_SET 12종은 0010 마이그 CHECK과 1:1 (Step 1.1 exact invariant test) — drift 시 §5.3 preflight에서 검출. SEVERITY_SET 3종도 0010 severity CHECK 1:1.

**Note (Task 1.3 file header 갱신, omxy R2 LOW-1)**: `admin-alerts-insert.ts` 최상단 file header 주석이 현재 `// DI 패턴 (supabase: SupabaseClient를 인자로 받음) — service-role import 금지.`로 되어 있음. insertAlertEvents가 `options.client?` seam + `createClient` fallback를 추가하므로 header를 다음으로 갱신:
```typescript
// recordSchedulerFailAlert: DI-only (input.supabase) — scheduler_fail 전용, 변경 0.
// insertAlertEvents (Step 2.7b.3): options.client? seam + createClient fallback — cron service-role 주입.
//   service-role.ts B17 boundary "허용 DI seam" 목록 정합 (D7).
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `cd tudal && npx vitest run src/lib/data/__tests__/admin-alerts-insert-batch.test.ts`
Expected: PASS (7 tests) — batch mapping + empty array + invalid alert_type + invalid severity + ALERT_TYPE_SET exact 12 + DB error throw + DI fallback (omxy R3 LOW count fix).

- [ ] **Step 1.5: Commit**

```bash
git add tudal/src/lib/data/admin-alerts-insert.ts tudal/src/lib/data/__tests__/admin-alerts-insert-batch.test.ts
git commit -m "feat(mock-cleanup step 2.7b.3): insertAlertEvents 3-source batch helper + ALERT_TYPE_SET guard"
```

---

### Task 2: insertBriefingLog helper + TDD

**Files:**
- Create: `tudal/src/lib/data/admin-briefing-log.ts`
- Test: `tudal/src/lib/data/__tests__/admin-briefing-log.test.ts`

- [ ] **Step 2.1: Write failing tests**

```typescript
// tudal/src/lib/data/__tests__/admin-briefing-log.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BriefingLog } from "@/types/admin";

describe("insertBriefingLog", () => {
  const record: Omit<BriefingLog, "id" | "viewEvents"> = {
    date: "2026-05-28",
    contentSummary: "오늘의 브리핑 요약",
    generatedAt: "2026-05-28T23:00:00.000Z",
    sentChannels: ["dashboard", "email"],
    generationFailed: false,
  };

  beforeEach(() => {
    vi.resetModules();
  });

  it("camelCase → snake_case + upsert(date) DO UPDATE", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertBriefingLog } = await import("@/lib/data/admin-briefing-log");
    await insertBriefingLog(record, { client });

    expect(fromMock).toHaveBeenCalledWith("briefing_log");
    // omxy R1 LOW-1: exact object assertion (objectContaining → toEqual, extra field 차단).
    expect(upsertMock).toHaveBeenCalledWith(
      {
        date: "2026-05-28",
        content_summary: "오늘의 브리핑 요약",
        generated_at: "2026-05-28T23:00:00.000Z",
        sent_channels: ["dashboard", "email"],
        generation_failed: false,
      },
      { onConflict: "date" },
    );
  });

  it("error → throws briefing_log_insert_failed:<code>", async () => {
    const upsertMock = vi.fn().mockResolvedValue({
      error: { code: "23505", message: "dup" },
    });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertBriefingLog } = await import("@/lib/data/admin-briefing-log");
    await expect(insertBriefingLog(record, { client })).rejects.toThrow(
      "briefing_log_insert_failed:23505",
    );
  });

  it("DI seam fallback (no client) uses session createClient", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({ from: fromMock }),
    }));

    const { insertBriefingLog } = await import("@/lib/data/admin-briefing-log");
    await insertBriefingLog(record);

    expect(fromMock).toHaveBeenCalledWith("briefing_log");
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run: `cd tudal && npx vitest run src/lib/data/__tests__/admin-briefing-log.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2.3: Implement insertBriefingLog**

```typescript
// tudal/src/lib/data/admin-briefing-log.ts
// briefing_log INSERT helper (59차 Mock cleanup Step 2.7b.3).
// morning-briefing cron 일 1회 (23:00 UTC). ON CONFLICT (date) DO UPDATE — cron 재실행 시
// latest content 갱신 (plan §0 D2, heartbeat_log Step 2.7b.2 D1 패턴 정합). RLS admin all →
// cron context는 service-role client 주입 필수.
// SoT: 0006_s5a_automation.sql §briefing_log (date UNIQUE + admin RLS).

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { BriefingLog } from "@/types/admin";

export interface BriefingLogInsertOptions {
  client?: SupabaseClient;
}

export async function insertBriefingLog(
  record: Omit<BriefingLog, "id" | "viewEvents">,
  options: BriefingLogInsertOptions = {},
): Promise<void> {
  const supabase = options.client ?? (await createClient());
  const { error } = await supabase
    .from("briefing_log")
    .upsert(
      {
        date: record.date,
        content_summary: record.contentSummary,
        generated_at: record.generatedAt,
        sent_channels: record.sentChannels,
        generation_failed: record.generationFailed,
      },
      { onConflict: "date" },
    );
  if (error) {
    throw new Error(`briefing_log_insert_failed:${error.code ?? "unknown"}`);
  }
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `cd tudal && npx vitest run src/lib/data/__tests__/admin-briefing-log.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 2.5: Commit**

```bash
git add tudal/src/lib/data/admin-briefing-log.ts tudal/src/lib/data/__tests__/admin-briefing-log.test.ts
git commit -m "feat(mock-cleanup step 2.7b.3): insertBriefingLog helper + DI seam (date upsert)"
```

---

### Task 3: silent-health alert_event INSERT wiring

**Files:**
- Modify: `tudal/src/app/api/cron/silent-health/route.ts`
- Test: `tudal/src/app/api/cron/silent-health/__tests__/route.test.ts`

- [ ] **Step 3.1: Write failing test (hoisted mock 확장)**

기존 file의 hoisted mock 패턴에 `insertAlertEvents` 추가 (omxy R4 HIGH-2 vi.hoisted 정합). 기존 `vi.mock("@/lib/data/admin-alerts-insert", ...)` 없으면 신규 추가:

```typescript
const alertsInsertMock = vi.hoisted(() => ({
  insertAlertEvents: vi.fn(),
}));
vi.mock("@/lib/data/admin-alerts-insert", () => ({
  insertAlertEvents: alertsInsertMock.insertAlertEvents,
}));
```

beforeEach에 `alertsInsertMock.insertAlertEvents.mockReset(); alertsInsertMock.insertAlertEvents.mockResolvedValue(undefined);` 추가.

기존 describe 내부에 신규 test (allFailed → missingAlert INSERT):

```typescript
it("allFailed → missingAlert INSERT via service-role (Step 2.7b.3)", async () => {
  // 기본 beforeEach가 production + no telegram/email channel → allFailed (500/502).
  // missingAlert가 insertAlertEvents([missingAlert], {client})로 적재되는지 검증.
  const { GET } = await import("../route");
  const res = await GET(
    new NextRequest("http://localhost/api/cron/silent-health", {
      headers: { authorization: "Bearer cron-secret" },
    }),
  );
  // noConfiguredOutboundChannel(500) path: missingAlert 생성됨.
  expect([500, 502]).toContain(res.status);
  expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
  const [arr, opts] = alertsInsertMock.insertAlertEvents.mock.calls[0];
  expect(arr).toHaveLength(1);
  expect(arr[0].alertType).toBe("heartbeat_missing");
  expect(opts).toHaveProperty("client", serviceRoleMock.client);
});

it("not allFailed → insertAlertEvents called with empty array (no alert)", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "telegram-token";
  process.env.TELEGRAM_CHAT_ID = "telegram-chat";
  vi.doMock("@/lib/notify/telegram", () => ({
    sendTelegram: async () => ({ success: true, mockMode: false }),
  }));
  vi.doMock("@/lib/email/resend", () => ({
    sendEmail: async () => ({ success: true, providerId: "x", mockMode: false }),
  }));
  const { GET } = await import("../route");
  const res = await GET(
    new NextRequest("http://localhost/api/cron/silent-health", {
      headers: { authorization: "Bearer cron-secret" },
    }),
  );
  expect(res.status).toBe(200);
  // missingAlert null → 빈 배열 → helper short-circuit. 호출은 1회 (빈 배열) 또는 0회 — route 구현에 따름.
  // 구현 정합: insertAlertEvents(missingAlert ? [missingAlert] : [], ...) → 빈 배열 호출 1회.
  expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
  expect(alertsInsertMock.insertAlertEvents.mock.calls[0][0]).toHaveLength(0);
});

it("alert INSERT fail → 502 + dbError (omxy R1 MED-1)", async () => {
  // allFailed path (기본 beforeEach production no-channel) → missingAlert 생성 → alert INSERT.
  alertsInsertMock.insertAlertEvents.mockRejectedValue(
    new Error("alert_event_insert_failed:23514"),
  );
  const { GET } = await import("../route");
  const res = await GET(
    new NextRequest("http://localhost/api/cron/silent-health", {
      headers: { authorization: "Bearer cron-secret" },
    }),
  );
  // heartbeat_log 성공(기본 mock) + alert 실패 → dbError set → 5xx.
  expect([500, 502]).toContain(res.status);
  const body = await res.json();
  expect(body.dbError).toBe("alert_event_insert_failed:23514");
});

it("heartbeat_log fail + alert success → both attempted, dbError = heartbeat (skip 0, omxy R1 MED-2)", async () => {
  heartbeatLogMock.insertHeartbeatLog.mockRejectedValue(
    new Error("heartbeat_log_insert_failed:23505"),
  );
  alertsInsertMock.insertAlertEvents.mockResolvedValue(undefined);
  const { GET } = await import("../route");
  const res = await GET(
    new NextRequest("http://localhost/api/cron/silent-health", {
      headers: { authorization: "Bearer cron-secret" },
    }),
  );
  expect([500, 502]).toContain(res.status);
  // independent best-effort: heartbeat_log 실패해도 alert INSERT는 시도됨 (skip 0).
  expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
  const body = await res.json();
  // dbError ??= 첫 실패(heartbeat_log) 보존.
  expect(body.dbError).toBe("heartbeat_log_insert_failed:23505");
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

Run: `cd tudal && npx vitest run src/app/api/cron/silent-health/`
Expected: FAIL (alert wiring 없음).

- [ ] **Step 3.3: Wire insertAlertEvents in route (independent best-effort, omxy R1 MED-2)**

Edit `tudal/src/app/api/cron/silent-health/route.ts`:

(a) Import: `import { insertAlertEvents } from "@/lib/data/admin-alerts-insert";`

(b) missingAlert 생성 직후 (현재 line ~161 `missingAlert = buildHeartbeatMissingAlert(...)` 블록 이후), **독립 try/catch** (dbError===null guard 제거 — heartbeat_log 실패해도 alert는 시도):

```typescript
  // Step 2.7b.3: heartbeat_missing alert_event INSERT (allFailed 시만, missingAlert non-null).
  // independent best-effort (plan §0 D6 omxy R1 MED-2): heartbeat_log 실패와 무관하게 시도.
  // dbError ??= (첫 실패 메시지 보존). missingAlert null이면 빈 배열 → helper short-circuit.
  try {
    await insertAlertEvents(missingAlert ? [missingAlert] : [], {
      client: serviceRoleClient,
    });
  } catch (err) {
    dbError ??= err instanceof Error ? err.message : "alert_event_insert_failed:unknown";
  }
```

**주의**: missingAlert 생성 블록(line 156~162)이 heartbeat_log INSERT(line 146~)보다 뒤에 있으므로, alert INSERT는 missingAlert 블록 **이후** 배치. dbError 변수는 heartbeat_log INSERT에서 `let dbError: string | null = null`로 이미 선언 → `??=` 재사용 (첫 실패 보존).

- [ ] **Step 3.4: Run tests + commit**

Run: `cd tudal && npx vitest run src/app/api/cron/silent-health/`
Expected: PASS.

```bash
git add tudal/src/app/api/cron/silent-health/route.ts tudal/src/app/api/cron/silent-health/__tests__/route.test.ts
git commit -m "feat(mock-cleanup step 2.7b.3): silent-health heartbeat_missing alert_event INSERT"
```

---

### Task 4: news-sweep alert_event INSERT wiring

**Files:**
- Modify: `tudal/src/app/api/cron/news-sweep/route.ts`
- Test: `tudal/src/app/api/cron/news-sweep/__tests__/route.test.ts`

- [ ] **Step 4.1: Write failing test**

기존 hoisted mock에 `insertAlertEvents` 추가 (별도 `vi.mock("@/lib/data/admin-alerts-insert")`). beforeEach reset + resolve.

```typescript
it("criticals → alert_event INSERT via service-role (Step 2.7b.3, omxy R1 HIGH-1)", async () => {
  vi.stubEnv("NODE_ENV", "development");
  // omxy R1 HIGH-1 fix: "삼성 급락"은 classifier상 info. critical regex 매칭 title "실적 쇼크" 사용.
  // classifier.ts RULES: /(실적\s*쇼크|어닝\s*쇼크|대규모\s*손실)/ → critical.
  adminNewsMock.getRecentNewsEvents.mockResolvedValue([
    {
      id: "n1", ticker: "005930", severity: "critical",
      title: "삼성전자 실적 쇼크", source: "Naver", url: "https://x/1",
      publishedAt: "2026-05-28T00:00:00.000Z", fetchedAt: "2026-05-28T00:01:00.000Z",
      classificationReason: "급락",
    },
  ]);
  alertsInsertMock.insertAlertEvents.mockResolvedValue(undefined);
  const { GET } = await import("../route");
  const res = await GET(new NextRequest("http://localhost/api/cron/news-sweep", {
    headers: { authorization: "Bearer cron-secret" },
  }));
  expect(res.status).toBe(200);
  expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
  const [arr, opts] = alertsInsertMock.insertAlertEvents.mock.calls[0];
  // omxy R1 HIGH-1: critical title이므로 arr.length === 1 + alertType news_critical 명시 단언.
  expect(arr).toHaveLength(1);
  expect(arr[0].alertType).toBe("news_critical");
  expect(opts).toHaveProperty("client", serviceRoleMock.client);
});

it("alert INSERT fail → 502 + dbError, news_event success (omxy R1 MED-1)", async () => {
  vi.stubEnv("NODE_ENV", "development");
  adminNewsMock.getRecentNewsEvents.mockResolvedValue([
    {
      id: "n1", ticker: "005930", severity: "critical",
      title: "삼성전자 실적 쇼크", source: "Naver", url: "https://x/1",
      publishedAt: "2026-05-28T00:00:00.000Z", fetchedAt: "2026-05-28T00:01:00.000Z",
      classificationReason: "급락",
    },
  ]);
  adminNewsMock.insertNewsEvents.mockResolvedValue(undefined); // news_event 성공
  alertsInsertMock.insertAlertEvents.mockRejectedValue(
    new Error("alert_event_insert_failed:23514"),
  );
  const { GET } = await import("../route");
  const res = await GET(new NextRequest("http://localhost/api/cron/news-sweep", {
    headers: { authorization: "Bearer cron-secret" },
  }));
  expect(res.status).toBe(502);
  const body = await res.json();
  expect(body.dbError).toBe("alert_event_insert_failed:23514");
});

it("news_event fail + alert success → both attempted (skip 0, omxy R1 MED-2)", async () => {
  vi.stubEnv("NODE_ENV", "development");
  adminNewsMock.getRecentNewsEvents.mockResolvedValue([
    {
      id: "n1", ticker: "005930", severity: "critical",
      title: "삼성전자 실적 쇼크", source: "Naver", url: "https://x/1",
      publishedAt: "2026-05-28T00:00:00.000Z", fetchedAt: "2026-05-28T00:01:00.000Z",
      classificationReason: "급락",
    },
  ]);
  adminNewsMock.insertNewsEvents.mockRejectedValue(
    new Error("news_event_insert_failed:23502"),
  );
  alertsInsertMock.insertAlertEvents.mockResolvedValue(undefined);
  const { GET } = await import("../route");
  const res = await GET(new NextRequest("http://localhost/api/cron/news-sweep", {
    headers: { authorization: "Bearer cron-secret" },
  }));
  expect(res.status).toBe(502);
  // independent best-effort: news_event 실패해도 alert INSERT 시도됨 (skip 0).
  expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
  const body = await res.json();
  expect(body.dbError).toBe("news_event_insert_failed:23502"); // 첫 실패 보존
  // omxy R2 MED-2: alert INSERT 성공이므로 alertsEmitted는 실제 alert 수 반영 (0 거짓 보고 차단).
  expect(body.alertsEmitted).toBe(1);
});
```

- [ ] **Step 4.2: Run tests to verify they fail**

Run: `cd tudal && npx vitest run src/app/api/cron/news-sweep/`
Expected: FAIL.

- [ ] **Step 4.3: Wire insertAlertEvents in route**

Edit `tudal/src/app/api/cron/news-sweep/route.ts`:

(a) Import: `import { insertAlertEvents } from "@/lib/data/admin-alerts-insert";`

(b) news_event INSERT `dbError` try/catch 직후 (alerts는 이미 line ~131 생성됨), **독립 try/catch + alertInsertOk 추적** (omxy R1 MED-2 + R2 MED-2 response semantics):

```typescript
  // Step 2.7b.3: news_critical alert_event INSERT. independent best-effort (plan §0 D6).
  // news_event 실패와 무관하게 시도. dbError ??= (첫 실패 보존). alerts 빈 배열 시 short-circuit.
  // alertInsertOk: response alertsEmitted가 dbError(news_event)와 무관하게 실제 alert INSERT 성공 반영
  // (omxy R2 MED-2 — news_event fail + alert success 시 alertsEmitted를 0으로 거짓 보고 차단).
  let alertInsertOk = false;
  try {
    await insertAlertEvents(alerts, { client: serviceRoleClient });
    alertInsertOk = true;
  } catch (err) {
    dbError ??= err instanceof Error ? err.message : "alert_event_insert_failed:unknown";
  }
```

(c) news-sweep response 갱신 (Step 2.7b.2 `alertsEmitted: dbError ? 0 : alerts.length` → omxy R2 MED-2 fix):
```typescript
      alertsEmitted: alertInsertOk ? alerts.length : 0,
```
(빈 alerts → insertAlertEvents([]) short-circuit → alertInsertOk=true → alertsEmitted=0 정합. news_event fail + alert success → alertInsertOk=true → alertsEmitted=alerts.length, dbError=news_event error.)

**주의**: `serviceRoleClient`는 news_event INSERT 직전 lazy null-check로 이미 non-null. `alerts` 변수는 criticals map (line ~131). **dbError 변수 통일**: Step 2.7b.2 news_event try/catch의 `dbError = ` → `dbError ??= `로 변경 (첫 실패 보존 — alert INSERT가 두 번째라 news_event error 우선).

- [ ] **Step 4.4: Run tests + commit**

```bash
git add tudal/src/app/api/cron/news-sweep/route.ts tudal/src/app/api/cron/news-sweep/__tests__/route.test.ts
git commit -m "feat(mock-cleanup step 2.7b.3): news-sweep news_critical alert_event INSERT"
```

---

### Task 5: morning-briefing briefing_log + alert_event INSERT wiring

**Files:**
- Modify: `tudal/src/app/api/cron/morning-briefing/route.ts`
- Test: `tudal/src/app/api/cron/morning-briefing/__tests__/route.test.ts`

- [ ] **Step 5.1: Write failing test (omxy R2 HIGH-1 — placeholder 0, 실제 code 박제)**

기존 morning-briefing route.test.ts 구조 정합 (beforeEach: production + ADMIN_EMAILS set + no RESEND_API_KEY → 실 sendEmail 실패 → emailError → generationFailed=true → 502). 신규 hoisted mock + tests를 기존 describe 내부에 추가:

```typescript
// file 상단 hoisted block 확장 (기존 adminNewsMock + serviceRoleMock 옆):
const briefingLogMock = vi.hoisted(() => ({ insertBriefingLog: vi.fn() }));
const alertsInsertMock = vi.hoisted(() => ({ insertAlertEvents: vi.fn() }));
vi.mock("@/lib/data/admin-briefing-log", () => ({
  insertBriefingLog: briefingLogMock.insertBriefingLog,
}));
vi.mock("@/lib/data/admin-alerts-insert", () => ({
  insertAlertEvents: alertsInsertMock.insertAlertEvents,
}));

// 기존 beforeEach 끝에 추가:
//   briefingLogMock.insertBriefingLog.mockReset();
//   briefingLogMock.insertBriefingLog.mockResolvedValue(undefined);
//   alertsInsertMock.insertAlertEvents.mockReset();
//   alertsInsertMock.insertAlertEvents.mockResolvedValue(undefined);

// 기존 afterEach 갱신 (omxy R1 HIGH-2 mock leakage 차단):
//   afterEach(() => {
//     vi.doUnmock("@/lib/email/resend");
//     vi.unstubAllEnvs();
//   });
```

신규 tests (기존 describe 내부, success setup은 vi.doMock resend success로 명시 — placeholder 0):

```typescript
// success helper — vi.doMock resend로 email 성공 (generationFailed=false). afterEach doUnmock 정합.
function mockResendSuccess() {
  vi.doMock("@/lib/email/resend", () => ({
    sendEmail: async () => ({
      success: true,
      providerId: "test-msg",
      mockMode: false,
      error: undefined as string | undefined,
    }),
  }));
}

it("success → briefing_log INSERT + alert_event empty array (Step 2.7b.3)", async () => {
  mockResendSuccess(); // ADMIN_EMAILS set (beforeEach) + email success → generationFailed=false.
  const { GET } = await import("../route");
  const res = await GET(new NextRequest("http://localhost/api/cron/morning-briefing", {
    headers: { authorization: "Bearer cron-secret" },
  }));
  expect(res.status).toBe(200);
  expect(briefingLogMock.insertBriefingLog).toHaveBeenCalledTimes(1);
  const [rec, opts] = briefingLogMock.insertBriefingLog.mock.calls[0];
  expect(rec).toHaveProperty("date");
  expect(opts).toHaveProperty("client", serviceRoleMock.client);
  // generationFailed=false → alertPayload null → 빈 배열.
  expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
  expect(alertsInsertMock.insertAlertEvents.mock.calls[0][0]).toHaveLength(0);
});

it("email-fail generationFailed → briefing_failed alert_event INSERT non-empty (Step 2.7b.3)", async () => {
  // 기본 beforeEach: production + ADMIN_EMAILS set + no RESEND → 실 sendEmail 실패 → emailError → generationFailed=true.
  const { GET } = await import("../route");
  const res = await GET(new NextRequest("http://localhost/api/cron/morning-briefing", {
    headers: { authorization: "Bearer cron-secret" },
  }));
  expect(res.status).toBe(502); // generationFailed (email fail)
  expect(briefingLogMock.insertBriefingLog).toHaveBeenCalledTimes(1);
  expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
  const arr = alertsInsertMock.insertAlertEvents.mock.calls[0][0];
  expect(arr).toHaveLength(1);
  expect(arr[0].alertType).toBe("briefing_failed");
});

it("briefing_log fail + alert success → both attempted, non-empty alert, dbError=briefing_log (skip 0, omxy R2 MED-1+MED-2)", async () => {
  // email-fail path (generationFailed=true) → alertPayload non-null. briefing_log reject + alert resolve.
  briefingLogMock.insertBriefingLog.mockRejectedValue(
    new Error("briefing_log_insert_failed:23505"),
  );
  alertsInsertMock.insertAlertEvents.mockResolvedValue(undefined);
  const { GET } = await import("../route");
  const res = await GET(new NextRequest("http://localhost/api/cron/morning-briefing", {
    headers: { authorization: "Bearer cron-secret" },
  }));
  expect(res.status).toBe(502);
  // independent best-effort: briefing_log 실패해도 alert INSERT 시도됨 + non-empty (briefing_failed).
  expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
  const arr = alertsInsertMock.insertAlertEvents.mock.calls[0][0];
  expect(arr).toHaveLength(1);
  expect(arr[0].alertType).toBe("briefing_failed");
  const body = await res.json();
  expect(body.dbError).toBe("briefing_log_insert_failed:23505"); // 첫 실패 보존
});

it("alert INSERT fail → dbError recorded (omxy R1 MED-1)", async () => {
  // email-fail generationFailed=true → alertPayload non-null. briefing_log success + alert reject.
  briefingLogMock.insertBriefingLog.mockResolvedValue(undefined);
  alertsInsertMock.insertAlertEvents.mockRejectedValue(
    new Error("alert_event_insert_failed:23514"),
  );
  const { GET } = await import("../route");
  const res = await GET(new NextRequest("http://localhost/api/cron/morning-briefing", {
    headers: { authorization: "Bearer cron-secret" },
  }));
  expect(res.status).toBe(502); // generationFailed (email fail) → 502 (dbError와 동일 status)
  const body = await res.json();
  // briefing_log 성공 + alert 실패 → dbError = alert error (briefing_log은 null이라 ??=로 alert 기록).
  expect(body.dbError).toBe("alert_event_insert_failed:23514");
});
```

**status 우선순위 주의**: morning-briefing finalStatus = configError(500) → generationFailed(502) → dbError(502) → 200. email-fail path는 generationFailed=true라 이미 502 → dbError와 동일 status (502). 따라서 dbError 검증은 body.dbError로 (status 502는 generationFailed/dbError 공통).

- [ ] **Step 5.2: Run tests to verify they fail**

Run: `cd tudal && npx vitest run src/app/api/cron/morning-briefing/`
Expected: FAIL.

- [ ] **Step 5.3: Wire briefing_log + alert_event in route**

Edit `tudal/src/app/api/cron/morning-briefing/route.ts`:

(a) Imports:
```typescript
import { insertBriefingLog } from "@/lib/data/admin-briefing-log";
import { insertAlertEvents } from "@/lib/data/admin-alerts-insert";
```

(b) service-role client 변수 추출 (현재 line 77 `getRecentNewsEvents({ client: createServiceRoleClient(), ... })` 인라인):
```typescript
  const serviceRoleClient = createServiceRoleClient();
  const recentNewsEvents = await getRecentNewsEvents({
    client: serviceRoleClient,
    limit: 20,
  });
```

(c) logPayload 생성(line ~109) + alertPayload(line ~112) 직후, return 직전에 INSERT 블록 — **독립 try/catch 2개** (omxy R1 MED-2 independent best-effort, briefing_log 실패가 alert를 skip하지 않음):
```typescript
  // Step 2.7b.3: briefing_log INSERT (date upsert) + briefing_failed alert_event INSERT.
  // independent best-effort (plan §0 D6 omxy R1 MED-2): 둘 다 독립 시도. dbError ??= 첫 실패 보존.
  let dbError: string | null = null;
  try {
    await insertBriefingLog(logPayload, { client: serviceRoleClient });
  } catch (err) {
    dbError ??= err instanceof Error ? err.message : "briefing_log_insert_failed:unknown";
  }
  try {
    await insertAlertEvents(alertPayload ? [alertPayload] : [], {
      client: serviceRoleClient,
    });
  } catch (err) {
    dbError ??= err instanceof Error ? err.message : "alert_event_insert_failed:unknown";
  }
```

(d) Response status/body 갱신 (line 127~137):
```typescript
  // status 우선순위: configError(500) → generationFailed(502) → dbError(502) → 200.
  const finalStatus = configError
    ? 500
    : generationFailed
    ? 502
    : dbError
    ? 502
    : 200;

  return NextResponse.json(
    {
      ok: !generationFailed && !dbError,
      date: composed.date,
      sentChannels,
      contentPreview: composed.contentSummary.slice(0, 120),
      log: logPayload,
      alertEmitted: alertPayload?.triggerReason ?? null,
      dbError,
    },
    { status: finalStatus },
  );
```

- [ ] **Step 5.4: Run tests + commit**

```bash
git add tudal/src/app/api/cron/morning-briefing/route.ts tudal/src/app/api/cron/morning-briefing/__tests__/route.test.ts
git commit -m "feat(mock-cleanup step 2.7b.3): morning-briefing briefing_log + briefing_failed alert_event INSERT"
```

---

### Task 6: service-role boundary 주석 + 전체 검증 + scope-guard

- [ ] **Step 6.1: service-role.ts boundary 갱신 (omxy R1 MED-3 — boundary contradiction 해소)**

`tudal/src/lib/supabase/service-role.ts`:
- (a) **"금지 (DI-only 패턴 사용)" 목록에서 `admin-alerts-insert.ts` 제거** (현재 `- tudal/src/lib/data/admin-alerts-insert.ts (supabase: SupabaseClient를 인자로 받음)` line).
- (b) **"허용 (DI seam을 통한 cron 호출자 service-role 주입)" 목록에 추가**:
```typescript
//     - tudal/src/lib/data/admin-alerts-insert.ts (Step 2.7b.3: insertAlertEvents options.client? INSERT — recordSchedulerFailAlert DI-only 보존)
//     - tudal/src/lib/data/admin-briefing-log.ts (Step 2.7b.3: options.client? INSERT)
```
- recordSchedulerFailAlert(input: {supabase}) DI-only 동작 변경 0 (별도 함수).

- [ ] **Step 6.2: 전체 검증 게이트**

Run: `cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit`
Expected: build 25 routes / lint 0 err 5 warn (pre-existing) / test:ci +N PASS / tsc clean.

- [ ] **Step 6.3: scope-guard grep (multiline-agnostic, plan §5.2 정합)**

```bash
# (a) alert_event direct write 금지 (cron routes + admin/components) — helper-only invariant
rg -U -n "from\([\"']alert_event[\"']\)\s*\.\s*(insert|upsert|delete)" \
  tudal/src/app/api/cron/ tudal/src/app/\(admin\)/ tudal/src/components/ 2>&1
# Expected: no matches (helper insertAlertEvents + 기존 admin-alerts-insert.ts recordSchedulerFailAlert만)
# NOTE: admin-alerts-insert.ts 자체는 helper라 제외 target. cron routes에 직접 .from('alert_event').insert 0.

# (b) briefing_log direct write 금지 (cron routes)
rg -U -n "from\([\"']briefing_log[\"']\)\s*\.\s*(insert|upsert|delete)" \
  tudal/src/app/api/cron/morning-briefing/route.ts 2>&1
# Expected: no matches (helper insertBriefingLog 사용)

# (c) positive — helpers 실제 INSERT/UPSERT
rg -U -n "from\([\"']alert_event[\"']\)\s*\.\s*insert" tudal/src/lib/data/admin-alerts-insert.ts
rg -U -n "from\([\"']briefing_log[\"']\)\s*\.\s*upsert" tudal/src/lib/data/admin-briefing-log.ts
# Expected: 1+ each

# (d) service-role boundary 위반 0 — import-only regex (omxy R2 MED-3: comment-only hit false-fail 차단)
# 기존 grep은 admin-alerts.ts/admin-news.ts 주석의 "createServiceRoleClient" 단어에 false-match.
# import statement만 검출 (실제 사용 boundary).
rg -n "^import .*createServiceRoleClient|^\s*import .*createServiceRoleClient" tudal/src/ \
  | rg -v "tudal/src/app/api/cron/|tudal/src/lib/data/admin-batch-runs-cron.ts|tudal/src/lib/supabase/service-role.ts|__tests__"
# Expected: no matches (cron routes + admin-batch-runs-cron만 import 허용. helper 주석 단어는 import 아니라 제외됨)
```

---

## §3.5 omxy R-debate catalog (plan v2, R1 native critic subagents 동원)

| # | Round | Severity | 결함 | plan v2 fix |
|---|---|---|---|---|
| 1 | R1 | HIGH | Task 4.1 news critical test "삼성 급락" = info (classifier) → news_critical INSERT 미검증 | Task 4.1 title "삼성전자 실적 쇼크" + arr.length===1 + alertType news_critical 단언 |
| 2 | R1 | HIGH | Task 5.1 morning-briefing vi.doMock("resend") + afterEach doUnmock 없음 → mock leakage | Task 5.1 afterEach vi.doUnmock 패턴 추가 (silent-health 정합) |
| 3 | R1 | MED | D6/Task 3~5 alert INSERT rejection test 누락 (briefing_log만 cover) | Task 3/4/5 각 alert INSERT fail → 502 dbError test 추가 |
| 4 | R1 | MED | D6 dependency policy underspecified (dbError===null skip = audit loss) | D6 → **independent best-effort** (독립 try/catch, dbError ??=, skip 0) + skip-0 invariant test |
| 5 | R1 | MED | admin-alerts-insert.ts boundary contradiction (DI-only 금지 ↔ options.client? 추가) | D7 + Task 6.1 — service-role.ts 금지→허용 목록 이동 + recordSchedulerFailAlert 보존 |
| 6 | R1 | MED | ALERT_TYPE_SET export claim vs private const + exact 12-type 미검증 | Task 1.3 `export` + Task 1.1 exact 12-type invariant test |
| 7 | R1 | MED | insertAlertEvents severity guard 부재 (DB severity CHECK) | Task 1.3 SEVERITY_SET guard + Task 1.1 severity rejection test |
| 8 | R1 | LOW | insertBriefingLog test objectContaining (extra field 통과) | Task 2.1 exact object (toEqual) |
| 9 | R1 | LOW | §5.3 alert_event severity CHECK 누락 | §5.3 (1) severity CHECK + decision_recorded 추가 |

| 10 | R2 | HIGH | Task 5.1 morning-briefing tests placeholder (`// ... setup`) 실행 불가 | Task 5.1 실제 code 박제 (mockResendSuccess helper + 기본 beforeEach email-fail path 명시) |
| 11 | R2 | MED | Task 5.1 skip-0 invariant가 non-empty alert 미검증 (success setup이면 alertPayload null) | Task 5.1 "email-fail generationFailed + briefing_log fail + alert success → briefing_failed non-empty" |
| 12 | R2 | MED | news-sweep `alertsEmitted: dbError?0:alerts.length` — news_event fail + alert success 시 alert 성공을 0으로 거짓 보고 | Task 4.3 `alertInsertOk` 추적 + `alertsEmitted: alertInsertOk ? alerts.length : 0` + Task 4.1 assert alertsEmitted=1 |
| 13 | R2 | MED | §5.2 (d) grep comment-only hit (admin-alerts.ts/admin-news.ts) false-fail | §5.2 (d) import-only regex (`^import .*createServiceRoleClient`) |
| 14 | R2 | LOW | admin-alerts-insert.ts file header still "DI-only/service-role import 금지" | Task 1.3 header 갱신 note (recordSchedulerFailAlert DI-only + insertAlertEvents seam) |

| 15 | R3 | LOW | Task 1.4 test count "5 tests" vs Step 1.1 실제 7 tests | Task 1.4 "PASS (7 tests)" 정정 |

**옵션 reversal 없음** (D1 append-only + D2 date-upsert + D6 independent best-effort 유지 — omxy R1/R2/R3 "방향 유지 가능").

---

## §3 Self-review checklist (writing-plans skill 정합)

1. **Spec coverage**: HANDOFF "Step 2.7b.3 — alert_event INSERT 3-source 통합 + briefing_log INSERT" → Task 1 (alert helper) + Task 2 (briefing helper) + Task 3/4/5 (3 route wiring) + §0 D1~D8 architectural. **GAP 0**.
2. **Placeholder scan**: 모든 step에 실제 code/command/expected. "TBD"/"TODO" 0.
3. **Type consistency**: `AlertEvent` / `AlertType` / `BriefingLog` / `SupabaseClient` import 일치. `insertAlertEvents` 서명 Task 1.3 = Task 3/4/5 호출 1:1. `insertBriefingLog` Task 2.3 = Task 5 호출 1:1.

## §5.3 Production schema preflight (PR create 전 또는 merge 전 — omxy PR #53 R6 lesson)

```sql
-- (1) alert_event CHECK constraints (alert_type 12종 + severity 3종 + decision_recorded) — omxy R1 LOW-2
select c.conname, pg_get_constraintdef(c.oid)
from pg_constraint c join pg_class t on c.conrelid=t.oid join pg_namespace n on t.relnamespace=n.oid
where n.nspname='public' and t.relname='alert_event' and c.contype='c'
order by c.conname;
-- Expected:
--   alert_event_alert_type_check: 12종 (exit_signal..heartbeat_missing) — app ALERT_TYPE_SET 1:1
--   alert_event_severity_check: severity in ('critical','warning','info') — app SEVERITY_SET 1:1
--   (decision_recorded check: sell_all/partial_sell/hold — 본 PR INSERT는 null만 적재, drift 무관)

-- (2) alert_event RLS admin insert
select policyname, cmd from pg_policies where schemaname='public' and tablename='alert_event' order by policyname;
-- Expected: admin select + admin insert (is_admin()).

-- (3) briefing_log date UNIQUE
select indexname, indexdef from pg_indexes where schemaname='public' and indexname='briefing_log_date_uniq';
-- Expected: UNIQUE INDEX on (date).

-- (4) briefing_log RLS
select policyname, cmd from pg_policies where schemaname='public' and tablename='briefing_log';
-- Expected: briefing_log admin all (is_admin()).
```

## §4 omxy R-debate scope guard (Context Packet)

```
task: Mock cleanup Step 2.7b.3 PR plan v1 — alert_event 3-source + briefing_log INSERT 실 path
base SHA / head: main @ 251e0a0 / (plan-only) / no-branch
target files: docs/superpowers/plans/2026-05-28-mock-cleanup-step-2-7b-3-cron-alert-briefing-insert.md §0 + §2 Task 1~6
allowed scope: plan critique (architectural D1~D8 / TDD invariants / 3-source helper / idempotency)
out-of-scope:
  - alert_event dedup unique index (W-alert-event-dedup, 마이그 0026 별도 PR)
  - portfolio_snapshot 실 SELECT (S7b)
  - PR4 / B65 / D11 / S8 / DQ-7 / 멤버 페이지 / PR5 cron 30 / Tier 2 prompts
current invariants:
  - main HEAD 251e0a0 clean / OPEN PR #2 CONFLICTING only
  - build 25 routes / lint 0 err 5 warn / test:ci 1296 PASS / tsc clean
  - alert_event 0010 (no unique index, alert_type CHECK 12종, RLS admin insert)
  - briefing_log 0006 (date UNIQUE, RLS admin all)
  - 기존 admin-alerts-insert.ts recordSchedulerFailAlert (DI-only) 보존
  - 마이그 0건
output mode: catch-only (Complex — DB INSERT semantic / 3-source / idempotency / RLS)
trivial vs complex: Complex
verification gate: build / lint / test:ci / tsc + §5.2 grep + §5.3 preflight
stop/escalate: CONVERGED (BLOCKERS 0) ≤8 rounds; ESCALATE if D1~D8 option reversal
```
