# ProgressDashboard — 주픽 어드민 빌드 상황판

> originally architect ID: 전체 슬라이스 통합 뷰 (`.omc/research/must-19-slice-mapping.md` §5·§7·§8·§9 기반)

Last updated: 2026-04-22 (30차 — **DQ-7 Session 3 부분 진행 · Vercel 첫 production 배포 ✅ https://tudal-tawny.vercel.app · T16·0009·T17 사용자 다음 세션**)
총 슬라이스: 7개 (S0~S6 Mock) + **DQ-7 Admin Credential (Session 3 ~80% 진행, 2026-04-22)** + **S7 실데이터 전환 (미착수)** + **S8 자동매매 프레임 (신규, 미착수)** + **S9 운용 검증** + Deferred-D(멤버, 별도 트랙)
총 예상 세션: 9(완료) + **4(DQ-7, 2 + 부분 1 완료)** + 8(S7) + 4(S8) = **약 25 세션** + S9 운용 4~8주
**진행률 (정확)**: Mock 동작 **19/19** · **DQ-7 구현 ~70% (Session 1·2 ✅ + Session 3 ~80%)** · 실데이터 **0/19** · 실 AI 호출 **0** · 자동매매 프레임 **0%** · 실 운용 검증 **0일** · **Vercel 첫 prod 배포 ✅ (24 routes, build 48s, READY)**
완성 기준 = Mock + DQ-7 Credential 인프라 + 실데이터 + **자동매매(주식+코인)** + 운용 검증 **5조건 AND** → **미달성**
S0 Foundation: ✅ **Mock 완료** (2026-04-17)
S1 Short List 30 홈: ✅ **Mock 완료** (2026-04-17)
S2 풀 리포트·투심위: ✅ **Mock 완료** (2026-04-17)
S3 승인 워크플로우 (+D15): ✅ **Mock 완료** (2026-04-17)
S4 가상 포트·성과·Decision Tree: ✅ **Mock 완료** (2026-04-19)
S5a 스케줄러·브리핑·뉴스·헬스: ✅ **Mock 완료** (2026-04-19)
S5b 장중·토글·Exit: ✅ **Mock 완료** (2026-04-19)
S6 Hardening (AI 비용 + Silent Health): ✅ **Mock 완료** (2026-04-20)
S7 실데이터 전환 (S7a~e): ⚪ **미착수** — HANDOFF §6 참조
**S8 자동매매 프레임 (주식+바이낸스 선물)**: ⚪ **미착수** (2026-04-21 D16 승격, Deferred-X·Y 흡수)
**S9 어드민 운용 검증 (1개월+)**: ⚪ **미착수**

---

## §1 슬라이스 요약 표

| ID | 이름 | 포함 Must | 예상 세션 | Mock 상태 | 실데이터 상태 | 파일 |
|---|---|---|---|---|---|---|
| **S0** | Foundation | 없음 (인프라 선행) | 2 | ✅ Mock 완료 | ⚪ S7 실데이터 전환 대기 | [S0-Foundation.md](./Slices/S0-Foundation.md) |
| **S1** | Short List 30 홈 + 분석엔진 출력 | M1·M4·M5·M6 | 4 (실제 2) | ✅ Mock 완료 | ⚪ S7e 대기 | [S1-ShortList30.md](./Slices/S1-ShortList30.md) |
| **S2** | 풀 리포트 + 투심위 | M2·M3 | 3 (실제 1) | ✅ Mock 완료 | ⚪ S7e 대기 | [S2-FullReport.md](./Slices/S2-FullReport.md) |
| **S3** | 승인 워크플로우 (+D15) | M7 | 4 (실제 1) | ✅ Mock 완료 | ⚪ S7e 대기 | [S3-Approval.md](./Slices/S3-Approval.md) |
| **S4** | 가상 포트·성과 측정 + Decision Tree | M8·M9·M16 | 4 (실제 1) | ✅ Mock 완료 | ⚪ cost_log stub만 · S7a·e 대기 | [S4-Performance.md](./Slices/S4-Performance.md) |
| **S5** | 스케줄러·알림·Exit + M18 동시 | M10·M11·M12·M13·M14·M15·M18 | 5 (S5a 1 · S5b 1 = 실제 2) | ✅ Mock 완료 | ⚪ S7b·c 대기 (Anthropic·Naver·KIS·Resend·Telegram) | [S5-Automation.md](./Slices/S5-Automation.md) |
| **S6** | Hardening (AI 비용 + Silent Health) | M17·M19 | 3 (실제 1) | ✅ Mock 완료 | ⚪ S7a·d 대기 (cost_log 실 INSERT · override UI) | [S6-Hardening.md](./Slices/S6-Hardening.md) |
| **DQ-7** | **Admin Credential System + Vercel 첫 배포** (2026-04-22 신설, S7a 선행) | (Must 19 밖 집행 인프라 · E9 확장 + E12 신설 + `/admin/settings/{brokerage,binance}`) | 4 | — | 🟡 **Session 3 부분(2026-04-22 30차) — BL-DQ7-1·2·3·T14·Vercel 프로젝트/env/배포 ✅ · 첫 prod URL https://tudal-tawny.vercel.app · T16 Redirect URL + 0009 적용 + T17 Cron/Smoke Test 사용자 다음 세션** | [DQ7-Credentials.md](./Slices/DQ7-Credentials.md) |
| **S7** | **실데이터 전환** (S7a~e) | 전 Must 실 연결 | 8 (예상) | — | ⚪ **미착수** (HANDOFF §6, DQ-7 완료 후) | — |
| **S8** | **자동매매 프레임** (주식 KIS + 바이낸스 선물, Strategy drop-in + AI 어댑터) | Must 19 밖 (어드민 집행 서브시스템) | 4 (스캐폴드 2 + 실 체결 2) | — | ⚪ **미착수** (2026-04-21 D16) | [S8-AutoTrading.md](./Slices/S8-AutoTrading.md) |
| **S9** | **어드민 운용 검증** | Mock+실 혼합 → 실계좌/메인넷 전환 | 4~8주 (세션 외) | — | ⚪ 미착수 | — |
| ~~Deferred-X~~ | ~~증권사 API + 매뉴얼/자동매매 UI~~ | **S8로 승격 (2026-04-21)** | — | — | — | [Deferred-Brokerage.md](./Slices/Deferred-Brokerage.md) (승격 표기만) |
| ~~Deferred-Y~~ | ~~AI Agent 기반 선정엔진 v2~~ | **S8 AI 어댑터에 흡수 예정 (2026-04-21)** | — | — | — | [Deferred-AIAgent-Selection.md](./Slices/Deferred-AIAgent-Selection.md) (포인터만) |
| **Deferred-D** | 멤버 페이지 (500cap 초대) | 현 어드민 플랜과 분리 | — | ⏸ 보류 | — | `ServicePlan-Member.md` |

> **슬라이스 번호 vs Architect ID 매핑**: S0→S0, S1→S1, S2→S5(architect), S3→S2(architect), S4→S4, S5→S6(architect), S6→S7(architect), Deferred-X→S3(architect)

---

## §2 전체 실행 순서

```
S0 Foundation (2세션)
  ├─ 선결: BL-1(Supabase env) · BL-2(admin role) · BL-6(health 라우트 결정)
  └─ legacy 제거 · Supabase · 디자인 토큰 · admin 가드
     │
     ▼
S1 Short List 30 홈 (4세션) — M1·M4·M5·M6
     │
     ▼
S2 풀 리포트·투심위 (3세션) — M2·M3
     │  ← report.view 파이프 완성이 다음 게이트
     ▼
S3 승인 워크플로우 (4세션) — M7 (+D15 게이팅 3종)
     │
     ▼
S4 성과·재생성·Decision Tree (4세션) — M8·M9·M16
     │  ← cost_log stub 심기 (R5 완화)
     ▼
[Deferred-X: Must 19 밖 이관 · 건너뜀]
     │
     ▼
S5 스케줄러·알림·모드 + M18 (S5a 3세션 + S5b 2세션 = 5세션)
  ├─ 선결: BL-11 · BL-13 · BL-15
  ├─ S5a: M10·M11·M12·M18 동시
  └─ S5b: M13·M14·M15 (+D10 백업)
     │
     ▼
[BL-18 토큰 dry-run 실측 게이트]
     │
     ▼
S6 Hardening (3세션) — M17·M19
     │  40만 hardcap 활성 + 하트비트 운용 개시
     ▼
[Mock Skeleton 완료: Must 19 Mock 동작]  ← **현재 여기 (2026-04-21, 9세션)**
     │
     ▼
S7 실데이터 전환 (S7a Anthropic → S7e Supabase → [S8 스캐폴드 병행 착수] → S7b 뉴스+브리핑 → S7c 장중+Exit → S7d Silent Health)
     │  ← BL-KRIT-1~7 선행 (HANDOFF §4)
     ▼
S8 자동매매 프레임
     ├ 스캐폴드: UI(6 라우트)·스키마(E13~E17)·Vault·Strategy 폴더·AI 어댑터·Policy Engine (mock 체결)
     └ 실 체결: KIS 모의→실계좌 + 바이낸스 테스트넷→메인넷
     │  ← BL-KRIT-8·9 + DQ-9·10·11 선행
     ▼
S9 어드민 운용 검증 (본인 + 친구 3명, 모의부터 1~2주 → 실계좌 전환)
     │
     ▼
[어드민 내부 도구 완성]

총 세션: 9 (완료) + 8 (S7) + 4 (S8) = 약 21 + 운용 검증 4~8주
```

---

## §3 Must 19 상태 표 (Mock · 실데이터 분리)

| Must ID | 공식 명칭 | 담당 슬라이스 | Mock 동작 | 실데이터 연결 | 실 AI 호출 |
|---|---|---|---|---|---|
| M1 | Short List 30 홈 표시 | S1 | ✅ | ⚪ (S7e) | — |
| M2 | 풀 리포트 렌더링 | S2 | ✅ | ⚪ (S7e) | ⚪ (S7a) |
| M3 | 투심위 투표 요약 패널 | S2 | ✅ | ⚪ (S7e) | ⚪ (S7a) |
| M4 | 5-Signal Composite + 3축 분석엔진 출력 | S1 | ✅ | ⚪ (S7e) | — |
| M5 | 편입/유지/제외 Delta 뷰 | S1 | ✅ | ⚪ (S7e) | — |
| M6 | 선정 근거 요약 카드 (3줄) | S1 | ✅ | ⚪ (S7e) | ⚪ (S7a) |
| M7 | 승인 워크플로우 (+ D15 게이팅) | S3 | ✅ | ⚪ (S7e) | — |
| M8 | 가상 포트폴리오 트래킹 엔진 | S4 | ✅ | ⚪ (S7e) | — |
| M9 | 리포트 재생성 cap 가드 | S4 | ✅ | ⚪ (S7e) | ⚪ (S7a) |
| M10 | 월간 자동 배치 스케줄러 | S5a | ✅ | ⚪ (S7b) | ⚪ (S7a·b) |
| M11 | 모닝 브리핑 요약 카드 | S5a | ✅ | ⚪ (S7b) | ⚪ (S7b) |
| M12 | 뉴스 심각도 분류기 | S5a | ✅ | ⚪ Naver·scraper 미연결 (S7b) | ⚪ (S7b) |
| M13 | 장중 이상 감지 알림 (+ 모드 설정) | S5b | ✅ | ⚪ KIS WS 미연결 (S7c) | — |
| M14 | 종목별 커스텀 임계치 on/off | S5b | ✅ | ⚪ (S7e) | — |
| M15 | Exit 시그널 발송 + 근거 + 대안 | S5b | ✅ | ⚪ Telegram·Resend 미연결 (S7c) | — |
| M16 | Decision Tree 진척도 대시보드 | S4 | ✅ | ⚪ (S7e) | — |
| M17 | AI API 비용 실시간 모니터링 대시보드 | S6 | ✅ | ⚪ cost_log 실 INSERT 미구현 (S7a) | ⚪ (S7a) |
| M18 | 파이프라인 헬스체크 대시보드 | S5a | ✅ | ⚪ pipeline_health 실 INSERT 미구현 (S7d) | — |
| M19 | Silent Health 일간 하트비트 | S6 | ✅ | ⚪ heartbeat_log 실 INSERT + override UI 미구현 (S7d) | — |

**요약**: Mock 19/19 · 실데이터 0/19 · 실 AI 호출 0/8

---

## §4 JTBD 단계별 E2E 게이트

> architect §9 §9 "순서 근거" 4번 항목 기반

| JTBD | 설명 | 달성 슬라이스 | 완료 기준 |
|---|---|---|---|
| **J1** | 월간 Short List 선정 E2E | S1 + S2 + S3 완료 | 홈→리포트→승인 플로우 통과 |
| **J2** | 일간 모니터링 E2E | S5 완료 | 브리핑·뉴스·장중 알림 3종 가동 |
| **J3** | Exit 시그널 E2E | S5b 완료 (M18 검증 포함) | 3채널 발송 + T+7 outcome 적재 확인 |
| **J4** | 성과 측정 E2E | S4 완료 | Decision Tree 게이지 3종 + Sharpe 계산 확인 |

**임계 경로**: `M10 → M1 → M2 → M7 → M8 → M16` (약 6단계)

---

## §5 Global Blocker 대시보드 (High 긴급도)

> architect §7 BL-1~BL-18 중 긴급도 High 항목만. 전체 목록은 각 슬라이스 파일 참조.

| BL-ID | 슬라이스 | 의제 | 해소 시점 |
|---|---|---|---|
| ~~BL-1~~ | S0 | ✅ 해소 — Supabase 프로젝트 `fpriyjykihxhhvqudvdb` 연결, `.env.local` 세팅 완료 (2026-04-17) | ~~S0 착수 전 필수~~ |
| **BL-2** | S0 | ✅ 해소 — (A) email allowlist 채택 (2026-04-16) | S0 착수 전 필수 |
| **BL-6** | S5 | ✅ 해소 — (B) `/admin/settings/health` 서브라우트 채택 (2026-04-16) | S5 진입 전 필수 (S0 시점 권장) |
| ~~BL-11~~ | S5 | ✅ 해소 — **Resend** 채택 (2026-04-19, 21차) | ~~S5 진입 전 필수~~ |
| ~~BL-12~~ | S5 | ✅ **폐기** — SMS 백업 자체를 제거, D10 = 이메일 1회 재시도로 축소 (2026-04-19, 22차) | ~~S5b 진입 전 필수~~ |
| ~~BL-13~~ | S5 | ✅ 해소 — **네이버 뉴스 API + 스크래핑 하이브리드** (2026-04-19, 21차) | ~~S5 진입 전 필수~~ |
| ~~BL-14~~ | S5 | ✅ 해소 — **한투 WebSocket 실시간** 채택 (2026-04-19, 22차). 1분 폴링은 ±5%/거래량 3배 스파이크 희석 리스크로 거부 | ~~S5b 진입 전 필수~~ |
| ~~BL-15~~ | S5 | ✅ 해소 — **Vercel Cron** 채택 (2026-04-19, 21차) — G-6 배포 플랫폼 = Vercel 부수 확정 | ~~S5 진입 전 필수~~ |
| ~~BL-16~~ | S6 | ✅ 해소 — **A** Anthropic `/messages` usage 실시간 파싱 + per-persona·per-section 태깅 (2026-04-19, 22차 후속) | ~~S6 킥오프 전~~ |
| ~~BL-17~~ | S6 | ✅ 해소 — **B** override 토글 권한 = 대표 1인 (2026-04-19, 22차 후속) | ~~S6 킥오프 전~~ |
| ~~BL-18~~ | S6 | ✅ 해소 — **B** 견적 임계치 (실 API dry-run 미실시, dry-run-estimate.ts 박제, 2026-04-19, 22차 후속) | ~~S6 진입 전 필수~~ |
| ~~BL-19~~ | S3 | ✅ 해소 — **옵션 D 하이브리드** 채택 (pykrx seed → Supabase `kr_business_days` 캐시 → Next.js SELECT, 2026-04-17) | ~~S3 킥오프 전 필수~~ |
| ~~BL-20~~ | S3 | ✅ 해소 — **옵션 A 자동 바이패스** 채택 (7일 연속 단일 접속 → AlertEvent gating_auto_relief 로그, 2026-04-17) | ~~S3 킥오프 전 필수~~ |

~~**S0 진입 전 필수 해소**: BL-1 (미해소), BL-2 (해소)~~ → **S0 완료 (2026-04-17)**
~~**S0 시점 권장 (S5 전 필수)**: BL-6~~ → **BL-6 해소 완료 (2026-04-16, 옵션 B — `/admin/settings/health` 서브라우트)**
**S3 킥오프 전 필수 해소**: BL-19, BL-20
~~**S5 진입 전 필수 해소**: BL-11, BL-13, BL-15~~ → 해소 완료
~~**S6 진입 전 필수 해소**: BL-18~~ → 해소 완료 (B 견적 임계치)
**Mock Skeleton 블로커 전 해소** — Mock 동작 19/19 완료

### 실데이터 전환 + S8 자동매매 BL-KRIT (착수 전 반드시 해소)

| BL-KRIT | 대상 | 영향 |
|---|---|---|
| **BL-KRIT-1** | Anthropic API Key | M17·M11·M12·M19 실 AI 호출 불가 · S8 AI 어댑터 본체 |
| **BL-KRIT-2** | KIS (한투) API 계정 | M13 장중 WebSocket + **S8 주식 자동매매** 불가 |
| **BL-KRIT-3** | Naver News API 키 | M12 뉴스 sweep 실 동작 불가 |
| **BL-KRIT-4** | Resend 계정 | M11·D10 catch-up 이메일 발송 불가 |
| **BL-KRIT-5** | Telegram Bot | M13·M15 텔레그램 2채널 불가 |
| ~~BL-KRIT-6~~ | ✅ Supabase anon 키 갱신 (2026-04-21 해소, DQ-5) | — |
| **BL-KRIT-7** | 마이그레이션 0009 (alert_event CHECK 확장) | 신규 AlertType 6종 실 INSERT 거부됨 |
| **BL-KRIT-8** | 마이그레이션 **0011** (S8 자동매매 E13~E17: OrderQueue·TradeExecution·RiskPolicy·RiskViolationEvent·StrategyRegistration) — E12 ExchangeConnection은 DQ-7 0009 선행 생성 | S8 전체 (주문 큐·체결 이력·포지션·리스크 이벤트·코인 거래소 연결) |
| **BL-KRIT-9** | 바이낸스 API 키 + IP/KYC 조건 | S8 코인 자동매매 |

상세는 `Document/Process/HANDOFF.md` §4 참조.

---

## §6 Risk 대시보드

> architect §8 R1~R8 요약. 상세 완화책은 각 슬라이스 파일 참조.

| ID | 리스크 요약 | 발현 슬라이스 | 핵심 완화 |
|---|---|---|---|
| **R1** | Exit 시그널 미수신 1건 → 전체 신뢰 붕괴 (pre-mortem B) | S5 | M18을 S5a와 동시 건설 |
| **R2** | AI 비용 폭주 (30종 × 151 페르소나 구조적 위험) | S6 이전 | BL-18 dry-run 게이트 필수. S4 cost_log stub pre-wire |
| **R3** | M7 race condition: 3인 동시 Accept → 중복 is_final | S3 | E4 UNIQUE(month) WHERE is_final=true + 낙관적 락 |
| **R4** | M10 배치 실패 → D+5 기산 공백 → CAP Months 단절 | S5 | 3회 재시도 + 전월 유지 + M18 scheduler_fail Critical 호출 |
| **R5** | M9 cap과 M17 hardcap 상호작용 버그 | S4→S6 | S4에서 40만 차단 훅 stub 선행 심기 |
| **R6** | S3(집행 UI) 범위 폭주 위험 | Deferred-X 결정 시 | S3 옵션 A 채택(Must 19 밖 이관) 권장 |
| **R7** | `/admin/health` IA 미포함 → S5 중 IA 재협상 | S5 진입 전 | BL-6 사전 해소. 서브라우트 편입이 최소 변경 |
| **R8** | D15 2인 열람 게이팅: 1인 어드민 연속 상황 → Accept 영구 차단 | S3 | "1인 7일 연속" 예외 룰 S3 DoD에 추가 결정 필요 |

---

## §7 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect audit(`.omc/research/must-19-slice-mapping.md`) 결과 반영. S3(집행 3경로) Must 19 밖 이관(Deferred-X). 총 25세션 계획 확정. |
| 2026-04-17 | **S0 Foundation ✅ 완료**. BL-1 해소 (Supabase fpriyjykihxhhvqudvdb 연결 · ADMIN_EMAILS 3명). 17 라우트(admin 11 + main 6) · 8 AGENTS.md 계층 · 9엔티티 RLS sketch · mock-admin 구조 · 디자인 토큰(한국 증시 market-up/down/neutral). build·lint 0. S1 진행 가능. |
| 2026-04-17 | **BL-3 해소** (옵션 C). S1 mock fixture 30종 = backtest/v6 로직 관점 Claude 정성 생성(2026-04 스냅샷). 30종 의미 재정의: 단/중/장 = 상승 예상 기간 10+10+10. S1 착수 준비 완료. |
| 2026-04-17 | **Deferred-Y 박제** — AI Agent 기반 선정엔진 v2 트랙 추가 (Must 19 밖). S1에서 사용자 v2 고도화 의향 표명 → v0(mock)→v1(pykrx+v6)→v2(AI agent) 진화 경로 문서화. |
| 2026-04-17 | **S1 T1.1·T1.2 완료**. E1 `short_list_30` 마이그레이션 + 33행 mock fixture(30 + REMOVED 3) + `/admin` 3섹션 세로 스택 + `BucketSection` 컴포넌트 분리. lint 0·build 17 routes. T1.3은 다음 세션에 디자인 하네스로 진행. §5 BL-6 해소 표기 정리. |
| 2026-04-17 | **S1 ✅ 완료 (17차)**. T1.3 `shortlist-row.tsx` (Composite·3축·Crisis·괴리율·스파크라인 + `<details>` 펼침 패널) + T1.4 `delta-banner.tsx` (편입/유지/제외 집계+펼침) + T1.5 3줄 근거(row 내장) + T1.6 `missing-count-banner.tsx` (스크리닝 미달 vs 스케줄러 실패). `ShortListItem`에 name·sector·divergencePct·sparkline7d + CRISIS_VOL_THRESHOLD·SHORTLIST_TARGET_COUNT·ShortageReason 추가. **Must 4/19 달성 (M1·M4·M5·M6)**. lint 0·build 17 routes. 실제 세션 2회(16·17차)로 예상 4세션 대비 절반. |
| 2026-04-17 | **S2 블로커 4건 해소** (17차 후속). BL-4=B(codegen 인라인, 대표 3~5종 상세), BL-5=B(1일 1회 dedupe UNIQUE), G-5=B(E10 ReportViewLog 분리 + DISTINCT 집계), G-11=자동 해소(G-5 B). 파생: E4에서 `report_view_count` 제거, 신규 엔티티 E10 도입(ServicePlan-Admin §4.2 수정 S2 킥오프 첫 행동). S2 ⚪ → 🟢 진행 가능. |
| 2026-04-17 | **S3 블로커 3건 해소** (18차 후속). BL-7=A (자유 텍스트 min 20자) · BL-19=D (pykrx seed → Supabase `kr_business_days` 캐시 → Next.js SELECT) · BL-20=A (자동 바이패스 + AlertEvent gating_auto_relief). 파생: S3 슬라이스 엔티티에 E11 KrBusinessDays·AlertEvent 타입 추가, Tasks T3.1a(Python seed)·T3.8(자동 바이패스) 신설, 2인 게이팅 로직 `COUNT(DISTINCT admin_id) FROM report_view_log`로 수정. G-10(테스트 전략)만 킥오프 시 경량 결정으로 이월. |
| 2026-04-17 | **S2 ✅ 완료 (18차)**. T2.1 0003 마이그레이션(E2·E3·E10 + RLS) + 4 mock 파일(report·committee·personas·view-log) · T2.2 Sticky Side Nav + hash anchor · T2.3 `<details>` 10 섹션 accordion · T2.4 `report_view_log` INSERT 파이프(mock+Supabase TODO 준비) · T2.5 prev/next 버킷 내비 · T2.6 Core 11+Sector 5인 집계 카드+핵심 인용+위원별 디스클로저 · T2.7 3축+5-Signal 정적 시각화. ServicePlan-Admin §4.2 SoT 갱신(E4 `report_view_count` 제거+E10 신설+§4.3 다이어그램). **Must 6/19 (32%) 달성**. lint 0·build 17 routes. 실제 1세션(예상 3세션 대비 1/3). |
| 2026-04-17 | **S3 ✅ 완료 (19차)**. T3.0 Vitest 셋업 + T3.1·T3.1a 0004 마이그레이션(E4 v1.3·E11 kr_business_days·alert_event gating_auto_relief) + Ralph 5 wave(T3.5·T3.3·T3.8 병렬 순수로직 → T3.6 게이팅 → T3.2+T3.4 페이지 foundation → T3.5/T3.6/T3.8 UI 통합 → T3.7 이의 제기). 5 test files · **43 tests pass** · lint 0 · build 17 routes. architect APPROVED + ai-slop-cleaner 패스(console.log 4건 + alt fixture 14줄 삭제). 비블로킹 3건은 S3 hardening 이월. **Must 7/19 (37%) 달성**. 실제 1세션(예상 4세션 대비 25%). |
| 2026-04-19 | **S4 ✅ 완료 (20차)**. BL-8=A(복합 AND)·BL-9=A(서브라우트)·S3 hardening=B(T4.6 병행). T4.1 0005 마이그레이션(E5·E8·cost_log stub + RLS) + T4.2 `src/lib/performance/` 6모듈(sharpe·mdd·alpha·judge·cap-months·regen-cap) + T4.3 `/admin/track-record` + T4.4 `/admin/decision-tree`(Recharts client island) + T4.5 `/admin/report/[ticker]/regenerate` 서브라우트 + T4.6 E5 snapshot INSERT hook·resolveAdminId·trim 정규화·isUniqueViolation try/catch. **87 tests pass** · lint 0 · build 17 routes. architect APPROVED + ai-slop-cleaner(`manualRemaining` 미사용 prop·redundant 주석·await resolveAdminId 무의미 호출 삭제). **Must 10/19 (53%) 달성** (M8·M9·M16). 실제 1세션(예상 4세션 대비 25%). |
| 2026-04-19 | **S5 블로커 4건 해소 (21차)**. BL-11=Resend · BL-13=네이버 뉴스 API+스크래핑 하이브리드 · BL-15=Vercel Cron · 분할=S5a(M10·M11·M12·M18)→S5b(M13·M14·M15) 2 wave. G-6 배포 플랫폼 = Vercel 부수 확정. |
| 2026-04-19 | **S5a ✅ 완료 (21차)**. Wave 1(0006 마이그레이션 pipeline_health·news_event·briefing_log·briefing_view_event + RLS 4종 + 타입 확장 AlertType·PipelineHealth·NewsEvent + mock 4건) → Wave 2 병렬 T5a.1 M10 배치(vercel.json crons + `/api/cron/monthly-batch` + `src/lib/scheduler/monthly-batch.ts` 재시도 3회 + scheduler_fail AlertEvent) · T5a.2 M11 브리핑(`/api/cron/morning-briefing` 08:00 KST + `src/lib/email/resend.ts` + `src/lib/briefing/compose.ts` + `/admin` BriefingCard) · T5a.4 M18 헬스(`src/lib/health/pipeline-health.ts` + `/admin/settings/health` 5 파이프라인 × 24h 성공률 + 95% Critical 배너) → Wave 3 T5a.3 M12 분류기(`src/lib/news/{naver-api,scraper,classifier}.ts` + `/api/cron/news-sweep` + `/admin/alerts` + `/admin/alerts/[id]`) → Wave 4 Vitest 4 files 41 tests → Wave 5 검증. **128 tests pass** · lint 0 · build 20 routes. **Must 14/19 (74%) 달성** (M10·M11·M12·M18). 실제 1세션(예상 3세션 대비 33%). |
| 2026-04-19 | **S5b 킥오프 2 블로커 해소 (22차)**. BL-12 폐기(SMS 제거, D10 = 이메일 1회 재시도로 축소) · BL-14 = WebSocket(한투 실시간, 1분 폴링 거부). ServicePlan-Admin §3.10 R3.10-15·M15 DoD 2채널로 갱신. |
| 2026-04-19 | **S5b ✅ 완료 (22차)**. 0007 마이그레이션(admin_settings·ticker_alert_pref·intraday_anomaly_event + RLS 3종) + T5b.1 M13 장중 감지(src/lib/intraday/{anomaly-detect,kis-websocket}·IntradayBadge·AlertType intraday_anomaly) + T5b.2 M14 토글(`/admin/settings` + setIntradayMode·setTickerAlertEnabled) + T5b.3 M15 Exit 2채널(src/lib/notify/{telegram,exit-dispatch} · D10 이메일 1회 재시도 · `/admin/alerts/[id]` 결정 UI · recordExitDecision) + Vitest 2 files 30 tests. **158 tests pass** · lint 0 · build 20 routes. **Must 17/19 (89%) 달성** (M13·M14·M15). 실제 1세션(예상 2세션 대비 50%). |
| 2026-04-19 | **S6 블로커 4건 일괄 해소 (22차 후속)**. BL-16 = A · BL-17 = B · BL-18 = B · G-3 = B. S6 진입 가능. |
| 2026-04-20 | **S6 ✅ Mock 완료 (23차)**. 0008 마이그레이션(cost_log 확장 ticker·persona_id·section + heartbeat_log + RLS) + T6.1~T6.6 직접 실행. src/lib/cost/{anthropic-pricing,dry-run-estimate,aggregate}.ts + src/lib/health/heartbeat.ts + `/admin/settings/cost` 대시보드 + `/api/cron/silent-health` (매일 24:00 KST·mock 페이로드) + Sidebar nav 확장 + Vitest 3 files. **20 files / 190 tests pass** · build 22 routes · lint 0. Mock Skeleton Stage 1 완성(S0~S6). 실데이터·실 AI·운용 검증 0. 실제 누적 9세션(예상 25 대비 36%). |
| 2026-04-20 | **23차 후속 HANDOFF 정정**. S6 종료 시 "🎉 MVP Stage 1 완료 · Must 19/19 (100%)" 어휘가 mock-only를 진짜 MVP로 오인케 한다는 사용자 지적. feedback_mvp_framing.md 규칙을 문서 본문에 반영: Mock 동작 vs 실데이터 vs 운용 검증 3축 분리. Dashboard 상단 상태·슬라이스 표·Must 19 표·Global Blocker에 BL-KRIT-1~7 (외부 API·Supabase anon·CHECK 확장) 신설. S7(실데이터 전환) 슬라이스 플레이스홀더 삽입. HANDOFF.md 전면 재작성(§2 진입 결정 트리 + §3 DQ 리스트 + §4 BL-KRIT + §5 자율 작업 + §6 S7a~e 로드맵). |
| **2026-04-21** | **어드민 = 내부 투자 도구 재정의 + 자동매매 S8 승격 + Stage 어휘 폐기 (D16)**. 슬라이스 요약 표에 **S8 자동매매 프레임** (주식 KIS + 바이낸스 선물) · **S9 운용 검증** 신규 2행 추가. Deferred-X → S8로 승격 표기, Deferred-Y → S8 AI 어댑터 흡수 표기, Deferred-D(멤버) 별도 트랙으로 분리. 전체 실행 순서 다이어그램을 "S7 → S8 → S9 → 어드민 내부 도구 완성"으로 교체. Global Blocker에 BL-KRIT-8(마이그레이션 0011 E13~E17, E12는 DQ-7 0009 선행) + BL-KRIT-9(바이낸스 키·IP·KYC) 추가. Must 19 표는 변경 없음(S8은 Must 19 밖 집행 레이어). 상단 진행률 표를 "Mock + 실데이터 + 자동매매 + 운용 4조건"으로 수정. |
