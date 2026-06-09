# S5 스케줄러·알림·Exit + M18 동시

> originally architect ID: S6 (`.omc/research/must-19-slice-mapping.md` §5 S6 블록)

---

```
slice_id: S5
slice_name: 스케줄러·알림·Exit + M18 동시
architect_id: S6
status: ✅ 완료 (S5a 21차 · S5b 22차)
expected_sessions: 5 (S5a 3세션 → 실제 1세션 · S5b 2세션 → 실제 1세션 = 총 2세션)
current_progress: 100% (M10·M11·M12·M13·M14·M15·M18 7건 / S5 총 7 Must + M18 = 8건 기준)
```

---

## 목표 (Why)

가장 큰 슬라이스. 월간 자동 배치(M10)·일간 브리핑(M11)·뉴스 분류(M12)·장중 감지(M13)·종목 토글(M14)·Exit 시그널(M15) 7개 Must와 파이프라인 헬스체크(M18)를 함께 구축한다. **M18을 S5a와 동시 건설하는 이유**: M10·M12·M15 가동 즉시 "조용한 장애" 방어층이 없으면 Exit 시그널 미수신이 발생해도 탐지 불가 (architect R1 Critical, pre-mortem 시나리오 B).

**분할**: S5a(M10·M11·M12·M18, 3세션) → S5b(M13·M14·M15, 2세션) 순차 실행.

---

## 포함 요구사항

- **Must**: M10·M11·M12·M13·M14·M15·M18 (7개 + 1개 = 8개 Must)
- **엔티티**: E1 ShortList30 (W via M10), E2 StockReport (W via M10), E3 CommitteeVote (W via M10), E6 AlertEvent (W · 전방위), E7 BriefingLog (RW · M11), pipeline_health 신규
- **라우트**: `/admin/alerts`, `/admin/alerts/[id]`, `/admin/settings` (모드/토글), `/admin/health` (신규 — BL-6 결정 후 확정)
- **근거**: ServicePlan-Admin.md §3.9 R3.9-1~5, §3.10 R3.10-1~15, §3.12 R3.12-4~6

---

## 선행 조건

- **S0 완료**: admin 가드, Supabase env
- **S1 완료**: E1 스키마 존재 (M10이 E1 W)
- **S2 완료**: E2 StockReport (M10이 E2 W), Section 7 참조 (M15 Exit)
- **BL-6 해소**: `/admin/health` 라우트 확정 후 진입 (IA 결정)

---

## 외부 의존

| 의존 대상 | 용도 | 슬라이스 내 처리 |
|---|---|---|
| 텔레그램 Bot API | M11·M12·M15·M19 알림 | BL-11·BL-12·BL-13·BL-15 선결 후 실연결 |
| ~~이메일 벤더 (SendGrid/Resend/SES)~~ | ~~M15 Exit 3채널 중 1~~ | **72차 사용자 override로 폐기** — 현행 target은 Telegram best-effort + `/admin/alerts` durable event + unread badge |
| ~~SMS 벤더~~ | ~~M15 D10 백업 1회~~ | ✅ **제거됨** (22차). 22차의 이메일 재시도 축소안도 **72차 사용자 override로 superseded** → D10=Telegram+/admin 2-layer |
| 뉴스 벤더 API | M12 뉴스 분류 원천 | BL-13 결정 후 |
| 한투 API (WebSocket) | M13 장중 감지 | ✅ **WebSocket 확정** (22차, 2026-04-19) — BL-14 해소 |
| 배치 실행 환경 | M10 월간 스케줄러 | BL-15 결정 후 (Vercel Cron / Supabase Edge / GitHub Actions) |

> **72차 사용자 override(2026-06-09)**: 아래 S5의 Resend/D10 이메일 재시도/2~3채널 표현은 Mock Skeleton 완료 당시 historical. 현행 알림 spec은 **Telegram best-effort + `/admin/alerts` durable event + 대시보드 unread badge**, 이메일/Resend 알림 전역 제거.

---

## S5a Tasks (M10·M11·M12·M18 — 3세션 예상 · 실제 1세션)

- [x] **T5a.1** M10 배치 스케줄러 — Vercel Cron(`5 0 1 * *` UTC = 09:05 KST day 1) + `/api/cron/monthly-batch` 핸들러 + `src/lib/scheduler/monthly-batch.ts`(runStepWithRetries · runMonthlyBatch · buildSchedulerFailAlert · toPipelineHealthRecord) + 재시도 3회 + scheduler_fail AlertEvent 빌드 + Bearer CRON_SECRET 가드. mock step 4종(screening·shortlist-insert·report-generate·alert-broadcast) 주입 — 실 I/O는 S5 실데이터 전환 시 교체.
- [x] **T5a.2** M11 모닝 브리핑 — Vercel Cron(`0 23 * * *` UTC = 08:00 KST) + `/api/cron/morning-briefing` 핸들러 + `src/lib/briefing/compose.ts`(3줄 요약 · email/html/text/telegram 포맷 · xss escape) + `src/lib/email/resend.ts`(fetch 기반 어댑터 · mock-mode) + `/admin` 상단 BriefingCard + briefing_log INSERT payload + briefing_failed AlertEvent 연계.
- [x] **T5a.3** M12 뉴스 분류기 — `src/lib/news/{naver-api,scraper,classifier}.ts` 3 모듈 + 규칙 기반 Critical/Warning/Info 분류 + 근거 1줄 + `dedupeByUrl`(news_event UNIQUE url) + Vercel Cron(`*/15 * * * *`) + `/api/cron/news-sweep` + `/admin/alerts` 페이지(AlertEvent 이력 + Critical/Warning 뉴스 목록) + `/admin/alerts/[id]` 상세. Critical만 news_critical AlertEvent 즉시 발행.
- [x] **T5a.4** M18 파이프라인 헬스체크 — `0006_s5a_automation.sql` §1 pipeline_health 인라인 정의(G-3 완화) + `src/lib/health/pipeline-health.ts`(aggregatePipelineHealth · severityFromRate · recentFailures · overallSeverity) + `/admin/settings/health` 5 카드(공시·뉴스·시세·AI·알림) × 24h 성공률 + 95% Critical 배너 + 실패 trace tail 50건. MOCK_ADMIN_PIPELINE_HEALTH 272건(5 파이프라인 × 가상 24h seed, mulberry32 결정적 난수).

## S5b Tasks (M13·M14·M15 — 2세션)

- [x] **T5b.1** M13 장중 이상 감지 — `0007_s5b_notifications.sql` §3 intraday_anomaly_event(UNIQUE dedup_key=ticker+trigger+1분 bucket) + `src/lib/intraday/{anomaly-detect,kis-websocket}.ts` (detect/compute/dedup/alert 빌더 + KIS WebSocket stub · KIS_APP_KEY 미설정 시 mock-mode) + `src/components/admin/intraday/intraday-badge.tsx` (최근 15분 + 토글 OFF 필터 + 급등/급락/거래량 색상) + `/admin` 홈 배지 통합 + AlertType `intraday_anomaly` 추가.
- [x] **T5b.2** M14 종목별 알림 토글 — `0007_s5b_notifications.sql` §1~2 admin_settings(intraday_mode) + ticker_alert_pref(UNIQUE admin_id·ticker) + RLS self policy + `src/app/(admin)/admin/settings/{page,settings-panel,actions}.tsx`(Server Component + Client Island + setIntradayMode·setTickerAlertEnabled Server Actions) + `src/lib/data/mock-admin-settings.ts`(MOCK_ADMIN_ID + MOCK_ADMIN_TICKER_PREFS 2건 OFF 데모).
- [x] **T5b.3** M15 Exit 시그널 — `src/lib/notify/{telegram,exit-dispatch}.ts` (텔레그램 fetch 어댑터·TELEGRAM_BOT_TOKEN 미설정 시 mock-mode + **legacy** 2채널 동시 Promise.all → D10 이메일 1회 재시도 · allFailed 플래그 badge 보장) + `buildExitTelegramText·buildExitEmailSubject·buildExitEmailText` + `/admin/alerts/[id]/{page,exit-decision-form,actions}.tsx` (Exit 결정 UI: 매도전량/분할매도/홀딩 + 메모 + §7 대조 stub + T+7 outcome 표시 + recordExitDecision Server Action) + mock-admin-alerts.ts exit_signal 2건(결정 미입력 + outcome 적재 완료) + intraday_anomaly 2건 시드. **72차 현행 target은 Telegram best-effort + `/admin/alerts` durable event + 대시보드 unread badge; email builders는 historical mock artifact.**

---

## DoD (Definition of Done)

**S5a DoD** ✅ (2026-04-19, 21차):
- [x] M10 배치: GET `/api/cron/monthly-batch` 핸들러 호출 시 4 mock step 순차 실행 · 재시도 3회 로직 검증 완료(13 Vitest tests: runStepWithRetries · runMonthlyBatch · buildSchedulerFailAlert)
- [x] M11 브리핑: `compose.ts`로 3줄 요약 생성 · **legacy Resend mock-mode 호출(72차 target은 Telegram+/admin)** · `/admin` 상단 BriefingCard 렌더링 · briefing_log INSERT payload 준비(8 Vitest tests: xss escape · 음수 포맷 · 뉴스 3건 cutoff)
- [x] M12 뉴스: `classifyNews` 9가지 키워드 규칙 통과 · Critical 분류 시 news_critical AlertEvent 페이로드 생성 · `/admin/alerts` 목록 4 Critical + 6 Warning 렌더링(12 Vitest tests)
- [x] M18 헬스체크: `/admin/settings/health` 5 카드(DART·뉴스·시세·AI·알림) × 24h 성공률 표시 · alert 92.1%에서 Critical 배너 노출 확인 · 실패 trace tail 50건(8 Vitest tests)
- [x] M18 Critical 호출 E2E 테스트 1건 통과(`overallSeverity` critical 판정 — R1 완화 증거)
- [x] `npm run build` 20 routes · `npm run lint` 0 warnings · `npm run test:ci` 15 files / 128 tests pass
- [x] 커밋: `feat(S5a): 스케줄러·브리핑·뉴스·헬스 — M10·M11·M12·M18`

**S5b DoD** ✅ (2026-04-19, 22차):
- [x] M13 감지: 3 mock intraday_anomaly_event fixture(급락 -5.21%·거래량 3.42×·급등 5.09%) + 홈 배지에서 최근 15분 이벤트만 노출 + 토글 OFF(035720·207940) 종목은 `isTickerEnabledForIntraday`로 필터 차단. `detectIntradayAnomaly` 우선순위(spike>drop>volume) 검증(Vitest 15건).
- [x] M14 토글: `/admin/settings` 상시 모니터링 모드 + Short List 30 × ON/OFF 토글 UI. `setIntradayMode`·`setTickerAlertEnabled` Server Action으로 mock fixture 즉시 반영(`useTransition` + 롤백). Exit 시그널 예외 문구 명시.
- [x] M15 Exit: `dispatchExitSignal` Vitest 5건(legacy 양 채널 성공·단일 실패 catch-up·D10 재시도 성공·D10 재시도 실패 allFailed; **72차 target은 Telegram+/admin 2-layer**). `/admin/alerts/[id]` exit_signal 분기 시 결정 UI(3 옵션 + 메모) 활성, 비-exit는 stub 메시지. `recordExitDecision` action mock fixture 반영.
- [x] M15 D10: legacy 2채널 모두 초기 실패 시 이메일 1회 재시도(email.attempts=2)로 구현됐으나 **72차 사용자 override로 superseded**. 현행 target은 Telegram best-effort + `/admin/alerts` durable event + 대시보드 unread badge catch-up. SMS 제거(BL-12 폐기).
- [x] M18 E2E 증거: M13·M14·M15 가동 + `/admin/settings/health` 5 파이프라인 카드 기존 노출 유지 (S5a에서 기 검증, 본 세션 build 20 routes 확인).
- [x] `npm run build` 20 routes, `npm run lint` 0, `npm run test:ci` 17 files 158 tests pass (128+30)
- [x] 커밋: `feat(S5b): Exit 시그널 + 장중 감지 + 알림 토글 — M13·M14·M15`

---

## 블로커 / 사용자 결정 필요

- ~~**BL-6**~~ ✅ 해소 — (B) `/admin/settings/health` 서브라우트 (2026-04-16)
- ~~**BL-11**~~ ✅ 해소 — **Resend** 채택 (2026-04-19, 21차). Next.js 통합·React Email·무료 3K/월, 확장 시 $20/100K. **72차 사용자 override로 현행 알림 채널에서는 폐기.**
- ~~**BL-12**~~ ✅ **폐기** (2026-04-19, 22차) — SMS 백업 자체를 제거. D10 catch-up = 이메일 1회 추가 재시도로 축소. 근거: 어드민 3명·500cap·텔레그램 푸시 잠금화면 대체. **72차 사용자 override로 이메일 재시도도 폐기, D10=Telegram+/admin 2-layer.**
- ~~**BL-13**~~ ✅ 해소 — **네이버 뉴스 API + 스크래핑 하이브리드** (2026-04-19, 21차). 네이버 검색 API 1차 + 어드민 지정 매체 스크래핑 보강. 컴플라이언스 S6 정비
- ~~**BL-14**~~ ✅ 해소 — **한투 WebSocket 실시간** 채택 (2026-04-19, 22차). 근거: ±5%/거래량 3배는 초 단위 이벤트, 1분 폴링은 스파이크 희석·감지 누락 위험. Exit 정확성이 본질
- ~~**BL-15**~~ ✅ 해소 — **Vercel Cron** 채택 (2026-04-19, 21차). vercel.json crons 필드, Pro plan 5분 타임아웃, G-6 배포 플랫폼 = Vercel 확정
- **[G-3]** (Major — S5 킥오프 전): 신규 엔티티 `pipeline_health` 스키마가 ServicePlan-Admin §4.2에 미정의. S5a M18 헬스체크 구현 시 필드/타입/인덱스 결정 필요. S5 킥오프 시 §4.2 보충 또는 슬라이스 내부 인라인 정의.
- **[G-6]** (Major — S5 킥오프 전): 배포 플랫폼 미결정 (Vercel? self-hosted?). BL-15(배치 환경)와 동시 결정 필요 — Vercel Cron은 Vercel 배포 전제, Supabase Edge Functions은 Supabase 전제. BusinessPlan §10 "인프라 15만(Vercel, Supabase)" 암시하나 공식 결정 아님.

---

## 리스크

- **R1** (architect §8 Critical): Exit 시그널 미수신 → 전체 신뢰 붕괴. **M18을 S5a와 동시 건설**로 완화. S5b Completion DoD에 M18 Critical 호출 E2E 테스트 포함 필수.
- **R4** (architect §8): M10 배치 실패 → D+5 기산 공백 → CAP Months 단절. 3회 재시도 + 전월 유지 + `scheduler_fail` AlertEvent로 완화.
- **R7** (architect §8): `/admin/health` IA 미포함 → S5 중 IA 재협상. BL-6 사전 해소로 완화.

---

## 의사결정 로그

- 2026-04-16: 슬라이스 파일 생성. architect 재조정 R6·R-A에 의해 M18을 S7→S5 동시로 앞당김. S5a/S5b 분할 명시.
- 2026-04-19 (21차): **S5a 킥오프 블로커 4건 해소**. BL-11=Resend · BL-13=네이버 뉴스 API+스크래핑 하이브리드 · BL-15=Vercel Cron · 분할=S5a(M10·M11·M12·M18) → S5b(M13·M14·M15) 2 wave. G-6 배포 플랫폼 = Vercel 확정(부수 효과). G-3(pipeline_health 스키마)은 T5a.4 내부 인라인 정의로 처리 예정. **72차 사용자 override로 Resend/email 알림 채널은 현행 폐기.**
- 2026-04-19 (21차): **S5a ✅ 완료** — Wave 1(0006 마이그레이션+타입+mock) → Wave 2 병렬(M10·M11·M18) → Wave 3(M12) → Wave 4(Vitest 4 files 41 tests) → Wave 5(검증 3게이트). 실제 1세션(예상 3세션 대비 1/3). 검증: build 20 routes·lint 0·test:ci 128 pass. 비블로킹 이월 2건: ① 실 Supabase INSERT(pipeline_health·news_event·briefing_log)는 S5 실데이터 전환 시 · ② AlertType에 briefing_failed·news_warning 추가 → alert_event check constraint DB 갱신은 실 Supabase 통합 시. M18 E2E Critical 호출은 `overallSeverity` critical 판정으로 로직 검증(S5b 완료 시 M13·M14·M15 가동 후 최종 증거 재수집).
- 2026-04-19 (22차): **S5b 킥오프 2 블로커 해소**. **BL-12 폐기** (SMS 백업 자체 제거, D10 catch-up = 이메일 1회 재시도로 축소) · **BL-14 = A WebSocket** (한투 실시간, 1분 폴링 대안 거부 — ±5%/거래량 3배 스파이크 희석 리스크). 파생: ServicePlan-Admin §3.10 R3.10-15·M15 DoD 2채널로 수정, D10 박제 갱신, T5b.3 DoD SMS 제거. 새로운 AlertType 추가: `intraday_anomaly` (M13). **72차 사용자 override로 이메일 재시도/2채널 spec은 Telegram+/admin 2-layer로 superseded.**
- 2026-04-19 (22차): **S5b ✅ 완료** — T5b.1(M13)·T5b.2(M14)·T5b.3(M15) 전수 완료. 0007 마이그레이션(admin_settings·ticker_alert_pref·intraday_anomaly_event + RLS 3종) + 6 신규 모듈(intraday/anomaly-detect·kis-websocket, notify/telegram·exit-dispatch, mock-admin-intraday·mock-admin-settings) + 3 신규 페이지(settings·alerts/[id] 확장·admin 홈 배지) + 3 Server Actions + Vitest 2 files 30 tests. 검증: build 20 routes·lint 0·test:ci 158 pass(128+30). **Must 17/19 (89%) 달성** (M13·M14·M15). 실 세션 1회(예상 2세션 대비 50%). 비블로킹 이월: ① 실 Supabase INSERT/UPDATE 연결 (intraday_anomaly·admin_settings·ticker_alert_pref)는 실데이터 전환 시 · ② KIS WebSocket 실 연결·토큰 관리는 실데이터 전환 시 · ③ T+7 outcome 자동 적재 cron은 실 데이터 소스 확보 후 `/api/cron/exit-outcome` 신설 · ④ `alert_event` check constraint에 `intraday_anomaly` 추가는 실 Supabase 통합 시.

---

## 이슈·발견

- (없음)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S6 블록 기반. M18 앞당김(R-A Critical 완화). S5a(3세션)·S5b(2세션) 분할 명시. |
| 2026-04-19 (22차) | S5b 킥오프 2 블로커 해소: BL-12 폐기(SMS 제거) · BL-14 = WebSocket. T5b.3 legacy 2채널 축소. **72차 사용자 override로 현행 target은 Telegram+/admin 2-layer.** |
| 2026-04-19 (22차) | S5b ✅ 완료. T5b.1~T5b.3 · 0007 마이그레이션 · Vitest 30 tests · build 20 routes · Must 17/19 (89%) 달성. |
