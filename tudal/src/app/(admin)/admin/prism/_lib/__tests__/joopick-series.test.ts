import { describe, expect, it } from "vitest";

import { parseJoopickPerformanceRows } from "../joopick-series";

describe("parseJoopickPerformanceRows", () => {
  it("skips nullable aggregate returns without dropping valid siblings", () => {
    // Given: one nullable production row between two valid aggregate snapshots.
    const rows = [
      { date: "2026-01-01", total_return: "0.01" },
      { date: "2026-01-02", total_return: null },
      { date: "2026-01-03", total_return: 0.03 },
    ];

    // When: portfolio aggregate rows cross the comparison boundary.
    const result = parseJoopickPerformanceRows(rows);

    // Then: the nullable row is ignored and valid observations survive.
    expect(result).toEqual([
      { date: "2026-01-01", totalReturn: 0.01 },
      { date: "2026-01-03", totalReturn: 0.03 },
    ]);
  });
});
