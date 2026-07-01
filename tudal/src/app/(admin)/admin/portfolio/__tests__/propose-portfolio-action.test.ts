// W3b-1/W3b-2a (D26 Q2) — proposePortfolio admin server action tests.
//   W3b-1 게이트(auth/admin/flag/key/cost-log/shortlist/hardcap/universe) + W3b-2a persist 게이트.
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
  assertReadyMock,
  upsertProposalMock,
  hasRiskDebateMock,
  insertRiskDebateMock,
  callRiskDebatorMock,
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
    assertReadyMock: vi.fn(),
    upsertProposalMock: vi.fn(),
    hasRiskDebateMock: vi.fn(),
    insertRiskDebateMock: vi.fn(),
    callRiskDebatorMock: vi.fn(),
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
// W3b-2a — portfolio_proposal 영속 helper.
vi.mock("@/lib/data/admin-proposals", () => ({
  assertProposalPersistenceReady: assertReadyMock,
  upsertProposalRpc: upsertProposalMock,
}));
vi.mock("@/lib/data/admin-risk-debate", () => ({
  hasRiskDebateAssessment: hasRiskDebateMock,
  insertRiskDebateAssessment: insertRiskDebateMock,
}));
vi.mock("@/lib/risk/risk-debate-client", () => ({
  callRiskDebator: callRiskDebatorMock,
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
  callProposalMock.mockImplementation(async (input: {
    onResolvedBinding?: (binding: { model: string; providerId: string }) => void;
  }) => {
    input.onResolvedBinding?.({ model: "claude-opus-4-8", providerId: "anthropic" });
    return VALID_PROPOSAL;
  });
  isCostLoggingMock.mockReset();
  isCostLoggingMock.mockReturnValue(true);
  preflightMock.mockReset();
  preflightMock.mockResolvedValue({ currentTotal: 0, reservation: 1, remaining: 499999 });
  assertReadyMock.mockReset();
  assertReadyMock.mockResolvedValue(undefined);
  upsertProposalMock.mockReset();
  upsertProposalMock.mockResolvedValue({ id: "prop-1", createdAt: "2026-06-05T00:00:00Z" });
  hasRiskDebateMock.mockReset();
  hasRiskDebateMock.mockResolvedValue(false);
  insertRiskDebateMock.mockReset();
  insertRiskDebateMock.mockResolvedValue(undefined);
  callRiskDebatorMock.mockReset();
  callRiskDebatorMock.mockResolvedValue({
    concern_level: "low",
    key_risks: [],
    verdict_vote: "pass",
  });
  process.env.PORTFOLIO_AI_PROPOSAL_ENABLED = "true";
  process.env.ANTHROPIC_API_KEY = "sk-test";
  // 항목1 — portfolio 게이트는 이제 provider-agnostic(GLM primary → Claude fallback).
  //   ambient env(.env.local) OPENROUTER/OPENAI 격리해 "키 부재" 게이트 판정 결정론화.
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.PORTFOLIO_PROPOSAL_PERSIST_ENABLED; // default off (W3b-1 동작)
  delete process.env.RISK_DEBATE_ENABLED;
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

  it("flag on + provider 전무(ANTHROPIC/OPENROUTER 부재) → proposal_disabled (shortlist/call 미호출, behavior-neutral)", async () => {
    delete process.env.ANTHROPIC_API_KEY; // beforeEach가 OPENROUTER/OPENAI도 이미 delete → GLM primary·Claude fallback 모두 부재
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: false, error: "proposal_disabled" });
    expect(getShortlistMock).not.toHaveBeenCalled();
    expect(callProposalMock).not.toHaveBeenCalled();
  });

  it("항목1: flag on + ANTHROPIC 부재 + OPENROUTER 존재 → 게이트 통과(proposal_disabled 아님, GLM primary 가용)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENROUTER_API_KEY = "openrouter-test-key";
    const res = await proposePortfolio({ month: "2026-06-01" });
    // GLM primary 가용 → key 게이트 통과. (이후 isCostLoggingEnabled/shortlist 등 downstream 게이트로 진행)
    expect(res).not.toEqual({ success: false, error: "proposal_disabled" });
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
    // W3b-2a — persist flag off(default) → 영속 helper 미호출 (W3b-1 동작 1:1).
    expect(assertReadyMock).not.toHaveBeenCalled();
    expect(upsertProposalMock).not.toHaveBeenCalled();
    expect(hasRiskDebateMock).not.toHaveBeenCalled();
    expect(callRiskDebatorMock).not.toHaveBeenCalled();
    expect(insertRiskDebateMock).not.toHaveBeenCalled();
  });

  it("G3 flag on → proposal composition triggers one advisory risk debate after portfolio AI", async () => {
    process.env.RISK_DEBATE_ENABLED = "true";
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: true, data: { proposal: VALID_PROPOSAL } });
    expect(hasRiskDebateMock).toHaveBeenCalledWith("2026-06-01", {
      client: SESSION_CLIENT,
    });
    expect(preflightMock).toHaveBeenCalledTimes(2);
    expect(preflightMock.mock.calls[1][0].month).toBe("2026-06");
    expect(preflightMock.mock.calls[1][0].lines[0].callCount).toBe(3);
    expect(callRiskDebatorMock).toHaveBeenCalledTimes(3);
    expect(insertRiskDebateMock).toHaveBeenCalledTimes(1);
    const payload = insertRiskDebateMock.mock.calls[0][0];
    expect(payload.month).toBe("2026-06-01");
    expect(payload.finalVerdict).toBe("pass");
    expect(payload.votes).toHaveLength(3);
  });

  it("G3 advisory failure does not block portfolio proposal success", async () => {
    process.env.RISK_DEBATE_ENABLED = "true";
    insertRiskDebateMock.mockRejectedValueOnce(new Error("risk_debate_insert_failed:42501"));
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: true, data: { proposal: VALID_PROPOSAL } });
  });

  it("W3b-2a — persist flag on → assertReady(AI 前) + upsertProposalRpc 후 data.proposalId 반환", async () => {
    process.env.PORTFOLIO_PROPOSAL_PERSIST_ENABLED = "true";
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({
      success: true,
      data: { proposal: VALID_PROPOSAL, proposalId: "prop-1" },
    });
    expect(assertReadyMock).toHaveBeenCalledWith({ client: SESSION_CLIENT });
    expect(upsertProposalMock).toHaveBeenCalledTimes(1);
    const up = upsertProposalMock.mock.calls[0][0] as {
      month: string;
      proposal: unknown;
      model: string;
      client: unknown;
    };
    expect(up.month).toBe("2026-06-01"); // 테이블 month=date(YYYY-MM-01), cost_log YYYY-MM과 구분
    expect(up.proposal).toEqual(VALID_PROPOSAL);
    expect(up.model).toBe("claude-opus-4-8");
    expect(up.client).toBe(SESSION_CLIENT);
  });

  it("W3b-2a — persist on + assertReady throw(schema missing) → proposal_schema_missing + AI 호출 0", async () => {
    process.env.PORTFOLIO_PROPOSAL_PERSIST_ENABLED = "true";
    assertReadyMock.mockRejectedValueOnce(new Error("proposal_schema_missing"));
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: false, error: "proposal_schema_missing" });
    // 유료 제안 유실 방지 — assertReady가 AI 호출 前이라 callPortfolioProposal/preflight 0.
    expect(callProposalMock).not.toHaveBeenCalled();
    expect(preflightMock).not.toHaveBeenCalled();
    expect(upsertProposalMock).not.toHaveBeenCalled();
  });

  it("W3b-2a — persist on + post-AI upsert throw(persist_failed) → fail-closed (callPortfolioProposal 1회)", async () => {
    process.env.PORTFOLIO_PROPOSAL_PERSIST_ENABLED = "true";
    upsertProposalMock.mockRejectedValueOnce(new Error("proposal_persist_failed:23514"));
    const res = await proposePortfolio({ month: "2026-06-01" });
    expect(res).toEqual({ success: false, error: "proposal_persist_failed:23514" });
    expect(callProposalMock).toHaveBeenCalledTimes(1); // AI는 이미 호출됨(정책상 fail-closed)
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
