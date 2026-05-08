import { describe, expect, it } from "vitest";
import { MOCK_ADMIN_REPORTS } from "@/lib/data/mock-admin-report";
import {
  aggregateVotes,
  getVotesByReportId,
} from "@/lib/data/mock-admin-committee";

describe("admin mock fixture consistency", () => {
  it("keeps section 0 committee mini counts aligned with generated votes", () => {
    for (const report of MOCK_ADMIN_REPORTS) {
      const section0 = report.section_0 as {
        committeeMini?: {
          core: { approve: number; reject: number; abstain: number };
          sector: { approve: number; reject: number; abstain: number };
        };
      };
      if (!section0.committeeMini) continue;

      const aggregate = aggregateVotes(getVotesByReportId(report.id));

      expect(section0.committeeMini.core, report.ticker).toEqual(aggregate.core);
      expect(section0.committeeMini.sector, report.ticker).toEqual(aggregate.sector);
    }
  });

  it("keeps the default portfolio mock month open for Accept and Reject", async () => {
    const { MOCK_ADMIN_APPROVALS } = await import("@/lib/data/mock-admin-approvals");
    const finalizedDefaultMonth = MOCK_ADMIN_APPROVALS.some(
      (row) =>
        row.month === "2026-04-01" &&
        row.approvalType === "accept" &&
        row.isFinal,
    );

    expect(finalizedDefaultMonth).toBe(false);
  });
});
