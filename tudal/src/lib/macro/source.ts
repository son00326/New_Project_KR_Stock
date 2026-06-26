import { MOCK_INDICATORS, MOCK_VERDICT } from "@/lib/data/mock-macro";
import {
  buildMacroContext,
  renderMacroContextString,
  EMPTY_MACRO_CONTEXT,
  type MacroContextSource,
} from "@/lib/macro/context";

// ---------------------------------------------------------------------------
// G4 — 거시 컨텍스트 source seam (env + now 경계)
// SoT: docs/superpowers/specs/2026-06-26-g4-macro-news-ai-context-layer-design.md §3.2
//
// 유일한 env/now/source 경계. context.ts는 pure 유지.
//   - flag off → "" (dormant 기본)
//   - flag on + stale source(asOf > maxStaleDays) → "" (stale-mock fail-safe §1.5)
//   - 실 FRED/source drop-in 지점 = getMacroContextSource (현재 mock).
// ---------------------------------------------------------------------------

const DEFAULT_MAX_STALE_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 거시 source. 현재 mock(MOCK_INDICATORS/MOCK_VERDICT).
 * ⚠️ 실 FRED/source drop-in 지점 — flag 활성 전 실 source 연결 필요(USER 게이트).
 */
export function getMacroContextSource(): MacroContextSource {
  return { indicators: MOCK_INDICATORS, verdict: MOCK_VERDICT, source: "mock" };
}

export function isMacroContextEnabled(): boolean {
  return process.env.MACRO_CONTEXT_ENABLED === "true";
}

export interface GetMacroContextStringOptions {
  now?: Date;
  maxStaleDays?: number;
  source?: MacroContextSource;
}

/**
 * flag + staleness 게이트를 거친 거시 컨텍스트 문자열. 어떤 실패에도 "" 반환(fail-safe dormant).
 * consumer는 ""를 현행 동작으로 폴백한다.
 */
export function getMacroContextString(
  opts: GetMacroContextStringOptions = {},
): string {
  if (!isMacroContextEnabled()) return EMPTY_MACRO_CONTEXT;

  const source = opts.source ?? getMacroContextSource();
  const ctx = buildMacroContext(source);

  const now = opts.now ?? new Date();
  const maxStaleDays = opts.maxStaleDays ?? DEFAULT_MAX_STALE_DAYS;
  const asOfMs = Date.parse(ctx.asOf);
  if (!Number.isFinite(asOfMs)) return EMPTY_MACRO_CONTEXT;
  const ageDays = (now.getTime() - asOfMs) / MS_PER_DAY;
  if (ageDays > maxStaleDays) return EMPTY_MACRO_CONTEXT;

  return renderMacroContextString(ctx);
}
