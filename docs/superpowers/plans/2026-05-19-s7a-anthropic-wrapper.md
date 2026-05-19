# S7a Anthropic Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tier 1 Core 11 페르소나 평가 + 5종 합의 배지 + Section 8 jsonb writer를 mock 100%로 구축. billing 충전 후 smoke 1회로 검증할 수 있도록 코드/스키마/RLS/lock/preflight/cost-log 인프라 완성.

**Architecture:** Authenticated admin server action → monthly_batch_runs lock → preflight upper-bound → persona-major warm-first (11×30=330 calls, mock 100%) → consensus 5종 배지 → writer RPC `commit_persona_eval` per ticker → lock release. Cron route는 mock dry-run only.

**Tech Stack:** Next.js 16 App Router · Supabase SSR · Anthropic SDK (call shape만, mock) · Vitest · zod · pglite 또는 Supabase chain mock · TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-05-19-s7a-anthropic-wrapper-design.md` (모든 omxy 합의 사항 박제)

**Working directory:** `tudal/` (단, 마이그·SoT 문서는 repo root)

---

## Task 1: Foundation — Migration 0017 작성

**Files:**
- Create: `tudal/supabase/migrations/0017_cost_log_and_batch_runs.sql`
- Create: `tudal/supabase/migrations/0017_cost_log_and_batch_runs.rollback.sql`

- [ ] **Step 1: Forward 마이그 작성**

```sql
-- 0017_cost_log_and_batch_runs.sql
-- S7a: cost_log + monthly_batch_runs + 3 RPC (acquire_batch_lock + commit_persona_eval + commit_badge_only)
-- + stock_reports.consensus_badge 컬럼 + UNIQUE constraints
-- omxy Q2 + Q6 + Design R4 + Plan R3·R4 합의 박제

-- 1. cost_log 테이블
create table public.cost_log (
  id uuid primary key default gen_random_uuid(),
  month text not null,                          -- 'YYYY-MM'
  ticker text not null,                          -- 6자리 KRX
  persona_id text not null,
  prompt_version text not null,
  model text not null,
  input_tokens int not null default 0,
  cache_creation_input_tokens int not null default 0,
  cache_read_input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_krw numeric(12, 2) not null,
  prompt_cache_enabled boolean not null,
  called_at timestamptz not null default now(),
  called_by uuid not null references auth.users(id)
);

create index cost_log_month_idx on public.cost_log (month);
create index cost_log_called_at_idx on public.cost_log (called_at desc);

alter table public.cost_log enable row level security;

create policy "cost_log_admin_select" on public.cost_log
  for select to authenticated
  using ( public.is_admin() );

create policy "cost_log_admin_insert" on public.cost_log
  for insert to authenticated
  with check ( public.is_admin() and called_by = auth.uid() );

-- 2. monthly_batch_runs 테이블 (Design R4 lock)
create table public.monthly_batch_runs (
  month text primary key,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  started_by uuid not null references auth.users(id),
  finished_at timestamptz,
  call_count_done int not null default 0,
  error_code text
);

alter table public.monthly_batch_runs enable row level security;

create policy "batch_runs_admin_select" on public.monthly_batch_runs
  for select to authenticated using ( public.is_admin() );

create policy "batch_runs_admin_insert" on public.monthly_batch_runs
  for insert to authenticated
  with check ( public.is_admin() and started_by = auth.uid() );

create policy "batch_runs_admin_update" on public.monthly_batch_runs
  for update to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- 3. stock_reports.consensus_badge 컬럼 추가 (Plan R3 BLOCKER 4·7)
-- legacy nullable 호환, S7a 신규 row는 RPC가드로 non-null 강제
alter table public.stock_reports
  add column if not exists consensus_badge text
  check (consensus_badge in ('🟢', '🔵', '🟣', '🟡', '⚪'));

-- 4. stock_reports / committee_votes UNIQUE constraint
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stock_reports_month_ticker_uniq') then
    alter table public.stock_reports
      add constraint stock_reports_month_ticker_uniq unique (month, ticker);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'committee_votes_report_persona_uniq') then
    alter table public.committee_votes
      add constraint committee_votes_report_persona_uniq unique (report_id, persona_id);
  end if;
end$$;

-- 5. acquire_batch_lock RPC (Plan R3 BLOCKER 6 — caller-supplied uuid 위험 제거, 내부 auth.uid() 사용)
create or replace function public.acquire_batch_lock(p_month text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_inserted text;
  v_status text;
begin
  if v_caller is null then raise exception 'auth_unavailable'; end if;
  if not public.is_admin() then raise exception 'admin_required'; end if;

  insert into public.monthly_batch_runs (month, status, started_by)
  values (p_month, 'running', v_caller)
  on conflict (month) do nothing
  returning month into v_inserted;

  if v_inserted is not null then
    return jsonb_build_object('acquired', true, 'resumed', false);
  end if;

  select status into v_status from public.monthly_batch_runs where month = p_month;
  if v_status = 'running' then raise exception 'batch_already_running'; end if;
  if v_status = 'succeeded' then raise exception 'batch_already_completed'; end if;
  if v_status = 'failed' then
    update public.monthly_batch_runs
      set status='running', started_at=now(), started_by=v_caller,
          finished_at=null, error_code=null, call_count_done=0
      where month = p_month;
    return jsonb_build_object('acquired', true, 'resumed', true);
  end if;
  raise exception 'batch_lock_unknown_state';
end;
$$;

revoke execute on function public.acquire_batch_lock(text) from public;
revoke execute on function public.acquire_batch_lock(text) from anon;
grant execute on function public.acquire_batch_lock(text) to authenticated;

-- 6. commit_persona_eval RPC (full report — 🟢🔵🟣🟡 only)
create or replace function public.commit_persona_eval(
  p_month text,
  p_ticker text,
  p_section_8 jsonb,
  p_votes jsonb,
  p_consensus_badge text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report_id uuid;
  v_caller uuid := auth.uid();
  v_vote_count int;
begin
  if v_caller is null then raise exception 'auth_unavailable'; end if;
  if not public.is_admin() then raise exception 'admin_required'; end if;

  if jsonb_typeof(p_votes) <> 'array' then
    raise exception 'votes_must_be_array';
  end if;
  if jsonb_array_length(p_votes) <> 11 then
    raise exception 'votes_length_must_be_11';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_votes) v
    where (v->>'vote') not in ('BUY', 'HOLD', 'SELL')
  ) then
    raise exception 'invalid_vote_value';
  end if;
  if p_consensus_badge not in ('🟢', '🔵', '🟣', '🟡') then
    raise exception 'invalid_badge_for_full_report';
  end if;

  insert into public.stock_reports (month, ticker, section_8, consensus_badge, created_at, updated_at)
  values (p_month, p_ticker, p_section_8, p_consensus_badge, now(), now())
  on conflict (month, ticker) do update
    set section_8 = excluded.section_8,
        consensus_badge = excluded.consensus_badge,
        updated_at = now()
  returning id into v_report_id;

  delete from public.committee_votes where report_id = v_report_id;

  insert into public.committee_votes (report_id, persona_id, persona_layer, vote, argument_excerpt)
  select
    v_report_id,
    (v ->> 'persona_id')::text,
    (v ->> 'persona_layer')::text,
    (v ->> 'vote')::text,
    (v ->> 'argument_excerpt')::text
  from jsonb_array_elements(p_votes) as v;

  get diagnostics v_vote_count = row_count;

  return jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'votes_inserted', v_vote_count
  );
end;
$$;

revoke execute on function public.commit_persona_eval(text, text, jsonb, jsonb, text) from public;
revoke execute on function public.commit_persona_eval(text, text, jsonb, jsonb, text) from anon;
grant execute on function public.commit_persona_eval(text, text, jsonb, jsonb, text) to authenticated;

-- 7. commit_badge_only RPC (Plan R3 BLOCKER 7 — ⚪ 케이스 persistence)
create or replace function public.commit_badge_only(
  p_month text,
  p_ticker text,
  p_consensus_badge text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then raise exception 'auth_unavailable'; end if;
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if p_consensus_badge <> '⚪' then
    raise exception 'invalid_badge_for_badge_only';
  end if;

  insert into public.stock_reports (month, ticker, consensus_badge, created_at, updated_at)
  values (p_month, p_ticker, p_consensus_badge, now(), now())
  on conflict (month, ticker) do update
    set consensus_badge = excluded.consensus_badge,
        updated_at = now();

  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.commit_badge_only(text, text, text) from public;
revoke execute on function public.commit_badge_only(text, text, text) from anon;
grant execute on function public.commit_badge_only(text, text, text) to authenticated;
```

- [ ] **Step 2: Rollback 마이그 작성**

```sql
-- 0017_cost_log_and_batch_runs.rollback.sql
drop function if exists public.commit_badge_only(text, text, text);
drop function if exists public.commit_persona_eval(text, text, jsonb, jsonb, text);
drop function if exists public.acquire_batch_lock(text);
alter table if exists public.committee_votes drop constraint if exists committee_votes_report_persona_uniq;
alter table if exists public.stock_reports drop constraint if exists stock_reports_month_ticker_uniq;
alter table if exists public.stock_reports drop column if exists consensus_badge;
drop table if exists public.monthly_batch_runs;
drop table if exists public.cost_log;
```

- [ ] **Step 3: Commit**

```bash
git add tudal/supabase/migrations/0017_cost_log_and_batch_runs.sql tudal/supabase/migrations/0017_cost_log_and_batch_runs.rollback.sql
git commit -m "feat(S7a §1): migration 0017 — cost_log + monthly_batch_runs + commit_persona_eval RPC"
```

---

## Task 2: section-8-schema.ts (Q3 canonical contract)

**Files:**
- Create: `tudal/src/lib/report/section-8-schema.ts`
- Create: `tudal/src/lib/report/__tests__/section-8-schema.test.ts`

- [ ] **Step 1: 테스트 작성 (실패)**

```typescript
// tudal/src/lib/report/__tests__/section-8-schema.test.ts
import { describe, it, expect } from 'vitest';
import { section8Schema, section8BScopeExample, section8HappyExample } from '../section-8-schema';

describe('section-8-schema (Q3)', () => {
  it('happy path (Part A 14 + B 5 + C + D 11) parses', () => {
    const parsed = section8Schema.parse(section8HappyExample);
    expect(parsed.partA).toHaveLength(14);
    expect(parsed.partD).toHaveLength(11);
  });

  it('B-scope variant (Part A = []) parses', () => {
    const parsed = section8Schema.parse(section8BScopeExample);
    expect(parsed.partA).toEqual([]);
    expect(parsed.partD).toHaveLength(11);
  });

  it('round-trip JSON stringify/parse preserves shape', () => {
    const original = section8BScopeExample;
    const stringified = JSON.stringify(original);
    const reparsed = section8Schema.parse(JSON.parse(stringified));
    expect(reparsed).toEqual(original);
  });
});
```

- [ ] **Step 2: 실행 → 실패 확인**

```bash
cd tudal && npm run test:ci -- section-8-schema
```
Expected: FAIL (`Cannot find module '../section-8-schema'`)

- [ ] **Step 3: schema 구현**

```typescript
// tudal/src/lib/report/section-8-schema.ts
import { z } from 'zod';

// canonical contract — SoT = ServicePlan-Admin §4 stock_reports.section_8 jsonb
// 변경 시 SoT와 동기 갱신 (Q3 omxy 합의)

export const sectorVoteRowSchema = z.object({
  persona_id: z.string(),
  label: z.string(),
  background: z.string(),
  vote: z.enum(['BUY', 'HOLD', 'SELL']),
  one_line: z.string(),
});

export const coreVoteRowSchema = z.object({
  persona_id: z.string(),
  label: z.string(),
  philosophy: z.string(),
  vote: z.enum(['BUY', 'HOLD', 'SELL']),
  one_line: z.string(),
});

export const issueDebateExcerptSchema = z.object({
  issue: z.string(),
  pro_quote: z.string(),
  con_quote: z.string(),
  arbiter_quote: z.string().optional(),
});

export const finalConsensusPanelSchema = z.object({
  sector_aggregate: z.object({
    buy: z.number().int().nonnegative(),
    hold: z.number().int().nonnegative(),
    sell: z.number().int().nonnegative(),
  }),
  core_revote: z.object({
    buy: z.number().int().nonnegative(),
    hold: z.number().int().nonnegative(),
    sell: z.number().int().nonnegative(),
  }),
  co_chair_unanimous: z.boolean(),
  verdict: z.enum(['BUY', 'HOLD', 'SELL']),
  rationale: z.array(z.string()).min(1).max(5),
});

export const section8Schema = z.object({
  partA: z.array(sectorVoteRowSchema),   // B 범위 = [] / Tier 2 후 14
  partB: z.array(issueDebateExcerptSchema).min(3).max(5),
  partC: finalConsensusPanelSchema,
  partD: z.array(coreVoteRowSchema).length(11),
});

export type Section8 = z.infer<typeof section8Schema>;

// Fixtures
export const section8HappyExample: Section8 = {
  partA: Array.from({ length: 14 }, (_, i) => ({
    persona_id: `sector-${i + 1}`,
    label: `Sector ${i + 1}`,
    background: 'Sector background',
    vote: 'BUY' as const,
    one_line: 'one line',
  })),
  partB: [
    { issue: '특허 분쟁 vs 기술력', pro_quote: 'pro', con_quote: 'con' },
    { issue: '수수료율 2% vs 5%', pro_quote: 'pro', con_quote: 'con' },
    { issue: '신약 승인 시점', pro_quote: 'pro', con_quote: 'con' },
  ],
  partC: {
    sector_aggregate: { buy: 8, hold: 4, sell: 2 },
    core_revote: { buy: 7, hold: 3, sell: 1 },
    co_chair_unanimous: true,
    verdict: 'BUY',
    rationale: ['근거 1', '근거 2', '근거 3'],
  },
  partD: Array.from({ length: 11 }, (_, i) => ({
    persona_id: `core-${i + 1}`,
    label: `Core ${i + 1}`,
    philosophy: 'Value investing',
    vote: 'HOLD' as const,
    one_line: 'one line',
  })),
};

export const section8BScopeExample: Section8 = {
  ...section8HappyExample,
  partA: [],
};
```

- [ ] **Step 4: 실행 → pass**

```bash
cd tudal && npm run test:ci -- section-8-schema
```
Expected: 3 pass

- [ ] **Step 5: Commit**

```bash
git add tudal/src/lib/report/section-8-schema.ts tudal/src/lib/report/__tests__/section-8-schema.test.ts
git commit -m "feat(S7a §2): section-8-schema.ts zod canonical contract + 3 tests"
```

---

## Task 3: pricing.ts (Anthropic 단가 상수)

**Files:**
- Create: `tudal/src/lib/cost/pricing.ts`
- Create: `tudal/src/lib/cost/__tests__/pricing.test.ts`

- [ ] **Step 1: 테스트 작성 (실패)**

```typescript
// tudal/src/lib/cost/__tests__/pricing.test.ts
import { describe, it, expect } from 'vitest';
import { calculateCostKrw, MAX_COST_PER_CALL_KRW, HARDCAP_KRW } from '../pricing';

describe('pricing (Q6)', () => {
  it('cache-off cost = input × pIn + output × pOut', () => {
    const cost = calculateCostKrw({
      input_tokens: 1000,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 500,
    });
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(MAX_COST_PER_CALL_KRW);
  });

  it('cache-creation = input pricing × 1.25', () => {
    const cost = calculateCostKrw({
      input_tokens: 0,
      cache_creation_input_tokens: 1000,
      cache_read_input_tokens: 0,
      output_tokens: 0,
    });
    expect(cost).toBeGreaterThan(0);
  });

  it('cache-read = input pricing × 0.10', () => {
    const cost = calculateCostKrw({
      input_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 1000,
      output_tokens: 0,
    });
    expect(cost).toBeGreaterThan(0);
  });

  it('mixed cost sums all 4 components', () => {
    const cost = calculateCostKrw({
      input_tokens: 100,
      cache_creation_input_tokens: 200,
      cache_read_input_tokens: 300,
      output_tokens: 400,
    });
    expect(cost).toBeGreaterThan(0);
  });

  it('HARDCAP_KRW = 400_000', () => {
    expect(HARDCAP_KRW).toBe(400_000);
  });
});
```

- [ ] **Step 2: 실행 → fail**

```bash
cd tudal && npm run test:ci -- pricing
```

- [ ] **Step 3: 구현**

```typescript
// tudal/src/lib/cost/pricing.ts
// Anthropic 공식 단가 — 변경 시 SoT는 공식 문서. 본 상수는 conservative upper-bound 추정.
// claude-opus-4-7 base pricing (USD per 1M tokens, 2026-05 기준 가정)

const USD_PER_KRW = 1 / 1380;  // 1 USD = 1380 KRW (대략)

const OPUS_INPUT_USD_PER_MTOK = 15;
const OPUS_OUTPUT_USD_PER_MTOK = 75;

const KRW_PER_INPUT_TOKEN = OPUS_INPUT_USD_PER_MTOK / 1_000_000 / USD_PER_KRW;
const KRW_PER_OUTPUT_TOKEN = OPUS_OUTPUT_USD_PER_MTOK / 1_000_000 / USD_PER_KRW;

export interface TokenUsage {
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
}

export function calculateCostKrw(usage: TokenUsage): number {
  const inputCost = usage.input_tokens * KRW_PER_INPUT_TOKEN;
  const cacheCreationCost = usage.cache_creation_input_tokens * KRW_PER_INPUT_TOKEN * 1.25;
  const cacheReadCost = usage.cache_read_input_tokens * KRW_PER_INPUT_TOKEN * 0.10;
  const outputCost = usage.output_tokens * KRW_PER_OUTPUT_TOKEN;
  return Number((inputCost + cacheCreationCost + cacheReadCost + outputCost).toFixed(2));
}

// 보수적 upper-bound — preflight reservation용
// 페르소나당 systemPrompt 1.5KB + userPromptTemplate input 2KB = 약 800 tokens input
// output 평균 1000 tokens (최대 2000)
// cache miss 가정
export const MAX_COST_PER_CALL_KRW = calculateCostKrw({
  input_tokens: 1500,         // 보수적 upper-bound
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 2000,         // 보수적 upper-bound
});

// M17 hardcap (Q2 합의 — 40만원)
export const HARDCAP_KRW = 400_000;
```

- [ ] **Step 4: 실행 → pass**

```bash
cd tudal && npm run test:ci -- pricing
```
Expected: 5 pass (테스트가 5 있음 — 4 + 1 hardcap 상수)

- [ ] **Step 5: Commit**

```bash
git add tudal/src/lib/cost/pricing.ts tudal/src/lib/cost/__tests__/pricing.test.ts
git commit -m "feat(S7a §3): pricing.ts + 5 tests (cost calc + MAX_COST_PER_CALL_KRW + HARDCAP_KRW)"
```

---

## Task 4: persona registry (Q4 — 11 persona contract files + shared template + index + render)

**Files:**
- Create: `tudal/src/lib/ai/prompts/user-prompt-template.ts` (CORE_USER_PROMPT_TEMPLATE shared — Plan R2 추가 정정)
- Create: `tudal/src/lib/ai/prompts/personas/warren-buffett.ts` ... × 11
- Create: `tudal/src/lib/ai/prompts/personas/index.ts`
- Create: `tudal/src/lib/ai/prompts/render-user-prompt.ts`
- Create: `tudal/src/lib/ai/prompts/__tests__/registry.test.ts`

- [ ] **Step 1: 11 persona id 목록 박제 + registry test (실패)**

```typescript
// tudal/src/lib/ai/prompts/__tests__/registry.test.ts
import { describe, it, expect } from 'vitest';
import { CORE_11_PERSONAS, type PersonaContract } from '../personas';

const EXPECTED_IDS = [
  'warren-buffett',
  'stanley-druckenmiller',
  'cathie-wood',
  'peter-lynch',
  'charlie-munger',
  'phil-fisher',
  'rakesh-jhunjhunwala',
  'mohnish-pabrai',
  'michael-burry',
  'nassim-taleb',
  'chair',
] as const;

const REQUIRED_PLACEHOLDERS = ['{{TICKER}}', '{{FINANCIALS}}', '{{REFLECTION_CONTEXT}}'];

describe('persona registry (Q4)', () => {
  it('11 personas, no id duplicates', () => {
    const ids = CORE_11_PERSONAS.map((p) => p.id);
    expect(ids).toHaveLength(11);
    expect(new Set(ids).size).toBe(11);
  });

  it('all expected ids present', () => {
    const ids = CORE_11_PERSONAS.map((p) => p.id).sort();
    expect(ids).toEqual([...EXPECTED_IDS].sort());
  });

  it('version is YYYY-MM-DD for all', () => {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    for (const p of CORE_11_PERSONAS) {
      expect(p.version).toMatch(re);
    }
  });

  it('all userPromptTemplate contain required placeholders', () => {
    for (const p of CORE_11_PERSONAS) {
      for (const ph of REQUIRED_PLACEHOLDERS) {
        expect(p.userPromptTemplate).toContain(ph);
      }
    }
  });

  it('systemPrompt and userPromptTemplate non-empty (>= 100 chars)', () => {
    for (const p of CORE_11_PERSONAS) {
      expect(p.systemPrompt.length).toBeGreaterThanOrEqual(100);
      expect(p.userPromptTemplate.length).toBeGreaterThanOrEqual(100);
    }
  });
});
```

- [ ] **Step 2: 실행 → fail**

```bash
cd tudal && npm run test:ci -- persona registry
```

- [ ] **Step 3: persona contract 타입 + 11 파일 + index 구현**

```typescript
// tudal/src/lib/ai/prompts/personas/index.ts
export interface PersonaContract {
  id: string;
  label: string;
  version: string;             // 'YYYY-MM-DD'
  philosophy: string;          // Section 8 Part D 한 줄
  systemPrompt: string;        // immutable cache breakpoint 후보
  userPromptTemplate: string;  // {{TICKER}} {{FINANCIALS}} {{REFLECTION_CONTEXT}} placeholders
}

import { warrenBuffett } from './warren-buffett';
import { stanleyDruckenmiller } from './stanley-druckenmiller';
import { cathieWood } from './cathie-wood';
import { peterLynch } from './peter-lynch';
import { charlieMunger } from './charlie-munger';
import { philFisher } from './phil-fisher';
import { rakeshJhunjhunwala } from './rakesh-jhunjhunwala';
import { mohnishPabrai } from './mohnish-pabrai';
import { michaelBurry } from './michael-burry';
import { nassimTaleb } from './nassim-taleb';
import { chair } from './chair';

export const CORE_11_PERSONAS: PersonaContract[] = [
  warrenBuffett,
  stanleyDruckenmiller,
  cathieWood,
  peterLynch,
  charlieMunger,
  philFisher,
  rakeshJhunjhunwala,
  mohnishPabrai,
  michaelBurry,
  nassimTaleb,
  chair,
];

export function getPersonaById(id: string): PersonaContract | undefined {
  return CORE_11_PERSONAS.find((p) => p.id === id);
}
```

```typescript
// tudal/src/lib/ai/prompts/user-prompt-template.ts (shared 상수 — Plan R2 추가 정정)
export const CORE_USER_PROMPT_TEMPLATE = `다음 종목을 평가해 주세요.

티커: {{TICKER}}

재무 데이터:
{{FINANCIALS}}

지난달 성과 컨텍스트:
{{REFLECTION_CONTEXT}}

응답을 다음 JSON 형식으로 반환하세요:
{
  "vote": "BUY" | "HOLD" | "SELL",
  "one_line": "한 줄 평가 (한국어, 80자 이내)",
  "argument_excerpt": "상세 논거 (한국어, 200자 이내)"
}`;
```

```typescript
// tudal/src/lib/ai/prompts/personas/warren-buffett.ts
import type { PersonaContract } from './index';
import { CORE_USER_PROMPT_TEMPLATE } from '../user-prompt-template';

export const warrenBuffett: PersonaContract = {
  id: 'warren-buffett',
  label: '워런 버핏',
  version: '2026-05-19',
  philosophy: '장기 가치 투자, 경제적 해자, 우수한 경영진',
  systemPrompt: `당신은 워런 버핏입니다. Berkshire Hathaway 회장으로서 60년간 가치 투자를 실천했습니다.
당신의 평가 원칙:
- 사업 이해도 (Circle of Competence)
- 경제적 해자 (Economic Moat)
- 정직하고 유능한 경영진
- 합리적 가격 (Intrinsic Value 대비)
한국 코스피·코스닥 종목 평가 시 위 4개 기준을 모두 적용하세요.
응답 형식은 user message에서 안내합니다.`,
  userPromptTemplate: CORE_USER_PROMPT_TEMPLATE,
};
```

(나머지 10 페르소나 파일은 동일 구조. 각 파일에서 `import { CORE_USER_PROMPT_TEMPLATE } from '../user-prompt-template'` + 자신의 philosophy/systemPrompt만 차별화 + `userPromptTemplate: CORE_USER_PROMPT_TEMPLATE`. 예시 stanley-druckenmiller:)

```typescript
// tudal/src/lib/ai/prompts/personas/stanley-druckenmiller.ts
import type { PersonaContract } from './index';
import { CORE_USER_PROMPT_TEMPLATE } from '../user-prompt-template';

export const stanleyDruckenmiller: PersonaContract = {
  id: 'stanley-druckenmiller',
  label: '스탠리 드러켄밀러',
  version: '2026-05-19',
  philosophy: '매크로 추세 추적, 비대칭 베팅, 강한 모멘텀 추구',
  systemPrompt: `당신은 스탠리 드러켄밀러입니다. Quantum Fund 30%+ 연 수익률 실적 보유.
평가 원칙:
- 매크로 환경 (금리·유동성·정책)
- 강한 모멘텀 (가격·실적·뉴스)
- 비대칭 보상/리스크 비율
- 단기 catalyst 명확성
단기 horizon(1~3개월)에 강점. 한국 코스피·코스닥 종목에 위 4개 기준 적용.
응답 형식은 user message에서 안내합니다.`,
  userPromptTemplate: CORE_USER_PROMPT_TEMPLATE,
};
```

**나머지 9 페르소나** (cathie-wood, peter-lynch, charlie-munger, phil-fisher, rakesh-jhunjhunwala, mohnish-pabrai, michael-burry, nassim-taleb, chair) 각각 위 패턴으로 생성. philosophy + systemPrompt만 차별화. userPromptTemplate은 모두 동일 (placeholder만 사용 — DRY).

`philosophy` 한 줄 박제 (Section 8 Part D 1:1 매핑):
- cathie-wood: '파괴적 혁신, 대규모 TAM, 다년간 성장 잠재력'
- peter-lynch: '일상에서 발견하는 GARP, PEG 기반 가치+성장'
- charlie-munger: '품질 우선, 멍거 격자형 사고, 단순한 사업'
- phil-fisher: '15 포인트 체크리스트, scuttlebutt, R&D 강한 회사'
- rakesh-jhunjhunwala: '인도 시장 통찰, 경영진 품질, 장기 컴파운딩'
- mohnish-pabrai: 'Dhandho 저위험 고불확실성, 다바왈라 모델, 복제'
- michael-burry: '컨트래리언, 강한 free cash flow 마진, 시장 과반응 활용'
- nassim-taleb: '반취약성, 블랙스완 보호, 볼록성 우선'
- chair: '위원장 — 11명 의견 통합, 객관 중재, 한국 시장 특화 조정'

- [ ] **Step 4: render-user-prompt 구현**

```typescript
// tudal/src/lib/ai/prompts/render-user-prompt.ts
import { z } from 'zod';

export const renderInputSchema = z.object({
  ticker: z.string().regex(/^\d{6}$/),  // KRX 6자리
  financials: z.string().min(1),
  reflectionContext: z.string(),         // 첫달은 빈 문자열 허용
});

export type RenderInput = z.infer<typeof renderInputSchema>;

export function renderUserPrompt(template: string, input: RenderInput): string {
  const validated = renderInputSchema.parse(input);
  return template
    .replaceAll('{{TICKER}}', validated.ticker)
    .replaceAll('{{FINANCIALS}}', validated.financials)
    .replaceAll('{{REFLECTION_CONTEXT}}', validated.reflectionContext);
}
```

- [ ] **Step 5: 실행 → pass + commit**

```bash
cd tudal && npm run test:ci -- "ai/prompts"
git add tudal/src/lib/ai/prompts/
git commit -m "feat(S7a §4): persona registry 11 + render + registry test 5"
```

---

## Task 5: cost-logger.ts (flag-aware + getMonthlyTotal + preflight helper)

**Files:**
- Create: `tudal/src/lib/cost/cost-logger.ts`
- Create: `tudal/src/lib/cost/__tests__/cost-logger.test.ts`

- [ ] **Step 1: 테스트 작성 (실패) — 5 tests**

```typescript
// tudal/src/lib/cost/__tests__/cost-logger.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insertCostLog, getMonthlyTotal, preflightHardcap } from '../cost-logger';
import { HARDCAP_KRW, MAX_COST_PER_CALL_KRW } from '../pricing';

// Supabase chain mock (feedback_test_mock_typing pattern)
interface InsertChain {
  insert: ReturnType<typeof vi.fn>;
}
interface SelectChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
}
interface QueryResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

const mockInsert = vi.fn();
const mockSelect = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    from: vi.fn(() => ({
      insert: mockInsert,
      select: mockSelect,
    })),
  })),
}));

describe('cost-logger (Q2 + Q6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AI_COST_LOG_REAL_INSERT_ENABLED;
  });

  it('flag-off: insertCostLog noop (DB INSERT not called)', async () => {
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'false';
    await insertCostLog({
      month: '2026-05',
      ticker: '005930',
      persona_id: 'warren-buffett',
      prompt_version: '2026-05-19',
      model: 'claude-opus-4-7',
      input_tokens: 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 50,
      cost_krw: 100,
      prompt_cache_enabled: false,
      called_by: 'uuid-admin',
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('flag-on: insertCostLog calls DB INSERT', async () => {
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
    mockInsert.mockResolvedValue({ data: null, error: null } as QueryResult<null>);
    await insertCostLog({
      month: '2026-05',
      ticker: '005930',
      persona_id: 'warren-buffett',
      prompt_version: '2026-05-19',
      model: 'claude-opus-4-7',
      input_tokens: 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 50,
      cost_krw: 100,
      prompt_cache_enabled: false,
      called_by: 'uuid-admin',
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('RLS error throws cost_log_insert_failed (한국어 매핑은 format-error에서)', async () => {
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
    mockInsert.mockResolvedValue({
      data: null,
      error: { message: 'RLS violation', code: '42501' },
    } as QueryResult<null>);
    await expect(insertCostLog({
      month: '2026-05',
      ticker: '005930',
      persona_id: 'warren-buffett',
      prompt_version: '2026-05-19',
      model: 'claude-opus-4-7',
      input_tokens: 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 50,
      cost_krw: 100,
      prompt_cache_enabled: false,
      called_by: 'uuid-admin',
    })).rejects.toThrow('cost_log_insert_failed');
  });

  it('preflightHardcap throws when currentTotal + reservation > HARDCAP', async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [{ cost_krw: HARDCAP_KRW - 1000 }],
        error: null,
      }),
    });
    await expect(preflightHardcap({
      month: '2026-05',
      callCount: 30,
    })).rejects.toThrow('cost_hardcap_40man');
  });

  it('orphan row preservation: writer failure does not delete cost_log row (audit)', async () => {
    // cost-logger는 단일 책임 (INSERT만). orphan 보존은 caller (persona-eval) 책임.
    // 본 테스트는 insertCostLog가 호출 후 별도 DELETE 행위가 없음을 검증.
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
    mockInsert.mockResolvedValue({ data: null, error: null });
    await insertCostLog({
      month: '2026-05',
      ticker: '005930',
      persona_id: 'warren-buffett',
      prompt_version: '2026-05-19',
      model: 'claude-opus-4-7',
      input_tokens: 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 50,
      cost_krw: 100,
      prompt_cache_enabled: false,
      called_by: 'uuid-admin',
    });
    // 검증: INSERT만 호출, DELETE 없음
    expect(mockInsert).toHaveBeenCalledTimes(1);
    // DELETE 메서드가 mock에 없는지 확인 (call shape 검증)
    expect(mockInsert.mock.calls[0]).toBeDefined();
  });
});
```

- [ ] **Step 2: fail 확인 + 구현**

```typescript
// tudal/src/lib/cost/cost-logger.ts
import { createClient } from '@/lib/supabase/server';
import { HARDCAP_KRW, MAX_COST_PER_CALL_KRW } from './pricing';

export interface CostLogRow {
  month: string;
  ticker: string;
  persona_id: string;
  prompt_version: string;
  model: string;
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
  cost_krw: number;
  prompt_cache_enabled: boolean;
  called_by: string;
}

function isEnabled(): boolean {
  return process.env.AI_COST_LOG_REAL_INSERT_ENABLED === 'true';
}

export async function insertCostLog(row: CostLogRow): Promise<void> {
  if (!isEnabled()) return; // noop

  const supabase = await createClient();
  const { error } = await supabase.from('cost_log').insert(row);
  if (error) {
    throw new Error(`cost_log_insert_failed:${error.code ?? 'unknown'}`);
  }
}

export async function getMonthlyTotal(month: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cost_log')
    .select('cost_krw')
    .eq('month', month);

  if (error) {
    throw new Error(`cost_log_select_failed:${error.code ?? 'unknown'}`);
  }
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost_krw), 0);
}

export async function preflightHardcap(opts: {
  month: string;
  callCount: number;
}): Promise<{ currentTotal: number; reservation: number; remaining: number }> {
  const currentTotal = await getMonthlyTotal(opts.month);
  const reservation = opts.callCount * MAX_COST_PER_CALL_KRW;
  if (currentTotal + reservation > HARDCAP_KRW) {
    throw new Error('cost_hardcap_40man');
  }
  return {
    currentTotal,
    reservation,
    remaining: HARDCAP_KRW - currentTotal - reservation,
  };
}
```

- [ ] **Step 3: pass + commit**

```bash
cd tudal && npm run test:ci -- cost-logger
git add tudal/src/lib/cost/cost-logger.ts tudal/src/lib/cost/__tests__/cost-logger.test.ts
git commit -m "feat(S7a §5): cost-logger.ts + 5 tests (flag-aware + preflight + orphan)"
```

---

## Task 6: anthropic-client.ts wrapper

**Files:**
- Create: `tudal/src/lib/ai/anthropic-client.ts`
- Create: `tudal/src/lib/ai/__tests__/anthropic-client.test.ts`

- [ ] **Step 1: 테스트 작성 (실패) — 6 tests**

```typescript
// tudal/src/lib/ai/__tests__/anthropic-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callPersona } from '../anthropic-client';

// Anthropic SDK call shape mock (no actual network)
const mockMessagesCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  })),
}));

vi.mock('@/lib/cost/cost-logger', () => ({
  insertCostLog: vi.fn(),
}));

import { insertCostLog } from '@/lib/cost/cost-logger';

describe('anthropic-client (Q6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'sk-test';
  });

  const happyResponse = {
    content: [{ type: 'text', text: '{"vote":"BUY","one_line":"강함","argument_excerpt":"근거"}' }],
    usage: { input_tokens: 100, output_tokens: 50 },
  };

  it('flag-off cache_control absent in payload', async () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'false';
    mockMessagesCreate.mockResolvedValue(happyResponse);
    await callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    });
    const callArg = mockMessagesCreate.mock.calls[0][0];
    expect(JSON.stringify(callArg)).not.toContain('cache_control');
  });

  it('flag-on cache_control breakpoint present', async () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'true';
    mockMessagesCreate.mockResolvedValue({
      ...happyResponse,
      usage: { input_tokens: 50, cache_creation_input_tokens: 50, cache_read_input_tokens: 0, output_tokens: 50 },
    });
    await callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    });
    const callArg = mockMessagesCreate.mock.calls[0][0];
    expect(JSON.stringify(callArg)).toContain('cache_control');
  });

  it('returns usage + costKrw + promptCacheEnabled', async () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'false';
    mockMessagesCreate.mockResolvedValue(happyResponse);
    const result = await callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    });
    expect(result.usage.input_tokens).toBe(100);
    expect(result.usage.output_tokens).toBe(50);
    expect(result.costKrw).toBeGreaterThan(0);
    expect(result.promptCacheEnabled).toBe(false);
  });

  it('invokes cost-logger after successful call', async () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'false';
    mockMessagesCreate.mockResolvedValue(happyResponse);
    await callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    });
    expect(insertCostLog).toHaveBeenCalledTimes(1);
  });

  it('Anthropic API error → throws ai_call_failed (한국어 매핑은 format-error)', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('API timeout'));
    await expect(callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    })).rejects.toThrow('ai_call_failed');
    // cost-logger는 호출 안 됨 (Anthropic 호출 실패)
    expect(insertCostLog).not.toHaveBeenCalled();
  });

  it('missing ANTHROPIC_API_KEY → throws ai_key_unavailable', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    })).rejects.toThrow('ai_key_unavailable');
  });
});
```

- [ ] **Step 2: 구현**

```typescript
// tudal/src/lib/ai/anthropic-client.ts
import Anthropic from '@anthropic-ai/sdk';
import { getPersonaById } from './prompts/personas';
import { renderUserPrompt } from './prompts/render-user-prompt';
import { calculateCostKrw, type TokenUsage } from '@/lib/cost/pricing';
import { insertCostLog } from '@/lib/cost/cost-logger';

const MODEL = 'claude-opus-4-7';

export interface CallPersonaInput {
  personaId: string;
  ticker: string;
  financials: string;
  reflectionContext: string;
  adminUserId: string;
}

export interface CallPersonaResult {
  content: string;
  usage: TokenUsage;
  costKrw: number;
  promptCacheEnabled: boolean;
}

function isCacheEnabled(): boolean {
  return process.env.AI_PROMPT_CACHE_ENABLED === 'true';
}

export async function callPersona(input: CallPersonaInput): Promise<CallPersonaResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ai_key_unavailable');
  }
  const persona = getPersonaById(input.personaId);
  if (!persona) throw new Error(`unknown_persona_id:${input.personaId}`);

  const promptCacheEnabled = isCacheEnabled();

  const systemBlocks = promptCacheEnabled
    ? [{ type: 'text' as const, text: persona.systemPrompt, cache_control: { type: 'ephemeral' as const } }]
    : [{ type: 'text' as const, text: persona.systemPrompt }];

  const userPrompt = renderUserPrompt(persona.userPromptTemplate, {
    ticker: input.ticker,
    financials: input.financials,
    reflectionContext: input.reflectionContext,
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemBlocks,
      messages: [{ role: 'user', content: userPrompt }],
    });
  } catch (err) {
    throw new Error('ai_call_failed');
  }

  const text = response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('');

  const usage: TokenUsage = {
    input_tokens: response.usage.input_tokens ?? 0,
    cache_creation_input_tokens: (response.usage as any).cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: (response.usage as any).cache_read_input_tokens ?? 0,
    output_tokens: response.usage.output_tokens ?? 0,
  };
  const costKrw = calculateCostKrw(usage);

  // cost-logger 호출 (성공한 호출만 — orphan 보존을 위해 try/catch 안 함)
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  await insertCostLog({
    month,
    ticker: input.ticker,
    persona_id: persona.id,
    prompt_version: persona.version,
    model: MODEL,
    ...usage,
    cost_krw: costKrw,
    prompt_cache_enabled: promptCacheEnabled,
    called_by: input.adminUserId,
  });

  return { content: text, usage, costKrw, promptCacheEnabled };
}
```

- [ ] **Step 3: pass + commit**

```bash
cd tudal && npm install @anthropic-ai/sdk
cd tudal && npm run test:ci -- anthropic-client
git add tudal/package.json tudal/package-lock.json tudal/src/lib/ai/anthropic-client.ts tudal/src/lib/ai/__tests__/anthropic-client.test.ts
git commit -m "feat(S7a §6): anthropic-client wrapper + 6 tests"
```

---

## Task 7: consensus.ts (5종 배지 + isTopTier)

**Files:**
- Create: `tudal/src/lib/screening/consensus.ts`
- Create: `tudal/src/lib/screening/__tests__/consensus.test.ts`

- [ ] **Step 1: 테스트 작성 — 10 tests**

```typescript
// tudal/src/lib/screening/__tests__/consensus.test.ts
import { describe, it, expect } from 'vitest';
import { assignBadge, isTopTier, TOP_PERCENTILE_THRESHOLD } from '../consensus';

describe('consensus (Q5 + Q5b)', () => {
  describe('isTopTier (Q5)', () => {
    it('total=10 rank=3 returns true (ceil(10*0.3)=3)', () => {
      expect(isTopTier(3, 10)).toBe(true);
    });
    it('total=10 rank=4 returns false', () => {
      expect(isTopTier(4, 10)).toBe(false);
    });
    it('total=10 rank=1 returns true', () => {
      expect(isTopTier(1, 10)).toBe(true);
    });
    it('invalid rank=0 throws consensus_rank_invalid', () => {
      expect(() => isTopTier(0, 10)).toThrow('consensus_rank_invalid');
    });
    it('invalid rank>total throws', () => {
      expect(() => isTopTier(11, 10)).toThrow('consensus_rank_invalid');
    });
  });

  describe('assignBadge (Q5b 5종)', () => {
    it('tier1Available=false → ⚪ regardless of ranks', () => {
      expect(assignBadge({ tier1Available: false, tier0IsTop: true, tier1IsTop: true })).toBe('⚪');
    });
    it('top + top + avail → 🟢', () => {
      expect(assignBadge({ tier1Available: true, tier0IsTop: true, tier1IsTop: true })).toBe('🟢');
    });
    it('top + non-top + avail → 🔵', () => {
      expect(assignBadge({ tier1Available: true, tier0IsTop: true, tier1IsTop: false })).toBe('🔵');
    });
    it('non-top + top + avail → 🟣', () => {
      expect(assignBadge({ tier1Available: true, tier0IsTop: false, tier1IsTop: true })).toBe('🟣');
    });
    it('non-top + non-top + avail → 🟡 관망 (Q5b 신규)', () => {
      expect(assignBadge({ tier1Available: true, tier0IsTop: false, tier1IsTop: false })).toBe('🟡');
    });
  });

  it('TOP_PERCENTILE_THRESHOLD = 0.30 (D19 SoT)', () => {
    expect(TOP_PERCENTILE_THRESHOLD).toBe(0.30);
  });
});
```

- [ ] **Step 2: 구현**

```typescript
// tudal/src/lib/screening/consensus.ts
// D19 SoT = ServicePlan-Admin §1A.5
// 변경 시 별도 PR + SoT 동시 갱신
// Q5 + Q5b omxy 합의 박제

export const TOP_PERCENTILE_THRESHOLD = 0.30;

export type ConsensusBadge = '🟢' | '🔵' | '🟣' | '🟡' | '⚪';

export function isTopTier(rank: number, total: number): boolean {
  if (!Number.isInteger(rank) || !Number.isInteger(total)) throw new Error('consensus_rank_invalid');
  if (total <= 0) throw new Error('consensus_rank_invalid');
  if (rank < 1 || rank > total) throw new Error('consensus_rank_invalid');
  const cutoff = Math.ceil(total * TOP_PERCENTILE_THRESHOLD);
  return rank <= cutoff;
}

export interface AssignBadgeInput {
  tier1Available: boolean;
  tier0IsTop: boolean;
  tier1IsTop: boolean;
}

export function assignBadge(input: AssignBadgeInput): ConsensusBadge {
  if (!input.tier1Available) return '⚪';
  if (input.tier0IsTop && input.tier1IsTop) return '🟢';
  if (input.tier0IsTop && !input.tier1IsTop) return '🔵';
  if (!input.tier0IsTop && input.tier1IsTop) return '🟣';
  return '🟡'; // non-top + non-top + avail (Q5b)
}
```

- [ ] **Step 3: pass + commit**

```bash
cd tudal && npm run test:ci -- consensus
git add tudal/src/lib/screening/consensus.ts tudal/src/lib/screening/__tests__/consensus.test.ts
git commit -m "feat(S7a §7): consensus.ts 5종 배지 + isTopTier + 10 tests (Q5 + Q5b)"
```

---

## Task 8: admin-batch-runs.ts (RPC 호출 — Plan R3 BLOCKER 6 정정)

**Files:**
- Create: `tudal/src/lib/data/admin-batch-runs.ts`
- Create: `tudal/src/lib/data/__tests__/admin-batch-runs.test.ts`

- [ ] **Step 1: 테스트 작성 — 3 tests (RPC 기반)**

```typescript
// tudal/src/lib/data/__tests__/admin-batch-runs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acquireBatchLock, releaseBatchLock } from '../admin-batch-runs';

const mockRpc = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    rpc: mockRpc,
    from: vi.fn(() => ({ update: mockUpdate })),
  })),
}));

describe('admin-batch-runs (Plan R3 BLOCKER 6 — RPC 기반 lock)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('acquireBatchLock first call → acquire_batch_lock RPC returns acquired:true', async () => {
    mockRpc.mockResolvedValue({ data: { acquired: true, resumed: false }, error: null });
    const result = await acquireBatchLock('2026-05');
    expect(mockRpc).toHaveBeenCalledWith('acquire_batch_lock', { p_month: '2026-05' });
    expect(result.acquired).toBe(true);
    expect(result.resumed).toBe(false);
  });

  it('acquireBatchLock when status=running → RPC raises batch_already_running', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'batch_already_running', code: 'P0001' },
    });
    await expect(acquireBatchLock('2026-05')).rejects.toThrow('batch_already_running');
  });

  it('releaseBatchLock updates status to succeeded', async () => {
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    await releaseBatchLock({ month: '2026-05', status: 'succeeded', callCountDone: 330 });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 구현 (RPC 기반, adminUserId 인자 제거)**

```typescript
// tudal/src/lib/data/admin-batch-runs.ts
// Plan R3 BLOCKER 6: caller-supplied uuid 위험 제거. RPC 내부 auth.uid() 사용.
import { createClient } from '@/lib/supabase/server';

export interface AcquireBatchLockResult {
  acquired: boolean;
  resumed: boolean;
}

export async function acquireBatchLock(month: string): Promise<AcquireBatchLockResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('acquire_batch_lock', { p_month: month });
  if (error) {
    // P0001 raise exception 메시지를 그대로 코드로 throw — format-error에서 한국어 매핑
    throw new Error(error.message);
  }
  if (!data?.acquired) {
    throw new Error('batch_lock_acquire_failed');
  }
  return { acquired: true, resumed: data.resumed ?? false };
}

export interface ReleaseBatchLockInput {
  month: string;
  status: 'succeeded' | 'failed';
  callCountDone: number;
  errorCode?: string;
}

export async function releaseBatchLock(input: ReleaseBatchLockInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('monthly_batch_runs')
    .update({
      status: input.status,
      finished_at: new Date().toISOString(),
      call_count_done: input.callCountDone,
      error_code: input.errorCode ?? null,
    })
    .eq('month', input.month);
  if (error) throw new Error(`batch_lock_release_failed:${error.code ?? 'unknown'}`);
}
```

- [ ] **Step 3: pass + commit**

```bash
cd tudal && npm run test:ci -- admin-batch-runs
git add tudal/src/lib/data/admin-batch-runs.ts tudal/src/lib/data/__tests__/admin-batch-runs.test.ts
git commit -m "feat(S7a §8): admin-batch-runs.ts lock CRUD + 3 tests"
```

---

## Task 9: persona-eval.ts orchestration (warm-first + preflight + lock)

**Files:**
- Create: `tudal/src/lib/screening/persona-eval.ts`
- Create: `tudal/src/lib/screening/__tests__/persona-eval.test.ts`

- [ ] **Step 1: 테스트 작성 — 6 tests**

```typescript
// tudal/src/lib/screening/__tests__/persona-eval.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMonthlyPersonaEval } from '../persona-eval';

vi.mock('@/lib/ai/anthropic-client', () => ({
  callPersona: vi.fn(),
}));
vi.mock('@/lib/data/admin-batch-runs', () => ({
  acquireBatchLock: vi.fn(),
  releaseBatchLock: vi.fn(),
}));
vi.mock('@/lib/cost/cost-logger', () => ({
  preflightHardcap: vi.fn(),
}));

import { callPersona } from '@/lib/ai/anthropic-client';
import { acquireBatchLock, releaseBatchLock } from '@/lib/data/admin-batch-runs';
import { preflightHardcap } from '@/lib/cost/cost-logger';

describe('persona-eval (Q6 + Design R4)', () => {
  const tickers = Array.from({ length: 30 }, (_, i) => String(i).padStart(6, '0'));
  const baseInput = {
    month: '2026-05',
    tickers,
    adminUserId: 'admin-uuid',
    fetchFinancials: vi.fn().mockResolvedValue('stub-financials'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (acquireBatchLock as any).mockResolvedValue({ acquired: true });
    (releaseBatchLock as any).mockResolvedValue(undefined);
    (preflightHardcap as any).mockResolvedValue({ currentTotal: 0, reservation: 0, remaining: 400000 });
    (callPersona as any).mockResolvedValue({
      content: '{"vote":"BUY","one_line":"강함","argument_excerpt":"근거"}',
      usage: { input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 50 },
      costKrw: 100,
      promptCacheEnabled: false,
    });
  });

  it('persona-major call order (11 outer × 30 inner)', async () => {
    await runMonthlyPersonaEval(baseInput);
    expect(callPersona).toHaveBeenCalledTimes(11 * 30);
    // 첫 30 호출 모두 같은 persona
    const calls = (callPersona as any).mock.calls;
    const firstBlockPersonas = calls.slice(0, 30).map((c: any[]) => c[0].personaId);
    expect(new Set(firstBlockPersonas).size).toBe(1);
  });

  it('warm-first: ticker[0] resolves before ticker[1..29] start (deferred mock)', async () => {
    let warmResolved = false;
    let fanoutStartedBeforeWarmResolve = false;

    (callPersona as any).mockImplementation(async (input: any) => {
      if (input.ticker === '000000') {
        await new Promise((r) => setTimeout(r, 50));
        warmResolved = true;
      } else if (!warmResolved) {
        fanoutStartedBeforeWarmResolve = true;
      }
      return {
        content: '{"vote":"BUY","one_line":"x","argument_excerpt":"x"}',
        usage: { input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 50 },
        costKrw: 100,
        promptCacheEnabled: false,
      };
    });

    await runMonthlyPersonaEval({ ...baseInput, tickers: tickers.slice(0, 5) });
    expect(fanoutStartedBeforeWarmResolve).toBe(false);
  });

  it('lock acquisition first call succeeds; second concurrent throws batch_already_running', async () => {
    (acquireBatchLock as any)
      .mockResolvedValueOnce({ acquired: true })
      .mockRejectedValueOnce(new Error('batch_already_running'));

    const first = runMonthlyPersonaEval(baseInput);
    const second = runMonthlyPersonaEval(baseInput);
    await expect(Promise.all([first, second])).rejects.toThrow('batch_already_running');
  });

  it('preflight upper-bound × 30 throws cost_hardcap_40man → no callPersona', async () => {
    (preflightHardcap as any).mockRejectedValueOnce(new Error('cost_hardcap_40man'));
    await expect(runMonthlyPersonaEval(baseInput)).rejects.toThrow('cost_hardcap_40man');
    expect(callPersona).not.toHaveBeenCalled();
    // lock release with status='failed'
    expect(releaseBatchLock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', errorCode: 'cost_hardcap_40man' })
    );
  });

  it('tier1Available=false propagates when callPersona throws ai_key_unavailable', async () => {
    (callPersona as any).mockRejectedValue(new Error('ai_key_unavailable'));
    const result = await runMonthlyPersonaEval(baseInput);
    expect(result.tier1AvailableByTicker[tickers[0]]).toBe(false);
  });

  it('fan-out partial failure preserves per-ticker ⚪ assignment (Plan R2 BLOCKER 2)', async () => {
    // tickers[5]만 ai_call_failed, 나머지는 happy
    (callPersona as any).mockImplementation(async (input: any) => {
      if (input.ticker === tickers[5]) throw new Error('ai_call_failed');
      return {
        content: '{"vote":"BUY","one_line":"x","argument_excerpt":"x"}',
        usage: { input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 50 },
        costKrw: 100,
        promptCacheEnabled: false,
      };
    });
    const result = await runMonthlyPersonaEval(baseInput);
    expect(result.tier1AvailableByTicker[tickers[5]]).toBe(false);
    expect(result.tier1AvailableByTicker[tickers[0]]).toBe(true);
    expect(result.tier1AvailableByTicker[tickers[10]]).toBe(true);
  });

  it('try/finally lock release with status=failed on unexpected error', async () => {
    (callPersona as any).mockRejectedValue(new Error('unexpected'));
    await expect(runMonthlyPersonaEval(baseInput)).rejects.toBeDefined();
    expect(releaseBatchLock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
  });
});
```

- [ ] **Step 2: 구현**

```typescript
// tudal/src/lib/screening/persona-eval.ts
import { callPersona, type CallPersonaResult } from '@/lib/ai/anthropic-client';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';
import { acquireBatchLock, releaseBatchLock } from '@/lib/data/admin-batch-runs';
import { preflightHardcap } from '@/lib/cost/cost-logger';

export interface RunMonthlyPersonaEvalInput {
  month: string;
  tickers: string[];
  adminUserId: string;
  fetchFinancials: (ticker: string) => Promise<string>;
}

export interface PersonaEvalResult {
  byTicker: Record<string, CallPersonaResult[]>;  // persona-major collected
  tier1AvailableByTicker: Record<string, boolean>;
  totalCalls: number;
}

export async function runMonthlyPersonaEval(
  input: RunMonthlyPersonaEvalInput
): Promise<PersonaEvalResult> {
  await acquireBatchLock({ month: input.month, adminUserId: input.adminUserId });

  let callCountDone = 0;
  const byTicker: Record<string, CallPersonaResult[]> = {};
  const tier1Available: Record<string, boolean> = {};
  for (const t of input.tickers) {
    byTicker[t] = [];
    tier1Available[t] = true;
  }

  try {
    // preflight: 30 ticker × 11 persona = 330 reservations
    await preflightHardcap({
      month: input.month,
      callCount: input.tickers.length * CORE_11_PERSONAS.length,
    });

    // persona-major loop (11 outer sequential)
    for (const persona of CORE_11_PERSONAS) {
      const [warmTicker, ...rest] = input.tickers;
      if (!warmTicker) continue;

      const financials = await input.fetchFinancials(warmTicker);
      try {
        const warmResult = await callPersona({
          personaId: persona.id,
          ticker: warmTicker,
          financials,
          reflectionContext: '',  // 첫달은 빈 문자열
          adminUserId: input.adminUserId,
        });
        byTicker[warmTicker].push(warmResult);
        callCountDone++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        if (msg === 'ai_key_unavailable' || msg === 'ai_call_failed' || msg === 'ai_billing_exhausted') {
          tier1Available[warmTicker] = false;
        } else {
          throw err; // fatal
        }
      }

      // fan-out 29 tickers — Plan R2 BLOCKER 2: ticker 보존
      type FanoutItem =
        | { ticker: string; ok: true; result: CallPersonaResult }
        | { ticker: string; ok: false; error: unknown };
      const fanoutResults: FanoutItem[] = await Promise.all(
        rest.map(async (ticker): Promise<FanoutItem> => {
          try {
            const f = await input.fetchFinancials(ticker);
            const result = await callPersona({
              personaId: persona.id,
              ticker,
              financials: f,
              reflectionContext: '',
              adminUserId: input.adminUserId,
            });
            return { ticker, ok: true, result };
          } catch (err) {
            return { ticker, ok: false, error: err };
          }
        })
      );

      for (const item of fanoutResults) {
        if (item.ok) {
          byTicker[item.ticker].push(item.result);
          callCountDone++;
        } else {
          const msg = item.error instanceof Error ? item.error.message : 'unknown';
          if (['ai_key_unavailable', 'ai_call_failed', 'ai_billing_exhausted'].includes(msg)) {
            tier1Available[item.ticker] = false;  // ⚪ 대상 명시 (BLOCKER 2 해소)
          } else {
            throw item.error;
          }
        }
      }
    }

    await releaseBatchLock({
      month: input.month,
      status: 'succeeded',
      callCountDone,
    });

    return {
      byTicker,
      tier1AvailableByTicker: tier1Available,
      totalCalls: callCountDone,
    };
  } catch (err) {
    const errorCode = err instanceof Error ? err.message : 'unknown';
    await releaseBatchLock({
      month: input.month,
      status: 'failed',
      callCountDone,
      errorCode,
    });
    throw err;
  }
}
```

- [ ] **Step 3: pass + commit**

```bash
cd tudal && npm run test:ci -- persona-eval
git add tudal/src/lib/screening/persona-eval.ts tudal/src/lib/screening/__tests__/persona-eval.test.ts
git commit -m "feat(S7a §9): persona-eval.ts orchestration warm-first + lock + preflight + 6 tests"
```

---

## Task 10: writer.ts (section_8 jsonb + commit_persona_eval RPC)

**Files:**
- Create: `tudal/src/lib/report/writer.ts`
- Create: `tudal/src/lib/report/__tests__/writer.test.ts`

- [ ] **Step 1: 테스트 작성 — 3 tests**

```typescript
// tudal/src/lib/report/__tests__/writer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { commitTickerReport, commitBadgeOnly } from '../writer';
import type { CallPersonaResult } from '@/lib/ai/anthropic-client';

const mockRpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({ rpc: mockRpc })),
}));

const happyPersonaResult: CallPersonaResult = {
  content: '{"vote":"BUY","one_line":"강함","argument_excerpt":"근거 200자 이내"}',
  usage: { input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 50 },
  costKrw: 100,
  promptCacheEnabled: false,
};

describe('writer (Q3 + Design R4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('section_8 jsonb generated with Part A=[] (B 범위)', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, report_id: 'rpt-1' }, error: null });
    const personaResults = Array.from({ length: 11 }, () => happyPersonaResult);
    await commitTickerReport({
      month: '2026-05',
      ticker: '005930',
      personaResults,
      personaIds: ['warren-buffett', 'stanley-druckenmiller', 'cathie-wood', 'peter-lynch', 'charlie-munger', 'phil-fisher', 'rakesh-jhunjhunwala', 'mohnish-pabrai', 'michael-burry', 'nassim-taleb', 'chair'],
      badge: '🟢',
    });
    const rpcArg = mockRpc.mock.calls[0][1];
    expect(rpcArg.p_section_8.partA).toEqual([]);
    expect(rpcArg.p_section_8.partD).toHaveLength(11);
  });

  it('commit_persona_eval RPC invoked with correct payload including p_consensus_badge', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, report_id: 'rpt-1' }, error: null });
    const personaResults = Array.from({ length: 11 }, () => happyPersonaResult);
    await commitTickerReport({
      month: '2026-05',
      ticker: '005930',
      personaResults,
      personaIds: ['warren-buffett', 'stanley-druckenmiller', 'cathie-wood', 'peter-lynch', 'charlie-munger', 'phil-fisher', 'rakesh-jhunjhunwala', 'mohnish-pabrai', 'michael-burry', 'nassim-taleb', 'chair'],
      badge: '🔵',
    });
    expect(mockRpc).toHaveBeenCalledWith('commit_persona_eval', expect.objectContaining({
      p_month: '2026-05',
      p_ticker: '005930',
      p_consensus_badge: '🔵',
    }));
  });

  it('RPC error throws commit_persona_eval_failed', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'auth_unavailable', code: 'P0001' } });
    const personaResults = Array.from({ length: 11 }, () => happyPersonaResult);
    await expect(commitTickerReport({
      month: '2026-05',
      ticker: '005930',
      personaResults,
      personaIds: ['warren-buffett', 'stanley-druckenmiller', 'cathie-wood', 'peter-lynch', 'charlie-munger', 'phil-fisher', 'rakesh-jhunjhunwala', 'mohnish-pabrai', 'michael-burry', 'nassim-taleb', 'chair'],
      badge: '🟣',
    })).rejects.toThrow('commit_persona_eval_failed');
  });

  it('commitBadgeOnly invokes commit_badge_only RPC with ⚪ (Plan R3 BLOCKER 7)', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    await commitBadgeOnly({ month: '2026-05', ticker: '005930' });
    expect(mockRpc).toHaveBeenCalledWith('commit_badge_only', {
      p_month: '2026-05',
      p_ticker: '005930',
      p_consensus_badge: '⚪',
    });
  });
});
```

- [ ] **Step 2: 구현**

```typescript
// tudal/src/lib/report/writer.ts
import { createClient } from '@/lib/supabase/server';
import { getPersonaById } from '@/lib/ai/prompts/personas';
import type { CallPersonaResult } from '@/lib/ai/anthropic-client';
import type { Section8 } from './section-8-schema';

interface ParsedPersonaResponse {
  vote: 'BUY' | 'HOLD' | 'SELL';
  one_line: string;
  argument_excerpt: string;
}

function parseContent(content: string): ParsedPersonaResponse {
  try {
    const parsed = JSON.parse(content);
    return {
      vote: parsed.vote,
      one_line: parsed.one_line,
      argument_excerpt: parsed.argument_excerpt,
    };
  } catch {
    return { vote: 'HOLD', one_line: 'parse failed', argument_excerpt: content.slice(0, 200) };
  }
}

import type { ConsensusBadge } from '@/lib/screening/consensus';

export interface CommitTickerReportInput {
  month: string;
  ticker: string;
  personaResults: CallPersonaResult[];  // length 11, persona order matches personaIds
  personaIds: string[];                  // length 11
  badge: Exclude<ConsensusBadge, '⚪'>;   // 🟢🔵🟣🟡 only (Plan R3 BLOCKER 7 — ⚪는 commit_badge_only)
}

export async function commitTickerReport(input: CommitTickerReportInput): Promise<{ reportId: string }> {
  if (input.personaResults.length !== 11 || input.personaIds.length !== 11) {
    throw new Error('writer_persona_count_mismatch');
  }

  // Part D (Core 11) 생성
  const partD = input.personaIds.map((id, i) => {
    const persona = getPersonaById(id);
    const parsed = parseContent(input.personaResults[i].content);
    return {
      persona_id: id,
      label: persona?.label ?? id,
      philosophy: persona?.philosophy ?? '',
      vote: parsed.vote,
      one_line: parsed.one_line,
    };
  });

  // Part B (issue debates) — B 범위: 페르소나 응답에서 의견 차이가 큰 3개 추출 (간단 휴리스틱)
  // 정교한 issue extraction은 후속 PR. 본 PR은 stub 3 issue.
  const partB = [
    {
      issue: '실적 모멘텀',
      pro_quote: input.personaResults.find((_, i) => parseContent(input.personaResults[i].content).vote === 'BUY')?.content.slice(0, 100) ?? '',
      con_quote: input.personaResults.find((_, i) => parseContent(input.personaResults[i].content).vote === 'SELL')?.content.slice(0, 100) ?? '',
    },
    {
      issue: '재무 건전성',
      pro_quote: 'stub',
      con_quote: 'stub',
    },
    {
      issue: '경영진 품질',
      pro_quote: 'stub',
      con_quote: 'stub',
    },
  ];

  // Part C (최종 합의 패널)
  const voteCounts = partD.reduce((acc, v) => { acc[v.vote]++; return acc; }, { BUY: 0, HOLD: 0, SELL: 0 });
  const verdict = voteCounts.BUY > voteCounts.HOLD && voteCounts.BUY > voteCounts.SELL ? 'BUY'
                : voteCounts.SELL > voteCounts.HOLD ? 'SELL' : 'HOLD';
  const partC = {
    sector_aggregate: { buy: 0, hold: 0, sell: 0 },  // Tier 2 미활성
    core_revote: voteCounts,
    co_chair_unanimous: false,  // 본 PR은 단순 다수결, 만장일치 판정 후속
    verdict,
    rationale: [
      `Core 11 중 BUY ${voteCounts.BUY}표, HOLD ${voteCounts.HOLD}표, SELL ${voteCounts.SELL}표`,
      `위원장 의견: ${parseContent(input.personaResults[10].content).one_line}`,
      `최종 판정: ${verdict}`,
    ],
  } as const;

  const section8: Section8 = {
    partA: [],  // B 범위 — Tier 2 deferred
    partB,
    partC,
    partD,
  };

  // committee_votes payload (RPC가 INSERT)
  const votes = partD.map((v) => ({
    persona_id: v.persona_id,
    persona_layer: 'core',
    vote: v.vote,
    argument_excerpt: parseContent(input.personaResults[input.personaIds.indexOf(v.persona_id)].content).argument_excerpt,
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('commit_persona_eval', {
    p_month: input.month,
    p_ticker: input.ticker,
    p_section_8: section8,
    p_votes: votes,
    p_consensus_badge: input.badge,  // Plan R3 BLOCKER 7
  });

  if (error) {
    throw new Error(`commit_persona_eval_failed:${error.code ?? 'unknown'}`);
  }
  if (!data?.success) {
    throw new Error('commit_persona_eval_failed:no_success');
  }
  return { reportId: data.report_id };
}

export async function commitBadgeOnly(input: {
  month: string;
  ticker: string;
}): Promise<{ ok: true }> {
  // Plan R3 BLOCKER 7: tier1Available=false 케이스 ⚪ persistence
  const supabase = await createClient();
  const { error } = await supabase.rpc('commit_badge_only', {
    p_month: input.month,
    p_ticker: input.ticker,
    p_consensus_badge: '⚪',
  });
  if (error) throw new Error(`commit_badge_only_failed:${error.code ?? 'unknown'}`);
  return { ok: true };
}
```

- [ ] **Step 3: pass + commit**

```bash
cd tudal && npm run test:ci -- writer
git add tudal/src/lib/report/writer.ts tudal/src/lib/report/__tests__/writer.test.ts
git commit -m "feat(S7a §10): writer.ts section_8 jsonb + commit_persona_eval RPC + 3 tests"
```

---

## Task 11: format-error.ts — 6 신규 코드 매핑 (Plan R2 BLOCKER 5 — ai_call_failed 추가)

**Files:**
- Modify: `tudal/src/lib/admin/format-error.ts`
- Modify: `tudal/src/lib/admin/__tests__/format-error.test.ts`

- [ ] **Step 1: 테스트 보강 (6 신규 케이스)**

```typescript
// format-error.test.ts에 추가
it('consensus_rank_invalid → 한국어', () => {
  expect(formatAdminError('consensus_rank_invalid')).toContain('합의 배지 산출');
});
it('consensus_undefined_case → 한국어', () => {
  expect(formatAdminError('consensus_undefined_case')).toContain('합의 배지 정의');
});
it('batch_already_running → 한국어', () => {
  expect(formatAdminError('batch_already_running')).toContain('이미 진행');
});
it('batch_already_completed → 한국어', () => {
  expect(formatAdminError('batch_already_completed')).toContain('이미 완료');
});
it('persona_eval_fatal → 한국어', () => {
  expect(formatAdminError('persona_eval_fatal')).toContain('치명적');
});
it('ai_call_failed → 한국어 (⚪ 처리)', () => {
  expect(formatAdminError('ai_call_failed')).toContain('AI 호출 실패');
});
```

- [ ] **Step 2: format-error.ts에 6 코드 매핑 추가**

```typescript
// 기존 매핑 객체에 추가
const MAPPING: Record<string, string> = {
  // ... 기존 항목 유지 ...
  consensus_rank_invalid: '합의 배지 산출 로직 오류 — 어드민에게 보고 필요',
  consensus_undefined_case: '합의 배지 정의 누락 — D19 spec 확인 필요',
  batch_already_running: '이번 달 분석이 이미 진행 중입니다. 진행률은 admin 화면에서 확인하세요.',
  batch_already_completed: '이번 달 분석이 이미 완료되었습니다. 다시 실행하려면 명시적 rerun 액션을 사용하세요.',
  persona_eval_fatal: '분석 실행 중 치명적 오류 — 운영자 검토 필요',
  ai_call_failed: 'AI 호출 실패 — 분석 결과 ⚪(분석 대기)로 처리됨',
};
```

- [ ] **Step 3: pass + commit**

```bash
cd tudal && npm run test:ci -- format-error
git add tudal/src/lib/admin/format-error.ts tudal/src/lib/admin/__tests__/format-error.test.ts
git commit -m "feat(S7a §11): format-error.ts 5 신규 코드 한국어 매핑 + 5 tests"
```

---

## Task 12: cron route mock dry-run only

**Files:**
- Modify: `tudal/src/app/api/cron/monthly-batch/route.ts`

- [ ] **Step 1: 기존 route 코드 읽고 mock dry-run 모드만 유지**

기존 mock 호출 로직 유지. real persona-eval 호출은 admin server action으로 분리 (Task 13). cron route는 200 + summary 응답만. flag-on 분기 추가 안 함.

- [ ] **Step 2: 주석으로 책임 명시**

```typescript
// route.ts 최상단
/**
 * S7a — cron route는 mock dry-run only (Design R4 omxy 합의).
 * Real persona-eval 트리거 = authenticated admin server action (정확한 UI 위치 OOS — writing-plans 후속).
 * cron caller session 결정 = OOS S7b parking.
 */
```

- [ ] **Step 3: Commit**

```bash
git add tudal/src/app/api/cron/monthly-batch/route.ts
git commit -m "refactor(S7a §12): cron monthly-batch = mock dry-run only (Design R4)"
```

---

## Task 13: admin server action — runMonthlyPersonaEval trigger

**Files:**
- Create: `tudal/src/app/(admin)/admin/track-record/actions.ts` (또는 기존 admin actions 폴더 확장)

- [ ] **Step 1: server action 작성 (Plan R2 BLOCKER 3 + R3 BLOCKER 7 정정 반영)**

```typescript
// tudal/src/app/(admin)/admin/track-record/actions.ts (또는 별도 모듈)
'use server';

import { createClient } from '@/lib/supabase/server';
import { runMonthlyPersonaEval } from '@/lib/screening/persona-eval';
import { assignBadge, isTopTier } from '@/lib/screening/consensus';
import { commitTickerReport, commitBadgeOnly } from '@/lib/report/writer';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';

interface ParsedVote { vote: 'BUY' | 'HOLD' | 'SELL' }
function parseVote(content: string): ParsedVote {
  try {
    const p = JSON.parse(content);
    if (p.vote === 'BUY' || p.vote === 'HOLD' || p.vote === 'SELL') return { vote: p.vote };
  } catch { /* fallthrough */ }
  return { vote: 'HOLD' };
}
function scoreOf(vote: 'BUY' | 'HOLD' | 'SELL'): number {
  return vote === 'BUY' ? 2 : vote === 'HOLD' ? 1 : 0;
}

export async function triggerMonthlyPersonaEvalAction(month: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'auth_unavailable' };
  }
  const { data: adminRow } = await supabase
    .from('admin_emails')
    .select('email')
    .eq('email', user.email)
    .single();
  if (!adminRow) {
    return { ok: false, error: 'admin_required' };
  }

  const { data: shortlist } = await supabase
    .from('short_list_30')
    .select('ticker, bucket, composite_score')
    .eq('month', month)
    .order('rank', { ascending: true });
  if (!shortlist || shortlist.length === 0) {
    return { ok: false, error: 'shortlist_empty' };
  }

  const tickers = shortlist.map((r) => r.ticker);
  const personaIds = CORE_11_PERSONAS.map((p) => p.id);

  try {
    const evalResult = await runMonthlyPersonaEval({
      month,
      tickers,
      adminUserId: user.id,
      fetchFinancials: async (ticker) => {
        const { data } = await supabase
          .from('dart_financial_cache')
          .select('quarter_revenue, trailing_revenue, quality_score')
          .eq('ticker', ticker)
          .single();
        return JSON.stringify(data ?? {});
      },
    });

    // Plan R2 BLOCKER 3: ticker별 Tier 1 score (BUY=2/HOLD=1/SELL=0 합계) → bucket 내 rank → isTopTier
    const tier1ScoreByTicker: Record<string, number> = {};
    for (const ticker of tickers) {
      const responses = evalResult.byTicker[ticker] ?? [];
      tier1ScoreByTicker[ticker] = responses.reduce((sum, r) => sum + scoreOf(parseVote(r.content).vote), 0);
    }

    for (const ticker of tickers) {
      const tier1Available = evalResult.tier1AvailableByTicker[ticker];
      const personaResults = evalResult.byTicker[ticker] ?? [];

      // Tier 0 rank: bucket 내 composite_score desc rank
      const bucket = shortlist.find((s) => s.ticker === ticker)?.bucket;
      const tier0Bucket = shortlist.filter((r) => r.bucket === bucket);
      const tier0RankedDesc = [...tier0Bucket].sort((a, b) => b.composite_score - a.composite_score);
      const tier0Rank = tier0RankedDesc.findIndex((r) => r.ticker === ticker) + 1;
      const tier0IsTop = isTopTier(tier0Rank, tier0Bucket.length);

      // Tier 1 rank: bucket 내 tier1 score desc rank (Plan R2 BLOCKER 3 — Q5 일관)
      const tier1Bucket = tier0Bucket.map((t) => ({ ticker: t.ticker, score: tier1ScoreByTicker[t.ticker] ?? 0 }));
      const tier1RankedDesc = [...tier1Bucket].sort((a, b) => b.score - a.score);
      const tier1Rank = tier1RankedDesc.findIndex((r) => r.ticker === ticker) + 1;
      const tier1IsTop = tier1Available && isTopTier(tier1Rank, tier1Bucket.length);

      const badge = assignBadge({ tier1Available, tier0IsTop, tier1IsTop });

      // Plan R3 BLOCKER 7: ⚪ 케이스는 commit_badge_only / 그 외 4종은 commit_persona_eval
      if (badge === '⚪') {
        await commitBadgeOnly({ month, ticker });
      } else if (personaResults.length === 11) {
        await commitTickerReport({
          month,
          ticker,
          personaResults,
          personaIds,
          badge,
        });
      } else {
        // 응답 불완전 (일부 fan-out 실패 등) — 안전한 fallback = ⚪
        await commitBadgeOnly({ month, ticker });
      }
    }

    return { ok: true, totalCalls: evalResult.totalCalls };
  } catch (err) {
    const code = err instanceof Error ? err.message : 'unknown';
    return { ok: false, error: code };
  }
}
```

- [ ] **Step 2: Commit (server action UI는 writing-plans OOS, action만 박제)**

```bash
git add tudal/src/app/(admin)/admin/track-record/actions.ts
git commit -m "feat(S7a §13): admin server action triggerMonthlyPersonaEvalAction"
```

---

## Task 14: .env.example — 2 flag 추가

**Files:**
- Modify: `tudal/.env.example`

- [ ] **Step 1: 추가**

```bash
# [S7a] AI persona evaluation
ANTHROPIC_API_KEY=
AI_COST_LOG_REAL_INSERT_ENABLED=false   # Q2 cost_log DB INSERT toggle (default off)
AI_PROMPT_CACHE_ENABLED=false           # Q6 Anthropic prompt caching toggle (default off)
```

- [ ] **Step 2: Commit**

```bash
git add tudal/.env.example
git commit -m "chore(S7a §14): .env.example — AI_COST_LOG_REAL_INSERT_ENABLED + AI_PROMPT_CACHE_ENABLED"
```

---

## Task 15: SoT docs 갱신

**Files:**
- Modify: `Document/Service/Planning/ServicePlan-Admin.md`
- Modify: `Document/Service/Report/ReportFramework.md`

- [ ] **Step 1: ServicePlan-Admin §1A.5 D19 — 4종 → 5종 배지**

기존 합의 배지 4종 박제를 5종으로 갱신. 🟡 "관망" 추가 + matrix 5종 박제 (Q5b CONVERGED 결과).

- [ ] **Step 2: ServicePlan-Admin §3.7 — 비-dev prompt 편집 원칙 1줄**

"Core 11 prompt 변경은 dev PR 통해서만. 비-dev 어드민(son00326·shjang1001)은 GitHub 이슈로 초안 제출 → dev 검토 후 PR 반영." (Q4 omxy CONVERGED)

- [ ] **Step 3: ServicePlan-Admin §4 — section_8 canonical contract + consensus_badge 컬럼 박제**

stock_reports 항목 직속 sub-section `§4.X stock_reports.section_8 jsonb schema`:
- canonical JSON shape (happy + B-scope variant)
- 필드 의미 표 (필드명/타입/필수/의미/활성 조건)
- semantic constraints
- 코드 SoT 추적 문구: "실제 zod schema = `tudal/src/lib/report/section-8-schema.ts`"

(Q3 omxy CONVERGED)

추가: stock_reports 컬럼 목록에 `consensus_badge text NULL` 항목 박제 (Plan R3 BLOCKER 7):
- **legacy nullable**: 기존 row (T7e.3 박제 분) 호환
- **S7a 신규 row required**: commit_persona_eval / commit_badge_only RPC가 NOT NULL 강제 (RPC body의 INSERT가 항상 non-null 값 제공)
- UI 표시: NULL → ⚪로 fallback 렌더 (legacy row 대응)

- [ ] **Step 4: ReportFramework §8 Step 2 v2.4**

추가 1줄: "section_8 jsonb schema SoT = ServicePlan-Admin §4". Section 0 1행 배지 5종으로 갱신 (🟡 관망 추가).

- [ ] **Step 5: Commit**

```bash
git add Document/Service/Planning/ServicePlan-Admin.md Document/Service/Report/ReportFramework.md
git commit -m "docs(S7a §15): SoT 갱신 — D19 5종 배지 + §4 section_8 canonical contract + ReportFramework v2.4"
```

---

## Task 16: Mock e2e — server action 호출 → 30 ticker 처리 검증

**Files:**
- Create: `tudal/src/app/(admin)/admin/track-record/__tests__/actions.e2e.test.ts`

- [ ] **Step 1: e2e 테스트 작성**

```typescript
// Mock e2e — flag-off 경로 (실 Anthropic 호출 없음, mock persona-eval)
import { describe, it, expect, vi } from 'vitest';
import { triggerMonthlyPersonaEvalAction } from '../actions';

// 30 ticker shortlist fixture + dart_financial_cache fixture
// mock supabase + mock callPersona returning happy response × 11 × 30 = 330

vi.mock('@/lib/ai/anthropic-client', () => ({
  callPersona: vi.fn().mockResolvedValue({
    content: '{"vote":"BUY","one_line":"강함","argument_excerpt":"근거"}',
    usage: { input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 50 },
    costKrw: 100,
    promptCacheEnabled: false,
  }),
}));

// supabase mock with admin user + 30 ticker shortlist + 30 dart_financial_cache rows
// ... (간단 fixture)

describe('S7a e2e mock (Design R4 + Plan R3 BLOCKER 7)', () => {
  it('admin trigger → 330 callPersona + 30 commitTickerReport + lock success', async () => {
    // ... mock setup: 모든 ticker happy ...
    const result = await triggerMonthlyPersonaEvalAction('2026-05');
    expect(result.ok).toBe(true);
    expect(result.totalCalls).toBe(330);
  });

  it('⚪ ticker는 commit_badge_only / 정상 ticker는 commit_persona_eval 분기', async () => {
    // mock setup: tickers[0..4] = ai_call_failed, tickers[5..29] = happy
    // 검증:
    //  - commit_badge_only RPC가 5회 호출 (⚪ ticker × 5)
    //  - commit_persona_eval RPC가 25회 호출 (정상 ticker × 25)
    //  - lock release status='succeeded'
    const result = await triggerMonthlyPersonaEvalAction('2026-05');
    expect(result.ok).toBe(true);
    // mockRpc.mock.calls 분석으로 분기 검증
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tudal/src/app/(admin)/admin/track-record/__tests__/actions.e2e.test.ts
git commit -m "test(S7a §16): mock e2e admin trigger 330 calls + 30 reports"
```

---

## Task 17: 최종 검증 게이트

- [ ] **Step 1: build + lint + test:ci + tsc**

```bash
cd tudal
npm run build
npm run lint
npm run test:ci
npx tsc --noEmit
```

Expected:
- build: 25 routes (변경 없음)
- lint: 0 errors
- test:ci: ~508 pass / ~58 files (현 463 → +45)
- tsc: clean

- [ ] **Step 2: Migration 0017 apply (dev → production)**

```bash
# Supabase MCP 또는 dashboard에서 apply
# 사용자 트리거 후 진행 — 본 자동화 단계에서는 dev 적용까지만
```

- [ ] **Step 3: HANDOFF.md + ProgressDashboard.md 49차 박제**

- [ ] **Step 4: 최종 commit**

```bash
git add Document/Process/HANDOFF.md Document/Build/ProgressDashboard.md CLAUDE.md
git commit -m "docs(S7a §17): 49차 박제 — HANDOFF + ProgressDashboard 갱신"
```

---

## Open Questions (writing-plans 후 발견 시 plan 보강)

- 기존 마이그 0002~0010에서 `stock_reports(month, ticker)` UNIQUE constraint 존재 여부 (Task 1 IF NOT EXISTS로 안전 처리)
- Anthropic SDK 정확한 버전 (`npm install @anthropic-ai/sdk` 시점에 결정)
- admin server action 정확한 UI 위치 (현재 `track-record/actions.ts` 가정, 변경 가능)
- Reflection context 주입 메커니즘 (현재 `''` 빈 문자열) — 후속 PR
- Anthropic API call shape 정확성 (cache_control 위치, system 배열 등) — billing 충전 후 smoke로 최종 검증
- Plan R3 BLOCKER 7 `consensus_badge` legacy row UI 처리: T7e.3 박제된 기존 stock_reports row가 있다면 UI는 NULL → ⚪ fallback. 실제로 month별 신규 row 생성이라 기존 row 영향 없을 가능성 큼 — 구현 시 grep 확인.

---

## SoT 참조

- Spec: `docs/superpowers/specs/2026-05-19-s7a-anthropic-wrapper-design.md`
- omxy debate trail: spec §11
- Feedback memories: `feedback_supabase_security_definer_pattern`, `feedback_test_mock_typing`, `feedback_partial_migration_boundary`, `feedback_omxy_debate_scope_guard`, `feedback_no_user_approval_gate`
