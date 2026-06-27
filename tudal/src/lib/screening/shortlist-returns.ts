// B-1 섹터 비교 — 후보 set의 KRX 실현 수익률 (순수 로직, 2026-06-27).
// entry(선정 기준일 종가) → current(최신 거래일 종가) 변화율. 가격 누락 ticker는 제외 + 카운트.
// I/O 없음 — 가격 Map은 호출부(KRX EOD)가 주입. shadow-first: KRX 키 부재 시 호출부가 미계산.

export interface TickerReturn {
  ticker: string;
  entryPrice: number;
  currentPrice: number;
  returnPct: number; // percentage points
}

export interface RealizedReturnSummary {
  perTicker: TickerReturn[];
  pricedCount: number;
  missingCount: number;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * 후보 set 실현 수익률. entry/current 모두 양수인 ticker만 산입(누락/0/음수는 missing).
 */
export function computeRealizedReturns(
  tickers: readonly string[],
  entryPrices: ReadonlyMap<string, number>,
  currentPrices: ReadonlyMap<string, number>,
): RealizedReturnSummary {
  const perTicker: TickerReturn[] = [];
  let missing = 0;
  const seen = new Set<string>();
  for (const ticker of tickers) {
    if (seen.has(ticker)) continue; // 중복 ticker 1회만.
    seen.add(ticker);
    const entry = entryPrices.get(ticker);
    const current = currentPrices.get(ticker);
    if (
      entry === undefined ||
      current === undefined ||
      !(entry > 0) ||
      !(current > 0)
    ) {
      missing += 1;
      continue;
    }
    perTicker.push({
      ticker,
      entryPrice: entry,
      currentPrice: current,
      returnPct: round2(((current - entry) / entry) * 100),
    });
  }

  if (perTicker.length === 0) {
    return { perTicker, pricedCount: 0, missingCount: missing, avgReturnPct: null, medianReturnPct: null };
  }
  const rets = perTicker.map((p) => p.returnPct);
  const avg = round2(rets.reduce((a, b) => a + b, 0) / rets.length);
  const sorted = [...rets].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = round2(
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid],
  );
  return {
    perTicker,
    pricedCount: perTicker.length,
    missingCount: missing,
    avgReturnPct: avg,
    medianReturnPct: median,
  };
}
