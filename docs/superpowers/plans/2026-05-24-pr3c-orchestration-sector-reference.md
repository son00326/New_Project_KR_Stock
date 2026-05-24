# PR3c — 3-step Orchestration + sector_reference_backlog + Group G Implementation Plan (v6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Changelog**
> - **v6 (omxy R5 2 BLOCKERS catch · 누적 21 BLOCKERS · CONVERGED-track)** 2026-05-24:
>   - **B20 P1 fix** — backlog auto-insert "Level A 부재" guard. 사용자 lock-in §1.7: Level A 보유 = 바이오·반도체 (2/12), 부족 = 12 sectors (lazy). 현 plan은 무조건 호출하여 보유 2도 backlog 오염. 수정: `sector-reference-backlog.ts`에 `LEVEL_A_SECTORS_WITH_BODY = new Set(['바이오', '반도체'])` + `hasLevelABodyReference(sector): boolean` helper. `insertOrBumpBacklog(sector)`이 `if (hasLevelABodyReference(trimmed)) return;` early return. contract test: 바이오/반도체 호출 시 RPC mock 미호출 단언 + "missing 12 = canonical 14 - level A 2" drift test.
>   - **B21 P1 fix** — persistence side-effect failure semantics 명시. orchestrateFullReport 순서: (1) report UPDATE → (2) critic findings INSERT (**blocking throw** — PR3c quality audit 핵심) → (3) backlog INSERT-or-BUMP (**non-blocking warn** — 운영 추적 부가 효과). backlog 실패 시 console.warn + orchestrator는 성공 반환 (보고서 commit + critic findings + criticRunId 모두 정상). test: backlog INSERT throw → orchestrator 성공 + console.warn 호출 verify.
>   - **(l) fix 박제**: nested DECLARE는 PostgreSQL PL/pgSQL 정합하나 outer declare 권장 (P2). `insert_or_bump_sector_backlog` RPC body의 `declare v_sector text` 블록 → outer declare로 평탄화.
> - **v5 (omxy R4 3 BLOCKERS catch · 누적 19 BLOCKERS · CONVERGED-track)** 2026-05-24:
>   - **B17 P1 fix** — `orchestrateFullReport` runId wire 누락. `const { runId } = await insertCriticFindingsRun(...)` + `OrchestrateFullReportResult`에 `criticRunId: string` 추가. test 7개에 runId 반환 단언 + `getCriticFindingsByRunId(reportId, criticRunId)` 후속 호출 검증.
>   - **B18 P1 fix** — sector canonical guard DB invariant (옵션 c 양쪽 + table CHECK):
>     1. **helper level** (v4 이미 적용): `isCanonicalSector(trimmed)` check
>     2. **RPC SQL level (신규)**: `insert_or_bump_sector_backlog`이 `p_sector := trim(p_sector)` + `canonical 14 check` (배열 IN literal). non-canonical → `raise 'invalid_sector_not_canonical'`
>     3. **table CHECK (신규)**: `sector_reference_backlog.sector` 컬럼에 `CHECK (sector IN ('바이오','반도체',...))` constraint
>     4. **contract test (신규)**: TS `CANONICAL_SECTORS` 배열과 SQL `IN (...)` literal 14개 element exact match drift catch
>   - **B19 P1 fix** — pre-revise critic findings 명명 명확화. `report_critic_findings.target_stage text not null check (target_stage in ('writer_draft','revised'))` 컬럼 추가. PR3c orchestrator는 항상 `target_stage='writer_draft'` INSERT (1회 hard cap이라 'revised' stage critic은 PR3c scope 외 — 미래 별도 PR). 마이그 0024 + RPC + helper signature + contract test 모두 갱신.
>   - **(i) fix**: analyst.test snapshot pattern → **explicit shape assertions** (omxy R4 권장).
>   - **(j) fix**: critic-client.ts에 PR3b CR-3 패턴 follow (Anthropic SDK error catch + structured `console.warn` capture + 'critic_llm_failed' throw). 429 vs 5xx 세분화는 P2 OK.
>   - **(k) fix 박제**: critic는 PASS/no-revise에도 항상 INSERT (현 plan 정합) + target_stage 명명 (B19) 으로 명확화.
> - **v4 (omxy R3 3 BLOCKERS catch · 누적 16 BLOCKERS · CONVERGED-track)** 2026-05-24:
>   - **B14 P1 fix** — model/pricing key drift 차단. `CRITIC_API_MODEL` (actual Anthropic API ID, `claude-haiku-4-5-20251001`) + `CRITIC_PRICING_KEY` (ANTHROPIC_PRICING 키, `claude-haiku-4-5`) 두 상수 명시적 분리. critic-client.ts가 API call 시 `CRITIC_API_MODEL` 사용 / pricing.ts에서 `calculateCostKrw` 호출 시 `CRITIC_PRICING_KEY` 사용. **invariant test**: pricing.ts test에 `CRITIC_PRICING_KEY in ANTHROPIC_PRICING` 단언 + critic-client test에 API call MODEL 단언. **Verification gate 16 (positive — B14 invariant)**: `if (!('claude-haiku-4-5' in ANTHROPIC_PRICING)) throw` 매치 + pricing.ts 신규 상수 `CRITIC_PRICING_KEY` declare 매치.
>   - **B15 P1 fix** — Q5 결정표 rationale stale (revise≈257 / total≈498 → revise≈271 / total≈512). omxy R1 CONVERGED 결정 테이블에서 v3 v_caller 보수화 반영 (revise 8000 input × 5 + 6000 output × 25 / 1M × 1430 = 271원, total = 236+5+271 = 512원).
>   - **B16 P2 fix** — sector canonical guard 추가. `insertOrBumpBacklog(sector)` helper에서 canonical 14 검증 (`isCanonicalSector` import) + trim. invalid sector 시 throw `sector_reference_backlog_invalid_sector`. RPC contract test에 invalid sector ("비-canonical", trailing whitespace) 시 throw 검증.
> - **v3 (omxy R2 4 BLOCKERS catch · 누적 13 BLOCKERS · CONVERGED-track)** 2026-05-24:
>   - **B10 P1 fix** — RPC service_role guard 모순. `if auth.uid() is null then raise 'auth_unavailable'` 첫 줄이 service_role 호출 차단 (service_role은 auth.uid() null). 수정 패턴 (0021 acquire_batch_lock_v2 follow): `v_caller_role := auth.role()` declare → `if auth.uid() is null and coalesce(v_caller_role,'') <> 'service_role' then raise 'auth_unavailable'`. 2 RPC 모두 (`insert_or_bump_sector_backlog` + `insert_critic_findings_run`) 동일 fix.
>   - **B11 P1 fix** — REVISE_MAX input 6000 추정 → **8000으로 보수화** (P0 snapshot gate는 PR4 fixture 시점에 추가). cost 재계산: input 8000 + output 6000 = (8000 × 5 + 6000 × 25) / 1M × 1430 ≈ 271원. ORCHESTRATE_TOTAL = 236 + 5 + 271 = 512원.
>   - **B12 P2 fix** — `getCriticFindingsByRunId(reportId, runId)` helper 추가 — orchestrateFullReport이 반환한 latest run_id로 strict 6 row 조회. listLatestRunCriticFindings는 "다른 admin이 본 latest"용으로 보존 (mixed-run 안전).
>   - **B13 P2 fix** — Verification Gate에 **positive grant 검증** 추가 (negative gate `grant.*to anon 0`에 더해서 `grant execute on function .* to authenticated;` + `grant execute on function .* to service_role;` 각 1+ 매치 검증).
>   - **(d) P2 fix** — cost_log persona_id + **prompt_version 분리 박제** (cost_log filter UI 가능). critic = `prompt_version='critic-v1'` + persona_id='critic'. revise = `prompt_version='revise-v1'` + persona_id='revise'. writer 기존 `prompt_version='v1'` + persona_id='full_report_writer' 유지.
>   - **PR4 acceptance 박제 강화** — PR4 plan에 (a) grep gate "cron route에서 commitFullReport import 매치 + orchestrateFullReport import 0" (b) "admin trigger UI에서 orchestrateFullReport import 매치 + commitFullReport import 0" (c) cost_log 분리 필터 동작 e2e test — 3 gate 박제 필수.
> - **v2 (omxy R1 9 BLOCKERS catch · CONVERGED-track)** 2026-05-24:
>   - **B1 P0 fix** — cost-hardcap calibration 자릿수 ERROR (5000/18000 KRW magic constant) → pricing.ts `calculateCostKrw` 통과 (현재 단가 기준 critic ≈ 5원 · revise ≈ 257원 · full report ≈ 236원). plan §Cost Analysis 재작성.
>   - **B2 P0 fix** — sector_reference_backlog upsert race-safety → 0023에 RPC `insert_or_bump_sector_backlog` atomic 추가 (`SECURITY DEFINER` + 4-grant + `INSERT ... ON CONFLICT (sector) DO UPDATE SET request_count = sector_reference_backlog.request_count + 1, last_requested_at = now()`). supabase JS client direct upsert 폐기.
>   - **B3 P0 fix** — revise prompt max_tokens 4096 → 8192 (PR3b writer 동일 박제). REVISE_MAX cost 재계산 input 6000 + output 6000 = ~257원.
>   - **Q1·Q7 fix** — document-specialist 완전 defer (file·stub interface·test 모두 제거). 4-step → **3-step (analyst pure-code → writer → critic) + conditional revise**. plan title update.
>   - **B6 P1 fix** — 0024 `report_critic_findings`에 `run_id uuid` + 매 INSERT 시 신규 run_id 발급. listLatestRunCriticFindings는 latest 6 row만 반환.
>   - **B7 P1 fix** — critic verdict reason 200자 cap → 500자 (한국어 LLM trunc/drop 방지). zod `z.string().min(1).max(500)`.
>   - **B8 P1 fix** — PR4 acceptance criterion 박제 보강: PR4 caller가 (a) cron 자동 = commitFullReport (writer-only, fast path) (b) admin manual trigger = orchestrateFullReport (3-step + critic + conditional revise, quality path) 선택 기준 명시.
>   - **B9 P1 fix** — analyst pure-code enrichment quality claim 어휘 약화. "marker injection으로 quality lift" 주장 제거 → shape transform pure test만 (production validation 위임).
>   - **scope guard violations fix** — "관리 admin UI placeholder" 언급 제거 / "document-specialist real implementation" reference 제거 / "Karpathy 4-step" 어휘 → "3-step + conditional revise" 일관 통일.
> - v1 2026-05-24: 초안. document-specialist + analyst + critic + writer 4-step Karpathy. omxy R1에서 P0 4건 + P1 5건 catch.

**Goal:** PR3b 단일 call (`commitFullReport` — Opus 4.7, max 8192)이 Kevin v3.1 M1~M8 1656 marker assertions에 미달하는 경우를 차단하기 위해, 풀 리포트 생성 흐름을 **3-step orchestrator (analyst pure-code → writer → critic) + conditional revise**로 분해. critic 6축 self-check + conditional revise 1회 hard cap. 동시에 Level A 12 sector body reference 부족을 **atomic RPC** 기반 lazy backlog 마이그로 운영 가시화. PR3c 머지 시 **Group G 해소**. (caller wire = PR4 scope 유지.)

**Architecture (omxy R1 CONVERGED 후 옵션 B 확정):**

```
PR3b 단일 call (fast path, 보존):
  commitFullReport(input)
    → buildFullReportUserPrompt → callFullReport (Opus 4.7 max 8192) → parseAndValidate → RPC update_report_sections_0_7

PR3c 3-step + conditional revise (quality path, 신규):
  orchestrateFullReport(input)
    ├ Step 1 analyst (pure code, LLM 0): enrichInput(input) → enrichedInput
    │     · input.financialsSummary / technicalsSummary / macroSummary를 sub-fields로 unpack
    │     · LLM 호출 0, 비용 0
    │     · ✱ 테스트는 shape transform pure verification만 (quality lift는 production validation 위임 — omxy R1 B9 fix)
    ├ Step 2 writer (Opus 4.7 LLM, PR3b callFullReport 재사용): enrichedInput → sections
    ├ Step 3 critic (Haiku 4.5 LLM, single-call 6축): evaluateReport(sections, ctx)
    │     · 6축 verdict (factuality / logic / completeness / structure / bias / reader_level)
    │     · 각 축 PASS|WARN|FAIL + reason (max 500자, 한국어 trunc 방지)
    │     · 비용 ~5원 (Haiku input 1000 + output 500)
    └ Step 4 conditional revise (Opus 4.7 LLM, max 8192 — omxy R1 B3 fix): if any FAIL OR WARN≥4
          · revise prompt = original sections + critic findings (WARN/FAIL만) inject + max_tokens 8192 (full rewrite tolerate)
          · revised sections → parseAndValidate → 최종본 (1회 hard cap, recursive revise 금지)

  Persistence:
    · RPC update_report_sections_0_7 UPDATE (PR3b RPC 재사용, schema 변경 0)
    · RPC insert_critic_findings_run (마이그 0024 신규) — run_id 발급 + 6 row INSERT atomic
    · RPC insert_or_bump_sector_backlog (마이그 0023 신규) — atomic INSERT or UPDATE request_count++

  Cost-hardcap:
    · preflightHardcap (PR3b 패턴) — ORCHESTRATE_TOTAL_COST_BUDGET_KRW = full + critic + revise 합산 (worst case)
    · ✱ calculateCostKrw 통과한 상수만 사용 (omxy R1 B1 fix — magic number 박제 금지)
```

```
Group G Sector reference 3-level 박제:
  Level A — body reference (실 작성 .md/.html)
    · 보유 = 바이오·반도체 (2/12)
    · 부족 = 12 sectors (lazy)
    · 본 PR: sector_reference_backlog table (마이그 0023) + atomic RPC `insert_or_bump_sector_backlog` +
            helper. UI는 PR4 또는 별도 PR scope (본 PR3c에서 admin UI 0).
  Level B — §9.2 체크리스트
    · 보유 = 바이오·반도체·건설·금융 (4/10)
    · 부족 = 10 sectors (첫 보고서 시 추가) — docs only
  Level C — SECTOR_PHILOSOPHIES
    · 보유 = 14/14 완료 (sector-persona-builder.ts:49-64)
    · 부족 = 0
```

**Tech Stack:**
- LLM: `@anthropic-ai/sdk` (PR3b 기존 의존). Critic = `claude-haiku-4-5-20251001`, Writer/Revise = `claude-opus-4-7`.
- Zod schemas: `tudal/src/lib/data/report-section-schemas.ts` (PR3a SoT, 재정의 금지).
- Supabase: 신규 RLS 테이블 `sector_reference_backlog` + `report_critic_findings`. 마이그 패턴 = 0017/0021 (SECURITY DEFINER + 4-grant + atomic RPC).
- Cost-hardcap: PR3b의 `preflightHardcap` + `FULL_REPORT_MAX_COST_PER_CALL_KRW` 패턴 follow. critic + revise + writer 합산 새 상수 `ORCHESTRATE_TOTAL_COST_BUDGET_KRW` 신설, **모두 `calculateCostKrw` 통과**.
- 테스트: Vitest TDD. PR3b 패턴 (테스트 first, mocking 최소화).

---

## omxy R1 CONVERGED 결정 (Q1~Q7 final)

| Q | omxy R1 결정 | rationale |
|---|---|---|
| **Q1** 4-step scope | **B (수정) — critic + conditional revise + analyst pure-code only**. document-specialist 제거. | B + Q7 fix. document-specialist는 4-step 명칭에서 빼라. |
| **Q2** critic 6축 호출 | **(i) single LLM** — 통합 JSON | axis별 병렬은 비용/일관성 손해. |
| **Q3** revise trigger threshold | **(ii) any FAIL or WARN≥4** + revise **1회 hard cap** (recursive revise 금지) | quality + cost 균형. |
| **Q4** report_critic_findings 마이그 | **본 PR3c 안 (0024)** — 단 `run_id` 컬럼 + INSERT 매번 new run_id 발급 | findings 중복 누적 차단. |
| **Q5** cost hardcap 조정 | **(i) 별도 상수** — CRITIC + REVISE + ORCHESTRATE 합산. 단, **`calculateCostKrw` 통과 필수** (magic number 5000/18000 금지). | 현재 단가 기준 critic ≈ 5원 / revise ≈ 271원 (v3 B11 input 6000→8000 보수화) / full ≈ 236원 / total ≈ 512원/worst case. |
| **Q6** orchestrateFullReport vs commitFullReport | **(iii) 신규 export 추가, commitFullReport 보존** | PR4 caller 선택. |
| **Q7** document-specialist | **완전 defer** — stub/test도 fake quality·scope creep. 필요하면 type-only comment로 박제. | scope guard. |

---

## Out of Scope (PR4 / 별도 PR / 운영 단계 defer)

- **document-specialist module** — 본 PR3c에서 file·stub interface·test 모두 0. 미래 외부 source (DART/뉴스/공시 web research) 통합은 별도 PR (S7b 뉴스+브리핑 슬라이스 연계 검토 권장). 필요하면 future PR에서 도입 시 plan에 신규 spec 박제.
- **Caller wire** (cron / UI / Regen → orchestrateFullReport 호출). **PR4 scope**.
  - **PR4 acceptance criterion 박제 (B8 fix · omxy R2 강화)**: PR4 caller는 (a) **cron 자동 path** = `commitFullReport` 단일 call (fast path, 비용 최소화) (b) **admin manual trigger path** = `orchestrateFullReport` (3-step + critic + conditional revise, quality 보장) 선택 명시. cron이 critic/revise 비용을 매번 burning하지 않도록 cron path는 commit 사용. admin이 quality 필요 시 orchestrate 사용. **PR4 plan 박제 필수 3 gate (omxy R2 강화)**:
    - (i) grep gate: cron route 파일에 `commitFullReport` import 매치 + `orchestrateFullReport` import 0
    - (ii) grep gate: admin trigger UI 파일에 `orchestrateFullReport` import 매치 + `commitFullReport` import 0
    - (iii) e2e test: cost_log 분리 필터 동작 verify (cron run = persona_id='full_report_writer' 1 row / orchestrate run = persona_id in ('full_report_writer','critic','revise') 2~3 row)
  - **B18 contract (PR3b acceptance criterion 박제 유지)**: PR4 cron route는 `CRON_SECRET` env 검증 + 검증 실패 시 401 반환 테스트 필수.
- **Level A 12 sector body reference 실 작성**. 운용 중 lazy 작성 — sector_reference_backlog INSERT가 trigger. PR3c는 backlog table + atomic RPC + helper만.
- **Level B 10 sector §9.2 체크리스트 작성**. 첫 보고서 작성 시 docs 추가 — PR3c는 박제만 (ReportFramework §9.2.0 v2.7 patch).
- **report_critic_findings 운영 UI**. PR3c는 table + INSERT RPC + helper만. dashboard/리스트 UI는 PR4 또는 별도 PR.
- **reflection_log** (Step 4 후속 — 자가학습 prompt 주입). 별도 PR (D19 박제).
- **section_0~7 NOT NULL 전환**. 운용 안정 후 별도 마이그.
- **Section 8 신규 path**. 이미 PR2~PR3a 완료.
- **service-role DI** (B18 contract per PR3b acceptance criterion). orchestrateFullReport도 PR3b commitFullReport와 동일 SSR session-based `createClient()` 사용. PR4 cron wire 시 service-role DI 도입 (cron이 orchestrate 부른다면) — PR3c는 spec invariant 유지.
- **analyst quality A/B comparison** (omxy R1 B9): production data 누적 후 별도 PR. PR3c는 shape transform pure test만.

---

## File Structure (omxy R1 v2 — document-specialist 제거)

- **Create**: `tudal/src/lib/ai/prompts/critic-prompt.ts` + test
- **Create**: `tudal/src/lib/ai/critic-client.ts` + test
- **Create**: `tudal/src/lib/ai/prompts/revise-prompt.ts` + test
- **Create**: `tudal/src/lib/ai/revise-client.ts` + test
- **Create**: `tudal/src/lib/report/analyst.ts` + test
- **Create**: `tudal/src/lib/report/critic.ts` + test
- **Create**: `tudal/src/lib/report/full-report-orchestrator.ts` + test
- **Create**: `tudal/src/lib/data/sector-reference-backlog.ts` + test
- **Create**: `tudal/src/lib/data/report-critic-findings.ts` + test
- **Create**: `tudal/supabase/migrations/0023_sector_reference_backlog.sql` + rollback
- **Create**: `tudal/supabase/migrations/0024_report_critic_findings.sql` + rollback
- **Create**: `tudal/src/lib/report/__tests__/sector-backlog-rpc-contract.test.ts`
- **Create**: `tudal/src/lib/report/__tests__/critic-findings-rpc-contract.test.ts`
- **Modify**: `tudal/src/lib/admin/format-error.ts` + test — 9 신규 키 + 4 prefix
- **Modify**: `tudal/src/lib/cost/pricing.ts` — 3 신규 상수 (모두 `calculateCostKrw` 통과)
- **Modify**: `Document/Service/Report/ReportFramework.md §9.2.0` + §10 changelog v2.7

**총 신설 = 24 파일 (9 src + 9 test + 2 RPC contract test + 2 migration + 2 rollback) / 수정 = 3 파일.** (v1의 24 동일 — document-specialist 2 파일 제거 + RPC contract test 2 파일 추가 net 0.)

---

## Task 1: critic-prompt.ts — 6축 verdict + plain delimiter JSON (B7 fix: reason 500자)

**Files:**
- Create: `tudal/src/lib/ai/prompts/critic-prompt.ts`
- Test: `tudal/src/lib/ai/prompts/__tests__/critic-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

테스트 검증:
- 6축 label substring 포함 ("팩트", "논리", "누락", "구조", "편향", "독자 수준")
- Kevin v3.1 marker hint 포함 ("Kevin v3.1", "M1", "M8", "200자 cap")
- placeholder token (`0~100`, `<number>`, `<...>`) 0 매치
- ```json fence 금지 + plain delimiter `<<<CRITIC_JSON_EXAMPLE_START>>>` ... `<<<CRITIC_JSON_EXAMPLE_END>>>`
- plain delimiter 안 JSON example valid JSON parse
- `CRITIC_PROMPT_VERSION === 'v1'`
- `buildCriticUserPrompt` 6 fields 포함 (ticker / month / sectionsSummary / sectorContext / kevinV31Markers / consensusBadge)
- **B7 fix**: prompt 본문에 "reason은 한국어 500자 이내" 명시

- [ ] **Step 2: Run test → FAIL (module-not-found)**

- [ ] **Step 3: Implement prompt module**

`CRITIC_SYSTEM_PROMPT` 본문:
```
당신은 한국 주식 풀 리포트의 적대적 검증자입니다. 6축에서 보고서를 평가하고 JSON 1회 출력합니다.

6축:
1. 팩트 (factuality) — 수치/날짜/출처 일관성
2. 논리 (logic) — 논거 모순/인과 비약
3. 누락 (completeness) — 필수 섹션·peer 비교·시나리오·리스크 누락
4. 구조 (structure) — Section 0~7 + Appendix 프레임워크 준수
5. 편향 (bias) — 과도한 낙관/비관, 동일 논거 반복
6. 독자 수준 (reader_level) — 비유·용어 풀이·"이 섹션에서 알 수 있는 것" 가이드

Kevin v3.1 M1~M8 markers (참고):
- M1 4 axes (안정성·수익성·성장성·밸류)
- M2 financial cite · M4 peer 3+ · M5 valuation trial
- M7 일상 비유 · M8 200자 cap (페르소나 발언)

각 축에 대해 verdict (PASS / WARN / FAIL) + reason (한국어 500자 이내) 출력.

JSON 응답 형식:
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

## Task 2: critic-client.ts — Haiku LLM + zod 6축 verdict + reason 500자 cap

**Files:**
- Create: `tudal/src/lib/ai/critic-client.ts`
- Test: `tudal/src/lib/ai/__tests__/critic-client.test.ts`

- model = `CRITIC_API_MODEL` 상수 (= `'claude-haiku-4-5-20251001'`, actual Anthropic API ID — B14 fix)
- max_tokens = 2048
- system = `CRITIC_SYSTEM_PROMPT`
- user = `buildCriticUserPrompt(input)`
- 응답 → `extractJsonObject` (PR3b `full-report-writer.ts` 재사용 import) → JSON.parse → zod validation
- cost_log INSERT (**persona_id = `critic`, prompt_version = `critic-v1`** — omxy R2 (d) fix prompt_version 분리)
- throw `critic_llm_failed:<code>` / `critic_parse_failed:no_json_object` / `critic_validation_failed:<axis>`

zod schema (**B7 fix — max 500자**):
```typescript
const verdictSchema = z.object({
  verdict: z.enum(['PASS', 'WARN', 'FAIL']),
  reason: z.string().min(1).max(500),
});
const criticResultSchema = z.object({
  factuality: verdictSchema,
  logic: verdictSchema,
  completeness: verdictSchema,
  structure: verdictSchema,
  bias: verdictSchema,
  reader_level: verdictSchema,
});
export type CriticResultJson = z.infer<typeof criticResultSchema>;
```

테스트: SDK mock + happy / parse fail / validation fail (verdict invalid + reason 501자 boundary FAIL + reason 500자 boundary PASS) / cost_log INSERT param verify / throw 매핑.

---

## Task 3: revise-prompt.ts + revise-client.ts — Opus single-call (B3 fix: max_tokens 8192)

**Files:**
- Create: `tudal/src/lib/ai/prompts/revise-prompt.ts` + test
- Create: `tudal/src/lib/ai/revise-client.ts` + test

prompt:
- input = `{ originalSections, criticFindings, ticker, month }`
- 원본 sections JSON + 6축 verdict findings (WARN/FAIL만 inject — PASS 제외)
- 출력 = revised Section 0~7 + Appendix (PR3b shape 동일)
- plain delimiter `<<<REVISE_JSON_EXAMPLE_START>>>` 사용

client (**B3 fix**):
- model = `claude-opus-4-7`
- max_tokens = **8192**
- cost_log **persona_id = `revise`, prompt_version = `revise-v1`** — omxy R2 (d) fix prompt_version 분리
- throw `revise_llm_failed:<code>` / `revise_parse_failed:no_json_object`

테스트:
- max_tokens 8192 invariant test
- SDK mock + happy / parse fail / cost_log INSERT param verify

---

## Task 4: analyst.ts (pure-code shape transform, B9 fix: quality 어휘 약화)

**Files:**
- Create: `tudal/src/lib/report/analyst.ts`
- Test: `tudal/src/lib/report/__tests__/analyst.test.ts`

`enrichInput(input: FullReportUserPromptInput): EnrichedFullReportInput`:
- input의 raw summary strings를 sub-fields로 unpack (정규식·키워드 추출 단순)
- enrichedInput = 기존 input 모든 필드 보존 + 신규 optional fields 추가
- LLM 호출 0. pure transform 함수.

**B9 fix JSDoc 어휘**:
```typescript
/**
 * Pure-code shape transform — input summary strings를 sub-fields로 unpack.
 *
 * ✱ quality lift 주장 0: 본 analyst는 production data A/B comparison 별도 PR로 위임.
 * 본 PR3c에서는 shape transform invariant만 보장.
 */
```

테스트: input → enrichedInput shape 단언만 (snapshot pattern). quality A/B는 OOS.

---

## Task 5: critic.ts orchestrator (callCritic + threshold + 1회 hard cap)

**Files:**
- Create: `tudal/src/lib/report/critic.ts`
- Test: `tudal/src/lib/report/__tests__/critic.test.ts`

`evaluateReport(sections, ctx): Promise<CriticResult>`:
- callCritic (LLM)
- verdict 6축 → revise trigger decision (Q3 threshold: any FAIL OR WARN≥4)
- 반환: `{ verdict: criticResult, shouldRevise: boolean, failCount: number, warnCount: number, costKrw: number }`
- **1회 hard cap invariant** — caller orchestrator는 revise 1회 후 critic 재호출 금지. 본 helper는 단일 critic call만.

테스트:
- 모든 PASS → shouldRevise=false
- FAIL 1건 → shouldRevise=true
- WARN 4건 → shouldRevise=true
- WARN 3건 → shouldRevise=false
- critic throw → throw
- **invariant test (grep)**: critic.ts에 `callRevise` 0 매치 (recursive revise 차단)

---

## Task 6: full-report-orchestrator.ts — 3-step + conditional revise + persistence

**Files:**
- Create: `tudal/src/lib/report/full-report-orchestrator.ts`
- Test: `tudal/src/lib/report/__tests__/full-report-orchestrator.test.ts`

```typescript
export async function orchestrateFullReport(
  input: CommitFullReportInput,
): Promise<OrchestrateFullReportResult> {
  // B1 fix: cost-hardcap preflight (calculateCostKrw 통과 상수)
  await preflightHardcap({
    month: input.month,
    callCount: 1,
    maxCostPerCallKrw: ORCHESTRATE_TOTAL_COST_BUDGET_KRW,
  });

  // Step 1 analyst pure-code (비용 0)
  const enriched = enrichInput(input);

  // Step 2 writer (PR3b callFullReport 재사용)
  const userPrompt = buildFullReportUserPrompt(enriched);
  const writerLlm = await callFullReport({
    ticker: input.ticker, month: input.month,
    systemPrompt: FULL_REPORT_SYSTEM_PROMPT, userPrompt,
    adminUserId: input.adminUserId,
  });
  let finalSections = parseAndValidate(writerLlm.content, { ticker: input.ticker, month: input.month });

  // Step 3 critic (Haiku LLM)
  const critic = await evaluateReport(finalSections, { ticker: input.ticker, month: input.month });

  // Step 4 conditional revise (Opus max 8192, 1회 hard cap — recursive revise 차단)
  let reviseCostKrw = 0;
  let revised = false;
  if (critic.shouldRevise) {
    const reviseLlm = await callRevise({
      originalSections: finalSections,
      criticFindings: critic.verdict,
      ticker: input.ticker, month: input.month,
      adminUserId: input.adminUserId,
    });
    finalSections = parseAndValidate(reviseLlm.content, { ticker: input.ticker, month: input.month });
    reviseCostKrw = reviseLlm.costKrw;
    revised = true;
    // ✱ 여기서 critic 재호출 0 — 1회 hard cap invariant
  }

  // Persistence: 3 RPC 순서
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('update_report_sections_0_7', {
    p_ticker: input.ticker, p_month: input.month,
    p_section_0: finalSections.section_0, p_section_1: finalSections.section_1,
    p_section_2: finalSections.section_2, p_section_3: finalSections.section_3,
    p_section_4: finalSections.section_4, p_section_5: finalSections.section_5,
    p_section_6: finalSections.section_6, p_section_7: finalSections.section_7,
    p_appendix: finalSections.appendix,
  });
  if (error) {
    if (typeof error.message === 'string' && error.message.includes('report_not_found_for_section_0_7_update')) {
      throw new Error('report_not_found_for_section_0_7_update');
    }
    throw new Error(`update_report_sections_0_7_failed:${error.code ?? 'unknown'}`);
  }

  // B21 fix (omxy R5): persistence side-effect failure semantics 명시
  //
  // critic findings INSERT (atomic RPC) — blocking throw (PR3c quality audit 핵심)
  // B17 fix: runId wire / B19 fix: target_stage='writer_draft' (PR3c는 1회 hard cap)
  const { runId: criticRunId } = await insertCriticFindingsRun(data.report_id, critic.verdict, 'writer_draft');

  // sector backlog INSERT-or-BUMP (atomic RPC) — non-blocking warn (운영 추적 부가 효과)
  // B18 fix: trim+canonical helper에서 검증. B20 fix: Level A 보유 sector (바이오/반도체)는 helper에서 early return.
  try {
    await insertOrBumpBacklog(input.sector);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[orchestrateFullReport] sector_backlog_insert_failed ticker=${input.ticker} sector=${input.sector} message=${message}`,
    );
    // 보고서 commit + critic findings는 이미 성공. backlog 부가효과만 실패이므로 계속.
  }

  return {
    reportId: data.report_id,
    costKrw: writerLlm.costKrw + critic.costKrw + reviseCostKrw,
    revised,
    criticVerdict: critic.verdict,
    criticRunId,   // B17 fix: 호출자가 getCriticFindingsByRunId(reportId, criticRunId) strict 조회 가능
  };
}
```

테스트 7개:
- happy (no revise) / writer FAIL → throw / critic FAIL → revise → success / revise FAIL → throw
- **recursive revise prevent invariant (critic call 1회만 verify)**
- cost_log row count 2~3 verify
- sector_reference_backlog INSERT-or-BUMP 분기 verify

---

## Task 7: sector_reference_backlog 마이그 0023 — atomic RPC (B2 fix)

**Files:**
- Create: `tudal/supabase/migrations/0023_sector_reference_backlog.sql` + rollback
- Create: `tudal/src/lib/data/sector-reference-backlog.ts` + test
- Create: `tudal/src/lib/report/__tests__/sector-backlog-rpc-contract.test.ts`

마이그 SQL (0017/0021 패턴):

```sql
-- 0023_sector_reference_backlog.sql
-- SoT: docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md (v2, omxy R1 B2 fix)

create table public.sector_reference_backlog (
  id uuid primary key default gen_random_uuid(),
  -- B18 fix (omxy R4): table CHECK으로 canonical 14 sector DB invariant.
  -- TS canonical-sectors.ts CANONICAL_SECTORS와 drift catch contract test에서.
  sector text not null check (sector in (
    '바이오', '반도체', '건설', '금융', '2차전지', '자동차',
    'IT/SW', '유통/소비재', '에너지', '엔터/미디어', '통신',
    '철강/소재', '운송/물류', '보험/증권'
  )),
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

-- 4-grant
revoke all on public.sector_reference_backlog from public;
revoke all on public.sector_reference_backlog from anon;
grant select on public.sector_reference_backlog to authenticated;
grant select on public.sector_reference_backlog to service_role;

-- read-only via RLS (insert/update는 RPC만)
create policy "admin select" on public.sector_reference_backlog
  for select using (public.is_admin());

comment on table public.sector_reference_backlog is
  'Level A sector body reference 부족 lazy 추적 (Group G PR3c). 첫 풀 리포트 작성 시 atomic RPC insert_or_bump_sector_backlog 호출.';

-- B2 fix: atomic RPC + B10 fix (omxy R2): service_role guard 모순 해소 (0021 patten follow)
create or replace function public.insert_or_bump_sector_backlog(p_sector text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_role text := auth.role();
  v_caller text;
  v_sector text;  -- (l) fix omxy R5: outer declare 평탄화
begin
  -- B10 fix: service_role 호출은 auth.uid() null OK → role check 우선
  if auth.uid() is null and coalesce(v_caller_role, '') <> 'service_role' then
    raise exception 'auth_unavailable';
  end if;
  v_caller := coalesce(v_caller_role, '');
  if not (public.is_admin() or v_caller = 'service_role') then
    raise exception 'admin_required';
  end if;
  -- B18 fix (omxy R4): trim + canonical 14 check (DB invariant + helper-level 양쪽)
  -- (l) fix (omxy R5): nested DECLARE 평탄화 → outer declare로 통합 (가독성)
  if p_sector is null then
    raise exception 'invalid_sector';
  end if;
  v_sector := trim(p_sector);
  if v_sector = '' then
    raise exception 'invalid_sector';
  end if;
  if v_sector not in (
    '바이오', '반도체', '건설', '금융', '2차전지', '자동차',
    'IT/SW', '유통/소비재', '에너지', '엔터/미디어', '통신',
    '철강/소재', '운송/물류', '보험/증권'
  ) then
    raise exception 'invalid_sector_not_canonical';
  end if;

  insert into public.sector_reference_backlog (sector, status, request_count)
  values (v_sector, 'pending', 1)
  on conflict (sector) do update
    set request_count = sector_reference_backlog.request_count + 1,
        last_requested_at = now(),
        updated_at = now();
end;
$$;

revoke all on function public.insert_or_bump_sector_backlog(text) from public;
revoke all on function public.insert_or_bump_sector_backlog(text) from anon;
grant execute on function public.insert_or_bump_sector_backlog(text) to authenticated;
grant execute on function public.insert_or_bump_sector_backlog(text) to service_role;
```

helper (**B16 fix — omxy R3: canonical 14 검증 + trim** · **B20 fix — omxy R5: Level A 보유 sector early return**):
```typescript
import { isCanonicalSector, type CanonicalSector } from '@/lib/screening/canonical-sectors';

// B20 fix (omxy R5): Level A body reference 보유 sector (사용자 lock-in §1.7).
// PR3c에서는 바이오·반도체 = 2/12. Level A 보유 sector는 backlog INSERT 차단 (이미 보유).
export const LEVEL_A_SECTORS_WITH_BODY: ReadonlySet<CanonicalSector> = new Set<CanonicalSector>([
  '바이오',
  '반도체',
]);

export function hasLevelABodyReference(sector: string): boolean {
  return LEVEL_A_SECTORS_WITH_BODY.has(sector as CanonicalSector);
}

export async function insertOrBumpBacklog(sector: string): Promise<void> {
  const trimmed = sector.trim();
  if (trimmed === '') {
    throw new Error('sector_reference_backlog_invalid_sector:empty');
  }
  if (!isCanonicalSector(trimmed)) {
    throw new Error('sector_reference_backlog_invalid_sector:not_canonical');
  }
  // B20 fix: Level A 보유 sector는 backlog INSERT skip (오염 차단).
  if (hasLevelABodyReference(trimmed)) {
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('insert_or_bump_sector_backlog', { p_sector: trimmed });
  if (error) throw new Error(`sector_reference_backlog_rpc_failed:${error.code ?? 'unknown'}`);
}
```

테스트: RPC mock happy + idempotent (같은 sector 2회 호출 시 request_count++) + **canonical guard (B16)**: trailing whitespace trim 후 valid / "비-canonical" sector throw / empty string throw + **Level A guard (B20)**: 바이오/반도체 호출 시 RPC mock 미호출 단언 (early return) + missing 12 invariant (canonical 14 - LEVEL_A_SECTORS_WITH_BODY 2 = 12 정합) + contract pins (SECURITY DEFINER / search_path / 4-grant / ON CONFLICT body / null guard).

---

## Task 8: report_critic_findings 마이그 0024 — run_id + atomic RPC (B6 + B7 fix)

**Files:**
- Create: `tudal/supabase/migrations/0024_report_critic_findings.sql` + rollback
- Create: `tudal/src/lib/data/report-critic-findings.ts` + test
- Create: `tudal/src/lib/report/__tests__/critic-findings-rpc-contract.test.ts`

마이그 SQL:

```sql
-- 0024_report_critic_findings.sql
-- SoT: docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md (v5, omxy R1 B6+B7 + R4 B19 fix)

create table public.report_critic_findings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.stock_reports(id) on delete cascade,
  run_id uuid not null,
  -- B19 fix (omxy R4): pre-revise vs post-revise critic 명명. PR3c는 항상 'writer_draft' (1회 hard cap).
  -- 미래 'revised' stage critic 도입 시 별도 PR + 마이그 확장.
  target_stage text not null check (target_stage in ('writer_draft', 'revised')),
  axis text not null check (axis in ('factuality', 'logic', 'completeness', 'structure', 'bias', 'reader_level')),
  verdict text not null check (verdict in ('PASS', 'WARN', 'FAIL')),
  reason text not null check (length(reason) <= 500),
  created_at timestamptz not null default now()
);

create index report_critic_findings_report_id_idx on public.report_critic_findings(report_id);
create index report_critic_findings_run_id_idx on public.report_critic_findings(run_id);
create index report_critic_findings_verdict_idx on public.report_critic_findings(verdict)
  where verdict in ('WARN', 'FAIL');

alter table public.report_critic_findings enable row level security;
revoke all on public.report_critic_findings from public;
revoke all on public.report_critic_findings from anon;
grant select on public.report_critic_findings to authenticated;
grant select on public.report_critic_findings to service_role;

create policy "admin select" on public.report_critic_findings
  for select using (public.is_admin());

comment on table public.report_critic_findings is
  'PR3c critic 6축 verdict persistence. orchestrateFullReport이 매 호출 시 RPC insert_critic_findings_run로 new run_id + 6 row atomic INSERT.';

-- B19 fix (omxy R4): p_target_stage 추가. PR3c orchestrator는 'writer_draft' 고정.
create or replace function public.insert_critic_findings_run(
  p_report_id uuid,
  p_verdict jsonb,
  p_target_stage text default 'writer_draft'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_role text := auth.role();
  v_caller text;
  v_run_id uuid := gen_random_uuid();
  v_axes text[] := array['factuality', 'logic', 'completeness', 'structure', 'bias', 'reader_level'];
  v_axis text;
  v_node jsonb;
begin
  -- B10 fix (omxy R2): service_role 호출은 auth.uid() null OK → role check 우선
  if auth.uid() is null and coalesce(v_caller_role, '') <> 'service_role' then
    raise exception 'auth_unavailable';
  end if;
  v_caller := coalesce(v_caller_role, '');
  if not (public.is_admin() or v_caller = 'service_role') then
    raise exception 'admin_required';
  end if;
  if p_report_id is null then
    raise exception 'invalid_report_id';
  end if;
  if p_verdict is null or jsonb_typeof(p_verdict) <> 'object' then
    raise exception 'invalid_verdict';
  end if;
  -- B19 fix: target_stage validation
  if coalesce(p_target_stage, '') not in ('writer_draft', 'revised') then
    raise exception 'invalid_target_stage';
  end if;

  -- 6축 전부 존재 + verdict enum + reason 길이 validation
  foreach v_axis in array v_axes loop
    if not p_verdict ? v_axis then
      raise exception 'verdict_missing_axis:%', v_axis;
    end if;
    v_node := p_verdict -> v_axis;
    if v_node is null or jsonb_typeof(v_node) <> 'object' then
      raise exception 'verdict_invalid_axis:%', v_axis;
    end if;
    if not (v_node ? 'verdict' and v_node ? 'reason') then
      raise exception 'verdict_missing_fields:%', v_axis;
    end if;
    if coalesce(v_node ->> 'verdict', '') not in ('PASS', 'WARN', 'FAIL') then
      raise exception 'verdict_invalid_value:%', v_axis;
    end if;
    if length(coalesce(v_node ->> 'reason', '')) > 500 then
      raise exception 'verdict_reason_too_long:%', v_axis;
    end if;
  end loop;

  foreach v_axis in array v_axes loop
    v_node := p_verdict -> v_axis;
    -- B19 fix: target_stage 컬럼 추가
    insert into public.report_critic_findings (report_id, run_id, target_stage, axis, verdict, reason)
    values (p_report_id, v_run_id, p_target_stage, v_axis, v_node ->> 'verdict', v_node ->> 'reason');
  end loop;

  return v_run_id;
end;
$$;

revoke all on function public.insert_critic_findings_run(uuid, jsonb) from public;
revoke all on function public.insert_critic_findings_run(uuid, jsonb) from anon;
grant execute on function public.insert_critic_findings_run(uuid, jsonb) to authenticated;
grant execute on function public.insert_critic_findings_run(uuid, jsonb) to service_role;
```

helper (**B19 fix — targetStage 파라미터 추가**):
```typescript
export type CriticTargetStage = 'writer_draft' | 'revised';

export async function insertCriticFindingsRun(
  reportId: string,
  verdict: CriticResultJson,
  targetStage: CriticTargetStage = 'writer_draft',
): Promise<{ runId: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('insert_critic_findings_run', {
    p_report_id: reportId,
    p_verdict: verdict,
    p_target_stage: targetStage,
  });
  if (error) throw new Error(`report_critic_findings_rpc_failed:${error.code ?? 'unknown'}`);
  return { runId: data as string };
}

// B6 fix: latest run filter (run_id subquery) — "다른 admin이 본 latest"용. mixed-run 안전.
export async function listLatestRunCriticFindings(reportId: string) {
  const supabase = await createClient();
  // 1) latest run_id 조회
  const { data: latestRow, error: latestErr } = await supabase
    .from('report_critic_findings')
    .select('run_id, created_at')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) throw new Error(`report_critic_findings_list_failed:${latestErr.code ?? 'unknown'}`);
  if (latestRow === null) return [];
  // 2) latest run의 6 row 반환
  const { data, error } = await supabase
    .from('report_critic_findings')
    .select('*')
    .eq('report_id', reportId)
    .eq('run_id', latestRow.run_id);
  if (error) throw new Error(`report_critic_findings_list_failed:${error.code ?? 'unknown'}`);
  return data;
}

// B12 fix (omxy R2 P2): "방금 insert 결과"용 strict latest. orchestrateFullReport이 반환한 run_id 사용.
// listLatestRunCriticFindings는 concurrent INSERT race에 stale 가능성 — getCriticFindingsByRunId는 strict.
export async function getCriticFindingsByRunId(reportId: string, runId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('report_critic_findings')
    .select('*')
    .eq('report_id', reportId)
    .eq('run_id', runId);
  if (error) throw new Error(`report_critic_findings_list_failed:${error.code ?? 'unknown'}`);
  return data;
}
```

테스트:
- RPC mock + 6 row INSERT 성공 + run_id 발급
- verdict_missing_axis throw / verdict_invalid_value throw / verdict_reason_too_long throw
- listLatestRunCriticFindings: 가장 최근 run의 6 row만 반환 (older run 제외 verify)
- RPC contract pins (SECURITY DEFINER / search_path / 4-grant / run_id 발급 / FK / 6축 validation / reason 500자 check)

---

## Task 9: format-error.ts + pricing.ts + ReportFramework.md (B1 + B7 fix)

**format-error.ts 신규 9 키 + 4 prefix**:

```typescript
// PR3c (omxy R1 v2 CONVERGED) — critic + revise + orchestrate + RPC error codes
critic_llm_failed: "AI 검증 단계가 실패했습니다",
critic_parse_failed: "AI 검증 응답을 파싱할 수 없습니다",
critic_validation_failed: "AI 검증 응답이 형식을 어겼습니다",
revise_llm_failed: "AI 재작성 단계가 실패했습니다",
revise_parse_failed: "AI 재작성 응답을 파싱할 수 없습니다",
orchestrate_failed: "보고서 생성 흐름이 실패했습니다",
sector_reference_backlog_rpc_failed: "섹터 reference 추적 저장이 실패했습니다",
report_critic_findings_rpc_failed: "AI 검증 결과 저장이 실패했습니다",
verdict_reason_too_long: "AI 검증 reason이 500자를 초과했습니다",
```

prefix:
- `critic_*` → "검증 단계가 실패했습니다."
- `revise_*` → "재작성 단계가 실패했습니다."
- `orchestrate_*` → "보고서 생성 흐름이 실패했습니다."
- `verdict_*` → "AI 검증 결과 형식 오류"

**pricing.ts (B1 fix — calculateCostKrw 통과, magic number 0)**:

```typescript
// PR3c — critic call (Haiku 4.5)
// B14 fix (omxy R3): model ID drift 차단. Anthropic API ID vs pricing key 분리.
//   CRITIC_API_MODEL = actual Anthropic API model ID (Anthropic.messages.create({model: ...}))
//   CRITIC_PRICING_KEY = anthropic-pricing.ts ANTHROPIC_PRICING 키 (calculateCostKrw 2nd arg)
// 두 상수 분리하지 않으면 calculateCostKrw(usage, CRITIC_API_MODEL) → getPricing fallback Sonnet 단가 적용 risk.
export const CRITIC_PRICING_KEY = "claude-haiku-4-5" as const;
if (!(CRITIC_PRICING_KEY in ANTHROPIC_PRICING)) {
  throw new Error(`${CRITIC_PRICING_KEY} not in ANTHROPIC_PRICING — anthropic-pricing.ts SoT 갱신 필요`);
}

export const CRITIC_MAX_COST_PER_CALL_KRW = calculateCostKrw(
  { input_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 500 },
  CRITIC_PRICING_KEY,
);
// 현재 단가: Haiku $1 input / $5 output × 1430 KRW/USD ≈ 5원

// PR3c — revise call (Opus 4.7, max_tokens 8192 — B3 fix · input 8000 — B11 fix omxy R2 보수화)
export const REVISE_MAX_COST_PER_CALL_KRW = calculateCostKrw({
  input_tokens: 8000,  // B11 fix: 6000 → 8000 보수화 (originalSections JSON + findings + instructions). P0 token snapshot gate는 PR4 fixture 시점 별도.
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 6000,
});
// 현재 단가: Opus $5 input / $25 output × 1430 ≈ 271원 (8000 input × 5 + 6000 output × 25 = 190000 / 1M × 1430)

// PR3c — orchestrate total budget
export const ORCHESTRATE_TOTAL_COST_BUDGET_KRW =
  FULL_REPORT_MAX_COST_PER_CALL_KRW + CRITIC_MAX_COST_PER_CALL_KRW + REVISE_MAX_COST_PER_CALL_KRW;
// 약 236 + 5 + 271 = 512원/per ticker worst case (B11 fix 반영)
```

**ReportFramework §9.2.0 + §10 changelog v2.7**:
```markdown
| 2026-05-24 | **v2.7** | **55차 §4 — PR3c 3-step orchestration + sector_reference_backlog 마이그 박제. Group G ✅ 해소.**
  Level A 12 sector body reference 부족 → `sector_reference_backlog` table (마이그 0023) + atomic RPC `insert_or_bump_sector_backlog` lazy 추적.
  Level B 10 sector 체크리스트는 첫 보고서 시 docs 추가 (본 §9.2.1).
  Level C `SECTOR_PHILOSOPHIES` 14/14 완료 유지.
  Critic 6축 verdict persistence = `report_critic_findings` table (마이그 0024) + atomic RPC `insert_critic_findings_run` (매 호출 new run_id + 6 row INSERT atomic). reason 500자 cap (한국어 trunc 방지).
  Orchestrator entrypoint = `orchestrateFullReport` (commitFullReport와 coexist) — PR4 caller에서 path 선택. |
```

---

## Cost Analysis (B1 fix — calculateCostKrw 통과 calibration)

| 비용 항목 | 모델 | input | output | krw/call |
|---|---|---|---|---|
| FULL_REPORT (PR3b 기존) | Opus 4.7 | 3000 | 6000 | ≈ 236원 |
| CRITIC (PR3c 신규) | Haiku 4.5 | 1000 | 500 | ≈ 5원 |
| REVISE (PR3c 신규, conditional, B11 보수화) | Opus 4.7 | 8000 | 6000 | ≈ 271원 |
| **ORCHESTRATE TOTAL (worst case, 매번 revise)** | — | — | — | **≈ 512원** |
| **ORCHESTRATE 평균 (revise trigger 30% 가정)** | — | — | — | ≈ 322원 |

**월간 worst case** (30 stocks × 512) = **15,360원/월** ≈ M17 hardcap 400,000원의 **3.8%**.
**월간 평균** (30 stocks × 322) = **9,660원/월** ≈ **2.4%**.

→ M17 hardcap 매우 여유.

(omxy R1 P0 B1 catch — v1 plan의 5,000/18,000원 magic constant는 1000x 과대 평가였음. calculateCostKrw 통과로 정확 calibration.)

---

## Migration Plan (production apply 순서)

```bash
# CLAUDE local verify
cd tudal && npx supabase db push --dry-run    # 0023 + 0024 SQL syntax verify

# CLAUDE TDD + omxy R2~Rn CONVERGED 후
git push origin feat/pr3c-orchestration-sector-reference
gh pr create ...

# USER merge 후
# USER apply 0023 + 0024 via MCP apply_migration (순서: 0023 → 0024)
# USER canary 4 페이지 verify
# CLAUDE post-merge docs commit
```

---

## Rollback Plan

- Code revert: `git revert --no-edit OLD_MAIN..AFTER_PR3C`
- Migration rollback: 0024 → 0023 순서
- downstream 의존: 0 (PR3c는 PR4 caller wire 전 production 사용 0)
- production cron 영향: 0

---

## Verification Gates (22종 — omxy R2 B13 + R3 B14/B16 + R4 B17/B18/B19 + R5 B20/B21 추가)

1. `npm run build` — 25 routes intact
2. `npm run lint` — 0 err
3. `npm run test:ci` — 917 → ~980+ (+60~70 신규)
4. `npx tsc --noEmit` — clean
5. **grep gate (negative)**: critic-prompt에 ```json fence 0 매치 + placeholder token 0 매치
6. **grep gate (negative)**: revise-prompt에 ```json fence 0 매치
7. **grep gate (negative)**: orchestrator.ts에 `commitFullReport` direct import 0
8. **grep gate (negative)**: 0023/0024 마이그에 `grant select to anon` 0 매치 + `grant execute to anon` 0 매치
9. **grep gate (positive — B13 fix)**: 0023/0024 마이그에 `revoke (all|execute|select) on .* from anon` 각 1+ 매치 (RPC + table 모두)
10. **grep gate (positive — B13 fix)**: 0023/0024 마이그에 `grant execute on function .* to authenticated` 각 1+ 매치
11. **grep gate (positive — B13 fix)**: 0023/0024 마이그에 `grant execute on function .* to service_role` 각 1+ 매치
12. **grep gate**: pricing.ts 신규 상수에 magic number 0 (모두 `calculateCostKrw` 통과) — B1 invariant
13. **grep gate**: critic.ts에 `callRevise` 0 매치 — Q3 invariant
14. **grep gate**: document-specialist file 0 (`find src/lib -name '*document-specialist*'` empty) — Q7 invariant
15. **grep gate (B10 fix)**: 0023/0024 RPC 둘 다 `v_caller_role text := auth.role()` declare + `coalesce(v_caller_role` 매치 (service_role guard 정합)
16. **grep gate (B14 fix — model/pricing key drift 차단)**: pricing.ts에 `CRITIC_PRICING_KEY` declare 매치 + `if (!(CRITIC_PRICING_KEY in ANTHROPIC_PRICING)) throw` 매치
17. **grep gate (B16 fix — canonical guard)**: sector-reference-backlog.ts에 `isCanonicalSector(trimmed)` import + invariant check 매치
18. **grep gate (B17 fix — runId wire)**: full-report-orchestrator.ts에 `criticRunId` 단어 매치 (return value 포함) + `OrchestrateFullReportResult` interface에 `criticRunId` 필드 매치
19. **grep gate (B18 fix — DB invariant)**: 0023 마이그에 `check (sector in (` 매치 + RPC body에 `trim(p_sector)` 매치 + RPC body에 `invalid_sector_not_canonical` 매치 + contract test에 TS↔SQL drift 검증 (`CANONICAL_SECTORS` import in 0023 contract test) 매치
20. **grep gate (B19 fix — target_stage)**: 0024 마이그에 `target_stage text not null check (target_stage in ('writer_draft', 'revised'))` 매치 + helper에 `targetStage: CriticTargetStage = 'writer_draft'` default 매치 + orchestrator에 `'writer_draft'` literal 매치
21. **grep gate (B20 fix — Level A guard)**: sector-reference-backlog.ts에 `LEVEL_A_SECTORS_WITH_BODY` Set declare 매치 + `hasLevelABodyReference` export 매치 + `if (hasLevelABodyReference(trimmed)) return;` 매치 + "missing 12" invariant test (canonical 14 - LEVEL_A_SECTORS_WITH_BODY 2 = 12 정합)
22. **grep gate (B21 fix — non-blocking backlog)**: full-report-orchestrator.ts에 `try { await insertOrBumpBacklog` + `catch` + `console.warn` 매치 + test에 "backlog INSERT throw → orchestrator success + warn" 단언 매치

---

## omxy R2 적대적 검토 요청 (CONVERGED 조건)

OMXY R2 검토자는 다음 5 항목을 적대적으로 검증:

1. **plan v2 9 BLOCKERS fix 정합**: omxy R1 catch한 B1/B2/B3/B6/B7/B8/B9 + Q1/Q7 fix가 v2에 모두 반영? 누락 catch?
2. **0023/0024 RPC SQL contract**: `insert_or_bump_sector_backlog` ON CONFLICT 패턴 PostgreSQL 14+ 정합? `insert_critic_findings_run` 6 row INSERT atomic + transaction guarantee?
3. **REVISE_MAX_COST input 6000 가정 적절**: originalSections JSON inject 시 token count 실측 vs 추정?
4. **listLatestRunCriticFindings 쿼리 정확성**: 2-step subquery 패턴이 race condition 안전? 단일 RPC로 합치는 게 더 안전?
5. **PR4 acceptance 박제 (B8 fix) 완전성**: orchestrate vs commit 선택 기준이 PR4 plan에서 강제될 충분 명세?

SCOPE GUARD (재해석 금지):
- 사용자 lock-in (spec doc §1 8 항목)
- 본 PR3c scope 외 (PR4 / 별도 PR로 분리)
- document-specialist 0 (Q7 invariant — file·stub interface·test 모두 0)
- DQ-7 / S8 / 멤버 페이지

---

**End of Plan v6 — omxy R6 적대적 검토 대기 (CONVERGED 후보, 누적 21 BLOCKERS catch & fix)**
