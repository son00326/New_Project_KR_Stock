import type {
  ActionTaken,
  CashoutRecord,
  M12aTickerLedgerRow,
  PerTickerAssessment,
  RecommendedAction,
} from "@/lib/news/m12a/types";

// ---------------------------------------------------------------------------
// M12a ticker ledger row builder (R3.10-7c · GAP1 m12a_risk_action 귀속).
//   pure mapper: assessment 구조화 필드 + run 메타(runId/month) + verdict/action → ledger row.
//   가격 3필드(GAP2)는 actionTaken='removed' + cashout 존재일 때만 채움.
//   shadowed/held_by_brake는 실 cashout 없음 → 3필드 모두 null.
// ---------------------------------------------------------------------------

export interface BuildLedgerRowInput {
  assessment: PerTickerAssessment;
  runId: string;
  month: string; // YYYY-MM-01
  recommendedAction: RecommendedAction;
  actionTaken: ActionTaken;
  heldByBrake: boolean;
  cashout?: CashoutRecord | null;
  alertEventId?: string | null;
}

export function buildM12aLedgerRow(
  input: BuildLedgerRowInput,
): M12aTickerLedgerRow {
  const { assessment } = input;
  // removed + cashout 존재일 때만 실 가격(GAP2). 그 외(shadowed/held_by_brake/cashout 누락) → null.
  const cashedOut =
    input.actionTaken === "removed" && input.cashout != null
      ? input.cashout
      : null;

  return {
    newsEventId: assessment.newsEventId,
    runId: input.runId,
    month: input.month,
    ticker: assessment.ticker,
    surface: assessment.surface,
    scope: assessment.scope,
    severity: assessment.severity,
    confidence: assessment.confidence,
    materiality: assessment.materiality,
    directness: assessment.directness,
    thesisBreak: assessment.thesisBreak,
    thesisBreakReason: assessment.thesisBreakReason,
    recommendedAction: input.recommendedAction,
    actionTaken: input.actionTaken,
    heldByBrake: input.heldByBrake,
    priceBasisDate: cashedOut ? cashedOut.priceBasisDate : null,
    priceSource: cashedOut ? "KRX_EOD" : null,
    executionAssumption: cashedOut ? "virtual_eod" : null,
    alertEventId: input.alertEventId ?? null,
  };
}
