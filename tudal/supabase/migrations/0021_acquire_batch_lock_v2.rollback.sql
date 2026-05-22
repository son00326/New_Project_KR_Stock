-- rollback: 0021_acquire_batch_lock_v2
-- started_by NOT NULL 복구는 production data 영향 — explicit user 승인 필요. drop function만.
drop function if exists public.acquire_batch_lock_v2(text, text);
-- alter table public.monthly_batch_runs alter column started_by set not null; -- 수동 실행 필요
