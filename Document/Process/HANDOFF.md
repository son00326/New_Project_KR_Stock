# HANDOFF — 주픽 (JooPick)

Last updated: 2026-06-11 (77차 — **B-SEL-CRON fix ✅ MERGED(PR #118)**: period-scoped due-gate + SELF_CONTINUE opt-out 기본 ON + orphan/stall/track-throw alert + panel cost-month 배선 + finalize stale-guard. workflow 27→11 fix + omxy 3 fix + Claude 최종검토 0-new 3-pass 수렴. 코드만(flag dormant — production 행동 변화 0). 다음 1순위 = **Accept go-live**(USER #1) / 매달 자동화는 USER flag 게이트). 직전 76차 — shortlist 정확성 fix ✅ MERGED(PR #114): track_pending + stale 카피 + DART 분기누적 파싱, production 리스트 반영은 재시드 필요.

> **이 파일 하나로 다음 세션이 진입 가능하도록 작성됨.** SHA·라운드 수·commit 체인은 self-drift 위험이 크므로 freeze 금지 — `git rev-parse --short origin/main` + `git log` + PR body로 runtime verify. 완료된 차수의 상세 박제·배선 교차감사 기록은 **git log + PR body + memory**에 위임하고 본 파일엔 남기지 않는다.

---

## 🎯 다음 할 일 (출시까지 남은 작업 — 순서대로)

> "HANDOFF.md 보고 이어서 진행" = 아래 1번부터 순서대로. 각 항목 옆 [SoT]가 상세 위치. USER 게이트는 §3, 출시 Runbook 상세는 §2.2.
>
> **▶ 지금 당장 (owner별):**
> - **[USER, 5분]** `/admin/portfolio`에서 **Accept 클릭**(#1) → MVP② 닫힘. 가장 먼저.
> - **[CLAUDE, 비용 0·병행 가능]** Accept를 기다리는 동안 = **B-SEL-CRON fix(#2)** 또는 **토스 D0 디자인 시스템 정의**(spec-only) 착수.
> - **[USER 비용 승인 필요]** shortlist 재시드(정확성 3단계, ~₩25k) — 급하지 않음, 별도 트랙.
> - 트랙은 3개(메인 런북 #1~4 · shortlist 정확성 5단계 · 토스 리디자인 D0~D4)지만 **메인 런북 순서가 출시 critical path**이고 나머지 둘은 거기에 결합되는 병행 트랙.

1. **[USER 클릭]** **Accept go-live** — production audit 기준 `portfolio_proposal` 2026-06-01 **1건 영속 완료**(Opus 4.8 1콜 ₩27.80, 11종목+현금 12%, 2026-06-10T05:28Z) / `portfolio_approval` 2026-06-01 **0건** / `portfolio_snapshot` **0건**. 다음은 admin `/admin/portfolio`에서 제안 표시 확인 → **Accept 클릭**(가상 포트 확정). proposal 생성·영속 경로는 동작 확인됨. Accept 관련 path(`PORTFOLIO_USE_PROPOSAL_ENABLED`, `PORTFOLIO_EXPLICIT_CASH_ROW_ENABLED`, 0035 cash-row snapshot)는 Accept 클릭으로 검증 필요. 0034/0035 마이그는 applied 상태라 재실행 금지(verify만). MVP ②(포트폴리오) 완성 단계. [SoT: §3]
2. **[CLAUDE]** ~~**B-SEL-CRON fix**~~ ✅ **DONE (PR #118 MERGED)** — period-scoped due-gate + `SELECTION_CRON_SELF_CONTINUE` opt-out 기본 ON(load-bearing) + orphan/stall/track-throw alert + panel cost-month 배선 + finalize stale-guard. workflow 27 findings→11 fix + omxy 3 fix + Claude 최종검토 0-new로 3-pass 수렴. 코드만(production 행동 변화 0 — flag dormant). **남은 건 USER 게이트**(§3 매달 자동화: flag enable + `SELECTION_CRON_SELF_CONTINUE` env 삭제 + 주간 tier0 producer + 비용 승인).
3. **[USER 키 + CLAUDE]** **S7b** 뉴스 자동제외(M12a) + 모닝 브리핑(M11) — Naver(B-8)+Telegram(B-9)+AI 키. shadow/alert-only(`M12A_AUTO_REMOVE_ENABLED` default false)부터. 이메일/Resend 전역 미사용. [SoT: ServicePlan-Admin §3.10 M12a · §2.2 Step 7]
4. **[USER 운용 + CLAUDE]** **D11 운용 검증 → S7c → S7d → S9 → 🎉 출시** — §2.2 후속 PR/운영 Runbook 그대로. 출시 = 자동매매 제외("AI 추천+가상 포트+알림" 내부 도구), S8 자동매매는 출시 후.

**[병행/선택 트랙] shortlist 정확성 — "순차적 C" 5단계 (사용자 확정, 1·2 완료 / 3·4·5 다음 세션 순서대로):**
> 사용자 발견(SK하이닉스 리스트 누락처럼 보임 / 삼성전자 부재) → 14-agent 감사(wq0gi0va0) → "순차적 C"(전부 한 방에 묶지 말고 단계 검증). Accept go-live(위 #1)와 **독립** 트랙.
> - **1단계 — UI 버그(track_pending + stale 카피)**: ✅ **DONE (76차, PR #114)**.
> - **2단계 — DART 분기누적 파싱 버그**: ✅ **DONE (76차, PR #114)**. 코드/테스트만 — production 리스트는 3단계 재시드 전까지 옛 데이터.
> - **3단계 — 재시드+재선정 1회 [본 트랙 다음 1순위]**: ① **DART quarterly 캐시 무효화 선행 필수**(옛 wrong-value 캐시 refetch 강제) → ② Tier0 재시드(Python `screen_shortlist_tier0.py`) → ③ Tier1 재선정(~₩25k, **USER 비용 게이트**). 목적 = DART fix 적용 후 대형주(삼성전자 등) 공정 경쟁 검증.
> - **4단계 — 결과 보고 후 스코어링 튜닝 B 결정**: 3단계 데이터로 판단 — DART fix만으로 대형주 경쟁되면 **B 불필요**. 안 되면 deliberate 2차로 B(z정규화→percentile/winsorize · S3 시총정규화 · 장기 quality 보정, 14-agent 감사 MED 3종) 적용 + 재선정(+₩25k). **묶지 말 것**(검증 해상도 보존).
> - **5단계 — 주간 자동화(진짜 지속성)**: 주간 tier0 producer(Python→외부 스케줄) + B-SEL-CRON fix(위 #2) + `SELECTION_CRON_AUTO_ENABLED`. 1회 재시드는 그 주만 fresh — 지속성은 5단계 필수. [SoT: §3 + 14-agent 감사 wq0gi0va0]

**[병행 트랙] 토스 스타일 리디자인 Toss-D0~D4 (시점 결정, runbook 순서 불변):**
> **토스 스타일 전체 리디자인(폰트 포함) — 마일스톤 결합 5-슬롯 (Claude↔omxy 토론 CONVERGED, 시점 결정. 스코프 C 전체·스킬 파이프라인은 확정분):**
> - **namespace guard**: 이 블록의 D0~D4는 디자인 전용 `Toss-D0~D4`이며, ServicePlan의 포트폴리오 D1~D4 의미와 별개다.
> - **D0 디자인 시스템 정의 [Accept와 병행 허용 — 단 산출물(스펙/문서)만, 코드·런타임·폰트패키지·globals.css·shadcn 토큰·layout primitive 변경 0; 그 변경은 D1]**: `/gstack-design-consultation` → 토스 원칙 + 폰트 후보/라이선스/한글 렌더링/성능 조건 + 토큰 방향 + primitive 목록. 별도 브랜치/문서 산출이면 Accept 리스크 0.
> - **D1 쉘 리테마 [Accept 완료 후 merge; S7b UI 착수 전 필수; B-SEL-CRON과 병렬 가능하나 충돌 시 D1이 UI 선행조건]**: `vercel:shadcn` 토큰+폰트+공통 primitive(nav/header/card/table/form) 전역 리테마 + `npx impeccable` slop 가드. 전역 회귀면적 크므로 Accept 완료 전 merge 금지.
> - **D2 기존 핵심 플로우 정밀 [D11 진입 전 필수]**: 홈/리스트/리포트/포트폴리오/승인 = `ce-frontend-design` + `ce-design-iterator`. D11은 짧아도 실 운용검증이라 핵심 플로우가 final-ish여야 피드백 유효(토큰만으론 부족).
> - **D3 신규 화면 final-style 동시구현 [기능 PR 내장]**: S7b 화면 = S7b 구현과 함께 / S7c 화면 = S7c 구현과 함께. 별도 후행 리디자인 금지.
> - **D4 freeze [S7d 후 · S9 직전]**: 풀 리디자인 아님 — `/gstack-design-review` QA + polish + 회귀 차단만.
> - 전 디자인 PR: §2.0a Claude↔omxy 루프 + `/gstack-design-review` QA + `vercel:react-best-practices`. **AI 비용 0(디자인 작업; 제품/운영 AI spend 없음).**
> - **critical path guard**: Accept go-live(MVP②)가 여전히 #1 critical path — 리디자인이 막지 않는다. 기존 출시 runbook 순서(Accept→B-SEL-CRON→S7b→D11→S7c→S7d→S9→출시)는 변경하지 않고, 디자인은 위 runbook에 결합되는 병행 트랙이다.

**MVP 엔진(W0~W3b)·P1/P2/P3/P2b·P4(30 리포트)·canonical 5-PR·B65/B66 = 전부 ✅.** MVP 산출물: ① 30 리스트 ✅(73차, 정확성 fix 76차) · ③ 30 리포트 ✅(75차) · ② 포트폴리오 = AI 제안 생성/영속 ✅, **Accept 확정만 잔여**. 결정 SoT = memory `project_mvp_engine_4workstreams_2026_06_04` + CLAUDE.md ⭐ 헤더(LOCKED 9 — 변경 금지). 구현 상세 = git log + PR body.

---

## 0. 세션 시작 루틴 (verify + auto-progress)

```bash
cd /Users/yong/New_Project_KR_Stock && git fetch origin
git checkout main && git pull origin main
git rev-parse --short HEAD          # 76차 shortlist-accuracy PR #114 merge 후 자손
git status --short                  # clean
gh pr list --state open --json number,title,headRefName,mergeable   # 기대 0 (없으면 우선 처리)

cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit && cd ..
#   기대: build OK / lint 0 err 0 warn / test:ci 1982 PASS + 4 skipped / 165 files+2skip / tsc clean (77차 B-SEL-CRON +31)
```

**production audit (Supabase MCP execute_sql) — drift 감지 기준(현재 정상 상태):**
```sql
select count(*), round(coalesce(sum(cost_krw),0)::numeric,2) from cost_log where month='2026-06';
  -- 기대 3032 / ₩41,341.93 (73차 풀 P3 2611 + 74차 P2b 42 + 75차 P4 378 + 76차 W3 proposal 1). 초과 증가 = 추가 실 AI 진행분.
select status, count(*) from report_batch_job where month='2026-06' group by status;  -- 기대 done 30 (75차 P4 완주)
select count(*) from stock_reports where month='2026-06-01'
  and section_0 is not null and section_7 is not null and section_8 is not null and appendix is not null;
  -- 기대 30 (section_0~8+appendix 완결 — 0/7/8+appendix가 완결성 대표 게이트)
select count(*) from committee_votes;  -- 기대 330 (30 reports × 11)
select month::text, count(*), count(consensus_badge) from short_list_30 group by month order by month;
  -- 기대 2026-05-01=30/0(Tier0 incumbents 보존) + 2026-06-01=30/30(AI 선정)
select count(*) from tier0_candidates_150;  -- 기대 150 (2026-06 · 50/50/50 · canonical 14 · unresolved 0)
select count(*) from portfolio_proposal where month='2026-06-01';  -- 기대 1 (proposal 영속 완료)
select count(*) from portfolio_approval where month='2026-06-01';  -- 기대 0 (Accept 미완료)
select count(*) from portfolio_snapshot;  -- 기대 0 (Accept 전)
```
P1 audit 잔존: `cost_log` 2026-05 4행(₩334.71) + `stock_reports` 2026-05-01 004150 1행(section_0/7, section_8 null).

### 진입자 자동 행동 (default-progress)
1. 위 verify → 게이트·audit drift 0 확인.
2. §"다음 할 일" 1번부터 다음 unblocked CLAUDE step 식별.
3. Owner별: **[CLAUDE]** 즉시 자동(stacked 1세션+ 작업은 진입 의사 1회 확인) / **[SHARED]** "이어서 진행" 권한으로 push·PR-create·docs-sync 자동 / **[USER]** §3 게이트 — blocker 짧게 보고 + 다음 unblocked CLAUDE step 진행.
4. **§2.0a omxy 적대 검토 패턴**을 모든 신규 작업 branch에서 적용. **USER 직접 묻기**(§2.0): scope expansion / product spec / risk profile / real-money / cost burn 트리거 / 마이그 production apply / Vercel env·secrets·flag / 외부 메시지 / destructive / uncertainty ≥ medium.

---

## 1. 현재 상태 (current-only; per-PR 역사는 git log + PR body 위임)

| 영역 | 상태 |
|---|---|
| main HEAD | **runtime verify** `git rev-parse --short origin/main` (2026-06-10 76차 PR #114 merge 후 자손). |
| OPEN PRs | **없음(0)** 기대. PR #19~#114 전부 머지(상세 git log). |
| 검증 게이트 | build OK / lint 0 err 0 warn / **test:ci 1982 PASS + 4 skipped / 165 files+2skip**(77차 B-SEL-CRON +31) / tsc clean / DART pytest 18. |
| **MVP 엔진** | **W0~W3b 전부 ✅ MERGED**(모델/프로바이더 추상화 + 주간/월간 split + incumbent thesis + 반박 토론 loop + judge/dual-judge + entry_price + AI 자율 포트 proposal→Accept→cash row). canonical 5-PR + B65/B66 ✅. 상세 = git log + PR body. |
| **실 AI 검증** | P1(2026-05 4행 ₩334.71) + 73차 풀 P3 selection(2026-06 2611행 ₩24,655.64) + 74차 P2b live(42행 ₩1,695.83) + **75차 P4 30 리포트 완주(378행 ₩14,962.66 ≈ ₩554/ticker)** + **76차 W3 portfolio proposal 1콜(₩27.80, proposal 영속 완료)**. 2026-06 월 누계 **3032행 ₩41,341.93**(hardcap 50만 내). 다음 실 AI 비용 이벤트 = shortlist 재시드+재선정(~₩25k, USER) 또는 후속 regen; Accept 자체는 AI 호출 없음. |
| **선정 흐름 (production)** | `short_list_30` 2026-06-01 = **30 AI 배지/ai_score**(🟣20/🟢7/🟡2/🔵1, short/mid/long 10/10/10) · 2026-05-01 = 30 Tier0 incumbents 보존. 메인 path = short 주간 + mid·long 월간 rolling composite(자동화는 USER 게이트 + B-SEL-CRON fix 선행). **76차 정확성 fix(track_pending·DART 분기누적)는 코드만 — production 리스트는 재시드 전까지 옛 데이터(§다음할일 정확성 재시드).** |
| **풀 리포트 (production)** | `stock_reports` 2026-06 **30행 전부 section_0~8+appendix 완결**(verdict BUY 15/HOLD 7/SELL 8) + `committee_votes` **330**(30×11, parse stub 0) — **75차 P4 완주, MVP ③ 달성**. report_batch_job 30 done. 2026-05-01 004150 1행(section_0/7, section_8 null = P1 잔존). |
| Supabase | project `rbrpcynhphrpljbjirfo` · **마이그 0001~0037 production applied**(0037 = claim over-claim CTE fix, 74차 USER 승인, ledger `20260610015408`). 미적용 dormant 없음. cron RPC grants = postgres/service_role only. |
| Vercel canary | public 4/4 OK (`/`·`/login`·`/macro` 200 + `/admin` 307→login, tudal-tawny.vercel.app). cron route 5개 전부 **dormant**(flag 미설정 → spend 0). |
| Mock/슬라이스 | DQ-7 ~97%(Smoke #4/#5 + Session 4 QA 잔여) · S7e 7/8(T7e.7 RLS QA 잔여) · cron INSERT mock cleanup 완료. |

---

## 2. 출시까지 Runbook

### §2.0 Default-progress policy
- 현재 step이 USER-gated면 background blocker로 짧게 보고하고 다음 unblocked CLAUDE step으로 진행. 반복 질문 금지.
- **자동 진행 vs USER-only 정책 SoT = `CLAUDE.md ⚙️ Claude+omxy R-debate Workflow 정책`**:
  - **자동 허용**(권한 ON + omxy CONVERGED + 게이트 ALL GREEN): PR merge / docs-sync PR / post-merge docs-only direct commit / canary / deploy polling / branch cleanup / PR create.
  - **항상 USER-only**(CLAUDE는 가이드 + 후속 verify): Vercel env·secrets·flag / 마이그 production apply / billing / live-money / external account / cost burn 트리거 / 외부 메시지 / destructive.
- memory: [[feedback_user_action_auto_progress]] · [[feedback_omxy_debate_workflow]] · [[feedback_no_user_approval_gate]].

### §2.0a — ⭐ Claude↔omxy 작업 워크플로우 순서 (사용자 명시, 강제 적용)
**impl·fix 4-step**: ① Claude 1차 작업/수정(branch commit) → ② omxy 1차 검증(실 코드/diff 적대 검토) → ③ omxy 검증 후 수정(direct-edit, 게이트 GREEN 유지, commit은 Claude) → ④ Claude 2차 검증(코드 근거, 맹목 수용 X; 잔여 시 ③ 복귀). **plan 단계는 역할 반전**(①Claude 작성 ②omxy catch-only ③Claude fix). omxy 환경/송신 상세 = `docs/superpowers/omxy-rdebate-runbook.md`. **USER 게이트는 본 순서와 무관하게 항상 적용.**

### §2.2 ✅ 어드민 출시 게이트 (S9 1개월+ 후 7 criteria) — ⚠️ 출시 = 자동매매 제외

> **출시 범위 = "AI 추천 + 가상 포트 + 알림" 내부 도구** (어드민이 AI 추천 보고 직접 매매). 자동매매(S8)는 출시 후 어드민 3인 실운용하며 개발 — criterion #7은 "(자동매매 시)" 조건부(출시 시점 N/A).

1. 최소 1개월 운용(어드민 3인 일일) · 2. BL-KRIT open 0 · 3. 3인 핵심 플로우 일일 완료(Short List 30→풀 리포트→승인→가상 포트→알림) + disclaimer 전 화면 · 4. cron/health 안정(Silent Health red_alert 0 + success_rate ≥ 99% + canary OK) · 5. 비용 hardcap(월 **500,000 KRW** 미만 + AI 일 주문 ≤ 20 + cost_log 정확) · 6. RLS/credential smoke(advisor anon WARN 0 + Smoke #3~#6 + 평문 노출 0) · 7. **(자동매매 도입 후만)** guardrail 위반 0(레버리지 ≤ 5x · 일일 손실 -3% 정지 · AI 일 주문 ≤ 20).

#### 후속 PR + 운영 (출시까지 선형)
| Step | Owner | Trigger | Default action |
|---|---|---|---|
| **PR5** cron 30 report-only 자동(report_batch_job 큐) | CLAUDE | 코드 ✅ MERGED + 마이그 0027 applied. go-live = USER 게이트(§3 PR5 gates) | cron dormant(flag off). go-live 시 매달 자동 리포트. ⚠️ B-SEL-CRON fix와 동일 due-gate/finalize 검토. |
| **Step 7 S7b** 뉴스 자동 제외(M12a) + 모닝 브리핑(M11) | USER(Naver B-8 + Telegram B-9 + AI 키) + CLAUDE | P4 + Accept go-live(MVP② 확정) 후 | AI 페르소나(Core 11) 뉴스 평가 → per-company thesis-break → direct/material/high-conf 자동 제외(빼기만·freed→현금) + smart brake + durable ledger + 텔레그램/`/admin/alerts` 알림. **개발 순서 = base-first + shadow-first**: D11 base 운용검증(M12a 없이 Track Record 기준선) → S7b에서 M12a **shadow/alert-only**(`M12A_AUTO_REMOVE_ENABLED` default false) → 출시 → 자동 제거 ON = 출시 후 fast-follow. **M12a 자동 mutation = 출시 게이트 아님.** spec SoT = `ServicePlan-Admin §3.10 M12a`. 이메일/Resend 전역 미사용. **디자인 결합**: D3 신규 화면 final-style 동시구현(S7b 화면 = S7b 구현과 함께), D1은 S7b UI 착수 전 필수. |
| **Step 8 D11** AI 가상 포트 1차 가동 게이트 | USER 운용 + CLAUDE 모니터링 | S7b + PR-H/I/J D11 전 hard gate(manual trigger 2종 ✅ + PR5b/Section8 full path ✅ P2b + runtime mock grep 0) 완료 후, S7c 전 | KIS 0개로 어드민 3인 며칠~1주 운용 검증(의사결정 품질·승인·재생성 cap·알림 정확도). acceptance gate UI = 리포트 section_8 부재 시 '🤖 Tier 1 평가 대기' pill + Section 0 🔢🤖합의 배지 1행(✅ STEP-1). **디자인 결합**: D2 기존 핵심 플로우 정밀(홈/리스트/리포트/포트폴리오/승인)은 D11 진입 전 필수. |
| **Step 9 S7c** 장중·KIS WS + Exit 텔레그램+/admin 2-layer | USER(Telegram B-9 + KIS B-10) + CLAUDE | D11 검증 통과 후 | 실 alert_event + KIS read-only 1개 WS + Exit 텔레그램 best-effort + `/admin/alerts` durable event + 대안 3 + T+7 outcome. **디자인 결합**: D3 신규 화면 final-style 동시구현(S7c 화면 = S7c 구현과 함께). |
| **Step 10 S7d** Silent Health | CLAUDE | S7c 완료 후 | 5 파이프라인 success_rate + red_alert 0 + Exit outcome T+7 cron. (코드+테스트 완결, 실 DB/브라우저 실검증만 Docker/USER 대기.) |
| **Step 15 S9 운용 → 🎉 출시** | USER 1개월+ + CLAUDE hotfix | S7d 완료 후 | 어드민 3인 실 사용 1개월+ + 위 7 criteria 통과 = 출시. **디자인 결합**: D4 freeze(S7d 후 · S9 직전) 완료 후 진입 — 풀 리디자인 아님, `/gstack-design-review` QA + polish + 회귀 차단만. |
| **[defer] Reflection / PR-K** | CLAUDE | **출시 게이트 아님** — S9/go-live 후 | reflection_log 마이그 + Tier 1 context 주입. |
| **[출시 후] S8 자동매매** | USER(Binance B-11) + CLAUDE | 출시 후 | 주식 KIS + 바이낸스 USDT-M 선물 · Strategy drop-in + AI 어댑터 · 가드레일 + Binance Smoke #3. |

---

## 3. 사용자 액션 대기 큐 (pending only · 완료분은 git log + §6)

| 우선 | 작업 | 필요 액션 |
|---|---|---|
| ⭐ **Accept go-live** | `portfolio_proposal` 2026-06-01 **1건 영속 완료**(11종목+현금 12%, Opus 4.8 ₩27.80). `portfolio_approval` 2026-06-01 0건 + `portfolio_snapshot` 0건 → **최종 승인 미완료**. **마이그 0034/0035는 70차에 이미 production applied — 재실행 금지(verify만; 0035 add-constraint는 IF NOT EXISTS 아니라 재실행 시 실패).** | USER admin 화면 확인 + Accept 클릭 |
| ✅ **B-SEL-CRON** (PR #118 MERGED) | CLAUDE fix 완료(period-scoped due-gate + SELF_CONTINUE opt-out ON + orphan/stall/track alert + cost-month + stale-guard). 남은 건 USER flag(아래 매달 자동화 게이트로 통합). | ~~CLAUDE fix~~ → USER flag |
| 📊 **shortlist 정확성 재시드** (76차 fix 후속) | 76차 PR #114(DART 분기누적 파싱 버그 + UI track_pending) = 코드/테스트만. production 리스트 갱신·대형주 공정경쟁 확인하려면: ① **DART quarterly 캐시 무효화**(옛 wrong-value refetch) + Tier0 재시드(Python) + ② 재선정(~₩25k) + ③ 결과 보고 후 **스코어링 튜닝 B(z정규화/S3/quality) 추가 필요 여부 데이터 기반 결정**. 비용·외부스케줄 게이트라 Accept go-live와 독립. | USER 비용 승인 + CLAUDE 실행 |
| 🔭 WATCH (76차 omxy 비차단) | shortage-reason는 DB-level cross-track cardinality(버킷 0/10 불변식)를 코드가 강제하진 않음 — per-bucket finalize 도입 시 규칙 갱신 필요(주석 박제됨). portfolio page는 MissingCountBanner 미사용(자체 게이팅) → track_pending 인지 후속(MED). | 별도 후속 |
| **매달 자동화 게이트** | Vercel `SELECTION_CRON_AUTO_ENABLED=true` + **Vercel env에서 `SELECTION_CRON_SELF_CONTINUE` 삭제(미설정=ON, 구 .env.example가 false 박았으면 finding 27 함정)** + 주간 tier0 후보 producer(pykrx=Python → GitHub Actions 등 외부 cron, Vercel은 TS만) + 운영 비용 승인. (B-SEL-CRON fix 선행.) | USER + 외부 스케줄 |
| **PR5 gates** (별도 트랙) | Vercel `PR5_CRON_AUTO_ENABLED=true` + Task 7 비용 smoke + plan tier(OPS-1). cron-system seed ✅ / 마이그 0027 ✅. | USER |
| **B-8 Naver** | key rotate/env | S7b M12a 뉴스 수집 진입 시 |
| **B-9 Telegram** | bot token + admin 3 chat_id | S7b M12a 알림(텔레그램+`/admin` 웹) + S7c/S7d alerts |
| **B-10 KIS** (per-admin, 1/3 보유) | KIS·Binance = per-admin 키(DQ-7, 암호화 저장). 현재 3명 중 1명만(모의 키). **사용자 포함 2명 발급 필요.** S7c read-only 시세는 1개로 충분 / S8 자동매매는 3명 each. | S7c(1개) / S8(3명) |
| **B-11 Binance** | key(testnet 우선) | S8(출시 후) 진입 시 |
| **B-1~B-5 (DQ-7)** | 친구 비번 + KIS row 정리 + Smoke #4/#5 RLS + Session 4 QA | DQ-7 close 잔여 |
| **B-12 / B-13 / B-2A** | 보안 rotate(Supabase anon/service_role/DB pw/PAT/노출 키) / Vercel CLI update / HIBP leaked-password 토글(Supabase dashboard) | 권장 |

> KRX_OPENAPI_KEY 발급·8서비스 승인 완료 + `.env.local`/Vercel env 저장(✅). 해소 historical = git log + PR body.

---

## 4. 안전 규칙

- 내부 어드민 투자 운영 도구. Public signup/member/pricing 트랙은 Deferred-D 재개 전까지 만들지 않는다.
- **main 직접 commit 기본 금지**(Vercel auto-deploy). feature branch + PR. 예외: 사용자 명시 post-merge baseline docs-only direct commit(가역, 코드/DB/외부 변경 0).
- billing-on / mock→real API 전환은 USER 트리거 후에만.
- `/admin` 접근 = Supabase session refresh + `ADMIN_EMAILS` allowlist + RLS 3중 방어. `SUPABASE_SERVICE_ROLE_KEY` client-exposed 절대 금지. 어드민 추가/제거 시 Vercel env `ADMIN_EMAILS` + DB `admin_emails` 테이블 **동시 갱신**(한쪽만 = 인증 drift).
- credential plaintext/MEK/ciphertext UI·로그 노출 금지(서버 `src/lib/crypto/aes.ts`).
- UI 한국어 우선. 새 server action error code = `format-error.ts` 한국어 매핑 추가.
- Next.js 16 routing/middleware/server action 변경 전 `tudal/node_modules/next/dist/docs/` 또는 공식 문서 확인.
- 신규 SECURITY DEFINER 함수 마이그 = 3종 세트: `revoke from public` + `revoke from anon` + `grant to authenticated`(+ cron 전용은 authenticated도 revoke, service_role만). Supabase가 신규 public 함수에 authenticated EXECUTE 자동 부여 → 명시 revoke 필수.
- PostgreSQL `IF <null>`는 true 아님: RPC guard = `is null or ... is distinct from ...` + `coalesce(v->>'key','') not in ...` 명시.
- **claim/queue RPC 패턴 (74차 0037)**: `update … where id in (select … limit N for update skip locked)` **금지** — Postgres 서브쿼리 rescan으로 LIMIT 초과 over-claim(plan-dependent, prod 실증). 반드시 `with picked as materialized (select … limit N for update skip locked) update … from picked … returning j.*` 단일 평가. [[feedback_pg_skip_locked_claim_anti_pattern]]
- `section_8.partD.vote = BUY/HOLD/SELL literal 유지`(DB 저장 시 RPC가 approve/abstain/reject 매핑, writer 변환 금지). `stock_reports` = `generated_at` only + partial unique `(ticker, month) WHERE is_latest=true` 보존.
- **report 섹션 validation silent null-drop = structured log 격상 완료**(72차 PR #107, `logStructured`). 신규 validation 경로도 동일 패턴.

---

## 5. 문서 SoT

> 운영 순서: 본 HANDOFF → ServicePlan-Admin/ReportFramework → ProgressDashboard/Slices → CodebaseStatus → 실행 규칙.

| 필요 정보 | 문서 |
|---|---|
| 어드민 서비스 기획 본체 (Tier 0/1/2 + 합의 배지 + M12a 뉴스 + Section 8 contract) | `Document/Service/Planning/ServicePlan-Admin.md` (§1A.5 D19·D21·D22 / §3.10 M12a / §4.2.1 Section 8) |
| writer Section 8 작성 가이드 | `Document/Service/Report/ReportFramework.md §8` |
| 실데이터+실AI e2e ADR + 11-PR 로드맵 | `docs/superpowers/specs/2026-05-31-realdata-realai-e2e-decisions.md` |
| omxy R-debate 적대 검토 runbook | `docs/superpowers/omxy-rdebate-runbook.md` |
| Smoke/audit catalog (W-ticket) | `docs/superpowers/audit-catalog.md` |
| S7 mock→real Phase/DoD (S7a~S7d + T7e.7 RLS QA) | `Document/Build/Slices/S7-RealData.md` |
| 전체 진행률/변경 이력 | `Document/Build/ProgressDashboard.md` |
| 코드 스냅샷 / 실 I/O 통로 / 잔존 mock | `Document/Process/CodebaseStatus.md` |
| 슬라이스 실행 규칙 | `Document/Process/ExecutionPlaybook.md` |
| MVP 엔진 LOCKED 9 결정 (변경 금지) | memory `project_mvp_engine_4workstreams_2026_06_04` + `CLAUDE.md ⭐ 헤더` |

---

## 6. 직전 완료 (직전 2 entry only · older = git log + PR body)

### B-SEL-CRON fix (77차, 2026-06-11, PR #118 MERGED) — 매달 자동화 선행 결함 해소
- **계기**: 74차 배선감사 catch — selection cron이 due-gate(short=월요일/midlong=1일 단발)+chunk 3+`SELECTION_CRON_SELF_CONTINUE` 기본 off라 cron 단독으론 period당 ~130 jobs(R1+R2+judge)를 finalize 못 함 → 차주 새 period_key가 기존 미finalize period를 고아화(silent spend·산출 0). `SELECTION_CRON_AUTO_ENABLED=true` enable 전 선행 필수.
- **fix(4 commit)**: (1) period-scoped due-gate — 날짜-단발 게이트 폐기, 두 트랙 모두 '현재 period' 매일 진행, finalize 후 acquire의 finalized_at null-guard가 cheap no-op + worker `already_finalized` skip 구분. (2) `SELECTION_CRON_SELF_CONTINUE` opt-out 기본 ON(`!== "false"`, load-bearing accelerator). (3) **orphan sweep**(flag gate 앞·hop-skip `&selfcontinue=1`·real wall-clock anchor·seam∪real union·60d lookback·spend 단정 제거) + 일반화 **stall alert**(self-continue off OR default-ON livelock) + **track-throw alert**(hop-skip) + 202 ok=every + `aborted`(cost_hardcap)→ok:false. (4) panel **costLogMonth=t.month** 배선(preflight month==insert month, 월경계 누수 차단) + finalize **stale-period guard**(수동 ?now= 역순 재개가 더 최신 finalized shortlist를 stale로 덮어쓰기 차단).
- **적대 검토(§2.0a 3-pass 수렴)**: dynamic workflow 5-렌즈 27 findings → Claude 직접 adjudication(verify 에이전트 session-limit 실패 대체) 11 확정 fix → **omxy R1 CONVERGED**(에이전트·스킬 multi-lane, 3 direct-edit: aborted ok:false + dormant-500 best-effort + smoke cost-month) → **Claude ④ 최종 적대 검토 0 new HIGH/MEDIUM**(1 benign LOW = 월경계 cross-resume 보수적 차단, 주석 박제).
- **⚠️ production 행동 변화 0**: cron route dormant(`SELECTION_CRON_AUTO_ENABLED` 미설정). 게이트 build/lint 0/test:ci 1982+4skip/tsc clean.
- **다음**: USER 게이트(§3 매달 자동화: flag enable + `SELECTION_CRON_SELF_CONTINUE` env 삭제 + 주간 tier0 producer + 비용). Accept go-live(#1)와 독립.

### shortlist 정확성 fix (76차, 2026-06-10, PR #114 MERGED) — 사용자 발견 2현상 근본원인
- **계기**: 사용자 "AI 포트 제안엔 SK하이닉스 있는데 30-리스트엔 없고, 급등한 삼성전자가 리스트에 아예 없다 → 필터링 문제?" → 14-agent 감사(wq0gi0va0)로 원인 규명(두 현상 원인 상이).
- **① UI**(SK하이닉스 = 실은 mid 버킷 존재): W2a 트랙 분리 + `carry_short_into_month` overlap-exclusion으로 partial 버킷(예 `[10,0,0]`·`[9,10,10]`)이 정상 발생하는데 `resolveShortageReason`이 틀린 "스크리닝 미달" 표시. → `ShortageReason`에 `track_pending` + **불변식 기반 규칙(mid==long∈{0,10}, short∈{0..10} carry; 0<total<30=전부 track timing/carry 아티팩트) → total≥30 none / 0<total<30 track_pending / 0 screening`** + 배너 over-promise 카피 완화 + stale cadence "21/42/63일 리밸런스"→"주간/월간". `src/lib/admin/shortage-reason.ts`(+7 테스트).
- **② DART**(삼성전자 부재 한 원인): `parse_dart_financial_response`가 손익(IS/CIS)에 `thstrm_amount`(반기/3분기=3개월치)를 읽는데 `compute_standalone_quarter`는 누적 전제 차감 → Signal4(YoY 실적, 중기 0.30) 왜곡. → IS/CIS는 `thstrm_add_amount`(누적) 우선·fallback, BS는 `thstrm_amount` 유지. +3 회귀테스트.
- **검토**: dynamic workflow 2-track 구현 + **Claude↔omxy 적대 loop R1~R3 CONVERGED** — R1 omxy 2 HIGH → Claude 독립 3-렌즈 재판정(1a/1b reject) → **omxy R2가 정확한 메커니즘(carry overlap로 [9,10,10] 도달가능)으로 sharpening → Claude 수용·규칙 정정** → omxy R3 CONVERGED(서브에이전트+Vitest 124/124+pytest 18). 게이트 build/tsc/lint 0·0/test:ci 1951+4skip/pytest 18.
- **⚠️ behavior-neutral**: 코드/테스트만 — production 리스트는 **재시드 전까지 옛 데이터**(§다음할일 "shortlist 정확성 재시드", §3). DART 캐시 무효화 선행 필수.
- **다음(= 현 1순위)**: **Accept go-live**(MVP ②; proposal 1건 영속 완료, 최종 승인/portfolio_snapshot 0). 정확성 재시드는 병행/선택(USER 비용).
