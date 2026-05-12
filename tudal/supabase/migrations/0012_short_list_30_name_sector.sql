-- migration: 0012_short_list_30_name_sector
-- purpose: T7e.8 prep — short_list_30에 name/sector 컬럼 추가 (Tier 0 Python seed 박제 직전)
-- ref: Document/Build/Slices/S7-RealData.md L127·L230 (41차 박제 — (a) ALTER TABLE 채택)
--      Document/Process/HANDOFF.md §2.A T7e.8
-- note: 0011 슬롯은 BL-KRIT-8 (S8 자동매매 E13~E17) 보존 약속이라 0012로 승격.
--       nullable additive DDL — 기존 row는 NULL로 채워지고 Python seed가 채워넣는다.

alter table public.short_list_30
  add column if not exists name text,
  add column if not exists sector text;

-- 섹터별 조회 최적화 (Sector Board 14×10 활성화 시 사용 + 어드민 화면 섹터 그룹핑)
create index if not exists short_list_30_sector_idx
  on public.short_list_30 (sector);
