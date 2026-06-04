-- 0032_tier1_selection_round.rollback.sql — 순서 고정 (omxy R6 MED).
-- ⚠️ round=2 rows 존재 시 unique(period_key, ticker) 원복이 충돌 → 선두에서 R2 rows 삭제 후 원복.
delete from public.tier1_selection_job where round > 1;
alter table public.tier1_selection_job
  drop constraint if exists tier1_selection_job_period_ticker_round_key;
alter table public.tier1_selection_job
  drop constraint if exists tier1_selection_job_round_chk;
alter table public.tier1_selection_job
  drop column if exists round;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tier1_selection_job'::regclass
      and conname = 'tier1_selection_job_period_key_ticker_key'
  ) then
    alter table public.tier1_selection_job
      add constraint tier1_selection_job_period_key_ticker_key unique (period_key, ticker);
  end if;
end $$;
