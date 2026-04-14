# ServicePlan.md — 주픽 서비스 기획서

Last updated: 2026-04-15
Status: 리셋 · 서비스 기획 본체 착수 대기

---

## 0. 이 문서의 정체성

이 문서는 **주픽 서비스 기획의 확정 사항만** 담는다.

- **담는 것**: 독자·Vision·JTBD·Value Proposition·NSM·Must 기능·IA·User Stories 등 **서비스 기획 결정**.
- **담지 않는 것**:
  - Task 진행 추적 → `Document/Process/Phase.md` / `BuildPhase.md`
  - 방법론(하네스·deepinit·롤백 프로토콜) → `BuildPhase.md`
  - 기술 스택(언어·프레임워크·DB 등) → **서비스 기획 완료 후** 별도 결정 (현재 미정)
  - 코드베이스 현재 상태 → `Document/Process/CodebaseStatus.md`
  - 세션 연속성 로그 → `Document/Process/HANDOFF.md`
  - 사업 결정(재무·법·가격 구조) → `Document/Business/BusinessPlan.md`

**작성 원칙**: 확정된 항목만 섹션으로 추가한다. 미래 Phase 결과를 기다리는 빈 placeholder는 두지 않는다.

---

## 1. BusinessPlan 파생 제약 (서비스는 이것을 전제로 설계)

> 사업 레벨에서 이미 확정된 제약. 서비스 기획은 이 범위 안에서 움직인다. 상세는 `BusinessPlan.md` 해당 섹션 참조.

| 항목 | 내용 | 출처(SoT) |
|---|---|---|
| 가격 | 월 19,900원 | → BusinessPlan §Q11 |
| 사용자 규모 · 법적 제약 · 언어 | 500명 cap · 초대 전용 · 매수/매도 추천 금지 · Footer 면책 · Korean-first | → BusinessPlan §7 |
| 핵심 시스템 1 — AI 투심위 | 2-Layer(Core 11명 + Sector 14×10명), Section 0~8 + Appendix | → BusinessPlan §8 / ReportFramework.md §1·§5~§7 |
| 핵심 시스템 2 — 3축 자동매매 Quant | 단기30% / 중기40% / 장기30%, Quant Board 10명, Early Warning + Crisis Layer | → BusinessPlan §9 (미확정, 재검토 대기) |
| 핵심 시스템 3 — 매뉴얼 트레이딩 트랙 | Short List 30개(10+10+10), 어드민 전용, 월 1회 재선정 | → BusinessPlan §10 |
| 운용 자금 | 본인 자금 15억 선행 운용 | → BusinessPlan §Q10 |

위 세 핵심 시스템을 **사용자가 실제로 만나는 서비스 경험**으로 풀어내는 것이 이 문서의 목표다.

---

## 2. 서비스 기획 확정 사항

> **아직 없음.** Phase 0부터 시작한다.
>
> 확정될 때마다 아래에 서브섹션으로 추가한다. 번호는 확정 순서가 아니라 논리적 순서를 따른다.

<!--
추가 예정 섹션 (확정 시점에 추가, 지금 미리 만들지 않음):
  2.1 독자 / 깊이 / 톤
  2.2 Problem Statement
  2.3 Target Users & Personas
  2.4 Core JTBD
  2.5 Value Proposition
  2.6 Vision
  2.7 North Star Metric
  2.8 Must / Should / Nice 기능
  2.9 Information Architecture
  2.10 User Stories
  2.11 Metrics
  2.12 Risks & Assumptions
  2.13 Non-Goals
-->

---

## 3. Revision History

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-04-12 | ServicePlan.md 초기 스캐폴드 | 4-문서 구조 전환 |
| 2026-04-12 | BuildPhase 통합 트래커·Infrastructure §2·본문 18 섹션 신설 | 사용자 승인 |
| 2026-04-12 | BusinessPlan §8~§9 동기화 (AI 투심위·Quant·백테스트) | BusinessPlan 확정 반영 |
| 2026-04-13 | Manual 투자 트랙 §3.22 신설 | 사용자 인터뷰 결과 |
| **2026-04-15** | **전면 리셋.** §0 통합 트래커·§2 Infrastructure(기술 스택 포함)·§3 빈 placeholder 18섹션·§3.19/3.20/3.22 UX 추측 블록 삭제. 서비스 기획 본체만 담는 문서로 재정의. | 사용자 지시 — "두서없이 미래를 미리 적었다, 서비스 기획부터 다시" |
| 2026-04-15 | **기준선 정합성 정리.** §3.22(Manual 투자 트랙) 관련 중복·분산 서술은 본 리셋으로 일괄 제거. BusinessPlan §10에 동일 내용 잔존했으나 본 정리에서 단일 출처(BusinessPlan §10)로 통합 완료. §1 표의 출처(SoT)를 BusinessPlan/ReportFramework 포인터로 재정렬. | 기준선 충돌·중복 정리 |
