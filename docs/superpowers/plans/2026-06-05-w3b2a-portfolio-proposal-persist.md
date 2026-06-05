# W3b-2a — portfolio_proposal DB 영속 (dormant 마이그 0034 + upsert RPC + proposePortfolio persist 게이트) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:test-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** W3b-1이 생성·반환만 하던 `PortfolioProposal`을 **DB에 영속**한다. 신규 `portfolio_proposal` 테이블(dormant 마이그 0034 + SECURITY DEFINER upsert RPC) + 영속 helper(`admin-proposals.ts`) + `proposePortfolio`가 생성한 제안을 **flag(`PORTFOLIO_PROPOSAL_PERSIST_ENABLED`) 뒤에서 영속**(default off=W3b-1 동작 1:1). **Accept 통합·snapshot weight 대체·UI는 범위 밖**(W3b-2b/W3b-3). **money-path 무접촉**(buildInitialSnapshots/acceptShortList/0016 RPC 무변경).

**Architecture:** W3 분할 W3a(✅ entry_price)/W3b(portfolio_proposal AI). W3b = W3b-1(✅ 클라이언트+proposePortfolio 플러밍) / **W3b-2a(영속, 이 계획)** / W3b-2b(Accept 통합 — money-path, 후속) / W3b-3(UI). W3b-2를 2-슬라이스로 분리(설계 리서치 4-dim 권고): 영속(W3b-2a, money-path 무접촉)을 먼저, Accept 통합(W3b-2b, money-path)을 분리해 위험 격리. 신규 마이그 0034(dormant, W1a/W1b 0032/0033 패턴 — USER-apply·미적용 fail-closed·rollback 짝). 신규 `admin-proposals.ts`(getProposalByMonth + upsertProposalRpc, DI client). `proposePortfolio`에 persist 게이트 추가(생성 후·반환 전).

**Tech Stack:** Next.js 16 (server action) · Postgres(Supabase) SECURITY DEFINER RPC · Vitest · W3b-1 PortfolioProposal/PortfolioProposalSchema 재사용.

**SoT:** HANDOFF ⭐ 65차 W3(D26 Q2) + W3b-1 entry. 설계 리서치 = Workflow `wf_dd847de0-c01`(4-dim, HIGH risks 카탈로그). main `6b118bc`(또는 docs-sync 자손) 기준.

---

## 범위 (W3b-2a) vs 분리

**W3b-2a (이 계획):**
1. **마이그 0034** (dormant, `0034_portfolio_proposal.{sql,rollback.sql}`): `portfolio_proposal` 테이블 + RLS + SECURITY DEFINER `upsert_portfolio_proposal` RPC(4-grant).
2. **`admin-proposals.ts`** (신규): `getProposalByMonth({month, client})` + `upsertProposalRpc({month, proposal, model, client})`(DI). row↔PortfolioProposal 변환.
3. **`proposePortfolio` persist 게이트**: 생성 후, `PORTFOLIO_PROPOSAL_PERSIST_ENABLED==='true'`면 `upsertProposalRpc` 호출 → `data.proposalId` 반환. flag-off=영속 0(W3b-1 1:1). RPC/테이블 부재(미적용)=fail-closed `proposal_schema_missing`.
4. **format-error** 신규 코드(`proposal_persist_failed`/`proposal_schema_missing`).
5. **`.env.example`** `PORTFOLIO_PROPOSAL_PERSIST_ENABLED=false`.

**분리 (후속 DEFER):** **W3b-2b**(Accept 통합 — buildInitialSnapshots proposal weight override + cash row + acceptShortList getProposalByMonth + stale 재검증, **money-path**) · **W3b-3**(admin UI). · proposal status(pending/accepted) lifecycle = W3b-2b(Accept가 status 전이).

**W3b-2a 범위 밖:** Accept/snapshot/0016 RPC 무변경 · buildInitialSnapshots 무변경 · UI · 실 AI 가동(W3b-1 flag+key USER 게이트).

## 핵심 설계 결정

- **D1 슬라이스 분리(money-path 격리).** 설계 리서치 dim4 권고 — W3b-2a는 영속 인프라만(SELECT/INSERT via RPC), Accept/snapshot 경로 0 변경. money-path 회귀 위험 0. W3b-2b에서 Accept가 영속분을 소비(별도 money-path 리뷰).
- **D2 마이그 0034 dormant + rollback.** `portfolio_proposal`: `id uuid pk default gen_random_uuid()`, `month date not null` **unique(month)**(latest-only — D26 Q2 단순화: 월당 1개 제안, 재생성=upsert 교체), `positions jsonb not null`, `cash_weight numeric(5,4) not null`, `rationale_kr text not null`, `model text not null`, `created_by uuid not null`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`. RLS enable + admin select policy(`is_admin()`) + **restrictive anon block(`using(false)`)**. **`upsert_portfolio_proposal(p_month date, p_positions jsonb, p_cash_weight numeric, p_rationale_kr text, p_model text)`** SECURITY DEFINER `set search_path=public, pg_temp` + 내부 `is_admin()` 가드(아니면 raise `admin_required`) + `created_by=auth.uid()` + `on conflict(month) do update`(updated_at=now()) → returns `(id, created_at)`. **4-grant: revoke public+anon, grant authenticated+service_role**(메모리 feedback_supabase_security_definer_pattern). rollback.sql = drop function + drop table. **미적용 시 RPC 부재 → PGRST202/42883 → helper가 `proposal_schema_missing` 정규화**(0032/0033 fail-closed 패턴 동형).
- **D3 helper(admin-proposals.ts, DI).** `getProposalByMonth({month, client?})`: `client.from('portfolio_proposal').select(...).eq('month', month).maybeSingle()` → row→PortfolioProposal(positions/cashWeight/rationale_kr) | null. `upsertProposalRpc({month, proposal, model, adminUserId?, client?})`: `client.rpc('upsert_portfolio_proposal', {...})` → {id, createdAt}. RPC/테이블 부재 pg 코드(42P01/42883/PGRST202) → throw `proposal_schema_missing`, 그 외 → `proposal_persist_failed:<code>`. month=YYYY-MM-01(date). positions는 PortfolioProposalSchema 구조 그대로 jsonb.
- **D4 proposePortfolio persist 게이트.** 현 흐름(생성→positions⊆universe 검증→return) 끝의 `return {success,data:{proposal}}` 직전에: `if (process.env.PORTFOLIO_PROPOSAL_PERSIST_ENABLED==='true') { try { const {id}=await upsertProposalRpc({month: input.month, proposal, model: 'claude-opus-4-8'(resolved), adminUserId: user.id, client: supabase}); proposalId=id } catch(err){ return {success:false, error: err.message가 proposal_schema_missing|proposal_persist_failed:* } } }`. flag-off → proposalId 미설정, W3b-1 동작 1:1. **month 형식**: 테이블 month=date(YYYY-MM-01)이므로 `input.month`(YYYY-MM-01) 그대로(monthYm=YYYY-MM는 cost_log 전용 — 혼동 금지). 반환 타입 = `{success:true, data:{proposal, proposalId?: string}}`. **model**: resolveRole('portfolio').model 재사용(하드코딩 금지) — callPortfolioProposal과 동일 출처.
- **D5 behavior-neutral.** flag default off → 영속 0 → W3b-1 동작. 마이그 0034 미적용이어도 flag off면 RPC 미호출 → 안전. flag on + 미적용 → `proposal_schema_missing` fail-closed(USER가 flag 켜기 전 0034 apply = dormant 계약). cost 0(영속은 DB write, AI 호출 없음).

## File Structure

**신규:**
- `tudal/supabase/migrations/0034_portfolio_proposal.sql` + `.rollback.sql`
- `tudal/src/lib/data/admin-proposals.ts` + `__tests__/admin-proposals.test.ts`

**수정:**
- `tudal/src/app/(admin)/admin/portfolio/actions.ts` — proposePortfolio persist 게이트 + 반환 타입 proposalId.
- `tudal/src/app/(admin)/admin/portfolio/__tests__/propose-portfolio-action.test.ts` — persist on/off/schema-missing 케이스.
- `tudal/src/lib/admin/format-error.ts` (+test) — proposal_persist_failed/proposal_schema_missing.
- `tudal/.env.example` — PORTFOLIO_PROPOSAL_PERSIST_ENABLED=false.

**무변경:** buildInitialSnapshots · acceptShortList · admin-approvals · admin-snapshots · 0016 RPC · reader · 기존 마이그.

---

## Task 0: 착수 가드
- [ ] branch `feat/w3b2a-portfolio-proposal-persist` (main docs-sync 자손 기준).
- [ ] 최신 마이그=0033 확인 → 신규 0034. PortfolioProposal export 확인(portfolio-proposal-client.ts).

## Task 1: 마이그 0034 (dormant) + rollback
- [ ] `0034_portfolio_proposal.sql`: 테이블 + unique(month) + RLS(admin select + restrictive anon) + `upsert_portfolio_proposal` SECURITY DEFINER(is_admin 가드 + on conflict month + 4-grant).
- [ ] `0034_portfolio_proposal.rollback.sql`: drop function + drop table.
- [ ] 로컬 PG 적용 smoke(있으면) 또는 SQL lint. **production apply = USER**(dormant).

## Task 2: admin-proposals.ts (TDD)
- [ ] **Step 1 실패 테스트**: getProposalByMonth(row→proposal / null) · upsertProposalRpc(rpc 호출 인자 + {id,createdAt} 반환) · RPC 부재(42883/42P01/PGRST202)→proposal_schema_missing · 기타 pg error→proposal_persist_failed:<code>.
- [ ] **Step 2 실패 확인.**
- [ ] **Step 3 구현**(DI client, admin-approvals.ts 동형).
- [ ] **Step 4 통과 + tsc.**
- [ ] **Step 5 commit** `feat(w3b2a): admin-proposals — getProposalByMonth + upsertProposalRpc(dormant 0034) (D2/D3, TDD)`

## Task 3: proposePortfolio persist 게이트 + format-error (TDD)
- [ ] **Step 1 실패 테스트**(propose-portfolio-action.test.ts 확장): persist flag off→영속 0·proposalId 없음(upsertProposalRpc 미호출, W3b-1 동작) / flag on→upsertProposalRpc 1회(month YYYY-MM-01 + proposal + client DI)·data.proposalId 반환 / flag on + RPC throw proposal_schema_missing→{success:false, proposal_schema_missing}·**제안 생성은 됨**(callPortfolioProposal 1회) / format-error 2종 한국어 매핑.
- [ ] **Step 2 실패 확인.**
- [ ] **Step 3 구현**: persist 게이트(upsertProposalRpc import) + 반환 타입 + format-error 2종.
- [ ] **Step 4 통과.**
- [ ] **Step 5 commit** `feat(w3b2a): proposePortfolio persist 게이트(PORTFOLIO_PROPOSAL_PERSIST_ENABLED, dormant-safe) + format-error 2종 (D4/D5, TDD)`

## Task 4: .env.example + 게이트 + DoD
- [ ] `.env.example` PORTFOLIO_PROPOSAL_PERSIST_ENABLED=false + 주석(0034 apply 동반, flag off=W3b-1 동작).
- [ ] build+lint+test:ci+tsc ALL GREEN.
- [ ] 무변경 diff 0: `git diff main -- tudal/src/app/(admin)/admin/portfolio/actions.ts` 에 buildInitialSnapshots/acceptShortList 본문 변경 0(persist 게이트만) · admin-approvals/admin-snapshots/0016 무변경.
- [ ] grep: upsertProposalRpc live caller ≥1(proposePortfolio).

## Self-Review 체크
1. **Spec coverage:** D26 Q2 proposal 영속(Task1~3) / Accept 통합·UI 분리 명시(W3b-2b/3) / money-path 무접촉.
2. **behavior-neutral:** flag off=W3b-1 1:1 / dormant 0034 미적용+flag off 안전 / flag on+미적용=fail-closed.
3. **Type:** PortfolioProposal(W3b-1) = upsert 입력 = getProposalByMonth 출력.
4. **무회귀:** buildInitialSnapshots/Accept/0016/snapshot 무변경 · cost 0.

## 검증 게이트 (DoD)
- ALL GREEN + money-path diff 0 + upsertProposalRpc live caller ≥1.
- 연결 테스트: proposePortfolio→(flag)→upsertProposalRpc(mock)→proposalId / flag-off no-persist / schema-missing fail-closed + 제안 생성 유지.
- 실 AI 0 · cost 0(persist=DB write). 실 영속 = flag+0034 apply USER 게이트.

## Execution Handoff
§2.0a + 사용자 명시: plan ①Claude→②omxy 검토→③omxy direct-edit→④Claude 검증 → impl 동일 → 배선 교차감사(Claude Workflow + omxy blind) → docs-sync(omxy 검증).
