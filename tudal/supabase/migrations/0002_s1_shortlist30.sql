-- migration: 0002_s1_shortlist30
-- purpose: S1 킥오프 — admin_emails allowlist + is_admin() 헬퍼 + E1 short_list_30 테이블 + RLS
-- ref: Document/Service/Planning/ServicePlan-Admin.md §4.2 E1 · 0001_rls_sketch.sql §0·§1
-- note: 0001_rls_sketch.sql은 sketch(실행 금지)이므로 본 파일이 첫 실제 마이그레이션.
--       후속 슬라이스(S2~S6)에서 필요한 테이블만 동일 패턴으로 추가.


-- ============================================================================
-- §0. Admin allowlist + is_admin() 헬퍼 (S0 BL-2: email allowlist 방식)
-- ============================================================================

create table if not exists public.admin_emails (
  email text primary key,
  added_at timestamptz not null default now(),
  note text
);

alter table public.admin_emails enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_emails'
      and policyname = 'admin_emails service_role only'
  ) then
    create policy "admin_emails service_role only"
      on public.admin_emails
      as restrictive
      for all
      to authenticated, anon
      using (false);
  end if;
end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_emails ae
    where ae.email = lower(auth.jwt() ->> 'email')
  );
$$;


-- ============================================================================
-- §1. E1 short_list_30 — 월간 Short List (admin-only RW)
-- ============================================================================

create table if not exists public.short_list_30 (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  ticker varchar not null,
  bucket text not null check (bucket in ('short','mid','long')),
  rank int not null,
  composite_score numeric,
  trend_score numeric,
  momentum_score numeric,
  volatility_score numeric,
  signal_label text,
  delta_status text not null check (delta_status in ('new','hold','removed')),
  delta_reason text,
  summary_3line text,
  suggested_weight numeric,
  created_at timestamptz not null default now()
);

-- 인덱스: (month, ticker) 조회·중복 방지
create unique index if not exists short_list_30_month_ticker_uniq
  on public.short_list_30 (month, ticker);

-- 인덱스: 홈 렌더 쿼리 (month + bucket + rank 정렬)
create index if not exists short_list_30_month_bucket_rank_idx
  on public.short_list_30 (month, bucket, rank);

alter table public.short_list_30 enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'short_list_30'
      and policyname = 'short_list_30 admin all'
  ) then
    create policy "short_list_30 admin all"
      on public.short_list_30
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §X. admin_emails 시드 (주석 처리 — 운영 시 service_role로 수동 삽입)
-- ============================================================================
-- insert into public.admin_emails (email, note) values
--   ('shjang1001@gmail.com', '메인 어드민'),
--   ('kevinoh816@gmail.com', '어드민 2'),
--   ('son00326@gmail.com',   '어드민 3')
-- on conflict (email) do nothing;

-- S1 단계에서는 Supabase 실 테이블 대신 mock-admin-shortlist.ts fixture로 UI 동작.
-- 실 시드는 S5 M10 스케줄러에서 pykrx + v6 알고리즘 배치로 자연 생성.
