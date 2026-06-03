# S7 실데이터 전환 — Mock fixture → 실 API·실 DB·실 AI 호출

> **[HISTORICAL — 53차 §5 정정으로 강등, 본 banner는 진행 안내 아님]** 53차 §3 (2026-05-21): S7a Anthropic wrapper main 박제 완료 + Tier 2 Step 3b 207 persona Kevin v3.1 quality 본문 완성 (PR #7→#8→#9 모두 MERGED, mergeCommit `02c7947a`→`db7797a`→`131ac38f` historical chain). Layer (a~g) 6+3 sub-step + 마무리. 207 × 8 markers = 1656 assertions 전수 통과. **현재 상태 + 다음 진행은 아래 §5 정정 박제 참조.**
>
> **54차 §3 박제 (2026-05-22)**: **PR #12 (PR3a Group H stock_reports schema drift fix Critical Hard gate) MERGED in main `0813a41`** — admin-reports.ts zod validation + `ValidatedStockReport` + `parseSectionSafe`/`parseReportSection8` onError 콜백 + page.tsx null guard + Section 8 dual-shape renderer + `partCToCommitteeAgg` helper. omxy R1~R12 + R7 Codex `/review` GATE PASS + gsd + gstack testing + red-team 다중 review CONVERGED. **Group H Hard gate ✅ 해소**. canonical 5-PR: PR2 ✅ → PR3a ✅ → PR1 → PR3b → PR4. Step 3c caller wiring = PARTIAL — dangling server action (PR1 cron wire + PR4 UI wire에서 해소 예정). T7e.8 Tier 0 단독 30 rows = **fallback 상태** (메인 path 아님). 메인 path = Tier 1 AI 30 선정 (PR2 코드 + PR3a 검증 인프라 main 박제, PR1 cron wire 시점 가동). spec doc: `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md` + plan/REVIEW: `docs/superpowers/{plans,reviews}/2026-05-22-pr3a-group-h-schema-drift{,-review}.md`.

> **53차 §5 정정 박제 (2026-05-21, R6 추가 fix 반영, 54차 §3 PR3a로 Hard gate 해소됨)**: Step 3c caller wiring = **PARTIAL — dangling server action** (PR1+PR4에서 해소). T7e.8 박제 정정: Tier 0 단독 30 rows = **fallback 상태** (메인 path 아님). 메인 path = Tier 1 AI 30 선정 (PR2 후속). canonical PR 순서 = PR2 → PR3a (Group H schema drift fix Hard gate) → PR1 → PR3b → PR4. omxy R1~R7 7 rounds CONVERGED-track **32 BLOCKERS catch & fix**. spec doc: `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md`.

```
---
slice_id: S7
slice_name: 실데이터 전환 (Supabase 실 I/O + Anthropic 실 호출 + 외부 API 5종 연결)
architect_id: S7
status: 🟢 진행 중 (S7e 자율 트랙 — T7e.1~T7e.6 ✅ + T7e.8 DART Signal 4·5 production apply ✅ + T7e.7 QA 잔여)
expected_sessions: 8 (S7a 1 + S7e 2 + S7b 2 + S7c 2 + S7d 1)
current_progress: ~50% (S7e 7/8 sub-task, T7e.8 DART 실데이터 short_list_30 적용 완료 — T7e.7 RLS QA 잔여)
---
```

Last updated: 2026-05-22 (54차 §3 — **PR #12 (PR3a Group H stock_reports schema drift fix Critical Hard gate) MERGED in main `0813a41` + post-merge docs refresh**). omxy R1~R12 + R7 Codex `/review` GATE PASS + gsd + gstack testing + red-team 다중 review CONVERGED. canonical 5-PR: PR2 ✅ → PR3a ✅ → PR1 → PR3b → PR4 (잔여 3-task). 다음 1순위 = CLAUDE **PR1 (cron `monthly-batch` real path enable + server-callable trigger function)**. PR3a 신규 SoT 코드: `tudal/src/lib/data/report-section-schemas.ts` + `admin-reports.ts::ValidatedStockReport` + page.tsx null guard + Section 8 dual-shape renderer. 박제 자료: `docs/superpowers/plans/2026-05-22-pr3a-group-h-schema-drift.md` + REVIEW.md. SoT 진입점 = `HANDOFF.md §0`.

이전 갱신: 2026-05-22 (54차 §2 — PR #11 PR2 Tier 1 AI 30 선정 screening MERGED in main `f85fb69`). 7 commits FF / 47 TDD tests (699 → 746).
이전 갱신: 2026-05-20 (50차 §2 출시 Runbook 재구조 — HANDOFF §2 신규 15-step Runbook 박제). 49차 Task 17/17 ✅ + 50차 §1 B-17 EXECUTED ✅. S7a Anthropic wrapper Task 1~17 모두 완료 + PR #1 OPEN 후 MERGED in 51차. omxy 50 rounds CONVERGED.
이전 갱신: 2026-05-12 (T7e.8 follow-up — DART Signal 4·5 production 적용 완료; 2026-05-01 `short_list_30` 30 rows UPSERT, dry-run preview↔DB 일치 검증)
선행 문서: `HANDOFF.md §2 Runbook` (로드맵 SoT) · `ProgressDashboard.md §5` (BL-KRIT) · `ServicePlan-Admin.md §4` (데이터 모델)

> **이 파일은 스켈레톤이다.** S7a 킥오프 첫 행동으로 아래 Tasks를 Phase별로 세분화·체크리스트화한다. Placeholder가 최소한인 이유는 각 Phase(S7a~S7e)가 외부 API 응답·실측 후에만 구체화되기 때문.

---

## 목표 (Why)

Mock Skeleton(S0~S6)이 UI·라우트·타입·스키마·순수 로직을 완결했지만, **모든 데이터는 `tudal/src/lib/data/mock-*.ts` fixture에서 온다**. S7은 Mock을 실 API·실 Supabase·실 Anthropic 호출로 교체하여 어드민 3명이 실제로 쓸 수 있는 상태로 전환한다. **완료 기준**: Must 19 모두 실데이터 기반으로 동작 + 실 AI 호출 비용 추적 + 실 운용 검증(S9)으로 넘어갈 준비.

---

## 포함 Phase (구 HANDOFF §6 SoT 이식 · 현재 Runbook은 HANDOFF §2)

### S7a · Anthropic wrapper + cost_log 실 INSERT
- **포함 Must**: M17 (AI 비용 실시간 모니터링)
- **외부 의존**: Anthropic
- **선행 BL-KRIT**: BL-KRIT-1 (Anthropic API Key)
- **예상 세션**: 1
- **핵심 산출**: `src/lib/ai/client.ts` (Anthropic SDK wrapper + prompt cache) + `src/lib/ai/cost-logger.ts` (`/messages` usage 파싱 → E7 cost_log INSERT) + per-persona/per-section 태깅

### S7e · Supabase 실 SELECT/INSERT 전면 전환
- **포함 Must**: M1·M4·M5·M6·M7·M8·M9·M16 (8 Must)
- **외부 의존**: Supabase
- **선행 BL-KRIT**: BL-KRIT-6 ✅ 해소 (2026-04-21) + 마이그레이션 **0010** (BL-KRIT-7 alert_event CHECK 확장 · 2026-04-22 재배정 · DQ-7이 0009 선점)
- **예상 세션**: 2
- **핵심 산출**: 모든 `mock-admin-*.ts` import를 Server Actions + Supabase SELECT/INSERT로 교체. RLS 검증. race condition 실 DB 제약(E4 UNIQUE) 동작 확인.

### S7b · 뉴스 + 브리핑 실 연결
- **포함 Must**: M11 (모닝 브리핑) · M12 (뉴스 심각도 분류기)
- **외부 의존**: Naver News API · Resend · Anthropic
- **선행 BL-KRIT**: BL-KRIT-1 · BL-KRIT-3 · BL-KRIT-4
- **예상 세션**: 2
- **핵심 산출**: `src/lib/news/naver-api.ts`·`scraper.ts` 실 호출 · `src/lib/briefing/compose.ts` Anthropic 실 호출 · Resend 발송. 08:00 KST Cron 실 실행 검증.

### S7c · 장중 + Exit 2채널 실 연결
- **포함 Must**: M13 (장중 이상 감지) · M14 (커스텀 임계치) · M15 (Exit 시그널 2채널)
- **외부 의존**: KIS WebSocket · Telegram · Resend
- **선행 BL-KRIT**: BL-KRIT-2 · BL-KRIT-4 · BL-KRIT-5
- **예상 세션**: 2
- **핵심 산출**: `src/lib/intraday/kis-websocket.ts` 실 구독 · `src/lib/notify/telegram.ts`·`exit-dispatch.ts` 실 발송 + D10 이메일 재시도 동작 검증.

### S7d · Silent Health 실 INSERT + override UI
- **포함 Must**: M18 (파이프라인 헬스체크) · M19 (Silent Health 하트비트) + BL-17 B 구현
- **외부 의존**: Supabase · Telegram · Resend
- **선행 BL-KRIT**: BL-KRIT-4 · BL-KRIT-5
- **예상 세션**: 1
- **핵심 산출**: `pipeline_health`·`heartbeat_log` 실 INSERT · 매일 24:00 KST Cron 실 발송 · `/admin/settings/cost` override 토글 권한 가드(대표 1인).

---

## 선행 조건 (전 Phase 공통)

- BL-KRIT-1~5, BL-KRIT-7 외부 계정·키 발급
- Supabase 프로젝트 접근 확인 (BL-KRIT-6 ✅ 해소됨)
- `.env.local`에 필요 키 전부 투입
- `tudal/.env.example` 참고 (AUTO-6 완료)

---

## 외부 의존 테이블

| API | 용도 | 비용 영향 | Rate Limit |
|---|---|---|---|
| Anthropic `/messages` | 리포트·브리핑·뉴스 분류 | Anti-Metric 40만원 hardcap | usage 파싱으로 실시간 측정 |
| Supabase PostgreSQL | 전 엔티티 실 I/O | 무료 티어 | 프로젝트 한도 |
| Naver News Open API | M12 뉴스 수집 | 무료 | 일 25,000건 |
| pykrx (로컬 Python) | 영업일·시세 seed | 0 | — |
| KIS REST / WebSocket | 주식 시세·주문 | 계좌당 무료 | 초 20건 |
| Resend | 이메일 발송 | ~$20/월 (3K emails) | — |
| Telegram Bot | 푸시 알림 | 무료 | 초 30건 |

---

## Tasks (킥오프 시 세분화)

> 각 Phase의 Tasks는 해당 Phase 킥오프 세션에서 구체화한다. 아래는 초기 스켈레톤.

### Phase S7a (최우선, 세션 1)

> **D19 (2026-05-08, 35차) 분기**: AI 키 발급 여부에 따라 진입 경로가 갈린다.
> - **AI 키 발급 ✅**: T7a.1~6 정상 진행. **(64차 정정)** Anthropic 키는 **필요조건일 뿐 충분조건 아님** — Tier 1 (Core 11) 실 가동 = PR-G ⓑ 게이트(마이그 0031 apply + `SELECTION_CRON_AUTO_ENABLED=true` + 키 + 비용). **Tier 2 (Sector Board) + Section 8은 별도 downstream PR-I/PR5b** (키 발급만으로 즉시 Tier2 활성 아님)
> - **AI 키 미발급 ⏸**: T7a 전체 ⏸ → S7e + T7e.8 Tier 0 단독으로 30종목 진짜 산출 → 어드민 화면에 🔢 점수 + ⚪ "AI 분석 대기" placeholder. AI 키 발급 시 plug-in.

- [ ] T7a.1 `ANTHROPIC_API_KEY` `.env.local` 투입 + 접속 테스트
- [ ] T7a.2 `src/lib/ai/client.ts` — Anthropic SDK wrapper + prompt cache 옵션
- [ ] T7a.3 `src/lib/ai/cost-logger.ts` — `/messages` response의 `usage` 파싱 → `cost_log` INSERT (ticker·persona_id·section 태깅)
- [ ] T7a.4 `src/lib/trading/ai/decide-order.ts` — S8 어댑터 skeleton 빈 훅(`throw 'not-embedded'`) 선행 박기
- [ ] T7a.5 `/admin/settings/cost` 대시보드를 mock 대신 실 `cost_log` SELECT로 교체
- [ ] T7a.6 Vitest — 비용 추정·파싱 단위 테스트
- [ ] **T7a.7 (D19 Tier 1) Core 11 페르소나 평가**: T7e.8 Tier 0 후보 150 → 시간대별 페르소나 가중치(단기 Druckenmiller↑·중기 Lynch↑·장기 Buffett·Munger·Fisher↑) → 단/중/장 각 10 = 30 선정. `src/lib/screening/persona-eval.ts`. 출력: `🤖 AI 점수`(0~100) per (종목, 시간대) → `short_list_30.ai_score` 컬럼 (**마이그 0029 applied** — consensus_badge/ai_score/weighted_score_×3/winning_timeframe/conviction/ai_comment_kr 8종 nullable; "0010 추가 검토"는 41차 당시 표기로 supersede됨)
- [ ] **T7a.8 (D19 합의 에이전트) 4종 배지 산출**: 🔢 vs 🤖 비교 → 🟢 강한 합의 / 🔵 숫자 우세 / 🟣 AI 우세 / ⚪ AI 분석 대기. `src/lib/screening/consensus.ts`
- [ ] **T7a.9 (D19 Tier 2) Sector Board 활성화 시점 — 30종목만**: `ReportFramework.md §7` 14섹터별 10명 박제 중 **각 종목의 섹터 14명만** 활성화 (전체 140명 X). 종목당 Core 11 + Sector 14 = 25명. M17 hardcap 40만원 내 통제 (월 30 × 25 ≈ 750 LLM call/월)
- [ ] **T7a.10 (D19 Reflection 신규 엔티티 후보) `reflection_log` 검토**: 매월 말 실현 수익률 + 페르소나별 적중률 → 다음달 prompt 주입 컨텍스트. S7e 마이그에 포함할지 또는 S7a 후속에서 분리할지 결정. SoT: `ReportFramework.md §8` Step 4 후속
- [ ] **T7a.11 (D20, 45차 신규) Section 8 위원 전원 표 렌더링 컴포넌트**: `/admin/report/[ticker]` Section 8 영역에 4종 정적 표를 렌더링한다 — ① Sector Board 위원별 한 줄 의견 표(해당 섹터 14명 전원: 번호·이름·배경·BUY/HOLD/SELL·한 줄 논거) ② **Core 11 위원별 한 줄 의견 표(11명 전원, 신규)**: 번호·이름(투자 철학 라벨)·BUY/HOLD/SELL·한 줄 논거 ③ 쟁점별 찬반 토론 인용 3~5건(찬 1~2 + 반 1~2 + 중 1) ④ 최종 합의 패널(Sector 집계 + Core 재투표 집계 + Co-Chair 만장일치 여부 + 공식 판정 + 근거). 신규 컴포넌트: `src/components/admin/report/section-8-committee-tables.tsx` (예상). 데이터 소스: `stock_reports.section_8` jsonb + `committee_votes` 11+14 row (이미 박제된 DB 스키마, 신규 마이그 0건). 위원 이름은 비-인터랙티브 텍스트 (인터랙티브 페르소나 탐색은 Should S2). SoT: `ServicePlan-Admin.md §3.7 R3.7-6/7/8` + `§6 D20` + `ReportFramework.md §8 Step 2 v2.3`. Reference 양식: `Document/Outputs/Report-Alteogen_196170_v3-Readable.md §Section 8 Part A/B/C`.

### Phase S7e (세션 2~3, 36차 진입)
- [x] **T7e.1 마이그레이션 0010 검증 완료** (36차) — `alert_event_rls_hardening` 20260505134639 적용 확인 (`mcp__supabase__list_migrations`). E6 alert_event 테이블 신설 + AlertType CHECK 12종 + `mark_alert_read`/`record_alert_exit_decision`/`raise_portfolio_dispute`/`resolve_portfolio_dispute` 4 RPC + RLS select-all/insert-own/update-own. **BL-KRIT-7 ✅ 해소**. 0011 자리는 S8 (BL-KRIT-8) 예약 유지.
- [x] **T7e.2 `mock-admin-shortlist.ts` → Supabase SELECT 완료** (36차) — `src/lib/data/admin-shortlist.ts` 신규 (transformer + delta 집계 + month/tickerMeta 옵션 + Supabase error throw). 5 page-level importer 갱신: `/admin`, `/admin/settings`, `/admin/portfolio`, `/admin/portfolio/actions.ts` (sync helpers를 `ShortListItem[]` param 받게 리팩터), `/admin/report/[ticker]/page.tsx`(T7e.3 boundary 위해 mock pair 유지). reportLinksEnabled prop 경계 추가 (`shortlist-row`/`delta-banner`/`bucket-section` + `/admin`+`/portfolio`에서 false 전달). `/portfolio` 빈 shortlist placeholder + Accept/Reject T7e.3·4 전까지 disabled. 게이트 generated_at = 실 row.createdAt 기반(synthetic month-start 폐기). Vitest 8 신규 (transformer/aggregate). vi.mock으로 portfolio actions test 우회. mock-mock importers (committee/report) 보존 (T7e.3 스코프). **검증**: build 25 routes · lint 0 · test:ci 314/39 (이전 306/38 +8/+1).
- [x] **T7e.3 `stock_reports`·`committee_votes` Supabase SELECT 완료** (37차) — `src/lib/data/admin-reports.ts` 신규 (Section0~8+Appendix 타입 정의 + transformer + `getReportByTicker`/`reportExistsForMonth` 실 SELECT + `deriveBucketNeighbors` 순수 함수). `src/lib/data/admin-committee.ts` 신규 (transformer + `getVotesByReportId` 실 SELECT + `aggregateVotes` 이관). `/admin/report/[ticker]/page.tsx`는 Supabase 전환 + `getActiveShortList` active shortlist month 기준 report 조회 + `MOCK_ADMIN_SHORTLIST.find` 폐기. `regenerate/actions.ts`는 `MOCK_ADMIN_REPORTS.some` → `reportExistsForMonth` 실 SELECT (try/catch → `report_lookup_failed`). `reportLinksEnabled={false}` 3곳 제거 (admin home DeltaBanner + admin home BucketSection + portfolio BucketSection) → `/admin/report/[ticker]` 클릭 활성(단, Delta REMOVED는 리포트 대기 유지). portfolio actionsDisabledMessage T7e.4만 남기게 단축. mock-admin-report.ts·mock-admin-committee.ts 보존 (consistency 테스트 유지). Vitest 19 신규/보강 (admin-reports 10 + admin-committee 6 + regenerate 1 + delta-banner 2). **검증**: build 25 routes · lint 0 · test:ci **333 pass / 42 files** (이전 314/39 +19/+3) · tsc --noEmit 0.
- [x] **T7e.4 `portfolio_approval`·`portfolio_snapshot` Supabase 실 I/O 완료** (38차) — `src/lib/data/admin-approvals.ts` 신규 (PortfolioApproval transformer + `getApprovalsByMonth`/`getApprovalById` + `createPortfolioApproval` + `raisePortfolioDispute`/`resolvePortfolioDispute` RPC wrapper). `src/lib/data/admin-snapshots.ts` 신규 (PortfolioSnapshot transformer + `insertPortfolioSnapshots`). `/admin/portfolio/page.tsx` `MOCK_ADMIN_APPROVALS` → Supabase SELECT. `actions.ts` Reject/dispute/resolve는 실 I/O. Accept는 fake entryPrice 저장 금지로 실 가격 소스가 없으면 `entry_price_unavailable`을 반환하고 E4 INSERT 전 중단한다. `portfolio_snapshot` bulk INSERT wrapper는 준비됨. E4 partial UNIQUE race(23505)는 accept 경로에서만 `already_finalized` 매핑. `actionsEnabled={false}` 제거로 `/portfolio` fail-closed UI boundary 해제. 신규 에러 코드 3종(`entry_price_unavailable`/`approval_write_failed`/`reanalysis_limit_reached`)은 한국어 운영자 메시지로 표시. Vitest 12 신규/보강 (admin-approvals 4 + admin-snapshots 2 + portfolio actions 4 + portfolio-panel 2). **검증**: build 25 routes · lint 0 · test:ci **345 pass / 45 files** (이전 333/42 +12/+3) · tsc --noEmit 0.
- [x] **T7e.5 `regen_counter` Supabase 실 I/O + M9 cap 가드 race-safe 완료** (39차) — `src/lib/data/admin-regen-counters.ts` 신규 (`RegenCounterDbRow` + `transformRegenCounterRow` + `computeNextMonthResetAt` 순수 helper + `getRegenCounter` SELECT + `incrementManualRegenCount` CAS). race 보호는 신규 마이그 없이 마이그 0005의 UNIQUE(ticker,month) + CHECK(manual_count <= 2) + Postgres 행 잠금 위에 4단계 패턴: ① idempotent INSERT(23505 무시) → ② SELECT 현재 값 → ③ cap 도달 시 즉시 `cap_exhausted` (UPDATE 없음) → ④ `UPDATE WHERE id AND manual_count = current_value` 비교-스왑(RETURNING이 비면 conflict throw). `regenerate/page.tsx`는 `findRegenCounter(MOCK_ADMIN_REGEN_COUNTERS, …)` → `await getRegenCounter(...)`. `regenerate/actions.ts`는 mock import + `real_persistence_not_configured` 분기 제거 + 신규 에러 코드 3종 매핑(`regen_counter_lookup_failed`/`regen_counter_write_failed`/`regen_counter_write_conflict`). `regenerate-panel.tsx`는 `formatErrorMessage()`로 8개 에러 코드를 한국어 운영자 메시지로 매핑 (cost_hardcap·report 관련 포함). `mock-admin-regen-counters.ts`는 본 변경으로 고아가 되어 삭제. Vitest 17 신규/보강 (admin-regen-counters 13 + actions 8→12 +4). **검증**: build 25 routes · lint 0 · test:ci **362 pass / 46 files** (이전 345/45 +17/+1) · tsc --noEmit 0. **MOCK_ADMIN_COST_LOG 합계 hardcap은 의도적으로 mock 유지** (cost_log 실 INSERT/SELECT는 S7a/T7a 범위, HANDOFF §2.A 명시).
- [x] **T7e.6 access-logs/performance/decision-tree Supabase 전환 완료** (40차) — `src/lib/data/admin-access-logs.ts` 신규 (`getRecentAdminAccessLogs(limit)` boundary stub 반환 `[]` · BL-20 7일 단일 어드민 자동 바이패스는 실 source 정의 전까지 영구 비활성). `src/lib/data/admin-performance.ts` 신규 (`PortfolioSnapshotDbRow` transformer + `getPerformanceSummary` / `getMonthlyPerformance` / `getBucketPerformance` — `portfolio_snapshot` SELECT 후 `src/lib/performance/*`(sharpe/mdd/cap-months) 순수 로직 호출 + `getCounterfactual()` returns `null` — D11/S9 deferred). `src/lib/data/admin-decision-tree.ts` 신규 (`getDecisionTreeSnapshot` — `portfolio_snapshot` SELECT → `groupByMonth` → `judgeDecisionTree`). `/admin/track-record/page.tsx`는 Supabase 전환 + Counterfactual 카드 "운용 데이터 누적 후 산출" UI 대기. `/admin/decision-tree/page.tsx`는 Supabase 전환. `/admin/portfolio/page.tsx`+`actions.ts`는 access-logs boundary stub로 전환. `mock-admin-{access-logs,performance,decision-tree}.ts` 3 파일 삭제 + `mock-admin-consistency.test.ts` assertion 1 제거. **단일 SoT 박제**: performance + decision-tree는 `portfolio_snapshot`(0005) + `src/lib/performance/*` 순수 로직. **신규 마이그 0건** (0011 슬롯은 BL-KRIT-8 보존). Vitest 19 신규/보강 (admin-access-logs 2 + admin-performance 15 + admin-decision-tree 2). **검증**: build 25 routes · lint 0 · test:ci **381 pass / 49 files** (이전 362/46 +19/+3, consistency 1 제거 반영) · tsc --noEmit 0.
- [ ] T7e.7 RLS 정책 브라우저 수동 QA (kevin/son00326/shjang1001 3계정으로 라우트별 통과·거부 확인 + cron 인증 + RPC 가드 · **Tier 0 short_list_30 시드(T7e.8) 후 진행** — stock_reports/committee_votes는 후속 seed 전까지 boundary/empty 동작 감안)
- [x] **T7e.8 (D19, 2026-05-08 35차 · 2026-05-21 53차 §5 정정) Tier 0 인디케이터 자동 스크리닝 — AI 키 불필요**:
  - **53차 §5 박제**: Tier 0 단독 30 rows production 적용 상태 = **fallback** (메인 path 아님). 메인 path = Tier 1 AI 30 선정. **(64차 현황 supersede) Tier1 선정 엔진/청크 워커 빌드 ✅ 완료** (PR2 `f85fb69` + PR-E `492cd46` 마이그 0029 applied + 선정 청크 워커 PR #82 마이그 0031 written-not-applied dormant) — 실 AI 첫 30선정 = **PR-G ⓑ** (USER 마이그 0031 apply + `SELECTION_CRON_AUTO_ENABLED=true` + Anthropic 키 + 비용 게이트). canonical 5-PR(PR2→PR3a→PR1→PR3b→PR3c→PR4) 전체 MERGED.
  - `src/lib/screening/indicators.ts` — pykrx·KRX·DART 기반 5-Signal Composite × 시간대별 가중치
  - 단기 가중↑: 모멘텀(MA 골드크로스)·거래량 급증·외국인 순매수 강도
  - 중기 가중↑: 실적 모멘텀·PEAD·ROE 상승·산업 사이클
  - 장기 가중↑: ROIC 일관성·FCF·부채비율·밸류(PER/PBR)
  - 출력: 단/중/장 후보 50씩 = 150 → 시간대별 점수 0~100 (**`tier0_candidates_150` 테이블**(0028)에 150 후보 pool 저장; Tier 1 AI 선정 후 **최종 30만 `short_list_30`**에 persist — 64차 supersede, 150 점수를 short_list_30에 직접 저장한다는 옛 표기 정정)
  - **AI 키 미발급 시 fallback 단독 가동** = 진짜 코스피·코스닥 30 직선정 + 실 가격·재무·뉴스 표시 가능 (메인 path 아님)
  - **메인 path = Tier 1 AI 30 선정** (Core 11 페르소나 평가) — 선정 worker 빌드 ✅(마이그 0031 dormant), 실 가동 = **PR-G ⓑ 게이트**(마이그 0031 apply + `SELECTION_CRON_AUTO_ENABLED` + Anthropic 키 + 비용). **Tier 2(Sector 14)/Section8 리포트 lane은 별도 PR-I/PR5b/PR-J downstream** — AI 키 발급만으로 즉시 Tier2 활성 아님(PR2 후속 표기 supersede)
  - 박제: `ServicePlan-Admin.md §1A.5 D19` + `Service/Report/ReportFramework.md §8 Step 0`
  - **41차 박제**: T7e.8을 T7e.7보다 먼저 진행하는 1순위로 확정. name/sector 갭 처리 = **(a) ALTER TABLE 컬럼 추가** 채택. 마이그 번호 **0012로 승격** (0011 슬롯은 BL-KRIT-8 S8 자동매매 보존). 별도 commit `feat(T7e.8): migration 0012 short_list_30 name/sector columns`로 분리.
  - **42차 진척 (2026-05-12)**:
    - ✅ 마이그 0012 적용 (`20260512000451 short_list_30_name_sector`) — `name`/`sector` text(nullable) + `short_list_30_sector_idx` 인덱스. production Supabase verify 통과. commit `50a96b2 feat(T7e.8): migration 0012 short_list_30 name/sector columns` 분리 박제.
    - ✅ `scripts/screen_shortlist_tier0.py` 작성 — argparse(`--month` / `--dry-run`|`--apply` / `--csv-backup` / `--universe-limit`), lazy import(pykrx/supabase), 5-Signal Composite + 시간대별 가중치(short=0.4/0.3/0.2/0.05/0.05, mid=0.2/0.15/0.15/0.3/0.2, long=0.1/0.05/0.05/0.2/0.6), z-score 정규화 0~100, 단/중/장 후보 50→상위 10×3=30, bucket 간 ticker 중복 제거 후 backfill, current-month delete→upsert로 stale row 제거, 전월 ticker 비교로 delta_status new/hold 판정(removed는 스코프 외), DART Signal 4·5는 미구현 hook이라 0 처리 + 경고.
    - ✅ `src/lib/data/admin-shortlist.ts` transformer — `ShortListDbRow`에 `name`/`sector` 필드 추가, SELECT 절에 `name, sector` 추가, transformer는 `row.name?.trim() || meta?.name || row.ticker` precedence. Vitest 2 신규 (DB 컬럼 우선·빈 문자열 fallback).
    - ✅ Tier 0 실 시드 완료 — `scripts/.venv` + pykrx/supabase/requests로 production `short_list_30` 2026-05-01 row 30개 적용. 후속 검증 중 dry-run/apply가 장중 KRX 데이터 변동으로 달라질 수 있는 root cause를 확인해 `--as-of` 기준일 고정 옵션을 추가하고 기본 기준일을 실행일의 직전 완료 영업일로 변경. 2026-05-11 as-of 재시드 결과: CSV↔DB mismatch 0, 10/10/10, unique ticker 30, name/sector missing 0, delta_status new 30. DART 실 재무 시그널은 후속(T7e.8 follow-up/S7a).
    - 검증: build 25 routes · lint 0 · test:ci **384 pass / 49 files** (이전 381/49 +3/+0) · tsc --noEmit 0.
  - **44차 follow-up 진척 (2026-05-12)**:
    - ✅ `tudal/supabase/migrations/0013_dart_corp_codes.sql` + `.rollback.sql`, `0014_dart_financial_cache.sql` + `.rollback.sql` 작성/커밋. RLS = service_role write + admin read.
    - ✅ `scripts/seed_dart_corp_codes.py` + unittest 작성. 실제 DART `corpCode.xml`에는 설계상 기대한 `corp_cls`가 없어서 최초 dry-run `parsed rows: 0` 발생. root cause 수정: DART는 ticker↔corp_code만 사용하고, market은 pykrx KRX 상장 ticker set으로 매핑. dry-run 결과 2,766 rows(KOSPI 838 / KOSDAQ 1,818 / KONEX 110).
    - ✅ `scripts/dart_signals.py` + unittest 작성 — account alias, CFS→OFS fallback, annual/quarterly Supabase cache, `not_yet_disclosed` TTL, standalone quarter(Q1~Q4), YoY earnings momentum, 5-metric quality, universe-wide quality composite.
    - ✅ `scripts/screen_shortlist_tier0.py` DART Signal 4·5 wiring — quality double-normalization 방지, CSV-only diagnostics(`signal_4_basis`, `quality_insufficient`)와 DB payload 분리.
    - ✅ production 적용 완료 — Supabase 0013/0014 적용 + `dart_corp_codes` seed 후 full dry-run preview(2026-05-01 · as-of 2026-05-11) 통과. Universe 2,345 → 후보 50/50/50 → 최종 30(10/10/10), DART cache 10,154 rows · 2,343/2,345 corps(99.9%), CFS ok 94%, CFS→OFS fallback 1,728 rows, standalone Q 환산 384 rows, `signal_4_basis` 30/30 standalone, `quality_insufficient` 30/30 False.
    - ✅ 사용자 승인 후 `--apply` 완료 — 30 rows UPSERT, dry-run preview↔DB top 3 ticker/composite 일치, exit 0, client refresh 7회 정상, RemoteProtocolError 0건. 산출물: `scripts/out/tier0_2026-05_dart_apply.csv`, `scripts/out/tier0_2026-05_dart_apply.log`, `scripts/out/short_list_30_2026-05_pre_apply_backup.sql`.
    - ✅ label 분포 — short=모멘텀 10, mid=실적 모멘텀 8 + 모멘텀 2, long=퀄리티 10. Top 3: short HB테크놀러지/선도전기/서울바이오시스, mid 한온시스템/HD현대에너지솔루션/스피어, long 디티씨/아미노로직스/프로이천.
    - 검증: Python unittest **27 pass** + build 25 routes · lint 0 · test:ci **384 pass / 49 files** · tsc --noEmit 0.

### Phase S7b (세션 4~5)
- [ ] T7b.1 Naver News API 실 호출 경로 전환
- [ ] T7b.2 Resend 도메인 인증 + 발송 테스트
- [ ] T7b.3 M11 Anthropic 실 브리핑 생성 (08:00 KST Cron 실 검증)
- [ ] T7b.4 M12 Anthropic 실 분류 (Critical/Warning/Info)
- [ ] T7b.5 `briefing_log`·`news_event` 실 INSERT 확인

### ★ S7b 완료 후 게이트 — D11 AI 가상 포트 1차 가동 (D18, 2026-05-08)

> **D18 박제**: S7b 완료 시점에 KRX/pykrx/DART/네이버 + 실 Anthropic + 실 Supabase로 D11 AI 가상 포트가 **KIS 0개로 작동 가능**한 상태 도달. S7c 진입 전 **어드민 3인이 며칠~1주 운용 검증** — 가상 포트 의사결정 품질·승인 워크플로우·재생성 cap·뉴스 분류 등 검증 후 S7c 진입. 자동매매(S8)는 **🎉 출시 후** 단독 진입 (2026-06-01 재배치 · 구 'D11/D18 운용 검증 후'; 현재 순서 = S7d → S9 운용 → 출시 → S8).

운용 검증 체크리스트:
- [ ] **Short List 30 = 진짜 코스피·코스닥 종목** (mock 30개 X) — 실 종목명·섹터·현재가·등락률 (D19 검증 핵심)
- [ ] 단기 10 / 중기 10 / 장기 10 = 시간대별 가중치 작동 (단기엔 모멘텀↑, 장기엔 가치↑)
- [ ] 각 종목 카드에 🔢 숫자 점수(0~100) 노출 (Tier 0 5-Signal Composite)
- [ ] 각 종목 카드에 🤖 AI 점수(0~100) 노출 — AI 키 ✅ 시 / 미발급 시 ⚪ "AI 분석 대기 중" placeholder (D19)
- [ ] 합의 배지 4종 노출 — 🟢 강한 합의 / 🔵 숫자 우세 / 🟣 AI 우세 / ⚪ AI 분석 대기
- [ ] AI 코멘트 1~2줄 노출 — AI 키 ✅ 시 Core 11 합의 핵심 논거 / 미발급 시 placeholder
- [ ] 종목 카드 클릭 → 풀 리포트(Section 0~8) 진입 (AI 키 ✅ 시 실 LLM 생성 / 미발급 시 placeholder)
- [ ] **Section 8 위원 전원 표 정상 렌더 (D20, T7a.11)** — Sector 14명 전원 표 + Core 11 전원 표 + 쟁점 인용 3~5건 + 최종 합의 패널(Co-Chair 만장일치 여부) 4종 정적 표가 보임. 위원 이름·BUY/HOLD/SELL·한 줄 논거가 빠짐없이 노출. AI 키 미발급 시 빈 상태 또는 placeholder 메시지.
- [ ] 실 가격(KRX/pykrx)·실 재무(DART)·실 뉴스(Naver) 모든 종목 채워짐
- [ ] Short List 30 일·주 단위 갱신 동작 (M1·M4·M5·M6 실데이터)
- [ ] 풀 리포트 실 LLM 생성 + 투심위 패널 (M2·M3) — AI 키 ✅ 조건부
- [ ] 승인 워크플로우 실 INSERT + 가상 포트 트래킹 (M7·M8)
- [ ] 모닝 브리핑 실 발송 + 뉴스 분류기 정확도 체감 (M11·M12) — AI 키 ✅ 조건부
- [ ] AI API 비용 모니터링 실 데이터 + 35만 경보 동작 검증 (M17) — AI 키 ✅ 조건부
- [ ] 어드민 3인이 며칠~1주 사용 후 의사결정 품질 만족 → S7c 진입

### Phase S7c (세션 6~7)
- [ ] T7c.1 KIS REST OAuth 토큰 관리
- [ ] T7c.2 KIS WebSocket 실시간 시세 구독 (40구독 제한 관리)
- [ ] T7c.3 Telegram Bot 실 발송 (3 어드민 chat_id)
- [ ] T7c.4 M15 Exit 2채널 + D10 이메일 재시도 실 동작
- [ ] T7c.5 `intraday_anomaly_event`·`alert_event(exit_signal)` 실 INSERT
- [ ] T7c.6 T+7 outcome 자동 적재 Cron 실 동작

### Phase S7d (세션 8)
- [ ] T7d.1 `pipeline_health` 실 INSERT (5 파이프라인 × 24h)
- [ ] T7d.2 `heartbeat_log` 실 INSERT + 24:00 KST Cron 실 발송
- [ ] T7d.3 `/admin/settings/cost` override 토글 UI + 대표 1인 권한 가드
- [ ] T7d.4 3채널 catch-up(텔레/이메일/대시보드) 실 검증

---

## DoD (Phase 공통 + 전체)

### Phase 공통 DoD
- [ ] 해당 Phase Must 전체가 mock import 0, 실 API/DB 경로만 사용
- [ ] `npm run build` + `npm run lint` + `npm run test:ci` 3 게이트 통과
- [ ] 신규 env 키는 `.env.example`에 반영 · Vercel 배포 준비 시 수동 투입
- [ ] Supabase 마이그레이션 실 적용 + RLS 브라우저 QA
- [ ] 커밋 prefix `feat(S7a):`·`feat(S7b):` 등 Phase 단위 atomic 커밋

### 전체 S7 완료 DoD
- [ ] Must 19 모두 실 경로 동작 (`HANDOFF.md §9` active blocker + `docs/superpowers/audit-catalog.md` 체크리스트 전부 체크)
- [ ] 실 AI 호출 횟수 > 0 · `cost_log` 실 INSERT 누적 확인
- [ ] 2채널 알림 실 발송 로그 확인 (텔레그램·이메일)
- [ ] Vercel Cron 4건(monthly-batch · morning-briefing · news-sweep · silent-health) 실 실행 1주 연속 성공
- [ ] `CodebaseStatus.md` "실데이터 연결 N/19" N → 19 갱신
- [ ] `ProgressDashboard.md` S7 ✅ 표기 + S8 출시 후 진입 지표 (2026-06-01 재배치 · 구 D18 'S7d 후 단독')

---

## 블로커 / 사용자 결정 필요

- **BL-KRIT-1~5, 7** — HANDOFF §4 참조 (Anthropic·KIS·Naver·Resend·Telegram 외부 계정 발급 + 마이그레이션 **0010**)
- ~~**DQ-7**~~ ✅ **해소 (2026-04-22 spec 확정, 구현 대기)** — Vercel 첫 배포는 DQ-7 슬라이스에서 선행 수행. S7a 진입 시점에는 이미 preview URL + 최소 env 7개 세팅 완료 상태. `Slices/DQ7-Credentials.md §6` 참조.

---

## 리스크

- **R-S7-1** Anthropic 비용 폭주 (실 AI 호출 첫 도입 시점)
  - 완화: S7a에서 dry-run 견적 먼저 돌리고 한도 override 없이 35만/40만 경보·hardcap 실 동작 확인
- **R-S7-2** KIS WebSocket 40구독 제한 초과 시 스트림 중단
  - 완화: 종목별 우선순위 + 재연결 backoff + 폴링 fallback (S5 설계)
- **R-S7-3** 실 DB로 전환 후 race condition이 mock에선 드러나지 않은 상태로 출현
  - 완화: E4 UNIQUE 위반 catch 경로를 S3에서 이미 박음. S7e에서 실 동시 클릭 QA 추가
- **R-S7-4** Resend 도메인 인증 지연
  - 완화: 테스트 발송은 `onboarding@resend.dev` 경유 가능. 본 도메인은 배포 전까지 병행

---

## 의사결정 로그

- 2026-04-21: 스켈레톤 생성. 구 HANDOFF §6 로드맵 테이블을 Phase별로 이식. 각 Phase Task는 킥오프 시점에 세분화 원칙.
- 2026-05-08 (36차) — **T7e.2 부분 마이그레이션 boundary 결정**: shortlist만 real Supabase로 전환하고 reports/committee는 T7e.3까지 mock pair 유지. 이유: real shortlist + mock report 혼합 시 신규 ticker가 mock report에 없으면 `/admin/report/[ticker]` → 404 위험. 보호 장치 = `reportLinksEnabled={false}` prop을 ShortlistRow/DeltaBanner/BucketSection에 전파해 T7e.3 전까지 리포트 클릭 자체를 차단. 같은 이유로 `/portfolio` Accept/Reject도 T7e.3·4 전까지 disabled.
- 2026-05-08 (36차) — **에러 처리 정책**: `getActiveShortList()`는 Supabase error를 빈 배열로 swallow하지 않고 `throw` (운영 검증 시 RLS/schema/연결 문제 노출). Server Actions은 try/catch로 잡아 `{success:false, error:"shortlist_lookup_failed"}` 변환. Server Components는 error.tsx 바운더리에 위임.
- 2026-05-08 (36차) — **게이트 generated_at 기준 변경**: 기존 `${month}T09:00:00+09:00` 합성 timestamp → 실 `short_list_30.created_at` 사용. 같은 월의 행은 Tier 0 batch INSERT라 createdAt 동일 가정. T7e.8이 월 중간에 INSERT해도 24h Hold가 정확히 동작.
- 2026-05-08 (36차) — **Tier 0 데이터 수집 인프라 결정 (B-1)**: pykrx Python 의존성 때문에 Vercel(Node) Edge Function 배제. 로컬 Python 스크립트(scripts/, idempotent upsert · dry-run · CSV 백업 · month 인자 · env 기반 Supabase 접속) → 사용자가 로컬 실행 → Supabase upsert. 자동화는 S7/S8 안정화 후 GitHub Actions 또는 별도 cron으로 승격.
- 2026-06-02 (63차) — **B-1 supersede: 데이터 소스 하이브리드 + 실행 청크 워커**: 구 pykrx 종목별 수천 콜이 KRX throttle(~2000/2269 실패) 유발 → **S1 종가·S2 거래량·universe = KRX 공식 Open API**(`AUTH_KEY` 헤더, env `KRX_OPENAPI_KEY`, 8서비스 승인 + 라이브 200 검증, 날짜별 전종목 1콜) / **S3 외국인 = pykrx**(공식 API 미제공=404) / **S4·S5 = DART**(유지). 선정 실행은 **Vercel cron 청크 워커**(로컬 one-off 러너 폐기, PR5 패턴). 150 시드 S3(pykrx=Python)는 monthly 자동화 시 외부 cron(GitHub Actions). 상세 = ADR D-10/D-11 + HANDOFF §6 63차 entry. CLAUDE 다음 작업 = `screen_shortlist_tier0.py` S1/S2/universe → KRX 공식 REST 전환(cost 0).
- 2026-05-08 (36차) — **T7e.2 스코프 갭 명시**: `short_list_30` 스키마는 ticker만 보관(name·sector 컬럼 없음). transformer는 fallback (name=ticker · sector="미분류") 또는 외부 lookup. T7e.8 prep 단계에서 3옵션 중 결정 필요: (a) ALTER TABLE로 컬럼 추가 (마이그 0011 충돌 시 0012) / (b) 별도 `tickers_meta` 테이블 + JOIN / (c) 정적 lookup TS 파일 (Python 스크립트가 함께 갱신).
- 2026-05-08 (37차) — **T7e.3 부분 마이그레이션 boundary 2번째 해제**: shortlist에 이어 reports/committee_votes도 실 Supabase로 전환. 이로써 `/admin/report/[ticker]`는 `stock_reports` + `committee_votes` 실 SELECT, `/admin` + `/portfolio` 카드 클릭은 활성. **시드 부재 상태 일관 동작**: shortlist 빈 상태 → /admin은 빈 UI, /report는 도달 불가. shortlist 시드 후 reports 시드 전 상태 → /report는 `notFound()` 일관. T7e.4 (approvals/snapshots) 진입 전까지 Accept/Reject만 disabled 유지.
- 2026-05-08 (38차) — **T7e.4 실 승인/스냅샷 전환 결정**: (1) 실제 테이블명은 마이그 0004 기준 단수 `portfolio_approval` 유지 (`portfolio_approvals` 아님). (2) Reject 2회 UI 응답은 기존 UX대로 `reanalysisCount=2`를 반환하지만 DB 컬럼 `reanalysis_count`는 0004 CHECK(≤1)에 맞춰 1로 clamp한다. (3) cross-admin dispute/resolve는 RLS owner-bound UPDATE를 우회하지 않고 0010 security-definer RPC(`raise_portfolio_dispute`/`resolve_portfolio_dispute`)만 호출한다.
- 2026-05-08 (38차) — **Accept fail-closed UX 결정**: fake entryPrice는 production DB에 절대 박제하지 않는다. 실 가격 소스가 붙기 전 Accept는 운영 가능 상태가 아니라 `entry_price_unavailable`으로 E4 INSERT 전 중단하며, UI는 신규 오류 코드(`entry_price_unavailable`/`approval_write_failed`/`reanalysis_limit_reached`)를 한국어 운영자 메시지로 표시한다. 실 가격 wiring 시점에는 E4+E5를 RPC 트랜잭션으로 묶는 후속 검토가 필요하다.
- 2026-05-08 (37차) — **Section 타입 canonical 위치 변경**: `ReportSection0..ReportAppendix` 10종 jsonb shape 타입을 mock-admin-report.ts → `src/lib/data/admin-reports.ts`로 canonical 이전. mock-admin-report.ts는 자체 사본을 유지 (consistency 테스트만 사용, 향후 정리 시 일괄 폐기). 페이지 import 경로는 mock → real 1회 전환.
- 2026-05-08 (37차) — **regenerate 액션 T7e.3 동시 전환**: 원래 T7e.5 `regen-counters` 스코프지만, 이번 액션의 핵심은 `MOCK_ADMIN_REPORTS.some()` 존재 검사이므로 T7e.3 스코프(reports 실 SELECT)에 자연 포함. 카운터 적재(MOCK_ADMIN_REGEN_COUNTERS) + cost_log(MOCK_ADMIN_COST_LOG) 부분은 T7e.5에서 그대로 처리.
- 2026-05-08 (39차) — **T7e.5 race 보호: 신규 마이그 없이 CAS 패턴 채택**: HANDOFF §2.A "단순 read→write가 위험하면 PL/pgSQL RPC 검토" 옵션을 검토했으나, ① 마이그 0005가 이미 UNIQUE(ticker,month) + CHECK(manual_count ≤ 2)로 하드 cap을 박제했고 ② 0011 슬롯은 BL-KRIT-8(S8 자동매매 E13~E17)을 위해 보존, ③ 4단계 CAS(idempotent INSERT → SELECT → cap 즉시 종료 → `UPDATE WHERE manual_count = current_value` 비교-스왑) + Postgres 행 잠금이 race를 차단하므로 RPC를 추가하지 않는다. CAS 미스 시 `regen_counter write conflict`을 throw해 caller에서 신규 에러 코드 `regen_counter_write_conflict`로 매핑한다. DB CHECK가 마지막 안전망 역할을 유지한다.
- 2026-05-08 (39차) — **MOCK_ADMIN_COST_LOG 잔존 의도적**: T7e.5 액션은 manual cap 가드만 실 I/O로 전환한다. 월 40만원 hardcap은 여전히 `MOCK_ADMIN_COST_LOG` 합계로 검사한다. cost_log 실 INSERT/SELECT는 S7a/T7a(Anthropic wrapper + cost_log 적재) 스코프이며, 본 작업에서 잡지 않는다. HANDOFF §2.A의 명시적 가드라인을 따른다.
- 2026-05-08 (39차) — **regenerate-panel 에러 코드 한국어 매핑 일원화**: panel은 기존 `manual_cap_exhausted`만 한국어 처리하고 나머지는 `오류: ${code}` raw 노출이었다. T7e.3·T7e.4·T7e.5에서 추가된 에러 코드(`cost_hardcap_40man`, `report_not_found`, `report_lookup_failed`, `regen_counter_lookup_failed`, `regen_counter_write_failed`, `regen_counter_write_conflict`, `auth_unavailable`) 7종을 `formatErrorMessage()` 헬퍼로 모두 한국어화한다. CLAUDE.md "UI 문구 한국어 우선" 원칙을 운영 환경 노출 가능 모든 분기에 적용한다.
- 2026-05-08 (40차) — **T7e.6 access-logs source 결정 = T7e 범위 밖 + boundary stub `[]`**: `MOCK_ADMIN_ACCESS_LOGS`는 BL-20(7일 연속 단일 어드민 자동 바이패스) gating-relief 신호 산출에만 쓰였다. 실 access_log 테이블은 (a) 누가 어떤 라우트에 언제 접속했는지 기록할 source가 없고(미들웨어 로깅 미구현), (b) BL-20 자체가 1인 운영 비상시 fallback이라 D11 운용 검증 후 정책 재확인이 필요하다. 따라서 `getRecentAdminAccessLogs()`는 `[]` 반환하는 boundary stub으로 닫고, `detectSingleAdminStreak([])`이 자연스럽게 false를 반환하도록 위임한다. **BL-20 자동 바이패스는 실 source 정의 전까지 영구 비활성** (D19/S7c 이후 재검토). 실 source가 붙으면 stub 본문만 SELECT로 교체.
- 2026-05-08 (40차) — **T7e.6 Counterfactual = `null` + D11/S9 deferred**: `MOCK_ADMIN_PERFORMANCE.counterfactual`은 "AI 결정 무시 시 가상 수익률"을 시뮬레이션한 mock-only 값이다. 실 산출은 (a) AI 권장 비중 시계열 저장 + (b) Reject·외부 바이패스 시점의 가격 시계열 + (c) 같은 기간 portfolio_snapshot가 모두 필요하며, 현재는 (a)·(b)가 정의되지 않았다. 운용 검증(D11/S9) 후 AI 비중 저장 정책이 박제되면 산출 가능. 그 전까지는 `getCounterfactual()` returns `null` + `/admin/track-record` UI는 "운용 데이터 누적 후 산출" 대기 카드를 노출한다. fake 값을 production DB에 박지 않는다.
- 2026-05-08 (40차) — **T7e.6 단일 SoT 박제 = 신규 마이그 0건**: performance + decision-tree는 별도 테이블 신설 없이 `portfolio_snapshot`(0005, 이미 적용) 단일 SoT + `src/lib/performance/{sharpe,mdd,judge,cap-months}` 순수 로직으로 산출한다. 0011 슬롯은 BL-KRIT-8(S8 자동매매 E13~E17) 보존 약속이 유지된다. T7e.4에서 박제한 snapshot bulk INSERT wrapper와 동일한 SoT를 SELECT 측에서 재사용하는 구조라 race·schema 일관성도 자동 확보된다.
- 2026-05-12 (42차) — **T7e.8 인프라 박제: 마이그 0012 적용 + Python 스크립트 작성 + transformer 새 컬럼 read**: 41차 (a) 결정대로 `short_list_30`에 `name`/`sector` 컬럼 ADD COLUMN(nullable additive) + sector 인덱스 적용. `scripts/screen_shortlist_tier0.py`는 lazy import(venv 없이도 `--help` 동작), 5-Signal × 시간대별 가중치 박제(short/mid/long 0.4/0.3/0.2/0.05/0.05 → 0.1/0.05/0.05/0.2/0.6), z-score → 0~100 normalize, bucket 간 ticker 중복 제거 후 backfill, current-month delete→upsert로 재실행 stale row 제거, UPSERT on_conflict=`month,ticker` idempotent. `admin-shortlist.ts` transformer는 `row.name/sector` 우선 read, tickerMeta는 백업, ticker/"미분류"는 마지막 fallback로 3단 precedence. DART Signal 4·5는 키가 있어도 실 산출이 아닌 미구현 hook으로 표시하고 0 처리 + 경고 출력한다. removed delta 처리는 `rank int NOT NULL` 제약 + sentinel 정책 미정으로 본 commit 범위에서 제외 (T7e.8 follow-up).
- 2026-05-12 (42차) — **dry-run/apply 분기 정책 박제**: `--csv-backup`은 dry-run/apply 모두 필수 (CSV 미백업 데이터를 production에 박지 않는다). `--apply`만 supabase service_role 키 요구. dry-run은 supabase 호출 0회 + stdout에 bucket별 top 3 미리보기 출력 → CSV inspect 후 `--apply`로 본 적용. universe filter는 시총 ≥ 300억원 + ETF/리츠/SPAC/우선주 종목명 키워드 제외(MVP 단순). 섹터 분류는 KRX 산업분류 시드 미구축으로 "코스피"/"코스닥" market 이름 fallback — 추후 KRX 산업분류 별도 시드 작업으로 14섹터 매핑 추가.
- 2026-05-08 (41차) — **T7e.7/T7e.8 순서 박제 + name/sector 갭 (a) ALTER TABLE 결정**: 사용자 핵심 목표 "진짜 코스피·코스닥 30종목 표시"(D19)를 직접 advance하기 위해 T7e.8을 1순위로, T7e.7 RLS QA를 후속으로 박제. 근거: 시드 부재 상태에서는 빈 UI/notFound 일관 동작이라 RLS 분기 의미 약하다(36~40차 boundary 패턴이 이미 노출). `short_list_30` name/sector 갭은 **(a) ALTER TABLE 컬럼 추가**로 결정 — DB 단일 SoT 유지, 30종목 표시 데이터의 최단 경로. (b) `tickers_meta` JOIN은 종목 universe 확장 시 재검토, (c) 정적 TS lookup은 S7 real-data migration 방향과 어긋나고 Python/TS 이중 갱신 위험으로 거부. 마이그 번호는 0011 슬롯 BL-KRIT-8 보존이므로 **0012로 승격**. 별도 commit `feat(T7e.8): migration 0012 short_list_30 name/sector columns`로 분리한다. 영향 문서 3개: HANDOFF.md §0·§1·§2 + 루트 CLAUDE.md 진행 순서 v3.1 블록 + 본 파일 header/T7e.8 task/의사결정 로그/변경 이력. ProgressDashboard.md는 이미 T7e.8 우선 시퀀스로 짜여 있어 수정 불필요.

---

## 이슈·발견

- 2026-05-12 (T7e.8 follow-up) — **dry-run/apply drift root cause 및 수정**: 최초 dry-run과 apply가 같은 `--month`라도 실행 시점이 장중이면 `date.today()` 기준 pykrx 당일 데이터가 변동하여 top rank가 달라질 수 있음을 확인. root cause는 스크립트가 기준일을 고정하지 않고 apply 때 재계산한 점. 수정: `--as-of YYYY-MM-DD` 옵션 추가, 기본 기준일을 실행일의 직전 완료 영업일로 변경. production은 2026-05-11 as-of로 재시드했고 CSV와 DB 30 row가 일치함.
- 2026-05-12 (T7e.8 follow-up) — **Supabase REST stream limit root cause 및 수정**: DART full dry-run 중 한 Supabase client connection에서 약 20,000 streams 도달 시 `RemoteProtocolError`가 발생할 수 있음을 확인. 1 ticker≈24 REST 요청이므로 300 ticker마다 client를 재생성해 약 7,000 streams/connection으로 제한했다. full dry-run/apply에서 client refresh 7회, RemoteProtocolError 0건.

- (킥오프 시 추가)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-21 | 초기 생성 (placeholder). 구 HANDOFF §6 S7a~e 테이블을 Phase 5단계로 이식. Tasks는 초기 초안. |
| 2026-05-08 (35차) | **D19 박제 — Tier 0/1/2 + 합의 배지 + Reflection 반영.** (a) Phase S7e Tasks에 T7e.8 신규 — Tier 0 인디케이터 자동 스크리닝 (AI 키 불필요, pykrx·KRX·DART, 단/중/장 후보 150). (b) Phase S7a 진입 분기 박스 — AI 키 발급 여부에 따라 정상 경로 vs ⏸ fallback. (c) Phase S7a Tasks에 T7a.7~10 신규 — Tier 1 Core 11 페르소나 평가, 합의 배지 4종 산출, Tier 2 Sector Board 활성화 (30종목만), Reflection 엔티티 검토. (d) ★ S7b 게이트 운용 검증 체크리스트 강화 — 진짜 코스피·코스닥 30종목 / 🔢🤖 이중 점수 / 합의 배지 4종 / AI 코멘트 1~2줄 / 클릭→풀 리포트 / 실 가격·재무·뉴스. AI 키 미발급 시 조건부 동작 표기. SoT: `ServicePlan-Admin.md §1A.5 D19` + `Service/Report/ReportFramework.md §8`. |
| 2026-05-08 (36차) | **T7e.1 + T7e.2 ✅ 완료 — 자율 트랙 §A 진입 + 부분 마이그레이션 boundary 박제.** (a) header status ⚪→🟢, current_progress 0%→~12%. (b) T7e.1 ✅ — 마이그 0010 적용 검증 (`alert_event_rls_hardening`), BL-KRIT-7 해소. (c) T7e.2 ✅ — `src/lib/data/admin-shortlist.ts` 신규 + 5 page-level importer 갱신 + reportLinksEnabled boundary + Supabase error throw + createdAt 기반 generated_at + `/portfolio` 빈 placeholder + Vitest 8 신규 (전체 314/39). 검증: build 25 routes · lint 0 · test:ci 314 pass / 39 files. (d) 의사결정 로그 5건 추가 (boundary, error policy, gate timestamp, B-1 인프라, name/sector 갭). (e) `/report/[ticker]`는 T7e.3 boundary 위해 mock pair로 revert (real shortlist + mock report 혼합 위험 회피). 코드 변경 8 파일 · 신규 2 파일 · 문서 갱신 별도. |
| 2026-05-08 (38차) | **T7e.4 ✅ 완료 — approvals/snapshots Supabase 전환 + `/portfolio` fail-closed boundary 해제.** (a) header status `T7e.1·T7e.2·T7e.3 ✅`→`T7e.1·T7e.2·T7e.3·T7e.4 ✅`, current_progress ~19%→~25% (4/8). (b) `src/lib/data/admin-approvals.ts` 신규 — transformer + month/id SELECT + `createPortfolioApproval` + dispute/resolve RPC wrapper. (c) `src/lib/data/admin-snapshots.ts` 신규 — transformer + `insertPortfolioSnapshots` bulk INSERT(DB-generated uuid). (d) `/admin/portfolio/page.tsx` approvals SELECT 실 전환 + `actionsEnabled={false}` 제거. (e) `actions.ts` Reject/dispute/resolve 실 I/O, Accept fake entryPrice 금지(`entry_price_unavailable` fail-closed), snapshot INSERT wrapper, 23505 race는 accept 경로에서만 `already_finalized`. 신규 에러 코드 3종은 한국어 배너로 표시. (f) Vitest 12 신규/보강. 검증: build 25 routes · lint 0 · test:ci **345 pass / 45 files** (+12/+3) · tsc --noEmit 0. 의사결정 로그 4건 추가 (단수 테이블명, reject count clamp/3회 차단, dispute RPC, fake entryPrice 금지/fail-closed UX). 다음 1순위 = T7e.5 (regen-counters) 또는 T7e.8 (B-1 Python). |
| 2026-05-08 (40차) | **T7e.6 ✅ 완료 — access-logs/performance/decision-tree Supabase 전환 + 신규 마이그 0건 + 단일 SoT 박제.** (a) header status `T7e.1·T7e.2·T7e.3·T7e.4·T7e.5 ✅`→`T7e.1·T7e.2·T7e.3·T7e.4·T7e.5·T7e.6 ✅`, current_progress ~31%→~38% (6/8). (b) `src/lib/data/admin-access-logs.ts` 신규 — `getRecentAdminAccessLogs(limit)` boundary stub `[]` (BL-20 자동 바이패스 영구 비활성). (c) `src/lib/data/admin-performance.ts` 신규 — `PortfolioSnapshotDbRow` transformer + `getPerformanceSummary` / `getMonthlyPerformance` / `getBucketPerformance` (`portfolio_snapshot` SELECT + `src/lib/performance/*` 순수 로직 호출) + `getCounterfactual()` returns `null` (D11/S9 deferred). (d) `src/lib/data/admin-decision-tree.ts` 신규 — `getDecisionTreeSnapshot` (`portfolio_snapshot` SELECT → `groupByMonth` → `judgeDecisionTree`). (e) `/admin/track-record/page.tsx` Supabase 전환 + Counterfactual UI 대기. `/admin/decision-tree/page.tsx` Supabase 전환. `/admin/portfolio/page.tsx`+`actions.ts` access-logs boundary stub로 전환. (f) `mock-admin-{access-logs,performance,decision-tree}.ts` 3 파일 삭제 + `mock-admin-consistency.test.ts` assertion 1 제거. **단일 SoT** = `portfolio_snapshot`(0005) + `src/lib/performance/*` 순수 로직. **신규 마이그 0건** (0011 슬롯 BL-KRIT-8 보존). Vitest 19 신규/보강 (admin-access-logs 2 + admin-performance 15 + admin-decision-tree 2). 검증: build 25 routes · lint 0 · test:ci **381 pass / 49 files** (+19/+3) · tsc --noEmit 0. 의사결정 로그 3건 추가 (access-logs T7e 범위 밖 + boundary stub, counterfactual null + D11/S9 deferred, 단일 SoT + 신규 마이그 0건). 다음 1순위 = T7e.7 (RLS 브라우저 수동 QA, Tier 0 시드 후 권장) 또는 T7e.8 (B-1 Python). |
| 2026-05-08 (39차) | **T7e.5 ✅ 완료 — regen_counter Supabase 전환 + race-safe CAS + 에러 코드 한국어화.** (a) header status `T7e.1·T7e.2·T7e.3·T7e.4 ✅`→`T7e.1·T7e.2·T7e.3·T7e.4·T7e.5 ✅`, current_progress ~25%→~31% (5/8). (b) `src/lib/data/admin-regen-counters.ts` 신규 — `transformRegenCounterRow` + `computeNextMonthResetAt` 순수 helper + `getRegenCounter` SELECT(`maybeSingle`) + `incrementManualRegenCount` (idempotent INSERT → SELECT → cap 즉시 종료 → CAS UPDATE). (c) `regenerate/page.tsx` `findRegenCounter(MOCK_ADMIN_REGEN_COUNTERS, ...)` → `await getRegenCounter(...)`. (d) `regenerate/actions.ts` mock import + `real_persistence_not_configured` 분기 제거 + 신규 에러 코드 3종(`regen_counter_lookup_failed`/`regen_counter_write_failed`/`regen_counter_write_conflict`) 매핑. (e) `regenerate-panel.tsx` `formatErrorMessage()` 헬퍼 도입 — 8개 에러 코드 한국어 운영자 메시지(`manual_cap_exhausted`/`cost_hardcap_40man`/`report_not_found`/`report_lookup_failed`/`regen_counter_*` 3종/`auth_unavailable`). (f) `src/lib/data/mock-admin-regen-counters.ts` 삭제(고아). (g) Vitest 17 신규/보강 (admin-regen-counters 13 + regenerate actions 8→12 +4). 검증: build 25 routes · lint 0 · test:ci **362 pass / 46 files** (+17/+1) · tsc --noEmit 0. 의사결정 로그 3건 추가 (CAS vs RPC, MOCK_ADMIN_COST_LOG 잔존, panel 에러 메시지 일원화). 다음 1순위 = T7e.6 (access-logs/performance/decision-tree) 또는 T7e.8 (B-1 Python). |
| 2026-05-08 (37차) | **T7e.3 ✅ 완료 — reports/committee Supabase 전환 + boundary 2번째 해제.** (a) header status `T7e.1·T7e.2 ✅`→`T7e.1·T7e.2·T7e.3 ✅`, current_progress ~12%→~19% (3/8). (b) `src/lib/data/admin-reports.ts` 신규 — Section0~8+Appendix canonical 타입 정의 + transformer + `getReportByTicker`/`reportExistsForMonth` + `deriveBucketNeighbors` 순수 함수. (c) `src/lib/data/admin-committee.ts` 신규 — transformer + `getVotesByReportId` + `aggregateVotes` 이관. (d) `/admin/report/[ticker]/page.tsx` Supabase 전환 (active shortlist month 기준 report 조회, `MOCK_ADMIN_SHORTLIST.find` 폐기). (e) `regenerate/actions.ts` `MOCK_ADMIN_REPORTS.some` → `reportExistsForMonth` (try/catch → `report_lookup_failed` 신규 에러 코드). (f) `reportLinksEnabled={false}` 3곳 제거 → 카드 클릭 활성(Delta REMOVED는 리포트 대기 유지). (g) portfolio actionsDisabledMessage T7e.4만 남기게 단축. (h) Vitest 19 신규/보강 (admin-reports 10 + admin-committee 6 + regenerate 1 + delta-banner 2). 검증: build 25 routes · lint 0 · test:ci **333 pass / 42 files** (+19/+3) · tsc --noEmit 0. 의사결정 로그 3건 추가 (boundary 2번째 해제, Section 타입 canonical 위치, regenerate 동시 전환). 다음 1순위 = T7e.4 (approvals/snapshots) 또는 T7e.8 (B-1 Python). |
| 2026-05-12 (42차) | **T7e.8 인프라 박제 — 마이그 0012 적용 + Python 스크립트 + transformer 새 컬럼 wiring**. (a) header status·current_progress·Last updated 갱신 (S7e 6/8→7/8 인프라 단계). (b) `supabase/migrations/0012_short_list_30_name_sector.sql` + `.rollback.sql` 작성 + production apply(`20260512000451`) + verify(`information_schema.columns` + `pg_indexes`) + 별도 commit `50a96b2 feat(T7e.8): migration 0012 short_list_30 name/sector columns`. (c) `scripts/screen_shortlist_tier0.py` 작성 — 5-Signal Composite × 시간대별 가중치, z-score → 0~100 normalize, 단/중/장 후보 50→top 10×3=30, bucket 간 ticker 중복 제거 후 backfill, current-month delete→upsert로 stale row 제거, idempotent UPSERT on_conflict=`month,ticker`, 전월 비교로 delta_status new/hold, DART Signal 4·5는 미구현 hook으로 0 처리 + 경고. lazy import로 venv 없이도 `--help` 작동. (d) `src/lib/data/admin-shortlist.ts` — `ShortListDbRow`에 `name?`/`sector?` 추가, SELECT 절에 `name, sector` 추가, transformer는 `row.name?.trim() || meta?.name || row.ticker` 3단 precedence. Vitest 2 신규 (DB 컬럼 우선 + 빈 문자열 fallback). 검증: build 25 routes · lint 0 · test:ci **384 pass / 49 files** (+3/+0). 의사결정 로그 2건 추가 (인프라 박제 + dry-run/apply 분기 정책). 다음 1순위 = 사용자 측 venv/pykrx 설치 + Tier 0 실 시드 실행 → T7e.7 RLS 수동 QA. |
| 2026-05-08 (41차) | **T7e.7/T7e.8 순서 박제 + name/sector (a) ALTER TABLE 결정 — 문서 정합성 정정**. 사용자 핵심 목표(D19 진짜 30종목 표시) 직접 advance 위해 T7e.8을 1순위로, T7e.7 RLS QA를 후속으로 박제. (a) HANDOFF.md §0 루틴 + §1 Git row + §2 A/B 스왑 + Last updated. (b) 루트 CLAUDE.md 진행 순서 v3.1 블록 T7e.7/T7e.8 라인 순서 + "다음 1순위" 라벨 이동. (c) 본 파일 header status + Last updated + T7e.8 task에 41차 박제 라인 + 의사결정 로그 1건 + 변경 이력. name/sector 갭 = (a) ALTER TABLE 채택, 마이그 0012로 승격 (0011 슬롯 BL-KRIT-8 보존). 별도 commit `feat(T7e.8): migration 0012 short_list_30 name/sector columns`로 분리. ProgressDashboard.md는 이미 T7e.8 우선 시퀀스라 수정 불필요. 사전 작업으로 T7e.5(39차) + T7e.6 follow-up(40차) 미커밋 변경을 `feat(T7e.5)` `6dd7f01` · `fix(T7e.6)` `83ee4e7` 2개 commit으로 분리 박제. 코드 변경 0건. 회귀 무관 (docs only). |

| 2026-05-12 (44차) | **T7e.8 follow-up 코드 완료 + production apply blocker 확인**. DART Signal 4/5 구현(`scripts/dart_signals.py`), corp_code seed(`scripts/seed_dart_corp_codes.py`), screen wiring 완료. 실제 DART corpCode.xml에 `corp_cls`가 없어 KRX ticker set으로 market 매핑하도록 수정. 원격 Supabase 0013/0014 미적용으로 seed apply는 PGRST205(table not found)에서 정지. 검증: Python unittest 27 pass + app gate green. |
| 2026-05-12 (45차) | **T7e.8 follow-up production 적용 완료**. Supabase 0013/0014 적용 + `dart_corp_codes` seed + DART cache fill + full dry-run preview 통과 후 사용자 승인으로 `short_list_30` 2026-05-01 30 rows UPSERT. dry-run preview↔DB top 3 ticker/composite 일치, exit 0, client refresh 7회 정상. label 분포: short 모멘텀 10, mid 실적 모멘텀 8 + 모멘텀 2, long 퀄리티 10. 이전 Tier 0 v1 평탄화(Signal 4·5=0)를 DART 실 standalone/quality 기반으로 교체. 다음 1순위 = T7e.7 RLS 수동 QA. |
| 2026-05-21 (53차 §5 정정) | **박제 vs 코드 mismatch 정정 박제 — Group A-H + canonical PR 순서 + Hard gate**. (a) Step 3c caller wiring 박제 `DONE`→**`PARTIAL — dangling server action`** (server action `triggerMonthlyPersonaEvalAction` export OK / page render·import 0 / cron real 0 / UI caller 0). (b) T7e.8 박제 보강: Tier 0 단독 30 rows = **fallback 상태** (메인 path 아님). 메인 path = Tier 1 AI 30 선정 (PR2 후속). (c) canonical PR 순서 박제: **PR2 (Tier 1 AI 30 선정 screening) → PR3a (Group H schema drift fix — admin-reports.ts validation 0 / page.tsx section0.conviction early deref + Section 0~7 nested deref + Section 8 신규 partA/partB/partC/partD vs old conclusion/recommendation/keyQuotes shape mismatch · **Hard gate, PR1 가동 전 선행 필수**) → PR1 (cron monthly-batch real path · server-side only) → PR3b (writer Section 0~7 본문 구현) → PR4 (UI trigger 버튼 + Track Record 탭 + Regen 실 호출 wire)**. (d) Group E (신규) 박제: writer.ts = `section_8` jsonb commit만 가능 (Section 0~7 본문 미구현). (e) omxy 적대적 검토 **7 rounds (R1~R7) CONVERGED-track** + **32 BLOCKERS catch & fix (R1 6 + R2 4 + R3 6 + R4 5 + R5 0 spec CONVERGED + R6 5 + R7 6)**. spec doc: `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md`. 코드 변경 0건, **문서 정정 7 file + spec doc 1 = 총 8 file** (HANDOFF.md + ServicePlan-Admin.md(D23/v1.9) + ReportFramework.md(v2.6) + ProgressDashboard.md + CLAUDE.md(v3.3/D23) + CodebaseStatus.md + 이 문서). |
