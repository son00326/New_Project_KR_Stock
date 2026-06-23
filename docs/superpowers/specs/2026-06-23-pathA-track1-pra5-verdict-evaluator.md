# PR-A5 spec — Track 1 in-pool 30-reranking forward VERDICT evaluator

**Status**: DESIGN SPEC (구현 전). Track 1 §6 (stage-1 harvest/kill)을 실행 가능하게 구체화한다. parent spec = `2026-06-19-pathA-forward-shadow-sector-layer.md` §6/§6.1~§6.6/§10(PR-A5). 측정 메트릭 = **USER-locked (2026-06-23)**.
**Target code (계획)**: NEW sibling module `scripts/shadow_arm_eval.py` (evaluator) + `scripts/test_shadow_arm_eval.py` + `scripts/pg_smoke_0038_pra5.sh` (connection smoke) + `validate_tier0_ic.py`에 `--shadow-arm-eval` dispatch flag만 추가(+default-OFF early-return; frozen funcs byte-identical). PR-B5 `shadow_eval.py`의 sibling-module 패턴 그대로.
**Precondition**: PR-A1(computeArmSelections) + PR-A2(worker seam + logger) + PR-A3(0038) + PR-A4(reconcile REPORT) CONVERGED. PR-B5 forward engine 재사용.

> **Drafting provenance**: Claude 1차 작성 → omxy(fresh pane) 적대 + Claude ce-* 적대 패널 → CONVERGED 후 박제. 본 spec은 parent §6를 operationalize할 뿐 §6 정책을 재결정하지 않는다.

---

## §0 — Scope / USER-locked metric / what this is NOT

### 0.1 USER-locked metric (2026-06-23)
판정 단위 = **(arm, track, timeframe, period)**. timeframe ∈ {short, mid, long}; 각 arm은 timeframe당 **10 picks**(short track=short 10; midlong track=mid 10 + long 10). USER 확정:
- **동일기간 비교(paired)**: shadow arm의 10 picks vs **production-snapshot**의 10 picks를 **같은 forward 창**에서 비교(사과 대 사과). 분모/winner는 두 arm에 동일 frozen object.
- **PRIMARY = per-timeframe mean forward return lift** = `mean_return(arm 10 picks @ horizon) − mean_return(production-snapshot 10 picks @ horizon)`. "단/중/장별 수익률이 좋아야" = 각 timeframe에서 arm이 snapshot보다 높은 mean return.
- **SECONDARY = per-timeframe hit-rate** = `|10 picks ∩ market-winners| / 10`(precision). "각 10개를 잘 맞추고" = 10 픽 중 실제 상승 상위가 많아야. market-winners = 해당 horizon panel universe의 top-decile(`top_decile_winners`, q=0.90 & >0). hit-rate lift = arm − snapshot.
- horizon = frozen `HORIZON_DAYS = {short:21, mid:63, long:126}` 거래일(PR-B5 동일, 재동결). entry = t+1(`ENTRY_OFFSET_DAYS=1`, same-bar 편향 차단).

### 0.2 What this is NOT (parent §1/§6 불변 — 재결정 금지)
- **production effect 0**: production-table write 0. shadow_arm_log read만(owner/service-role psql; 0038 grant). evaluator runtime은 어떤 DB write도 없음 — 산출물은 verdict report 파일.
- **forward-only (백테스트 불가)**: shadow_arm_log는 FORWARD_SHADOW_ENABLED 켠 이후 period만 존재. 과거 PIT 재구성 금지. n_periods floor 미달 시 verdict 금지(INCOMPLETE_RUN, never 0).
- **150-recall 아님**: Track 1은 worker-pool in-pool 30-reranking만 측정(parent §0/§I-9). PRIMARY/SECONDARY 메트릭 명칭에 "recall"(생성단계 시장-리더 포착) 어휘 금지 — hit-rate/return lift만.
- **production K=0**: shadow_eval_k만 nonzero. arm이 production-snapshot과 같으면(K=0/absent plumbing) lift는 구조적 0 → NOT_APPLICABLE_PLUMBING_ONLY(성능 증거 아님).
- **claim discipline (parent §6.6)**: 유효 PASS(데이터 floor + stat floor + USER sign-off) 전까지 "상승 예측"/"outperformance"/"sector-aware가 더 낫다" 금지. report 어휘 = "in-pool 30-reranking forward observation (verification pending)"까지.
- **USER-gated verdict RUN**: evaluator는 dormant(default-OFF)로 landing; 첫 verdict 실행은 USER 게이트(owner-psql extraction + timeline/power sign-off + frozen pre-registration).

---

## §1 — Read model (owner/service-role psql, reconcile-gated)
- **eligibility**: PR-A4 `shadow_arm_reconcile.classify_coverage_row`로 `complete`(4 arm present + production-snapshot logged) period만 평가. `partial`/`missing`/`anomaly` → 제외(INCOMPLETE_RUN, never 0). hard-gate `incomplete_run` arm(logged_arm_count<4)은 그 **arm-cell만** INCOMPLETE(다른 arm은 평가 — §2.2/§6.5 consumable).
- **picks 추출**: shadow_arm_log.selected(SelectedRow[]) → per (period, track, arm): `assigned_timeframe`별 ticker set(short10 / mid10 / long10). production-snapshot arm = baseline.
- **hard-gate counterfactual 추출(PRA5-04, parent §6.4/§I-6)**: candidate-pool-hard-gate arm의 `counterfactual_cut`(섹터 게이트가 잘라낸 ticker)도 읽어, 그 cut ticker들의 forward return을 **diagnostic 보고**(`gate_cut_return` — "게이트가 truncate한 종목들이 그 후 올랐나"; R2-가시성 값, parent §6.4). pass gate 아님(diagnostic-only, §7 claim discipline 적용). shrink-only(§I-6)라 recall 못 올림.
- **paired 분모**: timeframe별 winners/return은 두 arm 동일 frozen object(arm vs snapshot 같은 panel·같은 horizon).
- **worker-pool/random-baseline 상태**: 0038 table에는 `not_selected` column이 있으나 PR-A2 logger as-built는 `not_selected`/worker-pool `universe_hash`를 payload로 쓰지 않는다. USER-locked PR-A5 metric은 arm-vs-production return lift + market-winner hit-rate이므로 same-count random/null은 **NOT_APPLICABLE_USER_LOCKED_METRIC**이며 PASS gate가 아니다. 향후 worker-pool random/opportunity-ceiling을 주장하려면 별도 logger materialization PR + 새 freeze_tag가 필요하다.
- **fail-closed read (feedback_failclosed_symmetric_completion)**: hand-fed extract JSON의 모든 field type-check 선행; period_key⟺track prefix; arm enum; malformed → ShadowArmEvalInputError abort, never coerce.

## §2 — Forward returns (KRX PIT panel, entry t+1) — PR-B5 엔진 재사용
- `load_pit_panel` + `panel_trading_days` + `selection_index` + `compute_forward_return`(status ok/gap/delisted/insufficient/absent; halt≠delisting) + `top_decile_winners`(FIX-I non-NaN, no-replacement). AI cost 0, 추가 fetch 0.
- **§6.3 executable outcome contract**: price/outcome source = the same KRX PIT EOD panel consumed by `load_pit_panel`; market-winner universe = the pre-registered tradable KRX panel ticker universe for that period/horizon after PR-B5 non-NaN/no-replacement filters; return formula = raw close-to-close forward return `(exit_close / entry_close) - 1` with entry close at t+1 and exit close at `t+1+horizon`; benchmark/excess-return = **none** (paired lift vs production-snapshot is the benchmark); transaction cost/slippage = **0 bps for both arms** because PR-A5 measures selection forecast quality, not executable portfolio PnL. Any net-return/slippage verdict requires a new freeze_tag.
- **mean_return denominator/status rule**: per arm/timeframe mean is over the fixed 10 selected tickers. Accepted statuses = `ok`, `gap`(engine last-available rule), `delisted` with resolvable entry price (`DELISTING_RETURN_NO_PRICE=-1.0`). Any selected ticker with `absent` or `insufficient` makes that arm/timeframe/period cell INCOMPLETE_RUN; never shrink the denominator below 10.
- **period evaluable only after horizon matures (§2.5 PR-B5 동일)**: `entry_idx + HORIZON_DAYS[tf] + ENTRY_GAP_DAYS` 거래일이 panel에 존재 + panel이 target까지 harvest됐을 때만. 미성숙 cell → insufficient(제외), never 부분 점수.
- **survivorship (2-part, PR-B5 §5.2 parity — return 메트릭엔 더 critical: silently-absent delisted leader가 mean을 inflate)**: (1) **probe** `probe_pit_survivorship.py` PASS + OLD/RECENT가 평가 forward 창을 machine-bracket(`--emit-artifact` 재사용; stale artifact 무통과). FAIL/UNKNOWN → upper-bound label + verdict BLOCK. (2) **panel-level coverage(§5.2.3)**: forward 창 중 delist된 ticker가 `status=delisted`(+resolvable entry price)로 남고 silently `absent`가 아님을 assert; absent_fraction가 기대 delisted_fraction과 불일치(RATE gate, PR-B5 §14.3 PANEL_ABSENT_MAX=0.10) → `panel_survivorship_unverified` INCOMPLETE_RUN. **hard-coded `survivorship_label="clean…"` 문자열 anchor(PR-B5 §5.2)**: shadow 경로는 그 하드코딩 라벨을 절대 상속하지 않고 probe-derived label로 override(grep으로 단일 caller 확인, 라인 drift 시 문자열 기준).

## §3 — Reuse map
| 재사용(validate_tier0_ic.py / PR-B5) | PR-A5 역할 |
|---|---|
| `compute_forward_return`/`top_decile_winners`/`panel`/`selection_index` | per-pick forward return + market-winner set |
| `_ci90`(empirical 5/95)/`_mean` | per-period lift series CI + pooling |
| `probe_pit_survivorship.py`(+`--emit-artifact`) | survivorship gate |
**NEW(PR-A5)**: `mean_return(picks @ horizon)` + `hit_rate(picks∩winners/10)` per (arm,tf,period); paired arm-vs-snapshot lift series; `aggregate_shadow_arm_verdict`(sibling, NOT a branch in any frozen harvest fn). PR-B5 `gate_a_recall`/recall-lift는 **재사용 안 함**(다른 메트릭: return+hit-rate ≠ recall).

## §4 — Metric / gates / stats
- **per-period lift** (per arm≠snapshot, per track, per timeframe): `ret_lift_p = arm.mean_return[tf] − snapshot.mean_return[tf]`; `hit_lift_p = arm.hit_rate[tf] − snapshot.hit_rate[tf]`. paired(같은 period/panel/winners).
- **data floor**: per (arm,track,timeframe) `n_periods ≥ 6`(parent §6.1; short weekly·midlong monthly, non-overlapping decimation PR-B5 동일). 미달 → INCOMPLETE_RUN.
- **verdict floor**: pre-registered `power_floor_n`(USER, §9 sign-off; n=6은 underpowered). 미달 → DIRECTIONAL, never PASS.
- **PASS-candidate(per cell)**: report the USER-locked descriptive `CI90(ret_lift series)` (empirical 5/95, PR-B5 `_ci90`), but the binding PASS lower bound is the **Bonferroni-adjusted one-sided lower quantile** over the same per-period series: `alpha_cell = 0.10 / m`, where `m` is the pre-registered count of active non-snapshot arm × active timeframe endpoints (default all three non-snapshot arms × {short,mid,long}=9; plumbing-only endpoints are pre-declared N/A, not removed post-hoc). PASS iff adjusted lower > 0 AND `n ≥ power_floor_n` AND survivorship PASS. hit_lift는 corroborating co-metric(보고; ret_lift가 binding). Single-arm/period pass ≠ PASS; if implementation emits only unadjusted CI90, verdict cannot be PASS.
- **Gate B (rank skill, parent §6.4) — Stage-1 = DIRECTIONAL_GATE_B_NA (A5-ADV-1/PRA5-01)**: IC **co-gate**(`spearman(arm selected-row weighted_score, forward_return[tf])` per period, `ic_information_ratio` ddof=1 PR-B5 §4.4)는 logged selected rows로 diagnostic 계산 가능하나, **full Gate B**(`gate_b_pass(require_baseline=True)`)는 baseline IC / sleeve / spread가 shadow_arm_log에 미저장(parent §2.1 worker-pool 객체에 sleeve/mcap 없음)이라 **NOT_APPLICABLE** — fabricate 금지. ⇒ full triple-gate PASS는 **Stage-1에서 구조적 unreachable**, 셀 verdict는 모든 비-B floor 통과 후 **DIRECTIONAL_GATE_B_NA**가 상한(PR-B5 §4.4 동일). co-gate IC IR<0.30은 `advisory_flags=["low_selected_row_ic_ir"]`로 보고하되 별도 top-level `ADJUDICATE` enum을 만들지 않는다(폐쇄 enum 유지).
- **Gate C (size/coverage, parent §6.4)** = `NOT_APPLICABLE`(≠PASS) — sleeve/coverage metadata 미저장. metadata 없이 sleeve discipline 주장 시 INVALID_INPUT.
- **regime/beta confound — REQUIRED co-metric + hard blocker (A5-ADV-3, PR-B5 §4.0(b) parity)**: PRIMARY가 **수익률**이라 단일 regime 주도-섹터 tilt의 양(+) lift는 **정의상 sector-beta**(skill과 구분 불가; 2026-06-17 verdict: IC regime-dependent beta, bull +0.72). 따라서 **beta-orthogonalized per-period return lift**를 필수 산출한다: per (arm,track,timeframe), eligible periods over the frozen look schedule에서 `x_p = leading_sectors_benchmark_return_p`(kill-rule에 사전등록한 sector-cap-weighted benchmark), `y_arm_p = mean_return_arm_p`, `y_snap_p = mean_return_snapshot_p`; OLS `y = a + beta*x + eps`를 arm/snapshot 각각 fit한 뒤 `ortho_lift_p = eps_arm_p - eps_snap_p`, `beta_orthogonalized_ret_lift = mean(ortho_lift_p)`. `x` variance 0 / fit n<3 / benchmark absent → `DIRECTIONAL_BETA_UNVERIFIED`(PASS hard-block). **(a) 모든 PASS-eligible period가 단일 regime이거나 (b) orthogonalized lift가 양(+)이 아니면 → PASS 불가**(`DIRECTIONAL_BETA_BLOCKED`; advisory 아님). regime label은 kill-rule 사전등록(asOf<period; hindsight 금지).
- **triple_gate integrity**: top-level boolean = per-cell (Gate A ∧ Gate B ∧ Gate C) AND. Stage-1은 Gate B=NA라 full PASS 불가 → 상한 DIRECTIONAL. boolean이 per-cell 필드와 불일치 → INVALID_INPUT(feedback_workflow_verify_false_convergence; raw findings에서 재유도, aggregate `converged:true` 신뢰 금지).

## §5 — INCOMPLETE_RUN / abort matrix
- reconcile partial/missing/anomaly period → INCOMPLETE_RUN(제외). zero eligible → run_verdict=INCOMPLETE_RUN(no_eligible_periods).
- arm == production-snapshot(K=0/absent plumbing) → NOT_APPLICABLE_PLUMBING_ONLY(lift 구조적 0; "no effect" 아님).
- hard-gate arm logged_arm_count<4(incomplete_run) → 그 arm-cell INCOMPLETE_RUN(다른 arm 평가).
- n_periods<6 → INCOMPLETE_RUN; n<power_floor_n → DIRECTIONAL.
- forward 미성숙/insufficient → 그 cell 제외. survivorship FAIL → BLOCK. 미성숙 winner basket |winners|<10 → cell 제외.
- malformed/cross-period/wrong-type read → INVALID_INPUT.
- zero eligible non-plumbing endpoints(all arm==snapshot because K=0/absent) → run_verdict=INCOMPLETE_RUN, reason_code=INCOMPLETE_RUN_PLUMBING_ONLY; never PASS/FAIL and never "no effect".

## §6 — Run model
- `validate_tier0_ic.py` convention: argparse, OFFLINE(AI cost 0), additive `--shadow-arm-eval`(default OFF → frozen harvest byte-identical). `--shadow-arm-extract-json`(owner-psql facts) + `--print-shadow-arm-sql`(operator용) + `--shadow-arm-coverage-json`(PR-A4 reconcile output, eligibility) + `--kill-rule-file`(power_floor_n/primary-tf/regime labels/look schedule, anti-p-hack) + `--survivorship-artifact`. **PRB5_*-류 cost-confirm env 게이트 없음**(cost 0). 산출 = `scripts/out/shadow_arm_verdict.json` + markdown.
- 두 USER 게이트: (1) owner-psql Query extraction(외부 상태) (2) timeline/power sign-off(§9). PR 자체는 CLAUDE-verifiable(synthetic JSON unit test + pg smoke), production read 없음.

### §6.5 — concrete schemas (PRA5-07; PR-B5 §7.5 parity)
- **kill-rule file**(`--kill-rule-file`, committed, `freeze_tag`+`parameter_lock_commit_hash`로 동결): `{freeze_tag, parameter_lock_commit_hash, arms[], tracks:{short:{cadence:weekly,power_floor_n},midlong:{cadence:monthly,power_floor_n}}, timeframes:[short,mid,long], fwer_family_m, regime_by_period_key:{}, regime_vocab:[], verdict_attempts, verdict_date, run_date_stale_max_days, return_contract:"raw close t+1→t+1+h, 0bps", leading_sectors_benchmark}`. extract에 있으나 regime_by_period_key에 없는 period / regime_vocab 밖 → `INVALID_INPUT(regime_unregistered)`. power_floor_n은 prior lift-SD anchor(post-hoc 금지; 수정=새 freeze_tag).
- **verdict report**(`scripts/out/shadow_arm_verdict.json` + markdown): top-level `run_verdict ∈ {PASS, DIRECTIONAL, INCOMPLETE_RUN, INVALID_INPUT}`(Stage-1 = PASS 구조적 unreachable → 상한 DIRECTIONAL). per-cell `{arm, track, timeframe, verdict, reason_code, n_periods, n_nonoverlap, ret_lift_mean, ci90:[lo,hi], adj_lower, hit_lift_mean, ic_ir, gate_a, gate_b:{verdict:NOT_APPLICABLE,reason:DIRECTIONAL_GATE_B_NA}, gate_c:{verdict:NOT_APPLICABLE}, beta_orthogonalized_ret_lift, regime_stratified_lift, gate_cut_return, advisory_flags[]}`. NaN/Inf → null(RFC-8259, jq/JS/Postgres consumer-safe). `triple_gate_all_pass` 필수 필드(AND-of-gate-fields 불일치 → INVALID_INPUT). run-level rollup: 임의 INVALID_INPUT cell → run INVALID_INPUT; else `min over cells {PASS>DIRECTIONAL>INCOMPLETE_RUN}`.
- **closed reason-code set**(모든 §5 branch가 정확히 하나로 매핑): `INCOMPLETE_RUN`(`n_below_data_floor`/`power_floor_n_below`/`winners_below_floor`/`forward_insufficient`/`asof_stale`/`run_date_stale`/`survivorship_failed`/`panel_survivorship_unverified`/`no_eligible_periods`/`reconcile_partial`/`reconcile_missing`/`reconcile_anomaly`) · `INCOMPLETE_RUN_PLUMBING_ONLY` · `DIRECTIONAL_POWER_FLOOR` · `DIRECTIONAL_GATE_B_NA` · `DIRECTIONAL_BETA_UNVERIFIED` · `DIRECTIONAL_BETA_BLOCKED` · `NOT_APPLICABLE_PLUMBING_ONLY` · `INVALID_INPUT`(`malformed_row`/`cross_period`/`regime_unregistered`/`triple_gate_inconsistent`/`gate_c_claimed_no_metadata`).

## §7 — Claim discipline (parent §6.6)
유효 PASS 전: "상승 예측"/"outperformance"/"sector-aware 더 낫다" 금지. UI/report 어휘 cap = "in-pool 30-reranking forward observation (verification pending)". 유효 PASS 후에만: "sector-tilt가 {tf} 수익률을 X%p, 적중률을 Y%p 개선(CI Z, n N, regimes …)". **Stage-1은 Gate B=NA로 PASS 구조적 unreachable → 현 어휘 상한은 DIRECTIONAL observation까지.** single-regime/beta-orthogonalized-non-positive는 **PASS hard blocker**(§4, advisory 아님). hard-gate `gate_cut_return`은 diagnostic observation까지("게이트가 X 종목을 truncate, 그 후 평균 Y%" — "게이트가 틀렸다" 어휘 금지).

## §8 — PR decomposition + 테스트
- **SINGLE PR-A5**(B5처럼 split 안 함): sibling evaluator + report emitter가 한 파일, default-OFF flag 뒤 dormant. verdict RUN은 USER-gated 운영(코드 PR 아님).
- 테스트(pure unit, no DB/AI): paired-object identity(arm/snapshot 같은 winners/panel) · mean_return/hit_rate 골든 벡터(+delisted -1.0 포함·absent/insufficient→cell INCOMPLETE) · floor(n<6→INCOMPLETE; n<power_floor_n→DIRECTIONAL) · **Gate B = DIRECTIONAL_GATE_B_NA(PASS Stage-1 구조적 unreachable)** · **beta-orthogonalized lift: single-regime/non-positive-ortho → PASS 불가** · plumbing(arm==snapshot→NOT_APPLICABLE_PLUMBING_ONLY) · reconcile-gate(partial/missing/anomaly 제외) · survivorship probe FAIL→BLOCK + panel-coverage(absent_fraction>PANEL_ABSENT_MAX→panel_survivorship_unverified) · hard-gate `gate_cut_return` diagnostic(pass gate 아님) · Bonferroni adj_lower>0 PASS predicate + unadjusted-CI90-only→PASS 불가 · triple_gate AND-mismatch→INVALID_INPUT · fail-closed matrix · NaN/Inf→null JSON · closed reason-code 매핑. connection smoke `pg_smoke_0038_pra5.sh`(docker-free: 0038 seed→owner extract→evaluator on synthetic).

## §9 — USER gates + first-verdict timeline
- **(PRECONDITION) 데이터 파이프라인 실가동**: 0038 apply + FORWARD_SHADOW_ENABLED=true 지속 + per-period manual sector/regime hypothesis 사전등록 + owner-psql extraction. 없으면 evaluator 영구 INCOMPLETE_RUN(정직, 버그 아님).
- **(D-LOCK) timeline/power**: USER가 timeline(short weekly·midlong monthly, long 126d tail이 wall-clock floor) 수용 + `power_floor_n` 사전등록. 첫 verdict 시도 hard date 등록(무한 plumbing 정체 방지).
- **frozen pre-registration**: `parameter_lock_commit_hash`+`freeze_tag`로 power_floor_n/active endpoints/FWER Bonferroni family size/regime labels/look schedule/return contract(§2) 고정(anti-p-hack).
- **manual hypothesis**: Track 1 stage-0 = sector/regime `absent`|`manual_pre_registered`만; LLM sector_advisor는 별도 spec(D2).

## §10 — Simpler alternatives 기각
| 대안 | 결정 | 이유 |
|---|---|---|
| `gate_a_recall`/recall-lift 재사용 | Reject | Track 1 메트릭 = return+hit-rate(in-pool), NOT 150-recall. PR-B5 recall 엔진 차용 시 의미 오도. |
| winners = worker-pool top-decile | Reject(→ market top-decile) | PR-A2 logger as-built가 worker-pool `not_selected`/`universe_hash`를 materialize하지 않아 same-count pool null은 구현 불가. market panel은 self-contained + "실제 상승 잘 맞췄나" 직답. 단 report label은 **market-winner hit-rate/precision**이어야 하며 "worker-pool recall"이라고 부르면 안 됨. |
| 과거 backfill로 백테스트 | Reject | forward-only(parent §6.5/§9): shadow는 켠 이후만 존재. |
| frozen harvest 함수에 shadow branch | Reject | sibling module(PR-B5 §3.3 패턴). frozen byte-identical. |
| cost-confirm env 게이트 | Reject | cost 0(이미 지불한 panel/judge 재사용 + 순수 return 계산). 게이트 = floor + USER sign-off. |
