# S6 Hardening (AI 비용 + Silent Health)

> originally architect ID: S7 (`.omc/research/must-19-slice-mapping.md` §5 S7 블록 — M18은 S5로 이관됨)

---

```
slice_id: S6
slice_name: Hardening — AI 비용 모니터링 + Silent Health 하트비트
architect_id: S7
status: ✅ 완료
expected_sessions: 3
current_progress: 100%
```

---

## 목표 (Why)

Must 19의 마지막 방어층. M17(AI API 비용 40만 hardcap)과 M19(Silent Health 하트비트)를 완성하여 "AI 비용 폭주"와 "조용한 장애"를 동시에 방어한다. S4에서 심어둔 cost_log stub을 여기서 활성화한다. **S6 Mock 완료 시 Must 19 Mock 동작 전원 가동 = Mock Skeleton Stage 1 완성.** 진짜 MVP는 S7 실데이터 전환 + 운용 1개월+ 검증 후 (HANDOFF.md §2 Runbook).

**진입 게이트**: BL-18 (P5 I-03 토큰 dry-run 실측) — 22차 후속 결정 = **B 견적 임계치** (실 API dry-run 미실시, src/lib/cost/dry-run-estimate.ts에 보수적 추정 박제).

---

## 포함 요구사항

- **Must**: M17 (AI API 비용 실시간 모니터링 대시보드), M19 (Silent Health 일간 하트비트)
- **엔티티**: cost_log 확장 (M17 RW · M19 R · ticker·persona_id·section 컬럼 추가), heartbeat_log 신규 (M19 RW), E6 AlertEvent (M19 R), E8 RegenCounter (M17 R · hardcap), pipeline_health (M19 R)
- **라우트**: `/admin/settings/cost` (M17), `/api/cron/silent-health` (M19)
- **근거**: ServicePlan-Admin.md §3.12 R3.12-1~3, R3.12-7~8

---

## 선행 조건

- **S4 완료**: M9 hardcap 연동 stub 존재 — ✅ 활성 완료
- **S5 완료**: M18 헬스체크 파이프 가동, E6 AlertEvent 이벤트 누적 — ✅
- **BL-18 = B**: 견적 임계치로 진입 (실 API dry-run 없이 진행) — ✅

---

## 외부 의존

| 의존 대상 | 용도 | 슬라이스 내 처리 |
|---|---|---|
| Anthropic API usage endpoint | AI 비용 수집 | BL-16 = A → `/messages` 응답 usage 실시간 파싱. Wrapper는 실데이터 전환 시 도입 (TODO) |
| pipeline_health (S5 신규) | M19 집계 참조 | aggregatePipelineHealth 재사용 ✅ |
| E7 BriefingLog (S5 신규) | M19 유사 스키마 재사용 가능 | heartbeat_log 신규 (BriefingLog 패턴 참조) |

---

## Tasks (체크리스트)

> **72차 사용자 override(2026-06-09)**: 아래 T6.5/M19의 텔·이메일/D10 표현은 S6 mock-complete 당시 historical. 현행 M19 알림 spec은 **Telegram best-effort + `/admin/alerts` durable event + 대시보드 unread badge**, 이메일/Resend 알림 전역 제거.

- [x] **T6.1** cost_log 스키마 확장 — BL-16 A 채택 후 ticker·persona_id·section 컬럼 추가 (0008 마이그레이션)
- [x] **T6.2** M17 AI 비용 대시보드 — 당월 누적 + 35만 경보 + 40만 hardcap 시각화 + 시나리오 비교(BL-18 견적) + Purpose별 비중 + Top 5 기여 + 시연 영역(2026-03 경보·2026-02 hardcap mock)
- [x] **T6.3** override 토글 — BL-17 B 채택 (대표 1인). UI 토글 자체는 실데이터 전환 시점에 추가 (현재는 mock 차단만)
- [x] **T6.4** heartbeat_log 스키마 신규 (0008 §2)
- [x] **T6.5** M19 Silent Health 배치 — `/api/cron/silent-health` (Vercel Cron 매일 15:00 UTC = 24:00 KST). 텔·이메일 2채널 + D10 catch-up(이메일 1회 재시도) + heartbeat_missing AlertEvent 적재
- [x] **T6.6** 최종 E2E 검증 — Must 19 전원 mock 데이터로 빌드/테스트 통과 (build 22 routes · test 20 files/190 tests · lint 0)

---

## DoD (Definition of Done)

- [x] M17: 당월 누적 AI 비용 위젯 표시, 40만 hardcap 도달 시 재생성 핸들러가 `cost_hardcap_40man` 반환 → UI 차단
- [x] M17: 35만 경보 배너 노출 (2026-03 mock으로 시연)
- [x] M17: Top 5 기여 테이블 렌더링 + Purpose별 비중 바
- [x] 40만 hardcap 활성 확인 — `regenerateReport` 핸들러에서 `isHardcapBlocked()` 가드 호출
- [x] M19: Cron 핸들러 수동 트리거 시 텔·이메일 2채널 발송 + ok/red_alert 자동 분기
- [x] M19: `heartbeat_missing` AlertEvent 페이로드 빌드 (D10 catch-up도 실패 시)
- [x] Must 19 전원 mock 플로우 빌드 통과
- [x] `npm run build` 오류 0, `npm run lint` 경고 0, `npm run test:ci` 190 tests pass
- [ ] 커밋: `feat(S6): Hardening — M17 AI 비용 hardcap + M19 Silent Health + Must 19 완료`

---

## 블로커 / 사용자 결정 (해소 완료)

- ✅ **BL-16** = **A** (Anthropic `/messages` 응답 usage 실시간 파싱 + per-persona·per-section 태깅) — 22차 후속, 23차 본 세션
- ✅ **BL-17** = **B** (override 토글 권한: 대표 1인) — 22차 후속, 23차 본 세션
- ✅ **BL-18** = **B** (견적 임계치 — 실 API 호출 없이 보수적 상한 산정) — 22차 후속, 23차 본 세션
- ✅ **G-3** = **B** (cost_log·heartbeat_log 슬라이스 인라인 정의, ServicePlan-Admin §4.2 반영은 추후 정비) — 22차 후속, 23차 본 세션

---

## 리스크

- **R2** (architect §8 Critical): AI 비용 폭주 — BL-18 B 견적 결과 base 시나리오는 35만 미만, worst(× 1.5) 시나리오도 verdict = `safe`/`tight` 영역. 실측 dry-run은 KIS·Anthropic 키 확보 후 별도 트랙으로 검증 필요. ✅ 완화 완료

---

## 의사결정 로그

- 2026-04-16: 슬라이스 파일 생성. architect 재조정 R7에 의해 M18을 S6→S5 동시로 이관. S6=M17+M19만. Mock Skeleton Stage 1 완성 슬라이스(실데이터·운용 검증은 후속 S7+).
- 2026-04-19 (22차 후속, 23차): BL-16 = A · BL-17 = B · BL-18 = B · G-3 = B 4건 일괄 해소. S6 진입.
- 2026-04-20 (23차): T6.1~T6.6 6 Tasks 직접 실행 + verification-before-completion. 라우트 22(/admin/settings/cost·/api/cron/silent-health 추가) · 테스트 20 files/190.

---

## 비블로킹 이월 (실데이터 전환 시)

1. cost_log 실 INSERT 연결 — Anthropic `/messages` 호출 wrapper에서 응답 usage 파싱 후 INSERT (현재 mock fixture만 적재)
2. heartbeat_log 실 INSERT — `/api/cron/silent-health` 핸들러에서 mock-mode 분기 → 실 Supabase INSERT 전환
3. override 토글 UI — 대표 1인 권한 분기 (`ADMIN_OVERRIDE_EMAIL` env) + 토글 시 cost_hardcap 일시 해제 Server Action
4. 실 API dry-run — Anthropic 키 확보 후 30종 × Section 0~8 1회 실측, dry-run-estimate base 가정 vs 실측 비교 → 임계치 재조정 검토
5. heartbeat 발송 시간 미세 조정 — 현재 15:00 UTC = 24:00 KST. ServicePlan에서 KST 정확 자정으로 명시 시 14:00 UTC로 1시간 이른 발송 검토
6. Critical AlertEvent 24h 카운트 — 현재 mock-admin-alerts 전체 필터링. 실 Supabase에서는 `signalSentAt > now() - interval '24 hours'`

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S7 블록 기반. M18 이관(S5 동시) 반영. 40만 hardcap 활성·Silent Health 운용 개시가 이 슬라이스 완료 시점. |
| 2026-04-20 | **S6 ✅ Mock 완료 (23차)**. BL-16/17/18 + G-3 4건 해소. T6.1~T6.6 실행. 0008 마이그레이션(cost_log 확장 + heartbeat_log + RLS) + src/lib/cost/{anthropic-pricing,dry-run-estimate,aggregate}.ts + src/lib/health/heartbeat.ts + `/admin/settings/cost` + `/api/cron/silent-health` + Vitest 3 files 30+ tests. **20 files / 190 tests pass** · build 22 routes · lint 0. **Mock 동작 19/19 달성 · 실데이터 0/19 · 운용 0일** — Mock Skeleton Stage 1 완성. 진짜 MVP는 S7(실데이터 전환, HANDOFF.md §2 Runbook) + 운용 1개월+ 검증 후. |
| 2026-04-20 | **23차 후속 정정**. "MVP Stage 1 완료"·"Must 19/19 (100%) 달성" 어휘가 mock-only를 종결 어휘로 오인케 한다는 사용자 지적. 목표·의사결정 로그·변경 이력을 "Mock Skeleton 완성 + 실데이터·운용 검증 후속" 구조로 정정. feedback_mvp_framing.md 규칙 반영. |
