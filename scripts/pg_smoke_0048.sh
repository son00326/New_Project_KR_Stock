#!/usr/bin/env bash
# pg_smoke_0048.sh — docker-free local PG16 smoke for risk_debate_assessment (0048).
#   Asserts: month CHECK · final_verdict enum · is_advisory always-true CHECK(비강제 박제)
#   · month UNIQUE(포트당 1회) · RLS enabled · rollback clean. Requires LOCAL PostgreSQL. NOT production.
set -euo pipefail
DB="pg_smoke_0048_$$"
cleanup() { dropdb --if-exists "$DB" 2>/dev/null || true; }
trap cleanup EXIT
createdb "$DB"

psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
create function public.is_admin() returns boolean language sql stable as $f$ select true $f$;
SQL

MIG="$(dirname "$0")/../tudal/supabase/migrations"
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0048_risk_debate_assessment.sql"

psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$
declare v_count int; v_failed boolean;
begin
  -- 1) valid pass → OK (is_advisory default true).
  insert into public.risk_debate_assessment(month, final_verdict, votes, summary)
  values ('2026-06-01', 'pass', '[{"stance":"aggressive","verdict_vote":"pass"}]'::jsonb, 'ok');
  select count(*) into v_count from public.risk_debate_assessment where is_advisory = true;
  if v_count <> 1 then raise exception 'FAIL: is_advisory default true (got %)', v_count; end if;

  -- 2) conditional + reject verdicts OK.
  insert into public.risk_debate_assessment(month, final_verdict) values ('2026-07-01', 'conditional');
  insert into public.risk_debate_assessment(month, final_verdict) values ('2026-08-01', 'reject');

  -- 3) is_advisory=false → CHECK reject (비강제 박제 — Accept 차단/대체 불가).
  v_failed := false;
  begin
    insert into public.risk_debate_assessment(month, final_verdict, is_advisory)
    values ('2026-09-01', 'pass', false);
  exception when check_violation then v_failed := true; end;
  if not v_failed then raise exception 'FAIL: is_advisory=false should violate CHECK'; end if;

  -- 4) bad final_verdict → CHECK reject.
  v_failed := false;
  begin
    insert into public.risk_debate_assessment(month, final_verdict) values ('2026-10-01', 'block');
  exception when check_violation then v_failed := true; end;
  if not v_failed then raise exception 'FAIL: invalid final_verdict should violate CHECK'; end if;

  -- 5) bad month → CHECK reject.
  v_failed := false;
  begin
    insert into public.risk_debate_assessment(month, final_verdict) values ('2026-06', 'pass');
  exception when check_violation then v_failed := true; end;
  if not v_failed then raise exception 'FAIL: malformed month should violate CHECK'; end if;

  -- 6) duplicate month → UNIQUE reject (포트당 1회 = cost cap).
  v_failed := false;
  begin
    insert into public.risk_debate_assessment(month, final_verdict) values ('2026-06-01', 'reject');
  exception when unique_violation then v_failed := true; end;
  if not v_failed then raise exception 'FAIL: duplicate month should violate UNIQUE'; end if;

  -- 7) RLS enabled.
  select relrowsecurity into v_failed from pg_class where relname='risk_debate_assessment';
  if not v_failed then raise exception 'FAIL: RLS not enabled'; end if;

  raise notice 'PASS: 0048 risk_debate_assessment — 7 assertions';
end $$;
SQL

psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0048_risk_debate_assessment.rollback.sql"
psql -v ON_ERROR_STOP=1 -d "$DB" -c "do \$\$ begin if exists (select 1 from information_schema.tables where table_name='risk_debate_assessment') then raise exception 'FAIL: rollback'; end if; raise notice 'PASS: 0048 rollback clean'; end \$\$;"

echo "ALL_0048_SMOKE_PASS"
