-- migration: 0003_s2_reports
-- purpose: S2 킥오프 — E2 StockReport + E3 CommitteeVote + E10 ReportViewLog + RLS
-- ref: Document/Service/Planning/ServicePlan-Admin.md §4.2 E2·E3·E10 · §3.3 R3.3-8
-- blocker resolution (2026-04-17):
--   BL-4 = B (codegen 인라인) — 본 파일은 schema만. mock은 TS fixture 별도.
--   BL-5 = B (1일 1회 dedupe) — E10에 UNIQUE(admin_id, report_id, view_date) 적용.
--   G-5  = B (E10 분리) — E4에서 report_view_count 제거 (0001 sketch 시점 이전 미생성).
--   G-11 = 자동 해소 (G-5 B 채택).


-- ============================================================================
-- §1. E2 stock_reports — 종목 풀 리포트 (jsonb sections + version 관리)
-- ============================================================================

create table if not exists public.stock_reports (
  id uuid primary key default gen_random_uuid(),
  ticker varchar not null,
  month date not null,
  version int not null default 1,
  schema_version int not null default 1,
  is_latest boolean not null default true,
  section_0 jsonb,
  section_1 jsonb,
  section_2 jsonb,
  section_3 jsonb,
  section_4 jsonb,
  section_5 jsonb,
  section_6 jsonb,
  section_7 jsonb,
  section_8 jsonb,
  appendix jsonb,
  regen_auto_count int not null default 0 check (regen_auto_count <= 1),
  regen_manual_count int not null default 0 check (regen_manual_count <= 2),
  generated_at timestamptz not null default now()
);

-- 인덱스: 홈 → 리포트 라우팅 (ticker + month 최신 1건만)
create unique index if not exists stock_reports_ticker_month_latest_uniq
  on public.stock_reports (ticker, month)
  where is_latest = true;

-- 인덱스: 월간 리포트 목록 조회
create index if not exists stock_reports_month_idx
  on public.stock_reports (month);

alter table public.stock_reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stock_reports'
      and policyname = 'stock_reports admin all'
  ) then
    create policy "stock_reports admin all"
      on public.stock_reports
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §2. E3 committee_votes — 투심위 투표 기록 (Core 11 + Sector Board)
-- ============================================================================

create table if not exists public.committee_votes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.stock_reports(id) on delete cascade,
  persona_id varchar not null,
  persona_layer text not null check (persona_layer in ('core','sector')),
  sector varchar,
  vote text not null check (vote in ('approve','reject','abstain')),
  argument_excerpt text,
  created_at timestamptz not null default now()
);

-- sector layer는 sector 컬럼 필수, core layer는 null 허용
alter table public.committee_votes
  add constraint committee_votes_sector_required
  check (
    (persona_layer = 'core' and sector is null)
    or
    (persona_layer = 'sector' and sector is not null)
  );

-- 인덱스: 리포트별 투표 조회
create index if not exists committee_votes_report_id_idx
  on public.committee_votes (report_id);

-- 인덱스: 동일 리포트 동일 페르소나 중복 방지
create unique index if not exists committee_votes_report_persona_uniq
  on public.committee_votes (report_id, persona_id);

alter table public.committee_votes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'committee_votes'
      and policyname = 'committee_votes admin all'
  ) then
    create policy "committee_votes admin all"
      on public.committee_votes
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §3. E10 report_view_log — 열람 로그 (D15 R3.3-8 2인 게이팅 소스)
--     G-5 옵션 B · BL-5 옵션 B (1일 1회 dedupe)
-- ============================================================================

create table if not exists public.report_view_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  report_id uuid not null references public.stock_reports(id) on delete cascade,
  view_date date not null default (now() at time zone 'Asia/Seoul')::date,
  viewed_at timestamptz not null default now()
);

-- 1일 1회 dedupe (BL-5 B)
create unique index if not exists report_view_log_admin_report_date_uniq
  on public.report_view_log (admin_id, report_id, view_date);

-- 집계 쿼리 최적화: COUNT(DISTINCT admin_id) WHERE report_id = ?
create index if not exists report_view_log_report_id_idx
  on public.report_view_log (report_id);

alter table public.report_view_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'report_view_log'
      and policyname = 'report_view_log admin all'
  ) then
    create policy "report_view_log admin all"
      on public.report_view_log
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §X. 설명
-- ============================================================================
-- S2 단계에서는 실 Supabase 테이블 대신 TS mock fixture로 UI 동작 (BL-4 B):
--   - src/lib/data/mock-admin-report.ts
--   - src/lib/data/mock-admin-committee.ts
--   - src/lib/data/mock-admin-report-view-log.ts
-- 실 시드는 S5 M10 스케줄러에서 AI 배치로 자연 생성 (stock_reports + committee_votes).
-- report_view_log는 /admin/report/[ticker] 진입 Server Action에서 INSERT onConflict do nothing.
