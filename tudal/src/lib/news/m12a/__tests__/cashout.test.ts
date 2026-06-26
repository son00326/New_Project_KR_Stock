import { describe, it, expect } from "vitest";

import { buildCashoutRecord } from "@/lib/news/m12a/cashout";
import type { CashoutRecord } from "@/lib/news/m12a/types";

// M12a GAP2 — buildCashoutRecord (fail-closed) 유닛 테스트
describe("buildCashoutRecord", () => {
  it("유효 입력 → 전체 CashoutRecord(상수 priceSource/executionAssumption)", () => {
    const record = buildCashoutRecord({
      ticker: "005930",
      price: 71800,
      priceBasisDate: "20260626",
    });
    const expected: CashoutRecord = {
      ticker: "005930",
      price: 71800,
      priceBasisDate: "20260626",
      priceSource: "KRX_EOD",
      executionAssumption: "virtual_eod",
    };
    expect(record).toEqual(expected);
  });

  it("price=0 → null (fail-closed)", () => {
    expect(
      buildCashoutRecord({ ticker: "005930", price: 0, priceBasisDate: "20260626" }),
    ).toBeNull();
  });

  it("price=-5 (음수) → null", () => {
    expect(
      buildCashoutRecord({ ticker: "005930", price: -5, priceBasisDate: "20260626" }),
    ).toBeNull();
  });

  it("price=NaN → null", () => {
    expect(
      buildCashoutRecord({ ticker: "005930", price: NaN, priceBasisDate: "20260626" }),
    ).toBeNull();
  });

  it("price=Infinity → null", () => {
    expect(
      buildCashoutRecord({
        ticker: "005930",
        price: Infinity,
        priceBasisDate: "20260626",
      }),
    ).toBeNull();
  });

  it("price=-Infinity → null", () => {
    expect(
      buildCashoutRecord({
        ticker: "005930",
        price: -Infinity,
        priceBasisDate: "20260626",
      }),
    ).toBeNull();
  });

  it("priceBasisDate 빈 문자열 → null", () => {
    expect(
      buildCashoutRecord({ ticker: "005930", price: 71800, priceBasisDate: "" }),
    ).toBeNull();
  });

  it("priceBasisDate가 KRX EOD YYYYMMDD 형식이 아니면 null", () => {
    expect(
      buildCashoutRecord({
        ticker: "005930",
        price: 71800,
        priceBasisDate: "2026-06-26",
      }),
    ).toBeNull();
    expect(
      buildCashoutRecord({
        ticker: "005930",
        price: 71800,
        priceBasisDate: "2026062x",
      }),
    ).toBeNull();
  });

  it("유효 입력 → ticker 보존(다른 종목)", () => {
    const record = buildCashoutRecord({
      ticker: "000660",
      price: 195000,
      priceBasisDate: "20260626",
    });
    expect(record).not.toBeNull();
    expect(record?.ticker).toBe("000660");
  });

  it("최소 양수 price(0 초과) → 레코드 생성", () => {
    const record = buildCashoutRecord({
      ticker: "035720",
      price: 0.01,
      priceBasisDate: "20260101",
    });
    expect(record).toEqual({
      ticker: "035720",
      price: 0.01,
      priceBasisDate: "20260101",
      priceSource: "KRX_EOD",
      executionAssumption: "virtual_eod",
    });
  });
});
