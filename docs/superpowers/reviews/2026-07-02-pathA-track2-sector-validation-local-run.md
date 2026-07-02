# Path A Track-2 섹터 선정방식 — 로컬 end-to-end 검증 RUN + readiness verdict

- **날짜**: 2026-07-02
- **대상**: 사용자 "2번 섹터 선정방식" = Path A **Track-2 (generator-shadow)** = 생성단계 섹터-aware shadow 150 후보 → forward-recall 검증 (`scripts/shadow_eval.py`, PR-B5). (Track-1 in-pool 30-rerank은 사용자 원질문[150-recall]을 구조적으로 답 못 하므로 본체 아님 — 대조군으로만 검증.)
- **base**: main `c6d6167` (Path A Track-1 PR-A1~A5 + Track-2 PR-B1~B5 + B-1 sector-comparison 메뉴 + 마이그 0038/0039/0046 전부 머지).
- **프로세스**: Claude dynamic workflow(1차) → omxy 리뷰+직접수정(본 step-2 완료) → Claude 적대 리뷰+수정 → omxy 재검토 → CONVERGED까지 반복 (연결포인트 검증 포함 · 문서 최신화 동일 프로세스).

---

## §0 TL;DR (한 줄)

> **섹터 선정방식이 "더 낫다"는 통계적 PASS/FAIL 판정은 지금 만들 수 없다 — 설계상 forward-only이고, 게다가 Stage-1 아키텍처에서 최선 결과가 구조적으로 `DIRECTIONAL`(PASS 도달 불가)이다.** 하지만 검증 파이프라인 전체는 로컬(production 무접촉)에서 end-to-end로 돌려 **모든 연결포인트가 배선돼 있고 검증기가 정직하게 동작함**(데이터 부족→INCOMPLETE_RUN, 충분→DIRECTIONAL, 절대 PASS 아님)을 증명했다. 단, 로컬 E2E는 100% 합성 패널의 **mechanical fixture**라 시장 유효성·섹터 우월성 증거가 아니며, 실제 go/no-go로 가려면 USER가 production에서 shadow 데이터 축적을 **시작**해야 하고(마이그·flag·섹터가설·KRX 키), 첫 판정까지 **수개월~약 18개월**이 걸린다.

---

## §1 "2번 섹터 방식 검증"이 정확히 무엇인가

- **Track-2 generator-shadow**: 생성단계에서 주도섹터 가설(`leading_sectors`)을 additive soft-tilt(+10)로 반영한 shadow 150 후보(arm=`sector-soft-tilt`)를 production-mirror arm과 나란히 만든다.
- **forward-recall 검증(목적함수)**: `PRIMARY = recall(sector-soft-tilt) − recall(production-mirror)` (paired recall lift). recall = `|selected ∩ winners| / |winners|`, winners = universe-wide 스냅샷의 forward top-decile 양(+)수익률 리더. → "섹터-aware 생성이 150단계에서 놓친 대형 리더를 더 잡는가"를 측정.
- **산출물**: `scripts/out/tier0_shadow_recall_verdict.json` (+ .md). `run_verdict ∈ {PASS, DIRECTIONAL, INCOMPLETE_RUN, INVALID_INPUT}`.
- **B-1 "종목 선정 방식 비교 (실험)" 메뉴**(`/admin/sector-comparison`): 통계 verdict와 **별개**의 human 눈검증 — production B++ 30 vs Track-2 sector-soft-tilt top-30 + KRX 실현수익률 나란히 표시.

---

## §2 이번에 실제로 돌린 것 (step-1 + omxy step-2 재검증, 로컬·production 무접촉)

| 영역 | 결과 | 근거 |
|---|---|---|
| Python 유닛 (shadow required gate, omxy 재실행) | ✅ **458/458 PASS** | `scripts/.venv/bin/python -m pytest scripts/test_shadow_*.py` |
| TS 게이트 (step-1 기록, 이번 omxy 범위 밖) | ✅ tsc / lint / build PASS · shadow-인접 5파일 127/127 PASS | `npx tsc --noEmit`·`npm run lint`·`npm run build`·`vitest run` 5파일 = shadow-arm-logger·shadow-harness-arms·tier1-selection-batch-worker(shadow seam)·admin-sector-comparison·layout-nav-invariant (뒤 2개는 worker/nav-인접, 순수 shadow 아님) |
| 연결포인트/불변식 (커버 방식 명시) | ✅ **6/6 PASS** | **E2E-run**: data-chain(gen→PG→reconcile→eval) · **grep/unit**: production read 경로 shadow 식별자 0·default-OFF byte-identical·2단계 generator 게이트 · **pg_smoke**: service_role SELECT 봉쇄(T2-I-6)·UI seam RPC(0046) · **vitest**: nav 등록 (2단계 게이트·UI seam RPC은 E2E-run 아님, 아래 §4) |
| 로컬 PG smoke (step-1 기록, docker-free) | ✅ **6/6 PASS** | `pg_smoke_0038/0039/0039_prb3/prb4/prb5/0046.sh` (각 createdb→apply→assert→dropdb) |
| B1/B2/B3 real-conn smoke | ⏸ **정당 SKIP** | real Supabase(service_role PostgREST·owner=postgres·default-priv)만 증명 가능 = USER-only. grant **매트릭스** 자체는 로컬에서 실검증됨 |
| E2E dry-run (gen→runner→PG→reconcile→Query2→eval, omxy 재실행) | ✅ **chain_ran=true · prod 무접촉** | `scripts/.venv/bin/python scripts/shadow_e2e_local_dryrun.py` |

### E2E 검증기 정직성
- **판별력**: 동일 인프라·동일 합성 패널에서 **period 수만 다르게** 하면 verdict가 달라진다 — 1-period → `INCOMPLETE_RUN`(reason `n_below_data_floor`, n=1<6), 8-period → `DIRECTIONAL`. 상수 출력이 아니다.
- **arm-distinctness (가드됨)**: sector-soft-tilt arm이 production-mirror와 실제로 다른 150을 낸다(반도체 12→14; driver가 period마다 `soft_tickers != mirror_tickers`를 assert=`arms_distinct=true`). tilt가 no-op(`SOFT_TILT_V1_ADDEND=0`)으로 회귀하면 이 assert가 실패 — generator-shadow 경로가 mirror와 구별되게 작동함을 가드.
- **결정성·무-허위lift 가드 (범위 한정)**: driver가 `recall_shadow==recall_mirror` & `period_lift_mean==0.0`를 assert(`equal_recall_zero_lift=true`). **단** 이 fixture는 winner가 top-cap(k≥180)이라 양 arm이 항상 같은 winner를 포착 → recall 동일이 **fixture-구조상 자명**하다. 따라서 이 assert는 "검증기가 결정적이고 허위 lift를 만들지 않음"만 증명하며 **recall 민감도(실제 recall 차이 검출)는 증명하지 않는다** — recall 민감도는 shipped unit test(`test_shadow_eval.py`)가 커버. 요컨대 섹터 arm을 winner로 몰아 우월 결론을 만들지 않음.
- **실연산**: 8-period 시나리오가 실제 숫자를 냄(`n_periods=8`, `n_winners=160`, `recall_shadow=recall_mirror=0.5`, `period_lift_mean=0.0`, `ci90=[0,0]`) — 합성 패널이 실제 로드돼 forward return을 계산했다는 증거.
- **PASS 도달 불가(구조적)**: 모든 cell이 `gate_b.verdict=NOT_APPLICABLE`(입력 미저장) → `_rollup`은 gate_b 전부 PASS일 때만 PASS 승격 → 상한 = **DIRECTIONAL**. verdict JSON `no_apply=true`.
- **honest 미달 상태**: below-floor는 버그가 아니라 정직한 `INCOMPLETE_RUN`.
- **production 무접촉 + network fail-closed**: driver는 psql·createdb·eval 등 모든 subprocess에서 `PGHOST`/`DATABASE_URL`/Supabase 계열 **및 `KRX_OPENAPI_KEY`**를 제거해 로컬 Unix-socket PG만 쓰고 KRX 실 fetch를 fail-closed로 만든다. panel cache 완비 assert는 **eval subprocess가 실제 요청하는 day-list**(`SE.shadow_panel_days(eval_start, eval_end)`)에 대해 수행 — param 변경으로 eval 범위가 넓어져도 cache-miss→live-KRX 우회가 불가능하다. `screen_shortlist_tier0` import는 `BPP_LOOKBACK` 상수용이며 CLI orchestrator(`run_shadow_bpp_generation_path`)·production writer path는 진입하지 않는다.

---

## §3 왜 "지금" 통계 go/no-go가 불가능한가 (핵심)

1. **forward-only 설계**: 섹터맵(`induty_code` + `sector_override.json`)이 current-only 아티팩트라 과거로 소급하면 look-ahead bias. 과거 주도섹터 LLM 출력도 없음 → 과거 백테스트 불가(D30 Tier0 B++ PIT harvest와 결정적으로 다른 점).
2. **production shadow rows = 0건**: generator 미실행. 검증기는 mig-0039 shadow 테이블(`tier0_candidates_150_shadow` + `tier0_shadow_universe_snapshot` + `tier0_shadow_sector_hypothesis`)에서 owner-psql로 추출한 JSON을 읽는다 — 지금은 빈 상태.
3. **누적 시간 벽**: `n ≥ power_floor_n`(USER 사전동결, 최소 data floor 6보다 클 수 있음) 만큼 period가 필요하다. short=weekly라 수개월 단위, midlong=monthly이고 long horizon 126거래일(~6개월) tail이 붙으면 첫 중장기 verdict는 `power_floor_n`에 따라 **수개월~약 18개월**까지 걸린다.
4. **Stage-1 구조적 상한 = DIRECTIONAL**: Gate B(rank-IC IR ≥ 0.30) 입력(baseline/sleeve/spread)이 미저장이라 full Gate B = `NOT_APPLICABLE`. → 아무리 데이터가 쌓여도 Stage-1에서 full PASS 도달 불가. 어휘 상한 = "generation-stage counterfactual observation (verification pending)". **"섹터 방식이 유효/상승 예측" claim 금지** (D30 no-apply 규율 상속).

---

## §4 검증된 연결포인트 (seams)

**E2E-run (데이터 체인)**: `generator(shadow_gen_core, pure) → runner(shadow_gen_runner) → 로컬 PG upsert_tier0_shadow_run(0039) → reconcile(RECONCILE_GAP_SQL→classify_coverage_row) → Query-2 추출(SHADOW_RUN_EXTRACT_SQL, owner psql) → forward-recall evaluator(validate_tier0_ic --shadow-eval)` — 이 데이터 체인은 로컬 실행으로 통과. **주의**: E2E는 pure `shadow_gen_core`에 진입하며, production CLI orchestrator glue `run_shadow_bpp_generation_path` + 2단계 게이트(`--shadow-sector`⇒bpp · `SHADOW_GENERATOR_ENABLED`)는 **E2E-run이 아니라** unit test(`test_shadow_gen_runner.py`, mocked supabase)로 커버.
**UI seam (E2E-run 아님)**: `sector-comparison/page.tsx → admin-sector-comparison.getShadowArmTop → rpc(get_tier0_shadow_arm_top, 0046) → tier0_candidates_150_shadow` (is_admin 게이트 + arm allowlist=production-mirror/sector-soft-tilt만, sector-hard-gate 영구 제외). E2E 드라이버는 0046을 apply만 하고 RPC를 호출하지 않는다 — 실 커버 = `pg_smoke_0046.sh`(real 로컬 PG에서 RPC 실호출 + soft-tilt rows·no-leak·invalid_arm·is_admin 검증) + `admin-sector-comparison.test.ts`(mocked rpc, wrapper 계약).
불변식: production 선정 read 경로 shadow 식별자 0 · flag OFF byte-identical · service_role shadow SELECT 봉쇄.

---

## §5 USER runbook — 실제 축적을 "시작"하려면 (모두 USER-only 외부상태)

> 이걸 해야 언젠가 진짜 verdict가 나온다. Claude는 실행 불가(가이드만).

1. **마이그 0038/0039/0046 production apply 확인** — HANDOFF 기준 2026-06-28 일괄 apply됨(스펙 문서는 그 이전이라 "미적용"으로 기재). Supabase에서 실제 apply 여부 확인, 미적용이면 `mcp__supabase__apply_migration`(owner).
2. **B2/B3 real-conn smoke** — `scripts/pg_smoke_0039.sh` epilogue 3종 중 **B1(service_role SELECT denied)은 2026-06-28 apply 시 real Supabase에서 이미 검증됨(HANDOFF)** → 잔여 = B2(RPC owner=postgres DEFINER-write-on-EXECUTE) + B3(default-priv 비재부여) 2종을 real Supabase에서 실행.
3. **섹터 가설 사전등록** — 매 period 주도섹터(`SHADOW_LEADING_SECTORS`, canonical-14) + `SHADOW_SECTOR_ASOF`(< selection_as_of) + `SHADOW_HYPOTHESIS_ID` 사전등록. **이건 USER의 시장 판단이라 Claude가 대신 정하면 안 됨**.
4. **`KRX_OPENAPI_KEY`** — B-1 메뉴 실현수익률 + eval forward return.
5. **generator 실행/스케줄** — 예시(월간): `SHADOW_GENERATOR_ENABLED=true SHADOW_SECTOR_SOURCE=manual_pre_registered SHADOW_LEADING_SECTORS=반도체,... SHADOW_SECTOR_ASOF=<selection_as_of 이전 ISO> SHADOW_HYPOTHESIS_ID=<uuid> SHADOW_GEN_ARMS=production-mirror,sector-soft-tilt scripts/.venv/bin/python scripts/screen_shortlist_tier0.py --month YYYY-MM-01 --dry-run --csv-backup scripts/out/tier0_shadow_<period>.csv --scoring bpp --shadow-sector`. **`SHADOW_LEADING_SECTORS`(canonical-14)·`SHADOW_SECTOR_ASOF`(< selection_as_of)는 `manual_pre_registered`에서 필수** — 누락 시 RPC 도달 전 `ShadowRunnerError` abort(`shadow_gen_runner.py:219-227`), 또한 generation-time 값이 step-3 사전등록값과 동일해야 finalize content-binding을 통과한다. `--dry-run`은 legacy CLI 필수 인자일 뿐, 이 경로는 shadow RPC(`upsert_tier0_shadow_run`)에 적재하므로 USER-only production 외부상태 작업이다. production writer 미경유, shadow 테이블에만 적재.
6. **`power_floor_n`·`freeze_tag` 사전동결** + timeline/power sign-off → `n ≥ floor` 도달 후 `scripts/shadow_reconcile.py`(coverage) + `validate_tier0_ic.py --shadow-eval`로 verdict RUN.
7. **눈검증(즉시 가능)**: 위 1·4 + generator 1회 실행 후 `/admin/sector-comparison`에서 side-by-side 관측(통계 판정 아님).

---

## §6 검증 중 발견 (범위 밖 · 별도 트리아지 권장)

- **test:ci 1건 RED (main `c6d6167`)**: `route.test.ts:872` `finding 1/8/10 — midlong 고아(전분기 created)도 60일 window 내면 탐지` → `expected false to be true`. **root-cause 확정(적대 리뷰)**: 테스트가 orphan 픽스처를 `recentMidlongOrphan()`=wall-clock −31d(오늘 기준 `m:2026-06`)로 만드는데, worker route의 `currentPeriodKeys`가 **고정 seam `MON_NOT_FIRST=2026-06-08`(→`m:2026-06`)**를 union에 포함 → 픽스처가 seam 월과 충돌해 필터링(고아 미탐지). 즉 **고정 seam 월 vs wall-clock 픽스처 월의 충돌 = 테스트 전용 시간-취약 아티팩트**이며, production 경로는 seam이 없어(union=real-now only) 충돌이 없다 → **7월 실 cron orphan-window 버그 아님**. shadow 작업과 무관·범위 밖(미수정); 테스트 픽스처 시간-앵커 개선은 별도.
- **0046 RPC named-arg 계약 drift-blind (LOW)**: TS wrapper는 named args `{p_arm, p_period_key, p_limit_per_bucket}`로 호출(admin-sector-comparison.ts:57)하고 0046 SQL 파라미터명과 일치(검수 확인). 그러나 pg_smoke_0046은 positional·vitest는 mocked·E2E는 RPC 미호출이라, SQL 파라미터명이 TS 키와 drift하면 세 레이어가 green인 채 실 PostgREST named-arg 호출만 실패할 수 있다(오늘은 일치, 미검증 계약 edge). 자연스러운 커버 지점 = USER-only real-conn smoke.
- **evaluator 출력 사소 불일치**: verdict JSON에서 `cells[].ic_ir=null`인데 `gate_a.fails`는 "co-gate rank-IC IR inf < 0.3"로 표기. 표시 일관성 이슈(shipped `shadow_eval.py`), 판정에는 영향 없음. 범위 밖 — 미수정, 후속 flag.

---

## §7 프로세스 로그 (Claude↔omxy)

- **step-1 (Claude dynamic workflow, 1차)**: ✅ 위 §2. 신규 산출물 = `scripts/shadow_e2e_local_dryrun.py` + 본 문서.
- **step-2 (omxy 리뷰+직접수정)**: ✅ 합성 winner 비왜곡 assert(`equal_recall_zero_lift`), data-floor reason assert, local PG env sanitize, panel cache completeness assert, runbook 명령 필수인자 보정, 본 문서 수치/claim 정정. 재검증: `scripts/test_shadow_*.py` 458/458 PASS + `shadow_e2e_local_dryrun.py` chain_ran=true.
- **step-3 (Claude 적대 리뷰+수정)**: ✅ 3-렌즈 병렬 적대 리뷰(①하네스 vacuous-proof ②문서 claim-spec 정합 ③연결포인트 완전성). 배선 버그 0 — 전부 honesty/hardening. 수정: **(드라이버)** arm-distinctness assert(`soft≠mirror`) · cache 완비 assert를 eval day-list로 · `KRX_OPENAPI_KEY` env-scrub + eval subprocess에 env 적용 · `equal_recall_zero_lift` 범위(결정성/무-허위lift만, recall 민감도 아님) 주석. **(문서)** §2 TS 5파일 명시 + 연결포인트 커버방식 구분(E2E-run vs pg_smoke/unit/grep) · §2 equal_recall_zero_lift 범위 한정 · §4 CLI glue+UI seam은 E2E-run 아님 명시 · §5 generator 필수 env(`SHADOW_LEADING_SECTORS`/`SHADOW_SECTOR_ASOF`) 보강(누락 시 abort) · §5 B1 real-verified 정정 · §6 test:ci root-cause 확정(테스트 전용 시간-취약, 실 cron 버그 아님) + 0046 RPC drift LOW. 재검증: pytest 458/458 + 드라이버 chain_ran=true·arms_distinct=true.
- **step-4 (omxy 재검토 → CONVERGED)**: ✅ step-3 hardening 재검토. env scrub(`KRX_OPENAPI_KEY` 제거 + eval subprocess env 적용)·eval-day-list cache assert·arm-distinctness assert 모두 의도대로 작동. 추가 결함/회귀 없음. 재검증: pytest 458/458 + 드라이버 chain_ran=true·arms_distinct=true·scenario A `INCOMPLETE_RUN/n_below_data_floor`·scenario B `DIRECTIONAL/gateB_NA/no_pass`.
