// Frontend bridge-gap/spec-drift audit — regenerate page month boundary.
// ServicePlan-Admin §3.4-4: regen cap resets every month at 1st 00:00 KST.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PAGE_PATH = path.resolve(__dirname, "..", "page.tsx");
const PANEL_PATH = path.resolve(__dirname, "..", "regenerate-panel.tsx");

describe("admin report regenerate page invariant", () => {
  const source = fs.readFileSync(PAGE_PATH, "utf8");
  const panelSource = fs.readFileSync(PANEL_PATH, "utf8");

  it("derives current regen month in KST, not server local/UTC timezone", () => {
    const fnMatch = source.match(/function currentMonth\(\): string \{[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain("+ 9 * 3600 * 1000");
    expect(fn).toContain("kst.toISOString().slice(0, 7)");
    expect(fn).not.toContain("now.getMonth() + 1");
  });

  it("accepts an archive month query and falls back to KST current month", () => {
    expect(source).toContain('searchParams?: Promise<{ month?: string | string[] | undefined }>');
    expect(source).toContain('normalizeReportMonthParam((await searchParams)?.month)');
    expect(source).toContain("const month = requestedMonth ?? currentMonth()");
  });

  it("returns to the same report month after regenerate or cancel", () => {
    expect(panelSource).toContain("function reportHref");
    expect(panelSource).toContain("?month=${month.slice(0, 7)}");
    expect(panelSource).toContain("router.push(returnHref)");
    expect(panelSource).toContain("href={returnHref}");
  });
});
