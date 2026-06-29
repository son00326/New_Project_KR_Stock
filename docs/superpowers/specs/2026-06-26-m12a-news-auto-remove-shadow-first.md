# M12a — 뉴스 기반 자동 제외 (AI 페르소나) · shadow-first 빌드 spec

- **Status**: BUILD spec (코드 빌드). spec SoT = `ServicePlan-Admin.md §3.10 R3.10-5~7g` + `S7-RealData.md S7b`.
- **Date**: 2026-06-26
- **Author**: Claude (이어서 진행 · ultracode) ↔ omxy R-debate
- **Scope guardrail**: **shadow-first** — `M12A_AUTO_REMOVE_ENABLED=false`(default) → would-remove/held_by_brake 이벤트 + 알림 + ledger만 기록, `short_list_30`/`portfolio_snapshot` **mutation 0**(byte-identical). 자동 제거 ON = 출시 후 fast-follow. **M12a 자동 mutation = 출시 게이트 아님**(§2.2 7-criteria 불변).
- **범주 분리**: M12a(per-ticker thesis-break 제거) ≠ G4(거시 컨텍스트 입력) ≠ M15 Exit(보유 매도 신호) ≠ D19 합의 배지(선정 신호) ≠ D27 incumbent thesis(정기 선정). 섞지 않는다.

---

## 0. 한 줄 요약

Core 11 AI 페르소나가 신규 뉴스를 평가 → 각 보유/리스트 종목별(per-company) **구조화 판정** 산출 → 결정론 `decideRecommendedAction`(direct+material+high-conf+thesis-break+affected → `auto_remove`, 그 외 `alert_only`) → run-level **smart brake**(>3건 / 트랙 70% floor / 집중포트 N<10) → **durable ledger**(`news_event` 1 + `m12a_ticker_assessment` N, `action_taken`=shadowed|held_by_brake|removed) → flag off면 shadow(mutation 0) / on이면 빼기만+freed→현금(KRX EOD) → **텔레그램 + `/admin/alerts` durable event + unread badge**(이메일 0) + 다음 선정 candidate-level negative-news context(additive·dormant).

---

## 1. 모듈 레이아웃 (D1) — `src/lib/news/m12a/`

| 파일 | 종류 | 책임 |
|---|---|---|
| `types.ts` | pure types | M12aScope/Directness/Materiality/Confidence/RecommendedAction/ActionTaken + `PerTickerAssessment`(AI 구조화 판정) + `M12aTickerLedgerRow`/`M12aNewsLedger` + `BrakeConfig`/`TrackSizes` |
| `config.ts` | pure const | `DEFAULT_BRAKE_CONFIG`(maxAutoRemovalsPerRun=3, listFloors short=7/midlong=14/full=21, concentratedPortfolioMax=10) |
| `flags.ts` | env seam | `isM12aNewsEvalEnabled()`(`M12A_NEWS_EVAL_ENABLED`) · `isM12aAutoRemoveEnabled()`(`M12A_AUTO_REMOVE_ENABLED`, default false=shadow) |
| `verdict.ts` | pure | `decideRecommendedAction(a: PerTickerAssessment): 'auto_remove'\|'alert_only'` (R3.10-6/7 결정론 게이트) |
| `brake.ts` | pure | `applySmartBrake(input): BrakeOutcome` (R3.10-7a run-level circuit breaker — whole-run hold, 부분 제외 없음) |
| `ledger.ts` | pure | `buildNewsLedger(input): M12aNewsLedger` (news_event 참조 + per-ticker rows, action_taken 귀속 = GAP1 m12a_risk_action) |
| `cashout.ts` | pure | `buildCashoutRecord(input)` (GAP2 freed→현금 = 최신 완료 KRX EOD 종가, price_basis_date/price_source=KRX_EOD/execution_assumption=virtual_eod) |
| `negative-news-context.ts` | pure | `buildNegativeNewsContext(rows, opts): string` (R3.10-7c 재진입 컨텍스트, forward-validate 면책, top-N cap, 빈 입력 → "") |
| `telegram-text.ts` | pure | `buildM12aTelegramText(input): string` (티커 + 뉴스 제목 30자 + 사유 1줄 + /admin/alerts 링크 — 이메일 0) |
| `orchestrator.ts` | DI coordinator | `runM12aNewsEvaluation(deps): Promise<M12aRunResult>` (collect→eval(AI)→verdict→brake→ledger→shadow/mutate gate→alert→cost, 모든 IO는 DI) |

데이터 레이어: `src/lib/data/admin-m12a.ts` = `insertM12aAssessments(rows, {client})`(service-role append, news-sweep `insertNewsEvents` 패턴) + (선택) `getRecentM12aAssessments({month, client})`(재진입 context source).

---

## 2. DB — 마이그 0042 (D2·D9) · DORMANT(USER apply-only)

`news_event` 1건 = **기존 0006 테이블 재사용**(이미 news-sweep가 수집). M12a는 그 위에 per-ticker 판정 1 테이블 추가.

> **2026-06-29 (news-sweep 유니버스 정합 · main cfb1bde)**: news-sweep 수집 범위가 활성 short_list_30(getActiveShortList)으로 전환됨 — 구 3종 하드코딩(005930/000660/035420) 제거. 이로써 news-sweep의 수집 유니버스가 M12a 평가 유니버스(동일 getActiveShortList)와 일치해, 선정 30종 중 일부만 news_event에 들어오던 굶음이 수집 단계에서 해소된다. **잔여 follow-up(이 변경 밖)**: M12a가 뉴스를 읽는 `getRecentNewsEvents({limit:50})`는 **전역 최근 윈도**라, 30종 유니버스에서 뉴스 많은 종목이 윈도를 잠식해 per-ticker 커버리지가 부분적 — universe-aware read(per-ticker fetch 또는 universe 필터+per-ticker cap, 또는 universe-relative limit)는 별도 작업으로 추적.

`0042_m12a_ticker_assessment.sql` + `.rollback.sql` + `scripts/pg_smoke_0042.sh`(docker-free PG):

```sql
create table if not exists public.m12a_ticker_assessment (
  id uuid primary key default gen_random_uuid(),
  news_event_id uuid not null references public.news_event(id) on delete cascade,
  run_id text not null,                 -- 1 eval run 그룹(브레이크 "1 run" 의미)
  month text not null,                  -- YYYY-MM-01 (cost/attribution 정합)
  ticker text not null check (ticker ~ '^[0-9]{6}$'),
  surface text not null check (surface in ('list','portfolio')),  -- 홈 리스트 vs 가상포트
  scope text not null check (scope in ('company','sector','market','unknown')),  -- 메타데이터(게이트 아님)
  severity text not null check (severity in ('critical','warning','info')),
  confidence text not null check (confidence in ('low','medium','high')),
  materiality text not null check (materiality in ('low','medium','high')),
  directness text not null check (directness in ('direct','indirect')),
  thesis_break boolean not null,
  thesis_break_reason text,
  recommended_action text not null check (recommended_action in ('auto_remove','alert_only','hold_for_review')),
  action_taken text not null check (action_taken in ('shadowed','held_by_brake','removed')),  -- GAP1 m12a_risk_action 귀속
  held_by_brake boolean not null default false,
  price_basis_date text,                 -- GAP2 (removed만)
  price_source text check (price_source in ('KRX_EOD')),
  execution_assumption text check (execution_assumption in ('virtual_eod')),
  alert_event_id uuid references public.alert_event(id) on delete set null,  -- optional link
  created_at timestamptz not null default now()
);
create index if not exists m12a_ta_month_ticker_idx on public.m12a_ticker_assessment (month, ticker, created_at desc);
create index if not exists m12a_ta_run_idx on public.m12a_ticker_assessment (run_id);
create index if not exists m12a_ta_news_idx on public.m12a_ticker_assessment (news_event_id);
alter table public.m12a_ticker_assessment enable row level security;
-- RLS: admin all (authenticated + is_admin), 0006 news_event 패턴. cron = service-role(RLS 우회), SECURITY DEFINER 불요(단일 테이블 append).
```

- enum 확장 0: `alert_event.alert_type` CHECK(12종) **불변**. M12a 알림은 기존 `news_critical`(auto_remove/alert_only) / `news_warning`(hold_for_review/mass) 재사용.
- 미적용이어도 안전: M12a worker는 dormant(flag off → 미호출). 0038/0039와 동일 USER apply-only.

---

## 3. 결정론 로직

### 3.1 verdict (R3.10-6/7) — `decideRecommendedAction(a)`
```
auto_remove  ⟺ a.thesisBreak && a.directness==='direct' && a.materiality==='high'
                && a.confidence==='high' && a.affectedTickers.includes(a.ticker)
else         → alert_only
```
- `scope`(company|sector|market|unknown)는 **게이트 아님**(메타데이터). 회사/섹터/거시 뉴스 모두 종목별 노출도로 차등 → affected + direct + material + high-conf만 auto.
- `hold_for_review`는 per-ticker가 아니라 **brake(run-level) 산출**. AI self-report action은 신뢰하지 않고 구조화 필드에서 **결정론 파생**(robustness).

### 3.2 brake (R3.10-7a) — `applySmartBrake({ candidates, listTrackSizes, listTrackRemovals, portfolioSize, portfolioRemovals, config })`
whole-run hold(부분 제외 없음). 아래 **하나라도** 트리거 → 모든 auto_remove → `held_by_brake`:
1. `candidates.length > config.maxAutoRemovalsPerRun`(기본 3 → 4건↑).
2. list track floor: 어떤 트랙이든 `size - removals < floor`(short<7 / midlong<14 / full<21).
3. portfolio: `N≥10`이면 `N - portfolioRemovals < ceil(0.7N)`; `N<10`(집중)이면 `portfolioRemovals ≥ 2`.
출력: `{ brakeTriggered, reason, perTicker: action_taken[] }`. 평상시(1~2건, floor OK) → 전건 통과.

### 3.3 cashout (GAP2) — removed만, shadow-only until S7c
`{ price: 최신 완료 KRX EOD 종가(resolveEntryPricesKrw 패턴), price_basis_date, price_source:'KRX_EOD', execution_assumption:'virtual_eod' }`. 가격 불명 → 자동 현금화 금지(fail-closed, 해당 ticker는 shadow 유지).

### 3.4 negative-news context (R3.10-7c) — additive·dormant
`buildNegativeNewsContext(recentRows, {maxItems})` → forward-validate 면책 헤더 + 종목별 최근 악재 1줄 digest(top-N). 빈 입력/flag off → `""`. **W2b incumbent seam·D27과 별개·additive**. 프롬프트는 macro 뒤 append(byte-identical when "").

---

## 4. orchestrator (DI) — shadow-first

`runM12aNewsEvaluation(deps)`:
1. `if (!isM12aNewsEvalEnabled() || !deps.aiAvailable) return { skipped:true }` (dormant → no cost/no mutation).
2. collect: `deps.getNewsCandidates()`(naver-api/news_event recent) + dedupeByUrl.
3. preflight: `deps.preflightHardcap({ month, lines })` (model-aware, getRoleWorstCaseMaxCostPerCallKrw('tier1_panel')). 초과 → throw(차단).
4. eval(AI): `deps.evaluateNews(candidates)` → `PerTickerAssessment[]` (cost_log INSERT은 callPersona 내부). 테스트는 mock.
5. verdict: per-ticker `decideRecommendedAction`.
6. brake: `applySmartBrake(...)` → action_taken 확정(shadowed|held_by_brake|removed).
7. mutate gate: `isM12aAutoRemoveEnabled()`?
   - **off(shadow)**: action_taken `removed` → `shadowed`로 강등. mutation 0.
   - **on**: removed 대상 → `deps.removeFromShortlist` + `deps.applyCashout`(freed→현금). (게이트 ON은 USER + 출시 후.)
8. ledger: `buildNewsLedger(...)` → `deps.insertM12aAssessments(rows)`.
9. alert: auto_remove/alert_only → news_critical / hold_for_review·mass → news_warning. `deps.insertAlertEvents([...])` + `deps.sendTelegram(buildM12aTelegramText(...))`(best-effort). alert_event_id ledger link.
10. return run summary(attentionTickers for M11).

**불변식**: flag off → (7) mutation 0 + (5/6/8/9) shadow 이벤트/ledger/alert만. AI 미가용/flag off → 전부 skip(byte-identical).

---

## 5. 배선 (dormant·byte-identical when off)

- **cron**: morning-briefing route(23:00 UTC=08:00 KST)에 `M12A_NEWS_EVAL_ENABLED` 게이트 1블록 추가 — off면 `attentionTickers:[]` 현행 유지(byte-identical). on이면 M12a run → attentionTickers 주입(R3.10-2). vercel.json 무변경.
- **재진입 seam**: `renderUserPrompt`/`CallPersonaInput`/`CallPersonaPanelDeps`/selection-worker route에 `negativeNewsContext?`(optional, macro 뒤 append) 추가 — **G4 macro 패턴과 동일**(검증됨). default "" → byte-identical·선정 무회귀.
- **3-layer(GAP1)**: `action_taken`(shadowed|held_by_brake|removed) = m12a_risk_action 귀속 ledger(층 ③). 층 ①선정 baseline·②live는 기존 portfolio_snapshot. track-record 리팩터는 out-of-scope(shadow-first).

---

## 6. 테스트 (mutation-resistant·dormancy pin·vacuous 0)

- verdict: auto_remove 정확 경계(각 조건 1개씩 깨뜨리면 alert_only로 떨어지는지 — mutation pin) + scope는 게이트 아님(market/sector도 affected+direct+material+high → auto).
- brake: 1·2·3건 통과 / 4건 mass-hold / 트랙 floor 위반(short 7 경계) / portfolio N≥10 floor / N<10 1-ok·2-hold / 트리거 중첩.
- cashout: KRX EOD basis 정확, 가격 불명 fail-closed(shadow 유지).
- negative-news-context: forward-validate 면책 포함·예측 어휘 0·빈 입력 "".
- flags: default false(shadow) 박제 + env true시 전환.
- orchestrator: **dormancy pin**(flag off → mutation 0 + skip), shadow phase(removed→shadowed + ledger/alert만), auto phase(mock DI mutate 호출), brake→held_by_brake, alert type 매핑(news_critical/news_warning), 이메일 호출 0.
- 배선: `renderUserPrompt` negativeNewsContext "" → byte-identical(macro 패턴) + non-empty append. morning-briefing off → byte-identical 응답.
- ledger: action_taken 귀속 정확 + alert_event_id link.

검증 게이트: build + lint + test:ci + tsc + (마이그) docker-free PG smoke 0042. 연결포인트: cron→eval→verdict→brake→ledger→alert end-to-end(orchestrator 테스트 + route 테스트).

---

## 7. 가드레일 체크리스트 (완료 판정)

- [ ] shadow-first: flag off → short_list_30/portfolio_snapshot mutation 0 (byte-identical) — 코드 guard + dormancy pin 테스트.
- [ ] 범주 분리: macro/M15 Exit/합의 배지/D27과 섞지 않음 — 별도 타입·별도 출력.
- [ ] smart brake: 고립 direct/high-conf만 자동, 대량=hold_for_review — brake 테스트.
- [ ] 3-layer: action_taken 귀속 ledger — 컬럼 + 테스트.
- [ ] no-email: 이메일/Resend 호출 0 — telegram-only, dispatchExitSignal 미사용.
- [ ] enum 불변: alert_event.alert_type 12종 유지(removal 타입 추가 X).
- [ ] 마이그 dormant + .sql/.rollback 짝 + PG smoke.
- [ ] NO-CONFIG-PASSES/예측 claim 미도입 · MVP 3종 불변 · 실 AI=USER 비용 게이트(테스트 mock ₩0).
- [ ] USER-only 게이트(Vercel flag/마이그 apply/Naver·Telegram 키/AI 비용)는 CLAUDE 미실행 — 체크리스트만.

## 8. USER-only 게이트 (CLAUDE 미실행)
`M12A_NEWS_EVAL_ENABLED=true` + (shadow 검증 후) `M12A_AUTO_REMOVE_ENABLED=true` · 마이그 0042 apply · B-8 Naver · B-9 Telegram · AI 키 + 비용 승인.
