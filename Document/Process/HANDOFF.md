# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-21 (53차 §4 — **🎯 Step 3c Tier 2 caller wiring IMPLEMENTED + PR #9 OPEN MERGEABLE CLEAN** · 53차 §3 PR #8 머지 완료 (main `db7797a`)) · branch `feat/tier2-caller-wiring` (정확 HEAD/count는 verification command block(§8.1)로 확인) · **PR #9** OPEN MERGEABLE CLEAN: https://github.com/son00326/New_Project_KR_Stock/pull/9 · admin server action `triggerMonthlyPersonaEvalAction` Tier 2 branch + exported `shouldRunTier2` env-gated cost gate + `Tier2Counters` 5-field partition (attempted/committed/skippedGate/skippedSector/skippedUnavailable) + `isCanonicalSector` type guard + `sub_tags` strict Array.isArray+string filter + backward-compatible additive return · cron/UI 변경 0 (Section8View 이미 sector votes 렌더링 코드 보유) · 검증 게이트 ALL GREEN (test:ci 699/66, +8 over PR #8 main 691) · SDD 2-stage review (spec compliance ✅ + code quality Approved with fixes 4 Important all addressed) · omxy 누적 135 rounds CONVERGED (Step 3c 7 rounds = D4 R1~R4 4 + final R1 1 + push/PR R1~R2 2, 8 BLOCKERS catch & fix) · 다음 = USER PR #9 review/merge → Step 4 Reflection

이전 갱신: 2026-05-21 (53차 §3 종료 + **Final omxy R1~R3 PR #8 머지 직전 적대적 self-review CONVERGED**) — Step 3b 207 persona Kevin v3.1 quality 본문 완성 + Layer (a~g) ALL CONVERGED + PR #8 → main 머지 완료 (mergeCommit `db7797a`). 207 × 8 markers = 1656 marker assertions 전수 통과. 회사명 production code 0 매치.

[53차 §3 완료 박제]: PR #7 MERGED `02c7947a` (Layer §2 builder) → branch `feat/tier2-step3b-prompts-196` 생성 → Layer (a) Kevin rubric SoT + Layer (b) SECTOR_PHILOSOPHIES 14 4 anchor + Layer (c) BASE_SLOT_PRINCIPLES 10 재무 확인 + Layer (d) PRIMARY_OVERLAY_PRINCIPLES 28 신규 + Layer (e) SUB_TAG_OVERLAY_PRINCIPLES 14 신규 + Layer (f) Core 11 inject (index.ts wrapping) + Layer (g) Step 1 builder.ts cleanup + Step 2 196 sector coverage + Step 3 SECTOR_BASE_SLOT_ADJUSTMENTS 회사명 cleanup. + **Final omxy R1~R3 PR #8 머지 직전 self-review** (R1 3 BLOCKERS docs/comment stale refs to nonexistent test artifacts → fix `ea8d27b` / R2 1 BLOCKER snapshot helper 28-IDs false-coverage → fix `b2b32cf` / R3 CONVERGED "PR #8 mergeable"). omxy 누적 85 → **128 rounds CONVERGED** (+43 in 53차 §3 including Final R1+R2+R3, **22 BLOCKERS total catch & fix** = 16 Layer + 2 마무리 + 4 Final). 207 × 8 markers = 1656 marker assertions 전수 통과. 회사명 50+ tokens grep 0 match. test:ci 65 / 691 (+41) / build 25 routes / lint 0 err 6 warn / tsc clean. PR #8 OPEN MERGEABLE CLEAN @ HEAD (verification block 확인).

## ⭐ 다음 세션 진입자 5줄 요약

1. **현재 branch**: `feat/tier2-caller-wiring` (53차 §4, main +3 commits + HANDOFF 박제 commit). **정확 HEAD/count는 verification command block(§8.1)로 확인** — omxy R7 Option A generic reference (recursive drift 회피) 박제 유지.
2. **OPEN PRs (53차 §4 시점)**: **#2** (format-error CONFLICTING, 보류 유지) + **PR #9** OPEN MERGEABLE CLEAN: https://github.com/son00326/New_Project_KR_Stock/pull/9 (base main ← head feat/tier2-caller-wiring, Step 3c admin action Tier 2 branch). PR #8 머지 완료 (mergeCommit `db7797a`).
3. **USER-gated 대기**: PR #9 review/merge (53차 §4에서 create + omxy push/PR sequence R1~R2 CONVERGED + SDD 2-stage review 통과 + omxy final R1 CONVERGED).
4. **다음 1순위 CLAUDE 작업**: (USER PR #9 merge 완료 후) §2.1 **Step 4 — Reflection 자가학습** (reflection_log 마이그 + Tier 1 context 주입 + tests).
5. **자동 진행**: §2.0 default-progress policy + §7 omxy 적대적 검토 패턴 강제 적용 + Subagent-Driven Development skill (implementer + spec compliance reviewer + code quality reviewer 3-stage) 박제 패턴. context handoff 시 본 §0 5줄 요약 + §1 표 + §2.1 Step 3c row (IMPLEMENTED/PR OPEN) + §6 53차 §4 entry로 재개.

**목적**: 새 세션에서 사용자가 "`Document/Process/HANDOFF.md` 보고 이어서 진행"이라고 하면, 이 파일만으로 **§2.1 Runbook 박제된 순서대로 자동 진행** (§2.0 default-progress policy 준수 — 옵션 재질문 루프 금지). USER-gated Step은 background blocker로 표시 + 다음 unblocked CLAUDE Step 자동 시작. §2.0 7 exception buckets 도달 시만 USER 직접 묻기.

**운영 원칙**: 미래 지향. 49차 Task 1~17 진행 상세는 git log + `docs/superpowers/specs/2026-05-19-s7a-anthropic-wrapper-design.md` + `docs/superpowers/plans/2026-05-19-s7a-anthropic-wrapper.md` + `Document/Build/Slices/S7-RealData.md` + `Document/Build/ProgressDashboard.md`에 위임. 52차 Tier 2 SoT + impl 진행 상세는 git log + PR #4/#5 본문에 위임. CLAUDE.md 자동 로드 — 본 HANDOFF는 미래 진행에 필요한 정보만 박제.

---

## 0. 세션 시작 루틴 (53차 §3 종료 시점 갱신 — omxy R7 Option A generic 적용)

```bash
cd /Users/yong/New_Project_KR_Stock
# 정확 branch state runtime 확인 (docs hardcoded 박제 회피 — omxy R7 Option A 권고)
git rev-parse --abbrev-ref HEAD                      # 현재 branch (예상: feat/tier2-step3b-prompts-196 또는 PR #8 merge 후 후속 branch)
git rev-parse --short HEAD                           # 현재 commit hash
git rev-list --count main..HEAD                      # branch ahead count
git log --oneline main..HEAD | head -10              # commit history

# OPEN PRs 확인 (53차 §3 종료 baseline = #2 보류 + #8 OPEN MERGEABLE CLEAN, hardcoded 가정 금지 — runtime 확인)
gh pr list --state open --json number,title,headRefName,mergeable

# PR #7 (53차 §2 deliverable) state 확인
gh pr view 8 --json state,baseRefName,headRefOid,mergeStateStatus,url

# Supabase production schema 확인 (53차 §1 baseline = 19 migrations)
# (Supabase MCP `list_migrations` 또는 `gh api` 호출)

# 검증 게이트 baseline (53차 §3 종료) = build 25 routes · lint 0 err 6 warn · test:ci 65 / 691 files · tsc clean
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

**53차 §3 종료 branch = `feat/tier2-step3b-prompts-196`** (53차 §2 PR #7 머지 후 신규 + Layer (a~g) 6+3 sub-step + 마무리 박제 commits, push 완료, **PR #8 OPEN MERGEABLE CLEAN**). main 직접 작업 금지.

**다음 세션 진입 시점 분기 (자동 식별, PR #8 state 기반)**:
- **(A) PR #8 state=MERGED** → main 기준 새 branch `feat/tier2-caller-wiring` 생성 + **Step 3c 즉시 진입** (caller wiring, §2.1 Step 3c row). Step 3c 본격 작업이라 진입 의사 1회 확인 후 자동.
- **(B) PR #8 state=OPEN MERGEABLE (CLEAN/UNSTABLE)** → background blocker 보고 (USER review/merge 필요) + 동시 가능한 CLAUDE 작업 없음 (Step 3c는 PR #8 merge 의존). 사용자 명시 트리거 시 추가 진행.
- **(C) PR #8 state=OPEN CONFLICTING** → 사용자 보고 후 rebase + force-with-lease + 재push (53차 §1 stacked merge 패턴 재사용).
- **(D) PR #8 state=CLOSED (merge 외)** → 사용자 보고 + 재오픈 또는 새 PR 작성 결정.

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

## 1. 현재 상태 요약 (53차 §3 종료 시점, 2026-05-21)

| 영역 | 상태 |
|---|---|
| Branch | `feat/tier2-caller-wiring` (53차 §4 신규 from main `db7797a` post PR #8 머지 + Step 3c implementer 3 commits + HANDOFF 박제 commit, push 완료, **PR #9 OPEN MERGEABLE CLEAN**). main HEAD = `db7797a` (53차 §3 PR #8 mergeCommit). 본 branch HEAD/count는 §8.1 verification block로 확인 (omxy R7 Option A generic 박제 유지) |
| HEAD commit | 53차 §4 종료 시점 = HANDOFF 박제 commit. 정확 hash = `git rev-parse --short HEAD` |
| Mock Skeleton | ✅ S0~S6 · Must 19/19 mock 동작 |
| DQ-7 Admin Credential | 🟢 ~97% · Smoke #4/#5 + Session 4 QA 잔여 · Smoke #3(Binance)은 S8까지 유예 |
| S7e Supabase 실 I/O | 🟢 **7/8 완료** · T7e.1~T7e.6 ✅ + T7e.8 ✅ · T7e.7 RLS QA 잔여 |
| S7a (49차 ✅ + 50차 §1 B-17 ✅ + 51차 PR #1 MERGED ✅) | 🟢 **완료** (S7a Anthropic wrapper main 박제). 본격 호출은 §3 B-6 billing 충전 후. |
| **Tier 2 D21 (52차 SoT + impl, 53차 §1 MERGED + §2 builder + §3 MERGED + §4 caller wiring)** | 🟢 **scaffold + production schema + builder + 207 persona Kevin v3.1 quality 본문 모두 main에 박제 + Step 3c admin caller wiring PR OPEN**. canonical 14 sectors × 14 personas/sector overlay (10 base + 2 primary + 2 sub_tag) + sub_tag crosswalk 7개 + `commit_sector_personas` RPC + Kevin v3.1 rubric inject + **admin server action Tier 2 branch + `shouldRunTier2` cost gate + `Tier2Counters` 5-field partition** (PR #9 OPEN). cron route + UI Section8View 변경 0 (PR #9 scope). |
| **Kevin v3.1 quality target = 코드 박제 완료** | 📌 사용자 명시 목표 "어떤 기업이 선정되어도 Kevin reference 정도 quality" — 53차 §3 Layer (a~g)에서 **207 persona × 8 markers = 1656 marker assertions 전수 통과** + persona individuality wrapper + 회사명 invariant grep 0 + 28 manual review sample fixture. 코드 SoT = `tudal/src/lib/ai/prompts/kevin-v31-rubric.ts` + `personas/sector-persona-builder.ts` + `personas/index.ts`. 참조 자료 = `Document/Outputs/Report-Alteogen_196170_v3-Readable.{md,html}` + `Service/Report/ReportFramework-v3-{DraftPhilosophy,NarrativeDesign,Decisions,ValuationTrial}.md` + `ReaderAnalogyCards-ConstructionToBio.md` (main 보존 유지). |
| OPEN PRs (53차 §4 시점) | **#2** OPEN CONFLICTING: `fix/s7a-format-error-inventory` (format-error 13 신규 매핑, 보류 유지) + **#9** OPEN MERGEABLE CLEAN: `feat/tier2-caller-wiring` (Step 3c admin action Tier 2 branch + 8 tests). PR #8 (53차 §3 Step 3b) 머지 완료 (mergeCommit `db7797a`). |
| 실 AI 호출 | 0 · billing 미충전 (사용자가 Step 5 smoke 직전 충전 명시) |
| Production deploy | Vercel `https://tudal-tawny.vercel.app` (origin/main HEAD `db7797a`) · 53차 §3 PR #8 머지 후 canary `/` 200, `/login` 200, `/macro` 200, `/admin` 307 (auth redirect, expected) |
| Supabase | project `rbrpcynhphrpljbjirfo` · 0001~0019 production 적용 완료. 19 migrations 총. 53차 §3+§4 마이그 변경 0 (Step 3b/3c는 production code only). |
| 검증 게이트 (53차 §4 종료) | build OK 25 routes · lint 0 errors 6 warnings (pre-existing) · **test:ci 699 / 66** (PR #8 baseline 691 → **+8 신규 Step 3c tests**) · tsc clean · 회사명 production grep 0 match (50+ tokens) |
| omxy debate 누적 | **135 rounds CONVERGED (53차 §4 +7 rounds, Step 3c 8 BLOCKERS catch & fix)** = Step 3c D4 R1~R4 (4 rounds, 4 R1 + 4 R2 stale BLOCKERS) + Step 3c final R1 (1 round CONVERGED) + push/PR sequence R1~R2 (2 rounds, 3 BLOCKERS catch) + 53차 §3 종료 시점 128. 적대적 검토 + SDD 2-stage (spec compliance + code quality reviewer subagents) = 본 PR 운영 원칙. Step 4 이후 동일 강제 적용. |

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

### §2.1 Step matrix (53차 §3 종료 시점 — 현재 위치 = **Step 3b ✅ DONE (branch `feat/tier2-step3b-prompts-196` PR #8 OPEN)** + **Step 1c = ✅ DONE (53차 §1)** + **Step 3a = SKIPPED (53차 §0 박제)** + Step 3c 진입 게이트 = PR #8 USER 머지 후)

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
| **3b** ✅ DONE (53차 §2 PR #7 MERGED + 53차 §3 PR #8 OPEN — 207 persona Kevin v3.1 quality 본문 완성) | **CLAUDE** | (53차 §2) branch `feat/tier2-production-prompts` PR #7 MERGED `02c7947a` (Layer §1 builder 11 commits FF). (53차 §3) branch `feat/tier2-step3b-prompts-196` Layer (a~g) 6+3 sub-step 작성 — omxy 120 → 125 rounds CONVERGED (마무리 R1~R3 + Final R1~R4 포함, 18 BLOCKERS total catch & fix). 정확 HEAD = `git rev-parse --short HEAD`로 확인. | (해소 — PR #8 OPEN MERGEABLE CLEAN, USER review/merge 대기) | branch push 완료. **PR #8 OPEN MERGEABLE CLEAN**: https://github.com/son00326/New_Project_KR_Stock/pull/8. merge = USER. | 207 personas (Core 11 + Tier 2 sector 196) × 8 Kevin v3.1 quality markers (M1~M8) inject + persona individuality wrapper + 회사명 invariant grep 0 (50+ tokens) + 28 manual review sample fixture. 신규 SoT = `kevin-v31-rubric.ts` (4 axes + 8 markers + applyKevinV31Rubric helper) + sector-persona-builder.ts 확장 (SECTOR_PHILOSOPHIES 14 4 anchor + BASE_SLOT_PRINCIPLES 10 재무 확인 + PRIMARY_OVERLAY_PRINCIPLES 28 + SUB_TAG_OVERLAY_PRINCIPLES 14 + ADJUSTMENTS 회사명 cleanup) + index.ts wrapping. Tests: **691/65** (+41 over PR #7 baseline 650). | Step 3c |
| **3c** ✅ IMPLEMENTED / PR OPEN / USER REVIEW+MERGE PENDING (53차 §4) | ~~CLAUDE~~→USER | ~~Step 3b merge 후~~ DONE | — | branch `feat/tier2-caller-wiring` @ HEAD (§8.1 verification) · **PR #9 OPEN MERGEABLE CLEAN**: https://github.com/son00326/New_Project_KR_Stock/pull/9 · push 완료, USER review/merge 대기 | (i) admin server action `triggerMonthlyPersonaEvalAction` Tier 2 branch + `shouldRunTier2` cost gate + `Tier2Counters` 5-field partition + `isCanonicalSector` type guard + `sub_tags` strict guard + backward-compatible additive return ✅ (ii) cron monthly-batch + UI Section8View 변경 0 박제 (Section8View 이미 sector votes 렌더링 코드 보유) · omxy 7 rounds CONVERGED + SDD 2-stage ALL PASS | Step 4 trigger 가능 (USER PR #9 merge 후) |
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
| ~~B-17e~~ ✅ DONE (53차 §3) | ~~사용자 PR #7 (Step 3b §1+§5+§6 sector-persona-builder dynamic resolution) review/merge~~ MERGED 53차 §3 (mergeCommit `02c7947a`, 11 commits FF). Vercel production canary 4/4 OK. | ✅ |
| ~~B-17f~~ ✅ DONE (53차 §3 omxy R3 sequence + 53차 §4 entry post merge) | ~~사용자 PR #8 (Step 3b) review/merge~~ MERGED 53차 §3 sequence (mergeCommit `db7797a`, main fast-forward 29 commits). Vercel production canary 4/4 OK. | ✅ |
| **B-17g ⭐최우선** | **사용자 PR #9 (Step 3c Tier 2 caller wiring + 8 tests) review/merge** | (1) `gh pr view 9` 검토 + Vercel preview Ready 확인 → (2) `gh pr merge 9 --rebase` (53차 §1/§3과 동일 rebase 패턴) → (3) origin/main 갱신 후 Vercel production auto-deploy 확인 (canary `/`200·`/login`200·`/macro`200·`/admin`307). | **Step 4 (Reflection 자가학습) 진입 게이트** |
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

상세는 git log + spec/plan/Slice 파일. 직전 항목 (**53차 §4 Step 3c Tier 2 caller wiring** → 53차 §3 Step 3b 본문 완성 → 53차 §2 Step 3b builder → 53차 §1 머지+마이그-apply → 53차 §0 stale-fix → 52차 Tier 2 SoT + impl PR → 51차 PR #1 머지 + Tier 2 brainstorm → 50차 §1 B-17 EXECUTED 순):

- **53차 §4 Step 3c Tier 2 caller wiring (branch `feat/tier2-caller-wiring`, PR #9 OPEN, 2026-05-21)**:
  - **scope**: 사용자 명시 트리거 "응 omxy랑 확인해서 진행" SHARED 위임. 53차 §3 PR #8 머지 후 main `db7797a` 기준 새 branch. 52차 박제 `runSectorEval` + `commitSectorReport` scaffold를 실제 admin server action에 wire (export-only → production caller). real LLM call은 새로 열지 않음 (billing/B-6 충전 전까지 "wired but counter-backed skip").
  - **선택 방법론**: Subagent-Driven Development skill (parent skill invocation FIRST + Subagent 3-stage: implementer + spec compliance reviewer + code quality reviewer) + omxy cmux pair-debate cross-model adversarial review.
  - **omxy D4 R1~R4 4 rounds CONVERGED (11 BLOCKERS catch & fix across rounds)**:
    - R1 4 BLOCKERS: (1) silent no-op vs counter-backed skip (Tier2Counters interface 도입) / (2) sub_tags cast 불안전 (Array.isArray + string filter strict guard) / (3) sector enum guard `isCanonicalSector` type guard (cast+includes 폐기, NULL/undefined/non-canonical typeof+type-guard 차단) / (4) `shouldRunTier2` exported (단위 test 직접 가능)
    - R2 4 stale BLOCKERS: (1) `+5 tests` → `+8 tests` 정정 (test count drift) / (2) `silent skip` → `counter-backed skip` + `sector enum guard (CANONICAL_SECTORS includes)` → `isCanonicalSector` (banned wording 잔존) / (3) `skippedEnv` → `skippedGate` rename (semantic overload, env+badge ⚪ coalesced 명시) / (4) return contract backward-compatible additive 명시
    - R3 3 minimal BLOCKERS: (1) spec line 216 stale (`import CANONICAL_SECTORS` + `(5 test cases)` 잔존) / (2) verification `4 sub-asserts` → `5 sub-asserts` (🔵 case 추가 후 stale) / (3) Test 8 happy path pattern check 추가 (`^sector-<sector>-slot-(1[0-4]|[1-9])(-subtag-.+)?$` regex + sub_tag matched fixture)
    - R4 CONVERGED — "Implementer dispatch is approved under the locked spec/plan"
  - **Implementer subagent (general-purpose)** DONE — `f57dac5` feat + `038b6a9` fix (TS narrowing 18048 10건 → `assertOk` type-assertion helper)
  - **Spec compliance reviewer subagent** ✅ Spec compliant — R1~R4 override + 8 test cases line-by-line verified
  - **Code quality reviewer subagent** Approved with fixes — Important 4 모두 `37af094`로 fix:
    - I1: `expect(result.ok).toBe(true)` + `assertOk(result)` 중복 8 loci 정리 (assertOk만 잔존)
    - I2: `expectTier2Partition` helper + 6 ok=true test partition invariant (`attempted === committed + skippedSector + skippedUnavailable`)
    - I3: Test 6 4-case parameterized loop (string/object/number/boolean — jsonb malformed)
    - I4: `shouldRunTier2` strict 'true' literal 코멘트 박제 (`'TRUE'/'1'/'yes'` 비활성)
  - **omxy final R1 (post-commit)** CONVERGED — "추가 BLOCKER 0. PR 생성 진행 가능. SDD 2-stage + omxy final로 충분, 새 회귀 못 찾음."
  - **omxy push/PR sequence R1~R2 2 rounds CONVERGED (3 BLOCKERS catch)**:
    - R1 3 BLOCKERS: (1) PR create 후 HANDOFF commit이면 PR body stale (sequence 재정렬 — push→PR create→HANDOFF commit→push→gh pr edit --body 갱신) / (2) Step 3c status wording `DONE` 단독 부정확 → `IMPLEMENTED / PR OPEN / USER REVIEW+MERGE PENDING` / (3) pre-push assert 누락 (`git status --short` clean + `git ls-remote --heads origin` 0건 collision check)
    - R2 CONVERGED — 8-step sequence locked + 5 stop conditions
  - **신규 SoT 코드**: `tudal/src/app/(admin)/admin/track-record/actions.ts` (+147 / -20) — exported `shouldRunTier2` + `Tier2Counters` interface + `TriggerMonthlyPersonaEvalActionResult` discriminated union + Tier 2 branch + lifted `fetchFinancials` + additive return. **신규 test file**: `actions.test.ts` (443L NEW) — 8 cases.
  - **PHASE A/B/C 실행 결과**:
    - A1 pre-push assert: git status clean + collision 0 + PR #2 intersection 0 ✓
    - A2 push: HEAD `37af094`, fast-forward (신규 branch)
    - B1 PR create: PR #9 OPEN, https://github.com/son00326/New_Project_KR_Stock/pull/9
    - B2 state polling: UNKNOWN → CLEAN
  - **branch state (53차 §4 종료 시점)**: `feat/tier2-caller-wiring` (main `db7797a` 기준 3 implementer commits + HANDOFF 박제 commit, push 완료, **PR #9 OPEN MERGEABLE CLEAN**)
  - **검증 게이트 (53차 §4 종료)**: build OK 25 routes / lint 0 err 6 warn (pre-existing baseline) / **test:ci 699 passed / 66 files** (PR #8 baseline 691 → +8 신규) / tsc clean / production company grep 0 매치 / PR #8 baseline + 4 files changed (+1100/-20)
  - **omxy debate 누적**: 53차 §3 종료 128 → §4 종료 **135 rounds CONVERGED** (+7 rounds, 11 BLOCKERS catch & fix during round iteration → 최종 fix 적용 BLOCKERS 8건 production code/test에 반영)
  - **다음 1순위 (53차 §4+)**: USER PR #9 review/merge (B-17g) → Step 4 CLAUDE Reflection 자가학습 (reflection_log 마이그 + Tier 1 context 주입 + tests) → Step 5 USER billing 충전 (B-6) → Step 6 CLAUDE billing-on smoke

- **53차 §3 Step 3b 207 persona Kevin v3.1 quality 본문 작성 + Layer (a~g) ALL CONVERGED (branch `feat/tier2-step3b-prompts-196`, 2026-05-21)**:
  - **scope**: 사용자 명시 목표 = "어떤 기업이 선정되어도 Kevin v3.1 reference 정도 quality". Core 11 + Tier 2 sector 196 = 207 persona system prompt에 Kevin v3.1 inquiry pattern microstructure 일관 적용. omxy R3 lock-in 5단계 runbook (rubric SoT → philosophies → base → primary → sub_tag → Core 11 → cleanup) 실행.
  - **branch state (53차 §3 종료 시점)**: `feat/tier2-step3b-prompts-196` (main `02c7947` 기준 20 commits ahead, HEAD `dcc12b1`).
  - **신규 SoT 코드**:
    · `tudal/src/lib/ai/prompts/kevin-v31-rubric.ts` (Layer a): 4 inquiry axes + 8 quality markers (M1~M8) + KEVIN_V31_RUBRIC_INSTRUCTION + applyKevinV31Rubric(corePrincipleText, sectorContext?) helper. persona individuality wrapper 원칙 박제.
    · `tudal/src/lib/ai/prompts/personas/sector-persona-builder.ts` 확장: SECTOR_PHILOSOPHIES 14 (4 anchor) + BASE_SLOT_PRINCIPLES 10 (재무 확인 label) + PRIMARY_OVERLAY_PRINCIPLES 28 (신규) + SUB_TAG_OVERLAY_PRINCIPLES 14 (신규) + SECTOR_BASE_SLOT_ADJUSTMENTS 회사명 cleanup (19 entries) + KEVIN_V31_TONE_RULES 폐기 + applyKevinV31Rubric 경유 전환
    · `tudal/src/lib/ai/prompts/personas/index.ts` (Layer f): Core 11 wrapping helper (11 persona 파일 unchanged)
  - **신규 docs**: `docs/superpowers/specs/2026-05-21-kevin-v31-rubric.md` (rationale only) + `docs/superpowers/snapshots/2026-05-21-step3b-prompt-samples.md` (28 manual review fixture)
  - **omxy 적대적 검토**: **128 rounds CONVERGED** (53차 §2 종료 85 → §3 종료 128, +43 rounds, 22 BLOCKERS catch & fix). Layer별 R1~R3 (Layer a/f 3 rounds, b/c/d/e/g step 2/g step 3 2 rounds, g step 1 1 round) + 마무리 박제 R1~R3 + **Final omxy R1~R3 (PR #8 머지 직전 적대적 self-review)**.
  - **Final omxy R1~R3 박제 (PR #8 머지 직전, branch HEAD efc38d5 → b2b32cf, 4 docs hygiene BLOCKERS catch)**:
    - R1 3 BLOCKERS: (B1) `kevin-v31-rubric.ts:31` 코멘트가 nonexistent `persona-rubric-coverage.test.ts` 참조 / (B2) spec md:123-126 동일 stale path + forward-looking 어휘 / (B3) snapshot md:16 `npx vitest -t "samples spot-check"` helper command가 존재하지 않는 test title (operator copy-paste false-fail). fix commit `ea8d27b` → CI 위치 코멘트 정정 + 실제 위치 sector-persona-builder.test.ts 명시 + helper command를 `npx tsx -e "import resolveSectorPersona ..."` API 직접 호출 패턴 + disclaimer 박제.
    - R2 1 BLOCKER: snapshot md helper script가 "28 samples 한번에 dump" claim하지만 ids array 6 IDs + `// ... 28 samples matrix는 아래 표 참조` 코멘트 → operator copy-paste 시 6 prompts만 review하면서 28-sample dump 완료로 오해 (false-coverage). fix commit `b2b32cf` → 14 sectors × 2 = 28 IDs 전체 박제 + `ids.length !== 28` self-check 추가 (sub_tag matched case `sector-운송/물류-slot-13-subtag-조선` 포함).
    - R3 SIGNAL: **CONVERGED** — "PR #8 is mergeable from this review's scope; Step 3c/Step 4/PR #2 remain OOS". Fresh verification: HEAD b2b32cf / PR #8 mergeStateStatus CLEAN / build OK 25 routes / lint 0 err 6 warn / test:ci 691·65 / tsc clean / production company grep 0 / snapshot ids 28 unique.
  - **검증 게이트 (53차 §3 종료, post-Final-R1+R2 b2b32cf baseline)**: build 25 routes / lint 0 err 6 warn / **test:ci 65 files / 691 tests** (PR #7 baseline 650 → +41 신규) / tsc clean / production company grep 0 / snapshot 28 IDs unique
  - **207 persona total 검증 통과**: Core 11 (Layer f 4 tests) + sector 196 (Layer g step 2 4 tests) + sub_tag matched 14 smoke (Layer g step 2 R1) + 회사명 invariant 50+ tokens grep 0 + 196 × 8 markers = 1568 marker assertions + Core 11 × 8 = 88 = 1656 marker assertions 전수 통과
  - **다음 1순위 (53차 §3+)**: USER PR #8 merge (gh pr merge 8 --rebase, omxy R3 CONVERGED = merge OK) → Step 3c CLAUDE caller wiring (cron mock dry-run 폐기 + admin server action Tier 2 branch + Section 8 partA UI render) → Step 4 Reflection.

- **53차 §2 Step 3b §1 builder + §5 fanout 완성 (branch `feat/tier2-production-prompts`, 2026-05-21)**:
  - **scope**: 사용자 "진입 — 196 prompts 자동 작성 시작" + "3b 6 끝날때까지는 omxy랑의 대화 멈추지 말고 계속 진행해" 트리거. Step 3b §1~§6 omxy iterate CONVERGED까지 자동 진행.
  - **omxy R1~R8 8 rounds CONVERGED (18+ BLOCKERS catch — 사용자 "omxy랑도 제대로 확인한거야?" catch가 R5/R6/R7 catalysts, R8 = "STOP omxy debate loop here" 최종 CONVERGED)**:
    - R1 5 BLOCKERS: (1) malformed personaId silent accept (slot 1~12 + subtag suffix / unknown subtag) / (2) cross-sector subtag mismatch (예: 바이오-조선) silent accept / (3) base slot depth too generic (global_industry_veteran + 바이오 = generic supply chain) / (4) Kevin v3.1 overpromise (200자에서 DCF/Half Kelly 재현 불가, "quality target" → "inquiry pattern") / (5) tests=coverage-not-invariants
    - R2 3 NEW BLOCKERS: (A) Partial<Record<string,string>> 키 타입 loose (typo silent drop) / (B) "9 unfilled sectors fallback" test가 incompleteness를 expected behavior로 freeze (PR reviewer가 intentional로 오인) / (C) buildSectorPersonaContract direct call에서 cross-sector mismatch silent accept
    - R3 1 NEW BLOCKER + 답변 (f): (D) resolveSlotTemplate이 SUB_TAG_OVERLAY_ROLES in-check만 하고 sector compatibility 미검증 → `runSectorEval({sector:'바이오', sub_tags:['조선']})` invalid personaId 발급 / (f) sub_tag validity 로직 2곳 duplicate → drift 위험, shared helper 권고
    - R4 CONVERGED-track: 모든 BLOCKERS fix 검증 + polish 3 items noted (Kevin v3.1 코멘트 wording / 2차전지 polysilicon / 자동차 덴소 / 바이오 imminent BLA)
    - R5 3 final-state BLOCKERS catch (사용자 catalyst): (1) "quality target" 코멘트 line 9/81 잔존 (R5 grep 기대 0 fail) / (2) commit count drift (docs "5 commits" actual 6) / (3) docs stale post-PR-create (HANDOFF/Dashboard "PR create 진행 중" but PR #7 OPEN MERGEABLE 존재). 모두 fix 후 R5 CONVERGED-track.
    - R6 3 recursive-drift BLOCKERS catch: (1) HEAD `139c954`→`740eccb` shifted / (2) commits 6→7 / (3) §6 stale 어휘 + PR #7 mergeStateStatus UNKNOWN polling 필요. 모두 fix 후 R6 CONVERGED-track. 그러나 R6 fix commit 자체가 또 drift 발생 (740eccb→b7ff297, 7→8).
    - R7 inherent recursive-drift 패턴 escalation — Option A 권고: current-state docs에 exact HEAD/count 사용 금지, verification command block 도입. Historical entries (frozen state)는 hardcoded OK. Option A 적용 commit `ec79471` push.
    - R8 final verification: Option A 패턴이 inherent drift 해결 확인 + PR #7 mergeStateStatus=CLEAN @ HEAD `ec79471` 확인 + "**Stop the omxy debate loop here**" 최종 SIGNAL: CONVERGED.
    - Non-blocking: 53차 이전 historical 행에 "Kevin v3.1 quality target" 어휘 잔존 (frozen historical OK 박제).
  - **구현 결과 (3 commits + polish)**:
    - `df8ef0e` (53차 §1 박제 docs first commit) → builder phase 진입 시 context handoff 안전 확보
    - `d666e3b` Step 3b §1 builder: sector-persona-builder.ts (330 lines) + tests (180 lines) — 14 SECTOR_PHILOSOPHIES + 10 BASE_SLOT_PRINCIPLES + KEVIN_V31_TONE_RULES + buildSectorPersonaContract + parseSectorPersonaId + resolveSectorPersona + generateAllSectorPersonas + getPersonaById dynamic fallback + runSectorEval sub_tag personaId encoding
    - `e81ba07` R1 5 BLOCKERS fix: parseSectorPersonaId validation 강화 + SECTOR_BASE_SLOT_ADJUSTMENTS 5 prototype sectors × 4 high-risk slots = 20 adjustments + KEVIN_V31_TONE_RULES "inquiry pattern" reframing + +10 invariant tests
    - `c57c9cc` R2 3 BLOCKERS fix + §5 fanout: BaseSlotRole type-tight + 9 sectors 추가 = 14 × 4 = 56 adjustments full coverage + buildSectorPersonaContract throw guard (unknown_sub_tag + sub_tag_sector_mismatch) + +4 tests
    - `2b4904c` R3 BLOCKER D + 답변 f fix: canonical-sectors.ts isSubTagAllowedForSector shared SoT export + resolveSlotTemplate sector compatibility 통합 + builder duplicate guard 제거 + +8 tests (canonical-sectors.test.ts)
    - polish (R4): top comment "quality target" → "inquiry pattern follow" + 바이오 imminent BLA biologics-bias 수정 + 자동차 덴소 (foreign) 제거 + 2차전지 polysilicon (solar-adjacent) 제거 + 리튬/니켈/코발트 + 재활용 추가
  - **검증 게이트 (53차 §2 종료, 모든 commit baseline)**: build 25 routes OK · lint 0 errors 6 warnings (pre-existing) · **test:ci 650 / 64 files** (+44 over 53차 §1 main 606: §1 builder +22 / R1 invariant +10 / R2+§5 +4 / R3 isSubTagAllowedForSector +8) · tsc clean
  - **omxy debate**: 77 → **81 rounds CONVERGED** (53차 §2 R1~R4 = 4 rounds, 9 BLOCKERS catch)
  - **다음 1순위 (53차 §2 종료 시점)**: **PR #7 OPEN** at https://github.com/son00326/New_Project_KR_Stock/pull/7 (정확 HEAD/count는 `git rev-parse --short HEAD` + `git rev-list --count main..HEAD`로 확인) → USER review/merge → Step 3c caller wiring (cron mock dry-run 폐기 + admin server action Tier 2 branch + Section 8 partA UI render) → Step 4 Reflection

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
  R4 CONVERGED-track (BLOCKER D fix + shared SoT consolidation + polish 3 items noted)                                                    1 round   CONVERGED-track
  R5 3 final-state BLOCKERS (사용자 catch가 catalyst — "quality target" 코멘트 잔존 + commit count drift 5→6 + docs stale post-PR-create) 1 round   CONVERGED-track
  R6 3 recursive-drift BLOCKERS (HEAD 139c954→740eccb / commits 6→7 / §6 stale 어휘 / PR #7 mergeability UNKNOWN polling 필요)            1 round   CONVERGED-track
  R7 inherent recursive-drift escalation (Option A generic reference 권고 — current-state docs에 exact HEAD/count 사용 금지, verification command block 도입) 1 round   CONVERGED-track
  R8 Option A 적용 verification + 최종 CONVERGED (PR #7 CLEAN at HEAD ec79471, "Stop the omxy debate loop here" 명시)                       1 round   CONVERGED
─────────────────────────────────────────────
                                          8 rounds  CONVERGED (53차 §2)

총 누적 (CONVERGED only — §2 종료):       85 rounds  CONVERGED (53차 §2 Step 3b 종료 시점, 안정)

53차 §3 Step 3b 207 persona Kevin v3.1 quality 본문 + Layer (a~g) 6+3 sub-step + 마무리 박제:
  Layer (a) Kevin rubric SoT R1~R3 (3 BLOCKERS)              3 rounds  CONVERGED
  Layer (b) SECTOR_PHILOSOPHIES 14 R1~R2 (3 BLOCKERS)        2 rounds  CONVERGED
  Layer (c) BASE_SLOT_PRINCIPLES 10 R1~R2 (1 BLOCKER)        2 rounds  CONVERGED
  Layer (d) PRIMARY_OVERLAY 28 R1~R2 (2 BLOCKERS)            2 rounds  CONVERGED
  Layer (e) SUB_TAG_OVERLAY 14 R1~R2 (2 BLOCKERS)            2 rounds  CONVERGED
  Layer (f) Core 11 inject R1~R3 (2 BLOCKERS)                3 rounds  CONVERGED
  Layer (g) Step 1 builder cleanup R1 (0 BLOCKERS)           1 round   CONVERGED
  Layer (g) Step 2 196 coverage R1~R2 (2 BLOCKERS + 1 claim) 2 rounds  CONVERGED
  Layer (g) Step 3 ADJUSTMENTS cleanup R1~R2 (1 BLOCKER)     2 rounds  CONVERGED
  마무리 박제 R1~R3 (2 BLOCKERS: PR state + 16 buckets)      3 rounds  CONVERGED
  Final omxy R1 (full main..HEAD release-readiness)          1 round   CONTINUE→CONVERGED-track (3 docs/comment stale ref BLOCKERS — nonexistent persona-rubric-coverage.test.ts ×2 + fake -t "samples spot-check" helper)
  Final omxy R2 (R1 fix 검증)                                 1 round   CONTINUE→CONVERGED-track (1 BLOCKER — snapshot helper ids array 6 IDs claimed as 28, false-coverage)
  Final omxy R3 (R2 fix 검증)                                 1 round   CONVERGED ("PR #8 is mergeable from this review's scope; Step 3c/Step 4/PR #2 remain OOS")
─────────────────────────────────────────────
                                        25 rounds  CONVERGED (53차 §3, 22 BLOCKERS total catch & fix — Layer 16 + 마무리 2 + Final 4)

총 누적 (CONVERGED only — §3 종료):       128 rounds  CONVERGED (53차 §3 종료 + Final omxy R1~R3 docs hygiene 4 BLOCKERS catch & fix, PR #8 mergeable evidence 박제)

53차 §4 Step 3c Tier 2 caller wiring (admin action branch + shouldRunTier2 + Tier2Counters + 8 tests):
  D4 R1 (spec/plan adversarial review)   4 BLOCKERS catch  1 round   CONTINUE→CONVERGED-track
  D4 R2 (R1 fix 검증 + 4 stale BLOCKERS) 4 BLOCKERS catch  1 round   CONTINUE→CONVERGED-track
  D4 R3 (R2 fix 검증 + 3 minimal BLOCKERS) 3 BLOCKERS catch 1 round  CONTINUE→CONVERGED-track
  D4 R4 (R3 fix 검증)                                       1 round   CONVERGED
  Final R1 (post-implementer + SDD 2-stage 후 적대적 검토) 1 round   CONVERGED (추가 BLOCKER 0)
  Push/PR sequence R1 (3 BLOCKERS catch)                   1 round   CONTINUE→CONVERGED-track
  Push/PR sequence R2 (R1 정정 검증, 8-step locked)        1 round   CONVERGED
─────────────────────────────────────────────
                                          7 rounds  CONVERGED (53차 §4, 8 BLOCKERS catch & fix)

총 누적 (CONVERGED only):                135 rounds  CONVERGED (53차 §4 Step 3c implementer + SDD 2-stage + omxy final + push/PR sequence, PR #9 OPEN MERGEABLE CLEAN 박제)
```

---

## 8. 다음 세션 진입자 자동 진행 체크리스트

### §8.1 현재 위치 확인 (자동 실행 1회) — omxy R7 권고 Option A generic verification block

```bash
# 정확 branch state (HEAD/count는 매 push마다 변동 — docs에 hardcoded 박제 회피)
git rev-parse --abbrev-ref HEAD                   # 53차 §3 종료 = feat/tier2-step3b-prompts-196 (또는 후속 branch)
git rev-parse --short HEAD                        # 본 commit hash
git rev-list --count main..HEAD                   # 본 branch commits count
git log --oneline main..HEAD | head -40           # 본 branch commit history (df8ef0e first commit 시작)

# PR state (mergeStateStatus 매 push마다 재계산 — polling으로 CLEAN/UNSTABLE 확인)
gh pr list --state open --json number,title,headRefName,mergeable
gh pr view 8 --json baseRefName,headRefOid,mergeStateStatus  # PR #7은 53차 §3 머지 완료 (historical)

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
  - ~~Step 3b (production prompts 196) → `feat/tier2-production-prompts` / `feat/tier2-step3b-prompts-196`~~ ✅ DONE (53차 §2 PR #7 MERGED + 53차 §3 PR #8 OPEN)
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
- [x] ~~**Step 3b 진입 시**~~ ✅ DONE (53차 §3): main 보존 Kevin reference 자료 분석 → 207 persona system prompt 박제 완료 (`@/lib/ai/prompts/kevin-v31-rubric.ts` + `@/lib/ai/prompts/personas/sector-persona-builder.ts` 확장 + `personas/index.ts` Core 11 wrapping). 207 × 8 markers = 1656 assertions 전수 통과.
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
- **📌 Tier 2 production prompts quality target = Kevin v3.1 reference 코드 박제 완료 (53차 §3, PR #8 OPEN [[handoff_kevin_v31_quality_target]])**: 53차 §3 Layer (a~g)에서 207 persona system prompt에 Kevin v3.1 inquiry pattern microstructure 적용 완료 — `kevin-v31-rubric.ts` (4 inquiry axes + 8 markers M1~M8 + applyKevinV31Rubric wrapper + persona individuality) + `sector-persona-builder.ts` 확장 + `personas/index.ts` Core 11 wrapping. 207 × 8 markers = 1656 marker assertions 전수 통과. 회사명 50+ tokens grep 0. 28 manual review sample fixture. Reference 자료 (main 보존, 53차 §0 박제로 IMVCOM 4 commits 모두 main ancestor): `Document/Outputs/Report-Alteogen_196170_v3-Readable.{md,html}` + `Document/Service/Report/ReportFramework-v3-{DraftPhilosophy,NarrativeDesign,Decisions,ValuationTrial}.md` + `ReaderAnalogyCards-ConstructionToBio.md` + Samchundang. **다음 = PR #8 merge → Step 3c caller wiring**. 자세한 SoT pointer = §5 표 + ServicePlan-Admin §1A.5 D22.
- **HANDOFF.md 다음 세션 자동 진행 가능 조건**: header (5줄 요약) + §1 + §2 + §8 모두 stale 0. 본 53차 §3 종료 시점 omxy 125 rounds CONVERGED 누적 (Layer a~g + 마무리 + Final R1~R2) + 18 BLOCKERS catch & fix + branch `feat/tier2-step3b-prompts-196` (push 완료, **PR #8 OPEN MERGEABLE CLEAN**) + Runbook 현재 위치 = **Step 3b ✅ DONE (PR #8 USER review/merge 대기)** → **Step 3c (caller wiring) 진입 게이트 = PR #8 머지 후** + Step 1c/3a/3b/B-17c/B-17e 모두 해소. PR #2 + PR #8 = 2건 OPEN. **Production canary 4/4 PASS** (`/`200·`/login`200·`/macro`200·`/admin`307 + Location: `/login?next=%2Fadmin`).
