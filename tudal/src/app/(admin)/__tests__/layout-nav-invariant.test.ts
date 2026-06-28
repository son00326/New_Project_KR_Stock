import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, getUnreadAlertCountMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getUnreadAlertCountMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: getUserMock },
  }),
}));

vi.mock("@/lib/data/admin-alerts", () => ({
  getUnreadAlertCount: getUnreadAlertCountMock,
}));

import AdminLayout, { ADMIN_NAV } from "../layout";

interface ElementProps {
  href?: unknown;
  children?: ReactNode;
  "aria-label"?: unknown;
  [key: string]: unknown;
}

function collectElements(node: ReactNode): ReactElement<ElementProps>[] {
  const out: ReactElement<ElementProps>[] = [];
  function visit(child: ReactNode) {
    if (Array.isArray(child)) {
      child.forEach(visit);
      return;
    }
    if (isValidElement<ElementProps>(child)) {
      out.push(child);
      visit(child.props.children);
      return;
    }
  }
  visit(node);
  return out;
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (isValidElement<ElementProps>(node)) return textOf(node.props.children);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}

async function renderedLinks() {
  const element = await AdminLayout({
    children: createElement("div", { "data-testid": "admin-child" }, "본문"),
  });
  return collectElements(element)
    .filter((el) => typeof el.props.href === "string")
    .map((el) => ({
      href: el.props.href as string,
      label: textOf(el.props.children),
      ariaLabel:
        typeof el.props["aria-label"] === "string"
          ? (el.props["aria-label"] as string)
          : null,
    }));
}

describe("admin layout nav invariant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
      data: { user: { email: "admin@example.com" } },
    });
    getUnreadAlertCountMock.mockResolvedValue(7);
  });

  it("keeps B-1/G1/settings notification routes in the rendered sidebar nav", async () => {
    expect(ADMIN_NAV).toEqual(
      expect.arrayContaining([
        { href: "/admin/settings/notifications", label: "알림 채널" },
        { href: "/admin/sector-comparison", label: "섹터 추천 비교" },
        { href: "/admin/funnel-reflection", label: "Reflection Lab (G1)" },
      ]),
    );

    await expect(renderedLinks()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/admin/settings/notifications",
          label: "알림 채널",
        }),
        expect.objectContaining({
          href: "/admin/sector-comparison",
          label: "섹터 추천 비교",
        }),
        expect.objectContaining({
          href: "/admin/funnel-reflection",
          label: "Reflection Lab (G1)",
        }),
      ]),
    );
  });

  it("renders header alert history link and unread badge from data", async () => {
    const links = await renderedLinks();
    expect(getUnreadAlertCountMock).toHaveBeenCalledTimes(1);
    expect(links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/admin/alerts",
          ariaLabel: "알림 이력 보기 — 미확인 7건",
          label: "알림7",
        }),
        expect.objectContaining({
          href: "/admin/alerts",
          label: "알림7",
        }),
      ]),
    );
  });
});
