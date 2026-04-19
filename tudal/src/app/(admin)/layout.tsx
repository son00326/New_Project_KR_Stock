import Link from "next/link";
import { LogoutButton } from "@/app/(admin)/logout-button";
import { JoopickLogo } from "@/components/layout/logo";
import { createClient } from "@/lib/supabase/server";

// ServicePlan-Admin.md §2 — 메인 sidebar nav.
// /admin/report/[ticker]는 종목 클릭 전용이라 sidebar에서 제외.
// S6: AI 비용 모니터(/admin/settings/cost) 추가 노출.
const ADMIN_NAV = [
  { href: "/admin", label: "홈" },
  { href: "/admin/portfolio", label: "포트폴리오" },
  { href: "/admin/alerts", label: "알림" },
  { href: "/admin/track-record", label: "Track Record" },
  { href: "/admin/decision-tree", label: "Decision Tree" },
  { href: "/admin/settings", label: "설정" },
  { href: "/admin/settings/cost", label: "AI 비용 (M17)" },
  { href: "/admin/settings/health", label: "Health (M18)" },
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
                className="block rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {item.label}
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
