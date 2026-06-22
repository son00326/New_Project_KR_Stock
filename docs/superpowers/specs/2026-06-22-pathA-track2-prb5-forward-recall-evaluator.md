# PR-B5 design spec — Track 2 generator-shadow Stage 1 forward recall evaluator

**Status**: DESIGN SPEC (Claude↔omxy loop). No code yet. Branch `tier0-bpp-multiregime`.
**SoT parent**: `docs/superpowers/specs/2026-06-20-pathA-track2-generator-shadow.md` — §6 (measurement contract, AUTHORITATIVE — cited not re-derived), §10 PR-B5 row, §12 D4 (USER first-verdict gate). This spec **operationalizes §6**; it does not re-decide §6/§12 policy.
**Target code (when implemented)**: additive extension of `scripts/validate_tier0_ic.py` + new `scripts/pg_smoke_0039_prb5.sh`. `scripts/probe_pit_survivorship.py` already exists (reused **+ one additive `--emit-artifact PATH` flag**, §5.1 — the probe today only prints+exits and writes no machine-readable artifact).
**Precondition**: PR-B1 (`shadow_gen_core.py`) + PR-B2 (migration 0039) + PR-B3 (`shadow_gen_runner.py` + `screen_shortlist_tier0.py --shadow-sector`) + PR-B4 (`shadow_reconcile.py` reconcile REPORT) all CONVERGED+committed.

> **Drafting provenance**: Claude dynamic-workflow (6 ground → synth → 4 adversarial critics: feasibility/statistical-validity/forward-honesty/coherence) → this authored draft folds in all HIGH/MED critique fixes. omxy/Claude document-review convergence is stamped only after this loop, not pre-claimed. The statistical critique materially shaped §4 (see §4.0).

---

## §0 — Scope / invariants / what this is NOT

### 0.1 What this is
PR-B5 makes §6.1–§6.7 **runnable**: a **post-process** forward-recall evaluator that (1) reads the 0039 shadow tables over an **owner psql** connection, (2) computes forward winners on the universe-wide snapshot ticker set via the **already-built** `validate_tier0_ic.py` forward engine, (3) calls `gate_a_recall` **twice per period per non-mirror arm** with shared frozen denominators to produce the **PRIMARY recall-lift** `recall(shadow arm) − recall(production-mirror)`, and (4) emits a verdict **report file**. It never writes a DB, never emits a verdict before the §6.1 data floor + a pre-registered power floor + survivorship probe PASS + USER sign-off.

### 0.2 What this is NOT (inherited, non-negotiable — do NOT re-decide)
- **Production effect 0** (T2-I-6): no production-table write; no `service_role` read of shadow. Shadow read is **owner psql only** (PR-B4 precedent, `shadow_reconcile.py`). The **evaluator runtime path performs no DB write of any kind** (no production, no shadow). (The §10.3 connection smoke bootstraps fixtures into a throwaway temp DB via the 0039 RPC and drops it — that is test scaffolding, not the evaluated path, identical to PR-B4's `pg_smoke_0039_prb4.sh`.)
- **Forward-only** (T2-I-8, §9): the sector map is a current-only artifact (parent §0.3/§9). **No past-period sector backtest, no `--month` backfill, no PIT sector re-derivation.** PR-B5 evaluates only forward windows that have actually elapsed.
- **No verdict before floor + survivorship**: the §6.1 `n_periods` floor and the survivorship probe PASS are **hard refusals** — below either, the evaluator emits `INCOMPLETE_RUN`, never PASS/FAIL and **never `recall=0`**.
- **n_periods≥6 is a NECESSARY data-existence floor, NOT a sufficient verdict floor** (see §4.0/§4.6): the verdict floor is a **pre-registered `power_floor_n`** the USER fixes at the §12 D4 first-verdict sign-off. Below it, the evaluator may emit a `DIRECTIONAL` label but **never `PASS`**.
- **USER-gated first verdict** (§12 D4): two USER gates — (a) the owner-psql data extraction is a USER operation (external state, like a PR-B4 production reconcile run), and (b) USER acceptance of the forward timeline + a frozen pre-registration stamp.
- **Claim discipline** (§6.7, T2-I-11, D30 no-apply): no "상승 예측" / "outperformance" / "sector will lead" / "sector-aware is better/더 낫다" wording until a valid Stage-1+ PASS. Report wording caps at "shadow generation-stage counterfactual observation (verification pending)".
- **SECONDARY is ★#1-gated**: vs persisted `tier0_candidates_150` requires B++ adopted as production scorer (★#1) + selection-identity parity; today (★#1 not applied) SECONDARY is `INCOMPLETE_RUN` for **all** periods — honest, not a bug.

### 0.3 Estimand (the one number PR-B5 produces)
PRIMARY, per `(arm∈{sector-soft-tilt, sector-hard-gate}, track)` at the **pre-registered primary horizon `h*`** (one per track, §4.0):
```
period_lift_p   = shadow_report_p.per_horizon[h*] − prod_mirror_report_p.per_horizon[h*]   (paired, SAME winners)
PRIMARY series  = { period_lift_p : p ∈ non-overlapping periods where h* has MATURED for p }
PASS-candidate iff CI90(series) lower > 0 AND Gate-A co-gate IC IR ≥ 0.30 AND n ≥ power_floor_n AND FWER-corrected
```
The binding series is the **per-horizon lift of the pre-registered primary horizon `h*`**, NOT `report.overall` (which is a descriptive co-metric — using `.overall` would conflate matured and immature horizons within a period, §2.5/§4.0). A period enters the series for `h*` only once `h*` has matured for that period. `prod_mirror` = the `production-mirror` **arm of the same shadow run** (not persisted production-150 — that is SECONDARY). `recall − random-baseline` is a **separate co-metric** (the analytic N/M baseline inside `RecallReport`), NOT the PRIMARY lift. A single-regime / beta-confounded PASS-candidate is not mechanically downgraded by code, but is flagged for mandatory USER acceptance before any claim (§4.0/§9).

---

## §1 — Data read model (owner psql, FIX-J, reconcile-gated)

### 1.1 Connection & authority
Read path = **human-analyst OWNER psql connection** — identical to PR-B4 (T2-I-6). The 0039 grant block revokes `service_role` and grants `SELECT` only to `authenticated` under `is_admin()` RLS, so PR-B5 **cannot and must not** use a `service_role` client. The pure evaluator consumes **JSON facts the operator produced from owner queries** (PR-B4 `--coverage-json`/`--print-sql` pattern). **The production extraction run is itself a USER operation** (external state); CLAUDE verifies the query form against local PG via `scripts/pg_smoke_0039_prb5.sh` and runs the pure evaluator on synthetic/operator-fed JSON. There is **no CLAUDE end-to-end production path**.

### 1.2 Two owner queries
- **Query 1 — reuse PR-B4 verbatim**: `shadow_reconcile.RECONCILE_GAP_SQL` → `classify_coverage_row` → per production-monthly-period coverage `complete | missing | anomaly`. **Only `complete` periods are eligible**; `missing`/`anomaly` → excluded from the floor as `INCOMPLETE_RUN`, never scored 0.
- **Query 2 — NEW PR-B5 shadow-run extract** (MATERIALIZED-CTE, owner-run, `json_agg` emit). Per eligible period, **anchor `run_id` from the production-mirror candidate rows** (FIX-J), then join snapshot + hypothesis on `(period_key, run_id)`:
```sql
-- PR-B5 shadow-run extract. OWNER/psql. RAW FACTS only; classification/scoring in pure Python.
with mirror_run as materialized (     -- FIX-J: run_id anchored from production-mirror candidates
  select period_key, min(run_id) as run_id, count(distinct run_id) as run_id_count
  from public.tier0_candidates_150_shadow
  where arm = 'production-mirror' and period_key = $1     -- one complete period at a time
  group by period_key
),
cand as materialized (                -- per-arm selected rows (numerators), same run only
  select c.period_key, c.arm, c.ticker, c.bucket, c.rank, c.tier0_score, c.status,
         c.counterfactual_cut, c.gate_eligible_size, c.universe_hash, c.universe_size,
         c.run_id, c.sector_view
  from public.tier0_candidates_150_shadow c
  join mirror_run mr on mr.period_key = c.period_key and c.run_id = mr.run_id
),
snap as materialized (                -- universe-wide ticker set (winner denominator basis)
  select s.ticker, s.name, s.bucket, s.rank, s.tier0_score,
         s.sector, s.sector_source, s.induty_code, s.sector_view, s.run_date,
         s.universe_hash, s.universe_size, s.run_id
  from public.tier0_shadow_universe_snapshot s
  join mirror_run mr on mr.period_key = s.period_key and s.run_id = mr.run_id
),
hyp as materialized (
  select h.source, h.leading_sectors, h.as_of, h.selection_as_of, h.params, h.hypothesis_hash
  from public.tier0_shadow_sector_hypothesis h
  join public.tier0_candidates_150_shadow c on c.hypothesis_id = h.id
  join mirror_run mr on mr.period_key = c.period_key and mr.run_id = c.run_id
  group by h.source, h.leading_sectors, h.as_of, h.selection_as_of, h.params, h.hypothesis_hash
)
select json_build_object(
  'period_key',  $1,
  'run_id',      (select run_id from mirror_run),
  'run_id_count',(select run_id_count from mirror_run),
  'candidates',  (select json_agg(cand) from cand),
  'snapshot',    (select json_agg(snap) from snap),
  'hypothesis',  (select json_agg(hyp) from hyp)
);
```

### 1.3 Per-arm selection extraction (numerators)
From `candidates`, per `arm`: `selected_all` = `{ticker}` over `status='logged'` rows; `selected_by_horizon` = `{bucket → {ticker}}`; `largemid_selected` = subset whose **whole-market** size tier ∈ {large, mid} (§2.3); `counterfactual_cut` (hard-gate only) for §8; `gate_eligible_size` (hard-gate only) — a `logged` hard-gate arm with `gate_eligible_size < 150` violates the 0039 row CHECK ⇒ `INVALID_INPUT`.

### 1.4 Universe-snapshot winner basis (shared denominator)
Snapshot stores the **universe ticker set, NOT forward returns**. Evaluator: (1) reduce up-to-3N snapshot rows (one per `(ticker,bucket)`) to the **distinct ticker set** per period; (2) compute forward returns on that distinct set via the reused engine (§2); (3) derive `winners_all`/`winners_by_horizon` via `top_decile_winners` — **independent of selection, the IDENTICAL frozen object passed to both `gate_a_recall` calls** (§4.1).

### 1.5 Cross-arm universe invariant (defense-in-depth read guard)
The finalize RPC merges the run-level `universe_hash` into every arm (run-level wins), so a cross-arm mismatch is structurally impossible at write time; PR-B4's reconcile checks only mirror-vs-snapshot. PR-B5 still asserts **all active arms in the run share one `universe_hash`** as a **fail-closed read-side guard against hand-fed extract JSON** (not a functional reconcile gap) → `INVALID_INPUT` (`universe_hash_mismatch_across_arms`) if violated.

### 1.6 Period-key split
Reuse `shadow_gen_runner._is_monthly_period_key`/`_is_weekly_period_key` (single validator source). **Weekly `YYYY-Www` = short track, PRIMARY arm-vs-mirror only**; SECONDARY is structurally **NOT_APPLICABLE_WEEKLY_GRAIN** (persisted `tier0_candidates_150` is monthly-only — 0039 `month` CHECK day=1; distinct reason code from "production row absent"). **Monthly `YYYY-MM`** additionally permits SECONDARY (★#1-gated). PR-B4's reconcile gate is monthly-only; for the weekly short track PR-B5 runs the same `complete` check inline (150/1-run/all-logged + same-run full snapshot + `universe_hash` match).

### 1.7 Fail-closed extractor discipline
Apply PR-B4's `ShadowEvalInputError` (mirrors `ReconcileInputError`, `feedback_failclosed_symmetric_completion`): type-check every field before use, no truthiness `or {}`, reject wrong-type/missing/cross-run. A malformed hand-fed JSON row **aborts**, never coerces.

---

## §2 — Forward-return sourcing (KRX PIT panel, entry t+1)

### 2.1 Engine reuse (cost 0)
Pure reuse of the `validate_tier0_ic.py` forward engine; AI cost 0, additional fetch 0 (parent §7). Panel via `load_pit_panel(...)`, date index = `panel_trading_days(panel)` (trading-day keys, NOT business-day calendar), `selection_index(dates, t)` maps a period's selection date to `t_idx`.

### 2.2 Entry & horizons
- **Entry = t+1** close (`ENTRY_OFFSET_DAYS=1`, `ENTRY_GAP_DAYS` halt tolerance), **identical for both arms** (parent §6.2) — same-bar-bias-free.
- **Horizon table** = the frozen `HARVEST_BUCKETS = (short, mid, long)` with `HORIZON_DAYS = {short:21, mid:63, long:126}` trading days. Track 2 `bucket ∈ {short,mid,long}` keys map directly.
- **midlong-100 (parent §6.5) operationalization**: §6.5 enumerates "midlong combined 100 where applicable". The frozen `HORIZON_DAYS` has **no `midlong` key** — there is no single combined forward window. Therefore PR-B5 marks the midlong-combined-100 null cell **`NOT_APPLICABLE_NO_COMBINED_HORIZON`** and evaluates midlong via its **mid and long per-horizon cells** (each 50-count) rather than inventing a combined window. This is the explicit operationalization of §6.5 against the frozen horizon table, not a silent drop. (If a combined-track recall metric is ever added, the 100-count maps to the deduped mid∪long selection scored against the deduped mid∪long winner set — pre-registered, not implementer-invented.)
- `compute_forward_return` status taxonomy: `ok` / `gap` (halt → last-available) / `delisted` (`DELISTING_RETURN_NO_PRICE=-1.0`) / `insufficient` (range) / `absent`. **halt ≠ delisting**.

### 2.3 Size-tier classification for largemid
`canonical_size_tiers(stocks)` needs `StockRaw.market_cap` + `trdvals` (for `adv60`/liquidity floor) — which the snapshot **table** does NOT carry. So size tiers are NOT computed from snapshot columns; instead PR-B5 **reconstructs `StockRaw` for the snapshot ticker set from the PIT panel** (the `build_month_stockraws` → `slice_series_at` path: `load_pit_panel` carries `mktcap` per bar + `trdvals`; foreign/DART fields omitted — `canonical_size_tiers` uses only cap + ADV). The snapshot supplies the **ticker set**; the panel supplies the **size inputs**. Breakpoints are computed over the **full snapshot universe** (whole-market — the panel covers the full universe), then selected/winner tickers classified. **Never recompute breakpoints on a restricted set.** (If, for a given period, the panel lacks `mktcap` for the snapshot tickers, `largemid_*` for that cell is `NOT_APPLICABLE_NO_SIZE_INPUT` — pass empty sets to `gate_a_recall`'s `largemid_*` and label the `largemid_recall` field N/A; the PRIMARY per-horizon lift does not depend on largemid.)

### 2.4 No-replacement winner discipline (FIX-I)
PR-B5 pre-filters the per-horizon return dict before calling `top_decile_winners`: missing / halt-without-price / delisted-without-price are **excluded from both numerator and denominator**, never imputed (parent §6.5). Then `top_decile_winners` applies its locked rule to that filtered dict (q=0.90 AND >0, needs ≥10 present). Same winner set both arms. **Thin-print guard**: a `gap`/`delisted`-status last-available return can spike on a thin final print; the winner basket excludes `delisted`-status returns from the denominator while keeping them in selection accounting, and a `gap`-status return qualifies as a winner only if its last available bar had **`trdval > 0`** (concrete threshold, not implementer judgment — anti-spurious-winner; report the count of excluded thin prints in `report.warnings[]`).

### 2.5 "Period evaluable only after horizon elapses" (forward-only latency)
A period `p` is evaluable for horizon `h` **only once** `entry_idx(t+1) + HORIZON_DAYS[h] + ENTRY_GAP_DAYS` trading-bar indices exist in the panel beyond the selection bar **AND** the PIT panel is harvested through that target date. The evaluator asserts the **trading-day index** (not calendar days) has the required bars **before** accepting a cell, else forces `insufficient` regardless of any returned number. Cells whose window has not matured are **excluded from the floor** for that `(arm,track,horizon)` — never partially scored. **The `long` bucket (126 trading days ≈ 6 months post-entry) sets the binding wall-clock floor**: a midlong verdict needs `power_floor_n` monthly periods EACH with a matured 126-day window, so the long-horizon cell matures last — the USER D4 timeline must be calibrated to the long-horizon tail, not "6 months".

---

## §3 — Reuse map (functions, integration, NEW code)

### 3.1 Reused (do NOT rewrite — `validate_tier0_ic.py`; line numbers drift, re-confirm at impl)
| Function | Role in PR-B5 |
|---|---|
| `compute_forward_return(panel, dates, ticker, t_idx, horizon_days, *, entry_offset=1)` | per-ticker forward return + status, both arms |
| `top_decile_winners(returns_by_ticker, q=0.90)` | shared winner basket (FIX-I non-NaN) |
| `recall(selected, winners)` | `|sel ∩ win| / |win|` |
| `gate_a_recall(selected_all, selected_by_horizon, winners_all, winners_by_horizon, universe_size, *, largemid_selected, largemid_winners, leader_basket, baseline_selected=None) -> RecallReport` | **called twice per period per non-mirror arm**, shared frozen denominators |
| `gate_a_pass_selective_largemid(lift_ci90, lift_mean, ic_ir)` | **PASS PREDICATE arithmetic only** (CI90 lower>0, +5pp NaN-fallback, co-gate IC IR≥0.30) — see §3.2 caveat |
| `ic_information_ratio(monthly_ics)` | Gate B co-gate IC IR (see §4.4 ddof note) |
| `gate_b_pass(...)` | Gate B per `(arm,track,horizon)` |
| `gate_c_largemid(...)` / `gate_c_size_composition(...)` | Gate C — `NOT_APPLICABLE` unless sleeve/coverage metadata |
| `_ci90(values)` | CI method: **empirical 5/95 percentile** (≥2 present else NaN) |
| `_pooled_recall` / `_mean` | pooling helpers |
| `LEADER_BASKET_2026_06` (11-ticker) | tripwire-only, **same object both arms**, **never a pass gate** |
| `load_pit_panel` / `panel_trading_days` / `selection_index` / `compute_month_forward` | panel + forward orchestration |
| `probe_pit_survivorship.py` | survivorship gate (§5) |

### 3.2 ⚠️ Reuse caveat — the existing "lift" is recall − RANDOM, NOT arm-vs-mirror (critique HIGH)
`gate_a_pass_selective_largemid` is reused **only as the PASS-DECISION arithmetic** (CI90-lower>0 / +5pp fallback / IC-IR≥0.30 co-gate). Everywhere in the live harness, the "lift" fed to it is `recall − analytic-random-baseline` (single-arm). PR-B5's **PRIMARY lift series `recall(shadow) − recall(mirror)` is NEW code** — it is NOT produced by any existing `aggregate_harvest` block (those are random-baseline lifts and are not called on the shadow path). The function's frozen docstring metric (recall−random) differs from the fed series (recall−mirror); **only the threshold logic transfers, not the metric definition.** The recall−random comparison remains available as a **separate descriptive co-metric** (the `RecallReport.random_baseline`), not the binding PRIMARY input.

### 3.3 Integration — Option 1 (post-process sibling), NOT Option 3 (parent §6.3 injection)
**Do NOT inject `secondary_selected` into `process_month`** and **do NOT add a "shadow mode" branch inside `aggregate_harvest`** — `process_month` builds one selection internally and `aggregate_harvest` is hard-bound to `MonthResult` with zero arm dimension; both are the frozen cfg1-4 / B+C provenance and must stay **byte-identical**. Instead PR-B5 adds **wholly new sibling functions** that reuse only leaf helpers:
1. **`harvest_shadow_periods(...)`** — sibling orchestrator (parallels `harvest_pit_months`). Per eligible period: build the panel + winners on the snapshot distinct-ticker set, call `gate_a_recall` twice per non-mirror arm (mirror + arm), compute `period_lift`. Returns a list of `ShadowPeriodResult`.
2. **`aggregate_shadow_harvest(shadow_period_results, arms, ...)`** — sibling to `aggregate_harvest` (NOT a branch inside it). Pools the per-period lift series, computes `_ci90` over the series, runs `gate_a_pass_selective_largemid` as the PASS predicate (§3.2), `gate_b_pass` (scoped) for B, `gate_c_largemid`/`NOT_APPLICABLE` for C, applies FWER + power floor (§4), stamps SECONDARY=`INCOMPLETE_RUN` until ★#1.
3. **`ShadowPeriodResult`** — dedicated dataclass exposing only the read attributes the aggregator needs (`period_key`, `regime`, per-arm `selected_*`/`recall`/`period_lift`, `winners_*`, `universe_size`, `largemid_*`, `counterfactual_cut`, per-cell `n_winners`). **Not** a `MonthResult` adapter.
4. Survivorship gate read (§5); owner-psql JSON parse + `ShadowEvalInputError`; `--shadow-eval` argparse flags (§7); `pg_smoke_0039_prb5.sh`.

`aggregate_harvest`, `process_month`, `harvest_pit_months` stay **byte-identical and untouched** (§11 grep gate).

---

## §4 — Paired metric, baseline, gates, FWER, power

### 4.0 Statistical posture (folded from the adversarial statistical critique — load-bearing)
The PRIMARY estimand is a difference of **small noisy recalls** (the project's own 2026-06-17 multi-regime verdict measured per-horizon recall 0.018–0.045, overall ≤0.112 on this engine). Consequently:
- **`n_periods≥6` is a data-existence floor, NOT a verdict floor.** At n=6, `_ci90` (empirical 5/95) is a near-all-positive sign test, and after the registered FWER correction (the uncollapsed arm×track×horizon grid would be m=12; §4.0/§4.5 intentionally reduce the binding family to primary horizons) the corrected interval is still underpowered. The verdict floor is a **pre-registered `power_floor_n`** from a power calc (given the observed per-period lift SD, the n for 80% power to detect a pre-registered minimum lift, e.g. +0.05); below it the evaluator emits a `DIRECTIONAL` label or `INCOMPLETE_RUN`, **never `PASS`**.
- **One primary horizon per track** (pre-registered) is the verdict endpoint; the other horizons are **secondary/descriptive**. The three horizons on the same picks are overlapping windows (mid63⊂long126), not independent confirmations — collapsing to one primary endpoint per track both honours pseudo-replication and shrinks the FWER family.
- **Per-track partitioning**: the entire pipeline (floor, `_ci90`, FWER family, `power_floor_n`) is computed **separately per track** (short / midlong) — they have different cadence (weekly / monthly) and different `power_floor_n`. A single `--shadow-extract-json` may carry both; the evaluator partitions by `_is_weekly_period_key` / `_is_monthly_period_key` before any aggregation.
- **Non-overlapping forward windows**: for the weekly short track, the floor `n` is counted in **non-overlapping** windows. The evaluator does NOT assume the operator extracted non-overlapping periods — it **decimates** with a deterministic greedy rule: sort evaluable periods by `entry_idx`, keep a period only if its `entry_idx ≥ prior-kept entry_idx + HORIZON_DAYS[h*]`. The pooled CI assumes weak dependence; document that effective n « calendar periods and inflate the required `power_floor_n` accordingly (or use a block/Newey-West variance for the pooled lift).
- **Regime sensitivity (ADVISORY, not a mechanical PASS blocker)**: a positive pooled lift concentrated in one regime can be sector-beta, not retrieval skill (2026-06-17 found IC is regime-dependent beta). At a realistic first-verdict `n` (one contiguous forward window ≈ one macro regime) a hard "≥2 regimes" gate is unreachable, so PR-B5 does NOT make it a code-level PASS blocker. Instead: (a) each period carries a pre-registered **regime label** (kill-rule file); (b) the report emits **regime-stratified lift** + a **beta-orthogonalized co-metric** (the per-period lift after regressing each arm's recall on the pre-registered leading-sectors' realized return / a sector-cap-weighted benchmark) so a reviewer can see whether the lift survives removing sector beta; (c) if all PASS-eligible periods fall in one regime OR the beta-orthogonalized lift is not also positive, the report **flags `single_regime_or_beta_confounded` for mandatory USER review** before the verdict is accepted. The report remains a numeric PASS-candidate with `user_review_required=true`, not an auto-accept. This is the honest treatment of the confound the achievable sample cannot mechanically resolve.

### 4.1 PRIMARY (arm-vs-mirror lift)
Per period, per non-mirror arm, two `gate_a_recall` calls with **SHARED frozen** `winners_all`, `winners_by_horizon`, `universe_size`, `largemid_winners`, `leader_basket` (the IDENTICAL objects — §10.2 asserts object identity); only `selected_all`, `selected_by_horizon`, `largemid_selected` vary. The binding `period_lift = shadow_report.per_horizon[h*] − prod_mirror_report.per_horizon[h*]` (the pre-registered primary horizon `h*`, §0.3/§4.0); `.overall` and the non-primary horizons are descriptive co-metrics. `universe_size` = the **full pre-cut production universe size** — **even sector-hard-gate keeps the full-universe denominator** so the recall drop shows honestly (hard-gate underfill → `INCOMPLETE_RUN` checked **before** the lift is appended).

### 4.2 CI method — `_ci90` (empirical 5/95), not bootstrap
**Select** the **LOCKED empirical 5/95 percentile** `_ci90` over the per-period lift series, for consistency with the 73/74/77차 B+C validation (the parent §12 D0 lists "bootstrap/t" as a USER option, not a directive; PR-B5 chooses `_ci90` and does not introduce a second CI method). The PASS predicate `gate_a_pass_selective_largemid` (CI90 lower > 0; co-gate IC IR ≥ 0.30, `GATE_B_IC_IR_MIN=0.30` defined in `validate_tier0_ic.py`, reused frozen) is reused **for its threshold arithmetic only**. ⚠️ **Hard guard precedence**: the reused predicate enforces **no `n` floor** and has a `+5pp` fallback that fires when the CI is NaN (n<2) — both would permit a small-n PASS the spec forbids. Therefore PR-B5 wraps it: `if n < power_floor_n: return DIRECTIONAL` **short-circuits before the predicate is ever consulted**, and the `+5pp` NaN-fallback is **disabled on the shadow path** (a n<2 series is `INCOMPLETE_RUN`, never a +5pp PASS). The predicate fires **only after** the `power_floor_n` + FWER + |winners| floors (§4.6); the regime/beta advisory (§4.0) is stamped after numeric classification and never acts as a hidden mathematical gate.

### 4.3 Same-count random baseline — **ANALYTIC N/M (LOCKED), NOT a seeded Monte-Carlo draw**
Parent §6.5 says "same-count random null … no replacement". The LOCKED harness already implements the **analytic `N/M` per-period expectation** (`random_baseline = len(selected)/universe_size`), which **is the exact mean of the same-count no-replacement (hypergeometric) null** — deterministic, no seed. PR-B5 **reuses the analytic baseline** and does **NOT** introduce a seeded Monte-Carlo draw: a seed would add sampling noise + a tunable surface (the p-hack vector this project bans) and would diverge from the frozen B+C protocol. If a distributional null is ever wanted, use the **hypergeometric variance analytically**, not MC. The "seed in kill-rule file / reproducibility key" machinery from a literal reading of §6.5 is therefore **dropped** for the null. (The kill-rule file still exists for the OTHER pre-registrations — `power_floor_n`, primary horizon per track, regime labels, leader_basket, arms — see §7/§12.) The random baseline is a **descriptive co-metric** (random_ratio), not the PRIMARY binding lift (§3.2).

### 4.4 Gates B / C
- **Two distinct uses of IC — keep them separate**:
  - **Gate A co-gate IC IR** (load-bearing, computable): the PASS predicate's `ic_ir` arg is a per-period rank-IC series = `spearman(snapshot.tier0_score, forward_return[h*])` on the snapshot rows for the primary horizon/bucket `h*`, pooled with the `ic_information_ratio` formula across periods. The snapshot **does** carry per-(ticker,bucket) `tier0_score` and the panel gives forward returns, so this IS computable (do NOT default it to N/A). **ddof resolved**: compute the IR with **ddof=1** (small-sample SD) on the shadow path via a shadow-only wrapper/optional kwarg — the existing `ic_information_ratio` helper uses population SD (ddof=0), which biases IR high at small n (≈+10% at n=6), so do not call it unwrapped for the binding shadow co-gate. `GATE_B_IC_IR_MIN=0.30` (defined in `validate_tier0_ic.py`) stays frozen (no retune). Note the 2-decimal `numeric(12,2)` `tier0_score` quantizes the IC slightly — report it.
  - **Full Gate B** = `gate_b_pass(require_baseline=True)` **IS `NOT_APPLICABLE` for Stage-1** (not "may be"): `baseline_ic_ir` / `sleeve_ics` / `spreads` are **not persisted** in any shadow table and not reconstructable, and `require_baseline=True` makes a missing baseline a hard FAIL — so the honest state is `NOT_APPLICABLE`, blocking a *full* triple-gate PASS → the cell verdict is `DIRECTIONAL_GATE_B_NA` after all non-B floors pass. Do not fabricate a baseline. **ADJUDICATE p-band**: the harness computes no p-value; absent an explicit p the cell is **fail-closed to ADJUDICATE** (never PASS) — "0.05<p<0.15" is not dead spec but a fail-closed default.
- **Gate C** = `NOT_APPLICABLE` (≠ PASS) unless sleeve/coverage metadata is present. Shadow tables carry `sector`/`sector_view`/`induty_code`, so a real sector-concentration Gate C is possible. Claiming sleeve discipline without metadata = `INVALID_INPUT`.

### 4.5 FWER
Parent §6.6 fixes the **family size** as the `arm×track×horizon` grid and the no-single-arm/period-pass rule but **names no correction procedure**. PR-B5 selects:
- **Simultaneous family (binding)**: with the §4.0 "one primary horizon per track" rule, the binding family collapses from the full grid (`(non-mirror arms) × tracks × horizons` = 2×2×3 = 12) to **`m = (non-mirror arms) × (tracks)`** = the primary-endpoint count (non-primary horizons are descriptive, excluded from the binding family). Concretely with 3 arms (production-mirror + 2 non-mirror) and 2 tracks (short, midlong): **m = 2 × 2 = 4**, so Bonferroni α_corr = 0.10/4 = 0.025 per endpoint; widen each CI accordingly. **Bonferroni** is the conservative default (Holm/Šidák left USER-open per §12).
- **Sequential looks — deferred, NOT built now**: this is a forward-accruing design, but a formal alpha-spending boundary (O'Brien-Fleming etc.) has no current consumer — the CI-lower>0 predicate is not a p-value, and the first verdict is many periods away with plausibly one or two looks. So PR-B5 controls optional-stopping the lean way: the kill-rule file **pre-registers the number of intended verdict attempts and a single committed verdict date** (no peeking before it); if >1 attempt is planned, Bonferroni is applied uniformly across the looks (conservative, consistent with the frozen `_ci90` protocol). A formal spending function is **deferred to a follow-up** once a real look schedule is known — do not pre-build the machinery.
- `power_floor_n` is computed under the FWER-corrected α (the Bonferroni'd α materially raises the required n — feeds §4.0/§12).

### 4.6 Floors (hard refusals, enforced inside the evaluator)
- **Per-period `|winners| ≥ 10`** (consistent with `top_decile_winners` ≥10): a cell whose winner basket is below this is `INCOMPLETE_RUN` for that cell — tiny-winner periods (quantized, unstable recall) do not enter the pooled CI.
- **Data floor `n_periods ≥ 6`** per `(arm, track, horizon)` (parent §6.1): below → `INCOMPLETE_RUN`.
- **Verdict floor `n ≥ power_floor_n`** (§4.0): below → `DIRECTIONAL`/`INCOMPLETE_RUN`, never `PASS`. Both floors are enforced inside the evaluator (not an env var).

### 4.7 triple_gate integrity (false-convergence guard)
`triple_gate_all_pass` must equal the boolean AND of the per-cell Gate A/B/C verdict fields; a top-level boolean disagreeing with the gate fields → `INVALID_INPUT` abort. Re-derive PASS from **raw per-cell findings**, never trust an aggregate `converged:true` (`feedback_workflow_verify_false_convergence`).

---

## §5 — Survivorship probe (precondition gate)

### 5.1 Reuse — do NOT rebuild
`scripts/probe_pit_survivorship.py` already exists (D30/77차). It fetches KRX `bydd_trd` for an OLD and a RECENT date for one `--market` per invocation (KOSPI or KOSDAQ); `gone = set_old − set_recent`. **PASS (exit 0)** if `gone` non-empty (delisted/merged-at-time present → PIT survivorship-free); **FAIL (exit 1)** if old==recent (survivors only); **UNKNOWN (exit 2)** if a snapshot is empty. It checks **KRX universe-endpoint survivorship only**. ⚠️ **Today it only `print()`s + `sys.exit(0|1|2)` — it writes NO artifact file.** So PR-B5 adds one **additive `--emit-artifact PATH` flag** (default off → byte-identical) and the evaluator must cover both KOSPI and KOSDAQ by invoking the probe once per market or by looping internally in the artifact path. The artifact is a per-market list JSON `[{market, old_date, recent_date, old_count, recent_count, gone_count, exit_status, schema_version}]`. This is the only change to the probe; §5.2 reads that artifact (not stdout).

### 5.2 THE FIX (load-bearing — anchor to the string, not the line)
The harness today **hard-codes** the survivorship label to a "clean … step-0 probe PASS" string passed into the harvest aggregation, and **never reads the probe exit code** — the label is an assertion, not a gate. **The implementer must grep for that exact `survivorship_label="clean…"` string, confirm exactly one caller, and ensure the shadow path does NOT route through it / overrides it with a probe-derived label** (line numbers drift; the string is the stable anchor). PR-B5's shadow path must:
1. Read a **probe artifact** with recorded exit status, and **machine-assert the artifact's OLD/RECENT dates bracket the actual forward window being evaluated** (fail-closed if not — do not trust the operator to refresh; a stale artifact from the historical harvest window must not pass silently).
2. On FAIL/UNKNOWN → set `survivorship_label = "survivorship-biased: recall=upper-bound"` and **BLOCK every forward-winner / recall-lift verdict** (parent §6.5).
3. **Panel-level coverage check** (the probe is universe-endpoint-level only): assert the forward panel retains tickers that delist DURING a forward window as `status=delisted` with a resolvable entry price, NOT silently `absent`; if the absent rate is inconsistent with the expected delisted fraction → `INCOMPLETE_RUN` (`panel_survivorship_unverified`). The probe gates "is the panel PIT", this gates "does the forward panel exclude delisted leaders by absence".
4. `delisted_fraction` (expected ~0.002–0.004) is **report-only** corroboration (anomalous zero with a non-empty universe is a red flag) — **not** a binding gate (avoid tune-to-pass; the probe is the binding gate).

### 5.3 Cache-availability guard — OUT OF SCOPE, document re-arm
The `rcept_dt ≤ as_of` fail-closed guard (`feedback_pit_backtest_cache_availability`) is **dormant** for Track 2 (forward-only, no backtest mode). Document: if a forward-then-historical PIT-replay is ever added, the guard **re-arms scoped to backtest mode only** (live/forward screen keeps cache HITs per the quarterly-path regression lesson). Stated so the invariant is not silently lost.

---

## §6 — INCOMPLETE_RUN / abort matrix (parent §6.5 full list, enforced as code branches)

Each abort = a distinct `INCOMPLETE_RUN` / `INVALID_INPUT` / label branch with a reason code. **Never `recall=0`.** Re-derive verdicts from raw per-cell findings (§4.7).

**RUN-LEVEL terminal guards (checked BEFORE any per-cell aggregation, so an empty lift series never reaches `_ci90`):**
- **mirror arm absent** — the FIX-J `mirror_run` CTE anchors `run_id` from production-mirror candidates; if the mirror arm is missing, `mirror_run.run_id IS NULL` and the whole extract is empty → `INVALID_INPUT (mirror_arm_absent)` (not a per-cell abort — the anchor zeroes the period).
- **zero eligible periods** (all reconcile `missing`/`anomaly`, or all decimated out) → run-level `run_verdict=INCOMPLETE_RUN`, `reason_code=no_eligible_periods`; do NOT aggregate an empty series (which would yield `_ci90`=[NaN,NaN] → the disabled +5pp path).
- **all periods plumbing-only** (`sector_view.source=='absent'` everywhere → every cell `NOT_APPLICABLE_PLUMBING_ONLY`) → run-level `run_verdict=INCOMPLETE_RUN`, `reason_code=INCOMPLETE_RUN_PLUMBING_ONLY` (distinct from a vacuous PASS/FAIL); this is NOT evidence of "no sector effect".

**PRIMARY-eligible (arm-vs-mirror, ★#1-independent) → `INCOMPLETE_RUN`:**
- `n_periods < 6` (data floor) → `INCOMPLETE_RUN`; `n < power_floor_n` after the data floor → `DIRECTIONAL_POWER_FLOOR` (allowed), `PASS` forbidden.
- per-period `|winners| < 10` for the cell (§4.6).
- checked arm missing in the run.
- forward data insufficient (`compute_forward_return` → `insufficient`, or window not matured §2.5) — that `(arm,track,horizon,period)` cell only.
- `run_date` / sector `asOf` stale (`asOf ≥ selection_as_of`; 0039 CHECK `shadow_hypothesis_asof_preselection`). (A concrete `run_date`-stale bound is pre-registered in the kill-rule file so a logged-but-never-evaluated run is enforceably stale.)
- `universe_hash` mismatch across arms (§1.5) or mirror-vs-snapshot.
- complete same-run universe snapshot absent (`candidates.run_id ≠ snapshot.run_id`).
- immutable hypothesis mismatch (`hypothesis_content_mismatch` / `hypothesis_source_mismatch`).
- survivorship probe FAIL/UNKNOWN or panel-level coverage unverified (§5).
- Gate B scoped IC inputs not reconstructable → `DIRECTIONAL_GATE_B_NA` only; full `PASS` blocked (§4.4).

**SECONDARY-only (vs persisted production-150, monthly-only) → additionally `INCOMPLETE_RUN`:**
- `period_key` is weekly (`YYYY-Www`) → `NOT_APPLICABLE_WEEKLY_GRAIN` (persisted production-150 is monthly-only; **distinct from "production row absent"**).
- production row absent for the (monthly) period.
- production-mirror ↔ persisted selection-identity parity fail (`{(ticker,bucket,rank)}` set-eq + `round(tier0_score,2)`, ε=0; **sector/name/signal_label EXCLUDED**).
- ★#1 NOT applied (TRUE today → SECONDARY = `INCOMPLETE_RUN` for ALL periods; short-circuit on the ★#1 flag before running parity to avoid misleading parity-fail noise).

**EXCLUDED-FROM-LIFT (label, not abort):**
- tilt/gate arm with `sector_view.source == 'absent'` → `NOT_APPLICABLE_PLUMBING_ONLY` (lift is structurally 0 because all arms == production-mirror; **NOT** evidence of "no sector effect", parent §6.5).
- parent §6.5 "midlong combined 100 where applicable" has no frozen `HORIZON_DAYS` combined key → `NOT_APPLICABLE_NO_COMBINED_HORIZON` (descriptive null cell, not a dropped §6 case).
- panel lacks `mktcap`/`trdvals` to reconstruct `StockRaw` for size-tier diagnostics → `NOT_APPLICABLE_NO_SIZE_INPUT` for `largemid_*` only; PRIMARY per-horizon lift remains eligible (§2.3).

**INVALID_INPUT (hard abort):**
- Gate C sleeve-discipline claimed without metadata.
- `triple_gate` boolean ≠ AND of gate fields (§4.7).
- malformed / cross-run / wrong-type read row (§1.7); `universe_hash_mismatch_across_arms`.

---

## §7 — Run model (local harness, env, USER gates, output = report file)

### 7.1 Convention — mirror `validate_tier0_ic.py`, NOT the 73차 vitest harness
`validate_tier0_ic.py` is argparse-driven, OFFLINE (AI cost 0), additive opt-in flags whose default keeps prior behavior byte-identical. The 73차 `P3_FULL_RUN_CONFIRM` gate exists only because that harness **burns real AI spend**; PR-B5 forward measurement is pure Python (set intersection + pooling). **Do NOT add a `PRB5_FORWARD_VERDICT_CONFIRM` env gate.** The real gates are (a) the in-evaluator floors (§4.6) and (b) the USER gates (§12).

### 7.2 Additive flags (default OFF → byte-identical)
- `--shadow-eval` (bool, default off) — activates the shadow post-process path; absent = frozen B+C harvest byte-identical.
- `--shadow-extract-json PATH` — owner-psql-emitted Query 2 facts (one per eligible period); `--print-shadow-sql` / `--print-shadow-sql-inline` emit Query 2 for the operator (PR-B4 `--print-sql` analog).
- `--shadow-coverage-json PATH` — PR-B4 reconcile output (eligibility gate input).
- `--shadow-arms` (default `production-mirror,sector-soft-tilt,sector-hard-gate`, matching the §4.5 binding family; if hard-gate underfills, that arm becomes diagnostic `INCOMPLETE_RUN`, not a production blocker).
- `--kill-rule-file PATH` — committed pre-registration: `power_floor_n`, primary horizon per track, regime labels per period, look schedule, `run_date`-stale bound, leader_basket, arms (anti-p-hack). **No null seed** (§4.3).
- `--survivorship-artifact PATH` — frozen probe result (exit status + counts + OLD/RECENT dates).
- `SHADOW_GENERATOR_ENABLED` (existing) does NOT gate read/eval.

### 7.3 Output = verdict report file (NO DB write on the evaluator runtime path)
Deliverable = `scripts/out/tier0_shadow_recall_verdict.json` (+ a markdown verdict doc), consistent with all prior tier0 validation runs. **The evaluator runtime path writes no production or shadow DB row.** The report carries: verdict header, per-cell gate matrix, primary metric + CI90 + n_periods + power_floor_n + regime-stratified lift, hard-gate counterfactual table (§8), survivorship/panel/data-quality stamp, frozen provenance (`parameter_lock_commit_hash` + `freeze_tag`), no-apply confirmation, artifact paths.

### 7.4 Two USER gates (separate)
(1) **USER-run owner-psql extraction** of Query 2 facts (external state, like a PR-B4 production reconcile run) — CLAUDE cannot run it. (2) **USER timeline/power sign-off** (§12 D4). The PR itself lands fully CLAUDE-verifiable via `pg_smoke_0039_prb5.sh` + pure unit tests on synthetic JSON, with **no production read in the CLAUDE path**.

### 7.5 Concrete artifact schemas (so §10.2 fixtures + the report are buildable)
**(a) kill-rule pre-registration file** (`--kill-rule-file`, committed, frozen by `freeze_tag`):
```json
{
  "freeze_tag": "prb5-2026-Qx", "parameter_lock_commit_hash": "<sha>",
  "arms": ["production-mirror","sector-soft-tilt","sector-hard-gate"],
  "tracks": {
    "short":   {"primary_horizon": "short", "power_floor_n": 12, "cadence": "weekly"},
    "midlong": {"primary_horizon": "long",  "power_floor_n": 12, "cadence": "monthly"}
  },
  "regime_by_period_key": {"2026-07": "bull", "2026-W30": "flat"},
  "regime_vocab": ["bull","bear","flat","recovery"],
  "verdict_attempts": 1, "verdict_date": "2027-06-30",
  "run_date_stale_max_days": 45,
  "leader_basket": "inherit:LEADER_BASKET_2026_06"
}
```
A period present in the extract but **missing** from `regime_by_period_key`, or a regime not in `regime_vocab`, → `INVALID_INPUT (regime_unregistered)` (fail-closed). `power_floor_n` is pre-registered from a **prior/assumed** lift-SD anchor (e.g. the 2026-06-17 recall spread 0.018–0.045), NOT computed post-hoc from the observed series (post-hoc revision = a NEW freeze_tag).

**(b) verdict report** (`scripts/out/tier0_shadow_recall_verdict.json`): top-level `run_verdict ∈ {PASS, DIRECTIONAL, INCOMPLETE_RUN, INVALID_INPUT}`; when §4.0 regime/beta advisory fires on an otherwise PASS-capable run, keep `run_verdict="PASS"` only if the numeric gates pass **and no other PASS blocker (e.g. Stage-1 `DIRECTIONAL_GATE_B_NA`) is present**, but set `user_review_required=true` and include `single_regime_or_beta_confounded` in `advisory_flags` so acceptance is USER-blocked. Per-cell:
```json
{
  "arm": "sector-soft-tilt",
  "track": "midlong",
  "horizon": "long",
  "verdict": "DIRECTIONAL",
  "reason_code": "DIRECTIONAL_GATE_B_NA",
  "n_periods": 12,
  "n_nonoverlap": 12,
  "recall_shadow": 0.0,
  "recall_mirror": 0.0,
  "period_lift_mean": 0.0,
  "ci90": [0.0, 0.0],
  "ic_ir": 0.0,
  "gate_a": {"pass": false, "reason_code": "DIRECTIONAL_GATE_B_NA"},
  "gate_b": {"verdict": "NOT_APPLICABLE", "reason_code": "DIRECTIONAL_GATE_B_NA"},
  "gate_c": {"verdict": "NOT_APPLICABLE"},
  "n_winners": 0,
  "regime_stratified_lift": {},
  "beta_orthogonalized_lift": null,
  "advisory_flags": []
}
```
**Run-level rollup precedence**: any `INVALID_INPUT` cell → whole run `INVALID_INPUT`; else `run_verdict = min over cells of {PASS > DIRECTIONAL > INCOMPLETE_RUN}` (i.e. the run is only PASS if every applicable primary-endpoint cell is PASS, consistent with §4.5 no-single-cell-PASS). `triple_gate_all_pass` (the §4.7 AND-of-gate-fields) is a required field; a mismatch → `INVALID_INPUT`.

**Closed reason-code set** (every §6 branch maps to exactly one): `INCOMPLETE_RUN` (`n_below_data_floor`, `winners_below_floor`, `arm_missing`, `forward_insufficient`, `run_date_stale`, `asof_stale`, `universe_hash_mismatch`, `snapshot_absent`, `hypothesis_mismatch`, `survivorship_failed`, `panel_survivorship_unverified`, `no_eligible_periods`, `secondary_production_absent`, `secondary_parity_fail`, `secondary_star1_pending`) · `INCOMPLETE_RUN_PLUMBING_ONLY` · `DIRECTIONAL_POWER_FLOOR` · `DIRECTIONAL_GATE_B_NA` · `NOT_APPLICABLE_PLUMBING_ONLY` · `NOT_APPLICABLE_WEEKLY_GRAIN` · `NOT_APPLICABLE_NO_COMBINED_HORIZON` · `NOT_APPLICABLE_NO_SIZE_INPUT` · `INVALID_INPUT` (`mirror_arm_absent`, `universe_hash_mismatch_across_arms`, `triple_gate_inconsistent`, `gate_c_claimed_no_metadata`, `regime_unregistered`, `malformed_row`).

---

## §8 — Hard-gate counterfactual report (Track-2-unique, parent §6.4)

For `sector-hard-gate`: `gate_cut_leaders = counterfactual_cut ∩ winners_all` — "leaders the gate truncated". Report `|gate_cut_leaders|`, the tickers, and their forward returns, quantifying **how many forward leaders a production hard-gate would have permanently truncated** (the R2-visibility value of Track 2). `universe_size` stays the full pre-cut universe for the denominator; `gate_eligible_size` is the post-cut sector-member count. This is a **diagnostic counterfactual, not a pass gate**, subject to the same claim discipline (§9) — observation, not "the gate is wrong" wording, until a valid PASS.

---

## §9 — Claim discipline (parent §6.7)

Until a valid Stage-1+ PASS (data floor + `power_floor_n` + universe-wide winner denominator + survivorship probe PASS + USER sign-off, including explicit acceptance of any `single_regime_or_beta_confounded` advisory):
- **Forbidden wording**: "상승 예측", "outperformance", "sector will lead", "sector-aware is better/더 낫다".
- production `K > 0` forbidden (T2-I-6); no shadow-claim-driven Tier1 / portfolio change.
- Report/UI wording caps at **"shadow generation-stage counterfactual observation (verification pending)"**.
- Only after a valid PASS: "shadow sector hypothesis improves recall by X% (CI Y, n_periods N, regimes …)".
- A positive pooled lift concentrated in one regime can be a **beta artifact, not retrieval skill** — a single-regime or non-beta-orthogonalized lift is flagged `single_regime_or_beta_confounded` for **mandatory USER review** before acceptance (§4.0 advisory), not an auto-accept PASS.
- `sector_view.source == absent` plumbing-only → `NOT_APPLICABLE_PLUMBING_ONLY`, never read as a substantive "no sector effect" null.

---

## §10 — PR sub-decomposition + test plan + connection smoke

### 10.1 SINGLE PR-B5 (NOT a B5a/B5b/B5c split)
Rationale: survivorship probe already ships; evaluator core + report emitter live in the same file behind one default-OFF flag; the §4.6 floors block any real verdict regardless → landing evaluator+report **dormant default-OFF** carries no behavioral risk (the PR-B3/PR-B4 pattern). The verdict **RUN** is a later USER-gated **operation**, not a code PR. Internal staging gates (single PR): **B5-1** owner-psql read + reconcile eligibility + paired `gate_a_recall` via the Option-1 sibling orchestrator (frozen harvest byte-identical) → **B5-2** PRIMARY recall-lift + hard-gate counterfactual + analytic baseline + FWER/power/regime + INCOMPLETE_RUN refusals → **B5-3** verdict report JSON + markdown with claim discipline + survivorship gate read.

### 10.2 Test plan (pure unit, no DB, no AI)
- **Reuse-not-rewrite**: golden vectors asserting `gate_a_recall` / `top_decile_winners` / `compute_forward_return` / `gate_a_pass_selective_largemid` / `_ci90` are called unchanged.
- **Paired-denominator object identity**: two arms → assert `winners_all`/`winners_by_horizon`/`universe_size`/`largemid_winners`/`leader_basket` are the **identical objects** passed to both `gate_a_recall` calls; only `selected_*` differ.
- **Byte-identical proof**: frozen B+C harvest fixture (cfg1-4) → identical JSON with `--shadow-eval` absent (default-OFF); `aggregate_harvest`/`process_month`/`harvest_pit_months` untouched.
- **Floors**: `n<6` → `INCOMPLETE_RUN`; `n<power_floor_n` → `DIRECTIONAL`, no PASS; `|winners|<10` cell refused.
- **Survivorship**: probe artifact FAIL/UNKNOWN → upper-bound label + verdict blocked; artifact dates not bracketing window → fail-closed; panel-coverage-unverified → `INCOMPLETE_RUN`.
- **Abort matrix**: one fixture per §6 branch (cross-arm `universe_hash` mismatch, cross-run snapshot, absent-source plumbing-only, midlong-combined→`NOT_APPLICABLE_NO_COMBINED_HORIZON`, Gate-B inputs absent→`DIRECTIONAL_GATE_B_NA`, weekly→SECONDARY-N/A, ★#1 SECONDARY pending, malformed row) → correct reason code, no coercion.
- **FWER + regime**: `m` over the primary-endpoint family widens CI; single-arm pass ≠ PASS; single-regime/beta-confounded lift → `advisory_flags=["single_regime_or_beta_confounded"]` + USER-review-required, not mechanical FAIL.
- **Analytic baseline** (no seeded MC): `random_baseline = len(selected)/universe_size` deterministic; assert no seed/RNG on the null path.

### 10.3 Connection smoke (`scripts/pg_smoke_0039_prb5.sh`)
Docker-free local PG16 (PR-B4 `pg_smoke_0039_prb4.sh` pattern): createdb temp → apply 0039 → finalize a synthetic complete run (mirror + soft-tilt + snapshot) via the 0039 RPC → run **Query 2** on an **owner** connection → assert FIX-J `(period_key,run_id)` join returns same-run snapshot, cross-arm `universe_hash` uniform, and a **`service_role` SELECT on the shadow tables is DENIED** → dropdb. This is test scaffolding (bootstraps fixtures via RPC); the evaluator runtime path itself writes nothing. CLAUDE verifies; production extraction is USER-only.

---

## §11 — Review checklist (pre-implementation)

- [ ] Diff touches **no production table** (`tier0_candidates_150` / `short_list_30` schema diff 0).
- [ ] `--shadow-eval` additive/default-OFF → byte-identical frozen B+C harvest (cfg1-4); `process_month` + `aggregate_harvest` + `harvest_pit_months` **unchanged** (NEW siblings only).
- [ ] **Option 1** (post-process sibling orchestrator) confirmed; **no `secondary_selected` injection into `process_month`; no shadow branch inside `aggregate_harvest`.**
- [ ] Shadow read = **owner psql only**; grep gate: no `service_role` SELECT on the 4 shadow tables; smoke proves `service_role` denied.
- [ ] **Evaluator runtime path writes no DB** (production or shadow); deliverable is a report file. (Smoke bootstraps fixtures into a throwaway temp DB — test scaffolding, not the evaluated path.)
- [ ] FIX-J: `run_id` anchored from candidate rows; snapshot/hypothesis joined on `(period_key, run_id)`; no period-only/latest-snapshot join.
- [ ] Reconcile eligibility: only `complete` periods enter the floor; `missing`/`anomaly` → `INCOMPLETE_RUN`, never `recall=0`.
- [ ] `gate_a_recall` called twice per period per non-mirror arm with **SHARED frozen** denominators; only `selected_*` vary; **`gate_a_pass_selective_largemid` reused as PASS PREDICATE only** (PRIMARY lift = arm-vs-mirror = NEW code, NOT recall−random).
- [ ] Winners from universe-wide snapshot distinct ticker set (`top_decile_winners`, FIX-I non-NaN); `universe_size` = full pre-cut (hard-gate keeps full-universe denominator); thin-print delisting guard.
- [ ] Entry = t+1 identical both arms; period evaluable per horizon only after the window matures (trading-bar index assertion) + panel harvested through target (no look-ahead).
- [ ] **Analytic N/M baseline retained (LOCKED); seeded Monte-Carlo null NOT introduced** (no RNG/seed on the null path).
- [ ] **`n_periods≥6` = data floor; `power_floor_n` = pre-registered verdict floor; n<power_floor_n → DIRECTIONAL not PASS; `|winners|≥10` per-period floor.**
- [ ] **One primary horizon per track** (verdict endpoint); others descriptive; **non-overlapping** window cadence; effective-n documented; **regime-stratified advisory** (`single_regime_or_beta_confounded` → USER review, not code-level FAIL).
- [ ] FWER: simultaneous family `m=(non-mirror arms)×(tracks)` (primary endpoint, e.g. 2×2=4) Bonferroni; **number of verdict attempts + single committed verdict date pre-registered** (formal alpha-spending deferred until a look schedule exists, §4.5); no single-arm/period PASS.
- [ ] Gate A co-gate IC IR: computable from snapshot `tier0_score` + forward returns, shadow path uses ddof=1 (not unwrapped `ic_information_ratio` ddof=0). Full Gate B: `NOT_APPLICABLE`/`DIRECTIONAL_GATE_B_NA` because baseline/sleeve/spread inputs are not persisted. Gate C `NOT_APPLICABLE` unless metadata.
- [ ] Survivorship: probe artifact exit status read; OLD/RECENT machine-bracket the forward window; FAIL/UNKNOWN → upper-bound + blocked; panel-coverage check; **hard-coded `survivorship_label="clean…"` string NOT inherited on the shadow path** (grep the string, one caller).
- [ ] ★#1 applied OR acknowledged pending → SECONDARY `INCOMPLETE_RUN`; weekly → `NOT_APPLICABLE_WEEKLY_GRAIN`.
- [ ] `triple_gate` = AND of per-cell gate fields else `INVALID_INPUT`; re-derive PASS from raw findings.
- [ ] Claim discipline (§9): no 상승예측/outperformance/sector-will-lead; UI cap.
- [ ] No `PRB5_FORWARD_VERDICT_CONFIRM` env gate; forward-only (no `--month` backfill); cache-availability guard documented dormant/re-arm-scoped-to-backtest.
- [ ] **Parent-spec sync on landing**: patch parent §10 PR-B5 row; §6.3 from "secondary_selected injection" to "post-process sibling orchestrator (injection rejected)"; §6.5 seeded/random-row wording to analytic N/M + `NOT_APPLICABLE_NO_COMBINED_HORIZON`; §6.6 to one-primary-horizon + `power_floor_n`.

---

## §12 — USER gates + first-verdict timeline (parent §12 D4)

- **(PRECONDITION) data pipeline must actually run** — PR-B5 reads data that **does not exist yet**: a verdict run requires (a) **migration 0039 applied** in production (parent §10 `USER-only 잔여`, not done), (b) **`SHADOW_GENERATOR_ENABLED=true` sustained for ≥`power_floor_n` consecutive periods** with per-period manual hypothesis pre-registration, and (c) the owner-psql extraction run per accrual. If any stalls, the evaluator emits `INCOMPLETE_RUN` indefinitely. The D4 hard date must register the **data-accrual START commitment + a named owner for the per-period registration cadence**, not just the verdict-attempt date — otherwise PR-B5 lands dormant and never produces a verdict because the pipeline it reads was never operationally sustained.
- **(D4) Forward timeline + power acceptance** — USER accepts the timeline (short weekly / midlong monthly, long-horizon 126d tail dominates the wall-clock floor) AND sets the pre-registered **`power_floor_n`** (from a power calc on the observed per-period lift SD; likely materially > 6 after FWER). Register a hard first-verdict-attempt date to prevent infinite plumbing-only stall.
- **(★#1) prerequisite** — PRIMARY arm-vs-mirror lift is forward-valid from period 1 (runnable once the floors accrue, ★#1-independent). SECONDARY vs-persisted-production-150 STAMPED `INCOMPLETE_RUN` until ★#1 (B++ adopted as production scorer) + selection-identity parity.
- **Frozen pre-registration** — before the verdict run, commit a `parameter_lock_commit_hash` + `freeze_tag` pinning `power_floor_n` / primary-horizon-per-track / regime labels / look schedule / leader_basket / arms / horizons (anti-p-hack; the 2026-06-17 multi-regime provenance pattern).
- **Survivorship precondition** — `probe_pit_survivorship.py` PASS, OLD/RECENT bracketing the actual forward window (machine-asserted).
- **Manual-first sector source** (D2) — `manual_pre_registered` arms only; LLM `sector_advisor` deferred to a separate spec.
- **The verdict RUN is USER-gated** — the evaluator lands dormant default-OFF now (reviewed/ready); the first verdict execution is a USER-gated operation (owner-psql extraction + timeline/power sign-off).

---

## §13 — Simpler alternatives considered + rejected

| Alternative | Decision | Reason |
|---|---|---|
| Inject `secondary_selected` into `process_month` (parent §6.3 Option 3) | **Reject** | Risks byte-changing the frozen cfg1-4 / B+C harvest path in a live function. Option 1 sibling orchestrator keeps provenance frozen. |
| A "shadow mode" branch **inside** `aggregate_harvest` | **Reject** | `aggregate_harvest` is hard-bound to `MonthResult` with no arm dimension; a branch would touch the frozen function. NEW `aggregate_shadow_harvest` sibling reusing leaf helpers instead. |
| Reuse `gate_a_pass_selective_largemid` as the PRIMARY lift **computation** | **Reject** | Its lift is recall − RANDOM, not arm-vs-mirror. Reused as PASS PREDICATE arithmetic only; paired lift is NEW code. |
| Seeded Monte-Carlo same-count null | **Reject** | The analytic `N/M` IS the exact mean of the same-count no-replacement null, deterministic; a seed adds a p-hack surface + breaks the frozen B+C protocol. Keep analytic (hypergeometric variance analytically if a distribution is needed). |
| `n_periods≥6` as the verdict floor | **Reject** | Underpowered for the realized 0.018–0.045 recalls; degenerate after FWER. n=6 = data floor; `power_floor_n` (pre-registered, USER) = verdict floor; n<floor → DIRECTIONAL not PASS. |
| Treat 3 horizons as 3 independent FWER family members | **Reject** | mid63⊂long126 on the same picks = overlapping, not independent. One primary horizon per track (verdict); others descriptive; shrinks `m`. |
| `service_role` shadow read | **Reject** | T2-I-6; 0039 grants SELECT only to `authenticated`. Owner psql only. |
| 3-PR split (B5a/B5b/B5c) | **Reject** | Survivorship probe already ships; evaluator+report share one file behind one flag; floors block any verdict → single PR dormant is risk-free. |
| `PRB5_FORWARD_VERDICT_CONFIRM` env gate | **Reject** | Gates real AI spend (73차); PR-B5 cost is 0. Real gate = floors + USER sign-off. |
| Bootstrap/t CI | **Reject (→ `_ci90`)** | Reuse the LOCKED empirical 5/95 percentile for consistency; no second CI method. |
| Verdict written to a DB table | **Reject** | Needs a new shadow table/RPC + risks production-effect-0. File-only JSON + markdown. |
| `delisted_fraction` as a binding survivorship gate | **Reject (report-only)** | The probe is the binding gate; binding `delisted_fraction` invites tune-to-pass. |
| Backtest/PIT-mechanical sector sanity probe | **Reject** | Forward-only (§9); current-only sector map = look-ahead. Cache-availability guard dormant (re-arm scoped to backtest only). |

---

**Authoring notes (implementer)**: line numbers in `validate_tier0_ic.py` drift — re-confirm at implementation against the function names: forward engine `compute_forward_return`/`top_decile_winners`/`recall`, `gate_a_recall`, `gate_a_pass_selective_largemid`, `ic_information_ratio`/`gate_b_pass`, `gate_c_largemid`/`gate_c_size_composition`, `_ci90`/`_pooled_recall`/`_mean`, `process_month`, `aggregate_harvest` (selective + tradable blocks), `harvest_pit_months` (the hard-coded `survivorship_label="clean…"` string is the §5 fix anchor — grep the string, confirm one caller), `LEADER_BASKET_2026_06`, `load_pit_panel`/`panel_trading_days`/`selection_index`/`compute_month_forward`, `canonical_size_tiers`. Shadow read: `shadow_reconcile.RECONCILE_GAP_SQL` + `classify_coverage_row`; 0039 table columns; period-key validators `shadow_gen_runner._is_monthly_period_key`/`_is_weekly_period_key`; survivorship probe `probe_pit_survivorship.py`. Parent §6 is authoritative — CITE, do not re-derive.
