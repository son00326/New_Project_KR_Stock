-- migration: 0047_tier0_funnel_reflection
-- purpose: G1 Tier0 Reflection Lab (D33) — B++ funnel 가중치 champion/challenger 제안 로그(계측 scaffold).
-- ref: docs/superpowers/specs/2026-06-28-g1-tier0-reflection-lab.md
-- 범주 분리: G1(numeric funnel 가중치 회고) ≠ PR-K reflection_log(0043, prompt 주입 회고). 별 테이블·별 타입.
-- 가드레일: diagnostic only · 자동 적용 영구 금지(approve=status 기록만, funnel/production 무변경)
--           · 예측 금지(reflection_kind='funnel_weight_retro' CHECK = retro만) · forward-validate.
-- 선행: 없음(독립).
--
-- DORMANT (USER apply-only): 코드 flag FUNNEL_REFLECTION_ENABLED off → 제안 생성 0 → empty table.

create table if not exists public.tier0_funnel_reflection (
  id uuid primary key default gen_random_uuid(),
  period_key text not null check (
    period_key ~ '^\d{4}-\d{2}$' or period_key ~ '^\d{4}-W\d{2}$'
  ),
  created_at timestamptz not null default now(),
  -- 예측 방지: retro(회고)만 허용. forecast/prediction kind 금지.
  reflection_kind text not null default 'funnel_weight_retro'
    check (reflection_kind = 'funnel_weight_retro'),
  champion_config jsonb not null,    -- 현 B++ funnel 가중치 스냅샷
  challenger_config jsonb not null,  -- 제안 가중치(bounded nudge)
  rationale text not null,
  evidence jsonb not null default '{}'::jsonb,  -- recall@k·factor↔return 상관·size/leader 커버 등 진단치
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  decided_by uuid,
  decided_at timestamptz,
  -- 월/주기당 1 제안(idempotent upsert 키).
  constraint funnel_reflection_period_uniq unique (period_key)
);

alter table public.tier0_funnel_reflection enable row level security;

drop policy if exists "tier0_funnel_reflection admin all" on public.tier0_funnel_reflection;
create policy "tier0_funnel_reflection admin all"
  on public.tier0_funnel_reflection
  for all
  using (public.is_admin())
  with check (public.is_admin());
