-- ============================================================================
-- 0043_reflection_log.sql
-- purpose: PR-K Reflection(AI 자가 학습) durable 회고 로그 — track별·페르소나별 적중률·
--   평균 실현 수익률·주입한 prompt context 스냅샷. cost_log와 분리(별 테이블).
--   SoT: docs/superpowers/specs/2026-06-27-reflection-prk-build.md §2 + 2026-06-24-reflection-prk-pre-launch-promotion.md (D32).
--   DORMANT(USER apply-only) — Reflection job은 flag(REFLECTION_ENABLED) off면 미호출이라 미적용도 안전.
--   회고지 예측 아님(retrospective) — reflection_kind CHECK로 박제. NO-CONFIG-PASSES/예측 claim 영구 금지.
--   단일 테이블 service-role upsert → SECURITY DEFINER RPC 불요(0042 m12a 패턴).
-- ============================================================================

create table if not exists public.reflection_log (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$'),  -- YYYY-MM-01 (회계/감사 정합)
  track text not null check (track in ('short','midlong')),
  period_key text not null check (period_key ~ '^[sm]:'),  -- 's:YYYY-MM-DD' | 'm:YYYY-MM' (회고 대상 사이클; idempotency 키 일부라 malformed 차단)
  finalized_at timestamptz not null,             -- 대상 run의 finalize 시각
  reflection_kind text not null default 'retrospective'
    check (reflection_kind = 'retrospective'),   -- 예측 아님 박제(코드+DB 양면)
  selected_count int not null check (selected_count >= 0),
  priced_count int not null check (priced_count >= 0 and priced_count <= selected_count),
  overall_hit_rate numeric(6,4)
    check (overall_hit_rate is null or (overall_hit_rate >= 0 and overall_hit_rate <= 1)),
  overall_avg_realized_return numeric(12,6),     -- 손실 가능 → 음수 허용(CHECK 없음)
  per_persona_metrics jsonb not null,            -- PersonaReflectionMetric[] (적중률·가중수익·표본)
  injected_context_snapshot text,                -- 주입한(될) 회고 컨텍스트 스냅샷(감사)
  price_source text check (price_source is null or price_source = 'KRX_EOD'),
  price_basis_entry_date text
    check (price_basis_entry_date is null or price_basis_entry_date ~ '^[0-9]{8}$'),
  price_basis_current_date text
    check (price_basis_current_date is null or price_basis_current_date ~ '^[0-9]{8}$'),
  created_at timestamptz not null default now(),
  unique (month, track, period_key)              -- idempotent upsert 키
);

create index if not exists reflection_log_track_period_idx
  on public.reflection_log (track, period_key, created_at desc);
create index if not exists reflection_log_month_idx on public.reflection_log (month);

alter table public.reflection_log enable row level security;

-- RLS: admin all (authenticated + is_admin), 0042 m12a_ticker_assessment 패턴.
--   cron = service-role(RLS 우회). 단일 테이블 upsert → SECURITY DEFINER RPC 불요. cost_log와 무관(분리).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reflection_log'
      and policyname = 'reflection_log admin all'
  ) then
    create policy "reflection_log admin all"
      on public.reflection_log
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

comment on table public.reflection_log is
  'PR-K Reflection(AI 자가 학습) durable 회고 로그(track별 페르소나 적중률·실현 수익률·주입 컨텍스트 스냅샷). reflection_kind=retrospective(예측 아님). shadow-first: REFLECTION_ENABLED off면 미기록. cost_log와 분리.';
