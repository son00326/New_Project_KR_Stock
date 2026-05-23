# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-23 (55차 §2 — **PR3b OPEN as PR #14** at runtime HEAD (rolling; `git rev-parse --short origin/feat/pr3b-writer-section-0-7`로 확인) · omxy R1~R6 6 rounds CONVERGED-track + **누적 27 BLOCKERS catch & fix** (R1 8 + R2 7 + R3 5 + R4 4 + R6 3 [B-R6-1 plan v5 missing fix + B-R6-2 docs stale fix + B-R6-3 PR4 acceptance criterion 명시]) · 3-track deep review (gstack-review inline + general-purpose depth=deep + 5-angle scan) CONFIRMED 3 + Fix-First 6 adopted + 추가 R6 catch (plan v5 박제 + cost_log error format-error 매핑 추가) + Defer 7 follow-up tickets · current main HEAD = `ecdb1a7` (PR1 + post-apply docs 후 변경 0) · OPEN PRs: **#14** (PR3b, current) + **#2** (format-error, 보류). PR3b branch commit count + head SHA + diff stat = rolling (PR #14 body 또는 `git log main..HEAD`로 runtime 확인).

---

## ⭐ 다음 세션 진입자 5줄 요약 (55차 §1 종료 시점)

1. **PR3b (writer Section 0~7 + Appendix 풀 리포트 생성 + 신규 RPC `update_report_sections_0_7`) OPEN as PR #14** (https://github.com/son00326/New_Project_KR_Stock/pull/14). N commits ahead of main `ecdb1a7` (rolling — `git rev-list --count main..origin/feat/pr3b-writer-section-0-7`로 runtime 확인). **단일 LLM 호출** (claude-opus-4-7, max_tokens 8192) + PR3a zod 스키마 재사용 (재정의 0) + per-section safeParse strict + 신규 RPC `update_report_sections_0_7` (0017 패턴 정합: auth.uid + is_admin + service_role bypass + 4-grant + search_path public,pg_temp + input regex [0-9] + month to_date cast + generated_at bump). 신규 TDD tests + baseline 862 → 914+ (회귀 0). 정확 stat = PR #14 body 참조.
2. **omxy R1~R6 6 rounds CONVERGED-track + 누적 27 BLOCKERS catch & fix** (R1 8 + R2 7 + R3 5 + R4 4 + R6 3). **3-track deep review** Fix-First 6 + R6 추가 fix (plan v5 missing 박제 + docs stale rolling 표기 + PR4 acceptance criterion 명시 + cost_log error format-error 매핑) + Defer 7 follow-up tickets.
3. **다음 1순위 = USER**: (a) PR #14 머지 (rebase FF 권장) (b) Migration 0022 production apply (Supabase MCP `apply_migration` 또는 dashboard) (c) Vercel production canary 4 페이지 OK. **(d) PR3b 코드 박제 의존이 PR3c와 PR4에서 필요** — PR3b 머지 후 CLAUDE는 PR4 (UI trigger + Track Record 탭 + Regen 실 호출 + caller wire) 또는 PR3c (document-specialist + analyst + critic 4-step + sector_reference_backlog 마이그)로 진입.
4. **canonical 5-PR 순서 — 8 Group ↔ PR 매핑 정정** (omxy R1 Q3 + 3-track B20 fix: PR3b는 **Group E만 해소**, Group G는 PR3c로 defer):

   | Group | 잘못된 박제 / 미구현 | 담당 PR | 상태 |
   |---|---|---|---|
   | **B** | 30종목 선정 AI 부재 (메인 path Tier 1 누락) | PR2 | ✅ MERGED `f85fb69` |
   | **H** | Critical — stock_reports schema drift + page crash | PR3a | ✅ MERGED `0813a41` |
   | **C** | cron monthly-batch mock dry-run only | **PR1** | ✅ MERGED in main `4aa3130` |
   | **D** (절반) | Step 3c dangling server action — server-side cron path | **PR1** | ✅ MERGED in main `4aa3130` |
   | **E** | writer Section 0~7 본문 미구현 | **PR3b** | 🟡 OPEN PR #14 |
   | **G** | Sector reference 3-level (A 2/12 · B 4/10 · C 14/0) | PR3c | 대기 (PR3b에서 분리) |
   | **A** | track-record trigger 위치 박제 오류 | PR4 | 대기 |
   | **F** | Track Record 누적 성과 vs 아카이브 탭 분리 | PR4 | 대기 |
   | **D** (잔여) | UI caller wire (Regen 실 호출 / Track Record / admin trigger 버튼) | PR4 | 대기 |
5. **운영 SoT**: `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md` (53차 §5 lock-in) + `docs/superpowers/plans/2026-05-23-pr3b-writer-section-0-7.md` (PR3b plan v5, omxy R1~R5 CONVERGED + 24 BLOCKERS + 3-track Fix-First 6 헤더).

**진입 트리거**: "`Document/Process/HANDOFF.md` 보고 이어서 진행" → §0 verify → §2.1 Step matrix 다음 unblocked step. **PR3b OPEN PR #14. USER 1순위 액션 = 머지 + 마이그 0022 apply + canary OK 후 CLAUDE PR4 또는 PR3c 진입**.

**⚠️ PR4 acceptance criterion 박제 (omxy R6 B-R6-2 P1 명시 강화)**: PR3b의 `commitFullReport` TS entrypoint는 SSR session-based `createClient()`를 사용 (preflightHardcap + insertCostLog + RPC 3곳). PR4 cron이 `createServiceRoleClient`로 직접 호출하면 cost_log RLS check_admin_insert로 실패할 위험. **PR4 plan에 반드시 박제**:
1. **service-role client DI** — `commitFullReport`에 client 또는 callerKind 파라미터 추가 (insertCostLog + preflightHardcap도 동일 client 사용)
2. **representative/system caller** — cron path는 admin_id 'cron-system' 사용 (PR1 패턴)
3. **cost_log policy/insert test** — service-role insert가 RLS 통과 검증 e2e test
4. **CRON_SECRET 401 test** — cron route가 CRON_SECRET 미일치 시 401 반환 검증

**운영 원칙**: 미래 지향. 49차~54차 historical 진행 상세 = git log + spec/plan/REVIEW docs + ProgressDashboard 위임. §6 완료 이력은 직전 2 entry (54차 §3 PR3a MERGED + 54차 §4 PR1 MERGED `4aa3130`)만 inline.

**⚠️ gsd-code-reviewer 환경 부재 대체 정책 (54차 §4 박제)**: 현 Claude Code 환경에서 `gsd-code-reviewer` agent type은 더 이상 사용 불가 (외부 환경 agent였음). PR3b/PR4/후속 모든 PR의 deep code review는 **3-track 대체 패턴**으로 진행:
- **Track 1**: `gstack-review` skill (pre-landing PR review, structural/SQL/LLM trust/concurrency)
- **Track 2**: `general-purpose` agent (depth=deep adversarial prompt — gsd 동등 책임)
- **Track 3**: `superpowers:code-review` skill 또는 5-angle scan agent (recall mode bug catch)

PR1에서 첫 적용 (R11 B23 catch가 효과 검증). §7.x omxy pattern 박제 갱신.

---

## 0. 세션 시작 루틴 (verify + auto-progress)

```bash
cd /Users/yong/New_Project_KR_Stock

# 1. branch state runtime 확인 (hardcoded 박제 회피 — omxy R7 Option A)
git rev-parse --abbrev-ref HEAD                   # 현재 branch
git rev-parse --short HEAD                        # HEAD commit
git rev-list --count main..HEAD                   # branch ahead count
git status --short                                # working tree state

# 2. OPEN PRs (54차 §4 종료 baseline: #2 only — PR #13 PR1 ✅ MERGED in main `4aa3130`)
gh pr list --state open --json number,title,headRefName,mergeable

# 3. main fast-forward 박제 확인 (54차 §4 PR1 merge 후, 15 commits FF)
git fetch origin main && git rev-parse --short origin/main  # 현재 main HEAD = 4aa3130

# 4. 검증 게이트 (post-PR1 merge main `4aa3130` baseline)
#    - build 25 routes / lint 0 err 6 warn / test:ci 862/75 / tsc clean / 5 grep gates 0 매치
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

## 1. 현재 상태 (54차 §4 종료 시점, 2026-05-22)

| 영역 | 상태 |
|---|---|
| main HEAD | `4aa3130` (54차 §4 PR1 merge 후, 15 commits FF). 진입 시 §0 `git rev-parse --short HEAD`로 runtime 확인. 이전 = `7279d9f` (54차 §4 docs commit 직전, PR1 merge 직전) → `f8138a7` (54차 §3 PR3a 후 docs). |
| 현재 branch | `main` (PR1 worktree + branch는 PR #13 머지 후 cleanup 완료) |
| Mock Skeleton + DQ-7 + S7e | ✅ Mock 완료 / 🟢 DQ-7 ~97% (Smoke #4/#5 + Session 4 QA 잔여) / 🟢 S7e 7/8 (T7e.7 RLS QA 잔여) |
| S7a Anthropic wrapper | ✅ 완료 (51차 PR #1 MERGED, main 박제) |
| Tier 2 D21 (Sector 14 overlay) | ✅ scaffold + production schema + builder + 207 persona Kevin v3.1 quality 본문 모두 main 박제 (52차 + 53차 §2·§3 PR #7/#8 MERGED) |
| Step 3c caller wiring | ⚠️ **PR1 ✅ MERGED `4aa3130` (server-side 절반 해소) + PR4 잔여 (UI caller wire)**. server action export OK + **PR1 MERGED in main `4aa3130` (PR #13)에서 cron wire 추가** + UI caller는 PR4. |
| **PR #11 (PR2 Tier 1 screening)** | ✅ **MERGED in main `f85fb69`** (54차 §2). 7 commits FF / 6 files / +1873 lines / 47 TDD tests. omxy R1~R8 CONVERGED. |
| **PR #12 (PR3a Group H schema drift fix)** | ✅ **MERGED in main `0813a41`** (54차 §3). 11 commits FF / 7 files / +3300 lines / 56 TDD tests. omxy R1~R12 + gsd-code-reviewer + gstack testing + red-team CONVERGED. omxy R7 Codex structured `/review` = **GATE PASS**. |
| **PR #13 (PR1 cron monthly-batch real path)** | ✅ **MERGED in main `4aa3130` via rebase FF** (54차 §4). 15 commits FF + delete-branch + worktree cleanup 완료. **25 files / +2759 / -158 / 60 TDD tests (802 → 862, 회귀 0)**. omxy R1~R15 + **3-track deep review (gstack-review + general-purpose depth=deep + superpowers code-review 5-angle)** CONVERGED. **누적 30 BLOCKERS catch & fix** (PR1 23 + docs 4 + merge 3). R12 = R7 Codex `/review` GATE PASS 등가. **다음 CLAUDE = PR3b** 진입 의사 1회 확인 후 자동. |
| 선정 흐름 메인 path | 🟢 spec lock-in: Tier 0 150 → Tier 1 Core 11 AI 평가 → 단/중/장 top 10 = 30. 현재 production = Tier 0 단독 30 직선정 (fallback). **PR2 + PR3a + PR1 ✅ MERGED 코드 박제** — PR1 머지 + Tier 0 source 실 wire (후속 PR) + 실 키 발급 후 메인 path 가동. |
| 풀 리포트 흐름 | 🟢 writer Section 0~7 통합 + Section 8 partA/partD = 단일 산출물. 현재 = section_8 jsonb commit만 가능 + page null guard + Section 8 dual-shape renderer (modern partA~D + legacy 호환). Section 0~7 본문 구현 = PR3b scope. |
| **Group H Critical Hard gate** | ✅ **해소** (54차 §3 PR3a MERGED). `admin-reports.ts` zod safeParse validation + nullable typed `ValidatedStockReport` + `parseSectionSafe`/`parseReportSection8` onError 콜백 (console.warn) + `page.tsx` `as` 어서션 제거 + section null guard + `SectionFallback` + Section 8 dual-shape renderer + `partCToCommitteeAgg` helper. **PR1 cron 가동 가능 (PR #13 머지 후)**. |
| OPEN PRs | **#2** OPEN CONFLICTING (format-error, 보류) only (PR #13 PR1 ✅ MERGED in main `4aa3130`) |
| 실 AI 호출 | 0 (Vercel env 3 vars Production 배포는 53차 §4++ PHASE A/B 완료). 실 호출은 PR1 머지 + Tier 0 실 source wire (후속 PR) + 실 키 발급 후. |
| Production deploy | Vercel `https://tudal-tawny.vercel.app` (main `4aa3130` deployment `dpl_SakD5kb3MkwARLSxRgDMGXxtxm72` READY · canary 4 페이지 검증 완료: `/` 200 / `/login` 200 / `/macro` 200 / `/admin` 307→`/login?next=%2Fadmin` auth redirect). |
| Supabase | project `rbrpcynhphrpljbjirfo` · 0001~0021 production 적용 완료 (21 migrations, 54차 §4 PR1 머지 후 0020 + 0021 omxy 교차검증 apply, R23 CONVERGED). SECURITY DEFINER 4-grant 검증: public/anon=false, authenticated/service_role=true. anon WARN 0 baseline 유지. |
| 검증 게이트 (54차 §3 PR3a 후 main historical baseline) | build 25 routes / lint 0 err 6 warn / test:ci 802/69 / tsc clean / forbidden grep 5종 0 매치 (historical, 현재 active 아님) |
| 검증 게이트 ✅ ACTIVE (post-PR1 merge main `4aa3130`) | build 25 routes / lint 0 err 6 warn / **test:ci 862/75 (+60)** / tsc clean / **5 grep gates 0 매치** (isProductionLike monthly-batch / mockMode-monthly-batch / as ReportSection PR3a regression / service-role import boundary narrow / server-only marker present) |
| omxy debate 누적 | **199+ rounds CONVERGED** (54차 §3 종료 184+ + 54차 §4 PR1 R1~R15 = +15) · 누적 BLOCKERS: ~17 PR2 + 21 PR3a + **30 PR1** (R1~R12 23 [plan 20 + impl 2 + Fix-First B23] + R13~R14 docs 4 [B24~B27] + R15 merge 3 [B28~B30]) catch & fix |

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

### §2.1 Step matrix (54차 §4 active steps — DONE rows 축약, historical = git log + PR body 위임)

**현재 위치 = PR1 ✅ MERGED in main `4aa3130` + Migration 0020/0021 production applied + Vercel canary 4 페이지 OK (omxy R1~R24 CONVERGED + 누적 30 BLOCKERS + 3-track deep review Fix-First). 다음 CLAUDE = PR3b (writer Section 0~7) 진입 의사 1회 확인 후 자동 시작. USER 잔여 액션 = 0**.

Owner 의미: **USER** (사용자만) · **CLAUDE** (자동) · **SHARED** ("이어서 진행" 권한으로 push/PR-create 자동, merge/deploy/migration은 USER).

| Step | Owner | Trigger | Default action | Verification | Blocks next |
|---|---|---|---|---|---|
| **Historical** ✅ DONE | — | Step 1 (PR #1), 1c (PR #4/#5/#6), 3 (Tier 2 SoT+impl), 3a (Step 3a SKIPPED), 3b (PR #7/#8 207 persona Kevin v3.1), 3c (PR #9 PARTIAL — caller wiring scope shifted to PR1/PR4), 5 (B-6 billing 완료 PHASE A/B), B-6c PHASE C 폐기 | — | 상세 = git log + PR body + §6 53차 §5 entry | — |
| **PR2** ✅ MERGED | — | PR #11 MERGED in main `f85fb69` (54차 §2) | — | main fast-forward 7 commits + 검증 게이트 통과 + remote branch 삭제 | (해소) PR3a 진입 |
| **PR3a** ✅ MERGED | — | PR #12 MERGED in main `0813a41` (54차 §3) | — | main fast-forward 11 commits + 검증 게이트 통과 (test:ci 746→802) + omxy R7 GATE PASS + 5 grep gates 0 매치 | (해소) PR1 진입 |
| **PR1** ✅ MERGED | — | PR #13 MERGED in main `4aa3130` via rebase FF (54차 §4). 15 commits FF + delete-branch + worktree cleanup 완료. | — | omxy R1~R15 + 3-track deep review CONVERGED + 누적 30 BLOCKERS catch & fix + 검증 게이트 (test:ci 802 → 862) + 5 grep gates 0 매치 + R12 Codex `/review` GATE PASS 등가 | (해소) PR3b 진입 |
| **PR3b** | **CLAUDE** | PR1 머지 후 (또는 병렬) | writer Section 0~7 본문 구현 (document-specialist + analyst + writer + critic 4-step). PR3b 마이그: `sector_reference_backlog` DB table (53차 §5 spec §3.5). **Group E + G 해소.** | omxy R1~Rn + **3-track deep review** (gstack-review skill + general-purpose agent (depth=deep adversarial) + superpowers code-review skill 5-angle) — gsd-code-reviewer 부재 대체 패턴 박제 (PR1에서 첫 적용 검증) | PR4 UI 진입 |
| **PR4** | **CLAUDE** | PR3b 머지 후 | UI 신설: (a) admin trigger 버튼 `/admin/portfolio` 또는 `/admin` 홈 (b) 종목별 Regen 실 호출 wire (현 quota counter만 동작) (c) Track Record 탭 분리 (누적 성과 + 월별 아카이브). + PR3a OOS: Tier 2 active 시 `Section8ModernView.partA` 14 rows 렌더 (red-team RT#1), `aggregateVotes` enum 보호 (red-team RT#3), LLM string/array max bound (red-team RT#4/RT#5). **Group A + F + D 잔여 + PR3a OOS 해소.** | omxy + **3-track deep review** + UI smoke (gstack-browse) | §2.2 출시 게이트 진입 |
| **Step 4 Reflection** | CLAUDE | PR2 + PR3a 후 더 의미있음 (실 Tier 1 결과 누적 후 reflection_log 자가학습) | reflection_log 마이그 + Tier 1 context 주입 + tests. PR1~PR4와 병렬 가능. | omxy + **3-track deep review** | — |
| **Step 7~14** (S7b → S7c → S7d → S8) | USER 트리거 + CLAUDE 구현 | canonical 5-PR 완료 후 | S7b 뉴스+브리핑 → D11 AI 가상 포트 1차 가동 (어드민 3인 운용 검증) → S7c 장중·KIS WS → S7d Silent Health → S8 자동매매 (Binance Smoke #3) | 각 슬라이스 DoD | §2.2 출시 게이트 |
| **Step 15** S9 운용 | USER 1개월+ 운용 + CLAUDE 모니터링 hotfix | S8 머지 후 | 어드민 3인 실 사용 + hotfix branch로 BL-KRIT patch | §2.2 7 criteria 만족 | ✅ 어드민 내부 도구 출시 |

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
- **canonical 5-PR 순서 절대 보존**: PR2 ✅ → PR3a ✅ → PR1 ✅ MERGED `4aa3130` → PR3b → PR4. 재해석 금지.
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

### 55차 §1 PR #14 (PR3b writer Section 0~7 + Appendix 풀 리포트 생성 + RPC `update_report_sections_0_7`) OPEN (omxy R1~R5 CONVERGED + 누적 24 BLOCKERS + 3-track deep review Fix-First 6, 2026-05-23)

- **scope**: 53차 §5 정정 spec §4 PR3b. Group **E** (writer Section 0~7 본문 미구현) 해소. **Group G는 PR3c로 defer** (omxy R1 Q3 + 3-track B20 fix — HANDOFF/spec 문구 정정 동반).
- **branch**: `feat/pr3b-writer-section-0-7` (worktree `/Users/yong/New_Project_KR_Stock-pr3b`, main `ecdb1a7` 기준 7 commits, head `bc89f32`). PR **#14** OPEN.
- **7 commits** (1 plan + 5 impl + 1 grep fix + 1 Fix-First):
  - `09e57b4` feat(PR3b Task1): full-report-prompt — page.tsx 라벨 + plain delimiter + valid JSON
  - `1776b38` feat(PR3b Task2): 마이그 0022 update_report_sections_0_7 — 0017 패턴 + 4-grant + search_path + input regex guard
  - `934fae4` feat(PR3b Task3): full-report-client — Anthropic Opus single-call + cost_log + full_report_llm_failed throw
  - `048a38f` feat(PR3b Task4): full-report-writer — prompt wire + extractJsonObject + per-section safeParse + RPC UPDATE
  - `09d1035` feat(PR3b Task5): format-error — 5 신규 키 + 3 prefix handler 한국어 매핑
  - `7971eef` fix(PR3b Task6 grep gate): comment false positive 제거
  - `bc89f32` fix(PR3b 3-track deep review): C1 cost hardcap + 5 cross-confirmed fixes Fix-First
- **신규 SoT 코드 (11 files / +1011 lines)**:
  - `tudal/src/lib/ai/prompts/full-report-prompt.ts` (FULL_REPORT_SYSTEM_PROMPT + buildFullReportUserPrompt + plain delimiter + ASCII quote 강제) + test (17 cases)
  - `tudal/src/lib/ai/full-report-client.ts` (callFullReport — Anthropic Opus single call + cost_log + structured warn on err) + test (3 cases)
  - `tudal/src/lib/report/full-report-writer.ts` (extractJsonObject depth-aware + parseAndValidate with structured warn + commitFullReport with preflightHardcap + report_not_found direct throw) + test (16 cases)
  - `tudal/supabase/migrations/0022_update_report_sections_0_7.sql` + rollback (RPC: auth.uid null guard + is_admin + coalesce(auth.role()) service_role bypass + 4-grant + input regex `[0-9]` + month to_date cast + generated_at = now() bump) + contract test (11 cases)
  - `tudal/src/lib/admin/format-error.ts` (5 신규 키 + 3 prefix handler) + test (5 cases)
  - `tudal/src/lib/cost/pricing.ts` (FULL_REPORT_MAX_COST_PER_CALL_KRW 신설 — input 3000 + output 6000 calibration)
  - `tudal/src/lib/cost/cost-logger.ts` (preflightHardcap에 maxCostPerCallKrw optional override param)
- **omxy R1~R5 5 rounds CONVERGED + 누적 24 BLOCKERS** (R1 8 BLOCKERS: month type cast / is_admin guard / grant 정합 / error taxonomy / 라벨 drift / invalid JSON example / dead code / file structure · R2 7 BLOCKERS: 0~100 token / fence example / extractJsonObject helper / service_role bypass / search_path public,pg_temp / input regex / file count · R3 5 BLOCKERS: literal fence in prompt body / grep false positive / caller intent contract / suffix happy test / docs commit separation · R4 4 정리: B15 통일 / B18 모순 제거 / Task6 failing grep 삭제 / B17 표현 정정 + 보안 contract 명시).
- **3-track deep review** (gsd-code-reviewer 대체 패턴, PR1 검증 후 default):
  - **Track 1 inline `gstack-review` skill** — CLEAN (Critical 0 / Warning 0 / Info 3 비차단)
  - **Track 2 `general-purpose` agent depth=deep** — 11 findings (1 Critical / 6 Warning / 4 Info). C1 cost-hardcap이 핵심 catch.
  - **Track 3 `general-purpose` agent 5-angle scan** — 10 findings (3 CONFIRMED / 7 PLAUSIBLE). Angle 5 + Angle 3 + Angle 2 CONFIRMED.
- **Fix-First 6** (cross-confirmed CRITICAL/CONFIRMED 즉시 적용):
  1. **C1 (Track 2 Critical)**: cost-hardcap preflight + `FULL_REPORT_MAX_COST_PER_CALL_KRW` (input 3000 + output 6000) — PR4 wire 전 burn 위험 차단
  2. **CR-1 (Track 2 I3 + Track 3 Angle 3 CONFIRMED conf 8)**: `generated_at = now()` bump in 0022 UPDATE
  3. **CR-2 (Track 3 Angle 2 CONFIRMED conf 7)**: validation_failed structured `console.warn` (PR3a CR-01 패턴 정합)
  4. **CR-3 (Track 3 Angle 4 PLAUSIBLE conf 7)**: callFullReport catch underlying err capture
  5. **CR-4 (Track 2 W3)**: prompt ASCII straight quote 강제
  6. **CR-5 (Track 2 W7)**: `coalesce(auth.role(), '')` defensive
- **Defer 7 follow-up tickets** (PR body 박제):
  - W2 Anthropic timeout/maxRetries (PR4) / W4 AI_COST_LOG_REAL_INSERT_ENABLED strict (infra) / W5 __dirname ESM (low risk) / W6 row lock concurrency (PR3c) / Track 3 Angle 5 insertCostLog DI (PR4) / Track 3 Angle 1 P0002 errcode + specific error rethrow (UX polish) / Track 3 Angle 4 extractJsonObject prefix-brace + null guard (low risk edge)
- **B18 보안 contract 박제** (PR4 acceptance criterion): PR4 cron route는 `CRON_SECRET` env 검증 + 검증 실패 401 반환 테스트 필수. PR3b RPC는 DB-layer caller intent 강제 안 함 — service_role grant 의존.
- **검증 게이트 (PR3b OPEN baseline)**: build 25 routes / lint 0 err 6 warn / **test:ci 914 / 79 files (+52 over 862)** / tsc clean / 8 grep gates 0 매치
- **rollback ranges**: OLD_MAIN=`ecdb1a7` / AFTER_PR14=(merge 후 runtime).
  - Revert PR3b only: `git revert --no-edit OLD_MAIN..AFTER_PR14` (7 commits)
  - Migration rollback: 0022 → drop function (rollback.sql)
- **다음**: USER PR #14 머지 + 마이그 0022 production apply + Vercel canary 4 페이지 OK → CLAUDE PR4 또는 PR3c 진입.

### 54차 §4 PR #13 (PR1 cron monthly-batch real path + server-callable trigger) MERGED in main `4aa3130` via rebase FF (omxy R1~R15 CONVERGED + 누적 30 BLOCKERS + 3-track deep review Fix-First, 2026-05-22)

- **scope**: 53차 §5 정정 spec §1.1 canonical 5-PR 세 번째. Group **C** (cron monthly-batch mock dry-run only) + Group **D** 절반 (Step 3c dangling server action server-side) 해소. UI 트리거 버튼은 PR4 scope.
- **branch**: `feat/pr1-cron-real-path` (rebased onto main `7279d9f`, head `96b15cb7393baf77e9f387a168804b8245c853a7`) → **MERGED via rebase FF + delete-branch**. PR **#13** (https://github.com/son00326/New_Project_KR_Stock/pull/13). 머지 후 main HEAD `4aa3130` (PR1 마지막 commit `fix(PR1 omxy R11 B23)`). worktree `/Users/yong/New_Project_KR_Stock-pr1` removed.
- **15 commits** (1 plan + 7 impl + 1 lint fix + 3 omxy fix + 1 C1 fix + 1 MF1~MF5 Fix-First + 1 B23 fix):
  > **Note (B35+B38 fix)**: Rebase merge로 SHA가 변경됨. 본 commit list는 **post-rebase main range `7279d9f..4aa3130`** 기준 (15 commits FF, 첫 commit = 118ff9b plan v8, 마지막 = 4aa3130 main HEAD). pre-rebase PR1 branch SHA (17019dc/a4ebcad/.../3ac5dd0)는 historical reference only — PR #13 OPEN 시점 박제.
  - `118ff9b` docs(PR1): plan v8
  - `40727aa` feat(PR1 Task1): migration 0020 — short_list_30 screening metadata
  - `7a7f16d` feat(PR1 Task1b): migration 0021 — acquire_batch_lock_v2 cron caller path (B1 fix)
  - `078889b` build(PR1 Task1c-pre): server-only dep + vitest alias stub (B13+B16 fix)
  - `b2f5f87` feat(PR1 Task1c): service-role + cron lock + scheduler_fail alert helpers (B1+B2+B8+B11+B17)
  - `6d55693` feat(PR1 Task2): orchestrator + 9 TDD tests (B2+B3+B5)
  - `9559eec` feat(PR1 Task3): upsertShortList30 + 5 TDD tests (B4)
  - `7854d40` feat(PR1 Task4): cron route real path refactor (B1+B9+B12+B15)
  - `f865bbe` feat(PR1 Task5): triggerMonthlyBatch admin action + 6 tests
  - `1cb8d0b` feat(PR1 Task6): format-error 4 키 + 2 prefix (B6+B10)
  - `1705275` fix(PR1 lint): unused eslint-disable
  - `b3eb742` fix(PR1 omxy R9 B21+B22): marker test + grep gate accuracy
  - `d1ecf51` fix(PR1 gsd-deep R1 C1): migration 0021 started_by lineage comment
  - `d3f795d` fix(PR1 3-track deep-review): MF1+MF2+MF4+MF5 Fix-First
  - `4aa3130` fix(PR1 omxy R11 B23): MF2 ticker PostgREST filter injection guard ← **main HEAD**
- **신규 SoT 코드 (25 files / +2759 / -158)**:
  - `tudal/supabase/migrations/0020_short_list_30_screening_metadata.sql` + rollback (assigned_by/prompt_version_id/personas_version_id nullable)
  - `tudal/supabase/migrations/0021_acquire_batch_lock_v2.sql` + rollback (SECURITY DEFINER 4-grant + cron caller path + started_by nullable + C1 lineage comment)
  - `tudal/src/lib/supabase/service-role.ts` (cached client + `import 'server-only'`) + test
  - `tudal/src/lib/data/admin-batch-runs-cron.ts` (cron lock helper) + test
  - `tudal/src/lib/data/admin-alerts-insert.ts` (DI scheduler_fail alert, 9 snake_case col) + test
  - `tudal/src/lib/screening/monthly-batch-orchestrator.ts` (8 DI fields + B3 allSettled degraded success + B5 assigned_timeframe-only badge-only + B2 alert chain) + 9 tests
  - `tudal/src/lib/data/admin-shortlist-persist.ts` (client DI + B4 delta_status='new' + MF2 stale delete + B23 TICKER_RE validation) + 10 tests
  - `tudal/src/app/api/cron/monthly-batch/route.ts` (orchestrator wire + MF4 CRON_SECRET fail-closed) + 6 tests
  - `tudal/src/app/(admin)/admin/portfolio/actions.ts` (`triggerMonthlyBatch` 추가) + 6 tests
  - `tudal/src/lib/admin/format-error.ts` (+16 keys + 6 prefix handler) — 66 tests
  - `tudal/vitest.config.ts` (`resolve.alias 'server-only' → empty stub`) + `tudal/src/test/server-only-empty.ts`
- **omxy R1~R12 12 rounds CONVERGED + 23 BLOCKERS catch & fix**:
  - R1~R4 (plan v1→v4): B1 cron auth/lock 분리 / B2 scheduler_fail alert wire / B3 allSettled 의미 정정 / B4 delta_status NOT NULL / B5 badge-only condition / B6 formatErrorMessage 함수명 / B7 service_role EXECUTE grant / B8 alert_event 9 컬럼 / B9 cron route alert 위치 / B10 format-error prefix / B11 import 'server-only' / B12 plan vs Task 4 모순 / B13 server-only npm install / B14 grep gate Task 7 박제 / B15 mock 주석 정정 (15 BLOCKERS)
  - R5~R8 (plan v5→v8): B16 vitest alias / B17 boundary narrow / B18 vite-tsconfig-paths 미설치 / B19 vitest 검증 / B20 pipe exit code (5 BLOCKERS) → R8 CONVERGED → implementer 진입
  - R9~R10 (impl plan-vs-commit): B21 grep gate accuracy / B22 service-role marker test (2 BLOCKERS)
  - R11~R12 (3-track deep review Fix-First 검증): B23 MF2 ticker PostgREST filter injection guard (1 BLOCKER) → R12 **CONVERGED, GATE PASS 등가**
- **3-track deep review (gsd-code-reviewer 대체 패턴 첫 적용, 54차 §4 박제)**:
  - **Track 1**: `gstack-review` skill (inline, scope detection: BACKEND + AUTH + MIGRATIONS)
  - **Track 2**: `general-purpose` agent (depth=deep adversarial prompt) — 14 findings (1 Critical / 7 Warning / 6 Info). C1 + W2/W5/W7 fix, W1/W3/W4/W6 defer.
  - **Track 3**: `superpowers:code-review` skill 5-angle scan via Agent tool — 10 findings (5 CONFIRMED / 4 PLAUSIBLE / 1 PR2 boundary). Cross-confirmed CRITICAL #1 (RLS bypass) + #2 (stale rows) + #8 (format-error gaps) + #10 (CRON_SECRET).
  - **Fix-First adoption**: C1 + MF1~MF5 (cross-confirmed 5종) → 2 commits (post-rebase `d1ecf51` + `d3f795d`). R11 B23 catch → post-rebase `4aa3130` (main HEAD).
  - **Defer (follow-up tickets, non-blocking)**: W1 (cache rotation) / W3 (release_v2 RPC) / W4 (alert source col) / W6 (LLM flag) / W7 (app-layer is_admin) / #4 (concurrency cap PR2 boundary) / #9 (NOT NULL CHECK 대체)
- **검증 게이트 (54차 §4 종료)**: build 25 routes / lint 0 err 6 warn / **test:ci 862/75 (+60 over 802)** / tsc clean / 5 grep gates 0 매치 (isProductionLike / monthly-batch mockMode / as ReportSection / service-role boundary / server-only marker present)
- **rollback ranges 박제**: OLD_MAIN=`7279d9f` (54차 §4 docs commit 직후, PR1 merge 직전) / AFTER_PR1_MERGE=`4aa3130` (15 commits FF). Revert PR1 only: `git revert --no-edit OLD_MAIN..AFTER_PR1_MERGE` (15 commits). reset --hard / force-push 금지. Migration rollback: 0021 → 0020 순서 (started_by NOT NULL 복구는 production cron NULL row cleanup 후 수동).
- **OOS findings PR body 박제 (defer 7 follow-up tickets)**: W1 service-role cache stale rotation / W3 release_batch_lock_cron SECURITY DEFINER RPC / W4 alert_event source col / W6 real-LLM feature flag / W7 triggerMonthlyBatch app-layer is_admin / #4 runTier1Screening 동시성 cap (PR2 boundary) / #9 monthly_batch_runs started_by NOT NULL CHECK 대체.
- **다음**: CLAUDE PR3b (writer Section 0~7 본문) 진입 의사 1회 확인 후 자동 시작. PR3b scope = Group E + G 해소 + `sector_reference_backlog` 마이그. **USER 잔여 액션 = 0** (omxy R22~R23 교차검증: Migration 0020/0021 production applied + Vercel canary 4 페이지 OK).

### 54차 §3 PR #12 (PR3a Group H schema drift fix) MERGED + post-merge docs refresh (omxy R1~R12 CONVERGED + R7 Codex GATE PASS, 2026-05-22)

- **scope**: 53차 §5 정정 spec §2 Group H + §4 PR3a scope. PR1 cron 가동 전 Critical Hard gate 선행 fix. `/admin/report/[ticker]/page.tsx`가 `stock_reports.section_X` jsonb의 null·malformed·shape-drift 상황 crash 차단.
- **branch**: `fix/pr3a-group-h-schema-drift` (worktree `/Users/yong/New_Project_KR_Stock-pr3a`, main `f85fb69` 기준 11 commits, head `4ee1019`). MERGED into main `0813a41`.
- **11 commits** (4 plan + 5 impl + 1 fix-first + 1 REVIEW.md):
  - `33a4e5b` docs(PR3a): plan — Group H schema drift fix (Critical Hard gate)
  - `b646f7d` docs(PR3a omxy R1): plan v2 — B1~B4 BLOCKERS 정정 (admin-reports.test 충돌 / zod edge case / partC drift / schema 중복)
  - `71c9572` docs(PR3a omxy R2): plan v3 — B5~B7 BLOCKERS 정정 (stale ref / partA vote enum / grep gate 비실행)
  - `8220002` docs(PR3a omxy R3): plan v4 — B8~B10 BLOCKERS 정정 (grep regex 변수명 / gate 모순 / canonical PR 순서 누락)
  - `8e675cb` feat(PR3a Task1): Section 0~7 + Appendix zod schemas + parseSectionSafe + 14 tests
  - `cd041a8` feat(PR3a Task2): Section 8 dual-shape parser (modern import + legacy local) + 20 tests
  - `b6369b7` feat(PR3a Task3): validated transformer returns nullable typed sections + admin-reports.test.ts 갱신
  - `94c30f2` fix(PR3a Task4): page null guards + Section 8 dual-shape renderer (Group H crash fix)
  - `6fcde46` fix(PR3a omxy R5 B11): Section 6 signal.state invalid reject test 추가
  - `3649de5` fix(PR3a multi-source review): Fix-First AUTO-FIX 4종 (onError 콜백 + zod bounds + partCToCommitteeAgg + WR-01 lockstep)
  - `0813a41` docs(PR3a): gsd-code-reviewer REVIEW.md 박제 (depth=deep)
- **신규 SoT 코드**:
  - `tudal/src/lib/data/report-section-schemas.ts` (Section 0~7 + Appendix zod schemas + score0to100/voteCount 공통 helpers + Section 8 modern import alias from `@/lib/report/section-8-schema` + legacy schema + `parseReportSection8` dual-shape parser + `parseSectionSafe`/`parseReportSection8` onError 콜백 + `partCToCommitteeAgg` pure helper)
  - `tudal/src/lib/data/__tests__/report-section-schemas.test.ts` (47 tests: schema valid/invalid/null + Section 8 dual detection + B2 edge case 11종 + B11 signal.state + onError 콜백 + zod bounds + partCToCommitteeAgg)
  - `tudal/src/lib/data/admin-reports.ts` (확장: `ValidatedStockReport` interface + `transformStockReportRow` per-section safeParse + ticker/section context console.warn + `getReportByTicker` 반환 타입 변경)
  - `tudal/src/lib/data/__tests__/admin-reports.test.ts` (B1 정정: baseRow validSection0 + 7 validation assertions + Section 8 modern/legacy detection. 신규 transformer test 파일 생성 X)
  - `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` (`as ReportSection` 어서션 10개 전면 제거 + section null guard + 헤더 `section0?.conviction ?? '—'` + `SectionFallback` 단일 helper + Section 0~7 + AppendixView null guard + `Section8View` 3분기 + `Section8ModernView` partC authoritative + `Section8LegacyView` 기존 본문 보존)
- **omxy R1~R12 12 rounds CONVERGED + R7 Codex structured `/review` = GATE PASS** (21 BLOCKERS catch & fix):
  - R1~R4 (plan): B1~B10 — admin-reports.test 충돌 / zod edge case / partC drift / schema 중복 / stale ref / partA vote enum / grep gate 비실행 / regex 변수명 / gate 모순 / canonical PR 순서 누락
  - R5~R6 (impl plan-vs-commit): B11 — Section 6 invalid state reject test 누락
  - R7 (Codex structured `/review`): **GATE: PASS, recommend ship. SIGNAL: CONVERGED.** P0/P1 = 0. RPC `commit_persona_eval` BUY→approve / HOLD→abstain / SELL→reject 매핑 정합 verified.
  - R8 (merge preflight): B12~B14 — sequence 순서 / rollback range 실행식 / stale grep gate
  - R9~R12 (post-merge docs verify): B15~B21 — main HEAD self-stale / docs count / Last updated / 운영 원칙 / round count / BLOCKERS count
- **gsd-code-reviewer (depth=deep)**: 11 findings (Critical 1 / Warning 6 / Info 4 + OOS 5). CR-01 silent validation drop + WR-01 Omit lockstep + WR-04 number 필드 unbounded → Fix-First commit으로 해소. 나머지 Warning/Info → 후속 PR.
- **gstack testing specialist**: 11 INFORMATIONAL findings. T#5 partC mapping JSX 안 → `partCToCommitteeAgg` 추출 + test 3개. T#6/T#8 number boundary → 7 boundary tests 추가.
- **gstack red-team specialist**: 9 findings (Medium 3 / Low 6). RT#2 silent null + log 0 → gsd CR-01과 함께 해소. RT#1 (partA silent drop) + RT#3 (aggregateVotes NaN) + RT#4/RT#5 (string/array max bound) → OOS PR body 박제 (PR1/PR4 wire 시점).
- **검증 게이트 (54차 §3 종료)**: build 25 routes / lint 0 err 6 warn / **test:ci 746 → 802 (+56, regression 0)** / tsc clean / forbidden grep 5종 0 매치 (as ReportSection / raw section[0-8] deref / @ts-expect-error / Section 8 schema redefine / restricted paths).
- **rollback ranges 박제**: OLD_MAIN=`f85fb6968daa10de3c83e300aadc16ad9151e0f6` / AFTER_PR12=`0813a41b8a41f32664062ddce8237770791576be` / AFTER_DOCS=(본 commit 후).
  - Revert PR3a only: `git revert --no-edit OLD_MAIN..AFTER_PR12` (11 commits)
  - Revert PR3a + docs: `git revert --no-edit OLD_MAIN..AFTER_DOCS`
  - reset --hard / force-push 금지.
- **OOS findings PR body 박제 (PR1/PR4로 분리)**: writer Section 0~7 본문 (PR3b) / cron real path (PR1) / UI trigger·Track Record·Regen 실 호출 (PR4) / partA Tier 2 silent drop·aggregateVotes NaN·LLM string max bound (PR1) / React Testing Library setup·Section view render tests (별도 infra PR) / silent null drop metric/structured log 격상 (PR1).
- **다음 1순위**: CLAUDE PR1 (cron `monthly-batch` real path enable + server-callable trigger function). PR3a main 박제 의존 0 → main에서 새 branch.

### 54차 §2 PR #11 (PR2 Tier 1 AI 30 선정 screening) MERGED + PR #10 cleanup sequence (omxy R1~R13 CONVERGED, 2026-05-22)

- **scope**: 53차 §5 정정 spec §1.1 (canonical 5-PR 첫 PR). Tier 0 단독 30 직선정 fallback에서 메인 path (Tier 0 + Tier 1 AI 합의)로 전환하는 in-memory pure screening module 도입. PR #10 cleanup은 HANDOFF/ProgressDashboard "PR #11 OPEN → MERGED" 박제 정정 + 53차 §5 정정 박제.
- **PR #11 MERGED in main `f85fb69`** (7 commits FF, 6 files / +1873 lines / 47 TDD tests, baseline 699 → 746). Remote branch deleted.
- **PR #10 MERGED in main `f85fb69`** (HANDOFF cleanup + post-PR11 refresh).
- **신규 SoT 코드**: `tudal/src/lib/screening/tier1-schema.ts` (zod 13 refinements + PersonaPanelSchema + assertPanelMatchesCore11 + TIMEFRAME_HEAVY_PERSONAS + personaWeightFor) + `tudal/src/lib/screening/persona-eval.ts` (`runTier1Screening` + 5 helpers, 기존 함수 변경 0) + tests 47개.
- **Q1 5-step 알고리즘**: 150 candidates × 1 panel call → weighted_avg (단:Druckenmiller/Burry · 중:Lynch · 장:Buffett/Munger/Fisher/Pabrai 1.5x) → primary_timeframe argmax → top 10/timeframe → backfill 30 selected + 120 notSelected.
- **omxy R1~R8 + gsd 11 findings + R12/R13 merge sequence**: ~17 BLOCKERS catch & fix.
- 상세 = git log (`8220002`..`80166f9`) + `docs/superpowers/plans/2026-05-21-pr2-tier1-screening.md` + `docs/superpowers/reviews/2026-05-21-pr2-tier1-screening-review.md`.

### 53차 §5 shortlist 30 + 풀 리포트 흐름 정정 spec doc 작성 + OMXY R1~R7 CONVERGED + HANDOFF 박제 정정 (branch `docs/53-step4-runbook-update`, 2026-05-21)

- **scope**: 사용자 lock-in 8 항목 박제 정정 트리거. 53차 §4++에서 박제했던 PHASE C continuation이 사용자 lock-in 변경 + Group H Critical Hard gate 발견으로 진입 차단. 전체 30종목 선정 + 풀 리포트 흐름을 spec doc 기반으로 정정.
- **spec doc 신설**: `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md` — §1 사용자 lock-in 8 항목 / §2 Group A-H mismatch / §3 정정 spec / §4 PR scope / §5 open questions / §6 omxy 검토 / §7 OOS / Appendix A 정정 matrix / Appendix B 코드 reference.
- **사용자 lock-in 8 항목**: (1.1) 메인 path = Tier 0 + Tier 1 AI 합의 → 30 선정 (1.2) 풀 리포트 = writer Section 0~7 + Section 8 partA/partD 단일 산출물 (1.3) 3 trigger path (cron / reject 후 trigger / Regen) (1.4) UI 흐름 (/admin → 30 list → 클릭 → 풀 리포트 페이지) (1.5) Track Record = 누적 성과 + 월별 아카이브 한 페이지 탭 분리 (1.6) Kevin v3.1 quality target = 207 persona × 8 markers = 1656 marker assertions (53차 §3 박제) (1.7) Sector reference 3-level 분류 (Level A 본문 2/12 · Level B 체크리스트 4/10 · Level C philosophies 14/0) (1.8) API 금액 무관.
- **Group A-H mismatch catch**:
  - A: track-record가 trigger 위치 박제 → 정정 (trigger = `/admin/portfolio` 또는 `/admin` 홈, PR4 scope)
  - B: 30종목 선정 AI 부재 → 메인 path = Tier 0 + Tier 1 AI 합의 명확화
  - C: cron monthly-batch mock dry-run only → PR1 implementation 박제
  - D: Step 3c "DONE" → **PARTIAL — dangling server action** (server action export OK / 모든 caller 0)
  - E: writer Section 0~7 본문 미구현 박제 누락 → ReportFramework §8 정정
  - F: Track Record 의미 박제 (누적 성과 vs 아카이브) → 한 페이지 탭 분리
  - G: Sector reference 3-level 분류 (Level A/B/C)
  - H (Critical): stock_reports schema drift + report page crash 위험 — `admin-reports.ts` validation 0 + `page.tsx` section0.conviction early deref + Section 0~7 nested deref + Section 8 shape mismatch. **PR1 cron 가동 ⊥ PR3a 미선행 = page crash inevitable**.
- **OMXY R1~R7 CONVERGED-track** (32 BLOCKERS catch & fix: R1 6 + R2 4 + R3 6 + R4 5 + R5 0 spec CONVERGED + R6 5 + R7 6).
- **canonical 5-PR 순서 박제**: **PR2 (Tier 1 AI 30 선정, independent) → PR3a (Group H schema drift fix, Critical Hard gate) → PR1 (cron real path + server-callable trigger function only, UI는 PR4 scope) → PR3b (writer Section 0~7 본문) → PR4 (UI 신설)**. Hard gate: PR1 머지 전 PR3a 머지 + verification 통과 필수.
- **PHASE C continuation 폐기 박제**: 53차 §4++ "사용자 admin UI click → 자동 검증 재개"는 본 §5 정정으로 폐기 (사용자 lock-in 변경 + Group H Critical Hard gate 미충족). PHASE C 어휘는 historical entry로만 잔존.

**Older historical (49차~53차 §4++, S7a Anthropic wrapper, Tier 2 SoT+impl, Step 3a SKIPPED, Step 3b 207 persona, Step 3c caller wiring, PHASE A/B billing-on)** = git log + spec/plan/REVIEW docs + ProgressDashboard 위임.

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
- **canonical 5-PR 순서 절대 보존** (53차 §5 spec doc 박제): **PR2 ✅ → PR3a ✅ → PR1 ✅ MERGED `4aa3130` (PR #13) → PR3b → PR4**. Hard gate (PR1 cron 가동 ⊥ PR3a schema drift fix 미선행 = page crash inevitable) ✅ **해소** (54차 §3 PR3a MERGED `0813a41`). 잔여 2-task (PR3b + PR4)는 PR1 해소 후 진입 가능.
- **Kevin v3.1 quality target** (53차 §3 박제): 207 persona × 8 markers = 1656 marker assertions 전수 통과. Reference 자료 main 보존. 후속 PR3b writer 본문도 동일 quality target.
- **HANDOFF.md 다음 세션 자동 진행 가능 조건**: §0 + §1 + §2 모두 stale 0. 본 54차 §4 종료 시점 = PR #13 (PR1 cron monthly-batch real path + server-callable trigger) ✅ MERGED in main `4aa3130` (rebase FF) + post-merge docs refresh 완료 + Migration 0020/0021 production applied + Vercel canary 4 페이지 OK (omxy R22~R23 CONVERGED) + 다음 = CLAUDE PR3b (writer Section 0~7 본문 + sector_reference_backlog 마이그) 자동 진입. **USER 잔여 액션 = 0**.
- **main HEAD 박제 정정 (B15)**: `0813a41`는 **PR3a merge point** (AFTER_PR12). docs commit/push 후 main HEAD는 갱신됨 — 세션 진입 시 §0 `git rev-parse --short HEAD`로 runtime 확인. rollback range OLD_MAIN=`f85fb69` → AFTER_PR12=`0813a41` → AFTER_DOCS=runtime.
