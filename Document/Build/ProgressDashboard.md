# ProgressDashboard — 주픽 어드민 빌드 상황판

> originally architect ID: 전체 슬라이스 통합 뷰 (`.omc/research/must-19-slice-mapping.md` §5·§7·§8·§9 기반)

Last updated: 2026-05-19 (49차 — **S7a Anthropic wrapper 코드 구현 진행 중** · `feat/s7a-anthropic-wrapper` branch (8 commits ahead of main, push 보류, billing 미충전 mock 100% 진행) · Task 4/17 ✅ + omxy 적대적 코드 검토 R1~R3 CONVERGED (3 critical BLOCKERS catch + fix — PostgreSQL IF null / Q3 partA semantic / committee_votes.vote enum mismatch) · **다음 1순위 = Task 5 cost-logger → ... → Task 17 검증 게이트** · omxy debate 누적 **25 rounds CONVERGED** · 진입점 = `HANDOFF.md §0`)

이전 갱신: 2026-05-13 (48차 — **§7 P3.2 + P3.4 완료 + 마이그 0016 production apply + origin push ✅** (cmux pair-debate omxy 3 rounds CONVERGED + 사용자 트리거 후속) · 마이그 0016 `accept_shortlist_with_snapshots` RPC apply 완료 + anon revoke hotfix(Supabase default grant 차단) + acceptShortList orphan-safety RPC 일원화 + G-cron-auth 12 + G-wrapper-error 8 + G-FE-map 9 + RPC 4 = **+34 tests / 463 pass / 50 files** · 47차 P2.2~P2.4 ✅ + 46차 P0·P1 ✅ · S7e 7/8 (T7e.7 RLS QA 잔여) · 다음 1순위 = S7a Anthropic wrapper (AI 키 B-6 발급 트리거) 또는 §7 P3.1 (D20 컴포넌트, S7a 시드 후) + P3.3 (error taxonomy 사용자 결정) · HIBP 토글 B-2A 사용자 잔여)
총 슬라이스: 7개 (S0~S6 Mock) + **DQ-7 Admin Credential (Session 3 ~97%, Smoke #4·#5 잔여 · Smoke #3은 S8까지 유예)** + **S7 실데이터 전환 (🟢 진행 중 — S7e ~50%)** + **S8 자동매매 프레임 (분리 — S7d 후 단독 진입)** + **S9 운용 검증** + Deferred-D(멤버, 별도 트랙)
총 예상 세션: 9(완료) + **4(DQ-7, Session 1·2·30·32·33 = ~3 완료, Smoke #4·#5 + Session 4 QA 잔여 ~1)** + 8(S7, 36차 진입) + 4(S8) = **약 25 세션** + S9 운용 4~8주
**진행률 (정확)**: Mock 동작 **19/19** · **DQ-7 구현 ~97% (Session 1·2 ✅ + 30차 Vercel + 32차 Supabase 마이그 + 33차 Smoke #1·#2·#6 ✅ — Smoke #4·#5 잔여 · Smoke #3은 S8까지 유예)** · **S7e 7/8 (T7e.1·T7e.2·T7e.3·T7e.4·T7e.5·T7e.6 ✅ + T7e.8 DART 실 시드 ✅), T7e.7 RLS QA 잔여** · **46차 P0·P1 ✅ + 47차 P2.2~P2.4 ✅ + 48차 P3.2 + P3.4 + 마이그 0016 production apply + origin push ✅** (acceptShortList orphan-safety RPC 일원화 + anon revoke hotfix + +34 tests) · 실데이터 **1+/19** (`short_list_30` 30 rows production 적용 · Signal 4·5 DART 실데이터 반영) · 실 AI 호출 **0** · 자동매매 프레임 **0%** · 실 운용 검증 **0일** · **Vercel Production ✅ (25 routes, origin/main 동기)** · 검증 게이트 **build 25 routes · lint 0 · test:ci 463 pass / 50 files** · advisor anon WARN **0** / authenticated WARN **4** (intended)
완성 기준 = Mock + DQ-7 Credential 인프라 + 실데이터 + **자동매매(주식+코인)** + 운용 검증 **5조건 AND** → **미달성**
S0 Foundation: ✅ **Mock 완료** (2026-04-17)
S1 Short List 30 홈: ✅ **Mock 완료** (2026-04-17)
S2 풀 리포트·투심위: ✅ **Mock 완료** (2026-04-17)
S3 승인 워크플로우 (+D15): ✅ **Mock 완료** (2026-04-17)
S4 가상 포트·성과·Decision Tree: ✅ **Mock 완료** (2026-04-19)
S5a 스케줄러·브리핑·뉴스·헬스: ✅ **Mock 완료** (2026-04-19)
S5b 장중·토글·Exit: ✅ **Mock 완료** (2026-04-19)
S6 Hardening (AI 비용 + Silent Health): ✅ **Mock 완료** (2026-04-20)
S7 실데이터 전환 (S7a~e): 🟢 **진행 중** (S7e T7e.1·T7e.2·T7e.3·T7e.4·T7e.5·T7e.6 ✅ + T7e.8 DART Signal 4·5 production 적용 ✅ — T7e.7 RLS QA 잔여) + **S7a 49차 진입 — Task 4/17 ✅ on feat/s7a-anthropic-wrapper branch (HEAD a2d2c04, 8 commits, push 보류)** — HANDOFF §2 참조
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
| **DQ-7** | **Admin Credential System + Vercel 첫 배포** (2026-04-22 신설, S7a 선행) | (Must 19 밖 집행 인프라 · E9 확장 + E12 신설 + `/admin/settings/{brokerage,binance}`) | 4 | — | 🟡 **Session 3 ~97% (30차 Vercel + 32차 Supabase 마이그 + 33차 Smoke #1·#2·#6 ✅ · Smoke #4·#5 잔여 · Smoke #3 ⏸ S8까지 유예 D19)** · prod URL https://tudal-tawny.vercel.app | [DQ7-Credentials.md](./Slices/DQ7-Credentials.md) |
| **S7** | **실데이터 전환** (S7a~e) | 전 Must 실 연결 | 8 (예상) | — | 🟢 **진행 중** (S7e T7e.1~T7e.6 ✅ 36~40차 + T7e.8 DART Signal 4·5 production 적용 ✅, T7e.7 RLS QA 잔여) | [S7-RealData.md](./Slices/S7-RealData.md) |
| **S8** | **자동매매 프레임** (주식 KIS + 바이낸스 선물, Strategy drop-in + AI 어댑터) | Must 19 밖 (어드민 집행 서브시스템) | 4 (스캐폴드 2 + 실 체결 2) | — | ⚪ **미착수** (2026-04-21 D16, **2026-05-08 D18 — S7d 후 단독 진입으로 분리**) | [S8-AutoTrading.md](./Slices/S8-AutoTrading.md) |
| **S9** | **어드민 운용 검증** | Mock+실 혼합 → 실계좌/메인넷 전환 | 4~8주 (세션 외) | — | ⚪ 미착수 | — |
| ~~Deferred-X~~ | ~~증권사 API + 매뉴얼/자동매매 UI~~ | **S8로 승격 (2026-04-21)** | — | — | — | [Deferred-Brokerage.md](./Slices/Deferred-Brokerage.md) (승격 표기만) |
| ~~Deferred-Y~~ | ~~AI Agent 기반 선정엔진 v2~~ | **S8 AI 어댑터에 흡수 예정 (2026-04-21)** | — | — | — | [Deferred-AIAgent-Selection.md](./Slices/Deferred-AIAgent-Selection.md) (포인터만) |
| **Deferred-D** | 멤버 페이지 (500cap 초대) | 현 어드민 플랜과 분리 | — | ⏸ 보류 | — | `ServicePlan-Member.md` |

> **슬라이스 번호 vs Architect ID 매핑**: S0→S0, S1→S1, S2→S5(architect), S3→S2(architect), S4→S4, S5→S6(architect), S6→S7(architect), Deferred-X→S3(architect)

---

## §2 전체 실행 순서

> **v3.1 시퀀스 박제 (2026-05-08, 35차)**: D19 결정 — **Short List 30 선정에 Tier 0 인디케이터 게이트 + 합의 배지 + Reflection 추가**. AI 키 발급 여부에 따라 분기. AI 키 미발급 시 Tier 0 단독으로 진짜 코스피·코스닥 30종목 + 실 가격·재무·뉴스 가동 가능. AI 키 발급 시 Tier 1 (Core 11) + Tier 2 (Sector Board) plug-in. v3 (34차) 박제 = S8 자동매매를 S7 series 다음으로 분리, KIS는 자동매매 전용, 일간 데이터·AI 가상 포트는 KIS 무관. 상세 = `HANDOFF.md §2.D` (후속 슬라이스 시퀀스 다이어그램) + `ServicePlan-Admin.md §1A.5 D18·D19`.

```
S0~S6 Mock Skeleton ✅ (9 세션, 2026-04-17 ~ 2026-04-20)
     │
     ▼
[Mock Skeleton 완료: Must 19/19]
     │
     ▼
DQ-7 Admin Credential System  ← **DQ-7는 사용자 액션 대기 큐로 분리 (HANDOFF §B)**
     ├ Session 1 ✅ Backend·DB
     ├ Session 2 ✅ Frontend
     ├ Session 3 🟢 Deploy (30차 Vercel + 32차 Supabase 마이그 + 33차 Smoke #1·#2·#6)
     │             잔여: Smoke #4·#5 (사용자 액션 대기 — 친구 비번 + KIS 슬롯 재등록 후)
     │             ⏸ Smoke #3 (Binance) — D19 (35차) S8까지 유예
     └ Session 4 ⚪ QA·Close (T18·T19·T20) — Smoke 통과 후
     │
     │  **35차 결정**: DQ-7 ~97% 상태로 두고 자율 트랙 우선 진입.
     │  사용자 가용 시점에 큐에서 1건씩 처리.
     │
     │
     ▼
★ 자율 트랙 진입점 (35차, AI 키 불필요)
S7e · Supabase 실 SELECT/INSERT 전면 전환 (2세션)            ← BL-KRIT-7 (마이그 0010, ✅ 36차)
     │  + T7e.5 ✅ regen_counter CAS race-safe (39차, 신규 마이그 0건)
     │  + T7e.6 ✅ access-logs/performance/decision-tree (40차, 신규 마이그 0건, snapshot 단일 SoT)
     │  + T7e.8 Tier 0 인디케이터 게이트 (AI 키 불필요, D19)
     │     pykrx·KRX·DART → 5-Signal Composite × 시간대별 가중치
     │     단/중/장 후보 50씩 = 150 → 진짜 코스피·코스닥 30종목 자동 선정
     │     출력: 🔢 숫자 점수(0~100), AI 키 미발급 시 🤖는 ⚪ "AI 분석 대기" placeholder
     ▼
[큐 §B 처리 진행 중] AI 키 발급(B-6) 시 plug-in
S7a · Anthropic wrapper + cost_log 실 INSERT (1세션)        ← BL-KRIT-1
     │  T7a.1~10 (Tier 1 Core 11 + Tier 2 Sector Board 30종목 + 합의 배지 4종 + Reflection)
     ▼
S7b · 뉴스 + 모닝 브리핑 실 연결 (2세션)                     ← BL-KRIT-3 잔여·4
     │
     ▼
★ D11 AI 가상 포트 1차 가동 — KIS 0개로 동작 가능
     │  AI 키 ✅: Tier 0 + Tier 1 + Tier 2 + 합의 배지 + AI 코멘트 1~2줄 + 풀 리포트
     │  AI 키 ⏸: Tier 0 단독 + 🔢 점수 + ⚪ placeholder (실 종목·가격·재무·뉴스는 그대로)
     │  D19 검증 핵심: 진짜 30종목 + 🔢🤖 이중 점수 + 합의 배지 4종 + AI 코멘트 + 클릭→풀 리포트
     │  운용 검증 (어드민 3인, 며칠~1주)
     ▼
S7c · 장중 + Exit 2채널 실 연결 (2세션)                      ← BL-KRIT-2 (KIS 본인 1개) · BL-KRIT-5
     │
     ▼
S7d · Silent Health 실 INSERT + override UI (1세션)
     │
     ▼
S8 자동매매 프레임 — **분리된 단독 진입** (4세션)
     ├ Smoke #3 (Binance 키 저장·암호화·격리) — DQ-7에서 분리된 부분 여기서 진행 (D19)
     ├ 스캐폴드: 마이그 0011 (E13~E17) · Strategy drop-in · AI 어댑터 · Policy Engine (mock 체결)
     └ 실 체결: KIS 모의→실계좌 (3명 동시 또는 본인 1명 + 친구 보조) + 바이낸스 testnet→mainnet
     │   ← BL-KRIT-2 (KIS 자동매매 권한) · BL-KRIT-8 · BL-KRIT-9 (Binance) · DQ-9·10·11 (모두 ✅)
     ▼
S9 어드민 운용 검증 (본인 + 친구 3명, 모의·testnet 위주 → 실계좌·메인넷 점진)
     │
     ▼
[어드민 내부 도구 완성]

총 세션: 9 (완료) + DQ-7 잔여 ~1 + S7 (a/e/b/c/d = 8) + S8 (4) = 약 22 세션 + S9 운용 4~8주
※ AI 키 미발급 상태에서도 S7e + Tier 0로 D11 운용 검증 가능 (D19, AI 키는 검증 중 발급 시 plug-in)
```

### v2 → v3 변경 요약

| 항목 | v2 (~2026-04-22 29차) | v3 (2026-05-08 34차) |
|---|---|---|
| S8 진입 시점 | S7e 직후 스캐폴드 병행 → S7b 후 → S7c·S7d는 강등 큐 | **S7d 후 단독 진입** · S7c·S7d 정규 시퀀스 복귀 |
| AI 가상 포트 1차 가동 | (불명시 — S7b 후 자연 발생 가정) | **명시 게이트** (S7b 후 · KIS 0개 · 운용 검증 며칠~1주 후 S7c) |
| KIS 발급 블로커성 | 자동매매와 동일 시점 (S8-Live) | **S7c는 본인 1개로 충분** · 자동매매는 S8 진입 시점까지 보류 |
| 강등 큐 (S7c·S7d) | 운용 중 체감 시 1세션씩 | **폐기** — 정규 시퀀스 |
| 자동매매 실체결 도달 | 9 세션 | 약 12~14 세션 (D11 운용 검증 추가)

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

**요약**: Mock 19/19 · 실데이터 0/19 (실 I/O 통로 6종 open, DB seed 전) · 실 AI 호출 0/8

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
| ~~BL-KRIT-3~~ | 🟡 Naver News API 키 — 2026-04-30 .env.local 투입 (Vercel env + rotate는 S7b 직전) | — |
| **BL-KRIT-4** | Resend 계정 | M11·D10 catch-up 이메일 발송 불가 |
| **BL-KRIT-5** | Telegram Bot | M13·M15 텔레그램 2채널 불가 |
| ~~BL-KRIT-6~~ | ✅ Supabase anon 키 갱신 (2026-04-21 해소, DQ-5) | — |
| ~~BL-KRIT-7~~ | ✅ **해소 (36차)** — 마이그 0010 `alert_event_rls_hardening` 적용 검증 (`mcp__supabase__list_migrations` version 20260505134639). E6 alert_event 신설 + AlertType CHECK 12종 + 4 RPC + RLS select-all/insert-own/update-own. | ~~신규 AlertType 6종 실 INSERT 거부됨~~ |
| **BL-KRIT-8** | 마이그레이션 **0011** (S8 자동매매 E13~E17: OrderQueue·TradeExecution·RiskPolicy·RiskViolationEvent·StrategyRegistration) — E12 ExchangeConnection은 DQ-7 0009 선행 생성 | S8 전체 (주문 큐·체결 이력·포지션·리스크 이벤트·코인 거래소 연결) |
| **BL-KRIT-9** | 바이낸스 API 키 + IP/KYC 조건 | S8 코인 자동매매 + **DQ-7 Smoke #3 분리(D19, 35차) — S8 진입 시점 발급** |

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
| **2026-04-30** | **31차 — A 문서 갱신**. 사용자 BL-KRIT-3 Naver API 키 제공 → `tudal/.env.local` 투입. (1) §5 BL-KRIT-3 부분 해소 표기 (.env.local 투입, Vercel env + rotate는 S7b 직전) (2) **T5 stale 정정**: §5 BL-KRIT-7 "마이그레이션 0009"→"**0010**" (28차에 재배정됐으나 미반영) (3) HANDOFF §1·§4·§6·§12 + CodebaseStatus 환경변수·체크리스트 동기화. 코드 변경 0건 (env 1줄 추가 외 전부 docs). 검증 회귀 0. |
| **2026-04-21** | **어드민 = 내부 투자 도구 재정의 + 자동매매 S8 승격 + Stage 어휘 폐기 (D16)**. 슬라이스 요약 표에 **S8 자동매매 프레임** (주식 KIS + 바이낸스 선물) · **S9 운용 검증** 신규 2행 추가. Deferred-X → S8로 승격 표기, Deferred-Y → S8 AI 어댑터 흡수 표기, Deferred-D(멤버) 별도 트랙으로 분리. 전체 실행 순서 다이어그램을 "S7 → S8 → S9 → 어드민 내부 도구 완성"으로 교체. Global Blocker에 BL-KRIT-8(마이그레이션 0011 E13~E17, E12는 DQ-7 0009 선행) + BL-KRIT-9(바이낸스 키·IP·KYC) 추가. Must 19 표는 변경 없음(S8은 Must 19 밖 집행 레이어). 상단 진행률 표를 "Mock + 실데이터 + 자동매매 + 운용 4조건"으로 수정. |
| **2026-05-05** | **32차 — Supabase 계정 마이그(Kevin → son00326) + 0001~0010 적용**. MCP `apply_migration`로 0002~0010 9건 + admin_emails 3 row + kr_business_days 2557 row + auth.users 3명. Vercel env 8 entries 교체 + Production 재배포 `dpl_3FfP5ZU9uz7MqKYc4DD6MfomRJTY`. 회귀 3-gate green (build 24 / lint 0 / test:ci 306). T16 Auth URL Config ✅. Smoke #1 (login + /admin) ✅ · Smoke #6 (cron 인증) ✅. Magic Link UI 작동 X → son00326 비번 `Test1234!` 임시 우회. |
| **2026-05-08** | **33차 — Smoke #2 PASS (KIS 키 AES-256-GCM)**. brokerage_connection 1 row (`64601905-01` · son00326 슬롯에 친구 장세현 실전투자 키 임시 박제 · ct=36/180 · iv=12B · tag=16B · 평문 노출 0). row id `f35566e9-…`. **Smoke #4 진입 전 친구 슬롯 재등록 필요** (데이터 의미상 불일치). |
| **2026-05-08** | **34차 — 시퀀스 v3 박제 (D18)**. **S8 자동매매를 S7 series 다음으로 분리**. v2 "S7e 직후 S8-Scaffold 병행 + S7c·S7d 강등 큐" 폐기. v3 = "S7a → S7e → S7b → ★ D11 AI 가상 포트 1차 가동 (KIS 0개) → 운용 검증 → S7c (KIS 본인 1개) → S7d → S8 (자동매매)". 근거: KIS는 자동매매 전용, 일간 데이터·AI 가상 포트는 KIS 무관, son00326·Kevin KIS 발급 지연은 S8 시점까지 비블로커화. **편집 범위 (4문서 + 1)**: HANDOFF + ProgressDashboard(이 문서) + S8-AutoTrading + ServicePlan-Admin §1A.5 D18 + CLAUDE.md 상단. 코드 변경 0건. 회귀 무관 (docs only). |
| **2026-05-08** | **35차 — D19 박제: JooPick AI 강화 (Tier 0/1/2 + 합의 배지 + Reflection) + 시퀀스 v3.1 + Smoke #3 ⏸ 유예**. 사용자 핵심 목표 = "단/중/장 각 10개씩 30종목이 진짜로 admin 화면에 들어오는지 검증". 외부 레퍼런스 [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) Analyst Team + Reflection 패턴 차용 + JooPick 박제(Core 11 + Sector 14×10) 보존. (a) Tier 0 인디케이터 자동 스크리닝 (AI 키 불필요, pykrx·KRX·DART, 단/중/장 50씩 = 150 후보) · (b) Tier 1 Core 11 페르소나 평가 (AI 키 필요, 시간대별 가중치) · (c) Tier 2 Sector Board 30종목만 활성화 (비용 통제) · (d) 합의 배지 4종 (🟢/🔵/🟣/⚪) + AI 코멘트 1~2줄 · (e) Reflection 자가학습 · (f) AI 키 미발급 fallback = Tier 0 단독으로 진짜 코스피·코스닥 30종목 가동 · (g) Smoke #3 (Binance) ⏸ S8까지 유예. **편집 범위 (8문서)**: ServicePlan-Admin §1A.5 D19 + Status v1.5 + §3.1 R3.1-6 + §2 카드 컬럼 + §8 Revision v1.5 / Service/Report/ReportFramework.md §8 Step 0 + Step 4 후속 + §10 v2.2 / Build/Slices/S7-RealData.md T7e.8 + T7a.7~10 + 게이트 체크리스트 강화 / Build/Slices/DQ7-Credentials.md status + Smoke #3 ⏸ + 변경 이력 32·33·35차 / Build/ProgressDashboard.md(이 문서) v3.1 + DQ-7 잔여 정정 + BL-KRIT-9 / Process/HANDOFF.md §1·§2·§4·§7 / CLAUDE.md 상단 D19 라인 + 시퀀스 v3.1. 코드 변경 0건. 회귀 무관 (docs only). |
| **2026-05-08** | **36차 — 자율 트랙 §A 진입: T7e.1 마이그 0010 검증 + T7e.2 shortlist Supabase 전환 ✅**. 35차 D19 박제 직후 진입. (a) **T7e.1**: `mcp__supabase__list_migrations`로 0010 `alert_event_rls_hardening` 적용 확인 (version 20260505134639). E6 alert_event + AlertType CHECK 12종 + 4 RPC. **BL-KRIT-7 ✅ 해소**. 0011 자리는 S8 (BL-KRIT-8) 예약 유지. (b) **T7e.2**: `src/lib/data/admin-shortlist.ts` 신규 (transformer + delta + month/tickerMeta 옵션 + Supabase error throw) + 5 page-level importer (admin·settings·portfolio + portfolio actions sync helpers를 ShortListItem[] param 받게 리팩터). `/report/[ticker]`는 mock pair 유지(T7e.3 boundary). reportLinksEnabled prop 경계 + `/portfolio` 빈 placeholder + Accept/Reject T7e.3·4 전까지 disabled + createdAt 기반 generated_at(synthetic 폐기). Vitest 8 신규. **검증**: build 25 routes · lint 0 · test:ci **314 pass / 39 files** (이전 306/38 +8/+1). 코드 변경 8 파일 + 신규 2 파일 + 사용자 boundary 보강(reportLinksEnabled prop을 ShortlistRow/DeltaBanner/BucketSection로 확산). **편집 문서 5개**: 이 문서 + S7-RealData.md(T7e.1·2 [x] + 의사결정 5건 + 변경 이력) + HANDOFF.md(§1·§2·§4·§7) + CodebaseStatus.md(36차 entry) + CLAUDE.md(소폭). 의사결정 5건: (1) shortlist만 real, reports/committee는 T7e.3까지 mock pair 유지(boundary). (2) Supabase error throw, action에서 try/catch. (3) 게이트 generated_at = 실 createdAt. (4) Tier 0 인프라 = B-1 로컬 Python idempotent 스크립트. (5) name/sector 갭은 T7e.8 prep 단계 결정 (3옵션). |
| **2026-05-08** | **39차 — T7e.5 regen_counter Supabase 전환 ✅ + race-safe CAS + 신규 마이그 0건**. (a) `src/lib/data/admin-regen-counters.ts` 신규 — `transformRegenCounterRow` + `computeNextMonthResetAt` 순수 helper + `getRegenCounter` SELECT + `incrementManualRegenCount` 4단계 CAS (idempotent INSERT 23505 무시 → SELECT → cap_exhausted 즉시 종료 → `UPDATE WHERE manual_count = current_value` 비교-스왑, RETURNING이 비면 conflict throw). race 보호는 마이그 0005의 UNIQUE(ticker,month) + CHECK(manual_count ≤ 2) + Postgres 행 잠금 위에서 충분 → **0011 슬롯은 BL-KRIT-8(S8 자동매매 E13~E17) 보존**. (b) `regenerate/page.tsx` `findRegenCounter(MOCK_ADMIN_REGEN_COUNTERS, ...)` → `await getRegenCounter(...)`. (c) `regenerate/actions.ts` `MOCK_ADMIN_REGEN_COUNTERS` import + `real_persistence_not_configured` 분기 제거 + 신규 에러 코드 3종(`regen_counter_lookup_failed`/`regen_counter_write_failed`/`regen_counter_write_conflict`) 매핑. (d) `regenerate-panel.tsx` `formatErrorMessage()` 헬퍼로 8개 에러 코드 한국어 운영자 메시지 일원화. (e) `mock-admin-regen-counters.ts` 삭제(고아). (f) Vitest 17 신규/보강 (admin-regen-counters 13 + regenerate actions 8→12 +4). **검증**: build 25 routes · lint 0 · test:ci **362 pass / 46 files** (이전 345/45 +17/+1) · tsc --noEmit 0. **MOCK_ADMIN_COST_LOG 잔존 의도적** — 월 40만원 hardcap의 cost_log 실 INSERT/SELECT는 S7a/T7a 범위. 다음 1순위 = T7e.6 (access-logs/performance/decision-tree) 또는 T7e.8 (B-1 Python). |
| **2026-05-08** | **38차 — T7e.4 approvals/snapshots Supabase 전환 ✅ + `/admin/portfolio` fail-closed boundary 해제**. (a) `src/lib/data/admin-approvals.ts` 신규 — PortfolioApproval transformer + `getApprovalsByMonth`/`getApprovalById` + `createPortfolioApproval` + dispute/resolve RPC wrapper. (b) `src/lib/data/admin-snapshots.ts` 신규 — PortfolioSnapshot transformer + `insertPortfolioSnapshots` bulk INSERT. (c) `/admin/portfolio/page.tsx`: `MOCK_ADMIN_APPROVALS` → Supabase SELECT, `actionsEnabled={false}` 제거. (d) `/admin/portfolio/actions.ts`: Reject/dispute/resolve 실 I/O. Accept는 fake entryPrice 저장 금지로 실 가격 소스가 없으면 `entry_price_unavailable`을 반환하고 E4 INSERT 전 중단. `portfolio_snapshot` INSERT wrapper는 준비됨. E4 UNIQUE 23505는 accept 경로에서만 `already_finalized`. (e) DB 제약/UX 반영 — Reject 2회 UX 응답은 2 유지, DB `reanalysis_count`는 CHECK(≤1)로 clamp, 3회 Reject는 차단. 신규 에러 코드 3종은 한국어 배너로 표시. **검증**: build 25 routes · lint 0 · test:ci **345 pass / 45 files** (이전 333/42 +12/+3) · tsc --noEmit 0. |
| **2026-05-12** | **45차 — T7e.8 follow-up production 적용 완료 + D20 Section 8 위원 전원 표 박제 + HANDOFF 재구성 (S7a 1순위 / T7e.7 후속)**. (a) T7e.8 production: Supabase 0013/0014(DART corp/cache) 적용 + `dart_corp_codes` seed (2,766 rows) + full dry-run preview 후 사용자 승인으로 `short_list_30` 2026-05-01 30 rows UPSERT. dry-run preview↔DB top 3 ticker/composite 일치, exit 0, client refresh 7회 정상, RemoteProtocolError 0건. label 분포 = short 모멘텀 10 / mid 실적 모멘텀 8 + 모멘텀 2 / long 퀄리티 10. DART 실 standalone/quality 기반으로 Signal 4·5 평탄화 해소. (b) **D20 박제 (사용자 요구 직접 반영)**: Section 8에 4종 정적 표 박제 — ① Sector 14명 전원 표 ② **Core 11 전원 표(신규)** ③ 쟁점별 인용 3~5건 ④ 최종 합의 패널(Co-Chair 만장일치 여부 포함). Reference: `Document/Outputs/Report-Alteogen_196170_v3-Readable.md §Section 8 Part A/B/C`. 인터랙티브 페르소나 탐색은 Should S2 유지. 영향 = `ServicePlan-Admin.md §3.7 R3.7-6/7/8` + `§6 D20` + M3 AC/DoD + `ReportFramework.md §8 Step 2 v2.3` + `S7-RealData.md T7a.11(신규)` + S7b 게이트 체크리스트 + 본 변경 이력 + HANDOFF.md §5 SoT 4건 + CLAUDE.md 상단 시퀀스 v3.1. (c) **HANDOFF 재구성**: 다음 1순위 = S7a Anthropic wrapper (T7e.7 RLS QA는 S7a 진행 중 병행 또는 D11 운용 검증 직전 마무리로 후순위화 — 사용자 판단 반영). 진입 트리거 = AI 키 B-6 ⭐최우선. 검증 게이트 회귀 0 (build 25 / lint 0 / test:ci 384 pass / 49 files). Git: `72019fa`·`dd05ca1`·`dd175a6`·`285cb8b` 4건. |
| **2026-05-08** | **40차 — T7e.6 access-logs/performance/decision-tree Supabase 전환 ✅ + 신규 마이그 0건 + 단일 SoT 박제**. (a) `src/lib/data/admin-access-logs.ts` 신규 — `getRecentAdminAccessLogs()` boundary stub `[]` 반환. **BL-20 7일 단일 어드민 자동 바이패스는 실 source 정의 전까지 영구 비활성** (T7e 범위 밖, S7c/D19 이후). (b) `src/lib/data/admin-performance.ts` 신규 — `PortfolioSnapshotDbRow` transformer + `getPerformanceSummary` / `getMonthlyPerformance` / `getBucketPerformance` (`portfolio_snapshot` SELECT + `src/lib/performance/*` 순수 로직 호출) + `getCounterfactual` returns `null` (deferred to D11/S9, AI 비중 시계열 저장 정책 박제 후 산출 가능). (c) `src/lib/data/admin-decision-tree.ts` 신규 — `getDecisionTreeSnapshot` (`portfolio_snapshot` SELECT → `groupByMonth` → `judgeDecisionTree`). (d) `/admin/track-record/page.tsx`·`/admin/decision-tree/page.tsx`·`/admin/portfolio/page.tsx`+`actions.ts` 갱신. counterfactual 카드는 "운용 데이터 누적 후 산출" UI 대기 박스. (e) `mock-admin-{access-logs,performance,decision-tree}.ts` 3 파일 삭제. mock-admin-consistency.test.ts에서 관련 assertion 1개 제거. **단일 SoT 박제**: performance + decision-tree는 `portfolio_snapshot`(0005) 단일 테이블 + `src/lib/performance/{sharpe,mdd,judge,cap-months}` 순수 로직으로 산출. 별도 테이블 신설 0건. **신규 마이그 0건** (0011 슬롯은 BL-KRIT-8 S8 자동매매 보존). Vitest 19 신규/보강 (admin-access-logs 2 + admin-performance 7+8 transformer/aggregation + admin-decision-tree 2). **검증**: build 25 routes · lint 0 · test:ci **381 pass / 49 files** (이전 362/46 +19/+3, consistency 1 제거 반영) · tsc --noEmit 0. 다음 1순위 = T7e.7 (RLS 브라우저 수동 QA, Tier 0 시드 후 권장) 또는 T7e.8 (B-1 Python). |
| **2026-05-08** | **37차 — T7e.3 reports/committee Supabase 전환 ✅ + boundary 2번째 해제**. (a) `src/lib/data/admin-reports.ts` 신규 — Section0~8+Appendix canonical 타입 정의 + transformer + `getReportByTicker`/`reportExistsForMonth` + `deriveBucketNeighbors` 순수 함수. (b) `src/lib/data/admin-committee.ts` 신규 — transformer + `getVotesByReportId` + `aggregateVotes` 이관 (mock-admin-committee.ts에서 분리). (c) `/admin/report/[ticker]/page.tsx` Supabase 전환 — active shortlist month 기준 report 조회, `MOCK_ADMIN_SHORTLIST.find`/`getReportByTicker` mock/`getVotesByReportId` mock/`getBucketNeighbors` mock 모두 폐기. (d) `regenerate/actions.ts`: `MOCK_ADMIN_REPORTS.some` → `reportExistsForMonth` 실 SELECT (try/catch → 신규 에러 코드 `report_lookup_failed`). (e) `reportLinksEnabled={false}` 3곳 제거 (admin home DeltaBanner + admin home BucketSection + portfolio BucketSection) → 카드 클릭 활성(Delta REMOVED는 리포트 대기 유지). portfolio actionsDisabledMessage T7e.4만 남기게 단축. (f) Vitest 19 신규/보강 (admin-reports 10 + admin-committee 6 + regenerate 1 + delta-banner 2). mock-admin-report.ts·mock-admin-committee.ts 보존 (consistency 테스트 유지, 향후 일괄 정리). **검증**: build 25 routes · lint 0 · test:ci **333 pass / 42 files** (이전 314/39 +19/+3) · tsc --noEmit 0. **편집 문서 5개**: 이 문서 + S7-RealData.md(T7e.3 [x] + 의사결정 3건 + 변경 이력) + HANDOFF.md + CodebaseStatus.md(37차 entry) + CLAUDE.md(진행 순서/데이터 계층 현재화). 의사결정 3건: (1) boundary 2번째 해제 — reports/committee 시드 부재 시 `/report`는 `notFound()` 일관 동작. (2) Section 타입 canonical = `admin-reports.ts` (mock는 자체 사본 유지). (3) regenerate 액션은 reports 존재 검사가 핵심이라 T7e.3 자연 포함, 카운터/cost_log는 T7e.5에서 처리. |
