// FixPlan-46 §P1.1 — 어드민 server action 에러 코드 → 한국어 운영자 메시지 변환.
// omxy 합의 Round 6 CONVERGED: prefix handler + credentials 방어 매핑 + Korean passthrough + dev-only warn.
//
// 사용 위치 (admin client panels/forms):
//   - portfolio-panel.tsx / regenerate-panel.tsx / exit-decision-form.tsx
//   - settings-form.tsx / brokerage·binance form.tsx + delete-button.tsx
//
// KOREAN_MAPPINGS는 서버 액션 코드 inventory snapshot (46차 + 50차 §2.C). 신규 코드 추가 시 이 표 + 테스트
// inventory도 같이 갱신해야 한다.
//
// 50차 §2.C (S7a Anthropic wrapper PR #1과 독립 hotfix branch): 13 신규 코드 — anthropic-client /
// cost-logger / writer / admin-batch-runs / track-record actions 에서 emit하는 에러를 한국어 운영자
// 메시지로 매핑. PR #1 merge 후 자동 작동.

const KOREAN_MAPPINGS: Record<string, string> = {
  // 인증·세션 공통
  auth_unavailable: "로그인이 필요합니다",
  // 입력 검증 공통
  invalid_input: "입력값이 올바르지 않습니다",
  invalid_month: "월 값이 올바르지 않습니다 (YYYY-MM-01 형식)",
  invalid_ticker: "종목코드가 올바르지 않습니다",
  invalid_decision: "결정 값이 올바르지 않습니다",
  invalid_memo: "메모가 올바르지 않습니다",
  invalid_reason: "사유가 올바르지 않습니다",
  invalid_intraday_mode: "장중 모드 값이 올바르지 않습니다",
  invalid_ticker_alert_enabled: "알림 토글 값이 올바르지 않습니다",
  ticker_required: "종목코드가 필요합니다",
  reason_too_short: "사유는 10자 이상 입력해주세요",
  // regenerate
  cost_hardcap_40man: "월 AI 비용 한도(40만원)를 초과했습니다",
  manual_cap_exhausted: "수동 재생성 한도(월 2회)를 모두 사용했습니다",
  report_lookup_failed: "리포트 조회 실패 — 다시 시도해주세요",
  report_not_found: "리포트를 찾을 수 없습니다",
  regen_counter_lookup_failed: "재생성 카운터 조회에 실패했습니다. 잠시 후 다시 시도하세요",
  regen_counter_write_failed: "재생성 카운터 저장에 실패했습니다. 잠시 후 다시 시도하세요",
  regen_counter_write_conflict: "다른 어드민이 동시에 재생성 중입니다. 잠시 후 다시 시도하세요",
  // portfolio
  already_finalized: "이미 이번 달 포트가 확정되어 있습니다",
  approval_write_failed: "승인 저장 실패 — 다시 시도하세요",
  approval_lookup_failed: "승인 조회 실패 — 다시 시도해주세요",
  approval_not_found: "해당 승인을 찾을 수 없습니다",
  shortlist_lookup_failed: "Short List 조회 실패 — 다시 시도해주세요",
  shortlist_month_not_found: "이번 달 Short List가 아직 생성되지 않았습니다",
  entry_price_unavailable: "실 가격 소스 미연동 — 현재는 승인할 수 없습니다",
  reanalysis_limit_reached: "재분석 2회를 초과했습니다 — 전월 포트 유지",
  already_disputed: "이미 이의 제기된 승인입니다",
  // alerts
  alert_not_found: "알림을 찾을 수 없습니다",
  already_decided: "이미 결정된 알림입니다",
  not_exit_signal: "Exit 신호 알림이 아닙니다",
  // mock-only 액션 (settings/alerts; production에서 isProductionLike() 분기로 노출)
  real_persistence_not_configured: "이 기능은 production 실 저장이 아직 연결되지 않았습니다",
  unknown_error: "알 수 없는 오류가 발생했습니다",
  // credentials lib 방어 매핑 (lib 레벨도 한국어 직접 반환 — 이중 보호)
  "Invalid id format": "잘못된 ID 형식입니다",
  "pending-s8": "Binance 키 저장은 S8 자동매매에서 활성화됩니다",
  // 50차 §2.C — S7a 인벤토리 13 신규 (6 literal). 7 prefix는 formatErrorMessage 본문 startsWith 처리.
  ai_key_unavailable:
    "AI 키가 설정되지 않았습니다 — ANTHROPIC_API_KEY 환경변수 확인 필요",
  ai_billing_exhausted:
    "Anthropic 결제 한도가 소진되었습니다 — billing 충전 후 재시도",
  batch_lock_acquire_failed: "월간 배치 락 획득 실패 — 잠시 후 다시 시도하세요",
  writer_persona_count_mismatch:
    "페르소나 평가 개수가 일치하지 않습니다 — 운영자 검토 필요",
  admin_required: "어드민 권한이 필요합니다",
  shortlist_empty:
    "이번 달 Short List가 비어 있습니다 — 먼저 스크리닝을 실행하세요",
};

// 50차 §2.C — S7a 인벤토리 7 prefix 매핑 (dynamic suffix를 가지는 코드).
// 모두 `prefix:<error.code | identifier>` 패턴으로 emit되며 suffix는 운영자 메시지에 노출하지 않는다.
// accept_gate_blocked:* 동일 의도. 빈 suffix("prefix:")는 매칭, colon 없는 경우는 fallback으로 떨어진다.
const PREFIX_MAPPINGS: ReadonlyArray<readonly [string, string]> = [
  ["accept_gate_blocked:", "승인 조건을 충족하지 못했습니다"],
  [
    "unknown_persona_id:",
    "지정된 페르소나 ID를 찾을 수 없습니다 — D19 SoT 확인 필요",
  ],
  ["cost_log_insert_failed:", "비용 로그 저장 실패 — 잠시 후 다시 시도하세요"],
  ["cost_log_select_failed:", "비용 로그 조회 실패 — 잠시 후 다시 시도하세요"],
  ["commit_persona_eval_failed:", "페르소나 평가 저장 실패 — 다시 시도하세요"],
  ["commit_badge_only_failed:", "합의 배지 저장 실패 — 다시 시도하세요"],
  ["batch_lock_release_failed:", "월간 배치 락 해제 실패 — 운영자 검토 필요"],
  ["financials_fetch_failed:", "재무 데이터 조회 실패 — 데이터 소스 점검 필요"],
];

export function formatErrorMessage(code: string): string {
  if (code in KOREAN_MAPPINGS) return KOREAN_MAPPINGS[code];
  // prefix 매핑 (accept_gate_blocked:* 동일 패턴, 50차 §2.C 7 신규 포함).
  for (const [prefix, message] of PREFIX_MAPPINGS) {
    if (code.startsWith(prefix)) return message;
  }
  // 한국어가 이미 포함된 메시지(credentials lib 등)는 그대로 통과.
  if (/[가-힣]/.test(code)) return code;
  // 미매핑 영문 코드: 개발 환경에서만 console.warn으로 누락 추적.
  // production console에 raw 코드 남기지 않음 (운영 노이즈 방지).
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    console.warn("[format-error] 미매핑 코드:", code);
  }
  return `오류: ${code}`;
}
