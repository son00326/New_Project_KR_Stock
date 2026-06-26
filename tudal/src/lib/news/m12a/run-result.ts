import { isM12aAutoRemoveEnabled } from "@/lib/news/m12a/flags";

export interface M12aAttentionTicker {
  ticker: string;
  reason: string;
}

export interface M12aRunResult {
  skipped: boolean;
  reason?: "flag_off" | "ai_unavailable";
  runId: string;
  shadow: boolean;
  assessmentCount: number;
  autoRemoveCandidates: number;
  removedCount: number;
  shadowedCount: number;
  heldByBrakeCount: number;
  alertOnlyCount: number;
  brakeTriggered: boolean;
  brakeReasons: string[];
  telegramsSent: number;
  attentionTickers: M12aAttentionTicker[];
}

export function emptyM12aRunResult(
  runId: string,
  reason: "flag_off" | "ai_unavailable",
): M12aRunResult {
  return {
    skipped: true,
    reason,
    runId,
    shadow: !isM12aAutoRemoveEnabled(),
    assessmentCount: 0,
    autoRemoveCandidates: 0,
    removedCount: 0,
    shadowedCount: 0,
    heldByBrakeCount: 0,
    alertOnlyCount: 0,
    brakeTriggered: false,
    brakeReasons: [],
    telegramsSent: 0,
    attentionTickers: [],
  };
}
