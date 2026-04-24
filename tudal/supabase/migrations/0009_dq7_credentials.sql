-- =====================================================================
-- 0009_dq7_credentials.sql
-- DQ-7 Admin Credential System (2026-04-22)
--
-- E9 brokerage_connection 재설계:
--   - api_key_ref (Vault 참조) 폐기 → AES-256-GCM 암호화 컬럼 6개로 대체
--   - D16 pivot으로 scope 컬럼 폐기 (manual/auto/both 분기는 S8로 이관)
--   - strategy_label → nullable (선택 라벨)
--   - broker 제한: DQ-7 시점 KIS만
--   - UNIQUE 축소: (admin_id, broker, account_no)
--
-- E12 exchange_connection 신설:
--   - Binance USDT-M 선물 per-admin 키 저장
--
-- RLS: 본인 admin_id + is_admin() 이중 가드
--
-- 마이그레이션 번호 재배정 — BL-KRIT-7 alert_event CHECK 확장은 0010으로.
-- 실 DB 적용은 Session 3(Vercel 배포)에서 수행. 이 파일은 Session 1에 커밋만.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0001_rls_sketch.sql은 실행 금지 sketch였으므로 fresh DB에서는
-- brokerage_connection이 없을 수 있다. DQ-7 마이그레이션을 self-contained로
-- 만들기 위해 기존 E9 shape를 먼저 보장한 뒤 새 암호화 컬럼으로 재설계한다.
-- ---------------------------------------------------------------------
create table if not exists public.brokerage_connection (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  broker text not null,
  account_no varchar not null,
  api_key_ref text not null,
  strategy_label varchar not null,
  scope text not null check (scope in ('manual','auto','both')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.brokerage_connection enable row level security;

-- ---------------------------------------------------------------------
-- Mock Skeleton 단계 — 실 데이터 없음. 기존 row가 있으면 파괴적 재설계를 중단.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.brokerage_connection limit 1) then
    raise exception
      '0009_dq7_credentials abort: brokerage_connection contains rows; migrate existing credentials explicitly before applying this schema change';
  end if;
end$$;

truncate table public.brokerage_connection;

-- 기존 RLS 정책 교체
drop policy if exists "brokerage_connection own rows only"
  on public.brokerage_connection;

-- 기존 UNIQUE 제약 제거 — 0001의 (admin_id, broker, account_no, strategy_label)
-- PostgreSQL 자동 명명이 63자를 넘어 truncate될 수 있어 동적으로 조회 후 드롭.
do $$
declare
  cons_name text;
begin
  for cons_name in
    select conname
    from pg_constraint
    where conrelid = 'public.brokerage_connection'::regclass
      and contype = 'u'
  loop
    execute format(
      'alter table public.brokerage_connection drop constraint if exists %I',
      cons_name
    );
  end loop;
end$$;

-- 컬럼 재설계
alter table public.brokerage_connection
  drop column if exists api_key_ref,
  drop column if exists scope,
  alter column strategy_label drop not null,
  add column app_key_masked text not null,
  add column ciphertext_app_key bytea not null,
  add column iv_app_key bytea not null
    check (octet_length(iv_app_key) = 12),
  add column auth_tag_app_key bytea not null
    check (octet_length(auth_tag_app_key) = 16),
  add column ciphertext_app_secret bytea not null,
  add column iv_app_secret bytea not null
    check (octet_length(iv_app_secret) = 12),
  add column auth_tag_app_secret bytea not null
    check (octet_length(auth_tag_app_secret) = 16),
  add column mock_mode boolean not null default true,
  add constraint brokerage_broker_enum check (broker in ('kis'));

-- 새 인덱스
create unique index if not exists idx_brokerage_admin_broker_account
  on public.brokerage_connection(admin_id, broker, account_no);

create index if not exists idx_brokerage_admin_active
  on public.brokerage_connection(admin_id, is_active)
  where is_active = true;

-- 새 RLS 정책
create policy brokerage_admin_self
  on public.brokerage_connection
  for all
  to authenticated
  using (public.is_admin() and admin_id = auth.uid())
  with check (public.is_admin() and admin_id = auth.uid());

-- ---------------------------------------------------------------------
-- E12 exchange_connection — 코인 거래소 (Binance USDT-M 선물)
-- ---------------------------------------------------------------------
create table if not exists public.exchange_connection (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  exchange text not null
    check (exchange in ('binance_futures')),
  label text not null
    check (char_length(label) between 1 and 40),
  api_key_masked text not null,
  ciphertext_api_key bytea not null,
  iv_api_key bytea not null
    check (octet_length(iv_api_key) = 12),
  auth_tag_api_key bytea not null
    check (octet_length(auth_tag_api_key) = 16),
  ciphertext_api_secret bytea not null,
  iv_api_secret bytea not null
    check (octet_length(iv_api_secret) = 12),
  auth_tag_api_secret bytea not null
    check (octet_length(auth_tag_api_secret) = 16),
  testnet_mode boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index if not exists idx_exchange_admin_label
  on public.exchange_connection(admin_id, exchange, label);

create index if not exists idx_exchange_admin_active
  on public.exchange_connection(admin_id, is_active)
  where is_active = true;

alter table public.exchange_connection enable row level security;

create policy exchange_admin_self
  on public.exchange_connection
  for all
  to authenticated
  using (public.is_admin() and admin_id = auth.uid())
  with check (public.is_admin() and admin_id = auth.uid());

commit;
