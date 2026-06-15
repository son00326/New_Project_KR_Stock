# Tier0 B++ 다중장세 4-config — 사전확정 결정규칙 (FROZEN, anti-overfitting lock)

> 작성 2026-06-15 (B+C). **이 파일 + `test_validate_tier0_ic.py::TestFrozenDecisionRules` 가 임계·규칙을
> 동결한다. run 전에 commit + git-tag(`tier0-multiregime-freeze`). run 후 임계/규칙 수정 = p-hacking →
> 금지.** spec §8(overfitting/target-leakage) 정합. 4 configs × 3 regimes × 3 gates = 다중비교 표면이
> 크므로, 후행 임계 쇼핑을 코드 어서션으로 차단한다.

## 동결 임계 (gate thresholds — validate_tier0_ic 상수와 1:1, 변경 시 테스트 FAIL)
- Gate A: overall recall ≥ **0.20** · random ratio ≥ **2.5** · per-horizon recall ≥ **0.12** · largemid recall ≥ **0.35** · largemid/overall ≥ **0.80** · baseline 대비 우위 필수.
- Gate B: IC IR ≥ **0.30** · positive IC months ≥ **0.60** · cost-adj decile spread > 0 · Large/Mid sleeve IC > 0 · baseline IR 대비 우위.
- Gate C: sleeve dist 60/60/30 · Small ≤ **25%**.

## 동결 파라미터 (4 config 공통 — config별 튜닝 금지)
- size sleeve 쿼터 20/20/10, 유동성 플로어 MIN_ADV=20억, trend lookback (20/60·63/126·126/252), 12-1 skip 21, winsorize[1,99]. 모든 config(추세+크기 / +외국인 / +실적 / +전부)에 동일 적용. config 차이는 **팩터 집합 뿐**.

## 사전확정 config 선정 규칙 (FROZEN)
1. **binding baseline = config-1 (추세+크기)** + naive baseline(current momentum-proxy / equal-rank).
2. 한 config가 **PASS**: (i) config-1 대비 recall AND IC IR 우위 (ii) 삼중 게이트 전부 통과 (iii) size-neutral skill 월별 CI가 0을 포함하지 않음 (iv) **모든 장세(2022 약세·2023 회복·2024-25 강세)에서 통과**.
3. 한 장세라도 게이트 실패 → **STOP, diagnostic-only** (그 config는 robust 아님).
4. 최종 winner = 위를 **모든 장세에서** 충족하는 config. 장세별 cherry-pick 금지.
5. 다중비교 caution: 한계적(0.05<p<0.15) → **ADJUDICATE**(PASS 아님). 어떤 config도 통과 못 하면 → "Tier0는 leader-inclusive 깔때기, 예측 스킬 미검증" 확정 + no-apply.

## 박제 (run 시 report에 기록)
- `parameter_lock_commit_hash` = 이 파일 commit SHA. harvest JSON + 4config 비교에 기록.
- run 후 결과가 나빠도 임계/파라미터 **수정 금지** — diagnostic으로 보고하고, 별도 정당화된 단계에서만 재설계.
