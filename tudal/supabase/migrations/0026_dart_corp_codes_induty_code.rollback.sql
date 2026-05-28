-- ============================================================================
-- 0026 rollback — dart_corp_codes.induty_code 컬럼 제거
-- ============================================================================
-- WARNING: induty_code / induty_last_status / induty_last_seen_at 데이터가 모두 소실됨.
--          rollback 전 백업 권장: `select ticker, induty_code, induty_last_status,
--          induty_last_seen_at from public.dart_corp_codes where induty_code is not null;`
-- ============================================================================

alter table public.dart_corp_codes
  drop constraint if exists dart_corp_codes_induty_code_format_check;

alter table public.dart_corp_codes
  drop column if exists induty_last_seen_at,
  drop column if exists induty_last_status,
  drop column if exists induty_code;
