#!/usr/bin/env bash
# pg_smoke_0049.sh — docker-free local PG16 smoke for reset_sector_board_eligible_jobs (0049).
#   Asserts (PR-T2a 완결성 갭 fix):
#     · done + section_8 present + partA<14 + AI badge → reset to pending (re-commit 대상)
#     · partA=14 (섹터 보드 committed) → NOT reset
#     · section_8 null → NOT reset (section8 reset 영역)
#     · deferred(sector_board_not_ready) → reset / deferred(sector_unresolved) → NOT reset (terminal·무한루프 차단)
#     · ⚪/null·비-AI 배지 → NOT reset
#     · partA non-array(jsonb_typeof guard) → reset 없이 error 없음
#     · grants: service_role execute / public·anon·authenticated revoked
#     · rollback clean
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
DB="pg_smoke_0049_$$"
cleanup() { dropdb --if-exists "$DB" 2>/dev/null || true; }
trap cleanup EXIT
createdb "$DB"

# ── bootstrap minimal tables + roles (RPC가 읽는 컬럼만) ──
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;

create table public.report_batch_job (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  ticker text not null,
  status text not null,
  attempts int not null default 0,
  last_error text,
  claimed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  unique (month, ticker)
);
create table public.stock_reports (
  ticker text not null,
  month date not null,
  is_latest boolean not null default true,
  section_0 jsonb,
  section_7 jsonb,
  section_8 jsonb
);
create table public.short_list_30 (
  ticker text not null,
  month date not null,
  consensus_badge text
);
SQL

MIG="$(dirname "$0")/../tudal/supabase/migrations"
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0049_reset_sector_board_eligible_jobs.sql"

psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$
declare
  v_reset int;
  v_status text;
  v_partA14 jsonb := (select jsonb_agg(jsonb_build_object('persona_id', g)) from generate_series(1,14) g);
begin
  -- seed: 6 jobs, 다양한 완결성/배지 상태 (모두 month=2026-06, body complete except where noted)
  -- A) done + partA<14 + AI badge → RESET (re-commit 대상)
  insert into public.report_batch_job(month, ticker, status, attempts) values ('2026-06','AAAAAA','done',1);
  insert into public.stock_reports(ticker,month,section_0,section_7,section_8)
    values ('AAAAAA','2026-06-01','{"x":1}'::jsonb,'{"x":1}'::jsonb,'{"partD":[],"partA":[]}'::jsonb);
  insert into public.short_list_30(ticker,month,consensus_badge) values ('AAAAAA','2026-06-01','🟢');

  -- B) done + partA=14 (committed) → NOT reset
  insert into public.report_batch_job(month, ticker, status) values ('2026-06','BBBBBB','done');
  insert into public.stock_reports(ticker,month,section_0,section_7,section_8)
    values ('BBBBBB','2026-06-01','{"x":1}'::jsonb,'{"x":1}'::jsonb, jsonb_build_object('partD','[]'::jsonb,'partA',v_partA14));
  insert into public.short_list_30(ticker,month,consensus_badge) values ('BBBBBB','2026-06-01','🟣');

  -- C) done + section_8 null → NOT reset (section8 reset 영역)
  insert into public.report_batch_job(month, ticker, status) values ('2026-06','CCCCCC','done');
  insert into public.stock_reports(ticker,month,section_0,section_7,section_8)
    values ('CCCCCC','2026-06-01','{"x":1}'::jsonb,'{"x":1}'::jsonb, null);
  insert into public.short_list_30(ticker,month,consensus_badge) values ('CCCCCC','2026-06-01','🟢');

  -- D) deferred(sector_board_not_ready) + partA<14 + AI badge → RESET
  insert into public.report_batch_job(month, ticker, status, last_error) values ('2026-06','DDDDDD','deferred','sector_board_not_ready');
  insert into public.stock_reports(ticker,month,section_0,section_7,section_8)
    values ('DDDDDD','2026-06-01','{"x":1}'::jsonb,'{"x":1}'::jsonb,'{"partD":[],"partA":[]}'::jsonb);
  insert into public.short_list_30(ticker,month,consensus_badge) values ('DDDDDD','2026-06-01','🔵');

  -- E) deferred(sector_unresolved) terminal → NOT reset (무한 루프 차단)
  insert into public.report_batch_job(month, ticker, status, last_error) values ('2026-06','EEEEEE','deferred','sector_unresolved');
  insert into public.stock_reports(ticker,month,section_0,section_7,section_8)
    values ('EEEEEE','2026-06-01','{"x":1}'::jsonb,'{"x":1}'::jsonb,'{"partD":[],"partA":[]}'::jsonb);
  insert into public.short_list_30(ticker,month,consensus_badge) values ('EEEEEE','2026-06-01','🟢');

  -- F) done + partA<14 but ⚪ badge → NOT reset (배지 미충족)
  insert into public.report_batch_job(month, ticker, status) values ('2026-06','FFFFFF','done');
  insert into public.stock_reports(ticker,month,section_0,section_7,section_8)
    values ('FFFFFF','2026-06-01','{"x":1}'::jsonb,'{"x":1}'::jsonb,'{"partD":[],"partA":[]}'::jsonb);
  insert into public.short_list_30(ticker,month,consensus_badge) values ('FFFFFF','2026-06-01','⚪');

  -- G) done + partA non-array (오염 데이터) → jsonb_typeof guard로 error 없이 <14 취급 → RESET
  insert into public.report_batch_job(month, ticker, status) values ('2026-06','GGGGGG','done');
  insert into public.stock_reports(ticker,month,section_0,section_7,section_8)
    values ('GGGGGG','2026-06-01','{"x":1}'::jsonb,'{"x":1}'::jsonb,'{"partD":[],"partA":"oops"}'::jsonb);
  insert into public.short_list_30(ticker,month,consensus_badge) values ('GGGGGG','2026-06-01','🟡');

  v_reset := public.reset_sector_board_eligible_jobs('2026-06');
  -- 기대: A, D, G reset = 3
  if v_reset <> 3 then raise exception 'FAIL: expected 3 reset, got %', v_reset; end if;

  select status into v_status from public.report_batch_job where ticker='AAAAAA';
  if v_status <> 'pending' then raise exception 'FAIL A: expected pending, got %', v_status; end if;
  select status into v_status from public.report_batch_job where ticker='BBBBBB';
  if v_status <> 'done' then raise exception 'FAIL B(committed partA14): expected done, got %', v_status; end if;
  select status into v_status from public.report_batch_job where ticker='CCCCCC';
  if v_status <> 'done' then raise exception 'FAIL C(section_8 null): expected done, got %', v_status; end if;
  select status into v_status from public.report_batch_job where ticker='DDDDDD';
  if v_status <> 'pending' then raise exception 'FAIL D(not_ready deferred): expected pending, got %', v_status; end if;
  select status into v_status from public.report_batch_job where ticker='EEEEEE';
  if v_status <> 'deferred' then raise exception 'FAIL E(unresolved terminal): expected deferred, got %', v_status; end if;
  select status into v_status from public.report_batch_job where ticker='FFFFFF';
  if v_status <> 'done' then raise exception 'FAIL F(⚪ badge): expected done, got %', v_status; end if;
  select status into v_status from public.report_batch_job where ticker='GGGGGG';
  if v_status <> 'pending' then raise exception 'FAIL G(non-array partA): expected pending, got %', v_status; end if;

  -- idempotent: 재실행 시 이미 pending이라 추가 reset 0 (E는 여전히 terminal)
  v_reset := public.reset_sector_board_eligible_jobs('2026-06');
  if v_reset <> 0 then raise exception 'FAIL idempotent: expected 0 on 2nd run, got %', v_reset; end if;

  raise notice 'OK reset behavior (3 reset, terminals/committed/null/badge respected, idempotent)';
end $$;

-- grants: service_role execute O; public/anon/authenticated X
do $$
declare v_svc boolean; v_auth boolean; v_anon boolean; v_pub boolean;
begin
  v_svc  := has_function_privilege('service_role',  'public.reset_sector_board_eligible_jobs(text)', 'EXECUTE');
  v_auth := has_function_privilege('authenticated', 'public.reset_sector_board_eligible_jobs(text)', 'EXECUTE');
  v_anon := has_function_privilege('anon',          'public.reset_sector_board_eligible_jobs(text)', 'EXECUTE');
  v_pub  := has_function_privilege('public',        'public.reset_sector_board_eligible_jobs(text)', 'EXECUTE');
  if not v_svc then raise exception 'FAIL grant: service_role must have EXECUTE'; end if;
  if v_auth then raise exception 'FAIL grant: authenticated must NOT have EXECUTE'; end if;
  if v_anon then raise exception 'FAIL grant: anon must NOT have EXECUTE'; end if;
  if v_pub then raise exception 'FAIL grant: PUBLIC must NOT have EXECUTE'; end if;
  raise notice 'OK grants (service_role only)';
end $$;

-- search_path pin + security definer 확인
do $$
declare v_def boolean; v_cfg text[];
begin
  select p.prosecdef, p.proconfig into v_def, v_cfg
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='reset_sector_board_eligible_jobs';
  if not v_def then raise exception 'FAIL: must be SECURITY DEFINER'; end if;
  if v_cfg is null or not ('search_path=public, pg_temp' = any(v_cfg)) then
    raise exception 'FAIL: search_path must be pinned (got %)', v_cfg;
  end if;
  raise notice 'OK security definer + search_path pin';
end $$;
SQL

# rollback clean
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0049_reset_sector_board_eligible_jobs.rollback.sql"
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='reset_sector_board_eligible_jobs') then
    raise exception 'FAIL rollback: function still present';
  end if;
  raise notice 'OK rollback clean';
end $$;
SQL

echo "pg_smoke_0049 PASS"
