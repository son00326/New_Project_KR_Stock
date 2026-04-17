# ProgressDashboard — 주픽 어드민 빌드 상황판

> originally architect ID: 전체 슬라이스 통합 뷰 (`.omc/research/must-19-slice-mapping.md` §5·§7·§8·§9 기반)

Last updated: 2026-04-17 (18차 — S2 ✅ 완료)
총 슬라이스: 7개 (S0~S6) + Deferred-X 1개
총 예상 세션: **25세션** (S3 옵션 A 채택 시. 옵션 B 시 27세션)
Must 19 진행률: **6 / 19 완료 (32%)**  (M1·M2·M3·M4·M5·M6 — S1·S2에서 달성)
S0 Foundation: ✅ 완료 (2026-04-17)
S1 Short List 30 홈: ✅ 완료 (2026-04-17)
S2 풀 리포트·투심위: ✅ 완료 (2026-04-17)

---

## §1 슬라이스 요약 표

| ID | 이름 | 포함 Must | 예상 세션 | 상태 | 블로커 요약 | 파일 |
|---|---|---|---|---|---|---|
| **S0** | Foundation | 없음 (인프라 선행) | 2 | ✅ 완료 | — | [S0-Foundation.md](./Slices/S0-Foundation.md) |
| **S1** | Short List 30 홈 + 분석엔진 출력 | M1·M4·M5·M6 | 4 (실제 2) | ✅ 완료 | — | [S1-ShortList30.md](./Slices/S1-ShortList30.md) |
| **S2** | 풀 리포트 + 투심위 | M2·M3 | 3 (실제 1) | ✅ 완료 | — | [S2-FullReport.md](./Slices/S2-FullReport.md) |
| **S3** | 승인 워크플로우 (+D15) | M7 | 4 | 🟢 진행 가능 | — (BL-7·BL-19·BL-20 3건 해소, G-10 경량 이월) | [S3-Approval.md](./Slices/S3-Approval.md) |
| **S4** | 가상 포트·성과 측정 + Decision Tree | M8·M9·M16 | 4 | ⚪ 대기 | BL-8 판정기준, BL-9 재생성 UI | [S4-Performance.md](./Slices/S4-Performance.md) |
| **S5** | 스케줄러·알림·Exit + M18 동시 | M10·M11·M12·M13·M14·M15·M18 | 5 (S5a 3 + S5b 2) | ⚪ 대기 | BL-11 이메일벤더, BL-13 뉴스벤더, BL-15 배치환경 | [S5-Automation.md](./Slices/S5-Automation.md) |
| **S6** | Hardening (AI 비용 + Silent Health) | M17·M19 | 3 | ⚪ 대기 | BL-16 비용수집, BL-18 dry-run 선행 | [S6-Hardening.md](./Slices/S6-Hardening.md) |
| **Deferred-X** | 증권사 API + 매뉴얼/자동매매 UI | Must 19 밖 이관 | — | ⏸ 보류 | 옵션 A 채택 시 Must 19 범위 외 | [Deferred-Brokerage.md](./Slices/Deferred-Brokerage.md) |
| **Deferred-Y** | AI Agent 기반 선정엔진 v2 | Must 19 밖 (엔진 고도화) | — | ⏸ 보류 | Must 19 완료 + v1 2~3개월 운용 후 | [Deferred-AIAgent-Selection.md](./Slices/Deferred-AIAgent-Selection.md) |

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
[MVP Stage 1 완료: Must 19 전원 가동]

총 세션: 2 + 4 + 3 + 4 + 4 + 5 + 3 = 25세션
```

---

## §3 Must 19 상태 표

| Must ID | 공식 명칭 | 담당 슬라이스 | 상태 |
|---|---|---|---|
| M1 | Short List 30 홈 표시 | S1 | ✅ |
| M2 | 풀 리포트 렌더링 | S2 | ✅ |
| M3 | 투심위 투표 요약 패널 | S2 | ✅ |
| M4 | 5-Signal Composite + 3축 분석엔진 출력 | S1 | ✅ |
| M5 | 편입/유지/제외 Delta 뷰 | S1 | ✅ |
| M6 | 선정 근거 요약 카드 (3줄) | S1 | ✅ |
| M7 | 승인 워크플로우 (+ D15 게이팅) | S3 | ⚪ |
| M8 | 가상 포트폴리오 트래킹 엔진 | S4 | ⚪ |
| M9 | 리포트 재생성 cap 가드 | S4 | ⚪ |
| M10 | 월간 자동 배치 스케줄러 | S5 | ⚪ |
| M11 | 모닝 브리핑 요약 카드 | S5 | ⚪ |
| M12 | 뉴스 심각도 분류기 | S5 | ⚪ |
| M13 | 장중 이상 감지 알림 (+ 모드 설정) | S5 | ⚪ |
| M14 | 종목별 커스텀 임계치 on/off | S5 | ⚪ |
| M15 | Exit 시그널 발송 + 근거 + 대안 | S5 | ⚪ |
| M16 | Decision Tree 진척도 대시보드 | S4 | ⚪ |
| M17 | AI API 비용 실시간 모니터링 대시보드 | S6 | ⚪ |
| M18 | 파이프라인 헬스체크 대시보드 | S5 (S5a와 동시) | ⚪ |
| M19 | Silent Health 일간 하트비트 | S6 | ⚪ |

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
| **BL-11** | S5 | 이메일 벤더 선택 (SendGrid/Resend/AWS SES) | S5 진입 전 필수 |
| **BL-13** | S5 | 뉴스 벤더 선택 (구체 업체 미정) | S5 진입 전 필수 |
| **BL-15** | S5 | 배치 실행 환경 (Vercel Cron vs Supabase Edge vs GitHub Actions) | S5 진입 전 필수 |
| **BL-18** | S6 | P5 I-03 토큰 dry-run 실측 (S6 진입 전 게이트) | S6 진입 전 필수 |
| ~~BL-19~~ | S3 | ✅ 해소 — **옵션 D 하이브리드** 채택 (pykrx seed → Supabase `kr_business_days` 캐시 → Next.js SELECT, 2026-04-17) | ~~S3 킥오프 전 필수~~ |
| ~~BL-20~~ | S3 | ✅ 해소 — **옵션 A 자동 바이패스** 채택 (7일 연속 단일 접속 → AlertEvent gating_auto_relief 로그, 2026-04-17) | ~~S3 킥오프 전 필수~~ |

~~**S0 진입 전 필수 해소**: BL-1 (미해소), BL-2 (해소)~~ → **S0 완료 (2026-04-17)**
~~**S0 시점 권장 (S5 전 필수)**: BL-6~~ → **BL-6 해소 완료 (2026-04-16, 옵션 B — `/admin/settings/health` 서브라우트)**
**S3 킥오프 전 필수 해소**: BL-19, BL-20
**S5 진입 전 필수 해소**: BL-11, BL-13, BL-15
**S6 진입 전 필수 해소**: BL-18

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
