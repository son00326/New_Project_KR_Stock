import type { AlertEvent } from "@/types/admin";

// MVP용 mock 데이터 — 추후 이벤트 드리븐 스트림으로 교체 (S5 스케줄러·알림)
// E6 AlertEvent (알림 이벤트). exit_signal · news_critical · price_anomaly · briefing · scheduler_fail.
// T+7일 outcome은 배치로 자동 적재 (IM-3).
export const MOCK_ADMIN_ALERTS: AlertEvent[] = [];
