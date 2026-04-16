# S5 스케줄러·알림·Exit + M18 동시

> originally architect ID: S6 (`.omc/research/must-19-slice-mapping.md` §5 S6 블록)

---

```
slice_id: S5
slice_name: 스케줄러·알림·Exit + M18 동시
architect_id: S6
status: ⚪ 대기
expected_sessions: 5 (S5a 3세션 + S5b 2세션)
current_progress: 0%
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
| 이메일 벤더 (SendGrid/Resend/SES) | M15 Exit 3채널 중 1 | BL-11 결정 후 |
| SMS 벤더 | M15 D10 백업 1회 | BL-12 결정 후 |
| 뉴스 벤더 API | M12 뉴스 분류 원천 | BL-13 결정 후 |
| 한투 API (WebSocket 또는 폴링) | M13 장중 감지 | BL-14 결정 후 (폴링 대안 있음) |
| 배치 실행 환경 | M10 월간 스케줄러 | BL-15 결정 후 (Vercel Cron / Supabase Edge / GitHub Actions) |

---

## S5a Tasks (M10·M11·M12·M18 — 3세션)

- [ ] **T5a.1** M10 배치 스케줄러 — cron 엔진(BL-15 결정 후) + 스크리닝→Short List→리포트→알림 파이프 + 재시도 3회 + `shortlist.generated` 이벤트 + 실패 시 전월 유지 + D+5 기산 + `scheduler_fail` AlertEvent
- [ ] **T5a.2** M11 모닝 브리핑 — 08:00 KST 텔레그램 + `/admin` 상단 카드, P&L·주의 종목·핵심 뉴스 3건 3~5줄, `briefing.viewed` 기록
- [ ] **T5a.3** M12 뉴스 분류기 — Critical/Warning/Info 3티어 분류 + 근거 1줄, Critical 즉시 알림 + `/admin/alerts` 이력 페이지
- [ ] **T5a.4** M18 파이프라인 헬스체크 (동시) — pipeline_health 신규 스키마, 5개 파이프라인(DART·뉴스·가격·AI·알림) 성공률 집계, 95% Critical·99% warning, error log tail(50줄), 24h 실패 트레이스, `/admin/health` 페이지

## S5b Tasks (M13·M14·M15 — 2세션)

- [ ] **T5b.1** M13 장중 이상 감지 — 상시 모니터링 모드 활성 시 ±5%/거래량 3배 감지, 홈 배지, 텔레그램 즉시 알림 (한투 WebSocket 또는 1분 폴링 — BL-14)
- [ ] **T5b.2** M14 종목별 알림 토글 — Short List 30 종목별 ON/OFF, Supabase user_prefs 저장, OFF 시 알림·배지 차단
- [ ] **T5b.3** M15 Exit 시그널 — Exit 트리거 감지 + 텔레그램·이메일·알림 3채널 동시 발송 + **D10 catch-up + SMS 1회 재시도** + `exit.signal.sent` 이벤트 + T+7 outcome 자동 적재 + `/admin/alerts/[id]` 결정 기록 입력

---

## DoD (Definition of Done)

**S5a DoD**:
- [ ] M10 배치: 수동 트리거 시 E1·E2·E3 갱신 확인, 재시도 3회 로직 존재
- [ ] M11 브리핑: mock 데이터로 텔레그램 stub 호출 + `/admin` 카드 렌더링
- [ ] M12 뉴스: Critical 분류 시 `AlertEvent` 기록 + `/admin/alerts` 목록 표시
- [ ] M18 헬스체크: `/admin/health` 접근 시 5개 파이프라인 성공률 표시, 95% 임계치 미달 시 Critical 배너
- [ ] M18 Critical 호출 E2E 테스트 1건 통과 (R1 완화 증거)

**S5b DoD**:
- [ ] M13 감지: 모드 ON 상태에서 mock ±5% 이벤트 주입 시 AlertEvent 기록 + 홈 배지 표시
- [ ] M14 토글: `/admin/settings` 종목 ON/OFF + 저장 후 알림 차단 확인
- [ ] M15 Exit: 3채널 발송 stub 호출 확인, `exit.signal.sent` 기록, `/admin/alerts/[id]` 결정 입력 UI 동작
- [ ] M15 D10: 텔·이메일 2채널 모두 stub 실패 시 SMS stub 1회 재시도 호출 확인. 3채널 모두 실패 시 /admin 배지 무조건 노출
- [ ] M18 Critical 호출 E2E 테스트: S5b 완료 시점에 M13·M14·M15 가동 + M18 성공률 5종 모두 표시 확인 (R1 완화 최종 증거)
- [ ] `npm run build` 오류 0, `npm run lint` 경고 0
- [ ] 커밋: `feat(S5b): Exit 시그널 + 장중 감지 + 알림 토글 — M13·M14·M15`

---

## 블로커 / 사용자 결정 필요

- **BL-6** (High): `/admin/health` 라우트 IA 확정 (독립 vs `/admin/settings/health` 서브라우트) — S5 착수 전 필수 — ProgressDashboard §5 참조
- **BL-11** (High): 이메일 벤더 선택 — S5 착수 전 필수
- **BL-12** (High): SMS 벤더 선택 (D10 백업)
- **BL-13** (High): 뉴스 벤더 선택 — M12 의존
- **BL-14** (Medium): 한투 API WebSocket vs 1분 폴링 — S5 실데이터 연결 단계에서 결정
- **BL-15** (High): 배치 실행 환경 선택 — M10 의존

---

## 리스크

- **R1** (architect §8 Critical): Exit 시그널 미수신 → 전체 신뢰 붕괴. **M18을 S5a와 동시 건설**로 완화. S5b Completion DoD에 M18 Critical 호출 E2E 테스트 포함 필수.
- **R4** (architect §8): M10 배치 실패 → D+5 기산 공백 → CAP Months 단절. 3회 재시도 + 전월 유지 + `scheduler_fail` AlertEvent로 완화.
- **R7** (architect §8): `/admin/health` IA 미포함 → S5 중 IA 재협상. BL-6 사전 해소로 완화.

---

## 의사결정 로그

- 2026-04-16: 슬라이스 파일 생성. architect 재조정 R6·R-A에 의해 M18을 S7→S5 동시로 앞당김. S5a/S5b 분할 명시.

---

## 이슈·발견

- (없음)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S6 블록 기반. M18 앞당김(R-A Critical 완화). S5a(3세션)·S5b(2세션) 분할 명시. |
