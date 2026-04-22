# S8 자동매매 프레임 — 주식(KIS) + 코인(바이낸스 선물)

```
---
slice_id: S8
slice_name: 자동매매 프레임 (주식 KIS + 바이낸스 USDT-M 선물 + Strategy drop-in + AI 어댑터 embed)
architect_id: S8 (신규, 2026-04-21 D16 승격 — 구 Deferred-X 흡수 + Deferred-Y 어댑터 위치 예정)
status: ⚪ 대기
expected_sessions: 4 (스캐폴드 2 + 실 체결 전환 2)
current_progress: 0%
---
```

Last updated: 2026-04-21 (초기 생성 — D16 박제)
선행 문서: `BusinessPlan.md §10.8` · `ServicePlan-Admin.md §1A.0 + §3.13` · `HANDOFF.md §6` · `../../Archive/AutoTrading.md`(리서치 원자료 · D11 이전) · `../../Archive/AutoTrading-AI구조설계.md`(AI 구조 초안 · D11 이전)

---

## 목표 (Why)

어드민(본인 + 친구 3명)이 AI 가상 포트(레이어 A, §1A.0)를 **실제 자금**으로 옮겨 담는 집행 서브시스템(§1A.0 경로 2)을 주픽 안에서 쓰기 위함. 현재는 승인(Accept) 결과를 보고 외부 증권사/거래소 앱에서 수동 매매하거나(경로 3 바이패스) 매뉴얼 주문(경로 1)만 가능. S8에서:

- **주식**: KIS OpenAPI로 모의투자→실계좌 자동 주문
- **코인**: 바이낸스 USDT-M 선물 테스트넷→메인넷 자동 주문
- **대상 종목**: Short List 30 / 자유 종목 / 바이낸스 선물 종목 선택 가능
- **의사결정**: Strategy 파일 drop-in + AI 어댑터 embed 이중 경로 (AI agent·skill 본체는 어드민이 추후 drop-in)
- **가드레일**: Policy Engine (레버리지 ≤ 5x · 일일 -3% 정지 · AI 일 주문 ≤ 20회)

S8은 "어드민 내부 도구 완성" 4조건 중 3번째(Mock → 실데이터 → **자동매매** → 운용 검증).

---

## 포함 요구사항

- **Must**: (S8은 Must 19 밖 집행 레이어 — 어드민 내부 도구 완성의 독립 축)
- **엔티티 (기존 RW)**: E1 ShortList30 (R) · E4 PortfolioApproval (R) · E5 PortfolioSnapshot (R) · E9 BrokerageConnection (RW, 기존 주식용)
- **엔티티 (신규)**:
  - ~~**E12 ExchangeConnection**~~ — **DQ-7 0009에서 선행 생성** (`../DQ7-Credentials.md` §4.2). S8에서는 RW 참조만, 신규 마이그레이션 대상 아님.
  - **E13 OrderQueue** — 자동 주문 대기열(pending/submitted/filled/rejected/cancelled)
  - **E14 TradeExecution** — 체결 이력(가격·수량·수수료·펀딩비·슬리피지)
  - **E15 RiskPolicy** — 가드레일 설정값(admin_id 스코프 + 전역)
  - **E16 RiskViolationEvent** — Policy Engine 거부 이벤트(주문 drop 로그)
  - **E17 StrategyRegistration** — Strategy 파일 메타(path·symbol·asset·enabled·last_decision_at)
- **라우트 (6)**:
  - `/admin/settings/brokerage` (주식 KIS 키 관리, 기존 D12 구조 재사용)
  - `/admin/settings/binance` (바이낸스 선물 키 관리, E12)
  - `/admin/settings/risk` (Policy Engine 가드레일, E15)
  - `/admin/settings/strategy` (Strategy 등록 목록, E17 + AI 어댑터 상태)
  - `/admin/trading/stock` (주식 주문 폼 + 큐 + 체결·포지션·PnL)
  - `/admin/trading/crypto` (바이낸스 선물 주문 폼 + 레버리지/SL/TP + 청산가 + 펀딩)

---

## 선행 조건

- 슬라이스: **S7a 완료** (Anthropic wrapper — AI 어댑터 embed 연결용) + **S7e 완료** (Supabase 실 I/O — 주문 큐·체결 이력 실 INSERT 필수). 즉 S7a·S7e 후에만 S8 스캐폴드 병행 착수 가능.
- DQ 해소: **DQ-9** (KIS API 조달 범위) · **DQ-10** (바이낸스 IP/KYC/테스트넷) · **DQ-11** (리스크 기본값 확정) — HANDOFF §3
- BL-KRIT: **BL-KRIT-2** (KIS 키) · **BL-KRIT-8** (마이그레이션 0010+ 신규 5 엔티티) · **BL-KRIT-9** (바이낸스 키)
- 이벤트: `portfolio.approved` (E4 `is_final=true`) 수신 파이프가 실동작 (S7e) — 자동 주문 트리거용

---

## 외부 의존

| 의존 대상 | 용도 | 슬라이스 내 처리 |
|---|---|---|
| **KIS OpenAPI REST** | 주식 주문·시세·잔고 | 스캐폴드 단계 mock · 실 체결 단계 연결 |
| **KIS WebSocket** | 주식 실시간 시세(체결가 피드백용) | S7c와 공유 |
| **python-kis 래퍼 (또는 직접 REST)** | OAuth·주문·재연결 | Node에서 직접 REST 호출이 기본. python-kis는 참고용 |
| **Binance USDT-M Futures REST** | 코인 주문·포지션·청산 | 스캐폴드 mock · 실 체결 단계 연결 |
| **Binance Futures WebSocket** | 선물 시세·펀딩비·포지션 스트림 | 실 체결 단계 |
| **Vault / Supabase Vault 대안** | API 키 평문 금지 저장 | BL-10 솔루션 선택 (Supabase Vault 기본, 외부 KMS 옵션) |
| **Anthropic SDK** | AI 어댑터 embed 기본 경로 (S7a wrapper 재사용) | 어댑터 인터페이스만 S8에서, 본체 구현은 어드민 drop-in |

---

## Tasks (체크리스트)

> 킥오프 세션에서 세분화 확정. 아래는 초기 설계.

### Phase S8-Scaffold (세션 1~2, S7a·S7e 후 병행)

- [ ] **T8.1** 마이그레이션 **0011** (E13~E17 신규 5 테이블 + RLS + CHECK + 인덱스) — E12 ExchangeConnection은 DQ-7 0009에서 선행 생성됨 (2026-04-22 cleanup)
- [ ] **T8.2** `tudal/.env.example` 작성 (KIS·바이낸스·ANTHROPIC 키 슬롯 + `KIS_MOCK_MODE` · `BINANCE_TESTNET` 플래그)
- [ ] **T8.3** `src/lib/trading/` 디렉토리 구조 생성
  - `src/lib/trading/types.ts` (OrderPlan · TradingStrategy · StrategyContext · RiskPolicy 공통 타입)
  - `src/lib/trading/policy-engine.ts` (가드레일 적용 함수 · RiskViolationEvent 발생)
  - `src/lib/trading/strategies/{stock,crypto}/index.ts` (drop-in 레지스트리)
  - `src/lib/trading/strategies/stock/sample-momentum.ts` (샘플 전략 1)
  - `src/lib/trading/strategies/crypto/sample-breakout.ts` (샘플 전략 1)
  - `src/lib/trading/ai/decide-order.ts` (어댑터 인터페이스 + 빈 훅 — `throw new Error('ai-not-embedded')` 기본)
  - `src/lib/trading/broker/kis.ts` (KIS REST mock client)
  - `src/lib/trading/broker/binance.ts` (Binance USDT-M mock client)
  - `src/lib/trading/queue/order-queue.ts` (OrderQueue CRUD + FSM)
- [ ] **T8.4** 라우트 4개 스캐폴드 (server components + mock fixtures) — *~~brokerage·binance 2개는 DQ-7에서 선행 이관 (2026-04-22)~~*
  - ~~`/admin/settings/brokerage`~~ **→ DQ-7 완료, T8.4에서 "테스트 연결" 버튼 핸들러만 연결**
  - ~~`/admin/settings/binance`~~ **→ DQ-7 완료, 동일**
  - `/admin/settings/risk` (레버리지·일일 손실·AI 일 주문 cap 입력 UI · 기본값 prefilled)
  - `/admin/settings/strategy` (등록된 Strategy 파일 목록 · 활성 토글 · AI 어댑터 embed 상태 "not-embedded"/"embedded")
  - `/admin/trading/stock` (수동 주문 폼 + 자동 주문 큐 테이블 + 포지션 · mock 체결)
  - `/admin/trading/crypto` (선물 주문 폼: SYMBOL·side·수량·레버리지·SL·TP + mock 체결 · 청산가 계산 · 펀딩비 mock)
- [ ] **T8.5** 권한 가드 — 모의↔실 토글 API에 **대표 1인 이메일 allowlist 체크** (서버 액션 레벨). 친구 2명은 모의까지. *DQ-7에서 `ADMIN_REP_EMAIL` env + 크레덴셜 저장 경로에 이미 구현된 패턴 재사용.*
- [ ] **T8.6** Vitest — policy-engine · order-queue FSM · risk violation · sample strategy 로직 테스트 (~15 cases 추가)
- [ ] **T8.7** Sidebar nav 확장 + layout chrome 업데이트 (Trading 그룹)
- [ ] **T8.8** Supabase RLS — 5 신규 테이블 admin-only + admin_id scope RLS 정책
- [ ] **T8.9** mock 주문 → Short List Accept 훅 연결 (E4 `is_final=true` → 자동 주문 큐 생성, mock 체결)

### Phase S8-Live (세션 3~4, S7 전체 완료 후)

- [ ] **T8.10** KIS REST 실 연결 — OAuth 토큰 관리 + 모의투자 계좌 실 주문 실동작
- [ ] **T8.11** KIS 실계좌 전환 — 대표 1인 토글 + 이중 확인(타이핑 확인 모달) + 최초 1회 $100 이하 소액 검증 주문
- [ ] **T8.12** 바이낸스 USDT-M 테스트넷 실 연결 — API 키 저장(Vault) + 시세/포지션 조회 + 지정가/시장가 주문 실동작
- [ ] **T8.13** 바이낸스 메인넷 전환 — 대표 1인 토글 + 이중 확인 + 최초 1회 USDT 100 이하 검증 주문
- [ ] **T8.14** WebSocket 시세 피드 연결 (주식 KIS WS + 바이낸스 Futures WS) — 포지션/PnL 실시간 갱신
- [ ] **T8.15** 펀딩비 스케줄러 — 바이낸스 펀딩 타임스탬프(8시간 주기) 따라 포지션별 누적 펀딩 적재
- [ ] **T8.16** Policy Engine 실 동작 — 실 주문 직전 가드레일 체크 + 위반 시 RiskViolationEvent INSERT + 대시보드 알림
- [ ] **T8.17** AI 어댑터 드라이 런 — Anthropic SDK wrapper로 `decideOrder(state) → OrderPlan` 1회 호출 테스트 (본체 없는 상태에선 예외 기본)
- [ ] **T8.18** DoD 검증 + HANDOFF 갱신

---

## DoD (Definition of Done)

### Phase S8-Scaffold DoD
- [ ] 6개 라우트 렌더 + `npm run build` 통과 (28 routes)
- [ ] `npm run lint` 0
- [ ] `npm run test:ci` 신규 15+ 케이스 pass
- [ ] 마이그레이션 0010 Supabase에 실 적용 + RLS 테스트
- [ ] 샘플 전략 2건(주식 1 + 코인 1)으로 mock 주문 플로우 end-to-end 동작
- [ ] AI 어댑터 인터페이스 정의 + 빈 훅 + "not-embedded" 상태 `/admin/settings/strategy`에서 표시
- [ ] Policy Engine 기본값(5x / -3% / 20회) 적용 + 초과 시 주문 drop + RiskViolationEvent 기록
- [ ] 모의↔실 토글 대표 1인 권한 가드 (allowlist 체크) 동작
- [ ] `.env.example` 전 키 슬롯 문서화

### Phase S8-Live DoD
- [ ] KIS 모의투자 계좌로 주식 실 주문 1건 체결 확인 (PnL 정상 갱신)
- [ ] 바이낸스 테스트넷에서 BTCUSDT 선물 포지션 open → close 1사이클 완결 (청산가·펀딩 로그 적재)
- [ ] WebSocket 재연결·핸드셰이크 실패 처리 코드 경로 확인
- [ ] 실계좌/메인넷 전환 토글 최초 작동 + 소액 검증 주문 체결
- [ ] Anthropic wrapper에서 AI 어댑터 호출 경로 1회 성공 (mock agent drop-in 기준)
- [ ] `npm run build` + `npm run lint` + `npm run test:ci` 모두 통과

### 공통
- [ ] 커밋 `feat(S8): ...` prefix
- [ ] `ProgressDashboard.md` S8 status ✅ + `HANDOFF.md` 다음 슬라이스 포인터 갱신
- [ ] `CodebaseStatus.md` 라우트/엔티티 수 갱신

---

## 블로커 / 사용자 결정 필요

- **DQ-9** (HANDOFF): KIS API 조달 범위 — (a) 친구 각자 계정 / (b) 본인만 / (c) 모의만 시작
- **DQ-10** (HANDOFF): 바이낸스 선물 한국 IP·KYC 조건 점검
- **DQ-11** (HANDOFF): 리스크 가드레일 기본값 (현재 추천: ≤5x · -3% · 20회)
- **BL-KRIT-2** / **BL-KRIT-8** / **BL-KRIT-9** (ProgressDashboard §5)
- **BL-10** (구 Deferred-X): Vault/Secrets 솔루션 — Supabase Vault vs 외부 KMS. **기본: Supabase Vault**. 한도 확인 필요.

---

## 리스크

- **R-S8-1** 실계좌/메인넷 키 유출 → 실 자금 손실
  - 완화: Vault 평문 금지 + RLS 본인 scope 격리(D12) + 대표 1인만 실 전환 + 타이핑 확인 모달 + 전환 로그 감사 테이블
- **R-S8-2** AI 어댑터가 폭주 주문(무한 루프·잘못된 plan)
  - 완화: Policy Engine 일 주문 cap ≤ 20 + 레버리지 cap 5x + 손실 -3% 자동 정지 · 시간당 cap 추가 고려 · `requires_confirmation` 플래그 기본 true
- **R-S8-3** 네트워크 단절/WS 끊김 → 포지션 관리 불능
  - 완화: 재연결 backoff + 최후 수단으로 "모든 포지션 close" 버튼(`/admin/trading/*` 킬스위치) · 텔레그램 긴급 알림 공유
- **R-S8-4** 바이낸스 펀딩비·청산 위험 (코인 선물 특유)
  - 완화: 청산가 실시간 표시 + SL 필수 입력 + 8시간 펀딩 스냅샷 · 메인넷 전환 전 테스트넷 1주 이상 검증
- **R-S8-5** Strategy drop-in 파일이 악성 동작 (무한 루프·외부 호출)
  - 완화: 순수 함수 계약 강제 (`TradingStrategy`) · 실행 시간 타임아웃 (500ms) · 네트워크 호출은 어댑터에서만 허용 · TypeScript strict로 타입 경계 고정
- **R-S8-6** Q16 법무 유예 vs 자동매매 실 주문
  - 완화: 어드민 3명 내부 도구 한정 — 외부 멤버 노출 없음 · 친구 2명 자금은 각자 계정으로 분리 · 자동매매 결과는 가상 포트(레이어 A)가 아니라 본인 계좌 기준이므로 투자자문업 경계 재검토 Deferred-D 시로 유예

---

## 의사결정 로그

- 2026-04-21: 슬라이스 생성 (D16 박제). Deferred-X 승격 + Deferred-Y 흡수. 사용자 답변 D-T1 b·c (모의+실) · D-T2 c (AI 자율+Strategy 이중) · D-T3 (Short List/자유/바이낸스 선물 선택 가능).
- 2026-04-21: 리스크 가드레일 기본값 (≤5x / -3% / ≤20회) — Claude 판단 보수값 박제. 사용자 추후 `/admin/settings/risk`에서 조정.
- 2026-04-21: 모의↔실 토글 권한 = 대표 1인. 친구 2명은 모의까지만. (Q2 답변 — 친구 추가는 나중)

---

## 이슈·발견

- 킥오프 시 KIS OpenAPI Node 직접 사용 vs python-kis 래퍼 병행 여부 결정 (현 편향: Node 직접 REST)
- 바이낸스 Node SDK `@binance/connector` vs 직접 REST/WS 결정 (편향: 직접 REST/WS + 가벼운 클라이언트)
- Strategy 폴더 auto-discovery 구현 (fs.readdir) vs 명시적 registry export 선택

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-21 | 초기 생성. D16 박제(BusinessPlan §12 2026-04-21 · ServicePlan-Admin §1A.5 D16). Deferred-X 승격 + Deferred-Y 흡수 경로 확정. 주식 KIS + 코인 바이낸스 USDT-M 선물 2축 범위 + Strategy drop-in + AI 어댑터 embed 이중 경로 박제. 리스크 기본값 보수(5x / -3% / 20회) 박제. |
| 2026-04-22 | 문서 정합 cleanup (28차): DQ-7 Session 2 완료 후속. T8.1 마이그 번호 **0010→0011** 정정 (DQ-7=0009 · BL-KRIT-7=0010 선점 정합). §엔티티 신규 **E12 항목을 "DQ-7 선행 생성" 주석으로 축소** (S8 신규는 E13~E17만). **선행 문서 경로** AutoTrading·AutoTrading-AI구조설계 → Archive/ 이관 반영. 구조·Tasks·DoD·리스크는 변경 없음 (로드맵 재조정은 Step 2로 유예). |
