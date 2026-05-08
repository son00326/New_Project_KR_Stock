import Link from "next/link";
import { SettingsPanel } from "@/app/(admin)/admin/settings/settings-panel";
import {
  MOCK_ADMIN_SETTINGS,
  MOCK_ADMIN_TICKER_PREFS,
} from "@/lib/data/mock-admin-settings";
import { getActiveShortList } from "@/lib/data/admin-shortlist";

// M14 종목 토글 + 상시 모니터링 모드 (S5b T5b.2).
// ref: ServicePlan-Admin §3.5 R3.5-2·§3.10 R3.10-8~9.

export default async function AdminSettingsPage() {
  const shortlist = await getActiveShortList();
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
  for (const p of MOCK_ADMIN_TICKER_PREFS) {
    initialTickerMap[p.ticker] = p.enabled;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">설정</h1>
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
          ※ short_list_30 SELECT · admin_settings·ticker_alert_pref UPSERT는 T7e.5에서 전환
        </p>
      </header>

      <SettingsPanel
        initialIntradayMode={MOCK_ADMIN_SETTINGS.intradayMode}
        shortlist={active}
        initialTickerMap={initialTickerMap}
      />
    </div>
  );
}
