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

**2026-04-17**: S0 Foundation 완료 반영. 라우트 7 → 17, admin 그룹 신설, Supabase 연결, deepinit 8계층 AGENTS.md 생성.

---

## tudal/ 현재 상태 (2026-04-17 기준)

### 규모
- 총 **~70개** TypeScript 파일 (`src/` 기준, admin 페이지 11 + mock-admin 9 + types/admin + layouts 추가)
- **17개** 라우트:
  - **Main 6**: `/`, `/_not-found`, `/login`, `/signup`, `/macro`, `/stock/[ticker]`
  - **Admin 11**: `/admin`, `/admin/portfolio`, `/admin/alerts`, `/admin/alerts/[id]`, `/admin/track-record`, `/admin/decision-tree`, `/admin/settings`, `/admin/settings/notifications`, `/admin/settings/health` (BL-6), `/admin/report/[ticker]`, `/admin/report/[ticker]/regenerate`

### 기술 스택
- Next.js 16.2.3 + React 19.2.4 + TypeScript strict + Tailwind v4
- UI: shadcn(base-nova) + Lucide + Recharts
- 라우팅: App Router, 라우트 그룹 `(auth)` pass-through / `(main)` Header+Footer / `(admin)` 자체 chrome(로고·사이드바·면책 Footer)
- 인증: Supabase SSR 연결 완료 (`.env.local` 세팅), `/admin/*` ADMIN_EMAILS allowlist 가드 미들웨어
- 브랜딩: '주픽' 리브랜딩 + KIPRIS 검증 완료

### 레이아웃 구조 (2026-04-17 리팩터 후)
- `app/layout.tsx` = 최소 HTML + body (Header·Footer 제거됨)
- `app/(main)/layout.tsx` = 기존 Header + Footer (main 라우트용)
- `app/(auth)/layout.tsx` = pass-through
- `app/(admin)/layout.tsx` = 로고·사이드바(7 nav)·면책 Footer (어드민 chrome)

### 데이터 레이어
- **mock 데이터 기반** (`tudal/src/lib/data/*`)
  - 기존 main: `mock-stocks.ts`, `mock-financials-extended.ts`, `mock-quarterly.ts`, `mock-ohlcv.ts`, `mock-corporate.ts`, `mock-macro.ts`
  - 신규 admin (S0 T0.7): `mock-admin-shortlist.ts`, `mock-admin-reports.ts`, `mock-admin-committee-votes.ts`, `mock-admin-approvals.ts`, `mock-admin-snapshots.ts`, `mock-admin-alerts.ts`, `mock-admin-briefings.ts`, `mock-admin-regen-counters.ts`, `mock-admin-brokerage.ts` (전부 빈 배열, shape 확정)
- 실데이터: 0 (KRX·한투·DART·pykrx 미연결, 슬라이스별 실데이터 연결 단계 대기)
- **Supabase 연결 완료** (`.env.local`: URL·anon·service_role·ADMIN_EMAILS 3명)
  - 프로젝트: `fpriyjykihxhhvqudvdb`
  - RLS sketch: `tudal/supabase/migrations/0001_rls_sketch.sql` (9 엔티티 admin-only + `is_admin()` 헬퍼, 미실행)
- 유저: 0

### 타입 정의
- 기존 main: `types/{stock,corporate,macro}.ts`
- 신규 admin (S0 T0.7): `types/admin.ts` (E1~E9 인터페이스 + 공용 enum)

### 문서 레이어 (AGENTS.md 계층)
- 8 AGENTS.md (deepinit S0 T0.8):
  - `tudal/AGENTS.md` (root, G-1·G-2 박제)
  - `src/AGENTS.md` → `src/{app,components,lib,types}/AGENTS.md` → `src/lib/{data,supabase}/AGENTS.md`

### 디자인 토큰 (S0 T0.6b)
- `src/app/globals.css` @theme inline + :root
  - shadcn base-nova 팔레트 유지 (neutral baseColor, 라이트 모드 전용 v1)
  - **한국 증시 관례 추가**: `--market-up` (빨강, 상승), `--market-down` (파랑, 하락), `--market-neutral` (회색)
  - radius 4단계, font geist-sans/mono, chart-1~5

### 레거시 제거 완료 (S0 T0.1)
- ~~`app/(main)/pricing`~~ (route deleted)
- ~~`constants.ts PLANS·PlanKey`~~ (removed)
- ~~`types/stock.ts SubscriptionTier·UserProfile·reportViewsRemaining`~~ (removed)
- ~~`components/common/{subscription-gate,report-limit-banner}.tsx`~~ (deleted)
- ~~`layout/{header,footer}.tsx`의 `/pricing` 링크 3곳~~ (removed)

### 검증 게이트 현재 상태
- `npm run build`: ✅ 17 routes 정상 컴파일 (1.9s, TypeScript 통과)
- `npm run lint`: ✅ 0 problems (baseline 46 → 0, S0 T0.11 cleanup)
- `npm run dev`: ⚠️ macOS EMFILE 이슈 — `ulimit -n 65535` 후 정상 (코드 무관)
- 테스트 프레임워크: 없음 (build + lint이 검증 게이트)

---

## 시스템·백테스트 현황

### 자동화 백테스트 v6.1 FINAL (2026-04-12 확정)
- 파일: `backtest/full_system_backtest_v6.py`
- 성과: CAGR 20.3% · Sharpe 0.99 · Calmar 0.78 · Max DD -25.8%
- 벤치마크: 삼성전자 B&H 위험조정 beat
- 구성: 3축 분화 + Early Warning + 부분 리밸런싱

---

## 체크리스트 (변화 시 갱신)

- [x] TypeScript 파일 수 증감 (S0: +20 개 추가 반영)
- [x] 라우트 추가/제거 (S0: admin 11 + root layout 리팩터)
- [ ] mock → 실데이터 전환 (슬라이스별, S1 이후)
- [x] Supabase `.env.local` 세팅 여부 (S0 T0.2 완료)
- [ ] 유저 수 (Alpha/Beta 단계 기준 — S6 이후)
- [x] 레거시 코드 제거 완료 여부 (S0 T0.1 완료)
