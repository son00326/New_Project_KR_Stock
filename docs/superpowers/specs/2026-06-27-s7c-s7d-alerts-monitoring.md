# S7c 장중·Exit 알림 + S7d Silent Health — shadow-first 빌드 spec

- Date: 2026-06-27
- Branch: `tier0-bpp-multiregime`
- Lane: 출시 핵심 "알림·모니터링" (HANDOFF §2.2 Step 9·10)
- SoT 선행: `Document/Build/Slices/S7-RealData.md` S7c/S7d · `ServicePlan-Admin.md §3.5/§3.10/§3.12` · `Document/Process/HANDOFF.md`
- 가드레일: shadow-first/dormant(신규 flag off → byte-identical·mutation 0·실 AI/비용 0) · 이메일/Resend 전역 미사용(텔레그램 best-effort + `/admin` durable alert만) · MVP 3종 production 무회귀 · 마이그 신설 = `.sql`+`.rollback.sql`+docker-free PG smoke

---

## 0. 현황 (기존 자산 재사용)

S5/S6 mock skeleton이 alerts/monitoring 토대를 이미 박았다. 본 lane = **shadow-first 실배선 + 잔여 이메일 제거 + 순수 Exit/T+7 로직 신규**.

이미 존재(applied):
- `alert_event`(0010) — 12 alert_type CHECK, append-only(UNIQUE 없음), `mark_alert_read`/`record_alert_exit_decision` RPC(authenticated grant).
- `intraday_anomaly_event`(0007) — `dedup_key` UNIQUE(ticker·trigger·1분 bucket).
- `admin_settings.intraday_mode`(0007) + `ticker_alert_pref`(0007, M14 종목 토글, default ON).
- `heartbeat_log`(0008, UNIQUE(date)) · `pipeline_health`(0006).
- 순수 로직: `lib/intraday/anomaly-detect.ts`(M13) · `lib/health/heartbeat.ts`(M19) · `lib/health/pipeline-health.ts`(M18 집계).
- 데이터 레이어: `admin-alerts.ts`(SELECT) · `admin-alerts-insert.ts`(INSERT, append-only) · `admin-pipeline-health.ts` · `admin-heartbeat-log.ts` · `krx-eod.ts`(실 KRX EOD 종가, 무비용).
- KIS WS 어댑터 `lib/intraday/kis-websocket.ts` — KIS 키 미설정 시 mock-mode no-op.

박힌 결함(본 lane이 해소):
1. `lib/notify/exit-dispatch.ts` — **이메일 채널 잔존**(telegram+email 2채널 + D10 이메일 재시도). 72차 override(이메일/Resend 전역 제거)와 모순. production importer 0(test-only) → rework 안전.
2. `app/api/cron/silent-health/route.ts` — **`@/lib/email/resend` sendEmail 잔존**. 동일 모순.
3. `app/(admin)/admin/alerts/[id]/actions.ts::recordExitDecision` — `real_persistence_not_configured` boundary(0010 RPC `record_alert_exit_decision` 미배선, dangling).
4. 미존재: Exit 시그널 평가(M15 trigger) 순수 로직 · T+7 outcome 적재 경로 · unread badge.

---

## 1. S7c (A-1) — 장중·Exit 알림

### 1.1 shadow-first 게이트 (`lib/intraday/flags.ts`)
- `INTRADAY_MONITOR_ENABLED` (default off) — 장중 모니터 pass 실행 게이트. off → no-op·writes 0.
- `EXIT_SIGNAL_ENABLED` (default off) — Exit 평가/디스패치 게이트. off → no-op.
- `EXIT_OUTCOME_ENABLED` (default off) — T+7 outcome cron write 게이트. off → 200 skip·writes 0.
- 패턴 = m12a/macro flags.ts(`=== "true"`). KIS 키 auto-detect는 `isKisWebSocketConfigured()` 별도(키 부재 → mock-mode).

> **2026-06-28 적대 리뷰 후속(Claude 6-lens Workflow + verify, 20 confirmed)**: 아래 §1.7 grant claim 정정(0015a revoke → 0045 re-grant) + §1.2/§1.3 producer 배선(flag 소비) + §1.5 exit-outcome 보강(DB-due-filter/cache/close-ready). 리뷰 SoT = `docs/superpowers/reviews/2026-06-28-s7c-s7d-adversarial-review.md`.

### 1.2 M13/M14 장중 모니터 (순수 orchestrator `lib/intraday/monitor.ts` + producer `run-monitor.ts`)
- `buildIntradayMonitorOutput(input)` 순수 함수:
  - input: `{ ticks: IntradayTick[], contexts: Map<ticker, IntradayContext>, prefs: Map<ticker,boolean>, customThresholds?: Map<ticker,{priceChange?,volumeMultiplier?}>, now }`
  - 각 ticker: M14 토글 OFF(`isTickerEnabledForIntraday`)면 skip → `detectIntradayAnomaly` → 감지 시 `toIntradayAnomalyRecord` + `buildIntradayAnomalyAlert` + telegram 텍스트.
  - 반환: `{ anomalies: Omit<IntradayAnomalyEvent,"id">[], alerts: Omit<AlertEvent,"id"|"isRead">[], telegramTexts: string[], evaluated, detected }`.
  - **컨텍스트/틱 부재 ticker는 skip(throw 아님)** — fail-soft.
- **producer = `runIntradayMonitorPass(input, deps)`(`lib/intraday/run-monitor.ts`)** — `isIntradayMonitorEnabled` 게이트 소비(off→skip·writes 0) → buildIntradayMonitorOutput → `insertIntradayAnomalies`(0007 dedup_key UNIQUE ignoreDuplicates) + `insertAlertEvents` + 텔레그램 best-effort. tick/context 공급(KIS WS)은 **USER 키 게이트 seam**(Vercel Hobby는 sub-daily cron 불가 → 연속 구독은 키 발급 후 worker가 runIntradayMonitorPass 호출). flag off / KIS 미설정 → no-op.
- M14 종목 토글·커스텀 임계치는 `ticker_alert_pref` + (Phase 2) 커스텀 임계치 입력. MVP는 기본 임계치(±5%/3×) + 토글.

### 1.3 M15 Exit 시그널 (순수 `lib/notify/exit-signal.ts`)
- `evaluateExitSignal(position, config)` → `ExitSignal | null`:
  - position: `{ ticker, bucket, entryPrice, currentPrice, holdingDays, targetPrice?, peakPrice? }`
  - trigger 우선순위(결정론):
    1. `target_reached` — `targetPrice != null && currentPrice >= targetPrice` (severity=warning, 익절 후보).
    2. `momentum_break` — entry 대비 수익률 ≤ `-stopLossPct`(기본 -15%) **또는** peak 대비 drawdown ≥ `trailingDrawdownPct`(기본 12%, peakPrice 있을 때). severity=critical (thesis break/악재).
    3. `time_expired` — `holdingDays >= maxHoldingDays[bucket]`(short 30·mid 90·long 365). severity=warning.
  - 반환: `{ ticker, trigger, severity, reason(한국어), returnPct, holdingDays }`.
- `buildExitAlternatives(signal)` → 3종 결정론 시나리오(`sell_all`/`partial_sell`/`hold`) + trigger 맞춤 한국어 rationale. **notification-time 헬퍼**(시그널 생성 시점 컨텍스트용). `/admin/alerts/[id]` 정적 대안은 유지 — 상세 페이지는 AlertEvent만 보유(서명 시점 ExitSignal 컨텍스트 미영속)라 trigger-aware 대안 derive 불가. (리뷰 verify에서 page-orphan은 NONE 판정.)
- `buildExitSignalAlert(signal)` → `Omit<AlertEvent,"id"|"isRead">`(alert_type=exit_signal, signalSentAt=now).
- **producer = `/api/cron/exit-signal`(dormant) + `runExitSignalEval(positions, deps)`(`lib/notify/run-exit-eval.ts`)**: cron이 `isExitSignalEnabled` 게이트 소비(off→skip) → `getCurrentHoldings`(portfolio_snapshot 최신 보유) + bucket(`getActiveShortList`) + holdingDays(month-start) → ExitPosition → evaluateExitSignal → **durable insert 항상 선행** + dispatchExitSignal(telegram best-effort). vercel.json 미스케줄(USER go-live). 입력 = entryPrice/currentPrice(snapshot); target/peak 미영속이라 momentum_break+time_expired 위주(target_reached는 target 연결 후).

### 1.4 Exit 디스패치 rework (`lib/notify/exit-dispatch.ts`)
- **이메일 채널 전면 제거**(buildExitEmail*/sendEmail/D10 이메일 재시도 삭제). 신 계약:
  - `dispatchExitSignal({ telegramText, sendTelegram })` → `{ telegram: ExitChannelResult, durableRequired: true, telegramDelivered }`.
  - 텔레그램 best-effort(실패해도 throw 아님). **durable alert_event는 항상 호출부가 INSERT**(2-layer: telegram + /admin durable + badge). telegram 실패 = badge/durable이 catch-up(D10 재정의).
- `buildExitTelegramText` 유지(이메일 prompt 문구 갱신). exit-dispatch.test.ts 갱신(이메일 케이스 제거 + telegram best-effort + durable-always).

### 1.5 T+7 outcome (`lib/intraday/exit-outcome.ts` + cron)
- 순수: `selectAlertsNeedingOutcome(alerts, now, holdDays=7)` — alertType=exit_signal ∧ outcomeAt=null ∧ signalSentAt ≤ now-7d. `computeT7PriceChangePct(signalClose, t7Close)` → `(t7-signal)/signal*100`(3-decimal). `isT7AnchorReady`(T+6/T+7 race guard).
- cron `/api/cron/exit-outcome/route.ts`(daily, service-role, `EXIT_OUTCOME_ENABLED`+`KRX_OPENAPI_KEY` 게이트):
  - **DB-level due-filter `getDueExitOutcomeAlerts`**(alert_type=exit_signal ∧ outcome_at null ∧ signal_sent_at ASC) — newest-N 전체 fetch starvation 방지(리뷰 MED).
  - **close-ready guard `isT7AnchorReady`**: T+7 anchor가 오늘(KST)이고 장마감 cutoff(18 KST) 전이면 skip(다음 cron) — T+6 종가 오적재 방지(리뷰 MED).
  - **basDd별 전종목 종가 1회 fetch 캐시**(per-ticker 재조회 제거 — 리뷰 MED): `resolveEntryPricesKrw(allDueTickers, {basDd})` 캐시 후 lookup + walk-back(휴장 보정).
  - t7_price_change → **RPC `record_alert_exit_outcome`** UPDATE. 가격 누락 = skip(fail-soft). off → 200 skip·writes 0.
- vercel.json: 미스케줄(dormant 패턴, reflection-job 동일 — USER go-live 시 schedule 추가; Hobby cron-count 회피).

### 1.6 마이그 0044 `record_alert_exit_outcome` RPC
- `record_alert_exit_outcome(p_alert_id uuid, p_t7 numeric, p_outcome_at timestamptz)` SECURITY DEFINER:
  - `update alert_event set t7_price_change=p_t7, outcome_at=p_outcome_at where id=p_alert_id and alert_type='exit_signal' and outcome_at is null` (idempotent — 이미 적재된 건 no-op).
  - 3종 grant: `revoke from public` + `revoke from anon` + (cron 전용) `revoke from authenticated` + `grant to service_role`. (cron만 호출 → authenticated도 revoke.)
- `.rollback.sql` + `scripts/pg_smoke_0044.sh`(docker-free PG: 함수 생성·grant matrix·idempotent·non-exit no-op).
- **USER apply-only**(DORMANT) — flag off라 코드가 RPC 미호출 → 미적용 안전.

### 1.7 recordExitDecision 배선 + 마이그 0045 (grant 정정 — 리뷰 HIGH)
- `recordExitDecision` action: `real_persistence_not_configured` 제거 → 0010 RPC `record_alert_exit_decision(p_alert_id, p_decision, p_memo)` 호출(authenticated 세션 client, 내부 `is_admin()` self-gate). 검증(decision enum·alertType=exit_signal·미결정) 유지.
- **⚠️ grant 정정(적대 리뷰 HIGH)**: 0010이 authenticated grant했으나 **0015a(46차)가 authenticated EXECUTE revoke**("미사용 → least privilege, 필요 시 활성화 시점에 re-grant"). S7c가 이 RPC를 실배선 → **마이그 0045 `grant ... to authenticated` 재부여**(0015a 예고대로). 0045 미적용 시 authenticated 세션 호출은 **42501 permission denied**(SECURITY DEFINER 본문 이전 차단) → action이 `exit_decision_grant_missing`(0045 apply 안내)으로 명시 매핑. 0045 = USER apply-only(DORMANT); `EXIT_SIGNAL_ENABLED` off면 exit_signal alert 0 → 기록 대상 없음(미적용 안전).
- 0045 `.rollback`(authenticated revoke 복귀) + `scripts/pg_smoke_0045.sh`(0010 grant→0015a revoke→0045 re-grant 모델: authenticated present·anon absent·public absent, load-bearing pre-assert).
- pg_smoke_0044도 load-bearing 보강(anon/authenticated 직접 grant 후 revoke 검증 — vacuous 제거, 리뷰 MED).

### 1.8 unread badge
- `lib/data/admin-alerts.ts::getUnreadAlertCount(opts?)` — `select count head where is_read=false`. 0 rows → 0.
- `(admin)/layout.tsx` Bell + "알림" nav에 미확인 카운트 배지(>0일 때만). read-only·always-on(flag 무관). RLS deny/오류 시 배지 숨김(fail-soft, throw 금지 — 레이아웃 깨짐 방지).

---

## 2. S7d (A-2) — Silent Health

### 2.1 이메일 제거 (`silent-health/route.ts`)
- `@/lib/email/resend` import + sendEmail + 이메일 D10 재시도 + recipients/ADMIN_EMAILS 경로 **제거**. 신 D10 = 텔레그램 + dashboard durable(heartbeat_log) + 2채널 실패 시 `heartbeat_missing` alert_event(기존 로직 유지, 채널만 텔레그램+dashboard).
- sentChannels = `['dashboard']` + telegram 성공 시 `'telegram'`. allFailed = telegram 실패(텔레그램 미설정 production = fail-closed 유지).
- route.test.ts 갱신(이메일 assertion 제거).

### 2.2 override UI + 권한 가드 (M18/M19)
- `/admin/settings/health`(존재) — pipeline_health 24h 집계 + heartbeat 최신 + success_rate/red_alert 가시화(기존 pure 로직 재사용). **override 토글**(대표 1인 권한 가드, R3.12) = silent-health 상태 수동 ack/override. 최소 빌드: 상태 카드 + ack 표시(실 토글은 대표 권한 가드).
- §2.2 출시 criterion #4(red_alert 0 + success_rate ≥99% + canary OK) 측정 가능 = pipeline_health 집계 + heartbeat status 카드.

### 2.3 shadow-first
- S7d는 기존 cron 실배선(이메일 제거)이라 신규 flag 불필요. pipeline_health/alert_event 0 rows → status='ok'·빈 카드(byte-identical 의미는 "기존 동작 유지 + 이메일 채널만 제거"). 신규 마이그 0.

---

## 3. 연결포인트 end-to-end (검증 대상)

- 장중: `buildIntradayMonitorOutput` → `insertAlertEvents`(intraday_anomaly) + intraday_anomaly_event INSERT(dedup) → `/admin/alerts` 렌더 + unread badge.
- Exit: `evaluateExitSignal` → `buildExitSignalAlert` → durable INSERT + `dispatchExitSignal`(telegram) → `/admin/alerts/[id]` 상세(대안 3 + 결정 기록 RPC) → T+7 cron → `record_alert_exit_outcome` → 상세 T+7 카드.
- Health: silent-health cron → pipeline_health/alert 집계 → heartbeat_log INSERT + (실패 시)heartbeat_missing alert → `/admin/settings/health` + unread badge.
- 무회귀: 선정 worker·PR-K seam·M12a·G4·morning-briefing byte-identical(신규 flag off + 이메일 제거는 silent-health/exit-dispatch 한정).

---

## 4. 가드레일 체크리스트 (코드화)

- [ ] 신규 flag 3종 default off → 게이트 off에서 monitor/exit/outcome no-op·writes 0 (테스트 pin).
- [ ] 이메일/Resend: exit-dispatch + silent-health에서 import 0 (grep gate). resend.ts 자체는 미사용이나 morning-briefing 영향 0 확인.
- [ ] 마이그 0044 DORMANT(USER apply) + rollback + PG smoke + 3종 grant(service_role only).
- [ ] 실 AI 호출 0(본 lane은 KRX EOD·KIS WS·telegram만, AI 무관). 비용 0.
- [ ] 범주 분리: intraday(M13 가격/거래량) ≠ exit(M15 보유 청산) ≠ health(M18/M19 파이프라인) ≠ M12a(뉴스 thesis-break) ≠ G4(거시). 별도 타입·출력.
- [ ] KIS/Telegram/KRX 키 + flag + 마이그 apply = USER-only(체크리스트 §5).
- [ ] mutation-resistant 테스트(우선순위·경계·dedup·fail-soft) + vacuous 0.

## 5. USER 게이트 (활성화)
- **마이그 0045 apply** (record_alert_exit_decision authenticated re-grant) → Exit 결정 기록 동작(미적용 시 `exit_decision_grant_missing`).
- `INTRADAY_MONITOR_ENABLED=true` + KIS 키(B-10) + 연속 WS 워커(외부, runIntradayMonitorPass 호출) → 장중 모니터.
- `EXIT_SIGNAL_ENABLED=true` + exit-signal cron schedule(vercel.json 또는 외부) + `TELEGRAM_BOT_TOKEN` → Exit 평가/디스패치.
- `EXIT_OUTCOME_ENABLED=true` + `KRX_OPENAPI_KEY` + 마이그 0044 apply + exit-outcome cron schedule → T+7 적재.
- `TELEGRAM_BOT_TOKEN`+chat_id(B-9) → 텔레그램 발송(미설정 = /admin durable+badge만).
