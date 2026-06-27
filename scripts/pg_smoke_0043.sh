#!/usr/bin/env bash
# pg_smoke_0043.sh — docker-free local PG16 smoke for reflection_log (0043).
#   Asserts: table + CHECK constraints (month/track/priced<=selected/hit_rate range/period date fmt/
#   reflection_kind='retrospective') + unique(month,track,period_key) idempotent upsert + RLS enabled
#   + cost_log 분리(독립 테이블) + rollback drops clean.
#   Mirrors pg_smoke_0042 pattern: createdb temp → is_admin stub → apply 0043 → assert → dropdb.
#   Requires a LOCAL running PostgreSQL (createdb/psql on PATH). NOT a production test.
set -euo pipefail
DB="pg_smoke_0043_$$"
cleanup() { dropdb --if-exists "$DB" 2>/dev/null || true; }
trap cleanup EXIT
createdb "$DB"

# minimal dependency schema: is_admin stub (reflection_log RLS policy 참조). 타 테이블 FK 없음(독립).
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
create function public.is_admin() returns boolean language sql stable as $f$ select true $f$;
SQL

MIG="$(dirname "$0")/../tudal/supabase/migrations"
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0043_reflection_log.sql"

# assertions — all server-side (raise exception on failure).
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$
declare
  v_count int;
  v_failed boolean;
  v_snap text;
begin
  -- 1) valid full row (priced) → OK
  insert into public.reflection_log(
    month, track, period_key, finalized_at, selected_count, priced_count,
    overall_hit_rate, overall_avg_realized_return, per_persona_metrics, injected_context_snapshot,
    price_source, price_basis_entry_date, price_basis_current_date
  ) values (
    '2026-06-01', 'short', 's:2026-06-22', now(), 10, 8,
    0.5, 0.0321, '[{"personaId":"p1","sampleSize":8,"hitRate":0.75,"convictionWeightedReturn":0.06,"avgConviction":72}]'::jsonb,
    'ctx', 'KRX_EOD', '20260626', '20260627'
  );

  -- 2) valid no-price fail-soft row (priced 0, null prices, null metrics) → OK
  insert into public.reflection_log(
    month, track, period_key, finalized_at, selected_count, priced_count,
    overall_hit_rate, overall_avg_realized_return, per_persona_metrics, injected_context_snapshot
  ) values (
    '2026-06-01', 'midlong', 'm:2026-06', now(), 20, 0,
    null, null, '[]'::jsonb, ''
  );

  -- 3) reflection_kind default 'retrospective' (예측 아님 박제)
  select count(*) into v_count from public.reflection_log where reflection_kind = 'retrospective';
  if v_count <> 2 then raise exception 'FAIL: reflection_kind default should be retrospective (got %)', v_count; end if;

  -- 4) reflection_kind <> 'retrospective' → CHECK reject (예측 claim 금지)
  v_failed := false;
  begin
    insert into public.reflection_log(month, track, period_key, finalized_at, reflection_kind,
      selected_count, priced_count, per_persona_metrics)
    values ('2026-06-01', 'short', 's:2026-06-29', now(), 'forecast', 1, 0, '[]'::jsonb);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: reflection_kind=forecast should violate CHECK'; end if;

  -- 5) priced_count > selected_count → CHECK reject
  v_failed := false;
  begin
    insert into public.reflection_log(month, track, period_key, finalized_at,
      selected_count, priced_count, per_persona_metrics)
    values ('2026-06-01', 'short', 's:2026-07-06', now(), 5, 6, '[]'::jsonb);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: priced_count>selected_count should violate CHECK'; end if;

  -- 6) overall_hit_rate > 1 → CHECK reject
  v_failed := false;
  begin
    insert into public.reflection_log(month, track, period_key, finalized_at,
      selected_count, priced_count, overall_hit_rate, per_persona_metrics)
    values ('2026-06-01', 'short', 's:2026-07-13', now(), 5, 5, 1.5, '[]'::jsonb);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: overall_hit_rate>1 should violate CHECK'; end if;

  -- 7) bad track enum → CHECK reject
  v_failed := false;
  begin
    insert into public.reflection_log(month, track, period_key, finalized_at,
      selected_count, priced_count, per_persona_metrics)
    values ('2026-06-01', 'weekly', 's:2026-07-20', now(), 5, 5, '[]'::jsonb);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: invalid track should violate CHECK'; end if;

  -- 8) bad month (not YYYY-MM-01) → CHECK reject
  v_failed := false;
  begin
    insert into public.reflection_log(month, track, period_key, finalized_at,
      selected_count, priced_count, per_persona_metrics)
    values ('2026-06', 'short', 's:2026-07-27', now(), 5, 5, '[]'::jsonb);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: malformed month should violate CHECK'; end if;

  -- 9) malformed price_basis_entry_date → CHECK reject
  v_failed := false;
  begin
    insert into public.reflection_log(month, track, period_key, finalized_at,
      selected_count, priced_count, per_persona_metrics, price_source, price_basis_entry_date)
    values ('2026-06-01', 'short', 's:2026-08-03', now(), 5, 5, '[]'::jsonb, 'KRX_EOD', '2026-06-26');
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: malformed price_basis_entry_date should violate CHECK'; end if;

  -- 10) bad price_source → CHECK reject
  v_failed := false;
  begin
    insert into public.reflection_log(month, track, period_key, finalized_at,
      selected_count, priced_count, per_persona_metrics, price_source)
    values ('2026-06-01', 'short', 's:2026-08-10', now(), 5, 5, '[]'::jsonb, 'NAVER');
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: invalid price_source should violate CHECK'; end if;

  -- 11) idempotent upsert: same (month,track,period_key) ON CONFLICT updates (no duplicate row)
  insert into public.reflection_log(month, track, period_key, finalized_at,
    selected_count, priced_count, per_persona_metrics, injected_context_snapshot)
  values ('2026-06-01', 'short', 's:2026-06-22', now(), 10, 9, '[]'::jsonb, 'updated-ctx')
  on conflict (month, track, period_key) do update
    set priced_count = excluded.priced_count, injected_context_snapshot = excluded.injected_context_snapshot;
  select count(*) into v_count from public.reflection_log where period_key = 's:2026-06-22';
  if v_count <> 1 then raise exception 'FAIL: upsert should not duplicate (got %)', v_count; end if;
  select injected_context_snapshot into v_snap from public.reflection_log where period_key = 's:2026-06-22';
  if v_snap <> 'updated-ctx' then raise exception 'FAIL: upsert should update snapshot (got %)', v_snap; end if;

  -- 12) RLS enabled
  select relrowsecurity into v_failed from pg_class where relname = 'reflection_log';
  if not v_failed then raise exception 'FAIL: RLS not enabled on reflection_log'; end if;

  -- 13) cost_log 분리: reflection_log는 cost_log에 의존하지 않음(독립 테이블, FK 0)
  select count(*) into v_count from information_schema.table_constraints
    where table_name = 'reflection_log' and constraint_type = 'FOREIGN KEY';
  if v_count <> 0 then raise exception 'FAIL: reflection_log should have no FK (cost_log/타 테이블 분리, got %)', v_count; end if;

  -- 14) malformed period_key (prefix만 맞고 날짜 형식 불량) → CHECK reject (idempotency 키 보호)
  v_failed := false;
  begin
    insert into public.reflection_log(month, track, period_key, finalized_at,
      selected_count, priced_count, per_persona_metrics)
    values ('2026-06-01', 'short', 's:not-a-date', now(), 1, 0, '[]'::jsonb);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: malformed period_key should violate CHECK'; end if;

  -- 15) write→read 컬럼 round-trip: injected_context_snapshot insert→select 일치(insert↔read 계약)
  select injected_context_snapshot into v_snap from public.reflection_log
    where month='2026-06-01' and track='short' and period_key='s:2026-06-22';
  if v_snap <> 'updated-ctx' then raise exception 'FAIL: injected_context_snapshot round-trip mismatch (got %)', v_snap; end if;

  raise notice 'PASS: 0043 reflection_log — 15 assertions';
end $$;
SQL

# rollback drops table cleanly
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0043_reflection_log.rollback.sql"
psql -v ON_ERROR_STOP=1 -d "$DB" -c "do \$\$ begin if exists (select 1 from information_schema.tables where table_name='reflection_log') then raise exception 'FAIL: rollback did not drop table'; end if; raise notice 'PASS: 0043 rollback clean'; end \$\$;"

echo "ALL_0043_SMOKE_PASS"
