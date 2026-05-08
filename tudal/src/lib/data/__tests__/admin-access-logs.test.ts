import { describe, expect, it } from "vitest";
import { getRecentAdminAccessLogs } from "@/lib/data/admin-access-logs";

describe("getRecentAdminAccessLogs", () => {
  it("returns an empty array (boundary stub until real source is wired)", async () => {
    const now = new Date("2026-04-17T10:00:00+09:00");
    const result = await getRecentAdminAccessLogs(now, 7);
    expect(result).toEqual([]);
  });

  it("does not throw when invoked without arguments (defaults)", async () => {
    const result = await getRecentAdminAccessLogs();
    expect(result).toEqual([]);
  });
});
