# W3b-1 — portfolio_proposal AI 클라이언트 + admin 제안 액션 (플러밍) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** D26 Q2(AI 자율 포트 구성)의 첫 슬라이스 — 선정된 30 종목에 대해 **AI(Opus 4.8 `portfolio` role)가 편입 여부·종목별 비중·현금 비중(0~30%)을 제안**하는 `callPortfolioProposal` 클라이언트 + `proposePortfolio` admin server action(read-only 제안 반환, 영속/Accept 통합 없음)을 짓는다. **judge-client.ts 패턴 1:1 미러.** AI 호출은 flag+key 게이트 — 플러밍은 mock 연결 테스트로 검증(AI 키 불필요), 실 호출은 USER 게이트.

**Architecture:** W3를 W3a(entry_price ✅) / **W3b(portfolio_proposal AI)** 로 분할, W3b를 다시 W3b-1(client+action 플러밍, 이 계획) / W3b-2(DB 영속+Accept 통합) / W3b-3(UI)로 분할(W1a/W1b·judge 전례 — client부터). 신규 `src/lib/ai/portfolio-proposal-client.ts`(judge-client.ts 동형: resolveRole+provider.call+insertCostLog+transient classifier+zod 파서). 신규 admin action `proposePortfolio`(is_admin RPC 게이트 + flag+key 게이트 → getActiveShortList → callPortfolioProposal → 구조화 proposal 반환, **영속/Accept 무변경**).

**Tech Stack:** Next.js 16 (server action) · Vitest · zod · W0 LlmProvider + model-registry(`portfolio` role 기정의 Opus 4.8).

**SoT:** HANDOFF ⭐ 65차 W3(:57-59) "portfolio_proposal(편입 여부/총 개수/단·중·장 분배/종목별 비중/현금 0~30%) AI 판단" + D26 Q2(전부 AI 자율, 어드민은 Accept/Reject만) + `model-registry.ts` `MODEL_REGISTRY.portfolio`(Opus 4.8, calibration 8000/4000).

---

## 범위 (W3b-1) vs 분리

**W3b-1 (이 계획):**
1. `callPortfolioProposal`(`portfolio` role) — 입력 = 30 종목 요약(ticker/name/배지/ai_score/winning_timeframe/conviction), 출력 = `PortfolioProposal {positions[{ticker,weight,timeframe}], cashWeight, rationale_kr}`. judge-client 동형(cost_log persona_id='portfolio-proposal'/prompt_version 'portfolio@v1'/transient classifier/authKey 게이트).
2. `PortfolioProposalSchema` zod — positions weight∈(0,1]·timeframe enum·ticker 6자리, cashWeight∈[0,0.30], **sum(weights)+cashWeight≈1**(±0.01 tolerance) refine, distinct ticker. `parsePortfolioProposal`(extractJsonObject 재사용 — persona-panel-adapter export). **positions⊆입력 ticker는 schema가 아니라 action에서 검증**(universe는 런타임 shortlist).
3. `proposePortfolio` admin server action — is_admin RPC 게이트 + flag(`PORTFOLIO_AI_PROPOSAL_ENABLED`)+key(`ANTHROPIC_API_KEY`) 게이트 → getActiveShortList({month, client}) → 30 요약 → callPortfolioProposal → `{success, data: proposal}`. **영속 0 · Accept 무변경 · flag-off=proposal_disabled.**
4. format-error 신규 코드 한국어 매핑.

**분리(후속 DEFER):** W3b-2(portfolio_proposal DB 테이블 + 영속 + Accept가 proposal 기반 종목/비중 사용) · W3b-3(admin UI 버튼·표시) · proposal을 selection finalize에 자동 연결.

**W3b-1 범위 밖:** 실 AI 가동(flag+key USER 게이트) · DB 영속 · Accept 통합 · UI.

## 핵심 설계 결정

- **D1 client = judge-client 미러.** `src/lib/ai/portfolio-proposal-client.ts`: `callPortfolioProposal(input)` → `resolveRole('portfolio')`(Opus 4.8) → provider.call(systemPrompt+userPrompt) → W1a transient classifier(`ai_call_failed:transient:*`) → insertCostLog(persona_id='portfolio-proposal', prompt_version='portfolio@v1', model=resolved) → `parsePortfolioProposal`. `ANTHROPIC_API_KEY` 부재 → `ai_key_unavailable`(D28 A). authKey 미노출.
- **D2 schema invariant(구조 검증 — 결정론 selection 금지).** `PortfolioProposalSchema`: `positions: [{ticker: /^\d{6}$/, weight: (0,1], timeframe: short|mid|long}]`(1~30) + `cashWeight: [0,0.30]` + `rationale_kr: ≤200`. **refine 3종**: ① sum(positions.weight)+cashWeight ∈ [0.99, 1.01](부동소수 tolerance) ② distinct ticker ③ positions 비어있지 않음. **Q2 자율성 해석:** AI가 후보 30 중 편입 종목 수/비중/현금을 정하되, 현재 SoT의 현금 cap(0~30%) 때문에 W3b-1은 최소 1종목을 요구한다. 0종목·현금 100% 운용 모드는 cash cap 변경이므로 이 계획에서 몰래 열지 말고 W3b-2/product decision으로 ESCALATE. parse 실패 → `portfolio_proposal_parse_failed:<path>`. **positions ⊆ 입력 ticker**는 caller(action)가 검증(스키마는 universe 모름) — 위반 시 `portfolio_proposal_unknown_ticker`.
- **D3 admin action 게이트 순서.** `proposePortfolio({month})`: ① input 검증(month `YYYY-MM-01`, `acceptShortList`/portfolio page와 동일; `YYYY-MM`는 `invalid_month`) ② `createClient` 1회 + `getUser`(없음→`auth_unavailable`, AI cost path dev fallback 금지) ③ `is_admin` RPC(실패/false→`admin_required`) ④ flag `PORTFOLIO_AI_PROPOSAL_ENABLED!=='true'`→`proposal_disabled` ⑤ `ANTHROPIC_API_KEY` 부재→`proposal_disabled`(behavior-neutral) ⑥ `getActiveShortList({ month, client: supabase })` active <30이면 `shortlist_incomplete` ⑦ 요약 빌드 → `callPortfolioProposal({month, shortlistSummary, adminUserId, costClient: supabase})` ⑧ positions ⊆ shortlist ticker 검증 → `{success,data:{proposal}}`. **cost burn = admin+flag+key 3중 게이트 후에만**(flag-off는 prod key 존재해도 call/getActiveShortList 미호출).
- **D4 영속/Accept 무변경.** W3b-1은 proposal을 **반환만** — DB·Accept·snapshot 무변경(money-path 무접촉). W3b-2에서 영속+Accept 통합.
- **D5 dead-code 회피.** client는 admin action이 즉시 소비(live caller 1) — wiring 감사 "no caller" 회피. action은 UI 미연결이나 server action export로 호출 가능(W3b-3 UI 연결 예정, 문서 명시).

## File Structure

**신규:**
- `tudal/src/lib/ai/portfolio-proposal-client.ts` — `callPortfolioProposal` + `PortfolioProposalSchema`/`parsePortfolioProposal` + `PORTFOLIO_PROPOSAL_SYSTEM_PROMPT`/`PORTFOLIO_PROPOSAL_USER_PROMPT` + `renderPortfolioShortlistSummary`.
- `tudal/src/lib/ai/__tests__/portfolio-proposal-client.test.ts`
- `tudal/src/app/(admin)/admin/portfolio/__tests__/propose-portfolio-action.test.ts` (또는 기존 actions.test.ts 확장)

**수정:**
- `tudal/src/app/(admin)/admin/portfolio/actions.ts` — `proposePortfolio` server action 추가.
- `tudal/src/lib/admin/format-error.ts` — 신규 코드 매핑(`proposal_disabled`/`portfolio_proposal_parse_failed`/`portfolio_proposal_unknown_ticker`).
- `tudal/.env.example` — `PORTFOLIO_AI_PROPOSAL_ENABLED`(default off).

**무변경:** 마이그 전부 · admin-approvals(Accept RPC) · admin-snapshots · reader · model-registry(portfolio role 기정의).

---

## Task 0: 착수 가드
- [ ] Step 1: branch `feat/w3b1-portfolio-proposal-client` + main 게이트 1812+2skip 기준 분기.
- [ ] Step 2: `extractJsonObject` export 확인(`tudal/src/lib/screening/persona-panel-adapter.ts`) — 재사용 가능.

## Task 1: portfolio-proposal-client.ts (TDD)

**Files:** Create client + test

- [ ] **Step 1: 실패 테스트** (judge-client.test.ts 패턴)
```typescript
it('PortfolioProposalSchema: weight sum+cash≈1 / cash∈[0,0.30] / distinct ticker / positions min(1) — 위반 throw', () => {});
it('PortfolioProposalSchema: 0종목·현금100%는 current cash cap 위반으로 실패(제품 변경은 ESCALATE)', () => {});
it('parsePortfolioProposal: 펜스/노이즈 JSON 추출 + rationale 200자 truncate', () => {});
it('callPortfolioProposal: resolveRole(portfolio)=opus-4-8 호출 + cost_log(persona_id=portfolio-proposal, prompt_version portfolio@v1, model 실모델)', async () => {});
it('ANTHROPIC_API_KEY 부재 → ai_key_unavailable', async () => {});
it('transient(429/5xx) → ai_call_failed:transient:* / 4xx → ai_call_failed', async () => {});
it('renderPortfolioShortlistSummary: 30개 요약만 사용 + 필드 truncate로 prompt payload bounded', () => {});
it('프롬프트에 종목 요약/month 주입 + placeholder 미잔존', async () => {});
```
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — judge-client.ts 구조 복제. `resolveRole('portfolio')`. schema:
```typescript
const weight = z.number().gt(0).lte(1).finite();
export const PortfolioProposalSchema = z.object({
  positions: z.array(z.object({
    ticker: z.string().regex(/^\d{6}$/),
    weight, timeframe: z.enum(['short','mid','long']),
  })).min(1).max(30),
  cashWeight: z.number().min(0).max(0.30).finite(),
  rationale_kr: z.string().max(200),
}).refine((v) => {
  const sum = v.positions.reduce((s,p)=>s+p.weight,0) + v.cashWeight;
  return sum >= 0.99 && sum <= 1.01;
}, { message: 'weights_sum_invalid' })
  .refine((v) => new Set(v.positions.map(p=>p.ticker)).size === v.positions.length, { message: 'duplicate_ticker' });
export function parsePortfolioProposal(content: string): PortfolioProposal {
  // extractJsonObject → rationale_kr String(...).slice(0,200) → safeParse → throw portfolio_proposal_parse_failed:<path>
}
export async function callPortfolioProposal(input: {
  month: string; shortlistSummary: string; adminUserId: string; costClient?: SupabaseClient;
}): Promise<PortfolioProposal> { /* judge-client 동형 */ }
```
- [ ] **Step 4: 통과 확인 + tsc.**
- [ ] **Step 5: commit** `feat(w3b1): portfolio-proposal-client — callPortfolioProposal(Opus) + PortfolioProposalSchema(weight/cash refine) 파서 (D1/D2, TDD)`

## Task 2: proposePortfolio admin action + format-error (TDD)

**Files:** Modify actions.ts + format-error.ts + test

- [ ] **Step 1: 실패 테스트**
```typescript
it('미인증 → auth_unavailable (is_admin/getActiveShortList/callPortfolioProposal 미호출)', ...);
it('비-admin 또는 is_admin RPC error → admin_required (getActiveShortList/callPortfolioProposal 미호출)', ...);
it('invalid month(YYYY-MM 등) → invalid_month', ...);
it('flag off + ANTHROPIC_API_KEY 존재 → proposal_disabled (getActiveShortList/callPortfolioProposal 미호출)', ...);
it('flag on + ANTHROPIC_API_KEY 부재 → proposal_disabled (getActiveShortList/callPortfolioProposal 미호출)', ...);
it('flag on + key + admin + shortlist 30 → proposal 반환(callPortfolioProposal 1회, getActiveShortList/client+costClient 주입)', ...);
it('shortlist <30 → shortlist_incomplete', ...);
it('proposal positions에 shortlist 밖 ticker → portfolio_proposal_unknown_ticker', ...);
it('format-error: 신규 3종 한국어 매핑 + suffix prefix', ...);
```
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — `proposePortfolio` (regenerateReport/triggerMonthlyBatch 게이트 패턴 + W3a flag/key 패턴). callPortfolioProposal은 module import(테스트는 vi.mock). `getActiveShortList({ month, client: supabase })`의 active 30개를 universe로 삼고 positions ⊆ ticker set 검증. format-error 3종 매핑+prefix.
- [ ] **Step 4: 통과 확인.**
- [ ] **Step 5: commit** `feat(w3b1): proposePortfolio admin action(is_admin+flag+key 게이트, 영속 0) + format-error 3종 (D3/D4, TDD)`

## Task 3: .env.example + 통합 게이트 + DoD
- [ ] Step 1: `.env.example` `PORTFOLIO_AI_PROPOSAL_ENABLED=false` + 주석(ANTHROPIC_API_KEY 동반, flag false면 prod key가 있어도 cost burn 0).
- [ ] Step 2: build+lint+test:ci+tsc ALL GREEN.
- [ ] Step 3: 무변경 확인 — `git diff --stat main -- tudal/supabase/migrations tudal/src/lib/data/admin-approvals.ts tudal/src/lib/data/admin-snapshots.ts` → 0.
- [ ] Step 4: grep — callPortfolioProposal live caller ≥1(proposePortfolio).

## Self-Review 체크
1. **Spec coverage:** Q2 portfolio_proposal(편입/비중/현금 0~30%) AI 판단(Task 1,2) / 어드민 Accept/Reject만(W3b-1은 제안 반환만, Accept 무변경) / W3b-2(영속·Accept)·W3b-3(UI) 분리 명시.
2. **Placeholder scan:** Task 1/2 실코드.
3. **Type consistency:** PortfolioProposal(Task 1 = Task 2 반환). `portfolio` role(model-registry 기정의).
4. **무회귀:** Accept/snapshot/마이그/RPC 무변경 / flag-off=proposal_disabled / cost burn 3중 게이트.

## 검증 게이트 (DoD)
- ALL GREEN + 무변경 diff 0 + callPortfolioProposal live caller ≥1.
- 연결 테스트: action(게이트)→client(mock)→proposal 반환 + schema refine + positions⊆shortlist + flag-off/prod-key no-call.
- 실 AI 0 · cost 0(flag-off + mock). 실 호출 = flag+key+admin USER 게이트.

## Execution Handoff
§2.0a + 사용자 명시: plan ①Claude→②omxy 검토→③omxy direct-edit→④Claude 검증 → impl 동일 → 배선 교차감사(Claude Workflow + omxy blind) → docs-sync(omxy 검증).
