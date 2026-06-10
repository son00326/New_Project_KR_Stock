import { describe, expect, it } from "vitest";
import { resolveShortageReason } from "@/lib/admin/shortage-reason";

// bucketCounts 순서 = [short, mid, long] (각 target 10, 합 30).
describe("resolveShortageReason", () => {
  it("총 30종 충족이면 none", () => {
    expect(resolveShortageReason([10, 10, 10])).toBe("none");
  });

  it("초과(30 이상)여도 none", () => {
    expect(resolveShortageReason([12, 10, 10])).toBe("none");
  });

  it("트랙 분리 시차 — short만 full(10)이고 mid/long empty(0)면 track_pending", () => {
    expect(resolveShortageReason([10, 0, 0])).toBe("track_pending");
  });

  it("mid/long만 full이고 short empty여도 track_pending", () => {
    expect(resolveShortageReason([0, 10, 10])).toBe("track_pending");
  });

  it("full 버킷 없이 부분 미달이면 screening (track_pending 아님)", () => {
    expect(resolveShortageReason([7, 8, 5])).toBe("screening");
  });

  it("empty 버킷 없이 전 버킷 부분 미달이면 screening", () => {
    expect(resolveShortageReason([9, 8, 9])).toBe("screening");
  });

  it("full 버킷이 있어도 empty 버킷이 없으면 screening", () => {
    expect(resolveShortageReason([10, 9, 8])).toBe("screening");
  });

  it("전 버킷 empty(0/30)면 screening (full 버킷 없음)", () => {
    expect(resolveShortageReason([0, 0, 0])).toBe("screening");
  });
});
