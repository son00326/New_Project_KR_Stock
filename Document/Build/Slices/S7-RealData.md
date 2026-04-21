# S7 실데이터 전환 — Mock fixture → 실 API·실 DB·실 AI 호출

```
---
slice_id: S7
slice_name: 실데이터 전환 (Supabase 실 I/O + Anthropic 실 호출 + 외부 API 5종 연결)
architect_id: S7
status: ⚪ 대기 (킥오프 대기)
expected_sessions: 8 (S7a 1 + S7e 2 + S7b 2 + S7c 2 + S7d 1)
current_progress: 0%
---
```

Last updated: 2026-04-21 (placeholder — S7a 킥오프 시 Tasks 세분화·확장)
선행 문서: `HANDOFF.md §6` (로드맵 SoT) · `ProgressDashboard.md §5` (BL-KRIT) · `ServicePlan-Admin.md §4` (데이터 모델)

> **이 파일은 스켈레톤이다.** S7a 킥오프 첫 행동으로 아래 Tasks를 Phase별로 세분화·체크리스트화한다. Placeholder가 최소한인 이유는 각 Phase(S7a~S7e)가 외부 API 응답·실측 후에만 구체화되기 때문.

---

## 목표 (Why)

Mock Skeleton(S0~S6)이 UI·라우트·타입·스키마·순수 로직을 완결했지만, **모든 데이터는 `tudal/src/lib/data/mock-*.ts` fixture에서 온다**. S7은 Mock을 실 API·실 Supabase·실 Anthropic 호출로 교체하여 어드민 3명이 실제로 쓸 수 있는 상태로 전환한다. **완료 기준**: Must 19 모두 실데이터 기반으로 동작 + 실 AI 호출 비용 추적 + 실 운용 검증(S9)으로 넘어갈 준비.

---

## 포함 Phase (HANDOFF §6 SoT 이식)

### S7a · Anthropic wrapper + cost_log 실 INSERT
- **포함 Must**: M17 (AI 비용 실시간 모니터링)
- **외부 의존**: Anthropic
- **선행 BL-KRIT**: BL-KRIT-1 (Anthropic API Key)
- **예상 세션**: 1
- **핵심 산출**: `src/lib/ai/client.ts` (Anthropic SDK wrapper + prompt cache) + `src/lib/ai/cost-logger.ts` (`/messages` usage 파싱 → E7 cost_log INSERT) + per-persona/per-section 태깅

### S7e · Supabase 실 SELECT/INSERT 전면 전환
- **포함 Must**: M1·M4·M5·M6·M7·M8·M9·M16 (8 Must)
- **외부 의존**: Supabase
- **선행 BL-KRIT**: BL-KRIT-6 ✅ 해소 (2026-04-21) + 마이그레이션 0009 (BL-KRIT-7 alert_event CHECK 확장)
- **예상 세션**: 2
- **핵심 산출**: 모든 `mock-admin-*.ts` import를 Server Actions + Supabase SELECT/INSERT로 교체. RLS 검증. race condition 실 DB 제약(E4 UNIQUE) 동작 확인.

### S7b · 뉴스 + 브리핑 실 연결
- **포함 Must**: M11 (모닝 브리핑) · M12 (뉴스 심각도 분류기)
- **외부 의존**: Naver News API · Resend · Anthropic
- **선행 BL-KRIT**: BL-KRIT-1 · BL-KRIT-3 · BL-KRIT-4
- **예상 세션**: 2
- **핵심 산출**: `src/lib/news/naver-api.ts`·`scraper.ts` 실 호출 · `src/lib/briefing/compose.ts` Anthropic 실 호출 · Resend 발송. 08:00 KST Cron 실 실행 검증.

### S7c · 장중 + Exit 2채널 실 연결
- **포함 Must**: M13 (장중 이상 감지) · M14 (커스텀 임계치) · M15 (Exit 시그널 2채널)
- **외부 의존**: KIS WebSocket · Telegram · Resend
- **선행 BL-KRIT**: BL-KRIT-2 · BL-KRIT-4 · BL-KRIT-5
- **예상 세션**: 2
- **핵심 산출**: `src/lib/intraday/kis-websocket.ts` 실 구독 · `src/lib/notify/telegram.ts`·`exit-dispatch.ts` 실 발송 + D10 이메일 재시도 동작 검증.

### S7d · Silent Health 실 INSERT + override UI
- **포함 Must**: M18 (파이프라인 헬스체크) · M19 (Silent Health 하트비트) + BL-17 B 구현
- **외부 의존**: Supabase · Telegram · Resend
- **선행 BL-KRIT**: BL-KRIT-4 · BL-KRIT-5
- **예상 세션**: 1
- **핵심 산출**: `pipeline_health`·`heartbeat_log` 실 INSERT · 매일 24:00 KST Cron 실 발송 · `/admin/settings/cost` override 토글 권한 가드(대표 1인).

---

## 선행 조건 (전 Phase 공통)

- BL-KRIT-1~5, BL-KRIT-7 외부 계정·키 발급
- Supabase 프로젝트 접근 확인 (BL-KRIT-6 ✅ 해소됨)
- `.env.local`에 필요 키 전부 투입
- `tudal/.env.example` 참고 (AUTO-6 완료)

---

## 외부 의존 테이블

| API | 용도 | 비용 영향 | Rate Limit |
|---|---|---|---|
| Anthropic `/messages` | 리포트·브리핑·뉴스 분류 | Anti-Metric 40만원 hardcap | usage 파싱으로 실시간 측정 |
| Supabase PostgreSQL | 전 엔티티 실 I/O | 무료 티어 | 프로젝트 한도 |
| Naver News Open API | M12 뉴스 수집 | 무료 | 일 25,000건 |
| pykrx (로컬 Python) | 영업일·시세 seed | 0 | — |
| KIS REST / WebSocket | 주식 시세·주문 | 계좌당 무료 | 초 20건 |
| Resend | 이메일 발송 | ~$20/월 (3K emails) | — |
| Telegram Bot | 푸시 알림 | 무료 | 초 30건 |

---

## Tasks (킥오프 시 세분화)

> 각 Phase의 Tasks는 해당 Phase 킥오프 세션에서 구체화한다. 아래는 초기 스켈레톤.

### Phase S7a (최우선, 세션 1)
- [ ] T7a.1 `ANTHROPIC_API_KEY` `.env.local` 투입 + 접속 테스트
- [ ] T7a.2 `src/lib/ai/client.ts` — Anthropic SDK wrapper + prompt cache 옵션
- [ ] T7a.3 `src/lib/ai/cost-logger.ts` — `/messages` response의 `usage` 파싱 → `cost_log` INSERT (ticker·persona_id·section 태깅)
- [ ] T7a.4 `src/lib/trading/ai/decide-order.ts` — S8 어댑터 skeleton 빈 훅(`throw 'not-embedded'`) 선행 박기
- [ ] T7a.5 `/admin/settings/cost` 대시보드를 mock 대신 실 `cost_log` SELECT로 교체
- [ ] T7a.6 Vitest — 비용 추정·파싱 단위 테스트

### Phase S7e (세션 2~3)
- [ ] T7e.1 마이그레이션 0009 (alert_event CHECK 확장 · BL-KRIT-7)
- [ ] T7e.2 `src/lib/data/mock-admin-shortlist.ts` → Supabase SELECT + Server Actions
- [ ] T7e.3 `mock-admin-reports.ts`·`mock-admin-committee*.ts` → 실 SELECT
- [ ] T7e.4 `mock-admin-approvals.ts`·`mock-admin-snapshots.ts` → 실 I/O + E4 UNIQUE race 실 검증
- [ ] T7e.5 `mock-admin-regen-counters.ts` → 실 INSERT/UPDATE + M9 cap 가드 실 동작
- [ ] T7e.6 `mock-admin-access-logs.ts`·`mock-admin-performance.ts`·`mock-admin-decision-tree.ts` → 실 SELECT
- [ ] T7e.7 RLS 정책 브라우저 수동 QA (멤버 권한 403 확인)

### Phase S7b (세션 4~5)
- [ ] T7b.1 Naver News API 실 호출 경로 전환
- [ ] T7b.2 Resend 도메인 인증 + 발송 테스트
- [ ] T7b.3 M11 Anthropic 실 브리핑 생성 (08:00 KST Cron 실 검증)
- [ ] T7b.4 M12 Anthropic 실 분류 (Critical/Warning/Info)
- [ ] T7b.5 `briefing_log`·`news_event` 실 INSERT 확인

### Phase S7c (세션 6~7)
- [ ] T7c.1 KIS REST OAuth 토큰 관리
- [ ] T7c.2 KIS WebSocket 실시간 시세 구독 (40구독 제한 관리)
- [ ] T7c.3 Telegram Bot 실 발송 (3 어드민 chat_id)
- [ ] T7c.4 M15 Exit 2채널 + D10 이메일 재시도 실 동작
- [ ] T7c.5 `intraday_anomaly_event`·`alert_event(exit_signal)` 실 INSERT
- [ ] T7c.6 T+7 outcome 자동 적재 Cron 실 동작

### Phase S7d (세션 8)
- [ ] T7d.1 `pipeline_health` 실 INSERT (5 파이프라인 × 24h)
- [ ] T7d.2 `heartbeat_log` 실 INSERT + 24:00 KST Cron 실 발송
- [ ] T7d.3 `/admin/settings/cost` override 토글 UI + 대표 1인 권한 가드
- [ ] T7d.4 3채널 catch-up(텔레/이메일/대시보드) 실 검증

---

## DoD (Phase 공통 + 전체)

### Phase 공통 DoD
- [ ] 해당 Phase Must 전체가 mock import 0, 실 API/DB 경로만 사용
- [ ] `npm run build` + `npm run lint` + `npm run test:ci` 3 게이트 통과
- [ ] 신규 env 키는 `.env.example`에 반영 · Vercel 배포 준비 시 수동 투입
- [ ] Supabase 마이그레이션 실 적용 + RLS 브라우저 QA
- [ ] 커밋 prefix `feat(S7a):`·`feat(S7b):` 등 Phase 단위 atomic 커밋

### 전체 S7 완료 DoD
- [ ] Must 19 모두 실 경로 동작 (`HANDOFF.md §9` 체크리스트 전부 체크)
- [ ] 실 AI 호출 횟수 > 0 · `cost_log` 실 INSERT 누적 확인
- [ ] 2채널 알림 실 발송 로그 확인 (텔레그램·이메일)
- [ ] Vercel Cron 4건(monthly-batch · morning-briefing · news-sweep · silent-health) 실 실행 1주 연속 성공
- [ ] `CodebaseStatus.md` "실데이터 연결 N/19" N → 19 갱신
- [ ] `ProgressDashboard.md` S7 ✅ 표기 + S8 스캐폴드 병행 시작 지표

---

## 블로커 / 사용자 결정 필요

- **BL-KRIT-1~5, 7** — HANDOFF §4 참조 (Anthropic·KIS·Naver·Resend·Telegram 외부 계정 발급 + 마이그레이션 0009)
- **DQ-7** — Vercel 배포 타이밍 확정 (어느 Phase에서 배포 시작할지)

---

## 리스크

- **R-S7-1** Anthropic 비용 폭주 (실 AI 호출 첫 도입 시점)
  - 완화: S7a에서 dry-run 견적 먼저 돌리고 한도 override 없이 35만/40만 경보·hardcap 실 동작 확인
- **R-S7-2** KIS WebSocket 40구독 제한 초과 시 스트림 중단
  - 완화: 종목별 우선순위 + 재연결 backoff + 폴링 fallback (S5 설계)
- **R-S7-3** 실 DB로 전환 후 race condition이 mock에선 드러나지 않은 상태로 출현
  - 완화: E4 UNIQUE 위반 catch 경로를 S3에서 이미 박음. S7e에서 실 동시 클릭 QA 추가
- **R-S7-4** Resend 도메인 인증 지연
  - 완화: 테스트 발송은 `onboarding@resend.dev` 경유 가능. 본 도메인은 배포 전까지 병행

---

## 의사결정 로그

- 2026-04-21: 스켈레톤 생성. HANDOFF §6 로드맵 테이블을 Phase별로 이식. 각 Phase Task는 킥오프 시점에 세분화 원칙.

---

## 이슈·발견

- (킥오프 시 추가)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-21 | 초기 생성 (placeholder). HANDOFF §6 S7a~e 테이블을 Phase 5단계로 이식. Tasks는 초기 초안. |
