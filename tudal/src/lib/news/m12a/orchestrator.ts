import type { AlertEvent } from "@/types/admin";
import {
  isM12aAutoRemoveEnabled,
  isM12aNewsEvalEnabled,
} from "@/lib/news/m12a/flags";
import { DEFAULT_BRAKE_CONFIG } from "@/lib/news/m12a/config";
import { decideRecommendedAction } from "@/lib/news/m12a/verdict";
import { applySmartBrake } from "@/lib/news/m12a/brake";
import {
  applyAutoRemoveMutation,
  resolveCachedCashout,
} from "@/lib/news/m12a/auto-remove";
import { buildM12aLedgerRow } from "@/lib/news/m12a/ledger";
import {
  emptyM12aRunResult,
  type M12aAttentionTicker,
  type M12aRunResult,
} from "@/lib/news/m12a/run-result";
import { buildM12aTelegramText } from "@/lib/news/m12a/telegram-text";
import type {
  ActionTaken,
  BrakeCandidate,
  BrakeConfig,
  CashoutRecord,
  M12aTickerLedgerRow,
  PerTickerAssessment,
  RecommendedAction,
} from "@/lib/news/m12a/types";

export type { M12aAttentionTicker, M12aRunResult } from "@/lib/news/m12a/run-result";

// ---------------------------------------------------------------------------
// M12a — 뉴스 기반 자동 제외 오케스트레이터 (shadow-first DI 코디네이터)
// SoT: ServicePlan-Admin §3.10 R3.10-5~7g · docs/superpowers/specs/2026-06-26-m12a-news-auto-remove-shadow-first.md §4
//
// 흐름: gate → preflight → evaluateNews(AI) → verdict(per-ticker) → brake(run-level)
//       → (auto ON만) mutate → ledger 영속 → 알림(텔레그램 + /admin) → 결과(브리핑 attention).
//
// 불변식:
//   - M12A_NEWS_EVAL_ENABLED off → skipped(비용/알림/mutation 0).
//   - M12A_AUTO_REMOVE_ENABLED off(default=shadow) → would-remove/held_by_brake 이벤트 + 알림 + ledger만,
//     short_list_30/portfolio_snapshot mutation 0(applyAutoRemove 미호출).
//   - 모든 IO는 DI(evaluateNews/insert*/sendTelegram/resolveCashout/applyAutoRemove). env 접근은 flags.ts만.
//   - 이메일/Resend 경로 없음(텔레그램 best-effort + /admin durable alert).
// ---------------------------------------------------------------------------

type AlertInput = Omit<AlertEvent, "id" | "isRead">;

export interface M12aOrchestratorDeps {
  month: string; // YYYY-MM-01
  runId: string;
  nowIso: string; // 알림 signal_sent_at (결정론 — caller가 주입)
  aiAvailable: boolean; // isAnthropicAvailable() 등
  brakeConfig?: BrakeConfig;
  listTrackSizes: { short: number; midlong: number; full: number };
  portfolioSize: number;
  alertsUrl?: string;
  // ── DI (IO) ──
  preflight?: () => Promise<void>; // 비용 hardcap preflight(실 경로). throw 시 차단.
  evaluateNews: () => Promise<PerTickerAssessment[]>; // AI 평가(테스트는 mock)
  resolveCashout?: (
    ticker: string,
  ) => Promise<{ price: number; priceBasisDate: string } | null>; // KRX EOD(auto ON만)
  applyAutoRemove?: (input: {
    tickers: string[];
    cashouts: CashoutRecord[];
  }) => Promise<void>; // mutation(auto ON만)
  insertAssessments: (rows: M12aTickerLedgerRow[]) => Promise<void>;
  insertAlertEvents: (events: AlertInput[]) => Promise<void>;
  sendTelegram: (
    text: string,
  ) => Promise<{ success: boolean; mockMode?: boolean; error?: string }>;
}

export async function runM12aNewsEvaluation(
  deps: M12aOrchestratorDeps,
): Promise<M12aRunResult> {
  // ── gate: flag off / AI 미가용 → skip(byte-identical, 비용/알림/mutation 0) ──
  if (!isM12aNewsEvalEnabled()) {
    return emptyM12aRunResult(deps.runId, "flag_off");
  }
  if (!deps.aiAvailable) {
    return emptyM12aRunResult(deps.runId, "ai_unavailable");
  }

  await deps.preflight?.(); // 비용 hardcap 초과 시 throw → 차단

  const assessments = await deps.evaluateNews();
  const config = deps.brakeConfig ?? DEFAULT_BRAKE_CONFIG;
  const autoRemoveEnabled = isM12aAutoRemoveEnabled();

  // ── 1) per-ticker verdict + auto_remove 후보 수집 ──
  const verdicts = assessments.map((a) => ({
    a,
    action: decideRecommendedAction(a),
  }));
  const autoCandidates = verdicts.filter((v) => v.action === "auto_remove");
  const brakeCandidates: BrakeCandidate[] = autoCandidates.map((v) => ({
    ticker: v.a.ticker,
    surface: v.a.surface,
    track: v.a.track,
  }));

  // ── 2) run-level smart brake ──
  const brake = applySmartBrake({
    candidates: brakeCandidates,
    listTrackSizes: deps.listTrackSizes,
    portfolioSize: deps.portfolioSize,
    config,
  });

  // ── 3) 행별 최종 action 결정 + ledger/alert/telegram/cashout 누적 ──
  const rows: M12aTickerLedgerRow[] = [];
  const alerts: AlertInput[] = [];
  const telegrams: string[] = [];
  const attentionTickers: M12aAttentionTicker[] = [];
  const cashoutByTicker = new Map<string, CashoutRecord | null>();
  const removedCashoutByTicker = new Map<string, CashoutRecord>();
  let shadowedCount = 0;
  let heldByBrakeCount = 0;
  let alertOnlyCount = 0;

  for (const { a, action } of verdicts) {
    const reasonText = a.thesisBreakReason ?? a.newsTitle;
    let recommendedAction: RecommendedAction = action;
    let actionTaken: ActionTaken;
    let cashout: CashoutRecord | null = null;

    if (action === "auto_remove") {
      if (brake.brakeTriggered) {
        // whole-run hold — 부분 제외 없음 (R3.10-7a)
        recommendedAction = "hold_for_review";
        actionTaken = "held_by_brake";
        heldByBrakeCount += 1;
      } else if (autoRemoveEnabled) {
        // GAP2 fail-closed: 가격 미확정이면 자동 청산 금지 → shadow 유지
        cashout = await resolveCachedCashout({
          ticker: a.ticker,
          cache: cashoutByTicker,
          resolveCashout: deps.resolveCashout,
        });
        if (cashout) {
          actionTaken = "removed";
          removedCashoutByTicker.set(a.ticker, cashout);
        } else {
          actionTaken = "shadowed";
          shadowedCount += 1;
        }
      } else {
        // shadow phase: would-remove (mutation 0)
        actionTaken = "shadowed";
        shadowedCount += 1;
      }
    } else {
      // alert_only — 제거 의도 없음, ledger/dashboard 알림만
      actionTaken = "shadowed";
      alertOnlyCount += 1;
    }

    rows.push(
      buildM12aLedgerRow({
        assessment: a,
        runId: deps.runId,
        month: deps.month,
        recommendedAction,
        actionTaken,
        heldByBrake: actionTaken === "held_by_brake",
        cashout,
      }),
    );
    attentionTickers.push({ ticker: a.ticker, reason: reasonText });

    if (recommendedAction === "auto_remove") {
      // would-remove(shadow) 또는 removed(auto) → critical 알림 + 텔레그램(shadow 표기)
      alerts.push({
        alertType: "news_critical",
        ticker: a.ticker,
        severity: a.severity,
        triggerReason: reasonText,
        signalSentAt: deps.nowIso,
        outcomeAt: null,
        t7PriceChange: null,
        decisionRecorded: null,
        decisionMemo: null,
      });
      telegrams.push(
        buildM12aTelegramText({
          ticker: a.ticker,
          newsTitle: a.newsTitle,
          reason: reasonText,
          action: "auto_remove",
          shadow: !autoRemoveEnabled,
          alertsUrl: deps.alertsUrl,
        }),
      );
    } else if (recommendedAction === "alert_only") {
      // 경보 — 대시보드(news_warning)만, 텔레그램 미발송(스팸 방지)
      alerts.push({
        alertType: "news_warning",
        ticker: a.ticker,
        severity: a.severity,
        triggerReason: reasonText,
        signalSentAt: deps.nowIso,
        outcomeAt: null,
        t7PriceChange: null,
        decisionRecorded: null,
        decisionMemo: null,
      });
    }
    // held_by_brake는 run-level 요약 알림으로 처리(아래)
  }

  // ── run-level brake 요약 알림(대량 제외 감지·검토 요망) ──
  if (brake.brakeTriggered) {
    const summary = `대량 제외 감지·검토 요망: ${autoCandidates.length}건 보류 (${brake.reasons.join(", ")})`;
    alerts.push({
      alertType: "news_warning",
      ticker: null,
      severity: "warning",
      triggerReason: summary,
      signalSentAt: deps.nowIso,
      outcomeAt: null,
      t7PriceChange: null,
      decisionRecorded: null,
      decisionMemo: null,
    });
    telegrams.push(
      buildM12aTelegramText({
        ticker: null,
        newsTitle: `대량 제외 감지 ${autoCandidates.length}건`,
        reason: `검토 요망 (${brake.reasons.join(", ")})`,
        action: "hold_for_review",
        shadow: !autoRemoveEnabled,
        alertsUrl: deps.alertsUrl,
      }),
    );
  }

  // ── 4) mutation: auto ON + brake pass + 실 removed만 (shadow면 미호출 = mutation 0) ──
  const removed = await applyAutoRemoveMutation({
    enabled: autoRemoveEnabled,
    brakeTriggered: brake.brakeTriggered,
    cashoutByTicker: removedCashoutByTicker,
    applyAutoRemove: deps.applyAutoRemove,
  });

  // ── 5) durable ledger 영속(shadow/held/removed 전부 기록) ──
  await deps.insertAssessments(rows);

  // ── 6) 알림: /admin durable + 텔레그램 best-effort(실패해도 미escalate) ──
  if (alerts.length > 0) await deps.insertAlertEvents(alerts);
  let telegramsSent = 0;
  for (const text of telegrams) {
    try {
      const res = await deps.sendTelegram(text);
      if (res.success) telegramsSent += 1;
    } catch {
      // best-effort — /admin durable alert가 catch-up (D10)
    }
  }

  return {
    skipped: false,
    runId: deps.runId,
    shadow: !autoRemoveEnabled,
    assessmentCount: assessments.length,
    autoRemoveCandidates: autoCandidates.length,
    removedCount: removed.tickers.length,
    shadowedCount,
    heldByBrakeCount,
    alertOnlyCount,
    brakeTriggered: brake.brakeTriggered,
    brakeReasons: brake.reasons,
    telegramsSent,
    attentionTickers,
  };
}
