import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PortfolioApproval } from "@/types/admin";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getApprovalsByMonth: vi.fn(),
  createPortfolioApproval: vi.fn(),
  getApprovalById: vi.fn(),
  raisePortfolioDispute: vi.fn(),
  resolvePortfolioDispute: vi.fn(),
  insertPortfolioSnapshots: vi.fn(),
  // Mock cleanup Step 1.3 (58차): MOCK_ADMIN_REPORT_VIEW_LOG splice 패턴 폐기 →
  // getDistinctViewerCountsByTicker mock DI. 기본은 빈 Map (모든 ticker count=0 → viewers_insufficient).
  getDistinctViewerCountsByTicker: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

vi.mock("@/lib/data/admin-approvals", () => ({
  getApprovalsByMonth: mocks.getApprovalsByMonth,
  createPortfolioApproval: mocks.createPortfolioApproval,
  getApprovalById: mocks.getApprovalById,
  raisePortfolioDispute: mocks.raisePortfolioDispute,
  resolvePortfolioDispute: mocks.resolvePortfolioDispute,
}));

vi.mock("@/lib/data/admin-snapshots", () => ({
  insertPortfolioSnapshots: mocks.insertPortfolioSnapshots,
}));

vi.mock("@/lib/data/admin-report-view-log", () => ({
  getDistinctViewerCountsByTicker: mocks.getDistinctViewerCountsByTicker,
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

const finalApproval: PortfolioApproval = {
  id: "11111111-1111-1111-1111-111111111111",
  month: "2026-04-01",
  adminId: "owner-admin",
  approvalType: "accept",
  approvedAt: "2026-04-03T02:30:00.000Z",
  isFinal: true,
  prevPortfolioHeld: false,
  shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
  disputeRaisedAt: null,
  disputeRaisedBy: null,
  disputeReason: null,
  disputeResolvedAt: null,
  gatingAutoReliefActive: false,
  reanalysisCount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "admin-test-1" } },
  });
  mocks.getApprovalsByMonth.mockResolvedValue([]);
  mocks.createPortfolioApproval.mockResolvedValue({
    id: "22222222-2222-2222-2222-222222222222",
    isFinal: true,
  });
  mocks.getApprovalById.mockResolvedValue(finalApproval);
  mocks.raisePortfolioDispute.mockResolvedValue("2026-04-04T00:00:00.000Z");
  mocks.resolvePortfolioDispute.mockResolvedValue("2026-04-05T00:00:00.000Z");
  mocks.insertPortfolioSnapshots.mockResolvedValue(undefined);
  // Mock cleanup Step 1.3: 기본 = 게이트 통과 (대표 5종 모두 2인 열람 충족) — 기존 mock seed 동등.
  // 게이트 차단 케이스는 per-test override.
  mocks.getDistinctViewerCountsByTicker.mockResolvedValue(
    new Map([
      ["005930", 2],
      ["000660", 2],
      ["012450", 2],
      ["196170", 2],
      ["373220", 2],
    ]),
  );
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
    expect(mocks.createPortfolioApproval).not.toHaveBeenCalled();
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
    // Mock cleanup Step 1.3 (58차): MOCK_ADMIN_REPORT_VIEW_LOG splice 패턴 폐기 →
    // getDistinctViewerCountsByTicker mock DI로 viewers_insufficient 시나리오 구성.
    // 005930·012450·196170·373220은 2인 통과, 000660은 1인 미달 → Math.min=1 → 게이트 차단.
    mocks.getDistinctViewerCountsByTicker.mockResolvedValueOnce(
      new Map([
        ["005930", 2],
        ["000660", 1],
        ["012450", 2],
        ["196170", 2],
        ["373220", 2],
      ]),
    );
    const { acceptShortList } = await import("../actions");

    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("accept_gate_blocked:viewers_insufficient");
  });

  it("returns accept_gate_lookup_failed when viewer count helper throws (R2 Gödel HIGH fix)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));
    // Mock cleanup Step 1.3 R3 (omxy Goodall NEEDS FIX): regression test for try/catch wrap —
    // getDistinctViewerCountsByTicker throw → acceptShortList Server Action contract 보존.
    mocks.getDistinctViewerCountsByTicker.mockRejectedValueOnce(
      new Error("report_view_log_reports_lookup_failed:PGRST301"),
    );
    const { acceptShortList } = await import("../actions");

    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("accept_gate_lookup_failed");
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

  it("fails closed before mutating approvals when real entry prices are unavailable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));
    const { acceptShortList } = await import("../actions");

    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("entry_price_unavailable");
    expect(mocks.createPortfolioApproval).not.toHaveBeenCalled();
    expect(mocks.insertPortfolioSnapshots).not.toHaveBeenCalled();
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
    const { rejectShortList } = await import("../actions");

    const result = await rejectShortList({ month: "2099-01-01" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("shortlist_month_not_found");
    expect(mocks.createPortfolioApproval).not.toHaveBeenCalled();
  });

  it("persists second reject approval through Supabase data layer", async () => {
    mocks.getApprovalsByMonth.mockResolvedValue([
      { ...finalApproval, id: "reject-1", approvalType: "reject", isFinal: false },
    ]);
    const { rejectShortList } = await import("../actions");

    const result = await rejectShortList({
      month: "2026-04-01",
      reason: "운영 검토 필요",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        reanalysisCount: 2,
        portfolioHoldWarning: true,
      });
    }
    expect(mocks.createPortfolioApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        month: "2026-04-01",
        adminId: "admin-test-1",
        approvalType: "reject",
        isFinal: false,
        reanalysisCount: 1,
        prevPortfolioHeld: true,
        disputeReason: "운영 검토 필요",
      }),
    );
  });

  it("blocks a third reject instead of writing another ambiguous reanalysis_count=1 row", async () => {
    mocks.getApprovalsByMonth.mockResolvedValue([
      { ...finalApproval, id: "reject-1", approvalType: "reject", isFinal: false },
      { ...finalApproval, id: "reject-2", approvalType: "reject", isFinal: false },
    ]);
    const { rejectShortList } = await import("../actions");

    const result = await rejectShortList({
      month: "2026-04-01",
      reason: "운영 검토 필요",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("reanalysis_limit_reached");
    expect(mocks.createPortfolioApproval).not.toHaveBeenCalled();
  });

  it("does not map reject insert errors to the accept-only already_finalized race", async () => {
    mocks.createPortfolioApproval.mockRejectedValue({ code: "23505" });
    const { rejectShortList } = await import("../actions");

    const result = await rejectShortList({
      month: "2026-04-01",
      reason: "운영 검토 필요",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("approval_write_failed");
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

  it("raises disputes through the narrow Supabase RPC wrapper", async () => {
    const { raiseDispute } = await import("../actions");

    const result = await raiseDispute({
      approvalId: finalApproval.id,
      adminId: "ignored-client-admin",
      reason: "확정 포트에 대한 이의 사유를 충분히 자세히 기록합니다.",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.raisedAt).toBe("2026-04-04T00:00:00.000Z");
    }
    expect(mocks.raisePortfolioDispute).toHaveBeenCalledWith({
      approvalId: finalApproval.id,
      reason: "확정 포트에 대한 이의 사유를 충분히 자세히 기록합니다.",
    });
  });

  it("returns approval_not_found when the approval row is absent", async () => {
    mocks.getApprovalById.mockResolvedValue(null);
    const { raiseDispute } = await import("../actions");

    const result = await raiseDispute({
      approvalId: finalApproval.id,
      adminId: "ignored-client-admin",
      reason: "확정 포트에 대한 이의 사유를 충분히 자세히 기록합니다.",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("approval_not_found");
    expect(mocks.raisePortfolioDispute).not.toHaveBeenCalled();
  });

  it("resolves disputes through the narrow Supabase RPC wrapper", async () => {
    const { resolveDispute } = await import("../actions");

    const result = await resolveDispute({
      approvalId: finalApproval.id,
      adminId: "ignored-client-admin",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resolvedAt).toBe("2026-04-05T00:00:00.000Z");
    }
    expect(mocks.resolvePortfolioDispute).toHaveBeenCalledWith(finalApproval.id);
  });
});
