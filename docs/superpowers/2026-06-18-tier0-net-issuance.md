# Tier 0 — (C) NET-SHARE-ISSUANCE orthogonal-signal FALSIFICATION

**Status:** PRE-REGISTERED before any run · EXPLORATORY / diagnostic-only · **no `--apply`, no Supabase, no DART HTTP, no AI, cost 0, offline `scripts/out/pit_cache`** · ORIGINAL git-tag `tier0-multiregime-freeze` UNTOUCHED.
**Date:** 2026-06-18 · **Owner:** Claude (fixer/verifier) ↔ omxy (critic) CONVERGED spec.
**Does NOT edit:** `docs/superpowers/tier0-4config-decision-rules.md`, git-tag `tier0-multiregime-freeze`, the cfg1-4 / all-universe metric path. `score_bpp_universe(..., with_issuance=False)` (the default) is **byte-identical** to today; attested by `git diff` + the byte-identical default-OFF test.

---

## §1 — FRAMING (load-bearing — read first)

This is a **FALSIFICATION of a genuinely NEW orthogonal signal**, NOT a rescue. The all-universe Tier0 verdict remains **FAILED (NO-CONFIG-PASSES)** — the frozen 19-month triple-gate ran 4 factor-configs × 3 regimes and no config passed (max recall ~0.11; D30/77차 verdict). That verdict is unchanged and is NOT reinterpreted here.

The question this task asks:

> Does adding **net-share-issuance** (diluters rank low, buyback/shrinking-count ranks high) as **exactly ONE equal signed-negated rank component** to the B++ ensemble produce a **marginal recall + rank-IC LIFT** on the ORIGINAL all-universe 150 funnel (the failed system + its diluter failure mode), through the **SAME UNCHANGED triple-gate**?

PRIMARY (binding) = **MARGINAL** (B++ vs B++_with_issuance) on the original all-universe funnel, same gate (recall ≥ 0.20 / IC IR ≥ 0.30 / size). SECONDARY (non-binding, mechanism only) = standalone net-issuance rank-IC + recall. largemid / selective variants = APPENDIX only (NOT run as primary).

Verdict wording is constrained: **FALSIFICATION not rescue, exploratory, no `--apply`, no Tier1 cost, no "상승 예측" claim.** A triple-gate PASS here confers **none** of those.

---

## §2 — BLOCKING PRECONDITION 1: LIST_SHRS PIT-safety (`probe_list_shrs_pit.py`)

`LIST_SHRS` (상장주식수) is present in every non-empty `scripts/out/pit_cache/{MARKET}_{YYYYMMDD}.json` row (same `bydd_trd` daily snapshot provenance as the already-PIT-proven `close`/`mktcap`/`high` used by Gate A).

**Pre-registered assertions** (frozen, no tune-to-pass), checked programmatically offline (cost 0):
- **(a) flat-before-effective** — known corporate-action effective dates: LIST_SHRS flat *before* the date.
- **(b) change-on-effective** — value changes *on/after* the effective date, never earlier (no look-ahead leak).
- **(c) stable control** — an event-free large-cap (삼성전자) is unchanged across the year.
- **(d) newly-listed-no-history** — an IPO ticker is absent from the cache before its listing date (structural neutral-50, not a dilution signal).

**Sampled tickers (pre-registered):** 한화오션/대우조선해양 042660 (107,290,669 flat → 211,729,312 on 2023-06-13, close ~flat = genuine dilution), 에코프로비엠 247540 (24,450,336 → 97,801,344 on 2022-07-15, ~4x, mcap ~4x = corporate action), 삼성전자 005930 (flat 5,969,782,550 all 2022, control), LG에너지솔루션 373220 (IPO 2022-01-27, no pre-history).

**Result (this build, 2026-06-18):** all four assertions PASS → **`pit_status = "PIT_PROVEN"`** (artifact `scripts/out/net_issuance/list_shrs_pit.json`). The stepped historical values (042660 107.3M→211.7M→306.4M on their own effective dates; 005930 flat) prove genuine historical snapshots, NOT a backfilled current-master field (a backfilled master would print today's share count on all historical dates).

**HARD GUARD (omxy lock):** if `pit_status == "PIT_ASSUMED"`, the harvest report carries the stamp AND the adjudicator/summary MUST forbid any triple-gate PASS from being read as decision-grade (fail-closed). The driver `run_net_issuance_falsification.py` enforces this programmatically (`decision_grade=False`, PASS downgraded to `BLOCKED (PIT_ASSUMED)` in the verdict).

---

## §3 — BLOCKING PRECONDITION 2: SPLIT / REORG HYGIENE

`mcap ≈ price × shares` continuity is NOT sufficient (a split satisfies it). `tier0_factors.split_like` + extreme-jump detection (pure, per ticker-month over the issuance lookback window) neutralize:

- **SPLIT** = `jump_ratio ≥ SPLIT_SHARE_JUMP_MIN (1.5)` AND inverse price move (`price_ratio ≤ 1/jump × (1+SPLIT_PRICE_TOL=0.15)`) AND continuous mcap (`|jump × price_ratio − 1| ≤ MCAP_CONTINUITY_TOL=0.15`) → face-value/split → raw issuance = NaN → **structural neutral-50** (NOT winsorized into the signal).
- **EXTREME** = `jump_ratio ≥ EXTREME_SHARE_JUMP (3.0)` → neutralize regardless of price (corporate-action territory; e.g. 에코프로비엠 ~4x, mcap ~4x, price flat — NOT a clean split but still neutralized to avoid a spurious −300%-style dilution signal dominating).
- **한화오션 ~2.0x, price NOT inverse, mcap ~2x** is below EXTREME and FAILS the split test → it correctly **REMAINS a genuine dilution signal (ranks LOW)**. This boundary is intentional and pre-registered: real dilution kept, mechanical splits/extreme corporate actions neutralized. NOT cherry-picking.

Thresholds (1.5 / 3.0 / price tol 0.15 / mcap tol 0.15) are PRE-REGISTERED here; no tune-to-pass.

**ETF / SPAC / preferred / rights-listing EXCLUSION:** issuance adds **NO new universe rows**. The candidate universe is the existing `screen_shortlist_tier0.fetch_universe` / harvest `universe_at` set (single source); the universe filter is inherited UNCHANGED. No paid corporate-action data. Any residual odd-share-count ticker that leaks is absorbed by the split/extreme neutralizer + structural neutral-50.

Per-month `issuance_neutralized_splits` / `issuance_neutralized_extreme` counts are emitted so the neutralization rate is auditable.

---

## §4 — SIGNAL (pre-registered, frozen)

- `issuance_3m = LIST_SHRS[t]/LIST_SHRS[t−63] − 1` ; `issuance_12m = LIST_SHRS[t]/LIST_SHRS[t−252] − 1` (all lookbacks ≤ selection date t). Lookback consts `ISSUANCE_LOOKBACK_3M=63`, `ISSUANCE_LOOKBACK_12M=252`.
- **NEGATIVE sign:** `raw = −mean(available {issuance_3m, issuance_12m})` → diluters (positive issuance) → low percentile rank; buyback/shrinking-count (negative issuance) → high rank.
- **Missing window** (newly listed / pre-2022 gap so < the lookbacks; or split/extreme neutralized) → NaN → `fill_missing_rank` with **failure_mask=None** → **structural neutral-50** (same pattern as earnings/quality structural-missing). Issuance is never a "fetch failure" because LIST_SHRS is in every panel row → never penalty-5.
- **Shrunk 12m-evidence window:** the offline cache begins 2020-10. For the earliest selection months (~2022-01) the 252-trading-day window reaches back to ~2021-01 — fully covered. Months before that lose `issuance_12m` → neutral via `issuance_3m` (63d) when present; documented, not hidden.

---

## §5 — INTEGRATION (no grid search, no weight tuning)

`score_bpp_universe(..., with_issuance: bool = False)`. **Default False = NO 5th factor → identical score, identical `factor_ranks` keys {trend, foreign, earnings, quality} = the byte-identical lock.** When True ONLY: `ranks["issuance"] = fill_missing_rank(_rank_of(elig_mask(raw)))[i]`. `rank_ensemble_score` already takes an equal mean over present ranks → automatically equal-weight. NO grid search, NO weight tuning, NO threshold edits.

---

## §6 — ORTHOGONALITY GATE (pre-registered, run BEFORE trusting the marginal verdict)

Per selection-month **and horizon bucket** (`short`/`mid`/`long`), on the liquid-eligible cross-section, Pearson correlation (ranks are 0–100 percentile so Pearson on ranks ≈ Spearman) of `issuance_rank` vs each of `{trend_rank, foreign_rank, earnings_rank, quality_rank, size_rank}` where `size_rank = percentile_rank(log(market_cap))`.

- **PASS = |mean corr| < 0.5 for every pair, OVERALL AND in EACH sleeve (large / mid / small).**
- **INSUFFICIENT DATA FAIL-CLOSED:** if any factor/scope pair has zero measurable monthly correlations (for example a disabled/constant factor), orthogonality is **NOT proven** and the block fails instead of silently passing.
- **RUN-MODE COVERAGE (step-4 review fix + step-6 finding):** reference factors are only computed when their providers are enabled.
  - **`trend`, `size`** — measured in EVERY run (these directly answer the size/momentum-proxy concern — confirmed `|corr| < 0.5`, issuance is NOT a size or momentum restatement).
  - **`foreign`** — measured with `--with-foreign` (offline pykrx cache, free). Verified measurable; answers the flow-proxy concern.
  - **`earnings`, `quality`** — **BLOCKED-OFFLINE in this environment.** The DART overlay in `validate_tier0_ic._build_real_providers` only loads when `dart_key AND live_client (Supabase)` are present; with `DART_API_KEY`/Supabase OFF and `allow_supabase=False`, the local `dart_backfill.jsonl` is NOT loaded (no offline ticker→corp_code provider). So `--earnings` does NOT make earnings/quality orthogonality measurable here. Measuring them would require an offline DART corp_code provider = **USER-gated / future work**, NOT a blocker for this falsification.
  - **MARGINAL baseline:** default (foreign/earnings OFF) = the PRE-REGISTERED trend+size B++ marginal (the binding conclusion). `--with-foreign` shifts the baseline to include foreign (diagnostic).
  - **The substantive marginal recall-lift conclusion is reported and binding REGARDLESS of the earnings/quality orthogonality gap** — issuance is established orthogonal to the 3 offline-measurable factors (trend/size/foreign), and a NEGATIVE marginal needs no orthogonality at all (there is no lift to "trust").
- **By-sleeve is the load-bearing check:** small-caps structurally issue/dilute more, so issuance may correlate with size pooled. If `|corr(issuance, size)| ≥ 0.5` in ANY sleeve → orthogonality FAIL → issuance is a size restatement, NOT a new orthogonal signal → the marginal "lift" is NOT trusted.
- Aggregate across bucket-month observations: mean + CI90 (`_ci90`) of each pairwise correlation, overall and per-sleeve, emitted as the `orthogonality` block. **Raw correlations emitted**, not just pass/fail. This block is reported BEFORE the marginal triple-gate verdict.

---

## §7 — MEASUREMENT

- **PRIMARY (binding) = MARGINAL** on the ORIGINAL all-universe 150 funnel via the SAME UNCHANGED triple-gate: run the harvest TWICE over the same months/panel — `bpp` (B++ alone) and `bpp_iss` (B++ + issuance, `with_issuance=True`) — to DISTINCT out-dir, then diff: ΔGate-A overall_recall, ΔIC IR, Δleader_hits, Δlargemid_recall, and per-month recall-lift CI90 (`_ci90` on the paired per-month recall series, same winners denominator per month). Both legs in one invocation (honest paired comparison). A raw `MARGINAL_LIFT` diagnostic requires **both** recall-lift CI90 lower bound > 0 and ΔIC IR > 0.
- **SECONDARY (diagnostic, non-binding) = standalone** net-issuance rank-IC per horizon (`F.spearman_ic` on iss_rank vs forward returns) + standalone issuance-only recall using the same 3-horizon 150-count sleeve-quota shape (issuance rank alone vs winners). Emitted as `issuance_standalone` — labeled mechanism-evidence-only.
- **APPENDIX only:** largemid / selective variants — NOT run as primary in this task.
- All frozen stamps (`survivorship_label`, `pit_status`, `generated_at`, `parameter_lock_commit_hash`, `freeze_tag`) flow through unchanged; the driver ADDS a top-level `pit_status` + the issuance frozen-params echo block.

---

## §8 — FROZEN BOUNDARY + VERDICT WORDING

UNTOUCHED / byte-identical: git tag `tier0-multiregime-freeze`; `docs/superpowers/tier0-4config-decision-rules.md`; the cfg1-4 metric path (`with_issuance=False` default + `select_bpp_for_harvest` + all gate functions + thresholds `GATE_A_OVERALL_RECALL_MIN=0.20` / `GATE_B_IC_IR_MIN=0.30` / Gate C); `PARAM_LOCK_COMMIT_HASH="17dc6d9"`; `FREEZE_TAG`. The default CLI path emits byte-identical JSON.

NEW (additive, default-OFF, exploratory): `with_issuance` kwarg (default False); `StockRaw.list_shrs` / `PanelRow.list_shrs` (default); `issuance_return` / `split_like` / `net_issuance_signed_raw` pure helpers + consts; the new driver `run_net_issuance_falsification.py` (canonical output `scripts/out/net_issuance/net_issuance_report.json`; smoke default output `scripts/out/net_issuance/net_issuance_smoke_report.json`, and `--smoke` refuses the canonical path); the new probe `probe_list_shrs_pit.py`.

**VERDICT WORDING (enforced by the driver):** output is exploratory/diagnostic FALSIFICATION. Forbidden words: "rescue", "apply", "상승 예측". If `pit_status == "PIT_ASSUMED"`, any triple-gate PASS is hard-gated to `BLOCKED (PIT_ASSUMED — not decision-grade)`. `decision_grade=False` always on this path.
