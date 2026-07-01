export interface AdminNavItem {
  readonly href: string;
  readonly label: string;
}

export interface AdminNavGroup {
  readonly group: string;
  readonly items: readonly AdminNavItem[];
  readonly collapsible?: boolean;
}

export const ADMIN_NAV: readonly AdminNavGroup[] = [
  {
    group: "메인",
    items: [
      { href: "/admin", label: "홈" },
      { href: "/admin/portfolio", label: "포트폴리오" },
      { href: "/admin/track-record", label: "Track Record" },
      { href: "/admin/decision-tree", label: "Decision Tree" },
      { href: "/admin/alerts", label: "알림" },
    ],
  },
  {
    group: "실험·연구",
    collapsible: true,
    items: [
      { href: "/admin/sector-comparison", label: "종목 선정 방식 비교 (실험)" },
      { href: "/admin/funnel-reflection", label: "AI 학습 (실험)" },
    ],
  },
  {
    group: "설정",
    collapsible: true,
    items: [
      { href: "/admin/settings", label: "설정" },
      { href: "/admin/settings/notifications", label: "알림 채널" },
      { href: "/admin/settings/cost", label: "AI 비용" },
      { href: "/admin/settings/health", label: "시스템 상태" },
      { href: "/admin/settings/brokerage", label: "증권사 키" },
      { href: "/admin/settings/binance", label: "거래소 키" },
    ],
  },
];

export const ADMIN_NAV_FLAT: readonly AdminNavItem[] = ADMIN_NAV.flatMap(
  (group) => group.items,
);
