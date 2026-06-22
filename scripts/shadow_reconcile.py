#!/usr/bin/env python3
"""주픽(JooPick) — Track 2 generator-shadow reconcile REPORT (PR-B4).

SoT: docs/superpowers/specs/2026-06-20-pathA-track2-generator-shadow.md §6.1·§9·§10(PR-B4)·§11

WHAT THIS IS
  A read-only reconcile report: which production monthly periods have a COMPLETE
  `production-mirror` shadow run vs which are MISSING (no shadow coverage). Used as the
  coverage-readiness gate before PR-B5's forward harvest ("blocking before Stage 1 harvest/kill",
  §10): a period with no complete mirror run is excluded from PR-B5's n_periods floor (§6.1) as
  INCOMPLETE_RUN — it is never scored 0 recall.

WHAT THIS IS NOT (deliberate scope, post-adversarial-review 2026-06-22)
  - NOT a backfill executor. Track 2 is forward-only (§9): the sector map (sector_override.json +
    DART induty) is a current-only artifact (§0.3), so re-running a PAST period NOW stamps today's
    sector map onto that period = the §9-REJECTED look-ahead. `screen_shortlist_tier0.py --month X`
    only relabels the period_key (screen_shortlist_tier0.py:1476); the universe/prices/sector-map it
    uses are always today's (:1647 date.today(), :1676 live override.json). The ONLY honest backfill
    is re-running the CURRENT period (before its sector map drifts), which is already free via the
    idempotent PR-B3 path — so this module DOCUMENTS that remediation instead of shipping a foot-gun
    executor. See `_remediation_for`.
  - NOT a verdict. No recall / PASS / FAIL / "sector predicts" wording (§6.7) — PR-B5 owns verdicts.
  - NOT a service_role reader. Shadow tables grant SELECT only to `authenticated` under is_admin()
    RLS, NOT to service_role (T2-I-6, 0039). The read path is a human analyst's OWNER psql connection
    — the same one the migrations/smokes use — NOT the production service_role path this must never
    touch. The MATERIALIZED-CTE query (`RECONCILE_GAP_SQL`) is owner-run; classification is pure
    Python here (single source of truth). Production reconcile runs are USER-only (owner connection =
    external state); CLAUDE verifies the query via scripts/pg_smoke_0039_prb4.sh against local PG.

PURITY: the module-level functions do NO DB / network / env-read / mutation; they are deterministic
given (inputs, now_iso). Only `main()` does I/O (read a JSON file the operator produced from the
owner query, or print the SQL).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

import shadow_gen_runner as SR  # noqa: E402  (reuse period-key validators — single source)

PRODUCTION_MIRROR = "production-mirror"
MIRROR_BUCKET_COUNT = 150              # 50×3 disjoint bucket selection (0028/0039 contract)
FORWARD_FLOOR_PERIODS = 6              # spec §6.1 forward floor (short=weekly, midlong=monthly)

# raw per-period coverage fact fields emitted by RECONCILE_GAP_SQL.
_COVERAGE_FIELDS: tuple[str, ...] = (
    "period_key",
    "month",
    "mirror_ticker_count",
    "mirror_run_id_count",
    "mirror_all_logged",
    "mirror_run_id",
    "mirror_universe_size",
    "mirror_universe_hash_count",
    "mirror_universe_hash",
    "snapshot_distinct_tickers",
    "snapshot_universe_size_min",
    "snapshot_universe_size",
    "snapshot_universe_hash_count",
    "snapshot_universe_hash",
)

_MONTH_RE = re.compile(r"^\d{4}-\d{2}-01$")          # production month normalized to YYYY-MM-01
_INSTANT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T")     # cheap ISO-instant prefix guard
_KST = timezone(timedelta(hours=9))


# ===========================================================================
# OWNER psql gap-detection query (MATERIALIZED CTE, §259 / §11). RAW FACTS only.
# ===========================================================================
RECONCILE_GAP_SQL = """\
-- PR-B4 reconcile gap detection (Track 2 generator-shadow). OWNER/psql-run.
--   T2-I-6: shadow tables grant SELECT only to `authenticated` under is_admin() RLS, NOT to
--   service_role. The intended read path is a human analyst's OWNER connection (the one the
--   migrations/smokes use), NEVER the production service_role path.
--
-- WITH ... AS MATERIALIZED forces each CTE to evaluate ONCE into a stable working set, so a
-- concurrent upsert_tier0_shadow_run commit cannot make the LEFT JOIN read its two sides on
-- different MVCC snapshots (the READ-side analogue of the SKIP-LOCKED over-claim root cause,
-- feedback_pg_skip_locked_claim_anti_pattern). NOT a queue claim: read-only, no SKIP LOCKED,
-- no UPDATE. Race-stable ONLY as this single statement on one owner connection (one MVCC snapshot).
--
-- Emits RAW per-period coverage FACTS (NOT a verdict): classification lives in Python
-- (classify_coverage_row) as the single source of truth. Monthly scope only — production
-- tier0_candidates_150 is monthly; weekly YYYY-Www shadow keys never match a monthly prod period_key.
with prod as materialized (
  -- production monthly periods. month has NO day=1 CHECK in 0028, so normalize via date_trunc.
  select distinct
    to_char(date_trunc('month', month)::date, 'YYYY-MM') as period_key,
    date_trunc('month', month)::date                     as month
  from public.tier0_candidates_150
),
mirror as materialized (
  -- production-mirror coverage facts per shadow period_key (monthly+weekly; only monthly joins below).
  select
    c.period_key,
    count(distinct c.ticker)      as mirror_ticker_count,
    count(distinct c.run_id)      as mirror_run_id_count,
    bool_and(c.status = 'logged') as mirror_all_logged,
    min(c.run_id)                 as mirror_run_id,
    max(c.universe_size)          as mirror_universe_size,
    count(distinct c.universe_hash) as mirror_universe_hash_count,
    min(c.universe_hash)            as mirror_universe_hash
  from public.tier0_candidates_150_shadow c
  where c.arm = 'production-mirror'
  group by c.period_key
),
snap as materialized (
  -- universe-wide snapshot facts per (period_key, run_id): the recall denominator PR-B5 consumes
  -- (§6.2/§6.5). complete coverage requires a snapshot for the SAME run_id as the mirror candidates
  -- (FIX-J join) whose distinct-ticker count == the CANDIDATES' declared universe_size, with a uniform
  -- universe_size (min==max). Anchoring to the candidates' N (not the snapshot's own max) closes the
  -- self-referential hole where a lowered/non-uniform snapshot universe_size could pass. Candidate-only
  -- is NOT sufficient readiness: snapshot tampering/deletion must surface as anomaly, not silent 'complete'.
  select
    s.period_key,
    s.run_id,
    count(distinct s.ticker) as snapshot_distinct_tickers,
    min(s.universe_size)     as snapshot_universe_size_min,
    max(s.universe_size)     as snapshot_universe_size,
    count(distinct s.universe_hash) as snapshot_universe_hash_count,
    min(s.universe_hash)            as snapshot_universe_hash
  from public.tier0_shadow_universe_snapshot s
  group by s.period_key, s.run_id
)
select
  p.period_key,
  to_char(p.month, 'YYYY-MM-DD')               as month,
  coalesce(m.mirror_ticker_count, 0)           as mirror_ticker_count,
  coalesce(m.mirror_run_id_count, 0)           as mirror_run_id_count,
  coalesce(m.mirror_all_logged, false)         as mirror_all_logged,
  m.mirror_run_id                              as mirror_run_id,
  coalesce(m.mirror_universe_size, 0)          as mirror_universe_size,
  coalesce(m.mirror_universe_hash_count, 0)    as mirror_universe_hash_count,
  coalesce(m.mirror_universe_hash, '')         as mirror_universe_hash,
  coalesce(sn.snapshot_distinct_tickers, 0)    as snapshot_distinct_tickers,
  coalesce(sn.snapshot_universe_size_min, 0)   as snapshot_universe_size_min,
  coalesce(sn.snapshot_universe_size, 0)       as snapshot_universe_size,
  coalesce(sn.snapshot_universe_hash_count, 0) as snapshot_universe_hash_count,
  coalesce(sn.snapshot_universe_hash, '')      as snapshot_universe_hash
from prod p
left join mirror m on m.period_key = p.period_key
-- FIX-J: snapshot joined on the SAME run_id as the mirror candidates (no cross-run pairing).
left join snap sn on sn.period_key = p.period_key and sn.run_id = m.mirror_run_id
order by p.month;
"""


class ReconcileInputError(ValueError):
    """PR-B4 pure-core fail-closed: malformed coverage_rows / now_iso / forward_floor.

    Distinct from SG.ShadowInvalidInputError and SR.ShadowRunnerError — this is the reconcile
    boundary contract. main() treats it as a hard abort (never a production write, never a verdict).
    """


# ===========================================================================
# fail-closed field extractors (feedback_failclosed_symmetric_completion):
#   type-check BEFORE use; no truthiness `or {}`; reject wrong type, not just absence.
# ===========================================================================
def _require_dict(value: Any, what: str) -> dict:
    if not isinstance(value, dict):
        raise ReconcileInputError(f"{what} must be a dict, got {type(value).__name__}")
    return value


def _require_str(row: dict, key: str, what: str) -> str:
    if key not in row:
        raise ReconcileInputError(f"{what}: missing '{key}'")
    v = row[key]
    if not isinstance(v, str):
        raise ReconcileInputError(f"{what}: '{key}' must be str, got {type(v).__name__}")
    return v


def _require_int(row: dict, key: str, what: str) -> int:
    if key not in row:
        raise ReconcileInputError(f"{what}: missing '{key}'")
    v = row[key]
    # bool is an int subclass — reject explicitly so a stray True/False can't coerce to 1/0.
    if isinstance(v, bool) or not isinstance(v, int):
        raise ReconcileInputError(f"{what}: '{key}' must be int, got {type(v).__name__}")
    if v < 0:
        raise ReconcileInputError(f"{what}: '{key}' must be >= 0, got {v}")
    return v


def _require_bool(row: dict, key: str, what: str) -> bool:
    if key not in row:
        raise ReconcileInputError(f"{what}: missing '{key}'")
    v = row[key]
    if not isinstance(v, bool):
        raise ReconcileInputError(f"{what}: '{key}' must be bool, got {type(v).__name__}")
    return v


def _require_str_or_none(row: dict, key: str, what: str) -> str | None:
    if key not in row:
        raise ReconcileInputError(f"{what}: missing '{key}'")
    v = row[key]
    if v is None:
        return None
    if not isinstance(v, str):
        raise ReconcileInputError(f"{what}: '{key}' must be str or null, got {type(v).__name__}")
    return v


# ===========================================================================
# classification — single source of truth (the gap SQL emits raw facts only)
# ===========================================================================
def classify_coverage_row(row: dict) -> dict:
    """Classify ONE production MONTHLY period's production-mirror coverage from raw facts.

    Input row = one RECONCILE_GAP_SQL row: {period_key, month, mirror_ticker_count,
    mirror_run_id_count, mirror_all_logged, mirror_run_id, mirror_universe_size,
    mirror_universe_hash_count, mirror_universe_hash, snapshot_distinct_tickers,
    snapshot_universe_size, snapshot_universe_hash_count, snapshot_universe_hash}.

    Returns {period_key, month, status, mirror_run_id, mirror_ticker_count, mirror_run_id_count,
             mirror_all_logged, mirror_universe_size, snapshot_distinct_tickers,
             snapshot_universe_size, reason} where status ∈:
      - 'complete' : production-mirror has exactly 150 logged candidate rows under ONE run_id, AND a
                     matching same-run_id universe snapshot exists with count(distinct ticker) ==
                     universe_size (>=150), consistent with the candidates' universe_size and the same
                     non-empty universe_hash. This is what PR-B5 actually consumes (§6.2/§6.5):
                     candidates AND the universe-wide denominator.
      - 'missing'  : zero production-mirror candidate rows for this period.
      - 'anomaly'  : mirror candidates exist but the (candidate + snapshot) pair is NOT complete. Per
                     F2 (mirror SleeveShortfall aborts the whole run) + the atomic single-tx finalize,
                     a COMMITTED period can only ever be complete-or-absent — so 'anomaly' means the
                     shadow tables were corrupted / manually tampered (e.g. snapshot deleted). Surfaced
                     loudly (NOT silently 'complete'); investigate before harvest. This is the only
                     non-{complete,missing} state and replaces the structurally-impossible torn/incomplete
                     machinery.

    MONTHLY-ONLY scope (§8): a weekly YYYY-Www period_key is rejected — PR-B4 reconciles monthly
      production coverage only; a hand-fed weekly key must not inflate the §6.1 monthly floor.

    RUN-IDENTITY INVARIANT: the row's mirror facts and snapshot facts MUST come from the same run —
      RECONCILE_GAP_SQL enforces this by joining the snapshot CTE on `sn.run_id = m.mirror_run_id`
      (FIX-J), so the classifier consumes already-run-joined facts and does not re-derive run identity.
      The universe_hash equality check is the additional same-UNIVERSE guard (a snapshot whose universe
      differs from the candidates' fails regardless of run pairing). Feed only gap-SQL output (or a
      faithful run-joined equivalent); cross-run-spliced hand-fed rows are out of contract.

    Fail-closed (ReconcileInputError): non-dict row; missing/wrong-type field; period_key not a valid
      MONTHLY YYYY-MM key; month not YYYY-MM-01; period_key != month's YYYY-MM.
    NO mutation of input. Deterministic.
    """
    _require_dict(row, "coverage row")
    period_key = _require_str(row, "period_key", "coverage row")
    if not SR._is_monthly_period_key(period_key):
        raise ReconcileInputError(
            f"coverage row: bad/unsupported period_key {period_key!r} — PR-B4 is MONTHLY-only (want YYYY-MM; "
            f"weekly YYYY-Www is out of scope, §8)"
        )
    month = _require_str(row, "month", "coverage row")
    if not _MONTH_RE.match(month):
        raise ReconcileInputError(f"coverage row: bad month {month!r} (want YYYY-MM-01)")
    # calendar-validate: _MONTH_RE + _is_monthly_period_key are STRUCTURAL only (digit runs), so
    # '2026-13'/'2026-00' would pass. Reject impossible months (the SQL can't emit them, but a
    # hand-fed coverage.json could) — the classifier is the single source of truth, fail-closed.
    try:
        datetime.strptime(month, "%Y-%m-%d")
    except ValueError as exc:
        raise ReconcileInputError(f"coverage row: impossible calendar month {month!r} ({exc})")
    if period_key != month[:7]:
        raise ReconcileInputError(f"coverage row: period_key {period_key!r} != month {month!r} (YYYY-MM)")

    ticker_count = _require_int(row, "mirror_ticker_count", "coverage row")
    run_id_count = _require_int(row, "mirror_run_id_count", "coverage row")
    all_logged = _require_bool(row, "mirror_all_logged", "coverage row")
    mirror_run_id = _require_str_or_none(row, "mirror_run_id", "coverage row")
    mirror_universe_size = _require_int(row, "mirror_universe_size", "coverage row")
    mirror_universe_hash_count = _require_int(row, "mirror_universe_hash_count", "coverage row")
    mirror_universe_hash = _require_str(row, "mirror_universe_hash", "coverage row")
    snap_distinct = _require_int(row, "snapshot_distinct_tickers", "coverage row")
    snap_universe_size_min = _require_int(row, "snapshot_universe_size_min", "coverage row")
    snap_universe_size = _require_int(row, "snapshot_universe_size", "coverage row")
    snapshot_universe_hash_count = _require_int(row, "snapshot_universe_hash_count", "coverage row")
    snapshot_universe_hash = _require_str(row, "snapshot_universe_hash", "coverage row")

    if ticker_count == 0:
        status, reason = "missing", "no production-mirror shadow run for this period"
    else:
        candidate_ok = ticker_count == MIRROR_BUCKET_COUNT and run_id_count == 1 and all_logged
        # snapshot (the universe-wide recall denominator PR-B5 consumes) must exist for the SAME run with
        # a whole universe: distinct tickers == the CANDIDATES' declared universe_size, a uniform
        # universe_size (min==max, no mixed/partial-write), all >=150. Anchoring distinct to the
        # candidates' N (not the snapshot's own max) closes the self-referential hole where a lowered
        # snapshot universe_size could pass as complete.
        snapshot_shape_ok = (
            snap_universe_size >= MIRROR_BUCKET_COUNT
            and snap_universe_size_min == snap_universe_size
            and snap_universe_size == mirror_universe_size
            and snap_distinct == mirror_universe_size
        )
        universe_hash_ok = (
            mirror_universe_hash_count == 1
            and snapshot_universe_hash_count == 1
            and bool(mirror_universe_hash.strip())   # reject empty/whitespace-only (hand-fed) hash
            and mirror_universe_hash == snapshot_universe_hash
        )
        snapshot_ok = snapshot_shape_ok and universe_hash_ok
        if candidate_ok and snapshot_ok:
            status, reason = "complete", None
        else:
            problems: list[str] = []
            if not candidate_ok:
                problems.append(
                    f"candidates not {MIRROR_BUCKET_COUNT}/1-run/all-logged "
                    f"(tickers={ticker_count}, run_ids={run_id_count}, all_logged={all_logged})"
                )
            if not snapshot_shape_ok:
                problems.append(
                    f"universe snapshot incomplete for mirror run "
                    f"(snap_distinct={snap_distinct}, snap_universe_size[min={snap_universe_size_min},"
                    f"max={snap_universe_size}], mirror_universe_size={mirror_universe_size})"
                )
            if not universe_hash_ok:
                problems.append(
                    "universe_hash mismatch/non-uniform "
                    f"(mirror_hash_count={mirror_universe_hash_count}, "
                    f"snapshot_hash_count={snapshot_universe_hash_count}, "
                    f"mirror_universe_hash={mirror_universe_hash!r}, "
                    f"snapshot_universe_hash={snapshot_universe_hash!r})"
                )
            status = "anomaly"
            reason = (
                "committed shadow state is not complete-or-absent (the PR-B3 orchestrator aborts a "
                "non-logged mirror, so this is unexpected) — investigate corruption, tampering, or an "
                "out-of-contract direct finalize RPC write: " + "; ".join(problems)
            )

    return {
        "period_key": period_key,
        "month": month,
        "status": status,
        "mirror_run_id": mirror_run_id,
        "mirror_ticker_count": ticker_count,
        "mirror_run_id_count": run_id_count,
        "mirror_all_logged": all_logged,
        "mirror_universe_size": mirror_universe_size,
        "mirror_universe_hash_count": mirror_universe_hash_count,
        "mirror_universe_hash": mirror_universe_hash,
        "snapshot_distinct_tickers": snap_distinct,
        "snapshot_universe_size_min": snap_universe_size_min,
        "snapshot_universe_size": snap_universe_size,
        "snapshot_universe_hash_count": snapshot_universe_hash_count,
        "snapshot_universe_hash": snapshot_universe_hash,
        "reason": reason,
    }


def _remediation_for(status: str, month: str, *, is_current: bool) -> str | None:
    """Operator remediation note per status. The forward-only honesty guard is MECHANICAL, not prose:
    a runnable re-generation command is emitted ONLY for the CURRENT period (`is_current`). For a PAST
    missing period NO runnable command is provided — re-running it now would stamp today's current-only
    sector map onto a past period = the §9-REJECTED look-ahead. `month` is YYYY-MM-01."""
    if status == "missing":
        if not is_current:
            return (
                f"PAST period — UNBACKFILLABLE. Re-running now would stamp today's current-only sector "
                f"map onto {month} = look-ahead (§9). DO NOT re-run; no backfill command is provided by "
                f"design. Leave it missing — PR-B5 excludes it from n_periods (INCOMPLETE_RUN), never "
                f"treating it as a zero-coverage period."
            )
        return (
            f"CURRENT period — re-running now is honest (the sector map is contemporaneous). Idempotent "
            f"re-generation via the finalize RPC's period-wide delete+reinsert: "
            f"SHADOW_GENERATOR_ENABLED=true scripts/.venv/bin/python scripts/screen_shortlist_tier0.py "
            f"--scoring bpp --shadow-sector --month {month} --dry-run --csv-backup <path>. NOTE: --dry-run "
            f"here only satisfies the required mode group and is production-path nomenclature — the shadow "
            f"branch returns before any production write and still writes the SHADOW tables via the finalize "
            f"RPC (intended PR-B3 behavior, NOT a production write). Re-running churns run_id and deletes the "
            f"period's prior universe_snapshot/unresolved rows (0039:831-833)."
        )
    if status == "anomaly":
        return (
            "Shadow integrity anomaly — a committed period cannot be partial via the PR-B3 orchestrator. "
            "Inspect tier0_candidates_150_shadow / tier0_shadow_universe_snapshot for this period "
            "(tampering / interrupted-or-out-of-contract write / schema drift) and resolve BEFORE running "
            "the PR-B5 harvest."
        )
    return None


def _parse_now_iso(now_iso: Any) -> datetime:
    if not isinstance(now_iso, str):
        raise ReconcileInputError(f"now_iso must be str, got {type(now_iso).__name__}")
    if not _INSTANT_RE.match(now_iso):
        raise ReconcileInputError(f"now_iso must be an ISO instant (YYYY-MM-DDThh:mm:ss...), got {now_iso!r}")
    try:
        dt = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ReconcileInputError(f"now_iso unparseable: {now_iso!r} ({exc})")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _validate_now_iso(now_iso: Any) -> str:
    _parse_now_iso(now_iso)
    return now_iso


def _current_month_kst(now_iso: str) -> str:
    return _parse_now_iso(now_iso).astimezone(_KST).strftime("%Y-%m")


# ===========================================================================
# report — read-only aggregation (no verdict)
# ===========================================================================
def build_reconcile_report(
    coverage_rows: list[dict],
    *,
    now_iso: str,
    forward_floor: int = FORWARD_FLOOR_PERIODS,
) -> dict:
    """Pure aggregation of raw coverage facts → advisory reconcile report (NO verdict).

    Returns:
      {
        'generated_at': now_iso,
        'scope': 'monthly production-mirror coverage (Track 2 generator-shadow, forward-only)',
        'periods': [ {period_key, month, status, mirror_run_id, reason, remediation} ... ],  # input order
        'summary': {'total', 'complete', 'missing', 'anomaly'},
        'coverage_completeness': {'complete_periods', 'forward_floor', 'note'},  # DESCRIPTIVE, not a verdict
        'remediation_policy': <forward-only honest-backfill policy text>,
      }

    Fail-closed (ReconcileInputError): coverage_rows not list; any element invalid (delegated to
      classify_coverage_row); duplicate period_key (a gap query must not emit dups); now_iso not a
      parseable instant; forward_floor not a positive int.
    NO DB, NO mutation of inputs, NO recall/PASS/FAIL wording. Deterministic given (inputs, now_iso).
    """
    if not isinstance(coverage_rows, list):
        raise ReconcileInputError(f"coverage_rows must be a list, got {type(coverage_rows).__name__}")
    now_iso = _validate_now_iso(now_iso)
    if isinstance(forward_floor, bool) or not isinstance(forward_floor, int) or forward_floor <= 0:
        raise ReconcileInputError(f"forward_floor must be a positive int, got {forward_floor!r}")

    current_month = _current_month_kst(now_iso)
    seen: set[str] = set()
    periods: list[dict] = []
    summary = {"total": 0, "complete": 0, "missing": 0, "anomaly": 0}
    for raw in coverage_rows:
        classified = classify_coverage_row(raw)
        pk = classified["period_key"]
        if pk in seen:
            raise ReconcileInputError(f"duplicate period_key in coverage_rows: {pk!r}")
        seen.add(pk)
        status = classified["status"]
        summary["total"] += 1
        summary[status] += 1
        periods.append({
            "period_key": pk,
            "month": classified["month"],
            "status": status,
            "mirror_run_id": classified["mirror_run_id"],
            "reason": classified["reason"],
            "remediation": _remediation_for(status, classified["month"], is_current=(pk == current_month)),
        })

    return {
        "generated_at": now_iso,
        "scope": "monthly production-mirror coverage (Track 2 generator-shadow, forward-only)",
        "periods": periods,
        "summary": summary,
        "coverage_completeness": {
            "complete_periods": summary["complete"],
            "forward_floor": forward_floor,
            "note": (
                "Descriptive coverage count vs the spec §6.1 forward floor — an observation of how many "
                "periods have a complete mirror run, NOT an evaluation outcome. PR-B5 owns all evaluation."
            ),
        },
        "remediation_policy": (
            "Forward-only (§9): only the CURRENT period is honestly backfillable (re-run PR-B3, "
            "idempotent). Past missing periods stay missing and are excluded by PR-B5 as INCOMPLETE_RUN. "
            "PR-B4 reports gaps; it never executes a backfill (re-running a past period = look-ahead)."
        ),
    }


# ===========================================================================
# thin I/O entrypoint (only impure surface)
# ===========================================================================
_USAGE_NOTE = """\
PR-B4 reconcile is read-only and OWNER-connection-gated (T2-I-6: no service_role SELECT on shadow).
Produce the coverage facts on YOUR owner psql connection, then classify them here:

  # 1) emit the gap facts as a JSON array (owner connection — USER-only external state):
  psql "$OWNER_CONN" -At -c \\
    "select json_agg(t) from ( $(python scripts/shadow_reconcile.py --print-sql-inline) ) t" \\
    > coverage.json

  # 2) build the advisory reconcile report (pure, CLAUDE-runnable):
  python scripts/shadow_reconcile.py --coverage-json coverage.json

Or run --print-sql to read the documented MATERIALIZED-CTE query. CLAUDE verifies the query form
against local PG via scripts/pg_smoke_0039_prb4.sh; production runs are USER-only.
"""


def _sql_inline() -> str:
    """RECONCILE_GAP_SQL as a single-line subquery body (no trailing ';' / no leading comment lines),
    safe to embed in `select json_agg(t) from ( ... ) t`."""
    body_lines = [ln for ln in RECONCILE_GAP_SQL.splitlines() if not ln.lstrip().startswith("--")]
    return " ".join(ln.strip() for ln in body_lines if ln.strip()).rstrip(";")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Track 2 generator-shadow reconcile REPORT (PR-B4) — read-only, no backfill, no verdict.",
    )
    parser.add_argument("--coverage-json", metavar="FILE",
                        help="JSON array of RECONCILE_GAP_SQL rows (from your owner psql connection).")
    parser.add_argument("--print-sql", action="store_true", help="print the documented MATERIALIZED-CTE gap query.")
    parser.add_argument("--print-sql-inline", action="store_true",
                        help="print the gap query as a single-line subquery body (for json_agg wrapping).")
    args = parser.parse_args(argv)

    if args.print_sql:
        print(RECONCILE_GAP_SQL)
        return 0
    if args.print_sql_inline:
        print(_sql_inline())
        return 0
    if not args.coverage_json:
        sys.stderr.write(_USAGE_NOTE)
        return 2

    with open(args.coverage_json, encoding="utf-8") as fh:
        raw = json.load(fh)
    if raw is None:
        raw = []   # psql json_agg over zero rows yields SQL NULL → JSON null → no production periods.
    now_iso = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    try:
        report = build_reconcile_report(raw, now_iso=now_iso, forward_floor=FORWARD_FLOOR_PERIODS)
    except ReconcileInputError as exc:
        sys.stderr.write(f"[ABORT] reconcile input invalid: {exc}\n")
        return 2
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
