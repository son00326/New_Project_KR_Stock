# Tier0 스코어링 B+ 형태수정 + 경량 IC 검증 — 다음 세션 실행 스펙

> 작성 2026-06-12 (77차 연속). **상태 = 다음 세션 실행 대기 (코드 미구현).** 사용자 결정 = Option 1
> (B+ 구현 + 경량 IC 검증) — Claude 퀀트 에이전트 + omxy 2 독립 토론 CONVERGED.
> 본 문서 하나로 다음 세션이 B+ 구현 → 경량 검증 → Tier0 재screen → apply → Tier1(₩25k)을 실행 가능.

---

## 0. 배경 (왜 이 작업인가)
- 사용자 발견(76차): AI 포트 제안엔 SK하이닉스 있는데 30-리스트엔 없고 삼성전자 부재 → "후보 150을
  간추릴 때 정말 **향후 상승할 기업을 올바르게 예측·선별**하는 스코어링이 맞느냐"가 핵심 질문.
- 77차 재시드 dry-run 검증: DART fix 적용 + b89 통과 + 150 후보 생성됐으나 **삼성전자 여전히 미진입**
  (SK하이닉스 long #40 진입). → HANDOFF "순차적 C" 4단계 "스코어링 튜닝 B 결정" 분기.
- **방법론 토론(quant-research 스킬 + omxy + 독립 Claude 퀀트 에이전트)이 CONVERGED**:
  - 현 Tier0 = **합리적 팩터 컨셉 + 실행 결함 다수 + 예측력 검증 0건**(rank-IC/백테스트 grep 0).
  - "B-only" = BLOCKER (무근거 파라미터를 다른 무근거로 교체). 근본 재설계(IC-가중/neutralization)
    = 과함(데이터·검증 인프라 0에서 과최적화 직행).
  - **"B + validation gate"가 최소 허용 경로** (양쪽 독립 수렴). 사용자 채택 = Option 1(경량 IC).

## 1. 현 Tier0 스코어링 (검증 대상, `scripts/screen_shortlist_tier0.py`)
- universe: KOSPI+KOSDAQ 시총≥300억(~2187), ETF/REIT/SPAC/우선주 제외.
- 5 raw 시그널 → cross-section **z정규화** `z_normalize_to_0_100` = `(z+3)/6×100` clamp 0~100:
  ① momentum=close/MA60 ② volume_surge=MA5/MA60 ③ foreign_net=외국인 순매수 60영업일 **WON 절대합**
  (pykrx; ~2% fail-soft 0) ④ earnings=DART YoY(76차 fix interim thstrm_add_amount) ⑤ quality=DART
  quality composite(5지표 각 z→평균) + volatility(반전). (WEIGHTS 키는 "quality", normalize는 "volatility"
  — 코드 확인 필요한 매핑 혼선 존재.)
- 시간대 가중치(수기): 단 .40/.30/.20/.05/.05 · 중 .20/.15/.15/.30/.20 · 장 .10/.05/.05/.20/.60.
- 단/중/장 각 top50 cross-bucket dedup = 150 (`--emit-candidates` → tier0_candidates_150, AI 메인 path 입력).

## 2. 확정된 실행 결함 (두 독립 비평 합의)
1. **[HIGH·신규] 결측 데이터 = 0 주입 → 분포 오염**: earnings 결측 시 `earnings_raw=0.0`(dart_signals.py:468),
   quality 유효지표<3 시 0.0(:179), DART 키 없으면 전종목 0. 이 0이 cross-section z-pool에 들어가 스코어
   분포 왜곡. **14-agent B가 놓친 최대 구멍.** + quality는 종목마다 다른 부분지표 평균(비교 불가).
   + long bucket(quality 0.60)은 사실상 "공시 있는 종목"만 뽑는 구조적 selection(관측: long 50/50 전부 퀄리티).
2. **[HIGH] z정규화 fat-tail 비강건**: 평균·σ가 fat tail에 오염 → 극단치 1개가 σ 부풀려 나머지를 50점
   근처로 압축, 변별력 상실. volume_surge·foreign_net이 특히 fat-tailed(lognormal).
3. **[HIGH] foreign_net size bias**: WON 절대합 → 대형주 절대 flow 큼 = 사실상 시총 프록시("외국인이
   좋아하나"가 아니라 "큰가"를 측정).
4. **[HIGH] 가중치 미검증**: 0.40/0.30/... 수기, return 예측력 백테스트/IC/attribution 전무 → 무근거 파라미터.
5. **[MED] 시그널 상호 상관 무시**: momentum-volume_surge 강상관 추정(급등주=거래량급증) → 단기 bucket이
   사실상 모멘텀 ~0.70 집중(의도한 분산 아님).
6. **삼성전자 배제 판정**: 부분 의도(momentum tilt가 mega-cap 저모멘텀 배제 = momentum 스크린상 정상)
   + 부분 artifact(z 압축으로 변별이 momentum 작은 차이로 결정). **검증(IC) 없이 정상/버그 구분 불가.**

## 3. B+ 설계 (구현 — 다음 세션) — `scripts/screen_shortlist_tier0.py` + `dart_signals.py`
> 14-agent 감사 B 3종을 토론 합의로 **형태 수정**. **omxy 최종 5-항목(B1~B4) + Claude 퀀트 에이전트 + quant-research 수렴안.**
1. **B1 robust normalization** — **확정 default = winsorize[1%,99%] 후 percentile rank 0~100** (z-only `(z+3)/6×100` 제거).
   percentile rank를 **기본 채택**(robust·outlier 내성·구현 단순). Blom inverse-normal(rank→Φ⁻¹)은 **선택 fallback** — IC 검증(§4)에서 momentum의 cardinal 정보 손실이 IC를 떨어뜨릴 때만 momentum 시그널에 한해 적용(기본 미사용). **volume_surge·foreign_net은 fat-tail이라 percentile rank 전 `signed-log` 변환 선행**(확정 — log 적용으로 winsorize와 중복 압축 방지, rank는 단조라 순위 불변이지만 winsorize 경계 안정화 효과).
2. **결측 처리(B1 내, 최우선)**: 0주입 폐기. **rank 계산에서 결측 제외**(rank는 관측치만으로 산출) + **확정 규칙**: (a) **구조적 결측**(예 DART 미공시·신규상장 데이터 부족) = **neutral 50점 imputation**, (b) **ticker-specific fetch 실패**(API 오류 등 일시적) = **penalty(해당 시그널 하위 10%ile = 5점) + flag 로깅**(명시 제외 아님 — 후보 누락 위험 회피).
   **long bucket(quality 0.60) 결정 = 구조적 결측을 neutral 50으로 처리(공시 없는 종목 배제 안 함)** — "공시 있는 종목만" 구조적 selection을 **의도하지 않음**(대형 우량주가 특정 분기 미공시로 탈락하는 부작용 차단). 이 선택의 영향은 §4 IC에서 검증.
3. **B2 외국인 flow 정규화**: primary = `foreign_net_60d / total_traded_value_60d`(60일 거래대금). secondary
   diagnostic = `/ market_cap` 또는 free-float mcap. (격상 시 외국인 보유비중 Δ%.) KRX bydd API에 거래대금
   존재 가능 — 저비용 추가.
4. **B3 quality 보정**: 장기 quality는 **sector-relative rank**(업종 내 순위) — 금융/보험/제조/바이오를
   동일 ROE·부채비율 공식으로 cross-universe 직접 비교 금지(업종별 재무구조 상이).
5. **상관 진단 출력**: 5 시그널 cross-sectional 상관행렬 로그(momentum-volume 집중 등 가중치 해석 재고용).
6. **가중치는 현행 유지** (검증 전 변경은 또 다른 무근거 — 경량 IC 결과로만 조정).
> **문구 게이트(omxy)**: 검증 통과 전까지 산출물 설명은 **"robust factor-informed candidate shortlist"**까지만
> 허용. **"향후 상승 예측" claim은 §4 검증 통과 후에만.**

## 4. 경량 IC 검증 게이트 (Option 1 — "예측력 1차 확인", 풀 백테스트 인프라 아님)
> 통과 전 fallback "30 직선정"을 "상승 예측"으로 제시 금지. AI 후보풀(150) 용도는 recall 중심이라 기준 완화.
- **확정 검증 윈도우 = 가용 시 24개월, 최소 12개월**(KRX historical fetch로 시그널 월별 스냅샷 재구성; 12M 미만이면 결과를 "표본 부족·suggestive only"로 보고). 월별 리밸런스(매월 말 시그널 → forward 수익). **look-ahead 차단**: 시그널은 t시점 데이터만, 수익률은 t+1/+3/+6M forward. KRX 가격(historical fetch) + DART 공시일(announcement-date PIT, 30일 grace).
- **rank-IC** (Spearman, 시그널별 + composite, forward 1/3/6M): IC mean·IC IR(mean/std)·t-stat.
- **분위 스프레드**: composite 상위10% vs 하위10% forward 수익 차 + 단조성(상위분위→고수익) 확인.
- (가능 시) **regime split**(강세/약세 2분할) IC 부호 유지 + 거래비용(거래세 0.18~0.23%+슬리피지) 차감 후 스프레드 잔존.
- **B4 ensemble 비교(omxy)**: B 적용 전후를 **current manual weights / equal-weight rank ensemble /
  IC-weighted(shrinkage) variant**와 비교 — B+가 실제로 IC/스프레드를 개선하는지(또는 equal-weight가
  더 나은지) 입증.
- **확정 통과 기준 (경량·actionable — 셋 다 충족 시 통과)**: ① composite forward-3M rank-IC mean > 0 **이고** IC IR(mean/std) ≥ 0.3, ② 분위 스프레드 = 상위10% − 하위10% forward 수익이 **양(+)이고 분위 단조**(상위분위→고수익 대체로 증가), ③ B+ composite가 §4 ensemble(current manual / equal-weight rank)의 IC IR을 **하회하지 않음**. **개별 시그널 IC IR < 0**이면 그 시그널은 composite에서 제외 검토. **미통과(셋 중 하나라도 실패) 시 = 사용자 보고 후 가중치/시그널 재고**(임의 조정 금지). **3개 조건은 확정 게이트**(다음 세션 그대로 적용) — 임계 수치(IC IR 0.3)만 검증 결과 분포 확인 후 omxy 적대검토로 한 번 재확인(상향/하향 가능).
- survivorship: 과거를 현재 live universe로 보면 안 됨(상폐·관리종목 포함 PIT universe).

## 5. 다음 세션 실행 순서
1. (코드) B+ §3 구현 — screen_shortlist_tier0.py 정규화/결측/ADV + dart_signals.py 결측. + pytest 회귀.
2. (코드) 경량 IC 검증 하버스트 §4 — 신규 스크립트(예 `scripts/validate_tier0_ic.py`) + venv.
3. **omxy 적대 검토** (B+ 구현 + IC 결과) → CONVERGED.
4. Tier0 **재screen** (B+ 적용 dry-run) — b89 통과 확인(신규 unresolved면 override 추가) + 150 후보 + 대형주 진입 변화 관찰.
5. **--apply** (tier0_candidates_150 갱신) — USER 비용 0(DART 캐시됨).
6. **Tier1 재선정** (P3_FULL_RUN_CONFIRM, 실 AI ~₩25k, USER 비용 승인 — 이미 받음) → production short_list_30 갱신.
7. Claude 적대 재검토 + 결과 검증(production short_list_30 + 대형주 경쟁 + IC 통과 박제) + docs-sync.

## 6. 77차 재시드 현 상태 (다음 세션 진입점)
- ✅ **Step 1 DART quarterly 캐시 5,482행 무효화** + 직전 Tier0 run에서 **fixed 파서로 재populate**(annual 4,700 보존).
- ✅ **Step b89 16 sector override 추가** (`scripts/sector_override.json`, commit `2a66a95`) — Tier0 재screen 시 b89 통과.
- ✅ **Tier0 dry-run 검증**(override 후): b89 통과 + CSV 150(`scripts/out/tier0_candidates_150_2026-06_reseed.csv`)
  + SK하이닉스 long#40 진입, **삼성전자 미진입** + S3 외국인 ~2% fail-soft.
- ⏸ **Tier0 --apply 보류 / Tier1 보류** — B+ + 경량 IC 검증 후 진행(미검증 스코어링에 ₩25k 금지, 양쪽 토론 합의).
- 환경: `scripts/.venv`(pykrx/supabase/requests 설치됨), .env.local(ANTHROPIC/OPENAI/KRX_OPENAPI/DART/KRX_ID/KRX_PW SET,
  `SUPABASE_URL`은 `NEXT_PUBLIC_SUPABASE_URL` 매핑 필요), Tier0 run ~15-50min(2187 외국인 pykrx + DART).

## 7. 토론 산출물 (근거 보존)
- Claude 퀀트 에이전트 비평(Q1~Q5) + omxy 2 sub-agent(MSCI/Alphalens 웹리서치) = 독립 수렴.
- 핵심 합의: B+ 형태수정 + 경량 IC 게이트. 결측 0주입 폐기가 최대 구멍. z→winsorize/rank-Gaussianize.
  외국인 ADV 정규화. 가중치는 검증 후 조정. 삼성전자 배제는 검증 없이 정상/버그 판정 불가.
