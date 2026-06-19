# Tier 0 — SELECTIVE LARGE+MID (TASK 가) — PRE-REGISTERED PROTOCOL

**Status:** PRE-REGISTERED before any adjudicated run · EXPLORATORY / diagnostic-only · **NEGATIVE-HYPOTHESIS** · **no `--apply`, no Supabase, cost 0, offline `scripts/out/pit_cache`** · ORIGINAL git-tag `tier0-multiregime-freeze` UNTOUCHED.
**Date:** 2026-06-18 · **Owner:** Claude (fixer/verifier) ↔ omxy (critic) CONVERGED spec.
**Does NOT edit:** `docs/superpowers/tier0-4config-decision-rules.md`, git-tag `tier0-multiregime-freeze`, `scripts/tier0_factors.py`, or the cfg1-4 / all-universe code path (byte-identical, attested by `git diff`). Also does NOT change the 2026-06-17 largemid-freeze run (`scripts/out/largemid/`).

---

## §1 — FRAMING (load-bearing — read first)

**This is a NEGATIVE-HYPOTHESIS diagnostic. TASK A already FAILED.** The all-universe Tier0 verdict is `NO-CONFIG-PASSES` (4 factor-configs × 3 regimes, max recall ~0.11). The 2026-06-17 **largemid-freeze** run then asked "does Tier0 work on the *tradable* large+mid universe?" and that protocol also **FAILED**: absolute recall cleared 0.20 (bear/recov/bull ≈ 0.398/0.385/0.507), but it did **not** beat the binding same-universe baselines (≈ 0.422/0.450/0.541) and bear/recov Gate B were `ADJUDICATE`; Gate C passed. Net: high recall was coverage of a small pond, not demonstrated selection skill — see `2026-06-17-tier0-largemid-freeze.md`.

This protocol asks a **DIFFERENT, narrower** question and is **NOT a rescue** of either failed verdict:

> Does cfg1 ranking have **SELECTION skill** on large+mid when we actually **SELECT a small N** (≈ a real shortlist), instead of picking ~half the pond (the disjoint 50/50/50 sleeve harvest selects roughly half of a ~300-name largemid universe, so "recall" there is close to coverage, not selection)?

A PASS here is **not** a PASS of all-universe Tier0 or of the largemid-freeze protocol. It confers **no `--apply` / Tier1 / "상승 예측" claim**. Output is labeled `protocol="selective-largemid"`, `decision_grade=False`, `diagnostic_only=True`, and written to a distinct out-dir (`scripts/out/selective_largemid/`) so it never collides with the FAILED verdicts.

---

## §2 — UNIVERSE + GENERATOR (pre-registered)

- Universe = **large + mid** (whole-market `size_breakpoints`; large = top 20% mcap, mid = next 40%, small = bottom 40% dropped), computed from the **liquidity-floor-passing PIT market-cap at the selection date** via `canonical_size_tiers`. Identical to the largemid-freeze universe (`--universe largemid`).
- Generator = **cfg1** = trend+size = `--generator bpp` with earnings/foreign OFF. The frozen `tier0_factors.score_bpp_universe` + size-sleeve primitives are reused **unchanged** (`SLEEVE_QUOTA` UNTOUCHED).
- × **3 regimes** (bear2022 / recov2023 / bull2425).

---

## §3 — PICK COUNT (pre-registered) — N = 50

**N = 50 (TOTAL across the shortlist).** Rationale, frozen BEFORE the run (chosen for capacity + denominator stability, **NOT because it looked good**):
1. **₩1.5B book capacity** — 50 names at the ₩2B ADV liquidity floor is an executable shortlist for the owner-capital book.
2. **Recall-denominator stability across monthly regimes** — N=50 is ~17% of a ~300-name largemid universe; large enough that the per-month winner-overlap denominator does not collapse to noise in thin months.

### FROZEN 50-of-50 horizon/sleeve mapping (sums to 50)

**Rule (frozen):** the cap is the **pooled top-50 by cfg1 score over the cross-bucket-disjoint largemid union of {short, mid, long} picks**. Concretely, in `process_month`: collect every `(score, ticker, horizon)` from the already-ranked disjoint picks `sel[b][1]`, sort by `(-score, ticker)` (deterministic), take the top `select_count`, then rebuild `selected_by_horizon` restricted to that kept set.
- **Sleeve ratio large:mid = 1:1 is EMERGENT** from the frozen `SLEEVE_QUOTA` (L20:M20 = 1:1), not a new per-sleeve constant. `small = 0` on largemid by construction.
- **Horizon split is EMERGENT**, not pre-allocated: whichever 50 highest-cfg1-score disjoint picks survive are classified back to their originating horizon for per-horizon recall reporting.
- The cap is a **post-generation truncation of the already-score-desc-ranked picks only**. It **never** touches `SLEEVE_QUOTA` (`tier0_factors.py` UNTOUCHED) and **never** touches the scored universe `sel[b][0]` used for Gate B IC (IC scope stays over the full scored largemid universe — see §5 risk).
- **Alternative (rejected) fixed-horizon mapping**, recorded for completeness only: short=20, mid=18, long=12 (sums 50). We use the pooled-top-50-by-score form (single deterministic sort, reuses the existing ranking, no new constant).

### Sensitivity appendix — N = 30 and N = 75 (NON-ADJUDICATED)

The same driver is run with `--select-count 30` and `--select-count 75` to distinct out-files. **Only N=50 is adjudicated.** N=30/75 are a sensitivity appendix and are **never pass/fail** — they exist to show the metric's behavior across the plausible shortlist range and are explicitly excluded from any verdict.

---

## §4 — BINDING METRIC (pre-registered, frozen) — recall-LIFT CI90

**PRIMARY (binding):** pooled per-month recall-**LIFT** = `recall(top-N) − same-count-N RANDOM-baseline recall`.
- **Same-count-N random baseline (per month, analytic):** `N_m / M_m` — the analytic **expected** recall of a uniform random size-N subset of an M-universe against that month's winners (each winner is included w.p. N/M). This is an analytic expectation, **NOT** a Monte-Carlo draw. `N_m = len(selected_all_m)` (already capped to N by the truncation); `M_m = n_universe_m` (the largemid count). Emitted as `recall_lift_random_baseline_per_month`.
- **Per-month lift series:** `recall_m − (N_m / M_m)`, where `recall_m = |selected_all ∩ winners_all| / |winners_all|`.

**CI method (LOCKED — mirrors `recall_ci90` exactly):** `recall_lift_ci90 = _ci90(per_month_recall_lift)` — the **verbatim** `_ci90` empirical monthly-CI90 method (`[quantile(0.05), quantile(0.95)]` over present per-month values, needs ≥2 present months), applied to the **LIFT series** instead of the recall series. This is **not a new bootstrap.** If a bootstrap is ever introduced it is a NEW method and must be documented before any run.

**PASS RULE (binding):**
- PASS iff `recall_lift_ci90[0]` (lower bound) **> 0**.
- **FALLBACK** (CI unavailable: <2 present months → NaN): pre-registered margin lift **≥ +5pp** (`recall_lift_mean ≥ 0.05`). This fallback is pre-registered here so it is not seen as post-hoc.
- **CO-GATE (necessary, not sufficient):** rank-IC IR ≥ `GATE_B_IC_IR_MIN = 0.30` (the existing Gate B composite-IC IR). Emitted as `recall_lift_co_gate_ic_ir`.
- **"skill" is claimed only if BOTH the primary recall-lift AND the co-gate IC hold.**

**The absolute recall ≥ `GATE_A_OVERALL_RECALL_MIN` (0.20) bar is EXPLICITLY NOT the binding bar for TASK 가.** It is the all-universe / largemid-freeze bar. Here the binding bar is lift-vs-same-count-random + IC co-gate.

**INTERPRETATION CAVEAT (step-4 adversarial review — pre-registered honesty note):** `recall_lift_ci90` is a **distribution percentile** (5th/95th pctile of the per-month lift series via the locked `_ci90`), NOT a sampling CI of the mean. With only ~19 monthly observations, `lower bound > 0` is a **permissive** test — it asserts "**every month's lift percentile-floor stays positive**", NOT "the mean lift is statistically significant". A PASS is read at exactly that strength and no stronger. As a **non-binding secondary** check, a seeded paired-bootstrap p-value of `mean(lift) > 0` over the per-month lift series is **computed and reported post-run** (informational only; it does NOT alter this pre-registered binding gate). Step-4 falsification confirmed the `N/M` baseline is honest (random ranking → mean lift ≈ −0.002 over 60 seeds; cfg1 → +0.037), so a positive lift reflects real top-N winner concentration, not a baseline artifact — but its statistical strength is bounded by the ~19-month sample.

**Gate wiring:** a NEW additive gate variant `gate_a_pass_selective_largemid(lift_ci90, lift_mean, ic_ir)` binds on the rule above. It is selected in `aggregate_harvest` **only when `select_count is not None`**. The existing `gate_a_pass` (all-universe) and `gate_a_pass_largemid` (largemid-freeze) stay **byte-identical** and are never called on this path, so `scripts/out/largemid/` and the cfg1-4 outputs do NOT change.

---

## §5 — RISKS (pre-registered)

1. **IC scope must not shrink with N.** The truncation applies to `selected_by_horizon` / `selected_all` / Gate C composition ONLY. The scored universe `sel[b][0]` (Gate B IC input) is left UNTOUCHED, so the IC co-gate is measured over the full scored largemid universe, not a post-selection subsample.
2. **Per-month random baseline = N_m/M_m** is the analytic same-count-N expectation. It differs subtly from the existing pooled `random_baseline` (`sel_total/uni_total`); the per-month N_m/M_m form is pre-registered here.
3. **Few months per regime** can make `_ci90` return `[NaN, NaN]` (needs ≥2 present) → the pre-registered +5pp fallback fires. Pre-registered so it is not post-hoc.
4. **No-rescue framing:** a selective PASS must not be read as rescuing the FAILED all-universe / largemid-freeze verdicts. Enforced by `protocol="selective-largemid"`, `decision_grade=False`, `diagnostic_only=True`, distinct out-dir, and this NEGATIVE-HYPOTHESIS framing.

---

## §6 — VERDICT WORDING (pre-registered, verbatim)

- **PASS wording:** "On large+mid, cfg1 selection of the top-50 shows recall-LIFT over a same-count-50 random draw with monthly-CI90 lower bound > 0 AND rank-IC IR ≥ 0.30 in THIS offline monthly harness. This is a diagnostic signal of selection skill on the tradable subset; it is NOT decision-grade and confers no `--apply` / Tier1 / '상승 예측'."
- **FAIL wording:** "On large+mid, cfg1 selection of the top-50 does NOT show recall-LIFT over a same-count-50 random draw (CI90 lower ≤ 0, or fallback < +5pp), and/or the IC co-gate < 0.30, in THIS offline monthly harness. Selection skill on the tradable subset is unverified; diagnostic generator stays."
- Neither verdict reinterprets the FAILED all-universe or largemid-freeze conclusions.

---

## §7 — DRIVER + OUTPUT

- Driver: `scripts/run_tier0_selective_largemid.sh` (separate; does NOT edit existing drivers). Output → `scripts/out/selective_largemid/` (`selective50_<regime>.json` adjudicated; `selective30_*` / `selective75_*` sensitivity).
- Offline `scripts/out/pit_cache`, no `--earnings` / `--with-foreign` (trend+size only), `allow_supabase=False`, cost 0, whole-market PIT large/mid tiers.
- **No post-run threshold tuning. No post-run doc edits except clearly-marked factual results.** Count / generator / universe / baselines / CI-method / verdict-wording all frozen above BEFORE the run.
