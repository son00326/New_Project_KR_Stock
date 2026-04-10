# HANDOFF — 투달(TUDAL) 프로젝트

Last updated: 2026-04-11

---

## 프로젝트 개요

- **서비스명**: 투달 (TUDAL) — "투자의 달인"
- **목표**: 초보~전문가 모두를 위한 AI 기반 국내/해외 주식 분석 플랫폼
- **팀**: 2인 (기획/투자 전문가 + 개발자), 공동창업 5:5
- **현재 단계**: MVP 프레임워크 완성 (mock 데이터 기반)
- **Repository**: `son00326/New_Project_KR_Stock` (Private)
- **코드 위치**: `/Users/kevinoh/Work/Work 1/tudal/`

---

## 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| Framework | Next.js 16 (App Router, Turbopack) | TypeScript |
| UI | TailwindCSS v4 + shadcn/ui | 12개 컴포넌트 |
| 차트 | Recharts | 캔들/라인/영역, 볼린저밴드, 이평선 |
| 아이콘 | Lucide React | |
| Auth/DB | Supabase (SSR) | 코드 준비 완료, 키 미입력 |
| 배포 | Vercel (무료 티어) | 미배포 |
| 패키지 매니저 | npm | Node 24 |

---

## 수익 모델 (확정)

| 등급 | 월간 | 연간 |
|------|------|------|
| Free | 0원 | - |
| Standard | 14,900원 | 119,000원 (33% 할인) |
| Pro | 34,900원 | 299,000원 (33% 할인) |

등급별 기능 제한은 `src/lib/constants.ts`의 `PLANS` 객체에 정의.

---

## 완료된 것

### 페이지 (7개 라우트)

| 경로 | 페이지 | 상태 |
|------|--------|------|
| `/` | 랜딩 (Hero 검색 + 특징 + 매크로 미리보기 + 요금제 + CTA) | 완료 |
| `/login` | 로그인 (이메일 + Google + 카카오) | UI 완료, Supabase 연동 대기 |
| `/signup` | 회원가입 (비밀번호 검증 + 약관 동의) | UI 완료, Supabase 연동 대기 |
| `/pricing` | 요금제 (월간/연간 토글 + 기능 비교표 + FAQ) | 완료 |
| `/macro` | 매크로 현황판 JARVIS (16개 지표 + 종합 판단 + 캘린더) | 완료 (mock) |
| `/stock/[ticker]` | 종목 분석 (차트/Fundamental/Technical/기업정보 4개 탭) | 완료 (mock) |
| 404 | 커스텀 Not Found | 완료 |

### 종목 분석 — 차트 탭

- 차트 타입 선택: **캔들** / **라인** / **영역**
- 기간: 1개월 / 3개월 / 6개월 / 1년
- 보조지표 on/off: MA5, MA20, MA60, MA120, 볼린저밴드(20,2)
- 거래량 차트 (양봉/음봉 색상 구분)
- 기간 수익률 표시
- 호버 툴팁 (시가/고가/저가/종가/거래량/BB)

### 종목 분석 — Fundamental 탭 (9개 섹션)

1. **핵심 지표 한눈에 보기** — 시총, 매출, 영업이익, 직원수, R&D, 글로벌 거점 카드
2. **회사 개요** — 초보/중급 레벨별 설명 + 용어 박스 (반도체가 뭔가요?)
3. **매출 구성 (인터랙티브)** — 파이차트 + 사업부 클릭 시 상세 패널
   - 사업부 정식 명칭, 설명, 시장 포지션, 전망
   - **제품 용어 툴팁**: DRAM/NAND/HBM/파운드리 등 클릭 시 쉬운 설명 + 예시 + 시장 사이클(업/다운) 표시
4. **실적 추이** — **4년/10년 기간 선택** + 매출/영업이익/순이익 바차트 + 영업이익률 곡선 + 인사이트 카드
5. **재무제표 상세** — 손익계산서 / 재무상태표 탭 전환 (항목별 풀 데이터)
6. **사업 히스토리 타임라인** — 1969~현재, 컬러 코딩 (설립/성과/제품/위기/확장)
7. **경쟁 포지셔닝** — SWOT (강점/약점) + 경쟁사 포지션 테이블
8. **미래 전망** — 핵심 투자 포인트 + 기회/리스크 구조화 카드 (중요도 태그)
9. 초보 레벨 전용 해석 박스 ("차트 읽는 법", "한마디 정리" 등)

### 종목 분석 — Technical 탭 (8개 섹션)

1. **매출 구성** — 파이차트
2. **분기별 실적** — 2023 Q1~2024 Q4, 매출/영업이익/순이익 선택 + **YoY%** 표시
3. **연간 실적 추이** — 바차트 + 수익률 곡선
4. **재무제표 상세** — 4개년 테이블 (YoY 변동 포함)
5. **투자 지표 (Valuation)**
   - **Trailing(2024) vs Forward(2025E, 2026E)** PER/PBR/PSR/EV-EBITDA/ROE 비교
   - 각 지표별 "의미" 해석 컬럼
   - PER/PBR 5개년+Forward 라인차트
   - **글로벌 Peer 비교**: 삼성전자 vs Micron/TSMC/Intel/NVIDIA/Qualcomm (Trailing+Forward PER, PBR, EV/EBITDA, ROE, 배당)
6. **애널리스트 TP 컨센서스**
   - 국내 8개 + 해외 6개 = 14개 기관
   - 날짜/기관/애널리스트/TP/변동/의견 테이블
   - 국내/해외 필터
   - 컨센서스 평균 TP, 현재가 대비 상승 여력(%), TP 분포 바
7. **국내 Peer Group** — 테이블 + PER/PBR 바차트
8. **밸류에이션 진단** — 저평가/적정/고평가 판정 + 근거

### 종목 분석 — 기업 정보 탭 (5개 섹션)

1. **주주 구성** — 도넛 차트 + 주주 테이블 (지분율, 주식수) + 외국인 비중 코멘트
2. **지배구조 트리** — 자회사/관계회사/그룹계열사 3단 트리 다이어그램
   - 상장 계열사 **클릭 시 해당 종목 분석 페이지로 이동**
   - 지분율, 사업영역, 시가총액, 상장여부 표시
3. **경영진 + 신용등급** — 임원 5명 + 국내외 신용등급 4개
4. **수주 추이** — 수주/매출 바차트 + 수주잔고/B/B Ratio 복합차트 + 인사이트
5. **배당 이력** — 4개년 DPS/배당수익률/배당성향 차트 + 글로벌 비교 해석

### 매크로 현황판 (JARVIS)

- 종합 투자 판단 스코어(0~100) + 5개 카테고리별 시그널
- 공포·탐욕 게이지 (반원형 바늘 시각화)
- 16개 매크로 지표 (CPI, PPI, 실업률, GDP, 기준금리, 국채, 유가, 금, 환율 등)
- 경제 이벤트 캘린더 (FOMC, 옵션만기일, CPI 발표 등)
- 각 지표별 호재/악재/중립 시그널 + 해석

### 공통

- **검색 엔진**: 자동완성 + 최근검색(localStorage) + 인기종목 + 키보드 네비게이션
- **구독 게이트**: 블러 오버레이 + 잠금 UI (`SubscriptionGate` 컴포넌트)
- **리포트 제한 배너**: Free 유저 잔여 횟수 표시
- **반응형**: 모바일/태블릿/데스크탑 대응
- **Header**: 로고 + 검색 + 매크로현황판 + 요금제 + 로그인 + 모바일 Sheet 메뉴
- **Footer**: 브랜드 + 서비스 + 고객지원 + 법적고지 + 면책조항

---

## 아직 안 한 것 (우선순위순)

### P0 — 다음 작업

- [ ] **Supabase 연동**: 프로젝트 생성 → `.env.local`에 키 입력 → 회원가입/로그인 활성화
- [ ] **실제 데이터 연동**: DART API 키 발급 → mock 데이터를 실제 API 호출로 교체
  - DART 전자공시 (재무제표, 주주현황, 임원, 공시)
  - KRX 시세 데이터 (주가, 거래량, 시가총액)
- [ ] **AI 리포트 생성 파이프라인**: Claude API 연동 → Fundamental 분석 자동 생성
- [ ] **Vercel 배포**: 도메인 연결 (tudal.co.kr 또는 tudal.kr)

### P1 — 핵심 기능

- [ ] My Portfolio (보유 종목 관리, 수익률 대시보드, 평단가 시뮬레이터)
- [ ] 실시간 뉴스 피드 (종목별/섹터별 호재·악재 분류)
- [ ] AI 애널리스트 (월간/분기 리포트 자동 발간, TP 산출)
- [ ] 실시간 TP 조정 (매크로 이벤트 → TP 변동 + 사유 설명)
- [ ] 결제 연동 (Toss Payments 또는 Stripe → 구독 관리)
- [ ] 국내 전 종목 확장 (현재 8개 mock → KOSPI/KOSDAQ 전체)

### P2 — 확장

- [ ] 해외 주식 지원 (미국 NYSE/NASDAQ)
- [ ] Quant 자동 매매 시스템 + 전략 마켓플레이스
- [ ] 커뮤니티 / 소셜 기능
- [ ] 모바일 앱 (React Native 또는 Flutter)
- [ ] 투자자문업 등록 (법무팀)

---

## 프로젝트 구조

```
tudal/
├── middleware.ts                    ← Supabase 인증 미들웨어
├── .env.local                       ← 환경변수 (Supabase URL/Key, DART API Key)
├── src/
│   ├── app/
│   │   ├── layout.tsx               ← 루트 레이아웃 (Header + Footer, 메타데이터)
│   │   ├── page.tsx                 ← 랜딩 페이지
│   │   ├── not-found.tsx            ← 커스텀 404
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx       ← 로그인
│   │   │   └── signup/page.tsx      ← 회원가입
│   │   ├── (main)/
│   │   │   ├── macro/page.tsx       ← 매크로 현황판
│   │   │   ├── pricing/page.tsx     ← 요금제
│   │   │   └── stock/[ticker]/page.tsx ← 종목 분석
│   │   └── api/                     ← API 라우트 (미구현)
│   │       ├── auth/
│   │       └── stocks/
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── report-limit-banner.tsx   ← Free 유저 리포트 제한 배너
│   │   │   └── subscription-gate.tsx     ← 구독 등급별 접근 제어 (블러+잠금)
│   │   ├── layout/
│   │   │   ├── header.tsx           ← 글로벌 Header (검색 + 네비게이션)
│   │   │   └── footer.tsx           ← 글로벌 Footer
│   │   ├── macro/
│   │   │   ├── macro-dashboard.tsx  ← 매크로 현황판 메인
│   │   │   ├── verdict-panel.tsx    ← 종합 투자 판단 (스코어 + 카테고리별 시그널)
│   │   │   ├── indicator-card.tsx   ← 개별 지표 카드
│   │   │   ├── fear-greed-gauge.tsx ← 공포·탐욕 게이지 (SVG 반원)
│   │   │   └── event-calendar.tsx   ← 경제 이벤트 캘린더
│   │   ├── stock/
│   │   │   ├── stock-search.tsx     ← 검색 엔진 (자동완성, 최근검색, 인기종목)
│   │   │   ├── stock-header.tsx     ← 종목 상단 (이름, 가격, 등락률, 시총)
│   │   │   ├── stock-tabs.tsx       ← 탭 컨트롤러 (차트/Fundamental/Technical/기업정보)
│   │   │   ├── fundamental-tab.tsx  ← Fundamental 분석 탭 (9개 섹션)
│   │   │   ├── technical-tab.tsx    ← Technical 분석 탭 (8개 섹션)
│   │   │   ├── corporate-tab.tsx    ← 기업 정보 탭 (5개 섹션)
│   │   │   └── charts/
│   │   │       ├── stock-price-chart.tsx    ← 주가 차트 (캔들/라인/영역, MA, BB)
│   │   │       ├── revenue-breakdown.tsx    ← 매출 구성 (인터랙티브 사업부 상세)
│   │   │       ├── revenue-chart.tsx        ← 매출 구성 파이차트 (심플)
│   │   │       ├── revenue-trend-chart.tsx  ← 연간 실적 추이 (바+라인)
│   │   │       ├── quarterly-financials.tsx ← 분기별 실적 + YoY
│   │   │       ├── financial-table.tsx      ← 연간 재무 테이블
│   │   │       ├── full-financials.tsx      ← 풀 재무제표 (손익계산서/재무상태표)
│   │   │       ├── multiples-history.tsx    ← Trailing/Forward 멀티플 + 글로벌 Peer
│   │   │       ├── multiples-comparison.tsx ← 국내 Peer PER/PBR 바차트
│   │   │       ├── analyst-consensus.tsx    ← 애널리스트 TP 컨센서스
│   │   │       ├── peer-group-table.tsx     ← 국내 Peer 비교 테이블
│   │   │       ├── key-metrics-cards.tsx    ← 핵심 지표 6개 카드
│   │   │       ├── business-timeline.tsx    ← 사업 히스토리 타임라인
│   │   │       ├── competitive-map.tsx      ← SWOT + 경쟁사 포지셔닝
│   │   │       ├── future-outlook-visual.tsx← 미래 전망 (기회/리스크)
│   │   │       ├── product-tooltip.tsx      ← 제품 용어 툴팁 + 시장 사이클
│   │   │       ├── governance-tree.tsx      ← 지배구조 트리 (클릭→종목 이동)
│   │   │       ├── governance-chart.tsx     ← 지배구조 카드 (레거시)
│   │   │       ├── shareholder-chart.tsx    ← 주주 구성 도넛차트
│   │   │       ├── order-backlog-chart.tsx  ← 수주 추이 + B/B Ratio
│   │   │       ├── dividend-chart.tsx       ← 배당 이력 차트
│   │   │       └── executive-info.tsx       ← 경영진 + 신용등급
│   │   └── ui/                      ← shadcn/ui 컴포넌트 (12개)
│   │
│   ├── lib/
│   │   ├── constants.ts             ← 서비스 상수 (PLANS, 포맷 유틸)
│   │   ├── utils.ts                 ← shadcn/ui cn 유틸
│   │   ├── supabase/
│   │   │   ├── client.ts            ← 브라우저 클라이언트
│   │   │   ├── server.ts            ← 서버 클라이언트
│   │   │   └── middleware.ts        ← 세션 관리 미들웨어
│   │   └── data/                    ← Mock 데이터 (실제 API 교체 예정)
│   │       ├── mock-stocks.ts       ← 종목 8개 + 재무/멀티플/검색
│   │       ├── mock-corporate.ts    ← 계열사/주주/수주/배당/임원/신용등급
│   │       ├── mock-financials-extended.ts ← 10개년 재무 + 풀 손익계산서/재무상태표
│   │       ├── mock-quarterly.ts    ← 분기별 실적 + 애널리스트 TP + Forward 멀티플 + 글로벌 Peer + 시장 사이클
│   │       ├── mock-macro.ts        ← 매크로 16개 지표 + 경제 캘린더 + 종합 판단
│   │       └── mock-ohlcv.ts        ← 주가 OHLCV 생성 + MA/BB 계산
│   │
│   └── types/
│       ├── stock.ts                 ← Stock, Financial, Multiples, Peer, Report, User 타입
│       ├── corporate.ts             ← Subsidiary, Shareholder, OrderBacklog, Dividend, Executive, CreditRating 타입
│       └── macro.ts                 ← MacroIndicator, EconomicEvent, MarketVerdict 타입
```

---

## 데이터 현황

| 종목 | Fundamental | Technical | 기업 정보 | 차트 |
|------|------------|-----------|----------|------|
| 삼성전자 (005930) | **풀 데이터** (10개년+분기) | **풀 데이터** (Forward+글로벌Peer+TP) | **풀 데이터** (계열사11개+주주+수주+배당) | **180일** |
| SK하이닉스 (000660) | 기본 (mock) | 멀티플만 | - | - |
| NAVER (035420) | 기본 (mock) | 멀티플만 | - | - |
| 기타 5개 종목 | 기본 (mock) | - | - | - |

→ 실제 데이터 연동 시 `src/lib/data/mock-*.ts` 파일들을 API 호출로 교체하면 됨.

---

## 실행 방법

```bash
cd /Users/kevinoh/Work/Work\ 1/tudal
npm install
npm run dev        # http://localhost:3000
npm run build      # 프로덕션 빌드
```

## 환경 변수 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
DART_API_KEY=your-dart-api-key
```

---

## 다음 세션에서 할 일

### 즉시 착수 가능

| 순서 | 할 일 | 파일 | 비고 |
|------|-------|------|------|
| 1 | Supabase 프로젝트 생성 + 키 입력 | `.env.local` | supabase.com에서 무료 생성 |
| 2 | DB 스키마 생성 (users, portfolios, subscriptions) | Supabase Dashboard | SQL 실행 |
| 3 | 회원가입/로그인 실제 연동 | `login/page.tsx`, `signup/page.tsx` | TODO 주석 위치 참고 |
| 4 | DART API 연동 (재무제표) | `src/lib/data/` → API 라우트 | API 키 필요 |
| 5 | 전 종목 확장 (mock → API) | `mock-stocks.ts` 교체 | KRX 데이터 |
| 6 | Vercel 배포 | `vercel deploy` | 도메인 연결 |

### 기능 확장 로드맵

| 기능 | 의존성 | 난이도 |
|------|--------|--------|
| My Portfolio | Supabase Auth + DB | ★★★ |
| 실시간 뉴스 | 뉴스 API (네이버/구글) | ★★ |
| AI 리포트 자동 생성 | Claude API | ★★★★ |
| 결제 연동 | Toss Payments | ★★★ |
| 실시간 주가 | WebSocket + KRX | ★★★ |

---

## 주요 의사결정 기록

| 날짜 | 결정 사항 |
|------|----------|
| 2026-04-10 | 서비스명 "투달", 공동창업 5:5 |
| 2026-04-10 | Phase 1 국내 → 중장기 해외 확장 |
| 2026-04-10 | 구독 3단계 (Free/Standard 14,900/Pro 34,900) |
| 2026-04-10 | 초기 예산 월 30만원 내외 (Claude/GPT 구독 별도) |
| 2026-04-10 | Git repo: `New_Project_KR_Stock` (추후 TUDAL로 변경) |
| 2026-04-11 | 기술 스택: Next.js 16 + Supabase + Recharts |
| 2026-04-11 | 차트 타입 선택 (캔들/라인/영역) 추가 |
| 2026-04-11 | Trailing/Forward 멀티플 구분, 해외 Peer 포함 |
| 2026-04-11 | 제품 용어 툴팁 + 시장 사이클 표시 추가 |

---

## 법률 참고 (반드시 확인)

- **투자자문업 등록**: TP 제공, 매수/매도 판단 보조 시 금융위 등록 필요 (자본금 2.5억+)
- **면책 조항**: 모든 분석 페이지 하단에 "투자 판단의 최종 책임은 이용자 본인" 문구 삽입 완료
- **개인정보보호법**: 포트폴리오 데이터 암호화 저장 필요
- **저작권**: 증권사 리포트 원문 인용 불가, 요약/분석만 가능
- 초기 단계에서는 "정보 제공" 범위로 운영, 투자자문업 등록 후 TP 기능 활성화 권장
