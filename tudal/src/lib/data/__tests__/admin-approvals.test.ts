import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPortfolioApproval,
  getApprovalsByMonth,
  raisePortfolioDispute,
  transformPortfolioApprovalRow,
  type PortfolioApprovalDbRow,
} from "@/lib/data/admin-approvals";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  insert: vi.fn(),
  single: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mocks.from,
    rpc: mocks.rpc,
  })),
}));

const baseRow: PortfolioApprovalDbRow = {
  id: "11111111-1111-1111-1111-111111111111",
  month: "2026-04-01",
  admin_id: "22222222-2222-2222-2222-222222222222",
  approval_type: "accept",
  approved_at: "2026-04-03T02:30:00.000Z",
  is_final: true,
  prev_portfolio_held: false,
  shortlist_generated_at: "2026-04-01T00:00:00.000Z",
  dispute_raised_at: null,
  dispute_raised_by: null,
  dispute_reason: null,
  dispute_resolved_at: null,
  gating_auto_relief_active: false,
  reanalysis_count: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  const selectQuery = {
    select: mocks.select,
    eq: mocks.eq,
    order: mocks.order,
  };
  mocks.from.mockReturnValue({
    select: mocks.select,
    insert: mocks.insert,
  });
  mocks.select.mockReturnValue(selectQuery);
  mocks.eq.mockReturnValue(selectQuery);
  mocks.order.mockResolvedValue({ data: [baseRow], error: null });
  mocks.insert.mockReturnValue({
    select: () => ({
      single: mocks.single,
    }),
  });
  mocks.single.mockResolvedValue({
    data: { id: baseRow.id, is_final: true },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: "2026-04-04T00:00:00.000Z", error: null });
});

describe("transformPortfolioApprovalRow", () => {
  it("maps snake_case DB columns to camelCase PortfolioApproval fields", () => {
    const approval = transformPortfolioApprovalRow(baseRow);

    expect(approval.id).toBe(baseRow.id);
    expect(approval.adminId).toBe(baseRow.admin_id);
    expect(approval.approvalType).toBe("accept");
    expect(approval.approvedAt).toBe(baseRow.approved_at);
    expect(approval.isFinal).toBe(true);
    expect(approval.shortlistGeneratedAt).toBe(baseRow.shortlist_generated_at);
    expect(approval.gatingAutoReliefActive).toBe(false);
    expect(approval.reanalysisCount).toBe(0);
  });
});

describe("getApprovalsByMonth", () => {
  it("queries portfolio_approval by month ordered by approved_at", async () => {
    const approvals = await getApprovalsByMonth("2026-04-01");

    expect(mocks.from).toHaveBeenCalledWith("portfolio_approval");
    expect(mocks.eq).toHaveBeenCalledWith("month", "2026-04-01");
    expect(mocks.order).toHaveBeenCalledWith("approved_at", { ascending: true });
    expect(approvals).toHaveLength(1);
    expect(approvals[0].id).toBe(baseRow.id);
  });
});

describe("createPortfolioApproval", () => {
  it("inserts a portfolio_approval row and returns the generated id", async () => {
    const result = await createPortfolioApproval({
      month: "2026-04-01",
      adminId: "22222222-2222-2222-2222-222222222222",
      approvalType: "accept",
      isFinal: true,
      prevPortfolioHeld: false,
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
      gatingAutoReliefActive: false,
      reanalysisCount: 0,
    });

    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({
      month: "2026-04-01",
      admin_id: "22222222-2222-2222-2222-222222222222",
      approval_type: "accept",
      is_final: true,
      shortlist_generated_at: "2026-04-01T00:00:00.000Z",
    });
    expect(result).toEqual({ id: baseRow.id, isFinal: true });
  });
});

describe("raisePortfolioDispute", () => {
  it("uses the narrow security-definer RPC instead of broad row update", async () => {
    const raisedAt = await raisePortfolioDispute({
      approvalId: baseRow.id,
      reason: "확정 포트에 대한 이의 사유를 충분히 자세히 기록합니다.",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("raise_portfolio_dispute", {
      p_approval_id: baseRow.id,
      p_reason: "확정 포트에 대한 이의 사유를 충분히 자세히 기록합니다.",
    });
    expect(raisedAt).toBe("2026-04-04T00:00:00.000Z");
  });
});
