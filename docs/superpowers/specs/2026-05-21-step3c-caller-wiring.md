# Step 3c — Tier 2 Caller Wiring Spec

> **목적**: 52차 박제된 `runSectorEval` + `commitSectorReport` scaffold를 실제 caller에 wire. **real LLM call은 새로 열지 않음** — billing/B-6 충전 전까지 "wired but dry-run/skipped" 유지가 safety 1순위 (omxy 53차 §3 R3 D6 박제).

> **출처**: 53차 §3 PR #8 머지 후 (Step 3b 207 persona Kevin v3.1 quality 본문 완성) → branch `feat/tier2-caller-wiring`. 53차 §3 omxy R3 merge sequence CONVERGED 후 D2 inspect 8 결과 박제.

---

## 1. Scope

Tier 2 (Sector Board 14 personas per-ticker) caller wiring 진입. 52차 박제 `persona-eval.ts::runSectorEval` + `writer.ts::commitSectorReport`는 export-only 상태 — production code path에 호출자가 없다. 본 PR은 호출자를 3 축에서 신설/확장한다.

**Out of scope**: real LLM 호출 path 신설 (B-6 billing 후 Step 6 smoke), Tier 2 prompt 본문 수정 (Step 3b 완료), Reflection (Step 4), Section 8 partB stub → 실제 issue extraction (별도 후속).

---

## 2. PHASE D2 inspect 결과 박제 (8 파일 contract 1:1)

### 2.1 caller layer (cron + admin action)

**`tudal/src/app/api/cron/monthly-batch/route.ts`** (107 lines):
- S7a §12 mock dry-run only 박제 — `isProductionLike()` 시 즉시 `monthly_batch_real_pipeline_not_configured` 반환 (status 200)
- buildMockSteps() 4 steps = screening / shortlist-insert / report-generate / alert-broadcast (모두 mock success)
- **결론**: cron route는 본 PR에서 변경 0 — billing-on smoke (Step 6) 이전까지 mock 유지. Step 3c는 cron path 진입 자체를 새로 열지 않는다.

**`tudal/src/lib/scheduler/monthly-batch.ts`** (183 lines):
- Pure logic `runStepWithRetries` + `runMonthlyBatch`. 실 I/O는 `step.run` 주입.
- **결론**: 본 PR에서 변경 0. 후속 Step 6에서 step.run을 실 구현체로 교체할 때 영향.

**`tudal/src/app/(admin)/admin/track-record/actions.ts::triggerMonthlyPersonaEvalAction`** (117 lines):
- 현재 Core 11 only path: short_list_30 → `runMonthlyPersonaEval` → `assignBadge` → `commitTickerReport` (배지 4종) / `commitBadgeOnly` (⚪)
- **Step 3c 핵심 작업 위치**: Core 11 성공 케이스 (`personaResults.length === 11`) 뒤에 Tier 2 branch 추가.

### 2.2 runtime + writer + schema

**`tudal/src/lib/screening/persona-eval.ts::runSectorEval`** (line 170-247):
```
input: { month, ticker, sector: CanonicalSector, sub_tags?: readonly string[], adminUserId, fetchFinancials }
output: { ticker, sector, personaIds: string[14], results: CallPersonaResult[0..14], available: boolean, degradedCount, totalCalls }
```
- `available = degradedCount === 0 && results.length === SECTOR_PERSONA_COUNT (14)` (omxy 52차 R2 B1)
- preflightHardcap(14 calls) → Parallel 14 fanout → degraded counting
- `unknown_persona_id:*` throw (production prompts 부재 시) → degradedCount++ (silent X, available=false 보존)

**`tudal/src/lib/report/writer.ts::commitSectorReport`** (line 203-274):
```
input: { month, ticker, sector, sub_tags?, sectorPersonaResults: CallPersonaResult[14], sectorPersonaIds: string[14] }
output: { reportId: string, votesInserted: number }
```
- length=14 가드 (52차 R2 B2 + R3 acc#3)
- `parseSectorContentStrict` (52차 final R1 B-final-3) — malformed AI content는 `sector_writer_invalid_persona_content:*` throw로 RPC persist 자체 차단
- `commit_sector_personas` RPC (마이그 0019) — SECURITY DEFINER + race-free + idempotent DELETE-then-INSERT

**`tudal/src/lib/report/section-8-schema.ts::section8Schema`**:
- `partA refine: arr.length === 0 || arr.length === 14` — **1~13 invalid** (zod enforce)
- partD length 11, partB min 3 max 5, partC verdict enum

### 2.3 UI

**`tudal/src/app/(admin)/admin/report/[ticker]/page.tsx::Section8View`** (line 569-643):
- **이미 sectorVotes / sectorAgg / Sector Board card 모두 렌더링 코드 박제** (line 583 `votes.filter(personaLayer==='sector')` + line 596 Sector Board card + line 634-638 VoteList sector)
- **핵심**: 데이터가 들어오면 자동 표시. UI 변경 사실상 불필요.
- 단, **partA 14 sectorVoteRow가 들어왔을 때** sectorAgg → committee_votes 매핑이 이미 동작 (sectorVotes.length가 14가 되어 Sector Board card 정상 표시).

---

## 3. 3 caller wiring 구조 (Step 3c 작업 범위)

### 3.1 축 1: admin server action Tier 2 branch (핵심)

**위치**: `tudal/src/app/(admin)/admin/track-record/actions.ts::triggerMonthlyPersonaEvalAction`

**변경 패턴**: Core 11 성공 commit 후 (line 99-105 `commitTickerReport` 직후) Tier 2 branch 추가.

```
for (const ticker of tickers) {
  // ... 기존 Core 11 path ...
  if (badge === '⚪') { commitBadgeOnly(...) }
  else if (personaResults.length === 11) {
    await commitTickerReport({ month, ticker, personaResults, personaIds, badge });

    // [NEW] Tier 2 branch (omxy D6 cost gate)
    if (shouldRunTier2(badge)) {
      tier2Counters.attempted++;
      const sectorRow = shortlist.find(s => s.ticker === ticker);
      const sectorRaw = sectorRow?.sector; // unknown (string | null | undefined)
      if (typeof sectorRaw !== 'string' || !isCanonicalSector(sectorRaw)) {
        // skipped: sector NULL / unknown / non-canonical → DB write 0
        tier2Counters.skippedSector++;
        continue;
      }
      // omxy D4 R1 BLOCKER 2: sub_tags jsonb는 null/string/mixed array 가능 → strict array+string filter
      const rawSubTags = sectorRow?.sub_tags;
      const subTags: readonly string[] = Array.isArray(rawSubTags)
        ? rawSubTags.filter((x): x is string => typeof x === 'string')
        : [];
      const tier2 = await runSectorEval({ month, ticker, sector: sectorRaw, sub_tags: subTags, adminUserId: user.id, fetchFinancials });
      if (!tier2.available) {
        tier2Counters.skippedUnavailable++;
        continue; // omxy D6: degraded → DB write 0
      }
      await commitSectorReport({ month, ticker, sector: sectorRaw, sub_tags: subTags, sectorPersonaResults: tier2.results, sectorPersonaIds: tier2.personaIds });
      tier2Counters.committed++;
    } else {
      tier2Counters.skippedGate++; // shouldRunTier2 false (env off 또는 badge=⚪)
    }
  }
  // ...
}

return { ok: true, totalCalls: evalResult.totalCalls, tier2: tier2Counters };
```

**Counter (action 반환 확장 — omxy D4 R1 BLOCKER 1 정정)**:
```ts
interface Tier2Counters {
  attempted: number;           // shouldRunTier2 true + Core 11 성공한 ticker 수
  committed: number;           // commitSectorReport 호출 수 (env+sector+available 3-gate AND)
  skippedGate: number;          // shouldRunTier2 false (env off 또는 badge=⚪)
  skippedSector: number;       // sector NULL/unknown/non-canonical
  skippedUnavailable: number;  // tier2.available === false (degraded/partial)
}
```
operator/admin 대시보드에서 "왜 Tier 2 안 돌았나" 진단 가능 + DB write 0 baseline test가 정확한 skip reason도 검증.

**Return contract 변경 — backward-compatible additive (omxy D4 R2 BLOCKER 4 정정)**:
기존 `{ ok, totalCalls }` → 신규 `{ ok, totalCalls, tier2: Tier2Counters }`. 기존 caller (action 호출자)가 `result.ok`/`result.totalCalls`만 read하면 영향 0. `tier2` 필드는 선택적 read (admin dashboard 등). 본 PR은 기존 e2e (`actions.e2e.test.ts`) test 변경 0.

**skippedGate 의미 박제** (R2 BLOCKER 3 정정): `skippedGate`는 shouldRunTier2 false 케이스 — env off 또는 badge ⚪ 두 case 합산. badge별 진단이 필요하면 후속 PR에서 `skippedBadge` 분리 (현재는 minimal field set).

**`shouldRunTier2(badge)` 도입 (omxy D6 cost gate enforce, omxy D4 R1 BLOCKER 4 정정 — export)**:
- `tudal/src/app/(admin)/admin/track-record/actions.ts`에서 named export로 노출 (single unit test가 가능하도록).
- 본 PR 시점 = billing 미충전. `process.env.AI_COST_LOG_REAL_INSERT_ENABLED === 'true'`가 single gate (omxy D6 (1)).
- 단, **billing 충전 신호일 뿐 billing 가능 자체 보장 아님** (omxy D4 R1 non-blocker note 박제) — Anthropic SDK 호출 실패는 runSectorEval 자체에서 degradedCount++로 처리.
- 미설정 시 counter-backed skip (DB write 0). `process.env`만 의존, AI_PROMPT_CACHE_ENABLED는 safety gate 아님 박제.

**또 다른 safety gate (omxy D6 (3))**: Tier 2 호출은 Core 11 BUY ≥ N (예: 6) bucket / top-N ticker만 (cost 30 × 14 = 420 calls 회피). 단, **본 PR 시점은 D6 (1) env flag로 일괄 차단되므로 (3) Top-N 게이트는 후속 PR optimization**.

### 3.2 축 2: cron route — 변경 0 박제

**위치**: `tudal/src/app/api/cron/monthly-batch/route.ts`

**변경**: 본 PR에서 **변경 0**.
- 현재 mock dry-run only (S7a §12 박제, isProductionLike 즉시 차단)
- Tier 2 caller wiring 후속 = Step 6 billing-on smoke 후 별도 PR (real production pipeline 신설 시점)
- 본 spec md에 "cron 축 = 변경 0" 명시 박제로 차후 stale assumption 차단.

### 3.3 축 3: UI render — 변경 0 박제

**위치**: `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx::Section8View` (line 569-643)

**변경**: 본 PR에서 **변경 0** (D2 inspect 결과 박제).
- Section8View는 이미 sectorVotes / sectorAgg / Sector Board card 모두 렌더링 코드 보유.
- 데이터가 들어오면 자동 표시 — partA 14 row가 commit_sector_personas RPC로 INSERT되면 committee_votes table에 persona_layer='sector' 14 row가 들어가고, Section8View가 자동 filter + 렌더.
- **단, sectorAgg props가 page에서 어떻게 계산되어 props로 들어오는지 확인 필요** (line 285 `sectorAgg={bag.sectorAgg}`). bag.sectorAgg가 commit_sector_personas 후 committee_votes에서 집계되는지 확인 = 본 PR 외 (선행 wiring 이미 박제됨).

---

## 4. Cost/billing safety gates (omxy 53차 §3 R3 D6 박제)

본 PR은 real LLM call을 새로 열지 않는다. Tier 2 branch는 "wired but dry-run/skipped" 유지.

**`commitSectorReport` 호출 조건 (모두 만족 시에만)**:
1. **env flag `AI_COST_LOG_REAL_INSERT_ENABLED === 'true'`** (billing-on signal) — single gate, 본 PR 시점 counter-backed skip 기본
2. **`runSectorEval` 결과 `available === true`** (14 모두 성공) — degraded/partial 1~13이면 commit 금지
3. **sector enum in CANONICAL_SECTORS** — unknown sector skip
4. **(후속 PR) Top-N ticker 게이트** — bucket 내 BUY ≥ N, top N만 호출 (cost 최적화, optimization)

위 1~3 어느 하나라도 미충족 → **explicit `continue` + tier2Counters에 skip reason 카운트** + DB write 0. omxy D4 R1 BLOCKER 1 정정: "silent no-op 금지"는 단순 wording이 아니라 "skip reason이 action 반환 + test로 명시 enforce된다"는 의미. operator가 dashboard/log에서 attempted/committed/skipped(env|sector|unavailable) 4 카운터로 진단 가능.

**`AI_PROMPT_CACHE_ENABLED`는 safety gate 아님** — cost 최적화 only (omxy 53차 §3 R3 D6 명시).

---

## 5. Test plan (rationale; 실제 검증은 in-code test)

### 5.1 unit tests (`tudal/src/app/(admin)/admin/track-record/__tests__/actions.test.ts` 확장)

omxy D4 R1 4 BLOCKERS 정정 반영 — 8 cases:

1. `shouldRunTier2` exported, unit (5 sub-asserts):
   - env undefined → false
   - env 'false' → false
   - env 'true' + badge='🟢' → true
   - env 'true' + badge='🔵' → true (R2 권장 — non-🟢 non-⚪ case)
   - env 'true' + badge='⚪' → false (badge 자체 차단)
2. Tier 2 branch — env false (baseline) → `commitSectorReport` never called, `tier2Counters.skippedGate > 0`
3. Tier 2 branch — env true + sector NULL → `commitSectorReport` not called, `tier2Counters.skippedSector > 0` (omxy R1 BLOCKER 3 NULL test 추가)
4. Tier 2 branch — env true + sector unknown ('한전' / 비-canonical 문자열) → `commitSectorReport` not called, `tier2Counters.skippedSector > 0`
5. Tier 2 branch — env true + sector canonical + sub_tags NULL → subTags 빈 배열로 정상 → runSectorEval 호출, `tier2.available=true` mock → `commitSectorReport` 호출 1회
6. Tier 2 branch — env true + sector canonical + sub_tags **malformed (non-array jsonb: string 또는 object)** → subTags 빈 배열로 fallback (omxy R1 BLOCKER 2 strict guard) → 정상 진행
7. Tier 2 branch — env true + sector canonical + `tier2.available=false` (mock degradedCount=3) → `commitSectorReport` not called, `tier2Counters.skippedUnavailable > 0`
8. Happy path — `commitSectorReport` call args strict verify (length + pattern, omxy R3 권장):
   - `month`, `ticker`, `sector: <canonical>`, `sub_tags: <readonly string[]>`
   - `sectorPersonaResults: length === 14` (exact)
   - `sectorPersonaIds: length === 14` (exact)
   - `sectorPersonaIds` pattern: 각 ID가 `^sector-<sector>-slot-(1[0-4]|[1-9])(-subtag-.+)?$` 정규식 매치 (slot 1~14, optional sub_tag suffix). fixture에 sub_tag matched case 1건 이상 포함 (sub_tag pattern 검증).

**Mock 패턴 (Vitest 4.x)**:
```ts
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(...) }));
vi.mock('@/lib/screening/persona-eval', () => ({ runMonthlyPersonaEval: vi.fn(), runSectorEval: vi.fn() }));
vi.mock('@/lib/report/writer', () => ({ commitTickerReport: vi.fn(), commitBadgeOnly: vi.fn(), commitSectorReport: vi.fn() }));
```
env mock: `vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true')` (vitest stubEnv는 setup teardown 자동) + `vi.unstubAllEnvs()` afterEach.

### 5.2 invariant tests

- canonical-sectors.ts SoT 1:1 drift snapshot 유지 (52차 박제 + 본 PR로 sub_tags 사용 추가)
- partA refine (0 또는 14) 변경 0 — section-8-schema.test.ts baseline 유지

### 5.3 manual QA (별도 fixture)

본 PR 본문에는 manual QA 없음 — billing-on smoke (Step 6) 후 admin 1 ticker E2E 호출 시 별도 QA. 본 PR은 wiring + env flag silent-skip baseline 보장만.

---

## 6. 3 축 commit plan (omxy 53차 §3 R3 D5 cadence 박제)

- **commit 1 (축 1 admin action core)**: `track-record/actions.ts` Tier 2 branch + exported shouldRunTier2 helper + Tier2Counters interface + import `isCanonicalSector` (type guard, omxy R1 BLOCKER 3 박제 — NULL/undefined/non-canonical 모두 typeof+type-guard로 차단) / runSectorEval / commitSectorReport + actions.test.ts 확장 (8 test cases — shouldRunTier2 5 sub-asserts 1 case 포함). cron/UI touch 0.
- **commit 2 (축 2 cron route 변경 0 박제)**: docs-only commit 또는 PR description에만 박제 (skip).
- **commit 3 (축 3 UI 변경 0 박제)**: docs-only commit 또는 PR description에만 박제 (skip).

**축 2/3는 변경 0이므로 commit 분리 의미 없음. 본 PR은 단일 축 1 commit + test 동봉 + spec/plan docs 박제.**

omxy 53차 §3 R3 D5 "3 축 분리 commit"은 변경이 있는 경우 의미 — 본 PR은 축 1만 변경. cadence 박제 의도는 보존되되 적용은 단일 commit.

---

## 7. Verification gates (post-commit)

본 PR 단일 commit 후 검증 게이트 1회:
- `npm run build` — 25 routes 유지
- `npm run lint` — 0 errors 6 warnings (pre-existing 이상 증가 0)
- `npm run test:ci` — 691 → +8 신규 (8 actions test cases, shouldRunTier2 5 sub-asserts 1 case 포함) = 699/65 또는 699/66 (test file 신설 vs 확장)
- `npx tsc --noEmit` — clean
- env flag `AI_COST_LOG_REAL_INSERT_ENABLED` 미설정 baseline 시 production code path Tier 2 counter-backed skip 동작 확인 (test)

---

## 8. omxy review cadence

1. **D3 spec/plan 작성 후 → omxy R1 적대적 검토 1 round** (본 spec md + plan md base 검증)
2. **commit 1 후 → omxy final round 1 (mandatory)** — implementer review
3. **PR create 후 → optional R2** (PR description + diff 적대적 검토)

omxy CONVERGED = 사용자 승인 등가 (§9 운영 원칙 박제).

---

## 9. OOS (Out of scope)

- Step 4 Reflection (별도 후속 PR)
- PR #2 format-error (별도 USER 트리거)
- S7b 뉴스/브리핑 (별도 슬라이스)
- B-6 Anthropic billing 충전 자체 (USER, Step 5)
- Step 6 billing-on smoke (USER 트리거 후 별도 PR)
- cron route Tier 2 wiring (Step 6 후속)
- Top-N ticker 게이트 cost optimization (Step 6 후속)
- Section 8 partB stub → 실제 issue extraction (별도 후속)

---

## 10. Changelog

- 2026-05-21 (53차 §3 omxy R3 merge sequence CONVERGED 후 PHASE D2 inspect 8 결과 박제): 초안 작성. 단일 축 (admin action) wiring + cron/UI 변경 0 박제 + env flag single safety gate (D6 (1)).
