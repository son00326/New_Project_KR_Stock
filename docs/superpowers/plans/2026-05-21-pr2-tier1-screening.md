# PR2 — Tier 1 AI 30 선정 Screening Implementation Plan

> **Spec SoT**: `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md` §1.1 + §4 (canonical 5-PR 순서 박제) + omxy R1~R4 CONVERGED lock-in (본 세션)

> **Branch**: `feat/pr2-tier1-screening` (main HEAD `131ac38f` 기준 신규)

> **omxy review cadence**: lock-in R1~R4 CONVERGED (본 세션) → implementer commit 후 final R1 (mandatory)

---

## Lock-in (omxy 4 rounds CONVERGED · 9 BLOCKERS catch & fix)

### Q1 — Tier 1 호출 + 선정 로직
- **150 candidates × 1 single-panel call = 150 LLM calls** (per-call output = Core 11 personas structured JSON)
- **Timeframe persona weights**: 단(Druckenmiller / Burry 1.5x) · 중(Lynch 1.5x) · 장(Buffett / Munger / Fisher / Pabrai 1.5x). 나머지 페르소나 weight 1.0.
- **Selection 5-step**:
  1. 150 종목 평가 → per-persona scores {short, mid, long}
  2. server-side aggregate: weighted_scores by timeframe → ticker `primary_timeframe = argmax(weighted_scores)`
  3. timeframe별 primary 후보를 timeframe score 내림차순 정렬, 최대 10 선발
  4. <10 timeframe은 **global unselected pool** (어디에도 선발되지 않은 ticker)에서 해당 timeframe score 내림차순으로 backfill
  5. `assigned_by = 'primary' | 'backfill'` metadata + tie-break = assigned timeframe consensus badge priority (🟢 > 🔵 > 🟣 > 🟡 > ⚪)

### Q1 — schema (zod, tier1-schema.ts 신설)
- **per-persona** (LLM 직접 반환):
  ```ts
  {
    persona_id: string,                              // Core 11 id (e.g. "warren_buffett")
    scores: { short: number, mid: number, long: number },  // 0-100 각
    winning_timeframe: 'short' | 'mid' | 'long',
    rationale_kr: string,                             // ≤80자
    conviction: number                                // 0-100
  }
  ```
- **per-ticker aggregate** (server-side 산출):
  ```ts
  {
    ticker: string,
    sector: CanonicalSector | null,
    weighted_scores: { short: number, mid: number, long: number },
    primary_timeframe: 'short' | 'mid' | 'long',
    consensus_badges_by_timeframe: { short: ConsensusBadge, mid: ConsensusBadge, long: ConsensusBadge },
    assigned_by: 'primary' | 'backfill',
    prompt_version_id: string,                       // 예: "tier1-v1.0.0"
    personas_version_id: string                      // CORE_11_PERSONAS hash 또는 manifest id
  }
  ```
- **Tier1ScreeningResult** (PR2 deliverable 최상위 반환):
  ```ts
  {
    selected: TickerAggregate[],                    // length=30 (단/중/장 each 10)
    notSelected: TickerAggregate[],                 // length=120
    selectionMeta: {
      shortCount: number,                            // 10
      midCount: number,                              // 10
      longCount: number,                             // 10
      backfillCounts: { short: number, mid: number, long: number },
      promptVersionId: string,
      personasVersionId: string,
      generatedAt: string                            // ISO
    }
  }
  ```

### Scope purity (PR2 deliverable / non-deliverable)
**✅ Deliverable**:
- `tudal/src/lib/screening/tier1-schema.ts` (zod schemas + types)
- `tudal/src/lib/screening/persona-eval.ts::runTier1Screening(input)` 확장 — 기존 `runMonthlyPersonaEval` (Tier 2 Section 8) **건드리지 않음**
- cross-timeframe matrix logic + weighted aggregation
- primary/backfill selection algorithm
- consensus badge by timeframe 산출 (consensus.ts `assignBadge` 재사용)
- tests TDD ≥12 RED-first

**❌ Non-deliverable (PR1 / PR3a / PR3b / PR4로 분리)**:
- DB write (cost_log INSERT · short_list_30 row persist 등)
- schema migration (sector_reference_backlog · assigned_by/version_id 컬럼 추가 등 — 모두 PR1 또는 PR3b)
- cron wire (PR1)
- UI wire (PR4)
- writer.ts touch (PR3a/PR3b)
- backlog table (PR3b)
- 실 LLM 호출 활성 (PR1 cron 또는 PR4 UI trigger 후에 실제 발화)

### PR3b 권장 비고 (코멘트 박제만)
- `tier1-schema.ts` 또는 `persona-eval.ts` doc comment: "PR3b에서 sector_reference_backlog table 도입 권장 (referenceCoverage metadata SoT)"

---

## Pre-conditions

- [x] main HEAD = `131ac38f`
- [x] branch `feat/pr2-tier1-screening` 생성 from origin/main (worktree `/Users/yong/New_Project_KR_Stock-pr2`)
- [x] omxy lock-in 4 rounds CONVERGED
- [ ] 검증 게이트 baseline 통과 (build / lint / test:ci / tsc) — Task 0
- [ ] 기존 `runMonthlyPersonaEval` 동작 보존 확인 (Tier 2 Section 8 path 변경 없음)

---

## Task 0 — Baseline 검증 게이트 (단일 axis, 0 commit)

**파일**: 없음 (read-only)

**Steps**:
1. `cd tudal && npm run build` — 25 routes OK 확인
2. `npm run lint` — 0 errors 6 warnings (pre-existing baseline)
3. `npm run test:ci` — 699 / 66 baseline (53차 §4+ 기준)
4. `npx tsc --noEmit` — clean

**Exit**: 4종 ALL GREEN baseline. 한 개라도 실패 시 stop + 사용자 보고.

---

## Task 1 — tier1-schema.ts (RED then GREEN 1-axis)

### Task 1.1 RED — `tier1-schema.test.ts` 작성

**파일**: `tudal/src/lib/screening/__tests__/tier1-schema.test.ts` (신규)

**테스트 케이스** (≥3):
- Test 1: `PersonaScoreSchema.parse` valid input (scores 0-100, winning_timeframe enum, rationale ≤80자, conviction 0-100) → PASS
- Test 2: `PersonaScoreSchema.parse` rationale_kr 81자 → throws ZodError ("rationale_kr_too_long")
- Test 3: `TickerAggregateSchema.parse` consensus_badges_by_timeframe 누락 → throws ZodError
- Test 4: `Tier1ScreeningResultSchema.parse` selected.length=30 + notSelected.length=120 → PASS
- Test 5: `Tier1ScreeningResultSchema.parse` selected.length=29 (one missing) → throws ZodError
- Test 6: `Tier1ScreeningResultSchema.parse` assigned_by enum 외 ('manual') → throws ZodError

**Exit**: tests RED (no implementation).

### Task 1.2 GREEN — `tier1-schema.ts` 작성

**파일**: `tudal/src/lib/screening/tier1-schema.ts` (신규)

**Exports**:
- `PersonaScoreSchema` (zod object)
- `TickerAggregateSchema` (zod object)
- `Tier1ScreeningResultSchema` (zod object, refine: selected.length===30 && notSelected.length===120)
- types: `PersonaScore`, `TickerAggregate`, `Tier1ScreeningResult`, `Timeframe`
- constant: `TIMEFRAMES = ['short', 'mid', 'long'] as const`
- constant: `TIMEFRAME_WEIGHTS` per persona (어디서 weight 적용할지 명시) — 코드 위치 결정: 일단 schema 파일에서 export, persona-eval에서 import

**Doc comment**:
```ts
// SoT: docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md §1.1
// omxy 4 rounds CONVERGED (Q1 lock-in)
// PR2 scope: in-memory schema only. DB persistence (assigned_by, version_id columns)는 PR1 scope.
// PR3b 권장: sector_reference_backlog DB table 도입 (referenceCoverage metadata SoT).
```

**Exit**: Task 1.1 tests ALL PASS.

---

## Task 2 — runTier1Screening core (RED then GREEN 1-axis)

### Task 2.1 RED — `persona-eval.test.ts` 확장 (또는 신규 file)

**파일**: `tudal/src/lib/screening/__tests__/persona-eval.test.ts` (기존 확장) 또는 `tier1-screening.test.ts` (신규 — Tier 1과 Tier 2 분리 명확)

**결정**: 신규 `tier1-screening.test.ts` (분리 명확. 기존 persona-eval.test.ts는 `runMonthlyPersonaEval` 전용 유지).

**테스트 케이스** (≥9, ≥12 total with Task 1.1):

**Primary assignment (3 tests)**:
- Test 7: 150 mock candidates with predictable scores → primary_timeframe = argmax(weighted_scores) 확인 (예: ticker A weighted={short:60, mid:80, long:40} → primary='mid')
- Test 8: tie-breaker on weighted_scores (예: weighted={short:75, mid:75, long:50}) → 결정성 보장 (short 우선 또는 deterministic rule 명시)
- Test 9: 모든 ticker primary='short' (극단 case) → short 10 + mid 0 + long 0 from primary, backfill mid 10 + long 10 from unselected pool

**Backfill (3 tests)**:
- Test 10: primary distribution short=5, mid=15, long=10 → short backfill 5 from unselected (mid/long primary 종목 제외, mid에서 11위~ 또는 long에서 11위~)
- Test 11: backfill ticker `assigned_by = 'backfill'` metadata 확인
- Test 12: global unselected pool 정의 검증 — 어떤 timeframe primary에도 선발되지 않은 ticker만 backfill 후보 (이미 primary로 다른 timeframe에 assign된 ticker는 backfill 제외)

**Consensus badge tie-break (3 tests)**:
- Test 13: 동점 ticker A·B (둘 다 weighted_score=70 for primary timeframe) → badge 🟢 우선 (A badge=🟢, B badge=🔵 → A 선발)
- Test 14: badge 동일 ('⚪' 두 개) → secondary tie-break = ticker alphabetical (deterministic)
- Test 15: assigned timeframe badge로만 tie-break — 다른 timeframe badge는 무시

**Total: Task 1.1 (6) + Task 2.1 (9) = 15 tests** (≥12 lock-in 충족).

**Exit**: tests RED.

### Task 2.2 GREEN — `persona-eval.ts::runTier1Screening` 구현

**파일**: `tudal/src/lib/screening/persona-eval.ts` (확장 — 기존 `runMonthlyPersonaEval` 유지)

**시그니처**:
```ts
export interface RunTier1ScreeningInput {
  candidates: Array<{
    ticker: string;
    sector: CanonicalSector | null;
    tier0_indicators?: unknown;  // PR1에서 사용. PR2는 pass-through.
  }>;                              // length = 150 (단/중/장 50씩)
  callPersonaPanel: (input: { ticker: string; financials: string }) => Promise<PersonaScore[]>;
  fetchFinancials: (ticker: string) => Promise<string>;
  promptVersionId: string;
  personasVersionId: string;
  // OOS: adminUserId / month / cost_log은 PR1에서 wrap.
}

export async function runTier1Screening(input: RunTier1ScreeningInput): Promise<Tier1ScreeningResult> {
  // 1. 150 candidates × 1 single-panel call (callPersonaPanel)
  // 2. aggregate weighted_scores by timeframe
  // 3. primary_timeframe = argmax
  // 4. timeframe별 top 10 by score (primary)
  // 5. global unselected pool에서 부족 timeframe backfill (timeframe score 내림차순)
  // 6. assigned_by + consensus badges by timeframe (consensus.ts assignBadge 재사용)
  // 7. Tier1ScreeningResult 반환 (Tier1ScreeningResultSchema validate)
}
```

**Helper functions (internal, not exported)**:
- `computeWeightedScores(personaScores: PersonaScore[]): {short, mid, long}` — TIMEFRAME_WEIGHTS 사용
- `selectPrimary(aggregates: TickerAggregate[], target=10): {selected, remaining}` — timeframe별 group + top 10
- `backfillTimeframe(timeframe, unselectedPool, count): TickerAggregate[]`
- `tieBreakByBadge(a: TickerAggregate, b: TickerAggregate, timeframe): number`

**Doc comment**:
```ts
/**
 * PR2 Tier 1 AI 30 선정 screening.
 *
 * SoT: docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md §1.1
 * + docs/superpowers/plans/2026-05-21-pr2-tier1-screening.md
 *
 * Scope purity: in-memory only. DB persist (cost_log, short_list_30 row)은 PR1 wiring scope.
 * 실 LLM 호출은 callPersonaPanel callback로 외부 wire — PR2 자체는 callback signature까지만 박제.
 */
```

**Exit**: Task 2.1 tests ALL PASS. Task 1.1 tests 유지.

---

## Task 3 — Verification (단일 axis, 0 commit)

**Steps**:
1. `npm run test:ci` — Task 1.1 (6) + Task 2.1 (9) = +15 tests PASS. baseline 699 → 714. 기존 699 어느 하나도 fail 없음 (regression 0).
2. `npm run build` — 25 routes 유지 (신규 route 0).
3. `npm run lint` — 0 errors, warnings 6 baseline 초과 금지.
4. `npx tsc --noEmit` — clean.
5. **회사명 invariant** (53차 §3 박제 패턴): `grep -ri "삼성전자\|삼천당\|알테오젠" tudal/src/lib/screening/` → 0 매치 (회사명 production code 0).
6. **Scope purity grep**:
   - `grep -n "cost_log\|stock_reports\|short_list_30\|INSERT INTO\|UPDATE.*SET" tudal/src/lib/screening/tier1-schema.ts tudal/src/lib/screening/persona-eval.ts` — Tier 1 신규 코드 라인에서 0 매치 (기존 `runMonthlyPersonaEval` 라인은 OK).
   - `grep -n "writer\|admin-reports\|admin-shortlist\|admin/track-record\|admin/portfolio" tudal/src/lib/screening/tier1-schema.ts` — 0 매치 (import 0).

**Exit**: 6/6 PASS.

---

## Task 4 — Reviewer subagent dispatch

**Subagent**: `gsd-code-reviewer` (Read + Bash + Grep + Glob, write REVIEW.md)

**Inputs**:
- 변경 파일 목록: `tudal/src/lib/screening/tier1-schema.ts` (신규) + `tudal/src/lib/screening/persona-eval.ts` (확장) + `tudal/src/lib/screening/__tests__/tier1-schema.test.ts` (신규) + `tudal/src/lib/screening/__tests__/tier1-screening.test.ts` (신규)
- spec doc + plan doc path
- omxy lock-in 핵심 (Q1 5-step selection · scope purity · schema fields)

**Output**: `docs/superpowers/reviews/2026-05-21-pr2-tier1-screening-review.md` (또는 inline reviewer 결과)

**Exit**: Important findings 0 또는 모두 fix.

---

## Task 5 — omxy 적대적 재검토 (final R1~Rn)

**Pattern**: 53차 §3 박제 (Final omxy R1~R3 직전 머지) 재사용.

**Round 1 prompt 핵심**:
- spec doc + plan doc + 실제 diff (`git diff main..HEAD`) 첨부
- 검증 게이트 결과 (15 tests / 0 regression / scope purity grep 0)
- omxy lock-in 9 BLOCKERS catch & fix 이력 재확인 — 본 round에서 추가 catch 있는지

**Exit**: SIGNAL: CONVERGED.

---

## Task 6 — push + PR create (SHARED 권한, §2.1 박제)

**Pre-push 3-assert** (omxy 53차 §4+ R1 BLOCKER 1 패턴):
1. `git status --short` clean (Task 1~3 commit 후 working tree 0)
2. `git ls-remote --heads origin feat/pr2-tier1-screening` 0건 (collision check)
3. PR #2 + PR #10 intersection 0 (touch 파일 disjoint)

**push**: `git push -u origin feat/pr2-tier1-screening` (fast-forward only, no force, no skip-hooks)

**PR create**: `gh pr create --base main --title "feat(PR2): Tier 1 AI 30 선정 screening (tier1-schema + runTier1Screening)" --body "<heredoc with: scope purity·omxy CONVERGED·Q1 lock-in·15 tests·scope grep 0·reviewer pass>"`

**Exit**: PR open + state CLEAN.

---

## Stop conditions

본 PR 진행 중 아래 발생 시 즉시 stop + 사용자 보고:
- Baseline 검증 게이트 (Task 0) 실패
- 기존 `runMonthlyPersonaEval` 동작 변경 (Tier 2 Section 8 path)
- scope purity grep 결과 1+ 매치
- DB schema migration 필요 발생 (PR1/PR3b로 분리)
- omxy SIGNAL: ESCALATE
- uncertainty ≥ medium (Karpathy 4번)

---

## Out of scope (재확인)

- 사용자 lock-in 8 항목 변경 (재해석 금지)
- canonical PR 순서 변경 (PR3a / PR1 / PR3b / PR4는 별도 PR)
- Group H Critical Hard gate 폐기 (PR1 cron 가동 ⊥ PR3a 미선행 = page crash inevitable)
- Tier 2 sector 14 페르소나 활성 (Section 8 partA/partD scope = PR3b 별개)
- DQ-7 / S8 / 멤버 페이지 등 다른 트랙
