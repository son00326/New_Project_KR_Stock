# HANDOFF — 주픽 (JooPick)

Last updated: 2026-06-01 — **실데이터+실AI e2e 트랙 진행 중 (현재 1순위)**. ADR SoT = `docs/superpowers/specs/2026-05-31-realdata-realai-e2e-decisions.md` (11-PR 로드맵 A~K). **AI 30선정 코드 엔진 + 프론트 완성**: PR-A~C + PR-D(tier0_candidates_150) + PR-E(short_list_30 AI 스키마+실 선정 배선+비용가드) + **PR-F(카드 AI 렌더 — 🤖 점수+합의 배지+코멘트, main `69a8d5c`, PR #67)** 모두 MERGED (omxy §2.0a + Workflow 교차검증 + gstack 시각검토 CONVERGED). 마이그 **0028+0029 applied**. 다음 = **PR-G(실 AI 첫 가동)** — ⓐ CLAUDE prep(cron callPersona cost-log service-role DI, 비용0, **다음 세션 CLAUDE 1순위**) + ⓑ USER 게이트(Python 150 시드 + 실 30선정 비용 승인). 실 AI 호출 0회(**선정 엔진·프론트 완성, cron 실경로 prep ⓐ는 CLAUDE 잔여**). **별도 트랙**: PR5(cron 리포트) MERGED-dormant.

> **이 파일 하나로 다음 세션이 진입 가능하도록 작성됨.** SHA·라운드 수·commit 체인은 self-drift 위험이 크므로 freeze 금지 — `git rev-parse --short origin/main` + `git log` + PR body로 runtime verify.

---

## 한눈에 (현재 상태 + 다음 행동)

**지금 어디**: **실데이터+실AI e2e 트랙** 진행 중. **AI 30선정 코드 엔진 + 프론트 완성** — PR-A~C + PR-D(tier0_candidates_150) + PR-E(short_list_30 AI 스키마+실 선정 배선+비용가드) + **PR-F(카드 AI 렌더, main `69a8d5c`)** 모두 MERGED, 마이그 0028+0029 applied. 다음 = **PR-G(실 AI 첫 가동)** — ⓐ CLAUDE prep(cron cost-log service-role DI, 비용0) 후 ⓑ USER 실행/비용 게이트. 실 AI는 아직 0회(선정 엔진·프론트 완성, cron 실경로 prep ⓐ는 CLAUDE 잔여; seed=0이라 현재 trigger는 150-invariant `got 0`에서 AI 전 실패 = cost-safe). 현 카드는 AI 컬럼 null → 전부 "AI 대기" 표시(정상).

**main HEAD**: `git rev-parse --short origin/main` (현재 `69a8d5c` 또는 자손).
**OPEN PR**: **#2**(format-error, CONFLICTING 보류) only.
**검증 게이트**: build 26 routes / lint 0 err 5 warn(pre-existing) / **test:ci 1438 PASS / 126 files** / tsc clean / Python 95.
**Production**: 마이그 0001~**0029** applied (0028 tier0_candidates_150 + 0029 short_list_30 AI 컬럼 8종) · short_list_30 30 rows canonical 14(B93 PASS, AI 컬럼 전부 null = Tier 0 fallback, **AI 선정 아님**) · tier0_candidates_150 0 rows(미시드) · **실 AI 호출 0건**(cost_log=0).

**다음 액션 큐 — 실데이터+실AI e2e (ADR 로드맵, PR별 §2.0a flow)**:

1. **PR-G 실 AI 첫 가동** (다음 1순위 — **ⓐ CLAUDE prep(비용0, 지금 가능) + ⓑ USER 실행/비용 게이트**):
   - **ⓐ [CLAUDE] 지금 가능한 prep (비용 0, USER 대기 불필요)**: cron 실 AI 경로의 `callPersona` cost-log **service-role client DI** 추가 (현재 `insertCostLog`가 session `createClient` → cron `auth.uid()=null`+`called_by` UUID FK로 실패. admin path는 동작, cron만 미동작). + cron route의 `preflightCronBlockedUntilPrG`/`mockCallPersonaPanel`/`persistForCron` 실 배선 준비. §2.0a flow(설계→omxy→gstack 불필요). **이게 다음 세션 CLAUDE 1순위 unblocked step.**
   - **ⓑ [USER] 게이트 (실행·비용)**: Python `--emit-candidates` 실 150 시드(KRX/DART) + cron-system seed(`CRON_SYSTEM_USER_ID` 실존 auth.users UUID) + Vercel 플래그 확인(`AI_COST_LOG_REAL_INSERT_ENABLED=true`/`ANTHROPIC_API_KEY` — 둘 다 prod 존재) + cron preflight block 해제(env 또는 코드) + **실 AI 첫 30선정 트리거**(비용 burn 승인 ~5–6천원/회). 성공 시 카드에 실 배지/점수/코멘트 표시(PR-F 렌더 활성).
2. **[CLAUDE] PR-H** 리포트 enrich+manual trigger(reject→batch / Regen→단일 ticker) → **PR-I** Tier2 sector14+Section8(PR5b) → **PR-J** mock 전면정리. **PR-K**(Reflection) defer.

**[별도 트랙] PR5 cron 리포트 go-live** (위 e2e와 독립, USER 게이트): cron-system seed + Vercel `PR5_CRON_AUTO_ENABLED=true` + Task 7 비용 smoke + cron-persist canary. 마이그 0027 ✅ applied. (PR #60 MERGED-dormant.)

**BLOCKER 등급 갭 (ADR §2)**: B1 tier0 150 SoT→**PR-D ✅** / B2 어댑터→**PR-C ✅** / B3 DART 스키마→**PR-B ✅** / B4 배지 컬럼→**PR-E ✅** / B5 배지 알고리즘 단일화(ADR D-2 consensus.ts) ✅ / B7 fail-open→**PR-B2+PR-E is_admin 게이트 ✅** / 잔여 B6(disjoint RPC — commit_persona_eval=report-path, selection 배지=short_list_30, PR-E 분리 확정).

**ACTIVE blocker / W-ticket** (full catalog → `docs/superpowers/audit-catalog.md`): OPS-1(plan tier, PR5 트랙) / W-alert-event-dedup / W-portfolio-snapshot-real / W-tier1pill.

> **실 AI trigger/cron 가동은 USER 비용 승인 전 절대 금지** (~5,000~6,000원/회 burn). 현 short_list_30 30종목은 **AI가 아닌 Tier 0 지표로 고른 fallback**.

---

## 0. 세션 시작 루틴 (verify + auto-progress)

```bash
cd /Users/yong/New_Project_KR_Stock
git fetch origin

# 1) main state (fixed SHA 박제 금지 — runtime verify)
git checkout main && git pull origin main
git rev-parse --short HEAD          # PR-F 머지+docs sync 후 `0e2e973` 또는 자손
git status --short                  # clean

# 2) OPEN PRs — #2(format-error CONFLICTING) only 기대
gh pr list --state open --json number,title,headRefName,mergeable

# 3) 검증 게이트 (매 세션 1회)
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit && cd ..
#   main 기준 기대: build 26 routes / lint 0 err 5 warn(pre-existing) / test:ci 1438 PASS / 126 files / tsc clean / Python 95 tests PASS

# 4) production audit 재확인 (Supabase MCP execute_sql 또는 dashboard) — drift detect
#   select count(*) from cost_log;          -- 기대 0 (실 trigger/PR5 실행 전)
#   select count(*) from stock_reports;      -- 기대 0
#   select count(*) from committee_votes;    -- 기대 0
#   select count(*) from short_list_30;      -- 기대 30 (AI 컬럼 consensus_badge/ai_score 전부 null = Tier0 fallback)
#   select count(*) from tier0_candidates_150; -- 기대 0 (PR-G Python --emit-candidates 시드 전)
#   select sector, count(*) from short_list_30 group by sector order by 2 desc;
#     -- 기대: canonical 14만 / placeholder('코스피','코스닥') 0 / B93 PASS
#   drift(cost_log>0 또는 short_list_30 AI 컬럼 non-null 등) 시 = 누군가 실 AI trigger/seed 실행 → §1 ground truth 갱신.
```

### §0.A — PR5 go-live 활성화 진입 (⚠️ **별도 트랙** — 1순위 아님)

> **다음 세션 1순위 진입은 §다음 액션 큐 1번 = PR-G**(실 AI 첫 가동). 본 §0.A는 그와 **독립된 PR5(report-only cron) go-live** 트랙이다 — PR-G와 혼동 금지. PR-G가 USER 비용 게이트로 막히면 §0.A(PR5)도 동일 USER 게이트라, CLAUDE는 [USER]gate 보고 후 **§다음 액션 큐의 CLAUDE-prep**(아래 PR-G ⓐ)으로 진행한다.

**PR5 코드는 MERGED**(main `c2f7504`, PR #60 — branch 삭제됨) + 마이그 0027 production applied. cron route는 **dormant**(`PR5_CRON_AUTO_ENABLED` 미설정 → spend 0). 다음은 **go-live 활성화 USER 게이트** (한눈에 §[별도 트랙] PR5 — e2e PR-F~G와 독립): (b) 마이그 ✅ DONE / (c) cron-system seed → `CRON_SYSTEM_USER_ID` / (d) Vercel PR5 env / (a) Task 7 비용 smoke + cron-persist canary / (e) plan tier. 전부 production external(USER) — CLAUDE는 명령/체크리스트 + 후속 verify. 미충족이면 보고 + 다음 unblocked CLAUDE step.

```bash
cd /Users/yong/New_Project_KR_Stock
git checkout main && git pull origin main
git rev-parse --short HEAD          # PR5 머지 후 c2f7504 또는 자손
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit && cd ..
#   기대: build 26 routes / lint 0 err 5 warn / test:ci 123 files 1376 PASS / tsc clean
```
- PR5 plan SoT(main 머지됨): `docs/superpowers/plans/2026-05-29-pr5-cron-monthly-batch-auto.md`. go-live 상세 = `audit-catalog.md §9.4` + W-pr5-cron-persist-canary.
- **go-live 후 [CLAUDE]**: cron 가동 모니터링 + Task 8 audit + **PR5b**(committee_votes + Section 8 full path, **D11 운용 검증 전 land 강제 hard gate**, plan §3.2/§9 G2) + Step 4 Reflection.

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
| main HEAD | **runtime verify** `git rev-parse --short origin/main` (PR-F 머지 후 `69a8d5c` 또는 자손). |
| PR5 | ✅ **MERGED** (PR #60 rebase FF + delete-branch). cron monthly-batch report-only worker + 마이그 0027. cron **dormant**(`PR5_CRON_AUTO_ENABLED` 미설정 → spend 0), 실 가동 = USER 게이트. |
| OPEN PRs | **#2**(format-error, CONFLICTING 보류) only. PR #19~#60 + canonical 5-PR 모두 MERGED(상세 git log). |
| 검증 게이트 (main, PR-F 포함) | build 26 routes / lint 0 err 5 warn(pre-existing) / **test:ci 1438 PASS / 126 files** / tsc clean / **Python 95 tests PASS**. |
| canonical 5-PR | ✅ 전체 MERGED: PR2 `f85fb69` / PR3a `0813a41` / PR1 `4aa3130` / PR3b `cf68731` / PR3c `b2a902a` / PR4 `7de9696`. |
| B65 3-phase | ✅ P1 `5b99e03` + P2 spec(옵션 A lock-in) + P3 impl `3c09d6e` + 마이그 0025 applied + Vercel env=true → production functional 가능. |
| Task 5 B66 | ✅ **PRODUCTION COMPLETE** (60차 §5): 마이그 0026 + induty 백필 2,766/2,766 + short_list_30 30 rows canonical 14(B93 PASS). placeholder/unresolved 영구 0. |
| 선정 흐름 | spec lock-in: Tier 0 150 → Tier 1 Core 11 AI → 단/중/장 top 10 = 30. 현 production = Tier 0 단독 30(fallback). **PR-G 실 AI 첫 30선정 시 메인 path 활성** (PR5=별도 report-only cron, 선정 path 아님). |
| 풀 리포트 | PR3b writer Section 0~7 + Section 8 partA/partD + PR3c 3-step + PR4 admin caller + 마이그 0025 RPC + env=true. **functional 가능, last-known audit cost_log=0/stock_reports=0** → Task 7 Smoke Stage 2에서 첫 실 검증. |
| 실 AI 호출 | **현재 0건** (cost_log=0). **선정 path 첫 실 AI = PR-G**(150 시드 + Tier1 30선정). report-only 첫 smoke = Task 7(PR5 트랙, 별도). 둘 다 USER 비용 승인 후. |
| Supabase | project `rbrpcynhphrpljbjirfo` · **0001~0029 production applied** (0028 = tier0_candidates_150 disjoint 50×3 + canonical CHECK + unique(month,bucket,rank); 0029 = short_list_30 AI 컬럼 8종 nullable + consensus_badge/winning_timeframe CHECK) · SECURITY DEFINER 패턴 · dart_corp_codes 2,766/2,766 induty 백필. |
| Vercel canary | 최근 PR-F deploy Ready; **public 4/4 OK** (`/` + `/login` + `/macro` 200 + `/admin` 307→login, tudal-tawny.vercel.app). cron route 5개(monthly-batch / morning-briefing / news-sweep / silent-health / **report-worker daily — dormant**). 인증 세션 canary 권장. |
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

### §2.1 Step matrix — 8-row (legacy B65/B66/PR5 Task 구조 — 역사 기록. 현 1순위 = PR-G, 한눈에 큐)

**현재 위치** = **실데이터+실AI e2e 트랙** (PR-A~F MERGED + 마이그 0028/0029 applied). **다음 1순위 = PR-G(실 AI 첫 가동) — 한눈에 §다음 액션 큐 참조.** 아래 8-row Task matrix는 **legacy(B65/B66/PR5 Task 구조) 역사 기록** — 현 진행은 e2e 11-PR 로드맵(ADR §4)이 SoT. PR5 go-live는 별도 트랙(USER 게이트, dormant). **상세 박제는 git log + PR body + ADR/plan docs 위임.**

| # | Task | Owner | 상태 |
|---|---|---|---|
| 1 | 현행 audit 재확인 (Supabase query) | CLAUDE | ✅ COMPLETED — 매 세션 entry routine 1순위로 재실행 (drift detect) |
| 2 | B65-P1 immediate guard + B86 month format | CLAUDE | ✅ MERGED `5b99e03` (PR #21) |
| 3 | B65-P2 real enablement spec (옵션 A lock-in) | CLAUDE | ✅ spec CONVERGED R8 — `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md` |
| 4 | B65-P3 호환 feature flag + 마이그 0025 impl | CLAUDE | ✅ MERGED `3c09d6e` (PR #30) + 마이그 0025 applied + Vercel env=true |
| 5 | B66 C 하이브리드 + B84/B89/B93 | CLAUDE(위임) | ✅ **PRODUCTION COMPLETE** (60차 §5) — 마이그 0026 + 백필 + 30 rows canonical 14 + B93 PASS |
| 6 | Smoke Stage 1 — non-AI dry-run | CLAUDE | 🟡 optional zero-cost prep (다음 명시 gate는 Task 7) |
| 7 | **Task 7 Smoke — single real AI** (go-live gate a) | CLAUDE+USER | ⭐ **USER 비용 승인 게이트** — 승인 후 CLAUDE 자동. B85 1-token **hardcode 모델** verify(`claude-opus-4-7` / `claude-haiku-4-5-20251001`). PASS = cost_log + stock_reports + critic_findings + UI + **별도 cron-persist canary** |
| 8 | PR5 cron 자동 리포트 (report-only) | CLAUDE | ✅ **MERGED** (PR #60, main `c2f7504`) + 마이그 0027 applied. Workflow 24-agent + omxy §2.0a CONVERGED. cron dormant → go-live = USER 게이트(c/d/a/e). PR5b(committee votes) = D11 전 hard gate |

### §2.2 ✅ 어드민 출시 게이트 (S9 1개월+ 후 7 criteria)

1. 최소 1개월 운용 (어드민 3인 일일 사용) · 2. BL-KRIT open 0개 · 3. 3인 핵심 플로우 일일 완료(Short List 30→풀 리포트→승인→가상 포트→알림) + disclaimer 전 화면 · 4. cron/health 안정(Silent Health red_alert 0 + success_rate ≥ 99% + canary OK) · 5. 비용 hardcap(월 400,000 KRW 미만 + AI 일 주문 ≤ 20회 + cost_log 정확) · 6. RLS/credential smoke(advisor anon WARN 0 + Smoke #3~#6 + 평문 노출 0) · 7. (자동매매 시) guardrail 위반 0(레버리지 ≤ 5x · 일일 손실 -3% 정지 · AI 일 주문 ≤ 20).

#### 후속 PR + 운영 (PR5 + S7b~S9)

| Step | Owner | Trigger | Default action |
|---|---|---|---|
| **PR5** cron 30 report-only 자동 + β2′ DB job queue | CLAUDE | ✅ **코드 MERGED**(PR #60) + 마이그 0027 applied. go-live = USER 게이트(c seed / d env / a Task 7 smoke / e plan tier) 후 cron 가동 | `orchestrateFullReport` Section 0~7 자동. queue = `report_batch_job` + `report_worker_run` run-mutex, fail = sequential + retry N=2 + summary/cost alert, cost ≈ 16,050원/월. cron dormant(flag off). **committee_votes/Section 8 = PR5b(D11 전 land hard gate)**. |
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
| ⭐ PR-G (실 AI 첫 가동, 다음 1순위) | Python `--emit-candidates` 실 150 시드(KRX/DART) + cron-system seed(`CRON_SYSTEM_USER_ID`) + cron preflight block 해제 + 실 AI 첫 30선정 (비용 burn 승인). 마이그 0028/0029 = ✅ applied | 한눈에 §다음 액션 큐 1번 참조 |
| PR5 gates a~e (별도 트랙) | Task 7 비용 승인 / cron-system seed + `CRON_SYSTEM_USER_ID` / Vercel PR5 env / plan tier(OPS-1). 마이그 0027 ✅ applied | 한눈에 §[별도 트랙] PR5 + §0.A 참조 |
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
| **실데이터+실AI e2e 사전결정 ADR + 11-PR 로드맵 (현 1순위 트랙 SoT)** | `docs/superpowers/specs/2026-05-31-realdata-realai-e2e-decisions.md` (omxy §2.0a 3-round CONVERGED. D-1~D-9 결정 + BLOCKER B1~B7 + 기획 정합표 + PR-A~K) |
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

### PR-F MERGED — short_list_30 카드 AI 렌더 (PR #67, main `69a8d5c`)

- **scope (D-7)**: ShortListItem optional AI 필드(consensusBadge/aiScore/aiCommentKr/winningTimeframe/conviction) + ConsensusBadge 타입 + admin-shortlist SELECT/transform 매핑(toBadge/toTimeframe/numOrNull) + shortlist-row.tsx 요약 AiBadge(🤖 점수+합의 배지) + expanded AI 코멘트/선호시점/conviction. null/⚪ = "AI 대기" pill(W-tier1pill 카드 부분). optional → mock 30 SEED + 기존 fixture 무변경.
- **검토 (전체 동일 flow)**: omxy 코드검토 CONVERGED(1 LOW aria-label) + **Workflow 6-dim(11 agents)이 omxy 놓친 2 MED 교차 catch** — MED-1(degraded ⚪+ai_score=0 → 요약 "대기" vs expanded "점수 0" 모순 → isAiPending type-guard lockstep) + MED-2(ai_score=assigned_tf vs winningTimeframe=primary_tf, backfill 상이 "72·장기" 오독 → 별도 행 분리). omxy 재검증 + MED-3(AI 코멘트 블록도 lockstep). **gstack 시각검토 PASS**(playwright: populated 🟢🤖88+코멘트+선호시점+conviction / null "AI 대기" / ⚪, overflow·crash·console-error 0).
- **게이트**: build 26 / lint 0err / test:ci 1438 / tsc clean. 마이그 불필요(0029 기적용). merge-safe(AI 컬럼 null → 전 카드 "AI 대기", 추가 렌더만).
- **commit**: PR #67 (4 commits — 카드 ① → omxy aria-label → Workflow MED-1/2 → omxy MED-3 — rebase FF, head `69a8d5c`). branch SHA는 rebase로 변경 — git log.
- **다음**: PR-G(실 150 시드 + 실 AI 첫 30선정 → 카드 실 배지/점수/코멘트 활성).

### PR-E MERGED — short_list_30 AI 스키마 + 실 Core 11 AI 선정 배선 (PR #66, main `492cd46`)

- **scope (B4/D-7)**: 마이그 0029(short_list_30 AI 컬럼 8종 nullable) + runTier1Screening commentsByTicker carry(top-conviction rationale + panel 평균 conviction) + upsertShortList30 AI 매핑(drop 수정) + admin triggerMonthlyBatch 실 배선(makeCallPersonaPanel + fetchFinancialsSummary + 실 persist) + orchestrator preflight DI seam(fail-closed 비용가드) + **150/150 post-screening 게이트**(degraded는 persist 안 함 — PR1 B3 supersede) + cron D6-B preflight block(실 cron AI=PR-G).
- **설계 합의**: omxy 설계 토론 R2 CONVERGED (150/150 게이트 = omxy 추가). impl 후 omxy 적대검토 + Workflow 6-dim(11 agents) **교차검증 — 양쪽 동일 HIGH**: triggerMonthlyBatch is_admin 게이트 부재 → cost fail-open(B7 class). omxy direct-edit: **is_admin() RPC 게이트**(triggerFullReport 패턴) + **persona panel 동시성 제한기**(default 4, env TIER1_PERSONA_MAX_CONCURRENCY — 1650 rate-limit storm 차단). ④ Claude 재검증 정합.
- **게이트**: build 26 / lint 0err / test:ci 1430(+8: comment carry 3 + persist 1 + orchestrator preflight/gate 2 + admin preflight 4 + cron preflight 1 − …) / tsc clean / Python 95.
- **마이그 0029 applied + 검증**: 8 컬럼 + 2 CHECK(consensus_badge 5종 / winning_timeframe 3종), short_list_30 30 rows 보존(AI 컬럼 null = Tier0 fallback), cost_log 0, tier0_150 0(미시드). **merge-cost-safe**: seed=0 → trigger는 150-invariant `got 0`에서 preflight·AI 전 실패.
- **commit**: PR #66 (4 commits — 0029 → carry+매핑 → task#8 실배선 → omxy is_admin+limiter — rebase FF onto main, head `492cd46`). 상세 체인 = `git log` (branch SHA는 rebase로 변경 — main SHA 기준 확인).
- **USER 잔여(PR-G)**: 실 150 시드 + cron-system seed + 실 AI 첫 선정(비용 승인).

### PR-D MERGED — tier0_candidates_150 producer/consumer (PR #65, main `123d995`)

- **scope (B1/D-3)**: AI 30선정 메인 path의 Tier 0 150-후보 SoT. 마이그 0028(`tier0_candidates_150` disjoint 50×3, unique(month,ticker)+(month,bucket,rank), canonical sector CHECK, RLS=0002 패턴) + Python `--emit-candidates`(150 disjoint producer) + TS `getTier0Candidates` consumer + cron/admin `tier0Source` un-stub. 30-direct fallback 무변경. **실 LLM 비용 0**(callPersonaPanel/commitBadgeOnly stub 유지).
- **검토 (§2.0a)**: Workflow 5-dim deep review(22 agents, 0 confirmed/17 refuted) + **omxy R1 CONVERGED**(code-reviewer+architect lanes). 2 confirmed direct-edit: **HIGH degraded-clobber** → cron/admin persist를 `persistBlockedUntilPrE`(throw)로 fail-closed 차단(doc guard→코드 guard 승격, PR-E가 `persistForCron` 복원 시 해제) / **MED 150-contract** → 마이그 canonical CHECK + unique(month,bucket,rank) + consumer `assertTier0CandidateRows`. ④ Claude 독립 재검증 잔여 0.
- **게이트**: build 26 / lint 0err / test:ci 1418(+13 신규: python 8 + consumer 9 + 회귀 4 − ...) / tsc clean / Python 95. **merge-before-migration 안전**(persist 코드 guard + dormant + 테이블 미존재 query graceful 502).
- **USER 잔여 (PR-D 당시)**: 마이그 0028 apply + Python 실 150 시드. → **현재: 0028 ✅ applied (PR-E와 함께), 잔여 = PR-G Python 150 seed.**
- 박제: PR #65 body (3 commits — ①1차 → deep-review fix → ②③④omxy — rebase FF, head `123d995`). branch SHA는 rebase로 변경 — `git log` 기준 확인.

### 실데이터+실AI e2e 트랙 — AI 30선정 코드 엔진 (PR-A~C MERGED, main `e65b03d`)

- **계기**: 사용자 요구 = 실데이터 + 실 Core 11 AI로 선정된 30종목 + 실 AI 리포트 + 합의배지 + 프론트 반영 + mock 전면제거. 검증으로 **실 AI 0회**(cost_log=0) + 현 30종목은 Tier 0 지표 fallback(AI 아님) 확인.
- **Phase 1 매핑(Workflow 9-agent)** + **Phase 2 omxy §2.0a 3-round CONVERGED** → ADR(11-PR 로드맵 A~K) `docs/superpowers/specs/2026-05-31-realdata-realai-e2e-decisions.md` (PR-A `61`).
- **Phase 3 코드 엔진 (각 PR omxy §2.0a CONVERGED + 게이트 ALL GREEN)**:
  - **PR-B** `25672f0` (#62): DART 재무 corp_code 브리지 — `dart-financials.ts`(ticker→corp_code JOIN + ROE/op_margin/부채비율/YoY). B3 guaranteed-throw 버그fix(존재X 컬럼 조회). omxy 결함 0.
  - **PR-B2** `d6978df` (#63): admin real-AI fail-closed cost guard — `isCostLoggingEnabled()` + triggerFullReport/regenerateReport 가드(B7 hardcap fail-open 차단). omxy ③ 주석+flag-off 테스트.
  - **PR-C** `e65b03d` (#64): callPersona→PersonaScore 어댑터(`persona-panel-adapter.ts`) + PERSONA_SCORE 프롬프트(callPersona override 비파괴) — "AI 30선정"의 B2 핵심. omxy ③ balanced-brace JSON scanner.
- **당시 계획**: PR-D(tier0 150) → E(AI 스키마+un-stub) → F(프론트) → G(env+실 AI 첫 선정) → H/I/J/K. **현재 D~F 완료, 다음 = PR-G** (active next는 한눈에 §다음 액션 큐 참조).
- 12 사용자 요구 누락 0 추적 + 기획(D19/D21/D23) 정합표 = ADR §5.

### PR5 MERGED — cron monthly-batch 자동 리포트 (report-only) + 마이그 0027 (PR #60, main `c2f7504`)

- **검증 (Workflow 24-agent + omxy §2.0a cross-runtime)**: 6차원 deep review 38 findings → 18 HIGH/MED 적대 verify → **전부 LOW/MED 강등, 4 refuted, 확정 HIGH 코드 블로커 0** + omxy CONVERGED(신규 블로커 0, merge-before-migration 안전, cost-logger spend-before-log = bounded follow-up). 게이트 build 26 / test:ci 1376 / tsc clean.
- **61/62차 review fix 잔존 (2회 rebase 후)**: CI-1 step-0 fail-closed / CRF-1 hardcap defer / OPS-2 lock-leak / OPS-3 forward-progress / SRC-1·2·3 / TC-1~6 전부 코드+테스트 present, grep gate 11/11, regression 0.
- **마이그 0027 production applied** (Supabase MCP, `rbrpcynhphrpljbjirfo`): report_batch_job + report_worker_run 2 테이블 + 5 RPC, RLS + 4-grant(anon=false) + 내부 is_admin guard + search_path 검증. advisor = 기존 ~13 함수와 동일 패턴(회귀 0).
- **omxy ③ docs fix (④ Claude 재검증)**: B85 hardcode 모델 정정(`claude-opus-4-7` / `claude-haiku-4-5-20251001`) + cron-persist canary 추가 + .env.example project 주석 정정 + follow-up 티켓(W-cost-atomic-reservation / W-pr5-cron-persist-canary).
- cron **dormant**(flag off → spend 0). 실 가동 = USER 게이트(c cron-system seed / d Vercel env / a Task 7 비용 smoke / e plan tier OPS-1). public canary 3/3 + /admin 307 OK.

### HANDOFF 단일화·정리 (PR #59 선행)

- 693→296L 단일본 + §7→`omxy-rdebate-runbook.md` / §9→`audit-catalog.md` 분리(§번호 stub 유지) + SessionLog archive + stale 포인터 13곳 정정. Claude↔omxy §2.0a CONVERGED, docs-only.

> 60차 §5 이하 (Task 5 B66 PRODUCTION COMPLETE 마이그 0026 + B93 PASS / Mock cleanup / 58차 PR #30~#34 / canonical 5-PR / S7a / Tier 2 등) = git log + PR body + spec/plan/REVIEW docs 위임.

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
- **W-alert-event-dedup** — alert_event partial unique index, 다음 미사용 마이그 슬롯(0030+).
- **W-portfolio-snapshot-real** — S7b morning-briefing portfolioSnapshot 실 SELECT.
- **W-tier1pill** — Section 8 absent 리포트 = Tier 1 평가 대기 pill UI (D11 운용 검증 acceptance gate).

**Smoke 2-stage 요약** (상세 = audit-catalog.md §9.4):
- **Stage 1** (cost=0, optional prep): `triggerFullReport`에 mock `orchestrateFullReport` 주입한 P1/P2/P3 호환 invariant TDD.
- **Stage 2** (USER 비용 승인 후 1회): B85 1-token model id verify 선행(존재하지 않는 model env var가 아니라 hardcode 모델: writer/revise `claude-opus-4-7`, critic `claude-haiku-4-5-20251001`) → admin UI click/server action 직접 호출. PASS = ① cost_log row ② stock_reports section_0~7 + appendix non-null + zod valid ③ report_critic_findings row ④ (옵션 B) committee_votes ⑤ `/admin/report/[ticker]` 정상 본문/의도된 SectionFallback 렌더(매핑된 에러 메시지 노출도 FAIL). **PR5 cron은 admin Task 7과 다른 `upsert_report_sections_0_7_cron` service-role path라 별도 cron-persist canary 필수.** real cost = cost_log 기준 확정(수치 박제 금지).

**B66 production state**: ✅ resolved (60차 §5). placeholder 0 / canonical 14 only 30 rows. 재발 방지 = C 하이브리드(DART induty KSIC longest-prefix → canonical 14 + `sector_override.json` fallback + B89 strict block). PR5 cron 신규 row도 canonical 14 자동 부여.
