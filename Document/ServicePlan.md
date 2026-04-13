# ServicePlan.md — 주픽 서비스 기획 & 진행 트래커 (Living Doc)

Last updated: 2026-04-12
Status: 초기화 (Phase 0 진입 대기)

> **이 문서의 정체성**
> - `BusinessPlan.md`의 사업 방향을 **실제 웹 서비스로 풀어낸 결정 사항**을 모은다.
> - **기획(Phase.md) + 실행(BuildPhase.md) 두 문서의 모든 Task를 하나의 트래커(§0)로 관리**. 이 문서만 보면 전체 진행 상태를 알 수 있어야 한다.
> - **deepinit 위치, 하네스 구성 대상, 안정성 체크포인트**도 §2에 전부 기록.
> - **세션 종료 시 반드시 갱신**. 변경 이력은 §4 Revision History에 남긴다.

---

## 0. 진행 트래킹 (Unified Work Tracker)

> 상태 기호: `[ ]` 미착수 / `[~]` 진행 중 / `[x]` 완료 / `[!]` 블록 / `[-]` 스킵·보류
> 방법론은 Phase.md / BuildPhase.md에 정의. 이 섹션은 **상태**만 관리.

---

### 🅰 Planning Phase (see Phase.md)

#### Phase 0 — 의도 정렬
- [ ] **0.1** ServicePlan 스코프·독자·깊이·목차·톤 합의 (`superpowers:brainstorming`)
- [ ] **0.2** 합의 결과 기록 (직접 Write)
- [ ] **0.3** 모호성 게이팅 → Phase 1 GO 또는 `deep-interview` 에스컬레이션

#### Phase 1 — 리서치 병렬 (한 메시지 5 에이전트)
- [ ] **1.1** BusinessPlan 갭 분석 (`analyst` 에이전트)
- [ ] **1.2** 경쟁 스캔 (`document-specialist` + `pm-market-research:competitor-analysis`)
- [ ] **1.3** 페르소나 (`pm-market-research:user-personas`)
- [ ] **1.4** 고객 여정 (`pm-market-research:customer-journey-map`)
- [ ] **1.5** Core JTBD (`pm-product-strategy:value-proposition`) — 1.3 이후
- [ ] **1.6** 기능 브레인스톰 (`pm-product-discovery:brainstorm-ideas-existing`)
- [ ] **1.7** 투심위 UX 패턴 리서치 (`document-specialist` 에이전트)
- [ ] **1.8** Quant 시스템 서비스 데이터 플로우 리서치 (`architect` 에이전트)

#### Phase 2 — 전략 골격
- [ ] **2.1** Product Vision (`pm-product-strategy:product-vision`)
- [ ] **2.2** Value Proposition Full (`pm-product-strategy:value-proposition`)
- [ ] **2.3** 9-section Strategy Canvas (`pm-product-strategy:product-strategy`)
- [ ] **2.4** Pricing Rationale (`pm-product-strategy:pricing-strategy`) — 2.3 후
- [ ] **2.5** North Star Metric (`pm-marketing-growth:north-star-metric`)

#### Phase 3 — 구조화
- [ ] **3.1** Must/Should/Nice 분류 (`pm-product-discovery:prioritize-features`)
- [ ] **3.2** 가정 식별 (`pm-product-discovery:identify-assumptions-existing`)
- [ ] **3.3** 가정 우선순위 (`pm-product-discovery:prioritize-assumptions`)
- [ ] **3.4** Opportunity Solution Tree (`pm-product-discovery:opportunity-solution-tree`)
- [ ] **3.5** IA (`information-architect` 에이전트)

#### Phase 4 — ServicePlan v0.9 작성
- [ ] **4.1** PRD 골격 (`pm-execution:create-prd` + `product-manager`)
- [ ] **4.2** User Stories (`pm-execution:user-stories`)
- [ ] **4.3** Metrics Dashboard (`pm-product-discovery:metrics-dashboard` + `product-analyst`)
- [ ] **4.4** Acceptance Scenarios (`pm-execution:test-scenarios`)
- [ ] **4.5** 통합·편집 → v0.9 (직접 Write + `writer`)

#### Phase 5 — 검증 병렬
- [ ] **5.1** 적대적 검토 (`critic` 에이전트)
- [ ] **5.2** UX 검토 (`ux-researcher` 에이전트)
- [ ] **5.3** Pre-mortem (`pm-execution:pre-mortem`)
- [ ] **5.4** 피드백 수렴 → ServicePlan **v1.0**

#### Phase 6 — 후속 사양화 (문서만)
- [ ] **6.1** FRD 초안 (`frd-writer`) — v1.0 이후
- [ ] **6.2** 사용자 시나리오 (`scenario-system`)

> 🏁 **Phase 6 완료 = Planning Phase 종료, BuildPhase 진입 전제**.

---

### 🅱 Build Phase (see BuildPhase.md)

#### Stage B1 — Design Execution
- [ ] **B1.0** 주픽-디자인 하네스 구성 (`oh-my-claudecode:harness`)
- [ ] **B1.1** 디자인 원칙·Voice·Tone (`designer` + `frontend-design:design-consultation`)
- [ ] **B1.2** 디자인 토큰 (`designer`, context7 "tailwindcss v4")
- [ ] **B1.3** shadcn base-nova 오버라이드 계획 (`designer`, context7 "shadcn")
- [ ] **B1.4** 와이어프레임 (`frontend-design:design-shotgun`)
- [ ] **B1.5** 목업 (`frontend-design:frontend-design`)
- [ ] **B1.6** Design Review (`frontend-design:design-review`)
- [ ] **B1.7** 디자인 아카이브 저장 (직접 Write)

#### Stage B2 — Pre-Implementation Setup (B1과 병렬 가능)
- [ ] **B2.1** deepinit 실행 tudal/ (`oh-my-claudecode:deepinit`)
- [ ] **B2.2** Supabase 프로젝트 + `.env.local` (사용자 직접 + context7 "supabase ssr")
- [ ] **B2.3** 한투 OpenAPI 키 (사용자 직접 + `document-specialist`)
- [ ] **B2.4** DART OpenAPI 키 (사용자 직접)
- [ ] **B2.5** pykrx 아키텍처 결정 (`architect` + `document-specialist`)
- [ ] **B2.6** DB 스키마 + 마이그레이션 (`architect` + `critic` 검증)
- [ ] **B2.7** 초대 코드 인증 구조 (`architect` + `security-reviewer`)
- [ ] **B2.8** 주픽-구현 하네스 구성 (`oh-my-claudecode:harness`)
- [ ] **B2.9** 주픽-데이터 하네스 구성 (`oh-my-claudecode:harness`)

#### Stage B3 — Implementation (B1 + B2 완료 후)
- [ ] **B3.0** ScreenSpec.pptx (`screen-spec-writer`) — 원 Phase 6.3에서 이동
- [ ] **B3.1** 코드베이스 간소화 (`oh-my-claudecode:ai-slop-cleaner` + `code-simplifier` via `/ralph`)
- [ ] **B3.2** 실데이터 연결 (`executor` + 주픽-데이터 하네스 via `/ralph`)
- [ ] **B3.3~B3.N** Must 기능 구현 — **TBD**: Phase 3.1 완료 후 1 기능 = 1 Task로 세분화
  - 실행 엔진: `/oh-my-claudecode:ultrawork`(4+) / `superpowers:dispatching-parallel-agents`(2-3) / `/ralph`(1) / `/autopilot`(전체 자동)
  - 매 Task 후: `verifier` + `superpowers:verification-before-completion`
  - 커밋: `commit-commands:commit` (1 Task = 1 commit)
- [ ] **B3.N+1** Integration Smoke (`/gstack:qa`)

#### Stage B4 — QA & Hardening (B3 완료 후, 5축 병렬)
- [ ] **B4.1** QA 루프 (`/oh-my-claudecode:ultraqa`)
- [ ] **B4.2** 보안 리뷰 (`/gstack:security-review` + `security-reviewer`)
- [ ] **B4.3** 성능 감사 (`performance-reviewer`)
- [ ] **B4.4** 접근성 감사 (`ux-researcher` + `/gstack:browse`)
- [ ] **B4.5** 코드 리뷰 (`/gstack:review`, 필요 시 `/oh-my-claudecode:ccg`)
- [ ] **B4.6** 버그 수정 (`debugger` + `/gstack:investigate`)

#### Stage B5 — Ship
- [ ] **B5.1** 릴리스 PR (`/gstack:ship`)
- [ ] **B5.2** 머지·배포 (`/gstack:land-and-deploy`)
- [ ] **B5.3** Canary 모니터링 (`/gstack:canary`)
- [ ] **B5.4** 문서 동기화 (직접 Write + `claude-md-management:revise-claude-md`)

#### Stage B6 — Iteration Loop (선택, 다음 기능 배치)
- [ ] **B6.1** Retro (`/gstack:retro` 또는 `pm-execution:retro`)
- [ ] **B6.2** 다음 배치 우선순위 (`pm-product-discovery:prioritize-features`)
- [ ] **B6.3** B3~B5 반복

> 🏁 **Stage B5 완료 = v1 프로덕션 배포**. B6은 v2 이후 선택적 반복.

---

## 1. 확정 사항 (Service-level Decisions)

> 서비스 기획에서 **확정된** 결정만 기록. 사업 레벨은 BusinessPlan.md.
> 형식: `YYYY-MM-DD · 결정 내용 · 근거 요약`

_(아직 없음 — Phase 0 합의 완료 시 첫 항목 추가 예정)_

### 1.1 독자·깊이·목차·톤 (Phase 0.1 결과 반영 예정)
- **독자**: _TBD_
- **깊이**: _TBD_
- **목차 골격**: _TBD_ — 기본안은 §3 본문 18 섹션
- **톤**: _TBD_

### 1.2 핵심 서비스 결정 요약
- **Vision**: _Phase 2.1 결과_
- **Core JTBD**: _Phase 1.5_
- **Value Proposition**: _Phase 2.2_
- **North Star Metric**: _Phase 2.5_
- **Pricing Model**: 월 19,900원 (BusinessPlan §Q11 승계) — 근거 Phase 2.4
- **Must Features**: _Phase 3.1_
- **IA**: _Phase 3.5_
- **Design System**: _Stage B1_
- **AI 투심위**: 2026-04-12 확정 · 2-Layer (Core Committee 11명 + Sector Board 14개×10명) · 8-Section 보고서 프레임워크 · BusinessPlan §8
- **3축 Quant 시스템**: 2026-04-12 확정 · 단기30%/중기40%/장기30% · Quant Board 10명(70% 컨센서스) · Early Warning + Crisis Layer 2단계 · BusinessPlan §9
- **백테스트 검증**: 2026-04-12 v6.1 FINAL 확정 · Sharpe 0.99 / Calmar 0.78 / Max DD -25.8% · 삼성전자 B&H 위험조정 수익률 beat · BusinessPlan §9.3
- **Manual 투자 트랙**: 2026-04-13 확정 · AI 전종목 스캔 → Short List 30개(단기10/중장기10/장기10) · 업황 사이클 기반 2단계 스크리닝 · 리포트 3-Tier(Short List 풀 리포트 / 스크리닝 상위 풀 리포트 / 전종목 정량 프로필) · 8-Section 분석 · 어드민 전용(권한 부여 가능) · 자동화와 독립 · 월간 리밸런싱+이벤트 수시 갱신 · 긴급 변동 시 이메일/텔레그램 알림 · BusinessPlan §10

---

## 2. Infrastructure & Stability

> deepinit·하네스·안정성 체크포인트·외부 의존성. 각 항목은 BuildPhase Task ID와 연결.

### 2.1 deepinit 대상
| 위치 | 이유 | 수행 Task |
|---|---|---|
| `tudal/` 루트 | 계층적 AGENTS.md 생성, 실 코드 변경 전 현 상태 스냅샷 | **BuildPhase B2.1** |
| `tudal/src/app/` | 라우트 그룹 재편 전 상태 고정 | B2.1 내부에서 자동 커버 |
| `tudal/src/lib/data/` | mock → 실데이터 전환 직전 의존 영향 범위 파악 | B3.2 직전 재실행 검토 |

스킬: **`oh-my-claudecode:deepinit`**

### 2.2 하네스 (harness) 구성 대상
> 하네스 = 전문 에이전트 + 전용 스킬 조합. 구성 스킬은 **`oh-my-claudecode:harness`** 공통.

| 하네스 | 구성 | 목적 | 수행 Task |
|---|---|---|---|
| **주픽-디자인** | `designer` + `frontend-design:*` 묶음 + 브랜드 규칙 | Stage B1 디자인 실행 | **B1.0** |
| **주픽-구현** | `executor`(opus) + `code-reviewer` + `verifier` + tudal 컨벤션 강제 | Stage B3 코드 변경 전반 | **B2.8** |
| **주픽-데이터** | `document-specialist` + `scientist` + 한투/DART/pykrx 컨텍스트 | Stage B3.2 실데이터 연결 | **B2.9** |
| 주픽-기획 (선택) | `analyst` + `critic` + `pm-*` 묶음 | Phase 1~5 자동화 | 현 세션은 미구성, 필요 시 Phase 1 직전 |

### 2.3 안정성 체크포인트 (Safe Progression Protocol)
> 위에서 아래로. 건너뛰면 롤백 비용 증가.

1. **Phase/Stage 게이트 충족** — Phase.md §진입 조건 + BuildPhase.md §진입 조건 모두 만족 후 진입.
2. **Phase 5 검증 없이는 BuildPhase 진입 금지** — ServicePlan v1.0이 critic/ux/pre-mortem 3자 통과 전 코드 변경 X.
3. **Phase 6 완료(FRD + Scenarios)가 BuildPhase B3 전제**. B1/B2는 Phase 6 완료 후 병렬 착수 가능.
4. **B1 + B2 모두 완료되어야 B3 진입**. B3.0 ScreenSpec은 B1 디자인 시안 필수.
5. **코드 변경 커밋**: "1 Task = 1 commit". `commit-commands:commit` 사용.
6. **검증 명령**: `cd tudal && npm run build && npm run lint`. 유일한 게이트.
7. **B4 5축 검증 없이 B5 Ship 금지** — 보안·성능·a11y·리뷰 리포트 4개 + QA pass 필수.
8. **B5 완료 후 문서 동기화(B5.4)**: ServicePlan §4 Revision History, HANDOFF.md, CLAUDE.md(필요 시) 갱신.
9. **세션 종료 프로토콜**:
   - ServicePlan §0 트래커 체크박스 업데이트
   - §4 Revision History에 한 줄 추가
   - HANDOFF.md §"시도/성공/실패/다음" 4블록 갱신
   - 사업 레벨 결정 발생 시 BusinessPlan §"핵심 의사결정 기록" 추가

### 2.4 롤백 포인트
| 체크포인트 | 복귀 위치 |
|---|---|
| ServicePlan v0.9 실패 | Phase 3 재검토 → Phase 4 재진입 |
| Phase 5 검증 실패 | 지적된 Phase 2/3 단계 복귀 |
| FRD 작성 중 스코프 폭발 | Must 기능만 FRD 대상으로 재절단 |
| B1 Design Review fail | B1.4/B1.5 재실행 |
| B2.6 DB 스키마 critic 지적 | architect 재설계 |
| B3.2 실데이터 실패 | mock 롤백 + 주픽-데이터 하네스 재구성 |
| B4 보안·성능 critical | B3 해당 Task로 복귀 |
| B5.3 canary 실패 | `/gstack:land-and-deploy` 롤백 + B4 재수행 |

### 2.5 외부 의존성
- **KRX / 한국투자증권 OpenAPI**: 실데이터 1순위. B2.3 발급.
- **DART OpenAPI**: 공시 백업. B2.4 발급.
- **pykrx**: Python 의존 — Python 사이드카 or Supabase Edge Function. B2.5 결정.
- **Supabase**: B2.2 프로젝트 생성 + `.env.local`.
- **Vercel**: B5.2 배포 대상.
- **법무 자문**: Phase 6 완료 직후 스팟 50만원.

### 2.6 백테스트 코드 위치 및 역할
- **경로**: `backtest/` (프로젝트 루트)
- **최종 버전**: `backtest/full_system_backtest_v6.py` (v6.1 FINAL)
- **역할**: 3축 Quant 시스템 검증용 Python 코드. 서비스 런타임과는 별개 — 전략 로직 레퍼런스로 참조.
- **B2.5 연결**: pykrx 아키텍처 결정 시, 이 코드의 팩터 계산·리밸런싱·EW/Crisis 로직을 서비스 런타임으로 이식하는 방법을 함께 결정.
- **B2.9 연결**: 주픽-데이터 하네스 구성 시 `backtest/` 코드를 참조 컨텍스트에 포함 — v6.1 시스템 구성(EW+Crisis+3축) 이해용.

---

## 3. ServicePlan 본문 (v0.x → v1.0)

> Phase 4에서 작성 시작, Phase 5에서 v1.0 확정. 각 Task 결과는 아래 해당 섹션으로 라우팅.

### 3.1 Vision
_Phase 2.1 결과_

### 3.2 Problem Statement
_Phase 4.1_

### 3.3 Target Users & Personas
_Phase 1.3_

### 3.4 Competitive Landscape
_Phase 1.2 요약. 상세는 `.omc/research/competitors.md`_

### 3.5 Core JTBD & Value Proposition
_Phase 1.5 Core + 2.2 Full_

### 3.6 Strategy Canvas Summary
_Phase 2.3 9-section_

### 3.7 Solution Overview
_Phase 4.1_

### 3.8 Feature Priority Matrix
_Phase 3.1 결과 + Appendix_
- **Appendix A — Feature Pool 원본**: Phase 1.6 브레인스톰
- **Appendix B — Opportunity Tree**: Phase 3.4

### 3.9 User Journey
_Phase 1.4_

### 3.10 Information Architecture
_Phase 3.5 (사이트맵 + 내비게이션 + Auth Flow 서브섹션 B2.7에서 편입)_

### 3.11 User Stories
_Phase 4.2_

### 3.12 Metrics & North Star
_Phase 2.5 NSM + 4.3 대시보드_

### 3.13 Pricing & Monetization
_Phase 2.4 근거 문서화_

### 3.14 Risks & Assumptions
_Phase 3.2 + 3.3_

### 3.15 Acceptance Scenarios
_Phase 4.4_

### 3.16 Non-Goals
_Phase 4.1_

### 3.17 Dependencies & Timeline
_Phase 4.1 + B2.6 DB 스키마 ERD 요약_

### 3.18 Design System
_Stage B1 결과 편입_
- **Voice & Tone** (B1.1)
- **디자인 토큰** — 컬러/타이포/스페이싱/쉐도우/라운드 (B1.2)
- **shadcn base-nova Component Overrides** (B1.3)
- **Design Source** — Figma 링크 또는 `.omc/design/` 경로 (B1.7)

### 3.19 AI 투심위 시스템
> Phase 1.7 리서치 + Phase 4.1 PRD에서 채움. BusinessPlan §8 구조를 서비스 UX로 풀어낸 설계.

- **2-Layer Architecture**: Core Committee (11명: 국내5+해외5+위원장) + Sector Board (14개 섹터 × 10명)
- **8-Section 보고서 뷰어**: Earnings / Valuation / Industry / Macro / Scenario / Catalyst / Risk / Votes
- **핵심 UX 컴포넌트** _(Phase 1.7 리서치 후 확정)_:
  - 보고서 Summary 1페이지 + In-depth 섹션별 상세
  - Bull/Base/Bear 시나리오 비교 차트
  - 위원회 투표 결과 시각화 (찬/반/보류 + 컨센서스율)
  - 촉매 이벤트 캘린더 타임라인
- **법적 제약**: AI 출력은 데이터·분석만. "사세요/파세요" 표현 금지 (BusinessPlan §7.2). Committee Votes 최종 의견도 "분석 의견"으로만 프레이밍.

### 3.20 자동화 Quant 시스템
> Phase 1.8 리서치 + Phase 4.1 PRD에서 채움. BusinessPlan §9 구조를 서비스 대시보드로 풀어낸 설계.

- **3축 포트폴리오 구조**: 단기 30%(21일/모멘텀+수급/KOSDAQ) + 중기 40%(42일/균형멀티팩터/KOSPI) + 장기 30%(63일/밸류+퀄리티/대형가치주)
- **Quant Board (10명)**: Simons/Harding/Brown/Thorp/문병로/Asness/Taleb/Dalio/Lo/Griffin — 70% 컨센서스 투표
- **Early Warning System**: MA구조 + 모멘텀다이버전스 + 변동성 + 거래량 + RSI 급락 → 크래시 7~15일 전 선행 감지 → 점진적 디리스킹
- **Crisis Management Layer**: Layer 1(선행/점진적 축소) + Layer 2(반응/즉시 10~25% 축소) + 복합 레짐 감지(Bull/Sideways/Bear)
- **핵심 UX 컴포넌트** _(Phase 1.8 리서치 후 확정)_:
  - 3축 배분 현황판 (축별 종목·비중·수익률)
  - Quant Board 투표 뷰 (멤버별 가중치·투표 결과)
  - Early Warning 알림 (선행지표 복합 점수)
  - 레짐 인디케이터 (현재 Bull/Sideways/Bear)
  - 리밸런싱 이력 타임라인
- **데이터 플로우** _(Phase 1.8에서 상세화)_: `backtest/` Python 로직 → 서비스 런타임(B2.5 결정) → 프론트엔드 대시보드

### 3.22 Manual 투자 트랙
> BusinessPlan §10 구조를 서비스 UX로 풀어낸 설계. 2026-04-13 확정.

- **핵심 컨셉**: AI가 전종목 스캔 → upside 높은 종목을 Short List로 추천 → 유저가 납득 후 매수 연결
- **Short List 구조**: 단기 10 + 중장기 10 + 장기 10 = 30개, BUY 의견만, 예상 수익률 기반 우선순위
- **접근 권한**: 어드민 전용 (본인+공동창업자), 권한 부여 가능
- **핵심 UX 컴포넌트** _(Phase 리서치 후 확정)_:
  - Short List 목록 화면: 종목명 + 현재가 + TP + Upside% + 투심위 의견 + 핵심 촉매
  - 클릭 → 풀 8-Section 리포트 연결
  - 리밸런싱 변동 뷰: 신규 편입 / 유지 / 제외 + 변동 사유
  - 검색: Tier 1/2 = 풀 리포트, Tier 3 = 정량 프로필 카드 (기존 tudal 4탭 수준 이상)
  - 긴급 변동 알림 (이메일/텔레그램)
- **리포트 3-Tier**:
  - Tier 1 (Short List 30개): 풀 8-Section + 투심위 — 사전 생성
  - Tier 2 (스크리닝 상위 50~100개): 풀 8-Section + 투심위 — 사전 생성
  - Tier 3 (나머지 전종목): 정량 프로필 카드 — 데이터 자동 산출 (AI 불필요)
- **업황 판단**: AI 자동, 전문가 수준 매크로→섹터 연결 분석 (시스템 핵심 경쟁력)
- **리밸런싱**: 월간 기본 + 실적/이벤트 시 수시 갱신 + 긴급 시 즉시 제외/교체
- **법적 프레이밍**: 어드민 전용이므로 "사세요/파세요" 제약 해당 없음
- **자동화 트랙 관계**: 현재 완전 독립, 추후 모델 검증 후 연동 판단
- **월간 비용**: ~49만원 (업황 분석 + 스크리닝 + Tier 1/2 리포트 + 수시 갱신)

---

### 3.21 백테스트 검증 결과
> BusinessPlan §9.3 결과 요약. 서비스 내 "성과 검증" 페이지 또는 투명성 공개용.

- **v6.1 FINAL 핵심 지표** (2019.01~2026.04, 삼성전자 벤치마크):
  - Sharpe 0.99 (B&H 0.81) · Calmar 0.78 (B&H 0.59) · Max DD -25.8% (B&H -45.2%)
  - CAGR 20.3% (B&H 26.6%) — 절대수익은 B&H 우위, 위험조정 수익률은 모델 우위
  - COVID DD 방어: -19.2% (B&H -31.2%, 12.0%p 방어)
- **20% 보수적 할인 적용 시**: 실효 CAGR ~16.2%, Sharpe ~0.79
- **구조적 한계**: 삼성전자 반도체 슈퍼사이클(2025 +124.5%) = 분산 포트폴리오로 절대수익 beat 불가 / pykrx 외국인순매수·PBR API empty → 거래량 proxy 사용
- **서비스 노출 여부** _(Phase 3.1에서 Must/Should 판정)_: 백테스트 결과 대시보드, 전략별 성과 비교 차트

---

## 4. Revision History

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-04-12 | ServicePlan.md 초기 스캐폴드 | 4-문서 구조 전환 |
| 2026-04-12 | 범위 재조정: Phase 6.4 + Phase 7 트래커 제거, §3 본문 14→17 섹션 확장, Task 2.3 → product-strategy | 사용자 Q3/Q4/Q5 승인 |
| 2026-04-12 | **BuildPhase.md 도입**: §0 트래커가 Planning + Build 통합. §3.18 Design System 신규. Phase 6.3 ScreenSpec → BuildPhase B3.0 이동. 하네스 4개 정의 (디자인/구현/데이터/기획-선택). Infrastructure §2를 BuildPhase Task ID로 링크 | 사용자 전면 승인 — "누락 없이 추적 가능하게" |
| 2026-04-12 | **BusinessPlan §8~§9 동기화**: §1.2에 투심위·Quant·백테스트 확정 기록. §3.19 AI 투심위 시스템 / §3.20 자동화 Quant 시스템 / §3.21 백테스트 검증 결과 3개 섹션 신설 (18→21 섹션). §2.6 백테스트 코드 위치 추가. §0 트래커에 Task 1.7/1.8 추가. Phase.md Task 1.7/1.8 신규 + 기존 Task 스코프 확장 연동 | BusinessPlan §8 투심위 + §9 Quant 확정에 따른 하위 문서 동기화 |
| 2026-04-13 | **Manual 투자 트랙 확정**: §1.2에 Manual 트랙 확정 기록. §3.22 Manual 투자 트랙 신설 (21→22 섹션). BusinessPlan §10 신설 (§10~§13 → §11~§14 재번호) | 사용자 인터뷰 6단계 → Manual 트랙 설계 확정 |

---

## 5. 다음 한 줄

**다음 에이전트가 즉시 해야 할 것**: Phase 0 Task 0.1 — `superpowers:brainstorming` 스킬을 기동해 사용자와 §1.1 네 항목(독자/깊이/목차/톤) 합의 → §1.1 채움 → §0 트래커 [0.1]을 `[x]`로 → §4 Revision History 한 줄 추가 → HANDOFF.md 갱신.
