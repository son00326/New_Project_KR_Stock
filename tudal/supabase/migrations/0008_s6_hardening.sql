-- migration: 0008_s6_hardening
-- purpose: S6 킥오프 — M17 cost_log 확장(per-persona·per-section 태깅) + M19 heartbeat_log 신설
-- ref: Document/Service/Planning/ServicePlan-Admin.md §3.12 R3.12-1~3 · R3.12-7~8
-- blocker resolution (2026-04-19, 22차 후속):
--   BL-16 = A (Anthropic /messages 응답 usage 실시간 파싱 + per-persona·per-section 태깅)
--   BL-17 = B (override 토글 권한: 대표 1인) — DB 영향 없음 (앱 레벨 ADMIN_OVERRIDE_EMAIL env)
--   BL-18 = B (견적 임계치 — 실 API 호출 없이 보수적 상한, src/lib/cost/dry-run-estimate.ts 박제)
--   G-3   = B (cost_log·heartbeat_log 인라인 정의, ServicePlan-Admin §4.2 반영은 추후 정비)
-- 선행: 0001 · 0002 · 0003 · 0004 · 0005(cost_log stub) · 0006 · 0007.


-- ============================================================================
-- §1. cost_log 확장 — BL-16 A 태깅 컬럼 추가
-- ============================================================================
-- 0005에서 stub으로 만든 cost_log에 per-persona·per-section·ticker 컬럼 추가.
-- 기존 컬럼(ts·month·model·purpose·tokens_prompt·tokens_completion·cost_krw·meta)은 유지.
-- 실시간 파싱 흐름:
--   1) Anthropic /messages 응답 .usage = { input_tokens, output_tokens }
--   2) toCostLogRecord(...) 변환기에서 KRW 환산 (USD/MTok × 환율 1430)
--   3) INSERT cost_log (purpose·persona_id·section·ticker 태깅)
alter table public.cost_log
  add column if not exists ticker text,
  add column if not exists persona_id text,
  add column if not exists section text;

-- 월별 SUM(cost_krw) 외에 Top 5 기여(M17 R3.12-1) 쿼리 가속:
--   SELECT purpose, SUM(cost_krw) FROM cost_log WHERE month = ? GROUP BY purpose ORDER BY 2 DESC LIMIT 5
create index if not exists cost_log_month_purpose_idx
  on public.cost_log (month, purpose);

-- 페르소나별 비용 회귀 추적 (committee 폭주 시 원인 탐색)
create index if not exists cost_log_persona_month_idx
  on public.cost_log (persona_id, month)
  where persona_id is not null;


-- ============================================================================
-- §2. heartbeat_log — M19 일간 Silent Health 하트비트 (R3.12-7~8)
-- ============================================================================
-- 자정 배치(00:00 KST = 15:00 UTC 전일) 실행:
--   1) 전일 24h 파이프라인 헬스 5종 집계 + Critical AlertEvent 카운트
--   2) status = 'ok' (이상 없음) 또는 'red_alert' (1+ critical 또는 5+ warning)
--   3) 텔레그램 + 이메일 2채널 발송 (BL-12 폐기로 SMS 제외, D10 catch-up = 이메일 1회 재시도)
-- date UNIQUE — 1일 1건. send_failed=true 시 다음 날 batch가 missed_dates 리포트.
create table if not exists public.heartbeat_log (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  status text not null check (status in ('ok', 'red_alert')),
  generated_at timestamptz not null default now(),
  pipeline_summary jsonb not null, -- 5 파이프라인 24h success_rate 스냅샷
  critical_alert_count int not null default 0 check (critical_alert_count >= 0),
  warning_alert_count int not null default 0 check (warning_alert_count >= 0),
  sent_channels text[] not null default '{}',
  send_failed boolean not null default false,
  message text not null
);

create unique index if not exists heartbeat_log_date_uniq on public.heartbeat_log (date);
create index if not exists heartbeat_log_generated_idx on public.heartbeat_log (generated_at desc);
create index if not exists heartbeat_log_status_idx
  on public.heartbeat_log (status, date desc);

alter table public.heartbeat_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'heartbeat_log'
      and policyname = 'heartbeat_log admin all'
  ) then
    create policy "heartbeat_log admin all"
      on public.heartbeat_log
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ============================================================================
-- §3. AlertType 확장 (heartbeat.missing) — 앱 레벨 타입만 (text 컬럼 자체는 free-form)
-- ============================================================================
-- alert_event는 0001 RLS sketch + S5b/S5a에서 text check 없이 자유롭게 적재.
-- M19 D10 발동(2채널 발송 실패) 시 AlertEvent.alertType = 'heartbeat_missing' 적재.
-- 본 마이그레이션은 별도 SQL 변경 없음 — src/types/admin.ts AlertType union에만 추가.


-- ============================================================================
-- §X. 설명 (mock 주입 위치 · 타입 매핑)
-- ============================================================================
-- cost_log mock: src/lib/data/mock-admin-cost-log.ts (M17 dashboard 검증용 fixture).
-- heartbeat_log mock: src/lib/data/mock-admin-heartbeat.ts (M19 history 표시용 fixture).
-- 가격 환산: src/lib/cost/anthropic-pricing.ts (USD/MTok → KRW with USD_TO_KRW=1430).
-- BL-18 견적: src/lib/cost/dry-run-estimate.ts (월간 예상 비용 시나리오 3종: low·base·worst).
-- 40만 hardcap 활성: src/app/(admin)/admin/report/[ticker]/regenerate/actions.ts에서 SELECT SUM(cost_krw) 활성.
