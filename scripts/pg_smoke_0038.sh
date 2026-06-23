#!/usr/bin/env bash
# pg_smoke_0038.sh — docker-free local PG16 smoke for migration 0038_shadow_arm_log (Track 1 PR-A3).
#   Proves the CLAUDE-verifiable surface: table+RLS, grant matrix, RPC introspect/authz, track↔period
#   CHECK, production-snapshot immutability, symmetric cast fail-closed, canonical-14 parity, rollback.
#
# WHAT THIS DOES NOT PROVE (USER-only, real Supabase): real service_role RLS-bypass + JWT→role binding
#   (roles here are plain NOLOGIN, no BYPASSRLS, no PostgREST). The grant MATRIX is real; key mapping is not.
#   No production touch, no Supabase apply, no network (psql = local socket).
#
# Usage: bash scripts/pg_smoke_0038.sh   (PG 16; psql/createdb/dropdb on PATH)
set -euo pipefail

DB="tier0_0038_smoke"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="${HERE}/../tudal/supabase/migrations/0038_shadow_arm_log.sql"
ROLLBACK="${HERE}/../tudal/supabase/migrations/0038_shadow_arm_log.rollback.sql"
CANON_TS="${HERE}/../tudal/src/lib/screening/canonical-sectors.ts"
WORK="$(mktemp -d)"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

PSQL="psql -v ON_ERROR_STOP=1 -X -q -d $DB"
say() { printf '\n=== %s ===\n' "$1"; }
fail() { printf 'PG0038 SMOKE FAIL: %s\n' "$1" >&2; exit 1; }

[ -f "$MIG" ] || fail "migration not found: $MIG"
[ -f "$ROLLBACK" ] || fail "rollback not found: $ROLLBACK"
[ -f "$CANON_TS" ] || fail "canonical-sectors.ts not found: $CANON_TS"

# ---------------------------------------------------------------------------
# 0. production no-diff grep gate: 0038 must not DDL/DML a production table.
# ---------------------------------------------------------------------------
say "production no-diff grep gate"
if grep -nE '(create|alter|drop|insert into|update|delete from)[[:space:]]+.*\b(tier0_candidates_150|short_list_30)\b' "$MIG" \
     | grep -vE '_shadow' | grep -vE '^\s*--' >/dev/null; then
  fail "0038 appears to write/alter a production table"
fi
echo "ok: no production DDL/DML targets in 0038"

say "createdb $DB"
dropdb --if-exists "$DB" >/dev/null 2>&1 || true
createdb "$DB"

# ---------------------------------------------------------------------------
# bootstrap: Supabase stubs (roles NOLOGIN/no-BYPASSRLS, GUC-backed auth.uid/role/is_admin).
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

say "apply 0038"
$PSQL -f "$MIG"
echo "ok: 0038 compiles + applies"

# assert a DO-block snippet RAISES with a message containing $2 (savepoint-isolated; false-green guarded).
assert_raises() {
  local sql="$1"; local needle="$2"; local label="$3"; local out
  out="$($PSQL -t -c "do \$smk\$ begin
    $sql
    raise exception 'SMOKE_NO_ERROR';
  exception when others then
    if sqlerrm not like '%$needle%' then raise exception 'SMOKE_WRONG:%', sqlerrm; end if;
  end \$smk\$;" 2>&1)" || true
  if echo "$out" | grep -q "SMOKE_NO_ERROR"; then fail "$label expected '$needle' but no error raised"; fi
  if echo "$out" | grep -q "SMOKE_WRONG"; then fail "$label expected '$needle' but: $out"; fi
  if [ -n "$(echo "$out" | tr -d '[:space:]')" ] && echo "$out" | grep -qiE "ERROR:|FATAL:|psql:"; then
    fail "$label unexpected psql/syntax error (not the typed '$needle'): $out"
  fi
  echo "ok: $label -> $needle"
}
assert_ok() { $PSQL -c "$1" >/dev/null || fail "$2"; echo "ok: $2"; }

# valid production-snapshot payload (short: 10 distinct 6-digit, all assigned_timeframe='short').
PROD_PAYLOAD='{"month":"2026-06","period_key":"s:2026-06-15","track":"short","arm":"production-snapshot","run_id":"r1","status":"logged","selected":[{"ticker":"000001","assigned_timeframe":"short"},{"ticker":"000002","assigned_timeframe":"short"},{"ticker":"000003","assigned_timeframe":"short"},{"ticker":"000004","assigned_timeframe":"short"},{"ticker":"000005","assigned_timeframe":"short"},{"ticker":"000006","assigned_timeframe":"short"},{"ticker":"000007","assigned_timeframe":"short"},{"ticker":"000008","assigned_timeframe":"short"},{"ticker":"000009","assigned_timeframe":"short"},{"ticker":"000010","assigned_timeframe":"short"}]}'

# ---------------------------------------------------------------------------
# A-EXIST-RLS
# ---------------------------------------------------------------------------
say "A-EXIST-RLS"
N=$($PSQL -t -A -c "select count(*) from pg_class where relname='shadow_arm_log' and relkind='r';")
[ "$N" = "1" ] || fail "shadow_arm_log table missing"
RLS=$($PSQL -t -A -c "select relrowsecurity from pg_class where relname='shadow_arm_log';")
[ "$RLS" = "t" ] || fail "RLS not enabled"
echo "ok: table + RLS enabled"

# ---------------------------------------------------------------------------
# A-GRANT-MATRIX: authenticated/service_role SELECT only; NO insert/update/delete; anon none.
# ---------------------------------------------------------------------------
say "A-GRANT-MATRIX"
g() { $PSQL -t -A -c "select count(*) from information_schema.role_table_grants where table_name='shadow_arm_log' and grantee='$1' and privilege_type='$2';"; }
[ "$(g authenticated SELECT)" = "1" ] || fail "authenticated SELECT grant missing"
[ "$(g service_role SELECT)" = "1" ] || fail "service_role SELECT grant missing (§5.2 Track-1 reconcile)"
for role in authenticated service_role anon; do
  for priv in INSERT UPDATE DELETE; do
    [ "$(g $role $priv)" = "0" ] || fail "$role must NOT have $priv (RPC-only writes)"
  done
done
[ "$(g anon SELECT)" = "0" ] || fail "anon must NOT have SELECT"
echo "ok: grant matrix (auth+service_role SELECT only; no DML; anon none)"

# anon RESTRICTIVE deny policy + admin select policy present.
P=$($PSQL -t -A -c "select count(*) from pg_policies where tablename='shadow_arm_log' and policyname in ('shadow_arm_log admin select','shadow_arm_log anon block');")
[ "$P" = "2" ] || fail "expected admin-select + anon-block policies, got $P"
echo "ok: admin-select + anon-block policies present"

# direct-DML denial by EXECUTION (omxy residual): SET ROLE + attempted INSERT → permission denied
# (grant matrix proves the absence; this proves the actual write is blocked, not just un-granted).
assert_raises "set local role service_role; insert into public.shadow_arm_log(month,period_key,track,arm,run_date,selected) values('2026-06','s:2026-06-15','short','production-snapshot',now(),'[]'::jsonb);" "permission denied" "service_role direct INSERT denied"
assert_raises "set local role authenticated; insert into public.shadow_arm_log(month,period_key,track,arm,run_date,selected) values('2026-06','s:2026-06-15','short','production-snapshot',now(),'[]'::jsonb);" "permission denied" "authenticated direct INSERT denied"

# ---------------------------------------------------------------------------
# A-RPC-INTROSPECT: prosecdef + search_path + EXECUTE grant matrix.
# ---------------------------------------------------------------------------
say "A-RPC-INTROSPECT"
SEC=$($PSQL -t -A -c "select prosecdef from pg_proc where proname='upsert_shadow_arm_log';")
[ "$SEC" = "t" ] || fail "upsert_shadow_arm_log not SECURITY DEFINER"
SP=$($PSQL -t -A -c "select array_to_string(proconfig,',') from pg_proc where proname='upsert_shadow_arm_log';")
echo "$SP" | grep -q "search_path=public, pg_temp" || fail "RPC search_path not pinned (got: $SP)"
ex() { $PSQL -t -A -c "select has_function_privilege('$1','public.upsert_shadow_arm_log(jsonb)','execute');"; }
[ "$(ex service_role)" = "t" ] || fail "service_role missing EXECUTE"
[ "$(ex authenticated)" = "f" ] || fail "authenticated must NOT have EXECUTE (stage 0)"
[ "$(ex anon)" = "f" ] || fail "anon must NOT have EXECUTE"
echo "ok: prosecdef + search_path + EXECUTE grants (service_role only)"

# ---------------------------------------------------------------------------
# A-HAPPY: production-snapshot insert + immutability (re-insert no-op, same id).
# ---------------------------------------------------------------------------
say "A-HAPPY production-snapshot insert + immutable"
ID1=$($PSQL -t -A -c "select public.upsert_shadow_arm_log('$PROD_PAYLOAD'::jsonb);")
[ -n "$ID1" ] || fail "production-snapshot insert returned null"
# re-insert with a DIFFERENT run_id must NOT update (immutable) and must return the SAME id.
PROD2=$(echo "$PROD_PAYLOAD" | sed 's/"run_id":"r1"/"run_id":"r2"/')
ID2=$($PSQL -t -A -c "select public.upsert_shadow_arm_log('$PROD2'::jsonb);")
[ "$ID1" = "$ID2" ] || fail "production-snapshot re-insert returned different id (not immutable)"
RUNID=$($PSQL -t -A -c "select run_id from public.shadow_arm_log where id='$ID1';")
[ "$RUNID" = "r1" ] || fail "production-snapshot was mutated (run_id=$RUNID, expected r1)"
echo "ok: production-snapshot inserted + immutable"

# non-production arm upsert DOES update.
SOFT='{"month":"2026-06","period_key":"s:2026-06-15","track":"short","arm":"sector-soft-reserve","run_id":"r1","status":"logged","shadow_eval_k":2,"sector_view":{"source":"manual_pre_registered","leadingSectors":["바이오"],"asOf":"2026-06-01T00:00:00Z"},"selected":[{"ticker":"000001","assigned_timeframe":"short"},{"ticker":"000002","assigned_timeframe":"short"},{"ticker":"000003","assigned_timeframe":"short"},{"ticker":"000004","assigned_timeframe":"short"},{"ticker":"000005","assigned_timeframe":"short"},{"ticker":"000006","assigned_timeframe":"short"},{"ticker":"000007","assigned_timeframe":"short"},{"ticker":"000008","assigned_timeframe":"short"},{"ticker":"000009","assigned_timeframe":"short"},{"ticker":"000011","assigned_timeframe":"short"}]}'
SID1=$($PSQL -t -A -c "select public.upsert_shadow_arm_log('$SOFT'::jsonb);")
SOFT2=$(echo "$SOFT" | sed 's/"shadow_eval_k":2/"shadow_eval_k":3/')
SID2=$($PSQL -t -A -c "select public.upsert_shadow_arm_log('$SOFT2'::jsonb);")
[ "$SID1" = "$SID2" ] || fail "soft-reserve upsert created a new row (expected update)"
K=$($PSQL -t -A -c "select shadow_eval_k from public.shadow_arm_log where id='$SID1';")
[ "$K" = "3" ] || fail "soft-reserve upsert did not update shadow_eval_k (got $K)"
echo "ok: non-production arm upsert updates in place"

# ---------------------------------------------------------------------------
# A-FAILCLOSED: validation + symmetric cast guards (typed errors, no raw leak).
# ---------------------------------------------------------------------------
say "A-FAILCLOSED"
# bad(): mutate PROD_PAYLOAD via a python expr passed as a SINGLE bash arg (single-quoted → no brace
# expansion / nested-quote mangling). python dicts use DOUBLE quotes; output keeps UTF-8 (Korean).
bad() { echo "$PROD_PAYLOAD" | python3 -c 'import sys,json;d=json.load(sys.stdin);exec(sys.argv[1]);print(json.dumps(d,ensure_ascii=False))' "$1"; }
chk() { local p="$1" needle="$2" label="$3"; assert_raises "perform public.upsert_shadow_arm_log('$p'::jsonb);" "$needle" "$label"; }

assert_raises "perform public.upsert_shadow_arm_log('null'::jsonb);" "payload_must_be_object" "null payload"
chk "$(bad 'd["track"]="weekly"')" "bad_track" "bad track"
chk "$(bad 'd["arm"]="nope"')" "bad_arm" "bad arm"
chk "$(bad 'd["period_key"]="m:2026-06"')" "bad_period_for_track" "cross-track period"
chk "$(bad 'd["month"]="2026-6"')" "bad_month" "bad month"
chk "$(bad 'd["production_k"]=1')" "production_k_must_be_zero" "production_k=1"
chk "$(bad 'd["production_k"]="abc"')" "bad_production_k" "non-numeric production_k"
chk "$(bad 'd["production_k"]="2147483648"')" "bad_production_k" "overflow production_k"
chk "$(bad 'd["shadow_eval_k"]="x"')" "bad_shadow_eval_k" "non-numeric shadow_eval_k"
chk "$(bad 'd["shadow_eval_k"]="2147483648"')" "bad_shadow_eval_k" "overflow shadow_eval_k"
chk "$(bad 'd["run_date"]="not-a-date"')" "bad_run_date" "bad run_date cast"
chk "$(bad 'd["sector_view"]={"source":"manual_pre_registered","leadingSectors":["바이오"],"asOf":"not-a-date"}')" "bad_sector_asof" "bad sector asOf cast"
chk "$(bad 'd["sector_view"]={"source":"manual_pre_registered","leadingSectors":["NotASector"],"asOf":"2026-06-01T00:00:00Z"}')" "bad_canonical_sector" "non-canonical sector"
chk "$(bad 'd["selected"]=d["selected"][:9]')" "selected_count_mismatch" "selected count!=10"
chk "$(bad 'd["selected"][1]["ticker"]="000001"')" "selected_duplicate_ticker" "duplicate ticker"
chk "$(bad 'd["selected"][0]["assigned_timeframe"]="mid"')" "selected_row_invalid" "short arm with mid pick"
chk "$(bad 'd["status"]="invalid_input"')" "production_snapshot_status_must_be_logged" "production-snapshot non-logged"
# C1 (ce-* MED): null/absent track & arm → typed bad_track/bad_arm (NOT raw 23502).
chk "$(bad 'd["track"]=None')" "bad_track" "null track (C1)"
chk "$(bad 'd["arm"]=None')" "bad_arm" "null arm (C1)"
chk "$(bad 'del d["track"]')" "bad_track" "absent track key (C1)"
chk "$(bad 'del d["arm"]')" "bad_arm" "absent arm key (C1)"

# midlong path (L2 partial): valid 10 mid + 10 long inserts; 11/9 split rejected.
say "A-MIDLONG"
MIDLONG_PAYLOAD=$(python3 -c 'import json;sel=[{"ticker":f"{i:06d}","assigned_timeframe":"mid" if i<=10 else "long"} for i in range(1,21)];print(json.dumps({"month":"2026-06","period_key":"m:2026-06","track":"midlong","arm":"production-snapshot","run_id":"rm","status":"logged","selected":sel}))')
MID1=$($PSQL -t -A -c "select public.upsert_shadow_arm_log('$MIDLONG_PAYLOAD'::jsonb);")
[ -n "$MID1" ] || fail "midlong production-snapshot insert returned null"
echo "ok: midlong (10 mid + 10 long) inserted"
badmid() { echo "$MIDLONG_PAYLOAD" | python3 -c 'import sys,json;d=json.load(sys.stdin);exec(sys.argv[1]);print(json.dumps(d,ensure_ascii=False))' "$1"; }
assert_raises "perform public.upsert_shadow_arm_log('$(badmid 'd["selected"][10]["assigned_timeframe"]="mid"')'::jsonb);" "selected_midlong_count_mismatch" "midlong 11mid/9long split"
assert_raises "perform public.upsert_shadow_arm_log('$(badmid 'd["period_key"]="s:2026-06-15"')'::jsonb);" "bad_period_for_track" "midlong with short period_key"

# ---------------------------------------------------------------------------
# A-CHECK: track↔period_key table CHECK rejects mismatched direct insert (defense-in-depth).
# ---------------------------------------------------------------------------
say "A-CHECK track/period constraint"
assert_raises "insert into public.shadow_arm_log(month,period_key,track,arm,run_date,selected) values ('2026-06','m:2026-06','short','production-snapshot',now(),'[]'::jsonb);" "shadow_arm_log_track_period_consistent" "table CHECK track/period mismatch"

# ---------------------------------------------------------------------------
# A-CANON-PARITY: SQL bad_canonical_sector enum == canonical-sectors.ts CANONICAL_SECTORS (14, set).
# ---------------------------------------------------------------------------
say "A-CANON-PARITY"
TS_SET=$(python3 - "$CANON_TS" <<'PY'
import re,sys
src=open(sys.argv[1],encoding='utf-8').read()
m=re.search(r'CANONICAL_SECTORS[^=]*=\s*\[(.*?)\]\s*as const', src, re.S)
secs=sorted(re.findall(r'"([^"]+)"', m.group(1)))
print('|'.join(secs))
PY
)
SQL_SET=$(python3 - "$MIG" <<'PY'
import re,sys
src=open(sys.argv[1],encoding='utf-8').read()
# the bad_canonical_sector guard line lists the 14 inline.
m=re.search(r"where s\.sector not in \((.*?)\)\s*\n\s*\) then raise exception 'bad_canonical_sector'", src, re.S)
secs=sorted(re.findall(r"'([^']+)'", m.group(1)))
print('|'.join(secs))
PY
)
[ -n "$TS_SET" ] || fail "could not extract CANONICAL_SECTORS from .ts"
[ "$TS_SET" = "$SQL_SET" ] || fail "canonical-14 drift: SQL[$SQL_SET] != TS[$TS_SET]"
echo "ok: canonical-14 parity (SQL == canonical-sectors.ts)"

# ---------------------------------------------------------------------------
# A-RLS-SELECT: anon denied (grant absent); authenticated non-admin 0 rows; admin sees rows.
# ---------------------------------------------------------------------------
say "A-RLS-SELECT"
assert_raises "set local role anon; perform 1 from public.shadow_arm_log;" "permission denied" "anon SELECT denied"
NONADMIN=$($PSQL -t -A -c "begin; set local role authenticated; select set_config('smoke.is_admin','false',true); select count(*) from public.shadow_arm_log; rollback;" | tail -1)
[ "$NONADMIN" = "0" ] || fail "authenticated non-admin should see 0 rows (RLS), got $NONADMIN"
ADMIN=$($PSQL -t -A -c "begin; set local role authenticated; select set_config('smoke.is_admin','true',true); select count(*) from public.shadow_arm_log; rollback;" | tail -1)
[ "$ADMIN" -ge 1 ] || fail "authenticated admin should see rows, got $ADMIN"
echo "ok: anon denied / non-admin 0 rows / admin sees rows"

# ---------------------------------------------------------------------------
# A-ROLLBACK: rollback drops only 0038 artifacts.
# ---------------------------------------------------------------------------
say "A-ROLLBACK"
$PSQL -f "$ROLLBACK"
GONE=$($PSQL -t -A -c "select count(*) from pg_class where relname='shadow_arm_log';")
[ "$GONE" = "0" ] || fail "rollback did not drop shadow_arm_log"
FGONE=$($PSQL -t -A -c "select count(*) from pg_proc where proname='upsert_shadow_arm_log';")
[ "$FGONE" = "0" ] || fail "rollback did not drop upsert_shadow_arm_log"
echo "ok: rollback drops 0038 artifacts only"

printf '\nPG0038 SMOKE PASS\n'
