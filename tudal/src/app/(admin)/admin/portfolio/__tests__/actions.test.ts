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
  // W2a Task 9.5: getActiveShortList를 override 가능한 vi.fn으로 — <30 거부 시나리오 구성.
  getActiveShortList: vi.fn(),
  // W3a: KRX EOD 모듈 mock.
  resolveLatestCompletedTradingDay: vi.fn(),
  resolveEntryPricesKrw: vi.fn(),
  loadKrBusinessDays: vi.fn(),
  acceptShortlistRpc: vi.fn(),
  // W3b-2b: proposal 소비(getProposalByMonth). 기본 null(미존재 → suggestedWeight fallback).
  getProposalByMonth: vi.fn(),
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
  acceptShortlistRpc: mocks.acceptShortlistRpc,
}));

vi.mock("@/lib/data/admin-snapshots", () => ({
  insertPortfolioSnapshots: mocks.insertPortfolioSnapshots,
}));

// W3b-2b — admin-proposals mock(getProposalByMonth만 acceptShortList가 소비). assert/upsert는 proposePortfolio
//   전용이라 본 파일 미사용이나 모듈 mock 완전성 위해 stub. buildSnapshotRowsFromProposal은 real(pure).
vi.mock("@/lib/data/admin-proposals", () => ({
  getProposalByMonth: (...a: unknown[]) => mocks.getProposalByMonth(...a),
  assertProposalPersistenceReady: vi.fn(),
  upsertProposalRpc: vi.fn(),
}));

vi.mock("@/lib/data/admin-report-view-log", () => ({
  getDistinctViewerCountsByTicker: mocks.getDistinctViewerCountsByTicker,
}));

// T7e.2: admin-shortlist는 Supabase 실 SELECT라 테스트에서는 mock fixture로 우회.
// month 인자에 매칭되는 mock 행만 반환하여 기존 테스트 시나리오를 유지한다.
// W2a Task 9.5: per-test override 가능한 hoisted vi.fn (기본 구현은 beforeEach에서 month 필터 적용).
vi.mock("@/lib/data/admin-shortlist", () => ({
  getActiveShortList: (...a: unknown[]) => mocks.getActiveShortList(...a),
}));

// W3a — KRX EOD module mock (실 외부 호출 0). resolveLatestCompletedTradingDay는 결정적 거래일 stub,
//   resolveEntryPricesKrw는 per-test 가격 Map override.
vi.mock("@/lib/data/krx-eod", () => ({
  resolveLatestCompletedTradingDay: (...a: unknown[]) =>
    mocks.resolveLatestCompletedTradingDay(...a),
  resolveEntryPricesKrw: (...a: unknown[]) => mocks.resolveEntryPricesKrw(...a),
}));

vi.mock("@/lib/portfolio/calendar", async () => {
  const actual = await vi.importActual<typeof import("@/lib/portfolio/calendar")>(
    "@/lib/portfolio/calendar",
  );
  return {
    ...actual,
    loadKrBusinessDays: (...a: unknown[]) => mocks.loadKrBusinessDays(...a),
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

beforeEach(async () => {
  vi.clearAllMocks();
  // W2a Task 9.5: 기본 getActiveShortList = month 필터 fixture (기존 static mock 동등 — month당 30 active).
  const { MOCK_ADMIN_SHORTLIST } = await import(
    "@/lib/data/mock-admin-shortlist"
  );
  mocks.getActiveShortList.mockImplementation(
    async (options?: { month?: string }) => {
      if (!options?.month) return MOCK_ADMIN_SHORTLIST;
      return MOCK_ADMIN_SHORTLIST.filter(
        (item) => item.month === options.month,
      );
    },
  );
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
  // W3a 기본: 거래일 stub + acceptShortlistRpc 성공. resolveEntryPricesKrw는 per-test override
  //   (기본 빈 Map — flag-off 테스트는 도달 안 함).
  const { MOCK_KR_BUSINESS_DAYS_2026 } = await import("@/lib/portfolio/calendar");
  mocks.loadKrBusinessDays.mockResolvedValue(MOCK_KR_BUSINESS_DAYS_2026);
  mocks.resolveLatestCompletedTradingDay.mockReturnValue("20260417");
  mocks.resolveEntryPricesKrw.mockResolvedValue(new Map());
  mocks.acceptShortlistRpc.mockResolvedValue({
    approvalId: "33333333-3333-3333-3333-333333333333",
    isFinal: true,
  });
  // W3b-2b: 기본 proposal 미존재(null) → suggestedWeight fallback(USE flag off 시엔 호출도 안 됨).
  mocks.getProposalByMonth.mockResolvedValue(null);
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

  // W2a Task 9.5 (R3 HIGH-2): 트랙 split로 일시 <30 가능 → 부분 리스트가 snapshot에 진입하면 포트 오염.
  //   빈 리스트만 거부하던 가드를 length<30 거부로 강화 (정상 30 경로는 무회귀).
  it("blocks accept when the active shortlist has fewer than 30 rows (partial list pollution guard)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));
    // 20행만 active (mid/long 일부) — short 트랙 미반영 상태 시뮬레이션.
    const { MOCK_ADMIN_SHORTLIST } = await import(
      "@/lib/data/mock-admin-shortlist"
    );
    const partial = MOCK_ADMIN_SHORTLIST.filter(
      (item) => item.month === "2026-04-01" && item.deltaStatus !== "removed",
    ).slice(0, 20);
    mocks.getActiveShortList.mockResolvedValue(partial);
    const { acceptShortList } = await import("../actions");

    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("shortlist_incomplete");
    expect(mocks.createPortfolioApproval).not.toHaveBeenCalled();
    expect(mocks.insertPortfolioSnapshots).not.toHaveBeenCalled();
  });

  it("fails closed before mutating approvals when real entry prices are unavailable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));
    vi.stubEnv("KRX_OPENAPI_KEY", "krx-existing-prod-key");
    const { acceptShortList } = await import("../actions");

    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("entry_price_unavailable");
    expect(mocks.loadKrBusinessDays).not.toHaveBeenCalled();
    expect(mocks.resolveLatestCompletedTradingDay).not.toHaveBeenCalled();
    expect(mocks.resolveEntryPricesKrw).not.toHaveBeenCalled();
    expect(mocks.createPortfolioApproval).not.toHaveBeenCalled();
    expect(mocks.insertPortfolioSnapshots).not.toHaveBeenCalled();
  });

  // W3a — entry_price 실배선 (KRX EOD). 기본 flag-off는 위 "unavailable" 테스트가 커버(무회귀).
  it("flag on + KRX_OPENAPI_KEY 부재 → entry_price_unavailable (KRX 미호출)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));
    vi.stubEnv("PORTFOLIO_REAL_ENTRY_PRICE_ENABLED", "true");
    // KRX_OPENAPI_KEY 미설정
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("entry_price_unavailable");
    expect(mocks.loadKrBusinessDays).not.toHaveBeenCalled();
    expect(mocks.resolveLatestCompletedTradingDay).not.toHaveBeenCalled();
    expect(mocks.resolveEntryPricesKrw).not.toHaveBeenCalled();
    expect(mocks.acceptShortlistRpc).not.toHaveBeenCalled();
  });

  it("flag on + blank KRX_OPENAPI_KEY → entry_price_unavailable (KRX 미호출)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));
    vi.stubEnv("PORTFOLIO_REAL_ENTRY_PRICE_ENABLED", "true");
    vi.stubEnv("KRX_OPENAPI_KEY", "   ");
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("entry_price_unavailable");
    expect(mocks.loadKrBusinessDays).not.toHaveBeenCalled();
    expect(mocks.resolveEntryPricesKrw).not.toHaveBeenCalled();
    expect(mocks.acceptShortlistRpc).not.toHaveBeenCalled();
  });

  it("flag on + key + 전 ticker 종가 → 실 entryPrice로 snapshot 영속 (acceptShortlistRpc 호출)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));
    vi.stubEnv("PORTFOLIO_REAL_ENTRY_PRICE_ENABLED", "true");
    vi.stubEnv("KRX_OPENAPI_KEY", "krx-test-key");
    // 모든 요청 ticker에 종가 71200 반환.
    mocks.resolveEntryPricesKrw.mockImplementation(async (tickers: string[]) =>
      new Map(tickers.map((t) => [t, 71200])),
    );
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
    expect(mocks.loadKrBusinessDays).toHaveBeenCalledTimes(1);
    expect(mocks.resolveLatestCompletedTradingDay).toHaveBeenCalledTimes(1);
    expect(mocks.resolveEntryPricesKrw).toHaveBeenCalledTimes(1);
    // resolveEntryPricesKrw 2번째 인자에 authKey/basDd 전달
    const callArgs = mocks.resolveEntryPricesKrw.mock.calls[0];
    expect(callArgs[1]).toMatchObject({ authKey: "krx-test-key", basDd: "20260417" });
    // acceptShortlistRpc snapshots에 실 entryPrice (집계행 ticker=null 제외 전부 71200)
    const rpcArg = mocks.acceptShortlistRpc.mock.calls[0][0];
    const equitySnaps = rpcArg.snapshots.filter((s: { ticker: string | null }) => s.ticker !== null);
    expect(equitySnaps.length).toBeGreaterThan(0);
    expect(equitySnaps.every((s: { entryPrice: number; currentPrice: number }) => s.entryPrice === 71200 && s.currentPrice === 71200)).toBe(true);
  });

  it("flag on + key + 1 ticker 누락 → 전체 entry_price_unavailable (부분 snapshot 금지)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));
    vi.stubEnv("PORTFOLIO_REAL_ENTRY_PRICE_ENABLED", "true");
    vi.stubEnv("KRX_OPENAPI_KEY", "krx-test-key");
    // 첫 ticker만 누락(Map에서 제외).
    mocks.resolveEntryPricesKrw.mockImplementation(async (tickers: string[]) =>
      new Map(tickers.slice(1).map((t) => [t, 50000])),
    );
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("entry_price_unavailable");
    expect(mocks.acceptShortlistRpc).not.toHaveBeenCalled();
  });

  it("flag on + key + KRX fetch throw → entry_price_unavailable (accept 트랜잭션 미시작)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));
    vi.stubEnv("PORTFOLIO_REAL_ENTRY_PRICE_ENABLED", "true");
    vi.stubEnv("KRX_OPENAPI_KEY", "krx-test-key");
    mocks.resolveEntryPricesKrw.mockRejectedValue(new Error("krx_eod_fetch_failed:503"));
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("entry_price_unavailable");
    expect(mocks.acceptShortlistRpc).not.toHaveBeenCalled();
  });

  it("flag on + key + 거래일 stale(null) → entry_price_unavailable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));
    vi.stubEnv("PORTFOLIO_REAL_ENTRY_PRICE_ENABLED", "true");
    vi.stubEnv("KRX_OPENAPI_KEY", "krx-test-key");
    mocks.resolveLatestCompletedTradingDay.mockReturnValue(null);
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("entry_price_unavailable");
    expect(mocks.resolveEntryPricesKrw).not.toHaveBeenCalled();
  });

  // ---- W3b-2b: Accept가 영속 proposal weight로 snapshot 구성 (money-path) ----
  // 공통: entry_price flag+key on(snapshot은 항상 entry_price 필요), resolveEntryPricesKrw는 요청 ticker에 가격.
  function stubAcceptEnv() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));
    vi.stubEnv("PORTFOLIO_REAL_ENTRY_PRICE_ENABLED", "true");
    vi.stubEnv("KRX_OPENAPI_KEY", "krx-test-key");
    mocks.resolveEntryPricesKrw.mockImplementation(async (tickers: string[]) =>
      new Map(tickers.map((t) => [t, 71200])),
    );
  }
  const VALID_PERSISTED = {
    id: "prop-1",
    month: "2026-04-01",
    model: "claude-opus-4-8",
    createdBy: "admin-test-1",
    createdAt: "2026-04-19T00:00:00.000Z",
    updatedAt: "2026-04-19T00:00:00.000Z",
    proposal: {
      positions: [
        { ticker: "005930", weight: 0.6, timeframe: "long" as const },
        { ticker: "000660", weight: 0.2, timeframe: "mid" as const },
      ],
      cashWeight: 0.2,
      rationale_kr: "반도체 집중 + 현금 20%",
    },
  };

  it("USE flag off(default) → getProposalByMonth 미호출 + suggestedWeight 경로(전체 shortlist snapshot)", async () => {
    stubAcceptEnv();
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
    expect(mocks.getProposalByMonth).not.toHaveBeenCalled();
    // suggestedWeight 경로 = 전체 active shortlist(>2종) snapshot.
    const equity = mocks.acceptShortlistRpc.mock.calls[0][0].snapshots.filter(
      (s: { ticker: string | null }) => s.ticker !== null,
    );
    expect(equity.length).toBeGreaterThan(2);
  });

  it("USE flag on + proposal valid(positions⊆active) → proposal weight snapshot(편입 종목만 + aggregate)", async () => {
    stubAcceptEnv();
    vi.stubEnv("PORTFOLIO_USE_PROPOSAL_ENABLED", "true");
    mocks.getProposalByMonth.mockResolvedValue(VALID_PERSISTED);
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
    expect(mocks.getProposalByMonth).toHaveBeenCalledWith({ month: "2026-04-01" });
    const snaps = mocks.acceptShortlistRpc.mock.calls[0][0].snapshots;
    const equity = snaps.filter((s: { ticker: string | null }) => s.ticker !== null);
    // 편입 2종목만(+aggregate) — 전체 shortlist 아님.
    expect(equity).toHaveLength(2);
    const s = equity.find((r: { ticker: string }) => r.ticker === "005930");
    expect(s.weight).toBe(0.6); // proposal weight (suggestedWeight 아님)
    const agg = snaps.find((r: { ticker: string | null }) => r.ticker === null);
    expect(agg.weight).toBe(1);
    // entry_price fetch는 proposal 종목만(2개) 요청.
    expect(mocks.resolveEntryPricesKrw.mock.calls[0][0]).toEqual(["005930", "000660"]);
  });

  // ── W3b-2c — 명시 cash 행 emission (PORTFOLIO_EXPLICIT_CASH_ROW_ENABLED) ──
  it("W3b-2c: proposal 경로 + EXPLICIT_CASH on → snapshots에 cash 행(ticker=NULL, is_cash=true, weight=cashWeight) 포함", async () => {
    stubAcceptEnv();
    vi.stubEnv("PORTFOLIO_USE_PROPOSAL_ENABLED", "true");
    vi.stubEnv("PORTFOLIO_EXPLICIT_CASH_ROW_ENABLED", "true");
    mocks.getProposalByMonth.mockResolvedValue(VALID_PERSISTED);
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
    const snaps = mocks.acceptShortlistRpc.mock.calls[0][0].snapshots;
    const cash = snaps.find(
      (s: { ticker: string | null; is_cash?: boolean; isCash?: boolean }) =>
        s.ticker === null && (s.is_cash ?? s.isCash) === true,
    );
    expect(cash).toBeDefined();
    expect(cash.weight).toBe(0.2); // proposal.cashWeight
    // aggregate(ticker=NULL, is_cash=false)와 공존(별개 행).
    const agg = snaps.find(
      (s: { ticker: string | null; is_cash?: boolean; isCash?: boolean }) =>
        s.ticker === null && (s.is_cash ?? s.isCash) === false,
    );
    expect(agg.weight).toBe(1);
  });

  it("W3b-2c: proposal 경로 + EXPLICIT_CASH off(기본) → cash 행 없음(implicit, behavior-neutral)", async () => {
    stubAcceptEnv();
    vi.stubEnv("PORTFOLIO_USE_PROPOSAL_ENABLED", "true");
    // PORTFOLIO_EXPLICIT_CASH_ROW_ENABLED 미설정(off)
    mocks.getProposalByMonth.mockResolvedValue(VALID_PERSISTED);
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
    const snaps = mocks.acceptShortlistRpc.mock.calls[0][0].snapshots;
    const cash = snaps.find(
      (s: { is_cash?: boolean; isCash?: boolean }) => (s.is_cash ?? s.isCash) === true,
    );
    expect(cash).toBeUndefined();
  });

  it("W3b-2c (R33 HIGH): acceptShortlistRpc가 re-raise한 unique violation → accept_write_conflict (already_finalized 오표시 아님)", async () => {
    stubAcceptEnv();
    mocks.acceptShortlistRpc.mockRejectedValueOnce({ code: "23505" });
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("accept_write_conflict");
  });

  it("USE flag on + getProposalByMonth null → suggestedWeight fallback(success, 무브릭)", async () => {
    stubAcceptEnv();
    vi.stubEnv("PORTFOLIO_USE_PROPOSAL_ENABLED", "true");
    mocks.getProposalByMonth.mockResolvedValue(null);
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
    const equity = mocks.acceptShortlistRpc.mock.calls[0][0].snapshots.filter(
      (s: { ticker: string | null }) => s.ticker !== null,
    );
    expect(equity.length).toBeGreaterThan(2); // 전체 shortlist
  });

  it("USE flag on + 0034 미적용(proposal_schema_missing throw) → suggestedWeight fallback(기존 Accept 무브릭)", async () => {
    stubAcceptEnv();
    vi.stubEnv("PORTFOLIO_USE_PROPOSAL_ENABLED", "true");
    mocks.getProposalByMonth.mockRejectedValue(new Error("proposal_schema_missing"));
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true); // fail-closed 아님 — fallback
    expect(mocks.acceptShortlistRpc).toHaveBeenCalledTimes(1);
  });

  it("USE flag on + proposal stale(positions⊄active) → proposal_stale_for_month (accept 미시작)", async () => {
    stubAcceptEnv();
    vi.stubEnv("PORTFOLIO_USE_PROPOSAL_ENABLED", "true");
    mocks.getProposalByMonth.mockResolvedValue({
      ...VALID_PERSISTED,
      proposal: {
        ...VALID_PERSISTED.proposal,
        positions: [{ ticker: "999999", weight: 1, timeframe: "long" as const }], // shortlist 밖
      },
    });
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("proposal_stale_for_month");
    expect(mocks.acceptShortlistRpc).not.toHaveBeenCalled();
  });

  it("USE flag on + proposal 오염(parse_failed throw) → reject(raw throw 금지)", async () => {
    stubAcceptEnv();
    vi.stubEnv("PORTFOLIO_USE_PROPOSAL_ENABLED", "true");
    mocks.getProposalByMonth.mockRejectedValue(
      new Error("portfolio_proposal_parse_failed:cashWeight"),
    );
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/portfolio_proposal_parse_failed/);
    expect(mocks.acceptShortlistRpc).not.toHaveBeenCalled();
  });

  it("USE flag on + proposal valid + 1 proposal ticker 종가 누락 → entry_price_unavailable (proposal path 부분 snapshot 금지)", async () => {
    stubAcceptEnv();
    vi.stubEnv("PORTFOLIO_USE_PROPOSAL_ENABLED", "true");
    mocks.getProposalByMonth.mockResolvedValue(VALID_PERSISTED);
    // 000660만 종가 누락(005930만 반환) → buildSnapshotRowsFromProposal throw → 전체 거부.
    mocks.resolveEntryPricesKrw.mockImplementation(async (tickers: string[]) =>
      new Map(tickers.filter((t) => t === "005930").map((t) => [t, 71200])),
    );
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("entry_price_unavailable");
    expect(mocks.acceptShortlistRpc).not.toHaveBeenCalled();
  });

  it("USE flag on + 기타 SELECT 실패 → proposal_lookup_failed", async () => {
    stubAcceptEnv();
    vi.stubEnv("PORTFOLIO_USE_PROPOSAL_ENABLED", "true");
    mocks.getProposalByMonth.mockRejectedValue(new Error("proposal_persist_failed:42501"));
    const { acceptShortList } = await import("../actions");
    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("proposal_lookup_failed");
    expect(mocks.acceptShortlistRpc).not.toHaveBeenCalled();
  });

  // W2a Task 9.5 (R4 HIGH-3): mixed-cadence(오래된 mid + now() refresh short)에서 쿨다운 anchor가
  //   '첫 활성 행' createdAt(오래된 mid)이면 freshly-refreshed short가 24h Hold를 우회한다.
  //   → anchor를 가장 최근(MAX) createdAt으로 — 주간 refresh된 short가 hold_24h를 정확히 받는다.
  it("anchors the accept cooldown to the most recent row createdAt, not the first (stale) row", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T01:00:00.000Z"));
    const { MOCK_ADMIN_SHORTLIST } = await import(
      "@/lib/data/mock-admin-shortlist"
    );
    const active = MOCK_ADMIN_SHORTLIST.filter(
      (item) => item.month === "2026-04-01" && item.deltaStatus !== "removed",
    );
    // 첫 활성 행 = 오래된 mid/long(createdAt 2026-04-01, hold 만료). short 행은 주간 refresh(now() 직전).
    const mixed = active.map((item) =>
      item.bucket === "short"
        ? { ...item, createdAt: "2026-04-20T00:00:00.000Z" } // 1h 전 refresh → 24h 미경과
        : { ...item, createdAt: "2026-04-01T00:00:00.000Z" },
    );
    mocks.getActiveShortList.mockResolvedValue(mixed);
    const { acceptShortList } = await import("../actions");

    const result = await acceptShortList({
      month: "2026-04-01",
      shortlistGeneratedAt: "2026-04-01T00:00:00.000Z",
    });

    // anchor가 첫 행(오래된 mid)이면 hold 통과 → entry_price_unavailable까지 진행했을 것.
    // per-ticker(MAX) anchor면 refresh된 short의 24h Hold가 적용되어 hold_24h 차단.
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("accept_gate_blocked:hold_24h");
    expect(mocks.createPortfolioApproval).not.toHaveBeenCalled();
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
