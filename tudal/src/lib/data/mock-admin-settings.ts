import type { AdminSettings, TickerAlertPref } from "@/types/admin";

// MVP용 mock — S5 실데이터 연결 시 admin_settings·ticker_alert_pref SELECT로 교체.
// ADMIN_ID는 /admin 가드로 인증된 현재 어드민 UUID. 로그인 전이라 고정 UUID 사용.

export const MOCK_ADMIN_ID = "11111111-1111-1111-1111-111111111111";

export const MOCK_ADMIN_SETTINGS: AdminSettings = {
  adminId: MOCK_ADMIN_ID,
  intradayMode: true, // 기본 ON — M13 배지 노출 demo
  updatedAt: "2026-04-19T00:00:00+09:00",
};

// Short List 30 기준 토글 상태. 기본 enabled=true.
// 예시로 2개는 OFF 설정해 UI에서 분기 확인 가능.
export const MOCK_ADMIN_TICKER_PREFS: TickerAlertPref[] = [
  {
    id: "tp-001",
    adminId: MOCK_ADMIN_ID,
    ticker: "035720", // 카카오 — 알림 OFF (시나리오 예시)
    enabled: false,
    updatedAt: "2026-04-18T10:00:00+09:00",
  },
  {
    id: "tp-002",
    adminId: MOCK_ADMIN_ID,
    ticker: "207940", // 삼성바이오로직스 — 알림 OFF
    enabled: false,
    updatedAt: "2026-04-17T20:15:00+09:00",
  },
];

export function buildTickerPrefMap(
  prefs: TickerAlertPref[],
): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const p of prefs) map.set(p.ticker, p.enabled);
  return map;
}
