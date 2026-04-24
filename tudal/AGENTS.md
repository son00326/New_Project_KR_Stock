<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- Generated: 2026-04-17 | Updated: 2026-04-17 -->

# tudal — 주픽(JooPick) Next.js App

## Purpose
주픽 어드민·멤버 주식 분석 서비스의 Next.js 16 애플리케이션. 폴더명 `tudal/`는 리브랜드 전 잔재 (내부 `package.json name`은 `joopick`). **디렉토리 이름을 변경하지 말 것** — 상위 `Document/`의 모든 문서가 이 경로를 참조한다.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | `joopick@0.1.0` · Next.js 16.2.3 · React 19.2.4 · @supabase/ssr · Tailwind v4 |
| `tsconfig.json` | strict mode · `@/* → ./src/*` path alias · ES2017 target · jsx react-jsx |
| `eslint.config.mjs` | eslint-config-next flat config (core-web-vitals + typescript) |
| `next.config.ts` | 기본 설정 (현재 override 없음) |
| `middleware.ts` | Supabase session refresh — `_next/*`·정적 자원 외 모든 요청에 적용 |
| `components.json` | shadcn config — `base-nova` style · `neutral` baseColor · `rsc: true` |
| `postcss.config.mjs` | Tailwind v4 PostCSS 플러그인 |
| `vitest.config.ts` | Vitest 설정 (S3 도입, G-10=b) · node 환경 · `src/**/__tests__/**/*.test.ts` · passWithNoTests · native tsconfigPaths |
| `.env.local` | Supabase URL·키 + `ADMIN_EMAILS` (S0 Foundation에서 세팅, git 무시) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/` | 애플리케이션 소스 (see `src/AGENTS.md`) |
| `public/` | 정적 자원 (이미지·아이콘) |

## Commands (이 디렉토리에서 실행)
```bash
npm run dev     # next dev (Turbopack)
npm run build   # next build — 검증 게이트 1순위
npm run start   # next start
npm run lint    # eslint (eslint-config-next flat config)
npm run test:ci # vitest run (S3 도입) — pure 로직 유닛 테스트
npm run test    # vitest watch 모드 (개발용)
```
검증 게이트 = `build` + `lint` + `test:ci` (3종). Vitest는 S3 G-10 옵션 b로 도입 — race condition·영업일·D15 게이팅·이의 제기 등 순수 로직만 커버. 컴포넌트·E2E 추가는 사용자 확인 후에만.

## For AI Agents

### Core Conventions
- **언어**: 모든 UI 텍스트 한국어 (`<html lang="ko">`). 코드·식별자는 영어.
- **Path alias**: `@/components/...`, `@/lib/...`, `@/types/...` 강제. 상대경로 `../../`로 src 간 참조 금지.
- **Route groups**: `src/app/(auth)/` · `src/app/(main)/` · `src/app/(admin)/` — 괄호 디렉토리는 URL에 노출 안 됨.
- **Brand strings**: `src/lib/constants.ts`의 `SITE_NAME`·`SITE_URL`·KRW formatter만 import (PLANS·tier류는 2026-04 S0에서 전면 폐기).

### [G-1] 상태 관리 방침 (3줄)
1. **Server Components 우선** — 기본값. 데이터 조회·렌더는 Server에서 처리.
2. **클라이언트 상태 = `useState` · `useReducer`** — 단일 컴포넌트 또는 밀접한 서브트리.
3. **공유 상태 = React Context** — 라이브러리(zustand·jotai·redux) 추가 불필요. 필요 시 사용자 확인 후에만.

### [G-2] 에러·로딩 패턴
- **글로벌 Boundary**: 각 라우트 그룹 루트(또는 필요한 세그먼트)에 `error.tsx`·`loading.tsx` 배치. App Router 기본 제공.
- **컴포넌트 레벨 3상태**: 데이터 의존 컴포넌트는 `loading` / `error` / `empty`를 **명시적으로 분기**. 스켈레톤·재시도 UI·빈 상태 메시지 필수.
- **Server Action 반환 규약**: `{ success: true, data }` 또는 `{ success: false, error: string }`. 클라이언트는 `success` 플래그로 분기.

### Working In This Directory
- **Next.js 16 breaking changes 위험**: 라우팅·미들웨어·서버 액션·메타데이터·`next/*` import를 쓸 때 **반드시** `node_modules/next/dist/docs/` 또는 `context7` MCP 조회 후 작성.
- **법적 제약** (`../Document/Business/BusinessPlan.md` §7):
  1. 어드민 내부 도구에서는 AI가 Short List·비중·자동매매 판단까지 처리할 수 있다.
  2. 멤버-facing Deferred-D 재개 시에만 매수/매도 직접 추천 표현을 다시 금지한다.
  3. 500명 cap + 초대 전용은 Deferred-D 멤버 트랙에만 적용한다. 공개 가입 퍼널은 만들지 않는다.
  4. 면책 Footer 고정 — "정보 제공, 투자 자문 아님" 문구 유지.

### Testing Requirements
- 변경 후 `npm run build` + `npm run lint` + `npm run test:ci` 3 게이트 통과 필수.
- pure 로직 추가 시 `src/lib/**/__tests__/*.test.ts`에 Vitest 단위 테스트 동반 (S3 기준 패턴).
- UI 변경 시 `npm run dev`로 브라우저 육안 확인 (각 슬라이스 DoD에 명시).

## Dependencies
### Internal
- `../Document/Service/Planning/ServicePlan-Admin.md` — 어드민 서비스 기획 SoT
- `../Document/Build/Slices/S?-*.md` — 현재 작업 슬라이스 SoT
- `../Document/Process/ExecutionPlaybook.md` — 슬라이스 기반 개발 방법론

### External
- `next@16.2.3` · `react@19.2.4` — 메이저 버전 고정
- `@supabase/ssr@^0.10` · `@supabase/supabase-js@^2.103` — 인증·DB
- `tailwindcss@^4` · `tw-animate-css` · `shadcn` — 스타일
- `recharts@^3` — 차트
- `lucide-react@^1.8` — 아이콘 (단독)

<!-- MANUAL: 수동 주석은 이 라인 아래에 추가하면 재생성 시 보존됨 -->
