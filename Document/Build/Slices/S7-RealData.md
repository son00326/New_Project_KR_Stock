# S7 실데이터 전환 — Mock fixture → 실 API·실 DB·실 AI 호출

```
---
slice_id: S7
slice_name: 실데이터 전환 (Supabase 실 I/O + Anthropic 실 호출 + 외부 API 5종 연결)
architect_id: S7
status: 🟢 진행 중 (S7e 자율 트랙 — T7e.1·T7e.2·T7e.3·T7e.4 ✅, T7e.5~8 잔여)
expected_sessions: 8 (S7a 1 + S7e 2 + S7b 2 + S7c 2 + S7d 1)
current_progress: ~25% (S7e 4/8 sub-task)
---
```

Last updated: 2026-05-08 (38차 — T7e.4 approvals/snapshots Supabase 전환 ✅ · `/admin/portfolio` fail-closed boundary 해제)
선행 문서: `HANDOFF.md §6` (로드맵 SoT) · `ProgressDashboard.md §5` (BL-KRIT) · `ServicePlan-Admin.md §4` (데이터 모델)

> **이 파일은 스켈레톤이다.** S7a 킥오프 첫 행동으로 아래 Tasks를 Phase별로 세분화·체크리스트화한다. Placeholder가 최소한인 이유는 각 Phase(S7a~S7e)가 외부 API 응답·실측 후에만 구체화되기 때문.

---

## 목표 (Why)

Mock Skeleton(S0~S6)이 UI·라우트·타입·스키마·순수 로직을 완결했지만, **모든 데이터는 `tudal/src/lib/data/mock-*.ts` fixture에서 온다**. S7은 Mock을 실 API·실 Supabase·실 Anthropic 호출로 교체하여 어드민 3명이 실제로 쓸 수 있는 상태로 전환한다. **완료 기준**: Must 19 모두 실데이터 기반으로 동작 + 실 AI 호출 비용 추적 + 실 운용 검증(S9)으로 넘어갈 준비.

---

## 포함 Phase (HANDOFF §6 SoT 이식)

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
> - **AI 키 발급 ✅**: T7a.1~6 정상 진행 + Tier 1 (Core 11 평가) + Tier 2 (Sector Board 활성화) 가동
> - **AI 키 미발급 ⏸**: T7a 전체 ⏸ → S7e + T7e.8 Tier 0 단독으로 30종목 진짜 산출 → 어드민 화면에 🔢 점수 + ⚪ "AI 분석 대기" placeholder. AI 키 발급 시 plug-in.

- [ ] T7a.1 `ANTHROPIC_API_KEY` `.env.local` 투입 + 접속 테스트
- [ ] T7a.2 `src/lib/ai/client.ts` — Anthropic SDK wrapper + prompt cache 옵션
- [ ] T7a.3 `src/lib/ai/cost-logger.ts` — `/messages` response의 `usage` 파싱 → `cost_log` INSERT (ticker·persona_id·section 태깅)
- [ ] T7a.4 `src/lib/trading/ai/decide-order.ts` — S8 어댑터 skeleton 빈 훅(`throw 'not-embedded'`) 선행 박기
- [ ] T7a.5 `/admin/settings/cost` 대시보드를 mock 대신 실 `cost_log` SELECT로 교체
- [ ] T7a.6 Vitest — 비용 추정·파싱 단위 테스트
- [ ] **T7a.7 (D19 Tier 1) Core 11 페르소나 평가**: T7e.8 Tier 0 후보 150 → 시간대별 페르소나 가중치(단기 Druckenmiller↑·중기 Lynch↑·장기 Buffett·Munger·Fisher↑) → 단/중/장 각 10 = 30 선정. `src/lib/screening/persona-eval.ts`. 출력: `🤖 AI 점수`(0~100) per (종목, 시간대) → `short_list_30.ai_score` 컬럼 (마이그 0010에 추가 검토)
- [ ] **T7a.8 (D19 합의 에이전트) 4종 배지 산출**: 🔢 vs 🤖 비교 → 🟢 강한 합의 / 🔵 숫자 우세 / 🟣 AI 우세 / ⚪ AI 분석 대기. `src/lib/screening/consensus.ts`
- [ ] **T7a.9 (D19 Tier 2) Sector Board 활성화 시점 — 30종목만**: `ReportFramework.md §7` 14섹터별 10명 박제 중 **각 종목의 섹터 14명만** 활성화 (전체 140명 X). 종목당 Core 11 + Sector 14 = 25명. M17 hardcap 40만원 내 통제 (월 30 × 25 ≈ 750 LLM call/월)
- [ ] **T7a.10 (D19 Reflection 신규 엔티티 후보) `reflection_log` 검토**: 매월 말 실현 수익률 + 페르소나별 적중률 → 다음달 prompt 주입 컨텍스트. S7e 마이그에 포함할지 또는 S7a 후속에서 분리할지 결정. SoT: `ReportFramework.md §8` Step 4 후속

### Phase S7e (세션 2~3, 36차 진입)
- [x] **T7e.1 마이그레이션 0010 검증 완료** (36차) — `alert_event_rls_hardening` 20260505134639 적용 확인 (`mcp__supabase__list_migrations`). E6 alert_event 테이블 신설 + AlertType CHECK 12종 + `mark_alert_read`/`record_alert_exit_decision`/`raise_portfolio_dispute`/`resolve_portfolio_dispute` 4 RPC + RLS select-all/insert-own/update-own. **BL-KRIT-7 ✅ 해소**. 0011 자리는 S8 (BL-KRIT-8) 예약 유지.
- [x] **T7e.2 `mock-admin-shortlist.ts` → Supabase SELECT 완료** (36차) — `src/lib/data/admin-shortlist.ts` 신규 (transformer + delta 집계 + month/tickerMeta 옵션 + Supabase error throw). 5 page-level importer 갱신: `/admin`, `/admin/settings`, `/admin/portfolio`, `/admin/portfolio/actions.ts` (sync helpers를 `ShortListItem[]` param 받게 리팩터), `/admin/report/[ticker]/page.tsx`(T7e.3 boundary 위해 mock pair 유지). reportLinksEnabled prop 경계 추가 (`shortlist-row`/`delta-banner`/`bucket-section` + `/admin`+`/portfolio`에서 false 전달). `/portfolio` 빈 shortlist placeholder + Accept/Reject T7e.3·4 전까지 disabled. 게이트 generated_at = 실 row.createdAt 기반(synthetic month-start 폐기). Vitest 8 신규 (transformer/aggregate). vi.mock으로 portfolio actions test 우회. mock-mock importers (committee/report) 보존 (T7e.3 스코프). **검증**: build 25 routes · lint 0 · test:ci 314/39 (이전 306/38 +8/+1).
- [x] **T7e.3 `stock_reports`·`committee_votes` Supabase SELECT 완료** (37차) — `src/lib/data/admin-reports.ts` 신규 (Section0~8+Appendix 타입 정의 + transformer + `getReportByTicker`/`reportExistsForMonth` 실 SELECT + `deriveBucketNeighbors` 순수 함수). `src/lib/data/admin-committee.ts` 신규 (transformer + `getVotesByReportId` 실 SELECT + `aggregateVotes` 이관). `/admin/report/[ticker]/page.tsx`는 Supabase 전환 + `getActiveShortList` active shortlist month 기준 report 조회 + `MOCK_ADMIN_SHORTLIST.find` 폐기. `regenerate/actions.ts`는 `MOCK_ADMIN_REPORTS.some` → `reportExistsForMonth` 실 SELECT (try/catch → `report_lookup_failed`). `reportLinksEnabled={false}` 3곳 제거 (admin home DeltaBanner + admin home BucketSection + portfolio BucketSection) → `/admin/report/[ticker]` 클릭 활성(단, Delta REMOVED는 리포트 대기 유지). portfolio actionsDisabledMessage T7e.4만 남기게 단축. mock-admin-report.ts·mock-admin-committee.ts 보존 (consistency 테스트 유지). Vitest 19 신규/보강 (admin-reports 10 + admin-committee 6 + regenerate 1 + delta-banner 2). **검증**: build 25 routes · lint 0 · test:ci **333 pass / 42 files** (이전 314/39 +19/+3) · tsc --noEmit 0.
- [x] **T7e.4 `portfolio_approval`·`portfolio_snapshot` Supabase 실 I/O 완료** (38차) — `src/lib/data/admin-approvals.ts` 신규 (PortfolioApproval transformer + `getApprovalsByMonth`/`getApprovalById` + `createPortfolioApproval` + `raisePortfolioDispute`/`resolvePortfolioDispute` RPC wrapper). `src/lib/data/admin-snapshots.ts` 신규 (PortfolioSnapshot transformer + `insertPortfolioSnapshots`). `/admin/portfolio/page.tsx` `MOCK_ADMIN_APPROVALS` → Supabase SELECT. `actions.ts` Reject/dispute/resolve는 실 I/O. Accept는 fake entryPrice 저장 금지로 실 가격 소스가 없으면 `entry_price_unavailable`을 반환하고 E4 INSERT 전 중단한다. `portfolio_snapshot` bulk INSERT wrapper는 준비됨. E4 partial UNIQUE race(23505)는 accept 경로에서만 `already_finalized` 매핑. `actionsEnabled={false}` 제거로 `/portfolio` fail-closed UI boundary 해제. 신규 에러 코드 3종(`entry_price_unavailable`/`approval_write_failed`/`reanalysis_limit_reached`)은 한국어 운영자 메시지로 표시. Vitest 12 신규/보강 (admin-approvals 4 + admin-snapshots 2 + portfolio actions 4 + portfolio-panel 2). **검증**: build 25 routes · lint 0 · test:ci **345 pass / 45 files** (이전 333/42 +12/+3) · tsc --noEmit 0.
- [ ] **T7e.5 (다음 1순위)** `mock-admin-regen-counters.ts` → 실 INSERT/UPDATE + M9 cap 가드 실 동작
- [ ] T7e.6 `mock-admin-access-logs.ts`·`mock-admin-performance.ts`·`mock-admin-decision-tree.ts` → 실 SELECT
- [ ] T7e.7 RLS 정책 브라우저 수동 QA (멤버 권한 403 확인)
- [ ] **T7e.8 (D19, 2026-05-08 35차) Tier 0 인디케이터 자동 스크리닝 — AI 키 불필요**:
  - `src/lib/screening/indicators.ts` — pykrx·KRX·DART 기반 5-Signal Composite × 시간대별 가중치
  - 단기 가중↑: 모멘텀(MA 골드크로스)·거래량 급증·외국인 순매수 강도
  - 중기 가중↑: 실적 모멘텀·PEAD·ROE 상승·산업 사이클
  - 장기 가중↑: ROIC 일관성·FCF·부채비율·밸류(PER/PBR)
  - 출력: 단/중/장 후보 50씩 = 150 → 시간대별 점수 0~100 (`short_list_30` 테이블에 저장)
  - **AI 키 미발급 시 단독 가동** = 진짜 코스피·코스닥 30종목 + 실 가격·재무·뉴스 표시 가능
  - AI 키 발급 시 S7a Tier 1·2 plug-in (Core 11 + Sector 14 페르소나 평가)
  - 박제: `ServicePlan-Admin.md §1A.5 D19` + `Service/Report/ReportFramework.md §8 Step 0`

### Phase S7b (세션 4~5)
- [ ] T7b.1 Naver News API 실 호출 경로 전환
- [ ] T7b.2 Resend 도메인 인증 + 발송 테스트
- [ ] T7b.3 M11 Anthropic 실 브리핑 생성 (08:00 KST Cron 실 검증)
- [ ] T7b.4 M12 Anthropic 실 분류 (Critical/Warning/Info)
- [ ] T7b.5 `briefing_log`·`news_event` 실 INSERT 확인

### ★ S7b 완료 후 게이트 — D11 AI 가상 포트 1차 가동 (D18, 2026-05-08)

> **D18 박제**: S7b 완료 시점에 KRX/pykrx/DART/네이버 + 실 Anthropic + 실 Supabase로 D11 AI 가상 포트가 **KIS 0개로 작동 가능**한 상태 도달. S7c 진입 전 **어드민 3인이 며칠~1주 운용 검증** — 가상 포트 의사결정 품질·승인 워크플로우·재생성 cap·뉴스 분류 등 검증 후 S7c 진입. 자동매매(S8)는 D11 운용 검증 후 단독 진입.

운용 검증 체크리스트:
- [ ] **Short List 30 = 진짜 코스피·코스닥 종목** (mock 30개 X) — 실 종목명·섹터·현재가·등락률 (D19 검증 핵심)
- [ ] 단기 10 / 중기 10 / 장기 10 = 시간대별 가중치 작동 (단기엔 모멘텀↑, 장기엔 가치↑)
- [ ] 각 종목 카드에 🔢 숫자 점수(0~100) 노출 (Tier 0 5-Signal Composite)
- [ ] 각 종목 카드에 🤖 AI 점수(0~100) 노출 — AI 키 ✅ 시 / 미발급 시 ⚪ "AI 분석 대기 중" placeholder (D19)
- [ ] 합의 배지 4종 노출 — 🟢 강한 합의 / 🔵 숫자 우세 / 🟣 AI 우세 / ⚪ AI 분석 대기
- [ ] AI 코멘트 1~2줄 노출 — AI 키 ✅ 시 Core 11 합의 핵심 논거 / 미발급 시 placeholder
- [ ] 종목 카드 클릭 → 풀 리포트(Section 0~8) 진입 (AI 키 ✅ 시 실 LLM 생성 / 미발급 시 placeholder)
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
- [ ] Must 19 모두 실 경로 동작 (`HANDOFF.md §9` 체크리스트 전부 체크)
- [ ] 실 AI 호출 횟수 > 0 · `cost_log` 실 INSERT 누적 확인
- [ ] 2채널 알림 실 발송 로그 확인 (텔레그램·이메일)
- [ ] Vercel Cron 4건(monthly-batch · morning-briefing · news-sweep · silent-health) 실 실행 1주 연속 성공
- [ ] `CodebaseStatus.md` "실데이터 연결 N/19" N → 19 갱신
- [ ] `ProgressDashboard.md` S7 ✅ 표기 + S8 단독 진입 지표 (D18 2026-05-08, S7d 후 단독 진입으로 분리)

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

- 2026-04-21: 스켈레톤 생성. HANDOFF §6 로드맵 테이블을 Phase별로 이식. 각 Phase Task는 킥오프 시점에 세분화 원칙.
- 2026-05-08 (36차) — **T7e.2 부분 마이그레이션 boundary 결정**: shortlist만 real Supabase로 전환하고 reports/committee는 T7e.3까지 mock pair 유지. 이유: real shortlist + mock report 혼합 시 신규 ticker가 mock report에 없으면 `/admin/report/[ticker]` → 404 위험. 보호 장치 = `reportLinksEnabled={false}` prop을 ShortlistRow/DeltaBanner/BucketSection에 전파해 T7e.3 전까지 리포트 클릭 자체를 차단. 같은 이유로 `/portfolio` Accept/Reject도 T7e.3·4 전까지 disabled.
- 2026-05-08 (36차) — **에러 처리 정책**: `getActiveShortList()`는 Supabase error를 빈 배열로 swallow하지 않고 `throw` (운영 검증 시 RLS/schema/연결 문제 노출). Server Actions은 try/catch로 잡아 `{success:false, error:"shortlist_lookup_failed"}` 변환. Server Components는 error.tsx 바운더리에 위임.
- 2026-05-08 (36차) — **게이트 generated_at 기준 변경**: 기존 `${month}T09:00:00+09:00` 합성 timestamp → 실 `short_list_30.created_at` 사용. 같은 월의 행은 Tier 0 batch INSERT라 createdAt 동일 가정. T7e.8이 월 중간에 INSERT해도 24h Hold가 정확히 동작.
- 2026-05-08 (36차) — **Tier 0 데이터 수집 인프라 결정 (B-1)**: pykrx Python 의존성 때문에 Vercel(Node) Edge Function 배제. 로컬 Python 스크립트(scripts/, idempotent upsert · dry-run · CSV 백업 · month 인자 · env 기반 Supabase 접속) → 사용자가 로컬 실행 → Supabase upsert. 자동화는 S7/S8 안정화 후 GitHub Actions 또는 별도 cron으로 승격.
- 2026-05-08 (36차) — **T7e.2 스코프 갭 명시**: `short_list_30` 스키마는 ticker만 보관(name·sector 컬럼 없음). transformer는 fallback (name=ticker · sector="미분류") 또는 외부 lookup. T7e.8 prep 단계에서 3옵션 중 결정 필요: (a) ALTER TABLE로 컬럼 추가 (마이그 0011 충돌 시 0012) / (b) 별도 `tickers_meta` 테이블 + JOIN / (c) 정적 lookup TS 파일 (Python 스크립트가 함께 갱신).
- 2026-05-08 (37차) — **T7e.3 부분 마이그레이션 boundary 2번째 해제**: shortlist에 이어 reports/committee_votes도 실 Supabase로 전환. 이로써 `/admin/report/[ticker]`는 `stock_reports` + `committee_votes` 실 SELECT, `/admin` + `/portfolio` 카드 클릭은 활성. **시드 부재 상태 일관 동작**: shortlist 빈 상태 → /admin은 빈 UI, /report는 도달 불가. shortlist 시드 후 reports 시드 전 상태 → /report는 `notFound()` 일관. T7e.4 (approvals/snapshots) 진입 전까지 Accept/Reject만 disabled 유지.
- 2026-05-08 (38차) — **T7e.4 실 승인/스냅샷 전환 결정**: (1) 실제 테이블명은 마이그 0004 기준 단수 `portfolio_approval` 유지 (`portfolio_approvals` 아님). (2) Reject 2회 UI 응답은 기존 UX대로 `reanalysisCount=2`를 반환하지만 DB 컬럼 `reanalysis_count`는 0004 CHECK(≤1)에 맞춰 1로 clamp한다. (3) cross-admin dispute/resolve는 RLS owner-bound UPDATE를 우회하지 않고 0010 security-definer RPC(`raise_portfolio_dispute`/`resolve_portfolio_dispute`)만 호출한다.
- 2026-05-08 (38차) — **Accept fail-closed UX 결정**: fake entryPrice는 production DB에 절대 박제하지 않는다. 실 가격 소스가 붙기 전 Accept는 운영 가능 상태가 아니라 `entry_price_unavailable`으로 E4 INSERT 전 중단하며, UI는 신규 오류 코드(`entry_price_unavailable`/`approval_write_failed`/`reanalysis_limit_reached`)를 한국어 운영자 메시지로 표시한다. 실 가격 wiring 시점에는 E4+E5를 RPC 트랜잭션으로 묶는 후속 검토가 필요하다.
- 2026-05-08 (37차) — **Section 타입 canonical 위치 변경**: `ReportSection0..ReportAppendix` 10종 jsonb shape 타입을 mock-admin-report.ts → `src/lib/data/admin-reports.ts`로 canonical 이전. mock-admin-report.ts는 자체 사본을 유지 (consistency 테스트만 사용, 향후 정리 시 일괄 폐기). 페이지 import 경로는 mock → real 1회 전환.
- 2026-05-08 (37차) — **regenerate 액션 T7e.3 동시 전환**: 원래 T7e.5 `regen-counters` 스코프지만, 이번 액션의 핵심은 `MOCK_ADMIN_REPORTS.some()` 존재 검사이므로 T7e.3 스코프(reports 실 SELECT)에 자연 포함. 카운터 적재(MOCK_ADMIN_REGEN_COUNTERS) + cost_log(MOCK_ADMIN_COST_LOG) 부분은 T7e.5에서 그대로 처리.

---

## 이슈·발견

- (킥오프 시 추가)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-21 | 초기 생성 (placeholder). HANDOFF §6 S7a~e 테이블을 Phase 5단계로 이식. Tasks는 초기 초안. |
| 2026-05-08 (35차) | **D19 박제 — Tier 0/1/2 + 합의 배지 + Reflection 반영.** (a) Phase S7e Tasks에 T7e.8 신규 — Tier 0 인디케이터 자동 스크리닝 (AI 키 불필요, pykrx·KRX·DART, 단/중/장 후보 150). (b) Phase S7a 진입 분기 박스 — AI 키 발급 여부에 따라 정상 경로 vs ⏸ fallback. (c) Phase S7a Tasks에 T7a.7~10 신규 — Tier 1 Core 11 페르소나 평가, 합의 배지 4종 산출, Tier 2 Sector Board 활성화 (30종목만), Reflection 엔티티 검토. (d) ★ S7b 게이트 운용 검증 체크리스트 강화 — 진짜 코스피·코스닥 30종목 / 🔢🤖 이중 점수 / 합의 배지 4종 / AI 코멘트 1~2줄 / 클릭→풀 리포트 / 실 가격·재무·뉴스. AI 키 미발급 시 조건부 동작 표기. SoT: `ServicePlan-Admin.md §1A.5 D19` + `Service/Report/ReportFramework.md §8`. |
| 2026-05-08 (36차) | **T7e.1 + T7e.2 ✅ 완료 — 자율 트랙 §A 진입 + 부분 마이그레이션 boundary 박제.** (a) header status ⚪→🟢, current_progress 0%→~12%. (b) T7e.1 ✅ — 마이그 0010 적용 검증 (`alert_event_rls_hardening`), BL-KRIT-7 해소. (c) T7e.2 ✅ — `src/lib/data/admin-shortlist.ts` 신규 + 5 page-level importer 갱신 + reportLinksEnabled boundary + Supabase error throw + createdAt 기반 generated_at + `/portfolio` 빈 placeholder + Vitest 8 신규 (전체 314/39). 검증: build 25 routes · lint 0 · test:ci 314 pass / 39 files. (d) 의사결정 로그 5건 추가 (boundary, error policy, gate timestamp, B-1 인프라, name/sector 갭). (e) `/report/[ticker]`는 T7e.3 boundary 위해 mock pair로 revert (real shortlist + mock report 혼합 위험 회피). 코드 변경 8 파일 · 신규 2 파일 · 문서 갱신 별도. |
| 2026-05-08 (38차) | **T7e.4 ✅ 완료 — approvals/snapshots Supabase 전환 + `/portfolio` fail-closed boundary 해제.** (a) header status `T7e.1·T7e.2·T7e.3 ✅`→`T7e.1·T7e.2·T7e.3·T7e.4 ✅`, current_progress ~19%→~25% (4/8). (b) `src/lib/data/admin-approvals.ts` 신규 — transformer + month/id SELECT + `createPortfolioApproval` + dispute/resolve RPC wrapper. (c) `src/lib/data/admin-snapshots.ts` 신규 — transformer + `insertPortfolioSnapshots` bulk INSERT(DB-generated uuid). (d) `/admin/portfolio/page.tsx` approvals SELECT 실 전환 + `actionsEnabled={false}` 제거. (e) `actions.ts` Reject/dispute/resolve 실 I/O, Accept fake entryPrice 금지(`entry_price_unavailable` fail-closed), snapshot INSERT wrapper, 23505 race는 accept 경로에서만 `already_finalized`. 신규 에러 코드 3종은 한국어 배너로 표시. (f) Vitest 12 신규/보강. 검증: build 25 routes · lint 0 · test:ci **345 pass / 45 files** (+12/+3) · tsc --noEmit 0. 의사결정 로그 4건 추가 (단수 테이블명, reject count clamp/3회 차단, dispute RPC, fake entryPrice 금지/fail-closed UX). 다음 1순위 = T7e.5 (regen-counters) 또는 T7e.8 (B-1 Python). |
| 2026-05-08 (37차) | **T7e.3 ✅ 완료 — reports/committee Supabase 전환 + boundary 2번째 해제.** (a) header status `T7e.1·T7e.2 ✅`→`T7e.1·T7e.2·T7e.3 ✅`, current_progress ~12%→~19% (3/8). (b) `src/lib/data/admin-reports.ts` 신규 — Section0~8+Appendix canonical 타입 정의 + transformer + `getReportByTicker`/`reportExistsForMonth` + `deriveBucketNeighbors` 순수 함수. (c) `src/lib/data/admin-committee.ts` 신규 — transformer + `getVotesByReportId` + `aggregateVotes` 이관. (d) `/admin/report/[ticker]/page.tsx` Supabase 전환 (active shortlist month 기준 report 조회, `MOCK_ADMIN_SHORTLIST.find` 폐기). (e) `regenerate/actions.ts` `MOCK_ADMIN_REPORTS.some` → `reportExistsForMonth` (try/catch → `report_lookup_failed` 신규 에러 코드). (f) `reportLinksEnabled={false}` 3곳 제거 → 카드 클릭 활성(Delta REMOVED는 리포트 대기 유지). (g) portfolio actionsDisabledMessage T7e.4만 남기게 단축. (h) Vitest 19 신규/보강 (admin-reports 10 + admin-committee 6 + regenerate 1 + delta-banner 2). 검증: build 25 routes · lint 0 · test:ci **333 pass / 42 files** (+19/+3) · tsc --noEmit 0. 의사결정 로그 3건 추가 (boundary 2번째 해제, Section 타입 canonical 위치, regenerate 동시 전환). 다음 1순위 = T7e.4 (approvals/snapshots) 또는 T7e.8 (B-1 Python). |
