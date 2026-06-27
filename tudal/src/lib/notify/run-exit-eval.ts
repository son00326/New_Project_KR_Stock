import type { AlertEvent } from "@/types/admin";
import {
  buildExitSignalAlert,
  evaluateExitSignal,
  type ExitPosition,
  type ExitSignal,
  type ExitSignalConfig,
} from "@/lib/notify/exit-signal";
import { buildExitTelegramText, dispatchExitSignal } from "@/lib/notify/exit-dispatch";

// ---------------------------------------------------------------------------
// M15 Exit 시그널 생성 orchestrator (S7c, 2026-06-27)
// 보유 포지션 → evaluateExitSignal → durable alert_event(exit_signal) + 텔레그램 best-effort.
// 순수 DI(env 미접근) — 게이트(isExitSignalEnabled)는 cron 호출부가 담당(shadow-first).
// ---------------------------------------------------------------------------

export interface RunExitSignalEvalDeps {
  now: Date;
  /** durable INSERT — alert_event(exit_signal). 항상 호출(텔레그램 실패여도 catch-up). */
  insertAlerts: (
    events: Array<Omit<AlertEvent, "id" | "isRead">>,
  ) => Promise<void>;
  sendTelegram: (
    text: string,
  ) => Promise<{ success: boolean; mockMode: boolean; error?: string }>;
  config?: ExitSignalConfig;
}

export interface RunExitSignalEvalResult {
  evaluated: number;
  signals: number;
  inserted: number;
  telegramDelivered: number;
}

export async function runExitSignalEval(
  positions: ExitPosition[],
  deps: RunExitSignalEvalDeps,
): Promise<RunExitSignalEvalResult> {
  const signals: ExitSignal[] = [];
  for (const position of positions) {
    const sig = evaluateExitSignal(position, deps.config);
    if (sig) signals.push(sig);
  }

  const alerts = signals.map((s) => buildExitSignalAlert(s, deps.now));

  // durable는 항상 먼저 INSERT (텔레그램과 독립 안전망).
  if (alerts.length > 0) {
    await deps.insertAlerts(alerts);
  }

  let telegramDelivered = 0;
  for (const alert of alerts) {
    const outcome = await dispatchExitSignal({
      telegramText: buildExitTelegramText(alert),
      sendTelegram: deps.sendTelegram,
    });
    if (outcome.telegramDelivered) telegramDelivered += 1;
  }

  return {
    evaluated: positions.length,
    signals: signals.length,
    inserted: alerts.length,
    telegramDelivered,
  };
}
