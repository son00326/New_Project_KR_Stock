// W3b-1 (D26 Q2 / D3) — proposePortfolio admin server action tests.
// invariant:
//   - input.month MONTH_RE(YYYY-MM-01) 검증 (acceptShortList/portfolio page와 동일).
//   - getUser → user 없음 → auth_unavailable (AI cost path, dev mock fallback 금지).
//   - is_admin() RPC 게이트 (error/false 모두 fail-closed → admin_required).
//   - flag(PORTFOLIO_AI_PROPOSAL_ENABLED)+key(ANTHROPIC_API_KEY) 이중 게이트 →
//     둘 중 하나라도 미충족 시 getActiveShortList/callPortfolioProposal 미호출(cost 0) → proposal_disabled.
//   - active shortlist < 30 → shortlist_incomplete.
//   - callPortfolioProposal에 month=YYYY-MM(slice) + summary + costClient 주입.
//   - positions ⊆ active shortlist ticker (universe) — 위반 → portfolio_proposal_unknown_ticker.
//   - 영속/Accept 무변경 — 본 액션은 proposal 반환만.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DeltaStatus, ShortListItem } from "@/types/admin";

const {
  getUserMock,
  rpcMock,
  getShortlistMock,
  callProposalMock,
  isCostLoggingMock,
  preflightMock,
  SESSION_CLIENT,
} = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const rpcMock = vi.fn();
  return {
    getUserMock,
    rpcMock,
    getShortlistMock: vi.fn(),
    callProposalMock: vi.fn(),
    isCostLoggingMock: vi.fn(),
    preflightMock: vi.fn(),
    SESSION_CLIENT: { auth: { getUser: getUserMock }, rpc: rpcMock },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(SESSION_CLIENT),
}));
vi.mock("@/lib/data/admin-shortlist", () => ({
  getActiveShortList: getShortlistMock,
}));
// R19 HIGH (omxy) — cost master guard: isCostLoggingEnabled() + preflightHardcap 게이트.
vi.mock("@/lib/cost/cost-logger", () => ({
  isCostLoggingEnabled: isCostLoggingMock,
  preflightHardcap: preflightMock,
}));
// callPortfolioProposal만 mock — renderPortfolioShortlistSummary는 real(액션이 실제 요약 빌드).
vi.mock("@/lib/ai/portfolio-proposal-client", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, callPortfolioProposal: callProposalMock };
});

import { proposePortfolio } from "../actions";

function makeItem(i: number, deltaStatus: DeltaStatus = "hold"): ShortListItem {
  const ticker = String(i + 1).padStart(6, "0");
  return {
    id: `id-${ticker}`,
    month: "2026-06-01",
    ticker,
    name: `종목${i + 1}`,
    sector: "반도체",
    bucket: "long",
    rank: i + 1,
    compositeScore: 70,
    trendScore: 70,
    momentumScore: 70,
    volatilityScore: 70,
    divergencePct: 1,
    sparkline7d: [1, 2, 3, 4, 5, 6, 7],
    signalLabel: "x",
    deltaStatus,
    deltaReason: "x",
    summary3Line: "x",
    suggestedWeight: 0.033,
    createdAt: "2026-06-01T00:00:00Z",
    consensusBadge: "🟢",
    aiScore: 78,
    winningTimeframe: "long",
    conviction: 70,
  };
}
function makeShortlist(n = 30): ShortListItem[] {
  return Array.from({ length: n }, (_, i) => makeItem(i));
}

const VALID_PROPOSAL = {
  positions: [
    { ticker: "000001", weight: 0.5, timeframe: "long" as const },
    { ticker: "000002", weight: 0.3, timeframe: "mid" as const },
  ],
  cashWeight: 0.2,
  rationale_kr: "확신 종목 집중 + 현금 20% 방어",
};

beforeEach(() => {
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: "admin-uid" } }, error: null });
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: true, error: null });
  getShortlistMock.mockReset();
  getShortlistMock.mockResolvedValue(makeShortlist(30));
  callProposalMock.mockReset();
  callProposalMock.mockResolvedValue(VALID_PROPOSAL);
  isCostLoggingMock.mockReset();
  isCostLoggingMock.mockReturnValue(true);
  preflightMock.mockReset();
  preflightMock.mockResolvedValue({ currentTotal: 0, reservation: 1, remaining: 499999 });
  process.env.PORTFOLIO_AI_PROPOSAL_ENABLED = "true";
  process.env.ANTHROPIC_API_KEY = "sk-test";
});

describe("proposePortfolio", () => {
  it("non-string month → invalid_input (client 미호출)", async () => {
    // @ts-expect-error runtime validation
    const res = await proposePortfolio({ month: 202606 });
    expect(res).toEqual({ success: false, error: "invalid_input" });
    expect(getShortlistMock).not.toHaveBeenCalled();
    expect(callProposalMock).not.toHaveBeenCalled();
  });

  it("YYYY-MM(비 YYYY-MM-01) → invalid_month", async () => {
    const res = await proposePortfolio({ month: "2026-06" });
    expect(res).toEqual({ success: false, error: "invalid_month" });
    expect(getShortlistMock).not.toHaveBeenCalled();
    expect(callProposalMock).not.toHaveBeenCalled();
  });

  it("미인증(user null) → auth_unavailable (is_admin/shortlist/call 미호출)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: false, error: "auth_unavailable" });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(getShortlistMock).not.toHaveBeenCalled();
    expect(callProposalMock).not.toHaveBeenCalled();
  });

  it("비-admin(is_admin false) → admin_required (shortlist/call 미호출)", async () => {
    rpcMock.mockResolvedValueOnce({ data: false, error: null });
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: false, error: "admin_required" });
    expect(getShortlistMock).not.toHaveBeenCalled();
    expect(callProposalMock).not.toHaveBeenCalled();
  });

  it("is_admin RPC error → admin_required (fail-closed)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "PGRST301" } });
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: false, error: "admin_required" });
    expect(callProposalMock).not.toHaveBeenCalled();
  });

  it("flag off + key 존재 → proposal_disabled (shortlist/call 미호출, cost 0)", async () => {
    process.env.PORTFOLIO_AI_PROPOSAL_ENABLED = "false";
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: false, error: "proposal_disabled" });
    expect(getShortlistMock).not.toHaveBeenCalled();
    expect(callProposalMock).not.toHaveBeenCalled();
  });

  it("flag on + key 부재 → proposal_disabled (shortlist/call 미호출, behavior-neutral)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: false, error: "proposal_disabled" });
    expect(getShortlistMock).not.toHaveBeenCalled();
    expect(callProposalMock).not.toHaveBeenCalled();
  });

  it("flag on + key + admin + shortlist 30 → proposal 반환 (call 1회 + month slice + DI)", async () => {
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: true, data: { proposal: VALID_PROPOSAL } });
    expect(getShortlistMock).toHaveBeenCalledWith({
      month: "2026-06-01",
      client: SESSION_CLIENT,
    });
    expect(callProposalMock).toHaveBeenCalledTimes(1);
    const arg = callProposalMock.mock.calls[0][0] as {
      month: string;
      shortlistSummary: string;
      adminUserId: string;
      costClient: unknown;
    };
    expect(arg.month).toBe("2026-06"); // YYYY-MM-01 → slice(0,7)
    expect(arg.adminUserId).toBe("admin-uid");
    expect(arg.costClient).toBe(SESSION_CLIENT);
    expect(arg.shortlistSummary).toContain("000001");
    expect(arg.shortlistSummary).toContain("종목1");
    // R19 HIGH — preflightHardcap이 AI 호출 전 1회(month YYYY-MM + admin session client).
    expect(preflightMock).toHaveBeenCalledTimes(1);
    const pf = preflightMock.mock.calls[0];
    expect(pf[0].month).toBe("2026-06");
    expect(pf[0].lines).toHaveLength(1);
    expect(pf[1]).toEqual({ client: SESSION_CLIENT });
  });

  it("R19 HIGH — cost logging off → cost_logging_disabled (shortlist/preflight/call 미호출)", async () => {
    isCostLoggingMock.mockReturnValueOnce(false);
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: false, error: "cost_logging_disabled" });
    expect(getShortlistMock).not.toHaveBeenCalled();
    expect(preflightMock).not.toHaveBeenCalled();
    expect(callProposalMock).not.toHaveBeenCalled();
  });

  it("R19 HIGH — hardcap 초과(preflight throw) → cost_hardcap_exceeded (callPortfolioProposal 미호출)", async () => {
    preflightMock.mockRejectedValueOnce(new Error("cost_hardcap_exceeded"));
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: false, error: "cost_hardcap_exceeded" });
    expect(callProposalMock).not.toHaveBeenCalled();
  });

  it("active shortlist < 30(removed 제외) → shortlist_incomplete (preflight/call 미호출)", async () => {
    const list = makeShortlist(30);
    list[0].deltaStatus = "removed"; // active 29
    getShortlistMock.mockResolvedValueOnce(list);
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: false, error: "shortlist_incomplete" });
    expect(preflightMock).not.toHaveBeenCalled();
    expect(callProposalMock).not.toHaveBeenCalled();
  });

  it("R19 MED — active shortlist > 30(31개) → shortlist_incomplete (exact-30, call 미호출)", async () => {
    getShortlistMock.mockResolvedValueOnce(makeShortlist(31));
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: false, error: "shortlist_incomplete" });
    expect(preflightMock).not.toHaveBeenCalled();
    expect(callProposalMock).not.toHaveBeenCalled();
  });

  it("getActiveShortList throw → shortlist_lookup_failed", async () => {
    getShortlistMock.mockRejectedValueOnce(new Error("db down"));
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: false, error: "shortlist_lookup_failed" });
    expect(callProposalMock).not.toHaveBeenCalled();
  });

  it("proposal positions에 shortlist 밖 ticker → portfolio_proposal_unknown_ticker", async () => {
    callProposalMock.mockResolvedValueOnce({
      positions: [{ ticker: "999999", weight: 1, timeframe: "long" }],
      cashWeight: 0,
      rationale_kr: "x",
    });
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: false, error: "portfolio_proposal_unknown_ticker" });
  });

  it("callPortfolioProposal throw(parse 등) → error 코드 passthrough", async () => {
    callProposalMock.mockRejectedValueOnce(
      new Error("portfolio_proposal_parse_failed:positions"),
    );
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({
      success: false,
      error: "portfolio_proposal_parse_failed:positions",
    });
  });
});
