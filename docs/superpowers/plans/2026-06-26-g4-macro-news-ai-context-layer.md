# G4 Macro/News AI Context Layer Implementation Plan

> **For agentic workers:** Inline TDD execution (coupled build, single author). Steps use checkbox (`- [ ]`) for tracking.

**Goal:** Build a macro/news → AI context layer (G4, D33 §4) injected as context-only into the 30-report writer, morning briefing, and Tier1 persona evaluation — dormant by default, never a Tier0 factor, forward-validate.

**Architecture:** Pure distill module (`macro/context.ts`) + env/now seam (`macro/source.ts`, single flag `MACRO_CONTEXT_ENABLED` + stale fail-safe) → 3 additive consumer seams that default to current behavior when the flag is off (byte-identical).

**Tech Stack:** Next.js 16, TypeScript strict, Vitest. Reuses `@/types/macro` + `mock-macro.ts`.

## Global Constraints

- `tudal/src/lib/macro/*` MUST NOT be imported by Tier0 screening (Python `screen_shortlist_tier0.py` — structural). G4 output is a **string**, not a numeric factor.
- Single flag `MACRO_CONTEXT_ENABLED` (`process.env.MACRO_CONTEXT_ENABLED === 'true'`), default off → all 3 consumers byte-identical to current.
- Rendered macro string MUST contain: `asOf`, "예측 아님", "Tier0 스크리닝 팩터 아님".
- Stale fail-safe: source asOf older than `maxStaleDays` (default 7) → `getMacroContextString()` returns `""`.
- ₩0 — no new LLM calls. UI 한국어. No email/Resend (remove from morning-briefing; Telegram + dashboard only).
- Gate after每 task区切り: `npm run build && npm run lint && npm run test:ci && npx tsc --noEmit` (final), per-task `test:ci` on touched files.

---

### Task 1: core `macro/context.ts` (pure distill)

**Files:**
- Create: `tudal/src/lib/macro/context.ts`
- Test: `tudal/src/lib/macro/__tests__/context.test.ts`

**Interfaces — Produces:**
- `MarketRegime = MarketVerdict["overallSignal"]`
- `interface MacroDriver { category: string; signal: "bullish"|"bearish"|"neutral"; reason: string }`
- `interface MacroContext { regime: MarketRegime; score: number; headline: string; drivers: MacroDriver[]; asOf: string; source: string }`
- `interface MacroContextSource { indicators: MacroIndicator[]; verdict: MarketVerdict; source?: string }`
- `buildMacroContext(src: MacroContextSource): MacroContext`
- `renderMacroContextString(ctx: MacroContext): string`
- `const EMPTY_MACRO_CONTEXT = ""`

- [ ] Step 1: Write failing tests — buildMacroContext distill (regime=verdict.overallSignal, score=verdict.score, drivers from verdict.details, asOf=max(verdict.updatedAt, latest indicator updatedAt)); renderMacroContextString includes "예측 아님" + "Tier0 스크리닝 팩터 아님" + asOf + regime label; determinism (same input→same output).
- [ ] Step 2: Run → FAIL (module missing).
- [ ] Step 3: Implement pure builder + renderer. No env/now/IO. drivers = top verdict.details (cap ~5) mapped; headline = verdict.summary trimmed to 1 line (≤ ~160 chars).
- [ ] Step 4: Run → PASS.
- [ ] Step 5: Commit `feat(macro): G4 core macro context distill (pure)`.

### Task 2: `macro/source.ts` (flag + stale seam)

**Files:**
- Create: `tudal/src/lib/macro/source.ts`
- Test: `tudal/src/lib/macro/__tests__/source.test.ts`

**Interfaces — Consumes:** Task 1. **Produces:**
- `getMacroContextSource(): MacroContextSource` (default mock)
- `isMacroContextEnabled(): boolean`
- `getMacroContextString(opts?: { now?: Date; maxStaleDays?: number; source?: MacroContextSource }): string`

- [ ] Step 1: Failing tests — flag off → ""; flag on + fresh source (asOf within maxStaleDays) → string with disclaimers; flag on + stale (asOf > maxStaleDays before now) → ""; now/maxStaleDays/source injectable for determinism.
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement. Default `now = new Date()`, `maxStaleDays = 7`, `source = getMacroContextSource()`. Guard order: flag → stale → render.
- [ ] Step 4: Run → PASS.
- [ ] Step 5: Commit `feat(macro): G4 source seam — flag + stale fail-safe`.

### Task 3: report writer seam (`report-input-enricher.ts`)

**Files:**
- Modify: `tudal/src/lib/report/report-input-enricher.ts`
- Test: extend `tudal/src/lib/report/__tests__/report-input-enricher.test.ts` (or create if absent)

**Interfaces — Consumes:** `getMacroContextString` (Task 2), `NO_BASIS`.
- Add `EnrichReportInputOptions.buildMacroSummary?: () => string` (default `() => getMacroContextString() || NO_BASIS`).
- `enrichReportInput` sets `macroSummary = buildMacroSummary()` overriding `deriveEnrichFromShortlist`'s NO_BASIS.

- [ ] Step 1: Failing tests — default (flag off) → macroSummary === NO_BASIS (regression); injected buildMacroSummary returning "X" → macroSummary === "X".
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement (option + override). 3 callers unchanged.
- [ ] Step 4: Run → PASS + existing enricher tests green.
- [ ] Step 5: Commit `feat(macro): G4 report writer macroSummary seam (dormant)`.

### Task 4: briefing compose macro line (`briefing/compose.ts`)

**Files:**
- Modify: `tudal/src/lib/briefing/compose.ts`
- Test: extend `tudal/src/lib/briefing/__tests__/compose.test.ts`

**Interfaces:** Add `BriefingInput.macroContext?: string` + `formatMacroLine`. Insert macro line into `lines` only when non-empty (empty → current line set unchanged).

- [ ] Step 1: Failing tests — no macroContext → contentSummary/telegram identical to current; macroContext="..." → macro line appears in contentSummary + telegram.
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement formatMacroLine + conditional insert (after portfolio line, before/after news — pick a stable position; document).
- [ ] Step 4: Run → PASS.
- [ ] Step 5: Commit `feat(macro): G4 morning-briefing macro context line (dormant)`.

### Task 5: morning-briefing route — Resend removal + macro wiring

**Files:**
- Modify: `tudal/src/app/api/cron/morning-briefing/route.ts`
- Test: update `tudal/src/app/api/cron/morning-briefing/__tests__/route.test.ts`

**Changes:**
- Remove `sendEmail`/`@/lib/email/resend` import + email branch + `ADMIN_EMAILS` configError. Channels = telegram(best-effort) + dashboard. `generationFailed` no longer email-driven → finalStatus = dbError?502:200 (telegram best-effort never escalates, per silent-health convention). `briefing_failed` alert: drop email-driven path (keep only if a real failure surfaces; if none, remove the alert emission and its test).
- Add `macroContext: getMacroContextString()` to `composeBriefing` input.

- [ ] Step 1: Update tests — assert no email send; telegram best-effort; macro off → no macro line; status 200 on success.
- [ ] Step 2: Run → FAIL (until route updated).
- [ ] Step 3: Implement route changes.
- [ ] Step 4: Run → PASS.
- [ ] Step 5: Commit `refactor(briefing): drop Resend from morning-briefing (Telegram+dashboard) + wire G4 macro`.

### Task 6: Tier1 persona macro seam

**Files:**
- Modify: `tudal/src/lib/ai/anthropic-client.ts` (callPersona input + render call), `tudal/src/lib/ai/prompts/render-user-prompt.ts` (+ template), `tudal/src/lib/screening/persona-eval.ts`
- Test: extend `tudal/src/lib/ai/__tests__/*` (render) + `tudal/src/lib/screening/__tests__/persona-eval.test.ts`

**Changes:**
- `CallPersonaInput.macroContextString?: string`. Render: conditional macro block, inserted ONLY when non-empty → empty = prompt byte-identical (verify against current rendered prompt).
- `RunMonthlyPersonaEvalInput.macroContextString?: string`. eval default `const macroContextString = input.macroContextString ?? getMacroContextString()` → pass to every callPersona. Live caller unchanged (eval picks up flag).

- [ ] Step 1: Failing tests — render with empty macroContextString → byte-identical to pre-change render (snapshot of current); non-empty → macro block present; persona-eval passes macroContextString to callPersona (spy); eval default off → "".
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run → PASS.
- [ ] Step 5: Commit `feat(macro): G4 Tier1 persona macro context seam (dormant)`.

### Task 7: full gate + connection-point verification

- [ ] `npm run build && npm run lint && npm run test:ci && npx tsc --noEmit` → all green.
- [ ] grep: no `macro/*` import in any Python/Tier0 path; `email/resend` no longer imported by morning-briefing.
- [ ] Connection-point check: enricher→orchestrator macroSummary plumbing; cron→composeBriefing macroContext; eval→callPersona macroContextString.

## Self-Review

- **Spec coverage:** §3.1 core→T1; §3.2 source→T2; §3.3.1 report→T3; §3.3.2 briefing→T4+T5; §3.3.3 persona→T6; §1 guardrails→tests in T1/T2/T6; §7 connection→T7. ✓
- **Placeholder scan:** none. ✓
- **Type consistency:** `getMacroContextString`, `MacroContextSource`, `buildMacroContext`, `macroContextString` (camel) consistent across tasks. ✓
