-- rollback for 0023_sector_reference_backlog
-- SoT: docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md (v6)

drop function if exists public.insert_or_bump_sector_backlog(text);
drop table if exists public.sector_reference_backlog;
