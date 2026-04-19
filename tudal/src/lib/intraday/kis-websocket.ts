import type { IntradayTick } from "@/lib/intraday/anomaly-detect";

// ---------------------------------------------------------------------------
// 한투 WebSocket 어댑터 (S5b T5b.1, BL-14 = A)
// ref: https://apiportal.koreainvestment.com/intro (실시간 시세 WebSocket)
//
// 설계 원칙:
//   - BL-14 결정: WebSocket 실시간 (±5%/거래량 3배는 초 단위 이벤트, 폴링 희석 리스크).
//   - KIS_APP_KEY·KIS_APP_SECRET 미설정 시 mock-mode (구독 no-op, tick 수동 주입 전용).
//   - 실 I/O(ws 연결·재연결·세션 관리)는 S5 실데이터 전환 시 구현.
//   - onTick·onError 핸들러는 호출부에서 감지 루프에 연결.
// ---------------------------------------------------------------------------

export interface KisSubscribeOptions {
  tickers: string[];
  onTick: (tick: IntradayTick) => void | Promise<void>;
  onError?: (error: Error) => void;
}

export interface KisSubscription {
  close: () => void;
  mockMode: boolean;
}

export function isKisWebSocketConfigured(): boolean {
  return Boolean(process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET);
}

// S5 실데이터 전환 시 실 WebSocket 연결 로직 주입. 현재는 mock-mode no-op.
// 호출부(cron/dev test route)는 반환된 close로 정리. tick은 수동 주입 API로 공급.
export function subscribeKisTicks(
  options: KisSubscribeOptions,
): KisSubscription {
  if (!isKisWebSocketConfigured()) {
    if (options.tickers.length > 0) {
      console.warn(
        "[kis-ws] KIS_APP_KEY 미설정 — mock-mode. tickers:",
        options.tickers.slice(0, 3).join(","),
        options.tickers.length > 3 ? `... (+${options.tickers.length - 3})` : "",
      );
    }
    return { close: () => {}, mockMode: true };
  }

  // 실 WebSocket 연결 TODO: S5 실데이터 전환 시 구현
  options.onError?.(
    new Error("kis-ws real-mode not implemented; pending S5 실데이터 전환"),
  );
  return { close: () => {}, mockMode: false };
}
