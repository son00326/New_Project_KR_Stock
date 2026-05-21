---
phase: PR2-tier1-screening
reviewed: 2026-05-22T00:10:00Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - tudal/src/lib/screening/tier1-schema.ts
  - tudal/src/lib/screening/persona-eval.ts
  - tudal/src/lib/screening/__tests__/tier1-schema.test.ts
  - tudal/src/lib/screening/__tests__/tier1-screening.test.ts
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# PR2: Code Review Report — Tier 1 AI 30 선정 screening

**Reviewed:** 2026-05-22T00:10:00Z
**Depth:** deep (cross-file, contract verification against production constants)
**Files Reviewed:** 4 source files (plan doc + spec doc cross-referenced)
**Status:** issues_found (2 Critical / 5 Warning / 4 Info)

## Summary

Adversarial review of PR2 (Tier 1 AI 30 선정 screening) against omxy R1~R4 CONVERGED lock-in (9 BLOCKERS). The 5-step selection algorithm, zod schema shape, and scope purity (DB write 0) are **largely correct**. All 20 tests pass and verification gates are green.

However, **two Critical issues threaten the lock-in's actual production behavior**:

1. **CR-01 (Production persona ID mismatch)** — `TIMEFRAME_HEAVY_PERSONAS` uses snake_case persona IDs (`warren_buffett`) but production CORE_11_PERSONAS uses kebab-case (`warren-buffett`). In production, `personaWeightFor` will return `1.0` for **every** persona — collapsing the omxy-locked 1.5x heavy weighting to uniform average. Tests are internally consistent (test mocks also use snake_case) so this is undetected by the test suite, but the lock-in is silently violated when wired to the real prompts. The test file even invents two persona IDs (`ben_graham`, `aswath_damodaran`) that do not exist in production (production has `nassim-taleb` and `chair` instead).

2. **CR-02 (Duplicate-ticker corruption path)** — The function explicitly disclaims dedup ("caller normalize 책임 — 본 함수는 ticker 중복 검사 X") but the schema refinement validates only `selected.length===30` / `notSelected.length===120`, not uniqueness. A duplicate ticker passed by an upstream caller (Tier 0 union of three top-50 lists can produce duplicates by spec construction) leads to silent corruption: same ticker appears in `selected` twice, `notSelected` count drifts, and the result may zod-throw unpredictably. This is exactly the kind of contract that should be enforced at the entry point of a "single source of truth" 30-selection function.

Warnings include: missing argmax tie-break test promised by plan Test 8, hardcoded `tier1Available: true` with no caller seam, unbounded 150-way Promise.all fan-out, undocumented argmax tie-break rule (short>mid>long is only in code), and `consensus_badges_by_timeframe` placeholder mutation pattern that is fragile to future edits.

---

## Structural Findings (fallow)

No `<structural_findings>` block provided. Skipping.

---

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Production persona ID mismatch silently disables 1.5x timeframe weighting (BLOCKER)

**File:** `tudal/src/lib/screening/tier1-schema.ts:45-49`
**Severity:** BLOCKER

**Issue:** `TIMEFRAME_HEAVY_PERSONAS` lists persona IDs in **snake_case**:

```ts
export const TIMEFRAME_HEAVY_PERSONAS: Record<Timeframe, readonly string[]> = {
  short: ['stanley_druckenmiller', 'michael_burry'],
  mid: ['peter_lynch'],
  long: ['warren_buffett', 'charlie_munger', 'phil_fisher', 'mohnish_pabrai'],
} as const;
```

But production `CORE_11_PERSONAS` (verified by reading `src/lib/ai/prompts/personas/*.ts`) uses **kebab-case**:

```
chair, cathie-wood, charlie-munger, mohnish-pabrai, michael-burry,
nassim-taleb, peter-lynch, rakesh-jhunjhunwala, phil-fisher,
stanley-druckenmiller, warren-buffett
```

`personaWeightFor(personaId, tf)` does `TIMEFRAME_HEAVY_PERSONAS[tf].includes(personaId)`. Since `'warren-buffett' !== 'warren_buffett'`, **every persona will fall through to `PERSONA_WEIGHT_LIGHT = 1.0`** when wired to the real panel callback in PR1/PR4. This silently degrades the lock-in 1.5x weighting to a flat unweighted average — exactly what omxy R1~R4 was supposed to prevent.

The test suite cannot catch this because `tier1-screening.test.ts:10-22` defines its own `CORE_11_IDS` using snake_case (also internally inventing `ben_graham` and `aswath_damodaran`, which do not exist in production — see WR-04). Tests pass; production fails silently.

**Fix:** Use the production ID format. Either:

```ts
// Option A: match kebab-case persona IDs in personas/*.ts
export const TIMEFRAME_HEAVY_PERSONAS: Record<Timeframe, readonly string[]> = {
  short: ['stanley-druckenmiller', 'michael-burry'],
  mid: ['peter-lynch'],
  long: ['warren-buffett', 'charlie-munger', 'phil-fisher', 'mohnish-pabrai'],
} as const;
```

…and update the test fixture's `CORE_11_IDS` to match production. Add a build-time invariant test that imports `CORE_11_PERSONAS` from `@/lib/ai/prompts/personas` and asserts every heavy-list ID is present in the real persona list (catches future drift). Without this invariant, the same mismatch will recur.

---

### CR-02: Duplicate-ticker contract silently corrupts result (BLOCKER)

**File:** `tudal/src/lib/screening/persona-eval.ts:286-289, 395-518`
**Severity:** BLOCKER

**Issue:** The input doc-comment delegates dedup to the caller:

> "한 ticker가 여러 bucket에 포함될 수 있음 (caller normalize 책임 — 본 함수는 ticker 중복 검사 X)."

But spec §1.1 explicitly constructs `candidates = Tier 0 short top 50 + mid top 50 + long top 50 = 150`. By construction (and confirmed in the test helper `makeCandidates`), this is a union of three top-50 lists with overlapping tickers possible — and any production Tier 0 implementation that picks top-50 per timeframe will produce duplicates for tickers that score well across timeframes. The function neither validates uniqueness at entry nor enforces it in the output schema.

Downstream consequence:
1. `enriched = Promise.all(candidates.map(...))` calls `callPersonaPanel` once **per duplicate** (wasted LLM cost).
2. `aggregates` has two entries for the same ticker, possibly with different scores (if `fetchFinancials` is non-deterministic) or identical entries (wasted compute).
3. `byPrimary[tf]` may contain the same ticker twice; `slice(0, 10)` may select both copies → `primarySelected.short` could be `[T001, T001, T002, ...]` (only 9 distinct tickers).
4. `primaryTickers = new Set(...)` collapses duplicates → backfill pool may include the ticker that's already in `selected`.
5. `selected.length === 30` may pass while distinct-ticker count is 29 or fewer → schema refinement passes a corrupted result.
6. `notSelected = aggregates.filter(a => !selectedTickers.has(a.ticker))` filters all instances of selected tickers from a 150-element `aggregates` (with dupes), producing `notSelected.length` that may be ≠ 120 → schema throws unpredictably.

The current schema refinement (`selected.length===30`, `notSelected.length===120`, `shortCount+midCount+longCount===selected.length`) cannot catch this; it only enforces array shapes, not ticker-uniqueness invariant.

**Fix:** Enforce dedup at function entry and add `selected` uniqueness to the schema:

```ts
// In runTier1Screening:
if (input.candidates.length !== 150) {
  throw new Error(`tier1_candidates_must_be_150 (got ${input.candidates.length})`);
}
const distinctTickers = new Set(input.candidates.map(c => c.ticker));
if (distinctTickers.size !== input.candidates.length) {
  throw new Error(`tier1_candidates_have_duplicate_tickers (distinct=${distinctTickers.size}/150)`);
}
```

And add a refinement to `Tier1ScreeningResultSchema`:

```ts
.refine(
  (v) => new Set(v.selected.map(a => a.ticker)).size === v.selected.length,
  { message: 'selected_tickers_must_be_unique' }
)
```

Plus a test: pass `candidates` containing two duplicates → expect throw. If the caller normalize claim is the intended contract, that contract must be **validated**, not commented.

Alternatively, if upstream Tier 0 is allowed to produce duplicates, normalize inside `runTier1Screening` (e.g., merge `tier0_buckets` / `tier0_scores` per ticker by `OR` and `max`).

---

## Warnings

### WR-01: argmax tie-break rule (short > mid > long) is undocumented and untested

**File:** `tudal/src/lib/screening/persona-eval.ts:323-328`
**Severity:** WARNING

**Issue:** `argmaxTimeframe` implements a hidden tie-break `short > mid > long`:

```ts
function argmaxTimeframe(scores: Record<Timeframe, number>): Timeframe {
  if (scores.short >= scores.mid && scores.short >= scores.long) return 'short';
  if (scores.mid >= scores.long) return 'mid';
  return 'long';
}
```

The omxy lock-in (§1.1 + plan Task 2.1) requires "deterministic", and plan **Test 8** was explicitly specified:

> "Test 8: tie-breaker on weighted_scores (예: weighted={short:75, mid:75, long:50}) → 결정성 보장 (short 우선 또는 deterministic rule 명시)"

But Test 8 is **missing** from `tier1-screening.test.ts` — that file has Test 7, Test 9, Test 10–15 (skipping Test 8). The plan's own table promised 9 tests in tier1-screening, but the file only delivers 8 (Test 7, 9, 10, 11, 12, 13, 14, 15) + 1 contract test + 1 weighting test = 10 total. Test 8 specifically was dropped. The argmax tie-break behavior is therefore an **undocumented invariant** living only in code — a future refactor that flips the conditional order will silently change which timeframe wins ties.

**Fix:** Add the missing Test 8:

```ts
it('Test 8 — argmax tie on weighted_scores: short wins over mid/long', async () => {
  // construct ticker whose weighted_scores are tied
  const result = await runTier1Screening(makeInput((ticker, _pid, tf) => {
    if (ticker === 'T000' && tf !== 'long') return 75;  // short=mid=75, long=50
    if (ticker === 'T000' && tf === 'long') return 50;
    return 40;
  }));
  const t000 = [...result.selected, ...result.notSelected].find(a => a.ticker === 'T000');
  expect(t000?.primary_timeframe).toBe('short');
});
```

Also document the rule explicitly in code or `tier1-schema.ts` (e.g., "tie-break: short > mid > long, matching TIMEFRAMES declaration order").

---

### WR-02: `tier1Available: true` hardcoded with no caller seam

**File:** `tudal/src/lib/screening/persona-eval.ts:444-450`
**Severity:** WARNING

**Issue:** Inside the consensus-badge loop:

```ts
agg.consensus_badges_by_timeframe[tf] = assignBadge({
  tier1Available: true,
  tier0IsTop,
  tier1IsTop,
});
```

The doc comment claims: "PR1 wiring 시 degraded ticker는 tier1Available=false 전달해야 ⚪ 배지 산출." But `RunTier1ScreeningInput` exposes no `tier1AvailableByTicker` parameter — there is no public seam for PR1 to feed degraded-availability per-ticker.

Consequences:
- PR2 cannot ever produce ⚪ badges (5/5 lock-in badge set unreachable).
- PR1 will be forced to **modify `runTier1Screening`'s signature**, breaking the "scope purity / no signature churn" claim of PR2.
- The badge for a degraded ticker will currently always be one of {🟢, 🔵, 🟣, 🟡} based on Tier 0 / Tier 1 rank — even when Tier 1 was effectively unavailable (e.g., LLM call failed in `callPersonaPanel`). Misleading consensus signal.

**Fix:** Either (a) add `tier1AvailableByTicker?: Record<string, boolean>` to `RunTier1ScreeningInput` now (use default `true` → backward-compatible), or (b) reshape `callPersonaPanel` return type so each ticker's panel result includes an explicit `tier1Available` boolean, then thread that through to badge assignment. Option (a) is the smaller change and lets PR1 wire degraded tickers without touching PR2 logic.

Either way, drop the hardcoded `true` and make it caller-driven so the ⚪ badge is actually reachable.

---

### WR-03: 150-way unbounded `Promise.all` fan-out in `runTier1Screening`

**File:** `tudal/src/lib/screening/persona-eval.ts:405-411`
**Severity:** WARNING

**Issue:**

```ts
const enriched = await Promise.all(
  input.candidates.map(async (c) => {
    const financials = await input.fetchFinancials(c.ticker);
    const personaScores = await input.callPersonaPanel({ ticker: c.ticker, financials });
    return { candidate: c, personaScores };
  })
);
```

This fans out 150 simultaneous `fetchFinancials` + `callPersonaPanel` calls with no concurrency cap. When PR1 wires real LLM calls (Anthropic) and DART/KRX financial fetches, this will:
- Hit Anthropic per-minute rate limits (Claude 4 Sonnet ~50 rpm typical).
- Spam DART/KRX corp_code lookups (the existing 0014 cache layer helps but not always).
- On any single failure, `Promise.all` rejects the whole batch — losing 149 already-computed results.

Contrast with `runMonthlyPersonaEval` (lines 56-116) which is persona-major sequential with per-ticker fan-out inside a single persona — bounded by 1 outer loop × 30-way inner fanout, and uses settled-style per-item error handling.

**Fix:** Use a concurrency-limited helper (e.g., `p-limit` or a small custom queue) — e.g., 10-way parallel — and switch to settled-style error handling so a single panel-call failure doesn't poison the batch:

```ts
type EnrichedItem = { candidate: Tier1Candidate; personaScores: PersonaScore[] | null };
// concurrency-limited map, settled handling
const enriched: EnrichedItem[] = await mapWithConcurrency(input.candidates, 10, async (c) => {
  try {
    const financials = await input.fetchFinancials(c.ticker);
    const personaScores = await input.callPersonaPanel({ ticker: c.ticker, financials });
    return { candidate: c, personaScores };
  } catch {
    return { candidate: c, personaScores: null };  // null → tier1Available=false in WR-02 fix
  }
});
```

If concurrency cap is genuinely PR1's wire concern (because `callPersonaPanel` is the seam), at minimum add a doc comment warning callers about 150-way fan-out.

---

### WR-04: Test fixture invents non-existent persona IDs (`ben_graham`, `aswath_damodaran`)

**File:** `tudal/src/lib/screening/__tests__/tier1-screening.test.ts:10-22`
**Severity:** WARNING

**Issue:**

```ts
const CORE_11_IDS = [
  'warren_buffett', 'charlie_munger', 'phil_fisher', 'peter_lynch',
  'ben_graham',                          // ← does not exist in production
  'stanley_druckenmiller', 'michael_burry', 'mohnish_pabrai',
  'rakesh_jhunjhunwala',
  'aswath_damodaran',                    // ← does not exist in production
  'cathie_wood',
] as const;
```

Verified by `grep -rn 'ben_graham\|ben-graham\|aswath\|damodaran' src/` — both IDs exist **only** in this test file. Production `CORE_11_PERSONAS` (in `src/lib/ai/prompts/personas/index.ts:35-47`) contains `nassim-taleb` and `chair` instead.

This is a self-contained test fixture, so tests pass — but it (a) lies about the production persona roster, (b) compounds CR-01 by also using snake_case instead of kebab-case, and (c) means **the test suite does not verify the real Core 11 contract at all**. A future reader updating the test will be misled into thinking `ben_graham` is real.

**Fix:** Replace the test fixture with the actual production IDs imported from `@/lib/ai/prompts/personas`:

```ts
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';
const CORE_11_IDS = CORE_11_PERSONAS.map(p => p.id);
```

Or at minimum hardcode the real production IDs (`'chair', 'cathie-wood', ...`). Pair with CR-01 fix.

---

### WR-05: `consensus_badges_by_timeframe` placeholder mutation pattern is fragile

**File:** `tudal/src/lib/screening/persona-eval.ts:414-452, 489-498`
**Severity:** WARNING

**Issue:** Aggregates are constructed with a placeholder badge map:

```ts
consensus_badges_by_timeframe: { short: '⚪', mid: '⚪', long: '⚪' },
```

Then mutated in step 3:

```ts
for (const agg of aggregates) {
  for (const tf of TIMEFRAMES) {
    ...
    agg.consensus_badges_by_timeframe[tf] = assignBadge({...});  // in-place mutation
  }
}
```

Later, aggregates are spread into `selected`:

```ts
selected.push({ ...a, assigned_by: 'primary' });   // shallow spread
```

A shallow spread shares the `consensus_badges_by_timeframe` object reference between every downstream container (aggregates, byPrimary, primarySelected, pool, backfilled, selected, notSelected). Currently safe because no mutation occurs after the spread, but **fragile**: a future maintainer who tries to e.g. clear backfill-target timeframe badges in-place would silently corrupt the same record in `notSelected` too. Also, the comment `// Placeholder — overwritten in step 3` is a code smell pointing at an unfinished-feeling structure.

**Fix:** Construct badges first, then build aggregates immutably:

```ts
const aggregates: TickerAggregate[] = enriched.map((e) => {
  const weighted = computeWeightedScores(e.personaScores);
  const primary_timeframe = argmaxTimeframe(weighted);
  return { ticker: e.candidate.ticker, sector: e.candidate.sector,
           weighted_scores: weighted, primary_timeframe,
           consensus_badges_by_timeframe: { short: '⚪', mid: '⚪', long: '⚪' },  // overwritten next
           assigned_by: 'primary' as const,
           prompt_version_id: input.promptVersionId,
           personas_version_id: input.personasVersionId };
});
// Step 3: compute badges → produce a new object per aggregate (no mutation):
const withBadges = aggregates.map((agg) => ({
  ...agg,
  consensus_badges_by_timeframe: {
    short: assignBadge({ tier1Available: true, tier0IsTop: ..., tier1IsTop: ... }),
    mid:   assignBadge({ ... }),
    long:  assignBadge({ ... }),
  },
}));
```

Removes the mutation surface entirely.

---

## Info

### IN-01: `winning_timeframe` field is captured by schema but discarded by aggregator

**File:** `tudal/src/lib/screening/tier1-schema.ts:77-86`, `tudal/src/lib/screening/persona-eval.ts:308-321`
**Severity:** INFO

`PersonaScoreSchema` requires `winning_timeframe` (each persona's self-declared best timeframe). The aggregator never reads it — only `scores[tf]` is consumed by `computeWeightedScores`. Lock-in §1.1 doesn't require it on the aggregate side, so this is OK, but the field looks load-bearing when it is purely metadata. Either document this explicitly ("LLM audit field — not used by aggregation logic"), or use it (e.g., add a consistency check: `winning_timeframe === argmax(p.scores)`).

---

### IN-02: `tier1_candidates_must_be_150` magic number is rigid

**File:** `tudal/src/lib/screening/persona-eval.ts:398-400`
**Severity:** INFO

```ts
if (input.candidates.length !== 150) {
  throw new Error(`tier1_candidates_must_be_150 (got ${input.candidates.length})`);
}
```

Spec §1.8 explicitly notes "Tier 1 호출 범위(60/90/150) 등 비용 결정은 후속 PR로 미룬다." Future flexibility for 60/90/150 is forecast. The hardcoded 150 is consistent with current lock-in but a candidate for parameterization later (e.g., `expectedCandidateCount: number` on input, defaulting to 150). Not urgent — flag for PR1/PR4 if cost-bound modes are introduced.

---

### IN-03: `pool.sort` inside loop is correct but worth a comment

**File:** `tudal/src/lib/screening/persona-eval.ts:480-487`
**Severity:** INFO

```ts
for (const tf of TIMEFRAMES) {
  const needed = 10 - primarySelected[tf].length;
  if (needed <= 0) continue;
  pool.sort((a, b) => compareForTimeframe(a, b, tf));  // resorts per timeframe
  const taken = pool.splice(0, needed);
  ...
}
```

`pool` is resorted three times (once per timeframe) because the compare key depends on `tf`. This is correct — different timeframes have different rank orders — but `splice` mutating `pool` between iterations means short backfill takes priority over mid takes priority over long (consistent with lock-in step 5 "short→mid→long 순"). A short comment confirming this ordering invariant would help future readers.

---

### IN-04: No test for `runTier1Screening` rejecting `candidates.length !== 150`

**File:** `tudal/src/lib/screening/__tests__/tier1-screening.test.ts`
**Severity:** INFO

The entry-point guard `if (input.candidates.length !== 150) throw` is uncovered. Add:

```ts
it('throws when candidates.length !== 150', async () => {
  await expect(
    runTier1Screening({ ...makeInput(() => 50), candidates: makeCandidates(149) })
  ).rejects.toThrow(/tier1_candidates_must_be_150/);
});
```

Trivial to add; tightens the contract surface.

---

## Scope purity verification (PR2 boundary)

Grep results confirm clean scope:
- `grep cost_log|stock_reports|short_list_30|INSERT INTO|UPDATE.*SET tier1-schema.ts persona-eval.ts (new lines)` → 0 code matches (only doc-comment references on lines 109, 172, 390).
- `grep writer|admin-reports|admin-shortlist|admin/track-record|admin/portfolio` → 0 matches in `tier1-schema.ts` and new lines of `persona-eval.ts`.
- 회사명 invariant (`삼성전자|삼천당|알테오젠`) in 4 reviewed files → 0 matches.
- Existing `runMonthlyPersonaEval` (lines 36-139) and `runSectorEval` (lines 180-257) are **untouched** by diff (verified via `git diff main..HEAD`).
- Build: 25 routes OK. Lint: 0 errors / 6 warnings (pre-existing baseline). test:ci: 719/68 (+20 from 699/66 baseline). tsc: clean.

Scope purity claim holds — PR2 deliverable is pure module + zod schema + tests, no DB/UI/cron/writer wire.

---

## Lock-in vs implementation cross-check

| Lock-in item | Status |
|---|---|
| 150 candidates × 1 single-panel call | ✅ implemented (line 405-411) — but unbounded fan-out (WR-03) |
| 1.5x heavy weight: 단(Druckenmiller/Burry) 중(Lynch) 장(Buffett/Munger/Fisher/Pabrai) | ❌ **CR-01 silently broken in production** (snake_case vs kebab-case) |
| Selection 5-step (eval → aggregate → primary → top 10 → backfill) | ✅ implemented, order matches |
| `assigned_by: 'primary' | 'backfill'` metadata | ✅ (lines 493, 496) |
| tie-break: badge priority (🟢 4 > 🔵 3 > 🟣 2 > 🟡 1 > ⚪ 0) | ✅ (BADGE_PRIORITY 300-306) |
| primary tie-break: weighted_score → badge → ticker alpha | ✅ (compareForTimeframe 367-375) |
| backfill order: short → mid → long | ✅ (TIMEFRAMES declaration order, pool mutation) |
| zod schema: selected=30 / notSelected=120 / counts | ✅ (refinements 153-162) — but missing ticker uniqueness (CR-02) |
| Scope purity: in-memory only, 0 DB write | ✅ verified via grep |
| ≥12 TDD tests | ✅ 20 tests (schema 10 + screening 10) — but missing Test 8 (WR-01) |
| 5 consensus badges incl. ⚪ | ⚠ ⚪ unreachable per PR2 (WR-02 hardcoded `tier1Available: true`) |

---

_Reviewed: 2026-05-22T00:10:00Z_
_Reviewer: Claude (gsd-code-reviewer, Opus 4.7)_
_Depth: deep_
