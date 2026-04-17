<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-17 | Updated: 2026-04-17 -->

# src — Application Source

## Purpose
주픽 Next.js 애플리케이션의 모든 소스 코드. 4개 도메인으로 분할 — 라우트(`app/`)·UI(`components/`)·유틸·데이터(`lib/`)·공유 타입(`types/`).

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `app/` | App Router 라우트·layout·page (see `app/AGENTS.md`) |
| `components/` | React 컴포넌트 (see `components/AGENTS.md`) |
| `lib/` | Supabase·mock 데이터·상수·유틸 (see `lib/AGENTS.md`) |
| `types/` | 도메인 TypeScript 타입 (see `types/AGENTS.md`) |

## For AI Agents

### Import Convention
- **항상 path alias `@/*` 사용** — `@/components/...`, `@/lib/...`, `@/types/...`
- 상대경로 `../../`로 `src/` 간 참조 금지. 같은 디렉토리 내 `./sibling`만 허용.

### File Naming
- 컴포넌트 파일: **kebab-case.tsx** (`stock-header.tsx`, `macro-dashboard.tsx`)
- 유틸·데이터 파일: **kebab-case.ts** (`mock-stocks.ts`, `constants.ts`)
- 라우트 파일: **page.tsx·layout.tsx·loading.tsx·error.tsx·not-found.tsx** (Next.js 강제)
- React 컴포넌트 심볼: **PascalCase** named export (`export function StockHeader()`)

### TypeScript
- strict mode ON. `any` 사용 금지 — 필수 시 사용자 확인 후 `unknown` 권장.
- Props interface는 컴포넌트 바로 위에 정의 (`interface XxxProps {}`).
- type-only import에 `import type` 사용: `import type { Stock } from "@/types/stock"`.

## Dependencies
### External
- React 19 · Next.js 16 (App Router)
- TypeScript 5 · Tailwind v4

<!-- MANUAL: -->
