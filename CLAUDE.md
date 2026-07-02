# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⭐ 프로젝트 재정의 (2026-04-21 D16 · 2026-05-08 D18 시퀀스 v3 · 2026-05-08 D19 AI 강화 v3.1 · 2026-05-20 D21·D22 Tier 2 14×14 overlay + Kevin v3.1 quality target v3.2 · 2026-05-21 D23 53차 §5 정정 v3.3 · 2026-05-22 D24 54차 §3 PR3a MERGED + Group H Hard gate 해소 v3.4 · 2026-05-22 D25 PR1 MERGED v3.5 · 2026-06-02 e2e engine PR-D~PR-G ⓐ + 비용0/FE-audit + launch-readiness PR #79(A~E) MERGED, main `532a0a5` · **2026-06-04 D26 65차 7결정 + D27 Q5 + D28 LOCKED — Q1 선정주기 분리(단기 주1회/중장기 월1회) · Q2 AI 자율 포트구성 · Q3 멀티프로바이더(Claude+GPT) 모델 추상화 · Q4 실시간 반박 토론 loop · hardcap 50만원 · 역할별 모델 차등(D28 재정의: 목적함수=예측 적중률+리포트 정확성, hardcap=제약 — 구 "토론 저가/최종 고가" 비용 기준 supersede) · MVP=30리스트+포트폴리오+30리포트 정확. 빌드 순서 W0✅→W2a✅→W2b✅→W1a✅→W1b✅→W3a✅→W3b-1✅→W3b-2a✅→W3b-2b✅→W3b-3✅→W3b-2c✅(W3b-2c 명시 cash row ✅ MERGED PR #102, main `9698d74`; W3·W3b·MVP 엔진 코드 + 키-free 하드닝 완결) · Q5(D27, 같은 65차 후속) = 펀드식 incumbent thesis 재점검 — 모든 트랙(단기 주1회 포함) 재선정 시 기존 종목은 직전 리포트·논거+실현 성과 컨텍스트로 재평가(유지=신규와 top10 랭킹 경쟁 · W2b 후보풀=fresh Tier0 ∪ incumbents + W1 주입 · PR-K Reflection과 별개 · **68차 W2b로 구현 ✅ PR #91**) · **D28(같은 65차 후속) = 프로바이더 위상·역할→모델 기본 배분** — D28 당시 Anthropic-first primary/GPT 선택 secondary(GPT-only 미지원; **D35에서 이 전제는 GLM 5.2(OpenRouter) primary + Claude fallback으로 supersede, GPT 불변**), MVP 기본=두 키 동시 사용(UI 토글 후순위), 토론 Core11=Sonnet4.6×6+GPT mid×5 혼합(가설 기본값, track-record로 조정)·R2 선택적(config)·judge Opus4.8+경계 dual-judge·critic GPT 교차·W3 포트판단 Opus4.8 + W0 비용가드 3종(GPT/Opus4.8 단가 등록·unknown model fail-closed·model-aware reservation). 상세 = HANDOFF.md ⭐ 65차 MVP 엔진 섹션 — 현 진행 상태 live SoT = `Document/Process/HANDOFF.md` · 2026-06-24 D32 — Reflection/PR-K(AI 자가 학습) 출시 전 승격: 빌드 + S9 운용 검증 중 가동·검증(구 "출시 후 defer"[62차 doc-class] supersede, MVP 3종 불변)**)

**어드민 = 본인 + 친구 2명(총 3명)이 주식·코인 투자를 편하게 하기 위한 내부 도구**.

- 멤버(500cap 초대)·MVP Stage·Friends & Family Beta 같은 공개 서비스 프레임은 **별도 트랙 (Deferred-D)** 으로 분리되어 있으며, 현 개발 플랜과 관련 없음.
- "Must 19 / MVP Stage 1·2" 어휘는 어드민 트랙에서 **강제 게이트가 아님**. 내부 도구 완성도 관점으로만 해석.
- 자동매매는 **S8 단일 슬라이스**로 통합: 주식(KIS 모의→실계좌) + **코인(바이낸스 USDT-M 선물 테스트넷→메인넷)**. "Stage 1 매뉴얼 → Stage 2 API → Stage 3 AI 자율" 어휘는 폐기. **S8 = 출시 후 개발** (사용자 결정 2026-06-01: 출시는 자동매매 없는 "AI 추천 + 가상 포트 + 알림" 도구까지, 자동매매는 어드민 3인이 실운용하며 보면서 개발).
- 자동매매 의사결정 엔진은 **Strategy 파일 drop-in + AI 어댑터 embed** 이중 경로. AI agent·skill 본체는 어드민이 추후 drop-in.
- 리스크 가드레일 기본값 (S8에서 박제): 레버리지 ≤ 5x · 일일 손실 -3% 자동 정지 · AI 일 주문 ≤ 20회.
- 법무(Q16)·이용약관(Q17): Deferred-D 재개 전까지 불필요. Footer 면책으로 충분.
- **D18 (2026-05-08)**: KIS는 **자동매매 전용** (S7c WS read-only는 본인 1개 충분, 일간 데이터·AI 가상 포트는 KRX/pykrx/DART/네이버로 KIS 0개). son00326·Kevin KIS 발급 지연 = S7c까지 비블로커. S8 자동매매는 D11 AI 가상 포트 운용 검증 후로 분리 (**2026-06-01 supersede: S8 = 🎉 출시 후. 순서 = S7d → S9 운용 검증 → 출시 → S8**).
- **D19 (2026-05-08, 35차 · 2026-05-21 53차 §5 정정)**: Short List 30 선정 = **"숫자(인디케이터) + AI(Core 11 페르소나) 병렬 + 합의 에이전트" + Reflection(자가학습)** 구조. **Tier 0** = 인디케이터 자동 스크리닝(코스피·코스닥 → 단/중/장 후보 50씩, AI 키 불필요). **Tier 1** = Core 11 평가 + 시간대별 페르소나 가중치(단/중/장 각 10). **Tier 2** = Sector Board 14×10에서 30종목 해당 섹터 14명만 활성화(비용 통제, S7a 후속 PR). **합의 배지 5종 (49차 Q5b)**: 🟢 강한 합의 · 🔵 숫자 우세 · 🟣 AI 우세 · 🟡 관망(신규) · ⚪ AI 분석 대기. **메인 path = Tier 0 + Tier 1 AI 합의** (Tier 0 단/중/장 후보 150 → Tier 1 Core 11 AI 평가 + 시간대별 페르소나 가중치 → 단/중/장 top 10 = 30 선정 + 30 풀 리포트 단일 산출물). **fallback = AI 키 미발급 시 Tier 0 단독 30 직선정** (**73차 supersede 2026-06-09: 풀 P3 실행으로 메인 path[실 AI 선정] 가동 완료 — 현 production = `short_list_30` 2026-06-01 실 AI 30, consensus_badge/ai_score populated; Tier0 단독은 이제 AI 키 미발급 시에만**). Tier 2 sector plug-in은 후속(P2b/P4·PR-I). **Reflection** = 매월 말 실현 수익률 → 다음달 prompt 주입 (TauricResearch/TradingAgents 차용, S7a 후속 PR). **Smoke #3 (Binance) ⏸ 유예** (S8까지). **(65차 supersede, 2026-06-04)**: Tier 1 Core 11 병렬 독립 채점 + 결정론 합의 에이전트 구조 → **실시간 멀티라운드 AI 반박 토론 loop**로 확장(Q4, 합의 점수로 선택, 빌드 순서 W1 구현). 선정주기 = (Q1) 단기 주1회 / 중장기 월1회 분리 → 단일 월배치 동시선정 어휘 stale(W2에서 split). live SoT = HANDOFF.md ⭐ 65차 MVP 엔진 섹션. 상세 SoT: `ServicePlan-Admin.md §1A.5 D19` + `Service/Report/ReportFramework.md §8`. **(D30, 77차 2026-06-12)**: Tier 0 스코어링 방법론 타당성 재검토 — "후보 150이 정말 향후 상승할 기업을 올바르게 예측·선별하는 스코어링이냐"(사용자 핵심 질문). **실증(production 150 MCP 쿼리): 대형 상승 주도주 11개 중 SK하이닉스만 진입·나머지 10 전부 누락**(소형 급등주 독식·long 5점폭 압축) → 사용자 직감 확증. Claude 퀀트 에이전트 + omxy(퀀트 sub-agent) 2 독립 토론 = **B+(정규화/경량 IC) 단독 REJECT → B++** (main Opus 종합). 근본원인 = 구조적 retrieval 실패(지속추세 시그널 부재 + 소형주 구성편향, B+ 정규화로 못 고침). **B++** = size sleeve(대/중/소 lane + 유동성 플로어) + 모멘텀 재설계(risk-adjusted 멀티호라이즌 trend + 52주 고가) + 수기가중치 폐기→rank ensemble + **recall/rank-IC/size 삼중 게이트**(AI 2차는 150 누락 구제 불가 → recall은 Tier0 책임). **삼중 게이트 통과 전 --apply/Tier1 비용/"향후 상승 예측" claim 금지** — 산출물 설명은 "robust, factor-informed, leader-inclusive candidate shortlist"까지만. **(D30 step-2 실행 완료, 77차 후속 PR #122 MERGED `285339a`)**: harness + 실 19개월 PIT harvest(순수 trend+size, 비용 0) 실행 → **triple-gate FAIL**(Gate A recall 0.108<0.20 단 **B++>baseline + largemid 0.431 + leaders 7/11**[73차 1/11] · Gate B IC IR 0.26<0.30 large-IC +0.08 · Gate C PASS) → **Claude↔omxy CONVERGED**. ⇒ B++ = 대형 retrieval 개선 실증 + naive baseline 상회(복잡도 정당화)하나 절대 예측 임계 미달 + earnings/foreign 부재 → **diagnostic leader-inclusive generator, --apply/Tier1/"상승 예측" 전부 금지·미실행**. **다음 = USER 결정**: (a) 깨끗한 full-factor verdict = DART rcept_dt 스키마+backfill + foreign backfill → unchanged 게이트 rerun, 또는 (b) diagnostic generator 유지. production short_list_30/tier0_candidates_150 2026-06 = 미변경(73차). SoT spec = `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md` §5/§6(verdict 박제) + review doc `docs/superpowers/reviews/2026-06-12-tier0-bpp-step2-harvest-review.md` + `ServicePlan-Admin.md §1A.5 D30`.
- **D23 (2026-05-21, 53차 §5 정정)**: 박제 vs 코드 mismatch 정정 spec 박제 — Group A-H 8그룹 catch (A track-record trigger 위치 오해 / B 30종목 AI 부재 / C cron mock dry-run / D Step 3c "DONE" 박제 → **PARTIAL — dangling server action** / E writer Section 0~7 미구현 / F Track Record 의미 / G Sector reference 3-level 분류 / **H stock_reports schema drift + report page crash 위험 Critical**). **canonical PR 순서 = PR2 → PR3a → PR1 → PR3b → PR4** (PR3a Group H schema drift fix가 PR1 cron 가동 전 Hard gate 선행 필수). omxy 적대적 검토 5 rounds CONVERGED + 누적 16 BLOCKERS catch & fix. 정정 spec doc: `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md`.
- **D25 (2026-05-22, 54차 §4 PR1 ✅ MERGED in main `4aa3130` + Migration 0020/0021 production applied + Vercel canary OK + 3-track deep review Fix-First)**: PR #13 (PR1 cron `monthly-batch` real path enable + server-callable trigger function) **MERGED in main `4aa3130` via rebase FF + delete-branch + worktree cleanup 완료** (https://github.com/son00326/New_Project_KR_Stock/pull/13). 15 commits FF. **Migration 0020 + 0021 production applied (omxy R22~R23 교차검증 CONVERGED)**: short_list_30 metadata 3 컬럼 nullable + acquire_batch_lock_v2 SECURITY DEFINER 4-grant (public/anon=false, authenticated/service_role=true) + started_by drop NOT NULL + lineage comment. **Vercel canary 4 페이지 OK** (dpl_SakD5kb3MkwARLSxRgDMGXxtxm72 READY · `/` 200 / `/login` 200 / `/macro` 200 / `/admin` 307→/login). **USER 잔여 액션 = 0**. 25 files / +2759 / -158 / 60 TDD tests (802 → 862). **신규 SoT 코드**: 마이그 0020 (short_list_30 metadata 컬럼 nullable) + 마이그 0021 (acquire_batch_lock_v2 cron caller SECURITY DEFINER + started_by drop NOT NULL + lineage comment) + service-role client (server-only + Vitest alias) + cron lock helper + alert insert helper (DI) + orchestrator (8 DI fields) + persist (client DI + delta_status='new' + stale row delete + TICKER_RE 6-digit validation) + cron route refactor + `triggerMonthlyBatch` admin server action + format-error +16 keys +6 prefix. **omxy R1~R15 15 rounds CONVERGED + 누적 30 BLOCKERS catch & fix** (PR1 R1~R12 23 [plan 20 + impl 2 + Fix-First B23] + post-merge docs R13~R14 4 [B24~B27] + merge sequence R15 3 [B28~B30]). R12 = R7 Codex `/review` GATE PASS 등가. **3-track deep review (gsd-code-reviewer 부재 대체 패턴 첫 적용, 54차 §4 박제)**: Track 1 `gstack-review` skill inline + Track 2 `general-purpose` agent depth=deep (14 findings) + Track 3 `superpowers:code-review` skill 5-angle scan (10 findings). Fix-First C1+MF1~MF5+B23 / Defer 7 follow-up tickets (W1/W3/W4/W6/W7/#4/#9). **canonical 5-PR 순서 갱신: PR2 ✅ → PR3a ✅ → PR1 ✅ MERGED in main `4aa3130` → PR3b → PR4**. **Group C + Group D 절반 해소** (Group E + G PR3b 대기, Group A + F + D 잔여 PR4 대기). **⚠️ gsd-code-reviewer 환경 부재**: 외부 환경 agent였음. PR3b/PR4 이후 모든 deep review는 3-track 대체 패턴 강제 (gstack-review + general-purpose depth=deep + superpowers code-review). 박제 자료: `docs/superpowers/plans/2026-05-22-pr1-cron-real-path.md` (plan v8 with omxy R1~R10 CONVERGED + 22 BLOCKERS + 3-track Fix-First v8 헤더) + PR #13 body.

- **D24 (2026-05-22, 54차 §3 PR3a MERGED + Group H 해소)**: PR #12 (PR3a Group H stock_reports schema drift fix Critical Hard gate) MERGED in main `0813a41`. 11 commits FF / 7 files / +3300 lines / 56 TDD tests (746 → 802). **신규 SoT 코드**: `tudal/src/lib/data/report-section-schemas.ts` (Section 0~7 + Appendix zod bounds + Section 8 dual-shape import from `@/lib/report/section-8-schema` + `parseSectionSafe`/`parseReportSection8` onError 콜백 + `partCToCommitteeAgg` pure helper) + `admin-reports.ts::transformStockReportRow` (per-section safeParse + `ValidatedStockReport` + ticker/section context console.warn) + `page.tsx` (`as` 어서션 10개 제거 + section null guard + `SectionFallback` + Section 8 modern/legacy dual renderer + `partC` authoritative). **omxy R1~R12 CONVERGED + R7 Codex structured `/review` GATE PASS** (omxy 21 BLOCKERS catch & fix: R1~R4 B1~B10 plan + R5~R6 B11 impl + R7 Codex GATE PASS + R8 B12~B14 merge preflight + R9~R10 B15~B19 docs verify + R11 B20 round count + R12 B21 BLOCKERS count). gsd-code-reviewer (depth=deep) + gstack testing + gstack red-team 다중 review는 별도 통계 (42 findings, 17 Fix-First, 24 OOS). **canonical 순서 갱신: PR2 ✅ → PR3a ✅ → PR1 → PR3b → PR4**. Group H Hard gate 해소. **잔여 silent null drop은 PR1 wire 시점에 console.warn → metric/structured log로 격상 권장** (gsd CR-01 + red-team RT#2 + omxy R7 P2). 박제 자료: `docs/superpowers/plans/2026-05-22-pr3a-group-h-schema-drift.md` + `docs/superpowers/reviews/2026-05-22-pr3a-group-h-schema-drift-review.md`.

- **D32 (2026-06-24, USER 결정 — Reflection/PR-K 출시 전 승격)**: AI 자가 학습(Reflection / PR-K — 직전 선정 사이클 실현 성과 → 다음 선정 prompt 주입 → 페르소나 가중치 자가조정, TradingAgents trading_memory 패턴)을 **"출시 후 defer" → "출시 전 빌드 + S9 운용 검증 기간 중 실가동·검증"** 으로 승격. 근거 = "출시 후" 라벨은 62차(2026-06-02) Claude 문서정합 분류(git `8fc91d4`·`2809f0e`)였지 USER 명시 결정이 아니었고(도입 35차/D19엔 "S7a 후속 PR" = 당시 슬라이스 순서상 출시 전 구간), 데이터 의존성(직전 실현 수익률 → 다음 prompt)은 S9 운용 검증 창(출시 전 1개월+ 실 선정 운용)이 충족 → 출시 시점엔 (단기/주간 트랙 기준) 이미 작동하는 자가학습(중장기 월간은 S9 길이·첫 선정일 의존·no-op fail-soft, spec §4). **MVP 핵심 3종(30리스트/포트/30리포트, 65차 USER 잠금)은 불변 — Reflection은 대체 아님·launch-readiness 항목으로 추가**. Q5 incumbent thesis(D27, 선정 시점·구현됨 PR #91)와 `reflectionContext` seam 공유하나 별개. 상세 SoT = `docs/superpowers/specs/2026-06-24-reflection-prk-pre-launch-promotion.md` + `ServicePlan-Admin.md §1A.5 D32`.
- **D35 (2026-07-01, USER 결정 — 출시 전 UX/UI 정리 + GLM primary)**: **(모델 차원)** Claude/Anthropic 호출을 **GLM 5.2(OpenRouter) primary + Claude fallback**으로 전환(GPT 불변) — 구 D28 A Anthropic-first primary 전제(65차) supersede(D28 목적함수·hardcap·fail-closed는 계승). provider 추상화(W0) 위에 신규 `openrouter-provider`(Chat Completions·reasoning_effort high·JSON 역할만 json_object·length→transient·apiKey 가드) + `model-registry` provider record 맵 + `MODEL_PRICING glm-5.2`(z-ai/glm-5.2) + 주요 AI 게이트 provider-agnostic. `OPENROUTER_API_KEY` 부재 시 `ANTHROPIC_API_KEY`가 구성돼 있으면 Claude fallback, 둘 다 부재하면 fail-closed. **main `c25c061` 머지·Vercel prod 배포 완료**; OpenRouter 키가 주입된 환경에서 GLM primary가 활성화된다. 실측 검증은 OpenRouter 계약(`reasoning_effort`/`response_format`)과 JSON 역할 스모크 기준이며, GLM 출력 품질 지속 검증 = eval-harness(D28 목적함수). **(UX/IA 차원, 상세는 ServicePlan-Admin)** 사이드바 3구역 한글화(Track Record·Decision Tree 영어 유지·내부코드 제거) · 홈 "현재 운영 중 + 이번 달 추천 30 + 추천 30 섹터 분포 + 보유 중 뱃지" 대시보드 · 포트폴리오 중복 30 제거→확정 운영뷰 · "섹터 추천 비교"→"종목 선정 방식 비교 (실험)" relocate/reword · 제품화면 은어 평이화 · 토스 심화 폴리시. **원칙**: 제품(P) 화면 vs 내부 R&D(R) 화면 위계 분리 + 제품화면 은어 0. 4-스텝 프로세스(Claude dynamic workflow → omxy 리뷰+수정 → Claude 적대 리뷰+수정 → omxy 재검토 CONVERGED, 구현·문서 동일). 상세 SoT = `docs/superpowers/specs/2026-07-01-prelaunch-ux-cleanup-4items.md` §10 + `2026-07-01-toss-polish-policy.md` + `ServicePlan-Admin.md §1A.5 D35`.

> **세션별 진행 박제** (36차~49차 등): `Document/Process/HANDOFF.md §6` (최근 1차) + `Document/Build/ProgressDashboard.md` + `Document/Build/Slices/S7-RealData.md` + `git log`. CLAUDE.md는 자동 로드되므로 세션 박제 잔존 금지 — 사업/데이터 모델 차원 결정(D16~D25, D32, D35)만 남긴다.

**현 진행 순서** (live SoT = `Document/Process/HANDOFF.md §2` + `Document/Build/ProgressDashboard.md §2`; CLAUDE.md는 결정 레코드만 유지하고 세션별 진행 박제는 반복하지 않음):
```
Mock Skeleton ✅
  → DQ-7 Admin Credential (Smoke #4·#5 잔여 · Smoke #3 ⏸ S8까지 유예 · Session 4 QA 잔여)
  → S7e (Supabase 실 I/O 전면) + Tier 0 인디케이터 게이트 (AI 키 불필요)
       ├ T7e.1 마이그 0010 검증 ✅ (36차)
       ├ T7e.2 shortlist Supabase SELECT ✅ (36차)
       ├ T7e.3 reports/committee Supabase SELECT ✅ (37차)
       ├ T7e.4 approvals/snapshots 실 I/O + race ✅ (38차)
       ├ T7e.5 regen-counters CAS race-safe ✅ (39차)
       ├ T7e.6 access-logs/performance/decision-tree ✅ (40차)
       └ T7e.8 Tier 0 인디케이터 (마이그 0012 name/sector + 0013 dart_corp_codes + 0014 dart_financial_cache · `short_list_30` 2026-05-01 30 rows production 적용 · DART 실 standalone/quality 기반 Signal 4·5) ✅ (41~45차)
  → S7a (Anthropic wrapper) ✅ 완료 (PR #1 `61653d22`) · 실 AI 첫 30선정 진입 대기 — 65차 supersede: PR-G ⓑ 단발 → W0✅→W2a✅→W2b✅→W1a✅→W1b✅→W3a✅→W3b-1✅→W3b-2a✅→W3b-2b✅→W3b-3✅로 분해, 코드자산 재사용 (상세 HANDOFF §2 ⭐ 65차 MVP 엔진)
  → **Tier 2 D21 (52차)** ── ✅ **scaffold + production schema MERGED in main** (PR #4 + PR #5 + PR #6 historical, 마이그 0018·0019 production applied)
       · **D21 박제**: canonical 14 sectors × 14 personas/sector overlay (10 base + 2 primary + 2 sub_tag) + sub_tag crosswalk 7개 (조선→운송/물류 · 방산→철강/소재 · 화학→철강/소재 · 게임→IT/SW+엔터/미디어 · 가전→유통/소비재 · 제약→바이오 · 부동산→건설)
       · **신규 SoT 코드**: `tudal/src/lib/screening/canonical-sectors.ts` (CANONICAL_SECTORS 14 + 상수 + helper) · `writer.ts` commitSectorReport + parseSectorContentStrict · `persona-eval.ts` runSectorEval scaffold · `mock-admin-committee-personas.ts` 196 stub (legacy 5인 105 격리 보존) · 마이그 0018 (sub_tags jsonb) + 0019 (commit_sector_personas RPC)
       · **D22 박제**: Tier 2 production prompts 196 quality target = **`origin/IMVCOM @ 1faee1b` Kevin v3.1 reference** (Step 3a Kevin 정합 머지 PR 진입 대기)
       · **출시 Runbook/현재 위치 live SoT = `Document/Process/HANDOFF.md §2`** (주간 tier0 producer·Telegram·KIS·FUNNEL/INTRADAY·flag flip/S9 포함)
       · MVP 엔진 W0~W3b-2c 완료·상세 이력/중간 단계는 `Document/Process/HANDOFF.md §2`를 SoT로 참조
       · **🔑 키 구조 (live · 65차 Q3 + D28, D35 supersede)**: AI 프로바이더 키 = 공통(shared) — `OPENROUTER_API_KEY`(GLM 5.2 primary) + `ANTHROPIC_API_KEY`(Claude fallback) + `OPENAI_API_KEY`(GPT 역할/secondary). provider availability auto-detect — OpenRouter 키 없고 Anthropic 키가 있으면 Claude fallback, 둘 다 없으면 AI role fail-closed; GPT-only는 여전히 미지원. 모델 하드코딩 제거 + 역할별 차등은 D28 품질 목적함수(예측 적중률+리포트 정확성, hardcap=제약) + D35 GLM primary 레지스트리 기반. "Anthropic 유일 공통" / "Anthropic-first primary" / "토론=저가" 어휘 stale (상세 HANDOFF ⭐ 65차 MVP 엔진) / KIS·Binance = per-admin(DQ-7 암호화 저장) · KIS 현재 3명 중 1명만 보유(다른 1명 모의 키) → **사용자 포함 2명 발급 필요** (S7c read-only 시세는 1개 충분, S8 자동매매는 3명 each)
       · T7e.7 RLS 브라우저 수동 QA는 D11 운용 검증 직전 마무리 (1시간 안짝 수동)
  → [65차 supersede → MVP 엔진 W0~W3b-2c 완료 · 상세/current는 HANDOFF §2] ~~PR-G ⓑ 실 AI 첫 30선정 → PR-H → PR-I·PR5b Tier2 → PR-J~~ (구 D11-전 hard gate 경로 — 코드자산은 W0~W3 토대 재사용)
  → S7b (뉴스+브리핑)
  → ★ D11 AI 가상 포트 1차 가동 (KIS 0개 · 진입 전 위 hard gate 완료 필수 · **메인 path = ~~Tier 0 + Tier 1 AI 합의 + Tier 2 plug-in~~ → 65차 supersede: W0~W3 엔진(Q3 멀티프로바이더 + Q4 실시간 반박 토론 loop + Q2 AI 자율 포트 + Q1 주간/월간 split), 구 합의+plug-in 문구는 역사/코드자산** · fallback = AI 키 미발급 시 Tier 0 단독 30 직선정)
    어드민 3인 운용 검증 며칠~1주 (실 종목 30개 + 합의 배지 + AI 코멘트 검증)
  → S7c (장중·KIS WS · KIS read-only 1개 — B-10, 현재 3중 1 보유) → S7d (Silent Health)
  → (S7d 후·S9 진입 전) PR-K Reflection은 빌드 완료·dormant(main `fd145c2`) + `reflection-job` cron 등록(#129); 잔여 = `REFLECTION_*` flag flip + S9 운용 검증 → 🎉 출시 (자동매매 없는 "AI 추천 + 가상 포트 + 알림" 내부 도구 · 단기/주간 트랙 자가학습 작동 — 중장기는 spec §4 타이밍)
  → [출시 후] S8 자동매매 (분리 단독 진입 · 어드민 3인 실운용하며 보면서 개발 · Binance Smoke #3 여기서 진행)
```

---

## 📚 Document System (AUTO-RECOGNIZE)

This repository uses a **문서 기반 플래닝 시스템**, organized into subfolders under **`Document/`**. Each document has a distinct purpose. At session start, Claude MUST recognize all documents and route updates to the correct one. **Never collapse them, never duplicate content across files, never write business decisions into HANDOFF.md or service progress into BusinessPlan.md.**

### 핵심 문서

| # | File | Purpose | Who writes | Update trigger |
|---|---|---|---|---|
| 1 | `Document/Business/BusinessPlan.md` | **사업 방향 (frozen-ish)**. Q1~Q11 확정본, 3-Layer 구조, 재무, 법, 핵심 의사결정 기록. 서비스 UX/UI·화면 구성은 여기 없음. | User + Claude(planner/analyst/critic) | 사업 피벗·재무·법적 구조 변경 시 |
| 2 | `Document/Service/Planning/ServicePlan.md` | **인덱스 + 공통 원칙**. 어드민/멤버 sub-doc 포인터, BusinessPlan 파생 제약, 공통 원칙(인증 분리·라우트 그룹·디자인 시스템·면책 Footer). **상세 기획 없음 — sub-doc 참조.** | Claude | 공통 원칙 변경 시 |
| 2a | `Document/Service/Planning/ServicePlan-Admin.md` | **어드민 메인 서비스 기획 본체**. 사용자·JTBD, 화면 IA·라우트, 기능 스펙, 데이터 모델, 제약. 어드민(3명 가정) 전용. **서비스 기획 편집 1순위.** | Claude(product-manager) + User | 어드민 서비스 기획 확정·변경 시 |
| 2b | `Document/Service/Planning/ServicePlan-Member.md` | **멤버 페이지 기획 본체**. 멤버(500cap 초대) 전용. Research 보강 블로커 있음 (경쟁사 리서치 선행 필요). | Claude(product-manager) + User | 멤버 서비스 기획 확정·변경 시 |
| 3 | `Document/Process/ExecutionPlaybook.md` | **슬라이스 기반 개발 방법론** (S0 Foundation → S6 Hardening). Lifecycle·에이전트·스킬 매핑·하네스 호출 시점·병렬 원칙. Waterfall(Phase/BuildPhase) 대체. | Claude(meta) | Lifecycle·에이전트·스킬 매핑 변경 시만 |
| 4 | `Document/Build/ProgressDashboard.md` | **전체 슬라이스 상태판**. 슬라이스별 status(⚪🟢✅⏸)·Must 19 진행률·Global Blocker. 주간 스냅샷 뷰. | Claude | 슬라이스 상태 변경·Must 진행률 갱신 시 |
| 5 | `Document/Build/Slices/S?-*.md` | **현재 슬라이스 상세** (일상 작업 파일). Tasks·DoD·의사결정 로그·완료 체크리스트. 슬라이스 내부 작업 1순위 편집 대상. | Claude + User | Task 진척·DoD 체크·의사결정 박제 시 |
| 6 | `Document/Process/HANDOFF.md` | **Session continuity + 다음 세션 포인터**. 🟢 현재 슬라이스 / 🔴 다음 행동 / 🟡 미결. 경량화 — 상세는 Slice 파일 참조. | Claude | 모든 세션 종료 시 필수 갱신 |

### 보조 문서

| File | Purpose |
|---|---|
| `Document/Process/CodebaseStatus.md` | **현재 지향** 스냅샷. 라우트·파일 수·mock vs 실데이터·환경변수. 구조 변화 시 덮어쓴다. |
| `Document/Service/Report/ReportFramework.md` | AI 투심위 보고서 프레임워크 SoT (Section 0~8 + Appendix, Core Committee, Sector Board). |
| ~~`Document/Service/Planning/AutoTrading.md`~~ | **2026-04-22 `Document/Archive/`로 이관** — D11 이전 자동매매 독립 트랙 가정 기반 리서치 원자료. |
| `Document/Build/SliceTemplate.md` | 신규 슬라이스 파일 생성 시 참조 템플릿. |
| `Document/Build/Slices/DQ7-Credentials.md` | Admin Credential System 슬라이스 (2026-04-22 신설 · per-admin API 키 UI + AES-256-GCM 암호화 + Vercel 첫 배포 · Session 3 부분 진행 · Smoke #4/#5 + Session 4 QA 잔여). 1순위는 `HANDOFF.md §2` 참조. |
| `Document/Build/Slices/S7-RealData.md` | 실데이터 전환 슬라이스 (S7a Anthropic → S7e Supabase → S7b 뉴스/브리핑 → S7c 장중/Exit → S7d Silent Health). DQ-7 완료 후 진입. **D18 (2026-05-08)**: S7b 후 D11 AI 가상 포트 1차 가동 게이트 명시 (KIS 0개). |
| `Document/Build/Slices/S8-AutoTrading.md` | **자동매매 프레임 슬라이스** (주식 KIS + 바이낸스 선물, Strategy drop-in + AI 어댑터 embed, 2026-04-21 D16 승격). `/admin/settings/{brokerage,binance}` UI는 DQ-7에서 선행 이관. **D18 (2026-05-08)**: S7a·S7e 후 병행 → S7d 후 단독 진입으로 분리. **2026-06-01**: 🎉 **출시 후로 재배치** (순서 = S7d → S9 운용 검증 → 출시 → S8). |
| ~~`Document/Service/Planning/AutoTrading-AI구조설계.md`~~ | **2026-04-22 `Document/Archive/`로 이관** — AI 구조 초안(D11 이전) · S8 AI 어댑터 drop-in 시 참조 원자료. |
| `Document/Archive/` | 폐기된 방법론·리서치 원자료 보관: `Phase.md`·`BuildPhase.md` + **2026-04-22 추가** `AutoTrading.md`·`AutoTrading-AI구조설계.md` (D11 이전 자동매매 독립 트랙 가정 기반 · S8 AI 어댑터 drop-in 시 참조). 참조·편집 금지. |
| `Document/Process/Memo/*.md` | 세션별 메모·기준선 정리. 참조용. |

> **Folder convention**: `Document/Business/` (사업), `Document/Service/Planning/` (서비스 기획: ServicePlan 인덱스·Admin·Member), `Document/Service/Report/` (AI 리포트 방법론: `ReportFramework.md` SoT + 초안 `ReportFramework-v3-*` 및 `ReportFramework-BioSector` + `ReaderAnalogyCards-ConstructionToBio`), `Document/Service/Build/` (슬라이스 산출 스펙: FRD·Scenario·ScreenSpec — 필요 시 슬라이스 내부에서 생성), `Document/Build/` (슬라이스 실행: `ProgressDashboard.md` + `Slices/S?-*.md` + `SliceTemplate.md`), `Document/Process/` (방법론·세션·메모 — `ExecutionPlaybook.md`가 중심), `Document/Archive/` (폐기된 방법론·리서치 원자료: `Phase.md`·`BuildPhase.md` + `AutoTrading.md`·`AutoTrading-AI구조설계.md`(2026-04-22 이관, D11 이전 자동매매 독립 트랙 가정) — 참조 금지), `Document/Research/` (리서치 원자료), `Document/Outputs/` (생성 리포트·백테스트 산출물).

### Entry routine (매 세션 시작 시 자동 수행)

1. **Read in order**: `HANDOFF.md` → `Document/Build/ProgressDashboard.md` → **현재 슬라이스** `Document/Build/Slices/S?-*.md` → `ServicePlan-Admin.md` → `BusinessPlan.md` → `Document/Process/ExecutionPlaybook.md` → `CodebaseStatus.md`. (ServicePlan.md 인덱스·ServicePlan-Member는 해당 작업 맥락일 때만 추가.)
2. **Identify current slice**: `ProgressDashboard.md`에서 🟢 상태 슬라이스를 확인. 해당 `Slices/S?-*.md`의 Tasks 체크리스트에서 **다음 미완료 Task**를 1순위로 채택. 기획 보강 필요 시 `ServicePlan-Admin.md` 해당 섹션으로 우회.
3. **Lookup agent/skill**: `ExecutionPlaybook.md` §2 (단계별 매핑 표)와 §3 (하네스 호출 시점)에서 현재 Task 단계(킥오프/설계/구현/실데이터 연결/QA/클로즈)에 해당하는 Primary·Secondary·Skill을 확인. Playbook에 없는 예외 작업만 `~/.claude/skill-routing.md` + Skill Sources 표로 fallback.
4. **Announce**: "이번에 〈슬라이스 S? — Task명〉을 〈단계: 설계/구현/…〉로 〈에이전트/스킬〉을 사용해 진행합니다. Uncertainty: 〈낮/중/높〉"를 사용자에게 먼저 고지. "중간" 이상은 사용자 재확인을 요청.

### Update routing (무엇을 어디에 쓸 것인가)

| 변화 유형 | 기록 위치 |
|---|---|
| 사업 피벗, 재무 가정, 법적 원칙 변경 | `BusinessPlan.md` §"핵심 의사결정 기록" |
| 어드민 서비스 기획 확정 (IA / 기능 / 데이터 / UX) | `ServicePlan-Admin.md` 해당 섹션 |
| 멤버 서비스 기획 확정 (IA / 기능 / 데이터 / UX) | `ServicePlan-Member.md` 해당 섹션 |
| 어드민·멤버 공통 원칙 변경 (인증 분리, 디자인 시스템 등) | `ServicePlan.md` §3 |
| Task 진척 (체크리스트·DoD 체크) | 현재 `Document/Build/Slices/S?-*.md` |
| 슬라이스 상태 변경 (⚪→🟢→✅, ⏸) | `Document/Build/ProgressDashboard.md` 표 + 해당 Slice 파일 status 필드 (동시 갱신) |
| 블로커 해소 | 해당 Slice 파일 "의사결정 로그" + `ProgressDashboard.md` §Global Blocker |
| 에이전트·스킬 매핑 변경 | `Document/Process/ExecutionPlaybook.md` §2 |
| 방법론 리파인 (슬라이스 실행 중 깨달은 개선점) | `ExecutionPlaybook.md` §1·§3·§9 변경 이력 |
| 세션 종료 시 작업 큐 갱신 (다음에 할 일) | `HANDOFF.md` |
| 현재 코드베이스 스냅샷 (라우트·파일·환경변수) | `CodebaseStatus.md` |

**원칙**: BusinessPlan은 천천히 변한다. ServicePlan-Admin/Member는 기획 중 자주 변한다. ServicePlan.md(인덱스)는 공통 원칙 변경 시만. ExecutionPlaybook.md는 드물게 변한다(방법론 개선 시만). 현재 Slices/S?-*.md는 매 세션 변한다(일상 작업 파일). ProgressDashboard.md는 슬라이스 상태 전이 시 변한다. HANDOFF.md는 **미래 지향**(다음에 할 일)으로 매 세션 변한다. CodebaseStatus.md는 **현재 지향**(지금 있는 것)으로 구조 변화 시 덮어쓴다.

### Auto-recognition hints (파일 판정 규칙)

- `BusinessPlan` → 사업 레벨. 코드 변경 전에 먼저 참조. 서비스 UX/UI 내용 없음.
- `ServicePlan.md` (확장자만, sub-doc 아님) → **인덱스 + 공통 원칙**. 상세 기획은 여기 없다.
- `ServicePlan-Admin` → **어드민 내부 도구 기획 본체** (v1.4, 2026-05-08 D18). 서비스 기획 편집 1순위. **핵심 개념**: (a) D11 AI 가상 포트 본체 + 3경로 집행(주픽 매뉴얼·주픽 자동매매 S8·외부 바이패스). 승인(Accept)=가상 포트 확정(성능 측정용), 실제 체결은 어드민 독립. (b) D16 어드민 = 내부 투자 도구, Stage 어휘 폐기, 자동매매(주식+바이낸스 선물) S8 통합. (c) D17 DQ-7 Admin Credential System — per-admin UI + AES-256-GCM 암호화 + Vercel 첫 배포 선행 트랙. (d) **D18 S8 자동매매 진입 시점 재조정 — KIS 발급 비블로커화 + D11 AI 가상 포트 운용 검증 게이트** (**2026-06-01 supersede: S8 자동매매 = 🎉 출시 후. 순서 = S7d → S9 운용 검증 → 출시 → S8**). 상세 §1A.0 + §1A.5 D18 + §3.13 + `Slices/DQ7-Credentials.md` SoT.
- `ServicePlan-Member` → **멤버 서비스 기획 본체**. Research 블로커 해소 후 착수.
- `ExecutionPlaybook` → **슬라이스 기반 개발 방법론** (S0~S6). 에이전트·스킬·하네스 선정 임의 무시 금지. Waterfall(Phase/BuildPhase) 전면 대체.
- `ProgressDashboard` → **전체 슬라이스 상태판**. 🟢 슬라이스가 현재 1순위. 슬라이스 상태·Must 진행률·Global Blocker 한눈 뷰.
- `Document/Build/Slices/S?-*.md` → **현재 슬라이스 상세** (일상 작업). Tasks·DoD·의사결정 로그. 세션당 편집 빈도 가장 높음.
- `Document/Archive/` 하위 파일 → 폐기된 방법론(Phase·BuildPhase). **참조·편집 금지**. 역사 추적용.
- `HANDOFF.md` → 세션 시작 시 **가장 먼저** 읽는 파일. 세션 종료 전 **마지막으로** 갱신. 미래 지향.
- `CodebaseStatus.md` → 현재 지향 스냅샷. 세션 로그가 아님.

---

## Repository Layout

- `Document/` — 문서 기반 플래닝 시스템. 서브폴더: `Business/`, `Service/{Planning,Report,Build}/`, `Process/`, `Research/`, `Outputs/`.
- `CLAUDE.md` — 이 파일 (프로젝트 루트, Claude Code가 자동 로드)
- `tudal/` — the actual Next.js application. 디렉토리 이름은 리브랜드 전 잔재(`tudal/package.json` name은 `joopick`). **폴더명을 변경하지 말 것** — 하위 문서가 경로를 참조한다.
- `backtest/` — 백테스트 스크립트·결과물.
- `scripts/` — 운영 스크립트(Python 포함). S3에서 신설 (`seed_kr_holidays.py` KRX 영업일 seed 생성기). venv 권장 (Homebrew Python 3.14 PEP 668 제약).

All engineering commands run from inside `tudal/`.

## Commands

```bash
cd tudal
npm run dev     # next dev (Turbopack)
npm run build   # next build — primary verification gate
npm run start   # next start
npm run lint    # eslint via eslint-config-next flat config
npm run test    # vitest watch (개발용)
npm run test:ci # vitest run (S3 도입, G-10=b) — pure 로직 유닛 테스트
```

검증 게이트 = `npm run build` + `npm run lint` + `npm run test:ci` (3종). Vitest는 S3 도입(2026-04-17, G-10 옵션 b) — race condition·영업일 계산·이의 제기 등 순수 로직용. 컴포넌트·RLS 테스트는 스코프 외 (수동 QA). 통합/E2E 테스트 추가는 사용자 확인 후에만.

## Critical: Next.js 16 is not your training data

`tudal/AGENTS.md` (referenced by `tudal/CLAUDE.md` via `@AGENTS.md`) contains a hard warning:

> This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Pinned version: `next@16.2.3`, `react@19.2.4`. 라우팅·미들웨어·서버 액션·메타데이터·`next/*` import 관련 코드를 쓰기 전 **반드시** `tudal/node_modules/next/dist/docs/` 또는 context7 MCP 조회.

## Architecture (big picture)

### App Router with route groups
`tudal/src/app/`는 **3개 라우트 그룹**: `(auth)` (login/signup + pass-through layout) / `(main)` (macro, stock/[ticker] + Header+Footer) / `(admin)` (S0 신설 — /admin 홈·portfolio·report·alerts·track-record·decision-tree·settings + 자체 chrome: 로고·사이드바·면책 Footer). Root `app/layout.tsx` 최소 HTML(`lang="ko"` + Geist), 라우트별 chrome은 그룹 layout에서 담당.

### Middleware runs Supabase session refresh on every request
`tudal/middleware.ts`가 `@/lib/supabase/middleware`의 `updateSession`을 위임 호출. matcher는 정적 자원 제외 — 그 외 모든 요청이 Supabase SSR 코드를 탄다. Supabase SSR 세션 refresh 활성. `.env.local`은 son00326 Supabase 프로젝트(`rbrpcynhphrpljbjirfo`) 기준으로 세팅됨.

### Data layer: mock + 실데이터 hybrid
`tudal/src/lib/data/*.ts`는 현재 mock fixture와 S7e Supabase 실 I/O wrapper가 공존한다. 실 wrapper: `admin-shortlist.ts`, `admin-reports.ts`, `admin-committee.ts`, `admin-approvals.ts`, `admin-snapshots.ts`, `admin-regen-counters.ts`. 나머지 실데이터 도메인 모듈은 `tudal/src/lib/{briefing,credentials,crypto,news,performance,portfolio,scheduler,supabase,cost,email,health,intraday,notify}/`로 분리. 타입은 `tudal/src/types/`. **Tier 0 스크리닝 데이터 소스 (63차 결정, ADR D-10)** = **KRX 공식 Open API**(S1 종가·S2 거래량·universe, env `KRX_OPENAPI_KEY`, 날짜별 전종목 1콜 — 구 pykrx throttle 해결) + **pykrx**(S3 외국인) + **DART**(S4·S5 재무). 선정 실행 = Vercel cron 청크 워커(ADR D-11). 남은 mock 전환은 S7-RealData 후속 Task에서 진행.

### API routes & Vercel crons
`tudal/src/app/api/cron/`에 cron 라우트 + `tudal/vercel.json` 스케줄 **8개(전부 daily·Vercel Hobby 호환·8/100)**: `monthly-batch/report-worker` `0 1`(PR5_CRON_AUTO_ENABLED gated·dormant) · `monthly-batch/selection-worker` `0 2`(SELECTION_CRON_AUTO_ENABLED gated·dormant) · `morning-briefing` `0 23` · `news-sweep` `0 0`(Naver 주입 후 live) · `silent-health` `0 15` · `reflection-job` `30 1`(REFLECTION_ENABLED gated·dormant·#129) · `exit-signal` `30 15`(EXIT_SIGNAL_ENABLED gated·dormant·#129) · `exit-outcome` `0 16`(EXIT_OUTCOME_ENABLED gated·dormant·#129). `monthly-batch` 부모 라우트는 no-op(deprecated). 신규 3개(reflection/exit, PR #129)는 flag OFF라 dormant(byte-identical). Hobby는 minute 아닌 hour 정밀도. 변경은 운영 영향 있으므로 배포 조율 필요.

### Supabase migrations
`tudal/supabase/migrations/` 0001~0049 production applied (0001 RLS sketch → 0049 `reset_sector_board_eligible_jobs`). DQ-7부터 도입된 컨벤션: 위험한 마이그레이션은 `NNNN_name.sql` + `NNNN_name.rollback.sql` 짝으로 작성 (예: `0009_dq7_credentials.{sql,rollback.sql}`). MCP `mcp__supabase__apply_migration`로 원격 적용.

### Admin credentials (DQ-7 보안 경계)
`tudal/src/lib/credentials/`가 per-admin API 키 보관소. **AES-256-GCM 암호화**로 KIS 증권·바이낸스 키를 Supabase에 저장 (commit `53b48f0` 검증 완료). 평문 키를 코드·로그·테스트 픽스처에 절대 남기지 않을 것.

### Components grouped by domain
`tudal/src/components/{stock,macro,layout,common,ui}`. `ui/`는 shadcn/ui(base-nova, Lucide). Path alias: `@/* → ./src/*`.

### Charts & constants
Recharts (캔들/라인/영역 + MA + 볼린저밴드). `tudal/src/lib/constants.ts` = 브랜드 문자열 + KRW formatters(조/억/만 인식). 3tier `PLANS` scaffolding은 S0에서 제거 완료.

### Deployment
Vercel 배포 활성 (`tudal/.vercel/`, `tudal/vercel.json`). 첫 배포는 DQ-7에서 수행. cron schedule·환경 변수 변경은 production 영향이 있으므로 사용자 확인 후에만.

## 제품 제약 (코드에 직접 반영)

BusinessPlan.md §7 법적 원칙 (어드민 트랙 적용):

1. **멤버 대상 buy/sell recommendations 금지** — 어드민 내부 도구에서는 AI가 Short List·비중·자동매매까지 처리 가능. 멤버 페이지(Deferred-D) 재개 시 "사세요/파세요" 어휘 금지 재적용.
2. **500-user cap + 초대 전용** — **어드민 트랙에 해당 없음** (본인+친구 3명 내부 도구). Deferred-D 멤버 오픈 시 적용.
3. **면책 문구 Footer 고정** — "정보 제공, 투자 자문 아님". 전 라우트 유지.
4. **Korean-first UI**, `<html lang="ko">`.
5. **자동매매 리스크 가드레일 (S8)** — 레버리지 ≤ 5x · 일일 손실 -3% 자동 정지 · AI 일 주문 ≤ 20회. Policy Engine에서 강제, `/admin/settings/risk`에서 조정.
6. **모의↔실 체결 토글** — 대표 1인만 전환 가능. 기본값은 모의(KIS 모의투자 / 바이낸스 테스트넷).

## 에이전트·스킬 선정 규칙

- **슬라이스 작업**은 `Document/Process/ExecutionPlaybook.md` §2 단계별 매핑(킥오프/설계/구현/실데이터/QA/클로즈)의 Primary·Secondary·Skill 그대로 사용. Uncertainty "중간" 이상은 사용자 재확인.
- Playbook 밖 예외 작업(문서 감사·리팩터·리서치 등)은 `~/.claude/skill-routing.md` + Skill Sources 표 참조해 **OMC·superpowers·PM·gstack·Korean Planning·frontend-design·commit-commands·claude-md-management** 등 전 소스를 검토한 뒤 제안.
- 병렬 디스패치는 `ExecutionPlaybook.md` §4 (슬라이스 내부만 병렬, 슬라이스 간 순차) 준수.
- **deepinit은 S0 Foundation에서만 1회** (`oh-my-claudecode:deepinit` 스킬). 이후 슬라이스에서는 `harness`만 사용 — 상세는 Playbook §3.
- **하네스 3종** (구현 하네스 = S0 / 디자인 하네스 = 각 슬라이스 설계 단계 신규 컴포넌트 다수 시 / 데이터 하네스 = S1 또는 S5 첫 실데이터 전환 슬라이스)은 `oh-my-claudecode:harness` 스킬로 호출. 상세 시점은 Playbook §3.
- **ScreenSpec 등 산출 스펙**은 슬라이스 내부 설계 단계에서 필요 시 `Document/Service/Build/`에 생성. 별도 Phase·Task 아님.

---

## ⚙️ Claude+omxy R-debate Workflow 정책 (옵션 C' 하이브리드, 58차 종료 omxy R1~R4 CONVERGED 박제)

**원칙**: PR #33 docs sweep R-debate 7 cycles (R2~R14, 21 catches) 실측 결과 — omxy catch-only 단순 패턴은 trivial sweep cycle 길어짐, omxy catch+diff 단독은 context 부족/line drift로 complex fix에서 느려짐. **옵션 C' 하이브리드** (Trivial = patch-suggest / Complex = catch-only) 가 최적.

### Owner Boundary (역할 분리)

- **USER = external-state owner** (항상): Vercel env / secrets / flag 토글 / production migration apply / billing / live-money / live-trading / external account or key 변경. **CLAUDE는 명령/체크리스트/가이드 제공 + 후속 verify (실 실행 X)**.
- **CLAUDE = owner / fixer / verifier**: 코드 / 문서 / 로컬 commit / 로컬 검증 + final commit/merge 책임자. 사용자 명시 권한 ON 시 PR merge / docs-sync PR / canary / deploy polling 자동 진행.
- **omxy = critic / patch-suggester** (NOT authoritative code): R-debate output mode (catch-only / patch-suggest / direct-push-exception) 옵션 C' 정합.

### Output Modes

| Mode | 사용 시점 | omxy 출력 | Claude 동작 |
|---|---|---|---|
| **catch-only** | Complex / Complex-docs | HIGH/MEDIUM/LOW + 위치 명시 | 자체 fix + 자체 verify |
| **patch-suggest** | Trivial (mechanical) | catch + file:line + before/after + patch | verify 후 apply (단순 apply X — policy-level 재판단) |
| **direct-push-exception** | USER 명시 + docs-only sweep | omxy 직접 push | Claude verify only |

**default = catch-only**. patch-suggest는 trivial classification 확정 시. direct-push-exception은 USER 명시 권한 + docs-only 한정.

### Trivial vs Complex 분류

- **Trivial → patch-suggest**: docs-only / typo / stale label / line-local replacement / no product·DB·runtime semantic change / rollback easy / commit count + SHA chain 추상화 같은 mechanical sweep / 1~2파일 stale sync.
- **Complex → catch-only**: auth / RLS / persistence / API contract / DB migration / env flag / deployment / user-money / concurrency / race condition / server action behavior / test expectation 변경 / 다파일 의미 변경.
- **Complex-docs (edge case)**: docs-only라도 다음 세션 행동 / USER·CLAUDE owner / production baseline / env·canary·merge 상태 변경 시 → **catch-only 기본**. 단, line-local mechanical patch-suggest는 허용 가능하나 **Claude policy-level 재판단 필수, 단순 apply 금지**.

### Context Packet 표준 (Claude → omxy 송신 시 필수 9 필드)

```
task / objective
base SHA / head SHA / branch / PR URL
target files + exact lines
allowed scope / out-of-scope
current invariants
output mode: catch-only | patch-suggest | direct-push-exception
trivial vs complex classification + reason
verification gate (build / lint / test:ci / tsc / grep / canary)
stop/escalate conditions
```

**Trust 관리 3-step**: (1) omxy patch = "suggested" (authoritative 아님) (2) Claude verify: `git diff` + `rg stale scan` + `build / lint / test:ci / tsc / canary` (3) omxy patch 적용 전 context packet 완전성 확인.

### Native Critic Role Taxonomy

이름 = historical label (runtime 변동 가능). **archetype 1명 이상**으로 기재:

| Archetype | 역할 | 예시 critic 이름 (historical) |
|---|---|---|
| Adversarial invariant / deep red-team | 깊은 invariant 검증, hidden assumption catch | Schopenhauer, Gödel |
| SQL / RLS / security / grant smoke | DB schema, grant matrix, RLS policy | Kepler, Planck |
| Product / spec / UX / semantic docs | 사용자 시점 spec 정합, docs 의미 | Plato, Arendt, Singer, Spinoza |
| Debug / race / concurrency / forensic | timing, race condition, debug trace | Feynman, Schrodinger |
| Ops / merge / deploy / canary | merge sequence, deploy verify, canary | Hubble, Locke, McClintock |
| Final convergence / catch-0 judge | 수렴 검증, 최종 CATCH 0 판정 | Ramanujan, Goodall |

### 단계별 subagent / skill 매핑

> **skill 이름 환경 의존 완충** (omxy PR #37 verify R1 catch 박제): 아래 skill 이름은 historical label (runtime 환경 / 설치 상태에 따라 다를 수 있음). **"when available + domain-specific"** 원칙 — 실제 사용 시 `~/.claude/skill-routing.md` + 현재 세션 available skills 목록 + Skill Sources 표로 verify 후 적용. archetype/role은 안정, 특정 skill 이름은 fallback 허용.

- **Planning**: brainstorming / writing-plans / debate-with-omx / plan-ceo-review / plan-eng-review / plan-design-review + 도메인 (frd-system / scenario-system / quant-research) + omxy native critic archetype 1명 이상 (보통 Adversarial + Product) — *when available*
- **Impl**: test-driven-development / executing-plans / subagent-driven-development / debugging / general-purpose + domain-specific (vercel:ai-architect / supabase / frontend-design / context7 MCP) + omxy patch-suggest (옵션 C') — *when available*
- **Verify**: code-review / gstack-review / verification-before-completion / superpowers:requesting-code-review / superpowers:code-review (5-angle scan) + 검증 게이트 (build + lint + test:ci + tsc + grep gate) + canary (curl + browser/gstack/playwright) + omxy R-debate (옵션 C') + docs sweep `rg stale scan` + `git diff --check` — *when available*
- **Merge**: gstack-ship / commit-commands / superpowers:finishing-a-development-branch + 자동 진행 (PR merge / docs-sync / canary / deploy polling) + USER-only (Vercel env / migration / billing / live-money / external account) — *when available*

### 자동 진행 허용 vs USER-only (58차 종료 omxy R4 boundary 정정 박제)

**자동 진행 허용** (사용자 명시 권한 ON 시 ↔ 묻지 않고 즉시 + 검증까지) — omxy R-debate CONVERGED + 검증 게이트 ALL GREEN = 사용자 승인 등가:
- PR merge (rebase FF + delete-branch) — omxy verify CONVERGED 후
- docs-sync PR create / merge (post-merge baseline 동기화)
- public canary verify (curl) + authenticated browser canary (gstack/playwright 세션 보유 시)
- non-destructive deploy status polling (gh + vercel CLI)
- feature-branch push / PR create / PR comment / PR body 갱신 / branch cleanup

**항상 USER-only** (명시 권한 ON 무관, **CLAUDE는 명령/체크리스트/가이드 제공 + 후속 verify, 실 실행 X**):
- Vercel env / secrets / flag 토글 (e.g., `PR4_TRIGGER_UPSERT_ENABLED=true`) — production external state 변경
- 마이그 production apply (Supabase apply_migration) — USER OAuth + apply 권한
- billing / external account 변경 (Vercel project ownership / Supabase project / GitHub org)
- live-money / live-trading 토글 (자동매매 / order-path)
- cost burn 트리거 (실 AI 호출 / Smoke Stage 2 / `AI_COST_LOG_REAL_INSERT_ENABLED=true` 활성 후 admin trigger 클릭) — 1회 비용 승인
- 외부 메시지 발송 (Slack / 이메일 / 외부 알림)
- destructive (force push to main / DB drop / 운영 데이터 삭제)

**사용자 명시 OFF 시**: default 복귀 = 자동 가능 범위도 USER-only. CLAUDE는 blocker 보고 + 다음 unblocked CLAUDE step 진행만.

**uncertainty ≥ medium** + **product spec changes** + **scope expansion** + **new risk profile**: 사용자 묻기 그대로 유지 (정책 무관).

### "이어서 진행" 자동 진입 조건 (HANDOFF.md 프롬프트)

다음 세션 진입자가 "`Document/Process/HANDOFF.md` 보고 이어서 진행" 프롬프트만 사용해도 자동 진입 가능:

1. **§0 verify 통과** — main HEAD (`git rev-parse --short origin/main`) + OPEN PRs + 검증 게이트 (build / lint / test:ci / tsc) ALL GREEN + production audit drift 0
2. **§1 표 + §2.1 active matrix 다음 unblocked CLAUDE step 식별**
3. **§7 output mode 자동 선택** — Trivial → patch-suggest / Complex → catch-only (기본) / **Complex-docs → catch-only 기본, patch-suggest 허용 시 Claude policy-level 재판단 필수** (단순 apply 금지)
4. **§8 owner/role 정합** — Claude=owner/fixer/verifier, omxy=critic/patch-suggester, USER=external-state owner
5. **USER 잔여 액션 자동 진행** — 명시 권한 ON 시 자동 가능 범위만 (PR merge / docs-sync / canary / deploy polling). USER-only는 blocker 보고 + 다음 unblocked CLAUDE step.

### 상세 박제 위치

- **본 정책 풀버전 (decision matrix 포함)**: `~/.claude/projects/-Users-yong-New-Project-KR-Stock/memory/feedback_omxy_debate_workflow.md`
- **USER 잔여 액션 자동 진행 boundary**: `~/.claude/projects/-Users-yong-New-Project-KR-Stock/memory/feedback_user_action_auto_progress.md`
- **omxy 토론 scope guard**: `~/.claude/projects/-Users-yong-New-Project-KR-Stock/memory/feedback_omxy_debate_scope_guard.md`
- **omxy CONVERGED = 사용자 승인 등가**: `~/.claude/projects/-Users-yong-New-Project-KR-Stock/memory/feedback_no_user_approval_gate.md`
- **omxy 적대적 검토 패턴 detail (cmux send / scope guard 4종 / 결함 카탈로그 / PR-specific lessons)**: `Document/Process/HANDOFF.md §7.1~7.7` (legacy detail은 HANDOFF.md 유지)

**글로벌 `~/.claude/CLAUDE.md` 절대 미수정** — 본 정책은 본 프로젝트 한정 (어드민 + 사용자 명시 권한 ON 상태).
