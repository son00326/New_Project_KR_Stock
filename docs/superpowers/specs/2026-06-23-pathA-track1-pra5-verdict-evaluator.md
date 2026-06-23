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
- **paired 분모**: timeframe별 winners/return은 두 arm 동일 frozen object(arm vs snapshot 같은 panel·같은 horizon).
- **fail-closed read (feedback_failclosed_symmetric_completion)**: hand-fed extract JSON의 모든 field type-check 선행; period_key⟺track prefix; arm enum; malformed → ShadowArmEvalInputError abort, never coerce.

## §2 — Forward returns (KRX PIT panel, entry t+1) — PR-B5 엔진 재사용
- `load_pit_panel` + `panel_trading_days` + `selection_index` + `compute_forward_return`(status ok/gap/delisted/insufficient/absent; halt≠delisting) + `top_decile_winners`(FIX-I non-NaN, no-replacement). AI cost 0, 추가 fetch 0.
- **period evaluable only after horizon matures (§2.5 PR-B5 동일)**: `entry_idx + HORIZON_DAYS[tf] + ENTRY_GAP_DAYS` 거래일이 panel에 존재 + panel이 target까지 harvest됐을 때만. 미성숙 cell → insufficient(제외), never 부분 점수.
- **survivorship**: `probe_pit_survivorship.py` PASS + OLD/RECENT bracket 검증(PR-B5 `--emit-artifact` 재사용). FAIL/UNKNOWN → upper-bound label + verdict BLOCK.

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
- **PASS-candidate(per cell)**: `CI90(ret_lift series) lower > 0` AND `n ≥ power_floor_n` AND survivorship PASS AND FWER-corrected. hit_lift는 corroborating co-metric(보고; ret_lift가 binding). FWER family = (non-snapshot arms)×(tracks)×(timeframes) Bonferroni(또는 §9 USER 선택); single-arm/period pass ≠ PASS.
- **regime/beta confound (advisory)**: 단일 regime 집중 lift는 sector-beta일 수 있음(parent §3.5/B+C). PASS-candidate라도 single-regime이면 `user_review_required` flag(mechanical block 아님).
- **triple_gate integrity**: top-level boolean = per-cell verdict AND. 불일치 → INVALID_INPUT(feedback_workflow_verify_false_convergence; raw findings에서 재유도).

## §5 — INCOMPLETE_RUN / abort matrix
- reconcile partial/missing/anomaly period → INCOMPLETE_RUN(제외). zero eligible → run_verdict=INCOMPLETE_RUN(no_eligible_periods).
- arm == production-snapshot(K=0/absent plumbing) → NOT_APPLICABLE_PLUMBING_ONLY(lift 구조적 0; "no effect" 아님).
- hard-gate arm logged_arm_count<4(incomplete_run) → 그 arm-cell INCOMPLETE_RUN(다른 arm 평가).
- n_periods<6 → INCOMPLETE_RUN; n<power_floor_n → DIRECTIONAL.
- forward 미성숙/insufficient → 그 cell 제외. survivorship FAIL → BLOCK. 미성숙 winner basket |winners|<10 → cell 제외.
- malformed/cross-period/wrong-type read → INVALID_INPUT.

## §6 — Run model
- `validate_tier0_ic.py` convention: argparse, OFFLINE(AI cost 0), additive `--shadow-arm-eval`(default OFF → frozen harvest byte-identical). `--shadow-arm-extract-json`(owner-psql facts) + `--print-shadow-arm-sql`(operator용) + `--shadow-arm-coverage-json`(PR-A4 reconcile output, eligibility) + `--kill-rule-file`(power_floor_n/primary-tf/regime labels/look schedule, anti-p-hack) + `--survivorship-artifact`. **PRB5_*-류 cost-confirm env 게이트 없음**(cost 0). 산출 = `scripts/out/shadow_arm_verdict.json` + markdown.
- 두 USER 게이트: (1) owner-psql Query extraction(외부 상태) (2) timeline/power sign-off(§9). PR 자체는 CLAUDE-verifiable(synthetic JSON unit test + pg smoke), production read 없음.

## §7 — Claim discipline (parent §6.6)
유효 PASS 전: "상승 예측"/"outperformance"/"sector-aware 더 낫다" 금지. UI/report 어휘 cap = "in-pool 30-reranking forward observation (verification pending)". 유효 PASS 후에만: "sector-tilt가 {tf} 수익률을 X%p, 적중률을 Y%p 개선(CI Z, n N, regimes …)". single-regime/beta-confound는 USER review 필수.

## §8 — PR decomposition + 테스트
- **SINGLE PR-A5**(B5처럼 split 안 함): sibling evaluator + report emitter가 한 파일, default-OFF flag 뒤 dormant. verdict RUN은 USER-gated 운영(코드 PR 아님).
- 테스트(pure unit, no DB/AI): paired-object identity(arm/snapshot 같은 winners/panel) · mean_return/hit_rate 골든 벡터 · floor(n<6→INCOMPLETE; n<power_floor_n→DIRECTIONAL) · plumbing(arm==snapshot→NOT_APPLICABLE_PLUMBING_ONLY) · reconcile-gate(partial/missing 제외) · survivorship FAIL→BLOCK · fail-closed matrix · FWER family · NaN/Inf→null JSON. connection smoke `pg_smoke_0038_pra5.sh`(docker-free: 0038 seed→owner extract→evaluator on synthetic).

## §9 — USER gates + first-verdict timeline
- **(PRECONDITION) 데이터 파이프라인 실가동**: 0038 apply + FORWARD_SHADOW_ENABLED=true 지속 + per-period manual sector/regime hypothesis 사전등록 + owner-psql extraction. 없으면 evaluator 영구 INCOMPLETE_RUN(정직, 버그 아님).
- **(D-LOCK) timeline/power**: USER가 timeline(short weekly·midlong monthly, long 126d tail이 wall-clock floor) 수용 + `power_floor_n` 사전등록. 첫 verdict 시도 hard date 등록(무한 plumbing 정체 방지).
- **frozen pre-registration**: `parameter_lock_commit_hash`+`freeze_tag`로 power_floor_n/primary-tf/regime labels/look schedule 고정(anti-p-hack).
- **manual hypothesis**: Track 1 stage-0 = sector/regime `absent`|`manual_pre_registered`만; LLM sector_advisor는 별도 spec(D2).

## §10 — Simpler alternatives 기각
| 대안 | 결정 | 이유 |
|---|---|---|
| `gate_a_recall`/recall-lift 재사용 | Reject | Track 1 메트릭 = return+hit-rate(in-pool), NOT 150-recall. PR-B5 recall 엔진 차용 시 의미 오도. |
| winners = worker-pool top-decile | Reject(→ market top-decile) | pool은 shadow_arm_log에 미저장(not_selected 안 적음). market panel은 self-contained + "실제 상승 잘 맞췄나" 직답. |
| 과거 backfill로 백테스트 | Reject | forward-only(parent §6.5/§9): shadow는 켠 이후만 존재. |
| frozen harvest 함수에 shadow branch | Reject | sibling module(PR-B5 §3.3 패턴). frozen byte-identical. |
| cost-confirm env 게이트 | Reject | cost 0(이미 지불한 panel/judge 재사용 + 순수 return 계산). 게이트 = floor + USER sign-off. |
