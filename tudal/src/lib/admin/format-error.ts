// FixPlan-46 §P1.1 — 어드민 server action 에러 코드 → 한국어 운영자 메시지 변환.
// omxy 합의 Round 6 CONVERGED: prefix handler + credentials 방어 매핑 + Korean passthrough + dev-only warn.
//
// 사용 위치 (admin client panels/forms):
//   - portfolio-panel.tsx / regenerate-panel.tsx / exit-decision-form.tsx
//   - settings-form.tsx / brokerage·binance form.tsx + delete-button.tsx
//
// KOREAN_MAPPINGS는 서버 액션 코드 inventory snapshot (46차 기준). 신규 코드 추가 시 이 표 + 테스트
// inventory도 같이 갱신해야 한다.

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
  // S7a §11 — 합의 배지·월간 배치·페르소나 평가·AI 호출 에러
  consensus_rank_invalid: "합의 배지 산출 로직 오류 — 어드민에게 보고 필요",
  consensus_undefined_case: "합의 배지 정의 누락 — D19 spec 확인 필요",
  batch_already_running:
    "이번 달 분석이 이미 진행 중입니다. 진행률은 admin 화면에서 확인하세요.",
  batch_already_completed:
    "이번 달 분석이 이미 완료되었습니다. 다시 실행하려면 명시적 rerun 액션을 사용하세요.",
  persona_eval_fatal: "분석 실행 중 치명적 오류 — 운영자 검토 필요",
  ai_call_failed: "AI 호출 실패 — 분석 결과 ⚪(분석 대기)로 처리됨",
  // PR1 — orchestrator + persist + commit_badge_only error codes (54차 §4 v8)
  tier1_candidates_must_be_150: "Tier 0 후보 수가 150개가 아닙니다",
  tier1_screening_failed: "Tier 1 평가에 실패했습니다",
  shortlist_persist_failed: "Short List 저장에 실패했습니다",
  commit_badge_only_failed: "배지 commit에 실패했습니다",
  // MF5 fix (3-track deep-review #8): orchestrator/persist/lock/alert throw 코드 매핑 보강.
  tier1_candidates_have_duplicate_tickers: "Tier 0 후보에 중복 종목코드가 있습니다",
  assigned_timeframe_null_for_selected: "선정 종목에 시간대 정보가 누락되었습니다",
  batch_lock_acquire_failed: "월간 배치 락 획득에 실패했습니다",
  batch_lock_release_failed: "월간 배치 락 해제에 실패했습니다",
  scheduler_fail_alert_insert_failed: "실패 알림 저장에 실패했습니다",
  tier0_source_not_wired_pr1_followup: "Tier 0 데이터 소스가 아직 연결되지 않았습니다 (후속 PR)",
  persona_panel_not_wired_pr1_followup: "AI 페르소나 패널이 아직 연결되지 않았습니다 (후속 PR)",
  commit_badge_only_not_wired_pr1_followup: "배지 commit RPC가 아직 연결되지 않았습니다 (후속 PR)",
  cron_caller_requires_service_role: "Cron 호출자는 service-role 권한이 필요합니다",
  invalid_caller_kind: "잘못된 호출자 종류입니다",
  service_role_key_missing: "서비스 키 환경 변수가 설정되지 않았습니다",
  supabase_url_missing: "Supabase URL 환경 변수가 설정되지 않았습니다",
  // PR3b — writer Section 0~7 풀 리포트 (omxy R1 P0 #4 fix)
  full_report_llm_failed: "풀 리포트 AI 호출 실패 — 잠시 후 다시 시도하세요",
  full_report_validation_failed: "풀 리포트 본문 검증 실패",
  full_report_parse_failed: "풀 리포트 AI 응답 파싱 실패",
  update_report_sections_0_7_failed: "풀 리포트 본문 저장 실패",
  report_not_found_for_section_0_7_update: "리포트 row 부재 — Section 0~7 UPDATE 실패 (commit_persona_eval 선행 필요)",
};

export function formatErrorMessage(code: string): string {
  if (code in KOREAN_MAPPINGS) return KOREAN_MAPPINGS[code];
  // accept_gate_blocked:* prefix → 게이트 종류는 숨김 (P1.1 hotfix scope).
  // 후속에서 hold_24h / viewers_insufficient 별 안내로 분기 가능.
  if (code.startsWith("accept_gate_blocked:")) {
    return "승인 조건을 충족하지 못했습니다";
  }
  // PR1 B10 fix (omxy R2) — orchestrator suffix throw 호환:
  //   `tier1_candidates_must_be_150 (got N)` / `shortlist_persist_failed:<code>`
  if (code.startsWith("tier1_candidates_must_be_150")) {
    return KOREAN_MAPPINGS["tier1_candidates_must_be_150"];
  }
  if (
    code.startsWith("shortlist_persist_failed:") ||
    code.startsWith("shortlist_persist_failed ")
  ) {
    return KOREAN_MAPPINGS["shortlist_persist_failed"];
  }
  // MF5 fix (3-track deep-review #8) — suffix throw 호환 prefix handler 추가.
  if (code.startsWith("tier1_candidates_have_duplicate_tickers")) {
    return KOREAN_MAPPINGS["tier1_candidates_have_duplicate_tickers"];
  }
  if (code.startsWith("assigned_timeframe_null_for_selected:")) {
    return KOREAN_MAPPINGS["assigned_timeframe_null_for_selected"];
  }
  if (code.startsWith("batch_lock_release_failed:")) {
    return KOREAN_MAPPINGS["batch_lock_release_failed"];
  }
  if (code.startsWith("scheduler_fail_alert_insert_failed:")) {
    return KOREAN_MAPPINGS["scheduler_fail_alert_insert_failed"];
  }
  // PR3b prefix handler 3종 (omxy R1 P0 #4 fix) — suffix throw 호환:
  //   full_report_validation_failed:<section>:<path>
  //   full_report_parse_failed:<reason>
  //   update_report_sections_0_7_failed:<code>
  if (code.startsWith("full_report_validation_failed:")) {
    return (
      KOREAN_MAPPINGS["full_report_validation_failed"] +
      " (" +
      code.slice("full_report_validation_failed:".length) +
      ")"
    );
  }
  if (code.startsWith("full_report_parse_failed:")) {
    return (
      KOREAN_MAPPINGS["full_report_parse_failed"] +
      " (" +
      code.slice("full_report_parse_failed:".length) +
      ")"
    );
  }
  if (code.startsWith("update_report_sections_0_7_failed:")) {
    return (
      KOREAN_MAPPINGS["update_report_sections_0_7_failed"] +
      " (" +
      code.slice("update_report_sections_0_7_failed:".length) +
      ")"
    );
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
