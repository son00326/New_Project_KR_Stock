# B65-P3 P1/P2 호환 feature flag + 마이그 0025 impl plan

> **세션**: 57차 §3 (Task 4) — DRAFT R0
> **상태**: PLAN DRAFT — omxy R1 verify 대기
> **paired spec (lock-in SoT)**: [docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md](../specs/2026-05-26-b65-p2-rpc-rdebate.md) (R8 final, 옵션 A)
> **선행 commit**: PR #21 `5b99e03` (B65-P1 immediate guard MERGED in main)
> **블록**: PR5 entry (Task 5 backfill + Task 6 Stage 1 + Task 7 Stage 2 USER 승인 모두 PASS 후 진입)

---

## 0. Scope guard (재해석 금지)

**본 plan scope**:
- B65-P3 feature flag `PR4_TRIGGER_UPSERT_ENABLED` env 도입 (production default = `true`, B98 lock-in; `.env.example` 박제 = `false` 안전 default — omxy R1 Schop B5 fix).
- 마이그 0025 `upsert_report_sections_0_7_admin` + rollback 작성 (옵션 A R8 final 정합 + 명시 REVOKE — omxy R1 Kepler B2 fix).
- orchestrator 분기 (`callerKind === 'admin'` && flag=true 시 신규 RPC) + rpcName-가드 error 분리 (omxy R1 Schop B3 fix).
- `format-error.ts` 한국어 매핑 추가 (신규 3 keys + 1 prefix handler = 4 entries — omxy R1 Schop B4 fix).
- TDD invariants 8종 (spec §4.3 step 4 6 invariants 1:1 매핑 + Test 1 seam 분리 + Test 4 분리 — omxy R1 Schop B7+B8 + Kepler B1 fix).
- impl PR `feat/b65-p3-feature-flag-upsert` — feature branch + commit + push + PR create (SHARED). merge/migration apply = USER.

**Out-of-scope (별도 PR/Task)**:
- **B79** Section 8 partA/partC/partD + committee_votes RPC 통합 → PR5 plan.
- **B66 backfill** Python seed canonical 14 매핑 → Task 5 (병렬 가능).
- **Smoke Stage 1/2** → Task 6/7 (impl PR 머지 후 진입).
- **PR5 cron 30 자동 + 큐 인프라** → Task 8 audit 후.
- **W-tier1pill** Tier 1 평가 대기 pill UI → 별도 follow-up PR (D11 운용 검증 acceptance gate, 본 PR scope 외).
- **W-sectionfallback-text** SectionFallback 문구 stale 정정 → W-tier1pill PR과 함께 처리.
- **DQ-7 / S8 / 멤버 페이지**.

---

## 1. SoT linkage

| 자료 | 경로 | 본 plan에서의 역할 |
|---|---|---|
| spec doc R8 final | `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md` | 옵션 A lock-in + 마이그 SQL sketch §2.1 + axis i/ii/iii + 4.3 step 4 TDD invariants + 부록 B verified items |
| 마이그 0022 pattern | `tudal/supabase/migrations/0022_update_report_sections_0_7.sql` | 4-grant 패턴 (단, service_role grant **금지** — 옵션 A admin-only) + search_path + month cast + auth.uid+is_admin guard 패턴 reference |
| 마이그 0017 pattern | `tudal/supabase/migrations/0017_cost_log_and_batch_runs.sql` (commit_persona_eval block) | `ON CONFLICT (ticker, month) WHERE is_latest = true` UPSERT 패턴 reference |
| orchestrator | `tudal/src/lib/report/full-report-orchestrator.ts` line 240-262 | feature flag 분기 도입 위치 (`supabase.rpc('update_report_sections_0_7', ...)` 호출) |
| admin trigger action | `tudal/src/app/(admin)/admin/portfolio/actions.ts::triggerFullReport` line 620-636 | B65-P1 guard `if (!exists) return report_not_found` flag toggle (feature flag=false 시 fail-fast 유지 / =true 시 path 진입 허용 — INSERT branch 허용) |
| format-error | `tudal/src/lib/admin/format-error.ts` | 신규 error code 한국어 매핑 추가 |
| service-role helper | `tudal/src/lib/supabase/service-role.ts` | grant smoke test 작성 시 참조 |
| .env.example | `tudal/.env.example` | `AI_COST_LOG_REAL_INSERT_ENABLED` 이미 line 32 (사전 박제). 신규 `PR4_TRIGGER_UPSERT_ENABLED=false` 추가 (safe local default — omxy R1 Schop B5 + R2 Plato B3 fix; Production Vercel env=true는 USER §3.3.5 step) |
| HANDOFF | `Document/Process/HANDOFF.md` §2.1 Task 4 + §9.2 B65 3-phase | 진행 상태 + post-merge 박제 sequence |

---

## 2. Sequence overview (10 steps)

```
1. feature branch checkout       (SHARED — feat/b65-p3-feature-flag-upsert)
2. 마이그 0025 + rollback 작성   (CLAUDE)
3. orchestrator 분기 도입        (CLAUDE)
4. admin trigger action flag toggle (CLAUDE)
5. format-error 한국어 매핑 추가 (CLAUDE)
6. .env.example flag 박제        (CLAUDE)
7. TDD invariants 8종 작성       (CLAUDE)
8. 검증 게이트 + 마이그 dry-run  (CLAUDE)
9. omxy R1+R2 verify (max 8 rounds, native critic subagent 강제) (CLAUDE)
10. commit + push + PR create + body 박제 (SHARED). production apply (마이그 0025 적용 + Vercel env `PR4_TRIGGER_UPSERT_ENABLED=true` 설정) + Vercel deploy + canary = USER.
```

**Verification gate sequence**:
- 매 step 2~7 직후 단위 검증 (해당 step의 grep + lint 부분 OK).
- step 8 = `npm run build && npm run lint && npm run test:ci && npx tsc --noEmit` 4종 PASS.
- step 9 = omxy CONVERGED 후만 step 10 진입.

---

## 3. 마이그 0025 본문 + rollback

### 3.1 `tudal/supabase/migrations/0025_upsert_report_sections_0_7_admin.sql`

```sql
-- 0025_upsert_report_sections_0_7_admin.sql
-- B65-P2 옵션 A (R8 final lock-in) — admin-only UPSERT RPC.
-- spec: docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md
-- 본질 = admin trigger의 ad-hoc 특정 종목 본문 (section_0~7 + appendix) 생성/재생성.
-- cron path (commit_persona_eval + update_report_sections_0_7)와 분리 — 충돌 0.
--
-- versioning policy: overwrite-in-place (0017/0022 패턴 보존).
--   version/schema_version/is_latest/regen_auto_count/regen_manual_count = TDD invariant 불변.
-- section_8/consensus_badge preserve: UPDATE 시 미터치 (cron path 미경유 시 null 유지 / 경유 후 보존).
--
-- 4-grant 패턴 (0022 패턴 변형 — admin-only):
--   public/anon/service_role REVOKE + authenticated GRANT only.
--   **service_role GRANT 금지 + 명시 REVOKE 강제** (cron path가 본 RPC를 우회하도록 강제 — cron은 commit_persona_eval 사용).
--   ⚠️ CREATE OR REPLACE FUNCTION은 과거 잘못 부여된 권한을 보존할 수 있음 (omxy R1 Kepler B2 fix critical).
--   따라서 미부여(grant 누락)만으로는 약함 — 명시 `revoke all from service_role` 필수.
-- TDD W-grant-smoke (spec §4.3 step 4): has_function_privilege + PostgREST permission_denied 두 layer.
-- regprocedure signature: 11 args = 2 text + 9 jsonb (omxy R1 Kepler M1 fix).

create or replace function public.upsert_report_sections_0_7_admin(
  p_ticker text,
  p_month text,
  p_section_0 jsonb,
  p_section_1 jsonb,
  p_section_2 jsonb,
  p_section_3 jsonb,
  p_section_4 jsonb,
  p_section_5 jsonb,
  p_section_6 jsonb,
  p_section_7 jsonb,
  p_appendix jsonb
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid;
  v_report_id uuid;
begin
  -- input regex guard (0022 패턴 동일 — PostgreSQL POSIX regex portability)
  if p_ticker !~ '^[0-9]{6}$' then
    raise exception 'invalid_ticker';
  end if;
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'invalid_month';
  end if;

  -- admin-only auth (service_role bypass 분기 부재 — cron path는 별도 path 사용).
  v_caller := auth.uid();
  if v_caller is null then
    raise exception 'auth_unavailable';
  end if;
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  -- UPSERT: INSERT if missing (admin trigger button = missing-row 시나리오)
  --         UPDATE if exists  (regen page = preflight + counter 선행 → row 존재 시나리오)
  -- ON CONFLICT (ticker, month) WHERE is_latest = true:
  --   0003 line 38~40 partial unique index stock_reports_ticker_month_latest_uniq 정합.
  -- 보존 컬럼 (UPDATE 분기에서 미터치):
  --   - section_8 / consensus_badge (cron path preserve)
  --   - version / schema_version / is_latest (versioning overwrite-in-place 패턴, §4.5)
  --   - regen_auto_count / regen_manual_count (incrementManualRegenCount data-layer 책임)
  insert into public.stock_reports (
    ticker, month,
    section_0, section_1, section_2, section_3,
    section_4, section_5, section_6, section_7,
    appendix, generated_at
  ) values (
    p_ticker, to_date(p_month || '-01', 'YYYY-MM-DD'),
    p_section_0, p_section_1, p_section_2, p_section_3,
    p_section_4, p_section_5, p_section_6, p_section_7,
    p_appendix, now()
  )
  on conflict (ticker, month) where is_latest = true do update
    set section_0 = excluded.section_0,
        section_1 = excluded.section_1,
        section_2 = excluded.section_2,
        section_3 = excluded.section_3,
        section_4 = excluded.section_4,
        section_5 = excluded.section_5,
        section_6 = excluded.section_6,
        section_7 = excluded.section_7,
        appendix = excluded.appendix,
        generated_at = now()
  returning id into v_report_id;

  if v_report_id is null then
    -- ON CONFLICT branch에서 unique index 정합 실패 시 (사실상 0 — 안전망)
    raise exception 'upsert_report_sections_0_7_admin_failed_no_returning';
  end if;

  return json_build_object('success', true, 'report_id', v_report_id);
end;
$$;

-- 4-grant (옵션 A admin-only — service_role 의도적 미부여 + 명시 REVOKE)
-- ⚠️ CREATE OR REPLACE FUNCTION은 과거 잘못 부여된 권한을 보존할 수 있음 (omxy R1 Kepler BLOCKER-2 critical).
-- 따라서 미부여(grant 누락)만으로는 약함 — 명시 REVOKE 강제.
revoke all on function public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from anon;
revoke all on function public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from service_role;  -- omxy R1 Kepler B2 fix: 명시 REVOKE
grant execute on function public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
-- 의도적으로 service_role GRANT 미수행 + 명시 REVOKE. cron path는 commit_persona_eval + update_report_sections_0_7 사용.

comment on function public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) is
  'B65-P2 옵션 A (spec 2026-05-26 R8 final) — admin-only UPSERT RPC. section_0~7 + appendix only. section_8/consensus_badge/version/schema_version/regen_* 모두 preserve. service_role grant 의도적 미부여 (admin-only path 보장). cron path는 commit_persona_eval + update_report_sections_0_7 사용 — 충돌 0. PR4_TRIGGER_UPSERT_ENABLED=true feature flag 시 orchestrator가 호출.';
```

### 3.2 `tudal/supabase/migrations/0025_upsert_report_sections_0_7_admin.rollback.sql`

```sql
-- 0025 rollback — admin-only UPSERT RPC drop.
drop function if exists public.upsert_report_sections_0_7_admin(
  text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
);
```

### 3.3 Production apply sequence (USER, omxy R1 Schop W5 + W2 + Kepler B2 fix)

1. `mcp__supabase__apply_migration` with `0025_upsert_report_sections_0_7_admin.sql` content.
2. **Layer 1 service_role deny verify (Kepler B2 critical)**: `select has_function_privilege('service_role', 'public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)'::regprocedure, 'EXECUTE') as service_role_can_execute;` → 기대 `false`. `false` 아니면 → **rollback (3.2) 즉시 + REVOKE 명시 누락 audit + 재apply**.
3. authenticated grant verify: `select has_function_privilege('authenticated', '...'::regprocedure, 'EXECUTE');` → 기대 `true`.
4. **Vercel env interlock (Schop W5 fix)**: `PR4_TRIGGER_UPSERT_ENABLED=true` 설정 **전에** `AI_COST_LOG_REAL_INSERT_ENABLED=true` Vercel Production env 설정 verify (또는 명시적 cost_log gap acceptance). 그렇지 않으면 canary가 stock_reports row 생성 + cost_log 0건 → audit trail gap.
5. Vercel env `PR4_TRIGGER_UPSERT_ENABLED=true` (Production scope) 설정. **⚠️ Vercel env propagation 비제로 latency** (omxy R1 Schop B2 fix) — 기존 deployed function instance가 새 env를 즉시 읽지 못할 수 있음. **redeploy 강제 권장** (변경 즉시 보장 안 됨).
6. Vercel deploy (env 변경 propagation).
7. **canary 단계 분리 (omxy R1 Schop W2 fix — Smoke Stage 분리)**:
   - **dry-canary (옵션, USER 선택)**: `PR4_TRIGGER_UPSERT_ENABLED=false`로 toggle → admin trigger click → `report_not_found` fail-fast 확인 (rollback path 검증). 다시 `true`로 복원.
   - **functional canary (Smoke Stage 2, Task 7 USER 승인 후)**: admin trigger button click → 신규 row INSERT (또는 기존 row UPDATE) + cost_log 1+ row + stock_reports row + report_critic_findings 1+ row 검증. **이는 단일 실 AI smoke = ~5,000~6,000원 cost burn**. Task 6 Stage 1 dry-run TDD PASS 후만 진입.
   - **USER가 Task 7 진입 전 canary를 미리 실행할 경우 cost burn 발생** — 사전 acceptance 명시.

---

## 4. 코드 변경 (4 위치)

### 4.1 `tudal/src/lib/report/full-report-orchestrator.ts` (분기 도입)

**현재** (line 240-262):
```ts
const supabase = options.client ?? (await createClient());
const { data, error } = await supabase.rpc('update_report_sections_0_7', { ... });
if (error) { ... }
if (!data?.success) { throw new Error('update_report_sections_0_7_failed:no_success'); }
```

**callerKind type 정합 (omxy R1 Schop B6 fix)**: 기존 orchestrator (line 54-57) signature:
```ts
export interface OrchestrateFullReportOptions {
  client?: SupabaseClient;
  callerKind?: 'cron' | 'admin';
}
```
- `callerKind` optional (`undefined` 가능).
- cron 호출 패턴 = `{ callerKind: 'cron' }` literal (PR5 cron path가 사용).
- admin 호출 패턴 = `{ callerKind: 'admin' }` literal (PR4 triggerFullReport line 664 사용).
- `callerKind` 미전달 (`undefined`) → flag 무관 legacy RPC 진입 (안전 default).

**변경 후**:
```ts
const supabase = options.client ?? (await createClient());

// B65-P3 feature flag (옵션 A): admin caller + flag=true 시 신규 UPSERT RPC 사용.
// ⚠️ env read는 반드시 함수 body 내부에서 (top-level const 금지 — Next.js 16 inline 회피, omxy R1 Schop B2 fix).
// env 변경 후 Vercel function instance 재배포 필요할 수 있음 (즉시 효과 ≠ guaranteed, §9.2 step 1 wording 참조).
// Production Vercel env=true (B98 lock-in, USER §3.3.5 step), .env.example=false 안전 default (omxy R2 Plato B3 fix).
// undefined/empty/'false' 모두 false fallback.
// 그 외 (cron 또는 flag=false) → 기존 update_report_sections_0_7 (UPDATE-only).
// env default = 'true' (B98 lock-in). undefined/empty 시 false로 안전 fallback.
const upsertEnabled =
  options.callerKind === 'admin' &&
  process.env.PR4_TRIGGER_UPSERT_ENABLED === 'true';  // strict 'true' — undefined/empty/'false' 모두 false
const rpcName = upsertEnabled
  ? 'upsert_report_sections_0_7_admin'
  : 'update_report_sections_0_7';

const { data, error } = await supabase.rpc(rpcName, {
  p_ticker: enriched.ticker,
  p_month: enriched.month,
  p_section_0: finalSections.section_0,
  p_section_1: finalSections.section_1,
  p_section_2: finalSections.section_2,
  p_section_3: finalSections.section_3,
  p_section_4: finalSections.section_4,
  p_section_5: finalSections.section_5,
  p_section_6: finalSections.section_6,
  p_section_7: finalSections.section_7,
  p_appendix: finalSections.appendix,
});
if (error) {
  const msg = typeof error.message === 'string' ? error.message : '';
  // omxy R1 Schop B3 fix: rpcName으로 가드 — cross-path literal leak 차단.
  // UPDATE-only path 전용 error code (row not found) — legacy path만.
  if (rpcName === 'update_report_sections_0_7' && msg.includes('report_not_found_for_section_0_7_update')) {
    throw new Error('report_not_found_for_section_0_7_update');
  }
  // UPSERT path 전용 error code (returning null 안전망) — admin path만.
  if (rpcName === 'upsert_report_sections_0_7_admin' && msg.includes('upsert_report_sections_0_7_admin_failed_no_returning')) {
    throw new Error('upsert_report_sections_0_7_admin_failed_no_returning');
  }
  throw new Error(`${rpcName}_failed:${error.code ?? 'unknown'}`);
}
if (!data?.success) {
  throw new Error(`${rpcName}_failed:no_success`);
}
```

**불변 invariants**:
- payload 11개 jsonb 필드 순서 + 키 이름 동일.
- error 메시지에 `report_not_found_for_section_0_7_update` 또는 `upsert_report_sections_0_7_admin_failed_no_returning` literal substring 보존 (caller가 catch + 한국어 매핑).
- subsequent `insertCriticFindingsRun` + `insertOrBumpBacklog` 호출 unchanged (data.report_id 사용).

### 4.2 `tudal/src/app/(admin)/admin/portfolio/actions.ts::triggerFullReport` (B65-P1 guard toggle)

**현재** (line 627-636):
```ts
const monthDate = `${input.month}-01`;
let exists: boolean;
try {
  exists = await reportExistsForMonth(input.ticker, monthDate);
} catch {
  return { success: false, error: "report_lookup_failed" };
}
if (!exists) {
  return { success: false, error: "report_not_found" };
}
```

**변경 후**:
```ts
// B65-P3 P1/P2 호환 (옵션 A spec §4.3 step 4 invariant — feature flag toggle).
// flag=true (B98 default): UPSERT RPC가 INSERT branch 가능 → preflight 통과 허용.
// flag=false: B65-P1 guard 유지 (UPDATE-only path 한정, cost burn 차단 유지).
const upsertEnabled = process.env.PR4_TRIGGER_UPSERT_ENABLED === 'true';
if (!upsertEnabled) {
  const monthDate = `${input.month}-01`;
  let exists: boolean;
  try {
    exists = await reportExistsForMonth(input.ticker, monthDate);
  } catch {
    return { success: false, error: "report_lookup_failed" };
  }
  if (!exists) {
    return { success: false, error: "report_not_found" };
  }
}
// flag=true 시 preflight skip → orchestrator의 신규 UPSERT RPC가 INSERT branch 진입.
```

**불변 invariants**:
- flag=false (P3 미적용) 시 기존 B65-P1 guard 동일 동작 (production rollback 가능성 보장).
- flag=true 시 preflight skip + orchestrator UPSERT RPC가 row 신규 INSERT 또는 기존 row UPDATE.
- regen page (`/admin/report/[ticker]/regenerate/actions.ts`)의 `reportExistsForMonth` line 75 preflight는 **그대로 유지** (spec §부록 B-5 정합 — regen은 row 존재 가정 + counter 증가 후 진입 → UPSERT의 UPDATE branch).

### 4.3 `tudal/src/lib/admin/format-error.ts` (한국어 매핑 추가)

**기존 keys** (확인됨):
- `report_not_found`: "리포트를 찾을 수 없습니다"
- `admin_required`: "어드민 권한이 필요합니다"
- `auth_unavailable`: "로그인이 필요합니다"
- `invalid_ticker` / `invalid_month`
- `update_report_sections_0_7_failed`: "풀 리포트 본문 저장 실패"
- `report_not_found_for_section_0_7_update`: "리포트 row 부재 — Section 0~7 UPDATE 실패..."
- `orchestrate_failed:*` prefix handler

**신규 추가 keys** (4종):
- `upsert_report_sections_0_7_admin_failed`: "리포트 본문 저장 실패 (admin UPSERT)"
- `upsert_report_sections_0_7_admin_failed_no_returning`: "리포트 본문 저장 실패 — UPSERT returning 부재 (안전망 발동)"
- `upsert_report_sections_0_7_admin_failed:`(prefix handler) — `update_report_sections_0_7_failed:` line 173-177 패턴 복제 (PostgREST error code suffix).

**diff**:
```ts
// KOREAN_MAPPINGS 추가
upsert_report_sections_0_7_admin_failed: "리포트 본문 저장 실패 (admin UPSERT)",
upsert_report_sections_0_7_admin_failed_no_returning: "리포트 본문 저장 실패 — UPSERT returning 부재 (안전망 발동)",
```

```ts
// prefix handler 추가 (기존 update_report_sections_0_7_failed handler 옆)
if (code.startsWith("upsert_report_sections_0_7_admin_failed:")) {
  return (
    KOREAN_MAPPINGS["upsert_report_sections_0_7_admin_failed"] +
    " (" +
    code.slice("upsert_report_sections_0_7_admin_failed:".length) +
    ")"
  );
}
```

### 4.4 `tudal/.env.example` (flag 박제, omxy R1 Schop B5 critical fix)

**현재 line 32**: `AI_COST_LOG_REAL_INSERT_ENABLED=false` (안전 local + preview default 패턴).

**추가** (line 33 또는 인접) — **`.env.example` default = `false`** (omxy R1 Schop B5 fix):
```
PR4_TRIGGER_UPSERT_ENABLED=false   # B65-P3 옵션 A admin-only UPSERT (마이그 0025) 활성화. .env.example default = false (안전 local/preview default — 로컬 supabase에 마이그 0025 미적용 시 admin trigger crash 회피, AI_COST_LOG_REAL_INSERT_ENABLED 패턴 정합). Production Vercel env에서만 USER가 true 설정 (§3.3 step 4 박제).
```

**근거 (B5 critical)**: `.env.example`은 developer가 로컬 dev 환경 setup 시 복제하는 template. 로컬 supabase는 보통 마이그 0025 미적용 상태 → default `true` 시 admin trigger button 첫 클릭 = RPC undefined error crash. `false`가 안전 default. **Production env (Vercel)** 에서만 USER가 `true` 설정 (§3.3.4 박제). 이는 `AI_COST_LOG_REAL_INSERT_ENABLED=false` (line 32) 패턴과 동일 convention (production 활성화는 별도 USER step).

---

## 5. TDD invariants (8종 + spec invariant 1:1 매핑 + recall)

spec doc §4.3 step 4 6 invariants + omxy R1 Schop B7+B8 + Kepler B1 fix. 두 파일 권장 (seam 분리, omxy R1 Schop B8 fix):
- `tudal/src/app/(admin)/admin/portfolio/__tests__/triggerFullReport-flag.test.ts` (Test 1 — action seam, B65-P1 preflight skip 검증)
- `tudal/src/lib/report/__tests__/orchestrate-upsert-flag.test.ts` (Test 2~8 — orchestrator seam, RPC dispatch + payload invariant)

**spec §4.3 step 4 6 invariants ↔ Test 매핑 (omxy R1 Kepler B1 fix)**:

| Spec invariant | 본 plan Test | 비고 |
|---|---|---|
| (i) admin auth + RLS bypass (auth.uid null → auth_unavailable / is_admin=false → admin_required) | Test 7 — 3 branch matrix (service_role deny `42501` + auth.uid null `P0001` + is_admin=false `P0001`) | DB invariant pin — Layer 1 (has_function_privilege) + Layer 2 (PostgREST permission_denied) + 2 추가 branch (in-function RAISE EXCEPTION P0001). omxy R2 Plato B1 fix. |
| (ii) upsert create + same-month UPDATE generated_at bump | Test 2 + Test 4b (DB integration smoke) | Test 2 = 단위 mock RPC name + payload invariant. Test 4b = mcp__supabase__execute_sql dry-run INSERT+UPDATE+SELECT (preserve verify). |
| (iii) section_8/consensus_badge preserve | Test 4a + Test 4b (DB integration smoke) | omxy R1 Schop B7 fix — payload key set 만으로 부족. DB-side SELECT 검증 강제. |
| (iv) same-month 재호출 UPDATE + generated_at bump | Test 2 + Test 4b | (ii)와 결합. |
| (v) P1 호환 feature-flag toggle invariant (flag=false 시 B65-P1 guard / =true 시 신규 RPC) | Test 1 (action seam) + Test 5 (orchestrator seam) | omxy R1 Schop B8 fix — 두 seam 분리. |
| (vi) version/schema_version 불변 + regen counter 불변 (overwrite-in-place) | Test 3 + Test 4b | DB-side SELECT before/after 동일성 검증. |

### Test 1 — `triggerFullReport` action seam (spec invariant v 일부, omxy R1 Schop B8 fix)

파일: `tudal/src/app/(admin)/admin/portfolio/__tests__/triggerFullReport-flag.test.ts` (신규 또는 기존 trigger-full-report.test.ts에 append).

```ts
beforeEach(() => { vi.resetModules(); }); // env cleanup (omxy R1 Kepler W2 fix)
afterEach(() => { delete process.env.PR4_TRIGGER_UPSERT_ENABLED; });

it('flag=false (또는 undefined): B65-P1 guard 진입 — reportExistsForMonth called', async () => { /* mock reportExistsForMonth → false, assert called + return = report_not_found */ });
it('flag=true: B65-P1 guard skip — reportExistsForMonth NOT called + orchestrate 진입', async () => { /* mock orchestrateFullReport, assert reportExistsForMonth spy 0 calls + orchestrate spy 1 call */ });
```

### Test 2 — orchestrator seam: same-month 재호출 UPDATE invariant (spec invariant ii+iv)

파일: `tudal/src/lib/report/__tests__/orchestrate-upsert-flag.test.ts`.

- flag=true + 동일 (ticker, month) 2회 호출 → 두 호출 모두 RPC name `'upsert_report_sections_0_7_admin'` (단위 mock).
- (DB integration은 Test 4b에서 검증).

### Test 3 — version/schema_version/regen_* 불변 invariant (spec invariant vi + spec §4.5)

- mock RPC payload field에 `p_version`, `p_schema_version`, `p_regen_auto`, `p_regen_manual`, `p_is_latest` 포함 X.
- payload key set = `{'p_ticker', 'p_month', 'p_section_0'..'p_section_7', 'p_appendix'}` exact 11 keys (`expect.objectContaining` 대신 `Object.keys(payload).sort()` exact equality assert).
- forbidden grep (orchestrator + 신규 test 파일 한정 scope, omxy R1 Kepler B3 fix): `p_version|p_schema_version|p_regen_auto|p_regen_manual|p_is_latest` 0 매치.

### Test 4 — section_8/consensus_badge preserve (spec invariant iii, omxy R1 Schop B7 critical fix — DB smoke)

**Test 4a (단위 mock)**: orchestrator payload에 `p_section_8` 또는 `p_consensus_badge` field 미존재. payload key set 11 keys exact.

**Test 4b (DB integration smoke, mcp__supabase__execute_sql executable, §6.2 박제, omxy R2 Plato W7 fix — executable SQL)**:

⚠️ **precondition**: 마이그 0025 + 0017 + 0003 production 적용 + admin user UUID 확보 (실제 ADMIN_EMAILS 등록된 user). **production 직접 X — staging branch 또는 production verify 단일 row 박제 후 cleanup**.

```sql
-- 1. Pre-condition cleanup (test row 중복 방지)
delete from stock_reports where ticker = '999999' and month = '2026-12-01';

-- 2. INSERT row with section_8 + consensus_badge (commit_persona_eval를 시뮬레이션 — direct INSERT)
--    실제 production에서는 commit_persona_eval을 사용; 본 smoke는 row preservation 검증 용도.
insert into stock_reports (
  ticker, month, name, sector,
  section_0, section_1, section_2, section_3, section_4, section_5, section_6, section_7,
  section_8, consensus_badge, appendix,
  version, schema_version, is_latest, regen_auto_count, regen_manual_count, generated_at
) values (
  '999999', '2026-12-01', '테스트종목', 'IT/SW',
  '{"v":"pre"}'::jsonb, '{"v":"pre"}'::jsonb, '{"v":"pre"}'::jsonb, '{"v":"pre"}'::jsonb,
  '{"v":"pre"}'::jsonb, '{"v":"pre"}'::jsonb, '{"v":"pre"}'::jsonb, '{"v":"pre"}'::jsonb,
  '{"partA":[],"partC":{},"partD":[]}'::jsonb, '🟢', '{"v":"pre"}'::jsonb,
  1, 1, true, 0, 0, now() - interval '1 hour'
);

-- 3. authenticated admin 컨텍스트로 upsert_report_sections_0_7_admin 호출
--    (Vercel Vitest test에서 supabase-js authenticated client로 동등 호출)
set local role authenticated;
set local request.jwt.claims = '{"sub":"<ADMIN_USER_UUID>","email":"<admin@example.com>"}'::jsonb;

select public.upsert_report_sections_0_7_admin(
  '999999', '2026-12',
  '{"v":"post"}'::jsonb, '{"v":"post"}'::jsonb, '{"v":"post"}'::jsonb, '{"v":"post"}'::jsonb,
  '{"v":"post"}'::jsonb, '{"v":"post"}'::jsonb, '{"v":"post"}'::jsonb, '{"v":"post"}'::jsonb,
  '{"v":"post"}'::jsonb
);

-- 4. SELECT — section_8 + consensus_badge + version/schema_version/regen_* 모두 변경 0 검증
select
  section_0, section_8, consensus_badge,
  version, schema_version, is_latest, regen_auto_count, regen_manual_count
from stock_reports
where ticker = '999999' and month = '2026-12-01';

-- 기대 결과:
--   section_0 = '{"v":"post"}'                       (UPDATE branch 적용 ✓)
--   section_8 = '{"partA":[],"partC":{},"partD":[]}' (preserve ✓ — invariant iii)
--   consensus_badge = '🟢'                            (preserve ✓ — invariant iii)
--   version = 1                                       (preserve ✓ — invariant vi)
--   schema_version = 1                                (preserve ✓ — invariant vi)
--   is_latest = true                                  (preserve ✓)
--   regen_auto_count = 0, regen_manual_count = 0      (preserve ✓ — invariant vi)

-- 5. Cleanup
delete from stock_reports where ticker = '999999' and month = '2026-12-01';
reset role; reset request.jwt.claims;
```

- **CI 환경 fallback**: Vitest in supabase local test environment에서 동등 verification. 또는 USER manual smoke 박제.
- impl PR body acceptance criteria에 명시 (production verify USER + cleanup row).
- `<ADMIN_USER_UUID>` + `<admin@example.com>` = production admin profile에서 실제 값 USER 치환.

### Test 5 — admin caller 분기 invariant (spec invariant v 일부, orchestrator seam)

- `callerKind='admin'` + flag=true → RPC name `'upsert_report_sections_0_7_admin'`.
- `callerKind='admin'` + flag=false → RPC name `'update_report_sections_0_7'`.
- `callerKind='cron'` + flag=true → RPC name `'update_report_sections_0_7'` (cron path는 신규 RPC 미사용).
- `callerKind` undefined → flag 무관 `'update_report_sections_0_7'` (안전 default).

### Test 6 — error message literal substring preserve (caller 한국어 매핑 정합)

- mock RPC error `{ message: 'upsert_report_sections_0_7_admin_failed_no_returning' }` + rpcName upsert → `throw 'upsert_report_sections_0_7_admin_failed_no_returning'`.
- mock RPC error `{ message: 'report_not_found_for_section_0_7_update' }` + rpcName update → `throw 'report_not_found_for_section_0_7_update'`.
- **Cross-path leak 차단 (omxy R1 Schop B3 fix)**: rpcName upsert + error message contains `report_not_found_for_section_0_7_update` → 일반 `${rpcName}_failed:${error.code}` throw (legacy literal leak X).

### Test 7 — admin auth + service_role deny (spec invariant i, omxy R1 Kepler B1 + R2 Plato B1 + W4 SQLSTATE matrix fix)

**3 branch matrix 검증** (omxy R2 Plato B1 fix — auth.uid null + is_admin=false + service_role deny 모두 명시):

**Branch 1: service_role deny** (Layer 1 grant absent — SQLSTATE 42501 permission_denied):

Layer 1 (DB grant, §3.3 step 2~3 박제):
```sql
select has_function_privilege('service_role', 'public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)'::regprocedure, 'EXECUTE');
-- 기대: false
select has_function_privilege('authenticated', 'public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)'::regprocedure, 'EXECUTE');
-- 기대: true
```

Layer 2 (PostgREST permission_denied — Vitest with service-role client):
```ts
const sr = createServiceRoleClient();
const { error } = await sr.rpc('upsert_report_sections_0_7_admin', {
  p_ticker: '123456', p_month: '2026-06',
  p_section_0: {}, p_section_1: {}, p_section_2: {}, p_section_3: {},
  p_section_4: {}, p_section_5: {}, p_section_6: {}, p_section_7: {},
  p_appendix: {},
});
expect(error?.code).toBe('42501');  // insufficient_privilege (grant absent → REST 401/403)
expect(error?.message).toMatch(/permission denied for function/);
```

**Branch 2: authenticated session 없음 (auth.uid null → in-function raise)** (omxy R2 W4 SQLSTATE matrix — P0001 in-function exception):

```ts
// authenticated 컨텍스트 + no claims (auth.uid() returns null) — Supabase REST or psql direct
// in-function: if v_caller is null then raise exception 'auth_unavailable'; end if;
const { error } = await unauthedAuthClient.rpc('upsert_report_sections_0_7_admin', { ...validPayload });
expect(error?.code).toBe('P0001');  // PostgreSQL RAISE EXCEPTION default SQLSTATE
expect(error?.message).toMatch(/auth_unavailable/);
```

**Branch 3: authenticated non-admin (is_admin()=false → in-function raise)**:

```ts
// authenticated 컨텍스트 + non-admin user (ADMIN_EMAILS 외)
const { error } = await nonAdminClient.rpc('upsert_report_sections_0_7_admin', { ...validPayload });
expect(error?.code).toBe('P0001');
expect(error?.message).toMatch(/admin_required/);
```

**SQLSTATE matrix (omxy R2 W4 fix)**:
| Branch | SQLSTATE | error.message | 발생 layer |
|---|---|---|---|
| service_role deny | `42501` | `permission denied for function ...` | DB grant (REVOKE service_role) |
| auth.uid null | `P0001` | `auth_unavailable` | in-function RAISE EXCEPTION default |
| is_admin=false | `P0001` | `admin_required` | in-function RAISE EXCEPTION default |
| invalid_ticker / invalid_month | `P0001` | `invalid_ticker` / `invalid_month` | in-function RAISE EXCEPTION |

format-error.ts prefix handler는 `error.code`가 아닌 `error.message` substring으로 분기 (line 173-177 패턴 정합). 따라서 P0001 vs 42501 분리는 매핑에 영향 0 — single Korean message만 노출.

### Test 8 — env flag tests cleanup (omxy R1 Kepler W2 fix)

- 모든 신규 test에 `beforeEach { vi.resetModules(); }` + `afterEach { delete process.env.PR4_TRIGGER_UPSERT_ENABLED; }` 강제.
- 기존 B65-P1 guard tests (`reportExistsForMonth` 호출 검증) 오염 0 — 추가 regression assert.

### Recall: 기존 test 영향 확인 (regression)

- `npm run test:ci` 후 **현재 baseline + 8 신규 tests** PASS (omxy R1 Schop W7 fix — 절대 count 박제 금지).
- 기존 `update_report_sections_0_7` path test (orchestrator + commit-flow) 모두 PASS (flag=false default + cron path 분리 보장).

---

## 6. 검증 게이트 + 마이그 dry-run

### 6.1 4-gate verify (step 8)
```bash
cd tudal
npm run build       # 25 routes (현재 baseline)
npm run lint        # 0 err 6 warn (pre-existing)
npm run test:ci     # 현재 baseline + 신규 8 tests (Test 1~8) PASS — 절대 count 박제 금지 (omxy R1 Schop W7 + R2 Plato W5 fix)
npx tsc --noEmit    # clean
```

### 6.2 마이그 dry-run (local supabase optional)
- 본 마이그는 production apply가 USER 책임. 단위 검증은 SQL syntax 정합만 `psql -c "EXPLAIN ..."` 또는 mcp__supabase__execute_sql dry-run (DDL은 transaction safe 보장 X — local supabase에서 검증 권장).

### 6.3 grep 패턴 (재발 방지, spec §7.6 catalog 정합 + omxy R1 Kepler B3 + Schop W3 fix)

**중요 (omxy R1 Kepler B3 fix)**: grep scope을 명시 (false-positive 회피). `p_section_8` / `p_consensus_badge`는 기존 writer.ts + commit_persona_eval 경로에 합법적으로 존재 — 전체 repo grep 시 false-positive 발생.

| 결함 | grep 패턴 + scope (0 매치 확인) |
|---|---|
| service_role grant (옵션 A 위반) — `CREATE OR REPLACE` 보존 위험 | scope `tudal/supabase/migrations/0025_*.sql`: `grant execute on function public\.upsert_report_sections_0_7_admin.*to service_role` 0 매치 |
| service_role 명시 REVOKE 누락 (omxy R1 Kepler B2 fix) | scope `0025_*.sql`: `revoke all on function public\.upsert_report_sections_0_7_admin.*from service_role` ≥ 1 매치 |
| search_path 누락 (W-Schop-3) | scope `0025_*.sql`: `set search_path = public, pg_temp` ≥ 1 매치 |
| month cast 누락 (W-Schop-3) | scope `0025_*.sql`: `to_date\(p_month \|\| '-01'` ≥ 1 매치 |
| RPC signature mismatch (마이그 vs Layer 1 smoke) | `regprocedure` 인용 라인 `(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)` 정확 (11 args = 2 text + 9 jsonb — omxy R1 Kepler M1 fix) |
| payload field drift (section_8 누설) — **scope 제한 critical (omxy R1 Kepler B3 + R2 Plato B2 fix)** | scope = **implementation 파일 only**: `tudal/src/lib/report/full-report-orchestrator.ts` 단 1개. **test 파일은 forbidden grep scope에서 제외** (omxy R2 Plato B2 fix — test 본문은 `p_section_8`/`p_consensus_badge`/`p_version` literal을 "payload key set에서 제외됨" assertion/comment으로 합법적으로 포함). orchestrator.ts에서 `p_section_8\|p_consensus_badge\|p_version\|p_schema_version\|p_regen_auto\|p_regen_manual\|p_is_latest` 0 매치. test 파일은 "payload keys runtime assert" 패턴 (`Object.keys(payload).sort()` exact equality) 사용 — literal 박제는 assertion expected value로만. |
| feature flag default 위반 (B5 정정) | `.env.example`에 `PR4_TRIGGER_UPSERT_ENABLED=false` 정확히 존재 (safe local default) |
| 한국어 매핑 누락 | `format-error.ts`에서 `upsert_report_sections_0_7_admin_failed` 본문 + prefix handler 모두 존재 |
| regen path 변경 (out-of-scope) | `regenerate/actions.ts`에서 `reportExistsForMonth` 호출 line unchanged (diff 0 — `git diff main -- tudal/src/app/\(admin\)/admin/report/\[ticker\]/regenerate/`) |
| orchestrator env read top-level (B2 fix) | scope `tudal/src/lib/report/full-report-orchestrator.ts`: top-level `^const.*process\.env\.PR4_TRIGGER_UPSERT_ENABLED` 0 매치 (함수 body 내부만 허용) |
| ON CONFLICT predicate verbatim (B1 fix) | scope `tudal/supabase/migrations/0003_*.sql`: `where is_latest = true` (lower-case) literal verify — 0025의 `where is_latest = true` ON CONFLICT 절과 동일 형식 보장 |

---

## 7. omxy R1+R2 verify (max 8 rounds, native critic subagent 강제)

### 7.1 entry condition (R1 송신 전)
- step 1~8 완료 (feature branch + commit + 검증 게이트 4-gate PASS).
- commit pushed remote (cmux peer가 접근 가능하도록).

### 7.2 cmux send pattern
- HANDOFF §7.3 옵션 A heredoc 사용. parry-guard 우회.
- peer surface = runtime discover (`cmux list-pane-surfaces`).
- eligibility probe = `cmux identify`.

### 7.3 R1 message (scope guard 4종 + 검증 요청 + native critic 강제)

```
=== NEW DEBATE — Task 4 B65-P3 impl 적대적 검토 (cmux pair-debate v1) ===

PROTOCOL: SIGNAL: CONTINUE/CONVERGED/ESCALATE. <500 words. Adversarial. SCOPE GUARD.

TASK: B65-P3 impl PR (feat/b65-p3-feature-flag-upsert) 실 commit 코드 적대적 검수.
CONVERGED 조건 = (a) spec doc R8 final 옵션 A lock-in과 1:1 일치 (b) self-review 우회 결함 0 (c) 기존 schema/모듈 호환성 (d) hardcoded constants 정확 (e) native critic subagent (Schopenhauer 또는 동급) 1명 catch 0.

CONTEXT:
- Branch: feat/b65-p3-feature-flag-upsert at HEAD <hash>
- Spec (lock-in SoT): docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md (R8 final, 옵션 A)
- Plan: docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md
- Commits to review: <hash> "<message>"
- 변경 파일: 0025_*.sql (+rollback) / orchestrator.ts / actions.ts / format-error.ts / .env.example / orchestrate-upsert-flag.test.ts

검증 요청:
(a) 옵션 A spec §4.3 step 4 invariant 6종 (admin 분기 + same-month UPDATE + version/schema_version/regen 불변 + section_8 preserve + service_role deny + P1 호환 toggle) 1:1 정합?
(b) 마이그 0025 PostgreSQL edge case (regprocedure signature exact / search_path / SECURITY DEFINER + auth.uid + is_admin guard / 4-grant service_role 의도적 미부여 verified)?
(c) 기존 modules (update_report_sections_0_7 path / commit_persona_eval / incrementManualRegenCount data-layer / regen page preflight) 충돌 0?
(d) Type 일관성 (callerKind enum + rpcName literal union + payload key set 11개 exact)?
(e) grep 패턴 (옵션 A grant smoke / payload drift / .env.example default / 한국어 매핑 prefix handler) 0 매치 violation?

SCOPE GUARD (재해석 금지):
- 옵션 A R8 final lock-in (사용자 + omxy R1~R8 catch 30+ CONVERGED — spec doc §1, §2.1, §4, §5).
- 본 PR scope 외 (별도 PR/Task):
  · B79 Section 8 RPC 통합 → PR5 plan
  · B66 backfill → Task 5
  · Smoke Stage 1/2 → Task 6/7
  · W-tier1pill UI / W-sectionfallback-text → 별도 PR
  · PR5 cron 30 자동 → Task 8 audit 후
- DQ-7 / S8 / 멤버 페이지.

NATIVE CRITIC SUBAGENT 요구:
- omxy 측이 1명 이상 native critic agent (Schopenhauer / Diogenes / Wittgenstein 등) parallel 활용해 별도 catch 회수.
- catch 발견 즉시 BLOCKER 분류 (BLOCKER / WATCH / MINOR).

ROUND 1 — FROM: orchestrator
입장 = 결함 0 기대 (spec R8 final + plan 7-step sequence). 검증 후 SIGNAL: CONVERGED 또는 CONTINUE with diff.

SIGNAL: CONTINUE
```

### 7.4 R2~Rn cycle (BLOCKERS 발견 시)
- amend 금지 (사용자 명시 + HANDOFF §8 박제). 새 fix commit `fix(<scope> omxy R<N> BLOCKER[S]): <one-line>`.
- R<N+1> 송신: 변경된 commit hash + 적용 diff 요약.
- CONVERGED 또는 ESCALATE (max 8 rounds 도달) 시 종료.
- ESCALATE = options reversal 아님 (HANDOFF §7.7 R-debate max-8 lesson — 옵션 A 채택 lock-in 유지 + mechanical fix 후 final accepted).

### 7.5 expected catch categories (재발 방지 학습 기반)
- **PR2 lesson recall**: persona ID production 정합 / schema length+unique 약함 / count cross-refinement / scope purity grep / Promise.allSettled.
- **PR4 lesson recall**: caller DI seam 5중 invariant (createClient short-circuit / helper-chain 2nd arg / payload field invariant / 한국어 매핑 / shouldRevise revise branch).
- **57차 §1 lesson recall**: omxy 4 rounds verify cycle (R1 plan + R2 commit verify + R3 HANDOFF cleanup + R4 pre-merge sanity).
- **57차 §2 lesson recall**: R-debate max-8 mechanical fix patterns / native critic subagent strategy / 신규 audit ticket 박제 (W-suffix follow-up).

### 7.6 post-CONVERGED HANDOFF stale sweep (R7 omxy R7 lesson)
- post-CONVERGED commit 시 단일 PR 안에서 HANDOFF 전역 grep + 치환:
  - `Task 4` 어휘 stale 0
  - `B65-P3` 어휘 stale 0
  - `다음 1순위` 어휘 stale 0 (Task 5/Task 6 진입자 박제로 갱신)
  - audit catalog (§9.5) B-versioning / W-tier1pill / W-grant-smoke / W-sectionfallback-text / W-cost-log-env-gate 박제 유지 + 본 PR로 처리된 항목 (W-grant-smoke) 처리 박제.
- HANDOFF §0 / §1 / §2.1 / §3 / §6 (직전 entry) / §9.2 (B65 P3 ✅) / §9.7 모두 stale 0 검증.

---

## 8. PR scope + commit message + branch + acceptance criteria

### 8.1 Branch
`feat/b65-p3-feature-flag-upsert` (off `main` HEAD post-PR-#26 docs-only descendant).

### 8.2 Commits (squash 권장 — single feature commit 또는 step별 분리)

**옵션 A (single commit)**:
```
feat(b65-p3): admin-only UPSERT RPC + feature flag (옵션 A spec R8 final)

- 마이그 0025 upsert_report_sections_0_7_admin (admin-only, service_role grant 금지)
- orchestrator 분기 (callerKind=admin && PR4_TRIGGER_UPSERT_ENABLED=true 시 신규 RPC)
- triggerFullReport B65-P1 guard flag toggle (flag=true 시 preflight skip)
- format-error 한국어 매핑 2 keys + 1 prefix handler
- .env.example PR4_TRIGGER_UPSERT_ENABLED=false 박제 (safe local default; Production Vercel env=true는 USER §3.3.5 step, omxy R1 Schop B5 + R2 Plato B3 fix)
- TDD invariants 8종 (admin 분기 action+orchestrator seam + same-month UPDATE + version/regen 불변 + section_8 preserve DB smoke + service_role deny 3-branch matrix P0001+42501 + env cleanup)

spec doc: docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md (R8 final)
plan: docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md
B65-P3 ✅ (P1 MERGED 5b99e03 + P2 spec lock-in + P3 impl).
```

**옵션 B (step별 분리)** — 작업 회복성 우선:
- commit 1: `feat(b65-p3): 마이그 0025 upsert_report_sections_0_7_admin + rollback`
- commit 2: `feat(b65-p3): orchestrator feature flag 분기 + payload key invariant`
- commit 3: `feat(b65-p3): triggerFullReport B65-P1 guard flag toggle`
- commit 4: `feat(b65-p3): format-error 한국어 매핑 + .env.example flag default`
- commit 5: `test(b65-p3): TDD invariants 8종 (Test 1 action seam + Test 2~6 orchestrator seam + Test 7 auth 3-branch matrix + Test 8 env cleanup)`

**판정**: 옵션 B 권장 (각 commit 단위로 omxy R1 catch 시 fix isolate 용이).

### 8.3 PR body skeleton

```markdown
# B65-P3 P1/P2 호환 feature flag + 마이그 0025 (옵션 A R8 final lock-in)

Closes: HANDOFF §2.1 Task 4

## Summary
- 마이그 0025 신규 RPC `upsert_report_sections_0_7_admin` (admin-only UPSERT, section_0~7 + appendix).
- service_role grant 의도적 미부여 (cron path는 별도 path 사용 — 충돌 0).
- feature flag `PR4_TRIGGER_UPSERT_ENABLED` (.env.example=false safe default; Production Vercel env=true USER 설정 후 admin path 활성, B98 lock-in). false 시 B65-P1 guard 유지 (rollback 가능성 보장).
- TDD invariants 8종 (spec §4.3 step 4 6 invariants 1:1 매핑 + Test 1 action seam + Test 8 env cleanup + recall lessons).

## SoT
- spec: docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md (R8 final 옵션 A)
- plan: docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md

## Test plan
- [ ] `npm run build` 25 routes
- [ ] `npm run lint` 0 err
- [ ] `npm run test:ci` 현재 baseline + 신규 8 tests (Test 1~8) PASS
- [ ] `npx tsc --noEmit` clean
- [ ] 마이그 0025 syntax verify (mcp__supabase__execute_sql dry-run)
- [ ] omxy R1+R2 CONVERGED (max 8 rounds)

## Acceptance criteria
1. spec doc R8 final 옵션 A invariants 6종이 Test 1~8을 통해 1:1 매핑 + 모두 PASS (§5 매핑 표)
2. service_role grant `false` verified (production apply 후 has_function_privilege check — Layer 1 smoke)
3. authenticated grant `true` verified
4. flag=false 시 기존 path (update_report_sections_0_7) 동일 동작 (regression 0)
5. flag=true + admin caller 시 신규 RPC 호출 + INSERT/UPDATE branch 자연 분기

## Out-of-scope (별도 PR/Task)
- B79 / B66 / Smoke Stage 1/2 / W-tier1pill / W-sectionfallback-text / PR5 cron 30 자동

## Production apply sequence (USER, omxy R1 Schop W5 + R2 Plato W6 fix — interlock 명시)
1. 마이그 0025 apply (mcp__supabase__apply_migration)
2. **Layer 1 service_role deny verify (Kepler B2 critical)**: `has_function_privilege('service_role', ...)` = `false` 확인. `false` 아니면 rollback + REVOKE 누락 audit + 재apply.
3. authenticated grant verify: `has_function_privilege('authenticated', ...)` = `true`.
4. **Vercel env interlock (W5 critical)**: `PR4_TRIGGER_UPSERT_ENABLED=true` 설정 **전에** `AI_COST_LOG_REAL_INSERT_ENABLED=true` Production env verify (또는 명시적 cost_log gap acceptance — canary 1회 실 AI 호출 시 stock_reports row 생성됨에도 cost_log 0건 = audit trail gap).
5. Vercel env `PR4_TRIGGER_UPSERT_ENABLED=true` (Production scope) 설정. **⚠️ env propagation 비제로 latency — redeploy 강제 권장**.
6. Vercel deploy (env 변경 propagation).
7. **dry-canary (옵션)**: flag false toggle → admin trigger click → fail-fast 확인 → flag true 복원 (rollback path 검증). functional canary는 Smoke Stage 2 (Task 7 USER 승인) 후만 — cost burn ~5,000~6,000원.
8. HANDOFF §2.1 Task 4 ✅ 박제 + §9.2 B65-P3 ✅ + Task 5 backfill 진입.
```

### 8.4 Acceptance gates (CONVERGED 후)
- omxy CONVERGED (R1~Rn).
- 검증 게이트 4-gate PASS.
- HANDOFF stale sweep 6 keyword grep 0.

---

## 9. Risks + rollback

### 9.1 Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | 옵션 A 채택 후 admin trigger button click 시 Section 8 absent 리포트 생성 → 어드민 3인 혼동 ("왜 Section 8 비어 있나") | **W-tier1pill follow-up PR**에서 "Tier 1 평가 대기" pill UI 추가 (D11 운용 검증 acceptance gate). 본 PR은 production behavior 변경 (preflight skip) but UI crash 0 (PR3a dual-shape renderer + SectionFallback). |
| R-2 | feature flag toggle false 시 기존 path regression | TDD Test 1 (flag=false 시 B65-P1 guard 동일 동작) + 기존 1130 tests PASS 강제. |
| R-3 | 마이그 0025 apply 후 service_role grant 누설 | TDD W-grant-smoke (has_function_privilege + PostgREST Layer 2 smoke). production apply 직후 USER가 manual verify. |
| R-4 | payload field drift (p_section_8 또는 p_version 누설) | grep 패턴 (§6.3) + TDD Test 3+4 (payload key set 11개 exact assert). |
| R-5 | Smoke Stage 2 (Task 7) 진입 전 `AI_COST_LOG_REAL_INSERT_ENABLED='true'` 미설정 → cost_log noop | W-cost-log-env-gate (HANDOFF §9.5) 박제. Task 7 sequence에서 env verify step 강제. |
| R-6 | 신규 audit ticket W-grant-smoke가 production apply 후 누락 | PR body acceptance criteria에 has_function_privilege smoke 명시 + USER 책임으로 production apply step에 박제. |

### 9.2 Rollback

**Branch level**: `git revert` impl PR commit chain.

**Production level (마이그 + env)** — omxy R1 Schop B2 fix:
1. Vercel env `PR4_TRIGGER_UPSERT_ENABLED=false` 설정. **⚠️ env propagation은 기존 deployed function instance에 즉시 보장 안 됨** (Schop B2). **redeploy 강제 권장** — orchestrator + actions.ts가 새 env value를 읽도록 함수 인스턴스 재배포 트리거.
2. Vercel deploy 재실행 (env propagation 완료).
3. (옵션) 마이그 0025 rollback 적용 (`0025_upsert_report_sections_0_7_admin.rollback.sql`). **⚠️ rollback 후 행위 (Schop M5)**: 본 RPC로 생성된 stock_reports rows는 rollback 후에도 잔존 (table은 unchanged, RPC만 drop). 필요 시 USER가 manual cleanup (UI에서 admin trigger UPSERT로 생성된 row 식별 어려움 — `generated_at` 시점으로만 추적).

**Worst case** (rollback 후에도 production stuck):
- 마이그 0022 `update_report_sections_0_7`는 unchanged → 기존 admin trigger button 동작 = `report_not_found` fail-fast (P1 guard 활성, cost burn 0). 이는 PR #21 머지 직후 production 상태와 동일 (stable baseline).

---

## 부록 A — 참조 문서

- spec doc: `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md` (R8 final 옵션 A lock-in, 부록 B verified items)
- 마이그 0022: `tudal/supabase/migrations/0022_update_report_sections_0_7.sql` (4-grant 패턴 reference, service_role grant 포함 — 본 0025는 의도적으로 제외 + 명시 REVOKE)
- 마이그 0017: `tudal/supabase/migrations/0017_cost_log_and_batch_runs.sql` (commit_persona_eval UPSERT 패턴 reference + `ON CONFLICT WHERE is_latest = true`)
- 마이그 0003: `tudal/supabase/migrations/0003_s2_reports.sql` — stock_reports schema (section_8 nullable + consensus_badge nullable + version/schema_version/is_latest/regen_* defaults verified §부록 B, partial unique index `stock_reports_ticker_month_latest_uniq` line 38-40 with `where is_latest = true` predicate)
- orchestrator: `tudal/src/lib/report/full-report-orchestrator.ts` line 240-262 (분기 도입 위치) + line 54-57 (`OrchestrateFullReportOptions` interface — callerKind enum)
- admin trigger action: `tudal/src/app/(admin)/admin/portfolio/actions.ts` line 620-636 (B65-P1 guard toggle 위치) + line 664 (callerKind='admin' literal)
- regen page: `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/actions.ts` line 75 (`reportExistsForMonth` preflight unchanged scope guard)
- format-error: `tudal/src/lib/admin/format-error.ts` line 173-177 (prefix handler 패턴 reference) + KOREAN_MAPPINGS line 13/16/17/29/38/103/104/115
- service-role helper: `tudal/src/lib/supabase/service-role.ts` (Layer 2 smoke 작성 시)
- regen counter data-layer (omxy R1 Kepler M2 정확 경로): `tudal/src/lib/data/admin-regen-counters.ts` (incrementManualRegenCount, regen_counter table CAS — Supabase RPC 아님)
- HANDOFF §2.1 Task 4 + §9.2 B65 3-phase + §9.5 audit catalog (B-versioning + W-tier1pill + W-grant-smoke + W-sectionfallback-text + W-cost-log-env-gate)

## 부록 B — feature flag default 정합 (B98 lock-in 근거)

| 위치 | default value | 근거 |
|---|---|---|
| `.env.example` | **`false`** (omxy R1 Schop B5 fix) | 안전 local/preview default. 로컬 supabase에 마이그 0025 미적용 시 admin trigger crash 회피. `AI_COST_LOG_REAL_INSERT_ENABLED=false` 패턴 정합. |
| `process.env.PR4_TRIGGER_UPSERT_ENABLED === 'true'` 비교식 | `undefined`/`empty`/`'false'` 모두 → `false` (안전 fallback) | env 미설정 시 기존 path (B65-P1 guard active) 진입 — production rollback 가능성 보장. |
| Vercel Production env | `true` 설정 USER 책임 | production apply sequence step 4 박제 (§3.3). |
| Vercel Preview / Development env | `false` 권장 (또는 미설정) | preview deploy에서 production-only RPC 호출 회피 (마이그 0025가 preview branch에 미적용 가능성). |

## 부록 C — 본 plan과 spec doc 차이 (paired 보완)

| 항목 | spec doc R8 final 위치 | plan 위치 |
|---|---|---|
| 옵션 A/B/C 비교 + 결정 | §2 + §4.1 매트릭스 | (참조만, plan은 옵션 A 단독 가정) |
| 마이그 SQL sketch | §2.1 (간략) | §3.1 (full impl + comment 박제) |
| 4-grant 패턴 | §2.1 + §4.3 step 1 | §3.1 (full SQL + 의도적 service_role 미부여 comment) |
| TDD invariants | §4.3 step 4 (6종 spec) | §5 (1:1 매핑 표 + Test 1~8 + grep 패턴 + recall) — spec 6 invariants ↔ plan 8 tests 매핑 (Test 1 action seam + Test 7 3-branch matrix + Test 8 env cleanup으로 확장) |
| omxy R1+R2 패턴 | §5 (CONVERGED 조건) | §7 (cmux send template + R1 message + scope guard 4종 + native critic 강제) |
| 박제 sequence | §6 (post-CONVERGED) | §7.6 (HANDOFF stale sweep 6 keyword) + §8.3 PR body |
| 부록 verified | §부록 B | (참조 — plan 부록 B는 feature flag default 정합 별도) |

본 plan = spec doc의 결정을 **impl PR로 실행하는 실행 plan**. spec doc은 R8 ESCALATE max-8-rounds 도달 후 **사용자 commit lock-in** (omxy R1 Schop M3 fix — "frozen" 어휘 정정) + plan은 impl 진행 중 omxy R1+R2 catch에 따라 update 가능.

---

## 부록 D — omxy R1 catch 박제 (R1 round result, R2 송신 전)

**omxy R1 결과 (CONVERGED 불가, SIGNAL: CONTINUE)**:
- **omxy 본체 (Codex gpt-5.5 xhigh)**: 3 BLOCKERS + 2 WATCH + 2 MINOR
- **omxy native critic Kepler**: CATCH 7 (omxy 본체와 직접 일치 또는 보완)
- **Claude native critic Schopenhauer (parallel)**: 8 BLOCKERS + 7 WATCH + 5 MINOR

**병합 catch summary (R1 → R2 fix 반영)**:

| 출처 | ID | 분류 | 결함 | Fix |
|---|---|---|---|---|
| Schop | B1 | BLOCKER | ON CONFLICT partial unique index predicate verbatim 검증 누락 | §6.3 grep "where is_latest = true" verify 추가 |
| Schop | B2 | BLOCKER | env propagation 즉시 효과 미보장 | §4.1 + §9.2 wording 정정 + redeploy 권장 |
| Schop | B3 | BLOCKER | error literal cross-path leak | §4.1 rpcName guard 추가 |
| Schop | B4 | BLOCKER | "신규 4종" 카운트 mismatch | §0 + §4.3 "3 keys + 1 prefix handler = 4 entries" 명시 |
| Schop | B5 | BLOCKER (critical) | `.env.example` default `true` → 로컬 dev crash | §4.4 + 부록 B default `false`로 정정 |
| Schop | B6 | BLOCKER | callerKind type narrow 미명시 | §4.1에 type snippet + cron 호출 패턴 박제 |
| Schop | B7 | BLOCKER | section_8 preserve test payload key only | §5 Test 4를 4a (payload) + 4b (DB integration smoke)로 분리 |
| Schop | B8 | BLOCKER | Test 1 seam 분리 부재 | §5 Test 1 = action seam, Test 5 = orchestrator seam |
| omxy/Kepler | B1 | BLOCKER | Spec §4.3 6 invariants ↔ Test 1~6 매핑 부재 | §5 spec invariant 매핑 표 추가 + Test 7 (admin auth + service_role deny) 신설 + Test 8 (env cleanup) 신설 |
| omxy/Kepler | B2 | BLOCKER (critical) | `service_role` 명시 REVOKE 부재 — CREATE OR REPLACE 보존 위험 | §3.1 SQL에 `revoke all on function ... from service_role;` 추가 |
| omxy/Kepler | B3 | BLOCKER | grep false-positive (p_section_8 합법 존재) | §6.3 grep scope을 orchestrator + 신규 test 파일로 제한 |
| Schop | W3 | WATCH | grep search_path / to_date / to service_role 패턴 missing | §6.3 grep table 확장 (5종 추가) |
| Schop | W5 | WATCH | AI_COST_LOG_REAL_INSERT_ENABLED interlock 부재 | §3.3 step 4 interlock verify 추가 |
| Schop | W2 | WATCH | canary cost burn risk | §3.3 step 7 = dry-canary + functional canary 분리 |
| Schop | M5 | MINOR | rollback 후 row 잔존 | §9.2 step 3 acceptance 명시 |
| omxy/Kepler | W1 | WATCH | regen race (preflight 후 row 삭제 시 INSERT 가능) | §부록 D-1 accepted race 박제 (UPSERT의 자연 분기 — race 발생 시 INSERT branch 진입은 spec §부록 B-5 정합) |
| omxy/Kepler | W2 | WATCH | env flag test cleanup 누락 | §5 Test 8 = beforeEach/afterEach 강제 |
| omxy/Kepler | M1 | MINOR | "11개 jsonb" → "11 args (2 text + 9 jsonb)" | §6.3 + §부록 B 정정 |
| omxy/Kepler | M2 | MINOR | admin-regen-counters.ts 경로 정확 박제 | §부록 A 정확 경로 명시 |
| Schop | W4 | WATCH | SQLSTATE P0001 vs 42501 parity | R2 송신 시점에 omxy verify 추가 요청 |
| Schop | W6 | WATCH | B98 source 인용 부재 | R2 송신 시점에 HANDOFF §9 entry 인용 명시 — 본 plan에서는 일반 lock-in 어휘만 사용 (B98 = informal ID) |
| Schop | W7 | WATCH | 1130 hardcoded count stale risk | §5 Recall 항목 baseline+N 형식으로 정정 |
| Schop | W1 + M1~M4 | WATCH/MINOR | unreachable defensive / wording 정밀화 | acceptable (defensive 안전망 유지) |

### D-1 Regen race (accepted, omxy R1 Kepler W1 박제)

regen page (`/admin/report/[ticker]/regenerate/actions.ts`) flow:
1. `reportExistsForMonth` preflight (line 75) — row 존재 verify.
2. `incrementManualRegenCount` (line 130) data-layer counter 증가.
3. `orchestrateFullReport` (callerKind='admin').

flag=true 시점에 race 가능성: step 1 verify → step 3 orchestrate 사이에 row 삭제되면 → orchestrator 신규 RPC가 INSERT branch 진입. **이는 옵션 A의 의도된 자연 분기** (spec §부록 B-5):
- UPSERT의 ON CONFLICT는 race를 자연 처리 (INSERT 실패 시 UPDATE, vice versa).
- regen page의 counter는 이미 증가했으므로 사용자 의도 "regenerate" 충족.
- audit log = `generated_at` bump + new report_id.

**alternative (regen update-only 고정)**: regen path에서만 별도 update RPC 호출 — orchestrator API surface 확대 + scope creep. **현재 reject**. UPSERT 자연 분기로 충분.

### D-2 R2 송신 message body (omxy 적대적 R2 cycle)

R2 = R1 catch 모두 fix 반영 후 송신. body keypoint:
- fix commit hash 명시.
- catch별 fix table inline (위 표).
- 잔여 risk (W4 SQLSTATE / W6 B98 source) 명시.
- SIGNAL: CONVERGED 또는 CONTINUE with new catch.
