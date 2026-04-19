-- migration: 0006_s5a_automation
-- purpose: S5a 킥오프 — M10 월간 배치(E7 briefing_log·news_event 신설) + M18 pipeline_health + AlertType 확장
-- ref: Document/Service/Planning/ServicePlan-Admin.md §3.9 R3.9-1~5 · §3.10 R3.10-1~15 · §3.12 R3.12-4~6 · §4.2 E6·E7
-- blocker resolution (2026-04-19, 21차):
--   BL-11 = Resend (이메일 벤더)
--   BL-13 = 네이버 뉴스 API + 스크래핑 하이브리드 (원천 뉴스)
--   BL-15 = Vercel Cron (배치 실행 환경)
--   분할 = S5a(M10·M11·M12·M18) → S5b(M13·M14·M15)
-- G-3 완화: pipeline_health 스키마를 본 마이그레이션 §1에 인라인 정의 (ServicePlan-Admin §4.2 반영은 S6 문서 정비 시점에).
-- 선행: 0001 · 0002 · 0003 · 0004 · 0005.


-- ============================================================================
-- §1. pipeline_health — M18 파이프라인 헬스 (R3.12-4 95% Critical·99% warning)
-- ============================================================================
-- 5 파이프라인: dart(공시) · news(뉴스) · price(시세) · ai(AI 판정) · alert(알림)
-- 하나의 run_id가 여러 파이프라인 레코드를 묶을 수 있음 (M10 월간 배치 1회가 dart+ai+alert 3건 생성).
-- status = 'success' | 'warning'(지연/부분 실패) | 'failed'. latency_ms는 성능 회귀 추적.
create table if not exists public.pipeline_health (
  id uuid primary key default gen_random_uuid(),
  run_id uuid,
  pipeline text not null check (pipeline in ('dart', 'news', 'price', 'ai', 'alert')),
  status text not null check (status in ('success', 'warning', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  latency_ms int,
  error text,
  meta jsonb
);

-- 24h 윈도우 집계 (`/admin/settings/health` 성공률 계산)
create index if not exists pipeline_health_pipeline_started_idx
  on public.pipeline_health (pipeline, started_at desc);

-- error tail(24h) 쿼리용 — 최근 실패만 빠르게
create index if not exists pipeline_health_failed_recent_idx
  on public.pipeline_health (started_at desc)
  where status = 'failed';

alter table public.pipeline_health enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pipeline_health'
      and policyname = 'pipeline_health admin all'
  ) then
    create policy "pipeline_health admin all"
      on public.pipeline_health
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §2. news_event — M12 뉴스 분류기 결과 적재 (Critical/Warning/Info)
-- ============================================================================
-- 네이버 뉴스 API 1차 + 어드민 지정 매체 스크래핑(S6 컴플라이언스 정비) 2차로 수집.
-- classification_reason = 분류기 1줄 근거 (R3.10-3). Critical만 AlertEvent 발행.
-- UNIQUE(url) — 동일 URL 중복 적재 방지.
create table if not exists public.news_event (
  id uuid primary key default gen_random_uuid(),
  ticker text, -- null = 시장 전체 뉴스
  severity text not null check (severity in ('critical', 'warning', 'info')),
  title text not null,
  source text not null,
  url text not null,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  classification_reason text,
  raw jsonb
);

create unique index if not exists news_event_url_uniq on public.news_event (url);
create index if not exists news_event_severity_published_idx
  on public.news_event (severity, published_at desc);
create index if not exists news_event_ticker_published_idx
  on public.news_event (ticker, published_at desc)
  where ticker is not null;

alter table public.news_event enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'news_event'
      and policyname = 'news_event admin all'
  ) then
    create policy "news_event admin all"
      on public.news_event
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §3. briefing_log — E7 모닝 브리핑 발송 기록 (M11, R3.9-1~5)
-- ============================================================================
-- date UNIQUE — 1일 1건. sent_channels 배열에 'telegram'·'email'·'dashboard' 등 저장.
-- generation_failed=true 시 briefing_failed AlertEvent 연계.
create table if not exists public.briefing_log (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  content_summary text not null,
  generated_at timestamptz not null default now(),
  sent_channels text[] not null default '{}',
  generation_failed boolean not null default false
);

create unique index if not exists briefing_log_date_uniq on public.briefing_log (date);
create index if not exists briefing_log_generated_idx on public.briefing_log (generated_at desc);

alter table public.briefing_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'briefing_log'
      and policyname = 'briefing_log admin all'
  ) then
    create policy "briefing_log admin all"
      on public.briefing_log
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §4. briefing_view_event — IM-4 참여율 측정 (브리핑 열람 로그)
-- ============================================================================
-- UNIQUE(briefing_id, admin_id, channel) — 동일 브리핑·채널 중복 기록 방지.
create table if not exists public.briefing_view_event (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.briefing_log(id) on delete cascade,
  admin_id uuid not null,
  channel text not null,
  viewed_at timestamptz not null default now()
);

create unique index if not exists briefing_view_event_dedupe
  on public.briefing_view_event (briefing_id, admin_id, channel);
create index if not exists briefing_view_event_briefing_idx
  on public.briefing_view_event (briefing_id);

alter table public.briefing_view_event enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'briefing_view_event'
      and policyname = 'briefing_view_event admin all'
  ) then
    create policy "briefing_view_event admin all"
      on public.briefing_view_event
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §X. 설명 (mock 주입 위치 · 타입 매핑)
-- ============================================================================
-- pipeline_health mock: src/lib/data/mock-admin-pipeline-health.ts (T5a.4).
-- news_event mock: src/lib/data/mock-admin-news.ts (T5a.3).
-- briefing_log mock: src/lib/data/mock-admin-briefings.ts 확장 (T5a.2).
-- AlertType 확장(news_warning·briefing_failed)은 타입 파일(src/types/admin.ts)에서만 변경 —
--   기존 alert_event 테이블은 text 컬럼이라 SQL 변경 불필요 (S3 0004 §9의 확인 룰에만 영향).
-- S5b에서 M13·M14 · M15 관련 스키마 추가 예정 (0007_s5b_notifications 가칭).
