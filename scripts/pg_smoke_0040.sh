#!/usr/bin/env bash
# pg_smoke_0040.sh — docker-free local PG16 smoke for commit_sector_personas_cron (0040) + admin (0019/0041).
#   Guards the 2026-06-24 live-catch regression: committee_votes_sector_required CHECK requires sector NOT NULL
#   on sector-layer rows; the RPC INSERT must set sector=p_sector (else 23514 check_violation).
#   Mirrors pg_smoke_0038/0039 pattern: createdb temp → minimal schema + functions → assert → dropdb.
#   Requires a LOCAL running PostgreSQL (createdb/psql on PATH). NOT a production test.
#   (Live verification 2026-06-24 was via Supabase MCP RPC smoke + P4 first-ticker core11+sector14.)
set -euo pipefail
DB="pg_smoke_0040_$$"
CRON_USER="39202d8b-1042-48a6-8da0-df14a52fabea"
cleanup() { dropdb --if-exists "$DB" 2>/dev/null || true; }
trap cleanup EXIT
createdb "$DB"

psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
-- minimal schema mirror (auth.users + stock_reports + committee_votes + the CHECK).
create schema if not exists auth;
create table auth.users (id uuid primary key);
create table public.stock_reports (
  id uuid primary key default gen_random_uuid(),
  ticker varchar not null, month date not null, is_latest boolean not null default true,
  section_8 jsonb, generated_at timestamptz not null default now()
);
create table public.committee_votes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.stock_reports(id) on delete cascade,
  persona_id varchar not null, persona_layer text not null, sector varchar,
  vote text not null, argument_excerpt text, created_at timestamptz not null default now(),
  constraint committee_votes_persona_layer_check check (persona_layer = any (array['core','sector'])),
  constraint committee_votes_sector_required check (
    ((persona_layer='core') and (sector is null)) or ((persona_layer='sector') and (sector is not null))),
  constraint committee_votes_vote_check check (vote = any (array['approve','reject','abstain']))
);
SQL

# apply the cron function under test (extract from the migration file).
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$(dirname "$0")/../tudal/supabase/migrations/0040_commit_sector_personas_cron.sql"

# seed cron user + a report, call RPC, assert (all server-side; no psql client vars inside DO).
psql -v ON_ERROR_STOP=1 -d "$DB" <<SQL
insert into auth.users(id) values ('$CRON_USER');
insert into public.stock_reports(ticker, month, is_latest) values ('999999','2026-06-01',true);
do \$\$
declare v_inserted int; v_null int; v_sec int; v_total int;
begin
  -- 1) happy path: 14 sector votes, sector NOT NULL (regression: must NOT raise 23514 check_violation).
  v_inserted := (public.commit_sector_personas_cron(
    '2026-06','999999','반도체',
    (select jsonb_agg(jsonb_build_object('persona_id','sector-반도체-slot-'||g,'vote','BUY')) from generate_series(1,14) g),
    '{"buy":14,"hold":0,"sell":0}'::jsonb,
    (select jsonb_agg(jsonb_build_object('persona_id','sector-반도체-slot-'||g,'persona_layer','sector','argument_excerpt','a','vote','BUY')) from generate_series(1,14) g),
    '$CRON_USER'::uuid)->>'votes_inserted')::int;
  if v_inserted <> 14 then raise exception 'FAIL: votes_inserted=% (want 14)', v_inserted; end if;
  select count(*) filter (where sector is null), count(*) filter (where sector='반도체')
    into v_null, v_sec from public.committee_votes where persona_layer='sector';
  if v_null <> 0 then raise exception 'FAIL: % sector-layer rows with NULL sector', v_null; end if;
  if v_sec <> 14 then raise exception 'FAIL: expected 14 sector rows sector=반도체, got %', v_sec; end if;
  -- 2) idempotent re-call: still 14 (DELETE then INSERT, no duplicate).
  perform public.commit_sector_personas_cron('2026-06','999999','반도체',
    (select jsonb_agg(jsonb_build_object('persona_id','sector-반도체-slot-'||g,'vote','HOLD')) from generate_series(1,14) g),
    '{"buy":0,"hold":14,"sell":0}'::jsonb,
    (select jsonb_agg(jsonb_build_object('persona_id','sector-반도체-slot-'||g,'persona_layer','sector','argument_excerpt','a','vote','HOLD')) from generate_series(1,14) g),
    '$CRON_USER'::uuid);
  select count(*) into v_total from public.committee_votes where persona_layer='sector';
  if v_total <> 14 then raise exception 'FAIL: idempotency (sector rows=% after re-call, want 14)', v_total; end if;
  raise notice 'PASS: 0040 cron RPC — 14 sector votes, sector NOT NULL, idempotent.';
end \$\$;
SQL
echo "pg_smoke_0040: PASS"
