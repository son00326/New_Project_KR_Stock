import Link from "next/link";
import { SettingsPanel } from "@/app/(admin)/admin/settings/settings-panel";
import { getCurrentAdminSettings } from "@/lib/data/admin-settings";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import { getCurrentTickerAlertPrefs } from "@/lib/data/admin-ticker-prefs";

// M14 종목 토글 + 상시 모니터링 모드 (58차 Mock cleanup Step 2.2 — READ 실 SELECT)
// ref: ServicePlan-Admin §3.5 R3.5-2·§3.10 R3.10-8~9.
// SELECT 경로: admin_settings + ticker_alert_pref RLS "self" 자동 의존.
// 0 rows = intradayMode default false + initialTickerMap empty (caller default).
// WRITE 경로는 actions.ts에서 모든 환경 boundary `real_persistence_not_configured` 반환.

export default async function AdminSettingsPage() {
  const [shortlist, settings, tickerPrefs] = await Promise.all([
    getActiveShortList(),
    getCurrentAdminSettings(),
    getCurrentTickerAlertPrefs(),
  ]);

  const active = shortlist
    .filter((s) => s.deltaStatus !== "removed")
    .sort((a, b) => {
      if (a.bucket !== b.bucket) {
        const order = { short: 0, mid: 1, long: 2 };
        return order[a.bucket] - order[b.bucket];
      }
      return a.rank - b.rank;
    });

  const initialTickerMap: Record<string, boolean> = {};
  for (const p of tickerPrefs) {
    initialTickerMap[p.ticker] = p.enabled;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          상시 모니터링 모드 · 종목별 알림 토글 · (파이프라인 헬스는{" "}
          <Link
            href="/admin/settings/health"
            className="underline underline-offset-2"
          >
            /admin/settings/health
          </Link>
          )
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          ※ 모드/토글 변경은 실 저장(S5b RPC) 연결 전까지 boundary 메시지 반환
        </p>
      </header>

      <SettingsPanel
        initialIntradayMode={settings?.intradayMode ?? false}
        shortlist={active}
        initialTickerMap={initialTickerMap}
      />
    </div>
  );
}
