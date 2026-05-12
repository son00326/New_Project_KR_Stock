# T7e.8 follow-up — Tier 0 DART Signal 4·5 실 구현 설계

- **Date**: 2026-05-12 (43차)
- **Scope**: `scripts/screen_shortlist_tier0.py`의 Signal 4 (실적 모멘텀) + Signal 5 (재무 퀄리티) 실 산출
- **Driver**: HANDOFF.md §2.A "스코프 제외 — DART OpenAPI 실 재무 산출은 T7e.8 follow-up"
- **Status**: spec — review gate 대기

---

## 1. 배경과 문제

42차 T7e.8에서 Tier 0 인디케이터 스크리닝(`screen_shortlist_tier0.py`)을 박제하고 43차에서 production DB에 시드 1회 적용했다. 5-Signal 가중치는 박제됐지만 Signal 4 (`earnings`)와 Signal 5 (`quality`)는 **hook only**(0 처리)였다.

이 평탄화의 영향:
- **Long bucket**: quality 비중 60% → 점수의 60%가 0 → 사실상 40%(가격 시그널)로만 줄세움 → 진짜 우량주 위로 못 옴
- **Mid bucket**: earnings 비중 30% → 30%가 0 → 실적 턴어라운드 신호 잡지 못함
- **Short bucket**: 영향 미미 (earnings+quality 합쳐서 10% 가중치)

결과: 43차 시드의 long bucket 상위 9종목이 composite 55.4~55.9 안에 모두 몰림(0.16 spread). 진짜 우량주 신호가 아니라 잔여 가격 시그널의 노이즈일 가능성 높음.

DART OpenAPI 키를 발급받았고(43차) probe 통과(삼성전자 2024 연결재무제표 정상 fetch). 따라서 본 spec은 두 신호의 실 구현 + 캐싱 인프라를 정의한다.

---

## 2. 결정 사항 (확정)

| # | 항목 | 결정 | 근거 |
|---|---|---|---|
| D1 | corp_code mapping 위치 | Supabase 마이그 0013 `dart_corp_codes` | UI 재사용 + production SoT 일관성 |
| D2 | Signal 4 (실적 모멘텀) 공식 | YoY 매출 + YoY 영업이익 평균 (단독 분기값 기반) | 계절성 제거 + 매출·이익 동시 검증으로 함정 회사 회피 |
| D3 | Signal 5 (퀄리티) 지표 | 5개 표준: ROE · 부채비율(역방향) · 영업이익률 · 매출성장률 · 이자보상배율 | 일반적 재무 퀄리티 정의, follow-up에서 ROIC/FCF v2 가능 |
| D4 | 재무 캐싱 위치 | Supabase 마이그 0014 `dart_financial_cache` | 투자 판단 근거 데이터 보존 + 어드민 리포트 재사용 |
| D5 | RLS 정책 | `service_role` write + authenticated `is_admin()` read | 내부 어드민 도구, anon 노출 불필요 |
| D6 | 재무제표 기준 | **연결(CFS) 우선, 없으면 별도(OFS) fallback** | 자회사 실적 누락 방지, 정확한 기업가치 반영 |
| D7 | 분기 누적값 환산 | **단독 분기값으로 환산해서 YoY** (불가하면 cumulative YoY fallback + status 표시) | DART 분기보고서는 H1/9M 누적값이라 단독 분기 계산이 진짜 모멘텀 |
| D8 | Cache 상태 추적 | `status` (ok/no_data/parse_error/rate_limited) + `error_code` + `source_report_code` + `statement_scope` 컬럼 | 점수 0이 "데이터 누락"인지 "진짜 저품질"인지 구분 |
| D9 | 테스트 방식 | **Python unittest 중심** (`scripts/test_screen_shortlist_tier0.py`) | 변경 코어가 Python 스크립트. TS data layer 변경 없음 → Vitest 신규 0 |
| D10 | 2026-05 재시드 | C 구현 후 dry-run → 사용자 검수 → `--apply` | 첫 DART 적용은 후보 교체이므로 한 단계 검수 |
| D11 | Universe DART 호출 전략 | **풀 universe 풀 호출** (사전 필터링 없음). 첫 시드 후 캐시. | 첫 시드 ~11,500 calls ≈ 20분, 일 한도 20K 내. 사전 필터링은 후보 누락 위험 + 코드 복잡도. 1회 비용 수용. |
| D12 | Signal 4 계산 기반 추적 | 0014에 `calculation_basis` 컬럼 추가 (`standalone` / `cumulative_fallback` / `annual` / `not_applicable`). follow-up으로 미루지 않음. | standalone 계산 실패 → cumulative fallback 사용 사실을 row 레벨로 박제. 어드민 리포트/AI 평가가 Signal 4 신뢰도를 구분 가능. |
| D13 | `dart_corp_codes.market` 매핑 | DART `corp_cls` 필드 사용 — `Y`→KOSPI, `K`→KOSDAQ, `N`→KONEX. `E` + stock_code 부재 비상장 법인은 seed에서 제외. | OpenDART 공식 매핑(`engopendart.fss.or.kr/guide/detail.do?apiGrpCd=DE001&apiId=AE00004`). 비상장 법인은 KRX universe에 없으므로 제외 안전. |

---

## 3. Architecture

```
[1회 셋업]
  마이그 0013 dart_corp_codes              (ticker ↔ corp_code 마스터)
  마이그 0014 dart_financial_cache         (corp_code × period → 8필드 + 상태)
  scripts/seed_dart_corp_codes.py          ~6,000 상장사 1회 박제

[매월 시드 — 기존 스크립트 확장]
  scripts/screen_shortlist_tier0.py
    └─ fetch_dart_signals() 본체 (현재 hook only)
        ├─ ticker → corp_code (Supabase lookup, miss → 0 + log)
        ├─ Signal 5 quality:
        │     annual CFS 캐시 LOOKUP → miss → DART 11011 CFS → INSERT
        │     CFS 없으면 OFS fallback (statement_scope='OFS')
        ├─ Signal 4 earnings YoY:
        │     target Q + prior YoY Q 단독값 계산
        │     필요한 누적 보고서 캐시 LOOKUP → miss → DART → INSERT
        │     standalone = cumulative_current - cumulative_prior_period
        └─ universe-wide z-score → bucket weights → composite
```

---

## 4. 스키마

### 4.1 마이그 0013 — `dart_corp_codes`

```sql
CREATE TABLE dart_corp_codes (
  ticker text PRIMARY KEY,                       -- KRX 종목코드 (예: '005930')
  corp_code text NOT NULL UNIQUE,                -- DART 회사고유번호 (예: '00126380')
  corp_name text NOT NULL,
  market text NOT NULL CHECK (market IN ('KOSPI', 'KOSDAQ', 'KONEX')),
                                                 -- D13: DART corp_cls (Y/K/N) → KOSPI/KOSDAQ/KONEX 매핑.
                                                 -- corp_cls='E' (기타) + stock_code 부재인 비상장 법인은 seed 단계에서 제외.
  last_synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dart_corp_codes_corp_code ON dart_corp_codes(corp_code);

-- RLS
ALTER TABLE dart_corp_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role write" ON dart_corp_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read" ON dart_corp_codes
  FOR SELECT TO authenticated USING (is_admin());
```

### 4.2 마이그 0014 — `dart_financial_cache`

```sql
CREATE TABLE dart_financial_cache (
  id bigserial PRIMARY KEY,
  corp_code text NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('annual', 'quarterly')),
  period_key text NOT NULL,
    -- 'YYYY' (annual, 11011)
    -- 'YYYY-Q1' (1분기보고서, 11013) — Q1 standalone (cumulative = standalone)
    -- 'YYYY-H1' (반기보고서, 11012) — 6M cumulative
    -- 'YYYY-9M' (3분기보고서, 11014) — 9M cumulative

  -- 재무 8필드 (단위: 원, NULL 허용 — DART에서 미제공 가능)
  revenue numeric,                  -- 매출액
  op_income numeric,                -- 영업이익
  net_income numeric,               -- 당기순이익
  total_assets numeric,             -- 자산총계
  total_equity numeric,             -- 자본총계
  total_debt numeric,               -- 부채총계
  interest_expense numeric,         -- 이자비용

  -- 상태 추적 (D8) — **DART fetch/parse 자체의 상태만** 표현.
  -- Signal 5의 "지표 누락" 같은 계산 실패는 cache status로 표현하지 않는다 (D12 참고).
  statement_scope text NOT NULL CHECK (statement_scope IN ('CFS', 'OFS', 'NONE')),
                                    -- CFS=연결, OFS=별도, NONE=조회 불가
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'no_data', 'parse_error', 'rate_limited')),
                                    -- ok = DART fetch + JSON parse 성공 (이후 지표 누락은 ok 유지)
                                    -- no_data = DART status='013' 또는 CFS/OFS 모두 부재
                                    -- parse_error = 응답 포맷 예외
                                    -- rate_limited = DART 429
  error_code text,                  -- DART status code (예: '013', '020')
  source_report_code text,          -- 11011/11012/11013/11014

  -- 계산 기반 추적 (D12) — Signal 4 standalone 환산 여부 등 다운스트림 계산 메타
  calculation_basis text NOT NULL DEFAULT 'not_applicable' CHECK (
    calculation_basis IN ('standalone', 'cumulative_fallback', 'annual', 'not_applicable')
  ),
    -- annual              = 사업보고서 (11011), Signal 5 quality 소스
    -- standalone          = 분기 단독값 (raw 11013 또는 누적 차분 결과). Signal 4 정상 경로.
    -- cumulative_fallback = 단독 환산 불가 → 누적 YoY로 fallback 사용. 신뢰도 ↓ 추적용.
    -- not_applicable      = raw 누적 보고서 row (11012/11014 등) 그 자체 — Signal 4 계산 전

  fetched_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (corp_code, period_type, period_key)
);

CREATE INDEX idx_dart_fc_lookup ON dart_financial_cache (corp_code, period_type, period_key);

-- RLS (D5와 동일)
ALTER TABLE dart_financial_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role write" ON dart_financial_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read" ON dart_financial_cache
  FOR SELECT TO authenticated USING (is_admin());
```

> `is_admin()`는 기존 helper(`src/lib/supabase/policies.sql`에 정의)를 재사용.

---

## 5. Signal 산식 (확정)

### 5.1 Signal 5 — Quality (annual report 1건 + 직전년 비교용 1건)

**대상 회계연도 결정 로직**: seed 실행 시점 기준 직전 캘린더 연도가 1차 대상 (예: 2026-05 시드 → 2025 annual). 한국 상장사는 사업보고서를 다음 해 3월 말까지 공시 의무. 만약 1차 대상 fetch에서 DART status='013'(미공시)이면 한 해 뒤로 fallback (`year - 1`). 매출성장률 계산용은 항상 (대상 - 1)년.

예시 (seed=2026-05-01):
- 1차 시도: `period_key='2025'` annual + `period_key='2024'` annual
- fallback: `period_key='2024'` annual + `period_key='2023'` annual (+ cache row에 status='no_data' for 2025 annual)

아래 표의 `rev_X` / `rev_Y`는 각각 "대상 연도"와 "그 직전 연도"의 값을 의미한다.

| 지표 | 공식 | 방향 |
|---|---|---|
| ROE | `net_income / total_equity` | 클수록 ↑ |
| 부채비율 (역방향) | `-(total_debt / total_equity)` | 작을수록 ↑ (음수 z-score로 반전) |
| 영업이익률 | `op_income / revenue` | 클수록 ↑ |
| 매출성장률 | `(rev_X - rev_Y) / rev_Y` (X=대상, Y=직전 연도) | 클수록 ↑ |
| 이자보상배율 | `op_income / interest_expense` (∞ 처리 시 4지표 평균) | 클수록 ↑ |

**누락 정책**:
- `total_equity ≤ 0` (자본잠식): 해당 지표만 NaN → 4지표 평균 (z-score 산출 시 NaN 무시)
- `interest_expense = 0` (무차입 우량기업): "이자보상배율 ∞" → 그 지표만 빼고 4지표 평균 (작은 양수 페널티 부여 안 함)
- 5지표 중 3개 이상 누락 시: **quality_raw = 0** (Signal 5 계산 실패). **cache row의 `status`는 'ok' 유지** (DART fetch/parse는 성공했음). 대신 시드 실행 로그/CSV summary에 `quality_insufficient_fields` 메타로 ticker 단위 기록 — 점수 0이 "데이터 누락"인지 "진짜 저품질"인지 추적 가능.

5지표 각각 universe-wide z-score → tanh/clip로 0~100 normalize → 동일 가중 평균.

### 5.2 Signal 4 — Earnings Momentum YoY (D7 단독 분기값 환산 필수)

**Target Q 결정**: `target_date`(seed 실행 시점)의 직전 분기 = "현재 시점에서 마지막 공시 분기".
- 1~3월 → 직전년 3Q (9M - H1)
- 4~6월 → 당해 Q1 (단독)
- 7~9월 → 당해 H1 → Q2 standalone (H1 - Q1)
- 10~12월 → 당해 9M → Q3 standalone (9M - H1)

**Standalone 환산표** (cumulative 보고서 차분):

| Target Q | 필요 보고서 | Standalone 계산 |
|---|---|---|
| Q1 | `YYYY-Q1` only | = report value (Q1 자체가 standalone) |
| Q2 | `YYYY-H1` + `YYYY-Q1` | = H1 − Q1 |
| Q3 | `YYYY-9M` + `YYYY-H1` | = 9M − H1 |
| Q4 | `YYYY` + `YYYY-9M` | = annual − 9M |

**YoY 비교**:
```
revenue_yoy = (target_Q_standalone.revenue - prior_year_Q_standalone.revenue)
              / |prior_year_Q_standalone.revenue|
op_yoy      = (target_Q_standalone.op_income - prior_year_Q_standalone.op_income)
              / |prior_year_Q_standalone.op_income|
earnings_raw = (revenue_yoy + op_yoy) / 2
```

**Fallback**: 단독 분기 산출에 필요한 누적 보고서 중 하나라도 누락이면 → cumulative YoY 사용. 이 경우:
- cache row `status`는 `'ok'` 유지 (DART fetch 자체는 성공)
- 계산 결과 row(아래 §6 데이터 흐름 참고)의 `calculation_basis` = `'cumulative_fallback'`로 INSERT — D12에 따라 신뢰도 추적
- universe-wide z-score 계산에는 정상 참여 (점수 자체는 유효하지만 신뢰도 ↓)
- 다운스트림 어드민 UI가 "이 종목 Signal 4는 fallback 산출"임을 표시 가능

universe-wide z-score → 0~100 → 그대로 `earnings_raw` 슬롯에 주입.

---

## 6. Data Flow

```
[Monthly seed flow]
load env (KRX, SUPABASE, DART)
fetch_universe()  ← pykrx (KRX login)
for ticker in universe:
  price_signals = fetch_price_signals(ticker)      ← pykrx OHLCV (변경 없음)
  foreign       = fetch_foreign_signal(ticker)     ← pykrx (변경 없음, Length mismatch 잔존)
  earnings, quality = fetch_dart_signals(ticker, supabase, dart_key)
                                                    ← NEW: 본 spec
  buffer 5 raw values
universe-wide z-score normalize all 5
apply bucket weights → composite per ticker
top 10 per bucket → dedupe ticker → 30 final
delta vs prev month
[--dry-run] CSV preview
[--apply] UPSERT short_list_30

[fetch_dart_signals 내부]
  corp_code = supabase.select(dart_corp_codes).eq('ticker', ticker).single()
  if not corp_code: return 0.0, 0.0  # 비상장 / DART 미공시

  # Quality (annual X + X-1 for 성장률, X = 직전 캘린더 연도; 미공시 시 X-1로 fallback)
  target_year = determine_target_annual_year(target_date)  # 2026-05 → 2025
  annual_X   = cache_get_or_fetch(corp_code, 'annual', str(target_year),     report_code='11011', prefer='CFS')
  annual_X_1 = cache_get_or_fetch(corp_code, 'annual', str(target_year - 1), report_code='11011', prefer='CFS')
  if annual_X is None or annual_X.status == 'no_data':
      # fallback one year back
      target_year -= 1
      annual_X   = annual_X_1
      annual_X_1 = cache_get_or_fetch(corp_code, 'annual', str(target_year - 1), report_code='11011', prefer='CFS')
  quality = compute_quality_score(annual_X, annual_X_1)

  # Earnings (target Q standalone YoY)
  reports_target_year = determine_required_reports(target_date)  # e.g. [9M, H1] for Q3
  reports_prior_year  = same for year-1
  for rk in reports_target_year + reports_prior_year:
    cache_get_or_fetch(corp_code, 'quarterly', rk, ...)
  target_Q_standalone = compute_standalone(target_year_reports)
  prior_Q_standalone  = compute_standalone(prior_year_reports)
  earnings = compute_yoy_earnings_momentum(target_Q_standalone, prior_Q_standalone)

  return earnings, quality

[cache_get_or_fetch]
  row = supabase.select(...).single()
  if row: return row
  # miss
  try:
    raw = dart_fetch(corp_code, period_key, prefer_scope='CFS')
    if raw.status == '013':  # 조회 결과 없음
      if prefer_scope == 'CFS':
        raw = dart_fetch(corp_code, period_key, prefer_scope='OFS')  # OFS fallback
    parsed = parse_financials(raw)
    # calculation_basis 결정 — raw 보고서 row 기준
    cb = {
      '11011': 'annual',
      '11013': 'standalone',          # Q1 보고서는 Q1 standalone 자체
      '11012': 'not_applicable',      # H1 누적 — 차분 전까지 not_applicable
      '11014': 'not_applicable',      # 9M 누적 — 차분 전까지 not_applicable
    }[source_report_code]
    insert_cache_row(parsed, status='ok' or 'no_data', statement_scope=..., calculation_basis=cb)
    return parsed
  except RateLimit:
    insert_cache_row(status='rate_limited', calculation_basis='not_applicable', ...) ; return None
  except ParseError:
    insert_cache_row(status='parse_error', calculation_basis='not_applicable', ...) ; return None

[compute_standalone_and_persist]  # Signal 4 호출 시 1회 수행
  cumulative_curr = cache_get(..., 'YYYY-9M')   # 9M 누적
  cumulative_prev = cache_get(..., 'YYYY-H1')   # H1 누적
  if cumulative_curr and cumulative_prev:
    q3_standalone = cumulative_curr - cumulative_prev
    upsert_cache_row(period_key='YYYY-Q3', values=q3_standalone, calculation_basis='standalone',
                     statement_scope=cumulative_curr.statement_scope, status='ok',
                     source_report_code='derived')
    return q3_standalone, 'standalone'
  else:
    # fallback — cumulative YoY 그대로 사용. 별도 row 저장 안 함.
    return cumulative_curr, 'cumulative_fallback'   # 호출자가 calculation_basis 기록
```

---

## 7. Error Handling (fail-soft 원칙)

| 케이스 | 처리 |
|---|---|
| ticker가 `dart_corp_codes`에 없음 | Signal 4·5 = 0. 다음 ticker 계속 진행. 로그에 ticker + ratio 기록. |
| DART 429 rate limit | 1초 sleep + 3회 재시도. 그래도 실패 시 cache row `status='rate_limited'` INSERT, Signal = 0. |
| DART status='013' (조회 결과 없음) — CFS | OFS fallback 시도. OFS도 없으면 `statement_scope='NONE'` + `status='no_data'`. |
| DART parse error (예상 외 응답 포맷) | `status='parse_error'` + `error_code` 저장. Signal = 0. |
| `total_equity ≤ 0` (자본잠식) | 해당 지표만 NaN. 다른 지표는 정상 계산. |
| `interest_expense = 0` (무차입) | 이자보상배율 지표만 4지표 평균에서 제외. 무차입 = 페널티 없음 (구조적으로 안전한 회사이므로). |
| Cache write conflict (23505) | 무시. race-safe. |
| 단독 분기 환산용 누적 보고서 누락 | cumulative YoY로 fallback. score 산출은 계속. Signal 4 row의 `calculation_basis='cumulative_fallback'`로 기록 (D12). |
| Signal 5 — 5지표 중 3개 이상 누락 | `quality_raw = 0`. cache `status`는 'ok' 유지 (Fix 1). 로그/CSV summary에 `quality_insufficient_fields` 메타로 ticker 단위 기록. |

---

## 8. Testing (D9 — Python unittest 중심)

기존 `scripts/test_screen_shortlist_tier0.py` 확장. 신규 케이스 ~15개:

**`test_compute_quality_score`**
1. 정상 — 5지표 모두 양호 → 높은 점수
2. 자본잠식 (`total_equity ≤ 0`) → ROE/부채비율 NaN, 3지표 평균
3. 무차입 (`interest_expense = 0`) → 이자보상배율 제외, 4지표 평균
4. 3개 이상 누락 → quality_raw = 0 + 로그/summary에 `quality_insufficient_fields` 기록 (cache status는 'ok' 유지, Fix 1)

**`test_compute_standalone_quarter`**
5. Q1 = Q1 (그대로)
6. Q2 = H1 - Q1 (양수 영업이익)
7. Q3 = 9M - H1
8. Q4 = annual - 9M
9. 누적값 음수 (적자 분기) 처리

**`test_compute_yoy_earnings_momentum`**
10. 정상 — 매출/OP 모두 증가
11. 분모 0 처리 — prior_year revenue/OP = 0
12. 마이너스 → 흑자전환 시그널 (-100 → +30 시 큰 양수)

**`test_dart_signals_integration`**
13. ticker missing in `dart_corp_codes` → (0, 0)
14. cache hit → DART API 호출 없음 (mock으로 검증)
15. cache miss → mock DART → INSERT → next call hit
16. CFS 없음 → OFS fallback → `statement_scope='OFS'` 저장
17. Q3 단독 환산 정상 → cache에 derived row INSERT (`period_key='YYYY-Q3'`, `calculation_basis='standalone'`)
18. Q3 단독 환산 실패 (H1 누락) → cumulative_fallback 경로 → 별도 row 저장 없음 + 호출자가 `cumulative_fallback` 메타로 사용 (Fix 2)
19. Signal 5 3지표 누락 → quality_raw=0 + cache row status='ok' 유지 (DART fetch는 정상) + 로그에 `quality_insufficient_fields` (Fix 1)

**TS 측 Vitest = 추가 0** (admin-shortlist transformer는 마이그 0012로 이미 처리됨, 본 spec에서 TS 변경 없음).

---

## 9. Migration & 실행 순서

| 단계 | 작업 | 검증 |
|---|---|---|
| 1 | 마이그 0013 apply (`dart_corp_codes`) | `\d dart_corp_codes` |
| 2 | `scripts/seed_dart_corp_codes.py` 작성 + 1회 실행 (D13: corp_cls Y/K/N → KOSPI/KOSDAQ/KONEX, E + stock_code 부재 제외) | row count ~6,000 |
| 3 | 마이그 0014 apply (`dart_financial_cache`) | `\d dart_financial_cache` |
| 4 | `screen_shortlist_tier0.py` 확장 + `test_screen_shortlist_tier0.py` 확장 | `python -m unittest` 통과 |
| 5 | dry-run `--month 2026-05-01` + `--csv-backup` | CSV preview · long bucket spread > 0.5 |
| 6 | 사용자 검수 → `--apply` | Supabase 30 row 교체 |
| 7 | `/admin` 홈에서 long bucket 노출 확인 | name + composite 변화 |
| 8 | HANDOFF.md §2.A 갱신 (T7e.8 follow-up 완료) | doc commit |

---

## 10. Scope 제외 (다음 follow-up)

- 어드민 UI에서 재무 표시 (`/admin/report/[ticker]` 등)에서 cache read — 본 spec은 cache write까지만, read UI는 별도 슬라이스
- 매월 새 분기 데이터 자동 신선화 cron — 현재는 시드 실행 시점에 새 분기 발견하면 fetch
- 14섹터 KRX 산업분류 매핑 — 현재 "코스피"/"코스닥" market fallback 유지
- foreign_net 신호 회복 — pykrx `get_market_trading_value_and_volume_on_ticker_by_date` Length mismatch 별도 이슈
- ROIC / FCF yield 등 Damodaran 스타일 v2 지표 — 본 spec은 5지표 표준만
- `fallback_kind` 컬럼 — cumulative YoY fallback 사용 사실을 row-level로 추적하려면 추가 필요 (현재 spec은 로그·status만)

---

## 11. 의사결정 로그 (이 spec에서 박제된 사항)

1. **DART 캐시는 Supabase에 둔다** — "투자 판단의 근거 데이터 보존"이 SoT 일관성보다 결정적 (사용자 의견 인용).
2. **CFS 우선, OFS fallback** — 자회사 실적 누락 방지. statement_scope로 추적.
3. **분기 누적값 환산 필수** — DART 1Q/H1/9M/연간 누적 구조. 단독 분기 차분 없이는 "분기 모멘텀"이 "누적 모멘텀"이 됨.
4. **Cache row에 status/error_code/source_report_code/statement_scope** — 점수 0이 "데이터 누락"인지 "진짜 저품질"인지 구분 가능해야 함.
5. **테스트는 Python unittest** — 변경 코어가 Python. Vitest 신규 0.
6. **RLS는 service_role write + admin read** — 내부 어드민 도구, anon 노출 불필요.
7. **첫 시드는 풀 universe × 풀 DART 호출** — 사전 필터링 없음. 1회 ~20분 비용을 받고 캐시 1회 완성. 후속 월간 시드는 캐시 hit 위주로 빠름.
8. **cache `status` ≠ Signal 계산 실패** — `status`는 DART fetch/parse 자체 상태만. Signal 5 지표 누락 등 다운스트림 계산 실패는 cache row 'ok'를 그대로 두고 로그/CSV summary에 기록.
9. **`calculation_basis` 0014 schema에 포함 (follow-up 미루지 않음)** — Signal 4 standalone vs cumulative_fallback 신뢰도 추적. 어드민 리포트/AI 평가가 row 레벨로 구분 가능.
10. **`dart_corp_codes.market`은 DART corp_cls 공식 매핑** — Y/K/N → KOSPI/KOSDAQ/KONEX. E + stock_code 부재 비상장 법인은 seed 단계 제외.

---

## 12. Open question (구현 시 결정 — 디자인 영향 없음)

- `is_admin()` 정의 위치 확인 — `src/lib/supabase/policies.sql` 또는 기존 마이그(0007 등) 위치 확인 후 RLS 참조. 단순 lookup이라 디자인 영향 없음.
- DART 응답 캐시 TTL 정책 — annual은 영구, 분기는 다음 분기 보고서 나올 때까지. 본 spec에서는 TTL 없이 `period_key`로 immutable 취급. 분기 보고서가 **정정공시**되면 cache miss를 강제 reseed해야 할 수 있음 — 본 follow-up 범위 밖, 별도 이슈로 박제.
