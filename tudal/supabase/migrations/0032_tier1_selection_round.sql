-- 0032_tier1_selection_round.sql — W1a: tier1_selection_job 멀티라운드(R1 채점 / R2 반박) 확장.
-- 0031 RPC 7종 본체 무변경 (claim/mark는 id/period_key 기준 — round 무인지 설계.
--   claim_next_selection_jobs는 returns setof tier1_selection_job + returning * 라 ALTER 후 round 자동 반환).
-- production apply = USER 게이트 (dormant 작성). rollback = 0032_tier1_selection_round.rollback.sql.

alter table public.tier1_selection_job
  add column if not exists round smallint not null default 1;
alter table public.tier1_selection_job
  alter column round set default 1;
update public.tier1_selection_job set round = 1 where round is null;
alter table public.tier1_selection_job
  alter column round set not null;

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

-- 0031 inline unique (period_key, ticker) 자동명 drop → round 포함 unique 교체.
alter table public.tier1_selection_job
  drop constraint if exists tier1_selection_job_period_key_ticker_key;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tier1_selection_job'::regclass
      and conname = 'tier1_selection_job_period_ticker_round_key'
  ) then
    alter table public.tier1_selection_job
      add constraint tier1_selection_job_period_ticker_round_key unique (period_key, ticker, round);
  end if;
end $$;
