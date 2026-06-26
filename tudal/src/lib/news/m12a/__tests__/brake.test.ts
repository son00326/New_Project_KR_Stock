import { describe, it, expect } from "vitest";

import { applySmartBrake } from "@/lib/news/m12a/brake";
import { DEFAULT_BRAKE_CONFIG } from "@/lib/news/m12a/config";
import type { ApplySmartBrakeInput, BrakeCandidate } from "@/lib/news/m12a/types";

// ---------------------------------------------------------------------------
// M12a smart brake (R3.10-7a) — whole-run hold, NO partial removal.
// 각 case는 정확한 reasons 배열/구조를 pin (truthiness 금지, mutation-resistant).
// ---------------------------------------------------------------------------

function makeInput(over: Partial<ApplySmartBrakeInput>): ApplySmartBrakeInput {
  return {
    candidates: [],
    listTrackSizes: { short: 10, midlong: 20, full: 30 },
    portfolioSize: 10,
    config: DEFAULT_BRAKE_CONFIG,
    ...over,
  };
}

function listCand(track: "short" | "midlong", i: number): BrakeCandidate {
  return { ticker: `L${track}${i}`, surface: "list", track };
}

function portCand(i: number): BrakeCandidate {
  return { ticker: `P${i}`, surface: "portfolio" };
}

describe("applySmartBrake", () => {
  it("빈 candidates → 발동 없음 (리스트 사이즈가 floor 미만이어도 early return)", () => {
    const out = applySmartBrake(
      makeInput({
        candidates: [],
        listTrackSizes: { short: 0, midlong: 0, full: 0 },
        portfolioSize: 100,
      }),
    );
    expect(out).toEqual({ brakeTriggered: false, reasons: [], heldByBrake: false });
  });

  it("1·2·3 list candidate가 모두 floor 이내 → 발동 없음", () => {
    const out = applySmartBrake(
      makeInput({
        candidates: [listCand("short", 0), listCand("midlong", 0), listCand("midlong", 1)],
      }),
    );
    expect(out).toEqual({ brakeTriggered: false, reasons: [], heldByBrake: false });
  });

  it("정확히 4건 (>3) → mass_removal 단독", () => {
    const out = applySmartBrake(
      makeInput({
        candidates: [
          listCand("short", 0),
          listCand("short", 1),
          listCand("midlong", 0),
          listCand("midlong", 1),
        ],
      }),
    );
    expect(out).toEqual({ brakeTriggered: true, reasons: ["mass_removal"], heldByBrake: true });
  });

  it("mass_removal은 동일 ticker의 list+portfolio 이중 surface를 1개 회사로 계산", () => {
    const out = applySmartBrake(
      makeInput({
        candidates: [
          { ticker: "005930", surface: "list", track: "short" },
          { ticker: "005930", surface: "portfolio" },
          { ticker: "000660", surface: "list", track: "midlong" },
          { ticker: "000660", surface: "portfolio" },
        ],
      }),
    );
    expect(out).toEqual({ brakeTriggered: false, reasons: [], heldByBrake: false });
  });

  it("short 트랙 floor 경계 (size 7, 1건 제외 → 남은 6 < 7) → list_track_floor", () => {
    const out = applySmartBrake(
      makeInput({
        candidates: [listCand("short", 0)],
        listTrackSizes: { short: 7, midlong: 20, full: 30 },
      }),
    );
    expect(out).toEqual({ brakeTriggered: true, reasons: ["list_track_floor"], heldByBrake: true });
  });

  it("midlong 트랙 floor 경계 (size 14, 1건 제외 → 13 < 14) → list_track_floor", () => {
    const out = applySmartBrake(
      makeInput({
        candidates: [listCand("midlong", 0)],
        listTrackSizes: { short: 10, midlong: 14, full: 30 },
      }),
    );
    expect(out).toEqual({ brakeTriggered: true, reasons: ["list_track_floor"], heldByBrake: true });
  });

  it("full 트랙 floor 경계 (full 21, 1건 제외 → 20 < 21; short/midlong은 여유) → list_track_floor", () => {
    const out = applySmartBrake(
      makeInput({
        candidates: [listCand("short", 0)],
        listTrackSizes: { short: 10, midlong: 20, full: 21 },
      }),
    );
    expect(out).toEqual({ brakeTriggered: true, reasons: ["list_track_floor"], heldByBrake: true });
  });

  it("portfolio N=10, 4건 제외 → ceil(7)=7, 10-4=6<7 → portfolio_floor (+ mass_removal)", () => {
    const out = applySmartBrake(
      makeInput({
        candidates: [portCand(0), portCand(1), portCand(2), portCand(3)],
        portfolioSize: 10,
      }),
    );
    expect(out).toEqual({
      brakeTriggered: true,
      reasons: ["mass_removal", "portfolio_floor"],
      heldByBrake: true,
    });
  });

  it("portfolio N=10, 3건 제외 → 10-3=7, 7<7 거짓 → 발동 없음 (strict< + ceil pin)", () => {
    const out = applySmartBrake(
      makeInput({
        candidates: [portCand(0), portCand(1), portCand(2)],
        portfolioSize: 10,
      }),
    );
    expect(out).toEqual({ brakeTriggered: false, reasons: [], heldByBrake: false });
  });

  it("집중 포트 N=8 (<10), 1건 제외 → p<2 → 발동 없음", () => {
    const out = applySmartBrake(
      makeInput({
        candidates: [portCand(0)],
        portfolioSize: 8,
      }),
    );
    expect(out).toEqual({ brakeTriggered: false, reasons: [], heldByBrake: false });
  });

  it("집중 포트 N=8 (<10), 2건 제외 → p>=2 → portfolio_floor", () => {
    const out = applySmartBrake(
      makeInput({
        candidates: [portCand(0), portCand(1)],
        portfolioSize: 8,
      }),
    );
    expect(out).toEqual({ brakeTriggered: true, reasons: ["portfolio_floor"], heldByBrake: true });
  });

  it("중첩 트리거 (mass + list + portfolio) → reasons 3건 순서대로", () => {
    const out = applySmartBrake(
      makeInput({
        candidates: [listCand("short", 0), listCand("short", 1), portCand(0), portCand(1)],
        listTrackSizes: { short: 8, midlong: 20, full: 30 },
        portfolioSize: 8,
      }),
    );
    expect(out).toEqual({
      brakeTriggered: true,
      reasons: ["mass_removal", "list_track_floor", "portfolio_floor"],
      heldByBrake: true,
    });
  });
});
