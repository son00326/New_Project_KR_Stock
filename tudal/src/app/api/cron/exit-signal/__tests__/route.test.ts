import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PortfolioSnapshot, ShortListItem } from "@/types/admin";

const flagsMock = vi.hoisted(() => ({ isExitSignalEnabled: vi.fn() }));
const snapMock = vi.hoisted(() => ({ getCurrentHoldings: vi.fn() }));
const shortlistMock = vi.hoisted(() => ({ getActiveShortList: vi.fn() }));
const insertMock = vi.hoisted(() => ({ insertAlertEvents: vi.fn() }));
const telegramMock = vi.hoisted(() => ({ sendTelegram: vi.fn() }));
const srMock = vi.hoisted(() => ({
  client: { role: "service-role" },
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/intraday/flags", () => ({
  isExitSignalEnabled: flagsMock.isExitSignalEnabled,
}));
vi.mock("@/lib/data/admin-snapshots", () => ({
  getCurrentHoldings: snapMock.getCurrentHoldings,
}));
vi.mock("@/lib/data/admin-shortlist", () => ({
  getActiveShortList: shortlistMock.getActiveShortList,
}));
vi.mock("@/lib/data/admin-alerts-insert", () => ({
  insertAlertEvents: insertMock.insertAlertEvents,
}));
vi.mock("@/lib/notify/telegram", () => ({ sendTelegram: telegramMock.sendTelegram }));
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: srMock.createServiceRoleClient,
}));

function holding(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return {
    id: "s1",
    date: "2026-06-20",
    month: "2026-06-01",
    ticker: "005930",
    entryPrice: 100_000,
    currentPrice: 80_000, // -20% → momentum_break
    weight: 0.1,
    isCash: false,
    dailyReturn: 0,
    totalReturn: -0.2,
    kospiReturn: 0,
    alpha: 0,
    sharpe: 0,
    ...overrides,
  };
}

function shortItem(ticker: string, bucket: ShortListItem["bucket"]): ShortListItem {
  return {
    id: ticker,
    month: "2026-06-01",
    ticker,
    name: ticker,
    sector: "반도체",
    bucket,
    rank: 1,
    compositeScore: 50,
    trendScore: 50,
    momentumScore: 50,
    volatilityScore: 70,
    divergencePct: 0,
    sparkline7d: [],
    signalLabel: "",
    deltaStatus: "hold",
    deltaReason: "",
    summary3Line: "",
    suggestedWeight: 0.1,
    createdAt: "2026-06-01T00:00:00Z",
  };
}

const req = () =>
  new NextRequest("http://localhost/api/cron/exit-signal", {
    headers: { authorization: "Bearer cron-secret" },
  });

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  // 고정 시계 — holdingDays(month-start 2026-06-01 → now)가 wall-clock에 따라 커지면
  // 'mid' horizon(90d) time_expired가 ~2026-08-30부터 발동해 'no trigger' 테스트가 깨지는 time-bomb 방지.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-05T00:00:00Z")); // holdingDays ≈ 4 (< short 30 < mid 90)
  process.env.CRON_SECRET = "cron-secret";
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "");
  srMock.createServiceRoleClient.mockReturnValue(srMock.client as never);
  flagsMock.isExitSignalEnabled.mockReturnValue(true);
  snapMock.getCurrentHoldings.mockResolvedValue([]);
  shortlistMock.getActiveShortList.mockResolvedValue([]);
  insertMock.insertAlertEvents.mockResolvedValue(undefined);
  telegramMock.sendTelegram.mockResolvedValue({ success: true, mockMode: false });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("GET /api/cron/exit-signal", () => {
  it("rejects unauthorized", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/api/cron/exit-signal"),
    );
    expect(res.status).toBe(401);
  });

  it("flag off → skip, no holdings fetch, no insert", async () => {
    flagsMock.isExitSignalEnabled.mockReturnValue(false);
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(body.skipped).toBe("flag_off");
    expect(srMock.createServiceRoleClient).not.toHaveBeenCalled();
    expect(snapMock.getCurrentHoldings).not.toHaveBeenCalled();
    expect(insertMock.insertAlertEvents).not.toHaveBeenCalled();
  });

  it("no holdings → evaluated 0, no insert", async () => {
    snapMock.getCurrentHoldings.mockResolvedValue([]);
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(body.evaluated).toBe(0);
    expect(body.signals).toBe(0);
    expect(insertMock.insertAlertEvents).not.toHaveBeenCalled();
  });

  it("momentum_break holding → durable exit alert inserted + telegram", async () => {
    snapMock.getCurrentHoldings.mockResolvedValue([holding()]);
    shortlistMock.getActiveShortList.mockResolvedValue([
      shortItem("005930", "short"),
    ]);
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(body.evaluated).toBe(1);
    expect(body.signals).toBe(1);
    expect(body.inserted).toBe(1);
    expect(insertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
    const [events, opts] = insertMock.insertAlertEvents.mock.calls[0];
    expect(events[0].alertType).toBe("exit_signal");
    expect(events[0].ticker).toBe("005930");
    expect(opts).toHaveProperty("client", srMock.client);
    expect(telegramMock.sendTelegram).toHaveBeenCalledTimes(1);
  });

  it("flat holding (no trigger) → no insert", async () => {
    snapMock.getCurrentHoldings.mockResolvedValue([
      holding({ currentPrice: 100_500 }), // +0.5%, no trigger
    ]);
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(body.signals).toBe(0);
    expect(insertMock.insertAlertEvents).not.toHaveBeenCalled();
  });
});
