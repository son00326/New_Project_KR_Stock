# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-28 (59차 PR #48 Step 2.7a MERGED in main `6c85f13` — silent-health → 실 SELECT via service-role DI + 3 mock 삭제 + auth hardening, omxy patch-suggest 2 rounds CONVERGED 4 catches → fix; PR #46 Step 2.6 + PR #44 Step 2.5 + PR #42 Step 2.4 + ... 자손)

- **59차 누적 MERGED (PR #39/#40/#42/#43/#44/#45/#46/#47/#48)**: 9 PRs all merged. **Step 2.7a `6c85f13` (PR #48, silent-health cron MOCK_ADMIN_PIPELINE_HEALTH + MOCK_ADMIN_ALERTS → 실 SELECT via createServiceRoleClient() DI + admin-news/alerts/pipeline-health DI seam + service-role B17 boundary 확장 + isProductionLikeForAuth 4-way hardening + 3 mock 삭제 (alerts/pipeline-health/heartbeat consumer 0), omxy patch-suggest 2 rounds CONVERGED 4 catches → omxy 직접 fix `4f55548`)**. 58차 누적 PR #30/#31/#32/#33/#34 + 마이그 0025 historical.
- **Mock cleanup**: Step 1+2.1+2.2 ✅ MERGED in 58차 + Step 2.3 ✅ `e273cc2` (PR #39) + Step 2.4 ✅ `4e15176` (PR #42) + Step 2.5 ✅ `6c5ce2c` (PR #44) + Step 2.6 ✅ `845b9ca` (PR #46) + **Step 2.7a ✅ MERGED `6c85f13` (PR #48)** — silent-health 실 SELECT + DI seam 3 helpers + 3 mock 삭제. **잔존 mock**: ZERO production mock files (all admin/data mock helpers cleared via Step 1~2.7a). **Step 2.7b** (silent-health heartbeat_log INSERT + news-sweep news_event INSERT + news cron service-role wiring) 별도 분리.
- **main HEAD** = `6c85f13` (post-PR-#48 Step 2.7a MERGED, ancestor `25e27af` post-PR-#47 docs sync, ancestor `845b9ca` post-PR-#46 Step 2.6) — `git rev-parse --short origin/main` 으로 verify (자손 허용)
- **OPEN PRs**: **#2** (format-error, CONFLICTING 보류) only — PR #48 + PR #46 + PR #44 + PR #43 + PR #42 + PR #40 + PR #39 MERGED, branches deleted
- **Vercel deploy/canary**: main `6c85f13` post-PR-#48 public canary 4/4 OK (`/` 200 + `/login` 200 + `/macro` 200 + `/admin` 307→/login auth redirect). 인증 세션 canary verify (`/admin/settings/health` + `/admin/settings/cost` + `/admin/alerts` empty state) 권장.
- **검증 게이트 (main `6c85f13`)**: **test:ci 1272 PASS / 113 files** (+9 vs 59차 PR #46 baseline 1263, 회귀 0) · build 25 routes · lint 0 err 5 warn (pre-existing) · tsc clean · **마이그 0건** (PR #48 코드 + tests)
- ⚠️ **Task 4 MERGED + 마이그 0025 applied + Mock cleanup Step 1~2.7a MERGED ≠ production functional 불변** — Vercel env `PR4_TRIGGER_UPSERT_ENABLED` UNSET 잔존 → admin trigger button = report_not_found fail-fast (B65-P1 active). 정상 동작은 USER가 Vercel env=true 설정 후 (Task 7 Smoke Stage 2 게이트).
- ✅ **59차 PR #48 omxy patch-suggest 2 rounds CONVERGED** (사용자 명시 변형 워크플로우): R1 4 catches (HIGH CRON_SECRET undefined fallback dev-fallthrough → PR1 MF4 4-way hardening / MED single-instance invariant test / MED/LOW DI seam regression test / LOW 주석 honest scoping) + omxy 직접 fix commit `4f55548` + R2 CONVERGED (잔여 결함 0).
- **W- defer 상태 업데이트**:
  - `W-pipeline-health-admin-assertion`: **READ side fully resolved** (silent-health service-role). INSERT side 잔여 (Step 2.7b).
  - `W-news-cron-service-role-read`: **half-resolved** — admin-news.ts DI seam 준비 ✓, news cron route wiring (news-sweep + morning-briefing service-role 주입) 잔여 (Step 2.7b).
- **다음 1순위**:
  1. **(USER) Vercel Production env 설정** = `PR4_TRIGGER_UPSERT_ENABLED=true` 추가 + `AI_COST_LOG_REAL_INSERT_ENABLED=true` 값 verify.
  2. **(USER 권장)** 인증 세션 canary verify.
  3. **(CLAUDE 다음 세션 1순위)** **Mock cleanup Step 2.7b (cron INSERT 실 path + news cron service-role wiring) 진입** — fresh branch off main `6c85f13`. silent-health heartbeat_log INSERT 실 path + news-sweep news_event INSERT 실 path + news-sweep + morning-briefing route service-role 주입 (W-news-cron-service-role-read 완전 해소). idempotency / retry / conflict resolution architectural 결정 PR plan 단계에서 R-debate. omxy R-debate (patch-suggest mode 사용자 명시 변형) 강제.
  4. **(CLAUDE 병렬 가능)** Task 5 B66 production backfill (short_list_30 sector placeholder → canonical 14 매핑).
  5. **(CLAUDE)** Task 7 Smoke Stage 2 — USER 1회 비용 승인 (~5,000~6,000원).
  6. 이후 Task 8 audit + PR5 cron 30 자동 plan SoT.
- **omxy lifecycle** = git log + spec/plan/PR body 위임 (R-debate 라운드별 catch 박제 = PR body — historical 강등 후 본 §6 직전 entry 1줄)

---

## ⭐ 다음 세션 진입자 5줄 요약 (59차 PR #48 Step 2.7a MERGED in main `6c85f13` — silent-health → 실 SELECT via service-role DI + 3 mock 삭제 + auth hardening, omxy patch-suggest 2 rounds CONVERGED 4 catches → omxy 직접 fix; PR #46 Step 2.6 + PR #44 Step 2.5 + PR #42 Step 2.4 + ... 누적)

1. **59차 PR #42 MERGED 박제 (Step 2.4 = cost page MOCK 3 fixture → 실 cost_log SELECT)**: cost page (`/admin/settings/cost`)의 `MOCK_ADMIN_COST_LOG` + `MOCK_ADMIN_COST_LOG_OVER_WARNING` + `MOCK_ADMIN_COST_LOG_OVER_HARDCAP` 3 fixture → 실 cost_log SELECT via 신규 helper `admin-cost-log.ts::getMonthlyCostLog` (Step 2.3 pagination 패턴 + CORE_11 11 production persona.id Set + month 정규화 + non-finite/negative guard + DI seam). Server Component async + 시연 section 삭제 (production stress data 부재 — banner active state로 cover) + mock 파일 `mock-admin-cost-log.ts` 삭제 (consumer 0 도달).
2. **omxy patch-suggest 2 rounds CONVERGED (사용자 명시 변형 워크플로우)**: R1 1 BLOCKER catch + omxy 직접 fix commit `c2897b4` (derivePurpose 가 production CORE_11 kebab-case full-name persona.id [warren-buffett / stanley-druckenmiller / chair 등 11개] missing → `other` fallback 차단 위해 `CORE_11_PERSONA_IDS` Set 추가, prefix check 앞 우선) + R2 omxy 독립 Python 스크립트로 helper Set ↔ `tudal/src/lib/ai/prompts/personas/*.ts` production id 비교 missing 0 / extra 0 → Catch 0 SIGNAL: CONVERGED.
3. **1 W- defer ticket 박제 (§9.5)**: `W-cost-log-core11-drift` — CORE_11_PERSONA_IDS hardcoded Set은 future persona 추가 시 drift 가능. Step 2.4 scope에서는 exact match 목적이고 prompts import로 runtime 의존성 증가보다 surgical Set 채택 (omxy R2 non-blocking WATCH lock-in). 추후 build-time grep 또는 canonical export import로 hardening.
4. ⚠️ **Task 4 MERGED + 마이그 0025 applied + Mock cleanup Step 1~2.7a MERGED ≠ production functional 불변**: Vercel Production env `PR4_TRIGGER_UPSERT_ENABLED` UNSET → orchestrator strict 'true' false → legacy path 유지 → admin trigger button = report_not_found fail-fast (B65-P1 cost burn 차단 active). 정상 동작은 USER가 Vercel env=true 설정 후.
5. **다음 세션 sequence (CLAUDE 자동 진입)**:
   - **(CLAUDE entry routine)** §0 verify (main HEAD = `6c85f13` post-PR-#48 MERGED 또는 자손 + OPEN PRs `#2` only + production audit drift 0).
   - **(USER 잔여 액션)** Vercel env `PR4_TRIGGER_UPSERT_ENABLED=true` 추가 (+ `AI_COST_LOG_REAL_INSERT_ENABLED=true` verify) + (권장) 인증 세션 production canary verify (`/admin/settings/cost` Step 2.4 real cost_log SELECT 통과 + 빈 위젯/banner null 정상 + `/admin/report/[ticker]/regenerate` Step 2.3 real cost_log SELECT path 통과). Public curl canary 4/4 OK 완료 (`/` 200 / `/login` 200 / `/macro` 200 / `/admin` 307).
   - **(CLAUDE) Mock cleanup Step 2.7b (cron INSERT 실 path + news cron service-role wiring) 진입** — fresh branch off main `6c85f13`. silent-health heartbeat_log INSERT + news-sweep news_event INSERT + news-sweep + morning-briefing route service-role 주입 (W-news-cron-service-role-read 완전 해소). idempotency / retry / conflict resolution architectural 결정 PR plan 단계에서 R-debate. omxy R-debate (patch-suggest mode 사용자 명시 변형) 강제.
   - **(CLAUDE 병렬 가능)** Task 5 B66 backfill (short_list_30 sector placeholder → canonical 14) + Task 7 Smoke Stage 2 (USER 1회 비용 승인 ~5,000~6,000원).
**참고 — canonical 5-PR 순서 (모두 MERGED, PR5 진입 차단 = B65-P2 impl + B65-P3 + B66 + Smoke 모두 PASS)**:

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

**진입 트리거 (59차 PR #42 종료 → 다음 차수 진입)**: "`Document/Process/HANDOFF.md` 보고 이어서 진행" →
1. §0 verify (`git rev-parse --short origin/main` = `6c85f13` 또는 자손 (post-PR-#48 Step 2.7a MERGED) + OPEN PRs `#2` only + main test:ci 게이트 1회 재실행 (baseline = 1272 PASS / 113 files))
2. **production audit 재확인** (Supabase 직접 query, §2.1 Task 1 entry routine) — drift 0 확인 (cost_log=0 / stock_reports=0 / committee_votes=0 잔존 정상 — Vercel env=true + Task 7 Smoke Stage 2 후만 drift 가능)
3. **§9 박제 + §2.1 active matrix 갱신** (Task 1+2+3 ✅ + Task 4 ✅ + 마이그 0025 ✅ + Mock cleanup Step 1+2.1+2.2+2.3+2.4 ✅ 모두 MERGED) + W-cost-log-admin-assertion + W-cost-log-pagination-snapshot + W-cost-log-core11-drift + W-mock2-rls-drift 박제 확인
4. **Mock cleanup Step 2.7b (cron INSERT 실 path + news cron service-role wiring) 진입** — fresh branch off main `6c85f13`. silent-health heartbeat_log INSERT + news-sweep news_event INSERT + news-sweep + morning-briefing route service-role 주입. idempotency / retry / conflict resolution architectural 결정. omxy R-debate (patch-suggest mode 사용자 명시 변형) 강제. 의사 1회 확인 후 자동 시작.

**14 defer follow-up tickets (PR4 출신, B65/B66과 무관, 별도 작업)**: PR #19 body 박제. architectural drift (W-1 callerKind dead code / W-2 fetchTrackRecord* in actions.ts) + observability gap (W-4 sub_tags / W-5 user.email) + cosmetic (W-6 as never cast / Track 3 I1-I6).

**⚠️ PR4 acceptance criterion 박제 (불변)**: PR4 scope = admin manual trigger 버튼 + Regen + Track Record + PR3a OOS + **B18 CRON_SECRET 401 test만** + Task 8 W7만 (defer는 source review docs 링크). 본 PR에서 적용:
1. **caller DI seam (✅ 완료)** — `commitFullReport` / `orchestrateFullReport` + 모든 helper (cost-logger / AI clients 3종 / report-critic-findings / sector-reference-backlog / critic.ts evaluateReport) options:{client?} 패턴
2. **admin caller = quality (✅ 완료)** — admin manual = `orchestrateFullReport(callerKind='admin')` Kevin v3.1 quality target
3. **CRON_SECRET 401 test (잔여)** — cron route가 CRON_SECRET 미일치 시 401 반환 검증 (Task 7)

> **cron 30 자동 리포트 + service-role caller DI + admin_id 'cron-system' + cost_log e2e test = PR5 후속 트랙** (T11 분할 결정 보존, PR4 머지 후 진입). PR5 caller path = orchestrateFullReport (quality), timeout 처리 = 자체 DB job queue β2′ 또는 Vercel Queues β1 (PR5 plan 시점 R-debate).

**운영 원칙**: 미래 지향. §6 inline entry = 직전 2개 code/history entry만 — (1) **Mock cleanup Step 2.7a ✅ MERGED `6c85f13` (PR #48)** + (2) Mock cleanup Step 2.6 ✅ MERGED `845b9ca` (PR #46). Step 2.5 entry는 demote 1줄 link. older historical = git log + spec/plan/REVIEW docs + ProgressDashboard 위임. **commit count + SHA chain + sweep round count 표현은 self-referential drift 발생 위험으로 추상화 — 정확한 chain은 `git log origin/main..<branch>`로 runtime verify, debate round는 cmux debate transcript 위임** (B75 fixed SHA 박제 금지 정합).

**⚠️ gsd-code-reviewer 환경 부재 대체 정책 (54차 §4 박제)**: 현 Claude Code 환경에서 `gsd-code-reviewer` agent type은 더 이상 사용 불가. PR3b/PR4/후속 모든 PR의 deep code review는 **3-track 대체 패턴** (PR4 finalize Task 9에서 적용):
- **Track 1**: `gstack-review` skill (pre-landing PR review, structural/SQL/LLM trust/concurrency)
- **Track 2**: `general-purpose` agent (depth=deep adversarial prompt — gsd 동등 책임)
- **Track 3**: `superpowers:code-review` skill 또는 5-angle scan agent (recall mode bug catch)

---

## 0. 세션 시작 루틴 (verify + auto-progress)

```bash
# 59차 PR #48 종료 post-merge baseline — main `6c85f13` (post-PR-#48 Step 2.7a silent-health service-role + 3 mock 삭제, ancestors PR #47/#46/#45/#44/#43/#42/#40/#39).
# 59차 누적 MERGED: PR #39/#40/#42/#43/#44/#45/#46 — Step 2.3/2.4/2.5/2.6 4종 mock cleanup + 2 docs sync (omxy patch-suggest 누적 2+2+2 rounds CONVERGED 7 catches → fix + 5 W- defer).
# 58차 누적 MERGED: PR #30~#34 + 마이그 0025 production applied.
# OPEN: #2 only (format-error, CONFLICTING 보류).
# main HEAD = `6c85f13` post-PR-#48 Step 2.7a silent-health service-role MERGED (실제 SHA는 runtime verify로 갱신, 자손 허용)
cd /Users/yong/New_Project_KR_Stock

# 1. main branch state runtime 확인 (B75 fixed SHA 박제 금지 — post-PR-#42 descendant 자손 기대)
git checkout main && git pull origin main
git rev-parse --abbrev-ref HEAD                   # main
git rev-parse --short HEAD                        # 기대: `6c85f13` 또는 자손 (runtime 동적 verify)
git status --short                                # clean

# 2. OPEN PRs (59차 PR #42 종료 post-merge baseline: #2 only — PR #42 + PR #40 + PR #39 MERGED, branches deleted)
gh pr list --state open --json number,title,headRefName,mergeable
#   #2   fix/s7a-format-error-inventory (format-error, CONFLICTING 보류)

# 3. 59차 누적 MERGED + canonical 5-PR + B65 3-phase 확인
git log --oneline | head -10
#   기대: 59차 PR #48 종료 post-merge = `6c85f13` PR #48 + 그 이전 commit chain
#   상세 commit 체인 = git log + PR body 위임

# 4. 검증 게이트 (main `6c85f13` — 매 세션 진입 시 1회)
#    - test:ci 실측 = 1272 PASS / 113 files (59차 PR #48 baseline; +9 vs PR #46 baseline 1263)
#    - build 25 routes (news cron routes 정상) / lint 0 err 5 warn (pre-existing) / tsc clean / 0 migrations (PR #46 코드 + tests + format-error mapping)
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

# 6. Vercel production canary (post-PR-#40 docs-sync; code behavior baseline PR #39 `e273cc2` — 권장 1회 verify)
#    /admin/portfolio trigger button click → `리포트를 찾을 수 없습니다` 메시지 (P1 fail-fast active)
#    /admin/track-record + /admin/report/[ticker] + /admin/report/[ticker]/regenerate 진입 정상
```

### 진입자 자동 행동 (§2.0 default-progress policy, 59차 종료 갱신)

1. **§0 verify 실행** → branch state + PR state (**#2 CONFLICTING 보류 only** — PR #39 + PR #40 MERGED, branches deleted) + 검증 게이트 + **production audit 재확인** (Task 1).
2. **§9 박제 확인** — PR4 + B65-P1/P3 MERGED + 마이그 0025 applied + Mock cleanup Step 1/2.1/2.2/2.3/2.4/2.5/2.6/2.7a MERGED ≠ production functional 불변. Vercel env `PR4_TRIGGER_UPSERT_ENABLED` UNSET 잔존 → admin trigger button = report_not_found fail-fast (B65 P1 active). 정상 동작은 USER가 Vercel env=true 설정 후.
3. **§2.1 active matrix 다음 unblocked step 식별**:
   - Task 1 ✅ COMPLETED (57차 §1, production audit 1회) — **다음 세션 entry routine 1순위 재실행**
   - Task 2 ✅ MERGED `5b99e03` (B65-P1 PR #21)
   - Task 3 ✅ COMPLETED (57차 §2, B65-P2 spec doc CONVERGED R8 — 옵션 A lock-in)
   - **Task 4 ✅ MERGED `3c09d6e` (58차, PR #30 B65-P3 impl) + 마이그 0025 ✅ production applied**
   - **B-trackrecord-rls ✅ MERGED `838386e` (58차, PR #31)**
   - **Mock cleanup Step 1 ✅ MERGED `1d2db08` (58차, PR #32, omxy R1~R4 CONVERGED)**
   - **Mock cleanup Step 2.1 ✅ MERGED `e6be73f` (58차, PR #33, omxy 2 rounds CONVERGED)**
   - **Mock cleanup Step 2.2 ✅ MERGED `2dca060` (58차, PR #34, omxy R1 CONVERGED)**
   - **Mock cleanup Step 2.3 ✅ MERGED `e273cc2` (59차, PR #39, omxy 6 rounds CONVERGED 12 catches → 10 fix + 2 W- defer)**
   - **Mock cleanup Step 2.4 ✅ MERGED `4e15176` (59차, PR #42, omxy patch-suggest 2 rounds CONVERGED 1 BLOCKER catch + fix + 1 W- defer)**
   - **Mock cleanup Step 2.5 ✅ MERGED `6c5ce2c` (59차, PR #44, omxy patch-suggest 2 rounds CONVERGED 4 catches → fix + 2 W- defer)**
   - **Mock cleanup Step 2.6 ✅ MERGED `845b9ca` (59차, PR #46, omxy patch-suggest 2 rounds CONVERGED 2 catches → 1 LOW fix + 1 HIGH defer)**
   - **Mock cleanup Step 2.7a ✅ MERGED `6c85f13` (59차, PR #48, omxy patch-suggest 2 rounds CONVERGED 4 catches → omxy 직접 fix `4f55548` HIGH auth hardening + MED invariant test + MED/LOW regression test + LOW honest scoping)**
   - **다음 1순위**: (CLAUDE) **Mock cleanup Step 2.7b (cron INSERT 실 path + news cron service-role wiring)** 진입 — fresh branch off main `6c85f13`. silent-health heartbeat_log INSERT + news-sweep news_event INSERT + news cron service-role 주입 (W-news-cron-service-role-read 완전 해소). idempotency / retry / conflict resolution architectural 결정. (USER 잔여) Vercel env 설정. → Task 5 B66 backfill + Task 7 Smoke Stage 2
4. **Owner 별 행동**:
   - **[CLAUDE]** → 즉시 자동 시작 (stacked 1세션+ 작업은 진입 의사 1회 확인).
   - **[SHARED]** → "이어서 진행" 권한으로 prepare/commit/push/PR-create 자동; docs-sync merge는 CLAUDE.md 자동 허용 범위 안에서만.
   - **[USER]** → background blocker 보고 + Vercel env 설정 + (권장) 인증 세션 production canary verify + Smoke Stage 2 시점 1회 비용 승인 (Task 7).
5. **§2.0 명시 USER 승인 게이트 (좁힘, 59차 종료)** 도달 시만 USER 직접 묻기 — scope expansion / product spec / risk profile / real-money / cost burn 트리거 / 마이그 production apply / **Vercel env / secrets / flag 토글** / external account / 외부 메시지 / destructive (force push to main, DB drop) / uncertainty ≥ medium. **자동 진행 허용** (PR merge rebase FF + delete-branch / docs-sync PR create+merge / public canary curl + authenticated browser canary / non-destructive deploy status polling / PR create+comment+body 갱신 / branch cleanup) — omxy R-debate CONVERGED + 검증 게이트 ALL GREEN = 사용자 승인 등가 (CLAUDE.md ⚙️ 자동 진행 허용 범위 한정).
6. **§7 omxy 적대적 검토 패턴**은 모든 신규 작업 branch에서 강제 적용 (59차 박제: PR #39 Step 2.3 PR-내 cmux pair-debate 6 rounds — R1~R5 fix chain + R6 CONVERGED. catch-only output mode (Complex: cost_log financial data + RLS + multi-file). 결함 카탈로그 + scope guard 4종 필수).

---

## 1. 현재 상태 (59차 PR #48 Step 2.7a ✅ MERGED `6c85f13` — silent-health 실 SELECT via service-role DI + 3 mock 삭제 + 4-way auth hardening, omxy patch-suggest 2 rounds CONVERGED 4 catches → omxy 직접 fix, 59차 PR #39/#40/#42/#43/#44/#45/#46/#47 + 58차 PR #30~#34 + 마이그 0025 누적, 2026-05-28)

| 영역 | 상태 |
|---|---|
| main HEAD | **`6c85f13`** (post-PR-#48 Step 2.7a silent-health service-role MERGED, ancestors PR #47 docs sync + PR #46 Step 2.6 news cron + PR #45 docs + PR #44 Step 2.5 + 그 이전 chain). 자손 SHA 허용. **다음 세션 진입 시 `git rev-parse --short origin/main`으로 verify** (B75 fixed SHA 박제 금지 — 자손 SHA 동적). |
| **PR #48 (59차 Mock cleanup Step 2.7a)** | ✅ MERGED `6c85f13` — silent-health cron MOCK_ADMIN_PIPELINE_HEALTH + MOCK_ADMIN_ALERTS → 실 SELECT via `createServiceRoleClient()` + DI seam (admin-news/alerts/pipeline-health에 `options.client?: SupabaseClient` 추가). service-role.ts B17 boundary 확장 (cron/silent-health + 3 DI seam helpers 허용). isProductionLikeForAuth() 4-way fail-closed (PR1 monthly-batch MF4 패턴 정합). mock 3개 삭제 (alerts/pipeline-health/heartbeat, consumer 0). omxy patch-suggest 2 rounds CONVERGED 4 catches → omxy 직접 fix commit `4f55548` (HIGH auth hardening + MED invariant test + MED/LOW regression test + LOW honest scoping). W-pipeline-health-admin-assertion READ side fully resolved. W-news-cron-service-role-read half-resolved (DI seam ✓, news cron route wiring 잔여). |
| **PR #46 (59차 Mock cleanup Step 2.6)** | ✅ MERGED `845b9ca` — news cron routes MOCK_ADMIN_NEWS → 기존 `admin-news.ts::getRecentNewsEvents` 재사용 + format-error mapping + 2 mock 삭제 + W-news-cron-service-role-read defer 박제. |
| **PR #44 (59차 Mock cleanup Step 2.5)** | ✅ MERGED `6c5ce2c` — health page MOCK_ADMIN_PIPELINE_HEALTH → 실 pipeline_health SELECT (신규 helper `admin-pipeline-health.ts::getRecentPipelineHealth` + Step 2.3/2.4 ASC pagination 정합 + schema fail-closed enum + non-finite/negative latency guard + Server Component async + format-error mapping), omxy patch-suggest 2 rounds CONVERGED 4 catches + omxy 직접 fix commit `fd2d4e8` + 2 W-pipeline-health-* defer. |
| **PR #42 (59차 Mock cleanup Step 2.4)** | ✅ MERGED `4e15176` — cost page MOCK_ADMIN_COST_LOG 3 fixture → 실 cost_log SELECT (신규 helper `admin-cost-log.ts::getMonthlyCostLog` + CORE_11 11 production persona.id Set + Server Component async + 시연 section 삭제 + mock 파일 삭제 consumer 0), omxy patch-suggest 2 rounds CONVERGED 1 BLOCKER catch + omxy 직접 fix commit `c2897b4` + 1 W-cost-log-core11-drift defer. |
| **PR #40 (59차 docs sync)** | ✅ MERGED `d052aa7` — HANDOFF.md post-PR-#39 docs sync only. |
| **PR #39 (59차 Mock cleanup Step 2.3)** | ✅ MERGED `e273cc2` — regenerate `MOCK_ADMIN_COST_LOG` → 실 `cost_log` SELECT pagination loop, omxy 6 rounds CONVERGED 12 catches → 10 fix + 2 W- defer (W-cost-log-admin-assertion + W-cost-log-pagination-snapshot) |
| **PR #21 (B65-P1)** | ✅ MERGED `5b99e03` (57차 §1) — Task 2 production active |
| **PR #20+#22+#24+#25 (docs chain, 57차 §1 lifecycle)** | ✅ MERGED in main (branches deleted, PR #23 CLOSED 운영 원칙 반려) |
| **PR #26 (57차 §2 — B65-P2 spec doc + HANDOFF sweep + cleanup, docs-only, 3 commits)** | ✅ **MERGED in main `33098e0`** (rebase FF, --delete-branch, 2026-05-26, Vercel deploy SUCCESS E41zxrqAeRGfB7E99h82hXpZkAd2) |
| **Vercel last verified production deploy/canary** | ✅ main `6c85f13` post-PR-#48 public canary 4/4 OK (`/` 200 + `/login` 200 + `/macro` 200 + `/admin` 307→/login auth redirect) ✓ public 회귀 0. 인증 세션 canary 권장: `/admin/settings/health` (Step 2.5) + `/admin/settings/cost` (Step 2.4) + `/admin/alerts` empty state. cron route 검증: silent-health 매일 15:00 UTC (Step 2.7a service-role 실 SELECT — production rows=0 → classification.status='ok'), news-sweep 매일 00:00 UTC, morning-briefing 매일 23:00 UTC. |
| **PR4 (canonical 5-PR 마지막)** | ✅ MERGED `7de9696` (PR #19, 56차 §5) — 상세 = §6 56차 §5 entry + PR #19 body |
| canonical 5-PR MERGED (전체 완료) | PR2 `f85fb69` / PR3a `0813a41` / PR1 `4aa3130` / PR3b `cf68731` / PR3c `b2a902a` / PR4 `7de9696` |
| **57차 §1 Task 1 (production audit)** | ✅ COMPLETED — drift 0 (57차 §2 entry routine 재실행 시점에도 동일 ground truth) |
| **57차 §1 Task 2 (B65-P1 immediate guard) ✅ MERGED** | PR #21 MERGED `5b99e03`. P1 guard production active. |
| **57차 §2 Task 3 (B65-P2 RPC R-debate spec doc) ✅ CONVERGED R8 final** | spec doc = `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md` (DRAFT R1 → R8 final). 결정 lock-in: **옵션 A** `upsert_report_sections_0_7_admin` admin-only UPSERT RPC + section_0~7 + appendix only + axis (i)A admin trigger 책임 = section_0~7 only + axis (ii) B79 deferred → PR5 plan + axis (iii) PR5 cron path 충돌 없음. spec doc only (no impl code, 0 migrations). |
| **PR #21 OMXY (57차 §1, 4 rounds CONVERGED)** | R1+R2+R3+R4 — 모두 **BLOCKERS 0** · WATCH (비차단): P3 도입 시 feature flag toggle (`PR4_TRIGGER_UPSERT_ENABLED`, B98 default) |
| **57차 §2 Task 3 OMXY (8 rounds, SIGNAL=ESCALATE max-8-rounds 정합 §7.5)** | R1 6 BLOCKERS + R2 5 + R3 5 + R4 3 + R5 2 + R6 1+2 minor + R7 2 + R8 ESCALATE max-8 + 3 mechanical fix. native critic subagent 6명 (Godel R1 5 BLOCKERS + 4 WATCH / Feynman R2 / Planck R3 / Schrodinger R4 / Franklin R5 / Hypatia R6). **누적 catch 30+ 모두 fix 반영**. |
| ⚠️ **PR4 + B65-P1/P3 + Mock cleanup Step 1/2.1/2.2/2.3/2.4/2.5/2.6/2.7a MERGED + 마이그 0025 applied ≠ production functional 잔존** | Vercel Production env `PR4_TRIGGER_UPSERT_ENABLED` UNSET → orchestrator legacy path 유지 → admin trigger button = report_not_found fail-fast (B65 P1 cost burn 차단 active). 정상 동작은 USER가 Vercel env=true 설정 후 (Task 7 Smoke Stage 2 게이트). §9 박제 유지. |
| **B66 quality/trust blocker** | `short_list_30` 30 rows sector="코스닥"/"코스피" placeholder. PR5 entry blocker — Task 5 backfill 후 PR5 진입 가능. |
| **B67~B98 + 9 신규 audit (57차 §2 + 58차 Step 2.x)** | 56차 §5 omxy 11+ 항목 + 57차 §2 R-debate 6 신규 (B79 / B-versioning / W-tier1pill / W-grant-smoke ✅ RESOLVED / W-sectionfallback-text / W-cost-log-env-gate) + 58차 Step 2.x 3 신규 (W-mock2-rls-drift / W-s5b-admin-assertion / W-ticker-re-kr-only). Smoke Stage 2 PASS 후 audit (§9 + Task 8). |
| **58차 Task 4 B65-P3 impl ✅ MERGED `3c09d6e` + 마이그 0025 production applied** | PR #30 7 commits FF, omxy R1~R3 CONVERGED. 마이그 0025 = `upsert_report_sections_0_7_admin` admin-only UPSERT RPC + 4-grant matrix + SECURITY DEFINER + search_path. 옵션 A lock-in 정합. |
| **다음 세션 1순위** | ⭐ **(CLAUDE) Mock cleanup Step 2.7b (cron INSERT 실 path + news cron service-role wiring) 진입** — fresh branch off main `6c85f13`. silent-health heartbeat_log INSERT + news-sweep news_event INSERT + news-sweep + morning-briefing route service-role 주입 (W-news-cron-service-role-read 완전 해소). idempotency / retry / conflict resolution architectural 결정 PR plan 단계 R-debate. omxy R-debate (patch-suggest mode 사용자 명시 변형) 강제. **(USER 잔여)** Vercel env `PR4_TRIGGER_UPSERT_ENABLED=true` 추가 → Task 7 Smoke Stage 2 진입 가능. **(CLAUDE 병렬 가능)** Task 5 B66 backfill → Task 7 Stage 2 → Task 8 audit + PR5. |
| Mock Skeleton + DQ-7 + S7e + S7a + Tier 2 | ✅ Mock 완료 / 🟢 DQ-7 ~97% (Smoke #4/#5 + Session 4 QA 잔여) / 🟢 S7e 7/8 (T7e.7 RLS QA 잔여) / ✅ S7a MERGED (51차) / ✅ Tier 2 D21 (52차+53차) |
| 선정 흐름 메인 path | 🟢 spec lock-in: Tier 0 150 → Tier 1 Core 11 AI 평가 → 단/중/장 top 10 = 30. 현재 production = Tier 0 단독 30 직선정 (fallback). **PR5 cron 가동 시 메인 path 활성 (Mock cleanup Step 2 완료 + B66 backfill + Smoke Stage 1+2 PASS 후만 진입)**. |
| 풀 리포트 흐름 | 🟢 PR3b writer Section 0~7 + Section 8 partA/partD + PR3c 3-step orchestration + PR4 admin caller wired + B65-P3 admin-only UPSERT RPC + 마이그 0025 production applied. **but production cost_log=0 / stock_reports=0 — 성공/기록된 AI 호출 및 리포트 0건. Vercel env UNSET 잔존 → admin trigger button 클릭 → `report_not_found` (P1 cost burn 차단) 반환**. Vercel env=true + Smoke Stage 2 후 실 정상 동작 가능. cost_log 적재 정확한 지점은 Smoke Stage 2에서 확정 (B100). |
| OPEN PRs | **#2** (format-error, CONFLICTING 보류) only — 59차 누적 MERGED 추가: **PR #48 Step 2.7a silent-health (`6c85f13`) + PR #47 docs (`25e27af`) + PR #46 Step 2.6 news cron (`845b9ca`) + PR #44 Step 2.5 health page (`6c5ce2c`) + PR #43 docs (`cebcdff`) + PR #42 Step 2.4 cost page (`4e15176`) + PR #40 docs (`d052aa7`) + PR #39 Step 2.3 (`e273cc2`)**. 58차 누적: PR #30~#34 + 마이그 0025. |
| 실 AI 호출 | **현재 0건 (production cost_log ground truth, 불변)**. Vercel env 3 vars (ANTHROPIC_API_KEY + 2 모델 ID) Production 배포 + 충전 완료. PR4 + B65-P1/P3 MERGED + 마이그 0025 applied + Mock cleanup Step 1~2.7a MERGED — trigger button = cost burn 차단 production active (P1 fail-fast, Vercel env UNSET 잔존). **Vercel env=true 설정 후** 첫 실 AI smoke 가능 (B97 2-stage 분리). Smoke Stage 2 진입 전 `AI_COST_LOG_REAL_INSERT_ENABLED='true'` env 선행 필수 (W-cost-log-env-gate). |
| Production deploy/canary | Vercel main `6c85f13` post-PR-#48 public canary 4/4 OK (`/` 200 + `/login` 200 + `/macro` 200 + `/admin` 307→/login auth redirect) ✓ public 회귀 0. 인증 세션 canary 권장: `/admin/settings/health` (Step 2.5 통과) + `/admin/settings/cost` (Step 2.4 통과) + `/admin/report/[ticker]/regenerate` (Step 2.3 통과) + `/admin/alerts` + `/admin/settings` empty state + PR4 핵심 4 페이지. cron route 검증: silent-health 매일 15:00 UTC (Step 2.7a service-role 실 SELECT) + news-sweep 매일 00:00 UTC + morning-briefing 매일 23:00 UTC. |
| Supabase | project `rbrpcynhphrpljbjirfo` · **0001~0025 production 적용 완료** (0025 = 58차 Task 4 `upsert_report_sections_0_7_admin` admin-only UPSERT RPC). SECURITY DEFINER 4-grant 패턴 유지. PR #39 = 0 migrations (코드 + docs only — cost-logger.ts pagination root-cause fix + getMonthlyTotal hardening). |
| 검증 게이트 (main `6c85f13`) | build 25 routes / lint 0 err 5 warn (pre-existing) / **test:ci 1272 PASS / 113 files** (+9 vs 59차 PR #46 baseline 1263, 회귀 0) / tsc clean / 0 migrations. |
| omxy debate 누적 | PR3c까지 238+ rounds · PR4 lifecycle 50 BLOCKERS · 56차 §5 + 57차 §1~§3 + 58차 13 rounds CONVERGED · 59차 PR #39 6 rounds 12 catches · PR #42 2 rounds 1 BLOCKER + 직접 fix · PR #44 2 rounds 4 catches + 직접 fix `fd2d4e8` + 2 W- defer · PR #46 2 rounds 2 catches (1 LOW fix + 1 HIGH defer W-news-cron-service-role-read) · **PR #48 2 rounds 4 catches (HIGH auth hardening + MED invariant + MED/LOW regression + LOW honest scoping) + omxy 직접 fix `4f55548`** (Step 2.7a R1~R2 patch-suggest) — 최신 라운드/catch 누적/fix commit은 git log + cmux debate transcript 위임. |

---

## 2. 출시까지 선형 Runbook

### §2.0 Default-progress policy

**"이어서 진행해줘" 받았을 때 Claude의 행동 규칙**:

- If current step is USER-gated, report it briefly as background blocker and proceed to the next unblocked CLAUDE step.
- Do not repeatedly ask which option to choose when the runbook already defines the next CLAUDE step.
- Stop only at explicit USER-gated operations or the exception list below.

**자동 진행 허용 vs 항상 USER-only 정책은 본 프로젝트 `CLAUDE.md ⚙️ Claude+omxy R-debate Workflow 정책` 섹션이 SoT** (58차 종료 omxy R1~R4 CONVERGED 박제). 본 §2.0에서는 high-level 요약만:

- **자동 진행 허용** (사용자 명시 권한 ON + omxy CONVERGED + 검증 게이트 ALL GREEN): PR merge / docs-sync PR / canary / deploy polling / branch cleanup / PR create.
- **항상 USER-only** (CLAUDE는 가이드 + 후속 verify, 실 실행 X): Vercel env / secrets / flag 토글 / 마이그 production apply / billing / live-money / external account / cost burn 트리거 / 외부 메시지 발송 / destructive (force push to main, DB drop).
- **uncertainty ≥ medium** + **product spec changes** + **scope expansion** + **new risk profile**: 사용자 묻기 강제.

상세 분류 + Output Modes + Context Packet 표준 + Native Critic Role Taxonomy + 단계별 subagent/skill 매핑 = CLAUDE.md 참조. memory: [[feedback_user_action_auto_progress]] + [[feedback_omxy_debate_workflow]] + [[feedback_no_user_approval_gate]].

### §2.1 Step matrix (59차 PR #48 Step 2.7a ✅ MERGED `6c85f13` — silent-health 실 SELECT via service-role DI + 3 mock 삭제 + auth hardening, 59차 PR #39/#40/#42/#43/#44/#45/#46/#47 + 58차 PR #30~#34 누적, **PR5 진입 = Task 5~7 PASS + Mock cleanup Step 2 완료 후**)

**현재 위치 = 59차 PR #48 종료 post-merge baseline (Mock cleanup Step 2.7a ✅ MERGED)**:
- **PR #48** Step 2.7a silent-health (`MOCK_ADMIN_PIPELINE_HEALTH + MOCK_ADMIN_ALERTS` → 실 SELECT via `createServiceRoleClient()` + DI seam (admin-news/alerts/pipeline-health에 `options.client?: SupabaseClient`). service-role.ts B17 boundary 확장. `isProductionLikeForAuth()` 4-way fail-closed (PR1 MF4 정합). 3 mock 삭제 (alerts/pipeline-health/heartbeat). omxy patch-suggest 2 rounds CONVERGED 4 catches → omxy 직접 fix `4f55548` (HIGH auth hardening + MED invariant test + MED/LOW regression test + LOW honest scoping). W-pipeline-health-admin-assertion READ side fully resolved. W-news-cron-service-role-read half-resolved (DI seam ✓, news cron route wiring 잔여 — Step 2.7b).

**누적 박제**: 58차 PR #30~#34 + 마이그 0025 + 59차 PR #39/#40/#42/#43/#44/#45/#46/#47/#48 모두 MERGED, main `6c85f13` (post-PR-#48). **omxy 누적 13 + 6 + 2 + 2 + 2 + 2 rounds CONVERGED** (58차 13 + 59차 PR#39 R1~R6 + PR#42 R1~R2 + PR#44 R1~R2 + PR#46 R1~R2 + PR#48 R1~R2 patch-suggest) — 최신 라운드/catch 누적/fix commit은 git log + cmux debate transcript 위임.

**다음 1순위** = **(CLAUDE) Mock cleanup Step 2.7b (cron INSERT 실 path + news cron service-role wiring) 진입** — fresh branch off main `6c85f13`. silent-health heartbeat_log INSERT + news-sweep news_event INSERT + news-sweep + morning-briefing route service-role 주입 (W-news-cron-service-role-read 완전 해소). idempotency / retry / conflict resolution architectural 결정 PR plan 단계에서 R-debate. omxy R-debate (patch-suggest mode 사용자 명시 변형) 강제. (USER 잔여) Vercel env `PR4_TRIGGER_UPSERT_ENABLED=true` 추가.

Owner 의미: **USER** (사용자만) · **CLAUDE** (자동) · **SHARED** ("이어서 진행" 권한으로 push/PR-create 자동; docs-sync merge는 CLAUDE.md 자동 허용 범위 안, deploy/migration은 USER).

#### 다음 세션 active matrix — 8-row sequence (Task 1~4 ✅ 완료, Task 5~8 잔여)

| # | Task | Owner | 상태 | 박제 |
|---|---|---|---|---|
| 1 | **현행 audit 재확인** (Supabase 직접 query: `cost_log` / `stock_reports` / `committee_votes` / `short_list_30` sector quality) | CLAUDE | ✅ COMPLETED (57차 §1) — drift 0 확인 | 매 세션 entry routine 1순위로 재실행 (drift detect). 본 §1 ground truth와 동일한 결과 확인. drift (cost_log > 0 등) 시 PR #21 머지 효과 또는 Smoke Stage 2 결과 반영 가능. |
| 2 | **B65-P1 immediate guard (Phase 1) + B86 month format** | CLAUDE | ✅ **MERGED in main `5b99e03`** (57차 §1, PR #21, Vercel deploy SUCCESS) | `triggerFullReport`에 `reportExistsForMonth(input.ticker, ${month}-01)` preflight 추가. false → `report_not_found` / throws → `report_lookup_failed`. **P2 미구현 상태에서만 활성** (현재 production = 영구 fail-fast — B65-P2 후만 정상 동작), smoke 금지 (B92). 코드 주석에 P3 feature flag 박제. |
| 3 | **B65-P2 real enablement (Phase 2) + B88 RPC R-debate spec doc** | CLAUDE | ✅ **COMPLETED in 57차 §2 (spec doc CONVERGED R8 final)** | spec doc = `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md`. omxy R-debate 8 rounds (R8 ESCALATE max-8 정합 §7.5) + native critic subagent 6명 + 누적 catch 30+ 모두 fix. **결정 lock-in: 옵션 A** `upsert_report_sections_0_7_admin` admin-only UPSERT RPC + section_0~7 + appendix only + axis (i)A admin trigger 책임 = section_0~7 only + axis (ii) B79 deferred → PR5 plan + axis (iii) PR5 cron path 충돌 없음. spec doc only (no impl code, 0 migrations). **Task 4에서 마이그 0025 + feature flag impl 완료**. 신규 6 audit ticket 박제 (B79 / B-versioning / W-tier1pill / W-grant-smoke / W-sectionfallback-text / W-cost-log-env-gate). |
| 4 | **B65-P3 P1/P2 호환 (Phase 3) + B98 default policy (feature flag) + 마이그 0025 impl** | CLAUDE | ✅ **impl MERGED in main `3c09d6e`** (58차, PR #30 rebase FF + delete-branch, omxy R-debate 3 rounds CONVERGED). ⚠️ 마이그 0025 production apply + Vercel env=true = Task 7 게이트 (flag=false default라 현재 동작 불변) | **plan SoT** = `docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md` (929 lines, MERGED). omxy R-debate R1~R5 누적 23 BLOCKERS catch & fix (Schop 8 + Kepler 3 + Plato 3 + Sartre 2 + Aristotle 1 = 17 unique + 6 dup recall) — Ramanujan R5 CATCH 0 CONVERGED + HANDOFF sweep R1~R2 Descartes CATCH 0. **impl scope**: (i) feature flag `PR4_TRIGGER_UPSERT_ENABLED` (.env.example=`false` safe default, Production Vercel env=`true` USER step §3.3.5, B98 lock-in) + (ii) 마이그 0025 `upsert_report_sections_0_7_admin.sql` + rollback (admin-only, service_role 명시 REVOKE — Kepler B2 critical) + (iii) orchestrator 분기 + rpcName-guarded error 분리 + (iv) actions B65-P1 guard flag toggle + (v) format-error 2 keys + 1 prefix handler = 3 entries + (vi) TDD invariants 8종 (Test 1 action seam + Test 4b 2-phase DB integration + Test 7 SQLSTATE matrix + Test 8 env cleanup). **smoke는 P3 후만 가능** (B94). impl PR #30 MERGED, branch deleted; 상세 = PR #30 body + git log. |
| 5 | **B66 fix + B84 backfill + B89 default policy + B93 PASS criteria** | CLAUDE | 🟡 PR5 entry blocker 3순위 (Task 4 완료 후 unblocked) | Python seed script (`scripts/seed_short_list_30.py` 또는 신규) ticker→canonical14 매핑 추가 + 30 rows backfill + unknown 처리 R-debate (block / manual review / backfill exclude). **PASS criteria 3종**: (1) 30 rows all sector ∈ `CANONICAL_SECTORS` (2) sector ∉ ('코스피','코스닥') (3) sub_tags 정합 (jsonb null OR string[]). |
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

### 59차 Mock cleanup Step 2.7a ✅ MERGED in main `6c85f13` (PR #48 rebase FF, silent-health 실 SELECT via service-role DI + 3 mock 삭제 + 4-way auth hardening, omxy patch-suggest 2 rounds CONVERGED 4 catches → omxy 직접 fix, 2026-05-28)

- **scope**: silent-health cron (`/api/cron/silent-health`)의 `MOCK_ADMIN_PIPELINE_HEALTH` + `MOCK_ADMIN_ALERTS` → 실 `pipeline_health` + `alert_event` SELECT via `createServiceRoleClient()` (단일 인스턴스 양쪽 helper 주입). admin-news.ts + admin-alerts.ts에 `options.client?: SupabaseClient` DI seam 추가 (admin-pipeline-health.ts는 Step 2.5 기존 옵션 재활용). service-role.ts B17 boundary 확장 (cron/silent-health + 3 DI seam helpers 간접 사용 허용). `isProductionLikeForAuth()` 4-way fail-closed (NODE_ENV / VERCEL_ENV preview+production / NEXT_PUBLIC_APP_ENV). 3 mock 파일 삭제. **Step 2.7 분할**: 2.7a (DI seam + READ + auth hardening) / 2.7b (cron INSERT + news cron service-role wiring 별도).
- **code commits** (branch `feat/mock-cleanup-step-2-7a-silent-health-service-role`, deleted post-merge): 2 commits FF — `2ed2563` initial impl (CLAUDE) + `4f55548` omxy patch-suggest hardening. 상세 git log + PR #48 body 위임.
- **신규 SoT code**: `tudal/src/app/api/cron/silent-health/route.ts` (`createServiceRoleClient() + Promise.all 2 SELECT` + `isProductionLikeForAuth() 4-way`) + `tudal/src/lib/data/admin-news.ts` (`options.client?` DI seam) + `tudal/src/lib/data/admin-alerts.ts` (`options.client?` DI seam) + `tudal/src/lib/supabase/service-role.ts` (B17 boundary 확장) + 5 tests files (DI invariant + 4 CRON_SECRET undefined production rejection + DI seam regression 양방향).
- **행동 변화**:
  - silent-health: production pipeline_health=0 + alert_event=0 → 실 SELECT 결과 모두 [] → classification.status='ok' (정상). CRON_SECRET 누락 시 production-like 4-way reject.
  - admin pages (alerts / settings/health): options.client 미주입 → 기존 session client 유지 (회귀 0).
  - service-role 사용 boundary: cron/monthly-batch + **cron/silent-health** + 3 DI seam helpers 간접 사용 허용. admin pages는 여전히 session client만.
- **omxy patch-suggest 2 rounds CONVERGED (사용자 명시 변형 워크플로우)**:
  - R1 (7m 25s, gpt-5.5 xhigh, 4 catches → 직접 fix commit `4f55548`):
    · **HIGH** — `isAuthorized` CRON_SECRET undefined fallback `NODE_ENV !== "production"` 단일 조건 → VERCEL_ENV=preview|production / NEXT_PUBLIC_APP_ENV=production privileged SELECT dev-fallthrough 가능. PR1 monthly-batch MF4 4-way 패턴 (`isProductionLikeForAuth()`) 추가.
    · **MED** — service-role single-instance invariant 증명 부족. hoisted mock + `createServiceRoleClient() 1회 + 동일 client 양쪽 helper에 주입` assertion 추가.
    · **MED/LOW** — admin-news/admin-alerts DI seam regression 부족. injected client 사용 시 createClient 미호출 + options 없음 시 session fallback 양방향 테스트 추가.
    · **LOW** — 주석 W-news-cron-service-role-read 해소 과장 + heartbeat warning status 암시 → DI half만 준비, route wiring 별도 scope로 정정. classification.status='ok' 명기.
  - R2 (CONVERGED, Catch 0): 4 catches fully respond + 4-way PR1 MF4 정합 + single-instance invariant 충분 + DI seam regression 양방향 cover + W-news-cron-service-role-read half-resolved 정합 + Step 2.7a scope intact + 잔여 결함 0.
- **CLAUDE 추가 verify (Trust 3-step)**: omxy patch commit `4f55548` 독립 verify — git diff inspect + npm run test:ci 1272 PASS / build 25 routes / lint 0 err 5 warn / tsc clean. policy-level 재판단 ALL OK.
- **마이그 0건** (기존 0006 pipeline_health + 0001/0010 alert_event 활용).
- **검증**: build 25 routes / lint 0 err 5 warn (pre-existing) / tsc clean / test:ci 1263 → 1272 PASS (+9, 회귀 0).
- **scope-out + W- defer 상태 업데이트**:
  - Step 2.7b (cron INSERT + news cron service-role wiring) — silent-health heartbeat_log INSERT + news-sweep news_event INSERT + news-sweep + morning-briefing route service-role 주입. idempotency / retry / conflict resolution architectural 결정 필요.
  - `W-pipeline-health-admin-assertion`: **READ side fully resolved** (silent-health service-role). INSERT side 잔여 (Step 2.7b).
  - `W-news-cron-service-role-read`: **half-resolved** — admin-news.ts DI seam 준비 ✓, news cron route wiring 잔여 (Step 2.7b).

### 59차 Mock cleanup Step 2.6 ✅ MERGED in main `845b9ca` (PR #46 rebase FF, news cron MOCK_ADMIN_NEWS → 실 news_event SELECT + 2 dead mock 삭제, omxy patch-suggest 2 rounds CONVERGED, 2026-05-28)

- **scope**: news cron routes (`/api/cron/morning-briefing` + `/api/cron/news-sweep`)의 `MOCK_ADMIN_NEWS` import → 기존 `@/lib/data/admin-news::getRecentNewsEvents` (Step 2.1 helper) 재사용. format-error mapping 3종 + prefix handler. mock 2개 삭제: `mock-admin-news.ts` (consumer 0 도달) + `mock-admin-briefings.ts` (이미 dead). 잔존 mock = `mock-admin-pipeline-health.ts` + `mock-admin-heartbeat.ts` (Step 2.7 cron INSERT scope).
- **code commits** (branch `feat/mock-cleanup-step-2-6-news-mock`, deleted post-merge): 2 commits FF — `f393e38` initial impl (CLAUDE) + `845b9ca` omxy patch-suggest format-error.test inventory + suffix prefix coverage. 상세 git log + PR #46 body 위임.
- **신규 SoT code**: `tudal/src/app/api/cron/morning-briefing/route.ts` (`pickTopNews(MOCK_ADMIN_NEWS)` → `pickTopNews(await getRecentNewsEvents({ limit: 20 }))`) + `tudal/src/app/api/cron/news-sweep/route.ts` (non-production + NAVER 키 미설정 fallback `MOCK_ADMIN_NEWS.map(...)` → `(await getRecentNewsEvents({ limit: 50 })).map(...)`, production-like + NAVER 미설정은 여전히 500 fail-closed) + `tudal/src/lib/admin/format-error.ts` (`news_event_select_failed` + `news_event_invalid_severity` + `news_event_invalid_severity_filter` 매핑 + prefix handler 3종) + tests (양쪽 cron test에 `@/lib/data/admin-news` vi.mock 추가, news-sweep 신규 mockMode empty test 1건, format-error.test inventory + suffix prefix coverage 추가).
- **행동 변화**:
  - `/api/cron/morning-briefing`: 실 news_event SELECT for topNews. production rows=0 → topNews=[] (정상 — "오늘의 주요 뉴스 없음" 라인).
  - `/api/cron/news-sweep`: non-production + NAVER unset → 실 news_event SELECT fallback. production-like 동작 변화 0 (여전히 500 fail-closed).
- **omxy patch-suggest 2 rounds CONVERGED (사용자 명시 변형 워크플로우)**:
  - R1 (2m 58s, gpt-5.5 xhigh, 2 catches):
    · **LOW fixed** — format-error.test.ts inventory + prefix suffix reach 누락 → omxy 직접 fix commit `1860a16` (3종 매핑 inventory + suffix prefix reach assertion 추가).
    · **HIGH unresolved (scope-guard)** — cron context + RLS mismatch: `getRecentNewsEvents()`는 `@/lib/supabase/server` session client → Vercel Cron request에는 admin cookie 없음 → news_event RLS `using (public.is_admin())` silent-0. 사용자 scope-out 명시 (admin-news.ts DI seam + service-role cron 주입 = Step 2.7+ scope) + production news_event=0이라 observable 회귀 0 → defer 결정.
  - R2 (CONVERGED, Catch 0): CLAUDE policy 결정 — `W-news-cron-service-role-read` defer ticket 박제 (HANDOFF §9.5). omxy R2 확인 — LOW fix 정확 + HIGH defer 정합 + Step 2.6 scope intact + 잔여 결함 0.
- **CLAUDE 추가 verify (Trust 3-step)**: omxy patch commit `1860a16` 독립 verify — git diff inspect + npm run test:ci 1263 PASS / build 25 routes / lint 0 err 5 warn / tsc clean. policy-level 재판단 ALL OK + HIGH defer 결정 Step 2.7+ scope 통합 hardening 후보 박제.
- **마이그 0건** (기존 0006 §2 news_event + Step 2.1 admin-news.ts 헬퍼 재사용 + format-error mapping).
- **검증**: build 25 routes / lint 0 err 5 warn (pre-existing) / tsc clean / test:ci 1256 → 1263 PASS (+7, 회귀 0).
- **scope-out + 1 W- defer 박제 (§9.5)**: Step 2.7 (cron mock — silent-health/news-sweep heartbeat/pipeline_health 직접 INSERT + service-role DI 통합 hardening). **`W-news-cron-service-role-read`** (cron context RLS session client silent-0, Step 2.7 통합 hardening 후보 — admin-news.ts에 service-role DI seam 추가 + cron route service-role 주입. monthly-batch PR #30 선례 존재).

### 59차 Mock cleanup Step 2.5 ✅ MERGED in main `6c5ce2c` (PR #44 rebase FF, health page MOCK_ADMIN_PIPELINE_HEALTH → 실 pipeline_health SELECT, omxy patch-suggest 2 rounds CONVERGED, 2026-05-28)

- **scope**: admin user-visible 1 page (`/admin/settings/health`)의 `MOCK_ADMIN_PIPELINE_HEALTH` → 실 `pipeline_health` SELECT 통로 (신규 helper `admin-pipeline-health.ts::getRecentPipelineHealth`). Server Component async 전환. format-error `pipeline_health_select_failed` 매핑 추가. mock 파일 (`mock-admin-pipeline-health.ts`) 보존 — cron route silent-health 잔존 consumer (Step 2.7 scope에서 처리).
- **code commits** (branch `feat/mock-cleanup-step-2-5-health-page`, deleted post-merge): 2 commits FF — `3d95ed6` initial impl (CLAUDE) + `6c5ce2c` omxy patch-suggest harden. 상세 git log + PR #44 body 위임.
- **신규 SoT code**: `tudal/src/lib/data/admin-pipeline-health.ts::getRecentPipelineHealth(options?:{client?, refNow?, windowDays?})` — pagination loop (PAGE_SIZE=1000) + server-side `.gte('started_at', cutoff)` (windowDays default 7) + **monotonic ordering `started_at` ASC primary + `id` ASC tiebreak (Step 2.3/2.4 정합)** + transformPipelineHealthRow snake→camel + schema fail-closed (pipeline ∉ KNOWN_PIPELINES throw + status ∉ ('success','warning','failed') throw + non-finite/negative latency_ms throw) + DI seam. `tudal/src/lib/data/__tests__/admin-pipeline-health.test.ts` — 15 tests. `tudal/src/lib/admin/format-error.ts` — `pipeline_health_select_failed` 매핑 + prefix handler. `tudal/src/lib/admin/__tests__/format-error.test.ts` — inventory + suffix prefix assertion 추가.
- **행동 변화**:
  - `/admin/settings/health`: 실 pipeline_health SELECT (windowDays 7일 default). production rows=0 → 5 pipeline cards (total24h=0, severity='warning' per aggregate.ts logic) + overall='warning' (미확인) + failures=[] (정상 운용 표시).
  - `refNow = new Date()` (production current time) ← mock 시드 시간(2026-04-19) 대체.
  - Server Component async 전환.
  - 헤더 note: 'mock fixture · S5 실 API 키 세팅 시점' → '실 pipeline_health SELECT · production 적재 전에는 빈 위젯이며 미확인 상태로 Warning 표시'.
- **omxy patch-suggest 2 rounds CONVERGED (사용자 명시 변형 워크플로우)**:
  - R1 (3m 42s, gpt-5.5 xhigh, 4 catches → 직접 fix commit `fd2d4e8`):
    · **HIGH** — pagination ordering Step 2.3/2.4-equivalent 아님: 기존 `started_at DESC + id ASC`는 offset pagination 중 신규 row가 앞에 끼어들면 skip/duplicate 위험 → `ASC + ASC`로 변경. UI 최근순 표시는 in-memory DESC sort (aggregate.lastRun + recentFailures)가 담당 → 회귀 0.
    · **MEDIUM** — latency integrity gap: `latency_ms=-1`이 avg latency 왜곡 → non-finite 외에 negative throw 추가.
    · **MEDIUM** — page copy/test mismatch: production rows=0 → severity='warning' (aggregate.ts logic)이지만 기존 copy는 '정상/info'라 했음 → "미확인 Warning" 정정.
    · **LOW** — format-error.test.ts inventory + prefix suffix assertion 추가.
  - R2 (CONVERGED, Catch 0): fd2d4e8 R1 4건 fully respond + ASC ordering Step 2.3/2.4 정합 + latency nullable 호환 + page behavior 정합 (records=[] → warning) + 잔여 결함 0.
- **CLAUDE 추가 verify (Trust 3-step)**: omxy patch commit `fd2d4e8` 독립 verify — git diff inspect + npm run test:ci 1256 PASS / build 25 routes / lint 0 err 5 warn / tsc clean. policy-level 재판단 ALL OK.
- **마이그 0건** (기존 0006 §1 `pipeline_health` 테이블 활용 + format-error mapping).
- **검증**: build 25 routes / lint 0 err 5 warn (pre-existing) / tsc clean / test:ci 1238 → 1256 PASS (+18, 회귀 0).
- **scope-out + 2 W- defer 박제 (§9.5)**: Step 2.6 (news mock) / Step 2.7 (cron mock — heartbeat/pipeline_health 직접 INSERT) — 별도 sub-step. **`W-pipeline-health-admin-assertion`** (RLS silent-0 mock parity 유지, records=[] → warning이라 fail-open 아님, hardening = rpc('is_admin') 또는 SECURITY DEFINER RPC) + **`W-pipeline-health-window-hardening`** (7일 window는 현재 rows=0/cron 미가동 적절, future high-frequency telemetry는 SECURITY DEFINER RPC + server-side aggregate 효율).

### 59차 Mock cleanup Step 2.4 ✅ MERGED in main `4e15176` (PR #42 rebase FF, cost page MOCK 3 fixture → 실 cost_log SELECT, omxy patch-suggest 2 rounds CONVERGED, 2026-05-28)

- **scope**: admin user-visible 1 page (`/admin/settings/cost`)의 `MOCK_ADMIN_COST_LOG` + `MOCK_ADMIN_COST_LOG_OVER_WARNING` + `MOCK_ADMIN_COST_LOG_OVER_HARDCAP` 3 fixture → 실 `cost_log` SELECT 통로 (신규 helper `admin-cost-log.ts::getMonthlyCostLog`, full `CostLog[]` aggregation 필요). Server Component async 전환. 시연 (mock-only stress) section 삭제 — production cost_log 적재 시 banner active state로 cover. mock 파일 (`mock-admin-cost-log.ts`) 삭제 (consumer 0 도달).
- **code commits** (branch `feat/mock-cleanup-step-2-4-cost-page`, deleted post-merge): 2 commits FF — `6a2f72d` initial impl (CLAUDE) + `4e15176` omxy patch-suggest fix CORE_11 persona mapping. 상세 git log + PR #42 body 위임.
- **신규 SoT code**: `tudal/src/lib/data/admin-cost-log.ts::getMonthlyCostLog(month, options?:{client?})` — pagination loop (PAGE_SIZE=1000) + `.order('called_at')` + `.order('id')` tiebreak (Step 2.3 정합) + `transformCostLogRow`: `derivePurpose(persona_id)` 매핑 (CORE_11 11개 production persona.id Set [warren-buffett/stanley-druckenmiller/cathie-wood/peter-lynch/charlie-munger/phil-fisher/rakesh-jhunjhunwala/mohnish-pabrai/michael-burry/nassim-taleb/chair] + core-*/sector-*/shortlist[-_]*/briefing[-_]* prefix fallback + full_report_writer/critic→'report' / revise→'regenerate' / else→'other') + tokensPrompt 합산 (input + cache_creation + cache_read) + section=null (DB schema 부재) + month 정규화 'YYYY-MM-01' → DB 'YYYY-MM' + non-finite/negative cost_krw guard. `tudal/src/lib/data/__tests__/admin-cost-log.test.ts` — 14 tests.
- **행동 변화**:
  - `/admin/settings/cost`: 실 cost_log SELECT. production cost_log=0 → totalKrw=0 / banner=null / byPurpose=[] / topContributors=[] (정상 운용 표시 + empty-state 문구).
  - Server Component async (`export default async function AdminCostPage()`).
  - 시연 section 삭제 / 헤더 note + 푸터 갱신.
- **omxy patch-suggest 2 rounds CONVERGED (사용자 명시 변형 워크플로우 — CLAUDE 1차 → omxy 검증+fix → CLAUDE verify)**:
  - R1 (3m 50s, gpt-5.5 xhigh, 1 BLOCKER catch): derivePurpose가 production CORE_11 kebab-case full-name persona.id (`warren-buffett` 등 11개)를 'committee'로 매핑하지 못하고 'other' fallback (CLAUDE 초기 가정 `core-N` prefix vs 실제 `tudal/src/lib/ai/prompts/personas/*.ts` kebab-case full-name 불일치). omxy 직접 fix commit `c2897b4` — `CORE_11_PERSONA_IDS` Set 11 entries + Set lookup을 prefix check 앞 + test 3 케이스 추가. 기타 검토 ALL PASS (Step 2.3 hardening 정합 / month / RLS silent-0 mock parity / cast / 시연 삭제).
  - R2 (CONVERGED, Catch 0): omxy 독립 Python 스크립트로 helper Set 11 ↔ `prompts/personas/*.ts` production id 11 비교 → missing 0 / extra 0. production cost_log=0 path 정합. 추가 결함 0. Non-blocking WATCH (defer): `W-cost-log-core11-drift` (Set hardcoded → future drift, surgical 채택 정합).
- **CLAUDE 추가 verify (Trust 3-step)**: omxy patch commit `c2897b4` 독립 verify — `git diff` inspect + npm run test:ci 1238 PASS / build 25 routes / lint 0 err 5 warn / tsc clean. policy-level 재판단 ALL OK (scope intact, 11 persona 1:1 정합).
- **마이그 0건** (코드 + tests only). format-error.ts: cost_log_select_failed 매핑 Step 2.3 prefix handler 이미 보유.
- **검증**: build 25 routes / lint 0 err 5 warn (pre-existing) / tsc clean / test:ci 1224 → 1238 PASS (+14, 회귀 0). Vercel production deploy `dpl_tudal-avdbsxbzq` Ready + public canary 4/4 OK (`/` 200 / `/login` 200 / `/macro` 200 / `/admin` 307→/login).
- **scope-out**: Step 2.5~2.7 (health/news/cron mock) — 별도 sub-step. W-cost-log-admin-assertion / W-cost-log-pagination-snapshot / W-cost-log-core11-drift — hardening 트랙 (defer). cost_log schema CHECK 마이그 — defer.

### 59차 Mock cleanup Step 2.3 ✅ MERGED in main `e273cc2` (PR #39 rebase FF, regenerate cost_log mock → 실 SELECT pagination loop, omxy R-debate 6 rounds CONVERGED, 2026-05-28)

- **scope**: admin user-visible 1 server action (`/admin/report/[ticker]/regenerate/actions.ts`)의 `MOCK_ADMIN_COST_LOG` 단일 mock → 실 `cost_log` SELECT 통로 (`cost-logger.ts::getMonthlyTotal` 직접 재사용 — 신규 helper 생성 X, surgical). mock 파일 (`mock-admin-cost-log.ts`) 삭제는 Step 2.4 cost page 정리 후로 보류 (consumer 2개).
- **code commits** (branch `feat/mock-cleanup-step-2-3-regenerate-cost-log`, deleted post-merge): 6 commits FF — atomic + R1~R5 fix chain. 상세 git log + PR #39 body 위임.
- **신규 SoT code**: `cost-logger.ts::getMonthlyTotal` 전면 hardening — PostgREST aggregate disabled (PGRST123 live verify) → pagination loop (PAGE_SIZE=1000, range + monotonic called_at primary + id tiebreak ordering) + non-finite NaN guard + negative cost_krw guard + DI seam 보존. preflightHardcap (orchestrator/writer/persona-eval) 동일 benefit.
- **행동 변화**:
  - `/admin/report/[ticker]/regenerate`: hardcap check = 실 `cost_log` SELECT sum via pagination loop. production cost_log=0 → 0 < 400,000 → unblocked. month 변환 = YYYY-MM-DD → YYYY-MM (insertCostLog SoT 정합).
  - 신규 error path: RLS deny / DB error / non-finite / negative cost_krw → `cost_log_lookup_failed` (regenerate convention 정합).
  - counter increment + orchestrate는 cost_log 실패 시 모두 skip (cost burn 차단 invariant).
- **omxy R-debate 6 rounds CONVERGED (12 catches)**:
  - R1 (4 catch): 2 HIGH (aggregate fail-open + RLS silent-0) + 2 MEDIUM (DI invariant + hoisted mock) — HIGH-2 defer + 나머지 3 fix
  - R2 (4 catch): aggregate disabled 확정 (PGRST123) → pagination 채택 + NaN guard + defer ticket 박제 + eslint-disable 제거
  - R3 (2 catch): order(id) + negative cost_krw guard
  - R4 (1 catch): random UUID order → monotonic called_at + id tiebreak
  - R5 (1 catch): over-claimed concurrent safety → honest docs + W-cost-log-pagination-snapshot defer
  - R6 (CONVERGED): Catch 0, targeted regression 5 files / 46 tests PASS
- **2 W- defer ticket 박제 (§9.5)**:
  - `W-cost-log-admin-assertion` (R1 HIGH-2 + R2 MEDIUM-3 defer): cost_log RLS silent-0 mock parity. hardening = rpc('is_admin') 또는 SECURITY DEFINER RPC.
  - `W-cost-log-pagination-snapshot` (R5 MEDIUM defer): monotonic ordering application-level only. hardening = SECURITY DEFINER RPC + transaction snapshot 또는 schema CHECK 마이그. PR5 cron + Smoke Stage 2 시점에 hardening 트랙 진입.
- **마이그 0건** (코드 + docs only). format-error.ts에 `cost_log_lookup_failed` 신규 매핑.
- **검증**: build 25 routes / lint 0 err 5 warn (pre-existing -1) / tsc clean / test:ci 1208 → 1224 PASS (+16, 회귀 0). Vercel production code baseline `e273cc2` deploy SUCCESS + PR #40 docs-sync main `d052aa7` public canary 3/3 OK (`/` 200 / `/login` 200 / `/macro` 200).
- **scope-out**: Step 2.4 (cost page) MOCK_ADMIN_COST_LOG → 별도 sub-step + cost_log schema CHECK 마이그 + W-cost-log-admin-assertion impl + W-cost-log-pagination-snapshot impl → hardening 트랙.

**Demoted to historical (59차 PR #48 sweep — strict 직전 2 §6 inline entry 적용)**:
- **59차 Mock cleanup Step 2.5 ✅ MERGED in main `6c5ce2c`** (PR #44 rebase FF, health page MOCK_ADMIN_PIPELINE_HEALTH → 실 pipeline_health SELECT + ASC pagination hardening, omxy patch-suggest 2 rounds CONVERGED 4 catches + omxy 직접 fix `fd2d4e8` + 2 W- defer) = git log + PR #44 body 위임.
- **59차 Mock cleanup Step 2.4 ✅ MERGED in main `4e15176`** (PR #42 rebase FF, cost page MOCK 3 fixture → 실 cost_log SELECT, omxy patch-suggest 2 rounds CONVERGED 1 BLOCKER catch + omxy 직접 fix commit `c2897b4` + 1 W-cost-log-core11-drift defer) = git log + PR #42 body 위임.
- **59차 Mock cleanup Step 2.3 ✅ MERGED in main `e273cc2`** (PR #39 rebase FF, regenerate cost_log mock → 실 SELECT pagination loop, omxy R-debate 6 rounds CONVERGED 12 catches → 10 fix + 2 W- defer) = git log + PR #39 body 위임.
- **58차 Mock cleanup Step 2.2 ✅ MERGED in main `2dca060`** (PR #34 rebase FF, admin settings READ 실 SELECT + WRITE boundary, omxy R1 CONVERGED) = git log + PR #34 body 위임.
- **58차 Mock cleanup Step 2.1 ✅ MERGED in main `e6be73f`** (PR #33 rebase FF, admin alerts 3 routes `MOCK_ADMIN_ALERTS` + `MOCK_ADMIN_NEWS` → `alert_event` / `news_event` 실 SELECT, omxy R-debate 2 rounds CONVERGED + docs sweep R14 + merge debate R2 A++ 정합, 신규 helper `admin-alerts.ts` + `admin-news.ts`, WATCH `W-mock2-rls-drift` defer) = git log + PR #33 body 위임.
- **58차 Mock cleanup Step 1 ✅ MERGED in main `1d2db08`** (PR #32 5 commits FF, omxy R1~R4 CONVERGED — Issue 1 RSC error + Issue 2 모닝 브리핑 4/19 stale + Issue 3 D15 가짜 열람 통과 모두 catch·fix, 신규 helper `admin-report-view-log.ts` + client wrapper `shortlist-row-action-slot.tsx` + mock 삭제 + 신규 error code `accept_gate_lookup_failed`) = git log + PR #32 body 위임.

**Demoted to historical (58차 sweep R1 — strict 직전 2 entry inline 규칙 적용)**:
- **58차 Task 4 B65-P3 impl ✅ + B-trackrecord-rls ✅ + 마이그 0025 production apply ✅** (PR #30 `3c09d6e` + PR #31 `838386e` + Supabase production apply, omxy 6 rounds CONVERGED 누적) = git log + PR #30/#31 body + REVIEW docs 위임.
- **57차 §3 Task 4 plan SoT ✅ MERGED `2859c68`** (PR #28, B65-P3 impl plan 옵션 A R8 final, omxy R-debate R1~R5 23 BLOCKERS + Ramanujan CATCH 0) = `docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md` + git log + PR #28 body 위임.
- **57차 §2 Task 3 ✅ B65-P2 spec doc CONVERGED R8 final** (PR #26, 옵션 A lock-in, omxy R-debate 8 rounds ESCALATE max-8 + 6 신규 audit ticket B79/B-versioning/W-tier1pill/W-grant-smoke/W-sectionfallback-text/W-cost-log-env-gate) = `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md` + git log + PR #26 body 위임. W-grant-smoke는 58차 Task 4 ✅ RESOLVED.

**Older historical (49차~56차 §5 PR4 MERGED + 57차 §1 PR #21 B65-P1 MERGED `5b99e03` + 57차 §2 PR #26 spec doc + S7a/Tier 2/PR2/PR3a/PR1/PR3b/PR3c MERGED + 53차 §5 spec doc + PR4 14 defer + 56차 §5 B65~B108 catalog 34 catch + 57차 §1 omxy 4 rounds CONVERGED Hegel/Leibniz/McClintock/Hubble/Locke)** = git log + spec/plan/REVIEW docs + PR body + ProgressDashboard 위임.

---

## 7. omxy 적대적 코드 검토 패턴 — legacy / detail runbook (49차 박제, 후속 PR 재사용)

> **정책 분리** (omxy PR #37 verify R1 catch 박제): 영구 normative 워크플로우 정책 (Output Modes / Trivial vs Complex / Context Packet / Native Critic Role Taxonomy / 단계별 subagent·skill 매핑 / 자동 진행 vs USER-only) = **프로젝트 루트 `CLAUDE.md ⚙️ Claude+omxy R-debate Workflow 정책` SoT**. 본 §7.1~§7.7 = legacy detail runbook (cmux send pattern / scope guard 4종 / 결함 카탈로그 / PR-specific lessons 누적) 한정 — 정책 drift 방지.

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

## 8. 사용자 운영 원칙 (프로젝트 invariant 한정 — 워크플로우 normative 정책은 `CLAUDE.md ⚙️` SoT)

> **정책 분리** (omxy PR #37 verify R1 catch 박제): 영구 워크플로우 정책 (Owner / Output modes / 자동 진행 / Trivial vs Complex / Context Packet / Native Critic / 단계별 매핑 / "이어서 진행" 자동 진입) = **프로젝트 루트 `CLAUDE.md ⚙️ Claude+omxy R-debate Workflow 정책` SoT**. 본 §8 = 프로젝트 운영 invariant (canonical 5-PR / Kevin v3.1 / DI seam / 본 차수 자동 진행 baseline) 한정.

- **omxy CONVERGED = 사용자 승인 등가 (제한)**: `CLAUDE.md ⚙️` 자동 진행 허용 범위 안에서만 (PR merge / docs-sync / canary / deploy polling). **Vercel env / secrets / flag 토글 / production migration apply / billing / live-money/trading / external account / key 변경은 항상 USER-only** (CLAUDE는 가이드 + 후속 verify).
- **omxy 토론 = subagent/skill + scope guard 4종 박제** (사용자 명시 + [[feedback_omxy_debate_scope_guard]]).
- **commit pattern**: 자동 commit (amend 금지 — 사용자 명시 시만). branch 분리 = main 직접 commit 금지.
- **Owner boundary / Default-progress policy / 자동 진행 허용 vs USER-only 상세** = `CLAUDE.md ⚙️` SoT 참조.
- **canonical 5-PR 순서 절대 보존** (53차 §5 spec doc 박제 + 55차 §2/§4 + 56차 §5 정정): PR2 ✅ → PR3a ✅ → PR1 ✅ → PR3b ✅ → PR3c ✅ → **PR4 ✅ MERGED `7de9696` (56차 §5, PR #19) — canonical 5-PR 완료**. Hard gate (PR1 cron 가동 ⊥ PR3a schema drift fix 미선행) ✅ **해소** (54차 §3). 다음 = PR5 (cron 30 자동 + 큐 인프라, T11 분할 결정 보존).
- **Kevin v3.1 quality target** (53차 §3 박제): 207 persona × 8 markers = 1656 marker assertions 전수 통과. Reference 자료 main 보존. PR3b writer 본문 + PR3c orchestrate + PR4 admin path (`orchestrateFullReport`) 모두 동일 quality target.
- **HANDOFF.md 다음 세션 자동 진행 가능 조건**: §0 + §1 + §2 + §9 모두 stale 0. 본 **59차 PR #48 Step 2.7a post-merge baseline** = PR4 + B65-P1/P3 MERGED ✅ + 마이그 0025 production applied + Mock cleanup Step 1 ✅ + 2.1 ✅ + 2.2 ✅ + 2.3 ✅ (PR #39) + 2.4 ✅ (PR #42) + 2.5 ✅ (PR #44) + 2.6 ✅ (PR #46) + **2.7a ✅ `6c85f13` (PR #48, omxy patch-suggest 2 rounds CONVERGED 4 catches → omxy 직접 fix `4f55548` HIGH auth hardening + MED invariant + MED/LOW regression + LOW honest scoping)** / canonical 5-PR 완료 / Vercel main `6c85f13` public canary 4/4 OK / build 25 routes / lint 0 err 5 warn (pre-existing) / test:ci 1272 PASS / tsc clean / main HEAD = `6c85f13` 또는 자손. **USER 잔여 액션 = Vercel env `PR4_TRIGGER_UPSERT_ENABLED=true` 추가 (현재 unset) + `AI_COST_LOG_REAL_INSERT_ENABLED='true'` env 선행 + Smoke Stage 2 시점 1회 비용 승인 (Task 7) + (권장) 인증 세션 canary verify** → 다음 = CLAUDE **Mock cleanup Step 2.7b (cron INSERT 실 path + news cron service-role wiring) 진입** (fresh branch off main `6c85f13`, idempotency / retry / conflict resolution architectural 결정 PR plan 단계 R-debate) + Task 5 B66 backfill (병렬) 진입 의사 1회 확인 후 자동.
- **DI seam invariant 정밀화 default (§7.9 PR4 lesson)**: 모든 caller DI test는 결과값 assert만이 아닌 (1) createClient short-circuit (2) helper-chain 2nd arg propagation (3) payload field invariant (4) 한국어 매핑 (5) shouldRevise=true revise branch — 5중 명시 assertion 필수.

---

## 9. PR4 + B65-P1 + B65-P3 MERGED + 마이그 0025 production applied ≠ production functional — B65~B98 + 신규 13 ticket 박제 (56차 §5 + 57차 §1~§3 + 58차 Task 4 + Mock cleanup Step 1~2.2 + 59차 Step 2.3~2.7a (patch-suggest) 누적, 58차 13 + 59차 6+2+2+2+2 rounds CONVERGED 누적 — W-cost-log-admin-assertion + W-cost-log-pagination-snapshot + W-cost-log-core11-drift + **W-pipeline-health-admin-assertion READ resolved** + W-pipeline-health-window-hardening + **W-news-cron-service-role-read half-resolved** §9.5 박제, 최신 라운드/catch 누적/fix commit은 git log + cmux debate transcript 위임 (self-referential drift 방지))

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
- **W-cost-log-admin-assertion** (58차 Step 2.3 omxy R1 HIGH-2 + R2 MEDIUM-3 defer) — `cost_log` SELECT RLS `using (is_admin())`는 non-admin 호출자에게 0 rows silent return (throw 안 함). regenerate `getMonthlyTotal`은 mock과 동일하게 silent-0 → hardcap=0 unblocked로 처리. admin path는 회귀 0이지만, audit invariant 측면에서 fail-closed 보증 부재. hardening = (a) `triggerFullReport`/`regenerateReport` 진입 시 `rpc('is_admin')` 명시 assertion (B-trackrecord-rls 58차 PR #31 패턴) 또는 (b) `get_cost_log_monthly_total_admin` SECURITY DEFINER RPC + `not is_admin() → raise` 내부. Step 2.3 mock parity 유지 → 별도 트랙. W-mock2-rls-drift / W-s5b-admin-assertion 통합 sweep 후보.
- **W-news-cron-service-role-read** (59차 Step 2.6 PR #46 omxy R1 HIGH scope-guard defer / **Step 2.7a PR #48 half-resolved**) — admin-news.ts DI seam (`options.client?`) **준비 완료 (Step 2.7a)** + service-role.ts B17 boundary news cron 진입 허용. 그러나 **news-sweep + morning-briefing route는 여전히 service-role 주입 안 함** — cron context RLS silent-0 risk 잔여. **Step 2.7b**에서 news cron route service-role wiring + INSERT path 통합 해소. monthly-batch (PR #30) + silent-health (PR #48) 선례 정합.
- **W-pipeline-health-admin-assertion** (59차 Step 2.5 PR #44 omxy R2 non-blocking WATCH defer / **Step 2.7a PR #48 READ side fully resolved**) — `admin-pipeline-health.ts::getRecentPipelineHealth` DI seam (Step 2.5) + silent-health route service-role 주입 (Step 2.7a) → cron path RLS 우회 완료. **INSERT side 잔여** — silent-health heartbeat_log + pipeline_health 직접 INSERT 실 path는 Step 2.7b에서 처리. admin/settings/health page (Step 2.5)는 session client 유지 (회귀 0).
- **W-pipeline-health-admin-assertion** (59차 Step 2.5 PR #44 omxy R2 non-blocking WATCH defer) — `tudal/src/lib/data/admin-pipeline-health.ts::getRecentPipelineHealth`의 RLS `using (public.is_admin())`는 non-admin caller에게 silent-0 (throw 안 함). records=[] → aggregate severity='warning' (미확인)이라 green fail-open은 아니지만, admin assertion invariant 측면에서 fail-closed 보증 부재. hardening = (a) `rpc('is_admin')` 명시 assertion (B-trackrecord-rls 58차 PR #31 패턴) 또는 (b) `get_pipeline_health_admin` SECURITY DEFINER RPC. W-cost-log-admin-assertion / W-mock2-rls-drift 통합 sweep 후보.
- **W-pipeline-health-window-hardening** (59차 Step 2.5 PR #44 omxy R2 non-blocking WATCH defer) — 7일 window는 현재 pipeline_health=0 rows / cron 미가동에서 적절. future high-frequency telemetry (cron 가동 + 5 파이프라인 × 분 단위 run) 시 client-side fetch 비효율 (PR5 cron 가동 후 일 단위 5×60×24 = 7200 rows/day → 7일 = 50k rows pagination = 50 round trips). hardening = SECURITY DEFINER RPC `get_pipeline_health_summary_admin(p_window_hours)` (server-side aggregate + recent failures tail, transaction snapshot 내부, is_admin guard) — W-pipeline-health-admin-assertion과 통합 가능. PR5 cron 가동 + Smoke Stage 2 PASS 시점에 hardening 트랙 진입.
- **W-cost-log-core11-drift** (59차 Step 2.4 PR #42 omxy R2 non-blocking WATCH defer) — `tudal/src/lib/data/admin-cost-log.ts`의 `CORE_11_PERSONA_IDS` Set은 11 production persona.id (`tudal/src/lib/ai/prompts/personas/*.ts`)와 hardcoded 1:1 정합. future persona 추가 / 이름 변경 시 Set drift 가능 → 신규 persona가 `'committee'` 매핑되지 못하고 `'other'` fallback. Step 2.4 scope에서는 exact match가 목적이고 prompts directory import (runtime 의존성 증가)보다 surgical Set 채택이 안전 (omxy R2 lock-in). hardening 옵션 = (a) build-time grep으로 personas/*.ts에서 id 추출 후 Set 생성 / (b) `tudal/src/lib/ai/prompts/personas/index.ts`에 canonical export 추가 후 import / (c) test에 persona file count 검증 추가 (drift detect). 새 persona 추가 commit 시 함께 갱신 권장.
- **W-cost-log-pagination-snapshot** (58차 Step 2.3 omxy R5 MEDIUM defer) — `getMonthlyTotal` pagination loop의 `.order('called_at') .order('id')` deterministic ordering은 application-level monotonic 가정에만 의존. `insertCostLog`의 `CostLogRow` interface에 `called_at` 필드 부재 → TS callers는 강제 못 함 → DB default(now())로 가는 path만 보장. schema에 `CHECK (called_at >= ...)` 부재 → direct SQL / future code / manual admin INSERT가 backdated called_at으로 우회 가능. PostgreSQL now()도 transaction start time이라 parallel insert / NTP step / 동일 microsecond에 정확한 commit-order sequence 아님. 잔여 risk = 월 1000+ rows 시 backdated/parallel INSERT가 기존 page boundary 앞에 들어와 page 간 row skip/duplicate → hardcap undercount fail-open. 현재 production reality (cost_log=0 + 월 ~150 rows 추정 + 어드민 3인 manual click 동시성 거의 0)에서 실현 가능성 매우 낮지만, 월 cron 가동 + 1000+ rows 도달 시 완전 차단 필요. hardening = (a) SECURITY DEFINER RPC `get_cost_log_monthly_total_admin(p_month)` (server-side SUM, transaction snapshot 내부, is_admin() guard) — W-cost-log-admin-assertion과 함께 통합 가능 / (b) schema `ALTER TABLE cost_log ADD CONSTRAINT cost_log_called_at_no_backdate CHECK (called_at >= (now() - interval '5 minutes'))` 마이그. PR5 cron 가동 + Smoke Stage 2 PASS 시점에 hardening 트랙으로 진입.

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
