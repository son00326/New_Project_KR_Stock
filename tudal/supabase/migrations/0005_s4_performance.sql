-- migration: 0005_s4_performance
-- purpose: S4 킥오프 — M8 가상 포트 트래킹 + M9 재생성 cap + M16 Decision Tree + M17 cost_log stub (R5 pre-wire)
-- ref: Document/Service/Planning/ServicePlan-Admin.md §3.4 R3.4-1~5 · §3.11 R3.11-1~9 · §3.12 R3.12-2 · §4.2 E5·E8
-- blocker resolution (2026-04-19, 20차):
--   BL-8 = A (복합 AND: alpha>=0 AND Sharpe>=0.5 AND MDD>=-15%) — judge 함수 앱 레벨 (DB 컬럼은 raw 수치만 저장)
--   BL-9 = A (서브라우트 /admin/report/[ticker]/regenerate) — DB 스키마 영향 없음
--   R5 완화: cost_log stub 테이블 pre-wire. 월 40만원 hardcap은 S6 M17에서 `regen_counter` 핸들러가 SUM(cost_krw) 체크.
-- 선행: 0001(RLS sketch) · 0002(is_admin 헬퍼·admin_emails) · 0003(stock_reports) · 0004(portfolio_approval·kr_business_days)


-- ============================================================================
-- §1. E5 PortfolioSnapshot — 가상 포트 일별 스냅샷 (D11: 가상 트래킹 전용)
-- ============================================================================
-- R3.4-1~3: Accept 시점 entry_price + 매일 EOD 배치. 현금 행 별도 (is_cash=true).
-- ticker=NULL 행 = 해당 일자 포트 전체 집계 행 (total_return·kospi_return·alpha·sharpe 대표값).
create table if not exists public.portfolio_snapshot (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  month date not null,
  ticker text,
  entry_price numeric(18, 4) not null default 0,
  current_price numeric(18, 4) not null default 0,
  weight numeric(6, 4) not null default 0 check (weight >= 0 and weight <= 1),
  is_cash boolean not null default false,
  daily_return numeric(10, 6) not null default 0,
  total_return numeric(10, 6) not null default 0,
  kospi_return numeric(10, 6) not null default 0,
  alpha numeric(10, 6) not null default 0,
  sharpe numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

-- (date, ticker) UNIQUE — ticker NULL 허용 시 Postgres NULLS NOT DISTINCT 필요 (PG15+).
-- 실전 PG14 호환을 위해 부분 인덱스 2개로 분할:
--   ① ticker IS NOT NULL 행: (date, ticker) UNIQUE
--   ② ticker IS NULL (포트 전체 행): (date) UNIQUE
create unique index if not exists portfolio_snapshot_date_ticker_uniq
  on public.portfolio_snapshot (date, ticker)
  where ticker is not null;

create unique index if not exists portfolio_snapshot_date_portfolio_uniq
  on public.portfolio_snapshot (date)
  where ticker is null;

-- 월별·누적 성과 쿼리 최적화 (/admin/track-record)
create index if not exists portfolio_snapshot_month_idx
  on public.portfolio_snapshot (month);

create index if not exists portfolio_snapshot_date_idx
  on public.portfolio_snapshot (date);

alter table public.portfolio_snapshot enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'portfolio_snapshot'
      and policyname = 'portfolio_snapshot admin all'
  ) then
    create policy "portfolio_snapshot admin all"
      on public.portfolio_snapshot
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §2. E8 RegenCounter — 재생성 카운터 (M9 cap 가드)
-- ============================================================================
-- R3.4-4: 종목당 월 auto 0/1회 · manual 0/2회. 매월 1일 00:00 KST 리셋.
-- UNIQUE(ticker, month) — 월당 1행. Reject 재분석 시 auto_count +1, 수동 재생성 시 manual_count +1.
create table if not exists public.regen_counter (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  month date not null,
  auto_count int not null default 0 check (auto_count >= 0 and auto_count <= 1),
  manual_count int not null default 0 check (manual_count >= 0 and manual_count <= 2),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists regen_counter_ticker_month_uniq
  on public.regen_counter (ticker, month);

create index if not exists regen_counter_month_idx
  on public.regen_counter (month);

alter table public.regen_counter enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'regen_counter'
      and policyname = 'regen_counter admin all'
  ) then
    create policy "regen_counter admin all"
      on public.regen_counter
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §3. cost_log stub — R5 pre-wire (M17 hardcap 예비 테이블, 실 활성화는 S6)
-- ============================================================================
-- R3.12-2: 월 40만원 hardcap. 본 테이블은 S4에서 스키마만 심고, S6 M17에서 실 적재 개시.
-- S4 T4.5 regenerateReport 핸들러에는 stub 훅 코드 주석을 삽입 (SELECT SUM(cost_krw) WHERE month=?).
create table if not exists public.cost_log (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  month date not null,
  model text not null,
  purpose text, -- 'regenerate' · 'briefing' · 'committee' 등 자유 태그
  tokens_prompt int not null default 0,
  tokens_completion int not null default 0,
  cost_krw numeric(12, 2) not null default 0 check (cost_krw >= 0),
  meta jsonb
);

-- 월별 합계 쿼리 최적화 (SELECT SUM(cost_krw) FROM cost_log WHERE month = ?)
create index if not exists cost_log_month_idx on public.cost_log (month);
create index if not exists cost_log_ts_idx on public.cost_log (ts);

alter table public.cost_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cost_log'
      and policyname = 'cost_log admin all'
  ) then
    create policy "cost_log admin all"
      on public.cost_log
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §X. 설명 (mock 주입 위치)
-- ============================================================================
-- portfolio_snapshot mock: src/lib/data/mock-admin-snapshots.ts (T4.3 fixture 보강).
-- regen_counter mock: src/lib/data/mock-admin-regen-counters.ts (T4.5 fixture 보강).
-- cost_log: S4에서는 write 없음. S6 M17에서 AI API 호출 wrapper가 INSERT.
-- Decision Tree judge(복합 AND)는 앱 레벨 src/lib/performance/judge.ts.
-- Sharpe/MDD/Alpha 계산도 앱 레벨 src/lib/performance/* (SQL GENERATED 컬럼 아님).
