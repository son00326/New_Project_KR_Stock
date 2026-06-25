# CodebaseStatus.md — 현재 구현 스냅샷

> **용도**: 이 문서는 **"지금 코드에 무엇이 있는가"**의 스냅샷이다. 덮어쓰기 중심 — 과거 상태는 git log에 있고 여기는 **현재**만 유지한다.

> **53차 §3 종료 (2026-05-21)**: Step 3b 207 persona Kevin v3.1 quality 본문 완성 (PR #8 OPEN). 신규 코드 SoT: `tudal/src/lib/ai/prompts/kevin-v31-rubric.ts` (4 inquiry axes + 8 markers M1~M8 + applyKevinV31Rubric helper + persona individuality wrapper) + `personas/sector-persona-builder.ts` 확장 (SECTOR_PHILOSOPHIES 14 4-anchor + BASE_SLOT_PRINCIPLES 10 재무 확인 + PRIMARY_OVERLAY_PRINCIPLES 28 신규 + SUB_TAG_OVERLAY_PRINCIPLES 14 신규 + ADJUSTMENTS 회사명 cleanup) + `personas/index.ts` (Core 11 wrapping). 신규 docs: `docs/superpowers/specs/2026-05-21-kevin-v31-rubric.md` (rationale only, CI 검증 X) + `docs/superpowers/snapshots/2026-05-21-step3b-prompt-samples.md` (28 manual review sample fixture, **CI gate 아님 — manual review only**). test:ci 65/691, 회사명 grep 0 match.
>
> **HANDOFF.md와의 구분**:
> - `HANDOFF.md` = 미래 지향 ("다음 세션에 무엇을 할지")
> - `CodebaseStatus.md` = 현재 지향 ("지금 무엇이 있는가", 라우트·파일·연결 상태)
>
> **갱신 트리거**: 슬라이스 클로즈 완료 시, 또는 라우트/실데이터 연결/환경변수 등 구조적 변화 시 즉시 갱신.

---

## 최근 갱신

> **[65차 supersede 2026-06-04 → 66차 W0 부분 해소]**: AI 엔진 스택은 W0~W3로 재정의됨 — 멀티프로바이더(Claude+GPT, provider auto-detect)/역할별 모델 차등/hardcap **50만**/주간(short)·월간(mid·long) 선정 split/실시간 반박 토론 loop/AI 자율 포트/**D27 Q5 incumbent thesis 재점검**(재선정 후보풀 = fresh Tier0 ∪ incumbents, 직전 리포트·논거 주입 재평가 — W2 union + W1 주입). ~~본 스냅샷의 Anthropic-단일·40만 hardcap 표기~~ → **66차 W0에서 해소됨** (아래 2026-06-04 entry). Core 11 단발 채점·monthly-batch 단일 선정·stateless 재선정(reflectionContext='') 표기는 **W2/W1 구현 시 갱신 예정**(과거 timeline·완료 로그는 역사로 보존). 활성 SoT = `HANDOFF.md §2` + `HANDOFF.md ⭐ 65차 MVP 엔진 섹션` + CLAUDE.md.

**2026-06-25** (B-PARTB Part B 실제 추출 + ₩0 백필 + `tier0-bpp-multiregime`(72c) main 병합·배포):
- **B-PARTB (writer Section 8 Part B 실제 issue-extraction)**: `tudal/src/lib/report/writer.ts`에 pure deterministic `extractIssueDebates`(+ 테마 카탈로그 7 + voteRank polarity + clash 정렬 + Tier-1/2/3 fallback + isQuoteSafe + label fail-soft) 신설, `buildSection8AndVotes`의 partB stub(raw-JSON `content.slice`/하드코딩 `'stub'`) 교체. `page.tsx` Part B 카드에 `중:`(arbiter) null-guard 렌더 +1블록. `section-8-schema`/`partD`/`partC`/votes/Sector 경로 무변경. +9 mutation-pin 테스트(writer.test.ts B-PARTB 20→29). 부분 writer mock 2개(`actions.test.ts`/`section8-step-preflight.test.ts`)를 `importOriginal` spread로 하드닝(신규 export 누락 leak 방지). 검증: build/lint 0·0/test:ci 2093+5skip/tsc 0. SoT spec = `docs/superpowers/specs/2026-06-25-section8-partB-issue-extraction.md`.
- **₩0 in-place 백필**: 신규 gated driver `tudal/src/lib/report/__tests__/b-partb-backfill.live.test.ts`(`B_PARTB_BACKFILL_CONFIRM`/`_APPLY` 2-phase) — 기존 30 리포트의 DB partD.one_line + committee_votes.argument_excerpt로 persona content 재구성 → `extractIssueDebates` → `section_8.partB`만 UPDATE(AI 0원). backup→apply 30→post-verify 30/30 clean(결함 인용 117→0). backup `scripts/out/b-partb-backfill-backup-2026-06-01.json`.
- **main 병합·배포**: `tier0-bpp-multiregime`(72 commits) **FF-merged → main**(B-PARTB stable merge point `ea27656`; 현 HEAD = runtime verify `git rev-parse --short origin/main`) + **Vercel prod 배포**(canary 4/4 200, OPEN PR 0). FF가 캠페인 전체(B++ funnel/shadow PR-A·B/PR-T2a/B-PARTB)를 main에 통합 — 비-B-PARTB 코드는 flag-gated/dormant(Vercel env OFF)·migration 0038/0039 미적용. **LIVE/DORMANT/RESEARCH-CLOSED 분류 = `docs/superpowers/2026-06-25-main-merge-classification.md`**(omxy R1→R2 CONVERGED). 전 단계 omxy 교차검증 CONVERGED.

**2026-06-12** (77차 — B-SEL-CRON fix(PR #118) + Accept-gate de-mock fix(PR #119) + shortlist 재시드 진행 + 스코어링 방법론 토론 CONVERGED):
- **B-SEL-CRON fix (PR #118 MERGED, main `435a3cf`)**: selection cron이 period(주간 short / 월간 midlong)를 단독 finalize 못하던 결함. `selection-worker/route.ts` + `tier1-selection-batch-worker.ts`에 period-scoped due-gate + `SELECTION_CRON_SELF_CONTINUE` opt-out 기본 ON + sweepOrphanPeriods(ORPHAN_LOOKBACK_DAYS=60) + stall/orphan/track alert + cost-month + finalize stale-guard(월경계 cross-resume 보수적 차단). **flag dormant — `SELECTION_CRON_AUTO_ENABLED` 미설정이라 행동변화 0(코드만)**, 매달 자동화는 USER flag 게이트. workflow 27→11 + omxy 3 + Claude 0-new 3-pass + 배선 연결검증 스킬+에이전트 ALL PASS.
- **Accept-gate de-mock fix (PR #119 MERGED)**: Accept 버튼 disable 진단 = (a) **정상 D15 게이팅**(hold_24h→D+4 bypass→2인 열람) + (b) **실 viewer-게이트 버그 2종**. 신규 `tudal/src/lib/portfolio/shortlist-gate.ts`(pure, Supabase/Next 호출 없음): `filterActiveShortlist`/`resolveShortlistGeneratedAt`(anchor=active MAX createdAt — W2a 트랙 split 후 mixed createdAt 우회 차단)/`getGateTickers`(구 `REQUIRED_GATE_TICKERS` legacy mock 5종 하드코딩 제거 → active 전 종목 결정론적)/`computeMinimumViewerCount`. `portfolio/page.tsx`+`actions.ts`가 본 모듈로 단일화(split-brain 제거). `portfolio/calendar.ts`에 2026 공휴일 2건 추가(`2026-05-01 근로자의날`+`2026-07-17 제헌절` — 2026 부활, KRX 휴장; 영업일 246→244·holidays 16→18). +12 유닛테스트. omxy R1/R2 CONVERGED.
- **Accept 게이트 내부도구 완화 D31 (PR #120 MERGED, main `83f06cc`·production 배포 success)**: Accept 비활성이 정상 D15 게이팅(D+4 Hold 06-15 + 2인 열람 0/2, auto-relief 영구 false 스텁)이나 Accept=가상 포트 확정·3인 내부도구라 과한 마찰 → 사용자 결정 = 완화. `tudal/src/lib/portfolio/gating.ts` `AcceptGateInput.relaxGate?:boolean`(24h sanity hold 유지, relaxed면 D+4 영업일 Hold + 2인 열람 면제 후 즉시 통과; holdExpiresAt도 relaxed면 24h 기준). 순수함수 후방호환(relaxGate 미지정=strict — 기존 테스트 불변). `portfolio/actions.ts`(서버집행)+`page.tsx`(표시) **default=relaxed**(`relaxGate = process.env.PORTFOLIO_ACCEPT_GATE_STRICT !== "true"`) + **relaxed면 viewer/auto-relief DB 조회 자체를 skip**(DB/RLS 실패가 accept 차단·Server Component crash 안 되도록) + `page.tsx` relaxed 모드 UI 배너(감사성). **의도적 default 변경**(strict→relaxed; 제품=3인 내부도구 한정·가상포트 stakes 낮음). 멤버 공개(Deferred-D) 시 `PORTFOLIO_ACCEPT_GATE_STRICT=true` 필수. +5 유닛테스트(gating 7~9 + actions relaxed/strict-stub). omxy R1(1 MED viewer hard-dep + 1 LOW remaining)→fix→R2 CONVERGED(독립 code-reviewer APPROVE).
- **shortlist 재시드 진행 (코드/데이터 준비 — production 미반영)**: DART quarterly 캐시 무효화+fixed 파서로 재populate + `scripts/sector_override.json` +16 override commit `2a66a95`(반도체 9 팸텍·피에스케이·브이엠·싸이맥스·피에스케이홀딩스·HPSP·유진테크·GST·프로텍 + 펨트론·동아엘텍·두산테스나 + IT·SW 두산로보틱스 + 바이오 올릭스 + 엔터·미디어 엔피 + 유통 참좋은여행). Tier0 dry-run b89 통과 + 150 후보 CSV(`scripts/out/tier0_candidates_150_2026-06_reseed.csv`, gitignored) — SK하이닉스 long#40, **삼성전자 미진입**. S3 외국인 pykrx ~2% fail-soft(get_market_trading_value… Length mismatch, return 0.0 비치명적). **⏸ Tier0 --apply 보류 / Tier1(₩25k) 보류** — 미검증 스코어링에 비용 금지(토론 합의). production `short_list_30` 여전히 73차(2026-06-01) 선정.
- **⭐ 스코어링 방법론 2차 토론 CONVERGED → B++ (다음 세션 실행 대기, 코드 미구현)**: 사용자 핵심 질문 = "후보 150이 정말 향후 상승할 기업을 올바르게 예측·선별하느냐" + 실증 요구. **실증(production tier0_candidates_150 2026-06-01, MCP 직접 쿼리)**: 대형 상승 주도주 11개 중 **SK하이닉스(long#38)만 진입·나머지 10 전부 누락**(삼성전자·HD현대일렉·한화오션·조선·원전·2차전지), 상위 픽=소형 급등주, long 53.7~58.6 5점폭 압축 → 사용자 직감 확증. **Claude 퀀트 에이전트 + omxy(트레이딩/퀀트 sub-agent + 한국 모멘텀 KCI 문헌) 2 독립 수렴 = B+ 단독 REJECT → B++**(main Opus 종합: 2 판정[11-leader→tripwire·IC scope+escalate] omxy 수용 + spec 2 MED/1 LOW fix). 근본원인 = **구조적 retrieval 실패**(① 지속추세 시그널 부재 — 60일 단기·반전 모멘텀뿐 → 다개월 오른 대형 주도주가 close/MA60≈1.0 수렴해 안 보임 ② 원시비율 모멘텀×거래량이 저가·고변동 소형주 점수 폭발 = size+변동성 노출). **AI 2차는 150 누락 구제 불가 → recall은 Tier0 책임.** **B++** = size sleeve(Large/Mid/Small-liquid, horizon별 20/20/10) + 유동성 플로어(ADV60+anti-pump, `ACC_TRDVAL` 무비용) + 모멘텀 재설계(close/MA60 폐기→risk-adj 20/60/126/252D trend+52주 고가+spike penalty) + winsorize/percentile rank+결측 tiering+foreign ADV+sector-relative quality+volume=trend확인시만(long 0) + 수기가중치 폐기→rank ensemble. **삼중 게이트**: Gate A recall(forward top-decile, 대형 leader recall 별도, visible-trend는 진단용, 11-leader는 비최적화 tripwire) · Gate B rank-IC(유동universe+슬리브별 scope) · Gate C size composition(60/60/30 결정론 진입조건). survivorship(상폐 포함 PIT)·announcement-date PIT = 최대 검증 리스크. **SoT spec = `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md`**(B++ 전문). **삼중 게이트 통과 전 --apply/Tier1 비용/"향후 상승 예측" claim 금지** — "robust, factor-informed, leader-inclusive candidate shortlist"까지만.
- 환경: `scripts/.venv`(pykrx/supabase/requests). MCP OAuth(Unrecognized client_id) = Keychain stale DCR client 제거 + USER 재인증으로 복구. 게이트 build/lint 0/test:ci 1989+4skip/tsc 0.

**2026-06-10** (76차 — ⭐ shortlist 정확성 fix: track_pending 분류 + stale 카피 + DART 분기누적 파싱 버그, PR #114 MERGED):
- **신규 `tudal/src/lib/admin/shortage-reason.ts`** (pure): `resolveShortageReason(bucketCounts)` — 도달 가능 불변식 기반(mid==long∈{0,10} = midlong 직접-write exactly-10-or-throw / short∈{0..10} = carry_short_into_month overlap-exclusion). 규칙 = total≥30 none / 0<total<30 track_pending / 0 screening. (구 inline `activeCount` 단순비교가 W2a 트랙 시차·carry partial을 'screening 미달'로 오인하던 것 대체.) `ShortageReason`에 `track_pending` 추가(types/admin.ts) + MissingCountBanner 분기(over-promise 없는 카피) + **admin home page 배선** + stale cadence '21/42/63일 리밸런스'→'주간/월간' + 홈 헤더 'v6 선정엔진'→'단기 주간·중·장기 월간'. portfolio page는 MissingCountBanner 미사용(WATCH 후속)이라 배선됐다고 쓰지 않는다. 7 유닛테스트.
- **`scripts/dart_signals.py` `parse_dart_financial_response`**: 손익(IS/CIS) 계정은 `thstrm_add_amount`(당기누적) 우선·없으면 `thstrm_amount` fallback / BS 계정 `thstrm_amount`(시점) 유지. 반기(11012)/3분기(11014) 보고서의 thstrm_amount=3개월치를 compute_standalone_quarter가 누적 전제로 차감하던 버그(Signal4 YoY 실적 왜곡→대형주 불리) 수정. compute_standalone_quarter 무변경. +3 회귀테스트(pytest 18).
- **behavior-neutral**: 코드/테스트만. production short_list_30·tier0_candidates_150은 재시드(DART 캐시 무효화 + Python 재시드 + 재선정 ~₩25k, USER 게이트) 후 반영. 마이그 0.
- 검토: dynamic workflow 2-track + Claude↔omxy 적대 loop R1~R3 CONVERGED(omxy R2가 carry overlap로 [9,10,10] 도달성 정확히 catch → Claude가 R1 반박 철회·규칙 정정). 게이트 tsc/lint 0·0/build OK/test:ci 1951+4skip/pytest 18.

**2026-06-10** (75차 — ⭐ P4 30 풀 리포트 완주, MVP ③ 달성):
- **P4 driver harness 신규**: `tudal/scripts/smoke/p4-reports.p4run.test.ts`(runGuardedReportChunk 루프 → remaining 0 완주 — resume-tolerant pre-guard[stale 15min+5min skew 마진/failed·deferred audit abort/30행 AI 배지/cron user side-effect-free] + 예약식 run-delta ceiling ₩40k[retry×3 worst = 3×(orchestrate+11×tier1_panel)] + stall guard + per-ticker failed 즉시 중단 + 최종 전수 assert) + `setup-env-p4.ts`(`P4_FULL_RUN_CONFIRM` 전용 게이트) + `vitest.p4-run.config.ts`(`*.p4run.test.ts` glob·CI 외·3h timeout).
- **live 산출(production, harness 전 assert PASS + SQL 재확인)**: `stock_reports` 2026-06 **30행 전부 section_0~8+appendix 완결·is_latest**(verdict BUY 15/HOLD 7/SELL 8) + `committee_votes` **330**(리포트당 정확히 11, Core-11 id set) + parse stub 0 + `report_batch_job` 30/30 done(failed 0) + run-mutex succeeded. **run delta ₩14,962.66**(27 ticker ≈ ₩554/개) · cost_log 2026-06 누계 3031행 ₩41,314.13(hardcap 50만 내, **75차 당시**). 86분.
- 검토: §2.0a 변형(①Claude→②omxy 검토→③Claude 수정→④omxy 재검토) R1~R4 CONVERGED — catch 5(HIGH stale-resume 영구차단 / MED cost assert false-RED·post-hoc ceiling·clock skew false-pass·retry 미반영 worst) 전부 반영. 게이트 tsc/lint/$0 guard/test:ci 1944 무영향.
- **MVP 산출물 현황**: ① 30 리스트 ✅(73차) · ③ 30 리포트 ✅(75차) · ② 포트폴리오 = 76차 후 `portfolio_proposal` 2026-06-01 1건 영속 확인(11종목+현금 12%, Opus 4.8 ₩27.80) / `portfolio_approval` 2026-06-01 0건 / `portfolio_snapshot` 0건 → **Accept 확정만 잔여**.

**2026-06-10** (74차 — ⭐ P2b Section8 live 검증 + claim over-claim 결함 fix 마이그 0037 production applied):
- **P2b live canary harness 신설**: `tudal/scripts/smoke/p2b-section8.canary.test.ts`(single-shot $0 pre-guard 6종[stock_reports 0·report_batch_job 월 잔여 0·votes month-scope 0·cost_log report-path 0·lowest-ticker AI 배지·cron user 존재 side-effect-free] + seam A~I + soft-skip 진단 + parse-stub tripwire + DB-side cost watermark + spend ceiling ₩10k post-hoc) + `setup-env-p2b.ts`(`P2B_CANARY_CONFIRM` 전용 게이트 — 미확인 시 비용/flag 게이트 강제 해제 = $0) + `vitest.p2b.config.ts`(`*.canary.test.ts` glob·CI 외·90min timeout). report-worker 실경로(`runGuardedReportChunk`) DI 미러(route 대비 편차 = chunkSize 1뿐).
- **live 산출(전 seam SQL 검증 CLEAN)**: `stock_reports` 2026-06 3행(000660/000990/007610) section_0~7+appendix+**section_8** 완결 + `committee_votes` 33행(BUY→approve 매핑·core_revote 정합·parse stub 0) + `cost_log` 42행 ₩1,695.83(ticker당 writer opus-4-8/critic gpt-5.4/revise opus-4-8 + Core-11 vote-pass 11×opus-4-7[레지스트리 tier1_panel preferred — slot mix는 selection 전용]) + run-mutex succeeded. **P2b = Section8+committee_votes live 경로(0036 RPC) 검증 완료.** `report_batch_job` 2026-06 = 3 done + 27 pending(P4 자연 resume 큐, prod cron dormant이라 inert).
- **⭐ 마이그 0037 (`claim_skip_locked_cte_fix`) — canary가 잡은 production 결함 fix + applied**: `claim_next_report_jobs`(0027)·`claim_next_selection_jobs`(0031)의 `where id in (select … limit p_limit for update skip locked)`가 서브쿼리 rescan으로 **p_limit 초과 over-claim**(prod 실증 p_limit=1→3 claim·수동 LIMIT 1→2행, plan-dependent) → 양 RPC를 `with picked as materialized … update … from picked … returning j.*` 단일평가로 교체(semantics 무변경). 로컬 실 PG16 매트릭스(claim 정확·hostile planner·rollback 왕복) PASS → **USER 승인 production apply(ledger `20260610015408`)** + 3-way 사후검증(functiondef verbatim/grants/behavioral LIMIT 1→1). **마이그 0001~0037 전부 applied — dormant 없음.** 신규 claim RPC 패턴 규칙은 HANDOFF §4.
- **신규 blocker B-SEL-CRON**(배선 교차감사 catch, 코드 무변경): selection cron due-gate(short=월요일만/midlong=1일만)+chunk 3+`SELECTION_CRON_SELF_CONTINUE` 기본 off → cron 단독으론 period finalize 불가. `SELECTION_CRON_AUTO_ENABLED` enable 전 선행 fix(HANDOFF §3). deferred LOW: report worker preflight-before-claim attempts 소모.
- 검토: 사용자 지정 §2.0a 변형(①Claude→②omxy 검토→③Claude 수정→④omxy 재검토) R1~R4 CONVERGED + blind Workflow 교차감사 2회(harness 9-agent confirmed 6/refuted 0 + 배선 8-agent). 게이트 build/lint 0·0/test:ci 1944 무영향/tsc 0/$0 guard.

**2026-06-09** (72차 — ⭐ 뉴스 기반 자동 제외 (M12a) **spec 신설 — 문서 only · 코드 미구현(planned)**, omxy scope debate R1~R4 CONVERGED):
- **신규 product spec(planned)**: `ServicePlan-Admin.md §3.10 M12 → M12a 재작성`. AI 페르소나(Core 11)가 개장 전 08:00 KST 보유 포트+30리스트 뉴스 평가 → 구조화 판정(severity/scope/confidence/affected_tickers/materiality/directness/thesis_break_reason/recommended_action; `scope`는 의사결정 gate가 아닌 메타데이터) → 회사/섹터/거시 뉴스 모두 각 종목별 per-company thesis-break 평가 → direct·material·high-conf 종목만 **자동 제외(빼기만·freed→현금)** + **smart brake**(1run 4건↑[>3] 또는 track 70% floor → 전체 hold_for_review; 집중포트 N<10=1건 자동·2건↑ 보류) + **news_event 1건 + per_ticker_assessments N건 durable ledger**(lockout 없음) + 다음 선정 **candidate-level negative-news context**(fresh∪incumbent, D27 seam과 별개) + **텔레그램 + `/admin` 웹 알림(`/admin/alerts` durable event + 대시보드 unread badge)**.
- **⚠️ 현재 코드 상태(변경 없음)**: 뉴스 = 규칙기반 passive(`src/lib/news/classifier.ts` 키워드 3등급) + M11 모닝 브리핑(deterministic). **M12a AI 자동 제외 = 코드 0줄, planned only.** 이번 작업 = 6개 SoT 문서 spec 갱신 + 잘못된 내용(즉시 교체/이메일/규칙 3등급 분류) 수정뿐 — **`tudal/src` 무변경**.
- **갱신 문서**: ServicePlan-Admin §3.10 M12a(primary) + S7-RealData S7b Task + HANDOFF Step7/B-7~9 + ProgressDashboard S7b scope + BusinessPlan §10.6 + ReportFramework boundary note + 본 CodebaseStatus.
- **Resend 범위 정정**: **72차 사용자 override로 이메일/Resend 알림 전역 제거**. S7b 뉴스/브리핑, M15/S7c Exit(D10), S7d health 모두 텔레그램 best-effort + `/admin/alerts` durable event + 대시보드 unread badge. `ADMIN_EMAILS` 인증 allowlist는 알림 채널이 아니므로 별개.
- omxy scope debate(catch-only) R1~R4 CONVERGED: candidate-level context(incumbent-only 아님)·durable ledger 분리(E1 row 불변)·70% per-track floor·M12a output schema·B-7/B-9 게이트·`alert_event.alert_type` enum 불변·소형포트 brake 예외 반영.

**2026-06-09** (72차 — ⭐ structured-log 격상: report 섹션 validation silent null-drop → JSON 구조화 로그, PR #107 MERGED main `6f1913a`):
- **신규 `tudal/src/lib/log/structured-log.ts`**: `logStructured(level, event, fields)` — 단일 machine-parseable JSON 라인을 console.warn/error로 emit(serverless 로그 드레인에서 event 단위 쿼리/집계). **fail-safe** `sanitizeLogValue`(BigInt→string·undefined→null·symbol/function→placeholder·circular WeakSet→`[Circular]`·Date→ISO·Error→{name,message,stack}·getter→`[Getter]` 미호출·Proxy descriptor throw→[]) + stringify/emit try/catch — 로그가 caller resilience path를 절대 안 깨뜨림. 예약키(level/event/toJSON) spoof 차단 + `server-only` 경계(vitest alias `src/test/server-only-empty.ts`로 테스트 호환).
- **`admin-reports.ts` `transformStockReportRow` 재배선**(read-path): 섹션 0~7·appendix(`warnSectionValidationFailure`, fields `{component:'admin-reports',ticker,section,path,message}`) + section_8 onError(dual-shape이라 fields `{component,ticker,section,modernPath,modernMessage,legacyPath,legacyMessage}`) → 공통 event `logStructured('warn','report_section_validation_failed', ...)`. caller-graph = 리포트 페이지 Server Component(`report/[ticker]/page.tsx:119`) → `getReportByTicker` → `transformStockReportRow`.
- **`admin-shortlist-incumbents.ts` `buildIncumbentThesisContexts` 격상**(P3 selection incumbent thesis path, `selection-worker/route.ts` 배선): 직접 `reportSection0Schema.safeParse` silent skip → 동일 event(`component:'incumbent-thesis'`). **null/undefined 무로그 skip**(read-path 불변 정합) + malformed non-null만 로그. graceful best-effort skip 동작 보존.
- **behavior-neutral**: 검증 실패=null 반환(resilience)·null 섹션 무로그·write/worker path 무접촉 — 로그 채널/포맷만 변경. **2026-05-22(54차) 박제 "silent null drop log 격상 (PR1 wire 시점)" ✅ 해소**(아래 54차 entry).
- **§2.0a 5-phase + 연결 교차감사**: Claude① TDD → omxy②③(독립 code-reviewer+architect 서브에이전트, fail-safe 직접수정) → Claude④⑤(scope-creep revert — omxy foreign OMO `no-unknown-assertion` 룰 기반 `buildCompletenessClient` refactor 원복) → 연결검증(Claude 다차원 caller-graph DIM1-5 + omxy blind[서브에이전트 2 + code-review-graph MCP risk 0.00] → incumbent seam catch → Claude TDD 격상 → omxy ROUND3 null false-positive catch → Claude null guard → **omxy ROUND4 CONVERGED**).
- **deferred follow-up**: omxy LOW — `reportExistsAndCompleteForMonth`가 section_0/7/8 non-null만 보고 worker idempotency complete 판정(corrupted non-null JSONB가 validation 우회 complete 취급 가능 — 로그 silent-drop 아님·worker 완결성 semantics라 본 scope 밖).
- **후속 PR #108**(docs-sync omxy docs-review가 catch): `logStructured` **fail-safe 완성** — `buildPayload`/`stringifyPayload`를 outer try 밖에서 호출하던 gap 봉쇄(hostile value, 예: revoked Proxy의 `instanceof` throw가 caller에 전파되던 edge → 빌드 단계도 try 안 + `structured_log_build_failed` fallback + 회귀 테스트). docs 정확성: section_8 field shape `modernPath/...` 별도 명기 + HANDOFF §2.1 stale "현 1순위=W3" → 풀 P3 정정.
- 게이트 build/lint 0·0/**test:ci 1944+4skip/164 files+2skip**/tsc 0 · 공개 canary 4/4(/ 200·/login 200·/macro 200·/admin 307) · 마이그 0 · AI cost 0. PR #107 + #108 rebase FF + delete-branch.

**2026-06-09** (71차 — ⭐ P3 cheap selection smoke + 미머지/잔재 전면 정리, main `fee5640`):
- **P3 cheap selection smoke harness 신설 (PR #105 MERGED)**: `tudal/scripts/smoke/{p3-selection-cheap.smoke.test.ts,setup-env.ts}` + `tudal/vitest.smoke.config.ts` — direct `runGuardedSelectionChunk(midlong, chunkSize=1)`로 Tier1 selection 워커 plumbing을 **실 AI + 실 prod Supabase**로 검증(1 ticker 000220, 11콜 = ₩86.98, Sonnet×6+GPT-5.4×5). **CI glob 제외**(`vitest.config.ts`는 `src/**/__tests__/**`만 glob) + `P3_SMOKE_CONFIRM=1` 게이트 + `setup-env.ts`가 confirm 없으면 `.env.local` 로드/cost flag 주입 안 함(SC-4 defense-in-depth) + SC-2 baseline-count fail-closed idempotency guard. 전 R1-path seam(provider→cost_log FK→job lifecycle→run-mutex fencing→pipeline_health) 배선 검증 후 transient `tier1_selection_job`/`run` rows DELETE(cost_log/pipeline_health audit 보존) → prod pristine.
- **format-error salvage (PR #106 MERGED → PR #2 CLOSED superseded)**: `tudal/src/lib/admin/format-error.ts`에 PR #2의 net-new 3종 추가(`ai_billing_exhausted` exact / `unknown_persona_id:` + `commit_persona_eval_failed:` prefix — 전부 현재 src에서 실 throw·check) + `KNOWN_ACTION_CODES` 인벤토리 + suffix 테스트. PR #2 13종 중 나머지 10종은 이미 main 존재 → PR #2 superseded close.
- **루트 AGENTS.md 71차 새로고침** (stale 2026-04-24/DQ-7·S7 → W0~W3 완결 + P3 cheap done + 풀 P3은 73차 완료).
- **정리**: 스테일 로컬 브랜치 11개 `-D` 삭제(작업 main 반영분, reflog 복구 가능) + stash 2개 drop(stash@{1} `.vercel` redundant — `.gitignore`가 이미 `.vercel/` 포함 / stash@{0} 19파일 deep-agents AGENTS.md scaffold, 방치 WIP).
- **듀얼 트랙 검토**: Claude 16-agent 독립 적대+blind wiring 교차감사 → **omxy 실검토 CONVERGED**(setup-env `.env.local` 게이트 누락 catch) → **Claude ④**(SC-2 fail-OPEN→fail-closed) + 정리계획 omxy 검증(stash@{1} 적용불가·stash@{0} 14 신규파일 catch). 게이트 build/lint 0·0/**test:ci 1928+4skip/163 files**/tsc 0 · Vercel pass · 열린 PR 0.

**2026-06-08** (70차 — ⭐ AI-키 실검증(L0/P1) + P2 PR5b Section8 라이브 경로, PR #103+#104 MERGED in main `02e5f4b`):
- **실 AI 키 검증**(사용자 Anthropic+OpenAI 키 `.env.local` gitignored): L0 provider 실 API(haiku ₩0.8 + gpt-5.4-mini ₩0.4) + P1(실 Opus 11종목+현금12% 제안 + 1종목 Section0~7 리포트 + 멀티프로바이더 Opus+gpt-5.4 검증; cost_log 2026-05 4행 ₩334.71; stock_reports 004150 1 row).
- **P2 = PR5b Section 8 + committee_votes canonical 경로 배선**: deprecated `triggerMonthlyPersonaEvalAction`의 Section8 생성 → `orchestrateFullReport`+report-worker로 이전. 신규 `tudal/src/lib/report/section8-step.ts`(commitSection8Step, 배지=canonical short_list_30, ⚪/null→section8_not_ready, model-aware) + writer pure `buildSection8AndVotes`/`commitTickerReportCron` + orchestrator commitSection8 LAST + worker 4분기 + 마이그 0036(`commit_persona_eval_cron` service-role + `reset_section8_eligible_jobs` enqueue-reset). flag `PR5B_SECTION8_ENABLED` default off=dormant. 보안 fix PR #104: cron RPC authenticated 명시 `revoke`(Supabase default-privilege 갭, `feedback_supabase_security_definer_pattern` authenticated 케이스 확장).
- **⭐ 마이그 0032·0033·0034·0035·0036 전부 production applied + 검증**(USER OAuth, Supabase MCP): 0032 R2 round / 0033 judge round / 0034 portfolio_proposal / 0035 snapshot cash-row index / 0036 Section8 cron RPC. **이제 마이그 0001~0036 전부 applied — dormant 없음.** test:ci 1924+4skip.
- **(67~69차 bridge — 상세는 git log + HANDOFF.md)**: W2a(주간/월간 split, PR #89)·W2b(D27 Q5 incumbent thesis, PR #91)·W1a/W1b(Q4 토론 loop + judge/dual-judge, PR #92~#95)·W3a(entry_price KRX EOD, PR #96)·W3b-1~3 + A + W3b-2c(AI 자율 포트 제안→영속→Accept weight→admin UI→명시 cash row, PR #97~#102) 전부 MERGED. → MVP 엔진(W0~W3) 코드 완결.

**2026-06-04** (66차 — ⭐ W0 모델/프로바이더 추상화 + hardcap 50만 + D28 비용가드 3종, PR #86 MERGED in main `46a8f63`):
- **신규 AI provider 계층** (`tudal/src/lib/ai/`): `provider.ts`(`LlmProvider` 인터페이스 + `LlmCallParams/Result` + `isAnthropicAvailable/isOpenAiAvailable`) · `anthropic-provider.ts`(기존 4 client SDK 로직 추출 — cache_control blocks + usage 정규화) · `openai-provider.ts`(**openai@6.42 Responses API** `responses.create({model, instructions, input, max_output_tokens})` → `output_text`+usage — ⚠️ OpenAI `input_tokens`=cached 포함 total이라 `uncached = total - cached` 분리 정규화, cache_creation=0 고정).
- **`model-registry.ts` = 역할→모델 단일 SoT**: `AiRole` 7종(tier1_panel/debate_judge/dual_judge_gpt/full_report/revise/critic/portfolio) → preferred/fallback binding + calibration + maxTokens. **D28 B-final 기본 배분**: writer·revise=`claude-opus-4-8` / critic=`gpt-5.4` preferred+Haiku fallback / tier1_panel=opus-4-7 현행 유지(W1 mix 배선 전) / judge·dual-judge·portfolio=W1/W3 소비 정의. `resolveRole` auto-detect(OPENAI_API_KEY 부재 → Claude fallback, GPT-only 미지원) + 모듈로드 pricingKey invariant + `getRoleMaxCostPerCallKrw`/`getRoleWorstCaseMaxCostPerCallKrw`/`getOrchestrateBudgetKrw` + `D28_DEBATE_CONFIG`(Sonnet×6+GPT×5·R2 ±5+분산20%·dual-judge ±2·maxRounds 2) + `W2_TRACK_VOLUME`(3트랙 50+10 incumbent +2k tok) + `projectD28MonthlyReservationKrw()`(**350,167원 ≤ 50만** 테스트 박제).
- **4 AI client 재배선**: `anthropic-client.ts`(callPersona)/`full-report-client.ts`/`critic-client.ts`/`revise-client.ts` 전부 `resolveRole()` + `provider.call()` 경유 — 하드코딩 MODEL 상수 제거, public 계약(throw 코드 8종/cost_log 필드/DI seam) 보존. critic은 **호출 시점 env-가변 resolve**.
- **단가표 멀티프로바이더화** (`cost/anthropic-pricing.ts` — 파일명 historical 유지): `MODEL_PRICING` 7모델(+`claude-opus-4-8` $5/$25 · `gpt-5.5` $5/$30 · `gpt-5.4` $2.5/$15 · `gpt-5.4-mini` $0.75/$4.5, per-model cacheWriteMult/cacheReadMult) + **`getPricing` unknown model `pricing_unknown_model` throw**(구 silent Sonnet fallback 제거 — D28 ②).
- **hardcap 50만**: `HARDCAP_KRW`/`COST_HARDCAP_KRW`=500_000 + `COST_WARNING_THRESHOLD_KRW`=450_000(90% 파생) — pricing/types/UI(settings/cost·alerts×2)/주석/테스트 전 SoT. **throw 키 rename**: `cost_hardcap_40man` → **`cost_hardcap_exceeded`**(cap-agnostic · production row 0 실측 후). `preflightHardcap` **lines[] 역할별 합산**(model-aware reservation — lines는 >0 강제, 단일 legacy 경로 callCount=0 no-op 허용, `preflight_reservation_missing/invalid` throw) + tier1 워커 finalize replay는 callCount>0 게이트로 통과. format-error 신규 한국어 매핑 3종.
- **env**: `.env.example` + `OPENAI_API_KEY`(선택 secondary — Claude 필수 primary 불변). **smoke**: `__tests__/w0-provider-smoke.live.test.ts`(`W0_LIVE_SMOKE=true` env-gated, CI skip — 실행은 USER 비용 승인 ~20원 미만).
- **게이트**: build 26 routes / lint 0 err 0 warn / **test:ci 1658 PASS + 2 skipped / 144+1 files** / tsc clean / 마이그 0 / 실 AI 호출 0. §2.0a omxy R1~R4 CONVERGED(11 catch). plan SoT = `docs/superpowers/plans/2026-06-04-w0-provider-model-registry.md` v4.

**2026-06-03** (출시前 launch-readiness 역추적 감사 + 5-finding fix — PR #84 MERGED in main `a5ee63e`):
- **Workflow 17-surface 역추적 감사** (FE→server action→data-lib→Supabase→migration, 28 agents, 의도-인지 적대 검증) + **omxy 교차검증 3 rounds** (code-reviewer + architect subagent + code-review-graph MCP). CONFIRMED real-broken 5건 (P0/P1 배선/계약/보안/크래시 결함 0 = 배선 건전), intended-deferred 19건 재flag 0.
- **SHORTLIST-PERSIST-METADATA-1 (P1)**: `tudal/src/lib/data/admin-shortlist-persist.ts::upsertShortList30`이 실 AI 30선정 persist 시 `short_list_30`에 `name/sector/composite_score/signal_label`을 기록하지 않아 AI 신규 선정 ticker가 홈 카드·리포트 헤더·포트폴리오에서 빈 카드로 렌더되던 결함(PR-G ⓑ 첫 실 선정 시 발현). `tier0_candidates_150`(동일 month, AI 선정 입력 원천)에서 best-effort lookup으로 carry — sector=aggregate 직접 / name·composite(=tier0_score)·signal_label=lookup / lookup 실패·rejection은 null 유지(try/catch fail-open, persist 절대 차단 안 함). 마이그 0(컬럼 기존 nullable).
- **format-error +4 codes**: `tier1_panel_incomplete`(AI-ENGINE-CONTRACT-1, orchestrator throw) / `orchestrator_failed`(TRACK-RECORD-1, non-Error catch-all, `orchestrate_failed`와 별개) / `short_list_30_invalid_count` + `report_batch_worker_failed`(CRON-REPORT-1, report-worker 인프라 9종) 매핑 + prefix handlers + inventory test.
- **dead-code 정리**: `getShortListDelta()`(importer 0) 제거 + lint 미사용 5종(anthropic-client `catch(err)` / registry.test `PersonaContract` / cost-logger.test `MAX_COST_PER_CALL_KRW`·`InsertChain`·`SelectChain`) → **lint 5 warn → 0**. `aggregateShortListDelta`/`ShortListDelta`는 test+상호참조로 보존(orphan 미생성).
- **현 `admin-shortlist.ts` (204 lines)** = `getActiveShortList({month?, tickerMeta?, client?})` Supabase SELECT + 순수 helper `transformShortListRow(row, meta?)` + `aggregateShortListDelta(items)` (getShortListDelta 제거됨).
- **§2.0a 워크플로우**: Claude① `0821aa1`(P1 persist + P2×3 i18n) → omxy②③ `11870df`(metadata lookup Promise rejection fail-open edge → try/catch + 회귀테스트) → Claude④ → Phase D `a5ee63e`(dead-code + lint). omxy ROUND 3 catch-only: 2 subagent lane + parent 0 launch blocker.
- **게이트**: build 26 routes / lint 0 err **0 warn**(5→0) / **test:ci 1621**(1602→+19) / tsc clean / 마이그 0 / AI cost 0. PR #84 rebase FF + delete-branch.

**2026-05-22** (54차 §3 — PR #12 (PR3a Group H schema drift fix Critical Hard gate) MERGED + post-merge docs refresh):
- **PR3a MERGED in main `0813a41`** (11 commits FF / 7 files / +3300 lines / 56 TDD tests, baseline 746 → 802, 회귀 0). omxy R1~R12 CONVERGED + R7 Codex structured `/review` GATE PASS + gsd-code-reviewer + gstack testing + red-team 다중 review (42 findings + 11 BLOCKERS, 17 Fix-First, 24 OOS).
- **Group H Critical ✅ 해소** — `stock_reports` schema drift + report page crash 차단:
  - `tudal/src/lib/data/report-section-schemas.ts` **신설 단일 SoT**: Section 0~7 + Appendix zod schemas (`score0to100`/`voteCount` 공통 helpers + `.min/.max/.finite()` bounds) + Section 8 modern은 `@/lib/report/section-8-schema`에서 import + alias (B4 재정의 금지) + `reportSection8LegacySchema` + `parseReportSection8` dual-shape parser + `parseSectionSafe` generic helper + onError 콜백 (`ParseErrorContext` / `ParseSection8ErrorContext`) + `partCToCommitteeAgg` pure helper (BUY→approve / HOLD→abstain / SELL→reject)
  - `tudal/src/lib/data/admin-reports.ts` 확장: `ValidatedStockReport extends Omit<StockReport, keyof StockReportSections>` (WR-01 lockstep) + `transformStockReportRow` per-section `parseSectionSafe(...)` + ticker/section context `console.warn` + `getReportByTicker` 반환 타입 → `Promise<ValidatedStockReport | null>`
  - `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` 확장: `as ReportSection` 강제 어서션 10개 전면 제거 + section null guard + 헤더 `section0?.conviction ?? '—'` + `SectionFallback` 단일 helper component + Section 0~7 + AppendixView가 `data: ReportSectionX | null` 처리 + `Section8View` 3분기 (null/modern/legacy) + `Section8ModernView` (`data.partC.core_revote`/`partC.sector_aggregate`가 authoritative + `partCToCommitteeAgg` helper + committee_votes 외부 집계는 audit details 패널로 분리) + `Section8LegacyView` (기존 본문 보존)
- **silent null drop log 격상 박제 (PR1 wire 시점)**: 현재 `console.warn`으로 위임 (P2 비차단). PR1 cron 가동 시 metric/structured log로 격상해서 production blind spot 차단 (gsd CR-01 + red-team RT#2 + omxy R7 P2). **→ 72차(2026-06-09) ✅ 해소** (PR #107 `logStructured` 구조화 로그 격상 — read-path + P3 selection incumbent path).
- **Group D 박제 (Step 3c dangling) 잔존**: PR1 cron real path + PR4 UI trigger에서 wire 예정.
- **Group B 박제 (short_list_30 Tier 0 단독)**: **73차 supersede: PR #109(main `179d745`)로 Tier 1 AI 30 선정 메인 path 가동 완료**.
- **canonical PR 순서 갱신**: ~~PR2~~ ✅ → ~~PR3a~~ ✅ → **PR1** → **PR3b** → **PR4** (잔여 3 task). Hard gate 해소.
- **OOS findings (54차 §3 PR3a, 후속 PR로 분리)**: partA Tier 2 silent drop (RT#1, PR4 Tier 2 wiring) / aggregateVotes NaN risk (RT#3, PR1 admin-committee wire) / LLM string/array max bound (RT#4/RT#5, PR1 wire) / React Testing Library Section view render tests (T#4, 별도 infra PR).
- **편집 문서 7개** (B16 정정): HANDOFF.md(§0/§1/§2.1/§3/§4/§5/§6/§8 54차 §3 entry) + ProgressDashboard.md(상단 박스 + Last updated + 진행률 + 변경 이력) + 이 문서(54차 §3 entry + PR3a 신규 SoT 박제 + 53차 §5 entry strikethrough) + CLAUDE.md(v3.3 → v3.4 + D24 신설) + ServicePlan-Admin.md(v1.9 → v2.0 + §3 IA Group H 해소) + Slices/S7-RealData.md(54차 §3 박제 + 53차 §5 entry strikethrough) + Service/Report/ReportFramework.md(§8 Hard gate 해소 + v2.7).
- 박제 자료: `docs/superpowers/plans/2026-05-22-pr3a-group-h-schema-drift.md` (1693 lines, 4 omxy rounds CONVERGED) + `docs/superpowers/reviews/2026-05-22-pr3a-group-h-schema-drift-review.md` (gsd-code-reviewer 11 findings depth=deep).

이전 갱신: **2026-05-21** (53차 §5 정정 — 박제 vs 코드 mismatch catch + canonical PR 순서 박제):
- **omxy 적대적 검토 5 rounds CONVERGED + 누적 16 BLOCKERS catch & fix** (R1 6 + R2 4 + R3 6). 정정 spec doc: `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md`. 21 BLOCKERS 박제 (16 catch + 5 정정 박제).
- **Group H Critical 박제 (신규, 54차 §3에서 해소됨)** — `stock_reports` schema drift + report page crash 위험 (Hard gate 선행 필수):
  - ~~`tudal/src/lib/data/admin-reports.ts` `getReportByTicker` + `transformStockReportRow` = **mapping/validation 0**~~ ✅ 54차 §3 PR3a 해소
  - ~~`tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` header `section0.conviction` **early deref**~~ ✅ 54차 §3 PR3a 해소
  - ~~Section 0~7 entire nested deref~~ ✅ 54차 §3 PR3a 해소
  - ~~Section 8 shape mismatch~~ ✅ 54차 §3 PR3a dual-shape parser 해소
  - DB 0003: `stock_reports.section_0~8` 컬럼 모두 nullable. 0017 `commit_persona_eval`은 `section_8` jsonb만 INSERT/UPDATE + `consensus_badge` ADD. **section_0~7는 PR3b writer 본문 구현 후 채워짐** (PR3a는 nullable validated transformer + fallback UI로 PR3b 전 ship-safe).
  - ~~**PR3a Hard gate**~~ ✅ **해소** (54차 §3 PR #12 MERGED `0813a41`).
- **Group E (신규) 박제** — `tudal/src/lib/report/writer.ts` = `commitTickerReport` + `commitSectorReport` 함수로 `section_8` jsonb commit만 가능. **Section 0~7 본문 작성 path 미구현**. `parseSectorContentStrict`는 Section 8 parser only. 후속 **PR3b** (writer Section 0~7 본문 구현 = document-specialist + analyst + writer + critic 4-step) 별개 진행 — PR1 cron 가동 후 가능 (PR3a Hard gate는 별도).
- **Group D 박제 — dangling server action**:
  - `tudal/src/app/(admin)/admin/track-record/actions.ts::triggerMonthlyPersonaEvalAction` = **dangling server action** (export 존재 / page render·import 0 / cron real 0 / UI caller 0). UI wiring PR4 + cron wiring PR1에서 해소.
- **Group B 박제 — short_list_30 Tier 0 단독** **[→ 73차 supersede 2026-06-09: 메인 path 가동됨]**:
  - ~~53차 당시 AI 미평가 30 rows 박제~~ → **현재 production = 실 AI 선정**. `short_list_30` 2026-06-01 = **AI 30**(consensus_badge/ai_score populated, 🟣20/🟢7/🟡2/🔵1), 풀 P3 실행 완료(73차, PR #109 main `179d745`, cost_log 2026-06 2611행 ₩24,655.64, 양 run succeeded). 2026-05-01 30 rows = Tier0 incumbents 보존. **fallback(Tier0 단독)은 이제 AI 키 미발급 시에만** 해당.
  - 메인 path = Tier 1 AI 30 선정 — **가동 완료**: W0~W3 엔진(멀티프로바이더 Sonnet×6+GPT×5 panel → R2 debate → Opus judge + GPT dual-judge → 단/중/장 top 10 = 30). 매달 자동화는 Vercel cron + 주간 tier0 producer USER 게이트.
- **Group C 박제 — cron monthly-batch mock dry-run only**:
  - `tudal/src/app/api/cron/monthly-batch/route.ts` = mock dry-run only. 실 AI 호출 없음. PR1 후속 implementation으로 enable 필요 (Task 12 박제 "활성"은 실제로 mock dry-run).
- **Group F 박제 — Track Record 의미 재정의**:
  - `tudal/src/app/(admin)/admin/track-record/page.tsx` = 누적 성과 대시보드만 (5 summary cards + 월별 + 버킷별 + Counterfactual). **trigger button 0**.
  - 정정 후 = 누적 성과 + 과거 월별 리포트 아카이브를 한 페이지에 둘 다 (탭 분리). PR4 후속.
- **Regen path 박제 — UI 존재 + Regen UI + quota counter 박제 OK, 실 AI 재생성 실 호출 0** (OMXY R1 BLOCKER 6):
  - 종목별 'Regen' 버튼 UI + quota counter 박제 OK 존재 (`/admin/report/[ticker]/regenerate` + regenerate-panel.tsx + regen_counter race-safe CAS).
  - 실 AI 재생성 호출 = **0** (PR4 wire 후속).
- **canonical PR 순서 박제** (OMXY R2 BLOCKER 2 + R3 BLOCKER 1 정정): **PR2 (Tier 1 AI 30 선정 screening) → PR3a (Group H schema drift fix Hard gate · PR1 선행 필수) → PR1 (cron monthly-batch real path · server-side only) → PR3b (writer Section 0~7 본문 구현) → PR4 (UI trigger 버튼 + Track Record 탭 + Regen 실 호출 wire)**. Hard gate 위반 시 사용자 종목 클릭 시 page crash inevitable.
- **편집 문서 4개**: ProgressDashboard.md + CLAUDE.md (v3.2 → v3.3 + D23 신설) + 이 문서 (53차 §5 entry + Group H Critical 박제) + S7-RealData.md (T7e.8 fallback 명시 + Step 3c PARTIAL + 53차 §5 변경 이력). **코드 변경 0건**. 회귀 무관 (docs only).

이전 갱신: **2026-05-20** (53차 §1 — Tier 2 stacked PRs 머지 + 마이그 production apply 완료): **52차 PR #4 (Tier 2 SoT) + PR #5 (Tier 2 impl) + 53차 §0 PR #6 (stale-fix) 3개 모두 MERGED + 마이그 0018·0019 production apply + SECURITY DEFINER triad 검증**. main HEAD `8108d058` · omxy 77 rounds CONVERGED 누적 (53차 §1 R1~R5 12 BLOCKERS catch) · 게이트 ALL GREEN (build 25 / lint 0 err / **test:ci 606 / 63 files** / tsc clean) · Vercel canary 4/4 OK. main에 박제된 코드 SoT:
- `tudal/src/lib/screening/canonical-sectors.ts` (CANONICAL_SECTORS 14 + SECTOR_PERSONA_COUNT=14 + TIER2_CALLS_PER_TICKER=25 + SUB_TAG_CROSSWALK 7 + PRIMARY_OVERLAY_BY_SECTOR 14×2 + SUB_TAG_OVERLAY_ROLES 7×2 + LEGACY_ALIAS_MAP + resolveSlotTemplate)
- `tudal/src/lib/report/writer.ts` (commitSectorReport + parseSectorContentStrict 추가, Core 11 path 변경 0)
- `tudal/src/lib/screening/persona-eval.ts` (runSectorEval scaffold, Core 11 path 변경 0)
- `tudal/src/lib/data/mock-admin-committee-personas.ts` (CANONICAL_SECTOR_PERSONAS 196 stub + getCanonicalSectorPersonas, legacy 5인 lean 105 격리 보존)
- `tudal/supabase/migrations/0018_short_list_30_sub_tags.sql` (jsonb 컬럼 + GIN index, **production apply ✅ `20260520141739`**) — smoke: sub_tags=jsonb / GIN idx 존재 / row count 30 unchanged
- `tudal/supabase/migrations/0019_commit_sector_personas.sql` (SECURITY DEFINER + SELECT FOR UPDATE race-free + section_8 coalesce/jsonb_build_object Core 보존 + integer/non-negative validation + DELETE persona_layer='sector' first → INSERT 14 idempotency, **production apply ✅ `20260520141835`**) — smoke: prosecdef=true / proconfig="search_path=public, pg_temp" / anon_exec=false / auth_exec=true
- +46 tests (legacy.5lean + canonical-sector-personas + canonical-sectors 추가 + persona-eval 추가 + writer 추가 + strict parser)

**📌 Kevin v3.1 reference (Step 3b production prompts quality target — main 보존, 53차 §0 박제 확정)**: `Document/Outputs/Report-Alteogen_196170_v3-Readable.{md,html}` + `Document/Service/Report/ReportFramework-v3-{DraftPhilosophy,NarrativeDesign,Decisions,ValuationTrial}.md` + `Document/Service/Report/ReaderAnalogyCards-ConstructionToBio.md` + `Document/Outputs/Report-Samchundang_000250.{md,html}` + `Document/Service/Report/ReportFramework-BioSector.md` + `Document/Outputs/BioSectorReport-Alteogen_196170.md` + `Document/Outputs/Report-Alteogen_196170_v{1,2}.{md,html}`. IMVCOM 4 commits 모두 main의 ancestor (53차 §0 박제) — Step 3a SKIPPED, Step 3b 시 위 자료 직접 reference.

**현재 Runbook 위치**: HANDOFF §2.1 Step 3b ✅ DONE (53차 §3 — branch `feat/tier2-step3b-prompts-196` Layer (a~g) ALL CONVERGED, PR #8 OPEN MERGEABLE CLEAN, 207 persona Kevin v3.1 quality 본문 완성). main HEAD `02c7947a` (53차 §2 PR #7 MERGED). Step 1c/3a/B-17c/B-17e 모두 해소. **다음 = USER PR #8 review/merge → Step 3c caller wiring**.

이전 갱신: **2026-05-20** (50차 §2 출시 Runbook 재구조 R14~R16 CONVERGED): HANDOFF §2 신규 15-step 선형 Runbook + §2.0 default-progress policy + §2.1 Step 6-column matrix + §9 Owner 분리 박제.

**2026-05-19** (50차 §1 B-17 EXECUTED ✅): **S7a Anthropic wrapper Task 17/17 ✅ + 50차 §1 B-17 EXECUTED (push + 0016a + 0017 + PR #1) + omxy 50 rounds CONVERGED**. PR #1 OPEN, Vercel preview Ready, 사용자 review/merge 대기.
- **Branch**: `feat/s7a-anthropic-wrapper` (main에서 분기, **34+ commits ahead** (33 pre-박제 + 1 50차 §1 박제 commit + R11 cleanup + 후속 minor docs cleanup 포함; 정확 값 `git rev-list --count main..HEAD`), **push 완료**).
- **HEAD**: **50차 §1 B-17 박제 commit** 또는 그 이상 (HEAD direct ref via `git log`). **B-17 execution head** = `a9c9c93` (fix S7a 0016a).
- **PR #1 OPEN**: https://github.com/son00326/New_Project_KR_Stock/pull/1 (base main ← head feat/s7a-anthropic-wrapper, fast-forwarded to 50차 §1 B-17 박제 commit; B-17 execution head was `a9c9c93`). **Vercel preview Ready**: https://tudal-git-feat-s7a-anthropic-wrapper-son00326s-projects.vercel.app
- **Production migrations applied** (Supabase project `rbrpcynhphrpljbjirfo`):
  - `drop_legacy_cost_log` (version 20260519135017, 0016a — DO-block row-count guard + cascade drop)
  - `cost_log_and_batch_runs` (version 20260519135341, 0017 S7a Anthropic schema)
- **신규 마이그 파일 (50차 §1)**:
  - `tudal/supabase/migrations/0016a_drop_legacy_cost_log.sql` + `.rollback.sql` — legacy cost_log (0005+0008 OpenAI schema) cleanup precursor with DO-block row-count guard. Rollback recreates 0005+0008 final shape (id/ts/month/model/purpose/tokens_prompt/tokens_completion/cost_krw/meta/ticker/persona_id/section + 4 indexes + RLS policy).
- **B-17 migration recovery cleanup 2건** (omxy R3+R6 catch):
  ① legacy cost_log via recorded migration **0016a** (row_count=0 verified at apply time, DO-block guard refuses drop if rows exist)
  ② orphan unique index `committee_votes_report_persona_uniq` promoted in-place via `ALTER TABLE … ADD CONSTRAINT … UNIQUE USING INDEX …` (one-off execute_sql, fresh-DB unaffected since 0017's `if not exists in pg_constraint` guard works correctly on fresh DB)
- **schema-existence smoke 7/7 PASS** (post-apply): cost_log table + monthly_batch_runs table + stock_reports.consensus_badge column + acquire_batch_lock RPC + commit_persona_eval RPC + commit_badge_only RPC + committee_votes_report_persona_uniq constraint.
- **신규 모듈 (Task 1~17 완료)**:
  - `tudal/supabase/migrations/0017_cost_log_and_batch_runs.sql` + `.rollback.sql` — cost_log + monthly_batch_runs + 3 RPC(acquire_batch_lock / commit_persona_eval / commit_badge_only) + partial unique `(ticker, month) WHERE is_latest=true` + `stock_reports.consensus_badge` 컬럼. RLS 3종 + revoke public/anon + grant authenticated. **production apply 보류 = B-17**.
  - `tudal/src/lib/report/section-8-schema.ts` + tests — zod canonical contract (partA refine 0 or 14, partB 3~5, partD 11).
  - `tudal/src/lib/cost/pricing.ts` + tests — anthropic-pricing.ts wrapper (R5 정정), cache_creation×1.25 / cache_read×0.10, MAX_COST_PER_CALL_KRW + HARDCAP_KRW = 400_000, S7A_MODEL='claude-opus-4-7'.
  - `tudal/src/lib/ai/prompts/{user-prompt-template, render-user-prompt, personas/×11}.ts` + tests — Q4 persona contract. chair Q5b 5종 배지 용어 정합.
  - `tudal/src/lib/cost/cost-logger.ts` (Task 5, flag-aware + preflightHardcap + orphan 처리) + 5 tests.
  - `tudal/src/lib/ai/anthropic-client.ts` (Task 6, wrapper) + 6 tests.
  - `tudal/src/lib/screening/consensus.ts` (Task 7, 5종 배지 🟢🔵🟣🟡⚪ + isTopTier + bucket rank) + 10 tests.
  - `tudal/src/lib/data/admin-batch-runs.ts` (Task 8, lock CRUD) + 3 tests.
  - `tudal/src/lib/screening/persona-eval.ts` (Task 9, orchestration warm-first + lock + preflight) + 7 tests.
  - `tudal/src/lib/report/writer.ts` (Task 10, section_8 jsonb writer + commit_persona_eval RPC 호출) + 4 tests.
  - `tudal/src/lib/admin/format-error.ts` (Task 11, +6 한국어 매핑 코드) + 6 tests.
  - `tudal/src/app/api/cron/monthly-batch/route.ts` (Task 12, mock dry-run only refactor).
  - `tudal/src/app/(admin)/admin/track-record/actions.ts::triggerMonthlyPersonaEvalAction` (Task 13, admin server action).
  - `tudal/.env.example` (Task 14, AI_COST_LOG_REAL_INSERT_ENABLED + AI_PROMPT_CACHE_ENABLED).
  - SoT 박제 (Task 15): D19 5종 배지 + ServicePlan-Admin §4.2.1 partA canonical + ReportFramework v2.4.
  - mock e2e admin trigger (Task 16): 330 calls + 30 reports + ⚪ branch coverage.
- **zod 신규 설치**: package.json + package-lock.json (Task 2).
- **omxy 적대적 검토 결함 catch + fix (10건)**:
  - R1 BLOCKER 1: PostgreSQL `IF <null>` pass-through → `is null or ... is distinct from ...` + `coalesce(v->>'vote','')` (c14fb2e).
  - R1 BLOCKER 2: section_8 partA `z.array()` 1~13 통과 → `.refine(len === 0 || len === 14)` (c14fb2e).
  - R2 BLOCKER: `committee_votes.vote` enum mismatch → RPC INSERT case 매핑 (BUY→approve / HOLD→abstain / SELL→reject) + `invalid_vote_row` guard (a2d2c04). writer는 BUY/HOLD/SELL literal 유지.
  - Task 9 acquireBatchLock signature 불일치 → string positional (Plan R3 BLOCKER 6 정정 유지).
  - Task 10 core_revote schema lowercase normalize.
  - Task 11 `formatAdminError` → `formatErrorMessage` 함수명 (plan 오기).
  - Task 13 R1: `fetchFinancials` silent `{}` 금지 → error throw (ce11f02).
  - Task 15 R1: consensus_badge emoji enum + §4.2.1 partA required clarify (a92181c).
  - **Final R1 BLOCKER**: 0017 RPC `created_at`/`updated_at` 컬럼 미존재 → `generated_at` + `to_date(p_month || '-01', ...)` cast (b62bb11).
  - **Final R2 BLOCKER**: 0017 `stock_reports_month_ticker_uniq` UNIQUE 추가가 versioning contract와 충돌 → constraint 제거 + RPC `ON CONFLICT (ticker, month) WHERE is_latest = true` partial unique (a61bbf5).
- **omxy debate 누적**: **50 rounds CONVERGED** (25 진입 전 + 13 task R1+R2 + 3 49차 final R1~R3 + 1 49차 박제 R1 + 2 50차 §0 박제 R2+R3 (R1 CONTINUE 불산정) + 6 50차 §1 B-17 R1~R6). 50차 §2 Runbook docs verification rounds (R14+) = post-execution docs verification으로 not counted (durable wording — 추가 cleanup commits 시에도 stable 50 유지).
- **50차 §1 B-17 omxy R1~R6 catch (요약)**:
  - R3 catch: 0017 cost_log conflict with 0005+0008 chain (fresh-DB도 fail) + Option B `0017a_` lexsort fail (`_` < `a`) → Option B′ `0016a_` 명명
  - R4 catch: missing row-count safety guard before destructive drop → DO-block precondition
  - R6 catch: orphan unique index `committee_votes_report_persona_uniq` (49차 manual testing 잔재) → promote-in-place via UNIQUE USING INDEX
- **검증 게이트 (a9c9c93 B-17 execution head + 50차 §1 박제 commit 후)**: build OK · lint 0 errors · test:ci **522 pass / 60 files** · tsc clean (baseline 유지).
- **잔여**: **사용자 PR #1 review/merge** (1) `gh pr view 1` 검토 (2) Vercel preview Ready URL QA (3) `gh pr merge 1 --merge` 또는 `--squash`.
- **다음 1순위**: 사용자 PR #1 review/merge (HANDOFF §3 표 B-17b).

**2026-05-13** (48차): **§7 P3.2 + P3.4 완료 ✅**.
- **마이그 0016 (`accept_shortlist_rpc`)**: 파일 박제 완료 — `tudal/supabase/migrations/0016_accept_shortlist_rpc.sql` + rollback. **DB apply 보류** (사용자 트리거 대기, B-16 큐). signature: `accept_shortlist_with_snapshots(p_month text, p_shortlist_generated_at timestamptz, p_snapshots jsonb) returns jsonb` SECURITY DEFINER + `set search_path = public, pg_temp`. plpgsql 단일 txn(auto-rollback). auth.uid()로 spoof 차단. auth 순서 = `auth_unavailable` 우선 → `is_admin()` → `admin_required` (omxy R2 정정). `jsonb_typeof array` guard. portfolio_approval INSERT + portfolio_snapshot bulk INSERT (`jsonb_array_elements`). EXCEPTION unique_violation → `get stacked diagnostics constraint_name` 분기 (`portfolio_approval_final_month_uniq` → `already_finalized` return / 기타 → re-raise). revoke from public + grant to authenticated.
- **acceptShortlistRpc wrapper**: `src/lib/data/admin-approvals.ts`에 신규 추가 — snake-case payload 변환 + `{approval_id, is_final}` 또는 `{error: 'already_finalized'}` 분기 + unexpected payload shape 가드.
- **actions.ts acceptShortList → RPC 일원화**: `src/app/(admin)/admin/portfolio/actions.ts:267-302` createPortfolioApproval+insertPortfolioSnapshots 직접 호출 제거 → `acceptShortlistRpc({month, shortlistGeneratedAt, snapshots})` 단일 호출. orphan G-1(approval 성공 + snapshot 실패) 차단. `isUniqueViolation` catch 잔존 — RPC가 snapshot-side unique 등 비-approval 23505를 re-raise할 경우 defensive 매핑 (omxy R3 권고: 주석 명시).
- **신규 테스트 +34** (429 → 463):
  - G-cron-auth +12 (4 cron × 3 unauth: no header / wrong secret / Basic scheme)
  - G-wrapper-error +8 (5 wrapper characterization tests, raw passthrough/wrap 박제)
  - G-FE-map +9 (5 specific Korean + 2 prefix edge + 2 dev-only console.warn)
  - acceptShortlistRpc +4 (happy / already_finalized / raw error re-throw / unexpected payload guard)
- **omxy cmux pair-debate 3 rounds 모두 CONVERGED**: R1 scope 제안 → R2 정정 8건 채택 (D 마이그 5건 + 추가 3건) → R3 실행 결과 + 권고 4건 (test count 실측 463 명시 / isUniqueViolation 잔존 명시 / SoT 범위 / apply order).
- **검증 게이트**: `npm run build` exit 0 (25 routes) · `lint` 0 errors · `test:ci` exit 0 (**50 files / 463 tests pass**; +34 vs 429) · `npx tsc --noEmit` exit 0.
- **Git**: 본 commit 2건 + 47차 `03d9bc7` 모두 `git push origin main` 완료 ✅, Vercel auto-deploy 트리거. **B-16 해소**. 마이그 apply order: 0010 → 0012~0014 → 0015a → **0016 production apply ✅** → (0011 = S8 reserve).
- **anon revoke hotfix**: 0016 apply 직후 advisor `anon_security_definer_function_executable` 신호 발견 → Supabase가 신규 `public.*` 함수에 anon default grant 자동 부여 → follow-up 마이그로 `revoke from anon` apply + 0016 SoT 파일에도 라인 추가. ACL 최종 `{postgres=X, authenticated=X, service_role=X}`. advisor anon WARN 0건 유지.
- **잔여**: S7a(B-6 AI 키 트리거) · P3.1(D20 컴포넌트, S7a 시드 후) · P3.3(error taxonomy 옵션 A/B 사용자 결정).

**2026-05-13** (46차): **P0·P1 완료 + production hotfix push (ahead 39 해소) + SoT cleanup ✅**.
- **마이그 0015a (`definer_execute_lockdown`)**: Supabase project `rbrpcynhphrpljbjirfo`에 apply. SECURITY DEFINER 5 함수 PUBLIC + anon EXECUTE 회수 + 활성/RLS 필수만 authenticated 유지. **advisor anon WARN 5→0 / authenticated WARN 5→3** (omxy Round 2 정정: 미사용 mark_alert_read + record_alert_exit_decision authenticated도 회수). proacl AFTER: is_admin/raise_portfolio_dispute/resolve_portfolio_dispute = `auth=X, svc=X`; mark_alert_read/record_alert_exit_decision = `svc=X`만.
- **format-error 헬퍼**: `tudal/src/lib/admin/format-error.ts` 신규 — KOREAN_MAPPINGS 30+ 코드 + `accept_gate_blocked:*` prefix handler + Korean passthrough + dev-only warn. 5 client panel(portfolio-panel / regenerate-panel / exit-decision-form / settings-panel / brokerage·binance form+delete-button) ad-hoc switch 제거. credentials lib raw DB passthrough wrap (brokerage.ts + exchange.ts: 'Invalid id format' → '잘못된 ID 형식입니다', 'pending-s8' → 'Binance 키 저장은 S8 자동매매에서 활성화됩니다', DB error.message → '저장소 처리 중 오류가 발생했습니다' + dev console.error).
- **(admin) boundary 3 신규**: `tudal/src/app/(admin)/loading.tsx` + `error.tsx` + `not-found.tsx` — Next.js App Router 라우트 그룹 boundary 한국어.
- **props cleanup**: reportLinksEnabled / reportLinkEnabled / actionsEnabled / actionsDisabledMessage 4 prop + 분기 단순화 + canLinkDeltaReport 단일 인자화. delta-banner test 4→3 케이스.
- **운영 SOP**: `DQ7-Credentials.md §6.10` — 0009 rollback production 금지 + 3 조건 체크리스트(brokerage_connection 0건 + exchange_connection 0건 + 사용자 명시 승인).
- **Production hotfix push**: HANDOFF B-15 ahead 39 commits + 46차 batch → `git push origin main` → Vercel auto-deploy. origin/main이 T7e.4 이전 stale 코드(`real_persistence_not_configured` return 4 곳)였음. HEAD = `4c6eea7` 동기.
- **omxy cmux pair-debate 7 rounds**: R1·R2(P0.1 마이그) → R3·R4(hotfix push 전략) → R5·R6(P1.1 헬퍼) → R7(P2.1 SoT scope). 모두 CONVERGED. CMUX_WORKSPACE_ID = workspace:7, peer surface:22 (omxy/Codex gpt-5.5 high).
- **검증 게이트**: `npm run build` exit 0 (25 routes) · `lint` 0 errors · `test:ci` exit 0 (**50 files / 429 tests pass**; 이전 49/384 +1/+45 — format-error 40 + dispute panel re-aligned + credentials passthrough 2 + delta-banner trim 1) · `npx tsc --noEmit` exit 0.
- **Git**: 46차 commits 3건 = `9661037` (P0.1 마이그 + P0.3 SOP + P1.2 문구) + `4c6eea7` (P1.1 헬퍼 + P1.3 boundary + P1.4 props cleanup) + **본 P2.1 commit** (SoT cleanup).
- **잔여**: P0.2 HIBP 토글(사용자 dashboard, B-2A) · P2.2~P2.4(403→401, news-sweep 주석, .env diff, DQ7 진입점 stale 제거) · P3(T7a.11 D20 컴포넌트 + accept_shortlist RPC + wrapper error taxonomy + 신규 테스트) · P4(mock 정리 backlog 자연 진행) · S7a(B-6 AI 키 트리거).

**2026-05-12** (45차): **T7e.8 DART Signal 4·5 production 적용 ✅**.
- **DB/migration 상태**: Supabase project `rbrpcynhphrpljbjirfo`에 0013 `dart_corp_codes` + 0014 `dart_financial_cache` 적용 완료. 0011 슬롯은 계속 BL-KRIT-8(S8 자동매매) 보존.
- **corp_code seed**: `scripts/seed_dart_corp_codes.py`가 실제 DART `corpCode.xml`(corp_cls 없음)을 ticker↔corp_code source로 사용하고, KRX ticker set(pykrx)으로 market을 매핑한다. KRX 인증(`KRX_ID`/`KRX_PW`) 없으면 fail-fast.
- **DART Signal wiring**: `scripts/dart_signals.py` + `scripts/screen_shortlist_tier0.py`로 CFS→OFS fallback, annual/quarterly cache, standalone quarter, YoY earnings momentum(Signal 4), 5-metric quality(Signal 5), universe-wide quality composite를 적용한다. `scripts/screen_shortlist_tier0.py`는 300 ticker마다 Supabase client를 갱신해 REST stream limit을 회피한다.
- **production 적용 결과**: `short_list_30` 2026-05-01 30 rows UPSERT(10 short / 10 mid / 10 long). dry-run preview↔DB top 3 ticker/composite 일치, exit 0, client refresh 7회 정상, RemoteProtocolError 0건.
- **분포**: short=모멘텀 10, mid=실적 모멘텀 8 + 모멘텀 2, long=퀄리티 10. 이전 Tier 0 v1 평탄화(Signal 4·5=0)를 DART 실 standalone/quality 기반 점수로 교체.
- **산출물**: `scripts/out/tier0_2026-05_dart_apply.csv`, `scripts/out/tier0_2026-05_dart_apply.log`, `scripts/out/short_list_30_2026-05_pre_apply_backup.sql`.
- **검증 기준**: Python unittest 27 pass + `npm run build && npm run lint && npm run test:ci && npx tsc --noEmit` exit 0 (test:ci 384 pass / 49 files). 다음 구조적 작업은 T7e.7 RLS 브라우저 수동 QA.

**2026-05-08** (40차): **T7e.6 access-logs/performance/decision-tree Supabase 전환 ✅ + 신규 마이그 0건 + 단일 SoT 박제**.
- **신규 모듈**: `tudal/src/lib/data/admin-access-logs.ts` — `getRecentAdminAccessLogs(limit)` boundary stub `[]` 반환 (실 access_log source는 T7e 범위 밖). BL-20 7일 단일 어드민 자동 바이패스는 stub이 false 분기를 자연 산출하므로 영구 비활성. 실 source 정의 시 함수 본문만 SELECT로 교체.
- **신규 모듈**: `tudal/src/lib/data/admin-performance.ts` — `PortfolioSnapshotDbRow` 타입 + `transformPortfolioSnapshotRow` snake→camel + `getPerformanceSummary(month)` (snapshot SELECT + `src/lib/performance/sharpe`/`mdd`/`cap-months` 순수 로직 호출 → 5 KPI) + `getMonthlyPerformance(monthRange)` (월별 집계) + `getBucketPerformance(month)` (버킷별 집계) + `getCounterfactual()` returns `null` (D11/S9 deferred — AI 비중 시계열 저장 정책 박제 후 산출 가능).
- **신규 모듈**: `tudal/src/lib/data/admin-decision-tree.ts` — `getDecisionTreeSnapshot()` (`portfolio_snapshot` SELECT → `groupByMonth` → `src/lib/performance/judge`의 `judgeDecisionTree` 순수 로직 호출 → 게이지 3종 + ○/△/✕ 배지).
- **단일 SoT 박제**: performance + decision-tree는 `portfolio_snapshot`(0005, 이미 적용) 단일 테이블 + `src/lib/performance/*` 순수 로직으로 산출. 별도 테이블 신설 0건. **신규 마이그 0건** (0011 슬롯은 BL-KRIT-8 S8 자동매매 E13~E17 보존).
- **page/action 갱신**:
  - `tudal/src/app/(admin)/admin/track-record/page.tsx` — Supabase 전환 (5 카드 · 월별 테이블 · 버킷별 · Counterfactual). counterfactual은 null이므로 "운용 데이터 누적 후 산출" UI 대기 카드로 표시.
  - `tudal/src/app/(admin)/admin/decision-tree/page.tsx` — Supabase 전환 (게이지 3종 · ○/△/✕ 배지 · Recharts Client island).
  - `tudal/src/app/(admin)/admin/portfolio/page.tsx`+`actions.ts` — access-logs를 boundary stub로 전환 (auto-relief 분기는 [] 입력으로 자연스럽게 false).
- **삭제**: `tudal/src/lib/data/mock-admin-access-logs.ts` (39 lines) · `tudal/src/lib/data/mock-admin-performance.ts` (171 lines) · `tudal/src/lib/data/mock-admin-decision-tree.ts` (29 lines). `mock-admin-consistency.test.ts`에서 관련 assertion 1개 제거.
- **신규/보강 테스트**: `__tests__/admin-access-logs.test.ts` 2개 (boundary stub + portfolio integration) + `__tests__/admin-performance.test.ts` 15개 (transformer 7 + getPerformanceSummary/Monthly/Bucket/Counterfactual 8) + `__tests__/admin-decision-tree.test.ts` 2개 (snapshot from portfolio_snapshot rows).
- **검증 게이트 회귀**: `build` exit 0 (25 routes 동일) · `lint` 0 errors · `test:ci` exit 0 (**49 files / 381 tests pass**; 이전 46/362 +3/+19, consistency 1 제거 반영) · `npx tsc --noEmit` exit 0.
- **부분 마이그레이션 boundary 종료점**: T7e.6으로 admin 잔존 mock 3종 정리. `mock-admin-{report,committee,approvals,snapshots,shortlist}` 등은 consistency 테스트 fixture로 보존(코드 경로에서는 사용 안 함). 다음 boundary는 T7e.7 RLS QA. T7e.8 Tier 0 seed는 production 30 rows 적용 완료.

**2026-05-08** (39차): **T7e.5 regen_counter Supabase 전환 ✅ + race-safe CAS + 신규 마이그 0건**.
- **신규 모듈**: `tudal/src/lib/data/admin-regen-counters.ts` — `RegenCounterDbRow` 타입 + `transformRegenCounterRow(row)` snake→camel + `computeNextMonthResetAt(month)` 순수 helper(다음 달 1일 00:00 KST ISO) + `getRegenCounter(ticker, month)` `maybeSingle` SELECT(없으면 null) + `incrementManualRegenCount(ticker, month)` 4단계 CAS(idempotent INSERT 23505 무시 → SELECT 현재 값 → cap 도달 시 즉시 `cap_exhausted` → `UPDATE WHERE id AND manual_count = current_value` 비교-스왑, RETURNING 비면 `regen_counter write conflict` throw).
- **race 보호 결정**: 마이그 0005에 이미 적용된 UNIQUE(ticker,month) + CHECK(manual_count ≤ 2) + Postgres 행 잠금 위에서 4단계 CAS로 충분. 신규 마이그/RPC 0건. **0011 슬롯은 BL-KRIT-8(S8 자동매매 E13~E17) 보존**. DB CHECK가 마지막 안전망.
- **page/action 갱신**:
  - `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/page.tsx` — `findRegenCounter(MOCK_ADMIN_REGEN_COUNTERS, ...)` → `await getRegenCounter(...)`. row 부재 시 counter=null → remaining=2 / allowed=true (기존 순수 helper 그대로).
  - `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/actions.ts` — `MOCK_ADMIN_REGEN_COUNTERS` import + `real_persistence_not_configured` 분기 제거. `incrementManualRegenCount` 호출 + `{ ok: true } / { ok: false, reason: "cap_exhausted" }` 응답 분기. throw 메시지를 `regen_counter_lookup_failed`/`regen_counter_write_failed`/`regen_counter_write_conflict` 3종으로 분류.
  - `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/regenerate-panel.tsx` — `formatErrorMessage()` 헬퍼 도입. `manual_cap_exhausted`/`cost_hardcap_40man`/`report_not_found`/`report_lookup_failed`/`regen_counter_lookup_failed`/`regen_counter_write_failed`/`regen_counter_write_conflict`/`auth_unavailable` 8종 한국어 운영자 메시지 일원화.
- **삭제**: `tudal/src/lib/data/mock-admin-regen-counters.ts` (본 변경으로 모든 importer 제거됨 → 고아).
- **신규/보강 테스트**: `__tests__/admin-regen-counters.test.ts` 13개 (transformer 1 + computeNextMonthResetAt 3 + getRegenCounter 3 + incrementManualRegenCount 6). `regenerate/__tests__/actions.test.ts` 8→12개(+4: success/cap_exhausted/lookup_failed/write_failed/write_conflict; production-like real_persistence_not_configured 케이스 제거).
- **검증 게이트 회귀**: `build` exit 0 (25 routes 동일) · `lint` 0 errors · `test:ci` exit 0 (**46 files / 362 tests pass**; 이전 45/345 +1/+17) · `npx tsc --noEmit` exit 0.
- **MOCK_ADMIN_COST_LOG 의도적 잔존**: 월 40만원 hardcap의 `isHardcapBlocked(MOCK_ADMIN_COST_LOG, month)` 분기는 그대로. cost_log 실 INSERT/SELECT는 S7a/T7a(Anthropic wrapper + cost_log 적재) 범위. HANDOFF §2.A 명시 가드라인 준수.
- **부분 마이그레이션 boundary 정리**: regen_counter 통로 추가로 `/admin/report/[ticker]/regenerate`도 실 I/O 진입. 시드 부재 상태에서는 카운터=null → 첫 클릭이 INSERT manual_count=1로 들어가는 모양 (T7e.3에서 이미 `reportExistsForMonth` 실 SELECT를 가드해 시드 없으면 그 전에 `report_not_found`로 차단). 다음 boundary는 T7e.6(access/performance/decision-tree).

**2026-05-08** (38차): **T7e.4 approvals/snapshots Supabase 전환 ✅ + `/admin/portfolio` fail-closed boundary 해제**.
- **신규 모듈**: `tudal/src/lib/data/admin-approvals.ts` — `PortfolioApprovalDbRow` transformer + `getApprovalsByMonth(month)` + `getApprovalById(id)` + `createPortfolioApproval(input)` INSERT + `raisePortfolioDispute`/`resolvePortfolioDispute` RPC wrapper. 실제 테이블명은 마이그 0004 기준 단수 `portfolio_approval`.
- **신규 모듈**: `tudal/src/lib/data/admin-snapshots.ts` — `PortfolioSnapshotDbRow` transformer + `insertPortfolioSnapshots(rows)` bulk INSERT. snapshot id는 DB `gen_random_uuid()`에 맡기므로 insert payload에는 id를 싣지 않는다.
- **page/action 갱신**:
  - `tudal/src/app/(admin)/admin/portfolio/page.tsx` — `MOCK_ADMIN_APPROVALS` → `getApprovalsByMonth(month)` Supabase SELECT. `actionsEnabled={false}`와 T7e.4 disabled message 제거 → fail-closed UI boundary 해제.
  - `tudal/src/app/(admin)/admin/portfolio/actions.ts` — Reject는 `createPortfolioApproval`로 실 INSERT. Accept는 fake entryPrice를 금지하며, 실 가격 소스가 없으면 `entry_price_unavailable`로 E4 INSERT 전 중단한다. 실 가격 wiring 후 Day 0 `portfolio_snapshot` rows를 `insertPortfolioSnapshots`로 호출하는 통로는 준비됨. E4 partial UNIQUE race(23505)는 accept 경로에서만 `already_finalized`로 매핑. `raiseDispute`/`resolveDispute`는 일반 UPDATE 대신 0010 security-definer RPC wrapper 사용.
  - `tudal/src/app/(admin)/admin/portfolio/portfolio-panel.tsx` — `entry_price_unavailable`/`approval_write_failed`/`reanalysis_limit_reached`를 한국어 운영자 메시지로 표시.
- **DB 제약 반영**: Reject 2회 UX 응답은 기존대로 `reanalysisCount=2` + `portfolioHoldWarning=true`를 반환하지만, DB `portfolio_approval.reanalysis_count`는 0004 CHECK(≤1)에 맞춰 1로 clamp한다.
- **신규/보강 테스트**: `__tests__/admin-approvals.test.ts` 4개 + `__tests__/admin-snapshots.test.ts` 2개 + `portfolio/__tests__/actions.test.ts` 보강 + `portfolio/__tests__/portfolio-panel.test.ts` 2개. targeted 4 files **23 pass**.
- **검증 게이트 회귀**: `build` exit 0 (25 routes) · `lint` 0 errors · `test:ci` exit 0 (**45 files / 345 tests pass**; 이전 42/333 +3/+12) · `npx tsc --noEmit` exit 0.
- **부분 마이그레이션 boundary 정리**: `/admin/portfolio`는 shortlist seed가 있으면 Reject/dispute/resolve 실 I/O 진입 가능. Accept 버튼은 노출되지만 실 가격 소스 전까지 한국어 메시지와 함께 fail-closed한다. 시드 부재 상태는 기존 빈 UI 유지. 다음 boundary는 T7e.5(regen_counter)와 T7e.6(access/performance/decision-tree).

**2026-05-08** (37차): **T7e.3 reports/committee Supabase 전환 ✅ + boundary 2번째 해제**.
- **신규 모듈**: `tudal/src/lib/data/admin-reports.ts` — `Section0~8`+`Appendix` canonical jsonb shape 타입 + `transformStockReportRow` + `getReportByTicker(ticker, {month?})` Supabase SELECT (is_latest=true) + `reportExistsForMonth(ticker, month)` 존재 검사 + `deriveBucketNeighbors(ticker, items)` 순수 함수(removed 제외 + 같은 bucket 내 rank 정렬). Supabase error는 throw.
- **신규 모듈**: `tudal/src/lib/data/admin-committee.ts` — `transformCommitteeVoteRow` (sector null → undefined, argument_excerpt null → "") + `getVotesByReportId(reportId)` SELECT + `aggregateVotes(votes)` 이관(mock-admin-committee.ts에서 분리).
- **page-level 갱신**:
  - `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` — Supabase 전환. `getActiveShortList()`로 active month 확정 → `getReportByTicker(ticker, { month })` 조회 + `MOCK_ADMIN_SHORTLIST.find` → `shortlist.find` + `getBucketNeighbors` mock → `deriveBucketNeighbors` 실 데이터 파생. recordReportView/viewer 계열은 T7e.6 스코프로 mock 유지.
  - `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/actions.ts` — `MOCK_ADMIN_REPORTS.some` → `await reportExistsForMonth(...)` (try/catch → 신규 에러 코드 `report_lookup_failed`).
  - `tudal/src/app/(admin)/admin/page.tsx` — `reportLinksEnabled={false}` 2곳 제거 (DeltaBanner + BucketSection) → 카드 클릭 활성(Delta REMOVED는 리포트 대기 유지).
  - `tudal/src/app/(admin)/admin/portfolio/page.tsx` — `reportLinksEnabled={false}` 1곳 제거 + actionsDisabledMessage T7e.4만 남기게 단축.
- **신규/보강 테스트**: `__tests__/admin-reports.test.ts` (10개: transformer 3 + getReportByTicker month filter 1 + deriveBucketNeighbors 6) · `__tests__/admin-committee.test.ts` (6개: transformer 4 + aggregate 2). regenerate `__tests__/actions.test.ts`는 `vi.mock("@/lib/data/admin-reports", () => ({ reportExistsForMonth: ... }))` 추가 + `report_lookup_failed` 신규 케이스 1. `components/admin/shortlist/__tests__/delta-banner.test.ts` 2개로 REMOVED delta 링크 차단 회귀 보강.
- **mock 보존**: `mock-admin-report.ts`·`mock-admin-committee.ts` 파일은 그대로 (consistency 테스트 유지). 향후 일괄 정리 예정.
- **검증 게이트 회귀**: `build` exit 0 (25 routes — 동일) · `lint` 0 errors · `test:ci` exit 0 (**42 files / 333 tests pass**; 이전 39/314 +3/+19) · `npx tsc --noEmit` exit 0.
- **부분 마이그레이션 boundary 정리**: shortlist→reports/committee 2번째 해제로 `/admin/report/[ticker]` 클릭 활성. 단, Delta REMOVED 행은 report-backed 대상이 아니므로 계속 `리포트 대기`로 유지. 시드 부재 상태에서는 `/admin` 빈 UI · `/report` 도달 불가 일관 동작. 다음 boundary는 T7e.4(approvals/snapshots) — 현재는 `/portfolio` Accept/Reject만 disabled 유지.

**2026-05-08** (36차): **자율 트랙 §A 진입 — T7e.1 마이그 0010 검증 + T7e.2 shortlist Supabase 전환 ✅**.
- **신규 모듈**: `tudal/src/lib/data/admin-shortlist.ts` (당시 118 lines) — `getActiveShortList({month?, tickerMeta?})` Supabase SELECT + 순수 helper `transformShortListRow(row, meta?)` + `aggregateShortListDelta(items)`. Supabase error는 throw (silent swallow 폐기). T7e.8/0012 이후 `name`/`sector` 컬럼을 우선 read하고, 빈 값이면 tickerMeta → ticker/"미분류" fallback. (**2026-06-03 PR #84**: 미사용 `getShortListDelta()` wrapper dead-code 제거 — 현 상태는 상단 최근 갱신 참조.)
- **신규 테스트**: `tudal/src/lib/data/__tests__/admin-shortlist.test.ts` — Vitest 8개 (transformer 6 + aggregate 2). null 처리·string·numeric 모두 커버.
- **page-level importer 5건 갱신** (mock-admin-shortlist → admin-shortlist):
  - `tudal/src/app/(admin)/admin/page.tsx` — `getActiveShortList()` (latest)
  - `tudal/src/app/(admin)/admin/settings/page.tsx` — `getActiveShortList()` (latest)
  - `tudal/src/app/(admin)/admin/portfolio/page.tsx` — `getActiveShortList()` (latest, month=monthShortlist[0]?.month, 빈 placeholder 분기, createdAt 기반 generated_at)
  - `tudal/src/app/(admin)/admin/portfolio/actions.ts` — sync helper 5종을 `ShortListItem[]` param 받게 리팩터, acceptShortList/rejectShortList 본문 try/catch 진입로 박제, generated_at = createdAt 기반
  - `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` — **mock pair 유지** (T7e.3 boundary, real shortlist + mock report 혼합 시 404 위험 회피)
- **Boundary props (사용자 추가)**: `tudal/src/components/admin/shortlist/{shortlist-row,delta-banner,bucket-section}.tsx`에 `reportLinksEnabled` prop 추가. `/admin`+`/portfolio`에서 `reportLinksEnabled={false}` 전달 → T7e.3 전까지 리포트 클릭 자체 차단. `/portfolio`는 Accept/Reject도 T7e.3·4 전까지 disabled.
- **mock 보존 (T7e.3 스코프)**: `mock-admin-shortlist.ts` 자체는 그대로 유지 (mock-admin-committee/report가 import 중). T7e.3 완료 시 일괄 삭제 예정.
- **Supabase 마이그**: 0010 `alert_event_rls_hardening` 적용 확인 (version 20260505134639) — BL-KRIT-7 ✅ 해소.
- **검증 게이트 회귀**: `build` exit 0 (25 routes, +1 from 24 — 동일 라우트 셋, 카운트만 정정) · `lint` 0 errors · `test:ci` exit 0 (39 files / 314 tests pass; 이전 38/306 +1/+8). 추가로 `npx tsc --noEmit --pretty false` exit 0.
- **Tier 0 데이터 수집 인프라 결정 (B-1)**: pykrx Python 의존성 → Vercel(Node) Edge Function 배제. 로컬 Python 스크립트(scripts/, idempotent upsert · dry-run · CSV 백업 · month 인자 · `--as-of` 기준일 고정 · env 기반 Supabase 접속) 채택. T7e.8에서 구현 완료. 자동화는 S7/S8 안정화 후 GitHub Actions로 승격.
  - **[63차 supersede 2026-06-02]**: 데이터 소스 = **하이브리드** — S1 종가·S2 거래량·universe = **KRX 공식 Open API**(env `KRX_OPENAPI_KEY`, 8서비스 승인, 날짜별 전종목 1콜 → 구 pykrx 종목별 수천 콜 throttle 근본 해결) / S3 외국인 = pykrx(공식 API 미제공=404) / S4·S5 = DART. 선정 실행 = **Vercel cron 청크 워커**(로컬 러너 폐기). 150 시드 S3(pykrx=Python)는 monthly 자동화 시 외부 cron(GitHub Actions). 상세 = ADR D-10/D-11 + HANDOFF §6 63차 entry.
- **세션 외 git status**: 32~33차 잔여(M 12 파일 — alerts/regenerate/cron/credentials/mock-admin-*) + 35차 박제 문서 8건은 본 세션에서 미터치. 커밋 단위 분리는 사용자 결정.
- **Test 파일 보강**: `portfolio/__tests__/actions.test.ts`에 `vi.mock("@/lib/data/admin-shortlist")` 추가 — month 인자에 매칭되는 mock 행만 반환해 기존 5개 시나리오(invalid_input·24h hold·shortlist_month_not_found·viewers_insufficient·auth_unavailable·real_persistence_not_configured) 그대로 유지.

**2026-05-05** (32차): **Supabase 계정 마이그(Kevin → son00326) + 0001~0010 적용(MCP) + Vercel env 갱신 + Production 재배포 + DQ-7 Session 3 자동 부분 해소**.
- **Supabase 신 프로젝트**: `rbrpcynhphrpljbjirfo` (son00326's Org · Free · Seoul region · Security 옵션 기본). 이전 `fpriyjykihxhhvqudvdb` 폐기.
- `tudal/.env.local` 4 키 교체 (gitignored): URL · ANON · PUBLISHABLE · SERVICE_ROLE 모두 새 JWT/sb_publishable/URL.
- 신규 파일 (커밋 대상): `tudal/supabase/config.toml` (Supabase CLI 로컬 stack 기본 설정, `supabase init` 산출) + `tudal/supabase/.gitignore` (`.branches`·`.temp`·`.env.local` 패턴).
- **Supabase CLI**: v2.98.1 설치 (`/usr/local/bin/supabase`, GitHub releases binary 직접 다운로드 — brew는 Xcode 26 요구로 fail). 향후 `supabase db push` 또는 MCP 양쪽으로 마이그 가능.
- **Supabase MCP 등록**: `~/.claude.json` user-scope · HTTP transport `https://mcp.supabase.com/mcp?project_ref=rbrpcynhphrpljbjirfo` · `Authorization: Bearer sbp_...` (PAT) · `✓ Connected`. PAT는 user-scope 저장이라 repo 미커밋. 향후 세션 자동 로드.
- **마이그레이션 9건 적용 (MCP `apply_migration`)**: 0001 sketch skip, 0002~0010 순차 success. 검증 결과 21 테이블 RLS enabled · 9 마이그레이션 (timestamp version) 등록 · `kr_business_days` 2557 row seed (2024~2030).
- **`admin_emails` 3 row INSERT**: shjang1001@gmail.com (메인) · kevinoh816@gmail.com (어드민 2) · son00326@gmail.com (대표).
- **3-게이트 회귀 검증 (신 환경)**: build **24 routes** · lint **0** · test:ci **306 pass / 38 files** (이전 248에서 +58, 회귀 0).
- **Vercel env 8 entries 새 키로 교체**: `vercel env rm` × 8 (1건 status error는 SERVICE_ROLE Development 부재 정상) → CLI add × 5 (Prod+Dev) + REST API `POST /v10/projects/:id/env?upsert=true` × 3 Preview (`created:3 failed:0`). 최종 — URL × 3 env · ANON × 3 env · SERVICE_ROLE × 2 env.
- **Production 재배포**: `vercel deploy --prod --yes` → https://tudal-tawny.vercel.app · `dpl_3FfP5ZU9uz7MqKYc4DD6MfomRJTY` · target=production READY · build 56s · 새 Supabase 환경 적용.
- **Supabase MCP `get_advisors security`**: 10 WARN — 모두 SECURITY DEFINER function (`is_admin`, `mark_alert_read`, `record_alert_exit_decision`, `raise_portfolio_dispute`, `resolve_portfolio_dispute`) anon/authenticated EXECUTE 노출. 함수 본문에 `is_admin()` 가드 박혀있어 비-어드민 호출 시 즉시 거부. 의도된 패턴, 수용.
- **사용자 잔여 = T16 1건만**: Supabase Dashboard → Auth → URL Configuration (Site URL `https://tudal-tawny.vercel.app` + Redirect URLs 4건). T17 Smoke Test는 T16 직후.
- **보안 주의**: 채팅 노출 시크릿 — anon JWT · service_role JWT · DB password · Supabase PAT(`sbp_...`). 작업 종료 후 rotate 권장 (특히 PAT는 son00326 계정 전체 접근 가능).
- **변경 외 코드**: `tudal/src/**` 코드 변경 없음 (env 변경만). 검증 게이트 회귀 0.

**2026-04-30** (31차): **A 문서 갱신 + Naver API 키 .env.local 투입 (BL-KRIT-3 부분 해소)**.
- `tudal/.env.local` 신규 2 키 (gitignored): `NAVER_CLIENT_ID` · `NAVER_CLIENT_SECRET` (line 27-28)
- 코드 변경 0건 (env 추가 외 전부 docs)
- 문서 정정: HANDOFF §1·§4 BL-KRIT-3·§6 외부 신청 표·§12 31차 + ProgressDashboard Last updated·§5 BL-KRIT-3·§7 + 본 문서
- **T5 stale 정정**: ProgressDashboard §5 BL-KRIT-7 "마이그레이션 0009" → **"0010"** (28차 재배정 후 미반영) + 본 문서 체크리스트 "[x] 마이그레이션 0010 파일 생성" → **[ ] 미생성**으로 정정 (잘못 체크된 stale)
- 검증 회귀 0 (env 변경만)
- **보안 주의**: 채팅 히스토리 노출 키 — Vercel env 투입 전 Naver Developers 콘솔에서 1회 rotate 권장 (DQ-5 Supabase anon 패턴)
- **사용자 다음 세션 잔여 불변**: T16 Supabase Redirect URL · 0009 마이그레이션 실 DB 적용 · T17 Cron dashboard + Smoke Test

**2026-04-22** (30차): **DQ-7 Session 3 부분 진행 — Vercel 첫 production 배포 도달**.
- 새 파일: `tudal/scripts/rotate-cred-mek.mjs` (271 lines · MEK 로테이션 도구 · `--old`/`--new`/`--dry-run` · `.env.local` 자동 로드 · service_role SELECT + memory verify + UPDATE · `.ts`→`.mjs` deviation 박제)
- `.env.local` 신규 3 키 (gitignored): `API_CRED_MASTER_KEY` · `CRON_SECRET` · `ADMIN_REP_EMAIL=son00326@gmail.com`
- `tudal/vercel.json` 변경: `news-sweep` `*/15 * * * *` → `0 0 * * *` (Vercel Hobby plan cron daily 제약 회피)
- `.gitignore` (root): `.vercel/` 추가 (보안 핫픽스 — repo root에 .vercel 생성됐는데 패턴 누락)
- `.vercel/` 위치: **repo root** (`/Users/yong/New_Project_KR_Stock/.vercel/`) — rootDirectory=`tudal` 설정 + cwd=tudal에서 deploy 시 `tudal/tudal` path 중첩 회피
- Vercel 인프라:
  - 프로젝트 `son326s-projects/tudal` (projectId `prj_CEev6UO5TehtgWQoPZ6ZRDDLBJF9`, teamId `team_1IMygRXejEWSsLNTJNJIwfeL`)
  - GitHub repo 연결 `son00326/New_Project_KR_Stock` · Production Branch=`main` (CLI/REST 변경 불가, dashboard만)
  - Framework=nextjs · rootDirectory=`tudal`
  - Env 18 entries (7 keys × 2~3 환경): CLI add 11 + REST API `POST /v10/projects/:id/env?upsert=true`로 Preview 7개 보정
  - 첫 production 배포: https://tudal-tawny.vercel.app · `dpl_397UrMfZET9XLbzxsEDShZmCPZQ4` · READY · target=production · 24 routes · build 48s · TypeScript 통과
- Vercel CLI: v41.3.0 → **v52.0.0** 업그레이드 (v41 OAuth flows 모두 deprecated 410)
- commits: `78dc54b` T14 + `4c6f0e2` cron fix · 30차 push 완료(`3c91194..78dc54b` + `78dc54b..4c6f0e2`)
- 검증: build 24 routes · lint 0 · test:ci 248/248 · Vercel build exit 0 · 회귀 0
- **사용자 다음 세션 잔여**: T16 Supabase Redirect URL · 0009 마이그레이션 실 DB 적용 · T17 Cron dashboard + Smoke Test §6.7

**2026-04-22** (28차): **문서 정합 cleanup** — DQ-7 Session 2 완료 후 전수 정독으로 스테일 포인터·구조 불일치 일괄 정리. Archive 이관: `AutoTrading.md`·`AutoTrading-AI구조설계.md` → `Document/Archive/` + ⚠️ 경고 prefix (D11 이전 자동매매 독립 트랙 가정 기반 · S8 AI 어댑터 drop-in 시 참조 보존). S8-AutoTrading.md T8.1 마이그 번호 **0010→0011** 정정(E12는 DQ-7 0009 선행). HANDOFF §1·§4·§11 · ProgressDashboard §1·§5 · CodebaseStatus(이 문서) · CLAUDE.md + ServicePlan.md v1.2→v1.3. 로드맵 순서 재조정은 Step 2로 유예. 코드 변경 0건 · build/lint/test:ci 회귀 0.

**2026-04-22** (27차): **DQ-7 Session 2 Frontend UI 완료** — `/ralph` 자율 루프 3 Wave. 라우트 22 → **24** (+`/admin/settings/brokerage`·`/admin/settings/binance`). 신규 7 파일 + 수정 1 · +881줄. architect(opus) APPROVED · ai-slop-cleaner CLEAN · 3-gate regression green · tests 248/248 (UI component 테스트 인프라 미도입으로 신규 테스트 0 · 회귀 0). commits: `04d1116` T11 secret-input → `289820e` T9+T10 brokerage·binance UI (executor sonnet × 2 병렬) → `240e7dc` T12 sidebar nav → `4140309` HANDOFF 갱신.

**2026-04-22** (26차): **DQ-7 Session 1 Backend·DB 완료** — Inline TDD (crypto 보안 크리티컬). 11 Task 순차.
- `src/lib/crypto/aes.ts` AES-256-GCM encrypt/decrypt + MEK lazy singleton (14 tests · IV uniqueness 100회 · tamper 4 · MEK config 3)
- `supabase/migrations/0009_dq7_credentials.sql` + rollback.sql — E9 재설계(ciphertext/iv/auth_tag 6 컬럼 + mock_mode) + E12 신설(동일 + testnet_mode) + RLS `*_admin_self` 2종. **실 DB 적용은 Session 3**
- `src/lib/credentials/{types,mask,validation,brokerage,exchange}.ts` 5 파일 · Server Actions(`upsert`·`delete`·`list`·`test` stub `pending-s8`) · ActionResult discriminated union · rep guard(ADMIN_REP_EMAIL) · 23505 매핑 · 43 tests
- Integration tests 20 cases (`vi.hoisted` Supabase mock)
- Cleanup: `types/admin.ts` BrokerageConnection·BrokerageScope 제거 · `mock-admin-brokerage.ts` 삭제
- `.env.example` `API_CRED_MASTER_KEY`·`ADMIN_REP_EMAIL` 신규 + KIS/Binance 블록 주석화
- 검증: build 22 routes · lint 0 · test:ci **248 pass** (190 + 58 신규)

**2026-04-22** (25차): **DQ-7 Admin Credential System 재설계 spec 작성 완료** — `Slices/DQ7-Credentials.md` 신규 (858 줄, Q1~Q5 확정). 바이낸스·KIS 키 per-admin UI + AES-256-GCM 암호화 + Vercel 첫 배포 · S7a 선행 · 4 세션 예상. **마이그레이션 번호 재배정**: 0009 = DQ-7 credential (선점) · 0010 = alert_event CHECK 확장 (BL-KRIT-7). 구현은 다음 세션. 코드 변경 없음(docs only).

**2026-04-20** (23차 후속 정정): **S6 ✅ Mock 완료 반영** — Mock Skeleton Stage 1 완성(S0~S6). Mock 동작 19/19 · 실데이터 0/19 · 실 AI 호출 0 · 운용 검증 0일. 진짜 MVP는 S7(실데이터 전환, 미착수) + 운용 검증 후.
- 마이그레이션 0008(cost_log 확장 ticker·persona_id·section + heartbeat_log + RLS 1종)
- src/lib/cost/{anthropic-pricing.ts·dry-run-estimate.ts·aggregate.ts} (BL-18 견적 박제 + M17 집계 + hardcap 가드)
- src/lib/health/heartbeat.ts (M19 분류·메시지·legacy D10 catch-up·heartbeat_missing 페이로드; 72차 target은 Telegram+/admin 2-layer)
- src/app/(admin)/admin/settings/cost/page.tsx — M17 대시보드 (35만 경보·40만 hardcap·Purpose 비중·Top 5·BL-18 시나리오 비교·시연 영역)
- src/app/api/cron/silent-health/route.ts — Vercel Cron 매일 24:00 KST legacy 2채널 + D10 재시도(72차 target: Telegram best-effort + `/admin` durable event/unread badge)
- regenerateReport에 isHardcapBlocked 가드 활성 (S4 stub → 실 활성화)
- vercel.json crons 4건으로 확장 (silent-health 추가, 0 15 * * *)
- src/app/(admin)/layout.tsx — Sidebar nav에 AI 비용·Health 항목 노출
- types/admin.ts 확장: AlertType +cost_warning·cost_hardcap·heartbeat_missing · CostLog·CostMonthlySummary·HeartbeatLog·임계치 상수 5종
- src/lib/data/{mock-admin-cost-log.ts·mock-admin-heartbeat.ts} 신설
- 검증: build 22 routes · lint 0 · test:ci 20 files 190 tests pass

**2026-04-19** (22차): S5b ✅ 완료 반영 — M13·M14·M15 3 Must 달성.

**2026-04-19** (21차): **S5a ✅ 완료 반영** — M10·M11·M12·M18 4 Must 달성.
- 마이그레이션 0006(pipeline_health · news_event · briefing_log · briefing_view_event + RLS 4종)
- src/lib/scheduler/monthly-batch.ts + __tests__ (재시도·실패 처리, 13 tests)
- src/lib/email/resend.ts + src/lib/briefing/compose.ts + __tests__ (브리핑 컴포저, 8 tests; legacy mock adapter — 72차 현행 알림 spec은 email/Resend 미사용)
- src/lib/news/{naver-api.ts · scraper.ts · classifier.ts} + __tests__ (분류기, 12 tests)
- src/lib/health/pipeline-health.ts + __tests__ (5 파이프라인 집계, 8 tests)
- vercel.json (crons 3건: 월간 배치 · 모닝 브리핑 08:00 KST · 뉴스 sweep 15분 주기)
- src/app/api/cron/{monthly-batch, morning-briefing, news-sweep}/route.ts 3 cron 핸들러
- src/app/(admin)/admin/settings/health/page.tsx — 5 파이프라인 × 24h 성공률 + 95% Critical 배너 + 실패 tail 50건
- src/app/(admin)/admin/alerts/{page, [id]/page}.tsx — AlertEvent 이력 + Critical/Warning 뉴스 목록 + 상세
- src/components/admin/briefing/briefing-card.tsx — /admin 상단 브리핑 카드
- src/lib/data/ mock 2 신설(mock-admin-pipeline-health·mock-admin-news) + 2 확장(mock-admin-briefings 5일·mock-admin-alerts 6건)
- types/admin.ts 확장: AlertType에 news_warning·briefing_failed 추가 + PipelineHealth·PipelineHealthSummary·NewsEvent·임계치 상수 3종
- 검증: build 20 routes · lint 0 · test:ci 15 files 128 tests pass

**2026-04-19** (20차): S4 ✅ 완료 반영.
- src/lib/performance/ 6파일(sharpe·mdd·alpha·judge·cap-months·regen-cap) + __tests__ 6 파일 (53 tests 추가, 누적 87)
- /admin/track-record 실동작(5 카드 · 월별 테이블 · 버킷별 · Counterfactual)
- /admin/decision-tree 실동작(게이지 3종 · ○/△/✕ 배지 · Recharts Client island)
- /admin/report/[ticker]/regenerate 실동작(서브라우트 · cap 가드 · cost_log stub 훅)
- 마이그레이션 0005(E5 portfolio_snapshot · E8 regen_counter · cost_log stub + RLS)
- S3 hardening 병행: resolveAdminId · try/catch · dispute trim
- src/lib/data/ 3 mock fixture 신설/확장

**2026-04-17** (19차): S3 ✅ 완료 반영.
- src/lib/portfolio/ 6파일(순수 로직) + 5 __tests__(43 tests) 신설
- /admin/portfolio 실동작(page.tsx 전면 재작성 + portfolio-panel.tsx Client island + actions.ts 4 Server Actions)
- 마이그레이션 0004(E4 v1.3 · E11 kr_business_days · alert_event gating_auto_relief 타입)
- scripts/ 디렉토리 신설 (seed_kr_holidays.py)
- Vitest 4.1.4 셋업 (G-10=b)
- types/kr-business-days.ts 신설 + types/admin.ts v1.3

**2026-04-17** (18차): S2 ✅ 완료 (E2·E3·E10 + 4 mock + 10 섹션 accordion).
**2026-04-17** (16~17차): S1 ✅ 완료 (E1 + 33행 mock + Delta/크리시스 UI).
**2026-04-17** (15차): S0 Foundation 완료 (레거시 제거·Supabase 연결·17 라우트·9엔티티 RLS sketch·디자인 토큰).

---

## tudal/ 현재 상태 (2026-05-13 · S7e T7e.8 완료 / 45차 · 46차 P0·P1 + 마이그 0012~0014 + 0015a 적용 · 48차 P3.2 + P3.4 + **마이그 0016 production apply ✅** · **실데이터 I/O 통로 9종 open** (boundary stub 포함) · **Vercel production 배포 ✅ https://tudal-tawny.vercel.app**)

### 규모
- TypeScript 파일: `src/` 기준 **~160개+** (S7e에서 `admin-shortlist`·`admin-reports`·`admin-committee`·`admin-approvals`·`admin-snapshots`·`admin-regen-counters`·`admin-access-logs`·`admin-performance`·`admin-decision-tree` 9개 실 I/O wrapper와 테스트 추가; `mock-admin-{regen-counters,access-logs,performance,decision-tree}` 4개 삭제)
- 라우트: **25개**
  - **Main 6**: `/`, `/_not-found`, `/login`, `/signup`, `/macro`, `/stock/[ticker]`
  - **Auth 1**: `/auth/callback`
  - **Admin 14**: `/admin`, `/admin/portfolio`, `/admin/alerts`, `/admin/alerts/[id]`, `/admin/track-record`, `/admin/decision-tree`, `/admin/settings`, `/admin/settings/notifications`, `/admin/settings/health`, `/admin/settings/cost`, `/admin/settings/brokerage`, `/admin/settings/binance`, `/admin/report/[ticker]`, `/admin/report/[ticker]/regenerate`
  - **Cron 4** (Vercel Cron): `/api/cron/monthly-batch`, `/api/cron/morning-briefing`, `/api/cron/news-sweep`, `/api/cron/silent-health`

### 기술 스택
- Next.js 16.2.3 + React 19.2.4 + TypeScript strict + Tailwind v4
- UI: shadcn(base-nova) + Lucide + Recharts + Base UI(@base-ui/react) Dialog
- 라우팅: App Router, 라우트 그룹 `(auth)` pass-through / `(main)` Header+Footer / `(admin)` 자체 chrome(로고·사이드바·면책 Footer)
- 인증: Supabase SSR (`.env.local`), `/admin/*` ADMIN_EMAILS allowlist 가드 미들웨어
- **테스트: Vitest 4.1.4** (S3 G-10=b) — node 환경 · `src/**/__tests__/**/*.test.ts` · passWithNoTests · native tsconfigPaths
- 브랜딩: 주픽

### 레이아웃 구조
- `app/layout.tsx` = 최소 HTML + body (Header·Footer 제거됨, 17 라우트 대응)
- `app/(main)/layout.tsx` = Header + Footer (main 라우트용)
- `app/(auth)/layout.tsx` = pass-through
- `app/(admin)/layout.tsx` = 로고·사이드바(**10 nav** · DQ-7 S2에서 `증권사 키`·`거래소 키` +2 · S8에서 그룹 재편 예정)·면책 Footer

### 데이터 레이어 (mock + S7e Supabase real I/O hybrid)
- **실 Supabase I/O wrapper (S7e 진행 중)**:
  - `admin-shortlist.ts` → `short_list_30` active month SELECT + transformer/delta aggregate. DB 미적재 시 빈 목록.
  - `admin-reports.ts` → `stock_reports` active month report SELECT + existence check + bucket neighbor 파생.
  - `admin-committee.ts` → `committee_votes` report_id 기반 SELECT + vote aggregate.
  - `admin-approvals.ts` → `portfolio_approval` month/id SELECT + accept/reject INSERT + dispute/resolve RPC.
  - `admin-snapshots.ts` → `portfolio_snapshot` Day 0 bulk INSERT + transformer.
  - `admin-proposals.ts` → `portfolio_proposal` 월별 AI 제안 SELECT/UPSERT + schema preflight.
  - `admin-regen-counters.ts` → `regen_counter` SELECT + race-safe 4단계 CAS (39차).
  - `admin-access-logs.ts` → `getRecentAdminAccessLogs()` boundary stub `[]` (40차, BL-20 영구 비활성).
  - `admin-performance.ts` → `portfolio_snapshot` SELECT + `src/lib/performance/*` 순수 로직으로 summary/monthly/bucket 산출 (40차). counterfactual은 D11/S9 deferred → null.
  - `admin-decision-tree.ts` → `portfolio_snapshot` SELECT → `groupByMonth` → `judgeDecisionTree` (40차).
- **아직 mock 유지**: report_view_log(T7e.후속), briefing/news/alerts/health/cost 등 후속 S7 phase 대상. (access-logs는 40차 boundary stub로 닫힘, performance·decision-tree는 40차에 portfolio_snapshot SoT로 전환됨.)
- **Main mock** (6): `mock-stocks`·`mock-financials-extended`·`mock-quarterly`·`mock-ohlcv`·`mock-corporate`·`mock-macro`
- **Admin mock 보존**: `mock-admin-report.ts`·`mock-admin-committee.ts`는 consistency 테스트와 mock persona/view-log 의존 때문에 보존. `mock-admin-approvals.ts`·`mock-admin-snapshots.ts`도 consistency fixture로만 남고 `/portfolio` 실 경로에서는 사용하지 않는다.
- **실데이터 현황(76차 audit 기준)**: 실 I/O 통로는 shortlist/reports/committee_votes/portfolio_proposal/portfolio_approval/portfolio_snapshot/regen_counter/access-logs(stub)/performance(snapshot SoT)/decision-tree(snapshot SoT) 10종 open. `short_list_30` 2026-06-01 = **AI 30 rows**(30 consensus_badge/ai_score, 단·중·장 10/10/10)이나 76차 DART fix는 재시드 전까지 미반영. `stock_reports` 2026-06 = **30행 section_0~8+appendix 완결** + `committee_votes` **330**. `portfolio_proposal` 2026-06-01 = **1건 영속 완료**(11종목+현금 12%) / `portfolio_approval` 2026-06-01 = 0 / `portfolio_snapshot` = 0 → Accept 전 화면·성과 일부는 empty 상태.
- **Supabase**: 프로젝트 `rbrpcynhphrpljbjirfo` (son00326 Org · Seoul · Free). `.env.local`은 URL/anon/publishable/service_role/ADMIN_EMAILS 등 신 프로젝트 기준.
- **Auth users**: admin 3명 생성. Magic Link UI는 prefetch 의심 이슈로 비밀번호 우회 사용 중.

### 마이그레이션 (supabase/migrations/)
| 파일 | 내용 | 상태 |
|---|---|---|
| `0001_rls_sketch.sql` | 9엔티티 admin-only RLS 초안 + `is_admin()` 헬퍼 | **sketch 미실행** (0002+가 실 생성) |
| `0002_s1_shortlist30.sql` | admin_emails + `is_admin()` 실 생성 + E1 short_list_30 + RLS | 실 |
| `0003_s2_reports.sql` | E2 stock_reports + E3 committee_votes + E10 report_view_log + RLS + GIN 인덱스 | 실 |
| `0004_s3_approval.sql` (S3) | E4 portfolio_approval v1.3(dispute_reason/gating_auto_relief/reanalysis_count) + E11 kr_business_days(2024~2026 수기 seed) + alert_event check constraint 'gating_auto_relief' | 실 |
| `0005_s4_performance.sql` (S4) | E5 portfolio_snapshot (partial UNIQUE on ticker NULL/NOT NULL) + E8 regen_counter (UNIQUE ticker+month·auto≤1·manual≤2) + cost_log stub (R5 pre-wire) + RLS 3종 | 실 |
| `0006_s5a_automation.sql` (S5a) | pipeline_health (5 파이프라인 × 24h) + news_event (UNIQUE url) + briefing_log (UNIQUE date) + briefing_view_event (dedupe) + RLS 4종 | 실 |
| `0007_s5b_notifications.sql` (S5b) | admin_settings(intraday_mode) + ticker_alert_pref(UNIQUE admin+ticker) + intraday_anomaly_event(UNIQUE dedup_key) + RLS 3종 | 실 |
| `0008_s6_hardening.sql` (S6) | cost_log 확장(ticker·persona_id·section + 인덱스 2) + heartbeat_log(UNIQUE date) + RLS 1종 | 실 |
| `0009_dq7_credentials.sql` (DQ-7 S1) | E9 `brokerage_connection` 재설계(`api_key_ref` 폐기 · `ciphertext/iv/auth_tag` × 2 + `mock_mode`) + E12 `exchange_connection` 신설(동일 구조 + `testnet_mode`) + RLS `*_admin_self` 2종 · `0009_dq7_credentials.rollback.sql` 동반 | **실 적용 완료 (32차)** |
| `0010_alert_event_rls_hardening.sql` (S7e/DQ-7 후속) | E6 alert_event 신설/강화 + AlertType CHECK 12종 + 4 RPC(`mark_alert_read` 등) + RLS select-all/insert-own/update-own | **실 적용 확인 (36차, version 20260505134639)** |

### 타입 정의 (src/types/)
- `stock.ts`·`corporate.ts`·`macro.ts` (main)
- `admin.ts` **v1.3** (S3) — E1~E10 + DISPUTE_REASON_MIN_LENGTH=20 + AlertType 'gating_auto_relief'
- `kr-business-days.ts` (S3 신설) — E11 `KrBusinessDay`

### 순수 로직·도메인 레이어 (S3 신설)
`src/lib/portfolio/` (6 파일):
| 파일 | 책임 | 테스트 |
|---|---|---|
| `approval-logic.ts` | isAcceptAllowed · isUniqueViolation(pg 23505 가드) | 10 cases |
| `business-days.ts` | addBusinessDays · countBusinessDaysBetween (시간 보존) | 7 cases |
| `gating.ts` | computeAcceptGate(24h → D+4 영업일 → 2인 열람 · autoRelief skip) | 6 cases |
| `auto-relief.ts` | detectSingleAdminStreak (windowDays 커스텀) | 7 cases |
| `dispute.ts` | validateDisputeReason(trim ≥20) · canRaiseDispute · isDisputeHoldExpired · isAcceptBlockedByDispute | 13 cases |
| `calendar.ts` | MOCK_KR_BUSINESS_DAYS_2026 + loadKrBusinessDays stub(S5 Supabase SELECT 예정) | — |

### 라우트·Server Actions (S3 신설)
`src/app/(admin)/admin/portfolio/`:
- `page.tsx` — Server Component (Short List 30 필터 · Delta 집계 · D+5 위젯 · 게이팅 계산 · auto-relief 감지 · finalApproval 탐색)
- `portfolio-panel.tsx` — Client island (Base UI Dialog · useTransition · router.refresh · Accept/Reject/Dispute 3모달 · 실시간 20자 카운터 · 48h Hold 배너)
- `actions.ts` — 4 Server Actions real I/O hybrid (`acceptShortList`·`rejectShortList`·`raiseDispute`·`resolveDispute`). shortlist/report-view/access-log 게이트는 후속 T7e.6까지 일부 mock 참조. Reject/dispute/resolve는 Supabase 실 경로, Accept는 실 entryPrice source 전까지 fail-closed

### 컴포넌트 구조
`src/components/{stock,macro,layout,common,ui}`. `ui/` shadcn(base-nova, Lucide) + Base UI Dialog.

### 디자인 토큰 (S0 유지)
`src/app/globals.css` @theme inline + :root — shadcn base-nova neutral + 한국 증시 관례 `--market-up`(빨강) · `--market-down`(파랑) · `--market-neutral`(회색). radius 4단계 · Geist · chart-1~5.

### 문서 레이어 (AGENTS.md 계층)
- 8 AGENTS.md (deepinit S0 T0.8 · S3에서 vitest.config.ts·test:ci 반영): root · src · src/{app,components,lib,types} · src/lib/{data,supabase}

### scripts/ 디렉토리 (S3 신설)
- `scripts/seed_kr_holidays.py` — S5 M10 pykrx 월간 배치용 참조. Homebrew Python 3.14 PEP 668 → venv 필수. `python3 scripts/seed_kr_holidays.py --from YYYY-MM-DD --to YYYY-MM-DD` 로 SQL UPDATE 블록 stdout.

### DQ-7 Credential System 신설 (Session 1·2)
**Session 1 (Backend·DB)** — `src/lib/crypto/` + `src/lib/credentials/`:
- `src/lib/crypto/aes.ts` AES-256-GCM encrypt/decrypt + MEK lazy singleton (zero dependency · Node crypto stdlib만)
- `src/lib/credentials/types.ts` — `ActionResult<T>` discriminated union · Brokerage/Exchange Input·Display 인터페이스
- `src/lib/credentials/mask.ts` — `maskKey(prefix 2 + suffix 4)` · `maskAccount`
- `src/lib/credentials/validation.ts` — KIS APP_KEY(36) / APP_SECRET(180) / account_no / Binance API_KEY·SECRET(64) / label(1~40) + `CredentialFormatError`
- `src/lib/credentials/brokerage.ts` — KIS Server Actions (`upsertBrokerageCredential`·`deleteBrokerageCredential`·`listBrokerageCredentials`·`testBrokerageConnection` stub `pending-s8`) · rep guard(ADMIN_REP_EMAIL) · 23505 매핑
- `src/lib/credentials/exchange.ts` — Binance USDT-M 선물 평행 구조 (rep guard는 testnetMode=false 조건)

**Session 2 (Frontend UI)** — `src/components/admin/credentials/` + 2 settings 라우트:
- `src/components/admin/credentials/secret-input.tsx` — 공유 Client (Eye toggle · `autoComplete="new-password"` · maxLength counter · useRef unmount cleanup)
- `src/app/(admin)/admin/settings/brokerage/{page,form,delete-button}.tsx` — KIS UI (Server + Client + Base UI Dialog 2-step)
- `src/app/(admin)/admin/settings/binance/{page,form,delete-button}.tsx` — Binance USDT-M 선물 평행 UI
- `src/app/(admin)/layout.tsx` ADMIN_NAV +2 (`증권사 키`·`거래소 키` · Flat · S8 재편 예정)

**통합 테스트**: 20 cases (`vi.hoisted` Supabase mock). 누적 190 → **248 tests**.

**정리된 레거시**: `types/admin.ts`에서 `BrokerageConnection`·`BrokerageScope` 타입 제거 · `mock-admin-brokerage.ts` 삭제.

**환경변수 (`.env.example`)**: `API_CRED_MASTER_KEY`(32-byte hex MEK) · `ADMIN_REP_EMAIL`(실계좌/메인넷 저장 권한자) 신규 추가. `KIS_*`·`BINANCE_*` env 블록은 주석화(per-admin DB로 영구 이관).

### 레거시 제거 완료 (S0)
- ~~`app/(main)/pricing`~~ · ~~PLANS/PlanKey~~ · ~~SubscriptionTier/UserProfile/reportViewsRemaining~~ · ~~subscription-gate/report-limit-banner~~ · ~~/pricing 링크~~

### 검증 게이트 현재 상태 (49차 S7a Task 1~17 ✅ + 50차 §0 박제 정합 후, 2026-05-19)
- `npm run build`: ✅ OK (Next.js 16 build 통과)
- `npm run lint`: ✅ 0 errors (6 warnings preexisting)
- `npm run test:ci`: ✅ **60 files / 522 tests pass** (49차 S7a +59 = cost-logger 5 + anthropic-client 6 + consensus 10 + admin-batch-runs 3 + persona-eval 7 + writer 4 + format-error 6 + mock e2e 등; 이전 50/463 → 60/522)
- `npx tsc --noEmit`: ✅ exit 0
- `npm run dev`: ⚠️ macOS EMFILE 이슈 가능 — 필요 시 `ulimit -n 65535` 후 재시도

---

## 시스템·백테스트 현황

### 자동화 백테스트 v6.1 FINAL (2026-04-12 확정)
- 파일: `backtest/full_system_backtest_v6.py`
- 성과: CAGR 20.3% · Sharpe 0.99 · Calmar 0.78 · Max DD -25.8%
- 벤치마크: 삼성전자 B&H 위험조정 beat
- 구성: 3축 분화 + Early Warning + 부분 리밸런싱

---

## Must 19 진행 상황 (S6 Mock 완료 기준)

> **[65차 supersede 2026-06-04]**: 출시 MVP 기준 = ①30 리스트 정확 ②포트폴리오 정확 ③30 리포트 정확(고도화 아님). Must 19 카운트는 보조 지표로만 해석 (HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조).

- **Mock 동작**: 19/19 (100% mock fixture)
- **실데이터 연결**: **0/19** — 전 Must가 mock 의존
- **실 AI 호출**: **0** — ~~Anthropic wrapper 미구현~~ → **66차 W0 ✅ 구현 MERGED** (LlmProvider + model-registry, Claude+GPT 멀티프로바이더 + provider auto-detect — PR #86). 실 호출 활성 = W1/W2 엔진 + USER 키·비용 게이트 (HANDOFF.md ⭐ 65차 MVP 엔진 섹션)
- **텔레그램 + `/admin` 웹 알림 실 발송/표시**: **0** — Telegram 실 발송 미연결(`/admin` durable event/badge 실검증 대기)
- **외부 API 실 연결**: pykrx/DART는 로컬 Tier 0 스크리닝 스크립트에서 구현됨. app runtime 기준 KIS·Naver·AI(Claude/GPT)·DART UI 표시는 아직 미연결 (65차 Q3 supersede: AI 키 = Anthropic 단일 아님, Claude 필수 + GPT 선택 멀티프로바이더 — HANDOFF.md ⭐ 65차 MVP 엔진 섹션). T7e.8 follow-up production 반영은 Supabase 0013/0014 원격 apply 대기.
- **실 운용 검증**: **0일**

**🎉 출시(launch) 기준** = Mock + 실데이터(S7) + **PR-K Reflection 자가학습 빌드(D32, 출시 전·미구현)** + 운용 검증(S9, ★ Reflection S9 중 가동·검증) — **자동매매 제외**, "AI 추천 + 가상 포트 + 알림" 도구 (사용자 결정 2026-06-01). **어드민 내부 도구 완성 기준**(출시 후 도달) = 출시 + 자동매매 프레임(S8, 주식 KIS + 바이낸스 선물, 실운용하며 개발) → 둘 다 **미달성**. 진행 경로 = HANDOFF.md §2 Runbook(S7b~S9 후속 PR + 운영).

> **2026-04-21 어휘 정리 (D16)**: 구 "MVP Stage 1 완료" 어휘는 대외 서비스 프레임에서 파생된 것이며 어드민 내부 도구 트랙에는 강제 게이트가 아님. 자세한 재정의는 CLAUDE.md 상단 "⭐ 프로젝트 재정의" 참조.

---

## 체크리스트 (변화 시 갱신)

### Mock Skeleton (완료) + DQ-7 구현 2/4
- [x] TypeScript 파일 수 증감 (S0: 70 → S6: ~145 → DQ-7 S2: ~152)
- [x] 라우트 추가 (S0 17 → S6 22 → DQ-7 S2 24)
- [x] Supabase `.env.local` 세팅 (S0 완료 · DQ-5 anon key 갱신 해소 2026-04-21)
- [x] 마이그레이션 0001~0010 + 0012~0016 적용 (production · 0009 = DQ-7 credential · 0010 = alert RLS · 0011 슬롯 = BL-KRIT-8 S8 자동매매 보존 · 0012 = short_list_30 name/sector · 0013/0014 = DART cache · 0015a = SECURITY DEFINER PUBLIC REVOKE 46차 P0.1 · **0016 = `accept_shortlist_with_snapshots` RPC 48차 P3.2 ✅ + anon revoke hotfix**) · advisor anon WARN **0건** / authenticated WARN **4** (intended: is_admin/raise/resolve_portfolio_dispute + accept_shortlist_with_snapshots)
- [x] Vitest 테스트 인프라 (190 → **248 tests pass** · DQ-7 S1 +58)
- [x] 레거시 코드 제거 (S0 완료 + DQ-7 S1에서 `BrokerageConnection`·`mock-admin-brokerage` 추가 제거)

### 실데이터 전환 (S7, 진행 중 — S7e T7e.8 + 46차 P0·P1 완료, S7a 진입 대기)
- [ ] **AI 프로바이더 키 확보** (BL-KRIT-1, 사용자 액션 B-6) — ~~W0 진입 트리거~~ → **66차: W0 코드 ✅ MERGED — 키는 W0 smoke 실행(USER 선택) + W1/W2 실 가동 게이트**. Claude(Anthropic) 키 필수, GPT(OpenAI) 키 선택(provider availability auto-detect — 없으면 Claude-only). HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조
- [ ] **KIS API 계정 발급** (BL-KRIT-2, 사용자 액션 B-10) — S7c WS read-only 본인 1개로 충분 (D18)
- [x] **Naver News API 키** (BL-KRIT-3) — 2026-04-30 31차 `.env.local` 투입 (Vercel env + rotate는 S7b 직전 · B-8)
- [x] ~~**Resend 계정 + 도메인 인증** (BL-KRIT-4, 사용자 액션 B-7)~~ — **폐기(72차 사용자 override)**: 이메일/Resend 알림 전역 제거. D10/M15/S7c/S7d는 텔레그램 best-effort + `/admin/alerts` durable event + 대시보드 unread badge로 대체
- [ ] **Telegram Bot** (BL-KRIT-5, 사용자 액션 B-9) — S7b M12a 뉴스 자동제외 알림부터 필요 + S7c/S7d 텔레그램 알림 선결
- [x] **Supabase anon key 갱신** (BL-KRIT-6) — 2026-04-21 해소
- [x] **마이그레이션 0010 alert RLS hardening** (BL-KRIT-7) — 적용 완료 (36차)
- [x] **마이그레이션 0009 DQ-7 credential** (E9 확장 + E12 신설 + RLS) — 적용 완료 (DQ-7 Session 3, production brokerage_connection 1 row 존재)
- [🟢] **Supabase 실 SELECT/INSERT 전환** (S7e · 8 Must) — T7e.1~T7e.6 + T7e.8 완료 (7/8) · T7e.7 RLS 수동 QA 잔여
- [x] AI 프로바이더 추상화 wrapper (W0 · M17·M2·M3·M6·M9·M10·M11·M12) — **66차 ✅ MERGED (PR #86)**. cost_log 실 INSERT 활성·smoke 실행은 USER 키·비용 게이트. 65차 Q3 + D28 supersede: Claude+GPT 멀티프로바이더 + 모델 레지스트리 + 역할별 모델 차등 기준 재정의(목적함수=예측 적중률+리포트 정확성, hardcap=제약; 초기 기본값은 Sonnet×6+GPT mid×5 토론 + Opus4.8 judge/리포트/W3 + GPT critic) — HANDOFF.md ⭐ 65차 MVP 엔진 섹션 참조
- [ ] 뉴스·브리핑 실 연결 (S7b · M11·M12a)
- [ ] 장중·Exit 실 연결 (S7c · M13·M15)
- [ ] Silent Health 실 INSERT + override UI (S7d · M18·M19)
- [ ] **PR-K Reflection 자가학습** (D32, 출시 전 빌드 + S9 검증) — reflection_log 마이그(0038~) + track별(주1/월1) 회고 job + 다음 선정 prompt 주입(`reflectionContext` seam). **미구현**(현재 seam 빈 문자열만 주입; Q5 incumbent thesis와 별개). SoT: `docs/superpowers/specs/2026-06-24-reflection-prk-pre-launch-promotion.md`

### 운용 검증 (진행 중)
- [x] Vercel 프로젝트 생성 + 환경변수 세팅 (DQ-7 Session 3 완료 · production live https://tudal-tawny.vercel.app)
- [x] origin push (46차 production hotfix push 완료 — ahead 39 + 46차 P0/P1 batch sync, B-15 해소)
- [ ] Cron 4건 실 실행 검증 (S7b/S7d 진입 시점에 monthly-batch/morning-briefing/news-sweep/silent-health durable write 검증)
- [ ] D11 AI 가상 포트 운용 검증 (S7a + S7b 후 어드민 3인 며칠~1주, 30 카드 + 합의 배지 + Section 8 위원 표 가독성)
- [ ] 어드민 1개월+ 운용 검증 (D11 후속 → S7c·S7d → 🎉 **출시 게이트**; 자동매매 S8은 출시 후 — 2026-06-01)

### 법무 (⏸ Deferred-D 멤버 오픈 시점까지 유예 · 2026-04-20)
- [⏸] Q16 법무 자문 — 어드민 3명 내부 운용만이므로 현 단계에서 불필요
- [⏸] Q17 이용약관·개인정보처리방침 — Footer 면책 문구 유지, 멤버 오픈 시 `/legal/*` 라우트 신설

### 유저
- [ ] 어드민 3명 allowlist 실 로그인 (Supabase anon 블로커)
- [ ] 멤버 초대 500cap (Deferred-D)
