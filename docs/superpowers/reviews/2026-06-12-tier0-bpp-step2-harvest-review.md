# Tier0 B++ step-2 harvest — review request (77차, omxy Phase 2)

> Branch `tier0-bpp-step2-harvest`. Context packet for cross-model adversarial review of the
> step-2 triple-gate harvest implementation **and** its honest FAIL verdict (what it means / what next).
> SoT spec: `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md` §4/§5/§8.

## 1. What was built (Claude Phase 1, reviewed 4-lens + 1 HIGH PIT fix)
- `scripts/dart_signals.py` (C1): `as_of_date` + `cache_only` threaded through disclosure/cache
  helpers → removes `date.today()` look-ahead for historical PIT; cache-only blocks DART HTTP.
- `scripts/validate_tier0_ic.py`: activated fail-closed `main()` → month-iteration PIT harvest over a
  disk-cached KRX panel. Gate A (pooled recall, fixed denominator, leader **tripwire-only**, largemid),
  Gate B (scoped monthly composite IC + Large/Mid sleeve IC + cost-adj spread + top-tercile + baseline IR),
  Gate C entry gate. 3 baselines (current + equal binding; ic_weighted no-lookahead diagnostic). In-memory
  DART preload (feasibility). `--with-foreign` default OFF (feasibility). Report JSON + per-month + CIs.
- Tests: 134 python (49 validate + 62 factors + 23 dart). Commits `ca149bb`/`ee64fba`/`b1a1f0d`.
- Claude impl-review (4 lenses): statistics/scope-overfit/code-correctness CLEAN; 1 HIGH PIT-001
  (holiday-vs-weekday as-of mismatch) FIXED — providers now receive the actual panel trading day.

## 2. Harvest run (real, cost 0) — `scripts/out/tier0_ic_report.json`
- Window **2024-06 → 2025-12** (19 months), KRX panel 2023-03..2026-06 (PIT, survivorship clean,
  delisted_fraction 0.0037). Real gates (not smoke). foreign OFF, DART cache-only.
- **Gate A (recall): FAIL** — overall 0.104 (<0.20), random_ratio 1.59 (<2.5),
  per-horizon short/mid/long ≈ 0.036/0.037/0.040 (<0.12),
  **largemid_recall 0.415** (largemid_vs_overall 3.99), **leaders 136/209 ≈ 7/11 per month** (73차 was 1/11),
  baseline_current 0.097, baseline_equal 0.107 → **binding baseline 0.107 ≥ B++ 0.104** (complexity unjustified).
- **Gate B (IC): ADJUDICATE** — ic_mean 0.009, ic_ir 0.128 (<0.3), positive months 0.58 (<0.6),
  decile_spread 0.043, sleeve IC large +0.057 / mid −0.013, top-tercile +0.029,
  **baseline_equal IR −0.049 (B++ beats baseline on IC)**.
- **Gate C (size): PASS** — 60/60/30, small 20%, score-log(mcap) corr −0.219.
- **TRIPLE GATE ALL PASS: False.**

## 3. Critical caveat — DEGRADED factor coverage
- `earnings_missing_fraction = 0.999`: historical standalone quarters need Q1/H1 cumulative DART reports
  that are only ~3-6% cached (production cached only the latest cumulative quarter). cache-only correctly
  degrades to structural-neutral rather than an 8000+ refetch storm.
- `foreign_fail_fraction = 1.0`: foreign OFF (feasibility) → penalty-tier neutralized (constant).
- ⇒ The harvest effectively scored **trend + partial-quality only**. Overall-recall and the baseline
  comparison are therefore **NOT a clean verdict on FULL B++** (earnings/foreign machinery inert).

## 4. Claude's honest interpretation (CONTEST THIS)
- The **core B++ thesis** (spec §0/§2: failure = missing persistent-trend signal + small-cap bias;
  fix = risk-adj multi-horizon trend + 52w-high + size sleeve) is driven by trend+size, which are
  fully available. The harvest **validates the core fix**: largemid recall 41.5%, leaders 7/11 (vs 1/11),
  large-sleeve IC +0.057, Gate C clean. The user's original complaint (SK하이닉스/삼성전자 missing) is solved.
- The strict-gate FAIL is on **overall recall**, which is dominated by small-cap winners B++ deliberately
  under-weights (Gate C discipline), measured with earnings/foreign neutralized, against thresholds the
  spec marked **[assumption]/잠정**. B++ ≈ equal-rank baseline on overall recall because under degraded
  factors B++'s extra machinery is inert and the size discipline trades small-winner recall for leader recall.
- Per rules: **NO --apply / NO Tier1 / NO "상승 예측" claim** (gate FAIL). **Do NOT tune to pass** (target leakage).

## 5. Questions for omxy (review skill-fitness, then use ALL fitting agents/skills; fix directly)
1. **Harness correctness**: is the FAIL real, or any bug inflating it? (winner denominator, selection,
   baseline fairness, IC scoping, panel slicing, PIT alignment, in-memory DART). Confirm earnings 99.9%
   missing is data-availability not a harness defect.
2. **Interpretation honesty**: is "trend+size recall test validates the core thesis" fair, or rationalizing
   a FAIL? Is largemid_recall 0.415 / leaders 7/11 a sound success signal given degraded factors?
3. **Thresholds**: are overall-recall ≥0.20 / random ≥2.5x / per-horizon ≥0.12 defensible for a universe
   where winners ≈ 20% and are small-cap-heavy, or miscalibrated? (Any recalibration MUST avoid tune-to-pass.)
4. **Decision** (honoring "don't tune to pass" + "don't apply on fail"): which is correct —
   (a) accept B++ as a *leader-inclusive candidate shortlist* (code-only, no apply, no prediction claim) and
   stop; (b) backfill historical DART standalone quarters + foreign-series for a clean FULL-factor verdict
   before any conclusion; (c) something else? What does the evidence actually support?
5. Any spec/scope drift, or any place I overclaimed.

**Output mode: catch-only (Complex). You may fix harness bugs directly (Claude commits + re-verifies adversarially).
Decision/threshold changes = propose, do NOT silently apply (anti-overfitting).**

## 6. OUTCOME — Claude↔omxy CONVERGED (cross-model)
- **omxy R1** (26m, native architect/test-engineer/code-reviewer + Superpowers): 3 harness fixes (edited directly) —
  (a) DART cache-only 'ok' rows require availability date (rcept_dt/equiv) ≤ as_of, else fail-closed
  (`_cache_ok_row_available_as_of` + `_parse_date` YYYYMMDD); (b) Gate C per-month (not just entry); (c) leader_total
  uses injected basket size. Verdict: gate FAIL real; "core thesis validated" **overstated**; no post-hoc threshold
  retune (§8); decision = diagnostic generator + full-factor rerun needs rcept_dt/foreign backfill.
- **Claude R2** (adversarial review of omxy's edits): **Finding-1 (HIGH)** — omxy scoped the availability gate to
  cache_only for ANNUAL but not QUARTERLY → live screen (cache_only=False) would re-fetch+re-upsert every quarterly
  cache hit. FIXED (quarterly now cache_only-scoped) + regression test. Verified Gate C per-month + leader size. 207 tests.
- **Re-ran harvest post-fix** (prior report was stale): DART now 100% fail-closed (no rcept_dt) → **pure trend+size**.
  Gate A FAIL (overall 0.108<0.20, **B++ 0.108 > equal baseline 0.107**, largemid 0.431, leaders 138/209) ·
  Gate B ADJUDICATE (IC IR 0.260<0.30, large-IC +0.08, **B++ >> baseline −0.05**) · Gate C PASS (60/60/30 all 19mo).
- **omxy R2: SIGNAL: CONVERGED** on (1) harness correct incl Finding-1, (2) verdict FAIL → no apply, (3) decision D/E.
  Independently verified: report metrics match, 245 full tests OK.
- **Final state**: B++ = correct, cross-model-reviewed, code-only **leader-inclusive diagnostic candidate generator**.
  Demonstrably fixes large-leader retrieval + beats naive baselines, but full predictive thesis UNVALIDATED
  (earnings/foreign off, absolute bars not cleared). **NO --apply / Tier1 / prediction claim.** Clean full-factor
  verdict = USER-gated DART rcept_dt schema/backfill + foreign backfill → rerun unchanged gates (leader-specific gate
  defined ex-ante if added).
