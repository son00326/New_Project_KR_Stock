// ---------------------------------------------------------------------------
// M12a 환경 게이트 (GAP4 shadow-first).
//   - M12A_NEWS_EVAL_ENABLED: M12a run 자체(AI 비용) 게이트. off → 미호출(byte-identical).
//   - M12A_AUTO_REMOVE_ENABLED: mutation 게이트. default false = shadow(would-remove만, mutation 0).
//
// 유일한 env 경계 — pure 모듈(verdict/brake/ledger/cashout/...)은 env 미접근.
// shadow phase = NEWS_EVAL on + AUTO_REMOVE off → 이벤트/ledger/알림만, short_list_30/portfolio_snapshot 무변경.
// ---------------------------------------------------------------------------

export function isM12aNewsEvalEnabled(): boolean {
  return process.env.M12A_NEWS_EVAL_ENABLED === "true";
}

export function isM12aAutoRemoveEnabled(): boolean {
  return process.env.M12A_AUTO_REMOVE_ENABLED === "true";
}
