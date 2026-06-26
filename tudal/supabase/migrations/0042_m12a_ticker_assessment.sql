-- ============================================================================
-- 0042_m12a_ticker_assessment.sql
-- purpose: M12a 뉴스 기반 자동 제외(AI 페르소나) durable ledger — news_event 1건 + per-ticker N건.
--   SoT: ServicePlan-Admin §3.10 R3.10-7c · docs/superpowers/specs/2026-06-26-m12a-news-auto-remove-shadow-first.md §2.
--   DORMANT(USER apply-only) — M12a worker는 flag(M12A_NEWS_EVAL_ENABLED) off면 미호출이라 미적용도 안전.
--   shadow-first: action_taken=shadowed(would-remove)/held_by_brake/removed(GAP1 m12a_risk_action 귀속).
--   alert_event.alert_type CHECK(12종)는 불변 — M12a 알림은 기존 news_critical/news_warning 재사용.
-- ============================================================================

create table if not exists public.m12a_ticker_assessment (
  id uuid primary key default gen_random_uuid(),
  news_event_id uuid not null references public.news_event(id) on delete cascade,
  run_id text not null,                 -- 1 eval run 그룹(브레이크 "1 run" 의미)
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$'),  -- YYYY-MM-01 (cost/attribution 정합)
  ticker text not null check (ticker ~ '^[0-9]{6}$'),
  surface text not null check (surface in ('list','portfolio')),  -- 홈 리스트 vs 가상포트
  scope text not null check (scope in ('company','sector','market','unknown')),  -- 메타데이터(게이트 아님)
  severity text not null check (severity in ('critical','warning','info')),
  confidence text not null check (confidence in ('low','medium','high')),
  materiality text not null check (materiality in ('low','medium','high')),
  directness text not null check (directness in ('direct','indirect')),
  thesis_break boolean not null,
  thesis_break_reason text,
  recommended_action text not null check (recommended_action in ('auto_remove','alert_only','hold_for_review')),
  action_taken text not null check (action_taken in ('shadowed','held_by_brake','removed')),  -- GAP1 m12a_risk_action 귀속
  held_by_brake boolean not null default false,
  price_basis_date text check (price_basis_date is null or price_basis_date ~ '^[0-9]{8}$'), -- GAP2 (removed만)
  price_source text check (price_source in ('KRX_EOD')),
  execution_assumption text check (execution_assumption in ('virtual_eod')),
  alert_event_id uuid references public.alert_event(id) on delete set null,  -- optional link
  created_at timestamptz not null default now(),
  -- GAP2 정합: removed면 가격 3필드 모두 존재, 그 외(shadowed/held_by_brake)면 모두 null.
  constraint m12a_ta_price_basis_consistency check (
    (action_taken = 'removed'
      and price_basis_date is not null and price_source is not null and execution_assumption is not null)
    or
    (action_taken <> 'removed'
      and price_basis_date is null and price_source is null and execution_assumption is null)
  )
);

create index if not exists m12a_ta_month_ticker_idx
  on public.m12a_ticker_assessment (month, ticker, created_at desc);
create index if not exists m12a_ta_run_idx on public.m12a_ticker_assessment (run_id);
create index if not exists m12a_ta_news_idx on public.m12a_ticker_assessment (news_event_id);

alter table public.m12a_ticker_assessment enable row level security;

-- RLS: admin all (0006 news_event 패턴). cron = service-role(RLS 우회), SECURITY DEFINER RPC 불요(단일 테이블 append).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'm12a_ticker_assessment'
      and policyname = 'm12a_ticker_assessment admin all'
  ) then
    create policy "m12a_ticker_assessment admin all"
      on public.m12a_ticker_assessment
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

comment on table public.m12a_ticker_assessment is
  'M12a 뉴스 기반 자동 제외 durable ledger(per-ticker thesis-break). action_taken=shadowed|held_by_brake|removed (GAP1 m12a_risk_action 귀속). shadow-first: M12A_AUTO_REMOVE_ENABLED off면 removed 미발생.';
