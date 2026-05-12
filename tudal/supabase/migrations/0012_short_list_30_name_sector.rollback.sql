-- rollback: 0012_short_list_30_name_sector
-- purpose: 0012를 안전하게 되돌린다. 인덱스 먼저 → 컬럼.
-- caution: name/sector 컬럼에 저장된 데이터는 영구 손실됨. 적용 전 백업 권장.

drop index if exists public.short_list_30_sector_idx;

alter table public.short_list_30
  drop column if exists sector,
  drop column if exists name;
