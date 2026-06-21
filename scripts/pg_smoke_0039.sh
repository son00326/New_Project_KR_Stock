#!/usr/bin/env bash
# pg_smoke_0039.sh — CLAUDE-runnable Docker-free local PG smoke for migration 0039 (Track 2 generator-shadow).
#
# WHAT THIS PROVES (local, deterministic SQL/constraint/RPC-validation semantics):
#   table existence + RLS-enabled flags; NOT NULL/CHECK/unique/regex/enum constraints; every RPC pre-validation
#   branch (register + finalize + 3 internal helpers); prosecdef + search_path + EXECUTE grant matrix;
#   table-level DML grant absence; mid-run rollback no-orphan; all-arms atomicity; run_id join discipline;
#   hypothesis content binding; complete-snapshot fail-closed; F1 snapshot writer (p_payload) end-to-end;
#   F2 stale-run cleanup; F3 hard-gate underfill; F8 dup (ticker,bucket); same-hash/different-content
#   hypothesis registration rejection; idempotent re-run; rollback drops ONLY 0039 artifacts;
#   canonical-14 enum parity (SQL == canonical-sectors.ts == Python); non-service_role authz branches
#   (auth_unavailable/admin_required); anon RESTRICTIVE deny policy (house pattern); hard-gate HAPPY +
#   incomplete_run status path; snapshot_row_invalid + symmetric numeric typed guards (rank/tier0_score);
#   unresolved happy + reject; run-level-wins arm merge (FIX-A); hypothesis content-binding (params/asOf, FIX-B).
#
# WHAT THIS DOES NOT PROVE (USER-only, real Supabase post-apply — see real_smoke_checklist below):
#   (B1) REAL service_role PostgREST SELECT denied on all 4 shadow tables (local stub role has no BYPASSRLS / no
#        PostgREST key mapping). (B2) RPC owner = postgres superuser distinct from service_role + DEFINER write
#        succeeds with EXECUTE-only. (B3) ALTER DEFAULT PRIVILEGES did not silently re-grant service_role SELECT
#        (Supabase default-privilege rule does not exist on bare local PG).
#   SET ROLE is intentionally NOT used (it bypasses the real connection authz). Caller identity is simulated via
#   GUC stubs (auth.uid/auth.role/is_admin) so RPC authz BRANCHES execute; this is not the real JWT→role binding.
#
# Usage: bash scripts/pg_smoke_0039.sh   (uses local unix socket; psql/createdb/dropdb on PATH; PG 16)
set -euo pipefail

DB="tier0_0039_smoke"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="${HERE}/../tudal/supabase/migrations/0039_tier0_candidates_150_shadow.sql"
ROLLBACK="${HERE}/../tudal/supabase/migrations/0039_tier0_candidates_150_shadow.rollback.sql"
CANON_TS="${HERE}/../tudal/src/lib/screening/canonical-sectors.ts"
PRODMIG="${HERE}/../tudal/supabase/migrations/0028_tier0_candidates_150.sql"
WORK="$(mktemp -d)"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

PSQL="psql -v ON_ERROR_STOP=1 -X -q -d $DB"

say() { printf '\n=== %s ===\n' "$1"; }
fail() { printf 'SMOKE FAIL: %s\n' "$1" >&2; exit 1; }

[ -f "$MIG" ] || fail "migration not found: $MIG"
[ -f "$ROLLBACK" ] || fail "rollback not found: $ROLLBACK"

# ---------------------------------------------------------------------------
# 0. production no-diff grep gate: 0039 must not target production identifiers as DDL/DML.
# ---------------------------------------------------------------------------
say "production no-diff grep gate"
# any line that WRITES/ALTERS a production table is a hard fail. Comment-only mentions are allowed.
if grep -nE '(create|alter|drop|insert into|update|delete from)[[:space:]]+.*\b(tier0_candidates_150|short_list_30)\b' "$MIG" \
     | grep -vE '_shadow' | grep -vE '^\s*--' >/dev/null; then
  grep -nE '(create|alter|drop|insert into|update|delete from)[[:space:]]+.*\b(tier0_candidates_150|short_list_30)\b' "$MIG" | grep -vE '_shadow' | grep -vE '^\s*--' >&2
  fail "0039 appears to write/alter a production table"
fi
echo "ok: no production DDL/DML targets in 0039"

# ---------------------------------------------------------------------------
# fresh temp DB
# ---------------------------------------------------------------------------
say "createdb $DB"
dropdb --if-exists "$DB" >/dev/null 2>&1 || true
createdb "$DB"

# ---------------------------------------------------------------------------
# bootstrap.sql — Supabase stubs (DIVERGENCES annotated).
#   roles anon/authenticated/service_role: plain NOLOGIN. NO BYPASSRLS, NO PostgREST → grant matrix is real,
#     RLS-bypass + key mapping are NOT (→ B1/B2 USER-only).
#   auth.uid()/auth.role(): GUC-backed (smoke.uid / smoke.role). Simulates caller identity for RPC authz BRANCHES;
#     not the real JWT→role binding.
#   public.is_admin(): GUC-backed (smoke.is_admin). real reads admin_emails via auth.jwt(); stub is a GUC.
#   gen_random_uuid(): native PG13+; assert present.
# ---------------------------------------------------------------------------
cat > "$WORK/bootstrap.sql" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('smoke.uid', true),'')::uuid $f$;
create or replace function auth.role() returns text language sql stable as
  $f$ select coalesce(nullif(current_setting('smoke.role', true),''), 'service_role') $f$;
create or replace function public.is_admin() returns boolean language sql stable as
  $f$ select coalesce(nullif(current_setting('smoke.is_admin', true),'')::boolean, false) $f$;
do $$ begin perform gen_random_uuid(); exception when others then raise 'gen_random_uuid unavailable'; end $$;
SQL
say "bootstrap stubs"
$PSQL -f "$WORK/bootstrap.sql"

# ---------------------------------------------------------------------------
# apply 0039 — F1/AB-BUG would abort here OR at first finalize.
# ---------------------------------------------------------------------------
say "apply 0039"
$PSQL -f "$MIG"
echo "ok: 0039 compiles + applies"

# helper: assert a SQL snippet RAISES with a message containing $2 (savepoint-isolated).
assert_raises() {
  local sql="$1"; local needle="$2"; local label="$3"
  local out
  out="$($PSQL -t -c "do \$smk\$ begin
    $sql
    raise exception 'SMOKE_NO_ERROR';
  exception when others then
    if sqlerrm not like '%$needle%' then raise exception 'SMOKE_WRONG:%', sqlerrm; end if;
  end \$smk\$;" 2>&1)" || { echo "$out" | grep -q "SMOKE_WRONG\|SMOKE_NO_ERROR" && fail "$label (got: $out)"; }
  if echo "$out" | grep -q "SMOKE_NO_ERROR"; then fail "$label expected '$needle' but no error raised"; fi
  if echo "$out" | grep -q "SMOKE_WRONG"; then fail "$label expected '$needle' but: $out"; fi
  # false-green guard (migration reviewer): a syntax/connection error in $sql (DO never entered) would otherwise
  #   fall through to "ok". Expected-match leaves $out empty (handler matched, no re-raise). Any leftover
  #   ERROR/FATAL/psql text = the test did NOT fail for the intended typed reason -> hard fail.
  if [ -n "$(echo "$out" | tr -d '[:space:]')" ] && echo "$out" | grep -qiE "ERROR:|FATAL:|psql:"; then
    fail "$label unexpected psql/syntax error (not the typed '$needle'): $out"
  fi
  echo "ok: $label -> $needle"
}
# helper: assert SQL runs clean.
assert_ok() { $PSQL -c "$1" >/dev/null || fail "$2"; echo "ok: $2"; }

# default caller identity = service_role: the bootstrap auth.role() stub defaults to 'service_role' when
#   smoke.role is unset, so every happy-path assertion runs as service_role WITHOUT a (futile, per-connection)
#   SET. The non-service_role authz branches are covered in the "authz branches" section via txn-local set_config.

# ---------------------------------------------------------------------------
# A-EXIST-RLS: 4 tables + RLS enabled.
# ---------------------------------------------------------------------------
say "A-EXIST-RLS"
N=$($PSQL -t -A -c "select count(*) from pg_class where relname in ('tier0_shadow_sector_hypothesis','tier0_candidates_150_shadow','tier0_shadow_universe_snapshot','tier0_shadow_unresolved_issues') and relkind='r';")
[ "$N" = "4" ] || fail "expected 4 shadow tables, got $N"
RLS=$($PSQL -t -A -c "select count(*) from pg_class where relname in ('tier0_shadow_sector_hypothesis','tier0_candidates_150_shadow','tier0_shadow_universe_snapshot','tier0_shadow_unresolved_issues') and relrowsecurity;")
[ "$RLS" = "4" ] || fail "expected RLS on all 4, got $RLS"
echo "ok: 4 tables + RLS enabled"

# ---------------------------------------------------------------------------
# A-RPC-INTROSPECT: prosecdef + search_path + EXECUTE grant matrix.
#   register + finalize = service_role EXECUTE; 3 helpers = no grant. (owner identity = B2 USER-only.)
# ---------------------------------------------------------------------------
say "A-RPC-INTROSPECT"
SD=$($PSQL -t -A -c "select count(*) from pg_proc where proname in ('upsert_tier0_shadow_run','register_shadow_hypothesis','_shadow_write_candidates','_shadow_write_universe_snapshot','_shadow_write_unresolved') and prosecdef;")
[ "$SD" = "5" ] || fail "expected 5 SECURITY DEFINER funcs, got $SD"
SP=$($PSQL -t -A -c "select count(*) from pg_proc where proname in ('upsert_tier0_shadow_run','register_shadow_hypothesis','_shadow_write_candidates','_shadow_write_universe_snapshot','_shadow_write_unresolved') and 'search_path=public, pg_temp' = any(proconfig);")
[ "$SP" = "5" ] || fail "expected 5 funcs with search_path=public, pg_temp, got $SP"
# finalize EXECUTE granted to service_role:
FG=$($PSQL -t -A -c "select count(*) from information_schema.role_routine_grants where routine_name='upsert_tier0_shadow_run' and grantee='service_role' and privilege_type='EXECUTE';")
[ "$FG" = "1" ] || fail "upsert_tier0_shadow_run not EXECUTE-granted to service_role"
# 3 internal helpers ungranted to ALL roles:
HG=$($PSQL -t -A -c "select count(*) from information_schema.role_routine_grants where routine_name in ('_shadow_write_candidates','_shadow_write_universe_snapshot','_shadow_write_unresolved') and grantee in ('anon','authenticated','service_role','public');")
[ "$HG" = "0" ] || fail "internal helpers have unexpected EXECUTE grants ($HG)"
echo "ok: prosecdef + search_path + EXECUTE matrix"
echo "   NOTE LOCAL: owner identity (pg_get_userbyid(proowner)=postgres) + DEFINER-write-without-table-grant => real_smoke B2 (USER-only)"

# ---------------------------------------------------------------------------
# A table-grant matrix: authenticated SELECT only; service_role no grant; no DML to anyone.
#   LOCAL: grant presence only; real service_role denial semantics => real_smoke B1 (USER-only).
# ---------------------------------------------------------------------------
say "A table-grant matrix"
AUTHSEL=$($PSQL -t -A -c "select count(*) from information_schema.role_table_grants where table_name like 'tier0_%shadow%' or table_name='tier0_candidates_150_shadow';" )
# authenticated must have SELECT on all 4:
AS=$($PSQL -t -A -c "select count(*) from information_schema.role_table_grants where grantee='authenticated' and privilege_type='SELECT' and (table_name like 'tier0_shadow%' or table_name='tier0_candidates_150_shadow');")
[ "$AS" = "4" ] || fail "authenticated SELECT expected on 4 tables, got $AS"
# service_role must have ZERO grants on shadow tables (T2-I-6):
SR=$($PSQL -t -A -c "select count(*) from information_schema.role_table_grants where grantee='service_role' and (table_name like 'tier0_shadow%' or table_name='tier0_candidates_150_shadow');")
[ "$SR" = "0" ] || fail "service_role must have ZERO table grants on shadow (T2-I-6), got $SR"
# no Supabase ROLE (anon/authenticated/service_role/public) has INSERT/UPDATE/DELETE on shadow tables.
#   NOTE: the local temp-DB owner ($USER) implicitly holds all privileges and appears in role_table_grants;
#   on Supabase the owner is postgres. We assert the Supabase-facing roles only.
DML=$($PSQL -t -A -c "select count(*) from information_schema.role_table_grants where privilege_type in ('INSERT','UPDATE','DELETE') and grantee in ('anon','authenticated','service_role','PUBLIC') and (table_name like 'tier0_shadow%' or table_name='tier0_candidates_150_shadow');")
[ "$DML" = "0" ] || fail "no Supabase role should have DML on shadow tables, got $DML"
echo "ok: authenticated SELECT only / service_role zero / no DML (Supabase roles)"
echo "   NOTE LOCAL: real service_role SELECT denial + default-privilege re-grant => real_smoke B1/B3 (USER-only)"
# house-pattern RLS policies: each shadow table has 1 admin-select (authenticated) + 1 anon-restrictive-block.
ADMINP=$($PSQL -t -A -c "select count(*) from pg_policies where schemaname='public' and (tablename like 'tier0_shadow%' or tablename='tier0_candidates_150_shadow') and policyname like '% admin select';")
ANONP=$($PSQL -t -A -c "select count(*) from pg_policies where schemaname='public' and (tablename like 'tier0_shadow%' or tablename='tier0_candidates_150_shadow') and policyname like '% anon block' and permissive='RESTRICTIVE' and 'anon'=any(roles);")
[ "$ADMINP" = "4" ] || fail "expected 4 admin-select policies, got $ADMINP"
[ "$ANONP" = "4" ] || fail "expected 4 anon RESTRICTIVE block policies (0034 house pattern), got $ANONP"
echo "ok: 4 admin-select + 4 anon-restrictive-block policies (house pattern)"

# hypothesis table has NO UPDATE/DELETE API for any Supabase role (immutable/append-only):
HUD=$($PSQL -t -A -c "select count(*) from information_schema.role_table_grants where table_name='tier0_shadow_sector_hypothesis' and grantee in ('anon','authenticated','service_role','PUBLIC') and privilege_type in ('UPDATE','DELETE');")
[ "$HUD" = "0" ] || fail "hypothesis table must have no UPDATE/DELETE grants to Supabase roles, got $HUD"

# ---------------------------------------------------------------------------
# Register fixtures: absent + manual_pre_registered.
# ---------------------------------------------------------------------------
say "register_shadow_hypothesis fixtures"
ABS_ID=$($PSQL -t -A -c "select (public.register_shadow_hypothesis('{\"period_key\":\"2026-06\",\"source\":\"absent\",\"leading_sectors\":[],\"params\":{},\"selection_as_of\":\"2026-06-01T00:05:00Z\",\"hypothesis_hash\":\"absent-2026-06-h\"}'::jsonb))->>'id';")
[ -n "$ABS_ID" ] || fail "absent hypothesis register returned no id"
MAN_ID=$($PSQL -t -A -c "select (public.register_shadow_hypothesis('{\"period_key\":\"2026-06\",\"source\":\"manual_pre_registered\",\"leading_sectors\":[\"반도체\"],\"params\":{\"tilt_version\":\"v1-fixed\",\"tilt_multiplier\":1.1},\"as_of\":\"2026-05-31T00:00:00Z\",\"selection_as_of\":\"2026-06-01T00:05:00Z\",\"hypothesis_hash\":\"manual-2026-06-h\"}'::jsonb))->>'id';")
[ -n "$MAN_ID" ] || fail "manual hypothesis register returned no id"
# idempotent re-register returns same id:
ABS_ID2=$($PSQL -t -A -c "select (public.register_shadow_hypothesis('{\"period_key\":\"2026-06\",\"source\":\"absent\",\"leading_sectors\":[],\"params\":{},\"selection_as_of\":\"2026-06-01T00:05:00Z\",\"hypothesis_hash\":\"absent-2026-06-h\"}'::jsonb))->>'id';")
[ "$ABS_ID" = "$ABS_ID2" ] || fail "absent re-register not idempotent ($ABS_ID vs $ABS_ID2)"
echo "ok: register absent=$ABS_ID manual=$MAN_ID (idempotent)"

# register negative cases:
assert_raises "perform public.register_shadow_hypothesis('{\"period_key\":\"2026-06\",\"source\":\"manual_pre_registered\",\"leading_sectors\":[\"조선\"],\"as_of\":\"2026-05-31T00:00:00Z\",\"selection_as_of\":\"2026-06-01T00:05:00Z\",\"hypothesis_hash\":\"x\"}'::jsonb);" "bad_canonical_sector" "register non-canonical leadingSector"
assert_raises "perform public.register_shadow_hypothesis('{\"period_key\":\"2026-06\",\"source\":\"manual_pre_registered\",\"leading_sectors\":[\"반도체\"],\"as_of\":\"2026-06-01T00:05:00Z\",\"selection_as_of\":\"2026-06-01T00:05:00Z\",\"hypothesis_hash\":\"x\"}'::jsonb);" "asof_must_precede_selection" "register asOf>=selection"
assert_raises "perform public.register_shadow_hypothesis('{\"period_key\":\"2026-06\",\"source\":\"absent\",\"leading_sectors\":[],\"params\":{},\"selection_as_of\":\"not-a-time\",\"hypothesis_hash\":\"bad-selection-asof\"}'::jsonb);" "bad_selection_as_of" "register malformed selection_as_of -> bad_selection_as_of"
assert_raises "perform public.register_shadow_hypothesis('{\"period_key\":\"2026-06\",\"source\":\"manual_pre_registered\",\"leading_sectors\":[\"반도체\"],\"as_of\":\"not-a-time\",\"selection_as_of\":\"2026-06-01T00:05:00Z\",\"hypothesis_hash\":\"bad-asof\"}'::jsonb);" "bad_as_of" "register malformed as_of -> bad_as_of"
assert_raises "perform public.register_shadow_hypothesis('{\"period_key\":\"2026-06\",\"source\":\"absent\",\"leading_sectors\":[\"반도체\"],\"selection_as_of\":\"2026-06-01T00:05:00Z\",\"hypothesis_hash\":\"x\"}'::jsonb);" "bad_absent_hypothesis" "register absent with leadingSectors"
assert_raises "perform public.register_shadow_hypothesis('{\"period_key\":\"2026-06\",\"source\":\"manual_pre_registered\",\"leading_sectors\":[\"반도체\",\"반도체\"],\"as_of\":\"2026-05-31T00:00:00Z\",\"selection_as_of\":\"2026-06-01T00:05:00Z\",\"hypothesis_hash\":\"x\"}'::jsonb);" "duplicate_leading_sector" "register duplicate leadingSector"
assert_raises "perform public.register_shadow_hypothesis('{\"period_key\":\"2026-06\",\"source\":\"manual_pre_registered\",\"leading_sectors\":[\"금융\"],\"params\":{\"tilt_version\":\"v1-fixed\",\"tilt_multiplier\":1.1},\"as_of\":\"2026-05-31T00:00:00Z\",\"selection_as_of\":\"2026-06-01T00:05:00Z\",\"hypothesis_hash\":\"manual-2026-06-h\"}'::jsonb);" "hypothesis_hash_content_mismatch" "register same hash with different content"

# ---------------------------------------------------------------------------
# AUTHZ BRANCHES (non-service_role): every RPC's auth_unavailable / admin_required path.
#   The default stub role is service_role, so these branches are otherwise NEVER hit. set_config(...,true) is
#   txn-local → it persists inside this assert_raises DO block (same implicit tx) but not across connections.
# ---------------------------------------------------------------------------
say "authz branches (auth_unavailable / admin_required)"
ABSENT_REG="public.register_shadow_hypothesis('{\"period_key\":\"2026-06\",\"source\":\"absent\",\"leading_sectors\":[],\"params\":{},\"selection_as_of\":\"2026-06-01T00:05:00Z\",\"hypothesis_hash\":\"absent-2026-06-h\"}'::jsonb)"
# register: authenticated + no uid -> auth_unavailable
assert_raises "perform set_config('smoke.role','authenticated',true); perform set_config('smoke.uid','',true); perform $ABSENT_REG;" "auth_unavailable" "register authenticated no-uid -> auth_unavailable"
# register: authenticated + uid + non-admin -> admin_required
assert_raises "perform set_config('smoke.role','authenticated',true); perform set_config('smoke.uid','11111111-1111-1111-1111-111111111111',true); perform set_config('smoke.is_admin','false',true); perform $ABSENT_REG;" "admin_required" "register authenticated non-admin -> admin_required"
# finalize: authenticated + uid + non-admin -> admin_required (authz runs right after the object-shape check)
assert_raises "perform set_config('smoke.role','authenticated',true); perform set_config('smoke.uid','11111111-1111-1111-1111-111111111111',true); perform set_config('smoke.is_admin','false',true); perform public.upsert_tier0_shadow_run('{}'::jsonb);" "admin_required" "finalize authenticated non-admin -> admin_required"
# finalize: authenticated + no uid -> auth_unavailable
assert_raises "perform set_config('smoke.role','authenticated',true); perform set_config('smoke.uid','',true); perform public.upsert_tier0_shadow_run('{}'::jsonb);" "auth_unavailable" "finalize authenticated no-uid -> auth_unavailable"

# ---------------------------------------------------------------------------
# Fixture builders for finalize: valid 150 rows + valid full-universe snapshot (>=150 distinct).
# ---------------------------------------------------------------------------
say "build finalize fixtures (150 rows + 150-distinct snapshot)"
# NOTE: permanent `smoke` schema (NOT pg_temp) — each `psql -c` is a new connection with its own pg_temp,
#   so temp fixtures would not persist across the per-assertion invocations.
cat > "$WORK/fixtures.sql" <<'SQL'
create schema if not exists smoke;
-- 150 candidate rows: 50 per bucket, tickers 000001..000150, rank 1..50 within bucket.
create or replace function smoke.cand_rows() returns jsonb language sql as $f$
  select jsonb_agg(jsonb_build_object(
    'ticker', lpad(g::text,6,'0'),
    'name', 'n'||g,
    'sector', '반도체',
    'bucket', case when g<=50 then 'short' when g<=100 then 'mid' else 'long' end,
    'rank', case when g<=50 then g when g<=100 then g-50 else g-100 end,
    'tier0_score', round((g*0.01)::numeric,2),
    'signal_label', 'sig'
  ))
  from generate_series(1,150) g;
$f$;
-- full-universe snapshot: p_n distinct tickers, ONE row per (ticker,bucket='short').
create or replace function smoke.snap_rows(p_n int default 200) returns jsonb language sql as $f$
  select jsonb_agg(jsonb_build_object(
    'ticker', lpad(g::text,6,'0'),
    'name', 'n'||g,
    'sector', '반도체',
    'sector_source', 'mapper',
    'induty_code', '264',
    'bucket', 'short',
    'rank', g,
    'tier0_score', round((g*0.01)::numeric,2)
  ))
  from generate_series(1,p_n) g;
$f$;
SQL
$PSQL -f "$WORK/fixtures.sql"

build_payload() { # $1=arms_json   -> echoes full finalize payload referencing manual hypothesis
  cat <<JSON
{
  "period_key":"2026-06","month":"2026-06","run_id":"run-A",
  "hypothesis_id":"$MAN_ID","universe_hash":"hashA","universe_size":200,
  "sector_view":{"source":"manual_pre_registered","leadingSectors":["반도체"],"hypothesisHash":"manual-2026-06-h"},
  "snapshot_rows": SNAP,
  "arms": $1,
  "unresolved_rows": []
}
JSON
}

# We inject SNAP and ROWS at SQL time via format() so jsonb is built server-side.
finalize_sql() { # $1 = arms jsonb expr (SQL), echoes a DO block calling finalize with valid snapshot
  echo "perform public.upsert_tier0_shadow_run(
    jsonb_build_object(
      'period_key','2026-06','month','2026-06','run_id','run-A',
      'hypothesis_id','$MAN_ID','universe_hash','hashA','universe_size',200,
      'sector_view', jsonb_build_object('source','manual_pre_registered','leadingSectors', jsonb_build_array('반도체'),'hypothesisHash','manual-2026-06-h'),
      'snapshot_rows', smoke.snap_rows(200),
      'arms', $1,
      'unresolved_rows', '[]'::jsonb
    )
  );"
}
mirror_arm="jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows(),'counterfactual_cut','[]'::jsonb,'sector_distribution', jsonb_build_object('반도체',150)))"
mirror_soft_arms="jsonb_build_array(
  jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows(),'counterfactual_cut','[]'::jsonb),
  jsonb_build_object('arm','sector-soft-tilt','status','logged','rows',smoke.cand_rows(),'counterfactual_cut','[]'::jsonb)
)"

# ---------------------------------------------------------------------------
# HAPPY PATH finalize (F1 + F2 + jsonb round-trip): exercises snapshot writer end-to-end.
# ---------------------------------------------------------------------------
say "happy finalize (F1 snapshot writer + atomicity)"
$PSQL -c "do \$smk\$ begin $(finalize_sql "$mirror_soft_arms") end \$smk\$;" >/dev/null || fail "happy finalize failed (F1 snapshot writer or atomicity bug)"
SNAPN=$($PSQL -t -A -c "select count(distinct ticker) from tier0_shadow_universe_snapshot where period_key='2026-06' and run_id='run-A';")
[ "$SNAPN" = "200" ] || fail "snapshot distinct ticker expected 200, got $SNAPN (F1)"
CANDN=$($PSQL -t -A -c "select count(*) from tier0_candidates_150_shadow where period_key='2026-06';")
[ "$CANDN" = "300" ] || fail "candidates expected 300 (mirror+soft), got $CANDN"
# candidates.run_id == snapshot.run_id
XR=$($PSQL -t -A -c "select count(*) from tier0_candidates_150_shadow c where c.period_key='2026-06' and not exists (select 1 from tier0_shadow_universe_snapshot s where s.period_key=c.period_key and s.run_id=c.run_id);")
[ "$XR" = "0" ] || fail "candidates.run_id must match a snapshot run_id, mismatch=$XR"
# sector_view derived from registered hypothesis (jsonb round-trip):
SV=$($PSQL -t -A -c "select sector_view->>'source' from tier0_candidates_150_shadow where period_key='2026-06' limit 1;")
[ "$SV" = "manual_pre_registered" ] || fail "sector_view not derived from hypothesis (got $SV)"
SVH=$($PSQL -t -A -c "select sector_view->>'hypothesisHash' from tier0_candidates_150_shadow where period_key='2026-06' limit 1;")
[ "$SVH" = "manual-2026-06-h" ] || fail "sector_view hypothesisHash not derived, got $SVH"
echo "ok: happy finalize 200 snapshot / 300 candidates / run_id paired / sector_view derived"

# idempotent re-run (same period/run): still 200 snapshot + 300 candidates, no duplication.
$PSQL -c "do \$smk\$ begin $(finalize_sql "$mirror_soft_arms") end \$smk\$;" >/dev/null || fail "idempotent re-run failed"
CANDN2=$($PSQL -t -A -c "select count(*) from tier0_candidates_150_shadow where period_key='2026-06';")
[ "$CANDN2" = "300" ] || fail "idempotent re-run duplicated candidates ($CANDN2)"
echo "ok: idempotent re-run (300, no dup)"

# stale omitted-arm: re-run with mirror only -> soft-tilt rows gone.
$PSQL -c "do \$smk\$ begin $(finalize_sql "$mirror_arm") end \$smk\$;" >/dev/null || fail "mirror-only re-run failed"
ARMS_LEFT=$($PSQL -t -A -c "select string_agg(distinct arm,',' order by arm) from tier0_candidates_150_shadow where period_key='2026-06';")
[ "$ARMS_LEFT" = "production-mirror" ] || fail "stale soft-tilt not removed (arms=$ARMS_LEFT)"
echo "ok: omitted stale arm removed (arms=$ARMS_LEFT)"

# ---------------------------------------------------------------------------
# FIX-A run-level authority: an arm object that injects run_id/universe_size/sector_view is OVERRIDDEN by
#   run-level values (arm_obj || run_level). Proves arm cannot dodge invariants or forge persisted metadata.
# ---------------------------------------------------------------------------
say "FIX-A run-level authority (arm-injected override neutralized)"
# arm injects run_id='EVIL', universe_size=1 (would fail >=150), sector_view source='absent' (would mislabel).
inject_arm="jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','run_id','EVIL','universe_size',1,'hypothesis_id','00000000-0000-0000-0000-000000000000','sector_view',jsonb_build_object('source','absent','leadingSectors','[]'::jsonb),'rows',smoke.cand_rows()))"
$PSQL -c "do \$smk\$ begin $(finalize_sql "$inject_arm") end \$smk\$;" >/dev/null || fail "FIX-A finalize with injecting arm failed (run-level should override, not error)"
IRUN=$($PSQL -t -A -c "select string_agg(distinct run_id,',') from tier0_candidates_150_shadow where period_key='2026-06';")
[ "$IRUN" = "run-A" ] || fail "FIX-A: arm-injected run_id leaked into candidates (got $IRUN, expected run-A)"
IUS=$($PSQL -t -A -c "select string_agg(distinct universe_size::text,',') from tier0_candidates_150_shadow where period_key='2026-06';")
[ "$IUS" = "200" ] || fail "FIX-A: arm-injected universe_size leaked (got $IUS, expected 200)"
ISRC=$($PSQL -t -A -c "select string_agg(distinct sector_view->>'source',',') from tier0_candidates_150_shadow where period_key='2026-06';")
[ "$ISRC" = "manual_pre_registered" ] || fail "FIX-A: arm-injected sector_view leaked (got $ISRC, expected manual_pre_registered)"
echo "ok: FIX-A run-level wins (run_id=run-A, universe_size=200, sector_view=manual_pre_registered)"
# restore canonical mirror+soft state for subsequent assertions.
$PSQL -c "do \$smk\$ begin $(finalize_sql "$mirror_soft_arms") end \$smk\$;" >/dev/null || fail "restore after FIX-A failed"

# ---------------------------------------------------------------------------
# A-MIDRUN-ROLLBACK + all-arms atomicity (one arm bad -> whole tx rolls back, no orphan snapshot)
#   Use a NEW run_id to detect orphan snapshot. mirror ok + soft-tilt 149 rows -> rows_count_must_be_150.
# ---------------------------------------------------------------------------
say "pre-write validation rollback (wrong-period hypothesis) — no orphan; genuine mid-loop is run-C below"
bad_soft="jsonb_build_array(
  jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows()),
  jsonb_build_object('arm','sector-soft-tilt','status','logged','rows',(select jsonb_agg(e) from (select e from jsonb_array_elements(smoke.cand_rows()) e limit 149) z))
)"
assert_raises "$(echo "perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-07','month','2026-07','run_id','run-B','hypothesis_id','$MAN_ID'::text,'universe_hash','hashB','universe_size',200,'sector_view', jsonb_build_object('source','manual_pre_registered','leadingSectors', jsonb_build_array('반도체'),'hypothesisHash','manual-2026-06-h'),'snapshot_rows', smoke.snap_rows(200),'arms', $bad_soft,'unresolved_rows','[]'::jsonb));" | sed 's/run-A/run-B/')" "hypothesis_not_registered" "mid-run wrong-period hypothesis (run-B uses 2026-07 but hypothesis is 2026-06)"
# orphan check: run-B must have left NO snapshot rows.
ORPH=$($PSQL -t -A -c "select count(*) from tier0_shadow_universe_snapshot where run_id='run-B';")
[ "$ORPH" = "0" ] || fail "orphan snapshot left after rollback ($ORPH)"
echo "ok: no orphan after pre-write validation failure (run-B; nothing was written)"

# Register a 2026-07 hypothesis, then exercise the genuine mid-loop failure (soft-tilt 149).
$PSQL -c "select public.register_shadow_hypothesis('{\"period_key\":\"2026-07\",\"source\":\"absent\",\"leading_sectors\":[],\"params\":{},\"selection_as_of\":\"2026-07-01T00:05:00Z\",\"hypothesis_hash\":\"absent-2026-07-h\"}'::jsonb);" >/dev/null
ABS7=$($PSQL -t -A -c "select id from tier0_shadow_sector_hypothesis where period_key='2026-07' and source='absent';")
bad7="jsonb_build_array(
  jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows()),
  jsonb_build_object('arm','sector-soft-tilt','status','logged','rows',(select jsonb_agg(e) from (select e from jsonb_array_elements(smoke.cand_rows()) e limit 149) z))
)"
assert_raises "perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-07','month','2026-07','run_id','run-C','hypothesis_id','$ABS7'::text,'universe_hash','hashC','universe_size',200,'snapshot_rows', smoke.snap_rows(200),'arms', $bad7,'unresolved_rows','[]'::jsonb));" "rows_count_must_be_150" "mid-loop soft-tilt 149 rows"
ORPH7=$($PSQL -t -A -c "select count(*) from tier0_shadow_universe_snapshot where run_id='run-C';")
[ "$ORPH7" = "0" ] || fail "orphan snapshot after mid-loop rollback ($ORPH7)"
CAND7=$($PSQL -t -A -c "select count(*) from tier0_candidates_150_shadow where period_key='2026-07';")
[ "$CAND7" = "0" ] || fail "orphan candidates after mid-loop rollback ($CAND7)"
echo "ok: full tx rollback (no orphan snapshot/candidates) on mid-loop arm failure"

# ---------------------------------------------------------------------------
# all-arms shape rejects.
# ---------------------------------------------------------------------------
say "all-arms shape rejects"
soft_only="jsonb_build_array(jsonb_build_object('arm','sector-soft-tilt','status','logged','rows',smoke.cand_rows()))"
dup_arms="jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows()),jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows()))"
assert_raises "$(finalize_sql "$soft_only")" "production_mirror_required_for_paired_run" "non-mirror arm without mirror"
assert_raises "$(finalize_sql "$dup_arms")" "duplicate_arm" "duplicate arm"
assert_raises "perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-A','hypothesis_id','$MAN_ID'::text,'universe_hash','hashA','universe_size',200,'snapshot_rows', smoke.snap_rows(200),'arms','[]'::jsonb,'unresolved_rows','[]'::jsonb));" "bad_arm_count" "empty arms"

# ---------------------------------------------------------------------------
# hypothesis content binding (F5 identity-only): source/leadingSectors/hash mismatch reject; absent id by manual reject.
# ---------------------------------------------------------------------------
say "hypothesis content binding"
# caller sends leadingSectors that differ from row -> hypothesis_content_mismatch
mism="jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-A','hypothesis_id','$MAN_ID'::text,'universe_hash','hashA','universe_size',200,'sector_view',jsonb_build_object('source','manual_pre_registered','leadingSectors',jsonb_build_array('금융'),'hypothesisHash','manual-2026-06-h'),'snapshot_rows',smoke.snap_rows(200),'arms',$mirror_arm,'unresolved_rows','[]'::jsonb)"
assert_raises "perform public.upsert_tier0_shadow_run($mism);" "hypothesis_content_mismatch" "caller leadingSectors differ from row"
# manual payload referencing the ABSENT hypothesis id -> source mismatch
absref="jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-A','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size',200,'sector_view',jsonb_build_object('source','manual_pre_registered','leadingSectors',jsonb_build_array('반도체'),'hypothesisHash','manual-2026-06-h'),'snapshot_rows',smoke.snap_rows(200),'arms',$mirror_arm,'unresolved_rows','[]'::jsonb)"
assert_raises "perform public.upsert_tier0_shadow_run($absref);" "hypothesis_source_mismatch" "manual payload references absent hypothesis id"
# FIX-B: caller-sent params differ from registered hypothesis params -> hypothesis_content_mismatch (present-field check).
#   registered manual params = {tilt_version:v1-fixed, tilt_multiplier:1.1}; caller sends {tilt_version:v2}.
pmism="jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-A','hypothesis_id','$MAN_ID'::text,'universe_hash','hashA','universe_size',200,'sector_view',jsonb_build_object('source','manual_pre_registered','leadingSectors',jsonb_build_array('반도체'),'hypothesisHash','manual-2026-06-h','params',jsonb_build_object('tilt_version','v2')),'snapshot_rows',smoke.snap_rows(200),'arms',$mirror_arm,'unresolved_rows','[]'::jsonb)"
assert_raises "perform public.upsert_tier0_shadow_run($pmism);" "hypothesis_content_mismatch" "FIX-B caller params differ from registered"
# FIX-B: caller-sent asOf (instant) differs from registered as_of -> hypothesis_content_mismatch.
amism="jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-A','hypothesis_id','$MAN_ID'::text,'universe_hash','hashA','universe_size',200,'sector_view',jsonb_build_object('source','manual_pre_registered','leadingSectors',jsonb_build_array('반도체'),'hypothesisHash','manual-2026-06-h','asOf','2026-04-01T00:00:00Z'),'snapshot_rows',smoke.snap_rows(200),'arms',$mirror_arm,'unresolved_rows','[]'::jsonb)"
assert_raises "perform public.upsert_tier0_shadow_run($amism);" "hypothesis_content_mismatch" "FIX-B caller asOf differs from registered"
bad_asof_present="jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-A','hypothesis_id','$MAN_ID'::text,'universe_hash','hashA','universe_size',200,'sector_view',jsonb_build_object('source','manual_pre_registered','leadingSectors',jsonb_build_array('반도체'),'hypothesisHash','manual-2026-06-h','asOf','not-a-time'),'snapshot_rows',smoke.snap_rows(200),'arms',$mirror_arm,'unresolved_rows','[]'::jsonb)"
assert_raises "perform public.upsert_tier0_shadow_run($bad_asof_present);" "hypothesis_content_mismatch" "FIX-B malformed caller asOf -> hypothesis_content_mismatch"
bad_selection_present="jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-A','hypothesis_id','$MAN_ID'::text,'universe_hash','hashA','universe_size',200,'sector_view',jsonb_build_object('source','manual_pre_registered','leadingSectors',jsonb_build_array('반도체'),'hypothesisHash','manual-2026-06-h','selectionAsOf','not-a-time'),'snapshot_rows',smoke.snap_rows(200),'arms',$mirror_arm,'unresolved_rows','[]'::jsonb)"
assert_raises "perform public.upsert_tier0_shadow_run($bad_selection_present);" "hypothesis_content_mismatch" "FIX-B malformed caller selectionAsOf -> hypothesis_content_mismatch"
bad_helper_asof="perform public._shadow_write_candidates(jsonb_build_object('period_key','2026-06','month','2026-06','arm','sector-soft-tilt','run_id','run-HLP','hypothesis_id','$MAN_ID'::text,'universe_hash','hashA','universe_size',200,'status','invalid_input','sector_view',jsonb_build_object('source','manual_pre_registered','leadingSectors',jsonb_build_array('반도체'),'asOf','not-a-time')));"
assert_raises "$bad_helper_asof" "bad_sector_asof" "helper malformed sector_view.asOf -> bad_sector_asof"

# ---------------------------------------------------------------------------
# complete-snapshot fail-closed: snapshot too small -> snapshot_distinct_ticker_mismatch (helper) blocks before candidates.
# ---------------------------------------------------------------------------
say "complete-snapshot fail-closed + F8 dup (ticker,bucket)"
# snapshot array shorter than universe_size -> snapshot_rows_lt_universe_size (length gate first).
small_snap="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-S','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size',200,'snapshot_rows', smoke.snap_rows(100),'arms', jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows())),'unresolved_rows','[]'::jsonb));"
assert_raises "$small_snap" "snapshot_rows_lt_universe_size" "snapshot fewer rows than universe_size"
# snapshot has >=universe_size rows but distinct ticker < universe_size -> snapshot_distinct_ticker_mismatch.
#   build 200 rows but duplicate ticker 000001 across two buckets so distinct ticker = 199 (universe_size declared 200).
distinct_mismatch="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-S2','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size',200,'snapshot_rows', (select jsonb_agg(case when (e->>'ticker')='000200' then jsonb_set(jsonb_set(e,'{ticker}','\"000001\"'),'{bucket}','\"mid\"') else e end) from jsonb_array_elements(smoke.snap_rows(200)) e),'arms', jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows())),'unresolved_rows','[]'::jsonb));"
assert_raises "$distinct_mismatch" "snapshot_distinct_ticker_mismatch" "snapshot distinct ticker < universe_size"
# F8: duplicate (ticker,bucket) in snapshot -> typed error (not opaque 23505).
dup_snap="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-D','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size',200,'snapshot_rows', (smoke.snap_rows(200) || jsonb_build_array((smoke.snap_rows(1))->0)),'arms', jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows())),'unresolved_rows','[]'::jsonb));"
assert_raises "$dup_snap" "snapshot_duplicate_ticker_bucket" "F8 duplicate (ticker,bucket) snapshot row"

# ---------------------------------------------------------------------------
# F3 hard-gate underfill: status=logged + gate_eligible_size<150 -> gate_underfill_must_be_incomplete (RPC) .
# ---------------------------------------------------------------------------
say "F3 hard-gate underfill"
hg_arms="jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows()),jsonb_build_object('arm','sector-hard-gate','status','logged','gate_eligible_size',10,'rows',smoke.cand_rows(),'counterfactual_cut',jsonb_build_array('999999')))"
assert_raises "$(finalize_sql "$hg_arms")" "gate_underfill_must_be_incomplete" "F3 hard-gate logged with gate_eligible_size<150"
# mirror/soft-tilt with gate_eligible_size set -> gate_eligible_size_only_for_hard_gate
bad_gate="jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','gate_eligible_size',200,'rows',smoke.cand_rows()))"
assert_raises "$(finalize_sql "$bad_gate")" "gate_eligible_size_only_for_hard_gate" "non-hardgate with gate_eligible_size"
bad_gate_text="jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows()),jsonb_build_object('arm','sector-hard-gate','status','logged','gate_eligible_size','abc','rows',smoke.cand_rows()))"
assert_raises "$(finalize_sql "$bad_gate_text")" "bad_gate_eligible_size" "non-numeric hard-gate gate_eligible_size"

# ---------------------------------------------------------------------------
# G: hard-gate HAPPY (logged, gate_eligible_size>=150) + incomplete_run status path (skips 150-gate).
# ---------------------------------------------------------------------------
say "G hard-gate happy + incomplete_run status path"
hg_happy="jsonb_build_array(
  jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows()),
  jsonb_build_object('arm','sector-hard-gate','status','logged','gate_eligible_size',200,'counterfactual_cut',jsonb_build_array('999998','999999'),'rows',smoke.cand_rows())
)"
$PSQL -c "do \$smk\$ begin $(finalize_sql "$hg_happy") end \$smk\$;" >/dev/null || fail "hard-gate happy finalize failed"
HGGE=$($PSQL -t -A -c "select distinct gate_eligible_size from tier0_candidates_150_shadow where period_key='2026-06' and arm='sector-hard-gate';")
[ "$HGGE" = "200" ] || fail "hard-gate gate_eligible_size not persisted (got $HGGE)"
$PSQL -t -A -c "select distinct counterfactual_cut::text from tier0_candidates_150_shadow where period_key='2026-06' and arm='sector-hard-gate' limit 1;" | grep -q '999999' || fail "hard-gate counterfactual_cut not round-tripped"
echo "ok: G hard-gate happy persists (gate_eligible_size=200 + counterfactual_cut round-trip)"
# incomplete_run: gate_eligible_size<150 allowed, 150-gate + matching-snapshot gate SKIPPED, status persisted.
hg_incomplete="jsonb_build_array(
  jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows()),
  jsonb_build_object('arm','sector-hard-gate','status','incomplete_run','gate_eligible_size',10,'rows',(select jsonb_agg(e) from (select e from jsonb_array_elements(smoke.cand_rows()) e limit 30) z))
)"
$PSQL -c "do \$smk\$ begin $(finalize_sql "$hg_incomplete") end \$smk\$;" >/dev/null || fail "hard-gate incomplete_run finalize failed"
HGST=$($PSQL -t -A -c "select distinct status from tier0_candidates_150_shadow where period_key='2026-06' and arm='sector-hard-gate';")
[ "$HGST" = "incomplete_run" ] || fail "hard-gate incomplete_run status not persisted (got $HGST)"
HGN=$($PSQL -t -A -c "select count(*) from tier0_candidates_150_shadow where period_key='2026-06' and arm='sector-hard-gate';")
[ "$HGN" = "30" ] || fail "hard-gate incomplete_run rows expected 30 (150-gate skipped), got $HGN"
echo "ok: G hard-gate incomplete_run skips 150-gate (status=incomplete_run, 30 rows)"
# incomplete_run still typed-guards per-row FORMAT (the INSERT casts rank/score for ALL statuses): a malformed
#   rank in a non-logged arm must raise row_invalid, NOT opaque 22P02 (format guard moved out of the logged block).
hg_inc_bad="jsonb_build_array(
  jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows()),
  jsonb_build_object('arm','sector-hard-gate','status','incomplete_run','gate_eligible_size',10,'rows',(select jsonb_agg(case when (e->>'rank')='1' and e->>'bucket'='short' then jsonb_set(e,'{rank}','\"abc\"') else e end) from (select e from jsonb_array_elements(smoke.cand_rows()) e limit 30) z))
)"
assert_raises "$(finalize_sql "$hg_inc_bad")" "row_invalid" "incomplete_run malformed rank -> row_invalid (non-logged format guard)"
# incomplete_run with a NON-ARRAY rows must raise typed rows_must_be_array (not opaque scalar-extract).
hg_inc_scalar="jsonb_build_array(
  jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows()),
  jsonb_build_object('arm','sector-hard-gate','status','incomplete_run','gate_eligible_size',10,'rows','oops')
)"
assert_raises "$(finalize_sql "$hg_inc_scalar")" "rows_must_be_array" "incomplete_run non-array rows -> rows_must_be_array"
$PSQL -c "do \$smk\$ begin $(finalize_sql "$mirror_soft_arms") end \$smk\$;" >/dev/null || fail "restore after G failed"

# ---------------------------------------------------------------------------
# H: snapshot_row_invalid (typed) + FIX-B numeric typed guards + unresolved happy/reject.
# ---------------------------------------------------------------------------
say "H snapshot_row_invalid + FIX-B numeric guards + unresolved"
# snapshot malformed sector -> snapshot_row_invalid (typed, not opaque table CHECK)
bad_snap_sector="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-H','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size',200,'snapshot_rows',(select jsonb_agg(case when (e->>'ticker')='000001' then jsonb_set(e,'{sector}','\"조선\"') else e end) from jsonb_array_elements(smoke.snap_rows(200)) e),'arms',jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows())),'unresolved_rows','[]'::jsonb));"
assert_raises "$bad_snap_sector" "snapshot_row_invalid" "H snapshot malformed sector -> snapshot_row_invalid"
# snapshot non-numeric tier0_score -> snapshot_row_invalid (FIX-B; not opaque 22P02)
bad_snap_score="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-H2','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size',200,'snapshot_rows',(select jsonb_agg(case when (e->>'ticker')='000001' then jsonb_set(e,'{tier0_score}','\"abc\"') else e end) from jsonb_array_elements(smoke.snap_rows(200)) e),'arms',jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows())),'unresolved_rows','[]'::jsonb));"
assert_raises "$bad_snap_score" "snapshot_row_invalid" "H snapshot non-numeric tier0_score -> snapshot_row_invalid (FIX-B)"
bad_snap_rank_big="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-H3','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size',200,'snapshot_rows',(select jsonb_agg(case when (e->>'ticker')='000001' then jsonb_set(e,'{rank}','\"99999999999\"') else e end) from jsonb_array_elements(smoke.snap_rows(200)) e),'arms',jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows())),'unresolved_rows','[]'::jsonb));"
assert_raises "$bad_snap_rank_big" "snapshot_row_invalid" "H snapshot overflow rank -> snapshot_row_invalid (FIX-B)"
# candidate non-numeric rank -> row_invalid (FIX-B; not opaque 22P02)
bad_cand_rank="$(finalize_sql "jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',(select jsonb_agg(case when (e->>'rank')='1' and e->>'bucket'='short' then jsonb_set(e,'{rank}','\"abc\"') else e end) from jsonb_array_elements(smoke.cand_rows()) e)))")"
assert_raises "$bad_cand_rank" "row_invalid" "H candidate non-numeric rank -> row_invalid (FIX-B)"
bad_cand_rank_big="$(finalize_sql "jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',(select jsonb_agg(case when (e->>'rank')='1' and e->>'bucket'='short' then jsonb_set(e,'{rank}','\"99999999999\"') else e end) from jsonb_array_elements(smoke.cand_rows()) e)))")"
assert_raises "$bad_cand_rank_big" "row_invalid" "H candidate overflow rank -> row_invalid (FIX-B)"
bad_cand_score_big="$(finalize_sql "jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',(select jsonb_agg(case when (e->>'rank')='1' and e->>'bucket'='short' then jsonb_set(e,'{tier0_score}','\"10000000000\"') else e end) from jsonb_array_elements(smoke.cand_rows()) e)))")"
assert_raises "$bad_cand_score_big" "row_invalid" "H candidate overflow tier0_score -> row_invalid (FIX-B)"
# unresolved happy: 1 valid row persists
uok="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-U','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size',200,'snapshot_rows',smoke.snap_rows(200),'arms',jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows())),'unresolved_rows',jsonb_build_array(jsonb_build_object('ticker','555555','name','u1','induty_code','264','sector_source','unresolved'))));"
$PSQL -c "do \$smk\$ begin $uok end \$smk\$;" >/dev/null || fail "unresolved happy finalize failed"
UN=$($PSQL -t -A -c "select count(*) from tier0_shadow_unresolved_issues where period_key='2026-06' and run_id='run-U';")
[ "$UN" = "1" ] || fail "unresolved row not persisted (got $UN)"
echo "ok: H unresolved happy persists 1 row"
# unresolved reject: bad sector_source -> unresolved_row_invalid
ubad="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-U2','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size',200,'snapshot_rows',smoke.snap_rows(200),'arms',jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows())),'unresolved_rows',jsonb_build_array(jsonb_build_object('ticker','555555','sector_source','garbage'))));"
assert_raises "$ubad" "unresolved_row_invalid" "H unresolved bad sector_source -> unresolved_row_invalid"
# FIX-B last cast boundary: malformed run_date -> bad_run_date (typed, not opaque 22007).
bad_rundate="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-RD','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size',200,'run_date','not-a-timestamp','snapshot_rows',smoke.snap_rows(200),'arms',jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows())),'unresolved_rows','[]'::jsonb));"
assert_raises "$bad_rundate" "bad_run_date" "H malformed run_date -> bad_run_date (FIX-B)"
$PSQL -c "do \$smk\$ begin $(finalize_sql "$mirror_soft_arms") end \$smk\$;" >/dev/null || fail "restore after H failed"

# ---------------------------------------------------------------------------
# 150 contract + period/month + ticker/sector enums (table CHECK 2nd defense).
# ---------------------------------------------------------------------------
say "150 contract + identity rejects"
# period/month mismatch
pm="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-07','run_id','run-A','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size',200,'snapshot_rows', smoke.snap_rows(200),'arms', $mirror_arm,'unresolved_rows','[]'::jsonb));"
assert_raises "$pm" "period_month_mismatch" "period_key vs month mismatch"
bad_month="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-99','run_id','run-A','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size',200,'snapshot_rows', smoke.snap_rows(200),'arms', $mirror_arm,'unresolved_rows','[]'::jsonb));"
assert_raises "$bad_month" "bad_month" "invalid calendar month -> bad_month"
# universe_size < 150
us="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-A','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size',100,'snapshot_rows', smoke.snap_rows(200),'arms', $mirror_arm,'unresolved_rows','[]'::jsonb));"
assert_raises "$us" "bad_universe_size" "universe_size<150"
bad_uuid="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-A','hypothesis_id','not-a-uuid','universe_hash','hashA','universe_size',200,'snapshot_rows', smoke.snap_rows(200),'arms', $mirror_arm,'unresolved_rows','[]'::jsonb));"
assert_raises "$bad_uuid" "bad_hypothesis_id" "malformed hypothesis_id -> bad_hypothesis_id"
bad_us_text="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-A','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size','abc','snapshot_rows', smoke.snap_rows(200),'arms', $mirror_arm,'unresolved_rows','[]'::jsonb));"
assert_raises "$bad_us_text" "bad_universe_size" "non-numeric universe_size -> bad_universe_size"
bad_us_big="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-06','month','2026-06','run_id','run-A','hypothesis_id','$ABS_ID'::text,'universe_hash','hashA','universe_size','99999999999','snapshot_rows', smoke.snap_rows(200),'arms', $mirror_arm,'unresolved_rows','[]'::jsonb));"
assert_raises "$bad_us_big" "bad_universe_size" "overflow universe_size -> bad_universe_size"
# candidate row sector='조선' (sub_tag, not canonical) -> FIX-C typed row_invalid (table CHECK is 2nd defense).
badsec="jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',(select jsonb_agg(case when (e->>'rank')='1' and e->>'bucket'='short' then jsonb_set(e,'{sector}','\"조선\"') else e end) from jsonb_array_elements(smoke.cand_rows()) e)))"
assert_raises "$(finalize_sql "$badsec")" "row_invalid" "candidate sector='조선' typed row_invalid (FIX-C)"
# candidate sector='unresolved' is ALLOWED (shadow relaxation):
ok_unres="$(finalize_sql "jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',(select jsonb_agg(jsonb_set(e,'{sector}','\"unresolved\"')) from jsonb_array_elements(smoke.cand_rows()) e)))")"
$PSQL -c "do \$smk\$ begin $ok_unres end \$smk\$;" >/dev/null || fail "candidate sector='unresolved' should be allowed (shadow)"
echo "ok: sector='unresolved' allowed in shadow candidates"

# ---------------------------------------------------------------------------
# canonical-14 parity: SQL CHECK enum == canonical-sectors.ts (order-independent set).
# ---------------------------------------------------------------------------
say "canonical-14 parity SQL == canonical-sectors.ts"
# extract the 14 from the table CHECK on candidates (excluding 'unresolved').
#   emit one-per-line UNSORTED; both sides sorted in-shell with LC_ALL=C for locale-stable set compare.
SQL14=$($PSQL -t -A -c "
  with raw as (
    select unnest(regexp_matches(pg_get_constraintdef(oid),'''([^'']+)''','g')) v
    from pg_constraint where conrelid='tier0_candidates_150_shadow'::regclass and contype='c'
      and pg_get_constraintdef(oid) like '%sector%바이오%'
  )
  select v from raw where v <> 'unresolved';
" | sed '/^$/d' | LC_ALL=C sort | paste -sd'|' -)
# extract ONLY the quoted tokens inside the `export const CANONICAL_SECTORS ... ] as const;` block.
TS14=$(awk '
  /export const CANONICAL_SECTORS/ {f=1; next}
  f && /\] as const/ {exit}
  f {
    while (match($0, /"[^"]+"/)) {
      tok=substr($0, RSTART+1, RLENGTH-2); print tok;
      $0=substr($0, RSTART+RLENGTH);
    }
  }
' "$CANON_TS" | LC_ALL=C sort | paste -sd'|' -)
# Python CANONICAL_SECTORS tuple (3rd source, §8 FIX-I) — block delimited by `= (` ... `)`.
PY_SRC="${HERE}/canonical_sector_mapper.py"
PY14=""
if [ -f "$PY_SRC" ]; then
  PY14=$(awk '
    /CANONICAL_SECTORS: tuple/ {f=1; next}
    f && /^\)/ {exit}
    f {
      while (match($0, /"[^"]+"/)) {
        tok=substr($0, RSTART+1, RLENGTH-2); print tok;
        $0=substr($0, RSTART+RLENGTH);
      }
    }
  ' "$PY_SRC" | LC_ALL=C sort | paste -sd'|' -)
fi
[ -n "$SQL14" ] || fail "could not extract SQL 14-sector enum"
[ -n "$TS14" ] || fail "could not extract canonical-sectors.ts 14-sector set"
[ -n "$PY14" ] || fail "could not extract Python CANONICAL_SECTORS tuple"
if [ "$SQL14" != "$TS14" ] || [ "$SQL14" != "$PY14" ]; then
  printf 'SQL: %s\nTS : %s\nPY : %s\n' "$SQL14" "$TS14" "$PY14" >&2
  fail "canonical-14 set mismatch (SQL == TS == Python required)"
fi
NSEC=$(awk -F'|' '{print NF}' <<<"$SQL14")
[ "$NSEC" = "14" ] || fail "canonical set should be 14 distinct, got $NSEC"
echo "ok: canonical-14 SQL == canonical-sectors.ts == Python (set-equal, 14)"

# ---------------------------------------------------------------------------
# unique constraints exist (structural 2nd defense).
# ---------------------------------------------------------------------------
say "unique constraints"
UC=$($PSQL -t -A -c "select count(*) from pg_constraint where conrelid='tier0_candidates_150_shadow'::regclass and contype='u' and conname in ('shadow_uniq_period_arm_ticker','shadow_uniq_period_arm_bucket_rank');")
[ "$UC" = "2" ] || fail "expected 2 unique constraints on candidates, got $UC"
echo "ok: 2 unique constraints"

# ---------------------------------------------------------------------------
# weekly/monthly coexistence (F4 note): same month, different period_key -> both persist.
# ---------------------------------------------------------------------------
say "weekly/monthly coexistence"
$PSQL -c "select public.register_shadow_hypothesis('{\"period_key\":\"2026-W25\",\"source\":\"absent\",\"leading_sectors\":[],\"params\":{},\"selection_as_of\":\"2026-06-15T00:05:00Z\",\"hypothesis_hash\":\"absent-w25-h\"}'::jsonb);" >/dev/null
W25=$($PSQL -t -A -c "select id from tier0_shadow_sector_hypothesis where period_key='2026-W25';")
wk="perform public.upsert_tier0_shadow_run(jsonb_build_object('period_key','2026-W25','month','2026-06','run_id','run-W','hypothesis_id','$W25'::text,'universe_hash','hashW','universe_size',200,'snapshot_rows', smoke.snap_rows(200),'arms', jsonb_build_array(jsonb_build_object('arm','production-mirror','status','logged','rows',smoke.cand_rows())),'unresolved_rows','[]'::jsonb));"
$PSQL -c "do \$smk\$ begin $wk end \$smk\$;" >/dev/null || fail "weekly run failed"
COEX=$($PSQL -t -A -c "select count(distinct period_key) from tier0_candidates_150_shadow where month='2026-06-01';")
[ "$COEX" = "2" ] || fail "weekly+monthly should coexist under month=2026-06-01, distinct period_key=$COEX"
echo "ok: 2026-06 + 2026-W25 coexist (month=2026-06-01)"

# ---------------------------------------------------------------------------
# rollback drops ONLY 0039 artifacts.
# ---------------------------------------------------------------------------
say "rollback"
$PSQL -f "$ROLLBACK"
LEFTT=$($PSQL -t -A -c "select count(*) from pg_class where relname like 'tier0_shadow%' or relname='tier0_candidates_150_shadow';")
[ "$LEFTT" = "0" ] || fail "rollback left shadow tables ($LEFTT)"
LEFTF=$($PSQL -t -A -c "select count(*) from pg_proc where proname in ('upsert_tier0_shadow_run','register_shadow_hypothesis','_shadow_write_candidates','_shadow_write_universe_snapshot','_shadow_write_unresolved');")
[ "$LEFTF" = "0" ] || fail "rollback left shadow functions ($LEFTF)"
# rollback file targets only 0039 artifacts (no production identifiers as drop targets):
if grep -nE 'drop[[:space:]]+(table|function)' "$ROLLBACK" | grep -E '\b(tier0_candidates_150|short_list_30)\b' | grep -v '_shadow' >/dev/null; then
  fail "rollback drops a production identifier"
fi
echo "ok: rollback dropped only 0039 artifacts"

say "LOCAL SMOKE PASS"
cat <<'EOF'

============================================================================
USER-ONLY real-connection smoke (run AFTER USER applies 0039 to Supabase).
Claude provides commands + expected output; Claude does NOT execute (T2-I-10).
----------------------------------------------------------------------------
B1  service_role SELECT denied on all 4 shadow tables (REAL service_role key, NOT `set role`):
      for t in tier0_shadow_sector_hypothesis tier0_candidates_150_shadow \
               tier0_shadow_universe_snapshot tier0_shadow_unresolved_issues; do
        psql "$SERVICE_ROLE_CONN" -c "select count(*) from public.$t;"   # EXPECT: permission denied
      done
B2  RPC owner = postgres (superuser) for all 5 funcs + DEFINER write succeeds with EXECUTE-only:
      select pg_get_userbyid(proowner) from pg_proc
        where proname in ('upsert_tier0_shadow_run','register_shadow_hypothesis',
                          '_shadow_write_candidates','_shadow_write_universe_snapshot','_shadow_write_unresolved');
        # EXPECT: all 'postgres'
      -- then via service_role API caller, register_shadow_hypothesis + upsert_tier0_shadow_run with a minimal
      -- valid payload must RETURN the jsonb result (INSERT succeeded despite zero table DML grant).
B3  ALTER DEFAULT PRIVILEGES did NOT silently re-grant service_role SELECT:
      select grantee, privilege_type from information_schema.role_table_grants
        where table_schema='public' and (table_name like 'tier0_shadow%' or table_name='tier0_candidates_150_shadow')
          and grantee='service_role';   # EXPECT: zero rows
      select defaclrole::regrole, defaclobjtype, defaclacl from pg_default_acl;   # inspect default-privilege rules
============================================================================
EOF
