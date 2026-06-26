import {
  buildNegativeNewsContext,
  type NegativeNewsItem,
} from "@/lib/news/m12a/negative-news-context";
import { isM12aNewsEvalEnabled } from "@/lib/news/m12a/flags";

// ---------------------------------------------------------------------------
// M12a 재진입 컨텍스트 source seam (R3.10-7c) — selection 진입 시 호출.
//   - flag off(M12A_NEWS_EVAL_ENABLED) 또는 fetcher 미주입 → "" (dormant → 선정 프롬프트 byte-identical).
//   - flag on + fetcher 주입 시: 최근 negative-news ledger rows → 결정론 digest.
//   getMacroContextString(G4)와 동일 패턴. 별개 범주(per-ticker thesis-break 재판단).
//
// ⚠️ 실 fetcher(m12a_ticker_assessment 최근 rows 조회) drop-in 지점 — M12a ledger 가동(USER 게이트) 후 주입.
//   현재 selection-worker는 fetcher 미주입 → "" → 선정 무회귀(shadow-first).
// ---------------------------------------------------------------------------

export interface GetNegativeNewsContextOptions {
  fetchRecent?: () => Promise<NegativeNewsItem[]>;
  maxItems?: number;
}

export async function getNegativeNewsContextString(
  opts: GetNegativeNewsContextOptions = {},
): Promise<string> {
  if (!isM12aNewsEvalEnabled() || !opts.fetchRecent) return "";
  const items = await opts.fetchRecent();
  return buildNegativeNewsContext(items, { maxItems: opts.maxItems });
}
