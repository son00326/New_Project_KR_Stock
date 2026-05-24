# PR3c — 4-step Orchestration + sector_reference_backlog + Group G Implementation Plan (v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Changelog**
> - v1 2026-05-24: 초안. baseline = PR3b `commitFullReport` 단일 LLM call (Opus 4.7, max 8192) + `update_report_sections_0_7` RPC. 본 PR3c는 (a) 4-step Karpathy orchestration (document-specialist + analyst + critic + writer) (b) `sector_reference_backlog` DB table (마이그 0023) (c) Group G Sector reference 3-level (Level A 12 sector lazy + Level B 10 sector 첫 보고서 시 + Level C 14/14 완료) 박제 명시. 비용 폭발 위험 → OPEN Q1 옵션 A/B/C에 omxy R1 결정 위임.

**Goal:** PR3b 단일 call이 quality target Kevin v3.1 M1~M8 1656 marker assertions에 미달하는 경우를 차단하기 위해, 풀 리포트 생성 흐름을 **4-step Karpathy 패턴**으로 분해. **critic 6축 self-check** + **conditional revise** 도입으로 quality 보장. 동시에 Level A 12 sector body reference 부족을 **lazy backlog 마이그**로 운영 가시화. PR3c 머지 시 **Group G 해소**. (caller wire = PR4 scope 유지.)

**Architecture (omxy R1 결정 전 — 옵션 B 추천 baseline)**:

```
PR3b 단일 call:
  commitFullReport(input)
    → buildFullReportUserPrompt → callFullReport (1 LLM) → parseAndValidate → RPC UPDATE

PR3c 4-step (옵션 B baseline):
  orchestrateFullReport(input)
    ├ Step 1a document-specialist: PR3c 본 PR scope 밖 (defer; sectorReference 데이터 source 확장은 별도)
    ├ Step 1b analyst (pure code enrichment): input → enrichedInput
    │     · financialsSummary / technicalsSummary / macroSummary가 raw string인 PR3b 대비
    │     · analyst가 sub-fields로 unpack + Kevin v3.1 marker hint 주입
    │     · LLM 호출 0 (pure transform — 비용 0)
    ├ Step 2 writer: PR3b commitFullReport와 동등 LLM call (현존 callFullReport 재사용)
    │     · enrichedInput → buildFullReportUserPrompt → callFullReport (1 LLM)
    │     · parseAndValidate strict
    ├ Step 3 critic (LLM call): callCritic(sections, ctx)
    │     · 신규 LLM call (claude-haiku-4-5, max_tokens 2048)
    │     · 6축 verdict (factuality / logic / completeness / structure / bias / reader-level)
    │     · 각 축 PASS|WARN|FAIL + 1줄 reason
    │     · 비용 ~1/10 of writer (Haiku + 작은 output)
    ├ Step 4 conditional revise: if any axis === FAIL → 1회 revise LLM (Opus, max 4096)
    │     · revise prompt = original sections + critic findings + revise instruction
    │     · revise result → parseAndValidate → RPC UPDATE (replace)
    │     · WARN 4건 이상도 trigger (omxy R1에서 threshold 결정 — Q3)
    └ commit: RPC UPDATE (PR3b 기존 RPC 재사용, schema 변경 0)

  Side effects:
    · cost_log 3 row (writer + critic + optional revise) — persona_id 분리
    · critic findings를 `report_critic_findings` 테이블에 INSERT (마이그 0024 별도 — 또는 PR3c
       scope 안에 마이그 0023 + 0024 동시? — Q4 결정)
    · Level A reference 부재 시 sector_reference_backlog INSERT (마이그 0023)
```

```
Group G Sector reference 3-level (Karpathy 4-step과 분리된 박제 + DB):
  Level A — body reference (실 작성 .md/.html)
    · 보유 = 바이오·반도체 (2/12)
    · 부족 = 12 sectors (lazy)
    · 본 PR: sector_reference_backlog table 마이그 (0023) + auto-INSERT helper +
            관리 admin UI placeholder (UI 자체는 PR4 OR 별도 PR)
  Level B — §9.2 체크리스트
    · 보유 = 바이오·반도체·건설·금융 (4/10)
    · 부족 = 10 sectors (첫 보고서 시 추가) — docs only
  Level C — SECTOR_PHILOSOPHIES
    · 보유 = 14/14 완료 (sector-persona-builder.ts:49-64)
    · 부족 = 0
```

**Tech Stack:**
- LLM: `@anthropic-ai/sdk` (PR3b 기존 의존). Critic = `claude-haiku-4-5-20251001`, Revise = `claude-opus-4-7`.
- Zod schemas: `tudal/src/lib/data/report-section-schemas.ts` (PR3a SoT, 재정의 금지).
- Supabase: 신규 RLS 테이블 `sector_reference_backlog` + `report_critic_findings`. 마이그 패턴 = 0018/0020 (RLS + nullable additive + GIN).
- Cost-hardcap: PR3b의 `preflightHardcap` + `FULL_REPORT_MAX_COST_PER_CALL_KRW` 패턴 follow. critic + revise 비용 합산 새 상수 또는 기존 상수 재calibration (Q5 결정).
- 테스트: Vitest TDD. PR3b 패턴 (테스트 first, 모든 task에 안티-mocking 강제).

---

## OPEN Q1~Q7 — omxy R1 적대적 검토 결정 위임

| Q | 후보 | 추천 baseline (변경 가능) | rationale |
|---|---|---|---|
| **Q1** 4-step scope | (A) 풀 구현 (document-specialist + analyst + critic + writer + revise) / (B) critic + conditional revise + analyst pure-code enrichment / (C) minimal stub + sector_reference_backlog DB만 | **B** | A = 비용 4x + scope 폭발 + document-specialist는 DART/뉴스 API source 의존. C = critic 없이 quality risk 잔존. B = quality + cost 균형. |
| **Q2** critic 6축 호출 구조 | (i) single LLM (6축 통합 JSON 응답) / (ii) 6 LLM call (axis별 병렬) / (iii) hybrid (3+3 grouping) | **(i) single** | 6축은 동일 input(sections)을 다른 lens로 평가 — single call의 cross-axis consistency가 더 신뢰. Haiku 비용도 충분. |
| **Q3** revise trigger threshold | (i) any FAIL=1+ / (ii) any FAIL or WARN≥4 / (iii) FAIL≥2 / (iv) admin manual flag | **(ii)** | (i) FAIL 1건만 triggered면 noise. (iii)는 critical FAIL 단독 누락. (ii)가 quality + cost 균형. |
| **Q4** report_critic_findings 마이그 | 본 PR3c 안 (0024 동시 작성) / PR4로 defer | **본 PR3c 안 (0024)** | critic 출력 persistence가 PR3c quality 추적 핵심. defer 시 critic findings 휘발. |
| **Q5** cost hardcap 조정 | (i) FULL_REPORT_MAX 그대로 + critic/revise 합산 별도 상수 / (ii) FULL_REPORT_MAX 증액 + 동일 상수 사용 / (iii) call count param 활용 (callCount=3) | **(i)** | 명확성 (PR3b 단일 call 비용 invariant 유지) + critic/revise는 별도 estimate가 가능. |
| **Q6** orchestrateFullReport vs commitFullReport | (i) commitFullReport를 wrap (commit → orchestrate) / (ii) commitFullReport replace / (iii) 신규 export `orchestrateFullReport` 추가, commitFullReport 보존 (caller 선택) | **(iii)** | PR3b ↔ PR3c 격리 + rollback 용이 + PR4 caller가 선택 가능. PR3b commit은 fast path으로 남김. |
| **Q7** document-specialist defer 박제 | 본 PR3c에서 stub interface 정의만 / 완전 defer (interface도 PR4 시점) | **stub만 박제** | TypeScript interface 1개 + 빈 implementation으로 미래 source 확장 (DART/뉴스 API) hook 보존. cost·scope 영향 0. |

---

## Out of Scope (PR4 / 별도 PR / 운영 단계 defer)

- **document-specialist real implementation** (DART/뉴스/공시 web research 등 외부 source). PR3c에서 stub interface만 박제. 실 구현은 별도 PR (S7b 뉴스+브리핑 슬라이스 연계 검토 권장).
- **Caller wire** (cron / UI / Regen → orchestrateFullReport 호출). **PR4 scope**. orchestrate vs commit 선택은 caller가 결정. **B18 contract (PR3b acceptance criterion 박제 유지)**: PR4 cron route는 CRON_SECRET env 검증 + 검증 실패 시 401 반환 테스트 필수.
- **Level A 12 sector body reference 실 작성**. 운용 중 lazy 작성 — sector_reference_backlog INSERT가 trigger. PR3c는 backlog table + helper + auto-insert만.
- **Level B 10 sector §9.2 체크리스트 작성**. 첫 보고서 작성 시 docs 추가 — PR3c는 박제만 (ReportFramework §9.2.0 v2.6 patch).
- **report_critic_findings 운영 UI**. PR3c는 table + INSERT helper만. dashboard/리스트 UI는 PR4 또는 별도 PR.
- **reflection_log** (Step 4 후속 — 자가학습 prompt 주입). 별도 PR (D19 박제).
- **section_0~7 NOT NULL 전환**. 운용 안정 후 별도 마이그.
- **Section 8 신규 path**. 이미 PR2~PR3a 완료.
- **service-role DI** (B18 contract per PR3b acceptance criterion). orchestrateFullReport도 PR3b commitFullReport와 동일 SSR session-based createClient() 사용. PR4 cron wire 시 service-role DI 도입 — PR3c는 spec invariant 유지.

---

## File Structure (옵션 B baseline 기준, omxy R1 결정 후 갱신)

- **Create**: `tudal/src/lib/ai/prompts/critic-prompt.ts` — `CRITIC_SYSTEM_PROMPT` + `buildCriticUserPrompt(input)` + `CriticUserPromptInput` + `CRITIC_PROMPT_VERSION` + 6축 verdict JSON contract.
- **Create**: `tudal/src/lib/ai/prompts/__tests__/critic-prompt.test.ts` — 6축 label + verdict JSON shape + Kevin v3.1 marker references + invalid token 0 매치 + plain delimiter 안 JSON example valid.
- **Create**: `tudal/src/lib/ai/critic-client.ts` — Haiku 단일 호출 wrapper + cost_log + `critic_llm_failed` throw + 6축 verdict schema validation.
- **Create**: `tudal/src/lib/ai/__tests__/critic-client.test.ts` — SDK mock + cost_log verify + 6축 shape 검증 + throw 매핑.
- **Create**: `tudal/src/lib/ai/prompts/revise-prompt.ts` — `REVISE_SYSTEM_PROMPT` + `buildReviseUserPrompt(input)` + `ReviseUserPromptInput` + plain delimiter 안 JSON example (Section 0~7 + Appendix shape, PR3b와 동일).
- **Create**: `tudal/src/lib/ai/prompts/__tests__/revise-prompt.test.ts` — Section 0~7 라벨 + critic findings inject + JSON shape.
- **Create**: `tudal/src/lib/ai/revise-client.ts` — Opus 단일 호출 wrapper + cost_log + `revise_llm_failed` throw.
- **Create**: `tudal/src/lib/ai/__tests__/revise-client.test.ts` — SDK mock + cost_log + throw.
- **Create**: `tudal/src/lib/report/analyst.ts` — pure-code enrichment (input → enrichedInput). Kevin v3.1 marker hint 주입. LLM 0.
- **Create**: `tudal/src/lib/report/__tests__/analyst.test.ts` — input 6 fields → enrichedInput shape + marker hint + happy/edge case.
- **Create**: `tudal/src/lib/report/document-specialist.ts` — interface stub만 (real impl PR4+). function signature + JSDoc만 export.
- **Create**: `tudal/src/lib/report/__tests__/document-specialist.test.ts` — stub interface shape pin (regression catch).
- **Create**: `tudal/src/lib/report/critic.ts` — `evaluateReport(sections, ctx)` orchestrator. callCritic + verdict + threshold logic + revise trigger decision.
- **Create**: `tudal/src/lib/report/__tests__/critic.test.ts` — happy / FAIL trigger revise / WARN≥4 trigger / WARN≤3 no revise / critic throw → throw / RLS edge.
- **Create**: `tudal/src/lib/report/full-report-orchestrator.ts` — `orchestrateFullReport(input)` = analyst → writer → critic → conditional revise → critic finding INSERT → RPC UPDATE.
- **Create**: `tudal/src/lib/report/__tests__/full-report-orchestrator.test.ts` — 4-step happy / writer FAIL → throw / critic FAIL → revise → success / revise FAIL → throw / cost_log 2~3 row verify / sector_reference_backlog INSERT 분기 verify.
- **Create**: `tudal/src/lib/data/sector-reference-backlog.ts` — `insertBacklogIfMissing(sector)` + `listBacklog(adminUserId)` + helper.
- **Create**: `tudal/src/lib/data/__tests__/sector-reference-backlog.test.ts` — helper happy + idempotent + RLS edge.
- **Create**: `tudal/src/lib/data/report-critic-findings.ts` — `insertCriticFindings(reportId, findings)` + `listCriticFindings(reportId)`.
- **Create**: `tudal/src/lib/data/__tests__/report-critic-findings.test.ts` — INSERT happy + RLS edge.
- **Create**: `tudal/supabase/migrations/0023_sector_reference_backlog.sql` — table + RLS + GIN + comment + grants.
- **Create**: `tudal/supabase/migrations/0023_sector_reference_backlog.rollback.sql` — DROP TABLE.
- **Create**: `tudal/supabase/migrations/0024_report_critic_findings.sql` — table + RLS + FK to stock_reports + grants.
- **Create**: `tudal/supabase/migrations/0024_report_critic_findings.rollback.sql` — DROP TABLE.
- **Modify**: `tudal/src/lib/admin/format-error.ts` — 신규 8 키 (critic + revise + orchestrate + sector_reference) + 4 prefix handler.
- **Modify**: `tudal/src/lib/admin/__tests__/format-error.test.ts` — 8 신규 키 단언.
- **Modify**: `tudal/src/lib/cost/pricing.ts` — `CRITIC_MAX_COST_PER_CALL_KRW` (Haiku, input 1000 + output 500) + `REVISE_MAX_COST_PER_CALL_KRW` (Opus, input 2000 + output 4000) + `ORCHESTRATE_TOTAL_COST_BUDGET_KRW` (writer + critic + revise 합산 = 약 1.7x FULL_REPORT_MAX).
- **Modify**: `Document/Service/Report/ReportFramework.md §9.2.0` — Level A backlog table 박제 갱신 (v2.7 changelog 추가).

**총 신설 = 18 파일 (8 src + 8 test + 2 migration + 2 rollback) / 수정 = 3 파일.**

---

## Task 1: critic-prompt.ts — 6축 verdict + plain delimiter JSON

**Files:**
- Create: `tudal/src/lib/ai/prompts/critic-prompt.ts`
- Test: `tudal/src/lib/ai/prompts/__tests__/critic-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

테스트 골격 (omxy R1에서 6축 verdict shape 정확성 검증):
- 6축 label substring 포함 ("팩트", "논리", "누락", "구조", "편향", "독자 수준")
- Kevin v3.1 marker hint 포함 ("Kevin v3.1", "M1~M8")
- placeholder token (`0~100`, `<number>`, `<...>`) 0 매치
- ```json fence 금지 + plain delimiter `<<<CRITIC_JSON_EXAMPLE_START>>>` ... `<<<CRITIC_JSON_EXAMPLE_END>>>` 사용
- plain delimiter 안 JSON example valid JSON parse
- `CRITIC_PROMPT_VERSION === 'v1'`
- `buildCriticUserPrompt` 6 fields (ticker / month / sectionsSummary / kevinV31Markers / sectorContext / consensusBadge) 포함

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tudal && npx vitest run src/lib/ai/prompts/__tests__/critic-prompt.test.ts
```
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement prompt module**

`CRITIC_SYSTEM_PROMPT` 6축 verdict 규약 (single LLM Haiku call):
```
당신은 한국 주식 풀 리포트의 적대적 검증자입니다. 6축에서 보고서를 평가하고 JSON 1회 출력합니다.

6축:
1. 팩트 — 수치/날짜/출처 일관성
2. 논리 — 논거 모순/인과 비약
3. 누락 — 필수 섹션·peer 비교·시나리오·리스크 누락
4. 구조 — Section 0~7 + Appendix 프레임워크 준수
5. 편향 — 과도한 낙관/비관, 동일 논거 반복
6. 독자 수준 — 비유·용어 풀이·"이 섹션에서 알 수 있는 것" 가이드

Kevin v3.1 M1~M8 markers (참고):
- M1 4 axes (안정성·수익성·성장성·밸류)
- M2 financial cite · M4 peer 3+ · M5 valuation trial
- M7 일상 비유 · M8 200자 cap

각 축에 대해 verdict (PASS / WARN / FAIL) + 1줄 reason 출력.

JSON 응답:
<<<CRITIC_JSON_EXAMPLE_START>>>
{
  "factuality": {"verdict": "PASS", "reason": "..."},
  "logic": {"verdict": "WARN", "reason": "..."},
  "completeness": {"verdict": "PASS", "reason": "..."},
  "structure": {"verdict": "PASS", "reason": "..."},
  "bias": {"verdict": "PASS", "reason": "..."},
  "reader_level": {"verdict": "WARN", "reason": "..."}
}
<<<CRITIC_JSON_EXAMPLE_END>>>
```

- [ ] **Step 4: Run test → PASS**

---

## Task 2: critic-client.ts — Haiku LLM call + cost_log + 6축 verdict schema

**Files:**
- Create: `tudal/src/lib/ai/critic-client.ts`
- Test: `tudal/src/lib/ai/__tests__/critic-client.test.ts`

상세 (PR3b full-report-client.ts 패턴 follow):
- model = `claude-haiku-4-5-20251001`
- max_tokens = 2048
- system = `CRITIC_SYSTEM_PROMPT`
- user = `buildCriticUserPrompt(input)`
- 응답 → `extractJsonObject` (PR3b 재사용 import) → JSON.parse → zod schema validation (6축 verdict)
- cost_log INSERT (persona_id = `critic`)
- throw `critic_llm_failed:<code>` on error / `critic_parse_failed:no_json_object` on extract fail / `critic_validation_failed:<axis>` on schema fail

zod schema:
```typescript
const verdictSchema = z.object({
  verdict: z.enum(['PASS', 'WARN', 'FAIL']),
  reason: z.string().min(1).max(200), // 200자 cap
});
const criticResultSchema = z.object({
  factuality: verdictSchema,
  logic: verdictSchema,
  completeness: verdictSchema,
  structure: verdictSchema,
  bias: verdictSchema,
  reader_level: verdictSchema,
});
```

테스트: SDK mock (Anthropic) + happy / parse fail / validation fail (verdict invalid) / cost_log INSERT param verify / throw 매핑.

---

## Task 3: revise-prompt.ts + revise-client.ts — Opus single-call

**Files:**
- Create: `tudal/src/lib/ai/prompts/revise-prompt.ts` + test
- Create: `tudal/src/lib/ai/revise-client.ts` + test

prompt 구조:
- input = `{ originalSections, criticFindings, ticker, month }`
- 원본 sections JSON + 6축 verdict findings (WARN/FAIL만) inject
- 출력 = revised Section 0~7 + Appendix (PR3b shape 동일 — `parseAndValidate` 호환)
- plain delimiter `<<<REVISE_JSON_EXAMPLE_START>>>` 사용

client:
- model = `claude-opus-4-7`
- max_tokens = 4096 (PR3b의 절반 — revise는 부분 변경 위주)
- cost_log persona_id = `revise`

---

## Task 4: analyst.ts (pure-code enrichment, LLM 0)

**Files:**
- Create: `tudal/src/lib/report/analyst.ts`
- Test: `tudal/src/lib/report/__tests__/analyst.test.ts`

`enrichInput(input: FullReportUserPromptInput): EnrichedFullReportInput`:
- input의 raw summary strings를 sub-fields로 unpack 시도 (정규식·키워드 추출)
- Kevin v3.1 M1~M8 marker hint를 system prompt context로 부착 가능한 형태로 변환
- enrichedInput은 기존 input 모든 필드 보존 + 신규 optional fields 추가 (writer prompt가 enriched fields 사용 가능)

LLM 호출 0. pure transform 함수. 비용 0.

---

## Task 5: critic.ts orchestrator (callCritic + verdict + threshold)

**Files:**
- Create: `tudal/src/lib/report/critic.ts`
- Test: `tudal/src/lib/report/__tests__/critic.test.ts`

`evaluateReport(sections, ctx): Promise<CriticResult>`:
- callCritic (LLM)
- verdict 6축 → revise trigger decision (Q3 threshold)
- `{ verdict: criticResult, shouldRevise: boolean, failCount: number, warnCount: number }`

테스트: 모든 PASS → noRevise / FAIL 1건 → revise / WARN 4건 → revise / WARN 3건 → noRevise / critic throw → throw.

---

## Task 6: document-specialist.ts (stub interface)

**Files:**
- Create: `tudal/src/lib/report/document-specialist.ts`
- Test: `tudal/src/lib/report/__tests__/document-specialist.test.ts`

```typescript
export interface DocumentSpecialistResult {
  webResearch?: string;
  externalCitations: Array<{ source: string; url?: string }>;
  marketDataSnapshots?: Record<string, unknown>;
}

/**
 * Phase 1a — Web research + external source aggregation.
 *
 * PR3c에서는 stub만 박제. real implementation은 PR4+ (DART/뉴스/공시 source 통합).
 * 본 stub은 input을 그대로 통과시키며 빈 결과 반환.
 */
export async function researchDocument(input: { ticker: string; sector: string }): Promise<DocumentSpecialistResult> {
  return { externalCitations: [] };
}
```

테스트: stub interface shape pin + 빈 결과 반환 단언 (regression catch).

---

## Task 7: full-report-orchestrator.ts — 4-step Karpathy

**Files:**
- Create: `tudal/src/lib/report/full-report-orchestrator.ts`
- Test: `tudal/src/lib/report/__tests__/full-report-orchestrator.test.ts`

`orchestrateFullReport(input)`:

```typescript
export async function orchestrateFullReport(
  input: CommitFullReportInput,
): Promise<OrchestrateFullReportResult> {
  // Q5 cost-hardcap preflight: 합산 budget (writer + critic + revise) 사전 check.
  await preflightHardcap({
    month: input.month,
    callCount: 1,
    maxCostPerCallKrw: ORCHESTRATE_TOTAL_COST_BUDGET_KRW,
  });

  // Step 1a document-specialist stub (PR3c는 통과 — 비용 0)
  const research = await researchDocument({ ticker: input.ticker, sector: input.sector });

  // Step 1b analyst pure-code enrichment (비용 0)
  const enriched = enrichInput(input);

  // Step 2 writer (PR3b 패턴 재사용 — callFullReport)
  const userPrompt = buildFullReportUserPrompt({ ...enriched, sectorReference: input.sectorReference });
  const writerLlm = await callFullReport({ ticker, month, systemPrompt, userPrompt, adminUserId });
  const sections = parseAndValidate(writerLlm.content, { ticker, month });

  // Step 3 critic (Haiku LLM)
  const critic = await evaluateReport(sections, { ticker, month });

  // Step 4 conditional revise (Opus LLM, 1회만)
  let finalSections = sections;
  let reviseCostKrw = 0;
  if (critic.shouldRevise) {
    const reviseLlm = await callRevise({ originalSections: sections, criticFindings: critic.verdict, ticker, month, adminUserId });
    finalSections = parseAndValidate(reviseLlm.content, { ticker, month });
    reviseCostKrw = reviseLlm.costKrw;
  }

  // Persistence: stock_reports UPDATE (PR3b RPC 재사용) + critic findings INSERT + sector backlog 분기
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('update_report_sections_0_7', {
    p_ticker, p_month, p_section_0: finalSections.section_0, ..., p_appendix: finalSections.appendix,
  });
  if (error) throw mapRpcError(error);

  await insertCriticFindings(data.report_id, critic.verdict);

  // Level A reference 부재 시 sector_reference_backlog INSERT (idempotent)
  await insertBacklogIfMissing(input.sector);

  return {
    reportId: data.report_id,
    costKrw: writerLlm.costKrw + critic.costKrw + reviseCostKrw,
    revised: critic.shouldRevise,
    criticVerdict: critic.verdict,
  };
}
```

테스트 6개 (happy / writer fail / critic FAIL → revise → success / revise FAIL → throw / cost_log row count 2 or 3 verify / sector_reference_backlog INSERT 분기 verify).

---

## Task 8: sector_reference_backlog 마이그 0023

**Files:**
- Create: `tudal/supabase/migrations/0023_sector_reference_backlog.sql` + rollback
- Create: `tudal/src/lib/data/sector-reference-backlog.ts` + test

마이그 SQL (0018/0020 패턴 follow):

```sql
-- 0023_sector_reference_backlog.sql
-- 마이그 SoT: docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md
-- Group G — Level A 12 sector body reference 부족 lazy 추적.

create table public.sector_reference_backlog (
  id uuid primary key default gen_random_uuid(),
  sector text not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'archived')),
  first_requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count >= 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sector_reference_backlog_sector_unique unique (sector)
);

create index sector_reference_backlog_status_idx on public.sector_reference_backlog(status);

alter table public.sector_reference_backlog enable row level security;

-- admin only — public/anon = false, authenticated/service_role = true
revoke all on public.sector_reference_backlog from public;
revoke all on public.sector_reference_backlog from anon;

create policy "admin select" on public.sector_reference_backlog
  for select using (public.is_admin());
create policy "admin insert" on public.sector_reference_backlog
  for insert with check (public.is_admin() or (select auth.role()) = 'service_role');
create policy "admin update" on public.sector_reference_backlog
  for update using (public.is_admin() or (select auth.role()) = 'service_role');

comment on table public.sector_reference_backlog is
  'Level A sector body reference 부족 lazy 추적 (Group G). 첫 풀 리포트 작성 시 idempotent INSERT.';
```

helper:
```typescript
export async function insertBacklogIfMissing(sector: string): Promise<void> {
  const supabase = await createClient();
  // upsert with on conflict — sector unique constraint
  const { error } = await supabase
    .from('sector_reference_backlog')
    .upsert(
      { sector, last_requested_at: new Date().toISOString(), request_count: 1 },
      { onConflict: 'sector' },
    );
  if (error) throw new Error(`sector_reference_backlog_insert_failed:${error.code ?? 'unknown'}`);
}
```

테스트: helper happy + idempotent (같은 sector 2회 INSERT 시 1 row + request_count 증가는 별도 helper로) + RLS edge.

---

## Task 9: report_critic_findings 마이그 0024

**Files:**
- Create: `tudal/supabase/migrations/0024_report_critic_findings.sql` + rollback
- Create: `tudal/src/lib/data/report-critic-findings.ts` + test

마이그 SQL:

```sql
-- 0024_report_critic_findings.sql
create table public.report_critic_findings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.stock_reports(id) on delete cascade,
  axis text not null check (axis in ('factuality', 'logic', 'completeness', 'structure', 'bias', 'reader_level')),
  verdict text not null check (verdict in ('PASS', 'WARN', 'FAIL')),
  reason text not null,
  created_at timestamptz not null default now()
);

create index report_critic_findings_report_id_idx on public.report_critic_findings(report_id);
create index report_critic_findings_verdict_idx on public.report_critic_findings(verdict)
  where verdict in ('WARN', 'FAIL');

alter table public.report_critic_findings enable row level security;
revoke all on public.report_critic_findings from public;
revoke all on public.report_critic_findings from anon;

create policy "admin select" on public.report_critic_findings
  for select using (public.is_admin());
create policy "admin insert" on public.report_critic_findings
  for insert with check (public.is_admin() or (select auth.role()) = 'service_role');

comment on table public.report_critic_findings is
  'PR3c critic 6축 verdict persistence. orchestrateFullReport이 매 호출 시 INSERT.';
```

helper:
```typescript
export async function insertCriticFindings(reportId: string, verdict: CriticVerdict): Promise<void> {
  const supabase = await createClient();
  const rows = (Object.entries(verdict) as Array<[string, { verdict: string; reason: string }]>)
    .map(([axis, v]) => ({ report_id: reportId, axis, verdict: v.verdict, reason: v.reason }));
  const { error } = await supabase.from('report_critic_findings').insert(rows);
  if (error) throw new Error(`report_critic_findings_insert_failed:${error.code ?? 'unknown'}`);
}
```

---

## Task 10: format-error.ts + pricing.ts + ReportFramework.md §9.2.0

**Files:**
- Modify: `tudal/src/lib/admin/format-error.ts` (+ test) — 8 신규 키 + 4 prefix
- Modify: `tudal/src/lib/cost/pricing.ts` — CRITIC_MAX_COST_PER_CALL_KRW + REVISE_MAX_COST_PER_CALL_KRW + ORCHESTRATE_TOTAL_COST_BUDGET_KRW
- Modify: `Document/Service/Report/ReportFramework.md §9.2.0` — Level A backlog table 갱신 + v2.7 changelog 추가

format-error 신규 키:
- `critic_llm_failed` / `critic_parse_failed:no_json_object` / `critic_validation_failed:<axis>`
- `revise_llm_failed` / `revise_parse_failed:no_json_object`
- `orchestrate_failed:<phase>` (phase ∈ writer/critic/revise/persist)
- `sector_reference_backlog_insert_failed`
- `report_critic_findings_insert_failed`

prefix:
- `critic_*` → "검증 단계가 실패했습니다."
- `revise_*` → "재작성 단계가 실패했습니다."
- `orchestrate_*` → "보고서 생성 흐름이 실패했습니다."
- `sector_reference_*` / `report_critic_findings_*` → "내부 추적 저장이 실패했습니다."

pricing.ts:
```typescript
// PR3c critic call (Haiku, 비용 ~1/10 of writer)
export const CRITIC_MAX_COST_PER_CALL_KRW = 5000;

// PR3c revise call (Opus, max_tokens 4096 = 절반)
export const REVISE_MAX_COST_PER_CALL_KRW = 18000; // = FULL_REPORT_MAX의 50%

// PR3c orchestrate total budget (writer + critic + revise 합산)
export const ORCHESTRATE_TOTAL_COST_BUDGET_KRW = 
  FULL_REPORT_MAX_COST_PER_CALL_KRW + CRITIC_MAX_COST_PER_CALL_KRW + REVISE_MAX_COST_PER_CALL_KRW;
// 약 1.7x FULL_REPORT_MAX (revise는 항상 발생 X — worst case 박제).
```

ReportFramework §9.2.0 v2.7 changelog:
```markdown
| 2026-05-24 | **v2.7** | **55차 §4 — PR3c 4-step orchestration + sector_reference_backlog 마이그 박제.** Group G ✅ 해소.
  Level A 12 sector body reference 부족 → `sector_reference_backlog` table (마이그 0023) lazy 추적. 첫 보고서 작성 시 idempotent INSERT. 
  Level B 10 sector 체크리스트는 첫 보고서 시 docs 추가 (본 §9.2.1에 sector별 추가).
  Level C `SECTOR_PHILOSOPHIES` 14/14 완료 유지. ... |
```

---

## Cost Analysis (Q5 baseline)

- PR3b 단일 call (writer Opus, max 8192) = 약 `FULL_REPORT_MAX_COST_PER_CALL_KRW` (input 3000 + output 6000)
- PR3c critic call (Haiku, max 2048) ≈ `CRITIC_MAX_COST_PER_CALL_KRW` ~5,000원 (보수적 estimate)
- PR3c revise call (Opus, max 4096) — conditional ≈ `REVISE_MAX_COST_PER_CALL_KRW` ~18,000원 (worst case)
- Total per ticker (worst case) ≈ `ORCHESTRATE_TOTAL_COST_BUDGET_KRW` ~1.7x FULL_REPORT_MAX
- Per month (30 tickers, all revise): 30 × 1.7x = 51x FULL_REPORT_MAX per call
- 평균 revise trigger ratio 가정 30% → 30 × (writer 1x + critic 0.1x + 0.3 × revise 0.5x) ≈ 30 × 1.25x

M17 hardcap 400,000 KRW/월 내 통제 가능 (PR3b assumption 동일 invariant — production validation 후 calibration).

---

## Migration Plan (production apply 순서)

```bash
# CLAUDE local verify (worktree)
cd tudal && npx supabase db push --dry-run    # 0023 + 0024 SQL syntax verify

# CLAUDE TDD + omxy R1~Rn CONVERGED 후
git push origin feat/pr3c-orchestration-sector-reference
gh pr create ...

# USER merge 후
# USER apply 0023 + 0024 via MCP apply_migration (2 migration 순서 보존: 0023 → 0024)
# USER canary 4 페이지 verify (/ /login /macro /admin)
# CLAUDE post-merge docs commit (HANDOFF/ProgressDashboard)
```

---

## Rollback Plan

- Code revert: `git revert --no-edit OLD_MAIN..AFTER_PR3C` (모든 commit replay)
- Migration rollback: 0024 → 0023 순서 (FK 의존 역순)
- downstream 의존: 0 (PR3c는 PR4 caller wire 전이라 production 사용 0)
- production cron 영향: 0 (PR1 cron은 commitFullReport 단일 call 유지 — orchestrateFullReport는 PR4 caller wire 시점에 선택적 도입)

---

## Verification Gates (8종)

1. `npm run build` — 25 routes intact
2. `npm run lint` — 0 err
3. `npm run test:ci` — 917 → ~970+ (+50~60 신규)
4. `npx tsc --noEmit` — clean
5. **grep gate**: critic-prompt에 ```json fence 0 매치 + placeholder token 0 매치
6. **grep gate**: revise-prompt에 ```json fence 0 매치
7. **grep gate**: orchestrator에서 commitFullReport 직접 import 0 (re-implements writer step)
8. **grep gate**: 0023/0024 마이그에 `grant select to anon` 0 매치 (RLS 4-grant 패턴 강제)

---

## omxy R1 적대적 검토 요청 (CONVERGED 조건)

OMXY 검토자는 다음 6 항목을 적대적으로 검증:

1. **Q1~Q7 옵션 결정**: 옵션 B baseline이 비용/quality/scope 균형에 적절한가? 옵션 A/C로 변경 시 trade-off?
2. **Cost-hardcap calibration**: CRITIC + REVISE + ORCHESTRATE 상수 값이 보수적 적절한가? Haiku/Opus 가격표 실제 vs estimate?
3. **schema 마이그 (0023/0024)**: RLS 4-grant + index + FK + check constraint이 0018/0020/0021 패턴 정합? sector unique constraint가 race condition (concurrent INSERT 시 PK conflict)에 안전한가?
4. **critic 6축 verdict schema robustness**: enum PASS|WARN|FAIL이 LLM의 freeform output에 강한가? reason 200자 cap이 zod validation drop 위험?
5. **revise prompt design**: original sections JSON inject 시 prompt가 8192 token 초과 위험? max_tokens 4096이 충분?
6. **orchestrateFullReport vs commitFullReport coexistence**: PR4 caller가 어느 것을 선택할지 분명한가? naming convention (orchestrate vs commit)이 직관적인가? PR4 cron path가 critic 비용 감내 가능?

추가 SCOPE GUARD (재해석 금지):
- 사용자 lock-in (spec doc §1 8 항목)
- 본 PR3c scope 외 (PR4 / 별도 PR로 분리)
- DQ-7 / S8 / 멤버 페이지

---

## Out of Scope (재확인)

- PR4 (UI trigger + caller wire + Track Record 탭 + Regen 실 호출 + B18 CRON_SECRET 401 test)
- document-specialist real implementation (DART/뉴스 source)
- Level A 12 sector body reference 실 작성
- Level B 10 sector §9.2 체크리스트 작성 (첫 보고서 시 docs 추가)
- reflection_log (Step 4 후속)
- section_0~7 NOT NULL 전환
- Section 8 신규 path (이미 PR2~PR3a 완료)
- service-role DI (PR4 cron wire 시점)

---

**End of Plan v1 — omxy R1 적대적 검토 대기**
