import type { AlertEvent, IntradayAnomalyEvent } from "@/types/admin";
import type { IntradayContext, IntradayTick } from "@/lib/intraday/anomaly-detect";
import {
  buildIntradayAnomalyAlert,
  detectIntradayAnomaly,
  isTickerEnabledForIntraday,
  toIntradayAnomalyRecord,
} from "@/lib/intraday/anomaly-detect";

// ---------------------------------------------------------------------------
// M13/M14 장중 모니터 — 순수 orchestrator (S7c, 2026-06-27)
// ref: ServicePlan-Admin §3.5/§3.10
//
// 보유/리스트 종목 tick 배치 → M14 토글 필터 → M13 감지 → durable record + alert + telegram.
// I/O 없음(순수). 호출부(KIS WS 워커 / 수동 trigger)가 flag gate + fetch + insert + telegram.
// shadow-first: INTRADAY_MONITOR_ENABLED off / KIS 미설정 → 호출부가 미실행(본 모듈 env 미접근).
// fail-soft: 컨텍스트/틱 부재 ticker는 skip(throw 아님).
// ---------------------------------------------------------------------------

export interface IntradayThresholdOverride {
  priceChange?: number;
  volumeMultiplier?: number;
}

export interface IntradayMonitorInput {
  ticks: IntradayTick[];
  contexts: Map<string, IntradayContext>;
  /** M14 종목별 토글 (ticker_alert_pref). 미지정 ticker는 기본 ON. */
  prefs: Map<string, boolean>;
  /** M14 Phase 2 커스텀 임계치 (옵션). */
  customThresholds?: Map<string, IntradayThresholdOverride>;
}

export interface IntradayMonitorOutput {
  anomalies: Array<Omit<IntradayAnomalyEvent, "id">>;
  alerts: Array<Omit<AlertEvent, "id" | "isRead">>;
  telegramTexts: string[];
  evaluated: number;
  skipped: number;
  detected: number;
}

const TELEGRAM_PREFIX = "📈 장중 이상 감지";

/**
 * 장중 tick 배치 → durable anomaly record + alert_event(intraday_anomaly) + telegram 텍스트.
 * dedup은 호출부 INSERT(intraday_anomaly_event.dedup_key UNIQUE)가 담당 — 본 함수는 record만 생성.
 */
export function buildIntradayMonitorOutput(
  input: IntradayMonitorInput,
): IntradayMonitorOutput {
  const anomalies: Array<Omit<IntradayAnomalyEvent, "id">> = [];
  const alerts: Array<Omit<AlertEvent, "id" | "isRead">> = [];
  const telegramTexts: string[] = [];
  let evaluated = 0;
  let skipped = 0;

  for (const tick of input.ticks) {
    // M14 토글 OFF → skip (장중 이상 감지 차단). Exit 시그널은 별도 경로로 이 필터 우회.
    if (!isTickerEnabledForIntraday(tick.ticker, input.prefs)) {
      skipped += 1;
      continue;
    }
    const ctx = input.contexts.get(tick.ticker);
    if (!ctx) {
      // 전일 종가/20일 평균 거래량 부재 → 판정 불가, fail-soft skip.
      skipped += 1;
      continue;
    }
    evaluated += 1;
    const override = input.customThresholds?.get(tick.ticker);
    const detection = detectIntradayAnomaly(tick, ctx, {
      priceChange: override?.priceChange,
      volumeMultiplier: override?.volumeMultiplier,
    });
    if (!detection) continue;

    anomalies.push(toIntradayAnomalyRecord(tick, detection));
    const alert = buildIntradayAnomalyAlert(tick, detection);
    alerts.push(alert);
    telegramTexts.push(`${TELEGRAM_PREFIX}\n${alert.triggerReason}`);
  }

  return {
    anomalies,
    alerts,
    telegramTexts,
    evaluated,
    skipped,
    detected: anomalies.length,
  };
}
