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
> **(2026-04-15 8차 세션에서 본문 Output도 신 경로로 치환 완료)**

> 이 문서를 보는 법
> - **Primary**: 기본 실행 경로. 특별한 이유가 없으면 이걸 씀.
> - **Alternatives**: 검토했으나 이유로 기각한 후보. 상황이 바뀌면 승격 가능.
> - **Rationale**: 왜 그 선택인가. 재검토할 때 근거로 씀.
> - **Uncertainty**: 낮음(1:1 매칭) / 중간(judgment call) / 높음(런타임 결정). "중간" 이상은 실행 직전 사용자 재확인 권장.
> - **Output**: 이 Task가 남기는 산출 파일/섹션. **결과 내용은 여기 저장하지 않는다** — ServicePlan-Admin.md / ServicePlan-Member.md / `.omc/research/`로 라우팅.
> - **Execution Notes** *(선택)*: 해당 Task를 실제로 실행한 뒤 **방법론 개선** 이 필요하면 1~2줄 추가. 산출물 자체는 기록하지 않는다.

---

## 🗺 Phase 맵 (한눈에)

```
[P0] 의도 정렬              → Admin 스코프·JTBD 합의
[P1] 리서치 병렬            → 갭·경쟁·페르소나·여정·JTBD·기능·투심위UX·Quant
[P2] 전략 골격              → 비전·VP·9-section 전략·가격·북극성 지표
[P3] 구조화                 → 우선순위·가정·OST·IA
[P4] 기획서 작성 ─┐
                  ├─ 병렬   → PRD·스토리·AC/DoD ∥ 유저플로우·와이어프레임·IA검증
[P7] UX Design ──┘
[P5] 검증 병렬              → 적대적·UX·pre-mortem (P4+P7 둘 다 검증)
[P6] ~~후속 사양화~~ **폐지(2026-04-15 13차)** — ServicePlan-Admin §3 Must 16(R+US+AC+DoD)과 §1.3 J1~J4 + `.omc/design/flows·wireframes`가 FRD·Scenarios 본질을 이미 포함. 별도 문서는 중복. 필요 시 BuildPhase B3.0 ScreenSpec에서 통합.
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
- **Output**: `ServicePlan-Admin.md §1.1` (독자/깊이/목차/톤) 및 진행 트래커 [0.1] 체크.

### Task 0.2 — 동기화
- **Primary**: 직접 Write
- **Uncertainty**: 해당 없음.
- **Output**: Phase.md, HANDOFF.md, `ServicePlan-Admin.md §1.1` 동기 업데이트.

### Task 0.3 — 모호성 잔여 확인 & 게이팅
- **Primary**: (분기) 잔여 모호성 있음 → `oh-my-claudecode:deep-interview`, 없음 → Phase 1 진입
- **Uncertainty**: 해당 없음.
- **Output**: GO/HOLD 판단 → HANDOFF.md §"다음 단계".

---

## Phase 1 — 리서치 (병렬 디스패치)

목표: ServicePlan-Admin.md 작성에 필요한 외부/내부 사실 전량 확보. **한 메시지 7 에이전트 병렬 호출**.

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
- **Output**: `.omc/research/competitors.md`

### Task 1.3 — 페르소나 정의
- **Primary**: `pm-market-research:user-personas` 스킬
- **Alternatives**: `pm-market-research:research-users`(통합, 병렬 장점 상실), `ux-researcher`(Phase 5 담당).
- **Uncertainty**: 낮음.
- **Output**: `.omc/research/personas.md`

### Task 1.4 — 고객 여정 맵
- **Primary**: `pm-market-research:customer-journey-map` 스킬
- **Uncertainty**: 낮음.
- **Output**: `.omc/research/customer-journey.md`

### Task 1.5 — Core JTBD 정의
- **Primary**: `pm-product-strategy:value-proposition` 스킬
- **Rationale**: 6-part JTBD. 1.5는 Core Job 단일 문장 목적.
- **Alternatives**: `pm-execution:job-stories`(Phase 4 기능 단위).
- **Uncertainty**: 낮음.
- **Output**: `ServicePlan-Admin.md §1.2` (Core JTBD 부분)

### Task 1.6 — 기능 후보 브레인스톰 (14+α)
- **Primary**: `pm-product-discovery:brainstorm-ideas-existing` 스킬
- **Rationale**: tudal/ mock MVP 프레임워크가 이미 존재 = existing.
- **Alternatives**: `brainstorm-ideas-new`("실 유저 0명 = new"로 해석 가능).
- **Uncertainty**: **중간** — existing vs new 해석 여지.
- **Output**: `.omc/research/feature-candidates.md`
- **스코프 노트 (2026-04-12)**: BusinessPlan §8~§9 기반 feature 후보를 입력으로 포함 — 투심위(A1~A7: 8-Section 보고서 뷰어, 토론 시뮬레이션, 섹터 보드 라우팅, 시나리오 비교, 캘린더, 리스크 대시보드, 투표 Summary), Quant(B1~B6: 3축 현황판, 투표 뷰, EW 알림, Crisis 상태, 리밸런싱 이력, 백테스트 뷰어), 매크로(C1~C2), 인증(D1~D4), 운용(E1~E3), 과금(F1). 최대 23개 feature 풀.
- **실행 결과 (2026-04-15, P1.6 완료)**: 기존 23개 + 신규 G~J 시리즈 26개 = **총 49개 기능 후보 확보**. Task 3.1은 이 49개 전수를 대상으로 함.

### Task 1.7 — 투심위 UX 패턴 리서치
- **Primary**: `document-specialist` 에이전트
- **Rationale**: "External Documentation & Reference Specialist". 증권사 리서치 리포트 뷰어(삼성증권·미래에셋), 컨센서스 시각화(FnGuide·증권플러스), 전문가 패널 UI 패턴(Simply Wall St Snowflake, Koyfin) 조사에 최적.
- **Alternatives**:
  - `oh-my-claudecode:external-context` 스킬 — "parallel document-specialist agents". 여러 경쟁사를 병렬 조사 시 상위 래퍼. 조사 대상이 4개 이상이면 승격 고려.
  - `researcher` 에이전트 — document-specialist와 설명 거의 동일. 중복.
  - `ux-researcher` 에이전트 — Phase 5 검증 담당. 리서치 단계에서는 스코프 불일치.
- **Uncertainty**: **중간** — 한국 금융 UX 레퍼런스 가용성에 따라 웹 리서치 범위 조정 필요.
- **Output**: `.omc/research/committee-ux-patterns.md`

### Task 1.8 — Quant 시스템 서비스 데이터 플로우 리서치
- **Primary**: `architect` 에이전트 (opus)
- **Rationale**: "Strategic Architecture & Debugging Advisor". `backtest/` Python 코드의 3축 구조·팩터 계산·리밸런싱 주기·EW/Crisis 로직을 웹 대시보드로 표현하기 위한 데이터 계층 파악. (B2.5 pykrx 인프라 결정과는 별개 — 여기는 "무슨 데이터가 필요한가", B2.5는 "어떻게 전달할 것인가")
- **보조**: `scientist` 에이전트 — `backtest/full_system_backtest_v6.py` 코드 해석 시 데이터 분석 관점 보충.
- **Alternatives**:
  - `analyst` 에이전트 — 요구사항 관점은 맞으나 기술 아키텍처 깊이 부족. Task 1.1에서 이미 사용.
  - `crypto-backtest-expert` 스킬 — 백테스트 설계/실행 전문이나 crypto 도메인 한정. 주식 도메인 부적합.
  - `oh-my-claudecode:sciomc` 스킬 — 병렬 scientist 오케스트레이션. 단일 코드베이스 분석에는 과함.
- **Uncertainty**: **중간** — Python ↔ Next.js 데이터 브릿지 아키텍처가 B2.5와 상호 의존. 서비스 설계 관점(1.8)은 인프라 관점(B2.5)과 별개이나, 결과가 상호 참조됨.
- **Output**: `.omc/research/quant-data-architecture.md`

---

## Phase 2 — 전략 골격

### Task 2.1 — Product Vision
- **Primary**: `pm-product-strategy:product-vision`
- **Uncertainty**: 낮음.
- **Output**: `ServicePlan-Admin.md §1A.1`

### Task 2.2 — Value Proposition Full (6-part)
- **Primary**: `pm-product-strategy:value-proposition`
- **Uncertainty**: 낮음.
- **Output**: `ServicePlan-Admin.md §1.2` (Full VP)

### Task 2.3 — 9-Section Product Strategy Canvas
- **Primary**: `pm-product-strategy:product-strategy` (9-section)
- **Rationale**: 주픽 비즈니스 모델 차원은 BusinessPlan + Task 2.4에서 이미 확정. Startup Canvas(18블록)는 절반 중복.
- **Alternatives 기각**: `startup-canvas`, `lean-canvas`, `business-model`.
- **Uncertainty**: 낮음.
- **Output**: `ServicePlan-Admin.md §1A.2`
- **스코프 노트 (2026-04-12)**: 투심위 2-Layer(Core 11 + Sector 14×10) + 3축 Quant(EW+Crisis+리밸런싱)를 핵심 차별점으로 Canvas에 반영. 경쟁사 대비 "AI 전문가 패널 시뮬레이션 + 위험조정 자동 포트폴리오"가 주픽의 고유 포지셔닝.

### Task 2.4 — 가격 전략 근거 문서화
- **Primary**: `pm-product-strategy:pricing-strategy`
- **Uncertainty**: 낮음.
- **Output**: `ServicePlan-Admin.md §1.4` (가격 파트)

### Task 2.5 — 북극성 지표
- **Primary**: `pm-marketing-growth:north-star-metric`
- **후보 NSM**: "주간 의사결정 로그 수 × 6개월 검증률", "주간 활성 분석 세션 수(4탭 열람)"
- **Uncertainty**: 낮음.
- **Output**: `ServicePlan-Admin.md §1A.3`

---

## Phase 3 — 구조화

> **P3.0 Pre-P3 필수 단계 — 사용자 Q&A 세션** ✅ 완료 (2026-04-15, 10차)
> P3 착수 전 사용자와 직접 해소 완료. 어드민 2~3명 자금·의사결정 프로젝트 특성상 DVF 매트릭스·이해관계자 커뮤니케이션용 중간 산출물 불필요로 판정하여 직접 합의 채택.
>
> **해소 결과 (D1~D9 + 보류 1건)** — SoT: `ServicePlan-Admin.md §1A.5` 해소된 결정 표.
> 1. 원 §1A.5 미해결 7건 → D1(Reject 처리)·D2(미승인 D+5)·D3(체결 가정)·D4(현금 비중)·D5(분석엔진 MVP 표시)·D6(Short List 30 **Must 고정** vs 백테 6)·D7(상시 모니터링 MVP)·D8(재생성 cap)·D9(`/admin/decision-tree` 별도 화면)로 해소. Q12는 "어드민 3명 가정"으로 확정(서비스 설계 비영향).
> 2. gap-analysis Critical 5건 중 G06·G09·G10·G16 해소 (D5·D1·D2·D9로 대응). G30 스케줄러 인프라는 Build B2로 이관.
>
> **출력 완료**: §1A.5 "해소된 결정" 표 박제, 본문 §1.1·§1.3·§1.4·§1.7·§2·§3 동기화, BusinessPlan §12 기록.
>
> **병렬 실행 지도**: `3.1` ∥ `3.2(IA)`. 3.2 IA는 3.1 Must 분류 결과 참조 권장(선택적 3.1 후 착수).

### Task 3.1 — 기능 Must/Should/Nice 분류 (통합·확정)
- **Primary**: `pm-product-discovery:prioritize-features`
- **Alternatives**: `pm-execution:prioritization-frameworks`(레퍼런스).
- **Uncertainty**: 낮음.
- **Output**: `ServicePlan-Admin.md §3 기능 스펙` (현재 스켈레톤)
- **스코프 노트 (2026-04-15)**: `.omc/research/feature-candidates.md` 총 **49개** (기존 23개 A~F 시리즈 + 신규 26개 G~J 시리즈) 통합 매트릭스 재분류 + §1A.3 NSM/IM 지표와 Must 기능 매핑. **"첫 분류"가 아니라 "통합·확정"** — P1.6에서 잠정 Must 15개 신호 이미 식별됨. Stage별 로드맵(BusinessPlan §5)과 교차 검증 — Stage 1(M0-3) Must는 창업자 2인 사용 기준, Stage 2(M3-6) Must는 지인 배포 기준. **전제**: P3.0 Q&A에서 D7(상시 모니터링 MVP 포함)·D8(재생성 cap 자동1·수동2) 해소 완료. §3 기능 스펙 §3.6 미분류 항목도 통합 대상. **고정 입력 (분류 대상 아님)**: D6 Short List 30 (단10·중10·장10) 홈 표시는 Must 고정 — Should/Nice 강등 금지.

### Task 3.2 — Information Architecture (구 3.4)
- **Primary**: `information-architect` 에이전트
- **Alternatives**: `designer`(범위 밖), `architect`(범위 밖).
- **Uncertainty**: 낮음.
- **Output**: `ServicePlan-Admin.md §2 화면 IA·라우트 본문화` (현재 스켈레톤 교체)
- **스코프 노트 (2026-04-15)**: (a) `/admin/*` 전체 라우트 맵, (b) 3 모드(§1.4 모닝/상시/월간) 전환 메커니즘, (c) Short List 30 단기/중기/장기 탭 또는 섹션 구조, (d) 풀 리포트(Section 0~8) 내부 네비게이션.

---

## Phase 4 — ServicePlan-Admin.md 작성

### Task 4.1 — PRD 골격
- **Primary**: `pm-execution:create-prd` + `product-manager` 에이전트
- **Rationale**: PRD "전체"가 아니라 **Requirements + Feature Spec 섹션**만 신규 작성. Vision(§1A.1)·VP(§1.2+P1.5)·Personas(§1.3+personas.md)·Success Metrics(§1A.3+§1.7)·Non-Goals(§1.6)·Constraints(§5)는 포인터로 대체.
- **Alternatives**: `pm-execution:write-prd`(설명 거의 동일), `writer`(PM 관점 부족).
- **Uncertainty**: **중간** — create-prd vs write-prd 스킬 중 선택. 실행 직전 판단.
- **Output**: `ServicePlan-Admin.md §3 기능 스펙 + §4 데이터 모델 본문화`

### Task 4.2 — User Stories
- **Primary**: `pm-execution:user-stories` (3C + INVEST)
- **Rationale**: JTBD(§1.2)/Sub-Jobs(§1.3)/customer-journey 재구조 금지. **Must 기능 ~15개에 1~2줄 Acceptance Criteria**만 부착. 기존 JTBD/Journey는 상위 참조로 링크.
- **Alternatives**: `job-stories`(JTBD 중복), `wwas`(기술 중심 대안).
- **Uncertainty**: 낮음.
- **Output**: `ServicePlan-Admin.md §3 각 기능 블록 내 AC`

### Task 4.3 — Acceptance Criteria / DoD (구 4.4)
- **Primary**: `pm-execution:test-scenarios`
- **Rationale**: 주픽은 테스트 프레임워크 없음(CLAUDE.md 명시: "검증 게이트 = npm run build + npm run lint"). Gherkin/BDD 금지. **"Definition of Done" 체크리스트 형식**으로 각 Must 기능에 3~5개 DoD만.
- **Uncertainty**: 낮음.
- **Output**: `ServicePlan-Admin.md §3 각 기능 블록 내 DoD`

### Task 4.4 — 통합·편집 → v0.9 (구 4.5)
- **Primary**: 직접 Write + `writer` 에이전트 보조
- **Uncertainty**: 해당 없음.
- **Output**: `ServicePlan-Admin.md v0.9`

---

## Phase 5 — 검증 (병렬)

### Task 5.1 — 적대적 검토
- **Primary**: `critic` 에이전트 (opus)
- **Uncertainty**: 낮음.
- **Output**: `.omc/research/serviceplan-admin-critique.md`

### Task 5.2 — UX 관점 검토
- **Primary**: `ux-researcher` 에이전트
- **Uncertainty**: 낮음.
- **Output**: `.omc/research/serviceplan-admin-ux-audit.md`

### Task 5.3 — Pre-mortem (축소)
- **Primary**: `pm-execution:pre-mortem`
- **Rationale**: 자유 브레인스토밍 금지. **§1A.4 Anti-Metrics 4개(API 비용 40만원+, 오버라이드 50%+, Exit 시그널 미수신, 리포트 생성 실패)를 각각 6개월 타임라인에 배치한 실패 스토리 3~4 시나리오**로 한정.
- **Uncertainty**: 낮음.
- **Output**: `.omc/research/premortem.md`

### Task 5.4 — 최종 수렴 → v1.0
- **Primary**: 직접 편집
- **Uncertainty**: 해당 없음.
- **Output**: `ServicePlan-Admin.md v1.0`

---

## Phase 6 — ~~후속 사양화 (문서 산출만)~~ **폐지 (2026-04-15 13차)**

> **폐지 근거**: `ServicePlan-Admin.md v1.0`이 FRD·Scenarios의 본질(요구사항·AC·DoD·여정)을 이미 본문화했다.
> - **FRD 대체**: §3 Must 16 R번호 + User Story + AC + DoD 17블록 (`ServicePlan-Admin.md §3`)
> - **Scenarios 대체**: §1.3 J1~J4 Sub-Jobs + `.omc/design/flows/admin-flows.md` mermaid 5개 + `.omc/design/wireframes/admin-wireframes.md`
> - **ScreenSpec**: BuildPhase B3.0에서 UI 디자인 시안 + 위 SoT를 통합해 1회 생성.
> - **결과**: 별도 `FRD-Admin.md`·`Scenarios-Admin.md` 산출물 생산하지 않음. 어드민 3명 + 본인 개발 주도 프로젝트 맥락에서 중복 문서 생산 불필요.
>
> **실행 흐름**: P5 → **P7 + P8(UX/UI Design, P6 스킵)** → BuildPhase.
>
> **재활성 조건**: 팀 확장·외부 아웃소싱·규제 심사 대응 등 별도 포맷 산출물이 요구될 경우에만 P6 재활성. 그 전까지 본 Phase는 실행 않음.

---

## Phase 7 — UX Design

목표: P3에서 확정된 IA·기능 우선순위를 **유저 플로우 다이어그램 + 와이어프레임**으로 시각화하고 IA를 검증. **P4(기획서 작성)와 병렬 가능.**

> **스코프**: 유저 플로우·와이어프레임·IA 검증까지. 시각 디자인(토큰·컬러·목업)은 P8.
> **산출물 저장**: `.omc/design/flows/`, `.omc/design/wireframes/`, `ServicePlan-Admin.md §2` 보강.

### Task 7.1 — 핵심 유저 플로우 다이어그램
- **Primary**: `designer` 에이전트
- **Rationale**: customer-journey.md 4여정을 **mermaid/다이어그램으로 변환만** + 3 모드 state diagram 1개. 새 여정 탐색 금지.
- **Alternatives**:
  - `playground:playground` — 인터랙티브 HTML 탐색기. 플로우 다이어그램과 목적 불일치로 기각.
  - `information-architect` — P3.4에서 이미 IA 작성. 검증은 7.3에서 별도.
- **Uncertainty**: 낮음.
- **Output**: `.omc/design/flows/admin-flows.md` + `ServicePlan-Admin.md §2` "화면 플로우 다이어그램" 갱신

### Task 7.2 — 핵심 화면 와이어프레임
- **Primary**: `frontend-design:design-shotgun` 스킬
- **Rationale**: "generate multiple AI design variants, open a comparison board" — 다변형 생성 + 비교 보드. 초기 와이어프레임 이터레이션에 최적.
- **Alternatives**:
  - `designer` 에이전트 단독 — 단일안 수동. 비교 어려움.
  - `frontend-design:frontend-design` — 프로덕션급 목업. P8.3 단계에 더 적합.
- **Uncertainty**: **중간** — design-shotgun이 한국어 금융 UI에 적합한지 실행 직전 확인 필요. 품질 미달 시 `designer` 단독으로 전환.
- **Output**: `.omc/design/wireframes/` (대시보드·리포트·포트폴리오·알림 4종)

### Task 7.3 — IA 검증 + 네비게이션 패턴
- **Primary**: `ux-researcher` 에이전트
- **Rationale**: "Usability research, heuristic audits, and user evidence synthesis". P3.4 `information-architect`가 만든 IA를 **다른 에이전트**가 검증하는 분리 원칙. 입력에 `committee-ux-patterns.md` Korean UX Notes 포함.
- **Alternatives**:
  - `information-architect` — 자기 산출물 자기 검증은 분리 위반.
- **Uncertainty**: 낮음.
- **Output**: `ServicePlan-Admin.md §2` 보강 (검증 결과 반영)

---

## Phase 8 — UI Design

목표: P7 와이어프레임 + ServicePlan-Admin v1.0(§3 Must 16 + §4 데이터 모델) 기반으로 **디자인 원칙·토큰·고품질 목업·리뷰**까지 완성. BuildPhase B1 진입 직전 단계. (P6 폐지 2026-04-15.)

> **스코프**: 시각 디자인 전체 — Voice/Tone, 토큰, 컴포넌트 계획, 목업, 리뷰.
> **산출물 저장**: `ServicePlan.md §3`(공통 디자인 시스템), `.omc/design/mockups/`, `.omc/design/review-report.md`.
> **BuildPhase B1과의 관계**: P8에서 디자인 **제작** 완료 → B1은 디자인→**코드 전환** + 리뷰만 담당.

### Task 8.0 — 주픽-디자인 하네스 구성
- **Primary**: `oh-my-claudecode:harness` 스킬
- **Rationale**: "전문 에이전트 + 전용 스킬 조합을 반복 자동화용으로 구성". P8 전체에서 재사용.
- **구성**: `designer` 에이전트 + `frontend-design:design-consultation/design-shotgun/frontend-design/design-review/visual-verdict/plan-design-review` 스킬 묶음 + 주픽 브랜드 규칙(빨간 상승 캔들 + 노란 스파클 + Korean-first UI + 면책 문구)
- **Uncertainty**: 낮음.
- **Output**: `.omc/harnesses/joopick-design.yaml`

### Task 8.1 — 디자인 원칙·Voice·Tone 정립
- **Primary**: `designer` 에이전트 + `frontend-design:design-consultation` 스킬
- **Rationale**: "처음부터 Voice 정의" 금지. **§1A.1 3대 약속 + BusinessPlan 면책/비추천 규약 + committee-ux-patterns Korean UX 컨벤션을 디자인 Voice 명제로 재형식화** + 금지 표현(hype·이모지 과다·빨간색 하락) 리스트 5~7개로 한정.
- **Alternatives**:
  - `designer` 단독 — 경쟁 리서치는 P1.2에서 완료. 경량 경로 가능.
- **Uncertainty**: 낮음.
- **Output**: `ServicePlan.md §3 "Voice & Tone"` (공통 원칙)

### Task 8.2 — 디자인 시스템 토큰 결정
- **Primary**: `designer` 에이전트
- **Rationale**: 컬러/타이포/스페이싱/쉐도우/라운드 토큰 정의. shadcn base-nova 위에 주픽 브랜드 적용.
- **Docs**: context7 MCP "tailwindcss v4" 스킴 — CSS 변수 기반 최신 토큰 패턴
- **Uncertainty**: 낮음.
- **Output**: `tudal/src/app/globals.css` 토큰 정의 + `ServicePlan.md §3` 기록

### Task 8.3 — 고품질 목업 생성 (구 8.4)
- **Primary**: `frontend-design:frontend-design` 스킬
- **Rationale**: "Create distinctive, production-grade frontend interfaces with high design quality". P7.2 와이어프레임 + P8.1~8.2 디자인 시스템 적용본. "4종 고정" 해제 — **P7.2 와이어프레임 확정 후 Must 화면 4~6종**으로 조정.
- **Alternatives**:
  - `frontend-design:design-html` — 최종 HTML/CSS 코드 출력. 구현(B1)에 더 가까움. 목업 단계에서는 과함.
- **Uncertainty**: 낮음.
- **Output**: `.omc/design/mockups/` (Must 화면 4~6종)

### Task 8.4 — Design Review (구 8.5)
- **Primary**: `frontend-design:design-review` 스킬 + `frontend-design:visual-verdict` 스킬
- **Rationale**: design-review = "Designer's eye QA: finds visual inconsistency, spacing issues, hierarchy problems". visual-verdict = 구조화 verdict (목업 ↔ 와이어프레임 비교).
- **Alternatives**:
  - `frontend-design:plan-design-review` — 플랜 레벨 인터랙티브 검토. 시각 QA보다 상위.
- **Uncertainty**: 낮음.
- **Output**: `.omc/design/review-report.md`

### Task 8.5 — 디자인 아카이브 저장 (구 8.6)
- **Primary**: 직접 Write (Figma 링크·파일 경로 기록)
- **Uncertainty**: 해당 없음.
- **Output**: `ServicePlan.md §3 "Design Source"` 항목

> **Phase 8 완료 = Phase.md 전체 종료 → BuildPhase.md B1(디자인→코드 전환) 진입.**

---

## 📌 소스별 사용 스킬 요약

| 소스 | 사용 Task |
|---|---|
| **OMC 에이전트** | 1.1(analyst), 1.8(architect+scientist), 3.4(information-architect), 4.1(product-manager), 4.4(writer), 5.1(critic), 5.2+7.3(ux-researcher), 7.1+8.1~8.3(designer) |
| **OMC 스킬** | 1.2+1.7(`external-context`), 8.0(`harness`) |
| **superpowers** | 0.1(brainstorming), 0.3(deep-interview 조건부) |
| **PM** | 1.3~1.6, 2.1~2.5, 3.1~3.3, 4.1~4.3, 5.3 — 주력 번들 |
| **Korean Planning** | 6.1(frd-writer), 6.2(scenario-system) |
| **frontend-design** | 7.2(design-shotgun), 8.1(design-consultation), 8.3(frontend-design), 8.4(design-review+visual-verdict) |
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
| ~~P6~~ | ~~ServicePlan-Admin v1.0~~ | **폐지 (2026-04-15 13차)** — ServicePlan-Admin v1.0이 FRD·Scenarios 본질 포함. BuildPhase B3.0에서 통합. |
| P8 | P5 + P7 완료 | 디자인 토큰 + 목업 4~6종 + Design Review 통과 |

**Phase 8 완료 = Phase.md 전체 종료 → BuildPhase.md B1(디자인→코드 전환) 진입**.

---

## 🔁 병렬 디스패치 원칙

- **Phase 1**: 1.1 + 1.2 + 1.3 + 1.4 + 1.6 + 1.7 + 1.8 (7개 병렬)
- **Phase 2**: 2.1 + 2.2 + 2.3 + 2.5 (4개 병렬, 2.4는 2.3 후)
- **Phase 3**: `3.1` ∥ `3.4` ∥ `3.3(OST)` → `3.2 가정 대장 정리` (3개 병렬 후 3.2)
- **Phase 4 ∥ Phase 7**: P3 완료 후 P4(기획서)와 P7(UX) 병렬 착수
- **Phase 5**: 5.1 + 5.2 + 5.3 (3개 병렬, P4+P7 둘 다 완료 후)
- **Phase 8**: 8.1 + 8.2 (2개 병렬, 8.3은 8.1~8.2 후, 8.4는 8.3 후, 8.5는 8.4 후)

순차 의존 체인:
- 1.3 → 1.5 → 2.2
- 2.5 → 3.3
- 3.1 → 4.2
- P3 → P4 ∥ P7 → P5
- P5 + P7 → P8 (P6 폐지, 2026-04-15)
- ServicePlan-Admin §3 + P7 산출물 → BuildPhase B3.0 ScreenSpec (P6 경유 삭제)
- P8 → BuildPhase B1

---

## 📍 현재 위치

- **완료**: P0~P2 완료
- **다음**: Phase 3 — `3.1` ∥ `3.4` ∥ `3.3(OST)` 병렬 착수 후 → `3.2 가정 대장 정리`
- **블록**: 없음
- **트래킹 SoT**: `ServicePlan-Admin.md` §진행 트래커

> **P8 완료 후 → BuildPhase.md 진입**
> - B1(디자인→코드 전환): P8 목업·토큰을 코드 컴포넌트로 구현.
> - B2(인프라): deepinit(B2.1) + env(B2.2~B2.4) + pykrx 런타임(B2.5) + DB(B2.6) + 인증(B2.7) + 구현 하네스(B2.8) + 데이터 하네스(B2.9). B1과 병렬 가능.
> - B3~B5: 구현 → QA → 배포. 상세는 `BuildPhase.md` 참조.

---

## 📝 Revision History

| 날짜 | 내용 | 세션 |
|---|---|---|
| 2026-04-12 | 초기 Phase 구조 수립 (P0~P8, 에이전트/스킬 매핑) | 1~3차 세션 |
| 2026-04-15 | Output 라우팅 변경 (`ServicePlan §3.X` → sub-doc/`.omc/` 경로) — 상단 주석 추가 | 7차 세션 |
| 2026-04-15 | **P2 완료 후 대대적 재정비**. Task 삭제 2건(구 4.3 Metrics Dashboard·구 8.3 shadcn 오버라이드 계획), Task 병합 1건(구 3.2+3.3 → 새 3.2 가정 대장 정리), Output 라우팅 §3.X → sub-doc 경로로 전면 치환, 스코프 조정 9건, P3 병렬 지도 추가. 근거: 감사 3건(pointer·handoff·적대감사) 종합. | 2026-04-15 7차·8차 세션 |
