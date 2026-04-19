-- migration: 0007_s5b_notifications
-- purpose: S5b — M13 장중 이상 감지(intraday_anomaly_event) + M14 종목 토글(admin_settings·ticker_alert_pref) + M15 Exit 2채널
-- ref: Document/Service/Planning/ServicePlan-Admin.md §3.10 R3.10-8~15 · Document/Build/Slices/S5-Automation.md §S5b Tasks
-- blocker resolution (2026-04-19, 22차):
--   BL-12 폐기 (SMS 제거, D10 = 이메일 1회 재시도로 축소)
--   BL-14 = 한투 WebSocket 실시간 채택
-- 선행: 0001 · 0002 · 0003 · 0004 · 0005 · 0006.


-- ============================================================================
-- §1. admin_settings — 어드민 개인 설정 (모니터링 모드 등)
-- ============================================================================
-- 1 admin → 1 row. intraday_mode=true면 /admin 홈 배지 + 장중 텔레그램 알림 활성.
-- 향후 확장: 모드 외 브리핑 수신 채널 · 임계치 override 등.
create table if not exists public.admin_settings (
  admin_id uuid primary key,
  intraday_mode boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_settings'
      and policyname = 'admin_settings self'
  ) then
    create policy "admin_settings self"
      on public.admin_settings
      for all
      to authenticated
      using (admin_id = auth.uid() and public.is_admin())
      with check (admin_id = auth.uid() and public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §2. ticker_alert_pref — M14 종목별 알림 토글
-- ============================================================================
-- 어드민 × 종목 pair. enabled=false면 장중 이상 감지·Exit 시그널 발송 차단.
-- Short List 30 상의 종목만 row 생성(없으면 default enabled=true로 간주).
-- J3 Exit 긴급 알림은 모드·토글 무관하게 발송됨(§3.5 R3.5-5 원칙) — 호출부에서 분기.
create table if not exists public.ticker_alert_pref (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  ticker text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create unique index if not exists ticker_alert_pref_admin_ticker_uniq
  on public.ticker_alert_pref (admin_id, ticker);
create index if not exists ticker_alert_pref_admin_idx
  on public.ticker_alert_pref (admin_id);

alter table public.ticker_alert_pref enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ticker_alert_pref'
      and policyname = 'ticker_alert_pref self'
  ) then
    create policy "ticker_alert_pref self"
      on public.ticker_alert_pref
      for all
      to authenticated
      using (admin_id = auth.uid() and public.is_admin())
      with check (admin_id = auth.uid() and public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §3. intraday_anomaly_event — M13 장중 이상 감지 이벤트 적재
-- ============================================================================
-- trigger_type = 'price_spike'(+5% 이상) · 'price_drop'(-5% 이하) · 'volume_spike'(거래량 3배+)
-- price_change_pct · volume_ratio는 trigger에 따라 null 허용.
-- dedup_key는 (ticker, trigger_type, 1분 bucket) UNIQUE — 동일 종목 동일 트리거 1분 내 중복 방지.
create table if not exists public.intraday_anomaly_event (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  trigger_type text not null check (trigger_type in ('price_spike', 'price_drop', 'volume_spike')),
  price_change_pct numeric(6, 3), -- e.g., -5.234 = -5.234%
  volume_ratio numeric(6, 2),     -- e.g., 3.15 = 20일 평균 대비 3.15배
  last_price numeric(14, 2),
  detected_at timestamptz not null default now(),
  dedup_key text not null,
  raw jsonb
);

create unique index if not exists intraday_anomaly_dedup_uniq
  on public.intraday_anomaly_event (dedup_key);
create index if not exists intraday_anomaly_ticker_detected_idx
  on public.intraday_anomaly_event (ticker, detected_at desc);
create index if not exists intraday_anomaly_detected_idx
  on public.intraday_anomaly_event (detected_at desc);

alter table public.intraday_anomaly_event enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'intraday_anomaly_event'
      and policyname = 'intraday_anomaly_event admin all'
  ) then
    create policy "intraday_anomaly_event admin all"
      on public.intraday_anomaly_event
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §X. 설명 (mock 주입 위치 · 타입 매핑 · 이월)
-- ============================================================================
-- admin_settings mock: src/lib/data/mock-admin-settings.ts (T5b.2).
-- ticker_alert_pref mock: src/lib/data/mock-admin-ticker-prefs.ts (T5b.2).
-- intraday_anomaly_event mock: src/lib/data/mock-admin-intraday.ts (T5b.1).
-- AlertType 확장: 'intraday_anomaly' 추가 (src/types/admin.ts 타입만, alert_event는 text 컬럼이라 SQL 변경 불필요).
-- E6 AlertEvent에 exit_signal 결정 컬럼(decision_recorded·decision_memo)은 0001에 이미 포함 — T5b.3 결정 UI는 기존 컬럼 활용.
-- D10 이메일 재시도 fallback은 순수 로직(src/lib/notify/exit-dispatch.ts) — 스키마 변경 없음.
