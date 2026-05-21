# Step 3c — Tier 2 Caller Wiring Implementation Plan

> **Spec SoT**: `docs/superpowers/specs/2026-05-21-step3c-caller-wiring.md` (rationale + contract + safety gates 박제)

> **Branch**: `feat/tier2-caller-wiring` (main HEAD `db7797a` 기준 신규)

> **omxy review cadence**: D3 spec/plan 후 R1 → implementer commit 후 final R1 (mandatory)

---

## Pre-conditions (PHASE D1 박제)

- [x] main HEAD = `db7797a` (PR #8 머지 후)
- [x] branch `feat/tier2-caller-wiring` 생성 from main
- [x] 8 inspect 파일 read 완료 (spec §2 박제)
- [x] 검증 게이트 baseline 통과 (build 25 / lint 0 err 6 warn / test:ci 691·65 / tsc clean)

---

## Task 1 — admin action Tier 2 branch (단일 축 1 commit)

### Task 1.1 — `track-record/actions.ts` 확장

**파일**: `tudal/src/app/(admin)/admin/track-record/actions.ts`

**변경 (incremental, in-place, omxy D4 R1 4 BLOCKERS 정정 반영)**:

1. Imports 추가 (top 부근):
   ```ts
   import { runSectorEval } from '@/lib/screening/persona-eval';
   import { commitSectorReport } from '@/lib/report/writer';
   import { isCanonicalSector } from '@/lib/screening/canonical-sectors';
   // (CANONICAL_SECTORS / CanonicalSector는 isCanonicalSector type guard로 narrowing 충분 — 직접 import 불요)
   ```
   `ConsensusBadge` import 필요 — 이미 `assignBadge`가 ConsensusBadge 반환하므로 `import { assignBadge, isTopTier, type ConsensusBadge } from '@/lib/screening/consensus';`로 확장.

2. **Exported** helper `shouldRunTier2(badge: ConsensusBadge): boolean` 추가 (top-level, action 함수 위) — omxy R1 BLOCKER 4 정정:
   ```ts
   export function shouldRunTier2(badge: ConsensusBadge): boolean {
     // omxy 53차 §3 R3 D6 cost gate (1): env flag single safety gate.
     // billing 미충전 baseline에서는 process.env.AI_COST_LOG_REAL_INSERT_ENABLED !== 'true' → counter-backed skip.
     // ⚪ 케이스는 Core 11 자체 미진입 → Tier 2도 불가.
     // billing 신호일 뿐 billing 가능 자체 보장 아님 (Anthropic SDK 호출 실패는 runSectorEval이 degradedCount++로 처리).
     if (badge === '⚪') return false;
     return process.env.AI_COST_LOG_REAL_INSERT_ENABLED === 'true';
   }
   ```
   **export 이유**: 단위 test에서 직접 호출 가능. action 내부에서만 쓰는 helper지만 small API surface로 SoT 명확.

3. short_list_30 SELECT에 `sector, sub_tags` 컬럼 추가:
   ```ts
   const { data: shortlist } = await supabase
     .from('short_list_30')
     .select('ticker, bucket, composite_score, sector, sub_tags')
     .eq('month', month)
     .order('rank', { ascending: true });
   ```
   - 마이그 0012 (name/sector) + 0018 (sub_tags jsonb) production apply 완료. in-code Database type 미생성 — Task 1.1 작성 시 typed Supabase client 컴파일 오류 발생하면 별도 type 갱신 task (stop condition).

4. Tier 2 counter interface 추가 (omxy R1 BLOCKER 1 정정 — silent no-op vs counter-backed skip):
   ```ts
   interface Tier2Counters {
     attempted: number;
     committed: number;
     skippedGate: number;
     skippedSector: number;
     skippedUnavailable: number;
   }
   ```
   action 함수 시작 시 `const tier2Counters: Tier2Counters = { attempted: 0, committed: 0, skippedGate: 0, skippedSector: 0, skippedUnavailable: 0 };` 초기화.

5. Core 11 commitTickerReport 직후 Tier 2 branch 추가 (line 99-105 부근, omxy R1 BLOCKER 2+3 정정):
   ```ts
   await commitTickerReport({ month, ticker, personaResults, personaIds, badge });

   // [NEW Tier 2 branch — omxy 53차 §3 R3 D6 cost gate + D4 R1 4 BLOCKERS 정정]
   if (shouldRunTier2(badge)) {
     tier2Counters.attempted++;
     const sectorRow = shortlist.find((s) => s.ticker === ticker);
     const sectorRaw = sectorRow?.sector; // string | null | undefined
     // omxy R1 BLOCKER 3: isCanonicalSector type guard 사용 (cast+includes 대신).
     // NULL/undefined도 typeof 'string' 검사로 차단.
     if (typeof sectorRaw !== 'string' || !isCanonicalSector(sectorRaw)) {
       tier2Counters.skippedSector++;
       continue; // sector NULL / unknown / non-canonical → DB write 0
     }
     // omxy R1 BLOCKER 2: sub_tags jsonb는 null/string/object/mixed array 가능 — strict array+string filter.
     const rawSubTags = sectorRow?.sub_tags;
     const subTags: readonly string[] = Array.isArray(rawSubTags)
       ? rawSubTags.filter((x): x is string => typeof x === 'string')
       : [];
     const tier2 = await runSectorEval({
       month, ticker, sector: sectorRaw, sub_tags: subTags,
       adminUserId: user.id, fetchFinancials: /* same closure */,
     });
     if (!tier2.available) {
       tier2Counters.skippedUnavailable++;
       continue; // omxy D6 (2): degraded/partial 1~13 → DB write 0
     }
     await commitSectorReport({
       month, ticker, sector: sectorRaw, sub_tags: subTags,
       sectorPersonaResults: tier2.results,
       sectorPersonaIds: tier2.personaIds,
     });
     tier2Counters.committed++;
   } else {
     tier2Counters.skippedGate++; // shouldRunTier2 false (env off 또는 badge=⚪)
   }
   ```
   sectorRaw가 `isCanonicalSector` 통과 후 TypeScript narrowing 자동으로 `CanonicalSector` type — cast 불요.

6. action 반환 확장:
   ```ts
   return { ok: true, totalCalls: evalResult.totalCalls, tier2: tier2Counters };
   ```
   (omxy R1 BLOCKER 1 정정 — operator/admin이 "왜 Tier 2 안 돌았나" 진단 가능)

7. `fetchFinancials` closure는 기존 함수 그대로 재사용 (closure scope 안에 정의).

### Task 1.2 — tests (`tudal/src/app/(admin)/admin/track-record/__tests__/actions.test.ts`)

**Test file 신설 또는 기존 확장** — 기존 file 존재 여부 확인 후 결정.

8 test cases (spec §5.1, omxy D4 R1 4 BLOCKERS 정정 반영):

1. `shouldRunTier2` exported unit (5 sub-asserts):
   - env undefined → false
   - env 'false' → false
   - env 'true' badge='🟢' → true
   - env 'true' badge='🔵' → true (R2 권장 — non-🟢 non-⚪ case)
   - env 'true' badge='⚪' → false

2. Tier 2 branch — env false (baseline) → `commitSectorReport` never called, `tier2Counters.skippedGate > 0`

3. Tier 2 branch — env true + sector **NULL** → `commitSectorReport` not called, `tier2Counters.skippedSector > 0` (omxy R1 BLOCKER 3 NULL case)

4. Tier 2 branch — env true + sector unknown ('한전' 등 non-canonical) → `commitSectorReport` not called, `tier2Counters.skippedSector > 0`

5. Tier 2 branch — env true + sector canonical + sub_tags NULL → subTags=[] → runSectorEval 호출, `tier2.available=true` mock → `commitSectorReport` 1회 호출, `tier2Counters.committed === 1`

6. Tier 2 branch — env true + sector canonical + sub_tags **malformed (non-array jsonb: string 또는 object)** → subTags=[] (omxy R1 BLOCKER 2 strict guard) → 정상 진행 + `tier2Counters.committed > 0` (또는 mock에 따라)

7. Tier 2 branch — env true + sector canonical + `tier2.available=false` (mock degradedCount=3) → `commitSectorReport` not called, `tier2Counters.skippedUnavailable > 0`

8. Happy path — `commitSectorReport` call args strict verify (length + pattern, omxy R3 권장):
   - `month`, `ticker`, `sector: <canonical>`, `sub_tags: <readonly string[]>`
   - `sectorPersonaResults: length === 14` (exact)
   - `sectorPersonaIds: length === 14` (exact)
   - `sectorPersonaIds` pattern: 각 ID가 `^sector-<sector>-slot-(1[0-4]|[1-9])(-subtag-.+)?$` 정규식 매치. fixture에 sub_tag matched case 1건 이상 포함

**Mock 패턴 (Vitest 4.x)**:
```ts
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(...) }));
vi.mock('@/lib/screening/persona-eval', () => ({ runMonthlyPersonaEval: vi.fn(), runSectorEval: vi.fn() }));
vi.mock('@/lib/report/writer', () => ({ commitTickerReport: vi.fn(), commitBadgeOnly: vi.fn(), commitSectorReport: vi.fn() }));
```

env mock: `vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true')` + `vi.unstubAllEnvs()` afterEach.

### Task 1.3 — Verification gates

`cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit`

Expected:
- build 25 routes (변경 0 — admin route 영향 0)
- lint 0 errors, 6 warnings (pre-existing 이상 증가 0)
- test:ci 691 → +8 = 699 신규 tests / 65 files (file 확장) 또는 66 files (file 신설)
- tsc clean

### Task 1.4 — Commit

```
feat(Step 3c admin action Tier 2 wiring): track-record/actions.ts + shouldRunTier2 gate + 8 tests

Step 3c (omxy 53차 §3 R3 merge sequence CONVERGED 후 PHASE D2 inspect 8 결과 박제):
- triggerMonthlyPersonaEvalAction에 Tier 2 branch 추가 — Core 11 commit 후 (성공 케이스만)
- shouldRunTier2 helper — env flag AI_COST_LOG_REAL_INSERT_ENABLED single safety gate (omxy D6 (1))
- short_list_30 SELECT에 sector + sub_tags 추가 (마이그 0012 + 0018 박제)
- sector isCanonicalSector type guard (omxy R1 BLOCKER 3) — NULL/undefined/non-canonical 모두 typeof+type-guard로 차단 → 실패 시 tier2Counters.skippedSector++ counter-backed skip
- tier2.available === false → tier2Counters.skippedUnavailable++ counter-backed skip (omxy D6 (2) degraded write 0)
- 반환 contract additive 확장: 기존 { ok, totalCalls }에 + tier2: Tier2Counters (backward-compatible — 기존 caller untouched)

cron route + UI render 변경 0 (spec §3.2/§3.3 박제):
- cron monthly-batch은 S7a §12 mock dry-run 유지 (Step 6 billing-on smoke까지)
- Section8View는 이미 sectorVotes/sectorAgg 렌더링 코드 보유 — 데이터 들어오면 자동 표시

Verification (post-commit):
- build OK 25 routes / lint 0 err 6 warn (baseline 유지) / test:ci 699 (+8) / tsc clean

Spec SoT: docs/superpowers/specs/2026-05-21-step3c-caller-wiring.md
Plan: docs/superpowers/plans/2026-05-21-step3c-caller-wiring.md

omxy R1 (spec/plan) CONVERGED + final R1 (post-commit) 박제.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## Task 2 — push + PR create

### Task 2.1 — push

```bash
git push -u origin feat/tier2-caller-wiring
```

### Task 2.2 — PR create

```bash
gh pr create --base main --title "feat(Step 3c): Tier 2 caller wiring (admin action) + 8 tests" --body "..."
```

PR body 박제:
- Summary (3-5 bullets)
- omxy 53차 §3 R3 D6 cost gate single env flag
- spec/plan SoT 링크
- Test plan (8 cases)
- OOS (cron / UI / billing / Reflection / S7b)

### Task 2.3 — omxy final R1 (mandatory)

Spec §8 cadence 박제: PR create 후 omxy final adversarial review 1 round 강제.

CONVERGED → USER 머지 권한 (B-17g 신설).

---

## Task 3 — HANDOFF.md 박제 (post-PR-create)

`Document/Process/HANDOFF.md` 갱신 (단일 commit, push):
- header: 53차 §3 종료 → 53차 §4 진입 (Step 3c PR open) 또는 53차 §3 후속
- §1 표: branch state · PR list · omxy 누적
- §2.1 Step matrix: Step 3c row update (CLAUDE → done 또는 in-progress with PR # link)
- §6 entry: Step 3c 박제 (본 PR scope + 결과)
- §7.7 omxy round count 갱신

---

## Verification checklist

- [ ] Task 1.1 actions.ts 확장 완료
- [ ] Task 1.2 actions.test.ts 5 test cases 통과
- [ ] Task 1.3 검증 게이트 4종 모두 baseline 유지 (+8 tests)
- [ ] Task 1.4 commit (atomic, single)
- [ ] Task 2.1 push 성공 (fast-forward)
- [ ] Task 2.2 PR open
- [ ] Task 2.3 omxy final R1 → CONVERGED
- [ ] Task 3 HANDOFF.md 박제 + push
- [ ] (USER) PR review/merge

---

## Stop conditions

- Task 1.1에서 short_list_30 in-code Database type에 `sector / sub_tags`가 매핑되어 있지 않으면 → 별도 Task로 type 갱신 (마이그 0012/0018은 production apply 완료, type만 stale).
- omxy R1 (spec/plan) CONTINUE → CONVERGED 받을 때까지 spec/plan 정정 후 진입.
- omxy final R1 CONTINUE → catch BLOCKERS fix 후 R2 (최대 8 rounds).

---

## Changelog

- 2026-05-21 (D3 spec/plan 작성, omxy R1 대기): 초안. 단일 축 commit + cost gate single env flag + cron/UI 변경 0 박제.
