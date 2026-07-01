import Link from "next/link";
import { Bell } from "lucide-react";
import { LogoutButton } from "@/app/(admin)/logout-button";
import { JoopickLogo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getUnreadAlertCount } from "@/lib/data/admin-alerts";
import { createClient } from "@/lib/supabase/server";

// ServicePlan-Admin.md §2 — 메인 sidebar nav.
// /admin/report/[ticker]는 종목 클릭 전용이라 sidebar에서 제외.
// 2026-07-01 출시 전 IA 정리: 3구역(메인 / 실험·연구 / 설정)으로 위계 분리.
//   Track Record·Decision Tree = 영어 유지(USER). 내부코드 (G1)/(M17)/(M18) 제거.
export interface AdminNavItem {
  href: string;
  label: string;
}
export interface AdminNavGroup {
  group: string;
  items: AdminNavItem[];
}
export const ADMIN_NAV: AdminNavGroup[] = [
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
    items: [
      { href: "/admin/sector-comparison", label: "종목 선정 방식 비교 (실험)" },
      { href: "/admin/funnel-reflection", label: "AI 학습 (실험)" },
    ],
  },
  {
    group: "설정",
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
export const ADMIN_NAV_FLAT: AdminNavItem[] = ADMIN_NAV.flatMap(
  (group) => group.items,
);

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // S7c: 미확인 알림 배지 (read-only·fail-soft — 오류 시 0). flag 무관(기존 alert_event 읽기).
  const unreadCount = await getUnreadAlertCount();
  const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Admin Header — 로고·어드민 표시·(TODO S5: 모드 드롭다운·알림 종)·로그아웃 */}
      <header className="border-b border-border/70 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70 sticky top-0 z-50">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <Link href="/admin" className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80">
            <JoopickLogo size="sm" />
            <span className="text-xs font-medium text-muted-foreground">어드민</span>
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <Link
              href="/admin/alerts"
              className="relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={
                unreadCount > 0
                  ? `알림 이력 보기 — 미확인 ${unreadCount}건`
                  : "알림 이력 보기"
              }
            >
              <Bell className="h-4 w-4" aria-hidden />
              <span className="hidden md:inline">알림</span>
              {unreadCount > 0 && (
                <span
                  className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums"
                  aria-hidden
                >
                  {unreadLabel}
                </span>
              )}
            </Link>
            {user?.email && (
              <span className="hidden text-xs text-muted-foreground md:inline">
                {user.email}
              </span>
            )}
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Sidebar + Main (Q7: <768px 단일 컬럼 — sidebar hidden) */}
      <div className="flex-1 flex">
        <aside className="hidden md:block w-60 border-r border-border/70 bg-card shrink-0">
          <nav className="p-3 space-y-4 sticky top-14">
            {ADMIN_NAV.map((group) => (
              <div key={group.group} className="space-y-0.5">
                <p className="px-3.5 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.group}
                </p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <span>{item.label}</span>
                    {item.href === "/admin/alerts" && unreadCount > 0 && (
                      <span
                        className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums"
                        aria-label={`미확인 ${unreadCount}건`}
                      >
                        {unreadLabel}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-5 md:p-8 max-w-full overflow-x-hidden">{children}</main>
      </div>

      {/* 면책 Footer (BusinessPlan §7 고정) */}
      <footer className="border-t border-border/70 bg-card py-5">
        <div className="px-4 md:px-6 text-center text-xs text-muted-foreground">
          주픽은 투자 정보 제공 서비스이며, 투자 자문이 아닙니다. 투자 판단의 최종 책임은 이용자 본인에게 있습니다.
        </div>
      </footer>
    </div>
  );
}
