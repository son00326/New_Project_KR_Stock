// G1 D-2 — champion config mirror drift-pin. SoT = Python cfg1 lock(trend+size only).
//   shape/값이 바뀌면 Python cfg1과의 provenance가 깨진 것 — 동시 갱신 없이는 실패해야 한다.
import { describe, it, expect } from "vitest";
import {
  FUNNEL_CHAMPION_CONFIG,
  TIER0_SCORE_PSEUDO_CONFIG,
  TIER0_SCORE_PSEUDO_FACTOR,
} from "@/lib/reflection/funnel-champion-config";

describe("FUNNEL_CHAMPION_CONFIG (cfg1 mirror drift-pin)", () => {
  it("shape pin: 정확히 {trend, size} equal-weight 0.5", () => {
    expect(FUNNEL_CHAMPION_CONFIG).toEqual({ trend: 0.5, size: 0.5 });
    expect(Object.keys(FUNNEL_CHAMPION_CONFIG).sort()).toEqual(["size", "trend"]);
  });

  it("가중치는 [0,1] 범위 (buildFunnelReflection clamp 계약 정합)", () => {
    for (const v of Object.values(FUNNEL_CHAMPION_CONFIG)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("frozen — 런타임 변형 불가(자동 적용 금지 방어)", () => {
    expect(Object.isFrozen(FUNNEL_CHAMPION_CONFIG)).toBe(true);
    expect(Object.isFrozen(TIER0_SCORE_PSEUDO_CONFIG)).toBe(true);
  });
});

describe("TIER0_SCORE_PSEUDO_CONFIG (factor_ranks 부재 fallback)", () => {
  it("단일 pseudo-factor tier0_score=0.5 (양방향 nudge 대칭 시작점)", () => {
    expect(TIER0_SCORE_PSEUDO_CONFIG).toEqual({ [TIER0_SCORE_PSEUDO_FACTOR]: 0.5 });
    expect(TIER0_SCORE_PSEUDO_FACTOR).toBe("tier0_score");
  });
});
