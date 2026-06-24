# Tier0 스코어링 B++ (size-sleeve recall-first) + 삼중 게이트 검증 — 다음 세션 실행 스펙

> **⭐ 2026-06-24 APPLIED — G1/G2 production 적용 완료 (Claude↔omxy CONVERGED).** §5 step5 `--apply` 가드를 `--apply-approval-basis USER_PRODUCTION_FUNNEL_DIAGNOSTIC` 토큰으로 완화(`screen_shortlist_tier0.py` run_bpp_candidates; cfg1 lock = foreign/earnings/quality neutral 결정론; B89 strict on apply; 강제 disclosure + provenance sidecar + 자동 rollback 백업; python unittest 189). **G1**: `tier0_candidates_150` 2026-06 = B++ cfg1, 리더 4/11(삼성전자·SK하이닉스·두산에너빌리티·HD현대일렉트릭; 73차 1/11), Gate C PASS, unresolved 0(sector_override +12). **G2**: P3 full-run 재선정(selection-run reset + ~₩27k) → `short_list_30` 2026-06 = B++ 새 30, 리더 2/11. ⚠️ **B++ = retrieval 개선 diagnostic funnel이지 예측 게이트 통과 아님**(NO-CONFIG-PASSES 유지·상승 예측 claim 금지). live SoT = `Document/Process/HANDOFF.md` + `ProgressDashboard.md [CURRENT 2026-06-24]`.
>
> 작성 2026-06-12 (77차). **상태 = step-2 harvest 실행 완료 → triple-gate FAIL, Claude↔omxy CONVERGED(본 세션 후속).** §3 설계 + §4 게이트 + step-2 harvest harness 전부 구현·MERGED. **VERDICT(19mo 2024-06~2025-12, 순수 trend+size, cost 0): Gate A FAIL(overall recall 0.108<0.20, but B++>baseline + largemid 0.431 + leaders 7/11) · Gate B ADJUDICATE(IC IR 0.26<0.30, large-IC +0.08, B++>>baseline) · Gate C PASS(60/60/30). TRIPLE GATE ALL PASS=False.** ⇒ B++ = 대형 retrieval 개선 실증 + baseline 상회(복잡도 정당화)하나 절대 예측 임계 미달 → **diagnostic leader-inclusive generator**. **이 step-2 시점의 `--apply`/Tier1 금지는 2026-06-19 USER 운영 funnel 승인으로 supersede됐고, "상승 예측" claim 금지는 유지.** 깨끗한 full-factor verdict는 이후 완료(NO-CONFIG-PASSES). 구현: `scripts/validate_tier0_ic.py`(harvest driver) + `scripts/dart_signals.py`(PIT as-of/cache-only/availability) + `scripts/tier0_factors.py` + `screen_shortlist_tier0.py --scoring bpp`. 상세 = §5·§6.
> **⚠️ B+ → B++ amend (2026-06-12 실증 후속):** 처음 합의한 "B+ 형태수정 + 경량 IC"는 **실증 검증 결과 단독 REJECT**.
> production 후보 150에 대형 상승 주도주 11개 중 SK하이닉스만 진입(나머지 전부 누락)이 데이터로 확인됨 →
> 근본원인 = **구조적 retrieval 실패**(지속추세 시그널 부재 + 소형주 구성편향), B+ 정규화로는 못 고침.
> **Claude 퀀트 에이전트 + omxy(트레이딩/퀀트 sub-agent + 한국 모멘텀 문헌 웹리서치) 2 독립 토론 → B++ CONVERGED**
> (main Opus 종합·판정). 사용자 합격 기준 = **recall + rank-IC + size 삼중 엄격 게이트**.
> 본 문서 = B++ 설계 + 삼중 게이트 실행 스펙 + verdict 박제. **step-2 harvest 실행 완료 → triple-gate FAIL → Claude↔omxy CONVERGED → MERGED(PR #122).** 이 시점의 다음 선택(full-factor rerun vs diagnostic 유지)과 --apply/Tier1 보류는 **2026-06-19 UPDATE로 SUPERSEDED**: full-factor/tradable/combination까지 전부 실패했고 USER가 B++ diagnostic funnel 적용을 승인(예측 claim 금지는 유지).
>
> **⭐ 2026-06-19 UPDATE — 캠페인 완결 + USER 적용 결정 (범위 Claude↔omxy CONVERGED):** full-factor 4-config×3-regime(NO-CONFIG-PASSES) + tradable-winner-denominator(공정 분모 ALL-12-FAIL = 분모 장벽 아님) + combination 캠페인(P0+P1+P3+P5+B++ref 전부 FAIL·어떤 조합도 B++ 미개선) 전부 완료. **결론: B++(trend+size)이 최선의 진단 funnel — 무료 데이터로는 게이트 통과 예측 스킬 부재.** **USER 결정 = B++을 production Tier0 150-scorer로 적용** — 단 **funnel 업그레이드(73차→B++)지 예측 게이트 통과/claim 아님.** §5 step 5의 "삼중 게이트 ALL PASS 시에만 --apply" 가드는 **"USER 운영 funnel 승인(approval_basis=USER_PRODUCTION_FUNNEL_DIAGNOSTIC)" 근거로 다음 세션 완화 예정**(예측 게이트 미통과 사실은 출력에 명시 유지). 실행 가이드(G1 --apply candidate write → STOP → G2 Tier1 ~₩25k 별도 승인 + rollback 백업 + cfg1 trend+size·foreign/DART OFF) = `Document/Process/HANDOFF.md §"다음 할 일" ★`. 캠페인 SoT = `docs/superpowers/2026-06-18-tier0-tradable-winner-denominator.md §8` + `docs/superpowers/2026-06-18-tier0-combination-campaign.md §7`.

---

## 0. 배경 (왜 이 작업인가)
- 사용자 발견(76차): AI 포트엔 SK하이닉스 있는데 30-리스트엔 없고 삼성전자 부재 → "후보 150이 정말 **향후 상승할 기업을 올바르게 예측·선별**하느냐"가 핵심 질문.
- **77차 실증(production tier0_candidates_150 2026-06-01, MCP 직접 쿼리) — 사용자 직감 확증**:
  - 알려진 대형 상승 주도주 11개 중 **SK하이닉스(long #38)만 진입**, 나머지 **전부 미진입**: 삼성전자·HD현대일렉트릭·한화오션·HD현대중공업·한화에어로스페이스·삼성중공업·LG에너지솔루션·두산에너빌리티·에코프로·에코프로비엠.
  - 상위 픽 = 소형·초소형주(피델릭스 85.3·한주라이트메탈 84.7·지아이이노베이션·디티씨·신테카바이오·스피어…).
  - 점수 압축: short 67.4~85.3 / mid 57.4~70.6 / **long 53.7~58.6(5점 폭, 50종목)** → 중립값 50 근처 군집, 변별력 거의 0.
- **1차 토론(B+)**: "B-only=무근거 교체 BLOCKER, 풀 재설계=과함" → "B+ + 경량 IC"가 최소 경로로 CONVERGED.
- **2차 토론(실증 후, B+ REJECT → B++)**: 위 실증을 다시 먹임. omxy + Claude 퀀트 독립 수렴 = **B+ 단독은 사용자 삼중 게이트를 통과 못 함**. 근본원인은 정규화가 아니라 **(a) 지속추세 시그널 부재**(현 모멘텀은 60일 단기·반전 편향뿐 → 1년 오른 대형 주도주는 close/MA60 비율이 이미 1.0 수렴해 구조적으로 안 보임) **+ (b) 원시비율 모멘텀×거래량이 저가·고변동 소형주에 점수 몰아줌**(= alpha 아닌 size+변동성 노출). **AI 2차는 150에 없는 종목을 구제 불가 → recall은 100% Tier0 책임.**
- **결론 = B++**: B+ 형태수정(정규화·결측·foreign·sector quality) **위에** size-sleeve recall-first 퍼널 + 모멘텀 재설계 + 수기가중치 폐기 + recall/rank-IC/size 삼중 게이트.

## 1. 현 Tier0 스코어링 (검증·교체 대상, `scripts/screen_shortlist_tier0.py`)
- universe: KOSPI+KOSDAQ 시총≥300억(~2187), ETF/REIT/SPAC/우선주 제외.
- 5 raw 시그널 → cross-section **z정규화** `z_normalize_to_0_100`=`(z+3)/6×100` clamp 0~100:
  ① momentum=close/MA60 ② volume_surge=MA5/MA60 ③ foreign_net=외국인 순매수 60영업일 **WON 절대합**(pykrx; ~2% fail-soft 0) ④ earnings=DART YoY ⑤ quality=DART composite + volatility(반전).
- 시간대 가중치(수기): 단 .40/.30/.20/.05/.05 · 중 .20/.15/.15/.30/.20 · 장 .10/.05/.05/.20/.60.
- 단/중/장 각 top50 = 150 (`--emit-candidates` → tier0_candidates_150, AI 메인 path 입력).
- **데이터 인프라(이미 fetch됨, 무비용 활용 가능)**: KRX `bydd_trd` 배치에 `MKTCAP`·`LIST_SHRS`·`ACC_TRDVAL` 존재 → **log-시총·ADV·turnover 전부 파생 가능**(size sleeve·유동성 플로어·foreign ADV 정규화의 데이터 소스).

## 2. 확정 결함 (두 독립 비평 합의)
1. **[HIGH·결정적·신규] 지속추세 시그널 부재 = 구조적 retrieval 실패**: 현 모멘텀(close/MA60)은 60일 단기·반전 편향뿐. 대형 주도주(방산·조선·원전)는 다개월 지속 상승이라 60일 평균 대비 비율이 1.0 근처 수렴 → **구조적으로 배제**. **B+ 정규화로 안 고쳐짐**(→ §3C 지속추세 시그널 신설).
2. **[HIGH·신규] 소형주 구성편향**: 위험-미조정 단기모멘텀 × (상관 높은) volume_surge → 저가·고변동 소형주 점수 폭발 = "alpha 아닌 size+변동성 노출"(→ §3A size sleeve + §3B 유동성 플로어 + §3C vol-조정).
3. **[HIGH] 결측 데이터 0 주입 → 분포 오염**: earnings 결측 `=0.0`(dart_signals.py:468), quality 유효지표<3 시 0.0(:179), DART 키 부재 시 전종목 0. z-pool 오염 + long bucket "공시 있는 종목"만 뽑는 구조적 selection(→ §3C 결측 tiering).
4. **[HIGH] z정규화 fat-tail 압축**: 극단치 1개가 σ 부풀려 나머지를 50점 압축(long 5점 폭 실증)(→ §3C winsorize+percentile rank).
5. **[HIGH] foreign_net size bias**: WON 절대합 = 시총 프록시(→ §3C foreign ADV 정규화 + Large/Mid 보조 sponsorship rank).
6. **[HIGH] 수기 가중치 미검증**: 0.40/0.30/… IC/백테스트 0(→ §3D rank ensemble + baseline 비교).
7. **[MED] 시그널 상호상관 무시**: momentum-volume 강상관 → 단기 bucket 사실상 모멘텀 집중(→ §3C 상관 진단 + volume 종속화).

## 3. B++ 설계 (✅ 구현 완료 MERGED PR #121 — `tier0_factors.py`/`screen_shortlist_tier0.py`/`dart_signals.py`)

### 3A. 후보 150 구성 = size sleeve (recall-first 퍼널)
- 월별 eligible universe를 시총 tier 분할: **Large(시총 상위 20%) · Mid(다음 40%) · Small-liquid(하위 40%, 단 §3B 유동성 플로어 충족)**.
- 각 horizon 50개 슬롯 = **Large 20 / Mid 20 / Small-liquid 10** → 전체 150 = **Large 60 / Mid 60 / Small 30**.
- 종목은 **자기 size sleeve 내부에서 cross-sectional rank** 경쟁(대형 주도주가 소형 로켓과 직접 경쟁하지 않음 — 공정 lane 보장 + 정당한 소형 위너 보존).
- **쿼터 수치(20/20/10)는 [assumption] — §4 recall 백테스트로 calibrate**(수기 가중치 전철 금지). sleeve 부족/중복 backfill 실패 시 **자동 완화 금지, report 후 중단**(무음 truncation 금지).
- **순수 log-mcap residualization(OLS 잔차화)은 primary 채택 금지**: 한국 cross-section은 bimodal(소수 mega-cap + 긴 소형 tail)이라 OLS slope 불안정·불투명. residual-size 상관은 **진단 출력**으로만(§4 Gate C report).

### 3B. 유동성 플로어 (universe gate — 가장 싸고 강력, 최우선)
- ADV60(60일 median 거래대금) **≥ ₩20억**(omxy) ~ ₩5–10억(Claude 대안) 사이 [assumption — 하위 유동성 decile 제거되게 calibrate] **충족 못 하면 universe 제외**.
- **anti-pump**: 60일 turnover 상위 ~1% 또는 단발 급등(1~5D spike)만으로 surge → 제외/penalty.
- `ACC_TRDVAL`로 무비용 계산. **이 한 가지가 소형 급등주(피델릭스·한주라이트메탈 류)를 스코어링 전에 제거** — 최고 leverage·최저 risk.

### 3C. 시그널 재설계
- **정규화**: z-only 폐기 → **winsorize[1%,99%] 후 percentile rank 0~100**. volume·foreign은 fat-tail이라 percentile rank 전 `signed-log` 선행.
- **결측 tiering**(0주입 폐기): rank 계산에서 결측 제외 + (a) 구조적 결측(DART 미공시/신규상장) = **neutral 50** (b) ticker-specific fetch 실패 = **penalty(하위 10%ile=5점)+flag**. long bucket이 "공시 있는 종목"만 뽑던 구조적 selection 차단.
- **momentum 재설계**(close/MA60·MA5/MA60 중심 폐기) — **risk-adjusted 멀티호라이즌 trend**:
  - short: 20D/60D risk-adjusted trend `(ret/σ)` + 1~5D spike penalty
  - mid: 63D/126D risk-adjusted trend
  - long: 126D/252D trend + **52주 고가 근접도**(대형 주도주 포착 시그널)
  - lookback 확장 필요(현 `PRICE_WINDOW_DAYS=90` → ~300 calendar days). **skip 컨벤션 = 12-1(최근 1개월 ≈ 21거래일 제외, 단기 반전 오염 차단)으로 고정**(omxy LOW: "~5D 제외" 표기 혼선 정정 — 표준 12-1 채택, 구현 시 단일값).
- **foreign**: primary = `foreign_net_60d / traded_value_60d`(ADV 정규화). **Large/Mid는 보조로 absolute sponsorship rank 병용**(한국 외국인 영향이 대형주에 집중 — omxy 문헌 근거). secondary diagnostic = `/market_cap`.
- **quality·earnings**: **sector-relative rank**(업종 내 순위 — 금융/제조/바이오 동일 공식 cross-universe 비교 금지).
- **volume_surge**: alpha driver 아님. **trend 확인 시에만 capped confirmation bonus**(추세 동반 거래 = 축적 / 단발 급등 = 펌프 → penalty). **long volume bonus = 0**.
- **상관 진단 출력**: 재설계 시그널 cross-sectional 상관행렬 매 run 로그. trend-momentum 상관 >0.8이면 단일 trend factor로 통합(이중계산 방지).

### 3D. 스코어링 = 수기 가중치 폐기 → rank ensemble
- `score = mean(trend, foreign, earnings, quality) + capped_volume_bonus − risk/liquidity_penalty` (long volume bonus 0).
- **현 수기 가중치(0.40/…) 그대로 사용 금지** — current/B+ manual weights·equal-weight·IC-weighted(shrinkage)는 **§4 validation baseline으로만** 비교. **B++가 baseline보다 recall 또는 IC를 악화하면 fail**(복잡도 정당화 강제).

> **문구 게이트**: 삼중 게이트 통과 전까지 산출물 설명은 **"robust, factor-informed, leader-inclusive candidate shortlist"**까지만. **"향후 상승 예측" claim은 §4 통과 후에만.**

## 4. 삼중 게이트 검증 (recall + rank-IC + size — AND posture)
> 신규 하버스트 `scripts/validate_tier0_ic.py`가 세 게이트를 **모두** 산출. PIT 월별 24M 권장/최소 12M.
> **핵심 원칙(Claude·main 판정): Tier0는 recall 도구이지 mini-portfolio가 아니다.** recall과 whole-cross-section IC는 부분 상충 → IC를 전체에 강제하면 precision 편향이 재발(현 버그로 회귀). 그래서 IC는 scope를 건다(아래 Gate B).

### Gate A — Recall (primary, 사용자 질문의 정답지)
- winner = horizon별 **forward return top decile AND positive**(short 1M / mid 3M / long 6M).
- **PASS**: ① overall Recall@150 ≥ 20% **AND** random 대비 ≥2.5x · ② horizon별 Recall@50 ≥ 12% · ③ **Large+Mid winner Recall@150 ≥ 35% AND overall recall의 ≥80%**(대형주 recall이 전체에 크게 뒤지지 않음) · ④ naive baseline(예: 유동 universe 내 6M모멘텀+earnings equal-rank) 대비 우위.
- **visible-trend-miss vs prediction-miss = attribution/diagnostic 전용**(omxy MED1 fix): **primary Gate A recall의 분모는 항상 전체 top-decile positive winners로 고정**(prediction-miss를 분모에서 빼서 recall을 사후로 부풀리는 것 금지). 놓친 winner를 (a) 선정일 t에 이미 추세였는데 놓침(고칠 수 있는 blind spot, 심각) vs (b) t엔 조용하다 뉴스로 급등(예측 불가)으로 **분류해 보고만** 한다 — 이 conditional 수치는 *왜* 놓쳤는지 해석용이지 합격 분모 조정용이 아님.
- **sentinel(비최적화 tripwire, 합격 기준 아님)**: 관측 11-leader basket(삼성전자·HD현대일렉 등) — **1/11 반복이면 명백 실패**. 단 **파라미터를 이 11종목 맞추려 튜닝 절대 금지(target leakage)**. 정식 합격은 위 aggregate PIT/OOS recall로만. (omxy는 ≥7/11 hard 제안했으나, main 판정 = 특정 종목명 합격기준화는 overfitting → tripwire로만 강등.)

### Gate B — Rank-IC (scoped sanity)
- matched 1/3/6M composite IC mean > 0 · primary 3M IC IR ≥ 0.3(잠정·omxy 재확인) · positive IC months ≥ 60% · top decile − bottom decile spread > 0 (거래세 0.18~0.23%+슬리피지 차감 후) · B++가 baseline IC IR 하회 시 fail. Alphalens식 Spearman IC/forward return 구조.
- **IC 측정 scope**: **유동 universe 내 + size 슬리브별 + (필요시) top-tercile**(전체 cross-section 강제 = recall 도구에 precision 강요 = category error). **Large/Mid 슬리브 각각 IC mean > 0**(omxy MED2: 이 슬리브별 IC 조건은 백테스트 필요 → Gate C 아닌 본 Gate B 소속).
- **참고(중복 제거, Claude 자가검토)**: "Large/Mid recall이 전체 대비 충분한가"는 **recall 개념이므로 Gate A ③(≥35% AND overall의 ≥80%)에서 단일 평가** — Gate B에 별도 recall-gap 조건을 두지 않는다(같은 개념 이중 임계 방지).
- **"recall 통과 / composite-IC 실패" → 자동 reject 금지, 사용자 adjudication**(omxy 수용): scoped/top-tercile IC·분위 스프레드가 **전부** 나쁘면 reject(score=노이즈), **mixed case만** 사용자 adjudication(하단만 평탄·상단은 변별 = recall 도구로 허용 가능).

### Gate C — Size composition (deterministic 진입조건 — 백테스트 불요)
- 최종 150 sleeve dist = **60/60/30 유지** · Small-liquid ≤ 25% · score-log(mcap) 상관 **report 필수**(단독 pass 기준 아님). **(omxy MED2 fix: 슬리브별 IC·leader-recall-gap 같은 백테스트 필요 조건은 Gate B로 이동. Gate C는 단일 스크린 산출물의 size 분포·구성만 결정론적으로 확인.)**
- **이 게이트는 새 스크린 1회 산출로 확인(같은 세션 smoke)** — 소형주 독식 사라지나 + 대형 주도주가 150에 진입하나. **Gate A/B 백테스트 전 진입조건.**

### 데이터 검증 리스크 (반드시 선결)
- **survivorship(최대 리스크)**: PIT universe는 상폐·관리종목 포함이어야 함(현재 live universe면 recall 상향 편향). **pykrx/KRX historical은 생존자만 반환 가능성** → PIT+상폐 universe 가능 여부 **§5 step 0에서 먼저 해결**. 불가 시 "survivorship-biased, recall=upper bound" 명시 라벨 + 신뢰도 하향.
- **DART announcement-date PIT**: 현 코드는 fiscal-quarter 키 → **미래 실적 leakage**. 공시일+grace(30D)로 fix해야 IC/recall 유효.
- entry = t close 아닌 **t+1 open/close**(스크린은 t 종가 후 실행).

## 5. 실행 순서 (step 0~3 ✅ DONE — harvest 실행+CONVERGED+MERGED PR #122 / step 4~5 = 2026-06-19 UPDATE로 SUPERSEDED)
0. ✅ **survivorship feasibility — RESOLVED**: `scripts/probe_pit_survivorship.py` PASS — KRX `bydd_trd` historical = PIT universe(상폐-at-time 포함). upper-bound 라벨 불요(harvest는 라벨 게이트 코드 유지).
1. ✅ **cheap deterministic wins 구현 MERGED + Gate C smoke PASS**: §3B 유동성 플로어 + §3C vol-adj trend·52w-high·결측 tiering + §3A size sleeve = `tier0_factors.score_bpp_universe` + `screen --scoring bpp`. **Gate C smoke ✅ PASS**(실 KRX 2197종목 dry-run·비용 0): 분포 60/60/30 · Small 20% · long-trend NaN 0 · **11-leader tripwire 5/11**(SK하이닉스·삼성전자·두산에너빌리티·에코프로비엠·HD현대일렉트릭 — 기존 73차 1/11 → B++ 5/11, 소형주 독식 소멸 실증). ⚠️ pykrx 외국인 fetch 다수 Length-mismatch 에러→fail-soft penalty(foreign 약화, trend/실적/퀄리티만으로 5/11; step-2 전 foreign 점검). 11-leader=tripwire(합격 아님).
2. ✅ **recall+IC 하버스트 실행 완료(step-2, 77차 후속 — 본 세션)**: `validate_tier0_ic.py` main() 활성화 → 실 19개월 PIT run(2024-06~2025-12), KRX panel 2023-03~2026-06(PIT, survivorship clean, delisted_fraction 0.0037). Gate A(pooled recall, fixed denominator, leader tripwire-only, largemid) + Gate B(scoped monthly composite IC + Large/Mid sleeve IC + cost-adj spread + top-tercile + baseline IR) + Gate C entry. baseline 3종(current+equal binding / ic_weighted no-lookahead diagnostic) wiring. DART = cache-only + **availability fail-closed**(rcept_dt 부재 → fail-closed, omxy R1; 현 캐시 rcept_dt 無 → DART 100% fail-closed → **순수 trend+size harvest**), foreign OFF(feasibility, penalty-tier neutralized). 코드 = 본 PR(MERGED). 비용 0.
3. ✅ **omxy 적대 재검토 → CONVERGED**(본 세션): omxy R1(native code-review lanes + Superpowers, 26m) = 3 harness fix 직접 수정(DART availability fail-closed + Gate C per-month + leader basket size) + omxy 적대 verdict(thesis "validated" overstated). Claude 적대 R2 = omxy quarterly availability gate가 live-screen에 누설(cache 무효화)되는 **Finding-1(HIGH) catch+fix**(cache_only 스코프) + 양보(framing) + decision 채택. omxy R2 **SIGNAL: CONVERGED**(harness 정확 incl Finding-1, verdict FAIL, decision D/E). 207 python tests pass.
4. **[2026-06-19 SUPERSEDED/완료]** 기존 "풀팩터 재검증(USER-gated)" 대안은 실제로 실행되어 **full-factor 4-config×3-regime = NO-CONFIG-PASSES**로 닫힘. 추가 DART/foreign/panel 확장은 출시 critical path가 아니라 별도 연구 백로그이며, B++ production funnel 적용의 선행 게이트가 아님.
5. **[2026-06-19 SUPERSEDED — 상단 UPDATE 참조]** 이 "삼중 게이트 ALL PASS 시에만 --apply" 가드는 캠페인 완결(tradable + combination) 후 **USER 운영 funnel 승인(approval_basis=USER_PRODUCTION_FUNNEL_DIAGNOSTIC)** 근거로 완화 — B++ funnel 적용 허용(예측 게이트 미통과 출력 명시·"상승 예측" claim 금지 유지). 실행 = HANDOFF ★ G1(--apply 150)→STOP→G2(Tier1 ~₩25k 별도). 본 줄의 "verdict FAIL → --apply 금지"는 역사.
6. ✅ Claude 적대 재검토(Finding-1) + 연결포인트 검증(live screen intact, --apply hard-block, tudal 0 touch) + docs-sync(본 세션).

## 6. 현 상태 — step-2 harvest + 후속 캠페인까지 완료, **예측 게이트 FAIL / B++ diagnostic funnel 적용 결정**, cross-model CONVERGED
- ✅ **harvest harness MERGED(본 PR)** — Claude Phase1(impl + 4-lens review + PIT-001 fix) → omxy R1(3 fix) → Claude R2(Finding-1 fix) → omxy **CONVERGED**. 207 python tests pass. 코드만(production runtime 변화 0, --apply hard-block 유지, tudal 0 touch).
- 📊 **VERDICT (19mo 2024-06~2025-12, 순수 trend+size, cost 0, `scripts/out/tier0_ic_report.json`)**:
  - **Gate A FAIL**: overall recall 0.108(<0.20) · random_ratio 1.66(<2.5) · per-horizon ~0.04(<0.12) · **largemid_recall 0.431** · **leaders 138/209 ≈ 7/11/mo (73차 1/11)** · **B++ 0.108 > baseline_equal 0.107 → 복잡도 정당화(baseline 우위)**.
  - **Gate B ADJUDICATE**: ic_ir 0.260(<0.30) · **large-sleeve IC +0.08** · mid −0.007 · **B++ IR 0.26 >> baseline −0.05**.
  - **Gate C PASS**: 60/60/30 · small 20% · 19개월 전부 통과.
  - **TRIPLE GATE ALL PASS: False.**
- 🧭 **해석(Claude↔omxy 합의)**: B++는 (a) 대형 주도주 retrieval **개선 실증**(largemid 0.431, leaders 7/11, large-IC +0.08) + (b) naive baseline을 recall·IC 모두 **상회(복잡도 정당화)** 하지만, (c) earnings/foreign 부재(순수 trend+size) + 절대 임계(recall 0.20·IC IR 0.30) 미달로 **full 예측 thesis 미검증**. ⇒ 산출물 표현 = **"robust, factor-informed, leader-inclusive candidate shortlist(diagnostic)"**까지만(spec §3 문구 게이트). **"향후 상승 예측" claim 금지.**
- 📈 **selection_performance metric (PR #123, omxy R6~R8 CONVERGED)**: 픽의 실현수익률 진단(size-neutral skill = vs 실제 선정 sleeve, net-after-cost, 월별 skill CI). **핵심 교정**: 처음 "시장 +6.8%p 초과"는 **대부분 size 베타** — size 제거 순수 스킬 = 1M −0.25%/3M +1.17%/6M +3.01%, **세 기간 CI 모두 0 포함 → 통계적 유의 스킬 없음**. "market-beating"은 regime/size 틸트지 selection skill 아님.
- 🔬 **Stage-1 외국인 A/B (PR #123, omxy S1-R1~R3 CONVERGED, foreign full-coverage)**: per-(market,월) 전종목 1콜(get_market_net_purchases…, ~38콜) + schema-기반 fail 분류(pykrx가 오류를 bare-empty df로 삼킴 → penalty). **결과: OFF(추세+크기) vs ON(+외국인)** — leaders 138→**148/209**(외국인 매수 대형주 집중 → +10), 단 largemid 0.431→0.419·IC IR 0.26→0.206·6M skill +3.01%→+0.25%·6M net +22.6%→+19.9% **전부 악화**. 둘 다 skill CI 0 포함. ⇒ **외국인 추가 순효과 ≈ 중립~약간 마이너스; 추세+크기가 더 낫고 단순**(spec의 "외국인=약한 secondary" 정합). 외국인은 cross-section 랭킹에 노이즈.
- **[2026-06-24 APPLIED]** ~~--apply/Tier1 보류 — 삼중 게이트 ALL PASS 후만~~ → USER 운영 funnel 승인으로 §5 step5 guard가 `approval_basis=USER_PRODUCTION_FUNNEL_DIAGNOSTIC` + cfg1 lock(trend+size, foreign/DART OFF) 기준으로 완화됨. production `tier0_candidates_150`/`short_list_30` 2026-06 = **G1/G2 적용됨(2026-06-24)**. 단 B++는 retrieval 개선 diagnostic funnel이며 **NO-CONFIG-PASSES/상승 예측 claim 금지**는 유지.
- **[2026-06-19 SUPERSEDED]** 옛 다음(USER-gated) = Stage-2 DART / Stage-3 패널 확장 / diagnostic 유지(no apply) 선택. 이후 full-factor + tradable + combination 캠페인까지 완료되어 **USER 결정은 B++ diagnostic production funnel 적용**으로 확정(HANDOFF ★ G1→STOP→G2). DART/foreign/panel 확장은 별도 연구 백로그로만 남고, 적용 선행조건이 아님.
- 환경: `scripts/.venv`(pykrx/supabase/requests), .env.local. panel 디스크 캐시 `scripts/out/pit_cache`(~1700 콜, warm). harvest run = panel(cache warm 시 ~1-2min) + DART in-mem preload + 19개월 처리 ~수분.

## 7. 토론 산출물 (근거 보존)
- **1차(B+)**: quant-research 스킬 + Claude 퀀트 + omxy → "B+ + 경량 IC" CONVERGED.
- **2차(실증 후 B+ REJECT → B++)**: production 150 대형주 10/11 누락 실증을 재투입. **Claude 퀀트 에이전트**(독립 설계: 근본원인=시그널 구성·trend 부재 / size sleeve>residual / recall vs IC category trap / AI 2차 구제 불가) + **omxy**(트레이딩/퀀트 sub-agent + 한국 모멘텀 KCI 문헌: 중기 모멘텀 핵심·2025 장기 reversal 경고 → trend OOS 검증 필수) **독립 수렴 → B++**. main(Opus) 종합·판정: 11-leader는 tripwire로 강등(target leakage 방지), IC scope+escalate 채택.
- **핵심 합의**: B++ = size-sleeve recall-first + 모멘텀 재설계(risk-adj trend+52w-high) + 수기가중치 폐기 + recall/IC/size 삼중. AI 2차는 Tier0 누락 구제 불가 = recall은 Tier0 책임.

## 8. 오버피팅·미지수 (정직)
- 신규 knob(쿼터 20/20/10·플로어·lookback·IC임계) = 새 자유도 → **train-lock-OOS + 민감도 report**. 수기가중치 전철 금지.
- **target leakage 금지**: 특정 종목(삼성전자) 진입을 합격 기준화·튜닝 타깃화 금지 — 합격은 aggregate PIT/OOS recall.
- 표본 thin: 12-24M는 독립 대형-상승 episode가 적음 → leader-recall 분산 큼, 단일 월 recall은 noisy(CI/다월 보고).
- volume_surge: 경제 근거 최약 → Gate B IC 음수면 제거 1순위.
- **survivorship**: step 0 probe PASS(KRX bydd_trd = PIT universe). 잔여 = harvest 실행 시 probe 아티팩트 재확인 + mid-horizon 상폐/halt forward-return(gap/delisted/insufficient 구분) PIT 라벨 유지.
- 현 스코어링 = **예측력 검증 0건**. B++ = step-2 trend+size harvest 1회(earnings/foreign 부재) → naive baseline 상회 + 대형 retrieval 개선 실증하나 **full 예측 thesis 미검증(triple-gate FAIL)** — 통과 전 어떤 "예측" claim도 근거 없음.
