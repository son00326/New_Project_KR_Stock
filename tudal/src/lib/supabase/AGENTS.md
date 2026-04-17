<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-17 | Updated: 2026-04-17 -->

# supabase — SSR Auth Clients

## Purpose
`@supabase/ssr` 기반 3중 클라이언트. **반드시 컨텍스트에 맞는 파일에서 import** — Server Component는 `server.ts`, Client Component는 `client.ts`, 미들웨어는 `middleware.ts`. 혼용 시 쿠키 주입·세션 갱신이 깨진다.

## Key Files
| File | Description |
|------|-------------|
| `client.ts` | `createBrowserClient` — `"use client"` 컴포넌트에서만 사용 |
| `server.ts` | `createClient()` — `next/headers`의 `cookies()` 사용. Server Component·Server Action·Route Handler 전용 |
| `middleware.ts` | `updateSession(request)` — 매 요청마다 세션 쿠키 갱신 + (옵션) 보호 경로 리다이렉트 |

## For AI Agents

### Env 변수 (S0 T0.2 `.env.local` 세팅)
- `NEXT_PUBLIC_SUPABASE_URL` — 클라이언트 노출 OK
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — 클라이언트 노출 OK (RLS 전제)
- `SUPABASE_SERVICE_ROLE_KEY` — **서버 전용. 절대 `NEXT_PUBLIC_` prefix 금지**
- `ADMIN_EMAILS` — 쉼표 구분 email allowlist (BL-2 해소 방식)

### 보호 경로 패턴 (S0 T0.3 `middleware.ts` 확장)
`middleware.ts`의 `updateSession` 내부 보호 경로 목록에 `/admin`을 추가하고, **`ADMIN_EMAILS` 포함 여부 검증** 로직을 삽입. 비인증 → `/login` 리다이렉트, 비-admin 유저 → `/` 리다이렉트 또는 403.

### 쿠키 규칙 (Next.js 16 주의)
- `cookieStore.set`이 Server Component에서 호출되면 에러 → `try/catch`로 감싼 **현재 패턴을 유지**.
- Session refresh는 **`middleware.ts`의 `updateSession` 단일 경로**로만 수행 — 다른 곳에서 직접 `setAll` 호출 금지.

### SDK Docs
- API 변경 잦음 → 코드 수정 전 **`context7` MCP로 `@supabase/ssr` 최신 문서 조회 필수** (특히 Next.js 16 호환성).

## Dependencies
### External
- `@supabase/ssr@^0.10.2`
- `@supabase/supabase-js@^2.103.0`
- `next/server` · `next/headers`

<!-- MANUAL: -->
