# HANDOFF — 주픽 (JooPick)

Last updated: 2026-06-12 (77차 — **Accept go-live ✅ DONE(MVP② 완료, 2026-06-12 10:11 KST: approval accept·is_final + snapshot 14행 실 entry_price)** ← **Accept-gate 내부도구 완화 D31 ✅ MERGED(PR #120)·production 배포**(D+4 Hold·2인 열람 면제, 24h hold만; env `PORTFOLIO_ACCEPT_GATE_STRICT`로 strict opt-in; relaxed면 viewer/auto-relief DB 조회 skip; omxy R1~R2 CONVERGED)로 버튼 활성 → USER 클릭 영속 + **B-SEL-CRON fix ✅ MERGED(PR #118)** + **Accept-gate de-mock fix ✅ MERGED(PR #119)**(viewer 게이트 legacy mock 5종 하드코딩 제거→active 전종목 공유모듈 단일화 + page/action anchor 통일 + 2026 달력 근로자의날·제헌절 + UX) + **shortlist 재시드 진행 중**(DART quarterly 캐시 5482 무효화 + 16 sector override commit `2a66a95` + Tier0 dry-run b89통과 150후보 검증; 삼성전자 미진입) + **스코어링 방법론 2차 토론 CONVERGED → B++**(실증: production 150 대형 주도주 10/11 누락 → B+ 단독 REJECT. Claude 퀀트 + omxy 2 독립 수렴, main Opus 종합. 근본원인=구조적 retrieval 실패[지속추세 시그널 부재+소형주 편향]). **Tier0 스코어링 B++ 1차 구현 + 삼중 게이트 harness ✅ MERGED(PR #121 code-merge `8110e8c`)** — Claude 1차+self-review → omxy review/fix(R1·R2) → Claude 적대 review(R1·R2) cross-model 수렴(양쪽 CONVERGED), python unittest 115→225, survivorship probe PASS, **코드만(`--apply` hard-block·legacy default·AI 비용 0)**. **다음 1순위 = Gate A/B 실 삼중 게이트 harvest(gated step-2: 장시간 PIT run + DART announcement-date PIT + USER Tier1 ₩25k) → 삼중 게이트 ALL PASS 시에만 재screen→apply→Tier1.** (Gate C smoke[실 KRX dry-run·비용 0]은 §6 진행 중.) Accept go-live(USER #1) = ✅ DONE(MVP②)). 직전 76차 — shortlist 정확성 fix ✅ MERGED(PR #114).

> **이 파일 하나로 다음 세션이 진입 가능하도록 작성됨.** SHA·라운드 수·commit 체인은 self-drift 위험이 크므로 freeze 금지 — `git rev-parse --short origin/main` + `git log` + PR body로 runtime verify. 완료된 차수의 상세 박제·배선 교차감사 기록은 **git log + PR body + memory**에 위임하고 본 파일엔 남기지 않는다.

---

## 🎯 다음 할 일 (출시까지 남은 작업 — 순서대로)

> "HANDOFF.md 보고 이어서 진행" = 아래 1번부터 순서대로. 각 항목 옆 [SoT]가 상세 위치. USER 게이트는 §3, 출시 Runbook 상세는 §2.2.
>
> **▶ 지금 당장 (owner별):**
> - **[CLAUDE/USER, 1순위]** **Tier0 스코어링 B++ — 1차 구현+harness ✅ MERGED(PR #121).** 남은 1순위 = **Gate A/B 실 삼중 게이트 harvest = gated step-2**: ① `validate_tier0_ic.py` 실 12-24M PIT run 활성(현재 CLI fail-closed) + DART announcement-date rcept_dt PIT fix + baseline 3종 wiring ② 삼중 게이트(recall+rank-IC+size) ALL PASS 시에만 → `--scoring bpp --apply`(tier0_candidates_150 갱신, 비용 0) → **Tier1 재선정(P3_FULL_RUN_CONFIRM, 실 AI ~₩25k, USER 비용 승인)** → production short_list_30. **통과 전 --apply/Tier1/"상승 예측" claim 금지.** [SoT: `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md` §5 step 2~6]. (Gate C smoke[실 KRX dry-run·비용 0]은 1차에서 진행 — §6.) §5 step 0 survivorship = ✅ DONE(probe PASS).
> - ~~**[USER]** `/admin/portfolio` **Accept 클릭** → MVP② 닫힘~~ ✅ **DONE (2026-06-12 10:11 KST)** — `portfolio_approval` 2026-06-01 accept·is_final=true + `portfolio_snapshot` 14행(종목 12 + 현금 7% + aggregate, 실 entry_price). **MVP ② 완료.** (D31 게이트 완화 PR #120 배포로 버튼 활성 → 클릭 영속 확인. 멤버 공개 시 `PORTFOLIO_ACCEPT_GATE_STRICT=true` strict 복원.)
> - **[CLAUDE, 비용 0·병행]** 토스 D0 디자인 시스템 정의(spec-only) — 여유 시.
> - 트랙: 메인 런북 #1~4 · **shortlist 정확성(현재 = B++ 1차 구현 ✅ MERGED → Gate A/B 실 harvest gated step-2)** · 토스 D0~D4. 메인 런북이 출시 critical path.

1. ✅ **Accept go-live — DONE (2026-06-12 10:11 KST, MVP ② 완료).** USER가 `/admin/portfolio`에서 Accept 클릭 → production 영속 확인(MCP 직접 쿼리): `portfolio_approval` 2026-06-01 = **accept·is_final=true** + `portfolio_snapshot` 2026-06 = **14행**(종목 12 + 현금 7% + aggregate, 실 entry_price[SK하이닉스 ₩2,101,000 등 W3a 실 KRX 종가] 채워짐). 확정 포트 = 화면 AI 제안(12종목 93% + 현금 7%)과 정확히 일치. **77차 D31: Accept 게이트 내부도구 완화(PR #120·배포)로 버튼 활성 → 클릭 영속.** 멤버 공개(Deferred-D) 시 `PORTFOLIO_ACCEPT_GATE_STRICT=true` strict 복원 + 마이그 0034/0035 재실행 금지(verify만). **MVP 3대 산출물 ①30리스트·②포트폴리오·③30리포트 전부 완료.** [SoT: §3]
2. **[CLAUDE]** ~~**B-SEL-CRON fix**~~ ✅ **DONE (PR #118 MERGED)** — period-scoped due-gate + `SELECTION_CRON_SELF_CONTINUE` opt-out 기본 ON(load-bearing) + orphan/stall/track-throw alert + panel cost-month 배선 + finalize stale-guard. workflow 27 findings→11 fix + omxy 3 fix + Claude 최종검토 0-new로 3-pass 수렴. 코드만(production 행동 변화 0 — flag dormant). **남은 건 USER 게이트**(§3 매달 자동화: flag enable + `SELECTION_CRON_SELF_CONTINUE` env 삭제 + 주간 tier0 producer + 비용 승인).
3. **[USER 키 + CLAUDE]** **S7b** 뉴스 자동제외(M12a) + 모닝 브리핑(M11) — Naver(B-8)+Telegram(B-9)+AI 키. shadow/alert-only(`M12A_AUTO_REMOVE_ENABLED` default false)부터. 이메일/Resend 전역 미사용. [SoT: ServicePlan-Admin §3.10 M12a · §2.2 Step 7]
4. **[USER 운용 + CLAUDE]** **D11 운용 검증 → S7c → S7d → S9 → 🎉 출시** — §2.2 후속 PR/운영 Runbook 그대로. 출시 = 자동매매 제외("AI 추천+가상 포트+알림" 내부 도구), S8 자동매매는 출시 후.

**[병행/선택 트랙] shortlist 정확성 — "순차적 C" 5단계 (1·2 ✅ / 3 부분완료 / 4 B++ 1차 구현 ✅ MERGED → 남은 1순위 = Gate A/B 실 harvest step-2 / 5 후속 자동화):**
> 사용자 발견(SK하이닉스 리스트 누락처럼 보임 / 삼성전자 부재) → 14-agent 감사(wq0gi0va0) → "순차적 C"(전부 한 방에 묶지 말고 단계 검증). Accept go-live(위 #1)와 **독립** 트랙.
> - **1단계 — UI 버그(track_pending + stale 카피)**: ✅ **DONE (76차, PR #114)**.
> - **2단계 — DART 분기누적 파싱 버그**: ✅ **DONE (76차, PR #114)**. 코드/테스트만 — production 리스트는 3단계 재시드 전까지 옛 데이터.
> - **3단계 — 재시드 검증**: ✅ **부분 완료(77차)**: ① DART quarterly 캐시 5,482행 무효화 ✅ → fixed 파서 재populate → ② Tier0 dry-run(sector override 16 commit `2a66a95` → b89 통과) 150 후보 검증 ✅. **결과: 대형 주도주 10/11 누락 확정**(실증) → 4단계 B++ 필요. ③ **이 dry-run 150은 구 스코어링이라 B++로 supersede**(폐기 대상). Tier1 재선정은 **B++ 삼중 게이트 통과 후로 보류**(미검증 스코어링에 ₩25k 금지).
> - **4단계 — 스코어링 보정 B++ [1차 구현+삼중 게이트 harness ✅ MERGED(PR #121) · cross-model 수렴(omxy R1·R2 + Claude 적대 R1·R2, 양쪽 CONVERGED) · 실 Gate A/B harvest = step-2 gated]**: **실증으로 확정** — production 150에 대형 주도주 11개 중 SK하이닉스만 진입·나머지 10 누락(소형 급등주 독식·long 5점폭 압축). **B+ 단독 REJECT → B++**(Claude 퀀트 + omxy 2 독립 수렴, main Opus 종합). 근본원인 = 구조적 retrieval 실패(지속추세 시그널 부재 + 소형주 구성편향). **B++** = ⓐ size sleeve(Large/Mid/Small-liquid, horizon별 20/20/10) ⓑ 유동성 플로어(ADV60+anti-pump) ⓒ 모멘텀 재설계(close/MA60 폐기 → risk-adj 20/60/126/252D trend + 52주 고가 + spike penalty) ⓓ winsorize+percentile rank·결측 tiering·foreign ADV+대형 sponsorship·sector-relative quality·volume=trend확인시만(long 0) ⓔ 수기가중치 폐기→rank ensemble. **삼중 게이트**(AND): Gate A recall(대형 leader recall 별도 + visible-trend-miss 분리 + 11-leader는 tripwire) · Gate B rank-IC(슬리브별 scope) · Gate C size fairness(60/60/30 결정론 진입조건). **AI 2차는 누락 구제 불가 → recall은 Tier0 책임.** **통과 전 --apply/Tier1/"상승 예측" claim 금지.** [SoT: **`docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md`**(B++ 전문)]
> - **5단계 — 주간 자동화(진짜 지속성)**: 주간 tier0 producer(Python→외부 스케줄, pykrx) + B-SEL-CRON fix(✅ PR#118) + `SELECTION_CRON_AUTO_ENABLED`. 1회 재시드는 그 주만 fresh. [SoT: §3 + 14-agent 감사 wq0gi0va0]

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

**MVP 엔진(W0~W3b)·P1/P2/P3/P2b·P4(30 리포트)·canonical 5-PR·B65/B66 = 전부 ✅.** MVP 산출물: ① 30 리스트 ✅(73차, 정확성 fix 76차) · ③ 30 리포트 ✅(75차) · ② 포트폴리오 ✅ **Accept 확정 완료(2026-06-12, MVP② DONE)**. **MVP 3대 산출물 전부 완료.** 결정 SoT = memory `project_mvp_engine_4workstreams_2026_06_04` + CLAUDE.md ⭐ 헤더(LOCKED 9 — 변경 금지). 구현 상세 = git log + PR body.

---

## 0. 세션 시작 루틴 (verify + auto-progress)

```bash
cd /Users/yong/New_Project_KR_Stock && git fetch origin
git checkout main && git pull origin main
git rev-parse --short HEAD          # 2026-06-12 77차: PR #121(B++) code-merge `8110e8c` + docs-sync `675c51b` 후 자손 (runtime verify)
git status --short                  # clean (scripts/.venv·scripts/out gitignored)
gh pr list --state open --json number,title,headRefName,mergeable   # 기대 0 (없으면 우선 처리)

cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit && cd ..
#   기대: build OK / lint 0 err 0 warn / test:ci 1989 PASS + 4 skipped / tsc clean (77차 Accept-gate de-mock)
```

**production audit (Supabase MCP execute_sql) — drift 감지 기준(현재 정상 상태):**
```sql
select count(*), round(coalesce(sum(cost_krw),0)::numeric,2) from cost_log where month='2026-06';
  -- 기대 3033 / ₩41,368.84 (73차 풀 P3 2611 + 74차 P2b 42 + 75차 P4 378 + 76차 W3 proposal 1 + 77차 proposal regen 1 ₩26.91). 초과 증가 = 추가 실 AI 진행분.
select status, count(*) from report_batch_job where month='2026-06' group by status;  -- 기대 done 30 (75차 P4 완주)
select count(*) from stock_reports where month='2026-06-01'
  and section_0 is not null and section_7 is not null and section_8 is not null and appendix is not null;
  -- 기대 30 (section_0~8+appendix 완결 — 0/7/8+appendix가 완결성 대표 게이트)
select count(*) from committee_votes;  -- 기대 330 (30 reports × 11)
select month::text, count(*), count(consensus_badge) from short_list_30 group by month order by month;
  -- 기대 2026-05-01=30/0(Tier0 incumbents 보존) + 2026-06-01=30/30(AI 선정)
select count(*) from tier0_candidates_150;  -- 기대 150 (2026-06, 73차 선정 — B++ 재screen 전까지 갱신 안 됨)
select count(*) from portfolio_proposal where month='2026-06-01';  -- 기대 1 (10종목/현금15%, regen 2026-06-11)
select count(*) from portfolio_approval where month='2026-06-01';  -- 기대 1 (accept·is_final=true, 2026-06-12 10:11 KST Accept DONE)
select count(*) from portfolio_snapshot where month='2026-06-01';  -- 기대 14 (종목 12 + 현금 1 + aggregate 1, 실 entry_price)
```
> 77차 재시드: `dart_financial_cache` quarterly 무효화 후 재populate(annual 보존). `short_list_30`/`tier0_candidates_150` 2026-06은 **여전히 73차 선정**(B++ 재screen→재선정 전까지 옛 데이터 — 77차 dry-run 150도 구 스코어링이라 폐기 대상). Tier1 재선정 시 cost_log 증가 예상(~₩25k).
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
| main HEAD | **runtime verify** `git rev-parse --short origin/main` (2026-06-12 77차 PR #121[B++] code-merge `8110e8c` + docs-sync `675c51b` 후 자손). |
| OPEN PRs | **없음(0)** 기대. PR #19~#121 전부 머지(상세 git log). |
| 검증 게이트 | build OK / lint 0 err 0 warn / **test:ci 1989 PASS + 4 skipped**(77차 Accept-gate +shortlist-gate 12 + breadth/dormant) / tsc clean / DART pytest 18. |
| **MVP 엔진** | **W0~W3b 전부 ✅ MERGED**(모델/프로바이더 추상화 + 주간/월간 split + incumbent thesis + 반박 토론 loop + judge/dual-judge + entry_price + AI 자율 포트 proposal→Accept→cash row). canonical 5-PR + B65/B66 ✅. 상세 = git log + PR body. |
| **실 AI 검증** | P1(2026-05 4행 ₩334.71) + 73차 풀 P3 selection(2026-06 2611행 ₩24,655.64) + 74차 P2b live(42행 ₩1,695.83) + **75차 P4 30 리포트 완주(378행 ₩14,962.66 ≈ ₩554/ticker)** + **76차 W3 portfolio proposal 1콜(₩27.80)** + **77차 proposal regen 1콜(₩26.91, 2026-06-11T02:36Z → proposal=10종목/현금15%)**. 2026-06 월 누계 **3033행 ₩41,368.84**(hardcap 50만 내). 다음 실 AI 비용 이벤트 = shortlist 재시드+재선정(~₩25k, USER) 또는 후속 regen; Accept 자체는 AI 호출 없음. |
| **선정 흐름 (production)** | `short_list_30` 2026-06-01 = **30 AI 배지/ai_score**(🟣20/🟢7/🟡2/🔵1, 10/10/10) · 2026-05-01 = 30 Tier0 incumbents. **production 리스트는 여전히 73차 선정(2026-06-09)** — 76차 DART fix + 77차 재시드(dry-run 150은 구 스코어링)는 production 미반영. 메인 path = short 주간 + mid·long 월간 rolling. Tier1 재선정은 **B++ 삼중 게이트 통과 후 보류**(D30). **DART quarterly 캐시는 무효화+재populate됨**(fixed 파서). |
| **스코어링 방법론** | 2차 토론 CONVERGED(77차, 실증 후): production 150 대형 주도주 10/11 누락 실증 → **B+ 단독 REJECT → B++**(size sleeve + 유동성 플로어 + 모멘텀 재설계 + 수기가중치 폐기 + recall/IC/size 삼중 게이트). 현 5-시그널 z정규화 = 예측력 미검증·구조적 retrieval 실패. **삼중 게이트 통과 전 --apply/Tier1/"상승 예측" claim 금지** — "robust, factor-informed, leader-inclusive candidate shortlist"까지만. SoT spec 2026-06-12(B++ 전문). |
| **풀 리포트 (production)** | `stock_reports` 2026-06 **30행 전부 section_0~8+appendix 완결**(verdict BUY 15/HOLD 7/SELL 8) + `committee_votes` **330**(30×11, parse stub 0) — **75차 P4 완주, MVP ③ 달성**. report_batch_job 30 done. 2026-05-01 004150 1행(section_0/7, section_8 null = P1 잔존). |
| Supabase | project `rbrpcynhphrpljbjirfo` · **마이그 0001~0037 production applied**(0037 = claim over-claim CTE fix, 74차 USER 승인, ledger `20260610015408`). 미적용 dormant 없음. cron RPC grants = authenticated + service_role (public/anon revoke; 0031/0027 — cron은 service_role, admin은 authenticated 경로). |
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
| ✅ **Accept go-live — DONE (MVP ② 완료)** | 2026-06-12 10:11 KST USER Accept 클릭 → `portfolio_approval` 2026-06-01 **accept·is_final=true** + `portfolio_snapshot` 14행(종목 12 + 현금 7% + aggregate, 실 entry_price). D31 게이트 완화(PR #120·배포)로 버튼 활성됐고 클릭 영속 확인. 마이그 0034/0035 재실행 금지(verify만). | (완료 — 멤버 공개 시 `PORTFOLIO_ACCEPT_GATE_STRICT=true`) |
| ✅ **B-SEL-CRON** (PR #118 MERGED) | CLAUDE fix 완료(period-scoped due-gate + SELF_CONTINUE opt-out ON + orphan/stall/track alert + cost-month + stale-guard). 남은 건 USER flag(아래 매달 자동화 게이트로 통합). | ~~CLAUDE fix~~ → USER flag |
| 🔬 **Tier0 스코어링 B++ — 실 Gate A/B harvest (gated step-2, CLAUDE+USER)** | 1차 구현+삼중게이트 harness ✅ MERGED(PR #121) cross-model 수렴. step0(survivorship) ✅ DONE. **남은 것**: ①`validate_tier0_ic.py` 실 12-24M PIT run 활성(현 CLI fail-closed) + DART announcement-date rcept_dt PIT fix + baseline 3종 wiring + 파라미터 train-lock-OOS → ②omxy 적대검토 → **삼중 게이트(recall+IC+size) ALL PASS 시에만** `--scoring bpp --apply`(tier0_candidates_150, 비용 0) → **Tier1 재선정(~₩25k, USER 비용 승인)** → production short_list_30. **통과 전 --apply/Tier1/"상승 예측" claim 금지.** | CLAUDE harvest 활성 → (Tier1 비용 USER 승인됨) [SoT: spec §5 step 2~6] |
| ✅ **Accept-gate de-mock** (PR #119 MERGED) | viewer 게이트 legacy mock 5종 하드코딩→active 전종목 공유모듈(shortlist-gate.ts) + page/action anchor 통일 + 2026 달력(근로자의날·제헌절) + UX. omxy R1/R2 CONVERGED. **production Accept 게이트가 active 30종 전부 2인 열람 요구로 정합화**(D+4 hold ~06-15 + 2 admin 열람 = §2.2 #3 출시 플로우). | (없음 — Accept 클릭 시 적용) |
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
| **Tier0 스코어링 B++ (1차 구현 ✅ MERGED PR #121 / 실 Gate A·B harvest = step-2 실행 스펙)** | **`docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md`** (B++ 설계[size sleeve·모멘텀 재설계·rank ensemble] + recall/IC/size 삼중 게이트 + §5 step 0~1 ✅ / step 2~6 gated) · 구현 = `scripts/tier0_factors.py`·`validate_tier0_ic.py`·`probe_pit_survivorship.py`·`screen --scoring bpp` |
| omxy R-debate 적대 검토 runbook | `docs/superpowers/omxy-rdebate-runbook.md` |
| Smoke/audit catalog (W-ticket) | `docs/superpowers/audit-catalog.md` |
| S7 mock→real Phase/DoD (S7a~S7d + T7e.7 RLS QA) | `Document/Build/Slices/S7-RealData.md` |
| 전체 진행률/변경 이력 | `Document/Build/ProgressDashboard.md` |
| 코드 스냅샷 / 실 I/O 통로 / 잔존 mock | `Document/Process/CodebaseStatus.md` |
| 슬라이스 실행 규칙 | `Document/Process/ExecutionPlaybook.md` |
| MVP 엔진 LOCKED 9 결정 (변경 금지) | memory `project_mvp_engine_4workstreams_2026_06_04` + `CLAUDE.md ⭐ 헤더` |

---

## 6. 직전 완료 (직전 2 entry only · older = git log + PR body)

### Tier0 스코어링 B++ 1차 구현 + 삼중 게이트 harness + cross-model 적대 검토 루프 (77차, PR #121 MERGED, code-merge `8110e8c`)
- **산출(코드만·production 행동 변화 0)**: `scripts/tier0_factors.py`(B++ 순수 팩터/사이징/스코어링 + 공유 `score_bpp_universe` — screen·harness 단일 소스) + `scripts/validate_tier0_ic.py`(삼중 게이트 Gate A recall / Gate B scoped rank-IC PASS·FAIL·ADJUDICATE 3-state / Gate C 결정론 size + PIT 패널·forward-return[t+1 entry·gap/delisted 구분]; **CLI fail-closed** = 실 harvest는 step-2) + `scripts/probe_pit_survivorship.py`(step 0 PASS) + `screen_shortlist_tier0.py --scoring bpp`(emit-candidates 전용·`--apply` hard-block·450d lookback·ADV/52주고가 prefetch·KRX throttle 내성·Gate C smoke).
- **§5 step 0(survivorship) ✅ RESOLVED**: KRX `bydd_trd` historical = PIT universe(상폐-at-time 포함, probe 실측 2024-12-16 KOSPI 25종목 부재) → recall 검증 유효(upper-bound 아님). `ACC_TRDVAL`/`MKTCAP`/`TDD_HGPRC` 무비용 가용.
- **Claude↔omxy 루프(§2.0a, 사용자 지정 omxy-fixes 변형)**: Claude 1차 → Claude self-review(workflow 6렌즈, 2H+5M+6L 수정) → **omxy** review R1(catch-only, 4H+2M+1L)+fix `93a23d4` → **Claude** 적대 review R1(workflow 4렌즈 → 1H[long-bucket 52주고가-단독 eligibility leak]+3M omxy 누락분 발견)+omxy fix `4d497a2` → **Claude** 적대 review R2(2렌즈+**mutation testing** → ZERO findings) → **양쪽 CONVERGED**.
- **검증**: python unittest 115→**225 PASS**, compile clean, survivorship probe PASS, mutation testing(각 fix revert→해당 test FAIL=genuine guards), 임계 전부 tightening. **AI 비용 0**(전부 dry-run/순수).
- **Gate C smoke ✅ PASS (실 KRX 2197종목 dry-run·비용 0)**: 분포 **60/60/30** · Small **20%** · long-trend NaN 0 · **11-leader tripwire 5/11**(SK하이닉스·**삼성전자**·두산에너빌리티·에코프로비엠·HD현대일렉트릭 = 기존 73차 1/11 → B++ 5/11, 소형주 독식 소멸 실증). ⚠️ pykrx 외국인 fetch 다수 에러(Length mismatch)→fail-soft penalty(foreign 약화, trend/실적/퀄리티만으로 5/11; step-2 전 foreign 점검 필요·B++ 버그 아님). **11-leader는 tripwire(합격기준 아님) — 정식 합격은 Gate A/B recall(step-2).**
- **다음 = gated step-2**: Gate A/B 실 12-24M PIT harvest(장시간 run + DART rcept_dt PIT + baseline 3종 wiring + foreign fetch 안정화) → 삼중 게이트 ALL PASS 시에만 `--scoring bpp --apply`(비용 0) → **Tier1 재선정(USER ₩25k)** → production short_list_30.

### Accept-gate de-mock + shortlist 재시드 + 스코어링 방법론 토론 (77차, 2026-06-11/12)
- **Accept 게이트 내부도구 완화 D31 (PR #120 MERGED·production 배포 success, main `83f06cc`)**: 사용자 재확인 "Accept가 클릭이 안 된다" → `computeAcceptGate` 코드 직독 = **정상 D15 게이팅**(D+4 Hold 06-15 + 2인 열람 0/2, auto-relief는 접속로그 테이블 부재로 영구 false 스텁) — 버그 아님. Accept=가상 포트 확정(실거래 아님)·3인 내부도구 맥락에 멤버서비스급 게이트가 과한 마찰. **사용자 결정 = 내부도구 완화**(AskUserQuestion). 구현: `gating.ts relaxGate`(24h hold만 유지·D+4·2인열람 면제) + caller(actions 서버집행 + page 표시) **default=relaxed**(env `PORTFOLIO_ACCEPT_GATE_STRICT=true` strict opt-in) + **relaxed면 viewer/auto-relief DB 조회 skip**(omxy R1 MED: DB/RLS 실패가 accept 차단·page crash 안 되도록) + UI 모드 배너 + holdExpiresAt 24h 기준(omxy R1 LOW). 순수함수 후방호환. §2.0a: Claude → omxy R1(1 MED+1 LOW) → fix → omxy R2 CONVERGED(독립 code-reviewer APPROVE+architect CLEAR). 게이트 build/lint 0·0/test:ci 1993+4skip/tsc clean·공개 canary 4/4. **Accept 버튼 활성 → USER 클릭 완료(2026-06-12 10:11 KST) → MVP② DONE**(approval accept·is_final + snapshot 14행). 멤버 공개(Deferred-D) 시 `PORTFOLIO_ACCEPT_GATE_STRICT=true` 필수.
- **Accept 버튼 disable 진단+fix (PR #119 MERGED)**: 사용자 "Accept 비활성화" → dynamic workflow + omxy 병렬 진단 = **오늘 disable는 정상 D15 게이팅**(business_days_bypass D+4 ~06-15) — 버그 아님. 그 아래 viewer-게이트 실버그: **REQUIRED_GATE_TICKERS legacy mock 5종 하드코딩**(비결정 strictness + 실 열람 무시, page/actions 중복=split-brain) → **공유모듈 `tudal/src/lib/portfolio/shortlist-gate.ts`로 단일화**(게이트=active 전종목, 결정론) + page/action createdAt anchor MAX 통일 + 2026 달력 **근로자의날(05-01)·제헌절(07-17, 웹 독립검증 18년만 재지정·거래소 휴장)** 추가(영업일 246→244) + gateMessage D+4중 viewer 표시. omxy R1(07-17·test breadth) → R2 CONVERGED. test:ci 1989+4skip. **production Accept 게이트가 active 30종 2인열람 요구로 정합화**(약화 아님=강화). **77차 후속 D31에서 내부도구 완화로 supersede**(위 항목).
- **shortlist 재시드 진행(비용 USER 승인)**: ① DART quarterly 캐시 **5,482행 무효화**(annual 4,700 보존, 76차 fix refetch 강제) → 직전 Tier0 run서 fixed 파서 재populate ② Tier0 dry-run b89 16 unresolved → **sector override 16 추가**(commit `2a66a95`: 반도체12/IT·SW1/바이오1/엔터·미디어1[엔피=WebSearch]/유통·소비재1) → 통과 → CSV 150 검증, **삼성전자 미진입**(SK하이닉스 long#40) ③ Tier1 보류.
- **스코어링 방법론 2차 토론 CONVERGED → B++** (사용자 핵심질문 "정말 상승 예측하는 스코어링이냐" + 실증 요구): **production 150 MCP 쿼리 = 대형 주도주 11개 중 SK하이닉스만 진입·나머지 10 누락**(소형 급등주 독식·long 5점폭 압축) → 사용자 직감 확증. **Claude 퀀트 에이전트 + omxy(트레이딩/퀀트 sub-agent + 한국 모멘텀 KCI 문헌)** 독립 수렴 = **B+ 단독 REJECT → B++**(main Opus 종합, 2 판정[11-leader→tripwire·IC scope+escalate] omxy 수용 + spec 2 MED/1 LOW fix). 근본원인 = 구조적 retrieval 실패(지속추세 시그널 부재 + 소형주 구성편향). **B++** = size sleeve + 유동성 플로어 + 모멘텀 재설계 + 수기가중치 폐기→rank ensemble + recall/rank-IC/size 삼중 게이트. AI 2차는 누락 구제 불가 = recall은 Tier0 책임. **다음 세션 실행 = [SoT: `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md`](B++ 전문)**.
- **다음 1순위** (↑ 위 B++ 1차 구현 entry로 supersede): step 0(survivorship)·②B++ 구현/harness = ✅ DONE(PR #121). 남은 것 = ③실 Gate A/B harvest + 파라미터 train-lock-OOS → ④omxy 적대검토 → **삼중 게이트 ALL PASS 시에만** 재screen→apply→Tier1(₩25k).

> B-SEL-CRON fix(77차, PR #118 MERGED — period-scoped due-gate + SELF_CONTINUE opt-out ON + orphan/stall/track alert + cost-month + finalize stale-guard, cron dormant) · 76차 이전(shortlist 정확성 PR #114, P4 75차 등) = git log + PR body.
