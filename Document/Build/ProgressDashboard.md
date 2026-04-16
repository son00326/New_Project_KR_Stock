# ProgressDashboard — 주픽 어드민 빌드 상황판

> originally architect ID: 전체 슬라이스 통합 뷰 (`.omc/research/must-19-slice-mapping.md` §5·§7·§8·§9 기반)

Last updated: 2026-04-16
총 슬라이스: 7개 (S0~S6) + Deferred-X 1개
총 예상 세션: **25세션** (S3 옵션 A 채택 시. 옵션 B 시 27세션)
Must 19 진행률: **0 / 19 완료 (0%)**

---

## §1 슬라이스 요약 표

| ID | 이름 | 포함 Must | 예상 세션 | 상태 | 블로커 요약 | 파일 |
|---|---|---|---|---|---|---|
| **S0** | Foundation | 없음 (인프라 선행) | 2 | ⚪ 대기 | BL-1 Supabase env, BL-2 admin role 정의 | [S0-Foundation.md](./Slices/S0-Foundation.md) |
| **S1** | Short List 30 홈 + 분석엔진 출력 | M1·M4·M5·M6 | 4 | ⚪ 대기 | BL-3 mock fixture 분포 | [S1-ShortList30.md](./Slices/S1-ShortList30.md) |
| **S2** | 풀 리포트 + 투심위 | M2·M3 | 3 | ⚪ 대기 | BL-4 mock 원고 책임자, BL-5 dedupe 정책 | [S2-FullReport.md](./Slices/S2-FullReport.md) |
| **S3** | 승인 워크플로우 (+D15) | M7 | 4 | ⚪ 대기 | BL-7 이의 제기 UX | [S3-Approval.md](./Slices/S3-Approval.md) |
| **S4** | 가상 포트·성과 측정 + Decision Tree | M8·M9·M16 | 4 | ⚪ 대기 | BL-8 판정기준, BL-9 재생성 UI | [S4-Performance.md](./Slices/S4-Performance.md) |
| **S5** | 스케줄러·알림·Exit + M18 동시 | M10·M11·M12·M13·M14·M15·M18 | 5 (S5a 3 + S5b 2) | ⚪ 대기 | BL-11 이메일벤더, BL-13 뉴스벤더, BL-15 배치환경 | [S5-Automation.md](./Slices/S5-Automation.md) |
| **S6** | Hardening (AI 비용 + Silent Health) | M17·M19 | 3 | ⚪ 대기 | BL-16 비용수집, BL-18 dry-run 선행 | [S6-Hardening.md](./Slices/S6-Hardening.md) |
| **Deferred-X** | 증권사 API + 매뉴얼/자동매매 UI | Must 19 밖 이관 | — | ⏸ 보류 | 옵션 A 채택 시 Must 19 범위 외 | [Deferred-Brokerage.md](./Slices/Deferred-Brokerage.md) |

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
| M1 | Short List 30 홈 표시 | S1 | ⚪ |
| M2 | 풀 리포트 렌더링 | S2 | ⚪ |
| M3 | 투심위 투표 요약 패널 | S2 | ⚪ |
| M4 | 5-Signal Composite + 3축 분석엔진 출력 | S1 | ⚪ |
| M5 | 편입/유지/제외 Delta 뷰 | S1 | ⚪ |
| M6 | 선정 근거 요약 카드 (3줄) | S1 | ⚪ |
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
| **BL-1** | S0 | Supabase 프로젝트 키·env 세팅 | S0 착수 전 필수 |
| **BL-2** | S0 | admin role 정의 (email allowlist vs role claim) | S0 착수 전 필수 |
| **BL-6** | S5 | `/admin/health` 라우트 승격 vs `/admin/settings/health` 서브라우트 결정 | S5 진입 전 필수 (S0 시점 권장) |
| **BL-11** | S5 | 이메일 벤더 선택 (SendGrid/Resend/AWS SES) | S5 진입 전 필수 |
| **BL-13** | S5 | 뉴스 벤더 선택 (구체 업체 미정) | S5 진입 전 필수 |
| **BL-15** | S5 | 배치 실행 환경 (Vercel Cron vs Supabase Edge vs GitHub Actions) | S5 진입 전 필수 |
| **BL-18** | S6 | P5 I-03 토큰 dry-run 실측 (S6 진입 전 게이트) | S6 진입 전 필수 |
| **BL-19** | S3 | [G-4] 한국 영업일 캘린더 데이터 소스 (pykrx 역산 / KRX 하드코딩 / 외부 API) | S3 킥오프 전 필수 |
| **BL-20** | S3 | [G-9] R8 "1인 어드민 7일 연속" 2인 게이팅 예외 룰 (자동 바이패스 / 수동 오버라이드 / 예외 없음) | S3 킥오프 전 필수 |

**S0 진입 전 필수 해소**: BL-1, BL-2
**S0 시점 권장 (S5 전 필수)**: BL-6
**S3 킥오프 전 필수 해소**: BL-19, BL-20
**S5 진입 전 필수 해소**: BL-6, BL-11, BL-13, BL-15
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
