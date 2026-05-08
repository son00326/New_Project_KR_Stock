import { describe, expect, it } from "vitest";
import { canLinkDeltaReport } from "@/components/admin/shortlist/delta-banner";

describe("canLinkDeltaReport", () => {
  it("does not link removed delta items even after report links are enabled", () => {
    expect(canLinkDeltaReport({ deltaStatus: "removed" }, true)).toBe(false);
  });

  it("links new and hold items only when report links are enabled", () => {
    expect(canLinkDeltaReport({ deltaStatus: "new" }, true)).toBe(true);
    expect(canLinkDeltaReport({ deltaStatus: "hold" }, true)).toBe(true);
    expect(canLinkDeltaReport({ deltaStatus: "new" }, false)).toBe(false);
  });
});
