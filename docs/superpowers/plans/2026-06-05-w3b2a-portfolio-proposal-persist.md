# W3b-2a — portfolio_proposal DB 영속 (dormant 마이그 0034 + upsert RPC + proposePortfolio persist 게이트) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:test-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** W3b-1이 생성·반환만 하던 `PortfolioProposal`을 **DB에 영속**한다. 신규 `portfolio_proposal` 테이블(dormant 마이그 0034 + SECURITY DEFINER schema-ready/upsert RPC) + 영속 helper(`admin-proposals.ts`) + `proposePortfolio`가 생성한 제안을 **flag(`PORTFOLIO_PROPOSAL_PERSIST_ENABLED`) 뒤에서 영속**(default off=W3b-1 동작 1:1). **Accept 통합·snapshot weight 대체·UI는 범위 밖**(W3b-2b/W3b-3). **money-path 무접촉**(buildInitialSnapshots/acceptShortList/0016 RPC 무변경).

**Architecture:** W3 분할 W3a(✅ entry_price)/W3b(portfolio_proposal AI). W3b = W3b-1(✅ 클라이언트+proposePortfolio 플러밍) / **W3b-2a(영속, 이 계획)** / W3b-2b(Accept 통합 — money-path, 후속) / W3b-3(UI). W3b-2를 2-슬라이스로 분리(설계 리서치 4-dim 권고): 영속(W3b-2a, money-path 무접촉)을 먼저, Accept 통합(W3b-2b, money-path)을 분리해 위험 격리. 신규 마이그 0034(dormant, W1a/W1b 0032/0033 패턴 — USER-apply·미적용 fail-closed·rollback 짝). 신규 `admin-proposals.ts`(getProposalByMonth + assertProposalPersistenceReady + upsertProposalRpc, DI client). `proposePortfolio`에 persist 게이트 추가(생성 전 schema-ready preflight + 생성 후 upsert).

**Tech Stack:** Next.js 16 (server action) · Postgres(Supabase) SECURITY DEFINER RPC · Vitest · W3b-1 PortfolioProposal/PortfolioProposalSchema 재사용.

**SoT:** HANDOFF ⭐ 65차 W3(D26 Q2) + W3b-1 entry. 설계 리서치 = Workflow `wf_dd847de0-c01`(4-dim, HIGH risks 카탈로그). main `6b118bc`(또는 docs-sync 자손) 기준.

---

## 범위 (W3b-2a) vs 분리

**W3b-2a (이 계획):**
1. **마이그 0034** (dormant, `0034_portfolio_proposal.{sql,rollback.sql}`): `portfolio_proposal` 테이블 + RLS + SECURITY DEFINER `assert_portfolio_proposal_schema`/`upsert_portfolio_proposal` RPC(각 4-grant).
2. **`admin-proposals.ts`** (신규): `getProposalByMonth({month, client})` + `assertProposalPersistenceReady({client})` + `upsertProposalRpc({month, proposal, model, client})`(DI). row↔PortfolioProposal 변환.
3. **`proposePortfolio` persist 게이트**: flag-on이면 생성 전 `assertProposalPersistenceReady`로 0034 미적용을 AI 호출 0회로 차단하고, 생성 후 `upsertProposalRpc` 호출 → `data.proposalId` 반환. flag-off=영속 0(W3b-1 1:1). RPC/테이블 부재(미적용)=fail-closed `proposal_schema_missing`.
4. **format-error** 신규 코드(`proposal_persist_failed`/`proposal_schema_missing`).
5. **`.env.example`** `PORTFOLIO_PROPOSAL_PERSIST_ENABLED=false`.

**분리 (후속 DEFER):** **W3b-2b**(Accept 통합 — buildInitialSnapshots proposal weight override + cash row + acceptShortList getProposalByMonth + stale 재검증, **money-path**) · **W3b-3**(admin UI). · proposal status(pending/accepted) lifecycle = W3b-2b(Accept가 status 전이).

**W3b-2a 범위 밖:** Accept/snapshot/0016 RPC 무변경 · buildInitialSnapshots 무변경 · UI · 실 AI 가동(W3b-1 flag+key USER 게이트).

## 핵심 설계 결정

- **D1 슬라이스 분리(money-path 격리).** 설계 리서치 dim4 권고 — W3b-2a는 영속 인프라만(SELECT/INSERT via RPC), Accept/snapshot 경로 0 변경. money-path 회귀 위험 0. W3b-2b에서 Accept가 영속분을 소비(별도 money-path 리뷰).
- **D2 마이그 0034 dormant + rollback.** `portfolio_proposal`: `id uuid pk default gen_random_uuid()`, `month date not null` **unique(month)**(latest-only — 3인 공용 포트폴리오이므로 월당 1개 제안, 재생성=upsert 교체; admin별 unique 금지), `positions jsonb not null`, `cash_weight numeric(5,4) not null`, `rationale_kr text not null`, `model text not null`, `created_by uuid not null`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`. CHECK: `month = date_trunc('month', month)::date`, `jsonb_typeof(positions)='array'`, `jsonb_array_length(positions) between 1 and 30`, `cash_weight between 0 and 0.30`, `char_length(rationale_kr) <= 200`, `model <> ''`. RLS enable + admin select policy(`is_admin()`) + **restrictive anon block(`using(false)`)**. **`assert_portfolio_proposal_schema()`** SECURITY DEFINER `set search_path=public, pg_temp` + `auth.uid()`/`is_admin()` 가드 → returns `true`(AI 호출 전 schema-ready preflight). **`upsert_portfolio_proposal(p_month date, p_positions jsonb, p_cash_weight numeric, p_rationale_kr text, p_model text)`** SECURITY DEFINER + 내부 `auth.uid()`/`is_admin()` 가드(아니면 `auth_unavailable`/`admin_required`) + RPC 내부 coarse validation(위 CHECK와 동일 의미, 위반 시 `proposal_invalid`) + `created_by=auth.uid()` + `on conflict(month) do update set positions=excluded.positions, cash_weight=excluded.cash_weight, rationale_kr=excluded.rationale_kr, model=excluded.model, created_by=excluded.created_by, updated_at=now()`(**created_at은 최초 row 시각 유지, created_by는 마지막 생성자**) → returns **jsonb** `{id, created_at, updated_at}`(PostgREST TABLE-return array ambiguity 회피). **각 RPC 4-grant: revoke public+anon, grant authenticated+service_role**(메모리 feedback_supabase_security_definer_pattern). rollback.sql = drop function 2개 + drop table. **미적용/스키마캐시 부재 코드(42P01/42883/PGRST202/PGRST204/PGRST205) → helper가 `proposal_schema_missing` 정규화**(0032/0033 fail-closed 패턴 동형).
- **D3 helper(admin-proposals.ts, DI).** `getProposalByMonth({month, client?})`: `client.from('portfolio_proposal').select(...).eq('month', month).maybeSingle()` → row→`PortfolioProposalSchema.parse({positions, cashWeight, rationale_kr})` | null(저장 row도 재검증). `assertProposalPersistenceReady({client?})`: `client.rpc('assert_portfolio_proposal_schema')` → missing-code는 `proposal_schema_missing`. `upsertProposalRpc({month, proposal, model, client?})`: `PortfolioProposalSchema.parse(proposal)`로 server-boundary 재검증 후 `client.rpc('upsert_portfolio_proposal', {...})` → jsonb `{id, created_at}`를 `{id, createdAt}`으로 변환. `adminUserId` 인자는 두지 않음(스푸핑 방지 — RPC가 `auth.uid()`로 created_by 결정). RPC/테이블/schema-cache 부재 pg/PostgREST 코드(42P01/42883/PGRST202/PGRST204/PGRST205) → throw `proposal_schema_missing`, schema 위반/기타 pg error → `proposal_persist_failed:<code>`. month=YYYY-MM-01(date). `getProposalByMonth`는 W3b-2a에서 테스트 seam만, W3b-2b Accept 통합의 live consumer 예정(이번 PR live caller 0 허용 명시).
- **D4 proposePortfolio persist 게이트.** `const shouldPersist = process.env.PORTFOLIO_PROPOSAL_PERSIST_ENABLED === 'true'`. flag-on이면 **AI 비용 발생 전**(auth/admin/proposal flag/key/cost-log gate 후, `preflightHardcap`/`callPortfolioProposal` 전) `assertProposalPersistenceReady({client: supabase})`; 0034 미적용/스키마캐시 미갱신이면 `proposal_schema_missing` 반환 + `callPortfolioProposal` 0회(유료 제안 유실 방지). 현 흐름(생성→positions⊆universe 검증→return) 끝의 `return {success,data:{proposal}}` 직전에: `if (shouldPersist) { try { const {id}=await upsertProposalRpc({month: input.month, proposal, model: resolveRole('portfolio').model, client: supabase}); proposalId=id } catch(err){ return {success:false, error: normalize proposal_schema_missing|proposal_persist_failed:* } } }`. flag-off → proposalId 미설정, W3b-1 동작 1:1. **month 형식**: 테이블 month=date(YYYY-MM-01)이므로 `input.month`(YYYY-MM-01) 그대로(monthYm=YYYY-MM는 cost_log 전용 — 혼동 금지). 반환 타입 = `{success:true, data:{proposal, proposalId?: string}}`(optional이라 W3b-1 proposal-only assert 무회귀). **model**: `resolveRole('portfolio').model` 재사용(하드코딩 금지) — callPortfolioProposal과 동일 SoT.
- **D5 paid-loss 정책(계획 판정).** persist flag on은 "DB 영속이 성공한 제안만 성공" 계약이므로, **schema_missing은 preflight로 AI 호출 전 fail-closed**, post-AI `proposal_persist_failed:*`는 잔여 운영장애로 fail-closed 유지(비영속 proposal을 success로 노출하지 않음). 이 정책 변경은 product 결정이므로 W3b-2a에서는 현 fail-closed를 유지하되, 테스트로 schema_missing paid-loss만 차단한다.
- **D6 behavior-neutral.** flag default off → 영속 0 → W3b-1 동작. 마이그 0034 미적용이어도 flag off면 RPC 미호출 → 안전. flag on + 미적용 → `proposal_schema_missing` fail-closed(USER가 flag 켜기 전 0034 apply = dormant 계약) + AI 호출 0. cost 0(영속 자체는 DB write, 신규 AI 호출 없음).

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
- [ ] `0034_portfolio_proposal.sql`: 테이블 + unique(month) + CHECK/coarse validation + RLS(admin select + restrictive anon) + `assert_portfolio_proposal_schema`/`upsert_portfolio_proposal` SECURITY DEFINER(auth/is_admin 가드 + latest-only upsert attribution + jsonb return + 각 4-grant).
- [ ] `0034_portfolio_proposal.rollback.sql`: drop function 2개 + drop table.
- [ ] 로컬 PG 적용 smoke(있으면) 또는 SQL lint. **production apply = USER**(dormant).

## Task 2: admin-proposals.ts (TDD)
- [ ] **Step 1 실패 테스트**: getProposalByMonth(row→proposal / null + row schema invalid throw) · assertProposalPersistenceReady(rpc 호출 + schema missing code) · upsertProposalRpc(PortfolioProposalSchema 재검증 + rpc 호출 인자 + jsonb {id,created_at}→{id,createdAt}) · RPC/테이블/schema-cache 부재(42883/42P01/PGRST202/PGRST204/PGRST205)→proposal_schema_missing · 기타 pg error→proposal_persist_failed:<code>.
- [ ] **Step 2 실패 확인.**
- [ ] **Step 3 구현**(DI client, admin-approvals.ts 동형).
- [ ] **Step 4 통과 + tsc.**
- [ ] **Step 5 commit** `feat(w3b2a): admin-proposals — getProposalByMonth + assertReady + upsertProposalRpc(dormant 0034) (D2/D3, TDD)`

## Task 3: proposePortfolio persist 게이트 + format-error (TDD)
- [ ] **Step 1 실패 테스트**(propose-portfolio-action.test.ts 확장): persist flag off→영속 0·proposalId 없음(assert/upsert 미호출, W3b-1 동작) / flag on→assertProposalPersistenceReady 1회가 `callPortfolioProposal`보다 먼저 + upsertProposalRpc 1회(month YYYY-MM-01 + proposal + model resolveRole('portfolio').model + client DI)·data.proposalId 반환 / flag on + readiness throw proposal_schema_missing→{success:false, proposal_schema_missing}·**AI 호출 0회** / flag on + post-AI upsert throw proposal_persist_failed:*→{success:false}·callPortfolioProposal 1회(정책 fail-closed) / format-error 2종 한국어 매핑.
- [ ] **Step 2 실패 확인.**
- [ ] **Step 3 구현**: persist 게이트(assertProposalPersistenceReady + upsertProposalRpc import) + 반환 타입 + format-error 2종.
- [ ] **Step 4 통과.**
- [ ] **Step 5 commit** `feat(w3b2a): proposePortfolio persist 게이트(PORTFOLIO_PROPOSAL_PERSIST_ENABLED, dormant-safe) + format-error 2종 (D4/D5, TDD)`

## Task 4: .env.example + 게이트 + DoD
- [ ] `.env.example` PORTFOLIO_PROPOSAL_PERSIST_ENABLED=false + 주석(0034 apply 동반, flag off=W3b-1 동작).
- [ ] build+lint+test:ci+tsc ALL GREEN.
- [ ] 무변경 diff 0: `git diff main -- tudal/src/app/(admin)/admin/portfolio/actions.ts` 에 buildInitialSnapshots/acceptShortList 본문 변경 0(persist 게이트만) · admin-approvals/admin-snapshots/0016 무변경.
- [ ] grep: upsertProposalRpc live caller ≥1(proposePortfolio).

## Self-Review 체크
1. **Spec coverage:** D26 Q2 proposal 영속(Task1~3) / Accept 통합·UI 분리 명시(W3b-2b/3) / money-path 무접촉.
2. **behavior-neutral:** flag off=W3b-1 1:1 / dormant 0034 미적용+flag off 안전 / flag on+미적용=fail-closed + AI 호출 0.
3. **Type:** PortfolioProposal(W3b-1) = upsert 입력(재검증) = getProposalByMonth 출력(재검증).
4. **무회귀:** buildInitialSnapshots/Accept/0016/snapshot 무변경 · cost 0.

## 검증 게이트 (DoD)
- ALL GREEN + money-path diff 0 + upsertProposalRpc live caller ≥1.
- 연결 테스트: proposePortfolio→(flag)→assert ready(pre-AI)→upsertProposalRpc(mock)→proposalId / flag-off no-persist / schema-missing fail-closed + AI 호출 0 / post-AI persist failure fail-closed.
- 실 AI 0 · cost 0(persist=DB write). 실 영속 = flag+0034 apply USER 게이트.

## Execution Handoff
§2.0a + 사용자 명시: plan ①Claude→②omxy 검토→③omxy direct-edit→④Claude 검증 → impl 동일 → 배선 교차감사(Claude Workflow + omxy blind) → docs-sync(omxy 검증).
