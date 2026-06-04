-- 0033_tier1_selection_judge_round.sql — W1b: judge 라운드(round=3) 허용.
-- 0031/0032 RPC·구조 무변경. apply 순서: 0032 → 0033 (0032 미적용 시 본 마이그 적용 불가 — round 컬럼 부재).
-- production apply = USER 게이트 (dormant 작성). rollback = 0033_tier1_selection_judge_round.rollback.sql.

alter table public.tier1_selection_job
  drop constraint if exists tier1_selection_job_round_chk;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tier1_selection_job'::regclass
      and conname = 'tier1_selection_job_round_chk'
  ) then
    alter table public.tier1_selection_job
      add constraint tier1_selection_job_round_chk check (round in (1, 2, 3));
  end if;
end $$;
