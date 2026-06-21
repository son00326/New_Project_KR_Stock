# 경로 A — Track 2: Generator-shadow 설계 스펙 (사용자 원질문 = 150-recall 을 답하는 유일한 트랙)

> **상태**: 설계 스펙(standalone Track 2). 코드 미작성. Track 1(in-pool 30-reranking shadow)은 CONVERGED, Track 2는 별도 blast radius로 분리된 자매 스펙.
> **범위**: production `tier0_candidates_150` / `short_list_30` / Tier1 scoring / portfolio money-path는 **변경하지 않는다**. Python producer의 production write path(legacy `build_candidate_rows → upsert_candidates_supabase → tier0_candidates_150` ≈line 1300–1317, current B++ `build_stock_raw_list → select_bpp_candidates → build_bpp_candidate_rows` ≈line 889–983, `run_bpp_candidates --apply` hard-block ≈line 1338–1343) **무변경**. 모든 신규 표면은 shadow-only(신규 table `tier0_candidates_150_shadow`).
> **forward-only**: 백테스트는 소스 단계에서 불가능하다(과거 PIT 섹터맵 부재 + 과거 LLM 주도섹터 출력 부재 + look-ahead). shadow-150 recall vs production-150 recall은 스냅샷이 누적되며 **forward로만** 측정된다. 느리다 — 이것이 원질문을 답하는 비용이다.
> **검증 기준**: 현재 repo 실측(2026-06-20 KST). 인용 라인번호는 리뷰 시점 기준 `≈`이며 drift하므로, 구현 전 §11 체크리스트로 재확인한다. migration 0039는 아직 파일이 없으며 §5 SQL은 future migration 설계안이다(0038은 Track 1이 예약).
> **연관 박제**: Track 1 spec (`specs/2026-06-19-pathA-forward-shadow-sector-layer.md`) · D30 verdict (`reviews/2026-06-17-tier0-4config-multiregime-verdict.md`) · `project_tier0_scoring_bplus_decision_77` · `project_pathA_forward_shadow_sector_spec` · `feedback_workflow_verify_false_convergence` · `feedback_supabase_security_definer_pattern` · `feedback_pg_skip_locked_claim_anti_pattern` · `feedback_pit_backtest_cache_availability` · `feedback_supabase_read_during_finalize`
> **Round 1 self-critique applied (HIGH fixes)**: (1) **production K=0 코드 안전장치 격상** — DB-layer로 `service_role` SELECT를 shadow tables에서 **revoke**(production cron/server-action가 service_role로 shadow를 우연히 read→오염하는 경로 차단). RPC write는 SECURITY DEFINER라 영향 없음. 추가로 `getTier0Candidates`가 production table만 query함을 코드 단언/문서화(T2-I-6 강화, §2.1·§5.2·§5.4·§11 반영). (그 외 MEDIUM/LOW: RPC owner=migration owner[Supabase superuser-equiv] 명시 + RPC insert-succeeds smoke 추가, unresolved write = 별도 RPC `upsert_tier0_shadow_unresolved_issues`로 구체화.)
> **Round 2 adversarial edits applied (HIGH fixes)**: (1) **B++ seam fix** — current path는 `args.scoring=="bpp"`에서 legacy normalization/selection 전에 `run_bpp_candidates(...)`로 return하므로 Track 2 stage 0 seam은 B++ branch 내부/직전이어야 한다. `production-mirror`는 `select_candidate_pool_per_bucket`가 아니라 B++ pure pieces(`build_stock_raw_list`·`select_bpp_candidates`·`build_bpp_candidate_rows`)를 mirror한다(§2.1·§2.2·§4). (2) **paired baseline contract 격상** — production table에는 `universe_hash`가 없으므로 Gate A는 `production-mirror` arm을 hash-bearing baseline으로 쓰되, persisted `tier0_candidates_150`와 normalized parity가 확인된 period만 "production-150" 비교로 인정한다. production row 부재/B89 abort/parity 실패는 `INCOMPLETE_RUN`, verdict 금지(§3.8·§6.2·§11). (3) **period identity fix** — shadow schema는 `period_key` + production-compatible `month date`를 같이 저장한다. `month text YYYY-MM`만으로는 weekly short run을 덮어쓰고 production date(`YYYY-MM-01`)와 join이 어긋난다(§5.2·§5.4). (4) **hard-gate observability fix** — `counterfactual_cut`, `sector_distribution`, `sector_view`, `sector_source`, `induty_code` 저장 위치를 SQL sketch에 반영(§3.7·§5.2·§8). (5) **pre-registration/p-hack guard** — sector hypothesis + tilt params는 immutable hypothesis artifact로 period 시작 전 등록하고 candidate run은 `hypothesis_id`를 참조한다(§3.3·§5.2·§11). (6) **partial-log guard** — candidate `logged` rows require a matching complete snapshot (`run_id`, `universe_size`, `universe_hash`) and a finalized shared run; otherwise `INCOMPLETE_RUN` (§5.2·§5.4·§6.5).
> **Round 3 self/Claude-adversarial fixes applied (HIGH)**: (1) ★#1 dependency made explicit + PRIMARY arm-vs-mirror lift (forward-valid) cleanly separated from SECONDARY vs-persisted-production-150 (gated on B++ being the production scorer; INCOMPLETE_RUN today, honest). (2) normalized parity redefined as SELECTION IDENTITY only `{(ticker,bucket,rank)}`+rounded tier0_score, excluding current-only sector/name (fixes false-INCOMPLETE). (3) single atomic `upsert_tier0_shadow_run` finalize RPC replaces 3 independent-tx RPCs (no orphan snapshot; shared run_id). (4) §2.2 split code-confirmed facts vs unimplemented PR-B3 pseudocode (removed '코드 확정' overclaim). + MED: hypothesis source cross-check, universe_size=full-universe + gate_eligible_size, full gate_a_recall signature, snapshot stores no returns, real-connection/RPC-owner smoke.
> **Round 4 omxy adversarial fix applied (HIGH)**: Round 3의 atomic-finalize 문구는 맞았지만 SQL sketch가 scalar `arm`/`rows` 단일-arm payload를 남겨 구현자가 arm별 RPC처럼 해석할 위험이 있었다. 수정: finalize payload는 **run-level `snapshot_rows` + authoritative `arms[]`(각 arm의 `rows`) + `unresolved_rows`**이며, `upsert_tier0_shadow_run`이 한 transaction에서 snapshot→모든 arm 후보→unresolved를 루프 처리한다. non-mirror arm이 있으면 same payload에 `production-mirror` 필수, stale period-arm rows는 transaction 안에서 삭제 후 active arms만 재삽입한다. 추가로 finalize RPC가 hypothesis row에서 `sector_view`를 derive하여 caller-provided sector metadata drift를 reject하고, hard-gate `gate_eligible_size`를 arm-level로 persist한다.

---

## §0 결론: 무엇을 측정하고 무엇을 측정 못 하는가 (정직한 scope)

### 0.1 Track 2가 측정하는 것 = 사용자의 원래 질문

사용자의 원래 동기는 **150-recall 문제**다: "B++ Tier0가 *150 생성 단계*에서 섹터 리더(D30 실증: 대형 주도주 11개 중 10개 누락, 73차엔 1/11)를 놓친다 — 섹터를 먼저 골라 그 섹터에서 150을 만들면 리더를 더 잡나?"

**Track 1은 이 질문을 구조적으로 답할 수 없다.** Track 1 seam은 Tier1 worker(post-persist)이고, 그 후보 풀은 이미 생성된 `tier0_candidates_150`의 track slice + incumbents다. 생성 단계에서 놓친 신규 리더는 그 풀에 애초에 없으므로, post-persist 섹터 재정렬로는 복구·측정 불가(D30 핵심: "recall은 Tier0 생성 단계 책임, AI 2차가 구제 불가").

**Track 2 = 생성 단계 shadow.** production Tier0 producer는 그대로 두고, **그 옆에서 sector-aware shadow 150을 생성**하여 신규 `tier0_candidates_150_shadow`에 기록한다. 그러면 다음을 forward로 직접 측정한다:

> **shadow-150 recall vs production-150 recall** — 시장 top-decile-positive 리더 중 각 150이 잡은 비율. **둘은 동일한 forward 리더 집합(분모 공유)으로 paired 비교**된다. 단 production 쪽 baseline은 `tier0_candidates_150`에 `universe_hash`가 없으므로, hash-bearing `production-mirror` arm을 사용하고, 해당 arm이 같은 `period_key`의 persisted `tier0_candidates_150`와 normalized parity일 때만 "production-150" 비교로 인정한다(§3.8). 이것이 "섹터-aware하게 150을 만들면 리더를 더 잡나"를 직접 답한다.

> **두 metric을 명확히 분리한다 (load-bearing):**
> - **PRIMARY (period 1부터 forward-valid, production 의존성 없음)** = `recall(shadow soft-tilt/hard-gate arm) − recall(production-mirror arm)`. **두 arm 모두 B++이고 hash-bearing**이며 동일 shadow run에서 동일 universe로 생성된다. 따라서 "sector-awareness가 B++ 150-recall을 개선하나"를 production이 무엇을 persist하든 무관하게 답한다 — production scorer adoption을 기다릴 필요가 없다.
> - **SECONDARY (★#1에 종속)** = "LIVE persisted production-150 대비" 비교. 이는 production의 scorer == B++일 때만(HANDOFF ★#1 G1 적용 후), 그리고 production이 persist하는 monthly grain에서만 유효하다. 그 전까지는 INCOMPLETE_RUN(정직, 버그 아님 — §3.8).

### 0.2 Track 2가 측정하지 **못** 하는 것 (정직 한정)

- **백테스트가 아니다.** 과거 PIT 섹터맵이 없고(섹터맵은 current-only artifact — §0.3), 과거 LLM 주도섹터 출력이 없으며, override.json은 live snapshot이라 과거에 적용하면 look-ahead가 발생한다. ⇒ **forward-only.** PIT 섹터맵은 매 period 현재맵 스냅샷으로 자연 누적된다(`canonical_sector_mapper` 현재맵 스냅샷). forward n_periods floor 미달 전 어떤 verdict도 금지(§6).
- **"상승 예측"·"outperformance"·"sector will lead" claim 금지** (D30 no-apply). forward 게이트가 통과하기 전까지 산출물 어휘는 "shadow 생성-단계 counterfactual 관측"까지만.
- **느리다.** short=weekly·midlong=monthly로 누적되므로 의미 있는 paired recall verdict까지 `n_periods ≥ 6` (§6.1) — 즉 short는 6주+, midlong은 6개월+가 필요하다. 이는 회피 불가능한 비용이며, "측정했는데 답 없음" 무한 정체를 막기 위해 §12에서 forward 기간 acceptance를 선결한다.

### 0.3 섹터맵이 current-only artifact라는 핵심 제약 (코드 확정)

`canonical_sector_mapper.resolve_sector(ticker, induty_code, override)`는 결정론적이지만 **외부 상태가 current**다:
- `induty_code`는 query 시점 DART API 응답 스냅샷(`screen_shortlist_tier0.py::resolve_sectors_for_universe` ≈line 419–471, dart_corp_codes 배치 lookup).
- `sector_override.json`은 live production snapshot(`canonical_sector_mapper.load_override` ≈line 251–297; 현재 `override_date` 2026-06-03 → 77차 reseed 2026-06-11, 40 tickers). 77차 reseed는 **현재 DART 분기 staleness를 고친 것이지 과거 소급 backfill이 아니다.**

⇒ 과거 period에 current override.json + current induty를 적용하면 **look-ahead bias**. 따라서 mechanical sector-momentum backtest는 cheap sanity probe가 될 수 **없다**(§9에서 명시 reject). Track 2는 forward-only로만 정직하게 성립한다. canonical 14는 Python `CANONICAL_SECTORS`와 TS `canonical-sectors.ts::CANONICAL_SECTORS`가 1:1 동기(§8).

### 0.4 Track 1 대비 정직한 contrast

| 트랙 | seam | 측정 대상 | 원질문(150-recall) 답? | blast radius |
|---|---|---|---|---|
| **Track 1 — In-pool 30-reranking observer** (별도 spec, CONVERGED) | Tier1 worker, post-persist | worker-available pool(current track slice + incumbents) 내 섹터 재정렬이 track 10/20을 바꾸나 | ❌ NO | 작음(TS DI seam + 1 table) |
| **Track 2 — Generator-shadow** (= 본 스펙) | Python Tier0 *옆*, 생성 단계 | sector-aware shadow 150이 production 150보다 리더를 더 잡나 (150-recall) | ✅ YES (유일) | 큼(Python 생성 단계 + 신규 table + (선택)LLM role) |

> 사용자가 **Track 1 + Track 2 둘 다 빌드**를 결정했다(§12는 잔여 파라미터 결정만). 본 스펙은 Track 2를 Track 1과 동일 rigor로 완전 설계한다.

---

## §1 LOCKED 불변사항 (Track 2)

| # | 불변 | 설계 강제 |
|---|---|---|
| T2-I-1 | **money-path 무변경** | `input.persist(...) → short_list_30`(money-path SoT)는 Track 2가 절대 호출/변경 안 함. shadow는 money-path를 읽지도 쓰지도 않음 |
| T2-I-2 | **production Tier0 150 무변경** | `tier0_candidates_150` 스키마/producer/consumer 변경 없음. shadow write는 **신규 `tier0_candidates_150_shadow`에만**. `upsert_candidates_supabase`(≈line 1300–1317) 절대 shadow path에서 호출 금지 |
| T2-I-3 | **production producer/generator path 무변경** | legacy `build_candidate_rows → tier0_candidates_150 delete+insert`(≈line 1312) 무변경. current B++ `build_stock_raw_list → select_bpp_candidates → build_bpp_candidate_rows`(≈889–983) 무변경. `run_bpp_candidates --apply` hard-block(≈line 1338–1343) 무변경 |
| T2-I-4 | **30 = 단10/중10/장10 무변경** | production short_list_30의 30 구성 불변. shadow는 150 후보를 만들 뿐 30 선정/포트에 절대 주입 안 함 |
| T2-I-5 | **B++ Tier0 150 무변경 (additive shadow only)** | production 150(50×3 disjoint, B++ size-sleeve)은 그대로. shadow 150은 **추가 산출물**이며 production을 대체/오염하지 않음 |
| T2-I-6 | **production K = 0 (코드 안전장치 강제)** | shadow는 money-path / Tier1 selection / portfolio에 절대 feed 안 함. production이 shadow row를 읽는 코드 경로 0건. **문서 규율로 끝내지 않고 2중 코드 안전장치**: (a) DB-layer — `service_role`은 shadow tables SELECT 권한 **없음**(0039 grant block, §5.2). production cron/server-action는 service_role로 도므로 우연히 `select … from tier0_candidates_150_shadow`해도 권한 거부 → tier0_candidates_150 read path/short_list_30 오염 불가. shadow write RPC는 SECURITY DEFINER라 정상 동작. (b) TS-layer — production consumer(`getTier0Candidates` 등)는 `tier0_candidates_150`만 query함을 docstring + 정적 assert로 단언, shadow table 식별자를 production read 코드에 절대 두지 않음(§11 grep gate). shadow admin read-only UI는 별도 PR에서 task-specific 제한 RPC로만(직접 service_role SELECT 부여 금지) |
| T2-I-7 | **하드게이트 production 영구 금지 / shadow diagnostic-only** | sector-hard-gate(universe를 사전등록 섹터 집합으로 절단 후 선정)는 **production 영구 금지**. Track 2 primary answer는 soft-tilt vs production-mirror recall이고, hard-gate는 stress/diagnostic arm only. full-universe counterfactual을 함께 로깅하여 게이트가 잘라낸 리더가 데이터에 남아 "보이기" 때문(R2 비가시성 문제 해소, production 아니므로 human 안전망 무력화 없음) |
| T2-I-8 | **forward-only** | 백테스트 금지(소스 부재 + look-ahead, §0.3). PIT 섹터맵은 forward 스냅샷 누적으로만 확보. forward n_periods floor 전 verdict 금지 |
| T2-I-9 | **hardcap 50만 KRW** | LLM 주도섹터 콜은 hardcap 내 **별도 budget/ledger**. production cost path(`cost_log`)에 `armFilter` 추가 금지(`cost_log`에 arm 컬럼 없음 → production spend undercount 위험) |
| T2-I-10 | **env/flag/migration apply = USER-only** | migration 0039 apply, env flag 토글, harvest/kill automation, LLM source 활성은 USER 승인 후. Claude/omxy는 실행 금지 |
| T2-I-11 | **D30 no-apply / 정직 scope** | forward 게이트 통과 전 "상승 예측"·"outperformance"·"sector will lead" 금지. 산출물/UI 어휘 "shadow 생성-단계 counterfactual 관측"까지만 |

---

## §2 현재 repo 실측 touchpoint (Track 2)

### 2.1 변경하지 않는 표면 (production)

| 표면 | 현재 사실 (anchor) | 결정 |
|---|---|---|
| `screen_shortlist_tier0.py::upsert_candidates_supabase` (≈1300–1317) | **PRODUCTION WRITE MUTATION BOUNDARY**: delete month from `tier0_candidates_150` → upsert on conflict(month,ticker) | shadow path 절대 호출 금지 |
| `screen_shortlist_tier0.py::build_candidate_rows` (≈1219–1236) | legacy pure row builder (legacy selections → `Tier0CandidateRow` 150행) | **B++ Track 2 stage 0의 baseline 아님.** non-bpp legacy extension에서만 재사용 가능 |
| `screen_shortlist_tier0.py::build_stock_raw_list` / `select_bpp_candidates` / `build_bpp_candidate_rows` (≈889–983) | **current B++ 150 generator pure core**: StockSignal+price+quality → B++ StockRaw → L20/M20/S10 sleeve 50/bucket, cross-bucket disjoint → `Tier0CandidateRow` | Track 2 stage 0 `production-mirror`는 이 B++ pure core를 mirror해야 함. `select_candidate_pool_per_bucket`/`build_candidate_rows`로는 B++ parity 불가 |
| `screen_shortlist_tier0.py::run_bpp_candidates` (≈1324–1423) | B++ 오케스트레이션. `--apply` hard-block(≈1338–1343). B89는 informational-only(≈1370–1393). `write_candidates_csv` 호출하나 **never `upsert_candidates_supabase`**. `main`은 `args.scoring=="bpp"`에서 이 함수를 호출 후 즉시 return(≈1541–1543) | 무변경. shadow는 이 함수를 as-is로 호출하지 않고, `args.scoring=="bpp" && --shadow-sector` 분기에서 B++ pure core를 재사용한 뒤 shadow RPC로만 기록 |
| `screen_shortlist_tier0.py::main()` legacy path (≈1430–1662) | fetch_universe → resolve_sectors → prefetch → signals → normalize → B89 enforce(≈1593) → upsert | production write path 무변경. shadow는 B89 enforce **이전** 분기 |
| `tudal/supabase/migrations/0028_tier0_candidates_150.sql` (≈22–75) | unique `(month,ticker)`,`(month,bucket,rank)` + canonical-14 sector CHECK + `ticker ~ '^[0-9]{6}$'` + RLS admin policy | 무변경. shadow table이 **safety 패턴 mirror** |
| `tudal/src/lib/data/admin-tier0-candidates.ts::getTier0Candidates` (≈142–170) | `tier0_candidates_150` track-bucket SELECT → `Tier1Candidate[]`. sector ∈ canonical-14 ∪ null, rank 1..50 | **무변경 + production-only 단언 추가** — `getTier0Candidates`(및 여타 production consumer)는 `tier0_candidates_150`만 read함을 docstring으로 명시하고, shadow 식별자(`tier0_candidates_150_shadow`/`tier0_shadow_*`)를 production read 코드에 두지 않음(§11 grep gate). DB-layer로도 service_role SELECT가 shadow에서 revoke되어 production 경로의 우발 read를 권한 거부로 차단(T2-I-6). shadow는 별도 consumer(stage 0엔 TS consumer 없음, §8) |
| `tudal/src/lib/screening/persona-eval.ts::runTier1Screening` (≈1–50) | `(track, candidates) → result`. sector input 없음, reranking 없음 | 무변경. shadow는 Tier1에 절대 주입 안 함(T2-I-6) |
| `tudal/src/lib/ai/model-registry.ts` (≈11–18, 39–47) | `AiRole` 7종 + load-time pricing invariant. `sector_advisor` 없음 | **`sector_advisor` 추가 금지(stage 0)**. LLM source 채택 시 별도 spec/PR에서 pricing·reservation·테스트 통과 후 |

### 2.2 유일한 generation seam — 정확 위치 (shadow가 production write에 도달하지 않는 분기점)

**(현재 코드 확정 사실 — production-immutable)** — 아래는 현 `screen_shortlist_tier0.py`에서 검증된 사실이며 Track 2가 무변경으로 의존한다:
- current B++ branch는 `args.scoring=="bpp"`에서 `run_bpp_candidates` 호출 **전에 ≈1541–1543에서 return**하며, legacy normalize/selection·production write에 도달하지 않는다. 따라서 Track 2 stage 0의 load-bearing seam은 **B++ branch 내부/직전**이다.
- `run_bpp_candidates`는 절대 `upsert_candidates_supabase`를 호출하지 않는다(CSV-only). `--apply` 시 `sys.exit`(≈1338–1343)로 production write를 hard-block한다.
- legacy production upsert(`upsert_candidates_supabase` short_list 150 ≈1607, `upsert_supabase` short_list_30 ≈1645)는 legacy NON-bpp 경로이며 B89 strict-block enforce(≈1593) 이후에만 도달한다 — **B++ branch는 거기까지 절대 도달하지 않는다**.
- `upsert_candidates_supabase`(≈1300–1317)는 B++ 150 write boundary이나 위 return 때문에 **역시 도달하지 않는다**.
- 따라서 기존 draft처럼 legacy `select_candidate_pool_per_bucket` 후에 shadow를 붙이면 B++ `production-mirror` parity가 구조적으로 불가능하다.

**(설계 의도 — 미구현 pseudocode, PR-B3 구현 대상)** — 아래 `--shadow-sector` flag / `args.shadow_sector` / `run_shadow_bpp_generation_path` branch는 **현재 코드에 존재하지 않는다**(argparse는 `--scoring`/`--dry-run`/`--apply`/`--csv-backup`/`--as-of`/`--universe-limit`/`--emit-candidates`/`--sector-review-csv`만 가짐). PR-B3에서 신규 구현한다. shadow seam은 별도 함수(`run_shadow_bpp_generation_path`)로 격리하고 **`run_bpp_candidates` 및 production write 라인(≈1603–1607, ≈1641–1645)에 절대 도달하지 않게** 설계한다:

```python
# screen_shortlist_tier0.py main(), current B++ branch (≈1540–1543)
if args.scoring == "bpp":
    if args.shadow_sector:                       # NEW --shadow-sector flag (default absent)
        # reuse same already-fetched inputs as run_bpp_candidates:
        # signals / price_series / universe / dart_available
        run_shadow_bpp_generation_path(
            args=args,
            period_key=derive_shadow_period_key(args),
            signals=signals,
            price_series=price_series,
            universe=universe,
            dart_available=dart_available,
        )
        return                                   # shadow 분기 종료 → run_bpp_candidates/production write skip
    run_bpp_candidates(args, signals, price_series, universe, dart_available)
    return

# legacy non-bpp support, if ever needed, is separate: after legacy selection + sector review
# count, before enforce_b89_strict_block. It is not the B++ Track 2 baseline.
```

Load-bearing decisions:
- **shadow 분기는 `run_bpp_candidates`와 production write보다 먼저 `return`** → `run_bpp_candidates`/`upsert_candidates_supabase`/`upsert_supabase`에 구조적으로 절대 도달 못 함(T2-I-2/I-3/I-4).
- shadow는 **B89 strict enforce를 호출하지 않는다**(unresolved → halt 회피). B++의 B89 informational view(≈1377–1389와 동등)는 shadow 함수 안에서 재구성하고, unresolved를 별도 진단 table `tier0_shadow_unresolved_issues`에 단일 finalize RPC `upsert_tier0_shadow_run`의 unresolved 단계로 로깅한 뒤 계속 진행(§3.5, §5.2 — candidates payload 미혼합, internal helper `_shadow_write_unresolved` 경유).
- shadow는 production B++의 pure 단계(`fetch_universe` ≈351–400 / `resolve_sectors_for_universe` ≈419–471 / `prefetch_price_series` ≈566–628 / `build_stock_raw_list` ≈889–916 / `select_bpp_candidates` ≈929–962 / `build_bpp_candidate_rows` ≈965–983 / `validate_candidate_rows` ≈1239–1272)를 **재사용**한다. legacy `normalize_signals`·`select_candidate_pool_per_bucket`·`build_candidate_rows`는 B++ mirror가 아니므로 Track 2 stage 0 baseline에 쓰면 안 된다.
- shadow write는 **단일 finalize RPC(`upsert_tier0_shadow_run`, internal helper `_shadow_write_candidates` 경유) → `tier0_candidates_150_shadow`** 경유. production `upsert_candidates_supabase` 재사용 절대 금지(table 이름·delete 대상이 다름).
- CSV backup 경로는 distinct naming(production `csv_backup` stem과 충돌 회피 — gotcha: review_csv path = stem + `_sector_review.csv`). shadow는 `scripts/out/tier0_shadow_150_{month}.csv` 등 고유 stem.

> **왜 `run_bpp_candidates`를 그대로 못 쓰나**: `run_bpp_candidates`는 `--apply` hard-block(≈1338–1343, `args.apply==True`면 exit)이고 CSV/Gate C smoke 중심이며, arm별 shadow RPC·full-universe snapshot·immutable hypothesis 참조가 없다. shadow는 (a) B++ production 150과 동일한 selection contract를 재현해야 하고(`production-mirror` arm) (b) sector tilt/gate arm을 추가해야 하므로, `run_bpp_candidates`를 호출하지 않고 그 **B++ pure 구성요소만 재사용**한다.

---

## §3 Shadow generation semantics (Track 2)

### 3.1 generation ARMS

shadow 150은 arm별로 생성된다. 모든 arm은 **production과 동일 universe**에서 시작하고(universe_hash parity, §3.6), 동일 track/bucket 구조(disjoint 50/bucket → 150)를 유지한다.

| arm | 의미 | universe 변경 | recall에 미치는 효과 | production 가능성 |
|---|---|---|---|---|
| `production-mirror` | production 150 selection의 immutable 재현(= baseline). 동일 scoring·rank·tie-break 재사용 | 없음 | baseline(비교 기준) | 이미 production. insert-only snapshot |
| `sector-soft-tilt` | 주도섹터 종목 score를 re-weight(가산/배수)하되 **여전히 top-N/bucket, 하드 컷 없음**. universe 절단 없음 | 없음(re-rank만) | 올릴 수도/낮출 수도 있음(soft) | shadow-only |
| `sector-hard-gate` | universe를 사전등록 섹터 집합 ticker로 **절단한 뒤** 선정 | 절단(shrink) | **잘라낸 리더는 못 잡음** → recall 하락 가능. diagnostic-only in shadow(counterfactual_cut 로깅) | **production 영구 금지**(T2-I-7). shadow diagnostic arm only, full-universe counterfactual 동반 |

> `sector-hard-gate`가 shadow에서 SAFE한 이유(T2-I-7, R2 해소): production 하드게이트는 위원회(human 안전망) **이전에** universe를 절단해 잘린 리더가 다시는 안 보이는 게 치명적이다(경로 A 하드게이트 REJECT 사유). shadow에서는 **full-universe ranked snapshot(`tier0_shadow_universe_snapshot`, §5)**을 함께 로깅하므로, 게이트가 잘라낸 종목·그 forward 수익률이 데이터에 그대로 남는다. ⇒ "섹터 게이트가 리더를 얼마나 잘랐나"를 정량 측정 가능. 이것이 Track 2의 핵심 가치다.

### 3.2 track/bucket count contract
- production과 동일: `short`/`mid`/`long` 각 bucket pool=50, cross-bucket disjoint(B++ `select_bpp_candidates` `used` dedup ≈944–961, sleeve quota L20/M20/S10) → 150 distinct ticker.
- shadow 150도 동일하게 50×3 disjoint(`validate_candidate_rows` ≈1239–1272 재사용: 정확히 pool_size×3, bucket당 pool_size, unique (month,ticker), single month).
- recall 측정은 **horizon별(short21/mid63/long126 trading days, `validate_tier0_ic.py` HORIZON_DAYS 고정)** 분리.

### 3.3 leading-sector hypothesis source (Track 2 stage 0)
허용 source enum:
- `absent`: 주도섹터 가설 없음. `production-mirror`만 생성(plumbing + production-150 recall baseline 확보). `sector-soft-tilt`/`sector-hard-gate`는 source가 `absent`면 production-mirror와 동일(plumbing 증거일 뿐 성능 증거 아님). **absent-source 등록(FIX-I)**: absent도 hypothesis row를 등록한다 — `leading_sectors=[]`, `params={}`, `as_of=null`, `selection_as_of=scheduled run start`(generation 전), `hypothesis_hash=SHA-256(period_key, 'absent', {})`. 이는 NOT NULL + `(as_of is null OR as_of < selection_as_of)` CHECK를 만족하며 여전히 append-only/immutable이다.
- `manual_pre_registered`: USER/운영자가 **period 시작 전** 등록한 canonical-14 sector set + `asOf` lock(사후 변경 금지, forward 무결성). shadow-only.
- 미래 LLM source(`sector_advisor`)는 별도 spec/PR에서 pricing·reservation·prompt·테스트가 통과하기 전까지 **`invalid_input`으로 거부**(silent 동작 금지). stage 0에서는 `model-registry.ts`에 role 추가 안 함(§2.1).

`leadingSectors`는 `canonical_sector_mapper.CANONICAL_SECTORS` / `canonical-sectors.ts::CANONICAL_SECTORS` 멤버(14)만. unknown/free-text → arm `invalid_input`, production 영향 0.

`manual_pre_registered`와 `sector-soft-tilt` params는 **immutable hypothesis artifact**로 period 시작 전 등록한다(§5.2 `tier0_shadow_sector_hypothesis`). 최소 stage 0 기본은 `tilt_version='v1-fixed'` + `tilt_multiplier`/`tilt_bonus` 같은 numeric params를 `params`에 박제하고, candidate run은 `hypothesis_id`를 참조한다. 같은 `period_key`의 hypothesis는 update/delete 금지이며, `asOf >= selection_as_of` 또는 params 변경 시 candidate RPC가 `INVALID_INPUT`으로 거부한다. 그렇지 않으면 forward 결과를 본 뒤 섹터/tilt 강도를 조정하는 p-hacking이 가능하므로 Gate A verdict 금지.

### 3.4 forward 무결성 (asOf lock)
- 주도섹터 가설의 `asOf` timestamp는 평가 대상 period보다 **반드시 선행**(hindsight 섹터 라벨링 금지). §6.5 stale 가드.
- 섹터맵 자체도 current-only(§0.3)이므로, shadow generation 시점에 `resolve_sectors_for_universe`로 **그 period의 현재맵을 스냅샷**하여 `tier0_shadow_universe_snapshot.sector_view`에 박제 → PIT 섹터맵을 forward로 누적(이후 period 재현 가능). 과거 period에 현재맵 소급 적용 금지.

### 3.5 unresolved 섹터 처리 (B89 relaxation in shadow)
production은 B89 strict-block(unresolved>0 + apply → exit 2)로 모든 production write를 막는다. **shadow는 halt하지 않는다**:
- shadow는 `enforce_b89_strict_block`을 호출하지 않고, unresolved 종목을 `tier0_shadow_unresolved_issues`(ticker/induty_code/sector_source)로 로깅한 뒤 계속 진행.
- shadow 150 row의 `sector`는 canonical-14 또는 `'unresolved'` 표지를 허용(production은 canonical-14만 — `Tier0CandidateRow` ≈292 contract). 단 `sector-hard-gate` arm은 unresolved를 주도섹터로 간주하지 않음(정의상 절단 대상).
- 이유: 생성-단계 recall 측정에서 unresolved를 강제 halt하면 데이터가 안 모임. unresolved는 진단(다음 override.json 보강)으로 별도 추적.

### 3.6 universe_hash parity
- shadow universe == production universe(같은 period의 `fetch_universe` 결과). hash 불일치 = `invalid_input`. shadow는 production universe의 **대안 ranking/gate**이지, cherry-pick/확장이 아님을 RPC pre-flight에서 강제.
- `sector-hard-gate`만 universe를 절단하나, **절단 전 full-universe ranked snapshot을 먼저 로깅**(`tier0_shadow_universe_snapshot`)하므로 분모(리더 집합)는 항상 full-universe 기준으로 보존(§6.2).

### 3.7 full-universe counterfactual logging (하드게이트 안전성의 핵심)
- shadow run마다 **full-universe ranked snapshot**을 `tier0_shadow_universe_snapshot`에 1회 기록한다. 저장 단위 = **(ticker, bucket)당 1행**(bucket별 rank+score), 즉 N개 ticker는 최대 3N행을 emit한다. `universe_size`는 **distinct ticker N**이지 total row 수가 아니다. 저장 컬럼 = ticker + bucket-rank + score + sector(현재맵 스냅샷) + sector_source + induty_code.
- snapshot은 **forward 수익률 컬럼을 저장하지 않는다.** snapshot은 selection 시점의 universe-wide ticker SET(+score/sector/bucket-rank)을 persist할 뿐이고, forward 수익률은(하드게이트가 자른 종목 포함) snapshot ticker set 위에서 **PIT KRX panel을 ticker 키로 FORWARD 계산**한다(`compute_forward_return`). counterfactual 정량화 = `counterfactual_cut ∩ top_decile_winners`이며, winner는 snapshot ticker set 전체의 universe-wide forward returns에서 도출된다. ⇒ "게이트가 리더 N개를 잘랐다"가 정량화됨(수익률은 forward 계산, 저장 아님).
- 이 snapshot은 forward 측정의 분모(top-decile-positive 리더 집합)를 universe-wide로 안정시키는 입력이기도 함(§6.2, `top_decile_winners`는 universe-wide forward returns 필요).

### 3.8 period identity + production baseline contract (paired 비교의 load-bearing guard)

`tier0_candidates_150` production table은 `month date`만 있고 `universe_hash`가 없다(0028). 따라서 shadow가 "production-150 recall"을 공정 비교하려면 다음을 모두 만족해야 한다.

> ⚠️ **★#1 dependency (정직, 버그 아님)**: 현재 persist된 `tier0_candidates_150`(2026-06)는 **73차 LEGACY(pre-B++) 리스트**다. B++는 아직 production scorer가 아니다(D30 no-apply; `run_bpp_candidates`는 `--apply`에서 sys.exit ≈1338–1343). B++ production-mirror(`build_stock_raw_list→select_bpp_candidates→build_bpp_candidate_rows`)는 legacy persisted rows와 **scoring formula 자체가 다르므로**, production-mirror↔persisted parity는 **HANDOFF ★#1(G1: B++ `--scoring bpp --apply`를 production scorer로 채택)이 적용될 때까지 모든 period에서 구조적으로 `INCOMPLETE_RUN`**이다. 이는 정직한 상태이지 결함이 아니다. **Stage 0 generation/logging은 그대로 진행되고**, PRIMARY arm-vs-mirror lift는 forward로 계산 가능하며, 오직 SECONDARY vs-persisted-150 해석만 ★#1에 게이트된다.

1. Shadow run은 `period_key`(예: monthly `2026-06`, future weekly `2026-W25`)와 production-compatible `month` date(`2026-06-01`)를 함께 저장한다. `month text YYYY-MM` 단독은 금지: production join이 어긋나고, weekly short run 여러 개가 같은 month에서 overwrite된다.
2. **normalized parity = SELECTION IDENTITY only** (omxy imprecision fix). parity 비교는 정확히 다음 둘로만 정의한다: (a) set-equality of `{(ticker, bucket, rank)}` AND (b) `tier0_score` equal under the shared rounding contract(`round(score, 2)` — 양쪽 모두 2-dp이므로 ε=0, ε 명시). **`sector`/`name`/`signal_label`은 parity key에서 EXCLUDE**한다 — 이들은 descriptive/current-only(§0.3: override.json drifts, 2026-06-11 reseed)이므로 동일 selection이라도 두 run이 같은 ticker에 다른 sector를 줄 수 있고, persisted와 mirror 간 sector drift는 EXPECTED이며 parity 실패가 **아니다**. 비교는 join `(period_key/month, ticker)` 기준. (code anchor: `build_bpp_candidate_rows` ≈980 sets `tier0_score=round(sc.score, 2)`.) Gate A의 production baseline은 hash-bearing `production-mirror` arm이다.
3. production row가 없거나(B89 abort 포함), `production-mirror`가 persisted production과 selection-identity 불일치하거나, `universe_hash`가 arm 간 불일치하면 해당 period의 **SECONDARY**(vs-persisted-150)는 `INCOMPLETE_RUN`이다. shadow rows는 진단으로 보존하되 SECONDARY recall lift verdict/claim은 금지한다. **PRIMARY arm-vs-mirror lift는 영향받지 않는다**(같은 run의 두 B++ arm 비교이므로).
4. `production-mirror`에 unresolved sector가 포함된 period는 persisted production parity가 불가능하므로 **SECONDARY** 제외다. unresolved 진단은 §3.5/§5의 override 보강 입력일 뿐, persisted-vs-shadow recall 증거가 아니다.

---

## §4 generation contract (pure where possible)

Future 파일: `scripts/generate_shadow_150.py`(또는 `screen_shortlist_tier0.py` 내 `run_shadow_bpp_generation_path` + pure helper). 핵심 selection 로직은 pure 함수로 격리한다.

```python
# pure core (no DB, no LLM, no mutation)
def compute_shadow_selections(
    universe: list[dict],            # cloned; fetch_universe + resolve_sectors 결과(sector 포함)
    stocks: list[TF.StockRaw],        # cloned; build_stock_raw_list 결과(B++ pure input)
    hypothesis: dict,                 # immutable row from tier0_shadow_sector_hypothesis
    arm: str,                        # "production-mirror" | "sector-soft-tilt" | "sector-hard-gate"
    pool_size: int = 50,
) -> dict:
    """
    returns {
      "selections": {bucket: [TF.ScoredStock, ...]},        # 50/bucket disjoint (150)
      "counterfactual_cut": [ticker, ...],                  # hard-gate가 자른 종목(soft/mirror=[])
      "sector_distribution": {sector: count, ...},
      "universe_hash": str,
      "universe_size": int,
      "gate_eligible_size": int | None,                     # hard-gate: distinct gated(섹터-멤버) ticker 수
                                                            #   (absent ⇒ full N); mirror/soft-tilt ⇒ None.
                                                            #   §5.2 RPC가 hard-gate에선 non-null, 그 외 null을 강제.
    }
    no DB, no LLM, no mutation. raises invalid_input on (PR-B1 fail-closed contract, R1~R4):
      - arm unknown; hypothesis가 dict 아님
      - hypothesis.source not in {absent, manual_pre_registered}
      - leadingSectors가 list 아님 / 비-str 원소 / non-canonical-14 / 중복 sector
      - manual_pre_registered인데 leadingSectors 빈 배열 또는 asOf 누락/stale/selection_as_of 이후(instant 비교, naive=KST)
      - sector-soft-tilt arm(leadingSectors 비어있지 않음)인데 tilt_version 미등록
      - (arm 무관 D7 freeze) params가 object 아님 / 비-str 키; tilt knob(tilt_version·multiplier·addend·bonus) 선언 시 multiplier 사용·비동결 addend·미지원/비-str tilt_version
      - universe가 list[dict(ticker=...)]도 legacy list[str]도 아니거나(list 아님 포함), 둘을 혼용하거나, 빈/중복 ticker 포함
    """
```

Required behavior:
1. **No DB, no LLM, no mutation.** B++ production scoring 재사용(`select_bpp_candidates` ≈929–962, `TF.score_bpp_universe`)하되 production write 절대 호출 안 함.
2. `production-mirror` == B++ production 150 selection normalized parity **when production is persistable**(동일 `build_stock_raw_list`·`select_bpp_candidates`·`build_bpp_candidate_rows`, score desc/ticker asc, unresolved=0). persisted `tier0_candidates_150`와 parity 실패 또는 production row 부재면 Gate A는 `INCOMPLETE_RUN`(§3.8).
3. `sector-soft-tilt`: immutable `hypothesis_id`의 pre-registered `tilt_version`/params로 주도섹터 score를 re-weight 후 동일 B++ sleeve-select. 여전히 50/bucket disjoint, universe 절단 없음. `counterfactual_cut = []`. params가 사후 변경되었거나 hypothesis row와 payload가 불일치하면 `INVALID_INPUT`.
4. `sector-hard-gate`: universe를 사전등록 섹터 집합 ticker로 절단 후 B++ sleeve-select. 잘린 종목 → `counterfactual_cut`. **diagnostic-only arm**이며 selection은 shadow row로만, 어떤 production writer에도 반환 안 함(T2-I-6). 절단 후 50/bucket 또는 sleeve quota를 못 채우면 그 arm은 `INCOMPLETE_RUN`이고 recall lift primary metric에서 제외.
5. `hypothesis.source` 가 Track 2 허용 enum 밖이거나 leadingSectors가 non-canonical / stale asOf → `invalid_input` raise. silent coerce 금지.
6. `sector_view.source==='absent'` → 모든 arm == production-mirror. 이 row는 **plumbing 증거**일 뿐 성능 증거 아님(§6 baseline only).
7. 결정론: 동일 입력 → 동일 출력(재현 가능). `validate_candidate_rows`(≈1239–1272)로 150 contract 검증.

Python reuse 경계:
- B++ stage 0 재사용(import/copy, pure): `fetch_universe`·`resolve_sectors_for_universe`·`prefetch_price_series`·`build_stock_raw_list`·`select_bpp_candidates`·`build_bpp_candidate_rows`·`validate_candidate_rows`·`write_candidates_csv`·`canonical_sector_mapper.resolve_sector/load_override`.
- legacy non-bpp extension에서만 재사용 가능: `normalize_signals`·`compose_bucket_score`·`select_candidate_pool_per_bucket`·`build_candidate_rows`. 이것들은 B++ production-mirror baseline이 아니다.
- 절대 재사용 금지(mutation boundary): `upsert_candidates_supabase`(≈1300–1317, production table), `enforce_b89_strict_block`(≈511–533, halt). shadow는 단일 finalize RPC `upsert_tier0_shadow_run` 호출(internal helper `_shadow_write_*` 경유).

---

## §5 Migration 0039 설계안 — shadow 150 table + universe snapshot (production 0028 무변경)

> 0038은 Track 1 `shadow_arm_log`가 예약. Track 2는 **다음 free = 0039**. 현재 최고 applied migration = 0037(`claim_skip_locked_cte_fix`). 0039는 USER-applied only.

### 5.1 migration safety
- 신규 table 4개(`tier0_shadow_sector_hypothesis`, `tier0_candidates_150_shadow`, `tier0_shadow_universe_snapshot`, `tier0_shadow_unresolved_issues`) + RPC. 기존 production table 무변경.
- **apply SQL을 `begin;/commit;`으로 감싼다**(0034 원자성 패턴) → 부분 적용 방지.
- 파괴적 migration 없음. rollback은 신규 artifact만 drop(shadow 관측 삭제 — USER 수용 사항).
- **0039는 USER-applied only.** Claude/omxy는 migration 실행 금지(T2-I-10).
- `feedback_supabase_security_definer_pattern` 강제: table-level write grant를 `authenticated`/`service_role` 어느 쪽에도 부여하지 않음 → 모든 write는 SECURITY DEFINER RPC 경유(0028+0038 패턴 mirror). 0028은 producer-only(Python 직접 write)였으나 Track 2는 RPC-only로 격상(shadow producer가 별도 cron/manual trigger가 될 수 있어 안전성 상향).
- **production K=0 DB 안전장치(T2-I-6, Round 1 HIGH fix)**: shadow tables에 **`service_role` SELECT도 부여하지 않는다**(write뿐 아니라 read도). production cron/server-action는 service_role 키로 도므로, 직접 SELECT 권한을 주면 미래 개발자가 production read path/short_list_30 선정에서 우연히 shadow를 읽어 오염시킬 수 있다 → DB-layer로 봉쇄. shadow read가 필요한 admin UI는 **별도 PR에서 task-specific 제한 RPC**(UI-only, production consumer 미경유)로만 노출하고, 그때도 광역 `service_role` SELECT grant는 부여하지 않는다.
- **partial-log guard — single atomic finalize RPC (Round 3/4 HIGH fix)**: deliverable은 **단일 SECURITY DEFINER `upsert_tier0_shadow_run(p_payload)`** finalize RPC다. Payload shape is **run-level**, not arm-level: `{period_key, month, run_id, hypothesis_id, universe_hash, universe_size, sector_view, snapshot_rows, arms:[{arm,status,rows,counterfactual_cut,sector_distribution,gate_eligible_size,error}], unresolved_rows}`. 이 RPC는 **하나의 transaction + 하나의 shared `run_id`**로 (1) hypothesis source+existence 검증 → (2) full-universe `snapshot_rows` insert → (3) `arms[]`의 모든 per-arm candidates insert(loop) → (4) `unresolved_rows` insert를 수행한다. `arms[]`가 authoritative active-arm set이며, `sector-soft-tilt`/`sector-hard-gate`가 있으면 같은 payload에 `production-mirror` arm도 반드시 있어야 한다(같은 run의 paired baseline 보장). `sector_view`는 caller payload가 아니라 registered hypothesis row에서 derive되며, caller-provided copy가 다르면 reject한다. transaction 시작 후 해당 `period_key`의 stale shadow candidates를 삭제하고 active arms만 재삽입하므로 이전 run의 omitted arm이 Gate A에 섞이지 않는다. per-table writer 3개는 **INTERNAL(un-granted) helper 또는 inline step**으로 격하되고, **`service_role` EXECUTE는 오직 `upsert_tier0_shadow_run`에만** 부여한다. completeness/partial-log guard는 candidates와 snapshot을 같은 transaction 안에서 동일 `(period_key, run_id)`로 묶으므로(candidates.run_id == snapshot.run_id 강제), "complete snapshot 작성 후 candidates 중간 실패 → orphan snapshot" 및 "일부 arm만 logged" 경로가 **구조적으로 불가능**하다.
- **RPC owner = migration 적용자(Supabase의 `postgres`/superuser-equivalent)** — SECURITY DEFINER 함수는 **owner 권한으로 실행**되므로, 0039를 표준 경로(`mcp__supabase__apply_migration`, owner=postgres)로 apply하면 RPC INSERT/DELETE는 owner 권한으로 성공한다. **migration은 신규 table에 대한 full DML 권한을 가진 superuser/owner가 적용해야 한다** — 그렇지 않으면 DEFINER RPC의 INSERT가 owner 권한 부족으로 실패한다(§5.4 owner 검증 smoke). **`service_role`에는 table DML grant가 없어도 RPC write가 동작**(EXECUTE만 grant). ⚠️ 적대 리뷰 제안 중 `ALTER TABLE … OWNER TO service_role`는 **채택하지 않음** — Supabase에서 RPC owner는 service_role이 아니라 migration 적용자이고, service_role을 table owner로 만들면 오히려 RLS bypass·grant 경계가 흐려진다. 안전장치는 "RPC를 owner=postgres로 생성" + "service_role엔 EXECUTE만"으로 충분하며, §5.4 smoke에서 RPC INSERT 성공을 명시 검증한다.
- `feedback_pg_skip_locked_claim_anti_pattern`: shadow write는 insert/upsert-only(UPDATE...SKIP LOCKED 미사용)이므로 직접 해당 없음. 단 reconcile(PR-B4)이 concurrent selector와 race 가능하면 MATERIALIZED CTE 패턴.

### 5.2 apply SQL sketch

```sql
begin;
-- migration: 0039_tier0_candidates_150_shadow
-- purpose: Track 2 generator-shadow sector-aware 150 + full-universe counterfactual snapshot.
--          Production tier0_candidates_150 / short_list_30 untouched.

-- (0) immutable sector hypothesis / pre-registration artifact
create table if not exists public.tier0_shadow_sector_hypothesis (
  id uuid primary key default gen_random_uuid(),
  period_key text not null check (
    period_key ~ '^\d{4}-\d{2}$' or period_key ~ '^\d{4}-W\d{2}$'
  ),
  source text not null check (source in ('absent','manual_pre_registered')),
  leading_sectors jsonb not null default '[]'::jsonb,
  as_of timestamptz,
  selection_as_of timestamptz not null,
  params jsonb not null default '{}'::jsonb,
  hypothesis_hash text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint shadow_hypothesis_uniq unique (period_key, source, hypothesis_hash),
  constraint shadow_hypothesis_asof_preselection check (as_of is null or as_of < selection_as_of)
);

-- no update/delete grants or APIs: hypothesis rows are append-only. Corrections use a new hash/id
-- before selection_as_of; candidate logging references exactly one hypothesis_id.

-- (1) shadow 150 candidates (per arm)
create table if not exists public.tier0_candidates_150_shadow (
  id uuid primary key default gen_random_uuid(),
  -- period_key is the evaluation identity; month mirrors production 0028's date key.
  -- monthly stage-0 example: period_key='2026-06', month='2026-06-01'.
  -- future weekly short example: period_key='2026-W25', month='2026-06-01' (no overwrite).
  period_key text not null check (
    period_key ~ '^\d{4}-\d{2}$' or period_key ~ '^\d{4}-W\d{2}$'
  ),
  month date not null check (extract(day from month) = 1),
  arm text not null check (
    arm in ('production-mirror','sector-soft-tilt','sector-hard-gate')
  ),
  hypothesis_id uuid not null references public.tier0_shadow_sector_hypothesis(id),
  ticker text not null check (ticker ~ '^[0-9]{6}$'),          -- 0028 패턴
  name text,
  -- canonical-14 OR 'unresolved' (shadow는 unresolved 허용; production은 canonical-14 only)
  sector text not null check (
    sector in ('바이오','반도체','건설','금융','2차전지','자동차','IT/SW',
               '유통/소비재','에너지','엔터/미디어','통신','철강/소재','운송/물류','보험/증권','unresolved')
  ),
  bucket text not null check (bucket in ('short','mid','long')),
  rank int not null check (rank between 1 and 50),
  tier0_score numeric,
  signal_label text,
  sector_view jsonb not null default '{"source":"absent","leadingSectors":[]}'::jsonb,
  counterfactual_cut jsonb not null default '[]'::jsonb,
  sector_distribution jsonb not null default '{}'::jsonb,
  universe_hash text not null,
  -- universe_size = full pre-cut production universe = N DISTINCT tickers (NOT total rows; snapshot emits up to 3N).
  -- ALWAYS the full pre-cut universe for ALL arms including sector-hard-gate (분모 universe-wide 고정, §6.2).
  universe_size int not null check (universe_size >= 150),
  -- post-(sector-)cut universe size = distinct gated sector-member ticker count (hard-gate arm only).
  -- NOTE: 섹터 멤버십 카운트이며 유동성 플로어/NaN-trend eligibility 적용 전 값이다(= compute_shadow_selections
  -- gate_eligible_size). 실제 under-fill 제어는 SleeveShortfallError→ShadowIncompleteRunError 경로이고, 이 컬럼은
  -- diagnostic metadata다. nullable (mirror/soft-tilt ⇒ null, hard-gate ⇒ non-null, §5.2 RPC가 강제).
  gate_eligible_size int,
  run_id text not null,
  run_date timestamptz not null,
  status text not null default 'logged' check (status in ('logged','invalid_input','incomplete_run')),
  error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  -- 0028 contract mirror: 150 distinct per (period_key,arm); 50×3 disjoint bucket-rank
  constraint shadow_uniq_period_arm_ticker unique (period_key, arm, ticker),
  constraint shadow_uniq_period_arm_bucket_rank unique (period_key, arm, bucket, rank)
);

-- (2) full-universe ranked snapshot (하드게이트 counterfactual + recall 분모 입력)
create table if not exists public.tier0_shadow_universe_snapshot (
  id uuid primary key default gen_random_uuid(),
  period_key text not null check (
    period_key ~ '^\d{4}-\d{2}$' or period_key ~ '^\d{4}-W\d{2}$'
  ),
  month date not null check (extract(day from month) = 1),
  run_id text not null,
  ticker text not null check (ticker ~ '^[0-9]{6}$'),
  name text,
  sector text not null check (           -- 현재맵 스냅샷(PIT forward 누적)
    sector in ('바이오','반도체','건설','금융','2차전지','자동차','IT/SW',
               '유통/소비재','에너지','엔터/미디어','통신','철강/소재','운송/물류','보험/증권','unresolved')
  ),
  sector_source text check (sector_source in ('override','mapper','unresolved')),
  induty_code text,
  sector_view jsonb not null default '{"source":"absent","leadingSectors":[]}'::jsonb,
  bucket text not null check (bucket in ('short','mid','long')),
  rank int check (rank is null or rank >= 1), -- full-universe rank within bucket, not candidate 1..50 rank
  tier0_score numeric,
  universe_hash text not null,
  -- ONE row per (ticker, bucket): the universe of N tickers emits up to 3N rows.
  -- universe_size = N (DISTINCT tickers), NOT total rows. Validation: jsonb_array_length(rows) ≈ 3N ≥ N,
  -- and count(distinct ticker) == universe_size. The recall denominator (§6.2) dedups to distinct ticker.
  universe_size int not null check (universe_size >= 150),
  run_date timestamptz not null,
  created_at timestamptz not null default now(),
  constraint shadow_universe_uniq unique (period_key, run_id, ticker, bucket)
);

-- (3) unresolved 진단 (B89 relaxation, informational)
-- columns are a subset of the universe snapshot (sector_source='unresolved'); it COULD be a view, but is kept as a
-- separate table deliberately for write-isolation / diagnostic-stream decoupling (FIX-I).
create table if not exists public.tier0_shadow_unresolved_issues (
  id uuid primary key default gen_random_uuid(),
  period_key text not null check (
    period_key ~ '^\d{4}-\d{2}$' or period_key ~ '^\d{4}-W\d{2}$'
  ),
  month date not null check (extract(day from month) = 1),
  run_id text not null,
  ticker text not null check (ticker ~ '^[0-9]{6}$'),
  name text,
  induty_code text,
  sector_source text not null check (sector_source in ('override','mapper','unresolved')),
  created_at timestamptz not null default now(),
  constraint shadow_unresolved_uniq unique (period_key, run_id, ticker)
);

alter table public.tier0_shadow_sector_hypothesis   enable row level security;
alter table public.tier0_candidates_150_shadow      enable row level security;
alter table public.tier0_shadow_universe_snapshot   enable row level security;
alter table public.tier0_shadow_unresolved_issues   enable row level security;

-- grant 패턴 (feedback_supabase_security_definer_pattern + T2-I-6 production K=0):
-- revoke all → authenticated만 SELECT(RLS admin gate). service_role은 SELECT조차 부여 안 함
-- (production cron/server-action가 service_role로 shadow를 우연히 read→오염하는 경로를 DB-layer로 차단).
-- shadow write는 전부 SECURITY DEFINER RPC(owner=migration 적용자) 경유 → service_role엔 RPC EXECUTE만.
do $$
declare t text;
begin
  foreach t in array array[
    'tier0_shadow_sector_hypothesis','tier0_candidates_150_shadow',
    'tier0_shadow_universe_snapshot','tier0_shadow_unresolved_issues'
  ] loop
    execute format('revoke all on table public.%I from public', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('revoke all on table public.%I from service_role', t);    -- SELECT 포함 전부 revoke
    execute format('grant select on table public.%I to authenticated', t);   -- RLS admin gate (UI read만)
    -- ⚠️ service_role SELECT grant 의도적 부재 (T2-I-6): production 경로가 shadow를 못 읽게 DB-layer 봉쇄.
    --    write는 DEFINER RPC(owner 권한)로 동작하므로 service_role table grant 불필요.
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_admin())',
      t || ' admin select', t
    );
  end loop;
end $$;

-- INTERNAL helper (Round 4 FIX-G): `_shadow_write_candidates` accepts exactly ONE arm payload produced by
-- `upsert_tier0_shadow_run` while the public finalize payload carries `arms[]`. It is un-granted to every role and
-- reachable ONLY from inside the DEFINER finalize RPC. The standalone authz preamble below is redundant once called
-- only from the finalize RPC (which already gates authz) and may be dropped; the validation body is what matters.
-- SECURITY DEFINER, owner = migration 적용자.
create or replace function public._shadow_write_candidates(p_arm_payload jsonb)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role text;
  v_period_key text;
  v_month_input text;
  v_month date;
  v_arm text;
  v_bucket text;
  v_hash text;
  v_run_id text;
  v_hypothesis_id uuid;
  v_universe_size int;
  v_gate_eligible_size int;
  v_status text;
  v_created_by uuid;
  v_count int;
  v_sector_source text;
begin
  if p_arm_payload is null or jsonb_typeof(p_arm_payload) <> 'object' then
    raise exception 'payload_must_be_object';
  end if;

  -- authz: stage 0 = service_role only. admin replay UI는 별도 PR에서 grant + caller spec.
  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then raise exception 'auth_unavailable'; end if;
    if not public.is_admin() then raise exception 'admin_required'; end if;
    v_created_by := auth.uid();
  end if;

  v_period_key := p_arm_payload->>'period_key';
  v_month_input := p_arm_payload->>'month';
  if nullif(v_period_key,'') is null then v_period_key := v_month_input; end if; -- monthly shorthand only
  v_arm := p_arm_payload->>'arm';
  v_hash := p_arm_payload->>'universe_hash';
  v_run_id := p_arm_payload->>'run_id';
  v_hypothesis_id := nullif(p_arm_payload->>'hypothesis_id','')::uuid;
  v_universe_size := nullif(p_arm_payload->>'universe_size','')::int;
  v_gate_eligible_size := nullif(p_arm_payload->>'gate_eligible_size','')::int;
  v_status := coalesce(p_arm_payload->>'status','logged');
  v_sector_source := coalesce(p_arm_payload#>>'{sector_view,source}', 'absent');

  if v_period_key is null or not (v_period_key ~ '^\d{4}-\d{2}$' or v_period_key ~ '^\d{4}-W\d{2}$') then
    raise exception 'bad_period_key';
  end if;
  if v_month_input ~ '^\d{4}-\d{2}$' then
    v_month := (v_month_input || '-01')::date;
  elsif v_month_input ~ '^\d{4}-\d{2}-01$' then
    v_month := v_month_input::date;
  else
    raise exception 'bad_month';
  end if;
  if v_period_key ~ '^\d{4}-\d{2}$' and v_period_key <> to_char(v_month, 'YYYY-MM') then
    raise exception 'period_month_mismatch';
  end if;
  if v_arm not in ('production-mirror','sector-soft-tilt','sector-hard-gate') then raise exception 'bad_arm'; end if;
  if v_arm = 'sector-hard-gate' and (v_gate_eligible_size is null or v_gate_eligible_size < 0) then
    raise exception 'gate_eligible_size_required_for_hard_gate';
  end if;
  if v_arm <> 'sector-hard-gate' and v_gate_eligible_size is not null then
    raise exception 'gate_eligible_size_only_for_hard_gate';
  end if;
  if nullif(v_hash,'') is null then raise exception 'universe_hash_required'; end if;   -- parity 강제
  if nullif(v_run_id,'') is null then raise exception 'run_id_required'; end if;
  if v_universe_size is null or v_universe_size < 150 then raise exception 'bad_universe_size'; end if;
  if v_hypothesis_id is null then raise exception 'hypothesis_id_required'; end if;
  if not exists (
    select 1 from public.tier0_shadow_sector_hypothesis h
    where h.id = v_hypothesis_id and h.period_key = v_period_key
  ) then raise exception 'hypothesis_not_registered'; end if;
  if v_status not in ('logged','invalid_input','incomplete_run') then raise exception 'bad_status'; end if;
  if v_sector_source not in ('absent','manual_pre_registered') then raise exception 'bad_sector_source'; end if;
  if v_sector_source = 'manual_pre_registered' then
    if jsonb_array_length(coalesce(p_arm_payload#>'{sector_view,leadingSectors}', '[]'::jsonb)) = 0 then
      raise exception 'leading_sectors_required';
    end if;
    if nullif(p_arm_payload#>>'{sector_view,asOf}', '') is null then raise exception 'sector_asof_required'; end if;
    perform (p_arm_payload#>>'{sector_view,asOf}')::timestamptz;
  end if;
  -- canonical-14 enum 가드 (SQL == canonical-sectors.ts; §5.4 parity 검증)
  if exists (
    select 1 from jsonb_array_elements_text(coalesce(p_arm_payload#>'{sector_view,leadingSectors}', '[]'::jsonb)) s(sec)
    where s.sec not in ('바이오','반도체','건설','금융','2차전지','자동차','IT/SW',
                        '유통/소비재','에너지','엔터/미디어','통신','철강/소재','운송/물류','보험/증권')
  ) then raise exception 'bad_canonical_sector'; end if;
  if pg_column_size(p_arm_payload) > 8 * 1024 * 1024 then raise exception 'payload_too_large'; end if;

  -- 150 contract: rows 배열 == 150, bucket당 50, distinct ticker (status=logged일 때)
  if v_status = 'logged' then
    -- fail-closed: logged candidates require a complete matching full-universe snapshot first.
    if not exists (
      select 1
      from public.tier0_shadow_universe_snapshot s
      where s.period_key = v_period_key
        and s.run_id = v_run_id
        and s.universe_hash = v_hash
        and s.universe_size = v_universe_size
      group by s.period_key, s.run_id, s.universe_hash, s.universe_size
      having count(distinct s.ticker) = v_universe_size
    ) then raise exception 'matching_complete_snapshot_required'; end if;
    if coalesce(jsonb_typeof(p_arm_payload->'rows'),'null') <> 'array' then raise exception 'rows_must_be_array'; end if;
    if jsonb_array_length(p_arm_payload->'rows') <> 150 then raise exception 'rows_count_must_be_150'; end if;
    if (select count(distinct e->>'ticker') from jsonb_array_elements(p_arm_payload->'rows') e) <> 150 then
      raise exception 'rows_duplicate_ticker';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_arm_payload->'rows') e
      where coalesce(e->>'ticker','') !~ '^[0-9]{6}$'
         or coalesce(e->>'bucket','') not in ('short','mid','long')
         or coalesce((e->>'rank')::int, 0) not between 1 and 50
    ) then raise exception 'row_invalid'; end if;
    foreach v_bucket in array array['short','mid','long'] loop
      if (select count(*) from jsonb_array_elements(p_arm_payload->'rows') e where e->>'bucket' = v_bucket) <> 50 then
        raise exception 'bucket_count_must_be_50:%', v_bucket;
      end if;
    end loop;
  end if;

  -- idempotent per (period_key, arm): delete then insert (set-based, 0028 mirror — shadow table만)
  delete from public.tier0_candidates_150_shadow where period_key = v_period_key and arm = v_arm;

  insert into public.tier0_candidates_150_shadow (
    period_key, month, arm, hypothesis_id, ticker, name, sector, bucket, rank, tier0_score, signal_label,
    sector_view, counterfactual_cut, sector_distribution, universe_hash, universe_size, gate_eligible_size,
    run_id, run_date, status, error, created_by
  )
  select
    v_period_key, v_month, v_arm, v_hypothesis_id,
    e->>'ticker', e->>'name', e->>'sector', e->>'bucket', (e->>'rank')::int,
    nullif(e->>'tier0_score','')::numeric, e->>'signal_label',
    coalesce(p_arm_payload->'sector_view', '{"source":"absent","leadingSectors":[]}'::jsonb),
    coalesce(p_arm_payload->'counterfactual_cut', '[]'::jsonb),
    coalesce(p_arm_payload->'sector_distribution', '{}'::jsonb),
    v_hash, v_universe_size, v_gate_eligible_size,
    v_run_id, coalesce((p_arm_payload->>'run_date')::timestamptz, now()),
    v_status, p_arm_payload->>'error', v_created_by
  from jsonb_array_elements(coalesce(p_arm_payload->'rows','[]'::jsonb)) e;

  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- INTERNAL helper (Round 3 FIX-C): renamed `_shadow_write_universe_snapshot`, un-granted; called only from finalize RPC.
-- universe snapshot writer (insert-only; hard-gate counterfactual + recall 분모)
create or replace function public._shadow_write_universe_snapshot(p_payload jsonb)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role text; v_period_key text; v_month_input text; v_month date; v_hash text; v_run_id text; v_universe_size int; v_count int;
begin
  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then raise exception 'auth_unavailable'; end if;
    if not public.is_admin() then raise exception 'admin_required'; end if;
  end if;
  v_period_key := p_payload->>'period_key'; v_month_input := p_payload->>'month'; v_hash := p_payload->>'universe_hash';
  v_run_id := p_payload->>'run_id'; v_universe_size := nullif(p_payload->>'universe_size','')::int;
  if nullif(v_period_key,'') is null then v_period_key := v_month_input; end if;
  if v_period_key is null or not (v_period_key ~ '^\d{4}-\d{2}$' or v_period_key ~ '^\d{4}-W\d{2}$') then
    raise exception 'bad_period_key';
  end if;
  if v_month_input ~ '^\d{4}-\d{2}$' then
    v_month := (v_month_input || '-01')::date;
  elsif v_month_input ~ '^\d{4}-\d{2}-01$' then
    v_month := v_month_input::date;
  else
    raise exception 'bad_month';
  end if;
  if v_period_key ~ '^\d{4}-\d{2}$' and v_period_key <> to_char(v_month, 'YYYY-MM') then
    raise exception 'period_month_mismatch';
  end if;
  if nullif(v_hash,'') is null then raise exception 'universe_hash_required'; end if;
  if nullif(v_run_id,'') is null then raise exception 'run_id_required'; end if;
  if v_universe_size is null or v_universe_size < 150 then raise exception 'bad_universe_size'; end if;
  if coalesce(jsonb_typeof(p_payload->'snapshot_rows'),'null') <> 'array' then raise exception 'snapshot_rows_must_be_array'; end if;
  if jsonb_array_length(p_payload->'snapshot_rows') < v_universe_size then raise exception 'snapshot_rows_lt_universe_size'; end if;
  if (select count(distinct e->>'ticker') from jsonb_array_elements(p_payload->'snapshot_rows') e) <> v_universe_size then
    raise exception 'snapshot_distinct_ticker_mismatch';
  end if;

  delete from public.tier0_shadow_universe_snapshot where period_key = v_period_key and run_id = v_run_id;
  insert into public.tier0_shadow_universe_snapshot (
    period_key, month, run_id, ticker, name, sector, sector_source, induty_code, sector_view,
    bucket, rank, tier0_score, universe_hash, universe_size, run_date
  )
  select v_period_key, v_month, v_run_id, e->>'ticker', e->>'name', e->>'sector',
         e->>'sector_source', e->>'induty_code',
         coalesce(p_arm_payload->'sector_view', '{"source":"absent","leadingSectors":[]}'::jsonb),
         e->>'bucket',
         nullif(e->>'rank','')::int, nullif(e->>'tier0_score','')::numeric,
         v_hash, v_universe_size, coalesce((p_arm_payload->>'run_date')::timestamptz, now())
  from jsonb_array_elements(p_payload->'snapshot_rows') e;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- INTERNAL helper (Round 3 FIX-C): renamed `_shadow_write_unresolved`, un-granted; called only from finalize RPC.
-- unresolved 진단 writer (insert-only; B89 relaxation, informational). diagnostic이 business row와 페이로드에서 섞이지 않음.
create or replace function public._shadow_write_unresolved(p_payload jsonb)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role text; v_period_key text; v_month_input text; v_month date; v_run_id text; v_count int;
begin
  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then raise exception 'auth_unavailable'; end if;
    if not public.is_admin() then raise exception 'admin_required'; end if;
  end if;
  v_period_key := p_payload->>'period_key'; v_month_input := p_payload->>'month'; v_run_id := p_payload->>'run_id';
  if nullif(v_period_key,'') is null then v_period_key := v_month_input; end if;
  if v_period_key is null or not (v_period_key ~ '^\d{4}-\d{2}$' or v_period_key ~ '^\d{4}-W\d{2}$') then
    raise exception 'bad_period_key';
  end if;
  if v_month_input ~ '^\d{4}-\d{2}$' then
    v_month := (v_month_input || '-01')::date;
  elsif v_month_input ~ '^\d{4}-\d{2}-01$' then
    v_month := v_month_input::date;
  else
    raise exception 'bad_month';
  end if;
  if v_period_key ~ '^\d{4}-\d{2}$' and v_period_key <> to_char(v_month, 'YYYY-MM') then
    raise exception 'period_month_mismatch';
  end if;
  if coalesce(jsonb_typeof(p_payload->'unresolved_rows'),'null') <> 'array' then raise exception 'unresolved_rows_must_be_array'; end if;
  if nullif(v_run_id,'') is null then raise exception 'run_id_required'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'unresolved_rows') e
    where coalesce(e->>'ticker','') !~ '^[0-9]{6}$'
       or coalesce(e->>'sector_source','') not in ('override','mapper','unresolved')
  ) then raise exception 'unresolved_row_invalid'; end if;

  delete from public.tier0_shadow_unresolved_issues where period_key = v_period_key and run_id = v_run_id;   -- idempotent per period/run
  insert into public.tier0_shadow_unresolved_issues (period_key, month, run_id, ticker, name, induty_code, sector_source)
  select v_period_key, v_month, v_run_id, e->>'ticker', e->>'name', e->>'induty_code', e->>'sector_source'
  from jsonb_array_elements(p_payload->'unresolved_rows') e;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- (4) SINGLE ATOMIC FINALIZE RPC — the only granted write deliverable (Round 3/4 HIGH fix).
-- one transaction, one shared run_id: hypothesis check → snapshot_rows insert → ALL active arms candidates insert → unresolved_rows insert.
-- The three writers above become INTERNAL helpers (un-granted); only this RPC gets service_role EXECUTE.
create or replace function public.upsert_tier0_shadow_run(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role text;
  v_period_key text;
  v_run_id text;
  v_hypothesis_id uuid;
  v_sector_source text;
  v_hypothesis record;
  v_registered_sector_view jsonb;
  v_snap_count int;
  v_cand_count int := 0;
  v_one_count int;
  v_unres_count int;
  v_arm jsonb;
  v_arm_payload jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'payload_must_be_object'; end if;
  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then raise exception 'auth_unavailable'; end if;
    if not public.is_admin() then raise exception 'admin_required'; end if;
  end if;

  v_period_key := coalesce(nullif(p_payload->>'period_key',''), p_payload->>'month');
  v_run_id := p_payload->>'run_id';
  v_hypothesis_id := nullif(p_payload->>'hypothesis_id','')::uuid;
  v_sector_source := coalesce(p_payload#>>'{sector_view,source}', 'absent');
  if nullif(v_run_id,'') is null then raise exception 'run_id_required'; end if;
  if v_hypothesis_id is null then raise exception 'hypothesis_id_required'; end if;
  if coalesce(jsonb_typeof(p_payload->'snapshot_rows'),'null') <> 'array' then raise exception 'snapshot_rows_required'; end if;
  if coalesce(jsonb_typeof(p_payload->'arms'),'null') <> 'array' then raise exception 'arms_required'; end if;
  if jsonb_array_length(p_payload->'arms') < 1 or jsonb_array_length(p_payload->'arms') > 3 then raise exception 'bad_arm_count'; end if;
  if coalesce(jsonb_typeof(p_payload->'unresolved_rows'),'null') <> 'array' then raise exception 'unresolved_rows_required'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'arms') a
    where coalesce(a->>'arm','') not in ('production-mirror','sector-soft-tilt','sector-hard-gate')
  ) then raise exception 'bad_arm'; end if;
  if (select count(*) from jsonb_array_elements(p_payload->'arms')) <>
     (select count(distinct a->>'arm') from jsonb_array_elements(p_payload->'arms') a) then
    raise exception 'duplicate_arm';
  end if;
  if exists (select 1 from jsonb_array_elements(p_payload->'arms') a where a->>'arm' <> 'production-mirror')
     and not exists (select 1 from jsonb_array_elements(p_payload->'arms') a where a->>'arm' = 'production-mirror') then
    raise exception 'production_mirror_required_for_paired_run';
  end if;

  -- (0) hypothesis existence + immutable content binding.
  select h.* into v_hypothesis
  from public.tier0_shadow_sector_hypothesis h
  where h.id = v_hypothesis_id and h.period_key = v_period_key;
  if not found then raise exception 'hypothesis_not_registered'; end if;
  if v_hypothesis.source <> v_sector_source then raise exception 'hypothesis_source_mismatch'; end if;
  if v_hypothesis.source = 'absent' then
    if v_hypothesis.leading_sectors <> '[]'::jsonb or v_hypothesis.params <> '{}'::jsonb or v_hypothesis.as_of is not null then
      raise exception 'bad_absent_hypothesis';
    end if;
  end if;
  -- Derive persisted metadata from the registered hypothesis row, not from caller-provided copies. This closes the
  -- p-hack hole where a caller references a valid manual hypothesis id but sends different sectors/asOf/params.
  v_registered_sector_view := jsonb_build_object(
    'source', v_hypothesis.source,
    'leadingSectors', v_hypothesis.leading_sectors,
    'asOf', v_hypothesis.as_of,
    'selectionAsOf', v_hypothesis.selection_as_of,
    'params', v_hypothesis.params,
    'hypothesisHash', v_hypothesis.hypothesis_hash
  );
  if (p_payload ? 'sector_view') and p_payload->'sector_view' <> v_registered_sector_view then
    raise exception 'hypothesis_content_mismatch';
  end if;
  p_payload := jsonb_set(p_payload, '{sector_view}', v_registered_sector_view, true);

  -- (1) universe snapshot first → (2) ALL active arms candidates → (3) unresolved.
  -- All writes occur in this one transaction and share (period_key, run_id). Arm omission is authoritative: delete
  -- stale period-level candidates before reinserting active arms, so old arm rows cannot be accidentally paired.
  delete from public.tier0_candidates_150_shadow where period_key = v_period_key;
  v_snap_count := public._shadow_write_universe_snapshot(p_payload);          -- uses p_payload.snapshot_rows
  for v_arm in select value from jsonb_array_elements(p_payload->'arms') loop
    -- SECURITY (run-level authority, PR-B2 FIX-A): run-level keys MUST win over any same-named key an arm
    --   object injects → `v_arm || run_level` (run-level on the RIGHT wins). The reverse order
    --   (`run_level || v_arm`) would let a malicious/buggy arm override run_id/universe_hash/universe_size/
    --   hypothesis_id/sector_view — dodging universe_size>=150, breaking candidates.run_id==snapshot.run_id
    --   pairing, or forging sector_view past content-binding. Per-arm keys (arm/status/rows/counterfactual_cut/
    --   sector_distribution/gate_eligible_size/error) are disjoint from run-level keys, so they survive.
    v_arm_payload := v_arm || (p_payload - 'arms' - 'snapshot_rows' - 'unresolved_rows');
    v_one_count := public._shadow_write_candidates(v_arm_payload);            -- uses this arm's rows
    v_cand_count := v_cand_count + v_one_count;
  end loop;
  v_unres_count := public._shadow_write_unresolved(p_payload);                -- uses p_payload.unresolved_rows

  return jsonb_build_object('run_id', v_run_id, 'snapshot', v_snap_count,
                            'candidates', v_cand_count, 'unresolved', v_unres_count,
                            'arms', jsonb_array_length(p_payload->'arms'));
end; $$;

-- function grants: ONLY the finalize RPC is service_role-EXECUTE. The 3 per-table writers are INTERNAL helpers
-- (renamed to _shadow_write_*; un-granted to every role — reachable only from inside the DEFINER finalize RPC).
revoke all on function public.upsert_tier0_shadow_run(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.upsert_tier0_shadow_run(jsonb) to service_role;
revoke all on function public._shadow_write_universe_snapshot(jsonb) from public, anon, authenticated, service_role;
revoke all on function public._shadow_write_candidates(jsonb) from public, anon, authenticated, service_role;
revoke all on function public._shadow_write_unresolved(jsonb) from public, anon, authenticated, service_role;
commit;
```

> **write/finalize contract(Round 3/4 HIGH fix — single atomic all-arms RPC)**: deliverable = **단일 `upsert_tier0_shadow_run(p_payload)`** SECURITY DEFINER finalize RPC. `p_payload`는 run-level envelope이며 `snapshot_rows`(full universe), `arms[]`(각 arm별 `rows` 150 또는 `status=incomplete_run/invalid_input`), `unresolved_rows`를 분리한다. 이 RPC가 하나의 transaction + 하나의 shared `run_id`로 (0) hypothesis source+existence 검증 → (1) full-universe snapshot insert → (2) **active arms 전체** candidates insert(loop) → (3) unresolved insert를 처리한다. 위 3 writer는 **INTERNAL helper `_shadow_write_*`**(어떤 role에도 grant 없음, finalize RPC 내부에서만 호출)로 격하되고 **`service_role` EXECUTE는 `upsert_tier0_shadow_run`에만** 부여한다. `sector-soft-tilt`/`sector-hard-gate`가 payload에 있으면 same payload에 `production-mirror`가 필수이고, duplicate arm은 reject한다. completeness guard가 candidates와 snapshot을 같은 transaction 안에서 동일 `(period_key, run_id)`로 묶으므로 orphan snapshot과 partially logged active-arm set이 불가능하다(`candidates.run_id == snapshot.run_id` 강제). finalize는 해당 `period_key`의 stale candidate rows를 transaction 안에서 삭제 후 active arms만 재삽입하므로 이전 run의 omitted arm이 Gate A에 섞이지 않는다. 중간 실패 run은 transaction rollback으로 어떤 row도 남기지 않으며, n_periods/parity 미달은 evaluator 단계에서 `INCOMPLETE_RUN`. Python `run_shadow_bpp_generation_path`는 shared `run_id`/`hypothesis_id`와 모든 active arm을 단일 payload에 넣고, unresolved가 0건이면 `unresolved_rows: []`로 전달한다. RPC owner = migration 적용자.
> **read/evaluator contract(FIX-J)**: `tier0_candidates_150_shadow`는 latest-only per `(period_key, arm)`이다(재실행 시 stale candidates 삭제). `tier0_shadow_universe_snapshot`은 audit/replay를 위해 run_id별 rows가 남을 수 있다. 따라서 Stage 1 evaluator/admin read helper는 candidate rows에서 `run_id`를 읽고 snapshot/unresolved를 반드시 `(period_key, run_id)`로 join한다. period-only snapshot join 또는 latest-snapshot 추정은 `INVALID_INPUT`; smoke에서 오래된 snapshot run이 남아도 current candidate run과 섞이지 않음을 검증한다.

### 5.3 rollback SQL sketch
```sql
begin;
-- rollback: 0039 — deletes all Track 2 shadow observations. Production tables untouched.
drop function if exists public.upsert_tier0_shadow_run(jsonb);            -- single finalize RPC
drop function if exists public._shadow_write_candidates(jsonb);           -- internal helper
drop function if exists public._shadow_write_universe_snapshot(jsonb);    -- internal helper
drop function if exists public._shadow_write_unresolved(jsonb);           -- internal helper
drop table if exists public.tier0_shadow_sector_hypothesis cascade;
drop table if exists public.tier0_candidates_150_shadow cascade;
drop table if exists public.tier0_shadow_universe_snapshot cascade;
drop table if exists public.tier0_shadow_unresolved_issues cascade;
commit;
```

### 5.4 required migration smoke (USER apply 후)
- 4 신규 table 존재 + RLS enabled. production `tier0_candidates_150` / `short_list_30` 무변경(스키마 diff 0).
- anon table access denied. authenticated non-admin SELECT denied(RLS); admin SELECT allowed.
- **`service_role` SELECT도 denied(T2-I-6, FIX-I a)** — **REAL PostgREST/service-role connection**(production cron이 쓰는 동일 key)으로 `select … from tier0_candidates_150_shadow` → permission denied를 4 shadow table 모두에서 검증한다. **`set role`은 사용하지 않는다**(실 연결의 권한 경로를 우회하므로). 추가로 **migration 적용 후 `ALTER DEFAULT PRIVILEGES … TO service_role`가 신규 public table에 SELECT를 재부여하지 않았음을 단언**한다 — Supabase는 신규 public table에 `service_role` default-grant를 부여하므로 명시 revoke가 그래서 필요하다.
- `authenticated`/`service_role` 직접 INSERT/UPDATE/DELETE(RPC 우회) blocked(table-level DML grant 없음).
- **mid-run failure → 전 transaction rollback(FIX-C)**: `upsert_tier0_shadow_run`가 snapshot insert 후 candidates 단계에서 실패하면 **whole transaction이 rollback되어 orphan snapshot이 남지 않음**을 검증. 성공 run에서는 `candidates.run_id == snapshot.run_id`가 강제됨을 round-trip으로 확인(서로 다른 run_id pairing 불가).
- **all-arms atomicity(FIX-G)**: finalize payload가 `snapshot_rows` + `arms[]` + `unresolved_rows` shape가 아니면 reject. `arms[]` 내 duplicate arm reject, non-mirror arm without same-payload `production-mirror` reject. 2개 이상 active arm 중 하나가 rows_count/sector/source 검증에서 실패하면 snapshot·다른 arm·unresolved 모두 rollback. 같은 `period_key` 재실행에서 omitted old arm rows가 남지 않음을 round-trip으로 확인.
- **run_id join discipline(FIX-J)**: 동일 `period_key`에 과거 snapshot run이 남아도 evaluator/read helper가 candidate `run_id`와 같은 snapshot만 사용함을 검증. period-only snapshot join 또는 latest-snapshot 추정은 smoke 실패/`INVALID_INPUT`.
- **finalize RPC INSERT 성공 검증(FIX-C·FIX-I b)**: owner=migration 적용자로 생성된 단일 SECURITY DEFINER `upsert_tier0_shadow_run`를 service_role API caller로 호출 시 snapshot/candidates/unresolved INSERT가 **성공**(table DML grant 없이 DEFINER 권한으로 동작)함을 round-trip으로 확인.
- **RPC owner 검증(FIX-I b)**: `select pg_get_userbyid(proowner) from pg_proc where proname='upsert_tier0_shadow_run'`가 superuser(보통 `postgres`)여야 한다 — `service_role`이면 SECURITY DEFINER INSERT가 실패한다. 내부 helper `_shadow_write_*`도 동일 owner.
- **hypothesis content binding(FIX-E/FIX-H + PR-B2 FIX-B)**: finalize RPC는 등록된 hypothesis row에서 `sector_view`를 derive하여 **저장은 항상 row-derived**다. caller payload의 `sector_view`는 identity SUBSET일 수 있으므로(PR-B3는 `source`/`leadingSectors`/`hypothesisHash`만 전송) **present 필드만** row 값과 대조한다: `source`/`leadingSectors`(jsonb canonical)/`hypothesisHash`(text)/`params`(jsonb canonical)/`asOf`·`selectionAsOf`(timestamptz INSTANT 비교 — 텍스트 렌더 byte-match foot-gun 회피). 불일치 시 `hypothesis_content_mismatch`/`hypothesis_source_mismatch` raise. absent 필드는 row-derived이므로 p-hack 불가(저장값이 caller 입력을 따르지 않음). 같은 period에 `absent`와 `manual_pre_registered` hypothesis가 공존할 때(table unique key `(period_key,source,hypothesis_hash)`), manual payload가 absent hypothesis_id를 참조하면 거부됨을 검증. **register_shadow_hypothesis도 같은 (period_key,source,hash)에 다른 content면 `hypothesis_hash_content_mismatch`로 reject**(append-only 무결성).
- RPC(`upsert_tier0_shadow_run` + 3 internal helper) 모두 `prosecdef=true` + `search_path=public, pg_temp`. EXECUTE: `upsert_tier0_shadow_run`만 service_role=true; 3 internal helper는 public/anon/authenticated/service_role 전부 false(finalize RPC 내부에서만 호출).
- immutable hypothesis: same `period_key` hypothesis update/delete API 없음; changed `leading_sectors`/`params`는 새 `hypothesis_hash`/id만 가능; `as_of >= selection_as_of` 거부. `absent` hypothesis는 `leading_sectors=[]`, `params={}`, `as_of is null` 외 shape 거부.
- 150 contract: rows≠150 / duplicate ticker / bucket≠50 / rank 범위초과 INSERT 거부. `sector-hard-gate` arm은 `gate_eligible_size` non-null/non-negative required; mirror/soft arm의 `gate_eligible_size`는 null required. `period_key`/`month`/`run_id`/`hypothesis_id`/`universe_hash`/`universe_size` 누락 거부. monthly `period_key`와 `month` 불일치(`2026-06` vs `2026-07-01`) 거부.
- full snapshot contract: malformed ticker/sector/sector_source 거부, `count(distinct ticker)==universe_size`, sorted full ticker universe hash 재현. logged candidates before matching complete snapshot → `matching_complete_snapshot_required`.
- `(period_key,arm,ticker)` + `(period_key,arm,bucket,rank)` unique 강제. 동일 (period_key,arm) 재실행은 delete+insert idempotent(중복 미발생). 같은 month 안의 future weekly `period_key`들은 서로 overwrite하지 않음.
- **SQL의 14-섹터 enum(`bad_canonical_sector` + table CHECK) == `canonical-sectors.ts::CANONICAL_SECTORS`** (14개, 순서무관 set 비교 — Python `CANONICAL_SECTORS`도 1:1). 구현 시점 1회 + 이후 `canonical-sectors.ts` 변경 시마다 재검증(silently divergent하면 정상 섹터를 `bad_canonical_sector`로 거부).
- shadow table `sector` CHECK는 canonical-14 ∪ `'unresolved'`(production은 canonical-14 only) — 차이 의도적(§3.5).
- `tier0_shadow_universe_snapshot`이 `sector_view`/`sector_source`/`induty_code`를 저장하고, `counterfactual_cut`/`sector_distribution` jsonb가 candidates row에서 PostgREST round-trip됨.
- `production-mirror` arm과 persisted `tier0_candidates_150`의 **selection-identity** parity smoke(동일 month·ticker, set-equality of `{(ticker,bucket,rank)}` + `round(tier0_score,2)` 일치; **sector/name/signal_label EXCLUDE** — current-only drift이므로 parity 실패 아님, §3.8 point 2) 없이는 **SECONDARY**(vs-persisted-150) Gate A 입력으로 사용하지 않음. ★#1(B++=production scorer) 적용 전에는 이 parity가 INCOMPLETE_RUN이며 PRIMARY arm-vs-mirror lift만 사용.
- rollback 파일이 0039 artifact만 drop(finalize RPC + 3 internal helper + 4 table).

---

## §6 Forward recall measurement (REUSE `validate_tier0_ic.py`, stage 1+)

stage 0은 **생성·로깅만**. PASS/FAIL 산출·claim unblock 금지. 아래는 PR-B5가 별도 spec에서 실행 가능하게 구체화해야 할 검정 요구조건이며, forward n_periods floor 미달 시 어떤 verdict도 금지한다.

### 6.1 unit of analysis & forward floor
Primary unit = `(arm, track, horizon, period_key)`. short=weekly(`n_periods ≥ 6`), midlong=monthly(`n_periods ≥ 6`) 전 verdict 금지. ⇒ **short 6주+, midlong 6개월+ 누적 필요**(정직한 느림, §0.2). 누적 타임라인 acceptance는 §12 선결.

### 6.2 winners 독립 도출 (paired 비교의 핵심)
`validate_tier0_ic.py::top_decile_winners`(≈264–275)는 **universe-wide forward-return dict**를 받아 winner를 선정과 **독립적으로** 도출한다(top-decile q=0.90 AND positive). 분모 = `|winners|`.

forward 엔진 재사용(REUSE, 추가 AI/forward 비용 0):
1. `compute_forward_return`(≈225–261): entry = `t+ENTRY_OFFSET`(t+1 종가, **same-bar-bias-free**, hard-coded ENTRY_OFFSET_DAYS=1) → entry+horizon 종가. halt(gap) vs delisting(delisted) 구분. shadow와 production이 **동일 entry_offset** 사용(공정 비교).
2. winner 분모는 **full-universe forward returns**에서 도출(`tier0_shadow_universe_snapshot`이 universe-wide 종목 제공) — production-150도 shadow-150도 못 잡은 외부 리더가 분모에 포함되어야 recall이 정직(gotcha: shadow-150만 먹이면 외부 리더 누락). candidate rows의 `run_id`와 동일한 `(period_key, run_id)` snapshot만 사용한다; period-only snapshot join은 stale cross-run pairing 위험 때문에 금지.
3. **동일 winner 집합을 두 selection에 재사용** — winner를 shadow-150 forward로 재도출하지 않음.
4. **PRIMARY metric** = `recall(soft-tilt/hard-gate) − recall(production-mirror)`: 둘 다 같은 shadow run의 B++ arm이므로 production이 무엇을 persist하든 **period 1부터 forward-valid**(★#1 무관). **SECONDARY metric** = vs persisted `tier0_candidates_150`: `production-mirror` arm이 같은 `period_key`/`month`의 persisted production과 **selection-identity parity**(§3.8 point 2)일 때만 채택하고, production scorer가 B++가 아닌 현재는(★#1 미적용) 모든 period에서 `INCOMPLETE_RUN`이다. production table에 `universe_hash`가 없으므로 이 확인이 SECONDARY paired 비교의 load-bearing guard다.

> **note(FIX-I)**: `top_decile_winners`는 **non-NaN forward returns로만 필터**한다. missing/halt/delisting으로 수익률이 없는 ticker는 winner와 분모 양쪽에서 **제외**되며 0/임의값으로 대체하지 않는다(§6.5 no-replacement와 일관).

### 6.3 paired recall (gate_a_recall 두 번 호출)
`gate_a_recall`(≈349–381)은 transport-agnostic. 실 시그니처는 keyword-only `largemid_selected`, `largemid_winners`, `leader_basket`을 **추가로 REQUIRE**(default 없음)한다. **같은 winner 집합으로 두 번 호출**:
```
# SHARED frozen-across-arms denominators (양 arm 동일): winners_all, winners_by_horizon,
#   universe_size, largemid_winners, leader_basket — production-mirror·shadow 두 호출에서 IDENTICAL.
# per-arm으로만 변하는 입력: selected_all, selected_by_horizon, largemid_selected.
# leader_basket = pre-registered fixed basket (code: LEADER_BASKET_2026_06), 두 arm에서 동일 object.
prod_report   = gate_a_recall(
    selected_all=production_mirror_selected, selected_by_horizon=prod_by_horizon,
    winners_all=winners_all, winners_by_horizon=winners_by_horizon, universe_size=universe_size,
    largemid_selected=prod_largemid_selected, largemid_winners=largemid_winners, leader_basket=leader_basket)
shadow_report = gate_a_recall(
    selected_all=shadow_150_selected, selected_by_horizon=shadow_by_horizon,
    winners_all=winners_all, winners_by_horizon=winners_by_horizon, universe_size=universe_size,
    largemid_selected=shadow_largemid_selected, largemid_winners=largemid_winners, leader_basket=leader_basket)
# winners_all / winners_by_horizon / universe_size / largemid_winners / leader_basket 동일(공유 분모).
# 오직 selected_all / selected_by_horizon / largemid_selected (numerator)만 arm마다 변함.
primary_metric = shadow_report.overall - prod_report.overall   # recall lift, CI90 over periods
```
- 분모(`winners_all`·`largemid_winners`·`leader_basket`)는 두 호출 간 **불변**. 공정 비교.
- `universe_size`는 production universe_size(공정 random_baseline). `sector-hard-gate`는 universe 절단해도 분모는 full-universe 유지 → recall 하락이 정직하게 드러남.
- `aggregate_harvest`(≈1567–2039)로 period pool → triple-gate. `harvest_pit_months`(≈2042–2150) 오케스트레이션. `process_month`(≈1148–1396)에 secondary_selected 주입(harness 일반화, reuse_for_track2 Option 3) 또는 post-process(Option 1).

### 6.4 하드게이트 counterfactual report (Track 2 고유)
`sector-hard-gate` arm: `counterfactual_cut`(게이트가 자른 종목) ∩ `winners`(forward 리더) = **"게이트가 잘라낸 리더"**를 정량 보고. production 하드게이트가 영구 금지인 이유를 forward 데이터로 실증(R2 비가시성 문제를 shadow에서 가시화).

### 6.5 same-count random null & missing/stale
- 사전등록: universe = 같은 period·track·horizon의 full-universe(`tier0_shadow_universe_snapshot`). count = **각 arm의 ACTUAL realized 150-selected count per (track,horizon)**: production-mirror/soft-tilt는 구성상 50, hard-gate는 절단 후 sleeve를 못 채우면 `INCOMPLETE_RUN`으로 제외(50 가정 금지). short horizon 50, mid horizon 50, long horizon 50, midlong combined 100 where applicable. 이것은 **150-selection bucket count**이며 final-30의 10-per-bucket count가 아니다(후자는 Track 2 150-recall null이 아니므로 금지). no replacement. seed는 kill-rule 파일에 commit. random row 재현 = `(period_key, track, horizon, seed, universe_hash)`.
- baseline = 강건한 clean baseline(equal-rank 등, eligible-universe scoped). gotcha: baseline은 selected와 동일 eligible-universe(ADV floor) scoped여야 공정 — shadow-150이 저유동성 set이면 baseline이 다르게 축소되어 unfair 비교 위험.
- verdict abort = INCOMPLETE_RUN: `n_periods` 미달 / 검정 arm 누락 / forward 데이터 부족(`insufficient`) / `run_date`·`sector asOf` stale / random 재현 불가 / `universe_hash` 불일치 / complete snapshot 부재 / immutable hypothesis mismatch / **(SECONDARY only)** `production-mirror`↔persisted production selection-identity parity 실패·production row 부재·★#1 미적용 / **tilt/gate arm with `sector_view.source==absent`** → plumbing-only, recall-lift verdict에서 제외(lift가 구조적으로 0이며, 이는 "섹터 효과 없음"의 증거가 **아님**).
- survivorship: PIT panel(KRX bydd_trd snapshot)은 survivorship-clean 가정. `probe_pit_survivorship.py`로 검증 전 "forward winner" claim 금지. delisted 종목이 panel에 없으면 `survivorship-biased: recall=upper-bound` 표기.
- PIT cache 누수 가드(`feedback_pit_backtest_cache_availability`): backtest 모드 cache HIT은 availability date(`rcept_dt ≤ as_of`) 검증 필수, 없으면 fail-closed. **단 Track 2는 forward-only이므로 backtest 모드 자체를 안 씀** — 이 가드는 혹시라도 PIT 재현(forward 누적 후 과거 재검) 시에만 적용.

### 6.6 gates
| Gate | Rule | Fail/abort |
|---|---|---|
| A **shadow-150 recall lift** | **PRIMARY (always forward-valid, ★#1 무관)**: `recall(shadow soft-tilt/hard-gate) − recall(production-mirror)` on **SAME forward winners**, CI90 lower>0 — 같은 run의 두 B++ arm 비교. **SECONDARY (monthly-only, ★#1 게이트)**: vs persisted production-150, production-mirror가 selection-identity parity match일 때만; ★#1(B++=production scorer) 미적용 시 INCOMPLETE_RUN | PRIMARY: CI lower≤0 / random row 부재 / universe_hash 불일치 / snapshot·hypothesis 부재 → FAIL/INCOMPLETE. SECONDARY: production parity 실패·row 부재·★#1 미적용 → INCOMPLETE |
| B rank skill | IC IR ≥ 0.30 on same unit(arm,track,horizon) | p 부재 또는 0.05<p<0.15 → ADJUDICATE |
| C size/coverage | sleeve/coverage metadata 있을 때만; 없으면 NOT_APPLICABLE(≠PASS) | metadata 없이 sleeve discipline 주장 → INVALID_INPUT |
| FWER | per-arm α를 동시검정 arm×track×horizon 수로 보정 | 단일 arm/period pass는 PASS 아님 |

> **Gate A는 진짜 150-recall(시장 리더 포착)을 측정한다** — Track 1과 결정적 차이. 단 verdict는 forward n_periods floor + winner 분모 universe-wide + survivorship probe 통과 후에만 유효. `triple_gate=true`는 적용 가능 게이트 전부 pass + boolean이 게이트 필드와 일치할 때만; 불일치 → `INVALID_INPUT` abort.

> **거짓 수렴 가드**(`feedback_workflow_verify_false_convergence`): dynamic workflow `converged:true`가 verify 에이전트 session-limit 실패로 거짓일 수 있음. failures/logs 확인 + raw findings 직접 추출해 메인(Opus)에서 adjudicate.

### 6.7 claim discipline
stage 1+ 유효 PASS 전까지: "상승 예측"·"outperformance"·"sector will lead"·"섹터-aware가 더 낫다" 금지. production K>0 금지(T2-I-6). shadow claim 기반 Tier1/portfolio 변경 금지. UI 어휘 "shadow 생성-단계 counterfactual 관측(검증 대기)"까지만. PASS 후에만 "shadow sector hypothesis가 recall을 X% 개선(CI Y, p Z, n_periods N)" — forward 데이터 확인 후.

---

## §7 Cost / flags

| flag | default | scope |
|---|---|---|
| `SHADOW_GENERATOR_ENABLED` | false | shadow generation path 활성(default OFF = production byte-identical) |
| `SHADOW_PERIOD_KEY` | derived from run cadence | monthly `YYYY-MM`; future weekly short `YYYY-Www`. Stored with production-compatible `month` date |
| `SHADOW_HYPOTHESIS_ID` | required for non-absent arms | immutable pre-registration row id. Generated before `selection_as_of`; candidates reference this id |
| `SHADOW_SECTOR_SOURCE` | `absent` | `absent` 또는 `manual_pre_registered`만(그 외 값은 `invalid_input`). LLM source는 별도 spec 전까지 거부 |
| `SHADOW_LEADING_SECTORS` | (empty) | `manual_pre_registered`일 때 canonical-14 set(+ asOf) |
| `SHADOW_GEN_ARMS` | `production-mirror` | 활성 arm 집합(`production-mirror`/`sector-soft-tilt`/`sector-hard-gate`) |
| `SHADOW_SOFT_TILT_PARAMS` | unset | `sector-soft-tilt` 활성 시 period 시작 전 pre-register한 `tilt_version`/numeric params. 누락/사후변경은 `INVALID_INPUT` |
| `SHADOW_LOG_FAILURE_ALERT_ENABLED` | true | best-effort pipeline health alert |

**cost rule**: stage 0의 `manual_pre_registered` source는 **LLM 호출 0**(KRX/DART 재사용, generation은 FREE). production cost path(`cost_log`)에 `armFilter` 추가 금지(T2-I-9, `cost_log`에 arm 컬럼 없음 → production spend undercount). 미래 LLM `sector_advisor`(주도섹터 자동 선정) 채택 시: hardcap 50만 내 **별도 budget/ledger** + provider 추상화(`model-registry.ts`에 role 추가는 별도 spec에서 pricing·reservation·테스트 통과 후), D28 역할별 비용 회계가 load-bearing.

**생성 비용 ≈ 0(stage 0 manual)**: shadow는 production이 이미 fetch한 universe/price/DART를 재사용하거나 동일 KRX Open API 1콜(무료 키). forward 측정도 pure Python(set 교집합 + pooling, 추가 fetch 0).

---

## §8 Python ↔ TS parity

Track 2는 **Python emit → 신규 shadow table → harness(`validate_tier0_ic.py`) + (미래) admin SELECT** 경로를 재도입하므로 parity 규율 적용:
- ticker 정렬 `/^[0-9]{6}$/` + ASCII comparator 고정(locale 회피). B++ mirror는 `select_bpp_candidates`/`TF.select_size_sleeves` 결과를 `build_bpp_candidate_rows`의 rank order와 SQL round-trip order가 normalized parity로 일치해야 함. legacy `select_candidate_pool_per_bucket` tie-break는 Track 2 B++ baseline 검증에 쓰지 않음.
- golden vector: Python `compute_shadow_selections` emit 순서 vs SQL round-trip 순서 비교, plus `production-mirror` vs persisted production **selection-identity** parity vector(set-equality of `{(ticker,bucket,rank)}` + `round(tier0_score,2)`, ε=0; **sector/name/signal_label EXCLUDE** — current-only drift은 parity 실패 아님, §3.8 point 2).
- period identity: Python payload `period_key` + `month`(`YYYY-MM-01`)가 SQL round-trip 후 production `tier0_candidates_150.month`와 join 가능해야 함. weekly short가 도입되면 `period_key`가 overwrite 방지 키, `month`는 production compatibility key.
- jsonb metadata(`sector_view`, `counterfactual_cut`, `sector_distribution`, immutable hypothesis `params`)는 PostgREST round-trip 테스트.
- canonical-14 enum: Python `CANONICAL_SECTORS` == SQL CHECK == `canonical-sectors.ts::CANONICAL_SECTORS`(14, 순서무관 set, §5.4). **PR-B1 canonical-14 parity unit test**(FIX-I): 세 소스의 set-equality를 단언하는 unit test를 PR-B1에 포함.

**stage 0 TS consumer 여부**: stage 0엔 production read 경로에 TS consumer **없음**(shadow는 production `getTier0Candidates`를 안 거침 — T2-I-2/I-6). admin이 shadow 결과를 보는 read-only view/페이지는 PR-B5 이후 선택 — **authenticated admin SELECT(RLS `is_admin()`)** 또는 task-specific 제한 RPC로만 노출하며, **production이 쓰는 `service_role` SELECT grant는 부여하지 않는다**(T2-I-6 DB 봉쇄 유지). `runTier1Screening`·`getTier0Candidates`·`model-registry.ts` 시그니처/동작 불변. production read 코드(`getTier0Candidates` 등)에 shadow table 식별자가 등장하지 않음을 grep gate로 검증(§11).

---

## §9 Simpler alternatives considered

| Alternative | Decision | Reason |
|---|---|---|
| **PIT-mechanical sector-momentum arm을 cheap backtest sanity probe로** | **Reject** | 섹터맵이 current-only artifact(§0.3): 과거 induty + live override.json 적용 = **look-ahead bias**. 과거 PIT 섹터맵·과거 LLM 출력 부재. 싼 backtest sanity probe가 **될 수 없음**. forward-only가 유일 정직 경로 |
| `tier0_candidates_150`에 `arm`/`shadow` 컬럼 추가 | Reject | production table 무변경 경계 위반(T2-I-2/I-5). consumer(`getTier0Candidates`) 영향. 신규 `tier0_candidates_150_shadow` 분리가 안전 |
| production `screen_shortlist_tier0.py`에 `--shadow` 플래그(별도 스크립트 대신) | **Accept(조건부)** | current B++ branch 내부/직전에서 B++ pure 단계 재사용 + `run_bpp_candidates`/production write 전 `return` 분기라 가능(§2.2). 단 production write 라인 미도달 + distinct CSV naming 필수. 완전 별도 스크립트는 pure 단계 중복 → DRY 위반. **플래그 분기 채택, production write 절대 미도달 강제** |
| full-universe snapshot 없이 delta-only(자른 종목만) 로깅 | Reject | recall 분모는 universe-wide forward returns 필요(§6.2). delta-only면 외부 리더 누락 → 분모 왜곡. full snapshot이 하드게이트 counterfactual 정직성의 핵심(T2-I-7) |
| single arm(production-mirror만) | Reject(부분) | production-150 recall baseline만으론 "섹터-aware가 더 잡나" 답 불가. soft-tilt/hard-gate arm 필요. 단 stage 0 default는 `production-mirror`(plumbing 안정화 후 arm 확장) |
| LLM `sector_advisor` 지금 추가 | Defer to separate spec | model-registry/pricing blast radius. stage 0은 manual_pre_registered로 plumbing+forward 검증 충분. LLM은 manual arm verdict가 의미 있을 때 |
| Tier1/portfolio에 shadow 150 주입(실 선정 변경) | Reject(영구) | T2-I-6 production K=0. 관측이 아니라 behavior 변경. production money-path 오염 |

---

## §10 PR decomposition (Track 2)

> **구현 상태 (2026-06-21)**: **PR-B1 ✅ CONVERGED** (commit `42f5dcc`, `scripts/shadow_gen_core.py` + 50 tests). **PR-B2 ✅ Claude↔omxy CONVERGED** (omxy R1~R4 + Claude ce-* 3-패널, branch `tier0-bpp-multiregime` 미머지): `0039_tier0_candidates_150_shadow.{sql,rollback.sql}` + `scripts/pg_smoke_0039.sh`(docker-free 로컬 PG16 67 assertions LOCAL SMOKE PASS). PR-B2 구현 시 §5.2 sketch 대비 추가 확정: (a) **`register_shadow_hypothesis`** append-only RPC 신설(finalize는 pre-existing hypothesis 요구하나 table write grant 0이라 유일 write 경로; service_role+authenticated EXECUTE; 같은 (period_key,source,hash)에 다른 content면 `hypothesis_hash_content_mismatch`), (b) per-arm merge = **`v_arm || run_level`**(run-level wins, §5.2 정정 반영), (c) **symmetric fail-closed**: 모든 `::` cast(uuid/int/numeric/timestamptz/date)가 regex-선행 또는 begin/exception-wrap → 전부 typed error(`bad_hypothesis_id`/`bad_universe_size`/`bad_gate_eligible_size`/`bad_month`/`bad_run_date`/`bad_selection_as_of`/`row_invalid`/`snapshot_row_invalid`), 단 per-row format guard는 logged-전용이 아니라 전 status(INSERT cast가 전 status 적용), (d) anon RESTRICTIVE deny 정책 추가(0034 house pattern), (e) `snapshot_incomplete_after_write`는 `is distinct from`(3VL no-op 회피). **다음 = PR-B3** (Python `--shadow-sector`). **USER-only 잔여 = 0039 apply + apply후 real-conn smoke B1/B2/B3**(§5.4).

| PR | Scope | Files | Production effect |
|---|---|---|---|
| PR-B1 | Pure B++ `compute_shadow_selections` + tests (arm별 fixture, invalid source/sector throw, no-mutation, production-mirror normalized parity when unresolved=0, hard-gate diagnostic counterfactual_cut, universe_hash 결정론, immutable hypothesis/tilt params pre-registration) | `scripts/.../shadow_gen_core.py`(또는 `screen_shortlist_tier0.py` 내 pure helper) + 테스트 | none |
| PR-B2 | Migration 0039(4 table[hypothesis+candidates(+`gate_eligible_size`)+universe snapshot+unresolved] + **단일 `upsert_tier0_shadow_run` finalize RPC**[3 per-table writer는 INTERNAL `_shadow_write_*` un-granted helper, service_role EXECUTE는 finalize RPC에만], `period_key`+production `month date`, shared `run_id`, `universe_size`=full-universe N, begin/commit, grant 패턴[authenticated SELECT만, **service_role SELECT 부재** T2-I-6], owner=migration 적용자, hypothesis content binding, gate_eligible_size persistence, canonical-14 parity, complete snapshot fail-closed[candidates.run_id==snapshot.run_id], all-arms payload atomicity[`snapshot_rows`+`arms[]`+`unresolved_rows`], counterfactual metadata persistence) + smoke tests(REAL-connection service_role SELECT denied + finalize RPC INSERT success + RPC owner=superuser + mid-run rollback no-orphan + hypothesis_source_mismatch/hypothesis_content_mismatch 포함) | `0039_tier0_candidates_150_shadow.sql`, rollback | new shadow tables only |
| PR-B3 | Python `--shadow-sector` 모드 신규 구현(현 argparse 미존재): `args.shadow_sector` argparse 추가 + B++ branch 내부/직전 분기 + `run_shadow_bpp_generation_path`(shadow branch는 `run_bpp_candidates` 전에 return) + 단일 all-arms finalize RPC write(`snapshot_rows`+`arms[]`+`unresolved_rows`, snapshot-first) + full-universe snapshot + unresolved 로깅. default OFF | `screen_shortlist_tier0.py` (argparse + 분기 + 신규 함수) | none when flag OFF |
| PR-B4 | Reconcile/backfill(missed shadow rows; concurrent selector 시 MATERIALIZED CTE) | script/test | shadow table only · Stage 1 harvest/kill 전에는 blocking |
| PR-B5 | Stage 1 forward recall evaluator (paired `gate_a_recall` reuse, full-universe winner 분모, production-mirror↔persisted production normalized parity gate, survivorship probe, FWER) — **별도 spec 선행** | `validate_tier0_ic.py` 확장(secondary_selected) + 별도 spec | USER 결정 전 production effect 0 |

Track 2 밖(명시): production `tier0_candidates_150` / `short_list_30` schema·producer·consumer 변경, `MODEL_REGISTRY` 신규 role(stage 0), Tier1/portfolio 주입, production hard-gate, PIT backtest probe(§9 reject).

---

## §11 Review checklist (구현 전)

- [ ] Diff가 production table을 안 건드림(0039 신규 4 table만; `tier0_candidates_150`/`short_list_30` 스키마 diff 0).
- [ ] **PR-B3: `--shadow-sector`를 argparse에 추가**(현재 미존재 — argparse는 `--scoring`/`--dry-run`/`--apply`/`--csv-backup`/`--as-of`/`--universe-limit`/`--emit-candidates`/`--sector-review-csv`만), `run_shadow_bpp_generation_path` 구현, shadow branch가 `run_bpp_candidates` **전에 return**.
- [ ] shadow 분기가 current B++ `args.scoring=="bpp"` branch 내부/직전에서 `return`하여 `run_bpp_candidates`(≈1324–1423), `upsert_candidates_supabase`(≈1300–1317), `upsert_supabase`(≈1645) production write에 **구조적으로 미도달**.
- [ ] B++ pure core(`build_stock_raw_list`≈889–916 / `select_bpp_candidates`≈929–962 / `build_bpp_candidate_rows`≈965–983 / `resolve_sectors_for_universe`≈419–471 / `fetch_universe`≈351–400 / `prefetch_price_series`≈566–628) **재사용만**(no DB mutation), production write 흐름과 분리. legacy `select_candidate_pool_per_bucket`/`build_candidate_rows`를 B++ mirror에 사용하지 않음.
- [ ] 인용 라인(`build_stock_raw_list` ≈889–916, `select_bpp_candidates` ≈929–962, `build_bpp_candidate_rows` ≈965–983, `upsert_candidates_supabase` ≈1300–1317, `run_bpp_candidates --apply` ≈1338–1343, `main` B++ branch ≈1541–1543, production upsert ≈1607/≈1645, `resolve_sector` ≈304–344, `load_override` ≈251–297, forward 엔진 `compute_forward_return` ≈225–261·`top_decile_winners` ≈264–275·`gate_a_recall` ≈349–381)을 **구현 시점 코드로 재확인**.
- [ ] `run_bpp_candidates`/`enforce_b89_strict_block`/`upsert_candidates_supabase`를 shadow path가 호출 안 함.
- [ ] default `SHADOW_GENERATOR_ENABLED=false`가 byte-identical production behavior.
- [ ] pure core mutation 테스트(`compute_shadow_selections`가 universe/stocks 입력 mutate 시 실패) + unresolved=0 fixture에서 `production-mirror` normalized parity 테스트 + unresolved>0 fixture는 `INCOMPLETE_RUN`/diagnostic-only로 Gate A 제외.
- [ ] `tier0_shadow_sector_hypothesis`가 immutable append-only이고, `sector-soft-tilt` formula/params(`tilt_version`, multiplier/bonus 등)가 period 시작 전 pre-register되어 `hypothesis_id`로 참조됨. params 누락/non-object/사후변경/asOf>=selection_as_of는 `INVALID_INPUT`.
- [ ] 0039 write deliverable = **단일 `upsert_tier0_shadow_run` finalize RPC**(SECURITY DEFINER, owner=migration 적용자, **service_role EXECUTE는 이 RPC에만**). Payload is run-level: `snapshot_rows` + authoritative `arms[]` + `unresolved_rows`; per-arm public RPC 호출 금지. 3 per-table writer는 INTERNAL `_shadow_write_*`(어떤 role에도 grant 없음). one transaction + shared run_id로 hypothesis check→snapshot→**all active arms candidates**→unresolved 원자화, `candidates.run_id==snapshot.run_id` 강제 → orphan snapshot/partial active-arm set 불가. non-mirror arm에는 same-payload `production-mirror` 필수, duplicate arm reject, omitted stale period-arm rows 삭제 확인. grant 패턴(`feedback_supabase_security_definer_pattern`); `authenticated`/`service_role` table DML grant **없음**; `period_key`/production-compatible `month date`/`run_id`/`hypothesis_id`/`universe_hash`/`universe_size` 누락 거부.
- [ ] **hypothesis content binding(FIX-E/FIX-H)**: finalize RPC가 registered hypothesis row에서 `sector_view`를 derive하고, caller-provided `sector_view`가 있으면 exact equality가 아니면 `hypothesis_content_mismatch`/`hypothesis_source_mismatch` raise. 같은 period에 absent/manual hypothesis 공존 시 manual payload가 absent id 참조하거나 다른 `leading_sectors`/`as_of`/`params`/`hypothesis_hash`를 보내면 거부.
- [ ] **production K=0 DB 봉쇄(T2-I-6)**: shadow 4-table에 `service_role` SELECT grant **부재** → **REAL PostgREST/service-role connection**으로 `select … from tier0_candidates_150_shadow` permission denied(`SET ROLE` 사용 금지). 동시에 service-role API caller로 RPC INSERT는 **성공**(DEFINER 권한). `pg_proc.proowner` ≠ service_role 확인. (적대 제안 `OWNER TO service_role`는 미채택 사유 §5.1 명시.)
- [ ] **production read 코드에 shadow 식별자 0건(grep gate)**: `getTier0Candidates` 등 production consumer 파일에 `tier0_candidates_150_shadow`/`tier0_shadow_universe_snapshot`/`tier0_shadow_unresolved_issues` 문자열이 등장하지 않음. `getTier0Candidates` docstring이 production-only read를 단언.
- [ ] unresolved 진단 write = **별도 RPC/table section**(candidates payload 미혼합); period+run별 delete+insert idempotent; 비정형 ticker/sector_source는 skip이 아니라 reject.
- [ ] RPC pre-validation(period_key regex/month-first date/period-month mismatch/arm enum/sector source enum/canonical-sector/duplicate leading sector/asOf/selection_as_of/150 contract/bucket50/rank/duplicate/full-snapshot count/hash, universe row-shape/ticker-set mismatch) 동작.
- [ ] **SQL 14-섹터 enum == `canonical-sectors.ts::CANONICAL_SECTORS` == Python `CANONICAL_SECTORS`** (set 비교); shadow table CHECK는 canonical-14 ∪ `'unresolved'`; `canonical-sectors.ts` 변경 시 재검증.
- [ ] full-universe snapshot(`tier0_shadow_universe_snapshot`)이 universe-wide 종목 + `sector_view`/`sector_source`/`induty_code` 로깅 → forward winner 분모 universe-wide 보장(§6.2).
- [ ] **★#1 (B++ as production scorer) applied OR explicitly acknowledged pending** — if pending, SECONDARY vs-persisted-150 = `INCOMPLETE_RUN` for all periods (expected, not a bug); PRIMARY arm-vs-mirror lift proceeds.
- [ ] **canonical-14 parity unit test(FIX-I)**: Python `CANONICAL_SECTORS` == SQL CHECK enum == `canonical-sectors.ts::CANONICAL_SECTORS`(14, set equality).
- [ ] Stage 1 **SECONDARY** Gate A 입력 전에 `production-mirror` arm이 같은 `period_key`/`month`의 persisted `tier0_candidates_150`와 **selection-identity** parity(`{(ticker,bucket,rank)}` set-eq + `round(tier0_score,2)`; sector/name EXCLUDE)임을 검증. 실패/부재/B89 abort/★#1 미적용은 `INCOMPLETE_RUN`, SECONDARY recall lift claim 금지. PRIMARY(arm-vs-mirror)는 영향 없음.
- [ ] forward-only 강제: 어떤 코드도 과거 period에 current override.json/induty 소급 적용 안 함(look-ahead 가드). PIT 재현 시 availability date 가드(`feedback_pit_backtest_cache_availability`).
- [ ] stage 0이 PASS/FAIL·claim unblock 안 함. Gate A 어휘가 forward n_periods floor·universe-wide winner·survivorship probe 통과 전엔 verdict 아님.
- [ ] §0 정직 한정(forward-only 느림, 백테스트 아님, current-only 섹터맵) + §12 USER 결정 명시.

---

## §12 USER 결정 / open items

> 사용자가 Track 1 + Track 2 둘 다 빌드를 이미 결정 — 아래는 Track 2 빌드 파라미터 선결.

0. **★#1 dependency (prerequisite)** — SECONDARY(vs-LIVE-production-150) 비교는 B++가 production scorer로 채택될 때(HANDOFF ★#1 G1 applied)에만 가능하다. 그 전까지는 **PRIMARY arm-vs-mirror lift만** 사용 가능하며, SECONDARY는 모든 period에서 `INCOMPLETE_RUN`(정직, 버그 아님). Stage 0 generation/logging과 PRIMARY 측정은 ★#1과 무관하게 진행된다.
1. **arm 집합 — 결정됨(HANDOFF D0/D1 CONVERGED, PR-B1 ✅ 반영)**: PR-B1 pure core는 **3 arm 모두**(`production-mirror`/`sector-soft-tilt`/`sector-hard-gate`)를 구현했다. mirror-only는 forward period를 태우지 않는 **dry-run/same-period health check**로만 쓰고, **첫 persisted forward period부터 mirror+soft-tilt paired 동시 로깅이 default**다. hard-gate는 gate_eligible_size/underfill 통과 시만 active(실패=그 arm만 diagnostic INCOMPLETE_RUN, soft-tilt 안 막음). (구 "production-mirror 먼저 → tilt/gate 나중 확장" 권고는 D1로 supersede.)
2. **leading-sector hypothesis source**: stage 0 `manual_pre_registered`(USER가 period 시작 전 canonical-14 set 등록, asOf lock) — 충분한가, 아니면 즉시 LLM `sector_advisor` 별도 spec 착수? **권고 = manual 먼저**(LLM 비용·blast radius 회피, plumbing/forward 검증엔 manual로 충분).
3. **counterfactual 저장 구조 — 결정됨(Round 2 HIGH fix)**: full-universe ranked snapshot 별도 table(`tier0_shadow_universe_snapshot`, §5 채택안) **필수**. shadow candidates row의 `counterfactual_cut`는 run-level 진단 metadata로 함께 저장하지만, 이것만으로는 recall 분모 universe-wide를 만들 수 없으므로 대체 불가(§9 delta-only reject).
4. **forward n_periods floor + 타임라인 acceptance**: short 6주+ / midlong 6개월+ 누적 전 verdict 없음(§0.2, §6.1)을 수용하는가. plumbing-only로 무한 정체 방지 위해 "N주 후 arm 확장 / M개월 후 첫 verdict 시도" 하드 일정 등록 권고.
5. **cheap PIT-mechanical sanity probe 추가 여부**: §9에서 look-ahead로 reject했으나, USER가 "근사 sanity check"로라도 원하면 — **권고 = 추가 안 함**(섹터맵 current-only가 결과를 신뢰 불가하게 만들어 오히려 잘못된 안심 위험). forward-only 유지.
6. **unresolved 진단 write 구조 — 결정됨(Round 1 LOW → Round 3 FIX-C)**: unresolved는 별도 table + 별도 payload 배열로 분리(candidates payload 미혼합) 채택 — diagnostic이 business row와 페이로드에서 섞이지 않아 명료. Round 3에서 write는 단일 finalize RPC `upsert_tier0_shadow_run`의 internal helper `_shadow_write_unresolved` 단계로 통합되어 같은 transaction/run_id 원자성을 얻되, payload-separation 원칙은 유지된다. §5.2 sketch + §11 체크리스트 반영. (USER 재량 변경 가능하나 기본 = 분리.)
