-- ============================================================================
-- 0026 — dart_corp_codes.induty_code (B66 C 하이브리드)
-- ============================================================================
-- Purpose: DART `company.json` 응답의 `induty_code` (KSIC 한국표준산업분류 3~5자리)
--          + 마지막 응답 status + 마지막 fetch timestamp를 dart_corp_codes에 캐시한다.
--          이 컬럼들은 canonical_sector_mapper의 입력으로 사용되며,
--          short_list_30.sector를 canonical 14로 매핑하는 seed pipeline에서 활용된다.
--
-- Driver:  plan 2026-05-28-task5-b66-c-hybrid-sector-mapper.md §3.3 (옵션 A lock-in).
-- 선행:    0013 (dart_corp_codes 본체).
-- 선행 PR: #55 plan SoT MERGED `bbf102d` (60차 §3 modified workflow, OMXY R1+R2 10 catches CONVERGED).
--
-- 본 마이그는 _nullable_ column 추가 + format CHECK constraint만 적용한다.
-- production apply는 USER Supabase re-auth + service_role 권한 필요.
-- ============================================================================

alter table public.dart_corp_codes
  add column if not exists induty_code text,
  add column if not exists induty_last_status text,
  add column if not exists induty_last_seen_at timestamptz;

-- format CHECK — DART company.json `induty_code` 실측 3~5자리 numeric string.
-- null 허용 (DART 미응답/조회 실패 시 induty_code는 비워두고 induty_last_status만 기록).
alter table public.dart_corp_codes
  drop constraint if exists dart_corp_codes_induty_code_format_check;

alter table public.dart_corp_codes
  add constraint dart_corp_codes_induty_code_format_check
  check (induty_code is null or induty_code ~ '^[0-9]{3,5}$');

-- column comments — operational diagnostic용
comment on column public.dart_corp_codes.induty_code is
  'DART company.json 응답의 업종코드(induty_code, KSIC 3~5자리). nullable — DART 응답 실패 또는 status<>"000" 시 null. canonical_sector_mapper의 longest-prefix 입력으로 사용.';

comment on column public.dart_corp_codes.induty_last_status is
  'DART company.json 마지막 응답 status. "000"만 induty_code 신뢰. "020"/"800"/"900" 등은 retry 대상, "010"~"012"/"013"/"901"은 fail-fast 또는 unresolved.';

comment on column public.dart_corp_codes.induty_last_seen_at is
  'induty_code 마지막 fetch timestamp. TTL/staleness 진단용. retention 정책 없음 (KSIC 5년 주기로 거의 불변).';

-- RLS / grant 변경 0:
--   기존 0013 RLS 정책 (service_role write + authenticated admin read)이 그대로 신규 컬럼에도 적용됨
--   (PostgreSQL row-level grant는 컬럼 단위 grant와 무관, RLS는 전체 row 단위).
--   서비스/인증 권한 매트릭스 변경이 없으므로 grant/policy DDL 추가 없음.
