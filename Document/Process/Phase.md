# Phase.md — 주픽 서비스 기획 단계별 실행 플랜

Last updated: 2026-04-15
Purpose: BusinessPlan.md의 사업 방향을 **서비스 기획(Admin/Member sub-doc)**으로 풀어내기 위한 Phase/Task 분해표.
Scope: **서비스 기획 + UX/UI Design 확정까지** (Phase 0~8). 실제 코드 구현·배포는 **BuildPhase.md**가 담당. P7(UX)·P8(UI)에서 디자인 **제작** 완료 → BuildPhase B1은 디자인→코드 전환만.
각 Task마다 "무엇을 산출하는가 + 어느 에이전트·스킬을 쓰는가 + 왜 그게 최적인가 + 불확실성"을 명시한다.

> **⚠️ Output 라우팅 변경 (2026-04-15)**
> 이 문서의 Task Output에 적힌 `ServicePlan §X.X` 참조는 **리셋 이전 구조의 섹션 번호**이다.
> 현재 ServicePlan.md는 인덱스로 전환되었고, 서비스 기획은 **Admin/Member 2개 sub-doc**으로 분리됨.
>
> **라우팅 규칙**:
> - `ServicePlan §3.X` (서비스 기획 관련) → **`ServicePlan-Admin.md`** 또는 **`ServicePlan-Member.md`** 해당 섹션
> - `.omc/research/*` (리서치 원자료) → 변경 없음
> - 디자인 시스템 관련 → **`ServicePlan.md §3`** 공통 원칙
> - 각 Phase는 **어드민 먼저 1회 → 멤버 1회** 순서로 실행. 공통 리서치(경쟁 분석 등)는 1회만.
> - 진행 상태는 각 sub-doc의 **진행 트래커** 섹션에서 관리.

> 이 문서를 보는 법
> - **Primary**: 기본 실행 경로. 특별한 이유가 없으면 이걸 씀.
> - **Alternatives**: 검토했으나 이유로 기각한 후보. 상황이 바뀌면 승격 가능.
> - **Rationale**: 왜 그 선택인가. 재검토할 때 근거로 씀.
> - **Uncertainty**: 낮음(1:1 매칭) / 중간(judgment call) / 높음(런타임 결정). "중간" 이상은 실행 직전 사용자 재확인 권장.
> - **Output**: 이 Task가 남기는 산출 파일/섹션. **결과 내용은 여기 저장하지 않는다** — ServicePlan.md 또는 `.omc/research/`로 라우팅.
> - **Execution Notes** *(선택)*: 해당 Task를 실제로 실행한 뒤 **방법론 개선** 이 필요하면 1~2줄 추가. 산출물 자체는 기록하지 않는다.

---

## 🗺 Phase 맵 (한눈에)

```
[P0] 의도 정렬              → Admin 스코프·JTBD 합의
[P1] 리서치 병렬            → 갭·경쟁·페르소나·여정·JTBD·기능·투심위UX·Quant
[P2] 전략 골격              → 비전·VP·9-section 전략·가격·북극성 지표
[P3] 구조화                 → 우선순위·가정·OST·IA
[P4] 기획서 작성 ─┐
                  ├─ 병렬   → PRD·스토리·메트릭 ∥ 유저플로우·와이어프레임·IA검증
[P7] UX Design ──┘
[P5] 검증 병렬              → 적대적·UX·pre-mortem (P4+P7 둘 다 검증)
[P6] 후속 사양화            → FRD-Admin·Scenarios-Admin
[P8] UI Design              → 디자인 원칙·토큰·목업·리뷰
```

> **범위 바깥**: 프론트엔드 UI 실물화, 코드 변경, 배포, 디자인 시안 제작, ScreenSpec.pptx(디자인 선행 필요) → **BuildPhase.md**로 이동.
> 특히 ScreenSpec은 원래 Phase 6.3이었으나 디자인 시안이 선행되어야 하므로 **BuildPhase Task B3.0**에서 처리.

각 Phase는 선행-후행 관계가 있지만, **Phase 내부 Task는 가능하면 병렬 디스패치**.

---

## Phase 0 — 의도 정렬

목표: ServicePlan.md가 누구를 위해, 얼마나 깊게, 무엇을 담을지 합의.

### Task 0.1 — ServicePlan.md 스코프·독자·깊이 합의
- **Primary**: `superpowers:brainstorming`
- **Rationale**: superpowers 공식 규정 "You MUST use this before any creative work" 의무 진입점.
- **Alternatives**:
  - `oh-my-claudecode:deep-interview` — autopilot 직전용. 과함.
  - `oh-my-claudecode:omc-plan` — Phase 2 레벨 전략 인터뷰에 더 적합.
- **Uncertainty**: 낮음.
- **Output**: ServicePlan.md §1.1 (독자/깊이/목차/톤) 및 진행 트래커 [0.1] 체크.

### Task 0.2 — 동기화
- **Primary**: 직접 Write
- **Uncertainty**: 해당 없음.
- **Output**: Phase.md, HANDOFF.md, ServicePlan.md §1.1 동기 업데이트.

### Task 0.3 — 모호성 잔여 확인 & 게이팅
- **Primary**: (분기) 잔여 모호성 있음 → `oh-my-claudecode:deep-interview`, 없음 → Phase 1 진입
- **Uncertainty**: 해당 없음.
- **Output**: GO/HOLD 판단 → HANDOFF.md §"다음 단계".

---

## Phase 1 — 리서치 (병렬 디스패치)

목표: ServicePlan.md 작성에 필요한 외부/내부 사실 전량 확보. **한 메시지 7 에이전트 병렬 호출**.

### Task 1.1 — BusinessPlan 기획 갭 분석
- **Primary**: `analyst` 에이전트 (opus, read-only)
- **Rationale**: 공식 역할 "Pre-planning consultant for requirements analysis".
- **Alternatives**: `product-manager`(Phase 4 주 작성자), `critic`(Phase 5).
- **Uncertainty**: 낮음.
- **Output**: `.omc/research/gap-analysis.md`
- **스코프 노트 (2026-04-12)**: BusinessPlan §8 투심위 2-Layer 구조 + §9 3축 Quant 시스템이 서비스 feature로 전환될 때의 갭 포함. 특히 투심위 8-Section 보고서의 데이터 소스 매핑, Quant Board 투표 결과의 UX 표현 방식에 대한 갭 식별 필요.

### Task 1.2 — 경쟁 서비스 스캔
- **Primary**: `oh-my-claudecode:external-context` 스킬 + `pm-market-research:competitor-analysis` 스킬
- **Rationale**: 조사 대상 8개(≥4)이므로 `external-context`("parallel document-specialist agents")로 병렬 웹 리서치. `competitor-analysis`는 구조화 프레임 제공.
- **Alternatives**: `document-specialist` 단독(대상 4개 미만일 때), `researcher`(설명 거의 동일).
- **Uncertainty**: 낮음 (승격 완료).
- **대상 경쟁군**: 증권플러스, 인텔리퀀트, 웰로우드, 키움영웅문, 알파스퀘어, Koyfin, Simply Wall St, 삼성증권 리서치
- **Output**: `.omc/research/competitors.md` → ServicePlan §3.4로 요약 편입

### Task 1.3 — 페르소나 정의
- **Primary**: `pm-market-research:user-personas` 스킬
- **Alternatives**: `pm-market-research:research-users`(통합, 병렬 장점 상실), `ux-researcher`(Phase 5 담당).
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.3

### Task 1.4 — 고객 여정 맵
- **Primary**: `pm-market-research:customer-journey-map` 스킬
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.9

### Task 1.5 — Core JTBD 정의
- **Primary**: `pm-product-strategy:value-proposition` 스킬
- **Rationale**: 6-part JTBD. 1.5는 Core Job 단일 문장 목적.
- **Alternatives**: `pm-execution:job-stories`(Phase 4 기능 단위).
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.5 (Core 부분)

### Task 1.6 — 기능 후보 브레인스톰 (14+α)
- **Primary**: `pm-product-discovery:brainstorm-ideas-existing` 스킬
- **Rationale**: tudal/ mock MVP 프레임워크가 이미 존재 = existing.
- **Alternatives**: `brainstorm-ideas-new`("실 유저 0명 = new"로 해석 가능).
- **Uncertainty**: **중간** — existing vs new 해석 여지.
- **Output**: ServicePlan §3.8 Appendix A (기능 풀 원본)
- **스코프 노트 (2026-04-12)**: BusinessPlan §8~§9 기반 feature 후보를 입력으로 포함 — 투심위(A1~A7: 8-Section 보고서 뷰어, 토론 시뮬레이션, 섹터 보드 라우팅, 시나리오 비교, 캘린더, 리스크 대시보드, 투표 Summary), Quant(B1~B6: 3축 현황판, 투표 뷰, EW 알림, Crisis 상태, 리밸런싱 이력, 백테스트 뷰어), 매크로(C1~C2), 인증(D1~D4), 운용(E1~E3), 과금(F1). 최대 23개 feature 풀.

### Task 1.7 — 투심위 UX 패턴 리서치
- **Primary**: `document-specialist` 에이전트
- **Rationale**: "External Documentation & Reference Specialist". 증권사 리서치 리포트 뷰어(삼성증권·미래에셋), 컨센서스 시각화(FnGuide·증권플러스), 전문가 패널 UI 패턴(Simply Wall St Snowflake, Koyfin) 조사에 최적.
- **Alternatives**:
  - `oh-my-claudecode:external-context` 스킬 — "parallel document-specialist agents". 여러 경쟁사를 병렬 조사 시 상위 래퍼. 조사 대상이 4개 이상이면 승격 고려.
  - `researcher` 에이전트 — document-specialist와 설명 거의 동일. 중복.
  - `ux-researcher` 에이전트 — Phase 5 검증 담당. 리서치 단계에서는 스코프 불일치.
- **Uncertainty**: **중간** — 한국 금융 UX 레퍼런스 가용성에 따라 웹 리서치 범위 조정 필요.
- **Output**: `.omc/research/committee-ux-patterns.md` → Phase 4에서 ServicePlan §3.19로 편입

### Task 1.8 — Quant 시스템 서비스 데이터 플로우 리서치
- **Primary**: `architect` 에이전트 (opus)
- **Rationale**: "Strategic Architecture & Debugging Advisor". `backtest/` Python 코드의 3축 구조·팩터 계산·리밸런싱 주기·EW/Crisis 로직을 웹 대시보드로 표현하기 위한 데이터 계층 파악. (B2.5 pykrx 인프라 결정과는 별개 — 여기는 "무슨 데이터가 필요한가", B2.5는 "어떻게 전달할 것인가")
- **보조**: `scientist` 에이전트 — `backtest/full_system_backtest_v6.py` 코드 해석 시 데이터 분석 관점 보충.
- **Alternatives**:
  - `analyst` 에이전트 — 요구사항 관점은 맞으나 기술 아키텍처 깊이 부족. Task 1.1에서 이미 사용.
  - `crypto-backtest-expert` 스킬 — 백테스트 설계/실행 전문이나 crypto 도메인 한정. 주식 도메인 부적합.
  - `oh-my-claudecode:sciomc` 스킬 — 병렬 scientist 오케스트레이션. 단일 코드베이스 분석에는 과함.
- **Uncertainty**: **중간** — Python ↔ Next.js 데이터 브릿지 아키텍처가 B2.5와 상호 의존. 서비스 설계 관점(1.8)은 인프라 관점(B2.5)과 별개이나, 결과가 상호 참조됨.
- **Output**: `.omc/research/quant-data-architecture.md` → Phase 4에서 ServicePlan §3.20으로 편입

---

## Phase 2 — 전략 골격

### Task 2.1 — Product Vision
- **Primary**: `pm-product-strategy:product-vision`
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.1

### Task 2.2 — Value Proposition Full (6-part)
- **Primary**: `pm-product-strategy:value-proposition`
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.5 (Full)

### Task 2.3 — 9-Section Product Strategy Canvas
- **Primary**: `pm-product-strategy:product-strategy` (9-section)
- **Rationale**: 주픽 비즈니스 모델 차원은 BusinessPlan + Task 2.4에서 이미 확정. Startup Canvas(18블록)는 절반 중복.
- **Alternatives 기각**: `startup-canvas`, `lean-canvas`, `business-model`.
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.6
- **스코프 노트 (2026-04-12)**: 투심위 2-Layer(Core 11 + Sector 14×10) + 3축 Quant(EW+Crisis+리밸런싱)를 핵심 차별점으로 Canvas에 반영. 경쟁사 대비 "AI 전문가 패널 시뮬레이션 + 위험조정 자동 포트폴리오"가 주픽의 고유 포지셔닝.

### Task 2.4 — 가격 전략 근거 문서화
- **Primary**: `pm-product-strategy:pricing-strategy`
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.13

### Task 2.5 — 북극성 지표
- **Primary**: `pm-marketing-growth:north-star-metric`
- **후보 NSM**: "주간 의사결정 로그 수 × 6개월 검증률", "주간 활성 분석 세션 수(4탭 열람)"
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.12

---

## Phase 3 — 구조화

### Task 3.1 — 기능 Must/Should/Nice 분류 (Q14 해소)
- **Primary**: `pm-product-discovery:prioritize-features`
- **Alternatives**: `pm-execution:prioritization-frameworks`(레퍼런스).
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.8 (본문)
- **스코프 노트 (2026-04-12)**: 분류 대상에 투심위(A1~A7), Quant(B1~B6), 매크로(C1~C2), 인증(D1~D4), 운용(E1~E3), 과금(F1) 총 23개 feature 후보 포함. Stage별 로드맵(BusinessPlan §5)과 교차 검증 — Stage 1(M0-3) Must는 창업자 2인 사용 기준, Stage 2(M3-6) Must는 지인 배포 기준.

### Task 3.2 — 리스크 가정 식별
- **Primary**: `pm-product-discovery:identify-assumptions-existing`
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.14

### Task 3.3 — 가정 우선순위
- **Primary**: `pm-product-discovery:prioritize-assumptions`
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.14 (동일 섹션)

### Task 3.4 — Opportunity Solution Tree
- **Primary**: `pm-product-discovery:opportunity-solution-tree`
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.8 Appendix B

### Task 3.5 — Information Architecture
- **Primary**: `information-architect` 에이전트
- **Alternatives**: `designer`(범위 밖), `architect`(범위 밖).
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.10

---

## Phase 4 — ServicePlan.md 작성

### Task 4.1 — PRD 골격
- **Primary**: `pm-execution:create-prd` + `product-manager` 에이전트
- **Alternatives**: `pm-execution:write-prd`(설명 거의 동일), `writer`(PM 관점 부족).
- **Uncertainty**: **중간** — create-prd vs write-prd.
- **Output**: ServicePlan §3.2 / §3.7 / §3.16 / §3.17

### Task 4.2 — User Stories
- **Primary**: `pm-execution:user-stories` (3C + INVEST)
- **Alternatives**: `job-stories`(JTBD 중복), `wwas`(기술 중심 대안).
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.11

### Task 4.3 — Metrics Dashboard
- **Primary**: `pm-product-discovery:metrics-dashboard`
- **보조**: `product-analyst` 에이전트
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.12 (대시보드 파트)

### Task 4.4 — Acceptance Scenarios
- **Primary**: `pm-execution:test-scenarios`
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.15

### Task 4.5 — 통합·편집 → v0.9
- **Primary**: 직접 Write + `writer` 에이전트 보조
- **Uncertainty**: 해당 없음.
- **Output**: ServicePlan.md v0.9 초안

---

## Phase 5 — 검증 (병렬)

### Task 5.1 — 적대적 검토
- **Primary**: `critic` 에이전트 (opus)
- **Uncertainty**: 낮음.
- **Output**: `.omc/research/servicesplan-critique.md`

### Task 5.2 — UX 관점 검토
- **Primary**: `ux-researcher` 에이전트
- **Uncertainty**: 낮음.
- **Output**: `.omc/research/servicesplan-ux-audit.md`

### Task 5.3 — Pre-mortem
- **Primary**: `pm-execution:pre-mortem`
- **Uncertainty**: 낮음.
- **Output**: `.omc/research/premortem.md`

### Task 5.4 — 최종 수렴 → v1.0
- **Primary**: 직접 편집
- **Uncertainty**: 해당 없음.
- **Output**: ServicePlan.md v1.0

---

## Phase 6 — 후속 사양화 (문서 산출만)

목표: ServicePlan.md v1.0 기반으로 **FRD + Scenarios** 문서 작성. ScreenSpec은 BuildPhase B3.0(디자인 선행 필요)으로 이동.

### Task 6.1 — FRD
- **Primary**: `frd-writer` 스킬
- **Alternatives**: `frd-system`(인증·권한 깊이 필요 시 승격).
- **Uncertainty**: **중간** — frd-writer vs frd-system. 초대 코드 플로우 복잡도에 따라 결정.
- **Chaining**: `frd-writer` 출력 → BuildPhase B3.0 `screen-spec-writer` 입력
- **Output**: `FRD.md`

### Task 6.2 — 사용자 시나리오
- **Primary**: `scenario-system` 스킬
- **Rationale**: "인증·인가, 권한관리, 프로세스" 중심. 주픽 초대 코드 플로우에 직결.
- **Uncertainty**: 낮음.
- **Output**: `Scenarios.md`

> **Phase 6 완료 후 P7·P8(UX/UI Design)을 거쳐 BuildPhase.md로 진입.**

---

## Phase 7 — UX Design

목표: P3에서 확정된 IA·기능 우선순위를 **유저 플로우 다이어그램 + 와이어프레임**으로 시각화하고 IA를 검증. **P4(기획서 작성)와 병렬 가능.**

> **스코프**: 유저 플로우·와이어프레임·IA 검증까지. 시각 디자인(토큰·컬러·목업)은 P8.
> **산출물 저장**: `.omc/design/flows/`, `.omc/design/wireframes/`, ServicePlan-Admin.md §2 보강.

### Task 7.1 — 핵심 유저 플로우 다이어그램
- **Primary**: `designer` 에이전트
- **Rationale**: Admin 핵심 4플로우(Top30 대시보드 → 리포트 열람 → 포트폴리오 추천 → 악재 알림·재조정)를 mermaid 또는 다이어그램으로 시각화.
- **Alternatives**:
  - `playground:playground` — 인터랙티브 HTML 탐색기. 플로우 다이어그램과 목적 불일치로 기각.
  - `information-architect` — P3.5에서 이미 IA 작성. 검증은 7.3에서 별도.
- **Uncertainty**: 낮음.
- **Output**: `.omc/design/flows/admin-flows.md` + ServicePlan-Admin.md §2 "화면 플로우 다이어그램" 갱신

### Task 7.2 — 핵심 화면 와이어프레임
- **Primary**: `frontend-design:design-shotgun` 스킬
- **Rationale**: "generate multiple AI design variants, open a comparison board" — 다변형 생성 + 비교 보드. 초기 와이어프레임 이터레이션에 최적.
- **Alternatives**:
  - `designer` 에이전트 단독 — 단일안 수동. 비교 어려움.
  - `frontend-design:frontend-design` — 프로덕션급 목업. P8.4 단계에 더 적합.
- **Uncertainty**: **중간** — design-shotgun이 한국어 금융 UI에 적합한지 실행 직전 확인 필요. 품질 미달 시 `designer` 단독으로 전환.
- **Output**: `.omc/design/wireframes/` (대시보드·리포트·포트폴리오·알림 4종)

### Task 7.3 — IA 검증 + 네비게이션 패턴
- **Primary**: `ux-researcher` 에이전트
- **Rationale**: "Usability research, heuristic audits, and user evidence synthesis". P3.5 `information-architect`가 만든 IA를 **다른 에이전트**가 검증하는 분리 원칙.
- **Alternatives**:
  - `information-architect` — 자기 산출물 자기 검증은 분리 위반.
- **Uncertainty**: 낮음.
- **Output**: ServicePlan-Admin.md §2 보강 (검증 결과 반영)

---

## Phase 8 — UI Design

목표: P7 와이어프레임 + P6 FRD 기반으로 **디자인 원칙·토큰·고품질 목업·리뷰**까지 완성. BuildPhase B1 진입 직전 단계.

> **스코프**: 시각 디자인 전체 — Voice/Tone, 토큰, 컴포넌트 계획, 목업, 리뷰.
> **산출물 저장**: ServicePlan.md §3(공통 디자인 시스템), `.omc/design/mockups/`, `.omc/design/review-report.md`.
> **BuildPhase B1과의 관계**: P8에서 디자인 **제작** 완료 → B1은 디자인→**코드 전환** + 리뷰만 담당.

### Task 8.0 — 주픽-디자인 하네스 구성
- **Primary**: `oh-my-claudecode:harness` 스킬
- **Rationale**: "전문 에이전트 + 전용 스킬 조합을 반복 자동화용으로 구성". P8 전체에서 재사용.
- **구성**: `designer` 에이전트 + `frontend-design:design-consultation/design-shotgun/frontend-design/design-review/visual-verdict/plan-design-review` 스킬 묶음 + 주픽 브랜드 규칙(빨간 상승 캔들 + 노란 스파클 + Korean-first UI + 면책 문구)
- **Uncertainty**: 낮음.
- **Output**: `.omc/harnesses/joopick-design.yaml`

### Task 8.1 — 디자인 원칙·Voice·Tone 정립
- **Primary**: `designer` 에이전트 + `frontend-design:design-consultation` 스킬
- **Rationale**: "understands your product, researches the landscape, proposes a comprehensive design direction". 프로덕트 이해·방향 제안 통합.
- **Alternatives**:
  - `designer` 단독 — 경쟁 리서치는 P1.2에서 완료. 경량 경로 가능.
- **Uncertainty**: 낮음.
- **Output**: ServicePlan.md §3 "Voice & Tone"

### Task 8.2 — 디자인 시스템 토큰 결정
- **Primary**: `designer` 에이전트
- **Rationale**: 컬러/타이포/스페이싱/쉐도우/라운드 토큰 정의. shadcn base-nova 위에 주픽 브랜드 적용.
- **Docs**: context7 MCP "tailwindcss v4" 스킴 — CSS 변수 기반 최신 토큰 패턴
- **Uncertainty**: 낮음.
- **Output**: `tudal/src/app/globals.css` 토큰 정의 + ServicePlan.md §3 기록

### Task 8.3 — shadcn base-nova 컴포넌트 오버라이드 계획
- **Primary**: `designer` 에이전트
- **Rationale**: `components.json` `style="base-nova"` 베이스에 Button/Card/Dialog/Tabs/Input 등의 브랜드 적용 오버라이드 포인트 식별.
- **Docs**: context7 MCP "shadcn" 스킴으로 최신 커스터마이징 패턴
- **Uncertainty**: 낮음.
- **Output**: ServicePlan.md §3 "Component Overrides 리스트"

### Task 8.4 — 고품질 목업 생성
- **Primary**: `frontend-design:frontend-design` 스킬
- **Rationale**: "Create distinctive, production-grade frontend interfaces with high design quality". P7.2 와이어프레임 + P8.1~8.3 디자인 시스템 적용본.
- **Alternatives**:
  - `frontend-design:design-html` — 최종 HTML/CSS 코드 출력. 구현(B1)에 더 가까움. 목업 단계에서는 과함.
- **Uncertainty**: 낮음.
- **Output**: `.omc/design/mockups/` (대시보드·리포트·포트폴리오·알림 4종)

### Task 8.5 — Design Review
- **Primary**: `frontend-design:design-review` 스킬 + `frontend-design:visual-verdict` 스킬
- **Rationale**: design-review = "Designer's eye QA: finds visual inconsistency, spacing issues, hierarchy problems". visual-verdict = 구조화 verdict (목업 ↔ 와이어프레임 비교).
- **Alternatives**:
  - `frontend-design:plan-design-review` — 플랜 레벨 인터랙티브 검토. 시각 QA보다 상위.
- **Uncertainty**: 낮음.
- **Output**: `.omc/design/review-report.md`

### Task 8.6 — 디자인 아카이브 저장
- **Primary**: 직접 Write (Figma 링크·파일 경로 기록)
- **Uncertainty**: 해당 없음.
- **Output**: ServicePlan.md §3 "Design Source" 항목

> **Phase 8 완료 = Phase.md 전체 종료 → BuildPhase.md B1(디자인→코드 전환) 진입.**

---

## 📌 소스별 사용 스킬 요약

| 소스 | 사용 Task |
|---|---|
| **OMC 에이전트** | 1.1(analyst), 1.8(architect+scientist), 3.5(information-architect), 4.1(product-manager), 4.3(product-analyst), 4.5(writer), 5.1(critic), 5.2+7.3(ux-researcher), 7.1+8.1~8.4(designer) |
| **OMC 스킬** | 1.2+1.7(`external-context`), 8.0(`harness`) |
| **superpowers** | 0.1(brainstorming), 0.3(deep-interview 조건부) |
| **PM** | 1.3~1.6, 2.1~2.5, 3.1~3.4, 4.1~4.4, 5.3 — 주력 번들 |
| **Korean Planning** | 6.1(frd-writer), 6.2(scenario-system) |
| **frontend-design** | 7.2(design-shotgun), 8.1(design-consultation), 8.4(frontend-design), 8.5(design-review+visual-verdict) |
| **commit-commands** | 범위 밖 → BuildPhase.md |
| **gstack** | 범위 밖 → BuildPhase.md |
| **GSD/crypto/claude-md-management/skill-creator/playground** | 사용 안 함 |

---

## 🚦 진입 조건 (Phase Gates)

| Phase | 진입 전제 | 종료 기준 |
|---|---|---|
| P0 | BusinessPlan.md, ServicePlan.md 존재 | ServicePlan-Admin §1 초안 채움 |
| P1 | P0 합의 완료 | `.omc/research/*` 7개 리서치 + Admin §1 페르소나·JTBD |
| P2 | P1 전체 완료 | Vision + VP + 9-section Canvas + Pricing + NSM |
| P3 | P2 + 1.6 기능 풀 | Must/Should/Nice + OST + IA |
| P4 | P3 완료 | ServicePlan-Admin v0.9 |
| P7 | P3 완료 (P4와 병렬) | 유저 플로우 + 와이어프레임 4종 + IA 검증 |
| P5 | P4 + P7 완료 | critic/ux/pre-mortem 3 리포트 → v1.0 |
| P6 | ServicePlan-Admin v1.0 | FRD-Admin.md + Scenarios-Admin.md |
| P8 | P6 + P7 완료 | 디자인 토큰 + 목업 4종 + Design Review 통과 |

**Phase 8 완료 = Phase.md 전체 종료 → BuildPhase.md B1(디자인→코드 전환) 진입**.

---

## 🔁 병렬 디스패치 원칙

- **Phase 1**: 1.1 + 1.2 + 1.3 + 1.4 + 1.6 + 1.7 + 1.8 (7개 병렬)
- **Phase 2**: 2.1 + 2.2 + 2.3 + 2.5 (4개 병렬, 2.4는 2.3 후)
- **Phase 3**: 3.2 + 3.4 + 3.5 (3개 병렬, 3.1/3.3는 3.2 후)
- **Phase 4 ∥ Phase 7**: P3 완료 후 P4(기획서)와 P7(UX) 병렬 착수
- **Phase 5**: 5.1 + 5.2 + 5.3 (3개 병렬, P4+P7 둘 다 완료 후)
- **Phase 8**: 8.1 + 8.2 + 8.3 (3개 병렬, 8.4는 8.1~8.3 후, 8.5는 8.4 후)

순차 의존 체인:
- 1.3 → 1.5 → 2.2
- 2.5 → 3.4
- 3.1 → 4.2
- P3 → P4 ∥ P7 → P5
- P6 + P7 → P8
- 6.1 → BuildPhase B3.0
- P8 → BuildPhase B1

---

## 📍 현재 위치

- **완료**: Phase 구조 확정 (P0~P8 + 에이전트/스킬 매핑)
- **다음**: Phase 0 Task 0.1 — `superpowers:brainstorming` (다음 세션)
- **블록**: 없음
- **트래킹 SoT**: `ServicePlan-Admin.md` §진행 트래커

> **P8 완료 후 → BuildPhase.md 진입**
> - B1(디자인→코드 전환): P8 목업·토큰을 코드 컴포넌트로 구현. B1.0~B1.6은 P7·P8로 이동 완료.
> - B2(인프라): deepinit(B2.1) + env(B2.2~B2.4) + pykrx 런타임(B2.5) + DB(B2.6) + 인증(B2.7) + 구현 하네스(B2.8) + 데이터 하네스(B2.9). B1과 병렬 가능.
> - B3~B5: 구현 → QA → 배포. 상세는 `BuildPhase.md` 참조.
