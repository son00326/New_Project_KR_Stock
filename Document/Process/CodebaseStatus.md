# CodebaseStatus.md — 현재 구현 스냅샷

> **용도**: 이 문서는 **"지금 코드에 무엇이 있는가"**의 스냅샷이다. 덮어쓰기 중심 — 과거 상태는 git log에 있고 여기는 **현재**만 유지한다.
>
> **HANDOFF.md와의 구분**:
> - `HANDOFF.md` = 미래 지향 ("다음 세션에 무엇을 할지")
> - `CodebaseStatus.md` = 현재 지향 ("지금 무엇이 있는가", 라우트·파일·연결 상태)
>
> **갱신 트리거**: 슬라이스 클로즈 완료 시, 또는 라우트/실데이터 연결/환경변수 등 구조적 변화 시 즉시 갱신.

---

## 최근 갱신

**2026-04-20** (23차 후속 정정): **S6 ✅ Mock 완료 반영** — Mock Skeleton Stage 1 완성(S0~S6). Mock 동작 19/19 · 실데이터 0/19 · 실 AI 호출 0 · 운용 검증 0일. 진짜 MVP는 S7(실데이터 전환, 미착수) + 운용 검증 후.
- 마이그레이션 0008(cost_log 확장 ticker·persona_id·section + heartbeat_log + RLS 1종)
- src/lib/cost/{anthropic-pricing.ts·dry-run-estimate.ts·aggregate.ts} (BL-18 견적 박제 + M17 집계 + hardcap 가드)
- src/lib/health/heartbeat.ts (M19 분류·메시지·D10 catch-up·heartbeat_missing 페이로드)
- src/app/(admin)/admin/settings/cost/page.tsx — M17 대시보드 (35만 경보·40만 hardcap·Purpose 비중·Top 5·BL-18 시나리오 비교·시연 영역)
- src/app/api/cron/silent-health/route.ts — Vercel Cron 매일 24:00 KST 2채널 + D10 재시도
- regenerateReport에 isHardcapBlocked 가드 활성 (S4 stub → 실 활성화)
- vercel.json crons 4건으로 확장 (silent-health 추가, 0 15 * * *)
- src/app/(admin)/layout.tsx — Sidebar nav에 AI 비용·Health 항목 노출
- types/admin.ts 확장: AlertType +cost_warning·cost_hardcap·heartbeat_missing · CostLog·CostMonthlySummary·HeartbeatLog·임계치 상수 5종
- src/lib/data/{mock-admin-cost-log.ts·mock-admin-heartbeat.ts} 신설
- 검증: build 22 routes · lint 0 · test:ci 20 files 190 tests pass

**2026-04-19** (22차): S5b ✅ 완료 반영 — M13·M14·M15 3 Must 달성.

**2026-04-19** (21차): **S5a ✅ 완료 반영** — M10·M11·M12·M18 4 Must 달성.
- 마이그레이션 0006(pipeline_health · news_event · briefing_log · briefing_view_event + RLS 4종)
- src/lib/scheduler/monthly-batch.ts + __tests__ (재시도·실패 처리, 13 tests)
- src/lib/email/resend.ts + src/lib/briefing/compose.ts + __tests__ (브리핑 컴포저, 8 tests)
- src/lib/news/{naver-api.ts · scraper.ts · classifier.ts} + __tests__ (분류기, 12 tests)
- src/lib/health/pipeline-health.ts + __tests__ (5 파이프라인 집계, 8 tests)
- vercel.json (crons 3건: 월간 배치 · 모닝 브리핑 08:00 KST · 뉴스 sweep 15분 주기)
- src/app/api/cron/{monthly-batch, morning-briefing, news-sweep}/route.ts 3 cron 핸들러
- src/app/(admin)/admin/settings/health/page.tsx — 5 파이프라인 × 24h 성공률 + 95% Critical 배너 + 실패 tail 50건
- src/app/(admin)/admin/alerts/{page, [id]/page}.tsx — AlertEvent 이력 + Critical/Warning 뉴스 목록 + 상세
- src/components/admin/briefing/briefing-card.tsx — /admin 상단 브리핑 카드
- src/lib/data/ mock 2 신설(mock-admin-pipeline-health·mock-admin-news) + 2 확장(mock-admin-briefings 5일·mock-admin-alerts 6건)
- types/admin.ts 확장: AlertType에 news_warning·briefing_failed 추가 + PipelineHealth·PipelineHealthSummary·NewsEvent·임계치 상수 3종
- 검증: build 20 routes · lint 0 · test:ci 15 files 128 tests pass

**2026-04-19** (20차): S4 ✅ 완료 반영.
- src/lib/performance/ 6파일(sharpe·mdd·alpha·judge·cap-months·regen-cap) + __tests__ 6 파일 (53 tests 추가, 누적 87)
- /admin/track-record 실동작(5 카드 · 월별 테이블 · 버킷별 · Counterfactual)
- /admin/decision-tree 실동작(게이지 3종 · ○/△/✕ 배지 · Recharts Client island)
- /admin/report/[ticker]/regenerate 실동작(서브라우트 · cap 가드 · cost_log stub 훅)
- 마이그레이션 0005(E5 portfolio_snapshot · E8 regen_counter · cost_log stub + RLS)
- S3 hardening 병행: resolveAdminId · try/catch · dispute trim
- src/lib/data/ 3 mock fixture 신설/확장

**2026-04-17** (19차): S3 ✅ 완료 반영.
- src/lib/portfolio/ 6파일(순수 로직) + 5 __tests__(43 tests) 신설
- /admin/portfolio 실동작(page.tsx 전면 재작성 + portfolio-panel.tsx Client island + actions.ts 4 Server Actions)
- 마이그레이션 0004(E4 v1.3 · E11 kr_business_days · alert_event gating_auto_relief 타입)
- scripts/ 디렉토리 신설 (seed_kr_holidays.py)
- Vitest 4.1.4 셋업 (G-10=b)
- types/kr-business-days.ts 신설 + types/admin.ts v1.3

**2026-04-17** (18차): S2 ✅ 완료 (E2·E3·E10 + 4 mock + 10 섹션 accordion).
**2026-04-17** (16~17차): S1 ✅ 완료 (E1 + 33행 mock + Delta/크리시스 UI).
**2026-04-17** (15차): S0 Foundation 완료 (레거시 제거·Supabase 연결·17 라우트·9엔티티 RLS sketch·디자인 토큰).

---

## tudal/ 현재 상태 (2026-04-20 · S6 Mock 완료 기준 · **실데이터 연결 0/19**)

### 규모
- TypeScript 파일: `src/` 기준 **~145개** (S0 70 → S1 75 → S2 85 → S3 95 → S4 110 → S5a 130 → S5b 140 → S6 145)
- 라우트: **22개** (S6에서 /admin/settings/cost·/api/cron/silent-health 2건 추가)
  - **Main 6**: `/`, `/_not-found`, `/login`, `/signup`, `/macro`, `/stock/[ticker]`
  - **Auth 1**: `/auth/callback`
  - **Admin 11**: `/admin`, `/admin/portfolio` **(S3)**, `/admin/alerts` **(S5a)**, `/admin/alerts/[id]` **(S5a)**, `/admin/track-record` **(S4)**, `/admin/decision-tree` **(S4)**, `/admin/settings`, `/admin/settings/notifications`, `/admin/settings/health` **(S5a)**, `/admin/settings/cost` **(S6)**, `/admin/report/[ticker]` **(S2)**, `/admin/report/[ticker]/regenerate` **(S4)**
  - **Cron 4** (Vercel Cron): `/api/cron/monthly-batch` (M10 월간 day 1 09:05 KST), `/api/cron/morning-briefing` (M11 매일 08:00 KST), `/api/cron/news-sweep` (M12 15분 주기), `/api/cron/silent-health` **(S6 M19, 매일 24:00 KST)**

### 기술 스택
- Next.js 16.2.3 + React 19.2.4 + TypeScript strict + Tailwind v4
- UI: shadcn(base-nova) + Lucide + Recharts + Base UI(@base-ui/react) Dialog
- 라우팅: App Router, 라우트 그룹 `(auth)` pass-through / `(main)` Header+Footer / `(admin)` 자체 chrome(로고·사이드바·면책 Footer)
- 인증: Supabase SSR (`.env.local`), `/admin/*` ADMIN_EMAILS allowlist 가드 미들웨어
- **테스트: Vitest 4.1.4** (S3 G-10=b) — node 환경 · `src/**/__tests__/**/*.test.ts` · passWithNoTests · native tsconfigPaths
- 브랜딩: 주픽

### 레이아웃 구조
- `app/layout.tsx` = 최소 HTML + body (Header·Footer 제거됨, 17 라우트 대응)
- `app/(main)/layout.tsx` = Header + Footer (main 라우트용)
- `app/(auth)/layout.tsx` = pass-through
- `app/(admin)/layout.tsx` = 로고·사이드바(7 nav)·면책 Footer

### 데이터 레이어 (mock 기반, Supabase 세팅 완료 · 실 SELECT/INSERT 연결 0)
- **Main mock** (6): `mock-stocks`·`mock-financials-extended`·`mock-quarterly`·`mock-ohlcv`·`mock-corporate`·`mock-macro`
- **Admin mock** (S0 9 + S1~S4 확장 → 총 17):
  - S0 기초 shape: `mock-admin-shortlist`·`mock-admin-reports`·`mock-admin-committee-votes`·`mock-admin-approvals`·`mock-admin-snapshots`·`mock-admin-alerts`·`mock-admin-briefings`·`mock-admin-regen-counters`·`mock-admin-brokerage`
  - S1 추가: 33행 shortlist fixture (30 + REMOVED 3)
  - S2 추가: `mock-admin-report` (30 리포트 · 대표 5종 상세) · `mock-admin-committee` (630 votes) · `mock-admin-committee-personas` (Core 11 + Sector 22×5) · `mock-admin-report-view-log` (2인·1인 열람 seed)
  - S3 추가: `mock-admin-access-logs` (7일 3인 혼합 fixture · active=false 기본) · `mock-admin-approvals` 시드 보강(2026-03 · 2026-04 is_final=true)
  - S4 추가: `mock-admin-performance` (3개월 월별·버킷·Counterfactual·DailyReturns 60일) · `mock-admin-decision-tree` (판정 스냅샷·월별 verdicts) · `mock-admin-regen-counters` 시드 3건(fresh·partial·exhausted). `mock-admin-snapshots`는 Accept hook으로 런타임 push.
- **실데이터**: 0 (KRX·한투·DART·pykrx 미연결 — S5 M10에 배치 연결 예정)
- **Supabase**: 프로젝트 `fpriyjykihxhhvqudvdb` 연결. `.env.local` (URL·anon·service_role·ADMIN_EMAILS 3명).
- 유저: 0

### 마이그레이션 (supabase/migrations/)
| 파일 | 내용 | 상태 |
|---|---|---|
| `0001_rls_sketch.sql` | 9엔티티 admin-only RLS 초안 + `is_admin()` 헬퍼 | **sketch 미실행** (0002+가 실 생성) |
| `0002_s1_shortlist30.sql` | admin_emails + `is_admin()` 실 생성 + E1 short_list_30 + RLS | 실 |
| `0003_s2_reports.sql` | E2 stock_reports + E3 committee_votes + E10 report_view_log + RLS + GIN 인덱스 | 실 |
| `0004_s3_approval.sql` (S3) | E4 portfolio_approval v1.3(dispute_reason/gating_auto_relief/reanalysis_count) + E11 kr_business_days(2024~2026 수기 seed) + alert_event check constraint 'gating_auto_relief' | 실 |
| `0005_s4_performance.sql` (S4) | E5 portfolio_snapshot (partial UNIQUE on ticker NULL/NOT NULL) + E8 regen_counter (UNIQUE ticker+month·auto≤1·manual≤2) + cost_log stub (R5 pre-wire) + RLS 3종 | 실 |
| `0006_s5a_automation.sql` (S5a) | pipeline_health (5 파이프라인 × 24h) + news_event (UNIQUE url) + briefing_log (UNIQUE date) + briefing_view_event (dedupe) + RLS 4종 | 실 |
| `0007_s5b_notifications.sql` (S5b) | admin_settings(intraday_mode) + ticker_alert_pref(UNIQUE admin+ticker) + intraday_anomaly_event(UNIQUE dedup_key) + RLS 3종 | 실 |
| `0008_s6_hardening.sql` (S6) | cost_log 확장(ticker·persona_id·section + 인덱스 2) + heartbeat_log(UNIQUE date) + RLS 1종 | 실 |

### 타입 정의 (src/types/)
- `stock.ts`·`corporate.ts`·`macro.ts` (main)
- `admin.ts` **v1.3** (S3) — E1~E10 + DISPUTE_REASON_MIN_LENGTH=20 + AlertType 'gating_auto_relief'
- `kr-business-days.ts` (S3 신설) — E11 `KrBusinessDay`

### 순수 로직·도메인 레이어 (S3 신설)
`src/lib/portfolio/` (6 파일):
| 파일 | 책임 | 테스트 |
|---|---|---|
| `approval-logic.ts` | isAcceptAllowed · isUniqueViolation(pg 23505 가드) | 10 cases |
| `business-days.ts` | addBusinessDays · countBusinessDaysBetween (시간 보존) | 7 cases |
| `gating.ts` | computeAcceptGate(24h → D+4 영업일 → 2인 열람 · autoRelief skip) | 6 cases |
| `auto-relief.ts` | detectSingleAdminStreak (windowDays 커스텀) | 7 cases |
| `dispute.ts` | validateDisputeReason(trim ≥20) · canRaiseDispute · isDisputeHoldExpired · isAcceptBlockedByDispute | 13 cases |
| `calendar.ts` | MOCK_KR_BUSINESS_DAYS_2026 + loadKrBusinessDays stub(S5 Supabase SELECT 예정) | — |

### 라우트·Server Actions (S3 신설)
`src/app/(admin)/admin/portfolio/`:
- `page.tsx` — Server Component (Short List 30 필터 · Delta 집계 · D+5 위젯 · 게이팅 계산 · auto-relief 감지 · finalApproval 탐색)
- `portfolio-panel.tsx` — Client island (Base UI Dialog · useTransition · router.refresh · Accept/Reject/Dispute 3모달 · 실시간 20자 카운터 · 48h Hold 배너)
- `actions.ts` — 4 Server Actions mock (`acceptShortList`·`rejectShortList`·`raiseDispute`·`resolveDispute`). `isUniqueViolation`/실 Supabase catch는 S3 hardening TODO

### 컴포넌트 구조
`src/components/{stock,macro,layout,common,ui}`. `ui/` shadcn(base-nova, Lucide) + Base UI Dialog.

### 디자인 토큰 (S0 유지)
`src/app/globals.css` @theme inline + :root — shadcn base-nova neutral + 한국 증시 관례 `--market-up`(빨강) · `--market-down`(파랑) · `--market-neutral`(회색). radius 4단계 · Geist · chart-1~5.

### 문서 레이어 (AGENTS.md 계층)
- 8 AGENTS.md (deepinit S0 T0.8 · S3에서 vitest.config.ts·test:ci 반영): root · src · src/{app,components,lib,types} · src/lib/{data,supabase}

### scripts/ 디렉토리 (S3 신설)
- `scripts/seed_kr_holidays.py` — S5 M10 pykrx 월간 배치용 참조. Homebrew Python 3.14 PEP 668 → venv 필수. `python3 scripts/seed_kr_holidays.py --from YYYY-MM-DD --to YYYY-MM-DD` 로 SQL UPDATE 블록 stdout.

### 레거시 제거 완료 (S0)
- ~~`app/(main)/pricing`~~ · ~~PLANS/PlanKey~~ · ~~SubscriptionTier/UserProfile/reportViewsRemaining~~ · ~~subscription-gate/report-limit-banner~~ · ~~/pricing 링크~~

### 검증 게이트 현재 상태 (S6 완료 시점)
- `npm run build`: ✅ **22 routes** (TypeScript strict 통과)
- `npm run lint`: ✅ 0 warnings
- `npm run test:ci`: ✅ **20 files / 190 tests pass** (S6 +3 files · +30 tests)
- `npm run dev`: ⚠️ macOS EMFILE 이슈 — `ulimit -n 65535` 후 정상

---

## 시스템·백테스트 현황

### 자동화 백테스트 v6.1 FINAL (2026-04-12 확정)
- 파일: `backtest/full_system_backtest_v6.py`
- 성과: CAGR 20.3% · Sharpe 0.99 · Calmar 0.78 · Max DD -25.8%
- 벤치마크: 삼성전자 B&H 위험조정 beat
- 구성: 3축 분화 + Early Warning + 부분 리밸런싱

---

## Must 19 진행 상황 (S6 Mock 완료 기준)
- **Mock 동작**: 19/19 (100% mock fixture)
- **실데이터 연결**: **0/19** — 전 Must가 mock 의존
- **실 AI 호출**: **0** — Anthropic wrapper 미구현
- **2채널 알림 실 발송**: **0** — Resend·Telegram 미연결
- **외부 API 실 연결**: **0** — KIS·Naver·DART·pykrx 미연결
- **실 운용 검증**: **0일**

MVP Stage 1 기준 = Mock + 실데이터 + 운용 검증 3조건 AND → **미달성**. 진행 경로 = HANDOFF.md §6 S7a~e.

---

## 체크리스트 (변화 시 갱신)

### Mock Skeleton (완료)
- [x] TypeScript 파일 수 증감 (S0: 70 → S6: ~145)
- [x] 라우트 추가 (S0 17 → S6 22)
- [x] Supabase `.env.local` 세팅 (S0 — 단, **anon key 갱신 블로커 DQ-5**)
- [x] 마이그레이션 0001~0008 적용
- [x] Vitest 테스트 인프라 (190 tests pass)
- [x] 레거시 코드 제거 (S0 완료)

### 실데이터 전환 (S7, 미착수)
- [ ] **Anthropic API 키 확보** (BL-KRIT-1) — DQ-2/DQ-7 선결
- [ ] **KIS API 계정 발급** (BL-KRIT-2) — DQ-7 선결
- [ ] **Naver News API 키** (BL-KRIT-3) — DQ-7 선결
- [ ] **Resend 계정 + 도메인 인증** (BL-KRIT-4) — DQ-7 선결
- [ ] **Telegram Bot** (BL-KRIT-5) — DQ-7 선결
- [ ] **Supabase anon key 갱신** (BL-KRIT-6) — DQ-5 선결
- [ ] **마이그레이션 0009** alert_event CHECK 확장 (BL-KRIT-7)
- [ ] Supabase 실 SELECT/INSERT 전환 (S7e · 8 Must)
- [ ] Anthropic wrapper + cost_log 실 INSERT (S7a · M17·M2·M3·M6·M9·M10·M11·M12)
- [ ] 뉴스·브리핑 실 연결 (S7b · M10·M11·M12)
- [ ] 장중·Exit 실 연결 (S7c · M13·M15)
- [ ] Silent Health 실 INSERT + override UI (S7d · M18·M19)

### 운용 검증 (미착수)
- [ ] Vercel 프로젝트 생성 + 환경변수 세팅 (DQ-7)
- [ ] origin push (17 commits ahead, DQ-6)
- [ ] Cron 4건 실 실행 검증
- [ ] 어드민 1개월+ 운용 검증

### 법무 (미착수)
- [ ] Q16 법무 자문 (DQ-3)
- [ ] Q17 이용약관·개인정보처리방침·면책 (DQ-4)

### 유저
- [ ] 어드민 3명 allowlist 실 로그인 (Supabase anon 블로커)
- [ ] 멤버 초대 500cap (Deferred-D)
