import type { IntradayAnomalyEvent } from "@/types/admin";

// MVP용 mock — S5 실데이터 연결 시 intraday_anomaly_event 테이블 SELECT로 교체.
// /admin 홈 상단 배지는 detectedAt 기준 최근 15분 이내 이벤트만 노출.
// 고정 스냅샷 기준 시각: 2026-04-19T14:30:00+09:00 (장중 KST 14:30).

export const MOCK_ADMIN_INTRADAY_EVENTS: IntradayAnomalyEvent[] = [
  {
    id: "int-001",
    ticker: "005930",
    triggerType: "price_drop",
    priceChangePct: -5.214,
    volumeRatio: null,
    lastPrice: 71800,
    detectedAt: "2026-04-19T14:27:15+09:00",
    dedupKey: "005930:price_drop:202604190527",
  },
  {
    id: "int-002",
    ticker: "035420",
    triggerType: "volume_spike",
    priceChangePct: null,
    volumeRatio: 3.42,
    lastPrice: 212500,
    detectedAt: "2026-04-19T13:52:08+09:00",
    dedupKey: "035420:volume_spike:202604190452",
  },
  {
    id: "int-003",
    ticker: "000660",
    triggerType: "price_spike",
    priceChangePct: 5.088,
    volumeRatio: 2.1,
    lastPrice: 198500,
    detectedAt: "2026-04-19T11:15:32+09:00",
    dedupKey: "000660:price_spike:202604190215",
  },
];
