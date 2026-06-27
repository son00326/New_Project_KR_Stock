#!/usr/bin/env bash
# pg_smoke_0047.sh — docker-free local PG16 smoke for tier0_funnel_reflection (0047).
#   Asserts: period_key CHECK · reflection_kind retro-only CHECK(예측 금지) · status enum
#   · period UNIQUE(idempotent) · RLS enabled · cost_log/타 테이블 FK 0(독립) · rollback clean.
#   Requires LOCAL PostgreSQL. NOT production.
set -euo pipefail
DB="pg_smoke_0047_$$"
cleanup() { dropdb --if-exists "$DB" 2>/dev/null || true; }
trap cleanup EXIT
createdb "$DB"

psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
create function public.is_admin() returns boolean language sql stable as $f$ select true $f$;
SQL

MIG="$(dirname "$0")/../tudal/supabase/migrations"
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0047_tier0_funnel_reflection.sql"

psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$
declare v_count int; v_failed boolean;
begin
  -- 1) valid proposal → OK (default reflection_kind + status).
  insert into public.tier0_funnel_reflection(period_key, champion_config, challenger_config, rationale, evidence)
  values ('2026-06', '{"trend":0.5}'::jsonb, '{"trend":0.55}'::jsonb, 'trend↔return 양상관 — bounded nudge', '{"recall@30":0.1}'::jsonb);
  select count(*) into v_count from public.tier0_funnel_reflection where reflection_kind='funnel_weight_retro' and status='proposed';
  if v_count <> 1 then raise exception 'FAIL: default kind/status mismatch (got %)', v_count; end if;

  -- 2) weekly period_key OK.
  insert into public.tier0_funnel_reflection(period_key, champion_config, challenger_config, rationale)
  values ('2026-W25', '{}'::jsonb, '{}'::jsonb, 'r');

  -- 3) reflection_kind <> retro → CHECK reject (예측 claim 금지).
  v_failed := false;
  begin
    insert into public.tier0_funnel_reflection(period_key, reflection_kind, champion_config, challenger_config, rationale)
    values ('2026-07', 'forecast', '{}'::jsonb, '{}'::jsonb, 'r');
  exception when check_violation then v_failed := true; end;
  if not v_failed then raise exception 'FAIL: reflection_kind=forecast should violate CHECK'; end if;

  -- 4) bad status → CHECK reject.
  v_failed := false;
  begin
    insert into public.tier0_funnel_reflection(period_key, status, champion_config, challenger_config, rationale)
    values ('2026-08', 'applied', '{}'::jsonb, '{}'::jsonb, 'r');
  exception when check_violation then v_failed := true; end;
  if not v_failed then raise exception 'FAIL: status=applied should violate CHECK (자동 적용 status 금지)'; end if;

  -- 5) malformed period_key → CHECK reject.
  v_failed := false;
  begin
    insert into public.tier0_funnel_reflection(period_key, champion_config, challenger_config, rationale)
    values ('2026/06', '{}'::jsonb, '{}'::jsonb, 'r');
  exception when check_violation then v_failed := true; end;
  if not v_failed then raise exception 'FAIL: malformed period_key should violate CHECK'; end if;

  -- 6) duplicate period_key → UNIQUE reject (월 1 제안).
  v_failed := false;
  begin
    insert into public.tier0_funnel_reflection(period_key, champion_config, challenger_config, rationale)
    values ('2026-06', '{}'::jsonb, '{}'::jsonb, 'dup');
  exception when unique_violation then v_failed := true; end;
  if not v_failed then raise exception 'FAIL: duplicate period_key should violate UNIQUE'; end if;

  -- 7) RLS enabled.
  select relrowsecurity into v_failed from pg_class where relname='tier0_funnel_reflection';
  if not v_failed then raise exception 'FAIL: RLS not enabled'; end if;

  -- 8) 독립 테이블(FK 0 — PR-K reflection_log/cost_log 분리).
  select count(*) into v_count from information_schema.table_constraints
    where table_name='tier0_funnel_reflection' and constraint_type='FOREIGN KEY';
  if v_count <> 0 then raise exception 'FAIL: should have no FK (got %)', v_count; end if;

  raise notice 'PASS: 0047 tier0_funnel_reflection — 8 assertions';
end $$;
SQL

psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0047_tier0_funnel_reflection.rollback.sql"
psql -v ON_ERROR_STOP=1 -d "$DB" -c "do \$\$ begin if exists (select 1 from information_schema.tables where table_name='tier0_funnel_reflection') then raise exception 'FAIL: rollback'; end if; raise notice 'PASS: 0047 rollback clean'; end \$\$;"

echo "ALL_0047_SMOKE_PASS"
