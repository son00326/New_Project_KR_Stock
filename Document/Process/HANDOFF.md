# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-15 (2차 갱신)

**목적**: 다음 세션이 "**다음에 무엇을 할지**"만 빠르게 파악.
**원칙**: 미래 지향. 포인터·다음 단계만. 상세 컨텍스트는 각 원본 문서가 박제.

> **⚡ 진입**: "@HANDOFF.md 보고 이어서 작업해줘" → §🔴 다음 단계부터 착수. 문서 자동 로드는 `CLAUDE.md` Entry routine이 담당.

---

## 🔴 다음 단계 (우선순위)

### ⭐ 1순위 — Phase 0 Task 0.1: Admin 스코프·JTBD brainstorming

Phase.md P0~P8 구조 확정 완료 (2026-04-15). 다음 세션에서 **P0 Task 0.1** 착수.

- **파일**: `Document/Service/Planning/ServicePlan-Admin.md` (§0~§7 스켈레톤 + **P0~P8 sub-task 트래커** 준비됨)
- **작업**: `superpowers:brainstorming`으로 Admin 스코프·독자·깊이·JTBD 합의 → §1 초안
- **입력**:
  - `Document/Service/Planning/ServicePlan.md` (인덱스·공통 원칙)
  - `Document/Process/Memo/2026-04-15-기준선정리.md` (기준선 전문)
  - `BusinessPlan §10` (Short List 30 SoT)
  - `ReportFramework.md` (리포트 형식 SoT)
- **방법론**: `Phase.md` P0~P8 순차 진행. 에이전트/스킬은 Phase.md 각 Task에 명시.
- **실행 흐름**: P0 → P1(7병렬) → P2(4병렬) → P3 → [P4 ∥ P7] → P5 → P6 → P8 → BuildPhase
- **트래킹 SoT**: `ServicePlan-Admin.md` §진행 트래커

### 1.5순위 — ServicePlan-Member.md (블로커 해소 후)

- **파일**: `Document/Service/Planning/ServicePlan-Member.md` (스켈레톤 준비됨)
- **블로커**: `Document/Research/` = BigFinance Stage 0 하나뿐. "Research 사례와 동일" 기준선의 참조 대상 부족 → 경쟁사 리서치 2~3개 선행 필요.
- **선결 결정**: Research 보강 착수 여부·범위를 사용자가 결정해야 Admin 완료 후 바로 Member 진입 가능.

### 2순위 — ReportFramework v3.0 전면 개정 (1순위와 병렬 가능)

기획 완료 (C1~C4 + P1~P8 확정, §4 시범본 critic 통과).

- **첫 행동**: `ReportFramework-v3-Decisions.md` 정독 → D 루트 선택:
  - **D-1** (표준): `writer(opus)`로 `ReportFramework.md` v3.0 전면 개정 → `critic(opus)` 적대적 재검증
  - **D-2**: 14 섹터 매트릭스 분리 먼저 (`ReportFramework-SectorMetrics.md`) 후 D-1
  - **D-3**: 스킬/에이전트 매칭 정량 평가 먼저 (후순위)

### 3순위 — 알테오젠 풀 보고서 v3 재작성 (v3.0 완료 후)

시범 §4 → 전 섹션. `document-specialist + analyst` 병렬 리서치 → `writer(opus)` 통합 → `critic(opus)`. 신규 `Report-Alteogen_196170_v3.md` + Samchundang v3 backfill(메타데이터만).

### 4순위 — Track Record 인프라 (v3 완료 후)

`Document/TrackRecord.md` 스켈레톤 + `/track-record` 커맨드(analyst 기반) + 기존 2건 YAML frontmatter backfill.

### 📦 Planning + Build 후속

ServicePlan-Admin.md P0~P8 완료 후 Build 진입. Member는 Admin 완료 + Research 보강 후.
- **Planning**: P0~P8 순차 (Phase.md 방법론). 트래킹 SoT = ServicePlan-Admin.md 진행 트래커.
- **Build**: P8(UI Design) 완료 후. B1(디자인→코드 전환)+B2(인프라) 병렬 → B3~B5 → B6 iteration

---

## 🟡 미결 / 보류

### 문서 구조 정합성 — 결정 완료 (2026-04-15)
- [x] **Task 트래커** → 각 sub-doc(Admin/Member)에 §0 진행 트래커 내장. HANDOFF는 작업 큐만.
- [x] **Phase.md Output 라우팅** → Phase.md 상단 라우팅 노트 추가. `ServicePlan §X.X` → 해당 sub-doc. 어드민 먼저 1회 → 멤버 1회 순서.
- [x] **BuildPhase.md Output 라우팅** → BuildPhase.md 상단 라우팅 노트 추가. 디자인 시스템 → ServicePlan.md §3 공통. 나머지 → 해당 sub-doc. 코드 변경 → CodebaseStatus.md.

### 사용자 답변 필요
- [ ] Q12 공동창업자 피벗 합의 (R&R 정의 후)
- [ ] Q13 기존 코드베이스 재활용 방식 — **(B) 선별 재활용** 권장
- [ ] Q14 14개 기능 후보 Must/Should/Nice 분류 (Phase 3.1에서 해소)
- [ ] Q16 법무 자문 이력·후보 (Phase 6 완료 직후)
- [ ] Q17 이용약관·면책 동의서 (BuildPhase B5 이전)

### 커밋 대기
- 2026-04-15 기준선 정리 세션 변경분 (11개 문서 파일). 사용자 검토 후 커밋.
- 2026-04-15 Phase 구조 확정 세션 변경분 (Phase.md P7·P8 추가, BuildPhase.md B1 스코프 조정, ServicePlan-Admin.md 트래커 확장, BusinessPlan §12 결정 기록, 기준선 메모 열린 질문 해소, HANDOFF.md 갱신). 사용자 검토 후 커밋.

### 포인터
- 상시 경고·법적 Hard Constraints → `CLAUDE.md` + `BusinessPlan §7`

---

## 📝 최근 세션 (1줄 요약 + 포인터)

- **2026-04-15 (2차)** Phase 구조 확정 — P7(UX)+P8(UI) 추가, 전 소스 에이전트/스킬 대조, 트래커 확장, 면책 완화·스케줄러 확정 기록. 열린 질문 #3·#4 해소.
- **2026-04-15** 기준선 충돌 정리 — 어드민/멤버 2트랙 확정, C1~C5 5개 카테고리 일괄 정리, verifier 통과. 상세: `Document/Process/Memo/2026-04-15-기준선정리.md`
- **2026-04-14** ReportFramework v3.0 기획 — v2.1 critic(CRITICAL 8 + MAJOR 15) → v3.0 착수, §4 시범본 critic 통과. 상세: `ReportFramework-v3-Decisions.md`
- **2026-04-13** 매뉴얼 트레이딩 트랙 설계 → `BusinessPlan §10`. 알테오젠 HTML 변환.
- **기술 스택·백테스트 v6.1 FINAL** → `Document/Process/CodebaseStatus.md`
- **사업 기획 Q1~Q11** → `Document/Business/BusinessPlan.md`

그 외 히스토리: `git log` 또는 `~/.claude/projects/.../memory/`.

---

**단일 진입 규칙**: 본 HANDOFF + `ServicePlan-Admin.md`(또는 Member) 읽으면 즉시 착수 가능. 배경 필요 시 `Memo/2026-04-15-기준선정리.md` 참조.
