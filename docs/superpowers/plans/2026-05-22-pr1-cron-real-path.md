# PR1 — cron `monthly-batch` real path + server-callable trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Plan version:** v8 (2026-05-22 omxy R1~R7 = 20 BLOCKERS catch & fix · R7 B20 vitest 검증 명령에서 `2>&1 | tail` pipe 제거 (실패 exit code 보존)).

**Goal:** mock-dry-run cron을 Tier 0 → `runTier1Screening` → `short_list_30` upsert + degraded `commit_badge_only` + scheduler_fail alert 실행 경로로 교체하고, 동일 orchestrator를 호출하는 admin-only server-callable trigger function을 신설한다. cron caller(`auth.role()='service_role'`)와 admin caller(`auth.uid()` + `is_admin()`) 두 경로 동시 지원. (UI 버튼은 PR4 scope.)

**Architecture:** 순수 orchestrator 모듈 (`src/lib/screening/monthly-batch-orchestrator.ts`)이 batch lock + Tier 0 union + `runTier1Screening` + persist + degraded `commit_badge_only` + scheduler_fail alert를 조합한다. cron route(service-role client) 와 admin server action(session-based client)은 동일 orchestrator를 dependency-injection (callPersonaPanel · fetchFinancials · tier0Source · lock · persist · commitBadgeOnly · recordSchedulerFailAlert) 패턴으로 호출. Migration 0021은 `acquire_batch_lock_v2(p_month, p_caller_kind)` SECURITY DEFINER RPC를 추가해 cron/admin 두 caller path 지원. Tier 0 source는 본 PR에서 mock placeholder (production 진입 시 `tier0_source_not_wired_pr1_followup` throw → 502 + scheduler_fail) — 실 150 candidate 생성은 후속 PR (Python script + 신규 `tier0_candidates_150` 테이블).

**Tech Stack:** Next.js 16 App Router · Supabase RPC · zod (PR2 schemas) · Vitest.

**Canonical 5-PR position:** PR2 ✅ MERGED `f85fb69` → PR3a ✅ MERGED `0813a41` → **PR1 (this)** → PR3b (writer Section 0~7 본문) → PR4 (UI trigger + Track Record + Regen 실 호출).

**Scope guard (재해석 금지):**

- ✅ orchestrator 모듈 + cron route refactor + server action + migration 0020 (short_list_30 columns).
- ❌ writer Section 0~7 본문 (PR3b), `/admin/portfolio` UI 트리거 버튼 (PR4), Track Record 탭 분리 (PR4), Regen 실 호출 wire (PR4), Tier 2 Sector overlay activation (PR3b/PR4), Python `tier0_candidates_150` 시드 스크립트 (후속 PR), 실 LLM 호출 (실 Anthropic key 발급 + 비용 hardcap 운영 검증 후 후속 PR).
- ❌ `parseSectionSafe` console.warn → metric/structured log 격상 (P2, 별도 infra PR로 분리).

---

## File Structure

**Create**:
- `tudal/supabase/migrations/0020_short_list_30_screening_metadata.sql` — `assigned_by` (text nullable, check primary|backfill) + `prompt_version_id` (text nullable) + `personas_version_id` (text nullable) + comment.
- `tudal/supabase/migrations/0020_short_list_30_screening_metadata.rollback.sql` — `alter table ... drop column` 3개.
- `tudal/supabase/migrations/0021_acquire_batch_lock_v2.sql` — **B1 fix**: cron caller path 분리. SECURITY DEFINER RPC `acquire_batch_lock_v2(p_month text, p_caller_kind text)`. `p_caller_kind='admin'` → 기존 `auth.uid() + is_admin()` 경로. `p_caller_kind='cron'` → `auth.role()='service_role'` 검증만 (auth.uid() 우회). 기존 `acquire_batch_lock(text)` RPC는 그대로 보존 (admin server action backward-compat). 기존 `release_batch_lock`도 `auth.uid()` 의존 → cron path는 직접 `update monthly_batch_runs` (service-role client).
- `tudal/supabase/migrations/0021_acquire_batch_lock_v2.rollback.sql` — `drop function if exists public.acquire_batch_lock_v2(text, text);`
- `tudal/src/lib/supabase/service-role.ts` — **B1 fix**: server-only service-role client helper. `createServiceRoleClient()` returns `SupabaseClient` with `SUPABASE_SERVICE_ROLE_KEY`. **B11 fix (omxy R3)**: 모듈 최상단에 `import "server-only";` (Next.js 빌드타임에 client import 차단 — 주석/grep은 보안 경계 아님). 누락 시 throw `service_role_key_missing`.
- `tudal/src/lib/data/admin-batch-runs-cron.ts` — **B1 fix**: cron caller variant of acquireBatchLock + releaseBatchLock. 내부에서 `createServiceRoleClient()` + `acquire_batch_lock_v2('cron')` 호출. 본 모듈 import는 `tudal/src/app/api/cron/` 한정 (boundary grep으로 검증).
- `tudal/src/lib/data/admin-alerts-insert.ts` — **B2 fix**: scheduler_fail alert helper. `recordSchedulerFailAlert({ month, errorCode, supabase })` — alert_event 테이블에 INSERT (`buildSchedulerFailAlert` from monthly-batch.ts로 payload 생성 후 변환). DI 가능하도록 supabase client 인자로 받는다 (cron=service-role / server action=session).
- `tudal/src/lib/screening/monthly-batch-orchestrator.ts` — `runMonthlyBatchOrchestrator(input)`. Pure orchestration. NO I/O 직접 호출 (모든 외부 의존 DI 8종: tier0Source · callPersonaPanel · fetchFinancials · lock · persist · commitBadgeOnly · recordSchedulerFailAlert · adminUserId).
- `tudal/src/lib/screening/__tests__/monthly-batch-orchestrator.test.ts` — Vitest 단위 테스트 9 케이스 (lock acquire 실패 / Tier 0 source ≠ 150 → throw / **B3 fix**: callPersonaPanel all-reject → degraded 30 ⚪ selected + commitBadgeOnly 30회 + lock release succeeded (NOT throw) / runTier1Screening invariant throw (duplicate ticker) → release failed + alert / persist 실패 → release failed + alert / commit_badge_only 실패 → release failed + alert / 정상 path (mixed 🟢🔵🟣🟡 + ⚪) — **B5 fix**: badge-only commit은 `agg.consensus_badges_by_timeframe[agg.assigned_timeframe]==='⚪'`인 ticker에만 / outcome metadata 정확 / scheduler_fail alert 1회 호출 검증).
- `tudal/src/lib/data/admin-shortlist-persist.ts` — `upsertShortList30(month, selected[])`. **B4 fix**: row 객체에 `delta_status: 'new'` 포함 (마이그 0002 NOT NULL check 통과). `delta_reason: null` 명시.
- `tudal/src/lib/data/__tests__/admin-shortlist-persist.test.ts` — 5 케이스 (selected.length≠30 reject / **B4 fix**: row 객체에 `delta_status='new'` 포함 검증 / upsert 정상 / month 중복 conflict on update / assigned_timeframe null reject).
- `tudal/src/app/(admin)/admin/portfolio/__tests__/monthly-batch-action.test.ts` — server action 단위 테스트 (admin 미인증 → auth_unavailable / invalid month / orchestrator throw 매핑 / 정상 path mock orchestrator success / cron path 분리 검증).

**Modify**:
- `tudal/src/app/api/cron/monthly-batch/route.ts` — `isProductionLike` short-circuit 제거. **B1 fix**: cron service-role client 사용 (`admin-batch-runs-cron.ts` lock). **B12 fix (omxy R3)**: route catch는 JSON 502만 반환 (alert 호출 안 함). scheduler_fail alert는 `runMonthlyBatchOrchestrator` 내부 catch에서 `recordSchedulerFailAlert` DI로 **단일** 호출. orchestrator stub throw 테스트는 alert 검증하지 않음 (alert 검증은 orchestrator unit test가 담당). real orchestrator 호출 + mock callPersonaPanel + mock fetchFinancials + mock tier0Source (production 진입 시 `tier0_source_not_wired_pr1_followup` throw → orchestrator 내부 catch → alert 호출 → 502).
- `tudal/src/app/api/cron/monthly-batch/__tests__/route.test.ts` — 신설. **B9 fix (omxy R2)**: route catch에서는 alert 호출 안 함 (alert는 orchestrator 내부 catch에서만). 4 케이스 (unauthorized 401 / orchestrator stub throw → 502 응답 body의 error code 확인만 (alert 검증은 orchestrator unit test 영역) / 정상 200 outcome + body shape / cron path가 service-role lock 사용 확인). orchestrator stub 사용 시 alert 호출 0회 검증 (vi.fn 0회 호출이 자연 발생).
- `tudal/src/app/(admin)/admin/portfolio/actions.ts` — `triggerMonthlyBatch({ month })` server action 추가. **B1 fix**: admin auth + month 정규화 + orchestrator 호출 (lock = 기존 `acquireBatchLock` admin path 그대로) + format-error 매핑. 기존 server actions는 보존.
- `tudal/src/lib/admin/format-error.ts` — **B6 fix**: 함수명 `formatErrorMessage` (NOT `formatAdminError`). 기존 KOREAN_MAPPINGS의 `batch_already_running` / `batch_already_completed` 그대로 보존. 신규 4 키만 추가: `tier1_candidates_must_be_150` / `tier1_screening_failed` / `shortlist_persist_failed` / `commit_badge_only_failed`. 기존 30+ 키 모두 보존.
- `tudal/src/lib/admin/__tests__/format-error.test.ts` — 4개 신규 키에 대한 한국어 매핑 assertion 추가. 기존 `batch_already_running/completed` 테스트는 변경 0.

**No-touch (verify boundary)**:
- `tudal/src/lib/screening/persona-eval.ts` — `runTier1Screening` 본체 변경 0 (PR2 산출물 보존). **B3 lesson**: PR2가 `Promise.allSettled` 패턴이므로 모든 panel call reject 시에도 30 selected ⚪ 산출 → caller(orchestrator)는 throw 안 받음. orchestrator throw는 candidates.length≠150 / duplicate ticker invariant 만.
- `tudal/src/lib/screening/tier1-schema.ts` — schema 변경 0.
- `tudal/src/lib/data/report-section-schemas.ts` — PR3a 산출물 변경 0.
- `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` — PR3a 산출물 변경 0.
- `tudal/src/lib/report/writer.ts` — PR3b scope.
- 마이그 0017 `commit_persona_eval` RPC — 변경 0 (degraded ⚪ path는 `commit_badge_only`만 호출). 마이그 0017 `acquire_batch_lock(text)` RPC도 변경 0 (admin path backward-compat). 마이그 0021은 신규 v2 RPC 추가만.

---

## Tasks

### Task 1: Migration 0020 — short_list_30 screening metadata 컬럼 추가

**Files:**
- Create: `tudal/supabase/migrations/0020_short_list_30_screening_metadata.sql`
- Create: `tudal/supabase/migrations/0020_short_list_30_screening_metadata.rollback.sql`

- [ ] **Step 1: forward migration 작성**

`tudal/supabase/migrations/0020_short_list_30_screening_metadata.sql`:

```sql
-- migration: 0020_short_list_30_screening_metadata
-- purpose: PR1 — short_list_30에 Tier 1 screening 출처 메타데이터 컬럼 추가.
--          assigned_by (primary|backfill nullable) + prompt_version_id + personas_version_id.
-- bucket(text 'short'|'mid'|'long') 컬럼 = assigned_timeframe 의미 그대로 재사용
-- (별도 컬럼 추가 X — 49차 lesson 박제, schema redundancy 회피).
-- 기존 row는 nullable로 유지 (Tier 0-only fallback 시드 보존).
-- ref: docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md §1.1 / PR1 plan §1

alter table public.short_list_30
  add column if not exists assigned_by text
    check (assigned_by in ('primary', 'backfill')),
  add column if not exists prompt_version_id text,
  add column if not exists personas_version_id text;

comment on column public.short_list_30.assigned_by is
  'PR1: Tier 1 selection mode. primary = primary_timeframe argmax 선발, backfill = 부족 timeframe 보충. NULL = Tier 0-only fallback.';
comment on column public.short_list_30.prompt_version_id is
  'PR1: render-user-prompt.ts 버전 식별자. 재현성 audit용.';
comment on column public.short_list_30.personas_version_id is
  'PR1: CORE_11_PERSONAS 버전 식별자. 재현성 audit용.';
```

- [ ] **Step 2: rollback migration 작성**

`tudal/supabase/migrations/0020_short_list_30_screening_metadata.rollback.sql`:

```sql
-- rollback: 0020_short_list_30_screening_metadata
alter table public.short_list_30
  drop column if exists assigned_by,
  drop column if exists prompt_version_id,
  drop column if exists personas_version_id;
```

- [ ] **Step 3: production apply는 USER만 — 본 task는 파일 작성 + commit까지**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS (마이그 SQL은 TypeScript 빌드 영향 0)

- [ ] **Step 4: Commit**

```bash
git add tudal/supabase/migrations/0020_short_list_30_screening_metadata.sql tudal/supabase/migrations/0020_short_list_30_screening_metadata.rollback.sql
git commit -m "feat(PR1 Task1): migration 0020 — short_list_30 screening metadata 컬럼 추가"
```

---

### Task 1b: Migration 0021 — `acquire_batch_lock_v2` (B1 fix: cron caller path)

**Files:**
- Create: `tudal/supabase/migrations/0021_acquire_batch_lock_v2.sql`
- Create: `tudal/supabase/migrations/0021_acquire_batch_lock_v2.rollback.sql`

- [ ] **Step 1: forward migration 작성**

`tudal/supabase/migrations/0021_acquire_batch_lock_v2.sql`:

```sql
-- migration: 0021_acquire_batch_lock_v2
-- purpose: PR1 B1 fix — cron caller path 분리. service_role bypass + admin auth.uid() 두 caller 지원.
-- 기존 acquire_batch_lock(text)는 admin server action backward-compat 위해 보존 (0017).
-- cron route는 본 v2를 호출 (p_caller_kind='cron'), service-role client 필수.
-- ref: docs/superpowers/plans/2026-05-22-pr1-cron-real-path.md Task 1b · omxy R1 B1

create or replace function public.acquire_batch_lock_v2(
  p_month text,
  p_caller_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted timestamptz;
  v_status text;
  v_caller uuid;
  v_caller_role text := auth.role();
begin
  -- caller kind 검증
  if p_caller_kind not in ('admin', 'cron') then
    raise exception 'invalid_caller_kind';
  end if;

  if p_caller_kind = 'admin' then
    v_caller := auth.uid();
    if v_caller is null then raise exception 'auth_unavailable'; end if;
    if not public.is_admin() then raise exception 'admin_required'; end if;
  elsif p_caller_kind = 'cron' then
    -- service-role bypass — Vercel cron route만 호출 (service_role key 필수)
    if v_caller_role is distinct from 'service_role' then
      raise exception 'cron_caller_requires_service_role';
    end if;
    v_caller := null; -- monthly_batch_runs.started_by 컬럼은 nullable이어야 함 (확인 후 마이그)
  end if;

  -- monthly_batch_runs.started_by nullable 검증 (cron caller 시 NULL 허용)
  -- 0017 created with `started_by uuid` — nullable check 마이그 0021에 포함.
  insert into public.monthly_batch_runs (month, status, started_at, started_by, call_count_done)
  values (p_month, 'running', now(), v_caller, 0)
  on conflict (month) do nothing
  returning started_at into v_inserted;

  if v_inserted is not null then
    return jsonb_build_object('acquired', true, 'resumed', false);
  end if;

  select status into v_status from public.monthly_batch_runs where month = p_month;
  if v_status = 'running' then raise exception 'batch_already_running'; end if;
  if v_status = 'succeeded' then raise exception 'batch_already_completed'; end if;
  if v_status = 'failed' then
    update public.monthly_batch_runs
      set status='running', started_at=now(), started_by=v_caller,
          finished_at=null, error_code=null, call_count_done=0
      where month = p_month;
    return jsonb_build_object('acquired', true, 'resumed', true);
  end if;
  raise exception 'batch_lock_unknown_state';
end;
$$;

-- B7 fix (omxy R2): SECURITY DEFINER 4종 세트 (revoke public/anon + grant authenticated + grant service_role).
-- revoke from public 후 service_role도 grant 명시 (CLAUDE.md 48차 lesson 박제 확장).
revoke execute on function public.acquire_batch_lock_v2(text, text) from public;
revoke execute on function public.acquire_batch_lock_v2(text, text) from anon;
grant execute on function public.acquire_batch_lock_v2(text, text) to authenticated;
grant execute on function public.acquire_batch_lock_v2(text, text) to service_role;

-- 보조: monthly_batch_runs.started_by가 NOT NULL이면 cron caller (v_caller=null) insert가 실패.
-- 0017 정의 확인 후 필요 시 ALTER 추가. 본 마이그에서는 nullable 보장 alter 포함:
alter table public.monthly_batch_runs alter column started_by drop not null;
```

- [ ] **Step 2: rollback migration 작성**

`tudal/supabase/migrations/0021_acquire_batch_lock_v2.rollback.sql`:

```sql
-- rollback: 0021_acquire_batch_lock_v2
-- started_by NOT NULL 복구는 production data 영향 — explicit user 승인 필요. drop function만.
drop function if exists public.acquire_batch_lock_v2(text, text);
-- alter table public.monthly_batch_runs alter column started_by set not null; -- 수동 실행
```

- [ ] **Step 3: lint + tsc 검증**

Run: `cd tudal && npm run lint && npx tsc --noEmit`
Expected: PASS (SQL only).

- [ ] **Step 4: Commit**

```bash
git add tudal/supabase/migrations/0021_acquire_batch_lock_v2.sql tudal/supabase/migrations/0021_acquire_batch_lock_v2.rollback.sql
git commit -m "feat(PR1 Task1b): migration 0021 — acquire_batch_lock_v2 cron caller path (omxy R1 B1 fix)"
```

---

### Task 1c-pre: `server-only` npm install + Vitest alias (B13 + B16 fix)

**Files:**
- Modify: `tudal/package.json` (dependencies)
- Modify: `tudal/package-lock.json`
- Modify: `tudal/vitest.config.ts` (alias `server-only → empty stub`)
- Create: `tudal/src/test/server-only-empty.ts`

- [ ] **Step 1: install server-only**

Run:
```bash
cd tudal && npm install server-only
```

- [ ] **Step 2: 검증 server-only resolve**

Run: `cd tudal && node -e "require.resolve('server-only')"`
Expected: 정상 종료 (resolve 성공). MODULE_NOT_FOUND 시 install 재시도.

- [ ] **Step 3: B16 fix — Vitest alias 추가**

`tudal/src/test/server-only-empty.ts`:

```typescript
// PR1 B16 fix (omxy R5) — Vitest용 server-only stub.
// server-only@0.0.1 default index.js는 즉시 throw → Next server build는 조건부 export로 우회하지만
// Vitest node 환경에서는 직접 import 시 throw. 본 stub으로 alias 처리해 test 실행 가능.
export {};
```

`tudal/vitest.config.ts` (**B18 fix (omxy R6)** — 기존 native `resolve.tsconfigPaths: true` 그대로 보존, `vite-tsconfig-paths` npm 패키지는 미설치 → 추가 install 금지. `resolve.alias`만 surgical 추가):

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': path.resolve(__dirname, 'src/test/server-only-empty.ts'),
    },
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
```

기존 1~12 line 구조 (1 import + defineConfig + resolve + test) 보존. `import path from 'node:path'` 1 line 신규 추가 + `resolve.alias` 1 블록 추가만.

- [ ] **Step 4: 검증 vitest 실행** (**B19 fix (omxy R6) + B20 fix (omxy R7)** — directory arg 대신 명시적 flag + passWithNoTests + pipe 제거 (exit code 보존))

Run: `cd tudal && npx vitest --run --passWithNoTests`
Expected: 기존 test:ci suite 통과 (또는 service-role test 미존재 시 passWithNoTests로 0 fail). alias 사이드이펙트로 기존 test 회귀 0 검증. **`2>&1 | tail` pipe 사용 금지** — vitest 실패 시 tail이 exit 0으로 덮어쓰지 못하도록 pipe 없이 직접 실행. 로그 축약이 필요하면 `set -o pipefail` 명시 박제.

- [ ] **Step 5: commit**

```bash
git add tudal/package.json tudal/package-lock.json tudal/vitest.config.ts tudal/src/test/server-only-empty.ts
git commit -m "build(PR1 Task1c-pre): add server-only dep + vitest alias stub (B13+B16 fix)"
```

---

### Task 1c: service-role client + cron lock helper + alert insert helper

**Files:**
- Create: `tudal/src/lib/supabase/service-role.ts`
- Create: `tudal/src/lib/supabase/__tests__/service-role.test.ts`
- Create: `tudal/src/lib/data/admin-batch-runs-cron.ts`
- Create: `tudal/src/lib/data/__tests__/admin-batch-runs-cron.test.ts`
- Create: `tudal/src/lib/data/admin-alerts-insert.ts`
- Create: `tudal/src/lib/data/__tests__/admin-alerts-insert.test.ts`

- [ ] **Step 1: service-role client 작성 + 테스트**

`tudal/src/lib/supabase/service-role.ts`:

```typescript
// PR1 B1+B11+B17 fix — server-only service-role Supabase client.
// B11 (omxy R3): `import "server-only"` 강제 — Next.js 빌드타임에 client import 차단.
// B17 (omxy R5): 사용 boundary는 cron/monthly-batch/ + cron lock helper에 한정.
//   허용:
//     - tudal/src/app/api/cron/monthly-batch/**
//     - tudal/src/lib/data/admin-batch-runs-cron.ts
//   금지 (DI-only 패턴 사용):
//     - tudal/src/lib/data/admin-alerts-insert.ts (supabase: SupabaseClient를 인자로 받음)
//     - tudal/src/app/(admin)/admin/portfolio/actions.ts (session-based createClient만)
// 절대 client component / browser에서 import 금지 (SUPABASE_SERVICE_ROLE_KEY 노출).
import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function createServiceRoleClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('supabase_url_missing');
  if (!key) throw new Error('service_role_key_missing');
  cached = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

// 테스트용 reset (vitest beforeEach에서 호출)
export function __resetServiceRoleClientForTests(): void {
  cached = null;
}
```

테스트 케이스 (3):
1. `SUPABASE_SERVICE_ROLE_KEY` missing → throw `service_role_key_missing`
2. 정상 호출 → SupabaseClient 반환 + 동일 호출 시 cached 동일 인스턴스
3. **B11 fix**: 모듈 import 시 `server-only` 의존성 import 검증 (`grep -n 'import "server-only"' src/lib/supabase/service-role.ts` 1 매치).

추가 grep gate (**B14 + B17 fix** — admin-alerts-insert.ts는 DI-only 패턴 import 0 + grep gate path narrow to monthly-batch/. Task 7 Step 2에 실제 실행 박제):
```bash
grep -rn "@/lib/supabase/service-role\|from.*service-role" tudal/src \
  --exclude-dir=__tests__ \
  | grep -vE "tudal/src/(app/api/cron/monthly-batch/|lib/data/admin-batch-runs-cron\.ts|lib/supabase/service-role\.ts)"
```
Expected: 0 매치 (cron/monthly-batch/ + cron lock helper + service-role 본체만 import 허용 · admin-alerts-insert.ts 명시 제외 · 다른 cron 경로 path는 별도 PR로 확장 시 허용).

- [ ] **Step 2: cron lock helper 작성 + 테스트**

`tudal/src/lib/data/admin-batch-runs-cron.ts`:

```typescript
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { ReleaseBatchLockInput, AcquireBatchLockResult } from './admin-batch-runs';

export async function acquireBatchLockCron(month: string): Promise<AcquireBatchLockResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc('acquire_batch_lock_v2', {
    p_month: month,
    p_caller_kind: 'cron',
  });
  if (error) throw new Error(error.message);
  if (!data?.acquired) throw new Error('batch_lock_acquire_failed');
  return { acquired: true, resumed: data.resumed ?? false };
}

export async function releaseBatchLockCron(input: ReleaseBatchLockInput): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('monthly_batch_runs')
    .update({
      status: input.status,
      finished_at: new Date().toISOString(),
      call_count_done: input.callCountDone,
      error_code: input.errorCode ?? null,
    })
    .eq('month', input.month);
  if (error) throw new Error(`batch_lock_release_failed:${error.code ?? 'unknown'}`);
}
```

테스트 케이스 (3): acquire 정상 / acquire RPC error → throw / release 정상.

- [ ] **Step 3: alert insert helper 작성 + 테스트**

`tudal/src/lib/data/admin-alerts-insert.ts` — **B8 fix**: alert_event 실 컬럼 (alert_type / ticker / severity / trigger_reason / signal_sent_at / outcome_at / t7_price_change / decision_recorded / decision_memo) 정합:

```typescript
import { buildSchedulerFailAlert, type BatchRunOutcome } from '@/lib/scheduler/monthly-batch';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface RecordSchedulerFailInput {
  supabase: SupabaseClient;
  outcome: BatchRunOutcome;  // synthesized BatchRunOutcome (cron caller wrapper에서 minimal 생성)
}

export async function recordSchedulerFailAlert(input: RecordSchedulerFailInput): Promise<void> {
  // buildSchedulerFailAlert는 Omit<AlertEvent, 'id'|'isRead'> camelCase 반환:
  //   { alertType, ticker, severity, triggerReason, signalSentAt, outcomeAt, t7PriceChange, decisionRecorded, decisionMemo }
  // 0010 schema는 snake_case → 매핑 박제.
  const payload = buildSchedulerFailAlert(input.outcome);
  const { error } = await input.supabase
    .from('alert_event')
    .insert({
      alert_type: payload.alertType,            // 'scheduler_fail' (0010 check 통과)
      ticker: payload.ticker,                    // null (alert_event는 ticker nullable)
      severity: payload.severity,                // 'critical'
      trigger_reason: payload.triggerReason,     // 한국어 message
      signal_sent_at: payload.signalSentAt,      // outcome.finishedAt
      outcome_at: payload.outcomeAt,             // null
      t7_price_change: payload.t7PriceChange,    // null
      decision_recorded: payload.decisionRecorded,
      decision_memo: payload.decisionMemo,
    });
  if (error) throw new Error(`scheduler_fail_alert_insert_failed:${error.code ?? 'unknown'}`);
}
```

테스트 케이스 (3): insert 정상 + 9 컬럼 정확 매핑 (vi.fn `.insert` 인자 inspect) / supabase error → throw / payload.alertType === 'scheduler_fail' invariant.

- [ ] **Step 4: 통과 + commit**

```bash
git add tudal/src/lib/supabase/service-role.ts tudal/src/lib/data/admin-batch-runs-cron.ts tudal/src/lib/data/admin-alerts-insert.ts tudal/src/lib/supabase/__tests__/service-role.test.ts tudal/src/lib/data/__tests__/admin-batch-runs-cron.test.ts tudal/src/lib/data/__tests__/admin-alerts-insert.test.ts
git commit -m "feat(PR1 Task1c): service-role client + cron lock + scheduler_fail alert helpers (B1·B2 fix)"
```

---

### Task 2: orchestrator 모듈 + tests (TDD)

**Files:**
- Create: `tudal/src/lib/screening/monthly-batch-orchestrator.ts`
- Test: `tudal/src/lib/screening/__tests__/monthly-batch-orchestrator.test.ts`

- [ ] **Step 1: 실패 테스트 작성 — Tier 0 candidates length ≠ 150 → throw**

`tudal/src/lib/screening/__tests__/monthly-batch-orchestrator.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { runMonthlyBatchOrchestrator } from '../monthly-batch-orchestrator';
import type { Tier1Candidate } from '../persona-eval';

const noopLock = {
  acquire: vi.fn().mockResolvedValue({ acquired: true, resumed: false }),
  release: vi.fn().mockResolvedValue(undefined),
};
const noopPersist = vi.fn().mockResolvedValue(undefined);
const noopCommit = vi.fn().mockResolvedValue(undefined);

describe('runMonthlyBatchOrchestrator', () => {
  it('throws if Tier 0 source yields ≠ 150 candidates', async () => {
    const source: () => Promise<Tier1Candidate[]> = vi.fn().mockResolvedValue([]);
    await expect(
      runMonthlyBatchOrchestrator({
        month: '2026-06',
        adminUserId: 'admin-test',
        promptVersionId: 'render-user-prompt@v1',
        personasVersionId: 'core11@v3.1',
        tier0Source: source,
        callPersonaPanel: vi.fn().mockResolvedValue([]),
        fetchFinancials: vi.fn().mockResolvedValue(''),
        lock: noopLock,
        persist: noopPersist,
        commitBadgeOnly: noopCommit,
      })
    ).rejects.toThrow(/tier1_candidates_must_be_150/);
  });
});
```

- [ ] **Step 2: 테스트 실행 (FAIL 확인)**

Run: `cd tudal && npx vitest run src/lib/screening/__tests__/monthly-batch-orchestrator.test.ts`
Expected: FAIL with "cannot find module './monthly-batch-orchestrator'"

- [ ] **Step 3: orchestrator skeleton 작성** (B3 + B5 + scheduler_fail alert DI 포함)

`tudal/src/lib/screening/monthly-batch-orchestrator.ts`:

```typescript
import {
  runTier1Screening,
  type Tier1Candidate,
} from './persona-eval';
import type { PersonaScore, Tier1ScreeningResult } from './tier1-schema';

export interface OrchestratorLock {
  acquire: (month: string) => Promise<{ acquired: boolean; resumed: boolean }>;
  release: (input: {
    month: string;
    status: 'succeeded' | 'failed';
    callCountDone: number;
    errorCode?: string;
  }) => Promise<void>;
}

export interface RunMonthlyBatchOrchestratorInput {
  month: string;            // YYYY-MM
  adminUserId: string;
  promptVersionId: string;
  personasVersionId: string;
  tier0Source: () => Promise<Tier1Candidate[]>;       // returns 150 dedup tickers
  callPersonaPanel: (input: { ticker: string; financials: string }) => Promise<PersonaScore[]>;
  fetchFinancials: (ticker: string) => Promise<string>;
  lock: OrchestratorLock;
  persist: (month: string, selected: Tier1ScreeningResult['selected']) => Promise<void>;
  commitBadgeOnly: (input: { month: string; ticker: string; badge: '⚪' }) => Promise<void>;
  /**
   * B2 fix — 실패 시 scheduler_fail alert insert/emit. orchestrator throw 직전 호출.
   * 인자: month + errorCode + callCountDone (실패 시점 통계).
   */
  recordSchedulerFailAlert: (input: {
    month: string;
    errorCode: string;
    callCountDone: number;
  }) => Promise<void>;
}

export interface OrchestratorOutcome {
  month: string;
  selectedCount: number;
  notSelectedCount: number;
  badgeOnlyCount: number;
  promptVersionId: string;
  personasVersionId: string;
}

export async function runMonthlyBatchOrchestrator(
  input: RunMonthlyBatchOrchestratorInput
): Promise<OrchestratorOutcome> {
  await input.lock.acquire(input.month);

  let callCountDone = 0;
  try {
    const candidates = await input.tier0Source();
    if (candidates.length !== 150) {
      throw new Error(`tier1_candidates_must_be_150 (got ${candidates.length})`);
    }

    // B3 lesson — runTier1Screening은 Promise.allSettled 패턴: 모든 callPersonaPanel reject 시에도
    // 30 selected ⚪ degraded success 반환. throw는 candidates invariant (length≠150 / duplicate ticker / zod) 한정.
    const result = await runTier1Screening({
      candidates,
      callPersonaPanel: input.callPersonaPanel,
      fetchFinancials: input.fetchFinancials,
      promptVersionId: input.promptVersionId,
      personasVersionId: input.personasVersionId,
    });
    callCountDone = candidates.length;

    await input.persist(input.month, result.selected);

    // B5 fix — badge-only commit은 ticker의 assigned_timeframe badge가 ⚪인 경우만.
    // (다른 timeframe의 ⚪는 unrelated — selection은 assigned_timeframe 기준)
    let badgeOnlyCount = 0;
    for (const agg of result.selected) {
      if (agg.assigned_timeframe === null) continue; // zod refinement 보장이지만 type guard
      const assignedBadge = agg.consensus_badges_by_timeframe[agg.assigned_timeframe];
      if (assignedBadge === '⚪') {
        await input.commitBadgeOnly({
          month: input.month,
          ticker: agg.ticker,
          badge: '⚪',
        });
        badgeOnlyCount++;
      }
    }

    await input.lock.release({
      month: input.month,
      status: 'succeeded',
      callCountDone,
    });

    return {
      month: input.month,
      selectedCount: result.selected.length,
      notSelectedCount: result.notSelected.length,
      badgeOnlyCount,
      promptVersionId: input.promptVersionId,
      personasVersionId: input.personasVersionId,
    };
  } catch (err) {
    const errorCode = err instanceof Error ? err.message : 'unknown';
    // B2 fix — scheduler_fail alert 먼저 (alert insert 실패도 swallow하지 않고 throw chain 보존)
    try {
      await input.recordSchedulerFailAlert({
        month: input.month,
        errorCode,
        callCountDone,
      });
    } catch (alertErr) {
      // alert insert 실패는 원래 errorCode 가리지 않기 위해 stderr 로깅만 (보존)
      // production에서는 metric 격상 권장 (P2 별도 PR).
      // eslint-disable-next-line no-console
      console.warn('[orchestrator] scheduler_fail alert insert error:', alertErr);
    }
    await input.lock.release({
      month: input.month,
      status: 'failed',
      callCountDone,
      errorCode,
    });
    throw err;
  }
}
```

- [ ] **Step 4: 테스트 재실행 (PASS 확인)**

Run: `cd tudal && npx vitest run src/lib/screening/__tests__/monthly-batch-orchestrator.test.ts`
Expected: PASS (1/1)

- [ ] **Step 5: 추가 8 케이스 작성** (B3·B5 정정 박제 · FAIL → impl → PASS 반복)

추가 케이스 (총 9 케이스 = Step 1 + 8):
1. **lock acquire 실패 propagate** — `lock.acquire` reject → orchestrator throw, persist 0 호출, recordSchedulerFailAlert 0 호출 (acquire 전에 fail이므로 try 블록 진입 X).
2. **B3 fix: callPersonaPanel all-reject → degraded 30 ⚪ selected** — `tier0Source` 정상 150 + `callPersonaPanel` 모두 reject → screening은 throw 안 함 → result.selected.length === 30 (Tier 0 fallback ranking) → badgeOnlyCount === 30 (모두 ⚪) → lock.release status='succeeded' → outcome.badgeOnlyCount === 30.
3. **runTier1Screening invariant throw (duplicate ticker) → release failed + alert** — `tier0Source`가 ticker 중복 150 반환 → screening throw `tier1_candidates_have_duplicate_tickers` → catch 분기 → recordSchedulerFailAlert 1회 호출 + release status='failed' + throw propagate.
4. **persist 실패 propagate** — `persist` reject → catch 분기 → recordSchedulerFailAlert 1회 + release failed + throw.
5. **commit_badge_only 실패 propagate** — 한 ticker `commitBadgeOnly` reject → catch 분기 → recordSchedulerFailAlert 1회 + release failed + throw.
6. **정상 path mixed badge** — 150 candidates → 30 selected, 일부 🟢 일부 ⚪ → **B5 fix**: commitBadgeOnly는 `agg.consensus_badges_by_timeframe[agg.assigned_timeframe]==='⚪'` ticker에만 호출 (어떤 ticker는 short=⚪ but assigned_timeframe=mid + mid=🟢 → commit_badge_only 호출 안 됨).
7. **outcome metadata 정확** — selectedCount=30 / notSelectedCount=120 / promptVersionId · personasVersionId 입력값 일치.
8. **scheduler_fail alert insert 실패 swallow** — recordSchedulerFailAlert reject + persist throw 동시 → 원본 persist error code가 throw + alert는 console.warn으로 swallow + release failed 호출 (alert error로 release 누락 방지).
9. **scheduler_fail alert: orchestrator 정상 path에서 0회 호출** — 정상 종료 시 recordSchedulerFailAlert 0회 호출 검증.

각 케이스마다 vi.fn 호출 횟수 + 인자 형태 assertion.

- [ ] **Step 6: 통과 확인 + commit**

Run: `cd tudal && npx vitest run src/lib/screening/__tests__/monthly-batch-orchestrator.test.ts`
Expected: PASS (9/9)

```bash
git add tudal/src/lib/screening/monthly-batch-orchestrator.ts tudal/src/lib/screening/__tests__/monthly-batch-orchestrator.test.ts
git commit -m "feat(PR1 Task2): orchestrator module + 9 TDD tests (B3 allSettled degraded + B5 badge-only condition + scheduler_fail alert DI)"
```

---

### Task 3: short_list_30 persist helper + tests

**Files:**
- Create: `tudal/src/lib/data/admin-shortlist-persist.ts`
- Test: `tudal/src/lib/data/__tests__/admin-shortlist-persist.test.ts`

- [ ] **Step 1: 실패 테스트 — selected.length ≠ 30 throw**

`tudal/src/lib/data/__tests__/admin-shortlist-persist.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { upsertShortList30 } from '../admin-shortlist-persist';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

describe('upsertShortList30', () => {
  it('rejects selected.length != 30', async () => {
    await expect(upsertShortList30('2026-06', [])).rejects.toThrow(
      /shortlist_must_have_30_rows/
    );
  });
});
```

- [ ] **Step 2: FAIL 확인**

Run: `cd tudal && npx vitest run src/lib/data/__tests__/admin-shortlist-persist.test.ts`
Expected: FAIL with "cannot find module"

- [ ] **Step 3: persist 모듈 작성**

`tudal/src/lib/data/admin-shortlist-persist.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import type { TickerAggregate } from '@/lib/screening/tier1-schema';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

interface ShortListRow {
  month: string;     // YYYY-MM-01 date literal
  ticker: string;
  bucket: 'short' | 'mid' | 'long';
  rank: number;
  assigned_by: 'primary' | 'backfill' | null;
  prompt_version_id: string;
  personas_version_id: string;
  // B4 fix — 마이그 0002 `delta_status text not null check ('new','hold','removed')`
  delta_status: 'new' | 'hold' | 'removed';
  delta_reason: string | null;
}

function toMonthDate(monthYM: string): string {
  if (!MONTH_RE.test(monthYM)) {
    throw new Error(`invalid_month_format:${monthYM}`);
  }
  return `${monthYM}-01`;
}

export async function upsertShortList30(
  monthYM: string,
  selected: readonly TickerAggregate[]
): Promise<void> {
  if (selected.length !== 30) {
    throw new Error(`shortlist_must_have_30_rows (got ${selected.length})`);
  }
  const monthDate = toMonthDate(monthYM);

  const byTf: Record<'short' | 'mid' | 'long', TickerAggregate[]> = {
    short: [],
    mid: [],
    long: [],
  };
  for (const agg of selected) {
    if (agg.assigned_timeframe === null) {
      throw new Error(`assigned_timeframe_null_for_selected:${agg.ticker}`);
    }
    byTf[agg.assigned_timeframe].push(agg);
  }

  const rows: ShortListRow[] = [];
  for (const tf of ['short', 'mid', 'long'] as const) {
    byTf[tf].forEach((agg, idx) => {
      rows.push({
        month: monthDate,
        ticker: agg.ticker,
        bucket: tf,
        rank: idx + 1,
        assigned_by: agg.assigned_by,
        prompt_version_id: agg.prompt_version_id,
        personas_version_id: agg.personas_version_id,
        // B4 fix — delta_status NOT NULL constraint 통과. PR1 첫 실행은 모두 'new'로 처리.
        // (전월 대비 hold/removed 비교는 PR3b 또는 후속 PR scope.)
        delta_status: 'new',
        delta_reason: null,
      });
    });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('short_list_30')
    .upsert(rows, { onConflict: 'month,ticker' });
  if (error) {
    throw new Error(`shortlist_persist_failed:${error.code ?? 'unknown'}`);
  }
}
```

- [ ] **Step 4: 추가 4 케이스 작성** — upsert 정상 + delta_status='new' 검증 / unique conflict on (month,ticker) / assigned_timeframe null reject / **B4 fix**: 모든 row가 `delta_status: 'new'` + `delta_reason: null` 포함 (mock supabase의 `.upsert(rows)` 인자 inspect).

- [ ] **Step 5: PASS + commit**

```bash
git add tudal/src/lib/data/admin-shortlist-persist.ts tudal/src/lib/data/__tests__/admin-shortlist-persist.test.ts
git commit -m "feat(PR1 Task3): upsertShortList30 helper + 5 TDD tests (B4 delta_status NOT NULL fix)"
```

---

### Task 4: cron route real path refactor

**Files:**
- Modify: `tudal/src/app/api/cron/monthly-batch/route.ts`
- Create: `tudal/src/app/api/cron/monthly-batch/__tests__/route.test.ts`

- [ ] **Step 1: 실패 테스트 — unauthorized request → 401**

`tudal/src/app/api/cron/monthly-batch/__tests__/route.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

beforeEach(() => {
  process.env.CRON_SECRET = 'test-secret-pr1';
});

describe('GET /api/cron/monthly-batch', () => {
  it('rejects requests without bearer token (401)', async () => {
    const req = new NextRequest('https://example.com/api/cron/monthly-batch');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: FAIL 확인** (현재 route는 mock 분기를 production에서 short-circuit하므로 401 분기는 통과 — 실은 신규 테스트 인프라가 없으면 NextRequest mocking 자체가 FAIL)

Run: `cd tudal && npx vitest run src/app/api/cron/monthly-batch/__tests__/route.test.ts`
Expected: PASS or FAIL depending on existing infra — if PASS, this step verifies green baseline. If FAIL, fix mock.

- [ ] **Step 3: route refactor — isProductionLike short-circuit 제거 + orchestrator 호출** (B1·B2 fix)

`tudal/src/app/api/cron/monthly-batch/route.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { acquireBatchLockCron, releaseBatchLockCron } from "@/lib/data/admin-batch-runs-cron";
import { runMonthlyBatchOrchestrator } from "@/lib/screening/monthly-batch-orchestrator";
import { upsertShortList30 } from "@/lib/data/admin-shortlist-persist";
import { recordSchedulerFailAlert } from "@/lib/data/admin-alerts-insert";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Tier1Candidate } from "@/lib/screening/persona-eval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function currentMonthYM(): string {
  const now = new Date();
  const m = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  return `${now.getUTCFullYear()}-${m}`;
}

// Placeholder mock — 본 PR scope에서는 Tier 0 source 실 구현 OOS (후속 PR + Python tier0_candidates_150 시드).
// B15 fix (omxy R4): production 진입 시점에 throw → orchestrator 내부 catch → recordSchedulerFailAlert + release failed.
// route catch는 JSON 502만 반환 (alert 중복 호출 차단).
async function mockTier0Source(): Promise<Tier1Candidate[]> {
  throw new Error('tier0_source_not_wired_pr1_followup');
}

async function mockCallPersonaPanel(): Promise<never> {
  throw new Error('persona_panel_not_wired_pr1_followup');
}

async function mockFetchFinancials(): Promise<string> {
  return '';
}

async function commitBadgeOnly(): Promise<void> {
  throw new Error('commit_badge_only_not_wired_pr1_followup');
}

// 동기적으로 scheduler_fail alert 호출 가능한 wrapper (orchestrator interface 요구)
async function recordSchedulerFailAlertForCron(input: {
  month: string;
  errorCode: string;
  callCountDone: number;
}): Promise<void> {
  const supabase = createServiceRoleClient();
  // BatchRunOutcome synthesized — buildSchedulerFailAlert가 outcome.runId/steps 사용.
  // 본 wrapper에서는 minimal synthetic outcome 제공.
  await recordSchedulerFailAlert({
    supabase,
    outcome: {
      runId: `cron-${input.month}-${Date.now()}`,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      totalLatencyMs: 0,
      overallSuccess: false,
      steps: [
        {
          name: 'orchestrator',
          pipeline: 'dart',
          attempts: 1,
          success: false,
          error: input.errorCode,
          latencyMs: 0,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        },
      ],
    },
  });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const month = currentMonthYM();
  try {
    const outcome = await runMonthlyBatchOrchestrator({
      month,
      adminUserId: 'cron-system',
      promptVersionId: process.env.PROMPT_VERSION_ID ?? 'render-user-prompt@v1',
      personasVersionId: process.env.PERSONAS_VERSION_ID ?? 'core11@v3.1',
      tier0Source: mockTier0Source,
      callPersonaPanel: mockCallPersonaPanel,
      fetchFinancials: mockFetchFinancials,
      lock: {
        acquire: acquireBatchLockCron,
        release: releaseBatchLockCron,
      },
      persist: upsertShortList30,
      commitBadgeOnly,
      recordSchedulerFailAlert: recordSchedulerFailAlertForCron,
    });
    return NextResponse.json({ ok: true, outcome }, { status: 200 });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ ok: false, error: code }, { status: 502 });
  }
}
```

- [ ] **Step 4: 추가 3 cron test 케이스** (B9 fix 정정 — alert 검증은 orchestrator unit test 영역) — 정상 path mock orchestrator (vi.mock으로 orchestrator stub) success → 200 + outcome body / orchestrator throw → 502 + error code body (alert insert 검증은 X — orchestrator unit test가 담당) / 동일 month 중복 → orchestrator가 propagate한 `batch_already_completed` 502 error body.

- [ ] **Step 5: PASS + commit**

```bash
git add tudal/src/app/api/cron/monthly-batch/route.ts tudal/src/app/api/cron/monthly-batch/__tests__/route.test.ts
git commit -m "feat(PR1 Task4): cron route real path — isProductionLike short-circuit 제거 + orchestrator DI 호출"
```

---

### Task 5: admin server action `triggerMonthlyBatch`

**Files:**
- Modify: `tudal/src/app/(admin)/admin/portfolio/actions.ts`
- Create: `tudal/src/app/(admin)/admin/portfolio/__tests__/monthly-batch-action.test.ts`

- [ ] **Step 1: 실패 테스트 — admin 미인증 → "auth_unavailable"**

`tudal/src/app/(admin)/admin/portfolio/__tests__/monthly-batch-action.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  }),
}));

import { triggerMonthlyBatch } from '../actions';

describe('triggerMonthlyBatch', () => {
  it('returns auth_unavailable when no admin user', async () => {
    const res = await triggerMonthlyBatch({ month: '2026-06' });
    expect(res).toEqual({ success: false, error: 'auth_unavailable' });
  });
});
```

- [ ] **Step 2: FAIL 확인**

- [ ] **Step 3: action 작성**

`tudal/src/app/(admin)/admin/portfolio/actions.ts` 끝에 추가:

```typescript
"use server";

import { runMonthlyBatchOrchestrator } from "@/lib/screening/monthly-batch-orchestrator";
import { acquireBatchLock, releaseBatchLock } from "@/lib/data/admin-batch-runs";
import { upsertShortList30 } from "@/lib/data/admin-shortlist-persist";
import { createClient } from "@/lib/supabase/server";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function triggerMonthlyBatch(input: {
  month: string;
}): Promise<{ success: true; data: { selectedCount: number } } | { success: false; error: string }> {
  if (!input || typeof input.month !== 'string') {
    return { success: false, error: 'invalid_input' };
  }
  if (!MONTH_RE.test(input.month)) {
    return { success: false, error: 'invalid_month' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { success: false, error: 'auth_unavailable' };

  try {
    const outcome = await runMonthlyBatchOrchestrator({
      month: input.month,
      adminUserId: user.id,
      promptVersionId: process.env.PROMPT_VERSION_ID ?? 'render-user-prompt@v1',
      personasVersionId: process.env.PERSONAS_VERSION_ID ?? 'core11@v3.1',
      tier0Source: async () => { throw new Error('tier0_source_not_wired_pr1_followup'); },
      callPersonaPanel: async () => { throw new Error('persona_panel_not_wired_pr1_followup'); },
      fetchFinancials: async () => '',
      lock: { acquire: acquireBatchLock, release: releaseBatchLock },
      persist: upsertShortList30,
      commitBadgeOnly: async () => { throw new Error('commit_badge_only_not_wired_pr1_followup'); },
      recordSchedulerFailAlert: async () => {
        // admin server action path는 alert insert를 별도 비동기로 위임 가능. PR1 scope:
        // server action caller가 UI 측에서 toast 표시 (alert_event 테이블 INSERT는 PR4에서 결정).
        // 본 PR에서는 noop으로 두어 admin caller fail이 alert spam 야기하지 않도록.
      },
    });
    return { success: true, data: { selectedCount: outcome.selectedCount } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'orchestrator_failed' };
  }
}
```

- [ ] **Step 4: 추가 4 케이스** — invalid month / orchestrator throw 매핑 / 정상 path (mock orchestrator success) / month YYYY-MM 정규화 boundary.

- [ ] **Step 5: PASS + commit**

```bash
git add tudal/src/app/(admin)/admin/portfolio/actions.ts tudal/src/app/(admin)/admin/portfolio/__tests__/monthly-batch-action.test.ts
git commit -m "feat(PR1 Task5): triggerMonthlyBatch admin server action + 5 TDD tests"
```

---

### Task 6: format-error 한국어 매핑 추가 (B6 fix: formatErrorMessage + 기존 매핑 보존)

**Files:**
- Modify: `tudal/src/lib/admin/format-error.ts`
- Modify: `tudal/src/lib/admin/__tests__/format-error.test.ts`

- [ ] **Step 1: 실패 테스트 — 신규 4 키 한국어 매핑 (B6 fix: formatErrorMessage 함수명)**

`tudal/src/lib/admin/__tests__/format-error.test.ts`에 신규 describe 블록 추가 (기존 `batch_already_running/completed` 테스트는 그대로 보존):

```typescript
// 기존 import에 formatErrorMessage가 이미 있을 것 — 확인.
describe('PR1 신규 error codes', () => {
  it.each([
    ['tier1_candidates_must_be_150', 'Tier 0 후보 수가 150개가 아닙니다'],
    ['tier1_screening_failed', 'Tier 1 평가에 실패했습니다'],
    ['shortlist_persist_failed', 'Short List 저장에 실패했습니다'],
    ['commit_badge_only_failed', '배지 commit에 실패했습니다'],
  ])('maps %s to %s', (code, expected) => {
    expect(formatErrorMessage(code)).toBe(expected);
  });
});
```

- [ ] **Step 2: FAIL 확인 → format-error.ts에 4 신규 키 + 2 prefix handler 추가 (B10 fix · 기존 30+ 키 모두 보존)**

`tudal/src/lib/admin/format-error.ts`의 `KOREAN_MAPPINGS` 객체에 추가 (S7a §11 섹션 끝에):

```typescript
  // PR1 — orchestrator + persist + commit_badge_only error codes (54차 §4 v3)
  tier1_candidates_must_be_150: "Tier 0 후보 수가 150개가 아닙니다",
  tier1_screening_failed: "Tier 1 평가에 실패했습니다",
  shortlist_persist_failed: "Short List 저장에 실패했습니다",
  commit_badge_only_failed: "배지 commit에 실패했습니다",
```

**B10 fix (omxy R2)**: orchestrator는 throw `tier1_candidates_must_be_150 (got 0)` / `shortlist_persist_failed:23505` 같은 suffix 메시지를 발생시킨다. exact key mapping만으로는 fallback `오류: ...` 표시. `formatErrorMessage` 함수 본문에 prefix handler 추가 (기존 `accept_gate_blocked:` 패턴 그대로 확장):

```typescript
// 기존 prefix handler 직후에 추가:
if (code.startsWith("tier1_candidates_must_be_150")) {
  return KOREAN_MAPPINGS["tier1_candidates_must_be_150"];
}
if (code.startsWith("shortlist_persist_failed:") || code.startsWith("shortlist_persist_failed ")) {
  return KOREAN_MAPPINGS["shortlist_persist_failed"];
}
```

테스트 추가 (4 → 6 케이스):
- 기존 4 exact key 매핑.
- B10 prefix: `formatErrorMessage('tier1_candidates_must_be_150 (got 0)')` → "Tier 0 후보 수가 150개가 아닙니다".
- B10 prefix: `formatErrorMessage('shortlist_persist_failed:23505')` → "Short List 저장에 실패했습니다".

- [ ] **Step 3: PASS + commit**

```bash
git add tudal/src/lib/admin/format-error.ts tudal/src/lib/admin/__tests__/format-error.test.ts
git commit -m "feat(PR1 Task6): format-error 4 신규 키 매핑 추가 (B6 formatErrorMessage 함수명 + 기존 매핑 보존)"
```

---

### Task 7: 종단 검증 + 검증 게이트 통과

- [ ] **Step 1: 전체 게이트 실행**

Run: `cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit`
Expected: build 25 routes pass / lint 0 err 6 warn (baseline) / test:ci 802 + N new tests / tsc clean

- [ ] **Step 2: forbidden grep 게이트** (B14+B21 fix — narrow scope + quote-agnostic marker)

Run:
```bash
cd tudal && \
echo "=== isProductionLike in cron path (expect 0) ===" && \
grep -rn "isProductionLike()" src/app/api/cron/monthly-batch/ | grep -v __tests__ ; \
echo "=== monthly-batch mock-mode residue (expect 0) ===" && \
grep -rn "mockMode: true\|monthly_batch_real_pipeline_not_configured" \
  src/app/api/cron/monthly-batch/ \
  src/lib/screening/ \
  src/lib/data/admin-batch-runs-cron.ts \
  src/lib/data/admin-shortlist-persist.ts \
  src/lib/data/admin-alerts-insert.ts \
  src/lib/supabase/service-role.ts ; \
echo "=== PR3a regression (expect 0) ===" && \
grep -rn "as ReportSection\b" 'src/app/(admin)/admin/report/' ; \
echo "=== service-role import boundary (expect 0) ===" && \
grep -rn "@/lib/supabase/service-role\|from.*service-role" src --exclude-dir=__tests__ \
  | grep -vE "src/(app/api/cron/monthly-batch/|lib/data/admin-batch-runs-cron\.ts|lib/supabase/service-role\.ts)" ; \
echo "=== server-only marker (expect 1+) ===" && \
grep -nE "import ['\"]server-only['\"]" src/lib/supabase/service-role.ts ; \
echo DONE
```
Expected: 첫 4개 grep 모두 0 매치 + 마지막 1+ 매치 + `DONE`. **B21 fix (omxy R9)**: mockMode grep을 PR1 신규 모듈 path에 narrow (broad `src/` grep은 silent-health/notify/email 등 unrelated 잔존 → false-positive). marker는 quote-agnostic `grep -E "['\"]"` (코드가 single quote `'server-only'` 사용).

- [ ] **Step 3: 종합 verification commit (필요 시)**

검증 결과 박제 commit:

```bash
git commit --allow-empty -m "test(PR1): 검증 게이트 — build/lint/test:ci/tsc + forbidden grep 5종 0 매치"
```

---

## Self-Review (v8, post-omxy R1~R7 = 20 BLOCKERS fix)

**Post-R7 정정**:
- ✅ **B20**: Step 4 vitest 검증 명령에서 `2>&1 | tail` pipe 제거. vitest 실패 시 exit code 정확히 propagate.

**Post-R6 정정**:
- ✅ **B18**: vitest.config.ts 기존 native `resolve.tsconfigPaths: true` 그대로 보존. `vite-tsconfig-paths` 패키지 신규 install 0. surgical edit `resolve.alias` 1 block + `import path from 'node:path'` 1 line만 추가.
- ✅ **B19**: Step 4 검증 명령어 `npx vitest --run --passWithNoTests`로 명시화. directory arg 모호성 제거.

**Post-R5 정정**:
- ✅ **B16**: Vitest alias `server-only → src/test/server-only-empty.ts` (empty export stub) + tudal/vitest.config.ts surgical edit. service-role.test.ts + admin-batch-runs-cron.test.ts가 server-only direct import 시 throw 차단.
- ✅ **B17**: service-role.ts 모듈 헤더 주석 + grep gate path narrow `src/app/api/cron/monthly-batch/`로 좁힘. admin-alerts-insert.ts (DI-only) 명시 금지.

**Post-R4 정정**:
- ✅ **B13**: `server-only` npm install Task 1c-pre 신설 + `node -e "require.resolve('server-only')"` 검증.
- ✅ **B14**: Task 7 Step 2에 service-role grep gate 실제 실행 박제 + admin-alerts-insert.ts (DI-only) 허용 대상에서 제외.
- ✅ **B15**: Task 4 cron route mockTier0Source 주석 정정 — "orchestrator 내부 catch에서 alert + release failed, route catch는 JSON 502만".

**Post-R3 정정**:
- ✅ **B11**: `import "server-only"` 강제 (Next.js 빌드타임 차단) + grep gate 박제 — Task 1c service-role.ts + Task 7 forbidden grep.
- ✅ **B12**: File Structure "Modify" 항목 문구 정정 — "cron route catch는 JSON 502만, alert는 orchestrator 내부 catch에서 단일 호출" 명시.

**Post-R2 정정**:
- ✅ **B7**: SECURITY DEFINER 4종 세트 (revoke public/anon + grant authenticated + **grant service_role**) — Task 1b SQL.
- ✅ **B8**: alert_event 9 컬럼 정합 (alert_type/ticker/severity/trigger_reason/signal_sent_at/outcome_at/t7_price_change/decision_recorded/decision_memo) — Task 1c helper.
- ✅ **B9**: cron route test에서 alert 검증 삭제. alert는 orchestrator 내부 catch에서만 호출 (orchestrator unit test에서 검증) → Task 4 cron route 단순화.
- ✅ **B10**: format-error에 2 prefix handler 추가 (`tier1_candidates_must_be_150` / `shortlist_persist_failed:`) — orchestrator suffix throw 호환.



**1. Spec coverage** (HANDOFF.md PR1 row vs plan tasks):
- ✅ "cron `monthly-batch` real path enable + server-callable trigger function" → Task 4 (cron) + Task 5 (server action)
- ✅ "Task 12 mock dry-run 폐기" → Task 4 Step 3 (`isProductionLike` short-circuit 제거)
- ✅ "cron이 PR #11의 runTier1Screening 호출 + PR #12의 zod validation 거쳐" → Task 2 (orchestrator delegates to runTier1Screening)
- ✅ "commit_persona_eval RPC" → degraded path만 처리 (commitBadgeOnly), full report (commit_persona_eval)은 writer Section 0~7 산출물 필요로 PR3b까지 wire 보류.
- ✅ "UI 버튼은 PR4 scope" → 본 plan에서 server action 까지만, 버튼 UI 0 변경.
- ✅ migration 0020 short_list_30 컬럼 → Task 1.
- ✅ **omxy R1 B1 fix**: migration 0021 cron caller path + service-role client → Task 1b + Task 1c.
- ✅ **omxy R1 B2 fix**: scheduler_fail alert wire → Task 1c (helper) + Task 2 (orchestrator DI) + Task 4 (cron catch).
- ✅ **omxy R1 B3 fix**: allSettled 의미 정정 → Task 2 Step 5 case 2 (all-reject → degraded 30 ⚪ success).
- ✅ **omxy R1 B4 fix**: delta_status='new' NOT NULL → Task 3 Step 3.
- ✅ **omxy R1 B5 fix**: badge-only condition `agg.consensus_badges_by_timeframe[agg.assigned_timeframe]==='⚪'` → Task 2 Step 3.
- ✅ **omxy R1 B6 fix**: formatErrorMessage 함수명 + 기존 매핑 보존 + 4 신규 키 → Task 6.

**2. Placeholder scan**: TBD/TODO/"implement later" 0건 (검증: `grep -n 'TBD\|TODO\|implement later' docs/superpowers/plans/2026-05-22-pr1-cron-real-path.md` → 0 매치 expect).

**3. Type consistency**:
- `Tier1Candidate` (persona-eval.ts에 정의됨, plan 일관 사용) ✅
- `TickerAggregate` (tier1-schema.ts, persist helper signature 일치) ✅
- `OrchestratorLock` (orchestrator interface, route + server action 동일 호출) ✅
- `runMonthlyBatchOrchestrator` 시그니처 (Task 2, 4, 5 일관 — 8 DI fields) ✅
- `formatErrorMessage` (B6 fix — actual function name) ✅
- `delta_status: 'new'|'hold'|'removed'` (B4 fix — schema 0002 check 통과) ✅

**4. 새 발견 gap**:
- Tier 0 source 실 wire는 본 PR scope 외 — 후속 PR에서 Python `tier0_candidates_150` table 시드 + cron real source. 현 상태에서 cron 실 호출 시 `tier0_source_not_wired_pr1_followup` throw → catch → recordSchedulerFailAlert → release failed → 502 (production 안전 + observability).
- `commit_persona_eval` full report RPC 호출은 writer Section 0~7 본문 (PR3b) 산출물 필요 → 본 PR에서는 `commitBadgeOnly` (⚪ degraded path)만 wire.
- `monthly_batch_runs.started_by` NOT NULL → migration 0021에서 `drop not null` 포함 (cron caller가 null로 INSERT 필요).
- Server action recordSchedulerFailAlert는 noop wire (alert spam 방지) — admin 트리거 시 UI toast로 처리 (PR4 scope).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-22-pr1-cron-real-path.md`.**

다음 단계:
1. **omxy 적대적 검토** (R1+ until CONVERGED) — 본 plan 송신 + BLOCKERS catch & fix.
2. CONVERGED 후 **subagent-driven-development**로 Task 1~7 순차 구현 (worktree 분리).
3. impl 완료 후 **omxy R5~R7** (plan-vs-commit + Codex GATE).
4. **gsd-code-reviewer (depth=deep)** + Fix-First.
5. **push + PR create** (HANDOFF Step matrix PR1 row spec 그대로).
