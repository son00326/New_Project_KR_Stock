import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

// T7e.2: admin-shortlist는 Supabase 실 SELECT라 테스트에서는 mock fixture로 우회.
// month 인자에 매칭되는 mock 행만 반환하여 기존 테스트 시나리오를 유지한다.
vi.mock("@/lib/data/admin-shortlist", async () => {
  const { MOCK_ADMIN_SHORTLIST } = await import(
    "@/lib/data/mock-admin-shortlist"
  );
  return {
    getActiveShortList: async (options?: { month?: string }) => {
      if (!options?.month) return MOCK_ADMIN_SHORTLIST;
      return MOCK_ADMIN_SHORTLIST.filter(
        (item) => item.month === options.month,
      );
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "admin-test-1" } },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("acceptShortList", () => {
  it("rejects non-object payloads instead of throwing", async () => {
    const { acceptShortList } = await import("../actions");

    const result = await acceptShortList(
      null as unknown as Parameters<typeof acceptShortList>[0],
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_input");
  });

  it("blocks direct server action calls while the 24h hold is active", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T01:00:00.000Z"));
    const { acceptShortList } = await import("../actions");

    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2000-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("accept_gate_blocked:hold_24h");
  });

  it("does not trust caller-supplied generated timestamps for gate timing", async () => {
    const { acceptShortList } = await import("../actions");

    const result = await acceptShortList({
      month: "2099-01-01",
      shortlistGeneratedAt: "2000-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("shortlist_month_not_found");
  });

  it("blocks accept when any required representative report has fewer than 2 viewers", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));
    const { MOCK_ADMIN_REPORT_VIEW_LOG } = await import(
      "@/lib/data/mock-admin-report-view-log"
    );
    const removed = MOCK_ADMIN_REPORT_VIEW_LOG.splice(
      0,
      MOCK_ADMIN_REPORT_VIEW_LOG.length,
      ...MOCK_ADMIN_REPORT_VIEW_LOG.filter(
        (row) => row.reportId !== "rpt-2026-04-01-000660",
      ),
    );
    const { acceptShortList } = await import("../actions");

    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });

    MOCK_ADMIN_REPORT_VIEW_LOG.splice(
      0,
      MOCK_ADMIN_REPORT_VIEW_LOG.length,
      ...removed,
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("accept_gate_blocked:viewers_insufficient");
  });

  it("fails closed when auth lookup fails in production-like environments", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.getUser.mockRejectedValue(new Error("auth down"));
    const { acceptShortList } = await import("../actions");

    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("auth_unavailable");
  });

  it("does not report mock accept persistence as success in production-like environments", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { acceptShortList } = await import("../actions");

    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("real_persistence_not_configured");
  });
});

describe("rejectShortList", () => {
  it("rejects non-object payloads instead of throwing", async () => {
    const { rejectShortList } = await import("../actions");

    const result = await rejectShortList(
      null as unknown as Parameters<typeof rejectShortList>[0],
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_input");
  });

  it("rejects unknown shortlist months before mutating approvals", async () => {
    const { MOCK_ADMIN_APPROVALS } = await import("@/lib/data/mock-admin-approvals");
    const initialLength = MOCK_ADMIN_APPROVALS.length;
    const { rejectShortList } = await import("../actions");

    const result = await rejectShortList({ month: "2099-01-01" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("shortlist_month_not_found");
    expect(MOCK_ADMIN_APPROVALS).toHaveLength(initialLength);
  });

  it("does not report mock reject persistence as success in production-like environments", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { rejectShortList } = await import("../actions");

    const result = await rejectShortList({
      month: "2026-04-01",
      reason: "운영 검토 필요",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("real_persistence_not_configured");
  });
});

describe("dispute actions", () => {
  it("rejects malformed dispute payloads instead of throwing", async () => {
    const { raiseDispute, resolveDispute } = await import("../actions");

    const raiseResult = await raiseDispute(
      null as unknown as Parameters<typeof raiseDispute>[0],
    );
    const resolveResult = await resolveDispute(
      null as unknown as Parameters<typeof resolveDispute>[0],
    );

    expect(raiseResult.success).toBe(false);
    if (!raiseResult.success) expect(raiseResult.error).toBe("invalid_input");
    expect(resolveResult.success).toBe(false);
    if (!resolveResult.success) expect(resolveResult.error).toBe("invalid_input");
  });

  it("does not report mock dispute persistence as success in production-like environments", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { raiseDispute, resolveDispute } = await import("../actions");

    const raiseResult = await raiseDispute({
      approvalId: "appr-prev-2026-03",
      adminId: "admin-test-1",
      reason: "생산 환경에서는 실제 이의 제기 저장소가 연결되어야 합니다.",
    });
    const resolveResult = await resolveDispute({
      approvalId: "appr-prev-2026-03",
      adminId: "admin-test-1",
    });

    expect(raiseResult.success).toBe(false);
    if (!raiseResult.success) expect(raiseResult.error).toBe("real_persistence_not_configured");
    expect(resolveResult.success).toBe(false);
    if (!resolveResult.success) expect(resolveResult.error).toBe("real_persistence_not_configured");
  });
});
