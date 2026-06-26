import type {
  ApplySmartBrakeInput,
  BrakeOutcome,
  BrakeReason,
} from "@/lib/news/m12a/types";

// ---------------------------------------------------------------------------
// M12a smart brake (R3.10-7a) — run 전체를 통째로 hold할지 결정 (부분 제외 없음).
// 아래 3 사유 중 하나라도 위반이면 brakeTriggered=true → 후보 전건 held_by_brake.
//   (1) mass_removal     : 1 run 자동제외 후보 수 > maxAutoRemovalsPerRun
//   (2) list_track_floor : 홈 리스트 트랙(short/midlong/full) 70% floor 위반
//   (3) portfolio_floor  : 가상포트 floor(70%) 또는 집중포트(N<max, 2건↑) 위반
// 빈 candidates는 무조건 발동 없음.
// ---------------------------------------------------------------------------
export function applySmartBrake(input: ApplySmartBrakeInput): BrakeOutcome {
  const { candidates, listTrackSizes, portfolioSize, config } = input;

  if (candidates.length === 0) {
    return { brakeTriggered: false, reasons: [], heldByBrake: false };
  }

  const reasons: Exclude<BrakeReason, null>[] = [];

  // (1) mass_removal — 후보 수가 1 run 상한 초과
  const uniqueCompanyCount = new Set(candidates.map((c) => c.ticker)).size;
  if (uniqueCompanyCount > config.maxAutoRemovalsPerRun) {
    reasons.push("mass_removal");
  }

  // (2) list_track_floor — list surface 후보의 트랙별 잔여가 floor 미만
  const listCandidates = candidates.filter((c) => c.surface === "list");
  const s = listCandidates.filter((c) => c.track === "short").length;
  const m = listCandidates.filter((c) => c.track === "midlong").length;
  const full = s + m;
  if (
    listTrackSizes.short - s < config.listFloors.short ||
    listTrackSizes.midlong - m < config.listFloors.midlong ||
    listTrackSizes.full - full < config.listFloors.full
  ) {
    reasons.push("list_track_floor");
  }

  // (3) portfolio_floor — 가상포트 잔여가 floor 미만 / 집중포트 2건↑
  const p = candidates.filter((c) => c.surface === "portfolio").length;
  const n = portfolioSize;
  const portfolioViolated =
    n >= config.concentratedPortfolioMax
      ? n - p < Math.ceil(0.7 * n)
      : p >= 2;
  if (portfolioViolated) {
    reasons.push("portfolio_floor");
  }

  const brakeTriggered = reasons.length > 0;
  return { brakeTriggered, reasons, heldByBrake: brakeTriggered };
}
