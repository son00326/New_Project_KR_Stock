#!/usr/bin/env bash
# pg_smoke_0046.sh — docker-free local PG16 smoke for get_tier0_shadow_arm_top RPC (0046).
#   Asserts: is_admin self-gate · arm allowlist(sector-hard-gate 제외) · period_key 검증
#   · arm/rank 필터 + 정렬 · grant matrix(authenticated yes / anon·public no) · rollback clean.
#   minimal tier0_candidates_150_shadow stub(0039 subset). Requires LOCAL PostgreSQL. NOT production.
set -euo pipefail

if [[ "${PG_SMOKE_ALLOW_REMOTE:-}" != "1" ]]; then
  if [[ -n "${PGSERVICE:-}" ]]; then
    echo "Refusing pg smoke with PGSERVICE=${PGSERVICE}; set PG_SMOKE_ALLOW_REMOTE=1 to override" >&2
    exit 2
  fi
  case "${PGHOST:-}" in
    ""|localhost|127.0.0.1|::1|/*) ;;
    *)
      echo "Refusing pg smoke with non-local PGHOST=${PGHOST}; set PG_SMOKE_ALLOW_REMOTE=1 to override" >&2
      exit 2
      ;;
  esac
fi
DB="pg_smoke_0046_$$"
cleanup() { dropdb --if-exists "$DB" 2>/dev/null || true; }
trap cleanup EXIT
createdb "$DB"

psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create function public.is_admin() returns boolean language sql stable as $f$ select true $f$;
create table public.tier0_candidates_150_shadow (
  id uuid primary key default gen_random_uuid(),
  period_key text not null,
  arm text not null,
  ticker text not null,
  name text,
  sector text not null,
  bucket text not null,
  rank int not null,
  tier0_score numeric(12,2)
);
-- seed: sector-soft-tilt 12 rows (rank 1..12 in 'short') + production-mirror 3 rows.
insert into public.tier0_candidates_150_shadow(period_key, arm, ticker, name, sector, bucket, rank, tier0_score)
select '2026-06', 'sector-soft-tilt', lpad((100000 + g)::text, 6, '0'), 'N'||g, '반도체', 'short', g, 90 - g
from generate_series(1, 12) g;
insert into public.tier0_candidates_150_shadow(period_key, arm, ticker, name, sector, bucket, rank, tier0_score)
values ('2026-06','production-mirror','005930','삼성전자','반도체','short',1,99);
SQL

MIG="$(dirname "$0")/../tudal/supabase/migrations"
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0046_tier0_shadow_arm_read.sql"

psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$
declare
  v jsonb;
  v_failed boolean;
begin
  -- 1) happy: sector-soft-tilt top-10 → 10 rows, arm-scoped, ordered, rank<=10.
  v := public.get_tier0_shadow_arm_top('sector-soft-tilt', '2026-06', 10);
  if jsonb_array_length(v) <> 10 then raise exception 'FAIL: expected 10 rows (got %)', jsonb_array_length(v); end if;
  if (v->0->>'rank')::int <> 1 then raise exception 'FAIL: not ordered by rank'; end if;
  if (v->0->>'ticker') = '005930' then raise exception 'FAIL: leaked production-mirror arm'; end if;

  -- 2) rank cut: limit 5 → 5 rows.
  v := public.get_tier0_shadow_arm_top('sector-soft-tilt', '2026-06', 5);
  if jsonb_array_length(v) <> 5 then raise exception 'FAIL: limit 5 expected 5 (got %)', jsonb_array_length(v); end if;

  -- 3) production-mirror arm allowed.
  v := public.get_tier0_shadow_arm_top('production-mirror', '2026-06', 10);
  if jsonb_array_length(v) <> 1 then raise exception 'FAIL: production-mirror expected 1'; end if;

  -- 4) sector-hard-gate → invalid_arm (soft only).
  v_failed := false;
  begin v := public.get_tier0_shadow_arm_top('sector-hard-gate', '2026-06', 10);
  exception when others then v_failed := (sqlerrm like '%invalid_arm%'); end;
  if not v_failed then raise exception 'FAIL: sector-hard-gate should be rejected (invalid_arm)'; end if;

  -- 5) bad period_key → invalid_period_key.
  v_failed := false;
  begin v := public.get_tier0_shadow_arm_top('sector-soft-tilt', '2026/06', 10);
  exception when others then v_failed := (sqlerrm like '%invalid_period_key%'); end;
  if not v_failed then raise exception 'FAIL: bad period_key should be rejected'; end if;

  -- 6) empty period → [] (fail-soft, not error).
  v := public.get_tier0_shadow_arm_top('sector-soft-tilt', '2099-01', 10);
  if v <> '[]'::jsonb then raise exception 'FAIL: missing period should return [] (got %)', v; end if;

  raise notice 'PASS: 0046 get_tier0_shadow_arm_top — filter/order/arm-allowlist/period (6 groups)';
end $$;
SQL

# 7) is_admin self-gate: non-admin → admin_required.
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
create or replace function public.is_admin() returns boolean language sql stable as $f$ select false $f$;
do $$
declare v jsonb; v_failed boolean := false;
begin
  begin v := public.get_tier0_shadow_arm_top('sector-soft-tilt', '2026-06', 10);
  exception when others then v_failed := (sqlerrm like '%admin_required%'); end;
  if not v_failed then raise exception 'FAIL: non-admin should be rejected (admin_required)'; end if;
  raise notice 'PASS: 0046 is_admin self-gate';
end $$;
create or replace function public.is_admin() returns boolean language sql stable as $f$ select true $f$;
SQL

# 8) grant matrix: authenticated EXECUTE yes / anon·public no.
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$ begin
  if not has_function_privilege('authenticated', 'public.get_tier0_shadow_arm_top(text, text, int)', 'EXECUTE') then
    raise exception 'FAIL: authenticated should have EXECUTE';
  end if;
  if has_function_privilege('anon', 'public.get_tier0_shadow_arm_top(text, text, int)', 'EXECUTE') then
    raise exception 'FAIL: anon should NOT have EXECUTE';
  end if;
  if has_function_privilege('public', 'public.get_tier0_shadow_arm_top(text, text, int)', 'EXECUTE') then
    raise exception 'FAIL: public should NOT have EXECUTE';
  end if;
  raise notice 'PASS: 0046 grant matrix';
end $$;
SQL

psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0046_tier0_shadow_arm_read.rollback.sql"
psql -v ON_ERROR_STOP=1 -d "$DB" -c "do \$\$ begin if exists (select 1 from pg_proc where proname='get_tier0_shadow_arm_top') then raise exception 'FAIL: rollback did not drop'; end if; raise notice 'PASS: 0046 rollback clean'; end \$\$;"

echo "ALL_0046_SMOKE_PASS"
