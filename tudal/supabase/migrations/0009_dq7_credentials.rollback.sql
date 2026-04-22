-- =====================================================================
-- 0009_dq7_credentials.rollback.sql
-- Supabase CLI는 rollback 직접 지원 안 함 — 필요 시 수동 실행.
-- 적용 전 DB에 실 credential row가 있으면 **복구 불가능** (암호화된 데이터 소실).
-- =====================================================================

begin;

-- E12 exchange_connection 제거
drop policy if exists exchange_admin_self on public.exchange_connection;
drop index if exists idx_exchange_admin_label;
drop index if exists idx_exchange_admin_active;
drop table if exists public.exchange_connection;

-- E9 brokerage_connection 원복
drop policy if exists brokerage_admin_self on public.brokerage_connection;
drop index if exists idx_brokerage_admin_broker_account;
drop index if exists idx_brokerage_admin_active;

truncate table public.brokerage_connection;

alter table public.brokerage_connection
  drop constraint if exists brokerage_broker_enum,
  drop column if exists mock_mode,
  drop column if exists auth_tag_app_secret,
  drop column if exists iv_app_secret,
  drop column if exists ciphertext_app_secret,
  drop column if exists auth_tag_app_key,
  drop column if exists iv_app_key,
  drop column if exists ciphertext_app_key,
  alter column strategy_label set not null,
  add column if not exists scope text not null default 'manual'
    check (scope in ('manual', 'auto', 'both')),
  add column if not exists api_key_ref text not null default '';

-- 원래 UNIQUE 제약 복원
alter table public.brokerage_connection
  add constraint brokerage_connection_uniq
  unique (admin_id, broker, account_no, strategy_label);

-- 원래 RLS 정책 복원
create policy "brokerage_connection own rows only"
  on public.brokerage_connection
  for all
  to authenticated
  using (public.is_admin() and admin_id = auth.uid())
  with check (public.is_admin() and admin_id = auth.uid());

commit;
