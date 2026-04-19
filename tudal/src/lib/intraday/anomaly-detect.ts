import type {
  AlertEvent,
  IntradayAnomalyEvent,
  IntradayTriggerType,
} from "@/types/admin";
import {
  INTRADAY_PRICE_SPIKE_THRESHOLD,
  INTRADAY_VOLUME_MULTIPLIER_THRESHOLD,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// M13 장중 이상 감지 — 순수 로직 (S5b T5b.1)
// ref: ServicePlan-Admin §3.10 R3.10-8·R3.5-2 · Slice S5 §S5b Tasks
//
// 한투 WebSocket tick → detectAnomalies(tick, context) → IntradayAnomalyEvent | null
// ±5% / 거래량 3배는 초 단위 이벤트이므로 WebSocket 실시간 필요 (BL-14 = A).
// 본 모듈은 WebSocket I/O 없이 입력만 받아 판정 — 외부 주입형이라 Vitest 친화.
// ---------------------------------------------------------------------------

export interface IntradayTick {
  ticker: string;
  lastPrice: number;
  timestamp: string; // ISO
  sessionVolume: number; // 당일 누적 거래량
}

export interface IntradayContext {
  referencePrice: number; // 전일 종가 (±5% 기준)
  avg20dVolume: number;   // 20일 평균 거래량 (3배 기준)
}

export interface IntradayDetection {
  triggerType: IntradayTriggerType;
  priceChangePct: number | null;
  volumeRatio: number | null;
}

const EPSILON = 1e-9;

export function computePriceChangePct(
  tick: IntradayTick,
  ctx: IntradayContext,
): number {
  if (ctx.referencePrice <= 0) return 0;
  return (tick.lastPrice - ctx.referencePrice) / ctx.referencePrice;
}

export function computeVolumeRatio(
  tick: IntradayTick,
  ctx: IntradayContext,
): number {
  if (ctx.avg20dVolume <= 0) return 0;
  return tick.sessionVolume / ctx.avg20dVolume;
}

// 가격·거래량 각 임계치 판정. 여러 트리거 동시 발생 가능하므로
// 우선순위(price_spike > price_drop > volume_spike) 적용.
export function detectIntradayAnomaly(
  tick: IntradayTick,
  ctx: IntradayContext,
  thresholds: {
    priceChange?: number;
    volumeMultiplier?: number;
  } = {},
): IntradayDetection | null {
  const priceThreshold =
    thresholds.priceChange ?? INTRADAY_PRICE_SPIKE_THRESHOLD;
  const volMultiplier =
    thresholds.volumeMultiplier ?? INTRADAY_VOLUME_MULTIPLIER_THRESHOLD;

  const priceChangePct = computePriceChangePct(tick, ctx);
  const volumeRatio = computeVolumeRatio(tick, ctx);

  const priceSpike = priceChangePct >= priceThreshold - EPSILON;
  const priceDrop = priceChangePct <= -priceThreshold + EPSILON;
  const volumeSpike = volumeRatio >= volMultiplier - EPSILON;

  if (priceSpike) {
    return {
      triggerType: "price_spike",
      priceChangePct,
      volumeRatio: volumeSpike ? volumeRatio : null,
    };
  }
  if (priceDrop) {
    return {
      triggerType: "price_drop",
      priceChangePct,
      volumeRatio: volumeSpike ? volumeRatio : null,
    };
  }
  if (volumeSpike) {
    return {
      triggerType: "volume_spike",
      priceChangePct: null,
      volumeRatio,
    };
  }
  return null;
}

// dedup_key = ticker + trigger_type + 1분 bucket (UNIQUE index 충돌 방지)
export function buildDedupKey(
  ticker: string,
  triggerType: IntradayTriggerType,
  timestamp: string,
): string {
  const t = new Date(timestamp);
  const bucket = `${t.getUTCFullYear()}${String(t.getUTCMonth() + 1).padStart(2, "0")}${String(t.getUTCDate()).padStart(2, "0")}${String(t.getUTCHours()).padStart(2, "0")}${String(t.getUTCMinutes()).padStart(2, "0")}`;
  return `${ticker}:${triggerType}:${bucket}`;
}

export function toIntradayAnomalyRecord(
  tick: IntradayTick,
  detection: IntradayDetection,
): Omit<IntradayAnomalyEvent, "id"> {
  return {
    ticker: tick.ticker,
    triggerType: detection.triggerType,
    priceChangePct:
      detection.priceChangePct === null
        ? null
        : Number((detection.priceChangePct * 100).toFixed(3)),
    volumeRatio:
      detection.volumeRatio === null
        ? null
        : Number(detection.volumeRatio.toFixed(2)),
    lastPrice: tick.lastPrice,
    detectedAt: tick.timestamp,
    dedupKey: buildDedupKey(tick.ticker, detection.triggerType, tick.timestamp),
  };
}

const TRIGGER_KO: Record<IntradayTriggerType, string> = {
  price_spike: "급등",
  price_drop: "급락",
  volume_spike: "거래량 폭증",
};

export function buildIntradayAnomalyAlert(
  tick: IntradayTick,
  detection: IntradayDetection,
): Omit<AlertEvent, "id" | "isRead"> {
  const triggerLabel = TRIGGER_KO[detection.triggerType];
  const parts: string[] = [];
  if (detection.priceChangePct !== null) {
    parts.push(`${(detection.priceChangePct * 100).toFixed(2)}%`);
  }
  if (detection.volumeRatio !== null) {
    parts.push(`거래량 ${detection.volumeRatio.toFixed(2)}×`);
  }
  const reason = `${tick.ticker} ${triggerLabel} — ${parts.join(" · ")} (last ${tick.lastPrice.toLocaleString("ko-KR")})`;
  return {
    alertType: "intraday_anomaly",
    ticker: tick.ticker,
    severity: detection.triggerType === "volume_spike" ? "warning" : "critical",
    triggerReason: reason,
    signalSentAt: tick.timestamp,
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
  };
}

// 토글이 OFF인 종목은 발송 차단. Exit 시그널은 별도 경로로 이 필터를 우회.
export function isTickerEnabledForIntraday(
  ticker: string,
  prefs: Map<string, boolean>,
): boolean {
  const explicit = prefs.get(ticker);
  return explicit === undefined ? true : explicit;
}
