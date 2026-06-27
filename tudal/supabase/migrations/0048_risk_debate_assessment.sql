-- migration: 0048_risk_debate_assessment
-- purpose: G3 Risk 3자 토론(공격/보존/중립) — portfolio Accept 전 위험 재판정 advisory layer (D33).
-- ref: docs/superpowers/specs/2026-06-28-g3-risk-debate.md
-- 가드레일: advisory/비강제(Accept 게이트 substitute 아님 — is_advisory always true CHECK)
--           · 포트 구성당 1회(month UNIQUE = cost cap, 거래별 아님) · 범주 분리(M12a/G1/합의배지와 별 테이블).
-- 선행: 없음(독립; portfolio_proposal_id는 nullable FK 미설정 — 느슨 참조).
--
-- DORMANT (USER apply-only): 코드 flag RISK_DEBATE_ENABLED off → 평가 0 → empty table.

create table if not exists public.risk_debate_assessment (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$'),
  created_at timestamptz not null default now(),
  portfolio_proposal_id uuid,  -- 평가 대상 포트(느슨 참조, nullable).
  final_verdict text not null check (final_verdict in ('pass', 'conditional', 'reject')),
  votes jsonb not null default '[]'::jsonb,  -- 3 stance 판정(aggressive/conservative/neutral).
  summary text not null default '',
  -- 비강제 박제: 항상 advisory(Accept 차단/대체 아님). false 삽입 불가.
  is_advisory boolean not null default true check (is_advisory),
  -- 포트 구성당 1회(cost cap). 재실행 idempotent skip.
  constraint risk_debate_month_uniq unique (month)
);

alter table public.risk_debate_assessment enable row level security;

drop policy if exists "risk_debate_assessment admin all" on public.risk_debate_assessment;
create policy "risk_debate_assessment admin all"
  on public.risk_debate_assessment
  for all
  using (public.is_admin())
  with check (public.is_admin());
