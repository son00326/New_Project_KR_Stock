import { describe, expect, it } from "vitest";
import { canLinkDeltaReport } from "@/components/admin/shortlist/delta-banner";

describe("canLinkDeltaReport", () => {
  it("does not link removed delta items", () => {
    expect(canLinkDeltaReport({ deltaStatus: "removed" })).toBe(false);
  });

  it("links new and hold items", () => {
    expect(canLinkDeltaReport({ deltaStatus: "new" })).toBe(true);
    expect(canLinkDeltaReport({ deltaStatus: "hold" })).toBe(true);
  });
});
