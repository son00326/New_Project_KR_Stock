import type { BrakeConfig } from "@/lib/news/m12a/types";

// ---------------------------------------------------------------------------
// M12a smart brake 기본 config (R3.10-7a).
//   - maxAutoRemovalsPerRun=3: 1 run 자동제외 후보 > 3 (즉 4건↑) → mass hold.
//   - listFloors=홈 리스트 트랙 70%: short 7(of 10) / midlong 14(of 20) / full 21(of 30).
//   - concentratedPortfolioMax=10: 가상포트 N<10 = 집중포트(1건 자동·2건↑ 보류).
// ---------------------------------------------------------------------------
export const DEFAULT_BRAKE_CONFIG: BrakeConfig = {
  maxAutoRemovalsPerRun: 3,
  listFloors: { short: 7, midlong: 14, full: 21 },
  concentratedPortfolioMax: 10,
};
