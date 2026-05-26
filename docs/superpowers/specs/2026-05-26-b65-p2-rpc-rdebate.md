# B65-P2 RPC R-debate — admin trigger row 생성 path 결정

> **세션**: 57차 §2 (Task 3 R-debate)
> **상태**: R8 FINAL (omxy R1~R7 catch 누적 + R8 omxy ESCALATE max-8-rounds 도달 + mechanical-only stale fix 3 적용 + native critic 3 fix 반영. 사용자 commit 결정 대기)
> **선행**: HANDOFF §2.1 Task 3 + §9.2 (B65 3-phase 분리)
> **선행 commit**: PR #21 `5b99e03` (B65-P1 immediate guard MERGED in main)
> **블록**: Task 4 (B65-P3 P1/P2 호환 feature flag) + PR5 entry
> **어휘 정정**: "admin trigger 풀 리포트" → **"admin trigger row upsert + 본문 (section_0~7 + appendix) 생성"** (omxy R1 a 정정)

---

## 0. Scope guard (재해석 금지)

**본 spec scope**:
- B65-P2 RPC 옵션 (A / B / C) 결정 + axis (i/ii/iii) 결정.
- Spec doc 박제만. 실 RPC 마이그 및 코드 변경은 별도 PR (`feat/b65-p2-upsert-rpc`) — 본 결정 CONVERGED 후 Task 4 plan 단계에서 시작.

**Out-of-scope (별도 PR/Task)**:
- B79 Section 8 partA/partC/partD + committee_votes RPC 통합 → PR5 plan에서 결정.
- B65-P3 feature flag `PR4_TRIGGER_UPSERT_ENABLED` 구현 → Task 4 PR.
- B66 short_list_30 sector backfill → Task 5.
- Smoke Stage 1/2 → Task 6/7.
- PR5 cron 30 자동 + 큐 인프라 → Task 8 이후.
- DQ-7 / S8 / 멤버 페이지.

---

## 1. 배경 (현 production 결함)

### 1.1 코드 path 현황 (2026-05-26)

**admin trigger (PR4 MERGED `7de9696` + B65-P1 PR #21 MERGED `5b99e03`)**:

`tudal/src/app/(admin)/admin/portfolio/actions.ts::triggerFullReport`:
1. auth → 입력 validation (ticker `^\d{6}$`, month `^\d{4}-\d{2}$`, name/sector non-empty)
2. **B65-P1 preflight**: `reportExistsForMonth(ticker, ${month}-01)` → false → `report_not_found` (fail-fast, cost burn 0)
3. exists=true 시 → `orchestrateFullReport(input, { client: supabase, callerKind: 'admin' })` 호출
4. orchestrator → writer Opus → critic Haiku → (optional) revise → **`update_report_sections_0_7` RPC**

**`update_report_sections_0_7` (마이그 0022, MERGED)**:
- **UPDATE-only** RPC. row 부재 시 `report_not_found_for_section_0_7_update` (errcode P0002) raise.
- service_role bypass OR authenticated admin auth + `is_admin()` guard.
- `month = to_date(p_month || '-01', 'YYYY-MM-DD')` cast.

**`commit_persona_eval` (마이그 0017, MERGED)**:
- **INSERT/UPSERT** `stock_reports` row (`ON CONFLICT (ticker, month) WHERE is_latest = true`).
- 동시에 11 `committee_votes` INSERT (BUY→approve / HOLD→abstain / SELL→reject 매핑).
- 요구: real `consensus_badge ∈ {'🟢','🔵','🟣','🟡'}` + 11 votes each with `persona_id` + `persona_layer='core'` + non-empty `argument_excerpt`.
- **admin-only auth** (no service_role bypass): `auth.uid()` null guard + `is_admin()` check.

### 1.2 production functional gap (B65)

Supabase 직접 query 결과 (57차 §1 + §2 entry routine, 2026-05-26):
- `cost_log` = **0 rows** (성공 적재 AI 호출 0건)
- `stock_reports` = **0 rows**
- `committee_votes` = **0 rows**
- `report_critic_findings` = **0 rows**
- `short_list_30` = 30 rows (sector="코스닥" 22 + "코스피" 8 placeholder, B66)

**원인**:
- cron `monthly-batch/route.ts`의 `tier0Source/callPersonaPanel` = throw stub (B67) → cron path가 `commit_persona_eval`을 실행하지 않음 → row 생성 0건.
- admin trigger path는 `update_report_sections_0_7` UPDATE-only이므로 row 부재 시 영구 fail.
- B65-P1 머지 후: admin trigger button 클릭 → `report_not_found` fail-fast (cost burn 0 ✓, 단 정상 동작 0).

### 1.3 admin trigger 본질 (UX intent)

PR4 `triggerFullReport` 호출 시 admin이 제공하는 입력:
```ts
{ ticker, name, sector, month }
```

orchestrator에 stub 주입 (`actions.ts:651-660`):
```ts
tier1Verdict: 'HOLD',
consensusBadge: '🟡',
financialsSummary: '근거 부족',
technicalsSummary: '근거 부족',
macroSummary: '근거 부족',
sectorReference: '근거 부족',
```

→ **admin trigger의 본질 = ad-hoc 특정 종목 본문 생성**. Tier 1 평가 데이터 없음, persona panel 11 votes 없음. UI는 PR3a dual-shape renderer (Section 8 absent fallback) 이미 보유.

cron path (PR5)는 본질이 다름: Tier 1 평가 후 30 종목 전체 풀 리포트 (Section 8 + 11 votes 포함).

---

## 2. 옵션 분석 (A / B / C)

### 2.1 옵션 A — admin-only `upsert_report_sections_0_7_admin` RPC

**개요**: 신규 RPC 마이그 (0025) `public.upsert_report_sections_0_7_admin(p_ticker, p_month, p_section_0..7, p_appendix)` — UPSERT (INSERT if missing, UPDATE if exists). admin-only auth.

**구현 스케치**:
```sql
create or replace function public.upsert_report_sections_0_7_admin(
  p_ticker text, p_month text,
  p_section_0..7 jsonb, p_appendix jsonb
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid; v_report_id uuid;
begin
  -- input regex guard (0022 패턴)
  if p_ticker !~ '^[0-9]{6}$' then raise exception 'invalid_ticker'; end if;
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then raise exception 'invalid_month'; end if;

  -- admin-only auth (no service_role — cron path는 commit_persona_eval 사용)
  v_caller := auth.uid();
  if v_caller is null then raise exception 'auth_unavailable'; end if;
  if not public.is_admin() then raise exception 'admin_required'; end if;

  -- UPSERT (ON CONFLICT) — section_8/votes는 미터치 (admin path = section_0~7 ONLY)
  insert into public.stock_reports (
    ticker, month, section_0, section_1, section_2, section_3,
    section_4, section_5, section_6, section_7, appendix, generated_at
  ) values (
    p_ticker, to_date(p_month || '-01', 'YYYY-MM-DD'),
    p_section_0, p_section_1, p_section_2, p_section_3,
    p_section_4, p_section_5, p_section_6, p_section_7, p_appendix, now()
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

  return json_build_object('success', true, 'report_id', v_report_id);
end;
$$;

-- 4-grant (0017/0022 패턴): public/anon revoke + authenticated grant. service_role 미부여 (admin-only).
revoke all on function public.upsert_report_sections_0_7_admin(...) from public;
revoke all on function public.upsert_report_sections_0_7_admin(...) from anon;
grant execute on function public.upsert_report_sections_0_7_admin(...) to authenticated;
```

**orchestrator 변경**:
- `options.callerKind === 'admin'` && **B98 feature flag** `PR4_TRIGGER_UPSERT_ENABLED=true` 시 `upsert_report_sections_0_7_admin` 호출.
- 그 외 (cron 또는 flag off) → 기존 `update_report_sections_0_7` 호출.

**section_8/votes 처리**:
- admin path = `section_8 = null` (DB nullable ✓ verified §부록 B-1 — 마이그 0003 line 30).
- `committee_votes` row 0건 (cron path 후만 채워짐).
- UI = PR3a dual-shape renderer가 null/legacy/modern 처리.

**비용/리스크**:
- 신규 RPC 마이그 1개 (안전 패턴 0017/0022 복제).
- migration risk LOW (additive — 기존 update_report_sections_0_7 unchanged).
- per-call cost = orchestrator 기존 비용 (writer + critic + optional revise, exact = smoke 후 cost_log 기준 — B91).
- B79 deferred (Section 8 partA/partC/partD + committee_votes RPC 통합은 PR5 plan에서).

**Pros**:
- ✓ admin trigger 본질 (ad-hoc 종목 본문 생성) 정합.
- ✓ scope narrow — section_0~7 + appendix only.
- ✓ migration risk 최소화.
- ✓ PR5 cron path와 **충돌 없음** (cron은 commit_persona_eval + update_report_sections_0_7 path 사용 — 기존 path unchanged. PR5 readiness 자체 (B79 통합 + service-role caller + cron 활성화)는 별도 plan에서 해결).
- ✓ UI 변경 불필요 (PR3a dual-shape renderer 이미 처리).

**Cons**:
- × 두 INSERT path 유지보수 (admin RPC + cron commit_persona_eval).
- × Section 8 absent 리포트가 Track Record에서 "Tier 1 미평가" 신호 (UI 정책 명시 필요 — 본 PR scope 외, W-tier1pill follow-up ticket §6).
- (R4 fix: `stock_reports.section_8` nullable ✓ verified §부록 B-1 — 본 Cons 항목 제거.)

### 2.2 옵션 B — `commit_persona_eval` 연계 full path

**개요**: admin trigger도 cron path와 동일한 RPC chain 사용. `commit_persona_eval`이 row INSERT (section_8 + 11 votes 포함) 후 orchestrator가 `update_report_sections_0_7` UPDATE.

**필요 조건**:
1. admin trigger가 real Tier 1 evaluation 실행 (11 persona panel call) → section_8 + 11 votes 생성.
   - **비용 증가 5-10x**: 11 personas × ~500원 + writer/critic/revise = per-call 5,000~6,000원 (cron path와 동일).
   - **시간 증가**: per-call ~30-60초 (cron path와 동일).
2. OR admin trigger가 synthetic Tier 1 data 주입 → 옵션 C (위험).
3. `commit_persona_eval`에 service_role bypass 추가 (PR5 cron path service-role caller 정합 — B79 동시 해결).

**Pros**:
- ✓ 모든 리포트가 동일 shape (admin + cron 단일 path).
- ✓ Section 8 absent 처리 UI 분기 제거 (PR3a dual-shape renderer 단순화 가능, but PR3a 코드 변경은 follow-up).
- ✓ B79 동시 해결 (commit_persona_eval에 service_role grant 추가).

**Cons**:
- × **UX 본질 변경**: admin trigger가 "ad-hoc 빠른 분석"에서 "Tier 1 풀 평가 + 본문"으로 확장. 사용자 lock-in (HANDOFF §2.0 #2 product spec changes) 도달 → USER 결정 필요.
- × 비용 5-10x 증가. 16,050원/월 hardcap (PR5 cron 30 × 535원)이 admin path도 cron path와 동일 단가 가정 시 hardcap 재설계 필요.
- × **admin이 Tier 1 평가를 트리거할 의도가 아닌 시나리오** (이미 Tier 1 평가된 종목의 본문 재생성, 또는 Tier 1 미평가 종목의 ad-hoc 분석) 미지원.
- × commit_persona_eval에 service_role grant 추가 = security surface 확대 (B79 동시 변경).
- × PR4 wire의 stub `tier1Verdict: 'HOLD', consensusBadge: '🟡', summaries: '근거 부족'` 완전 제거 + Tier 1 caller 추가 → PR4 scope creep.

### 2.3 옵션 C — synthetic Tier 1 data 주입

**개요**: admin trigger가 `commit_persona_eval`을 호출할 때 fake 11 votes (모두 HOLD/'🟡') + fake argument_excerpt 주입.

**Pros**:
- ✓ 옵션 B의 비용 증가 회피.
- ✓ row 생성 후 update_report_sections_0_7 호출 가능.

**Cons (치명적)**:
- ×× **Track Record/Decision Tree 분석 corruption**: synthetic votes가 committee_votes 테이블에 영구 적재. 향후 persona 정확도 분석/Reflection (Step 4)이 fake data 기반 학습 → 신뢰성 영구 손상.
- ×× **Audit trail 위조**: cost_log + committee_votes가 "AI 평가 수행" 신호이지만 실제 평가 0건.
- ×× quality marker M3 (no-fabrication) 위반 — Kevin v3.1 quality target과 정면 충돌.

**판정**: **즉시 폐기 (NOT RECOMMENDED)**. 옵션 분석에서만 비교 reference로 박제.

---

## 3. axis 평가 (i / ii / iii)

### axis (i) — admin trigger 책임 범위

| 옵션 | admin trigger 책임 |
|---|---|
| A | section_0~7 + appendix only (Tier 1 미경유, Section 8 absent 허용) |
| B | section_0~7 + section_8 + 11 votes (Tier 1 강제, 본질 변경) |
| C | section_0~7 + section_8 + 11 fake votes (corruption risk) |

**권장**: **A** — admin trigger 본질은 ad-hoc 특정 종목 본문 생성. cron path가 full Tier 1 풀 리포트를 매월 batch로 처리. 두 path는 의도적으로 분리되어야 함.

### axis (ii) — B79 동시 해결 여부

B79 = Section 8 partA/partC/partD + `committee_votes` RPC 책임 boundary 결정.

| 옵션 | B79 |
|---|---|
| A | **deferred** — PR5 plan에서 결정 (admin RPC는 section_0~7 only이므로 B79와 무관) |
| B | **동시 해결** — commit_persona_eval에 service_role grant 추가, admin/cron 양쪽 통합 |

**권장**: **deferred (option A 연계)**. PR4 scope 이미 large (50 BLOCKERS catch & fix). PR5 plan 시점에 cron path service-role caller wire + B79 RPC 통합을 함께 결정 (PR5 R-debate에서 B79 + 큐 인프라 + service-role caller DI 동시).

### axis (iii) — PR5 cron path 일관성

PR5 cron 30 자동 = `monthly-batch/route.ts` route → service-role caller가 Tier 1 평가 → commit_persona_eval (section_8 + 11 votes INSERT) → orchestrator (section_0~7 UPDATE).

| 옵션 | cron path 변경 필요 |
|---|---|
| A | **없음** — cron path는 commit_persona_eval + update_report_sections_0_7 그대로. admin RPC는 별도 path (호환). |
| B | **commit_persona_eval에 service_role grant 추가** (B79 동시) — PR5 plan에 포함 |

**권장**: **A (compatible without change)**. 두 path 분리가 유지보수 부담이지만, admin path 변경이 PR5 cron path 진행을 차단하지 않음. PR5는 옵션 B와 무관하게 진행 가능.

**호환성 게이트 (B65-P2 R-debate axis iii)**:
- 옵션 A 채택 시 → PR5 cron path와 **충돌 없음** ✓ (PR5 readiness 자체는 B79 RPC 통합 + service-role caller wire + full cron path 활성화를 PR5 plan에서 별도 해결 필요 — 본 옵션 A는 PR5 readiness blocker는 아니지만 substitute도 아님)
- 옵션 B 채택 시 → PR5 plan이 B79 + service_role grant + 비용 hardcap 재설계 동시 해결 필요 (scope creep 위험)

---

## 4. 추천 (Claude R8 — omxy R1~R7 catch 반영)

### 4.1 결정 매트릭스

| 항목 | 옵션 A | 옵션 B | 옵션 C |
|---|---|---|---|
| admin trigger 본질 정합 | ✓ | × (UX 변경) | × (corruption) |
| scope narrow | ✓ | × (creep) | ✓ |
| migration risk | LOW (additive) | HIGH (multi-RPC + grant) | LOW |
| per-call cost (KRW) | writer+critic±revise (existing) | 5-10x 증가 | 동일 + corruption |
| PR5 cron path 충돌 | ✓ (no conflict; PR5 readiness 별도) | △ (B79 동시 변경 필요) | × |
| B79 동시 해결 | × (deferred) | ✓ | × (deferred) |
| Track Record 신뢰성 | ✓ | ✓ | ××× |
| Kevin v3.1 quality M3 | ✓ | ✓ | ×× |
| UI 변경 필요 | × (PR3a 이미 처리) | △ (단순화 가능) | × |
| 사용자 lock-in 도달 | × | ✓ (product spec 변경) | × |

### 4.2 최종 추천

**옵션 A + axis (i)A + axis (ii) deferred + axis (iii) compatible**.

근거:
1. admin trigger 본질 = ad-hoc 특정 종목 본문 생성. Tier 1 평가는 cron path가 매월 batch로 처리. 의도적 분리.
2. PR3a dual-shape renderer가 Section 8 absent를 이미 처리. UI 변경 0.
3. migration risk LOW (additive RPC 1개, 기존 update_report_sections_0_7 unchanged).
4. PR5 cron path와 **충돌 없음** (commit_persona_eval/update_report_sections_0_7 unchanged). PR5 readiness 자체 (B79 통합 + service-role caller + cron 활성화)는 별도 plan/PR에서 해결.
5. B79는 PR5 R-debate에서 service-role caller wire + 큐 인프라 + 비용 hardcap과 함께 결정.
6. 옵션 B는 사용자 lock-in (product spec 변경) 도달 → USER 결정 필요. 본 spec scope는 옵션 분석까지.

### 4.3 옵션 A 도입 sequence (omxy R1 d 5종 추가 항목 반영)

1. **마이그 0025** `upsert_report_sections_0_7_admin.sql` + rollback 작성:
   - 4-grant 패턴 (`public/anon revoke` + `authenticated grant only`; **service_role grant 금지 — admin-only path 보장 + cron path는 별도 commit_persona_eval 사용**, omxy R1 f)
   - input regex guard (`p_ticker '^[0-9]{6}$'` + `p_month '^[0-9]{4}-[0-9]{2}$'`, 0017/0022 패턴 복제)
   - `security definer` + `search_path = public, pg_temp` + manual `auth.uid() + is_admin()` guard (RLS bypass 명시, omxy R1 f)
   - **version/schema_version unchanged invariant**: `regen_auto_count`/`regen_manual_count`/`version`/`schema_version` 변경 0 (overwrite-in-place 패턴, 0017/0022 동일 — §4.5 versioning policy 박제 적용, Critic B2 + omxy R1 d)
   - **기존 section_8/consensus_badge preserve**: UPDATE 시 section_8/consensus_badge 컬럼 미터치 (cron path가 commit_persona_eval로 채울 수 있도록 보존, omxy R1 d)
2. **stock_reports schema 확인 ✓ (부록 B verified)**: `section_8`, `consensus_badge` 모두 nullable (마이그 0003 line 30 + 0017 line 65). 옵션 A 적용 가능.
3. **orchestrator 변경**: `options.callerKind === 'admin'` && **`PR4_TRIGGER_UPSERT_ENABLED=true`** (B98 default, Task 4 도입) 시 신규 RPC 호출. 그 외 (cron 또는 flag off) → 기존 `update_report_sections_0_7` 호출.
4. **TDD invariants (omxy R1 d 5종 + 기본)**:
   - upsert 시 row 생성 + 동일 (ticker, month, is_latest=true) 재호출 시 UPDATE (generated_at bump, section_0~7+appendix만 변경)
   - **service_role deny grant smoke (R5 omxy R4 (II) exact signature 박제)**: 단순 "RPC 호출 reject" 대신 두 layer 모두 검증 + **exact regprocedure signature 박제** (production smoke 재현성 필수, has_function_privilege는 placeholder `(...)` 미지원):
     ```sql
     -- Layer 1: DB grant 검증 (마이그 0025 적용 직후, 신규 RPC parameter 순서 = p_ticker text, p_month text, p_section_0..7 jsonb (8개), p_appendix jsonb)
     select has_function_privilege(
       'service_role',
       'public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)'::regprocedure,
       'EXECUTE'
     ) as service_role_can_execute;
     -- 기대: false
     ```
     ```ts
     // Layer 2: PostgREST permission denied response 확인 (service-role REST client 호출 시 403/permission denied)
     const sr = createServiceRoleClient(...);
     const { error } = await sr.rpc('upsert_report_sections_0_7_admin', { ...validPayload });
     // 기대: error.code = '42501' (insufficient_privilege) OR error.message contains 'permission denied for function'
     ```
     **함수 signature는 마이그 작성 시점에 RPC parameter 순서 + 타입과 동일하게 박제**. omxy R1 d + R2 a' + R4 (II)
   - **기존 section_8/consensus_badge preserve test**: row가 section_8 채워진 상태에서 admin RPC 호출 → section_8/consensus_badge 그대로 (UPDATE 후 SELECT 검증, omxy R1 d)
   - **same-month 재호출 UPDATE + generated_at bump invariant** (omxy R1 d)
   - **P1 preflight feature-flag toggle invariant**: `PR4_TRIGGER_UPSERT_ENABLED=false` 시 기존 B65-P1 guard 진입 (fail-fast `report_not_found`) / `=true` 시 신규 RPC path 진입 (B65-P3 Task 4 책임, omxy R1 d)
   - **version/schema_version 불변/regen counter 불변 invariant**: RPC 전후 stock_reports.{version, schema_version, regen_auto_count, regen_manual_count} 값 변경 0 (overwrite-in-place 패턴, omxy R1 d)
   - admin auth (auth.uid() null → `auth_unavailable` / is_admin()=false → `admin_required`) + RLS bypass via SECURITY DEFINER 검증
5. **마이그 production apply** + Vercel deploy + canary.
6. **Smoke Stage 1** (Task 6): non-AI dry-run TDD with vi.doMock.
7. **Smoke Stage 2** (Task 7, USER 승인): single real AI smoke + cost_log/stock_reports/report_critic_findings 검증.

### 4.4 잔여 결정 (옵션 A 채택 시 후속) — omxy R1 e/h 정정 반영

- **section_8/consensus_badge nullable** ✓ verified (§부록 B-1/B-2 마이그 line 박제).
- **UI Track Record 표시**: Section 8 absent 리포트의 "Tier 1 평가 대기" 배지/안내 — **별도 follow-up ticket로 박제** (omxy R1 h + critic W3). PR3a dual-shape renderer가 `SectionFallback` 표시 (UI crash 0)이나 D11 운용 검증 시 어드민 3인이 "왜 Section 8이 비어 있나" 혼동 가능 → **PR4 post-merge follow-up = "Tier 1 평가 대기" pill 추가 (별도 PR, Task 8 audit 진입 전 디자인)**.
- **regen UX (R7 omxy R7 BLOCKER 1 정정)**: `/admin/report/[ticker]/regenerate`도 **`orchestrateFullReport({ callerKind: 'admin' })` 동일 호출** → B65-P3 feature flag `PR4_TRIGGER_UPSERT_ENABLED=true` 시 신규 RPC `upsert_report_sections_0_7_admin` 진입 (admin trigger button과 동일 RPC). **분기 semantics**: regen path는 `reportExistsForMonth` preflight + `incrementManualRegenCount` (regen_counter table CAS insert/select/update **data-layer function**, NOT a Supabase RPC — admin-regen-counters.ts) 선행 → 기존 row 존재 가정 → 신규 RPC는 **UPDATE branch** (ON CONFLICT update) 진입. admin trigger button = missing-row → **INSERT branch**. 두 caller-side guard로 책임 분리. 자세한 path 정합 = §부록 B-5 (R5 canonical 박제, R6 본 §4.4와 동일 story). regen page만의 별도 data path는 `incrementManualRegenCount` data-layer function — 본 RPC와 분리.
- **D11 AI 가상 포트 검증 시점**: Section 8 absent 리포트의 Track Record 정상 동작 검증 (S7b 후, S7c 전 게이트). Tier 1 평가 대기 pill 도입 후.

### 4.5 versioning policy (R2 신규, Critic B2 + omxy R1 d lock-in)

**현 상태 (마이그 0003 + 0017 + 0022)**: `stock_reports`는 `version int default 1` + `schema_version int default 1` + `is_latest boolean default true` + `regen_auto_count int <= 1` + `regen_manual_count int <= 2`. 그러나 0017 commit_persona_eval과 0022 update_report_sections_0_7 모두 **overwrite-in-place** 패턴 (generated_at bump만, version/schema_version/is_latest 모두 변경 없음). 즉 versioning은 schema에는 박제되어 있지만 **운영 actually 적용 0** (regen counter는 별도 **data-layer function `incrementManualRegenCount`** 가 `regen_counter` table CAS insert/select/update — admin-regen-counters.ts, NOT a Supabase RPC).

**옵션 A versioning policy = (1) overwrite-in-place (0017/0022 패턴 보존)**:
- ✓ scope narrow (옵션 A scope에 versioning 결정 끼워넣기 = scope creep)
- ✓ 일관성 (cron path commit_persona_eval과 admin path 신규 RPC 모두 동일 패턴)
- ✓ regen page의 `incrementManualRegenCount` **data-layer function** (admin-regen-counters.ts, regen_counter table CAS insert/select/update — Supabase RPC 아님)는 본 RPC와 무관 — **같은 server action flow 안에서 orchestrate 전 순차 선행 호출** (regen page actions.ts line 130). 본 옵션 A의 신규 RPC는 regen이 entered (UPDATE branch) but counter는 미터치 — counter 책임은 `incrementManualRegenCount` 단독.
- × 영구 audit history 무 (감사/디버깅 시 prior 본문 복구 불가)

**대안 (2) auto-flip is_latest + version bump** — **deferred (별도 PR + R-debate)**:
- 이유: versioning은 cross-cutting 결정 (commit_persona_eval + update_report_sections_0_7 + admin RPC + regen 모두 영향). PR5 plan R-debate에 포함 (B-versioning 신규 audit catalog 추가).

**lock-in (R2)**: 옵션 A는 **(1) overwrite-in-place 채택**. version/schema_version/is_latest/regen_* 모두 변경 0 (TDD invariant — §4.3 step 4). versioning policy 재설계는 PR5 plan + B-versioning ticket으로 분리.

### 4.6 cost_log accounting clarification (R2 신규, Critic B4)

**cost_log 적재 책임 (R4 omxy R3 β 정밀화)**:

옵션 A의 신규 RPC `upsert_report_sections_0_7_admin`는 cost_log를 touch 0. **cost_log INSERT 책임 = AI client wrapper 내부 (R5 omxy R4 (I) 정밀화)**:
- `callFullReport` (writer): **pre-parse cost accounting** — LLM 응답 수신 + 토큰/비용 계산 후 즉시 `insertCostLog` 호출 (full-report-client.ts). JSON parse는 orchestrator가 응답 반환받은 후 별도 수행 (cost_log INSERT와 의존성 0).
- `callRevise`: **pre-parse cost accounting** — 동일 (revise-client.ts: LLM 응답 수신 + 토큰/비용 계산 후 INSERT, parse는 orchestrator 책임).
- `callCritic`: **post-parse cost accounting** — critic-client.ts 내부에서 LLM 응답 + JSON parse + validation 통과 후 INSERT (verdict 추출 성공 시점).
- `evaluateReport` (critic.ts 본체): cost_log INSERT 미수행 — 내부에서 `callCritic`만 호출 (callCritic이 적재).

→ 한 admin 트리거당 **2~3 cost_log rows** 생성 (writer + critic 항상 + optional revise 시 +1 — revise는 critic verdict의 `shouldRevise=true` 분기에서만 진입, R6 omxy R6 추가 정정). orchestrator path:

```
orchestrateFullReport →
  preflightHardcap (no cost_log INSERT, budget check only) →
  callFullReport (LLM 응답 수신 + 토큰/비용 계산 후 cost_log INSERT — pre-parse accounting) →
  parseAndValidate →
  evaluateReport → callCritic (LLM 응답 수신 + parse + validation 통과 후 cost_log INSERT — post-parse accounting) →
  [optional] callRevise (LLM 응답 수신 + 토큰/비용 계산 후 cost_log INSERT — pre-parse accounting) →
  upsert_report_sections_0_7_admin (no cost_log) →
  insertCriticFindingsRun (no cost_log) →
  insertOrBumpBacklog (no cost_log)
```

→ **B65-P2 옵션 A 도입 후에도 cost_log 적재 path 정확**. Smoke Stage 2 (Task 7) PASS criteria 1 (`cost_log` row exists) 검증으로 확인.

**⚠️ cost_log env gate (R4 omxy R3 β catch)**: `insertCostLog`는 **`process.env.AI_COST_LOG_REAL_INSERT_ENABLED === 'true'` 일 때만 INSERT** (그 외 noop, mock fixture 단계 보호). **Smoke Stage 2 (Task 7) 진입 전 Vercel production env에 `AI_COST_LOG_REAL_INSERT_ENABLED=true` 설정 선행조건 필수** (env false 시 cost_log row exists 검증 = guaranteed FAIL false negative). Task 7 sequence에 본 env gate verify step 추가.

**RPC 실패 시 cost_log 잔존**: writer/critic/revise가 이미 cost_log INSERT 완료 후 RPC가 fail (예: input regex mismatch — 가능성 낮음 but 0이 아님) → cost_log에 적재되었지만 stock_reports 부재. 이는 0017/0022 패턴과 동일 (RPC fail 시 cost_log 회수 불가 — B65-P1 guard가 이 시나리오를 차단). 본 spec scope 외.

### 4.7 production sequencing risk (R2 신규, Critic B5)

**현 production AI path 상태 (2026-05-26 audit)**: cost_log=0 / stock_reports=0 / committee_votes=0 / cron stub throw / Tier 0 fallback `short_list_30` 30 rows (AI 평가 0건). **PR #21 B65-P1 머지 후 = admin trigger button click → `report_not_found` fail-fast (cost burn 0, 정상 동작 0)**.

옵션 A 도입 시:
- admin trigger button click → `upsert_report_sections_0_7_admin` → row 생성 + section_0~7 본문 채움 → Section 8/votes는 absent (cron path 미진행)
- D11 운용 검증 시 어드민 3인 = "ad-hoc 종목 분석은 본문 보이지만 Section 8 비어 있음" 상태 norm. **Tier 1 평가 대기 pill 추가 (W3 follow-up) 시 사용자 의도 명시 가능**.
- PR5 cron 가동 후 = cron path가 매월 1일 commit_persona_eval로 30 종목 row + Section 8 + 11 votes 생성. admin trigger는 ad-hoc (cron path 미경유 종목 또는 cron 종목 본문 재생성) path 유지.

**risk**: 옵션 A 단독 도입 시 (PR5 cron 미가동 상태) → 모든 production report = Section 8 absent. D11 운용 검증 통과 가능성은 Tier 1 평가 대기 pill UX 정책에 의존. **이를 acceptance gate로 명시 (PR4 follow-up ticket 박제)**.

**대안 — 옵션 A를 Task 8 audit 이후 PR5와 함께 도입**:
- ✗ B65 3-phase 분리 깨짐 (P1 ✅ MERGED, P2/P3 모두 PR5 entry 차단 = HANDOFF §2.1 sequence 변경)
- ✗ B65-P1 머지 후 admin trigger 영구 fail-fast 상태 장기화 (어드민 사용성 0)

**판정**: 옵션 A는 PR5보다 선행 도입 정당화 ✓. UX risk는 Tier 1 평가 대기 pill follow-up + D11 운용 검증 acceptance gate로 mitigate.

(R3 omxy R2 f' fix: 본 위치에 잔존하던 stale §4.4 "잔여 결정" 5 항목 삭제 — §4.4의 R2 갱신본은 위 §4.4에 단일 위치 보존.)

---

## 5. CONVERGED 조건 (R8 final, omxy R8 ESCALATE 갱신)

- **omxy 누적 (R1~R7) 적대적 검토 BLOCKERS 0** + R8 mechanical-only stale fix (label-갱신류 3 항목) 잔여 0 = max 8 rounds 정합 (§7.5).
- **R8 omxy SIGNAL = ESCALATE**: max 8 rounds 도달 — debate convergence 더 진행 X. Claude가 잔여 mechanical stale (§5 R8 라벨 / §6 R8 결정 / §부록 B header R1~R8) 기계적 fix 후 사용자가 commit 결정.
- 옵션 선택 사용자 lock-in 도달 시 (옵션 B 채택 가능성) USER 승인 (현재 = 옵션 A lock-in, ESCALATE는 옵션 reversal 아님 — max-round 도달 사유).
- 옵션 A 채택 시 → Task 4 B65-P3 plan SoT 작성 진입.
- **post-CONVERGED 박제 = §6 sequence (본 spec commit + HANDOFF §2.1 Task 3 ✅ + Step 11 PR5 row wording + §3 + §9 + audit catalog 6 tickets) 단일 commit으로 stale 0 달성**.

---

## 6. 박제 (post-CONVERGED, R3 omxy R2 e'+f' 갱신)

- **HANDOFF §2.1 Task 3 ✅ COMPLETED** 박제 (옵션 A + axis (i)A + (ii) deferred + (iii) no-conflict lock-in).
- **HANDOFF §2.1 Step 11 PR5 row "호환성 게이트" 문구 정정 (R6 omxy R5 BLOCKER 2)**: 현재 line 221 stale 표현 "옵션 A만 + B79 미해결 시 cron 30 자동 path가 section_8/committee_votes 미생성 → PR5 cron 30 자동 quality 보장 불가" → **"옵션 A 채택은 PR5 cron path와 충돌 없음. PR5 cron 30 자동 path quality는 commit_persona_eval (full path) + service-role caller wire + B79 RPC 통합을 PR5 plan에서 별도 소유. 본 옵션 A는 admin path를 좁게 처리 + cron path readiness는 PR5에서 독립 확보."** 로 치환 명시.
- **HANDOFF §9.2 B65-P2 옵션 A 채택** 명시 + 도입 sequence 7-step 요약.
- **HANDOFF §3 사용자 액션 대기 큐** 갱신 — **W-tier1pill (Tier 1 평가 대기 pill UI)** 항목 신규 추가 (D11 운용 검증 acceptance gate 게이트, omxy R2 e' 강제).
- 본 spec doc commit (no impl code).
- **§9 audit catalog 갱신** (commit과 동일 PR/commit에서):
  - **B79 항목**: "옵션 A 채택 시 PR5 plan에서 commit_persona_eval + service-role caller wire + B79 동시 결정 (B79 deferred 이유 = admin path와 cron path 분리)"
  - **B-versioning 신규**: "옵션 A는 overwrite-in-place 채택. version/schema_version/is_latest/regen_* counter 불변 invariant. (1) auto-flip + version bump 재설계는 PR5 plan R-debate에 deferred"
  - **W-tier1pill 신규 (PR4 post-merge follow-up ticket)**: "Section 8 absent 리포트 = Tier 1 평가 대기 pill UI 추가. D11 운용 검증 acceptance gate. PR4 14 defer follow-up tickets와 별개. HANDOFF §2.1 Step 8 (D11 AI 가상 포트 1차 가동 게이트) 본문도 acceptance gate 명시로 갱신. omxy R1 h + critic W3 + omxy R2 e' + R3 ε 박제"
  - **W-grant-smoke 신규 (R5 갱신)**: "service_role deny 검증은 두 layer (has_function_privilege + PostgREST permission denied)로 마이그 직후 sanity smoke. **exact regprocedure signature `(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)` 박제 필수** (has_function_privilege placeholder 미지원). omxy R2 a' + R3 α + R4 (II) 박제"
  - **W-sectionfallback-text 신규 (R4 omxy R3 η)**: "SectionFallback 문구 `후속 PR3b (writer Section 0~7 본문 구현)에서 채워집니다`는 stale — PR3b 이미 MERGED `cf68731` (canonical 5-PR §1). Tier 1 평가 대기 pill 도입 시 함께 정정. page.tsx line 336~346"
  - **W-cost-log-env-gate 신규 (R4 omxy R3 β)**: "Smoke Stage 2 (Task 7) 진입 전 Vercel production env에 `AI_COST_LOG_REAL_INSERT_ENABLED=true` 설정 선행 — 미설정 시 insertCostLog는 noop. Task 7 sequence에 env gate verify step 추가"
- **PR4 14 defer follow-up tickets와 별개의 신규 tickets로 박제** (HANDOFF §3 + audit catalog 양쪽).
- **HANDOFF global stale sweep (R7 omxy R7 BLOCKER 2 추가)**: post-CONVERGED commit 시 단일 PR 안에서 HANDOFF 전역 grep + 치환 필수. 박제 keyword 6종:
  - `Task 3`, `B65-P2`, `R-debate`, `다음 1순위`, `옵션 A로 충분한지`, `PR5 blocker` (+ "옵션 A만 + B79 미해결 시" 류 stale)
  - 모든 occurrence를 R8 final 결정 (옵션 A 채택, axis i/ii/iii lock-in, PR5 no-conflict)로 치환.
  - HANDOFF §0 / §1 / §2.1 (Step 11 PR5 row 포함) / §3 / §6 (직전 entry post-CONVERGED 박제) / §7.10 (R-debate 패턴 참조) / §9 모두 commit 시점에서 stale 0 검증.

---

## 부록 A — 참조 문서

- HANDOFF §0/§1/§2.1/§9.1-§9.7 (57차 §1+§2 박제).
- 마이그 0017 (`commit_persona_eval`) — `tudal/supabase/migrations/0017_cost_log_and_batch_runs.sql:123-208`.
- 마이그 0022 (`update_report_sections_0_7`) — `tudal/supabase/migrations/0022_update_report_sections_0_7.sql`.
- 마이그 0003 (`stock_reports` schema) — `tudal/supabase/migrations/0003_*.sql`.
- orchestrator (`orchestrateFullReport`) — `tudal/src/lib/report/full-report-orchestrator.ts`.
- admin trigger action (`triggerFullReport`) — `tudal/src/app/(admin)/admin/portfolio/actions.ts:579-676`.
- 53차 §5 정정 spec — `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md`.
- PR3a dual-shape renderer — `tudal/src/lib/data/report-section-schemas.ts` + `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx`.

## 부록 B — 검증 결과 (Claude self-verify, omxy R1~R8 review 대상)

- **B-1 ✓ verified**: `stock_reports.section_8` nullable. 마이그 0003 `section_8 jsonb` line 30 (NOT NULL 없음). 옵션 A INSERT 시 section_8 omit 가능.
- **B-2 ✓ verified**: `stock_reports.consensus_badge` nullable. 마이그 0017 `add column if not exists consensus_badge text check (consensus_badge in (5-set))` line 65~66 — NOT NULL 미부과 + check 제약은 NULL pass-through (PostgreSQL semantic: `NULL in (set)` 평가 = NULL → check 통과). 옵션 A INSERT 시 consensus_badge omit 가능.
- **B-3 ✓ verified**: `is_latest` 처리 = `default true` (마이그 0003 line 21). UPSERT `ON CONFLICT (ticker, month) WHERE is_latest = true` 사용 (commit_persona_eval 패턴 동일 — 마이그 0017 line 176). partial unique index `stock_reports_ticker_month_latest_uniq` 정합 (0003 line 38~40).
- **B-4 ✓ verified (R4 omxy R3 η 정정)**: PR3a dual-shape renderer가 모든 Section View에서 `if (!data) return <SectionFallback sectionId="..." />` 처리 (page.tsx line 351/384/419/470/501/516/539/573/613/865). 실제 SectionFallback 본문 (page.tsx line 336~346) = **"본문 미작성 / {sectionId} 본문은 후속 PR3b (writer Section 0~7 본문 구현)에서 채워집니다. DB에 jsonb가 비어 있거나 validation 실패 상태입니다."** — **UI crash 0 확인 ✓**. **단 SectionFallback 문구가 stale ("후속 PR3b" — PR3b는 이미 MERGED)** → W-sectionfallback-text 신규 follow-up ticket (§6) 추가. Tier 1 평가 대기 pill 도입 시 함께 정리.
- **B-5 (R4 정정, omxy R3 γ critical fix)**: admin trigger button (`portfolio/actions.ts::triggerFullReport`)과 regen page (`/admin/report/[ticker]/regenerate/actions.ts`) **양쪽 모두** `orchestrateFullReport(..., { callerKind: 'admin' })`로 동일 호출. → **B65-P3 feature flag `PR4_TRIGGER_UPSERT_ENABLED=true` 적용 시 양쪽 모두 신규 RPC `upsert_report_sections_0_7_admin` 진입** (R3 spec 잘못 박제 정정). **분기 semantics**:
  - admin trigger button = missing-row 시나리오 → RPC INSERT branch (신규 row 생성).
  - regen page = 기존 row preflight (`reportExistsForMonth` line 75 + `incrementManualRegenCount` line 130 선행) → row 존재 가정 진입 → RPC UPDATE branch (UPSERT의 ON CONFLICT update).
  - 두 path 모두 신규 RPC 통과하지만 **runtime branch가 자연스럽게 분리** (regen의 preflight + counter 증가가 INSERT branch를 사실상 차단). 동일 RPC + 두 caller-side guard로 책임 분리 명확.
  - **alternative (writeMode: 'upsert'|'update' 옵션 추가)**: orchestrator API surface 확대 — **현재 reject** (preflight 만으로 충분, scope creep 회피). PR5 plan에서 cron path까지 통합 시 재논의.

**기타 (옵션 A 도입 시 sequence 추가 검토)**:
- regen_auto_count + regen_manual_count check 제약 (`<= 1`, `<= 2`). UPSERT 시 ON CONFLICT update 동작이 이 counter를 증가/유지하지 않음 — 기존 update_report_sections_0_7과 동일 (counter 관리는 별도 **data-layer function `incrementManualRegenCount`** 책임, `regen_counter` table CAS — Supabase RPC 아님).
- version/schema_version (`default 1`). 옵션 A UPSERT는 변경 없음 (그대로 1 유지).
- RLS policy `stock_reports admin all` (마이그 0003 line 55) = authenticated + is_admin() — 옵션 A RPC `security definer` 안에서 manual check이므로 RLS bypass (commit_persona_eval/update_report_sections_0_7 동일 패턴).
