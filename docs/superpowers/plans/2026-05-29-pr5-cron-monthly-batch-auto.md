# PR5 cron monthly-batch 자동 리포트 생성 plan (report-only over 기존 30 + β2′ resumable worker)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vercel cron이 매월 기존 `short_list_30` 30종목에 대해 `orchestrateFullReport`(Section 0~7 + Appendix, Kevin v3.1 quality)를 자동 생성하도록, Vercel 300s timeout을 견디는 idempotent resumable worker + cost hardcap + 실패 격리/알림을 갖춘 path를 만든다.

**Architecture:** 신규 report-worker route가 **전용 run-mutex**(selection과 분리)를 잡고 service-role client로 `getActiveShortList` 30 rows를 읽어, β2′ 자체 DB job queue(`report_batch_job`)로 chunk(N=3~5)씩 claim → `orchestrateFullReport(input, {client, callerKind:'cron'})` 호출 → 신규 cron UPSERT RPC로 atomic persist. **chunk-advance primary = 별도 DAILY cron**(deterministic, idempotent); self-continuation(`after()/waitUntil`)은 optional accelerator(load-bearing 아님). committee_votes/Section 8(full path)은 **PR5b로 분리**(D11 전 land 강제).

**Tech Stack:** Next.js 16 route handler(nodejs runtime, force-dynamic) · Supabase service-role client + SECURITY DEFINER RPC(마이그 0027) · Vitest(pure 로직) · Anthropic(Opus writer + Haiku critic, 기존 orchestrateFullReport 재사용).

---

> **세션**: 61차 (PR5 plan) — DRAFT R0 (Claude 1차, Workflow 12-agent research+design panel 종합)
> **상태**: PLAN DRAFT — OMXY R-debate 검증 대기. workflow note (사용자 명시 61차): 한 섹션(=PR5 plan SoT)을 Claude가 전부 작성하고, 마지막에 OMXY가 catch-only 적대적 검토로 검증.
> **paired decision**: HANDOFF §2.1 PR5 row + §9.5 B79/B-versioning/W-pr5-readiness + CLAUDE.md canonical 5-PR(완료) 다음 = PR5
> **선행 commit**: code baseline `f2b24e9` (PR #58) / main HEAD `4bc5f9d` (post-Task-5 sync). Task 5 B66 PRODUCTION COMPLETE (short_list_30 30 rows canonical 14, B93 PASS).
> **블록(impl 진입 게이트)**: 본 plan PR은 **plan-only** (PR #28 Task 4 / PR #55 Task 5 plan SoT 패턴). impl PR 진입 = §2.1 active matrix Task 1~7 PASS 후 (특히 **Task 7 Smoke Stage 2 USER 1회 비용 승인** — B97 lock). 즉 본 plan은 지금 작성 가능하나, impl 착수는 Smoke Stage 2 PASS 후.
> **다음 세션 진입**: impl PR `feat/pr5-cron-monthly-report-worker` (Smoke Stage 2 PASS 후).

---

## 0. Scope guard (재해석 금지)

### 본 plan in-scope (PR5 = report-only 자동 생성)

- 신규 **report-worker route** (`tudal/src/app/api/cron/monthly-batch/report-worker/route.ts`)가 service-role client로 기존 30 `short_list_30` rows를 읽어 종목별 `orchestrateFullReport(input, {client: createServiceRoleClient(), callerKind:'cron'})`를 호출 → **Section 0~7 + Appendix** 자동 생성.
- **β2′ 자체 DB job queue** (`report_batch_job` per-ticker + `report_worker_run` 전용 run-mutex + claim/mark/acquire/release RPC) 기반 chunked·idempotent·resumable worker (Vercel 300s timeout 회피). **chunk-advance primary = 별도 DAILY cron**(deterministic, idempotent); self-continuation(`after()`/`waitUntil`)은 optional accelerator(load-bearing 아님 — MEDIUM-3 fix). **2-layer concurrency**: (L1) 전용 `report_worker_run` mutex가 invocation 직렬화 → 동시 `preflightHardcap` cost race 차단(R2 HIGH-1) + double-fire 차단; (L2) `report_batch_job` claim(SKIP LOCKED + `attempts<3`)이 per-ticker resume. **selection의 `monthly_batch_runs` lock은 미공유**(R1 HIGH-1 — month-key 충돌 방지).
- **row 생성 수단**: 신규 cron UPSERT RPC `upsert_report_sections_0_7_cron` (service_role, INSERT-if-missing). cron의 기존 `update_report_sections_0_7`(UPDATE-only, row 부재 시 P0002) 한계 해소 = **B65/B67 report-path 근본원인 종결**.
- cost: 종목별 `preflightHardcap`(기존, **매 attempt 호출** → 누적 `getMonthlyTotal + reservation > HARDCAP_KRW`=400k 시 throw) + batch-level preflight. **30 × 535 ≈ 16,050원/월 (4.0%) = no-retry projection**. **best-effort budget guard(R4 MEDIUM-2 정정 — strict ceiling 아님)**: 535는 calibration projection이지 max-token 경(硬)상한이 아니고, LLM 성공 후 `insertCostLog` 실패 시 **unlogged-spend window**(getMonthlyTotal 미반영)가 남는다. 따라서 preflight는 hardcap을 **근사 보장**하며, 실제 token이 projection 초과 시 소폭 overshoot 가능(N=2 retry bounded). 정밀 enforce(true max-reservation/insert preflight)는 W-cost-atomic-reservation follow-up.
- 실패 격리: **sequential for-loop**(NOT `Promise.allSettled`) + retry N=2(transient만 = `full_report_llm_failed`/`critic_llm_failed`/`revise_llm_failed`/429/529/network — MEDIUM-2 fix) + per-ticker `report_batch_job.status='failed'`(attempts≥3 고정) + systemic abort(`ai_key_unavailable`/`cost_hardcap_40man`).
- 관측: 신규 `insertPipelineHealth(pipeline='ai')` row 1건/run + end-of-run summary alert(녹색이면 alert 0). B78 null-drop console.warn → 구조화 console.error 격상.
- feature flag **`PR5_CRON_AUTO_ENABLED`** (default `false`) — dormant 시 200 `{ok:true,skipped:true}` (502 아님). USER가 flag + `AI_COST_LOG_REAL_INSERT_ENABLED=true` + `ANTHROPIC_API_KEY` 설정 시에만 가동.
- 마이그 0027 (report-only scope): `report_batch_job`(per-ticker) + `report_worker_run`(전용 run-mutex, R2 HIGH-1) 테이블 + `claim_next_report_jobs` + `mark_report_job` + `acquire_report_worker_lock`/`release_report_worker_lock` + `upsert_report_sections_0_7_cron` + `pipeline_health` service_role INSERT grant 검증. 모두 SECURITY DEFINER 4-grant + **내부 `service_role` bypass / `is_admin()` else guard**(0021:37-45/0022:45-57 패턴 — HIGH-2 fix) + rollback pair. **`cost_log.called_by`는 schema 미변경** — reserved 'cron-system' auth.users UUID(USER 1회 seed)로 해소(HIGH-3 fix, adminUserId 체인 무변경).
- DI seam 추가: `getActiveShortList`에 `options.client?` (현재 session-only). service-role.ts allow-list에 신규 helper 등록.
- admin twin: `triggerReportWorker` admin server action(수동 re-trigger / dead-chain 복구).
- TDD invariants (§6) + grep gate (§7).

### Out-of-scope → PR5b (committee votes full path, **D11 전 land 강제 hard gate**)

- **committee_votes + Section 8 partA/partC/partD** 생성 (`commit_persona_eval` 0017 + `commit_sector_personas` 0019). 이는 **Tier 1 Core 11 + Sector Board AI 평가** 산출물 = +330 core + ~420 sector ≈ **+750 LLM call (~5-10x)** — 16,050 추정에 미포함 → **PR5b 별도 cost 재추정 + OMXY CONVERGED 후 가동**.
- PR5b 마이그(예상 0028): `commit_persona_eval`/`commit_sector_personas` service_role grant + service_role bypass branch (현재 authenticated-only + `auth.uid()` hard-raise) + `writer.ts` DI seam(`commitTickerReport`/`commitSectorReport` 3 hardcoded `createClient()`) + Tier 1 selection lock wire.
- **하드 게이트**: PR5b는 **D11 AI 가상 포트 운용 검증 진입 전 반드시 land** — D11 Accept/Reject가 투심위 Section 8(Core 11 + Sector Board 찬반·논거, ServicePlan-Admin UA1)에 의존. PR5b는 open-ended defer가 아닌 **committed fast-follow**.

### Out-of-scope (별도 PR / 변경 금지)

- **Tier 1 SELECTION main path** (`runMonthlyBatchOrchestrator` + 실 `tier0Source` 150 + 실 `callPersonaPanel` Core 11). 현 cron `monthly-batch/route.ts`의 selection mock-throw(`tier0_source_not_wired_pr1_followup` 등, "B67")은 **이 SELECTION path의 책임이지 PR5(report)의 책임이 아님**. PR5는 기존 30 rows를 **consume**한다(re-select 아님 — 30 rows는 Python `screen_shortlist_tier0.py` Tier 0 seed가 생성). report-worker는 별도 endpoint이므로 selection route를 건드리지 않는다.
- **B65-P2 옵션 A admin RPC** `upsert_report_sections_0_7_admin` (0025) — service_role **REVOKE 유지**. PR5는 별도 cron RPC를 신설하고 admin RPC를 재사용/수정하지 않는다.
- **auto-flip + monthly version-bump history** (기각 — B65-P2 overwrite-in-place lock 재오픈) · report-body diff/audit history · stock_reports retention policy.
- **β1 Vercel Queues** (public beta on money-path 기각 — 단 beta 졸업 후 follow-up `W-pr5-vercel-queues`로 재검토 가능) · β3 single-invocation fan-out(30 × Opus ≫ 300s, 수학적 불가 — 명시 기각하여 omxy re-litigate 차단).
- **D4 AI 비중 % + 현금 0~30%** (`suggested_weight`는 현재 1/30 placeholder, AI weight·cash 미구현) — PR5는 건드리지 않음.
- W-cost-log-admin-assertion / W-cost-log-pagination-snapshot / W-cost-log-core11-drift / W-alert-event-dedup / W-pipeline-health-window-hardening / W-portfolio-snapshot-real — defer(§8).
- DQ-7 / S8 / 멤버 페이지.

---

## 1. SoT linkage

| 자료 | 경로 (file:line) | 본 plan에서의 역할 |
|---|---|---|
| **report 생성 caller** (재사용, per-ticker) | `tudal/src/lib/report/full-report-orchestrator.ts:135` (`orchestrateFullReport`), options `:54-57`, input `:40-42`, rpcName branch `:246-251`, persist `:253-279` | PR5 worker가 종목별 호출. **이미 `options.client` + `callerKind:'cron'` DI 준비됨.** cron branch는 현재 `update_report_sections_0_7`(UPDATE-only) → §4에서 cron UPSERT RPC로 분기 확장. |
| 현 cron route (selection) | `tudal/src/app/api/cron/monthly-batch/route.ts` (auth `:32-40`, mocks `:51-65`, GET `:109-139`, `persistForCron` `:67-75`) | **건드리지 않음** (selection 책임). auth 패턴(`isAuthorized`/`isProductionLikeForAuth`) + service-role 주입 패턴을 신규 worker route가 복제. |
| 비교 cron route (auth/service-role/alert 패턴) | `tudal/src/app/api/cron/silent-health/route.ts` | `createServiceRoleClient()` 1개 생성 → 모든 helper에 `{client}` 주입 패턴 reference. |
| service-role client | `tudal/src/lib/supabase/service-role.ts:25` (`createServiceRoleClient`), allow-list `:10-16` | cron worker가 사용. **신규 helper(getActiveShortList DI, insertPipelineHealth, cost-alert)를 allow-list에 등록 필수** (B17 boundary). |
| short_list_30 read | `tudal/src/lib/data/admin-shortlist.ts:138` (`getActiveShortList`) | **DI seam 부재** (`:141` hardcodes `createClient()`) → §4에서 `options.client?` 추가. worker가 30 rows(ticker/name/sector/suggestedWeight) 조회. |
| idempotency primitive | `tudal/src/lib/data/admin-reports.ts:172` (`reportExistsForMonth(ticker, monthDate)`) | skip/overwrite/create 결정 + resume cursor 보조. **completeness(section_0 AND section_7 non-null)까지 판별하도록 §4에서 overload 추가.** |
| 영구화 persist RPC (UPDATE-only) | `tudal/supabase/migrations/0022_update_report_sections_0_7.sql` (service_role bypass `:45-57`, grant `:92`, P0002 `:81`) | cron이 현재 사용. row 선행 필수 한계 → 신규 cron UPSERT RPC가 대체. |
| admin UPSERT RPC (옵션 A) | `tudal/supabase/migrations/0025_upsert_report_sections_0_7_admin.sql` (revoke service_role `:104`, preserve `:62-65`, ON CONFLICT `:77`) | **신규 cron UPSERT RPC의 패턴 원형** (service_role REVOKE → GRANT만 차이). admin RPC 자체는 불변. |
| 投심위 row 생성 RPC (PR5b) | `0017_cost_log_and_batch_runs.sql:124` (`commit_persona_eval`, grant `:210-212` authenticated-only) + `0019_commit_sector_personas.sql` | **PR5b**가 service_role grant + bypass 추가. PR5는 미변경. |
| partial unique index | `tudal/supabase/migrations/0003_*.sql:38-40` (`stock_reports_ticker_month_latest_uniq` WHERE is_latest=true) | cron UPSERT의 ON CONFLICT target. regen counters `:32-33`. **변경 없음.** |
| cost hardcap | `tudal/src/lib/cost/pricing.ts:66` (`HARDCAP_KRW=400_000`), `:112` (`ORCHESTRATE_TOTAL_COST_BUDGET_KRW`), `:110` comment(30×535≈16,050) | report-only cost SoT. **PR5b는 +750 call 별도 재추정 필요(주석으로 명시).** |
| cost helpers | `tudal/src/lib/cost/cost-logger.ts:31` (`insertCostLog`, NOOP unless `AI_COST_LOG_REAL_INSERT_ENABLED='true'`), `:55` (`getMonthlyTotal`), `:119` (`preflightHardcap`, throws `cost_hardcap_40man`) | batch preflight + per-call preflight. **flag off 시 getMonthlyTotal=0 → fail-open(§9 risk).** |
| **cost_log.called_by FK** | `0017_cost_log_and_batch_runs.sql:21` (`called_by uuid not null references auth.users(id)`), RLS `:35` (`called_by = auth.uid()`) | **sub-blocker**: cron엔 `auth.uid()` 없음 + `'cron-system'` 문자열은 uuid/FK 위반 → §3에서 해소. |
| alert insert + enum | `tudal/src/lib/data/admin-alerts-insert.ts:73` (`insertAlertEvents`), enum `:51-64` (**CLOSED 12종**), `buildSchedulerFailAlert` | summary/cost alert. **`report_generation_failed`는 enum에 없음 → 사용 금지(throw).** scheduler_fail/cost_warning/cost_hardcap만 재사용. |
| pipeline_health | `tudal/src/lib/data/admin-pipeline-health.ts` (read `getRecentPipelineHealth`만, **INSERT helper 없음**), `tudal/src/types/admin.ts:204` (`PipelineKind = dart\|news\|price\|ai\|alert`), `:205` (`PipelineStatus=success\|warning\|failed`) | **`pipeline='ai'` 유효 확인됨.** 신규 `insertPipelineHealth` helper 필요. service_role INSERT grant 검증. |
| batch lock 패턴 reference (selection 전용) | `tudal/src/lib/data/admin-batch-runs-cron.ts` (`acquireBatchLockCron`/`releaseBatchLockCron`), `0021_acquire_batch_lock_v2.sql` (service_role grant + `{acquired, resumed}` + stale reclaim) | **selection cron 전용** (month PK monthly_batch_runs). **report worker는 이 lock을 공유하지 않고**(HIGH-1) 동일 패턴의 **전용 `report_worker_run` mutex**(§4.1)를 신설해 invocation-level 직렬화(cost serialization + double-fire 차단, R2 HIGH-1). |
| section_8 schema | `tudal/src/lib/report/section-8-schema.ts:58` (`partD = z.array(coreVoteRowSchema).length(11)`) | PR5는 section_8을 **NULL로 둠**(Tier1-pending pill). PR5b가 채움. |
| vercel.json cron | `tudal/vercel.json` (`monthly-batch` = `5 0 1 * *`, daily-floor Hobby) | report-worker cron entry 추가 + worker route `maxDuration=300`. **production-impacting → USER 조율(deploy).** |
| 단일종목 admin caller (input shaping reference) | `tudal/src/app/(admin)/admin/portfolio/actions.ts:581` (`triggerFullReport`), `:504` (`triggerMonthlyBatch`) | worker의 `OrchestrateFullReportInput` shaping reference (B86 month, reportExists preflight). |
| plan-doc 패턴 | `docs/superpowers/plans/2026-05-28-task5-b66-c-hybrid-sector-mapper.md` + `2026-05-26-b65-p3-feature-flag-impl.md` | 본 plan 구조(header/§0~§9/부록) house style. |
| B65-P2 spec (옵션 A lock) | `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md` | overwrite-in-place + service_role REVOKE on admin RPC = 재오픈 금지. |
| HANDOFF / ServicePlan-Admin | `Document/Process/HANDOFF.md §2.1/§9.5` + `Document/Service/Planning/ServicePlan-Admin.md §1A.0 D11` + UA1 | PR5/PR5b 시퀀스 + D11 게이트 + Accept/Reject 모델 SoT. |

---

## 2. Sequence overview

```
Phase A — DB (마이그 0027, report-only scope)
  1. report_batch_job(per-ticker) + report_worker_run(run-mutex) 테이블 + rollback  (CLAUDE)
  2. claim_next_report_jobs RPC (atomic claim, SKIP LOCKED, stale reclaim, attempts<3, 내부 guard)  (CLAUDE)
  3. mark_report_job RPC (내부 service_role/is_admin guard)        (CLAUDE)
  3b. acquire(→run_id)/release(run_id fencing) report_worker_lock RPC (전용 run-mutex, R2 HIGH-1 + R3 MEDIUM-1)  (CLAUDE)
  4. upsert_report_sections_0_7_cron RPC (service_role UPSERT)    (CLAUDE)
  5. pipeline_health service_role INSERT grant 검증/추가          (CLAUDE)
     (cost_log.called_by = reserved 'cron-system' UUID로 해소 — schema 미변경, USER 1회 auth.users seed)

Phase B — data-layer DI seams + helpers
  7. getActiveShortList options.client? DI seam                   (CLAUDE)
  8. reportExistsAndCompleteForMonth overload (section_0 AND section_7 completeness) (CLAUDE)
  9. insertPipelineHealth(row, {client}) helper                   (CLAUDE)
 10. emitCostAlert(cost_warning/cost_hardcap) helper              (CLAUDE)
 11. retryWithBackoff (pure, inject sleep) + transient classifier (CLAUDE)
 12. service-role.ts allow-list에 7~10 등록                       (CLAUDE)

Phase C — orchestrator cron-upsert 분기
 13. orchestrateFullReport rpcName branch에 cron UPSERT 추가       (CLAUDE)

Phase D — worker + route
 14. full-report-batch-worker.ts (sequential loop driver)         (CLAUDE)
 15. report-worker/route.ts (auth + flag gate + report_batch_job claim + optional self-continue) (CLAUDE)
 16. vercel.json: report-worker DAILY cron entry(primary advance) + maxDuration=300  (CLAUDE; USER deploy 조율)
 17. triggerReportWorker admin server action (manual re-trigger)  (CLAUDE)

Phase E — 검증
 18. TDD invariants (§6) + grep gate (§7)                         (CLAUDE)
 19. build + lint + test:ci + tsc 게이트                          (CLAUDE)
 20. OMXY R-debate (catch-only) CONVERGED                         (OMXY)
```

**per-ticker 결정 step (worker 내부, §4 + B-versioning lock)**: 각 종목마다 `orchestrateFullReport` 호출 **전** latest (ticker,month) row를 읽어 — (a) **SKIP** row 존재 AND **section_0 AND section_7 모두 non-null**(완성 — MEDIUM-1 fix: cron UPSERT가 section_0~7을 atomic write하므로 양끝 검사로 partial row 식별) → LLM 0, cost 0; (b) **OVERWRITE** row 존재하나 incomplete(예: PR5b screening이 section_8만 채운 row, 또는 직전 partial) → in-place 갱신; (c) **CREATE** row 부재 → cron UPSERT RPC가 INSERT(section_0~7, section_8 NULL). 이 step이 resume predicate를 겸한다.

---

## 3. 설계 결정 lock-in (Workflow design panel CONVERGED + sub-decisions)

### 3.1 Queue 인프라 = β2′ 자체 DB job queue (NOT β1 Vercel Queues, NOT β3)

**문제**: 30종목 × (writer Opus ~30-120s + critic Haiku + 조건부 revise Opus) ≫ Vercel 300s 단일 invocation. Hobby plan cron = daily-floor → tight re-fire 불가.

**결정 (HIGH-1 + MEDIUM-3 fix 반영)**: `report_batch_job` 테이블 + chunked(N=3~5) idempotent worker. **chunk-advance primary = 별도 DAILY cron**(report-worker 전용 endpoint, deterministic): 매일 N개 pending/stale job을 claim·처리 → 30/N ≈ 6일이면 월내 완료(idempotent skip). monthly fire는 그 달의 첫 daily(또는 cold-start enqueue)일 뿐. **self-continuation(`after()`/`waitUntil`)은 optional accelerator**(같은 invocation에서 chunk를 더 처리) — **load-bearing 아님**(waitUntil은 function timeout과 함께 취소될 수 있음, Vercel docs 확인 — MEDIUM-3). 즉 정확성은 daily cron + idempotent claim에만 의존, platform 가정 무관.

**worker concurrency guard (HIGH-1 R1+R2 fix — 2-layer)**:
- **Layer 1 = 전용 run-mutex `report_worker_run`**(§4.1, R2 HIGH-1 fix). report worker는 **selection의 `monthly_batch_runs` lock을 공유하지 않고**(R1 HIGH-1 — month PK 충돌 차단) **별도 단일-row mutex**를 잡는다. worker 진입 시 atomic acquire(ON CONFLICT + stale reclaim); 다른 non-stale worker가 보유 중이면 **200 skip**(spend 0). 이 mutex가 report-worker invocation을 **직렬화** → 동시 invocation의 `preflightHardcap`(read-then-check, 원자 reservation 없음 — cost-logger.ts:119-137) **race를 차단**(R2 HIGH-1: claim SKIP LOCKED는 중복 row만 막고 cost 직렬화는 못 함). double-fire(daily cron + manual)도 차단.
- **Layer 2 = `report_batch_job` claim**(`claim_next_report_jobs` = `FOR UPDATE SKIP LOCKED` + `status='running'` + `claimed_at<now()-10min` stale reclaim + **`attempts < 3`** filter[R2 MEDIUM-1]). per-ticker 진행/resume 상태. Layer 1로 단일 worker가 보장되므로 SKIP LOCKED는 belt-and-suspenders.
- selection의 `monthly_batch_runs`/`acquire_batch_lock_v2`는 **미사용·미변경**.

**기각**: β1(Vercel Queues) = public beta를 production money-path에 거는 것은 프로젝트 caution 정책 위반 + USER-only 외부 provisioning(self-verify 불가, Hobby 미지원 가능) + at-least-once delivery는 어차피 idempotent skip을 요구하므로 worker-loop만 절약. β3(single-invocation fan-out) = 30×Opus 8192tok ≫ 300s 수학적 불가 — 명시 기각하여 R-debate re-litigate 차단.

**Hobby cron count (impl 검증)**: 현 `vercel.json` 4 cron(monthly-batch/morning-briefing/news-sweep/silent-health). report-worker daily entry 추가 시 plan tier cron 한도 확인(초과 시 기존 daily cron 1개가 pending 존재 시 report-worker advance 호출하도록 piggyback, 또는 plan 상향). **USER deploy 조율.**

### 3.2 B79 RPC 책임 boundary = Option C PHASED (PR5 report-only / PR5b committee votes, D11 전 land)

**확정**: PR5 = `orchestrateFullReport` 재사용 = **Section 0~7 + Appendix only**. committee_votes + Section 8 partA/C/D = **PR5b**.

**근거 (3 load-bearing facts)**:
1. **cost 정합**: `ORCHESTRATE_TOTAL_COST_BUDGET_KRW`(~535/종목, pricing.ts:112) = writer+critic+revise만. 주석(:110) "30×535≈16,050/월=4.0%"는 **full-report 69 call만** 계산. full path = `runTier1Screening` 30×11 Core(330 call) + `runSectorEval` ~14/종목(~420 call) = **+750 call ≈ 5-10x**, locked 추정 밖. PR5에 bolt-on 시 OMXY가 이미 CONVERGED한 cost model을 silent하게 깨뜨림 → 별도 PR로 분리 + 재추정.
2. **D11이 Section 8을 genuinely 필요로 함**: ServicePlan-Admin Accept/Reject 모델 + UA1(투심위 2-Layer = Core 11 + Sector Board 찬반·논거 = unfair advantage). section_0~7-only + Tier1-pending pill로는 의미있는 Accept/Reject 불가 → **pure A(영구 report-only)는 unacceptable terminal state**. 그래서 **PR5b는 committed fast-follow(D11 전 hard gate)**.
3. **full-path surface가 크고 B79 deferred boundary를 넘음**: `commit_persona_eval`(0017) + `commit_sector_personas`(0019) = authenticated-only + `auth.uid()` hard-raise → service_role grant + body bypass branch(CREATE OR REPLACE) 마이그 + `writer.ts` 3개 hardcoded `createClient()` DI seam + Tier 1 lock wire = 두 번째 마이그 + multi-file refactor + 두 번째 queue 문제(330+ call). 한 PR에 cram 시 blocker surface·review risk 최대화.

**pure B(전부 PR5) 기각**: 마이그 2배 + locked cost 초과 + 두 독립 queue 문제 stack. **C가 유일하게** 지금 검증가능 가치(auto section_0~7) 출하 + committee votes를 committed·gated path(D11 전)로.

### 3.3 row 생성 수단 = 신규 cron UPSERT RPC `upsert_report_sections_0_7_cron` (NOT skeleton-INSERT)

**문제**: cron(`callerKind:'cron'`)은 `update_report_sections_0_7`(UPDATE-only) 사용 → fresh month엔 row 부재 → `report_not_found_for_section_0_7_update`(P0002) throw. 이것이 **B65/B67 report-path 근본원인**.

**결정 (sub-decision, OMXY 검토 권장)**: 0025 admin UPSERT를 본떠 **service_role 버전** RPC 신설. `orchestrateFullReport`의 rpcName branch(:246-251)를 3-way로 확장: `admin+flag → upsert_admin` / **`cron+flag → upsert_cron`** / `else → update`(불변).

**대안 기각 사유**: (대안) `create_report_skeleton(ticker,month)` INSERT 후 기존 update 사용 — orchestrateFullReport를 안 건드리는 장점이 있으나, **빈 row transient**(orchestrate 실패 시 section_0~7 NULL row 잔존) + reportExistsForMonth가 row 존재만으로 done 오판할 위험. UPSERT는 **atomic**(section_0~7 준비된 1회 write, 실패 시 row 미생성 → 재시도 깨끗) + idempotency-safe. orchestrateFullReport 변경은 기존 branch의 **surgical 확장**(검증된 패턴). → **UPSERT 채택**.

**UPSERT 보존 invariant (0025:62-65 패턴 동일)**: UPDATE 분기에서 `section_8`/`consensus_badge`/`version`/`schema_version`/`is_latest`/`regen_auto_count`/`regen_manual_count` 미터치(PR5b가 채운 section_8을 cron 재실행이 덮지 않도록). INSERT 시 이들은 NULL/default.

### 3.4 versioning = overwrite-in-place (schema 변경 0)

**확정**: B65-P2 옵션 A lock(0025:8) 정합. `version`/`schema_version`/`is_latest`/`regen_*` 불변. 월별 재실행은 같은 (ticker,month) row를 ON CONFLICT WHERE is_latest=true DO UPDATE로 overwrite — **second versioned row 생성 금지**. distinct month = distinct row.

**idempotency rule (per-ticker)**: SKIP(section_0 AND section_7 완성) / OVERWRITE(row 존재하나 incomplete) / CREATE(row 부재, cron UPSERT가 INSERT). **SKIP predicate는 row 존재가 아닌 section_0 AND section_7 완성도로 판정**(MEDIUM-1) — screening/PR5b가 section_8만 채운 row, 또는 section_0만 있는 partial을 bare existence로 skip하면 본문 영구 누락(§9 R8). → `reportExistsAndCompleteForMonth`(§4) 도입.

**버전 history 불필요 근거**: Track Record/portfolio_snapshot은 stock_reports versioning과 decoupled(snapshot은 short_list_30 acceptance에서 파생). regen counters(0003:32-33)는 admin regen page cadence 전용 → cron이 건드리면 CAS race test 의미 훼손.

### 3.5 실패 격리 + cost preflight + auth + 관측 = Option A

- **격리 = sequential `for...of`** (NOT `Promise.allSettled`). 이유(correctness): 병렬 호출은 모두 동일 pre-spend `getMonthlyTotal`을 읽고 각자 535만 reserve → N 병렬이 `HARDCAP_KRW`를 초과해도 단일 preflight가 안 걸림 = **locked cost 제약 위반**. sequential만 running-total gate 보존. (allSettled의 **결과 shape**(`{ticker,status,reason}`)는 유지, concurrency만 제거.)
- **retry**: N=2 (총 3회), exponential backoff 2000→8000ms(factor 2 cap) + jitter, **transient만**(`full_report_llm_failed`[full-report-client.ts:60] / `critic_llm_failed`[critic-client.ts:87] / `revise_llm_failed`[revise-client.ts:65] / 429/529/network — thrown message match. **MEDIUM-2 fix: critic/revise 코드 추가**). non-transient: `ai_key_unavailable`/`cost_hardcap_40man` = **batch 전체 abort**(systemic); `report_not_found_for_section_0_7_update`(이론상 cron UPSERT로는 미발생) = 단일 종목 isolate. **retry 재spend 주의(MEDIUM-2)**: retry는 `orchestrateFullReport` 전체를 재실행하므로 16,050(no-retry projection)을 넘을 수 있다. per-call `preflightHardcap`이 매 attempt 누적 cost를 검사해 400k를 **근사(best-effort) 보장**하나 strict ceiling은 아님(R4 MEDIUM-2: 535는 projection / unlogged-spend window 존재). N=2로 worst-case bounded.
- **batch preflight**: worker 진입 시 `preflightHardcap({month, callCount: remaining, maxCostPerCallKrw: ORCHESTRATE_TOTAL_COST_BUDGET_KRW}, {client})`. `remaining = 30 - done`(resume 중복 reserve 방지). 초과 시 `cost_hardcap` alert + abort.
- **auth**: 기존 `CRON_SECRET` Bearer + `isProductionLikeForAuth` fail-closed 복제(4개 cron route 동일, Vercel이 자동 주입 → x-vercel-cron 불필요).
- **관측**: (a) `insertPipelineHealth(pipeline='ai', status= successRate≥1.0 ? 'success' : 'failed', error='X/30 succeeded, Y failed: [...]')` 1 row/run. (b) summary alert = 전 종목 성공이면 **alert 0**; 1건이라도 실패/abort면 `scheduler_fail`(critical, `buildSchedulerFailAlert` 재사용). (c) cost: `cost_warning`(warning, `COST_WARNING_THRESHOLD_KRW=350_000` — 신설 상수) + `cost_hardcap`(critical). (d) **B78**: section parse null-drop = `console.error('report_section_null_drop',{ticker,section,month})` 구조화(greppable), **신규 alert_event type 금지**.
- **alert_event enum CLOSED 12종**(admin-alerts-insert.ts:51-64): `report_generation_failed` 발명 금지(throw `alert_event_invalid_type`). per-ticker 실패 = `console.error`만. grep gate: `rg 'report_generation_failed' src/` = 0.

### 3.6 cost_log.called_by FK sub-blocker (필수 해소)

**문제 (확정)**: `cost_log.called_by uuid not null references auth.users(id)`(0017:21). cron은 `auth.uid()` 없음 + 현 route가 넘기는 `adminUserId:'cron-system'`(route.ts:118)은 **문자열 → uuid 타입/FK 위반**. service_role가 RLS를 bypass해도 **FK는 적용**됨. → `AI_COST_LOG_REAL_INSERT_ENABLED=true` 첫 실 cron run의 첫 `insertCostLog`에서 throw → batch 전체 실패.

**해소 (HIGH-3 fix — reserved UUID로 전환)**: **= reserved 'cron-system' `auth.users` UUID**. USER가 Supabase에 system user(예: 전용 이메일 `cron-system@internal`, 고정 UUID) 1회 seed → 그 UUID를 env `CRON_SYSTEM_USER_ID`(또는 상수)로 보관 → worker가 `adminUserId = process.env.CRON_SYSTEM_USER_ID`로 전달. **`adminUserId: string` 체인(orchestrator input:41 / full-report-client:26 / critic-client:55 / revise-client:34 / `called_by: input.adminUserId`)을 전혀 바꾸지 않음** + **`cost_log` schema 미변경**. cost_log.called_by FK·RLS(`called_by=auth.uid()`는 authenticated INSERT용 WITH CHECK이며 service_role INSERT는 RLS bypass) 모두 만족.

> **왜 nullable relax를 기각했나(HIGH-3 omxy catch)**: `called_by=NULL` 방식은 `adminUserId: string` 전 체인을 `string | null`로 바꿔야 하고(orchestrator + 3 AI client + insertCostLog) cost_log schema도 건드려 surface가 더 크다. reserved UUID는 코드/스키마 churn 0 + cron cost를 명시 system user로 attribution. → reserved UUID 채택.
>
> ⚠️ `auth.users` system user seed = **USER/Supabase-admin 1회 op**(production external). `CRON_SYSTEM_USER_ID` env도 USER-only.
>
> **fail-closed 선행 검증 (R2 HIGH-2 + R3 MEDIUM-2 fix)**: `insertCostLog`는 `callFullReport`가 **Anthropic 호출 후** 실행(full-report-client.ts:80-91)되므로, `CRON_SYSTEM_USER_ID`가 없거나 무효(또는 auth.users 부재)면 **~236원 writer spend 후** FK throw로 batch가 깨진다. → worker 진입 시(C8 step 0, **첫 LLM 호출 전**) 검증: (1) `CRON_SYSTEM_USER_ID` 존재 + UUID 형식, (2) **auth.users 존재**는 `supabase.auth.admin.getUserById(id)`(service-role admin API) **또는 신규 SECURITY DEFINER RPC `validate_cron_system_user(p_id)`** 로 확인(**R3 MEDIUM-2: `createServiceRoleClient`는 schema='public' default라 `.from('auth.users')` 불가** — admin API/RPC 필수). 무효 시 abort + alert(spend 0). impl PR + USER 체크리스트(seed + env)에 명시.

### 3.7 feature flag = `PR5_CRON_AUTO_ENABLED` (default false)

worker route GET: auth 통과 후 `process.env.PR5_CRON_AUTO_ENABLED === 'true'` 아니면 **200 `{ok:true, skipped:true, reason:'pr5_cron_auto_disabled'}`**(502 아님 — dormant ≠ failure, lock 미취득, spend 0). flag-off cron이 매월 scheduler_fail로 spam하지 않도록 200-skip. `PR4_TRIGGER_UPSERT_ENABLED`(admin path)은 불변. **실 가동 = USER가 `PR5_CRON_AUTO_ENABLED=true` + `AI_COST_LOG_REAL_INSERT_ENABLED=true` + `ANTHROPIC_API_KEY` 설정 시** (모두 USER-only Vercel env).

---

## 4. 마이그 0027 + 코드 변경 (상세)

### 4.1 마이그 0027 (paired `.sql` + `.rollback.sql`, report-only scope)

> **모든 신규 SECURITY DEFINER RPC**(claim_next_report_jobs / mark_report_job / acquire_report_worker_lock / release_report_worker_lock / upsert_report_sections_0_7_cron — **5개**; cron-system user 검증은 admin API라 RPC 아님, R4 MEDIUM-1)는 grant 3종 세트(memory [[feedback_supabase_security_definer_pattern]] + 0021/0022 패턴): `revoke all from public` + `revoke all from anon` + `grant authenticated` + `grant service_role`(cron-callable) + `set search_path=public, pg_temp` + **내부 auth guard(service_role bypass / else is_admin())**. **CREATE OR REPLACE는 과거 grant를 보존하므로 명시 REVOKE 필수**(omxy R1 Kepler B2 lesson). 0027은 `commit_persona_eval`/`commit_sector_personas` grant를 **건드리지 않음**(=PR5b/0028) + cost_log/versioning 컬럼/partial unique index **미변경**.
>
> **마이그 surface note (R3 Q3 + R4 MEDIUM-1)**: 2 테이블(report_batch_job per-ticker + report_worker_run run-mutex) + **5 RPC**(claim/mark/acquire/release/upsert_cron)는 "resumable cron + cost-serialized + idempotent + fencing-safe" 요구의 irreducible surface — 각 항목이 catch(R2 HIGH-1 mutex / R2 MEDIUM-1 attempts / R3 MEDIUM-1 fencing)에 1:1 대응. cron-system user 검증은 admin API(RPC 아님). 단일 마이그로 묶되 section 주석으로 구분.

`0027_pr5_report_batch.sql` 구성 (실제 SQL은 impl 단계 작성, 본 plan은 명세):

1. **TABLE `public.report_batch_job`**:
   ```
   id uuid primary key default gen_random_uuid()
   month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$')
   ticker text not null check (ticker ~ '^[0-9]{6}$')          -- TICKER_RE 6-digit invariant 재사용
   status text not null default 'pending'
     check (status in ('pending','running','done','failed','deferred'))  -- deferred = cost-hardcap stop
   attempts int not null default 0
   last_error text
   report_id uuid null references public.stock_reports(id)
   claimed_at timestamptz null                                  -- visibility timeout: stale 'running' reclaim
   started_at timestamptz null
   finished_at timestamptz null
   created_at timestamptz not null default now()
   unique (month, ticker)                                       -- 1 job/종목/월, ON CONFLICT DO NOTHING enqueue
   ```
   + `index (month, status)` + RLS enable: `select` policy `using (public.is_admin())`(admin 조회) — service_role는 RLS bypass.

2. **RPC `public.claim_next_report_jobs(p_month text, p_limit int)` returns setof report_batch_job**:
   **내부 auth guard 필수 (HIGH-2 fix, 0021:37-45/0022:45-57 패턴)**: `if coalesce((select auth.role()),'')='service_role' then null; else if auth.uid() is null then raise 'auth_unavailable'; if not public.is_admin() then raise 'admin_required'; end if;` — SECURITY DEFINER + authenticated grant이므로 내부 guard 없으면 비-admin authenticated가 queue 조작 가능. **선행 sweep (R2 MEDIUM-1)**: `update report_batch_job set status='failed', last_error='attempts_exhausted' where month=p_month and status='running' and claimed_at < now()-interval '10 minutes' and attempts >= 3;` (stale running at max → 영구 failed, 무한 reclaim 차단). atomic claim — `update report_batch_job set status='running', claimed_at=now(), attempts=attempts+1 where month=p_month and **attempts < 3** and (status='pending' or (status='running' and claimed_at < now() - interval '10 minutes')) and id in (select id from report_batch_job where month=p_month and attempts < 3 and (status='pending' or (status='running' and claimed_at < now()-interval '10 minutes')) order by ticker limit p_limit for update skip locked) returning *`. **`attempts < 3` filter(R2 MEDIUM-1)**로 cap 초과 row는 재claim 안 됨. SECURITY DEFINER + search_path. 4-grant(revoke public/anon + grant authenticated + grant service_role). **`p_limit`는 양의 정수 guard + cap(예: ≤ 30).**

2b. **RPC `public.acquire_report_worker_lock(p_month text) returns uuid` / `public.release_report_worker_lock(p_month text, p_run_id uuid, p_status text)` (R2 HIGH-1 + R3 MEDIUM-1 fencing fix — 전용 run-mutex, selection과 분리)**: 신규 단일-row-per-month 테이블 `public.report_worker_run(month text primary key, run_id uuid, status text check in('running','succeeded','failed'), claimed_at timestamptz, finished_at timestamptz, created_at timestamptz default now())`. acquire = atomic `insert into report_worker_run(month,run_id,status,claimed_at) values(p_month, gen_random_uuid(), 'running', now()) on conflict(month) do update set run_id=gen_random_uuid(), status='running', claimed_at=now(), finished_at=null where report_worker_run.status<>'running' or report_worker_run.claimed_at < now()-interval '15 minutes' returning run_id` (R4 LOW-1: 재획득 시 `finished_at=null` reset — running row에 old finished_at 잔존 방지) — **run_id 반환 시 acquired**, NULL이면 다른 non-stale worker 보유 중(→ 200 skip). **release는 fencing-safe**: `update report_worker_run set status=p_status, finished_at=now() where month=p_month and run_id=p_run_id` — **`run_id` 일치 owner만 release**(R3 MEDIUM-1: stale reclaim 후 늦게 깨어난 old worker가 p_run_id 불일치로 no-op → new owner 상태 미손상). 내부 auth guard(service_role bypass/is_admin) + SECURITY DEFINER + search_path + 4-grant(+service_role). **monthly_batch_runs와 별개 테이블**이므로 selection lock 무충돌. stale reclaim(15min)으로 crashed worker 자동 회수.

3. **RPC `public.mark_report_job(p_id uuid, p_status text, p_report_id uuid, p_error text) returns void**: **내부 auth guard 동일(HIGH-2 fix — service_role bypass / else is_admin())**. `status`/`finished_at=now()`/`last_error`/`report_id` set. `p_status` enum guard. SECURITY DEFINER + search_path + 4-grant(+service_role).

4. **RPC `public.upsert_report_sections_0_7_cron(p_ticker text, p_month text, p_section_0..p_section_7 jsonb, p_appendix jsonb) returns json`** (0025 admin UPSERT의 service_role 버전):
   - input regex guard(`^[0-9]{6}$` ticker / `^[0-9]{4}-[0-9]{2}$` month) — 0025 동일.
   - auth: **`coalesce(auth.role(),'')='service_role'` → bypass**(0022:45-57 패턴); else `auth.uid()` + `is_admin()` (방어적, 실 호출은 service_role).
   - `insert ... on conflict (ticker, month) where is_latest=true do update set section_0..7=excluded.*, appendix=excluded.appendix, generated_at=now()` — **section_8/consensus_badge/version/schema_version/is_latest/regen_* 미터치**(0025:62-88 동일). returning id.
   - SECURITY DEFINER + search_path + 4-grant: `revoke public/anon` + `grant authenticated` + **`grant service_role`**(0025와의 유일한 차이) + comment.

5. **`cost_log` schema 변경 없음 (HIGH-3 fix)**: called_by FK는 **reserved 'cron-system' auth.users UUID**(§3.6)로 해소 — 마이그 0027은 cost_log를 건드리지 않는다. (auth.users system user seed는 USER/Supabase-admin 1회 op, env `CRON_SYSTEM_USER_ID` USER-only.) ~~nullable relax~~ 기각.

6. **`pipeline_health` service_role INSERT grant 검증**: 현 정책이 authenticated-only면 `grant insert on public.pipeline_health to service_role`(또는 RLS insert policy) 추가. (read는 이미 존재.) **impl 단계에서 `pg_policies`/`information_schema.role_table_grants`로 현황 확인 후 필요 시만 추가.**

7. **cron-system user 검증 = `supabase.auth.admin.getUserById(CRON_SYSTEM_USER_ID)` admin API (R3 MEDIUM-2 + R4 MEDIUM-1 LOCK)**: worker step 0이 service-role admin API로 존재 확인 — **신규 RPC 불요**(surface 축소: 0027 = 5 RPC). `.from('auth.users')`는 `createServiceRoleClient` schema='public' default라 불가하므로 admin API로 lock. (~~validate_cron_system_user SECURITY DEFINER RPC 대안 기각~~ — admin API가 더 적은 migration surface.)

`0027_pr5_report_batch.rollback.sql`: claim/mark/acquire_report_worker_lock/release_report_worker_lock/upsert_cron RPC drop + report_batch_job + report_worker_run 테이블 drop + pipeline_health grant 회수. (cost_log 미변경이므로 rollback 대상 아님.)

### 4.2 코드 변경 (TDD 순서는 §6)

| # | 파일 | 변경 |
|---|---|---|
| C1 | `src/lib/data/admin-shortlist.ts:138` | `getActiveShortList(options?: { month?: string; tickerMeta?: TickerMetaLookup; client?: SupabaseClient })` — `const supabase = options?.client ?? (await createClient())`. 기존 caller 무영향(2nd 필드 추가). |
| C2 | `src/lib/data/admin-reports.ts` (near `:172`) | 신규 overload `reportExistsAndCompleteForMonth(ticker, monthDate, options?: {client?})`: latest row의 `id` + `section_0` + `section_7` select → `{ exists, complete }`(**complete = `section_0 != null && section_7 != null`** — MEDIUM-1 fix: cron UPSERT가 section_0~7 atomic write하므로 양끝 검사로 section_0만 채워진 partial/non-cron row 오skip 차단). 기존 `reportExistsForMonth` 불변. |
| C3 | `src/lib/data/admin-pipeline-health-insert.ts` (신규) | `insertPipelineHealth(row: Omit<PipelineHealth,'id'>, options: { client?: SupabaseClient } = {})` — `insertAlertEvents` DI 패턴(admin-alerts-insert.ts:73). `pipeline` ∈ PipelineKind guard(`'ai'`). |
| C4 | `src/lib/data/admin-cost-alerts.ts` (신규 또는 admin-alerts-insert.ts 확장) | `emitCostAlert(kind:'warning'\|'hardcap', ctx, options)` → `insertAlertEvents`로 `cost_warning`(warning)/`cost_hardcap`(critical). enum 內 type만. |
| C5 | `src/lib/report/retry-with-backoff.ts` (신규, pure) | `retryWithBackoff(fn, {retries, baseMs, capMs, isTransient, sleep})` — sleep 주입(deterministic test). `isTransient(err)` = message가 **`full_report_llm_failed` / `critic_llm_failed` / `revise_llm_failed` / 429/529/network** match (MEDIUM-2 fix — critic/revise LLM 실패 코드 포함). `ai_key_unavailable`/`cost_hardcap_40man`은 non-transient(false). |
| C6 | `src/lib/cost/pricing.ts` | `export const COST_WARNING_THRESHOLD_KRW = 350_000;` (신규 상수, HARDCAP_KRW=400_000 대비). |
| C7 | `src/lib/report/full-report-orchestrator.ts:246-251` | rpcName branch 3-way 확장: `const upsertCron = options.callerKind==='cron' && process.env.PR5_CRON_AUTO_ENABLED==='true';` → `rpcName = upsertEnabled ? 'upsert_report_sections_0_7_admin' : upsertCron ? 'upsert_report_sections_0_7_cron' : 'update_report_sections_0_7'`. error guard(:266-279)에 `upsert_report_sections_0_7_cron` 분기 추가(cross-path literal leak 차단, R1 Schop B3 패턴). admin path 회귀 0(callerKind 다름). |
| C8 | `src/lib/report/full-report-batch-worker.ts` (신규) | sequential loop driver(NOT allSettled): **(0) fail-closed 선행 검증(R2 HIGH-2 + R3 HIGH-1 + R3 MEDIUM-2, 첫 LLM 호출 전)**: (a) `CRON_SYSTEM_USER_ID` 존재 + UUID 형식 + auth.users 존재(`supabase.auth.admin.getUserById` admin API — `.from('auth.users')` 불가, R4 MEDIUM-1 lock) / (b) **`AI_COST_LOG_REAL_INSERT_ENABLED === 'true'` 강제(R3 HIGH-1)** — false면 insertCostLog noop → cost_log 0 → preflightHardcap fail-open으로 400k hardcap 미보장이므로 **LLM 호출 전 abort + alert**(spend 0); → `getActiveShortList({month, client: serviceRoleClient})` → **enqueue idempotent**(`report_batch_job` ON CONFLICT DO NOTHING) → batch `preflightHardcap({month, callCount: remaining, ...}, {client})` → `claim_next_report_jobs(month, CHUNK_N)` → 각 job: `reportExistsAndCompleteForMonth`(section_0 AND section_7) SKIP+`mark_report_job(done)` / 아니면 `retryWithBackoff(()=>orchestrateFullReport(input, {client: serviceRoleClient, callerKind:'cron'}), {...})` → `mark_report_job(done/failed)` → 결과 누적 → `insertPipelineHealth` + 조건부 summary `scheduler_fail`. cost_hardcap throw 시 remaining 'deferred' + `cost_hardcap` alert + STOP. **run-mutex는 C9가 보유**(단일 worker 보장 → preflight cost 직렬화, R2 HIGH-1). input shaping = `triggerFullReport`(actions.ts:581)(**`adminUserId = process.env.CRON_SYSTEM_USER_ID` reserved UUID — §3.6/HIGH-3**, `tier1Verdict`/`consensusBadge`는 short_list_30 row source, 없으면 `'HOLD'`/`'⚪'` stub). |
| C9 | `src/app/api/cron/monthly-batch/report-worker/route.ts` (신규) | `runtime='nodejs'`, `dynamic='force-dynamic'`. `isAuthorized`(CRON_SECRET, route.ts:32-40 복제) → `PR5_CRON_AUTO_ENABLED` gate(200-skip) → **`acquire_report_worker_lock(month)` → run_id**(R2 HIGH-1 전용 run-mutex; run_id NULL이면 200 `{skipped:'already_running'}`, spend 0) → worker 1 chunk(C8) → **`release_report_worker_lock(month, run_id, status)`**(finally; R3 MEDIUM-1 fencing — run_id owner만 release). **selection의 `acquireBatchLockCron`/monthly_batch_runs 미사용(R1 HIGH-1)** — 별도 `report_worker_run` mutex. **chunk-advance primary = DAILY cron 재호출**(deterministic, idempotent; stale reclaim으로 crashed run 회수). pending 남으면 **optional** self-continue(`after()`/`waitUntil` + Bearer fetch) + 202 (best-effort, waitUntil 취소 가능 — MEDIUM-3, 정확성 비의존); 없으면 200. **Next.js 16 route handler + after()/waitUntil 사용 전 `node_modules/next/dist/docs/` 또는 context7 확인.** |
| C10 | `tudal/vercel.json` | **report-worker DAILY cron entry**(primary chunk-advance, 예 `0 1 * * *`) + `functions` `maxDuration:300`(worker route). monthly fire는 그 달 첫 daily로 충분(별도 monthly entry 불필요). **Hobby cron count 한도 impl 검증**(현 4 cron → 5; 초과 시 기존 daily cron piggyback 또는 plan 상향). **production-impacting → USER deploy 조율.** |
| C11 | `src/app/(admin)/admin/portfolio/actions.ts` | `triggerReportWorker(input:{month})` admin server action — 수동 re-trigger(dead-chain 복구). **반드시 report-worker route를 authenticated fetch로 호출**(Bearer CRON_SECRET) — 즉 flag+run-mutex+UUID/cost preflight를 모두 통과(R3 HIGH-2: claim 직접 호출로 run-mutex 우회 금지 — 우회 시 daily cron과 동시 실행되어 cost serialization 깨짐). `is_admin` rpc assertion(B-trackrecord-rls 패턴, `from('admin_emails')` 직접 SELECT 금지) 후 route fetch. |
| C12 | `src/lib/supabase/service-role.ts:10-16` | allow-list comment에 신규 cron-사용 helper 등록: `admin-shortlist.ts`(getActiveShortList DI), `admin-pipeline-health-insert.ts`, `admin-cost-alerts.ts`, `full-report-batch-worker.ts`, `report-worker/**`. |
| C13 | `src/lib/data/admin-reports.ts` B78 | cron path section null-drop을 `console.warn` → `console.error('report_section_null_drop',{ticker,section,month})` 구조화. (orchestrator parseAndValidate(full-report-orchestrator.ts:115-128)는 이미 console.warn — cron 호출 시 greppable error로.) |
| C14 | `src/lib/data/format-error.ts` | UI 노출 신규 throw code 매핑(예: `batch_preflight_failed`, `pr5_cron_auto_disabled`는 skip이라 불필요). 한국어 매핑. |

---

## 4.3 impl status (61차 — 사용자 결정 "impl 코드 작성 + omxy 실코드 리뷰", branch `feat/pr5-cron-monthly-report-worker`)

**구현 완료 (C1~C10 + 마이그 0027 + 테스트)**: 마이그 0027 (report_batch_job + report_worker_run + claim/mark/acquire/release/upsert_cron 5 RPC, run_id fencing + attempts<3 sweep + cron UPSERT) + rollback / C1 getActiveShortList DI / C2 reportExistsAndCompleteForMonth(section_0 AND section_7) / C3 insertPipelineHealth / C4 emitCostAlert / C5 retryWithBackoff(critic/revise transient) / C6 COST_WARNING_THRESHOLD_KRW / C7 orchestrator cron-upsert 3-way branch / C8 full-report-batch-worker(step-0 fail-closed: cost flag + CRON_SYSTEM_USER_ID UUID + auth.users admin API / 순차 / retry / systemic abort / cost_hardcap deferred / runGuardedReportChunk run-mutex wrapper) / C9 report-worker route(auth + flag + mutex + optional self-continue env-gated) / C10 vercel.json(daily cron + maxDuration 300) / C12 service-role allow-list. **테스트 +23** (retry-with-backoff 11 + worker 8 + route 4 — wait 실측: 3 files 23 tests). 검증 게이트: build 26 routes / lint 0 err / **test:ci 121 files 1348 PASS** / tsc clean. grep gate clean.

**미세 편차 (surgical, 사유 박제)**:
- **pipeline_health service_role INSERT grant**: 0027에서 **drop** — service_role은 RLS bypass + Supabase 기본 table grant 보유(기존 cron INSERT helper heartbeat_log/alert_event/news_event/briefing_log 동일 패턴으로 작동 중). 신규 grant 불필요 검증 → surface 축소.
- **validate_cron_system_user RPC**: 미생성 — `supabase.auth.admin.getUserById` admin API 사용(R4 MEDIUM-1 lock). 0027 = 5 RPC.

**defer → follow-up ticket (surgical 유지, 사유)**:
- **C11 `triggerReportWorker` admin action → `W-pr5-admin-trigger`**: `portfolio/actions.ts`는 service-role.ts B17 boundary상 `createServiceRoleClient` 금지(session-only). admin manual re-trigger는 (a) route authenticated fetch(self-URL fragility) 또는 (b) boundary 예외가 필요. **daily cron + stale reclaim(15min)이 이미 dead-chain recovery 처리**하므로 manual trigger는 convenience → defer. R3-HIGH-2(mutex 우회 금지)는 admin trigger 부재로 moot. `runGuardedReportChunk` 공용 wrapper는 이미 구현(향후 C11 재개 시 재사용).
- **C13 admin-reports B78 console.warn→error → `W-pr5-b78-render-log`**: cron 경로는 orchestrate 실패 시 **throw → worker가 구조화 console.error(`ticker_full_report_failed`) + report_batch_job.status='failed' + summary alert** (silent 아님 — B78 intent 충족). admin **render** path(transformStockReportRow parseSectionSafe console.warn)의 격상은 shared read 코드라 별도 트랙.
- **C14 format-error keys → 불요**: cron route는 JSON 응답(UI server-action 아님)이라 format-error 매핑 불필요. C11(UI action) 재개 시 동반.

---

## 5. (의도적 공백 — §4가 코드 변경 SoT)

> writing-plans no-placeholder 규칙: 본 plan은 plan SoT이므로 §4 표 + §6 TDD가 실행 명세다. 61차에 사용자 결정으로 impl까지 진행(§4.3). PR #28/#55 plan-only 패턴과 달리 본 PR은 plan + impl 동시.

---

## 6. TDD invariants (Vitest pure 로직 — impl PR에서 작성)

> 컴포넌트/E2E/RLS는 스코프 외(수동 QA). 아래는 순수 로직 단위. mock 패턴 = `route.test.ts`(vi.mock orchestrator/helpers, 401/200/502 + service-role 주입) + Supabase chain typed mock(memory [[feedback_test_mock_typing]] — `any` 금지, SelectChain/UpdateChain interface).

**worker / queue**:
- T1 sequential isolation: 1 종목 throw → 나머지 29 시도, result length=30, status array 정합. (NOT 병렬)
- T2 retry: transient code(`full_report_llm_failed`/`critic_llm_failed`/`revise_llm_failed`)는 각각 정확히 2회 retry 후 failed; non-transient(`ai_key_unavailable`)는 0회 retry + **batch abort**.
- T3 systemic abort: `ai_key_unavailable` / `cost_hardcap_40man` → batch 전체 중단 + 올바른 alert(scheduler_fail / cost_hardcap).
- T4 batch preflight: `callCount = 30 - done`; `currentTotal + remaining×535 > 400_000` 시 `cost_hardcap_40man` throw + `cost_hardcap` alert 1회 + remaining 'deferred' + STOP(NOT failed).
- T5 claim atomicity: 두 overlapping invocation이 동일 row를 중복 claim 안 함(FOR UPDATE SKIP LOCKED); stale 'running'(claimed_at<now()-10min) reclaim. **claim/mark RPC 내부 auth guard: 비-admin authenticated 호출 시 admin_required raise(HIGH-2)**.
- T6 chunk boundary + daily-advance resume: 정확히 CHUNK_N 처리; pending 남으면 다음 invocation(daily cron 재호출)이 done job SKIP + 다음 chunk 처리(resume), 6 invocation 누적이면 30/30 done. **monthly_batch_runs lock 미취득(HIGH-1) — selection lock과 독립**.
- T7 attempts cap(R2 MEDIUM-1): claim SQL `attempts < 3` filter로 attempts≥3 row 재claim 안 됨 + 선행 sweep이 stale-running(claimed_at<10min) & attempts≥3 → 'failed' 고정(crash-after-claim 무한 reclaim 차단).
- T8 run-mutex serialization + fencing(R2 HIGH-1 + R3 MEDIUM-1): 첫 invocation이 `acquire_report_worker_lock`→run_id 획득 후, 동시 2번째는 run_id NULL → 200 `{skipped:'already_running'}`(orchestrate 미호출, spend 0). stale(claimed_at<15min) 시 다음 invocation 재획득(새 run_id, resume). **fencing: stale 후 old run_id로 release → no-op(new owner 상태 미손상)**. selection의 monthly_batch_runs와 독립.
- T9 fail-closed 선행 검증(R2 HIGH-2 + R3 HIGH-1 + R3 MEDIUM-2): (a) `CRON_SYSTEM_USER_ID` 미설정/UUID 형식 위반/auth.users 부재(admin API/RPC 경유) → 첫 LLM 호출 전 abort+alert(spend 0); (b) `AI_COST_LOG_REAL_INSERT_ENABLED!=='true'` → 첫 LLM 호출 전 abort+alert(spend 0, hardcap 미보장 방지).

**versioning / idempotency**:
- T-v1 SKIP: section_0 AND section_7 non-null(완성) 종목 재실행 → `orchestrateFullReport` 미호출, cost_log 0.
- T-v2 OVERWRITE: incomplete latest row(section_8-only) → in-place 갱신, **같은 report_id**, version/is_latest 불변, (ticker,month) row 수=1.
- T-v3 CREATE: row 부재 → cron UPSERT가 INSERT(section_0~7, section_8 NULL).
- T-v4 no second versioned row: 두 cron invocation 후 (ticker,month) row 수=1.
- T-v5 invariant 불변: cron monthly run 후 `regen_auto_count`/`regen_manual_count`/`version`/`schema_version` 불변.
- T-v6 SKIP predicate precision: row 존재하나 section_7 NULL(section_0만 있는 partial, 또는 screening-only section_8 row) → SKIP 아님(OVERWRITE) — bare existence/section_0-only skip 금지(MEDIUM-1).

**orchestrator cron-upsert 분기 (C7)**:
- T-o1 `callerKind:'cron'` + `PR5_CRON_AUTO_ENABLED='true'` → `upsert_report_sections_0_7_cron` 호출.
- T-o2 `callerKind:'admin'` + `PR4_TRIGGER_UPSERT_ENABLED='true'` → `upsert_report_sections_0_7_admin`(회귀 0).
- T-o3 flag 미설정/`'false'` → `update_report_sections_0_7`(회귀 0).
- T-o4 error guard: cron UPSERT의 `_failed_no_returning`/`_failed:<code>`만 cron branch에서 surface(cross-path leak 0).

**route / flag / auth (C9)**:
- T-r1 flag default: `PR5_CRON_AUTO_ENABLED` 미설정 → 200 `{ok:true,skipped:true}`, run-mutex 미취득, spend 0.
- T-r2 auth: Authorization 부재 401 / 잘못된 Bearer 401 / production-like + CRON_SECRET 부재 401(fail-closed) — route.ts 4개 케이스 동일.
- T-r3 enqueue idempotent: cold entry는 30 INSERT(ON CONFLICT DO NOTHING), warm re-entry는 0 INSERT.

**cost / alert / 관측**:
- T-c1 **alert enum guard**: summary/cost alert는 `scheduler_fail`/`cost_warning`/`cost_hardcap`만; `insertAlertEvents`가 invalid type 절대 미수신(`report_generation_failed` trap 회귀).
- T-c2 pipeline_health: run당 정확히 1개 `'ai'` row, status가 threshold(successRate) 반영.
- T-c3 cost_log called_by: cron 적재 `adminUserId = CRON_SYSTEM_USER_ID`(reserved auth.users UUID)가 FK 통과 — adminUserId 체인 타입 무변경(HIGH-3); admin 적재는 `auth.uid()` 유지.
- T-c4 all-green = alert 0: 30/30 성공 시 summary alert 미발송.

**retry-with-backoff (C5, pure)**:
- T-b1 deterministic backoff(주입 sleep): 2000→4000→8000 cap, jitter 범위.
- T-b2 transient classifier: 429/529/network/`full_report_llm_failed`/`critic_llm_failed`/`revise_llm_failed`=transient; `ai_key_unavailable`/`cost_hardcap_40man`=non-transient.

---

## 7. OMXY R-debate scope guard + grep gate

**검증 mode** = catch-only(Complex: migration/RLS/persistence/concurrency/cost/server-action). CONVERGED 조건 = (a) §3 lock-in 결정이 코드 근거와 1:1 (b) self-review 우회 결함 0 (c) 기존 RPC/schema/cost model 호환 (d) PR5/PR5b boundary 정합.

**SCOPE GUARD (재해석 금지)**:
- B79 = **Option C PHASED**(PR5 report-only / PR5b committee votes D11-gated) — pure-A/pure-B 재오픈 금지.
- queue = **β2′**(자체 DB job queue) — β1(Vercel Queues, beta)/β3(불가) 재litigate 금지.
- versioning = **overwrite-in-place**(B65-P2 lock) — version-bump 재오픈 금지.
- admin RPC `upsert_report_sections_0_7_admin` service_role **REVOKE 유지** — cron은 별도 RPC.
- DQ-7 / S8 / 멤버 페이지 / D4 weight·cash / Tier 1 selection un-mock(B67) = 본 PR scope 밖.

**OMXY R2 재검증 요청 항목 (R1 6 catch fix 반영 후)**:
1. **R1 6 catch fix 정합** — HIGH-1(report worker가 monthly_batch_runs lock 미사용, claim-only) / HIGH-2(claim·mark RPC 내부 service_role/is_admin guard) / HIGH-3(reserved UUID, adminUserId 체인 무변경) / MEDIUM-1(section_0 AND section_7 completeness) / MEDIUM-2(critic/revise transient + retry 재spend vs preflight) / MEDIUM-3(daily cron primary, self-continue optional) 모두 충분?
2. **daily-cron-primary resume correctness**(§3.1) — selection lock 미공유 + claim SKIP LOCKED + stale reclaim으로 정확성이 waitUntil 무관하게 성립하는가? Hobby cron count 한도 처리 타당?
3. **cron UPSERT RPC 4-grant**(§4.1) — CREATE OR REPLACE grant 보존 → 명시 REVOKE 누락 시 anon 노출(0021 Kepler B2). search_path pin. claim/mark RPC도 동일 명시 REVOKE.
4. **0027 scope** — cost_log 미변경(reserved UUID) + commit_persona_eval/commit_sector_personas grant 미포함(PR5b/0028) + versioning 컬럼/partial unique index 미변경.
5. **PR5/PR5b boundary + D11 hard gate**(§3.2, §9 G2) — 16,050 report-only lock 유지 + PR5b D11 전 land.

**grep gate (impl 후 0 매치 확인)**:
- `rg 'report_generation_failed' src/` = 0 (enum 미존재 type)
- `rg 'Promise.allSettled' src/lib/report/full-report-batch-worker.ts` = 0 (sequential 강제)
- `rg 'await createClient\(\)' src/lib/report/full-report-batch-worker.ts` = 0 (service-role only)
- `rg 'acquireBatchLockCron\|monthly_batch_runs' src/lib/report/full-report-batch-worker.ts src/app/api/cron/monthly-batch/report-worker/` = 0 (R1 HIGH-1: selection lock 미사용)
- `rg 'acquire_report_worker_lock' src/app/api/cron/monthly-batch/report-worker/` 존재 (R2 HIGH-1: 전용 run-mutex)
- `rg 'attempts *< *3\|attempts >= 3' supabase/migrations/0027*.sql` 존재 (R2 MEDIUM-1: claim cap)
- `rg 'PR5_CRON_AUTO_ENABLED'` = route + orchestrator + .env.example doc 존재
- `rg 'CRON_SYSTEM_USER_ID'` = worker + .env.example doc 존재 (HIGH-3 reserved UUID)
- `rg 'upsert_report_sections_0_7_admin' src/lib/report/full-report-batch-worker.ts` = 0 (cron은 cron RPC)
- `rg 'critic_llm_failed\|revise_llm_failed' src/lib/report/retry-with-backoff.ts` 존재 (MEDIUM-2 transient)
- `rg 'service_role' supabase/migrations/0027*.sql` — 신규 cron RPC 3종 grant + 명시 revoke public/anon 동반
- `rg 'commit_persona_eval' supabase/migrations/0027*.sql` = 0 (PR5b)
- `rg "callerKind: ?'cron'" src/lib/report/full-report-batch-worker.ts` 존재

---

## 8. audit catalog disposition (Workflow audit agent 23-item 분류 + 정정)

**must-resolve in PR5**: B68(첫 실 run cost_log 적재 검증) · B72(reportExists + cron resume 통합) · B73(B85 1-token model id verify 선행) · B74(writer+critic+revise cost 적재 + persist-fail alert) · B75→**§3.2로 해소**(boundary lock) · B76(hardcap 16,050 enforce + alert) · B78(null-drop 구조화 log) · B-versioning→**§3.4 해소** · W-pr5-readiness→**본 plan이 정의**((a) grant=PR5b, (b) DI wire=C1/C7, (c) cron 30 hardcap=C8, (d) queue=§3.1).

**정정 (audit agent "must-resolve" → PR5 out-of-scope)**:
- **B67**(cron mockTier0Source/callPersonaPanel throw) = **SELECTION path 책임**(Tier 1 main-path PR), report PR5 아님. report-worker는 별도 endpoint이므로 selection mock 미변경. (audit agent가 screening↔report를 conflate — selection-vs-report reader가 정정 확인.) *옵션 hygiene*: 기존 monthly-batch selection route의 monthly 502 noise를 줄이려면 동일 flag로 200-skip 가능하나 PR5 core 아님(§0 noted).
- **B69**(committee_votes=0) = **PR5b**로 해소(§3.2). PR5에서는 의도적으로 0(Tier1-pending pill).

**defer (follow-up ticket)**: W-cost-log-admin-assertion(admin path RLS, cron은 service-role) · W-cost-log-pagination-snapshot(1000+ rows/월 — 현 ~150 non-blocking) · W-cost-log-core11-drift(Core 11 stable) · W-alert-event-dedup(다음 마이그 슬롯 0028+ partial unique index — repeated scheduler_fail dedup) · W-pr5-vercel-queues(β1 beta 졸업 후 재검토).

**out-of-scope**: B70(PR4 regen UX) · B71(short_list_30 stale — B66 해소) · B77(docs SHA hygiene) · W-tier1pill / W-sectionfallback-text(UI follow-up) · W-pipeline-health-window-hardening(telemetry read) · B82(historical).

---

## 9. Risks + hard gates

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Fluid `after()`/waitUntil self-fetch chain**이 detached fetch를 살려두지 않으면(waitUntil은 function timeout과 함께 취소 가능, Vercel docs) chunk가 안 이어짐. | **MEDIUM-3 fix로 강등**: chunk-advance primary = **daily cron**(deterministic). self-continue는 optional accelerator(load-bearing 아님). 정확성은 daily cron + idempotent claim에만 의존 → platform 가정 무관. |
| R2 | **double-fire + concurrent cost race**(daily cron + manual + optional self-continue 동시 invocation) → 중복 생성 + **preflightHardcap read-then-check race로 hardcap 초과**(R2 HIGH-1: claim SKIP LOCKED는 중복 row만 막고 cost 직렬화는 못 함, preflightHardcap은 원자 reservation 없음). | **전용 `report_worker_run` run-mutex(R2 HIGH-1 fix)**가 invocation을 직렬화 → 단일 worker만 실행 → sequential per-call preflight가 cost gate 보존. + claim SKIP LOCKED(row 중복) + reportExistsAndCompleteForMonth(idempotency) 다중 방어. **selection lock 미공유(R1 HIGH-1)**. T5 + 신규 T8(run-mutex). |
| R3 | **dead-chain mid-batch**(crash/deploy) → 'running' stuck. | stale reclaim(claimed_at<now()-10min)으로 다음 **daily cron**이 자동 회수·resume + manual `triggerReportWorker`. monthly_batch_runs lock 미사용이므로 lock-stuck 위험 자체 제거(HIGH-1). T6. |
| R4 | **cost_log.called_by FK** 미해소 시 flag-on 첫 run 즉시 실패. | **HIGH-3 fix**: reserved 'cron-system' auth.users UUID(`CRON_SYSTEM_USER_ID` env) — adminUserId 체인·cost_log schema 무변경. T-c3. **USER 1회 auth.users seed + env(external) 필요.** |
| R5 | **cost gate fail-OPEN** when `AI_COST_LOG_REAL_INSERT_ENABLED=false`(insertCostLog noop[cost-logger.ts:35] → getMonthlyTotal=0 → preflightHardcap 0 → 400k 미보장). USER가 PR5_CRON_AUTO_ENABLED=true만 켜고 cost flag를 빠뜨리면 hardcap 무력. | **R3 HIGH-1 fix: code-level fail-closed coupling** — worker step 0(C8)이 `AI_COST_LOG_REAL_INSERT_ENABLED==='true'`를 강제(false면 LLM 호출 전 abort+alert, spend 0). 더 이상 USER 설정 의존만이 아니라 코드가 보장. T9. |
| R6 | **alert enum 위반**(report_generation_failed) → 관측 자체가 throw. | §3.5 hard-forbid + grep gate. T-c1. |
| R7 | **0027 grant-matrix error**(CREATE OR REPLACE grant 보존, 명시 revoke 누락 → anon 노출). | §4.1 3-set verbatim + rollback pair + search_path pin. OMXY Kepler/Planck SQL/RLS archetype 검토. |
| R8 | **SKIP predicate 부정확**(bare existence/section_0-only) → screening-only 또는 partial row 본문 영구 누락. | **MEDIUM-1 fix**: `reportExistsAndCompleteForMonth` = section_0 AND section_7 non-null. T-v6. |
| R9 | **retry budget × chunk 시간**이 300s 초과 → tail ticker mid-flight kill → 불완전 row. | `CHUNK_N × (max per-ticker incl. retries) < 300s` 여유 coupling 명시. cron UPSERT atomic이라 불완전 row 미생성(재시도 깨끗). |
| R10 | **plan-only this session** → OMXY가 β1/full-path/version-bump 재오픈. | §0/§7 scope guard에 기각 사유 pre-state. |
| R11 | **CRON_SYSTEM_USER_ID 무효/미설정**(R2 HIGH-2) → `insertCostLog`는 Anthropic 호출 후라 ~236원 spend 후 FK throw. | C8 step 0 fail-closed 선행 검증(env+UUID 형식+auth.users 존재, **첫 LLM 호출 전**) → 무효 시 abort+alert, spend 0. §3.6 + T 신규. |
| R12 | **attempts cap 미enforce**(R2 MEDIUM-1) → crash-after-claim이 attempts를 올린 채 stale running 잔존 → 무한 reclaim(4,5,...). | claim SQL `attempts < 3` filter + 선행 sweep(stale running & attempts≥3 → 'failed'). §4.1 #2 + T7. |

**하드 게이트 (HANDOFF §2.1 active matrix 갱신 항목)**:
- **G1 — PR5 impl 진입 = Task 7 Smoke Stage 2 PASS 후** (B97 lock: 실 AI smoke USER 비용 승인). 본 plan은 plan-only로 지금 작성/검증 가능하나, impl 착수는 Smoke PASS 게이트 통과 후.
- **G2 — PR5b(committee votes full path)는 D11 AI 가상 포트 운용 검증 진입 전 반드시 land** (D11 Accept/Reject ⊥ Section 8). PR5b는 committed fast-follow. HANDOFF active matrix에 `PR5 (section_0~7 auto) → PR5b (committee votes, D11-gated)` 추가.
- **G3 — PR5b는 +750 LLM-call path 가동 전 별도 cost 재추정 + OMXY CONVERGED** (16,050은 report-only 전용 — §3.2). `AI_COST_LOG_REAL_INSERT_ENABLED` + `ANTHROPIC_API_KEY`는 USER-only.

---

## 부록 A — Workflow research 출처 (12-agent, 1.5M subagent tokens)

본 plan은 61차 `pr5-plan-research` Workflow(understand 7 readers + audit 1 + design 4 forks) 종합 + Claude first-hand 코드 grounding(cron route / orchestrator / 마이그 0017/0019/0022/0025 / service-role / cost / shortlist / section-8) 교차검증으로 작성. design 패널 4 fork CONVERGED: queue=β2′ / B79=Option C phased / versioning=overwrite-in-place / fail-cost-auth=Option A. 결정적 catch: cost_log.called_by uuid FK(R4) · alert enum closed(R6) · sequential-not-allSettled cost correctness(§3.5) · row-creation 근본원인(§3.3).

## 부록 B — OMXY R-debate 헤더

- **R0**: Claude DRAFT (본 문서 초안).
- **R1 (OMXY catch-only, 3m51s, gpt-5.5 xhigh)**: **3 HIGH + 3 MEDIUM** catch, SIGNAL: CONTINUE. omxy가 route.ts/0021/orchestrator/critic-client/revise-client/vercel.json + Vercel waitUntil docs를 직접 읽고 검증. Claude가 6 catch 모두 코드 근거로 **CORRECT 확인**(push-back 0) 후 fix:
  - **HIGH-1** (lock 공유) → report worker는 selection의 `monthly_batch_runs` lock 미사용, `report_batch_job` claim-only (§0/§3.1/§4.2 C8·C9, R2·R3).
  - **HIGH-2** (claim/mark RPC 내부 guard 부재) → service_role bypass/is_admin else guard 추가 (§4.1 #2·#3).
  - **HIGH-3** (called_by nullable이 adminUserId 체인 전체 변경 요구) → **reserved 'cron-system' UUID로 전환** (체인·schema 무변경, §3.6/§4.1 #5, R4, T-c3).
  - **MEDIUM-1** (completeness 불일치) → section_0 AND section_7 (§2/§3.4/§4.2 C2, T-v1·T-v6, R8).
  - **MEDIUM-2** (critic/revise transient 누락 + retry 재spend) → transient에 critic_llm_failed/revise_llm_failed 추가 + 16,050=no-retry projection 명시 (§0/§3.5/§4.2 C5, T2·T-b2).
  - **MEDIUM-3** (self-chain fallback 미wired + waitUntil 취소) → **daily cron primary**, self-continue optional (§3.1/§4.2 C9·C10, R1).
- **R2 (OMXY catch-only, 1m07s)**: R1 fix 검증 → **2 HIGH + 2 MEDIUM** 신규(더 깊은) catch, SIGNAL: CONTINUE. Claude가 4개 모두 코드 근거로 **CORRECT 확인**(preflightHardcap 비원자 read-then-check + callFullReport spend-before-log 직접 verify) 후 fix:
  - **R2-HIGH-1** (claim-only는 cost 직렬화 못 함 — concurrent invocation의 preflightHardcap race로 hardcap 초과) → **전용 `report_worker_run` run-mutex 신설**(selection과 분리, invocation 직렬화). R1 HIGH-1을 over-correct(lock 전면 제거)한 것을 정정 — selection과 분리된 dedicated mutex가 정답. → §0/§3.1 L1/§4.1 #2b/§4.2 C9/R2/T8.
  - **R2-HIGH-2** (CRON_SYSTEM_USER_ID 무효가 insertCostLog(=Anthropic 호출 후)에서야 발각 → spend 후 실패) → **C8 step 0 fail-closed 선행 검증**(env+UUID+auth.users 존재, 첫 LLM 전). → §3.6/§4.2 C8/R11/T9.
  - **R2-MEDIUM-1** (claim SQL에 `attempts<3` 없음 → 무한 reclaim) → claim `attempts<3` filter + stale&max sweep→'failed'. → §4.1 #2/R12/T7.
  - **R2-MEDIUM-2** (stale text: header self-continuation/§1 acquireBatchLockCron running guard/section_0 completeness 3곳) → 모두 정정.
- **R3 (OMXY catch-only, 1m22s)**: R2 fix 검증 → **2 HIGH + 2 MEDIUM** 신규 catch, SIGNAL: CONTINUE. Claude가 4개 모두 코드 근거로 **CORRECT 확인**(insertCostLog noop gate[cost-logger.ts:35] + createServiceRoleClient schema='public' default 직접 verify) 후 fix:
  - **R3-HIGH-1** (AI_COST_LOG_REAL_INSERT_ENABLED=false면 cost_log noop → preflightHardcap fail-open → 400k 미보장, USER 설정 의존) → **worker step 0이 cost flag를 code-level 강제**(false면 LLM 전 abort). → §3.5/§3.6/§4.2 C8(b)/R5(upgrade)/T9.
  - **R3-HIGH-2** (admin triggerReportWorker가 run-mutex 우회 path 잔존) → **route를 authenticated fetch로만 호출**(flag+mutex+preflight 통과). → §4.2 C11.
  - **R3-MEDIUM-1** (run-mutex release가 fencing-unsafe — stale 후 old worker가 new owner 덮음) → **run_id fencing token**(acquire→run_id 반환, release where run_id 일치). → §4.1 #2b/§4.2 C9/T8.
  - **R3-MEDIUM-2** (auth.users `select 1`은 PostgREST schema='public' default라 불가) → **auth.admin.getUserById 또는 SECURITY DEFINER `validate_cron_system_user` RPC**. → §3.6/§4.1 #7/§4.2 C8.
- **R4~**: OMXY 재검증 — CONVERGED 시 HANDOFF §2.1 active matrix에 `PR5 → PR5b(D11-gated)` 박제 + 본 헤더 final.
