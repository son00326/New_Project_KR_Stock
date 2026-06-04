# Smoke / B66 / PR5 readiness audit catalog (B65~B98 + W-ticket)

> **출처**: 이전 `Document/Process/HANDOFF.md §9`에서 분리 (docs/handoff-consolidation, 62차+ HANDOFF 단일화·정리).
> **목적**: PR4 + B65-P1/P3 + 마이그 0025 + Vercel env=true + Task 5 B66 PRODUCTION COMPLETE 이후 잔여 audit 항목(B67~B98)·W-ticket·Smoke 2-stage 기준의 full catalog.
> HANDOFF `§9` stub은 **ACTIVE blocker만** 요약하고 본 문서를 포인터로 가리킨다 (§ 번호 보존). 세부 항목별 priority 재할당·신규 catch 추가는 Task 8 audit phase에서 본 문서에 직접 갱신.
>
> **65차(2026-06-04) supersede 노트**: 본 catalog의 model hardcode(B73/B85), hardcap 수치(B76/W-pr5-readiness), 선정주기 단일 배치(B71/W-pr5-readiness), 30 전체 운용(W-pr5-readiness) 가정은 65차 7결정(Q1 주간/월간 split · Q2 AI 자율 포트 · Q3 모델/프로바이더 추상화 · 결정5 hardcap 50만)으로 supersede됨. 빌드 순서 W0→W2→W1→W3. PR-G ⓑ는 W0~W3로 superseded. 개별 B-ticket의 과거 omxy lifecycle/timeline(§9.6/§9.7)은 history-leave (수정 금지). 상세: HANDOFF.md ⭐ 65차 MVP 엔진 섹션.

---


> **삭제 조건**: §2.1 active 8-row matrix Task 1~7 모두 PASS (production audit + B65-P1/P2/P3 + B66 C 하이브리드 backfill + Smoke Stage 1+2 PASS) 시 본 §9 + 8-row matrix를 HISTORICAL로 강등하고 PR5 active submatrix로 교체.

### 9.1 발견 경위 (요약)

PR4 MERGED `7de9696` 직후 사용자 catch — Supabase 직접 query 결과 `cost_log=0` / `stock_reports=0` / `committee_votes=0` / `short_list_30=30` (sector placeholder) → **B65 3-phase 분리 catch**. 원인 = `cron monthly-batch` mock throw (B67) + `update_report_sections_0_7` UPDATE-only RPC (마이그 0022, row 부재 시 fail). PR4 lifecycle 테스트가 RPC를 mock하여 production-only로 잠복. 상세 forensic = 56차 §5 commit history + git log + PR #19 body 위임.

### 9.2 B65 3-phase status — production functional enabled, Smoke pending

**원인**: writer Opus + critic Haiku + 조건부 revise (1~3 LLM calls, exact cost = smoke 후 `cost_log` 기준 확정 — B91 박제) 후 `update_report_sections_0_7` RPC가 row 부재 시 fail → AI 토큰 비용 burn + UI에 기술적 에러 문구 노출 (`format-error.ts` 매핑 존재하지만 사용자 가독성 낮음 — B101 정정).

**3-phase 분리** (omxy R7 B94 lock-in):

1. **Phase 1 — P1 immediate guard**: `triggerFullReport`에 row-missing preflight 추가. historical 목적은 P2/P3 전 cost burn 차단. 현재는 Phase 3 + Vercel env=true로 real path 가능.
2. **Phase 2 — P2 real enablement ✅ spec doc CONVERGED R8 final (57차 §2)**: **옵션 A 채택 lock-in** — admin-only `upsert_report_sections_0_7_admin` RPC, UPSERT (INSERT if missing, UPDATE if exists), section_0~7 + appendix only, 4-grant 패턴 (service_role grant 금지), version/schema_version/regen_* counter 불변 invariant. axis (i)A admin trigger 책임 = section_0~7 only / axis (ii) B79 deferred → PR5 plan / axis (iii) PR5 cron path 충돌 없음. 옵션 B (`commit_persona_eval` 연계)는 admin UX 변경 + 비용 5-10x → 사용자 lock-in 도달 위험으로 reject. 옵션 C (synthetic) = Kevin v3.1 M3 no-fabrication 위반 + Track Record corruption으로 폐기. 상세 spec doc: `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md`. **Task 4 = 마이그 0025 + feature flag impl PR**.
3. **Phase 3 — P1/P2 호환 (B94 critical)** — P2 도입 시 P1 guard를 P2 path와 호환되게 수정 (영구 disabled risk 차단):
   - (i) **feature flag** (env `PR4_TRIGGER_UPSERT_ENABLED=true`) — **default recommended** (simple, deterministic, no runtime overhead). **B98 lock-in**.
   - (ii) RPC presence check (runtime DB introspection) — **비추천** (매 클릭마다 DB query + 권한/스키마 노출 risk).
   - (iii) atomic transaction prepare (P2 RPC가 AI 호출 전 placeholder row를 transaction 안에서 prepare → 실패 시 rollback, P1 guard 불필요) — **secondary** (transaction boundary 복잡도 증가).

**smoke는 Phase 3 후만 가능** (P1 + P2만으로는 trigger 영구 disabled risk).

**B86 fix (month format)**: `triggerFullReport` input `month: YYYY-MM` (e.g., `2026-06`) vs `reportExistsForMonth` DB month는 `date` (YYYY-MM-01). 미박제 시 preflight 항상 false → trigger button 영구 disabled risk.

### 9.3 B66 quality/trust blocker + B84/B89/B93 — Approach lock-in: C 하이브리드

`short_list_30` legacy sector="코스닥"/"코스피" placeholder 문제는 60차 §5에서 production resolved. C 하이브리드가 재발 방지용 결정이며, 현재 2026-05 production 30 rows는 canonical 14 only(B93 PASS)다.

**B66 결정/구현/운영 완료 (2026-05-28~29)**: **C 하이브리드**. A(매월 수동 큐레이션 맵) 단독은 PR5 cron 월간 batch마다 재발하고, B(DART 단독)는 소형주 모호/오분류 risk가 있어 채택하지 않음. PR #55 plan SoT `bbf102d` + PR #56 impl `058a372` + PR #57 pagination hotfix `bbd33c6` + PR #58 override `f2b24e9` + 60차 §5 production execution 모두 완료.

**설계**:
- **Seed pipeline 영구화**: `scripts/screen_shortlist_tier0.py::fetch_universe`의 현재 placeholder(`sector = "코스피" if market == "KOSPI" else "코스닥"`)를 canonical 14 mapper로 대체.
- **Primary**: DART `induty_code`(한국표준산업분류/KSIC) → canonical 14 crosswalk. `seed_dart_corp_codes.py`에 `--backfill-induty` flag를 신규 추가해 DART company.json API 단건 호출로 `induty_code` fetch/cache. default corp_code seed 동작 영향 0.
- **Fallback**: 수동 override map. DART 업종이 모호하거나 소형주 오분류가 의심되는 종목만 override.
- **SoT 재사용**: `tudal/src/lib/screening/canonical-sectors.ts`의 `CANONICAL_SECTORS` 14 + `LEGACY_ALIAS_MAP` + `SUB_TAG_CROSSWALK`.
- **결과 상태**: 2026-05 30개 production backfill 완료 + 미래 모든 PR5 cron monthly batch가 자동으로 canonical 14를 부여해 placeholder 재발 차단.

**B93 PASS criteria 3종** (모두 만족):
1. 30 rows all sector ∈ `CANONICAL_SECTORS` (14 enum 정합)
2. sector ∉ ('코스피', '코스닥') — placeholder 잔존 0
3. optional `sub_tags` 정합 (jsonb null OR string[], 마이그 0018 schema 정합)

**B89 unknown ticker 처리 lock-in (PR #55 R1)**:
- unresolved row가 1개라도 있으면 dry-run은 review CSV + exit 2, `--apply`는 DB write 전면 거부.
- 해결 경로는 mapper rule 보수 또는 `sector_override.json` PR이며, lightweight manual review는 override 입력으로만 반영.
- `unknown_pending`은 production `short_list_30.sector`에 저장 금지 (B93 위반).

**Production write gate**: 일반 원칙은 production write USER-gated. 단, 60차 §5는 사용자 명시 "권한 다 줄게"에 따른 **본 Task 한정 예외**로 Claude가 마이그 0026 apply + DART API backfill + `screen --apply`를 실행했고 B93 PASS까지 검증했다. 이 예외는 영구 default가 아니며, 이후 Vercel env/secrets/billing/live-money/실 AI cost burn은 계속 USER gate.

**박제 원칙**: sector="코스피"/"코스닥" placeholder 영구 허용 X. 모든 30 rows 시점 도달 시 canonical14만 허용하며, unresolved/unknown은 production apply 전 strict block.

### 9.4 Smoke 2-stage 분리 (B97 lock-in)

Stage 2는 USER 비용 승인 후만 진입. Stage 1 dry-run/TDD는 cost=0 optional prep이지만 다음 명시 gate는 Task 7 USER 승인이다.

**Stage 1 — non-AI dry-run/integration test** (real cost = 0):
- `triggerFullReport` server action에 mock `orchestrateFullReport` 주입 (vi.doMock)
- P1+P2+P3 호환 invariant test: P3 호환 완료 시 P2 path 진입 (mock called) / 비호환 시 P1 fail-fast (mock not called)
- **B96 target**: short_list_30 존재 + stock_reports 부재 ticker (production 30 rows 모두 정확히 그 상태)
- TDD 단위 테스트로 적용

**Stage 2 — single real AI smoke** (USER 승인 후 1회):
- production env에서 admin UI click OR server action 직접 호출
- **B85 model id verify 선행**: 존재하지 않는 model env var(`ANTHROPIC_OPUS_MODEL_ID` 등)가 아니라 코드 hardcode 모델을 1-token API로 직접 확인한다 — writer/revise `claude-opus-4-7`, critic `claude-haiku-4-5-20251001`.
  > **65차 supersede**: Q3 모델/프로바이더 추상화 LOCKED — 모델 하드코딩(`claude-opus-4-7`/`claude-haiku-4-5`) 제거 + 모델 레지스트리·역할별 모델 차등(토론=저가 Haiku/GPT-mini, judge·리포트=고가 Opus 4.8+)·멀티프로바이더(Claude+GPT, availability auto-detect)로 대체 예정(W0). 본 B85 hardcode verify는 W0 전 잠정 기준이며, W0 구현 후 레지스트리 기반 model id verify로 재정의된다. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)
- **B87 PASS criteria 5종**:
  - **Core (필수, 모든 옵션)**: 1 `cost_log` row exists / 2 `stock_reports` row + section_0~7 + appendix all non-null + zod schema valid / 3 `report_critic_findings` row (critic 6-axis verdict) / 5 `/admin/report/[ticker]` UI **정상 본문 또는 의도된 SectionFallback 렌더** — raw/technical/`format-error.ts` 매핑된 에러 메시지 노출 시 모두 FAIL (B107 정정 — 매핑된 에러 메시지도 upstream issue 신호이므로 PASS 아님)
  - **Full-path (옵션 B만)**: 4 `committee_votes` row(s) — 11 core + 0~14 sector
- **PR5 cron-persist canary 별도 필수**: Task 7 admin smoke는 `upsert_report_sections_0_7_admin`, PR5 cron은 service-role `upsert_report_sections_0_7_cron`이므로 동일 검증으로 간주 금지. 마이그 0027 apply + flag/env 설정 후 service-role 경로로 1 ticker `upsert_report_sections_0_7_cron` → `stock_reports` row 생성/갱신 확인(테스트 row 정리 또는 동일 월/ticker 의도 확인).
- real cost = `cost_log` 기준 확정 (token usage 기반, production 환경별 변동 — 수치 박제 금지 B91)

### 9.5 audit catalog (B103+B106 정정 — B67~B85 항목별 1줄 + B79+B81~B85 알려진 항목 + 카테고리 buckets)

> **박제 원칙 (B106 정정)**: omxy R2 형성된 B67~B80 잠재 follow-up catalog + R3 형성된 B81~B85 알려진 항목을 항목별 1줄 박제. 본 catalog는 R10 시점 정렬 — 다음 세션 audit phase 진입 시 항목별 priority 재할당 및 신규 catch 추가.

**R2 audit catalog (B67~B80, 항목별 1줄)**:
- **B67** — cron path 자동 호출 결함 (`tudal/src/app/api/cron/monthly-batch/route.ts`의 `mockTier0Source` / `mockCallPersonaPanel` throw 패턴). PR5 진입 전 필수 해소.
- **B68** — AI key 발급/충전 완료에도 `cost_log` = 0건 (성공/기록된 호출 없음). B65 RPC 의존 + cron path mockTier0Source throw 양쪽 영향.
- **B69** — `committee_votes` = 0건. B79 RPC 책임 boundary 결정 + B65-P2 옵션 A/B 선택 결과로 결정.
- **B70** — Regen UX (`/admin/report/[ticker]/regenerate`) admin path swap 후 첫 실 호출 검증 필요. PR4 Task 2.3 Regen orchestrate wire commit `8b63e1f` MERGED.
- **B71** — `short_list_30` stale data (2026-05-12 legacy mechanical seed 1회, B66 placeholder + ~14일 stale). C 하이브리드 적용 후 **(65차 Q1 supersede)** PR5 cron은 선정주기 분리 — 단기 주1회 / 중장기 월1회 신규 row INSERT가 모두 canonical 14로 생성되는지 확인 (기존 월1회 단일 배치 30 동시 선정 가정은 stale). sector 정합 verify 로직은 주기 무관 동일. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)
- **B72** — row-missing preflight 통합 (B65-P1 `reportExistsForMonth` + 향후 cron path 호환). B86 month format 박제 적용 후 helper 통일.
- **B73** — model id verify timing (B85 1-token test 시점 = Stage 2 진입 직전). 검증 대상은 (65차 Q3 supersede·W0 후) 모델 레지스트리/설정값 + 멀티프로바이더(Claude+GPT, availability auto-detect) + 역할별 모델 차등(토론=저가, judge·리포트=고가). **W0 전 잠정 hardcode**(historical): writer/revise Opus, critic Haiku + `ANTHROPIC_API_KEY`. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)
- **B74** — `cost_log` accounting (writer + critic + 조건부 revise 토큰 사용량 정확 적재). persist fail 시 적재 보장 + alert.
- **B75** — RPC responsibility boundary (Section 8 partA/partC/partD + committee_votes의 admin/cron path 동일 RPC 사용 여부 결정 — B79와 연계).
- **B76** — hardcap mock vs real 일관성. **65차 결정5 LOCKED**: hardcap = **50만원**(기존 40만에서 상향). 본 audit이 참조하던 16,050원/월 수치는 stale — active hardcap SoT는 50만원으로 정합. enforce 트리거 및 alert 발송은 50만원 기준 (35만원 경보/COST_WARNING_THRESHOLD는 값 유지·65차 W0에서 재산정). (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)
- **B77** — main HEAD fixed SHA 박제 금지 (R2 시점 박제 — §0 verify에 `git rev-parse --short origin/main` 동적 확인 의무화, commit `dff1cbe` §0 적용 완료).
- **B78** — silent null drop metric/log 격상 (PR3a P2 / red-team RT#2 / gsd CR-01 박제 — §4 잔여 reference). 현재 console.warn → metric/structured log.
- **B79** — Section 8 partA/partC/partD + `committee_votes` RPC 책임 boundary 결정. **57차 §2 R8 lock-in: 옵션 A 채택 ✓ → B79 deferred to PR5 plan** (commit_persona_eval + service-role caller wire + B79 RPC 통합을 PR5 plan R-debate에서 동시 결정).
- **B80** — PR4 14 defer follow-up tickets (W-1 callerKind dead code / W-2 fetchTrackRecord* in actions.ts / W-4 sub_tags / W-5 user.email / W-6 as never cast / Track 3 I1-I6). 본 audit 시점에 일괄 분류.

**R7 (57차 §2 R-debate) 신규 audit ticket 6종** (옵션 A 채택 lock-in 후속, spec doc §6):
- **B-versioning** — 옵션 A versioning policy = (1) overwrite-in-place 채택 (0017/0022 패턴 보존). version/schema_version/is_latest/regen_* counter 불변 invariant. (2) auto-flip + version bump 재설계는 PR5 plan R-debate에 deferred (cross-cutting 결정 — commit_persona_eval + update_report_sections_0_7 + admin RPC + regen 모두 영향).
- **W-tier1pill** (PR4 post-merge follow-up ticket) — Section 8 absent 리포트 = Tier 1 평가 대기 pill UI 추가. D11 운용 검증 acceptance gate. HANDOFF §2.1 Step 8 (D11 AI 가상 포트 1차 가동 게이트) 본문도 acceptance gate 명시로 갱신. omxy R1 h + critic W3 + omxy R2 e' + R3 ε 박제.
- **W-grant-smoke ✅ RESOLVED in 58차 (마이그 0025 production apply + verify)** — Layer 1 has_function_privilege 4-grant matrix verified (service_role=false / authenticated=true / public/anon=false) + Layer 2 (PostgREST permission_denied) = Smoke Stage 2 진입 시 functional canary로 검증 예정. exact 11-arg regprocedure signature 적용 + pg_get_functiondef로 body 1:1 정합 확인. omxy R1+R2 CONVERGED. **Layer 2 PostgREST smoke만 Task 7 USER 게이트로 잔여**.
- **W-sectionfallback-text** — SectionFallback 문구 "후속 PR3b (writer Section 0~7 본문 구현)에서 채워집니다"는 stale (PR3b 이미 MERGED `cf68731`). Tier 1 평가 대기 pill 도입 시 함께 정정. page.tsx line 336~346.
- ✅ **W-cost-log-env-gate** — Vercel production env `AI_COST_LOG_REAL_INSERT_ENABLED=true` 설정 완료(2026-05-28 기준 24h ago 확인). Task 7 sequence는 env값 재확인만 수행; gate 자체는 fully resolved.
- **W-pr5-readiness** — PR5 cron path quality는 **B65-P2 옵션 A와 독립**. PR5 readiness = (a) commit_persona_eval에 service_role grant 추가 (B79와 동시) + (b) service-role caller DI wire + (c) **(65차 supersede·Q1+Q2+결정5)** 선정주기 분리(단기 주1회 / 중장기 월1회 — 기존 월1회 단일 cron 30 자동은 stale) + AI 자율 포트구성(30 중 운용여부·총개수·종목·단중장분배·비중·현금0~30% 전부 AI 자율 — 기존 항상 30 전체 운용 가정은 변경) + hardcap **50만원**(기존 16,050원/월 stale) · 토론 loop(W1)·자율 포트(W3) 빌드 순서 W0→W2→W1→W3 (PR-G ⓑ 150×11 opus 단발선정은 W0~W3로 superseded — 코드자산 재사용) + (d) 큐 인프라 (Vercel Queues OR 자체 DB job queue) 모두 PR5 plan에서 별도 해결. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)
- **W-mock2-rls-drift** (58차 Step 2.1 omxy R1 WATCH defer) — `/admin/alerts` empty state ("0건 = 실제 미발생") 문구는 env `ADMIN_EMAILS` ↔ DB `admin_emails` allowlist sync 전제. drift 시 RLS deny로 0 rows처럼 보일 가능성 있음 (blocking 아님). admin read assertion / diagnostic 검토 — 별도 hardening 트랙. Step 2.2+ (settings/health/cost/regenerate)에도 동일 패턴 잠재 → 통합 follow-up.
- **W-cost-log-admin-assertion** (58차 Step 2.3 omxy R1 HIGH-2 + R2 MEDIUM-3 defer) — `cost_log` SELECT RLS `using (is_admin())`는 non-admin 호출자에게 0 rows silent return (throw 안 함). regenerate `getMonthlyTotal`은 mock과 동일하게 silent-0 → hardcap=0 unblocked로 처리. admin path는 회귀 0이지만, audit invariant 측면에서 fail-closed 보증 부재. hardening = (a) `triggerFullReport`/`regenerateReport` 진입 시 `rpc('is_admin')` 명시 assertion (B-trackrecord-rls 58차 PR #31 패턴) 또는 (b) `get_cost_log_monthly_total_admin` SECURITY DEFINER RPC + `not is_admin() → raise` 내부. Step 2.3 mock parity 유지 → 별도 트랙. W-mock2-rls-drift / W-s5b-admin-assertion 통합 sweep 후보.
- ✅ **W-news-cron-service-role-read** (59차 Step 2.6 PR #46 omxy R1 HIGH defer → Step 2.7a PR #48 half-resolved → **Step 2.7b.1 PR #50 fully resolved**) — 3-step chain 완성: Step 2.6 helper 마이그 + Step 2.7a DI seam (`options.client?`) + Step 2.7b.1 route wiring (`createServiceRoleClient()` 주입 in news-sweep + morning-briefing). cron context RLS using(is_admin()) 우회 완료. monthly-batch (PR #30) + silent-health (PR #48) + news cron (PR #50) 모두 service-role 일관 사용. **historical 박제** (잔여 hardening 없음, INSERT path는 Step 2.7b.2 별도 scope).
- **W-pipeline-health-admin-assertion** (59차 Step 2.5 PR #44 defer / Step 2.7a PR #48 READ side resolved) — cron READ path는 `admin-pipeline-health.ts` DI seam + silent-health service-role 주입으로 RLS 우회 완료. **잔여**: (a) silent-health heartbeat_log/pipeline_health INSERT side는 Step 2.7b.2, (b) admin/settings/health session-client page의 explicit admin assertion hardening은 W-cost-log-admin-assertion / W-mock2-rls-drift 통합 sweep 후보.
- **W-pipeline-health-window-hardening** (59차 Step 2.5 PR #44 omxy R2 non-blocking WATCH defer) — 7일 window는 현재 pipeline_health=0 rows / cron 미가동에서 적절. future high-frequency telemetry (cron 가동 + 5 파이프라인 × 분 단위 run) 시 client-side fetch 비효율 (PR5 cron 가동 후 일 단위 5×60×24 = 7200 rows/day → 7일 = 50k rows pagination = 50 round trips). hardening = SECURITY DEFINER RPC `get_pipeline_health_summary_admin(p_window_hours)` (server-side aggregate + recent failures tail, transaction snapshot 내부, is_admin guard) — W-pipeline-health-admin-assertion과 통합 가능. PR5 cron 가동 + Smoke Stage 2 PASS 시점에 hardening 트랙 진입.
- **W-cost-log-core11-drift** (59차 Step 2.4 PR #42 omxy R2 non-blocking WATCH defer) — `tudal/src/lib/data/admin-cost-log.ts`의 `CORE_11_PERSONA_IDS` Set은 11 production persona.id (`tudal/src/lib/ai/prompts/personas/*.ts`)와 hardcoded 1:1 정합. future persona 추가 / 이름 변경 시 Set drift 가능 → 신규 persona가 `'committee'` 매핑되지 못하고 `'other'` fallback. Step 2.4 scope에서는 exact match가 목적이고 prompts directory import (runtime 의존성 증가)보다 surgical Set 채택이 안전 (omxy R2 lock-in). hardening 옵션 = (a) build-time grep으로 personas/*.ts에서 id 추출 후 Set 생성 / (b) `tudal/src/lib/ai/prompts/personas/index.ts`에 canonical export 추가 후 import / (c) test에 persona file count 검증 추가 (drift detect). 새 persona 추가 commit 시 함께 갱신 권장.
- **W-cost-log-pagination-snapshot** (58차 Step 2.3 omxy R5 MEDIUM defer) — `getMonthlyTotal` pagination loop의 `.order('called_at') .order('id')` deterministic ordering은 application-level monotonic 가정에만 의존. `insertCostLog`의 `CostLogRow` interface에 `called_at` 필드 부재 → TS callers는 강제 못 함 → DB default(now())로 가는 path만 보장. schema에 `CHECK (called_at >= ...)` 부재 → direct SQL / future code / manual admin INSERT가 backdated called_at으로 우회 가능. PostgreSQL now()도 transaction start time이라 parallel insert / NTP step / 동일 microsecond에 정확한 commit-order sequence 아님. 잔여 risk = 월 1000+ rows 시 backdated/parallel INSERT가 기존 page boundary 앞에 들어와 page 간 row skip/duplicate → hardcap undercount fail-open. 현재 production reality (cost_log=0 + 월 ~150 rows 추정 + 어드민 3인 manual click 동시성 거의 0)에서 실현 가능성 매우 낮지만, 월 cron 가동 + 1000+ rows 도달 시 완전 차단 필요. hardening = (a) SECURITY DEFINER RPC `get_cost_log_monthly_total_admin(p_month)` (server-side SUM, transaction snapshot 내부, is_admin() guard) — W-cost-log-admin-assertion과 함께 통합 가능 / (b) schema `ALTER TABLE cost_log ADD CONSTRAINT cost_log_called_at_no_backdate CHECK (called_at >= (now() - interval '5 minutes'))` 마이그. PR5 cron 가동 + Smoke Stage 2 PASS 시점에 hardening 트랙으로 진입.

**B-trackrecord-rls ✅ RESOLVED in PR #31 MERGED `838386e` (58차 follow-up, omxy R1 CONVERGED)** — `triggerMonthlyPersonaEvalAction`의 admin assertion이 `from('admin_emails')` 직접 SELECT (RESTRICTIVE RLS using(false)로 real admin 전원 오차단)였던 latent bug를 `rpc('is_admin')`로 교체. Task 4 R3 mechanical extension. src 전체 production action에서 `from('admin_emails')` 직접 SELECT = 0건 확인 완료.

**R3 알려진 항목 (B81~B85)**:
- **B81** — 단일 실 AI smoke 비용 분석 (per-call low / batch large). Stage 2 cost 추정 reference.
- **B82** — B65 docs-only 박제 strict (본 세션 내 코드 변경 금지). 다음 세션에서 해제.
- **B83 / B84** — `short_list_30` C 하이브리드 backfill verify command (seed pipeline DART induty mapper + override fallback 실행 후 `select sector, count(*) from short_list_30 group by sector` cross-check). B66 Task 5 PASS criteria 1~3.
- **B85** — 다음 세션 Stage 2 진입 직전 1-token model id verify. **65차 Q3 supersede (W0 이후)**: 모델은 설정값화·레지스트리 기반으로 verify한다. 역할별 차등(토론 참가=저가 Haiku/GPT-mini / 최종 judge·리포트=고가 Opus 4.8+) + 멀티프로바이더(Claude+GPT, GPT키 미발급 시 Claude-only auto-detect). env var/model id 실 검증은 W0 코드 구현 scope. **W0 전 잠정 hardcode**(historical): writer/revise `claude-opus-4-7`, critic `claude-haiku-4-5-20251001`, 공통 `ANTHROPIC_API_KEY` — W0 추상화 구현으로 폐기 예정. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)
- **W-cost-atomic-reservation** — PR5 go-live deep review MED follow-up. 현재 cost gate는 sequential+chunk=3+per-attempt `getMonthlyTotal` 재읽기+400k headroom으로 hardcap 초과 가능성이 낮고 alert가 있으나, LLM 호출 후 `insertCostLog` 실패 시 spend-before-log gap으로 월 누적 undercount 가능. go-live blocker는 아니며 후속 hardening: 선차감 reservation/atomic ledger 또는 `insertCostLog` 실패 시 batch stop + explicit reconciliation alert.
- **W-pr5-cron-persist-canary** — admin Task 7 smoke(`upsert_report_sections_0_7_admin`)와 cron persist(`upsert_report_sections_0_7_cron`)는 다른 RPC/권한 경로. 마이그 0027 apply 후 PR5 flag-on 전후로 service-role cron UPSERT 1회 canary를 별도 수행해 `stock_reports` row 생성/갱신을 확인.

**post-merge production deploy verify (추가)**: public canary는 완료. 다음 권장 = 인증 세션 canary (`/admin/settings/cost`, `/admin/report/[ticker]/regenerate`, `/admin/portfolio` 버튼 노출/경고). **실 trigger 클릭은 Task 7 비용 승인 후만**.

### 9.6 omxy lifecycle (historical — git log + PR body 위임)

56차 §5 post-merge omxy R1~R8 CONVERGED (B65~B107 catalog 형성) + 57차 §1 PR #21 R1~R4 CONVERGED + 57차 §2 Task 3 R1~R8 ESCALATE max-8 mechanical-final + **57차 §3 Task 4 plan R1~R5 CONVERGED Ramanujan R5 CATCH 0** → 누적 catch와 라운드별 lessons는 **56차 §5 docs cleanup commit + 57차 §1 commit chain + 57차 §2 spec doc §6 + 57차 §3 plan §부록 D + PR #28 body + git log + PR body**로 위임. active 박제는 §9.2~§9.5 본문에 일원화.

### 9.7 57차 §1+§2+§3 진행 — Task 1+2+3 ✅ + Task 4 plan ✅ MERGED (B65-P1 MERGED + B65-P2 spec doc CONVERGED + B65-P3 impl plan SoT MERGED in main `2859c68`)

57차 §1 진행 결과 (historical):
- **Task 1 (production audit)** ✅ COMPLETED — drift 0
- **Task 2 (B65-P1 immediate guard + B86 month format)** ✅ MERGED in main `5b99e03` (PR #21, Vercel deploy SUCCESS)
- omxy 4 rounds CONVERGED (R1 Hegel / R2 Leibniz+McClintock / R3 Hubble / R4 Locke + gstack ship sanity)

57차 §2 진행 결과 (active):
- **Task 3 (B65-P2 RPC R-debate spec doc)** ✅ COMPLETED — CONVERGED **R8 final** (옵션 A lock-in)
- **omxy R-debate 8 rounds (R8 SIGNAL=ESCALATE max-8 정합 §7.5)**:
  · R1 plan: debate-with-omx + native critic Godel (5 BLOCKERS + 4 WATCH)
  · R2 R-cycle: + native critic Feynman (5 stale/overclaim)
  · R3: + native critic Planck (5 catch β/γ/δ/ε/η)
  · R4: + native critic Schrodinger (3 catch — cost_log pre-parse / service_role exact signature / nullable)
  · R5: + native critic Franklin (2 BLOCKER — §4.4 regen + HANDOFF PR5 wording)
  · R6: + native critic Hypatia (1 BLOCKER + 2 minor)
  · R7: native critic agent thread limit (2 BLOCKER — incrementManualRegenCount RPC 오기 + global sweep)
  · R8: ESCALATE max-8 + 3 mechanical fix (§5 R8 / §6 R8 결정 / 부록 B header R1~R8)
  · **누적 catch 30+ 모두 fix 반영**
- **결정 lock-in (R8 final)**: 옵션 A `upsert_report_sections_0_7_admin` + axis (i)A admin trigger = section_0~7 only + axis (ii) B79 deferred → PR5 plan + axis (iii) PR5 no-conflict

**57차 §3 진행 결과 (active)**:
- **Task 4 plan SoT (B65-P3 P1/P2 호환 feature flag + 마이그 0025 impl plan)** ✅ COMPLETED — plan SoT MERGED in main `2859c68` (PR #28 rebase FF + delete-branch + HANDOFF sweep R1~R2 Descartes CATCH 0 CONVERGED)
- plan = `docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md` (929 lines)
- **omxy R-debate R1~R5 누적 23 BLOCKERS catch & fix + native critic 6명 (Schopenhauer R1 parallel + Kepler R1 omxy + Plato R2 + Sartre R3 + Aristotle R4 + Ramanujan R5)**:
  · R1: Schop 8 BL + Kepler 3 BL + omxy 3 BL = 11 unique BLOCKERS + 9 WATCH + 7 MINOR (fix commit `98b9a18`)
  · R2: Plato 6 catch + parent 1 WATCH = 3 BLOCKERS + 4 WATCH (fix commit `8a6ffb1`)
  · R3: Sartre 6 catch = 2 BLOCKERS + 4 WATCH (schema mismatch + DB coverage 분리, fix commit `0a082c7`)
  · R4: Aristotle 2 catch = 1 BLOCKER + 1 WATCH (SET LOCAL transaction wrapper, fix commit `940d658`)
  · **R5: Ramanujan CATCH 0 — SIGNAL: CONVERGED** ✅
- **핵심 lessons (impl PR scope에 1:1 박제)**: Kepler B2 critical (service_role 명시 REVOKE) + Schop B5 critical (.env.example=false safe local) + Schop B3 (error literal rpcName guard) + Schop B7 + Sartre B2 (DB Phase A+B 분리) + Sartre B1 (schema verified) + Aristotle B1 (SET LOCAL begin/commit) + Plato B2 (grep scope impl-only)

**B65 3-phase 진행률**:
- **P1** ✅ MERGED in main `5b99e03` (57차 §1 PR #21 production active, cost burn 0)
- **P2** ✅ **spec doc CONVERGED R8 final (57차 §2 Task 3)** — 옵션 A lock-in
- **P3** ✅ **impl MERGED in main `3c09d6e` + 마이그 0025 production applied + Vercel env=true** (PR #30, 58차 Task 4)

**B66 진행률**: ✅ **PRODUCTION COMPLETE** (60차 §5 Claude 권한 위임 실행, 2026-05-29). plan SoT `bbf102d` PR #55 + impl `058a372` PR #56 + pagination hotfix PR #57 + override 4→7 PR #58 `f2b24e9` 모두 MERGED. 마이그 0026 production applied + dart_corp_codes induty 2,766/2,766 ok + short_list_30 30 rows canonical 14만 + **B93 PASS verify** (Supabase MCP: total=30/canonical_14=30/placeholder=0/non_canonical=0/unresolved=0). production state: 반도체 10 / 에너지 4 / IT/SW 3 / 바이오 3 / 유통/소비재 3 / 2차전지 2 / 자동차 2 / 건설 1 / 금융 1 / 통신 1 = 10 canonical sectors 다양화.

**Smoke 진행률**: 다음 1순위 = Task 7 Stage 2 single real AI USER 1회 비용 승인. Vercel env는 true 완료; Stage 2 직전 B85 1-token model id verify + env 재확인 필요.

**post-§5 production audit**: cost_log=0 / stock_reports=0 / committee_votes=0 / short_list_30=30 canonical 14 only — Task 5 B66 complete, Smoke/PR5 실행 전 drift 0.

**SCOPE GUARD 박제 (60차 §5 종료 시점)**: 60차 §3 modified workflow와 60차 §5 Claude 권한 위임 실행은 본 Task 한정 예외이며 영구 default 아님. Task 5 production write는 완료. 이후 USER-only: Vercel env/secrets/flag toggle, external account, billing/live-money, 실 AI cost burn trigger. 다음 1순위는 Task 7 USER 비용 승인 후 smoke, 이후 Task 8/PR5 sequence.
