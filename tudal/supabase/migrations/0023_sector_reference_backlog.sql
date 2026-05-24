-- migration: 0023_sector_reference_backlog
-- purpose: PR3c — Group G Level A 12 sector body reference 부족 lazy 추적 (사용자 lock-in §1.7).
-- SoT: docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md (v6, omxy R6 CONVERGED, 누적 21 BLOCKERS)
-- ref: 0017 commit_persona_eval + 0021 acquire_batch_lock_v2 패턴 follow (SECURITY DEFINER + 4-grant + service_role 우회)
--
-- B16 + B18 fix: table CHECK으로 canonical 14 sector DB invariant.
-- B2 fix: atomic RPC insert_or_bump_sector_backlog (race-safe upsert).
-- B10 fix: v_caller_role text := auth.role() declare + null/role 양체크 (service_role uid-null 허용).
-- (l) fix: outer declare 평탄화.

create table public.sector_reference_backlog (
  id uuid primary key default gen_random_uuid(),
  -- B18 fix (omxy R4): table CHECK으로 canonical 14 sector DB invariant.
  -- TS canonical-sectors.ts CANONICAL_SECTORS와 drift catch는 contract test에서.
  sector text not null check (sector in (
    '바이오', '반도체', '건설', '금융', '2차전지', '자동차',
    'IT/SW', '유통/소비재', '에너지', '엔터/미디어', '통신',
    '철강/소재', '운송/물류', '보험/증권'
  )),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'archived')),
  first_requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count >= 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sector_reference_backlog_sector_unique unique (sector)
);

create index sector_reference_backlog_status_idx on public.sector_reference_backlog(status);

alter table public.sector_reference_backlog enable row level security;

-- 4-grant: revoke public + revoke anon + grant authenticated + grant service_role
revoke all on public.sector_reference_backlog from public;
revoke all on public.sector_reference_backlog from anon;
grant select on public.sector_reference_backlog to authenticated;
grant select on public.sector_reference_backlog to service_role;

-- read-only via RLS (insert/update는 RPC만 — privilege 격리).
-- Track 2 C1 fix (gsd-deep): defense-in-depth — service_role SELECT path 명시 (0017 pattern 정합).
-- service_role JWT는 PostgREST에서 RLS bypass되지만 직접 PL/pgSQL 호출 path는 차단 가능.
create policy "admin select" on public.sector_reference_backlog
  for select using (public.is_admin() or (select auth.role()) = 'service_role');

comment on table public.sector_reference_backlog is
  'Level A sector body reference 부족 lazy 추적 (Group G PR3c). 첫 풀 리포트 작성 시 atomic RPC insert_or_bump_sector_backlog 호출.';

-- B2 fix: atomic RPC — supabase JS upsert 대신 SQL ON CONFLICT DO UPDATE으로 race-safe.
-- B10 fix (omxy R2): v_caller_role text := auth.role() declare + service_role uid-null 허용 (0021 패턴).
-- B18 fix (omxy R4): trim(p_sector) + canonical 14 not in raise (helper-level과 양쪽 DB invariant).
-- (l) fix (omxy R5): outer declare 평탄화 (가독성).
create or replace function public.insert_or_bump_sector_backlog(p_sector text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_role text := auth.role();
  v_caller text;
  v_sector text;
begin
  -- B10 fix: service_role 호출은 auth.uid() null OK → role check 우선
  if auth.uid() is null and coalesce(v_caller_role, '') <> 'service_role' then
    raise exception 'auth_unavailable';
  end if;
  v_caller := coalesce(v_caller_role, '');
  if not (public.is_admin() or v_caller = 'service_role') then
    raise exception 'admin_required';
  end if;
  if p_sector is null then
    raise exception 'invalid_sector';
  end if;
  v_sector := trim(p_sector);
  if v_sector = '' then
    raise exception 'invalid_sector';
  end if;
  if v_sector not in (
    '바이오', '반도체', '건설', '금융', '2차전지', '자동차',
    'IT/SW', '유통/소비재', '에너지', '엔터/미디어', '통신',
    '철강/소재', '운송/물류', '보험/증권'
  ) then
    raise exception 'invalid_sector_not_canonical';
  end if;

  insert into public.sector_reference_backlog (sector, status, request_count)
  values (v_sector, 'pending', 1)
  on conflict (sector) do update
    set request_count = sector_reference_backlog.request_count + 1,
        last_requested_at = now(),
        updated_at = now();
end;
$$;

-- 4-grant for RPC
revoke all on function public.insert_or_bump_sector_backlog(text) from public;
revoke all on function public.insert_or_bump_sector_backlog(text) from anon;
grant execute on function public.insert_or_bump_sector_backlog(text) to authenticated;
grant execute on function public.insert_or_bump_sector_backlog(text) to service_role;
