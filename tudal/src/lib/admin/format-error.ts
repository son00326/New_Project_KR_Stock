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
  // W0 D28 ③ rename: legacy hardcap error key → cost_hardcap_exceeded (65차 LOCKED #5 50만 + cap-agnostic).
  cost_hardcap_exceeded: "월 AI 비용 한도(50만원)를 초과했습니다",
  // W0 D28 비용가드: 모델 레지스트리/preflight 신규 throw 코드 한국어 매핑.
  pricing_unknown_model: "미등록 AI 모델 단가입니다 — 모델 레지스트리 등록이 필요합니다",
  preflight_reservation_missing: "비용 예약 정보가 누락되어 AI 호출을 차단했습니다 (운영자 확인 필요)",
  preflight_reservation_invalid: "비용 예약 값이 올바르지 않아 AI 호출을 차단했습니다 (운영자 확인 필요)",
  cost_logging_disabled: "AI 비용 로깅이 비활성화되어 실 AI 호출을 차단했습니다 (운영자: AI_COST_LOG_REAL_INSERT_ENABLED 확인)",
  manual_cap_exhausted: "수동 재생성 한도(월 2회)를 모두 사용했습니다",
  report_lookup_failed: "리포트 조회 실패 — 다시 시도해주세요",
  report_not_found: "리포트를 찾을 수 없습니다",
  regen_counter_lookup_failed: "재생성 카운터 조회에 실패했습니다. 잠시 후 다시 시도하세요",
  regen_counter_write_failed: "재생성 카운터 저장에 실패했습니다. 잠시 후 다시 시도하세요",
  regen_counter_write_conflict: "다른 어드민이 동시에 재생성 중입니다. 잠시 후 다시 시도하세요",
  // 58차 Mock cleanup Step 2.3 — regenerate cost_log 실 SELECT 통로 (getMonthlyTotal throw 매핑).
  // regenerate convention (`_lookup_failed`) 정합 — cost_log_select_failed는 cost-logger.ts 내부
  // throw 표면이라 별도 매핑(line ~114) 유지, 본 코드는 regenerate caller가 catch 후 반환.
  cost_log_lookup_failed: "비용 한도 조회 실패 — 잠시 후 다시 시도하세요",
  // PR4 Step 2.3 — regenerate orchestrate wire 신규 코드 (omxy R1 B29 fix).
  shortlist_item_not_found: "이번 달 Short List에서 해당 종목을 찾을 수 없습니다",
  orchestrate_full_report_failed: "풀 리포트 생성에 실패했습니다 — 잠시 후 다시 시도하세요",
  // PR4 Task 9 — 인벤토리 완전성 (track-record/actions.ts triggerMonthlyPersonaEvalAction 박제).
  // dangling caller지만 server action error code 미매핑 = 운영 위험. 방어적 박제.
  admin_required: "어드민 권한이 필요합니다",
  shortlist_empty: "이번 달 Short List가 비어 있습니다",
  // PR4 Task 9 omxy R1 B41 fix — AI client throw (PR4 reachable via triggerFullReport/regenerateReport
  // → orchestrate → callFullReport/callCritic/callRevise). format-error 미매핑 시 UI에 raw 영문 노출.
  ai_key_unavailable: "AI 키가 설정되지 않았습니다 — 운영 환경 변수를 확인하세요",
  // PR4 Task 9 watch — writer.ts dangling caller (triggerMonthlyPersonaEvalAction PR3c era) 박제.
  writer_persona_count_mismatch: "AI 평가 결과 개수가 일치하지 않습니다",
  sector_writer_persona_count_mismatch: "섹터 AI 평가 결과 개수가 일치하지 않습니다",
  // PR4 Task 9 Track 2 C-3 fix: track-record/actions.ts + archive query throw 매핑.
  // financials_fetch_failed:* prefix throw + archive 3종 query failures (Server Component error boundary 보호).
  financials_corp_lookup_failed: "재무 데이터 조회 실패 — 잠시 후 다시 시도하세요",
  financials_fetch_failed: "재무 데이터 조회 실패 — 잠시 후 다시 시도하세요",
  stock_reports_archive_query_failed: "월별 아카이브 조회 실패 (stock_reports)",
  short_list_30_archive_query_failed: "월별 아카이브 조회 실패 (short_list_30)",
  portfolio_approval_archive_query_failed: "월별 아카이브 조회 실패 (portfolio_approval)",
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
  // Mock cleanup Step 1.3 R2 (omxy Gödel HIGH fix): accept gate가 real DB SELECT 의존 후 throw 가능 시
  accept_gate_lookup_failed: "승인 게이트 조회 실패 — 잠시 후 다시 시도해주세요",
  // alerts
  alert_not_found: "알림을 찾을 수 없습니다",
  already_decided: "이미 결정된 알림입니다",
  not_exit_signal: "Exit 신호 알림이 아닙니다",
  // Mock cleanup Step 2.1 R1 (omxy MEDIUM fix): real alert_event lookup이 throw 시 한국어 매핑.
  alert_lookup_failed: "알림 조회 실패 — 다시 시도해주세요",
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
  // W2b (D27 Q5) — incumbent union + pool range gate
  tier1_candidates_pool_out_of_range:
    "후보 풀 크기가 트랙 허용 범위를 벗어났습니다 (fresh+incumbent)",
  incumbents_count_exceeded: "직전 리스트(incumbent) 수가 트랙 허용치를 초과했습니다",
  incumbents_query_failed: "직전 리스트(incumbent) 조회에 실패했습니다",
  // W1a (D26 Q4) — mix slot + R2 반박 라운드
  tier1_panel_slot_out_of_range: "패널 슬롯 인덱스가 범위를 벗어났습니다 (Core 11)",
  r2_enqueue_failed: "반박 라운드(R2) 작업 등록에 실패했습니다",
  debate_r1_panel_missing: "반박 라운드 입력(1차 평가)이 없어 해당 종목을 건너뜁니다",
  debate_r1_prior_missing: "반박 라운드 입력에 일부 위원의 1차 평가가 없습니다",
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
  // B65-P3 옵션 A — admin-only UPSERT RPC (마이그 0025) error 코드.
  upsert_report_sections_0_7_admin_failed: "리포트 본문 저장 실패 (admin UPSERT)",
  upsert_report_sections_0_7_admin_failed_no_returning: "리포트 본문 저장 실패 — UPSERT returning 부재 (안전망 발동)",
  // PR3b R6 non-blocking catch — cost_log throw 경로 매핑 누락 (preflightHardcap 호출 중 발생 가능)
  // cost_hardcap_exceeded는 이미 regenerate 섹션에 매핑 박제됨 — 본 PR에서 추가 매핑 0.
  cost_log_select_failed: "비용 로그 조회 실패",
  cost_log_insert_failed: "비용 로그 저장 실패",
  // Mock cleanup Step 2.5 — pipeline_health 실 SELECT 통로 error 매핑.
  pipeline_health_select_failed: "파이프라인 헬스 조회 실패",
  // Mock cleanup Step 2.6 — news_event 실 SELECT 통로 error 매핑 (cron + admin alerts page 공통).
  news_event_select_failed: "뉴스 조회 실패",
  news_event_invalid_severity: "뉴스 분류값이 올바르지 않습니다",
  news_event_invalid_severity_filter: "뉴스 분류 필터값이 올바르지 않습니다",
  // PR3c — 3-step orchestration critic + revise + sector_reference_backlog + report_critic_findings (omxy R6 CONVERGED)
  critic_llm_failed: "AI 검증 단계가 실패했습니다",
  critic_parse_failed: "AI 검증 응답을 파싱할 수 없습니다",
  critic_validation_failed: "AI 검증 응답이 형식을 어겼습니다",
  revise_llm_failed: "AI 재작성 단계가 실패했습니다",
  revise_parse_failed: "AI 재작성 응답을 파싱할 수 없습니다",
  orchestrate_failed: "보고서 생성 흐름이 실패했습니다",
  sector_reference_backlog_rpc_failed: "섹터 reference 추적 저장이 실패했습니다",
  sector_reference_backlog_invalid_sector: "섹터 값이 올바르지 않습니다",
  report_critic_findings_rpc_failed: "AI 검증 결과 저장이 실패했습니다",
  report_critic_findings_list_failed: "AI 검증 결과 조회가 실패했습니다",
  // PR-H — report enrich / report-worker admin trigger 신규 표면 코드.
  report_worker_failed: "리포트 배치 실행에 실패했습니다 — 잠시 후 다시 시도하세요",
  enrich_failed: "리포트 입력 보강에 실패했습니다 — 잠시 후 다시 시도하세요",
  pr5_cron_auto_disabled: "리포트 배치 자동 실행이 비활성화되어 있습니다",
  cron_system_user_id_invalid: "Cron 시스템 사용자 ID 설정이 올바르지 않습니다",
  cron_system_user_not_found: "Cron 시스템 사용자를 찾을 수 없습니다",
  // 출시前 launch-readiness 감사 (omxy 교차검증 ROUND 1, 2026-06-03) — 미매핑 server-action error code 보강.
  // AI-ENGINE-CONTRACT-1 — monthly-batch-orchestrator가 throw하는 `tier1_panel_incomplete:<done>/<total>`
  //   (PR-G 실 AI 재선정 시 150 중 일부 패널 degraded). triggerMonthlyBatch raw 반환 → portfolio-panel 노출.
  tier1_panel_incomplete: "Tier 1 AI 평가가 일부 종목에서 완료되지 못했습니다 — 잠시 후 다시 시도하세요",
  // TRACK-RECORD-1 — triggerMonthlyBatch(portfolio/actions.ts)의 non-Error catch-all fallback 코드.
  //   (format-error엔 'orchestrate_failed'만 있었음 — 'orchestrator_failed'는 별개 미매핑.)
  orchestrator_failed: "월간 배치 실행에 실패했습니다 — 잠시 후 다시 시도하세요",
  // W2a wiring audit — old single-shot monthly-batch path is no longer a viable live selector.
  monthly_batch_single_shot_deprecated:
    "30 재선정 단발 경로는 비활성화되었습니다 — selection-worker 청크 경로를 사용하세요",
  // CRON-REPORT-1 — full-report-batch-worker 인프라 throw codes (admin report-worker 트리거 노출 경로).
  short_list_30_invalid_count: "이번 달 Short List가 30종목이 아닙니다 — 먼저 30선정을 완료하세요",
  report_batch_worker_failed: "리포트 배치 처리에 실패했습니다 — 잠시 후 다시 시도하세요",
};

export function formatErrorMessage(code: string): string {
  if (code in KOREAN_MAPPINGS) return KOREAN_MAPPINGS[code];
  if (
    code.startsWith("pricing_unknown_model:") ||
    code.startsWith("pricing_unknown_model ")
  ) {
    return KOREAN_MAPPINGS["pricing_unknown_model"];
  }
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
  // W2a 트랙 분리 후 fresh pool 50/100 변형 (`tier1_candidates_must_be_50 (got N)` 등) — 일반화 매핑.
  if (code.startsWith("tier1_candidates_must_be_")) {
    return "Tier 0 후보 수가 트랙 기대치와 다릅니다";
  }
  // W1a (D26 Q4) — suffix throw 호환 (`:idx` / `:<pg code>` / `:ticker` / `:persona` / `:status` 숨김).
  if (code.startsWith("tier1_panel_slot_out_of_range")) {
    return KOREAN_MAPPINGS["tier1_panel_slot_out_of_range"];
  }
  if (code.startsWith("r2_enqueue_failed")) {
    return KOREAN_MAPPINGS["r2_enqueue_failed"];
  }
  if (code.startsWith("debate_r1_panel_missing")) {
    return KOREAN_MAPPINGS["debate_r1_panel_missing"];
  }
  if (code.startsWith("debate_r1_prior_missing")) {
    return KOREAN_MAPPINGS["debate_r1_prior_missing"];
  }
  // W1a (D9) — transient 분류 suffix는 기존 ai_call_failed 메시지 재사용.
  if (code.startsWith("ai_call_failed:transient")) {
    return KOREAN_MAPPINGS["ai_call_failed"];
  }
  // W2b (D27 Q5) — suffix throw 호환 (`:track:N` / `:N>M` / `:<pg code>` 숨김).
  if (code.startsWith("tier1_candidates_pool_out_of_range")) {
    return KOREAN_MAPPINGS["tier1_candidates_pool_out_of_range"];
  }
  if (code.startsWith("incumbents_count_exceeded")) {
    return KOREAN_MAPPINGS["incumbents_count_exceeded"];
  }
  if (code.startsWith("incumbents_query_failed")) {
    return KOREAN_MAPPINGS["incumbents_query_failed"];
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
  // B65-P3 옵션 A — upsert_report_sections_0_7_admin_failed:<pg-code> suffix throw 호환.
  if (code.startsWith("upsert_report_sections_0_7_admin_failed:")) {
    return (
      KOREAN_MAPPINGS["upsert_report_sections_0_7_admin_failed"] +
      " (" +
      code.slice("upsert_report_sections_0_7_admin_failed:".length) +
      ")"
    );
  }
  // PR4 Task 9 Track 2 C-3 fix: financials_fetch_failed:* + archive query failed:* prefix handlers.
  if (code.startsWith("financials_corp_lookup_failed:")) {
    return KOREAN_MAPPINGS["financials_corp_lookup_failed"];
  }
  if (code.startsWith("financials_fetch_failed:")) {
    return KOREAN_MAPPINGS["financials_fetch_failed"];
  }
  if (code.startsWith("stock_reports_archive_query_failed:")) {
    return KOREAN_MAPPINGS["stock_reports_archive_query_failed"];
  }
  if (code.startsWith("short_list_30_archive_query_failed:")) {
    return KOREAN_MAPPINGS["short_list_30_archive_query_failed"];
  }
  if (code.startsWith("portfolio_approval_archive_query_failed:")) {
    return KOREAN_MAPPINGS["portfolio_approval_archive_query_failed"];
  }
  // PR3b R6 non-blocking catch: cost_log throw 코드는 suffix:<pg-code> 패턴 동반.
  if (code.startsWith("cost_log_select_failed:")) {
    return KOREAN_MAPPINGS["cost_log_select_failed"];
  }
  if (code.startsWith("cost_log_insert_failed:")) {
    return KOREAN_MAPPINGS["cost_log_insert_failed"];
  }
  // Mock cleanup Step 2.5 — pipeline_health_select_failed:<pg-code | invalid_pipeline | invalid_status | non_finite_latency | negative_latency>
  if (code.startsWith("pipeline_health_select_failed:")) {
    return KOREAN_MAPPINGS["pipeline_health_select_failed"];
  }
  // Mock cleanup Step 2.6 — news_event_select_failed:<pg-code> + invalid_severity:<val> + invalid_severity_filter:<val>
  if (code.startsWith("news_event_select_failed:")) {
    return KOREAN_MAPPINGS["news_event_select_failed"];
  }
  if (code.startsWith("news_event_invalid_severity:")) {
    return KOREAN_MAPPINGS["news_event_invalid_severity"];
  }
  if (code.startsWith("news_event_invalid_severity_filter:")) {
    return KOREAN_MAPPINGS["news_event_invalid_severity_filter"];
  }
  // PR3c — orchestrate / critic / revise / backlog / critic_findings suffix throw 호환 4 prefix:
  if (code.startsWith("critic_validation_failed:") || code.startsWith("critic_parse_failed:") || code.startsWith("critic_llm_failed:")) {
    if (code.startsWith("critic_validation_failed:")) return KOREAN_MAPPINGS["critic_validation_failed"];
    if (code.startsWith("critic_parse_failed:")) return KOREAN_MAPPINGS["critic_parse_failed"];
    return KOREAN_MAPPINGS["critic_llm_failed"];
  }
  if (code.startsWith("revise_parse_failed:") || code.startsWith("revise_llm_failed:")) {
    if (code.startsWith("revise_parse_failed:")) return KOREAN_MAPPINGS["revise_parse_failed"];
    return KOREAN_MAPPINGS["revise_llm_failed"];
  }
  if (code.startsWith("orchestrate_failed:")) {
    return KOREAN_MAPPINGS["orchestrate_failed"];
  }
  if (code.startsWith("sector_reference_backlog_rpc_failed:")) {
    return KOREAN_MAPPINGS["sector_reference_backlog_rpc_failed"];
  }
  if (code.startsWith("sector_reference_backlog_invalid_sector:")) {
    return KOREAN_MAPPINGS["sector_reference_backlog_invalid_sector"];
  }
  if (code.startsWith("report_critic_findings_rpc_failed:")) {
    return KOREAN_MAPPINGS["report_critic_findings_rpc_failed"];
  }
  if (code.startsWith("report_critic_findings_list_failed:")) {
    return KOREAN_MAPPINGS["report_critic_findings_list_failed"];
  }
  // 출시前 감사 (omxy 교차검증 ROUND 1) — suffix throw 호환 prefix handlers.
  // AI-ENGINE-CONTRACT-1: `tier1_panel_incomplete:<done>/<total>` (orchestrator throw).
  if (
    code.startsWith("tier1_panel_incomplete:") ||
    code.startsWith("tier1_panel_incomplete ")
  ) {
    return KOREAN_MAPPINGS["tier1_panel_incomplete"];
  }
  // CRON-REPORT-1: `short_list_30_invalid_count:<n>` (worker abortBeforeSpend throw).
  if (code.startsWith("short_list_30_invalid_count:")) {
    return KOREAN_MAPPINGS["short_list_30_invalid_count"];
  }
  // CRON-REPORT-1: report-worker DB-fault codes (각 `:<pg-code>` suffix) → 단일 generic 운영자 메시지.
  if (
    code.startsWith("acquire_lock_failed:") ||
    code.startsWith("release_report_worker_lock_failed:") ||
    code.startsWith("mark_report_job_failed:") ||
    code.startsWith("claim_next_report_jobs_failed:") ||
    code.startsWith("report_batch_enqueue_failed:") ||
    code.startsWith("report_batch_count_failed:") ||
    code.startsWith("report_batch_defer_failed:") ||
    code.startsWith("report_job_reset_failed:")
  ) {
    return KOREAN_MAPPINGS["report_batch_worker_failed"];
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
