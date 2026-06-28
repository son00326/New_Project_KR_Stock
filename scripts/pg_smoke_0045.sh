#!/usr/bin/env bash
# pg_smoke_0045.sh — docker-free local PG16 smoke for record_alert_exit_decision re-grant (0045).
#   Models the production grant history: 0010 grant authenticated → 0015a revoke anon+authenticated
#   → 0045 re-grant authenticated. Asserts final state: authenticated EXECUTE present,
#   anon absent, service_role present (definer self-gates is_admin). rollback re-revokes authenticated.
#   Requires a LOCAL running PostgreSQL (createdb/psql on PATH). NOT a production test.
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
DB="pg_smoke_0045_$$"
cleanup() { dropdb --if-exists "$DB" 2>/dev/null || true; }
trap cleanup EXIT
createdb "$DB"

# Bootstrap: Supabase roles + is_admin stub + the function as defined by 0010 (security definer),
# then replicate 0010 grant + 0015a revoke so 0045 acts on the real prior state.
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create function public.is_admin() returns boolean language sql stable as $f$ select true $f$;
create table public.alert_event (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  decision_recorded text,
  decision_memo text,
  is_read boolean not null default false
);
create function public.record_alert_exit_decision(p_alert_id uuid, p_decision text, p_memo text default null)
returns void language plpgsql security definer set search_path = public as $f$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if p_decision not in ('sell_all','partial_sell','hold') then raise exception 'invalid_decision'; end if;
  update public.alert_event set decision_recorded = p_decision, is_read = true
    where id = p_alert_id and alert_type = 'exit_signal' and decision_recorded is null;
  if not found then raise exception 'alert_not_found_or_already_decided'; end if;
end;
$f$;
-- 0010 state: revoke from public(기본 PUBLIC EXECUTE 제거) + grant authenticated.
revoke execute on function public.record_alert_exit_decision(uuid, text, text) from public;
grant execute on function public.record_alert_exit_decision(uuid, text, text) to authenticated;
grant execute on function public.record_alert_exit_decision(uuid, text, text) to service_role;
-- 0015a state: revoke anon + authenticated (least privilege, 미사용).
revoke execute on function public.record_alert_exit_decision(uuid, text, text) from anon;
revoke execute on function public.record_alert_exit_decision(uuid, text, text) from authenticated;
SQL

MIG="$(dirname "$0")/../tudal/supabase/migrations"

# Pre-0045 assertion: authenticated must NOT have EXECUTE (0015a applied) — proves 0045 is load-bearing.
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$ begin
  if has_function_privilege('authenticated', 'public.record_alert_exit_decision(uuid, text, text)', 'EXECUTE') then
    raise exception 'FAIL(pre): authenticated should NOT have EXECUTE before 0045 (0015a revoke)';
  end if;
  if not has_function_privilege('service_role', 'public.record_alert_exit_decision(uuid, text, text)', 'EXECUTE') then
    raise exception 'FAIL(pre): service_role should retain EXECUTE from 0015a baseline';
  end if;
  raise notice 'PASS(pre): authenticated EXECUTE absent before 0045';
end $$;
SQL

psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0045_record_alert_exit_decision_regrant.sql"

# Post-0045 assertion: authenticated present, anon absent, public absent.
# (service_role는 이 함수에 grant되지 않음 — authenticated 세션 client가 호출, 내부 is_admin() self-gate.)
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$ begin
  if not has_function_privilege('authenticated', 'public.record_alert_exit_decision(uuid, text, text)', 'EXECUTE') then
    raise exception 'FAIL: authenticated should have EXECUTE after 0045';
  end if;
  if has_function_privilege('anon', 'public.record_alert_exit_decision(uuid, text, text)', 'EXECUTE') then
    raise exception 'FAIL: anon should NOT have EXECUTE (least privilege)';
  end if;
  if has_function_privilege('public', 'public.record_alert_exit_decision(uuid, text, text)', 'EXECUTE') then
    raise exception 'FAIL: public should NOT have EXECUTE (revoked in 0010)';
  end if;
  if not has_function_privilege('service_role', 'public.record_alert_exit_decision(uuid, text, text)', 'EXECUTE') then
    raise exception 'FAIL: service_role should retain EXECUTE';
  end if;
  if not exists (
    select 1
    from pg_proc
    where oid = 'public.record_alert_exit_decision(uuid, text, text)'::regprocedure
      and proconfig @> array['search_path=public, pg_temp']
  ) then
    raise exception 'FAIL: record_alert_exit_decision search_path should be public, pg_temp';
  end if;
  raise notice 'PASS: 0045 grant matrix (authenticated/service_role=yes, anon/public=no) + search_path';
end $$;
SQL

# Rollback re-revokes authenticated.
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIG/0045_record_alert_exit_decision_regrant.rollback.sql"
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
do $$ begin
  if has_function_privilege('authenticated', 'public.record_alert_exit_decision(uuid, text, text)', 'EXECUTE') then
    raise exception 'FAIL: rollback should re-revoke authenticated EXECUTE';
  end if;
  if not has_function_privilege('service_role', 'public.record_alert_exit_decision(uuid, text, text)', 'EXECUTE') then
    raise exception 'FAIL: rollback should preserve service_role EXECUTE';
  end if;
  raise notice 'PASS: 0045 rollback re-revokes authenticated';
end $$;
SQL

echo "ALL_0045_SMOKE_PASS"
