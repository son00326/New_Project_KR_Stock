-- migration: 0001_rls_sketch
-- purpose: 주픽 어드민 서비스 9엔티티 admin-only RLS 정책 초안 (S0 T0.4)
-- affected tables: admin_emails, short_list_30, stock_report, committee_vote,
--                  portfolio_approval, portfolio_snapshot, alert_event,
--                  briefing_log, regen_counter, brokerage_connection
-- special considerations:
--   - 이 파일은 **sketch (실행 금지)**. S1~S6 각 슬라이스 킥오프에서 필요한 테이블만
--     발췌하여 실제 마이그레이션에 사용.
--   - admin 판별: BL-2 email allowlist 방식. `public.admin_emails` 테이블에 3명 이메일.
--     미들웨어(lib/supabase/middleware.ts)의 ADMIN_EMAILS env와 **반드시 동기화**.
--   - 멤버 페이지(ServicePlan-Member.md) 정책은 별도 마이그레이션에서 추가.
--   - E9 BrokerageConnection은 본인 admin_id만 접근 (다른 어드민도 차단).
-- ref: Document/Service/Planning/ServicePlan-Admin.md §4.2·§4.5


-- ============================================================================
-- §0. Admin allowlist 테이블 + 헬퍼 함수
-- ============================================================================

-- 어드민 이메일 allowlist. 앱(Middleware)의 ADMIN_EMAILS env와 동기 유지.
create table if not exists public.admin_emails (
  email text primary key,
  added_at timestamptz not null default now(),
  note text
);

alter table public.admin_emails enable row level security;

-- 본 테이블은 service_role만 관리 (서버 스크립트). 일반 유저 조회/변경 불가.
create policy "admin_emails service_role only"
  on public.admin_emails
  as restrictive
  for all
  to authenticated, anon
  using (false);

-- 현재 세션의 유저 email이 allowlist에 있는지 판별하는 헬퍼.
-- 모든 정책에서 이 함수를 사용하여 admin 체크 일원화.
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
-- §1. E1 ShortList30 — 월간 Short List (admin-only RW)
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
  delta_status text check (delta_status in ('new','hold','removed')),
  delta_reason text,
  summary_3line text,
  suggested_weight numeric,
  created_at timestamptz not null default now()
);

alter table public.short_list_30 enable row level security;

create policy "short_list_30 admin all"
  on public.short_list_30
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ============================================================================
-- §2. E2 StockReport — 종목 풀 리포트 (admin-only RW, jsonb sections)
-- ============================================================================
create table if not exists public.stock_report (
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
  regen_auto_count int not null default 0,
  regen_manual_count int not null default 0,
  generated_at timestamptz not null default now()
);

-- 인덱스 메모(§4.2 P5 I-07): section_* jsonb에 GIN 인덱스는 B2.3 확정 후 추가.
create unique index if not exists stock_report_latest_uniq
  on public.stock_report (month, ticker)
  where is_latest = true;

alter table public.stock_report enable row level security;

create policy "stock_report admin all"
  on public.stock_report
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ============================================================================
-- §3. E3 CommitteeVote — 투심위 투표 기록 (admin-only RW)
-- ============================================================================
create table if not exists public.committee_vote (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.stock_report(id) on delete cascade,
  persona_id varchar not null,
  persona_layer text not null check (persona_layer in ('core','sector')),
  sector varchar,
  vote text not null check (vote in ('approve','reject','abstain')),
  argument_excerpt text,
  created_at timestamptz not null default now()
);

alter table public.committee_vote enable row level security;

create policy "committee_vote admin all"
  on public.committee_vote
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ============================================================================
-- §4. E4 PortfolioApproval — 승인 이벤트 (admin-only RW + UNIQUE is_final)
-- ============================================================================
create table if not exists public.portfolio_approval (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  admin_id uuid not null references auth.users(id) on delete restrict,
  approval_type text not null check (approval_type in ('accept','reject')),
  approved_at timestamptz not null default now(),
  is_final boolean not null default false,
  prev_portfolio_held boolean not null default false,
  shortlist_generated_at timestamptz not null,
  dispute_raised_at timestamptz,
  dispute_resolved_at timestamptz,
  report_view_count int not null default 0
);

-- §4.2 P5 I-08: 월당 확정 승인 1건만 허용 (선착순 race condition 방어)
create unique index if not exists portfolio_approval_final_month_uniq
  on public.portfolio_approval (month)
  where is_final = true;

alter table public.portfolio_approval enable row level security;

create policy "portfolio_approval admin all"
  on public.portfolio_approval
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ============================================================================
-- §5. E5 PortfolioSnapshot — 가상 포트 일별 스냅샷 (admin-only RW)
-- ============================================================================
-- D11: 가상 트래킹 전용. 실제 증권사 계좌는 E9와 분리.
create table if not exists public.portfolio_snapshot (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  month date not null,
  ticker varchar,
  entry_price numeric,
  current_price numeric,
  weight numeric,
  is_cash boolean not null default false,
  daily_return numeric,
  total_return numeric,
  kospi_return numeric,
  alpha numeric,
  sharpe numeric
);

alter table public.portfolio_snapshot enable row level security;

create policy "portfolio_snapshot admin all"
  on public.portfolio_snapshot
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ============================================================================
-- §6. E6 AlertEvent — 알림 이벤트 (admin-only RW)
-- ============================================================================
create table if not exists public.alert_event (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null check (
    alert_type in ('exit_signal','news_critical','price_anomaly','briefing','scheduler_fail')
  ),
  ticker varchar,
  severity text not null check (severity in ('critical','warning','info')),
  trigger_reason text not null,
  signal_sent_at timestamptz not null default now(),
  outcome_at timestamptz,
  t7_price_change numeric,
  decision_recorded text check (decision_recorded in ('sell_all','partial_sell','hold')),
  decision_memo text,
  is_read boolean not null default false
);

alter table public.alert_event enable row level security;

create policy "alert_event admin all"
  on public.alert_event
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ============================================================================
-- §7. E7 BriefingLog — 모닝 브리핑 발송 기록 (admin-only RW)
-- ============================================================================
create table if not exists public.briefing_log (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  content_summary text,
  generated_at timestamptz not null default now(),
  sent_channels jsonb not null default '[]'::jsonb,
  view_events jsonb not null default '[]'::jsonb,
  generation_failed boolean not null default false
);

alter table public.briefing_log enable row level security;

create policy "briefing_log admin all"
  on public.briefing_log
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ============================================================================
-- §8. E8 RegenCounter — 재생성 카운터 (admin-only RW)
-- ============================================================================
create table if not exists public.regen_counter (
  id uuid primary key default gen_random_uuid(),
  ticker varchar not null,
  month date not null,
  auto_count int not null default 0 check (auto_count <= 1),
  manual_count int not null default 0 check (manual_count <= 2),
  reset_at timestamptz not null,
  unique (ticker, month)
);

alter table public.regen_counter enable row level security;

create policy "regen_counter admin all"
  on public.regen_counter
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ============================================================================
-- §9. E9 BrokerageConnection — 증권사/거래소 API 연결 (본인 admin_id만 접근!)
-- ============================================================================
-- D12: §1A.0 매뉴얼·자동매매 실체결 레이어. 가상 포트(E5)와 분리.
-- 보안: 다른 어드민도 타인의 brokerage 연결 조회 불가. api_key_ref는 Vault 참조 키만 저장(평문 금지).
create table if not exists public.brokerage_connection (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  broker text not null,  -- KIS·Kiwoom·Samsung·KB·Mirae·Upbit·Binance 등
  account_no varchar not null,  -- 마스킹 저장: "12-***-5678"
  api_key_ref text not null,  -- Vault/Secrets 참조 키 (평문 금지)
  strategy_label varchar not null,
  scope text not null check (scope in ('manual','auto','both')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (admin_id, broker, account_no, strategy_label)
);

alter table public.brokerage_connection enable row level security;

-- 본인 admin_id만 읽기·쓰기 — 다른 어드민도 타인 연결 차단.
create policy "brokerage_connection own rows only"
  on public.brokerage_connection
  for all
  to authenticated
  using (public.is_admin() and admin_id = auth.uid())
  with check (public.is_admin() and admin_id = auth.uid());


-- ============================================================================
-- §X. 초기 시드 (주석 처리 — 운영 시 수동 삽입)
-- ============================================================================
-- insert into public.admin_emails (email, note) values
--   ('shjang1001@gmail.com', '메인 어드민'),
--   ('kevinoh816@gmail.com', '어드민 2'),
--   ('son00326@gmail.com',   '어드민 3')
-- on conflict (email) do nothing;
