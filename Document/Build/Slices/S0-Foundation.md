# S0 Foundation

> originally architect ID: S0 (`.omc/research/must-19-slice-mapping.md` §5 S0 블록)

---

```
slice_id: S0
slice_name: Foundation
architect_id: S0
status: ⚪ 대기
expected_sessions: 2
current_progress: 0%
```

---

## 목표 (Why)

모든 후속 슬라이스가 의존하는 인프라 토대를 구축한다. Supabase 연결·admin role 가드·디자인 토큰·legacy 제거가 없으면 S1 이후 모든 슬라이스의 인증·RLS·UI가 막힌다. 이 슬라이스가 완료되어야 비로소 기능 개발이 시작된다.

---

## 포함 요구사항

- **Must**: 없음 (선행 인프라 — 모든 Must의 전제 조건)
- **엔티티**: 없음 (스키마 초안 prepare만 — 실 마이그레이션은 각 슬라이스에서)
- **라우트**:
  - `app/(admin)/layout.tsx` 신규 생성 (admin 라우트 그룹)
  - `app/(main)/pricing` legacy 제거 (CLAUDE.md "Pricing scaffolding is legacy")
  - `middleware.ts` admin role 가드 확장
- **신규 엔티티**: 없음 (스키마 파일 stub만 준비)

---

## 선행 조건

- 없음 (최초 슬라이스)
- **단, BL-1·BL-2·BL-6 사용자 결정이 선행되어야 착수 가능**

---

## 외부 의존

| 의존 대상 | 용도 | 슬라이스 내 처리 |
|---|---|---|
| Supabase (프로젝트 키) | SSR 세션·RLS | `.env.local` 세팅 (BL-1 해소 후) |
| Next.js 16 middleware | admin role 가드 | `middleware.ts` 확장 |

---

## Tasks (체크리스트)

- [ ] **T0.1** `app/(main)/pricing` legacy 제거 — `PLANS` 상수·라우트·컴포넌트 삭제, `constants.ts` 정리
- [ ] **T0.2** Supabase env 세팅 — `.env.local` 템플릿 작성 + `lib/supabase/` SSR 클라이언트 확인
- [ ] **T0.3** admin role 가드 미들웨어 — `middleware.ts`에 `/admin/*` 경로 role check 추가. BL-2 결정(email allowlist vs role claim) 반영
- [ ] **T0.4** Supabase RLS 정책 sketch — E1~E9 테이블용 admin-only RW 정책 SQL 초안 파일 작성 (`tudal/supabase/migrations/0001_rls_sketch.sql`)
- [ ] **T0.5** `app/(admin)/layout.tsx` 생성 — Header stub + Footer(면책 문구 고정) + admin nav 뼈대
- [ ] **T0.6** 디자인 토큰 seed — `globals.css` CSS 변수(색·타이포·spacing) 초안, `ServicePlan.md §3` base-nova 기반
- [ ] **T0.7** mock data 파일 구조 확정 — `tudal/src/lib/data/mock-*.ts` 파일 목록 및 export shape 합의 (실 데이터는 각 슬라이스에서 채움)
- [ ] **T0.8** `deepinit` 구현 하네스 1회 실행 — repo 컨벤션·타입·import alias 박제 (`oh-my-claudecode:deepinit`)

> **Tasks 세분화**: 킥오프 세션에서 추가 분해. 위는 핵심 작업 묶음 수준.

---

## DoD (Definition of Done)

- [ ] `app/(main)/pricing` 라우트 접근 시 404 반환 (또는 리다이렉트)
- [ ] `constants.ts`에서 `PLANS` 관련 코드 0건
- [ ] `/admin` 경로: 비인증 접근 시 `/login`으로 리다이렉트
- [ ] `/admin` 경로: admin role 없는 인증 유저 접근 시 403/리다이렉트
- [ ] `app/(admin)/layout.tsx` 존재 + 면책 Footer 문구 포함
- [ ] `globals.css` CSS 변수 정의됨 (최소 color palette, font-size scale)
- [ ] `mock-*.ts` 파일 구조 확정 (빈 배열이라도 export shape 존재)
- [ ] `npm run build` 오류 0
- [ ] `npm run lint` 경고 0
- [ ] 커밋: `feat(S0): foundation — legacy 제거·Supabase 가드·디자인 토큰·mock 구조`

---

## 블로커 / 사용자 결정 필요

- **BL-1** (High — S0 착수 전 필수): Supabase 프로젝트 키·URL·Anon Key 세팅 (S0 Foundation 인프라 단계) — ProgressDashboard §5 참조
- **BL-2** (High — S0 착수 전 필수): admin role 정의 방식 결정 — email allowlist (`ADMIN_EMAILS` env) vs Supabase user_metadata role claim 중 택 1
- **BL-6** (High — S0 착수 후 S5 진입 전까지 확정 필수. S0 시점엔 권장): `/admin/health` 라우트를 IA 11번째 독립 라우트로 승격할지 vs `/admin/settings/health` 서브라우트로 편입할지 결정 (S5 진입 전 IA 재협상 방지)

---

## 리스크

- **R-C** (architect): Supabase env + admin role 가드 미들웨어 누락 시 모든 후속 슬라이스의 인증·RLS 차단. T0.2·T0.3을 S0 1세션 내 완료 강제.

---

## 의사결정 로그

- 2026-04-16: 슬라이스 파일 생성. BL-1·BL-2 해소 후 착수 예정.

---

## 이슈·발견

- (없음)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S0 블록 기반. deepinit 하네스 T0.8에 포함. |
