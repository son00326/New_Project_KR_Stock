# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-15

**목적**: 다음 세션이 "**다음에 무엇을 할지**"만 빠르게 파악.
**원칙**: 미래 지향. 포인터·다음 단계만. 상세 컨텍스트는 각 원본 문서가 박제.

> **⚡ 진입**: "@HANDOFF.md 보고 이어서 작업해줘" → §🔴 다음 단계부터 착수. 5문서 자동 로드는 `CLAUDE.md` Entry routine이 담당.

---

## 🔴 다음 단계 (우선순위)

### ⭐ 1순위 — ServicePlan §2 본체 착수 (2026-04-15 기준선 반영)

기준선(어드민 전용 메인 서비스 + 멤버 페이지 Research 형식)이 2026-04-15 확정됨에 따라 ServicePlan §2 본체 작성이 선행.

- **(1)** 멤버 메인 페이지 정의 — `Document/Research/` 사례 형식 구체화
- **(2)** 어드민 Top30 보드 IA 설계
- **블로커**: `Document/Research/` = BigFinance Stage 0 하나뿐. 경쟁사 리서치 선행 여부 사용자 결정 필요.
- **입력**: `Document/Process/Memo/2026-04-15-기준선정리.md` (기준선·용어·SoT 전문)
- **방법**: `superpowers:brainstorming` → `product-manager` → ServicePlan §2 초안 → `critic(opus)`

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

ServicePlan §2 본체 완료 후 진입.
- **Planning**: `ServicePlan §0` 첫 미완료 체크박스 (Task 0.1~0.3 → Phase 1 병렬 7 에이전트 → Phase 2~6)
- **Build**: Planning Phase 5 v1.0 확정 후. B1+B2 병렬 → B3~B5 → B6 iteration

---

## 🟡 미결 / 보류

### 사용자 답변 필요
- [ ] Q12 공동창업자 피벗 합의 (R&R 정의 후)
- [ ] Q13 기존 코드베이스 재활용 방식 — **(B) 선별 재활용** 권장
- [ ] Q14 14개 기능 후보 Must/Should/Nice 분류 (Phase 3.1에서 해소)
- [ ] Q16 법무 자문 이력·후보 (Phase 6 완료 직후)
- [ ] Q17 이용약관·면책 동의서 (BuildPhase B5 이전)

### 커밋 대기
- 2026-04-15 기준선 정리 세션 변경분 (11개 문서 파일). 사용자 검토 후 커밋.

### 포인터
- BuildPhase 실행 트래커 → `ServicePlan.md §0`
- 상시 경고·법적 Hard Constraints → `CLAUDE.md` + `BusinessPlan §7`

---

## 📝 최근 세션 (1줄 요약 + 포인터)

- **2026-04-15** 기준선 충돌 정리 — 어드민/멤버 2트랙 확정, C1~C5 5개 카테고리 일괄 정리, verifier 통과. 상세: `Document/Process/Memo/2026-04-15-기준선정리.md`
- **2026-04-14** ReportFramework v3.0 기획 — v2.1 critic(CRITICAL 8 + MAJOR 15) → v3.0 착수, §4 시범본 critic 통과. 상세: `ReportFramework-v3-Decisions.md`
- **2026-04-13** 매뉴얼 트레이딩 트랙 설계 → `BusinessPlan §10`. 알테오젠 HTML 변환.
- **기술 스택·백테스트 v6.1 FINAL** → `Document/Process/CodebaseStatus.md`
- **사업 기획 Q1~Q11** → `Document/Business/BusinessPlan.md`

그 외 히스토리: `git log` 또는 `~/.claude/projects/.../memory/`.

---

**단일 진입 규칙**: 본 HANDOFF + `Memo/2026-04-15-기준선정리.md` + `ServicePlan §0` 셋만 읽으면 즉시 착수 가능.
