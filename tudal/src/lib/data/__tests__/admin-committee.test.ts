import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  transformCommitteeVoteRow,
  transformCommitteeVoteRows,
  aggregateVotes,
  getVotesByReportId,
  type CommitteeVoteDbRow,
} from "@/lib/data/admin-committee";
import type { CommitteeVote } from "@/types/admin";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

const baseRow: CommitteeVoteDbRow = {
  id: "vote-1",
  report_id: "rpt-1",
  persona_id: "core-5",
  persona_layer: "core",
  sector: null,
  vote: "approve",
  argument_excerpt: "[Quality] ROIC 22%·FCF 마진 18%.",
  created_at: "2026-04-01T00:10:00.000Z",
};

// PR4 Task 5 Step 5.1 — transformCommitteeVoteRow는 null 반환 가능. test helper로 narrow.
function expectValid(row: CommitteeVoteDbRow): CommitteeVote {
  const result = transformCommitteeVoteRow(row);
  expect(result).not.toBeNull();
  return result as CommitteeVote;
}

describe("transformCommitteeVoteRow", () => {
  it("maps snake_case DB columns to camelCase CommitteeVote fields", () => {
    const vote = expectValid(baseRow);
    expect(vote.id).toBe("vote-1");
    expect(vote.reportId).toBe("rpt-1");
    expect(vote.personaId).toBe("core-5");
    expect(vote.personaLayer).toBe("core");
    expect(vote.vote).toBe("approve");
    expect(vote.argumentExcerpt).toBe("[Quality] ROIC 22%·FCF 마진 18%.");
    expect(vote.createdAt).toBe("2026-04-01T00:10:00.000Z");
  });

  it("treats null sector as undefined for the core layer", () => {
    const vote = expectValid(baseRow);
    expect(vote.sector).toBeUndefined();
  });

  it("preserves the sector string for sector layer rows", () => {
    const sectorRow: CommitteeVoteDbRow = {
      ...baseRow,
      id: "vote-2",
      persona_id: "sector-semi-1",
      persona_layer: "sector",
      sector: "반도체",
    };
    const vote = expectValid(sectorRow);
    expect(vote.personaLayer).toBe("sector");
    expect(vote.sector).toBe("반도체");
  });

  it("coerces null argument_excerpt to an empty string", () => {
    const sparseRow: CommitteeVoteDbRow = {
      ...baseRow,
      argument_excerpt: null,
    };
    const vote = expectValid(sparseRow);
    expect(vote.argumentExcerpt).toBe("");
  });

  // PR4 Task 5 Step 5.1 (PR3a OOS RT#3) — invalid vote → null + warn.
  it("returns null + console.warn on invalid vote value (PR3a OOS RT#3 layer 1)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const invalidRow: CommitteeVoteDbRow = {
      ...baseRow,
      id: "invalid-vote-row",
      vote: "unknown" as never,
    };
    const result = transformCommitteeVoteRow(invalidRow);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/invalid_vote_skipped.*row_id=invalid-vote-row.*vote=unknown/),
    );
    warnSpy.mockRestore();
  });
});

// PR4 Task 5 Step 5.1+5.3 — transformCommitteeVoteRows wrapper (null filter).
describe("transformCommitteeVoteRows wrapper (PR4 Task 5 Step 5.1+5.3)", () => {
  it("filters null from array — invalid rows skipped silently after warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows: CommitteeVoteDbRow[] = [
      baseRow,
      { ...baseRow, id: "bad-1", vote: "garbage" as never },
      { ...baseRow, id: "vote-3", vote: "reject" },
    ];
    const result = transformCommitteeVoteRows(rows);
    expect(result).toHaveLength(2);
    expect(result.map((v) => v.id)).toEqual(["vote-1", "vote-3"]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("returns [] for [] input", () => {
    expect(transformCommitteeVoteRows([])).toEqual([]);
  });
});

describe("aggregateVotes", () => {
  function makeVote(
    layer: "core" | "sector",
    voteKind: "approve" | "reject" | "abstain",
  ): CommitteeVote {
    return {
      id: `${layer}-${voteKind}-${Math.random()}`,
      reportId: "rpt-1",
      personaId: `${layer}-x`,
      personaLayer: layer,
      sector: layer === "sector" ? "반도체" : undefined,
      vote: voteKind,
      argumentExcerpt: "",
      createdAt: "2026-04-01T00:10:00.000Z",
    };
  }

  it("counts approve/reject/abstain split by core vs sector layers", () => {
    const votes: CommitteeVote[] = [
      makeVote("core", "approve"),
      makeVote("core", "approve"),
      makeVote("core", "reject"),
      makeVote("core", "abstain"),
      makeVote("sector", "approve"),
      makeVote("sector", "reject"),
      makeVote("sector", "reject"),
    ];
    const agg = aggregateVotes(votes);
    expect(agg.core).toEqual({ approve: 2, reject: 1, abstain: 1 });
    expect(agg.sector).toEqual({ approve: 1, reject: 2, abstain: 0 });
  });

  it("returns zero counts for an empty vote list", () => {
    const agg = aggregateVotes([]);
    expect(agg.core).toEqual({ approve: 0, reject: 0, abstain: 0 });
    expect(agg.sector).toEqual({ approve: 0, reject: 0, abstain: 0 });
  });

  // PR4 Task 5 Step 5.2 (PR3a OOS RT#3 layer 2 — 직접 row read caller 보호).
  it("skips invalid vote + warns + counts unchanged (PR3a OOS RT#3 layer 2)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const votes: CommitteeVote[] = [
      makeVote("core", "approve"),
      makeVote("core", "approve"),
      // 직접 row read caller가 transformer 우회 → invalid vote 주입
      { ...makeVote("core", "approve"), vote: "unknown" as never },
      makeVote("sector", "abstain"),
    ];
    const agg = aggregateVotes(votes);
    // core.approve = 2 (invalid skipped, count 영향 없음), sector.abstain = 1
    expect(agg.core).toEqual({ approve: 2, reject: 0, abstain: 0 });
    expect(agg.sector).toEqual({ approve: 0, reject: 0, abstain: 1 });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/invalid_vote_skipped.*vote=unknown.*personaLayer=core/),
    );
    warnSpy.mockRestore();
  });
});

describe("getVotesByReportId — error path (G-wrapper-error)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = {
      select: mocks.select,
      eq: mocks.eq,
      order: mocks.order,
    };
    mocks.from.mockReturnValue(chain);
    mocks.select.mockReturnValue(chain);
    mocks.eq.mockReturnValue(chain);
    mocks.order.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns transformed rows on happy path", async () => {
    mocks.order.mockResolvedValueOnce({ data: [baseRow], error: null });
    const votes = await getVotesByReportId("rpt-1");
    expect(mocks.from).toHaveBeenCalledWith("committee_votes");
    expect(mocks.eq).toHaveBeenCalledWith("report_id", "rpt-1");
    expect(votes).toHaveLength(1);
    expect(votes[0].id).toBe("vote-1");
  });

  it("throws wrapped Error with table prefix on supabase error", async () => {
    mocks.order.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST116", message: "rls denied" },
    });

    await expect(getVotesByReportId("rpt-1")).rejects.toThrow(
      /committee_votes/,
    );
  });

  // PR4 Task 5 Step 5.3 (B11 fix omxy R2) — wrapper invariant: invalid rows in DB → 자동 skip.
  it("filters invalid vote rows via transformCommitteeVoteRows wrapper (B11 fix)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.order.mockResolvedValueOnce({
      data: [
        baseRow,
        { ...baseRow, id: "bad-row", vote: "garbage" as never },
      ],
      error: null,
    });
    const votes = await getVotesByReportId("rpt-1");
    // wrapper가 null filter → 1개만 반환 (silent skip + warn).
    expect(votes).toHaveLength(1);
    expect(votes[0].id).toBe("vote-1");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
