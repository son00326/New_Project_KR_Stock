import type { AlertEvent, IntradayAnomalyEvent } from "@/types/admin";
import {
  buildIntradayMonitorOutput,
  type IntradayMonitorInput,
} from "@/lib/intraday/monitor";
import { isIntradayMonitorEnabled } from "@/lib/intraday/flags";

// ---------------------------------------------------------------------------
// M13/M14 장중 모니터 pass orchestrator (S7c, 2026-06-27)
// buildIntradayMonitorOutput(순수) → durable intraday_anomaly_event + alert_event + 텔레그램.
// 게이트(isIntradayMonitorEnabled)를 본 진입에서 소비 — off → no-op·writes 0(shadow-first).
// tick/context 공급(KIS WS)은 호출부 책임(USER 키 게이트 seam). 본 함수는 공급된 tick만 처리.
// ---------------------------------------------------------------------------

export interface RunIntradayMonitorDeps {
  insertAnomalies: (
    events: Array<Omit<IntradayAnomalyEvent, "id">>,
  ) => Promise<void>;
  insertAlerts: (
    events: Array<Omit<AlertEvent, "id" | "isRead">>,
  ) => Promise<void>;
  sendTelegram: (
    text: string,
  ) => Promise<{ success: boolean; mockMode: boolean; error?: string }>;
}

export interface RunIntradayMonitorResult {
  skipped?: "flag_off";
  evaluated: number;
  detected: number;
  inserted: number;
  telegramDelivered: number;
}

export async function runIntradayMonitorPass(
  input: IntradayMonitorInput,
  deps: RunIntradayMonitorDeps,
): Promise<RunIntradayMonitorResult> {
  // shadow-first 게이트 — flag off → no-op·writes 0.
  if (!isIntradayMonitorEnabled()) {
    return {
      skipped: "flag_off",
      evaluated: 0,
      detected: 0,
      inserted: 0,
      telegramDelivered: 0,
    };
  }

  const output = buildIntradayMonitorOutput(input);
  if (output.anomalies.length > 0) {
    await deps.insertAnomalies(output.anomalies);
  }
  if (output.alerts.length > 0) {
    await deps.insertAlerts(output.alerts);
  }

  let telegramDelivered = 0;
  for (const text of output.telegramTexts) {
    const res = await deps.sendTelegram(text);
    if (res.success && !res.mockMode) telegramDelivered += 1;
  }

  return {
    evaluated: output.evaluated,
    detected: output.detected,
    inserted: output.anomalies.length,
    telegramDelivered,
  };
}
