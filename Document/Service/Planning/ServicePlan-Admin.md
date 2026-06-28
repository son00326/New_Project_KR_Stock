# ServicePlan-Admin.md — 어드민 메인 서비스 기획

Last updated: 2026-06-27 (**PR-K Reflection(AI 자가 학습, D32) 출시 전 shadow-first 빌드 ✅·dormant** — `tudal/src/lib/reflection/*`(pure core + DI orchestrator) + `data/admin-reflection.ts`(upsert/atomic claim/getLatest/getPriorFinalizedCycle/getCyclePanels[멀티라운드 R2>R1 dedup]) + 마이그 **0043 `reflection_log` ✅ production applied (2026-06-27, `20260627120308`)** + `scripts/pg_smoke_0043.sh`. 직전 finalize 사이클 평가 후보 풀 실현 수익률(KRX·무비용)→페르소나 적중률·가중수익→reflection_log→다음 선정 W1 패널에 **신규 `reflectionLearningContext` 필드**(D27 Q5 `reflectionContext` per-ticker와 별개 필드·별개 supplementary block) 주입. **shadow-first**: `REFLECTION_ENABLED` off→선정 byte-identical·회고 미실행·mutation 0. fail-soft(prior cycle/KRX 미가동 no-op). **회고지 예측 아님**(reflection_kind='retrospective' CHECK + summarizer 예측 출력 필터). LLM 케이스 요약 = 별 flag `REFLECTION_LLM_SUMMARY_ENABLED` + fail-closed(cost gate + atomic claim re-burn 방지). cron `/api/cron/reflection-job`(vercel.json 무변경 — write seam schedule = USER go-live). **빌드 완료 = S9 진입 선행조건(sequencing) 충족**; 동작·품질 = S9 중 soft criterion(§2.2 7-criteria 불변). Claude 5-lens(4 HIGH) + omxy R1(7 fix) CONVERGED·게이트 green(test:ci 2345)·PG smoke. SoT spec `docs/superpowers/specs/2026-06-27-reflection-prk-build.md`(빌드) + `2026-06-24-reflection-prk-pre-launch-promotion.md`(D32 결정). 이전: 2026-06-27 (**M12a 뉴스 기반 자동 제외(AI 페르소나) shadow-first 빌드 ✅·dormant** — §3.10 M12a 구현: `tudal/src/lib/news/m12a/*`(Core 11 뉴스평가→per-company thesis-break 구조화 판정→결정론 verdict→smart brake[per-company mass>3·track 70% floor·집중포트]→durable ledger[`news_event` 1 + 신규 `m12a_ticker_assessment` N, action_taken 3-layer 귀속]→shadow/mutate 게이트→텔레그램+`/admin` durable alert[news_critical/news_warning 재사용·alert_type enum 불변·이메일 0]) + 마이그 **0042 DORMANT(USER apply)** + docker-free PG smoke(10 assertions). **shadow-first**: `M12A_AUTO_REMOVE_ENABLED` off→mutation 0·`M12A_NEWS_EVAL_ENABLED` off→morning-briefing byte-identical. 자동 mutation=출시 후 fast-follow(throw-stub). go-live fail-closed step-0(AI_COST_LOG+CRON_SYSTEM_USER_ID UUID/getUserById, sibling parity). Claude dynamic-workflow 빌드 → omxy R1~R3 CONVERGED(5 fix) + Claude 5-dim deep-review(HIGH 2/MEDIUM 1 fix)·게이트 green(test:ci 2246)·tsc·PG smoke. SoT spec `docs/superpowers/specs/2026-06-26-m12a-news-auto-remove-shadow-first.md`. M12a 자동 mutation=출시 게이트 아님(§2.2 7-criteria 불변). 이전: 2026-06-26 (**G4 §4 1차 구현 ✅·dormant** — 거시/뉴스 → AI 컨텍스트 레이어: `lib/macro` mock distill seam + 리포트/모닝브리핑(M11)/LIVE Tier1 패널 3-consumer wiring(flag `MACRO_CONTEXT_ENABLED` off→byte-identical), Tier0 factor 금지·M12a 범주 분리·forward-validate·M11 Resend 제거. **실 FRED/news source + Polymarket = USER 게이트/후속**. 상세 §3.10 R3.10-4a + spec `docs/superpowers/specs/2026-06-26-g4-macro-news-ai-context-layer-design.md`. 이전: **2026-06-25 D33 — TradingAgents graft 출시 전 로드맵(당시 코드 빌드 0, G4 제외)**: G1 Reflection Lab + G2 Leader-miss why-excluded[Path-A 흡수] + G3 Risk 3자 토론[출시 후→출시 전 이동] + G4 Macro/news AI context 채택, G5 reject; USER 확정·Claude↔omxy 토론 CONVERGED·코드 빌드 0·로드맵만. per-ticker 토론 funnel 이식 금지·NO-CONFIG-PASSES 유지·MVP 3종+§2.2 7-criteria 불변. SoT spec `docs/superpowers/specs/2026-06-25-tradingagents-graft-prelaunch-roadmap.md`). 이전: 2026-06-24 (**D32 — Reflection/PR-K[AI 자가 학습] 출시 전 승격**: "출시 후 defer"→"출시 전 빌드 + S9 운용 검증 중 가동·검증", 구 62차 doc-class supersede, MVP 3종 불변. SoT spec `docs/superpowers/specs/2026-06-24-reflection-prk-pre-launch-promotion.md`. ① Claude docs draft → ② omxy catch-only → ③ Claude 재검토). 이전: 2026-06-12 (77차 — **D31 신설: Accept 게이트 내부도구 완화 모드** [Accept=가상 포트 확정·3인 내부도구라 멤버서비스급 D15 게이트(D+4 Hold+2인 열람)를 24h hold만으로 완화, env `PORTFOLIO_ACCEPT_GATE_STRICT=true`로 strict opt-in; relaxed면 viewer/auto-relief DB 조회 skip. PR #120 MERGED·omxy R1~R2 CONVERGED·production 배포]. 직전 동일 차수 **D30: Tier 0 스코어링 방법론 = "B++ (size-sleeve recall-first) + recall/rank-IC/size 삼중 게이트" 채택** [실증으로 B+ 단독 REJECT — production 150 대형 주도주 10/11 누락. Claude 퀀트 + omxy 2 독립 수렴, main Opus 종합]. 근본원인 = 구조적 retrieval 실패(지속추세 시그널 부재 + 소형주 구성편향). 구현 = 다음 세션. SoT spec = `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md`(B++ 전문). 부수: B-SEL-CRON fix PR #118 MERGED + Accept-gate de-mock fix PR #119 MERGED[shortlist-gate.ts 공유모듈·2026 달력 근로자의날/제헌절] + shortlist 재시드 진행[Tier0 --apply/Tier1 보류]). 이전: 2026-06-10 (토스 스타일 전체 리디자인 Toss-D0~D4 시점 결정: D0 spec-only 병행, D1 Accept 후·S7b UI 전, D2 D11 전, D3 S7b/S7c 동시, D4 S9 직전 freeze; runbook 순서 불변). 이전: 2026-06-09 (72차 — **M12a 뉴스 기반 자동 제외 (AI 페르소나) spec 신설 + 사용자 정정 반영** [⚠️ planned·미구현 — 코드 빌드는 별도 future task]: 개장 전 08:00 KST Core 11이 보유 포트+30리스트 뉴스를 평가하되 `scope`(company|sector|market)는 출처 메타데이터로만 보존하고, 거시/섹터 뉴스도 각 종목별(per-company) thesis-break로 차등 판단 → direct/material/high-conf per-company thesis-break만 **자동 제외(빼기만·freed weight→현금)** + **smart brake**(1run 4건↑[>3] 또는 track 70% floor 위반→전체 hold_for_review; 집중포트 N<10은 1건 자동·2건↑ 보류) + **news_event 1건 + per_ticker_assessments N건 durable ledger**(lockout 없음) + **candidate-level 재진입 context**(fresh∪incumbent, D27 incumbent-only seam과 별개·additive) + **텔레그램 + `/admin` 웹 알림(`/admin/alerts` durable event + 대시보드 unread badge)**. **72차 사용자 override: 이메일/Resend 알림 전역 제거, D10=Telegram best-effort + `/admin` catch-up.** §3.10 M12a = SoT. 구 "M12 Critical/Warning/Info 규칙 분류" supersede. omxy scope debate R1~R4 + 사용자 정정 R8~R9 반영(candidate-level context·durable ledger 분리·70% floor·output schema·B-7/B-9 게이트·alert_type enum 불변·email/Resend 전역 제거·per-company macro/sector 판단). 이전: 2026-05-22 (54차 §3 — **PR #12 PR3a Group H schema drift fix Critical Hard gate MERGED in main `0813a41`** + Group H ✅ 해소. omxy R1~R12 12 rounds + R7 Codex `/review` GATE PASS + gsd-code-reviewer + gstack testing + red-team 다중 review CONVERGED. canonical 5-PR: PR2 ✅ → PR3a ✅ → PR1 → PR3b → PR4. 박제 자료: `docs/superpowers/plans/2026-05-22-pr3a-group-h-schema-drift.md` + `docs/superpowers/reviews/2026-05-22-pr3a-group-h-schema-drift-review.md`. 이전: 53차 §5 — shortlist 30종목 + 풀 리포트 흐름 정정 박제. D23 신설.)
Status: **v2.12 (2026-06-27 — PR-K Reflection[AI 자가 학습, D32] 출시 전 shadow-first 빌드 ✅·dormant: `lib/reflection/*` + `data/admin-reflection.ts` + 마이그 0043 `reflection_log` ✅ production applied(2026-06-27, `20260627120308`) + PG smoke; flag `REFLECTION_ENABLED`/`REFLECTION_LLM_SUMMARY_ENABLED` default off → 회고 미실행·선정 byte-identical; 직전 사이클 평가군 실현 수익률(KRX·무비용)→페르소나 적중률·가중수익→reflection_log→선정 W1 패널 `reflectionLearningContext` 주입(Q5 reflectionContext와 별개); 회고지 예측 아님(reflection_kind CHECK + 예측 출력 필터); LLM 요약 fail-closed(cost gate + atomic claim); cron `/api/cron/reflection-job`; 빌드 완료=S9 진입 sequencing 충족·동작=soft criterion; Claude 5-lens(4 HIGH) + omxy R1(7 fix) CONVERGED. SoT spec `docs/superpowers/specs/2026-06-27-reflection-prk-build.md`). 이전 v2.11 (2026-06-27 — M12a 뉴스 기반 자동 제외[AI 페르소나] shadow-first 빌드 ✅·dormant: `lib/news/m12a/*` + 마이그 0042 DORMANT(USER apply) + PG smoke 10 assertions; flag `M12A_NEWS_EVAL_ENABLED`/`M12A_AUTO_REMOVE_ENABLED` default off → 평가/제거 미실행·morning-briefing byte-identical; 자동 mutation=출시 후 fast-follow(throw-stub); go-live fail-closed step-0; omxy R1~R3 + Claude 5-dim deep-review CONVERGED·게이트 green. §3.10 M12a). 이전 v2.10 (2026-06-26 — G4 §4 1차 구현 ✅·dormant: 거시/뉴스 → AI 컨텍스트 레이어 = `lib/macro` mock distill seam + 3-consumer wiring[리포트/M11/LIVE Tier1 패널], flag `MACRO_CONTEXT_ENABLED` off→byte-identical; Tier0 factor 금지·M12a 범주 분리·forward-validate·M11 Resend 제거; 실 FRED/news source + Polymarket = USER 게이트/후속. Claude TDD→omxy R1+R2 CONVERGED + Claude deep-review live-path HIGH catch. §3.10 R3.10-4a). 이전 v2.9 (2026-06-25, USER 확정 — D33 신설: TradingAgents graft 출시 전 로드맵 G1~G4 채택(G1 Reflection Lab·G2 Leader-miss why-excluded[Path-A 흡수]·G3 Risk 3자 토론[출시 후→출시 전 이동]·G4 Macro/news AI context[S7b]) + G5 reject(Bull/Bear=Q4 중복). Claude↔omxy 토론 CONVERGED·코드 빌드 0·로드맵만. per-ticker 토론 funnel 이식 금지·NO-CONFIG-PASSES 유지(예측 claim 영구 금지)·MVP 3종+§2.2 7-criteria 불변. SoT spec `docs/superpowers/specs/2026-06-25-tradingagents-graft-prelaunch-roadmap.md`). 이전 v2.8 (2026-06-24, USER 결정 — D32 Reflection/PR-K[AI 자가 학습] 출시 전 승격: "출시 후 defer"→"출시 전 빌드 + S9 운용 검증 기간 중 가동·검증", 구 62차 doc-class supersede, MVP 3종 불변; ① Claude docs draft → ② omxy → ③ Claude 재검토; SoT spec `docs/superpowers/specs/2026-06-24-reflection-prk-pre-launch-promotion.md`). 이전 v2.7 (2026-06-12, 77차 — D30 amend: 스코어링 "B+ 형태수정 + 경량 IC" → 실증(production 150 대형 주도주 10/11 누락) 후 **B+ 단독 REJECT → B++ (size-sleeve recall-first) + recall/rank-IC/size 삼중 게이트**. Claude 퀀트 + omxy 2 독립 수렴, main Opus 종합. 구현 다음 세션, SoT spec B++ 전문). 이전 v2.6 (2026-06-12, 77차 — D31 Accept 게이트 내부도구 완화 모드 [D+4 Hold + 2인 열람 면제, 24h만; PORTFOLIO_ACCEPT_GATE_STRICT로 strict opt-in] PR #120 MERGED·production 배포). 이전 v2.5 (2026-06-12, 77차 — D30 Tier 0 스코어링 B+ 형태수정 + 경량 IC 검증 채택, 구현은 다음 세션·SoT spec `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md`). 이전 v2.4 (2026-06-10 — 토스 스타일 전체 리디자인 Toss-D0~D4 시점 결정 + D29 신설). 이전 v2.0 (2026-05-22, 54차 §3 — PR3a Group H Hard gate 해소 + D24 신설). 메인 path = Tier 0 인디케이터·DART numeric narrow → Tier 1 Core 11 AI 평가 + 시간대별 페르소나 가중치 → 30 선정 + Tier 2 sector 14 페르소나 Section 8 plug-in + writer Section 0~7 통합 = 30 풀 리포트 (단일 산출물). **73차 supersede: 메인 path(실 AI 30 선정) 가동 완료 — 현 production = `short_list_30` 2026-06-01 실 AI 30(consensus_badge/ai_score populated); Tier 0 단독 30 직선정은 이제 AI 키 미발급 시 fallback으로만**. **Group H Hard gate ✅ 해소** (PR3a MERGED — admin-reports.ts zod validation + `ValidatedStockReport` + page.tsx null guard + Section 8 dual-shape renderer + `partCToCommitteeAgg`). 이전 이력: v1.9 (2026-05-21, 53차 §5 — shortlist 30종목 + 풀 리포트 흐름 정정 박제 + D23 신설). v1.8 (2026-05-20, 52차 — Tier 2 impl PR #5 + D22 Kevin v3.1 quality target). D21 (v1.7) Tier 2 SoT PR #4 + D22 Tier 2 production prompts quality target = `origin/IMVCOM @ 1faee1b` Kevin v3.1 reference 박제. 마이그 0019 commit_sector_personas RPC + commitSectorReport + parseSectorContentStrict + runSectorEval scaffold + 196 mock stub. omxy 69 rounds CONVERGED 누적. (이전 이력: v1.7 (2026-05-20, 52차) — D21 Tier 2 Sector Board slot 모델 정정 + SoT PR 박제. canonical 14 sectors × 14 personas/sector overlay (10 base + 2 primary + 2 sub_tag). sub_tags jsonb crosswalk 7개 운영 UI proxy. mig 0018 + `canonical-sectors.ts` 신규 (production import 0). `commit_sector_personas` RPC + Section 8 render는 Tier 2 implementation 후속 PR OOS. omxy R1~R4 CONVERGED. (v1.6 이력: 2026-05-19 S7a 49차 5종 합의 배지 박제. v1.5 이력: 2026-05-08 D19 — JooPick AI 강화 Tier 0/1/2 병렬 + 합의 배지(4종) + Reflection. v1.4 이력: 2026-05-08 D18 — S8 자동매매 진입 시점 재조정 + KIS 발급 비블로커화. v1.3 이력: 2026-04-22 D17 — DQ-7 per-admin UI + AES-256-GCM + Vercel 첫 배포 트랙. v1.2 이력: D16 어드민 내부 도구 재정의 + 자동매매 S8 승격.)**
Prior: v1.1 (13차 후속) — Q-OP1·Q-OP2 반영 완료(Must 승격 3건 + Holding Period 24h + 2인 게이팅). Q-OP3·Q-OP4는 개발 완료 전까지 유보 고정. Must 19 / Should 17 / Nice 6 / Deferred 7.
Prior: v1.0 (13차) — P5 검증 완료. Critical 3건(I-01/I-02/I-03) 해소 · Major 10건 전원 해소(I-04~I-13) · 사용자 결정 D10~D13 박제.
Parent: → `ServicePlan.md` (인덱스·공통 원칙)

---

## 0. 이 문서의 정체성

**어드민 내부 도구의 서비스 기획**을 단독으로 확정하는 문서. 멤버 페이지와 독립 확정.

> **2026-04-21 재정의 (D16)**: 어드민은 "대외 서비스"가 아니라 **본인 + 친구 3명(Q10 참조)이 주식·코인 투자를 편하게 하기 위한 내부 도구**. 멤버 배포(500cap)·MVP Stage 1/2·Friends & Family Beta 같은 공개 서비스 프레임은 이 문서 범위 밖. 관련 어휘는 보존 가치가 있는 경우 아카이브 형태로만 유지한다.

- **담는 것**: 어드민 3명(§1.1)이 내부 도구로 쓰는 화면·기능·데이터·제약 + 자동매매 프레임(S8) 개요.
- **담지 않는 것**: 멤버 페이지(`ServicePlan-Member.md`, Deferred-D), 공통 원칙(`ServicePlan.md §3`), 사업 제약(`BusinessPlan.md §7·§10`), 자동매매 슬라이스 상세(`Document/Build/Slices/S8-AutoTrading.md`).
- **확정 원칙**: 각 섹션은 brainstorming → product-manager → critic 사이클로 독립 확정. 확정된 것만 본문에 박제.

---

## 진행 트래커

### Planning (Phase.md 방법론 기준)

- [x] **P0** 의도 정렬 ✅ (2026-04-15 완료, GO 판정)
  - [x] 0.1 스코프·JTBD 합의 (`superpowers:brainstorming`) → §1
  - [x] 0.2 문서 동기화 (직접 Write)
  - [x] 0.3 모호성 잔여 확인 → **GO** (2026-04-15, 모호성 없음 판정)
- [x] **P1** 리서치 (7개 병렬 + 1 후속) ✅ (2026-04-15 완료, 8/8 태스크)
  - [x] 1.1 BusinessPlan 기획 갭 분석 (`analyst` opus) — 30개 갭, Critical 5건
  - [x] 1.2 경쟁 서비스 스캔 (`researcher`) — 8개 경쟁사, 직접 포지션 중복 없음
  - [x] 1.3 페르소나 정의 (`user-personas`) — 3인: 김재혁(시스템 신뢰자), 박소연(적극적 검증자), 이준호(트랙 레코드 빌더)
  - [x] 1.4 고객 여정 맵 (`customer-journey-map`) — 4개 여정 (월간/일간/긴급/온보딩)
  - [x] 1.5 Core JTBD (`value-proposition`, 1.3 후) — 6-part VP + 페르소나별 VP + Canvas
  - [x] 1.6 기능 후보 브레인스톰 (`brainstorm-ideas-existing`) — 기존23+신규26=49개
  - [x] 1.7 투심위 UX 패턴 (`document-specialist`) — 6카테고리 패턴 + 한국 색상 컨벤션
  - [x] 1.8 Quant 데이터 플로우 (`architect` opus) — v6 분석, 16엔티티, 5 ADR
- [x] **P2** 전략 골격 ✅ (2026-04-15 완료, 정리 세션 후 §1A SoT 단일화)
  - [x] 2.1 Product Vision → §1A.1
  - [x] 2.2 Value Proposition 6-part → §1.2 Core JTBD + P1.5 원자료(`core-jtbd-value-proposition.md`)
  - [x] 2.3 9-Section Strategy Canvas → §1A.2 Unfair Advantages + §1A.5 (P2 시점 미해결 7건 박제 → 10차 P3.0 Q&A에서 D1~D9로 해소)
  - [x] 2.4 가격 전략 근거 → BusinessPlan §Q11(월 19,900원 확정) + §1A.5 말미 BEP 51명(중복·과잉으로 별도 문서 삭제)
  - [x] 2.5 북극성 지표 → §1A.3 NSM + 측정 스펙 + 리뷰 프로토콜 + §1A.4 Anti-Metrics
- [x] **P3** 구조화 ✅ (2026-04-15 완료, 3/3 태스크)
  - [x] **P3.0** Pre-P3 사용자 Q&A 세션 ✅ (2026-04-15, 9개 결정 D1~D9 + 보류 1건 확정, §1A.5 재작성)
  - [x] 3.1 Must/Should/Nice 분류 (`prioritize-features`) ✅ — Must 19 / Should 17 / Nice 6 / Deferred 7. §3.7~§3.12 운영. 원자료: `.omc/research/p3-1-feature-prioritization.md` (v1.1에서 D-OOS-6·D-OOS-7·Silent Health를 Must 승격, D14 박제)
  - [x] 3.2 Information Architecture (`information-architect`) ✅ — 메인 7 + 서브 3 = 10 라우트. Short List 30 = 3고정섹션 세로 스택. 3모드 = Header 드롭다운 + Settings. 원자료: `.omc/research/p3-2-information-architecture.md`
- [x] **P4** 기획서 작성 (P7과 병렬) ✅ (2026-04-15 12차, 4/4 태스크)
  - [x] 4.1 PRD 골격 (`create-prd` + `product-manager`) — §3 요구사항 R번호체계 본문화 + §4 데이터 모델 8엔티티. 미해결 5건 해소/이관.
  - [x] 4.2 User Stories (`user-stories`) — Must 16개 × Story+AC (17블록, M13 설정/동작 분리) · v1.1에서 M17·M18·M19 추가 Story+AC 부착
  - [x] 4.3 DoD 체크리스트 (`test-scenarios`) — Must 16개 × DoD 3~5개 (17블록, Gherkin 금지) · v1.1에서 M17·M18·M19 DoD 부착 + M7 DoD에 Holding/게이팅/이의 3개 추가
  - [x] 4.4 통합·편집 → v0.9 (직접 Write) → **ServicePlan-Admin.md v0.9**
- [x] **P7** UX Design (P4와 병렬) ✅ (2026-04-15 12차, 3/3 태스크)
  - [x] 7.1 유저 플로우 (`designer`) — 5개 mermaid (J1~J4 + 3모드). `.omc/design/flows/admin-flows.md`
  - [x] 7.2 와이어프레임 (`designer`) — 글로벌+5종 ASCII. `.omc/design/wireframes/admin-wireframes.md`
  - [x] 7.3 IA 검증 (`architect`) — BLOCK 0 / FLAG 3 / Suggestion 3. `.omc/design/ia-verification.md`
- [x] **P5** 검증 (3개 병렬, P4+P7 완료 후) ✅ (2026-04-15 13차, 4/4 태스크)
  - [x] 5.1 적대적 검토 (`critic` opus) → `serviceplan-admin-critique.md` — REJECT 판정, Critical 3 + Major 10 → D10~D13 + 기계 해소
  - [x] 5.2 UX 관점 검토 (`ux-researcher`) → `serviceplan-admin-ux-audit.md`
  - [x] 5.3 Pre-mortem (`pre-mortem`) — Anti-Metrics 4개 × 6개월 타임라인 시나리오 + 예방 조치
  - [x] 5.4 최종 수렴 → **ServicePlan-Admin.md v1.0** (직접 편집)
- [ ] **P6** 사양화
  - [ ] 6.1 FRD (`frd-writer`) → `Document/Service/Build/FRD-Admin.md`
  - [ ] 6.2 사용자 시나리오 (`scenario-system`) — customer-journey 4여정 변환 + 온보딩/초대 + edge 2~3 → `Scenarios-Admin.md`
- [ ] **P8** UI Design — 토스 스타일 전체 리디자인(Toss-D0~D4) 마일스톤 결합으로 수행 _(구 P6+P7 완료 후 일괄 제작 계획은 superseded; 8차 재정비: 구 8.3 shadcn 오버라이드 삭제 → ServicePlan.md §3 base-nova 확정 + B1 흡수)_
  - [ ] 8.0 디자인 하네스 구성 (`harness`)
  - [ ] 8.0a **토론 CONVERGED 결정**: 토스 스타일 전체 리디자인(폰트 포함)은 §1A.1 `디자인 방향 — 토스 스타일 리디자인(Toss-D0~D4)`의 마일스톤 결합 5-슬롯으로 수행한다. 스코프 C 전체·스킬 파이프라인은 확정분, 출시 runbook 순서 변경 금지.
  - [ ] 8.1 디자인 원칙·Voice·Tone (`designer` + `design-consultation`) — §1A.1 3대 약속 + 규약 재형식화
  - [ ] 8.2 디자인 토큰 (`designer`) — **D0은 방향/스펙만**. `globals.css`·폰트패키지·shadcn 토큰 변경은 D1 쉘 리테마(Accept 완료 후 merge)에서 수행
  - [ ] 8.3 고품질 목업 (`frontend-design`) _(구 8.4)_ — Must 4~6종 (P7.2 확정 후 결정)
  - [ ] 8.4 Design Review (`design-review` + `visual-verdict`) _(구 8.5)_
  - [ ] 8.5 디자인 아카이브 저장 (직접 Write) _(구 8.6)_

### Build (BuildPhase.md 방법론 기준)

> **Note**: 디자인 제작은 2026-06-10 토론 결정에 따라 **Toss-D0~D4 마일스톤 결합**으로 수행한다. D0은 spec/docs-only이며, D1/D2/D3의 토큰·폰트·primitive·화면 정밀화는 각 마일스톤 디자인 PR에서 코드화한다. B1은 별도 일괄 전환이 아니라 D1/D2/D3에 흡수된 디자인→코드 작업을 가리킨다.

- [ ] B1 — 디자인→코드 전환 (Toss-D1/D2/D3 마일스톤 PR 내 코드 반영 + 리뷰)
- [ ] B2 — 인프라 (deepinit / Supabase / 한투 / DART / pykrx / DB / 인증 / 하네스)
- [ ] B3 — 구현 (ScreenSpec / 간소화 / 실데이터 / Must 기능 / Smoke)
- [ ] B4 — QA (QA 루프 / 보안 / 성능 / 접근성 / 리뷰 / 버그 수정)
- [ ] B5 — 배포 (릴리스 / 머지 / 카나리 / 문서)

---

## 1. 사용자·JTBD·스코프

> **P0 Task 0.1 확정 (2026-04-15)** — brainstorming 완료, 사용자 승인.

### §1.1 사용자

| 항목 | 정의 |
|---|---|
| 역할 | 어드민 **3명** 가정 (사용자 본인 + 공동창업자 2명). 2명 운영도 동일 설계로 가능 — 차이는 계정 수뿐. |
| 권한 | `/admin/*` 전체 접근. 어드민 계정 간 동일 권한 |
| 맥락 | 본인 자금 15억 직접 운용. 동일 Short List 30·리포트·포트폴리오 뷰 공유 |
| 매매 실행 | 각 어드민이 외부 증권 앱에서 직접 실행. 주픽은 매매하지 않음 |

> **BusinessPlan §Q10 변경**: 기존 "1명 고정" → "2~3명". 혹시 모를 확장 대비.

**어드민 3인 역할 분담 (선택적 가이드, P5 I-06 박제)**: 3인 동일 권한·동일 뷰가 기본. 운영상 자연스럽게 형성되는 역할(의사결정 주도 / 검증 / 기록)은 문서·슬랙에서 조율한다. 시스템은 역할을 강제하지 않는다. 페르소나 3인(김재혁·박소연·이준호, P1.3)은 제품 설계 참조용일 뿐, 실제 어드민 3명과 1:1 매핑되지 않는다.

---

### §1.2 Core JTBD

> **"AI 가상 펀드매니저가 선정한 Short List 30(단기=주1회 갱신·중장기=월1회 갱신, 65차 Q1)과 풀 리포트를 기반으로, 15억 자금을 직접 운용하여 Y1 말까지 KOSPI 대비 alpha가 있는 트랙 레코드를 구축하고 싶다."**

---

### §1.3 Sub-Jobs (워크플로우 순)

#### J1. 월간 선정 (중장기 월1회 / 단기 주1회 — 65차 Q1 분리)

> "이번 달 뭘 살지 — AI가 분석한 30종목 리스트와 비중 제안을 받아 포트폴리오를 확정하고 싶다."

> **65차 Q1 supersede**: 선정주기 = 단기 주1회 + 중장기 월1회로 분리. 매월 1일 단일배치로 단·중·장 30 동시생성은 stale. 단기 10은 주간 갱신, 중기·장기 20은 월간 갱신. 미승인 마감(D+5)·재분석 정책은 각 주기에 동일 적용. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)

- AI가 전종목 스크리닝 → Short List 30 생성 (단기10/중기10/장기10)
- 각 종목 풀 리포트 (Section 0~8) 제공
- 포트폴리오 비중 제안 (현금 비율 0~30% 포함) → 어드민 승인 → 가상 포트폴리오 트래킹 시작
  - **승인 방식**: Accept/Reject 모델. 어드민이 종목·비중을 수동 수정하지 않음.
    - **65차 Q2 supersede**: AI 자율 포트구성으로 변경 — 30 중 (운용여부·총편입개수·종목선택·단중장분배·종목별비중·현금0~30%) 전부 AI 자율 결정. 기존 '항상 30 전체 운용 + AI는 비중만 제안 + 어드민 Accept/Reject만'은 변경됨. AI가 편입개수·종목까지 자율선택하며, 어드민 Accept/Reject 게이트는 유지하되 대상은 'AI가 구성한 자율 포트(편입 N≤30)'. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)
  - **승인 권한**: 어드민 동등 권한, **먼저 승인한 사람이 확정** (선착순).
  - **Reject 처리** (D1): Reject 시 AI 즉시 재분석 1회 → **재분석본도 Reject되면 그 달은 전월 포트 유지**.
  - **미승인 마감** (D2): 매월 1일 생성 후 **D+5 영업일** 미승인 시 전월 포트 유지 + 텔레그램 경고 발송.
  - **트래킹 기준가**: 승인 시점 종가 (= 승인가).
- 전월 대비 편입/유지/제외 + 변동 사유 명시

#### J2. 일간 모니터링 (매일 아침, 디폴트 모드)

> "내 포지션이 괜찮은지 — 보유 종목 현황·밤사이 뉴스·이슈를 한눈에 파악하고 싶다."

- 보유 30종목 수익률 요약 (종목별 + 전체)
- 밤사이 뉴스·공시·이벤트 하이라이트
- 주의 필요 종목 플래그 (급등락·뉴스 악재·목표가 근접)

#### J3. Exit 타이밍 (상시)

> "언제 팔지 — 목표가 도달·모멘텀 꺾임·악재 발생 시 즉시 매도 시그널을 받고 싶다."

- 단기 종목: 홀딩 기간 내 적극적 매도 타이밍 제안
- 중기/장기 종목: 목표가 변동·펀더멘탈 훼손 시 알림
- 긴급 알림 채널: 텔레그램 best-effort + `/admin/alerts` durable event + 대시보드 unread badge
- 매도 제안 시 근거(리포트 섹션 참조) + 대안 시나리오 제시

#### J4. 성과 추적 (월말 + 상시)

> "얼마나 벌었나 — 승인 시점 기준 수익률·Sharpe·alpha를 측정하고 트랙 레코드로 누적하고 싶다."

- 종목별 수익률 (승인가 기준)
- 포트폴리오 전체 수익률·Sharpe·KOSPI 대비 alpha
- 월간/누적 트랙 레코드 기록
- 단기/중기/장기 관점별 성과 분리 집계
- **체결 가정 (D3)**: 승인 시점 **종가로 100% 일괄 매수** 가정. 슬리피지·수수료 0% (단순 모델 — 가상 포트 성능 측정 전용).
- **현금 (D4)**: AI 제안 현금 비율(0~30%)만큼 매수 제외 → 별도 항목으로 추적

---

### §1.4 사용 모드 (어드민 설정에서 전환)

홈 화면은 **모든 모드에서 동일**: Short List 30 (단기/중기/장기) + 상단 일간 요약 섹션.

```
┌─────────────────────────────────────────┐
│  일간 요약 (항상 상단 고정)               │
│  전체 수익률 | 주의 종목 | 뉴스 건수      │
├─────────────────────────────────────────┤
│  단기 Top 10  (종목명·현재가·수익률·상태)  │
├─────────────────────────────────────────┤
│  중기 Top 10                             │
├─────────────────────────────────────────┤
│  장기 Top 10                             │
└─────────────────────────────────────────┘
```

모드가 제어하는 것은 **알림·데이터 갱신·모니터링 깊이**:

| 모드 | 알림 빈도 | 데이터 갱신 | 모니터링 깊이 | MVP |
|---|---|---|---|---|
| **모닝 대시보드** (디폴트) | 아침 브리핑 + 긴급 즉시 | 장 마감 후 배치 | 일 1회 | ✅ |
| **상시 모니터링** | 임계치 기반 즉시 | 실시간 스트림 | 장중 상시 | ✅ (D7: 임계치 UI 단순화 — 디폴트 임계치 + 종목별 on/off만) |
| **월간 리밸런싱** | 재선정 시점 + 긴급 즉시 | 월 1회 배치 | 주 1회 요약 | ✅ |

- 세부 항목(알림 채널·임계치 등)은 개별 오버라이드 가능
- J3 Exit 시그널의 긴급 알림은 **모든 모드에서 즉시 발송** (모드 무관)
- **상시 모니터링 MVP 임계치 스펙 (D7)**: 디폴트 임계치 3종(급등락·뉴스 악재·목표가 근접) + 종목별 on/off 토글만. 구체 임계치 값은 P4 PRD 또는 BuildPhase B3에서 확정. 세밀한 임계치 커스텀 UI는 Phase 2.

---

### §1.5 AI 역할 경계

> **승인(Accept) = AI 가상 포트 확정이며 실제 체결 강제 아님**. 실제 체결은 §1A.0의 3경로(매뉴얼/자동매매/외부 바이패스)에서 각 어드민 독립 의사결정. D11 박제.
>
> **2026-04-21 보강 (D16)**: 자동매매(S8)는 "AI가 주문까지 자동 실행"을 목표로 하지만, AI agent·skill 본체는 어드민이 추후 drop-in하는 구조. 현 S8 범위는 인터페이스·데이터·가드레일·주문 파이프라인만 구현.

| AI가 하는 것 (가상 펀드매니저 + 자동매매 어댑터) | AI가 하지 않는 것 |
|---|---|
| 전종목 스크리닝 → Short List 30 선정 (30은 분석 풀이며, 실제 편입은 AI 자율 선택 N≤30 — 65차 Q2) | (별도 drop-in 없이는) 자율 주문 실행 |
| 종목별 풀 리포트 (Section 0~8) 작성 | 어드민 대신 승인·의사결정 |
| 포트폴리오 자율 구성 (운용여부·편입개수·종목·단중장분배·비중·현금0~30% 전부 AI 결정 — 65차 Q2) | 실제 체결가·잔고 동기화 (증권사 API로 상호 조회는 S8에서 수행) |
| 승인 후 가상 포트폴리오 수익률 트래킹 | 멤버에게 Short List·리포트 노출 |
| 보유 종목 리스크 상시 모니터링 | 리스크 가드레일 override (레버리지·일일 손실·주문 cap) |
| Exit 타이밍 제안 (매도 시그널 + 근거) | |
| 악재 감지 → 긴급 알림 + 재조정 제안 | |
| 월간/누적 트랙 레코드 기록 | |
| **(S8)** Strategy 폴더 drop-in 및 AI 어댑터 embed 인터페이스 제공 — 자동매매 주문 파이프라인(모의→실계좌, 주식+바이낸스 선물) | |

---

### §1.6 Non-Goals

- 멤버(500cap)에게 Short List·풀 리포트 노출 (Deferred-D, 별도 트랙)
- 공개 마케팅·무료 체험·가입 퍼널 (어드민 내부 도구이므로 해당 없음)
- Friends & Family Beta·Closed Beta 등 지인 배포 워크플로우 (현 플랜에서 분리, Deferred-D 재개 시)
- AI agent·skill 본체 구현 (어드민이 추후 drop-in — S8 어댑터 인터페이스만 기본 제공)
- 리스크 가드레일 자동 override (레버리지·일일 손실·주문 cap 한도 초과 자동 허용 금지)

> **2026-04-21 어휘 정리 (D16)**: 구 "트레이딩 실행 3-Stage 로드맵(Stage 1 매뉴얼 → Stage 2 API → Stage 3 AI 자율)"은 **폐기**. 대신 **자동매매 = S8 단일 슬라이스**로 통합되고, 내부 단계가 (i) 모의↔실 체결, (ii) Strategy drop-in↔AI 어댑터 embed로 세분화된다. 상세: `Document/Build/Slices/S8-AutoTrading.md`.
>
> **범위**: S8은 주식(KIS 모의→실계좌) + 코인(바이낸스 USDT-M 선물 테스트넷→메인넷)을 모두 포함. 대상 종목 스코프는 **Short List / 자유 종목 / 바이낸스 선물** 중 어드민 선택.

---

### §1.7 성공 기준

| 지표 | 목표 | 측정 시점 |
|---|---|---|
| 트랙 레코드 누적 | 12개월 연속 기록 | Y1 말 |
| KOSPI 대비 alpha | 양(+)의 alpha | 월간·누적 |
| Sharpe Ratio | > 1.0 | 누적 |
| Short List 적중률 | 편입 종목 중 수익 종목 비율 추적 | 월간 |
| 플랫폼 사용 빈도 | 어드민이 실제로 매일 쓰는가 | 주간 체크 |
| Exit 시그널 품질 | 매도 제안 후 추가 하락 비율 | 분기 리뷰 |

- 성공 기준은 P4(PRD)에서 정량 KPI로 세분화
- Y1 말 Decision Tree(BusinessPlan §Q4)와 연동: alpha·Sharpe가 법적 등록 판단 근거
- **Decision Tree 진척도 대시보드 (D9)**: `/admin/decision-tree` 별도 화면에서 alpha·Sharpe·CAP Months vs Y1 목표 진척도 상시 표시

---

## 1A. 전략 골격 (P2 SoT)

> **P2 완료 (2026-04-15)**. 본 섹션이 SoT. VP/페르소나/경쟁사 원자료는 `.omc/research/` (P1.2·1.3·1.5).

### §1A.0 어드민 실행 모델 (v1.0 신설, P5 D11)

> **개념**: 주픽 어드민은 단일 매매 시스템이 아니라 **AI 가상 포트폴리오 본체 + 2개 집행 서브시스템 + 외부 바이패스**로 구성된다. Critic I-05 지적(가상 포트 vs 실제 자금 실행 경로 모호)을 해소하기 위해 박제.

**3경로 집행 모델**:

| 경로 | 내용 | 주픽 내부 여부 | 측정 대상 |
|---|---|---|---|
| **(1) AI 분석·가상 포트폴리오** | Short List 30 → 투심위 → 선착순 Accept → 가상 포트 확정·일별 스냅샷. **서비스 본체**. | ✅ (메인 서비스) | Track Record · NSM(CAP Months) · Anti-Metric "오버라이드 비율"의 **모든 측정 대상** |
| **(2) 매뉴얼 트레이딩 서브시스템** | 각 어드민 계정에 본인 증권사 API 연결(§4.2 E9). 수동 주문. | ✅ (서브시스템, BusinessPlan §10) | 본인 계정 성과(개인 자금) |
| **(3) 자동매매 서브시스템** | 주식(KIS) + 코인(바이낸스 선물). Strategy drop-in + AI 어댑터 embed. **S8에서 구현**. | ✅ (서브시스템) | `Document/Build/Slices/S8-AutoTrading.md` |
| **(4) 외부 바이패스** | 어드민이 주픽 안에서 주문 안 하고 본인 증권사 앱 직접 사용 | ❌ (주픽 외부) | 측정 안 함 |

**핵심 규칙**:
- **승인(Accept)의 용도 = AI 분석·알고리즘 성능 측정용 가상 포트 확정**. 실제 자금 운용 강제 아님.
- **Q10 "독립 자금·독립 의사결정"** = 위 (2)(3)(4)의 실제 체결 레이어. 각자 독립.
- **선착순 단일 Accept**(§3.3 R3.3-2) = 가상 포트 기록 1건. Q10 독립 자금과 충돌 없음(실제 체결과 분리되어 있으므로).
- §4.2 E5 PortfolioSnapshot은 실제 증권사 계좌 포지션과 별개의 **가상 트래킹**이다.
- **65차 Q2 supersede**: 가상 포트 구성 = 30 전체가 아니라 AI 자율 선택 (운용여부·편입개수·종목·단중장분배·비중·현금). Accept = AI 자율 구성 포트 확정. 상세는 §1.3 J1·§3.3·§3.4 65차 노트 참조. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)

```
┌────────────────────────────────────────────────────────────┐
│                   주픽 어드민 서비스                         │
├────────────────────────────────────────────────────────────┤
│  (1) AI 가상 포트폴리오 [본체]                              │
│      Short List 30 → 투심위 → Accept → 가상 트래킹           │
│      (NSM·Anti-Metric 측정 대상)                            │
│                                                            │
│  (2) 매뉴얼 트레이딩 서브시스템                              │
│      E9 BrokerageConnection → 수동 주문                     │
│                                                            │
│  (3) 자동매매 서브시스템 (S8 구현)                           │
│      주식: E9 BrokerageConnection (KIS 모의→실계좌)          │
│      코인: E12 ExchangeConnection (바이낸스 테스트넷→메인넷) │
│      Strategy 폴더 drop-in + AI 어댑터 embed 인터페이스      │
│      대상: Short List / 자유 종목 / 바이낸스 선물 선택 가능  │
├────────────────────────────────────────────────────────────┤
│  (4) 외부 바이패스: 어드민이 본인 증권사 앱 직접 사용         │
└────────────────────────────────────────────────────────────┘
```

### §1A.1 Product Vision

> "내 돈으로 직접 운용하는 투자자가, AI 가상 펀드매니저의 **투명한 분석**을 믿고 매달 30종목을 승인하며, 12개월 뒤 **자기 이름으로 된 트랙 레코드**를 손에 쥔다."

- 3대 약속: **투명한 분석** · **끊기지 않는 루프** · **측정 가능한 성과**
- 검증 체크포인트: **M6 행동 지표** (아침 10분 루틴 · Excel 중단 · 첫 Exit 경험) / **Y1 정량 목표** → §1.7

#### 디자인 방향 — 토스 스타일 리디자인(Toss-D0~D4)

> **✅ 실행 완료 (2026-06-28, D34) — USER 지시로 Toss-D0~D4 5슬롯을 단일 세션 전면 리디자인으로 통합 실행.** 어드민 내부도구 전 화면(라우트 21 + chrome 8 + 컴포넌트 57)·전 상태(기본/에러/빈/다크/모바일)를 토스 디자인 언어로 통일. **D0 디자인 시스템 정의 = 실제 토큰 산출**(`docs/superpowers/specs/2026-06-28-toss-design-system.md`): Pretendard self-host(next/font/local) + 토스 oklch 팔레트(블루 primary·회색 배경·흰 카드, 한국증시 빨강↑/파랑↓ 유지) + 반경 스케일(16px) + soft shadow-toss-* + ease-toss + 시맨틱 상태 토큰(--warning/--success/--info) + **다크모드 실제 배선**(next-themes ThemeProvider + ThemeToggle). 무회귀(build/lint/tsc + test:ci 2513 passed·로직/라우트/서버액션/텍스트 불변)·raw hex 0(브랜드 logo/OAuth 예외)·var(--color-*) anti-pattern 0·non-toss shadow 0·raw 팔레트 0. 검토 = Claude 4-차원 적대 리뷰(regression 0 + 17 findings 수정) + omxy(gpt-5.5 xhigh) cross-runtime 적대 리뷰 CONVERGED(raw red 2건 fix) + 브라우저 시각 검증(public+admin · light+dark+mobile · 테마 토글 e2e). 아래 D0~D4 슬롯 시퀀싱은 역사 기록(통합 실행으로 supersede). 라이브 `/gstack-design-review`(populated data + auth)는 S9 직전 USER 단계로 잔존.

**토스 스타일 전체 리디자인(폰트 포함) — 마일스톤 결합 5-슬롯 (Claude↔omxy 토론 CONVERGED, 시점 결정. 스코프 C 전체·스킬 파이프라인은 확정분 — 2026-06-28 통합 실행으로 시퀀싱은 supersede):**
- **namespace guard**: 이 블록의 D0~D4는 디자인 전용 `Toss-D0~D4`이며, ServicePlan의 포트폴리오 D1~D4 의미와 별개다.
- **D0 디자인 시스템 정의 [Accept와 병행 허용 — 단 산출물(스펙/문서)만, 코드·런타임·폰트패키지·globals.css·shadcn 토큰·layout primitive 변경 0; 그 변경은 D1]**: `/gstack-design-consultation` → 토스 원칙 + 폰트 후보/라이선스/한글 렌더링/성능 조건 + 토큰 방향 + primitive 목록. 별도 브랜치/문서 산출이면 Accept 리스크 0.
- **D1 쉘 리테마 [Accept 완료 후 merge; S7b UI 착수 전 필수; B-SEL-CRON과 병렬 가능하나 충돌 시 D1이 UI 선행조건]**: `vercel:shadcn` 토큰+폰트+공통 primitive(nav/header/card/table/form) 전역 리테마 + `npx impeccable` slop 가드. 전역 회귀면적 크므로 Accept 완료 전 merge 금지.
- **D2 기존 핵심 플로우 정밀 [D11 진입 전 필수]**: 홈/리스트/리포트/포트폴리오/승인 = `ce-frontend-design` + `ce-design-iterator`. D11은 짧아도 실 운용검증이라 핵심 플로우가 final-ish여야 피드백 유효(토큰만으론 부족).
- **D3 신규 화면 final-style 동시구현 [기능 PR 내장]**: S7b 화면 = S7b 구현과 함께 / S7c 화면 = S7c 구현과 함께. 별도 후행 리디자인 금지.
- **D4 freeze [S7d 후 · S9 직전]**: 풀 리디자인 아님 — `/gstack-design-review` QA + polish + 회귀 차단만.
- 전 디자인 PR: §2.0a Claude↔omxy 루프 + `/gstack-design-review` QA + `vercel:react-best-practices`. **AI 비용 0(디자인 작업; 제품/운영 AI spend 없음).**

운영 제약: Accept go-live(MVP②)가 여전히 #1 critical path이며 리디자인이 막지 않는다. 출시 runbook 순서(Accept→B-SEL-CRON→S7b→D11→S7c→S7d→pre-launch 섹터 비교/Tier2/D4→**PR-K Reflection 빌드(D32)+D33 G1/G3 빌드**→S9→출시)에 디자인은 그 위에 결합되는 병행 트랙이다(D32로 PR-K가 S9 직전에, D33으로 G1/G3가 pre-launch lane에 추가된 것 외 순서 불변). 면책 Footer 등 기존 제약은 무변경.

### §1A.2 Unfair Advantages (복제 장벽)

| # | 제목 | 복제 장벽 |
|---|------|----------|
| **UA1** | **투심위 2-Layer 투명성** — Core 11 + Sector Board (canonical 14 sectors × 14 personas overlay = 207 roster, per-stock 14인 활성화 — D21 정정 박제), 찬반·논거 리포트 기록 | 프롬프트로 복제 불가. 운용 철학 + 섹터 전문성 + 토론 구조 내재화 필요 (65차 Q4: 토론 구조 = 멀티라운드 실시간 AI 반박 loop. 합의 점수는 선택사항 — 기존 '병렬 독립 채점 + 결정론 합의'에서 실시간 반박 토론으로 확장. HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조) |
| **UA2** | **Quant 3축 Early Warning + Crisis Layer** — 7~15일 선행, 5-Signal Composite(MA구조·모멘텀·변동성·거래량·RSI) | v1→v6 백테스트 데이터 + 파라미터 튜닝 축적물. 공개 전략 패턴 아님 |
| **UA3** | **투자 결정 루프 완성** — 선정→리포트→승인→모니터링→Exit→트랙 레코드 단일 시스템 | "시간 효과" — 12개월 운용 데이터가 쌓일수록 AI 보정·오버라이드 패턴·트랙 레코드 가치 누적 |

경쟁 포지셔닝 매트릭스·8사 비교 → `.omc/research/competitors.md`.

### §1A.3 북극성 지표 (NSM) + 측정 스펙

**NSM**: **연속 승인 월수 (Consecutive Approved Portfolio Months / CAP Months)**
- 정의: 어드민이 AI Short List를 검토·승인하여 가상 포트폴리오 트래킹이 시작된 연속 월수
- Y1 목표: **12개월 연속** → Core JTBD 1:1 대응
- **포함 규칙 (P5 I-12 박제)**: Reject → 재분석 → Accept로 **최종 승인된 월도 CAP Months에 포함**한다. Reject 최종(재분석 후에도 Reject)은 미포함(R3.3-4). 미달 월(30종목 미만)은 전월 포트 유지로 운용 연속성이 유지되므로 포함(§3.2 미달 정책 b).

**서포팅 입력 지표 5개**:

| ID | 지표 | 측정 | 목표 | 주기 |
|----|------|------|------|------|
| IM-1 | 리포트 소비율 | 신규 편입 종목 Section 0+ 열람 비율 | 신규 100%, 전체 80% | 월간 |
| IM-2 | 승인 리드 타임 | `shortlist.generated` → `portfolio.approved` 경과 일수 | ≤ 5일 | 월간 |
| IM-3 | Exit 시그널 신뢰도 | 시그널 발송 후 T+7일 추가 하락 비율 | 65%+ | 분기 |
| IM-4 | 모닝 브리핑 참여율 | 장운영일 중 브리핑 열람 일수 / 총 장운영일 | 80%+ | 주간 |
| IM-5 | 누적 Alpha | 승인가 기준 포트 수익률 − KOSPI 동기간 | 양(+) | 월간 |

**이벤트 트래킹 스펙** (B3 구현 시):

| 이벤트 | 속성 | 연결 |
|--------|------|------|
| `shortlist.generated` | month, timestamp, new_count, hold_count, removed_count | IM-2 시작 |
| `report.view` | ticker, section, admin_id, timestamp, duration_sec | IM-1 |
| `portfolio.approved` | month, admin_id, timestamp, approval_type (accept/reject) | NSM, IM-2 종료 |
| `briefing.viewed` | admin_id, channel (telegram/dashboard), timestamp | IM-4 |
| `exit.signal.sent` | ticker, severity, timestamp, trigger_reason | IM-3 시작 |
| `exit.signal.outcome` | ticker, signal_timestamp, t7_price_change | IM-3 결과 |
| `portfolio.daily_snapshot` | date, total_return, kospi_return, alpha, sharpe | IM-5 |

**리뷰 프로토콜**: 주간(IM-4) · 월간(NSM + IM-1·2·5) · 분기(IM-3 + NSM 정의 유효성) · Y1말(NSM 달성 → Decision Tree 발동)

### §1A.4 Anti-Metrics (경계 지표)

| 지표 | 임계치 | 의미 | 방어 기능 |
|------|--------|------|----------|
| AI API 월 비용 | > 50만원 (65차 hardcap 40만→50만 정정) | 리포트 생성 비용 초과 → 모델·프롬프트 최적화 필요 | **M17(실시간 비용 모니터링 + 35만원 경보〔현재 코드값/기존 경보값 — 65차 W0에서 재산정〕 + 50만원 하드 캡)** |
| 어드민 오버라이드 비율 | > 50% | AI 신뢰 실패 → 투심위 품질 재검토 | §3.3 승인 로그 + M16 Counterfactual |
| Exit 시그널 미수신 | 1건+ | 시스템 신뢰 붕괴 (전 페르소나 최대 불안 트리거) | M15 백업 채널(D10) · **M18 파이프라인 헬스체크** · **M19 Silent Health 하트비트** |
| 리포트 생성 실패 | Short List 30 중 1건+ | 데이터 파이프라인 장애 | **M18(파이프라인 헬스체크 + 95% 미만 즉시 호출)** · **M19(일간 하트비트로 조용한 장애 방지)** |

> **AI API 비용 추정 재산정 과제 (P5 I-03 박제)**: Tier 1(30종) 기준 정기 배치 실제 비용을 BuildPhase B3.3 직전 dry-run으로 실측. 추정 비용이 30만원 초과 시 프롬프트 압축 · Sector Board 샘플링 축소 등을 선제 적용하여 50만원 하드 캡 진입을 예방한다 (65차 hardcap 40만→50만 정정). 월 누적 AI 비용 35만원 경보〔현재 코드값/기존 경보값 — 65차 W0에서 재산정〕 / 50만원 도달 시 자동 재생성 차단은 §3.9 M10 DoD에 박제.

### §1A.5 해소된 결정 (P3.0 Q&A, 2026-04-15)

> Pre-P3 Q&A 세션에서 9개 의제 전부 사용자 결정. 본 표가 SoT. §1.3·§1.4·§3·§4·§1.7 본문에 반영.

| # | 의제 | 결정 | 박제 위치 |
|---|------|------|----------|
| **D1** | Reject 후 처리 | AI 즉시 재분석 1회 → 재분석본도 Reject 시 **전월 포트 유지** | §1.3 J1 |
| **D2** | 미승인 마감 | **D+5 영업일** 미승인 시 전월 포트 유지 + 텔레그램 경고 | §1.3 J1 |
| **D3** | 가상 포트 체결 가정 | 승인 시점 **종가로 100% 일괄 매수** (단순 가정) | §1.3 J4, §3 |
| **D4** | 현금 비중 | AI가 비중 결정 시 **현금 비율도 제안 (0~30%)** | §1.3 J1, §3 |
| **D5** | 분석엔진 MVP 표시 | **5-Signal Composite 점수 + 3축(추세·모멘텀·변동성) 각각 별도 표시** + 신호 텍스트 | §3 |
| **D6** | Short List 30 vs 백테스트 갭 | **Must 고정 (MVP 축소 불가)**: Short List **30 (단기 10 · 중기 10 · 장기 10)** 표시. 종목 수·관점 분배 변경 금지. 분석 로직 = **인디케이터(숫자 에이전트) + AI 투심위(Core 11 + Sector Board canonical 14 sectors × 14 personas overlay, `ReportFramework.md`) 판단 기준 + 리포트 워딩(Section 0~8)** **병렬 + 합의** 구조 — **D19 (2026-05-08, 35차)에서 직렬→병렬+합의 강화 · D21 (2026-05-20, 52차)에서 slot 모델 정정**. **백테스트는 6종목에서 시작 → 같은 알고리즘으로 점진 확장**. 백테스트 6종 단기/중기/장기 배분은 P3.1/B3에서 결정 (Short List 30 노출 구조와는 무관). | §3, §4, D19, D21 |
| **D7** | 상시 모니터링 모드 | **MVP 포함**. 단, 임계치 설정 UI는 단순화(디폴트 임계치 + 종목별 on/off만) | §1.4, §3 |
| **D8** | 리포트 재생성 cap | Reject 시 자동 재분석 **월 1회** + 어드민 수동 재생성 **종목당 월 2회**까지 (Anti-Metric AI 비용 40만원 고려) | §3 |
| **D9** | Y1 Decision Tree 대시보드 | **`/admin/decision-tree` 별도 화면** (BusinessPlan §Q4 진척도 — alpha·Sharpe·CAP Months vs 목표) | §1.7, §2 |

**보류 (서비스 설계 비영향)**:
- **Q12 공동창업자**: 어드민 인원 = **3명 가정** (본인 + 공동창업자 2명). 실존 여부는 서비스 설계에 비영향 — 계정 수 차이뿐. §1.1 반영.

> 가격 전략: 월 19,900원은 BusinessPlan §Q11 확정. BEP 51명(cap 10.2%). 추가 근거 문서 없음.

#### P5 검증 추가 결정 (v1.0, 2026-04-15)

| # | 의제 | 결정 | 박제 위치 |
|---|------|------|----------|
| **D10** | Exit 시그널 백업 채널 | Critic I-01 해소 이력의 현행 정의. ~~텔레그램·이메일 2채널 + 이메일 재시도~~ → **2026-06-09 (72차 사용자 override)**: 이메일/Resend 알림 전역 제거. **D10 = 텔레그램 best-effort(실패해도 caller 미escalate) + `/admin/alerts` durable event + 대시보드 unread badge catch-up**. SMS는 22차에 이미 제거. Anti-Metric "Exit 시그널 미수신 1건+" 방어는 외부 push + 웹 durable 2-layer로 유지. | §3.10 R3.10-15 |
| **D11** | 어드민 실행 모델 | Critic I-05 해소 — 주픽 어드민 = **AI 가상 포트 본체 + 2개 집행 서브시스템 + 외부 바이패스**(3경로 + 1 바이패스). 승인(Accept) = 가상 포트 확정이며 실제 체결 강제 아님. 선착순 단일 Accept는 가상 포트 기록 1건으로 Q10 독립 자금과 충돌 없음. | §1A.0 신설 · §1.5 · §3.3 · §4.2 E5 |
| **D12** | 어드민 증권사 API 다중 연결 | 신규 엔티티 E9 BrokerageConnection 추가. 어드민별 증권사·거래소 N개 앱키 등록, 동일 증권사라도 전략별 복수 등록 허용. scope(manual/auto/both) 구분. 시크릿 Vault 참조·평문 금지. | §4.2 E9 신설 · §4.3 · §4.5 |
| **D13** | 멤버 스코프 축소 | Critic I-11 대응 — 멤버는 **법적 문제 없는 리서치 웹페이지 수준**으로 축소. 어드민 3명 전용 운영 중심. 멤버 서비스 재정의는 `ServicePlan-Member.md` 별도 처리. | §6 연결점 |

**Must 승격 완료 (D14, v1.1)**:
- **D-OOS-6 AI API 비용 모니터링 대시보드** → **M17로 승격 완료**. Anti-Metric "월 40만원" 실시간 추적·35만원 경보·40만원 하드 캡. 박제 위치: §3.12 M17.
- **D-OOS-7 데이터 파이프라인 헬스체크 대시보드** → **M18로 승격 완료**. 5개 핵심 파이프라인 성공률 모니터링·95% 미만 즉시 호출. 박제 위치: §3.12 M18.
- **Silent Health 하트비트** → **M19로 신설·Must 확정**. 일간 "오늘 이상 없음" 브리핑으로 조용한 장애 원천 차단. 박제 위치: §3.12 M19.

**Q-OP 유보 해소 (D15, v1.1)**:
- **승인 Holding Period 24시간 + 2인 열람 게이팅 + 이의 제기 48h** → **도입 완료**. R3.3-7~R3.3-10 박제. D1 "선착순"은 유지하되 "24h 숙고 완료 + 2인 이상 풀 리포트 열람" 이후에만 Accept 버튼 활성. 연휴 우회 조항(24h vs D+4 영업일 중 짧은 쪽). B·C 이의 제기 시 48h 추가 Hold. 박제 위치: §3.3 R3.3-7~10.

**Q-OP 유보 고정 (개발 완료 전까지 재질문 금지, v1.1)**:
- **Q-OP3 멤버 유료 모델 재검토 (D13 파생)**: BusinessPlan §Q11(월 19,900원) 유지 전제. 어드민은 지불 주체가 아님 — "돈은 멤버 플랜에서 나옴, 어드민은 누가 돈내고 씀"이라는 사용자 피드백 박제. 개발 완료 전까지 재질문 금지.
- **Q-OP4 Y1 법적 등록 재검토**: 변호사 자문 결과가 도출되기 전까지 유보. 개발 완료 전까지 재질문 금지.

### D14·D15 요약 표

| # | 의제 | 결정 | 박제 위치 |
|---|------|------|----------|
| **D14** | Q-OP1 해소 — Anti-Metric 방어 3건 Must 승격 | D-OOS-6 → **M17** AI API 비용 모니터링 · D-OOS-7 → **M18** 파이프라인 헬스체크 · 신규 **M19** Silent Health 하트비트. Must 16 → **19**. Anti-Metric 4종 전부에 방어 기능 링크 확보. | §3.12 신설 · §1A.4 방어 기능 열 추가 |
| **D15** | Q-OP2 해소 — 승인 Holding Period 24h + 2인 게이팅 + 이의 48h | R3.3-7 24h Hold(연휴는 24h vs D+4 영업일 중 짧은 쪽) · R3.3-8 2인 풀 리포트 열람 이후에만 Accept 활성 · R3.3-9 연휴 우회 조항 · R3.3-10 B·C 이의 시 48h 추가 Hold. D1 "선착순" 유지, 게이팅 조건 추가. | §3.3 R3.3-7~10 · §4.2 E4 Holding 필드 |
| **D16** | 어드민 내부 도구 재정의 + 자동매매 S8 승격 + Stage 어휘 폐기 (2026-04-21) | (a) 어드민은 본인+친구 3명 내부 투자 도구. Must 19/MVP Stage 어휘는 어드민 트랙 강제 게이트 아님. (b) 구 트레이딩 3-Stage(매뉴얼→API→AI 자율) 폐기, 자동매매 = S8 단일 슬라이스 통합. (c) 자동매매 자산군: 주식(KIS) + 바이낸스 선물. 대상: Short List/자유/선물 선택. (d) Strategy drop-in + AI 어댑터 embed 이중 경로. AI 본체는 어드민 추후 drop-in. (e) 리스크 기본값: 레버리지 ≤5x · 일일 -3% 정지 · AI 일 주문 ≤20회. (f) Deferred-X → S8 승격, Deferred-Y → S8 AI 어댑터에 흡수 예정. | §0 재정의 · §1.5 AI 경계 보강 · §1.6 Non-Goals 재작성 · §1A.0 (3) 업데이트 · §2 S8 라우트 블록 · §3.13 신설 · `Slices/S8-AutoTrading.md` 신설 |
| **D17** | Admin Credential System 재설계 + DQ-7이 S7a보다 선행 (2026-04-22) | (a) KIS·Binance API 키는 env pre-wire 폐기 → 어드민 각자 UI 입력 · DB 암호화 저장. (b) 암호화 = **App-layer AES-256-GCM** (Node crypto stdlib, zero-dep · MEK는 Vercel env `API_CRED_MASTER_KEY`). (c) DB 스키마 = **분리 2 테이블** (E9 확장 + E12 신설 · provider-specific divergence 대응). (d) Vercel 첫 프리뷰 배포를 DQ-7 슬라이스에서 수행(최소 env 7개). (e) "테스트 연결" 버튼은 DQ-7에서 UI만 · 실 ping은 S8-Scaffold T8.4에서 연결. (f) **실계좌·메인넷 저장 권한 = 대표 1인** (env `ADMIN_REP_EMAIL` 신설). (g) 마이그레이션 번호 재배정: 0009 = DQ-7 credential 선점 · 0010 = alert_event CHECK 확장(BL-KRIT-7). (h) S8-AutoTrading T8.4·T8.5 UI는 DQ-7에서 선행 이관, S8 Scaffold는 `/risk`·`/strategy`·`/trading/*` 4 라우트만 담당. | §4.2 E9 필드 재정의 · §4.5 시크릿 정책 갱신 · E12 ExchangeConnection 정책 신설 · `Slices/DQ7-Credentials.md` 신설(SoT) · S8-AutoTrading.md T8.4 주석 |
| **D18** | S8 자동매매 진입 시점 재조정 + KIS 발급 비블로커화 + D11 가상 포트 운용 검증 게이트 (2026-05-08, 34차) | **[⚠️ 2026-06-01 supersede: S8 자동매매 = 🎉 출시 후 개발 (사용자 결정). 아래 v3 시퀀스의 "S7d → S8" 부분은 "S7d → S9 운용 검증 → 출시 → S8"로 정정. 출시 = 자동매매 없는 "AI 추천 + 가상 포트 + 알림" 도구. SoT = `HANDOFF.md §2.2`.]** (a) **S8 자동매매를 S7 series 다음으로 분리**. v2 "S7e 직후 S8-Scaffold 병행 + S7c·S7d 강등 큐" 폐기. v3 시퀀스 = `S7a → S7e → S7b → ★ D11 AI 가상 포트 1차 가동 (KIS 0개) → 운용 검증 며칠~1주 → S7c (KIS 본인 1개 read-only) → S7d → S8 자동매매 (KIS 자동매매 권한)`. (b) **KIS 용도 명확화**: KIS는 자동매매 전용. 일간 데이터·리포트·AI 가상 포트는 KRX/pykrx/DART/네이버로 충분 (KIS 0개로 작동). S7c WS 실시간 시세는 본인 1개로 충분. (c) **son00326·Kevin KIS 발급 지연 = S7c까지 비블로커** (BL-KRIT-2 영향 범위 축소). S8 진입 시점에 (i) 3명 각자 계정 동시 또는 (ii) 본인 단독 자동매매 + 친구 2명 모의/외부 바이패스 결정. (d) **D11 AI 가상 포트 운용 검증을 S8 선행 게이트로 명시** — 가상 포트 의사결정 품질을 어드민 3인이 며칠~1주 사용해 본 후 자동매매 도입. v2의 자동매매 최단 경로 가정 폐기. (e) S7c·S7d 강등 큐 폐기, 정규 시퀀스 복귀. 자동매매 실체결 도달 = v2 9세션 → **v3 약 12~14세션** (D11 운용 검증 추가). | `Slices/S8-AutoTrading.md` 선행 조건·Phase 헤더·status 필드 + `ProgressDashboard.md §2` v3 다이어그램 + `HANDOFF.md §2.D` (후속 슬라이스 시퀀스) + `CLAUDE.md` 상단 시퀀스 |
| **D20** | Section 8 위원별 전원 표 박제 — Sector 14명 + Core 11명 한 줄 의견 (2026-05-12, 45차) | (a) **Section 8 정적 표 4종 박제**: ① Sector Board 위원별 한 줄 의견 표(해당 섹터 14명 전원), ② **Core 11 위원별 한 줄 의견 표(11명 전원, 신규)**, ③ 쟁점별 찬반 토론 인용 3~5건, ④ 최종 합의 패널(Sector·Core 집계 + Co-Chair 만장일치 여부 + 공식 판정 + 근거). (b) **사용자 요구 직접 반영**: 사용자가 카드 1~2줄 합의 코멘트 외에 "각 페르소나가 어떤 평가를 내렸는지"를 풀 리포트에서 볼 수 있도록 요구. Reference `Document/Outputs/Report-Alteogen_196170_v3-Readable.md` §Section 8 Part A 패턴을 Core·Sector 양쪽에 대칭 적용. (c) **인터랙티브 페르소나 탐색은 Should S2 유지** — 위원 이름은 비-인터랙티브 텍스트, 클릭→풀 프로필 모달은 MVP 외. (d) **카드 1~2줄 합의 코멘트와 분업**: 리스트 화면(/admin)에서는 1~2줄 합의 발췌만 노출, 풀 리포트 Section 8에서 11명+14명 전원 한 줄씩 + 쟁점별 인용 + 최종 합의. (e) DB 영향 없음 — `committee_votes` 테이블(0003)에 11+14명 row가 이미 들어가도록 박제됨. R3.7-6/7/8 본문만 보강. | §3.7 R3.7-6/7/8 보강 · M3 AC·DoD 갱신 · 본 §6 D20 항목 |
| **D22** | Tier 2 production sector persona prompts quality target = Kevin v3.1 reference **코드 박제 완료 (53차 §3, PR #8 OPEN)** | (a) **product/spec decision**: D21에서 박제한 canonical 14 sectors × 14 personas/sector overlay (196 persona)의 **실제 production system prompts**가 **53차 §3 Layer (a~g) ALL CONVERGED**로 박제 완료 — `tudal/src/lib/ai/prompts/kevin-v31-rubric.ts` (4 inquiry axes + 8 quality markers + applyKevinV31Rubric helper) + `personas/sector-persona-builder.ts` 확장 + `personas/index.ts` Core 11 wrapping. 207 persona × 8 markers = 1656 assertions 전수 통과. 회사명 50+ tokens grep 0. (b) **Kevin v3.1 reference 자료** (main 보존, 53차 §0 stale-fix 박제로 origin/IMVCOM 4 commits 모두 main ancestor 확정): `Document/Outputs/Report-Alteogen_196170_v3-Readable.{md,html}` + `Document/Service/Report/ReportFramework-v3-{DraftPhilosophy,NarrativeDesign,Decisions,ValuationTrial}.md` + `ReaderAnalogyCards-ConstructionToBio.md` + Samchundang + BioSectorReport-Alteogen. **Step 3a SKIPPED** (53차 §0 박제 — IMVCOM 이미 main ancestor). (c) **Step 3b 진행 순서**: 53차 §2 builder PR #7 MERGED `02c7947a` → 53차 §3 Layer (a) Kevin rubric SoT → Layer (b~e) sector philosophies + base + overlay principles → Layer (f) Core 11 inject → Layer (g) builder cleanup + 196 coverage + 회사명 cleanup → PR #8 OPEN. (d) **quality follow 항목 코드 박제**: 4 inquiry axes (Q1~Q4) + 8 markers (M1 axes / M2 financial cite / M3 no-fabrication / M4 peer / M5 valuation trial / M6 BUY/HOLD/SELL / M7 일상 비유 / M8 200자 cap) + persona individuality wrapper + 회사명 invariant + 28 manual review sample fixture (docs/superpowers/snapshots/2026-05-21-step3b-prompt-samples.md). | 본 §1A.5 D22 (본 행, 53차 §3 갱신) · §8 v1.8 changelog · `Document/Process/HANDOFF.md §5 SoT 표 + §9 운영 원칙 박제 [[handoff_kevin_v31_quality_target]]` + `docs/superpowers/specs/2026-05-21-kevin-v31-rubric.md` (rationale) + `docs/superpowers/snapshots/2026-05-21-step3b-prompt-samples.md` (manual review only) 동시 박제 |
| **D21** | Tier 2 Sector Board slot 모델 정정 — Option C overlay 14 personas/sector 박제 (2026-05-20, 52차) | (a) **slot 모델 정정**: D19에서 사용된 "Sector Board 14 sectors / 10 slots per sector (= 140 페르소나 roster)" 표현은 §4.2.1 partA contract (`length ∈ {0, 14}`)와 사전 충돌이었음. **본 D21에서 Option C overlay 박제** = **canonical 14 sectors × 14 personas/sector** (10 base slot + 2 primary overlay + 2 sub_tag overlay). roster total = 14 × 14 = 196. per-stock 활성화 = 해당 섹터 14인. partA contract는 D21 supersession 후 정확. (b) **sub_tags jsonb crosswalk 7개** (`short_list_30.sub_tags`, mig 0018): 조선→운송/물류 · 방산→철강/소재 · 화학→철강/소재 · 게임→IT/SW (primary) + 엔터/미디어 (secondary) · 가전→유통/소비재 · 제약→바이오 · 부동산→건설. **운영 UI taxonomy proxy** (개념 정합 아님 — canonical 14 유지 목적). (c) **`tudal/src/lib/screening/canonical-sectors.ts` 신규** (hardcode 14 sectors + 10 base slot + 2 primary overlay + 2 sub_tag overlay + sub_tag crosswalk + LEGACY_ALIAS_MAP 좁게). 본 PR 시점 production code import 0 (tests/만). (d) **마이그 0018**: `short_list_30.sub_tags jsonb NULL` 추가 + GIN index. row backfill 없음 (Tier 2 impl PR 책임). (e) **`commit_sector_personas` 신규 RPC** = **Tier 2 implementation PR scope (본 PR OOS)**. (f) cost worst-case = Core 11 + Sector 14 + chair 1 = 26 calls/stock × 30 = 780 정기 + regen 2× = 2,340 worst-case ≈ 33만원 cache-off (M17 400k hardcap 내). (g) **D19/D20 본문 inline 정정**: 모든 "Sector Board 14 sectors / 10 slots per sector" 어휘 = "Sector Board canonical 14 sectors × 14 personas overlay"로 치환. supersede 주석 추가. | §1A.5 D21 신설 (본 행) · D6 본문 보강 · §3.2 R3.2-4 inline 정정 · §3.7 R3.7-6 inline 정정 · §4.2 E1 ShortList30 sub_tags 컬럼 행 추가 · §4.2.1 partA 주석 ("14 = overlay 후 canonical fixed") · §8 v1.7 changelog · `Service/Report/ReportFramework.md` §7.2 14-slot 재작성 + §7.3 sub_tag 크로스워크 표 신설 + §8 v2.5 + §10 v2.5 · `tudal/src/lib/screening/canonical-sectors.ts` 신규 · `tudal/supabase/migrations/0018_short_list_30_sub_tags.sql` + rollback · `Document/Process/HANDOFF.md` §6 51차 next-action 갱신 |
| **D23** | shortlist 30종목 + 풀 리포트 흐름 정정 박제 (2026-05-21, 53차 §5) — D19/D21/D22의 supersession entry, 박제 vs 코드 mismatch 정정 | (a) **product/spec decision (사용자 lock-in 8 항목)**: ① 30종목 선정 흐름 = Tier 0 인디케이터·DART numeric narrow → Tier 1 Core 11 AI 평가 + 시간대별 페르소나 가중치 → 단/중/장 top 10 = 30 (AI가 단/중/장 분류 결정에 직접 영향, Tier 0 단독은 fallback). ② 풀 리포트 흐름 = writer Section 0~7 통합 + Tier 2 sector 14 페르소나 Section 8 partA/partD = **단일 산출물**. 선정 30 = 풀 리포트 30. ③ AI 호출 트리거 3 path = (a) cron 매월 자동 / (b) reject 후 trigger 버튼 / (c) 종목별 Regen 버튼. ④ UI 흐름 = `/admin` 또는 `/admin/portfolio` 30종목 리스트 → 종목 클릭 → `<details>` accordion 펼침 → "풀 리포트" 버튼 → `/admin/report/[ticker]`. ⑤ Track Record 의미 재정의 = 누적 성과 + 월별 리포트 아카이브 **한 페이지 탭 분리**. ⑥ Kevin v3.1 quality target 박제 (D22 박제 보존, 53차 §3 PR #8 머지). ⑦ Sector reference 자료 3-level 분류 (Level A 본문 reference 2/12 · Level B §9.2 체크리스트 4/10 · Level C SECTOR_PHILOSOPHIES 14/0). ⑧ API 금액 무관 — Tier 1 호출 범위(60/90/150) 후속 PR2 결정. (b) **박제 vs 코드 mismatch Group A-H (8 그룹)**: Group A track-record가 trigger 위치 박제 (실제 = 누적 성과 read-only) · Group B 30종목 선정 AI 부재 (현 코드 = Tier 0 단독 30 직선정, fallback이 메인 path로 굳어진 상태) · Group C cron monthly-batch mock dry-run only · Group D Step 3c "DONE" 박제 (실제 = PARTIAL — dangling server action `triggerMonthlyPersonaEvalAction`) · Group E writer Section 0~7 본문 미구현 박제 누락 (현 코드 = `section_8` jsonb commit만 가능) · Group F Track Record 의미 박제 (누적 성과 vs 과거 아카이브 분리 누락) · Group G Sector reference 3-level 분류 (본문/체크리스트/philosophies 미분리, "12 부족" 어휘 모호) · **Group H Critical** stock_reports schema drift + report page crash 위험 (admin-reports.ts validation 0 + page.tsx section0.conviction early deref + Section 0~7 nested deref + Section 8 partA/B/C/D 신규 shape vs old conclusion/recommendation/keyQuotes shape mismatch). (c) **canonical 후속 implementation 순서 (PR scope)**: **PR2 (Tier 1 AI 30 선정 screening) → PR3a (Group H schema drift fix Hard gate) → PR1 (cron monthly-batch real path, server-side only) → PR3b (writer Section 0~7 본문 구현) → PR4 (UI trigger 버튼 + Track Record 탭 + Regen 실 호출 wire)**. **Hard gate (PR1 ⊥ PR3a 미선행 = page crash inevitable)** — 사용자가 종목 클릭 시 `section0.conviction` early deref crash. (d) **OMXY 적대적 검토 R1~R5 누적 21 BLOCKERS catch & fix** (R1 6 BLOCKERS · R2 4 BLOCKERS · R3 6 BLOCKERS · R4·R5 5 BLOCKERS · 21 total). (e) **spec doc path**: `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md` (전문 SoT). (f) **정정 대상 file matrix**: HANDOFF.md (§0·§1·§2.1·§3·§6) + ServicePlan-Admin.md (§1A.5 D19·D23 신설·§3·§4 E1·§8 v1.9) + ReportFramework.md (§8 Step 0·1~4·§9.2) + ProgressDashboard.md (Step 3c 행 + 잔여 task) + CodebaseStatus.md (writer.ts·dangling exports·short_list_30·Group H schema drift·Regen 미구현) + CLAUDE.md (상단 시퀀스 v3.3) + S7-RealData.md (T7e.8 fallback 명시). | §1A.5 D23 신설 (본 행) · §1A.5 D19 inline 정정 (메인 path/fallback 분리) · §3 페이지 IA 정정 (track-record 탭 분리 + report/[ticker] 풀 리포트 + portfolio 30종목 + UI 흐름) · §4 E1 short_list_30 현재 상태 박제 (현재 = Tier 0 단독 30 / 정정 후 = Tier 1 AI 30 PR2 후속) · §8 v1.9 changelog · spec doc `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md` |
| **D19** | JooPick AI 강화 — Tier 0/1/2 병렬 + 합의 배지 + Reflection (2026-05-08, 35차) — **D23 (53차 §5)에서 메인 path vs fallback 어휘 정정 박제** · **73차 supersede: 본 entry 내 "(현 production 상태)=Tier 0 단독" / "(c) 현 코드 상태 = 미구현 (PR2 후속)" / "hardcap 40만원" 표기는 53차 당시 기준 — 현 production = 실 AI 30(73차 PR #109), Tier 1 구현·가동 완료, hardcap 50만(D26). 스코어링 방법론은 D30(77차) **B++ 삼중 게이트 검증 대기**(B+ 단독 REJECT)** | (a) **Short List 30 선정 = "숫자(인디케이터) + AI(Core 11 페르소나) 병렬 + 합의 에이전트" 구조 박제**. 외부 레퍼런스 [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) Analyst Team + Reflection 패턴 차용 + JooPick 박제 (Core 11 + Sector Board canonical 14 sectors × 14 personas overlay) 보존 — **slot 모델 = D21 (52차) supersede**. (b) **Tier 0 — 인디케이터·DART numeric narrow (메인 path 1단계)**: pykrx·KRX·DART로 코스피·코스닥 ~2,500종 → 5-Signal Composite × 시간대별 가중치 → 단/중/장 후보 50씩 = 150. AI 키 없이도 후보 150 산출 가능. **AI 키 발급 후 = Tier 1 입력**. **AI 키 미발급 시 fallback = Tier 0 단독 30 직선정** (현 production 상태, D23 §5 정정 박제). (c) **Tier 1 — Core 11 페르소나 평가 + 시간대별 페르소나 가중치 (메인 path 2단계, 메인 path 30 선정 결정자)**: 150 후보 → 시간대별 페르소나 가중치 (단기엔 Druckenmiller·Burry ↑, 중기엔 Lynch ↑, 장기엔 Buffett·Munger·Fisher·Pabrai ↑) → 단/중/장 각 top 10 = 30 선정. **AI가 단/중/장 분류 결정에 직접 영향** (D23 §5 lock-in 1.1 박제). **현 코드 상태 = 미구현 (PR2 후속)**. (d) **Tier 2 — Sector Board overlay 활성화 (선정된 30종목만)** — **D21 정정**: 종목별 해당 섹터 14인 활성화 (canonical 14 sectors × 14 personas/sector roster 중 매칭 섹터의 14인). 종목당 Core 11 + Sector 14 = 25명 (+ chair 1 = 26) × 30종 ≈ 780 LLM call/월 정기 (+ regen worst-case 2,340 ≈ 33만원 cache-off, M17 hardcap 40만원 내). Section 0~8 풀 리포트 + 쟁점별 찬반 대결 (현 §5 박제 그대로). (e) **합의 에이전트 — 5종 배지 (49차 Q5b CONVERGED)**: 🟢 강한 합의 (둘 다 추천 우선) / 🔵 숫자 우세 (모멘텀 강하나 정성 우려) / 🟣 AI 우세 (정성 좋으나 차트 약함) / 🟡 **관망** (둘 다 비-top tier, 시기 미상 — Q5b 49차) / ⚪ AI 분석 대기 (AI 키 미발급 placeholder). 어드민 Short List 30 카드에 🔢 숫자 점수(0~100) + 🤖 AI 점수(0~100) + 합의 배지 + AI 코멘트 1~2줄 노출. 클릭→풀 리포트(Section 0~8). (f) **Reflection — 자가학습 (TradingAgents 차용)**: 매월 말 지난달 추천 30종목의 실현 수익률 → 다음달 Tier 1 prompt에 주입 → 페르소나 가중치 자가조정. trading_memory 패턴. (g) **메인 path vs fallback 분리 (D23 §5 정정 박제)**: **메인 path** = Tier 0 인디케이터·DART numeric narrow → Tier 1 Core 11 AI 평가 + 시간대별 페르소나 가중치 → 단/중/장 top 10 = 30 선정 + Tier 2 sector 14 페르소나 Section 8 partA/partD plug-in (선정된 30종목만). **fallback** = AI 키 미발급 시 Tier 0 단독 30 직선정 (현 production 상태, PR2 미진입). **AI 키 발급 후** = Tier 1 AI 30 선정 enable + Tier 2 plug-in. (g') **Tier 1 호출 범위 = open question (D23 §5 lock-in 1.8 박제)**: 150 후보 전체 호출 / 60 narrow (단/중/장 20씩) / 30 narrow 중 후속 PR2에서 결정 — 사용자 명시 "API 금액 무관, 비용 결정 후속 PR로". (h) **Smoke #3 (Binance) ⏸ 유예**: Binance 키 미발급 + S8 자동매매 분리(D18) → S8 진입 시점에 진행. DQ-7 Session 3 종결 = Smoke #4·#5만으로. | §1A.5 D19 신설 · D6 본문 보강(병렬 + 합의) · §3.1 R3.1-6 신설(이중 배지·합의·AI 코멘트 1~2줄) · §2 라우트 블록 컬럼 명세 갱신 · `Service/Report/ReportFramework.md` §8 Step 0 + Step 4 후속 보강 · `Slices/S7-RealData.md` Tier 0 분기 + 30개 검증 DoD · `Slices/DQ7-Credentials.md` Smoke #3 ⏸ 유예 · `ProgressDashboard.md §2` v3.1 다이어그램 + Tier 0 게이트 박스 · `HANDOFF.md §1·§2·§4·§7` · `CLAUDE.md` 상단 시퀀스 v3.1 + D19 라인 · **D23 (53차 §5) 정정 박제 (메인 path/fallback 분리 + Tier 1 호출 범위 open question)** |
| **D26** | **MVP 엔진 7결정 master 박제 (2026-06-04, 65차) — Q1~Q4 + hardcap50 + 역할별 모델 + MVP 재정의. omxy CONVERGED.** | **(Q1) 선정주기 분리** = 단기 주1회 + 중장기 월1회 (기존 '매월 1일 단일배치로 단·중·장 30 동시선정'은 supersede). **(Q2) AI 자율 포트구성** = 30 중 운용여부·총편입개수·종목선택·단중장분배·종목별비중·현금0~30% 전부 AI 자율 결정. 어드민 Accept/Reject 게이트 유지(대상 = AI 자율 구성 포트 N≤30). 기존 '항상 30 전체 + AI는 비중만 제안 + Accept/Reject만'은 supersede. **(Q3) 모델 하드코딩 제거 + 설정화** = Claude+GPT 멀티프로바이더 + provider auto-detect(GPT 키 없으면 Claude-only) + 모델 레지스트리. **(Q4) 실시간 멀티라운드 반박 토론 loop** = Core 11 병렬 독립 채점 → 실시간 토론 loop, 합의점수 선택. **hardcap 40만→50만원 정정** (35만원 경보값은 현재 코드값/기존 경보값 유지 — W0에서 재산정). **역할별 모델 차등** = 토론=저가 / 최종 judge·리포트=고가. **MVP 재정의** = 고도화 아님; MVP = 30리스트 + 포트폴리오 + 30리포트 정확. **빌드순서 W0→W2→W1→W3** (PR-G ⓑ는 W0~W3로 superseded). **영향 섹션**: §1.2·§1.3 J1·§1.5·§1A.0·§1A.2 UA1·§1A.4·§3.1 R3.1-6·§3.2·§3.3·§3.4·§3.7 R3.7-7·§3.9·§3.12 M17 R3.12-3·§4.2 E1·E2·§4.4·§5 (노트/포인터만 추가, D19~D23 본문 불변). **선정 알고리즘·포트 proposal schema·토론 loop schema·모델 레지스트리 구현은 W0~W3 위임** (본 문서는 supersede 포인터만). **상세 SoT = HANDOFF.md ⭐ 65차 MVP 엔진 섹션**. | §1.2·§1.3 J1·§1.5·§1A.0·§1A.2·§1A.4·§3.1·§3.2·§3.3·§3.4·§3.7·§3.9·§3.12·§4.2·§4.4·§5 노트 추가 · 본 §1A.5 D26 (본 행) · §8 v2.1 changelog · 상세 SoT = `HANDOFF.md ⭐ 65차 MVP 엔진 섹션` |
| **D27** | **Q5 펀드식 incumbent thesis 재점검 (2026-06-04, 65차 후속 — MVP 포함). omxy CONVERGED.** | **모든 트랙(단기 주1회 포함) 재선정 시, 기존 리스트 종목(incumbent)은 직전 리포트·논거·합의배지·점수 + 그 이후 실현 성과를 "incumbent thesis context"로 주입받아 논거 유효성을 재점검** → 유효=유지 후보 / 깨짐=제외. **유지는 자동 아님** — 신규 후보와 동일 랭킹 경쟁, 각 트랙 top10 안에 들어야 유지(서비스 = 펀드 운용 관점, 백지 재발굴 X). cold start=신규 취급. **구현 귀속**: W2 = 트랙별 후보풀 **fresh Tier 0 ∪ incumbents**(union+dedupe+expected_total 재계산, incumbent 무심사 탈락 금지 — 탈락은 W1 랭킹 후에만) + incumbent 식별 + prior-context builder(직전 short_list_30 row + stock_reports 요약 + 실현 성과) / W1 = 토론 프롬프트 주입(`reflectionContext` 코드 seam 재사용, 명칭은 incumbent thesis context). **비용**: incumbent union overhead(단기 +10×11/주 + 중장기 +20×11/월 + 요약 ~1-2k tok/종목) W0 reservation 산식 포함. **D19(f) Reflection·PR-K(월말 전체 회고)와 별개** — Q5는 선정 시점 per-incumbent review(MVP), PR-K는 **D32(2026-06-24 USER)로 출시 전 빌드+S9 검증으로 승격**(구 defer supersede — §1A.5 D32). **상세 SoT = HANDOFF.md ⭐ 65차 MVP 엔진 섹션**. | 본 §1A.5 D27 (본 행) · §8 v2.2 changelog · D26 영향 섹션의 선정/재선정 관련 노트에 자동 포함(HANDOFF ⭐ 포인터 상속) |
| **D28** | **AI 프로바이더 위상 + 역할→모델 기본 배분 (2026-06-04, 65차 후속 — D26 결정6 재정의). omxy R1~R2 CONVERGED.** | **결정6 재정의**: ~~토론=저가/최종=고가(비용 주도)~~ → **목적함수 = 단/중/장 주가 상승 예측 적중률 + 리포트 내용 정확성, hardcap 50만 = 제약조건**(사용자 명시 — 비용보다 적중·정확성이 관건). **(A)** Claude = 필수 primary / GPT = 선택 secondary / **GPT-only 미지원**. **(C)** **MVP 기본 = 두 키 동시 사용**(`ANTHROPIC_API_KEY` + `OPENAI_API_KEY`, 사용자 제공) · auto-detect fallback 유지 · 설정 UI 토글 = 후순위. **(B-final, 초기 기본값=가설 — track-record 적중률 측정 후 레지스트리에서 조정)**: 토론 참가 Core 11 = Sonnet 4.6 ×6 + GPT mid ×5 혼합 / R2 선택적(top10 경계 ±5 + persona 분산 상위 20%, config 상수) / 최종 judge = Opus 4.8 + 경계 ±2 GPT 최고급 dual-judge(불일치 시 Opus 최종) / writer·revise = Opus 4.8 / critic = GPT mid 교차 비평(off 시 Haiku) / W3 포트 판단 = Opus 4.8. **W0 비용가드 3종 (DoD)**: GPT+Opus 4.8 단가 등록 · unknown model fail-closed(silent Sonnet fallback 제거) · model-aware reservation(균일 count×MAX_COST 폐기) + reservation ≤50만 재검증. **상세 SoT = HANDOFF.md ⭐ 65차 MVP 엔진 섹션 9번**. | 본 §1A.5 D28 (본 행) · §8 v2.3 changelog · §3.12 M17(비용)·§3.1 R3.1-6(AI 점수) 등은 HANDOFF ⭐ 포인터 상속 |
| **D29** | **토스 스타일 전체 리디자인(폰트 포함) Toss-D0~D4 시점 결정 (2026-06-10). Claude↔omxy 토론 CONVERGED.** | 스코프 C 전체·스킬 파이프라인은 확정분이며, 결정 대상은 **시점·시퀀싱만**. **Toss-D0** 디자인 시스템 정의는 Accept와 병행 허용하되 산출물(스펙/문서)만, 코드·런타임·폰트패키지·`globals.css`·shadcn 토큰·layout primitive 변경 0. **Toss-D1** 쉘 리테마는 Accept 완료 후 merge, S7b UI 착수 전 필수, B-SEL-CRON과 병렬 가능하나 충돌 시 UI 선행조건. **Toss-D2** 기존 핵심 플로우 정밀은 D11 진입 전 필수. **Toss-D3** S7b/S7c 신규 화면은 기능 PR 내 final-style 동시구현. **Toss-D4**는 S7d 후·S9 직전 `/gstack-design-review` QA + polish + 회귀 차단 freeze이며 풀 리디자인 아님. 전 디자인 PR은 §2.0a Claude↔omxy 루프 + `/gstack-design-review` QA + `vercel:react-best-practices`; AI 비용 0(디자인 작업; 제품/운영 AI spend 없음). | §1A.1 디자인 방향 · P8 UI Design · HANDOFF.md §다음 할 일 병행 트랙 · ProgressDashboard CURRENT |
| **D34** | **토스 스타일 전체 리디자인 실행 완료 (2026-06-28, USER 지시).** Toss-D0~D4 5슬롯을 단일 세션 전면 리디자인으로 통합 실행(b4-freeze의 "풀 리디자인 아님" 범위를 USER가 확장). 어드민 내부도구 전 화면(라우트 21 + chrome 8 + 컴포넌트 57)·전 상태를 토스 디자인 언어로 통일. 산출 = Pretendard self-host + 토스 oklch 토큰(블루 primary·회색 bg·흰 카드, 빨강↑/파랑↓ 유지) + 16px 반경 + soft shadow + 시맨틱 상태 토큰 + 다크모드 실제 배선(next-themes). 무회귀(test:ci 2513 passed·로직/라우트/서버액션/텍스트 불변·raw hex/var(--color-*)/non-toss shadow/raw 팔레트 전부 0). Claude 4-차원 적대 리뷰(regression 0) + omxy CONVERGED + 브라우저 시각 검증(light/dark/mobile, 테마 토글 e2e). 라이브 `/gstack-design-review`(populated+auth) = S9 직전 USER 잔존. | §1A.1 디자인 방향 · `docs/superpowers/specs/2026-06-28-toss-design-system.md` · HANDOFF.md · ProgressDashboard |
| **D30** | **Tier 0 스코어링 방법론 = "B++ (size-sleeve recall-first) + recall/rank-IC/size 삼중 게이트" 채택 (2026-06-12, 77차). 1차 B+ → 실증 후 B+ REJECT → B++. Claude 퀀트 에이전트 + omxy(트레이딩/퀀트 sub-agent) 2 독립 토론 CONVERGED, main Opus 종합·판정.** | 사용자 핵심 질문 = "후보 150이 정말 **향후 상승할 기업을 올바르게 예측·선별**하느냐"(특정 종목 강제진입 아님 — 방법론 타당성). **실증(production 150, MCP 직접 쿼리)**: 대형 상승 주도주 11개 중 **SK하이닉스만 진입·나머지 10(삼성전자·HD현대일렉·한화오션·조선·원전·2차전지) 전부 누락**, 상위 픽은 소형 급등주, long 5점폭 압축 → 사용자 직감 확증. **근본원인 = 구조적 retrieval 실패**(① 지속추세 시그널 부재 — 60일 단기·반전 모멘텀뿐이라 다개월 오른 대형 주도주가 close/MA60≈1.0 수렴해 안 보임 ② 원시비율 모멘텀×거래량이 저가·고변동 소형주 점수 폭발 = size+변동성 노출). **B+ 정규화로는 못 고침 → B++.** **B++** = ⓐ **size sleeve**(Large 시총상위20%/Mid 다음40%/Small-liquid 하위40% — horizon별 20/20/10 = 150이 Large60/Mid60/Small30, 슬리브 내부 rank) ⓑ **유동성 플로어**(ADV60 + anti-pump turnover, `ACC_TRDVAL` 무비용) ⓒ **모멘텀 재설계**(close/MA60 폐기 → risk-adjusted 20/60/126/252D trend + 52주 고가 근접 + spike penalty) ⓓ winsorize+percentile rank·결측 tiering·foreign ADV+대형 sponsorship·sector-relative quality·volume=trend확인시만 capped(long 0) ⓔ **수기 가중치 폐기 → rank ensemble**(baseline 대비 recall/IC 악화 시 fail). **삼중 게이트**: Gate A recall(forward top-decile, **대형 leader recall 별도** + visible-trend는 진단용[primary 분모 고정] + 11-leader는 비최적화 tripwire[target leakage 금지]) · Gate B rank-IC(유동universe+**슬리브별 IC>0**+top-tercile scope, IR≥0.3, recall통과/IC실패→사용자 adjudication; large/mid recall fairness는 Gate A 단일 평가) · Gate C size composition(60/60/30·Small-liquid≤25%·score-log(mcap) report, **결정론 진입조건·IC 없음**). **AI 2차는 150 누락 구제 불가 → recall은 Tier0 책임.** survivorship(상폐 포함 PIT)·announcement-date PIT = 최대 검증 리스크. **삼중 게이트 통과 전 --apply/Tier1 비용/"상승 예측" claim 금지.** 산출물 설명 = "robust, factor-informed, leader-inclusive candidate shortlist"까지만. **구현 = 다음 세션.** **SoT spec = `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md`**(B++ 전문). | 본 §1A.5 D30 (본 행) · §3.1 R3.1-6 (Tier 0 5-Signal) · M4 DoD · CodebaseStatus 77차 · HANDOFF §지금 당장·5단계 · spec doc |
| **D31** | **Accept(가상 포트 확정) 게이트 내부도구 완화 모드 (2026-06-12, 77차). 사용자 결정. omxy R1~R2 CONVERGED. PR #120 MERGED.** | 사용자 발견 = Accept 버튼 비활성(D+4 영업일 Hold 만료 06-15 + 2인 열람 0/2). `computeAcceptGate` 코드 확인 = **정상 D15 게이팅**(버그 아님)이나, Accept = **가상 포트 확정**(실거래 아님·성능측정용)·**3인 내부도구**·본인이 의사결정자인데 멤버서비스급 게이트(D+4 Hold + 2인 열람)가 그대로 걸린 게 마찰. auto-relief(`detectSingleAdminStreak`)는 admin 접속로그 테이블 부재로 영구 false 스텁이라 우회 불가. **결정 = 내부도구용 완화** (D15 §3.13 R3.3-7~10 supersede, 내부도구 한정). **구현**: `gating.ts` `AcceptGateInput.relaxGate` — 24h sanity hold는 유지, relaxed면 **D+4 영업일 Hold + 2인 열람 면제** 후 즉시 통과. caller(`portfolio/actions.ts` 서버집행 + `page.tsx` 표시) **default = relaxed**(env `PORTFOLIO_ACCEPT_GATE_STRICT=true`로 멤버서비스급 strict 복원 opt-in) + relaxed면 viewer/auto-relief DB 조회 skip(DB/RLS 실패가 accept 차단·page crash 안 되도록) + relaxed 모드 UI 배너(감사성). **순수함수 후방호환**(relaxGate 미지정=strict). **의도적 default 변경**(strict→relaxed): 제품 = 3인 내부도구 한정(멤버=Deferred-D 미빌드)·가상포트 stakes 낮음. **멤버 공개(Deferred-D) 재개 시 `PORTFOLIO_ACCEPT_GATE_STRICT=true` 필수.** | 본 §1A.5 D31 (본 행) · §3.13 R3.3-7~10 (D15 게이팅) supersede(내부도구 한정) · §8 v2.6 changelog · `gating.ts`/`portfolio/{actions,page}.tsx` · CodebaseStatus 77차 · HANDOFF §지금 당장 |
| **D32** | **Reflection / PR-K (AI 자가 학습) 출시 전 승격 (2026-06-24, USER 결정). ① Claude docs draft → ② omxy catch-only → ③ Claude 적대적 재검토 (HANDOFF §2.0a plan-stage).** | **결정**: AI 자가 학습(Reflection / PR-K — 직전 선정 사이클 실현 성과 → 다음 선정 prompt 주입 → 페르소나 가중치 자가조정, TradingAgents trading_memory 패턴)을 **"출시 후 defer" → "출시 전 빌드 + S9 운용 검증(어드민 3인 1개월+) 기간 중 실가동·검증"** 으로 승격. **근거**: ① "출시 후" 라벨은 62차(2026-06-02) Claude 문서정합 분류(git `8fc91d4`·`2809f0e`)였지 USER 명시 결정이 아니었음(도입 35차/D19엔 "S7a 후속 PR" = 당시 슬라이스 순서상 출시 전 구간) ② 데이터 의존성(직전 실현 수익률→다음 prompt)은 S9 운용 검증 창(출시 전 1개월+ 실 선정 운용)이 충족 → 출시 시점엔 (단기/주간 트랙) 이미 작동·검증된 자가학습(중장기 월간은 §4 타이밍 — S9 길이·첫 선정일 의존·no-op fail-soft) ③ 공개 출시 후 급조보다 S9 검증이 안전. **supersede**: 62차 doc-class + 65차 item-8(Q5) 꼬리문장 "PR-K defer 유지". **불변**: MVP 3종(30리스트/포트/30리포트, 65차 USER 잠금) — Reflection은 대체 아님·launch-readiness 추가. **빌드 아웃라인**: reflection_log 영속(0038~, dormant flag) + track별 회고 job(주1/월1, 65차 Q1) + 다음 선정 prompt 주입(`reflectionContext` seam 재사용). **Q5 incumbent thesis(D27, 선정 시점·구현됨 PR #91)와 별개** — seam 공유하나 PR-K = 별도 reflection_log + 회고 job(혼동 금지). **게이트 분리 확정(spec §6)**: PR-K 빌드 완료 = S9 진입 sequencing 선행조건 / Reflection 동작·품질 = soft launch criterion(§2.2 7-criteria는 hard 불변·미변경). **SoT spec = `docs/superpowers/specs/2026-06-24-reflection-prk-pre-launch-promotion.md`**. **⭐ 빌드 완료(2026-06-27, dormant)**: 본 결정-시점 아웃라인의 "0038~ / `reflectionContext` seam 재사용"은 **빌드가 supersede** — as-built = 마이그 **0043** + **신규 `reflectionLearningContext` 필드**(Q5 `reflectionContext` per-ticker와 **별개 필드·재사용 아님**) + atomic claim + 예측 출력 필터. 빌드 SoT = `docs/superpowers/specs/2026-06-27-reflection-prk-build.md`(Claude 5-lens + omxy R1 CONVERGED·게이트 green). | 본 §1A.5 D32 (본 행) · §8 v2.8 changelog · §1A.5 D27 "defer 유지" 클로즈 정정 · `Service/Report/ReportFramework.md` §8 Step 4 후속 · `Process/HANDOFF.md` §2 Runbook 표 · `Slices/S7-RealData.md` T7a.10 · `CLAUDE.md` 상단 D32 + 출시 시퀀스 |
| **D33** | **TradingAgents graft 출시 전 로드맵 — G1 Reflection Lab + G2 Leader-miss why-excluded + G3 Risk 3자 토론 + G4 Macro/news AI context 채택 + G5 reject (2026-06-25, USER 확정). Claude↔omxy 토론 CONVERGED. 본 세션 = 문서 최신화만(코드 빌드 0).** | **BIG PRINCIPLE(USER·Claude·omxy 동의)**: TradingAgents per-ticker 토론을 2,500→150 funnel에 **직접 이식 금지**(비용 폭발) — Reflection/매니저 oversight 패턴만 funnel "위" 검증·학습 레이어로 차용. 150 문제 = retrieval/factor 실패(B++ **NO-CONFIG-PASSES**) → **"상승 예측" claim 영구 금지·production 자동 교체 없음**이 G1~G4 전부에 적용. **disposition**: **G1**(신규 pre-launch 빌드+S9 관찰) 과거 150/30+실현수익률 postmortem → B++ funnel 가중치 champion/challenger **제안만→USER 승인**·diagnostic only·자동 적용/예측 claim 금지·**PR-K(D32)와 다른 층**(funnel 가중치 vs prompt 주입). **G2**(기존 Path-A Track-2 흡수·**신규 빌드 금지**) 대형 리더 누락 why-excluded 진단 1줄을 섹터 비교 메뉴 + PR-B4 `shadow_reconcile.py` 위에 표면화·**hard-gate live 영구 금지(soft only)**·₩0. **G3**(신규 pre-launch 빌드·**USER 출시 후→출시 전 이동**) portfolio Accept 전 포트 구성별 1회 risk 3-debator(공격/보존/중립) 위험 재판정 컨텍스트 layer·거래별 아님·**Accept 게이트 substitute 아님**·Q2 자율 포트 결합·비용 중. **G4**(S7b 결합) FRED 거시+뉴스+(선택)Polymarket → Tier1 평가/리포트/브리핑 **컨텍스트 입력**·**Tier0 정량 factor로 직접 사용 금지**·M12a(per-ticker 자동제외)와 범주 분리·₩0. **G5 = REJECTED**(Bull/Bear 심층 토론 = JooPick Q4 실시간 반박 토론 loop[D26 Q4·W1a/W1b]와 중복, 채택 안 함·기록만). **불변**: MVP 3종(30리스트/포트/30리포트, 65차 잠금) 대체 아님·launch-readiness 추가 / **§2.2 7-criteria 출시 게이트 미변경**(G1/G3 빌드=sequencing deliverable, 동작·품질=soft criterion). 기존 pre-launch 순서(S7b→D11→S7c→S7d→pre-launch lane→S9→출시) 불변 — G1/G3=pre-launch 빌드 lane, G2=섹터 비교 메뉴, G4=S7b. **SoT spec = `docs/superpowers/specs/2026-06-25-tradingagents-graft-prelaunch-roadmap.md`**. | 본 §1A.5 D33 (본 행) · `Process/HANDOFF.md` §"다음 할 일" item 9 + §2.2 runbook 표 + §5 SoT · §1A.5 D32(PR-K 별층)·D27(Q5)·D26 Q4(G5 reject 근거)·D30(NO-CONFIG-PASSES) 상속 · §3.10 M12a(G4 범주 분리) |

---

## 2. 화면 IA · 라우트

> **P3.2 확정 (2026-04-15)**. 상세 IA·네비게이션 전환 맵·4여정 Entry Path → `.omc/research/p3-2-information-architecture.md`.

- **라우트 그룹**: `app/(admin)/` 신설. `(admin)/layout.tsx`에 어드민 전용 레이아웃(Header·Sidebar·Footer) + Supabase role 가드 미들웨어. 기존 `(auth)`·`(main)` 그룹과 분리.
- **메인 7 + 서브 3 = 총 10 라우트**:
  - `/admin` — Short List 30 홈 (단기10·중기10·장기10) + 일간 요약 상단 고정. **D23 (53차 §5)**: 30종목 리스트 (`ShortlistRow` accordion `<details>` native). 종목 클릭 → details 펼침 → "풀 리포트" 버튼 → `<Link href="/admin/report/[ticker]">`.
  - `/admin/report/[ticker]` — **풀 리포트 페이지** (Section 0~7 writer 본문 + Section 8 partA/B/C/D Tier 2 sector 14 페르소나 + Appendix). **D23 (53차 §5)**: 30종목 클릭 시 진입하는 단일 산출물. 선정 30 = 풀 리포트 30 (분리되지 않음, lock-in 1.2). 현 코드 상태 = Group H Critical schema drift (section0.conviction early deref 위험, PR3a fix 선행).
  - `/admin/report/[ticker]/regenerate` (D8) — 재생성 확인 + cap 상태 (서브라우트, 구현은 인터셉트 라우트 모달 가능 — B3 결정). **D23 (53차 §5)**: 종목별 'Regen' 버튼 = AI 호출 트리거 (c) path. 현 코드 = UI + quota counter 박제, 실 AI 재생성 호출 0 (PR4 wire).
  - `/admin/portfolio` — AI 비중 제안·현금(D3·D4) + Accept/Reject 승인(D1·D2). **D23 (53차 §5)**: 30종목 리스트 (`ShortlistRow` accordion) + **(PR4 후) trigger 버튼** (사용자 reject 후 새 30 선정 + 새 풀 리포트 = AI 호출 트리거 (b) path) + **종목별 Regen 버튼** (c) path 실 호출. 현 코드 상태 = trigger 버튼 UI 0, server action `triggerMonthlyPersonaEvalAction` dangling (PR4 wire).
  - `/admin/alerts` — 긴급 알림 이력 (Amber/Orange/Dark Purple 심각도)
  - `/admin/alerts/[id]` — 알림 상세 (트리거·심각도·대안 시나리오 + §7 Exit 대조)
  - `/admin/track-record` — **누적 성과 + 월별 리포트 아카이브 한 페이지 탭 분리** (D23 (53차 §5) lock-in 1.5 박제). **탭 1** = 누적 성과 (월간/누적 수익률·Sharpe·alpha + 버킷별·Counterfactual, 현 코드 = 5 summary cards + 월별 + 버킷별 + Counterfactual). **탭 2** = 월별 리포트 아카이브 (과거 월 선정 30 + 풀 리포트 30 리스트 + 클릭 시 `/admin/report/[ticker]?month=YYYY-MM` 또는 모달). **D23 정정 — track-record는 trigger 위치 아님** (Group A mismatch 정정 박제). trigger 버튼 위치 = `/admin/portfolio` 또는 `/admin`.
  - `/admin/decision-tree` (D9) — Y1 Decision Tree 진척도 (CAP Months·alpha·Sharpe 게이지 3종, 단독 화면)
  - `/admin/settings` — 3모드 전환(§1.4) + 상시 모니터링 디폴트 임계치·종목별 on/off(D7)
  - `/admin/settings/notifications` — 텔레그램 + `/admin` 웹 알림 채널 + 온보딩 4-D
- **S8 자동매매 추가 라우트 (2026-04-21 D16, 상세 `Slices/S8-AutoTrading.md`)**:
  - `/admin/settings/brokerage` — KIS(주식) API 키 + 모의↔실계좌 토글 + 복수 앱키·계좌(D12)
  - `/admin/settings/binance` — 바이낸스 선물 API 키 + 테스트넷↔메인넷 토글 + 레버리지 상한
  - `/admin/settings/risk` — 리스크 가드레일(레버리지·일일 손실·AI 일 주문 cap) · 기본값: ≤5x / -3% / ≤20회
  - `/admin/settings/strategy` — Strategy 폴더 파일 목록 + 활성/비활성 토글 + AI 어댑터 embed 상태
  - `/admin/trading/stock` — 주식 수동 주문 폼 + 자동 주문 큐 + 체결·포지션·PnL 로그
  - `/admin/trading/crypto` — 바이낸스 선물 주문 폼 + 레버리지/SL/TP + 포지션·청산가·펀딩 로그
- **Short List 30 홈 구조**: **3 고정 섹션 세로 스택** (단기10 → 중기10 → 장기10). 탭·단일 스크롤 기각 — 30종목 동시 비교·버킷 간 delta 파악이 J1 핵심이므로 섹션 스택으로 확정. 각 섹션 컬럼: 종목명·섹터·**🔢 5-Signal Composite 점수(0~100, Tier 0)**·**🤖 Core 11 페르소나 점수(0~100, Tier 1)**·**합의 배지(🟢/🔵/🟣/🟡/⚪)**·**AI 코멘트 1~2줄**·투심위 미니바·목표가 괴리율·7일 스파크라인·NEW/HOLD/REMOVED 배지. **D19 (2026-05-08, 35차)** 신설 · **49차 Q5b로 🟡 관망 추가하여 5종**: 🔢🤖 이중 점수 + 합의 배지 + AI 코멘트 1~2줄. AI 키 미발급 시 🤖·AI 코멘트는 placeholder, 🔢·합의 배지(⚪)는 동작 → §3.1 R3.1-6 박제.
- **UI 흐름 박제 (D23, 53차 §5 lock-in 1.4)**: 30종목 클릭 시 풀 리포트 진입 흐름을 다음과 같이 박제한다.
  ```
  /admin 홈 또는 /admin/portfolio
    ↓ 30종목 리스트 (ShortlistRow 컴포넌트, <details> accordion native, 코드 SoT = `tudal/src/components/admin/shortlist/shortlist-row.tsx`)
    ↓ 종목 클릭
    ↓ details 펼침 (1~2줄 합의 코멘트 + 🔢🤖 이중 점수 + 합의 배지)
    ↓ "풀 리포트" 버튼 클릭
    ↓ <Link href="/admin/report/[ticker]">
    ↓
  /admin/report/[ticker] (Section 0~7 writer 본문 + Section 8 partA/B/C/D Tier 2 sector 14 페르소나 + Appendix = 단일 산출물)
  ```
  - **선정 30 = 풀 리포트 30** (lock-in 1.2 박제). 선정과 풀 리포트는 분리되지 않으며, 30종목 선정과 동시에 30 풀 리포트가 함께 생성된다.
  - **메인 path (D19 + D23)**: Tier 0 인디케이터·DART numeric narrow → Tier 1 Core 11 AI 평가 + 시간대별 페르소나 가중치 → 30 선정 + Tier 2 sector 14 페르소나 Section 8 plug-in → writer Section 0~7 통합 + Section 8 partA/B/C/D = 30 풀 리포트.
  - **fallback**: AI 키 미발급 시 Tier 0 단독 30 직선정 (**73차 supersede: 더 이상 현 production 아님 — 메인 path 실 AI 30 가동 완료(PR #109, `short_list_30` 2026-06-01); Tier 0 단독은 AI 키 미발급 시에만**). 풀 리포트 = writer Section 0~7 + Section 8 = 30행 완결(74·75차 P2b·P4).
  - **현 코드 상태 = Group H Hard gate ✅ 해소** (D24 §3 박제, 54차 §3 PR3a MERGED `0813a41`): `getReportByTicker` 반환 = `ValidatedStockReport` (zod safeParse per section + nullable typed) + `parseSectionSafe`/`parseReportSection8` onError 콜백(console.warn). page.tsx = `as` 어서션 전면 제거 + 헤더 `section0?.conviction ?? '—'` + `SectionFallback` + Section 8 dual-shape renderer (modern partA~D + legacy conclusion/recommendation/keyQuotes 호환) + `partCToCommitteeAgg` helper. Section 0~7 본문 채워질 PR3b 진입 전까지 fallback UI ("본문 미작성") 렌더로 ship-safe. `silent null drop` log는 PR1 wire 시점에 metric/structured log로 격상 권장 (gsd CR-01 + red-team RT#2 + omxy R7 P2).
- **3모드 전환**: Header 고정 드롭다운(1-tap, 주사용) + `/admin/settings` 상세(온보딩·숙고용). 상태는 Supabase 계정 단위 영속, 어드민 3명 각자 독립.
- **글로벌 레이아웃**: Header(로고·모드 드롭다운·알림 종·아바타) + 좌측 Sidebar(7 라우트, `/admin/report/*`는 종목 클릭 전용) + Footer(면책 문구 고정, BusinessPlan §7).
- **모바일 대응**: 현 범위는 **데스크톱 전용**. 모바일 반응형(사이드바 → 바텀 탭바, 리포트 Sticky Tab 전환)은 **별도 나중 트랙**(어드민 내부 운용 안정화 이후 검토). 단, 텔레그램·`/admin` 알림 딥링크는 지금부터 동작 — **P7.3 권장(⑧)**: `/admin/alerts/[id]`와 `/admin/report/[ticker]` Section 0만 CSS 단일 컬럼 스택(`<768px`)으로 최소 readable 제공. 풀 모바일 UI는 추후.
- **화면 플로우 다이어그램**: P7.1 완료 (2026-04-15). 파일: `.omc/design/flows/admin-flows.md`.
  - 다이어그램 1: J1 월간 선정 플로우 (AI 스크리닝 → Short List 30 → 리포트 열람 → Accept/Reject → 트래킹 시작. Reject 재분석 1회·전월 유지·D+5 미승인 분기 포함)
  - 다이어그램 2: J2 일간 모니터링 플로우 (모닝 브리핑 → 대시보드 스캔 → 주의 종목 드릴다운 → 설정 조정)
  - 다이어그램 3: J3 Exit 타이밍 플로우 (AI 악재 감지 → 심각도 분류 → 텔레그램 + `/admin` 웹 알림 → 알림 상세 → 매도 결정 기록)
  - 다이어그램 4: J4 성과 추적 플로우 (일간 스냅샷 → 월간 집계 → 트랙 레코드 → Decision Tree 진척도)
  - 다이어그램 5: 3모드 상태 전환 다이어그램 (모닝 대시보드 ↔ 상시 모니터링 ↔ 월간 리밸런싱. Header 드롭다운 + Settings 전환 경로·영속성 표기)
  - ~~미해결 3건~~ → **P7.3 권장안 확정**: ⑥ 종목 내비 = **버킷 내(10종목) 디폴트** + 경계 표시("단기 10 끝. 다음: 중기 10 첫 번째"), ⑦ Decision Tree 부분 표시 = **N/12 부분 게이지 + 월별 차트 점선 투영**, ⑧ 모바일 딥링크 = alerts/[id] + report Section 0 최소 readable CSS
- **P7.3 IA 검증 결과** (2026-04-15): BLOCK 0 / FLAG 3 / Suggestion 3. 상세: `.omc/design/ia-verification.md`.
  - FLAG-1: `/admin/track-record` 와이어프레임 누락 → P8.3 목업 시 보완
  - FLAG-2: track-record ↔ decision-tree 핑퐁 네비 → track-record에서 decision-tree 단방향 링크만 유지 권장
  - FLAG-3: 일간 요약바에 "마지막 갱신 시각" 누락 → 추가 권장 ("갱신: 2026-04-14 16:00 장마감 배치")

---

## 3. 기능 스펙

> **P4.1 본문화 완료 (2026-04-15)** — **v1.1 기준 Must 19 / Should 17 / Nice 6 / Deferred 7**. §3.1~§3.5는 P3.0 결정 D1~D9 박제 + 정식 요구사항 보강. §3.7~§3.11은 Must 기능 AC 힌트 → 정식 요구사항 승격 + Should/Nice 확장 후보 서브섹션 추가. **§3.12는 v1.1 신설** — D14 Must 승격 3건(M17·M18·M19 시스템 관측·가드레일). 미해결 5건은 각 해당 섹션에 결정 또는 Build 이관 명시. 원자료: `.omc/research/p3-1-feature-prioritization.md`.

### §3.1 분석엔진 출력 (D5)

> **→ 전략 배경**: §1A.1 Product Vision · §1A.2 UA2 Quant Early Warning 참조.

어드민 UI에 표시되는 분석엔진 산출물. P3.0 결정 D5 박제.

**기능 설명**: 백테스트 v6 기반 5-Signal Composite 점수와 3축 분석 결과를 어드민 대시보드에 가시화한다. 어드민이 Short List 30 종목의 선정 근거와 리스크 상태를 수치로 확인할 수 있게 하여 "AI 블랙박스" 불신을 방지한다.

**핵심 요구사항**:
- R3.1-1: 종목 카드마다 5-Signal Composite 점수(0~100 정수)를 표시한다. 점수 산출 기준은 quant-data-architecture.md EarlyWarning 5-Signal 가중치 그대로 적용.
- R3.1-2: 추세(MA 구조) · 모멘텀(RSI/MACD) · 변동성(BB 폭/ATR) 3축 점수를 Composite와 별도로 각각 표시한다. 각 축은 점수 숫자 + 방향 지표(▲/▼/─)를 함께 노출.
- R3.1-3: 각 신호 트리거에 대응하는 단문 라벨("MA 이탈", "RSI 과열", "BB 상단 돌파" 등)을 1줄 이내로 표시한다.
- R3.1-4: Crisis Layer가 발동된 종목은 경고 플래그(배지)를 표시한다. Crisis 임계치는 quant-data-architecture.md CrisisLayer 기준(일일 수익률 < −6% 또는 5일 연속 하락 등) 적용.
- R3.1-5: 모든 분석엔진 출력은 EOD 배치 기준으로 갱신된다(상시 모니터링 모드에서는 장중 스트림 추가, §3.5 참조). 추가 지표 확장(업황 사이클·섹터 로테이션 등)은 어드민 운용 안정화 이후 재검토.
- R3.1-6 **(D19, 2026-05-08 35차 · 49차 Q5b 5종 배지 박제)**: 종목 카드에 **🔢 숫자 점수**(0~100, Tier 0 = 5-Signal Composite × 시간대별 가중치)와 **🤖 AI 점수**(0~100, Tier 1 = Core 11 페르소나 합산) **이중 배지**를 노출한다. 두 점수의 비교 결과는 **5종 합의 배지**로 시각화: 🟢 **강한 합의** (둘 다 상위, 우선 노출) · 🔵 **숫자 우세** (모멘텀 강하나 정성 우려) · 🟣 **AI 우세** (정성 좋으나 차트 약함) · 🟡 **관망** (둘 다 비-top tier, 시기 미상 — Q5b 49차 omxy CONVERGED) · ⚪ **AI 분석 대기** (AI 키 미발급 placeholder). 각 카드에 **AI 코멘트 1~2줄**(Core 11 합의 핵심 논거 발췌, 있을 시 표시 / 없을 시 "AI 분석 대기 중" placeholder). 카드 클릭 → 풀 리포트 Section 0~8(`ReportFramework.md §8` Step 1~4 산출물). **AI 키 미발급 fallback**: 🤖·AI 코멘트는 placeholder, 🔢·합의 배지는 ⚪로 동작. 진짜 코스피·코스닥 30종목 + 실 가격·재무·뉴스는 그대로 노출. 코드 SoT: `tudal/src/lib/screening/consensus.ts` (5종 type union + `assignBadge` 5분기). 박제: D19 + `Service/Report/ReportFramework.md §8` Step 0. **65차 Q4·Q3 supersede**: 🤖 AI 점수 = Core 11 병렬 독립 채점 합산 → 멀티라운드 실시간 반박 토론 결과 점수로 확장(합의 점수는 선택). ⚪ 'AI 키 미발급' 어휘 = Anthropic 단독 키 가정 잔재; 65차 Q3 멀티프로바이더(Claude+GPT)·provider auto-detect로 'AI 키 없음 = Claude-only' 의미 변경. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조) **77차 D30 supersede (검증 게이트)**: 🔢 Tier 0 5-Signal z정규화는 예측력 미검증 + 구조적 retrieval 실패(실증: 대형 주도주 10/11 누락) → **"B++ (size-sleeve recall-first) + recall/IC/size 삼중 게이트" 채택**(B+ 단독 REJECT, 구현 다음 세션, SoT spec `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md` + §1A.5 D30). **삼중 게이트 통과 전까지 🔢 점수·후보 150을 "향후 상승 예측"으로 제시 금지** — "robust, factor-informed, leader-inclusive candidate shortlist"까지만.

**확장 후보 (Should/Nice)**:
- S7 Crisis Layer 상세 패널: Composite 점수 분해(5-Signal 각 기여도 바차트) + Crisis 발동 이력. M4 위 세부 레이어. → BuildPhase B3.2 이후 추가 가능.
- S5 백테스트 결과 뷰어: 6종 백테스트 결과를 어드민이 열람할 수 있는 별도 뷰. UA2 Early Warning 근거 가시화. → S5 구현은 P3.1 Should 분류, B3 단계.
- S6 매크로 컨텍스트 축소판: 모닝 브리핑(M11)에 KOSPI/금리/환율 미니 차트 삽입. → §3.10 M11 확장 시 연동.


#### User Story & AC — M4 5-Signal Composite + 3축 분석엔진 출력
- **Story**: 어드민으로서, 종목 선정의 AI 근거를 수치로 확인하기 위해, 5-Signal Composite 점수와 추세·모멘텀·변동성 3축 결과가 종목 카드에 표시되는 기능을 원한다.
- **AC**:
  - [ ] 각 종목 카드에 Composite 점수(0~100)와 3축(추세·모멘텀·변동성) 점수가 방향 지표(▲/▼/─)와 함께 표시된다.
  - [ ] Crisis Layer 발동 종목에는 경고 배지가 표시되고, 신호 트리거 단문 라벨("MA 이탈" 등)이 1줄 이내로 노출된다.
  - [ ] 모든 출력은 EOD 배치 기준으로 갱신된다(상시 모니터링 모드에서는 장중 스트림 추가).
#### DoD (Definition of Done) — M4 5-Signal Composite + 3축 분석엔진 출력
- [ ] 각 종목 카드에 Composite 점수(0~100)와 추세·모멘텀·변동성 3축 점수가 방향 지표(▲/▼/─)와 함께 표시된다.
- [ ] Crisis Layer 발동 종목에 경고 배지가 표시되고, 신호 트리거 단문 라벨("MA 이탈" 등)이 1줄 이내로 노출된다.
- [ ] 모든 분석엔진 출력이 EOD 배치 기준으로 갱신된다.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.2 Short List 30 산출 로직 (D6)

> **→ 전략 배경**: §1.2 Core JTBD · §1A.2 UA1·UA2 참조. 🔴 Must 고정 — Should/Nice 강등 금지.

**기능 설명**: AI 분석엔진이 전종목 스크리닝을 수행하여 (선정주기 = 단기 주1회 · 중장기 월1회, 65차 Q1 — HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조) 단기10·중기10·장기10으로 구성된 Short List 30을 생성한다. 이것이 어드민 홈의 유일한 진입점이며, NSM(CAP Months) 트리거 이벤트(`shortlist.generated`)의 시작점이다.

**핵심 요구사항**:
- R3.2-1: 홈 화면(`/admin`)은 Short List 30을 단기 10 · 중기 10 · 장기 10으로 구분하여 3 고정 섹션 세로 스택으로 반드시 표시한다. 종목 수(30) 및 버킷 분배(10/10/10) 변경 불가. D6 Must 고정.
- R3.2-2: 각 종목 행에는 종목명(티커) · 섹터 · 5-Signal Composite 점수 · 투심위 분포 미니바 · 목표가 괴리율 · 7일 스파크라인 · NEW/HOLD/REMOVED 배지를 표시한다.
- R3.2-3: 30종목 미달 시(스크리닝 결과 부족) 명시적 경고("Short List 생성 불완전 — N종목 생성됨")를 홈 상단에 표시하고 이전 달 Short List를 유지한다.
- R3.2-4: 분석 로직은 §3.1 5-Signal Composite·3축 인디케이터와 AI 투심위(Core 11 + Sector Board canonical 14 sectors × 14 personas overlay, `ReportFramework.md`) 판단 기준 + 리포트 워딩(Section 0~8)을 결합한 분석엔진 전체를 사용한다. 같은 로직이 30종목 전부에 적용된다. **D21 (52차)**: 슬롯 모델은 10 base + 2 primary overlay + 2 sub_tag overlay = canonical 14 fixed. **65차 Q4**: AI 투심위 판단 = Core 11 병렬 독립 채점에서 멀티라운드 실시간 반박 토론 loop로 확장. **65차 Q1**: 30 동시선정 → 단기 주간/중장기 월간 분리. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조 — 토론 loop·선정 알고리즘 재작성은 W0~W3 구현 위임)
- R3.2-5: 백테스트 검증은 6종목에서 시작하여 같은 알고리즘으로 점진 확장한다. 백테스트 범위 축소가 Short List 30 노출 구조 축소로 이어지지 않는다.

**미달 상태 정책 (P5 I-04 박제)**:
- (a) **원인 분리**: 30종목 미달의 원인을 (i) 스크리닝 결과 부족(품질 문제) vs (ii) 데이터 장애(파이프라인 실패)로 명시적으로 분리 기록한다. 홈 배너·운영 로그에 원인 구분 표시.
- (b) **미달 월의 CAP Months 포함 여부 = 포함**: 전월 포트 유지로 운용 연속성이 유지되므로 해당 월도 CAP Months 카운트에 포함한다. (Reject 2차 후 전월 유지는 D1에 따라 미포함과 별개)
- (c) **3개월 연속 미달 시 Anti-Metric 트리거로 승격**: 분석엔진·파이프라인 구조적 문제 신호로 간주하고 투심위 품질·데이터 소스 전면 재검토.
- (d) **65차 Q2 주의**: AI 자율 포트구성 후에는 '편입 N<30'이 정상(AI가 운용개수 자율결정). 따라서 'N종목 = 미달=불완전' 판정 로직은 (i) 스크리닝 후보 부족 vs (ii) AI 자율 비편입을 구분해야 함. AI가 의도적으로 N<30을 선택한 경우는 미달 경고/Anti-Metric 트리거 대상 아님. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)

**확장 후보 (Should/Nice)**:
- S12 Short List 후보군 31~50위 뷰: 박소연 페르소나 "왜 이 종목이 탈락했나" 검증 욕구 충족. 풀 리포트는 30종목에만 제공. → Should, B3 단계.
- S5 백테스트 결과 뷰어: 6종 알고리즘 성과를 어드민이 열람. D6 "백테스트 trace" 가시화. → Should, B3 단계.


#### User Story & AC — M1 Short List 30 홈 표시
- **Story**: 어드민으로서, 이번 달 투자 대상을 한눈에 파악하기 위해, 단기·중기·장기 각 10종목이 종목명·현재가·수익률·상태와 함께 홈 화면에 표시되는 기능을 원한다.
- **AC**:
  - [ ] `/admin` 진입 시 단기 10 · 중기 10 · 장기 10의 3섹션 세로 스택이 렌더되고, 각 행에 종목명(티커)·Composite 점수·목표가 괴리율·NEW/HOLD/REMOVED 배지가 표시된다.
  - [ ] 30종목 미달 시 "Short List 생성 불완전 — N종목 생성됨" 경고가 홈 상단에 표시된다.
#### DoD (Definition of Done) — M1 Short List 30 홈 표시
- [ ] `/admin` 진입 시 단기 10 · 중기 10 · 장기 10의 3섹션 세로 스택이 렌더되고, 각 행에 종목명(티커)·Composite 점수·목표가 괴리율·NEW/HOLD/REMOVED 배지가 표시된다.
- [ ] 30종목 미달 시 "Short List 생성 불완전 — N종목 생성됨" 경고가 홈 상단에 표시되고 이전 달 Short List가 유지된다.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.3 승인 워크플로우 (D1·D2)

> **→ 전략 배경**: §1.3 J1 월간 선정 · §1A.3 NSM(CAP Months) 트리거 참조.

> **본 워크플로우는 AI 가상 포트 확정용**. 실제 체결 3경로(매뉴얼·자동매매·외부 바이패스)는 §1A.0 참조. D11 박제.

**기능 설명**: 매월 Short List 30 생성 후 어드민이 AI 비중 제안을 Accept 또는 Reject하는 워크플로우다. 어드민 3명 중 먼저 승인한 1인이 확정권을 가진다(선착순). 이 이벤트가 NSM 카운트의 트리거이며, 가상 포트폴리오 트래킹의 시작점이다.

> **65차 Q1+Q2 supersede**: (Q1) '매월' 단일 승인 사이클 → 단기 주간/중장기 월간 두 승인 사이클로 분리. (Q2) 'AI 비중 제안 Accept/Reject' → 'AI 자율 구성 포트(편입 N·종목·단중장분배·비중·현금) Accept/Reject'. '전체 Accept/전체 Reject' 버튼 의미는 AI 자율 포트 전체 승인/거부로 유지. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)

**핵심 요구사항**:
- R3.3-1: `/admin/portfolio` 화면에 전체 Accept 버튼과 전체 Reject 버튼을 제공한다. 승인 시 확인 모달을 표시하고, 확인 후 `portfolio.approved` 이벤트(month · admin_id · timestamp · approval_type)를 기록한다. 이 타임스탬프가 승인가(종가) 기준이 된다.
- R3.3-2: 어드민 3명 중 1인이 Accept를 완료하면 즉시 "승인 완료" 상태로 잠기고, 나머지 어드민에게는 "이미 승인됨(승인자·시각 표시)" 배너를 보여준다. 이후 Accept/Reject 버튼은 비활성화된다. **미해결 ①(멀티어드민 race) 해소**: 선착순 단일 확정으로 UI 단순화. 동시 클릭 race condition 처리(낙관적 락 또는 DB 유니크 제약)는 → BuildPhase B3 이관.
- R3.3-3: Reject 시 AI 자동 재분석 1회를 큐에 등록하고, 어드민에게 "재분석 중" 상태를 표시한다. 재분석 완료 후 새 Short List로 포트폴리오 화면을 갱신하고 텔레그램 알림을 발송한다.
- R3.3-4: 재분석본도 Reject되면 "전월 포트폴리오 유지" 배너를 표시하고 해당 월은 CAP Months에 미포함 처리한다.
- R3.3-5: Short List 생성일로부터 D+5 영업일 내 미승인 시 자동으로 "전월 포트 유지" 처리하고, 어드민 3인에게 텔레그램 경고를 발송한다. 홈 화면에 "승인 마감 D-N일" 카운터를 상시 표시한다.
- **R3.3-7 (D15, v1.1): 승인 Holding Period 24시간**. Short List 생성 후 `shortlist.generated_at + 24h` 이전 Accept 시도는 "숙고 기간 중 — 24시간 경과 후 Accept 가능" 메시지와 함께 차단한다. Accept 버튼은 Holding 기간 동안 disabled 상태.
- **R3.3-8 (D15, v1.1 · S2 G-5 B 보정): 2인 풀 리포트 열람 게이팅**. 어드민 3인 중 **최소 2인이 풀 리포트를 Section 0 이상 열람**(`report.view` 이벤트 발생) 한 경우에만 Accept 버튼 활성화. 판정 로직: `SELECT COUNT(DISTINCT admin_id) FROM report_view_log WHERE report_id = ? >= 2` (E10 ReportViewLog, 2026-04-17 S2 [G-5] 옵션 B 해소). 열람 카운터는 `/admin/portfolio` 화면에 "현재 N/2명 열람 완료" 형태로 노출한다. 게이트가 false이면 버튼 disabled + 미열람 어드민 안내 표시.
- **R3.3-9 (D15, v1.1): 연휴 우회 조항**. 24h Holding이 장기 연휴로 인해 D+5 영업일(R3.3-5) 상한을 침범할 경우 **24h 또는 D+4 영업일 중 짧은 쪽**을 적용한다. D+5 마감을 침범하지 않는 범위에서 Holding 단축.
- **R3.3-10 (D15, v1.1): 이의 제기 48h 추가 Hold**. 어드민 B 또는 C가 "이의 제기" 버튼을 통해 공식 이의를 등록하면 **추가 48h Hold**가 발동한다. `dispute_raised_at`부터 48h 경과 또는 이의 제기자의 "이의 해결" 액션 중 먼저 발생하는 시점에 Hold 해제 → Accept 버튼 재활성화. 연휴 우회(R3.3-9)는 이의 48h에도 동일하게 적용.

**확장 후보 (Should/Nice)**:
- S10 포트폴리오 Override 도구: 박소연 페르소나가 AI 제안 비중을 종목 단위로 조정(전체 Accept/Reject 외 중간 선택지). Anti-Metric "오버라이드 > 50%" 측정 메커니즘 연동. → Should, MVP 이후 Stage 1.5.
- S11 What-if 시뮬레이터: Override 후 예상 포트폴리오 수익률 시뮬. → Should, S10 구현 후.


#### User Story & AC — M7 승인 워크플로우
- **Story**: 어드민으로서, 이번 달 포트폴리오를 확정하기 위해, AI 비중 제안을 Accept 또는 Reject하고 결과가 즉시 가상 포트폴리오에 반영되는 승인 워크플로우를 원한다.
- **AC**:
  - [ ] `/admin/portfolio`에서 Accept 클릭 → 확인 모달 → 확인 후 `portfolio.approved` 이벤트가 기록되고, 나머지 어드민에게 "이미 승인됨" 배너가 표시된다.
  - [ ] Reject 시 AI 재분석이 1회 큐에 등록되고 "재분석 중" 상태가 표시된다. 재분석본도 Reject되면 "전월 포트 유지" 배너가 표시된다.
  - [ ] D+5 영업일 카운터가 홈 화면에 상시 표시되고, 기한 내 미승인 시 어드민 3인에게 텔레그램 경고가 발송된다.
  - [ ] **(D15)** Short List 생성 후 24h 경과 이전에는 Accept 버튼이 disabled이며, 시도 시 "숙고 기간 중" 메시지가 표시된다.
  - [ ] **(D15)** 어드민 2인 이상 풀 리포트 열람(`report.view` 기록) 이전에는 Accept 버튼이 disabled이며, "현재 N/2명 열람 완료" 카운터가 `/admin/portfolio`에 표시된다.
  - [ ] **(D15)** 어드민 B·C 이의 제기 시 추가 48h Hold가 발동하여 Accept 버튼이 다시 disabled된다. 48h 경과 또는 이의 해결 후 재활성화된다.
#### DoD (Definition of Done) — M7 승인 워크플로우
- [ ] `/admin/portfolio`에서 Accept 클릭 → 확인 모달 → 확인 후 `portfolio.approved` 이벤트가 기록되고, 나머지 어드민에게 "이미 승인됨(승인자·시각)" 배너가 표시되며 Accept/Reject 버튼이 비활성화된다.
- [ ] Reject 시 AI 재분석이 1회 큐에 등록되고 "재분석 중" 상태가 표시된다. 재분석본도 Reject되면 "전월 포트 유지" 배너가 표시된다.
- [ ] D+5 영업일 카운터가 홈 화면에 상시 표시되고, 기한 내 미승인 시 어드민 3인에게 텔레그램 경고가 발송된다.
- [ ] **(D15 R3.3-7) 24h Hold가 정상 동작**: `shortlist.generated_at + 24h` 이전 Accept 시도 차단 + 안내 메시지. 연휴로 D+4 영업일이 24h보다 짧으면 짧은 쪽 적용(R3.3-9).
- [ ] **(D15 R3.3-8) 2인 열람 게이팅 false 시 버튼 disabled**: `report.view` 기록이 2인 미만이면 Accept 버튼 disabled 상태 유지 + "N/2명 열람 완료" 카운터 노출.
- [ ] **(D15 R3.3-10) 이의 제기 시 48h 연장**: `dispute_raised_at` 기록 후 48h 경과 또는 이의 해결 시점 중 먼저 도래하는 시점에 Accept 활성 복귀.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.4 가상 포트폴리오 트래킹 (D3·D4·D8)

> **→ 전략 배경**: §1.3 J4 성과 추적 · §1A.3 IM-5 누적 Alpha · §1A.4 Anti-Metrics 참조.

**기능 설명**: 승인 완료 시점부터 가상 포트폴리오를 생성하고, 일별 수익률·Sharpe·KOSPI 대비 alpha를 트래킹한다. 트랙 레코드 12개월 누적이 Core JTBD(J4)의 최종 산출물이며, Y1 Decision Tree(BusinessPlan §Q4)의 판단 입력값이다. 재생성 cap은 Anti-Metric "AI API 월 50만원"(65차 hardcap 40만→50만 정정) 초과를 방지한다.

**핵심 요구사항**:
- R3.4-1: 승인 확정 시점의 당일 종가를 모든 종목의 매수가(승인가)로 기록한다. 슬리피지·수수료 0%, 100% 일괄 매수 가정 (단순 모델).
- R3.4-2: AI가 제안한 현금 비율(0~30%)만큼 총 자산에서 매수를 제외하고, 현금 항목을 별도 행으로 포트폴리오에 표시한다. 현금 부분은 수익률·alpha 계산에서 제외하여 별도 추적한다. (65차 Q2: 현금 0~30%는 보존하되, 비중·편입개수도 AI 자율 결정. HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)
- R3.4-3: 매일 장 마감 후 `portfolio.daily_snapshot`(date · total_return · kospi_return · alpha · sharpe)을 적재한다. `/admin/track-record` 화면은 이 데이터를 기반으로 월간/누적/버킷별 성과를 표시한다.
- R3.4-4: 종목당 월간 재생성 카운터를 관리한다. Reject 시 자동 재분석 0/1회, 어드민 수동 재생성 0/2회를 별도 카운트한다. 수동 재생성 버튼에 "이번 달 N/2회 남음" 라벨을 표시하고, 한도 소진 시 버튼을 비활성화하고 "이번 달 재생성 한도 소진" 툴팁을 표시한다. 카운터는 매월 1일 00:00 KST 리셋. (65차 Q1: 선정주기 분리 시 단기 종목 재생성 카운터는 주간 주기에 맞춰 별도 리셋 검토 — 월간/주간 카운터 분리 여부는 W2 구현 시 확정. HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)
- R3.4-5: 재생성 확인 플로우: "리포트 재생성" 버튼 클릭 → `/admin/report/[ticker]/regenerate` 진입(확인 화면 또는 인터셉트 모달) → 확인 → "재생성 중" 스피너 → 완료 후 리포트 갱신. **미해결 ④(regenerate 서브라우트 vs 인터셉트 모달) 해소**: 서비스 기획 수준에서 두 방식 모두 허용 — 구현 방식은 → BuildPhase B3 이관. 기능 요구사항은 "확인 단계 필수 + cap 상태 표시"로 고정.

**확장 후보 (Should/Nice)**:
- S3 리포트 버전 히스토리: 이전 월 리포트와 현재 비교. 트랙 레코드 감사 가능성. → Should, B3 단계.
- S4 리포트 PDF/HTML export: 이준호 페르소나 "투심위 자료" 활용. Y1 법적 등록 근거 문서화. → Should, B3 단계.
- N2 Drawdown 분석(MDD·회복기간): M16 Decision Tree에 핵심 수치만 흡수. 상세는 12개월 데이터 누적 후 의미. → Nice, Y2.


#### User Story & AC — M8 가상 포트폴리오 트래킹 엔진
- **Story**: 어드민으로서, 15억 운용 성과를 객관적으로 측정하기 위해, 승인 시점 종가 기준으로 가상 포트폴리오 수익률·alpha·Sharpe를 자동 트래킹하는 기능을 원한다.
- **AC**:
  - [ ] 승인 확정 시 당일 종가로 전 종목 매수가가 기록되고, 슬리피지·수수료 0% 가정 하에 `PortfolioSnapshot`이 생성된다.
  - [ ] 매일 장 마감 후 `portfolio.daily_snapshot`이 자동 적재되고, `/admin/track-record`에 누적 수익률·alpha·Sharpe가 표시된다.
#### DoD (Definition of Done) — M8 가상 포트폴리오 트래킹 엔진
- [ ] 승인 확정 시 당일 종가로 전 종목 매수가가 기록되고, 슬리피지·수수료 0% 가정 하에 `PortfolioSnapshot`이 생성된다.
- [ ] AI 제안 현금 비율(0~30%)만큼 매수를 제외한 현금 항목이 별도 행으로 포트폴리오에 표시된다.
- [ ] 매일 장 마감 후 `portfolio.daily_snapshot`이 자동 적재되고, `/admin/track-record`에 누적 수익률·alpha·Sharpe가 표시된다.
- [ ] `npm run build` + `npm run lint` 통과.

#### User Story & AC — M9 리포트 재생성 cap 가드
- **Story**: 어드민으로서, AI API 비용 폭주를 막기 위해, 종목당 월간 재생성 횟수를 자동으로 제한하는 기능을 원한다.
- **AC**:
  - [ ] 수동 재생성 버튼에 "이번 달 N/2회 남음" 라벨이 표시되고, 한도 소진 시 버튼이 비활성화되며 "재생성 한도 소진" 툴팁이 표시된다.
  - [ ] 카운터는 매월 1일 00:00 KST에 자동 리셋된다.
#### DoD (Definition of Done) — M9 리포트 재생성 cap 가드
- [ ] 수동 재생성 버튼에 "이번 달 N/2회 남음" 라벨이 표시되고, 한도 소진 시 버튼이 비활성화되며 "재생성 한도 소진" 툴팁이 표시된다.
- [ ] 재생성 확인 플로우(버튼 → 확인 단계 → 스피너 → 완료 갱신)가 작동한다.
- [ ] 카운터는 매월 1일 00:00 KST에 자동 리셋된다.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.5 상시 모니터링 모드 MVP (D7)

> **→ 전략 배경**: §1.4 사용 모드 · §1.3 J3 Exit 타이밍 참조. D7 Must 박제.

**기능 설명**: 어드민이 "상시 모니터링" 모드를 선택하면 보유 종목의 장중 실시간 스트림이 활성화되고, 디폴트 임계치 3종 중 하나라도 발동 시 즉시 알림을 발송한다. 종목별 on/off 토글로 알림 피로를 조절한다. 세밀한 임계치 커스텀은 Phase 2 범위.

**핵심 요구사항**:
- R3.5-1: "상시 모니터링" 모드 활성 시 보유 30종목의 장중 가격 데이터를 실시간 스트림(한투 API, ADR-1 참조)으로 수신한다. 모드 비활성 시 EOD 배치 전환. **구현 대안 (P5 I-10)**: 한투 API WebSocket 실시간 스트림이 인프라 부담 시 **1분 폴링 방식으로 대체 허용**. 실시간/폴링 선택은 BuildPhase B3.2에서 실측 후 결정.
- R3.5-2: 디폴트 임계치 3종을 제공한다 — ①급등락 감지(±5% 또는 거래량 3배, §3.10 M13의 수치 기준), ②뉴스 악재 감지(§3.10 M12a 자동제외/검토 판정), ③목표가 근접 감지(목표가 대비 괴리율 ≤ 5%). 구체 수치는 → BuildPhase B3 확정.
- R3.5-3: `/admin/settings` 화면에서 디폴트 임계치 3종 각각의 ON/OFF 토글과, Short List 30 종목별 모니터링 ON/OFF 토글을 제공한다. 기본값은 전체 ON.
- R3.5-4: 임계치 발동 시 텔레그램 즉시 알림 + `/admin` 홈 상단 배지(읽지 않은 알림 수)를 동시에 트리거한다. 알림은 `/admin/alerts`에 이력 저장.
- R3.5-5: J3 Exit 시그널 긴급 알림(§3.10 M15)은 모드 설정과 무관하게 모든 모드에서 항상 즉시 발송한다.

**확장 후보 (Should/Nice)**:
- 세밀 임계치 커스텀 UI(종목별 ±% 직접 입력): Phase 2 로드맵. D7에서 명시적 제외.
- S9 매크로 이슈 캘린더: FOMC·CPI 등 일정이 임계치 발동 컨텍스트로 연동. → Should, B3 단계.
- S16 홀딩 기간 초과 경보: 단기/중기/장기 버킷별 홀딩 기간 초과 시 알림. 이준호 페르소나 "단기 어정쩡" 통점. → Should.


#### User Story & AC — M13 장중 이상 감지 알림 (상시 모니터링 모드 설정)
- **Story**: 어드민으로서, 알림 피로 없이 중요한 장중 변동만 받기 위해, 종목별 모니터링 on/off와 디폴트 임계치 설정을 관리하는 기능을 원한다.
- **AC**:
  - [ ] `/admin/settings`에서 디폴트 임계치 3종(급등락·뉴스 악재·목표가 근접) 각각의 ON/OFF 토글과 종목별 ON/OFF 토글이 제공되고, 기본값은 전체 ON이다.
  - [ ] J3 Exit 시그널 긴급 알림은 모드 설정·종목 토글과 무관하게 항상 즉시 발송된다.
#### DoD (Definition of Done) — M13 상시 모니터링 모드 설정
- [ ] `/admin/settings`에서 디폴트 임계치 3종(급등락·뉴스 악재·목표가 근접) 각각의 ON/OFF 토글과 종목별 ON/OFF 토글이 제공되며 기본값은 전체 ON이다.
- [ ] J3 Exit 시그널 긴급 알림은 모드 설정·종목 토글 상태와 무관하게 항상 즉시 발송된다.
- [ ] `npm run build` + `npm run lint` 통과.

#### User Story & AC — M14 종목별 커스텀 임계치 on/off
- **Story**: 어드민으로서, 변동성이 낮은 종목의 불필요한 알림을 끄기 위해, Short List 30 각 종목의 모니터링 알림을 개별적으로 on/off하는 기능을 원한다.
- **AC**:
  - [ ] `/admin/settings` 종목 목록에서 각 종목의 알림 토글을 on/off할 수 있고, 변경 사항이 즉시 저장된다.
  - [ ] OFF 상태 종목은 임계치 발동 시에도 텔레그램 알림·홈 배지가 발송되지 않는다.
#### DoD (Definition of Done) — M14 종목별 커스텀 임계치 on/off
- [ ] `/admin/settings` 종목 목록에서 각 종목의 알림 토글을 on/off할 수 있고, 변경 사항이 즉시 저장된다.
- [ ] OFF 상태 종목은 임계치 발동 시에도 텔레그램 알림·홈 배지가 발송되지 않는다.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.6 미분류 기능 후보 → P3.1에서 해소 ✅

P3.1 `prioritize-features` 완료 (2026-04-15). 49개 후보 + §3.6 미분류 항목 통합 결과 P3.1 시점 **Must 16 / Should 17 / Nice 6 / Deferred 10** → **v1.1 D14 반영 후 Must 19 / Should 17 / Nice 6 / Deferred 7** (D-OOS-6·D-OOS-7·Silent Health Must 승격). 상세 매트릭스·근거 → `.omc/research/p3-1-feature-prioritization.md`. 아래 §3.7~§3.11이 P3.1 원 Must 기능 박제 영역이며, **§3.12가 v1.1 신설 Must 3건(M17·M18·M19) 박제 영역**. Should/Nice는 각 §3.X 하단 "확장 후보" 서브섹션으로 재구조(P4에서 본문화).

원 미분류 항목 → 흡수 위치:
- Top30 월배치 선정 → §3.2 D6 Must 고정
- 풀 리포트 렌더링 → **§3.7 M2**
- 뉴스 악재 감지 → **§3.10 M12a**
- 긴급 알림 채널 → **§3.10 M15** (텔레그램 + `/admin` 웹 알림, BusinessPlan §10.6)
- 포트폴리오 재조정 제안 (악재 발생 시) → **§3.10 M15** 대안 시나리오
- 과거 Short List·리포트 이력 열람 → Should(S3 리포트 버전 히스토리), P4에서 본문화
- Y1 Decision Tree 대시보드 (D9) → **§3.11 M16**

---

### §3.7 풀 리포트 + 투심위 가시화 (J1 · Must M2·M3)

> **→ 전략 배경**: §1.3 J1 · §1A.2 UA1 투심위 2-Layer 투명성 참조.

**기능 설명**: 어드민이 종목 카드를 클릭하면 `/admin/report/[ticker]`로 진입하여 Section 0~8 + Appendix 구조의 풀 리포트를 열람한다. AI 투심위의 찬반 논거가 Section 8에 집약 표시되어 "왜 이 종목이 선정됐는가"의 투명성을 제공한다. 박소연 페르소나의 검증 욕구를 충족시키는 핵심 화면. **미해결 ②(리포트 상세도) 해소**: §3.7 정식 요구사항으로 수준 확정(아래 R3.7-2 참조).

**M2 핵심 요구사항 — 풀 리포트 렌더링**:
- R3.7-1: `/admin/report/[ticker]`는 Section 0~8을 좌측 Sticky Side Nav(섹션 앵커) + 우측 단일 스크롤 레이아웃으로 렌더링한다. Section 0(투자 요약 + Conviction 게이지 + 투심위 미니바)은 디폴트 펼침 상태.
- R3.7-2: 각 섹션은 **접기·펼치기(accordion)**를 기본으로 제공한다. Section 0는 디폴트 펼침, 나머지 섹션은 디폴트 접힘. **미해결 ② 확정**: 정적 텍스트 + 접기·펼치기 수준으로 MVP를 고정. 인터랙티브 차트(MA·볼린저 등)는 §6 모멘텀 섹션에 한해 포함(§3.1 분석엔진 출력 위치). 완전 인터랙티브 페르소나 탐색은 Should(S2) 범위.
- R3.7-3: 리포트 열람 시 `report.view` 이벤트(ticker · section · admin_id · timestamp · duration_sec)를 기록한다. IM-1(리포트 소비율) 측정의 유일한 데이터 소스.
- R3.7-4: 이전/다음 종목 내비게이션을 리포트 하단에 제공한다. 탐색 범위는 해당 버킷(단기/중기/장기) 내 순서 기준. 버킷 간 이동은 홈으로 복귀 후 재진입. _(범위 최종 확정은 P7.1)_
- R3.7-5: Sticky Side Nav 상단에 "← Short List" 링크를 제공하여 `/admin` 홈 복귀 시 스크롤 위치를 복원한다.

**M3 핵심 요구사항 — 투심위 투표 요약 패널**:
- R3.7-6: Section 8에 투심위 투표 요약 패널을 표시한다. Core 11 위원 찬/반/기권 카운트 + 해당 섹터 Board 위원(Sector Board canonical 14 sectors × 14 personas overlay 중 해당 섹터의 14인) 찬/반/기권 카운트를 각각 집계한다. **D21 (52차)**: 14 = 10 base + 2 primary + 2 sub_tag overlay.
- R3.7-7 **(D20, 2026-05-12 45차 보강)**: Section 8은 다음 3개 정적 표 + 1개 합의 패널 구조로 렌더된다. 모든 표는 접기·펼치기 없는 정적 표 (MVP).
  1. **Sector Board 위원별 한 줄 의견 표** — 해당 종목 섹터 14명 전원(없을 경우 활성화된 위원 수). 컬럼: 번호 · 위원 이름 · 배경(한 줄) · 의견(BUY/HOLD/SELL) · 한 줄 논거. Reference: `Document/Outputs/Report-Alteogen_196170_v3-Readable.md` §Section 8 Part A `위원별 한 줄 의견·투표` 표 형식.
  2. **Core 11 위원별 한 줄 의견 표 (전원 11명)** — Core Committee 11명 전원. 컬럼: 번호 · 위원 이름(투자 철학 라벨 포함, 예: "Warren Buffett (장기 가치)") · 의견(BUY/HOLD/SELL/기권) · 한 줄 논거. Reference 알테오젠은 Core Committee를 쟁점별 대표 인용만 했으나, 45차 결정으로 **Core 11도 전원 한 줄 표를 추가**(reference 패턴을 Sector·Core 양쪽에 대칭 적용).
  3. **쟁점별 찬반 토론 인용 (3~5건)** — Core 11 발언 중 핵심 쟁점 2~3개를 발췌. 각 쟁점당 찬성 대표 1 + 반대 대표 1 + 중재 1 형식 (Reference Part B 패턴 유지).
  4. **최종 합의 패널** — 섹터 보드 집계(BUY/HOLD/SELL 카운트) · Core Committee 집계(쟁점 토론 반영 후 재투표 카운트) · **Co-Chair 최종 의견(만장일치 여부 명시)** · 공식 판정(BUY/HOLD/SELL) · 근거 1~3줄. Reference Part C 패턴.
  - **65차 Q4** (③·④ 적용): '쟁점별 찬반 토론 인용'·'재투표 카운트'는 멀티라운드 실시간 반박 토론 loop의 산출물로 의미 확장(기존 병렬 독립 채점 후 정적 인용 → 실 토론 라운드 기록). 합의 점수/집계는 선택사항. Section 8 partB/partC가 토론 loop trace를 담도록 W1에서 schema 확장 검토. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조 — schema 재작성은 W1 위임)
- R3.7-8 **(D20, 45차 명확화)**: 정적 표(R3.7-7의 1·2·3·4 항목)는 MVP에 포함. **인터랙티브 페르소나 탐색**(개별 위원 클릭 → 모달/별도 페이지로 그 위원의 과거 트랙 레코드·풀 프로필·이번 종목 발언 풀 텍스트 등)은 Should(S2) 범위. MVP에서는 위원 이름·한 줄 논거까지가 한계이며, 위원 이름은 비-인터랙티브 텍스트로 표시한다.
- R3.7-9 **(D19, 2026-05-19 49차 · Q4 omxy CONVERGED)**: Core 11 prompt 변경은 dev PR 통해서만. 비-dev 어드민(son00326·shjang1001)은 GitHub 이슈로 초안 제출 → dev 검토 후 PR 반영.

**확장 후보 (Should/Nice)**:
- S1 시나리오 패널(Bull/Base/Bear + 시나리오-실제 乖離): M3 투표 패널 위 레이어. UA1 깊이 보강. → Should.
- S2 어드민 메모/주석(종목별): 박소연 검증 워크플로우 + 멀티어드민 협업. K2와 통합. → Should.
- S3 리포트 버전 히스토리(이전 월 비교): 트랙 레코드 감사 가능성. → Should.
- S4 리포트 PDF/HTML export: 이준호 "투심위 자료" 동기. Y1 법적 등록 근거. → Should.


#### User Story & AC — M2 풀 리포트 렌더링
- **Story**: 어드민으로서, AI 선정 근거를 투명하게 검증하기 위해, Section 0~8 전체를 접기·펼치기로 열람할 수 있는 풀 리포트 화면을 원한다.
- **AC**:
  - [ ] `/admin/report/[ticker]` 진입 시 Section 0~8이 Sticky Side Nav + 단일 스크롤 레이아웃으로 렌더되고, Section 0는 디폴트 펼침 상태다.
  - [ ] 리포트 열람 시 `report.view` 이벤트(ticker·section·duration_sec)가 기록되어 IM-1(리포트 소비율) 측정에 반영된다.
  - [ ] 이전/다음 종목 내비게이션이 리포트 하단에 제공되고, "← Short List" 링크 클릭 시 홈 스크롤 위치가 복원된다.
#### DoD (Definition of Done) — M2 풀 리포트 렌더링
- [ ] `/admin/report/[ticker]` 진입 시 Section 0~8이 Sticky Side Nav + 단일 스크롤 레이아웃으로 렌더되고, Section 0는 디폴트 펼침, 나머지 섹션은 디폴트 접힘 상태다.
- [ ] 리포트 열람 시 `report.view` 이벤트(ticker·section·admin_id·timestamp·duration_sec)가 기록된다.
- [ ] 이전/다음 종목 내비게이션이 리포트 하단에 제공되고, "← Short List" 링크 클릭 시 홈 스크롤 위치가 복원된다.
- [ ] `npm run build` + `npm run lint` 통과.

#### User Story & AC — M3 투심위 투표 요약 패널
- **Story**: 어드민으로서, "왜 이 종목이 선정됐는가"를 위원 개개인의 평가 수준까지 추적하기 위해, Sector Board 14명·Core 11 11명 각자의 한 줄 의견·논거와 최종 합의 결과를 Section 8에서 보는 기능을 원한다.
- **AC** (D20, 45차):
  - [ ] Section 8에 **Sector Board 위원별 한 줄 의견 표(해당 섹터 14명 전원)**가 렌더된다. 컬럼: 번호·위원 이름·배경 한 줄·의견(BUY/HOLD/SELL)·한 줄 논거.
  - [ ] Section 8에 **Core 11 위원별 한 줄 의견 표(11명 전원)**가 렌더된다. 컬럼: 번호·위원 이름(투자 철학 라벨 포함)·의견·한 줄 논거.
  - [ ] Section 8에 **쟁점별 찬반 토론 인용 3~5건**(찬성 1~2·반대 1~2·중립 1)이 정적 텍스트로 렌더된다.
  - [ ] Section 8 하단에 **최종 합의 패널**이 표시된다: Sector 집계 카운트 · Core Committee 집계 카운트 · Co-Chair 최종 의견(만장일치 여부) · 공식 판정(BUY/HOLD/SELL) · 근거 1~3줄.
#### DoD (Definition of Done) — M3 투심위 투표 요약 패널
- [ ] Section 8에 Sector Board 위원별 한 줄 의견 표(해당 섹터 14명 전원)가 렌더된다.
- [ ] Section 8에 Core 11 위원별 한 줄 의견 표(11명 전원)가 렌더된다.
- [ ] Section 8에 쟁점별 찬반 토론 인용 3~5건이 정적 텍스트로 렌더된다.
- [ ] Section 8 하단에 최종 합의 패널(Sector·Core 집계 + Co-Chair 만장일치 여부 + 공식 판정)이 표시된다.
- [ ] 인터랙티브 페르소나 탐색(위원 클릭 → 풀 프로필 모달/별도 페이지)은 표시되지 않는다(Should S2 범위).
- [ ] `npm run build` + `npm run lint` 통과.
### §3.8 월간 선정 보조 뷰 (J1 · Must M5·M6)

> **→ 전략 배경**: §1.3 J1 · §1A.3 IM-1(리포트 소비율) · IM-2(승인 리드 ≤5일) 참조.

**기능 설명**: 30종목 전수 리포트 검토는 시간 압박이 크다(Journey 1-C, customer-journey.md). Delta 뷰는 전월 대비 변경분을 즉시 파악하게 하고, 요약 카드는 신규 편입 종목 우선 검토를 유도하여 D+5 마감 내 승인을 돕는다.

**M5 핵심 요구사항 — 편입/유지/제외 Delta 뷰**:
- R3.8-1: `/admin` 홈 Short List 섹션 상단(단기10 위쪽)에 이번 달 변경 요약 배너를 표시한다. 형식: "편입 N종목 · 유지 N종목 · 제외 N종목".
- R3.8-2: 배너 클릭 시 Delta 상세 패널(또는 모달)을 펼쳐 편입·유지·제외 종목 목록과 각 변동 사유 1~2줄을 표시한다.
- R3.8-3: Short List 테이블에서 NEW(편입) / HOLD(유지) / REMOVED(제외) 배지를 각 종목 행에 표시한다. REMOVED 종목은 Short List에서 제외되지만 Delta 상세 패널에는 목록으로 유지한다. **(REMOVED 원인 2종 — ① 정기 재선정 시 알고리즘 탈락[delta_status=removed, 본 R3.8] ② M12a 뉴스 기반 자동 제외[mid-cycle, `news_event` + `m12a_ticker_assessment` durable ledger/action(마이그 0042), §3.10 R3.10-7b~c]. UI는 hover/아이콘으로 사유 구분 권장. delta_status 의미는 ①에 한정.)**
- R3.8-4: Delta 상세 패널의 특정 종목 클릭 시 해당 종목 섹션(단기/중기/장기)으로 홈 스크롤 이동한다.

**M6 핵심 요구사항 — 선정 근거 요약 카드 (3줄)**:
- R3.8-5: Short List 테이블의 각 종목 행에 hover 또는 펼침 시 3줄 이내 선정 근거 요약을 팝오버로 표시한다. 팝오버 내 "풀 리포트 보기" 링크를 포함한다.
- R3.8-6: 3줄 요약은 분석엔진이 Section 0의 핵심 논거를 자동 추출한 텍스트다. 어드민이 편집할 수 없다(읽기 전용).
- R3.8-7: NEW 배지 종목은 요약 카드에 "신규 편입" 레이블을 추가하여 우선 검토를 시각적으로 유도한다.

**확장 후보 (Should/Nice)**:
- S12 Short List 후보군 31~50위 뷰: 박소연 "왜 탈락했나" 검증. 풀 리포트는 30종목 한정. → Should.
- S13 종목 히트맵 뷰: J2 일간 시각화 보강. 모닝 10분 효율. → Should.
- S14 동종 섹터 비교 패널: 박소연 섹터 검증. UA1 Sector Board 결과 활용. → Should.


#### User Story & AC — M5 편입/유지/제외 Delta 뷰
- **Story**: 어드민으로서, 30종목 변경분을 빠르게 파악하여 승인 검토 시간을 줄이기 위해, 이번 달 편입·유지·제외 요약을 한눈에 보는 기능을 원한다.
- **AC**:
  - [ ] `/admin` 홈 Short List 상단에 "편입 N · 유지 N · 제외 N" 배너가 표시되고, 클릭 시 각 종목 목록과 변동 사유 1~2줄이 펼쳐진다.
  - [ ] Short List 테이블 각 행에 NEW/HOLD/REMOVED 배지가 표시된다.
#### DoD (Definition of Done) — M5 편입/유지/제외 Delta 뷰
- [ ] `/admin` 홈 Short List 상단에 "편입 N · 유지 N · 제외 N" 배너가 표시된다.
- [ ] 배너 클릭 시 편입·유지·제외 종목 목록과 각 변동 사유 1~2줄이 펼쳐지고, 종목 클릭 시 해당 섹션으로 홈 스크롤 이동한다.
- [ ] Short List 테이블 각 행에 NEW/HOLD/REMOVED 배지가 표시된다.
- [ ] `npm run build` + `npm run lint` 통과.

#### User Story & AC — M6 선정 근거 요약 카드 (3줄)
- **Story**: 어드민으로서, 30개 풀 리포트를 전수 열람하지 않고도 핵심 논거를 파악하기 위해, 종목 카드 hover 시 3줄 요약 카드를 원한다.
- **AC**:
  - [ ] 종목 행 hover 또는 펼침 시 3줄 이내 선정 근거 팝오버가 표시되고, "풀 리포트 보기" 링크가 포함된다.
  - [ ] NEW 배지 종목의 요약 카드에는 "신규 편입" 레이블이 추가되어 시각적으로 구분된다.
#### DoD (Definition of Done) — M6 선정 근거 요약 카드 (3줄)
- [ ] 종목 행 hover 또는 펼침 시 3줄 이내 선정 근거 팝오버가 표시되고 "풀 리포트 보기" 링크가 포함된다.
- [ ] 팝오버 텍스트는 읽기 전용이며 어드민이 편집할 수 없다.
- [ ] NEW 배지 종목의 팝오버에 "신규 편입" 레이블이 추가된다.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.9 월간 스케줄러 + 운영 (Cross · Must M10)

> **→ 전략 배경**: §1.3 J1 · §1A.5 D2(D+5 마감) · §1A.5 D8(재생성 cap) 참조.

**기능 설명**: 매월 1일 09:00 KST에 자동 실행되는 배치 파이프라인이 Short List 30 생성과 리포트 생성을 처리한다. 어드민의 수동 트리거 없이 자동 실행되어야 한다. 실패 시 어드민에게 즉시 알림을 보내고, D+5 마감 카운터가 정상 작동하도록 한다. **65차 Q1 supersede**: 선정주기 = 단기 주1회 배치 + 중장기 월1회 배치 2종으로 분리. 기존 '매월 1일 09:00 KST 단일배치로 30 동시생성'은 stale. (현 코드 cron은 일 단위 Vercel Hobby 제약 — 실제 weekly/monthly 스케줄 분리는 W2 구현. HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)

**M10 핵심 요구사항 — 월간 자동 배치 스케줄러**:
- R3.9-1: 매월 1일 09:00 KST에 배치를 자동 실행한다. 실행 순서: 전종목 스크리닝 → Short List 30 선정 → 종목별 리포트 생성(Section 0~8) → 어드민 3명 텔레그램 알림. 수동 트리거 방식은 허용하지 않는다. **65차 Q1 supersede**: 단일 '매월 1일' 배치 → 단기 주1회 + 중장기 월1회 2종 배치로 분리(스케줄 분리는 W2 구현). (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)
- R3.9-2: 배치 완료 시 `shortlist.generated` 이벤트(month · timestamp · new_count · hold_count · removed_count)를 기록한다. 이 이벤트가 D+5 마감 카운터의 시작 기준이다.
- R3.9-3: 배치 실패(스크리닝 오류·리포트 생성 오류 등) 시 `shortlist.generation_failed` 이벤트를 기록하고, 어드민 3인에게 텔레그램 실패 알림을 즉시 발송한다. 재시도 큐에 등록하여 최대 3회 재시도한다.
- R3.9-4: 배치 실패로 인해 Short List가 생성되지 않은 경우 전월 Short List를 유지하고 홈 화면에 "이번 달 Short List 생성 지연" 배너를 표시한다. **미해결 ③(스케줄러 실패 시 D+5 카운터 상호작용) 해소**: 실패 상태에서는 D+5 카운터를 시작하지 않는다. 배치 성공(`shortlist.generated`) 시점부터 카운터를 기산한다. 상세 SLA(재시도 간격·최대 지연 허용치) → BuildPhase B3 이관.
- R3.9-5: 매월 1일 배치 외에 어드민 수동 재생성(종목당 월 2회 한도, §3.4 R3.4-4)은 별도 흐름으로 처리한다. 월간 배치와 수동 재생성의 cap 카운터는 독립적으로 관리한다.

**D+5 예외 규칙 (P5 I-02 박제)**:
- (i) **장기 연휴 처리**: 해당 월의 연휴 영업일수(N)만큼 D+5를 D+(5+N)으로 자동 연장한다.
- (ii) **스케줄러 지연 시 기산점**: D+5 카운터의 시작은 달력 1일이 아니라 `shortlist.generated` 이벤트 시각. 스케줄러가 재시도 후 1일 18:00에 완료되면 거기서부터 D+5 재기산.
- (iii) **재분석(Reject→재생성) SLA**: 재분석 큐 등록부터 완료까지 **최대 3시간**. 재분석 소요 시간은 D+5 총량에 포함(재분석 지연으로 D+5가 연장되지 않음).

**확장 후보 (Should/Nice)**:
- ~~D-OOS-7 데이터 파이프라인 헬스체크 대시보드~~ → **M18로 Must 승격 (v1.1 · D14)**. 박제 위치: `§3.12 M18`.
- ~~D-OOS-6 AI API 비용 모니터링~~ → **M17로 Must 승격 (v1.1 · D14)**. 박제 위치: `§3.12 M17`.


#### User Story & AC — M10 월간 자동 배치 스케줄러
- **Story**: 어드민으로서, 매월 선정 작업을 빠뜨리지 않기 위해, 매월 1일 09:00 KST에 Short List 30 생성과 리포트가 자동으로 완료되는 기능을 원한다. _(65차 Q1 supersede: 단기 주1회 + 중장기 월1회 2종 배치로 분리. 아래 AC/DoD의 '매월 1일 09:00 KST' 단일배치 어휘는 W2 구현에서 weekly/monthly로 분리 — HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)_
- **AC**:
  - [ ] 매월 1일 09:00 KST에 수동 조작 없이 배치가 실행되고, 완료 시 어드민 3명에게 텔레그램 알림이 발송된다.
  - [ ] 배치 성공 시 `shortlist.generated` 이벤트가 기록되고, 이 시점부터 D+5 마감 카운터가 기산된다.
  - [ ] 배치 실패 시 `shortlist.generation_failed` 이벤트 기록 + 텔레그램 실패 알림 발송 + 재시도 큐 등록이 이루어지고, 홈 화면에 "Short List 생성 지연" 배너가 표시된다.
#### DoD (Definition of Done) — M10 월간 자동 배치 스케줄러
- [ ] 매월 1일 09:00 KST에 수동 조작 없이 배치가 실행되고, 완료 시 어드민 3명에게 텔레그램 알림이 발송된다.
- [ ] 배치 성공 시 `shortlist.generated` 이벤트가 기록되고 D+5 마감 카운터가 기산된다(장기 연휴 시 영업일수만큼 연장).
- [ ] 배치 실패 시 `shortlist.generation_failed` 이벤트 기록 + 텔레그램 실패 알림 + 재시도 큐 등록이 이루어지며, 최대 3회 재시도 후에도 실패하면 전월 Short List가 유지되고 홈에 "Short List 생성 지연" 배너가 표시된다.
- [ ] **AI API 비용 가드 (P5 I-03)**: 월 누적 AI 비용 35만원 도달 시〔현재 코드값/기존 경보값 — 65차 W0에서 재산정〕 어드민 3인에게 경보 알림, 50만원 도달 시(65차 hardcap 40만→50만 정정) 자동 재생성(수동·자동 재분석 모두) 하드 캡으로 차단한다.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.10 일간/이벤트 알림 (J2·J3 · Must M11·M12·M13·M15)

> **→ 전략 배경**: §1.3 J2 일간 모니터링 · J3 Exit 타이밍 · §1A.3 IM-3(Exit 신뢰도) · IM-4(모닝 브리핑 참여율) 참조.

**기능 설명**: 어드민의 일간 루틴(Journey 2, customer-journey.md)과 긴급 Exit 여정(Journey 3)을 지원하는 알림 계층. 모닝 브리핑으로 하루를 시작하고, 장중 이상 감지로 즉각 대응하며, Exit 시그널로 매도 타이밍을 놓치지 않는다. §1A.4 Anti-Metric "Exit 시그널 미수신 1건+"를 방어하는 핵심 기능군.

**M11 핵심 요구사항 — 모닝 브리핑 요약 카드**:
- R3.10-1: 매일 08:00 KST에 자동으로 모닝 브리핑을 생성하여 텔레그램 + `/admin` 홈 상단 카드로 동시 발송한다.
- R3.10-2: 브리핑 내용은 전체 포트폴리오 P&L(승인가 기준 당일 수익률) · 주의 종목 N건(Crisis 플래그 또는 M12a 자동제외/검토대상 판정) · 핵심 뉴스 3건(M12a AI 페르소나 평가 상위)을 1화면(3~5줄) 이내로 요약한다.
- R3.10-3: 어드민이 브리핑 카드(텔레그램 또는 대시보드)를 열람하면 `briefing.viewed` 이벤트(admin_id · channel · timestamp)를 기록한다. IM-4(모닝 브리핑 참여율 80%+) 측정의 기반.
- R3.10-4: 브리핑 생성 실패(데이터 파이프라인 오류 등) 시 "오늘 브리핑 생성 불가" 텍스트를 대신 발송하고 `briefing.failed` 이벤트를 기록한다. **(2026-06-26 구현 정정)** 72차/D10 이메일 제거로 모닝 브리핑 채널 = **Telegram(best-effort) + dashboard(`/admin` 홈 카드)** 만; briefing 생성 자체는 항상 성공(거시/뉴스 distill·포트·주의)하고 DB persist 실패만 502로 보고한다(email-driven `briefing_failed` alert는 미발행, enum/CHECK는 보존).
- **R3.10-4a (G4 거시/뉴스 → AI 컨텍스트, D33 §4 · 2026-06-26 ✅ 1차 구현·dormant)**: 거시 regime + 뉴스 distill을 **AI 컨텍스트 입력**으로만 M11 모닝 브리핑(1줄) + Tier1 선정 평가 패널(R1/R2 callPersona) + 30 리포트 writer(`macroSummary`)에 주입하는 **레이어 + seam**을 구현했다. **완료 범위 = mock-macro source distill(`lib/macro`) + 3-consumer wiring(dormant)**; **실 FRED/news source drop-in + `MACRO_CONTEXT_ENABLED` 활성 + Polymarket(선택)은 USER 게이트/후속**(현 flag만으론 mock asOf stale → ""→dormant). 단일 flag `MACRO_CONTEXT_ENABLED`(default off → 현행 byte-identical·선정 무회귀). **절대선**: ① Tier0 정량 funnel factor로 직접 쓰지 않음(코드 import allowlist 테스트로 박제), ② M12a(per-ticker 자동제외)와 **범주 분리**(macro = market/regime bias-correction context, M12a = company thesis-break removal), ③ forward-validate(렌더 문자열에 "예측 아님 · Tier0 스크리닝 팩터 아님 · asOf" 명시, 예측 어휘 금지), ④ stale-mock fail-safe(source asOf > 7일이면 flag on이어도 ""→dormant). 현 거시 source = mock-macro; 실 FRED/source drop-in + flag = USER 활성 게이트. SoT = `docs/superpowers/specs/2026-06-26-g4-macro-news-ai-context-layer-design.md`.

**M12a 핵심 요구사항 — 뉴스 기반 자동 제외 (AI 페르소나)** *(✅ shadow-first 빌드 완료·dormant, 2026-06-27 — `tudal/src/lib/news/m12a/*` + 마이그 0042 DORMANT(USER apply). flag `M12A_NEWS_EVAL_ENABLED`/`M12A_AUTO_REMOVE_ENABLED` 둘 다 default off → 평가/제거 모두 미실행, morning-briefing byte-identical. 자동 제거 mutation은 출시 후 fast-follow(throw-stub). 구 규칙기반 passive 뉴스 분류는 collection/dedup만 재사용. 구 "M12 Critical/Warning/Info 3등급 규칙 분류"는 supersede. omxy R1~R3 + Claude 5-dim deep-review CONVERGED. 빌드 SoT = `docs/superpowers/specs/2026-06-26-m12a-news-auto-remove-shadow-first.md`.)*:
- R3.10-5: **AI 페르소나(Core 11 병렬, 강한 모델)** 가 매일 개장 전(08:00 KST, M11과 동일 cron 슬롯) + 뉴스 이벤트 시, 보유 가상 포트 + 홈 30리스트 종목의 신규 뉴스·공시를 평가한다. (Sector 14 활성화 = MVP 제외·후순위.)
- R3.10-6: 각 뉴스/종목 평가는 **구조화 판정**을 산출한다(✅ 구현 — `lib/news/m12a/evaluator.ts` consensus → `PerTickerAssessment`): `severity` · `scope`(company|sector|market|unknown) · `confidence` · `affected_tickers` · `materiality` · `directness` · `thesis_break_reason` · `recommended_action`(auto_remove|alert_only|hold_for_review; `decideRecommendedAction`이 구조화 필드에서 결정론 파생).
- R3.10-7: **자동 제외 조건** — `scope`(company|sector|market|unknown)는 출처/범위 메타데이터일 뿐 의사결정 gate가 아니다. `recommended_action=auto_remove`는 각 보유/리스트 종목별(per-company) 평가에서 **direct + material + high-confidence thesis-break**가 확인되고 해당 ticker가 `affected_tickers`/per-ticker assessment에 명시될 때만 가능하다. 회사 고유 뉴스뿐 아니라 sector/market/macro 뉴스도 종목별 노출도·펀더멘털 차이로 차등 평가한다. thesis-break 없음·low-confidence·unknown은 `alert_only`; 대량/systemic 후보는 R3.10-7a brake로 `hold_for_review` 처리한다.
- R3.10-7a: **안전장치(smart brake)** — 평상시(종목별 thesis-break 1~2건)는 완전 자동. circuit-breaker(후보 산출 후): 1 run의 per-company 자동제외 후보 > `max_auto_removals_per_run`(기본 3·config; 즉 4건↑) **또는** track floor 위반 → 그 run의 자동제외를 **전체 hold_for_review**(자동 제외 보류 + "대량 제외 감지·검토 요망" 알림, 부분 제외 안 함). floor = 홈 리스트 track 70%(short<7 / midlong<14 / full<21); 가상포트는 N≥10일 때만 70% floor 적용, 집중포트 N<10은 1건 direct/high-conf 자동 허용·≥2건 hold_for_review. = 폭락일·시장 전반 악재 안전판(순수 자동의 유일 예외).
- R3.10-7b: **실행 = 빼기만** — auto_remove 확정 시 해당 종목을 (a) 홈 30리스트 + (b) 가상 포트 양쪽에서 제외한다(추가 없음). 가상포트 freed weight → 현금. 빈 슬롯은 다음 정기 선정 cron(단기 주1회 / 중·장기 월1회)이 refill하며, 그 사이 리스트 30개 미만을 허용한다.
- R3.10-7c: **durable ledger + 재진입** — 별도 lockout 없음. 뉴스 이벤트는 **`news_event` 1건 + `m12a_ticker_assessment` N건**(per-ticker assessment, 구현명·마이그 0042 DORMANT)으로 기록한다(각 row: ticker, scope metadata, thesis_break_reason, recommended_action, action_taken, held_by_brake 여부). 실제 제외는 per-ticker assessment의 `action_taken=removed`(shadow phase면 `shadowed`=would-remove)로 남기고, `hold_for_review`는 종목별 thesis_break_reason/proposed_action을 보존하되 홈 리스트/가상포트 mutation은 하지 않는다. 다음 정기 선정 시 최근 negative-news context를 **모든 Tier1 후보(fresh ∪ incumbent)** 에 주입(W2b incumbent-only seam과 **별개·additive**)하여 페르소나가 악재를 보고 재판단한다 → thesis 깨짐=재탈락 / 회복=재진입 허용. **E1 short_list_30 row semantics 불변**(delta_status new/hold/removed=정기재선정 diff와 별개). `alert_event.alert_type` closed enum에 removal 타입 **추가 안 함**(불변) — 알림은 기존 `news_critical`/`news_warning` 재사용. **(✅ 구현 2026-06-27)** durable ledger = 기존 `news_event` 1건 + **신규 `m12a_ticker_assessment` N건**(마이그 0042 DORMANT·USER apply; 컬럼 = news_event_id FK + run_id + month + ticker + surface + scope + severity + confidence + materiality + directness + thesis_break + thesis_break_reason + recommended_action + action_taken(shadowed|held_by_brake|removed) + held_by_brake + price_basis_date/price_source/execution_assumption(GAP2 removed-only) + optional alert_event_id FK). 실제 제외는 `action_taken=removed`(shadow phase면 `shadowed`=would-remove), `hold_for_review`는 thesis_break_reason 보존+mutation 0.
- R3.10-7d: **알림 채널** — 자동 제외 / 대량보류 알림은 **텔레그램 + `/admin` 웹 알림(`/admin/alerts` durable event + 대시보드 unread badge)** 으로만 발송한다. **이메일/Resend는 전 phase 제거**(M15/D10/S7c/S7d 포함). 알림 형식 = 티커 + 뉴스 제목 30자 + 사유 1줄 + `/admin/alerts` 상세 링크.
- R3.10-7e: **M15 Exit 경계** — 뉴스 평가 결과는 IM-3(Exit 신뢰도) 입력으로도 사용되나, **M12a 자동 제외(리스트/포트에서 1회 제거) 와 M15 Exit sell-signal(보유 매도 타이밍 제안)은 별개 경로**다. 제거는 1회, Exit는 ongoing.
- R3.10-7f: **경계 정리(D19/D27/E7)** — M12a는 **D19 합의 배지**(🟢/🔵/🟣/🟡/⚪ = 선정 신호)와 독립(뉴스 제거 판정은 별도 축). **D27 incumbent thesis 재점검**은 정기 선정 시점의 per-incumbent review이고 M12a는 mid-cycle 뉴스 트리거 — 별개·상호보완(R3.10-7c의 candidate-level context로 연결). **E7 BriefingLog**(M11 모닝 브리핑 로그)는 유지하되 removal 알림은 별도 이벤트로 기록.
- R3.10-7g: **설계 결정 + 롤아웃 (72차 omxy 토론 CONVERGED — Claude 적대 GAP1~4 + critic sidecar 검증)**:
  - **(GAP1 Track Record 분리 귀속)** M12a 제거가 가상포트 "AI 선정 실력" 측정을 오염시키지 않도록 **3-layer 분리**: ① **선정 baseline**(Accept 시점 포트 = 순수 선정 실력) ② **live AI-managed portfolio**(M12a 제거 포함 = 실제 AI 운용 결과) ③ **M12a risk-action ledger**(`m12a_ticker_assessment.action_taken` = shadowed|held_by_brake|removed 별도 귀속 — 마이그 0042 DORMANT). 명칭 `m12a_risk_action`(M15 Exit와 혼동 회피). Track Record/NSM/Anti-Metric은 ①을 기준선으로 유지하고 ②③은 부가 측정.
  - **(GAP2 현금화 가격)** auto-remove freed→현금 가격 = **평가 직전 최신 완료 KRX EOD 종가**(`krx-eod.ts` 패턴 재사용). 기록 = `price_basis_date` · `price_source=KRX_EOD` · `execution_assumption=virtual_eod`. 장중 뉴스 이벤트 기반 실 가격 mutation은 **S7c KIS live price 전까지 shadow only**(가격 불명 시 자동 현금화 금지).
  - **(GAP3 systemic brake 정책)** 고립된 direct/high-conf thesis-break = 자동 제외 / **대량·systemic 이벤트 = 자동 제외 아님, 긴급 검토 보류(human-in-loop)**. R3.10-7a brake가 panic auto-liquidation을 막는다 — M12a는 "완전 자동"이 **아니다**(고립건만 자동).
  - **(GAP4 shadow-first 롤아웃)** flag **`M12A_AUTO_REMOVE_ENABLED`(default false)**. **shadow phase** = would-remove/held_by_brake 이벤트 + 텔레그램//admin 알림 + ledger만 기록, `short_list_30`/`portfolio_snapshot` **mutation 0**. 어드민이 shadow precision(정확도) 확인 후 auto flag ON(사용자 "자동" 선택 = shadow 검증 후 도달).
  - **(개발 순서 — base-first + shadow-first)** ① 풀 P3 AI 30선정 → ② P2b/P4 + proposal·Accept go-live → ③ **D11-base 운용검증(M12a mutation 없이 Track Record 기준선 확보)** → ④ S7b M11/뉴스 + **M12a shadow/alert-only** → ⑤ S7c→S7d→S9/🎉출시 → ⑥ **M12a auto-remove ON = 출시 후 fast-follow**(shadow 정확도 확인 후 flag 승격). **M12a 자동 제거 mutation = 출시 게이트 아님**; 뉴스 수집/브리핑/알림/shadow-M12a는 출시 전 포함 가능.

**M13 핵심 요구사항 — 장중 이상 감지 알림**:
- R3.10-8: 상시 모니터링 모드(§3.5) 활성 시 보유 종목 중 ±5% 가격 변동 또는 거래량 3배 초과를 감지하면 텔레그램 즉시 알림 + `/admin` 홈 상단 배지를 동시에 트리거한다.
- R3.10-9: 종목별 on/off 토글(§3.5 R3.5-3)이 OFF인 종목은 장중 이상 감지 알림을 발송하지 않는다. 디폴트는 전체 ON.
- R3.10-10: 임계치 수치(±5%, 거래량 3배)는 현재 고정값이며, 세밀한 커스텀은 Phase 2 범위(§3.5 확장 후보 참조).

**M15 핵심 요구사항 — Exit 시그널 발송 + 근거 + 대안**:
- R3.10-11: Exit 트리거(목표가 도달 · 모멘텀 꺾임 · 악재 발생) 감지 시 **텔레그램 best-effort + `/admin/alerts` durable event + 대시보드 unread badge** 2-layer로 발송한다. 어드민 3인 모두 `/admin`에서 catch-up 가능하다.
- R3.10-12: Exit 시그널 발송 시 `exit.signal.sent` 이벤트(ticker · severity · timestamp · trigger_reason)를 즉시 기록한다. T+7일 후 해당 종목 가격 변화를 조회하여 `exit.signal.outcome`(t7_price_change)을 자동 적재한다. IM-3(Exit 시그널 신뢰도 65%+) 측정의 유일한 데이터 소스.
- R3.10-13: `/admin/alerts/[id]` 상세 화면에 트리거 이벤트 설명 · 심각도 · 매도 근거 · 대안 시나리오 3개(매도 전량 / 분할매도 / 홀딩)를 표시한다. 리포트 §7 Exit 조건과 현재 상황의 자동 대조 블록을 포함한다.
- R3.10-14: `/admin/alerts/[id]`에서 어드민이 "매도 전량 / 분할매도 / 홀딩" 중 하나를 선택하고 근거 메모를 입력할 수 있는 결정 기록 입력란을 제공한다. 입력된 기록은 이력에 저장한다.
- R3.10-15: **Exit 시그널 백업 채널 (D10, 72차 사용자 override)**: 이메일/Resend 알림은 전역 제거. D10은 **텔레그램 best-effort(발송 실패가 caller를 미escalate) + `/admin/alerts` durable event + 대시보드 unread badge catch-up**로 재정의한다. Telegram 실패·미설정이어도 `/admin` durable event와 unread badge는 남아 다음 접속 시 확인 가능해야 한다. Anti-Metric "Exit 시그널 미수신 1건+" 방어를 Must 범위에 포함. **SMS는 22차에 이미 제거됨**.

**확장 후보 (Should/Nice)**:
- S15 Exit 저널(매도 이유 + 사후 추적): IM-3 신뢰도 데이터 풍부화. 박소연 "내가 틀렸나 AI가 틀렸나" 검증. → Should.
- S16 홀딩 기간 초과 경보: 단기/중기/장기 버킷별 홀딩 기간 초과 시 알림. → Should.
- S6 매크로 컨텍스트 축소판(M11 보강): KOSPI/금리/환율 미니 차트를 모닝 브리핑에 추가. → Should.


#### User Story & AC — M11 모닝 브리핑 요약 카드
- **Story**: 어드민으로서, 매일 아침 10분 안에 포지션 상태를 파악하기 위해, 08:00 KST 자동 생성되는 브리핑 카드를 원한다.
- **AC**:
  - [ ] 매일 08:00 KST에 브리핑이 텔레그램과 `/admin` 홈 상단 카드에 동시 표시된다.
  - [ ] 브리핑 열람 시 `briefing.viewed` 이벤트가 기록되어 IM-4(모닝 브리핑 참여율) 측정에 반영된다.
#### DoD (Definition of Done) — M11 모닝 브리핑 요약 카드
- [ ] 매일 08:00 KST에 수동 조작 없이 브리핑이 생성되어 텔레그램과 `/admin` 홈 상단 카드에 동시 표시된다.
- [ ] 브리핑 내용에 전체 P&L · 주의 종목 건수 · 핵심 뉴스 3건이 3~5줄 이내로 요약된다.
- [ ] 브리핑 열람 시 `briefing.viewed` 이벤트가 기록되고, 생성 실패 시 "오늘 브리핑 생성 불가" 텍스트와 `briefing.failed` 이벤트가 기록된다.
- [ ] `npm run build` + `npm run lint` 통과.

#### User Story & AC — M12a 뉴스 기반 자동 제외 (AI 페르소나) *(✅ shadow-first 빌드 완료·dormant 2026-06-27 — `lib/news/m12a/*` + 마이그 0042 DORMANT)*
- **Story**: 어드민으로서, 밤사이 악재가 터진 종목을 다음 정기 선정까지 기다리지 않고 즉시 리스트·포트에서 빼기 위해, AI 페르소나가 뉴스를 분석해 명확히 부정적이면 자동 제외하고 알림해 주는 기능을 원한다.
- **AC**:
  - [ ] 개장 전(08:00 KST) AI 페르소나(Core 11)가 보유 포트 + 30리스트 종목의 신규 뉴스를 평가해 구조화 판정(severity/scope/confidence/affected_tickers/materiality/directness/thesis_break_reason/recommended_action — §3.10 R3.10-6)을 산출한다.
  - [ ] `scope`는 메타데이터로만 보존하고, 회사/섹터/거시 뉴스 모두 각 보유·리스트 종목별 thesis-break를 평가한다. direct·material·high-confidence per-company thesis-break로 판정된 종목만 홈 리스트 + 가상포트에서 **자동 제외**되고(빼기만, freed→현금), 텔레그램 + `/admin` 웹 알림이 발송된다. thesis-break 없음·저확신·불명은 alert_only 또는 hold_for_review로 남긴다.
  - [ ] 안전장치: 1 run 4건↑(>max 3) 또는 track 70% floor 위반 시 그 run 전체가 hold_for_review로 보류되고 검토 알림만 발송된다(집중포트 N<10은 1건 자동·2건↑ 보류).
  - [x] ✅ 기존 `news_event` 1건 + **신규 `m12a_ticker_assessment` N건**(마이그 0042 DORMANT)이 기록되고, 실제 제거/보류 사유가 다음 정기 선정 시 모든 Tier1 후보에 negative-news context로 주입되어 재판단된다(lockout 없음·shadow-first: flag off면 mutation 0).
#### DoD (Definition of Done) — M12a 뉴스 기반 자동 제외 *(✅ shadow-first 빌드 완료·dormant 2026-06-27 — 코드+테스트+마이그 0042+PG smoke·게이트 green. 실 AI 호출/자동 mutation = USER 게이트 + 출시 후 fast-follow)*
- [ ] AI 페르소나 평가 → per-company thesis-break 기반 recommended_action 판정 → auto_remove 조건(direct/material/high-conf/affected_ticker) 충족 시에만 자동 제외(빼기만), freed weight 현금화, 다음 cron refill. scope(company|sector|market)는 gate가 아닌 메타데이터.
- [ ] smart brake(max_auto_removals_per_run + track 70% floor) 동작, 초과 시 전체 hold_for_review + 알림, 종목별 thesis_break_reason/proposed_action 보존 + portfolio/list mutation 금지.
- [ ] 텔레그램 + `/admin` 웹 알림(`/admin/alerts` durable event + 대시보드 unread badge), durable ledger 기록 + 다음 선정 candidate-level context 주입(fresh∪incumbent). 이메일/Resend 미사용.
- [ ] `npm run build` + `npm run lint` 통과.

#### User Story & AC — M13 장중 이상 감지 알림
- **Story**: 어드민으로서, 장중 급변 종목을 놓치지 않기 위해, ±5% 가격 변동 또는 거래량 3배 초과 시 즉시 알림을 받는 기능을 원한다.
- **AC**:
  - [ ] 상시 모니터링 모드 활성 시 임계치 발동 종목에 대해 텔레그램 즉시 알림과 홈 상단 배지가 동시에 트리거된다.
  - [ ] 종목별 on/off 토글이 OFF인 종목은 임계치 발동 시에도 알림이 발송되지 않는다.
#### DoD (Definition of Done) — M13 장중 이상 감지 알림
- [ ] 상시 모니터링 모드 활성 시 ±5% 가격 변동 또는 거래량 3배 초과 종목에 대해 텔레그램 즉시 알림과 `/admin` 홈 상단 배지가 동시에 트리거된다.
- [ ] 종목별 ON/OFF 토글이 OFF인 종목은 임계치 발동 시에도 알림·배지가 발송되지 않는다.
- [ ] `npm run build` + `npm run lint` 통과.

#### User Story & AC — M15 Exit 시그널 발송 + 근거 + 대안
- **Story**: 어드민으로서, 매도 타이밍을 절대 놓치지 않기 위해, Exit 트리거 발생 시 근거와 대안 시나리오가 포함된 즉시 알림을 원한다.
- **AC**:
  - [ ] Exit 트리거 감지 시 텔레그램 best-effort + `/admin/alerts` durable event + 대시보드 unread badge가 생성되고 `exit.signal.sent` 이벤트가 기록된다.
  - [ ] `/admin/alerts/[id]` 상세 화면에 트리거 설명·심각도·대안 시나리오 3개(매도 전량/분할매도/홀딩)와 어드민 결정 기록 입력란이 표시된다.
  - [ ] T+7일 후 `exit.signal.outcome`이 자동 적재되어 IM-3(Exit 시그널 신뢰도) 측정에 반영된다.
#### DoD (Definition of Done) — M15 Exit 시그널 발송 + 근거 + 대안
- [ ] Exit 트리거 감지 시 텔레그램 best-effort + `/admin/alerts` durable event + 대시보드 unread badge가 생성되고 `exit.signal.sent` 이벤트(ticker·severity·timestamp·trigger_reason)가 기록된다.
- [ ] **백업 채널 (D10, 72차 사용자 override)**: Telegram 발송은 best-effort이고 실패해도 `/admin/alerts` durable event + 대시보드 unread badge로 catch-up된다. 이메일/Resend/SMS는 사용하지 않는다.
- [ ] `/admin/alerts/[id]` 상세 화면에 트리거 설명·심각도·대안 시나리오 3개(매도 전량/분할매도/홀딩)와 어드민 결정 기록 입력란이 표시되며, 입력된 기록이 이력에 저장된다.
- [ ] T+7일 후 해당 종목 가격 변화를 조회하여 `exit.signal.outcome`이 자동 적재된다.
- [ ] **(v1.1 D14 연동)** Exit 시그널 발송 경로는 **M18 파이프라인 헬스체크**(알림 발송 파이프라인 성공률 95%+)와 **M19 Silent Health 일간 하트비트**(알림 발송 불능 상태에서 "조용한 장애" 방지)로 이중 감시된다. M18 warning 또는 M19 적색 경보 발생 시 Exit 시그널 신뢰도 계산에서 해당 시점을 블랙아웃 처리.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.11 성과 측정 + Decision Tree (J4 · Must M8·M16)

> **→ 전략 배경**: §1.3 J4 성과 추적 · §1.7 성공 기준 · §1A.3 NSM(CAP Months) · BusinessPlan §Q4 참조.

**기능 설명**: 가상 포트폴리오 일별 스냅샷(M8)을 기반으로 월간/누적 수익률·Sharpe·alpha를 `/admin/track-record`에 표시하고, Y1 Decision Tree 진척도를 `/admin/decision-tree` 단독 화면(D9)에서 게이지로 시각화한다. 12개월 누적이 Core JTBD 완성의 측정 기준이며 법적 등록 판단의 근거가 된다.

**M8 핵심 요구사항 — `/admin/track-record`**:
- R3.11-1: `/admin/track-record`는 누적 수익률 · KOSPI 동기간 수익률 · alpha · Sharpe를 요약 카드 행으로 최상단에 표시한다.
- R3.11-2: 월별 성과 테이블(월 · 포트 수익률 · KOSPI · alpha · Sharpe · CAP 연속 월수)과 버킷별(단기/중기/장기) 분리 집계를 제공한다.
- R3.11-3: Counterfactual 블록("AI 비중 그대로 따랐으면 수익률 X%")을 표시하여 어드민 오버라이드의 영향을 가시화한다.
- R3.11-4: NSM(CAP Months) 수치를 track-record 화면에 참조용으로 함께 표시하되, Decision Tree 상세는 `/admin/decision-tree`로 분리한다.

**M16 핵심 요구사항 — `/admin/decision-tree` (D9)**:
- R3.11-5: `/admin/decision-tree`는 대시보드 위젯이 아닌 단독 화면으로 구성한다. 좌측 사이드바 탐색에서 "Decision Tree" 항목으로 직접 접근 가능.
- R3.11-6: 게이지 3종을 페이지 상단에 나란히 표시한다 — ①CAP Months(현재 N / 목표 12, 진행 바) · ②누적 Alpha(현재 +X.X% / 목표 양(+), 게이지) · ③Sharpe(현재 X.XX / 목표 > 1.0, 게이지).
- R3.11-7: 게이지 아래 월별 추이 라인 차트(CAP Months 누적 · alpha 추이 · Sharpe 추이)를 제공한다.
- R3.11-8: **미해결 ⑤(부분 표시 UX) 해소**: M1~M6(운용 1~6개월) 동안 데이터가 불완전한 게이지는 "N/12개월 진행 중" 레이블과 함께 현재까지 데이터만으로 부분 렌더링한다. 빈 게이지보다 진행률 표시가 어드민 동기부여에 유리하다. 애니메이션·색상 처리 상세는 → P7 UX 이관.
- R3.11-9: "Y1 목표 달성 예상" 요약 블록(현재 경로 기준 ○/△/✕)과 BusinessPlan §Q4 원문 참조 링크(내부 문서)를 하단에 제공한다.

**확장 후보 (Should/Nice)**:
- S17 Short List 적중률 트래커: §1.7 성공 기준 박제. M8 트래킹 엔진 위 집계 레이어(편입 종목 중 수익 종목 비율). → Should.
- N1 Attribution 분석(선택/타이밍/비중): 12개월 데이터 누적 후 의미 있음. → Nice, Y2.
- N2 Drawdown 분석(MDD·회복기간): M16 Decision Tree 핵심 수치만 흡수, 상세는 Y2. → Nice.

#### User Story & AC — M16 Decision Tree 진척도 대시보드
- **Story**: 어드민으로서, Y1 말 법적 등록 판단을 준비하기 위해, CAP Months·누적 alpha·Sharpe를 한눈에 볼 수 있는 전용 화면을 원한다.
- **AC**:
  - [ ] `/admin/decision-tree`에서 게이지 3종(CAP Months / 누적 Alpha / Sharpe)이 현재값과 목표값 함께 표시된다.
  - [ ] 게이지 아래 월별 추이 라인 차트가 렌더되고, 운용 1개월 시점에도 "N/12개월 진행 중" 레이블과 함께 부분 렌더링된다.
  - [ ] "Y1 목표 달성 예상 ○/△/✕" 요약 블록이 게이지 데이터와 연동되어 자동 갱신된다.
#### DoD (Definition of Done) — M16 Decision Tree 진척도 대시보드
- [ ] `/admin/decision-tree` 단독 화면이 사이드바 탐색에서 직접 접근 가능하고, 게이지 3종(CAP Months / 누적 Alpha / Sharpe)이 현재값·목표값과 함께 렌더된다.
- [ ] 운용 1개월 시점처럼 데이터가 불완전한 경우에도 "N/12개월 진행 중" 레이블과 함께 부분 렌더링이 표시된다(빈 게이지 없음).
- [ ] 게이지 아래 월별 추이 라인 차트가 렌더되고, "Y1 목표 달성 예상 ○/△/✕" 요약 블록이 게이지 데이터와 연동되어 자동 갱신된다.
- [ ] **○/△/✕ 판정 기준 (P5 I-13)**: ○ = alpha ≥ 0 **AND** Sharpe ≥ 0.5 **AND** MDD ≤ -15% 이상 양호 / △ = 중간(하나 경계 미달) / ✕ = 둘 이상 미달. 기준은 Y1 Decision Tree 실제 발동 이전 BuildPhase B4에서 재검증.
- [ ] `npm run build` + `npm run lint` 통과.

### §3.12 시스템 관측·가드레일 (J5 · Must M17·M18·M19)

> **v1.1 신설 (D14, Q-OP1 해소)** — Anti-Metric 4종 전체의 실시간 방어층. Deferred에 있던 D-OOS-6·D-OOS-7 + 신규 Silent Health Must 승격. Anti-Metric "AI API 월 50만원"(65차 hardcap 40만→50만 정정) · "Exit 시그널 미수신" · "리포트 생성 실패 1건+"를 조기 감지·차단.
>
> **→ 전략 배경**: §1A.4 Anti-Metrics 방어 기능 열 · §3.10 M15 Exit 시그널 · §3.9 M10 스케줄러 참조.

**기능 설명**: 어드민 3인이 시스템이 "조용한지 / 정상인지 / 장애인지"를 즉시 구분할 수 있도록 하는 관측 레이어. (1) 비용이 폭주하는지 (M17), (2) 파이프라인이 죽었는지 (M18), (3) 아무 일도 없는지 혹은 적색 경보인지 (M19)를 일간 단위로 분리 감지한다.

#### M17 핵심 요구사항 — AI API 비용 실시간 모니터링 대시보드 (D-OOS-6)

- R3.12-1: `/admin/settings` 또는 어드민 대시보드 상단에 **당월 누적 AI API 비용 위젯**을 배치한다. 일별·월별 추이 라인 차트 + 현재 금액(₩) + 당월 cap 대비 진행률(%)을 표시한다. EOD 배치 + 상시 모니터링 모드에서는 장중 갱신.
- R3.12-2: **35만원 도달 시**〔현재 코드값/기존 경보값 — 65차 W0에서 재산정〕 경보 알림(텔레그램 + `/admin` 웹 알림)을 어드민 3인에게 발송한다. **50만원 도달 시 자동 재생성 차단 하드 캡**(65차 hardcap 40만→50만 정정)이 발동하여 수동 재생성 버튼(§3.4 R3.4-4)과 자동 재분석(R3.3-3)을 모두 차단한다. 사용자 override 액션으로만 해제 가능하며, override는 `admin/settings` 별도 토글로 로그 기록.
- R3.12-3: 비용 기여 상위(종목·페르소나·섹션·모델) 브레이크다운 테이블을 위젯 하단에 제공한다. Top 5 비용 기여 항목을 일별/월별로 스위치하여 조회 가능. 프롬프트 최적화 판단 지원. **65차 Q3 + D28**: '모델' 차원 = 멀티프로바이더(Claude+GPT)·역할별 모델 차등. D28 기준은 비용 최소화가 아니라 **예측 적중률+리포트 정확성**(hardcap=제약)이며, 초기 기본값은 토론 Sonnet 4.6×6+GPT mid×5 / judge·리포트 Opus 4.8 중심 / critic GPT mid 교차(가설, track-record로 조정). 비용 브레이크다운에 provider 컬럼 추가 검토. 모델 하드코딩 제거+레지스트리화는 W0 구현. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)

- **User Story**: 어드민으로서 당월 AI 비용을 실시간으로 볼 수 있어, Anti-Metric 50만원 트리거(65차 hardcap 40만→50만 정정) 이전에 선제 대응하고 싶다.
- **AC**:
  - [ ] `/admin` 또는 `/admin/settings`에 당월 누적 AI API 비용 위젯이 렌더되고, 일별·월별 추이 + 현재 금액 + cap 대비 진행률이 표시된다.
  - [ ] 35만원 도달 시 텔레그램 + `/admin` 웹 경보가 어드민 3인에게 발송된다.
  - [ ] 50만원 도달 시(65차 hardcap 40만→50만 정정) 수동 재생성 버튼과 자동 재분석이 자동 차단되고, 차단 해제는 설정 override로만 가능하다.
  - [ ] 비용 기여 상위 Top 5(종목·페르소나·섹션·모델) 테이블이 일별/월별 스위치로 제공된다.
  - [ ] 비용 추정 실패·수집 누락 시 "비용 데이터 일시 중단" 표시가 노출되고 `cost.feed.failed` 이벤트가 기록된다.

- **DoD**:
  - [ ] 당월 누적 AI API 비용 위젯이 일별·월별 추이·현재 금액·cap 진행률과 함께 정상 렌더된다.
  - [ ] 35만원 도달 시〔현재 코드값/기존 경보값 — 65차 W0에서 재산정〕 텔레그램 + `/admin` 웹 경보가 발송되고, 50만원 도달 시(65차 hardcap 40만→50만 정정) 자동 재생성 하드 캡이 실제로 재생성 경로를 차단한다.
  - [ ] override 토글 작동 + override 사용 내역이 로그에 기록된다.
  - [ ] Top 5 비용 기여 브레이크다운이 종목·페르소나·섹션·모델 기준으로 전환 가능하다.
  - [ ] `npm run build` + `npm run lint` 통과.

#### M18 핵심 요구사항 — 파이프라인 헬스체크 대시보드 (D-OOS-7)

- R3.12-4: 5개 핵심 파이프라인(**DART 크롤러·뉴스 수집·가격 피드·AI 호출·알림 발송**)의 일간 성공률을 모니터링한다. 각 파이프라인별 건수/성공수/성공률(%)·마지막 성공 시각·마지막 실패 시각을 `/admin/health` 또는 관측 대시보드에 표시한다.
- R3.12-5: **성공률 95% 미만 시 자동 운영자 호출**(텔레그램 + `/admin` Critical 웹 알림)을 어드민 3인에게 발송한다. **99% 미만이면 warning 등급**으로 대시보드 배지만 표시(호출 없음).
- R3.12-6: **실시간 error log tail**(최근 50줄) + 최근 24시간 실패 트레이스(타임스탬프 · 파이프라인 · 스택 요약)를 대시보드 하단에 제공한다. 로그 적재 실패 시 "로그 파이프라인 단절" 배너 자체가 Critical 경보를 트리거한다.

- **User Story**: 어드민으로서 파이프라인 장애를 조기 감지하여, Exit 시그널 미수신 리스크(Anti-Metric)와 리포트 생성 실패(Anti-Metric)를 방지하고 싶다.
- **AC**:
  - [ ] `/admin/health`에 5개 파이프라인의 성공률·마지막 성공/실패 시각이 표시된다.
  - [ ] 성공률 95% 미만 시 Critical 알림이 텔레그램 + `/admin` 웹 알림으로 어드민 3인에게 발송된다.
  - [ ] 성공률 99% 미만 시 warning 배지만 대시보드에 표시되고 호출은 발생하지 않는다.
  - [ ] 실시간 error log tail과 최근 24시간 실패 트레이스가 렌더된다.
  - [ ] 로그 파이프라인 자체 단절 시 "로그 파이프라인 단절" Critical 배너가 트리거된다.

- **DoD**:
  - [ ] 5개 핵심 파이프라인(DART·뉴스·가격·AI·알림 발송) 각각의 일간 성공률·마지막 성공/실패 시각이 `/admin/health`에 렌더된다.
  - [ ] 95% 미만 Critical 알림 / 99% 미만 warning 배지 2단 분기가 정상 작동한다.
  - [ ] error log tail(최근 50줄)과 최근 24시간 실패 트레이스가 표시된다.
  - [ ] 로그 파이프라인 단절 시 자체 Critical 배너가 트리거된다.
  - [ ] `npm run build` + `npm run lint` 통과.

#### M19 핵심 요구사항 — Silent Health 일간 하트비트

- R3.12-7: **장 운영일 자정 배치**가 성공하면 **"오늘 이상 없음" 브리핑 카드**를 어드민 3인에게 텔레그램 + `/admin` 웹 알림(대시보드 unread badge) 2-layer로 **무조건** 발송한다. 카드 내용: 일자·5개 파이프라인 성공률 요약·당월 AI 비용 현황·Exit 시그널 발송 건수·브리핑 수신 확인.
- R3.12-8: 자정 배치 실패 또는 핵심 파이프라인 중 하나라도 Critical 상태이면 하트비트 카드를 **"적색 경보" 카드로 전환**하여 동일 2-layer에 발송한다. "조용한 장애"(시스템이 죽었는데 알림도 없는 상태)를 원천 방지하는 최후 안전망.

- **User Story**: 어드민으로서 시스템이 조용할 때 "장애인지 평온인지"를 즉시 구분하여, Exit 시그널 미수신 Anti-Metric을 원천 방어하고 싶다.
- **AC**:
  - [ ] 장 운영일 자정 배치 성공 시 "오늘 이상 없음" 하트비트 카드가 텔레그램 + `/admin` 웹 알림 2-layer에 무조건 발송된다.
  - [ ] 자정 배치 실패 또는 파이프라인 Critical 시 "적색 경보" 카드로 전환되어 동일 2-layer에 발송된다.
  - [ ] 하트비트 카드에 일자·파이프라인 성공률·AI 비용·Exit 시그널 건수·수신 확인 링크가 포함된다.
  - [ ] 어드민 3인 모두 카드 수신 없이 24h 경과하면 `heartbeat.missing` 이벤트가 기록되어 별도 감사 로그로 적재된다.
  - [ ] Telegram 실패 시에도 `/admin` durable event + unread badge가 catch-up한다(M15 D10 72차 재정의 재사용).

- **DoD**:
  - [ ] 장 운영일 자정 배치 성공 시 "오늘 이상 없음" 카드가 텔레그램 + `/admin` 웹 알림 2-layer에 무조건 발송된다.
  - [ ] 배치 실패·파이프라인 Critical 시 "적색 경보" 카드로 전환되어 동일 2-layer에 발송된다.
  - [ ] 카드 내용에 일자·파이프라인 성공률·AI 비용·Exit 시그널 건수·수신 확인 링크가 포함된다.
  - [ ] Telegram 실패 시에도 `/admin` durable event + unread badge가 catch-up하고, 24h 전원 미확인 시 `heartbeat.missing`이 기록된다.
  - [ ] `npm run build` + `npm run lint` 통과.

**확장 후보 (Should/Nice)**:
- S18 비용 최적화 시뮬레이터: 프롬프트 압축·Sector Board 샘플링 축소 시 예상 비용을 시뮬레이션. M17 위 레이어. → Should, B3 이후.
- S19 파이프라인 SLA 리포트: 월간 파이프라인 SLA 요약 PDF. → Should.
- N3 하트비트 히스토리 캘린더 뷰: 12개월 Silent Health 이력 캘린더. → Nice.

---

### §3.13 자동매매 프레임 (S8, 2026-04-21 D16 신설)

> **본 섹션은 개요·경계만**. 요구사항(R3.13-x)·Tasks·DoD 상세는 `Document/Build/Slices/S8-AutoTrading.md`. 본 섹션 변경 시 슬라이스 파일도 동시 갱신.

**기능 설명**: 어드민이 가상 포트(레이어 A)를 실제 자금으로 옮겨 담는 집행 서브시스템(§1A.0 경로 2). 주식(KIS) + 코인(바이낸스 USDT-M 선물)을 모두 포함한다. "**Strategy 파일 drop-in + AI 어댑터 embed**" 이중 경로 설계로, AI agent·skill 본체는 어드민이 추후 교체 가능하도록 인터페이스만 박제한다.

**핵심 범위 (S8)**:

| 축 | 내용 |
|---|---|
| **자산군** | 주식(KIS 국내·모의↔실계좌) · 코인(바이낸스 USDT-M 선물·테스트넷↔메인넷) |
| **대상 종목 스코프** | Short List 30 / 자유 종목 (어드민 임의 추가) / 바이낸스 선물 종목 — UI에서 **선택 가능** |
| **의사결정 경로** | (1) Strategy 파일 drop-in · (2) AI 어댑터 embed — 둘 다 기본 제공 (AI 본체는 추후) |
| **리스크 가드레일 (기본값)** | 레버리지 ≤ 5x · 일일 손실 -3% 자동 정지 · AI 일 주문 횟수 ≤ 20회 — `/admin/settings/risk`에서 조정 |
| **체결 모드** | 모의(KIS 모의투자 / 바이낸스 테스트넷) → 실(실계좌 / 메인넷) · 사용자 명시 토글로만 전환 |
| **로그** | 주문 큐 · 체결 이력 · 포지션 · 미실현 PnL · (코인) 청산가 · 펀딩비 |
| **신규 엔티티** | E12 ExchangeConnection(코인) · E13 OrderQueue · E14 TradeExecution · E15 RiskPolicy (S8에서 마이그레이션 0009+) |
| **라우트** | §2 "S8 자동매매 추가 라우트" 표 참조 (6종) |

**요구사항 요약 (상세 R번호는 S8 슬라이스 파일)**:

- (1) 모의↔실 체결 토글은 **대표 1인만** 전환 가능(Q3 추천 유지). 나머지 2인은 읽기/모의까지만.
- (2) 주식 자동매매는 AI 가상 포트 Accept 종목에 자동 반영하는 옵션 외, 자유 종목 수동 추가도 허용.
- (3) 바이낸스 선물은 `SYMBOL` 입력 기반(예: BTCUSDT·ETHUSDT). 공매도/롱숏 양방향 허용. 레버리지·SL/TP 필수 입력.
- (4) Strategy 파일은 `src/lib/trading/strategies/{stock,crypto}/*.ts`에 drop-in. 공통 타입(`TradingStrategy`)을 구현하면 자동 인식. 각 파일 활성/비활성 토글.
- (5) AI 어댑터(`decideOrder(state) → OrderPlan`)는 빈 인터페이스로 박아두고, Anthropic SDK wrapper 연결은 Policy Engine 아래 `src/lib/trading/ai/`에 둔다. 본체 함수는 throw(`not-embedded`) 기본, 어드민이 skill/agent 파일 drop-in.
- (6) Policy Engine은 주문 생성 직전 최종 가드: 가드레일 초과 주문은 drop + `RiskViolationEvent` 기록.
- (7) Q16 법무·Q17 약관은 어드민 내부 도구 단계에서 불필요. Deferred-D 재개 시 재검토.

**AI 역할 경계 (§1.5 보강과 정합)**:
- AI는 Strategy·어댑터 **둘 중 하나**를 통해 주문 plan을 제안. 최종 실행 전 Policy Engine 가드 필수.
- 어드민이 수동 override 가능: 모든 AI 제안 주문은 `requires_confirmation` 플래그로 dry-run 기본 → 어드민 승인 후 체결(대표 선택 시 자동 실행 모드 활성 가능).

**DoD (슬라이스 수준 요약)**:
- [ ] 6개 라우트 렌더 + `npm run build` 통과
- [ ] Strategy drop-in 규약 문서 + 샘플 전략 2건(주식 1 + 코인 1) mock 체결까지 동작
- [ ] AI 어댑터 인터페이스 + 빈 훅(`throw`) + Anthropic SDK wrapper 연결 위치만 스텁
- [ ] Policy Engine 기본값 테스트 (`test:ci` 케이스 추가)
- [ ] 모의↔실 토글 대표 1인 권한 가드 동작

**확장 후보 (S8 이후)**:
- Strategy 백테스트 러너(`/admin/trading/backtest`)
- 포지션 상관관계·섹터 집중도 경고
- 옵션·현물 코인 확장

---

## 4. 데이터 모델·연동

> **P4.1 본문화 완료 (2026-04-15)**. 원자료: `.omc/research/quant-data-architecture.md` (16 엔티티 카탈로그 + 5 ADR). Supabase 스키마 상세·인덱스·RLS 정책은 BuildPhase B2.2에서 확정.

### §4.1 외부 데이터 소스

| 소스 | 용도 | 갱신 | Stage 1 포함 |
|---|---|---|---|
| **pykrx** (`krx.get_market_ohlcv`) | OHLCV 일별 가격 데이터 | EOD(장 마감 후) | ✅ |
| **pykrx** (`krx.get_market_cap`) | 유니버스 구성 (KOSPI top25 + KOSDAQ top15 ≈ 40종목) | 분기 | ✅ |
| **한국투자증권 API** | 장중 실시간 가격 스트림 (상시 모니터링 모드 전용) | 실시간 | ✅ (상시 모드) |
| **DART** | 재무 데이터 (PER/PBR/ROE, 리포트 Section 2·3) | 분기·수시 | ✅ |
| **뉴스 벤더** | 종목별 뉴스·공시 (M12a AI 페르소나 입력) | 이벤트 드리븐 | ✅ |
| KRX 경제 캘린더 | FOMC·CPI 등 거시 이벤트 일정 | 주간 | Should (S9) |

> 실데이터 연결 구현은 BuildPhase B3.2. Stage 1 개발 중 모든 소스는 `tudal/src/lib/data/mock-*.ts` mock으로 대체.

---

### §4.2 핵심 엔티티 (서비스 기획 뷰)

어드민 서비스 기능과 직결되는 8개 엔티티. 전체 16 엔티티 상세는 `quant-data-architecture.md §Data Entity Catalog` 참조.

#### E1. ShortList30 (월간 Short List)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| month | date | 해당 월 (YYYY-MM-01) |
| ticker | varchar | 종목 코드 |
| bucket | enum | short / mid / long |
| rank | int | 버킷 내 순위 (1~10) |
| composite_score | numeric | 5-Signal Composite (0~100) |
| trend_score | numeric | 추세 축 점수 |
| momentum_score | numeric | 모멘텀 축 점수 |
| volatility_score | numeric | 변동성 축 점수 |
| signal_label | text | 단문 신호 텍스트 |
| delta_status | enum | new / hold / removed |
| delta_reason | text | 변동 사유 1~2줄 |
| summary_3line | text | 선정 근거 3줄 요약 (M6) |
| suggested_weight | numeric | AI 제안 비중 (%) |
| created_at | timestamptz | 배치 생성 시각 |
| name | text NULL | 종목명 (mig 0012). nullable additive. Tier0 fallback = Python seed 채움. **(64차 PR #84)** Tier1 AI 선정 경로(`upsertShortList30`)도 `tier0_candidates_150`에서 best-effort lookup으로 name carry (sector/composite_score/signal_label 동반) — 신규 선정 ticker 빈 카드 방지. |
| sector | text NULL | canonical 14 sector 중 하나 (mig 0012). nullable additive. canonical 결정성 = `canonical-sectors.ts` SoT. |
| sub_tags | jsonb NULL | **D21 (52차, mig 0018)** 신규. 운영 UI taxonomy sub_tags (조선·방산·화학·게임·가전·제약·부동산 등). canonical sector는 sector 컬럼 (primary), sub_tags는 secondary descriptors. NULL 허용 첫 단계 — Tier 2 impl PR이 backfill 정책 결정. GIN index `short_list_30_sub_tags_gin_idx`. |

**갱신 주기**: **65차 Q1** — 단기 bucket = 주1회 갱신 · 중장기(중기/장기) bucket = 월1회 갱신. bucket 컬럼별로 갱신주기 상이 (기존 '월 1회 단일배치, 매월 1일 09:00 KST'는 stale — HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조). **관계**: StockReport(1:1, 같은 ticker+month), PortfolioSnapshot(N:1, 같은 month).

**현재 상태 vs 정정 후 박제 (D23, 53차 §5 Group B mismatch 정정)**:

| 시점 | 30 rows 산출 방식 | 마이그 | Tier 1 AI 호출 | 박제 SoT |
|---|---|---|---|---|
| **현재 (production, 73차~)** | **Tier 1 AI 30 선정** (메인 path 가동 — `short_list_30` 2026-06-01 = 실 AI 30, consensus_badge/ai_score populated 🟣20/🟢7/🟡2/🔵1) | 0001~0037 전부 applied | **실 호출 완료**(73차 풀 P3, cost_log 2026-06 ₩24,655) | 73차 PR #109 (`179d745`) |
| ~~과거 fallback~~ | ~~Tier 0 단독 30 직선정~~ (AI 키 미발급 시에만 — 45차~64차 당시 production) | 0002+0012+0018 | 0 호출 | T7e.8 (45차) + D23 (53차 §5) — **73차 supersede** |

**중요 (64차 supersede)**: "AI 키 미발급 fallback = Tier 0 단독" 어휘 (D19 (g) 원본)는 **D23 (53차 §5)에서 fallback으로 명확화**됨. **메인 path(Tier 1 AI 30 선정) 엔진/청크 워커는 빌드 ✅ 완료** (PR2 + PR-E 0029 + 선정 청크 워커 PR #82 + PR #84 metadata carry) — 실 가동 = **PR-G ⓑ** (USER 마이그 0031 apply + `SELECTION_CRON_AUTO_ENABLED=true` + Anthropic 키 + 비용 게이트). "PR2 후속 implementation" 표기는 supersede.

**65차 supersede**: PR-G ⓑ(150×11 opus 단발선정)는 W0~W3로 superseded(코드자산 재사용). 메인 path = Tier 0 → Tier 1 멀티라운드 토론 loop(Q4) → AI 자율 30구성(Q2), 선정주기 단기주1회/중장기월1회(Q1), 멀티프로바이더(Q3). 'Tier 1 AI 30 선정' 어휘의 '30'은 분석 풀이며 실제 편입은 AI 자율 N≤30. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)

**73차 supersede (2026-06-09)**: 위 "실 가동 = PR-G ⓑ" / "0 호출" 표기는 **풀 P3 실행으로 메인 path(실 AI 30 선정) 가동 완료**되며 supersede됨 — production `short_list_30` 2026-06-01 = 실 AI 30. **77차 D30 (2026-06-12)**: Tier 0 스코어링(150 후보 산출)은 예측력 미검증·구조적 retrieval 실패(실증: 대형 주도주 10/11 누락) → "B++ (size-sleeve recall-first) + 삼중 게이트" 채택(B+ 단독 REJECT, 구현 다음 세션, SoT spec `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md`); 삼중 게이트 통과 전 후보를 "향후 상승 예측"으로 제시 금지.

---

#### E2. StockReport (종목 풀 리포트)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| ticker | varchar | 종목 코드 |
| month | date | 보고서 기준 월 |
| version | int | 재생성 시 증가 (1부터) |
| schema_version | int | 스키마 버전 (NOT NULL DEFAULT 1, P5 I-07) |
| is_latest | boolean | 동일 (month, ticker) 내 최신 1건만 true (P5 I-07) |
| section_0 | jsonb | 투자 요약 + Conviction 게이지 + 투심위 미니바 |
| section_1 | jsonb | 기업 개요 |
| section_2 | jsonb | 재무 분석 |
| section_3 | jsonb | 밸류에이션 |
| section_4 | jsonb | 성장성 |
| section_5 | jsonb | 리스크 |
| section_6 | jsonb | 모멘텀 (5-Signal + 3축 출력 포함) |
| section_7 | jsonb | Exit 조건 |
| section_8 | jsonb | 최종 의견 + 투심위 투표 요약 (M3) — canonical contract: **§4.2.1** |
| appendix | jsonb | 부록 |
| regen_auto_count | int | 자동 재분석 사용 횟수 (월간, 상한 1) |
| regen_manual_count | int | 수동 재생성 사용 횟수 (월간, 상한 2) |
| generated_at | timestamptz | 생성 시각 |
| consensus_badge | text NULL | 합의 배지 5종 enum: **저장값 = emoji literal** `🟢 / 🔵 / 🟣 / 🟡 / ⚪` (labels: 🟢=strong/🔵=numeric/🟣=ai/🟡=wait/⚪=pending). **v1.6 (49차)** 신규. 마이그 0017 check constraint: `consensus_badge in ('🟢','🔵','🟣','🟡','⚪')`. Legacy nullable (backward compat); S7a 신규 row는 RPC가 NOT NULL 강제 (commit_persona_eval / commit_badge_only RPC body). UI 표시: NULL → ⚪ fallback 렌더 (Plan R3 BLOCKER 7). 코드 SoT: `tudal/src/lib/screening/consensus.ts` (`ConsensusBadge` type union 5 emoji literals). |

**갱신 주기**: 선정주기 연동 — 단기 종목 리포트 = 주1회, 중장기 = 월1회 (65차 Q1, 기존 '월 1회 배치'는 stale — HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조). + 재생성 시 version 증가. **관계**: ShortList30(1:1), CommitteeVote(1:N).

**인덱스 메모 (P5 I-07)**: section_* jsonb 필드에 **GIN 인덱스**(BuildPhase B2.3에서 확정) — 특정 지표 검색·Full-Text 쿼리용. **version 정책**: 동일 (month, ticker) 내 최신 1건만 `is_latest=true`, 이전 version은 이력 보존하며 `is_latest=false`.

---

##### §4.2.1 stock_reports.section_8 jsonb canonical contract (v1.6, 49차 신설)

> **SoT**: 본 항목은 `stock_reports.section_8` jsonb 컬럼의 canonical shape를 박제한다. **실제 zod schema = `tudal/src/lib/report/section-8-schema.ts`** (런타임 검증). 변경 시 본 문서와 코드 동기 갱신 (Q3 omxy 합의).

**canonical JSON shape** (요약):

```jsonc
{
  "partA": [ /* sectorVoteRow × (0 or 14) */ ],
  "partB": [ /* issueDebateExcerpt × 3~5 */ ],
  "partC": {
    "sector_aggregate": { "buy": number, "hold": number, "sell": number },
    "core_revote":       { "buy": number, "hold": number, "sell": number },
    "co_chair_unanimous": boolean,
    "verdict": "BUY" | "HOLD" | "SELL",
    "rationale": [ string ] // length 1~5
  },
  "partD": [ /* coreVoteRow × 11 */ ]
}
```

**필드 의미 표**:

| 필드 | 타입 | 필수 | 길이 | 의미 / 활성 조건 |
|---|---|---|---|---|
| `partA` | array(sectorVoteRow) | **required (property 자체)** | **0 또는 14** | Sector Board 위원별 한 줄 의견 표. **property는 항상 present** (zod schema `partA: z.array(...).refine(len === 0 || len === 14)`). 값으로 분기: **본 PR 범위 B** = `[]` (length 0, Tier 2 deferred). Tier 2 활성 시 = length 14 (해당 종목 섹터 14명 전원). **1~13은 invalid** (R3.7-7 ①, omxy R1 BLOCKER 2). **D21 (52차) 주석**: `14` = canonical 14 sectors × 14 personas/sector overlay 적용 후 fixed 활성화 수. slot 모델 = 10 base + 2 primary overlay + 2 sub_tag overlay. canonical 14 SoT = `Service/Report/ReportFramework.md §7.2/§7.3` + 코드 SoT = `tudal/src/lib/screening/canonical-sectors.ts`. |
| `partB` | array(issueDebateExcerpt) | required | 3~5 | 쟁점별 찬반 토론 인용 (찬성·반대·중재). R3.7-7 ③. |
| `partC` | object | required | — | 최종 합의 패널: sector_aggregate + core_revote + co_chair_unanimous + verdict + rationale(1~5줄). R3.7-7 ④. |
| `partD` | array(coreVoteRow) | required | **정확히 11** | Core 11 위원별 한 줄 의견 표. R3.7-7 ②. |

**vote 매핑 (writer ↔ DB)**:
- `section_8.partD[*].vote` (writer 산출물) = `BUY` / `HOLD` / `SELL` (3-way).
- DB 저장 시 `commit_persona_eval` RPC가 case 매핑: `BUY` → `approve` / `HOLD` → `abstain` / `SELL` → `reject` — `committee_votes.vote` check constraint(approve/reject/abstain) 호환. 매핑 책임 = RPC 내부 (마이그 0017).

**semantic constraints**:
- `partA.length ∈ {0, 14}` (부분 활성 금지 — 1~13 invalid).
- `partB.length ∈ [3, 5]`.
- `partC.rationale.length ∈ [1, 5]`.
- `partD.length === 11` (정확히).
- 모든 `vote` enum = `BUY | HOLD | SELL` (writer 레이어 표준; DB persist 시 RPC가 매핑).

---

#### E3. CommitteeVote (투심위 투표 기록)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| report_id | uuid | FK → StockReport |
| persona_id | varchar | 위원 식별자 (Core 11 + Sector board) |
| persona_layer | enum | core / sector |
| sector | varchar | 섹터 코드 (sector layer만) |
| vote | enum | approve / reject / abstain |
| argument_excerpt | text | 핵심 논거 인용 (M3 표시용) |
| created_at | timestamptz | 투표 기록 시각 |

**갱신 주기**: StockReport 생성 시 동기 생성. **관계**: StockReport(N:1).

---

#### E4. PortfolioApproval (승인 이벤트)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| month | date | 승인 대상 월 |
| admin_id | uuid | 승인 어드민 계정 ID |
| approval_type | enum | accept / reject |
| approved_at | timestamptz | 승인 확정 타임스탬프 (= 승인가 기준) |
| is_final | boolean | 확정 승인 여부 (선착순 1건만 true) |
| prev_portfolio_held | boolean | 전월 포트 유지 여부 (Reject 2차 또는 D+5 초과) |
| shortlist_generated_at | timestamptz | Short List 생성 시각 (FK 참조). **D15 R3.3-7 24h Holding 계산 기준** |
| dispute_raised_at | timestamptz NULL | 이의 제기 시각 (B·C 어드민). **D15 R3.3-10 48h 추가 Hold 기준** |
| dispute_raised_by | uuid NULL | 이의 제기 어드민 ID (v1.3, BL-7 A) |
| dispute_reason | text NULL | 이의 사유 자유 텍스트. DB constraint `length >= 20` (앱에서 `trim().length` 선검증). **v1.3 BL-7 A** |
| dispute_resolved_at | timestamptz NULL | 이의 해결 시각 (제기자 액션). dispute_raised_at + 48h 또는 dispute_resolved_at 중 먼저 도래 시 Hold 해제 |
| gating_auto_relief_active | boolean | 7일 연속 단일 admin_id 접속 감지 시 D15 2인 게이팅 자동 바이패스 활성 플래그 (v1.3, BL-20 A). AlertEvent `gating_auto_relief`와 매칭 |
| reanalysis_count | int | Reject 후 재분석 큐 진입 횟수 (상한 1). 재분석본 Reject 시 `prev_portfolio_held=true` + CAP Months 미포함 (v1.3, T3.4) |

> **v1.3 (S3 완료, 2026-04-17)**: (1) **BL-7 A**: `dispute_reason` 자유 텍스트(min 20자) + `dispute_raised_by` 추가. DB constraint `portfolio_approval_dispute_reason_min_len` (0004 §1)로 이중 가드. (2) **BL-20 A**: `gating_auto_relief_active` 추가. 7일 연속 단일 접속 감지 시 자동 바이패스. (3) **T3.4**: `reanalysis_count` 추가(≤1). Reject → 재분석 큐 stub.
>
> **v1.2 (S2 [G-5] 해소, 2026-04-17)**: `report_view_count` 필드 **삭제**. 2인 열람 게이팅은 E10 ReportViewLog 테이블에서 `COUNT(DISTINCT admin_id)` 집계로 대체. 사유: int 캐시는 1인 2회 열람을 2인으로 오판하는 버그 위험. E4는 월 1회 승인 이벤트에 단일 책임을 갖도록 정리.

**갱신 주기**: 어드민 승인 액션 시. **관계**: PortfolioSnapshot(1:N, 해당 month), ReportViewLog(게이팅 판정 시 읽기, FK 없음).

**유니크 제약 (P5 I-08)**: `UNIQUE (month) WHERE is_final=true` — 월당 확정 승인 1건만 허용. 선착순 race condition 방어(BuildPhase B3에서 DB 제약 + 낙관적 락 병행). **v1.1 D15 반영**: 유니크 제약은 변경 없음. Holding Period·2인 게이팅·이의 48h는 애플리케이션 레이어 가드(Accept 버튼 disabled + API 사전 검증)로 구현.

---

#### E5. PortfolioSnapshot (가상 포트 일별 스냅샷)

> **D11 박제**: 본 엔티티는 AI 가상 포트폴리오 트래킹 전용이며, 어드민의 **실제 증권사 계좌 포지션과 별개**의 가상 트래킹이다. 실제 체결 레이어는 E9 BrokerageConnection으로 분리(§1A.0 3경로 실행 모델).


| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| date | date | 스냅샷 날짜 |
| month | date | 포트폴리오 기준 월 |
| ticker | varchar | 종목 코드 (null = 포트 전체 행) |
| entry_price | numeric | 승인가 (종가 기준) |
| current_price | numeric | 당일 종가 |
| weight | numeric | AI 제안 비중 (%) |
| is_cash | boolean | 현금 항목 여부 |
| daily_return | numeric | 당일 수익률 |
| total_return | numeric | 승인가 대비 누적 수익률 |
| kospi_return | numeric | KOSPI 동기간 수익률 |
| alpha | numeric | total_return − kospi_return |
| sharpe | numeric | 누적 Sharpe Ratio |

**갱신 주기**: EOD 배치 (매일 장 마감 후). `portfolio.daily_snapshot` 이벤트와 1:1 매핑. **관계**: PortfolioApproval(N:1, 같은 month).

**entry_price 재계산 정책 (P5 I-09)**: `entry_price = PortfolioApproval.approved_at 당일 종가`. Reject → 재분석 → Accept 경로도 **최종 Accept 시점**의 당일 종가 기준으로 재계산한다(최초 Reject 시점 아님).

---

#### E6. AlertEvent (알림 이벤트)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| alert_type | enum | exit_signal / news_critical / price_anomaly / briefing / scheduler_fail / **gating_auto_relief** (v1.3, S3 BL-20 A) |
| ticker | varchar | 관련 종목 (없으면 null) |
| severity | enum | critical / warning / info |
| trigger_reason | text | 발동 이유 1줄 |
| signal_sent_at | timestamptz | 발송 시각 |
| outcome_at | timestamptz | T+7일 결과 적재 시각 (exit_signal만) |
| t7_price_change | numeric | T+7일 가격 변화율 (exit_signal만, IM-3 입력) |
| decision_recorded | enum | sell_all / partial_sell / hold / null | 
| decision_memo | text | 어드민 결정 메모 |
| is_read | boolean | 어드민 열람 여부 |

**갱신 주기**: 이벤트 드리븐 (실시간). T+7일 outcome은 배치로 자동 적재. **관계**: StockReport(N:1, ticker+month 기준).

---

#### E7. BriefingLog (모닝 브리핑 발송 기록)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| date | date | 브리핑 날짜 |
| content_summary | text | 발송 내용 요약 (3~5줄) |
| generated_at | timestamptz | 생성 시각 |
| sent_channels | jsonb | 발송 채널 목록 (telegram/dashboard) |
| view_events | jsonb | 열람 이벤트 배열 (admin_id·channel·viewed_at), IM-4 측정용 |
| generation_failed | boolean | 생성 실패 여부 |

**갱신 주기**: 매일 08:00 KST 배치. **관계**: AlertEvent(1:N, 해당 날짜 News·Anomaly 이벤트 참조).

---

#### E8. RegenCounter (재생성 카운터)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| ticker | varchar | 종목 코드 |
| month | date | 기준 월 |
| auto_count | int | 자동 재분석 사용 횟수 (상한 1) |
| manual_count | int | 수동 재생성 사용 횟수 (상한 2) |
| reset_at | timestamptz | 다음 리셋 예정 시각 (매월 1일 00:00 KST) |

**갱신 주기**: 재생성 액션 시 증가, 매월 1일 리셋. **관계**: StockReport(N:1, ticker+month).

---

#### E9. BrokerageConnection (어드민 증권사/거래소 API 연결, D12 신설)

> **P5 D12 박제**: §1A.0 3경로 실행 모델 중 (2) 매뉴얼 트레이딩 · (3) 자동매매 서브시스템의 실제 체결 레이어. 가상 포트(E5)와 분리된 실계좌 연결 정보.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| admin_id | uuid | FK → 어드민 계정 (E6 AlertEvent의 admin_id 참조 대상과 동일 테이블) |
| broker | enum | KIS · Kiwoom · Samsung · KB · Mirae · Upbit · Binance · ... |
| account_no | varchar | 계좌번호 (평문 저장 · UI에서 마스킹, 예: `12345678-**`) |
| ~~api_key_ref~~ | ~~text~~ | **⚠️ DQ-7(2026-04-22)에서 폐기** — app-layer AES-256-GCM 암호화 컬럼 6개(`ciphertext_app_key·iv_app_key·auth_tag_app_key` + `ciphertext_app_secret·iv_app_secret·auth_tag_app_secret`)로 교체. 상세: `Slices/DQ7-Credentials.md §4.2` |
| mock_mode | boolean | DQ-7 신설 · KIS 모의투자(true)/실계좌(false). 실계좌 저장은 대표 1인만 허용 |
| strategy_label | varchar | 전략 라벨 — "단기 모멘텀", "장기 가치" 등 자유 텍스트 |
| scope | enum | manual · auto · both |
| is_active | boolean | 활성 여부 |
| created_at | timestamptz | 등록 시각 |
| last_used_at | timestamptz | 마지막 사용 시각 |

**제약**: `UNIQUE (admin_id, broker, account_no, strategy_label)` — **동일 증권사라도 전략별 복수 앱키 등록 허용** (1:N). **갱신 주기**: 어드민 등록·수정 액션 시. **관계**: Admin(N:1). E5 PortfolioSnapshot과는 **직접 관계 없음**(가상 트래킹과 분리).

---

#### E10. ReportViewLog (리포트 열람 로그, S2 G-5 옵션 B 신설)

> **2026-04-17 S2 [G-5] 옵션 B 해소**: D15 R3.3-8 2인 열람 게이팅을 E4 `report_view_count` int 캐시 대신 본 테이블의 `COUNT(DISTINCT admin_id)` 집계로 판정한다. 1인 2회 재진입이 게이팅 통과하는 버그를 배제. 감사 로그·참여율 분석 등 후속 지표(IM-1·IM-4)의 데이터 소스로도 재사용.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| admin_id | uuid | 열람 어드민 계정 ID |
| report_id | uuid | FK → StockReport (E2) |
| view_date | date | 열람 날짜 (KST 기준, UNIQUE 제약용) |
| viewed_at | timestamptz | 실제 진입 시각 |

**제약**: `UNIQUE (admin_id, report_id, view_date)` — 동일 어드민·동일 리포트 하루 내 재진입은 INSERT 시 onConflict do nothing. 2026-04-17 **BL-5 옵션 B** 해소 반영 (1일 1회 dedupe).

**갱신 주기**: 어드민이 `/admin/report/[ticker]` 진입 시 INSERT. **관계**: StockReport(N:1). E4 PortfolioApproval과는 **직접 FK 없음** — 게이팅 판정 시 집계 조회만([G-11] 자동 해소).

**RLS**: admin-only INSERT/SELECT (is_admin()). service_role 예외.

---

#### E11. KrBusinessDays (한국 영업일 캘린더, S3 BL-19 옵션 D 신설)

> **2026-04-17 S3 [BL-19] 옵션 D 해소**: D+5 영업일 카운터 + D15 R3.3-9 연휴 우회 계산의 단일 정본. pykrx 매 호출 대신 Supabase 캐시 테이블로 중앙화. 초기 seed는 0004 마이그레이션 수기 UPDATE(2024·2025·2026). 2027~2030은 S5 M10 월간 배치(`scripts/seed_kr_holidays.py`, venv + pykrx)가 덮어씀. 임시공휴일은 정부 발표 후 수기 또는 배치로 갱신.

| 필드 | 타입 | 설명 |
|---|---|---|
| date | date | PK — 모든 날짜 1행 |
| is_business_day | boolean | 개장일 여부 (주말·공휴일·임시휴장 false) |
| holiday_name | text NULL | 공휴일 명칭 (예: '설날', '대체공휴일(광복절)', '연말 휴장'). 평일·주말은 NULL |

**인덱스**: `(date) WHERE is_business_day = true` 부분 인덱스 — D+5 카운터 범위 스캔 최적화.

**갱신 주기**: 초기 seed 1회 + S5 M10 월간 배치 + 임시공휴일 발표 시 수기 UPDATE.
**관계**: PortfolioApproval(간접 — `shortlist_generated_at` 기준 영업일 계산 소스). 직접 FK 없음.

**RLS**: admin-only SELECT (is_admin()). 쓰기는 service_role (배치 스크립트·seed 마이그레이션).

**v1.3 반영**: E4 R3.3-9 "24h vs D+4 영업일 중 늦은 쪽 만료" 판정 소스. `src/lib/portfolio/business-days.ts`의 순수 함수 `addBusinessDays·countBusinessDaysBetween`이 본 테이블을 입력으로 받음.

---

### §4.3 엔티티 관계 요약

```
ShortList30 (month+ticker)
  ├─ 1:1 ─ StockReport (month+ticker, version 관리)
  │          ├─ 1:N ─ CommitteeVote (투심위 투표 기록)
  │          └─ 1:N ─ ReportViewLog (E10, 어드민 열람 로그 · D15 2인 게이팅 소스)
  └─ N:1 ─ PortfolioApproval (month 기준 승인 이벤트)
              └─ 1:N ─ PortfolioSnapshot (일별, NSM·alpha·Sharpe 계산)

AlertEvent (이벤트 드리븐)
  ├─ exit_signal → outcome T+7 자동 적재 (IM-3)
  └─ 참조: StockReport §7 Exit 조건

BriefingLog (일별 배치)
  └─ view_events → IM-4 모닝 브리핑 참여율

RegenCounter (ticker+month)
  └─ auto_count ≤1, manual_count ≤2 (D8 cap 가드)

BrokerageConnection (admin+broker+account+strategy, D12)
  └─ §1A.0 경로 (2)(3) 실제 체결 레이어. 가상 포트(E5)와 분리.
```

---

### §4.4 갱신 주기 요약

| 주기 | 대상 엔티티 | 트리거 |
|---|---|---|
| **주 1회 배치** (65차 Q1) | ShortList30(단기 bucket) · StockReport(단기) | 단기 선정 스케줄러 자동 실행 |
| **월 1회 배치** (65차 Q1) | ShortList30(중장기 bucket) · StockReport(중장기) · CommitteeVote | 중장기 선정 스케줄러 자동 실행 |
| **EOD 배치** (매일 장 마감 후) | PortfolioSnapshot · TechnicalIndicators · EarlyWarningState | pykrx EOD 데이터 수신 후 |
| **실시간 스트림** (상시 모니터링 모드) | AlertEvent(price_anomaly) | 한투 API 이벤트 |
| **이벤트 드리븐** | AlertEvent(exit_signal · news_critical · scheduler_fail) | 분류기·시그널 엔진 트리거 |
| **어드민 액션** | PortfolioApproval · RegenCounter · AlertEvent(decision) | 어드민 UI 인터랙션 |
| **T+7일 배치** | AlertEvent(outcome) | exit_signal 발송 후 7일 경과 |
| **분기** | UniverseSnapshot (유니버스 구성) | pykrx market_cap 조회 |

---

### §4.5 데이터 저장 및 접근 제약

- **저장소**: Supabase (PostgreSQL). BuildPhase B2.2에서 env 세팅 및 스키마 마이그레이션.
- **접근 격리**: Supabase RLS(Row Level Security)로 어드민 계정만 모든 엔티티 접근 허용. 멤버 계정은 ShortList30·StockReport·CommitteeVote 접근 차단. (→ ServicePlan.md §3 공통 원칙, §6 멤버 연결점).
- **서버 컴포넌트 접근**: Next.js Server Actions를 통해 Supabase에 접근. 클라이언트 직접 접근 금지.
- **mock → 실데이터 전환**: 현재 `tudal/src/lib/data/mock-*.ts`가 모든 데이터 소스. 실데이터 연결은 BuildPhase B3.2. 전환 시 엔티티 타입(`tudal/src/types/`)과 mock 구조를 기준으로 Supabase 스키마 정합성 검증 필요.
- **E9 BrokerageConnection 시크릿 정책 (D12 P5 + DQ-7 갱신, 2026-04-22)**: ~~api_key_ref Vault 참조~~ → **app-layer AES-256-GCM** 암호화 컬럼 6개(`ciphertext·iv·auth_tag × 2`)로 구현. MEK는 Vercel env `API_CRED_MASTER_KEY` (32-byte hex). 로컬 dev와 Vercel이 같은 Supabase 공유하므로 MEK 동일 유지 필수. 본인 admin_id만 접근 RLS + `is_admin()` 이중 가드. 로테이션 스크립트: `scripts/rotate-cred-mek.ts --old <hex> --new <hex> [--dry-run]` (단일 트랜잭션 전수 re-encrypt). `last_used_at`는 S8 test-connection 성공 시 UPDATE. 상세: `Slices/DQ7-Credentials.md §3·§4`.
- **E12 ExchangeConnection 시크릿 정책 (DQ-7 신설, 2026-04-22)**: Binance USDT-M 선물용. E9와 동일 AES-256-GCM 패턴 + `testnet_mode boolean`. `UNIQUE(admin_id, exchange, label)`로 같은 어드민이 "main-futures" · "sub-account" 등 복수 등록 가능.

---

## 5. 제약

- 공통 원칙 → `ServicePlan.md §3` 참조
- **어드민 고유 제약**:
  - Short List·풀 리포트는 멤버에 노출하지 않음 (BusinessPlan §10.2)
  - **면책 완화 (2026-04-15 확정)**: 어드민 전용이므로 AI가 포트폴리오 **비중까지 결정·추천** 가능. "매수/매도 추천 금지" 원칙은 **멤버·외부 노출 한정**. 어드민 내부 도구에서는 AI가 종목별 비중·현금 비율·재조정 제안까지 제공. **65차 Q2 supersede**: AI가 포트폴리오 전체를 자율 구성 (운용여부·편입개수·종목선택·단중장분배·비중·현금0~30%). '비중까지'가 상한처럼 읽히나, AI 자율 범위는 편입개수·종목선택까지 확대. (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조)
  - 긴급 알림 수신자 = 어드민 3명 (§1.1 참조, 10차 결정)

---

## 6. 멤버 연결점

> **P5 D13 박제 (2026-04-15)**: 멤버는 **법적 문제 없는 리서치 웹페이지 수준으로 축소**. 어드민 3명 전용 운영 중심. 멤버 서비스 상세 재정의는 `ServicePlan-Member.md` 별도 문서에서 처리(본 문서 범위 외).

> 어드민 서비스와 멤버 서비스가 만나는 지점. 기획·빌드 중 발견될 때마다 양쪽 sub-doc에 동시 기록.

| 연결 지점 | 어드민 측 | 멤버 측 | 공통 SoT |
|---|---|---|---|
| 인증·세션 | `/admin/*` role guard | `/(auth)/*` 초대 코드 | Supabase 미들웨어 (ServicePlan.md §3) |
| 디자인 시스템 | shadcn base-nova + 주픽 토큰 | 동일 | ServicePlan.md §3 |
| 데이터 격리 | Short List·리포트 접근 가능 | RLS로 차단 | Supabase RLS 정책 |
| 면책 Footer | 전 페이지 고정 | 전 페이지 고정 | BusinessPlan §7 |

> 기획 진행하며 행 추가. 빈 칸은 미확정.

---

## 7. Confirmation 로그

| 날짜 | 확정 항목 | 방법 | 링크 |
|---|---|---|---|
| 2026-04-15 | 문서 스켈레톤 신설 | 사용자 지시 (기획 분리) | HANDOFF 2026-04-15 |
| 2026-04-15 | §1 사용자·JTBD·스코프 전체 확정 (§1.1~§1.7) | P0 Task 0.1 brainstorming → 사용자 승인 | `docs/superpowers/specs/2026-04-15-admin-scope-jtbd-design.md` |
| 2026-04-15 | Task 0.2 문서 동기화 4건 완료 | 직접 Write | HANDOFF.md Task 0.2 |
| 2026-04-15 | §1A 전략 골격 확정 (P2 Task 2.1~2.5) | PM 스킬 5종 병렬 실행 → 정리 세션에서 중복·과잉 판정, 고유 가치만 §1A에 흡수·SoT 단일화 | ServicePlan-Admin.md §1A |
| 2026-04-15 | Phase P3~P8 재정비 (감사 3건 종합) | 삭제 2·병합 1·번호 재배치·Output 라우팅 치환·스코프 조정 9·병렬 지도 추가 | Phase.md + HANDOFF.md + 본 트래커 동기화 |
| 2026-04-15 | P3 재축소 (9차) | 구 3.2 가정 대장·구 3.3 OST 삭제 → Pre-P3 사용자 Q&A로 대체. P3 4→2 태스크(3.1 Must + 3.2 IA). 근거: 어드민 2~3명 자금 프로젝트 특성상 DVF 매트릭스·시각화 청중 불명확 | Phase.md P3 섹션 + HANDOFF.md |
| 2026-04-15 | **P3.0 Pre-P3 Q&A 완료** (10차) — 9개 결정 + 보류 1건 | D1 Reject→재분석1회→전월유지 · D2 D+5 미승인→전월유지 · D3 승인 종가 일괄매수 · D4 현금 0~30% · D5 분석엔진 Composite+3축 · D6 Short List 30 산출(백테 6→점진 확장, 리포트 워딩 포함) · D7 상시 모니터링 MVP 포함(임계치 단순화) · D8 재생성 cap 자동1·수동2 · D9 /admin/decision-tree 별도 · 어드민 3명 가정 | §1A.5 재작성 + §1.1·§1.3·§1.4·§1.7·§2·§3 동기화 |
| 2026-04-15 | **P3.1 기능 분류 + P3.2 IA 완료** (11차, 병렬) | P3.1: Must 16 / Should 17 / Nice 6 / Deferred 10. §3.6 해소 + §3.7~§3.11 신설. D6 Short List 30 Must 고정 유지. P3.2: 메인 7 + 서브 3 = 10 라우트. `app/(admin)/` 그룹 신설. Short List 30 = 3고정섹션 세로 스택(탭 기각). 3모드 = Header 드롭다운 + Settings. 모바일은 Stage 2. | §2 본문화 + §3 확장. 원자료: `.omc/research/p3-1-feature-prioritization.md`, `.omc/research/p3-2-information-architecture.md` |
| 2026-04-15 | **P4.1 PRD 골격 완료** (12차) | §3.1~§3.11 각 Must 기능 AC 힌트 → 정식 요구사항(R번호체계) 승격. 섹션별 Should/Nice 확장 후보 서브섹션 신설. §4 데이터 모델 스켈레톤 → 8 엔티티(E1~E8) 필드·관계·갱신주기 본문화. P3→P4 이관 미해결 5건: ①멀티어드민 race → R3.3-2 UI 해소 + B3 이관, ②리포트 상세도 → R3.7-2 접기·펼치기 확정, ③스케줄러 실패 D+5 → R3.9-4 해소, ④regenerate 방식 → R3.4-5 기능 고정 + B3 이관, ⑤부분표시 UX → R3.11-8 해소 + P7 이관. | `ServicePlan-Admin.md` §3·§4 직접 편집. 원자료: `p3-1-feature-prioritization.md`, `p3-2-information-architecture.md`, `quant-data-architecture.md`, `customer-journey.md`. |
| 2026-04-15 | **P4.2 User Stories 완료** (12차) | Must 16개 기능에 User Story 1개 + AC 2~4개씩 부착 (17블록, M13은 설정/동작 분리). §3 기존 요구사항·AC 힌트 보존. | `ServicePlan-Admin.md` §3 직접 편집. `pm-execution:user-stories` 가이드. |
| 2026-04-15 | **P4.3 DoD 완료** (12차) | Must 16개 기능에 DoD 3~5개씩 부착 (17블록). 검증 항목은 수동 확인 가능 동작 + `npm run build` + `npm run lint` 통과. Gherkin 금지. | `ServicePlan-Admin.md` §3 직접 편집. `pm-execution:test-scenarios` 가이드. |
| 2026-04-15 | **P7.1 유저 플로우 완료** (12차) | mermaid 다이어그램 5개 (J1 월간선정 · J2 일간모니터링 · J3 Exit · J4 성과추적 · 3모드 전환). 라우트 매핑 표 포함. 미확정 3건(⑥⑦⑧) 마커. | `.omc/design/flows/admin-flows.md` 신규 + §2 포인터 갱신. |
| 2026-04-15 | **P7.2 와이어프레임 완료** (12차) | 글로벌 레이아웃 + 5종 ASCII 와이어프레임 (홈 · 풀리포트 · 포트폴리오승인 · 알림 · Decision Tree). committee-ux-patterns 한국 금융 UX 반영. | `.omc/design/wireframes/admin-wireframes.md` 신규. |
| 2026-04-15 | **P7.3 IA 검증 완료** (12차) | BLOCK 0 / FLAG 3 (track-record 와이어프레임 누락 · 핑퐁 네비 · 갱신시각 누락) / Suggestion 3. 미확정 3건 권장안: ⑥ 버킷 내 디폴트+경계표시, ⑦ N/12 부분게이지+점선투영, ⑧ alerts/[id]+report §0 최소 readable CSS. 페르소나 3인 여정 워크스루 PASS. 한국 금융 UX 7패턴+7안티패턴 전수 준수. | `.omc/design/ia-verification.md` 신규 + §2 검증결과 반영. |
| 2026-04-15 | **P4.4 통합 편집 → v0.9** (12차) | 상태 v0.9 갱신 · 트래커 P4+P7 전체 체크 · P7.3 FLAG 3건+미확정 권장안 §2 반영 · §7 확인 로그 6행 추가. | `ServicePlan-Admin.md` 직접 편집. |
| 2026-04-15 | **P5 검증 → v1.0 수렴** (13차) | P5 검증 3병렬(critic REJECT → 해소 / ux-researcher / pre-mortem) + 사용자 결정 D10~D13. Critical 3건(I-01 Exit 백업채널 Must 원복 / I-02 D+5×공휴일×스케줄러 / I-03 AI 비용 하드캡) 해소 · Major 8건 해소(I-04 미달·I-06 역할·I-07 schema_version·I-08 UNIQUE·I-09 entry_price·I-10 폴링대체·I-12 NSM·I-13 판정기준) · 신규 §1A.0 3경로 실행 모델 · E9 BrokerageConnection 박제. | `ServicePlan-Admin.md` 직접 편집 (executor). 원자료: `.omc/research/serviceplan-admin-critique.md`, `.omc/research/serviceplan-admin-ux-audit.md`, `.omc/research/premortem.md`. |
| 2026-04-15 | **Q-OP1·Q-OP2 해소 → v1.1** (13차 후속) | **D14 Must 승격 3건**(M17 AI 비용 모니터링 · M18 파이프라인 헬스체크 · M19 Silent Health 하트비트). Must 16 → **19**. §3.12 시스템 관측·가드레일 섹션 신설. §1A.4 Anti-Metrics 방어 기능 열 추가. **D15 Holding Period + 2인 게이팅 + 이의 48h** 도입(R3.3-7~R3.3-10). §4.2 E4에 shortlist_generated_at·dispute_raised_at·dispute_resolved_at·report_view_count 필드 추가. Q-OP3(멤버 유료 재검토)·Q-OP4(Y1 법적 등록 재검토)는 개발 완료 전까지 재질문 금지로 고정. | `ServicePlan-Admin.md` 직접 편집 (executor). 사용자 결정 D14·D15. |
| 2026-04-21 | **어드민 = 본인+친구 3명 내부 투자 도구 재정의 + 자동매매 S8 승격 → v1.2** | D16 박제. §0 정체성 재정의 · §1.5 AI 경계에 S8 자동매매 어댑터 행 추가 · §1.6 Non-Goals 재작성(Stage 2/3 문구 삭제 + 지인 Beta 분리 + AI 본체 drop-in Non-Goal) · §1A.0 경로 (3) 자동매매를 S8 구현으로 확정 + 아스키 다이어그램에 E12·Strategy·AI 어댑터 반영 · §2 라우트 블록에 `/admin/settings/{brokerage,binance,risk,strategy}` + `/admin/trading/{stock,crypto}` 6종 추가 · §3.1·§3.4·§1.3 J4 "Stage 1 한정" 문구 제거 · **§3.13 자동매매 프레임 신설** · §1A.5 D16 추가. | `ServicePlan-Admin.md` 직접 편집. 사용자 결정 D16 + Q1~Q3 답(D-T1 b·c 코인 포함 / D-T2 c 이중 경로 / D-T3 선택 가능+바이낸스 선물). |
| 2026-06-10 | **토스 스타일 전체 리디자인(Toss-D0~D4) 시점 결정 → v2.4** | Claude↔omxy 토론 CONVERGED. Accept critical path 유지 + runbook 순서 불변. Toss-D0 spec-only 병행 / D1 Accept 후·S7b UI 전 / D2 D11 전 / D3 S7b·S7c 동시 / D4 S9 직전 freeze. | §1A.1 디자인 방향 · §1A.5 D29 · P8 UI Design · HANDOFF.md · ProgressDashboard.md |

> 섹션별 확정 시마다 행 추가. 확정 주체(사용자·critic 통과)와 근거 명시.

---

## 8. Revision History

| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v0.1 | 2026-04-15 | 문서 스켈레톤 신설 (기획 분리) |
| v0.2~0.8 | 2026-04-15 | §1 JTBD · §1A 전략골격 · P3.0 Q&A D1~D9 · P3.1/P3.2 Must·IA 박제 |
| v0.9 | 2026-04-15 | P4 기획서 작성 + P7 UX Design 완료. Must 16 정식 요구사항·User Story·AC·DoD + 데이터 모델 8 엔티티 본문화 |
| **v1.0** | **2026-04-15** | **P5 검증 완료 → 수렴.** Critical 3건(I-01/I-02/I-03) 해소 · **Major 10건 전원 해소(I-04~I-13)** · 신규 개념 (3경로 실행 모델 §1A.0, E9 멀티 API) 박제. **D10~D13 결정 추가** (Exit 백업채널 Must 원복 · 3경로 실행 모델 · E9 증권사 API 다중 연결 · 멤버 스코프 축소). Must 승격 검토 대기 3건(D-OOS-6·7·Silent Health)과 Q-OP 유보 2건(Holding Period·2인 게이팅)은 §1A.5에 박제하여 사용자 추가 결정 대기. 상위 문서 정합(BusinessPlan §Q4·§Q10·§Q11·§10.5·§10.8·§12 + ServicePlan.md + ServicePlan-Member.md + AutoTrading.md) 동시 갱신. |
| **v1.1** | **2026-04-15** | **Q-OP1·Q-OP2 반영.** D14 Must 16→19 (M17 AI 비용 · M18 헬스체크 · M19 Silent Health) · D15 R3.3-7~10 (Holding 24h + 2인 게이팅 + 이의 48h). §3.12 시스템 관측·가드레일 섹션 신설. §4.2 E4 Holding 필드 추가. Q-OP3·Q-OP4는 개발 완료 전까지 재질문 금지. |
| **v1.2** | **2026-04-21** | **어드민 내부 도구 재정의 + 자동매매 S8 승격.** D16 박제: (a) 본인+친구 3명 투자 내부 도구로 범위 축소, 멤버·Stage 어휘 분리 · (b) 구 트레이딩 3-Stage(매뉴얼→API→AI 자율) 폐기, 자동매매 = S8 단일 슬라이스 통합(주식 KIS + 바이낸스 선물 포함) · (c) Strategy drop-in + AI 어댑터 embed 이중 경로 · (d) 리스크 가드레일 기본값 박제(레버리지 ≤5x · 일일 -3% 정지 · AI 일 20회). §0·§1.5·§1.6·§1A.0·§2·§3.1·§3.4·§3.13 편집, §1A.5 D16 추가. `Slices/S8-AutoTrading.md` 신설 연동. |
| **v1.3** | **2026-04-22** | **Admin Credential System 재설계 + DQ-7이 S7a 선행 트랙으로 승격.** D17 박제: (a) KIS·Binance 키 per-admin UI + AES-256-GCM 암호화 (env pre-wire 폐기) · (b) DB 분리 2테이블 (E9 확장 + E12 신설) · (c) Vercel 첫 배포 DQ-7에서 수행 · (d) 실계좌/메인넷 저장 권한 = 대표 1인 (`ADMIN_REP_EMAIL` env) · (e) 마이그레이션 번호 재배정(0009=DQ-7 · 0010=BL-KRIT-7) · (f) S8-AutoTrading T8.4·T8.5 UI DQ-7 선행 이관. §4.2 E9 필드 갱신(`api_key_ref` 폐기 · 암호화 컬럼 6개 + `mock_mode`) · §4.5 시크릿 정책 재작성 · E12 정책 신설 · §1A.5 D17 추가. `Slices/DQ7-Credentials.md` 신설 (858 줄, 17 섹션, 20 Tasks, Task-level agent·skill 매핑). |
| **v1.4** | **2026-05-08** | **S8 자동매매 진입 시점 재조정 + KIS 발급 비블로커화.** D18 박제: (a) S8 자동매매를 S7 series 다음으로 분리. v3 시퀀스 = `S7a → S7e → S7b → ★ D11 AI 가상 포트 1차 가동 (KIS 0개) → 운용 검증 → S7c (KIS 본인 1개) → S7d → S8` · (b) KIS 용도 = 자동매매 전용 (일간 데이터·AI 가상 포트는 KRX/pykrx/DART/네이버로 충분) · (c) son00326·Kevin KIS 발급 지연 = S7c까지 비블로커. S8 시점에 (i) 3명 동시 또는 (ii) 본인 단독 결정 · (d) D11 운용 검증 며칠~1주를 S8 선행 게이트로 명시 · (e) S7c·S7d 강등 큐 폐기, 정규 시퀀스 복귀. 자동매매 실체결 도달 = v2 9세션 → v3 약 12~14세션. §1A.5 D18 추가. 동기화: `Slices/S8-AutoTrading.md` 선행 조건·Phase 헤더 + `ProgressDashboard.md §2` v3 다이어그램 + `HANDOFF.md §2.D` (후속 슬라이스 시퀀스) + `CLAUDE.md` 상단 시퀀스. |
| **v1.5** | **2026-05-08** | **JooPick AI 강화 — Tier 0/1/2 병렬 + 합의 배지 + Reflection (35차).** D19 박제: (a) Short List 30 선정 = "숫자(인디케이터) + AI(Core 11 페르소나) 병렬 + 합의 에이전트" 구조. TauricResearch/TradingAgents Analyst Team + Reflection 패턴 차용 + JooPick Core 11 + Sector Board (canonical 14 sectors × 14 personas overlay) 박제 보존 — slot 모델은 **D21 (52차)** supersede · (b) Tier 0 인디케이터 자동 스크리닝(2,500→150, AI 키 불필요) + Tier 1 Core 11 평가(150→30, 시간대별 가중치) + Tier 2 Sector Board 활성화(30종목 해당 섹터 14인만) · (c) 합의 배지 4종(🟢 강한 합의/🔵 숫자 우세/🟣 AI 우세/⚪ AI 분석 대기) + 어드민 카드에 🔢🤖 이중 점수 + AI 코멘트 1~2줄 + 클릭→풀 리포트 · (d) Reflection = 매월 말 실현 수익률 → 다음달 prompt 주입 · (e) AI 키 미발급 fallback = Tier 0 단독으로 실 코스피·코스닥 30종목 + 실 가격·재무·뉴스. AI 키 발급 시 plug-in · (f) Smoke #3 (Binance) ⏸ S8까지 유예 · (g) D6 본문 보강(직렬→병렬+합의). §1A.5 D19 추가 · §3.1 R3.1-6 신설 · §2 라우트 컬럼 명세 갱신. 동기화: `Service/Report/ReportFramework.md §8` Step 0 + Step 4 후속 + `Slices/S7-RealData.md` Tier 0 분기 + `Slices/DQ7-Credentials.md` Smoke #3 ⏸ + `ProgressDashboard.md §2` v3.1 + `HANDOFF.md §1·§2·§4·§7` + `CLAUDE.md` 상단 시퀀스 v3.1 + D19 라인. |
| **v1.6** | **2026-05-19** | **S7a 49차 — 5종 합의 배지 박제 (🟡 관망 신규)**. Q5b omxy CONVERGED 결과 박제: 비-top tier + 비-top tier + AI 가용 케이스를 ⚪(AI 분석 대기)와 구별해 🟡 **관망**으로 분류. §1A.5 D19 entry + §3.1 R3.1-6 + Short List 30 컬럼 명세 갱신. 동기화: `tudal/src/lib/screening/consensus.ts` (5종 type union + assignBadge 5분기) · `Service/Report/ReportFramework.md §8` Step 0 5종 표 · 마이그 0017 `stock_reports.consensus_badge` 컬럼 박제 · S7a plan Q5b CONVERGED. |
| **v1.7** | **2026-05-20** | **52차 — D21 Tier 2 Sector Board slot 모델 정정 (Option C overlay) + SoT PR 박제.** 51차 brainstorm R3~R7 누적 56 rounds + 52차 본 PR omxy R1~R4 4 rounds + final R1 5 findings catch + R2 hotfix → 누적 60+ rounds CONVERGED 결과 박제: **slot 모델 = canonical 14 sectors × 14 personas/sector overlay** (10 base + 2 primary overlay + 2 sub_tag overlay). 구 "Sector Board 14 sectors / 10 slots per sector" 표현은 §4.2.1 partA contract (`length ∈ {0,14}`)와 사전 충돌 — D21 정정. **sub_tags jsonb crosswalk 7개** (조선/방산→운송/물류 또는 철강/소재 · 화학→철강/소재 · 게임→IT/SW+엔터/미디어 secondary · 가전→유통/소비재 · 제약→바이오 · 부동산→건설). **운영 UI taxonomy proxy** (개념 정합 아님). 신규: `tudal/src/lib/screening/canonical-sectors.ts` (production import 0 — tests/만) + `tudal/supabase/migrations/0018_short_list_30_sub_tags.sql` (jsonb + GIN). **8 files** 변경: §1A.5 D21 신설 · §1A.2 UA1 · §3.2 R3.2-4 · §3.7 R3.7-6 · §4.2 E1 sub_tags 컬럼 · §4.2.1 partA 주석 갱신 + `Service/Planning/ServicePlan.md` §3 표 D21 정정 (final R1 catch hotfix) · `Service/Report/ReportFramework.md` §5 "위원 10명"·"섹터 보드 10명" 정정 + §7.2/§7.3 재작성 + §8/§10 v2.5 (final R1 catch + 본 v1.7) · `Document/Process/HANDOFF.md` §6 51차 next-action + §2.1 Step 3 literal 정정. canonical-sectors.ts rationale ↔ ReportFramework §7.3 crosswalk = **semantic match** (byte-identical 아님 — final R1 4번 catch 박제). **`commit_sector_personas` RPC + Section 8 partA render + mock fixture migration = Tier 2 implementation 후속 PR OOS**. |
| **v1.8** | **2026-05-20** | **52차 — D21 Tier 2 implementation PR #5 (stacked from PR #4) + D22 Kevin v3.1 quality target 박제.** PR #5 omxy R1~R3 4 rounds + final R1 3 BLOCKERS + R2 hotfix → 누적 6 rounds CONVERGED + subagent gsd 9 BLOCKERS. **신규**: 마이그 0019 `commit_sector_personas` RPC (SECURITY DEFINER triad + SELECT FOR UPDATE race-free + section_8 `coalesce \|\| jsonb_build_object` Core 필드 보존 + p_sector_aggregate exact keys + integer/non-negative validation + DELETE persona_layer='sector' first → INSERT 14 idempotency) + canonical-sectors.ts 추가 (`SECTOR_PERSONA_COUNT=14` + `TIER2_CALLS_PER_TICKER=25` + `resolveSlotTemplate`) + writer.ts `commitSectorReport()` + `parseSectorContentStrict()` (malformed AI content RPC 차단) + persona-eval.ts `runSectorEval()` scaffold + mock-admin-committee-personas.ts `CANONICAL_SECTOR_PERSONAS` 196 stub + `getCanonicalSectorPersonas()` (legacy 5인 lean 105 격리 보존). **+46 tests** (legacy.5lean + canonical-sector-personas + canonical-sectors 추가 22 + persona-eval 추가 8 + writer 추가 10 strict parser 3 포함). production import 정확 3 파일 (persona-eval / writer / mock-fixture, tests 제외). cron/admin route 변경 0 (caller wiring Step 3c OOS). **D22 신설 (본 row 하단 참조)**: Tier 2 production sector persona prompts 196 작성 시 quality target = `origin/IMVCOM @ 1faee1b` Kevin v3.1 초보 친화 알테오젠 리포트 reference. **HANDOFF 박제 동기화** (PR #5 docs-only terminal commit): HANDOFF §1·§2.1 Step 3 DONE + Step 3a/3b/3c 신설 + §3 사용자 액션 큐 + §5 Kevin reference + §6 본 entry + §7.7 누적 69 rounds + §8.3 + §9. `Build/ProgressDashboard.md` + `Process/CodebaseStatus.md` + `CLAUDE.md` 상단 시퀀스 v3.2 동기화. **Step 3a 정합 머지 → Step 3b production prompts → Step 3c caller wiring → Step 4 Reflection** 순서 박제. |
| **v1.9** | **2026-05-21** | **53차 §5 — shortlist 30종목 + 풀 리포트 흐름 정정 박제.** OMXY 적대적 검토 R1~R5 5 rounds 누적 21 BLOCKERS catch & fix → CONVERGED. **D23 신설** (D19/D21/D22 ancestry supersession entry): (a) **사용자 lock-in 8 항목 박제** = ① 30종목 선정 흐름 (Tier 0 → Tier 1 AI 합의 → 30, AI가 단/중/장 분류 결정에 직접 영향) ② 풀 리포트 흐름 (writer Section 0~7 통합 + Tier 2 Section 8 partA/partD = 단일 산출물) ③ AI 호출 트리거 3 path (cron/reject trigger 버튼/Regen 버튼) ④ UI 흐름 (admin 홈 또는 portfolio → ShortlistRow accordion 클릭 → "풀 리포트" 버튼 → /admin/report/[ticker]) ⑤ Track Record 의미 재정의 (누적 성과 + 월별 아카이브 한 페이지 탭 분리) ⑥ Kevin v3.1 quality target 박제 (D22 보존) ⑦ Sector reference 3-level 분류 (Level A 본문 2/12 · Level B 체크리스트 4/10 · Level C philosophies 14/0) ⑧ API 금액 무관 — Tier 1 호출 범위(60/90/150) 후속 PR2 결정. (b) **박제 vs 코드 mismatch Group A-H (8 그룹) catch**: Group A track-record가 trigger 위치 박제 · Group B 30종목 선정 AI 부재 (Tier 0 단독 30이 fallback에서 메인 path로 굳어진 상태) · Group C cron monthly-batch mock dry-run only · Group D Step 3c "DONE" → PARTIAL — dangling server action `triggerMonthlyPersonaEvalAction` · Group E writer Section 0~7 본문 미구현 박제 누락 (`section_8` jsonb commit만 가능) · Group F Track Record 의미 박제 (누적 성과 vs 과거 아카이브 분리 누락) · Group G Sector reference 3-level 분류 미박제 · **Group H Critical** stock_reports schema drift + report page crash 위험 (admin-reports.ts validation 0 + page.tsx section0.conviction early deref + Section 0~7 nested deref + Section 8 신규 partA/B/C/D vs old conclusion/recommendation/keyQuotes shape mismatch). (c) **canonical 후속 implementation 순서** = **PR2 (Tier 1 AI 30 선정 screening) → PR3a (Group H schema drift fix Hard gate) → PR1 (cron monthly-batch real path, server-side only) → PR3b (writer Section 0~7 본문 구현) → PR4 (UI trigger 버튼 + Track Record 탭 + Regen 실 호출 wire)**. **Hard gate (PR1 ⊥ PR3a 미선행 = page crash inevitable)** — 사용자 종목 클릭 시 section0.conviction early deref crash. (d) **OMXY 적대적 검토 R1~R5 누적 21 BLOCKERS catch & fix** (R1 6 · R2 4 · R3 6 · R4·R5 5 = 21 total). (e) **spec doc path** = `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md` (전문 SoT). **변경 파일 (matrix)**: §1A.5 D23 신설 + D19 inline 정정 (메인 path/fallback 분리 + Tier 1 호출 범위 open question) · §3 페이지 IA (10 라우트 inline 정정: track-record 탭 분리 + report/[ticker] 풀 리포트 + portfolio 30 + UI 흐름 박제) · §4 E1 short_list_30 현재 상태 vs 정정 후 박제 · §8 v1.9 changelog (본 행) · 동기화 = HANDOFF.md §0·§1·§2.1·§3·§6 + ReportFramework.md §8 Step 0·1~4·§9.2 + ProgressDashboard.md (Step 3c PARTIAL + 잔여 5 task canonical) + CodebaseStatus.md (writer.ts·dangling exports·Group H schema drift·Regen 미구현) + CLAUDE.md 상단 시퀀스 v3.3 + S7-RealData.md T7e.8 fallback 명시. |
| **v2.1** | **2026-06-04** | **65차 — MVP 엔진 7결정 supersede 노트 반영 (D26 신설).** omxy CONVERGED. Q1(선정주기 단기 주1회/중장기 월1회 분리) · Q2(AI 자율 포트구성: 운용여부·편입개수·종목·단중장분배·비중·현금0~30% 전부 AI) · Q3(모델 하드코딩 제거+설정화, Claude+GPT 멀티프로바이더+auto-detect+레지스트리) · Q4(실시간 멀티라운드 반박 토론 loop, 합의점수 선택) · hardcap 40만→50만원 정정(35만원 경보값은 현재 코드값/기존 경보값 유지, W0 재산정) · 역할별 모델 차등(토론=저가/최종=고가) · MVP 재정의(30리스트+포트폴리오+30리포트 정확) · 빌드순서 W0→W2→W1→W3(PR-G ⓑ superseded). **노트/포인터만 추가** — §1.2·§1.3 J1·§1.5·§1A.0·§1A.2 UA1·§1A.4·§3.1 R3.1-6·§3.2·§3.3·§3.4·§3.7 R3.7-7·§3.9·§3.12 M17 R3.12-3·§4.2 E1·E2·§4.4·§5 + §1A.5 D26 신설. **D19~D23 본문 불변** (선정 알고리즘·포트 proposal schema·토론 loop schema·모델 레지스트리 재작성은 W0~W3 구현 위임). 상세 SoT = `HANDOFF.md ⭐ 65차 MVP 엔진 섹션`. |
| **v2.2** | **2026-06-04** | **65차 후속 — D27 Q5 펀드식 incumbent thesis 재점검 박제.** omxy CONVERGED. 모든 트랙(단기 주1회 포함) 재선정 시 기존 종목은 직전 리포트·논거·배지·점수+실현 성과("incumbent thesis context")로 논거 유효성 재점검 → 유지는 신규 후보와 top10 랭킹 경쟁(자동 유지 아님). W2 = 후보풀 fresh Tier 0 ∪ incumbents(무심사 탈락 금지, 탈락은 W1 랭킹 후만) + prior-context builder / W1 = 토론 주입(reflectionContext seam 재사용). incumbent union overhead는 W0 reservation 산식 포함. PR-K Reflection과 별개(당시 defer 유지 — **D32 2026-06-24에서 PR-K는 출시 전 승격**, 본 changelog는 역사 기록). §1A.5 D27 신설(본 changelog). 상세 SoT = `HANDOFF.md ⭐ 65차 MVP 엔진 섹션`. |
| **v2.3** | **2026-06-04** | **65차 후속 — D28 프로바이더 위상 + 역할→모델 기본 배분 박제 (결정6 재정의).** omxy R1~R2 CONVERGED. 차등 기준 = 비용→**예측 적중률+리포트 정확성**(hardcap 50만=제약). (A) Claude 필수/GPT 선택/GPT-only 미지원 (C) MVP 기본=두 키 동시(UI 토글 후순위) (B-final 가설 기본값) 토론 Sonnet4.6×6+GPT mid×5 / R2 선택적(config) / judge Opus4.8+경계 dual / critic GPT 교차 / W3 Opus4.8. W0 비용가드 3종(GPT·4.8 단가 등록/unknown fail-closed/model-aware reservation). §1A.5 D28 신설(본 changelog). 상세 SoT = `HANDOFF.md ⭐ 65차 MVP 엔진 섹션`. |
| **v2.4** | **2026-06-10** | **토스 스타일 전체 리디자인(Toss-D0~D4) 시점 결정.** D29 신설: D0 spec-only 병행 / D1 Accept 후·S7b UI 전 / D2 D11 전 / D3 S7b·S7c 기능 PR 내 final-style / D4 S7d 후·S9 직전 freeze. P8/B1을 일괄 디자인→코드 전환에서 마일스톤 결합으로 재정의. HANDOFF·ProgressDashboard 동기화. |
| **v2.7** | **2026-06-12** | **77차 — D30 amend: 스코어링 B+ → B++ (실증 후 B+ 단독 REJECT).** production tier0_candidates_150 MCP 쿼리 = 대형 상승 주도주 11개 중 SK하이닉스만 진입·나머지 10(삼성전자·HD현대일렉·한화오션·조선·원전·2차전지) 전부 누락·상위 픽 소형 급등주·long 5점폭 압축 → 사용자 직감 확증. 근본원인 = 구조적 retrieval 실패(지속추세 시그널 부재 + 소형주 구성편향, B+ 정규화로 못 고침). **B++** = size sleeve(Large/Mid/Small-liquid, horizon별 20/20/10) + 유동성 플로어(ADV60+anti-pump) + 모멘텀 재설계(close/MA60 폐기→risk-adj 20/60/126/252D trend+52주 고가+spike penalty) + winsorize/rank+결측 tiering+foreign ADV+sector quality+volume=trend확인시만 + 수기가중치 폐기→rank ensemble. **삼중 게이트**: Gate A recall(대형 leader recall 별도·visible-trend 진단용·11-leader tripwire) · Gate B rank-IC(슬리브별 scope·recall통과/IC실패→adjudication) · Gate C size composition(60/60/30 결정론). AI 2차는 누락 구제 불가 = recall은 Tier0 책임. Claude 퀀트 에이전트 + omxy(트레이딩/퀀트 sub-agent + 한국 모멘텀 KCI 문헌) 2 독립 수렴 → main Opus 종합(2 판정 omxy 수용 + spec 2 MED/1 LOW fix). 통과 전 --apply/Tier1/"상승 예측" claim 금지. §1A.5 D30 amend + 전 supersede 포인터 동기화. 구현 다음 세션. SoT spec B++ 전문. |
| **v2.6** | **2026-06-12** | **77차 — D31 Accept 게이트 내부도구 완화 모드.** Accept 비활성(D+4 Hold 06-15 + 2인 열람 0/2)이 정상 D15 게이팅이나 Accept=가상 포트 확정·3인 내부도구 맥락에 멤버서비스급 게이트가 과한 마찰 → `gating.ts relaxGate`(24h hold만 유지, D+4·2인열람 면제) + caller default=relaxed(env `PORTFOLIO_ACCEPT_GATE_STRICT=true` strict opt-in) + relaxed면 viewer/auto-relief DB 조회 skip + UI 모드 배너. 의도적 default 변경(strict→relaxed, 제품=3인 내부도구 한정·가상포트 stakes 낮음). §1A.5 D31 + §3.13 R3.3-7~10 supersede(내부도구 한정). PR #120 MERGED·omxy R1~R2 CONVERGED(독립 code-reviewer APPROVE)·production 배포. test:ci 1993+4skip. |
| **v2.5** | **2026-06-12** | **77차 — D30 Tier 0 스코어링 1차 = "B+ 형태수정 + 경량 IC 검증" 채택 (→ 같은 날 v2.7에서 실증 후 B++로 amend, 본 행은 1차 기록).** (quant-research + 독립 Claude 퀀트 에이전트 + omxy 2 sub-agent 독립 토론 CONVERGED). 사용자 핵심 질문 = "후보 150이 정말 향후 상승할 기업을 올바르게 예측·선별하는 스코어링이냐". 진단 = 합리적 팩터 컨셉 + 실행 결함 다수(결측 0주입·z fat-tail·외국인 size bias·가중치 IC 미검증) + 예측력 검증 0건 → B+ + 경량 IC 게이트 최소 필수, 구현 다음 세션. §1A.5 D30 신설 + §3.1 R3.1-6 D30 supersede 포인터 + 상단 production drift 정정(73차 실 AI 30 = 현 production, Tier 0 단독은 fallback). SoT spec = `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md`. 부수 박제: B-SEL-CRON fix PR #118 MERGED + Accept-gate de-mock fix PR #119 MERGED(shortlist-gate.ts 공유모듈 + 2026 달력 근로자의날/제헌절). HANDOFF·ProgressDashboard·CodebaseStatus·CLAUDE·S7-RealData·ReportFramework §8 동기화. |
| **v2.8** | **2026-06-24** | **USER 결정 — D32 Reflection/PR-K(AI 자가 학습) 출시 전 승격.** "출시 후 defer"(62차 2026-06-02 Claude 문서정합 분류 `8fc91d4`, USER 명시 결정 아님) + 65차 item-8 "PR-K defer 유지" → **"출시 전 빌드 + S9 운용 검증 기간 중 실가동·검증"**. 근거 = 데이터 의존성(직전 실현 수익률→다음 prompt)은 S9 창(출시 전 1개월+ 실 운용)이 충족 → 출시 시 (단기/주간) 작동하는 자가학습(중장기는 spec §4 타이밍) + 공개 후 급조보다 S9 검증이 안전. MVP 3종(30리스트/포트/30리포트, 65차 잠금) 불변 — Reflection은 launch-readiness 추가. Q5 incumbent thesis(D27)와 `reflectionContext` seam 공유하나 별개. 빌드 = reflection_log(0038~ dormant) + track별 회고 job(주1/월1) + prompt 주입. 게이트 분리 확정: 빌드 완료 = S9 진입 sequencing 선행 / 동작·품질 = soft criterion(§2.2 7-criteria 불변). §1A.5 D32 신설 + D27 "defer 유지" 클로즈 정정 + Status v2.8. SoT spec = `docs/superpowers/specs/2026-06-24-reflection-prk-pre-launch-promotion.md`. ① Claude docs draft → ② omxy catch-only → ③ Claude 적대적 재검토. |
| **v2.9** | **2026-06-25** | **USER 확정 — D33 TradingAgents graft 출시 전 로드맵 박제.** G1 Reflection Lab(diagnostic·제안만→USER 승인) + G2 Leader-miss why-excluded(Path-A 흡수·신규 빌드 금지) + G3 Risk 3자 토론(출시 전 이동·Accept 게이트 substitute 아님) + G4 Macro/news AI context(S7b 결합·Tier0 factor 아님) 채택, G5 Bull/Bear reject(Q4 중복). 코드 빌드 0·문서 최신화만. per-ticker 토론 funnel 직접이식 금지·NO-CONFIG-PASSES 유지(예측 claim/자동교체 금지)·MVP 3종+§2.2 7-criteria 불변. SoT spec = `docs/superpowers/specs/2026-06-25-tradingagents-graft-prelaunch-roadmap.md`. |
