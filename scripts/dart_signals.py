"""DART Signal 4 (earnings momentum YoY) + Signal 5 (quality) helpers.

This module intentionally keeps financial scoring pure and testable, while DART
HTTP and Supabase cache access are thin boundary functions.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Optional


DART_ACCOUNT_ALIASES = {
    "revenue": (["매출액", "수익(매출액)", "영업수익", "수익", "보험영업수익"], ("IS", "CIS")),
    "op_income": (["영업이익", "영업이익(손실)"], ("IS", "CIS")),
    "net_income": (["당기순이익", "당기순이익(손실)", "분기순이익", "분기순이익(손실)"], ("IS", "CIS")),
    "total_assets": (["자산총계"], ("BS",)),
    "total_equity": (["자본총계"], ("BS",)),
    "total_debt": (["부채총계"], ("BS",)),
    "interest_expense": (["이자비용", "이자비용(이자수익차감후)"], ("IS", "CIS")),
}

DART_ACCOUNT_MAP: dict[str, tuple[str, tuple[str, ...], bool]] = {}
for _std_key, (_aliases, _sj_divs) in DART_ACCOUNT_ALIASES.items():
    for _idx, _name in enumerate(_aliases):
        DART_ACCOUNT_MAP.setdefault(_name, (_std_key, _sj_divs, _idx == 0))

FINANCIAL_KEYS = (
    "revenue", "op_income", "net_income", "total_assets",
    "total_equity", "total_debt", "interest_expense",
)
QUALITY_METRIC_KEYS = ("roe", "debt_ratio_inv", "op_margin", "revenue_growth", "interest_coverage")
DART_FNLTT_URL = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json"
REPORT_CODE_MAP = {"annual": "11011", "Q1": "11013", "H1": "11012", "9M": "11014"}
PERIOD_KEY_MAP = {"annual": "{year}", "Q1": "{year}-Q1", "H1": "{year}-H1", "9M": "{year}-9M"}
CALCULATION_BASIS_MAP = {"annual": "annual", "Q1": "standalone", "H1": "not_applicable", "9M": "not_applicable"}
QUARTERLY_DEADLINE_MD = {"Q1": (5, 15), "H1": (8, 15), "9M": (11, 15)}
DISCLOSURE_GRACE_DAYS = 30
NOT_YET_DISCLOSED_TTL_DAYS = 7


class DartNoDataError(Exception):
    """DART status != '000' (e.g. '013' = 조회 결과 없음)."""

    def __init__(self, status: str, message: str = ""):
        super().__init__(f"DART status={status} message={message}")
        self.status = status
        self.message = message


@dataclass
class DartSignalsResult:
    earnings_raw: float = 0.0
    quality_raw_metrics: dict[str, float] = field(default_factory=lambda: {k: math.nan for k in QUALITY_METRIC_KEYS})
    quality_insufficient: bool = True
    signal_4_basis: str = "not_applicable"
    alias_meta: list[str] = field(default_factory=list)


def parse_amount(raw: object) -> Optional[float]:
    if raw is None:
        return None
    text = str(raw).replace(",", "").strip()
    if not text or text == "-":
        return None
    # DART sometimes represents negative numbers as (1234).
    if text.startswith("(") and text.endswith(")"):
        text = "-" + text[1:-1]
    try:
        return float(text)
    except ValueError:
        return None


def parse_dart_financial_response(payload: dict) -> tuple[dict[str, Optional[float]], list[str]]:
    """Parse DART fnlttSinglAcntAll.json into standard financial keys."""
    status = payload.get("status")
    if status != "000":
        raise DartNoDataError(status or "unknown", payload.get("message", ""))

    out: dict[str, Optional[float]] = {k: None for k in FINANCIAL_KEYS}
    alias_meta: list[str] = []
    for item in payload.get("list", []):
        account_name = item.get("account_nm", "")
        sj_div = item.get("sj_div", "")
        mapping = DART_ACCOUNT_MAP.get(account_name)
        if mapping is None:
            continue
        std_key, allowed_sj_divs, is_primary = mapping
        if sj_div not in allowed_sj_divs or out[std_key] is not None:
            continue
        # 손익(IS/CIS) accounts: in cumulative quarterly reports (반기 11012 / 3분기 11014)
        # thstrm_amount is the 3-month (current quarter) figure while thstrm_add_amount
        # is the 당기 누적 (cumulative) figure that compute_standalone_quarter expects.
        # Prefer thstrm_add_amount when present; fall back to thstrm_amount when it is
        # absent (annual 11011 has no add_amount → full year; Q1 11013 add==amount).
        if sj_div in ("IS", "CIS"):
            value = parse_amount(item.get("thstrm_add_amount"))
            if value is None:
                value = parse_amount(item.get("thstrm_amount"))
        else:
            value = parse_amount(item.get("thstrm_amount"))
        if value is None:
            continue
        out[std_key] = value
        if not is_primary:
            alias_meta.append(f"account_alias_used:{std_key}={account_name}")
    return out, alias_meta


def _safe_div(numerator: Optional[float], denominator: Optional[float]) -> float:
    if numerator is None or denominator is None or denominator == 0:
        return math.nan
    return numerator / denominator


def compute_quality_score(annual_x: Optional[dict], annual_x_minus_1: Optional[dict]) -> tuple[dict[str, float], bool]:
    """Return 5 raw quality metrics and an insufficient-data flag."""
    out: dict[str, float] = {k: math.nan for k in QUALITY_METRIC_KEYS}
    if annual_x is None:
        return out, True

    equity = annual_x.get("total_equity")
    if equity is not None and equity > 0:
        out["roe"] = _safe_div(annual_x.get("net_income"), equity)
        debt = annual_x.get("total_debt")
        if debt is not None:
            out["debt_ratio_inv"] = -(debt / equity)

    out["op_margin"] = _safe_div(annual_x.get("op_income"), annual_x.get("revenue"))

    if annual_x_minus_1 is not None:
        rev_x = annual_x.get("revenue")
        rev_x_1 = annual_x_minus_1.get("revenue")
        if rev_x is not None and rev_x_1 is not None and rev_x_1 > 0:
            out["revenue_growth"] = (rev_x - rev_x_1) / rev_x_1

    interest = annual_x.get("interest_expense")
    if interest is not None and interest > 0:
        out["interest_coverage"] = _safe_div(annual_x.get("op_income"), interest)

    return out, sum(1 for v in out.values() if math.isnan(v)) >= 3


def _z_normalize_present(values: list[float]) -> list[float]:
    present = [v for v in values if not math.isnan(v)]
    if not present:
        return [math.nan for _ in values]
    mean = sum(present) / len(present)
    var = sum((v - mean) ** 2 for v in present) / len(present)
    sigma = math.sqrt(var) if var > 0 else 1e-9
    out: list[float] = []
    for value in values:
        if math.isnan(value):
            out.append(math.nan)
        else:
            scaled = (((value - mean) / sigma) + 3.0) / 6.0 * 100.0
            out.append(max(0.0, min(100.0, scaled)))
    return out


def compute_quality_composite_for_universe(metrics_by_stock: list[dict[str, float]]) -> list[float]:
    """Universe-wide z-score each quality metric, then average per stock.

    A stock with fewer than 3 valid quality metrics receives 0.0 to avoid giving
    long-bucket credit to missing financial data.
    """
    if not metrics_by_stock:
        return []
    normalized_by_key: dict[str, list[float]] = {}
    for key in QUALITY_METRIC_KEYS:
        normalized_by_key[key] = _z_normalize_present([m.get(key, math.nan) for m in metrics_by_stock])

    scores: list[float] = []
    for idx in range(len(metrics_by_stock)):
        valid_scores = [normalized_by_key[key][idx] for key in QUALITY_METRIC_KEYS if not math.isnan(normalized_by_key[key][idx])]
        if len(valid_scores) < 3:
            scores.append(0.0)
        else:
            scores.append(sum(valid_scores) / len(valid_scores))
    return scores


def compute_standalone_quarter(
    quarter: str,
    *,
    q1_cumulative: Optional[dict] = None,
    h1_cumulative: Optional[dict] = None,
    nine_m_cumulative: Optional[dict] = None,
    annual_cumulative: Optional[dict] = None,
) -> Optional[dict[str, Optional[float]]]:
    """Convert cumulative DART reports to standalone quarter values."""
    if quarter == "Q1":
        return dict(q1_cumulative) if q1_cumulative is not None else None
    pairs = {
        "Q2": (h1_cumulative, q1_cumulative),
        "Q3": (nine_m_cumulative, h1_cumulative),
        "Q4": (annual_cumulative, nine_m_cumulative),
    }
    if quarter not in pairs:
        raise ValueError(f"Unsupported quarter: {quarter}")
    current, previous = pairs[quarter]
    if current is None or previous is None:
        return None
    out: dict[str, Optional[float]] = {}
    for key in FINANCIAL_KEYS:
        cur = current.get(key)
        prev = previous.get(key)
        out[key] = None if cur is None or prev is None else cur - prev
    return out


def compute_yoy_earnings_momentum(current_q_standalone: Optional[dict], prior_year_q_standalone: Optional[dict]) -> float:
    """Signal 4 = average of revenue YoY and operating-income YoY."""
    if current_q_standalone is None or prior_year_q_standalone is None:
        return math.nan

    def yoy(key: str) -> float:
        curr = current_q_standalone.get(key)
        prev = prior_year_q_standalone.get(key)
        if curr is None or prev is None or prev == 0:
            return math.nan
        return (curr - prev) / abs(prev)

    revenue_yoy = yoy("revenue")
    op_yoy = yoy("op_income")
    if math.isnan(revenue_yoy) and math.isnan(op_yoy):
        return math.nan
    if math.isnan(revenue_yoy):
        return op_yoy
    if math.isnan(op_yoy):
        return revenue_yoy
    return (revenue_yoy + op_yoy) / 2.0


def determine_target_quarter(target_date: date) -> tuple[int, str]:
    """Return latest safely disclosed quarter using deadline + 30-day grace."""
    md = (target_date.month, target_date.day)
    year = target_date.year
    if md >= (12, 16):
        return year, "Q3"
    if md >= (9, 16):
        return year, "Q2"
    if md >= (6, 16):
        return year, "Q1"
    if md >= (5, 2):
        return year - 1, "Q4"
    return year - 1, "Q3"


def _latest_safe_annual_year(target_date: date) -> int:
    return target_date.year - 1 if (target_date.month, target_date.day) >= (5, 2) else target_date.year - 2


def _dart_get(*, url: str, fs_div: str, params: dict, timeout: int = 30) -> dict:
    import requests

    full_params = {**params, "fs_div": fs_div}
    resp = requests.get(url, params=full_params, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def fetch_financial_with_fallback(corp_code: str, bsns_year: str, reprt_code: str, api_key: str) -> tuple[Optional[dict], str, list[str]]:
    """Fetch DART financials with CFS first, OFS fallback on no-data."""
    params = {"crtfc_key": api_key, "corp_code": corp_code, "bsns_year": bsns_year, "reprt_code": reprt_code}
    for scope in ("CFS", "OFS"):
        payload = _dart_get(url=DART_FNLTT_URL, params=params, fs_div=scope)
        try:
            parsed, alias_meta = parse_dart_financial_response(payload)
            return parsed, scope, alias_meta
        except DartNoDataError as exc:
            if exc.status == "013":
                continue
            raise
    return None, "NONE", []


def _today() -> date:
    return date.today()


def _cache_lookup(client, corp_code: str, period_type: str, period_key: str) -> Optional[dict]:
    res = (
        client.table("dart_financial_cache")
        .select("*")
        .eq("corp_code", corp_code)
        .eq("period_type", period_type)
        .eq("period_key", period_key)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


def _parse_date(value: object) -> Optional[date]:
    if value is None:
        return None
    text = str(value)
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            return None


def _not_yet_disclosed_is_fresh(row: dict, as_of_date: Optional[date] = None) -> bool:
    """TTL freshness of a 'not_yet_disclosed' cache row.

    PIT fix (C1): historical harvests must evaluate freshness as-of the harvest
    month, not date.today(). Otherwise a 2024 'not_yet_disclosed' row is judged
    'stale' in 2026 and silently re-fetched (mutating historical signal values).
    Defaults to _today() to preserve live-screen behavior when as_of_date is None.
    """
    fetched_at = _parse_date(row.get("fetched_at"))
    if fetched_at is None:
        return False
    ref = as_of_date or _today()
    return (ref - fetched_at).days < NOT_YET_DISCLOSED_TTL_DAYS


def _deadline_with_grace(year: int, kind: str) -> Optional[date]:
    md = QUARTERLY_DEADLINE_MD.get(kind)
    if md is None:
        return None
    return date(year, md[0], md[1]) + timedelta(days=DISCLOSURE_GRACE_DAYS)


def _is_within_disclosure_window(year: int, kind: str, as_of_date: Optional[date] = None) -> bool:
    """True if (year, kind) is still inside its statutory deadline + grace window.

    PIT fix (C1): for historical harvests the reference date is the harvest month
    (as_of_date), not date.today(). A quarter not yet past deadline+grace as-of t was
    not safely disclosed at t. Defaults to _today() for the live screen.
    """
    deadline = _deadline_with_grace(year, kind)
    if deadline is None:
        return False
    ref = as_of_date or _today()
    return ref <= deadline


def _upsert_cache(client, row: dict) -> None:
    client.table("dart_financial_cache").upsert(row, on_conflict="corp_code,period_type,period_key").execute()


def _cache_row_from_fetch(
    *,
    corp_code: str,
    period_type: str,
    period_key: str,
    parsed: Optional[dict],
    statement_scope: str,
    source_report_code: str,
    calculation_basis: str,
    status: str,
    error_code: Optional[str] = None,
) -> dict:
    row = {
        "corp_code": corp_code,
        "period_type": period_type,
        "period_key": period_key,
        "statement_scope": statement_scope,
        "status": status,
        "error_code": error_code,
        "source_report_code": source_report_code,
        "calculation_basis": calculation_basis,
    }
    for key in FINANCIAL_KEYS:
        row[key] = None if parsed is None else parsed.get(key)
    return row


def _cache_only_miss_row(corp_code: str, period_type: str, period_key: str, *, status: str = "no_data") -> dict:
    """Synthetic miss row for cache-only harvest (no HTTP, no upsert).

    PIT/feasibility fix (C7): the 12-24M harvest reads dart_financial_cache only.
    On a cache miss it must NOT issue a live DART fetch (refetch-storm guard) and must
    NOT mutate the cache. Returns a row that _row_to_financials maps to None → the
    factor pipeline degrades the ticker to the structural-missing neutral tier (§3C).
    """
    row = {"corp_code": corp_code, "period_type": period_type, "period_key": period_key,
           "status": status, "statement_scope": "NONE", "error_code": "cache_only_miss"}
    for key in FINANCIAL_KEYS:
        row[key] = None
    return row


def cache_get_or_fetch_annual(
    client, corp_code: str, year: int, api_key: str, *, cache_only: bool = False
) -> dict:
    period_key = str(year)
    cached = _cache_lookup(client, corp_code, "annual", period_key)
    if cached is not None:
        return cached
    if cache_only:
        return _cache_only_miss_row(corp_code, "annual", period_key)
    parsed, scope, _alias = fetch_financial_with_fallback(corp_code, str(year), REPORT_CODE_MAP["annual"], api_key)
    row = _cache_row_from_fetch(
        corp_code=corp_code,
        period_type="annual",
        period_key=period_key,
        parsed=parsed,
        statement_scope=scope,
        source_report_code=REPORT_CODE_MAP["annual"],
        calculation_basis="annual",
        status="ok" if parsed is not None else "no_data",
        error_code=None if parsed is not None else "013",
    )
    _upsert_cache(client, row)
    return row


def cache_get_or_fetch_quarterly(
    client, corp_code: str, year: int, kind: str, api_key: str,
    *, as_of_date: Optional[date] = None, cache_only: bool = False,
) -> dict:
    period_key = PERIOD_KEY_MAP[kind].format(year=year)
    cached = _cache_lookup(client, corp_code, "quarterly", period_key)
    if cached is not None:
        if cached.get("status") != "not_yet_disclosed" or _not_yet_disclosed_is_fresh(cached, as_of_date):
            return cached

    if cache_only:
        # No HTTP in harvest mode: if the quarter was not yet disclosed as-of the
        # harvest month, it is genuinely unavailable PIT (not_yet_disclosed); else no_data.
        status = "not_yet_disclosed" if _is_within_disclosure_window(year, kind, as_of_date) else "no_data"
        return _cache_only_miss_row(corp_code, "quarterly", period_key, status=status)

    parsed, scope, _alias = fetch_financial_with_fallback(corp_code, str(year), REPORT_CODE_MAP[kind], api_key)
    no_data_status = "not_yet_disclosed" if parsed is None and _is_within_disclosure_window(year, kind, as_of_date) else "no_data"
    row = _cache_row_from_fetch(
        corp_code=corp_code,
        period_type="quarterly",
        period_key=period_key,
        parsed=parsed,
        statement_scope=scope,
        source_report_code=REPORT_CODE_MAP[kind],
        calculation_basis=CALCULATION_BASIS_MAP[kind],
        status="ok" if parsed is not None else no_data_status,
        error_code=None if parsed is not None else "013",
    )
    _upsert_cache(client, row)
    return row


def _row_to_financials(row: Optional[dict]) -> Optional[dict]:
    if row is None or row.get("status") != "ok":
        return None
    return {key: row.get(key) for key in FINANCIAL_KEYS}


def _get_standalone_quarter(
    client, corp_code: str, year: int, quarter: str, api_key: str,
    *, as_of_date: Optional[date] = None, cache_only: bool = False,
) -> tuple[Optional[dict], str]:
    def q(kind: str) -> dict:
        return cache_get_or_fetch_quarterly(
            client, corp_code, year, kind, api_key, as_of_date=as_of_date, cache_only=cache_only
        )

    if quarter == "Q1":
        row = q("Q1")
        return _row_to_financials(row), row.get("calculation_basis", "not_applicable")
    if quarter == "Q2":
        q1 = _row_to_financials(q("Q1"))
        h1 = _row_to_financials(q("H1"))
        return compute_standalone_quarter("Q2", h1_cumulative=h1, q1_cumulative=q1), "standalone"
    if quarter == "Q3":
        h1 = _row_to_financials(q("H1"))
        nine_m = _row_to_financials(q("9M"))
        return compute_standalone_quarter("Q3", nine_m_cumulative=nine_m, h1_cumulative=h1), "standalone"
    if quarter == "Q4":
        annual = _row_to_financials(cache_get_or_fetch_annual(client, corp_code, year, api_key, cache_only=cache_only))
        nine_m = _row_to_financials(q("9M"))
        return compute_standalone_quarter("Q4", annual_cumulative=annual, nine_m_cumulative=nine_m), "standalone"
    raise ValueError(f"Unsupported quarter: {quarter}")


def _previous_quarter(year: int, quarter: str) -> tuple[int, str]:
    order = ["Q1", "Q2", "Q3", "Q4"]
    idx = order.index(quarter)
    return (year - 1, "Q4") if idx == 0 else (year, order[idx - 1])


def _lookup_corp_code(client, ticker: str) -> Optional[str]:
    res = client.table("dart_corp_codes").select("corp_code").eq("ticker", ticker).limit(1).execute()
    rows = res.data or []
    return rows[0].get("corp_code") if rows else None


def fetch_dart_signals(
    client, ticker: str, target_date: date, api_key: Optional[str],
    *, as_of_date: Optional[date] = None, cache_only: bool = False,
) -> DartSignalsResult:
    """Fetch Signal 4/5 raw DART values for one ticker using Supabase caches.

    PIT (C1): determine_target_quarter/_latest_safe_annual_year already key off target_date,
    so the *quarter selected* is point-in-time. as_of_date (defaults to target_date) additionally
    anchors the disclosure-window / cache-freshness checks to the harvest month — removing the
    date.today() look-ahead when re-running historical months (live screen passes target_date≈today
    so behavior is unchanged). cache_only=True (harvest, C7): read dart_financial_cache only, never
    issue live DART HTTP; cache misses degrade to structural-missing (neutral 50) downstream.
    """
    if not api_key:
        return DartSignalsResult()
    as_of = as_of_date or target_date
    corp_code = _lookup_corp_code(client, ticker)
    if not corp_code:
        return DartSignalsResult()

    annual_year = _latest_safe_annual_year(target_date)
    annual_x = _row_to_financials(cache_get_or_fetch_annual(client, corp_code, annual_year, api_key, cache_only=cache_only))
    annual_x_1 = _row_to_financials(cache_get_or_fetch_annual(client, corp_code, annual_year - 1, api_key, cache_only=cache_only))
    quality_metrics, quality_insufficient = compute_quality_score(annual_x, annual_x_1)

    target_year, target_quarter = determine_target_quarter(target_date)
    earnings_raw = math.nan
    basis = "not_applicable"
    for _ in range(3):
        current, current_basis = _get_standalone_quarter(
            client, corp_code, target_year, target_quarter, api_key, as_of_date=as_of, cache_only=cache_only)
        prior, _prior_basis = _get_standalone_quarter(
            client, corp_code, target_year - 1, target_quarter, api_key, as_of_date=as_of, cache_only=cache_only)
        earnings_raw = compute_yoy_earnings_momentum(current, prior)
        if not math.isnan(earnings_raw):
            basis = current_basis
            break
        target_year, target_quarter = _previous_quarter(target_year, target_quarter)
    if math.isnan(earnings_raw):
        earnings_raw = 0.0

    return DartSignalsResult(
        earnings_raw=earnings_raw,
        quality_raw_metrics=quality_metrics,
        quality_insufficient=quality_insufficient,
        signal_4_basis=basis,
    )
