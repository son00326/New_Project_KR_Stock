#!/usr/bin/env python3
# noqa: SIZE_OK - one-shot MECHANICAL dry-run driver; not shipped runtime code.
"""주픽(JooPick) — Track-2 sector generator-shadow END-TO-END MECHANICAL dry-run driver.

╔══════════════════════════════════════════════════════════════════════════════════════╗
║ PURPOSE — MECHANICAL / ILLUSTRATIVE ONLY. NOT a statistical go/no-go, NOT a verdict.   ║
╚══════════════════════════════════════════════════════════════════════════════════════╝

이 드라이버는 Track-2 (generator-shadow) 파이프라인의 전 체인이 **배선돼 있고**
forward-recall 검증기가 **정직하게 동작**함을 증명한다:

   gen (shadow_gen_core.compute_shadow_selections)
     → runner (shadow_gen_runner.assemble_finalize_payload)
       → local PG RPC (upsert_tier0_shadow_run, applied migration 0039)
         → reconcile (shadow_reconcile.RECONCILE_GAP_SQL → classify_coverage_row)
           → Query-2 extract (shadow_eval.SHADOW_RUN_EXTRACT_SQL, owner psql)
             → forward-recall evaluator (validate_tier0_ic.py --shadow-eval)

두 시나리오로 검증기 정직성을 증명한다:
  (a) period < pre-registered floor → run_verdict = INCOMPLETE_RUN
      — 이건 버그가 아니라 "데이터 부족"의 정직한 상태다.
  (b) 합성 ≥floor 다-period fixture → 숫자 결과가 나오되 Gate B = NOT_APPLICABLE(Stage 1)라
      상한이 DIRECTIONAL로 캡핑된다 — PASS는 구조적으로 도달 불가.

⚠️  섹터맵은 current-only 아티팩트(spec §0.3/§9)라 과거 백테스트가 불가능하다. 여기의 모든
    가설(leading_sectors)·가격 경로는 100% 합성이며 명시적으로 MECHANICAL/illustrative다.
    산출되는 recall/lift 숫자는 예측적 의미가 전혀 없다("상승 예측" claim 절대 금지, D30 no-apply).

PRODUCTION 무접촉:
  - 고유명 throwaway 로컬 PG DB를 생성하고 끝나면 dropdb 한다. Supabase·네트워크·production
    테이블·--apply 전부 없다. forward 패널은 이 드라이버가 쓴 **합성 캐시**다.
  - 단, REAL 마이그레이션(0038/0039/0046)과 REAL 배포 코드(PR-B1/PR-B3/reconcile/eval)를
    바이트 그대로 실행한다 — production writer는 절대 경유하지 않는다.

USAGE:  scripts/.venv/bin/python scripts/shadow_e2e_local_dryrun.py
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import tempfile
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

_THIS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _THIS_DIR.parent
if str(_THIS_DIR) not in sys.path:
    sys.path.insert(0, str(_THIS_DIR))

# REAL shipped code (byte-unchanged) — the exact pieces the pipeline uses in production.
import shadow_gen_core as SG          # noqa: E402  PR-B1 pure compute
import shadow_gen_runner as SR        # noqa: E402  PR-B3 payload builders
import shadow_eval as SE              # noqa: E402  PR-B5 evaluator + panel-day + Query-2 SQL
import tier0_factors as TF            # noqa: E402  StockRaw / scoring
from canonical_sector_mapper import CANONICAL_SECTORS  # noqa: E402

MIG_0038 = _REPO_ROOT / "tudal/supabase/migrations/0038_shadow_arm_log.sql"
MIG_0039 = _REPO_ROOT / "tudal/supabase/migrations/0039_tier0_candidates_150_shadow.sql"
MIG_0046 = _REPO_ROOT / "tudal/supabase/migrations/0046_tier0_shadow_arm_read.sql"
RECONCILE = _THIS_DIR / "shadow_reconcile.py"
VALIDATE = _THIS_DIR / "validate_tier0_ic.py"
VENV_PY = _REPO_ROOT / "scripts/.venv/bin/python"
PYBIN = str(VENV_PY) if VENV_PY.exists() else sys.executable

# unique throwaway DB name.
DB = f"tier0_shadow_e2e_{int(time.time())}_{os.getpid()}"

# Hermetic subprocess env. Inherited PGHOST / DATABASE_URL / Supabase env would make a
# "local dry-run" claim unsafe. KRX_OPENAPI_KEY is scrubbed too so that if the synthetic
# panel cache ever misses a day the eval fails closed instead of hitting live KRX (the
# env-scrub is NOT what blocks KRX by itself — cache-completeness is — but it makes an
# accidental fetch fail rather than reach the network).
_LOCAL_PG_ENV_BLOCKLIST = {
    "DATABASE_URL",
    "PGHOST",
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "SUPABASE_ANON_KEY",
    "SUPABASE_DB_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_URL",
    "KRX_OPENAPI_KEY",
}
_LOCAL_PG_ENV = {
    key: value for key, value in os.environ.items()
    if key not in _LOCAL_PG_ENV_BLOCKLIST
}

# synthetic universe / winner design (MECHANICAL) --------------------------------------
N_TICKERS = 200                                    # full pre-cut universe = 200 distinct
N_WINNERS = 20                                     # last 20 tickers = strong forward winners
WINNER_START_K = N_TICKERS - N_WINNERS             # k >= 180 → winner
LEADING_SECTOR = "반도체"                            # canonical-14 member present in the universe
TILT_PARAMS = {"tilt_version": "soft_tilt_v1"}     # D7-frozen additive +10
ARMS = "production-mirror,sector-soft-tilt"         # NO hard-gate on this run (soft comparison)
POWER_FLOOR_N = 6                                   # VERDICT floor (>= data floor 6)
N_PERIODS = 8                                       # 8 monthly periods (> power floor)
_SEL_STRIDE = 25                                    # populated-day stride between selections (>=21=HORIZON short)
_SEL_START = 5                                      # first selection at populated index 5
_N_POPULATED = 210                                  # populated trading days (last sel + short horizon matures)

_WORK = Path(tempfile.mkdtemp(prefix="shadow_e2e_"))
_CACHE_DIR = _WORK / "pit_cache_mechanical"        # SYNTHETIC panel cache (never real KRX data)
_ARTIFACTS = _WORK / "artifacts"
_ARTIFACTS.mkdir(parents=True, exist_ok=True)
# verdict lands where the task asks (scripts/out/), clearly named MECHANICAL alongside.
_OUT_DIR = _REPO_ROOT / "scripts/out"
VERDICT_B = _OUT_DIR / "tier0_shadow_recall_verdict.json"           # scenario (b)
VERDICT_A = _OUT_DIR / "tier0_shadow_recall_verdict_incomplete.json"  # scenario (a)


# ===========================================================================
# psql helpers (subprocess; local unix socket — no network)
# ===========================================================================
def _psql(args: list[str], *, check: bool = True, capture: bool = True) -> subprocess.CompletedProcess:
    base = ["psql", "-v", "ON_ERROR_STOP=1", "-X", "-q", "-d", DB]
    return subprocess.run(base + args, check=check, text=True,
                          capture_output=capture, env=_LOCAL_PG_ENV)


def psql_file(path: Path) -> None:
    _psql(["-f", str(path)], capture=True)


def psql_scalar(sql: str) -> str:
    return _psql(["-t", "-A", "-c", sql]).stdout.strip()


def rpc(fn: str, payload: dict) -> dict:
    """Call a SECURITY DEFINER RPC with a jsonb payload; return parsed jsonb result.

    The payload is dollar-quoted ($jq$..$jq$) into a .sql file (same technique as the
    shipped pg_smoke_0039_* scripts) so no shell/SQL escaping of the JSON is needed.
    """
    body = json.dumps(payload, ensure_ascii=False)
    sql_path = _WORK / "_rpc.sql"
    sql_path.write_text(f"select public.{fn}($jq${body}$jq$::jsonb);\n", encoding="utf-8")
    out = _psql(["-t", "-A", "-f", str(sql_path)]).stdout.strip()
    return json.loads(out)


# ===========================================================================
# 1) throwaway DB + roles/auth stub + migrations 0038/0039/0046 + production stub
# ===========================================================================
_BOOTSTRAP_SQL = """\
-- MECHANICAL: Supabase runtime stubs so the REAL migrations/RPCs apply on plain local PG.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('smoke.uid', true),'')::uuid $f$;
-- default role = service_role → RPCs take the service_role write path (no admin gate needed).
create or replace function auth.role() returns text language sql stable as
  $f$ select coalesce(nullif(current_setting('smoke.role', true),''), 'service_role') $f$;
create or replace function public.is_admin() returns boolean language sql stable as
  $f$ select coalesce(nullif(current_setting('smoke.is_admin', true),'')::boolean, false) $f$;
"""


def setup_db(period_months: list[date]) -> None:
    subprocess.run(["dropdb", "--if-exists", DB], check=False,
                   capture_output=True, text=True, env=_LOCAL_PG_ENV)
    subprocess.run(["createdb", DB], check=True, capture_output=True, text=True,
                   env=_LOCAL_PG_ENV)

    boot = _WORK / "bootstrap.sql"
    boot.write_text(_BOOTSTRAP_SQL, encoding="utf-8")
    psql_file(boot)

    # REAL migrations, in dependency order. 0038 (Track-1 shadow_arm_log) + 0046 (arm-read RPC)
    # are NOT on the Track-2 eval path — applied here for migration-set completeness as instructed.
    for mig in (MIG_0038, MIG_0039, MIG_0046):
        if not mig.exists():
            raise SystemExit(f"[ABORT] migration not found: {mig}")
        psql_file(mig)

    # Minimal production-presence stub: RECONCILE_GAP_SQL reads ONLY tier0_candidates_150.month.
    # This is a LOCAL throwaway stub table (production tier0_candidates_150 is on Supabase, untouched).
    rows = ",\n  ".join(
        f"('{m.isoformat()}','100000','short',1)" for m in period_months
    )
    prod = _WORK / "prod_stub.sql"
    prod.write_text(
        "create table if not exists public.tier0_candidates_150 (\n"
        "  month date not null, ticker text not null, bucket text not null, rank int not null\n"
        ");\n"
        f"insert into public.tier0_candidates_150 (month, ticker, bucket, rank) values\n  {rows};\n",
        encoding="utf-8",
    )
    psql_file(prod)


# ===========================================================================
# 2) synthetic universe fixture (proven ≥150-eligible shape) + manual hypothesis
# ===========================================================================
def _bpp_series(n: int, drift: float, wiggle: float = 0.01, phase: float = 0.0) -> list[float]:
    out, value = [], 100.0
    for i in range(n):
        value *= 1.0 + drift + wiggle * math.sin(phase + i * 0.3)
        out.append(value)
    return out


def build_universe() -> tuple[list[TF.StockRaw], list[dict]]:
    """200 synthetic StockRaw (sectors cycle canonical-14 so 반도체 is present) + universe rows.

    Mirrors the proven ≥150-eligible unit-test / pg-smoke recipe. PURE synthetic (MECHANICAL).
    """
    stocks: list[TF.StockRaw] = []
    for k in range(N_TICKERS):
        closes = _bpp_series(280, 0.0005 + 0.00002 * k, phase=k * 0.1)
        stocks.append(TF.StockRaw(
            ticker=f"{100000 + k:06d}",
            sector=CANONICAL_SECTORS[k % len(CANONICAL_SECTORS)],
            market_cap=(k + 1) * 5e10,
            closes=closes,
            trdvals=[5e9 + k * 1e7] * 280,
            highs=list(closes),
            foreign_net_60d=1e9 + k * 1e6,
            earnings_raw=0.05 + 0.001 * k,
            quality_composite_raw=40.0 + (k % 30),
        ))
    universe = [{
        "ticker": s.ticker, "name": f"n{s.ticker}", "sector": s.sector,
        "sector_source": "mapper", "induty_code": "264",
    } for s in stocks]
    return stocks, universe


def build_manual_hypothesis(period_key: str, sel_iso: str, asof_iso: str) -> dict:
    """manual_pre_registered hypothesis (leading_sectors=[반도체], soft_tilt_v1) — MECHANICAL."""
    h = SR.compute_hypothesis_hash(period_key, "manual_pre_registered",
                                   [LEADING_SECTOR], TILT_PARAMS, asof_iso)
    return {
        "period_key": period_key,
        "source": "manual_pre_registered",
        "leading_sectors": [LEADING_SECTOR],
        "params": TILT_PARAMS,
        "as_of": asof_iso,
        "selection_as_of": sel_iso,
        "hypothesis_hash": h,
    }


def build_finalize_payload(hypothesis_id: str, hypothesis: dict, period_key: str,
                           month: date, run_id: str, sel_iso: str,
                           stocks: list[TF.StockRaw], universe: list[dict]) -> dict:
    """REAL PR-B1 (compute_shadow_selections) → REAL PR-B3 (assemble_finalize_payload).

    production writer(screen_shortlist_tier0.persist)는 절대 경유하지 않는다 — 순수 shadow 경로.
    """
    name_by_ticker = {u["ticker"]: u["name"] for u in universe}
    uni_by_ticker = {u["ticker"]: u for u in universe}

    arm_payloads = []
    mirror_result = None
    for arm in ("production-mirror", "sector-soft-tilt"):
        arm_result = SG.compute_shadow_selections(universe, stocks, hypothesis, arm)  # PR-B1
        if arm == "production-mirror":
            mirror_result = arm_result
        arm_payloads.append(SR.build_arm_payload(arm, arm_result, name_by_ticker, month))

    snapshot_rows = SR.build_shadow_snapshot_rows(stocks, uni_by_ticker)               # PR-B3
    unresolved_rows = SR.build_unresolved_rows(universe)
    return SR.assemble_finalize_payload(                                               # PR-B3
        period_key=period_key, month=month, run_id=run_id,
        hypothesis_id=hypothesis_id, hypothesis=hypothesis,
        arm_payloads=arm_payloads, snapshot_rows=snapshot_rows,
        unresolved_rows=unresolved_rows,
        universe_hash=mirror_result["universe_hash"],
        universe_size=mirror_result["universe_size"],
        run_date=sel_iso,
    )


# ===========================================================================
# 4) synthetic PIT panel cache — winners at every horizon (MECHANICAL price paths)
# ===========================================================================
def _panel_close(k: int, day_idx: int) -> float:
    """Linear MECHANICAL price path keyed by populated-day INDEX (not calendar).

    k >= WINNER_START_K → strong monotone rise (positive forward return at any entry).
    else → slow decline (strictly negative forward return) so the top-decile winner set is
    exactly the WINNER tickers. Always > 0.
    """
    if k >= WINNER_START_K:
        return round(10000.0 * (1.0 + 0.015 * day_idx), 2)
    return round(10000.0 * (1.0 - 0.0005 * day_idx), 2)


def build_panel_cache(panel_days: list[str], populated: list[str]) -> None:
    """Write one cache JSON per (market, day) so load_pit_panel NEVER hits the network.

    Populated days carry 200 synthetic tickers in KOSPI; all other days (lookback/forward
    tail) + all KOSDAQ files are empty []. panel.keys() therefore == populated (sorted).
    """
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    pop_index = {d: i for i, d in enumerate(populated)}
    empty = "[]"
    for d in panel_days:
        (_CACHE_DIR / f"KOSDAQ_{d}.json").write_text(empty, encoding="utf-8")
        if d in pop_index:
            di = pop_index[d]
            rows = []
            for k in range(N_TICKERS):
                close = _panel_close(k, di)
                rows.append({
                    "ISU_CD": f"{100000 + k:06d}",
                    "ISU_NM": f"n{100000 + k:06d}",
                    "MKT_NM": "KOSPI",
                    "TDD_CLSPRC": f"{close}",
                    "TDD_HGPRC": f"{round(close * 1.01, 2)}",
                    "ACC_TRDVAL": "5000000000",
                    "MKTCAP": f"{(k + 1) * 5e10:.0f}",
                    "LIST_SHRS": "1000000",
                })
            (_CACHE_DIR / f"KOSPI_{d}.json").write_text(json.dumps(rows), encoding="utf-8")
        else:
            (_CACHE_DIR / f"KOSPI_{d}.json").write_text(empty, encoding="utf-8")


def assert_panel_cache_complete(panel_days: list[str]) -> int:
    """Fail before eval if any market/day cache is missing, so KRX fetch is unreachable."""
    expected = [
        _CACHE_DIR / f"{market}_{d}.json"
        for d in panel_days
        for market in ("KOSPI", "KOSDAQ")
    ]
    missing = [p.name for p in expected if not p.exists()]
    if missing:
        sample = ", ".join(missing[:5])
        raise SystemExit(f"[ABORT] synthetic panel cache incomplete; would risk network fetch: {sample}")
    return len(expected)


# ===========================================================================
# 5) kill-rule + survivorship artifact (synthetic, MECHANICAL)
# ===========================================================================
def build_kill_rule(period_keys: list[str]) -> dict:
    # midlong-only tracks → all monthly periods map to 'midlong'. primary_horizon 'short'
    # keeps the required forward window compact (MECHANICAL). regimes alternate to avoid the
    # single-regime advisory being the only flag (advisory does not change the verdict).
    regimes = ["bull", "bear"]
    return {
        "tracks": {"midlong": {"primary_horizon": "short", "power_floor_n": POWER_FLOOR_N}},
        "regime_vocab": regimes,
        "regime_by_period_key": {pk: regimes[i % 2] for i, pk in enumerate(period_keys)},
        "run_date_stale_max_days": 3650,
        "parameter_lock_commit_hash": "MECHANICAL-dryrun",
        "freeze_tag": "MECHANICAL-illustrative-not-a-verdict",
    }


def build_survivorship() -> list[dict]:
    # exit_status 0 for both markets + dates that bracket ANY forward window (2000..2099) →
    # read_survivorship_artifact returns 'clean'. Synthetic: no real survivorship claim.
    return [
        {"market": m, "old_date": "20000101", "recent_date": "20991231",
         "old_count": 1000, "recent_count": 1000, "gone_count": 0,
         "schema_version": 1, "exit_status": 0}
        for m in ("KOSPI", "KOSDAQ")
    ]


# ===========================================================================
# 6) reconcile + Query-2 + eval subprocess
# ===========================================================================
def run_reconcile() -> Path:
    """RECONCILE_GAP_SQL (owner psql) → raw facts → shadow_reconcile → coverage report."""
    inline = subprocess.run([PYBIN, str(RECONCILE), "--print-sql-inline"],
                            check=True, text=True, capture_output=True).stdout.strip()
    facts = psql_scalar(f"select coalesce(json_agg(t), '[]') from ( {inline} ) t")
    facts_path = _ARTIFACTS / "coverage_raw_facts.json"
    facts_path.write_text(facts, encoding="utf-8")
    report_path = _ARTIFACTS / "coverage_report.json"
    report = subprocess.run([PYBIN, str(RECONCILE), "--coverage-json", str(facts_path)],
                            check=True, text=True, capture_output=True).stdout
    report_path.write_text(report, encoding="utf-8")
    return report_path


def run_query2(period_keys: list[str], start_month: date, end_month: date) -> Path:
    """Query-2 (owner psql) per period → array of per-period extract objects (eval input)."""
    inline = subprocess.run(
        [PYBIN, str(VALIDATE), "--start-month", start_month.isoformat(),
         "--end-month", end_month.isoformat(), "--print-shadow-sql-inline"],
        check=True, text=True, capture_output=True).stdout.strip()
    extracts = []
    for pk in period_keys:
        sub = inline.replace("$1", f"'{pk}'")
        one = psql_scalar(sub)
        extracts.append(json.loads(one))
    path = _ARTIFACTS / "shadow_extract_full.json"
    path.write_text(json.dumps(extracts, ensure_ascii=False), encoding="utf-8")
    return path


def run_eval(extract_path: Path, coverage_path: Path, kill_path: Path,
             surv_path: Path, out_path: Path, start_month: date, end_month: date) -> dict:
    cmd = [
        PYBIN, str(VALIDATE), "--shadow-eval",
        "--start-month", start_month.isoformat(),
        "--end-month", end_month.isoformat(),
        "--shadow-extract-json", str(extract_path),
        "--shadow-coverage-json", str(coverage_path),
        "--kill-rule-file", str(kill_path),
        "--survivorship-artifact", str(surv_path),
        "--cache-dir", str(_CACHE_DIR),
        "--shadow-out", str(out_path),
        "--shadow-arms", ARMS,
    ]
    # env=_LOCAL_PG_ENV: the eval reads only the synthetic --cache-dir; scrubbing KRX_OPENAPI_KEY
    # here makes any accidental cache-miss fetch fail closed instead of reaching live KRX.
    proc = subprocess.run(cmd, text=True, capture_output=True, env=_LOCAL_PG_ENV)
    tail = "\n".join(proc.stderr.strip().splitlines()[-6:])
    print(f"    [eval stderr tail]\n{tail}", file=sys.stderr)
    if proc.returncode != 0:
        raise SystemExit(f"[ABORT] eval exited {proc.returncode}\n{proc.stderr}")
    return json.loads(out_path.read_text())


# ===========================================================================
# main
# ===========================================================================
def main() -> int:
    steps: list[dict] = []

    def step(name: str, result: str, detail: str) -> None:
        steps.append({"step": name, "result": result, "detail": detail})
        print(f"  [{result.upper():5}] {name} — {detail}", file=sys.stderr)

    # ---- date scaffolding (derive periods from the exact panel-day list the eval will use) ----
    start_month = date(2025, 1, 1)
    end_month = date(2025, 11, 1)
    panel_days = SE.shadow_panel_days(start_month, end_month)   # REAL eval panel-day logic
    populated = [d for d in panel_days if d >= "20250101"][:_N_POPULATED]
    if len(populated) < _N_POPULATED:
        raise SystemExit("[ABORT] not enough panel weekdays for populated window")
    sel_indices = [_SEL_START + i * _SEL_STRIDE for i in range(N_PERIODS)]
    if sel_indices[-1] + SE.V.ENTRY_OFFSET_DAYS + SE.V.HORIZON_DAYS["short"] + SE.V.ENTRY_GAP_DAYS >= len(populated):
        raise SystemExit("[ABORT] last selection would not mature in the populated window")

    def _iso(d: str, hh: str) -> str:  # YYYYMMDD → ISO instant (KST)
        return f"{d[:4]}-{d[4:6]}-{d[6:8]}T{hh}+09:00"

    periods = []
    seen_pk: set[str] = set()
    for i, idx in enumerate(sel_indices):
        sel_day = populated[idx]
        asof_day = populated[idx - 1]
        pk = f"{sel_day[:4]}-{sel_day[4:6]}"
        if pk in seen_pk:
            raise SystemExit(f"[ABORT] duplicate period_key from selection spacing: {pk}")
        seen_pk.add(pk)
        periods.append({
            "period_key": pk,
            "month": date(int(sel_day[:4]), int(sel_day[4:6]), 1),
            "sel_iso": _iso(sel_day, "00:05:00"),
            "asof_iso": _iso(asof_day, "00:00:00"),
            "run_id": f"mech-{pk}",
        })
    period_keys = [p["period_key"] for p in periods]
    period_months = [p["month"] for p in periods]
    eval_start = period_months[0]
    eval_end = period_months[-1]
    step("date scaffolding", "pass",
         f"{N_PERIODS} monthly periods {period_keys[0]}..{period_keys[-1]}, "
         f"selections {_SEL_STRIDE} trading-days apart, panel_days={len(panel_days)} populated={len(populated)}")

    # ---- 1) DB + migrations + production stub ----
    setup_db(period_months)
    tables = psql_scalar(
        "select count(*) from information_schema.tables where table_schema='public' "
        "and table_name in ('tier0_candidates_150_shadow','tier0_shadow_universe_snapshot',"
        "'tier0_shadow_sector_hypothesis','tier0_shadow_unresolved_issues','shadow_arm_log','tier0_candidates_150')")
    step("createdb + apply 0038/0039/0046 + prod stub", "pass" if tables == "6" else "fail",
         f"DB={DB} · shadow+arm_log+prod tables present={tables}/6")

    # ---- 2+3) gen → runner → PG RPC, for all periods (production writer NOT invoked) ----
    stocks, universe = build_universe()
    total_candidates = 0
    for p in periods:
        hyp = build_manual_hypothesis(p["period_key"], p["sel_iso"], p["asof_iso"])
        reg = rpc("register_shadow_hypothesis", hyp)                         # 0039 register RPC
        hid = reg["id"]
        payload = build_finalize_payload(hid, hyp, p["period_key"], p["month"],
                                         p["run_id"], p["sel_iso"], stocks, universe)
        res = rpc("upsert_tier0_shadow_run", payload)                        # 0039 finalize RPC
        if res.get("arms") != 2 or res.get("candidates") != 300 or res.get("snapshot") != 3 * N_TICKERS:
            raise SystemExit(f"[ABORT] finalize wrong for {p['period_key']}: {res}")
        total_candidates += res["candidates"]
    # shadow_eval.shadow_panel_days imports screen_shortlist_tier0 for the BPP_LOOKBACK constant.
    # That import is expected; this dry-run never enters screen_shortlist_tier0.main/run_bpp_candidates
    # and writes only through the local 0039 shadow RPC.
    screen_module_imported = "screen_shortlist_tier0" in sys.modules
    step("gen→runner→PG finalize RPC (all periods)", "pass",
         f"{N_PERIODS}×(mirror+soft-tilt) = {total_candidates} shadow candidates via "
         f"upsert_tier0_shadow_run · production writer path not entered "
         f"(screen_shortlist_tier0 imported for BPP_LOOKBACK={screen_module_imported})")

    # ---- 4) reconcile (RECONCILE_GAP_SQL → classify_coverage_row) ----
    coverage_path = run_reconcile()
    cov = json.loads(coverage_path.read_text())
    complete = cov["summary"]["complete"]
    if complete != N_PERIODS:
        raise SystemExit(f"[ABORT] reconcile expected {N_PERIODS} complete, got {cov['summary']}")
    step("reconcile RECONCILE_GAP_SQL → coverage", "pass",
         f"summary={cov['summary']} (all {N_PERIODS} periods 'complete': 150/1-run/all-logged + "
         f"snapshot {N_TICKERS}==universe_size + uniform hash)")

    # ---- 5) Query-2 extract (owner psql) ----
    extract_full = run_query2(period_keys, eval_start, eval_end)
    ext_arr = json.loads(extract_full.read_text())
    n_ext = len(ext_arr)

    def _arm_tickers(e: dict, arm: str) -> set:
        return {c["ticker"] for c in e["candidates"] if c["arm"] == arm}

    # arm-distinctness: sector-soft-tilt must NOT equal production-mirror in every period,
    # else the generator-shadow path is a no-op (e.g. SOFT_TILT_V1_ADDEND regressed to 0) and
    # the "generator-shadow distinct" claim would be vacuous. Guarded, not just true-today.
    arms_distinct = all(
        _arm_tickers(e, "sector-soft-tilt") != _arm_tickers(e, "production-mirror")
        for e in ext_arr
    )
    ok_ext = (n_ext == N_PERIODS and all(e["run_id_count"] == 1 for e in ext_arr)
              and all(len(_arm_tickers(e, "sector-soft-tilt")) == 150 for e in ext_arr)
              and arms_distinct)
    step("Query-2 SHADOW_RUN_EXTRACT_SQL (owner psql)", "pass" if ok_ext else "fail",
         f"{n_ext} period extracts · FIX-J run_id_count==1 · per-arm 150 candidates · "
         f"snapshot distinct==universe_size · soft-tilt≠mirror(arms_distinct={arms_distinct})")

    # ---- 5b) synthetic panel cache + kill-rule + survivorship ----
    build_panel_cache(panel_days, populated)
    # Assert completeness against the EXACT day-list the eval subprocess will request
    # (SE.shadow_panel_days(eval_start, eval_end)), NOT the wider driver list — otherwise a
    # param change pushing eval_end past end_month could leave eval days uncached while this
    # guard (checking the wrong list) stayed green and a live-KRX fetch fired.
    eval_panel_days = SE.shadow_panel_days(eval_start, eval_end)
    n_cache = assert_panel_cache_complete(eval_panel_days)
    kill_path = _ARTIFACTS / "kill_rule.json"
    kill_path.write_text(json.dumps(build_kill_rule(period_keys), ensure_ascii=False), encoding="utf-8")
    surv_path = _ARTIFACTS / "survivorship.json"
    surv_path.write_text(json.dumps(build_survivorship(), ensure_ascii=False), encoding="utf-8")
    step("synthetic panel cache + kill-rule + survivorship", "pass",
         f"{n_cache} cache files (populated={len(populated)}×KOSPI + empties, network-free) · "
         f"power_floor_n={POWER_FLOOR_N} · survivorship exit_status=0")

    # ---- 7a) scenario (a): 1-period extract → INCOMPLETE_RUN (below floor, honest) ----
    extract_a = _ARTIFACTS / "shadow_extract_one.json"
    extract_a.write_text(json.dumps([ext_arr[0]], ensure_ascii=False), encoding="utf-8")
    rep_a = run_eval(extract_a, coverage_path, kill_path, surv_path, VERDICT_A, eval_start, eval_end)
    cell_a = rep_a.get("cells", [])
    reason_a = cell_a[0]["reason_code"] if cell_a else rep_a.get("reason_code")
    a_ok = rep_a["run_verdict"] == "INCOMPLETE_RUN" and rep_a.get("no_apply") is True \
        and not rep_a.get("triple_gate_all_pass") and reason_a == "n_below_data_floor"
    step("scenario (a) below-floor → INCOMPLETE_RUN", "pass" if a_ok else "fail",
         f"run_verdict={rep_a['run_verdict']} · reason={reason_a} · "
         f"triple_gate_all_pass={rep_a.get('triple_gate_all_pass')} · no_apply={rep_a.get('no_apply')} "
         f"(honest 'not enough data' — n=1 < data floor {SE._DATA_FLOOR})")

    # ---- 7b) scenario (b): all-period extract → numbers but capped DIRECTIONAL (never PASS) ----
    rep_b = run_eval(extract_full, coverage_path, kill_path, surv_path, VERDICT_B, eval_start, eval_end)
    cells_b = rep_b.get("cells", [])
    verdicts_b = [c["verdict"] for c in cells_b]
    gate_b_all_na = all(c.get("gate_b", {}).get("verdict") == "NOT_APPLICABLE" for c in cells_b)
    no_pass = "PASS" not in verdicts_b and rep_b["run_verdict"] != "PASS"
    numbers = cells_b and all(c.get("n_periods") is not None for c in cells_b)
    # SCOPE NOTE: in this fixture the winners are the top-cap tickers (k>=180) that BOTH arms
    # always capture, so recall_shadow==recall_mirror & lift==0 is structurally guaranteed by
    # the fixture, NOT discovered by the evaluator. This assert therefore only proves the eval
    # is deterministic and fabricates no spurious lift — it does NOT test recall *sensitivity*
    # (that a genuine recall gap would be detected). Recall sensitivity is covered by the
    # shipped unit tests (scripts/test_shadow_eval.py), out of scope for this wiring dry-run.
    equal_recall_zero_lift = bool(cells_b) and all(
        c.get("recall_shadow") == c.get("recall_mirror")
        and abs(float(c.get("period_lift_mean") or 0.0)) < 1e-12
        for c in cells_b
    )
    b_ok = (rep_b["run_verdict"] == "DIRECTIONAL" and gate_b_all_na and no_pass
            and rep_b.get("no_apply") is True and not rep_b.get("triple_gate_all_pass") and numbers
            and equal_recall_zero_lift)
    cell0 = cells_b[0] if cells_b else {}
    step("scenario (b) ≥floor → DIRECTIONAL cap (never PASS)", "pass" if b_ok else "fail",
         f"run_verdict={rep_b['run_verdict']} · cells={verdicts_b} · "
         f"n_periods={cell0.get('n_periods')} lift={cell0.get('period_lift_mean')} "
         f"recall_shadow={cell0.get('recall_shadow')} recall_mirror={cell0.get('recall_mirror')} "
         f"ci90={cell0.get('ci90')} ic_ir={cell0.get('ic_ir')} · "
         f"equal_recall_zero_lift={equal_recall_zero_lift} · gate_b_all_NA={gate_b_all_na} · "
         f"triple_gate_all_pass={rep_b.get('triple_gate_all_pass')}")

    all_pass = all(s["result"] == "pass" for s in steps)
    summary = {
        "chain_ran": all_pass,
        "db": DB,
        "driver": str(Path(__file__).resolve()),
        "fixtures_dir": str(_ARTIFACTS),
        "cache_dir": str(_CACHE_DIR),
        "verdict_incomplete": str(VERDICT_A),
        "verdict_directional": str(VERDICT_B),
        "scenario_a_run_verdict": rep_a["run_verdict"],
        "scenario_a_reason": reason_a,
        "scenario_b_run_verdict": rep_b["run_verdict"],
        "scenario_b_cell_verdicts": verdicts_b,
        "scenario_b_gate_b_all_NA": gate_b_all_na,
        "scenario_b_equal_recall_zero_lift": equal_recall_zero_lift,
        "no_pass_anywhere": no_pass,
        "steps": steps,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if all_pass else 1


if __name__ == "__main__":
    rc = 1
    try:
        rc = main()
    finally:
        subprocess.run(["dropdb", "--if-exists", DB], check=False, capture_output=True,
                       text=True, env=_LOCAL_PG_ENV)
        print(f"[cleanup] dropdb {DB} · work dir {_WORK} (cache+artifacts) retained for inspection",
              file=sys.stderr)
    raise SystemExit(rc)
