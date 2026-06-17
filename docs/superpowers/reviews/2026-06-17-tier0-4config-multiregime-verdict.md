# Tier0 B+C — 4-config × 3-regime 다중장세 full-factor verdict (1차 + omxy step 2~3 + Claude step 4~5 + omxy step 6 반영)

> 작성 2026-06-17. **1차 = Claude dynamic-workflow(6-agent 적대검증) + in-main adjudication.** **omxy step 2~3 = Codex adversarial review + fixer 패치 반영.** **Claude step 4~5 = 2-agent 적대 재검토 workflow + fix(cross-validation·dead-branch·test).** **omxy step 6 = rule5 p-marginality fail-closed + 재검증.** SoT(FROZEN) = `docs/superpowers/tier0-4config-decision-rules.md` @ git-tag `tier0-multiregime-freeze` (commit `17dc6d9`). run 후 임계/규칙 수정 = p-hacking(금지). production Supabase 미접촉 · AI 비용 0 · `--apply` 미실행.

## VERDICT: NO-CONFIG-PASSES (robust, confirmed)

4 config × 3 regime = 12 셀 **전부 Gate A FAIL → triple_gate_all_pass=False**. 어떤 config도 한 장세도 통과 못 함(3 장세 전부는 당연). FROZEN 규칙 5: **Tier0 = leader-inclusive 깔때기, 예측 스킬 미검증 → no-apply** (`--apply`/Tier1/"상승 예측" claim 전부 금지). diagnostic generator 유지.

이는 임계 튜닝 artifact가 아닌 **정직한 gate FAIL**: max overall recall = **0.112**(cfg1_bull) vs floor 0.20 (gap 0.088 ≈ 44% 미달, marginal 아님 구조적) · max random_ratio 1.72 < 2.5 · per-horizon recall **0.018–0.045** « 0.12 · **size-neutral sleeve skill CI가 0을 배제하는 horizon-cell = 0/36** (통계적으로 유의한 선택 스킬 어디에도 없음).

## 게이트 매트릭스 (config = 팩터 집합만 다름, 파라미터/임계 동일=frozen)

| config × regime | Gate A | Gate B | Gate C | triple | recall | (vs baseline) | ic_ir |
|---|---|---|---|---|---|---|---|
| cfg1 trend+size · bear2022 | FAIL | FAIL | PASS | ✗ | 0.076 | 0.081 | −0.762 |
| cfg1 · recov2023 | FAIL | ADJUDICATE | PASS | ✗ | 0.090 | 0.095 | −0.291 |
| cfg1 · bull2425 | FAIL | PASS | PASS | ✗ | 0.112 | 0.108 | +0.386 |
| cfg2 +foreign · bear2022 | FAIL | ADJUDICATE | PASS | ✗ | 0.073 | 0.081 | −0.584 |
| cfg2 · recov2023 | FAIL | ADJUDICATE | PASS | ✗ | 0.086 | 0.095 | −0.141 |
| cfg2 · bull2425 | FAIL | PASS | PASS | ✗ | 0.107 | 0.108 | +0.485 |
| cfg3 +earnings · bear2022 | FAIL | ADJUDICATE | PASS | ✗ | 0.064 | 0.081 | −0.145 |
| cfg3 · recov2023 | FAIL | ADJUDICATE | PASS | ✗ | 0.088 | 0.094 | +0.400 |
| cfg3 · bull2425 | FAIL | ADJUDICATE | PASS | ✗ | 0.100 | 0.107 | +0.566 |
| cfg4 +both · bear2022 | FAIL | ADJUDICATE | PASS | ✗ | 0.071 | 0.081 | −0.232 |
| cfg4 · recov2023 | FAIL | ADJUDICATE | PASS | ✗ | 0.083 | 0.094 | +0.377 |
| cfg4 · bull2425 | FAIL | PASS | PASS | ✗ | 0.102 | 0.107 | +0.716 |

## 핵심 발견 (full-factor 다중장세가 더한 것)

1. **Gate A recall이 binding 실패** — 전 12셀에서 recall이 binding baseline(naive equal-rank) 근처/이하, floor 0.20에 구조적으로 도달 못 함. **추가 팩터(foreign/earnings)는 recall을 오히려 낮춤** (bull cfg1 0.112 → cfg4 0.102; bear cfg3 0.064 < cfg1 0.076). 즉 retrieval 목적에는 trend+size가 외려 낫다 → 규칙 2(i) recall 우위가 독립적으로 실패.
2. **earnings는 IC 레이어에서 가장 강한 신호** — IC IR이 모든 장세에서 earnings 추가 시 단조 개선. **recovery에서 IC mean 부호 반전(음→양)**: cfg1 −0.022 → cfg3 +0.025; bull cfg1 +0.386 → cfg4 +0.716. 44,300 backfill이 이 발견을 가능케 함(직전 step-2는 earnings ~0%).
3. **IC는 장세의존 = momentum/factor 베타, robust alpha 아님** — bull에서만 Gate B PASS(cfg1/cfg2/cfg4), bear에서는 음수. recall(retrieval)이 받쳐주지 않으면 IC 양수만으로 "예측 선별" 불가.
4. **foreign 기여는 약하고 비일관** — earnings와 결합 시 부호 흔들림. earnings보다 size와 더 겹침(직전 진단과 정합).
5. **size-neutral 선택 스킬 부재** — 36개 horizon-cell 전부 monthly CI가 0을 straddle. Gate A가 통과했더라도 규칙 iii가 독립적으로 치명.

## 데이터 품질 (4-config 비교 유효성 — VALID)

- cfg3/cfg4: `earnings_enabled=true`, `dart_cache_rows=40,762`, `earnings_missing_fraction` 0.534–0.576 (**≈43–47% 실 PIT 커버**, cfg1/cfg2는 1.0=0%). → **44,300 backfill이 실제 PIT earnings 주입 확인** (step-2의 ~0% 대비 본질 개선).
- cfg2/cfg4: `foreign_enabled=true`, `foreign_fail_fraction=0.0` (100% fetch 성공 — step-2의 다수 Length-mismatch 실패 대비 개선).
- configs 진짜 차별화(config별 distinct recall/IC/leader). `delisted_fraction` 0.0015–0.0033. `survivorship_label="clean (KRX bydd_trd=PIT, step-0 probe PASS)"`.
- bull2425 long-forward 우려 해소: `months_analyzed=24`(2024-01..2025-12), `forward_insufficient_by_month={}`, long horizon=126거래일(≈6M), run=2026-06-17 → 2025-12 long-forward 실현 완료, silent truncation 없음.

## adjudicator review/fix log (1차 + omxy step 2~3 — verdict 불변)

`scripts/adjudicate_4config.py` (신규 스크립트, frozen harness 아님). 6-agent 워크플로 적대검토가 잡은 2 HIGH 자가수정:
- **rule iii** ANY-of-3-horizon(관대) + 중복 `excess>0`(부호 불일치 silent-drop 위험) → **3-horizon ALL positive-significant CI**(보수적, multiple-comparison 방어) + CI 부호 직접 판정.
- **rule 5 (marginal→ADJUDICATE)** 미구현(문자열만) → 기여 셀에 harness `ADJUDICATE`가 있으면 PASS→ADJUDICATE 강등 구현(이번 run은 전셀 Gate A FAIL이라 영향 없음, 미래 fail-open 방지).
- 재실행 결과 verdict **불변(NO-CONFIG-PASSES)** = 수정이 tightening임을 확인(p-hacking 아님).

omxy step 2~3 적대 검토 후 직접 수정:
- **HIGH 수정:** 12개 입력 중 하나라도 누락되면 더 이상 `NO-CONFIG-PASSES`를 emit하지 않고 `INCOMPLETE_RUN` + exit 2로 중단. incomplete evidence를 과학적 no-apply 결론으로 오인하는 fail-open 제거.
- **HIGH 수정:** `triple_gate_all_pass`는 boolean만 허용. `"false"` 같은 truthy string은 `INVALID_INPUT` + exit 2로 중단.
- **테스트 보강:** `scripts/test_adjudicate_4config.py` 추가. rule iii all-positive, harness ADJUDICATE downgrade, missing-run invalidation, non-boolean triple invalidation을 unittest로 고정.
- **보고 보강:** `scripts/out/bc/verdict_4config.{json,md}` 재생성. gate matrix에 per-horizon recall(s/m/l)을 표시하고, verdict JSON에 `gate_a_summary`(min/max recall, 0/36 CI)와 `artifact_audit`(12 harvest JSON lock stamp 누락)을 기록.
- **driver 보강:** `scripts/out/bc/run_4config.sh`가 child rc≠0이면 JSON 존재만으로 OK 처리하지 않고 실패를 전파하며, empty `pids` 확장으로 인한 `set -u` 종료를 피하도록 수정.

Claude step 4~5 적대 재검토 후 직접 수정 (2-agent workflow; verdict 불변):
- **HIGH 수정 (cross-validation fail-open):** adjudicator가 `triple_gate_all_pass` 불리언을 게이트 verdict와 cross-validate 안 함 → triple=true인데 게이트 FAIL인 corrupted JSON이 false-PASS로 통과(재현됨). `load_matrix`에 `derived_triple=(ga·gb·gc 전부 PASS)` 불일치 시 `INVALID_INPUT`+exit2 추가(fail-closed). `adjudicate`의 regime_pass도 `triple` 대신 게이트 verdict 3개로 직접 판정(defense-in-depth).
- **MED 수정 (dead branch):** rule5 harness-`ADJUDICATE` 강등 분기는 일관 데이터에서 도달 불가(삼중게이트=전PASS ⟹ ADJUDICATE 셀 불가)라 **제거**. rule5 marginal(0.05<p<0.15)은 harvest JSON에 p 필드가 없어 자동판정 불가 → winner는 PASS로 emit하되 **수동 marginality 확인 필수**(`rule_5_marginal` 필드 박제).
- **테스트 수정:** impossible-data 강등 테스트(triple=true+gb=ADJUDICATE) 제거 → (a) **positive PASS 테스트**(일관 데이터 winner→verdict PASS, 기존 미검증 경로) + (b) **triple↔게이트 불일치→INVALID** 테스트 추가. 5 unittest PASS.
- **gate_b anomaly 규명:** cfg3_bull2425가 IC IR 0.566로 최고인데 ADJUDICATE인 이유 = **mid-sleeve IC mean −0.0027 ≤ 0**(frozen Gate B 하위조건 fail) → recovery clause(large sleeve +0.035 / top-tercile +0.024 양수)로 FAIL이 아닌 ADJUDICATE. **frozen harness의 정상 동작(버그 아님).**

omxy step 6 재검토 후 직접 수정:
- **HIGH 수정 (rule5 p-marginality fail-open):** step 4~5의 `winner=PASS + 수동 marginality caveat`는 machine-readable `PASS`가 downstream에 소비될 수 있어 fail-open. FROZEN rule 5(`0.05<p<0.15` → ADJUDICATE, PASS 아님)와 harvest JSON의 p 필드 부재를 함께 적용해, winner 후보가 있어도 explicit non-marginal p 증거 없이는 `ADJUDICATE`로 fail-closed하도록 수정. 이번 실제 12셀은 winner 없음이라 verdict **불변(NO-CONFIG-PASSES)**.
- **테스트 보강:** synthetic clean winner는 이제 `ADJUDICATE`(not PASS)로 고정. negative-but-significant CI(`[-0.02,-0.01]`)가 rule iii를 통과하지 못함을 고정하고, triple=false + all gates PASS 불일치도 `INVALID_INPUT`으로 추가 고정.
- **구조 보강:** adjudicator pure LOC 250 초과를 해소하기 위해 core(`scripts/adjudicate_4config_core.py`)와 thin CLI wrapper(`scripts/adjudicate_4config.py`)로 분리. frozen 파일(`scripts/validate_tier0_ic.py`, decision-rules)은 미변경.
- **provenance fail-closed:** 12 harvest JSON에 `parameter_lock_commit_hash=17dc6d9` + `freeze_tag=tier0-multiregime-freeze`를 박제하고, adjudicator가 누락/불일치 stamp를 `INVALID_INPUT`+exit2로 차단하도록 변경. stale/mixed harvest set의 silent verdict 방지.

semantic caveat: 위 수정은 전부 **verdict 불변**(12셀 전부 Gate A FAIL · size-neutral CI 0/36 → 어느 해석이든 NO-CONFIG-PASSES). cross-validation·dead-branch 제거는 미래 fail-open 방지용 forward-hardening이다. 미래에 Gate A를 통과하는 후보가 생기면 p-marginality 필드를 harvest schema에 추가(재동결)해야 PASS를 자동 인증할 수 있다.

## 알려진 한계 / 후속 (verdict 불변, 별도 정당화 단계에서만)

- **MED(미수정·문서화):** frozen harness `validate_tier0_ic.py` L1243-1252 `selection_performance_note`가 모든 12 JSON에 "earnings ~0%, ONE regime 2024-06~2025-12"를 박제 — stale provenance(메트릭엔 무영향). frozen harness는 run 후 미수정 원칙 → 후속 동적화. 실 per-cell provenance는 `data_quality`에 정확.
- **해결(step 6):** `parameter_lock_commit_hash`와 `freeze_tag`를 12 harvest JSON에도 박제했고, adjudicator가 stamp 누락/불일치를 `INVALID_INPUT`으로 fail-closed한다. 외부 체인(tag→17dc6d9→decision-rules.md)도 검증됨.
- earnings 커버 ~47%가 주 caveat — 100% 커버 시 IC 더 강할 여지(단 recall floor엔 영향 미미 예상).
- **Gate A recall floor 0.20의 적정성**은 별도 질문 — 30/30/30 선택이 ~2,200 universe의 top-decile을 잡는 구조적 상한. **단, frozen 임계라 run 후 변경 금지**; 재설계는 별도 정당화+재freeze 필요(post-hoc 금지).

## no-apply 확인

신규 산출물 = `scripts/adjudicate_4config.py` + `scripts/adjudicate_4config_core.py` + `scripts/test_adjudicate_4config.py` + 12 harvest JSON(`scripts/out/bc/`) + 본 verdict. `--apply` 미실행(harness hard-block). production `tier0_candidates_150`/`short_list_30` 2026-06 = 미변경(73차 스코어링). AI 비용 0.

## 산출물 경로

- 12 harvest JSON: `scripts/out/bc/cfg{1-4}_{bear2022,recov2023,bull2425}.json`
- adjudicator + 테스트 + 출력: `scripts/adjudicate_4config.py` · `scripts/adjudicate_4config_core.py` · `scripts/test_adjudicate_4config.py` · `scripts/out/bc/verdict_4config.{json,md}`
- driver: `scripts/out/bc/run_4config.sh`
- DART PIT backfill: `scripts/out/dart_backfill.jsonl` (44,300 = 1,772 corps × 25 periods; ok 37,761 / no_data 6,530 / schema_empty 9)
