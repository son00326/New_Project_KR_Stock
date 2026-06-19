# Tier 0 — cfg8 SURGE ON LARGE+MID (prism combined-approx) — PRE-REGISTERED ADDENDUM

**Status:** PRE-REGISTERED before any adjudicated run · EXPLORATORY / diagnostic-only · **NEGATIVE-HYPOTHESIS** · **no `--apply`, no Supabase, cost 0, offline `scripts/out/pit_cache`** · ORIGINAL git-tag `tier0-multiregime-freeze` UNTOUCHED.
**Date:** 2026-06-18 · **Owner:** Claude (fixer/verifier) ↔ omxy (critic) CONVERGED spec. USER-requested falsification.
**Does NOT edit:** `docs/superpowers/tier0-4config-decision-rules.md`, git-tag `tier0-multiregime-freeze`, `scripts/tier0_factors.py`, or the cfg1-4 / all-universe code path (byte-identical). **Companion:** `docs/superpowers/2026-06-17-tier0-cfg5-cfg6-exploratory-addendum.md` (cfg5/cfg6/cfg7 EXPLORATORY framework); this doc is the cfg8 source of truth.

---

## §1 — WHAT cfg8 IS

**cfg8 = the cfg7 daily-surge generator restricted to the `--universe largemid` tradable universe.** It is the USER-requested "prism combined-recipe approximation" falsification: take the surge proxy that approximates the prism's daily-surge leg, and run it on the only universe an admin-scale book can execute in.

- Invoked as `--generator cfg7 --universe largemid`. The CLI previously BLOCKED `--universe largemid` + any non-bpp generator (the cfg8-deferral guard). cfg8 is **un-deferred specifically**: `generator in (bpp, cfg7)` is now allowed on largemid; **cfg5/cfg6 + largemid stay BLOCKED** (no PIT-safe combo defined). The relaxation is in both the CLI guard and the `harvest_pit_months` orchestrator guard.
- Run JSON honestly carries `generator="cfg7"` (the actual generator) + `universe="largemid"` + `exploratory=true`. The adjudicator keys the files as `cfg8_<regime>.json` (via `--out`) and cross-checks `generator=="cfg7"` AND `universe=="largemid"` for cfg8 (special case `EXPECTED_GENERATOR["cfg8"] = "cfg7"`).
- cfg8 is **EXPLORATORY** — in `EXPLORATORY_CONFIGS` and `RUNNABLE_EXPLORATORY_CONFIGS`, **OUT of `DECISION_CONFIGS`**. It can never be a decision winner and confers no `--apply`.

---

## §2 — GATE + SECONDARY METRICS (same as cfg7, on largemid)

- **Gate (recall funnel):** the cfg7 funnel gate fires for cfg8 too — `aggregate_harvest` selects `gate_a_pass_largemid` on the largemid path (recall ≥ 0.20 + random-ratio + per-horizon + binding-baseline-beat). Same gate as cfg7's all-universe funnel, now measured on largemid.
- **cfg7 secondary metrics on largemid (ZERO new metric code):** `process_month` runs `_cfg7_diagnostics` for `generator_label=="cfg7"`, over the already-largemid-restricted `stocks`. `_cfg7_aggregate` pools them into `cfg7_secondary_metrics`:
  - **recall-LIFT vs random** AND **recall-LIFT vs high-volume baseline** (`cfg7_high_volume_baseline` over largemid). `recall_lift_vs_high_volume <= 0` ⇒ "indistinguishable from liquidity" (honest FAIL, not tune-to-pass).
  - lead-time-to-winner-move (per horizon, censored counted separately, never imputed), fwd 1d/5d/20d return of picks (mean + hit-rate), churn (month-over-month repeat rate).
- **Additive largemid block** also emits (universe=="largemid"): `baseline_random_largemid_recall`, `baseline_equal_rank_largemid_recall`, `leader_prevalence_in_largemid_winners`. cfg8 thus carries BOTH the cfg7 surge diagnostics AND the largemid framing.
- `exploratory=True` + `diagnostic_only=True` ⇒ "EXPLORATORY PASS/FAIL" labels + top-level `generator`/`exploratory` fields for the adjudicator cross-check.

---

## §3 — PRE-REGISTERED FAIL WORDING (verbatim) + FAIR-PRISM CAVEAT

**FAIL wording (frozen, verbatim):**
> "daily surge + largemid restriction adds no recall edge over liquidity/random in THIS offline monthly/daily harness"

— **NOT** "prism fails". cfg8 is a **daily-recall proxy** of one prism leg, not the prism.

**Fair-prism caveat (frozen):** a fair prism comparison would need **intraday triggers + executable entry/exit + slippage/fees/market-impact + position sizing + stops + P&L/risk attribution** — all **explicitly OUT of scope** for this offline monthly/daily recall harness. cfg8 cannot confirm or refute the prism; it only tests whether the surge proxy beats liquidity/random on largemid recall in this harness.

**NEGATIVE-HYPOTHESIS framing:** TASK B (cfg7 all-universe) already FAILED. cfg8 is a **falsification of surge-on-largemid**, NOT a rescue of cfg7.

---

## §4 — DRIVER + OUTPUT + ADJUDICATOR

- Driver: `scripts/run_tier0_cfg8_surge_largemid.sh` (separate; does NOT edit `run_tier0_6config_matrix.sh` / `run_tier0_largemid_freeze.sh`). Output → `scripts/out/cfg8/` as `cfg8_<regime>.json`.
- Offline `scripts/out/pit_cache`, **no `--earnings` / `--with-foreign`** (cfg7 is trend/surge-only → no DART/foreign availability concern), `allow_supabase=False` (forced by `main`: only `generator==bpp and universe==all` allows Supabase), cost 0, 3 regimes, whole-market PIT large/mid tiers.
- Adjudicator: cfg8 added to `CONFIGS`, `EXPLORATORY_CONFIGS`, `RUNNABLE_EXPLORATORY_CONFIGS`; OUT of `DECISION_CONFIGS`. Cross-check requires `generator=="cfg7"` + `exploratory==true` + `universe=="largemid"`; a mismatch is `INVALID_INPUT` (fail-closed).
- **No post-run threshold tuning. No post-run doc edits except clearly-marked factual results.** Generator / universe / gate / baselines / fail-wording / fair-prism caveat all frozen above BEFORE the run.
