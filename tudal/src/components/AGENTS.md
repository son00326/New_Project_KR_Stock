<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-17 | Updated: 2026-04-17 -->

# components — React Components

## Purpose
도메인별로 분할된 React 컴포넌트. `ui/`는 shadcn base-nova primitive, `layout/`·`macro/`·`stock/`은 기능 도메인. `common/`은 범용 UI 유틸(S0 legacy 제거 후 현재 빈 디렉토리 — 재검토 대기).

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `ui/` | shadcn base-nova primitive — 12종 (avatar·badge·button·card·dialog·dropdown-menu·input·label·separator·sheet·sonner·tabs) |
| `layout/` | Header·Footer·JoopickLogo |
| `macro/` | 매크로 대시보드 (EventCalendar·FearGreedGauge·IndicatorCard·MacroDashboard·VerdictPanel) |
| `stock/` | 종목 분석 (StockHeader·StockTabs·StockSearch + 4 tabs) + `charts/` 하위 20여 종 |
| `stock/charts/` | Recharts 기반 재무·주가·거버넌스 차트 20여 종 |
| `common/` | 범용 UI 유틸 (현재 legacy 제거 후 비어있음 — 재검토 대기) |

## For AI Agents

### Component Conventions
- **kebab-case 파일** + **PascalCase export**: `stock-header.tsx` → `export function StockHeader()`.
- **Props interface**는 컴포넌트 바로 위에 정의 (파일당 단일 interface). 여러 곳에서 재사용하는 타입만 `@/types/`로 이동.
- **`"use client"` 최소화**: 기본값은 Server Component. 이벤트 핸들러·`useState`·브라우저 API 필요 시에만 파일 최상단에 선언.
- **조건부 className**: `cn()` 헬퍼 사용 — `import { cn } from "@/lib/utils"`.

### shadcn 커스텀 수준 (S0 T0.6a에서 확정 예정)
- 현재: CSS 변수 override 중심 (`src/app/globals.css`의 `@theme inline`).
- 컴포넌트 내부 JSX 수정은 **의사결정 로그에 기록 후** 진행.

### 아이콘
- **Lucide React 단독 사용** (`lucide-react`). 다른 아이콘 라이브러리 추가 금지 — 필요 시 사용자 확인.

### 차트 (`stock/charts/`)
- **Recharts 단독**. `<ResponsiveContainer>`로 감싸서 반응형 처리.
- 색상은 `var(--chart-1)` ~ `var(--chart-5)` 사용 (`globals.css` 정의).

### [G-2] 컴포넌트 3상태
데이터 페치에 의존하는 컴포넌트는 반드시 **loading / error / empty** 3상태 처리:
```tsx
if (isLoading) return <Skeleton />;
if (error) return <ErrorState onRetry={...} />;
if (!data?.length) return <EmptyState />;
return <ActualUI data={data} />;
```

## Dependencies
### Internal
- `@/lib/utils` — `cn()` className merger
- `@/types/*` — 도메인 타입
- `@/lib/constants` — 브랜드·formatter

### External
- `lucide-react` — 아이콘
- `recharts` — 차트
- `@base-ui/react` · `class-variance-authority` · `clsx` · `tailwind-merge` — shadcn 기반
- `next-themes` · `sonner` · `tw-animate-css` — UX 보조

<!-- MANUAL: -->
