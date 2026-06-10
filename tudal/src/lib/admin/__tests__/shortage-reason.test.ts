import { describe, expect, it } from "vitest";
import { resolveShortageReason } from "@/lib/admin/shortage-reason";

// bucketCounts 순서 = [short, mid, long] (각 target 10, 합 30).
// 도달 가능 불변식(shortage-reason.ts 헤더): mid==long∈{0,10} (midlong 직접-write exactly-10-or-throw),
//   short∈{0..10} (직접-write 10 OR carry_short_into_month overlap-exclusion으로 0..10).
//   직접-write는 partial을 persist 못 하므로(throw) 0<total<30 = 전부 트랙 timing/carry 아티팩트.
describe("resolveShortageReason", () => {
  it("총 30종 충족이면 none", () => {
    expect(resolveShortageReason([10, 10, 10])).toBe("none");
  });

  it("초과(30 이상)여도 none", () => {
    expect(resolveShortageReason([12, 10, 10])).toBe("none");
  });

  it("short만 채워지고 midlong 미선정(midlong 대기) → track_pending", () => {
    expect(resolveShortageReason([10, 0, 0])).toBe("track_pending");
  });

  it("midlong만 채워지고 short 미선정(short 주간 대기) → track_pending", () => {
    expect(resolveShortageReason([0, 10, 10])).toBe("track_pending");
  });

  it("[omxy R2 catch] short carry overlap-exclusion으로 9/10(=[9,10,10]) → track_pending (screening 아님)", () => {
    expect(resolveShortageReason([9, 10, 10])).toBe("track_pending");
  });

  it("carry overlap이 커서 short가 크게 줄어도(예: [1,10,10]) track_pending", () => {
    expect(resolveShortageReason([1, 10, 10])).toBe("track_pending");
  });

  it("전 버킷 empty(0/30, 전혀 seed 안 됨) → screening", () => {
    expect(resolveShortageReason([0, 0, 0])).toBe("screening");
  });
});
