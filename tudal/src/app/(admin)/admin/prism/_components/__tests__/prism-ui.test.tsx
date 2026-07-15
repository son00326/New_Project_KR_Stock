import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrismPageHeader, resolveMarket } from "../prism-ui";

describe("PRISM page navigation", () => {
  it("unwraps repeated market parameters without resetting US to KR", () => {
    // Given/When/Then: the first repeated search parameter remains authoritative.
    expect(resolveMarket(["us", "us"])).toBe("us");
    expect(resolveMarket(["kr", "us"])).toBe("kr");
  });

  it("preserves the selected market across every section tab", () => {
    // Given: a page header rendered for the US market.
    render(
      <PrismPageHeader
        description="설명"
        market="us"
        pathname="/admin/prism"
        title="프리즘"
      />,
    );

    // When: section navigation links are inspected.
    const navigation = screen.getByRole("navigation", { name: "프리즘 섹션" });
    const links = within(navigation).getAllByRole("link");

    // Then: moving between tabs cannot silently reset the market.
    expect(links).toHaveLength(6);
    for (const link of links) expect(link).toHaveAttribute("href", expect.stringContaining("market=us"));
  });
});
