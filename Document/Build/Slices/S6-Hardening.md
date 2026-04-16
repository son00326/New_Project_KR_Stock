# S6 Hardening (AI 비용 + Silent Health)

> originally architect ID: S7 (`.omc/research/must-19-slice-mapping.md` §5 S7 블록 — M18은 S5로 이관됨)

---

```
slice_id: S6
slice_name: Hardening — AI 비용 모니터링 + Silent Health 하트비트
architect_id: S7
status: ⚪ 대기
expected_sessions: 3
current_progress: 0%
```

---

## 목표 (Why)

Must 19의 마지막 방어층. M17(AI API 비용 40만 hardcap)과 M19(Silent Health 하트비트)를 완성하여 "AI 비용 폭주"와 "조용한 장애"를 동시에 방어한다. S4에서 심어둔 cost_log stub을 여기서 활성화한다. S6 완료 시 Must 19 전원 가동 = MVP Stage 1 완료.

**진입 게이트**: BL-18 (P5 I-03 토큰 dry-run 실측)이 반드시 선행되어야 M17 경보 임계치(35만 경보·40만 hardcap)를 실측값으로 검증할 수 있다.

---

## 포함 요구사항

- **Must**: M17 (AI API 비용 실시간 모니터링 대시보드), M19 (Silent Health 일간 하트비트)
- **엔티티**: cost_log 신규 (M17 RW · M19 R), heartbeat_log 신규 (M19 RW), E6 AlertEvent (M19 R), E8 RegenCounter (M17 R · hardcap), pipeline_health (M19 R)
- **라우트**: `/admin/settings` 또는 `/admin` 상단 위젯 (M17), N/A (M19는 알림 전용)
- **근거**: ServicePlan-Admin.md §3.12 R3.12-1~3, R3.12-7~8

---

## 선행 조건

- **S4 완료**: M9 hardcap 연동 stub 존재 전제
- **S5 완료**: M18 헬스체크 파이프 가동, E6 AlertEvent 이벤트 누적
- **BL-18 필수 선행**: 토큰 dry-run 실측 완료 후 경보 임계치 검증 가능

---

## 외부 의존

| 의존 대상 | 용도 | 슬라이스 내 처리 |
|---|---|---|
| Anthropic API usage endpoint | AI 비용 수집 | BL-16 결정 후 (`/messages` 응답 usage 파싱 vs 별도 집계) |
| pipeline_health (S5 신규) | M19 집계 참조 | S5 완료 후 사용 가능 |
| E7 BriefingLog (S5 신규) | M19 유사 스키마 재사용 가능 | heartbeat_log 신규 또는 재사용 |

---

## Tasks (체크리스트)

- [ ] **T6.1** cost_log 스키마 신규 생성 — per-persona·per-section 태깅 전략 (BL-16 결정 후)
- [ ] **T6.2** M17 AI 비용 대시보드 — 당월 누적 위젯 + 일·월 추이 차트 + 35만 경보 배너 + **40만 하드 캡 활성** (S4 stub → 실 활성화, M9 수동 재생성 + M7 Reject 재분석 동시 차단) + override 토글 + Top 5 기여 테이블
- [ ] **T6.3** override 토글 권한 설정 (BL-17 결정 후 — 3인 전원 vs 대표 1인)
- [ ] **T6.4** heartbeat_log 스키마 신규 생성 (또는 E7 BriefingLog 재사용 결정)
- [ ] **T6.5** M19 Silent Health 배치 — 자정 배치 + "오늘 이상 없음" 3채널 발송 + 실패·Critical 시 "적색 경보" 전환 + `heartbeat.missing` 이벤트 + D10 catch-up 재사용
- [ ] **T6.6** 최종 E2E 검증 — Must 19 전원 mock 데이터로 주요 플로우 통과 확인

---

## DoD (Definition of Done)

- [ ] M17: 당월 누적 AI 비용 위젯 표시, 40만 hardcap 도달 시 재생성 버튼 비활성 확인
- [ ] M17: 35만 경보 배너 노출 (mock cost_log에서 강제 테스트)
- [ ] M17: Top 5 기여 테이블 렌더링
- [ ] 40만 hardcap 활성 확인 — S4 stub이 실제 차단으로 전환됨
- [ ] M19: 자정 배치 수동 트리거 시 "오늘 이상 없음" 텔레그램 stub 호출
- [ ] M19: `heartbeat.missing` 이벤트 기록 확인
- [ ] Must 19 전원 mock 플로우 E2E 통과 (`feat(S6): hardening 완료 — MVP Stage 1`)
- [ ] `npm run build` 오류 0, `npm run lint` 경고 0
- [ ] 커밋: `feat(S6): Hardening — M17 AI 비용 hardcap + M19 Silent Health + Must 19 완료`

---

## 블로커 / 사용자 결정 필요

- **BL-16** (Medium): AI 비용 수집 방식 — Anthropic `/messages` 응답 usage 파싱 + per-persona·per-section 태깅 전략. 수집 방식 확정 전 cost_log 스키마 설계 불가 — ProgressDashboard §5 참조
- **BL-17** (Low): override 토글 권한 — 어드민 3인 모두 vs 대표 1인
- **BL-18** (High — S6 진입 전 필수): P5 I-03 박제된 토큰 dry-run 타이밍. S6 진입 전 실측해야 경보 임계치(35만·40만) 검증 가능
- **[G-3]** (Major — S6 킥오프 전): 신규 엔티티 `cost_log`·`heartbeat_log` 스키마가 ServicePlan-Admin §4.2에 미정의. M17 비용 모니터·M19 하트비트 구현 시 필드/타입 결정 필요. S6 킥오프 시 §4.2 보충 또는 슬라이스 내부 인라인 정의.

---

## 리스크

- **R2** (architect §8 Critical): AI 비용 폭주 (30종 × 151 페르소나 × Section 0~8 → Anti-Metric 40만 초과 구조적 위험). BL-18 dry-run 게이트 필수. S4 cost_log stub pre-wire 확인 후 S6 진입.

---

## 의사결정 로그

- 2026-04-16: 슬라이스 파일 생성. architect 재조정 R7에 의해 M18을 S6→S5 동시로 이관. S6=M17+M19만. MVP Stage 1 완료 슬라이스.

---

## 이슈·발견

- (없음)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S7 블록 기반. M18 이관(S5 동시) 반영. 40만 hardcap 활성·Silent Health 운용 개시가 이 슬라이스 완료 시점. |
