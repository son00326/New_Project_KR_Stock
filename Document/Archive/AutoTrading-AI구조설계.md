# 주픽 자동매매 — AI 구조 설계 & 결정 가이드

> **⚠️ ARCHIVE — D11(2026-04-15) 이전 "자동매매 독립 트랙" 가정 기반 AI 구조 초안.**
> 현 SoT = `../Build/Slices/S8-AutoTrading.md` (2026-04-21 D16 S8 단일 슬라이스 통합 — Strategy drop-in + AI 어댑터 embed 이중 경로로 재정의).
> 본 문서의 SCAN→RESEARCH→PREDICT→RISK→DO 5단계 파이프라인·위원-LLM 옵션·비용 추정은 S8 AI 어댑터 drop-in 시 참조 원자료 가치로 보존. **2026-04-22 Archive 이관 (28차 docs cleanup)**.

---

Last updated: 2026-04-12
Status: 초안 — 다음 세션에서 결정 후 확정
선행 문서: `AutoTrading.md` (리서치 완료)

---

## 0. 이 문서의 목적

`AutoTrading.md`에서 리서치가 끝났다. 이 문서는 **결정을 내리고 설계를 확정**하기 위한 가이드.

```
AutoTrading.md (리서치)  →  이 문서 (설계 결정)  →  ServicePlan/BuildPhase (서비스 반영)
  "뭐가 있고 되는지"          "뭘 쓰고 어떻게"           "언제 만들고 어디에"
```

---

## 1. 결정해야 할 것들

### 1.1 오케스트레이션 엔진

> 투심위 에이전트들을 어떻게 조율할 것인가?

| 옵션 | 장점 | 단점 | 참고 |
|------|------|------|------|
| **LangGraph** | TradingAgents가 이미 검증 (49K stars), 상태 머신, 조건 분기 강력 | Python 전용, 학습 곡선, LangChain 생태계 의존 | TradingAgents 소스코드 |
| **Claude Agent SDK** | Anthropic 공식, 경량, tool_use 네이티브 | 신규 (커뮤니티 작음), 복잡한 상태 관리는 직접 구현 | Anthropic 문서 |
| **직접 구현** (asyncio) | 의존성 0, 완전한 제어 | 상태 머신/재시도/로깅 직접 구현 부담 | — |

**결정 기준**: 투심위는 "데이터 수집 → 토론 → 투표 → 판정"이라는 순차+병렬 혼합 워크플로우.
- 단순하면 Agent SDK로 충분
- 복잡한 분기/반복이 많으면 LangGraph가 유리
- → **프로토타입 하나 만들어보고 결정** 권장

### 1.2 투심위 위원 × LLM 관계

> AI 위원 11명이 각각 어떤 LLM으로 동작하는가?

| 옵션 | 구조 | 일일 LLM 호출 | 월 비용 (추정) |
|------|------|-------------|--------------|
| **A: 위원 = 프롬프트** | 11명 각자 다른 system prompt, 같은 LLM 1회 호출 | ~11회 (deep) | 5~15만 |
| **B: 위원 = LLM 앙상블** | 11명 각자 3개 LLM (Claude+GPT+Gemini) 호출 후 융합 | ~33회 (deep) | 15~40만 |
| **C: 하이브리드** | Core 5명만 앙상블, 나머지 6명은 단일 LLM | ~21회 (deep) | 10~25만 |

**권장**: A로 시작 → Brier Score로 정확도 측정 → 필요 시 C로 전환

### 1.3 AI API 비용 상한

| 옵션 | 일일 상한 | 월 최대 | BusinessPlan §Q7 정합 |
|------|----------|--------|---------------------|
| $50/일 | $50 | ~150만 | ❌ 초과 위험 |
| **$30/일** | $30 | ~90만 | ✅ 운영비 합계 100만 이내 |
| $20/일 | $20 | ~60만 | ✅ 여유 있음, 기능 제약 가능 |

**권장**: $30/일 (월 ~90만 → 서버/DB 합산 100만 이내)

### 1.4 서버 인프라

| 옵션 | 비용 | 장점 | 단점 |
|------|------|------|------|
| **VPS (Vultr/Lightsail)** | 월 2~5만 | 안정적, 24시간 | 비용 |
| **Railway/Fly.io** | 월 3~8만 | 배포 쉬움 | 비용 높음 |
| **자택 Mac Mini** | 전기료만 | 비용 0 | 정전/네트워크 불안, 한투 API IP 고정 필요 |

---

## 2. AI 구조 — 전체 그림

> TradingAgents + Ray Fu 5단계 파이프라인 + tradermonty 스킬 아키텍처를 조합한 구조 후보

> **━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**
> **본 파이프라인은 자동매매 트랙(독립).**
> 리포트 트랙(어드민 메인 서비스 / 투심위 Section 0~8)과 분리 운영.
> 리포트 결과물은 외부 입력으로만 참조하며 재호출하지 않는다.
> **━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**

### 2.1 파이프라인 흐름

```
[SCAN] ──→ [RESEARCH] ──→ [PREDICT] ──→ [RISK] ──→ [DO]

각 단계가 하나의 "스테이지"이고,
각 스테이지 안에 여러 "에이전트"가 병렬/순차로 동작한다.
```

### 2.2 각 스테이지 상세

#### SCAN — 종목 필터링

```
입력: KOSPI/KOSDAQ 전종목 (~2,500개)
처리: QLib 팩터 스코어링 + 유동성/거래량/시총 필터
출력: 후보 종목 50~100개
도구: QLib + pandas-ta (로컬 계산, LLM 불필요)
주기: 매일 장전 08:00
```

#### RESEARCH — 병렬 데이터 수집

```
입력: SCAN에서 나온 후보 종목
처리: 5~9개 에이전트가 병렬로 데이터 수집

  ┌──────────┬──────────┬──────────┬──────────┬──────────┐
  │ Market   │ Funda-   │ News/    │ Macro    │ Supply/  │
  │ Data     │ mentals  │ Disclosure│ Environ │ Demand   │
  │ (한투API)│ (DART)   │ (DART+뉴스)│(ECOS)  │ (한투API)│
  └──────────┴──────────┴──────────┴──────────┴──────────┘
  + Policy Agent (선택) + FX Agent (선택) + Theme Radar (선택)

출력: 종목별 데이터 패키지 (정규화된 SourceItem)
도구: ThreadPoolExecutor + SourceItem 정규화 (last30days 패턴)
LLM: quick_think (Haiku/Flash) — 뉴스 요약, 센티먼트 분류
```

#### PREDICT — 투심위 토론

> TradingAgents의 토론→심판 구조 참고, BusinessPlan §8 투심위 구조 적용
> ※ 투심위 구조(Core 11 + Sector 14×10)·토론 규칙의 단일 출처는 `Document/Service/Report/ReportFramework.md` §5~§7. 본 트랙은 리포트 트랙 투심위와 동일 구조이나 **외부 입력으로만 참조(재호출하지 않음)**.

```
입력: RESEARCH 결과 (종목별 데이터 패키지)

Step 1 — Sector Board (14개 섹터 × 10명)
  해당 섹터 보드가 8-Section 보고서 생성
  Bull/Bear 토론 (configurable rounds)
  → Board Manager가 Judge로 정리

Step 2 — Core Committee (11명)
  Sector Board 보고서를 받아 최종 토론
  각 위원이 BUY/OVERWEIGHT/HOLD/UNDERWEIGHT/SELL 투표
  가중 투표 → 컨센서스 도출
  → Brier Score로 각 위원 예측 정확도 추적

Step 3 — 어드민 Veto
  어드민(사용자 본인)이 최종 승인/거부

출력: 종목별 투자 의견 + 신뢰도 + 보고서
LLM: deep_think (Opus/GPT) — 일 5~10회
```

**TradingAgents와의 차이점**:

| TradingAgents | 주픽 투심위 |
|---------------|-----------|
| ~8-10 역할, 단일 종목 | 14 섹터 × 10명 + Core 11명, 포트폴리오 |
| 단일 Risk 팀 | 3-way debate (Aggressive/Conservative/Neutral) |
| 정성적 리스크만 | 정량 리스크 추가 (VaR/DD/Sharpe, Riskfolio-Lib) |
| 영어 프롬프트 | 한국어 프롬프트 |
| RAM 메모리 (비영속) | SQLite/Supabase 영속 저장 |
| 시뮬레이션 실행 | 한투 API 실제 집행 |

#### RISK — 리스크 평가 + 포지션 사이징

```
입력: PREDICT의 투자 의견 + 현재 포트폴리오

정성적:
  Risk Committee 3-way debate
  Aggressive: "더 담아도 된다"
  Conservative: "줄여야 한다"
  Neutral: 중재
  → Judge가 최종 판정

정량적:
  Riskfolio-Lib: VaR, CVaR, MDD, 섹터집중도
  Position Sizer: Fractional Kelly (×0.25~0.50) + ATR + 2% Rule
  3축 배분: → BusinessPlan §9.1 참조 (단일 출처)
  Quant Board 70% 컨센서스: → BusinessPlan §9.2 참조

안전장치 체크:
  Circuit Breaker: DD > 8%이면 차단
  종목 15% / 섹터 30% 비중 한도
  일 거래한도: 총 자산의 5%

출력: 종목별 포지션 크기 + 주문 목록
도구: Riskfolio-Lib, skfolio (로컬)
```

#### DO — 실행 + 학습

```
입력: 주문 목록

실행 (Mode에 따라):
  Mode 1 (반자동): 대시보드 표시 → 사용자 승인 → python-kis 주문
  Mode 2 (부분자동): EWS 디리스킹만 자동, 나머지 승인
  Mode 3 (완전자동): 자동 주문 → 사후 알림

학습:
  매매 결과 기록 (Trader Memory Core)
  실패 분류: 잘못된 예측 / 타이밍 / 실행 / 외부충격
  Brier Score 업데이트
  quantstats 성과 리포트 자동 생성

도구: python-kis, quantstats, SQLite
```

### 2.3 상시 가동 시스템

파이프라인과 별도로 항상 돌아가는 것들:

```
1. Early Warning System (EWS)
   MA구조 + 모멘텀다이버전스 + 변동성 + 거래량 + RSI
   → 위험 감지 시 자동 디리스킹 트리거
   → Crisis Management: Layer 1(점진적) + Layer 2(반응적)

2. Scheduler
   장전 08:00: 프리마켓 스캔 + 뉴스/공시 체크
   장중 09:00~15:30: 실시간 모니터링 (5분 간격)
   장후 16:00: 일간 투심위 보고서 생성
   주간 금 17:00: 리밸런싱 판단

3. Memory & Learning
   BM25 + 임베딩 하이브리드 유사 상황 검색
   SQLite/Supabase 영속 저장
   Brier Score 캘리브레이션 (위원별 정확도)
```

---

## 3. 한국 스킬 18개 — 파이프라인 매핑

> tradermonty 18개 스킬이 위 파이프라인 어느 단계에 들어가는지

| 파이프라인 | 스킬 | 전환 |
|-----------|------|------|
| **SCAN** | KR Market Scanner, KR CANSLIM Screener, KR Dividend Screener | ✅✅✅ |
| **RESEARCH** | KR Sector Analyst, KR Technical Analyst, KR News Analyst, KR Stock Analysis, KR Market Environment, KR Institutional Tracker | ✅✅✅✅✅✅ |
| **PREDICT** | KR Investment Committee (8-Section), KR Bubble Detector | ✅✅ |
| **RISK** | KR Macro Advisor, KR Options Advisor, KR Risk Evaluator, KR Position Sizer | ✅⚠️✅✅ |
| **DO** | KR Order Executor, KR Portfolio Manager, KR Backtest Runner | ✅⚠️✅ |
| **상시** | KR Economic Calendar, KR Earnings Calendar, KR EWS Monitor, KR Pair Trader | ✅✅✅⚠️ |

> ⚠️ = 부분 제약 (Options: 개별주식옵션 없음, Portfolio: Alpaca 없음, Pair: 공매도 금지). 우회 방안은 AutoTrading.md §3.3 참조.

---

## 4. 검증 로드맵

> 만들기 전에 검증할 것, 만들면서 검증할 것

### Phase 1: 프로토타입 (2주)

- [ ] 오케스트레이션 엔진 PoC: LangGraph vs Agent SDK 각각 간단한 2-에이전트 토론 구현 → 비교 후 결정
- [ ] 한투 API 연결 테스트: python-kis로 모의투자 계좌 시세 조회 + 주문
- [ ] 데이터 파이프라인 PoC: 한투 API + DART + ECOS → 삼성전자 1종목 데이터 수집
- [ ] → **결정**: 오케스트레이션 엔진 확정

### Phase 2: 투심위 MVP (3주)

- [ ] Sector Board 1개 (반도체) 구현: 3명 위원 토론 → 8-Section 보고서 1개
- [ ] Core Committee 3명 축소 버전: 투표 → 컨센서스
- [ ] Brier Score 캘리브레이션 기초 구현
- [ ] → **검증**: AI 투심위 보고서 품질이 사용할 만한 수준인가?

### Phase 3: 백테스트 (3주)

- [ ] Quant Only 백테스트 (v6.1 재현): vectorbt + QLib
- [ ] AI 투심위 시뮬레이션 백테스트: 과거 데이터 투입 (비용 ~100만)
- [ ] Hybrid 백테스트: Quant + AI 결합
- [ ] → **Go/No-Go**: Sharpe > 0.99, MDD < -25.8% 달성하는가?

### Phase 4: 페이퍼 트레이딩 (3개월)

- [ ] 한투 모의투자 계좌로 Mode 1(반자동) 운용
- [ ] AI 판단 vs 사용자 판단 병렬 추적
- [ ] → **Go/No-Go**: Sharpe > 0.7, MDD < -20%

### Phase 5: 서비스 통합

- [ ] Next.js 대시보드 연결
- [ ] 투심위 보고서 열람, 수급 히트맵, EWS 경보
- [ ] → ServicePlan + BuildPhase에 반영

---

## 5. 다음 세션 체크리스트

```
□ §1.1 오케스트레이션 엔진 결정 (LangGraph vs Agent SDK vs 직접)
□ §1.2 위원-LLM 관계 결정 (A vs B vs C)
□ §1.3 AI API 비용 상한 결정 ($30 권장)
□ §1.4 서버 인프라 결정

→ 결정 후: 이 문서 §2를 확정 설계로 전환
→ ServicePlan §0에 자동매매 Task 추가
→ BuildPhase에 구현 Stage 추가
```

---

## 참조 문서

| 문서 | 역할 |
|------|------|
| `AutoTrading.md` | 리서치 결과 (데이터 소스 검증, 스킬 매핑, 실현 가능성) |
| `BusinessPlan.md` §8 | 투심위 구조 확정 (Core 11명, Sector 14×10, 8-Section) |
| `BusinessPlan.md` §9 | 3축 Quant 시스템 확정 (30/40/30, Quant Board 10명) |
| [TradingAgents](https://github.com/TauricResearch/TradingAgents) | 토론→심판 AI 구조 원본 (arXiv:2412.20138) |
| [tradermonty 한국 전환 분석](HTML) | 18개 스킬 한국 매핑 결과 |
