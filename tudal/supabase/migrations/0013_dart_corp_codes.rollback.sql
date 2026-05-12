-- Rollback for 0013_dart_corp_codes.sql
drop policy if exists "dart_corp_codes_admin_read"    on public.dart_corp_codes;
drop policy if exists "dart_corp_codes_service_write" on public.dart_corp_codes;
drop index  if exists public.idx_dart_corp_codes_corp_code;
drop table  if exists public.dart_corp_codes;
