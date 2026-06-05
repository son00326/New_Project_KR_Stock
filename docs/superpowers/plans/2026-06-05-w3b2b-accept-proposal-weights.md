# W3b-2b — Accept가 영속 proposal로 snapshot weight 구성 (money-path 통합) Implementation Plan

> REQUIRED SUB-SKILL: superpowers:test-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Accept(acceptShortList → buildInitialSnapshots → acceptShortlistRpc 0016)가 W3b-2a로 영속된 `portfolio_proposal`을 읽어, **snapshot weight를 proposal.positions[{ticker,weight}] 기반으로 구성**(현 suggestedWeight 균등 대신). flag-gated behavior-neutral. **cash는 현행대로 implicit**(aggregate row weight=1 유지 — E5 contract·consumer 무손상). **money-path = 최고위험 — orphan/부분 snapshot/consumer 회귀 0 다층 fail-closed.**

**Architecture:** W3b = W3b-1(✅ 제안 플러밍)/W3b-2a(✅ 영속)/**W3b-2b(Accept 통합, 이 계획)**/W3b-3(UI). W3b-2b = **weight override만**(설계 리서치 dim4 권고로 cash-row 명시화 + proposal status lifecycle은 W3b-2c/W3b-3로 분리 — money-path 위험 격리). 신규 flag `PORTFOLIO_USE_PROPOSAL_ENABLED`(default off). acceptShortList가 getProposalByMonth(W3b-2a) 소비 → stale 재검증 → buildInitialSnapshots(proposal). 단, **0034 미적용(`proposal_schema_missing`)은 "proposal 없음"과 동일하게 suggestedWeight fallback**해서 USE flag 오설정이 기존 Accept를 깨지 않게 한다. 0016 RPC 무변경(payload만 변경).

**Tech Stack:** Next.js 16 server action · Vitest · W3b-2a admin-proposals(getProposalByMonth) + W3b-1 PortfolioProposal 재사용.

**SoT:** HANDOFF ⭐ W3(D26 Q2) + W3b-2a entry. 설계 리서치 = Workflow `wf_fa580f35-2d6`(4-dim, cash-implicit/flag/stale/consumer 합의). main `c1ee610`(docs-sync 자손) 기준.

---

## 범위 (W3b-2b) vs 분리
**W3b-2b (이 계획):**
1. 신규 flag `PORTFOLIO_USE_PROPOSAL_ENABLED`(default off, persist flag와 별개).
2. acceptShortList: flag-on이면 `loadProposalForAccept(month)` 래퍼에서 `getProposalByMonth({month})` 호출 → proposal 존재 시 **positions ⊆ 현 active shortlist 재검증**(stale, 위반=`proposal_stale_for_month`) → buildInitialSnapshots에 proposal 주입. flag-off OR proposal 미존재 OR `proposal_schema_missing`(0034 미적용/스키마캐시) → 현 suggestedWeight 1:1. `portfolio_proposal_parse_failed:*`(오염 row)와 기타 SELECT 실패는 fallback 금지(reject).
3. buildInitialSnapshots(input + `proposal?`): proposal 있으면 **proposal.positions 종목만**(편입<30 가능) snapshot(weight=proposal weight, isCash=false) + aggregate row(ticker=NULL, weight=1, cash implicit) 유지. proposal에 없는 active shortlist 종목은 **0-weight row를 만들지 않음**(현금화/미편입 표현은 cash implicit). entry_price(W3a)는 snapshot 대상(proposal.positions)만 fetch하고, 누락 1개라도 전체 거부. proposal 없으면 현 경로.
4. pure helper `buildSnapshotRowsFromProposal`(testable) — positions→snapshot rows 매핑.
5. format-error 신규 `proposal_stale_for_month` + `proposal_lookup_failed`(SELECT 장애 reject용).
6. `.env.example` `PORTFOLIO_USE_PROPOSAL_ENABLED=false`.

**분리(후속 DEFER):** W3b-2c(명시적 cash row isCash=true + proposal status lifecycle pending→accepted) · W3b-3(admin UI). 0016 RPC 무변경.

**범위 밖:** 0016 RPC 변경 · cash row 명시화 · proposal status · UI · 실 가동(USER flag).

## 핵심 설계 결정
- **D1 weight override만, cash implicit.** per-position weight=proposal weight, aggregate row(ticker=NULL) weight=1 유지 → E5 aggregate contract·consumer(admin-performance fetchPortfolioRows[ticker=NULL aggregate], admin-decision-tree) 무손상. 명시적 cash row(isCash=true)는 W3b-2c 분리(money-path 위험 격리).
- **D2 flag PORTFOLIO_USE_PROPOSAL_ENABLED(default off).** persist flag(W3b-2a)와 별개 — 영속은 켜되 소비는 끌 수 있음. flag-off OR proposal 미존재 OR 0034 미적용(`proposal_schema_missing`) → 현 suggestedWeight 경로 1:1(behavior-neutral). USE flag on + 0034 미적용이 정상 Accept를 막으면 HIGH 회귀이므로 반드시 테스트.
- **D3 stale 재검증.** proposal은 생성(proposePortfolio) 시점 영속 — Accept 시점 shortlist re-screening 가능. positions ⊆ 현 active(removed 제외) ticker set 위반 시 `proposal_stale_for_month` 거부(orphan 배분 차단). proposal 종목이 active에서 빠졌으면 Reject 유도.
- **D4 buildInitialSnapshots(proposal?) + entry_price.** proposal 있으면 `buildSnapshotRowsFromProposal(proposal, priceMap)`: positions 각 ticker entry_price(W3a priceMap, 누락 ≤0 전체 거부) + weight=proposal weight. aggregate row 동일. weights는 zod ±0.01 이미 검증 → 재정규화 없음. helper도 방어적으로 `positions` distinct/weight>0/`sum(weights)+cashWeight≈1`를 재확인하거나 W3b-2a 타입 경계만 입력된다는 테스트를 박제. proposal 없으면 현 shortlist.suggestedWeight 경로.
  - **entry_price fetch scope(proposal-aware, Claude critique HIGH)**: proposal 경로는 **proposal.positions ticker만** resolveEntryPricesKrw에 넘긴다(전체 30 아님). 비편입 shortlist 종목의 stale 가격이 spurious entry_price_unavailable를 유발하지 않도록. proposal 종목 중 1개라도 누락 → 전체 거부(W3a 패턴 유지). proposal 없으면 현 전체-shortlist fetch.
  - **entry_price 게이트 결합(문서화)**: buildInitialSnapshots는 entry_price 이중 게이트(PORTFOLIO_REAL_ENTRY_PRICE_ENABLED+KRX_OPENAPI_KEY) off면 모든 경로가 entry_price_unavailable(W3a 기존). 즉 **실 proposal-weight Accept는 W3a 게이트 ON 전제** — 이는 W3a 기존 동작이고 W3b-2b가 새로 거는 게 아니다(테스트는 priceMap mock). flag-off proposal 경로 미진입(behavior-neutral) 유지.
- **D5 0016 RPC 무변경.** snapshot payload를 action이 구성, RPC는 그대로 원자 INSERT(approval+snapshot 단일 txn, 부분 snapshot 진입 차단 = snapshot build가 RPC 前이라 entry_price 누락 시 txn 미시작 — W3a 패턴 유지).
- **D6 behavior-neutral + 다층 fail-closed.** flag-off/proposal 미존재/`proposal_schema_missing` → 1:1. proposal malformed(`portfolio_proposal_parse_failed:*`) → reject(서버 액션 raw throw 금지, `{success:false,error}` 유지). stale → reject. 기타 SELECT 실패 → `proposal_lookup_failed` reject. entry_price 누락 → 전체 거부. snapshot INSERT 실패 → 0016 자동 rollback.
- **D7 consumer 회귀 0 (audit DONE — R25 reconcile).** ticker=NULL aggregate row(weight=1) 불변 → admin-performance summary/decision-tree 무손상. **consumer 감사 결과(증거)**: `admin-performance.getBucketPerformance()`(admin-performance.ts:309-313)는 `weightSum = Σ per-ticker weight`로 나눈 **가중평균**(weightSum>0 가드 + 단순평균 fallback) — per-ticker weight 합이 1이라고 **가정하지 않는다**. 따라서 proposal weight 합이 `1-cashWeight`(<1)여도 가중평균이 정확(분모=실제 weightSum). cash-implicit 모델 consumer-safe 확정. portfolio_snapshot 읽는 5곳(admin-performance×2 / admin-decision-tree[ticker=NULL aggregate] / admin-snapshots reader / admin-shortlist-incumbents)에 per-ticker weight-sum=1 가정 없음. omitted ticker = **snapshot row 없음**(weight-0 row 금지) → `members`에서 자연 제외(편입 안 된 종목 = 미보유, 정확). per-ticker weight는 flag-on 시 AI weight 반영(의도된 기능, flag-off 무변경).
- **D8 cash-implicit 의미 + Day-0 returns(문서화).** aggregate row weight=1 = **포트폴리오 전체(=100%)** 관례 불변. per-ticker(equity) weight 합 = `1-cashWeight`, 현금은 implicit(잔여). 명시적 cash row(isCash=true, weight=cashWeight)는 **W3b-2c 분리**(money-path 위험 격리). per-ticker dailyReturn/totalReturn/alpha/sharpe = buildInitialSnapshots에서 **Day 0(=Accept date) 0 초기화** — 이후 성과 누적은 별도 perf 배치(W3b-2b 범위 밖, Accept = 새 월 Day 0이라 과거 weight 재계산 충돌 없음).

## File Structure
**신규:** `tudal/src/lib/portfolio/proposal-snapshots.ts`(buildSnapshotRowsFromProposal pure) + `__tests__/`.
**수정:** actions.ts(acceptShortList `loadProposalForAccept`+stale+buildInitialSnapshots(proposal) / buildInitialSnapshots proposal 분기) + format-error.ts(+`proposal_stale_for_month`·`proposal_lookup_failed` 테스트) + .env.example + accept/consumer 테스트.
**무변경:** 0016 RPC · admin-approvals · admin-snapshots 타입 · admin-proposals(getProposalByMonth 재사용) · reader.

## Tasks
- T0 가드 **(consumer audit DONE — D7 증거)**: branch + getProposalByMonth/PortfolioProposal/buildInitialSnapshots 현 시그니처 확인. ✅ portfolio_snapshot consumer grep 완료 — getBucketPerformance(admin-performance.ts:309-313)는 weightSum 정규화(per-ticker sum=1 가정 없음), 5 reader 모두 per-ticker weight-sum=1 가정 없음 → cash-implicit safe. 착수 시 재확인만.
- T1 (TDD) buildSnapshotRowsFromProposal pure helper: positions→rows(weight/entry_price 매핑) + 누락 entry_price throw(전체 거부) + aggregate row(weight=1) + subset proposal은 omitted active ticker **0-row 없음**(편입 종목만 row) + cashWeight implicit(sum(weights)+cashWeight≈1 검증/박제). **entry_price fetch는 proposal.positions ticker만**(D4 proposal-aware scope).
- T2 (TDD) acceptShortList proposal 소비: flag-on getProposalByMonth → stale 재검증(proposal_stale_for_month) → buildInitialSnapshots(proposal). flag-off/미존재/`proposal_schema_missing` 1:1. parse failed는 reject(raw throw 금지), 기타 SELECT 실패는 `proposal_lookup_failed`.
- T3 .env.example + 게이트(build/lint/test:ci/tsc) + 무변경 diff(0016/admin-approvals/admin-snapshots) + behavior-neutral 회귀 테스트(flag-off=현 snapshot, USE flag on+0034 missing=suggestedWeight fallback).

## 검증 게이트 (DoD)
- ALL GREEN + 0016/admin-approvals diff 0 + consumer(aggregate row) 회귀 0.
- 연결 테스트: flag-on+proposal → proposal weight snapshot / flag-off → suggestedWeight 1:1 / proposal null → suggestedWeight 1:1 / USE flag on+`proposal_schema_missing` → suggestedWeight 1:1 / malformed proposal → reject / stale → reject / entry_price 누락 → 전체 거부 / getBucketPerformance per-ticker AI weight 의도 반영.
- 실 AI 0 · cost 0(읽기만). 실 가동 = flag+0034 apply+persist USER 게이트.

## Execution Handoff
§2.0a: plan ①Claude→②omxy 검토→③omxy direct-edit→④Claude 검증 → impl → 배선 교차감사(Claude Workflow + omxy blind) → docs-sync. **money-path = 최고위험 — adversarial 검토 강화(snapshot 원자성·stale·consumer 회귀·부분 snapshot 집중).**
