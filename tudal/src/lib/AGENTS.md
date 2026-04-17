<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-17 | Updated: 2026-04-17 -->

# lib — Utilities, Data, Supabase

## Purpose
공용 유틸·mock 데이터·Supabase 클라이언트·사이트 상수. **실데이터 전환은 슬라이스별 단계**에서 수행 (`../../Document/Build/Slices/S?-*.md` 참조).

## Key Files
| File | Description |
|------|-------------|
| `utils.ts` | `cn()` — clsx + tailwind-merge 래퍼. 전 컴포넌트에서 className 조립 시 사용 |
| `constants.ts` | `SITE_NAME`·`SITE_URL`·`formatKRW`·`formatPrice`·`formatPercent`. **`PLANS`는 2026-04 S0에서 제거됨** — subscription 개념 전체 폐기 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `data/` | mock 데이터 소스 (6 파일) — 실데이터 전환 대기 (see `data/AGENTS.md`) |
| `supabase/` | SSR 인증 클라이언트 3종 — client·server·middleware (see `supabase/AGENTS.md`) |

## For AI Agents

### 상수 추가 규칙
- `constants.ts`에 추가 전 **필요성 질문**: 이 값이 한 곳에서만 쓰이면 해당 파일에 지역화.
- **플랜·구독·Tier 관련 상수 절대 추가 금지** — 서비스 정책상 폐기됨 (어드민 3명 + 멤버 500cap 초대 모델).

### KRW formatter
- `formatKRW(value)` — 조·억·만 단위 자동 변환. UI 표시 시 일관 사용.
- `formatPrice(value)` — 단순 원화 표기 (`1,234원`).
- `formatPercent(value)` — 부호 포함 퍼센트 (`+1.23%`).

## Dependencies
### External
- `clsx` · `tailwind-merge` (`utils.ts`)
- `@supabase/ssr` · `@supabase/supabase-js` (`supabase/*`)

<!-- MANUAL: -->
