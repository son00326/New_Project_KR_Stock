import {
  buildMacroContext,
  renderMacroContextString,
  EMPTY_MACRO_CONTEXT,
  type MacroContextSource,
} from "@/lib/macro/context";
import { buildFredMacroSource } from "@/lib/macro/fred-adapter";

// ---------------------------------------------------------------------------
// G4 — 거시 컨텍스트 source seam (env + now + IO 경계)
// SoT: docs/superpowers/specs/2026-06-26-g4-macro-news-ai-context-layer-design.md §3.2
//
// 유일한 env/now/source/IO 경계. context.ts는 pure 유지.
//   - flag off → "" (dormant 기본 · network 호출 0)
//   - flag on + key → 실 FRED fetch(9 series; 일부 series degrade 허용) → MacroContextSource | null
//   - key 부재 / total failure / too-sparse / timeout·4xx·5xx·파싱오류 → null → "" (fail-safe)
//   - flag on + stale source(asOf > maxStaleDays) → "" (stale fail-safe §1.5)
// FRED 어댑터 throw는 getMacroContextSource try/catch가 흡수 → consumer엔 ""만 도달(throw 0).
// ---------------------------------------------------------------------------

const DEFAULT_MAX_STALE_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 거시 source. flag on + FRED_API_KEY 존재 시 실 FRED(9 series) → MacroContextSource.
 * key 부재 / total failure / too-sparse → null(consumer는 ""로 폴백). throw 흡수(fail-safe).
 */
export async function getMacroContextSource(): Promise<MacroContextSource | null> {
  try {
    return await buildFredMacroSource();
  } catch {
    return null;
  }
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
 *
 * ⚠️ flag-off 가드는 반드시 **첫 문장** — await/fetch 이전에 ""를 반환해 dormant 시 network 0
 *   (flag-off byte-identical). 그 뒤 전체 본문은 try/catch로 감싸 FRED 실패를 "" 흡수.
 */
export async function getMacroContextString(
  opts: GetMacroContextStringOptions = {},
): Promise<string> {
  if (!isMacroContextEnabled()) return EMPTY_MACRO_CONTEXT;

  try {
    const source = opts.source ?? (await getMacroContextSource());
    if (source == null) return EMPTY_MACRO_CONTEXT;
    const ctx = buildMacroContext(source);

    const now = opts.now ?? new Date();
    const maxStaleDays = opts.maxStaleDays ?? DEFAULT_MAX_STALE_DAYS;
    // ⚠️ TZ note: Date.parse 는 timezone-naive ISO("2026-04-11T10:00:00")를 로컬시각으로 해석한다.
    //   실 FRED asOf는 fred-adapter가 Z-qualified(`...T00:00:00Z`)로 공급 → host-TZ 경계 드리프트 차단.
    const asOfMs = Date.parse(ctx.asOf);
    if (!Number.isFinite(asOfMs)) return EMPTY_MACRO_CONTEXT;
    const ageDays = (now.getTime() - asOfMs) / MS_PER_DAY;
    if (ageDays > maxStaleDays) return EMPTY_MACRO_CONTEXT;

    return renderMacroContextString(ctx);
  } catch {
    // 예기치 못한 throw(부분실패/파싱오류 등) → "" (defense-in-depth, flag-off byte-identical).
    return EMPTY_MACRO_CONTEXT;
  }
}
