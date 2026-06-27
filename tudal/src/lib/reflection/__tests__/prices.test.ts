import { describe, it, expect, vi } from "vitest";
import { resolveReflectionPrices } from "@/lib/reflection/prices";

// 2026-06 영업일 일부(스텁).
const DAYS = [
  { date: "2026-06-22", isBusinessDay: true },
  { date: "2026-06-23", isBusinessDay: true },
  { date: "2026-06-24", isBusinessDay: true },
  { date: "2026-06-25", isBusinessDay: true },
  { date: "2026-06-26", isBusinessDay: true },
];

describe("resolveReflectionPrices", () => {
  it("entry(finalize 거래일)·current(now 거래일) 두 날짜로 가격 1배치씩 + dates 반환", async () => {
    const fetchEodPrices = vi.fn(async (_tickers: readonly string[], basDd: string) =>
      basDd === "20260624"
        ? new Map([["000001", 100]])
        : new Map([["000001", 110]]),
    );
    // finalize/now 모두 KST 18시 close cutoff 후(=10:00 UTC → 19:00 KST) → 당일 종가 확정.
    const out = await resolveReflectionPrices(
      { tickers: ["000001"], finalizedAt: "2026-06-24T10:00:00Z" },
      {
        now: new Date("2026-06-26T10:00:00Z"),
        loadBusinessDays: async () => DAYS,
        fetchEodPrices,
      },
    );
    expect(out.entryDate).toBe("20260624");
    expect(out.currentDate).toBe("20260626");
    expect(out.entryPrices.get("000001")).toBe(100);
    expect(out.currentPrices.get("000001")).toBe(110);
    expect(fetchEodPrices).toHaveBeenCalledTimes(2);
  });

  it("invalid finalizedAt → EMPTY(fail-soft, fetch 0콜)", async () => {
    const fetchEodPrices = vi.fn();
    const out = await resolveReflectionPrices(
      { tickers: ["000001"], finalizedAt: "not-a-date" },
      { now: new Date("2026-06-26T10:00:00Z"), loadBusinessDays: async () => DAYS, fetchEodPrices },
    );
    expect(out.entryPrices.size).toBe(0);
    expect(out.entryDate).toBeNull();
    expect(fetchEodPrices).not.toHaveBeenCalled();
  });

  it("거래일 해소 실패(빈 calendar) → EMPTY(fetch 0콜)", async () => {
    const fetchEodPrices = vi.fn();
    const out = await resolveReflectionPrices(
      { tickers: ["000001"], finalizedAt: "2026-06-24T08:00:00Z" },
      { now: new Date("2026-06-26T10:00:00Z"), loadBusinessDays: async () => [], fetchEodPrices },
    );
    expect(out.currentDate).toBeNull();
    expect(fetchEodPrices).not.toHaveBeenCalled();
  });
});
