# B65-P3 P1/P2 호환 feature flag + 마이그 0025 impl plan

> **세션**: 57차 §3 (Task 4) — DRAFT R0
> **상태**: PLAN DRAFT — omxy R1 verify 대기
> **paired spec (lock-in SoT)**: [docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md](../specs/2026-05-26-b65-p2-rpc-rdebate.md) (R8 final, 옵션 A)
> **선행 commit**: PR #21 `5b99e03` (B65-P1 immediate guard MERGED in main)
> **블록**: PR5 entry (Task 5 backfill + Task 6 Stage 1 + Task 7 Stage 2 USER 승인 모두 PASS 후 진입)

---

## 0. Scope guard (재해석 금지)

**본 plan scope**:
- B65-P3 feature flag `PR4_TRIGGER_UPSERT_ENABLED` env 도입 (default = `true`, B98 lock-in).
- 마이그 0025 `upsert_report_sections_0_7_admin` + rollback 작성 (옵션 A R8 final 정합).
- orchestrator 분기 (`callerKind === 'admin'` && flag=true 시 신규 RPC).
- `format-error.ts` 한국어 매핑 추가 (신규 error codes 4종).
- TDD invariants 6종 (spec §4.3 step 4 + W-tier1pill prep guard).
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
| .env.example | `tudal/.env.example` | `AI_COST_LOG_REAL_INSERT_ENABLED` 이미 line 32 (사전 박제). 신규 `PR4_TRIGGER_UPSERT_ENABLED=true` 추가 |
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
7. TDD invariants 6종 작성       (CLAUDE)
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
--   public/anon REVOKE + authenticated GRANT only. **service_role GRANT 금지**
--   (cron path가 본 RPC를 우회하도록 강제 — cron은 commit_persona_eval 사용).
-- TDD W-grant-smoke (spec §4.3 step 4): has_function_privilege + PostgREST permission_denied 두 layer.

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

-- 4-grant (옵션 A admin-only — service_role 미부여)
revoke all on function public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from anon;
grant execute on function public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
-- 의도적으로 service_role GRANT 미수행. cron path는 commit_persona_eval + update_report_sections_0_7 사용.

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

### 3.3 Production apply sequence (USER)

1. `mcp__supabase__apply_migration` with `0025_upsert_report_sections_0_7_admin.sql` content.
2. 검증 query: `select has_function_privilege('service_role', 'public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)'::regprocedure, 'EXECUTE') as service_role_can_execute;` → 기대 `false`.
3. 검증 query: `select has_function_privilege('authenticated', 'public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)'::regprocedure, 'EXECUTE') as authenticated_can_execute;` → 기대 `true`.
4. Vercel env: `PR4_TRIGGER_UPSERT_ENABLED=true` (Production scope) 설정.
5. Vercel deploy + canary (admin trigger button 1회 클릭 → `report_not_found` 사라지고 row 신규 INSERT 동작 확인 — 단, 실 cost burn = Smoke Stage 2 진입 의미. AI key 없이 dry-run 검증을 원하면 flag=false로 두고 Stage 1 (Task 6) 후 enable).

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

**변경 후**:
```ts
const supabase = options.client ?? (await createClient());

// B65-P3 feature flag (옵션 A): admin caller + flag=true 시 신규 UPSERT RPC 사용.
// 그 외 (cron 또는 flag=false) → 기존 update_report_sections_0_7 (UPDATE-only).
// env default = 'true' (B98 lock-in). undefined/empty 시 false로 안전 fallback.
const upsertEnabled =
  options.callerKind === 'admin' &&
  process.env.PR4_TRIGGER_UPSERT_ENABLED === 'true';
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
  // UPDATE-only path 전용 error code (row not found) 보존.
  if (typeof error.message === 'string' && error.message.includes('report_not_found_for_section_0_7_update')) {
    throw new Error('report_not_found_for_section_0_7_update');
  }
  // UPSERT path 전용 error code (returning null — 안전망).
  if (typeof error.message === 'string' && error.message.includes('upsert_report_sections_0_7_admin_failed_no_returning')) {
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

### 4.4 `tudal/.env.example` (flag 박제)

**현재 line 32**: `AI_COST_LOG_REAL_INSERT_ENABLED=false`

**추가** (line 33 또는 인접):
```
PR4_TRIGGER_UPSERT_ENABLED=true   # B65-P3 옵션 A admin-only UPSERT (마이그 0025) 활성화. false 시 B65-P1 guard 유지 (UPDATE-only path). production default = true.
```

---

## 5. TDD invariants (6종 + recall)

spec doc §4.3 step 4 + 본 plan 추가 invariant. 새 파일 `tudal/src/lib/report/__tests__/orchestrate-upsert-flag.test.ts` 권장 (또는 기존 orchestrator test 파일에 append).

### Test 1 — feature flag toggle invariant (P1 호환 P3 §4.3 step 4 #5)
- `PR4_TRIGGER_UPSERT_ENABLED='false'` (또는 undefined): triggerFullReport → 기존 B65-P1 guard 진입 (`reportExistsForMonth` called) → row 부재 시 `report_not_found` return.
- `PR4_TRIGGER_UPSERT_ENABLED='true'`: triggerFullReport → preflight skip → orchestrator UPSERT RPC 호출 (mock with vi.spyOn). RPC name = `'upsert_report_sections_0_7_admin'`.

### Test 2 — same-month 재호출 UPDATE invariant (§4.3 step 4 #4)
- flag=true + 동일 (ticker, month) 2회 호출 → 2번째 호출 시 RPC가 ON CONFLICT update branch 진입.
- mock supabase.rpc가 같은 report_id 반환 (UPDATE 결과) 가정 + `generated_at` bump (mock에서 timestamp 2회 다르게 반환 검증은 integration 영역 — 단위 test에서는 RPC name + payload invariant만).

### Test 3 — version/schema_version/regen_* 불변 invariant (§4.3 step 4 #6 + spec §4.5 versioning)
- mock RPC가 payload field에 `version`, `schema_version`, `regen_auto_count`, `regen_manual_count` 포함 X (제외 검증).
- 즉 orchestrator가 payload에 보내는 키는 `p_ticker`, `p_month`, `p_section_0` ~ `p_section_7`, `p_appendix` 11개 정확. (forbidden grep: `p_version|p_schema_version|p_regen_auto|p_regen_manual` 0 매치)

### Test 4 — section_8/consensus_badge preserve invariant (§4.3 step 4 #3)
- mock RPC가 `p_section_8` 또는 `p_consensus_badge` payload field 미수신 (제외 검증, payload key set 명시 assert).
- payload key set = `{'p_ticker', 'p_month', 'p_section_0'..'p_section_7', 'p_appendix'}` exact 11 keys.

### Test 5 — admin caller 분기 invariant (§4.3 step 4 #1)
- `callerKind='admin'` + flag=true → RPC name `'upsert_report_sections_0_7_admin'`.
- `callerKind='admin'` + flag=false → RPC name `'update_report_sections_0_7'`.
- `callerKind='cron'` + flag=true → RPC name `'update_report_sections_0_7'` (cron path는 신규 RPC 미사용).
- `callerKind` undefined → flag 무관 `'update_report_sections_0_7'` (안전 default).

### Test 6 — error message literal substring preserve invariant (caller 한국어 매핑 정합)
- mock RPC가 `{ error: { message: 'upsert_report_sections_0_7_admin_failed_no_returning' } }` 반환 → orchestrator가 `throw new Error('upsert_report_sections_0_7_admin_failed_no_returning')` 정확히 발생.
- format-error 한국어 매핑이 해당 literal 처리 (test 추가 in `format-error.test.ts`).

### Recall: 기존 test 영향 확인 (regression)
- `npm run test:ci` 후 1130 passes 유지 (또는 추가 test 수만큼 증가).
- 기존 `update_report_sections_0_7` path test (orchestrator + commit-flow) 모두 PASS (flag=false default 보장).

---

## 6. 검증 게이트 + 마이그 dry-run

### 6.1 4-gate verify (step 8)
```bash
cd tudal
npm run build       # 25 routes (현재 baseline)
npm run lint        # 0 err 6 warn (pre-existing)
npm run test:ci     # 1130 + 신규 6 tests (Test 1~6) PASS
npx tsc --noEmit    # clean
```

### 6.2 마이그 dry-run (local supabase optional)
- 본 마이그는 production apply가 USER 책임. 단위 검증은 SQL syntax 정합만 `psql -c "EXPLAIN ..."` 또는 mcp__supabase__execute_sql dry-run (DDL은 transaction safe 보장 X — local supabase에서 검증 권장).

### 6.3 grep 패턴 (재발 방지, spec §7.6 catalog 정합)
| 결함 | grep 패턴 (0 매치 확인) |
|---|---|
| service_role grant (옵션 A 위반) | `grant.*upsert_report_sections_0_7_admin.*service_role` (마이그 파일에서 0 매치) |
| RPC signature mismatch (마이그 vs Layer 1 smoke) | `regprocedure` 라인의 `(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)` 정확 (11개 jsonb 8개) |
| payload field drift (section_8 누설) | orchestrator + tests에서 `p_section_8\|p_consensus_badge\|p_version\|p_schema_version\|p_regen_auto\|p_regen_manual` 0 매치 |
| feature flag default 위반 | `.env.example`에 `PR4_TRIGGER_UPSERT_ENABLED=true` 정확히 존재 (production env default 정합) |
| 한국어 매핑 누락 | `format-error.ts`에서 `upsert_report_sections_0_7_admin_failed` 본문 + prefix handler 모두 존재 |
| regen path 변경 (out-of-scope) | `regenerate/actions.ts`에서 `reportExistsForMonth` line 75 unchanged (diff 0) |

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
- .env.example PR4_TRIGGER_UPSERT_ENABLED=true 박제 (production default)
- TDD invariants 6종 (admin 분기 + same-month UPDATE + version/regen 불변 + section_8 preserve + service_role deny + P1 호환 toggle)

spec doc: docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md (R8 final)
plan: docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md
B65-P3 ✅ (P1 MERGED 5b99e03 + P2 spec lock-in + P3 impl).
```

**옵션 B (step별 분리)** — 작업 회복성 우선:
- commit 1: `feat(b65-p3): 마이그 0025 upsert_report_sections_0_7_admin + rollback`
- commit 2: `feat(b65-p3): orchestrator feature flag 분기 + payload key invariant`
- commit 3: `feat(b65-p3): triggerFullReport B65-P1 guard flag toggle`
- commit 4: `feat(b65-p3): format-error 한국어 매핑 + .env.example flag default`
- commit 5: `test(b65-p3): TDD invariants 6종 (admin 분기 + same-month + section_8 preserve + service_role deny + P1 호환)`

**판정**: 옵션 B 권장 (각 commit 단위로 omxy R1 catch 시 fix isolate 용이).

### 8.3 PR body skeleton

```markdown
# B65-P3 P1/P2 호환 feature flag + 마이그 0025 (옵션 A R8 final lock-in)

Closes: HANDOFF §2.1 Task 4

## Summary
- 마이그 0025 신규 RPC `upsert_report_sections_0_7_admin` (admin-only UPSERT, section_0~7 + appendix).
- service_role grant 의도적 미부여 (cron path는 별도 path 사용 — 충돌 0).
- feature flag `PR4_TRIGGER_UPSERT_ENABLED=true` default (B98 lock-in). false 시 B65-P1 guard 유지 (rollback 가능성 보장).
- TDD invariants 6종 (spec §4.3 step 4 + recall lessons).

## SoT
- spec: docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md (R8 final 옵션 A)
- plan: docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md

## Test plan
- [ ] `npm run build` 25 routes
- [ ] `npm run lint` 0 err
- [ ] `npm run test:ci` 1130 + 신규 6 tests PASS
- [ ] `npx tsc --noEmit` clean
- [ ] 마이그 0025 syntax verify (mcp__supabase__execute_sql dry-run)
- [ ] omxy R1+R2 CONVERGED (max 8 rounds)

## Acceptance criteria
1. spec doc R8 final 옵션 A invariants 6종 모두 PASS
2. service_role grant `false` verified (production apply 후 has_function_privilege check — Layer 1 smoke)
3. authenticated grant `true` verified
4. flag=false 시 기존 path (update_report_sections_0_7) 동일 동작 (regression 0)
5. flag=true + admin caller 시 신규 RPC 호출 + INSERT/UPDATE branch 자연 분기

## Out-of-scope (별도 PR/Task)
- B79 / B66 / Smoke Stage 1/2 / W-tier1pill / W-sectionfallback-text / PR5 cron 30 자동

## Production apply sequence (USER)
1. 마이그 0025 apply (mcp__supabase__apply_migration)
2. has_function_privilege smoke (service_role=false, authenticated=true)
3. Vercel env `PR4_TRIGGER_UPSERT_ENABLED=true` (Production)
4. Vercel deploy + canary
5. HANDOFF §2.1 Task 4 ✅ 박제 + §9.2 B65-P3 ✅ + Task 5 backfill 진입
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

**Production level (마이그 + env)**:
1. Vercel env `PR4_TRIGGER_UPSERT_ENABLED=false` 설정 (즉시 효과 — orchestrator + actions.ts 모두 기존 path 진입).
2. 마이그 0025 rollback 적용 (`0025_upsert_report_sections_0_7_admin.rollback.sql`).
3. Vercel deploy 재실행 (env 변경 propagation).

**Worst case** (rollback 후에도 production stuck):
- 마이그 0022 `update_report_sections_0_7`는 unchanged → 기존 admin trigger button 동작 = `report_not_found` fail-fast (P1 guard 활성, cost burn 0). 이는 PR #21 머지 직후 production 상태와 동일 (stable baseline).

---

## 부록 A — 참조 문서

- spec doc: `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md` (R8 final 옵션 A lock-in, 부록 B verified items)
- 마이그 0022: `tudal/supabase/migrations/0022_update_report_sections_0_7.sql` (4-grant 패턴 reference, service_role grant 포함 — 본 0025는 의도적으로 제외)
- 마이그 0017: `tudal/supabase/migrations/0017_cost_log_and_batch_runs.sql` (commit_persona_eval UPSERT 패턴 reference + `ON CONFLICT WHERE is_latest = true`)
- 마이그 0003: stock_reports schema (section_8 nullable + consensus_badge nullable + version/schema_version/is_latest/regen_* defaults verified §부록 B)
- orchestrator: `tudal/src/lib/report/full-report-orchestrator.ts` line 240-262 (분기 도입 위치)
- admin trigger action: `tudal/src/app/(admin)/admin/portfolio/actions.ts` line 620-636 (B65-P1 guard toggle 위치)
- format-error: `tudal/src/lib/admin/format-error.ts` line 173-177 (prefix handler 패턴 reference)
- service-role helper: `tudal/src/lib/supabase/service-role.ts` (Layer 2 smoke 작성 시)
- HANDOFF §2.1 Task 4 + §9.2 B65 3-phase + §9.5 audit catalog (B-versioning + W-tier1pill + W-grant-smoke + W-sectionfallback-text + W-cost-log-env-gate)

## 부록 B — feature flag default 정합 (B98 lock-in 근거)

| 위치 | default value | 근거 |
|---|---|---|
| `.env.example` | `true` | production-ready 박제. dev/local에서 `false`로 override 가능. |
| `process.env.PR4_TRIGGER_UPSERT_ENABLED === 'true'` 비교식 | `undefined`/`empty`/`'false'` 모두 → `false` (안전 fallback) | env 미설정 시 기존 path (B65-P1 guard active) 진입 — production rollback 가능성 보장. |
| Vercel Production env | `true` 설정 USER 책임 | production apply sequence step 4 박제 (§3.3). |
| Vercel Preview / Development env | `false` 권장 (또는 미설정) | preview deploy에서 production-only RPC 호출 회피 (마이그 0025가 preview branch에 미적용 가능성). |

## 부록 C — 본 plan과 spec doc 차이 (paired 보완)

| 항목 | spec doc R8 final 위치 | plan 위치 |
|---|---|---|
| 옵션 A/B/C 비교 + 결정 | §2 + §4.1 매트릭스 | (참조만, plan은 옵션 A 단독 가정) |
| 마이그 SQL sketch | §2.1 (간략) | §3.1 (full impl + comment 박제) |
| 4-grant 패턴 | §2.1 + §4.3 step 1 | §3.1 (full SQL + 의도적 service_role 미부여 comment) |
| TDD invariants | §4.3 step 4 (6종 spec) | §5 (Test 1~6 + grep 패턴 + recall) |
| omxy R1+R2 패턴 | §5 (CONVERGED 조건) | §7 (cmux send template + R1 message + scope guard 4종 + native critic 강제) |
| 박제 sequence | §6 (post-CONVERGED) | §7.6 (HANDOFF stale sweep 6 keyword) + §8.3 PR body |
| 부록 verified | §부록 B | (참조 — plan 부록 B는 feature flag default 정합 별도) |

본 plan = spec doc의 결정을 **impl PR로 실행하는 실행 plan**. spec doc은 R8 final lock-in으로 frozen + plan은 impl 진행 중 omxy R1+R2 catch에 따라 update 가능.
