# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-31 — **HANDOFF 단일화·정리** (Claude↔omxy §2.0a 워크플로우, branch `docs/handoff-consolidation`). 비대해진 HANDOFF를 "한눈에 보면 이해되는" 단일본으로 정리: §7 omxy 런북 → `docs/superpowers/omxy-rdebate-runbook.md`, §9 audit 카탈로그 → `docs/superpowers/audit-catalog.md`로 분리(이동, §번호 stub 유지), per-PR 역사 행은 git log/PR body 위임. **직전 상태 = 62차 §2.0a PR5 pre-merge review**(branch `feat/pr5-cron-monthly-report-worker` @ `d4d6d9a`, UNMERGED ready-but-gated). 그 이전 = 60차 §5 Task 5 B66 PRODUCTION COMPLETE.

> **이 파일 하나로 다음 세션이 진입 가능하도록 작성됨.** SHA·라운드 수·commit 체인은 self-drift 위험이 크므로 freeze 금지 — `git rev-parse --short origin/main` + `git log` + PR body로 runtime verify.

---

## 한눈에 (현재 상태 + 다음 행동)

**지금 어디**: canonical 5-PR(PR1~PR4) + Mock cleanup Step 1~2.7b.3 + B65-P1/P2/P3 + Task 5 B66 **production 모두 완료**. 다음 큰 단위 = **PR5(cron 30종목 월간 리포트 자동 생성)**. PR5 plan+impl+62차 pre-merge review는 branch에 **ready-but-gated**(미머지). 가동 = **USER 게이트 a~e** 필요.

**main HEAD**: `git rev-parse --short origin/main` (62차 docs-sync 기준 `3e4886c`; 본 정리 브랜치 머지 후 자손).
**PR5 branch**: `feat/pr5-cron-monthly-report-worker` @ `d4d6d9a` (local solo, 미push, UNMERGED). branch 게이트 ALL GREEN(build 26 / lint 0err 5warn / test:ci 123 files 1376 PASS / tsc clean).
**OPEN PR**: **#2**(format-error, CONFLICTING 보류) only.
**Production**: 마이그 0001~0026 applied · short_list_30 = 30 rows canonical 14 only(B93 PASS) · Vercel env `PR4_TRIGGER_UPSERT_ENABLED=true` + `AI_COST_LOG_REAL_INSERT_ENABLED=true` · public canary 3/3 OK · **실 AI 호출 0건**(cost_log=0, 첫 호출은 Task 7 비용 승인 후).

**다음 액션 큐** (§2.0a 워크플로우 순서로 진행 — ①Claude 1차 → ②omxy 검증 → ③omxy 수정 → ④Claude 2차검증):

1. **[USER] PR5 가동 게이트 a~e** (모두 production external — CLAUDE는 가이드/체크리스트만, 실행 X):
   - **(a) Task 7 Smoke Stage 2** — 1회 비용 승인(~5,000~6,000원) 후 단일 실 AI 리포트 검증. canonical 순서상 batch 자동화 **선행**.
   - **(b) 마이그 0027 production apply** (Supabase, USER OAuth) — `report_batch_job` + `report_worker_run` + 5 RPC.
   - **(c) `cron-system` auth.users 1회 seed** → 그 UUID를 Vercel env `CRON_SYSTEM_USER_ID`에 입력 (cost_log.called_by FK).
   - **(d) Vercel env**: `CRON_SYSTEM_USER_ID=<seed UUID>` + `PR5_CRON_AUTO_ENABLED=true` + (옵션) `PR5_CRON_SELF_CONTINUE`.
   - **(e) Vercel plan tier 확인** (62차 OPS-1, 유일한 OPEN finding): `vercel.json` 신규 `functions.maxDuration:300`이 Hobby면 60s로 silent cap → chunk mid-flight kill (정확성은 daily-cron fallback 유지, throughput 저하). Pro 업그레이드 또는 chunk를 60s 내로 조정.
2. **[CLAUDE] USER 게이트 충족 후 자동**: PR5 branch push + PR create → §2.0a(omxy 검증→omxy 수정→Claude 2차검증) → rebase FF merge + delete-branch + canary + HANDOFF sync. **머지 전까지 main 불변.**
3. **[USER, 비차단]** PR #54 §5.3 preflight (Supabase re-auth 후 alert_event CHECK + briefing_log date UNIQUE) + 인증 세션 canary.
4. **[CLAUDE] PR5 머지·가동 후**: Task 8 audit(→ `docs/superpowers/audit-catalog.md`) + **PR5b**(committee_votes + Section 8 full path, **D11 운용 검증 전 land 강제 hard gate**) + Step 4 Reflection.

**ACTIVE blocker / W-ticket** (full catalog → `docs/superpowers/audit-catalog.md`):
- **OPS-1** (open) — 위 (e) Vercel plan tier. 비차단(정확성 영향 0)이나 가동 전 확인 권장.
- **W-alert-event-dedup** — alert_event partial unique index, 다음 마이그 슬롯(0028+).
- **W-portfolio-snapshot-real** — S7b morning-briefing portfolioSnapshot 실 SELECT.
- **W-tier1pill** — Section 8 absent 리포트 = Tier 1 평가 대기 pill UI (D11 운용 검증 acceptance gate).

> **실 AI trigger/cron 가동은 Task 7 USER 비용 승인 + 게이트 전 절대 금지** (~5,000~6,000원/회 burn).

---

## 0. 세션 시작 루틴 (verify + auto-progress)

```bash
cd /Users/yong/New_Project_KR_Stock
git fetch origin

# 1) main state (fixed SHA 박제 금지 — runtime verify)
git checkout main && git pull origin main
git rev-parse --short HEAD          # 62차 docs-sync `3e4886c` 또는 자손 (본 정리 브랜치 머지 후)
git status --short                  # clean

# 2) OPEN PRs — #2(format-error CONFLICTING) only 기대
gh pr list --state open --json number,title,headRefName,mergeable

# 3) 검증 게이트 (매 세션 1회)
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit && cd ..
#   main 기준 기대: build 25 routes / lint 0 err 5 warn(pre-existing) / test:ci 1325 PASS / 118 files / tsc clean / Python 87 tests PASS

# 4) production audit 재확인 (Supabase MCP execute_sql 또는 dashboard) — drift detect
#   select count(*) from cost_log;          -- 기대 0 (실 trigger/PR5 실행 전)
#   select count(*) from stock_reports;      -- 기대 0
#   select count(*) from committee_votes;    -- 기대 0
#   select count(*) from short_list_30;      -- 기대 30
#   select sector, count(*) from short_list_30 group by sector order by 2 desc;
#     -- 기대: canonical 14만 / placeholder('코스피','코스닥') 0 / B93 PASS
#   drift(cost_log>0 등) 시 = 누군가 trigger를 눌렀거나 Smoke/cron 실행됨 → §1 ground truth 갱신.
```

### §0.A — PR5 branch 진입 ("HANDOFF 보고 이어서" 시 여기부터)

```bash
git branch --list 'feat/pr5-cron-monthly-report-worker'   # local 존재 확인 (push/PR 전이라 remote 없음)
git rev-parse --short feat/pr5-cron-monthly-report-worker  # 기대: d4d6d9a (62차 §2.0a review-hardened)
git checkout feat/pr5-cron-monthly-report-worker
git log --oneline -6   # d4d6d9a R2 / bd000fb R1 / 7418b1c omxy 0-rows / 5240625 omxy 8 fix / 89bd28d Claude impl
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit && cd ..
#   기대: build 26 routes / lint 0 err 5 warn / test:ci 123 files 1376 PASS / tsc clean
```
- **PR5** = cron monthly-batch report-only worker (기존 30 short_list_30 over `orchestrateFullReport` Section 0~7 자동 생성). plan SoT(branch-only, merge 전 main에 없음): `docs/superpowers/plans/2026-05-29-pr5-cron-monthly-batch-auto.md`.
- **상태**: plan omxy R1~R4 17 catch CONVERGED + impl + 62차 §2.0a 2-round pre-merge review(R1 `bd000fb` 10 fix / R2 `d4d6d9a` deferred 4) = 0 open finding. branch 게이트 ALL GREEN. **main 미머지(gated)**.
- **다음 행동**: 한눈에 §다음 액션 큐 1번(USER 게이트 a~e). 미충족이면 USER에 게이트 보고 + 다음 unblocked CLAUDE step. 충족 시 §2.0a로 push→PR→omxy 검증→omxy 수정→Claude 2차검증→merge.
- **committee_votes / Section 8 full path = PR5b로 분리** (D11 운용 검증 전 land 강제 hard gate, plan §3.2/§9 G2).

### 진입자 자동 행동 (§2.0 default-progress)

1. 위 §0 verify → branch/PR state + 검증 게이트 + production audit 재확인.
2. §2.1 active matrix에서 다음 unblocked step 식별 (현재 = §다음 액션 큐).
3. Owner별: **[CLAUDE]** 즉시 자동(stacked 1세션+ 작업은 진입 의사 1회 확인) / **[SHARED]** "이어서 진행" 권한으로 push·PR-create·docs-sync 자동 / **[USER]** 게이트 a~e + 인증 canary.
4. **USER 직접 묻기 게이트** (§2.0): scope expansion / product spec / risk profile / real-money / cost burn 트리거 / 마이그 production apply / **Vercel env·secrets·flag 토글** / external account / 외부 메시지 / destructive(force push to main, DB drop) / uncertainty ≥ medium.
5. **자동 진행 허용** (omxy CONVERGED + 게이트 ALL GREEN = 사용자 승인 등가, CLAUDE.md ⚙️ 범위): PR merge(rebase FF + delete-branch) / docs-sync PR / 사용자 명시 post-merge docs-only direct commit / canary / deploy polling / branch cleanup.
6. **§7 omxy 적대적 검토 패턴**은 모든 신규 작업 branch에서 강제 (상세 → `docs/superpowers/omxy-rdebate-runbook.md`).

---

## 1. 현재 상태 (current-only; per-PR 역사는 git log + PR body 위임)

| 영역 | 상태 |
|---|---|
| main HEAD | **runtime verify** `git rev-parse --short origin/main` (62차 docs-sync `3e4886c`; 본 정리 브랜치 머지 후 자손). code baseline `f2b24e9`(post-PR-#58). |
| PR5 branch | `feat/pr5-cron-monthly-report-worker` @ `d4d6d9a` — **UNMERGED, ready-but-gated** (local solo). plan+impl+62차 2-round review 완료, 0 open finding. |
| OPEN PRs | **#2**(format-error, CONFLICTING 보류) only. PR #19~#58 + canonical 5-PR 모두 MERGED(상세 git log). |
| 검증 게이트 (main) | build 25 routes / lint 0 err 5 warn(pre-existing) / **test:ci 1325 PASS / 118 files** / tsc clean / **Python 87 tests PASS**. |
| 검증 게이트 (PR5 branch) | build 26 routes / lint 0 err 5 warn / **test:ci 1376 PASS / 123 files** / tsc clean. |
| canonical 5-PR | ✅ 전체 MERGED: PR2 `f85fb69` / PR3a `0813a41` / PR1 `4aa3130` / PR3b `cf68731` / PR3c `b2a902a` / PR4 `7de9696`. |
| B65 3-phase | ✅ P1 `5b99e03` + P2 spec(옵션 A lock-in) + P3 impl `3c09d6e` + 마이그 0025 applied + Vercel env=true → production functional 가능. |
| Task 5 B66 | ✅ **PRODUCTION COMPLETE** (60차 §5): 마이그 0026 + induty 백필 2,766/2,766 + short_list_30 30 rows canonical 14(B93 PASS). placeholder/unresolved 영구 0. |
| 선정 흐름 | spec lock-in: Tier 0 150 → Tier 1 Core 11 AI → 단/중/장 top 10 = 30. 현 production = Tier 0 단독 30(fallback). **PR5 가동 시 메인 path 활성**. |
| 풀 리포트 | PR3b writer Section 0~7 + Section 8 partA/partD + PR3c 3-step + PR4 admin caller + 마이그 0025 RPC + env=true. **functional 가능, last-known audit cost_log=0/stock_reports=0** → Task 7 Smoke Stage 2에서 첫 실 검증. |
| 실 AI 호출 | **현재 0건** (cost_log=0). 첫 실 smoke는 Task 7 USER 비용 승인 후. |
| Supabase | project `rbrpcynhphrpljbjirfo` · **0001~0026 production applied** · SECURITY DEFINER 4-grant 패턴 · dart_corp_codes 2,766/2,766 induty 백필. |
| Vercel canary | code baseline `f2b24e9`; public 3/3 OK (`/` + `/login` + `/macro`). cron route: silent-health 15:00 UTC(heartbeat_log+alert) / news-sweep 00:00 UTC(news_event+alert) / morning-briefing 23:00 UTC(briefing_log+alert) — 전면 INSERT 실 path. 인증 세션 canary 권장. |
| Mock/슬라이스 | Mock ✅ / DQ-7 ~97%(Smoke #4/#5 + Session 4 QA 잔여) / S7e 7/8(T7e.7 RLS QA 잔여) / S7a ✅ / Tier 2 D21 ✅ / cron INSERT mock cleanup Step 2 전체 완료. |

---

## 2. 출시까지 선형 Runbook

### §2.0 Default-progress policy

- 현재 step이 USER-gated면 background blocker로 짧게 보고하고 다음 unblocked CLAUDE step으로 진행.
- runbook이 다음 CLAUDE step을 정의한 경우 반복 질문 금지.
- **자동 진행 허용 vs 항상 USER-only 정책 SoT = 프로젝트 `CLAUDE.md ⚙️ Claude+omxy R-debate Workflow 정책`**. high-level 요약:
  - **자동 허용**(권한 ON + omxy CONVERGED + 게이트 ALL GREEN): PR merge / docs-sync PR / 사용자 명시 post-merge docs-only direct commit / canary / deploy polling / branch cleanup / PR create.
  - **항상 USER-only**(CLAUDE는 가이드 + 후속 verify): Vercel env·secrets·flag / 마이그 production apply / billing / live-money / external account / cost burn 트리거 / 외부 메시지 / destructive(force push to main, DB drop).
  - uncertainty ≥ medium + product spec + scope expansion + new risk profile → 사용자 묻기 강제.
- memory: [[feedback_user_action_auto_progress]] + [[feedback_omxy_debate_workflow]] + [[feedback_no_user_approval_gate]].

### §2.0a — ⭐ Claude↔omxy 작업 워크플로우 순서 (사용자 명시 61차, 강제 적용)

**impl·fix 단계 4-step** (사용자 명시 "1차 수정 Claude / 1차 검증 omxy / 검증후 수정 omxy / 2차검증 Claude"):

| 단계 | 주체 | 내용 |
|---|---|---|
| ① 1차 작업/수정 | **Claude** | impl·변경·문서 1차 작성, branch commit해 baseline diff 확보. |
| ② 1차 검증 | **omxy** | 실 코드/diff 적대적 검토 (agent+skill). 결함 catch. |
| ③ 검증 후 수정 | **omxy** | 찾은 결함 **전부 직접 수정**(direct-edit). 게이트 ALL GREEN 유지 + working tree edit + 요약 보고 (commit은 Claude). |
| ④ 2차 검증 | **Claude** | omxy 수정을 코드 근거로 검증(맹목 수용 X). 잔여 결함 시 ③으로 복귀. clean(잔여 0)일 때 종료 + Claude commit. |

- **plan 단계는 역할 반전**(참고): ①Claude 작성 ②omxy catch-only ③Claude fix.
- **근거**: `CLAUDE.md ⚙️`의 direct-edit mode(60차 §3) 구체화. 61차 PR5 impl에서 실증.
- **omxy 환경/송신**: cmux pair-debate, peer surface runtime discover. 상세 runbook → `docs/superpowers/omxy-rdebate-runbook.md`.
- **USER 게이트는 본 순서와 무관하게 항상 적용** (§2.0).

### §2.1 Step matrix — 8-row (Task 1~5 ✅, Task 7 + PR5 USER gates next)

**현재 위치** = 61차 PR5 plan+impl + 62차 §2.0a pre-merge review 완료, branch ready-but-gated. 이전 "Task 8 PR5 plan 진입"은 본 branch로 완료. 다음 = §다음 액션 큐(USER 게이트 → merge → PR5b). **상세 박제·라운드 수는 git log + PR body + plan docs + `docs/superpowers/audit-catalog.md` 위임.**

| # | Task | Owner | 상태 |
|---|---|---|---|
| 1 | 현행 audit 재확인 (Supabase query) | CLAUDE | ✅ COMPLETED — 매 세션 entry routine 1순위로 재실행 (drift detect) |
| 2 | B65-P1 immediate guard + B86 month format | CLAUDE | ✅ MERGED `5b99e03` (PR #21) |
| 3 | B65-P2 real enablement spec (옵션 A lock-in) | CLAUDE | ✅ spec CONVERGED R8 — `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md` |
| 4 | B65-P3 호환 feature flag + 마이그 0025 impl | CLAUDE | ✅ MERGED `3c09d6e` (PR #30) + 마이그 0025 applied + Vercel env=true |
| 5 | B66 C 하이브리드 + B84/B89/B93 | CLAUDE(위임) | ✅ **PRODUCTION COMPLETE** (60차 §5) — 마이그 0026 + 백필 + 30 rows canonical 14 + B93 PASS |
| 6 | Smoke Stage 1 — non-AI dry-run | CLAUDE | 🟡 optional zero-cost prep (다음 명시 gate는 Task 7) |
| 7 | **Smoke Stage 2 — single real AI** | CLAUDE+USER | ⭐ **다음 1순위 USER gate** — 비용 승인 후 CLAUDE 자동. B85 model id verify 선행. PASS = cost_log + stock_reports + report_critic_findings + UI render |
| 8 | B67~B98 audit + PR5 진입 | CLAUDE | 🟢 PR5 branch ready-but-gated. Smoke Stage 2 + USER gates a~e 후 §2.0a로 merge. PR5b는 D11 전 land hard gate |

### §2.2 ✅ 어드민 출시 게이트 (S9 1개월+ 후 7 criteria)

1. 최소 1개월 운용 (어드민 3인 일일 사용) · 2. BL-KRIT open 0개 · 3. 3인 핵심 플로우 일일 완료(Short List 30→풀 리포트→승인→가상 포트→알림) + disclaimer 전 화면 · 4. cron/health 안정(Silent Health red_alert 0 + success_rate ≥ 99% + canary OK) · 5. 비용 hardcap(월 400,000 KRW 미만 + AI 일 주문 ≤ 20회 + cost_log 정확) · 6. RLS/credential smoke(advisor anon WARN 0 + Smoke #3~#6 + 평문 노출 0) · 7. (자동매매 시) guardrail 위반 0(레버리지 ≤ 5x · 일일 손실 -3% 정지 · AI 일 주문 ≤ 20).

#### 후속 PR + 운영 (PR5 + S7b~S9)

| Step | Owner | Trigger | Default action |
|---|---|---|---|
| **PR5** cron 30 report-only 자동 + β2′ DB job queue | CLAUDE | branch ready-but-gated; merge/golive = Task 7 + USER gates a~e 후 | `orchestrateFullReport` Section 0~7 자동. queue = `report_batch_job` + `report_worker_run` run-mutex, fail = sequential + retry N=2 + summary/cost alert, cost ≈ 16,050원/월. 마이그 0027 + `CRON_SYSTEM_USER_ID` + Vercel PR5 env 필요. **committee_votes/Section 8 = PR5b(D11 전 land hard gate)**. |
| **Step 4 Reflection** | CLAUDE | PR5 cron 가동 + 실 Tier 1 결과 누적 후 | reflection_log 마이그 + Tier 1 context 주입. |
| **Step 7 S7b** 뉴스+브리핑 mock→real | USER(B-7 Resend + B-8 Naver) + CLAUDE | PR5 가동 후 | 실 Naver news sweep + Resend 도메인 인증 + 모닝 브리핑 cron. |
| **Step 8 D11 AI 가상 포트 1차 가동 게이트** | USER 운용 + CLAUDE 모니터링 | S7b 완료 후, S7c 진입 전 | KIS 0개로 어드민 3인 며칠~1주 운용 검증 (의사결정 품질·승인·재생성 cap·뉴스 분류). **S7c/S8 진입 게이트**. |
| **Step 9 S7c** 장중·KIS WS + Exit 2채널 | USER(B-9 Telegram + B-10 KIS) + CLAUDE | D11 검증 통과 후 | 실 alert_event + KIS 본인 1개 WS read-only + J3 Exit 3채널 + 대안 3 + T+7 outcome. |
| **Step 10 S7d** Silent Health | CLAUDE | S7c 완료 후 | 5 파이프라인 success_rate + red_alert 0 + Exit outcome T+7 cron. |
| **Step 11~14 S8** 자동매매 (분리 단독) | USER(B-11 Binance) + CLAUDE | S7d 완료 후 | 주식 KIS + 바이낸스 USDT-M 선물 · Strategy drop-in + AI 어댑터 · 가드레일 + Binance Smoke #3. |
| **Step 15** S9 운용 | USER 1개월+ + CLAUDE hotfix | S8 머지 후 | 어드민 3인 실 사용 + §2.2 7 criteria. |

> PR4 lifecycle (50 BLOCKERS, 3-track Fix-First) 상세 = PR #19 body + git log + spec/plan/REVIEW docs.

---

## 3. 사용자 액션 대기 큐

| 우선 | 작업 | 필요 액션 |
|---|---|---|
| ⭐ PR5 gates a~e | Task 7 비용 승인 / 마이그 0027 apply / cron-system seed + `CRON_SYSTEM_USER_ID` / Vercel PR5 env / plan tier(OPS-1) | 한눈에 §다음 액션 큐 1번 참조 |
| B-1 ~ B-5 (DQ-7) | 친구 비번 + KIS row 정리 + Smoke #4/#5 RLS + Session 4 QA | DQ-7 close 잔여 |
| B-7 | Resend 도메인 인증 | S7b briefing 진입 시 |
| B-8 | Naver key rotate/env | S7b news 진입 시 |
| B-9 | Telegram bot token + admin 3 chat_id | S7c alerts |
| B-10 | KIS 본인 1개 OpenAPI key/account | S7c WS read-only |
| B-11 | Binance key (testnet 우선) | S8 진입 시 |
| B-D11 | D11 AI 가상 포트 며칠~1주 운용 검증 (어드민 3인 만족도 → S7c 진입 승인) | S7b 완료 후, S7c 전 |
| W-tier1pill | Section 8 absent = Tier 1 평가 대기 pill UI (D11 acceptance gate) | Smoke Stage 2 통과 후, D11 진입 전 |
| B-12 | 보안 rotate (Supabase anon/service_role/DB pw/PAT, 노출 키) | 권장 |
| B-13 | Vercel CLI update | 향후 deploy 권장 |
| B-2A | HIBP leaked-password protection 토글 | Supabase dashboard → Auth |

> 해소 historical (B-11/B-12 pr-merge, B-17 계열, B-6 계열) = git log + PR body.

---

## 4. 안전 규칙

- 내부 어드민 투자 운영 도구. Public signup/member/pricing 트랙은 Deferred-D 재개 전까지 만들지 않는다.
- **main 직접 commit 기본 금지** (Vercel auto-deploy 영향). feature branch + PR. 예외: 사용자 명시 post-merge baseline docs-only direct commit(가역, 코드/DB/외부 변경 0).
- billing-on / mock→real API 전환은 USER 트리거 후에만.
- `/admin` 접근 = Supabase session refresh + `ADMIN_EMAILS` allowlist + RLS 3중 방어. `SUPABASE_SERVICE_ROLE_KEY` client-exposed 절대 금지.
- credential plaintext/MEK/ciphertext UI·로그 노출 금지 (서버 측 `src/lib/crypto/aes.ts` 암호화).
- UI 한국어 우선. 새 server action error code = `format-error.ts` 한국어 매핑 추가.
- Next.js 16 routing/middleware/server action 변경 전 `tudal/node_modules/next/dist/docs/` 또는 공식 문서 확인.
- 신규 SECURITY DEFINER 함수 마이그 = 3종 세트 필수: `revoke from public` + `revoke from anon` + `grant to authenticated` (48차).
- PostgreSQL `IF <null>`는 true 아님: RPC guard = `is null or ... is distinct from ...` + `coalesce(v->>'key','') not in ...` 명시 (49차).
- `section_8.partD.vote = BUY/HOLD/SELL literal 유지`. DB 저장 시 RPC가 case 매핑(BUY→approve/HOLD→abstain/SELL→reject). writer 변환 금지 (49차).
- `stock_reports` schema: `generated_at` only(created_at/updated_at 없음), partial unique index `(ticker, month) WHERE is_latest = true` 보존 (49차).
- **canonical 5-PR 순서 절대 보존**: PR2 → PR3a → PR1 → PR3b → PR3c → PR4 (전체 MERGED). PR3c scope = 3-step(analyst pure-code → writer → critic) + conditional revise(1회 hard cap), Q7 invariant document-specialist 0. 재해석 금지.
- **silent null drop metric/log 격상**: `parseSectionSafe`/`parseReportSection8` onError가 console.warn 위임 중. PR5 cron 가동 시점에 metric/structured log로 격상해 production blind spot 차단.

---

## 5. 문서 SoT

> 운영 순서: 본 HANDOFF → spec/plan → Slice/ProgressDashboard → ServicePlan-Admin/ReportFramework → CodebaseStatus → 실행 규칙.

| 필요 정보 | 문서 |
|---|---|
| **omxy R-debate 적대적 검토 runbook** (구 §7) | `docs/superpowers/omxy-rdebate-runbook.md` |
| **Smoke/B66/PR5 audit catalog (B65~B98 + W-ticket)** (구 §9) | `docs/superpowers/audit-catalog.md` |
| PR5 cron monthly-batch plan | `docs/superpowers/plans/2026-05-29-pr5-cron-monthly-batch-auto.md` (PR5 merge 전 branch-only) |
| 53차 §5 정정 spec (canonical 5-PR + Group A-H + Hard gate) | `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md` |
| B65-P2 RPC R-debate spec (옵션 A lock-in) | `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md` |
| B65-P3 feature flag impl plan | `docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md` |
| Task 5 B66 C 하이브리드 plan | `docs/superpowers/plans/2026-05-28-task5-b66-c-hybrid-sector-mapper.md` |
| PR2 plan + REVIEW | `docs/superpowers/plans/2026-05-21-pr2-tier1-screening.md` + `reviews/2026-05-21-pr2-tier1-screening-review.md` |
| PR3a plan + REVIEW | `docs/superpowers/plans/2026-05-22-pr3a-group-h-schema-drift.md` + `reviews/2026-05-22-pr3a-group-h-schema-drift-review.md` |
| S7a Anthropic spec + plan | `docs/superpowers/specs/2026-05-19-s7a-anthropic-wrapper-design.md` + `plans/2026-05-19-s7a-anthropic-wrapper.md` |
| Kevin v3.1 rubric spec | `docs/superpowers/specs/2026-05-21-kevin-v31-rubric.md` |
| Tier 0/1/2 + 합의 배지 + Reflection 본문 | `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D19·D21·D22` |
| Section 8 jsonb canonical contract | `ServicePlan-Admin.md §4.2.1` |
| writer Section 8 작성 가이드 | `Document/Service/Report/ReportFramework.md §8` |
| S7 mock→real Phase/DoD (S7a~S7d + T7e.7 RLS QA) | `Document/Build/Slices/S7-RealData.md` |
| 전체 진행률/변경 이력 | `Document/Build/ProgressDashboard.md` |
| 코드 스냅샷 / 실 I/O 통로 / 잔존 mock | `Document/Process/CodebaseStatus.md` |
| 어드민 서비스 기획 본체 | `Document/Service/Planning/ServicePlan-Admin.md` |
| 슬라이스 실행 규칙 | `Document/Process/ExecutionPlaybook.md` |

---

## 6. 완료/active 이력 (직전 1~2 entry only · older는 git log + PR body)

### 62차 §2.0a — PR5 pre-merge review (branch `feat/pr5-cron-monthly-report-worker` @ `d4d6d9a`, UNMERGED ready-but-gated)

- 61차: PR5 plan(omxy R1~R4 17 catch CONVERGED) + impl(Claude `89bd28d` → omxy direct-fix 8+1 → Claude 2차검증 APPROVED, `7418b1c`).
- 62차: 2-round pre-merge review — R1 `bd000fb`(omxy direct-fix 10: TC-1 cron-upsert RPC 분기 / CRF-1 hardcap defer+best-effort alert / CI-1 worker step-0 `PR5_CRON_AUTO_ENABLED` fail-closed money-safe / OPS-2 lock-leak / TC-2~6 invariant 테스트) + R2 `d4d6d9a`(deferred 4: OPS-3 forward-progress gate / SRC-1·2 mutex·claim 주석 / SRC-3 terminal-state guard). test:ci 1350→1376, 0 open finding.
- **잔여 OPEN = OPS-1** (USER deploy gate (e), Vercel plan tier). CRF-3~6 = verified CLEAN.

### 60차 §5 — Task 5 B66 PRODUCTION COMPLETE (Claude 권한 위임 실행, "권한 다 줄게")

- 누적 6 PR MERGED: PR #53 `a351033` + #54 `50cb94a`(cron INSERT 실 path) + #55 `bbf102d`(plan) + #56 `058a372`(impl) + #57 `bbd33c6`(pagination hotfix) + #58 `f2b24e9`(override 4→7).
- production execution: 마이그 0026 apply → `--backfill-induty` 2,766/2,766 ok → `screen --dry-run`(B89 unresolved 3 catch → override 7) → `--apply` 30 rows. **B93 PASS**(canonical 14만 / placeholder·unresolved 0). 반도체 10 / 에너지 4 / IT/SW 3 / 바이오 3 / 유통·소비재 3 / 2차전지 2 / 자동차 2 / 건설 1 / 금융 1 / 통신 1.
- OMXY R-debate 누적 30+ catches direct-edit CONVERGED.

> 59차 이하 (Mock cleanup Step 1~2.7b.1 / 58차 PR #30~#34 / canonical 5-PR / S7a / Tier 2 등) = git log + PR body + spec/plan/REVIEW docs 위임.

---

## 7. omxy R-debate 적대적 검토 패턴 → 분리됨

> 본 섹션은 `docs/superpowers/omxy-rdebate-runbook.md` 로 **이동**했다 (cmux send pattern / scope guard 4종 / 결함 카탈로그 / fix 패턴 / PR-specific lessons). 영구 normative 정책은 프로젝트 `CLAUDE.md ⚙️ Claude+omxy R-debate Workflow 정책` SoT. 워크플로우 순서(impl·fix 4-step)는 §2.0a 참조.

---

## 8. 사용자 운영 원칙 (프로젝트 invariant 한정)

> 영구 워크플로우 normative 정책(Owner / Output modes / 자동 진행 / Trivial vs Complex / Context Packet / Native Critic / "이어서 진행" 자동 진입)은 프로젝트 `CLAUDE.md ⚙️ Claude+omxy R-debate Workflow 정책` SoT.

- **omxy CONVERGED = 사용자 승인 등가 (제한)**: `CLAUDE.md ⚙️` 자동 진행 허용 범위 안에서만. Vercel env·secrets·flag / 마이그 production apply / billing / live-money / external account / key 변경은 **항상 USER-only**(CLAUDE는 가이드 + 후속 verify).
- **omxy 토론 = subagent/skill + scope guard 4종 박제** ([[feedback_omxy_debate_scope_guard]]).
- **commit pattern**: 자동 commit (amend는 사용자 명시 시만). main 직접 commit 금지 (예외: 사용자 명시 post-merge docs-only direct commit).
- **canonical 5-PR 순서 절대 보존** (§4). **Kevin v3.1 quality target**: 207 persona × 8 markers = 1656 assertions 전수 통과, reference 자료 main 보존.
- **DI seam invariant 정밀화** (PR4 lesson): caller DI test는 (1) createClient short-circuit (2) helper-chain 2nd arg propagation (3) payload field invariant (4) 한국어 매핑 (5) shouldRevise=true revise branch 5중 명시 assertion.

---

## 9. Smoke / B66 / PR5 readiness — ACTIVE blocker (full catalog → audit-catalog.md)

> 전체 B65~B98 + W-ticket + Smoke 2-stage 기준 catalog는 `docs/superpowers/audit-catalog.md` 로 **이동**. 본 stub은 ACTIVE만 유지. Task 8 audit phase에서 항목별 priority 재할당·신규 catch는 그 문서에 직접 갱신. **§9.1~§9.7 하위번호는 audit-catalog.md에 동일 보존** — 코드/문서의 `HANDOFF §9.2/§9.3/§9.5` 등 참조는 거기서 해소.

**ACTIVE blocker / W-ticket**:
- **OPS-1** (open) — Vercel plan tier (한눈에 게이트 (e)). maxDuration:300이 Hobby면 60s cap. 비차단(정확성 영향 0).
- **W-alert-event-dedup** — alert_event partial unique index, 다음 마이그 슬롯(0028+).
- **W-portfolio-snapshot-real** — S7b morning-briefing portfolioSnapshot 실 SELECT.
- **W-tier1pill** — Section 8 absent 리포트 = Tier 1 평가 대기 pill UI (D11 운용 검증 acceptance gate).

**Smoke 2-stage 요약** (상세 = audit-catalog.md §9.4):
- **Stage 1** (cost=0, optional prep): `triggerFullReport`에 mock `orchestrateFullReport` 주입한 P1/P2/P3 호환 invariant TDD.
- **Stage 2** (USER 비용 승인 후 1회): B85 1-token model id verify 선행 → admin UI click/server action 직접 호출. PASS = ① cost_log row ② stock_reports section_0~7 + appendix non-null + zod valid ③ report_critic_findings row ④ (옵션 B) committee_votes ⑤ `/admin/report/[ticker]` 정상 본문/의도된 SectionFallback 렌더(매핑된 에러 메시지 노출도 FAIL). real cost = cost_log 기준 확정(수치 박제 금지).

**B66 production state**: ✅ resolved (60차 §5). placeholder 0 / canonical 14 only 30 rows. 재발 방지 = C 하이브리드(DART induty KSIC longest-prefix → canonical 14 + `sector_override.json` fallback + B89 strict block). PR5 cron 신규 row도 canonical 14 자동 부여.
