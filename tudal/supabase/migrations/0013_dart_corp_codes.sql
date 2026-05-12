-- ============================================================================
-- 0013 — dart_corp_codes
-- ============================================================================
-- Purpose: DART OpenAPI corp_code(회사고유번호) ↔ KRX ticker 매핑 마스터.
-- Driver:  spec 2026-05-12-tier0-dart-signals-design.md (D1, D5, D13).
-- 선행:    0002 (is_admin), 0012 (short_list_30 name/sector).
-- ============================================================================

create table if not exists public.dart_corp_codes (
  ticker          text primary key,                       -- KRX 종목코드 (예: '005930')
  corp_code       text not null unique,                   -- DART 회사고유번호 (예: '00126380')
  corp_name       text not null,
  market          text not null check (market in ('KOSPI', 'KOSDAQ', 'KONEX')),
    -- D13: DART corp_cls (Y/K/N) → KOSPI/KOSDAQ/KONEX. corp_cls='E' + stock_code 부재는 seed에서 제외.
  last_synced_at  timestamptz not null default now()
);

create index if not exists idx_dart_corp_codes_corp_code
  on public.dart_corp_codes(corp_code);

-- D5: RLS — service_role write + authenticated admin read
alter table public.dart_corp_codes enable row level security;

drop policy if exists "dart_corp_codes_service_write" on public.dart_corp_codes;
create policy "dart_corp_codes_service_write"
  on public.dart_corp_codes
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "dart_corp_codes_admin_read" on public.dart_corp_codes;
create policy "dart_corp_codes_admin_read"
  on public.dart_corp_codes
  for select
  to authenticated
  using (public.is_admin());
