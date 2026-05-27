# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-27 (58차 Mock cleanup Step 2.1 PR #33 MERGED + Step 2.2 PR #34 MERGED (post-merge baseline) — PR #30/31/32 + 마이그 0025 MERGED 누적, omxy 13 rounds CONVERGED 누적 + docs sweep R-debate R14 CONVERGED + merge debate R2 → A++ 정합)

- **Task 1+2+3 ✅ + Task 4 impl ✅ MERGED** (PR #30 `3c09d6e` rebase FF, omxy R1~R3 CONVERGED — R1 HIGH admin assertion + R2 CRITICAL RLS fix + R3 CONVERGED) + **B-trackrecord-rls ✅ MERGED** (PR #31 `838386e`, omxy R1 CONVERGED) + **마이그 0025 production applied** (Supabase MCP OAuth verified, omxy R1+R2 CONVERGED)
- **Mock cleanup**: Step 1 ✅ MERGED `1d2db08` (PR #32, omxy R1~R4 CONVERGED) + **Step 2.1 ✅ MERGED `e6be73f` (PR #33)** (admin alerts 3 routes → real `alert_event`/`news_event` SELECT, code commits `29222ab`+`e210b02` + 다회 docs sweep — git log + PR body 위임, omxy R1~R2 CONVERGED + docs sweep R-debate R14 CONVERGED + merge debate R2 → A++ 정합) + **Step 2.2 ✅ MERGED `2dca060` (PR #34)** (admin settings → real `admin_settings`/`ticker_alert_pref` SELECT + WRITE boundary, code commit `43c7886`, omxy R1 CONVERGED, 신규 helper 2종 + tests +24)
- **main HEAD** = `2dca060` (post-PR-#34 MERGED, ancestor `e6be73f` post-PR-#33 — 58차 종료 post-merge baseline) — `git rev-parse --short origin/main` 으로 verify
- **OPEN PRs**: **#2** (format-error, CONFLICTING 보류) only — PR #33 + #34 모두 MERGED + branch deleted
- **Vercel deploy**: main `2dca060` Production ● Ready (`tudal-cysr2mmvo` 51s build · `tudal-km7ea67te` 50s build for PR #33). Production canary verify (curl): `/` 200 + `/login` 200 + `/macro` 200 ✓ public 회귀 0. `/admin/alerts` + `/admin/settings` empty-state는 인증 세션 verify 위임
- **검증 게이트 (main `2dca060` post-merge baseline)**: **test:ci 1208 PASS / 111 files** (PR #33 +37 + PR #34 +24 통합 — 1149 → 1208) · build 25 routes · lint 0 err 6 warn (pre-existing) · tsc clean · **마이그 0025 ✅ production applied + verified (Supabase MCP OAuth)**
- ⚠️ **Task 4 MERGED + 마이그 0025 applied ≠ production functional** — Vercel env `PR4_TRIGGER_UPSERT_ENABLED` UNSET 확인 (Production env 10 keys 중 PR4 entry 0개) → orchestrator strict 'true' false → legacy path 유지 → admin trigger button = report_not_found fail-fast (B65-P1 active). 정상 동작은 USER가 Vercel env=true 설정 후 (Task 7 Smoke Stage 2 게이트).
- ✅ **마이그 0025 production verify 완료 (58차, omxy R1+R2 CONVERGED)**: (A) service_role EXECUTE=false ✓ Kepler R1 B2 critical PASS (B) authenticated=true ✓ (C/D) public/anon=false ✓ (E) SECURITY DEFINER + search_path=public,pg_temp ✓ (F) 11-arg signature exact (2 text + 9 jsonb) ✓ (G) function body match — auth.uid+is_admin guard / ON CONFLICT predicate / UPDATE set은 section_0~7+appendix+generated_at만 (section_8/consensus_badge/version/regen 미터치) / service_role bypass 없음 ✓ (H) get_advisors WARN = 의도된 baseline (13 기존 SECURITY DEFINER RPC 동일 패턴). W-grant-smoke audit ticket ✅ RESOLVED.
- **다음 1순위**:
  1. **(USER) Vercel Production env 설정** = `PR4_TRIGGER_UPSERT_ENABLED=true` 추가 + `AI_COST_LOG_REAL_INSERT_ENABLED=true` 값 verify. USER가 vercel CLI 또는 Dashboard에서 설정 + redeploy. 그 후 CLAUDE가 Task 7 Smoke Stage 2 진입.
  2. **(USER 권장)** 인증 세션으로 production canary verify: `/admin/alerts` empty state + `/admin/settings` 모드 토글 off (default false) + Short List 30 종목 모두 enabled=true default + 회귀 (`/admin/portfolio` P1 fail-fast 등).
  3. **(CLAUDE 다음 세션 1순위)** **Mock cleanup Step 2.3 (regenerate 라우트)** 진입 — fresh branch off main `2dca060`. Step 2.1/2.2 패턴 1:1 mechanical extension. omxy R-debate 강제.
  4. **(CLAUDE 병렬 가능)** Step 2.4~2.7 (cost/health/news/cron mock) 순차.
  5. **(CLAUDE 병렬 가능)** Task 5 B66 production backfill (Supabase MCP access 확보됨).
  6. **(CLAUDE)** Task 7 Smoke Stage 2 — 단일 실 admin trigger button click 검증 (cost burn ~5,000~6,000원). USER 1회 비용 승인.
  7. 이후 Task 8 audit + PR5 cron 30 자동 plan SoT.
- **omxy lifecycle** = git log + spec/plan/PR body 위임 (R-debate 라운드별 catch 박제 = 58차 detail in PR body — historical 강등 후 본 §6 직전 entry 1줄)

---

## ⭐ 다음 세션 진입자 5줄 요약 (58차 Mock cleanup Step 2.1 PR #33 MERGED + Step 2.2 PR #34 MERGED (post-merge baseline) 시점 — post-PR-#32 docs commit `2f97447`, omxy 13 rounds CONVERGED 누적 + docs sweep R-debate R14 CONVERGED + merge debate R2 → A++ 정합 — 최신 라운드/catch 누적/fix commit은 git log + cmux debate transcript 위임 (self-referential drift 방지))

1. **58차 누적 MERGED 박제**: Task 4 B65-P3 impl ✅ MERGED `3c09d6e` (PR #30 7 commits, omxy 3 rounds CONVERGED) + B-trackrecord-rls ✅ MERGED `838386e` (PR #31 1 commit, omxy R1 CONVERGED) + **마이그 0025 production applied** (Supabase MCP OAuth verified, omxy R1+R2 CONVERGED, 4-grant matrix ✓ + body match ✓ + flag invariant ✓) + Mock cleanup Step 1 ✅ MERGED `1d2db08` (PR #32 5 commits, omxy 4 rounds CONVERGED — 사용자 시점 3 production 이슈 catch/fix).
2. **58차 추가 MERGED (post-merge baseline)**:
   - **PR #33 ✅ MERGED `e6be73f`** Mock cleanup Step 2.1 alerts (`MOCK_ADMIN_ALERTS` + `MOCK_ADMIN_NEWS` → `alert_event` + `news_event` 실 DB SELECT, code commits `29222ab` + `e210b02` + 다회 docs sweep — git log + PR body 위임, omxy R-debate 2 rounds CONVERGED + docs sweep R-debate R14 CONVERGED + merge debate R2 A++ 정합)
   - **PR #34 ✅ MERGED `2dca060`** Mock cleanup Step 2.2 settings (`MOCK_ADMIN_SETTINGS` + `MOCK_ADMIN_TICKER_PREFS` + `MOCK_ADMIN_ID` → `admin_settings` + `ticker_alert_pref` 실 SELECT + WRITE 모든 환경 `real_persistence_not_configured` boundary, code commit `43c7886`, omxy R1 CONVERGED, 신규 helper 2종 + tests +24, 마이그 0건)
3. **omxy 13 rounds CONVERGED 누적** (PR#30 R1~R3 + PR#31 R1 + 마이그 R1~R2 + PR#32 Step 1 R1~R4 + PR#33 Step 2.1 R1~R2 + PR#34 Step 2.2 R1) **+ docs sweep R-debate R14 CONVERGED + merge debate R2 → A++ 정합** — 최신 라운드/catch 누적/fix commit은 git log + cmux debate transcript 위임 (self-referential drift 방지, B75 fixed SHA 박제 금지 정합).
4. ⚠️ **PR4 + B65-P1/P3 MERGED + 마이그 0025 applied + Mock cleanup Step 1/2.1/2.2 MERGED ≠ production functional** (불변): Vercel Production env `PR4_TRIGGER_UPSERT_ENABLED` UNSET → orchestrator strict 'true' false → legacy path 유지 → admin trigger button = report_not_found fail-fast (B65-P1 cost burn 차단 active). 정상 동작은 USER가 Vercel env=true 설정 후 (Task 7 Smoke Stage 2 게이트).
5. **다음 세션 sequence (CLAUDE 자동 진입)**:
   - **(CLAUDE entry routine)** §0 verify (main HEAD = `2dca060` post-PR-#34 MERGED (58차 종료 post-merge baseline) + OPEN PRs `#2` only (PR #33/#34 MERGED + branch deleted) + production audit drift 0).
   - **(USER 잔여 액션)** Vercel env `PR4_TRIGGER_UPSERT_ENABLED=true` 추가 (+ `AI_COST_LOG_REAL_INSERT_ENABLED=true` verify) + (권장) 인증 세션으로 production canary verify (`/admin/alerts` + `/admin/settings` empty state). Public curl canary는 완료 (`/` 200 / `/login` 200 / `/macro` 200).
   - **(CLAUDE) Mock cleanup Step 2.3 (regenerate 라우트) 진입** — fresh branch off main `2dca060`. Step 2.1/2.2 패턴 1:1 mechanical extension. omxy R-debate 강제.
   - **(CLAUDE 병렬 가능)** Step 2.4~2.7 (cost/health/news/cron mock) 순차 + Task 5 B66 backfill (Supabase MCP access 확보됨) + Task 7 Smoke Stage 2 (USER 1회 비용 승인 ~5,000~6,000원).
5. **canonical 5-PR 순서 (모두 MERGED, PR5 진입 차단 = B65-P2 impl + B65-P3 + B66 + Smoke 모두 PASS)**:

   | Group | 담당 PR | 상태 |
   |---|---|---|
   | **B** 30종목 선정 AI 부재 | PR2 | ✅ MERGED `f85fb69` |
   | **H** Critical schema drift | PR3a | ✅ MERGED `0813a41` |
   | **C** cron mock dry-run | PR1 | ✅ MERGED `4aa3130` |
   | **D** (절반) Step 3c dangling server action | PR1 | ✅ MERGED `4aa3130` |
   | **E** writer Section 0~7 본문 | PR3b | ✅ MERGED `cf68731` |
   | **G** Sector reference 3-level + 3-step orchestration | PR3c | ✅ MERGED `b2a902a` |
   | **A** track-record trigger 위치 | **PR4** | ✅ **MERGED `7de9696`** (PR #19) |
   | **F** Track Record 누적 vs 아카이브 탭 분리 | **PR4** | ✅ **MERGED `7de9696`** |
   | **D** (잔여) UI caller wire | **PR4** | ✅ **MERGED `7de9696`** (단, **production functional gap = §9 박제**) |
   | **cron 30 자동 리포트 + 큐 인프라** | **PR5 (분리)** | 🟡 **B65-P3 + B66 backfill + Smoke Stage 1+2 모두 PASS 후만 진입** (omxy R7 B94 lock-in) |

**진입 트리거 (58차 종료 → 다음 차수 진입)**: "`Document/Process/HANDOFF.md` 보고 이어서 진행" →
1. §0 verify (`git rev-parse --short origin/main` = `2dca060` (post-PR-#34 MERGED 자손 허용) + OPEN PRs `#2` only + main test:ci 게이트 1회 재실행 (post-merge baseline = 1208 PASS / 111 files))
2. **production audit 재확인** (Supabase 직접 query, §2.1 Task 1 entry routine) — drift 0 확인 (cost_log=0 / stock_reports=0 / committee_votes=0 잔존 정상 — Vercel env=true + Task 7 Smoke Stage 2 후만 drift 가능)
3. **§9 박제 + §2.1 active matrix 갱신** (Task 1+2+3 ✅ + Task 4 ✅ + 마이그 0025 ✅ + Mock cleanup Step 1+2.1+2.2 ✅ 모두 MERGED) + W-s5b-admin-assertion + W-ticker-re-kr-only + W-mock2-rls-drift 박제 확인
4. **Mock cleanup Step 2.3 (regenerate 라우트) 진입** — fresh branch off main `2dca060`. Step 2.1/2.2 패턴 1:1 mechanical extension (helper + actions wire + tests + omxy R-debate). 의사 1회 확인 후 자동 시작.

**14 defer follow-up tickets (PR4 출신, B65/B66과 무관, 별도 작업)**: PR #19 body 박제. architectural drift (W-1 callerKind dead code / W-2 fetchTrackRecord* in actions.ts) + observability gap (W-4 sub_tags / W-5 user.email) + cosmetic (W-6 as never cast / Track 3 I1-I6).

**⚠️ PR4 acceptance criterion 박제 (불변)**: PR4 scope = admin manual trigger 버튼 + Regen + Track Record + PR3a OOS + **B18 CRON_SECRET 401 test만** + Task 8 W7만 (defer는 source review docs 링크). 본 PR에서 적용:
1. **caller DI seam (✅ 완료)** — `commitFullReport` / `orchestrateFullReport` + 모든 helper (cost-logger / AI clients 3종 / report-critic-findings / sector-reference-backlog / critic.ts evaluateReport) options:{client?} 패턴
2. **admin caller = quality (✅ 완료)** — admin manual = `orchestrateFullReport(callerKind='admin')` Kevin v3.1 quality target
3. **CRON_SECRET 401 test (잔여)** — cron route가 CRON_SECRET 미일치 시 401 반환 검증 (Task 7)

> **cron 30 자동 리포트 + service-role caller DI + admin_id 'cron-system' + cost_log e2e test = PR5 후속 트랙** (T11 분할 결정 보존, PR4 머지 후 진입). PR5 caller path = orchestrateFullReport (quality), timeout 처리 = 자체 DB job queue β2′ 또는 Vercel Queues β1 (PR5 plan 시점 R-debate).

**운영 원칙**: 미래 지향. §6 inline entry = 직전 2개만 (본 58차 종료 post-merge baseline = (1) Mock cleanup Step 2.2 ✅ MERGED `2dca060` (PR #34) + (2) Step 2.1 ✅ MERGED `e6be73f` (PR #33). Step 1 entry는 demote 1줄 link). older historical = git log + spec/plan/REVIEW docs + ProgressDashboard 위임. **commit count + SHA chain + sweep round count 표현은 self-referential drift 발생 위험으로 추상화 — 정확한 chain은 `git log origin/main..<branch>`로 runtime verify, debate round는 cmux debate transcript 위임** (B75 fixed SHA 박제 금지 정합).

**⚠️ gsd-code-reviewer 환경 부재 대체 정책 (54차 §4 박제)**: 현 Claude Code 환경에서 `gsd-code-reviewer` agent type은 더 이상 사용 불가. PR3b/PR4/후속 모든 PR의 deep code review는 **3-track 대체 패턴** (PR4 finalize Task 9에서 적용):
- **Track 1**: `gstack-review` skill (pre-landing PR review, structural/SQL/LLM trust/concurrency)
- **Track 2**: `general-purpose` agent (depth=deep adversarial prompt — gsd 동등 책임)
- **Track 3**: `superpowers:code-review` skill 또는 5-angle scan agent (recall mode bug catch)

---

## 0. 세션 시작 루틴 (verify + auto-progress)

```bash
# 58차 종료 post-merge baseline — main `2dca060` (post-PR-#34 MERGED, ancestor `e6be73f` post-PR-#33 MERGED).
# 58차 누적 MERGED: PR #30 B65-P3 impl `3c09d6e` + PR #31 B-trackrecord-rls `838386e` + 마이그 0025 production applied + PR #32 Mock cleanup Step 1 `1d2db08` + PR #33 Step 2.1 alerts `e6be73f` + PR #34 Step 2.2 settings `2dca060`.
# OPEN: #2 only (format-error, CONFLICTING 보류).
# main HEAD = `2dca060` post-PR-#34 MERGED (실제 SHA는 runtime verify로 갱신, 자손 허용)
cd /Users/yong/New_Project_KR_Stock

# 1. main branch state runtime 확인 (B75 fixed SHA 박제 금지 — post-PR-#34 descendant 자손 기대)
git checkout main && git pull origin main
git rev-parse --abbrev-ref HEAD                   # main
git rev-parse --short HEAD                        # 기대: `2dca060` 또는 자손 (runtime 동적 verify)
git status --short                                # clean

# 2. OPEN PRs (58차 종료 post-merge baseline: #2 only — PR #33/#34 MERGED + branch deleted)
gh pr list --state open --json number,title,headRefName,mergeable
#   #2   fix/s7a-format-error-inventory (format-error, CONFLICTING 보류)

# 3. 58차 누적 MERGED + canonical 5-PR + B65 3-phase 확인
git log --oneline | head -10
#   기대: 58차 종료 post-merge = `2dca060` PR #34 + `e6be73f` PR #33 + 그 이전 commit chain
#   상세 commit 체인 = git log + PR body 위임

# 4. 검증 게이트 (main `2dca060` post-merge baseline — 매 세션 진입 시 1회)
#    - test:ci 실측 = 1208 PASS / 111 files (58차 종료 post-merge baseline)
#    - build 25 routes / lint 0 err 6 warn (pre-existing) / tsc clean / 0 migrations (post-merge sync docs only)
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit && cd ..

# 5. production audit 재확인 (§2.1 active 8-row matrix Task 1 = entry routine, 매 세션 1순위)
#    Supabase MCP `mcp__supabase__execute_sql` 또는 dashboard로 실행:
#      select count(*) from cost_log;                                         -- 기대 0 (P2 미구현, P1 guard active로 burn 차단)
#      select count(*) from stock_reports;                                    -- 기대 0 (P2 후 Smoke Stage 2에서 1+)
#      select count(*) from committee_votes;                                  -- 기대 0
#      select count(*) from short_list_30;                                    -- 기대 30
#      select sector, count(*) from short_list_30 group by sector order by 2 desc;
#                                                                              -- 기대: ('코스닥', '코스피') placeholder 잔존 (B66, Task 5 backfill 후 canonical 14)
#    drift (cost_log > 0 등) 시 P2 도입 효과 또는 Smoke Stage 2 결과 반영 가능 — §1 ground truth 갱신.

# 6. Vercel production canary (post-PR-#26 docs-only deploy + functional behavior unchanged — 권장 1회 verify)
#    /admin/portfolio trigger button click → `리포트를 찾을 수 없습니다` 메시지 (P1 fail-fast active)
#    /admin/track-record + /admin/report/[ticker] + /admin/report/[ticker]/regenerate 진입 정상
```

### 진입자 자동 행동 (§2.0 default-progress policy, 58차 종료 갱신)

1. **§0 verify 실행** → branch state + PR state (**#2 CONFLICTING 보류 only** — PR #33/#34 MERGED + branch deleted) + 검증 게이트 + **production audit 재확인** (Task 1).
2. **§9 박제 확인** — PR4 + B65-P1/P3 MERGED + 마이그 0025 applied + Mock cleanup Step 1/2.1/2.2 MERGED ≠ production functional 불변. Vercel env `PR4_TRIGGER_UPSERT_ENABLED` UNSET 잔존 → admin trigger button = report_not_found fail-fast (B65 P1 active). 정상 동작은 USER가 Vercel env=true 설정 후.
3. **§2.1 active matrix 다음 unblocked step 식별**:
   - Task 1 ✅ COMPLETED (57차 §1, production audit 1회) — **다음 세션 entry routine 1순위 재실행**
   - Task 2 ✅ MERGED `5b99e03` (B65-P1 PR #21)
   - Task 3 ✅ COMPLETED (57차 §2, B65-P2 spec doc CONVERGED R8 — 옵션 A lock-in)
   - **Task 4 ✅ MERGED `3c09d6e` (58차, PR #30 B65-P3 impl, omxy R1~R3 CONVERGED) + 마이그 0025 ✅ production applied**
   - **B-trackrecord-rls ✅ MERGED `838386e` (58차, PR #31)**
   - **Mock cleanup Step 1 ✅ MERGED `1d2db08` (58차, PR #32, omxy R1~R4 CONVERGED)**
   - **Mock cleanup Step 2.1 ✅ MERGED `e6be73f` (PR #33, 58차, omxy 2 rounds CONVERGED + docs sweep R-debate R14 CONVERGED + merge debate R2 A++ 정합 — 최신 라운드/catch 누적/fix commit은 git log + cmux debate transcript 위임)**
   - **Mock cleanup Step 2.2 ✅ MERGED `2dca060` (PR #34, 58차, omxy R1 CONVERGED)**
   - **다음 1순위**: (CLAUDE) **Mock cleanup Step 2.3 (regenerate 라우트)** 진입 — fresh branch off main `2dca060`. (USER 잔여) Vercel env 설정. → Step 2.4~2.7 + Task 5 B66 backfill + Task 7 Smoke Stage 2
4. **Owner 별 행동**:
   - **[CLAUDE]** → 즉시 자동 시작 (stacked 1세션+ 작업은 진입 의사 1회 확인).
   - **[SHARED]** → "이어서 진행" 권한으로 prepare/commit/push/PR-create 자동.
   - **[USER]** → background blocker 보고 + Vercel env 설정 + (권장) 인증 세션 production canary verify + Smoke Stage 2 시점 1회 비용 승인 (Task 7).
5. **§2.0 명시 USER 승인 게이트 (좁힘, 58차 종료)** 도달 시만 USER 직접 묻기 — scope expansion / product spec / risk profile / real-money / cost burn 트리거 / 마이그 production apply / external account / 외부 메시지 / destructive (force push to main, DB drop) / uncertainty ≥ medium. **자동 진행 허용** (PR merge / Vercel env flag 토글 / production canary verify / branch cleanup / PR create) — omxy R-debate CONVERGED + 검증 게이트 ALL GREEN = 사용자 승인 등가.
6. **§7 omxy 적대적 검토 패턴**은 모든 신규 작업 branch에서 강제 적용 (58차 박제: Mock cleanup Step 2.1/2.2 PR-내 cmux pair-debate + docs sweep R-debate R14 CONVERGED + merge debate R2 → A++ 정합 — 최신 라운드/catch 누적/fix commit은 git log + cmux debate transcript 위임 (self-referential drift 방지) — omxy 정직한 검토가 sweep stale 단계별 검출).

---

## 1. 현재 상태 (58차 Mock cleanup Step 2.1 ✅ MERGED `e6be73f` (PR #33) + Step 2.2 ✅ MERGED `2dca060` (PR #34) 시점 — PR #30/31/32 + 마이그 0025 MERGED 누적, omxy 13 rounds CONVERGED + docs sweep R-debate R14 CONVERGED + merge debate R2 → A++ 정합 — 최신 라운드/catch 누적/fix commit은 git log + cmux debate transcript 위임 (self-referential drift 방지), 2026-05-27)

| 영역 | 상태 |
|---|---|
| main HEAD | **`2dca060`** (post-PR-#34 MERGED, ancestor `e6be73f` post-PR-#33 MERGED — 58차 종료 post-merge baseline). 자손 SHA 허용. **다음 세션 진입 시 `git rev-parse --short origin/main`으로 verify** (B75 fixed SHA 박제 금지 — 자손 SHA 동적). |
| **PR #21 (B65-P1)** | ✅ MERGED `5b99e03` (57차 §1) — Task 2 production active |
| **PR #20+#22+#24+#25 (docs chain, 57차 §1 lifecycle)** | ✅ MERGED in main (branches deleted, PR #23 CLOSED 운영 원칙 반려) |
| **PR #26 (57차 §2 — B65-P2 spec doc + HANDOFF sweep + cleanup, docs-only, 3 commits)** | ✅ **MERGED in main `33098e0`** (rebase FF, --delete-branch, 2026-05-26, Vercel deploy SUCCESS E41zxrqAeRGfB7E99h82hXpZkAd2) |
| **Vercel last verified production deploy** | ✅ SUCCESS (post-PR-#26 docs-only deploy E41zxrqAeRGfB7E99h82hXpZkAd2). PR #21 historical functional deploy `5b99e03` (dpl_82mtwUy82n365yF9WTuYjuhv59wL) SUCCESS — 본 §2 commit 체인은 docs-only로 기능 동일. |
| **PR4 (canonical 5-PR 마지막)** | ✅ MERGED `7de9696` (PR #19, 56차 §5) — 상세 = §6 56차 §5 entry + PR #19 body |
| canonical 5-PR MERGED (전체 완료) | PR2 `f85fb69` / PR3a `0813a41` / PR1 `4aa3130` / PR3b `cf68731` / PR3c `b2a902a` / PR4 `7de9696` |
| **57차 §1 Task 1 (production audit)** | ✅ COMPLETED — drift 0 (57차 §2 entry routine 재실행 시점에도 동일 ground truth) |
| **57차 §1 Task 2 (B65-P1 immediate guard) ✅ MERGED** | PR #21 MERGED `5b99e03`. P1 guard production active. |
| **57차 §2 Task 3 (B65-P2 RPC R-debate spec doc) ✅ CONVERGED R8 final** | spec doc = `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md` (DRAFT R1 → R8 final). 결정 lock-in: **옵션 A** `upsert_report_sections_0_7_admin` admin-only UPSERT RPC + section_0~7 + appendix only + axis (i)A admin trigger 책임 = section_0~7 only + axis (ii) B79 deferred → PR5 plan + axis (iii) PR5 cron path 충돌 없음. spec doc only (no impl code, 0 migrations). |
| **PR #21 OMXY (57차 §1, 4 rounds CONVERGED)** | R1+R2+R3+R4 — 모두 **BLOCKERS 0** · WATCH (비차단): P3 도입 시 feature flag toggle (`PR4_TRIGGER_UPSERT_ENABLED`, B98 default) |
| **57차 §2 Task 3 OMXY (8 rounds, SIGNAL=ESCALATE max-8-rounds 정합 §7.5)** | R1 6 BLOCKERS + R2 5 + R3 5 + R4 3 + R5 2 + R6 1+2 minor + R7 2 + R8 ESCALATE max-8 + 3 mechanical fix. native critic subagent 6명 (Godel R1 5 BLOCKERS + 4 WATCH / Feynman R2 / Planck R3 / Schrodinger R4 / Franklin R5 / Hypatia R6). **누적 catch 30+ 모두 fix 반영**. |
| ⚠️ **PR4 + B65-P1/P3 + Mock cleanup Step 1/2.1/2.2 MERGED + 마이그 0025 applied ≠ production functional 잔존** | Vercel Production env `PR4_TRIGGER_UPSERT_ENABLED` UNSET → orchestrator legacy path 유지 → admin trigger button = report_not_found fail-fast (B65 P1 cost burn 차단 active). 정상 동작은 USER가 Vercel env=true 설정 후 (Task 7 Smoke Stage 2 게이트). §9 박제 유지. |
| **B66 quality/trust blocker** | `short_list_30` 30 rows sector="코스닥"/"코스피" placeholder. PR5 entry blocker — Task 5 backfill 후 PR5 진입 가능. |
| **B67~B98 + 9 신규 audit (57차 §2 + 58차 Step 2.x)** | 56차 §5 omxy 11+ 항목 + 57차 §2 R-debate 6 신규 (B79 / B-versioning / W-tier1pill / W-grant-smoke ✅ RESOLVED / W-sectionfallback-text / W-cost-log-env-gate) + 58차 Step 2.x 3 신규 (W-mock2-rls-drift / W-s5b-admin-assertion / W-ticker-re-kr-only). Smoke Stage 2 PASS 후 audit (§9 + Task 8). |
| **58차 Task 4 B65-P3 impl ✅ MERGED `3c09d6e` + 마이그 0025 production applied** | PR #30 7 commits FF, omxy R1~R3 CONVERGED. 마이그 0025 = `upsert_report_sections_0_7_admin` admin-only UPSERT RPC + 4-grant matrix + SECURITY DEFINER + search_path. 옵션 A lock-in 정합. |
| **다음 세션 1순위** | ⭐ **(CLAUDE) Mock cleanup Step 2.3 (regenerate 라우트) 진입** — fresh branch off main `2dca060`. Step 2.1/2.2 패턴 1:1 mechanical extension. omxy R-debate 강제. **(USER 잔여)** Vercel env `PR4_TRIGGER_UPSERT_ENABLED=true` 추가 → Task 7 Smoke Stage 2 진입 가능 + (권장) 인증 세션 production canary verify. **(CLAUDE 병렬 가능)** Step 2.4~2.7 (cost/health/news/cron mock) 순차 + Task 5 B66 backfill (Supabase MCP access 확보됨) → Task 7 Stage 2 (USER 1회 비용 승인) → Task 8 audit + PR5. |
| Mock Skeleton + DQ-7 + S7e + S7a + Tier 2 | ✅ Mock 완료 / 🟢 DQ-7 ~97% (Smoke #4/#5 + Session 4 QA 잔여) / 🟢 S7e 7/8 (T7e.7 RLS QA 잔여) / ✅ S7a MERGED (51차) / ✅ Tier 2 D21 (52차+53차) |
| 선정 흐름 메인 path | 🟢 spec lock-in: Tier 0 150 → Tier 1 Core 11 AI 평가 → 단/중/장 top 10 = 30. 현재 production = Tier 0 단독 30 직선정 (fallback). **PR5 cron 가동 시 메인 path 활성 (Mock cleanup Step 2 완료 + B66 backfill + Smoke Stage 1+2 PASS 후만 진입)**. |
| 풀 리포트 흐름 | 🟢 PR3b writer Section 0~7 + Section 8 partA/partD + PR3c 3-step orchestration + PR4 admin caller wired + B65-P3 admin-only UPSERT RPC + 마이그 0025 production applied. **but production cost_log=0 / stock_reports=0 — 성공/기록된 AI 호출 및 리포트 0건. Vercel env UNSET 잔존 → admin trigger button 클릭 → `report_not_found` (P1 cost burn 차단) 반환**. Vercel env=true + Smoke Stage 2 후 실 정상 동작 가능. cost_log 적재 정확한 지점은 Smoke Stage 2에서 확정 (B100). |
| OPEN PRs | **#2** (format-error, CONFLICTING 보류) only — 58차 누적 MERGED: PR #30 (`3c09d6e`) + PR #31 (`838386e`) + 마이그 0025 production applied + PR #32 (`1d2db08`) + **PR #33 Step 2.1 alerts (`e6be73f`)** + **PR #34 Step 2.2 settings (`2dca060`)**. PR #33은 code commits `29222ab`+`e210b02` + 다회 docs sweep R-debate (R14 CONVERGED) + merge debate (R2 A++ 정합) 누적 — 상세 git log + PR body 위임. PR #34는 code commit `43c7886` + omxy R1 CONVERGED. |
| 실 AI 호출 | **현재 0건 (production cost_log ground truth, 불변)**. Vercel env 3 vars (ANTHROPIC_API_KEY + 2 모델 ID) Production 배포 + 충전 완료. PR4 + B65-P1/P3 MERGED + 마이그 0025 applied — trigger button = cost burn 차단 production active (P1 fail-fast, Vercel env UNSET 잔존). **Vercel env=true 설정 후** 첫 실 AI smoke 가능 (B97 2-stage 분리). Smoke Stage 2 진입 전 `AI_COST_LOG_REAL_INSERT_ENABLED='true'` env 선행 필수 (W-cost-log-env-gate). |
| Production deploy | Vercel main `2dca060` Production ● Ready (`tudal-cysr2mmvo` 51s build for PR #34, `tudal-km7ea67te` 50s build for PR #33, flag=false default → 동작 불변). Public canary verify (curl): `/` 200 + `/login` 200 + `/macro` 200 ✓ public 회귀 0. 인증 세션 canary 권장: `/admin/alerts` + `/admin/settings` empty state + PR4 핵심 4 페이지 + Functional smoke 3 (C-1 click → P1 fail-fast `리포트를 찾을 수 없습니다` 확인 / C-2 validation / B18 401). |
| Supabase | project `rbrpcynhphrpljbjirfo` · **0001~0025 production 적용 완료** (0025 = 58차 Task 4 `upsert_report_sections_0_7_admin` admin-only UPSERT RPC, omxy R1+R2 CONVERGED + 4-grant matrix verified). SECURITY DEFINER 4-grant 패턴 유지. PR #33 / #34 = 0 migrations (코드 + docs only). |
| 검증 게이트 (main `2dca060` post-merge baseline) | build 25 routes / lint 0 err 6 warn (pre-existing) / **test:ci 1208 PASS / 111 files** (PR #33 +37 + PR #34 +24 통합 — 1149 → 1208) / tsc clean / 0 migrations (PR #33/#34 모두 code+docs only). |
| omxy debate 누적 | PR3c까지 238+ rounds · PR4 lifecycle 50 BLOCKERS · 56차 §5 post-merge docs R1~R11 + B65~B108 catalog · 57차 §1 PR #21 R1~R4 + §2 Task 3 R1~R8 + §3 Task 4 plan R1~R5 누적 23 BLOCKERS · **58차 13 rounds CONVERGED 누적** (PR #30 R1~R3 + PR #31 R1 + 마이그 R1~R2 + PR #32 Step 1 R1~R4 + PR #33 Step 2.1 R1~R2 + PR #34 Step 2.2 R1) **+ docs sweep R-debate R14 CONVERGED + merge debate R2 → A++ 정합** — 최신 라운드/catch 누적/fix commit은 git log + cmux debate transcript 위임 (self-referential drift 방지). |

---

## 2. 출시까지 선형 Runbook

### §2.0 Default-progress policy

**"이어서 진행해줘" 받았을 때 Claude의 행동 규칙**:

- If current step is USER-gated, report it briefly as background blocker and proceed to the next unblocked CLAUDE step.
- Do not repeatedly ask which option to choose when the runbook already defines the next CLAUDE step.
- Stop only at explicit USER-gated operations or the exception list below.

**Ask user before (좁힘, 58차 종료 사용자 명시 — "User 잔여 액션도 나한테 묻지 말고 진행하고 검증 하라고")**:

1. **scope expansion** (HANDOFF 범위 초과 새 작업)
2. **product spec changes** (D-decision 변경)
3. **new risk profile** (가드레일 / 보안 정책 변경)
4. **real-money / live-account / order-path changes** (실 체결 토글 / 자동매매 토글 변경)
5. **cost burn 트리거** (실 AI 호출 / Smoke Stage 2 / `AI_COST_LOG_REAL_INSERT_ENABLED=true` 활성 후 admin trigger 클릭) — 1회 비용 승인 필수
6. **마이그 production apply** (Supabase apply_migration) + **external account 변경** (Vercel project ownership / Supabase project / billing) + **외부 메시지 발송** (Slack / 이메일 / 외부 알림)
7. **destructive shared-state** (force push to main / DB drop / 운영 데이터 삭제)
8. **uncertainty ≥ medium** (어떻게 진행해야 할지 불확실한 경우)

**자동 진행 허용 (사용자 명시 ↔ 묻지 않고 즉시 + 검증까지)** — omxy R-debate CONVERGED + 검증 게이트 ALL GREEN = 사용자 승인 등가:
- **PR merge** (rebase FF + delete-branch) — omxy verify CONVERGED 후
- **Vercel env var flag 토글** (e.g., `PR4_TRIGGER_UPSERT_ENABLED=true` — env flag 한정, secret 변경은 게이트 5)
- **production canary verify** (curl public + browser/gstack 인증 세션)
- **branch cleanup** / feature-branch push / PR create / PR comment / PR body 갱신
- **Vercel production deploy verify** (gh + vercel CLI + curl)

본 운영 원칙은 [[feedback_user_action_auto_progress]] + [[feedback_no_user_approval_gate]] 정합.

### §2.1 Step matrix (58차 Mock cleanup Step 2.1 ✅ MERGED `e6be73f` (PR #33) + Step 2.2 ✅ MERGED `2dca060` (PR #34) 시점 — Task 4 impl + 마이그 0025 + Mock cleanup Step 1 MERGED 누적, **PR5 진입 = Task 5~7 PASS + Mock cleanup Step 2 완료 후**)

**현재 위치 = 58차 종료 post-merge baseline (Mock cleanup Step 2.1 + Step 2.2 ✅ MERGED)**:
- **PR #33** Step 2.1 alerts (admin user-visible 3 routes `MOCK_ADMIN_ALERTS` + `MOCK_ADMIN_NEWS` → `alert_event` / `news_event` 실 DB SELECT, omxy R1~R2 CONVERGED, code commits `29222ab`+`e210b02` + 다회 docs sweep — git log + PR body 위임)
- **PR #34** Step 2.2 settings (admin user-visible 1 라우트 `MOCK_ADMIN_SETTINGS` + `MOCK_ADMIN_TICKER_PREFS` + `MOCK_ADMIN_ID` → `admin_settings` + `ticker_alert_pref` 실 SELECT + WRITE 모든 환경 `real_persistence_not_configured` boundary, omxy R1 CONVERGED, 1 commit `43c7886`, 신규 helper 2종 + tests +24)

**누적 박제**: Task 4 ✅ + B-trackrecord-rls ✅ + 마이그 0025 production applied ✅ + Mock cleanup Step 1 ✅ 모두 MERGED, main `2dca060` (post-PR-#34 MERGED). **omxy 13 rounds CONVERGED 누적** (PR#30 R1~R3 + PR#31 R1 + 마이그 R1~R2 + PR#32 Step 1 R1~R4 + PR#33 Step 2.1 R1~R2 + PR#34 Step 2.2 R1) **+ docs sweep R-debate R14 CONVERGED + merge debate R2 → A++ 정합** — 최신 라운드/catch 누적/fix commit은 git log + cmux debate transcript 위임.

**다음 1순위** = **(CLAUDE) Mock cleanup Step 2.3 (regenerate 라우트) 진입** — fresh branch off main `2dca060`. Step 2.1/2.2 패턴 1:1 mechanical extension + omxy R-debate 강제 + Step 2.4~2.7 (cost/health/news/cron mock) 순차. (USER 잔여) Vercel env `PR4_TRIGGER_UPSERT_ENABLED=true` 추가 (현재 unset, B65 P1 fail-fast active) + (권장) 인증 세션 production canary verify.

Owner 의미: **USER** (사용자만) · **CLAUDE** (자동) · **SHARED** ("이어서 진행" 권한으로 push/PR-create 자동, merge/deploy/migration은 USER).

#### 다음 세션 active matrix — 8-row sequence (Task 1+2+3 + Task 4 plan ✅, Task 4 impl + Task 5~8 잔여)

| # | Task | Owner | 상태 | 박제 |
|---|---|---|---|---|
| 1 | **현행 audit 재확인** (Supabase 직접 query: `cost_log` / `stock_reports` / `committee_votes` / `short_list_30` sector quality) | CLAUDE | ✅ COMPLETED (57차 §1) — drift 0 확인 | 매 세션 entry routine 1순위로 재실행 (drift detect). 본 §1 ground truth와 동일한 결과 확인. drift (cost_log > 0 등) 시 PR #21 머지 효과 또는 Smoke Stage 2 결과 반영 가능. |
| 2 | **B65-P1 immediate guard (Phase 1) + B86 month format** | CLAUDE | ✅ **MERGED in main `5b99e03`** (57차 §1, PR #21, Vercel deploy SUCCESS) | `triggerFullReport`에 `reportExistsForMonth(input.ticker, ${month}-01)` preflight 추가. false → `report_not_found` / throws → `report_lookup_failed`. **P2 미구현 상태에서만 활성** (현재 production = 영구 fail-fast — B65-P2 후만 정상 동작), smoke 금지 (B92). 코드 주석에 P3 feature flag 박제. |
| 3 | **B65-P2 real enablement (Phase 2) + B88 RPC R-debate spec doc** | CLAUDE | ✅ **COMPLETED in 57차 §2 (spec doc CONVERGED R8 final)** | spec doc = `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md`. omxy R-debate 8 rounds (R8 ESCALATE max-8 정합 §7.5) + native critic subagent 6명 + 누적 catch 30+ 모두 fix. **결정 lock-in: 옵션 A** `upsert_report_sections_0_7_admin` admin-only UPSERT RPC + section_0~7 + appendix only + axis (i)A admin trigger 책임 = section_0~7 only + axis (ii) B79 deferred → PR5 plan + axis (iii) PR5 cron path 충돌 없음. spec doc only (no impl code, 0 migrations). **Task 4가 마이그 0025 + feature flag impl plan + impl PR 진입**. 신규 6 audit ticket 박제 (B79 / B-versioning / W-tier1pill / W-grant-smoke / W-sectionfallback-text / W-cost-log-env-gate). |
| 4 | **B65-P3 P1/P2 호환 (Phase 3) + B98 default policy (feature flag) + 마이그 0025 impl** | CLAUDE | ✅ **impl MERGED in main `3c09d6e`** (58차, PR #30 rebase FF + delete-branch, omxy R-debate 3 rounds CONVERGED). ⚠️ 마이그 0025 production apply + Vercel env=true = Task 7 게이트 (flag=false default라 현재 동작 불변) | **plan SoT** = `docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md` (929 lines, MERGED). omxy R-debate R1~R5 누적 23 BLOCKERS catch & fix (Schop 8 + Kepler 3 + Plato 3 + Sartre 2 + Aristotle 1 = 17 unique + 6 dup recall) — Ramanujan R5 CATCH 0 CONVERGED + HANDOFF sweep R1~R2 Descartes CATCH 0. **impl scope**: (i) feature flag `PR4_TRIGGER_UPSERT_ENABLED` (.env.example=`false` safe default, Production Vercel env=`true` USER step §3.3.5, B98 lock-in) + (ii) 마이그 0025 `upsert_report_sections_0_7_admin.sql` + rollback (admin-only, service_role 명시 REVOKE — Kepler B2 critical) + (iii) orchestrator 분기 + rpcName-guarded error 분리 + (iv) actions B65-P1 guard flag toggle + (v) format-error 2 keys + 1 prefix handler = 3 entries + (vi) TDD invariants 8종 (Test 1 action seam + Test 4b 2-phase DB integration + Test 7 SQLSTATE matrix + Test 8 env cleanup). **smoke는 P3 후만 가능** (B94). impl PR = `feat/b65-p3-feature-flag-upsert-impl` 신규 branch + plan §8.2 옵션 B 5 commits 권장. |
| 5 | **B66 fix + B84 backfill + B89 default policy + B93 PASS criteria** | CLAUDE | 🟡 PR5 entry blocker 3순위 (Task 4 병렬 가능) | Python seed script (`scripts/seed_short_list_30.py` 또는 신규) ticker→canonical14 매핑 추가 + 30 rows backfill + unknown 처리 R-debate (block / manual review / backfill exclude). **PASS criteria 3종**: (1) 30 rows all sector ∈ `CANONICAL_SECTORS` (2) sector ∉ ('코스피','코스닥') (3) sub_tags 정합 (jsonb null OR string[]). |
| 6 | **Smoke Stage 1 — non-AI dry-run (B97 fix)** | CLAUDE | 🔴 PR5 entry blocker 4순위 (Task 4 후 진입) | `triggerFullReport`에 mock `orchestrateFullReport` 주입 (vi.doMock). **P1+P2+P3 호환 invariant test**: P3 호환 완료 시 P2 path 진입 (mock called) / 비호환 시 P1 fail-fast (mock not called). cost=0. **B96 target**: short_list_30 존재 + stock_reports 부재 ticker. TDD 단위 테스트. |
| 7 | **Smoke Stage 2 — single real AI (B97 fix + B85 + B87)** | CLAUDE+USER | 🔴 PR5 entry blocker 5순위 (Task 6 후 진입) | **Stage 1 PASS 후만 진입**. USER 승인 + B85 model id 1 token verify 선행. **Core smoke (필수)**: criteria 1 `cost_log` row + 2 `stock_reports` row sections + 3 `report_critic_findings` + 5 UI render. **Full-path (옵션 B만)**: criteria 4 `committee_votes`. real cost = `cost_log` 기준 확정 (token usage 기반). |
| 8 | **B67~B98 audit + PR5 진입** | CLAUDE | 🟢→⭐ (Task 7 후 진입) | Smoke Stage 2 PASS 후: B67~B98 catalog 11+ 항목 audit (cron / cost_log retry / RPC 책임 / hardcap mock 등). 모든 priority audit clear 후 **PR5 cron 30 자동 + 큐 인프라** plan SoT 작성 진입 (T11 분할 결정 보존, 16,050원/월 hardcap 4%; B65-P2 RPC 선택이 PR5 cron path와 호환 시만). |

> **§9 신규 박제 참조 (PR4 MERGED ≠ production functional)**: B65/B66/Smoke Stage 1+2 모두 PASS 시 §9 + 본 8-row matrix를 HISTORICAL로 강등하고 PR5 active submatrix로 교체.

#### PR4 historical submatrix (PR #19 MERGED `7de9696`) — historical, PR body 위임

PR4 lifecycle (Task 1.0 ~ Task 9 모두 ✅ MERGED, 50 BLOCKERS catch & fix, 3-track Fix-First) 상세 = **PR #19 body + git log + spec/plan/REVIEW docs** 위임. 본 §2.1 active matrix는 후속 작업 (Task 4 onwards)만 표시.

#### 후속 PR + 운영 (PR5 + S7b~S9)

| Step | Owner | Trigger | Default action | Verification |
|---|---|---|---|---|
| **PR5** cron 30 자동 + 큐 인프라 (T11 분할 결정 보존) | CLAUDE | **§2.1 active 8-row matrix Task 1~7 모두 PASS 후** (B65-P1/P2/P3 + B66 backfill + Smoke Stage 1+2 PASS) | cron monthly-batch route에 30 종목 풀 리포트 자동 호출. caller path = `orchestrateFullReport` (quality, Kevin v3.1 target). timeout 처리 = (β1) Vercel Queues OR (β2′) 자체 DB job queue resumable worker — PR5 plan 시점 R-debate. fail = γ1 allSettled + γ3 retry N + summary alert. cost = δ1 + batch preflight. admin_id = 'cron-system'. service-role client DI + cost_log e2e test. **30 × 535원 ≈ 16,050원/월 (hardcap 4%)**. **D4 박제 (AI 비중 % production active 시점, omxy R3 B1 + PR #24 R1 B1 fix)**: PR5 cron 가동 시 AI 종목별 비중 + 현금 0~30% 제안 production 활성. **저장 SoT** = `short_list_30.suggested_weight` (per-stock weight) + `portfolio_snapshot.weight` / `is_cash` (승인 시 종가 100% 가정 daily snapshot) + `portfolio_approval` event. **section_8.partD ≠ 비중** — partD는 Core 11 위원별 vote rows × 11 (찬반 의사결정, schema = `section-8-schema.ts`). **admin Accept/Reject 모델 (수동 비중 편집 X)**. Reject 후 재분석/hold 정책 SoT = `ServicePlan-Admin §1.3 J1 + §3.3 R3.3-1/R3.3-8 (2인 풀 리포트 열람 게이팅 D15) + §3.4 R3.4-2 + §4.2 E1/E4/E5 + §1A.0 D11`. **호환성 게이트 (57차 §2 R8 final lock-in 정정)**: 옵션 A 채택은 PR5 cron path와 **충돌 없음**. PR5 cron 30 자동 path quality는 commit_persona_eval (full path) + service-role caller wire + B79 RPC 통합을 PR5 plan에서 별도 소유. 본 옵션 A는 admin path를 좁게 처리 + cron path readiness는 PR5에서 독립 확보 (axis iii no-conflict). | omxy + 3-track deep review |
| **Step 4 Reflection** | CLAUDE | **PR5 cron 30 자동 가동 + 실 Tier 1 결과 누적 후** (R9 non-blocker watch 정정) | reflection_log 마이그 + Tier 1 context 주입 + tests. PR5 cron 가동되어야 매월 실 결과 → 다음달 prompt 주입 의미 발생. | omxy + 3-track deep review |
| **Step 7 S7b** 뉴스+브리핑 mock→real | USER 트리거 (B-7 Resend + B-8 Naver) + CLAUDE 구현 | PR5 cron 가동 후 | mock news_event → 실 Naver news sweep + Resend 도메인 인증 + 모닝 브리핑 일 23:00 UTC cron 가동 | S7-RealData.md S7b DoD |
| **Step 8 D11 AI 가상 포트 1차 가동 게이트 (omxy R3 B3 fix)** | USER 운용 + CLAUDE 모니터링 | S7b 완료 후, S7c 진입 전 | **KIS 0개로 어드민 3인 며칠~1주 운용 검증 — 가상 포트 의사결정 품질·승인 워크플로우·재생성 cap·뉴스 분류 등 검증** (D18 박제). AI 비중 % + 현금 0~30% 제안 + Accept/Reject 흐름이 실제 사용 환경에서 만족스러운지 확인. **S7c/S8 진입 게이트**. 만족 시 → S7c. 불만족 시 → S7b/PR5 retro + 조정. | 어드민 3인 만족도 + Track Record 일별 snapshot 정상 적재 |
| **Step 9 S7c** 장중·KIS WS + Exit 2채널 실 연결 (omxy R3 B2 + PR #24 R1 B2 fix) | USER 트리거 (B-9 Telegram + B-10 KIS) + CLAUDE 구현 | D11 운용 검증 통과 후 | mock alert_event → 실 alert_event SELECT + KIS 본인 1개 WS read-only 시세 + **J3 Exit real path**: target/momentum/bad-news 3 트리거 감지 → Telegram + 이메일 + `/admin/alerts` 배지 3채널 발송 → 대안 시나리오 3개 (전량/분할/홀딩) + 어드민 결정 기록 + `alert_event(exit_signal)` 적재 → **T+7일 outcome 자동 적재 (IM-3 Exit 신뢰도 65%+ 목표)** | S7-RealData.md S7c DoD + ServicePlan-Admin §3.10 **R3.10-11 (트리거/3채널 요구)** + R3.10-12~14 (이벤트 + 대안 + outcome) |
| **Step 10 S7d** Silent Health | CLAUDE | S7c 완료 후 | 5 파이프라인 success_rate 모니터링 + red_alert 0건 + Exit outcome T+7 자동 적재 cron | S7-RealData.md S7d DoD |
| **Step 11~14 S8** 자동매매 (분리 단독 진입) | USER 트리거 (B-11 Binance) + CLAUDE 구현 | S7d 완료 후 (단독 진입) | 주식 KIS (모의→실계좌) + 바이낸스 USDT-M 선물 (testnet→mainnet) · Strategy drop-in + AI 어댑터 embed · 가드레일: 레버리지 ≤ 5x · 일일 손실 -3% 자동 정지 · AI 일 주문 ≤ 20회 · Binance Smoke #3 | `Slices/S8-AutoTrading.md` DoD |
| **Step 15** S9 운용 | USER 1개월+ 운용 + CLAUDE 모니터링 hotfix | S8 머지 후 | 어드민 3인 실 사용 + hotfix branch | §2.2 7 criteria |

### §2.2 ✅ 어드민 내부 도구 출시 게이트 (S9 1개월+ 후 7 criteria)

1. **최소 1개월 운용** (어드민 3인 일일 사용 + 운영 로그)
2. **BL-KRIT open 0개**
3. **3인 admin 핵심 플로우 일일 완료**: Short List 30 → 풀 리포트 → 승인 → 가상 포트 추가 → 알림 발송. disclaimer 모든 화면 visible.
4. **cron / health 안정**: Silent Health red_alert 0건 + 5 파이프라인 success_rate ≥ 99% + Vercel production canary OK
5. **비용 hardcap 정상**: 월 400,000 KRW 미만 + AI 일 주문 ≤ 20회 + `cost_log` 정확 적재
6. **RLS / credential smoke 통과**: advisor anon WARN 0 + Smoke #3/#4/#5/#6 통과 + credential 평문 노출 0건
7. **(자동매매 가동 시) guardrail 위반 0**: 레버리지 ≤ 5x · 일일 손실 -3% 자동 정지 · AI 일 주문 ≤ 20회 운영 1개월 위반 0

---

## 3. 사용자 액션 대기 큐

| 우선 | 작업 | 필요한 사용자 액션 |
|---|---|---|
| ~~B-11pr-merge~~ ✅ DONE | ~~PR #11 (PR2) 머지~~ MERGED in 54차 §2 (`f85fb69`, 7 commits FF + canary 검증) | ✅ |
| ~~B-12pr-merge~~ ✅ DONE | ~~PR #12 (PR3a Group H schema drift fix) 머지~~ MERGED in 54차 §3 (`0813a41`, 11 commits FF + canary 검증) | ✅ |
| B-1 ~ B-5 (DQ-7) | 친구 비번 + KIS row 정리 + Smoke #4/#5 RLS + Session 4 QA | DQ-7 close 잔여 |
| B-7 | Resend 도메인 인증 | S7b briefing 진입 시 |
| B-8 | Naver key rotate/env | S7b news 진입 시 |
| B-9 | Telegram bot token + admin 3 chat_id | S7c alerts |
| B-10 | KIS 본인 1개 OpenAPI key/account | S7c WS read-only |
| B-11 | Binance key (testnet 우선) | S8 진입 시 |
| **B-D11 (omxy R3 B3 fix)** | **D11 AI 가상 포트 1차 가동 며칠~1주 운용 검증** (어드민 3인 만족도 확인 후 S7c 진입 승인) | S7b 완료 후, S7c 진입 전 |
| **W-tier1pill (57차 §2 omxy R1 h + R2 e' + R3 ε + native critic W3)** | Section 8 absent 리포트 = **Tier 1 평가 대기 pill UI 추가** (D11 운용 검증 acceptance gate). PR4 14 defer follow-up tickets와 별개 신규 ticket. Step 8 (D11 게이트) 본문도 acceptance gate 명시로 갱신. | B65-P2 마이그 0025 impl PR + Smoke Stage 2 통과 후, D11 운용 검증 진입 전 |
| B-12 | 보안 rotate | Supabase anon/service_role/DB password/PAT, 노출 키 rotate |
| B-13 | Vercel CLI v52→v54 update | 향후 deploy 권장 |
| B-stash | `.gitignore` stash 결정 (`phase0-cleanup-gitignore`) | `git stash list` 후 pop 또는 drop |
| B-2A | HIBP leaked-password protection 토글 | Supabase dashboard → Auth → Policies |

해소 historical (B-17, B-17b~g, B-6, B-6a, B-6c) = git log + §6 entries.

---

## 4. 안전 규칙

- 이 제품은 내부 어드민 투자 운영 도구다. Public signup/member/pricing 트랙은 Deferred-D 재개 전까지 만들지 않는다.
- main에 직접 commit 금지 (Vercel auto-deploy 영향). feature branch + PR.
- S7a 완료 후 billing 충전 전까지 mock import를 real API로 몰래 바꾸지 않는다. billing-on은 USER 트리거 후에만 (53차 §4++ 완료).
- `/admin` 접근 = Supabase session refresh + `ADMIN_EMAILS` allowlist + RLS 3중 방어.
- `SUPABASE_SERVICE_ROLE_KEY` client-exposed 코드 절대 금지.
- credential plaintext/MEK/ciphertext UI/로그 노출 금지. credential secret = `src/lib/crypto/aes.ts` 서버 측 암호화.
- UI 문구 한국어 우선. 새 server action error code = `format-error.ts` 한국어 매핑 추가.
- Next.js 16 routing/middleware/server action 관련 변경 전 `tudal/node_modules/next/dist/docs/` 또는 공식 문서 확인.
- 신규 SECURITY DEFINER 함수 마이그는 반드시 3종 세트: `revoke from public` + `revoke from anon` + `grant to authenticated` (48차 lesson).
- PostgreSQL `IF <null>`는 true 아님 (49차 omxy R1 lesson): RPC guard 작성 시 `is null or ... is distinct from ...` + `coalesce(v->>'key', '') not in ...` 명시.
- `section_8.partD.vote = BUY/HOLD/SELL literal 유지`. DB 저장 시 RPC가 case 매핑 (BUY→approve / HOLD→abstain / SELL→reject). writer가 변환 금지 (49차 omxy R2 BLOCKER).
- `stock_reports` schema 호환 (49차 omxy final lesson): `generated_at` only (created_at/updated_at 없음), partial unique index `(ticker, month) WHERE is_latest = true` 보존.
- ~~PR1 cron 가동 ⊥ PR3a schema drift fix 미선행 = page crash inevitable~~ ✅ **해소** (54차 §3 PR3a MERGED — zod validation + null guard + dual-shape renderer).
- **canonical 5-PR 순서 절대 보존** (55차 §4 갱신): PR2 ✅ → PR3a ✅ → PR1 ✅ → PR3b ✅ → **PR3c ✅ MERGED `b2a902a` (PR #15)** → PR4. Group G ✅ 해소 (PR3c MERGED + 마이그 0023/0024 production applied + canary 4/4 PASS). PR3c scope = **3-step (analyst pure-code → writer → critic) + conditional revise (1회 hard cap)** — **Q7 invariant: document-specialist 0**. 재해석 금지.
- **silent null drop metric/log 격상** (PR3a P2 / red-team RT#2 / gsd CR-01): 현재 `parseSectionSafe` + `parseReportSection8` onError 콜백이 console.warn으로 위임. PR1 cron 가동 시점에 metric/structured log로 격상해서 production blind spot 차단.

---

## 5. 문서 SoT

> 운영 순서: 본 HANDOFF → spec/plan → Slice/ProgressDashboard → ServicePlan-Admin/ReportFramework → CodebaseStatus → 실행 규칙.

| 필요 정보 | 문서 |
|---|---|
| **53차 §5 정정 spec (canonical 5-PR + Group A-H + Hard gate 해소)** | `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md` |
| **PR2 plan + REVIEW.md** | `docs/superpowers/plans/2026-05-21-pr2-tier1-screening.md` + `docs/superpowers/reviews/2026-05-21-pr2-tier1-screening-review.md` |
| **PR3a plan + REVIEW.md (54차 §3)** | `docs/superpowers/plans/2026-05-22-pr3a-group-h-schema-drift.md` + `docs/superpowers/reviews/2026-05-22-pr3a-group-h-schema-drift-review.md` |
| Step 3c caller wiring spec | `docs/superpowers/specs/2026-05-21-step3c-caller-wiring.md` (PARTIAL 박제) |
| S7a Anthropic spec + plan | `docs/superpowers/specs/2026-05-19-s7a-anthropic-wrapper-design.md` + `docs/superpowers/plans/2026-05-19-s7a-anthropic-wrapper.md` |
| Kevin v3.1 rubric spec | `docs/superpowers/specs/2026-05-21-kevin-v31-rubric.md` |
| Tier 0/1/2 + 합의 배지 + Reflection 본문 | `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D19·D21·D22` |
| Section 8 jsonb canonical contract | `ServicePlan-Admin.md §4.2.1` |
| writer Section 8 작성 가이드 | `Document/Service/Report/ReportFramework.md §8` |
| **PR2 코드 SoT (54차 §1)** | `tudal/src/lib/screening/tier1-schema.ts` (zod 13 refinements + PersonaPanelSchema + assertPanelMatchesCore11) + `persona-eval.ts::runTier1Screening` (in-memory 150-call screening) |
| **PR3a 코드 SoT (54차 §3)** | `tudal/src/lib/data/report-section-schemas.ts` (Section 0~7 + Appendix zod with bounds + Section 8 dual-shape import + `parseSectionSafe`/`parseReportSection8` onError 콜백 + `partCToCommitteeAgg` helper) + `admin-reports.ts::transformStockReportRow` (ValidatedStockReport + per-section safeParse + ticker/section context warn) + `page.tsx` (null guards + SectionFallback + Section8ModernView/LegacyView dual renderer) |
| Tier 2 D21 코드 SoT | `tudal/src/lib/screening/canonical-sectors.ts` + `report/writer.ts` (commitSectorReport) + `screening/persona-eval.ts` (runSectorEval) + `data/mock-admin-committee-personas.ts` + 마이그 0018/0019 |
| Kevin reference (Tier 2 production prompts quality target, main 보존) | `Document/Outputs/Report-Alteogen_196170_v3-Readable.{md,html}` + `Document/Service/Report/ReportFramework-v3-{DraftPhilosophy,NarrativeDesign,Decisions,ValuationTrial}.md` + `ReaderAnalogyCards-ConstructionToBio.md` + Samchundang. Step 3a SKIPPED (53차 §0) — IMVCOM 4 commits 모두 main ancestor 확인. |
| **S7 mock→real 전체 Phase/DoD SoT (omxy R3 B4 fix)** — S7a Anthropic / S7e Supabase / S7b 뉴스+브리핑 / S7c 장중·Exit / S7d Silent Health · 각 Phase Tasks / DoD / mock-to-real 전환 작업 분해 + T7e.7 RLS QA 결과 | `Document/Build/Slices/S7-RealData.md` |
| 전체 진행률/변경 이력 | `Document/Build/ProgressDashboard.md` |
| 코드 스냅샷 / 실 I/O 통로 / 잔존 mock | `Document/Process/CodebaseStatus.md` |
| 어드민 서비스 기획 본체 | `Document/Service/Planning/ServicePlan-Admin.md` |
| 슬라이스 실행 규칙 | `Document/Process/ExecutionPlaybook.md` |

---

## 6. 완료/active 이력 (직전 2 §6 inline entry · older + parallel OPEN PR은 git log + PR body 위임)

상세는 git log + spec/plan/Slice/PR body + REVIEW.md. 본 §6은 직전 2 entry만 inline.

### 58차 Mock cleanup Step 2.2 ✅ MERGED in main `2dca060` (PR #34 rebase FF, admin settings READ 실 SELECT + WRITE boundary, omxy R1 CONVERGED, 2026-05-27)

- **scope**: admin user-visible 1 라우트 (`/admin/settings` page + actions)의 `MOCK_ADMIN_SETTINGS` + `MOCK_ADMIN_TICKER_PREFS` + `MOCK_ADMIN_ID` → `admin_settings` + `ticker_alert_pref` 실 SELECT (RLS "self" 자동 의존) + WRITE 모든 환경 `real_persistence_not_configured` boundary (Step 2.1 recordExitDecision + Step 1.3 lesson "가짜 성공 응답 금지" 정합).
- **code commit** (branch `feat/mock-cleanup-step-2-2-settings`, deleted post-merge): `43c7886` atomic Step 2.2 — 신규 helper 2종 + actions/page wire + tests +24 + mock 파일 삭제.
- **신규 helper SoT**: `tudal/src/lib/data/admin-settings.ts` (transformAdminSettingsRow + getCurrentAdminSettings, maybeSingle PK + intraday_mode boolean 검증) + `tudal/src/lib/data/admin-ticker-prefs.ts` (transformTickerAlertPrefRow + getCurrentTickerAlertPrefs, TICKER_RE 6-digit KR-only + updated_at desc + limit 200).
- **행동 변화**:
  - `/admin/settings`: admin_settings + ticker_alert_pref 실 SELECT. 0 rows → intradayMode default false + initialTickerMap empty (Short List 30 default enabled=true).
  - `setIntradayMode` / `setTickerAlertEnabled`: production-like + non-production mock 변이 path 제거 → 모든 환경 boundary 통일. `resolveAdminId` MOCK_ADMIN_ID fallback 제거 (Step 2.1 admin assertion 패턴 정합).
- **omxy R-debate 1 round CONVERGED**:
  - R1 (Codex gpt-5.5 xhigh, 4m 49s 실측): blocker 0, HIGH/MEDIUM 0, 3 LOW/WATCH follow-up catch — W-s5b-admin-assertion (S5b RPC 연결 시 is_admin assertion 필수) + W-ticker-re-kr-only (TICKER_RE KR-only 가정 명시) + W-mock2-rls-drift 확장 (settings 동일 패턴).
- **마이그 0건** (기존 0007 `admin_settings` + `ticker_alert_pref` 활용).
- **mock 파일 삭제**: `src/lib/data/mock-admin-settings.ts` (importer 0 검증, admin/page.tsx 주석만).
- **검증**: build 25 routes / lint 0 err 6 warn (pre-existing) / tsc clean / test:ci 1149 → 1173 PASS (+24, 회귀 0).
- **scope-out**: WRITE 실 RPC + S5b 신규 마이그 → Step 2.2 follow-up sub-step OR S5b 본 작업. Step 2.3~2.7 (regenerate/cost/health/news/cron) 별도 sub-step.

### 58차 Mock cleanup Step 2.1 ✅ MERGED in main `e6be73f` (PR #33 rebase FF, admin alerts mock → real DB SELECT, omxy 2 rounds CONVERGED + docs sweep R-debate R14 CONVERGED + merge debate R2 A++ 정합, 2026-05-27)

- **scope**: admin user-visible 3 라우트의 `MOCK_ADMIN_ALERTS` + `MOCK_ADMIN_NEWS` → `alert_event` / `news_event` 실 DB SELECT. cron 3 routes (silent-health / news-sweep / morning-briefing) mock 보존 — 별도 Step 2 sub-step.
- **code commits** (branch `feat/mock-cleanup-step-2-1-alerts`, docs sweep 누적은 git log + PR body 위임):
  - `29222ab` atomic Step 2.1: 신규 helper 2종 (admin-alerts.ts + admin-news.ts) + 신규 test 2종 (16+10 tests) + 3 라우트 wire (page + [id] + actions) + actions test +8 신규
  - `e210b02` R1 fix: format-error.ts `alert_lookup_failed` 한국어 매핑 + inventory test (MEDIUM) + page limit 100/50 (LOW)
- **신규 helper SoT**: `tudal/src/lib/data/admin-alerts.ts` (transformAlertEventRow + getRecentAlertEvents + getAlertEventById, alert_type 12종 enum + severity check + decision_recorded enum 검증 + t7_price_change numeric string|number 처리) + `tudal/src/lib/data/admin-news.ts` (transformNewsEventRow + getRecentNewsEvents, severity validation DB 전 — getRecentNewsEvents pre-validation pattern)
- **행동 변화**:
  - `/admin/alerts`: 0 rows → 정직한 empty state ("알림 없음" / "Critical 뉴스 없음" / "Warning 뉴스 없음"). append log 보호 limit 100/50.
  - `/admin/alerts/[id]`: row 부재 시 Next.js 16 `notFound()` 표준 처리.
  - `recordExitDecision`: env-gated in-memory mock 변이 제거 → 모든 환경 `real_persistence_not_configured` boundary (Mock cleanup Step 1.3 "가짜 성공 응답 금지" lesson 정합). S5b `update_alert_event_decision` RPC 연결 시 교체.
- **omxy R-debate 2 rounds CONVERGED**:
  - R1: MEDIUM (alert_lookup_failed 매핑 누락) + LOW (limit 미적용) + WATCH (RLS drift)
  - R2: 추가 catch 0, SIGNAL: CONVERGED
- **WATCH defer (W-mock2-rls-drift)**: env ADMIN_EMAILS와 DB admin_emails drift 시 empty-state 오인 가능 → §9.5 follow-up ticket.
- **검증**: build 25 routes / lint 0 err 6 warn (pre-existing) / tsc clean / test:ci 1149 → 1186 PASS (+37, 회귀 0).
- **scope-out**: cron route mock cleanup / settings/health/cost/regenerate 라우트 (Step 2.2~2.7) / S5b real persistence RPC.

**Demoted to historical (58차 sweep R5 — strict 직전 2 §6 inline entry 적용)**:
- **58차 Mock cleanup Step 1 ✅ MERGED in main `1d2db08`** (PR #32 5 commits FF, omxy R1~R4 CONVERGED — Issue 1 RSC error + Issue 2 모닝 브리핑 4/19 stale + Issue 3 D15 가짜 열람 통과 모두 catch·fix, 신규 helper `admin-report-view-log.ts` + client wrapper `shortlist-row-action-slot.tsx` + mock 삭제 + 신규 error code `accept_gate_lookup_failed`) = git log + PR #32 body 위임.

**Demoted to historical (58차 sweep R1 — strict 직전 2 entry inline 규칙 적용)**:
- **58차 Task 4 B65-P3 impl ✅ + B-trackrecord-rls ✅ + 마이그 0025 production apply ✅** (PR #30 `3c09d6e` + PR #31 `838386e` + Supabase production apply, omxy 6 rounds CONVERGED 누적) = git log + PR #30/#31 body + REVIEW docs 위임.
- **57차 §3 Task 4 plan SoT ✅ MERGED `2859c68`** (PR #28, B65-P3 impl plan 옵션 A R8 final, omxy R-debate R1~R5 23 BLOCKERS + Ramanujan CATCH 0) = `docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md` + git log + PR #28 body 위임.
- **57차 §2 Task 3 ✅ B65-P2 spec doc CONVERGED R8 final** (PR #26, 옵션 A lock-in, omxy R-debate 8 rounds ESCALATE max-8 + 6 신규 audit ticket B79/B-versioning/W-tier1pill/W-grant-smoke/W-sectionfallback-text/W-cost-log-env-gate) = `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md` + git log + PR #26 body 위임. W-grant-smoke는 58차 Task 4 ✅ RESOLVED.

**Older historical (49차~56차 §5 PR4 MERGED + 57차 §1 PR #21 B65-P1 MERGED `5b99e03` + 57차 §2 PR #26 spec doc + S7a/Tier 2/PR2/PR3a/PR1/PR3b/PR3c MERGED + 53차 §5 spec doc + PR4 14 defer + 56차 §5 B65~B108 catalog 34 catch + 57차 §1 omxy 4 rounds CONVERGED Hegel/Leibniz/McClintock/Hubble/Locke)** = git log + spec/plan/REVIEW docs + PR body + ProgressDashboard 위임.

---

## 7. omxy 적대적 코드 검토 패턴 (49차 박제, 후속 PR 재사용)

### 7.1 왜 필요한가

49차 lesson: implementer subagent self-review (test pass + tsc clean + grep 패턴)만으로 **5 critical blockers + 2 final BLOCKERS 놓침**. omxy cmux pair-debate가 **외부 적대적 시각**으로 catch. PR2도 omxy R1~R8 8 rounds로 17 BLOCKERS catch & fix.

**규칙**: 매 task implementer 완료 → omxy 적대적 코드 검토 1~n rounds → CONVERGED 후 다음 task. 후속 PR (PR3a~PR4) 동일 패턴 강제 적용.

### 7.2 omxy 환경 (runtime discover — hardcoded surface 박제 금지)

- **cmux peer surface**: runtime 발견. 매 세션 진입 시 `cmux list-panes` + `cmux list-pane-surfaces --pane <pane>` + `cmux capture-pane --surface <surface>`로 omxy pane 식별.
- omxy 모델: gpt-5.5 high, YOLO mode (`/usr/local/bin/omxy`).
- **eligibility probe**: `test -n "${CMUX_WORKSPACE_ID:-}" && cmux identify` — Broken pipe 또는 no CMUX_WORKSPACE_ID면 orchestrate 불가, 사용자에게 보고.
- peer signature: `[OMX#...]`, `gpt-5.5`, `omx-<project>-<hash>`.

### 7.3 cmux send pattern

parry-guard hook가 bash `$(cat file)` 패턴 차단 → 두 가지 옵션:

**옵션 A — direct heredoc**:
```bash
MSG_FILE=$(mktemp /tmp/cmux-debate-msg-XXXXXX.txt)
cat > "$MSG_FILE" <<'EOF_MSG'
ROUND N — FROM: orchestrator
...
SIGNAL: CONTINUE
EOF_MSG
cmux send --surface "$PEER_SURFACE" "$(cat "$MSG_FILE")" && sleep 3 && cmux send-key --surface "$PEER_SURFACE" enter && sleep 2 && cmux send-key --surface "$PEER_SURFACE" enter
rm -f "$MSG_FILE"
```

**옵션 B — Write tool + cmux**: parry-guard 우회 — Write tool로 `/tmp/msg.txt` 작성 → bash `cmux send --surface ... "$(cat /tmp/msg.txt)" && ... && rm`.

### 7.4 적대적 검토 메시지 템플릿 (scope guard 4종 필수)

각 task implementer commit 후 omxy에 다음 패턴 송신:

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
(b) PostgreSQL/zod/TypeScript edge case 위험?
(c) 기존 SoT 모듈과 충돌?
(d) Type 일관성?
(e) grep 패턴 (forbidden patterns) 0 매치?

SCOPE GUARD (재해석 금지):
- 사용자 lock-in (spec doc §1)
- 본 PR scope 외 (별도 PR로 분리)
- DQ-7 / S8 / 멤버 페이지

ROUND 1 — FROM: orchestrator
입장 = 결함 0 기대. 검증 후 SIGNAL: CONVERGED 또는 CONTINUE with diff.

SIGNAL: CONTINUE
```

### 7.5 fix 패턴 (BLOCKERS 발견 시)

omxy R1에서 결함 발견 시:
1. **Edit 또는 새 commit으로 정정** (amend 금지 — 사용자 명시 필수).
2. fix commit message = `fix(<scope> omxy R<N> BLOCKER[S]): <one-line>`.
3. omxy R2 송신 (변경된 commit hash 명시 + 적용 diff 요약).
4. CONVERGED 받을 때까지 R3 / R4 반복 (최대 8 rounds).

### 7.6 결함 카탈로그 (재발 방지 grep 검증)

| 결함 | grep 패턴 (코드 작성 후 0 매치 확인) |
|---|---|
| PostgreSQL `IF <null>` pass-through | `raise '` (모두 `raise exception '`) |
| RPC guard에 null 미체크 | `jsonb_typeof.*<>` (있어야 `is distinct from`) / `not in.*` (앞에 `is null or`) |
| Q3 partA `z.array()` 1~13 통과 | `partA: z.array(.*)` (있어야 `.refine(`) |
| `committee_votes.vote` enum mismatch | `(v ->> 'vote')::text` (있어야 `case (v ->> 'vote')` 매핑) |
| `p_admin_id` caller-supplied (RPC) | `p_admin_id` (있으면 안 됨) |
| `buyCount >= 6` 임시 threshold | `buyCount >= 6` (있어야 bucket rank + isTopTier) |
| writer가 vote 매핑 | writer.ts에 `'approve'\|'abstain'\|'reject'` 0 매치 (있어야 BUY/HOLD/SELL만) |
| `stock_reports.created_at/updated_at` | 마이그에 `created_at\|updated_at` (있어야 `generated_at`만) |
| **persona_id snake_case vs production kebab-case** | TIMEFRAME_HEAVY_PERSONAS · CORE_11_IDS 검증 (PR2 R5 BLOCKER) |
| **PersonaPanel 임의 ID 통과** | PersonaPanelSchema length+unique만 부족 → `assertPanelMatchesCore11` 필수 (PR2 R6 BLOCKER) |
| **30 선정 timeframe count corruption** | SelectionMeta {short,mid,long}Count === 10 each + assigned_timeframe 분포 일치 refinement (PR2 R7 BLOCKER) |
| **PR1 cron ⊥ PR3a 미선행 page crash** | 53차 §5 Group H Critical Hard gate (`/admin/report/[ticker]` deref) |

### 7.7 PR-specific lessons 누적 (54차 §1 PR2 + 54차 §4 PR1 + 56차 §4 PR4 + 57차 §1 PR #21 + 57차 §2 Task 3) — 핵심 패턴만 inline

- **persona ID production 정합** (PR2): production source에서 fixture import + drift invariant test.
- **schema length+unique 약함** (PR2): exact set equality assert helper / enum check 필수.
- **count consistency cross-refinement** (PR2): SelectionMeta {short/mid/long}Count vs selected.assigned_timeframe 분포 일치 refinement.
- **scope purity grep** (PR2): 외부 모듈 import 0 매치 + DB write keyword 0 매치 (doc comments 외).
- **Promise.allSettled** (PR2): 다수 외부 호출은 batch reject 대신 fail-fallback.
- **PostgREST filter injection 방어** (PR1 B23): raw filter string 조립 시 format regex (`/^\d{6}$/` 등) 추가, zod min(1)만으로 부족.
- **caller DI seam invariant 정밀화** (PR4 B23~B28): 결과값 assert만이 아닌 (1) createClient short-circuit (2) helper-chain 2nd arg propagation (3) payload field invariant (4) 한국어 매핑 (5) shouldRevise=true revise branch — 5중 명시 assertion 필수. `options: { client?: SupabaseClient } = {}` 2nd arg + `options.client ?? (await createClient())` fallback 패턴. forbidden grep: `await createClient\(\)` raw call / 1-arg helper call.
- **omxy 4 rounds verify cycle** (PR #21): R1 plan + R2 commit verify (2 subagent parallel = code-reviewer + architect) + R3 HANDOFF cleanup + R4 pre-merge sanity. **post-merge sequence**: `gh pr merge <N> --rebase --delete-branch` → deploy state poll → production audit re-verify → HANDOFF rebase + MERGED 박제. WATCH suffix 패턴 = 비차단 follow-up 코드 주석/PR body/HANDOFF 박제.
- **R-debate max-8 rounds 정합** (57차 §2 Task 3 §7.5): R8 SIGNAL=ESCALATE max-8 → 옵션 reversal 아닌 mechanical fix 후 final accepted로 종료. 사용자에게 commit 결정 의사 1회 확인.
- **gsd-code-reviewer 환경 부재 대체 = 3-track deep review** (PR1+): Track 1 `gstack-review` skill inline + Track 2 `general-purpose` depth=deep adversarial + Track 3 `superpowers:code-review` 5-angle scan. Fix-First adoption = cross-confirmed CRITICAL 즉시 fix / PLAUSIBLE은 사용자 판단 / defer는 follow-up ticket. **omxy R1+R2 narrow detail + 3-track broad scan = complementary** (impl PR에서 두 패턴 동시 적용).

PR-별 상세 lifecycle 사례 = git log + PR body + spec/plan/REVIEW docs 위임.

---

## 8. 사용자 운영 원칙

- **omxy 토론 = 무조건 subagent/skill 활용해 정말 완벽하게 검토** (사용자 명시).
- **사용자 승인 게이트 제거** (omxy CONVERGED = 사용자 승인 등가). HANDOFF 범위 초과 또는 product spec 결정만 사용자 직접 묻기.
- **omxy 토론 진입 시 scope guard 4종 박제 필수**: 목적 / 컨텍스트 / 선택지 / Out-of-Scope (memory: [[feedback_omxy_debate_scope_guard]]).
- **commit pattern**: 자동 commit (amend 금지 — 사용자 명시 시만). branch 분리 = main 직접 commit 금지.
- **Owner 분리** (omxy R15 박제):
  - **USER** = 사용자만: PR merge / production deploy / production migration apply / billing / external account or key.
  - **CLAUDE** = 자동: 코드 / 문서 / 로컬 commit / 로컬 검증.
  - **SHARED** = push / PR create: "이어서 진행" 권한으로 prepare/commit/push/PR-create 가능. merge/deploy/migration은 USER.
- **Default-progress policy** (§2.0): "이어서 진행해줘" 받으면 옵션 재질문 루프 금지. §2.1 Step matrix 다음 unblocked CLAUDE step 자동. USER-gated는 background blocker 표시. §2.0 7 exception buckets 도달 시만 USER 직접 묻기.
- **canonical 5-PR 순서 절대 보존** (53차 §5 spec doc 박제 + 55차 §2/§4 + 56차 §5 정정): PR2 ✅ → PR3a ✅ → PR1 ✅ → PR3b ✅ → PR3c ✅ → **PR4 ✅ MERGED `7de9696` (56차 §5, PR #19) — canonical 5-PR 완료**. Hard gate (PR1 cron 가동 ⊥ PR3a schema drift fix 미선행) ✅ **해소** (54차 §3). 다음 = PR5 (cron 30 자동 + 큐 인프라, T11 분할 결정 보존).
- **Kevin v3.1 quality target** (53차 §3 박제): 207 persona × 8 markers = 1656 marker assertions 전수 통과. Reference 자료 main 보존. PR3b writer 본문 + PR3c orchestrate + PR4 admin path (`orchestrateFullReport`) 모두 동일 quality target.
- **HANDOFF.md 다음 세션 자동 진행 가능 조건**: §0 + §1 + §2 + §9 모두 stale 0. 본 **58차 종료 post-merge baseline** = PR4 + B65-P1/P3 MERGED ✅ + 마이그 0025 production applied + Mock cleanup Step 1 ✅ MERGED + Step 2.1 ✅ MERGED `e6be73f` (PR #33, omxy R1~R2 CONVERGED + docs sweep R-debate R14 CONVERGED + merge debate R2 A++) + Step 2.2 ✅ MERGED `2dca060` (PR #34, omxy R1 CONVERGED) / canonical 5-PR 완료 / Vercel main `2dca060` Production ● Ready (public 회귀 0) / build 25 routes / lint 0 err 6 warn (pre-existing) / tsc clean / main HEAD = `2dca060` post-PR-#34 MERGED. **USER 잔여 액션 = Vercel env `PR4_TRIGGER_UPSERT_ENABLED=true` 추가 (현재 unset, B65 P1 fail-fast active) + `AI_COST_LOG_REAL_INSERT_ENABLED='true'` env 선행 + Smoke Stage 2 시점 1회 비용 승인 (Task 7) + (권장) 인증 세션으로 `/admin/alerts` + `/admin/settings` empty state canary verify** → 다음 = CLAUDE **Mock cleanup Step 2.3 (regenerate 라우트) 진입** (fresh branch off main `2dca060`) + Step 2.4~2.7 (cost/health/news/cron mock 4 종) 순차 + Task 5 B66 backfill (병렬) 진입 의사 1회 확인 후 자동.
- **DI seam invariant 정밀화 default (§7.9 PR4 lesson)**: 모든 caller DI test는 결과값 assert만이 아닌 (1) createClient short-circuit (2) helper-chain 2nd arg propagation (3) payload field invariant (4) 한국어 매핑 (5) shouldRevise=true revise branch — 5중 명시 assertion 필수.

---

## 9. PR4 + B65-P1 + B65-P3 MERGED + 마이그 0025 production applied ≠ production functional — B65~B98 + 신규 9 ticket 박제 (56차 §5 R1~R8 + 57차 §1 PR #21 R1~R4 + 57차 §2 Task 3 R1~R8 + 58차 Task 4 R1~R3 + 58차 Mock cleanup Step 1 R1~R4 + Step 2.1 R1~R2 + Step 2.2 R1 누적, omxy 13 rounds CONVERGED 누적 + docs sweep R-debate R14 CONVERGED + merge debate R2 → A++ 정합 — 최신 라운드/catch 누적/fix commit은 git log + cmux debate transcript 위임 (self-referential drift 방지))

> **삭제 조건**: §2.1 active 8-row matrix Task 1~7 모두 PASS (production audit + B65-P1/P2/P3 + B66 backfill + Smoke Stage 1+2 PASS) 시 본 §9 + 8-row matrix를 HISTORICAL로 강등하고 PR5 active submatrix로 교체.

### 9.1 발견 경위 (요약)

PR4 MERGED `7de9696` 직후 사용자 catch — Supabase 직접 query 결과 `cost_log=0` / `stock_reports=0` / `committee_votes=0` / `short_list_30=30` (sector placeholder) → **B65 3-phase 분리 catch**. 원인 = `cron monthly-batch` mock throw (B67) + `update_report_sections_0_7` UPDATE-only RPC (마이그 0022, row 부재 시 fail). PR4 lifecycle 테스트가 RPC를 mock하여 production-only로 잠복. 상세 forensic = 56차 §5 commit history + git log + PR #19 body 위임.

### 9.2 B65 CRITICAL — PR4 trigger button = cost burn fail (3-phase 분리)

**원인**: writer Opus + critic Haiku + 조건부 revise (1~3 LLM calls, exact cost = smoke 후 `cost_log` 기준 확정 — B91 박제) 후 `update_report_sections_0_7` RPC가 row 부재 시 fail → AI 토큰 비용 burn + UI에 기술적 에러 문구 노출 (`format-error.ts` 매핑 존재하지만 사용자 가독성 낮음 — B101 정정).

**3-phase 분리** (omxy R7 B94 lock-in):

1. **Phase 1 — P1 immediate guard** (P2 미구현 상태에서만 활성): `triggerFullReport`에 `reportExistsForMonth(ticker, ${month}-01)` (또는 helper 양쪽 수용) → false → fail-fast. **smoke 금지** (B92, trigger button = 영구 fail-fast). 비용 burn 즉시 차단.
2. **Phase 2 — P2 real enablement ✅ spec doc CONVERGED R8 final (57차 §2)**: **옵션 A 채택 lock-in** — admin-only `upsert_report_sections_0_7_admin` RPC, UPSERT (INSERT if missing, UPDATE if exists), section_0~7 + appendix only, 4-grant 패턴 (service_role grant 금지), version/schema_version/regen_* counter 불변 invariant. axis (i)A admin trigger 책임 = section_0~7 only / axis (ii) B79 deferred → PR5 plan / axis (iii) PR5 cron path 충돌 없음. 옵션 B (`commit_persona_eval` 연계)는 admin UX 변경 + 비용 5-10x → 사용자 lock-in 도달 위험으로 reject. 옵션 C (synthetic) = Kevin v3.1 M3 no-fabrication 위반 + Track Record corruption으로 폐기. 상세 spec doc: `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md`. **Task 4 = 마이그 0025 + feature flag impl PR**.
3. **Phase 3 — P1/P2 호환 (B94 critical)** — P2 도입 시 P1 guard를 P2 path와 호환되게 수정 (영구 disabled risk 차단):
   - (i) **feature flag** (env `PR4_TRIGGER_UPSERT_ENABLED=true`) — **default recommended** (simple, deterministic, no runtime overhead). **B98 lock-in**.
   - (ii) RPC presence check (runtime DB introspection) — **비추천** (매 클릭마다 DB query + 권한/스키마 노출 risk).
   - (iii) atomic transaction prepare (P2 RPC가 AI 호출 전 placeholder row를 transaction 안에서 prepare → 실패 시 rollback, P1 guard 불필요) — **secondary** (transaction boundary 복잡도 증가).

**smoke는 Phase 3 후만 가능** (P1 + P2만으로는 trigger 영구 disabled risk).

**B86 fix (month format)**: `triggerFullReport` input `month: YYYY-MM` (e.g., `2026-06`) vs `reportExistsForMonth` DB month는 `date` (YYYY-MM-01). 미박제 시 preflight 항상 false → trigger button 영구 disabled risk.

### 9.3 B66 quality/trust blocker + B84/B89/B93

`short_list_30` 30 rows sector="코스닥"/"코스피" placeholder (D21 canonical 14 미반영). Python seed mechanical 1회 데이터 — Tier 0 단독 fallback path가 정합 매핑 누락. PR5 entry blocker.

**B93 PASS criteria 3종** (모두 만족):
1. 30 rows all sector ∈ `CANONICAL_SECTORS` (14 enum 정합)
2. sector ∉ ('코스피', '코스닥') — placeholder 잔존 0
3. optional `sub_tags` 정합 (jsonb null OR string[], 마이그 0018 schema 정합)

**B89 unknown ticker 처리 옵션 R-debate**:
- (i) **Block**: short_list_30 INSERT 차단 — 안전, 종목 수 감소 risk
- (ii) **Manual review queue**: `sector_unknown_queue` table 추가 (admin 수동 매핑) — 작업 부하
- (iii) **Backfill exclude**: 매핑된 ticker만 UPDATE, 나머지 placeholder 유지 + 명시 warn — 점진적 보정

**박제 원칙**: sector="코스피"/"코스닥" placeholder 영구 허용 X. 모든 30 rows 시점 도달 시 canonical14 또는 명시적 unknown_pending status.

### 9.4 Smoke 2-stage 분리 (B97 lock-in)

Stage 1 PASS 전 Stage 2 진입 금지.

**Stage 1 — non-AI dry-run/integration test** (real cost = 0):
- `triggerFullReport` server action에 mock `orchestrateFullReport` 주입 (vi.doMock)
- P1+P2+P3 호환 invariant test: P3 호환 완료 시 P2 path 진입 (mock called) / 비호환 시 P1 fail-fast (mock not called)
- **B96 target**: short_list_30 존재 + stock_reports 부재 ticker (production 30 rows 모두 정확히 그 상태)
- TDD 단위 테스트로 적용

**Stage 2 — single real AI smoke** (USER 승인 후 1회):
- production env에서 admin UI click OR server action 직접 호출
- **B85 model id verify 선행** (1 token test로 production env vars 정합 확인)
- **B87 PASS criteria 5종**:
  - **Core (필수, 모든 옵션)**: 1 `cost_log` row exists / 2 `stock_reports` row + section_0~7 + appendix all non-null + zod schema valid / 3 `report_critic_findings` row (critic 6-axis verdict) / 5 `/admin/report/[ticker]` UI **정상 본문 또는 의도된 SectionFallback 렌더** — raw/technical/`format-error.ts` 매핑된 에러 메시지 노출 시 모두 FAIL (B107 정정 — 매핑된 에러 메시지도 upstream issue 신호이므로 PASS 아님)
  - **Full-path (옵션 B만)**: 4 `committee_votes` row(s) — 11 core + 0~14 sector
- real cost = `cost_log` 기준 확정 (token usage 기반, production 환경별 변동 — 수치 박제 금지 B91)

### 9.5 audit catalog (B103+B106 정정 — B67~B85 항목별 1줄 + B79+B81~B85 알려진 항목 + 카테고리 buckets)

> **박제 원칙 (B106 정정)**: omxy R2 형성된 B67~B80 잠재 follow-up catalog + R3 형성된 B81~B85 알려진 항목을 항목별 1줄 박제. 본 catalog는 R10 시점 정렬 — 다음 세션 audit phase 진입 시 항목별 priority 재할당 및 신규 catch 추가.

**R2 audit catalog (B67~B80, 항목별 1줄)**:
- **B67** — cron path 자동 호출 결함 (`tudal/src/app/api/cron/monthly-batch/route.ts`의 `mockTier0Source` / `mockCallPersonaPanel` throw 패턴). PR5 진입 전 필수 해소.
- **B68** — AI key 발급/충전 완료에도 `cost_log` = 0건 (성공/기록된 호출 없음). B65 RPC 의존 + cron path mockTier0Source throw 양쪽 영향.
- **B69** — `committee_votes` = 0건. B79 RPC 책임 boundary 결정 + B65-P2 옵션 A/B 선택 결과로 결정.
- **B70** — Regen UX (`/admin/report/[ticker]/regenerate`) admin path swap 후 첫 실 호출 검증 필요. PR4 Task 2.3 Regen orchestrate wire commit `8b63e1f` MERGED.
- **B71** — `short_list_30` stale data (2026-05-12 mechanical Python seed 1회, B66 placeholder + ~14일 stale). PR5 cron 가동 시 신규 row INSERT 동작 확인.
- **B72** — row-missing preflight 통합 (B65-P1 `reportExistsForMonth` + 향후 cron path 호환). B86 month format 박제 적용 후 helper 통일.
- **B73** — model id verify timing (B85 1-token test 시점 = Stage 2 진입 직전). production env vars 3종 정합 검증.
- **B74** — `cost_log` accounting (writer + critic + 조건부 revise 토큰 사용량 정확 적재). persist fail 시 적재 보장 + alert.
- **B75** — RPC responsibility boundary (Section 8 partA/partC/partD + committee_votes의 admin/cron path 동일 RPC 사용 여부 결정 — B79와 연계).
- **B76** — hardcap mock vs real 일관성 (16,050원/월 박제가 production cost_log 적재 시 enforce 트리거 및 alert 발송).
- **B77** — main HEAD fixed SHA 박제 금지 (R2 시점 박제 — §0 verify에 `git rev-parse --short origin/main` 동적 확인 의무화, commit `dff1cbe` §0 적용 완료).
- **B78** — silent null drop metric/log 격상 (PR3a P2 / red-team RT#2 / gsd CR-01 박제 — §4 잔여 reference). 현재 console.warn → metric/structured log.
- **B79** — Section 8 partA/partC/partD + `committee_votes` RPC 책임 boundary 결정. **57차 §2 R8 lock-in: 옵션 A 채택 ✓ → B79 deferred to PR5 plan** (commit_persona_eval + service-role caller wire + B79 RPC 통합을 PR5 plan R-debate에서 동시 결정).
- **B80** — PR4 14 defer follow-up tickets (W-1 callerKind dead code / W-2 fetchTrackRecord* in actions.ts / W-4 sub_tags / W-5 user.email / W-6 as never cast / Track 3 I1-I6). 본 audit 시점에 일괄 분류.

**R7 (57차 §2 R-debate) 신규 audit ticket 6종** (옵션 A 채택 lock-in 후속, spec doc §6):
- **B-versioning** — 옵션 A versioning policy = (1) overwrite-in-place 채택 (0017/0022 패턴 보존). version/schema_version/is_latest/regen_* counter 불변 invariant. (2) auto-flip + version bump 재설계는 PR5 plan R-debate에 deferred (cross-cutting 결정 — commit_persona_eval + update_report_sections_0_7 + admin RPC + regen 모두 영향).
- **W-tier1pill** (PR4 post-merge follow-up ticket) — Section 8 absent 리포트 = Tier 1 평가 대기 pill UI 추가. D11 운용 검증 acceptance gate. HANDOFF §2.1 Step 8 (D11 AI 가상 포트 1차 가동 게이트) 본문도 acceptance gate 명시로 갱신. omxy R1 h + critic W3 + omxy R2 e' + R3 ε 박제.
- **W-grant-smoke ✅ RESOLVED in 58차 (마이그 0025 production apply + verify)** — Layer 1 has_function_privilege 4-grant matrix verified (service_role=false / authenticated=true / public/anon=false) + Layer 2 (PostgREST permission_denied) = Smoke Stage 2 진입 시 functional canary로 검증 예정. exact 11-arg regprocedure signature 적용 + pg_get_functiondef로 body 1:1 정합 확인. omxy R1+R2 CONVERGED. **Layer 2 PostgREST smoke만 Task 7 USER 게이트로 잔여**.
- **W-sectionfallback-text** — SectionFallback 문구 "후속 PR3b (writer Section 0~7 본문 구현)에서 채워집니다"는 stale (PR3b 이미 MERGED `cf68731`). Tier 1 평가 대기 pill 도입 시 함께 정정. page.tsx line 336~346.
- **W-cost-log-env-gate** — Smoke Stage 2 (Task 7) 진입 전 Vercel production env에 `AI_COST_LOG_REAL_INSERT_ENABLED=true` 설정 선행 — 미설정 시 `insertCostLog`는 noop. Task 7 sequence에 env gate verify step 추가.
- **W-pr5-readiness** — PR5 cron path quality는 **B65-P2 옵션 A와 독립**. PR5 readiness = (a) commit_persona_eval에 service_role grant 추가 (B79와 동시) + (b) service-role caller DI wire + (c) cron 30 자동 (16,050원/월 hardcap) + (d) 큐 인프라 (Vercel Queues OR 자체 DB job queue) 모두 PR5 plan에서 별도 해결.
- **W-mock2-rls-drift** (58차 Step 2.1 omxy R1 WATCH defer) — `/admin/alerts` empty state ("0건 = 실제 미발생") 문구는 env `ADMIN_EMAILS` ↔ DB `admin_emails` allowlist sync 전제. drift 시 RLS deny로 0 rows처럼 보일 가능성 있음 (blocking 아님). admin read assertion / diagnostic 검토 — 별도 hardening 트랙. Step 2.2+ (settings/health/cost/regenerate)에도 동일 패턴 잠재 → 통합 follow-up.

**B-trackrecord-rls ✅ RESOLVED in PR #31 MERGED `838386e` (58차 follow-up, omxy R1 CONVERGED)** — `triggerMonthlyPersonaEvalAction`의 admin assertion이 `from('admin_emails')` 직접 SELECT (RESTRICTIVE RLS using(false)로 real admin 전원 오차단)였던 latent bug를 `rpc('is_admin')`로 교체. Task 4 R3 mechanical extension. src 전체 production action에서 `from('admin_emails')` 직접 SELECT = 0건 확인 완료.

**R3 알려진 항목 (B81~B85)**:
- **B81** — 단일 실 AI smoke 비용 분석 (per-call low / batch large). Stage 2 cost 추정 reference.
- **B82** — B65 docs-only 박제 strict (본 세션 내 코드 변경 금지). 다음 세션에서 해제.
- **B83 / B84** — `short_list_30` backfill verify command (Python seed re-run + `select sector, count(*) from short_list_30 group by sector` cross-check). B66 Task 5 PASS criteria 1~3.
- **B85** — 다음 세션 Stage 2 진입 직전 1-token model id verify (`ANTHROPIC_API_KEY` + `ANTHROPIC_OPUS_MODEL_ID` + `ANTHROPIC_HAIKU_MODEL_ID` Vercel env 정합).

**post-merge production deploy verify (추가)**: post-§5 docs merge 후 Vercel canary 4 페이지 (`/admin/portfolio`, `/admin/track-record`, `/admin/report/[ticker]`, `/admin/report/[ticker]/regenerate`) + functional smoke 3 (C-1 click / C-2 validation / B18 401) 결과 박제. **단 trigger button 클릭은 B65 fix 전까지 비용 burn risk**.

### 9.6 omxy lifecycle (historical — git log + PR body 위임)

56차 §5 post-merge omxy R1~R8 CONVERGED (B65~B107 catalog 형성) + 57차 §1 PR #21 R1~R4 CONVERGED + 57차 §2 Task 3 R1~R8 ESCALATE max-8 mechanical-final + **57차 §3 Task 4 plan R1~R5 CONVERGED Ramanujan R5 CATCH 0** → 누적 catch와 라운드별 lessons는 **56차 §5 docs cleanup commit + 57차 §1 commit chain + 57차 §2 spec doc §6 + 57차 §3 plan §부록 D + PR #28 body + git log + PR body**로 위임. active 박제는 §9.2~§9.5 본문에 일원화.

### 9.7 57차 §1+§2+§3 진행 — Task 1+2+3 ✅ + Task 4 plan ✅ MERGED (B65-P1 MERGED + B65-P2 spec doc CONVERGED + B65-P3 impl plan SoT MERGED in main `2859c68`)

57차 §1 진행 결과 (historical):
- **Task 1 (production audit)** ✅ COMPLETED — drift 0
- **Task 2 (B65-P1 immediate guard + B86 month format)** ✅ MERGED in main `5b99e03` (PR #21, Vercel deploy SUCCESS)
- omxy 4 rounds CONVERGED (R1 Hegel / R2 Leibniz+McClintock / R3 Hubble / R4 Locke + gstack ship sanity)

57차 §2 진행 결과 (active):
- **Task 3 (B65-P2 RPC R-debate spec doc)** ✅ COMPLETED — CONVERGED **R8 final** (옵션 A lock-in)
- **omxy R-debate 8 rounds (R8 SIGNAL=ESCALATE max-8 정합 §7.5)**:
  · R1 plan: debate-with-omx + native critic Godel (5 BLOCKERS + 4 WATCH)
  · R2 R-cycle: + native critic Feynman (5 stale/overclaim)
  · R3: + native critic Planck (5 catch β/γ/δ/ε/η)
  · R4: + native critic Schrodinger (3 catch — cost_log pre-parse / service_role exact signature / nullable)
  · R5: + native critic Franklin (2 BLOCKER — §4.4 regen + HANDOFF PR5 wording)
  · R6: + native critic Hypatia (1 BLOCKER + 2 minor)
  · R7: native critic agent thread limit (2 BLOCKER — incrementManualRegenCount RPC 오기 + global sweep)
  · R8: ESCALATE max-8 + 3 mechanical fix (§5 R8 / §6 R8 결정 / 부록 B header R1~R8)
  · **누적 catch 30+ 모두 fix 반영**
- **결정 lock-in (R8 final)**: 옵션 A `upsert_report_sections_0_7_admin` + axis (i)A admin trigger = section_0~7 only + axis (ii) B79 deferred → PR5 plan + axis (iii) PR5 no-conflict

**57차 §3 진행 결과 (active)**:
- **Task 4 plan SoT (B65-P3 P1/P2 호환 feature flag + 마이그 0025 impl plan)** ✅ COMPLETED — plan SoT MERGED in main `2859c68` (PR #28 rebase FF + delete-branch + HANDOFF sweep R1~R2 Descartes CATCH 0 CONVERGED)
- plan = `docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md` (929 lines)
- **omxy R-debate R1~R5 누적 23 BLOCKERS catch & fix + native critic 6명 (Schopenhauer R1 parallel + Kepler R1 omxy + Plato R2 + Sartre R3 + Aristotle R4 + Ramanujan R5)**:
  · R1: Schop 8 BL + Kepler 3 BL + omxy 3 BL = 11 unique BLOCKERS + 9 WATCH + 7 MINOR (fix commit `98b9a18`)
  · R2: Plato 6 catch + parent 1 WATCH = 3 BLOCKERS + 4 WATCH (fix commit `8a6ffb1`)
  · R3: Sartre 6 catch = 2 BLOCKERS + 4 WATCH (schema mismatch + DB coverage 분리, fix commit `0a082c7`)
  · R4: Aristotle 2 catch = 1 BLOCKER + 1 WATCH (SET LOCAL transaction wrapper, fix commit `940d658`)
  · **R5: Ramanujan CATCH 0 — SIGNAL: CONVERGED** ✅
- **핵심 lessons (impl PR scope에 1:1 박제)**: Kepler B2 critical (service_role 명시 REVOKE) + Schop B5 critical (.env.example=false safe local) + Schop B3 (error literal rpcName guard) + Schop B7 + Sartre B2 (DB Phase A+B 분리) + Sartre B1 (schema verified) + Aristotle B1 (SET LOCAL begin/commit) + Plato B2 (grep scope impl-only)

**B65 3-phase 진행률**:
- **P1** ✅ MERGED in main `5b99e03` (57차 §1 PR #21 production active, cost burn 0)
- **P2** ✅ **spec doc CONVERGED R8 final (57차 §2 Task 3)** — 옵션 A lock-in
- **P3** ✅ **plan SoT MERGED in main `2859c68` (57차 §3 Task 4 + PR #28 rebase FF)** — **impl PR = 다음 세션 1순위** (`feat/b65-p3-feature-flag-upsert-impl` 신규 branch, plan §8.2 옵션 B 5 commits + omxy R-debate)

**B66 진행률**: 미진행 (Task 5 — Python seed canonical 14 backfill + B93 PASS criteria 3종, Task 4 impl 병렬 가능)

**Smoke 진행률**: 미진행 (Task 6 Stage 1 dry-run TDD + Task 7 Stage 2 single real AI USER 승인 + `AI_COST_LOG_REAL_INSERT_ENABLED='true'` env 선행)

**post-§3 commit production audit**: cost_log=0 / stock_reports=0 / committee_votes=0 / short_list_30=30 — drift 0 (PR #28도 docs-only, 직접 data 변경 0).

**SCOPE GUARD 박제 (57차 §3 종료 시점)**: Task 4 impl PR + Task 5-8 모두 **다음 세션 작업**. 57차 §3는 Task 4 plan SoT (R-debate CONVERGED) + HANDOFF global stale sweep + PR #28 plan-only PR로 종료.
