// W2b (D27 Q5) — getIncumbents + buildIncumbentThesisContexts 유닛테스트.
// mock chain 타이핑: feedback_test_mock_typing (any 금지, admin-tier0-candidates.test.ts 패턴).
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getIncumbents,
  buildIncumbentThesisContexts,
} from "@/lib/data/admin-shortlist-incumbents";
import type { IncumbentInfo } from "@/lib/screening/incumbent-merge";

interface IncumbentQueryRow {
  ticker: string;
  bucket: "short" | "mid" | "long";
  rank: number;
  month: string;
  sector: string | null;
  name: string | null;
  composite_score: string | number | null;
  signal_label: string | null;
  ai_comment_kr: string | null;
  consensus_badge: string | null;
  ai_score: string | number | null;
  conviction: string | number | null;
  delta_status: string;
}

interface QueryResult {
  data: IncumbentQueryRow[] | null;
  error: { code?: string; message?: string } | null;
}

// chain: from → select → in(bucket) → lte(month) → order(month) → order(bucket) → order(rank)
function buildClient(result: QueryResult) {
  const order3 = vi.fn().mockResolvedValue(result);
  const order2 = vi.fn().mockReturnValue({ order: order3 });
  const order1 = vi.fn().mockReturnValue({ order: order2 });
  const lte = vi.fn().mockReturnValue({ order: order1 });
  const inFn = vi.fn().mockReturnValue({ lte });
  const select = vi.fn().mockReturnValue({ in: inFn });
  const from = vi.fn().mockReturnValue({ select });
  return {
    client: { from } as unknown as SupabaseClient,
    spies: { from, select, in: inFn, lte, order1, order2, order3 },
  };
}

function row(
  ticker: string,
  bucket: "short" | "mid" | "long",
  month: string,
  rank = 1,
): IncumbentQueryRow {
  return {
    ticker,
    bucket,
    rank,
    month,
    sector: "반도체",
    name: `종목${ticker}`,
    composite_score: "72.5",
    signal_label: "기존 신호",
    ai_comment_kr: "직전 논거",
    consensus_badge: "🟢",
    ai_score: "78.2",
    conviction: 71,
    delta_status: "new",
  };
}

describe("getIncumbents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalid month → throw invalid_month_format (쿼리 0회)", async () => {
    const { client, spies } = buildClient({ data: [], error: null });
    await expect(
      getIncumbents({ track: "short", month: "2026-13", client }),
    ).rejects.toThrow(/invalid_month_format/);
    expect(spies.from).not.toHaveBeenCalled();
  });

  it("midlong: month<=기준 최신 month 그룹의 mid/long rows만 반환 (이전 달 잔재 제외)", async () => {
    const latest = [
      ...Array.from({ length: 10 }, (_, i) =>
        row(`10${String(i).padStart(4, "0")}`, "mid", "2026-06-01", i + 1),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        row(`20${String(i).padStart(4, "0")}`, "long", "2026-06-01", i + 1),
      ),
    ];
    const older = [row("999999", "mid", "2026-05-01")];
    const { client, spies } = buildClient({ data: [...latest, ...older], error: null });
    const result = await getIncumbents({ track: "midlong", month: "2026-07", client });
    expect(result).toHaveLength(20);
    expect(result.every((r) => r.month === "2026-06-01")).toBe(true);
    expect(spies.in).toHaveBeenCalledWith("bucket", ["mid", "long"]);
    expect(spies.lte).toHaveBeenCalledWith("month", "2026-07-01");
  });

  it("short: 최신 그룹 10 반환 + IncumbentInfo 필드 매핑(aiCommentKr/배지/aiScore/conviction/name/compositeScore/signalLabel)", async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row(`00${String(i).padStart(4, "0")}`, "short", "2026-06-01", i + 1),
    );
    const { client } = buildClient({ data: rows, error: null });
    const result = await getIncumbents({ track: "short", month: "2026-06", client });
    expect(result).toHaveLength(10);
    expect(result[0]).toMatchObject({
      ticker: "000000",
      bucket: "short",
      rank: 1,
      month: "2026-06-01",
      sector: "반도체",
      name: "종목000000",
      aiCommentKr: "직전 논거",
      consensusBadge: "🟢",
      aiScore: 78.2,
      conviction: 71,
      deltaStatus: "new",
      compositeScore: 72.5,
      signalLabel: "기존 신호",
    });
  });

  it("cold start: rows 0 → [] (throw 아님)", async () => {
    const { client } = buildClient({ data: [], error: null });
    expect(await getIncumbents({ track: "short", month: "2026-06", client })).toEqual([]);
  });

  it("short: 월초 carry 졸업 제외로 최신 그룹 9행이어도 정당 → 9행 반환", async () => {
    const rows = Array.from({ length: 9 }, (_, i) =>
      row(`00${String(i).padStart(4, "0")}`, "short", "2026-07-01", i + 1),
    );
    const { client } = buildClient({ data: rows, error: null });
    const result = await getIncumbents({ track: "short", month: "2026-07", client });
    expect(result).toHaveLength(9);
  });

  it("최신 그룹이 TRACK_SELECT_COUNT를 초과하면(11) → throw incumbents_count_exceeded", async () => {
    const rows = Array.from({ length: 11 }, (_, i) =>
      row(`00${String(i).padStart(4, "0")}`, "short", "2026-06-01", i + 1),
    );
    const { client } = buildClient({ data: rows, error: null });
    await expect(
      getIncumbents({ track: "short", month: "2026-06", client }),
    ).rejects.toThrow("incumbents_count_exceeded:short:11>10");
  });

  it("query error → throw incumbents_query_failed", async () => {
    const { client } = buildClient({ data: null, error: { code: "PGRST000" } });
    await expect(
      getIncumbents({ track: "short", month: "2026-06", client }),
    ).rejects.toThrow("incumbents_query_failed:PGRST000");
  });
});

// ---------------------------------------------------------------------------
// buildIncumbentThesisContexts — 직전 row + section_0 thesis + 실현 성과 합성
// ---------------------------------------------------------------------------
interface ReportRow {
  ticker: string;
  month: string;
  section_0: unknown;
}
interface SnapshotRow {
  ticker: string;
  date: string;
  entry_price: string | number | null;
  total_return: string | number | null;
}
interface ChainResult<T> {
  data: T[] | null;
  error: { code?: string } | null;
}

function buildContextClient(opts: {
  reports: ChainResult<ReportRow>;
  snapshots: ChainResult<SnapshotRow>;
  rejectReports?: boolean;
  rejectSnapshots?: boolean;
}) {
  // stock_reports chain: select → in → eq → lte → order(resolves)
  const reportOrder = opts.rejectReports
    ? vi.fn().mockRejectedValue(new Error("network"))
    : vi.fn().mockResolvedValue(opts.reports);
  const reportLte = vi.fn().mockReturnValue({ order: reportOrder });
  const reportEq = vi.fn().mockReturnValue({ lte: reportLte });
  const reportIn = vi.fn().mockReturnValue({ eq: reportEq });
  const reportSelect = vi.fn().mockReturnValue({ in: reportIn });
  // portfolio_snapshot chain: select → in → order(resolves)
  const snapOrder = opts.rejectSnapshots
    ? vi.fn().mockRejectedValue(new Error("network"))
    : vi.fn().mockResolvedValue(opts.snapshots);
  const snapIn = vi.fn().mockReturnValue({ order: snapOrder });
  const snapSelect = vi.fn().mockReturnValue({ in: snapIn });

  const from = vi.fn((table: string) => {
    if (table === "stock_reports") return { select: reportSelect };
    if (table === "portfolio_snapshot") return { select: snapSelect };
    throw new Error(`unexpected table:${table}`);
  });
  return {
    client: { from } as unknown as SupabaseClient,
    spies: { from, reportIn, reportEq, reportLte, snapIn },
  };
}

function makeIncumbent(overrides: Partial<IncumbentInfo> = {}): IncumbentInfo {
  return {
    ticker: "005930",
    bucket: "short",
    rank: 1,
    month: "2026-06-01",
    sector: "반도체",
    name: "삼성전자",
    aiCommentKr: "직전 논거",
    consensusBadge: "🟢",
    aiScore: 78.2,
    conviction: 71,
    deltaStatus: "new",
    compositeScore: 72.5,
    signalLabel: "기존 신호",
    ...overrides,
  };
}

const validSection0 = {
  headline: "반도체 회복 사이클 진입",
  thesis: ["t1", "t2", "t3", "t4"],
  conviction: 80,
  committeeMini: {
    core: { approve: 7, reject: 2, abstain: 2 },
    sector: { approve: 9, reject: 3, abstain: 2 },
  },
  priceBands: { bear: "60,000", base: "75,000", bull: "90,000" },
};

describe("buildIncumbentThesisContexts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("직전 row 필드 + 리포트 thesis + 실현 성과를 한국어 컨텍스트로 합성", async () => {
    const { client } = buildContextClient({
      reports: {
        data: [{ ticker: "005930", month: "2026-06-01", section_0: validSection0 }],
        error: null,
      },
      snapshots: {
        data: [
          { ticker: "005930", date: "2026-06-03", entry_price: 50000, total_return: 0.052 },
        ],
        error: null,
      },
    });
    const map = await buildIncumbentThesisContexts([makeIncumbent()], { client });
    const ctx = map["005930"];
    expect(ctx).toContain("직전 선정 리스트");
    expect(ctx).toContain("🟢");
    expect(ctx).toContain("직전 논거");
    expect(ctx).toContain("반도체 회복 사이클 진입");
    expect(ctx).toContain("t1");
    expect(ctx).toContain("t3");
    expect(ctx).not.toContain("t4"); // 최대 3개 cap
    expect(ctx).toContain("+5.2%");
    expect(ctx).toContain("유지가 자동이 아닙니다");
  });

  it("긴 직전 논거/리포트 thesis는 cap으로 incumbent 토큰 예산을 방어", async () => {
    const longHeadline = "헤".repeat(190);
    const longBullet = "불".repeat(320);
    const longComment = "논".repeat(180);
    const { client } = buildContextClient({
      reports: {
        data: [
          {
            ticker: "005930",
            month: "2026-06-01",
            section_0: {
              ...validSection0,
              headline: longHeadline,
              thesis: [longBullet, "t2", "t3", "t4"],
            },
          },
        ],
        error: null,
      },
      snapshots: { data: [], error: null },
    });
    const map = await buildIncumbentThesisContexts(
      [makeIncumbent({ aiCommentKr: longComment })],
      { client },
    );
    const ctx = map["005930"];
    expect(ctx).toContain(`${"논".repeat(120)}…`);
    expect(ctx).not.toContain("논".repeat(121));
    expect(ctx).toContain(`${"헤".repeat(160)}…`);
    expect(ctx).not.toContain("헤".repeat(161));
    expect(ctx).toContain(`${"불".repeat(220)}…`);
    expect(ctx).not.toContain("불".repeat(221));
    expect(ctx).not.toContain("t4");
  });

  it("리포트 부재/section_0 파싱 실패 → thesis 줄 생략 (graceful)", async () => {
    const { client } = buildContextClient({
      reports: {
        data: [{ ticker: "005930", month: "2026-06-01", section_0: { bogus: true } }],
        error: null,
      },
      snapshots: { data: [], error: null },
    });
    const map = await buildIncumbentThesisContexts([makeIncumbent()], { client });
    expect(map["005930"]).not.toContain("핵심 thesis");
    expect(map["005930"]).toContain("직전 논거");
  });

  it("incumbent month보다 미래인 stock_reports row는 직전 thesis로 사용하지 않음 (lte 필터)", async () => {
    const { client, spies } = buildContextClient({
      reports: { data: [], error: null },
      snapshots: { data: [], error: null },
    });
    await buildIncumbentThesisContexts(
      [makeIncumbent({ month: "2026-06-01" })],
      { client },
    );
    expect(spies.reportLte).toHaveBeenCalledWith("month", "2026-06-01");
  });

  it("snapshot 부재/entry_price=0 → 실현 성과 줄 생략 (W3 graceful)", async () => {
    const { client } = buildContextClient({
      reports: { data: [], error: null },
      snapshots: {
        data: [
          { ticker: "005930", date: "2026-06-03", entry_price: 0, total_return: 0.1 },
        ],
        error: null,
      },
    });
    const map = await buildIncumbentThesisContexts([makeIncumbent()], { client });
    expect(map["005930"]).not.toContain("실현 성과");
  });

  it("보조 조회(reports/snapshot) 실패 → 직전 row 정보만으로 생성 (throw 금지 — best-effort)", async () => {
    const { client } = buildContextClient({
      reports: { data: null, error: null },
      snapshots: { data: null, error: null },
      rejectReports: true,
      rejectSnapshots: true,
    });
    const map = await buildIncumbentThesisContexts([makeIncumbent()], { client });
    expect(map["005930"]).toContain("직전 논거");
    expect(map["005930"]).toContain("유지가 자동이 아닙니다");
  });

  it("incumbents [] → {} (조회 0회)", async () => {
    const { client, spies } = buildContextClient({
      reports: { data: [], error: null },
      snapshots: { data: [], error: null },
    });
    const map = await buildIncumbentThesisContexts([], { client });
    expect(map).toEqual({});
    expect(spies.from).not.toHaveBeenCalled();
  });
});
