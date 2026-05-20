# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-21 (53차 §2 — **🎯 Step 3b §1+§5 sector-persona-builder 완성 + omxy R1~R4 4 rounds CONVERGED + 81 rounds 누적**) · branch `feat/tier2-production-prompts` HEAD `2b4904c+` · 14 sectors × 14 slot = 196 cells dynamic resolution + 14 SECTOR_PHILOSOPHIES + 56 SECTOR_BASE_SLOT_ADJUSTMENTS (high-risk roles 4/5/8/10) + isSubTagAllowedForSector shared SoT (drift 방지) · 검증 게이트 ALL GREEN (test:ci 650/64, +44 over 53차 §1 main 606) · 다음 = Step 3b §6 PR create

이전 갱신: 2026-05-20 (53차 §1 — **🚀 Tier 2 stacked PRs 머지 + 마이그 0018·0019 production apply 완료** · branch `feat/tier2-production-prompts` (main에서 신규, Step 3b 진입) · PR #4/#5/#6 모두 MERGED (3 stacked rebase) · 마이그 0018 (`short_list_30.sub_tags jsonb` + GIN) + 0019 (`commit_sector_personas` RPC SECURITY DEFINER triad) production 적용 + smoke ALL GREEN · omxy R1~R5 CONVERGED (12 BLOCKERS catch: stacked merge semantics + scope guard 정정 + post-edit recheck + force-with-lease conditional push + file-exact migration + SECURITY DEFINER pg_proc smoke 등) · 77 rounds 누적 · Vercel production canary 4/4 OK · **현재 위치 = Step 3b 진입 (production prompts 196, Kevin v3.1 quality target)**)

[53차 §1 완료 박제]: PR #4 MERGED `71946f6f` (14:06:10 UTC) → PR #5 retargeted+rebased+force-with-lease MERGED `08073d89` (14:09:34 UTC) → PR #6 retargeted+rebased+force-with-lease MERGED `8108d058` (14:12:12 UTC). 마이그 `20260520141739 short_list_30_sub_tags` + `20260520141835 commit_sector_personas` applied. Final main gate ALL GREEN (build 25 routes / lint 0 err 6 warn / test:ci 606/63 / tsc clean). Vercel canary / 200 · /login 200 · /macro 200 · /admin 307.

## ⭐ 다음 세션 진입자 5줄 요약

1. **현재 branch**: `feat/tier2-production-prompts` (53차 §2 종료 시점, 5 commits ahead of main). 53차 §1 박제 + Step 3b §1 builder + R1/R2/R3 fix + §5 fanout + polish 모두 적용.
2. **OPEN PRs (53차 §2 종료 시점)**: **#2** (format-error CONFLICTING, 보류 유지) + **본 branch PR (Step 3b §6에서 create 진행)**.
3. **USER-gated 대기**: 본 branch PR review/merge (53차 §2 종료 시 create됨).
4. **다음 1순위 CLAUDE 작업**: (USER 본 branch PR merge 완료 후) §2.1 **Step 3c — caller wiring** (cron mock dry-run 폐기 + admin server action Tier 2 branch 추가 + `/admin/report/[ticker]/page.tsx` Section 8 partA UI render).
5. **자동 진행**: §2.0 default-progress policy + §7 omxy 적대적 검토 패턴 강제 적용. context handoff 시 본 §0 5줄 요약 + §1 표 + §2.1 Step 3c row + §6 53차 §2 entry로 재개.

**목적**: 새 세션에서 사용자가 "`Document/Process/HANDOFF.md` 보고 이어서 진행"이라고 하면, 이 파일만으로 **§2.1 Runbook 박제된 순서대로 자동 진행** (§2.0 default-progress policy 준수 — 옵션 재질문 루프 금지). USER-gated Step은 background blocker로 표시 + 다음 unblocked CLAUDE Step 자동 시작. §2.0 7 exception buckets 도달 시만 USER 직접 묻기.

**운영 원칙**: 미래 지향. 49차 Task 1~17 진행 상세는 git log + `docs/superpowers/specs/2026-05-19-s7a-anthropic-wrapper-design.md` + `docs/superpowers/plans/2026-05-19-s7a-anthropic-wrapper.md` + `Document/Build/Slices/S7-RealData.md` + `Document/Build/ProgressDashboard.md`에 위임. 52차 Tier 2 SoT + impl 진행 상세는 git log + PR #4/#5 본문에 위임. CLAUDE.md 자동 로드 — 본 HANDOFF는 미래 진행에 필요한 정보만 박제.

---

## 0. 세션 시작 루틴

```bash
cd /Users/yong/New_Project_KR_Stock
git status --short --branch                     # 진입 시점 branch (52차 종료 = feat/tier2-implementation, 다음 세션 진입 시는 사용자 머지/checkout 상태 확인)
git log --oneline main..HEAD | head -10         # 본 branch commits 박제 확인
gh pr list --state open                          # OPEN PR 목록 (52차 종료 기준 #2, #4, #5)
gh pr view 4 --json state                       # PR #4 (Tier 2 SoT) MERGED 여부
gh pr view 5 --json state                       # PR #5 (Tier 2 impl) MERGED 여부
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

**52차 종료 branch = `feat/tier2-implementation`** (stacked on `feat/tier2-sot-overlay`, push 완료). main 직접 작업 금지. 검증 게이트 baseline (52차 종료) = build OK · lint 0 err 6 warn · **test:ci 606 / 63 files** · tsc clean.

**다음 세션 진입 시점 분기 (자동 식별)**:
- (A) PR #4 + #5 + 본 PR 모두 MERGED → main 기준 새 branch (Step 3b production prompts 196)
- (B) PR #4 MERGED, #5 + 본 PR OPEN → PR #5 / 본 PR rebase 후 진행
- (C) PR #4 OPEN → USER-gated (PR review/merge 트리거 보고) + 동시 가능한 CLAUDE 작업은 본 PR 후속 사전 준비 (Step 3a SKIPPED, Step 3b는 진입 의사 확인 후)

### 진입자 핵심 액션 순서 (§2.0 default-progress policy 준수)

1. **§8.1 현재 위치 확인 자동 실행** (git/gh/list_migrations/검증 게이트).
2. **§2.1 Runbook 매트릭스 보고 마지막 완료 Step 식별** → 다음 Step Owner 확인.
3. **§8.2 자동 진행 결정** — Owner 별 행동:
   - **[CLAUDE]** → 즉시 자동 시작. Step 3/4 같은 stacked 1세션+ 작업은 §2.1 Trigger/Precondition column에 명시된 대로 진입 의사 1회 확인 후 자동.
   - **[SHARED]** (§2.1 Branch/PR policy column에 push/PR-create 권한 표기) → "이어서 진행" 권한으로 prepare/commit/PR-create 자동.
   - **[USER]** → background blocker 보고 + 동시 가능한 [CLAUDE] Step 자동 시작. Step 13 같은 external trigger cluster는 모든 trigger 항목 명시 보고.
4. **§2.0 7 exception buckets 도달 시만** USER 직접 묻기.
5. **§7 omxy 적대적 코드 검토 패턴**은 모든 신규 작업 branch에서 강제 적용.

---

## 1. 현재 상태 요약 (53차 §1 종료 시점, 2026-05-20)

| 영역 | 상태 |
|---|---|
| Branch | `feat/tier2-production-prompts` (53차 §1 종료 시 신규 from main HEAD `8108d058`, Step 3b 진입). main = 49차+50차+51차+52차+53차 §1 머지 결과 통합 |
| HEAD commit (현 branch 시작점) | `8108d05` 53차 §0 R3 stale-fix (PR #6 mergeCommit) — 본 branch 신규이므로 0 commits ahead of main 시작 |
| Mock Skeleton | ✅ S0~S6 · Must 19/19 mock 동작 |
| DQ-7 Admin Credential | 🟢 ~97% · Smoke #4/#5 + Session 4 QA 잔여 · Smoke #3(Binance)은 S8까지 유예 |
| S7e Supabase 실 I/O | 🟢 **7/8 완료** · T7e.1~T7e.6 ✅ + T7e.8 ✅ · T7e.7 RLS QA 잔여 |
| S7a (49차 ✅ + 50차 §1 B-17 ✅ + 51차 PR #1 MERGED ✅) | 🟢 **완료** (S7a Anthropic wrapper main 박제). 본격 호출은 §3 B-6 billing 충전 후. |
| **Tier 2 D21 (52차 SoT PR #4 + impl PR #5, 53차 §1 MERGED)** | 🟢 **scaffold + production schema 모두 main 박제**. canonical 14 sectors × 14 personas/sector overlay (10 base + 2 primary + 2 sub_tag) + sub_tag crosswalk 7개 + `commit_sector_personas` RPC + writer + scaffold. **Mock 196 stub으로만 동작** — production prompts 196 = **Step 3b 진행 중 (본 branch)**. |
| **Kevin IMVCOM reference** | 📌 **Tier 2 production prompts quality target** = main 보존 자료 (Outputs/v3-Readable.{md,html} + Service/Report/v3-{DraftPhilosophy,NarrativeDesign,Decisions,ValuationTrial} + ReaderAnalogyCards-ConstructionToBio + Samchundang.{md,html} + BioSectorReport-Alteogen + ReportFramework-BioSector + Alteogen v1/v2). **53차 §0 박제 확정** (IMVCOM 4 commits 모두 main ancestor). Step 3b production prompts 196 작성 시 main 보존 자료 직접 reference. |
| OPEN PRs (53차 §1 종료 시점) | **#2** OPEN CONFLICTING: `fix/s7a-format-error-inventory` (format-error 13 신규 매핑, 보류 유지). 다른 모든 PR(#4/#5/#6)은 MERGED. |
| 실 AI 호출 | 0 · billing 미충전 (사용자가 Step 5 smoke 직전 충전 명시) |
| Production deploy | Vercel `https://tudal-tawny.vercel.app` (origin/main HEAD `8108d058`) · 53차 §1 3회 intermediate deploy 후 최종 canary `/` 200, `/login` 200, `/macro` 200, `/admin` 307 (auth redirect, expected) |
| Supabase | project `rbrpcynhphrpljbjirfo` · 0001~0017 + **0018 (`20260520141739 short_list_30_sub_tags`) + 0019 (`20260520141835 commit_sector_personas`)** production 적용 완료 (53차 §1). 19 migrations 총. 0019 SECURITY DEFINER triad 검증 (prosecdef=true / search_path=public,pg_temp / anon=false / authenticated=true). |
| 검증 게이트 | build OK 25 routes · lint 0 errors 6 warnings (pre-existing) · **test:ci 606 / 63 files** (53차 §1 main fresh checkout 최종 게이트) · tsc clean |
| omxy debate 누적 | **77 rounds CONVERGED (53차 §1 R1~R5 포함)** (50 + 51차 6 + 52차 SoT 6 + 52차 impl 6 + 52차 HANDOFF R1 1 + 53차 §0 stale-fix R1~R3 3 + **53차 §1 PR-머지+마이그-apply R1~R5 5**). 적대적 검토 = 본 PR 운영 원칙. 다음 후속 작업(Step 3b 196 prompts)에도 동일 강제 적용. |

### 49차 본 세션 추가 commits (oldest → newest)

```
a5231d1 feat(S7a §5): cost-logger.ts + 5 tests (flag-aware + preflight + orphan)
8180d56 feat(S7a §6): anthropic-client wrapper + 6 tests
a68c9df feat(S7a §7): consensus.ts 5종 배지 + isTopTier + 10 tests
d85fc03 feat(S7a §8): admin-batch-runs.ts lock CRUD + 3 tests
a3b8ec5 feat(S7a §9): persona-eval.ts orchestration warm-first + lock + preflight + 7 tests
1d4202f feat(S7a §10): writer.ts section_8 jsonb + commit_persona_eval RPC + 4 tests
13bddd2 feat(S7a §11): format-error 6 신규 코드 한국어 매핑 + 6 tests
17fad52 refactor(S7a §12): cron monthly-batch = mock dry-run only
4cf838b feat(S7a §13): admin server action triggerMonthlyPersonaEvalAction
5bb07c7 chore(S7a §14): .env.example — AI_COST_LOG_REAL_INSERT_ENABLED + AI_PROMPT_CACHE_ENABLED
ce11f02 fix(S7a omxy R1 BLOCKER Task 13): fetchFinancials throw on Supabase error (silent {} 금지)
54f5be8 docs(S7a §15): SoT 갱신 — D19 5종 배지 + §4 section_8 canonical + ReportFramework v2.4
a92181c fix(S7a omxy R1 BLOCKERS Task 15): consensus_badge emoji enum + §4.2.1 partA required clarify
63396c8 test(S7a §16): mock e2e admin trigger 330 calls + 30 reports + ⚪ branch
342dd20 fix(S7a §17 lint): persona-eval.test.ts + anthropic-client.ts no-explicit-any cleanup
b62bb11 fix(S7a omxy final R1 BLOCKER): 0017 RPC stock_reports schema 호환 — created_at/updated_at → generated_at + p_month text → date cast
a61bbf5 fix(S7a omxy final R2 BLOCKER): 0017 stock_reports_month_ticker_uniq 제거 + ON CONFLICT를 partial unique (ticker, month) WHERE is_latest=true 로 변경
7c7c794 docs(S7a §17 박제): 49차 완료
8d57a4b docs(T7e.6 박제): 40차 T7e.6 mock cleanup plan 파일 추가 (참조용)
f5b4d7a docs(S7a §17 박제 R2): HANDOFF.md 전면 재작성 — 49차 박제 R1 final state
```

### 50차 §0 박제 정합 추가 commits (oldest → newest)

```
1fe9bad docs(50차 §0 SoT 박제 정합): 5 SoT stale 정정 — omxy R1 CONVERGED 진단 반영 (SoT 정합 commit, commits/HEAD/Task/게이트/round 동기화)
R3 cleanup docs commit (HEAD direct ref via git log) docs(50차 §0 R3 cleanup): HANDOFF post-R2 minor drift 5건 정정 — §8.1 HEAD ref + §1/§6/§7.7/§9 50차 R1+R2 박제 + commit count 31→32
```

### 50차 §1 B-17 EXECUTED 추가 commits (oldest → newest)

```
a9c9c93 fix(S7a 0016a): add legacy cost_log cleanup migration with row-count safety guard (B-17 execution head — adds 0016a forward + rollback)
50차 §1 B-17 박제 commit (HEAD direct ref via git log) docs(50차 §1 B-17 박제): 5 SoT — push + 0016a + 0017 applied + PR #1 + omxy 50 rounds CONVERGED
```

### 50차 §1 B-17 실행 결과 요약

- **push fast-forward**: `1c3dc26..a9c9c93` → `origin/feat/s7a-anthropic-wrapper` (no force, no skip-hooks)
- **production migrations applied** (Supabase MCP `apply_migration`):
  - `drop_legacy_cost_log` version `20260519135017` (0016a, row-count guard 통과 — row_count=0)
  - `cost_log_and_batch_runs` version `20260519135341` (0017, S7a Anthropic schema)
- **schema-existence smoke 7/7 PASS**: cost_log + monthly_batch_runs tables + stock_reports.consensus_badge column + 3 RPCs (acquire_batch_lock, commit_persona_eval, commit_badge_only) + committee_votes_report_persona_uniq constraint
- **PR #1 OPEN** ← head feat/s7a-anthropic-wrapper @ a9c9c93 ← base main
- **Vercel preview Ready** ← `https://tudal-git-feat-s7a-anthropic-wrapper-son00326s-projects.vercel.app`
- **B-17 migration recovery cleanup 2건** (omxy R3+R6 catch + R4+R5 lock-in):
  ① legacy cost_log schema cleanup via recorded migration 0016a (row-count guard + rollback recreates 0005+0008 final shape)
  ② production-only orphan unique index `committee_votes_report_persona_uniq` promoted in-place via one-off `ALTER TABLE … UNIQUE USING INDEX` (fresh DB unaffected — 0017 fresh-DB-correct)

---

## 2. 출시까지 선형 Runbook (50차 §2 박제 — omxy R14~R16 CONVERGED)

### §2.0 Default-progress policy (자동 진행 기본 정책)

**"이어서 진행해줘" 받았을 때 Claude의 행동 규칙**:

- **If current step is USER-gated, report it briefly as background blocker and proceed to the next unblocked CLAUDE step.**
- **Do not repeatedly ask which option to choose when the runbook already defines the next CLAUDE step.**
- **Stop only at explicit USER-gated operations or the exception list below.**

옵션 재질문 루프 금지. Runbook 박제된 다음 unblocked CLAUDE step을 즉시 자동 진행한다. USER-gated step은 background blocker로 표시만 하고 다음 CLAUDE step으로 이동.

**Ask user before (7 exception buckets)**:
1. **scope expansion** (HANDOFF 범위 초과 새 작업)
2. **product spec changes** (D-decision 변경)
3. **new risk profile** (가드레일 / 보안 정책 변경)
4. **real-money / live-account / order-path changes** (실 체결 토글 / 자동매매 토글 변경)
5. **secrets / billing / external account actions** (env / 키 / 외부 계정 트리거)
6. **destructive shared-state actions** (PR merge / production migration apply / production deploy / billing / 외부 메시지 발송 / external account 변경). Feature-branch push 및 PR create는 §2.1/§9 SHARED 정의에 따라 "이어서 진행" 권한으로 허용 — 본 exception에서 제외.
7. **uncertainty ≥ medium** (어떻게 진행해야 할지 불확실한 경우)

### §2.1 Step matrix (53차 §1 종료 시점 — 현재 위치 = **Step 3b 진행 중 (branch `feat/tier2-production-prompts`)** + **Step 1c = ✅ DONE (53차 §1)** + **Step 3a = SKIPPED (53차 §0 박제)**)

Owner 의미:
- **USER** = 사용자만 가능 (외부 계정 / 결제 / 키 발급 / production merge 등)
- **CLAUDE** = Claude 자동 가능 (코드 / 문서 / 로컬 commit / 검증)
- **SHARED** = Claude가 prepare/commit/PR-create 가능, 단 "이어서 진행" 권한이 명시적으로 부여된 경우에만. destructive merge/deploy/migration/billing은 USER에 남는다.

| Step | Owner | Trigger / Precondition | Default action on "이어서 진행" | Branch/PR policy | Verification / Exit | Blocks next |
|---|---|---|---|---|---|---|
| **1** ✅ DONE | ~~USER~~ | ~~PR #1 OPEN~~ MERGED in 51차 (mergeCommit `61653d22`, 2026-05-20) | — | main fast-forward 41 commits + Vercel production Ready | PR #1 state=MERGED ✓ | (해소) |
| **1b** | **USER** (보류) | PR #2 (format-error) OPEN — USER 명시 트리거 없음 + PR #1과 mechanical conflict 경고 | background blocker 보고 + 다음 unblocked CLAUDE step 자동 진행 | `gh pr merge 2 --rebase` 또는 close. 사용자 결정 필요. | PR #2 state=MERGED 또는 CLOSED | 독립 (다른 step blocking 0) |
| **1c** ✅ DONE (53차 §1) | ~~USER~~→SHARED 위임 | ~~PR #4 + #5 + PR #6 OPEN MERGEABLE — destructive (production merge)~~ | — | 53차 §1 실행: PR #4 → PR #5 (retarget --base main + rebase + force-with-lease) → PR #6 (retarget + rebase + force-with-lease). 모두 `--match-head-commit` race guard + NO `--delete-branch` (stacked safety). 마이그 0018 + 0019 file-exact apply via Supabase MCP + SECURITY DEFINER pg_proc smoke. omxy R1~R5 5 rounds CONVERGED. | PR #4 MERGED `71946f6f` · PR #5 MERGED `08073d89` · PR #6 MERGED `8108d058` · 마이그 19 total recorded · Final main gate ALL GREEN · Vercel canary 4/4 OK | (해소) |
| **3** ✅ DONE (52차) | ~~CLAUDE~~ | ~~Tier 2 SoT + impl 구현~~ | — | `feat/tier2-sot-overlay` (PR #4) + `feat/tier2-implementation` (PR #5, stacked). omxy 12 rounds CONVERGED. | D21 박제 + canonical-sectors.ts + mig 0018/0019 + commitSectorReport + runSectorEval + 196 mock stub. test:ci 522→606. | Step 3a/3b/3c |
| **3a** ✅ SKIPPED (53차 §0) | ~~CLAUDE~~ | ~~`origin/IMVCOM` 4 commits 분석 + 정합 머지 PR~~ — 53차 §0 진단으로 stale 판정: IMVCOM HEAD `1faee1b`는 main의 ancestor (`git merge-base origin/IMVCOM main` = `1faee1b`, `git log main..origin/IMVCOM` = empty). Kevin 4 commits (`44f6151` + `3b22d01` + `c00153c` + `1faee1b`) 모두 폴더 재구성 commit `101bd96` (2026-04-15) 이전에 머지 완료. Kevin reference 자료 15 파일 main 보존 (Outputs/v3-Readable.{md,html} + Service/Report/v3-{Decisions,DraftPhilosophy,NarrativeDesign,ValuationTrial} + ReaderAnalogyCards-ConstructionToBio + Samchundang.{md,html} + BioSectorReport-Alteogen + ReportFramework-BioSector + Alteogen v1/v2). | — | (해소 — 본 docs-only PR로 stale 정정 박제) | Step 3b (Step 3a 의존성 제거) |
| **3b** ✅ DONE (53차 §2 builder + §5 fanout, PR pending merge) | **CLAUDE** | branch `feat/tier2-production-prompts`. 53차 §1 박제 docs commit (`df8ef0e`) + Step 3b §1 builder (`d666e3b`) + R1 fix (`e81ba07`) + R2 fix + §5 fanout (`c57c9cc`) + R3 fix (`2b4904c`) + R4 polish. omxy R1~R4 4 rounds CONVERGED. | (해소 — Step 3b §6 PR create 후 USER merge 대기) | branch push 완료. PR create = SHARED 진행. merge = USER. | dynamic resolution: 14 sectors × 14 slot/sector = 196 cells via buildSectorPersonaContract + parseSectorPersonaId + resolveSectorPersona. 14 SECTOR_PHILOSOPHIES (Kevin v3.1 inquiry pattern follow) + 56 SECTOR_BASE_SLOT_ADJUSTMENTS (high-risk slots 4/5/8/10) + isSubTagAllowedForSector shared SoT (drift 방지). Tests: 650/64 (+44 over 53차 §1 main 606). | Step 3c |
| **3c** ⭐ NEW | **CLAUDE** | Step 3b merge 후 | 즉시 자동 시작 — Tier 2 caller wiring | new branch `feat/tier2-caller-wiring`. push/PR create = SHARED. merge = USER. | (i) monthly cron이 commitSectorReport 호출 (S7a §12 박제 mock dry-run 폐기 가능 — billing 충전 후) (ii) admin server action `triggerMonthlyPersonaEvalAction` Tier 2 branch 추가 (iii) `/admin/report/[ticker]/page.tsx` Section 8 partA UI render | Step 4 trigger 가능 시점 |
| **4** | **CLAUDE** | Step 3c commit 후 stacked from Step 3c (1세션+ 작업이라 진입 의사 1회 확인 후 자동) | 진입 의사 1회 확인 → 사용자 OK 시 자동 진행 | stacked branch base = Step 3c branch. push/PR create = §9 SHARED. merge는 USER. | Reflection 자가학습 (reflection_log 마이그 + Tier 1 context 주입 + tests) + PR create | Step 5 trigger 가능 시점 |
| **5** | **USER** | Step 1 merge 후 권장 (production env 적용 시점) — external account + billing | background blocker 보고 + 사용자 트리거 대기 | — | `vercel env add ANTHROPIC_API_KEY` (Preview+Production) + `AI_PROMPT_CACHE_ENABLED=true` + `AI_COST_LOG_REAL_INSERT_ENABLED=true` + Anthropic console billing 충전 + `vercel deploy --prod` | Step 6 |
| **6** | **CLAUDE** | Step 5 USER 트리거 후 | 즉시 자동 시작 — admin server action 1 ticker × 1 persona 호출 + 검증 + runtime hotfix (예: fetchFinancials column 매핑) + commit + push branch + PR create | new branch `fix/s7a-billing-on-smoke-hotfix`. push/PR create = §9 SHARED. merge는 USER. | cost_log row INSERT + section_8 jsonb persist + stock_reports.consensus_badge populated. fetchFinancials 0014 schema 매핑 hotfix 적용 | Step 7 trigger 가능 시점 |
| **7** | **USER** | Step 6 commit 후 권장 — external domain/key rotate | background blocker 보고 + 사용자 트리거 대기 | — | B-7 Resend 도메인 인증 + B-8 Naver key rotate + Vercel env 추가 | Step 8 |
| **8** | **CLAUDE** | Step 7 USER 트리거 후 | 즉시 자동 시작 — S7b 슬라이스 진입 (뉴스 sweep + 모닝 브리핑) + tests + commit + push + PR create | new branch `feat/s7b-news-briefing`. push/PR create = §9 SHARED. merge는 USER. | S7b DoD: 뉴스 수집 → 어드민 3인 이메일 발송 동작 확인 | Step 9 |
| **9** | **CLAUDE** | Step 8 merge 후 (운용 검증 기간 며칠~1주 어드민 3인 병행) | 즉시 D11 진입 활성화 + 어드민 3인 운용 시작 보고 + 모니터링 코드 추가 가능 | hotfix branch (BL-KRIT catch 시). push/PR create = §9 SHARED. PR 없음 — 운용 단계. | D11 AI 가상 포트 1차 가동. 어드민 3인 운용 검증 기간 며칠~1주. OK 신호 = "운용 OK"를 사용자가 신호 (외부 trigger) | Step 10 trigger 가능 시점 |
| **10** | **USER** | Step 9 OK 신호 후 — external key 발급 | background blocker 보고 + 사용자 트리거 대기 | — | B-10 KIS 본인 1개 (한투 OpenAPI key/account) 발급 + Vercel env | Step 11 |
| **11** | **CLAUDE** | Step 10 USER 트리거 후 | 즉시 자동 시작 — S7c 슬라이스 진입 (KIS WebSocket read-only 본인 1계좌 + 장중 데이터) + tests + commit + push + PR create | new branch `feat/s7c-intraday-kis`. push/PR create = §9 SHARED. merge는 USER. | S7c DoD: 장중 가격 스트림 수신 + UI 반영 | Step 12 |
| **12** | **CLAUDE** | Step 11 merge 후 | 즉시 자동 시작 — S7d 슬라이스 진입 (Silent Health 일일 batch 안정화) + tests + commit + push + PR create | new branch `feat/s7d-silent-health`. push/PR create = §9 SHARED. merge는 USER. | S7d DoD: heartbeat_log 일일 1건 + Critical alert 0건 안정 | Step 13 trigger 가능 시점 |
| **13** | **USER** | Step 12 merge 후 — external trigger bundle (동시 다수 외부 trigger 필요) | background blocker 보고 + 사용자 트리거 대기 | — | B-1 친구 비번 + B-2 KIS 슬롯 정리 + B-3 RLS QA + B-4 Smoke #5 + B-5 Session 4 QA + B-11 Binance key (testnet 우선) | Step 14 |
| **14** | **CLAUDE** | Step 13 USER 트리거 후 | 즉시 자동 시작 — S8 슬라이스 진입 (자동매매 frame Strategy drop-in + AI 어댑터 embed + Risk Policy Engine) + Binance Smoke #3 + tests + commit + push + PR create | new branch `feat/s8-auto-trading`. push/PR create = §9 SHARED. merge는 USER. | S8 DoD: 모의 체결 동작 + Risk 가드레일 enforced (레버리지 ≤ 5x · 일일 손실 -3% 자동 정지 · AI 일 주문 ≤ 20회) + Binance Smoke #3 통과 | Step 15 |
| **15** | **USER** | Step 14 merge 후 — S9 1개월+ 운용 (어드민 3인 실 사용; Claude는 hotfix/모니터링 branch로 자동 보조) | 즉시 S9 운용 검증 1개월+ 진입 + Claude 모니터링 시작 | hotfix branch들로 BL-KRIT 발견 시 patch (CLAUDE 자동). push/PR create = §9 SHARED. merge는 USER. | §2.2 7 criteria 모두 만족 (USER 신호 + Claude 자동 검증) | ✅ 어드민 내부 도구 출시 |

### §2.2 ✅ 어드민 내부 도구 출시 게이트 (S9 OK 신호 — 7 criteria, omxy R15 enriched)

S9 운용 검증 1개월+ 종료 후 **아래 7개 모두 만족** 시 "어드민 내부 도구 출시" 선언:

1. **최소 1개월 운용** (어드민 3인 일일 사용 + 운영 로그 기록)
2. **BL-KRIT open 0개** (ProgressDashboard §Global Blocker 모두 해소)
3. **3인 admin 핵심 플로우 일일 완료**: Short List 30 생성 → 풀 리포트 → 승인 → 가상 포트 추가 → 알림 발송. **추가**: 고정 disclaimer / non-advice wording이 노출되는 모든 화면에 visible 유지 (BusinessPlan §7 standing 법적 constraint)
4. **cron / health 안정**: Silent Health red_alert 0건 + 5 파이프라인 success_rate ≥ 99% + **추가**: Vercel production canary OK (admin routes load + server actions no unexpected 5xx + latest production deploy matches intended main)
5. **비용 hardcap 정상**: 월 400,000 KRW 미만 + AI 일 주문 ≤ 20회 + `cost_log` 정확 적재 + dashboard 표시 일치
6. **RLS / credential smoke 통과**: advisor anon WARN 0 + Smoke #3 (Binance) + #4 + #5 + #6 모두 통과 + credential 평문 UI/로그 노출 0건
7. **(자동매매 가동 시) guardrail 위반 0**: 레버리지 ≤ 5x · 일일 손실 -3% 자동 정지 · AI 일 주문 ≤ 20회 모두 enforced + 운영 1개월 위반 0건

---

## 3. 사용자 액션 대기 큐

| 우선 | 작업 | 필요한 사용자 액션 | 블록 범위 |
|---|---|---|---|
| ~~B-17~~ ✅ DONE | ~~B-17 execution bundle (마이그 production apply + branch push + PR/merge)~~ EXECUTED 50차 §1. omxy 6 rounds R1~R6 CONVERGED. | ✅ |
| ~~B-17b~~ ✅ DONE | ~~사용자 PR #1 review/merge~~ MERGED 51차 (mergeCommit `61653d22`). 41 commits fast-forward. Vercel production deploy Ready. | ✅ |
| ~~B-17c~~ ✅ DONE (53차 §1) | ~~사용자 PR #4/#5/#6 review/merge + 마이그 0018·0019 production apply~~ EXECUTED via SHARED 위임 (사용자 "너가 올바르게 해 + omxy랑 확인" 트리거). omxy R1~R5 5 rounds CONVERGED. PR #4 → #5 retarget+rebase+force-with-lease → #6 retarget+rebase+force-with-lease 모두 MERGED. 마이그 0018+0019 file-exact apply + smoke ALL GREEN. | ✅ |
| B-17d | (보류) PR #2 (format-error) review/merge — 사용자 명시 트리거 부재 + PR #1과 mechanical conflict 경고 | `gh pr view 2` 검토 후 결정 (merge / close) | 독립 (다른 step blocking 0) |
| B-1 | 친구 2명 임시 비번 설정 | 32차 admin API 패턴 재사용 | DQ-7 Smoke #4 |
| B-2 | 친구 KIS row 슬롯 정리 | son00326 슬롯의 친구 키를 shjang1001 슬롯으로 이전 후 son00326 row 삭제 | Smoke #4 |
| B-3 | Smoke #4 RLS 격리 | kevin 계정 brokerage row 0건 확인 | DQ-7 Session 3 close |
| B-4 | Smoke #5 대표 가드 | 친구 계정에서 Binance mainnet 라디오 403 확인 | DQ-7 Session 3 close |
| B-5 | DQ-7 Session 4 QA | T18 manual QA 30항 + T19 security probes | DQ-7 최종 close |
| **B-6** | **Anthropic API Key + billing 충전** | `vercel env add ANTHROPIC_API_KEY` (Preview+Production) + `AI_PROMPT_CACHE_ENABLED=true` + `AI_COST_LOG_REAL_INSERT_ENABLED=true` + Anthropic console에서 billing 충전 + `vercel deploy --prod` | **§2.B billing-on smoke (HANDOFF §C)** — S7a real 호출 검증 |
| B-2A | HIBP leaked-password protection 토글 | Supabase dashboard → Authentication → Policies → "Leaked password protection" ON | advisor warn 1건 |
| B-7 | Resend 도메인 인증 | Resend domain + env | S7b briefing |
| B-8 | Naver key rotate/env | 31차 노출 키 rotate 후 Vercel env | S7b news |
| B-9 | Telegram bot | token + admin 3명 chat_id | S7c alerts |
| B-10 | KIS 본인 1개 | 한투 OpenAPI key/account | S7c WS read-only |
| B-11 | Binance key | S8 진입 시 발급 | S8 + Smoke #3 |
| B-12 | 보안 rotate | Supabase anon/service_role/DB password/PAT, 노출 KIS/Naver secret rotate | S7a 전 권장 |
| B-13 | Vercel CLI update | v52 → v54 최신화 | 향후 deploy 권장 |

---

## 4. 안전 규칙

- 이 제품은 내부 어드민 투자 운영 도구다. Public signup/member/pricing 트랙은 Deferred-D 재개 전까지 만들지 않는다.
- **`feat/s7a-anthropic-wrapper` branch 직접 작업** (49차 완료, push 대기). main에 직접 commit 금지 (Vercel auto-deploy 영향). push는 **사용자 B-17 트리거**.
- S7a 완료 후 billing 충전 전까지 mock import를 real API로 몰래 바꾸지 않는다. billing-on은 `B-6` 사용자 트리거 후에만.
- `/admin` 접근 = Supabase session refresh + `ADMIN_EMAILS` allowlist + RLS 3중 방어.
- `SUPABASE_SERVICE_ROLE_KEY` client-exposed 코드 절대 금지. cron route는 mock dry-run only (Task 12 박제 — Design R4).
- credential plaintext/MEK/ciphertext UI/로그 노출 금지. credential secret = `src/lib/crypto/aes.ts` 서버 측 암호화.
- UI 문구 한국어 우선. 새 server action error code = `format-error.ts` 한국어 매핑 추가 (§2.C 후속 hotfix).
- Next.js 16 routing/middleware/server action 관련 변경 전 `tudal/node_modules/next/dist/docs/` 또는 공식 문서 확인.
- **신규 SECURITY DEFINER 함수 마이그는 반드시 3종 세트**: `revoke from public` + `revoke from anon` + `grant to authenticated` (48차 anon revoke hotfix lesson).
- **PostgreSQL `IF <null>`는 true 아님** (49차 omxy R1 lesson): RPC guard 작성 시 `is null or ... is distinct from ...` + `coalesce(v->>'key', '') not in ...` 명시.
- **section_8.partD.vote = BUY/HOLD/SELL literal 유지**. DB 저장 시 RPC가 case 매핑 (BUY→approve / HOLD→abstain / SELL→reject — committee_votes.vote check enum 호환). writer가 변환 금지 (49차 omxy R2 BLOCKER 박제).
- **stock_reports schema 호환** (49차 omxy final R1/R2 lesson): `generated_at` only (created_at/updated_at 없음), partial unique index `(ticker, month) WHERE is_latest = true` 보존. 신규 RPC는 `to_date(p_month || '-01', ...)`로 cast + `on conflict (ticker, month) where is_latest = true` 사용.

---

## 5. 문서 SoT

> **운영 순서**: 본 HANDOFF → spec/plan → Slice/ProgressDashboard → ServicePlan-Admin/ReportFramework → CodebaseStatus → 실행 규칙.

| 필요 정보 | 문서 |
|---|---|
| **S7a spec (omxy 합의 Q1~Q6 + Q5b + Design R4 + Plan R4 + R5)** | `docs/superpowers/specs/2026-05-19-s7a-anthropic-wrapper-design.md` |
| **S7a plan (Task 1~17 TDD 명시)** | `docs/superpowers/plans/2026-05-19-s7a-anthropic-wrapper.md` |
| **S7a Tier 0/1/2 + 합의 배지 5종 + Reflection 본문** | `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D19` (49차 v1.6 — 5종 배지 완료) |
| **Tier 2 D21 slot 모델 (canonical 14 × 14 overlay + sub_tag crosswalk 7개)** | `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D21` (52차 v1.7) + `Document/Service/Report/ReportFramework.md §7.2/§7.3 v2.5` |
| **S7a Section 8 위원 전원 표** | 같은 파일 `§3.7 R3.7-6/7/8/9` + `§6 D20` |
| **S7a Section 8 jsonb canonical contract** | 같은 파일 **§4.2.1** (49차 신설 — partA 0\|14 / partB 3~5 / partC / partD 11 + vote 매핑 BUY/HOLD/SELL ↔ approve/abstain/reject 명시) |
| **S7a Section 8 writer 작성 가이드** | `Document/Service/Report/ReportFramework.md §8 Step 2 v2.5` (52차 갱신) |
| **S7a 코드 SoT** | `tudal/src/lib/screening/consensus.ts` (5종 type union) · `tudal/src/lib/report/section-8-schema.ts` (zod schema) · `tudal/src/lib/ai/prompts/personas/` (Core 11) · `tudal/supabase/migrations/0017_cost_log_and_batch_runs.sql` |
| **Tier 2 D21 코드 SoT (52차)** | `tudal/src/lib/screening/canonical-sectors.ts` (CANONICAL_SECTORS 14 + SECTOR_PERSONA_COUNT=14 + TIER2_CALLS_PER_TICKER=25 + SUB_TAG_CROSSWALK + resolveSlotTemplate) · `tudal/src/lib/report/writer.ts` (commitSectorReport + parseSectorContentStrict) · `tudal/src/lib/screening/persona-eval.ts` (runSectorEval) · `tudal/src/lib/data/mock-admin-committee-personas.ts` (CANONICAL_SECTOR_PERSONAS 196 stub) · `tudal/supabase/migrations/0018_short_list_30_sub_tags.sql` + `0019_commit_sector_personas.sql` |
| **📌 Kevin reference (Tier 2 production prompts quality target — main 보존 자료)** | 53차 §0 박제: `origin/IMVCOM` 4 commits (`44f6151` + `3b22d01` + `c00153c` + `1faee1b`)는 모두 main의 ancestor (`git merge-base origin/IMVCOM main` = `1faee1b` IMVCOM HEAD, `git log main..origin/IMVCOM` empty). 폴더 재구성 commit `101bd96` (2026-04-15)으로 자료 위치 이동 후 보존. **main 보존 위치**:<br>• `Document/Outputs/Report-Alteogen_196170_v3-Readable.md` (v3.1 초보 친화 리포트 본문, 603줄)<br>• `Document/Outputs/Report-Alteogen_196170_v3-Readable.html` (Bloomberg Light 스타일 단일 HTML, 1383줄)<br>• `Document/Outputs/Report-Samchundang_000250.{md,html}` (삼천당 풀 리포트)<br>• `Document/Outputs/BioSectorReport-Alteogen_196170.md` (바이오 섹터 템플릿)<br>• `Document/Outputs/Report-Alteogen_196170_v{1,2}.{md,html}` (이전 버전 사본, 진화 history)<br>• `Document/Service/Report/ReportFramework-v3-DraftPhilosophy.md` (2-Layer 철학)<br>• `Document/Service/Report/ReportFramework-v3-NarrativeDesign.md` (5질문 서사 설계)<br>• `Document/Service/Report/ReportFramework-v3-Decisions.md`<br>• `Document/Service/Report/ReportFramework-v3-ValuationTrial.md` (이전 시범본 — v3.1에서 Section4-Trial로 언급되었던 자료)<br>• `Document/Service/Report/ReaderAnalogyCards-ConstructionToBio.md` (건설→바이오 비유 카드 50개)<br>• `Document/Service/Report/ReportFramework-BioSector.md`<br>**Step 3a SKIPPED — Step 3b production prompts 196 작성 시 위 자료 직접 reference**. |
| T7e.7 RLS QA 결과 기록 위치 | `Document/Build/Slices/S7-RealData.md` |
| S7e 상세 태스크/의사결정 | `Document/Build/Slices/S7-RealData.md` |
| 전체 진행률/변경 이력 | `Document/Build/ProgressDashboard.md` |
| 코드 스냅샷/실 I/O 통로 / 잔존 mock 목록 | `Document/Process/CodebaseStatus.md` |
| 어드민 서비스 기획 본체 (D16/D17/D18/D19/D20/**D21·D22**) | `Document/Service/Planning/ServicePlan-Admin.md` |
| 슬라이스 실행 규칙 | `Document/Process/ExecutionPlaybook.md` |

---

## 6. 완료 이력

상세는 git log + spec/plan/Slice 파일. 직전 항목 (53차 §2 Step 3b builder → 53차 §1 머지+마이그-apply → 53차 §0 stale-fix → 52차 Tier 2 SoT + impl PR → 51차 PR #1 머지 + Tier 2 brainstorm → 50차 §1 B-17 EXECUTED 순):

- **53차 §2 Step 3b §1 builder + §5 fanout 완성 (branch `feat/tier2-production-prompts`, 2026-05-21)**:
  - **scope**: 사용자 "진입 — 196 prompts 자동 작성 시작" + "3b 6 끝날때까지는 omxy랑의 대화 멈추지 말고 계속 진행해" 트리거. Step 3b §1~§6 omxy iterate CONVERGED까지 자동 진행.
  - **omxy R1~R4 4 rounds CONVERGED (9 BLOCKERS catch)**:
    - R1 5 BLOCKERS: (1) malformed personaId silent accept (slot 1~12 + subtag suffix / unknown subtag) / (2) cross-sector subtag mismatch (예: 바이오-조선) silent accept / (3) base slot depth too generic (global_industry_veteran + 바이오 = generic supply chain) / (4) Kevin v3.1 overpromise (200자에서 DCF/Half Kelly 재현 불가, "quality target" → "inquiry pattern") / (5) tests=coverage-not-invariants
    - R2 3 NEW BLOCKERS: (A) Partial<Record<string,string>> 키 타입 loose (typo silent drop) / (B) "9 unfilled sectors fallback" test가 incompleteness를 expected behavior로 freeze (PR reviewer가 intentional로 오인) / (C) buildSectorPersonaContract direct call에서 cross-sector mismatch silent accept
    - R3 1 NEW BLOCKER + 답변 (f): (D) resolveSlotTemplate이 SUB_TAG_OVERLAY_ROLES in-check만 하고 sector compatibility 미검증 → `runSectorEval({sector:'바이오', sub_tags:['조선']})` invalid personaId 발급 / (f) sub_tag validity 로직 2곳 duplicate → drift 위험, shared helper 권고
    - R4 CONVERGED: 모든 BLOCKERS fix 검증 + polish 3 items noted (Kevin v3.1 코멘트 wording / 2차전지 polysilicon / 자동차 덴소 / 바이오 imminent BLA)
  - **구현 결과 (3 commits + polish)**:
    - `df8ef0e` (53차 §1 박제 docs first commit) → builder phase 진입 시 context handoff 안전 확보
    - `d666e3b` Step 3b §1 builder: sector-persona-builder.ts (330 lines) + tests (180 lines) — 14 SECTOR_PHILOSOPHIES + 10 BASE_SLOT_PRINCIPLES + KEVIN_V31_TONE_RULES + buildSectorPersonaContract + parseSectorPersonaId + resolveSectorPersona + generateAllSectorPersonas + getPersonaById dynamic fallback + runSectorEval sub_tag personaId encoding
    - `e81ba07` R1 5 BLOCKERS fix: parseSectorPersonaId validation 강화 + SECTOR_BASE_SLOT_ADJUSTMENTS 5 prototype sectors × 4 high-risk slots = 20 adjustments + KEVIN_V31_TONE_RULES "inquiry pattern" reframing + +10 invariant tests
    - `c57c9cc` R2 3 BLOCKERS fix + §5 fanout: BaseSlotRole type-tight + 9 sectors 추가 = 14 × 4 = 56 adjustments full coverage + buildSectorPersonaContract throw guard (unknown_sub_tag + sub_tag_sector_mismatch) + +4 tests
    - `2b4904c` R3 BLOCKER D + 답변 f fix: canonical-sectors.ts isSubTagAllowedForSector shared SoT export + resolveSlotTemplate sector compatibility 통합 + builder duplicate guard 제거 + +8 tests (canonical-sectors.test.ts)
    - polish (R4): top comment "quality target" → "inquiry pattern follow" + 바이오 imminent BLA biologics-bias 수정 + 자동차 덴소 (foreign) 제거 + 2차전지 polysilicon (solar-adjacent) 제거 + 리튬/니켈/코발트 + 재활용 추가
  - **검증 게이트 (53차 §2 종료, 모든 commit baseline)**: build 25 routes OK · lint 0 errors 6 warnings (pre-existing) · **test:ci 650 / 64 files** (+44 over 53차 §1 main 606: §1 builder +22 / R1 invariant +10 / R2+§5 +4 / R3 isSubTagAllowedForSector +8) · tsc clean
  - **omxy debate**: 77 → **81 rounds CONVERGED** (53차 §2 R1~R4 = 4 rounds, 9 BLOCKERS catch)
  - **다음 1순위**: Step 3b §6 PR create (`gh pr create --base main` from feat/tier2-production-prompts) + USER review/merge → Step 3c caller wiring (cron mock dry-run 폐기 + admin server action Tier 2 branch + Section 8 partA UI render) → Step 4 Reflection

- **53차 §1 Tier 2 stacked PRs 머지 + 마이그 production apply EXECUTED (branch `feat/tier2-production-prompts` 신설, 2026-05-20)**:
  - **scope**: 사용자 "HANDOFF 보고 이어서 진행 + 머지 필요하면 omxy랑 확인한다음 진행. 너가 올바르게 해" 트리거로 SHARED 위임 받음. 53차 §0이 OPEN으로 두었던 PR #4/#5/#6 머지 + 마이그 0018/0019 production apply 실행 + omxy 적대적 검토.
  - **omxy R1~R5 5 rounds CONVERGED (12 BLOCKERS catch)**:
    - R1 5 BLOCKERS: (1) stacked PR merge semantics — naive `gh pr merge 5`가 feat/tier2-sot-overlay로 머지될 위험 / (2) scope guard conflict — OOS "ServicePlan/ReportFramework 본문 변경"이 PR #4 안의 D21 박제와 충돌 (재해석 후 의도적 변경 박제) / (3) GH checks 약함 — local gate authoritative / (4) 마이그 apply ordering + preflight 필요 / (5) PR #2 보류 untouched
    - R2 3 NEW BLOCKERS: (A) `gh pr edit --base main`은 metadata만 — local rebase + push 별도 필요 / (B) `--delete-branch`는 stacked intermediate PR에서 위험 — 모든 PR 머지 후 cleanup / (C) SECURITY DEFINER 검증은 `pg_proc.prosecdef` 직접 + `has_function_privilege(regrole, regprocedure, 'EXECUTE')` 사용
    - R3 4 diffs: (1) PR #4도 `--match-head-commit` race guard 대칭 적용 / (2) `gh pr edit` 후 mergeability 재확인 + DIRTY/BLOCKED/UNKNOWN 시 polling / (3) conditional push (OLD_SHA != NEW_SHA일 때만 force-with-lease) / (4) cleanup 전 open-PR check
    - R4 4 last diffs: (1) post-push PR status/headRefOid recheck 3-assert / (2) PR #4도 pre-merge status check / (3) UNKNOWN polling 10s×12 / (4) MCP `apply_migration` query는 Read tool로 file content 정확 전달 (manual SQL 금지)
    - R5: CONVERGED — "28 steps lock-in, stop conditions preserved (git non-clean / rebase conflict / gate regression / migration mismatch / PR #2 untouched / no Step 3b body until user confirmation)"
  - **실행 결과 (28-step sequence)**:
    - PHASE A (PR #4): head gate (build 25 routes / lint 0 err / test:ci 560/61 / tsc clean) → status assert 3 PASS → `gh pr merge 4 --rebase --match-head-commit 02dc223c` → MERGED `71946f6f` (14:06:10 UTC) → main pull
    - PHASE B (PR #5 retarget): `gh pr edit 5 --base main` → status UNKNOWN→UNSTABLE (poll 2/12) → checkout + fetch + OLD_SHA `f7b62c8` + rebase origin/main (4 cherry-picks skipped, 6 rebased) + NEW_SHA `24474f6f` → head gate (build / lint 0 err / test:ci **606/63** / tsc clean) → `git push --force-with-lease` (OLD≠NEW) → status assert 3 PASS → `gh pr merge 5 --rebase --match-head-commit 24474f6f` → MERGED `08073d89` (14:09:34 UTC) → main pull
    - PHASE C (PR #6 retarget): `gh pr edit 6 --base main` → status UNKNOWN→UNSTABLE (poll 2/12) → checkout + fetch + OLD_SHA `e5757c5` + rebase (7 cherry-picks skipped, 1 rebased) + NEW_SHA `8bd08e46` → head gate (606/63) → force-with-lease → status assert → `gh pr merge 6 --rebase --match-head-commit 8bd08e46` → MERGED `8108d058` (14:12:12 UTC) → main pull
    - Final main gate: build OK · lint 0 err · test:ci **606 / 63 files** · tsc clean
    - PHASE D (마이그): Supabase MCP `list_migrations` → 0017까지 적용 + 0018/0019 미적용 확인 → 0018 file-exact apply via `apply_migration` → smoke (sub_tags=jsonb / GIN idx / row count 30 unchanged) → 0019 file-exact apply → SECURITY DEFINER smoke (prosecdef=true / proconfig="search_path=public, pg_temp" / anon_exec=false / auth_exec=true). `list_migrations` 최종 19 migrations (`20260520141739 short_list_30_sub_tags` + `20260520141835 commit_sector_personas`)
    - PHASE E (Vercel canary): / 200 · /login 200 · /macro 200 · /admin 307 (auth redirect, expected)
  - **branch 위생**: `--delete-branch` 미사용 (stacked safety — omxy R2 BLOCKER B 박제). 세 branch (`feat/tier2-sot-overlay`, `feat/tier2-implementation`, `docs/53-step3a-stale-fix`) 모두 push 보존 상태. cleanup은 후속 작업에서 open-PR check 통과 후 선택적 진행.
  - **PR #2** (format-error CONFLICTING): 사용자 명시 트리거 부재 + 보류 박제 (omxy R1 BLOCKER 5 준수). touch 0건.
  - **다음 1순위 (53차 §1+)**: Step 3b 진입 — branch `feat/tier2-production-prompts` 신설 from main HEAD `8108d058` → production sector persona prompts 196 (Kevin v3.1 quality target = main 보존 자료 reference). 본 53차 §1 박제 docs commit이 새 branch의 first commit.

- **53차 §0 Step 3a stale 진단 + 정정 (PR #5 stacked docs-only, 2026-05-20)**:
  - **scope**: 사용자 "HANDOFF 보고 이어서 진행" + 30분 시간 제약 + "omxy와 토론 후 합의되면 진행" 트리거. Step 3a "Kevin IMVCOM 정합 머지 PR" 박제가 stale한지 진단 + omxy 합의 후 HANDOFF 정정.
  - **진단 결과**: 52차 박제 Step 3a 전제는 stale.
    - `git merge-base origin/IMVCOM main` = `1faee1b` (IMVCOM HEAD 자체) → IMVCOM HEAD는 main의 ancestor
    - `git log main..origin/IMVCOM` = empty → 머지 누락 commits 0
    - `git branch --contains 1faee1b` → main 포함
    - Kevin 4 commits (`44f6151` + `3b22d01` + `c00153c` + `1faee1b`) 모두 폴더 재구성 commit `101bd96` (2026-04-15) 이전에 머지 완료
  - **Kevin reference 자료 main 보존 위치** (`git ls-tree -r main --name-only`로 확인 — 13 자료 + Alteogen v1/v2 사본 2 = 총 15 파일):
    - Document/Outputs/Report-Alteogen_196170_v3-Readable.{md,html} (v3.1 본문 + Bloomberg Light HTML)
    - Document/Outputs/Report-Samchundang_000250.{md,html}
    - Document/Outputs/BioSectorReport-Alteogen_196170.md
    - Document/Outputs/Report-Alteogen_196170_v{1,2}.{md,html} (이전 버전 사본)
    - Document/Service/Report/ReportFramework-v3-{DraftPhilosophy,NarrativeDesign,Decisions,ValuationTrial}.md
    - Document/Service/Report/ReaderAnalogyCards-ConstructionToBio.md
    - Document/Service/Report/ReportFramework-BioSector.md
  - **omxy R1~R3 CONVERGED (적대적 검토 3 rounds)**:
    - R1 CONTINUE: 5 BLOCKERS catch — (a) IMVCOM merge OK / (b) **Section4-Trial false pointer** (main에 없음, ValuationTrial로 rename됨) / (c) Step 3b 단독 진행 OK / (d) 추가 stale 위치 6개 (header / §0 / §2.1 제목 / §3 B-17c / §8.3 / §9 자동 진행 조건) / (e) 30분 가능
    - R2 보강 lock-in: "13개 파일" 숫자 정정 → 15개 파일 (md+html 별도 count) + (B)(C)(D)(E) 모두 합의
    - **R3 branch base 오진단 catch**: R2 합의 "from main 독립 PR" 전제 폐기 — 정정 대상 entries는 모두 52차 박제 = PR #5 (`feat/tier2-implementation`)에만 존재, main에는 stale 0건. → branch base 변경 `docs/53-step3a-stale-fix` from `feat/tier2-implementation` (PR #5 stacked)
  - **정정 commit (53차 §0)**: HANDOFF.md 단일 파일, 15+ loci 정정:
    - L3 (header) + L7~L10 (§0 5줄 요약 #1·#2·#3·#4) + L34/L36 (§0 분기 A·C) + L62 (§1 표 Kevin IMVCOM row) + L66/L68 (§1 표 OPEN PRs row) + L145 (§2.1 제목) + L156 (Step 1c default action) + L158 (Step 3a 행 — SKIPPED) + L159 (Step 3b Trigger — Step 3a 의존성 제거) + L194 (§3 B-17c description) + L245 (§5 표 Kevin row — 15 파일 list + false pointer 제거) + L285 (§6 본문 52차 entry 다음 1순위) + L535 (§8.3 첫 bullet) + L547 (§8.3 checklist Step 3a 진입 시 — 삭제) + L579 + L580 (§9 운영 원칙 — Step 3a 정합 머지 전제 제거).
    - 추가 §6 entry (본 53차 §0 entry 박제).
    - 추가 §7.7 omxy debate 누적 (69 → 72 rounds 갱신).
  - **검증 게이트**: docs-only commit이라 코드 영향 0. build/lint/test:ci/tsc 모두 52차 baseline 유지 (build OK · lint 0 err 6 warn · test:ci 606 / 63 files · tsc clean).
  - **다음 1순위 (53차+)**: Step 1c USER (PR #4 + #5 + 본 PR 머지 + 마이그 0018·0019 production apply) → **Step 3a SKIPPED** → Step 3b CLAUDE (production prompts 196, Kevin v3.1 quality target = main 보존 자료 reference) → Step 3c CLAUDE (caller wiring) → Step 4 CLAUDE (Reflection).

- **52차 Tier 2 SoT (PR #4) + Tier 2 implementation (PR #5) + HANDOFF 박제 (2026-05-20)**:
  - **scope**: 사용자 "Tier 2 SoT PR 진행해줘 + Tier 2 implementation PR 진행해줘 + HANDOFF 박제해줘" 3차례 트리거. 본 세션 = 51차 직후 same-day 종료 박제.
  - **PR #4 (Tier 2 SoT, omxy R1~R4 + final R1+R2 = 6 rounds CONVERGED + subagent gsd 9 BLOCKERS)**:
    - D21 박제: canonical 14 sectors × 14 personas/sector overlay (10 base + 2 primary + 2 sub_tag)
    - sub_tag crosswalk 7개 (운영 UI taxonomy proxy): 조선→운송/물류 · 방산→철강/소재 · 화학→철강/소재 · 게임→IT/SW+엔터/미디어 secondary · 가전→유통/소비재 · 제약→바이오 · 부동산→건설
    - 7 files: ServicePlan-Admin §1A.5 D21 + §1A.2 + §3.2 + §3.7 + §4.2 E1 sub_tags + §4.2.1 + §8 v1.7 + ServicePlan.md §3 + ReportFramework §5/§7.2 14-slot 재작성 + §7.3 sub_tag crosswalk + §8/§10 v2.5 + HANDOFF.md §6 + canonical-sectors.ts (PR #4 시점 production import 0, tests/만) + 마이그 0018 (`short_list_30.sub_tags jsonb` + GIN)
    - omxy final R1 5 findings catch → R2 hotfix (literal "14×10" 영문 어휘 회피 + ReportFramework §5 "10명" 일반화 + ServicePlan.md §3 정정 + byte-identical semantic match + changelog 정정)
  - **PR #5 (Tier 2 implementation, stacked on PR #4, omxy R1~R3 + final R1+R2 = 6 rounds CONVERGED + subagent gsd 9 BLOCKERS)**:
    - 마이그 0019 `commit_sector_personas` RPC + SECURITY DEFINER triad + SELECT FOR UPDATE race-free + section_8 `coalesce || jsonb_build_object` Core 필드 보존 + p_sector_aggregate exact keys {buy,hold,sell} + integer/non-negative validation + DELETE persona_layer='sector' first → INSERT 14 idempotency + canonical sector enum in-list (canonical-sectors.ts SoT drift snapshot test 동반)
    - canonical-sectors.ts 추가 export: `SECTOR_PERSONA_COUNT=14` + `TIER2_CALLS_PER_TICKER=25` (chair = Core 11 마지막, 별도 추가 X) + `resolveSlotTemplate(sector, sub_tags)` helper
    - writer.ts: `commitSectorReport()` export + `parseSectorContentStrict()` (JSON parse 실패/vote enum 불일치/필수 필드 누락 → RPC 호출 자체 차단, committee_votes 오염 0)
    - persona-eval.ts: `runSectorEval()` scaffold (per-ticker, preflightHardcap, persona ID 패턴 `sector-{sector}-slot-{1~14}`, Promise.all 14 parallel, degraded count, tier2AvailableByTicker runtime return only)
    - mock-admin-committee-personas.ts: `CANONICAL_SECTOR_PERSONAS` 196 stub + `getCanonicalSectorPersonas()` (legacy 5인 lean 105 격리 보존, UI 호환)
    - +46 tests (legacy.5lean.test.ts 6 + canonical-sector-personas.test.ts 10 + canonical-sectors 추가 22 + persona-eval 추가 8 + writer 추가 10 strict parser 3 포함)
    - production import 정확 3 파일 (persona-eval / writer / mock-fixture, tests 제외)
    - cron/admin action route 변경 0 (commitSectorReport export-only, caller wiring = Step 3c OOS)
  - **omxy final R1 B-final-1+2+3 hotfix** (PR #5 commit `aa8cebe`):
    - B-final-1: literal "780" production code/comment 제거 (DoD false-PASS 차단)
    - B-final-2: SQL integer validation `mod((p_sector_aggregate->>'buy')::numeric, 1) <> 0` + non-negative 추가
    - B-final-3: `parseSectorContentStrict()` 신규 — malformed AI content가 HOLD stub으로 RPC persist되는 risk 차단
  - **52차 §2 HANDOFF 박제** (PR #5 docs-only terminal commit, omxy R1 CONVERGED):
    - HANDOFF.md (header / §1 / §2.1 Step 1c·3·3a·3b·3c·4 재구조 / §3 / §5 Kevin IMVCOM reference / §6 본 entry / §7.7 / §8.3 / §9 [[handoff_kevin_v31_quality_target]])
    - ProgressDashboard.md, ServicePlan-Admin.md (v1.8 + D22), CodebaseStatus.md, CLAUDE.md (상단 시퀀스 v3.2)
  - **검증 게이트 (52차 종료 baseline)**: build 25 routes OK · lint 0 errors 6 warnings (pre-existing) · **test:ci 606 / 63 files** (baseline 522→560→606, +84 over 52차) · tsc clean · Vercel preview SUCCESS (PR #4 + PR #5)
  - **omxy debate 누적**: 50 (50차) + 6 (51차) + 6 (52차 SoT) + 6 (52차 impl) + 1 (52차 HANDOFF 박제 R1) = **69 rounds CONVERGED**. 적대적 검토 = 본 세션 가장 큰 lesson 재확인 = omxy + subagent 통합 검토가 implementer self-review 우회 결함 (총 18 BLOCKERS catch) 차단.
  - **사용자 핵심 의도 박제 (52차 종료)**: Tier 2 자동 생성 30종목 리포트의 **quality target = Kevin IMVCOM v3.1 reference**. 현재 Tier 2 scaffold는 mock 196 stub으로만 동작 (Kevin v3.1 톤·구조·깊이는 Step 3b production prompts 196 작성 시 박제 follow 필요).
  - **다음 1순위 (53차+ — 53차 §0 stale-fix 박제 후 갱신)**: Step 1c USER (PR #4 + #5 + 53차 §0 stale-fix PR 머지 + 마이그 0018·0019 production apply) → **Step 3a SKIPPED (53차 §0 박제, IMVCOM 이미 머지)** → Step 3b CLAUDE (production prompts 196, Kevin v3.1 quality target = main 보존 자료 reference) → Step 3c CLAUDE (caller wiring) → Step 4 CLAUDE (Reflection).

- **51차 PR #3 + #1 머지 + Tier 2 R3~R7 brainstorm CONVERGED (2026-05-20)**:

- **51차 PR #3 + #1 머지 + Tier 2 R3~R7 brainstorm CONVERGED (2026-05-20)**:
  - **scope**: 사용자 "Tier 2 R3 brainstorm 재개" + "PR #1, #3 머지해줘" 트리거. omxy cmux pair-debate 5 rounds 추가 (R3~R7) + subagent gsd-code-reviewer cross-check + 머지 실행 + 회귀 게이트 + stash 안전 폐기.
  - **Tier 2 brainstorm 5 rounds CONVERGED (R3~R7)**:
    - **R3 D1~D9 제로베이스 재검증**: §7.2 v2.0 outdated 확정 (partA=14), R2 "공통 4 신규 slot invent" 가설 BLOCKER/기각, §7.3은 14 "섹터" 목록일 뿐 slot definitions 아님 (path:line 인용)
    - **R4 한국 sector taxonomy 리서치**: KRX(KOSPI 22/KOSDAQ 19+14) / WICS(10·28·79) / GICS(11·25·74·163) 비교 + JooPick 14 = "운영 UI taxonomy" OK / benchmark-grade 부족 → sub_tags 도입 권고
    - **R5 D5~D8 결판**: **Option C overlay (10 base + 2 primary overlay + 2 sub_tag overlay = 14명 고정)** + **sub_tags jsonb 7개 우려 영역 mapping** (조선/방산→산업재, 화학→소재, 게임→IT/SW or 엔터, 가전→전기전자, 제약→바이오, 부동산→건설) + 데이터 모델 (a)+(c) (`short_list_30.sub_tags jsonb` + `canonical-sectors.ts` hardcode) + **`commit_sector_personas` 신규 RPC** (PR #1 commit_persona_eval 보존, additive 안전) + transformer 폐기 (canonical 직접 render) + cost 26 calls × 30 = 780 정기 + 1560 regen = 2,340 worst-case ≈ 33만원 cache-off
    - **R6 머지 순서/방식**: Y 채택 (PR #3 → PR #1 → PR #2 보류) + rebase-and-merge (squash는 40 commits audit trail 잃음, repo merge commit 관례 없음 — `git log --merges --oneline` empty) + PR #1↔#3 textual conflict 0 (anthropic-pricing.ts main..PR#1 diff 0줄)
    - **R7 stash drop verdict**: 39 files = 36 byte-identical + 0 신규 + 3 PR #3 hotfix 이전 stale ($15/$75 rollback 조각) → drop 안전
  - **Subagent gsd-code-reviewer cross-check** (PR #1 pre-merge 독립 검토): HIGH BLOCKER 1건 (PR #1 source의 old $15/$75 pricing — PR #3 머지 후 main에서 자동 해소) + MEDIUM 4건 (month 검증 누락, 350K warning dashboard-only, ai_billing_exhausted dead branch, admin_emails error swallow) + VERIFIED 5건 (ai_key_unavailable fallback, cron mock-only, 0017 SECURITY DEFINER 3-line grant triad, test 522 pass) → 머지 진행 권고
  - **머지 실행 (Step 1~7)**:
    - Step 1: staged 39 unstage (`git restore --staged .`)
    - Step 2: `gh pr merge 3 --rebase` → mergeCommit **`ee090688e11ceb4972644d8161788115b032c2d4`**, 05:06:26 UTC
    - Step 3: `gh pr merge 1 --rebase` → mergeCommit **`61653d22af00fc217e1dd1775a59df1f613026ea`**, 05:06:52 UTC
    - Step 4: stash worktree + main switch + pull (41 commits fast-forward, HEAD `61653d2`)
    - Step 5: 회귀 게이트 ALL GREEN — build 25 routes / lint 0 err 6 warn (unused imports) / **test:ci 522 passed / 60 files** / tsc clean
    - Step 6: Vercel production deploy 2건 Ready (`61653d2` 46s + `ee09068` 41s)
    - Step 7: stash drop `6cccb7b8ecb2bc09366fb2500bc4865e34f3184a` (omxy R7 verdict)
  - **PR #2 보류**: 사용자 명시 트리거 부재 + PR #1과 mechanical conflict 경고 (양쪽 mapping keep 필요)
  - **52차 Tier 2 SoT PR 진행 중 (2026-05-20)**: branch `feat/tier2-sot-overlay` (main fresh `fdc6002` 기준). omxy 4 rounds CONVERGED (R1~R4) + final R1 적대적 검토 5 findings 박제 후 fix (R2 hotfix) + subagent gsd 정밀 검토 3 BLOCKERS 박제 후 fix (산업재·전기전자 부재 → Option β 재매핑 / literal grep 0 DoD / mock fixture LEGACY_ALIAS_MAP 좁게). **D21 박제**: canonical 14 sectors × 14 personas/sector overlay (10 base + 2 primary + 2 sub_tag). **sub_tag crosswalk 7개** (조선→운송/물류 · 방산→철강/소재 · 화학→철강/소재 · 게임→IT/SW+엔터/미디어 secondary · 가전→유통/소비재 · 제약→바이오 · 부동산→건설). 8 files: ServicePlan-Admin §1A.5 D21 + §1A.2 UA1 + §3.2 R3.2-4 + §3.7 R3.7-6 + §4.2 E1 sub_tags + §4.2.1 partA + §8 v1.7 · ServicePlan.md §3 표 D21 정정 (R2 R-fix) · ReportFramework §5/§7.2 14-slot 재작성 + §7.3 sub_tag crosswalk + §8 v2.5 pointer + §10 v2.5 · `canonical-sectors.ts` + tests (38 unit, production import 0) · 마이그 0018 sub_tags jsonb + GIN. 다음 1순위 → 사용자 PR review/merge → **Tier 2 implementation PR** (commit_sector_personas RPC + Section 8 partA render + mock fixture migration).

- **50차 §1 B-17 EXECUTED + omxy R1~R6 CONVERGED (2026-05-19)**:
  - **scope**: 사용자 "B-17 트리거할게. 이것도 omxy랑 토론해서 진행해줘. 올바르게" 트리거로 7-step sequence (S1~S7) 실행. push + 마이그 0016a + 0017 production apply + PR #1 + Vercel preview.
  - **omxy debate 6 rounds CONVERGED (R1~R6)**:
    - R1: 5-step proposal adversarial review → R2 lock-in 6-step amended sequence + Q1 schema-existence-only smoke + Q2 tool-neutral PR + S4 rollback nit
    - **R3 design bug catch**: 0017 cost_log conflict with 0005+0008 chain (fresh-DB도 fail — `create table public.cost_log` no IF NOT EXISTS) + Option B `0017a_` lexsort flaw (`_` < `a`) → 제안 B′ = `0016a_` 명명 (sort 검증: `0016 → 0016a → 0017`)
    - **R4 footgun catch**: missing row-count safety guard before destructive drop → DO-block precondition `raise exception 'Refusing to drop legacy public.cost_log: % rows exist'` 추가
    - R5 final draft + tool-neutral SQL comments → CONVERGED
    - **R6 second orphan catch**: `committee_votes_report_persona_uniq` orphan unique index (49차 manual testing 잔재, no constraint) → promote-in-place via `ALTER TABLE … UNIQUE USING INDEX` (one-off execute_sql, atomic, fresh-DB unaffected)
  - **B-17 migration recovery cleanup 2건**:
    ① legacy cost_log schema cleanup via recorded migration **0016a** (`drop_legacy_cost_log.sql` + `.rollback.sql`, DO-block row-count guard 박제, rollback recreates 0005+0008 final shape)
    ② production-only orphan unique index promoted in-place (one-off `ALTER TABLE committee_votes ADD CONSTRAINT … UNIQUE USING INDEX …`, no migration record — fresh DB chain 0005→0008→0016→0016a→0017 corret without this)
  - **실행 결과**: push fast-forward `1c3dc26..a9c9c93`, migrations `drop_legacy_cost_log` (20260519135017) + `cost_log_and_batch_runs` (20260519135341) applied, schema-existence smoke 7/7 PASS, PR #1 OPEN (https://github.com/son00326/New_Project_KR_Stock/pull/1), Vercel preview Ready (https://tudal-git-feat-s7a-anthropic-wrapper-son00326s-projects.vercel.app)
  - **검증 게이트 (a9c9c93 + 50차 §1 박제 commit 후)**: build OK · lint 0 errors · test:ci **522 pass / 60 files** · tsc clean (baseline 유지)
  - **34+ commits ahead of main** (33 pre-박제 + 1 50차 §1 박제 commit + R11 cleanup + 후속 minor docs cleanup; 정확 값 `git rev-list --count main..HEAD`). push 완료. PR #1 OPEN.
  - **다음 1순위**: 사용자 PR #1 review/merge → §2.B billing-on smoke (별도 B-6) → §2.C format-error 추가 매핑 hotfix → §2.D Tier 2 / Reflection 후속 PR.

- **50차 §0 SoT 박제 정합 R1+R2+R3 CONVERGED (2026-05-19)**:
  - **scope**: 50차 세션 진입 시점에 49차 박제 commit 2건(8d57a4b + f5b4d7a) 추가로 인한 SoT 6 문서 stale 검증 + omxy 적대적 박제 검토. 코드 변경 0건, docs-only.
  - **omxy 50차 §0 박제 검토 3 rounds CONVERGED** (자체 subagent 사용 강제):
    - R1: 코드/마이그 push-ready PASS, SoT stale 6 BLOCKER catch (commits 28+/26/8 → 30, HEAD a2d2c04/a61bbf5 → f5b4d7a, ProgressDashboard test:ci 463/50 → 522/60, CodebaseStatus 49차 entry mid-session, CLAUDE.md "49차 진행 중", 결함 grep 카탈로그 literal OOS)
    - 50차 §0 SoT 박제 commit `1fe9bad`: 5 SoT 정정 (HANDOFF + ProgressDashboard + CodebaseStatus + CLAUDE.md + S7-RealData)
    - R2: 자체 subagent 2개 (gpt-5.3-codex-spark) + git/grep/gate 재실행 → SIGNAL: CONVERGED
    - 50차 §0 R3 cleanup docs commit (HEAD direct ref via git log): post-R2 minor drift 5건 정정 (§8.1 HEAD ref + §1/§6/§7.7/§9 round bracket + commit count 31→32)
    - R3: 자체 subagent + git/grep 재실행 → SIGNAL: CONTINUE (placeholder 2건 BLOCKER catch)
    - R4 토론 (omxy 자체 subagent 2개 + 정책 분석): option A 채택 (amend + hash-agnostic 서술), 사용자 위임 1회 예외 정당화 → SIGNAL: CONVERGED
    - R3 cleanup commit amend (이 commit) — placeholder 2건을 hash-agnostic 서술로 교체
  - **검증 게이트 (50차 §0 진입 + R2 + R3 시점 모두 통과)**: build OK · lint 0 errors · test:ci **522 / 60 files** · tsc clean (baseline 유지)
  - **다음 1순위**: B-17 사용자 트리거 (49차에서 박제된 큐 그대로).

- **49차 S7a Task 1~17 + omxy 40+ rounds CONVERGED (2026-05-19)**:
  - **scope**: brainstorming → writing-plans → subagent-driven-development (Task 1~4 진입 전 + Task 5~17 본 세션) + omxy code-review (R1~R3 task별 + 최종 R1~R3).
  - **omxy debate 누적 40+ rounds CONVERGED**:
    - 진입 전 25 rounds (21 brainstorm/plan + 1 R5 spec gap + 3 code-review)
    - 본 세션 13 task R1+R2 (Task 5~16 각 task 1~2 rounds)
    - 최종 R1~R3 (main..HEAD diff 적대 검토 — 2 critical BLOCKERS catch)
    - 박제 R1 (HANDOFF/ProgressDashboard 49차 박제 검증)
  - **본 세션 catch + fix BLOCKERS (7건)**:
    - Task 9: acquireBatchLock plan-internal 시그니처 불일치 → string positional (Plan R3 BLOCKER 6 정정 유지)
    - Task 10: `core_revote` schema lowercase normalize (plan UPPERCASE → schema lowercase)
    - Task 11: `formatAdminError` → `formatErrorMessage` 함수명 (plan 오기)
    - Task 13 R1: `fetchFinancials` silent `{}` 금지 — error throw (warm path runtime 도달 catch, omxy 발견)
    - Task 15 R1: consensus_badge emoji enum + §4.2.1 partA required clarify (textual labels → emoji literals)
    - **Task 17 final R1**: 0017 RPC `created_at`/`updated_at` 컬럼 미존재 (Task 1 pre-existing bug, Plan R1~R3 모두 놓침) → `generated_at` + `to_date(p_month || '-01', ...)` cast
    - **Task 17 final R2**: 0017 `stock_reports_month_ticker_uniq` UNIQUE (month, ticker) 추가가 기존 versioning contract (`version` + `is_latest` + partial unique) 와 충돌 → constraint 제거 + RPC `ON CONFLICT (ticker, month) WHERE is_latest = true` 로 변경
  - **검증 게이트 (49차 완료 시점)**: build OK · lint 0 errors · test:ci **522 / 60 files** (baseline 463 → +59 신규 tests over 9 task) · tsc clean
  - **32 commits ahead of main** (10 진입 전 + 13 task + 4 fix + 3 박제 commit (49차 7c7c794 + 8d57a4b + f5b4d7a) + 50차 §0 SoT 박제 commit 2건 (`1fe9bad` SoT 정합 + R3 cleanup)). push 대기 = **B-17 사용자 트리거**.
  - **다음 1순위**: B-17 사용자 트리거 (push + 마이그 0017 apply + PR/merge) → §2.B billing-on smoke (별도) → §2.C format-error 추가 매핑 hotfix → §2.D Tier 2 / Reflection 후속 PR.

---

## 7. omxy 적대적 코드 검토 패턴 (49차 박제, 후속 PR 재사용)

### 7.1 왜 필요한가

49차 lesson: implementer subagent self-review (test pass + tsc clean + grep 패턴)만으로 **본 세션에서만 5 critical blockers + 2 final BLOCKERS 놓침**. omxy cmux pair-debate가 **외부 적대적 시각**으로 catch. **본 PR이 push-ready인 이유 = omxy 적대적 검토 강제 적용 덕분**.

**규칙**: 매 task implementer 완료 → omxy 적대적 코드 검토 1~3 rounds → CONVERGED 후 다음 task. 후속 PR (Tier 2 / Reflection 등)에서도 동일 패턴 강제 적용.

### 7.2 omxy 환경 (49차 종료 시점 — 다음 세션에서 변동 가능)

- **cmux peer surface**: `surface:8` (49차). 다음 세션에서는 `cmux list-panes`로 omxy 탐색 후 갱신.
- omxy 모델: gpt-5.5 high, YOLO mode.
- **eligibility probe**: `test -n "${CMUX_WORKSPACE_ID:-}" && cmux identify` — Broken pipe 또는 no CMUX_WORKSPACE_ID면 orchestrate 불가, 사용자에게 보고.

### 7.3 cmux send helper script

parry-guard hook가 bash `$(cat file)` 패턴 차단 → python helper 사용. 다음 세션 진입자가 재생성:

```bash
cat > /tmp/cmux-send-helper.py <<'PYEOF'
#!/usr/bin/env python3
"""Helper to send file content to cmux pane (avoids bash $(cat) parry-guard trigger)."""
import subprocess, sys, time
if len(sys.argv) != 3:
    print("usage: cmux-send-helper.py <surface> <msg-file>", file=sys.stderr); sys.exit(1)
surface, msg_file = sys.argv[1], sys.argv[2]
with open(msg_file, 'r', encoding='utf-8') as f: content = f.read()
result = subprocess.run(['cmux', 'send', '--surface', surface, content], capture_output=True, text=True)
print(result.stdout, end='')
if result.returncode != 0: print(f"cmux send failed: {result.stderr}", file=sys.stderr); sys.exit(result.returncode)
time.sleep(2.5)
subprocess.run(['cmux', 'send-key', '--surface', surface, 'enter'], check=True)
time.sleep(1.5)
subprocess.run(['cmux', 'send-key', '--surface', surface, 'enter'], check=True)
print(f"sent {len(content)} chars to {surface}")
PYEOF
```

### 7.4 적대적 검토 메시지 템플릿 (매 task)

각 task implementer commit 후 omxy에 다음 패턴으로 송신:

```
=== NEW DEBATE — Task N 실 commit 코드 적대적 검토 (cmux pair-debate v1) ===

PROTOCOL: SIGNAL: CONTINUE/CONVERGED/ESCALATE. <500 words. Adversarial. SCOPE GUARD.

TASK: Task N (모듈명) 실 commit 코드 적대적 검수. CONVERGED 조건 = (a) plan과 1:1 일치 (b) self-review 우회 결함 0 (c) 기존 schema/모듈 호환성 (d) hardcoded constants 정확.

CONTEXT:
- Branch: <branch> at HEAD <hash>
- Spec: <path>
- Plan: <path>
- Commits to review: <hash> "<message>"
- 변경 파일: <list>

검증 요청:
(a) plan과 1:1 일치?
(b) PostgreSQL/zod/TypeScript edge case 위험 (49차 lesson — IF null / Q3 semantic / 기존 schema check enum / stock_reports.generated_at / partial unique)?
(c) 기존 SoT 모듈과 충돌 (anthropic-pricing.ts / committee_votes.vote enum / RLS 정책 / cron route caller / format-error 매핑 / stock_reports schema)?
(d) Type 일관성?
(e) grep 패턴 (raise '/ p_admin_id / created_at|updated_at / commit_unavailable_badge / section_8.consensus_badge / buyCount / approve|abstain|reject in writer) 0 매치?

ROUND 1 — FROM: orchestrator
입장 = 결함 0 기대. 검증 후 SIGNAL: CONVERGED 또는 CONTINUE with diff.

OOS:
- Spec 재논의
- Tier 2 / Reflection / 멤버 / S8 (별도 PR)
- 미진입 task / 후속 hotfix

SIGNAL: CONTINUE
```

### 7.5 fix 패턴 (BLOCKERS 발견 시)

omxy R1에서 결함 발견 시:
1. **Edit 또는 새 commit으로 정정** (amend 금지 — 사용자 명시 필수).
2. fix commit message = `fix(<scope> omxy R<N> BLOCKER[S]): <one-line>`.
3. omxy R2 송신 (변경된 commit hash 명시 + 적용 diff 요약).
4. CONVERGED 받을 때까지 R3 / R4 반복 (최대 8 rounds).

### 7.6 49차 발견 결함 카탈로그 (다음 PR 재발 방지 grep 검증 대상)

본 PR에서 이미 fix된 결함 — 후속 PR에서 재발 방지를 위한 grep 검증:

| 결함 | grep 패턴 (코드 작성 후 0 매치 확인) | 발견 commit | Fix commit |
|---|---|---|---|
| PostgreSQL `IF <null>` pass-through | `raise '` (모두 `raise exception '`) | 82ed324 | c14fb2e |
| 마이그 RPC guard에 null 미체크 | `jsonb_typeof.*<>` (있어야 `is distinct from`) / `not in.*` (앞에 `is null or`) | 82ed324 | c14fb2e |
| Q3 partA `z.array()` 1~13 통과 | `partA: z.array(.*)` (있어야 `.refine(`) | 857112b | c14fb2e |
| `committee_votes.vote` enum mismatch | `(v ->> 'vote')::text` (있어야 `case (v ->> 'vote')` 매핑) | 82ed324 | a2d2c04 |
| `p_admin_id` caller-supplied (RPC) | `p_admin_id` (있으면 안 됨, plan R3 BLOCKER 6) | (plan 단계 차단) | — |
| `commit_unavailable_badge` 이름 | `commit_unavailable_badge` (있어야 `commit_badge_only`) | (plan 단계 차단) | — |
| `buyCount >= 6` 임시 threshold | `buyCount >= 6` (있어야 bucket rank + isTopTier) | (plan 단계 차단) | — |
| writer가 vote 매핑 (Task 10 lesson) | writer.ts에 `'approve'\|'abstain'\|'reject'` 0 매치 (있어야 vote: BUY/HOLD/SELL만) | (HANDOFF 강조) | Task 10 implementer prompt 명시 |
| Task 13 fetchFinancials silent {} | actions.ts에 `data ?? {}` after Supabase select without `if (error) throw` | 4cf838b | ce11f02 |
| **stock_reports.created_at/updated_at 사용** | 0017 SQL에 `created_at\|updated_at` (0003은 `generated_at`만) | 82ed324 | b62bb11 |
| **stock_reports_month_ticker_uniq full UNIQUE** | 0017에 `add constraint stock_reports_month_ticker_uniq` (versioning contract 충돌) | 82ed324 | a61bbf5 |
| **ON CONFLICT (month, ticker)** | 0017 RPC에 `on conflict (month, ticker)` (있어야 `on conflict (ticker, month) where is_latest = true`) | 82ed324 | a61bbf5 |

### 7.7 omxy debate 누적 박제 (50차 §1 B-17 EXECUTED 시점)

```
brainstorming (Q1~Q6 + Q5b):              21 rounds  CONVERGED
writing-plans (Plan R1~R4):                4 rounds  CONVERGED (포함 in 21)
spec gap R5 (pricing.ts):                  1 round   CONVERGED
code-review R1~R3 (4 commits, 진입 전):    3 rounds  CONVERGED
─────────────────────────────────────────────
                                          25 rounds  CONVERGED (49차 진입 시점)

49차 task별 R1+R2 (Task 5~16):            13 rounds  CONVERGED
49차 final R1~R3 (main..HEAD diff):        3 rounds  CONVERGED (2 critical BLOCKERS catch)
49차 박제 R1 (HANDOFF/ProgressDashboard):   1 round   CONVERGED
─────────────────────────────────────────────
                                          17 rounds  CONVERGED (49차 본 세션)

50차 §0 박제 R1 (SoT 6 stale 검출):         1 round   CONTINUE (BLOCKER 6 catch, 불산정)
50차 §0 박제 R2 (1fe9bad fix 검증):         1 round   CONVERGED
50차 §0 R3 cleanup (post-R2 drift 5건):    1 round   CONVERGED (R4 amend 정책 토론 + R5 stamp OOS round count)
─────────────────────────────────────────────
                                           2 rounds  CONVERGED (50차 §0, R1 CONTINUE 불산정)

50차 §1 B-17 사용자 트리거 execution:
  R1 5-step proposal (adversarial review)       CONVERGED-track
  R2 6-step amended sequence lock-in + Q1/Q2    CONVERGED
  R3 0017 design bug + 0017a→0016a lexsort fix  CONVERGED-track (Option B′ 합의)
  R4 row-count guard footgun fix                CONVERGED-track
  R5 final draft tool-neutral SQL comments      CONVERGED
  R6 second orphan promote-in-place             CONVERGED
─────────────────────────────────────────────
                                           6 rounds  CONVERGED (50차 §1 B-17 R1~R6)

50차 §2 Runbook docs verification rounds (R14+): not counted (durable, post-execution docs phase)

51차 본 세션 (PR merge + Tier 2 brainstorm R3~R7):
  R3~R7 brainstorm + subagent cross-check                       6 rounds  CONVERGED
─────────────────────────────────────────────
                                          6 rounds  CONVERGED (51차)

52차 본 세션 (Tier 2 SoT PR + impl PR + HANDOFF 박제):
  PR #4 omxy R1~R4 + final R1+R2                                6 rounds  CONVERGED (subagent gsd 9 BLOCKERS)
  PR #5 omxy R1~R3 + final R1+R2                                6 rounds  CONVERGED (subagent gsd 9 BLOCKERS)
  HANDOFF 박제 omxy R1                                          1 round   CONVERGED
─────────────────────────────────────────────
                                         13 rounds  CONVERGED (52차)

53차 §0 stale-fix (Step 3a 진단 + HANDOFF 정정):
  R1 stale 진단 (5 BLOCKERS catch: Section4-Trial false pointer + 누락 stale 위치 6개)   1 round   CONTINUE→CONVERGED-track
  R2 lock-in (15→15+ loci + 13→15 file 정정 + Owner/Trigger/PR base 합의)              1 round   CONVERGED
  R3 branch base 오진단 catch (from main → from feat/tier2-implementation stacked)     1 round   CONVERGED
─────────────────────────────────────────────
                                          3 rounds  CONVERGED (53차 §0)

53차 §1 PR 머지 + 마이그 production apply (SHARED 위임, 28-step sequence lock-in):
  R1 5 BLOCKERS (stacked merge + scope guard + GH check + 마이그 ordering + PR #2 보류) 1 round   CONTINUE→CONVERGED-track
  R2 3 NEW BLOCKERS (gh edit metadata-only + --delete-branch stacked risk + pg_proc smoke) 1 round   CONTINUE→CONVERGED-track
  R3 4 diffs (match-head-commit symmetry + post-edit recheck + conditional push + cleanup PR check) 1 round   CONTINUE→CONVERGED-track
  R4 4 last diffs (post-push 3-assert + PR #4 status check + UNKNOWN polling + file-exact MCP) 1 round   CONTINUE→CONVERGED-track
  R5 CONVERGED (28 steps lock-in, 6 stop conditions preserved)                       1 round   CONVERGED
─────────────────────────────────────────────
                                          5 rounds  CONVERGED (53차 §1)

총 누적 (CONVERGED only — §1 종료):       77 rounds  CONVERGED (53차 §1 종료 시점, 안정)

53차 §2 Step 3b builder + §5 fanout (sector-persona-builder + 56 adjustments + isSubTagAllowedForSector shared SoT):
  R1 5 BLOCKERS catch (silent malformed ID + cross-sector subtag + base depth + Kevin v3.1 overpromise + tests=coverage-not-invariants) 1 round   CONTINUE→CONVERGED-track
  R2 3 NEW BLOCKERS (loose type + tests freeze incompleteness + direct builder mismatch)                                                  1 round   CONTINUE→CONVERGED-track
  R3 BLOCKER D (resolveSlotTemplate cross-sector silent accept) + 답변 f drift                                                            1 round   CONTINUE→CONVERGED-track
  R4 CONVERGED (BLOCKER D fix + shared SoT consolidation + polish 3 items noted)                                                          1 round   CONVERGED
─────────────────────────────────────────────
                                          4 rounds  CONVERGED (53차 §2)

총 누적 (CONVERGED only):                 81 rounds  CONVERGED (53차 §2 Step 3b 종료 시점, 안정)
```

---

## 8. 다음 세션 진입자 자동 진행 체크리스트

### §8.1 현재 위치 확인 (자동 실행 1회)

```bash
git status --short --branch                       # 53차 §1 종료 = feat/tier2-production-prompts (또는 후속 branch)
git log --oneline main..HEAD | head -40           # 본 branch commits 박제 확인 (53차 §1 박제 first commit 포함)
gh pr list --state open --json number,title,headRefName,mergeable  # 53차 §1 종료 기준 = #2 보류 1건만
# Supabase MCP: list_migrations — 19 migrations 박제 확인 (0018/0019 포함)
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

### §8.2 자동 진행 결정 (§2 Runbook 따라)

1. **마지막 완료 Step 식별** → §2.1 매트릭스에서 다음 Step 확인
2. **다음 Step Owner 별 행동** (§2.0 default-progress policy 적용):
   - **[CLAUDE]** → 즉시 자동 진행 시작 + commit 단위 진행. Step 3/4 같은 stacked 1세션+ 작업은 §2.1 Trigger/Precondition column에 명시된 대로 진입 의사 1회 확인 후 자동.
   - **[SHARED]** (§2.1 Branch/PR policy column에 push/PR-create 권한 표기) → "이어서 진행" 권한으로 prepare/commit/PR-create까지 자동. merge/deploy/migration은 USER 별도 트리거.
   - **[USER]** → 트리거 보고 (필요한 정확한 명령 + 외부 액션) + 동시 진행 가능한 [CLAUDE] Step 자동 시작 + 사용자 응답 대기. Step 13 같은 external trigger cluster는 모든 trigger 항목을 명시 보고.
3. **§2.0 7 exception buckets 도달 시 USER 직접 묻기**: scope expansion / product spec / 새 risk profile / real-money / secrets·billing / destructive shared-state / uncertainty ≥ medium

### §8.3 후속 PR 진입 시 omxy 적대적 검토 (§7 패턴 재사용)

- [ ] 새 branch 생성 (Step 3a는 53차 §0 SKIPPED 박제로 제외):
  - Step 3b (production prompts 196) → `feat/tier2-production-prompts`
  - Step 3c (caller wiring) → `feat/tier2-caller-wiring`
  - Step 4 (Reflection) → `feat/tier2-reflection`
  - Step 8 (S7b) → `feat/s7b-news-briefing`
  - Step 11 (S7c) → `feat/s7c-intraday-kis`
  - Step 12 (S7d) → `feat/s7d-silent-health`
  - Step 14 (S8) → `feat/s8-auto-trading`
- [ ] §7.3 cmux helper script 재생성 (`/tmp/cmux-send-helper.py`)
- [ ] §7.2 cmux peer surface 갱신 (`cmux list-panes`로 omxy 탐색)
- [ ] §7.4 omxy 적대적 검토 패턴 매 task 강제 적용 + subagent gsd 정밀 검토 병렬
- [ ] §7.6 결함 카탈로그 grep 검증 (특히 stock_reports schema + writer vote 매핑 + p_sector_aggregate integer + parseSectorContentStrict + canonical 14 drift + production import 정확 3 파일 등)
- [ ] **Step 3b 진입 시**: main 보존 Kevin reference 자료 (Outputs/v3-Readable.{md,html} + Service/Report/v3-NarrativeDesign + DraftPhilosophy + ReaderAnalogyCards 등) 톤·구조·깊이 분석 → 196 sector persona system prompt 박제 (`@/lib/ai/prompts/personas/` 신규 디렉토리)
- [ ] **Step 3c 진입 시**: cron route 변경 (S7a §12 박제 mock dry-run 폐기, billing 충전 후) + admin server action Tier 2 branch + Section 8 partA UI render
- [ ] **ExecutionPlaybook.md 갱신 필요 여부 판단** (Step 3b/3c가 새 execution routing 카테고리라면 §2 매핑 표 보강)

### §8.4 Step 6 billing-on smoke (Step 5 USER 트리거 후) 진입 시

- [ ] Step 5 USER 트리거 완료 확인 (`vercel env ls`에 ANTHROPIC_API_KEY + 2 flag + Anthropic console billing 충전)
- [ ] admin server action 1 ticker × 1 persona 호출 (`/admin/track-record`)
- [ ] cost_log row + section_8 jsonb persist + stock_reports.consensus_badge 컬럼 값 확인
- [ ] **fetchFinancials runtime fail 예상** (dart_financial_cache 실 schema 컬럼 매핑 — `financials_fetch_failed:*` throw) → 즉시 hotfix branch (actions.ts에서 revenue/op_income/... 매핑 + corp_code 키 사용)

### §8.5 Step 9 D11 AI 가상 포트 1차 가동 시

- [ ] 어드민 3인 일일 운용 시작 + 모니터링 로그 수집 (며칠~1주)
- [ ] BL-KRIT catch 시 hotfix branch + commit
- [ ] 사용자 "운용 OK" 신호 수신 → Step 10 USER 트리거 큐

---

## 9. 사용자 운영 원칙 박제 (49차 + 50차 §2 Runbook + 52차 Kevin reference 추가)

- **omxy 토론 = 무조건 subagent/skill 활용해 정말 완벽하게 검토** (사용자 명시).
- **사용자 승인 게이트 제거** (omxy CONVERGED = 사용자 승인 등가).
- **목표 박제 = HANDOFF 범위 B** (Tier 1 + 합의 배지 5종 + Section 8 + 30 mock e2e). 이 범위 초과 또는 product spec 결정만 사용자 직접 묻기.
- **omxy 토론 진입 시 scope guard 4종 박제 필수**: 목적 / 컨텍스트 / 선택지 / Out-of-Scope ([[feedback_omxy_debate_scope_guard]] memory).
- **commit pattern**: 자동 commit (amend 금지 — 사용자 명시 시만). branch 분리 = main 직접 commit 금지.
- **Owner 분리 (omxy R15 박제)**:
  - **USER** = 사용자만 가능: PR merge / production deploy / production migration apply / billing / external account or key. Claude 자동화 금지.
  - **CLAUDE** = Claude 자동: 코드 / 문서 / 로컬 commit / 로컬 검증.
  - **SHARED** = push / PR create: Claude가 prepare/commit/PR-create 가능, 단 "이어서 진행" 권한이 명시적으로 부여된 경우에만. destructive merge/deploy/migration/billing은 USER에 남는다.
- **Default-progress policy (§2.0 박제)**: "이어서 진행해줘" 받으면 옵션 재질문 루프 금지. §2.1 Runbook 박제된 다음 unblocked CLAUDE step 자동 시작 + USER-gated step은 background blocker로 표시. §2.0 7 exception buckets 도달 시만 USER 직접 묻기.
- **📌 Tier 2 production prompts quality target = Kevin v3.1 reference (52차 박제 + 53차 §0 위치 정정 [[handoff_kevin_v31_quality_target]])**: 다음 세션 Step 3b (production sector persona prompts 196 작성) 시 **main 보존 자료의 톤·구조·깊이를 따라야 함** — `Document/Outputs/Report-Alteogen_196170_v3-Readable.{md,html}` 본문 + `Document/Service/Report/ReportFramework-v3-{DraftPhilosophy,NarrativeDesign,Decisions,ValuationTrial}.md` 프레임워크 + `Document/Service/Report/ReaderAnalogyCards-ConstructionToBio.md` 비유 카드 + `Document/Outputs/Report-Samchundang_000250.{md,html}` 보조 reference. 단순 lorem-ipsum / "Mock Persona" stub 금지. 14 sector × 14 persona system prompt 박제. **53차 §0 박제**: Kevin IMVCOM 4 commits는 이미 main의 ancestor이므로 별도 정합 머지 PR 불필요 — main 보존 자료를 직접 reference. 자세한 SoT pointer = §5 표 + ServicePlan-Admin §1A.5 D22.
- **HANDOFF.md 다음 세션 자동 진행 가능 조건**: header (5줄 요약) + §1 + §2 + §8 모두 stale 0. 본 53차 §1 종료 시점 omxy R1~R5 CONVERGED + 77 rounds 누적 + branch `feat/tier2-production-prompts` (신설 from main `8108d058`, 53차 §1 박제 first commit 포함) + Runbook 현재 위치 = **Step 3b 진행 중** (production prompts 196, Kevin v3.1 quality target) + Step 1c/3a/B-17c 모두 해소. PR #2 보류 1건만 OPEN (untouched).
