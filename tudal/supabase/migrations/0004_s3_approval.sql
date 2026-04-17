-- migration: 0004_s3_approval
-- purpose: S3 킥오프 — M7 승인 워크플로우 + D15 게이팅 3종 + BL-20 자동 바이패스
-- ref: Document/Service/Planning/ServicePlan-Admin.md §3.3 R3.3-1~10 · §4.2 E4·E11
-- blocker resolution (2026-04-17):
--   BL-7  = A (자유 텍스트 min 20자) — E4.dispute_reason 컬럼 + length 체크
--   BL-19 = D (pykrx seed → kr_business_days 캐시) — 2024~2026 수기, 2027~2030 placeholder
--   BL-20 = A (자동 바이패스 + gating_auto_relief AlertEvent) — E4.gating_auto_relief_active
-- 선행: 0002 (is_admin 헬퍼·admin_emails·short_list_30), 0003 (stock_reports·report_view_log)


-- ============================================================================
-- §1. E4 PortfolioApproval — 승인 이벤트 (실 생성, v1.2 reportViewCount 제외)
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
  -- BL-7 A: 이의 제기 사유 자유 텍스트. min 20자는 앱(서버 액션)에서 1차 검증,
  -- DB는 length NULL 예외만 가드. 3인 소통 체제이므로 분류 enum 불필요.
  dispute_raised_at timestamptz,
  dispute_raised_by uuid references auth.users(id) on delete restrict,
  dispute_reason text,
  dispute_resolved_at timestamptz,
  -- BL-20 A: 7일 연속 단일 admin_id 접속 감지 시 D15 2인 게이팅 자동 바이패스.
  -- 활성화 순간의 AlertEvent(type=gating_auto_relief) 행과 1:N 매칭 (FK는 제약 없음).
  gating_auto_relief_active boolean not null default false,
  -- T3.4: Reject → 재분석 큐 1회 허용. 재분석본 Reject 시 전월 포트 유지(앱 로직).
  reanalysis_count int not null default 0 check (reanalysis_count <= 1)
);

-- dispute_reason이 제출될 때만 min 20자 보장 (NULL은 자유)
alter table public.portfolio_approval
  add constraint portfolio_approval_dispute_reason_min_len
  check (dispute_reason is null or length(dispute_reason) >= 20);

-- §4.2 P5 I-08: 월당 is_final=true 1건만 (선착순 race condition 방어, R3)
create unique index if not exists portfolio_approval_final_month_uniq
  on public.portfolio_approval (month)
  where is_final = true;

-- 월별 이벤트 목록 조회
create index if not exists portfolio_approval_month_idx
  on public.portfolio_approval (month);

alter table public.portfolio_approval enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'portfolio_approval'
      and policyname = 'portfolio_approval admin all'
  ) then
    create policy "portfolio_approval admin all"
      on public.portfolio_approval
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §2. E11 kr_business_days — 한국 영업일 캘린더 (BL-19 D 옵션)
-- ============================================================================
create table if not exists public.kr_business_days (
  date date primary key,
  is_business_day boolean not null,
  holiday_name text
);

-- D+5 영업일 카운터 쿼리 최적화 (WHERE is_business_day=true AND date>=? 범위 스캔)
create index if not exists kr_business_days_business_idx
  on public.kr_business_days (date)
  where is_business_day = true;

alter table public.kr_business_days enable row level security;

-- 영업일 캘린더는 민감 정보 아님 — admin 전체에게 읽기만 허용. 쓰기는 service_role.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'kr_business_days'
      and policyname = 'kr_business_days admin read'
  ) then
    create policy "kr_business_days admin read"
      on public.kr_business_days
      for select
      to authenticated
      using (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §3. 2024-2030 Seed: 주말 자동 판정 (ISO 월=1 ~ 일=7)
--     평일 공휴일은 §4에서 수기 UPDATE (2024~2026 high confidence)
--     2027~2030은 주말만 반영 — S5 M10 pykrx batch가 평일 공휴일 덮어씀
-- ============================================================================
insert into public.kr_business_days (date, is_business_day)
select
  d::date,
  extract(isodow from d)::int < 6
from generate_series('2024-01-01'::date, '2030-12-31'::date, '1 day'::interval) as d
on conflict (date) do nothing;


-- ============================================================================
-- §4. 2024-2026 공휴일 수기 UPDATE (high confidence)
--     출처: 대한민국 정부 공식 공휴일 + KRX 연말 휴장 관행
--     주말과 겹친 공휴일은 §3에서 이미 주말로 마킹됨 — 여기서는 평일 공휴일만 overwrite.
-- ============================================================================

-- 2024년 -----------------------------------------------------------------
update public.kr_business_days set is_business_day = false, holiday_name = '신정' where date = '2024-01-01';
update public.kr_business_days set is_business_day = false, holiday_name = '설날 연휴' where date = '2024-02-09';
update public.kr_business_days set is_business_day = false, holiday_name = '대체공휴일(설날)' where date = '2024-02-12';
update public.kr_business_days set is_business_day = false, holiday_name = '삼일절' where date = '2024-03-01';
update public.kr_business_days set is_business_day = false, holiday_name = '제22대 국회의원 선거' where date = '2024-04-10';
update public.kr_business_days set is_business_day = false, holiday_name = '대체공휴일(어린이날)' where date = '2024-05-06';
update public.kr_business_days set is_business_day = false, holiday_name = '석가탄신일' where date = '2024-05-15';
update public.kr_business_days set is_business_day = false, holiday_name = '현충일' where date = '2024-06-06';
update public.kr_business_days set is_business_day = false, holiday_name = '광복절' where date = '2024-08-15';
update public.kr_business_days set is_business_day = false, holiday_name = '추석 연휴' where date = '2024-09-16';
update public.kr_business_days set is_business_day = false, holiday_name = '추석' where date = '2024-09-17';
update public.kr_business_days set is_business_day = false, holiday_name = '추석 연휴' where date = '2024-09-18';
update public.kr_business_days set is_business_day = false, holiday_name = '국군의 날(임시공휴일)' where date = '2024-10-01';
update public.kr_business_days set is_business_day = false, holiday_name = '개천절' where date = '2024-10-03';
update public.kr_business_days set is_business_day = false, holiday_name = '한글날' where date = '2024-10-09';
update public.kr_business_days set is_business_day = false, holiday_name = '크리스마스' where date = '2024-12-25';
update public.kr_business_days set is_business_day = false, holiday_name = '연말 휴장' where date = '2024-12-31';

-- 2025년 -----------------------------------------------------------------
update public.kr_business_days set is_business_day = false, holiday_name = '신정' where date = '2025-01-01';
update public.kr_business_days set is_business_day = false, holiday_name = '임시공휴일(설 전날)' where date = '2025-01-27';
update public.kr_business_days set is_business_day = false, holiday_name = '설날 연휴' where date = '2025-01-28';
update public.kr_business_days set is_business_day = false, holiday_name = '설날' where date = '2025-01-29';
update public.kr_business_days set is_business_day = false, holiday_name = '설날 연휴' where date = '2025-01-30';
update public.kr_business_days set is_business_day = false, holiday_name = '대체공휴일(삼일절)' where date = '2025-03-03';
update public.kr_business_days set is_business_day = false, holiday_name = '어린이날·석가탄신일' where date = '2025-05-05';
update public.kr_business_days set is_business_day = false, holiday_name = '대체공휴일(어린이날·석가탄신일)' where date = '2025-05-06';
update public.kr_business_days set is_business_day = false, holiday_name = '제21대 대통령 선거' where date = '2025-06-03';
update public.kr_business_days set is_business_day = false, holiday_name = '현충일' where date = '2025-06-06';
update public.kr_business_days set is_business_day = false, holiday_name = '광복절' where date = '2025-08-15';
update public.kr_business_days set is_business_day = false, holiday_name = '개천절' where date = '2025-10-03';
update public.kr_business_days set is_business_day = false, holiday_name = '추석' where date = '2025-10-06';
update public.kr_business_days set is_business_day = false, holiday_name = '추석 연휴' where date = '2025-10-07';
update public.kr_business_days set is_business_day = false, holiday_name = '대체공휴일(추석)' where date = '2025-10-08';
update public.kr_business_days set is_business_day = false, holiday_name = '한글날' where date = '2025-10-09';
update public.kr_business_days set is_business_day = false, holiday_name = '크리스마스' where date = '2025-12-25';
update public.kr_business_days set is_business_day = false, holiday_name = '연말 휴장' where date = '2025-12-31';

-- 2026년 -----------------------------------------------------------------
-- 현재 운영 연도. CAP Months·D+5 카운터·M10 배치 기준.
update public.kr_business_days set is_business_day = false, holiday_name = '신정' where date = '2026-01-01';
update public.kr_business_days set is_business_day = false, holiday_name = '설날 연휴' where date = '2026-02-16';
update public.kr_business_days set is_business_day = false, holiday_name = '설날' where date = '2026-02-17';
update public.kr_business_days set is_business_day = false, holiday_name = '설날 연휴' where date = '2026-02-18';
update public.kr_business_days set is_business_day = false, holiday_name = '대체공휴일(삼일절)' where date = '2026-03-02';
update public.kr_business_days set is_business_day = false, holiday_name = '어린이날' where date = '2026-05-05';
update public.kr_business_days set is_business_day = false, holiday_name = '대체공휴일(석가탄신일)' where date = '2026-05-25';
update public.kr_business_days set is_business_day = false, holiday_name = '제9회 전국동시지방선거' where date = '2026-06-03';
update public.kr_business_days set is_business_day = false, holiday_name = '대체공휴일(광복절)' where date = '2026-08-17';
update public.kr_business_days set is_business_day = false, holiday_name = '추석 연휴' where date = '2026-09-24';
update public.kr_business_days set is_business_day = false, holiday_name = '추석' where date = '2026-09-25';
-- 2026-09-26은 토요일(§3에서 주말 처리). holiday_name만 부여 (is_business_day는 이미 false).
update public.kr_business_days set holiday_name = '추석 연휴' where date = '2026-09-26';
update public.kr_business_days set is_business_day = false, holiday_name = '대체공휴일(개천절)' where date = '2026-10-05';
update public.kr_business_days set is_business_day = false, holiday_name = '한글날' where date = '2026-10-09';
update public.kr_business_days set is_business_day = false, holiday_name = '크리스마스' where date = '2026-12-25';
update public.kr_business_days set is_business_day = false, holiday_name = '연말 휴장' where date = '2026-12-31';

-- 2027~2030 --------------------------------------------------------------
-- ⚠️ 평일 공휴일 미반영. S5 M10 pykrx 월간 배치 또는 scripts/seed_kr_holidays.py 수동 실행으로 덮어쓸 것.
-- S5 이전(2026-12 Exit 검증)에 2027 운영 필요 시 수기 보강 권장.


-- ============================================================================
-- §5. E6 AlertEvent — 'gating_auto_relief' 타입 추가 (BL-20 A)
-- alert_event 테이블은 S5에서 실제 생성 예정 — 존재할 때만 constraint 확장.
-- ============================================================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'alert_event'
  ) then
    alter table public.alert_event drop constraint if exists alert_event_alert_type_check;
    alter table public.alert_event
      add constraint alert_event_alert_type_check
      check (alert_type in (
        'exit_signal','news_critical','price_anomaly','briefing',
        'scheduler_fail','gating_auto_relief'
      ));
  end if;
end $$;


-- ============================================================================
-- §X. 설명 (mock 주입 위치)
-- ============================================================================
-- portfolio_approval mock fixture는 src/lib/data/mock-admin-portfolio-approval.ts (T3.2 이후).
-- kr_business_days는 seed 후 서버 컴포넌트에서 직접 SELECT (Next.js 16 route handler).
-- 2인 열람 게이팅은 0003 report_view_log의 COUNT(DISTINCT admin_id) 집계로 판정 (G-5 B).
-- BL-20 자동 바이패스 감지는 애플리케이션 레벨 (미들웨어 또는 서버 액션).
