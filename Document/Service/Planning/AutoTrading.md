# 주픽 (JooPick) — 자동 매매 리서치 문서

Last updated: 2026-04-12
Status: 레퍼런스 6종 분석 완료 / 데이터 소스 팩트체크 완료 / 한국 전환 매핑 완료

---

## 0. 문서 목적

BusinessPlan.md §8 "투심위" + §9 "3축 Quant 시스템"을 **어떻게 구현할 수 있는지** 조사하고 검증하는 리서치 문서.

**이 문서는 결정이 아닌 조사 결과**이다. 여기서 충분히 검증된 항목은 별도 설계 문서를 만들어 ServicePlan에 반영한다.

**범위**: 외부 레퍼런스 분석, 데이터 소스 검증, 한국 시장 전환 가능성, 기술 옵션 비교, 실현 가능성 판정

---

## 1. 레퍼런스 분석

> **[기준선 단순화(한국 버전·독립 트랙) 후 필요 항목만 잔류 예정. 현 서술은 리서치 원자료]**
> 본 문서는 자동매매 트랙(리포트 트랙과 독립)의 외부 레퍼런스 조사 기록이다. 기준선이 "어드민 메인 서비스 = 리포트 트랙" 중심으로 단순화됨에 따라, 본 문서의 스킬·도구·데이터 소스는 한국 시장·독립 트랙 관점에서 재검토한 뒤 필요 항목만 잔류시킨다.

> 각 레퍼런스에서 **주픽에 참고할 수 있는 포인트**를 정리. "채택"은 "이런 게 있다"는 뜻이지 "쓰기로 했다"는 뜻이 아님.

### 1.1 claude-trading-skills (tradermonty) ★781

| 항목 | 내용 |
|------|------|
| **정체** | Claude Code/Web용 스킬 40+ 모음 (분석·리서치 전용, 주문 발행 0) |
| **핵심 가치** | 스킬 아키텍처 패턴 (`SKILL.md` + `references/` + `scripts/`) |
| **데이터** | FMP, FINVIZ, Alpaca — **100% 미국 전용**, 한국 데이터 전면 교체 필요 |

**참고 가능 포인트**:

| 패턴 | 난이도 | 비고 |
|------|--------|------|
| 스킬 아키텍처 (`SKILL.md` + progressive loading) | 낮음 | 모듈화 구조 |
| Edge Pipeline 6단계 (candidate→hint→concept→strategy→review→orchestrate) | 중간 | 알파 발굴 파이프라인 |
| Self-Improvement Loop (dual-axis scorer, 90점 미만 자동 개선 PR) | 낮음 | 자기개선 자동화 |
| Backtest Expert 프레임 (시장 무관 검증 방법론) | 낮음 | 검증 방법론 |
| Position Sizer (Fixed Fractional, ATR, Kelly Criterion) | 낮음 | 수학 모델 재사용 |
| Exposure Coach (8개 스킬→통합 노출 상한) | 중간 | 리스크 통합 |
| Trader Memory Core (아이디어→실행→종료 라이프사이클) | 낮음 | 매매 일지 |

**한국 전환 필요 항목** → §3 참조

---

### 1.2 TradingAgents (Tauric Research) ★49,726

| 항목 | 내용 |
|------|------|
| **정체** | LangGraph 기반 멀티 에이전트 투자 의사결정 프레임워크 |
| **핵심 가치** | **BusinessPlan §8 투심위와 구조적으로 가장 유사** |
| **실행 능력** | 시뮬레이션 거래소에서 실행 가능 (실제 브로커 연동 없음) |
| **논문** | arXiv:2412.20138 |

> **팩트체크**: 실제 ~8-10개 역할. Risk Management는 원본에서 단일 팀 (주픽 3-way debate는 확장안).

**참고 가능 포인트**:

| 패턴 | 난이도 | 비고 |
|------|--------|------|
| LangGraph 워크플로우 엔진 | 중간 | 상태 머신 기반 오케스트레이션 |
| 토론→심판 의사결정 (Bull/Bear debate→Judge) | 낮음 | 투심위 핵심 패턴 후보 |
| 데이터 벤더 추상화 (Vendor Router: Primary/Fallback) | 낮음 | 데이터 레이어 패턴 |
| 반성/학습 메모리 (BM25 유사 상황 검색) | 중간 | 매매 학습 |
| 멀티 LLM 지원 (OpenRouter 라우팅) | 낮음 | 비용 최적화 |

**주픽이 추가해야 할 것**: 단일 종목→포트폴리오 통합, 정량 리스크(VaR/DD/Sharpe), 한투 API 실행, 한국어 프롬프트, 영속 저장, 실시간 스트림

**미결정**: LangGraph vs Claude Agent SDK vs 직접 구현 — 아직 비교 안 함

---

### 1.3 last30days-skill (mvanhorn) ★20,795

| 항목 | 내용 |
|------|------|
| **정체** | 멀티 소스 소셜 서치 엔진 (13+ 플랫폼 병렬 수집→RRF 융합→클러스터링) |
| **금융 기능** | 없음 — 범용 소셜 인텔리전스 도구 |

**참고 가능 포인트**: 병렬 소스 수집 (ThreadPoolExecutor + SourceItem 정규화), RRF(K=60) 랭킹 융합, 클러스터링 (교차 소스 중복 제거), Watchlist + Briefing (SQLite FTS5), Webhook 알림

**한국 대체**: 영어 NLP→한국어 LLM 프롬프트, Reddit/HN→네이버 카페/DC주갤/paxnet

---

### 1.4 AI Prediction Market Trading Bot (Ray Fu)

| 항목 | 내용 |
|------|------|
| **정체** | 예측 시장(Polymarket/Kalshi) 자동매매 봇 가이드 |
| **성과** | 90일 312건, Win Rate 68.4%, Sharpe 2.14, Max DD -4.2% |

**참고 가능 포인트**: 5단계 파이프라인 (Scan→Research→Predict→Risk→Compound), LLM 앙상블 투표, Brier Score 캘리브레이션, Circuit Breaker (DD>8% 차단), Kill Switch (STOP 파일), Fractional Kelly (×0.25~0.50), 실패 4분류 (예측/타이밍/실행/외부충격), AI API 비용 일일 상한

---

### 1.5 awesome-systematic-trading ★3,798

200+ 도구 중 주픽에 관련 높은 것:

| Tier | 도구 | Stars | 잠재 용도 |
|------|------|-------|----------|
| **1** | **QLib** (Microsoft) | 40,601 | 팩터 스코어링, 알파 마이닝 |
| **1** | **AI Hedge Fund** (virattt) | 51,880 | 멀티 에이전트 아키텍처 참조 |
| **1** | **Nautilus Trader** | 21,808 | 고성능 실행 엔진 (Adapter 패턴) |
| **1** | **FinRL** (AI4Finance) | 14,727 | 강화학습 전략 |
| **2** | **vectorbt** | 7,151 | 빠른 백테스트 |
| **2** | **Riskfolio-Lib** | 4,049 | 포트폴리오 최적화 (30+ 리스크 측정) |
| **2** | **quantstats** | 6,950 | 성과 분석 HTML tearsheet |
| **2** | **pandas-ta** / **TA-Lib** | ~5K/~8K | 기술지표 산출 |
| **2** | **skfolio** | 1,926 | Walk-forward 포트폴리오 검증 |

> **한국 시장 공백**: awesome-list에 한국 전용 도구 0개. 중국 도구(QUANTAXIS, vnpy)가 가장 가까운 아시아 참조.

---

### 1.6 한국투자증권 open-trading-api (공식) ★1,241

| 항목 | 내용 |
|------|------|
| **정체** | 한투 공식 Open Trading API (REST 130+ 엔드포인트 + WebSocket 20+ 스트림) |
| **커버리지** | 주문, 시세, 호가, 잔고, 수급, 재무, 애널리스트, 기업이벤트, 랭킹, 지수 |
| **MCP 서버** | 공식 제공 → Claude에서 직접 호출 가능 |
| **Paper Trading** | 완전 지원 (⚠️ Rate Limit 10배 느림: 0.5초/콜 vs 실전 0.05초) |
| **래퍼** | python-kis (Soju06, ★261) — 타입 힌트, 자동 재연결 WebSocket |
| **거래소** | KRX + NXT(대체거래소) + SOR(최선 집행) |
| **내장 도구** | Strategy Builder (.kis.yaml) + Backtester (QuantConnect Lean) |

> **핵심 발견**: 한투 API는 단순 주문 API가 아닌 **종합 데이터 플랫폼**. 수급/프로그램/공매도/재무/애널리스트/기업이벤트까지 제공 → 별도 데이터 소스 구축 부담 대폭 감소.

---

## 2. 데이터 소스 검증 결과

> ⚠️ 2026-04 팩트체크 결과. 이 섹션이 데이터 소스의 Single Source of Truth.

### 2.1 소스별 검증

| 소스 | 제공 데이터 | 안정성 | 비용 | 주의사항 |
|------|-----------|--------|------|---------|
| **한투 OpenAPI** | 시세, 호가, 수급, 재무, 공매도, 주문, 랭킹 (130+) | **A (공식)** | 무료 (계좌 필수) | 초당 20건 Rate Limit, Paper Trading 10배 느림 |
| **OpenDART API** | 공시, 재무제표(XBRL), 대량보유, 임원지분 | **A (공식)** | 무료 (키 발급) | 일 ~10,000건 제한, 분기/연간만 |
| **한은 ECOS** | 기준금리, GDP, M2, 환율, 물가 (800+ 계열) | **A (공식)** | 무료 (키 발급) | 주식 시세 없음 |
| **공공데이터포털 KSD** | 배당 권리일정, 유무상증자 일정 | **A (공식)** | 무료 (키 발급) | — |
| **FRED** | 미국 매크로 (금리, CPI 등) | **B (준공식)** | 무료 | 한국 데이터 아님 |
| **pykrx** | OHLCV, 시총, PER/PBR, 투자자별 | **C (스크래퍼)** | 무료 | ⚠️ KRX 2024.12 로그인 필수화, IP 차단 이력 (Issue #31, #170, #244) |
| **FinanceDataReader** | 주가, 지수, 환율, 상장/상폐 | **C (스크래퍼)** | 무료 | ⚠️ 네이버금융 스크래핑 경유, SLA 없음 |
| **네이버 금융** | — | **C (비공식)** | — | ⚠️ 공식 API 없음, URL 구조 변경 빈번, 프로덕션 의존 금지 |

### 2.2 등급 기준

| 등급 | 의미 | 프로덕션 사용 |
|------|------|-------------|
| **A** | 공식 운영 기관 API, SLA 존재 | ✅ Primary로 사용 가능 |
| **B** | 무료, 안정적이나 한국 특화 아님 | ✅ 보조 소스 |
| **C** | 비공식 스크래퍼, 언제든 차단/변경 가능 | ⚠️ 백테스트/분석 보조만, 프로덕션 금지 |

### 2.3 유료 대안 조사

| 소스 | 비용 | 판단 |
|------|------|------|
| FnGuide / WiseFn | B2B 전용, 수백만~수천만/년 | 500명 cap 서비스에 비현실적 |
| KIS정보 | B2B 계약 전용 | 동일 |
| Bloomberg Terminal | 수천만/년 | 동일 |

> **결론**: 현재 무료 A등급 소스 조합(한투 API + DART + ECOS + 공공데이터포털)으로 충분. 유료 소스는 규모 확장 시(Layer 3+) 재검토.

### 2.4 데이터 카테고리별 소스 매핑

```
┌──────────┬────────────┬────────────┬──────────────┐
│ 카테고리  │ Primary    │ Fallback   │ 검증 상태     │
├──────────┼────────────┼────────────┼──────────────┤
│ 주가OHLCV│ 한투 API   │ pykrx(C)   │ ✅            │
│ 실시간시세│ 한투 WS    │ —          │ ✅ 40구독/연결│
│ 호가     │ 한투 WS    │ —          │ ✅            │
│ 재무제표  │ DART API   │ 한투 API   │ ✅ 둘 다 공식 │
│ 공시     │ DART API   │ —          │ ✅            │
│ 뉴스     │ WebSearch  │ —          │ ✅            │
│ 센티먼트  │ WebSearch  │ —          │ ⚠️ 정형 API 없음 │
│ 매크로    │ 한은 ECOS  │ FRED       │ ✅            │
│ 수급     │ 한투 API   │ —          │ ✅            │
│ 프로그램  │ 한투 API   │ —          │ ✅            │
│ 공매도    │ 한투 API   │ —          │ ✅            │
│ 애널리스트│ 한투 API   │ —          │ ✅            │
│ 기업이벤트│ 한투 API   │ DART       │ ✅            │
│ 배당/권리 │ 공공데이터포털│ 한투 API │ ✅            │
│ 기술지표  │ pandas-ta  │ TA-Lib     │ ✅ 로컬 계산  │
│ 주문집행  │ python-kis │ —          │ ✅            │
│ 환율     │ 한은 ECOS  │ FDR(C)     │ ✅            │
└──────────┴────────────┴────────────┴──────────────┘
```

---

## 3. 한국 시장 커스터마이징 리서치

### 3.1 한국 vs 미국 — 시스템에 영향 주는 차이

| 항목 | 미국 | 한국 | 영향 |
|------|------|------|------|
| 거래 시간 | 09:30~16:00 ET | 09:00~15:30 KST | 스케줄러 시간대, 시간외/동시호가 |
| 결제 | T+1 | T+2 (⚠️ T+1 전환 논의 중) | 자금 회전율 |
| 가격제한 | 없음 | ±30% | 서킷브레이커, 상한가/하한가 로직 |
| 거래 비용 | 수수료 0 | 수수료 0.015% + 거래세 0.15~0.18% | 매도 시 총 ~0.2% |
| 공매도 | 자유 | 제한적 (2023.11~ 금지) | 페어트레이딩 숏 레그 대안 필요 |
| 틱 사이즈 | $0.01 | 가격대별 상이 | 주문가격 정규화 |
| 옵션 시장 | 개별주식 옵션 수천 종목 | KOSPI200 옵션 중심 | 옵션 전략 범위 축소 |
| 투자자 수급 | 13F (분기, 45일 지연) | **일별 공개** | 한국이 압도적 유리 |
| 공시 시스템 | SEC EDGAR | DART 전자공시 | OpenDART API 동등 접근 |
| 재무제표 | US GAAP | K-IFRS | 계정 과목명 매핑 필요 |
| 레버리지 | Margin 2:1, 개별주식 옵션 | 신용 2.5배, KOSPI200 선물 | 레버리지 계산 변경 |
| 배당 | 분기배당 일반 | 연 1회(12월) 집중 | 배당 스크리너 시즌성 |
| 환율 | DXY (간접) | 원달러 (직접 영향) | 매크로에 환율 레이어 필수 |
| 대체거래소 | 다수 | NXT (넥스트레이드) | SOR 최선 집행 |

> **팩트체크 필요**: 거래세율(0.18%→0.15% 인하 예정이었음), 결제일(T+2→T+1 전환 논의) — 2026년 현행 확인 필요

### 3.2 한국 시장이 오히려 유리한 점

1. **수급 데이터 일별 공개**: 미국 13F 분기 1회, 45일 지연 vs 한국 매일 종목별 공개
2. **모든 데이터 소스 무료**: 미국은 FMP 유료, FINVIZ Elite $40/월 필요. 한국은 전부 무료
3. **DART 공시 시스템 강력**: 재무제표, 대량보유, 임원 지분, 주요사항 — API 자유 접근

### 3.3 스킬 18개 한국 전환 매핑

> 원본: [tradermonty/claude-trading-skills](https://github.com/tradermonty/claude-trading-skills) 18개 스킬 → 한국 전환 가능성 조사

**결론**: 15개 바로 전환 가능, 3개 부분 제약 (우회 가능), 전환 불가 0개.

#### 시장 분석 & 리서치 (7개)

| 원본 (US) | 한국 버전 | 전환 | 핵심 변경 | 데이터 소스 |
|-----------|----------|------|----------|-----------|
| Sector Analyst | KR Sector Analyst | ✅ | S&P→KRX 업종(WICS), 반도체/2차전지/바이오 | pykrx / KRX |
| Breadth Chart Analyst | KR Breadth Analyst | ⚠️ | 기성 CSV 없음, 등락종목비 직접 계산 | pykrx 전종목 |
| Technical Analyst | KR Technical Analyst | ✅ | ±30% 가격제한, 09:00-15:30, 프로그램매매 | FDR / pykrx |
| Market News Analyst | KR News Analyst | ✅ | WSJ→한경/매경, DART 공시, 정치/정책 | WebSearch + DART |
| US Stock Analysis | KR Stock Analysis | ✅ | FMP→DART+pykrx, K-IFRS PER/PBR/ROE | OpenDART + FDR |
| Market Environment | KR Market Environment | ✅ | S&P→KOSPI, 수급/원달러/프로그램매매 | pykrx + FDR |
| Institutional Flow | KR Institutional Tracker | ✅ | 13F(분기)→일별 공개, **한국이 유리** | 한투 + DART |

#### 경제 & 실적 캘린더 (2개)

| 원본 (US) | 한국 버전 | 전환 | 핵심 변경 | 데이터 소스 |
|-----------|----------|------|----------|-----------|
| Economic Calendar | KR Economic Calendar | ✅ | 한은 금리, 수출입, 고용 + FOMC/CPI | WebSearch + 공공데이터포털 |
| Earnings Calendar | KR Earnings Calendar | ✅ | DART 정기보고서, 1/4/7/10월 집중 | OpenDART + WebSearch |

#### 전략 & 리스크 관리 (5개)

| 원본 (US) | 한국 버전 | 전환 | 핵심 변경 | 데이터 소스 |
|-----------|----------|------|----------|-----------|
| Backtest Expert | KR Backtest Expert | ✅ | 거래세+T+2+±30%+공매도 금지 | pykrx / FDR |
| Druckenmiller Advisor | KR Macro Advisor | ✅ | 원달러, 반도체 사이클, 한은-Fed 금리차 | FDR FRED + WebSearch |
| Bubble Detector | KR Bubble Detector | ✅ | VIX→V-KOSPI200, 신용잔고/예탁금 | KRX + WebSearch |
| Options Strategy | KR Options Advisor | ⚠️ | 개별주식 옵션 없음→KOSPI200+ELW | KRX 파생 + pykrx |
| Portfolio Manager | KR Portfolio Manager | ⚠️ | Alpaca 없음→수동 입력 or 한투 API | 한투 API |

#### 종목 스크리닝 (4개)

| 원본 (US) | 한국 버전 | 전환 | 핵심 변경 | 데이터 소스 |
|-----------|----------|------|----------|-----------|
| CANSLIM Screener | KR CANSLIM | ✅ | C/A→DART, N/S→pykrx, I→투자자별 | DART + pykrx + FDR |
| Value Dividend | KR Dividend Screener | ✅ | 12월 집중, 중간배당 트렌드 | DART + pykrx |
| Dividend Pullback | KR Dividend Pullback | ✅ | FINVIZ→pykrx RSI 직접 계산 | pykrx + DART |
| Pair Trade | KR Pair Trader | ⚠️ | 공매도 금지→인버스ETF/풋옵션/롱-롱 | pykrx + scipy |

#### 부분 제약 3개 우회 방안

| 스킬 | 제약 | 우회 방안 |
|------|------|----------|
| KR Options Advisor | 개별주식 옵션 없음 | KOSPI200 옵션 집중 + 개별주식 선물(30여 종목) + ELW |
| KR Portfolio Manager | Alpaca MCP 없음 | 수동 입력 + 한투 API 시세 / 한투 MCP 서버 공식 제공 |
| KR Pair Trader | 개인 공매도 금지 | 인버스 ETF / KOSPI200 풋 / 롱-롱 페어 (상대가치) |

### 3.4 한국 전용 추가 에이전트 후보

> 미국 원본에 없는, 한국 시장에서 필요한 에이전트 아이디어

| 에이전트 | 역할 | 데이터 소스 | 실현 가능성 |
|---------|------|-----------|-----------|
| 수급 분석 | 외국인/기관/개인 일별, 프로그램, 공매도 | 한투 API 단독 커버 | **확실** |
| 정책/규제 | 금융위/금감원 규제, 세제, 산업 정책 | 정부 보도자료 + WebSearch | **중간** — 정형 API 없음 |
| 환율/무역 | 원달러, 수출입 동향 | 한은 ECOS + 관세청 + FRED | **확실** |
| 테마 레이더 | 거래량 급등, 시총 변동, 배당, IPO | 한투 랭킹 API + 공공데이터포털 | **확실** |

---

## 4. 에이전트·스킬 실현 가능성 평가

> "이것을 만들 수 있는가?" 판정. "만들겠다"는 결정이 아님.

### 4.1 에이전트 실현 가능성

| # | 에이전트 | LLM Tier | 데이터 소스 | 판정 | 근거 |
|---|---------|----------|-----------|------|------|
| A1 | Market Data | quick | 한투 API + pykrx(Fallback) | **확실** | 한투 130+ 엔드포인트 |
| A2 | Fundamentals | quick | DART + 한투 재무 | **확실** | 둘 다 공식 무료 |
| A3 | News/Disclosure | quick | DART + WebSearch | **확실** | DART 무료 |
| A4 | Macro | quick | 한은 ECOS + FRED | **확실** | 둘 다 공식 |
| A5 | Sentiment | quick | WebSearch + DC주갤 | **중간** | 정형 API 없음 |
| A6 | Supply/Demand | quick | 한투 API | **확실** | investor/program/short 기본 제공 |
| A7 | Policy | quick | 보도자료 + WebSearch | **중간** | 정형 API 없음 |
| A8 | FX/Trade | quick | 한은 ECOS + 관세청 | **확실** | 공식 |
| A9 | Theme Radar | quick | 한투 랭킹 + 공공데이터포털 | **확실** | 기본 제공 |
| B1 | Sector Board (×14) | quick→deep | 전체 | **확실** | TradingAgents 검증됨 |
| B2 | Core Committee (×11) | deep | 전체 | **확실** | TradingAgents Judge 패턴 |
| B3 | Risk Committee | deep | 정량+정성 | **확실** | Riskfolio-Lib |
| C1 | Execution | local | python-kis + 한투 MCP | **확실** | 공식 API + 래퍼 |
| C2 | EWS Monitor | local | pandas-ta + 한투 WS | **확실** | 로컬 계산 |
| D1 | Memory/Learning | local+quick | SQLite/Supabase | **확실** | TradingAgents BM25 |

### 4.2 스킬 실현 가능성

| # | 스킬명 | 용도 | 판정 |
|---|--------|------|------|
| S1 | `kr-market-scanner` | 팩터 기반 종목 스크리닝 | **확실** |
| S2 | `kr-sector-analyst` | 섹터별 수급 + 기술적 분석 | **확실** |
| S3 | `kr-fundamental-analyst` | DART 재무 + 밸류에이션 | **확실** |
| S4 | `kr-macro-regime-detector` | 금리/환율/원자재 → 레짐 감지 | **확실** |
| S5 | `kr-sentiment-fusion` | 멀티소스 RRF 융합 | **중간** |
| S6 | `kr-investment-committee` | 투심위 8-Section 보고서 | **확실** |
| S7 | `kr-risk-evaluator` | VaR/CVaR/MDD + 3-way debate | **확실** |
| S8 | `kr-position-sizer` | Kelly/ATR + 3축 배분 | **확실** |
| S9 | `kr-order-executor` | 한투 API 주문 | **확실** |
| S10 | `kr-backtest-runner` | vectorbt + QLib + quantstats | **확실** |
| S11 | `kr-portfolio-optimizer` | Riskfolio-Lib 3축 최적화 | **확실** |
| S12 | `kr-ews-monitor` | Early Warning System | **확실** |
| S13 | `kr-daily-briefing` | 일간 투심위 브리핑 | **확실** |
| S14 | `kr-trade-memory` | 매매 라이프사이클 추적 | **확실** |
| S15 | `kr-skill-improver` | 스킬 자동 품질 평가 + 개선 | **확실** |
| S16 | `kr-edge-pipeline` | 시장 관찰 → 알파 → 전략 검증 | **중간** |
| S17 | `kr-economic-calendar` | 한은 금리/수출입 + FOMC/CPI | **확실** |
| S18 | `kr-earnings-calendar` | DART 정기보고서 + 잠정실적 | **확실** |
| S19 | `kr-canslim-screener` | 성장주 선별 | **확실** |
| S20 | `kr-dividend-screener` | 배당주 + 배당 눌림목 | **확실** |
| S21 | `kr-bubble-detector` | V-KOSPI200 + 신용잔고 과열 | **확실** |
| S22 | `kr-pair-trader` | 동종업종 페어 | **중간** — 공매도 제약 |

---

## 5. 기술 옵션 비교 (미결정)

> 아직 비교/결정하지 않은 기술 선택들. 설계 문서 작성 전 결정 필요.

### 5.1 오케스트레이션 엔진

| 옵션 | 장점 | 단점 | 조사 상태 |
|------|------|------|----------|
| **LangGraph** | TradingAgents가 검증, 상태 머신 | Python 전용, 학습 곡선 | 레퍼런스 코드 확인 완료 |
| **Claude Agent SDK** | Anthropic 공식, 경량 | 신규, 커뮤니티 작음 | 미조사 |
| **직접 구현** (asyncio) | 유연, 의존성 최소 | 유지보수 부담 | — |

### 5.2 투심위 위원 vs LLM 앙상블 관계

| 옵션 | 설명 | 비용 (일) | 정밀도 |
|------|------|----------|--------|
| **A: 위원=LLM 1회** | 11명 → 11회 호출 | 낮음 | 낮음 |
| **B: 위원=멀티LLM** | 11명 × 3모델 = 33회 | 높음 | 높음 |
| → 초기 A, 정확도 측정 후 B 전환 검토가 합리적 | | | |

### 5.3 LLM 라우팅 옵션

```
deep_think (투심위 판단, 최종 결정):
  → Claude Opus (35%) + GPT (20%) + Gemini (20%) — via OpenRouter
  → 일 5~10회

quick_think (데이터 수집, 분류, 보고서 초안):
  → Claude Haiku or Gemini Flash
  → 일 50~100회, temperature=0

local_compute (기술지표, 팩터, 백테스트):
  → Python: QLib + pandas-ta + Riskfolio-Lib + vectorbt
  → 비용: 0
```

### 5.4 안전장치 옵션 (BusinessPlan §7 연동)

| 장치 | 출처 | 파라미터 | 미결정 사항 |
|------|------|---------|-----------|
| Circuit Breaker | Ray Fu | DD > 8% → 차단 | 8% 적정한지 검증 필요 |
| Kill Switch | Ray Fu | STOP 파일 → 전체 중단 | — |
| 일 거래한도 | — | 총 자산의 5% | — |
| 종목 비중 한도 | — | 15% | — |
| 섹터 비중 한도 | — | 30% | — |
| AI API 비용 상한 | Ray Fu | $50/일 | ⚠️ 월 최대 ~150만 → BP §Q7 "100만 이내" 충돌. $30 조정 필요? |
| AI 출력 필터 | BP §7 | "사세요/파세요" 차단 | ⚠️ "매수 관점이 우세" 표현의 법적 적정성 미확인 |

---

## 6. 비용 추정 (참고용)

> 실제 운용 전 추정치. 정확한 수치는 검증 단계에서 확인.

### 월간 운영비 (예상)

| 항목 | 비용 | 비고 |
|------|------|------|
| LLM API (Opus + Haiku + OpenRouter) | 15~35만 | 위원-LLM 관계에 따라 변동 |
| 서버 (VPS or Railway) | 3~5만 | FastAPI |
| Vercel + Supabase | 0~6만 | 기존 계획 |
| 데이터 소스 | 0 | 전부 무료 |
| **합계** | **18~46만** | BP §Q7 "월 100만 이내" 범위 |

### 백테스트 1회 비용 (예상)

| Phase | 비용 |
|-------|------|
| Quant Only | 0 (로컬) |
| AI 투심위 시뮬레이션 | 80~150만 (LLM ~10만 call) |
| Hybrid | 20~50만 |
| **합계** | **100~200만** (1회성) |

---

## 7. 리스크

| 리스크 | 확률 | 영향 | 완화 방안 |
|--------|------|------|----------|
| LLM 환각 (잘못된 분석) | 중 | 높 | Quant 교차검증 + Brier Score + 사용자 Veto |
| API 비용 폭증 | 낮 | 중 | 일일 상한 + Haiku 중심 + 캐싱 |
| 한투 API 장애 | 낮 | 높 | 자동 거래 중단 + Kill Switch |
| pykrx 차단/중단 | 중 | 중 | 한투 API가 Primary, pykrx는 Fallback |
| 데이터 지연/오류 | 중 | 중 | Primary/Fallback 이중화 |
| 과최적화 (백테스트) | 중 | 높 | Walk-forward + CV + 20% 보수적 할인 |
| 규제 변경 | 낮 | 높 | 법적 안전장치 + 반기 법무 리뷰 |
| 블랙스완 | 낮 | 극 | EWS + Crisis Layer + Circuit Breaker + Kill Switch |
| 페이퍼↔실전 괴리 | 중 | 중 | Paper 유동성 제한 인지 + 소규모 실전 검증 |
| WebSocket 40구독 제한 | 중 | 낮 | 다중 연결 or 우선순위 관리 |

---

## 8. 미결정 사항

> 설계 문서 작성 전 결정 필요한 것들

- [ ] 오케스트레이션 엔진: LangGraph vs Claude Agent SDK vs 직접 구현
- [ ] 투심위 위원-LLM 관계: Option A(1:1) vs Option B(1:N) → 비용/정밀도 트레이드오프
- [ ] AI API 일일 상한: $50 vs $30 → BusinessPlan §Q7 정합 필요
- [ ] "매수 관점이 우세" 표현의 법적 적정성 → Stage 2 법무 자문
- [ ] 거래세율 (0.18% vs 0.15%) 및 결제일 (T+2 vs T+1) 2026년 현행 확인
- [ ] 공매도 재개 시점 및 범위 → KR Pair Trader 전략 범위에 직접 영향
- [ ] 서버 인프라: VPS vs Railway vs 자택 Mac Mini
- [ ] 백테스트 v6.1 → v7 전환 범위 및 비용 승인

---

## 9. 다음 단계

이 리서치에서 충분히 검증된 항목들이 확정되면:

1. **별도 설계 문서** 작성 (아키텍처, 파이프라인, 실행 모드, 구현 로드맵)
2. 설계 문서의 서비스 관련 항목을 **ServicePlan에 반영**
3. 구현 계획을 **BuildPhase에 반영**
