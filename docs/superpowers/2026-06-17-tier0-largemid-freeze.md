# Tier 0 — LARGE+MID Investable-Universe FROZEN PROTOCOL (TASK A)

**Status:** PRE-REGISTERED before any run · EXPLORATORY / diagnostic-only · **no `--apply`, no Supabase, cost 0, offline `scripts/out/pit_cache`** · ORIGINAL git-tag `tier0-multiregime-freeze` UNTOUCHED.
**Date:** 2026-06-17 · **Owner:** Claude (fixer/verifier) ↔ omxy (critic) CONVERGED spec.
**Does NOT edit:** `docs/superpowers/tier0-4config-decision-rules.md`, git-tag `tier0-multiregime-freeze`, `scripts/tier0_factors.py`, or the cfg1-4/all-universe code path (byte-identical, attested by `git diff`).

---

## §1 — FRAMING (load-bearing — read first)

**The all-universe Tier0 verdict remains FAILED (NO-CONFIG-PASSES).** The frozen 19-month triple-gate ran 4 factor-configs × 3 regimes and no config passed (max recall ~0.11). That verdict is unchanged and is NOT reinterpreted or rescued here.

This protocol answers a **DIFFERENT question**:

> Does Tier0 work on the **TRADABLE large+mid universe** — the only universe an admin-scale book can actually execute in (₩1.5B book = owner capital; per-stock ADV liquidity floor **₩2B = `F.MIN_ADV_WON`, enforced**; tiny-cap execution is infeasible)?

This is a separate, narrower hypothesis with its own pre-registered universe, baselines, and Gate C replacement. A PASS here is **not** a PASS of the all-universe Tier0 and confers **no `--apply` / Tier1 / "상승 예측" claim** — it is a diagnostic on the tradable subset only. Output is labeled `protocol="largemid-freeze"` and written to a distinct out-dir (`scripts/out/largemid/`) so it never collides with the FAILED all-universe verdict.

---

## §2 — UNIVERSE (pre-registered)

- Universe = **large + mid**, defined by `tier0_factors.size_breakpoints` on the **whole market** (large = top 20% market-cap, mid = next 40%; small = bottom 40% **dropped**), computed from the **liquidity-floor-passing PIT market-cap at the selection date** via `canonical_size_tiers`.
- **CAVEAT (omxy):** BOTH the **candidate universe AND the WINNERS set** are filtered by PIT large/mid **at each selection date** (`size_tier` from PIT mcap at that date), **NEVER** future / period-end size. Implementation: `process_month` computes `full_tier_of = canonical_size_tiers(stocks)` on the full universe, then restricts `stocks` to large/mid **before** generation and before `compute_month_forward`. Winners are then top-decile over only the largemid forward dict, so the winners set is largemid by construction. `n_universe` for the random baseline becomes the restricted count.
- **Breakpoint anchoring (pre-registered, risk #2):** breakpoints are computed on the **whole market** and the restriction is applied **after** tiering, so "large = top 20% of the whole market" is preserved. We do **not** recompute breakpoints on the restricted set for the winner/selected classification (`tier_of = full_tier_of`).
- **Double-tiering resolution (omxy Step-2 review):** the generator's internal `score_bpp_universe` still recomputes its own relative sleeves on the restricted `lm_stocks` for selection mechanics only. Gate C does **not** use those relative labels on this protocol. `process_month` stamps `selected_sleeve` from the whole-market `full_tier_of` when `--universe largemid`, so a "small" Gate C count means a true whole-market small leak, not a relative-sleeve artifact. This keeps the tradable-universe claim and the Gate C balance check on the same PIT whole-market tier basis.

---

## §3 — GATE A (recall) — binding bar pre-registered

- Generator = **cfg1 only** (trend+size, best recall; `--generator bpp` + earnings/foreign OFF = trend+size), × **3 regimes** (bear2022 / recov2023 / bull2425).
- **Thresholds UNCHANGED:** recall ≥ `GATE_A_OVERALL_RECALL_MIN = 0.20`, random ratio ≥ `GATE_A_RANDOM_RATIO_MIN`, per-horizon ≥ `GATE_A_HORIZON_RECALL_MIN`, IC IR ≥ `GATE_B_IC_IR_MIN = 0.30`. Same constants, no edits.
- **Binding-bar decision (the single biggest design choice, pre-registered):** on the largemid path the *whole universe IS largemid*, so `overall == largemid` by construction. This makes `GATE_A_LARGEMID_VS_OVERALL_MIN` (0.80) trivially 1.0 and lets `GATE_A_LARGEMID_RECALL_MIN` (0.35) silently dominate the conservative 0.20 bar. We **pre-register the binding bar as `GATE_A_OVERALL_RECALL_MIN = 0.20`** (per task) and use a **new additive variant `gate_a_pass_largemid`** that drops the redundant/contradictory largemid sub-checks (0.35, 0.80) while reusing the IDENTICAL recall / random-ratio / per-horizon / baseline checks and the IDENTICAL constants. The all-universe `gate_a_pass` is **never** called on this path and is **byte-identical** for cfg1-4.
- **Recall must BEAT baseline, not merely clear 0.20** — `gate_a_pass_largemid` FAILS if `overall <= binding_baseline_recall` (same posture as `gate_a_pass`).

---

## §4 — GATE C REPLACEMENT (pre-registered) — `gate_c_largemid`

The all-universe Gate C (60/60/30 + Small ≤ 25%) is **meaningless** once Small is dropped. It is REPLACED (only on the largemid path; cfg1-4 `gate_c_size_composition` stays byte-identical) by three PRE-REGISTERED checks:

1. **Large/Mid BALANCE BAND** — each of {large, mid} within `[GATE_C_LARGEMID_BALANCE_LO=0.30, GATE_C_LARGEMID_BALANCE_HI=0.70]` of the selected set, classified by whole-market PIT `full_tier_of`, so neither investable sleeve collapses. Any leaked whole-market small pick is flagged.
2. **LIQUIDITY FLOOR (ADV)** — every selected ticker passes `F.liquidity_floor_pass(adv, F.MIN_ADV_WON)`. The **enforced** per-stock ADV floor is **₩2B (`F.MIN_ADV_WON`)**; `book_capacity_reference_won = ₩1.5B` is the admin book size (owner capital), reported for context only — it is **NOT** the enforced floor. We also report min/median selected ADV and min/median selected market-cap.
3. **SECTOR-CONCENTRATION CAP** — no PIT-safe offline universe-wide sector source exists under `allow_supabase=False` (addendum §5). We emit `sector_cap = "N/A (no PIT-safe offline sector source, addendum §5)"` explicitly and do **not** call Supabase/DART. (If a sector map is later supplied, `gate_c_largemid` emits `top_sector_fraction` + `sector_dist` instead.)

The `gate_c["verdict"]` shape is identical to `gate_c_size_composition` so triple-gate / JSON logic is unchanged.

---

## §5 — PRE-REGISTERED BASELINES (emitted; recall must BEAT, not merely clear 0.20)

All binding/diagnostic baselines are named in the largemid output's `gate_a` block before the run:

1. **`baseline_random_largemid_recall`** = the frozen `random_baseline` (selected / universe, with universe == the largemid set). Plus the existing `GATE_A_RANDOM_RATIO_MIN` ratio check.
2. **`baseline_equal_rank_largemid_recall`** = `baseline_equal_recall` (trend+earnings equal-rank, inputs restricted to lm_stocks by `process_month`).
3. **`baseline_legacy_momentum_proxy_recall`** = existing clean close/MA60 momentum proxy baseline (NOT the 73차 production scorer), restricted by the same largemid `process_month` input slice. It remains a binding comparator through `binding_baseline_recall = max(baseline_legacy_momentum_proxy_recall, baseline_equal_rank_largemid_recall)`.
4. **`leader_prevalence_in_largemid_winners`** = |LEADER_BASKET ∩ largemid winners| / |largemid winners| — a **pure diagnostic tripwire (NOT a pass gate)** that contextualizes recall given the leader basket is largemid-heavy.

`gate_a_pass_largemid` FAILS if `overall <= binding_baseline_recall`, so "must beat baseline" is enforced against the strongest clean baseline, not merely against random/equal-rank.

---

## §6 — HARD CONSTRAINTS honored

Additive `--universe {all,largemid}` flag (default `all`, byte-identical); thresholds unchanged; no `--apply`; no Supabase (`allow_supabase=False` on this path); cost 0 (offline `scripts/out/pit_cache` incl. `foreign/`); EXPLORATORY-PASS-style labeling (`protocol="largemid-freeze"` + framing); cfg8 (A+B) DEFERRED — not built.

**Run:** `scripts/run_tier0_largemid_freeze.sh` (separate driver; does NOT edit `run_tier0_6config_matrix.sh`). 3 regimes, cfg1 (trend+size), `--universe largemid`, out-dir `scripts/out/largemid/`.

**Smoke evidence (offline, metrics-only):** `--start-month 2025-01-01 --end-month 2025-02-01 --smoke --universe-limit 300 --universe largemid` ran offline; the largemid restriction narrowed the candidate set, `largemid_recall == overall_recall` by construction, the replaced Gate C emitted balance/ADV/sector-N/A metrics, and the three pre-registered baselines were emitted — all measured through the unchanged frozen metric functions.
