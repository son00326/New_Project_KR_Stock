// 토스 차트 팔레트 — 디자인 토큰(raw CSS 변수) 기반. 다크모드 자동 대응.
//
// ⚠️ Tailwind v4 `@theme inline`은 `--color-chart-1` 같은 별칭을 *인라인*하므로
//    런타임 CSS 변수로 emit 되지 않는다. Recharts 등 JS/SVG fill·stroke에는
//    :root/.dark 에 실제 정의된 raw 변수(`--chart-1`, `--market-up` …)를 써야 한다.
//    (globals.css :root/.dark 정의 참조)

/** 카테고리형 데이터 viz 팔레트 (7색, 토큰 기반·다크 대응) */
export const CHART_COLORS = [
  "var(--chart-1)", // 토스 블루
  "var(--chart-2)", // 레드
  "var(--chart-3)", // 그린
  "var(--chart-4)", // 퍼플
  "var(--chart-5)", // 앰버
  "var(--market-down)", // 보조 블루
  "var(--market-up)", // 보조 레드
] as const;

/** 인덱스 → 팔레트 색 (순환) */
export function chartColor(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length];
}

/** 한국 증시 관례: 빨강=상승 / 파랑=하락 / 회색=보합 */
export const CHART_UP = "var(--market-up)";
export const CHART_DOWN = "var(--market-down)";
export const CHART_NEUTRAL = "var(--market-neutral)";

/** 브랜드 primary (토스 블루) — 라인/포인트 강조 */
export const CHART_PRIMARY = "var(--primary)";

/** 축·격자·보조 텍스트 (토큰) */
export const CHART_GRID = "var(--border)";
export const CHART_AXIS = "var(--muted-foreground)";
export const CHART_LABEL = "var(--foreground)";
