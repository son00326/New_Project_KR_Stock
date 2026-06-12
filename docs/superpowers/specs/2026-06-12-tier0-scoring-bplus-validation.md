# Tier0 스코어링 B++ (size-sleeve recall-first) + 삼중 게이트 검증 — 다음 세션 실행 스펙

> 작성 2026-06-12 (77차). **상태 = 다음 세션 실행 대기 (코드 미구현).**
> **⚠️ B+ → B++ amend (2026-06-12 실증 후속):** 처음 합의한 "B+ 형태수정 + 경량 IC"는 **실증 검증 결과 단독 REJECT**.
> production 후보 150에 대형 상승 주도주 11개 중 SK하이닉스만 진입(나머지 전부 누락)이 데이터로 확인됨 →
> 근본원인 = **구조적 retrieval 실패**(지속추세 시그널 부재 + 소형주 구성편향), B+ 정규화로는 못 고침.
> **Claude 퀀트 에이전트 + omxy(트레이딩/퀀트 sub-agent + 한국 모멘텀 문헌 웹리서치) 2 독립 토론 → B++ CONVERGED**
> (main Opus 종합·판정). 사용자 합격 기준 = **recall + rank-IC + size 삼중 엄격 게이트**.
> 본 문서 하나로 다음 세션이 B++ 구현 → 삼중 게이트 검증 → 통과 시에만 재screen/apply/Tier1(₩25k) 실행 가능.

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

## 3. B++ 설계 (구현 — 다음 세션) — `scripts/screen_shortlist_tier0.py` + `dart_signals.py`

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

## 5. 다음 세션 실행 순서
0. **survivorship feasibility 선결**(블로킹): PIT+상폐 universe 확보 가능한가? 불가 시 upper-bound 라벨 결정.
1. **cheap deterministic wins + 재screen**(백테스트 불요): §3B 유동성 플로어 + §3C vol-adj momentum·trend·52w-high + §3A size sleeve 구현 → **Gate C smoke**(소형주 독식 소멸 + 대형 주도주 150 진입 확인). 같은 세션에 대부분 판가름.
2. **recall+IC 하버스트**(`validate_tier0_ic.py`): Gate A(recall, visible-trend split, leader recall) + Gate B(scoped IC) PIT 12-24M + baseline(current/equal/IC-weighted) 비교. + dart_signals announcement-date PIT fix.
3. **파라미터 sweep**(쿼터·플로어·lookback·IC임계): train window calibrate → lock → OOS 확인 + 민감도 report. **11종목 맞추려 튜닝 금지**.
4. **omxy 적대 재검토**(B++ 구현 + 삼중 게이트 결과) → CONVERGED.
5. **삼중 게이트 ALL PASS 시에만**: `--apply`(tier0_candidates_150 갱신, USER 비용 0) → **Tier1 재선정**(P3_FULL_RUN_CONFIRM, 실 AI ~₩25k, USER 승인 받음) → production short_list_30 갱신. **미통과 = --apply/Tier1 비용 금지** + 사용자 보고(150→210/240 확장은 별도 승인).
6. Claude 적대 재검토 + production 검증(short_list_30 + 대형주 진입 + 삼중 게이트 통과 박제) + docs-sync.

## 6. 77차 재시드 현 상태 (다음 세션 진입점)
- ✅ DART quarterly 캐시 무효화 + fixed 파서 재populate(annual 4,700 보존).
- ✅ sector override 16(`scripts/sector_override.json`, commit `2a66a95`) — b89 통과.
- ⚠️ **77차 B+ dry-run 150(`scripts/out/tier0_candidates_150_2026-06_reseed.csv`)은 B++로 supersede** — 구 스코어링 기반이라 폐기 대상(대형주 누락 그대로). production 150도 73차 구 스코어링.
- ⏸ **--apply/Tier1 보류** — B++ 삼중 게이트 통과 후만.
- 환경: `scripts/.venv`(pykrx/supabase/requests), .env.local(ANTHROPIC/OPENAI/KRX_OPENAPI/DART/KRX_ID/KRX_PW SET, `SUPABASE_URL`=`NEXT_PUBLIC_SUPABASE_URL` 매핑), Tier0 run ~15-50min.

## 7. 토론 산출물 (근거 보존)
- **1차(B+)**: quant-research 스킬 + Claude 퀀트 + omxy → "B+ + 경량 IC" CONVERGED.
- **2차(실증 후 B+ REJECT → B++)**: production 150 대형주 10/11 누락 실증을 재투입. **Claude 퀀트 에이전트**(독립 설계: 근본원인=시그널 구성·trend 부재 / size sleeve>residual / recall vs IC category trap / AI 2차 구제 불가) + **omxy**(트레이딩/퀀트 sub-agent + 한국 모멘텀 KCI 문헌: 중기 모멘텀 핵심·2025 장기 reversal 경고 → trend OOS 검증 필수) **독립 수렴 → B++**. main(Opus) 종합·판정: 11-leader는 tripwire로 강등(target leakage 방지), IC scope+escalate 채택.
- **핵심 합의**: B++ = size-sleeve recall-first + 모멘텀 재설계(risk-adj trend+52w-high) + 수기가중치 폐기 + recall/IC/size 삼중. AI 2차는 Tier0 누락 구제 불가 = recall은 Tier0 책임.

## 8. 오버피팅·미지수 (정직)
- 신규 knob(쿼터 20/20/10·플로어·lookback·IC임계) = 새 자유도 → **train-lock-OOS + 민감도 report**. 수기가중치 전철 금지.
- **target leakage 금지**: 특정 종목(삼성전자) 진입을 합격 기준화·튜닝 타깃화 금지 — 합격은 aggregate PIT/OOS recall.
- 표본 thin: 12-24M는 독립 대형-상승 episode가 적음 → leader-recall 분산 큼, 단일 월 recall은 noisy(CI/다월 보고).
- volume_surge: 경제 근거 최약 → Gate B IC 음수면 제거 1순위.
- **survivorship 미해결 = 전체 검증 타당성 최대 위협**(§5 step 0).
- 현 스코어링·B++ 모두 **예측력 검증 0건 상태** — 통과 전 어떤 "예측" claim도 근거 없음.
