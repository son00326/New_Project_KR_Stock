# PR3b — writer Section 0~7 본문 생성 Implementation Plan (v5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Changelog**
> - **v5 (omxy R4 4 정리 fix · 누적 24 BLOCKERS catch)** 2026-05-23: R4-1 B15 통일 (header changelog +48 = 910+) / R4-2 B18 모순 제거 (`p_caller_kind` param 미도입 통일 — RPC SQL 변경 0, Out of Scope에 PR4 contract만 박제) / R4-3 Task 6 Step 3 failing grep 제거 (`return null` 단순 grep 삭제, schema silent null grep만 유지) / R4-4 B17 grep 표현 정정 ("prompt module source only" 명시). 추가: B18 보안 contract 명시 ("PR3b RPC는 DB-layer caller intent 강제 안 함 — PR4 route layer에서 CRON_SECRET 검증 테스트 필수").
> - v4 (omxy R3 5 신규 BLOCKERS fix · 누적 20) 2026-05-23: B16 P0 prompt body literal fence 토큰 제거 / B17 P1 Task 6 grep 표현 정정 / B18 P1 옵션 b (contract 박제) / B19 P2 suffix happy / B20 P2 별도 docs commit / B14 portability `[0-9]` / B15 통일.
> - v3 (omxy R2 7 신규 BLOCKERS fix · 누적 15) 2026-05-23: B9 P0 prompt `0~100` 토큰 제거 + 테스트 token grep 정합 / B10 P0 markdown fence 예시 → `<<<JSON_EXAMPLE_START>>>`/`<<<JSON_EXAMPLE_END>>>` plain delimiter / B11 P1 `extractJsonObject` helper + fence/prefix/suffix strip 테스트 / B12 P1 PR1 cron actual path = service_role direct call CONFIRMED (route.ts:73 `createServiceRoleClient`). RPC 패턴 = 0017 `commit_persona_eval` 정합 (auth.uid null guard + admin_required + service_role check 4-grant) / B13 P1 search_path = `public, pg_temp` (0017/0021 정합) / B14 P1 RPC input regex guard (ticker `^[0-9]{6}$` + month `^[0-9]{4}-[0-9]{2}$`) / B15 P2 신규 파일 수 9.
> - v2 (omxy R1 8 BLOCKERS fix) 2026-05-23: P0 4 (month cast / is_admin guard / grant 정합 / error taxonomy) + P1 3 (라벨 drift / invalid JSON example / dead code) + P2 1 (file structure). Open Q1~Q5 CONVERGED 박제.
> - v1 2026-05-23: 초안 작성. baseline = single LLM + writer-only + 신규 UPDATE RPC + 단일 cost_log row.

**Goal:** writer 모듈이 선정된 30 ticker 각각의 Section 0~7 + Appendix jsonb를 단일 LLM 호출로 생성, PR3a zod 스키마로 검증, 신규 RPC `update_report_sections_0_7`으로 `stock_reports` row UPDATE. caller wire(cron/UI)는 PR4. document-specialist + analyst + critic + sector_reference_backlog는 모두 PR3c로 분리.

**Architecture:**
- 단일 LLM 호출 (`callFullReport` — `claude-opus-4-7`, `max_tokens 8192`).
- writer 모듈 `tudal/src/lib/report/full-report-writer.ts` 신설. 기존 `writer.ts`의 Section 8 path 보존.
- prompt module이 `FULL_REPORT_SYSTEM_PROMPT` (B10 fix: plain delimiter `<<<JSON_EXAMPLE_START>>>...<<<JSON_EXAMPLE_END>>>` 사용 — ```json fence 금지) + `buildFullReportUserPrompt(input)` export.
- `commitFullReport`이 input → buildFullReportUserPrompt → callFullReport → **`extractJsonObject(raw)` (B11 fix — LLM이 fence/prefix/suffix 추가해도 첫 `{...}` JSON object 추출)** → per-section safeParse strict → RPC.
- 신규 RPC `update_report_sections_0_7` — `stock_reports` UPDATE.
- **RPC 패턴 (B12 + B13 + B14 fix) = 0017 `commit_persona_eval` 정합**:
  * SECURITY DEFINER
  * `set search_path = public, pg_temp` (B13 fix)
  * body 첫 줄: `v_caller := auth.uid()` + `if v_caller is null then raise exception 'auth_unavailable'` + `if not public.is_admin() then raise exception 'admin_required'` — single statement도 admin OR service_role 우회 case 처리 (`if not (public.is_admin() or (select auth.role()) = 'service_role') then raise exception 'admin_required'`)
  * **service_role direct call 허용** (B12 fix — PR4 cron wire는 0021 `acquire_batch_lock_v2` 패턴 따라 `createServiceRoleClient`로 진입). 따라서 4-grant: revoke public + revoke anon + grant authenticated + grant service_role.
  * input regex guard (B14 fix): `if p_ticker !~ '^\d{6}$' then raise exception 'invalid_ticker'`; `if p_month !~ '^\d{4}-\d{2}$' then raise exception 'invalid_month'`
  * `month = to_date(p_month || '-01', 'YYYY-MM-DD')` cast (R1 P0 #1)
  * row 부재 시 `raise exception 'report_not_found_for_section_0_7_update' using errcode = 'P0002'`
- writer error 처리: error.message에 `'report_not_found_for_section_0_7_update'` 포함 → 직접 throw, 그 외 `update_report_sections_0_7_failed:<code>` throw.
- input은 caller가 조립. PR3b는 raw 데이터 수집 X.
- cost_log 단일 row (`persona_id='full_report_writer'`).

**Tech Stack:**
- LLM: `@anthropic-ai/sdk` (이미 의존). Opus tier (`claude-opus-4-7`).
- Zod schemas: `tudal/src/lib/data/report-section-schemas.ts` (PR3a SoT, 재정의 금지).
- Supabase RPC + RLS + service_role guard (0017 패턴).
- 테스트: Vitest TDD.

---

## OPEN Q1~Q5 — omxy R1 CONVERGED (R2에서 재확인)

| Q | 결정 | rationale |
|---|---|---|
| **Q1** 호출 구조 | single LLM call (max_tokens 8192) | 얕은 jsonb, 비용·시간·일관성 우위. B11 fix로 fence/prefix strip 추가. |
| **Q2** PR3b scope | writer-only 분할 | document-specialist + analyst + critic은 PR3c. |
| **Q3** sector_reference_backlog | PR3c defer | HANDOFF "PR3b가 Group G 해소" 문구 수정 필수. |
| **Q4** Section 0~7 commit 전략 | 신규 UPDATE RPC | upsert 금지. row 부재 시 raise. |
| **Q5** cost_log 적재 | 단일 row | Q1 single call이므로. |

---

## Out of Scope (PR3c / PR4 defer + HANDOFF docs 갱신)

- **document-specialist / analyst / critic / 4-step orchestrator**. PR3c.
- **Caller wire** (cron / UI / Regen). PR4. **PR4 cron wire = `createServiceRoleClient` direct call (PR1 패턴 follow)** — RPC가 service_role grant + body service_role check 포함하므로 가능. **B18 contract 박제 (omxy R3 옵션 b)**: PR4 cron route는 `CRON_SECRET` env 검증 후에만 `createServiceRoleClient`로 진입하여 본 RPC 호출. service_role direct call 단독 진입 차단 (CRON_SECRET 검증이 caller intent guard 역할). p_caller_kind text param 추가는 PR3b scope 밖 — PR4 wire 시점에 도입 여부 결정. **R4 B18 보안 contract 명시**: PR3b RPC는 DB-layer에서 caller intent (cron/admin)를 강제하지 않음 — service_role direct call이 본 RPC를 호출 가능. 따라서 **PR4 cron route 구현 시 `CRON_SECRET` env 검증 + 검증 실패 시 401 반환 테스트는 PR4 plan acceptance criterion으로 박제 필수**.
- **sector_reference_backlog 마이그 + Level A lazy 추가**. PR3c. **HANDOFF/spec "PR3b가 Group G 해소" 문구 → "Group E만 해소, Group G는 PR3c" 수정 필수**. **B20 fix (R3 P2)**: 본 docs 수정은 **별도 docs commit** (push 시점 + PR body, PR3b code commit과 분리). git history 분리로 review/rollback 가시성 보존.
- **reflection_log**. 별도 PR.
- **section_0~7 NOT NULL 전환**. 운용 안정 후 별도 마이그.
- **Section 8 신규 path**. 이미 PR2~PR3a 완료.

---

## File Structure

- **Create**: `tudal/src/lib/ai/prompts/full-report-prompt.ts` — `FULL_REPORT_SYSTEM_PROMPT` (B10 fix: plain delimiter, no ```json fence; B9 fix: `0~100` 토큰 0) + `buildFullReportUserPrompt(input)` + `FullReportUserPromptInput` + `FULL_REPORT_PROMPT_VERSION`.
- **Create**: `tudal/src/lib/ai/prompts/__tests__/full-report-prompt.test.ts` — page.tsx 라벨 8개 + Kevin v3.1 markers + invalid token 0 매치 + valid JSON parse 검증 (B10 plain delimiter 안 JSON).
- **Create**: `tudal/src/lib/ai/full-report-client.ts` — Anthropic Opus 단일 호출 wrapper + cost_log + `full_report_llm_failed` throw.
- **Create**: `tudal/src/lib/ai/__tests__/full-report-client.test.ts` — SDK mock + cost_log verify + throw 매핑.
- **Create**: `tudal/src/lib/report/full-report-writer.ts` — `commitFullReport` (input → buildFullReportUserPrompt → callFullReport → `extractJsonObject` → per-section safeParse → RPC UPDATE) + `extractJsonObject` (B11 fix) helper export.
- **Create**: `tudal/src/lib/report/__tests__/full-report-writer.test.ts` — happy / parse fail / validation fail / RPC `report_not_found...` direct throw / 일반 RPC error / section_8 키 제외 / **B11: fenced 응답 strip 후 happy + prefix 설명 + suffix 설명 strip 후 happy**.
- **Create**: `tudal/src/lib/report/__tests__/full-report-writer-rpc-contract.test.ts` — RPC SQL contract pins (10 assertions for v3 fix 박제: search_path / regex guard / 4-grant 등).
- **Create**: `tudal/supabase/migrations/0022_update_report_sections_0_7.sql` — RPC 정의 (0017 패턴 follow).
- **Create**: `tudal/supabase/migrations/0022_update_report_sections_0_7.rollback.sql` — DROP FUNCTION.
- **Modify**: `tudal/src/lib/admin/format-error.ts` — 5 신규 키 + 3 prefix handler.
- **Modify**: `tudal/src/lib/admin/__tests__/format-error.test.ts` — 5 신규 키 단언.

**총 신설 = 9 파일 (3 src + 4 test + 1 migration + 1 rollback) / 수정 = 2 파일.**

---

## Task 1: full-report-prompt.ts — page.tsx 라벨 + plain delimiter (B9 + B10 fix)

**Files:**
- Create: `tudal/src/lib/ai/prompts/full-report-prompt.ts`
- Test: `tudal/src/lib/ai/prompts/__tests__/full-report-prompt.test.ts`

- [ ] **Step 1: Write the failing test (B9 + B10 fix)**

```typescript
// tudal/src/lib/ai/prompts/__tests__/full-report-prompt.test.ts
import { describe, expect, it } from 'vitest';
import {
  FULL_REPORT_SYSTEM_PROMPT,
  buildFullReportUserPrompt,
  FULL_REPORT_PROMPT_VERSION,
  FULL_REPORT_JSON_EXAMPLE_START,
  FULL_REPORT_JSON_EXAMPLE_END,
} from '@/lib/ai/prompts/full-report-prompt';

describe('FULL_REPORT_SYSTEM_PROMPT — Section 0~7 라벨 (page.tsx + zod schema 정합)', () => {
  // P1 #5 fix: page.tsx SECTION_LIST 라벨 baseline
  const labels = [
    '투자 요약',          // Section 0
    '기업 개요',          // Section 1
    '재무 분석',          // Section 2
    '밸류에이션',         // Section 3
    '성장성',             // Section 4
    '리스크',             // Section 5
    '모멘텀',             // Section 6
    'Exit',               // Section 7
  ];
  it.each(labels)('contains label substring "%s"', (l) => {
    expect(FULL_REPORT_SYSTEM_PROMPT).toContain(l);
  });

  it('Kevin v3.1 quality markers — 근거 부족 / 비교 가능한 회사 / 일상 비유 / JSON', () => {
    for (const m of ['근거 부족', '비교 가능한 회사', '일상 비유', 'JSON']) {
      expect(FULL_REPORT_SYSTEM_PROMPT).toContain(m);
    }
  });

  // B9 fix: '0~100' 토큰 0 매치 (test와 implementation self-fail 방지)
  it('B9 fix — placeholder token (0~100 / <number> / <...>) 0 매치', () => {
    expect(FULL_REPORT_SYSTEM_PROMPT).not.toMatch(/0~100|<number>|<\.\.\.>/);
  });

  // B10 fix: 마크다운 fence (```json) 금지, plain delimiter 사용
  it('B10 fix — ```json fence 금지, plain delimiter 사용', () => {
    expect(FULL_REPORT_SYSTEM_PROMPT).not.toMatch(/```json/);
    expect(FULL_REPORT_SYSTEM_PROMPT).toContain(FULL_REPORT_JSON_EXAMPLE_START);
    expect(FULL_REPORT_SYSTEM_PROMPT).toContain(FULL_REPORT_JSON_EXAMPLE_END);
  });

  // B10 fix: plain delimiter 안 JSON example이 valid JSON
  it('B10 fix — plain delimiter 안 JSON example이 valid JSON parse', () => {
    const startIdx = FULL_REPORT_SYSTEM_PROMPT.indexOf(FULL_REPORT_JSON_EXAMPLE_START) + FULL_REPORT_JSON_EXAMPLE_START.length;
    const endIdx = FULL_REPORT_SYSTEM_PROMPT.indexOf(FULL_REPORT_JSON_EXAMPLE_END);
    const jsonBlock = FULL_REPORT_SYSTEM_PROMPT.slice(startIdx, endIdx).trim();
    expect(() => JSON.parse(jsonBlock)).not.toThrow();
  });

  it('FULL_REPORT_PROMPT_VERSION is "v1"', () => {
    expect(FULL_REPORT_PROMPT_VERSION).toBe('v1');
  });
});

describe('buildFullReportUserPrompt', () => {
  const baseInput = {
    ticker: '196170',
    name: '알테오젠',
    sector: '바이오',
    month: '2026-06',
    tier1Verdict: 'BUY' as const,
    consensusBadge: '🟢' as const,
    financialsSummary: 'OPM 흑전, 부채비율 35%',
    technicalsSummary: '60일선 위, 거래량 평균 ×1.4',
    macroSummary: '금리 동결, 원화 약세',
    sectorReference: '바이오 reference 본문 (Alteogen)',
  };

  it('포함: ticker / name / sector / month', () => {
    const p = buildFullReportUserPrompt(baseInput);
    expect(p).toContain('196170');
    expect(p).toContain('알테오젠');
    expect(p).toContain('바이오');
    expect(p).toContain('2026-06');
  });

  it('포함: Tier 1 verdict + consensus badge', () => {
    const p = buildFullReportUserPrompt(baseInput);
    expect(p).toContain('BUY');
    expect(p).toContain('🟢');
  });

  it('포함: financials / technicals / macro / sectorReference', () => {
    const p = buildFullReportUserPrompt(baseInput);
    expect(p).toContain('OPM 흑전');
    expect(p).toContain('60일선 위');
    expect(p).toContain('금리 동결');
    expect(p).toContain('Alteogen');
  });

  it('JSON 응답 schema 강제 — section_0..7 + appendix 9 키 모두 명시', () => {
    const p = buildFullReportUserPrompt(baseInput);
    for (const key of ['section_0', 'section_1', 'section_2', 'section_3', 'section_4', 'section_5', 'section_6', 'section_7', 'appendix']) {
      expect(p).toContain(key);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tudal && npx vitest run src/lib/ai/prompts/__tests__/full-report-prompt.test.ts
```
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement prompt module (B9 + B10 fix)**

```typescript
// tudal/src/lib/ai/prompts/full-report-prompt.ts

export const FULL_REPORT_PROMPT_VERSION = 'v1';

// B10 fix: markdown fence 대신 plain delimiter (LLM이 fence로 응답할 확률 감소).
export const FULL_REPORT_JSON_EXAMPLE_START = '<<<JSON_EXAMPLE_START>>>';
export const FULL_REPORT_JSON_EXAMPLE_END = '<<<JSON_EXAMPLE_END>>>';

// B9 fix: '0~100' 토큰 제거. 대신 "0과 100 사이" 표현 + valid JSON example에 실제 number value로 명시.
// P1 #5: page.tsx SECTION_LIST 라벨 baseline.
// Kevin v3.1: M2 재무 데이터 직접 인용 / M3 근거 부족 / M4 비교 가능한 회사 / M7 일상 비유.
export const FULL_REPORT_SYSTEM_PROMPT = `당신은 한국 주식 풀 리포트 작성자입니다. 비전문가도 이해할 수 있는 일상 비유와 정확한 재무 인용으로 8개 섹션 + Appendix를 작성합니다.

섹션 구성:
- Section 0: 투자 요약 (headline / thesis / conviction 점수 / 합의 mini / 가격 밴드)
- Section 1: 기업 개요 (사업 description / 사업부 segments / 핵심 사실)
- Section 2: 재무 분석 (매출 추세 / 마진 / 재무 건전성)
- Section 3: 밸류에이션 (peer multiples / 비교 가능한 회사)
- Section 4: 성장성 (성장 drivers / TAM)
- Section 5: 리스크 (severity high/medium/low)
- Section 6: 모멘텀 (5-Signal + 3축: trend/momentum/volatility)
- Section 7: Exit 조건 (triggers / alternatives)
- Appendix: 기술적 지표 + 데이터 출처

품질 원칙:
- 재무 데이터는 입력으로 주어진 financials/technicals/macro에서만 인용합니다. 추측 금지. 데이터 부재 시 "근거 부족"이라고 명시합니다.
- 밸류에이션에는 비교 가능한 회사(peer) 1~3개를 반드시 포함합니다.
- 전문용어 첫 등장 시 일상 비유 또는 한글 풀이를 동반합니다.
- 모든 결과는 JSON object 단일 응답으로 반환합니다. 마크다운 fence(코드블록) 또는 본문 설명 추가 금지. 응답은 { 문자로 시작하고 } 문자로 끝나는 JSON object만.

응답 schema (반드시 모든 키 포함, 아래 예시는 valid JSON — 실제 값으로 대체. severity는 "high"|"medium"|"low" 중 하나, state는 "on"|"watch"|"off" 중 하나, conviction과 axis 각 필드는 0과 100 사이 number, divergencePct는 음수 허용 number):

${FULL_REPORT_JSON_EXAMPLE_START}
{
  "section_0": {
    "headline": "예시 헤드라인",
    "thesis": ["근거 1", "근거 2"],
    "conviction": 72,
    "committeeMini": {
      "core": {"approve": 7, "reject": 2, "abstain": 2},
      "sector": {"approve": 9, "reject": 3, "abstain": 2}
    },
    "priceBands": {"bear": "450,000원", "base": "620,000원", "bull": "820,000원"}
  },
  "section_1": {
    "description": "사업 설명",
    "segments": [{"name": "사업부명", "share": "55%"}],
    "keyFacts": [{"label": "라벨", "value": "값"}]
  },
  "section_2": {
    "summary": "재무 요약",
    "revenue": [{"fy": "2025E", "value": "1800억", "yoy": "+38%"}],
    "margins": {"operating": "12%", "net": "8%"},
    "balance": {"debtRatio": "35%", "cash": "2400억"}
  },
  "section_3": {
    "summary": "밸류에이션 요약",
    "multiples": [{"metric": "PSR", "value": "18배", "peer": "12배 (peer)"}]
  },
  "section_4": {
    "summary": "성장성 요약",
    "drivers": ["성장 동인 1"],
    "tam": "40조"
  },
  "section_5": {
    "summary": "리스크 요약",
    "risks": [{"title": "리스크 제목", "severity": "high", "detail": "상세"}]
  },
  "section_6": {
    "summary": "모멘텀 요약",
    "signals": [{"name": "MACD", "state": "on", "note": "수치"}],
    "axis": {"trend": 72, "momentum": 65, "volatility": 48},
    "divergencePct": 3.4
  },
  "section_7": {
    "summary": "Exit 조건 요약",
    "triggers": ["트리거 1"],
    "alternatives": [{"label": "대안 라벨", "detail": "대안 상세"}]
  },
  "appendix": {
    "technicals": [{"name": "RSI", "value": "58"}],
    "dataSources": ["DART", "pykrx"]
  }
}
${FULL_REPORT_JSON_EXAMPLE_END}
`;

export interface FullReportUserPromptInput {
  ticker: string;
  name: string;
  sector: string;
  month: string;
  tier1Verdict: 'BUY' | 'HOLD' | 'SELL';
  consensusBadge: '🟢' | '🔵' | '🟣' | '🟡';
  financialsSummary: string;
  technicalsSummary: string;
  macroSummary: string;
  sectorReference: string;
}

export function buildFullReportUserPrompt(input: FullReportUserPromptInput): string {
  return `[종목] ${input.name} (${input.ticker}) — ${input.sector} 섹터
[월간] ${input.month}
[Tier 1 합의 판정] ${input.tier1Verdict}  [합의 배지] ${input.consensusBadge}

[financials]
${input.financialsSummary}

[technicals]
${input.technicalsSummary}

[macro]
${input.macroSummary}

[sectorReference]
${input.sectorReference}

위 입력 데이터만 사용해서 응답 schema에 정확히 일치하는 JSON object를 반환하세요. 키 누락 / 타입 mismatch 금지. section_0..section_7, appendix 9개 키 모두 포함 필수. 응답은 JSON object만 — 본문 설명 / 마크다운 fence 추가 금지.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd tudal && npx vitest run src/lib/ai/prompts/__tests__/full-report-prompt.test.ts
```
Expected: PASS (17 assertions: 8 label + 4 quality + 1 B9 token + 2 B10 delimiter + 1 valid JSON + 1 version + 4 builder).

- [ ] **Step 5: Commit**

```bash
git add tudal/src/lib/ai/prompts/full-report-prompt.ts tudal/src/lib/ai/prompts/__tests__/full-report-prompt.test.ts
git commit -m "feat(PR3b Task1): full-report-prompt — page.tsx 라벨 + plain delimiter + valid JSON (omxy R2 B9+B10 fix)"
```

---

## Task 2: 마이그 0022 — `update_report_sections_0_7` RPC (0017 패턴 정합)

**Files:**
- Create: `tudal/supabase/migrations/0022_update_report_sections_0_7.sql`
- Create: `tudal/supabase/migrations/0022_update_report_sections_0_7.rollback.sql`
- Create: `tudal/src/lib/report/__tests__/full-report-writer-rpc-contract.test.ts`

- [ ] **Step 1: Write the failing test (B12 + B13 + B14 + R1 P0 fix 종합)**

```typescript
// tudal/src/lib/report/__tests__/full-report-writer-rpc-contract.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('마이그 0022 update_report_sections_0_7 — contract pins (omxy R1+R2 fix)', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../../../supabase/migrations/0022_update_report_sections_0_7.sql'),
    'utf-8',
  );

  it('함수명 + parameter 시그너처 박제 — 9 jsonb params + p_ticker text + p_month text', () => {
    expect(sql).toMatch(/create or replace function public\.update_report_sections_0_7/);
    expect(sql).toContain('p_ticker text');
    expect(sql).toContain('p_month text');
    expect(sql).toContain('p_section_0 jsonb');
    expect(sql).toContain('p_section_7 jsonb');
    expect(sql).toContain('p_appendix jsonb');
  });

  // B13 fix: search_path = public, pg_temp (0017/0021 패턴)
  it('B13 fix — set search_path = public, pg_temp', () => {
    expect(sql).toMatch(/set\s+search_path\s*=\s*public\s*,\s*pg_temp/);
  });

  // R1 P0 #2 + B12 fix: is_admin() OR service_role guard (0021 4-grant 패턴)
  it('B12 fix — SECURITY DEFINER + auth_unavailable + admin_required + service_role bypass', () => {
    expect(sql).toContain('security definer');
    expect(sql).toMatch(/raise exception 'auth_unavailable'/);
    expect(sql).toMatch(/raise exception 'admin_required'/);
    // service_role direct call 허용 (PR4 cron wire를 위해)
    expect(sql).toMatch(/service_role/);
  });

  // B12 fix: 4-grant (0021 패턴 정합)
  it('B12 fix — 4-grant (revoke public/anon + grant authenticated + grant service_role)', () => {
    expect(sql).toMatch(/revoke (all|execute) on function public\.update_report_sections_0_7.*from public/i);
    expect(sql).toMatch(/revoke (all|execute) on function public\.update_report_sections_0_7.*from anon/i);
    expect(sql).toMatch(/grant execute on function public\.update_report_sections_0_7.*to authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.update_report_sections_0_7.*to service_role/i);
  });

  // B14 fix (R3 [0-9] portability): input regex guard
  it('B14 fix — input regex guard (ticker ^[0-9]{6}$ + month ^[0-9]{4}-[0-9]{2}$)', () => {
    expect(sql).toMatch(/p_ticker\s*!~\s*'\^\[0-9\]\{6\}\$'/);
    expect(sql).toMatch(/p_month\s*!~\s*'\^\[0-9\]\{4\}-\[0-9\]\{2\}\$'/);
    expect(sql).toMatch(/raise exception 'invalid_ticker'/);
    expect(sql).toMatch(/raise exception 'invalid_month'/);
  });

  // R1 P0 #1: month = to_date(p_month || '-01', 'YYYY-MM-DD')
  it('R1 P0 #1 — month = to_date(p_month || \'-01\', \'YYYY-MM-DD\')', () => {
    expect(sql).toMatch(/month\s*=\s*to_date\(p_month\s*\|\|\s*'-01',\s*'YYYY-MM-DD'\)/);
  });

  it('UPDATE 대상 = (ticker, month, is_latest=true)', () => {
    expect(sql).toMatch(/update public\.stock_reports/i);
    expect(sql).toMatch(/is_latest\s*=\s*true/i);
  });

  it('row 부재 시 report_not_found_for_section_0_7_update raise (errcode P0002)', () => {
    expect(sql).toContain('report_not_found_for_section_0_7_update');
    expect(sql).toMatch(/errcode\s*=\s*'P0002'/);
  });

  it('return shape = json {success, report_id}', () => {
    expect(sql).toMatch(/returns json/i);
    expect(sql).toContain("'success', true");
    expect(sql).toContain("'report_id'");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tudal && npx vitest run src/lib/report/__tests__/full-report-writer-rpc-contract.test.ts
```
Expected: FAIL (파일 없음).

- [ ] **Step 3: Write 마이그 0022 (0017 패턴 정합)**

```sql
-- 0022_update_report_sections_0_7.sql
-- PR3b: writer Section 0~7 본문 commit RPC.
-- commit_persona_eval (0017)가 row 먼저 INSERT 후 본 RPC가 Section 0~7 + Appendix UPDATE.
-- omxy R1+R2 합의 박제:
--   R1 P0 #1: stock_reports.month=date → to_date(p_month || '-01', 'YYYY-MM-DD')
--   R1 P0 #2: SECURITY DEFINER + auth.uid + is_admin guard (0017 commit_persona_eval 패턴)
--   R1 P0 #3 / R2 B12: PR1 cron actual path = createServiceRoleClient → 4-grant 필요 (service_role bypass)
--   R2 B13: search_path = public, pg_temp (0017/0021 패턴 정합)
--   R2 B14: input regex guard (p_ticker '^\d{6}$' + p_month '^\d{4}-\d{2}$')

create or replace function public.update_report_sections_0_7(
  p_ticker text,
  p_month text,
  p_section_0 jsonb,
  p_section_1 jsonb,
  p_section_2 jsonb,
  p_section_3 jsonb,
  p_section_4 jsonb,
  p_section_5 jsonb,
  p_section_6 jsonb,
  p_section_7 jsonb,
  p_appendix jsonb
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid;
  v_role text;
  v_report_id uuid;
begin
  -- B14 input regex guard (R3 [0-9] portability — PostgreSQL POSIX regex)
  if p_ticker !~ '^[0-9]{6}$' then
    raise exception 'invalid_ticker';
  end if;
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'invalid_month';
  end if;

  -- B12 caller guard: service_role direct call (PR4 cron) OR authenticated admin
  -- (0017 패턴: auth.uid null guard + is_admin check; 0021 패턴: service_role bypass)
  v_role := (select auth.role());
  if v_role = 'service_role' then
    -- cron path: service_role direct. 추가 guard 0 (cron 환경은 신뢰).
    null;
  else
    v_caller := auth.uid();
    if v_caller is null then
      raise exception 'auth_unavailable';
    end if;
    if not public.is_admin() then
      raise exception 'admin_required';
    end if;
  end if;

  -- R1 P0 #1 fix: month = to_date(...)
  update public.stock_reports
  set
    section_0 = p_section_0,
    section_1 = p_section_1,
    section_2 = p_section_2,
    section_3 = p_section_3,
    section_4 = p_section_4,
    section_5 = p_section_5,
    section_6 = p_section_6,
    section_7 = p_section_7,
    appendix = p_appendix
  where ticker = p_ticker
    and month = to_date(p_month || '-01', 'YYYY-MM-DD')
    and is_latest = true
  returning id into v_report_id;

  if v_report_id is null then
    raise exception 'report_not_found_for_section_0_7_update' using errcode = 'P0002';
  end if;

  return json_build_object('success', true, 'report_id', v_report_id);
end;
$$;

-- B12 4-grant (0021 패턴): public/anon revoke + authenticated + service_role grant.
revoke all on function public.update_report_sections_0_7(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.update_report_sections_0_7(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from anon;
grant execute on function public.update_report_sections_0_7(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.update_report_sections_0_7(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

comment on function public.update_report_sections_0_7(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) is
  'PR3b — writer Section 0~7 + Appendix UPDATE. commit_persona_eval가 row 먼저 INSERT 후 본 RPC 호출. service_role direct (PR4 cron) OR authenticated admin (PR4 UI). month=date cast (R1 P0 #1). search_path public,pg_temp (R2 B13). input regex guard (R2 B14). row 부재 시 report_not_found_for_section_0_7_update raise (errcode P0002).';
```

Rollback:

```sql
-- 0022_update_report_sections_0_7.rollback.sql
drop function if exists public.update_report_sections_0_7(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd tudal && npx vitest run src/lib/report/__tests__/full-report-writer-rpc-contract.test.ts
```
Expected: PASS (10 assertions).

- [ ] **Step 5: Commit**

```bash
git add tudal/supabase/migrations/0022_update_report_sections_0_7.sql tudal/supabase/migrations/0022_update_report_sections_0_7.rollback.sql tudal/src/lib/report/__tests__/full-report-writer-rpc-contract.test.ts
git commit -m "feat(PR3b Task2): 마이그 0022 update_report_sections_0_7 — 0017 패턴 + 4-grant + search_path + input regex guard (omxy R2 B12+B13+B14 fix)"
```

---

## Task 3: full-report-client.ts — Anthropic Opus 단일 호출 + cost_log + `full_report_llm_failed`

(Task 3 본문은 plan v2와 동일 — R2에서 추가 BLOCKERS 없음)

**Files:**
- Create: `tudal/src/lib/ai/full-report-client.ts`
- Test: `tudal/src/lib/ai/__tests__/full-report-client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tudal/src/lib/ai/__tests__/full-report-client.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  const create = vi.fn();
  class Anthropic {
    messages = { create };
    constructor() {}
  }
  return { default: Anthropic, __create: create };
});

vi.mock('@/lib/cost/cost-logger', () => ({
  insertCostLog: vi.fn().mockResolvedValue({ id: 'log-1' }),
}));

describe('callFullReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('ANTHROPIC_API_KEY 없으면 ai_key_unavailable throw', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    await expect(
      callFullReport({
        ticker: '196170',
        month: '2026-06',
        systemPrompt: 'S',
        userPrompt: 'U',
        adminUserId: 'u1',
      }),
    ).rejects.toThrow('ai_key_unavailable');
  });

  it('Anthropic SDK 호출 + cost_log insert + content/usage/costKrw 반환', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"section_0":{}}' }],
      usage: { input_tokens: 1500, output_tokens: 4500 },
    });
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const result = await callFullReport({
      ticker: '196170',
      month: '2026-06',
      systemPrompt: 'S',
      userPrompt: 'U',
      adminUserId: 'u1',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-7', max_tokens: 8192 }),
    );
    expect(result.content).toBe('{"section_0":{}}');
    expect(result.usage.input_tokens).toBe(1500);
    expect(result.usage.output_tokens).toBe(4500);
    expect(result.costKrw).toBeGreaterThan(0);
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: '196170',
        month: '2026-06',
        persona_id: 'full_report_writer',
        prompt_version: 'v1',
        called_by: 'u1',
      }),
    );
  });

  it('Anthropic SDK throw 시 full_report_llm_failed throw (insertCostLog 미호출)', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    create.mockRejectedValueOnce(new Error('429 rate limit'));
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    await expect(
      callFullReport({
        ticker: '196170',
        month: '2026-06',
        systemPrompt: 'S',
        userPrompt: 'U',
        adminUserId: 'u1',
      }),
    ).rejects.toThrow('full_report_llm_failed');
    expect(insertCostLog).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tudal && npx vitest run src/lib/ai/__tests__/full-report-client.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement full-report-client.ts**

```typescript
// tudal/src/lib/ai/full-report-client.ts
import Anthropic from '@anthropic-ai/sdk';
import { calculateCostKrw, type TokenUsage } from '@/lib/cost/pricing';
import { insertCostLog } from '@/lib/cost/cost-logger';
import { FULL_REPORT_PROMPT_VERSION } from './prompts/full-report-prompt';

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 8192;
const PERSONA_ID = 'full_report_writer';

export interface CallFullReportInput {
  ticker: string;
  month: string;
  systemPrompt: string;
  userPrompt: string;
  adminUserId: string;
}

export interface CallFullReportResult {
  content: string;
  usage: TokenUsage;
  costKrw: number;
}

export async function callFullReport(input: CallFullReportInput): Promise<CallFullReportResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ai_key_unavailable');
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: input.systemPrompt,
      messages: [{ role: 'user', content: input.userPrompt }],
    });
  } catch {
    throw new Error('full_report_llm_failed');
  }

  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('');

  const usageWithCache = response.usage as typeof response.usage & {
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  const usage: TokenUsage = {
    input_tokens: response.usage.input_tokens ?? 0,
    cache_creation_input_tokens: usageWithCache.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usageWithCache.cache_read_input_tokens ?? 0,
    output_tokens: response.usage.output_tokens ?? 0,
  };
  const costKrw = calculateCostKrw(usage);

  await insertCostLog({
    month: input.month,
    ticker: input.ticker,
    persona_id: PERSONA_ID,
    prompt_version: FULL_REPORT_PROMPT_VERSION,
    model: MODEL,
    ...usage,
    cost_krw: costKrw,
    prompt_cache_enabled: false,
    called_by: input.adminUserId,
  });

  return { content: text, usage, costKrw };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd tudal && npx vitest run src/lib/ai/__tests__/full-report-client.test.ts
```
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add tudal/src/lib/ai/full-report-client.ts tudal/src/lib/ai/__tests__/full-report-client.test.ts
git commit -m "feat(PR3b Task3): full-report-client — Anthropic Opus single-call + cost_log + full_report_llm_failed (omxy R1 P0 #4)"
```

---

## Task 4: full-report-writer.ts — prompt wire + extractJsonObject (B11 fix) + safeParse + RPC

**Files:**
- Create: `tudal/src/lib/report/full-report-writer.ts`
- Test: `tudal/src/lib/report/__tests__/full-report-writer.test.ts`

- [ ] **Step 1: Write the failing test (R1 P0 #4 + R1 P1 #7 + R2 B11 fix)**

```typescript
// tudal/src/lib/report/__tests__/full-report-writer.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/ai/full-report-client', () => ({
  callFullReport: vi.fn(),
}));

const validResponse = {
  section_0: {
    headline: '알테오젠 — 글로벌 빅파마 마일스톤 가시화',
    thesis: ['ALT-B4 임상 3상 데이터 2026년 하반기 readout'],
    conviction: 78,
    committeeMini: { core: { approve: 7, reject: 2, abstain: 2 }, sector: { approve: 9, reject: 3, abstain: 2 } },
    priceBands: { bear: '450,000원', base: '620,000원', bull: '820,000원' },
  },
  section_1: { description: '바이오시밀러 + 신약', segments: [{ name: 'ALT-B4', share: '55%' }], keyFacts: [{ label: 'TAM', value: '40조' }] },
  section_2: { summary: '연 매출 1800억', revenue: [{ fy: '2025E', value: '1800억', yoy: '+38%' }], margins: { operating: '12%', net: '8%' }, balance: { debtRatio: '35%', cash: '2400억' } },
  section_3: { summary: 'PSR 18배', multiples: [{ metric: 'PSR', value: '18배', peer: '12배 (삼성바이오)' }] },
  section_4: { summary: '바이오시밀러+신약', drivers: ['ALT-B4 임상 3상'], tam: '40조' },
  section_5: { summary: '금리/환율/규제', risks: [{ title: 'FDA 지연', severity: 'high', detail: '...' }] },
  section_6: { summary: '60일선 위', signals: [{ name: 'MACD', state: 'on', note: '+2.3' }], axis: { trend: 72, momentum: 65, volatility: 48 }, divergencePct: 3.4 },
  section_7: { summary: '임상 3상 readout 2026H2', triggers: ['ALT-B4 readout'], alternatives: [{ label: '삼성바이오', detail: '디스카운트' }] },
  appendix: { technicals: [{ name: 'RSI', value: '58' }], dataSources: ['DART', 'pykrx'] },
};

const baseInput = {
  ticker: '196170',
  name: '알테오젠',
  sector: '바이오',
  month: '2026-06',
  tier1Verdict: 'BUY' as const,
  consensusBadge: '🟢' as const,
  financialsSummary: 'OPM 흑전',
  technicalsSummary: '60일선 위',
  macroSummary: '금리 동결',
  sectorReference: 'Alteogen',
  adminUserId: 'u1',
};

describe('extractJsonObject (R2 B11 fix)', () => {
  it('plain JSON object 그대로 반환', async () => {
    const { extractJsonObject } = await import('@/lib/report/full-report-writer');
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });
  it('```json fence strip', async () => {
    const { extractJsonObject } = await import('@/lib/report/full-report-writer');
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('prefix 설명 + JSON object strip', async () => {
    const { extractJsonObject } = await import('@/lib/report/full-report-writer');
    expect(extractJsonObject('Here is the JSON:\n{"a":1}')).toBe('{"a":1}');
  });
  it('JSON object + suffix 설명 strip', async () => {
    const { extractJsonObject } = await import('@/lib/report/full-report-writer');
    expect(extractJsonObject('{"a":1}\nDone.')).toBe('{"a":1}');
  });
  it('JSON object 부재 시 null', async () => {
    const { extractJsonObject } = await import('@/lib/report/full-report-writer');
    expect(extractJsonObject('no object here')).toBeNull();
  });
});

describe('commitFullReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path — prompt builder 호출 + extractJsonObject + per-section 검증 + RPC UPDATE 성공', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify(validResponse),
      usage: { input_tokens: 1500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 4500 },
      costKrw: 1200,
    });
    const rpc = vi.fn().mockResolvedValueOnce({ data: { success: true, report_id: 'r1' }, error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    const result = await commitFullReport(baseInput);
    expect(result.reportId).toBe('r1');
    expect(result.costKrw).toBe(1200);
    expect(callFullReport).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: '196170',
        month: '2026-06',
        adminUserId: 'u1',
        systemPrompt: expect.stringContaining('투자 요약'),
        userPrompt: expect.stringContaining('알테오젠'),
      }),
    );
    expect(rpc).toHaveBeenCalledWith(
      'update_report_sections_0_7',
      expect.objectContaining({ p_ticker: '196170', p_month: '2026-06', p_section_0: validResponse.section_0 }),
    );
  });

  // R2 B11 fix: LLM 응답이 fence/prefix/suffix 추가해도 happy path 성공
  it('B11 — ```json fence wrapped 응답도 strip + parse 성공', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: '```json\n' + JSON.stringify(validResponse) + '\n```',
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 100,
    });
    const rpc = vi.fn().mockResolvedValueOnce({ data: { success: true, report_id: 'r2' }, error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    const result = await commitFullReport(baseInput);
    expect(result.reportId).toBe('r2');
  });

  it('B11 — prefix 설명 + JSON 응답도 strip + parse 성공', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: 'Here is the JSON:\n' + JSON.stringify(validResponse),
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 100,
    });
    const rpc = vi.fn().mockResolvedValueOnce({ data: { success: true, report_id: 'r3' }, error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    const result = await commitFullReport(baseInput);
    expect(result.reportId).toBe('r3');
  });

  // B19 fix (R3 P2): suffix 설명 commitFullReport happy test 추가
  it('B19 — JSON + suffix 설명도 strip + parse 성공', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify(validResponse) + '\n\n(이상으로 풀 리포트 작성을 마칩니다.)',
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 100,
    });
    const rpc = vi.fn().mockResolvedValueOnce({ data: { success: true, report_id: 'r3b' }, error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    const result = await commitFullReport(baseInput);
    expect(result.reportId).toBe('r3b');
  });

  it('LLM 응답에 JSON object 0이면 full_report_parse_failed throw', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: 'no json here',
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 0,
    });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await expect(commitFullReport(baseInput)).rejects.toThrow(/full_report_parse_failed/);
  });

  it('section_0 conviction이 zod 범위 밖이면 full_report_validation_failed:section_0:conviction throw', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const invalid = { ...validResponse, section_0: { ...validResponse.section_0, conviction: 150 } };
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify(invalid),
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 0,
    });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await expect(commitFullReport(baseInput)).rejects.toThrow(/full_report_validation_failed:section_0/);
  });

  it('RPC가 report_not_found_for_section_0_7_update message로 raise 시 동일 string throw', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify(validResponse),
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 0,
    });
    const rpc = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { code: 'P0002', message: 'report_not_found_for_section_0_7_update' },
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await expect(commitFullReport(baseInput)).rejects.toThrow('report_not_found_for_section_0_7_update');
  });

  it('일반 RPC error → update_report_sections_0_7_failed:<code> throw', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify(validResponse),
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 0,
    });
    const rpc = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'admin_required' },
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await expect(commitFullReport(baseInput)).rejects.toThrow(/update_report_sections_0_7_failed:42501/);
  });

  it('section_8 키는 응답에 있어도 RPC payload에서 제외', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify({ ...validResponse, section_8: { foo: 'bar' } }),
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 0,
    });
    const rpc = vi.fn().mockResolvedValueOnce({ data: { success: true, report_id: 'r4' }, error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await commitFullReport(baseInput);
    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args).not.toHaveProperty('p_section_8');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tudal && npx vitest run src/lib/report/__tests__/full-report-writer.test.ts
```
Expected: FAIL (모듈 없음).

- [ ] **Step 3: Implement full-report-writer.ts (R1 P0 #4 + R1 P1 #7 + R2 B11 fix)**

```typescript
// tudal/src/lib/report/full-report-writer.ts
import { createClient } from '@/lib/supabase/server';
import { callFullReport } from '@/lib/ai/full-report-client';
import {
  FULL_REPORT_SYSTEM_PROMPT,
  buildFullReportUserPrompt,
  type FullReportUserPromptInput,
} from '@/lib/ai/prompts/full-report-prompt';
import {
  reportSection0Schema,
  reportSection1Schema,
  reportSection2Schema,
  reportSection3Schema,
  reportSection4Schema,
  reportSection5Schema,
  reportSection6Schema,
  reportSection7Schema,
  reportAppendixSchema,
} from '@/lib/data/report-section-schemas';
import type { z } from 'zod';

export interface CommitFullReportInput extends FullReportUserPromptInput {
  adminUserId: string;
}

export interface CommitFullReportResult {
  reportId: string;
  costKrw: number;
}

const SECTION_SCHEMAS = {
  section_0: reportSection0Schema,
  section_1: reportSection1Schema,
  section_2: reportSection2Schema,
  section_3: reportSection3Schema,
  section_4: reportSection4Schema,
  section_5: reportSection5Schema,
  section_6: reportSection6Schema,
  section_7: reportSection7Schema,
  appendix: reportAppendixSchema,
} as const;

type SectionKey = keyof typeof SECTION_SCHEMAS;

// R2 B11 fix: LLM이 ```json fence 또는 prefix/suffix 설명을 추가하는 경우 첫 {...} JSON object를 추출.
// 단순 'first { ... matching last }' 휴리스틱 — depth-aware. 정상 JSON object만 추출하고 외부 텍스트 무시.
export function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return trimmed.slice(start, i + 1);
      }
    }
  }
  return null;
}

function parseAndValidate(raw: string): Record<SectionKey, unknown> {
  const jsonStr = extractJsonObject(raw);
  if (jsonStr === null) {
    throw new Error('full_report_parse_failed:no_json_object');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('full_report_parse_failed:invalid_json');
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('full_report_parse_failed:not_object');
  }
  const record = parsed as Record<string, unknown>;
  const out = {} as Record<SectionKey, unknown>;
  for (const key of Object.keys(SECTION_SCHEMAS) as SectionKey[]) {
    if (!(key in record)) {
      throw new Error(`full_report_validation_failed:${key}:missing`);
    }
    const schema = SECTION_SCHEMAS[key] as z.ZodTypeAny;
    const result = schema.safeParse(record[key]);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first?.path?.join('.') ?? 'root';
      throw new Error(`full_report_validation_failed:${key}:${path}`);
    }
    out[key] = result.data;
  }
  return out;
}

export async function commitFullReport(
  input: CommitFullReportInput,
): Promise<CommitFullReportResult> {
  const userPrompt = buildFullReportUserPrompt({
    ticker: input.ticker,
    name: input.name,
    sector: input.sector,
    month: input.month,
    tier1Verdict: input.tier1Verdict,
    consensusBadge: input.consensusBadge,
    financialsSummary: input.financialsSummary,
    technicalsSummary: input.technicalsSummary,
    macroSummary: input.macroSummary,
    sectorReference: input.sectorReference,
  });

  const llm = await callFullReport({
    ticker: input.ticker,
    month: input.month,
    systemPrompt: FULL_REPORT_SYSTEM_PROMPT,
    userPrompt,
    adminUserId: input.adminUserId,
  });

  const sections = parseAndValidate(llm.content);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('update_report_sections_0_7', {
    p_ticker: input.ticker,
    p_month: input.month,
    p_section_0: sections.section_0,
    p_section_1: sections.section_1,
    p_section_2: sections.section_2,
    p_section_3: sections.section_3,
    p_section_4: sections.section_4,
    p_section_5: sections.section_5,
    p_section_6: sections.section_6,
    p_section_7: sections.section_7,
    p_appendix: sections.appendix,
  });

  if (error) {
    if (typeof error.message === 'string' && error.message.includes('report_not_found_for_section_0_7_update')) {
      throw new Error('report_not_found_for_section_0_7_update');
    }
    throw new Error(`update_report_sections_0_7_failed:${error.code ?? 'unknown'}`);
  }
  if (!data?.success) {
    throw new Error('update_report_sections_0_7_failed:no_success');
  }
  return { reportId: data.report_id, costKrw: llm.costKrw };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd tudal && npx vitest run src/lib/report/__tests__/full-report-writer.test.ts
```
Expected: PASS (5 extractJsonObject + 8 commitFullReport = 13 cases).

- [ ] **Step 5: Commit**

```bash
git add tudal/src/lib/report/full-report-writer.ts tudal/src/lib/report/__tests__/full-report-writer.test.ts
git commit -m "feat(PR3b Task4): full-report-writer — prompt wire + extractJsonObject + safeParse + RPC (omxy R2 B11 fix)"
```

---

## Task 5: format-error — 신규 5 키 + 3 prefix handler (R1 P0 #4 fix)

(plan v2와 동일)

**Files:**
- Modify: `tudal/src/lib/admin/format-error.ts`
- Modify: `tudal/src/lib/admin/__tests__/format-error.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { formatErrorMessage } from '@/lib/admin/format-error';

describe('format-error — PR3b 신규 키 한국어 매핑 (omxy R1 P0 #4 fix)', () => {
  it('full_report_validation_failed:section_0:conviction → "본문 검증 실패"', () => {
    const msg = formatErrorMessage('full_report_validation_failed:section_0:conviction');
    expect(msg).toContain('본문');
    expect(msg).toContain('검증');
  });
  it('full_report_parse_failed:invalid_json → "AI 응답 파싱 실패"', () => {
    const msg = formatErrorMessage('full_report_parse_failed:invalid_json');
    expect(msg).toContain('AI');
    expect(msg).toContain('파싱');
  });
  it('full_report_llm_failed → "풀 리포트 AI 호출 실패"', () => {
    expect(formatErrorMessage('full_report_llm_failed')).toContain('풀 리포트');
  });
  it('update_report_sections_0_7_failed:42501 → "본문 저장 실패"', () => {
    const msg = formatErrorMessage('update_report_sections_0_7_failed:42501');
    expect(msg).toContain('저장');
  });
  it('report_not_found_for_section_0_7_update → "리포트 row 부재"', () => {
    const msg = formatErrorMessage('report_not_found_for_section_0_7_update');
    expect(msg).toContain('리포트');
    expect(msg).toContain('부재');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tudal && npx vitest run src/lib/admin/__tests__/format-error.test.ts -t "PR3b"
```
Expected: FAIL.

- [ ] **Step 3: Add 5 keys + 3 prefix handlers to format-error.ts**

```typescript
// KOREAN_MAPPINGS object에 5 항목 추가:
//   full_report_llm_failed: "풀 리포트 AI 호출 실패",
//   full_report_validation_failed: "풀 리포트 본문 검증 실패",
//   full_report_parse_failed: "풀 리포트 AI 응답 파싱 실패",
//   update_report_sections_0_7_failed: "풀 리포트 본문 저장 실패",
//   report_not_found_for_section_0_7_update: "리포트 row 부재 (Section 0~7 UPDATE 실패)",
//
// formatErrorMessage body에 prefix handler 3개 추가:
//   if (code.startsWith("full_report_validation_failed:")) {
//     return KOREAN_MAPPINGS["full_report_validation_failed"] + " (" + code.slice("full_report_validation_failed:".length) + ")";
//   }
//   if (code.startsWith("full_report_parse_failed:")) {
//     return KOREAN_MAPPINGS["full_report_parse_failed"] + " (" + code.slice("full_report_parse_failed:".length) + ")";
//   }
//   if (code.startsWith("update_report_sections_0_7_failed:")) {
//     return KOREAN_MAPPINGS["update_report_sections_0_7_failed"] + " (" + code.slice("update_report_sections_0_7_failed:".length) + ")";
//   }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd tudal && npx vitest run src/lib/admin/__tests__/format-error.test.ts -t "PR3b"
```
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add tudal/src/lib/admin/format-error.ts tudal/src/lib/admin/__tests__/format-error.test.ts
git commit -m "feat(PR3b Task5): format-error — 5 신규 키 + 3 prefix handler (omxy R1 P0 #4)"
```

---

## Task 6: Forbidden grep gates + 검증 게이트 통과

- [ ] **Step 1: schema redefine 0**

```bash
cd tudal && grep -rE "z\.object\(\s*\{\s*(headline|thesis|conviction|description|segments|keyFacts)" src/lib/report/full-report-writer.ts src/lib/ai/full-report-client.ts src/lib/ai/prompts/full-report-prompt.ts && echo "FAIL: schema redefine" || echo "OK"
```

- [ ] **Step 2: client bundle leak 0**

```bash
cd tudal && grep -n "from '@/lib/supabase/client'" src/lib/report/full-report-writer.ts src/lib/ai/full-report-client.ts && echo "FAIL" || echo "OK"
```

- [ ] **Step 3: schema silent null drop 0 (writer schema 매핑은 throw only)**

R4-3 fix: `return null` 단순 grep은 `extractJsonObject` 함수 본문에서 매치 발생 (의도적 — caller가 throw 처리). 본 grep은 **schema 매핑 silent drop만** 잡는다 — PR3a P2 lesson 정합 (silent null drop 금지). `extractJsonObject` 의도적 null 반환은 본 grep 패턴이 잡지 않음.

```bash
cd tudal && grep -nE "safeParse\(.*\)\.success.*return null" src/lib/report/full-report-writer.ts && echo "FAIL: schema silent null" || echo "OK"
```

- [ ] **Step 4: ai_call_failed 사용 0 (R1 P0 #4)**

```bash
cd tudal && grep -n "ai_call_failed" src/lib/report/full-report-writer.ts src/lib/ai/full-report-client.ts && echo "FAIL" || echo "OK"
```

- [ ] **Step 5: search_path = public, pg_temp (R2 B13)**

```bash
cd tudal && grep -nE "set search_path\s*=\s*public\s*,\s*pg_temp" supabase/migrations/0022_update_report_sections_0_7.sql && echo "OK" || echo "FAIL: search_path"
```

- [ ] **Step 6: raw month=p_month 0 (R1 P0 #1)**

```bash
cd tudal && grep -nE "month\s*=\s*p_month\s*[^|]" supabase/migrations/0022_update_report_sections_0_7.sql && echo "FAIL: raw" || echo "OK"
```

- [ ] **Step 7: input regex guard (R2 B14 + R3 [0-9] portability)**

```bash
cd tudal && grep -nE "p_ticker\s*!~\s*'\^\[0-9\]\{6\}\\\$'" supabase/migrations/0022_update_report_sections_0_7.sql && echo "OK" || echo "FAIL: regex guard"
```

- [ ] **Step 8: 마크다운 fence 0 — prompt module source only (R2 B10 + R4 B17 표현 정정)**

```bash
# R4 B17 fix: 본 grep은 prompt module source only — full-report-prompt.ts 전체. B16 fix 적용 후 source 안 literal fence 0이므로 OK marker 출력.
cd tudal && grep -nE '```json' src/lib/ai/prompts/full-report-prompt.ts && echo "FAIL: fence" || echo "OK"
```

- [ ] **Step 9: 전체 검증 게이트**

```bash
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```
Expected: build OK / lint 0 err / test:ci 862 → 910+ (Task 1 17 + Task 2 9 + Task 3 3 + Task 4 14 + Task 5 5 = +48; B19 suffix happy 추가) / tsc clean.

- [ ] **Step 10: Commit (없음 — Task 6은 검증만)**

---

## Self-Review checklist (writing-plans skill 강제)

**1. Spec coverage**
- 53차 §5 spec §4 PR3b row — writer + zod validation only baseline. document-specialist/analyst/critic semantic은 PR3c.
- Group E (writer Section 0~7 본문 미구현) — Task 1~5에서 해소.
- Group G (Sector reference 3-level) — **PR3c defer + HANDOFF/spec 문구 수정 필수**.
- Kevin v3.1: prompt에 M2/M3/M4/M7 substring 강제.

**2. Placeholder scan**
- "TBD" / "TODO" 0. Task 5 Step 3은 KOREAN_MAPPINGS object 명시.

**3. Type consistency**
- `CallFullReportInput` (Task 3) vs `CommitFullReportInput` (Task 4) — 다른 의도적. writer가 prompt builder 내부 호출.
- RPC param명 (Task 2 SQL) vs writer.ts (Task 4 TS) 일관.
- error 매핑: 5 키 모두 Task 5 format-error 정합.

**4. 검증 게이트 baseline (test:ci 862 → 910+ 통일 — R2 B15 + R3 B19 fix)**
- Task 1: 17 cases (8 it.each label + 1 quality 묶음 + 1 B9 + 1 B10 delimiter substring + 1 B10 JSON parse + 1 version + 4 builder).
- Task 2: 9 contract assertions (1 sig + 1 search_path + 1 guard + 1 4-grant + 1 input regex + 1 month cast + 1 update target + 1 raise + 1 return shape).
- Task 3: 3 cases.
- Task 4: 5 extractJsonObject + 9 commitFullReport (= 6 original + B11 fence + B11 prefix + B19 suffix happy) = 14 cases.
- Task 5: 5 cases.
- **합계 신규 = 17 + 9 + 3 + 14 + 5 = 48 cases**. test:ci 862 + 48 = **910+ 예상**.
- build OK / lint 0 err / tsc clean / 8 grep gates 0 매치 (또는 OK marker 출력).

---

## Execution Handoff

Plan v5 작성 완료 (omxy R1 8 + R2 7 + R3 5 + R4 4 = 누적 24 BLOCKERS fix). **다음 = omxy R5 최종 적대적 검토** — plan v5 정리 fix 정합 confirm + CONVERGED 권고.

**baseline 채택 (omxy R1+R2+R3+R4 CONVERGED-track) task 수**: 5 + 검증 1 = **6 tasks / ~25 commits / ~48 신규 tests / 862 → ~910+**.
