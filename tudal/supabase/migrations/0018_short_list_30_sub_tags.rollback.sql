-- rollback: 0018_short_list_30_sub_tags
-- purpose: D21 (52차) Tier 2 Sector Board Option C overlay prep rollback.
-- order: drop index → drop column (역순 안전).

drop index if exists public.short_list_30_sub_tags_gin_idx;

alter table public.short_list_30
  drop column if exists sub_tags;
