// Frontend bridge-gap audit — admin layout route exposure invariant.
// ServicePlan-Admin §2 includes /admin/settings/notifications and a header alert bell.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LAYOUT_PATH = path.resolve(__dirname, "..", "layout.tsx");

describe("admin layout nav invariant", () => {
  const source = fs.readFileSync(LAYOUT_PATH, "utf8");

  it("sidebar exposes settings notifications route", () => {
    expect(source).toContain('href: "/admin/settings/notifications"');
    expect(source).toContain('label: "알림 채널"');
  });

  it("sidebar exposes sector comparison route (B-1)", () => {
    expect(source).toContain('href: "/admin/sector-comparison"');
    expect(source).toContain('label: "섹터 추천 비교"');
  });

  it("header exposes alert history bell link", () => {
    expect(source).toContain('href="/admin/alerts"');
    // aria-label은 미확인 알림 배지(S7c)로 조건부가 됐으나 base 라벨은 항상 포함.
    expect(source).toContain("알림 이력 보기");
    expect(source).toContain('<Bell className="h-4 w-4" aria-hidden />');
  });

  it("header + sidebar expose unread alert badge (S7c)", () => {
    expect(source).toContain("getUnreadAlertCount");
    expect(source).toContain("unreadCount");
  });
});
