# Tier0 cfg5 / cfg6 — EXPLORATORY / DIAGNOSTIC-ONLY addendum (2026-06-17)

> **This is an ADDENDUM. It does NOT amend the frozen decision-rules doc
> (`docs/superpowers/tier0-4config-decision-rules.md`) or its git-tag
> `tier0-multiregime-freeze`. Those remain byte-frozen.**

## 1. Why

The frozen 19-month PIT triple-gate (recall ≥ 0.20, IC IR ≥ 0.30, size composition) FAILED
across all **4 factor-configs × 3 regimes** (max recall 0.112). That run answered "do the B++
**factors** clear the bar?" — no. It did **not** isolate whether the binding recall failure is a
**single-composite AGGREGATION** problem or a **SIGNAL INSUFFICIENCY** problem.

cfg5 and cfg6 are two **candidate-GENERATION** variants added purely to diagnose that question.
They change *how candidates are picked*, not *how results are measured*. The frozen measurement
path (recall / IC / size metric computation + thresholds in `scripts/validate_tier0_ic.py`, plus
`tier0_factors.score_bpp_universe` and the size-sleeve primitives) is reused **unchanged**.

## 2. The two variants (pre-registered + frozen in code)

### cfg5 — regime / leading-sector tilt
- A coarse KR market regime + leading sectors computed from a **TRAILING window ending strictly
  before the selection date, with an explicit lag** (`CFG5_TREND_LAG = 21` trading days,
  `CFG5_TREND_WINDOW = 126`). **Never** same-month or forward returns → PIT-safe, no look-ahead
  (enforced by `test_tier0_cfg56.TestCfg5PITSafety`).
- Leading sectors = trailing sector-mean return top `CFG5_LEADING_FRACTION = 0.30`.
- Candidates in leading sectors get an additive score bump (`CFG5_SECTOR_BUMP = 8.0`) **before**
  `select_size_sleeves`. Because the frozen 20/20/10 per-sleeve quota still binds, the tilt only
  re-orders **within** each sleeve → Gate C size distribution is preserved by construction and it
  cannot degenerate into sector cherry-pick beyond the sleeve quotas. The score *measured* by the
  frozen gates is the original (un-tilted) ensemble score.

### cfg6 — multi-net union
- `K = 3` pre-registered screens: `("composite", "trend", "foreign")`.
- Each screen emits its top `CFG6_TOP_N_PER_SLEEVE = 30` per sleeve; take the **UNION** (dedupe by
  ticker), then **downselect to FINAL CAP = 150** via the frozen `select_size_sleeves`
  (tie-break = screen score desc, composite score desc, ticker asc; sleeve quotas reuse B++
  20/20/10 → 60/60/30).
- **`--with-foreign` is REQUIRED for cfg6** (the foreign screen is one of the K=3). With foreign
  OFF, `foreign_at()` returns NaN for every ticker, the foreign screen contributes zero members,
  the union shrinks below the 60/60/30 sleeve quotas, and `select_size_sleeves` raises
  `SleeveShortfallError`. The tracked driver's three cfg6 jobs carry `--with-foreign`, and the
  smoke command in §4 does too. The foreign data is read from the offline PIT cache (cost-0).
- **NO-RETRY** on over/under-fill means no relaxed second run and no silent truncation. The
  frozen `select_size_sleeves(backfill=True)` intra-run backfill is still allowed; if it cannot
  fill the quotas, `SleeveShortfallError` surfaces.
- **Defense-in-depth per-month skip (EXPLORATORY-only, never silent):** so a single bad selection
  month cannot abort a whole regime run, `validate_tier0_ic.harvest_pit_months` catches a
  generator `SleeveShortfallError` for cfg5/cfg6 *only*, skips that month, and **records** it under
  `generation_diagnostics.generator_shortfall_months` (+ `generator_shortfall_count`).
  `harvest.months_analyzed` then reflects only the months actually measured. The frozen bpp
  (cfg1-4) path never enters this branch — its `SleeveShortfallError` propagates byte-identically.
  This is a safety net, not a substitute for `--with-foreign`: a correct cfg6 run produces zero
  shortfall months.
- **omxy correction (binding):** with the 150 cap, `union > 150` forces a downselect, so cfg6's
  recall **CAN fall below the best member screen**. cfg6 does **NOT** guarantee higher recall; it
  exists only to answer the aggregation-vs-signal question. Reports must not claim cfg6 improves
  recall.

## 3. Hard rules (do not violate)

1. **Thresholds UNCHANGED** (recall ≥ 0.20, IC IR ≥ 0.30, size). A FAIL is the honest answer.
   No tuning-to-pass.
2. The frozen gate/measurement path stays **byte-identical** for cfg1-4 and for all metric
   functions. cfg5/cfg6/cfg7 are implemented in `scripts/tier0_cfg56.py` and reuse the
   frozen measurement on the generated candidate list. The only change in
   `scripts/validate_tier0_ic.py` is a **default-preserving** generator hook
   (`generator=None → select_bpp_for_harvest`), an **additive** `exploratory` field +
   `exploratory_verdict` label, and an **additive** provenance stamp — no metric/threshold line
   changed (attested by `git diff`).
3. **PASS or FAIL → still NO-APPLY.** Any cfg5/cfg6/cfg7 "PASS" is emitted as **"EXPLORATORY PASS"**
   (a distinct `exploratory_verdict` field + an `exploratory: true` flag + an `(EXPLORATORY)`
   marker in the adjudicator table) so it is never mistaken for a decision-grade PASS. The
   adjudicator excludes cfg5/cfg6/cfg7 from `winners` entirely. Since cfg5 is offline-BLOCKED, only
   runnable exploratory configs (currently cfg6/cfg7) can surface under `exploratory_pass`.
4. A **decision-grade PASS** for any new generator would require a **SEPARATE re-frozen expanded
   protocol** + a **new holdout** + a **family-wise / alpha adjustment** (multiple-comparisons inflation).
   None of that is done here. This exploration is **decision-grade-INVALID by construction**.
5. **Mandatory per-cell diagnostics** are serialized under `generation_diagnostics.per_month`
   for cfg5/cfg6/cfg7 harvest JSON: Jaccard overlap vs canonical B++ selection, unique-leader hits
   vs B++, candidate count BEFORE cap (cfg6 union), leaders DROPPED post-cap, size + sector
   distribution, and `random_baseline` ratio.
6. **cost 0** — cfg5's trailing window reuses the already-sliced PIT panel; cfg6's foreign
   screen reads the offline foreign PIT cache (`scripts/out/pit_cache/foreign/`). **No NEW
   Supabase/DART fetch at runtime** (`allow_supabase=False` in the CLI provider wiring for
   cfg5/cfg6/cfg7); the only KRX/pykrx I/O is the universe + price + cached-foreign fetch shared
   with the frozen cfg1-4 path (free, cost-0). **No `--apply`**.

## 4. How to run

```bash
# single exploratory cell (smoke, fast, offline cache).
# cfg6's frozen screen set is (composite, trend, FOREIGN) → --with-foreign is REQUIRED.
# Without it, foreign_at()→NaN for every ticker, the foreign screen emits nothing, the
# union cannot fill the 60/60/30 sleeve quotas, and select_size_sleeves raises
# SleeveShortfallError (the defense-in-depth per-month skip then records a documented
# shortfall instead of silently truncating — but the screen is inert, so always pass
# --with-foreign for a real cfg6 run). The foreign PIT cache is offline at
# scripts/out/pit_cache/foreign/ (no new fetch, cost-0).
scripts/.venv/bin/python scripts/validate_tier0_ic.py \
  --start-month 2025-01-01 --end-month 2025-02-01 \
  --cache-dir scripts/out/pit_cache --out scripts/out/bc/smoke_cfg6.json \
  --smoke --universe-limit 600 --generator cfg6 --with-foreign

scripts/.venv/bin/python scripts/validate_tier0_ic.py \
  --start-month 2025-01-01 --end-month 2025-02-01 \
  --cache-dir scripts/out/pit_cache --out scripts/out/bc/smoke_cfg7.json \
  --smoke --universe-limit 600 --generator cfg7

# cfg5 smoke is allowed only as a blocked-source diagnostic; do not run it as a full matrix cell:
scripts/.venv/bin/python scripts/validate_tier0_ic.py \
  --start-month 2025-01-01 --end-month 2025-02-01 \
  --cache-dir scripts/out/pit_cache --out scripts/out/bc/smoke_cfg5.json \
  --smoke --universe-limit 600 --generator cfg5

# frozen cfg1-4 × 3-regime decision matrix + cfg6/cfg7 × 3-regime exploratory appendices.
# cfg5 is excluded because its leading-sector idea is offline-BLOCKED (§5).
bash scripts/run_tier0_6config_matrix.sh

# adjudicate: cfg1-4 decide the frozen verdict; cfg6/cfg7 are non-blocking exploratory appendices;
# cfg5 is reported BLOCKED, not runnable.
scripts/.venv/bin/python scripts/adjudicate_4config.py --bc-dir scripts/out/bc
```

The ignored `scripts/out/bc/run_4config.sh` copy is not the source of truth; use the tracked driver above.
The full 19-month harvest for cfg6/cfg7 is a **later step** (time gated like the cfg1-4 run). Missing
cfg6/cfg7 evidence is reported as `EXPLORATORY_MISSING` but does **not** invalidate the frozen cfg1-4
verdict. cfg5 remains `BLOCKED` until a committed PIT-dated universe-wide industry map exists.
cfg5/cfg6/cfg7 are always excluded from `winners`; cfg6/cfg7 can only appear under `exploratory_pass`, never
as a decision-grade winner.

## 5. ⚠️ cfg5 leading-SECTOR tilt is BLOCKED offline (no PIT-safe offline sector source)

cfg5's intended idea ① is a **leading-SECTOR** tilt: identify the leading *industry sectors* from
a trailing window, then bump candidates in those sectors. Testing that offline requires a
universe-wide industry/sector label for every ticker on each PIT selection date, sourced without
network.

**Investigation result — no usable offline sector source exists:**

- **KRX bydd cache (`scripts/out/pit_cache/*.json`)** carries `SECT_TP_NM`, but that is a *market
  board section* (KOSDAQ only: 우량기업부 / 벤처기업부 / 중견기업부 / 기술성장기업부 …; **empty for
  all KOSPI rows**). It is a listing tier, **not** an industry sector — unusable for a
  leading-sector tilt.
- **`krx_openapi` fetch fields** (`fetch_bydd_trd`, `fetch_isu_base`) expose price/mktcap/board
  fields and 보통주 classification, but **no industry code**.
- **Industry resolution** (`screen_shortlist_tier0.resolve_sectors_for_universe` →
  `dart_corp_codes.induty_code` + `canonical_sector_mapper`) is **Supabase/DART-backed**, which is
  forbidden at runtime here (`allow_supabase=False`, no DART fetch).
- The only committed offline mapping is **`scripts/sector_override.json` (44 tickers)** plus a few
  review CSVs (~33 tickers), overwhelmingly 반도체-biased manual corrections. That is ~1.6% of the
  ~2,800-ticker universe — far too sparse and skewed to drive a universe-wide leading-sector tilt.

**Decision:** we do **NOT** fabricate sectors via Supabase/DART (hard constraint), and we do not
ship a degenerate tilt off a 44-ticker map. Under `allow_supabase=False`,
`resolve_sectors_for_universe(None)` leaves **almost all** tickers `unresolved`; only the
`sector_override.json` tickers (~44, overwhelmingly 반도체) get a real canonical label. cfg5's
leading-sector bump therefore acts on `"unresolved"` as if it were one giant sector plus that tiny
biased sliver — it does **not** reflect a genuine universe-wide leading-sector signal.

**Proven by a real offline cfg5 cell run** (`--generator cfg5`, 2022-01..2022-03, no Supabase):

| month | `jaccard_vs_bpp` | `unique_vs_bpp` | `sector_dist` keys |
|---|---|---|---|
| 2022-01 | 0.911 | 7 | `unresolved`, `반도체`, `엔터/미디어` |
| 2022-02 | 0.923 | 6 | `unresolved`, `반도체` |
| 2022-03 | 0.936 | 5 | `unresolved`, `반도체` |

The selection is ~91-94% identical to bpp; the only divergence is driven by the ~44 manually
overridden (mostly 반도체) tickers, not by a real leading-sector measurement. The `sector_dist` is
dominated by a single `"unresolved"` bucket — there are effectively no resolved sectors to lead.

**Status: cfg5 idea ① (leading-SECTOR tilt) = BLOCKED on an offline PIT-safe sector source.** cfg5
remains PIT-safe and honest (no forward/same-month leak, no fabrication), but offline it is a
**near-trivial tilt off a sparse biased override**, NOT a valid test of the leading-sector
hypothesis. Its `jaccard_vs_bpp < 1.0` must **not** be read as evidence the leading-sector idea
works — the divergence is an artifact of the 반도체-skewed override. The other exploratory lever
(cfg6 multi-net union) is fully testable offline and is unaffected. Resolving cfg5 would require a
committed, PIT-dated, universe-wide industry map (e.g. a frozen historical
`dart_corp_codes.induty_code` snapshot exported to a local file) — out of scope for the cost-0 /
no-network constraint of this addendum.

---

## §cfg7 — DAILY SURGE PROXY (TASK B amendment, 2026-06-17)

**Status:** EXPLORATORY / diagnostic-only · offline · no `--apply` / no Supabase / cost 0 · ORIGINAL universe (NOT largemid) · runnable offline (unlike cfg5; therefore NOT in `BLOCKED_CONFIGS`, but also NOT a decision-grade winner — like cfg6).

### What cfg7 is — and is NOT

cfg7 is a **"daily surge proxy"**. It is **explicitly NOT a prism replication.** prism = **intraday + P&L-judged**; cfg7 = **daily + recall-judged** (a funnel diagnostic: "does a daily surge signal surface eventual winners early enough for the funnel?"). cfg7 reuses the size-sleeve primitives (`score_bpp_universe` + `select_size_sleeves` + `SLEEVE_QUOTA`) so **Gate C size composition is preserved by construction**, identical to cfg5/cfg6. The SELECTION uses a daily-surge rank; the **SCORE measured by the frozen gates stays the original `ScoredStock.score`** (same pattern as cfg5 — the tilt only changes *which* tickers enter, never the measured score).

### Signals (offline daily only, PIT-safe trailing windows + explicit lag; FROZEN constants)

| signal | source (frozen, reused — no edit) | window |
|---|---|---|
| volume_surge | `F._volume_surge(trdvals, short=5, long=60)` (MA5/MA60−1) | 5/60 |
| short-horizon return | `F.recent_return(closes, CFG7_SURGE_WINDOW)` | `CFG7_SURGE_WINDOW = 5` |
| proximity-to-recent-high | `F.high_proximity(highs or closes, CFG7_HIGH_WINDOW)` | `CFG7_HIGH_WINDOW = 252` |
| recent trend (lagged, no same-day leak) | `F.risk_adjusted_trend(closes, CFG7_TREND_LB, skip=F.SKIP_DAYS=21)` | `CFG7_TREND_LB = 60`, lag 21 |

The 4 signals are percentile-ranked (`F._rank_of`) and averaged over present components (`F._combine_ranks`) into a per-sleeve daily-surge rank, then `F.select_size_sleeves` takes top-N per sleeve. All windows end at the selection date `t`; `risk_adjusted_trend` carries an explicit `SKIP_DAYS` lag so there is no same-day leak.

### Recall reinterpreted (funnel diagnostic, not P&L)

Recall here = "does the daily surge surface eventual winners early enough for the funnel" — a funnel diagnostic, NOT alpha/P&L.

### Mandatory secondary metrics per cell (`generation_diagnostics.cfg7_secondary_metrics`)

1. **lead-time-to-winner-move** — see the PRE-REGISTERED winner-move definition below. mean/median lead-time per horizon, with a **censored count** (picks that never crossed within the horizon — reported as NaN/censored, **never imputed to 0 or horizon**).
2. **fwd 1d/5d/20d return of picks** — mean + hit-rate (parallels `selection_performance`).
3. **churn / duplicate rate across months** — fraction of selected that repeats month-over-month.
4. **recall-LIFT vs BOTH a random baseline AND a high-volume baseline** — random = the frozen `random_baseline`; high-volume = a NEW pre-registered control `cfg7_high_volume_baseline` (rank by `F.adv60` alone, top-N per sleeve via `select_size_sleeves`). **cfg7 must beat BOTH or the surge signal is just liquidity.** All four are diagnostic (EXPLORATORY); **no gate threshold is added.**

**Interpretation (pre-registered, honest):** `recall_lift_vs_high_volume <= 0` means the surge signal is **indistinguishable from mere liquidity** — an honest FAIL, NOT a reason to tune. (Smoke evidence: a 2025-01..2025-02 offline smoke produced `recall_lift_vs_high_volume = -0.04`, i.e. surge ≤ liquidity in that window — reported as-is, not tuned.)

### PRE-REGISTERED winner-move definition (frozen in code constant + this doc, non-tunable post-hoc)

A "winner move" for ticker *i* at selection month *t*, horizon *h*, occurs on the **FIRST forward trading day d** (d ≥ entry_idx = t+1, with `ENTRY_GAP_DAYS` halt tolerance — identical to `compute_forward_return`) for which the cumulative return from the entry price p0 (entry = t+1 close, `ENTRY_OFFSET_DAYS`) reaches the **SAME top-decile winner threshold used by Gate A**:

```
threshold_h = F.quantile(present forward_h returns, TOP_DECILE_Q = 0.90)   AND   cum_ret >= threshold_h   AND   cum_ret > 0
```

i.e. the winner-move bar is the first day the pick's running cumulative return crosses the cross-sectional top-decile-positive bar that `top_decile_winners()` uses to **define** winners. lead-time = (that day's index − entry_idx) in trading days. If the pick never crosses within `horizon_days[h]`, lead-time is **censored** (NaN, counted separately — never imputed). This anchors lead-time to the **existing** winner definition (`TOP_DECILE_Q`, positivity) — **no new tunable threshold is introduced** — and is computed identically across all cfg7 cells. Implemented in `validate_tier0_ic.first_day_reaching_threshold`.

### Adjudicator

cfg7 is added to `CONFIGS` and `EXPLORATORY_CONFIGS`, NOT to `DECISION_CONFIGS` and NOT eligible for `winners` (decision-grade-invalid, like cfg6). cfg7 is offline-runnable so it is NOT in `BLOCKED_CONFIGS` (cfg5-only). A cfg7 "EXPLORATORY PASS" confers no `--apply` / Tier1 / "상승 예측" claim.

## 6. cfg8 — SURGE ON LARGE+MID (un-deferred 2026-06-18)

**cfg8 = the cfg7 daily-surge generator restricted to `--universe largemid`** (USER-requested prism
combined-recipe approximation / falsification). The CLI previously BLOCKED `--universe largemid` + any
non-bpp generator (the cfg8-deferral guard); cfg8 is un-deferred **specifically** (`generator in
(bpp, cfg7)` on largemid), while **cfg5/cfg6 + largemid stay BLOCKED**. Invoked as
`--generator cfg7 --universe largemid`; the run JSON carries `generator="cfg7"` + `universe="largemid"` +
`exploratory=true`, keyed as `cfg8_<regime>.json`. Same gate (cfg7 funnel = `gate_a_pass_largemid`) +
the cfg7 secondary metrics (recall-lift vs random AND vs high-volume baseline, lead-time, fwd 1d/5d/20d,
churn) measured on largemid, plus the largemid additive baselines. EXPLORATORY — OUT of `DECISION_CONFIGS`,
never a winner, no `--apply`.

**PRE-REGISTERED fail wording (verbatim):** "daily surge + largemid restriction adds no recall edge over
liquidity/random in THIS offline monthly/daily harness" — NOT "prism fails". **Fair-prism caveat:** a fair
prism comparison would need intraday triggers + executable entry/exit + slippage/fees/impact + position
sizing + stops + P&L/risk (explicitly OUT of scope). **NEGATIVE-HYPOTHESIS:** TASK B (cfg7 all-universe)
already FAILED; cfg8 is a falsification of surge-on-largemid, NOT a rescue.

Full pre-registration: `docs/superpowers/2026-06-18-tier0-cfg8-surge-largemid.md`. Driver:
`scripts/run_tier0_cfg8_surge_largemid.sh` → `scripts/out/cfg8/`. Offline, no Supabase, cost 0,
trend/surge-only (no `--earnings`/`--with-foreign`).
