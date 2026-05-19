-- 0017_cost_log_and_batch_runs.rollback.sql
drop function if exists public.commit_badge_only(text, text, text);
drop function if exists public.commit_persona_eval(text, text, jsonb, jsonb, text);
drop function if exists public.acquire_batch_lock(text);
alter table if exists public.committee_votes drop constraint if exists committee_votes_report_persona_uniq;
alter table if exists public.stock_reports drop constraint if exists stock_reports_month_ticker_uniq;
alter table if exists public.stock_reports drop column if exists consensus_badge;
drop table if exists public.monthly_batch_runs;
drop table if exists public.cost_log;
