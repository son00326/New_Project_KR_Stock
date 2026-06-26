import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { M12aTickerLedgerRow } from "@/lib/news/m12a/types";

// ── collaborator mocks (vi.hoisted — vi.mock 팩토리에서 안전 참조) ──
const m = vi.hoisted(() => ({
  getActiveShortList: vi.fn<() => Promise<unknown[]>>(),
  getRecentNewsEvents: vi.fn<() => Promise<unknown[]>>(),
  insertM12aAssessments:
    vi.fn<(rows: M12aTickerLedgerRow[]) => Promise<void>>(async () => {}),
  insertAlertEvents: vi.fn<(events: unknown[]) => Promise<void>>(async () => {}),
  sendTelegram: vi.fn<(p: { text: string }) => Promise<{ success: boolean }>>(
    async () => ({ success: true }),
  ),
  callPersona: vi.fn(),
  isAnthropicAvailable: vi.fn<() => boolean>(() => true),
  preflightHardcap: vi.fn(async () => ({})),
}));

vi.mock("@/lib/data/admin-shortlist", () => ({
  getActiveShortList: m.getActiveShortList,
}));
vi.mock("@/lib/data/admin-news", () => ({
  getRecentNewsEvents: m.getRecentNewsEvents,
}));
vi.mock("@/lib/data/admin-m12a", () => ({
  insertM12aAssessments: m.insertM12aAssessments,
}));
vi.mock("@/lib/data/admin-alerts-insert", () => ({
  insertAlertEvents: m.insertAlertEvents,
}));
vi.mock("@/lib/notify/telegram", () => ({ sendTelegram: m.sendTelegram }));
vi.mock("@/lib/ai/anthropic-client", () => ({ callPersona: m.callPersona }));
vi.mock("@/lib/ai/provider", () => ({
  isAnthropicAvailable: m.isAnthropicAvailable,
}));
vi.mock("@/lib/cost/cost-logger", () => ({
  preflightHardcap: m.preflightHardcap,
}));
vi.mock("@/lib/ai/prompts/personas", () => ({
  CORE_11_PERSONAS: Array.from({ length: 11 }, (_, i) => ({
    id: `p${i}`,
    label: `P${i}`,
  })),
}));
vi.mock("@/lib/ai/model-registry", () => ({
  getRoleWorstCaseMaxCostPerCallKrw: () => 100,
}));

import { runM12aForBriefing } from "@/lib/news/m12a/briefing-integration";

const {
  getActiveShortList,
  getRecentNewsEvents,
  insertM12aAssessments,
  insertAlertEvents,
  sendTelegram,
  callPersona,
  isAnthropicAvailable,
  preflightHardcap,
} = m;

function autoRemoveJson(ticker = "005930"): string {
  return JSON.stringify({
    scope: "company",
    severity: "critical",
    confidence: "high",
    materiality: "high",
    directness: "direct",
    thesis_break: true,
    thesis_break_reason: "실적 쇼크",
    affected_tickers: [ticker],
  });
}

const VALID_UUID = "39202d8b-1042-48a6-8da0-df14a52fabea";
const authGetUserById = vi.fn(async () => ({
  data: { user: { id: VALID_UUID } },
  error: null,
}));
const client = {
  from: vi.fn(),
  auth: { admin: { getUserById: authGetUserById } },
} as unknown as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  isAnthropicAvailable.mockReturnValue(true);
  authGetUserById.mockResolvedValue({
    data: { user: { id: VALID_UUID } },
    error: null,
  });
  callPersona.mockResolvedValue({
    content: autoRemoveJson(),
    usage: { input_tokens: 1, output_tokens: 1 },
    costKrw: 0,
    promptCacheEnabled: false,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runM12aForBriefing — dormancy pin", () => {
  it("M12A_NEWS_EVAL_ENABLED off → { ran:false, [] }, 데이터/AI 호출 0", async () => {
    const res = await runM12aForBriefing({
      client,
      nowIso: "2026-06-26T00:00:00.000Z",
      adminUserId: VALID_UUID,
    });
    expect(res).toEqual({ ran: false, attentionTickers: [] });
    expect(getActiveShortList).not.toHaveBeenCalled();
    expect(getRecentNewsEvents).not.toHaveBeenCalled();
    expect(callPersona).not.toHaveBeenCalled();
    expect(insertM12aAssessments).not.toHaveBeenCalled();
  });
});

describe("runM12aForBriefing — fail-closed step-0 (go-live 게이트)", () => {
  beforeEach(() => {
    vi.stubEnv("M12A_NEWS_EVAL_ENABLED", "true");
    getActiveShortList.mockResolvedValue([]);
    getRecentNewsEvents.mockResolvedValue([]);
  });

  it("AI_COST_LOG_REAL_INSERT_ENABLED off → skip(ran:false), 데이터/AI 0", async () => {
    // M12A_NEWS_EVAL_ENABLED on이지만 cost logging off → hardcap fail-open 차단
    const res = await runM12aForBriefing({
      client,
      nowIso: "2026-06-26T00:00:00.000Z",
      adminUserId: VALID_UUID,
    });
    expect(res).toEqual({ ran: false, attentionTickers: [] });
    expect(getActiveShortList).not.toHaveBeenCalled();
    expect(callPersona).not.toHaveBeenCalled();
  });

  it("CRON_SYSTEM_USER_ID 비-UUID → skip(빈/잘못된 FK로 AI burn 차단)", async () => {
    vi.stubEnv("AI_COST_LOG_REAL_INSERT_ENABLED", "true");
    const res = await runM12aForBriefing({
      client,
      nowIso: "2026-06-26T00:00:00.000Z",
      adminUserId: "",
    });
    expect(res).toEqual({ ran: false, attentionTickers: [] });
    expect(authGetUserById).not.toHaveBeenCalled();
    expect(callPersona).not.toHaveBeenCalled();
  });

  it("cron user 미존재(getUserById error) → skip", async () => {
    vi.stubEnv("AI_COST_LOG_REAL_INSERT_ENABLED", "true");
    authGetUserById.mockResolvedValue({
      data: { user: null },
      error: { message: "not found" },
    } as never);
    const res = await runM12aForBriefing({
      client,
      nowIso: "2026-06-26T00:00:00.000Z",
      adminUserId: VALID_UUID,
    });
    expect(res).toEqual({ ran: false, attentionTickers: [] });
    expect(callPersona).not.toHaveBeenCalled();
  });
});

describe("runM12aForBriefing — on-path 연결포인트 (cron→eval→orchestrator→ledger→alert)", () => {
  beforeEach(() => {
    vi.stubEnv("M12A_NEWS_EVAL_ENABLED", "true");
    vi.stubEnv("AI_COST_LOG_REAL_INSERT_ENABLED", "true");
    // shadow(M12A_AUTO_REMOVE_ENABLED 미설정)
    // 실제 유니버스 크기(short 10 + midlong 20) — 1건 제거가 트랙 floor를 깨지 않도록.
    const universe = [
      { ticker: "005930", name: "삼성전자", bucket: "short" },
      ...Array.from({ length: 9 }, (_, i) => ({
        ticker: `10000${i}`,
        name: `단기${i}`,
        bucket: "short",
      })),
      ...Array.from({ length: 20 }, (_, i) => ({
        ticker: `20${String(i).padStart(4, "0")}`,
        name: `중장기${i}`,
        bucket: i % 2 === 0 ? "mid" : "long",
      })),
    ];
    getActiveShortList.mockResolvedValue(universe);
    getRecentNewsEvents.mockResolvedValue([
      {
        id: "evt-1",
        ticker: "005930",
        title: "삼성전자 실적 쇼크",
        url: "https://news/1",
      },
    ]);
  });

  it("뉴스→Core11 평가→ledger 영속→알림→attentionTickers(name 매핑)", async () => {
    const res = await runM12aForBriefing({
      client,
      nowIso: "2026-06-26T00:00:00.000Z",
      adminUserId: VALID_UUID,
      alertsUrl: "/admin/alerts",
    });

    expect(res.ran).toBe(true);
    expect(res.attentionTickers).toEqual([
      { ticker: "005930", name: "삼성전자", reason: "실적 쇼크" },
    ]);
    // Core 11 평가
    expect(callPersona).toHaveBeenCalledTimes(11);
    // ledger 영속 + 알림(news_critical) + 텔레그램(shadow)
    expect(insertM12aAssessments).toHaveBeenCalledTimes(1);
    const ledgerRows = insertM12aAssessments.mock.calls[0][0];
    expect(ledgerRows[0].actionTaken).toBe("shadowed"); // shadow phase
    expect(insertAlertEvents).toHaveBeenCalledTimes(1);
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    expect(sendTelegram.mock.calls[0][0].text).toContain("(shadow)");
  });

  it("뉴스 0건 → preflight skip, ledger/alert 0, ran true", async () => {
    getRecentNewsEvents.mockResolvedValue([]);
    const res = await runM12aForBriefing({
      client,
      nowIso: "2026-06-26T00:00:00.000Z",
      adminUserId: VALID_UUID,
    });
    expect(res.ran).toBe(true);
    expect(res.attentionTickers).toEqual([]);
    expect(preflightHardcap).not.toHaveBeenCalled(); // 평가 대상 0 → 예약 불필요
    expect(callPersona).not.toHaveBeenCalled();
    expect(insertM12aAssessments).toHaveBeenCalledTimes(1); // 빈 rows insert(early-return, no DB)
  });

  it("AI 미가용 → orchestrator skip(ai_unavailable), ran false", async () => {
    isAnthropicAvailable.mockReturnValue(false);
    const res = await runM12aForBriefing({
      client,
      nowIso: "2026-06-26T00:00:00.000Z",
      adminUserId: VALID_UUID,
    });
    expect(res.ran).toBe(false);
    expect(callPersona).not.toHaveBeenCalled();
  });
});
