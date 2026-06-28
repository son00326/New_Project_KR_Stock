# B-4 디자인 D2~D4 결합 + freeze — 신규 화면 design QA/polish (S9 직전)

> **⚠️ SUPERSEDED (2026-06-28, D34): 본 문서의 "풀 리디자인 아님" 범위를 USER가 전면 리디자인으로 확장.** 토스 스타일 전체 리디자인이 단일 세션에 실행됨 — 전 화면·전 컴포넌트·전 상태 통일 + 다크모드 실 배선. 본 freeze 체크리스트(신규 화면 consistency)는 그 부분집합으로 흡수됨. 신 SoT = `docs/superpowers/specs/2026-06-28-toss-design-system.md` + `ServicePlan-Admin.md §1A.1/D34`. 라이브 `/gstack-design-review`(populated+auth)만 S9 직전 USER 단계로 잔존.

- Date: 2026-06-28
- Branch: `tier0-bpp-multiregime`
- SoT 선행: `ServicePlan-Admin.md §1A.1 디자인 방향 · §1A.5 D29` · HANDOFF "Toss-D0~D4 디자인 lane"
- 범위: **풀 리디자인 아님** — 본 세션 신규/변경 화면의 final-style QA + polish + 회귀 차단(D4 freeze 준비).

## 0. 대상 신규/변경 화면 (본 세션 A/B 산출)
- `/admin/sector-comparison` (B-1) — 2-col 비교 + 빈 상태 + 가드 카피.
- `/admin/funnel-reflection` (B-2/G1) — 제안 목록 + diff + 승인/거절 + 빈 상태.
- `/admin/portfolio` RiskDebateAdvisory 배너 (B-3/G3) — advisory verdict.
- `/admin/settings/health` M19 하트비트 카드 (A-2) — 상태/카운트.
- `(admin)/layout.tsx` unread 알림 배지 (A-1) — 헤더·사이드바 + nav 2종 추가.
- `/admin/alerts/[id]` Exit 상세 (A-1) — 기존 렌더(변경 최소).

## 1. 디자인 consistency 감사 결과 (designer's-eye, code-level) — ✅ PASS
- **토큰 정합**: 신규 화면 전부 admin 디자인 시스템 토큰 재사용 — `rounded-lg/md`·`border`·`bg-card`·
  `text-muted-foreground`·`var(--color-market-up/down)`·`bg-muted/*`. raw hex 0(배지 `var(--…,#fallback)` 1건만, 토큰 우선).
- **타이포 위계**: 페이지 제목 `text-2xl font-semibold` 통일(health/track-record 패턴 일치). 섹션 `text-sm font-semibold`.
- **다크모드**: yellow/경고 블록 `dark:` variant 동반(sector-comparison 3·funnel-reflection 3·health 카드).
- **a11y**: `aria-label`/`role="status"` 경고·상태 영역 부착(권한 미확인 배너·advisory 배너·badge).
- **면책 Footer**: `(admin)/layout.tsx` 고정 Footer가 전 신규 화면에 상속(BusinessPlan §7 — "투자 자문 아님").
- **빈 상태**: 모든 dormant 화면(섹터 비교·Reflection Lab·risk advisory)이 명시 빈-상태 안내(데이터 부재 = 활성화 안내). AI slop/placeholder lorem 0.
- **가드 카피 위계**: 위험성 카피(자동 적용 금지·hard-gate 금지·advisory 비차단)는 yellow 경고 블록으로 시각 분리.

→ **신규 화면은 admin chrome와 정합 — D4 freeze 차단 이슈 0(code-level).** 코드 변경 불요(consistency clean).

## 2. 회귀 차단
- `layout-nav-invariant.test.ts`에 nav 노출 invariant(섹터 비교·Reflection Lab·알림 채널·unread badge) 박제 → 라우트 누락 회귀 차단.
- 신규 컴포넌트는 additive(기존 페이지 mutation 최소: portfolio는 advisory 배너 1줄 additive, Accept 동작 무변경).

## 3. 라이브 브라우저 review (D4 final freeze) = S9-direct USER step
- 본 세션 신규 화면은 **dormant/empty-state**(0046/0047/0048 미적용 + 데이터 부재) → 라이브 `/gstack-design-review`
  (dev server + 브라우저 + populated data)는 **S9 직전**(데이터 적재 후) 수행이 정확. code-level consistency는 위 §1로 freeze-ready.
- D4 freeze 진입 조건: USER가 마이그 apply + flag on + 데이터 적재 → populated 화면에 `/gstack-design-review` 1회 + polish.

## 4. 체크리스트 (freeze-ready 확인)
- [x] 신규 화면 토큰 정합(raw hex 0, 다크모드 동반).
- [x] 타이포 위계 통일(h1 text-2xl font-semibold).
- [x] a11y aria/role 부착 + 면책 Footer 상속.
- [x] 빈 상태 명시(dormant 화면) + AI slop 0.
- [x] nav invariant 회귀 테스트.
- [x] 가드 카피 시각 분리(경고 블록).
- [ ] (S9-direct) 라이브 `/gstack-design-review` populated 화면 1회 + polish — USER/browser.
