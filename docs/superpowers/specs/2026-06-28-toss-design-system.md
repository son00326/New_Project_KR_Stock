# 토스(Toss) 스타일 디자인 시스템 — 어드민 내부 도구 전면 리디자인 (D0 정의 + D1~D4 적용)

- Date: 2026-06-28
- Branch: `toss-redesign`
- SoT 선행: `ServicePlan-Admin.md §1A.1 디자인 방향(Toss-D0~D4) · §1A.5 D29` · HANDOFF "Toss-D0~D4 디자인 lane" · `2026-06-28-b4-design-freeze.md`
- 범위: **풀 리디자인** (USER 2026-06-28 명시 — b4-freeze의 "풀 리디자인 아님" 범위를 USER가 확장). 어드민 내부도구 전 화면·전 컴포넌트·전 상태를 토스 디자인 언어로 통일. 기능·동작·라우트·서버액션 **무회귀**(스타일/마크업만).

## 0. 목표 디자인 언어 (토스 원칙)
1. **절제된 여백** — 넉넉한 패딩, 카드는 회색 배경 위에 흰 카드로 floating, 4px 그리드.
2. **명확한 정보 위계** — 큰/굵은 페이지 제목, 명확한 섹션 구분, 약한 보조 텍스트(muted).
3. **부드러운 색/라운드/그림자** — 토스 블루 primary, 큰 라운드(카드 16~20px), 아주 옅은 그림자(ring 대신 soft shadow).
4. **마이크로 모션** — press 시 미세 scale(0.97~0.98), 200ms ease, 부드러운 hover.
5. **큰 탭 타깃** — primary 버튼 48px, 입력 48px, 모바일 친화.
6. **일관 타이포** — Pretendard(토스 계열 한글 오픈폰트), tabular-nums 숫자.
7. **다크모드 + 모바일 우선** — 전 토큰 light/dark 쌍, ≤768 반응형.

## 1. 폰트 (Pretendard, self-host)
- `src/app/fonts/PretendardVariable.woff2` (2.05MB, OFL) → `next/font/local`(variable, `--font-sans`, display swap, fallback `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif`).
- Geist Mono 유지(`--font-mono`) — 숫자/코드 보조.
- **버그 fix**: 기존 globals.css `--font-sans: var(--font-sans)`(self-ref·미정의) → `:root`에 Pretendard 스택 정의 + next/font 변수 연결로 실제 적용.

## 2. 컬러 토큰 (oklch · light / dark)
한국 증시 관례 유지: **빨강=상승 · 파랑=하락**(T0.6a Q3 lock). primary 블루는 market-down 블루와 hue 분리.

| 토큰 | light | dark | 의도 |
|---|---|---|---|
| `--background` | `oklch(0.985 0.002 247)` (#F9FAFB Toss gray-50) | `oklch(0.165 0.008 260)` (#17171C) | 앱 배경(회색) |
| `--card` | `oklch(1 0 0)` (흰색) | `oklch(0.205 0.008 260)` (#1E2128) | floating 카드 |
| `--foreground` | `oklch(0.23 0.013 256)` (#191F28) | `oklch(0.97 0.003 250)` | 본문 |
| `--muted` / `--secondary` / `--accent` | `oklch(0.965 0.004 250)` (#F2F4F6) | `oklch(0.27 0.008 260)` | 보조 면 |
| `--muted-foreground` | `oklch(0.55 0.02 256)` (#6B7684 Toss gray-600) | `oklch(0.7 0.02 256)` | 보조 텍스트 |
| `--border` / `--input` | `oklch(0.925 0.005 256)` (#E5E8EB) | `oklch(1 0 0 / 12%)` | 경계 |
| `--primary` | `oklch(0.62 0.19 256)` (#3182F6 토스 블루) | `oklch(0.68 0.17 256)` | 주요 액션 |
| `--primary-foreground` | `oklch(1 0 0)` | `oklch(0.18 0.01 260)` | primary 위 텍스트 |
| `--ring` | `oklch(0.62 0.19 256)` (primary) | `oklch(0.68 0.17 256)` | 포커스 링 |
| `--destructive` | `oklch(0.6 0.22 18)` | `oklch(0.7 0.19 18)` | 위험 |
| `--market-up` | `oklch(0.62 0.22 18)` (#F04452 토스 레드) | `oklch(0.7 0.19 18)` | 상승(빨강) |
| `--market-down` | `oklch(0.58 0.16 250)` (#3485FA, primary와 살짝 분리) | `oklch(0.68 0.15 250)` | 하락(파랑) |
| `--market-neutral` | `oklch(0.62 0.01 256)` | `oklch(0.6 0.01 256)` | 보합(회색) |
| `--chart-1..5` | 토스 블루/레드/그린/퍼플/앰버 계열 | dark 대응 | 데이터 viz |
| sidebar 토큰 | card/배경 계열로 정합 | dark 대응 | 사이드바 |

## 3. 반경 / 그림자 / 모션
- `--radius: 1rem`(16px). lg=16 / md≈13 / sm≈10 / xl≈22 / 2xl≈29. 카드 rounded-2xl, 버튼/입력 rounded-xl, pill rounded-full.
- 그림자(소프트): `--shadow-toss-sm/md/lg/xl` = 낮은 불투명도 다층(예 `0 1px 2px rgb(0 0 0/0.04), 0 4px 12px rgb(0 0 0/0.04)`). 다크는 더 옅게.
- 모션: `--ease-toss: cubic-bezier(0.25, 0.1, 0.25, 1)`; press `active:scale-[0.98]`, transition 150~250ms.

## 4. 프리미티브 리테마 (12 ui + 3 layout)
- **button**: default h-11(44px)·lg h-12(48px)·sm h-9·xs h-8, rounded-xl, font-semibold, primary 솔리드+soft shadow, `active:scale-[0.98]`. 변형 유지(outline/secondary/ghost/destructive/link).
- **card**: bg-card, rounded-2xl, `shadow-toss-sm`(ring 제거), 패딩 확대(py-5 px-5).
- **badge**: rounded-full pill, h-6, 약간 큰 텍스트, 토큰 색.
- **input/label**: input h-11 rounded-xl text-base, focus ring primary.
- **tabs**: 토스 underline/pill 탭, 큰 탭 타깃.
- **dialog/sheet/dropdown/separator/avatar/sonner**: 토큰 반경/그림자/색 상속, sheet/dialog rounded-2xl.
- **layout/header·footer·logo**: 헤더 흰 배경+옅은 하단 경계, 큰 탭 타깃 nav, 로고 토큰 색.

## 5. 횡단 적용 (전 화면 공통 패턴)
- 페이지 제목 `text-2xl font-bold tracking-tight`, 섹션 제목 `text-base font-semibold`.
- 페이지 컨테이너 여백 통일(p-5 md:p-8, max-w 적정), 카드 간 gap-4~6.
- 숫자/금액 `tabular-nums`(formatKRW/Price/Percent 표기 그대로, 클래스만).
- 빈/에러/로딩 상태 토스풍(아이콘+안내+액션), AI slop/lorem 0.
- Recharts: 70 raw-hex → 토큰(CSS 변수) 매핑(`var(--color-chart-n)`, market 색), 다크모드 grid/axis 색 토큰화.
- a11y: focus-visible 링(primary), 대비 ≥ AA, 탭타깃 ≥ 44px, aria/role 유지.
- 면책 Footer + `<html lang="ko">` 유지(BusinessPlan §7).

## 6. 가드레일 (무회귀)
- 기능/동작/라우트/서버액션/데이터 불변 — 스타일·마크업만.
- 검증 게이트 build/lint/test:ci/tsc ALL GREEN(시각 변경으로 깨진 테스트는 의미 보존 갱신, 삭제/약화 금지).
- 토큰만 사용(raw hex 금지·shadcn 변수 경유), 다크모드 동반.
- USER-only(env/secrets/flag/마이그/billing/외부키) 미접촉.

## 7. 실행 순서
1. **Phase 1 (foundation)**: 폰트 + globals.css 토큰 + 12+3 프리미티브 + 3 chrome 리테마. → 전 화면 자동 상속.
2. **Phase 2 (fan-out)**: 21 라우트 + 57 컴포넌트 화면별 polish + 차트 토큰화 + 상태 커버 (loop-until-dry).
3. **Phase 3**: omxy 적대 리뷰 + Claude 리뷰 루프(§2.0a).
4. **Phase 4**: 브라우저 시각 검증(light/dark/mobile).
5. **Phase 5**: 품질 ≥90 루프 → push → 문서.
