-- migration: 0028_tier0_candidates_150
-- purpose: PR-D (ADR D-3 / B1) — Tier 0 150-후보 producer/consumer SoT.
--   Python screen_shortlist_tier0.py --emit-candidates 가 150 (단/중/장 disjoint 50씩) write (producer).
--   TS cron/admin tier0Source 가 read → Tier1Candidate[] (consumer, runMonthlyBatchOrchestrator 입력).
-- ref: docs/superpowers/specs/2026-05-31-realdata-realai-e2e-decisions.md §3 D-3 / §4 PR-D
--
-- shape contract (53차 §5 + persona-eval.ts Tier1Candidate):
--   disjoint 50×3 = 150 distinct ticker (unique(month,ticker) enforce). bucket 단일 (한 ticker 한 bucket).
--   runMonthlyBatchOrchestrator candidates.length===150 hard-assert + runTier1Screening distinct-ticker assert 충족.
--   tier0_score = 해당 bucket weight 적용 composite score (Tier1Candidate.tier0_scores[bucket] = score, 나머지 null).
--
-- 기존 short_list_30 (Tier 0 30 직선정 fallback, 비-AI)과 별개 테이블 — AI 메인 path 입력.
--   short_list_30 = 최종 30 (Tier 0 단독 또는 PR-E 이후 Tier 1 AI 선정). 본 테이블 = 그 전 단계 150 후보 pool.
--
-- RLS/grant: 0002 short_list_30 패턴 동일 (authenticated admin RW via is_admin() + service_role RLS bypass).
--   Python producer = SUPABASE_SERVICE_ROLE_KEY (bypass). TS cron consumer = service-role client (bypass).
--   TS admin consumer = session client (is_admin() RLS).

create table if not exists public.tier0_candidates_150 (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  ticker varchar not null check (ticker ~ '^[0-9]{6}$'),
  -- name/sector: Tier 0 Python seed가 채움. sector = canonical 14 (B89 strict block 통과 보장) — unresolved는 producer가 차단.
  name text,
  sector text,
  bucket text not null check (bucket in ('short','mid','long')),
  rank int not null check (rank between 1 and 50),
  tier0_score numeric not null,
  signal_label text,
  created_at timestamptz not null default now()
);

-- (month, ticker) 조회·중복 방지 — 150 distinct ticker 계약 enforce.
create unique index if not exists tier0_candidates_150_month_ticker_uniq
  on public.tier0_candidates_150 (month, ticker);

-- bucket+rank 정렬 조회 (consumer SELECT order).
create index if not exists tier0_candidates_150_month_bucket_rank_idx
  on public.tier0_candidates_150 (month, bucket, rank);

alter table public.tier0_candidates_150 enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tier0_candidates_150'
      and policyname = 'tier0_candidates_150 admin all'
  ) then
    create policy "tier0_candidates_150 admin all"
      on public.tier0_candidates_150
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

comment on table public.tier0_candidates_150 is
  'PR-D (ADR D-3/B1) — Tier 0 150-후보 (단/중/장 disjoint 50씩). Python --emit-candidates producer → TS getTier0Candidates consumer → runMonthlyBatchOrchestrator/runTier1Screening 입력. short_list_30 (30 직선정 fallback)와 별개. unique(month,ticker)=150 distinct 계약.';
comment on column public.tier0_candidates_150.bucket is
  'PR-D: ticker가 top-50 후보로 선정된 단일 timeframe (short|mid|long). cross-bucket disjoint (한 ticker 한 bucket).';
comment on column public.tier0_candidates_150.tier0_score is
  'PR-D: bucket weight 적용 composite score (Tier1Candidate.tier0_scores[bucket]). consensus.ts percentile 배지 산출 입력.';
