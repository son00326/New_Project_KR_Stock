import type { MacroIndicator, MarketVerdict } from "@/types/macro";

// ---------------------------------------------------------------------------
// G4 — 거시/뉴스 → AI 컨텍스트 레이어 (core, pure distill)
// SoT: docs/superpowers/specs/2026-06-26-g4-macro-news-ai-context-layer-design.md §3.1
// D33 §4: 거시 regime을 Tier1 평가/리포트/브리핑의 "컨텍스트 입력"으로만 distill 한다.
//
// ⚠️ 가드레일 (코드 불변식):
//   1. 이 모듈은 Tier0 스크리닝(screen_shortlist_tier0.py)에서 import 금지 — 산출물은
//      numeric factor가 아니라 "문자열 컨텍스트"다. funnel 가중치로 쓰지 않는다.
//   2. M12a(per-ticker 뉴스 자동제외)와 범주 분리 — 별도 출력 타입.
//   3. forward-validate — renderMacroContextString은 "예측 아님" 면책을 포함한다.
//   4. pure — env/now/IO 0 (테스트 결정론). flag/staleness/실 source 경계는 source.ts.
// ---------------------------------------------------------------------------

export type MarketRegime = MarketVerdict["overallSignal"];

export interface MacroDriver {
  category: string;
  signal: "bullish" | "bearish" | "neutral";
  reason: string;
}

export interface MacroContext {
  regime: MarketRegime;
  score: number;
  headline: string;
  drivers: MacroDriver[];
  asOf: string;
  source: string;
}

export interface MacroContextSource {
  indicators: MacroIndicator[];
  verdict: MarketVerdict;
  source?: string;
}

// no-op 기본값 — flag off / stale / source 없음일 때 consumer가 현행 동작으로 폴백.
export const EMPTY_MACRO_CONTEXT = "";

const MAX_DRIVERS = 5;
const MAX_HEADLINE_LEN = 160;

const REGIME_LABEL: Record<MarketRegime, string> = {
  strong_bullish: "강한 강세",
  bullish: "강세",
  neutral: "중립",
  bearish: "약세",
  strong_bearish: "강한 약세",
};

const SIGNAL_LABEL: Record<MacroDriver["signal"], string> = {
  bullish: "호재",
  bearish: "악재",
  neutral: "중립",
};

function collapseToSingleLine(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= MAX_HEADLINE_LEN) return oneLine;
  return `${oneLine.slice(0, MAX_HEADLINE_LEN - 1).trimEnd()}…`;
}

function latestAsOf(src: MacroContextSource): string {
  let max = src.verdict.updatedAt;
  let maxMs = Date.parse(src.verdict.updatedAt);
  for (const ind of src.indicators) {
    const ms = Date.parse(ind.updatedAt);
    if (Number.isFinite(ms) && (!Number.isFinite(maxMs) || ms > maxMs)) {
      max = ind.updatedAt;
      maxMs = ms;
    }
  }
  return max;
}

/**
 * 거시 source(지표 + 종합 판단) → 컴팩트 MacroContext. pure, ₩0.
 */
export function buildMacroContext(src: MacroContextSource): MacroContext {
  return {
    regime: src.verdict.overallSignal,
    score: src.verdict.score,
    headline: collapseToSingleLine(src.verdict.summary),
    drivers: src.verdict.details.slice(0, MAX_DRIVERS).map((d) => ({
      category: d.category,
      signal: d.signal,
      reason: d.reason,
    })),
    asOf: latestAsOf(src),
    source: src.source ?? "unknown",
  };
}

/**
 * MacroContext → AI 프롬프트/브리핑용 결정론적 한국어 컨텍스트 문자열.
 * forward-validate 면책 포함(예측 아님 · Tier0 스크리닝 팩터 아님). 예측 어휘 금지.
 */
export function renderMacroContextString(ctx: MacroContext): string {
  const date = ctx.asOf.slice(0, 10);
  const header = `[거시 컨텍스트 · asOf ${date} · AI 컨텍스트 입력(예측 아님 · Tier0 스크리닝 팩터 아님)]`;
  const regimeLine = `시장 국면: ${REGIME_LABEL[ctx.regime]}(종합 ${ctx.score}/100). 요약: ${ctx.headline}`;
  const driversLine =
    ctx.drivers.length === 0
      ? "주요 동인: 없음."
      : `주요 동인: ${ctx.drivers
          .map((d) => `${d.category}(${SIGNAL_LABEL[d.signal]}) ${d.reason}`)
          .join("; ")}`;
  return [header, regimeLine, driversLine].join("\n");
}
