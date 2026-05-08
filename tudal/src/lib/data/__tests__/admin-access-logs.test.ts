import { describe, expect, it } from "vitest";
import { getRecentAdminAccessLogs } from "@/lib/data/admin-access-logs";
import { detectSingleAdminStreak } from "@/lib/portfolio/auto-relief";

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

  it("BL-20 7일 단일 어드민 자동 바이패스는 boundary stub 동안 영구 비활성", async () => {
    const now = new Date("2026-04-17T10:00:00+09:00");
    const logs = await getRecentAdminAccessLogs(now, 7);
    expect(detectSingleAdminStreak(logs, now, 7).active).toBe(false);
  });
});
