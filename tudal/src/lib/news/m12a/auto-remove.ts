import { buildCashoutRecord } from "@/lib/news/m12a/cashout";
import type { CashoutRecord } from "@/lib/news/m12a/types";

export type ResolveCashout = (
  ticker: string,
) => Promise<{ price: number; priceBasisDate: string } | null>;

export type ApplyAutoRemove = (input: {
  tickers: string[];
  cashouts: CashoutRecord[];
}) => Promise<void>;

export async function resolveCachedCashout(input: {
  ticker: string;
  cache: Map<string, CashoutRecord | null>;
  resolveCashout?: ResolveCashout;
}): Promise<CashoutRecord | null> {
  if (!input.cache.has(input.ticker)) {
    const px = await input.resolveCashout?.(input.ticker);
    input.cache.set(
      input.ticker,
      px
        ? buildCashoutRecord({
            ticker: input.ticker,
            price: px.price,
            priceBasisDate: px.priceBasisDate,
          })
        : null,
    );
  }
  return input.cache.get(input.ticker) ?? null;
}

export async function applyAutoRemoveMutation(input: {
  enabled: boolean;
  brakeTriggered: boolean;
  cashoutByTicker: ReadonlyMap<string, CashoutRecord>;
  applyAutoRemove?: ApplyAutoRemove;
}): Promise<{ tickers: string[]; cashouts: CashoutRecord[] }> {
  const tickers = Array.from(input.cashoutByTicker.keys());
  const cashouts = Array.from(input.cashoutByTicker.values());
  if (input.enabled && !input.brakeTriggered && tickers.length > 0) {
    if (!input.applyAutoRemove) {
      throw new Error("m12a_auto_remove_apply_missing");
    }
    await input.applyAutoRemove({ tickers, cashouts });
  }
  return { tickers, cashouts };
}
