-- Rollback for 0014_dart_financial_cache.sql
drop policy if exists "dart_financial_cache_admin_read"    on public.dart_financial_cache;
drop policy if exists "dart_financial_cache_service_write" on public.dart_financial_cache;
drop index  if exists public.idx_dart_fc_lookup;
drop table  if exists public.dart_financial_cache;
