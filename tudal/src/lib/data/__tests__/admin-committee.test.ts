import { describe, expect, it } from "vitest";
import {
  transformCommitteeVoteRow,
  aggregateVotes,
  type CommitteeVoteDbRow,
} from "@/lib/data/admin-committee";
import type { CommitteeVote } from "@/types/admin";

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

describe("transformCommitteeVoteRow", () => {
  it("maps snake_case DB columns to camelCase CommitteeVote fields", () => {
    const vote = transformCommitteeVoteRow(baseRow);
    expect(vote.id).toBe("vote-1");
    expect(vote.reportId).toBe("rpt-1");
    expect(vote.personaId).toBe("core-5");
    expect(vote.personaLayer).toBe("core");
    expect(vote.vote).toBe("approve");
    expect(vote.argumentExcerpt).toBe("[Quality] ROIC 22%·FCF 마진 18%.");
    expect(vote.createdAt).toBe("2026-04-01T00:10:00.000Z");
  });

  it("treats null sector as undefined for the core layer", () => {
    const vote = transformCommitteeVoteRow(baseRow);
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
    const vote = transformCommitteeVoteRow(sectorRow);
    expect(vote.personaLayer).toBe("sector");
    expect(vote.sector).toBe("반도체");
  });

  it("coerces null argument_excerpt to an empty string", () => {
    const sparseRow: CommitteeVoteDbRow = {
      ...baseRow,
      argument_excerpt: null,
    };
    const vote = transformCommitteeVoteRow(sparseRow);
    expect(vote.argumentExcerpt).toBe("");
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
});
