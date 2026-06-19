# Tier 0 — B++ COMBINATION CAMPAIGN — PRE-REGISTERED PROTOCOL (multiple-testing disciplined)

**Status:** PRE-REGISTERED before any combination harvest · EXPLORATORY / diagnostic-only · **NEGATIVE-HYPOTHESIS** · no `--apply`, AI cost 0, offline (same wiring as 2026-06-17 bc run) · ORIGINAL git-tag `tier0-multiregime-freeze` (`17dc6d9`) UNTOUCHED · cfg1-4 / default path BYTE-IDENTICAL.
**Date:** 2026-06-18 · **Owner:** Claude (fixer/verifier) ↔ omxy (critic) — same 6-step loop. Design = `tier0-combination-design` workflow (3-agent enumerate + synth, CONVERGED).
**Motivation:** USER — "combining B++ with other signals should be better; test everything testable." This spec frozen-locks WHICH combinations get tested, their exact params, the binding gate, and the family-wise correction, BEFORE running — so no result is p-hacked.

---

## §1 — FRAMING (load-bearing)

The frozen all-universe verdict is settled **NO-CONFIG-PASSES** (cfg1-4 × 3 regimes), re-confirmed at the fairest bar by the tradable-winner-denominator run (ALL-12-FAIL, 2026-06-18). The decision FAMILY is permanently fixed at cfg1-4; **every combination here is EXPLORATORY/diagnostic-only and CANNOT change the production decision or earn `--apply`.** A combination "passing" the binding gate would, at most, become an ADJUDICATE candidate for a *future* separately-justified re-freeze — never an auto-PASS.

**The binding wall is RECALL.** B++ (cfg1 trend+size) already wins recall in every regime (0.076/0.090/0.112 whole-universe; 0.255/0.279/0.339 tradable); every blended signal LOWERED funnel recall (cfg2 > cfg3/cfg4); the gap to the 0.20 floor is geometric (30/30/30 picks vs ~2200-name top decile), not a tuning gap. IC is a regime-dependent factor beta (earnings bull +0.72 / bear negative), not robust alpha.

**PRE-REGISTERED NULL (the expected scientific outcome, logged up front):** regime-conditioning / orthogonal combining likely improves *scoped per-regime IC* but will NOT move recall above the 0.20 floor, and earnings IC's bear-negative sign-flip makes any earnings combo fail the all-regime IC co-gate. Realistic best case = a single MARGINAL/ADJUDICATE on the two genuinely-untested recall mechanisms (chart reserve-K union; regime-adaptive horizon). We run to *confirm or refute* this null, not to find a winner.

---

## §2 — BINDING GATE (verbatim reuse + family-wise correction)

Per combination, in **ALL applicable regimes/states**:
- **PRIMARY:** recall-LIFT vs same-count random, empirical-monthly **CI90 lower bound > 0** (the locked `_ci90` on the per-month lift series), reusing `gate_a_pass_selective_largemid` verbatim.
- **CO-GATE:** rank-IC IR ≥ `GATE_B_IC_IR_MIN = 0.30`.
- **SIZE-NEUTRAL:** sleeve CI > 0 on all horizons (the existing size-neutral skill check), where applicable.
- **"skill" iff ALL hold in ALL THREE regimes** (all-regime rule; regime-subset / horizon cherry-pick REFUSED).

**FAMILY-WISE ERROR CONTROL (mandatory):** Let `K` = number of combinations that actually RUN to a gated verdict (P0 diagnostic, BLOCKED, and screened-out combos excluded). The per-combo significance is Holm/Bonferroni-adjusted: target family alpha 0.10 → per-combo **alpha = 0.10 / K**. With ~6 runnable combos the naive CI90-lower>0 gate has ~50–65% family-wise false-positive rate; the correction is what makes any single PASS credible. **`K` and the adjusted alpha are persisted in each harvest JSON.** Practically (small monthly N), the binding decision stays: **any single gate-pass = ADJUDICATE (not PASS)** — the Opus+omxy adjudication makes the call, never a self-certified PASS.

---

## §3 — PIT-SAFE REGIME LABEL (frozen, sector-free — NOT the blocked cfg5 path)

Computed from the cached OHLCV panel **as-of the selection date only** (no future bars, no index ticker, no sector source):
- `univ_trend` = median 120-trading-day return of the liquidity-floor-passing universe (as-of sel date).
- `breadth` = fraction of that universe whose close ≥ its own 120-day MA (as-of sel date).
- **Label (frozen cutpoints):** `bull` = `univ_trend > 0 AND breadth > 0.50`; else `not-bull`. The 3-way {bear/recovery/bull} variant (used by P3/R-series) adds `bear` = `univ_trend < 0 AND breadth < 0.50`, `recovery` = otherwise. **Cutpoints (sign-0, 0.50 breadth) FROZEN here; no sweep.**

---

## §4 — THE CAMPAIGN (frozen GO list, priority order)

| # | combo | targets | frozen params | binding | expected |
|---|---|---|---|---|---|
| **P0** | **Missed-winner recovery diagnostic** (KILL-SWITCH, no gate) | recall ceiling | per signal {foreign, earnings, issuance, chart}: of B++'s MISSED winners (winners_all − B++150), fraction in that signal's standalone top-150, per regime, as a RATIO to random (~7%) | diagnostic only; ratio ≈ 1.0× random ⇒ signal's "different picks" are different NON-winners ⇒ its reserve/union combo is DROPPED (shrinks K) | C/D near-random; earnings maybe elevated in recov/bull |
| **P1** | B++ ∪ chart RESERVE-K (K=30, set-union not blend) | recall | K=30 frozen; chart signal = the FULL `tier0_chart.score_chart_universe` composite (8 objective indicators — **aligned to the D experiment + P0, which both used the full composite**; the original "Donchian/vol-breakout sub-composite" wording is superseded so P1 gates the same signal P0 screened); reserve = top-K non-B++ names, backfill B++ | union recall-LIFT CI>0 all-3-regime + IC≥0.30; size-neutral UNIMPLEMENTED→fail-closed | MARGINAL; P0 reserve recovery 1.01/1.27/1.44× (bear=random) → bull-only marginal prior |
| **P2** | B++ rank ⊕ chart RANK-AVERAGE ensemble (not cfg4 additive) | recall | r = 0.5·pctrank(bpp) + 0.5·pctrank(chart); ONE frozen equal weight | recall-LIFT CI>0 all-3-regime + IC≥0.30 | MARGINAL→NO-GO; dilutes the recall champion |
| **P3** | Regime-ADAPTIVE horizon emphasis (bear→short, bull→long, WITHIN trend) | recall | regime label §3 sets the cross-bucket PRIORITY ORDER for the disjoint selection (bear: short→mid→long · recovery: mid→short→long · bull: long→mid→short) so the regime-appropriate horizon claims contested names first; **sleeve quota L20/M20/S10 and the 150 total UNCHANGED** (a single frozen reordering rule, no new weight magnitude) | recall-LIFT CI>0 all-3-regime + IC≥0.30; size-neutral UNIMPLEMENTED→blocks clean pass | MARGINAL; only recall play that reallocates WITHIN the champion (no dilution); independent of P0 |
| **P5** | Binary bull/not-bull regime-conditional EARNINGS tilt (R7, lowest K) | IC | binary label §3; earnings rank tilt frozen w (= trend weight) in bull only, pure B++ else | recall-LIFT CI>0 + IC≥0.30 BOTH states; IC reported per-state (never pooled) | IC co-gate likely PASSES bull, recall FAILS ⇒ NO-GO all-state; cleanest IC demo |
| **P6** | B++ ⊕ earnings RANK-AVERAGE vs cfg4 additive (CONDITIONAL on P5) | IC | r = 0.5·pctrank(bpp)+0.5·pctrank(earnings_quality) | IC≥0.30 all-3-regime + recall-LIFT CI>0 all-3-regime; bear IC<0 = pre-registered expected FAIL | NO-GO by construction (bear earnings IC negative) |
| **P7** | B++ ∪ net-issuance RESERVE-K (buyback/low-dilution top-K) — COMPLETENESS | recall | K=30; `issuance_return`/`split_like` (tier0_factors), split neutralized | union recall-LIFT CI>0 all-3-regime + IC≥0.30 | NO-GO most likely; RUN ONLY if P0 issuance > random |
| **P8** | cfg6 multi-net UNION shared reserve {foreign,earnings,issuance,chart} — kitchen-sink, COMPLETENESS | recall | existing cfg6 generator; shared de-duped reserve pool of non-B++ names | union recall-LIFT CI>0 all-3-regime + IC≥0.30 | MARGINAL; RUN ONLY under explicit exhaustive mandate AND if P0 shows any signal > random |

**Execution order:** STEP0 spec (this doc) → P0 (kill-switch) → {P1, P2 if P0-chart survives} + P3 (independent) + P5 → P6 (if P5 bull-IC passes) → {P7, P8 if P0 survives + exhaustive mandate}. Each gated combo = additive EXPLORATORY generator, frozen-lock preserved, then Opus+omxy 6-step adjudication.

---

## §5 — REFUSED AS FISHING (NOT run — documented so the refusal is on record)
- Per-factor WEIGHT GRID SEARCH (0.7/0.3, …) — only ONE frozen equal weight per combo.
- THRESHOLD/PARAM SWEEPS (ADV floor, sleeve 30/30/30, RSI/MA/Donchian N) re-tuned to clear a gate.
- REGIME-SUBSET or HORIZON cherry-pick (declaring a winner on best 1–2 regimes/horizons).
- ARBITRARY HIGH-ORDER INTERACTIONS with no hypothesis (earnings×foreign×chart×issuance 4-way, momentum-of-momentum, cross-terms chosen because untested).
- Re-running ANY frozen cfg1-4 cell with adjusted thresholds (direct p-hacking of the settled result).
- KNOWN COVERAGE ARTIFACTS as recall wins (largemid A, selective-50 가, tradable-denominator scope) — settled FAILED, auto-disqualified.
- cfg5-class sector/leading-sector tilts (non-PIT-safe / uncached) — structurally BLOCKED.

---

## §6 — INVARIANTS + DISCIPLINE
- git-tag `tier0-multiregime-freeze` intact · `tier0_factors.py` 0-deletions vs tag · decision-rules zero-diff · cfg1-4/default path byte-identical (recursive metric diff = 0) · `--apply` never invoked · production untouched · AI cost 0 · offline cache.
- Pre-register each combo's frozen params (above) BEFORE its run; no post-run threshold tuning; no post-run doc edits except clearly-marked factual results (§7, per combo).
- All EXPLORATORY: `decision_grade=False`, `diagnostic_only=True`, distinct out-dirs. Any gate-pass = ADJUDICATE via Opus+omxy, never self-certified.

---

## §7 — RESULTS (appended AFTER each combo runs — frozen above this line)

### P0 — Missed-winner recovery diagnostic (CHART signal) — run 2026-06-18, offline, cost 0
`scripts/run_tier0_p0_recovery.py` → `scripts/out/combo/p0_recovery_chart.json`. Per regime, pooled: of B++'s MISSED top-decile winners (winners_all − B++150), fraction recovered by chart's NON-B++ picks (chart150 \ B++150), as a ratio to the random expectation (size-matched draw from the non-B++ pool).

| regime | B++ recall | chart RESERVE recovery ratio (vs random) | chart simple ratio |
|---|---|---|---|
| bear2022 | 0.076 | **1.01×** (= random — different picks = different NON-winners) | 0.62× |
| recov2023 | 0.090 | 1.27× | 0.78× |
| bull2425 | 0.112 | **1.44×** | 0.85× |

**Read:** chart's different picks recover B++'s missed winners only **modestly in bull (1.44×), at random in bear (1.01×)** — weak + regime-dependent. Above the 1.3× kill-switch in bull → **P1 chart-reserve NOT dead-on-arrival, build + gate it** (per the mandate). But the bear=random result means the prior is **P1 fails the all-3-regime gate** (a reserve adds nothing in bear). Note `simple_ratio < 1` (0.62–0.85): chart150 OVERALL recovers missed winners BELOW random — because chart150 heavily overlaps B++150 on the same momentum names; only its NON-overlap slice (the reserve) carries the weak bull signal. cfg2/3/4 reserve signals (foreign/earnings/issuance) NOT P0-tested here (chart was the best prior; if chart is this weak, weaker signals' reserves are lower-prior still).

### P1/P3/P5 + B++ reference — run 2026-06-19, offline, cost 0. omxy combo-code 6-step CONVERGED (R1 6 catches incl. HIGH P5-ineligible-resurrection; R2 3 catches; R3 CONVERGED). `scripts/run_tier0_combo.py` → `scripts/out/combo/{combo}.json`.

Binding = recall-LIFT vs same-count random, monthly CI90 lower>0 AND IC IR≥0.30, all groups; **size-neutral UNIMPLEMENTED → blocks any clean pass (max = ADJUDICATE_PENDING_SIZE_NEUTRAL)**; family K=3, α=0.033.

| combo | group | lift_ci90 (lower→upper) | lift_mean | IC_IR | verdict |
|---|---|---|---|---|---|
| **B++ ref** | bear2022 | [−0.011, +0.043] | +0.0088 | −0.762 | FAIL |
| | recov2023 | [+0.001, +0.054] | +0.0254 | −0.291 | FAIL (IC<0.30) |
| | bull2425 | [+0.025, +0.081] | +0.0467 | +0.386 | PENDING (size-neutral block) |
| **P1 chart-reserve** | bear2022 | [−0.015, +0.045] | +0.0116 | −0.762 | FAIL |
| | recov2023 | [+0.004, +0.058] | +0.0297 | −0.291 | FAIL (IC<0.30) |
| | bull2425 | [+0.021, +0.070] | +0.0441 | +0.386 | PENDING |
| **P3 regime-horizon** | bear2022 | [−0.011, +0.047] | +0.0103 | −0.762 | FAIL |
| | recov2023 | [−0.004, +0.052] | +0.0221 | −0.291 | FAIL |
| | bull2425 | [+0.025, +0.073] | +0.0452 | +0.386 | PENDING |
| **P5 regime-earnings** | bull (state) | [−0.009, +0.063] | +0.0289 | +0.396 | FAIL |
| | not_bull (state) | [−0.016, +0.041] | +0.0154 | +0.486 | FAIL |

**campaign_verdict: ALL FOUR = FAIL.** Findings:
1. **No combo beats B++.** Δ(combo − B++) lift_mean is noise-level (~±0.003): P1 bear +0.0028 / recov +0.0043 / bull −0.0026; P3 bear +0.0015 / recov −0.0032 / bull −0.0016. All inside the CI width (which straddles 0). The chart reserve / regime-horizon / earnings tilt move nothing meaningfully.
2. **The only lift signal anywhere = B++'s OWN bull-regime momentum** (B++ ref bull lift CI lower +0.025, IC +0.386 → PENDING). The combos merely inherit it; they don't add to it. And it still fails the all-3-regime rule + the size-neutral block + family-wise K.
3. **P5 confirms earnings = IC (ranking), not recall (retrieval):** IC co-gate PASSES both states (0.396 / 0.486 ≥ 0.30) but recall-lift FAILS both (CI straddles 0). Exactly the pre-registered null.
4. bear IC negative everywhere (−0.76/−0.29) = regime-dependent factor beta, not robust alpha.

**Conclusion (matches the pre-registered null verbatim):** combining B++ with chart (P1), regime-adaptive horizon (P3), or regime-conditional earnings (P5) does NOT produce gate-passing selection skill and does NOT beat B++ alone. The recall wall is structural; the only positive is B++'s inherent bull momentum, which itself fails the binding bar. **B++ (trend+size) alone remains the best-tested 150-retrieval config.** No `--apply`, production untouched, AI cost 0, frozen tag intact. **2026-06-19 downstream note:** this result does not validate prediction; it is the evidence basis for USER choosing B++ as the diagnostic production funnel because every tested alternative failed to improve it.
