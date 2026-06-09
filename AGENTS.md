# AGENTS.md — New_Project_KR_Stock

Last reviewed: 2026-06-09

## Purpose

This repository is the planning and implementation workspace for **주픽(JooPick)**, an internal investment operations tool for the owner and two friends. The current product track is not a public MVP. Treat member-facing pages, public signup, legal terms, and 500-user invite flows as **Deferred-D** unless the user explicitly reopens that track.

Current state:
- `Mock Skeleton` complete (S0~S6); DQ-7 credential system ~97% (user-led smoke/deploy items remain).
- The real-data + real-AI MVP engine (W0~W3) is **code-complete and merged**: W0→W2a→W2b→W1a→W1b→W3a→W3b-1→W3b-2a→W3b-2b→W3b-3→W3b-2c (all ✅). Migrations 0001~0036 applied.
- **P3 cheap selection smoke ✅** (real AI, 1 midlong ticker, worker plumbing verified end-to-end). Next is the USER-gated **full P3 selection** (cost approval), then P2b/P4.
- S8 stock + Binance auto-trading remains **post-release / deferred** unless the user explicitly reopens it.

## Repository Layout

- `Document/` — source of truth for planning, slice status, handoff, and product decisions.
- `tudal/` — actual Next.js app. The folder name is legacy but must not be renamed.
- `backtest/` — strategy and crisis-layer backtest scripts.
- `scripts/` — root operational scripts, including Python utilities.
- `.omc/`, `.claude/` — workflow/tooling state. Do not edit unless the task is explicitly about agent or workflow setup.

## Session Entry Routine

At the start of non-trivial work, read these in order:

1. `Document/Process/HANDOFF.md`
2. `Document/Build/ProgressDashboard.md`
3. The current active slice file under `Document/Build/Slices/`
4. `Document/Service/Planning/ServicePlan-Admin.md`
5. `Document/Business/BusinessPlan.md`
6. `Document/Process/ExecutionPlaybook.md`
7. `Document/Process/CodebaseStatus.md`

Use `HANDOFF.md` for the next action, `ProgressDashboard.md` for slice state, the active slice for task-level scope, and `CodebaseStatus.md` for the current implementation snapshot.

Do not use archived files as current guidance. Files under `Document/Archive/` are historical references only.

## Current Execution Priority

`Document/Process/HANDOFF.md` is the live source of truth — re-read it first. As of 71차 (2026-06-09):

1. **Full P3 AI 30-selection** — USER cost-approval gate (~₩6.5-9만) + reservation re-check. The cheap 1-ticker smoke is already verified.
2. Then **P2b** (Section 8 live canary on an AI-badged ticker), then **P4** (30 full reports).
3. USER gates for the live path: Vercel flags (`SELECTION_CRON_AUTO_ENABLED`, `PR5B_SECTION8_ENABLED`, `PORTFOLIO_*`, `KRX_OPENAPI_KEY`) + weekly tier0 producer (Python).
4. Then S7b news/briefing, S7c intraday/exit, S7d silent health, S9 operation validation.
5. S8 live auto-trading remains post-release / deferred unless the slice reopens it.

DQ-7 remaining items are user-led smoke/deploy checks, not the active code track unless the user says otherwise.

## Development Commands

All app engineering commands run from `tudal/`:

```bash
cd tudal
npm run dev
npm run build
npm run lint
npm run test:ci
```

Verification gate for meaningful code changes:

```bash
cd tudal
npm run build && npm run lint && npm run test:ci
```

Use `npm run test` only for watch-mode development. If `npm run dev` hits macOS file descriptor limits, raise the shell limit before retrying.

## App Stack

- Next.js `16.2.3` + React `19.2.4` + App Router.
- TypeScript strict mode.
- Tailwind v4 + shadcn `base-nova` + Base UI.
- Supabase SSR for auth/session/RLS.
- Vitest for pure logic tests.
- Recharts for charts.
- `lucide-react` as the only icon library.

Next.js 16 differs from older training data. Before editing routing, middleware, metadata, server actions, `next/*` imports, or dynamic params, check `tudal/node_modules/next/dist/docs/` or an official documentation source.

## Coding Conventions

- Follow the nearest lower-level `AGENTS.md`; it overrides this root file for its subtree.
- Use `@/*` imports inside `tudal/src`; do not use deep `../../` imports across `src`.
- Keep UI text Korean-first. Code identifiers stay English.
- Prefer Server Components. Add `"use client"` only for state, effects, events, or browser APIs.
- Server Actions return `{ success: true, data }` or `{ success: false, error: string }`.
- Data-dependent UI must explicitly handle loading, error, and empty states.
- Use `cn()` from `@/lib/utils` for conditional class names.
- Use `formatKRW`, `formatPrice`, and `formatPercent` from `@/lib/constants` for money/percent display.
- Do not reintroduce subscription/tier/pricing concepts removed in S0.

## Data And Backend Rules

- Current data is still mock-first. Do not silently switch mock imports to real APIs outside the relevant S7 task.
- Supabase access should use the correct SSR client for the context:
  - Server Component, Server Action, Route Handler: `@/lib/supabase/server`
  - Client Component: `@/lib/supabase/client`
  - Middleware: `@/lib/supabase/middleware`
- `/admin` access relies on Supabase session refresh, `ADMIN_EMAILS` allowlist, and RLS. Keep all three layers intact.
- Never use `SUPABASE_SERVICE_ROLE_KEY` in client-exposed code.
- Credential secrets must stay server-side and encrypted with `src/lib/crypto/aes.ts`; never return plaintext, MEK values, or raw ciphertext in UI or logs.
- KIS/Binance credentials are per-admin DB records, not global `KIS_*` or `BINANCE_*` environment variables.

## Product And Legal Constraints

- This admin track is for three internal admins. Do not build public member onboarding unless Deferred-D is reopened.
- Keep the fixed disclaimer: the service provides information and is not investment advice.
- For member-facing Deferred-D work, avoid direct buy/sell recommendation language.
- S8 auto-trading guardrails are default constraints: leverage <= 5x, daily loss stop at -3%, AI order limit <= 20/day.
- Live-account and mainnet toggles are representative-only by `ADMIN_REP_EMAIL` unless the slice changes that rule.

## Documentation Routing

When changing docs, write to the narrowest correct source:

- Business decisions, finance, legal structure: `Document/Business/BusinessPlan.md`
- Admin product planning, IA, feature requirements: `Document/Service/Planning/ServicePlan-Admin.md`
- Member product planning: `Document/Service/Planning/ServicePlan-Member.md`
- Task progress and DoD: current `Document/Build/Slices/*.md`
- Slice status transitions: `Document/Build/ProgressDashboard.md`
- Next-session handoff: `Document/Process/HANDOFF.md`
- Current codebase snapshot: `Document/Process/CodebaseStatus.md`
- Workflow or agent/skill mapping changes: `Document/Process/ExecutionPlaybook.md`

Do not duplicate the same decision across multiple documents. Route it once, then reference it elsewhere if needed.

## Agent And Skill Workflow

- Use Superpowers/gstack-style process for planning, TDD, debugging, verification, and review.
- For non-trivial work, inspect the codebase and write a short plan before editing.
- Use agents for independent, parallelizable investigation or implementation tasks. Keep their scope narrow and disjoint.
- Follow `Document/Process/ExecutionPlaybook.md` for slice lifecycle, agent/skill mapping, and execution engine choice.
- `deepinit` is not the same as a harness. Historical project guidance says deepinit was a one-time S0 convention extraction step; do not rerun a full deepinit without a specific reason and user confirmation.

## Git And Safety

- The user may have uncommitted work. Do not revert or overwrite changes you did not make.
- Review diffs before committing or pushing.
- Never hardcode secrets.
- Validate inputs at server and API boundaries.
- Prefer focused, reversible changes.

