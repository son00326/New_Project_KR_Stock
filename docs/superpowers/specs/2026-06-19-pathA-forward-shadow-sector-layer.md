# 경로 A — Forward-Shadow 섹터 레이어 설계 스펙 (Round 2 — Claude 적대리뷰 반영본)

> **상태**: 설계 스펙 + **PR-A1 구현 ✅ Claude↔omxy CONVERGED** (2026-06-23, branch `tier0-bpp-multiregime`, main 미머지). 설계 = Round 1 omxy 적대리뷰 → Round 2 Claude ce 문서-리뷰 5종. 구현(PR-A1) = Phase-1 design 루프(4 critic→11 delta) → omxy R1~R3 CONVERGED(parseAsOfInstant tz-aware 캘린더 BLOCKER fix + golden hard-gate parity) → Claude ce-* 적대 5-패널(ADV/CORR REFUTED, T1~T5+MAINT-1+SIMP-2 hardening) → 양쪽 cross-model 수렴. `shadow-harness-arms.ts`(computeArmSelections, 4 arm) + 44 tests + `compareForTimeframe` additive export. dormant default-OFF·production effect 0. **PR-A3 구현 ✅ Claude↔omxy CONVERGED (2026-06-23, `5dca94b`)**: `0038_shadow_arm_log.sql`(table+RLS+upsert RPC, symmetric cast fail-closed) + rollback + `pg_smoke_0038.sh`(docker-free PG16, 39 ok PASS). omxy R1(int4 overflow fix)+R2 CONVERGED + ce-* 3-패널(C1 track/arm NULL guard fix). migration FILE only(apply USER-only). **PR-A2 구현 ✅ Claude↔omxy CONVERGED (2026-06-23, `643a8ce`)**: `shadow-arm-logger.ts`(env gate·fail-closed config·computeArmSelections→upsert RPC) + finalizeSelection seam(finalized-only·post-persist·structuredClone·best-effort warning) + route 주입(default OFF) + 14 tests. omxy R1(env silent-coerce fail-closed fix)+R2 CONVERGED + ce-* 3-패널(correctness/adversarial CLEAN, REL-1 no-timeout DEFER). **PR-A4 구현 ✅ Claude↔omxy CONVERGED (2026-06-23, `0f532ef`)**: `shadow_arm_reconcile.py`(report-only gap REPORT: complete/partial/missing/anomaly + logged_arm_count observability) + 27 unittest + `pg_smoke_0038_pra4.sh`. omxy R1(smoke DB collision fix)+R2 CONVERGED + ce-* 3-패널(PRA4-1 HIGH "harvest-gate 무력" REFUTED §2.2/§6.5 — incomplete_run=consumable; A1~A4 LOW additive). **Track 1 PR-A1·A2·A3·A4 ✅ + PR-A5 design spec ✅ CONVERGED(2026-06-23, `69a8283`, USER metric 확정: per-timeframe return lift + hit-rate)**; PR-A5 **구현(`shadow_arm_eval.py`)만 후속**(Stage-1 PASS 구조적 unreachable→DIRECTIONAL; forward 데이터 누적 후 verdict). §4 item 2 / §5.2 sketch(C1) / §6.5 / §10 PR-A1·A2·A3·A4 = as-built 반영.
> **범위**: production `tier0_candidates_150` / `short_list_30` / Tier1 scoring / portfolio money-path는 **변경하지 않는다**. 모든 신규 표면은 shadow-only.
> **검증 기준**: 현재 repo 실측(2026-06-20 KST). 인용 라인번호는 리뷰 시점 기준이며, 구현 전 §11 체크리스트로 재확인한다. migration 0038은 아직 파일이 없으며 §5 SQL은 future migration 설계안이다.
> **연관 박제**: D30 verdict (`reviews/2026-06-17-tier0-4config-multiregime-verdict.md`) · `project_tier0_scoring_bplus_decision_77` · `feedback_workflow_verify_false_convergence` · `feedback_supabase_security_definer_pattern` · `feedback_pg_skip_locked_claim_anti_pattern` · `feedback_supabase_read_during_finalize`

---

## §0 결론: 무엇을 측정하고 무엇을 측정 못 하는가 (정직한 scope)

PRISM식 "유망 섹터 → 그 섹터에서 선정" 아이디어를 JooPick에 forward-shadow로 검증한다. 단 **사용자의 원래 질문은 두 단계로 갈라지며, 한 트랙으로 둘 다 답할 수 없다.**

### ⚠️ 핵심 한정 (Round 2 적대리뷰 코드-확정)
**사용자의 원래 동기 = 150-recall 문제**: "B++ Tier0가 *150 생성 단계*에서 섹터 리더(삼성전자·HD현대일렉 등 11개 중 10개)를 놓친다."

Tier1 post-persist seam(worker)의 후보 풀은 `fresh ∪ incumbents` = **current `tier0_candidates_150`의 track slice(short 50 / midlong 100) + incumbent carry-ins(최대 10/20)**다(코드 확정: `admin-tier0-candidates.ts::getTier0Candidates` track-bucket SELECT → `tier1-selection-batch-worker.ts::mergeFreshWithIncumbents`). incumbent-only 종목은 current 150 밖일 수 있으므로 Track 1은 순수 fixed-150 proxy도 아니다. 단 current Tier0 producer가 이번 달 150 생성 단계에서 놓친 신규 리더는 이 풀에 없으므로 Track 1 shadow arm이 **생성 실패를 구조적으로 복구/측정할 수 없다.**

⇒ **Tier1 seam에서 측정 가능한 것 = "worker-available pool(current track Tier0 slice + incumbents) 안에서 섹터 재정렬이 더 나은 track 10/20을 뽑나"(in-pool 30-reranking)뿐이고, 사용자의 실제 질문(생성 단계 150-recall)은 구조적으로 측정 불가.** 이는 D30 핵심 발견("recall은 Tier0 생성 단계 책임, AI 2차가 구제 불가")과 정합한다.

### 두 트랙 (서로 다른 질문을 답함)

| 트랙 | seam | 측정 대상 | production 안전성 | 사용자 원질문 답? |
|---|---|---|---|---|
| **Track 1 — In-pool 30-reranking observer** (= 본 스펙 §1~§11) | Tier1 worker, post-persist | worker-available pool(current track slice + incumbents) 내 섹터/regime 재정렬이 track 10/20 선정을 바꾸나 | post-persist·default-off·shadow table only | ❌ NO (plumbing + 30-reranking만) |
| **Track 2 — Generator-shadow** (= §5b 스케치, 별도 spec 필요) | Python Tier0 *옆*, 생성 단계 | sector-aware shadow 150이 production 150보다 리더를 더 잡나 (150-recall) | shadow `tier0_candidates_150_shadow` 별도 table, production producer 무변경 | ✅ YES (유일하게 원질문 답) |

> **이 스펙은 Track 1을 완전 설계하고, Track 2는 스케치 + 별도 spec 요구로 격상한다.** Track 1은 싸고 안전하지만 사용자 질문을 답하지 못한다 — 이를 명시적으로 박제한다(측정 가능한 것처럼 위장 금지).

### §12 USER 결정 (PR-A1 빌드 전 선결)
**(a)** Track 1만 빌드(30-reranking + plumbing 관측 도구로 수용, 원질문은 별도 미답으로 둠), 또는
**(b)** Track 2 별도 spec 작성(원질문 답 — generator-shadow), 또는 **(c)** 둘 다.
→ **Claude 권고**: 원질문(150-recall)이 진짜 관심사이므로 **(b) 또는 (c)**. Track 1 단독(a)은 "측정했는데 원질문은 미답"이 되어 D30 이후 사용자가 가장 경계하는 패턴이 됨. 단 Track 2는 Python 생성 단계 shadow라 더 크므로 별도 spec에서 동일 omxy↔Claude 루프로 설계.

---

## §1 LOCKED 불변사항 (Track 1)

| # | 불변 | 설계 강제 |
|---|---|---|
| I-1 | **money-path 무변경** | `input.persist(...)`가 유일한 `short_list_30` writer. shadow는 그 후 별도 table에만 기록 |
| I-2 | **production Tier0 150 무변경** | `tier0_candidates_150` 스키마/producer/consumer 변경 없음. `reserve_provenance` 추가 금지 |
| I-3 | **production Tier1 scoring 무변경** | `persona-eval.ts::runTier1Screening` 입력/출력/정렬/검증 변경 없음 |
| I-4 | **track-scope 유지** | `short` arm log=10, `midlong` arm log=20(mid10+long10). "30개" 평가는 별도 full-30 snapshot 전까지 금지 |
| I-5 | **production K=0** | `production_k`는 항상 0. shadow의 `shadow_eval_k`만 nonzero 가능. `--apply K>0` 금지 |
| I-6 | **하드게이트 production 영구 금지** | candidate-pool-hard-gate는 counterfactual row로만 (shrink-only, recall 못 올림) |
| I-7 | **LLM 추가 호출 없음 (Track 1 stage 0)** | 신규 AI role 안 만듦. 이미 지불한 panel/judge 결과만 사용. sector hypothesis는 `absent` 또는 `manual_pre_registered` |
| I-8 | **USER-only 게이트** | migration apply, env flag, harvest/kill automation, K 전환은 USER 승인 후 |
| I-9 | **정직 scope** | Track 1은 생성 단계 150-recall을 측정하지 **않음**. 산출물/UI 어휘는 "worker-pool in-pool 30-reranking shadow 관측"까지만 |

---

## §2 현재 repo 실측 touchpoint (Track 1)

### 2.1 변경하지 않는 표면

| 표면 | 현재 사실 | 결정 |
|---|---|---|
| `scripts/screen_shortlist_tier0.py` (Tier0CandidateRow/build_*_rows) | `month,ticker,name,sector,bucket,rank,tier0_score,signal_label`만 emit | 변경 없음 |
| `tudal/supabase/migrations/0028_tier0_candidates_150.sql` | unique `(month,ticker)`,`(month,bucket,rank)` | 변경 없음 |
| `tudal/src/lib/data/admin-tier0-candidates.ts::getTier0Candidates` | track-bucket SELECT → `Tier1Candidate` (sleeve/mcap metadata 미보유) | 변경 없음 |
| `tudal/src/lib/screening/persona-eval.ts::runTier1Screening` | track별 50/100(+incumbent) → 10/20 선정, universe=`input.candidates`로 고정 | 변경 없음 |
| `tudal/src/lib/ai/model-registry.ts` | `AiRole` 7종 + load-time pricing invariant | `sector_advisor` 추가 금지 |
| `tudal/src/lib/ai/portfolio-proposal-client.ts` | `portfolio@v1` 비중 결정 | 범위 밖 |

### 2.2 유일한 code seam — 정확 위치 (Round 2 정정)

> **Round 1 오류 정정**: `persist`와 `markSelectionFinalized`는 둘 다 `finalizeSelection()` **헬퍼 내부**에 있고(worker ≈line 1089·1110, 함수 ≈1010–1112), `markSelectionFinalized`는 **stale-period skip 경로**(≈line 1049, `return false`, persist 안 함)에서도 호출된다. 따라서 shadow logger는 chunk 최상위가 아니라 **`finalizeSelection` 내부, `markSelectionFinalized` 직후, `return true` 직전, `finalized===true` 경로에서만 1회** 배선되어야 한다.

```ts
// inside finalizeSelection(...), ONLY on the finalized path:
const result = await input.runScreening({ /* track-scoped */ });
await input.persist(month, track, result.selected, { ... });   // money-path SoT (단일 writer)
await markSelectionFinalized(client, periodKey, input.runId ?? "");

if (input.logShadowArms) {                 // optional DI, flag-gated, default OFF
  try {
    await input.logShadowArms({
      month, track, periodKey,
      runId: input.runId ?? "",
      productionResult: structuredClone(result),        // track-scoped (10 또는 20), NOT static full-30
      candidates: structuredClone(candidates),          // fresh ∪ incumbents
      incumbentTickers: structuredClone(incumbentTickers),
      judgeScoresByTicker: structuredClone(judgeScoresByTicker),  // finalize 경로에서만 in-scope
      client,
    });
  } catch (shadowErr) {
    try { await input.insertPipelineHealth(/* shadow_arm_log_failed, best-effort */); }
    catch { /* if this ALSO fails, only console.warn remains — see note */ }
    console.warn(JSON.stringify({ event: "shadow_arm_log_failed", track, periodKey }));
  }
}
return true;
```

Load-bearing decisions:
- `persist` + `markSelectionFinalized` happen **before** shadow logging → shadow 실패가 money-path/finalize를 절대 차단 못 함(I-1).
- **stale-skip 경로(`return false`, persist 안 함)에서는 shadow를 기록하지 않는다** (production baseline 부재 → 비교 무의미).
- `structuredClone` + 테스트에서 logger 입력 deep-freeze로 mutation 차단.
- 이중 실패(logShadowArms + insertPipelineHealth 모두 실패) 시 기록은 `console.warn` JSON뿐 → harvest는 `INCOMPLETE_RUN`으로 표기, 운영자가 Vercel 로그로 "실패 vs 미실행" 구분(§6.5).
- 프로세스가 persist 후 shadow log 전에 죽으면, 후속 reconcile(PR-A4)이 `shadow_arm_log` backfill; production은 여전히 정확. 단 `markSelectionFinalized` 이후에는 `runGuardedSelectionChunk`가 `already_finalized`로 빠지므로 worker natural retry는 없다. **Stage 1 harvest/kill은 PR-A4가 누락 row를 `logged` 또는 명시적 `incomplete_run`으로 닫기 전 금지.**

---

## §3 Shadow arm semantics (Track 1)

### 3.1 arm IDs

| arm | 의미 | production 가능성 |
|---|---|---|
| `production-snapshot` | persisted production result의 immutable snapshot | 이미 production. 비교 baseline으로만 log (insert-only) |
| `sector-soft-reserve` | 같은 track/timeframe 후보 풀 *안에서* sector hypothesis 후보를 soft substitute한 counterfactual | shadow-only |
| `regime-sector-soft-reserve` | regime별 K multiplier 적용 sector reserve counterfactual | shadow-only (단 §3.5 regime source 규율 필수) |
| `candidate-pool-hard-gate` | worker-available pool(current Tier0 track slice + incumbent carry-ins)을 sector hypothesis로 절단한 counterfactual | **production 영구 금지**. **pool을 shrink만 함 → recall 못 올림**(진단용). market full-universe 아님 |

> 주의: worker seam 데이터는 market full universe가 아니라 `fresh ∪ incumbents` worker-available pool(current Tier0 track slice + incumbent carry-ins)이다. "full-universe hard-gate"(= 전체 Tier0 후보 위 무제한 게이트) 개념은 Track 1에 존재하지 않으며, 그건 Track 2(generator-shadow)의 영역이다.

### 3.2 track/timeframe count contract
- `short`: selected=10, active timeframe=`short`.
- `midlong`: selected=20, active=`mid`,`long` 각 10.
- `shadow_arm_log.selected`는 track-scope 결과만. full-30 비교는 두 track finalize 후 별도 `shadow_full30_snapshot`(stage 1+, Track 1 stage 0 제외).

### 3.3 sector hypothesis source (Track 1 stage 0)
신규 LLM role 안 만듦. 허용 source enum:
- `absent`: sector hypothesis 없음. production snapshot + plumbing만 검증.
- `manual_pre_registered`: USER/운영자가 **period 시작 전** 등록한 canonical-14 sector set + `asOf` lock(사후 변경 금지). shadow-only.
- Track 1 stage 0에서 허용되는 source는 `absent`와 `manual_pre_registered`뿐이다. 미래 LLM source 값은 별도 spec/PR에서 `sector_advisor` 비용·pricing·reservation·prompt·테스트가 통과하기 전까지 **invalid_input**으로 거부한다(silent 동작 금지).

`sector_view`는 `canonical-sectors.ts::CANONICAL_SECTORS` 멤버만. unknown/free-text → arm verdict `invalid_input`, production 영향 0.

### 3.4 K 분리
| K | 의미 | 기본값 |
|---|---|---|
| `production_k` | production 선정 영향 K | **항상 0** (production은 K를 읽지 않음) |
| `shadow_eval_k` | counterfactual log 전용 K | pre-registered. 0=plumbing-only, nonzero=성능검정 가능 |

> 구 draft의 "K=0 ladder"(다단계 K 점증) 어휘 폐기. production=항상0 / shadow=단일 pre-registered K. `SHADOW_HARNESS_K`/`SHADOW_EVAL_K=0`은 production rollback lever가 아니라 shadow effective K를 0으로 만드는 운영 레버.

### 3.5 regime source 규율 (Round 2 신규 — regime 분류기 부재 대응)
> 코드 확정: `src/lib`에 regime 분류기 **0건**(grep `regime`=0). regime label producer가 없다.

- `regime.source`를 Track 1 stage 0 enum으로 강제: `absent` | `manual_pre_registered`. 미래 classifier source 값은 별도 spec 전까지 `invalid_input`.
- `manual_pre_registered`: **period 시작 전** 등록 + `asOf` lock + 사후 편집 금지.
- forward 무결성: regime label `asOf` timestamp는 평가 대상 period보다 **반드시 선행**. §6.5 stale 가드에 `regime asOf` 전용 가드 추가.
- stage 0 기본 = regime arm **비활성**(`absent`). regime arm은 source 규율 충족 시에만 활성. (대안: stage 0에서 regime arm 완전 제외 — USER 선택, §12.)
- 근거: B+C 다중장세 검증에서 regime별 신호강도 격차 큼(bull +0.72 vs recovery 음→양) → hindsight 라벨링은 forward-shadow 목적 훼손.

---

## §4 `computeArmSelections` pure contract

Future 파일: `tudal/src/lib/screening/shadow-harness-arms.ts`.

```ts
export interface ComputeArmSelectionsInput {
  track: "short" | "midlong";
  periodKey: string;
  // track-scoped result of runTier1Screening({track}); selected length 10(short)/20(midlong).
  // NOT the static full-30 Tier1ScreeningResult — validated by makeTier1ScreeningResultSchema(track,...).
  productionResult: Tier1ScreeningResult;      // cloned input only
  candidates: readonly Tier1Candidate[];       // cloned fresh ∪ incumbents pool (no sleeve/mcap metadata)
  judgeScoresByTicker?: Readonly<Record<string, Record<Timeframe, number>>>;
  sectorView: {
    source: "absent" | "manual_pre_registered"; // other/future values => invalid_input
    leadingSectors: readonly CanonicalSector[];
    asOf: string;
  };
  regime?: { stage: "bear" | "sideways" | "bull"; asOf: string; source: "absent" | "manual_pre_registered" }; // future/non-Track1 source => invalid_input until separate spec
  shadowEvalK: number;
}
```

Required behavior:
1. **No DB, no LLM, no mutation**.
2. `production-snapshot`은 `productionResult.selected`를 **`SelectedRow`(ticker·assigned_timeframe·assigned_by·weighted_score·sector)로 projection**한 immutable baseline이다 (PR-A1 as-built: 0038 `selected` row가 §5.2에서 ticker/assigned_timeframe/count/distinct만 검증하므로 full `TickerAggregate` byte 복제가 아니라 lossy projection — `primary_timeframe`/badge/version-id 등은 logging 비대상). parity 단언 = projected `SelectedRow` 집합이 production projection과 set-equal(순서 무관). `weighted_score`는 **assigned_timeframe**의 점수(primary tf 아님).
3. 비-production arm: selected count == track count(10/20), active timeframe count 유효.
4. `sectorView.source` / `regime.source`가 Track 1 허용 enum 밖이면 `invalid_input` throw (stage 0 금지). unknown sector / invalid K / stale sector·regime timestamp → `invalid_input`. silent coerce 금지.
5. `candidate-pool-hard-gate`는 `counterfactual_cut` 기록만, 어떤 production writer에도 반환 안 함. **pool shrink만 → recall 못 올림**.
6. `sectorView.source==='absent'` 또는 `shadowEvalK=0` → reserve arm == production. 이 row는 **plumbing 증거**일 뿐 성능 증거 아님.

Track 1에서 제거(이유):
- size-sleeve reserve: worker 후보 객체에 B++ sleeve/mcap metadata 없음 → sleeve-aware reserve는 Track 2 또는 별도 shadow snapshot source 필요. `tier0_candidates_150` 변경 금지.
- Python `apply_sleeve_reserve`, `reserve_provenance` on production table → 전부 Track 1 밖.

---

## §5 Migration 0038 설계안 — upsert-based shadow log (production-snapshot insert-only)

> Round 2 정정: 구 "append-only" 명칭 폐기. 실제 = `(period_key, track, arm)` 당 1행 upsert. 단 **`production-snapshot` arm은 insert-only(ON CONFLICT DO NOTHING)로 immutable baseline 보호**. non-production arms(sector/regime/candidate-pool)만 DO UPDATE.

### 5.1 migration safety
- 신규 table만; 기존 production table 무변경.
- **apply SQL을 `begin;/commit;`으로 감싼다**(0034 원자성 패턴) → 부분 적용 방지.
- 파괴적 migration 없음. rollback은 `shadow_arm_log` + RPC만 drop(shadow 관측 삭제 — USER 수용 사항).
- **0038은 USER-applied only.** Claude/omxy는 migration 실행 금지.
- **table-level write grant를 `authenticated`/`service_role` 어느 쪽에도 부여하지 않는다**(아래) → 모든 write는 SECURITY DEFINER RPC 경유. Stage 0 write caller는 worker/reconcile의 service-role path만; authenticated manual replay UI가 필요하면 별도 PR에서 caller contract와 grant를 추가한다.

### 5.2 apply SQL sketch

```sql
begin;
-- migration: 0038_shadow_arm_log
-- purpose: Track 1 forward-shadow track-scoped counterfactual log. Production tables untouched.

create table if not exists public.shadow_arm_log (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  period_key text not null,
  track text not null check (track in ('short','midlong')),
  -- 0031 정확 패턴: track↔prefix 일관성 강제 (weak '^[sm]:' 금지)
  constraint shadow_arm_log_track_period_consistent check (
    (track='short'   and period_key ~ '^s:\d{4}-\d{2}-\d{2}$') or
    (track='midlong' and period_key ~ '^m:\d{4}-\d{2}$')
  ),
  arm text not null check (
    arm in ('production-snapshot','sector-soft-reserve','regime-sector-soft-reserve','candidate-pool-hard-gate')
  ),
  run_id text,
  run_date timestamptz not null,
  sector_view jsonb not null default '{"source":"absent","leadingSectors":[]}'::jsonb,
  regime_context jsonb,
  production_k int not null default 0 check (production_k = 0),
  shadow_eval_k int not null default 0 check (shadow_eval_k >= 0),
  selected jsonb not null,
  not_selected jsonb,
  reserve_picks jsonb,
  counterfactual_cut jsonb,
  sector_distribution jsonb,
  status text not null default 'logged' check (status in ('logged','invalid_input','incomplete_run')),
  error text,
  created_by uuid,           -- stage 0 service_role path=null; future authenticated admin replay grant 시 auth.uid() 감사
  created_at timestamptz not null default now()
);

create unique index if not exists shadow_arm_log_period_track_arm_uniq
  on public.shadow_arm_log (period_key, track, arm);

alter table public.shadow_arm_log enable row level security;

revoke all on table public.shadow_arm_log from public;
revoke all on table public.shadow_arm_log from anon;
revoke all on table public.shadow_arm_log from authenticated;
revoke all on table public.shadow_arm_log from service_role;
grant select on table public.shadow_arm_log to authenticated;   -- RLS admin gate
grant select on table public.shadow_arm_log to service_role;    -- SELECT only; NO insert/update/delete (RPC-only writes)

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shadow_arm_log' and policyname='shadow_arm_log admin select') then
    create policy "shadow_arm_log admin select" on public.shadow_arm_log for select to authenticated using (public.is_admin());
  end if;
end $$;

create or replace function public.upsert_shadow_arm_log(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role text;
  v_id uuid;
  v_arm text;
  v_track text;
  v_period text;
  v_month text;
  v_status text;
  v_created_by uuid;
  v_expected int;
  v_selected jsonb;
  v_sector_source text;
  v_regime_source text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload_must_be_object';
  end if;

  -- authz: Stage 0 grants EXECUTE only to service_role. If a later admin replay UI is added,
  -- this guard is ready but the migration must explicitly add the authenticated grant and caller spec.
  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then raise exception 'auth_unavailable'; end if;
    if not public.is_admin() then raise exception 'admin_required'; end if;
    v_created_by := auth.uid();
  end if;

  -- pre-validation (raise early; do NOT rely only on table CHECK / NOT NULL)
  v_month := p_payload->>'month'; v_period := p_payload->>'period_key';
  v_track := p_payload->>'track';  v_arm := p_payload->>'arm';
  v_status := coalesce(p_payload->>'status','logged');
  v_selected := p_payload->'selected';
  v_sector_source := coalesce(p_payload#>>'{sector_view,source}', 'absent');
  v_regime_source := coalesce(p_payload#>>'{regime_context,source}', 'absent');

  if v_month is null or v_month !~ '^\d{4}-\d{2}$' then raise exception 'bad_month'; end if;
  -- C1(PR-A3 as-built): NULL guard 선행 — `NULL not in (...)`=NULL이라 typed error 미발동 → raw 23502 누수.
  if v_track is null or v_track not in ('short','midlong') then raise exception 'bad_track'; end if;
  v_expected := case when v_track='short' then 10 when v_track='midlong' then 20 end;
  if (v_track='short'   and v_period !~ '^s:\d{4}-\d{2}-\d{2}$') or
     (v_track='midlong' and v_period !~ '^m:\d{4}-\d{2}$') then raise exception 'bad_period_for_track'; end if;
  if v_arm is null or v_arm not in ('production-snapshot','sector-soft-reserve','regime-sector-soft-reserve','candidate-pool-hard-gate') then raise exception 'bad_arm'; end if;
  if v_status not in ('logged','invalid_input','incomplete_run') then raise exception 'bad_status'; end if;
  if v_sector_source not in ('absent','manual_pre_registered') then raise exception 'bad_sector_source'; end if;
  if v_regime_source not in ('absent','manual_pre_registered') then raise exception 'bad_regime_source'; end if;
  if jsonb_typeof(coalesce(p_payload#>'{sector_view,leadingSectors}', '[]'::jsonb)) <> 'array' then
    raise exception 'sector_leading_sectors_must_be_array';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(coalesce(p_payload#>'{sector_view,leadingSectors}', '[]'::jsonb)) s(sector)
    where s.sector not in ('바이오','반도체','건설','금융','2차전지','자동차','IT/SW','유통/소비재','에너지','엔터/미디어','통신','철강/소재','운송/물류','보험/증권')
  ) then raise exception 'bad_canonical_sector'; end if;
  if v_sector_source = 'manual_pre_registered' then
    if jsonb_array_length(coalesce(p_payload#>'{sector_view,leadingSectors}', '[]'::jsonb)) = 0 then
      raise exception 'sector_leading_sectors_required';
    end if;
    if nullif(p_payload#>>'{sector_view,asOf}', '') is null then raise exception 'sector_asof_required'; end if;
    perform (p_payload#>>'{sector_view,asOf}')::timestamptz;
  end if;
  if v_regime_source = 'manual_pre_registered' then
    if coalesce(p_payload#>>'{regime_context,stage}', '') not in ('bear','sideways','bull') then raise exception 'bad_regime_stage'; end if;
    if nullif(p_payload#>>'{regime_context,asOf}', '') is null then raise exception 'regime_asof_required'; end if;
    perform (p_payload#>>'{regime_context,asOf}')::timestamptz;
  end if;
  if coalesce((p_payload->>'production_k')::int, 0) <> 0 then raise exception 'production_k_must_be_zero'; end if;
  if coalesce((p_payload->>'shadow_eval_k')::int, 0) < 0 then raise exception 'shadow_eval_k_must_be_nonnegative'; end if;
  if pg_column_size(p_payload) > 4 * 1024 * 1024 then raise exception 'payload_too_large'; end if;

  if v_status = 'logged' then
    if v_selected is null or jsonb_typeof(v_selected) <> 'array' then raise exception 'selected_must_be_array'; end if;
    if jsonb_array_length(v_selected) <> v_expected then raise exception 'selected_count_mismatch:%:%', v_track, jsonb_array_length(v_selected); end if;
    if exists (
      select 1 from jsonb_array_elements(v_selected) e
      where coalesce(e->>'ticker','') !~ '^\d{6}$'
         or coalesce(e->>'assigned_timeframe','') not in ('short','mid','long')
         or (v_track='short' and e->>'assigned_timeframe' <> 'short')
         or (v_track='midlong' and e->>'assigned_timeframe' not in ('mid','long'))
    ) then raise exception 'selected_row_invalid'; end if;
    if (select count(distinct e->>'ticker') from jsonb_array_elements(v_selected) e) <> v_expected then
      raise exception 'selected_duplicate_ticker';
    end if;
    if v_track='midlong' and (
      (select count(*) from jsonb_array_elements(v_selected) e where e->>'assigned_timeframe'='mid') <> 10 or
      (select count(*) from jsonb_array_elements(v_selected) e where e->>'assigned_timeframe'='long') <> 10
    ) then raise exception 'selected_midlong_count_mismatch'; end if;
  elsif v_selected is not null and jsonb_typeof(v_selected) <> 'array' then
    raise exception 'selected_must_be_array';
  end if;

  if v_arm = 'production-snapshot' then
    -- immutable baseline: first valid insert wins; later calls cannot update/poison it.
    if v_status <> 'logged' then raise exception 'production_snapshot_status_must_be_logged'; end if;
    if coalesce((p_payload->>'shadow_eval_k')::int, 0) <> 0 then raise exception 'production_snapshot_shadow_eval_k_must_be_zero'; end if;

    insert into public.shadow_arm_log (
      month, period_key, track, arm, run_id, run_date, sector_view, regime_context,
      production_k, shadow_eval_k, selected, not_selected, reserve_picks, counterfactual_cut,
      sector_distribution, status, error, created_by
    ) values (
      v_month, v_period, v_track, v_arm, p_payload->>'run_id',
      coalesce((p_payload->>'run_date')::timestamptz, now()),
      coalesce(p_payload->'sector_view', '{"source":"absent","leadingSectors":[]}'::jsonb),
      p_payload->'regime_context', 0, 0,
      v_selected, p_payload->'not_selected', p_payload->'reserve_picks',
      p_payload->'counterfactual_cut', p_payload->'sector_distribution', v_status, p_payload->>'error', v_created_by
    )
    on conflict (period_key, track, arm) do nothing
    returning id into v_id;

    if v_id is null then
      select id into v_id from public.shadow_arm_log
       where period_key = v_period and track = v_track and arm = v_arm;
    end if;
    return v_id;
  end if;

  insert into public.shadow_arm_log (
    month, period_key, track, arm, run_id, run_date, sector_view, regime_context,
    production_k, shadow_eval_k, selected, not_selected, reserve_picks, counterfactual_cut,
    sector_distribution, status, error, created_by
  ) values (
    v_month, v_period, v_track, v_arm, p_payload->>'run_id',
    coalesce((p_payload->>'run_date')::timestamptz, now()),
    coalesce(p_payload->'sector_view', '{"source":"absent","leadingSectors":[]}'::jsonb),
    p_payload->'regime_context', 0, coalesce((p_payload->>'shadow_eval_k')::int, 0),
    coalesce(v_selected,'[]'::jsonb), p_payload->'not_selected', p_payload->'reserve_picks',
    p_payload->'counterfactual_cut', p_payload->'sector_distribution', v_status, p_payload->>'error', v_created_by
  )
  on conflict (period_key, track, arm) do update set
    run_id = excluded.run_id,
    run_date = excluded.run_date,
    sector_view = excluded.sector_view,
    regime_context = excluded.regime_context,
    shadow_eval_k = excluded.shadow_eval_k,
    selected = excluded.selected,
    not_selected = excluded.not_selected,
    reserve_picks = excluded.reserve_picks,
    counterfactual_cut = excluded.counterfactual_cut,
    sector_distribution = excluded.sector_distribution,
    status = excluded.status,
    error = excluded.error
  returning id into v_id;
  return v_id;
end; $$;

revoke all on function public.upsert_shadow_arm_log(jsonb) from public;
revoke all on function public.upsert_shadow_arm_log(jsonb) from anon;
revoke all on function public.upsert_shadow_arm_log(jsonb) from authenticated;
revoke all on function public.upsert_shadow_arm_log(jsonb) from service_role;
grant execute on function public.upsert_shadow_arm_log(jsonb) to service_role;
commit;
```
> `production-snapshot`은 실제 `ON CONFLICT DO NOTHING` 분기다. sector/regime/candidate-pool arms만 upsert update된다.

### 5.3 rollback SQL sketch
```sql
begin;
-- rollback: 0038_shadow_arm_log — deletes all Track 1 shadow observations. Production tables untouched.
drop function if exists public.upsert_shadow_arm_log(jsonb);
drop table if exists public.shadow_arm_log cascade;
commit;
```

### 5.4 required migration smoke (USER apply 후)
- `shadow_arm_log` 존재 + RLS enabled.
- anon table access denied.
- authenticated non-admin SELECT denied (RLS); admin SELECT allowed.
- `authenticated`와 `service_role`의 직접 INSERT/UPDATE/DELETE(RPC 우회) blocked(table-level DML grant 없음).
- `upsert_shadow_arm_log` `prosecdef=true` + `search_path=public, pg_temp`.
- function EXECUTE grants: public=false, anon=false, authenticated=false(stage 0), service_role=true.
- track↔period_key CHECK: `(short, 'm:...')` 같은 mismatch INSERT가 거부됨.
- `production-snapshot` 첫 insert가 count/duplicate/active-timeframe/status/K/canonical-sector/asOf 검증을 통과하고, 재호출은 기존 row를 덮어쓰지 않음(immutable).
- **SQL의 14-섹터 enum(`bad_canonical_sector` 가드) == `canonical-sectors.ts::CANONICAL_SECTORS`** (14개, 순서무관 set 비교). 구현 시점 1회 + 이후 `canonical-sectors.ts` 변경 시마다 재검증(둘이 silently divergent하면 RPC가 정상 섹터를 `bad_canonical_sector`로 거부).
- rollback 파일이 0038 artifact만 drop.

---

## §5b Track 2 — Generator-shadow (스케치 · 별도 spec 필요 · 사용자 원질문 답)

> Track 1로는 생성 단계 150-recall을 답할 수 없으므로, 사용자 원질문을 답하려면 **생성 단계 shadow**가 필요하다. 본 절은 USER 결정(§12)을 위한 스케치이며, 채택 시 동일 omxy↔Claude 루프로 별도 spec을 작성한다.

- **개념**: production Tier0(`screen_shortlist_tier0.py`)는 그대로 두고, **그 옆에서 sector-aware shadow 150을 생성**(LLM/manual 주도섹터로 universe를 tilt하거나 게이트) → 신규 `tier0_candidates_150_shadow` table에 기록. production `tier0_candidates_150` **무변경**(I-2 유지).
- **측정**: forward로, shadow-150 recall(=시장 top-decile-positive 리더 중 shadow-150이 잡은 비율) vs production-150 recall 비교. 이것이 "섹터-aware하면 150이 리더를 더 잡나"를 직접 답함.
- **하드게이트도 여기서 안전 측정 가능**: shadow는 full-universe counterfactual을 함께 로깅 → 게이트가 잘라낸 리더가 데이터에 남아 "보임"(R2 무력화 문제 없음, production 아님).
- **백테스트 불가**(과거 PIT 섹터맵·과거 LLM 출력 부재 + look-ahead) → forward-only. PIT 섹터맵은 forward 스냅샷 누적으로 자연 확보(`canonical_sector_mapper` 현재맵을 매주 스냅샷).
- **비용/제약**: LLM 주도섹터 콜 추가 시 hardcap 50만 내 별도 budget + provider 추상화. D30 no-apply 유지(forward 게이트 통과 전 "예측" claim 금지).
- **왜 별도 spec**: Python 생성 단계 + 신규 shadow table + (선택)LLM role = Track 1보다 blast radius 큼. 별도 설계·리뷰 루프 필요.

---

## §6 Statistical validation (stage 1+, stage 0 아님)

stage 0은 관측만. PASS/FAIL 산출·claim unblock 금지. 아래는 PR-A5가 별도 spec에서 실행 가능하게 구체화해야 할 **검정 요구조건**이며, outcome/가격소스/수익률 horizon이 확정되기 전에는 어떤 verdict도 금지한다.

### 6.1 unit of analysis
Primary unit = `(arm, track, period_key)`. short=weekly(`n_periods ≥ 6`), midlong=monthly(`n_periods ≥ 6`) 전 verdict 금지. full-30 verdict는 별도 full-30 snapshot이 short+midlong period를 join하기 전까지 무효.

### 6.2 same-count random null (stage 1에서 구성)
사전등록: universe = 같은 period·track·active timeframe의 worker-available 후보 풀(**current Tier0 track slice + incumbent carry-ins 포함**). count = active timeframe별 selected count(short10/mid10/long10). no replacement. incumbent-only 후보는 별도 flag/stratum으로 보고하되 random universe에는 포함(실제 worker가 볼 수 있으므로). sleeve metadata 없으면 sleeve-stratified null 주장 금지(active-timeframe stratification만). seed는 kill-rule 파일에 commit. random row는 `(period_key, track, seed, universe_hash)`로 재현. **stage 0은 raw selected/not_selected/counterfactual_cut만 로깅; universe_hash·seed·random-row 자료화는 stage 1 spec 소관**(stage 경계 명시).

### 6.3 Stage 1 executable-stats contract (PR-A5 blocker)
PR-A5는 Gate 계산 전 아래를 SQL/코드로 고정해야 한다. 하나라도 없으면 `INCOMPLETE_RUN`, PASS 금지.
- outcome source table/view와 price source(KRX EOD 등) 명시.
- track별 realization horizon/return formula/benchmark(excess-return 여부) 명시.
- transaction cost/slippage assumption(0이면 0이라고 명시) 고정.
- `selected`/`not_selected`/random-baseline snapshot의 `universe_hash`와 seed materialization.
- missed post-finalize logs는 PR-A4 reconcile로 `logged` 또는 `incomplete_run` 확정.

### 6.4 gates
| Gate | Rule | Fail/abort |
|---|---|---|
| A **worker-pool in-pool rerank lift** | arm의 worker-pool in-pool rerank lift vs same-count random, CI90 lower>0, ratio>floor | CI lower≤0 / random row 부재 → FAIL/INCOMPLETE |
| B rank skill | IC IR ≥ 0.30 on same unit | p 부재 또는 0.05<p<0.15 → ADJUDICATE |
| C size/coverage | 필요 metadata 있을 때만; 없으면 NOT_APPLICABLE(≠PASS) | sleeve metadata 없이 sleeve discipline 주장 → INVALID_INPUT |
| FWER | per-arm α를 동시검정 arm×track 수로 보정 | 단일 arm/period pass는 PASS 아님 |
> **Gate A 명칭 정정**: 구 retrieval/recall 계열 → **"worker-pool in-pool rerank lift"**. 이는 사용자의 150-recall(시장 리더 포착)을 측정하지 **않으며**, worker-available pool 내 same-count random 대비 재정렬 리프트만 측정한다. 해당 구식 metric 명칭은 쓰지 않는다. cross-track 상관(같은 섹터가 short·midlong 양쪽 등장)은 stage 1+ full-30 snapshot 설계에서 별도 처리; stage 0은 track-scope 독립 검정만.

`triple_gate=true`는 적용 가능 게이트 전부 pass + boolean이 게이트 필드와 일치할 때만. 불일치 → `INVALID_INPUT` abort.

### 6.5 missing / stale (verdict abort = INCOMPLETE_RUN)
`n_periods` 미달 / 검정 arm 누락 / 실현 PnL·backfill 누락 / `run_date` stale / **`regime asOf` stale**(평가 period보다 후행) / random baseline 재현 불가.

> **PR-A1 as-built 주의 (ce-* ADV-1, PR-A5가 반드시 흡수)**: PR-A1의 `candidate-pool-hard-gate`는 열화(⚪) 종목을 selectability에서 제외한다(D-10). production degradation은 all-or-nothing(⚪ ⟺ weighted_scores 전부 0)이라 production-shaped 입력에선 발산 없지만, **hard-gate `incomplete_run`은 sector-cut underfill뿐 아니라 degradation 제외로도 발생**할 수 있다. 따라서 stage-1이 hard-gate arm의 "in-pool rerank lift"를 계산할 때 분모/선정에서 production이 유지했을 열화 leading-sector 종목이 빠진다는 점을 반영해야 한다(sector-gate 효과와 degradation-drop을 conflate 금지). PR-A1 코드 영향 0(stage-0 관측, default-OFF).

### 6.6 claim discipline
stage 1+ 유효 PASS 전까지: "상승 예측"·"outperformance"·"sector will lead" 금지. production K>0 금지. shadow claim 기반 Tier1/portfolio 비용증가 금지. UI 어휘 "shadow counterfactual observation"까지만.

---

## §7 Cost / flags

| flag | default | scope |
|---|---|---|
| `FORWARD_SHADOW_ENABLED` | false | route/worker가 `logShadowArms` 주입 또는 skip |
| `SHADOW_EVAL_K` | 0 | shadow 전용 K. nonzero는 pre-registration 필요 |
| `SHADOW_SECTOR_SOURCE` | `absent` | `absent` 또는 `manual_pre_registered`만(그 외 값은 `invalid_input`) |
| `SHADOW_REGIME_SOURCE` | `absent` | `absent` 또는 `manual_pre_registered`(asOf lock). 그 외 값은 `invalid_input` |
| `SHADOW_LOG_FAILURE_ALERT_ENABLED` | true | best-effort pipeline health alert |

Track 1 flag에서 제거: `TIER0_RESERVE_ENABLED`, `SECTOR_ADVISOR_ENABLED`, cost hardcap `armFilter`.

**K 결정 = stage 0 진입 선결 게이트(§12 open item 아님)**: USER가 (i) plumbing-only(K=0) + 하드 종료조건(예: 2주 후 nonzero 자동제안) 또는 (ii) 처음부터 작은 nonzero K 중 명시 선택. plumbing-only는 종료조건 없으면 "측정했는데 답 없음"으로 무한 정체 위험. **nonzero K여도 Track 1은 생성 단계 150-recall이 아니라 worker-pool 30-reranking만 측정함을 재경고.**

**cost rule**: Track 1은 LLM 호출 0(이미 지불한 panel/judge 재사용). `getMonthlyTotal`/`preflightHardcap`에 `armFilter` 추가 금지(`cost_log`에 arm 컬럼 없음 → production spend undercount 위험). future sector advisor는 별도 budget/ledger.

---

## §8 Python ↔ TS parity
Track 1은 Python ranking·TS Tier0 consumer를 변경 안 하므로 parity 위험 없음(구 draft의 "Python↔TS reserve tie-break parity" 문구 삭제). **Track 2(generator-shadow)가 Python reserve를 재도입하면**: ticker 정렬 `/^[0-9]{6}$/` + ASCII comparator 고정, 비-ticker 문자열 locale 회피, golden vector로 Python emit 순서 vs TS consumer 순서 비교, 신규 jsonb metadata는 PostgREST round-trip 테스트.

---

## §9 Simpler alternatives considered

| Alternative | Decision | Reason |
|---|---|---|
| `tier1_selection_job.arm` 추가 + arm별 panel 재실행 | Reject | 비용 multiply; claim/CTE 표면 증가; arm은 post-finalize counterfactual이라 불필요 |
| `reserve_provenance` to `tier0_candidates_150` | Reject | production-table no-change 경계 위반; 관측에 불필요 |
| `sector_advisor` role 지금 추가 | Reject | model registry/pricing blast radius; Track 1은 plumbing 검증에 신규 LLM 불요 |
| `runTier1Screening`/portfolio prompt에 regime/sector 주입 | Reject (Track 1) | 실제 선정/포트 behavior 변경 = 관측 아님 |
| Post-persist shadow logger (Track 1) | Accept | 최소 default-off 경계; production 실패모드 불변. **단 생성 단계 150-recall 미측정** |
| **Generator-shadow (Track 2): Python Tier0 옆 sector-aware shadow 150 → shadow-150 recall vs production-150 recall forward 비교** | **Defer to separate spec (권고 채택)** | **사용자 원질문(150-recall)을 답하는 유일한 설계.** Track 1로는 불가. blast radius 커서 별도 spec |
| candidate-pool-hard-gate (Track 1) | shadow-only counterfactual | pool을 shrink만 함 → recall 못 올림(진단용). market full-universe 아님 |

---

## §10 PR decomposition (Track 1)

| PR | Scope | Files | Production effect |
|---|---|---|---|
| PR-A1 ✅ | Pure `computeArmSelections` + tests (track-aware fixture, invalid source throw, no-mutation 테스트). **구현 ✅ Claude↔omxy CONVERGED** (2026-06-23, `2e5c98c`): 4 arm 1-call 산출, source-discriminated union, periodAnchorInstant + tz-aware 캘린더 검증, soft-reserve K-bounded 치환(열화/전 track pick reserve 제외), hard-gate production-시퀀스 재선정 + counterfactual_cut + underfill→incomplete_run, symmetric fail-closed, 44 tests(golden parity full-signature 포함) | `shadow-harness-arms.ts` + `__tests__/shadow-harness-arms.test.ts` + `persona-eval.ts`(compareForTimeframe export) | none (dormant default-OFF; PR-A2 wiring 전까지 import 0) |
| PR-A2 ✅ | Worker optional DI seam, **finalizeSelection 내부 finalized 경로** logger 호출, default OFF. **구현 ✅ Claude↔omxy CONVERGED (2026-06-23, `643a8ce`)**: `shadow-arm-logger.ts`(createShadowArmLoggerFromEnv env gate + readShadowConfigFromEnv fail-closed[unknown source/non-int K→configError→runtime throw, construction-safe] + logShadowArmsWithConfig: computeArmSelections→4 arm upsert RPC[0038], per-arm shadow_eval_k) + `logShadowArms?` optional DI + seam(post-persist·markFinalized·return-true 직전·structuredClone 격리·best-effort warning[NOT failed]·money-path 무차단) + route 주입. ce-* correctness/adversarial CLEAN, REL-1(no client-timeout) LOW DEFER. 14 tests | `shadow-arm-logger.ts` + `tier1-selection-batch-worker.ts` + `selection-worker/route.ts` + tests | none when flag OFF (byte-identical) · default OFF (FORWARD_SHADOW_ENABLED) · USER 잔여=flag enable + 0038 apply + (manual arm) sector/regime env 사전등록 |
| PR-A3 ✅ | Migration 0038(+RPC, begin/commit, RPC-only writes, immutable snapshot) + smoke tests. **구현 ✅ Claude↔omxy CONVERGED (2026-06-23, `5dca94b`)**: shadow_arm_log + upsert_shadow_arm_log(symmetric cast fail-closed[regex+int4 overflow guard·begin/exception·NULL/absent track·arm guard C1]·production-snapshot ON CONFLICT DO NOTHING immutable) + RLS(authenticated is_admin SELECT·anon RESTRICTIVE deny·service_role SELECT §5.2) + table DML grant 부재. docker-free PG16 smoke 39 ok PASS | `0038_shadow_arm_log.{sql,rollback.sql}` + `scripts/pg_smoke_0038.sh` | new shadow table only · migration FILE only(apply USER-only) |
| PR-A4 ✅ | Reconcile **REPORT**(missed shadow rows). **구현 ✅ Claude↔omxy CONVERGED (2026-06-23, `0f532ef`)**: backfill EXECUTOR 폐기(shadow arm 입력 ephemeral, PR-B4 전례) → report-only. `shadow_arm_reconcile.py`(RECONCILE_GAP_SQL MATERIALIZED-CTE: tier1_selection_run finalized LEFT JOIN shadow_arm_log; classify complete[4 arm present+production-snapshot logged; incomplete_run counterfactual=consumable §2.2 → complete, logged_arm_count로 surface] / partial[1-3 arm=torn write] / missing[0=shadow OFF or pre-loop crash] / anomaly[tamper, RPC-impossible] + fail-closed + prefix⟺track guard + null→[]) + 27 unittest + docker-free PG16 smoke. ce-* PRA4-1 HIGH(all-logged gate) REFUTED(over-block 정상 hard-gate underfill); A1 logged_arm_count observability만 추가. | `scripts/shadow_arm_reconcile.py` + `test_shadow_arm_reconcile.py` + `pg_smoke_0038_pra4.sh` | shadow table only · **read-only(no write)** · Stage 0 live logging non-blocking, Stage 1 harvest/kill 전 blocking(partial/anomaly) |
| PR-A5 (spec ✅) | Stage 1 harvest/kill evaluator. **별도 spec ✅ Claude↔omxy CONVERGED (2026-06-23, `69a8283`, `docs/superpowers/specs/2026-06-23-pathA-track1-pra5-verdict-evaluator.md`)**: USER-locked metric = per-timeframe mean forward return lift (PRIMARY, arm vs production-snapshot paired) + hit-rate (SECONDARY). Gate B=DIRECTIONAL_GATE_B_NA → full PASS Stage-1 구조적 unreachable(상한 DIRECTIONAL); beta-orthogonalized lift hard-blocker; forward-only. **구현(shadow_arm_eval.py)은 후속**. | 별도 spec `2026-06-23-...` | spec only · 구현 후 production effect 0 · USER 결정 전 verdict 0 |

Track 1 밖(명시): Python reserve, production `tier0_candidates_150` schema 변경, `MODEL_REGISTRY` 신규 role, portfolio prompt/regime 변경, production hard-gate. **Track 2(generator-shadow) = 완전 별도 spec.**

---

## §11 Review checklist (구현 전)
- [ ] Diff가 production table을 안 건드림(0038 `shadow_arm_log` 추가만).
- [ ] `runTier1Screening` 시그니처 불변; `admin-tier0-candidates.ts` SELECT 불변; `MODEL_REGISTRY` 불변; `portfolio-proposal-client.ts` 불변.
- [ ] 인용 라인(finalizeSelection ≈1010–1112, persist ≈1089, markSelectionFinalized ≈1110, stale-skip ≈1049, getTier0Candidates ≈142–170, mergeFreshWithIncumbents ≈499)을 **구현 시점 코드로 재확인**.
- [ ] logger가 `finalizeSelection` 내부 finalized===true 경로에서만 호출(stale-skip 제외).
- [ ] default `FORWARD_SHADOW_ENABLED=false`가 byte-identical behavior.
- [ ] logger 입력 mutation 테스트(`computeArmSelections`가 `productionResult` mutate 시 실패).
- [ ] 0038 RLS/RPC가 service-role cron writer 패턴(SECURITY DEFINER, RPC-only writes, direct table DML revoke) 정합; `authenticated`/`service_role` table insert/update/delete grant **없음**; track↔period_key CHECK 정확; production-snapshot immutable.
- [ ] RPC pre-validation(month/period/track/arm/status regex+enum, production_k=0, payload size, canonical-sector/asOf, selected array/count/duplicate/active-timeframe, production-snapshot status/K) 동작.
- [ ] stage 0이 PASS/FAIL·claim unblock 안 함.
- [ ] SQL의 sector enum(`upsert_shadow_arm_log` `bad_canonical_sector`) == `CANONICAL_SECTORS` (14개 set 비교); `canonical-sectors.ts` 변경 시 재검증.
- [ ] Gate A 명칭이 "worker-pool in-pool rerank lift"이며, recall 계열 어휘가 metric/claim으로 쓰이지 않음(원질문 설명 문맥만 허용).
- [ ] §0 한정문(150-recall 미측정) + §12 USER 결정 명시.

---

## §12 USER 결정 / open items
1. **(선결) 트랙 결정**: (a) Track 1만(30-reranking 관측, 원질문 미답 수용) / (b) Track 2 별도 spec(150-recall 원질문 답) / (c) 둘 다. **권고 = (b) 또는 (c)**.
2. **(선결) K 결정**: plumbing-only(K=0)+종료조건 vs 처음부터 작은 nonzero `shadow_eval_k`.
3. **regime arm**: stage 0에서 제외 vs `manual_pre_registered`(asOf lock)로 활성.
4. sector hypothesis: manual pre-registration vs future LLM sector advisor 별도 spec.
5. full-30 materialized 평가를 track-scoped logging 안정화 후 추가할지.
