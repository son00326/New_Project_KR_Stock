# (D) Tier0 CHART/TECHNICAL-INDICATOR COMPOSITE — pre-registered FALSIFICATION SoT (2026-06-18)

> Status: **PRE-REGISTERED / frozen before run**. EXPLORATORY · diagnostic-only · `decision_grade=False`.
> NO `--apply` · NO Tier1 cost · NO Supabase · NO DART HTTP · NO AI · cost 0 · offline `scripts/out/pit_cache`.
> ORIGINAL git-tag `tier0-multiregime-freeze` + `docs/superpowers/tier0-4config-decision-rules.md`
> are untouched. (D) is additive: it adds no chart refs to `tier0_factors.py` and does not edit
> the cfg1-4 / all-universe metric path in `validate_tier0_ic.py`.

This document freezes every indicator, parameter, PIT rule, the kill-switch and its FAIL rule, the
(가)-reuse metric, the adjudicated N, the verdict wording, and the no-mining lock **before** the run.
No threshold, parameter, indicator set, or N may be edited after the run (anti-overfitting lock).

---

## §0 Question being falsified

> Does an **objective classical technical-indicator composite**, used as a Tier0 candidate **selector**,
> select future winners **better than** the B++ trend/score it would replace — or is it just
> **already-tested OHLCV momentum** wearing a different hat?

"Technical" here = **objective, encodable indicators only**. We EXCLUDE all discretionary chart
reading (head-and-shoulders, trendlines, support/resistance zones, Elliott wave, cup-and-handle,
volume-profile). This is a falsification of *objective technicals as a selector*, NOT "do chart
traders win/lose".

The all-universe Tier0 verdict and the largemid-freeze verdict already FAILED their gates, and (가)
(selective-largemid) + (C) (net-issuance) are running as narrower falsifications. (D) is one more
narrow falsification on the SAME largemid / top-50 context as (가).

---

## §1 Data constraint — OHLCV-only, but the panel has only close/high/trdval

The PIT panel (`PanelRow` / `build_series_by_ticker` / `F.StockRaw`) exposes **only**
`closes`, `highs`, `trdvals`, `mktcap`, `list_shrs`. There is **no low, no open, and no raw
volume-count** on the panel (the cache has `TDD_LWPRC` / `TDD_OPNPRC` / `ACC_TRDVOL` but they are
NOT loaded into the panel, and loading them would mutate the frozen boundary and require a
re-harvest). All (D) indicators are therefore computed from the **close + high + trdval** subset.

- **Volume proxy** = `trdval` (거래대금, won) — the same volume proxy B++ already uses
  (`F._volume_surge`, `F.adv60`). Volume-confirmed breakout gates on `trdval`, not share count.
- **ATR / volatility-contraction** — true-range ATR needs `low`, which the panel does not have.
  We PRE-REGISTER the **close-to-close realized-volatility contraction** as the OHLCV-only
  encodable equivalent: `1 − stdev(returns over FAST window) / stdev(returns over SLOW window)`.
  Contraction (ratio < 1, the classic pre-breakout coil) encodes as a higher = more bullish scalar.
  This is a documented limitation, not a silent substitution; it is exactly one equal-rank
  sub-indicator and does not change the kill-switch or the gate.

---

## §2 FROZEN indicator set + parameters (equal-rank ensemble, NO mining)

All parameters are frozen here. Each sub-indicator is a **pure function over the trailing OHLCV
ending at the selection bar `t`**, returns one per-ticker encodable scalar oriented so **higher =
more bullish**, and reuses `F.*` math/normalization helpers. ONE pre-registered parameter set — no
30/50/75 indicator grid, no best-indicator selection, no per-indicator weights.

| Sub-indicator | FROZEN params | Encoding (higher = bullish) | Warm-up (→ NaN) |
|---|---|---|---|
| MA-alignment | `MA_PERIODS = (20, 60, 120)` | count of satisfied `price>MA20>MA60>MA120` inequalities ∈ {0,1,2,3} | `< 120 + 1` closes |
| Golden-cross recency | `GC_RECENCY_WINDOW = 20` (MA20×MA60) | `(W − age) / W` ∈ [0,1] for the most recent MA20-crosses-above-MA60 within W; 0 if none | `< 61` closes |
| RSI zone | `RSI_PERIOD = 14` (Wilder) | raw RSI value (momentum-zone, monotone) | `< 15` closes |
| MACD | `MACD = (12, 26, 9)` (EMA) | histogram `macd − signal` + small bounded signal-cross-up recency add | `< 26 + 9` closes |
| Bollinger | `BB_PERIOD = 20`, `BB_K = 2.0` | composite of `%b` and squeeze→expand (bandwidth vs trailing-min bandwidth) | `< 20` closes |
| Donchian breakout | `DONCHIAN_N = 20` | `1.0` if `close[-1] > max(highs[t-N..t-1])` else proximity `close[-1] / that_high` ∈ (0,1] | `< N + 1` high bars |
| Volume-confirmed breakout | `VOL_AVG_WINDOW = 60`, `VOL_CONFIRM_MULT = 1.5` | Donchian strength, full only when `trdval[t] > 1.5 × mean(trdval[t-60..t-1])`, else damped ×0.5 | `< VOL_AVG_WINDOW + 1` |
| ATR-contraction proxy | `ATR_CONTRACTION_FAST = 20`, `ATR_CONTRACTION_SLOW = 60` | `1 − stdev(ret_fast) / stdev(ret_slow)` (close-to-close realized-vol contraction; §1) | `< SLOW + 1` closes |

Neutral on warm-up: `CHART_WARMUP_NEUTRAL = 50.0`.

**Composite** (equal-rank, NO weights, NO grid):
1. Eligibility = the SAME `F.liquidity_floor_pass(F.adv60(trdvals))` floor as B++ → identical universe.
2. For each sub-indicator, take the raw per-ticker vector over the eligible mask → `F._rank_of`
   (winsorize + percentile_rank).
3. `F.fill_missing_rank(ranks, failure_mask=None)` so warm-up NaN → **neutral-50** (row RETAINED,
   structural-missing semantics identical to the existing B++ factors — never a dropped row).
4. `F._combine_ranks([...])` = equal-weight mean over the **present** ranks per ticker.
5. Output = `chart_composite_rank` per ticker, packaged as a `ScoredStock`-shaped object
   (`score = chart_composite`, `factor_ranks = {sub-indicator ranks}`, `sleeve` from B++ breakpoints)
   so it drops into `F.select_size_sleeves` + the (가) pooled-top-N truncation **without touching
   `tier0_factors.py`** (the chart module is a standalone read-only consumer of `F.*`).

---

## §3 PIT rule (frozen, no look-ahead)

Selection timestamp = **AFTER monthly close** (the shortlist is used the next session), so the same-
day `close[t]` and `trdval[t]` are valid inputs (`build_month_stockraws` already slices
`series[:i]` ending at the panel selection date). Every trailing-window indicator EXCLUDES `t` from
the **comparison** high:

- **Donchian breakout** = `close[-1]` vs `max(highs[-(N+1):-1])` — i.e. the `t-N..t-1` trailing
  high, with `t` EXCLUDED from the max. `close[t]` may break above it; the trailing high it breaks
  must not include `t` (no look-ahead).
- **Volume confirm** = `trdval[t] > 1.5 × mean(trdval[-(VOL_AVG+1):-1])` — the trailing average
  excludes `t`; the breakout-day volume `trdval[t]` is the same-day input being confirmed.

Warm-up: any indicator whose required trailing bars are insufficient returns NaN at the sub-indicator
level → the rank pipeline maps that ticker to **neutral-50** (NOT a dropped row).

---

## §4 ORTHOGONALITY KILL-SWITCH = THE PRIMARY OUTCOME (runs FIRST, gates everything)

The kill-switch is THE headline. It runs FIRST and gates the selector gates (mirrors (C)'s
`aggregate_orthogonality` + `build_verdict` short-circuit).

For each month × bucket, compute Pearson correlation `corr(chart_composite_rank, X)` over the
eligible cross-section, **OVERALL and BY-SLEEVE** (large / mid / small), for:

- `X = trend` — B++ `factor_ranks['trend']`
- `X = full_bpp` — the FULL B++ `sc.score` **on the same large+mid / top-50 context used by (가)**,
  NOT the all-universe 150 frozen decision path.
- `X = size` — `F.percentile_rank(log mcap)` over the eligible cross-section.
- `X = foreign` — **BLOCKED/OFF** in this D run. The objective-technical protocol is OHLCV-only,
  so the driver hard-blocks `--with-foreign`; otherwise the B++ `full_bpp` reference would silently
  change from the (가) trend+size baseline.
- `X = cfg7_surge` — IF available, else **N/A** (cfg7 surge is NOT a B++ `factor_rank`, so in this
  composition it is **N/A by construction** — N/A is NOT a failure).

Aggregate to scope × factor mean + `V._ci90` + raw **bucket-month** series. Because chart scores are
horizon-agnostic while B++ reference scores are bucket-specific, the sample unit is `(month, bucket)`;
the report labels this as `n_samples` / `sample_unit="bucket_month"`. By-regime is satisfied by
per-regime driver invocation (one run per regime window).

Scope labels (`large` / `mid` / `small`) are **relative sleeves inside the already PIT large+mid
universe**, not whole-market small caps. This preserves the (가) selector machinery but must not be
over-read as a whole-market-small result.

### FROZEN FAIL RULE (PRIMARY, pre-registered)

The kill-switch **FIRES** (verdict = "not new, already-tested OHLCV momentum") iff, for `trend` OR
`full_bpp`, ANY scope (overall/large/mid/small) in ANY regime has:

> `|mean corr| ≥ 0.50` **OR** the corr CI90 **UPPER** bound crosses 0.50.

- `size` corr is REPORTED (sleeve-collapse = size restatement) but is NOT the binding fire trigger
  beyond `trend` / `full_bpp`.
- `foreign` unavailable → BLOCKED/OFF, MUST NOT block the `trend` / `full_bpp` / `size` kill-switch.
- `cfg7` missing → N/A, NOT a failure.
- Required `trend` / `full_bpp` scope coverage missing → BLOCKED (selector appendix-only), not PASS.

If the kill-switch FIRES or BLOCKS, `build_verdict` emits the short-circuit verdict and the selector
gates run only as **APPENDIX diagnostics** (`decision_grade=False`), exactly like (C)'s
NOT-ORTHOGONAL short-circuit. The kill-switch result IS the headline.

**INTERPRETATION NOTE (step-4 review, MED — pre-registered honesty):** the `CI90 UPPER` fire-trigger uses the LOCKED `_ci90` = the **empirical 5th/95th percentile of the per-bucket-month correlation sample**, NOT a parametric CI of the mean. So a longer run does NOT necessarily "tighten the CI toward the true correlation" — a FIRE can be driven by a few **tail bucket-months** (especially the thin small relative-sleeve, which has few names/month and a wide per-month corr). The rule is pre-registered and is NOT loosened (loosening = p-hacking). When interpreting the full 48-month verdict: weight the `overall`/`large`/`mid` scopes, and report the small-sleeve per-month **sample sizes** alongside its CI so a thin-sample upper-crossing is not over-read as genuine momentum-redundancy. (Smoke fired only on the small sleeve at CI90-upper ≈ 0.51 while overall corr was ~0.15.)

**FROZEN-INVARIANT PRECISION (step-4 review, LOW):** "frozen UNTOUCHED by (D)" means precisely: (D) adds only the 6 new chart files and the cfg1-4 score/`factor_ranks` are byte-identical + `decision-rules` doc zero-diff + git-tag intact + `tier0_factors.py` has zero chart refs. (D) *imports and reuses* `V.gate_a_pass_selective_largemid` / `V._ci90` / `V.ic_information_ratio` — these live in `validate_tier0_ic.py`, which carries prior in-place (가)/(C)/cfg work in the shared exploratory working tree; that prior work is NOT part of (D) and is not a frozen-decision-path change.

---

## §5 MEASURE (selector) — runs ONLY if the kill-switch PASSES, REUSE (가) VERBATIM

If and only if the kill-switch PASSES, run the chart-composite-**as-selector** on large+mid, reusing
the (가) selective-largemid recall-lift + IC framing VERBATIM:

- **PRIMARY = chart-composite-as-SELECTOR top-50 on large+mid.** Score the chart composite per bucket,
  `F.select_size_sleeves` into L20/M20/S10 (small = 0 on largemid by construction), then the (가)
  FROZEN truncation = pooled top-50 by chart score over the cross-bucket-disjoint union (the SAME
  deterministic `(-score, ticker)` sort as `process_month` `select_count`).
- **recall-LIFT** = `recall(top-50) − same-count-50 RANDOM baseline (N_m / M_m analytic expectation)`,
  per-month lift series → `recall_lift_ci90` via `V._ci90` (the LOCKED method, verbatim). FALLBACK
  +5pp if `< 2` present months.
- **rank-IC IR co-gate** computed over the FULL scored largemid chart universe (IC scope MUST NOT
  shrink with N — (가) risk #1) via `F.spearman_ic` per bucket → `V.ic_information_ratio`.
- **Gate** = `V.gate_a_pass_selective_largemid(lift_ci90, lift_mean, ic_ir)` called VERBATIM
  (PASS iff lift CI90 lower > 0 [fallback +5pp] AND IC IR ≥ 0.30). SAME triple-gate, no tune-to-pass.
- **N = 50 adjudicated.** N = 30 / 75 are sensitivity-only appendix (never pass/fail), exactly as (가).

- **SECONDARY (non-binding)** = marginal (B++ vs B+++chart on largemid-50) via a paired `_LegAcc`-style
  comparison + a direct chart-vs-(가)-B++ recall/IC comparison over the same months / winners
  denominator. Reported, never binding.

---

## §6 DIAGNOSTICS (constraint 5) — diagnostic-only, NO post-hoc removal/reweighting

- Sub-indicator pairwise correlations (`F.pairwise_correlation`).
- Leave-one-sub-indicator-out recall (emergent clusters, diagnostic).

These are emitted under a `diagnostics` block with `decision_grade=False`. There is **NO** post-hoc
cluster removal, **NO** reweighting, **NO** best-indicator selection. ONE pre-registered parameter
set. N = 30 / 75 are flagged sensitivity-only (never pass/fail).

---

## §7 PRE-REGISTERED verdict wording + forbidden-word guard

PRE-REGISTERED fail wording:

> "objective classical technicals are mostly already-tested OHLCV momentum in this monthly PIT
> harness" — **NOT** "chart traders fail".

`FORBIDDEN_VERDICT_WORDS = (rescue, apply, 상승 예측)` enforced by `_assert_verdict_wording` (fail-
closed): the verdict string may not contain any of these. EXPLORATORY · `decision_grade=False` ·
`diagnostic_only=True` · no `--apply` · no Tier1 cost · cost 0.

---

## §8 Frozen-boundary attestation

D-specific frozen-boundary attestation:

- git-tag `tier0-multiregime-freeze`
- `docs/superpowers/tier0-4config-decision-rules.md`
- `scripts/tier0_factors.py` — may already contain prior-session additive non-chart work on this
  branch, but (D) adds **zero chart refs** and does NOT add a `with_chart` param to
  `score_bpp_universe`. The chart selector is a fully standalone generator that consumes `F.*`
  read-only.
- `scripts/validate_tier0_ic.py` — consumed READ-ONLY by (D) (import-only). The driver re-implements the
  (가) deterministic pooled-top-N sort + recall-lift + `V.gate_a_pass_selective_largemid` call
  (composing frozen blocks like (C) does), so the cfg1-4 / all-universe / largemid / selective paths
  are not edited by D.
- `PanelRow` / `build_series_by_ticker` / `StockRaw` — NOT edited (no low/open/volume-count added);
  ATR-contraction uses the close-to-close realized-vol proxy (§1).
- New driver default OFF by being a separate script never invoked by any cron / cfg path.
- Output → distinct out-dir `scripts/out/chart_technical/` (no collision with `scripts/out/bc/`,
  `scripts/out/largemid/`, `scripts/out/selective_largemid/`, `scripts/out/net_issuance/`).

New files: `scripts/tier0_chart.py`, `scripts/test_tier0_chart.py`,
`scripts/run_tier0_chart_falsification.py`, `scripts/test_run_tier0_chart_falsification.py`,
`scripts/run_tier0_chart_falsification.sh`, this doc.
