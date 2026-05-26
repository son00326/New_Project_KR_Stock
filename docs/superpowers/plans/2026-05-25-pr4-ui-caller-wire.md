# PR4 (UI Caller Wire + Track Record + Regen + PR3a OOS + B18 CRON_SECRET 401) Implementation Plan

> **For agentic workers:** This plan uses **inline execution** (omxy R2 결정 — subagent-driven-development는 폐기, omxy adversarial review로 대체). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** canonical 5-PR 마지막 단계. Group A (track-record trigger 위치) + Group F (Track Record 누적 vs 아카이브 탭 분리) + Group D 잔여 (UI caller wire) + PR3a OOS 3종 (partA 14 rows / aggregateVotes guard / LLM max bound) + B18 (CRON_SECRET 401 test) + **Track 2/3 defer triage** (W7만 본 PR 적용 / 잔여 PR3b·PR3c defer는 PR body에 source review docs 링크로 박제, no code changes beyond W7).

**Architecture:** **T5 first vertical slice** (omxy R2 권고 q4=a) = admin trigger 버튼 1개 + server action wire + caller DI (`commitFullReport`) + minimum tests. T5 사용자 승인 후 단계적 확장 — Regen (`orchestrateFullReport`) → Track Record 탭 → PR3a OOS → defer/B18.

**Tech Stack:** Next.js 16.2.3 App Router (server components 우선) · React 19.2.4 · Tailwind v4 + shadcn (`tudal/src/components/ui` 기존 패턴) · Vitest · Supabase SSR · server actions (`{success: true, data} | {success: false, error}` 규약).

---

## omxy Plan R1 → 6 BLOCKERS Fix Log (v2 amend)

| # | BLOCKER | 실 코드 증거 | v2 Fix 적용 |
|---|---|---|---|
| **B1** | A.0.2 "DB constraint 없음" 박제 오류 | `tudal/supabase/migrations/0003_s2_reports.sql:75 vote text not null check (vote in ('approve','reject','abstain'))` 이미 존재 | A.0.2 문구 정정 + **PR4 마이그 0건 유지** + Task 5 변경: runtime layer 2 guard (`transformCommitteeVoteRow` zod-shape + `aggregateVotes` defensive) |
| **B2** | caller DI seam 불완전 (commitFullReport/orchestrateFullReport만 client 받으면 PR3c RPC chain drift) | `cost-logger.ts` / `full-report-client.ts:71-81` / `report-critic-findings.ts:29-35` / `sector-reference-backlog.ts:36-49` / `critic-client.ts` / `revise-client.ts` 모두 자체 createClient | 기존 패턴 `admin-shortlist-persist.ts:39-43 options: { client?: SupabaseClient } = {}` 적용. 모든 helper에 client 전파 |
| **B3** | T5 slice stub invalid | (1) `PortfolioPanelProps` ticker/name 미포함 (line 23-37) (2) `ShortListItem.month = YYYY-MM-01` (`types/admin.ts:35`) vs plan regex `YYYY-MM` (3) tier1Verdict/consensusBadge 빈 문자열 invalid (prompt enum 요구) | T5는 ShortListItem 1개를 page에서 prop 전달 + `monthYM = month.slice(0,7)` 변환 + valid `'HOLD'`/`'🟡'`/"근거 부족" stub + DI test는 schema-valid JSON fixture |
| **B4** | test infra T5 **전** 결정 필요 | `vitest.config.ts:13-16` = `include: 'src/**/__tests__/**/*.test.ts'` + `environment: 'node'` + testing-library/jsdom **미설치** | Task 1 **Step 1.0** 신설 — jsdom + @testing-library/react + @testing-library/jest-dom 설치 + vitest.config 분리 (test/component 환경 분리) |
| **B5** | Task 8 scope creep | W2 timeout/W4 strict bool/W5 ESM은 UI caller와 무관 | W2/W4/W5 → PR body defer로 격하. **W7만 Task 2 substep** |
| **B6** | sector backlog RLS | OK (0023 grants 정합 — service_role + authenticated grant) | B2 fix로 자동 해결 (helper client DI 누락이 본질) |

**v2 commit message**: `docs(PR4 omxy R1): plan v2 — 6 BLOCKERS fix (A.0 박제 정정 + caller DI 전파 + T5 stub 정정 + test infra Step 1.0 + Task 8 scope 축소)`

---

## omxy Plan R2 → 5 신규 BLOCKERS Fix Log (v3 amend, 누적 11)

| # | BLOCKER | 실 코드 증거 | v3 Fix 적용 |
|---|---|---|---|
| **B7** | Step 1.0 infra 버전 wrong + Vitest 4 deprecation | `package.json:42 vitest@^4.1.4` (latest 4.1.7) — Vitest 4.0에서 `environmentMatchGlobs` removed (대안 = `test.projects`). `@testing-library/react` latest **16.3.2** (not 17). `jest-dom` latest **6.9.1** (not 7). | (i) Step 1.0.1 deps: `jsdom@^26 @testing-library/react@^16 @testing-library/jest-dom@^6`. (ii) Step 1.0.3 vitest config: `test.projects` 분리 (node project + jsdom project) — `environmentMatchGlobs` 폐기 |
| **B8** | Step 1.1.1 / 1.2.1 fixture inconsistency | plan v2 line 522 "schema-valid fixture" 박제했지만 code block은 여전히 `content: '{}'` → RPC 도달 검증 거짓 양성/음성 | `tudal/src/test/fixtures/full-report-valid.ts` 신설 — `validFullReportJson()` helper (Section 0~7 + Appendix valid JSON). Step 1.1.1 / 1.2.1 code block에서 직접 import |
| **B9** | triggerFullReport test args mismatch | plan signature `{ticker, name, sector, month}` 4-field인데 tests는 `{ticker, month}` 2-field 호출 → TS type error | Step 1.2.1 tests에서 4-field 호출 (`name`/`sector` 포함) + invalid_input test는 명시적으로 `name=''` 또는 누락 |
| **B10** | UI wire 위치 박제 오류 | plan v2가 page.tsx에서 `shortList.map` 직접 패턴. 실제는 `/admin/portfolio/page.tsx:9 import { BucketSection }` + line 263 사용. `BucketSection` → `ShortlistRow` (`tudal/src/components/admin/shortlist/`). `ShortlistRow` props = `{ item: ShortListItem }` only — action slot 부재 | Step 1.3.4 정정: (i) `ShortlistRow` props에 `action?: ReactNode` 추가 (optional). (ii) `BucketSection` props에 `renderRowAction?: (item: ShortListItem) => ReactNode` 추가. (iii) page.tsx에서 `renderRowAction={item => <TriggerFullReportButton .../>}` 전달. portfolio-panel.tsx 변경 0 (stale commit 문구 삭제) |
| **B11** | Task 5 getVotesByReportId wrapper 회귀 위험 | `admin-committee.ts:55 return rows.map(transformCommitteeVoteRow)` 직접 호출 — layer 1이 `CommitteeVote \| null` 반환하면 즉시 회귀 (null이 array에 들어감 → caller 폭증) | Step 5.1.5 추가: `getVotesByReportId`를 `return transformCommitteeVoteRows(rows)` (wrapper, null filter) 사용으로 변경 + 기존 direct tests는 transformer 단독 호출 시 null 가능성 명시 + non-null assert |

**v3 commit message**: `docs(PR4 omxy R2): plan v3 — 5 BLOCKERS fix (deps versions + test.projects + fixture import + tests 4-field + BucketSection wire + getVotesByReportId wrapper)`

**누적 BLOCKERS**: 6 (R1) + 5 (R2) = **11**.

---

## omxy Plan R3 → 3 신규 BLOCKERS Fix Log (v4 amend, 누적 14)

| # | BLOCKER | 실 코드 증거 | v4 Fix 적용 |
|---|---|---|---|
| **B12** | `validFullReportJson()` fixture **실제 schema 부적합** | `report-section-schemas.ts:12-18 conviction = score0to100` (number 0~100, **not 'HOLD' string**) + Section 0 `committeeMini`/`priceBands` 필수 (line 19-35) + Section 2 `revenue`/`margins`/`balance` 필수 (line 47-52) + Section 3 `multiples` 필수 (line 56-60) + Section 6 `axis`/`divergencePct` 필수 (line 83-99) | Step 1.0.7 fixture 전면 재작성 — Section 0~7 + Appendix 모두 schema parse 통과. fixture 신설 직후 `reportSection0Schema.parse(validFullReportSections().section_0)` sanity assert (Step 1.0.7.3) |
| **B13** | PR3c helper 경로/함수명 박제 오류 | 실제 `tudal/src/lib/**data**/report-critic-findings.ts` + `tudal/src/lib/**data**/sector-reference-backlog.ts` (not `lib/report/`). 함수명 `insertOrBumpBacklog` (not `insertSectorBacklog`). report-critic-findings는 `insertCriticFindingsRun`/`getCriticFindingsByRunId`/`listLatestRunCriticFindings` 3종 정합 OK | amend log R1 B2 table row 경로 정정 + File Structure 16 modified table 경로/함수명 정정 + Step 1.1.6 helper module 박제 정정 + Step 1.1.10 commit message git add path 정정 |
| **B14** | stale 문구 (실행자 혼선) | Plan line 116 "environment matcher" 표현 잔존 + Step 1.0.6 commit message에 `environmentMatchGlobs` 잔존 (v3에서 `test.projects`로 변경됨) + File Structure에 `portfolio-panel.tsx` 옵션 표현 잔존 (v3 B10에서 변경 0 확정) | Step 1.0.3 헤더 "environment matcher" → "test.projects 분리" + Step 1.0.6 commit message 정정 + File Structure에서 `portfolio-panel.tsx` row 표현 정정 (변경 안 함 명시) |

**v4 commit message**: `docs(PR4 omxy R3): plan v4 — 3 BLOCKERS fix (fixture schema valid + lib/data helper 경로 정정 + stale 문구 cleanup)`

**누적 BLOCKERS**: 6 (R1) + 5 (R2) + 3 (R3) = **14**.

---

## omxy Plan R4 → 3 신규 BLOCKERS Fix Log (v5 amend, 누적 17)

| # | BLOCKER | 증거 | v5 Fix 적용 |
|---|---|---|---|
| **B15** | B12 sanity test 9건이 commit `git add` + Acceptance criteria에 박제 누락 | Step 1.0.7.2 test 파일 박제됐지만 Step 1.0.7.3 commit `git add`에 `tudal/src/test/fixtures/__tests__/full-report-valid.test.ts` 누락 + Acceptance §검증 영역에 "validFullReportSections 9 schema parse tests PASS" 누락 | Step 1.0.7.3 commit `git add`에 sanity test path 추가 + Acceptance §검증에 9 sanity tests 명시 |
| **B16** | grep 0 조건 정의 mismatch (negative mention 잔존) | R4 (n)(o) 검증 조건 "grep 0 match"인데 amend log/File Structure에 의도적 박제 negative mention ("(not insertSectorBacklog)" 등) 잔존 → grep match 됨. 의미적 stale은 아니나 검증 조건 false | Self-Review §3 검증 조건 정의 명시 — "**stale instruction 0**" (negative mention/박제는 허용). amend log 본문은 유지 (역사 traceability) |
| **B17** | Defer count drift | Task 8 (line 1218-1220) "Defer 19 follow-up tickets" / Acceptance (line 1374) "Defer (16 P2/Info)" 불일치 | Acceptance "16" → "**19**" + Task 8 list와 1:1 동기 (PR3b 5 + PR3c Track 2 잔여 + PR3c Track 3 잔여) |

**v5 commit message**: `docs(PR4 omxy R4): plan v5 — 3 BLOCKERS fix (sanity test commit/acceptance + grep 조건 정의 + defer count drift)`

**누적 BLOCKERS**: 6 (R1) + 5 (R2) + 3 (R3) + 3 (R4) = **17**.

---

## omxy Plan R5 → 3 신규 BLOCKERS Fix Log (v6 amend, 누적 20)

| # | BLOCKER | 증거 | v6 Fix 적용 |
|---|---|---|---|
| **B18-o** (omxy R5 #1, 본 PR4 B18 CRON_SECRET과 별개) | Step 1.0.7.3 뒤 stale duplicate commit block (line 408-419) | v5 fix가 중복 stale Step 1.0.7.2를 부분 제거. line 408-419의 "위 Step 1.0.6 commit에 ..." 추가 박제가 잔존 → B15 다시 깨는 실행자 혼선 | line 408-419 전체 삭제 (Step 1.0.6 commit body 1개만 남김 — line 268~278) |
| **B19** | Defer 19 산술 불명확 + bucket 표현 | Task 8 line 1245-1247 "Track 2 12 + Track 3 8 = 20 중 1 적용 = 19 defer" / line 1262-1266 "PR3b 5 + Track 2 잔여 W1/W3/W4/W5/W6/W8 + I1~I10" / Acceptance line 1417-1420 "잔여 5+I10" — W 항목 카운트와 I bucket 표현 mismatch | Task 8 + Acceptance 모두 **D01~D24 명시** (PR3c defer 19 + PR3b defer 5 = 24 total). I1~I10은 1 ticket bucket 또는 ID로 펼침 둘 중 명시. PR3c HANDOFF defer 20 - W7 본 PR 적용 1 = 19 산술 명확화 |
| **B20** | Goal line scope drift | line 5 "Track 2/3 defer 20 follow-up 해소" — 실제 합의는 "W7 본 PR 적용 + 19 follow-up PR body 박제" | Goal line "Track 2/3 defer 20 follow-up 해소" → "Track 2/3 defer 20 triage (W7 본 PR 적용 + PR3c defer 19 follow-up PR body 박제) + PR3b defer 5 (별도)" |

**v6 commit message**: `docs(PR4 omxy R5): plan v6 — 3 BLOCKERS fix (duplicate commit block 제거 + Defer D01~D24 산술 명시 + Goal scope 정합)`

**누적 BLOCKERS**: 6 (R1) + 5 (R2) + 3 (R3) + 3 (R4) + 3 (R5) = **20**.

---

## omxy Plan R6 → 1 critical BLOCKER Fix Log (v7 amend, 누적 21 — final)

| # | BLOCKER | 증거 | v7 Fix 적용 |
|---|---|---|---|
| **B21** | Defer ID 산술/박제 모순 (v5+v6 fix 시도 후에도 정합 안 됨) | Goal "19+5" / B19 fix log "D01~D24" / Acceptance header "D01~D24" / 산술 "D01~D23 total" / Track 2 "D12 I-bucket" 자체 모순 / Track 3 "D18/D19 미식별" / final count "18 또는 24" — plan에서 산술 닫히지 않음 | **omxy 강한 fix 권고 채택**: defer 상세 ID list 전부 삭제 + **원칙만 박제**. PR4 scope = W7만 본 PR 적용 / PR body = PR3b/PR3c review docs **링크 참조** / Acceptance = "defer follow-up은 PR body에 source docs 링크 + W7 applied 여부 + **no code changes beyond W7**로 박제". 숫자/D-ID/bucket 표현 plan에서 모두 제거. count drift = T6 implementer가 PR3c body에서 직접 재추출 (plan acceptance 숫자 검증 대상 제외) |

**v7 commit message**: `docs(PR4 omxy R6): plan v7 — B21 fix (defer ID 산술 제거 + 원칙만 박제 — omxy 강한 권고 채택)`

**누적 BLOCKERS**: 6 (R1) + 5 (R2) + 3 (R3) + 3 (R4) + 3 (R5) + 1 (R6) = **21 — final** (omxy R7 = B21 confirm only).

---

## omxy R1~R2 CONVERGED 결정 (변경 금지)

| 항목 | 결정 | 적용 |
|---|---|---|
| implementer | Claude 단독 primary | 본 plan 작성·impl·verify 모두 Claude |
| omxy 역할 | adversarial reviewer + final review (T8 depth 대체) | T4/T7/T9 R rounds + T8 final |
| 단일 PR | ✅ | T2/T5/T10 gate 실패 시만 축소 |
| gstack-design-html | ❌ 사용 안 함 | shadcn + `tudal/src/components/ui` 직접 |
| vercel:nextjs / vercel:shadcn skill | ❌ invoke 금지 | `node_modules/next/dist/docs/` 로컬 read |
| inline skills | ✅ writing-plans (본 plan) / TDD (T6) / verification (T6+T9) / requesting-code-review (T8) — SKILL.md checklist read-through + 적용 선언 | parent-owns-skill rule 준수 |
| read-only subagent | ✅ T1/T2 사이 PR3a OOS 검증 1회 (완료) | file:line 증거 확보 — Section A.0 박제 |
| T8 3-track 축소판 | (a) gstack-review inline + (b) 5-angle scan subagent 1회 + (c) omxy final | depth=deep general-purpose 폐기 |
| T5 first vertical slice | admin trigger 버튼 1개 + server action wire + caller DI (commitFullReport) + minimum tests | Task 1 = T5 slice |
| Gates | T2 plan/file map · T5 first vertical slice · T10 final diff + build/lint/test | 3-gate |

---

## Spec Lock-in (변경 금지 — 재해석 금지)

- **사용자 lock-in 8 항목** (53차 §5 spec doc §1 + 55차 §2/§4 amendment): (1.1) Tier 0+1 메인 path / (1.2) 풀 리포트 단일 산출물 / (1.3) 3 trigger path / (1.4) /admin → 30 list → 클릭 → 풀 리포트 페이지 / (1.5) Track Record 탭 분리 / (1.6) Kevin v3.1 quality target / (1.7) Sector 3-level / (1.8) API 금액 무관.
- **canonical 5-PR 순서**: PR2 ✅ → PR3a ✅ → PR1 ✅ → PR3b ✅ → PR3c ✅ → **PR4** (본 plan).
- **caller path 박제 (B8 + omxy R2)**: cron = `commitFullReport` (fast) / admin manual trigger = `orchestrateFullReport` (quality). T5 first vertical slice는 `commitFullReport`로 wire (DI seam 입증) → 사용자 승인 후 admin path만 `orchestrateFullReport`로 swap (Task 2).
- **B18 보안 contract**: cron `monthly-batch` route는 `CRON_SECRET` env 검증 + 검증 실패 시 401 반환 + e2e test.

---

## Section A.0 — Read-only subagent OOS 검증 결과 (file:line 박제, T3 진입 전 완료)

### A.0.1 — RT#1 Section8ModernView.partA 14 rows 결함
- 위치: `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` line 640–750
- 상태: **결함 — partA 렌더 JSX 부재** (grep 0 hit). zod schema (`tudal/src/lib/report/section-8-schema.ts` line 48–50)는 partA length `0 || 14` 강제하지만 UI 미표시
- 조치: Task 4에서 line 696–750 사이 partA 14 rows 테이블/카드 렌더 신설

### A.0.2 — RT#3 aggregateVotes enum 보호 (v2 정정 — omxy R1 B1)
- 위치: `tudal/src/lib/data/admin-committee.ts` line 63–75
- 상태: TypeScript 레벨 안전 (VoteKind 'approve'|'reject'|'abstain'). **DB CHECK constraint 이미 존재** (`tudal/supabase/migrations/0003_s2_reports.sql:75 vote text not null check (vote in ('approve','reject','abstain'))`). 다만 `transformCommitteeVoteRow` (line 23–36) runtime에서 zod-shape guard 없이 전달 — DB→TS 경계에서 row corruption (운영 사고 등) 시 NaN/undefined 위험.
- `partCToCommitteeAgg` (`report-section-schemas.ts` line 240–248)는 zod 검증으로 안전
- 조치 (v2 amend, B1 fix): **PR4 마이그 0건 유지** (DB constraint 충분). Task 5는 **runtime layer 2 guard만**:
  - layer 1: `transformCommitteeVoteRow` 내 `VALID_VOTES.has(row.vote)` 가드 — invalid row skip + warn
  - layer 2: `aggregateVotes` defensive guard (caller가 직접 row read하는 path 대비)
- v1의 (i) zod committeeVoteSchema 추가 옵션은 **defer** (변경 범위 증가 + admin-committee.ts 외 caller 영향). DB CHECK가 1차 방어선이므로 layer 2가 충분.

### A.0.3 — RT#4/RT#5 LLM string/array max bound 누락 (top 5)
- 위치: `tudal/src/lib/data/report-section-schemas.ts` + `tudal/src/lib/report/section-8-schema.ts`
- 누락 인벤토리 (subagent 박제):
  1. `reportSection0Schema.headline` (line 16) → `.max(200)`
  2. 모든 section의 `summary` (Sections 2~7 + Section 8 modern coreVoteRow.one_line) → `.max(1000)` (one_line은 `.max(300)`)
  3. `reportSection8LegacySchema.keyQuotes[].quote` (line 174–179) → `.max(500)`
  4. `coreVoteRowSchema.one_line` (`section-8-schema.ts` line 19) → `.max(300)`
  5. `thesis[]` array (Section 0 line 17) → `.max(10)`
- 조치: Task 6에서 top 5 max bound 추가 + 기존 tests 회귀 0 + 새 boundary tests 5건

---

## File Structure (v2 amend — B2/B4 적용)

### 신설 (8 files)
| File | Purpose |
|---|---|
| `tudal/src/app/(admin)/admin/portfolio/trigger-full-report-button.tsx` | T5 slice: admin trigger 버튼 컴포넌트 (server action 호출) |
| `tudal/src/app/(admin)/admin/portfolio/__tests__/trigger-full-report-button.test.tsx` | T5 slice: 버튼 행동 단위 테스트 (loading/success/error) — **jsdom + @testing-library/react** (Step 1.0 infra 의존) |
| `tudal/src/lib/report/__tests__/full-report-writer-caller-di.test.ts` | T5: `commitFullReport` caller DI seam 단위 테스트 |
| `tudal/src/lib/report/__tests__/full-report-orchestrator-caller-di.test.ts` | Task 2: `orchestrateFullReport` caller DI seam 단위 테스트 |
| `tudal/src/app/api/cron/monthly-batch/__tests__/cron-secret-401.test.ts` | Task 7 B18: cron CRON_SECRET 401 e2e test (또는 기존 route.test.ts 확장) |
| `tudal/src/app/(admin)/admin/track-record/track-record-tabs.tsx` | Task 3: 누적/아카이브 탭 컴포넌트 (shadcn Tabs 사용) |
| `tudal/src/app/(admin)/admin/track-record/__tests__/track-record-tabs.test.tsx` | Task 3: 탭 행동 단위 테스트 — **jsdom 의존** |
| `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/__tests__/orchestrate-wire.test.ts` | Task 2: Regen orchestrateFullReport wire 단위 테스트 |

### 수정 (16 files — B2 caller DI 전파 + B4 vitest config)
| File | 변경 요약 |
|---|---|
| `tudal/package.json` | **B4 fix**: devDeps 추가 — `jsdom` + `@testing-library/react` + `@testing-library/jest-dom` |
| `tudal/vitest.config.ts` | **B4 + B7 fix (v4)**: `test.projects` 분리 (node project: `**/*.test.ts` env=node / jsdom project: `**/*.test.tsx` env=jsdom + setupFiles). v3 `environmentMatchGlobs`는 Vitest 4에서 removed. |
| `tudal/src/test/jsdom-setup.ts` (신규) | **B4 fix**: jest-dom matchers global import |
| ~~`tudal/src/app/(admin)/admin/portfolio/portfolio-panel.tsx`~~ | **v3+v4 B10/B14 정정: 변경 안 함**. 실제 wire = ShortlistRow.action + BucketSection.renderRowAction (`tudal/src/components/admin/shortlist/`). page.tsx에서 callback 전달. |
| `tudal/src/app/(admin)/admin/portfolio/page.tsx` | **B3 fix**: ShortListItem.month (YYYY-MM-01) → `monthYM = month.slice(0,7)` 변환 후 TriggerFullReportButton에 전달 |
| `tudal/src/lib/report/full-report-writer.ts` line 133–250 | Task 1: `commitFullReport(input, options?: { client?: SupabaseClient; callerKind?: 'cron' \| 'admin' })` 시그니처. **B2 fix**: options 패턴 (admin-shortlist-persist.ts:39-43 정합) |
| `tudal/src/lib/report/full-report-orchestrator.ts` line 127–250 | Task 2: 동일 패턴 — `options: { client?; callerKind? }` |
| `tudal/src/lib/cost/cost-logger.ts` | **B2 fix**: `preflightHardcap` + `insertCostLog` 모두 `options: { client?: SupabaseClient } = {}` 추가 (기존 createClient fallback 보존) |
| `tudal/src/lib/ai/full-report-client.ts` | **B2 fix**: `callFullReport` options.client 추가 → insertCostLog에 전파 |
| `tudal/src/lib/ai/critic-client.ts` | **B2 fix**: 동일 options.client (cost_log RLS 정합) |
| `tudal/src/lib/ai/revise-client.ts` | **B2 fix**: 동일 options.client |
| `tudal/src/lib/data/report-critic-findings.ts` (v4 B13 정정) | **B2 fix**: `insertCriticFindingsRun` + `getCriticFindingsByRunId` + `listLatestRunCriticFindings` 모두 options.client |
| `tudal/src/lib/data/sector-reference-backlog.ts` (v4 B13 정정) | **B2 fix**: `insertOrBumpBacklog` (실제 함수명) + `listBacklog`에 options.client |
| `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/actions.ts` | Task 2: `orchestrateFullReport` 실 호출 wire (현재 quota counter only) |
| `tudal/src/app/(admin)/admin/track-record/page.tsx` | Task 3: 신규 `<TrackRecordTabs/>` 통합 + Server Component data fetch (누적/아카이브 분리) |
| `tudal/src/app/(admin)/admin/track-record/actions.ts` | Task 3: 누적 vs 월별 아카이브 fetch 분리 (`fetchTrackRecordCumulative` + `fetchTrackRecordArchive`) |
| `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` line 696–750 | Task 4: Section8ModernView partA 14 rows 렌더 |
| `tudal/src/lib/data/admin-committee.ts` line 23–75 | Task 5 (v2 정정 — B1): **runtime layer 2 guard** — `transformCommitteeVoteRow` invalid row skip + warn + `aggregateVotes` defensive guard. **마이그 0건** |
| `tudal/src/lib/data/report-section-schemas.ts` + `tudal/src/lib/report/section-8-schema.ts` | Task 6: top 5 max bound 추가 |
| `tudal/src/lib/admin/format-error.ts` | Task 9: PR4 신규 에러 키 + prefix 한국어 매핑 (예상 4~6 keys) |

---

## Task 1: T5 First Vertical Slice — admin trigger 버튼 + caller DI 전파 (모든 helper, B2) + minimum tests

**Files:**
- Create: `tudal/src/app/(admin)/admin/portfolio/trigger-full-report-button.tsx`
- Create: `tudal/src/app/(admin)/admin/portfolio/__tests__/trigger-full-report-button.test.tsx` (jsdom 의존)
- Create: `tudal/src/lib/report/__tests__/full-report-writer-caller-di.test.ts`
- Create: `tudal/src/test/jsdom-setup.ts` (Step 1.0)
- Modify: `tudal/package.json` (Step 1.0 — devDeps)
- Modify: `tudal/vitest.config.ts` (Step 1.0 — `test.projects` 분리, v4 B7+B14)
- Modify: `tudal/src/lib/report/full-report-writer.ts:133` (commitFullReport options 시그니처)
- Modify: `tudal/src/lib/cost/cost-logger.ts` (preflightHardcap + insertCostLog options.client)
- Modify: `tudal/src/lib/ai/full-report-client.ts` (callFullReport options.client)
- Modify: `tudal/src/app/(admin)/admin/portfolio/actions.ts` (신규 `triggerFullReport` server action)
- Modify (신설 3 file, v4 B10): `tudal/src/components/admin/shortlist/shortlist-row.tsx` (action prop) + `tudal/src/components/admin/shortlist/bucket-section.tsx` (renderRowAction prop)
- `portfolio-panel.tsx`는 **변경 안 함** (v4 B10/B14 정합)
- Modify: `tudal/src/app/(admin)/admin/portfolio/page.tsx` (ShortListItem prop 전달 + month.slice(0,7) — B3)

### Step 1.0: Test infra 도입 (jsdom + @testing-library) — B4 fix

> **B4 fix (omxy R1)**: vitest config는 node only + `*.test.ts` only. component test 위해 jsdom + testing-library 필요. T5 전 결정.

- [ ] **Step 1.0.1: Install devDependencies (v3 정정 — B7 omxy R2)**

> **B7 fix**: npm latest 검증 — `@testing-library/react@16.3.2` / `@testing-library/jest-dom@6.9.1` / `jsdom@26.x` / `vitest@4.1.7`. v2 박제 `^17` / `^7`은 install 실패.

```bash
cd tudal && npm i -D jsdom@^26 @testing-library/react@^16 @testing-library/jest-dom@^6
```

- [ ] **Step 1.0.2: Create `tudal/src/test/jsdom-setup.ts`**

```ts
// tudal/src/test/jsdom-setup.ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 1.0.3: Modify `tudal/vitest.config.ts` — `test.projects` 분리 (v3 정정 — B7 omxy R2)**

> **B7 fix**: Vitest 4.0에서 `environmentMatchGlobs` removed (migration guide). 공식 대안 = `test.projects` (node + jsdom 두 project).

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': path.resolve(__dirname, 'src/test/server-only-empty.ts'),
    },
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/__tests__/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          include: ['src/**/__tests__/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./src/test/jsdom-setup.ts'],
        },
      },
    ],
  },
});
```

> **참고**: vitest@4.1.4 → 4.1.7 (latest) 업그레이드는 본 Step에서 강제 안 함. `projects` API는 4.x 전반 지원.

- [ ] **Step 1.0.4: Run sanity test — verify infra works**

Create temp `src/test/__tests__/jsdom-sanity.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('jsdom sanity', () => {
  it('renders react component', () => {
    render(<button>click</button>);
    expect(screen.getByRole('button')).toHaveTextContent('click');
  });
});
```

Run: `cd tudal && npx vitest run src/test/__tests__/jsdom-sanity.test.tsx`
Expected: 1 PASS. **삭제 후 commit** (sanity 파일 git 미포함).

- [ ] **Step 1.0.5: Run regression — verify existing node tests still PASS**

Run: `cd tudal && npm run test:ci`
Expected: 1010 PASS (회귀 0).

- [ ] **Step 1.0.6: Commit infra setup**

```bash
git add tudal/package.json tudal/package-lock.json tudal/vitest.config.ts tudal/src/test/jsdom-setup.ts
git commit -m "build(PR4 Task1 Step1.0): jsdom + @testing-library/react infra (B4 fix omxy R1)

- jsdom + testing-library/react + testing-library/jest-dom devDeps
- vitest.config: test.projects (node + jsdom 분리, Vitest 4 환경)
- jsdom-setup.ts: jest-dom matchers
- 회귀 0 (existing 1010 PASS)"
```

### Step 1.0.7: schema-valid JSON fixture helper 신설 (v3 — B8 omxy R2)

> **B8 fix**: Step 1.1.1 / 1.2.1 / 후속 caller DI test가 `content: '{}'` 대신 schema-valid JSON 사용해야 RPC 도달 검증이 정확. fixture helper 신설.

- [ ] **Step 1.0.7.1: Create `tudal/src/test/fixtures/full-report-valid.ts` (v4 정정 — B12 schema 정합)**

> **B12 fix**: `report-section-schemas.ts` 실제 schema 전부 정합. Section 0 `conviction = number` + `committeeMini` + `priceBands` 등 필수 필드 포함.

```ts
// tudal/src/test/fixtures/full-report-valid.ts
// PR4 Step 1.0 B8+B12 fix (omxy R2+R3): Section 0~7 + Appendix schema-valid JSON fixture
// report-section-schemas.ts:12-114 실제 필드와 1:1 정합. Section 8은 별도 (modern is_dual_shape).

export function validFullReportSections() {
  return {
    section_0: {
      headline: '근거 부족',
      thesis: ['근거 부족'],
      conviction: 50, // score0to100 (number 0~100, finite)
      committeeMini: {
        core: { approve: 0, reject: 0, abstain: 0 },
        sector: { approve: 0, reject: 0, abstain: 0 },
      },
      priceBands: { bear: '근거 부족', base: '근거 부족', bull: '근거 부족' },
    },
    section_1: {
      description: '근거 부족',
      segments: [], // {name,share}[] — 빈 배열 OK
      keyFacts: [], // {label,value}[] — 빈 배열 OK
    },
    section_2: {
      summary: '근거 부족',
      revenue: [], // {fy,value,yoy}[]
      margins: { operating: '근거 부족', net: '근거 부족' },
      balance: { debtRatio: '근거 부족', cash: '근거 부족' },
    },
    section_3: {
      summary: '근거 부족',
      multiples: [], // {metric,value,peer}[]
    },
    section_4: {
      summary: '근거 부족',
      drivers: [], // string[]
      tam: '근거 부족',
    },
    section_5: {
      summary: '근거 부족',
      risks: [], // {title,severity,detail}[]
    },
    section_6: {
      summary: '근거 부족',
      signals: [], // {name,state:'on'|'watch'|'off',note}[]
      axis: { trend: 50, momentum: 50, volatility: 50 }, // score0to100
      divergencePct: 0, // number (음수 허용, finite)
    },
    section_7: {
      summary: '근거 부족',
      triggers: [], // string[]
      alternatives: [], // {label,detail}[]
    },
    appendix: {
      technicals: [], // {name,value}[]
      dataSources: [], // string[]
    },
  };
}

export function validFullReportJson(): string {
  return JSON.stringify(validFullReportSections());
}
```

- [ ] **Step 1.0.7.2: Sanity test — fixture가 실제 zod schemas parse 통과 검증 (v4 — B12)**

```ts
// tudal/src/test/fixtures/__tests__/full-report-valid.test.ts
import { describe, it, expect } from 'vitest';
import { validFullReportSections } from '../full-report-valid';
import {
  reportSection0Schema,
  reportSection1Schema,
  reportSection2Schema,
  reportSection3Schema,
  reportSection4Schema,
  reportSection5Schema,
  reportSection6Schema,
  reportSection7Schema,
  reportAppendixSchema,
} from '@/lib/data/report-section-schemas';

describe('validFullReportSections fixture — schema 정합 (B12 sanity)', () => {
  const sections = validFullReportSections();

  it('section_0 parses successfully', () => {
    expect(() => reportSection0Schema.parse(sections.section_0)).not.toThrow();
  });
  it('section_1 parses', () => { expect(() => reportSection1Schema.parse(sections.section_1)).not.toThrow(); });
  it('section_2 parses', () => { expect(() => reportSection2Schema.parse(sections.section_2)).not.toThrow(); });
  it('section_3 parses', () => { expect(() => reportSection3Schema.parse(sections.section_3)).not.toThrow(); });
  it('section_4 parses', () => { expect(() => reportSection4Schema.parse(sections.section_4)).not.toThrow(); });
  it('section_5 parses', () => { expect(() => reportSection5Schema.parse(sections.section_5)).not.toThrow(); });
  it('section_6 parses', () => { expect(() => reportSection6Schema.parse(sections.section_6)).not.toThrow(); });
  it('section_7 parses', () => { expect(() => reportSection7Schema.parse(sections.section_7)).not.toThrow(); });
  it('appendix parses', () => { expect(() => reportAppendixSchema.parse(sections.appendix)).not.toThrow(); });
});
```

> Sanity test 통과 = fixture가 schema에 정확히 맞음 보장. T6 impl 진입 시 fixture 변경 위험 0.

- [ ] **Step 1.0.7.3: Commit fixture + sanity tests (v5 — B15 fix: sanity test path 추가)**

Step 1.0.6 commit에 fixture 파일 + sanity test 추가:

```bash
git add tudal/package.json tudal/package-lock.json tudal/vitest.config.ts \
  tudal/src/test/jsdom-setup.ts \
  tudal/src/test/fixtures/full-report-valid.ts \
  tudal/src/test/fixtures/__tests__/full-report-valid.test.ts
git commit -m "build(PR4 Task1 Step1.0): jsdom + testing-library + fixture + sanity tests (B4+B7+B8+B12 fix omxy R1+R2+R3)

- jsdom@^26 + @testing-library/react@^16 + @testing-library/jest-dom@^6
- vitest.config: test.projects (node + jsdom 분리, Vitest 4 환경)
- jsdom-setup.ts: jest-dom matchers
- validFullReportSections() fixture (Section 0~7 + Appendix schema-valid)
- 9 sanity tests (reportSection*Schema.parse() not throw) — fixture invariant
- 회귀 0 (existing 1010 PASS) + 9 신규 sanity"
```

### Step 1.1: Write failing test — caller DI seam (commitFullReport + 모든 helper, B2 fix)

- [ ] **Step 1.1.1: Write the failing test (v3 정정 — B8 fixture import + options 2nd arg)**

```ts
// tudal/src/lib/report/__tests__/full-report-writer-caller-di.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validFullReportJson } from '@/test/fixtures/full-report-valid';

describe('commitFullReport — caller DI seam', () => {
  beforeEach(() => vi.resetModules());

  const validInput = {
    ticker: '005930',
    name: '삼성전자',
    sector: '반도체',
    month: '2026-06',
    tier1Verdict: 'HOLD' as const,
    consensusBadge: '🟡',
    financialsSummary: '근거 부족',
    technicalsSummary: '근거 부족',
    macroSummary: '근거 부족',
    sectorReference: '근거 부족',
    adminUserId: 'admin-uid',
  };

  it('uses injected client when provided (admin caller, RPC 도달)', async () => {
    const fakeClient = {
      rpc: vi.fn().mockResolvedValue({ data: { report_id: 'rpt-1' }, error: null }),
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
    };
    vi.doMock('@/lib/cost/cost-logger', () => ({
      preflightHardcap: vi.fn().mockResolvedValue(undefined),
      insertCostLog: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@/lib/ai/full-report-client', () => ({
      callFullReport: vi.fn().mockResolvedValue({
        content: validFullReportJson(),  // B8 fix: schema-valid JSON으로 parseAndValidate 통과 → RPC 도달
        inputTokens: 1, outputTokens: 1, costKrw: 1,
      }),
    }));
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await commitFullReport(validInput, { client: fakeClient as never, callerKind: 'admin' });
    expect(fakeClient.rpc).toHaveBeenCalledWith('update_report_sections_0_7', expect.any(Object));
  });

  it('falls back to createClient when options omitted (default behavior preserved)', async () => {
    const createClientSpy = vi.fn().mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: { report_id: 'rpt-2' }, error: null }),
    });
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
    vi.doMock('@/lib/cost/cost-logger', () => ({
      preflightHardcap: vi.fn().mockResolvedValue(undefined),
      insertCostLog: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@/lib/ai/full-report-client', () => ({
      callFullReport: vi.fn().mockResolvedValue({
        content: validFullReportJson(),
        inputTokens: 1, outputTokens: 1, costKrw: 1,
      }),
    }));
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await commitFullReport(validInput); // options omitted
    expect(createClientSpy).toHaveBeenCalled();
  });
});
```

**v3 변경 핵심 (B8)**: `content: '{}'` → `validFullReportJson()` import. parseAndValidate 통과 후 RPC 도달 확인 → `fakeClient.rpc` called assertion 의미 있음.

- [ ] **Step 1.1.2: Run test — verify FAIL**

Run: `cd tudal && npx vitest run src/lib/report/__tests__/full-report-writer-caller-di.test.ts`
Expected: FAIL with "commitFullReport doesn't accept client/callerKind param" or signature mismatch.

- [ ] **Step 1.1.3: Modify commitFullReport signature to accept client + callerKind**

Edit `tudal/src/lib/report/full-report-writer.ts:133`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CommitFullReportInput {
  ticker: string;
  name: string;
  sector: string;
  month: string;
  tier1Verdict: string;
  consensusBadge: string;
  financialsSummary: string;
  technicalsSummary: string;
  macroSummary: string;
  sectorReference: string;
  adminUserId: string;
  // PR4 caller DI seam (Group D 잔여 + B8 박제)
  client?: SupabaseClient;
  callerKind?: 'cron' | 'admin';
}

export async function commitFullReport(
  input: CommitFullReportInput,
): Promise<CommitFullReportResult> {
  await preflightHardcap({
    month: input.month,
    callCount: 1,
    maxCostPerCallKrw: FULL_REPORT_MAX_COST_PER_CALL_KRW,
    client: input.client, // PR4: caller-supplied client (cost_log RLS)
  });

  const userPrompt = buildFullReportUserPrompt({ /* ... */ });
  const llm = await callFullReport({ /* ... */ adminUserId: input.adminUserId, client: input.client });
  const sections = parseAndValidate(llm.content, { ticker: input.ticker, month: input.month });
  const supabase = input.client ?? (await createClient()); // PR4: caller DI
  const { data, error } = await supabase.rpc('update_report_sections_0_7', { /* ... */ });
  // ... 나머지 변경 없음
}
```

**v2 amend (B2 fix omxy R1)**: caller DI seam은 `commitFullReport`만으로 부족. PR3c RPC chain (cost_log + critic_findings + sector_backlog)이 모두 자체 createClient → drift. 모든 helper에 동일 `options: { client?: SupabaseClient } = {}` 패턴 적용 (reference: `admin-shortlist-persist.ts:39-43`).

- [ ] **Step 1.1.4: cost-logger.ts에 options 패턴 적용 (B2)**

Edit `tudal/src/lib/cost/cost-logger.ts` — `preflightHardcap` + `insertCostLog` 모두 두 번째 인자로 `options: { client?: SupabaseClient } = {}` 추가. 본체에서 `const supabase = options.client ?? (await createClient());`.

- [ ] **Step 1.1.5: AI client 3종에 options 패턴 적용 (B2)**

Edit:
- `tudal/src/lib/ai/full-report-client.ts` — `callFullReport(input, options?)`
- `tudal/src/lib/ai/critic-client.ts` — `callCritic(input, options?)`
- `tudal/src/lib/ai/revise-client.ts` — `callRevise(input, options?)`

각 함수가 내부에서 `insertCostLog(..., options)` / `preflightHardcap(..., options)` 호출 시 동일 options 전파.

- [ ] **Step 1.1.6: report-critic-findings.ts + sector-reference-backlog.ts에 options 패턴 적용 (B2)**

Edit:
- `tudal/src/lib/data/report-critic-findings.ts` (v4 B13) — `insertCriticFindingsRun`, `getCriticFindingsByRunId`, `listLatestRunCriticFindings` 모두 `options: { client? } = {}`
- `tudal/src/lib/data/sector-reference-backlog.ts` (v4 B13) — `insertOrBumpBacklog` (실제 함수명, **not** insertSectorBacklog) + `listBacklog` 동일

- [ ] **Step 1.1.7: orchestrator wire 변경 (B2)**

Edit `tudal/src/lib/report/full-report-writer.ts` (commitFullReport 본체) — 모든 helper 호출 시 `{ client: input.client }` 전파:

```ts
await preflightHardcap({ /* ... */ }, { client: input.client });
const llm = await callFullReport({ /* ... */ }, { client: input.client });
const supabase = input.client ?? (await createClient());
```

(`orchestrateFullReport`는 Task 2에서 동일 패턴 적용 — Step 2.1.3.)

- [ ] **Step 1.1.8: Helper별 regression test 추가 — caller DI seam invariant**

각 helper에 대해 (i) "options.client 주입 시 createClient 호출 안 됨" + (ii) "options 미지정 시 createClient fallback" 2 tests:
- `cost-logger-caller-di.test.ts` (preflightHardcap + insertCostLog 4 tests)
- `full-report-client-caller-di.test.ts` (callFullReport 2 tests)
- `critic-client-caller-di.test.ts` (callCritic 2 tests)
- `revise-client-caller-di.test.ts` (callRevise 2 tests)
- `report-critic-findings-caller-di.test.ts` (3 helpers × 2 = 6 tests)
- `sector-reference-backlog-caller-di.test.ts` (2 tests)

Total: ~18 new caller DI seam tests (Task 1 전체).

- [ ] **Step 1.1.9: Run all regression — verify PASS**

```bash
cd tudal && npx vitest run src/lib/cost src/lib/ai src/lib/report
```

Expected: 회귀 0 + ~18 new PASS.

- [ ] **Step 1.1.10: Commit (caller DI seam 전체)**

```bash
git add tudal/src/lib/report/full-report-writer.ts \
  tudal/src/lib/cost/cost-logger.ts \
  tudal/src/lib/ai/full-report-client.ts \
  tudal/src/lib/ai/critic-client.ts \
  tudal/src/lib/ai/revise-client.ts \
  tudal/src/lib/data/report-critic-findings.ts \
  tudal/src/lib/data/sector-reference-backlog.ts \
  tudal/src/lib/{cost,ai,report}/__tests__/*caller-di.test.ts
git commit -m "feat(PR4 Task1 Step1.1): caller DI seam 전파 (B2 fix omxy R1)

- commitFullReport + preflightHardcap + insertCostLog + callFullReport + callCritic + callRevise + report-critic-findings (3 helpers) + sector-reference-backlog 모두 options:{client?} 패턴
- 기존 패턴 admin-shortlist-persist.ts:39-43 정합
- ~18 caller DI seam invariant tests (helper별 2 tests)
- 회귀 0. createClient fallback 보존.
- omxy R1 B2 catch — PR3c RPC chain drift 차단."
```

### Step 1.2: Write failing test — triggerFullReport server action

- [ ] **Step 1.2.1: Write the failing test (v3 정정 — B9 omxy R2, 4-field args)**

```ts
// tudal/src/app/(admin)/admin/portfolio/__tests__/trigger-full-report-action.test.ts
import { describe, it, expect, vi } from 'vitest';

const validArgs = {
  ticker: '005930',
  name: '삼성전자',
  sector: '반도체',
  month: '2026-06',
};

describe('triggerFullReport admin server action', () => {
  it('rejects when input.ticker empty', async () => {
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport({ ...validArgs, ticker: '' });
    expect(res).toEqual({ success: false, error: 'invalid_input' });
  });

  it('rejects when name missing (invalid_input)', async () => {
    const { triggerFullReport } = await import('../actions');
    // @ts-expect-error — runtime invalid_input 검증
    const res = await triggerFullReport({ ticker: '005930', sector: '반도체', month: '2026-06' });
    expect(res).toEqual({ success: false, error: 'invalid_input' });
  });

  it('rejects when ticker format invalid (not 6 digits)', async () => {
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport({ ...validArgs, ticker: 'AAPL' });
    expect(res).toEqual({ success: false, error: 'invalid_ticker' });
  });

  it('rejects when month format invalid (YYYY-MM-01 → not allowed, YYYY-MM only)', async () => {
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport({ ...validArgs, month: '2026-06-01' });
    expect(res).toEqual({ success: false, error: 'invalid_month' });
  });

  it('returns success when commitFullReport succeeds', async () => {
    vi.doMock('@/lib/report/full-report-writer', () => ({
      commitFullReport: vi.fn().mockResolvedValue({ reportId: 'rpt-1' }),
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } } }) },
      }),
    }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({ success: true, data: { reportId: 'rpt-1' } });
  });

  it('returns error when auth unavailable', async () => { /* validArgs + supabase user null mock */ });
  it('returns error when commitFullReport throws full_report_validation_failed', async () => { /* validArgs + commitFullReport reject */ });
  it('returns error when commitFullReport throws full_report_cost_hardcap_exceeded', async () => { /* validArgs + commitFullReport reject */ });
});
```

**v3 변경 핵심 (B9)**: 모든 test가 4-field `{ticker, name, sector, month}` 호출. invalid_input test는 명시적으로 name 누락 시나리오. month format은 YYYY-MM-01 → invalid_month (page에서 .slice(0,7) 변환 책임).

- [ ] **Step 1.2.2: Run test — verify FAIL**

Run: `cd tudal && npx vitest run src/app/\(admin\)/admin/portfolio/__tests__/trigger-full-report-action.test.ts`
Expected: FAIL with "triggerFullReport not exported".

- [ ] **Step 1.2.3: Implement triggerFullReport in actions.ts (v2 정정 — B3 stub 정정)**

Edit `tudal/src/app/(admin)/admin/portfolio/actions.ts` (append below triggerMonthlyBatch):

```ts
// PR4 — triggerFullReport admin server action (Group D 잔여 + B8 박제 caller path)
// T5 first vertical slice = commitFullReport (fast) wire. Task 2에서 orchestrate path swap.
// v2 amend (omxy R1 B3): minimum stub은 prompt schema 통과 가능한 valid value 사용.
//   - tier1Verdict: 'HOLD' (prompt-allowed enum)
//   - consensusBadge: '🟡' (관망, 사용자 lock-in 5종 중 default)
//   - summaries: "근거 부족" (한국어 placeholder, validation 통과)
//   - name/sector: caller 책임 (page에서 ShortListItem에서 전달)
//   - month: 입력은 YYYY-MM (regex 강제). 호출자는 ShortListItem.month (YYYY-MM-01) → .slice(0,7) 변환

const TRIGGER_FULL_REPORT_TICKER_RE = /^\d{6}$/;
const TRIGGER_FULL_REPORT_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function triggerFullReport(input: {
  ticker: string;
  name: string;
  sector: string;
  month: string; // YYYY-MM (caller가 ShortListItem.month.slice(0,7) 변환 후 전달)
}): Promise<
  | { success: true; data: { reportId: string } }
  | { success: false; error: string }
> {
  if (
    !input ||
    typeof input.ticker !== 'string' ||
    typeof input.name !== 'string' ||
    typeof input.sector !== 'string' ||
    typeof input.month !== 'string'
  ) {
    return { success: false, error: 'invalid_input' };
  }
  if (!TRIGGER_FULL_REPORT_TICKER_RE.test(input.ticker)) {
    return { success: false, error: 'invalid_ticker' };
  }
  if (!TRIGGER_FULL_REPORT_MONTH_RE.test(input.month)) {
    return { success: false, error: 'invalid_month' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { success: false, error: 'auth_unavailable' };

  try {
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    // T5 slice: commitFullReport (fast). Task 2에서 orchestrateFullReport swap.
    const result = await commitFullReport({
      ticker: input.ticker,
      name: input.name,
      sector: input.sector,
      month: input.month,
      // v2 (B3 fix): prompt-valid stub. enriched input은 Task 2에서 short_list_30 + cost_log + technicals 합산.
      tier1Verdict: 'HOLD',
      consensusBadge: '🟡',
      financialsSummary: '근거 부족',
      technicalsSummary: '근거 부족',
      macroSummary: '근거 부족',
      sectorReference: '근거 부족',
      adminUserId: user.id,
    }, {
      client: supabase, // admin SSR session client
      callerKind: 'admin',
    });
    return { success: true, data: { reportId: result.reportId } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'commit_full_report_failed',
    };
  }
}
```

**v2 amend test fixture 정정 (B3)**: Step 1.1.1 / 1.2.1 의 `callFullReport` mock content는 `'{}'` 가 아니라 **Section 0~7 + Appendix schema-valid JSON fixture** 사용 (RPC 도달 검증). 헬퍼는 `tudal/src/test/fixtures/full-report-valid.ts` 신설 (Section 0~7 minimum valid + Appendix + Section 8 partA/partD legacy 한 종).

- [ ] **Step 1.2.4: Run test — verify PASS**

Expected: 6 tests PASS.

- [ ] **Step 1.2.5: Commit**

```bash
git add tudal/src/app/\(admin\)/admin/portfolio/actions.ts tudal/src/app/\(admin\)/admin/portfolio/__tests__/trigger-full-report-action.test.ts
git commit -m "feat(PR4 Task1 step2): triggerFullReport admin server action (commitFullReport wire)

- ticker/month regex validation
- auth.uid() 필수
- commitFullReport (client SSR + callerKind 'admin') 호출
- 6 unit tests. T5 slice scope."
```

### Step 1.3: Trigger 버튼 컴포넌트 + ShortlistRow/BucketSection wire (v4 B10/B14 정정 — portfolio-panel 변경 안 함)

- [ ] **Step 1.3.1: Create trigger-full-report-button.tsx**

```tsx
// tudal/src/app/(admin)/admin/portfolio/trigger-full-report-button.tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { triggerFullReport } from './actions';
import { formatErrorMessage } from '@/lib/admin/format-error';

export function TriggerFullReportButton({ ticker, month, name }: { ticker: string; month: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  function onClick() {
    setFeedback(null);
    startTransition(async () => {
      const res = await triggerFullReport({ ticker, month });
      if (res.success) {
        setFeedback({ kind: 'success', msg: `리포트 생성 완료 (${res.data.reportId.slice(0, 8)}…)` });
      } else {
        setFeedback({ kind: 'error', msg: formatErrorMessage(res.error) });
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" onClick={onClick} disabled={pending} aria-busy={pending} variant="default" size="sm">
        {pending ? '생성 중…' : `${name} 리포트 생성`}
      </Button>
      {feedback && (
        <span className={feedback.kind === 'success' ? 'text-xs text-emerald-600' : 'text-xs text-rose-600'} role="status">
          {feedback.msg}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 1.3.2: Create trigger-full-report-button.test.tsx**

```tsx
// tudal/src/app/(admin)/admin/portfolio/__tests__/trigger-full-report-button.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../actions', () => ({ triggerFullReport: vi.fn() }));

describe('TriggerFullReportButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows ticker name on button', async () => {
    const { TriggerFullReportButton } = await import('../trigger-full-report-button');
    render(<TriggerFullReportButton ticker="005930" month="2026-06" name="삼성전자" />);
    expect(screen.getByRole('button')).toHaveTextContent('삼성전자 리포트 생성');
  });

  it('disables button + shows loading on click', async () => { /* ... */ });
  it('shows success feedback on commit success', async () => { /* ... */ });
  it('shows korean error message on commit failure', async () => { /* ... */ });
});
```

- [ ] **Step 1.3.3: Run test — verify PASS** (Step 1.0 infra 의존)

Run: `cd tudal && npx vitest run src/app/\(admin\)/admin/portfolio/__tests__/trigger-full-report-button.test.tsx`
Expected: PASS 4 tests (jsdom + testing-library 이미 Step 1.0에서 설치 — B4 fix).

- [ ] **Step 1.3.4: Wire button — BucketSection action slot + ShortlistRow prop 패턴 (v3 정정 — B10 omxy R2)**

> **v3 amend (B10 fix omxy R2)**: 실제 `/admin/portfolio/page.tsx`는 `BucketSection` (line 9 import + 263 사용)을 통해 row 렌더 — `shortList.map` 직접 아님. `BucketSection` (`tudal/src/components/admin/shortlist/bucket-section.tsx:13-52`) → `ShortlistRow` (`tudal/src/components/admin/shortlist/shortlist-row.tsx:6-13`) 구조. `ShortlistRow` props = `{ item: ShortListItem }` only. **action slot 추가 + BucketSection이 row 옆에 주입 + page가 renderRowAction 전달**.

- [ ] **Step 1.3.4.1: Modify `tudal/src/components/admin/shortlist/shortlist-row.tsx`**

```tsx
import type { ReactNode } from "react";
// ... existing imports ...

interface ShortlistRowProps {
  item: ShortListItem;
  action?: ReactNode; // PR4 B10 fix
}

export function ShortlistRow({ item, action }: ShortlistRowProps) {
  // ... existing JSX ...
  return (
    <details className="group">
      <summary className="...">
        {/* ... existing row content ... */}
        {action && <div className="ml-auto flex items-center">{action}</div>}
      </summary>
      {/* ... rest unchanged ... */}
    </details>
  );
}
```

- [ ] **Step 1.3.4.2: Modify `tudal/src/components/admin/shortlist/bucket-section.tsx`**

```tsx
import type { ReactNode } from "react";

interface BucketSectionProps {
  bucket: BucketKind;
  label: string;
  cadence: string;
  weight: string;
  items: ShortListItem[];
  renderRowAction?: (item: ShortListItem) => ReactNode; // PR4 B10 fix
}

export function BucketSection({
  bucket, label, cadence, weight, items,
  renderRowAction,
}: BucketSectionProps) {
  return (
    <section aria-labelledby={`bucket-${bucket}-heading`}>
      {/* ... existing header ... */}
      {items.length === 0 ? (
        <p>...</p>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {items.map((item) => (
            <ShortlistRow
              key={item.id}
              item={item}
              action={renderRowAction?.(item)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 1.3.4.3: Modify `/admin/portfolio/page.tsx` — pass renderRowAction prop to BucketSection**

```tsx
import { TriggerFullReportButton } from './trigger-full-report-button';

// 기존 line 263 위치의 <BucketSection ... /> 호출 3곳 (short/mid/long bucket):
<BucketSection
  bucket="short"
  label="단기 (Short)"
  cadence="..."
  weight="..."
  items={shortItems}
  renderRowAction={(item) => (
    <TriggerFullReportButton
      ticker={item.ticker}
      name={item.name ?? item.ticker}
      sector={item.sector ?? ''}
      month={item.month.slice(0, 7) /* YYYY-MM-01 → YYYY-MM, B3 정합 */}
    />
  )}
/>
// mid / long 동일 패턴 (renderRowAction 함수 같음 → 변수 추출 권장)
```

**stale 제거 (B10)**: plan v2의 `portfolio-panel.tsx`에 `<TriggerFullReportButton/>` 통합 + commit 문구는 **삭제**. `portfolio-panel.tsx`는 변경 0 (또는 import path 하나만). commit message에서 panel 박제 제거.

**v3 변경 핵심 (B10)**:
- ShortlistRow: optional action prop (보수적 — 기존 caller는 영향 0)
- BucketSection: optional renderRowAction prop (callback)
- page.tsx: 3개 BucketSection 호출에 동일 renderRowAction 전달 (DRY를 위해 page 상단에서 변수로 추출)

- [ ] **Step 1.3.5: Run build + lint**

Run: `cd tudal && npm run build && npm run lint`
Expected: build 25 routes / lint 0 err.

- [ ] **Step 1.3.6: Commit**

```bash
git add tudal/src/app/\(admin\)/admin/portfolio/trigger-full-report-button.tsx \
  tudal/src/app/\(admin\)/admin/portfolio/__tests__/trigger-full-report-button.test.tsx \
  tudal/src/components/admin/shortlist/shortlist-row.tsx \
  tudal/src/components/admin/shortlist/bucket-section.tsx \
  tudal/src/app/\(admin\)/admin/portfolio/page.tsx
git commit -m "feat(PR4 Task1 step3): TriggerFullReportButton + ShortlistRow/BucketSection action slot (v4 B10)

- /admin/portfolio에 admin trigger 버튼 (commitFullReport wire) — 각 ShortlistRow 옆
- ShortlistRow.action optional ReactNode prop (기존 caller 영향 0)
- BucketSection.renderRowAction optional callback prop
- page.tsx: 3 BucketSection 호출에 동일 renderAction (month.slice(0,7) 변환 포함)
- portfolio-panel.tsx 변경 0 (v4 B10/B14)
- shadcn Button + aria-busy + role=status + 한국어 UI 문구
- Component test 4건 (jsdom env, Step 1.0 infra 의존)
- omxy R2 권고 T5 first vertical slice 완료."
```

### Step 1.4: Verification (T5 gate 준비)

- [ ] **Step 1.4.1: Run 3-gate verification**

Run: `cd tudal && npm run build && npm run lint && npm run test:ci`
Expected: build 25 routes / lint 0 err / test:ci 1010 + ~9 신규 = ~1019 PASS.

- [ ] **Step 1.4.2: Manual browser smoke (옵션 — gstack-browse skill 사용 X)**

`cd tudal && npm run dev` → `http://localhost:3000/admin/portfolio` 접근 → 새 trigger 버튼 보이는지 + 클릭 시 loading 표시 + success/error feedback.

- [ ] **Step 1.4.3: T5 사용자 검토 gate 보고**

사용자에게 보고:
- Task 1 (T5 first vertical slice) 완료
- 변경 stat (files, +/-, tests +N)
- 검증 게이트 결과
- 다음 = Task 2 (Regen orchestrate wire) 또는 사용자 검토 후 swap (admin path를 commit → orchestrate)

**T5 사용자 검토 통과 후 Task 2 진입.**

---

## Task 2: Regen 실 호출 wire (orchestrateFullReport) + admin path swap

**Files:**
- Modify: `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/actions.ts` (orchestrateFullReport 실 호출 wire)
- Modify: `tudal/src/app/(admin)/admin/portfolio/actions.ts` (triggerFullReport → orchestrateFullReport swap)
- Create: `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/__tests__/orchestrate-wire.test.ts`
- Create: `tudal/src/lib/report/__tests__/full-report-orchestrator-caller-di.test.ts`
- Modify: `tudal/src/lib/report/full-report-orchestrator.ts:127` (caller DI seam — same pattern as commitFullReport)

### Step 2.1: orchestrateFullReport caller DI seam

- [ ] **Step 2.1.1: Write the failing test** (full-report-orchestrator-caller-di.test.ts — same pattern as Task 1 Step 1.1.1)
- [ ] **Step 2.1.2: Run — verify FAIL**
- [ ] **Step 2.1.3: Modify orchestrateFullReport signature** (Task 1 Step 1.1.3 pattern 동일)
- [ ] **Step 2.1.4: Run — verify PASS**
- [ ] **Step 2.1.5: Commit**

### Step 2.2: triggerFullReport admin path swap (commit → orchestrate)

- [ ] **Step 2.2.1: Modify triggerFullReport** in `actions.ts`:

```ts
const { orchestrateFullReport } = await import('@/lib/report/full-report-orchestrator');
const result = await orchestrateFullReport({
  /* same input */
  client: supabase,
  callerKind: 'admin',
});
```

- [ ] **Step 2.2.2: Update trigger-full-report-action.test.ts** (mock target swap)
- [ ] **Step 2.2.3: Run tests — verify PASS**
- [ ] **Step 2.2.4: Commit**

### Step 2.3: Regen actions.ts orchestrate wire

- [ ] **Step 2.3.1: Read existing regenerate/actions.ts to understand current quota counter behavior**
- [ ] **Step 2.3.2: Write failing test** for orchestrate wire
- [ ] **Step 2.3.3: Implement orchestrate call** (quota check first → orchestrate → return reportId)
- [ ] **Step 2.3.4: Run tests — verify PASS**
- [ ] **Step 2.3.5: Commit**

---

## Task 3: Track Record 탭 분리 (누적 vs 월별 아카이브) — Group A + F 해소

**Files:**
- Create: `tudal/src/app/(admin)/admin/track-record/track-record-tabs.tsx`
- Create: `tudal/src/app/(admin)/admin/track-record/__tests__/track-record-tabs.test.tsx`
- Modify: `tudal/src/app/(admin)/admin/track-record/page.tsx` (Server Component data fetch 분리)
- Modify: `tudal/src/app/(admin)/admin/track-record/actions.ts` (`fetchTrackRecordCumulative` + `fetchTrackRecordArchive` 신규)

### Step 3.1: actions.ts — 누적 + 아카이브 fetch 분리

- [ ] **Step 3.1.1: Write failing test** for fetchTrackRecordCumulative + fetchTrackRecordArchive
- [ ] **Step 3.1.2: Implement** — `fetchTrackRecordCumulative` (전체 기간 누적 성과 — approved 리포트들의 portfolio_snapshots 합산) + `fetchTrackRecordArchive(month: string)` (월별 stock_reports + approval 결과)
- [ ] **Step 3.1.3: Run — verify PASS**
- [ ] **Step 3.1.4: Commit**

### Step 3.2: TrackRecordTabs component (shadcn Tabs 사용)

- [ ] **Step 3.2.1: Write component + test**

```tsx
// tudal/src/app/(admin)/admin/track-record/track-record-tabs.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // shadcn

export function TrackRecordTabs({ cumulative, archives }: { cumulative: ...; archives: ... }) {
  return (
    <Tabs defaultValue="cumulative">
      <TabsList>
        <TabsTrigger value="cumulative">누적 성과</TabsTrigger>
        <TabsTrigger value="archive">월별 아카이브</TabsTrigger>
      </TabsList>
      <TabsContent value="cumulative">{/* render cumulative */}</TabsContent>
      <TabsContent value="archive">{/* render archives */}</TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 3.2.2: Run component test — verify PASS**
- [ ] **Step 3.2.3: Integrate into page.tsx (Server Component)**
- [ ] **Step 3.2.4: Run build/lint — verify**
- [ ] **Step 3.2.5: Commit**

---

## Task 4: PR3a OOS RT#1 — Section8ModernView.partA 14 rows 렌더

**Files:**
- Modify: `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` line 640–750 (Section8ModernView)
- Modify: `tudal/src/lib/data/__tests__/report-section-schemas.test.ts` (partA render assertion)

### Step 4.1: Render partA 14 rows in Section8ModernView

- [ ] **Step 4.1.1: Read existing Section8ModernView (line 640–750)**
- [ ] **Step 4.1.2: Add partA rendering JSX** — 14 personas × vote/background/one_line 카드 그리드 or 테이블 (omxy R1 B35 정정: plan typo "conviction" → schema authoritative `background`. sectorVoteRowSchema.background SoT, conviction 필드 부재)
- [ ] **Step 4.1.3: Handle Tier 2 inactive fallback** (`partA.length === 0` 시 `SectionFallback` 또는 empty state 안내)
- [ ] **Step 4.1.4: Add 한국어 UI labels** (예: '섹터 14인 패널 의견')
- [ ] **Step 4.1.5: Run build/lint — verify**
- [ ] **Step 4.1.6: Commit**

---

## Task 5: PR3a OOS RT#3 — runtime layer 2 guard (v2 정정 — B1 omxy R1)

> **v2 amend (B1 fix omxy R1)**: A.0.2가 "DB constraint 없음"이라 박제했지만 `0003_s2_reports.sql:75 vote text not null check (vote in ('approve','reject','abstain'))` 이미 존재. **PR4 마이그 0건 유지**. Task 5는 runtime layer 2 guard만 (DB-TS 경계 + 직접 row read caller 보호).

**Files:**
- Modify: `tudal/src/lib/data/admin-committee.ts` line 23–75 (transformCommitteeVoteRow + aggregateVotes)
- Modify: `tudal/src/lib/data/__tests__/admin-committee.test.ts` — invalid vote skip + warn case

### Step 5.1: Layer 1 — transformCommitteeVoteRow row-level guard

- [ ] **Step 5.1.1: Write failing test** — invalid `row.vote` ('unknown')는 transformCommitteeVoteRow에서 throw OR null 반환 (선택). v2 권고 = **null 반환 + warn** (caller가 invalid row skip 가능). transformCommitteeVoteRows wrapper에서 null filter.
- [ ] **Step 5.1.2: Run — verify FAIL**
- [ ] **Step 5.1.3: Implement**:

```ts
const VALID_VOTES = new Set<CommitteeVote['vote']>(['approve', 'reject', 'abstain']);

export function transformCommitteeVoteRow(row: CommitteeVoteDbRow): CommitteeVote | null {
  if (!VALID_VOTES.has(row.vote as never)) {
    console.warn(
      `[transformCommitteeVoteRow] invalid_vote_skipped row_id=${row.id} vote=${String(row.vote)}`,
    );
    return null;
  }
  return { /* 기존 mapping */ };
}

export function transformCommitteeVoteRows(rows: CommitteeVoteDbRow[]): CommitteeVote[] {
  return rows.map(transformCommitteeVoteRow).filter((v): v is CommitteeVote => v !== null);
}
```

- [ ] **Step 5.1.4: Run — verify PASS**

### Step 5.2: Layer 2 — aggregateVotes defensive guard

- [ ] **Step 5.2.1: Write failing test** — invalid `v.vote` ('unknown') 입력 (직접 row read caller) 시 skip + warn + count 영향 없음
- [ ] **Step 5.2.2: Run — verify FAIL** (현재 → `target['unknown']` undefined access NaN)
- [ ] **Step 5.2.3: Implement**:

```ts
export function aggregateVotes(votes: CommitteeVote[]): { core: ...; sector: ... } {
  const core = init(); const sector = init();
  for (const v of votes) {
    if (!VALID_VOTES.has(v.vote)) {
      console.warn(
        `[aggregateVotes] invalid_vote_skipped vote=${String(v.vote)} personaLayer=${v.personaLayer}`,
      );
      continue;
    }
    const target = v.personaLayer === 'core' ? core : sector;
    target[v.vote] += 1;
  }
  return { core, sector };
}
```

- [ ] **Step 5.2.4: Run — verify PASS**

### Step 5.3: getVotesByReportId wrapper 적용 (v3 — B11 omxy R2)

> **v3 amend (B11 fix omxy R2)**: `admin-committee.ts:54-55 return rows.map(transformCommitteeVoteRow)` 직접 호출 — layer 1이 `CommitteeVote | null` 반환하면 즉시 회귀 (null이 array에 들어가 caller 폭증). `transformCommitteeVoteRows` wrapper 사용으로 변경 필수.

- [ ] **Step 5.3.1: Modify `tudal/src/lib/data/admin-committee.ts` line 54-55**

```ts
// OLD: return rows.map(transformCommitteeVoteRow);
// NEW (B11 fix):
return transformCommitteeVoteRows(rows);
```

- [ ] **Step 5.3.2: Existing direct tests 보강**

`tudal/src/lib/data/__tests__/admin-committee.test.ts` 기존 tests 중 `transformCommitteeVoteRow` 단일 row 호출하는 곳은 null 반환 가능성 명시 (`expect(result).not.toBeNull()` 또는 valid row만 사용). `getVotesByReportId` test는 wrapper 통과 (invalid row가 자동 skip되는지 negative test 1개 추가).

- [ ] **Step 5.3.3: Run regression — verify PASS**

```bash
cd tudal && npx vitest run src/lib/data/__tests__/admin-committee.test.ts src/lib/data/__tests__/report-section-schemas.test.ts
```

Expected: 회귀 0 + 신규 layer 1+2 guard tests + getVotesByReportId wrapper invariant.

- [ ] **Step 5.3.4: Commit (Task 5 전체 통합)**

```bash
git commit -m "feat(PR4 Task5): runtime layer 2 guard + getVotesByReportId wrapper (B1+B11 fix omxy R1+R2 — PR3a RT#3)

- transformCommitteeVoteRow: invalid vote → null + warn (DB-TS 경계)
- transformCommitteeVoteRows: null filter wrapper
- aggregateVotes: invalid vote skip + warn (직접 row read caller 보호)
- getVotesByReportId: rows.map(transformCommitteeVoteRow) → transformCommitteeVoteRows(rows) wrapper 사용 (B11 회귀 차단)
- 마이그 0건 유지 (0003:75 CHECK constraint 이미 존재)
- ~5 guard tests + getVotesByReportId wrapper invariant test"
```

---

## Task 6: PR3a OOS RT#4/RT#5 — LLM string/array max bound top 5

**Files:**
- Modify: `tudal/src/lib/data/report-section-schemas.ts` (Section 0/2~7/Section 8 legacy max bound)
- Modify: `tudal/src/lib/report/section-8-schema.ts` (Section 8 modern max bound)
- Modify: `tudal/src/lib/data/__tests__/report-section-schemas.test.ts` (boundary tests)

### Step 6.1: Add top 5 max bound

- [ ] **Step 6.1.1: Write 5 failing boundary tests** (max+1 길이 reject)
- [ ] **Step 6.1.2: Run — verify FAIL**
- [ ] **Step 6.1.3: Add `.max(N)` chains**:
  - `reportSection0Schema.headline.max(200)`
  - 모든 `summary.max(1000)` (sections 2~7)
  - `keyQuotes[].quote.max(500)`
  - `coreVoteRowSchema.one_line.max(300)` (section-8-schema.ts)
  - `thesis: z.array(...).max(10)`
- [ ] **Step 6.1.4: Run — verify PASS** (5 new + 회귀 0)
- [ ] **Step 6.1.5: Commit**

---

## Task 7: B18 CRON_SECRET 401 test

**Files:**
- Modify: `tudal/src/app/api/cron/monthly-batch/__tests__/route.test.ts` (또는 신규 cron-secret-401.test.ts) — 401 negative test 보강

### Step 7.1: CRON_SECRET 401 e2e tests

- [ ] **Step 7.1.1: Read existing route.test.ts** (silent-health/morning-briefing/news-sweep 패턴 참조 — `headers: { authorization: "Basic cron-secret" }` invalid schema test 이미 있음)
- [ ] **Step 7.1.2: Verify monthly-batch route.test.ts has 401 negative cases**:
  - (a) no Authorization header → 401
  - (b) wrong scheme (Basic instead of Bearer) → 401
  - (c) wrong secret value → 401
  - (d) CRON_SECRET env undefined in production → 401 (MF4 fail-closed)
- [ ] **Step 7.1.3: Add missing 401 tests if absent**
- [ ] **Step 7.1.4: Run — verify PASS**
- [ ] **Step 7.1.5: Commit**

---

## Task 8: Track 2/3 defer 20 — scope 축소 (v2 정정 — B5 omxy R1)

> **v2 amend (B5 fix omxy R1)**: W2 timeout/W4 strict bool/W5 ESM은 UI caller wire와 무관한 behavior/infra change. **W2/W4/W5 → PR body defer로 격하** (별도 infra PR). **W7만 Task 2 substep으로 통합** (admin orchestrate path direct 관련).

Track 2 defer (PR3c body 박제) 12 + Track 3 defer 8 = 20 items 중:
- **본 PR4 (Task 8) scope = 1**: PR3c W7 (enriched.* vs input.* 일관성) — Task 2의 admin path orchestrate wire substep으로 합산
- **PR body defer = 19**: 나머지 모두 follow-up ticket (별도 i18n / infra / behavior PR)

### Step 8.1: W7 verification (Task 2 후속 검증)

- [ ] **Step 8.1.1: orchestrator.ts에서 enriched.* vs input.* 일관성 grep**

```bash
cd tudal && grep -nE "input\.|enriched\." src/lib/report/full-report-orchestrator.ts | grep -v "// "
```

- [ ] **Step 8.1.2: enriched/input drift 발견 시 정정 commit**
- [ ] **Step 8.1.3: PR body draft에 19 defer follow-up ticket list 박제** (rolling — Task 9 step 9.2.3에서 최종 박제)

### Defer 19 follow-up tickets (PR body 박제 예정)

**PR3b defer (5)**: W2 Anthropic timeout/maxRetries (infra PR) · W4 AI_COST_LOG_REAL_INSERT_ENABLED strict (infra) · W5 __dirname ESM (low risk) · Track 3 Angle 5 insertCostLog DI (PR4에서 부분 해소 — B2 caller DI seam) · Track 3 Angle 1 P0002 errcode + specific error rethrow (UX polish PR)

**PR3c Track 2 defer (12)**: W1 RPC error 텍스트 (i18n PR) · W3 zod 주석 정합 · W4 RPC return shape guard · W5 cast · W6 contract test SQL↔TS drift · W8 report_id uuid guard · I1~I10 (cross-module import / row type 외)

**PR3c Track 3 defer (8)**: C-2 INFO data.report_id guard · C-3 INFO import position · P-1 enrichInput coupling · P-2 orchestrate_failed 디테일 · P-3 vi.mock TDZ pattern · P-4 kevinV31Markers (이미 PR3c에서 fix됨)

---

## Task 9: format-error 신규 키 + 최종 검증 게이트

**Files:**
- Modify: `tudal/src/lib/admin/format-error.ts`
- Modify: `tudal/src/lib/admin/__tests__/format-error.test.ts`

### Step 9.1: PR4 신규 에러 키

- [ ] **Step 9.1.1: 인벤토리** — Task 1~8에서 발생할 수 있는 에러 코드:
  - `invalid_ticker`, `commit_full_report_failed`, `orchestrate_full_report_failed`
  - `regen_quota_exceeded`, `regen_already_in_progress`
  - `track_record_fetch_failed`
  - Section 8 partA `partA_render_failed_no_data`
  - prefix: `full_report_*`, `orchestrate_*`, `regen_*`
- [ ] **Step 9.1.2: Add Korean mappings + prefix handlers**
- [ ] **Step 9.1.3: Run format-error tests — verify PASS**
- [ ] **Step 9.1.4: Commit**

### Step 9.2: 최종 3-gate 검증

- [ ] **Step 9.2.1: Run full verification**

```bash
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

Expected:
- build 25 routes (no new routes — admin trigger은 기존 portfolio page 내부)
- lint 0 err, 6 warn (baseline)
- test:ci 1010 → ~1075~1090 PASS (Task 1~8 +~70 tests, 회귀 0)
- tsc clean

- [ ] **Step 9.2.2: Run grep gates** (PR3c +1 추가 = 23 gates)

```bash
# PR3c default 22 gates 유지 + PR4 추가:
grep -rn "client as never" tudal/src --include='*.ts' | wc -l  # 0이어야 함 (caller DI 어서션 회피)
grep -rn "throw new Error.*tier0_source_not_wired_pr1_followup\|throw new Error.*persona_panel_not_wired_pr1_followup\|throw new Error.*commit_badge_only_not_wired_pr1_followup" tudal/src --include='*.ts' | grep -v __tests__ | wc -l  # >= 3 (Tier 1/0 wire는 별도 PR scope, 의도된 throw 유지)
```

- [ ] **Step 9.2.3: T10 사용자 검토 gate 보고**

사용자에게 보고:
- 전체 변경 stat (files, +/-, test +N)
- 검증 게이트 결과
- omxy 누적 BLOCKERS (T4 + T7 + T9 합산)
- 3-track deep review 결과 (T8)
- PR body draft (rollback ranges, defer follow-up)
- push + PR create 승인 요청

---

## Self-Review (writing-plans skill checklist + v2 omxy R1 BLOCKERS 검증)

### 1. Spec coverage
- ✅ Group A (track-record trigger 위치): Task 3 + Task 1 (admin trigger 버튼이 /admin/portfolio에 신설)
- ✅ Group F (Track Record 누적 vs 아카이브 탭 분리): Task 3
- ✅ Group D 잔여 (UI caller wire): Task 1 (commitFullReport DI seam 전체) + Task 2 (orchestrateFullReport DI + Regen wire + admin path swap)
- ✅ PR3a OOS RT#1 partA 14 rows: Task 4
- ✅ PR3a OOS RT#3 aggregateVotes guard: Task 5 (v2 layer 2 runtime guard, 마이그 0건 — B1)
- ✅ PR3a OOS RT#4/5 LLM max bound: Task 6
- ✅ B18 CRON_SECRET 401 test: Task 7
- ✅ Track 2/3 defer scope 축소: Task 8 (v2 — W7만 본 PR, W2/W4/W5/19개 PR body defer — B5)
- ✅ format-error 신규 키: Task 9

### 2. v2 + v3 BLOCKERS 적용 검증 (omxy R1+R2, 누적 11)

**R1 6 BLOCKERS (v2 amend)**:
- ✅ B1: A.0.2 정정 (`0003:75` CHECK constraint 박제) + Task 5 runtime layer 2 guard + 마이그 0건 유지
- ✅ B2: cost-logger / full-report-client / critic-client / revise-client / report-critic-findings / sector-reference-backlog 모두 `options: { client? }` 패턴 (Step 1.1.4~1.1.10 + File Structure 16 modified 명시)
- ✅ B3: T5 stub 정정 — ShortListItem 1개를 page에서 prop 전달 + `monthYM = month.slice(0,7)` + valid `'HOLD'`/`'🟡'`/'근거 부족' + schema-valid fixture
- ✅ B4: Step 1.0 신설 (jsdom + testing-library 설치 + vitest config + sanity test)
- ✅ B5: Task 8 scope 축소 (W7 only Task 2 substep, W2/W4/W5/19 defer PR body)
- ✅ B6: B2 fix로 자동 해결 (sector_reference_backlog helper에 options.client 적용)

**R2 5 BLOCKERS (v3 amend)**:
- ✅ B7: Step 1.0.1 deps 버전 정정 (`jsdom@^26` + `react@^16` + `jest-dom@^6` — npm latest 정합) + Step 1.0.3 `test.projects` 분리 (Vitest 4 `environmentMatchGlobs` removed 대응)
- ✅ B8: Step 1.0.7 fixture helper 신설 (`tudal/src/test/fixtures/full-report-valid.ts` + `validFullReportJson()`) + Step 1.1.1 code block에서 import 명시
- ✅ B9: Step 1.2.1 tests 모두 4-field 호출 + invalid_input/invalid_ticker/invalid_month case 명시
- ✅ B10: Step 1.3.4 BucketSection/ShortlistRow action slot 패턴 (ShortlistRow optional action prop + BucketSection renderRowAction callback + page.tsx 3 bucket에 동일 callback 전달) + portfolio-panel.tsx stale 박제 제거
- ✅ B11: Step 5.3 getVotesByReportId wrapper 적용 (`return transformCommitteeVoteRows(rows)`) + 기존 direct tests non-null assert 보강

**R3 3 BLOCKERS (v4 amend)**:
- ✅ B12: Step 1.0.7.1 fixture 전면 재작성 — Section 0 `conviction: 50` (number) + `committeeMini` + `priceBands` + Section 2 `revenue/margins/balance` + Section 3 `multiples` + Section 6 `axis/divergencePct` 모두 schema 정합. Step 1.0.7.2 sanity test 9건 (`reportSection*Schema.parse(...).not.toThrow()`) 추가
- ✅ B13: amend log R1 B2 / File Structure 16 modified / Step 1.1.6 / Step 1.1.10 commit git add path 모두 `lib/data/`로 정정. 함수명 `insertOrBumpBacklog` (not insertSectorBacklog) 정정
- ✅ B14: Step 1.0.3 "environment matcher" → "test.projects 분리" 표현 정정 + Step 1.0.6 commit message `environmentMatchGlobs` → `test.projects` + File Structure `portfolio-panel.tsx` row strikethrough + 변경 안 함 명시 + Step 1.3 헤더에서 "portfolio-panel 통합" → "ShortlistRow/BucketSection wire (portfolio-panel 변경 안 함)" 정정

**R4 3 BLOCKERS (v5 amend)**:
- ✅ B15: Step 1.0.7.3 commit `git add`에 `tudal/src/test/fixtures/__tests__/full-report-valid.test.ts` path 추가 + Acceptance §검증에 "validFullReportSections 9 schema parse tests PASS" 명시 + 중복 stale Step 1.0.7.2 삭제
- ✅ B16: Self-Review §3 검증 조건 정의 명시 — **"stale instruction 0" (negative mention / "(not X)" 박제 / amend log 본문 traceability 허용)**. grep 0 match는 의도 아님 (역사 traceability 위해 박제 유지)
- ✅ B17: Acceptance Defer 카운트 "16" → "**19**" + Task 8 list와 1:1 동기 (PR3b 5 + PR3c Track 2 잔여 5+I10 + PR3c Track 3 잔여 5 — P-4 fix됨 제외)

**R5 3 BLOCKERS (v6 amend)**:
- ✅ B18-o: line 408-419 stale duplicate commit block 삭제 (B15 잔여 cleanup)
- ✅ B19: Acceptance §Defer 산술 D01~D19 ID 명시 시도 (v7에서 B21로 전면 제거)
- ✅ B20: Goal line (line 5) "Track 2/3 defer 20 follow-up 해소" → "Track 2/3 defer 20 triage" 변경 시도 (v7에서 B21로 단순화)

**R6 1 BLOCKER (v7 amend — final)**:
- ✅ B21: defer 산술 모순 (D01~D19/D01~D24/D01~D23 불일치 + bucket vs items mismatch + Track 3 D18/D19 미식별) → **omxy 강한 권고 채택**: defer 상세 ID list 전부 삭제 + 원칙만 박제 (W7 only / no code changes beyond W7 / PR body에 PR3b·PR3c review docs 링크 / 숫자/D-ID 검증 plan acceptance 대상 제외). count drift = T6 implementer가 source docs 직접 참조 후 PR body 박제 (책임 명확화). Goal line 숫자 제거

### 3. Placeholder scan (v2)
- Step 1.1.4~1.1.8: 코드 box를 reference로 축소 (T6 impl 시 자세히 작성). "동일 패턴" 표현은 reference 명시 (`admin-shortlist-persist.ts:39-43`) — 모호 placeholder 아님.
- "/* ... */" 표기는 brevity 위함 — Task 1 Step 1.1.1 pattern 재사용. 모든 acceptance criteria + file:line + 명령 명시.
- "Add appropriate error handling" 등 모호 표현 ❌ 없음.

### 4. Type consistency (v2)
- `commitFullReport` (Task 1) + `orchestrateFullReport` (Task 2): `(input, options?: { client?: SupabaseClient; callerKind?: 'cron' | 'admin' })` 두 위치 인자 패턴 (admin-shortlist-persist.ts:42 정합)
- `preflightHardcap` + `insertCostLog` + `callFullReport` + `callCritic` + `callRevise` + critic/backlog helpers: 모두 `(input, options?: { client? } = {})` 동일 패턴
- `triggerFullReport` (Task 1) + `triggerMonthlyBatch` (PR1 기존): `{success: true, data} | {success: false, error}` 반환 규약
- `TrackRecordTabs.props` (Task 3) + `actions.ts fetch*` 반환: 일관 interface
- `transformCommitteeVoteRow` (Task 5 v2): `CommitteeVote | null` 반환 (invalid skip)
- `aggregateVotes` (Task 5 v2) + `partCToCommitteeAgg` (PR3a 기존): both `CommitteeVoteAggregate` 반환

### 5. omxy R2 결정 정합 (v2 unchanged)
- ✅ Claude 단독 implementer (모든 Task)
- ✅ omxy = T4 plan review (R1 → R2 → ...) + T7 plan-vs-commit + T9 final
- ✅ 단일 PR
- ✅ T5 first vertical slice = Task 1 (`commitFullReport` wire, admin trigger 버튼 1개)
- ✅ T8 3-track 축소판 = gstack-review skill inline + 5-angle scan subagent 1회 + omxy final (depth=deep general-purpose 폐기)
- ✅ T2/T5/T10 3-gate
- ✅ subagent: read-only OOS 검증 1회만 (완료, Section A.0)
- ✅ skill inline read-through: writing-plans (본 plan) → TDD (T6) → verification (T6/T9) → requesting-code-review (T8)

---

## Acceptance Criteria (PR body draft 박제)

### 코드
- [ ] caller DI seam (commitFullReport + orchestrateFullReport) — fast/quality 두 path 명확 분리
- [ ] admin trigger 버튼 /admin/portfolio 동작 (한국어 UI + aria + role=status)
- [ ] Regen 실 호출 (orchestrateFullReport) wire (quota counter 유지)
- [ ] Track Record 탭 (누적 + 월별 아카이브) 동작
- [ ] Section 8 modern partA 14 rows 렌더 + empty state fallback
- [ ] aggregateVotes invalid vote skip + warn
- [ ] LLM max bound top 5 + 5 boundary tests

### 보안
- [ ] B18: CRON_SECRET 401 test 4종 (no header / wrong scheme / wrong value / production env)
- [ ] service-role client 노출 0 (all calls server-side)

### 검증
- [ ] build 25 routes / lint 0 err / test:ci +70~80 (회귀 0) / tsc clean
- [ ] grep gates 23종 통과
- [ ] **validFullReportSections 9 schema parse tests PASS** (v5 B15 fix — Section 0~7 + Appendix sanity invariant)
- [ ] Step 1.0.6 commit에 sanity test path 포함 (v5 B15 — Step 1.0.7.3 commit body git add 정합)

### Defer follow-up 원칙 (v7 B21 fix omxy R6 — 산술 ID 제거, 원칙만 박제)

> **B21 fix 핵심**: 이전 v5/v6 amend가 D01~D19 / D01~D24 / D01~D23 등 산술을 시도했으나 PR3b defer 5 + PR3c Track 2 defer + Track 3 defer의 bucket 표현 (I1~I10 1 ticket vs 10 items) 정합 실패. omxy R6 강한 권고 채택: **plan에서 defer 상세 ID 산술 전부 제거 + 원칙만 박제**.

**Acceptance §Defer 원칙** (PR body 박제 시 implementer 책임):

1. **본 PR4에서 적용**: W7 (enriched.* vs input.* 일관성) only — Task 2 admin orchestrate wire substep
2. **No code changes beyond W7**: PR4 코드 변경 0 (defer triage 외)
3. **PR body 박제 형식**:
   - PR3b defer = source review doc 링크: `docs/superpowers/reviews/2026-05-23-pr3b-writer-section-0-7-review.md` (또는 PR body 박제)
   - PR3c defer = source review doc 링크: `docs/superpowers/reviews/2026-05-24-pr3c-orchestration-sector-reference-review.md` (또는 PR3c PR #15 body)
   - PR4 PR body에서 1줄 요약 + 링크 — 상세 ID list는 source docs 참조
4. **숫자/D-ID 검증 plan acceptance 대상 제외** (T6 implementer가 source docs에서 직접 추출 후 PR body 박제)

**Why**: defer 산술 박제는 plan 추가 가치 0 (source docs에 이미 있음). PR3b/PR3c body 링크로 충분. plan은 "본 PR scope = W7 only, defer는 원문 참조"만 명시.

---

## Rollback Ranges (PR4 merge 후 박제)

- OLD_MAIN=`e94b365` (PR3c post-final sync)
- AFTER_PR4=(merge 후 runtime)
- Revert PR4 only: `git revert --no-edit OLD_MAIN..AFTER_PR4` (커밋 수 runtime)
- Migration rollback: PR4는 마이그 0개 (스키마 변경 없음, RT#3 defensive guard는 코드 레벨)

---

## 진행 순서 (요약)

1. **T3 완료** = 본 plan v1 commit
2. **T4** = omxy 적대적 검토 R1~Rn → CONVERGED + BLOCKERS catch & fix
3. **T5** = 사용자 plan lock-in
4. **T6 = Task 1** (T5 first vertical slice) → T5 gate 통과 → Task 2~9 순차
5. **T7** = omxy plan-vs-commit verify (각 Task 후 또는 통합)
6. **T8** = 3-track deep review 축소판 (gstack-review inline + 5-angle scan subagent + omxy final)
7. **T9** = Fix-First adoption + omxy final R verify
8. **T10** = 사용자 T10 gate → push + PR create
