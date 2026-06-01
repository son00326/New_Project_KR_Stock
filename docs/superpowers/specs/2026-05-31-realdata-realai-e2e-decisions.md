# 실데이터 + 실 AI end-to-end — 사전결정 ADR + sequenced 로드맵 (PR-A)

Status: **CONVERGED** (Claude 1차 — Workflow 9-agent 매핑 + completeness critique + omxy §2.0a R1 5 catch + R2 3 catch 반영 → **omxy R3 CONVERGED**, 잔여 HIGH/MED 0).
Date: 2026-05-31
Base: main `5385512`
SoT 산출: Workflow `wf_69256ccc-149` (7차원 매핑 + 완성도 검증 + 로드맵) + omxy §2.0a R1 (HIGH×2 / MED×2 / LOW×1).

---

## 0. GOAL (USER)

1. **실데이터 + 실 Core 11 AI**로 선정된 **30종목 리스트** (AI가 단/중/장 분류·선정에 직접 영향).
2. **실 AI(writer + critic + revise)로 생성된 리포트**.
3. **AI 합의 배지** (🟢 강한합의 / 🔵 숫자우세 / 🟣 AI우세 / 🟡 관망 / ⚪ 대기).
4. **프론트 반영**: Short List 30 카드에 🔢 Tier0 점수 + 🤖 AI 점수 + 합의 배지 + AI 코멘트 1~2줄.
5. **runtime mock 전면 제거** (테스트 fixture는 제외).
6. 비용은 USER 승인됨. 기획(ServicePlan-Admin §1A.5 D19/D21/D23 + §2 IA, ReportFramework §8) 정합 필수.

## 1. 검증된 현재 상태 (DB + 코드 @main `5385512`)

- **실 AI 0회**: `cost_log=0` / `stock_reports=0` / `committee_votes=0`.
- `short_list_30=30` = Python `screen_shortlist_tier0.py`(Tier 0 지표) 산물. **AI 점수/배지 컬럼 없음**(컬럼 전부 composite/trend/momentum/volatility + 0020 metadata).
- 배치 진입점 2개(cron `monthly-batch` GET + admin `triggerMonthlyBatch`) = `mockTier0Source`/`mockCallPersonaPanel`/`mockFetchFinancials`/`commitBadgeOnlyPlaceholder` **throw-stub**. `triggerMonthlyBatch`는 UI caller도 없음.
- `triggerMonthlyPersonaEvalAction`(track-record) = **dangling**(caller 0) + `fetchFinancials`가 `dart_financial_cache`의 **존재하지 않는 컬럼**(ticker/quarter_revenue/...) 조회 = 모든 ticker **guaranteed throw**.
- UI 도달 가능한 유일 실-AI 경로 = `triggerFullReport`(report-only) — 단 입력 전부 하드코딩('근거 부족', tier1Verdict='HOLD', badge='🟡') + `PR4_TRIGGER_UPSERT_ENABLED` off + stock_reports=0 → `report_not_found`.

## 2. BLOCKER 등급 갭 (workflow critique 확정)

- **B1** Tier0 150-후보 SoT 부재 — orchestrator `candidates.length===150` hard-assert, Python은 30만 write, `tier0_candidates_150` 테이블 없음.
- **B2** `callPersona`(free-text `{vote,one_line,argument_excerpt}`) ↔ `PersonaScore`(`{persona_id,scores{short,mid,long}0-100,winning_timeframe,rationale_kr,conviction}`) **어댑터 0개** — un-stub해도 `PersonaPanelSchema.parse` 전부 실패 → 전부 ⚪ (dead work).
- **B3** `dart_financial_cache` 스키마 하드 미스매치 — `corp_code` 키, ticker 컬럼 없음. `corp_code↔ticker` 브리지(`dart_corp_codes.stock_code`) JOIN + YoY/ROE/FCF TS 파생 필요. (현 코드 = 확정 throw 버그.)
- **B4** `short_list_30`에 `consensus_badge`/`ai_score`/`ai_comment` 컬럼 없음 + `upsertShortList30`이 `consensus_badges_by_timeframe`/`weighted_scores` drop.
- **B5** 배지 알고리즘 2개 충돌 (orchestrator `consensus.ts` percentile-by-timeframe vs track-record bucket-rank) → 하나 정본 확정 + 나머지 deprecate 선행.
- **B6** report-only(`upsert_report_sections_0_7_cron`, section_8/badge PRESERVE)와 badge/votes(`commit_persona_eval`)는 **disjoint RPC** — 한 writer 호출로 못 합침.
- **B7** [omxy R1 HIGH] admin real-AI path(`triggerFullReport`/`triggerMonthlyPersonaEvalAction`)는 `AI_COST_LOG_REAL_INSERT_ENABLED` off일 때 `insertCostLog` noop → `getMonthlyTotal=0` → 40만원 hardcap **fail-open**(무제한 burn). worker step-0만 가드, admin path 가드 없음.

## 3. 사전 결정 (PR-A lock-in — 후속 PR 의존 기준점)

| # | 결정 | 근거 |
|---|---|---|
| **D-1** | **30선정 메인 path = `runMonthlyBatchOrchestrator`(monthly-batch)** 채택. `triggerMonthlyPersonaEvalAction`(track-record, dangling+broken fetch+다른 배지algo) **deprecate**. | orchestrator는 `consensus.ts` percentile 배지 + persist seam 정합. 기획 D23 lock-in(cron 매월 자동). |
| **D-2** | **배지 알고리즘 = `consensus.ts` percentile-by-timeframe 단일.** track-record bucket-rank 폐기. | B5 충돌 해소. assignBadge 5종(🟢🔵🟣🟡⚪) 이미 구현. |
| **D-3** | **Tier0 150후보 = Python `screen_shortlist_tier0.py`가 DB write(producer) + TS cron이 read(consumer).** | Vercel = Node 전용(Python cron 불가). 기획 D19(b) Tier0 = pykrx·KRX·DART → 단/중/장 50씩 = 150. |
| **D-4** | **페르소나 출력 스키마 = `PersonaScore` JSON 통일.** 기존 `parseVote`(`{vote}`, track-record) 경로는 D-1 deprecate와 동시 제거 (글로벌 blocker — 프롬프트 변경이 parseVote 깸). | B2 해소. `runTier1Screening`이 요구하는 입력. |
| **D-5** | **Tier1 호출 범위 = 150 후보 전체 호출** (단/중/장 각 50). | 기획 D19(g')/D23 lock-in("API 금액 무관"). USER 비용 승인. [omxy R1 LOW 반영] |
| **D-6** | **Reflection(D19(f) 월말 실현수익률→다음달 prompt 주입) = go-live OOS, defer → PR-K.** | 실 결과 누적이 선행되어야 의미. go-live 후 별도. [omxy R1 MED 반영] |
| **D-7** | **카드 산출물 = 🔢 numeric_score(composite_score 기존) + 🤖 ai_score + 합의 배지 + ai_comment_kr 1~2줄** 전부 스키마·persist·SELECT·UI에 포함. | 기획 §2 Short List 홈 + D19(e). PR-E/F 필수 항목. [omxy R1 HIGH 반영] |
| **D-8** | **fail-open guard = 실 Anthropic 호출 전 공통 가드**(flag off → throw, cost 0). 전용 코드 PR(PR-B2)로 선행. | B7. admin path가 hardcap 무력화 burn 못 하게. [omxy R1 HIGH 반영] |
| **D-9** | **3 trigger path 분리 수렴** (구현자 혼동 방지): **(cron + reject 후 trigger 버튼)** → `runMonthlyBatchOrchestrator` 30 선정 **재실행**(새 30 + 새 풀리포트). **(종목별 Regen)** → `orchestrateFullReport` **단일 ticker 재생성**(기존 short_list_30 배지/점수를 입력, **30선정 재실행 아님**). **둘 다 PR-B2 cost guard 적용.** track-record action 대체. | 기획 D23 lock-in 1.3 + §2 `/admin/report/[ticker]/regenerate` IA. [omxy R1 MED + R2 MED-2 반영] |

> **D-1·D-2·D-4·D-9는 product/architecture 결정** → USER 1회 확인 권장(특히 track-record action deprecate 방향).

## 4. Sequenced 로드맵 (PR-A → PR-K)

각 PR = **§2.0a flow** (Claude 1차 → omxy 검증 → omxy fix → Claude 재검증) + Workflow deep review (실 비용/concurrency PR 한정) + 검증 게이트(build/lint/test:ci/tsc + 해당 시 execute_sql).

| PR | 목적 | scope 핵심 | depends_on | USER-gated | 위험 |
|---|---|---|---|---|---|
| **A** | 본 ADR (사전결정 + 로드맵) | 코드 0 | none | D-1·D-2·D-4·D-9 승인 | low |
| **B** | DART 재무 공유모듈 (corp_code 브리지) — B3 버그fix | `dart-financials.ts` JOIN + YoY/ROE/FCF 파생 + 유닛테스트. track-record fetchFinancials 교체 | A | - | med |
| **B2** | **admin real-AI path fail-closed 공통 가드 (B7/D-8)** | Anthropic 호출 전 `AI_COST_LOG_REAL_INSERT_ENABLED` 가드 함수 + admin path 적용. flag off→throw(cost 0) | A | - | med |
| **C** | PersonaScore 어댑터 + 프롬프트 스키마 통일 (B2/D-4) | `persona-panel-adapter.ts`(11 callPersona→PersonaScore→PanelSchema.parse) + user-prompt-template PersonaScore JSON + parseVote deprecate | A, B | - | high |
| **D** ✅ MERGED (main `123d995`, PR #65) | Tier0 150후보 producer/consumer (B1/D-3) | 마이그 `tier0_candidates_150`(canonical sector CHECK + unique(month,bucket,rank)) + Python `--emit-candidates` 150 + cron/admin `tier0Source` 실 SELECT(mock 제거) + consumer `assertTier0CandidateRows` 150-contract. **omxy §2.0a: cron/admin persist를 `persistBlockedUntilPrE`(throw)로 fail-closed 차단** — degraded ⚪ clobber 방지. | A | 마이그 0028 apply + Python 150 시드 | high |
| **E** ✅ MERGED (main `492cd46`, PR #66, 마이그 0029 applied) | short_list_30 AI 스키마 + 실 AI 선정 배선 + fail-closed 비용가드 (B4/D-7) | 마이그 0029(AI 컬럼 8종 nullable) + commentsByTicker carry + `upsertShortList30` AI 매핑 + admin 실 배선(makeCallPersonaPanel+fetchFinancialsSummary+persist 복원) + **orchestrator preflight DI seam**(isCostLoggingEnabled+ANTHROPIC_API_KEY+preflightHardcap+**is_admin() 게이트** — omxy review, B7 fail-open 차단) + **150/150 post-screening 게이트**(degraded persist 금지, B3 supersede) + **persona panel 동시성 제한기**(default 4 — omxy review) + cron D6-B preflight block. **commit_persona_eval = report-path 전용(selection 배지는 short_list_30, B6 분리 확정)**. omxy 설계+impl 토론 CONVERGED + Workflow 6-dim 교차검증. | **A,B2,C,D** ✅ | 마이그 apply ✅ | high |
| **F** | 프론트 카드 산출물 (D-7) | `ShortListItem` 타입(consensusBadge+**aiScore**+**aiComment**) + SELECT 확장 + transform + ShortlistRow 칩/점수/코멘트 렌더 + report 페이지 배지 SELECT | E | - | low |
| **G** | env/seed + **실 AI 첫 30선정 검증** | 코드 0. env 4종 + cron-system seed + 첫 트리거 + verify(cost_log>0/배지 non-null/votes>0) + **B2 guard merged 확인 + flag-off real-trigger = LLM 0/cost 0 test** (R2 MED-1) | E (+F) | env·seed·비용·trigger | high |
| **H** | 실 리포트 enrich + worker 가동 + **manual trigger 2종(D-9 분리)** | placeholder→실 DART/배지 source(report 입력) + report-worker 가동 + **reject-trigger 버튼 → `runMonthlyBatchOrchestrator`(30 재선정)** / **Regen 버튼 → `orchestrateFullReport` 단일 ticker** wire (둘 다 B2 guard) + **Section0에 Step0 산출 🔢/🤖/배지 1행 노출**(R2 LOW, ReportFramework §8 Step2) | B,E,G | `PR5_CRON_AUTO_ENABLED` + 비용 | high |
| **I** | Tier2 sector 14 + Section 8 (PR5b) | `runSectorEval` mock 14×14 stub → production prompt 정합 + `commit_sector_personas` 가동 + report Part A 14패널 | C,E,G | 비용 | high |
| **J** | runtime mock 전면 제거 마무리 | orphan mock 삭제 + grep 0 검증 (테스트 fixture 보존) | I | (멤버 트랙 stock mock USER 확인) | med |
| **K** (defer) | Reflection 자가학습 (D-6) | reflection_log 마이그 + 월말 실현수익률→Tier1 prompt 주입 | go-live 후 (실 결과 누적) | 비용 | med |

## 5. 기획 정합 매핑 (누락 0 — 기획 요소 → PR)

| 기획 요소 (D19/D21/D23 + §2 IA) | 담당 PR |
|---|---|
| Tier 0 인디케이터 150 후보 (pykrx·KRX·DART) | PR-D |
| Tier 1 Core 11 페르소나 평가 + **시간대별 가중치**(단기 Druckenmiller·Burry↑/중기 Lynch↑/장기 Buffett·Munger↑) → 단/중/장 top 10 = 30 | PR-C(어댑터)+PR-D(150)+PR-E(un-stub)+PR-G(실행). 가중치 = `runTier1Screening` 기구현 |
| 🔢 Tier0 점수 (composite_score) | 기존 (PR-F 렌더) |
| 🤖 AI 점수 | PR-E(ai_score)+PR-F(렌더) |
| 합의 배지 5종 | PR-E(consensus_badge)+PR-F(칩) |
| AI 코멘트 1~2줄 | PR-E(ai_comment_kr)+PR-F(렌더) |
| Tier 2 sector 14 페르소나 | PR-I |
| Section 8 합의 패널 (Part A 14 + Core 11 + 쟁점 + 합의) | PR-I |
| writer Section 0~7 리포트 (+ Section0에 Step0 🔢/🤖/배지 1행) | PR-H (기구현 PR3b/PR5 + 입력 enrich + Section0 one-line) |
| 3 trigger path (cron / reject 버튼 / Regen) | PR-D·G(cron) + PR-H(manual 2종) |
| Reflection (월말 수익률→prompt) | PR-K (defer, D-6) |
| Track Record 탭 (누적 성과 + 월별 아카이브) | 기구현 (PR4) — scope 외 |

## 6. USER-gated (CLAUDE = 코드·체크리스트·후속 verify, 실행 X)

- Vercel env: `ANTHROPIC_API_KEY` + `AI_COST_LOG_REAL_INSERT_ENABLED=true` + `CRON_SYSTEM_USER_ID`(실존 auth.users UUID) + `PR5_CRON_AUTO_ENABLED=true` + (admin UPSERT 시) `PR4_TRIGGER_UPSERT_ENABLED=true` + `CRON_SECRET`.
- 마이그 production apply: 0025(미적용 시) + 0028(tier0_150) + 0029(short_list_30 AI) + 0030(cron-system seed).
- cron-system 전용 auth.users seed (현 placeholder UUID = DB 0 rows; 기존 admin 3명 재사용 시 cost_log.called_by 오염 → 전용 seed 필수).
- Python `screen_shortlist_tier0.py --emit-candidates` 실 KRX/DART 키로 첫 150 시드 (Python cron 불가 → 외부/수동 스케줄).
- 실 AI 비용 burn 트리거 (승인됨). **단 `AI_COST_LOG_REAL_INSERT_ENABLED=true` 선행 필수** — off 상태로 돌리면 hardcap fail-open(B7).
- Anthropic 모델 ID 호출 가능 확인 (`claude-opus-4-7` / `claude-haiku-4-5-20251001` hardcode).

## 7. 가장 큰 리스크 (실행 시 주의)

1. **fail-open**: `AI_COST_LOG_REAL_INSERT_ENABLED` off + admin real trigger = 무제한 burn. → PR-B2 가드 선행 + PR-G에서 flag ON 강제.
2. **데이터 의존 순환**: 150 시드(PR-D) 없이 callPersonaPanel un-stub = dead work. report-worker는 selection이 해당 월 30 생산해야 동작(아니면 영구 quiet-skip).
3. **글로벌 blocker**: 프롬프트 스키마 변경(PR-C)이 parseVote 깸 → D-4 deprecate 동반 필수.
4. **disjoint RPC**: 리포트(PR-H)와 배지/votes(PR-E/I)는 별 write 경로 — 합칠 수 없음.
5. 전 경로 USER env 의존 — 코드 완성해도 USER 액션 없으면 실 AI 0회 유지.
