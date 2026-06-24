-- rollback: 0040_commit_sector_personas_cron
-- additive only (new service-role RPC). admin RPC commit_sector_personas(0019)는 무관·보존.
drop function if exists public.commit_sector_personas_cron(text, text, text, jsonb, jsonb, jsonb, uuid);
