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

**2026-04-22** (30차): **DQ-7 Session 3 부분 진행 — Vercel 첫 production 배포 도달**.
- 새 파일: `tudal/scripts/rotate-cred-mek.mjs` (271 lines · MEK 로테이션 도구 · `--old`/`--new`/`--dry-run` · `.env.local` 자동 로드 · service_role SELECT + memory verify + UPDATE · `.ts`→`.mjs` deviation 박제)
- `.env.local` 신규 3 키 (gitignored): `API_CRED_MASTER_KEY` · `CRON_SECRET` · `ADMIN_REP_EMAIL=son00326@gmail.com`
- `tudal/vercel.json` 변경: `news-sweep` `*/15 * * * *` → `0 0 * * *` (Vercel Hobby plan cron daily 제약 회피)
- `.gitignore` (root): `.vercel/` 추가 (보안 핫픽스 — repo root에 .vercel 생성됐는데 패턴 누락)
- `.vercel/` 위치: **repo root** (`/Users/yong/New_Project_KR_Stock/.vercel/`) — rootDirectory=`tudal` 설정 + cwd=tudal에서 deploy 시 `tudal/tudal` path 중첩 회피
- Vercel 인프라:
  - 프로젝트 `son326s-projects/tudal` (projectId `prj_CEev6UO5TehtgWQoPZ6ZRDDLBJF9`, teamId `team_1IMygRXejEWSsLNTJNJIwfeL`)
  - GitHub repo 연결 `son00326/New_Project_KR_Stock` · Production Branch=`main` (CLI/REST 변경 불가, dashboard만)
  - Framework=nextjs · rootDirectory=`tudal`
  - Env 18 entries (7 keys × 2~3 환경): CLI add 11 + REST API `POST /v10/projects/:id/env?upsert=true`로 Preview 7개 보정
  - 첫 production 배포: https://tudal-tawny.vercel.app · `dpl_397UrMfZET9XLbzxsEDShZmCPZQ4` · READY · target=production · 24 routes · build 48s · TypeScript 통과
- Vercel CLI: v41.3.0 → **v52.0.0** 업그레이드 (v41 OAuth flows 모두 deprecated 410)
- commits: `78dc54b` T14 + `4c6f0e2` cron fix · 30차 push 완료(`3c91194..78dc54b` + `78dc54b..4c6f0e2`)
- 검증: build 24 routes · lint 0 · test:ci 248/248 · Vercel build exit 0 · 회귀 0
- **사용자 다음 세션 잔여**: T16 Supabase Redirect URL · 0009 마이그레이션 실 DB 적용 · T17 Cron dashboard + Smoke Test §6.7

**2026-04-22** (28차): **문서 정합 cleanup** — DQ-7 Session 2 완료 후 전수 정독으로 스테일 포인터·구조 불일치 일괄 정리. Archive 이관: `AutoTrading.md`·`AutoTrading-AI구조설계.md` → `Document/Archive/` + ⚠️ 경고 prefix (D11 이전 자동매매 독립 트랙 가정 기반 · S8 AI 어댑터 drop-in 시 참조 보존). S8-AutoTrading.md T8.1 마이그 번호 **0010→0011** 정정(E12는 DQ-7 0009 선행). HANDOFF §1·§4·§11 · ProgressDashboard §1·§5 · CodebaseStatus(이 문서) · CLAUDE.md + ServicePlan.md v1.2→v1.3. 로드맵 순서 재조정은 Step 2로 유예. 코드 변경 0건 · build/lint/test:ci 회귀 0.

**2026-04-22** (27차): **DQ-7 Session 2 Frontend UI 완료** — `/ralph` 자율 루프 3 Wave. 라우트 22 → **24** (+`/admin/settings/brokerage`·`/admin/settings/binance`). 신규 7 파일 + 수정 1 · +881줄. architect(opus) APPROVED · ai-slop-cleaner CLEAN · 3-gate regression green · tests 248/248 (UI component 테스트 인프라 미도입으로 신규 테스트 0 · 회귀 0). commits: `04d1116` T11 secret-input → `289820e` T9+T10 brokerage·binance UI (executor sonnet × 2 병렬) → `240e7dc` T12 sidebar nav → `4140309` HANDOFF 갱신.

**2026-04-22** (26차): **DQ-7 Session 1 Backend·DB 완료** — Inline TDD (crypto 보안 크리티컬). 11 Task 순차.
- `src/lib/crypto/aes.ts` AES-256-GCM encrypt/decrypt + MEK lazy singleton (14 tests · IV uniqueness 100회 · tamper 4 · MEK config 3)
- `supabase/migrations/0009_dq7_credentials.sql` + rollback.sql — E9 재설계(ciphertext/iv/auth_tag 6 컬럼 + mock_mode) + E12 신설(동일 + testnet_mode) + RLS `*_admin_self` 2종. **실 DB 적용은 Session 3**
- `src/lib/credentials/{types,mask,validation,brokerage,exchange}.ts` 5 파일 · Server Actions(`upsert`·`delete`·`list`·`test` stub `pending-s8`) · ActionResult discriminated union · rep guard(ADMIN_REP_EMAIL) · 23505 매핑 · 43 tests
- Integration tests 20 cases (`vi.hoisted` Supabase mock)
- Cleanup: `types/admin.ts` BrokerageConnection·BrokerageScope 제거 · `mock-admin-brokerage.ts` 삭제
- `.env.example` `API_CRED_MASTER_KEY`·`ADMIN_REP_EMAIL` 신규 + KIS/Binance 블록 주석화
- 검증: build 22 routes · lint 0 · test:ci **248 pass** (190 + 58 신규)

**2026-04-22** (25차): **DQ-7 Admin Credential System 재설계 spec 작성 완료** — `Slices/DQ7-Credentials.md` 신규 (858 줄, Q1~Q5 확정). 바이낸스·KIS 키 per-admin UI + AES-256-GCM 암호화 + Vercel 첫 배포 · S7a 선행 · 4 세션 예상. **마이그레이션 번호 재배정**: 0009 = DQ-7 credential (선점) · 0010 = alert_event CHECK 확장 (BL-KRIT-7). 구현은 다음 세션. 코드 변경 없음(docs only).

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

## tudal/ 현재 상태 (2026-04-22 · DQ-7 Session 3 부분 완료 기준 · **실데이터 연결 0/19** · **Vercel production 배포 ✅ https://tudal-tawny.vercel.app**)

### 규모
- TypeScript 파일: `src/` 기준 **~152개** (S0 70 → S1 75 → S2 85 → S3 95 → S4 110 → S5a 130 → S5b 140 → S6 145 → DQ-7 S1 net ~145 (+5 credential −1 mock) → DQ-7 S2 ~152 (+7 UI))
- 라우트: **24개** (DQ-7 S2에서 `/admin/settings/brokerage`·`/admin/settings/binance` 2건 추가)
  - **Main 6**: `/`, `/_not-found`, `/login`, `/signup`, `/macro`, `/stock/[ticker]`
  - **Auth 1**: `/auth/callback`
  - **Admin 13**: `/admin`, `/admin/portfolio` **(S3)**, `/admin/alerts` **(S5a)**, `/admin/alerts/[id]` **(S5a)**, `/admin/track-record` **(S4)**, `/admin/decision-tree` **(S4)**, `/admin/settings`, `/admin/settings/notifications`, `/admin/settings/health` **(S5a)**, `/admin/settings/cost` **(S6)**, `/admin/settings/brokerage` **(DQ-7 S2)**, `/admin/settings/binance` **(DQ-7 S2)**, `/admin/report/[ticker]` **(S2)**, `/admin/report/[ticker]/regenerate` **(S4)**
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
- `app/(admin)/layout.tsx` = 로고·사이드바(**10 nav** · DQ-7 S2에서 `증권사 키`·`거래소 키` +2 · S8에서 그룹 재편 예정)·면책 Footer

### 데이터 레이어 (mock 기반, Supabase 세팅 완료 · 실 SELECT/INSERT 연결 0)
- **Main mock** (6): `mock-stocks`·`mock-financials-extended`·`mock-quarterly`·`mock-ohlcv`·`mock-corporate`·`mock-macro`
- **Admin mock** (S0 9 + S1~S6 확장 → 총 17 · **DQ-7 S1에서 `mock-admin-brokerage` 삭제** → 총 16):
  - S0 기초 shape (9종 중 1 삭제): `mock-admin-shortlist`·`mock-admin-reports`·`mock-admin-committee-votes`·`mock-admin-approvals`·`mock-admin-snapshots`·`mock-admin-alerts`·`mock-admin-briefings`·`mock-admin-regen-counters` · ~~`mock-admin-brokerage`~~ (DQ-7 S1 삭제 — credential은 실 Supabase 경로만 사용, mock fixture 불필요)
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
| `0009_dq7_credentials.sql` (DQ-7 S1) | E9 `brokerage_connection` 재설계(`api_key_ref` 폐기 · `ciphertext/iv/auth_tag` × 2 + `mock_mode`) + E12 `exchange_connection` 신설(동일 구조 + `testnet_mode`) + RLS `*_admin_self` 2종 · `0009_dq7_credentials.rollback.sql` 동반 | **파일 생성 완료 · 실 DB 적용은 Session 3 (Vercel 배포 단계)** |

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

### DQ-7 Credential System 신설 (Session 1·2)
**Session 1 (Backend·DB)** — `src/lib/crypto/` + `src/lib/credentials/`:
- `src/lib/crypto/aes.ts` AES-256-GCM encrypt/decrypt + MEK lazy singleton (zero dependency · Node crypto stdlib만)
- `src/lib/credentials/types.ts` — `ActionResult<T>` discriminated union · Brokerage/Exchange Input·Display 인터페이스
- `src/lib/credentials/mask.ts` — `maskKey(prefix 2 + suffix 4)` · `maskAccount`
- `src/lib/credentials/validation.ts` — KIS APP_KEY(36) / APP_SECRET(180) / account_no / Binance API_KEY·SECRET(64) / label(1~40) + `CredentialFormatError`
- `src/lib/credentials/brokerage.ts` — KIS Server Actions (`upsertBrokerageCredential`·`deleteBrokerageCredential`·`listBrokerageCredentials`·`testBrokerageConnection` stub `pending-s8`) · rep guard(ADMIN_REP_EMAIL) · 23505 매핑
- `src/lib/credentials/exchange.ts` — Binance USDT-M 선물 평행 구조 (rep guard는 testnetMode=false 조건)

**Session 2 (Frontend UI)** — `src/components/admin/credentials/` + 2 settings 라우트:
- `src/components/admin/credentials/secret-input.tsx` — 공유 Client (Eye toggle · `autoComplete="new-password"` · maxLength counter · useRef unmount cleanup)
- `src/app/(admin)/admin/settings/brokerage/{page,form,delete-button}.tsx` — KIS UI (Server + Client + Base UI Dialog 2-step)
- `src/app/(admin)/admin/settings/binance/{page,form,delete-button}.tsx` — Binance USDT-M 선물 평행 UI
- `src/app/(admin)/layout.tsx` ADMIN_NAV +2 (`증권사 키`·`거래소 키` · Flat · S8 재편 예정)

**통합 테스트**: 20 cases (`vi.hoisted` Supabase mock). 누적 190 → **248 tests**.

**정리된 레거시**: `types/admin.ts`에서 `BrokerageConnection`·`BrokerageScope` 타입 제거 · `mock-admin-brokerage.ts` 삭제.

**환경변수 (`.env.example`)**: `API_CRED_MASTER_KEY`(32-byte hex MEK) · `ADMIN_REP_EMAIL`(실계좌/메인넷 저장 권한자) 신규 추가. `KIS_*`·`BINANCE_*` env 블록은 주석화(per-admin DB로 영구 이관).

### 레거시 제거 완료 (S0)
- ~~`app/(main)/pricing`~~ · ~~PLANS/PlanKey~~ · ~~SubscriptionTier/UserProfile/reportViewsRemaining~~ · ~~subscription-gate/report-limit-banner~~ · ~~/pricing 링크~~

### 검증 게이트 현재 상태 (DQ-7 Session 2 완료 시점, 2026-04-22)
- `npm run build`: ✅ **24 routes** (TypeScript strict 통과 · DQ-7 S2에서 brokerage·binance +2)
- `npm run lint`: ✅ 0 warnings
- `npm run test:ci`: ✅ **25 files / 248 tests pass** (DQ-7 S1 +5 files · +58 tests; S2는 UI component 테스트 인프라 미도입으로 신규 테스트 없음 · 회귀 0)
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

**어드민 내부 도구 완성 기준** = Mock + 실데이터(S7) + 자동매매 프레임(S8, 주식 KIS + 바이낸스 선물) + 운용 검증(S9) **4조건 AND** → **미달성**. 진행 경로 = HANDOFF.md §6 로드맵.

> **2026-04-21 어휘 정리 (D16)**: 구 "MVP Stage 1 완료" 어휘는 대외 서비스 프레임에서 파생된 것이며 어드민 내부 도구 트랙에는 강제 게이트가 아님. 자세한 재정의는 CLAUDE.md 상단 "⭐ 프로젝트 재정의" 참조.

---

## 체크리스트 (변화 시 갱신)

### Mock Skeleton (완료) + DQ-7 구현 2/4
- [x] TypeScript 파일 수 증감 (S0: 70 → S6: ~145 → DQ-7 S2: ~152)
- [x] 라우트 추가 (S0 17 → S6 22 → DQ-7 S2 24)
- [x] Supabase `.env.local` 세팅 (S0 완료 · DQ-5 anon key 갱신 해소 2026-04-21)
- [x] 마이그레이션 0001~0008 적용 + **0009 파일 생성 (실 DB 적용 Session 3 예정)**
- [x] Vitest 테스트 인프라 (190 → **248 tests pass** · DQ-7 S1 +58)
- [x] 레거시 코드 제거 (S0 완료 + DQ-7 S1에서 `BrokerageConnection`·`mock-admin-brokerage` 추가 제거)

### 실데이터 전환 (S7, 미착수)
- [ ] **Anthropic API 키 확보** (BL-KRIT-1) — DQ-2/DQ-7 선결
- [ ] **KIS API 계정 발급** (BL-KRIT-2) — DQ-7 선결
- [ ] **Naver News API 키** (BL-KRIT-3) — DQ-7 선결
- [ ] **Resend 계정 + 도메인 인증** (BL-KRIT-4) — DQ-7 선결
- [ ] **Telegram Bot** (BL-KRIT-5) — DQ-7 선결
- [ ] **Supabase anon key 갱신** (BL-KRIT-6) — DQ-5 선결
- [ ] **마이그레이션 0010** alert_event CHECK 확장 (BL-KRIT-7 · 2026-04-22 재배정: DQ-7이 0009 선점)
- [ ] **마이그레이션 0009** DQ-7 credential (E9 확장 + E12 신설 + RLS, spec 확정, 구현 대기)
- [ ] Supabase 실 SELECT/INSERT 전환 (S7e · 8 Must)
- [ ] Anthropic wrapper + cost_log 실 INSERT (S7a · M17·M2·M3·M6·M9·M10·M11·M12)
- [ ] 뉴스·브리핑 실 연결 (S7b · M10·M11·M12)
- [ ] 장중·Exit 실 연결 (S7c · M13·M15)
- [ ] Silent Health 실 INSERT + override UI (S7d · M18·M19)

### 운용 검증 (미착수)
- [ ] Vercel 프로젝트 생성 + 환경변수 세팅 (DQ-7 **Session 3 · 사용자 주도** · 최소 env 7개: Supabase 3 + ADMIN_EMAILS + ADMIN_REP_EMAIL + API_CRED_MASTER_KEY + CRON_SECRET)
- [ ] origin push (DQ-6 해소 2026-04-20 · 현재 DQ-7 S1·S2 + cleanup 등 여러 commits ahead, Session 3 직전 push 권장)
- [ ] Cron 4건 실 실행 검증
- [ ] 어드민 1개월+ 운용 검증

### 법무 (⏸ Deferred-D 멤버 오픈 시점까지 유예 · 2026-04-20)
- [⏸] Q16 법무 자문 — 어드민 3명 내부 운용만이므로 현 단계에서 불필요
- [⏸] Q17 이용약관·개인정보처리방침 — Footer 면책 문구 유지, 멤버 오픈 시 `/legal/*` 라우트 신설

### 유저
- [ ] 어드민 3명 allowlist 실 로그인 (Supabase anon 블로커)
- [ ] 멤버 초대 500cap (Deferred-D)
