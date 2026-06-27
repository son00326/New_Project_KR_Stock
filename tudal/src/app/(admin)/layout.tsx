import Link from "next/link";
import { Bell } from "lucide-react";
import { LogoutButton } from "@/app/(admin)/logout-button";
import { JoopickLogo } from "@/components/layout/logo";
import { getUnreadAlertCount } from "@/lib/data/admin-alerts";
import { createClient } from "@/lib/supabase/server";

// ServicePlan-Admin.md §2 — 메인 sidebar nav.
// /admin/report/[ticker]는 종목 클릭 전용이라 sidebar에서 제외.
// S6: AI 비용 모니터(/admin/settings/cost) 추가 노출.
// DQ-7: 증권사·거래소 키(Flat 추가 · S8에서 그룹 재편 예정 · spec §5.2).
const ADMIN_NAV = [
  { href: "/admin", label: "홈" },
  { href: "/admin/portfolio", label: "포트폴리오" },
  { href: "/admin/alerts", label: "알림" },
  { href: "/admin/track-record", label: "Track Record" },
  { href: "/admin/decision-tree", label: "Decision Tree" },
  { href: "/admin/settings", label: "설정" },
  { href: "/admin/settings/notifications", label: "알림 채널" },
  { href: "/admin/settings/cost", label: "AI 비용 (M17)" },
  { href: "/admin/settings/health", label: "Health (M18)" },
  { href: "/admin/settings/brokerage", label: "증권사 키" },
  { href: "/admin/settings/binance", label: "거래소 키" },
];

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
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <JoopickLogo size="sm" />
            <span className="text-xs text-muted-foreground">어드민</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/alerts"
              className="relative inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
                  className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-market-down,#dc2626)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white tabular-nums"
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
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Sidebar + Main (Q7: <768px 단일 컬럼 — sidebar hidden) */}
      <div className="flex-1 flex">
        <aside className="hidden md:block w-56 border-r bg-muted/20 shrink-0">
          <nav className="p-4 space-y-1">
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <span>{item.label}</span>
                {item.href === "/admin/alerts" && unreadCount > 0 && (
                  <span
                    className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-market-down,#dc2626)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white tabular-nums"
                    aria-label={`미확인 ${unreadCount}건`}
                  >
                    {unreadLabel}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      {/* 면책 Footer (BusinessPlan §7 고정) */}
      <footer className="border-t bg-muted/30 py-4">
        <div className="px-4 md:px-6 text-center text-xs text-muted-foreground">
          주픽은 투자 정보 제공 서비스이며, 투자 자문이 아닙니다. 투자 판단의 최종 책임은 이용자 본인에게 있습니다.
        </div>
      </footer>
    </div>
  );
}
