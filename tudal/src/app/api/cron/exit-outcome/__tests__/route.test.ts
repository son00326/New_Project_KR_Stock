import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AlertEvent } from "@/types/admin";

const flagsMock = vi.hoisted(() => ({ isExitOutcomeEnabled: vi.fn() }));
const alertsMock = vi.hoisted(() => ({ getDueExitOutcomeAlerts: vi.fn() }));
const krxMock = vi.hoisted(() => ({ resolveEntryPricesKrw: vi.fn() }));
const srMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  client: null as unknown,
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/intraday/flags", () => ({
  isExitOutcomeEnabled: flagsMock.isExitOutcomeEnabled,
}));
vi.mock("@/lib/data/admin-alerts", () => ({
  getDueExitOutcomeAlerts: alertsMock.getDueExitOutcomeAlerts,
}));
vi.mock("@/lib/data/krx-eod", () => ({
  resolveEntryPricesKrw: krxMock.resolveEntryPricesKrw,
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: srMock.createServiceRoleClient,
}));

function alert(overrides: Partial<AlertEvent> = {}): AlertEvent {
  return {
    id: "a1",
    alertType: "exit_signal",
    ticker: "005930",
    severity: "critical",
    triggerReason: "exit",
    signalSentAt: "2026-06-12T10:00:00Z",
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
    isRead: false,
    ...overrides,
  };
}

const req = () =>
  new NextRequest("http://localhost/api/cron/exit-outcome", {
    headers: { authorization: "Bearer cron-secret" },
  });

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-secret";
  process.env.KRX_OPENAPI_KEY = "krx-key";
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "");
  srMock.client = { rpc: srMock.rpc };
  srMock.createServiceRoleClient.mockReturnValue(srMock.client);
  srMock.rpc.mockResolvedValue({ error: null });
  flagsMock.isExitOutcomeEnabled.mockReturnValue(true);
  alertsMock.getDueExitOutcomeAlerts.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  delete process.env.KRX_OPENAPI_KEY;
});

describe("GET /api/cron/exit-outcome", () => {
  it("rejects unauthorized", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/api/cron/exit-outcome"),
    );
    expect(res.status).toBe(401);
  });

  it("flag off → 200 skip, no service-role client, no RPC, no alert fetch", async () => {
    flagsMock.isExitOutcomeEnabled.mockReturnValue(false);
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(body.skipped).toBe("flag_off");
    expect(body.processed).toBe(0);
    expect(srMock.createServiceRoleClient).not.toHaveBeenCalled();
    expect(alertsMock.getDueExitOutcomeAlerts).not.toHaveBeenCalled();
    expect(srMock.rpc).not.toHaveBeenCalled();
  });

  it("no KRX key → 200 skip, no client/RPC", async () => {
    delete process.env.KRX_OPENAPI_KEY;
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(body.skipped).toBe("no_krx_key");
    expect(srMock.createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("0 due → processed 0", async () => {
    alertsMock.getDueExitOutcomeAlerts.mockResolvedValue([]);
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(body.processed).toBe(0);
    expect(body.due).toBe(0);
    expect(srMock.rpc).not.toHaveBeenCalled();
  });

  it("happy path: due alert → RPC record_alert_exit_outcome with computed t7Pct", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T10:00:00Z")); // 19:00 KST (cutoff 후)
    alertsMock.getDueExitOutcomeAlerts.mockResolvedValue([
      alert({ signalSentAt: "2026-06-12T10:00:00Z" }), // 8d 전
    ]);
    krxMock.resolveEntryPricesKrw.mockImplementation(
      async (_tickers: string[], deps: { basDd: string }) =>
        new Map([["005930", deps.basDd === "20260612" ? 100000 : 107000]]),
    );
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(body.processed).toBe(1);
    expect(srMock.rpc).toHaveBeenCalledWith("record_alert_exit_outcome", {
      p_alert_id: "a1",
      p_t7_price_change: 7,
      p_outcome_at: expect.any(String),
    });
  });

  it("close-ready guard: T+7 anchor == today before cutoff → notReady, no RPC", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T05:00:00Z")); // 14:00 KST (cutoff 18 전)
    alertsMock.getDueExitOutcomeAlerts.mockResolvedValue([
      alert({ signalSentAt: "2026-06-13T05:00:00Z" }), // 7d 전, t7 = 오늘
    ]);
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(body.notReady).toBe(1);
    expect(body.processed).toBe(0);
    expect(srMock.rpc).not.toHaveBeenCalled();
    expect(krxMock.resolveEntryPricesKrw).not.toHaveBeenCalled();
  });

  it("price missing → skipped (fail-soft), no RPC", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T10:00:00Z"));
    alertsMock.getDueExitOutcomeAlerts.mockResolvedValue([
      alert({ signalSentAt: "2026-06-12T10:00:00Z" }),
    ]);
    krxMock.resolveEntryPricesKrw.mockResolvedValue(new Map()); // no price
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(body.skipped).toBe(1);
    expect(body.processed).toBe(0);
    expect(srMock.rpc).not.toHaveBeenCalled();
  });

  it("RPC failure → 500 with sanitized code, not a successful price skip", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T10:00:00Z"));
    alertsMock.getDueExitOutcomeAlerts.mockResolvedValue([
      alert({ signalSentAt: "2026-06-12T10:00:00Z" }),
    ]);
    krxMock.resolveEntryPricesKrw.mockImplementation(
      async (_tickers: string[], deps: { basDd: string }) =>
        new Map([["005930", deps.basDd === "20260612" ? 100000 : 107000]]),
    );
    srMock.rpc.mockResolvedValueOnce({ error: { code: "42883", message: "missing rpc" } });
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.processed).toBe(0);
    expect(body.skipped).toBe(0);
    expect(body.rpcFailed).toBe(1);
    expect(body.rpcErrorCodes).toEqual(["42883"]);
  });

  it("uses DB-level due helper with limit (starvation 방지)", async () => {
    const { GET } = await import("../route");
    await GET(req());
    expect(alertsMock.getDueExitOutcomeAlerts).toHaveBeenCalledWith({
      client: srMock.client,
      limit: 500,
    });
  });
});
