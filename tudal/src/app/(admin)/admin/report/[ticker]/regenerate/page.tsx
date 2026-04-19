// /admin/report/[ticker]/regenerate — 리포트 재생성 확인 화면 (BL-9 = A: 서브라우트)
// S4 M9 재생성 cap 가드: auto ≤ 1 / manual ≤ 2

import { MOCK_ADMIN_REGEN_COUNTERS } from "@/lib/data/mock-admin-regen-counters";
import {
  findRegenCounter,
  manualRemaining,
  isManualRegenAllowed,
} from "@/lib/performance/regen-cap";
import { RegenerateConfirmPanel } from "./regenerate-panel";

interface AdminReportRegeneratePageProps {
  params: Promise<{ ticker: string }>;
}

function currentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function formatMonthLabel(month: string): string {
  if (!month) return "";
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

export default async function AdminReportRegeneratePage({
  params,
}: AdminReportRegeneratePageProps) {
  const { ticker } = await params;
  const month = currentMonth();
  const monthLabel = formatMonthLabel(month);

  const counter = findRegenCounter(MOCK_ADMIN_REGEN_COUNTERS, ticker, month);
  const remaining = manualRemaining(counter);
  const allowed = isManualRegenAllowed(counter);

  const autoUsed = counter?.autoCount ?? 0;
  const manualUsed = counter?.manualCount ?? 0;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <header>
        <h1 className="text-2xl font-semibold">
          리포트 재생성 — {ticker}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {monthLabel} 수동 재생성 확인
        </p>
      </header>

      {/* cap 현황 카드 */}
      <div className="rounded-lg border bg-muted/30 px-4 py-4 space-y-2">
        <p className="text-sm font-medium">이번 달 재생성 현황</p>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <p className="text-xs text-muted-foreground">자동 재분석</p>
            <p className="mt-0.5 font-mono text-sm font-semibold">
              {autoUsed} / 1회 사용
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">수동 재생성</p>
            <p className="mt-0.5 font-mono text-sm font-semibold">
              {manualUsed} / 2회 사용{" "}
              <span
                className={
                  allowed
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }
              >
                · 이번 달 {remaining}회 남음
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* 확인 / 취소 버튼 (client island) */}
      <RegenerateConfirmPanel
        ticker={ticker}
        month={month}
        allowed={allowed}
      />
    </div>
  );
}
