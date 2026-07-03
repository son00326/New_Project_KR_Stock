import type { IntradayTick } from "@/lib/intraday/anomaly-detect";
import {
  fetchKisApprovalKey,
  resolveKisEndpoints,
  startKisTickStream,
  type KisWebSocketLike,
} from "@/lib/intraday/kis-ws-client";

// ---------------------------------------------------------------------------
// 한투 WebSocket 어댑터 (S5b T5b.1, BL-14 = A · 실모드 배선 2026-07-04 S7c 워커)
// ref: https://apiportal.koreainvestment.com/intro (실시간 시세 WebSocket)
//
// 설계 원칙:
//   - BL-14 결정: WebSocket 실시간 (±5%/거래량 3배는 초 단위 이벤트, 폴링 희석 리스크).
//   - KIS_APP_KEY·KIS_APP_SECRET 미설정 시 mock-mode (구독 no-op, tick 수동 주입 전용).
//   - 실모드 = kis-ws-client.ts startKisTickStream (approval key 발급 → 연결 →
//     H0STCNT0 구독 → PINGPONG echo → 지수백오프 재연결). KIS_WS_MOCK==="true" 시
//     모의투자 도메인. Node 22+ 내장 WebSocket 사용 (외부 dep 미추가).
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

// 실모드: kis-ws-client 상태기계로 연속 구독. 키 부재 시 기존과 동일 mock-mode no-op.
// 호출부(외부 워커/dev test route)는 반환된 close로 정리.
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

  // isKisWebSocketConfigured()=true 보장 하에서만 도달.
  const appKey = process.env.KIS_APP_KEY as string;
  const appSecret = process.env.KIS_APP_SECRET as string;
  const endpoints = resolveKisEndpoints(process.env.KIS_WS_MOCK === "true");

  if (typeof WebSocket === "undefined") {
    // Node 22+/모던 런타임 내장 WebSocket 전제 — 부재 시 fail-soft (구독 없이 close-only).
    options.onError?.(new Error("kis_ws_websocket_unavailable"));
    return { close: () => {}, mockMode: false };
  }

  const stream = startKisTickStream(
    {
      tickers: options.tickers,
      onTick: options.onTick,
      onError: options.onError,
    },
    {
      wsUrl: endpoints.wsUrl,
      getApprovalKey: () =>
        fetchKisApprovalKey({
          appKey,
          appSecret,
          restBase: endpoints.restBase,
        }),
      webSocketFactory: (url) =>
        new WebSocket(url) as unknown as KisWebSocketLike,
    },
  );
  return { close: () => stream.close(), mockMode: false };
}
