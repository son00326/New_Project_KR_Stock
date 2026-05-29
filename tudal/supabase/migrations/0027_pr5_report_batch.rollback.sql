-- 0027_pr5_report_batch.rollback.sql
-- PR5 report-batch 마이그 0027 롤백. cost_log/pipeline_health/0025/committee-vote RPC는 미변경이므로 대상 아님.

drop function if exists public.upsert_report_sections_0_7_cron(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.release_report_worker_lock(text, uuid, text);
drop function if exists public.acquire_report_worker_lock(text);
drop function if exists public.mark_report_job(uuid, text, uuid, text);
drop function if exists public.claim_next_report_jobs(text, int);

drop table if exists public.report_worker_run;
drop table if exists public.report_batch_job;
