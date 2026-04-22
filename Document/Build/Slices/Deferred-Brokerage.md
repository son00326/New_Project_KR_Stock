# Deferred-X — **S8로 승격됨 (2026-04-21)**

> **이 파일은 포인터만 유지**. 본 슬라이스의 모든 내용·요구사항·Tasks·DoD·블로커는 **`S8-AutoTrading.md`** 로 승격 이관됨.
>
> 편집·참조는 `Document/Build/Slices/S8-AutoTrading.md`로 진행.

---

## 승격 사유 (2026-04-21, D16)

사용자 지시로 "자동매매 UI + 자동매매 기능"을 어드민 내부 도구 현 범위에 포함하기로 결정. 구 Deferred-X "Must 19 밖 이관" 가정은 폐기되고, **S8 단일 슬라이스**로 승격하여 주식(KIS) + 코인(바이낸스 USDT-M 선물) 통합 집행 레이어로 재정의됨.

상세 박제 위치:
- `BusinessPlan.md §12` — 2026-04-21 결정 기록
- `ServicePlan-Admin.md §1A.5 D16` + `§3.13` 신설
- `HANDOFF.md §6·§10` — S8 로드맵 + Deferred-X 승격 표기
- `ProgressDashboard.md §1` — S8 행 추가, Deferred-X 행은 ~~취소선~~
- `Document/Build/Slices/S8-AutoTrading.md` — 승격된 본체

---

## 구 Deferred-X 내용 요약 (이력 보존)

원래 범위: E9 BrokerageConnection 기반 증권사 API 키 저장 + 매뉴얼 트레이딩 UI + 자동매매 UI. Must 19 밖 "Should 로드맵"으로 재활성 조건 4가지(Must 19 완료 + 매뉴얼 UI 필요성 재확인 + BL-10 Vault 선택 + AutoTrading.md 설계 완료)가 박제되어 있었음.

**S8에서의 변화**:
- 매뉴얼 트레이딩 UI는 그대로 S8 `/admin/trading/stock`로 승계
- 자동매매 UI는 S8 `/admin/trading/stock` + `/admin/trading/crypto`로 확장 (코인 포함)
- E9는 유지 (단 **DQ-7(2026-04-22)에서 `api_key_ref` Vault 참조 폐기 → AES-256-GCM 암호화 컬럼 6개로 재정의**)
- E12 ExchangeConnection **DQ-7에서 선행 생성** (Binance USDT-M 선물용)
- E13 OrderQueue + E14 TradeExecution + E15 RiskPolicy + E16 RiskViolationEvent + E17 StrategyRegistration 은 S8 Scaffold 마이그레이션(BL-KRIT-8)에서 추가
- **`/admin/settings/brokerage`·`/admin/settings/binance` UI는 DQ-7(2026-04-22)에서 선행 이관** — S8-Scaffold T8.4는 `/risk`·`/strategy` + `/trading/*` 4 라우트만 담당
- BL-10 Vault는 ~~Supabase Vault~~ → **App-layer AES-256-GCM** 채택 (DQ-7 결정, `Slices/DQ7-Credentials.md §3.1`)
- AutoTrading.md 설계 본체는 여전히 리서치 원자료로 참조 (어댑터 embed 시 어드민 drop-in)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S3 블록 기반. Must 19 밖 이관 이유 명시. |
| **2026-04-21** | **S8로 승격 이관**. 본문은 `S8-AutoTrading.md`로 통합. 이 파일은 포인터만 유지. |
| **2026-04-22** | **DQ-7 승격 세분화 반영**: (a) E9 `api_key_ref` 폐기 → AES-256-GCM 암호화 컬럼 6개, (b) E12 ExchangeConnection은 DQ-7에서 선행 생성, (c) `/admin/settings/{brokerage,binance}` UI도 DQ-7에서 선행 이관, (d) BL-10 Vault 결정이 App-layer AES-256-GCM으로 확정. 상세 SoT = `Slices/DQ7-Credentials.md`. |
