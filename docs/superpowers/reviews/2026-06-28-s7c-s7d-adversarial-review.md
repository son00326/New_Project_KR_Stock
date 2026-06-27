# S7c+S7d 적대적 리뷰 — Claude 6-lens Workflow + adversarial verify

- Date: 2026-06-28
- Target: S7c+S7d alerts/monitoring shadow-first 슬라이스 (commit `9906991`)
- Method: Claude dynamic Workflow — 6 독립 attack lens(shadow-first / connection-points / correctness / test-quality / migration-security / regression-orphans) → 각 finding adversarial verify(refute-by-default). omxy cmux peer는 Codex TUI 미기동(nested tmux bash shell)으로 비가용 → 프로젝트 §7.7 "reviewer 부재 대체" + ultracode Workflow로 진행.
- 결과: **29 raw → 20 confirmed (HIGH 1 / MED 9 / LOW 10), 9 refuted.**

## 확정 결함 + 해소

### HIGH — record_alert_exit_decision dead-on-arrival (production 차단)
- 결함: spec §1.7가 "authenticated grant"라 주장했으나 **0015a(46차)가 authenticated EXECUTE revoke**(미사용 처리). 새 action이 authenticated 세션 client로 RPC 호출 → **42501 permission denied**(DEFINER 본문 이전). action 매핑이 42501 미처리 → 오해성 `exit_decision_write_failed`. unit test가 RPC mock으로 false green([[feedback_mocked_rpc_hides_check_violation]] 패턴).
- 해소: **마이그 0045 `grant ... to authenticated` 재부여**(0015a "필요 시 re-grant" 예고대로, RPC self-gate is_admin이라 안전) + `.rollback` + `pg_smoke_0045.sh`(0010→0015a→0045 모델, load-bearing pre-assert) + action `exit_decision_grant_missing` 매핑(code 42501/`permission denied`) + format-error 한국어(마이그 0045 안내) + 2 action 테스트 + spec §1.7 정정. USER apply-only.

### MED (9, dedup→5 실질)
- exit-outcome KRX 캐시 무효(per-ticker 전종목 재fetch) → **basDd별 전종목 1회 fetch 캐시**.
- exit-outcome alert 윈도(limit 500 전 타입 newest-desc) starvation → **`getDueExitOutcomeAlerts`** DB-level filter(exit_signal∧outcome null, ASC).
- T+6/T+7 race(T+7 당일 cutoff 전 T+6 종가 오적재) → **`isT7AnchorReady`** close-ready guard.
- exit-outcome cron 무테스트 → **route 테스트**(flag off/no-key skip·happy·close-ready·starvation·fail-soft).
- pg_smoke_0044 grant-matrix vacuous → **load-bearing 보강**(anon/authenticated 직접 grant 후 revoke 검증).

### LOW (10, 채택분)
- getUnreadAlertCount is_read 필터 미pin → eq 인자 assert.
- getLatestHeartbeatLog 'ok' pass-through 미pin → 'ok' 케이스 추가(always-red_alert mutation 제거).
- silent-health 'email 없음' vacuous → route 소스 정적 검사(resend/sendEmail import 0)로 격상.
- computeT7PriceChangePct 3-decimal 미pin → toFixed(2) mutant 죽는 값(3.333)으로 교체.
- isExitOutcomeEnabled truthy-non-'true' 케이스 추가(=== mutation pin).

### 추가(리뷰 refute였으나 자체 판단 채택) — 미사용 flag 배선
- `isIntradayMonitorEnabled`/`isExitSignalEnabled`가 **zero consumer**(dead flag, verify는 shadow-first라 NONE 판정). 자체 판단으로 producer 실배선:
  - exit-signal: **dormant cron `/api/cron/exit-signal` + `runExitSignalEval`**(isExitSignalEnabled 소비, end-to-end durable+telegram).
  - intraday: **`runIntradayMonitorPass`**(isIntradayMonitorEnabled 소비) + `insertIntradayAnomalies`(0007 dedup) — WS 워커 seam.

## refuted (정당한 비-결함)
- buildExitAlternatives orphan → notification-time 헬퍼(page는 ExitSignal 컨텍스트 미영속), spec 문구 정정으로 정합.
- buildHeartbeatEmailSubject orphan → 미사용 export(test-only), 행동 영향 0.
- vercel.json exit-outcome 미등록 → dormant 패턴(USER go-live schedule) 의도.
- flag zero-consumer 자체 = 위 producer 배선으로 해소.

## 게이트
build/lint/tsc green · test:ci 2445 passed/5 skip(+100 from 2345 baseline) · PG smoke 0044/0045 PASS.
