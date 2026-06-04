# HANDOFF — 주픽 (JooPick)

Last updated: 2026-06-04 — **⭐ 65차 MVP 엔진 재정의 (Q1~Q5 LOCKED — D26 7결정 + D27 Q5 펀드식 incumbent 재점검 · omxy CONVERGED) — 다음 세션 1순위 = W0(상단 ⭐ 섹션). MVP = 30 리스트+포트폴리오+30 리포트가 올바르게 나옴. 기존 PR-G ⓑ는 W0~W3로 superseded(코드 자산 재사용).** · (이전) **실데이터+실AI e2e 트랙** · **64차 출시前 launch-readiness 역추적 감사 5-finding fix ✅ MERGED**(PR #84, main `a5ee63e` — Workflow 17-surface FE→BE→DB 역추적 + omxy 3 rounds: P1 `upsertShortList30` metadata persist[PR-G ⓑ 빈 카드 잠복결함 제거] + P2×3 i18n format-error + P3 dead-code/lint 5→0, 마이그 0·code-only·cost0, test:ci 1621) · **63차 KRX 전환 코드 ✅ MERGED**(PR #80, main `30cb3b4`) + **FE 연결 검증 CONVERGED**(Claude①+omxy②④, 5 surface 실값 렌더, 결함 0) → **150 시드 ✅ DONE** + **선정 청크 워커 ✅ 빌드**(마이그 0031 dormant) + **PR-H ✅ 빌드**(리포트 enrich+manual trigger, 마이그 0, cost0) · 다음 = PR-G ⓑ(실 AI: 마이그 0031 apply + flag + Anthropic 키 + 비용) // 병렬 PR-I/PR-J. ADR SoT = `docs/superpowers/specs/2026-05-31-realdata-realai-e2e-decisions.md` (11-PR 로드맵 A~K). **AI 30선정 코드 엔진 + 프론트 + cron 실경로 prep 완성**: PR-A~C + PR-D(tier0_candidates_150) + PR-E(short_list_30 AI 스키마+실 선정 배선+비용가드) + PR-F(카드 AI 렌더 🤖, PR #67) + **PR-G ⓐ(cron 실 AI prep — cost-log service-role DI + 4-gate preflight, main `d15da47`, PR #68)** 모두 MERGED (omxy §2.0a + Workflow 6-dim 교차검증 CONVERGED). 마이그 **0028~0030 applied**. 다음 = **PR-G ⓑ (실 AI 첫 30선정)**. **63차(2026-06-02) supersede**: ❶ 실행 = **B 청크 워커**(Vercel cron, PR5 report-worker 패턴 복제) — 로컬 러너 폐기 / ❷ 데이터 = **하이브리드 확정**(S1 종가·S2 거래량·universe = KRX 공식 Open API 승인완료·라이브 200 검증 / S3 외국인 = pykrx(공식 API 404) / S4·S5 = DART) — 날짜별 전종목 1콜로 KRX throttle 근본 해결. prep: ② cron-system user ✅`39202d8b-…` · ③ Vercel env(`CRON_SYSTEM_USER_ID` set, `MONTHLY_BATCH_CRON_AI_ENABLED` false 복원) ✅ · ① ✅ DONE — KRX 전환 MERGED(PR #80) + **150 시드 적용**(`tier0_candidates_150` 150 rows · 2026-06 · 50/50/50 · canonical 14 · unresolved/placeholder 0 · `sector_override` +21 §2.0a 검증). 실 AI 호출 0회·cost 0(드리프트 0). 실비용 정정: ~6.5-8만원(구 "~5-6천원" 오기). [위 "다음 = PR-G ⓑ" 표현은 모두 65차에서 상단 ⭐ MVP 엔진 W0→W2→W1→W3로 superseded — 코드 자산은 토대 재사용.] **별도 트랙**: PR5(cron 리포트) MERGED-dormant.

> **이 파일 하나로 다음 세션이 진입 가능하도록 작성됨.** SHA·라운드 수·commit 체인은 self-drift 위험이 크므로 freeze 금지 — `git rev-parse --short origin/main` + `git log` + PR body로 runtime verify.

---

## ⭐ 65차 MVP 엔진 재정의 (2026-06-04) — 다음 세션 1순위 (사용자 확정 7결정(D26) + D27 Q5 LOCKED · omxy CONVERGED)

> **이게 다음 세션 진입점.** 사용자 결정: 아래 Q1~Q4는 **고도화가 아니라 원래 MVP**다. **MVP = ① 30 리스트가 올바르게 나옴 + ② 포트폴리오가 올바르게 짜여짐 + ③ 30 리포트가 올바르게 나옴.** 결정 자체는 **변경 금지** (SoT = memory `project_mvp_engine_4workstreams_2026_06_04` + 본 섹션). omxy 토론은 **순서·수정방법·문서구성만** 다뤘고 **R1~R4 CONVERGED**. file:line은 omxy 검증 포인터 — 착수 시 drift 재확인.

### LOCKED 결정 8 — D26 7결정 + D27 Q5 (변경 금지)
1. **Q1 선정주기 분리**: 단기 10 = **주 1회**(ⓐ Tier 0 단기 후보 50 매주 새로 뽑아 단기 Core 11 패널 재실행 = 주간 AI 비용), 중기·장기 20 = **월 1회**. 21일 고정 리밸런스 폐기 → 중복/교체/리밸런스는 AI 포트 판단(Q2) 위임. 데이터 = 정확도 기준(예비: KRX 종가/거래량+외국인+모멘텀, DART는 분기성=느린 품질필터).
2. **Q2 AI 자율 포트 구성**: 선정 30 중 (a)운용 여부 (b)총 개수 (c)종목 (d)단/중/장 분배 (e)종목별 비중 (f)현금 0~30% **전부 AI 자율**. 30 최선이면 30, 일부면 일부. 어드민은 Accept/Reject만.
3. **Q3 모델/프로바이더 추상화**: 모델 하드코딩 제거(설정값화), 역할별 모델 차등, **Claude + GPT 멀티프로바이더** + GPT 모델 매핑, 모델 업데이트 대비(레지스트리 — 신모델 추가=1곳). Core 11 = 모델 무관(시스템 프롬프트일 뿐, Claude 전용 아님).
4. **Q4 실시간 반박 토론 loop**: 합의 점수는 선택, **멀티라운드 반박 loop 필수**. GPT 포함하되 **GPT 키 미등록 시 자동 Claude-only**(provider availability **auto-detect**). Claude끼리도 반박.
5. **hardcap 40만 → 50만원**.
6. **역할별 모델 차등**: 토론 참가 = 저가(Haiku/GPT-mini류), 최종 judge·리포트 = 고가(Opus 4.8+).
7. **MVP 재정의**(위 박스).
8. **Q5 펀드식 incumbent thesis 재점검 (D27, 2026-06-04 같은 65차 후속 — MVP 포함)**: **모든 트랙(단기 주1회 포함)** 재선정 시, **기존 리스트 종목(incumbent)은 직전 리포트·논거·합의배지·점수 + 그 이후 실현 성과를 "incumbent thesis context"로 주입받아 논거 유효성을 재점검** → 유효=유지 후보 / 깨짐("더 이상 상승 안 할 것")=제외. **유지는 자동 아님** — 신규 후보와 **동일 랭킹 경쟁, 각 트랙 top10 안에 들어야 유지**. 신규 후보는 기존대로 신규 발굴. 서비스 = **펀드 운용 관점**(매번 백지 재발굴 X). cold start(직전 데이터 없음)=신규 취급. **PR-K Reflection(월말 전체 회고, defer)과 별개** — Q5는 선정 시점 per-incumbent review(MVP). 구현: `reflectionContext` seam 재사용(명칭은 incumbent thesis context로 표기).

### 빌드 순서 = W0 → W2 → W1 → W3  (omxy R1~R4 CONVERGED)
> **W2(주간/월간 split)를 W1(토론)보다 먼저.** 현 worker/DB/selection invariant가 월단일키·150고정이라, split을 먼저 해야 job key/finalize/expected_total을 두 번 안 뜯음.

**W0 — Q3 추상화 + hardcap 50만 + 역할별 모델 토대** (1순위 · 행동변화는 hardcap만)
- provider 추상화: `callPersona`(anthropic-client.ts:8,56) + full-report-client.ts:17 + critic-client.ts:29 + revise-client.ts:25 를 provider 인터페이스 뒤로.
- 모델 레지스트리: 역할(토론참가 / 최종 judge / 풀리포트 / critic / revise) → provider+model 매핑 1곳. 신모델 추가 = 레지스트리 1줄.
- GPT 추가: `@anthropic-ai/sdk`만 있는 tudal/package.json:13-14 에 OpenAI SDK + GPT 모델 매핑 + anthropic-pricing.ts:21-27 에 GPT 단가.
- provider auto-detect: `OPENAI_API_KEY` 미설정 시 GPT 역할 → 자동 Claude-only fallback.
- **hardcap 50만 전 SoT 동기화** (scope = `tudal/src` + `tudal/package.json` + `tudal/.env.example` 에서 40만 잔존 0): pricing.ts:66 `HARDCAP_KRW` + :117 `COST_WARNING_THRESHOLD_KRW` + types/admin.ts:364-365(350k/400k export) + cost-logger.ts:224-225(throw 키 `cost_hardcap_40man` — 키 보존+임계/메시지만 50만 또는 rename) + format-error.ts:26("40만원") + settings/cost/page.tsx:74 UI + worker 문자열 매칭(tier1-selection-batch-worker.ts:366-421, full-report-batch-worker.ts:295-411) + error taxonomy/tests. active SoT 문서(HANDOFF/ServicePlan)만 50만 정합. **과거 timeline(ProgressDashboard.md:297 39차 "40만원" 등) bulk 수정 금지** — supersede 포인터만.
- W0 끝: **1~2 ticker cheap-model provider+cost_log smoke**(persist 금지) — 새 계층 검증.
- DoD: `rg "40만|400_000|40man" tudal/src tudal/package.json tudal/.env.example` 잔존 0(legacy key 의도 유지 시 allowlist) + provider 추상화 뒤 Claude 경로 무회귀(test:ci) + GPT 키 없을 때 auto Claude-only 검증.

**W2 — Q1 주간/월간 split**
- worker/DB 월단일키·150고정 → **단기-주간(short 50) + 중장기-월간(mid+long 100) 2 트랙**.
- 마이그(W2 DB 범위): tier0_candidates_150(0028:1-9,19-28,51-57) 150/month 계약 → **week/track key 추가**. selection job(마이그 0031) key/expected_total/finalize 트랙별 재구성.
- 코드: tier1-selection-batch-worker.ts:39-42 + persona-eval.ts:414-415 `runTier1Screening` 150-invariant → **트랙별 invariant**. selection-worker/route.ts:46-65 current-month 단일 → 트랙별. vercel.json:20-22 에 단기-주간 cron 추가.
- **rolling composite writer 신설** (⚠️ `upsertShortList30` 재사용 금지 — admin-shortlist-persist.ts:62-71 `length!==30` 차단 + :175-181 비-30 행 DELETE가 주간 short 갱신 시 mid/long 삭제). DoD = short 주간 갱신 시 **mid/long 20 보존**. short_list_30 = rolling composite(short 주간 / mid·long 월간).
- **(D27 Q5) 트랙별 후보 풀 = fresh Tier 0 ∪ incumbents** (union + dedupe + expected_total 재계산 — 단기 50+incumbent≤10 / 중장기 100+incumbent≤20). incumbent가 fresh Tier 0 풀 밖이어도 **반드시 평가에 포함**(무심사 탈락 금지). **탈락은 W1 랭킹 후에만** — persist "새 set 밖 기존행 삭제"(:175-181)로 인한 심사 전 탈락 금지 = DoD. + **incumbent 식별 + prior-context builder**(직전 short_list_30 row + stock_reports 요약 + 선정 후 실현 성과 계산).

**W1 — Q4 실시간 반박 토론 loop**
- 각 트랙 per-ticker 단발채점(persona-eval.ts:486-540) → **멀티라운드 반박 ≤2라운드**(R2에서 타 위원 R1 주장 컨텍스트 주입 → 반박/수정).
- Claude-only 기본 + GPT 키 시 혼합(W0 auto-detect). **역할별 모델: 토론 참가=저가 / 최종 judge=고가**.
- consensus(결정론 computeWeightedScores+assignBadge)는 토론 후 최종 점수 집계로 유지/대체(합의 점수 자체는 선택).
- **(D27 Q5) incumbent thesis context 주입**: W2 prior-context builder 산출물(직전 논거·배지·점수 + 그 후 실현 성과)을 토론 프롬프트에 주입(`reflectionContext` seam 재사용 — persona-panel-adapter.ts:141,175 + cron/admin callers) → 토론 R1에서 incumbent는 직전 논거를 보고 반박/재평가("논거 아직 유효한가"). 신규 후보는 기존 발굴 프롬프트.

**W3 — Q2 AI 자율 포트 구성**
- 선정·토론 결과 → `portfolio_proposal`(편입 여부 / 총 개수 / 단·중·장 분배 / 종목별 비중 / 현금 0~30%) **AI 판단**.
- **entry_price 실배선**(actions.ts:208-211 항상 null TODO 해소 — KRX/EOD 소스) → Accept/Reject 작동.

### 비용 가드 (reservation ≤ 50만)
- cap: **short 50/week + mid·long 100/month, debate ≤2라운드, 토론 참가=저가, 최종 judge/report만 고가**.
- 근거(omxy): Opus reservation ≈82원/call(pricing.ts `MAX_COST_PER_CALL_KRW`) → 주간 short 50×11×4.3 ≈ 19.5만 + mid·long 100×11 ≈ 9만 = 단일라운드 ~28.5만. **all-Opus 2라운드 ~57만 > 50만 → 역할별 차등 필수**(저가 토론참가로 50만 내 유지).
- **(D27 Q5) incumbent union overhead**: 추가 패널콜 최대 단기 +10×11/주 + 중장기 +20×11/월 + incumbent당 직전 리포트 요약 주입(~1-2k tok). **W0 reservation 산식에 포함해 50만 내 재검증**.

### PR-G ⓑ 처리 (superseded)
- old **"150×11 Opus 단발 실선정"**(선정 청크워커 PR #82 + 마이그 0031 dormant)은 **W0~W3 엔진으로 superseded/흡수**. 코드 자산(청크워커 큐/run-mutex/self-continue 패턴)은 **W2/W1 토대로 재사용**. **별도 잔존 = W0 cheap smoke뿐**.
- 즉 **다음 세션 1순위 = W0**. 아래 §한눈에·§다음 액션 큐의 "PR-G ⓑ 1순위" 표현은 본 섹션으로 대체된다(코드/DB/게이트 현 상태 서술은 유효).

---

## 한눈에 (현재 상태 + 다음 행동)

> ⚠️ **다음 세션 1순위 = 상단 ⭐ 65차 MVP 엔진 섹션 (W0 → W2 → W1 → W3).** 아래 "지금 어디 / 다음 액션 큐"의 **PR-G ⓑ 1순위 표현은 W0~W3로 superseded**(코드 자산은 토대 재사용). 현 코드/DB/게이트 상태(아래) 서술은 그대로 유효.

**지금 어디**: **실데이터+실AI e2e 트랙** 진행 중. **AI 30선정 코드 엔진 + 프론트 + cron 실경로 prep 완성** — PR-A~C + PR-D + PR-E + PR-F(카드 AI 렌더) + **PR-G ⓐ(cron 실 AI prep, main `d15da47`, PR #68)** 모두 MERGED, 마이그 0028~0030 applied. ~~다음 = PR-G ⓑ (실 AI 첫 30선정)~~ **[→ 65차 W0로 superseded · 상단 ⭐ 섹션]**. **63차(2026-06-02) 결정**: ❶ 실행 = **B 청크 워커 단일화**(Vercel cron, PR5 패턴 — 첫 검증도 수동 트리거, 로컬 러너 폐기) / ❷ 데이터 소스 = **하이브리드**(시세·거래량·universe = KRX 공식 Open API 승인완료·라이브 200 검증 / 외국인 = pykrx / 재무 = DART → throttle 근본 해결). prep: ② cron-system user ✅ · ③ env(`CRON_SYSTEM_USER_ID` set, `MONTHLY_BATCH_CRON_AI_ENABLED` false 복원) ✅ · ① ✅ DONE — KRX 전환 MERGED(PR #80) + **150 시드 적용**(`tier0_candidates_150` 150 rows · 2026-06 · 50/50/50 · canonical 14 · unresolved/placeholder 0 · `sector_override` +21 §2.0a 검증). 실 AI 0회·cost 0(default-off). 현 카드는 AI 컬럼 null → 전부 "AI 대기" 표시(정상).

**main HEAD**: `git rev-parse --short origin/main` (2026-06-03 출시前 launch-readiness 감사 5-finding fix PR #84 MERGED 후 = `a5ee63e` 또는 자손).
**OPEN PR**: **#2**(format-error, CONFLICTING 보류) only.
**검증 게이트**: build 26 routes / lint 0 err 0 warn(pre-existing) / **test:ci 1621 PASS / 140 files** / tsc clean / Python 95.
**Production**: 마이그 0001~**0030** applied (0028 tier0_candidates_150 + 0029 short_list_30 AI 컬럼 + **0030 get_cost_log_monthly_total_admin cost RPC, 2026-06-02 applied+verify**) · short_list_30 30 rows canonical 14(B93 PASS, AI 컬럼 전부 null = Tier 0 fallback, **AI 선정 아님**) · tier0_candidates_150 **150 rows**(2026-06 · 50/50/50 · canonical 14 · unresolved/placeholder 0 · 63차 `sector_override` +21 §2.0a 적용) · **실 AI 호출 0건**(cost_log=0).
**⭐ 2026-06-02 비용0 라운드 완료** (PR #69~#76 반영): STEP-1 리포트 UI sweep + STEP-2 cost_log RPC(마이그 0030) + PR-A silent-0 4페이지 diagnostic + FE bridge-gap sweep(notifications nav · archive `?month` deep-link · Section8 partD 렌더 · portfolio dispute/하드코딩/배너 정직화). **추가 cost-0 CLAUDE 작업 0(소진)**. ~~다음 1순위 = PR-G ⓑ 실 AI 첫 30선정~~ **[→ 65차 W0로 superseded · Anthropic 키는 W0 smoke/W1 토론에서 사용]**. **🔑 키 구조**: **Anthropic AI 키 = 유일한 공통(shared) 키**(도구 1개, env `ANTHROPIC_API_KEY`, 3인 공용) / **KIS·Binance = per-admin**(각자 발급·암호화 저장, DQ-7). KIS 현황 = **3명 중 1명만 보유**(다른 1명의 모의 키 1행) → **사용자 포함 2명 KIS 발급 필요**(S7c 시세는 1개 충분, S8 자동매매는 3명 each). 남은 외부 키 = Anthropic(공통, 내일) + Naver/Resend(S7b) + Telegram(S7c) + KIS 2명분. FLAGGED 6종 = 각 phase(S7b/c/cron)에 흡수(§3 하단).

**⭐ 2026-06-02 launch-readiness PR #79(A~E) MERGED** (`532a0a5`, omxy R-debate CONVERGED + Claude 독립 리뷰 2 0-blocking, 마이그 0·code-only, test 1513→1526): **A** monthly-batch route 초입 dormant 게이트(flag off 시 200 skip → 매월 가짜 critical+502 제거, `MONTHLY_BATCH_CRON_AI_ENABLED=true`+키 충족 시 즉시 가동) · **B** 섹터 persona 이름 resolver(`legacy.name ?? getPersonaById().label ?? raw` — Tier2 AI 켜는 순간 섹터 위원 이름이 raw id로 노출되던 잠복버그 제거 = **PR-I Tier2 선행 fix**) · **C** 브리핑 telegram best-effort(`isTelegramConfigured()` 가드, 토큰 드롭인 시 발송, 실패는 502 미escalate) · **D** admin allowlist 이중 SoT 문서화 · **E** `getBriefingLogForDate(todayKST)` reader → 홈 BriefingCard wire(영구 빈칸 해소, S7b briefing 선행). ~~다음 1순위 불변 = PR-G ⓑ~~ **[→ 65차 W0로 superseded]**(병렬 launch-hardening). **⚠️ D 운영 체크리스트**: 어드민 추가/제거 시 **Vercel env `ADMIN_EMAILS`(pre-session gate) + DB `admin_emails` 테이블(`is_admin()` RLS gate) 반드시 동시 갱신** — 한쪽만 갱신 시 인증 drift.

**다음 액션 큐 — 실데이터+실AI e2e (ADR 로드맵, PR별 §2.0a flow)**:

> ⚠️ **superseded by 상단 ⭐ 65차 MVP 엔진 섹션.** 다음 세션 1순위 = **W0 → W2 → W1 → W3**. 아래 PR-G ⓑ 큐는 코드 자산(청크워커/큐/run-mutex)을 W0~W3 토대로 재사용하는 형태로 흡수됨 — 역사 기록으로 보존.

1. **PR-G ⓑ 실 AI 첫 30선정** (~~다음 1순위~~ **superseded — W0~W3로 흡수** — ⓐ ✅ MERGED `d15da47`/PR #68. **63차(2026-06-02) 결정: ❶ 실행 = B 청크 워커**(Vercel cron, PR5 report-worker 패턴 복제 — 로컬 러너 폐기) **/ ❷ 데이터 = 하이브리드**(KRX 공식 Open API[시세·거래량·universe] + pykrx[S3 외국인] + DART[S4·S5])):
   - ⓐ [CLAUDE] ✅ **DONE**: cron 실 AI 경로 배선 (PR #68, §6 참조).
   - **prep 상태 (62차 세션, 사용자 ①~④ 위임)**: ② ✅ cron-system user 생성 `39202d8b-1042-48a6-8da0-df14a52fabea`(= cron-system@joopick.internal, auth.users 존재·confirmed, getUserById OK, PR5+PR-G 공용). ③ ✅/복원 Vercel prod env: `CRON_SYSTEM_USER_ID` set(유지) · `AI_COST_LOG_REAL_INSERT_ENABLED=true`·`ANTHROPIC_API_KEY` 확인 · `MONTHLY_BATCH_CRON_AI_ENABLED`는 **false로 복원**(cron 비viable이라 merge-safe 기본 유지 — 7월 cron 타임아웃 잠재리스크 제거). ① ❌ 150 시드 0 rows(구 pykrx per-ticker throttle: `get_market_trading_value_and_volume` 빈응답 ~2000/2269 실패). **63차 해결**: S1 종가·S2 거래량·universe를 **KRX 공식 Open API**(날짜별 전종목 1콜, 승인완료, env `KRX_OPENAPI_KEY`)로 전환 → throttle 근본 해결. S3 외국인만 pykrx 유지(공식 API에 없음=404, 기간 일괄 최적화). **✅ DONE: KRX 전환 MERGED(PR #80) + 150 시드 적용 — `tier0_candidates_150` 150 rows(50/50/50, canonical 14, unresolved 0). `sector_override` +21(§2.0a Claude①리서치+omxy②검증 CONVERGED). ~~다음 = PR-G ⓑ 실 AI~~ [당시 기준 → 65차 W0~W3로 superseded].**
   - **⚠️ ④ 실행방식 (63차 supersede = B 청크 워커, 로컬 러너 폐기)**: 동기 단발(cron/admin HTTP·로컬 러너 모두) 1650 Opus콜(150×11, limiter default 4) ~30-55분이라 serverless 300s 초과 = 타임아웃·NON-VIABLE. **확정 = Vercel cron 청크 워커**(PR5 report-worker 패턴 복제: `tier1_selection_job` 큐 + claim_next + run-mutex + self-continue — 몇 종목씩 패널 처리, 150 완성 시 선정 확정 + `upsertShortList30` persist). 첫 1회 품질 검증도 **이 워커를 수동 트리거**(별도 로컬 러너 안 만듦). `callPersona` transient 재시도(messages.create 429/5xx/APIConnection/timeout 1-2회 — parse/validation/cost insert 제외)는 워커에 포함. service-role + prod ANTHROPIC_API_KEY.
   - **실비용 정정**: reservation cap = 1650 × 82.23원 = **135,680원**(< 40만 hardcap, preflight 통과) / 실제 ≈ **6.5–8만원**(opus-4-7 $5/$25 per M, max_tokens 1024, 캐시 off). **구 "~5–6천원" 표기는 오기**.
   - **다음 세션 절차**: (a) ✅ DONE KRX 전환 MERGED(PR #80) (b) ✅ DONE **150 시드 적용**(`tier0_candidates_150` 150 rows, 63차) (c) ✅ DONE **선정 청크 워커 빌드**(마이그 0031 + worker + selection-worker cron, §2.0a Claude①→omxy②③ 3-fix→Claude④, mock+flag-off=cost0, test:ci 1559) (d) **[USER] 마이그 0031 apply + `SELECTION_CRON_AUTO_ENABLED=true`** + Anthropic 키+비용 승인 후 워커 가동 ~55분 (e) short_list_30 AI컬럼/cost_log/배지 검증 → 카드 실 배지 활성. **첫 검증·매달 자동 모두 동일 청크 워커로 단일화.**
   - **⭐ 매달 자동화 (1일 cron → 자동 30선정 + 30리포트) 아키텍처 (사용자 Q 62차)**: serverless 300s 제한 때문에 **단발 실행 불가 → 청크 워커 필수**. (i) **30리포트** = PR5 report-worker가 **이미 청크 워커 완성**(report_batch_job 큐 + claim_next_report_jobs + run-mutex + self-continue, daily cron, dormant) → **go-live만** 하면 자동. (ii) **30선정** = 현재 단발 orchestrator(1650콜 타임아웃) → **PR5와 동일 청크 워커 패턴으로 재구성 필요**(`tier1_selection_job` 큐 → cron이 몇 종목씩 패널 처리 → 150 완성 시 선정 확정). **별도 상시 서버 불필요** — Vercel cron 청크가 정답(PR5가 입증). 대안 = Vercel Workflow(WDK durable) 또는 전용 워커서버(과함). **✅ 선정 청크 워커 빌드 완료(63차)**: PR5 패턴 1:1 복제 — `tier1_selection_job` 큐 + `tier1_selection_run`(run-mutex + run_id fencing + `finalized_at` idempotency) + 4 RPC + `tier1-selection-batch-worker.ts`(step-0 fail-closed → enqueue 150-invariant → claim chunk(ticker 3) → per-ticker Core 11 → `remaining==0` finalize replay(LLM 0) → top10=30 → upsertShortList30) + `selection-worker` cron(`SELECTION_CRON_AUTO_ENABLED` dormant). 마이그 **0031 written-not-applied**(USER apply 게이트). 첫 검증·매달 자동 단일화. **⚠️ OPEN**: 150 시드의 S3(pykrx=Python)는 Vercel(TS)에서 실행 불가 → monthly 자동화 시 GitHub Actions cron 등 외부 스케줄 필요(S1/S2/universe는 KRX 공식 REST API라 TS 가능).
2. **[CLAUDE] D11 전 hard-gate lane**: **PR-H ✅ 빌드**(리포트 enrich placeholder→실 + manual trigger 2종[reject→재선정 wire / Regen 단일] + report-worker admin trigger + Regen is_admin, 마이그 0, flag-off=cost0, §2.0a CONVERGED test:ci 1602) → **PR-I/PR5b** Tier2 sector14+Section8 full path → **PR-J** runtime mock 전면정리. **D11 진입 전 완료 필수**(§2.2 D11 row). **PR-K**(Reflection)는 출시 게이트 아님 — S9/go-live 후 defer.

**[별도 트랙] PR5 cron 리포트 go-live** (위 e2e와 독립, USER 게이트): cron-system seed ✅(62차 done — `CRON_SYSTEM_USER_ID` prod set + user `39202d8b-…`, PR5+PR-G 공용) + Vercel `PR5_CRON_AUTO_ENABLED=true` + Task 7 비용 smoke + cron-persist canary. 마이그 0027 ✅ applied. (PR #60 MERGED-dormant.)

**BLOCKER 등급 갭 (ADR §2)**: B1 tier0 150 SoT→**PR-D ✅** / B2 어댑터→**PR-C ✅** / B3 DART 스키마→**PR-B ✅** / B4 배지 컬럼→**PR-E ✅** / B5 배지 알고리즘 단일화(ADR D-2 consensus.ts) ✅ / B7 fail-open→**PR-B2+PR-E is_admin 게이트 ✅** / 잔여 B6(disjoint RPC — commit_persona_eval=report-path, selection 배지=short_list_30, PR-E 분리 확정).

**ACTIVE blocker / W-ticket** (full catalog → `docs/superpowers/audit-catalog.md`): OPS-1(plan tier, PR5 트랙) / W-alert-event-dedup / W-portfolio-snapshot-real. ~~W-tier1pill~~ = STEP-1 branch에서 UI acceptance gate 반영.

> **실 AI trigger/cron 가동은 USER 비용 승인 전 절대 금지** (실 30선정 1회 ≈ 6.5–8만원, reservation cap 135,680원 — 구 "~5-6천원"은 오기). 현 short_list_30 30종목은 **AI가 아닌 Tier 0 지표로 고른 fallback**.

---

## 0. 세션 시작 루틴 (verify + auto-progress)

```bash
cd /Users/yong/New_Project_KR_Stock
git fetch origin

# 1) main state (fixed SHA 박제 금지 — runtime verify)
git checkout main && git pull origin main
git rev-parse --short HEAD          # 2026-06-03 launch-readiness 감사 PR #84 후 `a5ee63e` 또는 자손
git status --short                  # clean

# 2) OPEN PRs — #2(format-error CONFLICTING) only 기대
gh pr list --state open --json number,title,headRefName,mergeable

# 3) 검증 게이트 (매 세션 1회)
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit && cd ..
#   main 기준 기대 (2026-06-03 launch-readiness 감사 PR #84 후, main `a5ee63e`): build 26 routes / lint 0 err 0 warn / test:ci 1621 PASS / 140 files / tsc clean / Python 95 tests PASS
#   select count(*) from cost_log; -- 기대 0 (마이그 0030 RPC applied, 실 AI 전이라 cost 0)

# 4) production audit 재확인 (Supabase MCP execute_sql 또는 dashboard) — drift detect
#   select count(*) from cost_log;          -- 기대 0 (실 trigger/PR5 실행 전)
#   select count(*) from stock_reports;      -- 기대 0
#   select count(*) from committee_votes;    -- 기대 0
#   select count(*) from short_list_30;      -- 기대 30 (AI 컬럼 consensus_badge/ai_score 전부 null = Tier0 fallback)
#   select count(*) from tier0_candidates_150; -- 기대 150 (63차 적용: 2026-06 · 50/50/50 · canonical 14 · unresolved 0)
#   select sector, count(*) from short_list_30 group by sector order by 2 desc;
#     -- 기대: canonical 14만 / placeholder('코스피','코스닥') 0 / B93 PASS
#   drift(cost_log>0 또는 short_list_30 AI 컬럼 non-null 등) 시 = 누군가 실 AI trigger/seed 실행 → §1 ground truth 갱신.
```

### §0.A — PR5 go-live 활성화 진입 (⚠️ **별도 트랙** — 1순위 아님)

> **[→ 65차 supersede] 다음 세션 1순위 = 상단 ⭐ MVP 엔진 W0** (구: §다음 액션 큐 1번 PR-G ⓑ — 코드 자산은 W0~W3 토대 재사용). PR-G ⓐ는 이미 ✅ MERGED(`d15da47`/PR #68). **KRX 공식 API 전환(PR #80) + 150 시드(`tier0_candidates_150` 150 rows) + 선정 청크 워커(PR #82, 마이그 0031 written-not-applied dormant)는 63차 ✅ 빌드 완료.** ⓑ 잔여 = **[USER] 마이그 0031 apply + `SELECTION_CRON_AUTO_ENABLED=true` + Anthropic 키 + 실 30선정 1회 비용 승인(~6.5–8만원) → 워커 수동 트리거 ~55분 → 배지/cost_log/카드 검증** (동기 단발은 NON-VIABLE이라 청크 워커 단일화). 본 §0.A는 그와 **독립된 PR5(report-only cron) go-live** 트랙 — 혼동 금지. ⓑ가 ① 재시드/④ 비용으로 막히면 보고 후 다음 unblocked CLAUDE step으로 진행하고, PR5는 별도 USER-gate 트랙으로 유지한다.

**PR5 코드는 MERGED**(main `c2f7504`, PR #60 — branch 삭제됨) + 마이그 0027 production applied. cron route는 **dormant**(`PR5_CRON_AUTO_ENABLED` 미설정 → spend 0). 다음은 **go-live 활성화 USER 게이트** (한눈에 §[별도 트랙] PR5 — e2e PR-F~G와 독립): (b) 마이그 ✅ DONE / (c) cron-system seed → `CRON_SYSTEM_USER_ID` ✅ **DONE**(62차, PR5+PR-G 공용) / (d) Vercel PR5 env(`PR5_CRON_AUTO_ENABLED=true`) / (a) Task 7 비용 smoke + cron-persist canary / (e) plan tier. 전부 production external(USER) — CLAUDE는 명령/체크리스트 + 후속 verify. 미충족이면 보고 + 다음 unblocked CLAUDE step.

```bash
cd /Users/yong/New_Project_KR_Stock
git checkout main && git pull origin main
git rev-parse --short HEAD          # PR5 머지 후 c2f7504 또는 자손
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit && cd ..
#   기대: build 26 routes / lint 0 err 0 warn / test:ci 1621 PASS / 140 files / tsc clean
```
- PR5 plan SoT(main 머지됨): `docs/superpowers/plans/2026-05-29-pr5-cron-monthly-batch-auto.md`. go-live 상세 = `audit-catalog.md §9.4` + W-pr5-cron-persist-canary.
- **go-live 후 [CLAUDE]**: cron 가동 모니터링 + Task 8 audit + **PR5b/PR-I**(committee_votes + Section 8 full path, **D11 운용 검증 전 land 강제 hard gate**, plan §3.2/§9 G2). **Step 4 Reflection/PR-K는 출시 게이트 아님** — S9/go-live 후 실 운용 결과 누적 시 defer.

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
| main HEAD | **runtime verify** `git rev-parse --short origin/main` (2026-06-03 launch-readiness 감사 PR #84 후 `a5ee63e` 또는 자손). |
| PR5 | ✅ **MERGED** (PR #60 rebase FF + delete-branch). cron monthly-batch report-only worker + 마이그 0027. cron **dormant**(`PR5_CRON_AUTO_ENABLED` 미설정 → spend 0), 실 가동 = USER 게이트. |
| OPEN PRs | **#2**(format-error, CONFLICTING 보류) only. PR #19~#76 + PR #79 + canonical 5-PR 모두 반영/머지(상세 git log). |
| 검증 게이트 (main, 2026-06-03 launch-readiness 감사 PR #84 후 `a5ee63e`) | build 26 routes / lint 0 err 0 warn / **test:ci 1621 PASS / 140 files** / tsc clean / **Python 95 tests PASS**. |
| canonical 5-PR | ✅ 전체 MERGED: PR2 `f85fb69` / PR3a `0813a41` / PR1 `4aa3130` / PR3b `cf68731` / PR3c `b2a902a` / PR4 `7de9696`. |
| B65 3-phase | ✅ P1 `5b99e03` + P2 spec(옵션 A lock-in) + P3 impl `3c09d6e` + 마이그 0025 applied + Vercel env=true → production functional 가능. |
| Task 5 B66 | ✅ **PRODUCTION COMPLETE** (60차 §5): 마이그 0026 + induty 백필 2,766/2,766 + short_list_30 30 rows canonical 14(B93 PASS). placeholder/unresolved 영구 0. |
| 선정 흐름 | (당시 기준) spec lock-in: Tier 0 150 → Tier 1 Core 11 AI → 단/중/장 top 10 = 30. 현 production = Tier 0 단독 30(fallback). **[→ 65차 W2로 재정의]** 단일 월 150/top10×3 메인 path는 **short 주간 + mid·long 월간 + rolling composite**로 변경 (상단 ⭐ MVP 엔진). |
| 풀 리포트 | PR3b writer Section 0~7 + Section 8 partA/partD + PR3c 3-step + PR4 admin caller + 마이그 0025 RPC + env=true. **functional 가능, last-known audit cost_log=0/stock_reports=0** → Task 7 Smoke Stage 2에서 첫 실 검증. |
| 실 AI 호출 | **현재 0건** (cost_log=0). **[→ 65차]** 선정 path 첫 실 AI = ~~PR-G~~ **W0 cheap-model provider+cost_log smoke → W2/W1 엔진**(상단 ⭐). report-only 첫 smoke = Task 7(PR5 트랙, 별도). 둘 다 USER 비용 승인 후. |
| Supabase | project `rbrpcynhphrpljbjirfo` · **0001~0030 production applied** (0028 = tier0_candidates_150 disjoint 50×3 + canonical CHECK + unique(month,bucket,rank); 0029 = short_list_30 AI 컬럼 8종 nullable + consensus_badge/winning_timeframe CHECK; 0030 = `get_cost_log_monthly_total_admin` cost RPC) · SECURITY DEFINER 패턴 · dart_corp_codes 2,766/2,766 induty 백필. |
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

### §2.1 Step matrix — 8-row (legacy B65/B66/PR5 Task 구조 — 역사 기록. **현 1순위 = 상단 ⭐ MVP 엔진 W0** [구: PR-G])

**현재 위치** = **실데이터+실AI e2e 트랙** (PR-A~F + PR-G ⓐ MERGED + 마이그 0028~0030 applied). **[→ 65차 supersede] 현 1순위 = 상단 ⭐ MVP 엔진 W0** (구: PR-G ⓑ 실 AI 첫 30선정 — 코드 자산은 W0~W3 토대 재사용). 아래 8-row Task matrix는 **legacy(B65/B66/PR5 Task 구조) 역사 기록** — 현 진행은 e2e 11-PR 로드맵(ADR §4)이 SoT. PR5 go-live는 별도 트랙(USER 게이트, dormant). **상세 박제는 git log + PR body + ADR/plan docs 위임.**

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

### §2.2 ✅ 어드민 출시 게이트 (S9 1개월+ 후 7 criteria) — ⚠️ **출시 = 자동매매 제외** (S8은 출시 후 개발, 사용자 결정 2026-06-01)

> **출시 범위 = "AI 추천 + 가상 포트 + 알림" 내부 도구** (어드민이 AI 추천 보고 직접 매매). **자동매매(S8)는 출시 후 어드민 3인이 실운용하며 보면서 개발** — 출시 게이트 criterion #7은 그래서 "(자동매매 시)" 조건부(출시 시점 N/A).

1. 최소 1개월 운용 (어드민 3인 일일 사용) · 2. BL-KRIT open 0개 · 3. 3인 핵심 플로우 일일 완료(Short List 30→풀 리포트→승인→가상 포트→알림) + disclaimer 전 화면 · 4. cron/health 안정(Silent Health red_alert 0 + success_rate ≥ 99% + canary OK) · 5. 비용 hardcap(월 400,000 KRW 미만 + AI 일 주문 ≤ 20회 + cost_log 정확) · 6. RLS/credential smoke(advisor anon WARN 0 + Smoke #3~#6 + 평문 노출 0) · 7. **(자동매매 도입 후에만 적용 — 출시 시점 N/A)** guardrail 위반 0(레버리지 ≤ 5x · 일일 손실 -3% 정지 · AI 일 주문 ≤ 20).

#### 후속 PR + 운영 (PR5 + S7b~S9)

| Step | Owner | Trigger | Default action |
|---|---|---|---|
| **PR5** cron 30 report-only 자동 + β2′ DB job queue | CLAUDE | ✅ **코드 MERGED**(PR #60) + 마이그 0027 applied. go-live = USER 게이트(c seed / d env / a Task 7 smoke / e plan tier) 후 cron 가동 | `orchestrateFullReport` Section 0~7 자동. queue = `report_batch_job` + `report_worker_run` run-mutex, fail = sequential + retry N=2 + summary/cost alert, cost ≈ 16,050원/월. cron dormant(flag off). **committee_votes/Section 8 = PR5b(D11 전 land hard gate)**. |
| **[defer] Step 4 Reflection / PR-K** | CLAUDE | **출시 게이트 아님** — S9/go-live 후 실 운용 결과 누적 시 | reflection_log 마이그 + Tier 1 context 주입. |
| **Step 7 S7b** 뉴스+브리핑 mock→real | USER(B-7 Resend + B-8 Naver) + CLAUDE | PR5 가동 후 | 실 Naver news sweep + Resend 도메인 인증 + 모닝 브리핑 cron. |
| **Step 8 D11 AI 가상 포트 1차 가동 게이트** | USER 운용 + CLAUDE 모니터링 | S7b 완료 + **PR-H/I/J D11 전 hard gate**(manual trigger 2종 + PR5b/Section8 full path + runtime mock grep 0) 완료 후, S7c 진입 전 | KIS 0개로 어드민 3인 며칠~1주 운용 검증 (의사결정 품질·승인·재생성 cap·뉴스 분류). **acceptance gate UI = 리포트 페이지 section_8 부재 시 '🤖 Tier 1 평가 대기' pill + Section 0 요약 🔢숫자/🤖AI/합의 배지 1행** (PR3b STEP-1, W-tier1pill 해소). **S7c 진입 게이트** (자동매매 S8은 출시 후). |
| **Step 9 S7c** 장중·KIS WS + Exit 2채널 | USER(B-9 Telegram + B-10 KIS) + CLAUDE | D11 검증 통과 후 | 실 alert_event + KIS read-only 1개(권한 확인, B-10) WS + J3 Exit 3채널 + 대안 3 + T+7 outcome. |
| **Step 10 S7d** Silent Health | CLAUDE | S7c 완료 후 | 5 파이프라인 success_rate + red_alert 0 + Exit outcome T+7 cron. |
| **Step 15 S9 운용 → 🎉 출시** | USER 1개월+ + CLAUDE hotfix | **S7d 완료 후** | 어드민 3인 실 사용 1개월+ + §2.2 7 criteria 통과 = 출시. **자동매매 없는 "AI 추천 + 가상 포트 + 알림" 도구**(criterion #7 N/A). |
| **[출시 후] S8 자동매매** (분리 단독) | USER(B-11 Binance) + CLAUDE | **출시 후** (어드민 3인 실운용하며 보면서 개발) | 주식 KIS + 바이낸스 USDT-M 선물 · Strategy drop-in + AI 어댑터 · 가드레일 + Binance Smoke #3. |

> PR4 lifecycle (50 BLOCKERS, 3-track Fix-First) 상세 = PR #19 body + git log + spec/plan/REVIEW docs.

---

## 3. 사용자 액션 대기 큐

| 우선 | 작업 | 필요 액션 |
|---|---|---|
| ⭐ PR-G ⓑ (실 AI 첫 30선정, ~~다음 1순위~~ → **65차 W0로 superseded**) | ⓐ ✅ MERGED. **63차 결정: ❶ B 청크 워커**(로컬 러너 폐기) **/ ❷ 하이브리드 데이터**(KRX 공식 API[시세·거래량·universe] + pykrx[S3 외국인] + DART[S4·S5]). **KRX 전환(PR #80)·150 시드·선정 청크 워커(PR #82, 마이그 0031 dormant) 빌드 ✅ 완료.** 잔여 = **마이그 0031 apply + `SELECTION_CRON_AUTO_ENABLED=true` + Anthropic 키 + 실 30선정 1회 비용 승인(~6.5-8만원)** → 워커 수동 트리거. **(PR #84 launch-readiness 감사: AI 선정 persist가 이제 name/sector/composite/signal carry — 첫 실 선정 시 빈 카드 잠복결함 제거)** | 한눈에 §다음 액션 큐 1번 참조 |
| PR5 gates a~e (별도 트랙) | Task 7 비용 승인 / ~~cron-system seed~~ ✅(62차 done, `CRON_SYSTEM_USER_ID` prod set) / Vercel `PR5_CRON_AUTO_ENABLED=true` / plan tier(OPS-1). 마이그 0027 ✅ applied | 한눈에 §[별도 트랙] PR5 + §0.A 참조 |
| ~~마이그 0030 apply~~ ✅ DONE (2026-06-02) | `0030_get_cost_log_monthly_total_admin` production applied + verify PASS: grant matrix(authenticated만/anon·service_role·PUBLIC 제외) + fail-closed 가드 production 확인(무세션→auth_unavailable raise) + advisor baseline + cost_log drift 0. STEP-2 cost_log 하드닝 production 활성 | §6 비용 0 라운드 entry |
| B-1 ~ B-5 (DQ-7) | 친구 비번 + KIS row 정리 + Smoke #4/#5 RLS + Session 4 QA | DQ-7 close 잔여 |
| B-7 | Resend 도메인 인증 | S7b briefing 진입 시 |
| B-8 | Naver key rotate/env | S7b news 진입 시 |
| ⭐ B-KRX (63차) | KRX 공식 Open API 키 = **발급·8서비스 승인 완료**(2026-06-02, 일별매매 유가/코스닥/코넥스 + 종목기본 + 신주인수권). USER 액션 = (1) **채팅 노출분 rotate 권장** (2) `.env.local`(로컬) + Vercel env `KRX_OPENAPI_KEY`(클라우드) 저장 — 평문 코드/커밋 금지. 투자자별/외국인 미제공(S3=pykrx 유지) | screen_shortlist 전환 시 (이번 세션) |
| B-9 | Telegram bot token + admin 3 chat_id | S7c alerts |
| B-10 KIS 키 (per-admin, 1/3 보유) | ★ KIS·Binance = **per-admin 키**(DQ-7 모델, 각자 UI 입력·암호화 저장). 현재 **3명 중 1명만 보유** (brokerage_connection 1행 = 다른 1명의 **모의(mock)** 키, account 있음·active·미사용, masked `PS**···9W7Q`). **사용자님 포함 2명 KIS 발급 필요.** S7c **장중 read-only 시세는 1개로 충분**(시세는 계정 공유 무관 — D18); per-admin 전체(특히 S8 자동매매 주문)는 3명 각자 필요. S7c 코드 잔여: 모의 키 실시간시세 권한 확인 + WebSocket 코드(CLAUDE 미구현) + Smoke #4/#5 | S7c(1개 read-only) / S8(3명 each) |
| FLAGGED 6종 (2026-06-02 FE-audit) | §6 FE-audit entry 박제. **phase 흡수**: alerts/[id] exit RPC·settings 3모드 → S7c / notifications 본체 seam → S7b(Resend/Telegram) / cost day-month·health error-tail → cron(PR5) go-live 후 / Bell 링크 = UX(veto 가능). 해당 phase 진입 시 audit-catalog §9.5 W-ticket 승격 | 각 phase 도달 시 |
| B-11 | Binance key (testnet 우선) | S8 진입 시 |
| B-D11 | D11 AI 가상 포트 며칠~1주 운용 검증 (어드민 3인 만족도 → S7c 진입 승인) | S7b + PR-H/I/J hard gate 완료 후, S7c 전 |
| ~~W-tier1pill~~ ✅ | Section 8 absent = Tier 1 평가 대기 pill UI — **STEP-1(PR #69)에서 반영** (리포트 페이지 pill + Section0 🔢🤖배지 1행). D11 acceptance gate UI 완료 | — |
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

> ⚠️ **본 §6은 과거 세션 완료 기록(history).** 각 entry의 "다음: PR-G ⓑ …" 표현은 **해당 차수 당시 기준**이며, **65차 현재 1순위는 상단 ⭐ MVP 엔진 W0 → W2 → W1 → W3** (PR-G ⓑ는 W0~W3로 superseded·코드 자산 재사용). 과거 행은 역사로 보존하며 개별 정정하지 않는다.

### 출시前 launch-readiness 역추적 감사 + 5-finding fix (64차, 2026-06-03, PR #84 MERGED main `a5ee63e`)

- **계기**: 사용자 "출시 가능 기준으로 프론트 기능을 역추적해 FE→BE→DB 배선 검증 + omxy 교차검증·수정 + 불필요 코드 정리 + 문서 동기화". **Workflow 17-surface 역추적 감사**(28 agents, FE→server action→data-lib→Supabase→migration, 의도-인지 적대 검증) + **omxy 교차검증 3 rounds**(code-reviewer + architect subagent + code-review-graph MCP).
- **감사 결과**: CONFIRMED real-broken **5건** (**P0/P1 배선/계약/보안/크래시 결함 0 = 배선 건전 확인**), intended-deferred 19건 재flag 0. omxy code-reviewer가 Claude 워크플로우 miss한 P1 1건 catch (교차검증 가치 실증).
- **SHORTLIST-PERSIST-METADATA-1 (P1, omxy catch)**: `upsertShortList30`이 실 AI 30선정 persist 시 `short_list_30`에 `name/sector/composite_score/signal_label` 미기록 → AI 신규 선정 ticker가 홈 카드·리포트 헤더·포트폴리오에서 빈 카드(PR-G ⓑ 첫 실 선정 시 발현). `tier0_candidates_150`(동일 month) best-effort lookup carry(sector=aggregate / name·composite·signal=lookup / try/catch fail-open). 마이그 0(컬럼 기존 nullable).
- **P2×3 i18n format-error**: `tier1_panel_incomplete`(AI-ENGINE-CONTRACT-1) / `orchestrator_failed`(TRACK-RECORD-1, `orchestrate_failed`와 별개) / report-worker 9종(`short_list_30_invalid_count` + DB-fault 8 = CRON-REPORT-1) 매핑 + prefix handler + inventory test.
- **P3 dead-code**: `getShortListDelta`(importer 0) 제거 + lint 미사용 5종 → lint 5 warn→0. `aggregateShortListDelta`/`ShortListDelta` 보존.
- **§2.0a 워크플로우**: Claude① `0821aa1`(P1+P2×3) → omxy②③ `11870df`(metadata lookup Promise rejection fail-open edge catch → try/catch + 회귀테스트) → Claude④ 재검증 → Phase D `a5ee63e`(dead-code+lint). omxy ROUND 3 catch-only: 2 subagent lane + parent **0 launch blocker** CONVERGED.
- **게이트**: build 26 routes / lint 0err **0warn**(5→0) / **test:ci 1621**(1602→+19) / tsc clean / 마이그 0 / AI cost 0. PR #84 rebase FF + delete-branch.
- **다음 1순위 불변 = PR-G ⓑ** (당시 기준 — **65차에서 W0~W3로 superseded**; 병렬 launch-hardening이라 당시 로드맵 단계 무변경 — PR #79와 동일 성격). **⭐ PR #84 metadata carry로 PR-G ⓑ 첫 실 선정 시 빈 카드 잠복결함 사전 제거** (단, PR-G ⓑ 게이트[마이그 0031 apply + flag + 키 + 비용]는 불변).

### PR-H 빌드 (63차, 2026-06-03) — 리포트 enrich + manual trigger 2종 + report-worker admin trigger

- **scope (ADR D-9, D11-전 hard-gate)**: 리포트 입력 placeholder→실데이터화 + 트리거 분리. **마이그 0**(기존 0027/0029 재사용) · **flag-off/mock=cost0**(실 AI=트리거 시점 USER 게이트).
- **신규 SoT**: `report-input-enricher.ts`(공통 헬퍼 — short_list_30 배지/aiScore/composite + DART `fetchFinancialsSummary`로 3 caller[triggerFullReport/regenerateReport/batch-worker]의 `'HOLD'/'🟡'/'근거 부족'` placeholder 교체, cost 0 DB read, enrichInput/orchestrate/prompt 계약 무변경 caller-side DI) + `triggerReportWorkerChunk` admin action(is_admin→service-role→runGuardedReportChunk, flag-off=cost0). reject→**별도 '30 재선정' 버튼**→triggerMonthlyBatch(자동 burn 방지). regenerateReport **is_admin 게이트**(대칭). Section0 1행은 PR3b STEP-1 기존 렌더(enrich 실값 자동 흐름).
- **§2.0a**: Claude① subagent(full scope) → **omxy②③ catch+fix**: ★**regenerate report-existence SELECT가 is_admin 前 프리패스** → admin gate 후로 이동 / triggerFullReport client-SoT 주입(name/sector를 client input 아닌 short_list_30 DB) + empty guard / raw DB error→`shortlist_lookup_failed` 분류 / **format-error +신규코드 한국어 매핑**(financials_corp_lookup_failed/report_worker_failed/enrich_failed/pr5_cron_auto_disabled/cron user) / 약한 테스트 assertion 보강 → **Claude④**(build 27 routes · lint 0err · **test:ci 1602**[+43 vs 1559] · tsc clean · auth-ordering fix 코드 확인).
- **다음**: [USER] report-worker 실가동 = `PR5_CRON_AUTO_ENABLED` 등(코드 wiring 완료, flag-off=cost0). PR-I/PR5b(Tier2+Section8) → PR-J(mock 정리). PR-G ⓑ와 병렬 가능.

### 선정 청크 워커 빌드 (63차, 2026-06-03, PR #82 — PR-G ⓑ 실행 메커니즘)

- **scope**: tier0_candidates_150(150) → Core 11 AI 평가 → 단/중/장 top10=30 → short_list_30 persist를 **PR5 report-worker 패턴 1:1 청크 워커**로 구현(단발 orchestrator 1650콜 300s 초과 해소, 63차 D-11). **마이그 0 applied · mock+flag-off=cost0 · 실 AI=PR-G ⓑ**.
- **신규 SoT**: 마이그 `0031_tier1_selection_worker.sql`(+rollback) = `tier1_selection_job` 큐(unique month/ticker, status 5-enum, panel_result jsonb) + `tier1_selection_run`(전용 run-mutex, run_id fencing, **finalized_at** idempotency) + 4 RPC(claim SKIP LOCKED/stale-sweep, mark done-guard, acquire 15min stale+finalized 차단, release fencing) — 0027 grant matrix/RLS/SECDEF clone. `tier1-selection-batch-worker.ts`(runGuardedSelectionChunk + runTier1SelectionChunk + finalizeSelection, persona-eval.ts 무수정 replay DI). `selection-worker/route.ts`(auth + `SELECTION_CRON_AUTO_ENABLED` flag + mutex + self-continue OPS-3). vercel.json daily + maxDuration 300.
- **§2.0a**: Claude① subagent(full scope clone) → **omxy②③ 3-fix**(finalize 재실행 idempotency = finalized_at acquire 차단 + run-table finalized mark + 정상경로 cost-warning emit 복구) → **Claude④**(build 27 routes · lint 0err 5warn · **test:ci 1559**(+33) · tsc clean · finalized_at acquire-gating 로직 정확 확인). mock+flag-off=cost0 테스트 증명.
- **다음**: [USER] 마이그 0031 production apply + `SELECTION_CRON_AUTO_ENABLED=true`(+`MONTHLY_BATCH_CRON_AI_ENABLED` 단일 활성) + Anthropic 키 + 비용 승인 → 청크 워커 가동 = **PR-G ⓑ 실 AI 첫 30선정**. **flag follow-up**: 두 cron 경로(단발/청크) 동시 ON 시 cost 중복(데이터는 분리 mutex 안전) — 운영 시 청크 워커 단독 ON. DP1(MIN_COMPLETED_PANELS threshold) = optional.

### 150 시드 production 적용 (63차, 2026-06-03) — tier0_candidates_150 150 rows

- **결과**: `tier0_candidates_150` month=2026-06 = **150 rows** (bucket short/mid/long = 50/50/50 disjoint, unique ticker 150, canonical 14 전부, **unresolved/placeholder 0**, ticker 6자리 정합). Supabase 실측 검증 완료(Claude④). cost 0(LLM 없음).
- **데이터 소스**: KRX 공식 Open API(S1 종가·S2 거래량·universe, env `KRX_OPENAPI_KEY`) + pykrx(S3 외국인, ~19종목 빈데이터=foreign 0 non-fatal) + DART(S4·S5). universe 2246 → 150 선정.
- **§2.0a 전과정 CONVERGED**: 통합 sanity(limit-60) → full dry-run(unresolved-selected 21 발견) → **Claude① 리서치 subagent**(21개 WebSearch → canonical 배정) → **omxy② 적대 검증**(WebSearch, 명백 오분류 0, CONVERGED) → `sector_override.json` +21(7→28) → `--apply`(B89 unresolved 0 통과) → Supabase 검증.
- **신규 SoT**: `scripts/sector_override.json` +21 ticker override(반도체 장비/2차전지 장비/바이오 R&D/조선 등 induty 오분류 보정). mapper unittest 32 GREEN.
- **다음**: [CLAUDE] 선정 청크 워커 PR → PR-G ⓑ 실 AI 첫 30선정(Anthropic 키 + 비용 승인). 150 후보가 Tier1 AI 평가 입력으로 준비됨.

### KRX 전환 코드 MERGED + FE 연결 검증 (63차, 2026-06-03, PR #80 main `30cb3b4`)

- **scope**: Tier 0 S1 종가·S2 거래량·universe = pykrx → **KRX 공식 Open API**(신규 `scripts/krx_openapi.py` + `fetch_universe` 보통주 정공법[KIND_STKCERT_TP_NM/SECUGRP_NM + UNIVERSE_FILTERS] + `prefetch_price_series` 날짜별 batch→ticker 시계열 + `fetch_price_signals` lookup). S3 외국인 pykrx KEEP-A, DART(S4/S5)·sector(induty) 무접촉. **마이그 0 · tudal/src 무변경**(Vercel 앱 빌드 no-op).
- **검토 (§2.0a)**: Claude① subagent → **omxy ②③**(UNIVERSE_FILTERS 재배선[인프라펀드/스팩 누출 fix]·`_krx_get` malformed guard·`ensure_pykrx` 복원) → **Claude ④**(unittest 37→**41 GREEN** + 빈 OutBlock→`[]` + **e2e 라이브 2793 tickers 완주**[구 throttle 해소] + 삼성전자 317000·momentum 0.415). CONVERGED.
- **FE 연결 검증 (§2.0a Phase 3)**: Claude① 4-agent audit + **omxy ② 독립 적대(5 vectors, catch-only, 무편집)** + Claude ④ → **연결 완료, 결함 0**. Tier0 numeric → `getActiveShortList`(tickerMeta 없이 DB 실값) → 어드민 **5 surface**(홈 카드/리포트 헤더/포트폴리오/트랙레코드/설정) 실값 렌더. 미렌더 = 전부 의도(AI 컬럼=PR-G ⓑ 전 "AI 대기" pill / 150후보=Tier1 입력 전용 중간산출물[마이그 0028+ADR] / audit·sub_tags 컬럼).
- **다음**: ✅ 150 시드 적용 완료(`tier0_candidates_150` 150 rows, 63차 — 아래 entry) → [CLAUDE] 선정 청크 워커 PR → PR-G ⓑ 실 AI 첫 30선정. **선택 follow-up**: `trend_score = momentum` 복제(pre-existing 데이터품질, 카드 T축=M축 동일, KRX 전환·연결 무관).
- **🔑 KRX_OPENAPI_KEY**: 발급·8서비스 승인 완료(2026-06-02). [USER] 채팅 노출분 rotate 권장 + `.env`/Vercel env 저장(평문 커밋 금지).

### 데이터 소스 + 실행 아키텍처 결정 (63차, 2026-06-02) — 사용자 ❶❷ 확정 + KRX 공식 API 라이브 검증

- **계기**: 사용자 "출시까지 남은 작업 정리" → PR-G ⓑ 실행방식(❶) + 150 시드 throttle 데이터소스(❷) 재검토. 사용자 결정 후 문서 전면 동기화. (코드 변경 0 — 본 entry는 결정 박제, 구현은 다음 세션.)
- **❶ 실행 = B 청크 워커 (로컬 러너 supersede)**: 로컬 one-off 러너는 "컴퓨터 꺼지면 매달 자동 불가"(사용자 catch). 동기 단발(cron/admin/로컬) 모두 1650콜 ~30-55분 > serverless 300s. **확정 = Vercel cron 청크 워커**(PR5 report-worker 패턴 복제: `tier1_selection_job` 큐 + claim_next + run-mutex + self-continue). 첫 1회 검증·매달 자동 단일화. **OPEN** = 150 시드 S3(pykrx=Python) monthly 스케줄(GitHub Actions 등 외부 cron — Vercel은 TS만).
- **❷ 데이터 = 하이브리드 (KRX 공식 API 라이브 검증)**: 구 throttle 원인 = pykrx(비공식 스크레이핑) 종목별 수천 콜. **확정**: S1 종가·S2 거래량·universe = **KRX 공식 Open API**(`data-dbg.krx.co.kr/svc/apis/`, `AUTH_KEY` 헤더, env `KRX_OPENAPI_KEY`) — 날짜별 전종목 1콜 → throttle 근본 해결. S3 외국인 = pykrx(공식 API 미제공). S4·S5 = DART(유지).
  - **라이브 검증 (사용자 키, 8서비스 승인 2026-06-02)**: `sto/stk_bydd_trd` 948종목 HTTP 200(삼성전자 종가 317,000·거래량 37,241,537), `ksq_bydd_trd`·`stk_isu_base_info` 200. 외국인 후보 endpoint 404("API does not exist"). 키 유효성 = 틀린 키 `Unauthorized Key` vs 주신 키 `Unauthorized API Call`(활용신청 전) → 활용신청 후 200 확인.
- **CLAUDE 다음 작업(cost 0)**: `screen_shortlist_tier0.py` S1/S2/universe → KRX 공식 REST 전환 + S3 pykrx 기간일괄 최적화 + env `KRX_OPENAPI_KEY`. 그 후 선정 청크 워커 PR(B).
- **보안**: KRX 키가 채팅에 평문 노출 → rotate 권장 + env-only(코드/커밋/로그 금지).

### 프론트 bridge-gap·spec-drift sweep (2026-06-02, PR #74 MERGED `b3ee84a`) — omxy ①조사+②수정 / Claude ③검증

- **계기**: 사용자 "bridge 안 되어 프론트 미노출 / 기획과 다른 것 = omxy가 subagent·agent·skill로 컴포넌트 하나하나 검증+수정, 그 후 Claude 검증. 거기까지가 이번 세션." (역할 반전: omxy ①②, Claude ③.)
- **omxy 방식**: admin 14페이지 × subagent(code-reviewer+architect) + code-review-graph MCP + **Playwright 실 렌더 검증**. 컴포넌트별 verdict 표(OK/bridge-gap/spec-drift/intended-empty/flag).
- **FIXED (cost-0, 기획 근거, Claude ③ 검증 통과)**: (1) layout nav `settings/notifications`("알림 채널") 미노출 → 추가 (2) track-record archive → `/admin/report/[ticker]?month=YYYY-MM` deep-link + report `searchParams` 月 수용(+neighbors/regenerate 月 전파) = ServicePlan-Admin §line414 스펙 정합, default 무회귀 (3) report Section8 partD "Core 11 개별 의견" 미렌더 → 렌더 (4) portfolio: 하드코딩 `adminId:"admin-001"` 제거(본체 resolveAdminId() 세션 파생) + `resolveDispute` dangling→"이의 해결" 버튼 wired + Reject 배너 거짓("큐 추가됨")→정직("큐 미연결") + invariant 테스트 3 신규/2 보강.
- **게이트**: build 26 / lint 0err 5warn / test:ci 1513/135(+12) / tsc clean. 마이그 0 / AI cost 0. canary 3/3.
- **⚠️ FLAGGED follow-up (omxy 미수정 — 더 큰 scope/결정/deferred, 신규 W-ticket 후보)**: ① alerts/[id] exit decision 저장 RPC grant·RLS 결정 ② settings(index) 3모드·임계치 persistence ③ settings/cost day↔month switch·override(M17 R3.12 확장) ④ settings/health live error-tail source ⑤ settings/notifications 페이지 본체 backend seam(현 nav 노출만, 채널 설정 persistence 별도) ⑥ layout Bell→/admin/alerts 헤더 링크 = alerts 이미 nav 존재 → UX 추가(borderline, 유지·USER veto 가능).
- **LEFT(intended-empty/deferred, 정확히 미수정)**: /admin 홈 브리핑·장중 카드(S7b/c) / alerts(PR-A 완료) / decision-tree seed / brokerage·binance(ping-gated) / main member mock.

### 비용 0 비-AI 하드닝 라운드 (2026-06-02, 사용자 "AI 보류 중 할 수 있는 것" 요청) — 3 PR MERGED

- **계기**: 사용자 "실 AI 비용 보류, 그 전 비용 0 작업만 단계별 진행 (workflows + Claude①→omxy②→Claude③ + 합의 후 진행 + 불필요 작업 금지)". plan SoT = `docs/superpowers/plans/2026-06-02-nonai-zero-cost-worklist.md`.
- **플랜**: 12-step 초안 → omxy R2 CONVERGED → **남은 STEP-3~12 코드레벨 일괄 감사(Workflow 21 agents + 적대 re-bucket)** → 🟢2 / 🟡6 DEFER / 🔵1 USER / ⬜1 DROP (premature 6개 솎아냄 = "너무 느리다" 해소).
- **MERGED 3건** (전부 비용 0, 게이트 ALL GREEN, omxy CONVERGED, §2.0a 4-step):
  - **STEP-1** 리포트 UI sweep `d00bd53` (PR #69): SectionFallback stale 정정 + Tier1 평가대기 pill + Section0 🔢🤖배지 1행 (W-tier1pill·W-sectionfallback-text 해소). test:ci 1459/127.
  - **STEP-2** cost_log RPC `31cb624` (PR #70): 마이그 0030 `get_cost_log_monthly_total_admin` SECDEF(non-admin silent-0 fail-open → fail-closed) + **service-role fork**(session=RPC / cron·worker·orchestrator·writer=직접 SELECT, callerKind). omxy가 누락 caller(orchestrator/writer cron) + unrelated-42883 fail-open catch. test:ci 1476.
  - **PR-A**(=STEP-3 a+c → 4페이지 확장) `24559cc` (PR #71): health/alerts/alerts[id]/cost 전부 explicit `rpc('is_admin')` silent-0 diagnostic 배너(마이그 0). test:ci 1501/132.
- **PR-B(STEP-7 seam) DEFER**: 코드 검증 결과 VoteList가 personas를 id로 매칭(vote-roster)이고 실 vote id 스키마는 PR-I에서 확정 → STEP-8/PR-I와 일관 재배선. 단독 swap premature.
- **잔여 = 전부 DEFER(실AI/cron) 또는 USER**. 추가 비용 0 CLAUDE 작업 0. **마이그 0030 ✅ apply DONE (2026-06-02)** — STEP-2 cost_log 하드닝 production 활성(verify PASS). 비용 0 라운드 USER 잔여 = 0.
- **end-state**: main `24559cc`. test:ci 1501/132 PASS / build 26 / lint 0err 5warn / tsc clean. **마이그 0001~0030 production applied** (0030 = 2026-06-02 cost RPC). DB 드리프트 0(cost_log=0 등, PR-A는 마이그 0). 다음 = 실AI 켜기 결정(PR-G ⓑ) 또는 DEFER 항목 트리거 시점.

### PR-G ⓑ prep (62차) — ④ 보류 + ④ 실행방식 결정 (코드/DB 변경 0, 외부 prep만)

> **[63차 supersede]** ④ "로컬 러너 확정" → **B 청크 워커**(컴퓨터-off 시 매달 자동 불가 + 첫 검증·자동 단일화). 데이터 소스도 KRX 공식 API 하이브리드 확정. 상단 "데이터 소스 + 실행 아키텍처 결정 (63차)" entry 참조.

- **계기**: 사용자 "①~④ 전부 너가 진행 (workflows + omxy 검증·수정)". CLAUDE가 external-state prep 수행 + ④ 실행가능성 pre-burn 검증.
- **수행**: ② cron-system auth user 생성(GoTrue admin API) `39202d8b-1042-48a6-8da0-df14a52fabea` (getUserById 검증). ③ Vercel prod env: `CRON_SYSTEM_USER_ID` 추가(유지) + `MONTHLY_BATCH_CRON_AI_ENABLED` 추가→**false 복원**(안전) + 재배포(`tudal-tawny` alias) + `AI_COST_LOG_REAL_INSERT_ENABLED=true`/`ANTHROPIC_API_KEY` 확인. ① KRX/DART 150 스크리닝 → **KRX throttle 실패**(~2000/2269, tier0_150=0, 부분기록 0).
- **⚠️ ④ 핵심 발견 (Claude+omxy R4 CONVERGED)**: cron/admin HTTP 동기 트리거 = 1650 Opus콜 ~30-55분 ≫ maxDuration(≤300s) → **타임아웃·NON-VIABLE**. timeout 시 cost_log도 미기록 가능. **[HISTORICAL · 63차에서 폐기] 당시 임시 결론 = 로컬 러너**(A′ 체크포인트 + B callPersona transient 재시도)였으나, 63차 결정으로 **Vercel cron 청크 워커**가 current guidance가 됨. 실비용 정정 ~6.5-8만원(구 ~5-6천원 오기). 사용자 ④ 보류 결정은 superseded.
- **end-state**: DB 드리프트 0(cost_log=0, tier0_150=0, short_list_30=30 2026-05만, AI컬럼 null). prod env 안전(flag false). 코드/마이그 변경 0. 다음 세션 = §다음 액션 큐 1.

### PR-G ⓐ MERGED — cron monthly-batch 실 AI prep (PR #68, main `d15da47`)

- **scope**: cron이 실 Core 11 AI 30선정을 켤 수 있도록 배선 + **default-off=cost 0 (merge-safe)**. ① `anthropic-client.callPersona`에 `costClient?:SupabaseClient` DI → `insertCostLog(row,{client})` (admin=session fallback 무변경 / cron=service-role RLS bypass + called_by FK). ② `persona-panel-adapter.makeCallPersonaPanel` costClient thread. ③ cron route `preflightCronBlockedUntilPrG`(무조건 throw) → **`preflightCronRealAi` 4-gate fail-closed**(`MONTHLY_BATCH_CRON_AI_ENABLED` flag + `isCostLoggingEnabled` + `ANTHROPIC_API_KEY` + `CRON_SYSTEM_USER_ID` UUID/auth.users) + 통과 시 `preflightHardcap`(service-role) + 실 `makeCallPersonaPanel`/`fetchFinancialsSummary` 배선. ④ `.env.example` flag(PR5 step-0 패턴). UUID_RE = PR5 worker 패턴 정합.
- **검토 (§2.0a 4-step + 교차)**: ① Claude impl(`4719ec9`) → **Workflow 6-dim 적대 검토(22 agents): 16 findings → 0 confirmed/16 refuted** → **② omxy 적대 검증(2-subagent code-reviewer/architect + code-review-graph MCP): 프로덕션 코드 결함 0, CONVERGED** → **③ omxy direct-edit**: route-level contract 테스트 2종(flag-off→502+callPersona 0회 cost-safe 종단 / open-gate→order+costClient·service-role 전파 증명) + env-isolation 강화 → **④ Claude 재검증**(`d15da47`): omxy 테스트 코드근거 확인 + orchestrator stale 주석 2곳 정정.
- **게이트**: build 26 / lint 0err 5warn(pre-existing) / **test:ci 1449 PASS**(+11) / tsc clean. 마이그 불필요. production audit 무드리프트(cost_log=0 유지) + 공개 canary 3/3.
- **commit**: PR #68 (2 commits — `4719ec9` impl + `d15da47` omxy test/④ 주석 — rebase FF). 
- **다음**: PR-G ⓑ(USER external state — Vercel flag + 150 시드 + CRON_SYSTEM_USER_ID seed + 실 AI 첫 30선정 비용 승인).

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
- **당시 계획**: PR-D(tier0 150) → E(AI 스키마+un-stub) → F(프론트) → G(env+실 AI 첫 선정) → H/I/J/K. **현재 D~F 완료, ~~다음 = PR-G~~ [→ 65차 W0~W3로 superseded, 상단 ⭐ 섹션]** (PR-G 코드 자산은 W0~W3 토대 재사용).
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
