// S7c 장중·Exit 알림 shadow-first 게이트 (2026-06-27).
// 패턴 = lib/news/m12a/flags.ts · lib/macro/source.ts (`=== "true"` default off).
// 모든 flag off(default) → 장중 모니터/Exit 평가/T+7 적재 미실행 → byte-identical·writes 0·실 AI/비용 0.
// KIS WS 키 auto-detect는 isKisWebSocketConfigured()(kis-websocket.ts) 별도 — 키 부재 = mock-mode no-op.

/** 장중 이상 감지 모니터 pass 실행 게이트 (M13/M14). off → no-op·writes 0. */
export function isIntradayMonitorEnabled(): boolean {
  return process.env.INTRADAY_MONITOR_ENABLED === "true";
}

/** Exit 시그널 평가·디스패치 게이트 (M15). off → no-op. */
export function isExitSignalEnabled(): boolean {
  return process.env.EXIT_SIGNAL_ENABLED === "true";
}

/** T+7 outcome cron write 게이트. off → 200 skip·writes 0. */
export function isExitOutcomeEnabled(): boolean {
  return process.env.EXIT_OUTCOME_ENABLED === "true";
}
