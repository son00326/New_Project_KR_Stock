# PR-K Reflection (AI 자가 학습) · shadow-first 빌드 spec

- **Status**: ✅ **빌드 완료 (dormant) + 마이그 0043 production applied(2026-06-27, version `20260627120308` · empty·dormant table)**. 코드 flag off(REFLECTION_ENABLED) → 선정 byte-identical·무동작·reflection_log write 0. 결정 SoT = `docs/superpowers/specs/2026-06-24-reflection-prk-pre-launch-promotion.md`(D32) + `ServicePlan-Admin §1A.5 D32`.
- **Date**: 2026-06-27
- **Author**: Claude (이어서 진행 · ultracode) ↔ omxy R-debate
- **수렴**: Claude dynamic-workflow 5-lens 적대 리뷰(4 HIGH catch+fix) → omxy §2.0a R1 적대 검토(7 confirmed defect 직접 수정 — LLM fail-closed/atomic claim/예측 출력 필터/now seam/period_key 정규식) → Claude 2차 독립 검증(게이트 green·테스트 substantive·H1 보존) **CONVERGED**. 게이트 green(build/lint/test:ci 2345/tsc + PG smoke 0043). **코드 flag dormant(REFLECTION_ENABLED off → 선정 byte-identical·무동작)** + **마이그 0043 production applied(2026-06-27 — empty·dormant table, 코드가 flag off라 write 0).**
- **Scope guardrail**: **shadow-first / dormant** — `REFLECTION_ENABLED=false`(default) → 회고 job 미실행 + 선정 prompt **byte-identical**(선정 무회귀·mutation 0). 실 선정/cron/KRX/snapshot 미가동 → 빈 입력 **fail-soft no-op**.
- **범주 분리(혼동 금지)**: PR-K Reflection(전체 회고 — 페르소나 강점 누적 → 선정 prompt 주입, track별 주기) ≠ **D27 Q5 incumbent thesis(선정 시점 per-incumbent 재점검, 구현됨 PR #91, `reflectionContext` seam)** ≠ M12a(뉴스 thesis-break 제거) ≠ G4(거시 컨텍스트). 서로 섞지 않는다. **두 seam은 별개 필드** — Q5 = `reflectionContext`(per-ticker), PR-K = `reflectionLearningContext`(run/track-level, 신규).
- **불변**: MVP 핵심 3종(30리스트/포트/30리포트, 65차 USER 잠금) = Reflection은 **대체 아님·launch-readiness 추가 항목**. **NO-CONFIG-PASSES / 예측 claim 영구 금지** — Reflection은 과거 실현 성과 *회고(retrospective)*지 미래 *예측*이 아님(문구·로그·DB에 명시). 이메일/Resend 전역 미사용.

---

## 0. 한 줄 요약

직전 finalize된 선정 사이클(track별)의 **평가 후보 풀(전체 평가군 — `tier1_selection_job` done) 실현 수익률**(KRX EOD entry→current, **무비용**) 산출(선정 30 subset 아님 — short_list_30 rolling 교체로 period별 선정 subset historical source 부재) → **페르소나별 적중률·conviction-가중 수익률**(pure `computeReflectionMetrics`) → forward-validate 회고 컨텍스트(pure `buildReflectionContext`) → `reflection_log`(per-persona jsonb + 주입 스냅샷) 영속 → 다음 선정 W1 패널 prompt에 **신규 `reflectionLearningContext` 필드**로 주입(off→byte-identical, macro/negative-news 패턴). (선택) 페르소나 케이스 LLM 요약은 별도 default-OFF flag + hardcap reservation.

---

## 1. 모듈 레이아웃 (D1) — `src/lib/reflection/`

| 파일 | 종류 | 책임 |
|---|---|---|
| `types.ts` | pure types | `ReflectionTrack`(= SelectionTrack 'short'\|'midlong') + `CycleSelection`(ticker + panel PersonaScore[]) + `PersonaReflectionMetric` + `ReflectionMetrics` + `ReflectionLogRow` + `ReflectionRunResult` |
| `config.ts` | pure const | `FAVORED_CONVICTION_THRESHOLD=50`(중립 midpoint) · `DEFAULT_CONTEXT_MAX_PERSONAS=5` · `REFLECTION_PRICE_SOURCE='KRX_EOD'` |
| `flags.ts` | env seam | `isReflectionEnabled()`(`REFLECTION_ENABLED`) · `isReflectionLlmSummaryEnabled()`(`REFLECTION_LLM_SUMMARY_ENABLED`, default false) — pure 모듈은 env 미접근(유일 경계) |
| `metrics.ts` | pure | `computeReflectionMetrics(input): ReflectionMetrics` — 실현 수익률 + per-persona 적중/가중수익, 가격 누락 fail-soft(priced:false) |
| `reflection-context.ts` | pure | `buildReflectionContext(metrics, opts): string` — forward-validate 면책 헤더 + 강점 페르소나 top-N digest, 빈/null → "" |
| `ledger.ts` | pure | `buildReflectionLogRow(input): ReflectionLogRow` — period/track/finalized_at/selected_count/metrics jsonb/snapshot/price-basis 조립 |
| `reflection-source.ts` | source seam | `getReflectionLearningContextString({track, fetchLatest?}): Promise<string>` — flag off / fetcher 미주입 / row 부재 → "" (negative-news 패턴) |
| `orchestrator.ts` | DI coordinator | `runReflectionJob(deps): Promise<ReflectionRunResult>` — gate → prior cycle 적재 → 가격(KRX) → metrics → (선택)LLM 요약(cost-gated) → snapshot → 영속. 모든 IO는 DI |

데이터 레이어: `src/lib/data/admin-reflection.ts` =
- `insertReflectionLog(row, {client})` — service-role **upsert**(onConflict `month,track,period_key`) **idempotent**(재실행 중복 0). 단일 테이블 → SECURITY DEFINER RPC 불요(m12a 패턴).
- `getLatestReflectionLog({track, client})` — 최신(**finalized_at desc** — 회고 대상 사이클 recency, created_at INSERT 시각 아님; backfill robust) reflection_log 1건 → 주입 스냅샷 source. + `claimReflectionLog(row, {client})` — atomic insert-claim(unique_violation 23505→false), LLM 요약 cost-idempotency. + `reflectionExists` 폐기(claim으로 대체).
- `getPriorFinalizedCycle({track, now, client})` — 가장 최근 finalize된 `tier1_selection_run`(track, finalized_at not null, < now) 1건.
- `getCyclePanels({periodKey, client})` — 해당 run의 `tier1_selection_job`(status done, panel_result not null) → `CycleSelection[]`.

---

## 2. DB — 마이그 0043 `reflection_log` · ✅ **production applied (2026-06-27, version `20260627120308`)**

`0043_reflection_log.sql` + `.rollback.sql` + `scripts/pg_smoke_0043.sh`(docker-free PG). **cost_log와 분리**(별 테이블). **production apply 검증**: 10 CHECK + RLS admin-only policy + unique(month,track,period_key) + FK 0 + 4 indexes + SECURITY DEFINER 0 + anon 기본 grant(RLS default-deny 무력화 — short_list_30/stock_reports/portfolio_snapshot와 동일 패턴) + get_advisors(security) reflection_log 신규 finding 0. table empty(dormant — REFLECTION_ENABLED off면 미기록).

```sql
create table if not exists public.reflection_log (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$'),  -- YYYY-MM-01 (회계/감사 정합)
  track text not null check (track in ('short','midlong')),
  period_key text not null check (
    period_key ~ '^(s:[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])|m:[0-9]{4}-(0[1-9]|1[0-2]))$'
  ),                                             -- 's:YYYY-MM-DD' | 'm:YYYY-MM' (회고 대상 사이클; idempotency 키 보호)
  finalized_at timestamptz not null,             -- 대상 run의 finalize 시각
  reflection_kind text not null default 'retrospective'
    check (reflection_kind = 'retrospective'),   -- 예측 아님 박제(코드+DB 양면)
  selected_count int not null check (selected_count >= 0),
  priced_count int not null check (priced_count >= 0 and priced_count <= selected_count),
  overall_hit_rate numeric(6,4)
    check (overall_hit_rate is null or (overall_hit_rate >= 0 and overall_hit_rate <= 1)),
  overall_avg_realized_return numeric(12,6),     -- 손실 가능 → 음수 허용(CHECK 없음)
  per_persona_metrics jsonb not null,            -- PersonaReflectionMetric[] (적중률·가중수익·표본)
  injected_context_snapshot text,                -- 주입한(될) 회고 컨텍스트 스냅샷(감사)
  price_source text check (price_source is null or price_source = 'KRX_EOD'),
  price_basis_entry_date text
    check (price_basis_entry_date is null or price_basis_entry_date ~ '^[0-9]{8}$'),
  price_basis_current_date text
    check (price_basis_current_date is null or price_basis_current_date ~ '^[0-9]{8}$'),
  created_at timestamptz not null default now(),
  unique (month, track, period_key)              -- idempotent upsert 키
);
create index if not exists reflection_log_track_period_idx
  on public.reflection_log (track, period_key, created_at desc);
create index if not exists reflection_log_month_idx on public.reflection_log (month);
alter table public.reflection_log enable row level security;
-- RLS: admin all (authenticated + is_admin), 0042 m12a 패턴. cron = service-role(RLS 우회).
--   단일 테이블 upsert → SECURITY DEFINER RPC 불요. cost_log와 무관(분리).
```

- enum 확장 0 / 신규 SECURITY DEFINER 0(단일 테이블 service-role upsert). RLS admin-all 단일 정책.
- 미적용이어도 안전(flag off → job 미호출). PG smoke: 테이블/제약(month·track·priced≤selected·hit_rate 범위·period date)·unique upsert idempotency·RLS enabled·rollback.

---

## 3. 결정론 로직 (pure)

### 3.1 실현 수익률 + per-persona 메트릭 — `computeReflectionMetrics(input)`

입력:
```
{ selections: { ticker, panel: PersonaScore[] }[],   // finalize된 사이클 평가 후보 풀(평가군, 선정 30 subset 아님) + 11-persona 패널
  entryPrices: Map<ticker, number>,                  // KRX EOD close @ 사이클 finalize 거래일
  currentPrices: Map<ticker, number>,                // KRX EOD close @ 회고 실행 거래일
  personaRoster: string[] }                          // CORE_11 persona_id (권위 명부 — 누락 페르소나도 표본 0으로 표기)
```

- **ticker 실현 수익률** `r = priced ? (current - entry) / entry : null`. priced = entry>0 && current>0 둘 다 존재. (수익률은 비율 — 0.05 = +5%.)
- **per-persona**(priced 종목 중 해당 persona가 채점한 것만):
  - `favored` = `conviction >= 50`(중립 midpoint). `hit` = (favored && r>0) || (!favored && r<=0) → 페르소나 확신이 결과와 정렬됐는가.
  - `hitRate` = hits / pricedSampleSize (표본 0 → null).
  - `convictionWeightedReturn` = Σ(conviction·r) / Σ(conviction) (Σconviction=0 → null) — 확신 높은 픽이 잘 됐을수록 ↑.
  - `avgConviction` = mean conviction.
  - `sampleSize` = priced 표본 수.
- **overall**: `overallAvgRealizedReturn` = priced r 평균(null if 0), `overallHitRate` = priced 중 r>0 비율(null if 0). `pricedCount`/`selectedCount`.
- **결정론·순수**: env/IO/Date.now 없음. 정렬·tie 규칙 고정(persona_id asc 출력 순). 가격 전부 누락 → 전부 null·priced 0(fail-soft, throw 아님).

> ⚠️ **회고지 예측 아님**: 메트릭은 *과거 실현* 정렬도이며 미래 수익 예측이 아니다. claim·로그·컨텍스트 문구에 예측 어휘 0.

### 3.2 회고 컨텍스트 — `buildReflectionContext(metrics, opts)`

- 빈 입력(selectedCount 0 또는 pricedCount 0) → `""`(dormant — consumer가 아무것도 append 안 함).
- 비어 있지 않으면: forward-validate 면책 헤더 `[직전 사이클 평가군 회고 · AI 컨텍스트 입력(평가 후보 풀 과거 실현 성과 · 예측 아님 · Tier0 스크리닝 팩터 아님)]` + 1줄 요약(평균 실현 수익률·적중 N/M, raw `overallHitCount` 사용) + **강점 페르소나 top-N**(convictionWeightedReturn desc, label) digest. 예측/전망 어휘 금지(테스트로 박제).

### 3.3 ledger row — `buildReflectionLogRow(input)`

metrics + 대상 사이클 메타(month/track/periodKey/finalizedAt) + price-basis(entryDate/currentDate/source) + `buildReflectionContext` 스냅샷 → `ReflectionLogRow`. `per_persona_metrics`는 `PersonaReflectionMetric[]` 그대로(jsonb). reflection_kind='retrospective'.

---

## 4. orchestrator (DI) — shadow-first

`runReflectionJob(deps)`:
1. `if (!isReflectionEnabled()) return { skipped:true, reason:'flag_off' }` — dormant(비용/영속 0).
2. `const cycle = await deps.getPriorFinalizedCycle({ track })`. 없으면 `{ skipped:true, reason:'no_finalized_cycle' }` — **fail-soft no-op**(cron-live/선정 미가동 커버).
3. `const selections = await deps.getCyclePanels({ periodKey: cycle.periodKey })`. 비면 `{ skipped:true, reason:'no_panels' }`.
4. 가격(KRX EOD·**무비용**): `const { entryPrices, currentPrices, entryDate, currentDate } = await deps.resolvePrices({ tickers, finalizedAt: cycle.finalizedAt })`. 실패/부재 → 빈 Map(fail-soft → metrics 전부 null·priced 0, throw 아님).
5. `const metrics = computeReflectionMetrics({ selections, entryPrices, currentPrices, personaRoster })`.
6. **(선택) LLM 케이스 요약 — fail-closed + degrade-don't-abort(omxy R1 §10)**: `if (isReflectionLlmSummaryEnabled() && deps.summarize && metrics.pricedCount>0)` 진입; **`deps.preflight`·`deps.claimReflectionLog` 둘 다 필수**(부재 시 요약 skip + base 영속). `claimed = await deps.claimReflectionLog(baseRow)`(atomic insert-claim) → claimed면 `await deps.preflight()`(하드캡 throw → catch → 요약 skip·burn 0) → `deps.summarize(metrics)`(transient throw → catch → degrade) → 성공 시 snapshot에 부가; **claim 실패(23505)면 다른 runner 소유 → 최종 upsert도 skip**(overwrite·re-burn 방지). 무비용 base 회고는 항상 영속(degrade-don't-abort). default OFF / 빈 가격 → skip(**무비용**).
7. `const snapshot = buildReflectionContext(metrics, {...})`.
8. `const row = buildReflectionLogRow({ metrics, cycle, priceBasis, snapshot, llmSummary })`.
9. `await deps.insertReflectionLog(row)` — **idempotent upsert**(month,track,period_key).
10. return run summary(track, periodKey, selectedCount, pricedCount, overall*, skipped:false).

**불변식**: flag off → (2~9) 미실행(영속/비용 0). prior cycle 부재 / 가격 부재 → no-op·null metrics(throw 아님). 기본 경로 LLM 0콜(무비용) — 요약은 별 flag + reservation.

---

## 5. 배선 (dormant·byte-identical when off)

- **render-user-prompt.ts**: `reflectionLearningContext?` schema 추가 + supplementary suffix 3번째(macro → negative-news → **reflection** 순)로 조건부 append. 빈 값 → byte-identical. **Q5 `reflectionContext`(per-ticker, `{{REFLECTION_CONTEXT}}` placeholder)와 별개 필드·별개 블록**.
- **anthropic-client.ts** `CallPersonaInput`: `reflectionLearningContext?` 추가 → renderUserPrompt 전달.
- **persona-panel-adapter.ts** `CallPersonaPanelDeps`: `reflectionLearningContext?`(run/track-level, macro 패턴) 추가 → makeCallPersonaPanel + makeCallDebatePanel 양쪽 callPersona 전달. **per-call Q5 `reflectionContext` override는 불변**(별개 인자).
- **selection-worker/route.ts**: **per-track 루프 내** `const reflectionLearningContextString = await getReflectionLearningContextString({ track: t.track, fetchLatest: (tr) => getLatestReflectionLog({ track: tr, client: supabase }) })` 1회 계산(track-scoped — macro/negative-news는 global이나 reflection은 **track별**) → 두 패널 deps에 주입. `getReflectionLearningContextString`이 `isReflectionEnabled()` off면 **DB read 없이 ""** → 선정 byte-identical. flag on이면 최신 reflection_log 스냅샷 주입. **LIVE selection-worker 경로 배선**(G4 lesson [[feedback_ai_context_seam_live_path]] — dangling 금지).
- **cron**: 신규 라우트 `src/app/api/cron/reflection-job/route.ts` — auth(CRON_SECRET) → `REFLECTION_ENABLED` 게이트(200 skip·spend 0) → service-role client → due tracks(short+midlong) 각각 `runReflectionJob` → 부분실패 격리(per-track try/catch) → 200/요약. **vercel.json 무변경**(production schedule 추가 = USER go-live·외부 스케줄; 본 라우트는 schedule 없이도 dormant-correct·수동 호출 가능). M12a가 morning-briefing에 hook한 것과 달리 reflection은 전용 라우트(track-cadence 독립).

---

## 6. 게이트 강도(spec §6 Q1) + 트랙 타이밍 + 비용 (결정)

- **게이트 강도 분리**: PR-K **빌드 완료 = S9 진입 sequencing 선행조건(hard prereq)**. Reflection **동작·품질 = soft launch criterion**(§2.2 7-criteria **미변경** — 버그/미성숙이 출시 hard-block 아님). 본 빌드는 메커니즘 완비가 목표.
- **트랙 타이밍 fail-soft(§4)**: 단기(주1) = S9 내 여러 회고 사이클 → S9 중 검증 용이. 중·장기(월1) = S9 길이·첫 선정일 의존(S9 ~2개월 미만이면 1회고 미발생 가능) → `getPriorFinalizedCycle` 부재 시 no-op fail-soft. cron-live/KRX/snapshot 미가동 → 빈 입력 no-op. 회고 대상 = "현재 미finalize period가 아닌, 가장 최근 finalize된 prior 사이클"(현재 진행 사이클 회고 금지).
- **비용(spec §6 Q5)**: 기본 회고 job = **무비용**(실현 수익률 = KRX EOD only). LLM 케이스 요약은 **별도 default-OFF flag**(`REFLECTION_LLM_SUMMARY_ENABLED`) + **hardcap reservation**(`preflightHardcap` lines = callCount × `getRoleWorstCaseMaxCostPerCallKrw(role)`, 50만 hardcap 정합) + 실 비용 게이트(`AI_COST_LOG_REAL_INSERT_ENABLED`). 테스트는 실 AI mock(₩0).

---

## 7. 테스트 (mutation-resistant·dormancy pin·vacuous 0)

- **metrics**: 적중 경계(favored conviction 50 경계 + r>0/≤0 4사분면 mutation pin) · conviction-weighted return 수식 정확 · 가격 누락 fail-soft(priced false·null, throw 0) · 전부 누락 → overall null · persona roster 누락분 표본 0 · 음수 수익률.
- **reflection-context**: 빈/null → "" · 비어있지 않으면 면책 헤더 포함·예측 어휘 0 · top-N 강점 정렬(weighted desc) · maxPersonas cap.
- **flags**: default false 박제(REFLECTION_ENABLED + REFLECTION_LLM_SUMMARY_ENABLED) + env true 전환.
- **ledger**: row 필드 매핑 정확 + reflection_kind='retrospective' + snapshot = buildReflectionContext 일치.
- **orchestrator**: **dormancy pin**(flag off → insert/preflight/summarize 0콜·skipped) · prior cycle 부재 no-op · 가격 부재 fail-soft(null metrics + 영속은 진행) · 기본 경로 LLM 0콜(summarize DI 미호출) · LLM flag on + DI → preflight→summarize 호출 · upsert 1회.
- **reflection-source**: flag off → "" (fetchLatest 미호출=DB read 0) · row 부재 → "" · row 존재 → snapshot 반환.
- **배선**: render-user-prompt reflectionLearningContext "" → byte-identical(macro/negative-news와 동시) + non-empty 3-block append 순서(macro→negative→reflection). **Q5 seam 분리 회귀**: `reflectionContext`(per-ticker) + `reflectionLearningContext`(run-level) 동시 주입 → 두 별개 블록 생성·상호 무간섭.
- **연결포인트 end-to-end**: cron route(flag off → 200 skip byte-identical / flag on → runReflectionJob 호출) + orchestrator(prior cycle→metrics→reflection_log) + source seam(reflection_log→선정 컨텍스트) — cron→회고 job→reflection_log→다음 선정 prompt 주입 전 구간.
- **admin-reflection**: 입력 검증(month/track/period_key) + upsert idempotent payload + getLatest/getPriorFinalizedCycle/getCyclePanels 쿼리 shape.

검증 게이트: build + lint + test:ci + tsc + docker-free PG smoke 0043.

---

## 8. 가드레일 체크리스트 (완료 판정)

- [ ] shadow-first: `REFLECTION_ENABLED` off → 선정 prompt byte-identical(선정 무회귀) + 회고 미실행 + mutation 0 — 코드 guard + dormancy pin 테스트.
- [ ] 범주 분리: Q5(`reflectionContext` per-ticker) / M12a / G4와 별개 필드·별개 블록 — `reflectionLearningContext` 신규 + seam 분리 회귀 테스트.
- [ ] MVP 3종 불변 — Reflection은 추가 항목(대체 아님).
- [ ] fail-soft no-op: cron-live/KRX/snapshot 미가동 / prior cycle 부재 → 빈 입력 no-op(throw 0).
- [ ] 예측 claim 0: reflection_kind='retrospective'(DB CHECK) + 컨텍스트 면책 + 예측 어휘 0 테스트.
- [ ] no-email: 이메일/Resend 호출 0(전 모듈).
- [x] 마이그 0043 ✅ production applied(empty·dormant table — 코드 flag off라 write 0) + .sql/.rollback 짝 + PG smoke 0043 + cost_log 분리.
- [ ] 비용: 기본 무비용(KRX) + LLM 요약 별 flag + hardcap reservation + 실 비용 게이트.
- [ ] 연결포인트 end-to-end(cron→job→reflection_log→선정 주입) 테스트로 배선 검증(LIVE selection-worker 경로, dangling 금지).

## 9. USER-only 게이트 (CLAUDE 미실행 — 체크리스트만)

`REFLECTION_ENABLED=true` + (선택)`REFLECTION_LLM_SUMMARY_ENABLED=true` + `SELECTION_CRON_AUTO_ENABLED=true`(선정 가동) + ~~마이그 0043 apply~~ **✅ 0043 production applied (2026-06-27)** + `KRX_OPENAPI_KEY`(실현 수익률) + AI 키/비용 승인(LLM 요약 시) + **reflection-job 스케줄(vercel.json 또는 외부)** 추가. CLAUDE는 명령/체크리스트만, 실행 X.

⚠️ **scheduling 비대칭(go-live 페어 액션)**: `REFLECTION_ENABLED`는 read seam(selection-worker가 reflection_log 조회→주입)과 write seam(reflection-job이 reflection_log 기록) **둘 다** 게이트한다. read는 selection-worker daily cron에 올라타지만 **write(reflection-job)는 vercel.json에 schedule 미등록**(CLAUDE는 production schedule 미변경 — USER). flag만 켜고 reflection-job을 스케줄 안 하면 read는 빈 결과("")→byte-identical로 **조용히 무동작**(에러 없음). go-live 시 flag flip + reflection-job schedule(직전 사이클 finalize 후·다음 선정 전 발화)을 **함께** 처리한다.

## 10. omxy R1 적용 사항 (as-built — §3/§4/§6 보강)

- **LLM 요약 fail-closed(orchestrator)**: `REFLECTION_LLM_SUMMARY_ENABLED` + `deps.summarize` + **`pricedCount>0`** + **`deps.preflight`** + **`deps.claimReflectionLog`** 전부 충족해야 요약 실행. 빈 가격/DI 부재 → 요약 skip + 무비용 base 회고는 영속(degrade-don't-abort).
- **atomic claim(cost-idempotency)**: 구 `reflectionExists`(read-before-write, TOCTOU) → **`claimReflectionLog`(INSERT, unique_violation 23505→false)** 교체. 동시/재실행이 LLM 비용을 재지출하지 않도록 슬롯을 원자적으로 선점. base 경로(LLM off)는 idempotent **upsert** 유지(자유 갱신). **claim-once 트레이드오프**: LLM 경로에서 첫 시도 후엔 같은 사이클 재시도가 claim 실패(no-op)라 transient 요약 실패 시 그 사이클은 base-only로 남는다(재-burn 방지 우선 — 무비용 base 회고가 핵심이므로 허용).
- **예측 출력 필터(summarizer)**: provider 호출 전 cost gate(AI_COST_LOG + UUID + costPreflightReserved) + 응답에 예측 어휘(부정형 제외) 또는 retrospective 어휘 부재 시 `reflection_summary_prediction_claim` throw → 컨텍스트 주입 차단(보수적 — false-positive는 base로 degrade, 예측 누출 0 우선).
- **now seam**: `getPriorFinalizedCycle`에 `finalized_at < now` 가드(미래 finalize 사이클 오선택 차단).
- **period_key**: DB CHECK + TS 정규식 둘 다 full `'s:YYYY-MM-DD' | 'm:YYYY-MM'`.
