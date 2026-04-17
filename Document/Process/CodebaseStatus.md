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

## tudal/ 현재 상태 (2026-04-17 · S3 완료 기준)

### 규모
- TypeScript 파일: `src/` 기준 **~95개** (S0 70 → S1 75 → S2 85 → S3 95)
- 라우트: **17개** (S0 이후 변경 없음 — /admin/portfolio는 S0 stub → S3 실동작)
  - **Main 6**: `/`, `/_not-found`, `/login`, `/signup`, `/macro`, `/stock/[ticker]`
  - **Admin 11**: `/admin`, `/admin/portfolio` **(S3 실동작)**, `/admin/alerts`, `/admin/alerts/[id]`, `/admin/track-record`, `/admin/decision-tree`, `/admin/settings`, `/admin/settings/notifications`, `/admin/settings/health`, `/admin/report/[ticker]` **(S2 실동작)**, `/admin/report/[ticker]/regenerate`

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
- **Admin mock** (S0 9 + S1~S3 확장 → 총 15):
  - S0 기초 shape: `mock-admin-shortlist`·`mock-admin-reports`·`mock-admin-committee-votes`·`mock-admin-approvals`·`mock-admin-snapshots`·`mock-admin-alerts`·`mock-admin-briefings`·`mock-admin-regen-counters`·`mock-admin-brokerage`
  - S1 추가: 33행 shortlist fixture (30 + REMOVED 3)
  - S2 추가: `mock-admin-report` (30 리포트 · 대표 5종 상세) · `mock-admin-committee` (630 votes) · `mock-admin-committee-personas` (Core 11 + Sector 22×5) · `mock-admin-report-view-log` (2인·1인 열람 seed)
  - S3 추가: `mock-admin-access-logs` (7일 3인 혼합 fixture · active=false 기본) · `mock-admin-approvals` 시드 보강(2026-03 · 2026-04 is_final=true)
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

### 검증 게이트 현재 상태
- `npm run build`: ✅ 17 routes (TypeScript strict 통과)
- `npm run lint`: ✅ 0 warnings
- `npm run test:ci`: ✅ **5 files / 43 tests pass** (S3 Vitest 도입 이후 기준)
- `npm run dev`: ⚠️ macOS EMFILE 이슈 — `ulimit -n 65535` 후 정상

---

## 시스템·백테스트 현황

### 자동화 백테스트 v6.1 FINAL (2026-04-12 확정)
- 파일: `backtest/full_system_backtest_v6.py`
- 성과: CAGR 20.3% · Sharpe 0.99 · Calmar 0.78 · Max DD -25.8%
- 벤치마크: 삼성전자 B&H 위험조정 beat
- 구성: 3축 분화 + Early Warning + 부분 리밸런싱

---

## Must 19 진행 상황 (S3 완료 기준)
- ✅ **7/19 (37%)**: M1·M2·M3·M4·M5·M6·M7
- ⚪ 잔여 12: M8·M9(S4) · M10·M11·M12·M13·M14·M15·M18(S5) · M16(S4) · M17·M19(S6)

---

## 체크리스트 (변화 시 갱신)

- [x] TypeScript 파일 수 증감 (S0: 70 → S3: ~95)
- [x] 라우트 추가/제거 (S0 17, 변화 없음 — /admin/portfolio S0 stub → S3 실동작)
- [ ] mock → 실데이터 전환 (슬라이스별, S5 M10부터)
- [x] Supabase `.env.local` 세팅 여부 (S0 완료 · 실 SELECT/INSERT 연결은 S3 hardening 또는 S5 이후)
- [x] 마이그레이션 적용 여부 (0002·0003·0004 실)
- [x] Vitest 테스트 인프라 (S3 G-10=b 도입 · 43 tests)
- [ ] 유저 수 (Alpha/Beta 단계 기준 — S6 이후)
- [x] 레거시 코드 제거 완료 여부 (S0 완료)
