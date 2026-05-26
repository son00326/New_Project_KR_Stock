# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-26 (57차 §1 종료 — **Task 1 ✅ + Task 2 ✅ B65-P1 PR #21 MERGED `5b99e03` + PR #20 MERGED `c0a26f8` (docs)** · main HEAD `75fb46a` → `5b99e03` (PR #21) → `c0a26f8` (PR #20 docs cleanup) · Vercel current production deploy SUCCESS (dpl_D1LBrgVwFN1vBjySoBba5i2CEMW4 — post-PR-#20 deploy; PR #21 historical deploy = dpl_82mtwUy82n365yF9WTuYjuhv59wL) · test:ci 1126 → **1130 PASS / 105 files** (+4 신규 B65-P1 invariant test) · 0 migrations · omxy 누적 7 rounds CONVERGED (PR #21 R1~R4 + post-merge R5~R6 + PR #20 R1~R2, subagent 7명 — Hegel/Leibniz/McClintock/Hubble/Locke/Banach/Archimedes + OMX code-review + gstack ship sanity skills) · OPEN PRs: **#2** (format-error, 보류) only · ⚠️ **PR4 MERGED ≠ production functional 잔존** — cost_log=0 / stock_reports=0 / committee_votes=0 (PR #21 머지로 P1 guard production active, P2/P3 미구현 잔존) · **다음 1순위 = CLAUDE Task 3 B65-P2 RPC R-debate (omxy 옵션 A/B/C + axis i/ii/iii) → Task 4-8 진행** (§2.1 active matrix Task 1+2 ✅, §9 박제 유지).

---

## ⭐ 다음 세션 진입자 5줄 요약 (57차 §1 종료 시점, B65-P1 PR #21 MERGED ✅)

1. **57차 §1 완료 박제**: Task 1 ✅ production audit (cost_log=0 / stock_reports=0 / committee_votes=0 / report_critic_findings=0 / short_list_30=30 rows · sector 코스닥 22 + 코스피 8 placeholder) + Task 2 ✅ B65-P1 immediate guard **PR #21 MERGED `5b99e03`** (https://github.com/son00326/New_Project_KR_Stock/pull/21 · GitHub rebase resigned commit, local 7325f00 → main 5b99e03 / 2 files / +156 -3 / test:ci 1126 → **1130 PASS / 105 files** / build 25 routes / lint 0 err / tsc clean / 0 migrations / Vercel production deploy SUCCESS dpl_82mtwUy82n365yF9WTuYjuhv59wL).
2. **PR #21 omxy 적대적 검토 4 rounds 누적 CONVERGED (BLOCKERS 0)**:
   - R1 plan: debate-with-omx Responder + native critic Hegel
   - R2 commit verify: + OMX code-review skill + **2 subagent parallel** (code-reviewer Leibniz + architect McClintock)
   - R3 HANDOFF cleanup verify: + native critic Hubble
   - R4 pre-merge sanity: + gstack ship sanity + native critic Locke + gh/git 최신 상태 확인
   - WATCH (비차단): P3 도입 시 본 guard를 feature flag (`PR4_TRIGGER_UPSERT_ENABLED`) toggle 필요 — 코드 주석 박제
3. ⚠️ **PR4 MERGED + B65-P1 MERGED ≠ production functional 잔존**: cost_log=0 / stock_reports=0 / committee_votes=0. **PR #21 머지로 P1 guard production active** = trigger button click 시 `report_not_found` fail-fast (비용 burn 0). **B65 CRITICAL (3-phase)** — P1 ✅ MERGED + P2 (Task 3 R-debate 대기) + P3 (Task 4 feature flag) + **B66 quality** (short_list_30 sector placeholder) + B67~B98 audit catalog 11+. §9 박제 유지.
4. **다음 세션 sequence (CLAUDE 자동 진입)**:
   - **(CLAUDE)** entry routine = §0 verify (main HEAD = PR #20 머지 자손 + OPEN PRs `#2` only + production audit 재확인 drift 0)
   - **(CLAUDE)** Task 3 = **B65-P2 RPC R-debate** (omxy 적대적 토론 — 옵션 A admin-only RPC / 옵션 B commit_persona_eval full path / 옵션 C synthetic; axis i admin trigger 책임 범위 / axis ii B79 동시 해결 / axis iii PR5 cron path 일관성). 결정 spec doc 작성 → omxy CONVERGED → Task 4 진입.
   - **(CLAUDE)** Task 4 = B65-P3 P1/P2 호환 (B98 feature flag default `PR4_TRIGGER_UPSERT_ENABLED=true`) + Task 5 B66 backfill + Task 6 Smoke Stage 1 + (USER 승인) Task 7 Smoke Stage 2 + Task 8 audit + PR5.
5. **canonical 5-PR 순서 (모두 MERGED, PR5 진입 차단 = B65-P2/P3 + B66 + Smoke 모두 PASS)**:

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

**진입 트리거 (57차 §1 종료 → 57차 §2 또는 다음 차수 진입)**: "`Document/Process/HANDOFF.md` 보고 이어서 진행" →
1. §0 verify (`git rev-parse --short origin/main` = PR #20 머지 자손 기대 + OPEN PRs `#2` only + test:ci 1130 PASS)
2. **production audit 재확인** (Supabase 직접 query, §2.1 Task 1 entry routine) — drift 0 확인 (cost_log=0 / stock_reports=0 / committee_votes=0 잔존 정상)
3. **§9 박제 + §2.1 active matrix 갱신 (Task 1+2 ✅) 확인**
4. **Task 3 B65-P2 R-debate 진입** — omxy 적대적 토론 (옵션 A/B/C + axis i/ii/iii). 의사 1회 확인 후 자동 시작.

**14 defer follow-up tickets (PR4 출신, B65/B66과 무관, 별도 작업)**: PR #19 body 박제. architectural drift (W-1 callerKind dead code / W-2 fetchTrackRecord* in actions.ts) + observability gap (W-4 sub_tags / W-5 user.email) + cosmetic (W-6 as never cast / Track 3 I1-I6).

**⚠️ PR4 acceptance criterion 박제 (불변)**: PR4 scope = admin manual trigger 버튼 + Regen + Track Record + PR3a OOS + **B18 CRON_SECRET 401 test만** + Task 8 W7만 (defer는 source review docs 링크). 본 PR에서 적용:
1. **caller DI seam (✅ 완료)** — `commitFullReport` / `orchestrateFullReport` + 모든 helper (cost-logger / AI clients 3종 / report-critic-findings / sector-reference-backlog / critic.ts evaluateReport) options:{client?} 패턴
2. **admin caller = quality (✅ 완료)** — admin manual = `orchestrateFullReport(callerKind='admin')` Kevin v3.1 quality target
3. **CRON_SECRET 401 test (잔여)** — cron route가 CRON_SECRET 미일치 시 401 반환 검증 (Task 7)

> **cron 30 자동 리포트 + service-role caller DI + admin_id 'cron-system' + cost_log e2e test = PR5 후속 트랙** (T11 분할 결정 보존, PR4 머지 후 진입). PR5 caller path = orchestrateFullReport (quality), timeout 처리 = 자체 DB job queue β2′ 또는 Vercel Queues β1 (PR5 plan 시점 R-debate).

**운영 원칙**: 미래 지향. §6 완료 이력 = 직전 2 entry inline (57차 §1 Task 1+2 + 56차 §5 PR4 MERGED baseline)만. older historical = git log + spec/plan/REVIEW docs + ProgressDashboard 위임.

**⚠️ gsd-code-reviewer 환경 부재 대체 정책 (54차 §4 박제)**: 현 Claude Code 환경에서 `gsd-code-reviewer` agent type은 더 이상 사용 불가. PR3b/PR4/후속 모든 PR의 deep code review는 **3-track 대체 패턴** (PR4 finalize Task 9에서 적용):
- **Track 1**: `gstack-review` skill (pre-landing PR review, structural/SQL/LLM trust/concurrency)
- **Track 2**: `general-purpose` agent (depth=deep adversarial prompt — gsd 동등 책임)
- **Track 3**: `superpowers:code-review` skill 또는 5-angle scan agent (recall mode bug catch)

---

## 0. 세션 시작 루틴 (verify + auto-progress)

```bash
# 57차 §1 종료 state — PR #21 (B65-P1) MERGED in main `5b99e03`, Vercel deploy SUCCESS
cd /Users/yong/New_Project_KR_Stock

# 1. main branch state runtime 확인 (B75 fixed SHA 박제 금지 — PR #20 머지 자손 기대)
git checkout main && git pull origin main
git rev-parse --abbrev-ref HEAD                   # main
git rev-parse --short HEAD                        # 기대: PR #20 머지 자손 (5b99e03 + docs 자손, 또는 PR #2 머지 후 자손)
git status --short                                # clean

# 2. OPEN PRs (57차 §1 종료 baseline: #2 only — PR #20+#21 모두 MERGED)
gh pr list --state open --json number,title,headRefName,mergeable
#   #2  fix/s7a-format-error-inventory (format-error, 보류)

# 3. canonical 5-PR MERGED + B65-P1 MERGED 확인
git log --oneline | head -10
#   5b99e03 feat(57차 §1 Task 2 B65-P1 immediate guard): ...   ← PR #21 MERGED
#   75fb46a docs(56차 §5 omxy R14 B64 fix): ...
#   ...

# 4. 검증 게이트 (5b99e03 main baseline)
#    - test:ci 1130 PASS / 105 files (B65-P1 invariant 포함)
#    - build 25 routes / lint 0 err 6 warn (pre-existing) / tsc clean / 0 migrations
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

# 6. Vercel production canary (PR #21 머지 후 권장 1회 verify)
#    /admin/portfolio trigger button click → `리포트를 찾을 수 없습니다` 메시지 (P1 fail-fast active)
#    /admin/track-record + /admin/report/[ticker] + /admin/report/[ticker]/regenerate 진입 정상
```

### 진입자 자동 행동 (§2.0 default-progress policy, 57차 §1 갱신)

1. **§0 verify 실행** → branch state + PR state (`#2` only) + 검증 게이트 + **production audit 재확인** (Task 1).
2. **§9 박제 확인** — PR4 MERGED ≠ production functional 명시 (Task 2 PR #21이 P1 차단, P2/P3 잔여).
3. **§2.1 active 8-row matrix 다음 unblocked step 식별**:
   - Task 1 ✅ COMPLETED (57차 §1, production audit 1회) — **다음 세션 entry routine 1순위 재실행**
   - Task 2 ✅ **MERGED in main `5b99e03`** (57차 §1, B65-P1 PR #21 rebase FF, Vercel deploy SUCCESS)
   - Task 3 🔴 다음 1순위 = **B65-P2 RPC R-debate** (omxy 적대적 토론, 옵션 A/B/C + axis i/ii/iii)
4. **Owner 별 행동**:
   - **[CLAUDE]** → 즉시 자동 시작 (stacked 1세션+ 작업은 진입 의사 1회 확인).
   - **[SHARED]** → "이어서 진행" 권한으로 prepare/commit/push/PR-create 자동.
   - **[USER]** → background blocker 보고 (B-1~B-13 큐) + Smoke Stage 2 시점 1회 승인 (Task 7) + 동시 가능한 [CLAUDE] step 자동 시작.
5. **§2.0 7 exception buckets 도달 시만** USER 직접 묻기 (scope expansion / product spec / risk profile / real-money / secrets·billing / destructive shared-state / uncertainty ≥ medium).
6. **§7 omxy 적대적 검토 패턴**은 모든 신규 작업 branch에서 강제 적용 (57차 §1 박제: R1 plan + R2 commit verify with 2 subagent parallel = subagent/skill 활용 강제).

---

## 1. 현재 상태 (57차 §1 종료 시점 — Task 1+2 ✅ + PR #21 ✅ MERGED in main `5b99e03`, 2026-05-26)

| 영역 | 상태 |
|---|---|
| main HEAD | PR #21 (`5b99e03`) + PR #20 머지 자손 (docs cleanup HANDOFF.md). **다음 세션 진입 시 `git rev-parse --short origin/main`으로 verify** (B75 fixed SHA 박제 금지). |
| **PR #21 (B65-P1)** | ✅ **MERGED `5b99e03`** (rebase FF, GitHub resigned commit from local 7325f00, 2026-05-26T07:11:50Z, --delete-branch) — Task 2 production active |
| **PR #20 (56차 §5 + 57차 §1 docs)** | ✅ MERGED in main (post-PR-#21 sequence, branch `docs/56-section5-handoff-restructure` deleted, 56차 §5 R9~R11 + 57차 §1 docs cleanup + PR #21 post-merge update 포함) |
| **Vercel production deploy (current)** | ✅ SUCCESS (dpl_D1LBrgVwFN1vBjySoBba5i2CEMW4 — post-PR-#20 deploy; PR #21 historical deploy = dpl_82mtwUy82n365yF9WTuYjuhv59wL, both SUCCESS) |
| **PR4 (canonical 5-PR 마지막)** | ✅ MERGED `7de9696` (PR #19, 56차 §5) — 상세 = §6 56차 §5 entry + PR #19 body |
| canonical 5-PR MERGED (전체 완료) | PR2 `f85fb69` / PR3a `0813a41` / PR1 `4aa3130` / PR3b `cf68731` / PR3c `b2a902a` / PR4 `7de9696` |
| **57차 §1 Task 1 (production audit)** | ✅ COMPLETED — cost_log=0 / stock_reports=0 / committee_votes=0 / report_critic_findings=0 / short_list_30=30 (코스닥 22 + 코스피 8 placeholder) · 56차 §1 ground truth 100% 일치, drift 0 |
| **57차 §1 Task 2 (B65-P1 immediate guard) ✅ MERGED** | PR #21 MERGED `5b99e03`. `triggerFullReport`에 `reportExistsForMonth(input.ticker, \`${input.month}-01\`)` preflight 추가. exists=false → `report_not_found` / throws → `report_lookup_failed`. **B86 month format** caller-side YYYY-MM→YYYY-MM-01 변환 (preflight 전용, orchestrate payload month는 YYYY-MM 유지). **production active** — Vercel deploy SUCCESS. |
| **PR #21 OMXY 누적 (57차 §1, 4 rounds CONVERGED)** | R1 plan (Hegel critic) + R2 commit verify (2 subagent parallel — Leibniz code-reviewer + McClintock architect, OMX code-review skill) + R3 HANDOFF cleanup verify (Hubble critic) + R4 pre-merge sanity (Locke critic + gstack ship sanity skill) — 모두 **BLOCKERS 0** · WATCH (비차단): P3 도입 시 본 guard를 feature flag toggle 필요 (`PR4_TRIGGER_UPSERT_ENABLED`, B98 default, 코드 주석 박제) |
| ⚠️ **PR4 MERGED + B65-P1 MERGED ≠ production functional 잔존** | PR #21 머지로 P1 guard production active (cost burn 차단), but P2/P3 미구현 = trigger button 영구 fail-fast (`report_not_found`) 상태. 정상 동작은 P2 RPC 도입 + P3 feature flag 후. §9 박제 유지. |
| **B66 quality/trust blocker** | `short_list_30` 30 rows sector="코스닥"/"코스피" placeholder (D21 canonical 14 미반영, Python seed mechanical 1회). PR5 entry blocker — Task 5 backfill 후 PR5 진입 가능. |
| **B67~B98 audit (잠재 follow-up)** | 56차 §5 omxy R1~R8 catch 결과 — cron / cost_log retry / RPC 책임 / hardcap mock 등 11+ 항목. Smoke Stage 2 PASS 후 audit (§9 + Task 8). |
| **다음 세션 1순위** | ⭐ **(CLAUDE) Task 3 B65-P2 RPC R-debate** (omxy 적대적 토론 — 옵션 A admin-only `upsert_report_sections_0_7_admin` RPC / 옵션 B `commit_persona_eval` 연계 full path / 옵션 C synthetic 비추천; axis i/ii/iii 결정 후 spec doc 작성) → Task 4 B65-P3 feature flag → Task 5 B66 backfill → Task 6 Smoke Stage 1 → Task 7 Smoke Stage 2 (USER 승인) → Task 8 audit + PR5 |
| Mock Skeleton + DQ-7 + S7e + S7a + Tier 2 | ✅ Mock 완료 / 🟢 DQ-7 ~97% (Smoke #4/#5 + Session 4 QA 잔여) / 🟢 S7e 7/8 (T7e.7 RLS QA 잔여) / ✅ S7a MERGED (51차) / ✅ Tier 2 D21 (52차+53차) |
| 선정 흐름 메인 path | 🟢 spec lock-in: Tier 0 150 → Tier 1 Core 11 AI 평가 → 단/중/장 top 10 = 30. 현재 production = Tier 0 단독 30 직선정 (fallback). **PR5 cron 가동 시 메인 path 활성 (B65-P3 + B66 backfill + Smoke Stage 1+2 PASS 후만 진입)**. |
| 풀 리포트 흐름 | 🟢 PR3b writer Section 0~7 + Section 8 partA/partD + PR3c 3-step orchestration + PR4 admin caller wired. **but production cost_log=0 / stock_reports=0 — 성공/기록된 AI 호출 및 리포트 0건. PR #21 머지 후 admin trigger button 클릭 → `report_not_found` (P1 cost burn 차단) 반환**. P2 도입 후 실 정상 동작 가능. cost_log 적재 정확한 지점은 Smoke Stage 2에서 확정 (B100). |
| OPEN PRs | **#2** (format-error, 보류) only — PR #21+#20 모두 MERGED |
| 실 AI 호출 | **현재 0건 (production cost_log ground truth)**. Vercel env 3 vars (ANTHROPIC_API_KEY + 2 모델 ID) Production 배포 + 충전 완료. PR #21 MERGED — trigger button = cost burn 차단 production active (P1 fail-fast). B65-P2/P3 도입 후 첫 실 AI smoke 가능 (B97 2-stage 분리). |
| Production deploy | Vercel main `c0a26f8` SUCCESS (dpl_D1LBrgVwFN1vBjySoBba5i2CEMW4 — current, post-PR-#20). PR #21 historical deploy `5b99e03` (dpl_82mtwUy82n365yF9WTuYjuhv59wL) SUCCESS. canary verify 권장: PR4 핵심 4 페이지 + Functional smoke 3 (C-1 click → P1 fail-fast `리포트를 찾을 수 없습니다` 확인 / C-2 validation / B18 401). |
| Supabase | project `rbrpcynhphrpljbjirfo` · 0001~0024 production 적용 완료. **PR #21 = 0 migrations 유지** (PR4 invariant). SECURITY DEFINER 4-grant 패턴 유지. **B65-P2 = 신규 RPC 마이그 (Task 3 R-debate)**. |
| 검증 게이트 (c0a26f8 main baseline — PR #21 5b99e03 code + PR #20 c0a26f8 docs FF) | build 25 routes / lint 0 err 6 warn (pre-existing) / **test:ci 1126 → 1130 PASS / 105 files (+4 신규 B65-P1 invariant)** / tsc clean / 0 migrations |
| omxy debate 누적 | **PR3c까지 238+ rounds** (55차 §4 종료) · PR4 lifecycle 50 BLOCKERS (56차 §5) · 56차 §5 post-merge docs R1~R11 11 rounds CONVERGED + B65~B108 catalog catch · **57차 §1 PR #21 R1+R2+R3+R4 CONVERGED (BLOCKERS 0, 누적 subagent 5명)** |

---

## 2. 출시까지 선형 Runbook

### §2.0 Default-progress policy

**"이어서 진행해줘" 받았을 때 Claude의 행동 규칙**:

- If current step is USER-gated, report it briefly as background blocker and proceed to the next unblocked CLAUDE step.
- Do not repeatedly ask which option to choose when the runbook already defines the next CLAUDE step.
- Stop only at explicit USER-gated operations or the exception list below.

**Ask user before (7 exception buckets)**:

1. **scope expansion** (HANDOFF 범위 초과 새 작업)
2. **product spec changes** (D-decision 변경)
3. **new risk profile** (가드레일 / 보안 정책 변경)
4. **real-money / live-account / order-path changes** (실 체결 토글 / 자동매매 토글 변경)
5. **secrets / billing / external account actions** (env / 키 / 외부 계정 트리거)
6. **destructive shared-state actions** (PR merge / production migration apply / production deploy / billing / 외부 메시지 발송 / external account 변경). Feature-branch push 및 PR create는 §2.1/§9 SHARED 정의에 따라 "이어서 진행" 권한으로 허용.
7. **uncertainty ≥ medium** (어떻게 진행해야 할지 불확실한 경우)

### §2.1 Step matrix (57차 §1 종료 — Task 1+2 ✅ + PR #21 MERGED, **PR5 진입 = Task 3~7 모두 PASS 후만**)

**현재 위치 = 57차 §1 Task 2 ✅ B65-P1 PR #21 MERGED in main `5b99e03` (Vercel deploy SUCCESS). 다음 세션 = CLAUDE Task 3 B65-P2 RPC R-debate → Task 4-8 진행.**

Owner 의미: **USER** (사용자만) · **CLAUDE** (자동) · **SHARED** ("이어서 진행" 권한으로 push/PR-create 자동, merge/deploy/migration은 USER).

#### 다음 세션 active matrix — 8-row sequence (Task 1+2 ✅, Task 3~8 잔여)

| # | Task | Owner | 상태 | 박제 |
|---|---|---|---|---|
| 1 | **현행 audit 재확인** (Supabase 직접 query: `cost_log` / `stock_reports` / `committee_votes` / `short_list_30` sector quality) | CLAUDE | ✅ COMPLETED (57차 §1) — drift 0 확인 | 매 세션 entry routine 1순위로 재실행 (drift detect). 본 §1 ground truth와 동일한 결과 확인. drift (cost_log > 0 등) 시 PR #21 머지 효과 또는 Smoke Stage 2 결과 반영 가능. |
| 2 | **B65-P1 immediate guard (Phase 1) + B86 month format** | CLAUDE | ✅ **MERGED in main `5b99e03`** (57차 §1, PR #21, Vercel deploy SUCCESS) | `triggerFullReport`에 `reportExistsForMonth(input.ticker, ${month}-01)` preflight 추가. false → `report_not_found` / throws → `report_lookup_failed`. **P2 미구현 상태에서만 활성** (현재 production = 영구 fail-fast — B65-P2 후만 정상 동작), smoke 금지 (B92). 코드 주석에 P3 feature flag 박제. |
| 3 | **B65-P2 real enablement (Phase 2) + B88 RPC R-debate** | CLAUDE | 🔴 **다음 세션 1순위** | omxy 적대적 토론 진입. 옵션 (A) admin-only `upsert_report_sections_0_7_admin` RPC, relative cost low, criteria 4 deferred B79 / (B) `commit_persona_eval` 연계 full path, relative cost high, criteria 4 포함 / (C) synthetic — 위험. R-debate axis: (i) admin trigger 책임 범위 / (ii) B79 동시 해결 / (iii) PR5 cron path 일관성. **PR5 진입 전 옵션 A로 충분한지 별도 결정** (cron 30 자동 = full path 요구 시 A만으론 PR5 blocker 잔존). spec doc 작성 SoT = `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md` (신규). |
| 4 | **B65-P3 P1/P2 호환 (Phase 3) + B98 default policy (feature flag)** | CLAUDE | 🔴 PR5 entry blocker 2순위 (Task 3 후 진입) | (i) **feature flag (env `PR4_TRIGGER_UPSERT_ENABLED=true`) — default recommended** (simple, deterministic) / (ii) RPC presence check — **비추천** (runtime overhead + 권한 risk) / (iii) atomic transaction prepare — **secondary** (transaction boundary 복잡). `triggerFullReport`에 env guard 추가 + P1 guard를 toggle 가능하게 수정. omxy R1+R2 verify. **smoke는 P3 후만 가능** (B94). |
| 5 | **B66 fix + B84 backfill + B89 default policy + B93 PASS criteria** | CLAUDE | 🟡 PR5 entry blocker 3순위 (Task 4 병렬 가능) | Python seed script (`scripts/seed_short_list_30.py` 또는 신규) ticker→canonical14 매핑 추가 + 30 rows backfill + unknown 처리 R-debate (block / manual review / backfill exclude). **PASS criteria 3종**: (1) 30 rows all sector ∈ `CANONICAL_SECTORS` (2) sector ∉ ('코스피','코스닥') (3) sub_tags 정합 (jsonb null OR string[]). |
| 6 | **Smoke Stage 1 — non-AI dry-run (B97 fix)** | CLAUDE | 🔴 PR5 entry blocker 4순위 (Task 4 후 진입) | `triggerFullReport`에 mock `orchestrateFullReport` 주입 (vi.doMock). **P1+P2+P3 호환 invariant test**: P3 호환 완료 시 P2 path 진입 (mock called) / 비호환 시 P1 fail-fast (mock not called). cost=0. **B96 target**: short_list_30 존재 + stock_reports 부재 ticker. TDD 단위 테스트. |
| 7 | **Smoke Stage 2 — single real AI (B97 fix + B85 + B87)** | CLAUDE+USER | 🔴 PR5 entry blocker 5순위 (Task 6 후 진입) | **Stage 1 PASS 후만 진입**. USER 승인 + B85 model id 1 token verify 선행. **Core smoke (필수)**: criteria 1 `cost_log` row + 2 `stock_reports` row sections + 3 `report_critic_findings` + 5 UI render. **Full-path (옵션 B만)**: criteria 4 `committee_votes`. real cost = `cost_log` 기준 확정 (token usage 기반). |
| 8 | **B67~B98 audit + PR5 진입** | CLAUDE | 🟢→⭐ (Task 7 후 진입) | Smoke Stage 2 PASS 후: B67~B98 catalog 11+ 항목 audit (cron / cost_log retry / RPC 책임 / hardcap mock 등). 모든 priority audit clear 후 **PR5 cron 30 자동 + 큐 인프라** plan SoT 작성 진입 (T11 분할 결정 보존, 16,050원/월 hardcap 4%; B65-P2 RPC 선택이 PR5 cron path와 호환 시만). |

> **§9 신규 박제 참조 (PR4 MERGED ≠ production functional)**: B65/B66/Smoke Stage 1+2 모두 PASS 시 §9 + 본 8-row matrix를 HISTORICAL로 강등하고 PR5 active submatrix로 교체.

#### PR4 historical submatrix (PR #19 MERGED `7de9696`)

> **HISTORICAL 박제 — 본 matrix는 PR4 MERGED 이력. 다음 세션 진입자는 §6 56차 §5 entry + PR #19 body 참조. Step 2.3 / Task 3-9 모두 MERGED.**

| Task / Step | Owner | 상태 | Commits | OMXY |
|---|---|---|---|---|
| **Task 1 Step 1.0** test infra (jsdom + testing-library + fixture) | CLAUDE | ✅ MERGED | `cf23e59` | R1+R2 CONVERGED |
| **Task 1 Step 1.1** caller DI seam (7 modules options:{client?}) | CLAUDE | ✅ MERGED | `f6205bf` + `d94a1b9` | R1+R2 CONVERGED (B23) |
| **Task 1 Step 1.2** triggerFullReport admin server action | CLAUDE | ✅ MERGED | `3ef9e0b` + `39d4b5b` | R1+R2 CONVERGED (B24) |
| **Task 1 Step 1.3** TriggerFullReportButton + ShortlistRow/BucketSection action slot | CLAUDE | ✅ MERGED | `8f4eb88` + `99bab77` | R1+R2 CONVERGED (B25+B26) |
| **Task 2 Step 2.1+2.2** orchestrateFullReport DI + admin quality swap | CLAUDE | ✅ MERGED | `5cc98cb` + `c7eced2` | R1+R2 CONVERGED (B27+B28) |
| **Task 2 Step 2.3** Regen orchestrate wire | CLAUDE | ✅ MERGED | `8b63e1f` | R1+R2 CONVERGED (B29~B31) |
| **Task 3** Track Record 탭 분리 (Group A+F 해소) | CLAUDE | ✅ MERGED | `983c942` | R1+R2 CONVERGED (B32~B34) |
| **Task 4** PR3a OOS RT#1 partA 14 rows | CLAUDE | ✅ MERGED | `7d80c47` | R1~R5 CONVERGED (B35~B38) |
| **Task 5** PR3a OOS RT#3 aggregateVotes layer 2 guard | CLAUDE | ✅ MERGED | `7d80c47` | R1~R5 CONVERGED |
| **Task 6** PR3a OOS RT#4/RT#5 LLM string/array max bound | CLAUDE | ✅ MERGED | `7d80c47` | R1~R5 CONVERGED |
| **Task 7** B18 CRON_SECRET 401 test (4종 + 1 sanity) | CLAUDE | ✅ MERGED | `8483050` | R1~R3 CONVERGED (B39~B40) |
| **Task 8** W7 enriched/input drift + static invariant | CLAUDE | ✅ MERGED | `a028422` | R1 CONVERGED |
| **Task 9** format-error 인벤토리 + 3-track Fix-First + push/PR-create | SHARED | ✅ MERGED | `36cb6f4` + `2eef985` + `24cdfec` + `73dec10` + `942be16` | R1~R8 CONVERGED (B41~B46) + 3-track 5 |

**Pre-merge note (historical)**: Step 2.3 ~ Task 9 모두 56차 §5 PR4 MERGED 시점에 완료. canonical 5-PR 완료, 다음 1순위 = PR5 cron 30 자동 + 큐 인프라.

#### 후속 PR + 운영 (PR5 + S7b~S9)

| Step | Owner | Trigger | Default action | Verification |
|---|---|---|---|---|
| **PR5** cron 30 자동 + 큐 인프라 (T11 분할 결정 보존) | CLAUDE | **§2.1 active 8-row matrix Task 1~7 모두 PASS 후** (B65-P1/P2/P3 + B66 backfill + Smoke Stage 1+2 PASS) | cron monthly-batch route에 30 종목 풀 리포트 자동 호출. caller path = `orchestrateFullReport` (quality, Kevin v3.1 target). timeout 처리 = (β1) Vercel Queues OR (β2′) 자체 DB job queue resumable worker — PR5 plan 시점 R-debate. fail = γ1 allSettled + γ3 retry N + summary alert. cost = δ1 + batch preflight. admin_id = 'cron-system'. service-role client DI + cost_log e2e test. **30 × 535원 ≈ 16,050원/월 (hardcap 4%)**. **D4 박제 (AI 비중 % production active 시점, omxy R3 B1 fix)**: PR5 cron 가동 시 AI 종목별 비중 + 현금 0~30% 제안 (`section_8.partD`) production 활성. **admin Accept/Reject 모델 (수동 비중 편집 X)**. Reject 후 재분석/hold 정책 SoT = `ServicePlan-Admin §1A.0 + §3.3 R3.3-1/R3.3-8` (2인 풀 리포트 열람 게이팅 D15). **호환성 게이트**: B65-P2 RPC 옵션 A/B/C 선택이 cron path와 일관해야 함 (옵션 A만 + B79 미해결 시 cron 30 자동 path가 section_8/committee_votes 미생성 → PR5 cron 30 자동 quality 보장 불가 — B65-P2 R-debate axis iii). | omxy + 3-track deep review |
| **Step 4 Reflection** | CLAUDE | **PR5 cron 30 자동 가동 + 실 Tier 1 결과 누적 후** (R9 non-blocker watch 정정) | reflection_log 마이그 + Tier 1 context 주입 + tests. PR5 cron 가동되어야 매월 실 결과 → 다음달 prompt 주입 의미 발생. | omxy + 3-track deep review |
| **Step 7 S7b** 뉴스+브리핑 mock→real | USER 트리거 (B-7 Resend + B-8 Naver) + CLAUDE 구현 | PR5 cron 가동 후 | mock news_event → 실 Naver news sweep + Resend 도메인 인증 + 모닝 브리핑 일 23:00 UTC cron 가동 | S7-RealData.md S7b DoD |
| **Step 8 D11 AI 가상 포트 1차 가동 게이트 (omxy R3 B3 fix)** | USER 운용 + CLAUDE 모니터링 | S7b 완료 후, S7c 진입 전 | **KIS 0개로 어드민 3인 며칠~1주 운용 검증 — 가상 포트 의사결정 품질·승인 워크플로우·재생성 cap·뉴스 분류 등 검증** (D18 박제). AI 비중 % + 현금 0~30% 제안 + Accept/Reject 흐름이 실제 사용 환경에서 만족스러운지 확인. **S7c/S8 진입 게이트**. 만족 시 → S7c. 불만족 시 → S7b/PR5 retro + 조정. | 어드민 3인 만족도 + Track Record 일별 snapshot 정상 적재 |
| **Step 9 S7c** 장중·KIS WS + Exit 2채널 실 연결 (omxy R3 B2 fix) | USER 트리거 (B-9 Telegram + B-10 KIS) + CLAUDE 구현 | D11 운용 검증 통과 후 | mock alert_event → 실 alert_event SELECT + KIS 본인 1개 WS read-only 시세 + **J3 Exit real path**: target/momentum/bad-news 3 트리거 감지 → Telegram + 이메일 + `/admin/alerts` 배지 3채널 발송 → 대안 시나리오 3개 (전량/분할/홀딩) + 어드민 결정 기록 + `alert_event(exit_signal)` 적재 → **T+7일 outcome 자동 적재 (IM-3 Exit 신뢰도 65%+ 목표)** | S7-RealData.md S7c DoD + ServicePlan-Admin §3.10 R3.10-12~14 |
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

## 6. 완료 이력 (직전 2 entry inline · older = git log + PR body)

상세는 git log + spec/plan/Slice/PR body + REVIEW.md. 본 §6은 직전 2 entry만 inline.

### 57차 §1 Task 1+2 완료 ✅ + PR #21 MERGED (B65-P1 production active in main `5b99e03`, 2026-05-26)

- **scope**: PR4 MERGED 후 첫 자율 trip — production functional 차단 해소 작업 (B65 3-phase 중 Phase 1만). 사용자 요구: 각 단계 omxy 합의 → 진행 → omxy 검증 → 수정 합의. claude/omxy 모두 에이전트/스킬 활용 강제.
- **Task 1 (production audit 재확인)** ✅ COMPLETED:
  · Supabase MCP `mcp__supabase__execute_sql` 사용
  · 결과: cost_log=0 / stock_reports=0 / committee_votes=0 / report_critic_findings=0 / short_list_30=30 (코스닥 22 + 코스피 8 placeholder)
  · 56차 §1 ground truth 100% 일치, drift 0 — §9 박제 (B65 + B66) 유효 재확인
- **Task 2 (B65-P1 immediate guard + B86 month format)** ✅ COMPLETED + MERGED:
  · 변경 파일 2개: `actions.ts` (+19) + `trigger-full-report-action.test.ts` (+140)
  · `triggerFullReport`에 `reportExistsForMonth(input.ticker, \`${input.month}-01\`)` preflight 추가 (auth 직후, dynamic import 전)
  · false → `report_not_found` / throws → `report_lookup_failed` (format-error.ts 매핑 line 28~29 이미 존재, 변경 0)
  · B86: caller-side YYYY-MM → YYYY-MM-01 변환 (preflight 전용, orchestrate payload month는 YYYY-MM 유지)
  · 신규 4 invariant test (9~12) + 기존 success/orchestrate-throw 3 test에 reportExistsForMonth: true mock 추가 (omxy R1 권고 c — silent regression 차단)
  · 0 migrations (PR4 invariant 유지)
- **omxy 적대적 검토 lifecycle (4 rounds 누적 CONVERGED, BLOCKERS 0)**:
  · **R1 plan**: debate-with-omx Responder + native critic subagent (Hegel, gpt-5.5 high). 검토: (a) plan 1:1 일치 / (b) PostgREST `.eq('month', 'YYYY-MM-01')` ISO date literal 정합 / (c) silent regression 차단 / (d) SoT 충돌 0 / (e) drift 0
  · **R2 commit verify**: + OMX code-review skill + **2 subagent parallel** (code-reviewer Leibniz + architect McClintock, gpt-5.5 high). Plan-vs-commit 정합 일치 / test invariant 모두 cost burn 차단 + B86 invariant + call order 일치 / format-error 매핑 확인 / grep scope 0 매치 / import/createClient drift 0
  · **R3 HANDOFF cleanup verify**: + native critic subagent (Hubble, gpt-5.5 high) + gh PR state 확인. (a) §0→§1→§2.1→§9.7 자동 진입 가능 / (b) Task 3 scope 명확 / (c) USER action 명확 / (d) 기획방향 변경 0 / (e) stale 흔적 0
  · **R4 pre-merge sanity** (사용자 명시 요청 = "omxy랑 하나하나 검증"): + gstack ship sanity skill + native critic subagent (Locke, gpt-5.5 high) + gh/git 최신 verification. (a) merge safety / (b) rebase FF 적합 (1 ahead 0 behind) / (c) post-merge HEAD 예상 정확 / (d) canary 항목 적절 / (e) PR #20 docs branch 무관
  · **WATCH (비차단)**: `reportExistsForMonth`가 자체 Supabase client 생성 (auth client DI 재사용 아님) — P1 scope 허용. P3 도입 시 본 guard를 feature flag (`PR4_TRIGGER_UPSERT_ENABLED`) toggle 필요 — 코드 주석 박제.
- **branch + PR + 머지**: `feat/b65-p1-immediate-guard` (cherry-pick from docs branch off origin/main `75fb46a`, local commit 7325f00). **PR #21 MERGED in main `5b99e03`** (rebase FF, GitHub resigned, --delete-branch, 2026-05-26T07:11:50Z). 본 HANDOFF 57차 §1 cleanup + post-merge update는 PR #20 `docs/56-section5-handoff-restructure`에 포함 (rebase onto 5b99e03 완료).
- **Vercel production deploy**: ✅ SUCCESS (dpl_82mtwUy82n365yF9WTuYjuhv59wL). B65-P1 P1 guard production active — trigger button click 시 `report_not_found` fail-fast (cost burn 0).
- **검증 게이트**: test:ci 1126 → **1130 PASS / 105 files** (+4 신규, 회귀 0) · build 25 routes · lint 0 err 6 warn (pre-existing) · tsc clean · 0 migrations
- **다음 1순위**: CLAUDE Task 3 B65-P2 RPC R-debate (omxy 옵션 A/B/C + axis i/ii/iii) → Task 4-8 진행.

### 56차 §5 PR4 MERGED ✅ (canonical 5-PR 완료, 2026-05-26)

- **scope**: PR #19 MERGED in main `7de9696` via rebase FF (26 commits) + Vercel auto-deploy 트리거. canonical 5-PR 마지막 단계 완료. 0 migrations 유지 (PR4 invariant). https://github.com/son00326/New_Project_KR_Stock/pull/19
- **Tasks 1-9 모두 완료**:
  · Task 1 (Steps 1.0-1.3): T5 first vertical slice — admin trigger button + caller DI seam (commitFullReport + 7 helpers)
  · Task 2 (Steps 2.1-2.3): orchestrateFullReport DI + admin path swap (quality, Kevin v3.1 target) + Regen orchestrate wire
  · Task 3: Track Record 누적 vs 월별 아카이브 탭 분리 — **Group A + F 해소** (shadcn Tabs base-ui)
  · Task 4 (PR3a OOS RT#1): Section8ModernView.partA 14 rows render + PersonaVoteChip + Tier 2 inactive fallback
  · Task 5 (PR3a OOS RT#3): transformCommitteeVoteRow null+warn + transformCommitteeVoteRows wrapper + aggregateVotes skip+warn
  · Task 6 (PR3a OOS RT#4/RT#5): 5 LLM max bounds — headline 200 / thesis 10 / summary 1000 (sections 2~7) / quote 500 / one_line 300 (core + sector)
  · Task 7 (B18): CRON_SECRET 401 + MF4 4 OR branch isolation (NODE_ENV/VERCEL_ENV production/VERCEL_ENV preview/NEXT_PUBLIC_APP_ENV)
  · Task 8 (W7): orchestrator enriched/input drift 0건 + static invariant test (adminUserId만 input.*, 나머지 enriched.*)
  · Task 9 (finalize): format-error inventory +9 신규 매핑 + 3-track Fix-First adoption
- **omxy lifecycle (PR4)** Plan stage R1~R7 (21 BLOCKERS B1~B21) + Impl 13 cycles × R1~R8 (24 BLOCKERS B23~B46, B22 skipped):
  · B23~B28 Task 1+2 caller DI seam invariant 정밀화 (6)
  · B29~B31 Step 2.3 Regen orchestrate wire (3)
  · B32~B34 Task 3 Promise.all 병렬화 + drill-in stub + ApprovalBadge 5 variants (3)
  · B35~B38 Task 4-6 plan typo + source-static + function-scope + branch-label association (4)
  · B39~B40 Task 7 MF4 4 OR + branch isolation (2)
  · B41~B46 Task 9 inventory 완전성 + B41 ai_key_unavailable + B42 release-state + B43 button-in-summary 구조 + B44 silent-regression tests + B45 ShortlistRow invariant + B46 push gate Regen test plan (6)
- **3-track deep review** (CLAUDE.md §7.8 gsd-code-reviewer 부재 대체 패턴):
  · Track 1 gstack-review skill inline: 0 critical (사전 PASS)
  · Track 2 general-purpose depth=deep: 3 Critical + 7 Warning + 6 Info (1500+ word adversarial report)
  · Track 3 5-angle scan + 1-vote verify: 1 Critical + 5 Warning + 6 Info (JSON findings)
  · **Cross-confirmed Critical**: C-1 (button-in-summary HTML5 nesting) — omxy 12 cycles 미catch, Track 2+3 모두 catch (DOM hierarchy 시각 검토)
  · **Fix-First adoption**: C-1+C-2+C-3+W1+W3 = **5 추가 BLOCKERS**
- **PR4 lifecycle total**: 21 + 24 + 5 = **50 BLOCKERS catch & fix**
- **검증 게이트 (7de9696 main baseline)**: test:ci 1010 → **1126 PASS** / 105 files (+116 net, 회귀 0) / build 25 routes / lint 0 err / tsc clean. 0 migrations (PR4 invariant).
- **14 defer follow-up tickets**: PR #19 body 박제. Track 2 W-1~W-7 + Track 3 W2/W4/W5/I1-I6 — architectural drift / observability gap / cosmetic (push 차단 아님).
- **post-merge production audit 발견 (56차 §5 docs cleanup phase)**: PR4 MERGED 직후 사용자 catch — Supabase 직접 query 결과 `cost_log=0` / `stock_reports=0` / `committee_votes=0` / `short_list_30` 30 rows (sector="코스닥"/"코스피" placeholder). **B65 CRITICAL** (`update_report_sections_0_7` UPDATE-only RPC가 row 부재 시 fail → AI 호출 1~3건 비용 burn 후 fail) + **B66 quality** (canonical 14 미반영). 56차 §5 omxy R1~R8 8 rounds CONVERGED (B65~B98 catalog 34 catch). **다음 세션 sequence = §2.1 active matrix 8-row** (production audit → B65-P1/P2/P3 → B66 → Smoke Stage 1+2 → audit → PR5). §9 신규 박제 참조.
- **다음 1순위 (다음 세션 진입자)**: §2.1 active 8-row matrix 1순위 = production audit 재확인. Task 7 (Smoke Stage 2) PASS 후만 PR5 진입 자격. 이전 박제 "PR5 cron 30 자동 + 큐 인프라"는 entry blocker 해소 후로 재배치.

**Older historical (49차~56차 §4, S7a Anthropic wrapper, Tier 2 SoT+impl, PR2/PR3a/PR1/PR3b/PR3c MERGED, 53차 §5 spec doc 박제, PR4 Task 1+2 부분 완료)** = git log + spec/plan/REVIEW docs + PR #19 body + ProgressDashboard 위임.

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

### 7.7 PR2 신규 lesson 박제 (54차 §1)

- **persona ID 형식 production 정합**: 새 모듈이 production persona 호출 시 ID 형식 (kebab-case) 일치 필수. test fixture를 production source (`@/lib/ai/prompts/personas`)에서 import 권장. drift catch 위한 invariant test 박제.
- **schema length+unique는 약함**: 외부 입력 (LLM 응답 등)을 받는 zod schema는 단순 length+unique만으로 부족. exact set equality (assert helper) 또는 enum check 추가.
- **count consistency refinement**: 분포 fields (counts, distributions)는 source field와 cross-refinement로 corruption 차단. SelectionMeta vs selected.assigned_timeframe 분포 일치 등.
- **scope purity grep**: PR boundary 검증 — 외부 모듈 import (writer / admin-* / cron / migration) 0 매치. DB write keyword (cost_log INSERT / SET / UPDATE) doc comments 외 0 매치.
- **Promise.allSettled**: 다수 외부 호출 batch는 Promise.all (single fail → batch reject) 대신 Promise.allSettled + fail-fallback 권장.

### 7.8 PR1 신규 lesson 박제 (54차 §4) — gsd-code-reviewer 대체 + 3-track deep review 패턴

**⚠️ gsd-code-reviewer agent 부재**: 현 Claude Code 환경에 `gsd-code-reviewer` subagent type 없음 (외부 환경 agent였음). PR3a 박제는 historical reference 그대로 유지. **PR3b/PR4 이후 모든 PR의 deep review는 아래 3-track 대체 패턴 강제 적용**.

**3-track deep review 패턴** (gsd 동등 책임 대체):

1. **Track 1 — `gstack-review` skill** (inline):
   - SQL safety / LLM trust boundary / concurrency / enum completeness / cross-file impact
   - Scope detection (BACKEND/AUTH/FRONTEND/MIGRATIONS/API) 자동
   - 사용 방법: `Skill` 도구로 `gstack-review` 호출. 별도 dispatch 0 (inline 분석).

2. **Track 2 — `general-purpose` agent (depth=deep adversarial)** (background):
   - gsd 동등 deep code review 책임. 1500+ words 구조화 보고서.
   - 프롬프트에 명시: depth=deep / Critical/Warning/Info 분류 / BLOCKER 매핑 검증 / file:line 증거 / Ship recommendation.
   - PR1에서 검증: 14 findings (1 Critical / 7 Warning / 6 Info), C1 + W2/W5/W7 fix.

3. **Track 3 — `superpowers:code-review` skill 5-angle scan** (background agent):
   - 5-angle (line-by-line / removed-behavior / cross-file / language-pitfall / wrapper-proxy) + 1-vote verify + sweep.
   - 출력: JSON array of ≤15 findings. Confidence 7+ surface.
   - PR1에서 검증: 10 findings (5 CONFIRMED / 4 PLAUSIBLE), B23 ticker injection catch.

**Fix-First adoption**: 3 트랙 cross-confirmed CRITICAL/CONFIRMED 결함은 즉시 fix. PLAUSIBLE은 사용자 판단. defer는 follow-up ticket으로 PR body 박제.

**호출 순서 권장**:
1. PR plan 완성 + omxy R1~Rn debate CONVERGED (BLOCKERS catch & fix)
2. impl commit + omxy R(n+1)~R(n+2) plan-vs-commit verify
3. 3-track deep review 병렬 dispatch:
   - `Skill` (`gstack-review`) inline
   - `Agent` (`general-purpose`, depth=deep prompt) background
   - `Agent` (`general-purpose`, 5-angle prompt) background
4. 모든 트랙 응답 종합 + Fix-First adoption + omxy R(n+3) verify
5. CONVERGED 시 push/PR create

**PR1 검증 결과**: 3-track 모두 동작. R11 B23 catch (Fix-First 단독 도입한 PostgREST injection)가 핵심 가치 입증. 본 패턴이 PR3b/PR4부터 default.

**code-review skill 변경 사항 박제**: PR3a까지의 "gsd-code-reviewer agent" 박제는 historical. PR3b부터 "3-track deep review" 명시. Step matrix Verification 컬럼 일괄 갱신.

**MF2 신규 lesson (B23 PostgREST filter injection)**: Supabase `.not('col', 'in', rawString)` 같은 raw filter string 조립 시 입력 검증 필수. zod `z.string().min(1)`만으로 부족 — format regex (`/^\d{6}$/` 등) 추가. 입력값을 string interpolation으로 PostgREST/SQL syntax에 합치는 path는 모두 동등 위험.

### 7.9 PR4 신규 lesson 박제 (56차 §4) — caller DI seam invariant 정밀화

**핵심 lesson**: caller DI seam test에 **결과값 assert만으로는 silent regression 차단 불가**. injected client / fallback / propagation 2nd-arg를 **helper-chain별로 직접 assert**해야 함.

PR4 impl 단계에서 OMXY가 4 cycle × R1+R2에 걸쳐 catch한 6 BLOCKERS (B23~B28) 모두 동일 패턴 — test가 결과 reportId / 한국어 텍스트 / button 표시 등 surface output만 검증하면 다음 회귀가 silent pass 가능:

- 2nd arg 누락 (`fn(input)` 으로 회귀)
- `{ client: undefined, callerKind: 'admin' }` (callerKind는 맞지만 client 누락)
- `callerKind: 'cron'` drift
- `adminUserId` 하드코딩
- prompt-valid stub drift (`tier1Verdict: 'HOLD'`, `consensusBadge: '🟡'`, summaries `'근거 부족'`)
- `formatErrorMessage` 우회 (raw error code 표시)

**처방** (PR4부터 default):

1. **createClientSpy + helper mocks 변수 capture**: `const helperMock = vi.fn().mockResolvedValue(...)`로 잡고 `vi.doMock`에 주입.
2. **chain helper별 2nd arg assert**: `expect(helperMock).toHaveBeenCalledWith(expect.any(Object), { client: fakeClient })` for injected, `{ client: undefined }` for fallback.
3. **createClient short-circuit assert**: `expect(createClientSpy).not.toHaveBeenCalled()` injected path.
4. **payload field assert**: `expect.objectContaining({...all stub fields, adminUserId, ...})` — input drift catch.
5. **한국어 매핑 assert**: `expect(status).toHaveTextContent('로그인이 필요합니다')` — formatErrorMessage 우회 catch.
6. **shouldRevise=true 별도 test**: callRevise 전파는 default path에서 스킵되므로 failVerdict mock으로 revise branch 강제 진입.

**적용 모듈** (PR4 패턴 — 후속 PR에서 동일 강제): `commitFullReport` + `orchestrateFullReport` + 6 helper (cost-logger / 3 AI clients / 2 data helpers) + `evaluateReport` — 모두 `options: { client?: SupabaseClient } = {}` 2nd arg + body `options.client ?? (await createClient())` fallback.

**grep gate 보강**: 본 PR commit 후 forbidden patterns 0 매치 확인:
- `await createClient\(\)` (raw call without options.client guard) — 본 PR 변경 modules 외 잔재 없어야
- `commitFullReport` (admin path swap 후 source comments + impl 모두 0 매치 — orchestrate path만 잔여)
- `callCritic\(\{`, `callRevise\(\{`, `callFullReport\(\{` (모든 1-arg 호출 0 매치 — always 2-arg)

### 7.10 PR #21 (B65-P1) 신규 lesson 박제 (57차 §1) — omxy 4 rounds verify cycle (R1 plan + R2 commit verify + R3 docs verify + R4 pre-merge sanity)

**핵심 lesson**: PR merge처럼 destructive shared-state action도 **omxy 4 rounds verify cycle**로 검증 가능. 사용자 명시 요청 시 §2.0 exception bucket #6 게이트 해제 후, 머지 결정 자체를 omxy R-debate에 포함.

PR #21 lifecycle full omxy verification (사용자 요구 = "omxy랑 하나하나 검증해나가면서 이번세션에서 해야하는거"):
- **R1 plan** (BLOCKERS 0): debate-with-omx + native critic subagent — plan-vs-spec 정합
- **R2 commit verify** (BLOCKERS 0): + OMX code-review skill + **2 subagent parallel** (code-reviewer + architect/devil's advocate) — plan-vs-commit 정합 + silent regression invariant
- **R3 HANDOFF cleanup verify** (BLOCKERS 0): + native critic — 다음 세션 진입 가능성 검증
- **R4 pre-merge sanity** (BLOCKERS 0): + gstack ship sanity skill + native critic + gh/git verification — 머지 safety + rebase FF 적합성 + post-merge HEAD 예상

**post-merge sequence** (PR #21 패턴):
1. `gh pr merge <N> --rebase --delete-branch`
2. `gh api .../commits/<sha>/statuses` → Vercel deploy state poll
3. production audit re-verify (drift 0)
4. HANDOFF rebase + post-merge update (PR ✅ MERGED 박제)
5. omxy R3+ verify (optional, post-merge state 검증)

**2 subagent parallel** (code-reviewer + architect/devil's advocate) 사용 시 CONVERGED 신뢰도 + 잠재 follow-up 박제 모두 동시 달성.

PR #21 R2 단계 omxy debate pattern:
- **Track**: debate-with-omx Responder + OMX code-review skill (inline)
- **Subagent 1 (code-reviewer)**: gpt-5.5 high read-only. plan-vs-commit 정합 + grep + format 매핑 검증. 출력: "BLOCKERS 0 / Evidence ..." 형식.
- **Subagent 2 (architect/devil's advocate)**: gpt-5.5 high read-only. 아키텍처 coupling + 후속 phase risk 탐지. 출력: "Status: WATCH/BLOCK / Analysis ..." 형식.

**WATCH suffix 패턴**: BLOCKERS 0 + 비차단 WATCH 항목 = "본 PR 진입 OK + 후속 phase에서 처리할 follow-up 박제" 효과. PR #21 R2 WATCH = "P3 도입 시 feature flag toggle 필요" (코드 주석에 박제).

**처방** (PR #21부터 default — 후속 PR (Task 3, Task 4 등) 동일 강제):

1. **R1 plan** = debate-with-omx + 1 native critic subagent (plan 정합 검증).
2. **R2 commit verify** = debate-with-omx + OMX code-review skill + **2 subagent parallel** (code-reviewer + architect).
3. **CONVERGED 조건** = BLOCKERS 0 + WATCH 항목은 코드 주석/PR body/HANDOFF에 박제.
4. **사용 skill/agent 명시** = omxy 응답 첫 줄에 사용 도구 listed (사용자 명시 요구 = "claude/omxy 둘 다 에이전트와 스킬 활용").

**3-track deep review와의 관계** (§7.8):
- 3-track = PR 전체 (impl 완료 후 push 전) 1회 deep review (gsd-code-reviewer 대체).
- **omxy R1+R2 = 매 commit/task 단위 detail review** (silent regression invariant 차단).
- 두 패턴은 **complementary** (3-track은 broad, omxy R1+R2는 narrow). PR3b/PR4/PR #21 모두 적용.

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
- **HANDOFF.md 다음 세션 자동 진행 가능 조건**: §0 + §1 + §2 + §9 모두 stale 0. 본 **57차 §1 종료 시점** = PR4 MERGED ✅ + Task 1+2 ✅ + **PR #21 MERGED in main `5b99e03`** (B65-P1 production active, Vercel deploy SUCCESS) / canonical 5-PR 완료 / test:ci 1126 → 1130 PASS (+4 신규 B65-P1 invariant) / build 25 routes / lint 0 err / tsc clean / 0 migrations / **PR #21 omxy R1+R2+R3+R4 CONVERGED (BLOCKERS 0, 누적 subagent 5명)**. **USER 잔여 액션 = Smoke Stage 2 시점 1회 승인 (Task 7) only** → 다음 = CLAUDE **§2.1 active 8-row matrix Task 3 B65-P2 RPC R-debate** 진입 의사 1회 확인 후 자동.
- **DI seam invariant 정밀화 default (§7.9 PR4 lesson)**: 모든 caller DI test는 결과값 assert만이 아닌 (1) createClient short-circuit (2) helper-chain 2nd arg propagation (3) payload field invariant (4) 한국어 매핑 (5) shouldRevise=true revise branch — 5중 명시 assertion 필수.

---

## 9. PR4 MERGED ≠ production functional — B65~B98 박제 (56차 §5 post-merge, omxy R1~R8 CONVERGED)

> **삭제 조건**: §2.1 active 8-row matrix Task 1~7 모두 PASS (production audit + B65-P1/P2/P3 + B66 backfill + Smoke Stage 1+2 PASS) 시 본 §9 + 8-row matrix를 HISTORICAL로 강등하고 PR5 active submatrix로 교체.

### 9.1 발견 경위

PR4 MERGED `7de9696` 직후 사용자 catch: "AI 키 도입 후에도 short_list_30 30 rows가 동일 — AI 가 올바르게 동작?". Supabase 직접 query + 코드 cross-verify 결과:

- `cost_log` = **0 rows** (성공/기록된 AI 호출 0건; Vercel env 3 vars 배포 완료 + 충전 완료에도 불구)
- `stock_reports` = **0 rows**
- `committee_votes` = **0 rows**
- `short_list_30` = **30 rows** (2026-05-12 mechanical Python seed 1회, sector="코스닥"/"코스피" placeholder)
- `tudal/src/app/api/cron/monthly-batch/route.ts` = `mockTier0Source` / `mockCallPersonaPanel` throw → **cron path AI 호출 자동 진입 X**
- `tudal/supabase/migrations/0022_update_report_sections_0_7.sql` = UPDATE-only RPC throw `report_not_found_for_section_0_7_update` if row missing → **admin trigger button path AI 호출 후 RPC fail (1~3 LLM call 비용 burn)**

PR4 lifecycle omxy debate + 3-track deep review가 본 결함 miss한 이유: 모든 테스트가 RPC를 mock하여 UPDATE-only constraint가 production-only로 잠복.

### 9.2 B65 CRITICAL — PR4 trigger button = cost burn fail (3-phase 분리)

**원인**: writer Opus + critic Haiku + 조건부 revise (1~3 LLM calls, exact cost = smoke 후 `cost_log` 기준 확정 — B91 박제) 후 `update_report_sections_0_7` RPC가 row 부재 시 fail → AI 토큰 비용 burn + UI에 기술적 에러 문구 노출 (`format-error.ts` 매핑 존재하지만 사용자 가독성 낮음 — B101 정정).

**3-phase 분리** (omxy R7 B94 lock-in):

1. **Phase 1 — P1 immediate guard** (P2 미구현 상태에서만 활성): `triggerFullReport`에 `reportExistsForMonth(ticker, ${month}-01)` (또는 helper 양쪽 수용) → false → fail-fast. **smoke 금지** (B92, trigger button = 영구 fail-fast). 비용 burn 즉시 차단.
2. **Phase 2 — P2 real enablement (B88 R-debate)**: 옵션 (A) admin-only `upsert_report_sections_0_7_admin` RPC, relative cost low, criteria 4 deferred B79 / (B) `commit_persona_eval` 연계 full path, relative cost high, criteria 4 포함 / (C) synthetic — 위험. R-debate axis: (i) admin trigger 책임 범위 / (ii) B79 동시 해결 / (iii) PR5 cron path 일관성.
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
- **B79** — Section 8 partA/partC/partD + `committee_votes` RPC 책임 boundary 결정 (B65-P2 옵션 A 선택 시 deferred / 옵션 B 선택 시 동시 해결).
- **B80** — PR4 14 defer follow-up tickets (W-1 callerKind dead code / W-2 fetchTrackRecord* in actions.ts / W-4 sub_tags / W-5 user.email / W-6 as never cast / Track 3 I1-I6). 본 audit 시점에 일괄 분류.

**R3 알려진 항목 (B81~B85)**:
- **B81** — 단일 실 AI smoke 비용 분석 (per-call low / batch large). Stage 2 cost 추정 reference.
- **B82** — B65 docs-only 박제 strict (본 세션 내 코드 변경 금지). 다음 세션에서 해제.
- **B83 / B84** — `short_list_30` backfill verify command (Python seed re-run + `select sector, count(*) from short_list_30 group by sector` cross-check). B66 Task 5 PASS criteria 1~3.
- **B85** — 다음 세션 Stage 2 진입 직전 1-token model id verify (`ANTHROPIC_API_KEY` + `ANTHROPIC_OPUS_MODEL_ID` + `ANTHROPIC_HAIKU_MODEL_ID` Vercel env 정합).

**post-merge production deploy verify (추가)**: post-§5 docs merge 후 Vercel canary 4 페이지 (`/admin/portfolio`, `/admin/track-record`, `/admin/report/[ticker]`, `/admin/report/[ticker]/regenerate`) + functional smoke 3 (C-1 click / C-2 validation / B18 401) 결과 박제. **단 trigger button 클릭은 B65 fix 전까지 비용 burn risk**.

### 9.6 omxy R1~R8 CONVERGED 박제 (B105 정정 — user-visible Round 번호 기준 단조 정렬)

56차 §5 post-merge docs cleanup omxy debate 8 rounds 진행. 각 라운드 = "이전 catch fix 반영 + 신규 catch". B 번호는 라운드 내 신규 catch 항목 기준 monotonic 증가. CONVERGED at R8.

**라운드별 신규 catch (B105 정정 — 단조 증가 lock-in)**:
- **R1** — initial discovery: B65 (PR4 trigger button = cost burn fail) 발견 + B66 (`short_list_30` sector="코스닥"/"코스피" placeholder) 발견. 3-phase 분리 priority debate.
- **R2** — audit catalog 형성 (B67~B80, 본 §9.5 참조): cron path 자동 호출 결함 / AI key·cost_log 0건 / committee_votes 0건 / regen UX / shortlist stale / row-missing preflight / model id verify / cost_log accounting / RPC responsibility boundary / hardcap mock-real 일관성 등 잠재 follow-up + main HEAD fixed SHA 박제 금지.
- **R3** — cost/scope discipline: B81 (단일 실 AI smoke 비용 분석) / B82 (B65 docs-only 박제 strict) / B83+B84 (`short_list_30` backfill verify command) / B85 (model id 1-token verify).
- **R4** — audit detail: B86 (month format mismatch) / B87 (5-criteria → R5에서 Core/Full-path 분리) / B88 (B65-P2 RPC R-debate axis 3종 = A/B/C) / B89 (B66 unknown 처리 block/manual/exclude).
- **R5** — Smoke acceptance 강화: B90 (Core vs Full-path 분리) / B91 (cost 수치 박제 금지 — relative only, exact = smoke 후 cost_log 기준) / B92 (P1 적용 후 P2 전 smoke 금지) / B93 (B66 backfill PASS criteria 3종).
- **R6** — P1/P2 호환 critical: B94 (P1 guard P2 path 호환 3-option = feature flag / RPC presence / atomic transaction) / B95 (smoke acceptance pre-assert).
- **R7** — Smoke 분리 + default policy: B96 (smoke target 정정 — short_list_30 존재 + stock_reports 부재 ticker) / B97 (smoke 2-stage 분리 = non-AI dry-run + single real AI) / B98 (P3 default = (i) feature flag recommended / (iii) atomic transaction secondary / (ii) RPC presence check 비추천).
- **R8** — **CONVERGED** (B96~B98 fix 반영 확인).

**post-CONVERGED R9 audit BLOCKERS** (commit `dff1cbe` 해소): B99 §9.6 round map / B100 §1 cost_log 원인 서술 / B101 raw error 표현 / B102 PR4 historical heading 중복 / B103 §9.5 catalog 항목별 보존 / B104 §0 production audit SQL.

**post-R9 R10 audit BLOCKERS** (본 commit 해소): **B105** §9.6 round map 단조 증가 정렬 (본 단락) / **B106** B67~B80 항목별 1줄 catalog (§9.5) / **B107** Smoke criteria 5 PASS 문구 정정 (mapped error message = FAIL 명시).

**SCOPE GUARD 박제 (56차 §5 종료 시점)**: B65-P1/P2/P3 + B66/B84/B89 + Smoke Stage 1+2 + §9.5 audit catalog + PR5 모두 **다음 세션 작업** (56차 §5는 docs-only).

### 9.7 57차 §1 진행 — Task 1+2 ✅ + PR #21 MERGED (B65-P1 production active)

57차 §1 진행 결과:

- **Task 1 (production audit)** ✅ COMPLETED — drift 0 확인 (56차 §1 ground truth와 100% 일치)
- **Task 2 (B65-P1 immediate guard + B86 month format)** ✅ **MERGED in main `5b99e03`** (PR #21 rebase FF, GitHub resigned commit, --delete-branch, Vercel deploy SUCCESS)
- **omxy 4 rounds 누적 CONVERGED (BLOCKERS 0)**:
  · R1 plan: debate-with-omx + native critic Hegel
  · R2 commit verify: + OMX code-review skill + **2 subagent parallel** (code-reviewer Leibniz + architect McClintock)
  · R3 HANDOFF cleanup verify: + native critic Hubble
  · R4 pre-merge sanity (사용자 명시 요청): + gstack ship sanity skill + native critic Locke + gh/git verification
- **WATCH (비차단)**: P3 도입 시 본 guard를 feature flag (`PR4_TRIGGER_UPSERT_ENABLED`) toggle 필요 — 코드 주석 박제

**B65 3-phase 진행률**:
- **P1** ✅ **MERGED in main `5b99e03`** (57차 §1 PR #21 production active, trigger button click → `report_not_found` fail-fast, cost burn 0)
- **P2** 🔴 다음 세션 1순위 (Task 3 R-debate — 옵션 A/B/C + axis i/ii/iii)
- **P3** 🔴 Task 4 (B98 default = feature flag `PR4_TRIGGER_UPSERT_ENABLED=true`)

**B66 진행률**: 미진행 (Task 5 — Python seed canonical 14 backfill + B93 PASS criteria 3종)

**Smoke 진행률**: 미진행 (Task 6 Stage 1 dry-run TDD + Task 7 Stage 2 single real AI USER 승인)

**post-merge production audit (PR #21 머지 직후)**: cost_log=0 / stock_reports=0 / committee_votes=0 / short_list_30=30 — drift 0 확인. PR #21 머지로 P1 guard production active (코드 변경만, 직접 data 변경 0).

**SCOPE GUARD 박제 (57차 §1 종료 시점)**: Task 3-8 모두 **다음 세션 작업**. 57차 §1는 Task 1+2 + PR #21 머지 + HANDOFF cleanup으로 종료.
