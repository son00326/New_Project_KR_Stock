# Tier 0 — TRADABLE WINNER DENOMINATOR (재검증 (a)) — PRE-REGISTERED PROTOCOL

**Status:** PRE-REGISTERED before any adjudicated run · EXPLORATORY / diagnostic-only · **DENOMINATOR-ARTIFACT TEST** · **no `--apply`, AI cost 0** · SAME provider wiring as the 2026-06-17 bc run (Supabase read-only for universe/sector + DART production cache + local `scripts/out/dart_backfill.jsonl` overlay + pykrx foreign cache; price/volume from `scripts/out/pit_cache`) · ORIGINAL git-tag `tier0-multiregime-freeze` (`17dc6d9`) UNTOUCHED.

> **omxy ROUND-1 HIGH correction (2026-06-18, before any adjudicated run):** an earlier draft set `allow_supabase=False` ("fully offline"). omxy proved via runtime smoke that this **silently disabled the DART backfill overlay** (`_build_real_providers` gates the DART preload+overlay behind `live_client is not None`, which requires Supabase), zeroing earnings (`earnings_missing_fraction=1.0`) and collapsing cfg3/cfg4 to trend+size — defeating the "5-signal" intent of (a). Corrected to use the SAME provider wiring as the 2026-06-17 bc run (`allow_supabase=True`); the **ONLY** delta vs bc is the winner denominator. Supabase READ is not AI cost (cost 0 preserved) and not a production write (no `--apply`/migration). This restores the pre-registered intent; it is a bug fix, not a result-directed change.
**Date:** 2026-06-18 · **Owner:** Claude (fixer/verifier) ↔ omxy (critic) — 동일 6-step 교차검증 루프.
**Does NOT edit:** `docs/superpowers/tier0-4config-decision-rules.md`, git-tag `tier0-multiregime-freeze`, `scripts/tier0_factors.py`, or the cfg1-4 / all-universe / no-flag code path (byte-identical, attested by recursive metric diff = 0). Does NOT change the 2026-06-17 `scripts/out/bc/` 4-config verdict, `scripts/out/largemid/`, or `scripts/out/selective_largemid/`.

---

## §1 — FRAMING (load-bearing — read first)

This is a **DENOMINATOR-ARTIFACT diagnostic**, motivated by the 2026-06-18 methodology audit (Claude 3-agent workflow). The audit confirmed the harness mechanics are PIT-honest and bug-free, but identified **one genuine methodological wrinkle**:

> The default `universe='all'` recall DENOMINATOR (`winners`) is the WHOLE-universe top-decile-by-RAW-return, which is dominated by illiquid micro/small-caps. The NUMERATOR funnel is liquidity-floored (`F.liquidity_floor_pass`, ADV ≥ ₩2B) AND its momentum factor is vol-penalized to AVOID exactly those high-σ micro-caps. So a disciplined funnel is partly **barred-by-construction** from recalling the bulk of raw-return winners. The 2026-06-17 verdict's own line 76 concedes the 0.20 floor adequacy "is a separate question — the structural ceiling of catching the whole-universe top-decile." The 4x gap between largemid recall (0.43) and overall (0.11) is the fingerprint.

**HYPOTHESIS (pre-registered):** the 2026-06-17 all-universe FAIL (max overall recall 0.112 < 0.20) is partly an artifact of an *unreachable* micro-cap-dominated winner denominator. **With a LIQUIDITY-MATCHED winner denominator — the funnel's own eligibility universe (ADV ≥ ₩2B tradable names) — does the funnel show SELECTION SKILL (recall-LIFT over a same-count random draw + IC co-gate)?**

This is the audit's #1 recommended fix and the cleanest, fairest possible test. It combines three things **no prior run did together**: (a) the liquidity-matched denominator, (b) the now-available DART earnings backfill (44,300 rows), (c) all 3 regimes.

**This is NOT a rescue.** A PASS here is NOT a PASS of the frozen all-universe verdict (which stands at its own pre-registered 0.20 bar). It confers **no `--apply` / Tier1 / "상승 예측" claim**. Output is labeled `protocol="tradable-winner-denominator"`, `decision_grade=False`, `diagnostic_only=True`, distinct out-dir (`scripts/out/tradable_winner/`).

**Honest prior:** the closest fair test already run — TASK 가 (selective-largemid, large+mid universe, select-50, lift-vs-random) — **FAILED** (CI lower ≤ 0; bootstrap mean +3pp significant but binding gate FAIL). So the prior is that this also fails. But the tradable denominator is BROADER than large+mid (it includes small-but-liquid names the funnel's small-30 sleeve targets), it is measured at the natural funnel size (not select-50), and it uses the new earnings data across all regimes — so it is a genuinely distinct, decisive, not-yet-run test that closes the denominator question definitively.

---

## §2 — WINNER DENOMINATOR (pre-registered, FROZEN)

- **NEW flag `--winner-universe {all,tradable}`, default `all`.** Default = byte-identical to the frozen path (recursive metric diff = 0).
- When `tradable`: the winner set per horizon is computed ONLY among tickers passing the funnel's OWN eligibility floor `F.liquidity_floor_pass(F.adv60(s.trdvals))` (`F.MIN_ADV_WON = ₩2B`). Both the top-decile THRESHOLD (`F.quantile`, `TOP_DECILE_Q = 0.90`) AND winner membership are restricted to the tradable universe.
  - `top_decile_winners` is **unchanged**; it receives a pre-filtered `fwd[h]` (tradable tickers only). `winner = forward return ≥ 90th-pctile-of-tradable AND > 0`.
  - The scored universe `sel[b][0]` and the Gate B IC scope are **UNTOUCHED** (IC still measured over the full scored eligible universe — only the Gate A winner denominator changes).
- **Numerator** = the funnel (`selected_all`), which is already ADV-floored → numerator and denominator now live in the SAME liquid universe = **apples-to-apples**.
- Universe = `all` (the headline-FAIL path). Mutually exclusive with `--select-count` (different additive variant) → enforced by an explicit error.

---

## §3 — CONFIGS (pre-registered) — mirror the 2026-06-17 4-config × 3-regime matrix

- **4 configs** (factor set only differs; params/thresholds frozen): cfg1 = trend+size · cfg2 = +foreign · cfg3 = +earnings · cfg4 = +both.
- **× 3 regimes**: bear2022 (2022-01..2022-12) · recov2023 (2023-01..2023-12) · bull2425 (2024-01..2025-12).
- Reuse existing on-disk caches: `scripts/out/pit_cache` (price/volume panel + foreign), `scripts/out/dart_backfill.jsonl` (44,300 PIT earnings). **Offline cache-only, no live fetch, AI cost 0.**
- 12 cells → `scripts/out/tradable_winner/cfg{1-4}_{bear2022,recov2023,bull2425}.json`.

---

## §4 — BINDING METRIC (pre-registered, FROZEN) — REUSED VERBATIM from TASK 가

**No new threshold is introduced. The binding gate is `gate_a_pass_selective_largemid` REUSED VERBATIM**, fed the tradable-denominator lift series:

- **PRIMARY (binding):** per-month recall-LIFT = `recall_m − (N_m / M_m)` where
  - `recall_m = |selected_all_m ∩ tradable_winners_m| / |tradable_winners_m|`
  - `N_m = |selected_all_m|` (the funnel size that month), `M_m = n_eligible_m` (the **tradable** universe size that month — the analytic same-count random-draw expectation in the tradable universe).
  - PASS iff `recall_lift_ci90[0]` (lower bound, verbatim `_ci90` = `[quantile(0.05), quantile(0.95)]` over present per-month lift) **> 0**.
  - **FALLBACK** (CI unavailable, <2 present months → NaN): `recall_lift_mean ≥ +0.05` (+5pp). Pre-registered so not post-hoc.
- **CO-GATE (necessary, not sufficient):** rank-IC IR ≥ `GATE_B_IC_IR_MIN = 0.30` (the existing composite-IC IR, unchanged).
- **"selection skill" claimed iff BOTH hold.**

**SECONDARY (reported, NON-binding, transparency only):** absolute recall vs the frozen `GATE_A_OVERALL_RECALL_MIN = 0.20` measured against the fair (tradable) denominator, random_ratio, per-horizon recall. These let the reader see the absolute level with a fair denominator, but they are **NOT** the binding bar (mirrors TASK 가 §4). The frozen 0.20 bar is **not lowered or re-tuned** — it is reused unchanged and only re-pointed at a justified denominator.

**Gate wiring:** `gate_a_pass_selective_largemid(lift_ci90, lift_mean, ic_ir)` is selected in `aggregate_harvest` when `winner_universe == 'tradable'`. The existing `gate_a_pass` / `gate_a_pass_largemid` / selective-largemid paths stay **byte-identical** and are never called on this path.

---

## §5 — RISKS (pre-registered)

1. **IC scope must NOT change.** Only the Gate A winner denominator is restricted to tradable. The scored universe (`sel[b][0]`), Gate B composite/sleeve/top-tercile IC, and Gate C composition are UNTOUCHED. Verified by code review + byte-identical metric diff on the default path.
2. **`M_m = n_eligible` (tradable size), not `n_universe`.** The lift baseline must use the tradable universe count so the random-draw expectation is in-universe; using `n_universe` (whole panel) would understate the baseline and inflate lift. Pre-registered: `M_m = r.n_eligible`.
3. **Same-count baseline is analytic `N_m/M_m`**, not Monte-Carlo (identical to TASK 가). Step-4 falsification of TASK 가 already confirmed this `N/M` baseline is honest (random ranking → mean lift ≈ 0).
4. **`_ci90` is an empirical monthly percentile, NOT a sampling CI of the mean** (audit caveat). `lower > 0` asserts "every month's lift floor stays positive," a permissive test, read at exactly that strength. A seeded paired-bootstrap p-value of `mean(lift) > 0` is computed and reported **post-run** (informational only; does NOT alter this binding gate).
5. **No-rescue framing** enforced by `protocol`, `decision_grade=False`, `diagnostic_only=True`, distinct out-dir, and this §1 framing.
6. **Survivorship** = resolved precondition (KRX bydd_trd = PIT, step-0 probe PASS, delisted_fraction ≈ 0.002–0.003). Not a live caveat.

---

## §6 — VERDICT WORDING (pre-registered, verbatim)

- **PASS wording (per cell):** "With a liquidity-matched (tradable, ADV≥₩2B) winner denominator, config X on regime R shows recall-LIFT over a same-count random draw with monthly-CI90 lower bound > 0 AND rank-IC IR ≥ 0.30 in THIS offline harness. This is a diagnostic signal that the all-universe FAIL was partly a denominator artifact and the funnel has selection skill on the tradable universe; it is NOT decision-grade and confers no `--apply` / Tier1 / '상승 예측'."
- **FAIL wording (per cell):** "With a liquidity-matched (tradable, ADV≥₩2B) winner denominator, config X on regime R does NOT show recall-LIFT over a same-count random draw (CI90 lower ≤ 0, or fallback < +5pp), and/or IC co-gate < 0.30. Even with the fairest denominator + all available signals, selection skill is unverified; the denominator was not the binding obstacle. Diagnostic generator stays."
- **OVERALL verdict:** ALL-12-FAIL → "[2026-06-18 diagnostic verdict] denominator was not the obstacle; D30 no-apply re-confirmed at the fairest possible bar." ANY-PASS → adjudicate per FROZEN config-selection rule (multi-regime), still diagnostic-only, still no `--apply` (a fair-denominator PASS reopens the *interpretation*, not the production gate, which requires separate USER-gated justification + re-freeze).

---

## §7 — DRIVER + OUTPUT + INVARIANTS

- Driver: `scripts/run_tier0_tradable_winner.sh` (separate; does NOT edit existing drivers). Output → `scripts/out/tradable_winner/cfg{1-4}_{regime}.json`.
- SAME provider wiring as bc (`allow_supabase=True` → DART production preload + `scripts/out/dart_backfill.jsonl` overlay; price/volume from `scripts/out/pit_cache`; pykrx foreign cache). AI cost 0 (no AI calls; Supabase read-only, no `--apply`/migration). cfg3/cfg4 driver guard fail-closes if `earnings_missing_fraction == 1.0` (DART silently dropped).
- **INVARIANTS (verified before + after run):** git-tag `tier0-multiregime-freeze` intact · `tier0-4config-decision-rules.md` zero-diff vs tag · `tier0_factors.py` UNTOUCHED BY THIS VARIANT (0 deletions vs tag; its only diff is the pre-existing additive default-OFF (C) net-issuance code, byte-identical on cfg1-4) · **cfg1-4 / all-universe / no-flag path BYTE-IDENTICAL — proven by re-running default-path `cfg1_bull2425` with the current working tree and reproducing the committed 2026-06-17 `scripts/out/bc/cfg1_bull2425.json` to full float precision (overall_recall/largemid/random_ratio/ic_ir/ic_mean/gate_c/triple + all 24 per-month recalls identical)** · `--apply` never invoked (harness hard-block) · production `tier0_candidates_150`/`short_list_30` untouched · AI cost 0.
- **No post-run threshold tuning. No post-run doc edits except clearly-marked factual results (§8, appended after the run).** Denominator / configs / baselines / CI-method / binding gate / verdict-wording all frozen ABOVE before the run.

---

## §8 — RESULTS (appended AFTER the run — frozen above this line)

**Run 2026-06-18, 12 cells (4-config × 3-regime), offline, AI cost 0, `--apply` not invoked. Claude↔omxy 6-step CONVERGED (omxy ROUND 1 HIGH = DART-overlay-disabled-by-allow_supabase fix; ROUND 2–4 MEDIUM/LOW; CONVERGED ROUND 4).**

### VERDICT: ALL-12-FAIL — the denominator was NOT the binding obstacle.

| cell | gate_a | tradable lift CI90 (lower→upper) | lift_mean | IC_IR | sec_recall (fair denom) | trad_random_ratio | emf |
|---|---|---|---|---|---|---|---|
| cfg1_bear2022 | FAIL | [−0.012, +0.117] | +0.0257 | −0.762 | 0.255 | 1.10 | 1.00 |
| cfg1_recov2023 | FAIL | [−0.014, +0.114] | +0.0412 | −0.291 | 0.279 | 1.17 | 1.00 |
| cfg1_bull2425 | FAIL | [−0.023, +0.153] | +0.0700 | +0.386 | 0.339 | 1.27 | 1.00 |
| cfg2_bear2022 | FAIL | [−0.030, +0.079] | +0.0156 | −0.584 | 0.246 | 1.06 | 1.00 |
| cfg2_recov2023 | FAIL | [−0.064, +0.105] | +0.0196 | −0.141 | 0.260 | 1.08 | 1.00 |
| cfg2_bull2425 | FAIL | [−0.005, +0.135] | +0.0505 | +0.485 | 0.319 | 1.20 | 1.00 |
| cfg3_bear2022 | FAIL | [−0.048, +0.038] | −0.0122 | −0.145 | 0.218 | 0.94 | 0.576 |
| cfg3_recov2023 | FAIL | [−0.046, +0.091] | +0.0183 | +0.400 | 0.257 | 1.07 | 0.569 |
| cfg3_bull2425 | FAIL | [−0.027, +0.134] | +0.0244 | +0.566 | 0.294 | 1.10 | 0.534 |
| cfg4_bear2022 | FAIL | [−0.042, +0.057] | +0.0115 | −0.232 | 0.241 | 1.04 | 0.576 |
| cfg4_recov2023 | FAIL | [−0.063, +0.071] | +0.0019 | +0.377 | 0.243 | 1.01 | 0.569 |
| cfg4_bull2425 | FAIL | [−0.027, +0.105] | +0.0303 | +0.716 | 0.299 | 1.12 | 0.534 |

### Findings (factual)
1. **The audit's denominator critique is VINDICATED on the absolute number.** With the fair (tradable) denominator, absolute recall = **0.218–0.339** vs the 2026-06-17 whole-universe **0.064–0.112** — ~2–3× higher; cfg1_bull2425 (0.339) even clears the frozen 0.20 bar. So the headline "recall 0.112" was substantially a micro-cap-denominator artifact, exactly as the audit said.
2. **BUT the binding skill test FAILS in all 12 cells.** recall-LIFT over a same-count random draw *in the tradable universe* has **CI90 lower bound < 0 in 0/12** (lift_mean is positive in 11/12 but small, +0.002…+0.070, and the CI straddles 0). The matched **random_ratio = 0.94–1.27** (« the 2.5 bar): the funnel recalls barely more tradable winners than a RANDOM pick of the same number of tradable names. The high absolute recall is **coverage of a smaller pond, not selection skill.**
3. **Fixing the denominator REINFORCES "no skill", not weakens it.** Because the matched random baseline rises with the funnel recall, the skill ratio actually DROPS vs whole-universe (1.7 → ~1.1). The fairer the test, the closer the funnel is to random.
4. **IC co-gate** passes in 6/12 (bull cells + cfg3/cfg4 recov), negative in all bear cells — regime-dependent factor beta, not robust alpha. Even where IC passes, the primary lift fails → cell fails. earnings backfill loaded (emf 0.53–0.58 for cfg3/cfg4; cfg1/cfg2 by design = 1.0).

### Conclusion (does NOT touch the frozen all-universe verdict or production)
The **denominator was not the binding obstacle.** Even with the fairest possible (liquidity-matched) denominator + all available signals (earnings backfill loaded) + all 3 regimes, the funnel shows **no statistically-floored selection skill over random selection within the tradable universe.** This is the same result as TASK 가 (selective-largemid lift CI ≤ 0), now confirmed at the natural funnel size across the full 4-config × 3-regime matrix. ⇒ **D30 "diagnostic, leader-inclusive candidate generator — no `--apply`, no Tier1, no '상승 예측' claim" RE-CONFIRMED at the fairest bar.** No production touch, no `--apply`, AI cost 0. Output: `scripts/out/tradable_winner/cfg{1-4}_{bear2022,recov2023,bull2425}.json`. **2026-06-19 downstream note:** this no-apply verdict remains true for any *predictive-gate* claim; after the subsequent combination campaign also failed, USER separately approved B++ as a diagnostic production funnel (not a predictor).
