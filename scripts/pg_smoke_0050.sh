#!/usr/bin/env bash
# pg_smoke_0050.sh — docker-free local PG smoke for tier0_candidates_150.factor_ranks (0050).
#   Asserts: additive jsonb NULL column · 기존 rows/제약(0028) 무영향 · RLS/policy 무변경
#   · idempotent re-apply · rollback = 컬럼만 제거 — row/테이블 보존, 단 factor_ranks '값'은 소실(활성 후 rollback=계측 데이터 손실).
#   Requires LOCAL PostgreSQL. NOT production.
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
DB="pg_smoke_0050_$$"
cleanup() { dropdb --if-exists "$DB" 2>/dev/null || true; }
trap cleanup EXIT
createdb "$DB"

psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
create function public.is_admin() returns boolean language sql stable as $f$ select current_user = 'authenticated' $f$;
SQL

MIG="$(dirname "$0")/../tudal/supabase/migrations"
# 대상 테이블 부트스트랩 (0028) → 0050 apply.
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0028_tier0_candidates_150.sql"
psql -v ON_ERROR_STOP=1 -d "$DB" -c "insert into public.tier0_candidates_150(month, ticker, name, sector, bucket, rank, tier0_score)
  values ('2026-06-01', '005930', '삼성전자', '반도체', 'short', 1, 88.5);"
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0050_tier0_factor_ranks.sql"

psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$
declare v_count int; v_type text; v_nullable text; v_failed boolean;
begin
  -- 1) 컬럼 존재 + jsonb + NULL 허용 (additive 계약).
  select data_type, is_nullable into v_type, v_nullable
  from information_schema.columns
  where table_schema='public' and table_name='tier0_candidates_150' and column_name='factor_ranks';
  if v_type is distinct from 'jsonb' then raise exception 'FAIL: factor_ranks type % (want jsonb)', v_type; end if;
  if v_nullable is distinct from 'YES' then raise exception 'FAIL: factor_ranks must be nullable'; end if;

  -- 2) 기존 row(0050 이전 insert) = NULL 유지.
  select count(*) into v_count from public.tier0_candidates_150
  where ticker='005930' and factor_ranks is null;
  if v_count <> 1 then raise exception 'FAIL: pre-existing row factor_ranks should stay NULL (got %)', v_count; end if;

  -- 3) factor_ranks 없이 insert OK (default-off producer payload 그대로).
  insert into public.tier0_candidates_150(month, ticker, name, sector, bucket, rank, tier0_score)
  values ('2026-06-01', '000660', 'SK하이닉스', '반도체', 'short', 2, 87.0);

  -- 4) factor_ranks jsonb insert OK (opt-in payload).
  insert into public.tier0_candidates_150(month, ticker, name, sector, bucket, rank, tier0_score, factor_ranks)
  values ('2026-06-01', '042660', '한화오션', '운송/물류', 'short', 3, 86.0,
          '{"trend": 91.2, "foreign": 50.0, "earnings": 50.0, "quality": 50.0, "size": 72.4}'::jsonb);
  select count(*) into v_count from public.tier0_candidates_150
  where ticker='042660' and (factor_ranks->>'trend')::numeric = 91.2;
  if v_count <> 1 then raise exception 'FAIL: factor_ranks jsonb roundtrip (got %)', v_count; end if;

  -- 5) 기존 제약(0028) 무영향 — 비-canonical sector 여전히 CHECK reject.
  v_failed := false;
  begin
    insert into public.tier0_candidates_150(month, ticker, name, sector, bucket, rank, tier0_score)
    values ('2026-06-01', '111111', 'x', '미분류', 'short', 4, 1.0);
  exception when check_violation then v_failed := true; end;
  if not v_failed then raise exception 'FAIL: 0028 sector canonical CHECK should still reject'; end if;

  -- 6) unique(month,ticker) 무영향.
  v_failed := false;
  begin
    insert into public.tier0_candidates_150(month, ticker, name, sector, bucket, rank, tier0_score)
    values ('2026-06-01', '005930', 'dup', '반도체', 'mid', 1, 1.0);
  exception when unique_violation then v_failed := true; end;
  if not v_failed then raise exception 'FAIL: 0028 unique(month,ticker) should still reject'; end if;

  -- 7) RLS 여전히 enabled + 정책 무변경 (0028 admin all 1개 그대로).
  select relrowsecurity into v_failed from pg_class where relname='tier0_candidates_150';
  if not v_failed then raise exception 'FAIL: RLS not enabled'; end if;
  select count(*) into v_count from pg_policies
  where schemaname='public' and tablename='tier0_candidates_150';
  if v_count <> 1 then raise exception 'FAIL: policy count changed (got %, want 1)', v_count; end if;

  raise notice 'PASS: 0050 factor_ranks — 7 assertions';
end $$;
SQL

# idempotent re-apply (add column if not exists).
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0050_tier0_factor_ranks.sql"
psql -v ON_ERROR_STOP=1 -d "$DB" -c "do \$\$ begin raise notice 'PASS: 0050 idempotent re-apply'; end \$\$;"

# rollback = 컬럼만 제거 — row/테이블 보존, factor_ranks 값은 소실(omxy mig R1 정밀화).
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0050_tier0_factor_ranks.rollback.sql"
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$
declare v_count int;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tier0_candidates_150' and column_name='factor_ranks'
  ) then raise exception 'FAIL: rollback did not drop factor_ranks'; end if;
  if not exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='tier0_candidates_150'
  ) then raise exception 'FAIL: rollback must not drop table'; end if;
  select count(*) into v_count from public.tier0_candidates_150;
  if v_count <> 3 then raise exception 'FAIL: rollback lost rows (got %, want 3)', v_count; end if;
  raise notice 'PASS: 0050 rollback clean (column-only — rows/table preserved; factor_ranks VALUES are LOST on drop)';
end $$;
SQL

echo "ALL_0050_SMOKE_PASS"
