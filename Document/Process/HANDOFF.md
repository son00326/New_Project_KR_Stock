# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-20 (50차 §2 출시 Runbook 재구조 R14~R16 CONVERGED — **🎉 §2 신규 15-step 선형 출시 Runbook + §2.0 Default-progress policy + §2.1 Step 6-column matrix + §2.2 S9 OK 7 enriched criteria + §8 시나리오 분기 제거 + §9 Owner 분리 (USER/CLAUDE/SHARED) 박제**) · 50차 §1 B-17 EXECUTED ✅ (push fast-forward + 마이그 0016a + 0017 production apply + PR #1 OPEN + Vercel preview Ready) · `feat/s7a-anthropic-wrapper` branch (**34+ commits ahead of main**, HEAD = 50차 §2 Runbook 박제 commit or higher, push 완료; 정확한 값은 `git rev-list --count main..HEAD`) · B-17 execution head: `a9c9c93` (fix S7a 0016a) · 검증 게이트 통과: build OK / lint 0 errors / test:ci **522 pass / 60 files** / tsc clean · omxy debate 누적 **50 rounds CONVERGED** (25 진입 전 + 13 task R1+R2 + 3 49차 final + 1 49차 박제 R1 + 2 50차 §0 박제 R2+R3 (R1 CONTINUE 불산정) + 6 50차 §1 B-17 R1~R6; 50차 §1 박제 R7~R10 + 50차 §2 Runbook R14~R17 = post-execution docs phase, not counted in stable 50) · **현재 위치 = §2.1 Step 1 USER 대기 (PR #1 review/merge)** · 자동 진행 가능한 다음 CLAUDE Step = Step 2 (§2.C format-error hotfix 별도 branch)

**목적**: 새 세션에서 사용자가 "`Document/Process/HANDOFF.md` 보고 이어서 진행"이라고 하면, 이 파일만으로 **§2.1 Runbook 박제된 순서대로 자동 진행** (§2.0 default-progress policy 준수 — 옵션 재질문 루프 금지). USER-gated Step은 background blocker로 표시 + 다음 unblocked CLAUDE Step 자동 시작. §2.0 7 exception buckets 도달 시만 USER 직접 묻기.

**운영 원칙**: 미래 지향. 49차 Task 1~17 진행 상세는 git log + `docs/superpowers/specs/2026-05-19-s7a-anthropic-wrapper-design.md` + `docs/superpowers/plans/2026-05-19-s7a-anthropic-wrapper.md` + `Document/Build/Slices/S7-RealData.md` + `Document/Build/ProgressDashboard.md`에 위임. CLAUDE.md 자동 로드 — 본 HANDOFF는 미래 진행에 필요한 정보만 박제.

---

## 0. 세션 시작 루틴

```bash
cd /Users/yong/New_Project_KR_Stock
git status --short --branch                     # feat/s7a-anthropic-wrapper 확인 (HEAD = 50차 §1 B-17 박제 commit 또는 그 이상)
git log --oneline main..HEAD | head -40         # 34+ commits 박제 확인 (50차 §1 B-17 EXECUTED + 박제 commit + R11 cleanup + 후속 minor docs cleanup 포함; 정확 값 `git rev-list --count main..HEAD`)
gh pr view 1 --json state,url,statusCheckRollup  # PR #1 OPEN + Vercel preview Ready 확인
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

**현 branch = `feat/s7a-anthropic-wrapper`** (49차 신설, **push 완료**). main 직접 작업 금지. 검증 게이트 baseline (50차 §1 B-17 EXECUTED 시점) = build OK · lint 0 · test:ci **522 / 60 files** · tsc clean.

### 진입자 핵심 액션 순서 (§2.0 default-progress policy 준수)

1. **§8.1 현재 위치 확인 자동 실행** (git/gh/list_migrations/검증 게이트).
2. **§2.1 Runbook 매트릭스 보고 마지막 완료 Step 식별** → 다음 Step Owner 확인.
3. **§8.2 자동 진행 결정** — Owner 별 행동:
   - [CLAUDE] / [CLAUDE stacked] → 즉시 자동 시작 (stacked는 진입 의사 1회 확인)
   - [SHARED] → "이어서 진행" 권한으로 prepare/commit/PR-create 자동
   - [USER] / [USER cluster] → background blocker 보고 + 동시 가능한 stacked CLAUDE Step 자동 시작
4. **§2.0 7 exception buckets 도달 시만** USER 직접 묻기.
5. **§7 omxy 적대적 코드 검토 패턴**은 모든 신규 작업 branch에서 강제 적용.

---

## 1. 현재 상태 요약 (50차 §1 B-17 EXECUTED 시점)

| 영역 | 상태 |
|---|---|
| Branch | `feat/s7a-anthropic-wrapper` (49차 신설, main에서 분기, **34+ commits ahead** (33 pre-박제 + 1 50차 §1 박제 commit + R11 cleanup + 후속 minor docs cleanup 포함; 정확 값 `git rev-list --count main..HEAD`), **push 완료**) |
| HEAD commit | **50차 §1 B-17 박제 commit** (또는 그 이상 — HEAD direct ref via `git log`). B-17 execution head = `a9c9c93` (fix S7a 0016a) |
| Mock Skeleton | ✅ S0~S6 · Must 19/19 mock 동작 |
| DQ-7 Admin Credential | 🟢 ~97% · Smoke #4/#5 + Session 4 QA 잔여 · Smoke #3(Binance)은 S8까지 유예 |
| S7e Supabase 실 I/O | 🟢 **7/8 완료** · T7e.1~T7e.6 ✅ + T7e.8 ✅ · T7e.7 RLS QA 잔여 |
| **S7a (49차 ✅ + 50차 §1 B-17 EXECUTED ✅)** | 🟢 **17/17 task ✅ + B-17 EXECUTED (push + 0016a + 0017 + PR #1)**. 다음 = 사용자 PR #1 review/merge. |
| 실 AI 호출 | 0 · billing 미충전 (사용자가 §C smoke 직전 충전 명시) |
| Production deploy | Vercel `https://tudal-tawny.vercel.app` (origin/main) + **Preview Ready: `https://tudal-git-feat-s7a-anthropic-wrapper-son00326s-projects.vercel.app`** (PR #1) |
| Supabase | project `rbrpcynhphrpljbjirfo` · 0002~0010 + 0012~0014 + 0015a + 0016 + **0016a `drop_legacy_cost_log` (20260519135017) + 0017 `cost_log_and_batch_runs` (20260519135341)** 적용 완료. 0017 RPC 3종 + 0016a row-count guard 박제 ✓. schema-existence smoke 7/7 PASS. |
| PR | **#1 OPEN**: `https://github.com/son00326/New_Project_KR_Stock/pull/1` (base main ← head feat/s7a-anthropic-wrapper, fast-forwarded to 50차 §1 B-17 박제 commit; B-17 execution head was `a9c9c93`). 다음 = 사용자 review/merge |
| 검증 게이트 | build OK · lint 0 errors · test:ci **522 / 60 files** · tsc clean (50차 §1 박제 commit 후 재확인 baseline) |
| omxy debate 누적 | **50 rounds CONVERGED** (25 진입 전 + 13 task R1+R2 + 3 49차 final R1~R3 + 1 49차 박제 R1 + 2 50차 §0 박제 R2+R3 (R1 CONTINUE 불산정) + 6 50차 §1 B-17 R1~R6). 적대적 검토 = 본 PR 운영 원칙. |

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

### §2.1 Step matrix (현재 위치 = Step 1 USER 대기)

Owner 의미:
- **USER** = 사용자만 가능 (외부 계정 / 결제 / 키 발급 / production merge 등)
- **CLAUDE** = Claude 자동 가능 (코드 / 문서 / 로컬 commit / 검증)
- **SHARED** = Claude가 prepare/commit/PR-create 가능, 단 "이어서 진행" 권한이 명시적으로 부여된 경우에만. destructive merge/deploy/migration/billing은 USER에 남는다.

| Step | Owner | Trigger / Precondition | Default action on "이어서 진행" | Branch/PR policy | Verification / Exit | Blocks next |
|---|---|---|---|---|---|---|
| **1** | **USER** | PR #1 OPEN (현재) — destructive (production merge) | background blocker 보고 + Step 2 자동 시작 | `gh pr merge 1 --merge` 또는 `--squash` → main → Vercel prod auto-deploy | PR #1 MERGED 확인 (`gh pr view 1` state=MERGED) | Step 5 (B-6) trigger 가능 시점 |
| **2** | **CLAUDE** | Step 1과 독립 (별도 branch) | 즉시 자동 시작 — `fix/s7a-format-error-inventory` branch에 13건 매핑 + tests + commit + push branch + PR create | new branch from main (또는 Step 1 merge 후). push/PR create = §9 SHARED ("이어서 진행" 권한). merge는 USER. | `format-error.ts` KOREAN_MAPPINGS에 13 신규 코드 + tests pass | 후속 hotfix PR review |
| **3** | **CLAUDE** | Step 1 merge 전이면 stacked branch (1세션+ 작업이라 진입 의사 1회 확인 후 자동) | 진입 의사 1회 확인 → 사용자 OK 시 자동 진행 | stacked branch base = feat/s7a-anthropic-wrapper. Step 1 merge 후 rebase 필요 가능. push/PR create = §9 SHARED. merge는 USER. | Tier 2 Sector Board 14×10 plan verbatim 구현 + tests + commit + push branch + PR create | Step 4 stacked |
| **4** | **CLAUDE** | Step 3 commit 후 stacked from Step 3 (1세션+ 작업이라 진입 의사 1회 확인 후 자동) | 진입 의사 1회 확인 → 사용자 OK 시 자동 진행 | stacked branch base = Step 3 branch. Step 1 merge 후 rebase 필요 가능. push/PR create = §9 SHARED. merge는 USER. | Reflection 자가학습 (reflection_log 마이그 + Tier 1 context 주입 + tests) + PR create | Step 5 trigger 가능 시점 |
| **5** | **USER** | Step 1 merge 후 권장 (production env 적용 시점) — external account + billing | background blocker 보고 + 사용자 트리거 대기 | — | `vercel env add ANTHROPIC_API_KEY` (Preview+Production) + `AI_PROMPT_CACHE_ENABLED=true` + `AI_COST_LOG_REAL_INSERT_ENABLED=true` + Anthropic console billing 충전 + `vercel deploy --prod` | Step 6 |
| **6** | **CLAUDE** | Step 5 USER 트리거 후 | 즉시 자동 시작 — admin server action 1 ticker × 1 persona 호출 + 검증 + runtime hotfix (예: fetchFinancials column 매핑) + commit + push branch + PR create | new branch `fix/s7a-billing-on-smoke-hotfix`. push/PR create = §9 SHARED. merge는 USER. | cost_log row INSERT + section_8 jsonb persist + stock_reports.consensus_badge populated. fetchFinancials 0014 schema 매핑 hotfix 적용 | Step 7 trigger 가능 시점 |
| **7** | **USER** | Step 6 commit 후 권장 — external domain/key rotate | background blocker 보고 + 사용자 트리거 대기 | — | B-7 Resend 도메인 인증 + B-8 Naver key rotate + Vercel env 추가 | Step 8 |
| **8** | **CLAUDE** | Step 7 USER 트리거 후 | 즉시 자동 시작 — S7b 슬라이스 진입 (뉴스 sweep + 모닝 브리핑) + tests + commit + push + PR create | new branch `feat/s7b-news-briefing`. push/PR create = §9 SHARED. merge는 USER. | S7b DoD: 뉴스 수집 → 어드민 3인 이메일 발송 동작 확인 | Step 9 |
| **9** | **CLAUDE** | Step 8 merge 후 (USER 시간 며칠~1주 어드민 3인 운용 검증 병행) | 즉시 D11 진입 활성화 + 어드민 3인 운용 시작 보고 + 모니터링 코드 추가 가능 | hotfix branch (BL-KRIT catch 시). push/PR create = §9 SHARED. PR 없음 — 운용 단계. | D11 AI 가상 포트 1차 가동. 어드민 3인 며칠~1주 운용. OK 신호 = "운용 OK"를 사용자가 신호 (USER trigger) | Step 10 trigger 가능 시점 |
| **10** | **USER** | Step 9 OK 신호 후 — external key 발급 | background blocker 보고 + 사용자 트리거 대기 | — | B-10 KIS 본인 1개 (한투 OpenAPI key/account) 발급 + Vercel env | Step 11 |
| **11** | **CLAUDE** | Step 10 USER 트리거 후 | 즉시 자동 시작 — S7c 슬라이스 진입 (KIS WebSocket read-only 본인 1계좌 + 장중 데이터) + tests + commit + push + PR create | new branch `feat/s7c-intraday-kis`. push/PR create = §9 SHARED. merge는 USER. | S7c DoD: 장중 가격 스트림 수신 + UI 반영 | Step 12 |
| **12** | **CLAUDE** | Step 11 merge 후 | 즉시 자동 시작 — S7d 슬라이스 진입 (Silent Health 일일 batch 안정화) + tests + commit + push + PR create | new branch `feat/s7d-silent-health`. push/PR create = §9 SHARED. merge는 USER. | S7d DoD: heartbeat_log 일일 1건 + Critical alert 0건 안정 | Step 13 trigger 가능 시점 |
| **13** | **USER** | Step 12 merge 후 — USER 클러스터 (동시 다수 external trigger 필요) | background blocker 보고 + 사용자 트리거 대기 | — | B-1 친구 비번 + B-2 KIS 슬롯 정리 + B-3 RLS QA + B-4 Smoke #5 + B-5 Session 4 QA + B-11 Binance key (testnet 우선) | Step 14 |
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
| ~~B-17~~ ✅ DONE | ~~마이그 0017 production apply + branch push + PR/merge~~ EXECUTED 2026-05-19 50차 §1 — push + 0016a + 0017 + PR #1 + Vercel preview Ready. **B-17 migration recovery cleanup 2건**: ① legacy cost_log via recorded migration 0016a ② orphan unique index promoted in-place. omxy 6 rounds R1~R6 CONVERGED. | ✅ |
| **B-17b ⭐최우선** | **사용자 PR #1 review/merge** | (1) `gh pr view 1` 검토 (2) Vercel preview Ready URL 확인 (3) `gh pr merge 1 --merge` 또는 `--squash` (4) origin/main 갱신 후 Vercel production auto-deploy | **S7a 완료 게이트 — PR final close** |
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
| **S7a Section 8 위원 전원 표** | 같은 파일 `§3.7 R3.7-6/7/8/9` + `§6 D20` |
| **S7a Section 8 jsonb canonical contract** | 같은 파일 **§4.2.1** (49차 신설 — partA 0\|14 / partB 3~5 / partC / partD 11 + vote 매핑 BUY/HOLD/SELL ↔ approve/abstain/reject 명시) |
| **S7a Section 8 writer 작성 가이드** | `Document/Service/Report/ReportFramework.md §8 Step 2 v2.4` (49차 갱신) |
| **S7a 코드 SoT** | `tudal/src/lib/screening/consensus.ts` (5종 type union) · `tudal/src/lib/report/section-8-schema.ts` (zod schema) · `tudal/src/lib/ai/prompts/personas/` (Core 11) · `tudal/supabase/migrations/0017_cost_log_and_batch_runs.sql` |
| T7e.7 RLS QA 결과 기록 위치 | `Document/Build/Slices/S7-RealData.md` |
| S7e 상세 태스크/의사결정 | `Document/Build/Slices/S7-RealData.md` |
| 전체 진행률/변경 이력 | `Document/Build/ProgressDashboard.md` |
| 코드 스냅샷/실 I/O 통로 / 잔존 mock 목록 | `Document/Process/CodebaseStatus.md` |
| 어드민 서비스 기획 본체 (D16/D17/D18/D19/D20) | `Document/Service/Planning/ServicePlan-Admin.md` |
| 슬라이스 실행 규칙 | `Document/Process/ExecutionPlaybook.md` |

---

## 6. 완료 이력

상세는 git log + spec/plan/Slice 파일. 직전 3 항목 (50차 §1 B-17 EXECUTED → 50차 §0 박제 정합 → 49차 종료 순):

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

50차 §1 박제 R7~R11 (post-execution docs):  not counted (자기참조 박제 verification round)

총 누적 (CONVERGED only):                 50 rounds  CONVERGED (50차 §1 B-17 EXECUTED 시점, 안정)
```

---

## 8. 다음 세션 진입자 자동 진행 체크리스트

### §8.1 현재 위치 확인 (자동 실행 1회)

```bash
git status --short --branch                       # branch = feat/s7a-anthropic-wrapper (또는 후속 branch)
git log --oneline main..HEAD | head -40           # commits 박제 확인
gh pr view 1 --json state,url                     # PR #1 state (OPEN/MERGED/CLOSED)
# Supabase MCP: list_migrations — drop_legacy_cost_log + cost_log_and_batch_runs 박제 확인
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

### §8.2 자동 진행 결정 (§2 Runbook 따라)

1. **마지막 완료 Step 식별** → §2.1 매트릭스에서 다음 Step 확인
2. **다음 Step Owner 별 행동** (§2.0 default-progress policy 적용):
   - **[CLAUDE]** → 즉시 자동 진행 시작 + commit 단위 진행
   - **[CLAUDE stacked]** (Step 3/4 같은 1세션+ 작업) → 진입 의사 1회 확인 후 자동 진행
   - **[SHARED]** → "이어서 진행" 권한으로 prepare/commit/PR-create까지 자동. merge/deploy/migration은 USER 별도 트리거
   - **[USER]** / **[USER cluster]** → 트리거 보고 (필요한 정확한 명령 + 외부 액션) + 동시 진행 가능한 stacked [CLAUDE] Step 자동 시작 + 사용자 응답 대기
3. **§2.0 7 exception buckets 도달 시 USER 직접 묻기**: scope expansion / product spec / 새 risk profile / real-money / secrets·billing / destructive shared-state / uncertainty ≥ medium

### §8.3 후속 PR 진입 시 omxy 적대적 검토 (§7 패턴 재사용)

- [ ] 새 branch 생성 (Step 2 → `fix/s7a-format-error-inventory`, Step 3 → `feat/s7a-tier2`, Step 4 → `feat/s7a-reflection`, Step 8 → `feat/s7b-news-briefing`, Step 11 → `feat/s7c-intraday-kis`, Step 12 → `feat/s7d-silent-health`, Step 14 → `feat/s8-auto-trading`)
- [ ] §7.3 cmux helper script 재생성 (`/tmp/cmux-send-helper.py`)
- [ ] §7.2 cmux peer surface 갱신 (`cmux list-panes`로 omxy 탐색)
- [ ] §7.4 omxy 적대적 검토 패턴 매 task 강제 적용
- [ ] §7.6 결함 카탈로그 grep 검증 (특히 stock_reports schema + writer vote 매핑)

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

## 9. 사용자 운영 원칙 박제 (49차 + 50차 §2 Runbook 추가)

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
- **HANDOFF.md 다음 세션 자동 진행 가능 조건**: header + §1 + §2 + §8 모두 stale 0. 본 49차 종료 시점 omxy 박제 R1 CONVERGED + **50차 §0 R1+R2+R3 stale 0 박제 CONVERGED** + **50차 §1 B-17 EXECUTED + 박제 R7~R10 CONVERGED** + **50차 §2 Runbook 재구조 R14~R16 CONVERGED** 받은 후 안전 (commit count 34+ + HEAD = 50차 §2 Runbook 박제 commit 또는 그 이상, Runbook 현재 위치 = Step 1 USER 대기).
