<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-17 | Updated: 2026-04-17 -->

# app — Next.js 16 App Router

## Purpose
App Router 기반 라우트 트리. 최상위 `layout.tsx`가 Header·Footer + Geist 폰트 + `lang="ko"`를 적용. 두 개 라우트 그룹(`(auth)` / `(main)`)으로 분리되며, S0 Foundation에서 `(admin)` 그룹이 추가된다.

## Key Files
| File | Description |
|------|-------------|
| `layout.tsx` | Root layout — Geist Sans/Mono 로드, Header·Footer 포함, metadata 정의 |
| `page.tsx` | 랜딩 페이지 (`/`) |
| `not-found.tsx` | 전역 404 |
| `globals.css` | Tailwind v4 진입 + `@theme inline` 블록 + shadcn base-nova CSS 변수 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `(auth)/` | 로그인·회원가입 — 독립 layout (Header·Footer 없음) |
| `(main)/` | 매크로·종목 분석 — Root layout 상속 |
| `(admin)/` | **S0에서 추가 예정** — 어드민 전용 IA (10 라우트) + role 가드 필수 |

## For AI Agents

### Route Group 규칙
- 괄호 디렉토리 `(auth)`·`(main)`·`(admin)`은 **URL에 노출되지 않음**.
- 각 그룹은 독립 `layout.tsx`를 가질 수 있음. `(auth)`는 Header·Footer가 제거된 최소 레이아웃.
- 어드민 그룹은 `src/app/(admin)/layout.tsx`에서 **서버 렌더 시점에 Supabase 세션 + `ADMIN_EMAILS` allowlist 검증**. 우회 경로가 없도록 중복 방어(미들웨어 + layout + Server Action) 권장.

### Dynamic Route Params (Next.js 16 주의)
- 동적 라우트 params는 **Promise 타입**: `{ params }: { params: Promise<{ ticker: string }> }` → `await params` 필수. 학습 데이터의 sync params와 **다름**.

### generateMetadata
- 반환 타입 `Promise<Metadata>` 명시 (Next.js 16 lint 규칙 `71008`).

### [G-2] 에러·로딩 Boundary
- 각 라우트 세그먼트(또는 그룹 루트)에 `error.tsx`·`loading.tsx` 배치.
- `error.tsx`는 **`"use client"` + `reset()` 콜백 UI** 포함.

## Dependencies
### Internal
- `@/components/layout/{header,footer}` — Root layout에서 사용
- `@/lib/supabase/server` — Server Component 인증 조회 시 사용

### External
- `next@16` · `next/navigation` (`notFound`, `redirect`) · `next/headers` (`cookies`)

<!-- MANUAL: -->
