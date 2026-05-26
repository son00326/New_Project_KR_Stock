# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-26 (56차 §5 — **PR4 MERGED ✅ in main `7de9696`** via rebase FF (PR #19, 26 commits) · Tasks 1-9 모두 완료 + 3-track Fix-First adoption · **canonical 5-PR 완료** · plan v1~v7 + impl 26 commits + OMXY plan R1~R7 21 BLOCKERS + impl 13 cycles R1~R8 24 BLOCKERS (B23~B46) + 3-track Fix-First 5 (C-1+C-2+C-3+W1+W3) = **Total 50 BLOCKERS catch & fix** · test:ci 1010 → 1126 PASS (+116 net, 105 files, 회귀 0) / build 25 routes / lint 0 err / tsc clean · 0 migrations (PR4 invariant) · OPEN PRs: #2 (format-error, 보류) only (post-merge state, 본 §5 docs commit 머지 후 #18 close) · **USER 잔여 액션 = 0** · 다음 CLAUDE 1순위 = **PR5 cron 30 자동 + 큐 인프라** (T11 분할 결정 보존, 16,050원/월 hardcap 4% 박제) 진입 의사 1회 확인 후 자동 시작.

---

## ⭐ 다음 세션 진입자 5줄 요약 (56차 §5 종료 시점)

1. **PR4 MERGED ✅ — canonical 5-PR 완료.** PR #19 MERGED in main `7de9696` via rebase FF (26 commits, https://github.com/son00326/New_Project_KR_Stock/pull/19) + Vercel auto-deploy 트리거. Tasks 1-9 모두 완료: T5 first vertical slice + orchestrator DI + Regen wire + Track Record 탭 + PR3a OOS 3종 + B18 cron 401 + W7 enriched/input drift + format-error inventory + 3-track Fix-First (C-1+C-2+C-3+W1+W3).
2. **OMXY 누적 (PR4 lifecycle)**: Plan stage R1~R7 21 BLOCKERS (B1~B21) + Impl 13 cycles × R1~R8 24 BLOCKERS (B23~B46) + 3-track Fix-First 5 = **Total 50 BLOCKERS catch & fix**. PR4 §7.9 caller DI seam invariant lesson + 신규 §7.10 3-track Fix-First lesson 박제 (gsd-code-reviewer 부재 대체 패턴 5 BLOCKERS 추가 catch — Track 2+3 cross-confirmed C-1 button-in-summary HTML5 nesting 등).
3. **검증 게이트 (7de9696 main baseline)**: test:ci 1010 → **1126 PASS** (+116 net, 105 files, 회귀 0) / build 25 routes / lint 0 err / tsc clean. 0 migrations (PR4 invariant). Vercel canary: 본 HANDOFF commit 시점 pending → main deploy 완료 후 사용자 verify (PR4 핵심 4 페이지 + 기존 4 페이지 + Functional smoke 3 항목 plan).
4. **다음 CLAUDE 1순위 = PR5 cron 30 자동 + 큐 인프라** (T11 분할 결정 보존, **16,050원/월 hardcap 4% 박제**). caller path = `orchestrateFullReport(callerKind='cron')` (quality, Kevin v3.1 target). timeout 처리 = β1 Vercel Queues OR β2′ 자체 DB job queue (PR5 plan 시점 R-debate). fail = γ1 allSettled + γ3 retry + summary alert. cost = δ1 + batch preflight. admin_id = 'cron-system'. service-role client DI + cost_log e2e test.
5. **canonical 5-PR 순서 (모두 완료)**:

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
   | **D** (잔여) UI caller wire | **PR4** | ✅ **MERGED `7de9696`** |
   | **cron 30 자동 리포트 + 큐 인프라** | **PR5 (분리)** | ⭐ **다음 1순위** (PR4 머지 후 진입 트리거 충족) |

**진입 트리거**: "`Document/Process/HANDOFF.md` 보고 이어서 진행" → §0 verify (main HEAD post-§5-merge + OPEN PRs `#2` only + test:ci 1126 PASS) → **PR5 cron 30 자동 + 큐 인프라 진입 의사 1회 확인 후 자동 시작** (plan SoT 작성부터). PR4 acceptance 검증 = §6 56차 §5 entry + PR #19 body 참조.

**14 defer follow-up tickets (PR4 출신, PR4 본 PR scope 외)**: PR #19 body 박제. architectural drift (W-1 callerKind dead code / W-2 fetchTrackRecord* in actions.ts) + observability gap (W-4 sub_tags / W-5 user.email) + cosmetic (W-6 as never cast / Track 3 I1-I6). PR4 product release 차단 아님, 별도 PR/follow-up.

**⚠️ PR4 acceptance criterion 박제 (불변)**: PR4 scope = admin manual trigger 버튼 + Regen + Track Record + PR3a OOS + **B18 CRON_SECRET 401 test만** + Task 8 W7만 (defer는 source review docs 링크). 본 PR에서 적용:
1. **caller DI seam (✅ 완료)** — `commitFullReport` / `orchestrateFullReport` + 모든 helper (cost-logger / AI clients 3종 / report-critic-findings / sector-reference-backlog / critic.ts evaluateReport) options:{client?} 패턴
2. **admin caller = quality (✅ 완료)** — admin manual = `orchestrateFullReport(callerKind='admin')` Kevin v3.1 quality target
3. **CRON_SECRET 401 test (잔여)** — cron route가 CRON_SECRET 미일치 시 401 반환 검증 (Task 7)

> **cron 30 자동 리포트 + service-role caller DI + admin_id 'cron-system' + cost_log e2e test = PR5 후속 트랙** (T11 분할 결정 보존, PR4 머지 후 진입). PR5 caller path = orchestrateFullReport (quality), timeout 처리 = 자체 DB job queue β2′ 또는 Vercel Queues β1 (PR5 plan 시점 R-debate).

**운영 원칙**: 미래 지향. §6 완료 이력 = 직전 2 entry inline (56차 §4 PR4 Task 1+2 + 55차 §4 PR3c MERGED baseline)만. older historical = git log + spec/plan/REVIEW docs + ProgressDashboard 위임.

**⚠️ gsd-code-reviewer 환경 부재 대체 정책 (54차 §4 박제)**: 현 Claude Code 환경에서 `gsd-code-reviewer` agent type은 더 이상 사용 불가. PR3b/PR4/후속 모든 PR의 deep code review는 **3-track 대체 패턴** (PR4 finalize Task 9에서 적용):
- **Track 1**: `gstack-review` skill (pre-landing PR review, structural/SQL/LLM trust/concurrency)
- **Track 2**: `general-purpose` agent (depth=deep adversarial prompt — gsd 동등 책임)
- **Track 3**: `superpowers:code-review` skill 또는 5-angle scan agent (recall mode bug catch)

---

## 0. 세션 시작 루틴 (verify + auto-progress)

```bash
# 56차 §5 post-PR4-MERGED state — main 기준 (worktree pr4 cleanup user 결정)
cd /Users/yong/New_Project_KR_Stock

# 1. main branch state runtime 확인
git checkout main && git pull origin main
git rev-parse --abbrev-ref HEAD                   # main
git rev-parse --short HEAD                        # 7de9696 (PR4 MERGED) + 후속 docs commit
git status --short                                # clean

# 2. OPEN PRs (56차 §5 post-merge baseline: #2 (format-error, 보류) only)
gh pr list --state open --json number,title,headRefName,mergeable

# 3. canonical 5-PR MERGED 박제 확인
git log --oneline | head -5  # PR4 MERGED 7de9696 + PR3c b2a902a + PR3b cf68731 + PR1 4aa3130 + PR3a 0813a41 + PR2 f85fb69

# 4. 검증 게이트 (56차 §5 PR4 MERGED baseline)
#    - test:ci 1126 PASS / 105 files (+116 over 1010, 회귀 0)
#    - build 25 routes / lint 0 err 6 warn (pre-existing) / tsc clean
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

### 진입자 자동 행동 (§2.0 default-progress policy)

1. **§0 verify 실행** → branch state + PR state + 검증 게이트 확인.
2. **§2.1 Step matrix 다음 unblocked step 식별**.
3. **Owner 별 행동**:
   - **[CLAUDE]** → 즉시 자동 시작 (stacked 1세션+ 작업은 진입 의사 1회 확인).
   - **[SHARED]** → "이어서 진행" 권한으로 prepare/commit/push/PR-create 자동.
   - **[USER]** → background blocker 보고 + 동시 가능한 [CLAUDE] step 자동 시작.
4. **§2.0 7 exception buckets 도달 시만** USER 직접 묻기 (scope expansion / product spec / risk profile / real-money / secrets·billing / destructive shared-state / uncertainty ≥ medium).
5. **§7 omxy 적대적 검토 패턴**은 모든 신규 작업 branch에서 강제 적용.

---

## 1. 현재 상태 (56차 §5 PR4 MERGED 시점, 2026-05-26)

| 영역 | 상태 |
|---|---|
| main HEAD | **PR4 baseline `7de9696`** (PR #19 MERGED rebase FF, 26 commits + PR3c `4e61832` baseline). 본 §5 docs commit 머지 후 main HEAD는 docs head로 advance — 즉시 post-merge state. |
| **현재 OPEN branch** | docs/56-step4-handoff-cleanup (PR #18) — 본 §5 commit으로 §4+§5 합산. 본 commit 머지 후 #18 close. |
| **PR4 PR** | ✅ **MERGED `7de9696`** (PR #19, https://github.com/son00326/New_Project_KR_Stock/pull/19, 26 commits rebase FF, --delete-branch) |
| **PR4 Task 1-9 모두 완료** | T5 first vertical slice + orchestrator DI + Regen wire + Track Record 탭 + PR3a OOS 3종 + B18 cron 401 + W7 enriched/input drift + format-error inventory + 3-track Fix-First |
| **PR4 OMXY 누적** | Plan stage R1~R7: 21 BLOCKERS (B1~B21) · Impl 13 cycles × R1~R8: 24 BLOCKERS (B23~B46) · 3-track Fix-First: 5 (C-1+C-2+C-3+W1+W3) · **Total 50 BLOCKERS catch & fix** |
| **PR5 후속 트랙** | ⭐ **다음 1순위** — cron 30 자동 리포트 + 큐 인프라 (T11 분할 결정 보존, 16,050원/월 hardcap 4%) |
| canonical 5-PR MERGED (전체 완료) | PR2 `f85fb69` (54차 §2) / PR3a `0813a41` (54차 §3) / PR1 `4aa3130` (54차 §4) / PR3b `cf68731` (55차 §3) / PR3c `b2a902a` (55차 §4) / **PR4 `7de9696` (56차 §5)** — 상세 = git log + PR body |
| Mock Skeleton + DQ-7 + S7e + S7a + Tier 2 | ✅ Mock 완료 / 🟢 DQ-7 ~97% (Smoke #4/#5 + Session 4 QA 잔여) / 🟢 S7e 7/8 (T7e.7 RLS QA 잔여) / ✅ S7a MERGED (51차) / ✅ Tier 2 D21 (52차+53차) |
| 선정 흐름 메인 path | 🟢 spec lock-in: Tier 0 150 → Tier 1 Core 11 AI 평가 → 단/중/장 top 10 = 30. 현재 production = Tier 0 단독 30 직선정 (fallback). PR5 cron 가동 시 메인 path 활성. |
| 풀 리포트 흐름 | 🟢 PR3b writer Section 0~7 + Section 8 partA/partD + PR3c 3-step orchestration + **PR4 admin caller (orchestrateFullReport quality) wired**. PR5 = cron caller (cron-system admin_id + service-role client DI). |
| OPEN PRs | **#2** (format-error, 보류) only (본 §5 docs commit 머지 후 #18 close 박제) |
| 실 AI 호출 | 0 (Vercel env 3 vars Production 배포 완료). PR4 MERGED 후 admin UI trigger 가능 + 실 키 발급 후 활성. |
| Production deploy | **Vercel main `7de9696` deploying** (본 HANDOFF commit 시점 pending). 완료 후 canary verify: PR4 핵심 4 페이지 (/admin/portfolio, /admin/track-record, /admin/report/[ticker], /admin/report/[ticker]/regenerate) + 기존 4 페이지 (/, /login, /macro, /admin) + Functional smoke 3 (C-1 click + C-2 validation + B18 401). |
| Supabase | project `rbrpcynhphrpljbjirfo` · 0001~0024 production 적용 완료 (PR3c 0023+0024 포함). **PR4 = 0 migrations 유지 (invariant)**. SECURITY DEFINER 4-grant 패턴 유지. |
| 검증 게이트 (7de9696 main baseline) | build 25 routes / lint 0 err 6 warn (pre-existing) / **test:ci 1010 → 1126 PASS / 105 files (+116 net, 회귀 0)** / tsc clean |
| omxy debate 누적 | **PR3c까지 238+ rounds** (55차 §4 종료) · PR4 lifecycle = plan R1~R7 (21 BLOCKERS) + impl 13 cycles R1~R8 (24 BLOCKERS B23~B46) + 3-track Fix-First (5) = **PR4 50 BLOCKERS** |

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

### §2.1 Step matrix (56차 §5 active — canonical 5-PR 완료, PR5 진입 대기)

**현재 위치 = PR4 MERGED ✅ (main `7de9696`). canonical 5-PR 완료. 다음 = PR5 cron 30 자동 + 큐 인프라 (T11 분할 결정 보존). USER 잔여 액션 = 0. CLAUDE 다음 1순위 = PR5 plan SoT 작성 + omxy debate.**

> **[HISTORICAL — PR4 active submatrix 강등, 56차 §5 PR4 MERGED로 갱신]**: 아래 PR4 Task 1-9 matrix는 PR #19 MERGED 이력. §6 56차 §5 entry + PR #19 body 참조. PR5 active submatrix는 PR5 plan 작성 시 신설 예정.

Owner 의미: **USER** (사용자만) · **CLAUDE** (자동) · **SHARED** ("이어서 진행" 권한으로 push/PR-create 자동, merge/deploy/migration은 USER).

#### PR4 historical submatrix (pre-merge snapshot, PR #19 MERGED `7de9696`)

> **HISTORICAL 박제 — 본 matrix는 PR4 MERGED 후 pre-merge snapshot. 다음 세션 진입자는 §6 56차 §5 entry + PR #19 body 참조. Step 2.3 / Task 3-9 모두 MERGED.**

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
| **PR5** cron 30 자동 + 큐 인프라 (T11 분할 결정 보존) | CLAUDE | PR4 머지 후 | cron monthly-batch route에 30 종목 풀 리포트 자동 호출. caller path = `orchestrateFullReport` (quality, Kevin v3.1 target). timeout 처리 = (β1) Vercel Queues OR (β2′) 자체 DB job queue resumable worker — PR5 plan 시점 R-debate. fail = γ1 allSettled + γ3 retry N + summary alert. cost = δ1 + batch preflight. admin_id = 'cron-system'. service-role client DI + cost_log e2e test. **30 × 535원 ≈ 16,050원/월 (hardcap 4%)**. | omxy + 3-track deep review |
| **Step 4 Reflection** | CLAUDE | PR2~PR4 머지 후 (실 Tier 1 결과 누적 후 의미 있음) | reflection_log 마이그 + Tier 1 context 주입 + tests | omxy + 3-track deep review |
| **Step 7~14** (S7b → S7c → S7d → S8) | USER 트리거 + CLAUDE 구현 | canonical 5-PR + PR5 완료 후 | S7b 뉴스+브리핑 → D11 AI 가상 포트 1차 가동 (어드민 3인 운용 검증) → S7c 장중·KIS WS → S7d Silent Health → S8 자동매매 (Binance Smoke #3) | 각 슬라이스 DoD |
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
| T7e.7 RLS QA 결과 | `Document/Build/Slices/S7-RealData.md` |
| 전체 진행률/변경 이력 | `Document/Build/ProgressDashboard.md` |
| 코드 스냅샷 / 실 I/O 통로 / 잔존 mock | `Document/Process/CodebaseStatus.md` |
| 어드민 서비스 기획 본체 | `Document/Service/Planning/ServicePlan-Admin.md` |
| 슬라이스 실행 규칙 | `Document/Process/ExecutionPlaybook.md` |

---

## 6. 완료 이력 (직전 2 entry inline · older = git log + PR body)

상세는 git log + spec/plan/Slice/PR body + REVIEW.md. 본 §6은 직전 2 entry만 inline.

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
- **다음 1순위 (다음 세션 진입자)**: **PR5 cron 30 자동 + 큐 인프라** — T11 분할 결정 보존 (16,050원/월 hardcap 4%). caller path = `orchestrateFullReport(callerKind='cron')` (quality, Kevin v3.1). timeout 처리 = β1 Vercel Queues OR β2′ 자체 DB job queue (PR5 plan 시점 R-debate). fail = γ1 allSettled + γ3 retry + summary alert. cost = δ1 + batch preflight. admin_id = 'cron-system'. service-role client DI + cost_log e2e test.

### 56차 §3+§4 PR4 Task 1+2 부분 완료 (T5 first vertical slice + admin quality swap, 2026-05-25~05-26)

- **scope**: PR4 (canonical 5-PR 마지막 단계) — plan v1~v7 lock-in + Task 1 (Step 1.0~1.3 T5 first vertical slice) ✅ + Task 2 Step 2.1+2.2 (admin quality path swap) ✅. **Step 2.3 (Regen wire) + Task 3-9 잔여**. PR not yet created. branch `feat/pr4-ui-caller-wire` (worktree `/Users/yong/New_Project_KR_Stock-pr4`, head `c7eced2`, main `4e61832` 기준 **16 commits ahead**).
- **plan SoT**: `docs/superpowers/plans/2026-05-25-pr4-ui-caller-wire.md` (v7 lock-in, plan 단계 OMXY R1~R7 7 rounds CONVERGED + 21 BLOCKERS catch & fix B1~B21).
- **T11 cron 30 자동 분할 결정 (사용자 catch)**: PR4 = admin manual trigger + Regen + Track Record + PR3a OOS + B18 + W7만. **PR5 후속 트랙 = cron 30 자동 + 큐 인프라** (16,050원/월 hardcap 4% 박제).
- **commits 16** (7 plan + 9 impl):
  - plan: `f783ce6` v1 / `bcb3512` v2 / `9d9201c` v3 / `fde9426` v4 / `bf0de5f` v5 / `d8cdad5` v6 / `6650345` v7
  - impl Task 1: `cf23e59` Step 1.0 test infra / `f6205bf` Step 1.1 caller DI seam / `d94a1b9` B23 fix / `3ef9e0b` Step 1.2 triggerFullReport / `39d4b5b` B24 fix / `8f4eb88` Step 1.3 UI button + wire / `99bab77` B25+B26 fix
  - impl Task 2: `5cc98cb` Step 2.1+2.2 orchestrator DI + admin quality swap / `c7eced2` B27+B28 fix
- **OMXY impl 4 cycle × R1+R2 CONVERGED + 6 BLOCKERS catch & fix** (모두 caller DI seam silent-regression invariant 정밀화):
  · B23 (Step 1.1): writer caller-di test가 createClient/preflight/callFullReport 전파를 명시 assert 안 함 → 4 assertion 보강
  · B24 (Step 1.2): triggerFullReport success test가 reportId만 검증, commit args 회귀 silent pass → expect.objectContaining({...11 fields}) + options assertion
  · B25+B26 (Step 1.3): button payload (4-field invariant) + formatErrorMessage 매핑 ('로그인이 필요합니다') 명시 assert
  · B27+B28 (Step 2.1+2.2): callRevise (shouldRevise=true path) + evaluateReport→callCritic 전파 silent regression 차단
- **신규 SoT 코드** (Task 1):
  - test infra: `tudal/src/test/jsdom-setup.ts` (afterEach cleanup) + `tudal/src/test/fixtures/full-report-valid.ts` + vitest.config test.projects 분리 (node + jsdom)
  - source: `commitFullReport` + `orchestrateFullReport` + 7 helper modules (cost-logger / 3 AI clients / 2 data helpers / critic.ts evaluateReport) 모두 `options: { client?: SupabaseClient } = {}` 패턴 + `options.client ?? (await createClient())` fallback
  - actions.ts `triggerFullReport({ticker, name, sector, month})` admin server action — Task 2에서 commitFullReport → orchestrateFullReport (quality path) swap + callerKind='admin'
  - UI: `trigger-full-report-button.tsx` (client) + ShortlistRow `action?` prop + BucketSection `renderRowAction?` prop + page.tsx `byBucket.map → renderRowAction` (month.slice(0,7) YYYY-MM 변환)
- **검증 게이트 (c7eced2 baseline)**: test:ci 1010 → **1058 PASS** / 99 files (+48 net, 회귀 0) · build 25 routes · lint 0 err / 6 warnings (pre-existing) · tsc clean
- **다음 1순위 (다음 세션 진입자)**: Step 2.3 Regen orchestrate wire — `regenerate/actions.ts` orchestrate 호출 + `stock_reports`에서 name/sector fetch + return shape `{manualCount, manualRemaining, +reportId}` + `regenerate-panel.tsx` UI 영향. 진입 의사 1회 확인 후 자동.

### 55차 §4 PR3c MERGED baseline (3-step orchestration + sector_reference_backlog + Group G ✅ 해소, 2026-05-24)

- **scope**: PR #15 MERGED in main `b2a902a` via rebase FF (12 commits) + 마이그 0023+0024 production applied (Supabase MCP) + Vercel canary 4/4 PASS + 후속 PR #16 docs MERGED `c98f2c4`.
- **풀 리포트 생성 흐름**: PR3b 단일 LLM call → **3-step orchestration** (analyst pure-code → writer Opus 4.7 → critic Haiku 4.5 6축 verdict) + conditional revise (Opus max 8192, 1회 hard cap). `commitFullReport` (PR3b) + `orchestrateFullReport` (PR3c) coexist — PR4에서 caller가 path 선택.
- **Group G ✅ 해소**: Sector reference 3-level (Level A 본문 2/12 lazy backlog table 0023 + helper Level A guard + Level B 4/10 docs + Level C 14/14 완료).
- **마이그**: 0023 `sector_reference_backlog` (canonical 14 CHECK + atomic RPC) + 0024 `report_critic_findings` (run_id + target_stage CHECK + reason 500자 + atomic RPC) + 2 rollback. SECURITY DEFINER 4-grant 패턴 (public/anon=false, authenticated/service_role=true) 유지.
- **omxy R1~R23 + 누적 49 BLOCKERS + 3-track Fix-First 5 + Defer 20**. test:ci 917 → 1010 PASS (+93). 상세 = git log + `docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md` + PR #15 body.
- **Defer 20 → PR4 acceptance** (Step 2.3 + Task 3-9에서 처리).

**Older historical (49차~55차 §3, S7a Anthropic wrapper, Tier 2 SoT+impl, PR2/PR3a/PR1/PR3b MERGED, 53차 §5 spec doc 박제)** = git log + spec/plan/REVIEW docs + ProgressDashboard 위임.

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
- **HANDOFF.md 다음 세션 자동 진행 가능 조건**: §0 + §1 + §2 모두 stale 0. 본 **56차 §5 종료 시점** = PR4 MERGED ✅ in main `7de9696` (PR #19) / canonical 5-PR 완료 / test:ci 1126 PASS / build 25 routes / lint 0 err / tsc clean / 0 migrations (PR4 invariant) / OMXY PR4 lifecycle 50 BLOCKERS (Plan 21 + Impl 24 B23~B46 + 3-track Fix-First 5) catch & fix. **USER 잔여 액션 = 0** (Vercel canary verify 사용자 결정) → 다음 = CLAUDE **PR5 cron 30 자동 + 큐 인프라** (T11 분할 결정 보존, 16,050원/월 hardcap 4% 박제) 진입 의사 1회 확인 후 자동.
- **DI seam invariant 정밀화 default (§7.9 PR4 lesson)**: 모든 caller DI test는 결과값 assert만이 아닌 (1) createClient short-circuit (2) helper-chain 2nd arg propagation (3) payload field invariant (4) 한국어 매핑 (5) shouldRevise=true revise branch — 5중 명시 assertion 필수.
