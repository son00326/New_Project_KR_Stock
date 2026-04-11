# Phase.md — 주픽 서비스 기획 단계별 실행 플랜

Last updated: 2026-04-12
Purpose: BusinessPlan.md의 사업 방향을 **웹 서비스 기획(ServicePlan.md)**으로 풀어내기 위한 Phase/Task 분해표.
Scope: **서비스 기획 확정까지만** (Phase 0~6). 실제 코드 변경·디자인·배포는 **BuildPhase.md**가 담당.
각 Task마다 "무엇을 산출하는가 + 어느 에이전트·스킬을 쓰는가 + 왜 그게 최적인가 + 불확실성"을 명시한다.

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
[P0] 의도 정렬              → ServicePlan.md 독자·깊이·목차 합의
[P1] 리서치 병렬            → 갭·경쟁·페르소나·여정·JTBD·기능 확장
[P2] 전략 골격              → 비전·VP·9-section 전략·가격·북극성 지표
[P3] 구조화                 → 우선순위·가정·OST·IA
[P4] ServicePlan.md 작성    → PRD 초안·스토리·메트릭
[P5] 검증 병렬              → 적대적·UX·pre-mortem
[P6] 후속 사양화 (문서만)    → FRD·Scenarios
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

목표: ServicePlan.md 작성에 필요한 외부/내부 사실 전량 확보. **한 메시지 5 에이전트 병렬 호출**.

### Task 1.1 — BusinessPlan 기획 갭 분석
- **Primary**: `analyst` 에이전트 (opus, read-only)
- **Rationale**: 공식 역할 "Pre-planning consultant for requirements analysis".
- **Alternatives**: `product-manager`(Phase 4 주 작성자), `critic`(Phase 5).
- **Uncertainty**: 낮음.
- **Output**: `.omc/research/gap-analysis.md`

### Task 1.2 — 경쟁 서비스 스캔
- **Primary**: `document-specialist` 에이전트 + `pm-market-research:competitor-analysis` 스킬
- **Rationale**: `competitor-analysis`는 구조화 프레임만 제공, 실 웹 리서치는 document-specialist가 담당.
- **Alternatives**: `researcher` 에이전트(설명 거의 동일), `scientist`(부적합).
- **Uncertainty**: **중간** — document-specialist vs researcher. 실행 직전 재확인.
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

> **Phase 6 완료 = Phase.md 전체 종료**. 이후는 **BuildPhase.md**가 담당.

---

## 📌 소스별 사용 스킬 요약

| 소스 | 사용 Task |
|---|---|
| **OMC 에이전트** | 1.1(analyst), 1.2(document-specialist), 3.5(information-architect), 4.1(product-manager), 4.3(product-analyst), 4.5(writer), 5.1(critic), 5.2(ux-researcher) |
| **superpowers** | 0.1(brainstorming), 0.3(deep-interview 조건부) |
| **PM** | 1.3~1.6, 2.1~2.5, 3.1~3.4, 4.1~4.4, 5.3 — 주력 번들 |
| **Korean Planning** | 6.1(frd-writer), 6.2(scenario-system) |
| **frontend-design** | 범위 밖 → BuildPhase.md |
| **commit-commands** | 범위 밖 → BuildPhase.md |
| **gstack** | 범위 밖 → BuildPhase.md |
| **GSD/crypto/claude-md-management/skill-creator/playground** | 사용 안 함 |

---

## 🚦 진입 조건 (Phase Gates)

| Phase | 진입 전제 | 종료 기준 |
|---|---|---|
| P0 | BusinessPlan.md, ServicePlan.md 존재 | ServicePlan §1.1 채움 |
| P1 | P0 합의 완료 | `.omc/research/*` + ServicePlan §3 관련 섹션 초안 |
| P2 | P1 전체 완료 | Vision + VP + 9-section Canvas + Pricing + NSM |
| P3 | P2 + 1.6 기능 풀 | Must/Should/Nice + OST + IA |
| P4 | P2, P3 완료 | ServicePlan v0.9 |
| P5 | ServicePlan v0.9 | critic/ux/pre-mortem 3 리포트 → v1.0 |
| P6 | ServicePlan v1.0 | FRD.md + Scenarios.md |

**Phase 6 완료 = Phase.md 전체 종료 → BuildPhase.md 진입**.

---

## 🔁 병렬 디스패치 원칙

- **Phase 1**: 1.1 + 1.2 + 1.3 + 1.4 + 1.6 (5개 병렬)
- **Phase 2**: 2.1 + 2.2 + 2.3 + 2.5 (4개 병렬, 2.4는 2.3 후)
- **Phase 3**: 3.2 + 3.4 + 3.5 (3개 병렬, 3.1/3.3는 3.2 후)
- **Phase 5**: 5.1 + 5.2 + 5.3 (3개 병렬)

순차 의존 체인:
- 1.3 → 1.5 → 2.2
- 2.5 → 3.4
- 3.1 → 4.2
- 6.1 → BuildPhase B3.0

---

## 📍 현재 위치

- **완료**: (Phase 착수 전)
- **다음**: Phase 0 Task 0.1 — `superpowers:brainstorming`
- **블록**: 없음
