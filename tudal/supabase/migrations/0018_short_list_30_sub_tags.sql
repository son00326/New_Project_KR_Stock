-- migration: 0018_short_list_30_sub_tags
-- purpose: D21 (52차, 2026-05-20) — Tier 2 Sector Board Option C overlay 박제 prep.
--          short_list_30.sub_tags jsonb 컬럼 + GIN index 추가.
-- ref: Document/Service/Planning/ServicePlan-Admin.md §1A.5 D21 + §4.2 E1 (sub_tags 컬럼 행)
--      Document/Service/Report/ReportFramework.md §7.3 sub_tag crosswalk
--      tudal/src/lib/screening/canonical-sectors.ts SUB_TAG_CROSSWALK
-- note: nullable additive — 기존 row(2026-05-01 30 rows) sub_tags = NULL.
--       row backfill 정책 = Tier 2 implementation 후속 PR 책임 (본 SoT PR OOS).
--       CHECK constraint 미적용 — validation은 RPC writer 책임 (commit_sector_personas, 후속 PR).
--       GIN index = jsonb 콘텐츠 검색 ('sub_tags @> [\"조선\"]' 등) 효율 확보.

alter table public.short_list_30
  add column if not exists sub_tags jsonb;

create index if not exists short_list_30_sub_tags_gin_idx
  on public.short_list_30
  using gin (sub_tags);

comment on column public.short_list_30.sub_tags is
  'D21 (52차) sub_tags 운영 UI taxonomy proxy. jsonb string array (예: [''조선''] 또는 [''가전'', ''디스플레이'']). canonical sector 결정은 sector 컬럼이 primary; sub_tags는 secondary descriptors. SUB_TAG_CROSSWALK SoT = canonical-sectors.ts.';
