<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-17 | Updated: 2026-04-24 -->

# app — Next.js 16 App Router

## Purpose
App Router 기반 라우트 트리. 최상위 `layout.tsx`는 최소 HTML, Geist 폰트, `lang="ko"`만 담당한다. 실제 chrome은 라우트 그룹별 layout에서 분리한다: `(auth)` / `(main)` / `(admin)`.

## Key Files
| File | Description |
|------|-------------|
| `layout.tsx` | Root layout — Geist Sans/Mono 로드, 최소 HTML/body, metadata 정의 |
| `page.tsx` | 랜딩 페이지 (`/`) |
| `not-found.tsx` | 전역 404 |
| `globals.css` | Tailwind v4 진입 + `@theme inline` 블록 + shadcn base-nova CSS 변수 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `(auth)/` | 로그인·회원가입 — 독립 layout (Header·Footer 없음) |
| `(main)/` | 매크로·종목 분석 — Header + Footer chrome |
| `(admin)/` | 어드민 전용 IA — 자체 header/sidebar/footer chrome |
| `api/cron/` | Vercel Cron route handlers |
| `auth/callback/` | Supabase Magic Link callback |

## For AI Agents

### Route Group 규칙
- 괄호 디렉토리 `(auth)`·`(main)`·`(admin)`은 **URL에 노출되지 않음**.
- 각 그룹은 독립 `layout.tsx`를 가질 수 있음. `(auth)`는 Header·Footer가 제거된 최소 레이아웃.
- `/admin` 보호의 1차 강제 지점은 `src/lib/supabase/middleware.ts`의 Supabase 세션 갱신 + `ADMIN_EMAILS` allowlist 검증이다.
- 어드민 Server Action을 실데이터로 전환할 때는 미들웨어만 믿지 말고 서버 측 admin assertion을 추가한다.

### Dynamic Route Params (Next.js 16 주의)
- 동적 라우트 params는 **Promise 타입**: `{ params }: { params: Promise<{ ticker: string }> }` → `await params` 필수. 학습 데이터의 sync params와 **다름**.

### generateMetadata
- 반환 타입 `Promise<Metadata>` 명시 (Next.js 16 lint 규칙 `71008`).

### [G-2] 에러·로딩 Boundary
- 각 라우트 세그먼트(또는 그룹 루트)에 `error.tsx`·`loading.tsx` 배치.
- `error.tsx`는 **`"use client"` + `reset()` 콜백 UI** 포함.

## Dependencies
### Internal
- `@/components/layout/{header,footer}` — `(main)/layout.tsx`에서 사용
- `@/lib/supabase/server` — Server Component 인증 조회 시 사용

### External
- `next@16` · `next/navigation` (`notFound`, `redirect`) · `next/headers` (`cookies`)

<!-- MANUAL: -->
