import Link from "next/link";
import type { ReactNode } from "react";

const PRISM_TABS = [
  { href: "/admin/prism", label: "대시보드" },
  { href: "/admin/prism/holdings", label: "AI 보유 분석" },
  { href: "/admin/prism/trades", label: "거래 내역" },
  { href: "/admin/prism/watchlist", label: "관심 종목" },
  { href: "/admin/prism/insights", label: "인사이트" },
  { href: "/admin/prism/compare", label: "주픽 비교" },
] as const;

export const dynamic = "force-dynamic";

export default function PrismLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="space-y-6">
      <nav aria-label="프리즘 섹션" className="overflow-x-auto">
        <div className="flex min-w-max gap-1 rounded-2xl border border-border/60 bg-card p-1.5 shadow-toss-sm">
          {PRISM_TABS.map((tab) => (
            <Link
              key={tab.href}
              className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={tab.href}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
}
