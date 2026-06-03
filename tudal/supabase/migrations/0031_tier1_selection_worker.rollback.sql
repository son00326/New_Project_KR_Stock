-- 0031_tier1_selection_worker.rollback.sql
-- Tier1 selection-worker 마이그 0031 롤백. cost_log/pipeline_health/short_list_30/monthly_batch_runs는 미변경이므로 대상 아님.

drop function if exists public.release_selection_worker_lock(text, uuid, text);
drop function if exists public.acquire_selection_worker_lock(text);
drop function if exists public.mark_selection_job(uuid, text, jsonb, text);
drop function if exists public.claim_next_selection_jobs(text, int);

drop table if exists public.tier1_selection_run;
drop table if exists public.tier1_selection_job;
