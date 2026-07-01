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

import { ADMIN_NAV, ADMIN_NAV_FLAT } from "@/lib/admin-nav";
import AdminLayout from "../layout";

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

  it("groups nav into 메인 / 실험·연구 / 설정 with expected routes + labels", async () => {
    // 3구역 구조 불변식 (2026-07-01 출시 전 IA 정리).
    expect(ADMIN_NAV.map((g) => g.group)).toEqual([
      "메인",
      "실험·연구",
      "설정",
    ]);

    // 그룹별 항목 (href·label). 실험·연구 = 종목 선정 방식 비교/AI 학습 (실험 톤 + 내부코드 제거).
    const flat = ADMIN_NAV.flatMap((g) => g.items);
    expect(ADMIN_NAV_FLAT).toEqual(flat);
    expect(flat).toEqual(
      expect.arrayContaining([
        { href: "/admin", label: "홈" },
        { href: "/admin/portfolio", label: "포트폴리오" },
        { href: "/admin/track-record", label: "Track Record" },
        { href: "/admin/decision-tree", label: "Decision Tree" },
        { href: "/admin/alerts", label: "알림" },
        { href: "/admin/sector-comparison", label: "종목 선정 방식 비교 (실험)" },
        { href: "/admin/funnel-reflection", label: "AI 학습 (실험)" },
        { href: "/admin/settings", label: "설정" },
        { href: "/admin/settings/notifications", label: "알림 채널" },
        { href: "/admin/settings/cost", label: "AI 비용" },
        { href: "/admin/settings/health", label: "시스템 상태" },
        { href: "/admin/settings/brokerage", label: "증권사 키" },
        { href: "/admin/settings/binance", label: "거래소 키" },
      ]),
    );

    // 내부코드 (G1)/(M17)/(M18) 제거 확인.
    for (const item of flat) {
      expect(item.label).not.toMatch(/\((?:G1|M17|M18)\)/);
    }

    // 모든 그룹 항목이 실제 링크로 렌더된다.
    const rendered = await renderedLinks();
    const renderedHrefs = new Set(rendered.map((l) => l.href));
    for (const item of flat) {
      expect(renderedHrefs.has(item.href)).toBe(true);
    }
    expect(rendered).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/admin/sector-comparison",
          label: "종목 선정 방식 비교 (실험)",
        }),
        expect.objectContaining({
          href: "/admin/funnel-reflection",
          label: "AI 학습 (실험)",
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
