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

---

## 4. Revision History

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-04-12 | ServicePlan.md 초기 스캐폴드 | 4-문서 구조 전환 |
| 2026-04-12 | 범위 재조정: Phase 6.4 + Phase 7 트래커 제거, §3 본문 14→17 섹션 확장, Task 2.3 → product-strategy | 사용자 Q3/Q4/Q5 승인 |
| 2026-04-12 | **BuildPhase.md 도입**: §0 트래커가 Planning + Build 통합. §3.18 Design System 신규. Phase 6.3 ScreenSpec → BuildPhase B3.0 이동. 하네스 4개 정의 (디자인/구현/데이터/기획-선택). Infrastructure §2를 BuildPhase Task ID로 링크 | 사용자 전면 승인 — "누락 없이 추적 가능하게" |

---

## 5. 다음 한 줄

**다음 에이전트가 즉시 해야 할 것**: Phase 0 Task 0.1 — `superpowers:brainstorming` 스킬을 기동해 사용자와 §1.1 네 항목(독자/깊이/목차/톤) 합의 → §1.1 채움 → §0 트래커 [0.1]을 `[x]`로 → §4 Revision History 한 줄 추가 → HANDOFF.md 갱신.
