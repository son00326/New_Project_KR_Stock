# 비용 0 비-AI 작업 — 단계별 플랜 (출시 전, AI 실호출 보류 상태)

Status: **DRAFT (Claude 1차)** — omxy 합의(리뷰+수정) → Claude 재검증 대기.
Date: 2026-06-02
Base: main `6394fc8` (d15da47 자손) / branch `plan/nonai-zero-cost-worklist`
산출: Workflow `wf_351f1641-2a0` (SoT 4소스 병렬 추출 24후보 → 12 step 시퀀싱 → 적대적 스코프 가드 PASS).

---

## 0. 배경 / 제약

- **사용자 결정**: 실 AI 선정(PR-G ⓑ ④, ~6.5–8만원)은 **비용 때문에 지금 보류(keep)**. AI는 추후 진행. 그 전까지 **비용 0 작업만** 진행.
- **"AI 실호출 비용" 정의** = Anthropic Core 11 페르소나 패널 / writer·critic·revise / sector 14 패널 등 LLM API 호출. 이게 필요하면 제외.
- **비용 0 = 포함**: 순수 코드/문서/테스트, mock·flag-off dormant 머지(PR5가 실증), 지표 스크리닝(KRX/DART), 수동 QA.
- **엄격 스코프 가드 (사용자 명시)**: "기획에 있는 내용 외, 정해진 내용 외 다른 불필요한 작업은 일절 금지." 모든 step은 ADR(`2026-05-31-realdata-realai-e2e-decisions.md`) / audit-catalog `§9.5` W-ticket / HANDOFF 매달 자동화 아키텍처 / ServicePlan-Admin(D19/D21/D23) / ReportFramework §8 중 하나에 직접 추적되어야 함. 추적 안 되면 금지.

## 1. 메타프로세스 (전 step 동일 적용 — §2.0a)

각 step + 문서 검증 모두:

| 단계 | 주체 | 내용 |
|---|---|---|
| ① 1차 작업/수정 | **Claude** | impl·변경·문서 1차 작성 + branch commit(baseline diff) |
| ② 1차 리뷰+수정 | **omxy** | 적대적 검토 + 찾은 결함 **직접 수정**(direct-edit), 게이트 ALL GREEN 유지 |
| ③ 2차 검증 | **Claude** | omxy 수정 코드 근거 검증(맹목 수용 X). 잔여 시 ②복귀, clean이면 commit |

- 플랜 단계는 본 문서가 ①, 다음 omxy 합의가 ②③.
- USER 게이트(Vercel env / 마이그 production apply / billing / live-money / external account / 실 AI cost burn)는 본 순서와 무관하게 항상 적용.
- 검증 게이트 = build 26 routes / lint 0 err / test:ci / tsc clean / (해당 시) grep gate + execute_sql RPC grant matrix.

## 2. 12-step 시퀀스

> 시퀀싱 원칙: (1) 작고 독립적인 UI/문구 최우선 (2) hardening cluster를 SECURITY DEFINER RPC로 통합 (3) flag-off 테스트·dormant scaffold·wiring (4) 대형 신규 PR(선정 청크 워커)은 검증가능성·의존성 따져 중후반 (5) 코드는 가능하나 실행이 외부/USER인 항목 후반.

### STEP-1 · 리포트 페이지 UI sweep (단일 PR, 마이그 불필요)
- **scope**: page.tsx UI 3종 동시 정정 (동일 파일 same read 경로).
  - (a) SectionFallback line 337/343 `'PR3b…에서 채워집니다'` stale → PR3b MERGED(`cf68731`) 반영 문구 (W-sectionfallback-text).
  - (b) Section 8 absent 리포트에 **'Tier 1 평가 대기' pill** 렌더 — `stock_reports` row null / Section 8 부재만으로 판정, 새 AI 호출 트리거 0 (W-tier1pill, D11 acceptance gate).
  - (c) Section 0(요약)에 이미 persist된 `short_list_30` 값 1행 노출 — 🔢 `compositeScore`(line 175 기존 read) + 🤖 `ai_score` + 합의 배지(`consensus_badge`, PR-E 0029 nullable 컬럼). null이면 'AI 대기'.
- **SoT**: audit-catalog §9.5 W-tier1pill + W-sectionfallback-text + ADR §4 PR-H row + §5 매핑 + ReportFramework §8 Step2 line 752.
- **depends_on**: PR-E ✅ + PR3b ✅ (독립, 렌더 only).
- **DoD**: stale 0 / Section8 부재 시 pill(존재 시 미렌더) / Section0 1행 / HANDOFF §2.1 Step 8 acceptance gate 명시 동시 갱신.
- **게이트**: build / lint / test:ci(fallback·pill·Section0 1행 render 단위) / tsc / grep stale 0 + pill present / (선택) gstack 시각 canary.
- **PR**: 단일 feature branch. 최우선(가장 작고 독립).

### STEP-2 · cost_log fail-open hardening (마이그 0030)
- **scope**: 신규 마이그 0030 = `get_cost_log_monthly_total_admin(p_month)` SECURITY DEFINER(server-side SUM, transaction snapshot, `not is_admin() → raise`) + **3종 grant 세트**(revoke public + revoke anon + grant authenticated, service_role grant 금지).
  - (a) cost_log SELECT RLS `using(is_admin())`의 non-admin silent-0 fail-open → RPC raise로 fail-closed 격상 (W-cost-log-admin-assertion).
  - (b) `getMonthlyTotal` pagination(`.order('called_at').order('id')`) backdated/parallel INSERT undercount risk → server-side SUM 제거 (W-cost-log-pagination-snapshot).
  - cost-logger.ts `getMonthlyTotal`/`preflightHardcap`을 RPC 우선 + 기존 pagination fallback 배선. triggerFullReport/regenerateReport/portfolio actions RPC 경유.
- **SoT**: audit-catalog §9.5 W-cost-log-admin-assertion + W-cost-log-pagination-snapshot(catalog 명시 "동일 RPC 통합").
- **depends_on**: STEP-1. 마이그 슬롯 0030. HANDOFF §4 SECURITY DEFINER 3종 세트 + PostgreSQL IF-null guard 규칙.
- **DoD**: 마이그 0030 + rollback 짝. non-admin raise / admin SUM. RPC 경유 + fallback 보존. mock parity 무회귀.
- **게이트**: build / lint / test:ci(RPC mock + RPC-first 경로 + non-admin raise 단위) / tsc / grep `from('admin_emails')` 직접 SELECT 0 + service_role grant 부재 / execute_sql has_function_privilege 4-grant matrix. **마이그 production apply = USER 게이트** (CLAUDE는 작성·로컬 테스트·verify 명령).
- **PR**: 별 branch + 0030 (dormant — fallback 보존이라 merge-safe).

### STEP-3 · pipeline_health hardening (마이그 0031)
- **scope**: 신규 마이그 0031 = `get_pipeline_health_summary_admin(p_window_hours)` SECURITY DEFINER(server-side aggregate + recent failures tail, is_admin guard, 3종 grant).
  - (a) admin/settings/health page RLS silent-0 → explicit admin assertion fail-closed (W-pipeline-health-admin-assertion READ side. silent-health INSERT side = scope 외).
  - (b) 7일 window client-side pagination(future ~50k rows = 50 round trips) → server-side aggregate RPC (W-pipeline-health-window-hardening).
  - (c) /admin/alerts empty-state `'0건 = 실제 미발생'`(page.tsx line 83)의 `ADMIN_EMAILS↔admin_emails` drift 시 RLS deny 오인 → `rpc('is_admin')` diagnostic으로 '미발생' vs 'RLS deny' 구분 (W-mock2-rls-drift, 마이그 불필요분).
- **SoT**: audit-catalog §9.5 W-pipeline-health-admin-assertion + W-pipeline-health-window-hardening + W-mock2-rls-drift.
- **depends_on**: STEP-2(동일 SECURITY DEFINER 패턴 재사용). 마이그 0031.
- **DoD**: 마이그 0031 + rollback. non-admin raise / admin aggregate. health page assertion. alerts RLS-deny vs 미발생 구분. mock parity 무회귀.
- **게이트**: build / lint / test:ci(RPC aggregate mock + assertion + alerts diagnostic 단위) / tsc / grep silent-health INSERT side 미변경 + 4-grant matrix. 마이그 apply = USER.
- **PR**: 별 branch + 0031. STEP-2 직후 동일 패턴.

### STEP-4 · insertCostLog spend-before-log gap (마이그 불필요)
- **scope**: LLM 호출 성공 후 `insertCostLog` 실패 시 월 누적 undercount fail-open gap 차단. catalog 2옵션 중 **마이그-불필요 경로 채택**: batch worker가 insertCostLog 실패 감지 시 batch stop + 기존 alert insert helper로 explicit reconciliation alert. (선차감 reservation/atomic ledger DB 경로는 더 큰 PR로 의도적 분리.)
- **SoT**: audit-catalog §9.5 R3 W-cost-atomic-reservation.
- **depends_on**: STEP-2(cost-logger 동일 파일 sweep 후 충돌 회피). go-live blocker 아님.
- **DoD**: insertCostLog 실패 silent swallow 0 → worker batch stop + reconciliation alert(기존 helper 재사용). mock cost 주입 테스트.
- **게이트**: build / lint / test:ci(실패 주입 → stop + alert 단위) / tsc / grep silent catch 0.
- **PR**: 별 branch, 마이그 불필요.
- **⚠️ impl 권고(스코프가드)**: `insertCostLog`는 `anthropic-client.ts` line 90에서 호출되며 이미 throw 전파(silent swallow 아님, line 87 주석). 실 risk = "LLM 성공 후 insertCostLog 실패 = spend-before-log undercount". impl 시 파일 위치/'정밀화' 워딩 정정.

### STEP-5 · PR-G ② flag-off fail-closed 테스트 보강 (마이그 불필요)
- **scope**: flag-off(`MONTHLY_BATCH_CRON_AI_ENABLED` off + `AI_COST_LOG_REAL_INSERT_ENABLED` off)에서 cron route + admin trigger 호출 → preflight throw → `callPersonaPanel`(실 Anthropic) 0회 · cost 0 증명. PR-G ⓐ route-level 계약 테스트 기존 → **admin path · orchestrator preflight 추가 커버**가 증분.
- **SoT**: ADR §4 PR-G scope + D-8 + §7.1 RESOLVED + HANDOFF §6 PR-G ⓐ.
- **depends_on**: PR-B2 ✅ + PR-E ✅ + PR-G ⓐ ✅ (독립, 테스트 only).
- **DoD**: flag-off 시 cron + admin(triggerFullReport/triggerMonthlyBatch/regenerateReport) 모두 preflight throw + callPersonaPanel spy 0 + insertCostLog 0 테스트 PASS.
- **게이트**: build / lint / test:ci(flag-off→throw + spy 0 assertion) / tsc / grep preflight + is_admin 게이트 present. cost_log=0 drift 0.
- **PR**: 별 branch (테스트 보강 only).

### STEP-6 · PR-H manual trigger 2종 wiring (dormant flag, 마이그 불필요)
- **scope**: D-9 3 trigger path 중 manual 2종 배선.
  - (a) reject 후 trigger 버튼 → `runMonthlyBatchOrchestrator`(30 재선정).
  - (b) 종목별 Regen 버튼 → `orchestrateFullReport`(단일 ticker, 기존 배지/점수 입력, 30선정 재실행 아님).
  - server action은 PR-B2/PR-E is_admin + `AI_COST_LOG_REAL_INSERT_ENABLED` fail-closed로 이미 보호. **UI 버튼 + caller wiring + flag-off→throw(LLM 0/cost 0) 테스트만**. 실 burn = USER가 Vercel flag ON + 클릭(제외).
- **SoT**: ADR §3 D-9 + §4 PR-H row + ServicePlan-Admin D23 1.3 + §2 IA.
- **depends_on**: PR-B2 ✅ + PR-E ✅ + STEP-5(flag-off 패턴 재사용).
- **DoD**: 2 버튼 UI + caller. flag-off 클릭 = preflight throw + callPersona 0 테스트. 실 enrich/worker 가동 미포함.
- **게이트**: build / lint / test:ci(caller wiring + flag-off→throw + is_admin + DI seam 5중 assertion per HANDOFF §8) / tsc / grep 버튼 caller + B2 guard 경유. flag default-off merge-safe cost 0.
- **PR**: 별 branch + dormant flag.
- **⚠️ impl 권고(스코프가드)**: ADR PR-H의 `placeholder→실 DART/배지 source` enrich(실 호출 아닌 입력 source swap 코드, 비용 0 부분)가 STEP-6/STEP-7 중 어디 귀속인지 impl 전 확정. STEP-6↔7 Section 8 Part A 렌더 책임 경계 분리(STEP-6=골격 없음 / STEP-7=14패널 골격).

### STEP-7 · PR-I sector14 dormant scaffold (마이그 0019 기존)
- **scope**: 코드/RPC/렌더 dormant 부분만. `runSectorEval` scaffold(persona-eval.ts, unknown→degraded 기존) + `sector-persona-builder.ts` production prompt 정합 + `commit_sector_personas` RPC(마이그 0019 기존) 배선 + report Part A 14패널 렌더 골격을 **mock 14×14 fixture로 빌드·테스트**. 실 sector 14×30 eval(callPersona 14× 실 LLM) = I-realeval로 분리(제외).
- **SoT**: ADR §4 PR-I row + §5 매핑 + ServicePlan-Admin D21 + §3.7 R3.7-6/7/8.
- **depends_on**: PR-C ✅ + PR-E ✅ + PR-G ⓐ ✅. STEP-6 후.
- **DoD**: runSectorEval 정합 + commit_sector_personas 배선 + Part A 14패널 mock render. prompts 부재 시 degraded ⚪(LLM 0). 실 14× 미포함.
- **게이트**: build / lint / test:ci(mock stub + 14패널 render + RPC mock + degraded 단위) / tsc / grep 실 callPersona 미배선(dormant). 마이그 0019 기존.
- **PR**: 별 branch dormant (mock fixture). 실 eval = USER 게이트.

### STEP-8 · PR-J runtime mock 제거 (마이그 불필요)
- **scope**: 런타임 mock(mockTier0Source/mockCallPersonaPanel/mockFetchFinancials/commitBadgeOnlyPlaceholder throw-stub + mock-admin-* runtime 경로) 제거 + grep 0. **테스트 fixture 보존**. 멤버 트랙 stock mock은 USER 확인 — admin orphan만.
- **SoT**: ADR §4 PR-J row + §0 GOAL #5 + depends_on I.
- **depends_on**: STEP-7(PR-I sector 실 경로 배선 후 안전 제거).
- **DoD**: admin runtime mock orphan 삭제 + grep 0(런타임 import 0, fixture만). 게이트 무회귀.
- **게이트**: build / lint / test:ci(fixture 경유 무회귀) / tsc / grep runtime mock import 0. 멤버 트랙 grep은 USER 확인 후.
- **PR**: 별 branch (정리 only).

### STEP-9 · 선정 청크 워커 PR (마이그 0032+, dormant flag)
- **scope**: serverless 300s 제한 회피용 큐 인프라(매달 자동 30선정). 신규 마이그 = `tier1_selection_job` 테이블 + `claim_next_selection_jobs` RPC + `acquire_selection_worker_lock` run-mutex RPC (**PR5 0027 report_batch_job/claim_next_report_jobs/acquire_report_worker_lock 동형 복제**). 청크 드라이버 cron route + self-continue + TDD. 실 Core 11 패널 호출은 step-0 fail-closed flag(default-off) → **빌드/테스트/머지 cost 0**(PR5가 실증).
- **SoT**: HANDOFF 다음 액션 큐 line 26 "매달 자동화 아키텍처 (ii) 30선정 = PR5와 동일 청크 워커 패턴으로 재구성 필요(tier1_selection_job 큐)" + ADR §4 D19 메인 path.
- **depends_on**: HANDOFF "PR-G ⓑ 일회성 검증 후 진행 권장" — 단 dormant 코드/마이그/테스트 작성은 mock+flag-off라 선행 가능(빌드·머지 cost 0). 마이그 슬롯 0032+.
- **DoD**: 큐 + claim/mutex RPC 마이그 + 청크 cron route + self-continue. step-0 flag default-off → cost 0. PR5 run-mutex/forward-progress 테스트 1:1 복제. 실 패널 dormant.
- **게이트**: build / lint / test:ci(claim/mutex/self-continue + flag-off→spend 0 + forward-progress, PR5 TC 패턴) / tsc / grep step-0 fail-closed flag default-off. 마이그 apply = USER.
- **PR**: 대형 신규 + 마이그 0032+ dormant. PR5 0027 패턴 참조 강제. 실 가동 = USER.

### STEP-10 · PR-G ⓑ 로컬 러너 A′+B 코드 빌드 (실행 제외, 마이그 불필요)
- **scope**: 로컬 러너 스크립트 코드(빌드 한정). (A′) Node/tsx 독립 프로세스 + JSON 체크포인트(150 패널 저장/로드, 실패 ticker만 재시도, 150/150 완성 시 `upsertShortList30` persist 배선). (B) `callPersona` transient 재시도 래퍼(messages.create 429/5xx/APIConnection/timeout 1-2회 — parse/validation/cost insert 재시도 금지, admin path 공유라 비파괴). mock callPersona 단위 테스트. **실 1회 실행(~55분, 1650 Opus콜, ≈6.5-8만원, cap 135,680원) = PRG-B-RUN 분리(제외)**.
- **SoT**: HANDOFF 다음 액션 큐 ④ + 다음 세션 절차 (b) "로컬 러너 A′+B 빌드".
- **depends_on**: STEP-11(러너 입력 = 150 후보) — 코드 빌드는 mock 입력으로 선행 가능, 실행만 150 시드 + USER 비용(PRG-B-RUN) 게이트.
- **DoD**: A′ 러너 + 체크포인트 + 실패-ticker 재시도 + persist 배선. transient 재시도 래퍼. mock 단위 테스트. 실 실행 미포함.
- **게이트**: build / lint / test:ci(체크포인트 save/load + 재시도 + 150-invariant + transient/parse·cost 비재시도 assertion) / tsc. 실 burn = USER.
- **PR**: 별 branch (러너 코드 only).

### STEP-11 · ① Tier0 150 재시드 (마이그 0028 기적용, SHARED)
- **scope**: 5-Signal Composite × 시간대별 가중치 비-AI 스크리닝(`scripts/screen_shortlist_tier0.py --emit-candidates` → `tier0_candidates_150` disjoint 50×3 write). KRX/pykrx + DART standalone/quality 지표만, **LLM 0**. 현 0 rows(KRX throttle: ~2000/2269 실패). KRX backoff/off-peak 재실행. CLAUDE = 스크립트 backoff 보강 + 명령/가이드, 실 실행 = USER 환경(KRX 키 + venv/pykrx).
- **SoT**: HANDOFF prep ① + ADR §6 + D-3. 마이그 0028 ✅ applied.
- **depends_on**: 마이그 0028 ✅. KRX API 안정. STEP-10 코드와 병렬 가능.
- **DoD**: tier0_candidates_150 = 150 rows(disjoint 50×3, canonical CHECK + unique 정합). throttle backoff로 완주.
- **게이트**: Python 95 tests PASS / `select bucket,count(*) from tier0_candidates_150 group by bucket`(50/50/50) + canonical 정합 + placeholder 0. DB write = USER 환경, CLAUDE backoff 코드 + verify 명령.
- **PR**: scripts/ backoff = CLAUDE branch. 실 시드 = USER 환경(외부 API).

### STEP-12 · T7e.7 RLS 브라우저 수동 QA (PR 아님, SHARED)
- **scope**: RLS 정책을 3 계정(kevin/son00326/shjang1001)으로 라우트별 접근 통과/거부 + cron 인증(CRON_SECRET) + RPC 가드(is_admin/SECURITY DEFINER) 브라우저 수동 검증. LLM 0. STEP-2/3 신규 RPC grant matrix도 함께 functional canary. stock_reports/committee_votes는 후속 seed 전까지 boundary/empty 감안.
- **SoT**: HANDOFF §3 + §5 + S7-RealData.md T7e.7 + CLAUDE.md "D11 운용 검증 직전 마무리(1시간 안짝)".
- **depends_on**: Tier 0 short_list_30 시드(T7e.8) ✅ → 진입 가능. STEP-2/3 RPC 후 함께 검증 권장. 브라우저 세션 + 3 계정 = USER.
- **DoD**: 3 계정 라우트별 통과/거부 결과표 + cron 401/200 + RPC is_admin 통과/거부 기록. S7-RealData T7e.7 체크 + ProgressDashboard S7e 8/8.
- **게이트**: 수동 QA 매트릭스 + cron 401/200 + execute_sql 4-grant matrix. 인증 세션 시 gstack/playwright canary.
- **PR**: 수동 QA + 문서 체크. S7-RealData + ProgressDashboard 갱신만 CLAUDE docs commit. 우선순위 마지막.

## 3. 제외 (실 AI 비용 = USER 비용 게이트)

| 항목 | 이유 | 포함된 비용0 부분 |
|---|---|---|
| **PRG-B-RUN** | 러너 실 1회(~6.5-8만원, cap 135,680원) | STEP-10(코드 빌드) |
| **I-realeval** | sector 14× 실 callPersona | STEP-7(scaffold dormant) |
| **H-realrun** | 실 enrich/worker(writer/critic/revise) | STEP-6(버튼 wiring + flag-off) |
| **선정워커 실가동** | tier1_selection_job 실 Core 11 호출 | STEP-9(큐/RPC/cron dormant) |
| **Task 7 Smoke Stage 2** | 첫 실 AI burn(PR5 트랙) | — (별도 트랙) |

- **W-alert-event-dedup 제외**: 사용자 strict-SoT(audit-catalog.md §9.5만) 규칙. 본 티켓은 audit-catalog.md grep 0 hit(HANDOFF line 343 + PR5 plan에만 존재). 포함하려면 audit-catalog §9.5에 먼저 박제 필요.
- **W-portfolio-snapshot-real 제외**: audit-catalog §9.5 미박제(HANDOFF §9 + S7b 트랙). S7b 진입 시 별도.

## 4. 마이그 슬롯 / 검증 / Owner 요약

- 마이그 슬롯: STEP-2=0030 / STEP-3=0031 / STEP-9=0032+. STEP-4는 마이그-불필요(alert helper 재사용). 현 HEAD=0029.
- **마이그 production apply는 모두 USER 게이트** (CLAUDE = 작성 + 로컬 테스트 + verify 명령). RPC 추가는 fallback 보존 → merge dormant cost 0.
- ai_cost 등급: **zero**(순수 코드/문서/테스트 — STEP-1,2,3,4,5,8) / **build-dormant-zero**(flag default-off 머지 cost 0, 실 트리거 USER — STEP-6,7,9,10) / **user-gated-nonai**(비-AI지만 외부 API·USER 환경·수동 — STEP-11,12).
- Owner: STEP-11/12만 SHARED, 나머지 CLAUDE.

## 5. 스코프 가드 결과 (Workflow ScopeGuard agent)

- **verdict: PASS** — 12 step 전부 sot_citation을 SoT 4소스 + 코드에 직접 대조, 근거 없는 인용 0건, 기획 밖 신규 작업 0건.
- 경미 보완 3건(impl 단계 권고, plan 채택 차단 아님):
  1. STEP-4 insertCostLog 파일 위치(anthropic-client.ts) + '정밀화' 워딩 정정.
  2. STEP-6↔7 Section 8 Part A 렌더 책임 경계 분리(redundant render risk).
  3. STEP-6 PR-H enrich source swap(placeholder→실 DART, 비용 0 코드) 귀속 step 확정.

## 6. 다음 액션

1. **omxy 합의** (②③): 본 1차 플랜을 omxy 적대 검토 + direct-edit → Claude 재검증 → CONVERGED.
2. CONVERGED 후 **STEP-1부터 §2.0a 4-step 실행**. 각 step 완료 시 HANDOFF/ProgressDashboard 동기화(문서 검증도 동일 프로세스).
