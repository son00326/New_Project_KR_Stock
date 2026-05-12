-- ============================================================================
-- 0014 — dart_financial_cache
-- ============================================================================
-- Purpose: DART OpenAPI 재무제표 캐시 + Signal 4·5 산출 메타.
-- Driver:  spec 2026-05-12-tier0-dart-signals-design.md (D4, D5, D6, D8, D12).
-- 선행:    0013 (dart_corp_codes), 0002 (is_admin).
-- ============================================================================

create table if not exists public.dart_financial_cache (
  id                  bigserial primary key,
  corp_code           text not null,
  period_type         text not null check (period_type in ('annual', 'quarterly')),
  period_key          text not null,
    -- 'YYYY' (annual, 11011) / 'YYYY-Q1' (11013) / 'YYYY-H1' (11012) / 'YYYY-9M' (11014)
    -- 'YYYY-QN' = standalone derived row (calculation_basis='standalone')

  -- 재무 7필드 (단위: 원, NULL 허용 — DART 미제공 또는 standalone 차분 결과)
  revenue             numeric,                  -- 매출액
  op_income           numeric,                  -- 영업이익
  net_income          numeric,                  -- 당기순이익
  total_assets        numeric,                  -- 자산총계
  total_equity        numeric,                  -- 자본총계
  total_debt          numeric,                  -- 부채총계
  interest_expense    numeric,                  -- 이자비용

  -- D6, D8, D15: DART fetch/parse 상태
  statement_scope     text not null check (statement_scope in ('CFS', 'OFS', 'NONE')),
    -- CFS=연결재무제표 우선, 없으면 OFS=별도 fallback, NONE=조회 불가
  status              text not null default 'ok' check (status in ('ok', 'no_data', 'not_yet_disclosed', 'parse_error', 'rate_limited')),
    -- 주의: DART fetch/parse 자체 상태만 표현. Signal 5 지표 누락 등 계산 실패는 'ok' 유지 (D8 Fix 1).
    -- not_yet_disclosed = (D15) quarterly + disclosure deadline 이내 미공시. 7일 TTL refresh 허용.
  error_code          text,                     -- DART status code (예: '013', '020')
  source_report_code  text,                     -- '11011'/'11012'/'11013'/'11014'/'derived'

  -- D12: Signal 4 계산 기반 추적 (follow-up 미루지 않음)
  calculation_basis   text not null default 'not_applicable' check (
    calculation_basis in ('standalone', 'cumulative_fallback', 'annual', 'not_applicable')
  ),
    -- annual              = 사업보고서 (11011), Signal 5 quality 소스
    -- standalone          = 분기 단독값 (raw 11013 또는 누적 차분 결과). Signal 4 정상 경로.
    -- cumulative_fallback = 단독 환산 불가, 누적 YoY로 fallback. 신뢰도 ↓ 추적용.
    -- not_applicable      = raw 누적 보고서 row (11012/11014). Signal 4 계산 전 상태.

  fetched_at          timestamptz not null default now(),

  unique (corp_code, period_type, period_key)
);

create index if not exists idx_dart_fc_lookup
  on public.dart_financial_cache(corp_code, period_type, period_key);

-- D5: RLS — service_role write + authenticated admin read
alter table public.dart_financial_cache enable row level security;

drop policy if exists "dart_financial_cache_service_write" on public.dart_financial_cache;
create policy "dart_financial_cache_service_write"
  on public.dart_financial_cache
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "dart_financial_cache_admin_read" on public.dart_financial_cache;
create policy "dart_financial_cache_admin_read"
  on public.dart_financial_cache
  for select
  to authenticated
  using (public.is_admin());
