-- 0033_tier1_selection_judge_round.rollback.sql — 순서 고정.
-- ⚠️ 0032와 동시 rollback 시 순서: 0033.rollback → 0032.rollback.
delete from public.tier1_selection_job where round > 2;
alter table public.tier1_selection_job
  drop constraint if exists tier1_selection_job_round_chk;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tier1_selection_job'::regclass
      and conname = 'tier1_selection_job_round_chk'
  ) then
    alter table public.tier1_selection_job
      add constraint tier1_selection_job_round_chk check (round in (1, 2));
  end if;
end $$;
