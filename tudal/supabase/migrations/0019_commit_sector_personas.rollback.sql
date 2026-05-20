-- rollback: 0019_commit_sector_personas
-- purpose: D21 (52차) Tier 2 commit_sector_personas RPC rollback.

drop function if exists public.commit_sector_personas(text, text, text, jsonb, jsonb, jsonb);
