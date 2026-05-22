-- rollback: 0020_short_list_30_screening_metadata
alter table public.short_list_30
  drop column if exists assigned_by,
  drop column if exists prompt_version_id,
  drop column if exists personas_version_id;
