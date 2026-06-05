# W3b-2b — Accept가 영속 proposal로 snapshot weight 구성 (money-path 통합) Implementation Plan

> REQUIRED SUB-SKILL: superpowers:test-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Accept(acceptShortList → buildInitialSnapshots → acceptShortlistRpc 0016)가 W3b-2a로 영속된 `portfolio_proposal`을 읽어, **snapshot weight를 proposal.positions[{ticker,weight}] 기반으로 구성**(현 suggestedWeight 균등 대신). flag-gated behavior-neutral. **cash는 현행대로 implicit**(aggregate row weight=1 유지 — E5 contract·consumer 무손상). **money-path = 최고위험 — orphan/부분 snapshot/consumer 회귀 0 다층 fail-closed.**

**Architecture:** W3b = W3b-1(✅ 제안 플러밍)/W3b-2a(✅ 영속)/**W3b-2b(Accept 통합, 이 계획)**/W3b-3(UI). W3b-2b = **weight override만**(설계 리서치 dim4 권고로 cash-row 명시화 + proposal status lifecycle은 W3b-2c/W3b-3로 분리 — money-path 위험 격리). 신규 flag `PORTFOLIO_USE_PROPOSAL_ENABLED`(default off). acceptShortList가 getProposalByMonth(W3b-2a) 소비 → stale 재검증 → buildInitialSnapshots(proposal). 0016 RPC 무변경(payload만 변경).

**Tech Stack:** Next.js 16 server action · Vitest · W3b-2a admin-proposals(getProposalByMonth) + W3b-1 PortfolioProposal 재사용.

**SoT:** HANDOFF ⭐ W3(D26 Q2) + W3b-2a entry. 설계 리서치 = Workflow `wf_fa580f35-2d6`(4-dim, cash-implicit/flag/stale/consumer 합의). main `c1ee610`(docs-sync 자손) 기준.

---

## 범위 (W3b-2b) vs 분리
**W3b-2b (이 계획):**
1. 신규 flag `PORTFOLIO_USE_PROPOSAL_ENABLED`(default off, persist flag와 별개).
2. acceptShortList: flag-on이면 `getProposalByMonth({month, client})` → proposal 존재 시 **positions ⊆ 현 active shortlist 재검증**(stale, 위반=`proposal_stale_for_month`) → buildInitialSnapshots에 proposal 주입. flag-off OR proposal 미존재 → 현 suggestedWeight 1:1.
3. buildInitialSnapshots(input + `proposal?`): proposal 있으면 **proposal.positions 종목만**(편입<30 가능) snapshot(weight=proposal weight, isCash=false) + aggregate row(ticker=NULL, weight=1, cash implicit) 유지. entry_price(W3a) proposal 종목에도 fetch, 누락 1개라도 전체 거부. proposal 없으면 현 경로.
4. pure helper `buildSnapshotRowsFromProposal`(testable) — positions→snapshot rows 매핑.
5. format-error 신규 `proposal_stale_for_month`.
6. `.env.example` `PORTFOLIO_USE_PROPOSAL_ENABLED=false`.

**분리(후속 DEFER):** W3b-2c(명시적 cash row isCash=true + proposal status lifecycle pending→accepted) · W3b-3(admin UI). 0016 RPC 무변경.

**범위 밖:** 0016 RPC 변경 · cash row 명시화 · proposal status · UI · 실 가동(USER flag).

## 핵심 설계 결정
- **D1 weight override만, cash implicit.** per-position weight=proposal weight, aggregate row(ticker=NULL) weight=1 유지 → E5 aggregate contract·consumer(admin-performance fetchPortfolioRows[ticker=NULL aggregate], admin-decision-tree) 무손상. 명시적 cash row(isCash=true)는 W3b-2c 분리(money-path 위험 격리).
- **D2 flag PORTFOLIO_USE_PROPOSAL_ENABLED(default off).** persist flag(W3b-2a)와 별개 — 영속은 켜되 소비는 끌 수 있음. flag-off OR proposal 미존재 → 현 suggestedWeight 경로 1:1(behavior-neutral).
- **D3 stale 재검증.** proposal은 생성(proposePortfolio) 시점 영속 — Accept 시점 shortlist re-screening 가능. positions ⊆ 현 active(removed 제외) ticker set 위반 시 `proposal_stale_for_month` 거부(orphan 배분 차단). proposal 종목이 active에서 빠졌으면 Reject 유도.
- **D4 buildInitialSnapshots(proposal?) + entry_price.** proposal 있으면 `buildSnapshotRowsFromProposal(proposal, priceMap)`: positions 각 ticker entry_price(W3a priceMap, 누락 ≤0 전체 거부) + weight=proposal weight. aggregate row 동일. weights는 zod ±0.01 이미 검증 → 재정규화 없음. proposal 없으면 현 shortlist.suggestedWeight 경로.
- **D5 0016 RPC 무변경.** snapshot payload를 action이 구성, RPC는 그대로 원자 INSERT(approval+snapshot 단일 txn, 부분 snapshot 진입 차단 = snapshot build가 RPC 前이라 entry_price 누락 시 txn 미시작 — W3a 패턴 유지).
- **D6 behavior-neutral + 다층 fail-closed.** flag-off/proposal 미존재 → 1:1. proposal malformed(getProposalByMonth가 schema 재검증 throw) → reject. stale → reject. entry_price 누락 → 전체 거부. snapshot INSERT 실패 → 0016 자동 rollback.
- **D7 consumer 회귀 0.** ticker=NULL aggregate row(weight=1) 불변 → admin-performance/decision-tree 무손상. per-ticker weight 분포는 flag-on 시 AI weight(=의도된 기능, flag-off 무변경). 소비자 grep으로 per-ticker weight 의존 여부 확인.

## File Structure
**신규:** `tudal/src/lib/portfolio/proposal-snapshots.ts`(buildSnapshotRowsFromProposal pure) + `__tests__/`.
**수정:** actions.ts(acceptShortList getProposalByMonth+stale+buildInitialSnapshots(proposal) / buildInitialSnapshots proposal 분기) + format-error.ts(+test) + .env.example + accept 테스트.
**무변경:** 0016 RPC · admin-approvals · admin-snapshots 타입 · admin-proposals(getProposalByMonth 재사용) · reader.

## Tasks
- T0 가드: branch + getProposalByMonth/PortfolioProposal/buildInitialSnapshots 현 시그니처 확인 + portfolio_snapshot consumer grep(per-ticker weight 의존?).
- T1 (TDD) buildSnapshotRowsFromProposal pure helper: positions→rows(weight/entry_price 매핑) + 누락 entry_price throw + aggregate row. 
- T2 (TDD) acceptShortList proposal 소비: flag-on getProposalByMonth → stale 재검증(proposal_stale_for_month) → buildInitialSnapshots(proposal). flag-off/미존재 1:1. format-error 1종.
- T3 .env.example + 게이트(build/lint/test:ci/tsc) + 무변경 diff(0016/admin-approvals/admin-snapshots) + behavior-neutral 회귀 테스트(flag-off=현 snapshot).

## 검증 게이트 (DoD)
- ALL GREEN + 0016/admin-approvals diff 0 + consumer(aggregate row) 회귀 0.
- 연결 테스트: flag-on+proposal → proposal weight snapshot / flag-off → suggestedWeight 1:1 / stale → reject / entry_price 누락 → 전체 거부.
- 실 AI 0 · cost 0(읽기만). 실 가동 = flag+0034 apply+persist USER 게이트.

## Execution Handoff
§2.0a: plan ①Claude→②omxy 검토→③omxy direct-edit→④Claude 검증 → impl → 배선 교차감사(Claude Workflow + omxy blind) → docs-sync. **money-path = 최고위험 — adversarial 검토 강화(snapshot 원자성·stale·consumer 회귀·부분 snapshot 집중).**
