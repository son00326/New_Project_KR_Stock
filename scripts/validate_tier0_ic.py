#!/usr/bin/env python3
"""주픽(JooPick) — Tier 0 B++ 삼중 게이트 하버스트 (recall + rank-IC + size).

SoT: docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md §4

세 게이트를 **모두**(AND posture) 산출한다:
- Gate A — Recall (primary, 사용자 질문의 정답지): forward-return top-decile positive winner를
  150 후보가 얼마나 잡는가. overall/horizon/Large+Mid/baseline 비교 + visible-trend-miss split +
  11-leader tripwire(합격기준 아님).
- Gate B — Rank-IC (scoped sanity): 유동 universe·size 슬리브·top-tercile scope Spearman IC +
  IC IR + positive IC months + decile spread(거래비용 차감 후) + baseline IC 비교.
- Gate C — Size composition (deterministic, 백테스트 불요): 최종 150 sleeve dist 60/60/30 +
  Small ≤ 25% + score-log(mcap) 상관 report.

**핵심 원칙(spec §4)**: Tier0는 recall 도구이지 mini-portfolio가 아니다. recall과 whole-cross-section
IC는 부분 상충 → IC는 scope를 건다. 11-leader는 tripwire(target leakage 방지), 합격은 aggregate
PIT/OOS recall로만.

데이터 PIT 정합(§4 데이터 검증 리스크):
- **survivorship (최대 리스크, §5 step 0 blocking)**: KRX bydd_trd historical snapshot이 PIT
  universe(상폐-at-time 포함)인지는 `scripts/probe_pit_survivorship.py`로 검증한다(77차 1차 probe:
  2024-12-16 KOSPI 25종목이 2026-06 universe에 부재 = 상폐/합병-at-time 포착). **이는 1차 증거이며,
  harvest 실행 전 probe 아티팩트로 재확인이 blocking 선결**이다. probe가 상폐 종목 포착을 증명 못 하면
  harvest report에 `survivorship_label="survivorship-biased: recall=upper-bound"` + 신뢰도 하향(§4/§5).
  잔여 = mid-horizon 상폐/halt forward-return은 gap(생존)/delisted(상폐) 구분 + last-available 처리.
- **DART announcement-date PIT**: dart_signals.determine_target_quarter/_latest_safe_annual_year가
  target_date(historical t) 기준 deadline+grace로 '발표된' 분기만 선택(미래 실적 leakage 차단). 잔여
  = restatement 버전 PIT(rcept_dt 저장)는 step-2 follow-up(캐시상 restatement 드묾, §5).
- entry = t+1 종가(스크린은 t 종가 후 실행 → same-bar 편향 차단, §4 line 96). forward = entry→entry+h.

순수 메트릭/패널 로직은 모두 테스트 가능(injectable). 실 KRX/pykrx/DART provider는 CLI에서만 wire —
12-24M 실 run은 비용·시간 게이트(§5 step 2).
"""
from __future__ import annotations

import bisect
import json
import math
import os
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Callable, Literal, Optional, Sequence

_DIR = Path(__file__).parent
sys.path.insert(0, str(_DIR))
import tier0_factors as F  # noqa: E402


# ============================================================================
# Constants (§4 — [assumption] markers는 calibrate 대상)
# ============================================================================

# 거래일 근사 horizon (1M/3M/6M ≈ 21/63/126 거래일).
HORIZON_DAYS: dict[str, int] = {"short": 21, "mid": 63, "long": 126}

TOP_DECILE_Q = 0.90  # forward-return 상위 decile threshold.

# KR round-trip 거래비용 [assumption]: 거래세 0.18~0.23% + 슬리피지 ≈ 0.4% (decile spread 차감).
ROUND_TRIP_COST = 0.004
DELISTING_RETURN_NO_PRICE = -1.0
MIN_DELIST_LOOKAHEAD = 5

# Stage-1 외국인: 선정일 직전 trailing 외국인 순매수 누적 창 (≈60 거래일). 한 콜로 전종목 net 합산.
FOREIGN_WINDOW_CAL_DAYS = 90

# 관측 11-leader basket (tripwire 전용, 합격 기준 아님 §4 — target leakage 금지).
LEADER_BASKET_2026_06: dict[str, str] = {
    "005930": "삼성전자", "000660": "SK하이닉스", "267260": "HD현대일렉트릭",
    "042660": "한화오션", "329180": "HD현대중공업", "012450": "한화에어로스페이스",
    "010140": "삼성중공업", "373220": "LG에너지솔루션", "034020": "두산에너빌리티",
    "086520": "에코프로", "247540": "에코프로비엠",
}

# Gate 임계 (§4 — 잠정·calibrate).
GATE_A_OVERALL_RECALL_MIN = 0.20
GATE_A_RANDOM_RATIO_MIN = 2.5
GATE_A_HORIZON_RECALL_MIN = 0.12
GATE_A_LARGEMID_RECALL_MIN = 0.35
GATE_A_LARGEMID_VS_OVERALL_MIN = 0.80
GATE_B_IC_IR_MIN = 0.30
GATE_B_POS_MONTHS_MIN = 0.60
GATE_C_SMALL_MAX_FRACTION = 0.25

SELECTIVE_LARGEMID_ADJUDICATED_COUNT = 50
SELECTIVE_LARGEMID_SENSITIVITY_COUNTS = (30, 75)
SELECTIVE_LARGEMID_ALLOWED_COUNTS = (
    *SELECTIVE_LARGEMID_SENSITIVITY_COUNTS[:1],
    SELECTIVE_LARGEMID_ADJUDICATED_COUNT,
    *SELECTIVE_LARGEMID_SENSITIVITY_COUNTS[1:],
)


# ============================================================================
# PIT panel — KRX bydd_trd historical snapshot (survivorship-bias-free universe)
# ============================================================================

@dataclass
class PanelRow:
    close: float
    high: float
    trdval: float
    mktcap: float
    name: str = ""
    market: str = ""
    list_shrs: float = 0.0  # (C) 상장주식수 as-of (net-issuance용; 0.0=미가용/default 경로 미사용).


# panel: {date_str(YYYYMMDD): {ticker: PanelRow}}
Panel = dict[str, dict[str, PanelRow]]


def business_days_desc(end: date, span_calendar_days: int) -> list[str]:
    """end에서 span_calendar_days 역산한 영업일(주말 제외) 오름차순 YYYYMMDD 문자열."""
    days = [end - timedelta(days=o) for o in range(span_calendar_days)]
    return sorted(d.strftime("%Y%m%d") for d in days if d.weekday() < 5)


def load_pit_panel(
    bas_dds: Sequence[str],
    markets: Sequence[str] = ("KOSPI", "KOSDAQ"),
    *,
    fetch: Optional[Callable[[str, str], list[dict]]] = None,
    cache_dir: Optional[Path] = None,
    progress: bool = False,
) -> Panel:
    """각 영업일×market의 bydd_trd snapshot → PIT panel. fetch/캐시 injectable.

    캐시(JSON, date+market 키)로 12-24M 재fetch 방지(§5 step 2 장시간 run 대비).
    """
    from krx_openapi import _to_float
    if fetch is None:
        from krx_openapi import fetch_bydd_trd as fetch  # type: ignore[assignment]

    panel: Panel = {}
    for i, bas_dd in enumerate(bas_dds):
        day: dict[str, PanelRow] = {}
        for market in markets:
            rows = _cached_fetch(fetch, market, bas_dd, cache_dir)
            for r in rows:
                ticker = r.get("ISU_CD")
                close = _to_float(r.get("TDD_CLSPRC"))
                if not ticker or close <= 0:
                    continue
                day[ticker] = PanelRow(
                    close=close,
                    high=_to_float(r.get("TDD_HGPRC")) or close,
                    trdval=_to_float(r.get("ACC_TRDVAL")),
                    mktcap=_to_float(r.get("MKTCAP")),
                    name=r.get("ISU_NM", ""),
                    market=market,
                    list_shrs=_to_float(r.get("LIST_SHRS")) or 0.0,  # (C) net-issuance (additive; default 미사용).
                )
        if day:
            panel[bas_dd] = day
        if progress and (i + 1) % 50 == 0:
            print(f"  [panel] {i + 1}/{len(bas_dds)} days", file=sys.stderr, flush=True)
    return panel


def _cached_fetch(fetch, market: str, bas_dd: str, cache_dir: Optional[Path]) -> list[dict]:
    if cache_dir is None:
        return fetch(market, bas_dd)
    cache_dir.mkdir(parents=True, exist_ok=True)
    cf = cache_dir / f"{market}_{bas_dd}.json"
    if cf.exists():
        try:
            return json.loads(cf.read_text())
        except (ValueError, OSError):
            pass
    rows = fetch(market, bas_dd)
    try:
        cf.write_text(json.dumps(rows))
    except OSError:
        pass
    return rows


# ============================================================================
# Forward returns (delisting 처리 §4)
# ============================================================================

def panel_trading_days(panel: Panel) -> list[str]:
    """panel의 실제 거래일 키 오름차순. compute_forward_return의 `dates`는 **반드시** 이것을
    써야 한다(business_days_desc는 KR 공휴일 포함 weekday라 fetch 범위 생성 전용 — 인덱스 금지)."""
    return sorted(panel.keys())


def _price_at(panel: Panel, dates: Sequence[str], ticker: str, idx: int) -> float:
    if idx < 0 or idx >= len(dates):
        return math.nan
    row = panel.get(dates[idx], {}).get(ticker)
    return row.close if (row is not None and row.close > 0) else math.nan


def _first_price_from(panel, dates, ticker, lo: int, hi: int) -> tuple[float, int]:
    """[lo, hi] 첫 가용 (price, idx). 없으면 (nan, -1)."""
    for j in range(lo, min(hi, len(dates) - 1) + 1):
        p = _price_at(panel, dates, ticker, j)
        if not _is_nan(p):
            return (p, j)
    return (math.nan, -1)


def _last_price_in(panel, dates, ticker, lo: int, hi: int) -> float:
    for j in range(min(hi, len(dates) - 1), lo - 1, -1):
        p = _price_at(panel, dates, ticker, j)
        if not _is_nan(p):
            return p
    return math.nan


def _any_price_after(panel, dates, ticker, idx: int) -> bool:
    for j in range(idx + 1, len(dates)):
        if not _is_nan(_price_at(panel, dates, ticker, j)):
            return True
    return False


ENTRY_OFFSET_DAYS = 1   # 스크린은 t 종가 후 실행 → 진입은 t+1 (§4: same-bar 편향 차단).
ENTRY_GAP_DAYS = 5      # t+1 휴장/halt 시 진입가 forward 탐색 허용 폭.


def compute_forward_return(
    panel: Panel, dates: Sequence[str], ticker: str, t_idx: int, horizon_days: int,
    *, entry_offset: int = ENTRY_OFFSET_DAYS,
) -> tuple[float, str]:
    """forward return + status. **entry = t+entry_offset 종가**(기본 t+1, §4 same-bar 편향 차단).

    `dates` = panel_trading_days(panel) (거래일 키, 공휴일 포함 weekday 금지). horizon_days는
    거래일 오프셋.

    status: 'ok'(target 거래일 생존) · 'gap'(target일 부재지만 이후 재거래 = halt/누락 → 최근가용가)·
    'delisted'(target 이후 가격 전무 = 진짜 상폐 → last-available) · 'insufficient'(범위 밖) ·
    'absent'(진입 시점 거래 부재). gap/delisted 구분으로 halt를 상폐로 오분류하지 않는다(적대검토 MED).
    """
    entry_idx = t_idx + entry_offset
    if entry_idx >= len(dates):
        return (math.nan, "insufficient")
    p0, used_entry = _first_price_from(panel, dates, ticker, entry_idx, entry_idx + ENTRY_GAP_DAYS)
    if _is_nan(p0):
        return (math.nan, "absent")
    target_idx = used_entry + horizon_days
    if target_idx >= len(dates):
        return (math.nan, "insufficient")
    p_tgt = _price_at(panel, dates, ticker, target_idx)
    if not _is_nan(p_tgt):
        return (p_tgt / p0 - 1.0, "ok")
    # target일 부재: 이후 재거래 여부로 gap(생존) vs delisted(상폐) 구분.
    alive_after = _any_price_after(panel, dates, ticker, target_idx)
    last_before = _last_price_in(panel, dates, ticker, used_entry + 1, target_idx)
    if not _is_nan(last_before):
        return (last_before / p0 - 1.0, "gap" if alive_after else "delisted")
    if alive_after:
        nxt, _ = _first_price_from(panel, dates, ticker, target_idx + 1, len(dates) - 1)
        if not _is_nan(nxt):
            return (nxt / p0 - 1.0, "gap")
    if target_idx + MIN_DELIST_LOOKAHEAD > len(dates) - 1:
        return (math.nan, "insufficient")
    return (DELISTING_RETURN_NO_PRICE, "delisted")


def top_decile_winners(
    returns_by_ticker: dict[str, float], q: float = TOP_DECILE_Q
) -> set[str]:
    """forward-return 상위 decile AND positive = winner (§4 Gate A)."""
    present = sorted(v for v in returns_by_ticker.values() if not _is_nan(v))
    if len(present) < 10:
        return set()
    thresh = F.quantile(present, q)
    return {
        t for t, r in returns_by_ticker.items()
        if not _is_nan(r) and r >= thresh and r > 0.0
    }


def _is_nan(x: object) -> bool:
    return isinstance(x, float) and math.isnan(x)


# ============================================================================
# cfg7 winner-move (TASK B) — PRE-REGISTERED, frozen, non-tunable
# ============================================================================
# A "winner move" for ticker i at selection month t, horizon h occurs on the FIRST forward trading day
# d (d >= entry_idx = t + ENTRY_OFFSET_DAYS, with ENTRY_GAP_DAYS halt tolerance — identical to
# compute_forward_return) for which the cumulative return from the entry price p0 reaches the SAME
# top-decile winner threshold used by Gate A:
#     threshold_h = F.quantile(present forward_h returns, TOP_DECILE_Q=0.90)  AND  cum_ret >= threshold_h
#                   AND cum_ret > 0
# i.e. the bar is the first day the running cumulative return crosses the cross-sectional top-decile-
# positive bar that top_decile_winners() uses to DEFINE winners. lead-time = (that day's index − entry_idx)
# in trading days. If the pick never crosses within horizon_days[h], lead-time is CENSORED (NaN, counted
# separately — never imputed to 0 or horizon). No new tunable threshold is introduced.

def first_day_reaching_threshold(
    panel: Panel, dates: Sequence[str], ticker: str, t_idx: int, threshold: float, horizon_days: int,
    *, entry_offset: int = ENTRY_OFFSET_DAYS,
) -> Optional[int]:
    """Lead-time (trading days from entry) to the first forward day whose cumulative return from the
    entry price >= `threshold` AND > 0, within [entry, entry+horizon_days]. None = censored (never crossed)
    OR insufficient data. Mirrors compute_forward_return's entry (t+1, ENTRY_GAP_DAYS halt tolerance).
    """
    if _is_nan(threshold):
        return None
    entry_idx = t_idx + entry_offset
    if entry_idx >= len(dates):
        return None
    p0, used_entry = _first_price_from(panel, dates, ticker, entry_idx, entry_idx + ENTRY_GAP_DAYS)
    if _is_nan(p0) or p0 <= 0:
        return None
    last_idx = used_entry + horizon_days
    for j in range(used_entry + 1, min(last_idx, len(dates) - 1) + 1):
        p = _price_at(panel, dates, ticker, j)
        if _is_nan(p):
            continue
        cum = p / p0 - 1.0
        if cum >= threshold and cum > 0.0:
            return j - used_entry
    return None  # censored within horizon


# ============================================================================
# Gate A — Recall
# ============================================================================

def recall(selected: set[str], winners: set[str]) -> float:
    if not winners:
        return math.nan
    return len(selected & winners) / len(winners)


@dataclass
class RecallReport:
    overall: float = math.nan
    random_baseline: float = math.nan
    random_ratio: float = math.nan
    per_horizon: dict[str, float] = field(default_factory=dict)
    largemid_recall: float = math.nan
    largemid_vs_overall: float = math.nan
    leader_hits: int = 0
    leader_total: int = 0
    baseline_recall: float = math.nan
    # 진단 전용 (분모 조정 안 함, §4 MED1)
    visible_trend_miss: int = 0
    prediction_miss: int = 0


def gate_a_recall(
    selected_all: set[str],
    selected_by_horizon: dict[str, set[str]],
    winners_all: set[str],
    winners_by_horizon: dict[str, set[str]],
    universe_size: int,
    *,
    largemid_selected: set[str],
    largemid_winners: set[str],
    leader_basket: dict[str, str],
    baseline_selected: Optional[set[str]] = None,
) -> RecallReport:
    """Gate A 전체 recall 메트릭. 분모는 항상 전체 top-decile positive winners(§4 MED1)."""
    rep = RecallReport()
    rep.overall = recall(selected_all, winners_all)
    rep.random_baseline = (len(selected_all) / universe_size) if universe_size > 0 else math.nan
    if not _is_nan(rep.overall) and rep.random_baseline and rep.random_baseline > 0:
        rep.random_ratio = rep.overall / rep.random_baseline
    # 적대검토 MED: selected/winner horizon 키의 합집합으로 — winner는 있는데 coverage 0인
    # horizon이 누락돼 무사통과하는 것을 막는다.
    horizon_keys = set(selected_by_horizon) | set(winners_by_horizon)
    rep.per_horizon = {
        h: recall(selected_by_horizon.get(h, set()), winners_by_horizon.get(h, set()))
        for h in horizon_keys
    }
    rep.largemid_recall = recall(largemid_selected, largemid_winners)
    if not _is_nan(rep.overall) and rep.overall > 0 and not _is_nan(rep.largemid_recall):
        rep.largemid_vs_overall = rep.largemid_recall / rep.overall
    rep.leader_total = len(leader_basket)
    rep.leader_hits = len(set(leader_basket) & selected_all)
    if baseline_selected is not None:
        rep.baseline_recall = recall(baseline_selected, winners_all)
    return rep


def classify_missed_winners(
    missed: set[str],
    trend_rank_by_ticker: dict[str, float],
    *,
    visible_threshold: float = 70.0,
) -> tuple[int, int]:
    """놓친 winner를 visible-trend-miss(선정일 이미 추세 → 고칠 수 있는 blind spot) vs
    prediction-miss(t엔 조용 → 예측 불가)로 **분류만**(분모 조정 금지, §4 MED1).

    trend_rank ≥ visible_threshold면 visible-trend-miss(심각).
    """
    visible = sum(
        1 for t in missed
        if not _is_nan(trend_rank_by_ticker.get(t, math.nan))
        and trend_rank_by_ticker[t] >= visible_threshold
    )
    return visible, len(missed) - visible


def gate_a_pass(rep: RecallReport) -> tuple[bool, list[str]]:
    """§4 Gate A PASS 조건 (AND). 반환 = (pass, 실패사유 리스트)."""
    fails: list[str] = []
    if _is_nan(rep.overall) or rep.overall < GATE_A_OVERALL_RECALL_MIN:
        fails.append(f"overall recall {rep.overall:.3f} < {GATE_A_OVERALL_RECALL_MIN}")
    if _is_nan(rep.random_ratio) or rep.random_ratio < GATE_A_RANDOM_RATIO_MIN:
        fails.append(f"random ratio {rep.random_ratio:.2f} < {GATE_A_RANDOM_RATIO_MIN}")
    for h, r in rep.per_horizon.items():
        if _is_nan(r) or r < GATE_A_HORIZON_RECALL_MIN:
            fails.append(f"{h} recall {r:.3f} < {GATE_A_HORIZON_RECALL_MIN}")
    if _is_nan(rep.largemid_recall) or rep.largemid_recall < GATE_A_LARGEMID_RECALL_MIN:
        fails.append(f"Large+Mid recall {rep.largemid_recall:.3f} < {GATE_A_LARGEMID_RECALL_MIN}")
    if _is_nan(rep.largemid_vs_overall) or rep.largemid_vs_overall < GATE_A_LARGEMID_VS_OVERALL_MIN:
        fails.append(f"Large+Mid/overall {rep.largemid_vs_overall:.2f} < {GATE_A_LARGEMID_VS_OVERALL_MIN}")
    # baseline 비교는 필수(§3D anti-overfitting) — 미제공 시 무사통과 금지(적대검토 MED).
    if _is_nan(rep.baseline_recall):
        fails.append("baseline recall 미제공 — B++ 복잡도 정당화 비교 필수(§3D), gate FAIL")
    elif not _is_nan(rep.overall) and rep.overall <= rep.baseline_recall:
        fails.append(f"baseline recall {rep.baseline_recall:.3f} ≥ B++ {rep.overall:.3f} (복잡도 미정당화)")
    return (len(fails) == 0, fails)


def gate_a_pass_largemid(rep: RecallReport) -> tuple[bool, list[str]]:
    """Gate A PASS for the LARGEMID FROZEN PROTOCOL (TASK A, additive — never used on universe='all').

    On the largemid path the *whole universe* is already large+mid by construction, so the
    all-universe-vs-largemid sub-checks (GATE_A_LARGEMID_RECALL_MIN 0.35, GATE_A_LARGEMID_VS_OVERALL_MIN
    0.80) are redundant/contradictory — `overall == largemid` makes the ratio trivially 1.0 and the 0.35
    bar would silently dominate the pre-registered conservative 0.20 bar. The freeze doc
    (docs/superpowers/2026-06-17-tier0-largemid-freeze.md §3) PRE-REGISTERS the binding bar as
    GATE_A_OVERALL_RECALL_MIN (0.20) — identical thresholds, same constants, only the redundant
    largemid sub-checks dropped. The recall/random-ratio/horizon/baseline checks reuse the IDENTICAL
    constants as gate_a_pass (no threshold edits). 'recall must beat baseline' stays enforced verbatim.
    """
    fails: list[str] = []
    if _is_nan(rep.overall) or rep.overall < GATE_A_OVERALL_RECALL_MIN:
        fails.append(f"overall recall {rep.overall:.3f} < {GATE_A_OVERALL_RECALL_MIN}")
    if _is_nan(rep.random_ratio) or rep.random_ratio < GATE_A_RANDOM_RATIO_MIN:
        fails.append(f"random ratio {rep.random_ratio:.2f} < {GATE_A_RANDOM_RATIO_MIN}")
    for h, r in rep.per_horizon.items():
        if _is_nan(r) or r < GATE_A_HORIZON_RECALL_MIN:
            fails.append(f"{h} recall {r:.3f} < {GATE_A_HORIZON_RECALL_MIN}")
    if _is_nan(rep.baseline_recall):
        fails.append("baseline recall 미제공 — largemid 복잡도 정당화 비교 필수(§3D), gate FAIL")
    elif not _is_nan(rep.overall) and rep.overall <= rep.baseline_recall:
        fails.append(f"baseline recall {rep.baseline_recall:.3f} ≥ largemid {rep.overall:.3f} (미정당화)")
    return (len(fails) == 0, fails)


def gate_a_pass_selective_largemid(
    lift_ci90: Sequence[float], lift_mean: float, ic_ir: float,
) -> tuple[bool, list[str]]:
    """Gate A PASS for TASK 가 SELECTIVE LARGEMID (additive — selected only when select_count is not None).

    PRE-REGISTERED BINDING METRIC (docs/superpowers/2026-06-18-tier0-selective-largemid.md, frozen
    before run): PRIMARY = pooled recall-LIFT = recall(top-N) − same-count-N RANDOM-baseline recall.
    PASS iff the monthly-empirical CI90 of the per-month recall-LIFT series has LOWER BOUND > 0.
    FALLBACK (CI unavailable, <2 present months → NaN): margin lift ≥ +5pp (lift_mean ≥ 0.05).
    CO-GATE (necessary, not sufficient): rank-IC IR ≥ GATE_B_IC_IR_MIN (0.30). 'skill' iff BOTH hold.

    The absolute recall ≥ GATE_A_OVERALL_RECALL_MIN (0.20) bar is EXPLICITLY NOT the binding bar here
    (it is the all-universe / largemid-freeze bar). This is a SEPARATE additive gate variant; the
    existing gate_a_pass / gate_a_pass_largemid stay byte-identical and are never called on this path.
    """
    fails: list[str] = []
    lo = lift_ci90[0] if isinstance(lift_ci90, (list, tuple)) and len(lift_ci90) == 2 else math.nan
    if not _is_nan(lo):
        if not (lo > 0):
            fails.append(f"recall-lift CI90 lower {lo:.4f} ≤ 0 (primary FAIL)")
    else:
        # CI unavailable → pre-registered +5pp fallback.
        if _is_nan(lift_mean) or lift_mean < 0.05:
            fails.append(f"recall-lift CI90 미가용 + fallback lift_mean {lift_mean} < +0.05 (FAIL)")
    if _is_nan(ic_ir) or not math.isfinite(ic_ir) or ic_ir < GATE_B_IC_IR_MIN:
        fails.append(f"co-gate rank-IC IR {ic_ir} < {GATE_B_IC_IR_MIN}")
    return (len(fails) == 0, fails)


# ============================================================================
# Gate B — Rank-IC (scoped)
# ============================================================================

def ic_information_ratio(monthly_ics: Sequence[float]) -> float:
    """IC IR = mean(월별 IC) / std(월별 IC). present만, n<2 → NaN."""
    present = [v for v in monthly_ics if not _is_nan(v)]
    if len(present) < 2:
        return math.nan
    mean = sum(present) / len(present)
    sd = F.stdev_pop(present)
    if _is_nan(sd):
        return math.nan
    if math.isclose(sd, 0.0, abs_tol=1e-12):
        if mean > 0:
            return math.inf
        if mean < 0:
            return -math.inf
        return math.nan
    return mean / sd


def positive_ic_fraction(monthly_ics: Sequence[float]) -> float:
    present = [v for v in monthly_ics if not _is_nan(v)]
    if not present:
        return math.nan
    return sum(1 for v in present if v > 0) / len(present)


def decile_spread(
    scores_by_ticker: dict[str, float],
    fwd_by_ticker: dict[str, float],
    *,
    cost: float = ROUND_TRIP_COST,
) -> float:
    """top decile 평균 forward − bottom decile 평균 forward − round-trip cost (§4 Gate B)."""
    pairs = [
        (s, fwd_by_ticker[t])
        for t, s in scores_by_ticker.items()
        if not _is_nan(s) and t in fwd_by_ticker and not _is_nan(fwd_by_ticker[t])
    ]
    if len(pairs) < 10:
        return math.nan
    pairs.sort(key=lambda sf: sf[0])
    k = max(1, len(pairs) // 10)
    bottom = pairs[:k]
    top = pairs[-k:]
    top_mean = sum(f for _s, f in top) / len(top)
    bot_mean = sum(f for _s, f in bottom) / len(bottom)
    return (top_mean - bot_mean) - cost


GateBVerdict = Literal["PASS", "FAIL", "ADJUDICATE"]
GateBMetrics = dict[str, float | dict[str, float]]


def gate_b_pass(
    monthly_ics: Sequence[float],
    sleeve_ics: dict[str, Sequence[float]],
    spreads: Sequence[float],
    *,
    baseline_ic_ir: Optional[float] = None,
    require_baseline: bool = True,
    top_tercile_ics: Optional[Sequence[float]] = None,
) -> tuple[GateBVerdict, list[str], GateBMetrics]:
    """§4 Gate B. 반환 = (verdict, fails, metrics). Large/Mid 슬리브별 IC mean>0 포함.

    require_baseline=True(기본)면 baseline_ic_ir 미제공도 FAIL(§3D anti-overfitting 필수, 적대검토 MED).
    B++ IR이 baseline보다 낮은 경우는 ADJUDICATE가 아니라 hard FAIL이다.
    """
    return _gate_b_verdict(
        monthly_ics=monthly_ics,
        sleeve_ics=sleeve_ics,
        spreads=spreads,
        baseline_ic_ir=baseline_ic_ir,
        require_baseline=require_baseline,
        top_tercile_ics=top_tercile_ics,
    )


def _gate_b_verdict(
    monthly_ics: Sequence[float],
    sleeve_ics: dict[str, Sequence[float]],
    spreads: Sequence[float],
    *,
    baseline_ic_ir: Optional[float],
    require_baseline: bool,
    top_tercile_ics: Optional[Sequence[float]],
) -> tuple[GateBVerdict, list[str], GateBMetrics]:
    fails: list[str] = []
    present = [v for v in monthly_ics if not _is_nan(v)]
    ic_mean = sum(present) / len(present) if present else math.nan
    ir = ic_information_ratio(monthly_ics)
    pos = positive_ic_fraction(monthly_ics)
    spread_present = [v for v in spreads if not _is_nan(v)]
    spread_mean = sum(spread_present) / len(spread_present) if spread_present else math.nan
    top_present = [v for v in (top_tercile_ics or []) if not _is_nan(v)]
    top_mean = sum(top_present) / len(top_present) if top_present else math.nan
    sleeve_means: dict[str, float] = {}

    if _is_nan(ic_mean) or ic_mean <= 0:
        fails.append(f"composite IC mean {ic_mean} ≤ 0")
    if _is_nan(ir) or not math.isfinite(ir) or ir < GATE_B_IC_IR_MIN:
        fails.append(f"IC IR {ir} < {GATE_B_IC_IR_MIN}")
    if _is_nan(pos) or pos < GATE_B_POS_MONTHS_MIN:
        fails.append(f"positive IC months {pos} < {GATE_B_POS_MONTHS_MIN}")
    if _is_nan(spread_mean) or spread_mean <= 0:
        fails.append(f"decile spread(net cost) {spread_mean} ≤ 0")
    for sleeve in ("large", "mid"):
        sic = [v for v in sleeve_ics.get(sleeve, []) if not _is_nan(v)]
        sm = sum(sic) / len(sic) if sic else math.nan
        sleeve_means[sleeve] = sm
        if _is_nan(sm) or sm <= 0:
            fails.append(f"{sleeve} sleeve IC mean {sm} ≤ 0")
    if require_baseline and (baseline_ic_ir is None or _is_nan(baseline_ic_ir)):
        fails.append("baseline IC IR 미제공 — B++ 복잡도 정당화 비교 필수(§3D), gate FAIL")
        metrics = {
            "ic_mean": ic_mean, "ic_ir": ir, "positive_months": pos,
            "decile_spread": spread_mean, "sleeve_ic_means": sleeve_means,
            "top_tercile_ic_mean": top_mean,
        }
        return ("FAIL", fails, metrics)
    elif baseline_ic_ir is not None and not _is_nan(ir) and not _is_nan(baseline_ic_ir) and ir < baseline_ic_ir:
        fails.append(f"B++ IC IR {ir:.3f} < baseline {baseline_ic_ir:.3f}")
        metrics = {
            "ic_mean": ic_mean, "ic_ir": ir, "positive_months": pos,
            "decile_spread": spread_mean, "sleeve_ic_means": sleeve_means,
            "top_tercile_ic_mean": top_mean,
        }
        return ("FAIL", fails, metrics)
    metrics = {
        "ic_mean": ic_mean, "ic_ir": ir, "positive_months": pos,
        "decile_spread": spread_mean, "sleeve_ic_means": sleeve_means,
        "top_tercile_ic_mean": top_mean,
    }
    if not fails:
        return ("PASS", fails, metrics)
    sleeve_positive = any((not _is_nan(v) and v > 0) for v in sleeve_means.values())
    top_positive = not _is_nan(top_mean) and top_mean > 0
    spread_positive = not _is_nan(spread_mean) and spread_mean > 0
    if not (sleeve_positive or top_positive or spread_positive):
        return ("FAIL", fails, metrics)
    return ("ADJUDICATE", fails, metrics)


# ============================================================================
# Gate C — Size composition (deterministic, 백테스트 불요)
# ============================================================================

def gate_c_size_composition(
    sleeve_by_ticker: dict[str, str],
    score_by_ticker: dict[str, float],
    mktcap_by_ticker: dict[str, float],
    *,
    expected: Optional[dict[str, int]] = None,
) -> tuple[bool, list[str], dict[str, float | dict[str, int]]]:
    """최종 150 size 분포 결정론 검증 + score-log(mcap) 상관 report (§4 Gate C).

    expected = sleeve별 기대 수(default L60/M60/S30). Small ≤ 25%.
    score-logmcap 상관은 report 전용(단독 pass 기준 아님).
    """
    expected = expected or {"large": 60, "mid": 60, "small": 30}
    dist = {"large": 0, "mid": 0, "small": 0}
    for t in score_by_ticker:
        sl = sleeve_by_ticker.get(t, "small")
        dist[sl] = dist.get(sl, 0) + 1
    total = sum(dist.values())
    fails: list[str] = []
    for sl, want in expected.items():
        if dist.get(sl, 0) != want:
            fails.append(f"{sl} sleeve count {dist.get(sl, 0)} != expected {want}")
    small_frac = dist.get("small", 0) / total if total else math.nan
    if not _is_nan(small_frac) and small_frac > GATE_C_SMALL_MAX_FRACTION:
        fails.append(f"Small fraction {small_frac:.2f} > {GATE_C_SMALL_MAX_FRACTION}")
    # score-log(mcap) 상관 (report)
    tickers = [t for t in score_by_ticker if not _is_nan(score_by_ticker[t]) and mktcap_by_ticker.get(t, 0) > 0]
    scores = [score_by_ticker[t] for t in tickers]
    logmcaps = [math.log(mktcap_by_ticker[t]) for t in tickers]
    corr = F._pearson(scores, logmcaps) if len(tickers) >= 2 else math.nan
    metrics = {"dist": dist, "small_fraction": small_frac, "score_logmcap_corr": corr}
    return (len(fails) == 0, fails, metrics)


# Largemid Gate C replacement: pre-registered balance band (no sleeve collapse) — freeze doc §4.
GATE_C_LARGEMID_BALANCE_LO = 0.30   # each of {large, mid} ≥ 30% of selected [pre-registered].
GATE_C_LARGEMID_BALANCE_HI = 0.70   # each of {large, mid} ≤ 70% of selected [pre-registered].


def gate_c_largemid(
    sleeve_by_ticker: dict[str, str],
    score_by_ticker: dict[str, float],
    mktcap_by_ticker: dict[str, float],
    adv_by_ticker: dict[str, float],
    *,
    sector_by_ticker: Optional[dict[str, str]] = None,
    min_adv_won: float = F.MIN_ADV_WON,
) -> tuple[bool, list[str], dict[str, object]]:
    """Gate C REPLACEMENT for the LARGEMID FROZEN PROTOCOL (TASK A, additive — cfg1-4 path untouched).

    The all-universe Gate C (60/60/30 + Small ≤ 25%) is MEANINGLESS once Small is dropped. It is
    replaced (only on the largemid path) by three PRE-REGISTERED checks (freeze doc §4):
      (i)   Large/Mid BALANCE BAND — each sleeve within [GATE_C_LARGEMID_BALANCE_LO, _HI] of selected,
            so neither sleeve collapses (reuses the same `dist` counting loop as gate_c_size_composition).
      (ii)  LIQUIDITY FLOOR (ADV) — every selected ticker passes F.liquidity_floor_pass; report
            min/median selected ADV plus the separate 1.5B-KRW owner-book reference.
      (iii) SECTOR-CONCENTRATION CAP — no PIT-safe offline universe-wide sector source exists under
            allow_supabase=False (addendum §5), so when sector_by_ticker is None we emit an explicit
            'N/A (no PIT-safe offline sector source, addendum §5)'; we do NOT call Supabase/DART.

    Keeps the (verdict-shaped) return identical to gate_c_size_composition so the triple-gate / JSON
    plumbing is unchanged.
    """
    dist = {"large": 0, "mid": 0, "small": 0}
    for t in score_by_ticker:
        sl = sleeve_by_ticker.get(t, "small")
        dist[sl] = dist.get(sl, 0) + 1
    total = sum(dist.values())
    fails: list[str] = []

    # (i) balance band — large/mid only (small must be ~0 on this path; flag if any leaked in).
    frac = {sl: (dist.get(sl, 0) / total if total else math.nan) for sl in ("large", "mid", "small")}
    if not _is_nan(frac["small"]) and frac["small"] > 0.0:
        fails.append(f"largemid path leaked small sleeve picks: small fraction {frac['small']:.2f} > 0")
    for sl in ("large", "mid"):
        f = frac[sl]
        if _is_nan(f) or f < GATE_C_LARGEMID_BALANCE_LO or f > GATE_C_LARGEMID_BALANCE_HI:
            fails.append(
                f"{sl} balance {f:.2f} outside band "
                f"[{GATE_C_LARGEMID_BALANCE_LO}, {GATE_C_LARGEMID_BALANCE_HI}]")

    # (ii) liquidity floor — every selected ticker passes the ADV floor.
    advs = [adv_by_ticker.get(t, math.nan) for t in score_by_ticker]
    below = [t for t in score_by_ticker if not F.liquidity_floor_pass(adv_by_ticker.get(t, math.nan), min_adv_won)]
    if below:
        fails.append(f"{len(below)} selected tickers below ADV floor ₩{min_adv_won:,.0f}")
    present_adv = sorted(a for a in advs if not _is_nan(a))
    min_adv = present_adv[0] if present_adv else math.nan
    median_adv = F.median(present_adv) if present_adv else math.nan
    # selected market-cap transparency (Step-5 review #2): show how small the smallest selected 'mid' name is.
    present_mcap = sorted(m for m in (mktcap_by_ticker.get(t, math.nan) for t in score_by_ticker) if not _is_nan(m))
    min_mcap = present_mcap[0] if present_mcap else math.nan
    median_mcap = F.median(present_mcap) if present_mcap else math.nan

    # (iii) sector-concentration cap — explicit N/A offline (no PIT-safe universe-wide sector source).
    if sector_by_ticker is None:
        sector_cap = "N/A (no PIT-safe offline sector source, addendum §5)"
    else:
        sect_dist: dict[str, int] = {}
        for t in score_by_ticker:
            sec = sector_by_ticker.get(t, "unresolved")
            sect_dist[sec] = sect_dist.get(sec, 0) + 1
        top_sec_frac = (max(sect_dist.values()) / total) if (total and sect_dist) else math.nan
        sector_cap = {"top_sector_fraction": top_sec_frac, "sector_dist": sect_dist}

    metrics: dict[str, object] = {
        "dist": dist,
        "large_fraction": frac["large"],
        "mid_fraction": frac["mid"],
        "small_fraction": frac["small"],
        "min_selected_adv": min_adv,
        "median_selected_adv": median_adv,
        "min_selected_mcap": min_mcap,
        "median_selected_mcap": median_mcap,
        "adv_floor_won": min_adv_won,  # ENFORCED per-stock ADV liquidity floor (F.MIN_ADV_WON = ₩2B)
        "book_capacity_reference_won": 1_500_000_000.0,  # informational: admin book size (₩1.5B owner capital), NOT the enforced floor
        "sector_cap": sector_cap,
        "protocol": "largemid-freeze",
    }
    return (len(fails) == 0, fails, metrics)


# ============================================================================
# Baselines (§3D — 복잡도 정당화용 비교)
# ============================================================================

def legacy_momentum_proxy_score(stock: F.StockRaw, bucket: str) -> float:
    """⚠️ MOMENTUM-ONLY PROXY — **NOT the 73차 production scorer** (omxy R6 HIGH).

    = close/MA60 모멘텀 × bucket 가중치(양의 상수)뿐. 가중치가 양의 상수라 모든 horizon이 같은 60D
    모멘텀 순위를 매김(mid/long은 그 tranche 2/3). 실제 production 73차는 5-시그널(모멘텀·거래량·외국인·
    실적·퀄리티) z정규화 + 수기가중치라 **본 함수와 다름**. 따라서 이 비교로 "B++가 incumbent(73차)를
    이긴다"고 주장 금지 — 어디까지나 **단순 모멘텀 프록시 대비** control일 뿐.
    """
    closes = stock.closes
    if len(closes) < 61:
        return math.nan
    ma60 = sum(closes[-60:]) / 60.0
    mom = (closes[-1] / ma60 - 1.0) if ma60 > 0 else 0.0
    weights = {"short": 0.40, "mid": 0.20, "long": 0.10}
    return mom * weights.get(bucket, 0.20)


def baseline_equal_rank_score(
    stocks: Sequence[F.StockRaw], bucket: str, *, min_adv_won: float = F.MIN_ADV_WON
) -> dict[str, float]:
    """naive baseline (§3D/§4): 유동 universe 내 (멀티호라이즌 trend + earnings) equal-rank.

    legacy_momentum_proxy_score(close/MA60 momentum-only)보다 강한 control — B++가 size-sleeve·foreign·
    quality·52주고가 없이도 trend+earnings만으로 얻는 recall/IC를 이기지 못하면 복잡도 미정당화(적대검토 MED).
    sector-relative 아님(naive). IC-weighted/equal-weight 전체 baseline 세트는 step-2 harvest에서 wire.
    """
    advs = [F.adv60(s.trdvals) for s in stocks]
    elig = [F.liquidity_floor_pass(a, min_adv_won) for a in advs]

    def em(values: list[float]) -> list[float]:
        return [values[i] if elig[i] else math.nan for i in range(len(stocks))]

    comps = [F._rank_of(em([F.risk_adjusted_trend(s.closes, lb) for s in stocks]))
             for lb in F.TREND_LOOKBACKS[bucket]]
    trend_rank = F._combine_ranks(comps)
    earn_rank = F.fill_missing_rank(F._rank_of(em([s.earnings_raw for s in stocks])))

    out: dict[str, float] = {}
    for i, s in enumerate(stocks):
        if not elig[i]:
            continue
        present = [v for v in (trend_rank[i], earn_rank[i]) if not _is_nan(v)]
        out[s.ticker] = sum(present) / len(present) if present else math.nan
    return out


# ============================================================================
# Baseline — IC-weighted (§3D, no-lookahead expanding prior IC; reported diagnostic)
# ============================================================================

def ic_weighted_rank_score(
    stocks: Sequence[F.StockRaw], bucket: str, prior_factor_ic: dict[str, float],
    *, min_adv_won: float = F.MIN_ADV_WON,
) -> dict[str, float]:
    """IC-weighted baseline (§3D): factor ranks weighted by PRIOR-months mean IC (no lookahead).

    prior_factor_ic = {factor: expanding-mean IC over months < t} (clipped ≥0). If empty/all-zero
    (first months) falls back to equal weights. Cross-section over the liquid universe (same floor
    as B++) so the comparison is on the same eligible set. Diagnostic baseline — not the binding gate
    bar (binding = current/equal, both clean). Returns {ticker: score} for eligible tickers.
    """
    scored = F.score_bpp_universe(stocks, bucket, min_adv_won=min_adv_won)
    factors = ("trend", "foreign", "earnings", "quality")
    w = {f: max(0.0, prior_factor_ic.get(f, math.nan)) for f in factors}
    w = {f: (0.0 if _is_nan(v) else v) for f, v in w.items()}
    total = sum(w.values())
    if total <= 0:
        w = {f: 1.0 for f in factors}
        total = float(len(factors))
    out: dict[str, float] = {}
    for sc in scored:
        if not sc.eligible:
            continue
        parts = [(w[f] / total) * sc.factor_ranks[f] for f in factors
                 if f in sc.factor_ranks and not _is_nan(sc.factor_ranks[f])]
        out[sc.ticker] = sum(parts) if parts else math.nan
    return out


# ============================================================================
# PIT harvest driver — month iteration over the disk-cached panel (§5 step 2)
# ============================================================================

HARVEST_BUCKETS = ("short", "mid", "long")
GATE_A_HORIZON = {"short": "short", "mid": "mid", "long": "long"}
_FACTORS = ("trend", "foreign", "earnings", "quality")


def iter_selection_months(start_month: date, end_month: date) -> list[date]:
    """[start, end] 월 1일 리스트 (step 1M, 포함)."""
    out: list[date] = []
    y, m = start_month.year, start_month.month
    while date(y, m, 1) <= end_month:
        out.append(date(y, m, 1))
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return out


def selection_index(dates: Sequence[str], t_month: date) -> int:
    """선정 = 전월말 완료 데이터로 1일 실행 → t_month(YYYY-MM-01) **직전** 마지막 패널 거래일 인덱스.

    production resolve_target_date(today)='직전 완료 영업일' 정합. 없으면 -1.
    """
    key = t_month.strftime("%Y%m%d")
    i = bisect.bisect_left(list(dates), key)  # dates < key 의 개수
    return i - 1


def build_series_by_ticker(panel: Panel, dates: Sequence[str]) -> dict[str, dict]:
    """panel → ticker별 시계열 {dates, closes, highs, trdvals, mktcap} (거래일 오름차순, 1회 precompute)."""
    series: dict[str, dict] = {}
    for d in dates:
        for tk, row in panel[d].items():
            e = series.setdefault(tk, {"dates": [], "closes": [], "highs": [], "trdvals": [], "mktcap": [], "list_shrs": []})
            e["dates"].append(d)
            e["closes"].append(row.close)
            e["highs"].append(row.high)
            e["trdvals"].append(row.trdval)
            e["mktcap"].append(row.mktcap)
            e["list_shrs"].append(row.list_shrs)  # (C) net-issuance series (additive; default 미사용).
    return series


def slice_series_at(series: dict[str, dict], sel_date_str: str) -> dict[str, dict]:
    """각 ticker의 sel_date_str **이하** 시계열 (closes/highs/trdvals 오름차순) + mktcap_at(선정일)."""
    out: dict[str, dict] = {}
    for tk, e in series.items():
        i = bisect.bisect_right(e["dates"], sel_date_str)  # dates <= sel 의 개수
        if i <= 0:
            continue
        out[tk] = {
            "closes": e["closes"][:i], "highs": e["highs"][:i], "trdvals": e["trdvals"][:i],
            "mktcap_at": e["mktcap"][i - 1],
            "list_shrs": e.get("list_shrs", [])[:i],  # (C) net-issuance slice (additive; default 미사용).
        }
    return out


def build_month_stockraws(
    sel_date: date, series: dict[str, dict], sel_date_str: str, universe_rows: Sequence[dict],
    *, foreign_at: Callable[[str, date], tuple[float, bool]],
    dart_at: Callable[[str, date], object],
) -> tuple[list[F.StockRaw], dict[str, str], dict[str, int]]:
    """선정일 sel_date의 PIT StockRaw 리스트 구성 (§3 입력). 결측 tiering = build_stock_raw_list 매핑 정합.

    sel_date = **실제 패널 거래일**(공휴일 인지) = 가격 슬라이스 날짜. foreign/DART provider에 이 날짜를
    그대로 넘겨 disclosure/foreign 윈도우를 가격 슬라이스와 정확히 일치시킨다(PIT-001 fix: 주말-only
    heuristic이 공휴일에 슬라이스 이후 날짜로 어긋나 미래 공시가 새는 것을 차단). universe_rows =
    {ticker,name,sector,market_cap_won}. market_cap은 universe(=선정일 bydd) mktcap.
    Returns (stocks, name_by_ticker, quality_meta{foreign_failed, earnings_missing, quality_insufficient}).
    """
    from dart_signals import compute_quality_composite_for_universe  # lightweight import

    sliced = slice_series_at(series, sel_date_str)
    pending: list[tuple] = []
    qmetrics: list[dict] = []
    meta = {"foreign_failed": 0, "earnings_missing": 0, "quality_insufficient": 0}
    for u in universe_rows:
        tk = u["ticker"]
        s = sliced.get(tk)
        if not s or not s["closes"]:
            continue
        fgn, fgn_failed = foreign_at(tk, sel_date)
        d = dart_at(tk, sel_date)
        mcap = u.get("market_cap_won") or s.get("mktcap_at") or math.nan
        pending.append((tk, u.get("name", tk), u.get("sector", "unresolved"), mcap, s, fgn, fgn_failed, d))
        qmetrics.append(getattr(d, "quality_raw_metrics", {}))
    qcomp = compute_quality_composite_for_universe(qmetrics) if qmetrics else []
    stocks: list[F.StockRaw] = []
    name_by: dict[str, str] = {}
    for (tk, name, sector, mcap, s, fgn, fgn_failed, d), qc in zip(pending, qcomp):
        basis = getattr(d, "signal_4_basis", "not_applicable")
        q_insuff = getattr(d, "quality_insufficient", True)
        earnings = math.nan if basis == "not_applicable" else getattr(d, "earnings_raw", math.nan)
        quality = math.nan if q_insuff else qc
        foreign = math.nan if fgn_failed else fgn
        if _is_nan(earnings):
            meta["earnings_missing"] += 1
        if q_insuff:
            meta["quality_insufficient"] += 1
        if fgn_failed:
            meta["foreign_failed"] += 1
        stocks.append(F.StockRaw(
            ticker=tk, sector=sector, market_cap=mcap,
            closes=s["closes"], trdvals=s["trdvals"], highs=s["highs"],
            foreign_net_60d=foreign, foreign_fetch_failed=fgn_failed,
            earnings_raw=earnings, quality_composite_raw=quality,
            list_shrs=s.get("list_shrs") or None,  # (C) net-issuance (additive; default OFF 경로 미사용).
        ))
        name_by[tk] = name
    return stocks, name_by, meta


def select_bpp_for_harvest(stocks: Sequence[F.StockRaw]) -> dict[str, tuple[list, list]]:
    """bucket별 (full scored universe, selected ranked) — cross-bucket disjoint L20/M20/S10 (§3A).

    screen.select_bpp_candidates와 동일 규칙(중복 제거 + size sleeve). 여기서 재구현해 screen import
    의존을 끊고(테스트 격리) full scored도 함께 반환(Gate B IC 산정용).
    """
    used: set[str] = set()
    result: dict[str, tuple[list, list]] = {}
    for b in HARVEST_BUCKETS:
        scored = F.score_bpp_universe(stocks, b)
        by_t = {sc.ticker: sc for sc in scored}
        picked = F.select_size_sleeves(
            [sc.ticker for sc in scored], [sc.score for sc in scored],
            [sc.sleeve for sc in scored], quota=dict(F.SLEEVE_QUOTA), exclude=used,
        )
        ranked = sorted((by_t[t] for t in picked), key=lambda sc: (-sc.score, sc.ticker))
        result[b] = (scored, ranked)
        for sc in ranked:
            used.add(sc.ticker)
    return result


def canonical_size_tiers(stocks: Sequence[F.StockRaw]) -> dict[str, str]:
    """유동성 플로어 통과 종목 시총으로 size breakpoint → 전 종목 tier (bucket-독립, winner 분류용)."""
    advs = {s.ticker: F.adv60(s.trdvals) for s in stocks}
    liquid_caps = [s.market_cap for s in stocks if F.liquidity_floor_pass(advs[s.ticker]) and not _is_nan(s.market_cap)]
    lc, mc = F.size_breakpoints(liquid_caps)
    return {
        s.ticker: (F.size_tier(s.market_cap, lc, mc) if F.liquidity_floor_pass(advs[s.ticker]) else "small")
        for s in stocks
    }


def compute_month_forward(
    panel: Panel, dates: Sequence[str], tickers: Sequence[str], sel_idx: int
) -> tuple[dict[str, dict[str, float]], dict[str, dict[str, int]]]:
    """선정일 sel_idx 기준 horizon별 forward return + status count (전 universe)."""
    fwd: dict[str, dict[str, float]] = {h: {} for h in HARVEST_BUCKETS}
    status: dict[str, dict[str, int]] = {
        h: {"ok": 0, "gap": 0, "delisted": 0, "insufficient": 0, "absent": 0} for h in HARVEST_BUCKETS
    }
    for h in HARVEST_BUCKETS:
        hd = HORIZON_DAYS[h]
        for tk in tickers:
            ret, st = compute_forward_return(panel, dates, tk, sel_idx, hd)
            status[h][st] = status[h].get(st, 0) + 1
            if not _is_nan(ret):
                fwd[h][tk] = ret
    return fwd, status


def _baseline_select(score_by_ticker_fn, stocks: Sequence[F.StockRaw], pool: int = 50) -> set[str]:
    """bucket별 score 상위 pool개 cross-bucket disjoint 선정 → ticker set (baseline 비교용)."""
    used: set[str] = set()
    selected: set[str] = set()
    for b in HARVEST_BUCKETS:
        scores = score_by_ticker_fn(stocks, b)
        ranked = sorted(((tk, sc) for tk, sc in scores.items() if not _is_nan(sc)),
                        key=lambda x: (-x[1], x[0]))
        cnt = 0
        for tk, _sc in ranked:
            if tk in used:
                continue
            selected.add(tk)
            used.add(tk)
            cnt += 1
            if cnt >= pool:
                break
    return selected


def _composite_ic(per_bucket_ic: dict[str, float]) -> float:
    present = [v for v in per_bucket_ic.values() if not _is_nan(v)]
    return sum(present) / len(present) if present else math.nan


@dataclass
class MonthResult:
    month: str
    selection_date: str
    n_universe: int
    n_eligible: int
    n_selected: int
    selected_all: set
    selected_by_horizon: dict
    largemid_selected: set
    winners_by_horizon: dict
    winners_all: set
    largemid_winners: set
    baseline_current_selected: set
    baseline_equal_selected: set
    leader_in_selected: list
    composite_ic: float
    sleeve_ic: dict
    spread: float
    top_tercile_ic: float
    baseline_equal_ic: float
    baseline_ic_weighted_ic: float
    factor_ics: dict
    status_counts: dict
    quality_meta: dict
    selected_sleeve: dict
    selected_score: dict
    selected_mcap: dict
    forward_insufficient_horizons: list
    selected_adv: dict = field(default_factory=dict)  # TASK A Gate C largemid liquidity floor 보고용
    selection_perf: dict = field(default_factory=dict)  # horizon별 픽 실현수익률 (selection_performance)
    generator_diagnostics: dict = field(default_factory=dict)


# EXPLORATORY 생성기(cfg5/cfg6/cfg7) 한 월의 후보 생성이 sleeve 쿼터를 못 채워 SleeveShortfallError를
# 낼 때, frozen 측정 경로는 건드리지 않고 **그 월만** 기록된 skip으로 넘긴다(한 나쁜 월이 regime
# 전체를 abort하지 않게). 절대 무음 금지 — generator_shortfall_months에 월·사유를 기록해 출력한다.
# bpp(cfg1-4) 경로는 이 sentinel을 절대 쓰지 않는다 → SleeveShortfallError가 그대로 surface(byte-identical).
class _GeneratorShortfall:
    __slots__ = ("month", "reason")

    def __init__(self, month: str, reason: str):
        self.month = month
        self.reason = reason


CFG7_FWD_HORIZONS = {"1d": 1, "5d": 5, "20d": 20}


def _cfg7_diagnostics(
    panel: Panel, dates: Sequence[str], sel_idx: int, stocks: Sequence[F.StockRaw],
    sel: dict[str, tuple[list, list]], fwd: dict[str, dict[str, float]],
    winners_by_h: dict[str, set[str]], winners_all: set[str], selected_all: set[str],
) -> dict:
    """cfg7 per-month secondary metrics (TASK B). Returns raw per-month payload pooled in aggregate.

    (1) lead-time-to-winner-move (per horizon) — for each pick that is an eventual winner of that horizon,
        first_day_reaching_threshold against the PRE-REGISTERED top-decile winner threshold; censored picks
        reported separately (NaN, never imputed). (2) fwd 1d/5d/20d return of picks (mean/hit-rate).
        (3) recall vs random + high-volume baseline (recall-LIFT separates surge from liquidity).
    churn is cross-month (computed in harvest loop).
    """
    import tier0_cfg56 as C56
    # (1) lead-time per horizon. threshold_h = top-decile-positive bar of that horizon's forward dist.
    lead_times: dict[str, list[float]] = {}
    lead_censored: dict[str, int] = {}
    for h in HARVEST_BUCKETS:
        present = sorted(v for v in fwd[h].values() if not _is_nan(v))
        threshold = F.quantile(present, TOP_DECILE_Q) if len(present) >= 10 else math.nan
        sel_h = {sc.ticker for sc in sel[h][1]}
        picks_that_win = sel_h & winners_by_h.get(h, set())
        lts: list[float] = []
        censored = 0
        for tk in picks_that_win:
            lt = first_day_reaching_threshold(panel, dates, tk, sel_idx, threshold, HORIZON_DAYS[h])
            if lt is None:
                censored += 1
            else:
                lts.append(float(lt))
        lead_times[h] = lts
        lead_censored[h] = censored

    # (2) fwd 1d/5d/20d return of picks (selected_all).
    fwd_returns: dict[str, list[float]] = {}
    for label, hd in CFG7_FWD_HORIZONS.items():
        rets = []
        for tk in selected_all:
            r, st = compute_forward_return(panel, dates, tk, sel_idx, hd)
            if not _is_nan(r):
                rets.append(r)
        fwd_returns[label] = rets

    # (3) recall vs random + high-volume baseline (per-month numerator/denominator for pooled recall).
    high_volume_status = "OK"
    high_volume_reason = ""
    try:
        hv_sel = C56.cfg7_high_volume_baseline(stocks)
        hv_selected = set().union(*[{sc.ticker for sc in hv_sel[b][1]} for b in HARVEST_BUCKETS])
        high_volume_num: Optional[int] = len(hv_selected & winners_all)
        high_volume_count = len(hv_selected)
    except F.SleeveShortfallError as exc:
        high_volume_status = "SHORTFALL"
        high_volume_reason = str(exc)
        high_volume_num = None
        high_volume_count = 0
    n_uni = len(stocks)
    return {
        "lead_time_by_horizon": lead_times,
        "lead_time_censored_by_horizon": lead_censored,
        "fwd_returns": fwd_returns,
        "recall_num": len(selected_all & winners_all),
        "recall_den": len(winners_all),
        "random_num": len(selected_all),
        "random_den": n_uni,
        "high_volume_num": high_volume_num,
        "high_volume_selected_count": high_volume_count,
        "high_volume_baseline_status": high_volume_status,
        "high_volume_baseline_shortfall_reason": high_volume_reason,
    }


def process_month(
    t: date, panel: Panel, dates: Sequence[str], series: dict[str, dict],
    universe_rows: Sequence[dict], *, foreign_at, dart_at, prior_factor_ic: dict[str, float],
    leader_basket: dict[str, str],
    generator: Optional[Callable[[Sequence[F.StockRaw]], dict[str, tuple[list, list]]]] = None,
    generator_label: str = "bpp",
    universe: str = "all",
    select_count: Optional[int] = None,
    winner_universe: str = "all",
) -> Optional[MonthResult]:
    """한 선정월의 선정 + forward + Gate A/B 월별 메트릭. 패널/universe 부족 시 None.

    generator = 후보 생성기(default select_bpp_for_harvest로 cfg1-4 경로 byte-identical). cfg5/cfg6/cfg7
    EXPLORATORY 생성기를 주입해도 frozen 측정(winners/forward/gate/aggregate)은 변경 없이 측정한다 —
    반환 shape {bucket: (scored_universe, selected_ranked)}만 동일하면 된다.

    universe = "all"(기본, byte-identical) | "largemid" (TASK A FROZEN PROTOCOL). largemid면 candidate
    universe AND forward-ticker list를 **선정일 PIT** large/mid로 제한한다(canonical_size_tiers — whole-
    market breakpoints, NEVER future/period-end size). winners는 largemid 후보의 forward에서만 산출되므로
    구조적으로 largemid다. cfg1-4 default 경로(universe='all')는 한 줄도 변하지 않는다.
    """
    sel_idx = selection_index(dates, t)
    if sel_idx < 0:
        return None
    sel_date = dates[sel_idx]
    sel_date_obj = datetime.strptime(sel_date, "%Y%m%d").date()  # 실제 패널 거래일 (공휴일 인지)
    stocks, name_by, qmeta = build_month_stockraws(
        sel_date_obj, series, sel_date, universe_rows, foreign_at=foreign_at, dart_at=dart_at)
    if not stocks:
        return None
    # TASK A: restrict candidate universe to PIT large+mid AT THE SELECTION DATE. tier_of uses whole-
    # market size_breakpoints (large=top20% of the WHOLE market) computed once on the full `stocks`,
    # THEN we filter — preserving the all-universe breakpoints (freeze doc §3, risk #2). NEVER recompute
    # breakpoints on the restricted set. universe='all' skips this entirely (byte-identical).
    full_tier_of = canonical_size_tiers(stocks)
    if universe == "largemid":
        stocks = [s for s in stocks if full_tier_of.get(s.ticker) in ("large", "mid")]
        if not stocks:
            return None
    tickers = [s.ticker for s in stocks]
    n_eligible = sum(1 for s in stocks if F.liquidity_floor_pass(F.adv60(s.trdvals)))

    fwd, status = compute_month_forward(panel, dates, tickers, sel_idx)
    # TRADABLE WINNER DENOMINATOR (재검증 (a), 2026-06-18): restrict the Gate A winner set to the funnel's
    # OWN eligibility universe (F.liquidity_floor_pass, ADV≥₩2B) so numerator (already ADV-floored) and
    # denominator live in the SAME liquid universe = apples-to-apples. Both the top-decile THRESHOLD and
    # membership are restricted (top_decile_winners receives pre-filtered fwd). fwd itself (Gate B IC scope,
    # sel[b][0]) is UNTOUCHED. winner_universe='all' (default) → fwd_for_winners is fwd → byte-identical.
    # SoT: docs/superpowers/2026-06-18-tier0-tradable-winner-denominator.md (pre-registered before run).
    if winner_universe == "tradable":
        tradable_set = {s.ticker for s in stocks if F.liquidity_floor_pass(F.adv60(s.trdvals))}
        fwd_for_winners = {h: {tk: r for tk, r in fwd[h].items() if tk in tradable_set} for h in HARVEST_BUCKETS}
    else:
        fwd_for_winners = fwd
    winners_by_h = {h: top_decile_winners(fwd_for_winners[h]) for h in HARVEST_BUCKETS}
    winners_all: set[str] = set().union(*winners_by_h.values()) if winners_by_h else set()
    insufficient = [h for h in HARVEST_BUCKETS if not fwd[h]]  # horizon별 forward 전무 = 데이터 부족

    gen = generator or select_bpp_for_harvest
    if generator_label in ("cfg5", "cfg6", "cfg7"):
        # 방어적 per-month skip(EXPLORATORY 한정): 후보 생성이 sleeve 쿼터를 못 채우면 그 월만
        # 기록된 skip으로 surface. frozen bpp 경로(generator_label=="bpp")는 여기 진입 불가 →
        # SleeveShortfallError 그대로 전파(byte-identical 보존).
        try:
            sel = gen(stocks)
        except F.SleeveShortfallError as exc:
            return _GeneratorShortfall(t.isoformat(), str(exc))
    else:
        sel = gen(stocks)
    generator_diagnostics = {}
    if generator_label in ("cfg5", "cfg6"):
        repo_root = Path(__file__).resolve().parents[1]
        if str(repo_root) not in sys.path:
            sys.path.insert(0, str(repo_root))
        from scripts import tier0_cfg56 as C56
        bpp_sel = select_bpp_for_harvest(stocks)
        pre_cap_union = C56.cfg6_union_for_diagnostics(stocks) if generator_label == "cfg6" else None
        diag = C56.compute_diagnostics(
            stocks, sel, bpp_sel, leader_basket, pre_cap_union=pre_cap_union)
        generator_diagnostics = {
            "selected_count": diag.selected_count,
            "pre_cap_union_count": diag.pre_cap_union_count,
            "leader_hits": diag.leader_hits,
            "unique_leader_hits_vs_bpp": diag.unique_leader_hits_vs_bpp,
            "leaders_dropped_post_cap": diag.leaders_dropped_post_cap,
            "unique_vs_bpp": diag.unique_vs_bpp,
            "jaccard_vs_bpp": diag.jaccard_vs_bpp,
            "size_dist": diag.size_dist,
            "sector_dist": diag.sector_dist,
            "random_baseline_ratio": diag.random_baseline_ratio,
        }
    # TASK 가 (SELECTIVE LARGEMID, 2026-06-18): post-generation truncation of the already-ranked picks to
    # the pooled top-N by cfg1 score over the cross-bucket-disjoint union of {short,mid,long}. This NEVER
    # touches the generator's SLEEVE_QUOTA (tier0_factors.py untouched) nor the scored_universe sel[b][0]
    # (Gate B IC scope stays over the FULL scored largemid universe — risk #1). It only restricts which
    # picks count toward Gate A recall / selected_all. Horizon split is EMERGENT (whichever N highest-score
    # disjoint picks survive). FROZEN rule: pooled top-N by score, ratio large:mid emergent from quotas.
    # SoT: docs/superpowers/2026-06-18-tier0-selective-largemid.md (pre-registered before run). Guarded to
    # the largemid+bpp path only (validated in harvest_pit_months/main) → cfg1-4/all-universe byte-identical.
    kept_by_h: Optional[dict[str, set[str]]] = None
    if select_count is not None:
        pooled: list[tuple[float, str, str]] = []  # (score, ticker, horizon)
        for b in HARVEST_BUCKETS:
            for sc in sel[b][1]:  # selected_ranked, already score-desc (select_size_sleeves)
                pooled.append((sc.score, sc.ticker, b))
        pooled.sort(key=lambda x: (-x[0], x[1]))  # deterministic: score desc, ticker asc
        kept = {(tk, h) for _s, tk, h in pooled[:select_count]}
        kept_by_h = {b: {tk for tk, h in kept if h == b} for b in HARVEST_BUCKETS}

    if kept_by_h is not None:
        selected_by_h = kept_by_h
    else:
        selected_by_h = {b: {sc.ticker for sc in sel[b][1]} for b in HARVEST_BUCKETS}
    selected_all: set[str] = set().union(*selected_by_h.values())
    # winner/selected size classification uses WHOLE-MARKET breakpoints (full_tier_of, computed before
    # any largemid restriction) so 'large = top 20% of the whole market' is preserved (freeze doc §3,
    # risk #2). On universe='all' this == canonical_size_tiers(stocks). On universe='largemid' the
    # restricted `stocks` are all large/mid by full_tier_of → largemid_* == overall by construction.
    tier_of = full_tier_of
    largemid_winners = {tk for tk in winners_all if tier_of.get(tk) in ("large", "mid")}
    largemid_selected = {tk for tk in selected_all if tier_of.get(tk) in ("large", "mid")}

    # selected_adv는 Gate C largemid liquidity floor 보고용(universe='all' 경로는 사용 안 함, 비파괴).
    selected_sleeve, selected_score, selected_mcap, selected_adv = {}, {}, {}, {}
    for b in HARVEST_BUCKETS:
        for sc in sel[b][1]:
            if select_count is not None and sc.ticker not in selected_all:
                continue  # TASK 가: Gate C size composition measured over the kept top-N only.
            selected_sleeve[sc.ticker] = tier_of.get(sc.ticker, sc.sleeve) if universe == "largemid" else sc.sleeve
            selected_score[sc.ticker] = sc.score
            selected_mcap[sc.ticker] = sc.market_cap
            selected_adv[sc.ticker] = sc.adv60

    # TASK B cfg7 mandatory secondary metrics (per-cell, EXPLORATORY diagnostics channel — never alters
    # frozen gate metrics). Computed here where fwd/winners/selected are all available. churn (cross-month)
    # is computed in harvest_pit_months. recall-LIFT vs high-volume baseline uses cfg7_high_volume_baseline.
    if generator_label == "cfg7":
        generator_diagnostics = _cfg7_diagnostics(
            panel, dates, sel_idx, stocks, sel, fwd, winners_by_h, winners_all, selected_all)

    # Gate B — per bucket scoped IC (liquid eligible), sleeve IC, spread, top-tercile, factor ICs.
    ic_by_b, sleeve_ic_acc, spread_by_b, top_by_b = {}, {"large": [], "mid": []}, {}, {}
    factor_ic_acc = {f: [] for f in _FACTORS}
    eq_ic_by_b, icw_ic_by_b = {}, {}
    for b in HARVEST_BUCKETS:
        scored, _ranked = sel[b]
        elig = [sc for sc in scored if sc.eligible]
        sc_map = {sc.ticker: sc.score for sc in elig}
        fwd_b = fwd[b]
        common = [tk for tk in sc_map if tk in fwd_b]
        ic_by_b[b] = F.spearman_ic([sc_map[tk] for tk in common], [fwd_b[tk] for tk in common])
        spread_by_b[b] = decile_spread(sc_map, fwd_b)
        # top tercile by score
        if len(common) >= 9:
            thr = F.quantile(sorted(sc_map[tk] for tk in common), 2.0 / 3.0)
            tt = [tk for tk in common if sc_map[tk] >= thr]
            top_by_b[b] = F.spearman_ic([sc_map[tk] for tk in tt], [fwd_b[tk] for tk in tt]) if len(tt) >= 3 else math.nan
        for sleeve in ("large", "mid"):
            st = [tk for tk in common if tier_of.get(tk) == sleeve]
            if len(st) >= 5:
                sleeve_ic_acc[sleeve].append(
                    F.spearman_ic([sc_map[tk] for tk in st], [fwd_b[tk] for tk in st]))
        for f in _FACTORS:
            fr = {sc.ticker: sc.factor_ranks.get(f, math.nan) for sc in elig}
            cf = [tk for tk in fr if tk in fwd_b and not _is_nan(fr[tk])]
            if len(cf) >= 5:
                factor_ic_acc[f].append(F.spearman_ic([fr[tk] for tk in cf], [fwd_b[tk] for tk in cf]))
        # equal-rank baseline IC
        eq = baseline_equal_rank_score(stocks, b)
        ce = [tk for tk in eq if tk in fwd_b and not _is_nan(eq[tk])]
        eq_ic_by_b[b] = F.spearman_ic([eq[tk] for tk in ce], [fwd_b[tk] for tk in ce]) if len(ce) >= 3 else math.nan
        # ic-weighted baseline IC (no-lookahead prior weights)
        icw = ic_weighted_rank_score(stocks, b, prior_factor_ic)
        ci = [tk for tk in icw if tk in fwd_b and not _is_nan(icw[tk])]
        icw_ic_by_b[b] = F.spearman_ic([icw[tk] for tk in ci], [fwd_b[tk] for tk in ci]) if len(ci) >= 3 else math.nan

    sleeve_ic = {s: (sum(v) / len(v) if v else math.nan) for s, v in sleeve_ic_acc.items()}
    factor_ics = {f: (sum(v) / len(v) if v else math.nan) for f, v in factor_ic_acc.items()}

    # baseline selections (Gate A recall comparison)
    baseline_pool_by_h = (
        {h: len(selected_by_h.get(h, set())) for h in HARVEST_BUCKETS}
        if select_count is not None else None
    )
    legacy_by_h = _select_by_horizon(
        lambda ss, b: {s.ticker: legacy_momentum_proxy_score(s, b) for s in ss}, stocks,
        pools=baseline_pool_by_h)
    baseline_current = set().union(*[set(v) for v in legacy_by_h.values()]) if legacy_by_h else set()
    if baseline_pool_by_h is not None:
        baseline_equal_by_h = _select_by_horizon(baseline_equal_rank_score, stocks, pools=baseline_pool_by_h)
        baseline_equal = set().union(*[set(v) for v in baseline_equal_by_h.values()]) if baseline_equal_by_h else set()
    else:
        baseline_equal = _baseline_select(baseline_equal_rank_score, stocks)

    # selection_performance: horizon별 픽의 **실현 수익률** (B++ vs legacy momentum proxy vs 벤치마크).
    # recall/IC와 별개의 직관 지표. omxy R6/R7 정합:
    #  - 벤치마크·sleeve 모두 **B++ scored eligible universe(sel[h][0])** 기준으로 통일(R7 HIGH: canonical
    #    full-liquid tier가 아니라 **실제 선정 sleeve**(ScoredStock.sleeve)로 size 틸트 격리).
    #  - bpp_excess_vs_own_sleeve = 픽 − 같은 **선정 sleeve** 평균 → size 베타 제거 "선택 스킬".
    #  - bpp_sleeve_excess_basket = 월별 own-sleeve excess 평균 → 그 자체의 월별 CI로 스킬 유의성 판정(R7).
    #  - bpp_basket = 월별 픽 바스켓 평균(독립 관측 ≈ 월 수). net = gross − round-trip cost.
    perf: dict[str, dict] = {}
    for h in HARVEST_BUCKETS:
        fwd_h = fwd[h]
        scored_h, ranked_h = sel[h]
        ranked_for_perf = (
            [sc for sc in ranked_h if sc.ticker in selected_by_h.get(h, set())]
            if select_count is not None else ranked_h
        )
        # 벤치마크 + sleeve 평균 = B++ scored eligible universe (선정 sleeve 기준, 일관)
        elig_ret = [fwd_h[sc.ticker] for sc in scored_h if sc.eligible and sc.ticker in fwd_h]
        eqw_mean = (sum(elig_ret) / len(elig_ret)) if elig_ret else math.nan
        sleeve_ret: dict[str, list[float]] = {"large": [], "mid": [], "small": []}
        for sc in scored_h:
            if sc.eligible and sc.ticker in fwd_h:
                sleeve_ret.setdefault(sc.sleeve, []).append(fwd_h[sc.ticker])
        sleeve_mean = {s: (sum(v) / len(v) if v else math.nan) for s, v in sleeve_ret.items()}
        bpp_ret, bpp_sleeve_exc = [], []
        for sc in ranked_for_perf:  # 실제 선정 픽(ScoredStock) — 각 픽의 실제 선정 sleeve로 벤치마크
            if sc.ticker not in fwd_h:
                continue
            r = fwd_h[sc.ticker]
            bpp_ret.append(r)
            sm = sleeve_mean.get(sc.sleeve, math.nan)
            if not _is_nan(sm):
                bpp_sleeve_exc.append(r - sm)
        leg_ret = [fwd_h[tk] for tk in legacy_by_h[h] if tk in fwd_h]
        perf[h] = {
            "bpp": bpp_ret, "legacy": leg_ret, "eqw_mean": eqw_mean,
            "bpp_sleeve_excess": bpp_sleeve_exc,
            "bpp_basket": (sum(bpp_ret) / len(bpp_ret)) if bpp_ret else math.nan,
            "bpp_sleeve_excess_basket": (sum(bpp_sleeve_exc) / len(bpp_sleeve_exc)) if bpp_sleeve_exc else math.nan,
        }

    return MonthResult(
        month=t.isoformat(), selection_date=sel_date, n_universe=len(stocks), n_eligible=n_eligible,
        n_selected=len(selected_all), selected_all=selected_all, selected_by_horizon=selected_by_h,
        largemid_selected=largemid_selected, winners_by_horizon=winners_by_h, winners_all=winners_all,
        largemid_winners=largemid_winners, baseline_current_selected=baseline_current,
        baseline_equal_selected=baseline_equal,
        leader_in_selected=sorted(set(leader_basket) & selected_all),
        composite_ic=_composite_ic(ic_by_b), sleeve_ic=sleeve_ic,
        spread=_composite_ic(spread_by_b), top_tercile_ic=_composite_ic(top_by_b),
        baseline_equal_ic=_composite_ic(eq_ic_by_b), baseline_ic_weighted_ic=_composite_ic(icw_ic_by_b),
        factor_ics=factor_ics, status_counts=status, quality_meta=qmeta,
        selected_sleeve=selected_sleeve, selected_score=selected_score, selected_mcap=selected_mcap,
        forward_insufficient_horizons=insufficient, selection_perf=perf,
        generator_diagnostics=generator_diagnostics, selected_adv=selected_adv,
    )


def _pooled_recall(num: int, den: int) -> float:
    return (num / den) if den > 0 else math.nan


def _json_number(x: float, digits: Optional[int] = None):
    if _is_nan(x) or not math.isfinite(x):
        return None
    return round(x, digits) if digits is not None else x


def _ci90(values: Sequence[float]) -> list[float]:
    present = sorted(v for v in values if not _is_nan(v))
    if len(present) < 2:
        return [math.nan, math.nan]
    return [round(F.quantile(present, 0.05), 4), round(F.quantile(present, 0.95), 4)]


def _mean(xs: Sequence[float]) -> float:
    present = [v for v in xs if not _is_nan(v)]
    return sum(present) / len(present) if present else math.nan


def _hit_rate(xs: Sequence[float]) -> float:
    present = [v for v in xs if not _is_nan(v)]
    return (sum(1 for v in present if v > 0) / len(present)) if present else math.nan


def foreign_dict_from_df(df) -> Optional[dict]:
    """pykrx 순매수 DataFrame → {ticker: 순매수거래대금} 또는 **None**(스키마 부재 = 삼킨 실패).

    omxy S1-R2 HIGH: pykrx의 @dataframe_empty_handler가 내부 오류(network/parse)를 **bare DataFrame()**
    으로 삼킨다(예외 없이 빈 df). 따라서 df.empty로 "genuine no-flow"를 판별하면 삼킨 provider 실패를
    0-flow로 오분류한다. **기대 컬럼(순매수거래대금) 존재 = 스키마 유효**로 판별:
    - 컬럼 존재 → dict (0행이면 {} = 휴장/무거래 genuine no-flow).
    - df None / 컬럼 부재(bare empty) → None = 삼킨 실패 → 호출부에서 penalty tier.
    """
    if df is None or "순매수거래대금" not in getattr(df, "columns", []):
        return None
    return {str(idx): float(v) for idx, v in df["순매수거래대금"].astype(float).items()}


def classify_foreign(market_dict: Optional[dict], ticker: str) -> tuple[float, bool]:
    """Stage-1 외국인 분류 (omxy S1-R1 #2 정합).

    market_dict = 해당 (market, 선정일) 전종목 외국인 순매수대금 {ticker: won}, 또는 **None**(fetch 실패).
    - None → (nan, True): 진짜 fetch 실패 → penalty tier.
    - present, ticker 있음 → (값, False): 실제 외국인 순매수.
    - present, ticker 없음 → (0.0, False): **genuine no-flow**(거래 없음) → neutral. 실패로 오분류 금지.
    """
    if market_dict is None:
        return (math.nan, True)
    return (float(market_dict.get(ticker, 0.0)), False)


def _select_by_horizon(
    score_fn,
    stocks: Sequence[F.StockRaw],
    pool: int = 50,
    pools: Optional[dict[str, int]] = None,
) -> dict[str, list[str]]:
    """bucket별 score 상위 pool개, cross-bucket disjoint → {bucket: [ticker]} (select_bpp 정합).

    선정-종목 수익률 비교(selection_performance)에서 B++ 픽과 동일 규칙으로 baseline 픽을 뽑기 위함.
    """
    used: set[str] = set()
    out: dict[str, list[str]] = {}
    for b in HARVEST_BUCKETS:
        target = pools.get(b, pool) if pools is not None else pool
        if target <= 0:
            out[b] = []
            continue
        scores = score_fn(stocks, b)
        ranked = sorted(((tk, sc) for tk, sc in scores.items() if not _is_nan(sc)), key=lambda x: (-x[1], x[0]))
        picks: list[str] = []
        for tk, _sc in ranked:
            if tk in used:
                continue
            picks.append(tk)
            used.add(tk)
            if len(picks) >= target:
                break
        out[b] = picks
    return out


def _median(xs: Sequence[float]) -> float:
    present = sorted(v for v in xs if not _is_nan(v))
    return F.median(present) if present else math.nan


def _cfg7_aggregate(res: Sequence["MonthResult"]) -> dict:
    """Pool cfg7 per-month secondary metrics → report block (TASK B). Honest: censored lead-times are
    counted, never imputed; recall-LIFT vs high-volume baseline emitted so surge≠liquidity is testable."""
    diags = [r.generator_diagnostics for r in res if r.generator_diagnostics]
    # (1) lead-time per horizon (pooled, censored counted separately).
    lead: dict[str, dict] = {}
    for h in HARVEST_BUCKETS:
        all_lt: list[float] = []
        censored = 0
        for d in diags:
            all_lt.extend(d.get("lead_time_by_horizon", {}).get(h, []))
            censored += d.get("lead_time_censored_by_horizon", {}).get(h, 0)
        lead[h] = {
            "mean_lead_time_days": _json_number(_mean(all_lt), 3),
            "median_lead_time_days": _json_number(_median(all_lt), 3),
            "n_winner_picks_reached": len(all_lt),
            "n_winner_picks_censored": censored,
        }
    # (2) fwd 1d/5d/20d return of picks (mean + hit-rate).
    fwd_block: dict[str, dict] = {}
    for label in CFG7_FWD_HORIZONS:
        rets: list[float] = []
        for d in diags:
            rets.extend(d.get("fwd_returns", {}).get(label, []))
        fwd_block[label] = {
            "mean_return": _json_number(_mean(rets), 4),
            "hit_rate": _json_number(_hit_rate(rets), 4),
            "n": len(rets),
        }
    # (3) churn / duplicate rate across months (fraction of selected repeating month-over-month).
    sels = [r.selected_all for r in res]
    repeats, denom = 0, 0
    for i in range(1, len(sels)):
        prev, cur = sels[i - 1], sels[i]
        if cur:
            repeats += len(cur & prev)
            denom += len(cur)
    churn_repeat_rate = (repeats / denom) if denom else math.nan
    # (4) recall-LIFT vs random AND high-volume baseline (pooled).
    cfg7_num = sum(d.get("recall_num", 0) for d in diags)
    cfg7_den = sum(d.get("recall_den", 0) for d in diags)
    rand_num = sum(d.get("random_num", 0) for d in diags)
    rand_den = sum(d.get("random_den", 0) for d in diags)
    hv_shortfalls = [d for d in diags if d.get("high_volume_baseline_status") == "SHORTFALL"]
    hv_ok = not hv_shortfalls
    hv_num = sum(d.get("high_volume_num", 0) for d in diags) if hv_ok else 0
    hv_selected_total = sum(d.get("high_volume_selected_count", 0) for d in diags)
    cfg7_recall = _pooled_recall(cfg7_num, cfg7_den)
    random_recall = _pooled_recall(rand_num, rand_den)
    high_volume_recall = _pooled_recall(hv_num, cfg7_den) if hv_ok else math.nan
    return {
        "lead_time_to_winner_move": lead,
        "lead_time_winner_move_definition": (
            "first forward day cumulative return >= horizon top-decile-positive winner threshold "
            "(F.quantile(fwd,0.90) AND >0, identical to top_decile_winners); PRE-REGISTERED, non-tunable; "
            "censored = never crossed within horizon (NaN, not imputed)."
        ),
        "fwd_return_of_picks": fwd_block,
        "churn_repeat_rate_month_over_month": _json_number(churn_repeat_rate, 4),
        "recall": _json_number(cfg7_recall, 4),
        "recall_hit_count": cfg7_num,
        "recall_winner_denominator": cfg7_den,
        "baseline_random_recall": _json_number(random_recall, 4),
        "baseline_high_volume_recall": _json_number(high_volume_recall, 4),
        "baseline_high_volume_hit_count": hv_num if hv_ok else None,
        "baseline_high_volume_selected_total": hv_selected_total,
        "high_volume_baseline_status": "OK" if hv_ok else "SHORTFALL",
        "high_volume_baseline_shortfall_count": len(hv_shortfalls),
        "high_volume_baseline_shortfall_reasons": [d.get("high_volume_baseline_shortfall_reason", "") for d in hv_shortfalls],
        "recall_lift_vs_random": _json_number(cfg7_recall - random_recall, 4) if not (_is_nan(cfg7_recall) or _is_nan(random_recall)) else None,
        "recall_lift_vs_high_volume": _json_number(cfg7_recall - high_volume_recall, 4) if not (_is_nan(cfg7_recall) or _is_nan(high_volume_recall)) else None,
        "lift_interpretation": (
            "cfg7 must beat BOTH random AND high-volume baselines. recall_lift_vs_high_volume <= 0 means "
            "the surge signal is indistinguishable from mere liquidity (honest FAIL, not tune-to-pass)."
        ),
    }


def aggregate_harvest(
    results: Sequence[MonthResult], *, smoke: bool, generated_at: str,
    coverage_meta: dict, survivorship_label: str, leader_basket_size: int = len(LEADER_BASKET_2026_06),
    generator_label: str = "bpp",
    generator_shortfall_months: Optional[Sequence[dict]] = None,
    universe: str = "all",
    select_count: Optional[int] = None,
    winner_universe: str = "all",
) -> dict:
    """월별 MonthResult → 삼중 게이트 verdict + per-month + CI + 데이터품질 리포트 (§4·§9).

    generator_label != "bpp" (cfg5/cfg6/cfg7 EXPLORATORY) 이면 게이트 threshold 로직은 **변경 없이** 그대로
    돌리되, 어떤 PASS도 decision-grade PASS와 혼동되지 않도록 (a) 최상위 exploratory=True 필드,
    (b) 각 게이트 exploratory_verdict("EXPLORATORY PASS"/"EXPLORATORY FAIL") 라벨을 **추가**한다.
    canonical verdict 필드("PASS"/"FAIL")는 그대로 둔다 — adjudicator의 triple↔게이트 cross-check 정합."""
    res = [r for r in results if r is not None]
    n = len(res)

    # ---- Gate A (pooled recall, denominator = 전체 top-decile positive winners) ----
    num_all = sum(len(r.selected_all & r.winners_all) for r in res)
    den_all = sum(len(r.winners_all) for r in res)
    overall = _pooled_recall(num_all, den_all)
    sel_total = sum(len(r.selected_all) for r in res)
    uni_total = sum(r.n_universe for r in res)
    random_baseline = (sel_total / uni_total) if uni_total else math.nan
    random_ratio = (overall / random_baseline) if (random_baseline and not _is_nan(overall) and random_baseline > 0) else math.nan
    per_h = {}
    for h in HARVEST_BUCKETS:
        nh = sum(len(r.selected_by_horizon.get(h, set()) & r.winners_by_horizon.get(h, set())) for r in res)
        dh = sum(len(r.winners_by_horizon.get(h, set())) for r in res)
        per_h[h] = _pooled_recall(nh, dh)
    lm_num = sum(len(r.largemid_selected & r.largemid_winners) for r in res)
    lm_den = sum(len(r.largemid_winners) for r in res)
    largemid_recall = _pooled_recall(lm_num, lm_den)
    largemid_vs_overall = (largemid_recall / overall) if (not _is_nan(overall) and overall > 0 and not _is_nan(largemid_recall)) else math.nan
    cur_num = sum(len(r.baseline_current_selected & r.winners_all) for r in res)
    eq_num = sum(len(r.baseline_equal_selected & r.winners_all) for r in res)
    baseline_current_recall = _pooled_recall(cur_num, den_all)
    baseline_equal_recall = _pooled_recall(eq_num, den_all)
    # binding baseline = strongest clean baseline (B++ must beat the best → 복잡도 정당화).
    binding_baseline_recall = max(
        [v for v in (baseline_current_recall, baseline_equal_recall) if not _is_nan(v)], default=math.nan)
    leader_hits_total = sum(len(r.leader_in_selected) for r in res)

    rep_a = RecallReport(
        overall=overall, random_baseline=random_baseline, random_ratio=random_ratio,
        per_horizon=per_h, largemid_recall=largemid_recall, largemid_vs_overall=largemid_vs_overall,
        leader_hits=leader_hits_total, leader_total=leader_basket_size * n, baseline_recall=binding_baseline_recall,
    )
    # ---- TASK 가 SELECTIVE LARGEMID: per-month recall-LIFT vs same-count-N RANDOM baseline ----
    # Pre-registered (frozen before run): per-month random-recall expectation of a size-N random subset of
    # an M-universe against the month's winners = N_m / M_m (analytic expectation; each winner included
    # w.p. N/M — NOT a Monte-Carlo draw). per-month lift = monthly_recall − (n_selected_kept_m / M_m).
    # selected_all is already capped to N by the select_count truncation in process_month. recall_lift_ci90
    # MIRRORS the LOCKED recall_ci90 method (_ci90 verbatim, applied to the lift series). additive — only
    # emitted on the selective path. SoT: docs/superpowers/2026-06-18-tier0-selective-largemid.md.
    selective = select_count is not None
    selective_adjudicated = select_count == SELECTIVE_LARGEMID_ADJUDICATED_COUNT if selective else False
    selective_sensitivity_only = selective and not selective_adjudicated
    per_month_recall_lift: list[float] = []
    per_month_random_recall: list[float] = []
    if selective:
        for r in res:
            recall_m = _pooled_recall(len(r.selected_all & r.winners_all), len(r.winners_all))
            rand_m = (len(r.selected_all) / r.n_universe) if r.n_universe > 0 else math.nan
            per_month_random_recall.append(rand_m)
            per_month_recall_lift.append(
                (recall_m - rand_m) if (not _is_nan(recall_m) and not _is_nan(rand_m)) else math.nan)
    recall_lift_ci90 = _ci90(per_month_recall_lift) if selective else None
    recall_lift_mean = _mean(per_month_recall_lift) if selective else None

    # ---- TRADABLE WINNER DENOMINATOR (재검증 (a), 2026-06-18): per-month recall-LIFT vs same-count-N RANDOM
    # baseline IN THE TRADABLE UNIVERSE. r.winners_all is ALREADY the tradable winner set (process_month
    # filtered it when winner_universe='tradable'). Pre-registered (frozen before run): lift_m =
    # recall_m − (N_m / M_m), N_m = |selected_all_m| (funnel), M_m = r.n_eligible (TRADABLE universe size,
    # NOT n_universe — §5 risk 2). recall_lift_ci90 MIRRORS the LOCKED _ci90 verbatim. Binding gate REUSES
    # gate_a_pass_selective_largemid VERBATIM (no new threshold). additive — only emitted on the tradable
    # path. SoT: docs/superpowers/2026-06-18-tier0-tradable-winner-denominator.md.
    tradable_winner_mode = winner_universe == "tradable"
    tw_per_month_recall_lift: list[float] = []
    if tradable_winner_mode:
        for r in res:
            recall_m = _pooled_recall(len(r.selected_all & r.winners_all), len(r.winners_all))
            rand_m = (len(r.selected_all) / r.n_eligible) if r.n_eligible > 0 else math.nan
            tw_per_month_recall_lift.append(
                (recall_m - rand_m) if (not _is_nan(recall_m) and not _is_nan(rand_m)) else math.nan)
    tw_recall_lift_ci90 = _ci90(tw_per_month_recall_lift) if tradable_winner_mode else None
    tw_recall_lift_mean = _mean(tw_per_month_recall_lift) if tradable_winner_mode else None

    # co-gate IC IR (composite monthly IC IR) — reused by the selective gate. Computed here so the gate A
    # branch can bind on it; the canonical Gate B block below is unchanged.
    co_gate_ic_ir = ic_information_ratio([r.composite_ic for r in res])

    if smoke:
        gate_a_verdict, gate_a_fails = ("SMOKE", ["smoke: 임계 미적용(metrics-only)"])
    elif selective_sensitivity_only:
        gate_a_verdict, gate_a_fails = (
            "SENSITIVITY",
            [f"select_count={select_count} is sensitivity-only; only "
             f"N={SELECTIVE_LARGEMID_ADJUDICATED_COUNT} can emit PASS/FAIL"],
        )
    elif selective:
        # TASK 가: SEPARATE binding gate — recall-lift CI90 lower > 0 (or +5pp fallback) AND IC IR ≥ 0.30.
        # The absolute 0.20 bar is NOT used here (pre-registered). gate_a_pass_largemid is NOT called.
        ok_a, fails_a = gate_a_pass_selective_largemid(
            recall_lift_ci90 or [math.nan, math.nan],
            recall_lift_mean if recall_lift_mean is not None else math.nan,
            co_gate_ic_ir,
        )
        gate_a_verdict, gate_a_fails = ("PASS" if ok_a else "FAIL"), fails_a
    elif tradable_winner_mode:
        # TRADABLE WINNER DENOMINATOR (재검증 (a)): SEPARATE binding gate — recall-lift CI90 lower > 0
        # (or +5pp fallback) AND IC IR ≥ 0.30, REUSED VERBATIM from gate_a_pass_selective_largemid. The
        # absolute 0.20 bar is NOT binding here (pre-registered, reported as secondary transparency only).
        # gate_a_pass / gate_a_pass_largemid are NOT called. Default path (winner_universe='all') unaffected.
        ok_a, fails_a = gate_a_pass_selective_largemid(
            tw_recall_lift_ci90 or [math.nan, math.nan],
            tw_recall_lift_mean if tw_recall_lift_mean is not None else math.nan,
            co_gate_ic_ir,
        )
        gate_a_verdict, gate_a_fails = ("PASS" if ok_a else "FAIL"), fails_a
    elif universe == "largemid":
        # TASK A FROZEN PROTOCOL: binding bar = GATE_A_OVERALL_RECALL_MIN (0.20), redundant largemid
        # sub-checks dropped (freeze doc §3). Identical thresholds, same constants.
        ok_a, fails_a = gate_a_pass_largemid(rep_a)
        gate_a_verdict, gate_a_fails = ("PASS" if ok_a else "FAIL"), fails_a
    else:
        ok_a, fails_a = gate_a_pass(rep_a)
        gate_a_verdict, gate_a_fails = ("PASS" if ok_a else "FAIL"), fails_a

    # ---- TASK A pre-registered baselines + leader prevalence (largemid freeze doc §5) ----
    # All three are PRE-REGISTERED (freeze doc) before the run. (1) random-largemid recall = the
    # frozen random_baseline (selected/universe, universe == largemid set here). (2) equal-rank baseline
    # recall = baseline_equal_recall (trend+earnings equal-rank, inputs restricted to largemid by
    # process_month). gate_a_pass(_largemid) already FAILS if overall <= binding_baseline_recall, so
    # 'must beat baseline' is enforced verbatim. (3) leader prevalence = |LEADER ∩ largemid winners| /
    # |largemid winners| — pure diagnostic tripwire, NOT a pass gate.
    lm_winners_total = sum(len(r.largemid_winners) for r in res)
    lm_leader_winner_hits = sum(len(set(LEADER_BASKET_2026_06) & r.largemid_winners) for r in res)
    leader_prevalence_in_largemid_winners = (
        lm_leader_winner_hits / lm_winners_total) if lm_winners_total else math.nan

    # ---- Gate B (composite monthly IC, scoped) ----
    monthly_ics = [r.composite_ic for r in res]
    sleeve_ics = {s: [r.sleeve_ic.get(s, math.nan) for r in res] for s in ("large", "mid")}
    spreads = [r.spread for r in res]
    top_tercile_ics = [r.top_tercile_ic for r in res]
    baseline_equal_ir = ic_information_ratio([r.baseline_equal_ic for r in res])
    if smoke:
        gate_b_verdict, gate_b_fails, gate_b_metrics = (
            "SMOKE", ["smoke: 임계 미적용(metrics-only)"],
            {"ic_mean": (sum(v for v in monthly_ics if not _is_nan(v)) / max(1, sum(1 for v in monthly_ics if not _is_nan(v)))) if any(not _is_nan(v) for v in monthly_ics) else math.nan,
             "ic_ir": ic_information_ratio(monthly_ics)})
    else:
        gate_b_verdict, gate_b_fails, gate_b_metrics = gate_b_pass(
            monthly_ics, sleeve_ics, spreads, baseline_ic_ir=baseline_equal_ir, top_tercile_ics=top_tercile_ics)

    # ---- Gate C (deterministic, entry-month selection size composition) ----
    gate_c = {"verdict": "N/A"}
    if res:
        monthly_c = []
        all_c_fails = []
        for r in res:
            if universe == "largemid":
                # TASK A: Gate C REPLACEMENT (balance band + ADV floor + sector N/A) — cfg1-4 untouched.
                ok_c, fails_c, metrics_c = gate_c_largemid(
                    r.selected_sleeve, r.selected_score, r.selected_mcap, r.selected_adv)
            else:
                ok_c, fails_c, metrics_c = gate_c_size_composition(
                    r.selected_sleeve, r.selected_score, r.selected_mcap)
            monthly_c.append({"month": r.month, "verdict": "PASS" if ok_c else "FAIL",
                              "fails": fails_c, **metrics_c})
            all_c_fails.extend(f"{r.month}: {f}" for f in fails_c)
        entry_c = monthly_c[0]
        gate_c = {
            "verdict": "PASS" if not all_c_fails else "FAIL",
            "fails": all_c_fails,
            "dist": entry_c["dist"],
            "small_fraction": entry_c["small_fraction"],
            "score_logmcap_corr": entry_c.get("score_logmcap_corr"),
            "entry_month": entry_c["month"],
            "per_month": monthly_c,
        }

    # ---- data quality ----
    status_total = {h: {k: sum(r.status_counts[h].get(k, 0) for r in res) for k in
                        ("ok", "gap", "delisted", "insufficient", "absent")} for h in HARVEST_BUCKETS}
    total_returns = sum(sum(v.values()) for v in status_total.values())
    total_delisted = sum(v["delisted"] for v in status_total.values())
    delisted_fraction = (total_delisted / total_returns) if total_returns else 0.0
    foreign_failed = sum(r.quality_meta.get("foreign_failed", 0) for r in res)
    foreign_total = sum(r.n_universe for r in res)

    # ---- selection_performance: 픽 실현 수익률 (B++ vs legacy momentum proxy vs liquid-eqw), pooled ----
    # omxy R6: 벤치마크 라벨 정직(eqw≠cap-weight) + sleeve-neutral excess(스킬 격리) + net-after-cost +
    # 독립 관측=월 수(950 픽 아님). "decision-grade alpha 아님 = reduced-feature 진단" 명시.
    selection_performance: dict[str, dict] = {}
    for h in HARVEST_BUCKETS:
        bpp_all, leg_all, bpp_exc_eqw, leg_exc_eqw, eqw_means = [], [], [], [], []
        bpp_sleeve_exc, bpp_baskets, sleeve_exc_baskets = [], [], []
        for r in res:
            p = r.selection_perf.get(h, {})
            mm = p.get("eqw_mean", math.nan)
            if not _is_nan(mm):
                eqw_means.append(mm)
            for x in p.get("bpp", []):
                bpp_all.append(x)
                if not _is_nan(mm):
                    bpp_exc_eqw.append(x - mm)
            for x in p.get("legacy", []):
                leg_all.append(x)
                if not _is_nan(mm):
                    leg_exc_eqw.append(x - mm)
            bpp_sleeve_exc.extend(p.get("bpp_sleeve_excess", []))
            if not _is_nan(p.get("bpp_basket", math.nan)):
                bpp_baskets.append(p["bpp_basket"])
            if not _is_nan(p.get("bpp_sleeve_excess_basket", math.nan)):
                sleeve_exc_baskets.append(p["bpp_sleeve_excess_basket"])
        bpp_avg = _mean(bpp_all)
        selection_performance[h] = {
            "bpp_avg_return_gross": round(bpp_avg, 4),
            "bpp_net_return_after_cost": round(bpp_avg - ROUND_TRIP_COST, 4) if not _is_nan(bpp_avg) else math.nan,
            "bpp_hit_rate": round(_hit_rate(bpp_all), 4),
            "bpp_excess_vs_liquid_eqw": round(_mean(bpp_exc_eqw), 4),  # 대부분 size 베타 — 스킬 아님
            "bpp_excess_vs_own_sleeve": round(_mean(bpp_sleeve_exc), 4),  # size-neutral 선택 스킬(핵심)
            "bpp_sleeve_excess_monthly_ci90": _ci90(sleeve_exc_baskets),  # 스킬의 월별 분포 → 유의성 판정
            "bpp_basket_monthly_ci90": _ci90(bpp_baskets),
            "n_bpp_picks": len(bpp_all), "n_independent_months": len(bpp_baskets),
            "legacy_momentum_proxy_avg_return": round(_mean(leg_all), 4),
            "legacy_momentum_proxy_hit_rate": round(_hit_rate(leg_all), 4),
            "legacy_momentum_proxy_excess_vs_liquid_eqw": round(_mean(leg_exc_eqw), 4),
            "liquid_eqw_return": round(_mean(eqw_means), 4),
        }

    exploratory = generator_label != "bpp"
    diagnostic_only = exploratory or universe == "largemid" or tradable_winner_mode

    def _expl(v: str) -> str:
        return f"EXPLORATORY {v}" if diagnostic_only and v in ("PASS", "FAIL") else v

    per_month_rows = []
    for idx, r in enumerate(res):
        row = {
            "month": r.month, "n_universe": r.n_universe, "n_eligible": r.n_eligible,
            "n_winners": len(r.winners_all),
            "recall": _pooled_recall(len(r.selected_all & r.winners_all), len(r.winners_all)),
            "largemid_recall": _pooled_recall(len(r.largemid_selected & r.largemid_winners), len(r.largemid_winners)),
            "leader_hits": len(r.leader_in_selected),
        }
        if selective:
            row["selected_target_count"] = select_count
            row["selected_actual_count"] = len(r.selected_all)
            row["recall_lift_random_baseline"] = per_month_random_recall[idx]
            row["recall_lift"] = per_month_recall_lift[idx]
        if tradable_winner_mode:
            # winners here are ALREADY tradable (process_month filtered). M_m = n_eligible (tradable size).
            row["tradable_random_baseline"] = (len(r.selected_all) / r.n_eligible) if r.n_eligible > 0 else math.nan
            row["tradable_recall_lift"] = tw_per_month_recall_lift[idx]
        per_month_rows.append(row)

    gate_a_report = {
        "verdict": gate_a_verdict, "fails": gate_a_fails,
        "overall_recall": overall, "random_baseline": random_baseline, "random_ratio": random_ratio,
        "per_horizon": per_h, "largemid_recall": largemid_recall, "largemid_vs_overall": largemid_vs_overall,
        "baseline_legacy_momentum_proxy_recall": baseline_current_recall,  # close/MA60 proxy, NOT 73차 incumbent
        "baseline_equal_recall": baseline_equal_recall,
        "binding_baseline_recall": binding_baseline_recall,
        "leader_hits_total": leader_hits_total, "leader_total": leader_basket_size * n,
        "leader_per_month": {r.month: r.leader_in_selected for r in res},
        "recall_ci90": _ci90([_pooled_recall(len(r.selected_all & r.winners_all), len(r.winners_all)) for r in res]),
        "per_month": per_month_rows,
    }
    gate_b_report = {
        "verdict": gate_b_verdict, "fails": gate_b_fails, **gate_b_metrics,
        "baseline_equal_ic_ir": baseline_equal_ir,
        "ic_ir_ci90": _ci90(monthly_ics),
        "monthly": [{"month": r.month, "composite_ic": r.composite_ic, "sleeve_ic": r.sleeve_ic,
                     "spread": r.spread, "top_tercile_ic": r.top_tercile_ic,
                     "baseline_equal_ic": r.baseline_equal_ic,
                     "baseline_ic_weighted_ic": r.baseline_ic_weighted_ic} for r in res],
    }
    if selective:
        # TASK 가 additive recall-lift block (only on the selective path; largemid-freeze / all-universe
        # JSON unaffected). Binding gate = gate_a_pass_selective_largemid (lift-CI lower>0 + ic_ir≥0.30).
        gate_a_report["select_count"] = select_count
        gate_a_report["selective_adjudicated"] = selective_adjudicated
        gate_a_report["sensitivity_only"] = selective_sensitivity_only
        gate_a_report["adjudicated_select_count"] = SELECTIVE_LARGEMID_ADJUDICATED_COUNT
        gate_a_report["allowed_select_counts"] = list(SELECTIVE_LARGEMID_ALLOWED_COUNTS)
        gate_a_report["selected_target_count"] = select_count
        actual_counts = [len(r.selected_all) for r in res]
        gate_a_report["selected_actual_count_min"] = min(actual_counts) if actual_counts else 0
        gate_a_report["selected_actual_count_max"] = max(actual_counts) if actual_counts else 0
        gate_a_report["recall_lift_mean"] = recall_lift_mean
        gate_a_report["recall_lift_ci90"] = recall_lift_ci90
        gate_a_report["recall_lift_random_baseline_per_month"] = [
            _json_number(v) for v in per_month_random_recall]
        gate_a_report["recall_lift_co_gate_ic_ir"] = co_gate_ic_ir
        gate_a_report["recall_lift_note"] = (
            "TASK 가 SELECTIVE LARGEMID binding metric: per-month recall-LIFT = recall(top-N) − N_m/M_m "
            "(analytic same-count-N random expectation, NOT Monte-Carlo). PASS iff recall_lift_ci90 lower "
            "bound > 0 (fallback +5pp if CI NaN) AND co-gate rank-IC IR ≥ 0.30. Absolute recall ≥ 0.20 bar "
            f"NOT used here. Only N={SELECTIVE_LARGEMID_ADJUDICATED_COUNT} is adjudicated; "
            f"N={list(SELECTIVE_LARGEMID_SENSITIVITY_COUNTS)} is SENSITIVITY-only and cannot PASS/FAIL. "
            "NEGATIVE-HYPOTHESIS diagnostic — no --apply. "
            "SoT: docs/superpowers/2026-06-18-tier0-selective-largemid.md."
        )
    if tradable_winner_mode:
        # TRADABLE WINNER DENOMINATOR additive block (only on this path; all-universe/largemid/selective
        # JSON unaffected). Binding gate = gate_a_pass_selective_largemid REUSED VERBATIM (lift-CI lower>0
        # +5pp fallback + ic_ir≥0.30). overall_recall above is now vs the TRADABLE denominator (fair),
        # reported as SECONDARY transparency only — NOT the binding bar.
        gate_a_report["protocol"] = "tradable-winner-denominator"
        gate_a_report["winner_universe"] = "tradable"
        gate_a_report["decision_grade"] = False
        gate_a_report["tradable_recall_lift_mean"] = tw_recall_lift_mean
        gate_a_report["tradable_recall_lift_ci90"] = tw_recall_lift_ci90
        gate_a_report["tradable_recall_lift_co_gate_ic_ir"] = co_gate_ic_ir
        gate_a_report["secondary_absolute_recall_vs_frozen_0_20"] = overall  # NON-binding (fair denominator)
        # omxy ROUND-1 MEDIUM fix: the top-level random_baseline/random_ratio above use n_universe (WHOLE
        # panel) — a legacy whole-universe diagnostic, NOT the fair tradable baseline. Emit the pooled
        # tradable random baseline/ratio (Σselected / Σn_eligible) so the SECONDARY report is consistent with
        # the binding lift (which uses M_m = n_eligible). The binding gate is unaffected (lift+IC only).
        tw_sel_total = sum(len(r.selected_all) for r in res)
        tw_elig_total = sum(r.n_eligible for r in res)
        tw_random_baseline = (tw_sel_total / tw_elig_total) if tw_elig_total else math.nan
        gate_a_report["tradable_random_baseline_pooled"] = tw_random_baseline
        gate_a_report["tradable_random_ratio_pooled"] = (
            (overall / tw_random_baseline) if (not _is_nan(overall) and tw_random_baseline and tw_random_baseline > 0) else math.nan)
        gate_a_report["random_ratio_is_whole_universe_legacy"] = True
        gate_a_report["tradable_recall_lift_note"] = (
            "재검증 (a) TRADABLE WINNER DENOMINATOR binding metric: winners restricted to the funnel's OWN "
            "eligibility universe (F.liquidity_floor_pass, ADV≥₩2B) so numerator (already ADV-floored) and "
            "denominator share the SAME liquid universe (apples-to-apples). per-month recall-LIFT = recall_m "
            "− N_m/M_m where M_m = n_eligible (TRADABLE size). PASS iff tradable_recall_lift_ci90 lower > 0 "
            "(fallback +5pp if CI NaN) AND co-gate rank-IC IR ≥ 0.30 — gate_a_pass_selective_largemid REUSED "
            "VERBATIM, NO new threshold. overall_recall is now vs the fair denominator (SECONDARY, "
            "NON-binding). NOT a rescue of the frozen all-universe verdict — no --apply. "
            "SoT: docs/superpowers/2026-06-18-tier0-tradable-winner-denominator.md."
        )
    if diagnostic_only:
        gate_a_report["exploratory_verdict"] = _expl(gate_a_verdict)
        gate_b_report["exploratory_verdict"] = _expl(gate_b_verdict)

    out_report = {
        "version": "bpp-step2-harvest-1",
        "generated_at": generated_at,
        "harvest": {
            "months_analyzed": n,
            "months": [r.month for r in res],
            "smoke": smoke,
            "forward_insufficient_by_month": {r.month: r.forward_insufficient_horizons for r in res if r.forward_insufficient_horizons},
        },
        "gate_a": gate_a_report,
        "gate_b": gate_b_report,
        "gate_c": gate_c,
        "data_quality": {
            "return_status_counts": status_total,
            "delisted_fraction": round(delisted_fraction, 4),
            "foreign_fail_fraction": round((foreign_failed / foreign_total) if foreign_total else 0.0, 4),
            "earnings_missing_fraction": round(
                (sum(r.quality_meta.get("earnings_missing", 0) for r in res) / foreign_total) if foreign_total else 0.0, 4),
            **coverage_meta,
        },
        "selection_performance": selection_performance,
        "selection_performance_note": (
            "REDUCED-FEATURE (trend+size; foreign off, earnings ~0% in this run) feasibility backtest, "
            "ONE regime (2024-06~2025-12), GROSS+net shown. Benchmarks = liquid-universe EQUAL-WEIGHT "
            "(NOT cap-weight) + a LEGACY MOMENTUM PROXY (close/MA60 only, NOT the 73차 production 5-signal "
            "scorer). bpp_excess_vs_liquid_eqw = APPARENT excess vs liquid EQW, largely a size/regime tilt — "
            "NOT skill. bpp_excess_vs_own_sleeve isolates selection skill from the size tilt; judge its "
            "significance by bpp_sleeve_excess_monthly_ci90 (CI straddling 0 ⇒ small/mixed, not inferentially "
            "validated). Independent obs ≈ n_independent_months (NOT n_bpp_picks); 6M windows overlap. "
            "DIAGNOSTIC SIGNAL, NOT decision-grade alpha; no deploy/apply justified on this."
        ),
        "survivorship_label": survivorship_label,
        "triple_gate_all_pass": (gate_a_verdict == "PASS" and gate_b_verdict == "PASS" and gate_c.get("verdict") == "PASS"),
    }
    if diagnostic_only:
        gc_v = gate_c.get("verdict")
        if isinstance(gc_v, str):
            gate_c["exploratory_verdict"] = _expl(gc_v)
    if exploratory:
        out_report["generator"] = generator_label
        out_report["exploratory"] = True
        out_report["generation_diagnostics"] = {
            "note": (
                "cfg5/cfg6/cfg7 exploratory-only diagnostics. These fields are evidence for aggregation-vs-signal "
                "analysis and do not alter frozen gate metrics, thresholds, or verdicts."
            ),
            "per_month": [
                {"month": r.month, **r.generator_diagnostics}
                for r in res if r.generator_diagnostics
            ],
        }
        # 방어적 per-month skip 기록(무음 금지): EXPLORATORY 생성기가 sleeve 쿼터를 못 채워 abort 대신
        # 그 월만 넘긴 경우 월·사유·count를 노출한다. months_analyzed는 skip 월을 제외한 실제 분석 월 수다.
        shortfall = list(generator_shortfall_months or [])
        out_report["generation_diagnostics"]["generator_shortfall_months"] = shortfall
        out_report["generation_diagnostics"]["generator_shortfall_count"] = len(shortfall)
        if generator_label == "cfg7":
            out_report["generation_diagnostics"]["note"] = (
                "cfg7 DAILY SURGE PROXY (NOT prism: prism=intraday+P&L-judged; cfg7=daily+recall-judged). "
                "EXPLORATORY/diagnostic-only — no apply. Secondary metrics below are funnel diagnostics."
            )
            out_report["generation_diagnostics"]["cfg7_secondary_metrics"] = _cfg7_aggregate(res)
    if universe == "largemid":
        # TASK A FROZEN PROTOCOL additive fields (only on the largemid path — cfg1-4/all-universe JSON
        # stays byte-identical). EXPLORATORY-PASS-style labeling so this is NOT read as a rescue of the
        # FAILED all-universe verdict (freeze doc §1 framing).
        out_report["universe"] = "largemid"
        out_report["protocol"] = "largemid-freeze"
        out_report["diagnostic_only"] = True
        out_report["decision_grade"] = False
        out_report["protocol_note"] = (
            "TASK A: the all-universe Tier0 verdict remains FAILED (NO-CONFIG-PASSES). This protocol "
            "answers a DIFFERENT question — does Tier0 work on the TRADABLE large+mid universe "
            "(₩2B ADV liquidity floor; ₩1.5B owner-book reference; tiny-cap execution infeasible)? "
            "NOT a reinterpretation/rescue. "
            "Pre-registered before run: docs/superpowers/2026-06-17-tier0-largemid-freeze.md."
        )
        out_report["gate_a"]["baseline_random_largemid_recall"] = random_baseline
        out_report["gate_a"]["baseline_equal_rank_largemid_recall"] = baseline_equal_recall
        out_report["gate_a"]["leader_prevalence_in_largemid_winners"] = leader_prevalence_in_largemid_winners
        out_report["gate_a"]["leader_prevalence_note"] = (
            "diagnostic tripwire (|LEADER ∩ largemid winners| / |largemid winners|), NOT a pass gate"
        )
    if selective:
        # TASK 가 SELECTIVE LARGEMID protocol marker (overrides largemid-freeze protocol label). Still
        # diagnostic_only/decision_grade=False. NEGATIVE-HYPOTHESIS: TASK A already FAILED; this is a
        # falsification of selection-skill on the tradable subset, NOT a rescue.
        out_report["protocol"] = "selective-largemid"
        out_report["select_count"] = select_count
        out_report["selective_variant"] = "adjudicated" if selective_adjudicated else "sensitivity"
        out_report["selective_adjudicated"] = selective_adjudicated
        out_report["sensitivity_only"] = selective_sensitivity_only
        out_report["protocol_note"] = (
            f"TASK 가: SELECTIVE LARGEMID (top-{select_count} by cfg1 score, pooled disjoint union). "
            "NEGATIVE-HYPOTHESIS — the all-universe AND largemid-freeze Tier0 verdicts already FAILED; "
            "this asks whether cfg1 ranking has SELECTION skill on large+mid when we actually SELECT N "
            "(not pick ~half the pond). Binding metric = recall-LIFT CI90 lower>0 + co-gate IC IR≥0.30 "
            f"(absolute 0.20 NOT used). Only N={SELECTIVE_LARGEMID_ADJUDICATED_COUNT} is adjudicated; "
            f"N={list(SELECTIVE_LARGEMID_SENSITIVITY_COUNTS)} is sensitivity-only. diagnostic_only, no --apply. "
            "Pre-registered: docs/superpowers/2026-06-18-tier0-selective-largemid.md."
        )
    if tradable_winner_mode:
        # TRADABLE WINNER DENOMINATOR protocol marker (재검증 (a)). universe='all' + generator='bpp', but the
        # Gate A winner denominator is the funnel's own liquid eligibility universe (ADV≥₩2B). diagnostic_only /
        # decision_grade=False. NOT a rescue of the frozen all-universe verdict.
        out_report["protocol"] = "tradable-winner-denominator"
        out_report["winner_universe"] = "tradable"
        out_report["diagnostic_only"] = True
        out_report["decision_grade"] = False
        # omxy ROUND-2 LOW (report hygiene): the shared selection_performance_note is stale for this variant
        # (it says "trend+size; foreign off, earnings ~0%"). For the tradable run, foreign/earnings ARE
        # enabled per config (cfg2 +foreign, cfg3 +earnings, cfg4 +both) and DART backfill loads (~47% cover);
        # the per-cell data_quality block carries the authoritative coverage. This override flags that.
        out_report["selection_performance_note_override"] = (
            "재검증 (a) tradable: foreign/earnings are ENABLED PER CONFIG (cfg1 trend+size · cfg2 +foreign · "
            "cfg3 +earnings · cfg4 +both); DART backfill overlay loads. The shared selection_performance_note's "
            "'foreign off, earnings ~0%' wording is stale for this variant — see per-cell data_quality for the "
            "authoritative foreign_fail_fraction / earnings_missing_fraction."
        )
        out_report["protocol_note"] = (
            "재검증 (a): the frozen all-universe Tier0 verdict (NO-CONFIG-PASSES, max recall 0.112<0.20) "
            "remains FAILED at its own bar. This DENOMINATOR-ARTIFACT test asks a different question — with a "
            "LIQUIDITY-MATCHED winner denominator (winners restricted to ADV≥₩2B tradable names = the funnel's "
            "own eligibility universe), does the funnel show selection skill (recall-LIFT vs same-count random "
            "+ IC co-gate)? Binding metric REUSED VERBATIM from gate_a_pass_selective_largemid; NO threshold "
            "tuned; only the (pre-registered) denominator changed. NOT a reinterpretation/rescue — no --apply. "
            "Pre-registered: docs/superpowers/2026-06-18-tier0-tradable-winner-denominator.md."
        )
    return out_report


def harvest_pit_months(
    start_month: date, end_month: date, panel: Panel, *,
    universe_at: Callable[[date], list[dict]],
    foreign_at: Callable[[str, date], tuple[float, bool]],
    dart_at: Callable[[str, date], object],
    smoke: bool = False, leader_basket: dict[str, str] = LEADER_BASKET_2026_06,
    generated_at: str = "", coverage_meta: Optional[dict] = None,
    progress: bool = False,
    generator: Optional[Callable[[Sequence[F.StockRaw]], dict[str, tuple[list, list]]]] = None,
    generator_label: str = "bpp",
    universe: str = "all",
    select_count: Optional[int] = None,
    winner_universe: str = "all",
) -> dict:
    """월 반복 PIT 하버스트 오케스트레이터 (§5 step 2). 순수 — 모든 I/O는 주입 provider/panel.

    panel = load_pit_panel 출력(실행 시) 또는 테스트 fake. universe_at(t)/foreign_at(tk,t)/dart_at(tk,t).
    forward 데이터 부족 월(end_month + 6M이 미래)은 horizon별 insufficient로 보고(무음 통과 금지).
    """
    if generator_label not in ("bpp", "cfg5", "cfg6", "cfg7"):
        raise ValueError(f"unknown generator_label: {generator_label}")
    if generator_label == "bpp" and generator not in (None, select_bpp_for_harvest):
        raise ValueError("non-BPP generator cannot be labeled as bpp")
    if generator_label != "bpp" and generator is None:
        raise ValueError("exploratory generator_label requires an explicit exploratory generator")
    if universe not in ("all", "largemid"):
        raise ValueError(f"unknown universe: {universe}")
    # cfg8 UN-DEFER (2026-06-18): largemid allows generator_label in (bpp, cfg7). cfg5/cfg6 stay deferred.
    if universe == "largemid" and generator_label not in ("bpp", "cfg7"):
        raise ValueError("largemid allows only generator_label in (bpp, cfg7); cfg5/cfg6+largemid deferred")
    if select_count is not None:
        if select_count <= 0:
            raise ValueError("select_count must be a positive integer")
        if select_count not in SELECTIVE_LARGEMID_ALLOWED_COUNTS:
            raise ValueError(
                f"select_count must be one of {SELECTIVE_LARGEMID_ALLOWED_COUNTS} "
                "(50 adjudicated; 30/75 sensitivity-only)")
        if not (universe == "largemid" and generator_label == "bpp"):
            raise ValueError("select_count only applies to universe='largemid' + generator_label='bpp' (TASK 가)")
    if winner_universe not in ("all", "tradable"):
        raise ValueError(f"unknown winner_universe: {winner_universe}")
    if winner_universe == "tradable":
        # 재검증 (a): tradable winner denominator is an additive variant on the all-universe bpp path.
        # Mutually exclusive with select_count (different additive variant); not combined with largemid
        # (which already restricts the universe). Keep the test apples-to-apples on the headline-FAIL path.
        if select_count is not None:
            raise ValueError("winner_universe='tradable' is mutually exclusive with select_count")
        if universe != "all":
            raise ValueError("winner_universe='tradable' applies only to universe='all' (재검증 (a))")
        if generator_label != "bpp":
            raise ValueError("winner_universe='tradable' applies only to generator_label='bpp' (재검증 (a))")
    dates = panel_trading_days(panel)
    if len(dates) < 2:
        raise RuntimeError("panel 거래일이 부족합니다 (≥2 필요).")
    series = build_series_by_ticker(panel, dates)
    months = iter_selection_months(start_month, end_month)
    results: list[MonthResult] = []
    generator_shortfall_months: list[dict] = []
    prior_factor_ic: dict[str, float] = {}
    factor_ic_history: dict[str, list[float]] = {f: [] for f in _FACTORS}
    for i, t in enumerate(months):
        sel_idx = selection_index(dates, t)
        if sel_idx < 0:
            if progress:
                print(f"  [{t.isoformat()}] 선정일 직전 패널 거래일 없음 — skip", file=sys.stderr, flush=True)
            continue
        sel_date_obj = datetime.strptime(dates[sel_idx], "%Y%m%d").date()  # 실제 패널 거래일
        universe_rows = universe_at(sel_date_obj)  # universe도 동일 PIT 거래일에서 fetch (PIT-001 정합)
        if not universe_rows:
            if progress:
                print(f"  [{t.isoformat()}] universe 비어있음 — skip", file=sys.stderr, flush=True)
            continue
        r = process_month(t, panel, dates, series, universe_rows,
                           foreign_at=foreign_at, dart_at=dart_at,
                           prior_factor_ic=dict(prior_factor_ic), leader_basket=leader_basket,
                           generator=generator, generator_label=generator_label, universe=universe,
                           select_count=select_count, winner_universe=winner_universe)
        if r is None:
            continue
        if isinstance(r, _GeneratorShortfall):
            generator_shortfall_months.append({"month": r.month, "reason": r.reason})
            if progress:
                print(f"  [{r.month}] EXPLORATORY generator shortfall — month skipped (recorded): {r.reason}",
                      file=sys.stderr, flush=True)
            continue
        results.append(r)
        # expanding-window prior factor IC (no lookahead: month t uses months < t)
        for f in _FACTORS:
            if not _is_nan(r.factor_ics.get(f, math.nan)):
                factor_ic_history[f].append(r.factor_ics[f])
        prior_factor_ic = {f: (sum(v) / len(v) if v else math.nan) for f, v in factor_ic_history.items()}
        if progress:
            print(f"  [{t.isoformat()}] universe={r.n_universe} eligible={r.n_eligible} "
                  f"winners={len(r.winners_all)} recall={_pooled_recall(len(r.selected_all & r.winners_all), len(r.winners_all)):.3f} "
                  f"ic={r.composite_ic:.3f} leaders={len(r.leader_in_selected)}/{len(leader_basket)}", file=sys.stderr, flush=True)
    if not results:
        if generator_shortfall_months:
            raise RuntimeError(
                f"처리된 선정월이 0개입니다 — EXPLORATORY 생성기가 모든 월({len(generator_shortfall_months)})에서 "
                f"sleeve shortfall(무음 금지). universe/유동성 플로어/스크린 구성 재검토 필요.")
        raise RuntimeError("처리된 선정월이 0개입니다 (universe/패널/forward 데이터 확인).")
    return aggregate_harvest(results, smoke=smoke, generated_at=generated_at,
                             coverage_meta=coverage_meta or {},
                             survivorship_label="clean (KRX bydd_trd=PIT, step-0 probe PASS)",
                             leader_basket_size=len(leader_basket),
                             generator_label=generator_label,
                             generator_shortfall_months=generator_shortfall_months,
                             universe=universe, select_count=select_count,
                             winner_universe=winner_universe)


# ============================================================================
# CLI driver (실 provider wiring — 장시간/게이트 step 2)
# ============================================================================

def _load_env() -> None:
    env = Path(__file__).resolve().parent.parent / "tudal/.env.local"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export "):]
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    if "SUPABASE_URL" not in os.environ and "NEXT_PUBLIC_SUPABASE_URL" in os.environ:
        os.environ["SUPABASE_URL"] = os.environ["NEXT_PUBLIC_SUPABASE_URL"]


def _parse_month_arg(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date().replace(day=1)


class _MemResult:
    __slots__ = ("data",)

    def __init__(self, data):
        self.data = data


class _MemTable:
    """In-memory stand-in for a supabase table query chain (cache reads only).

    Feasibility (C7): a 12-18M × ~2000-ticker harvest issues ~hundreds of thousands of
    dart cache SELECTs if hitting the network. Pre-load dart_financial_cache + dart_corp_codes
    once and serve fetch_dart_signals' cache_lookup/_lookup_corp_code from memory → instant,
    zero network. Mirrors only the .select().eq()....limit().execute() chain those helpers use.
    """

    def __init__(self, name, fin, corp):
        self._name, self._fin, self._corp, self._f = name, fin, corp, {}

    def select(self, *_a, **_k):
        return self

    def eq(self, col, val):
        self._f[col] = val
        return self

    def limit(self, _n):
        return self

    def execute(self):
        if self._name == "dart_corp_codes":
            c = self._corp.get(self._f.get("ticker"))
            return _MemResult([{"corp_code": c}] if c else [])
        if self._name == "dart_financial_cache":
            row = self._fin.get((self._f.get("corp_code"), self._f.get("period_type"), self._f.get("period_key")))
            return _MemResult([row] if row else [])
        return _MemResult([])


class _MemDartClient:
    def __init__(self, fin, corp):
        self._fin, self._corp = fin, corp

    def table(self, name):
        return _MemTable(name, self._fin, self._corp)


def _preload_dart_cache(client) -> tuple[dict, dict]:
    """Bulk-load dart_financial_cache + dart_corp_codes into memory dicts (paged 1000)."""
    fin: dict = {}
    corp: dict = {}
    start = 0
    while True:
        rows = (client.table("dart_corp_codes").select("ticker, corp_code")
                .range(start, start + 999).execute().data or [])
        for r in rows:
            if r.get("ticker") and r.get("corp_code"):
                corp[r["ticker"]] = r["corp_code"]
        if len(rows) < 1000:
            break
        start += 1000
    start = 0
    while True:
        rows = (client.table("dart_financial_cache").select("*")
                .range(start, start + 999).execute().data or [])
        for r in rows:
            fin[(r.get("corp_code"), r.get("period_type"), r.get("period_key"))] = r
        if len(rows) < 1000:
            break
        start += 1000
    return fin, corp


def _overlay_local_dart_cache(mem_fin: dict, backfill_path: Path) -> int:
    """로컬 DART 백필(JSONL, rcept_dt 보유)을 production preload(mem_fin) 위에 overlay (B+C DART-BACKFILL F).

    각 줄 = {corp_code, period_type, period_key, <FINANCIAL_KEYS>, rcept_dt, status}. 로컬 행은 rcept_dt가
    있어 availability 게이트(_cache_ok_row_available_as_of)를 통과 → 실 earnings 활성. production-only 행은
    rcept_dt 부재로 fail-closed 유지. Returns overlaid row 수.

    omxy BC-R3 #2 belt: genuine 'ok' 행(rcept_dt + 재무 ≥1)만 overlay. no_data/schema_empty/malformed는
    skip → production 행을 빈 행으로 clobber 하지 않음(producer 가드의 이중 방어).
    """
    import dart_signals as D
    n = 0
    for line in backfill_path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except ValueError:
            continue
        key = (row.get("corp_code"), row.get("period_type"), row.get("period_key"))
        if not all(key):
            continue
        if row.get("status") != "ok" or not row.get("rcept_dt"):
            continue  # no_data/schema_empty/rcept_dt 결여 → 비-available, overlay 금지
        if not any(row.get(k) is not None for k in D.FINANCIAL_KEYS):
            continue  # 재무 전무 → disclosed-with-data 오인 방지
        mem_fin[key] = row
        n += 1
    return n


def _build_real_providers(start_month: date, end_month: date, cache_dir: Path,
                          universe_limit: Optional[int], with_foreign: bool,
                          with_earnings: bool = False, dart_backfill_path: Optional[str] = None,
                          allow_supabase: bool = True):
    """실 KRX/pykrx/DART provider + 디스크 캐시 panel 구성 (장시간 step-2 전용).

    Returns (panel, universe_at, foreign_at, dart_at, coverage_meta).
    DART = cache_only(HTTP 금지) + PIT as-of. foreign = pykrx fetch-once-per-ticker(디스크 캐시) + fail-soft.
    """
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import screen_shortlist_tier0 as S  # heavy loaders (lazy)
    from krx_openapi import fetch_bydd_trd
    import dart_signals as D

    cache_dir.mkdir(parents=True, exist_ok=True)
    # 패널 span: start_month - lookback(450d) ~ end_month + 6M forward.
    panel_start = date(start_month.year, start_month.month, 1) - timedelta(days=S.BPP_LOOKBACK_CALENDAR_DAYS)
    panel_end = min(date.today(), end_month + timedelta(days=210))
    span = (panel_end - panel_start).days + 1
    all_days = [panel_end - timedelta(days=o) for o in range(span)]
    bas_dds = sorted(d.strftime("%Y%m%d") for d in all_days if d.weekday() < 5)
    print(f"[panel] building PIT panel {bas_dds[0]}~{bas_dds[-1]} ({len(bas_dds)} weekdays × 2 markets) → {cache_dir}",
          file=sys.stderr, flush=True)
    panel = load_pit_panel(bas_dds, cache_dir=cache_dir, progress=True)
    print(f"[panel] {len(panel)} trading days loaded", file=sys.stderr, flush=True)

    dart_key = os.environ.get("DART_API_KEY")
    # omxy S1-R1 #3: live_client(sector resolve용)은 DART 키에만 의존 — with_foreign이 sector 경로를
    # 바꾸지 않도록 분리(foreign on/off A/B에서 sector resolution 동일 유지).
    live_client = S.get_supabase_client() if (allow_supabase and dart_key) else None
    mem_fin, mem_corp, cache_provenance = ({}, {}, "none")
    if with_earnings and dart_key and live_client is not None:
        # earnings 활성 시에만 financial 캐시 preload(off면 dart_at이 neutral 반환 → preload 불필요).
        print("[dart] pre-loading production dart_financial_cache + dart_corp_codes ...",
              file=sys.stderr, flush=True)
        mem_fin, mem_corp = _preload_dart_cache(live_client)
        cache_provenance = "production"
        # hybrid (B+C DART-BACKFILL): rcept_dt 보유 로컬 백필을 production 위에 overlay → availability 게이트 통과.
        if dart_backfill_path and Path(dart_backfill_path).exists():
            n_local = _overlay_local_dart_cache(mem_fin, Path(dart_backfill_path))
            cache_provenance = "hybrid(local-backfill+production)"
            print(f"[dart] overlaid {n_local} local-backfill rows (with rcept_dt)", file=sys.stderr, flush=True)
        print(f"[dart] {len(mem_fin)} cache rows · {len(mem_corp)} corp_codes · provenance={cache_provenance}",
              file=sys.stderr, flush=True)
    mem_client = _MemDartClient(mem_fin, mem_corp)

    # universe + sector resolve. sel = **실제 패널 거래일**(harvest가 전달, PIT-001 정합) — 가격 슬라이스
    # 날짜와 동일. 주말-only heuristic 재계산 제거(공휴일 어긋남 차단). 거래일 키 캐시.
    _uni_cache: dict[str, list[dict]] = {}
    _ticker_market: dict[str, str] = {}  # Stage-1 foreign: ticker→KOSPI/KOSDAQ (per-market 외국인 fetch용)

    def universe_at(sel: date) -> list[dict]:
        key = sel.isoformat()
        if key in _uni_cache:
            return _uni_cache[key]
        uni = S.fetch_universe(sel, limit=universe_limit)
        S.resolve_sectors_for_universe(uni, supabase_client=live_client)
        for u in uni:
            _ticker_market[u["ticker"]] = u.get("market", "")
        _uni_cache[key] = uni
        return uni

    # foreign (Stage-1): default OFF → penalty tier neutralize. --with-foreign 시 per-(market, 선정일)
    # **전종목 1콜**(get_market_net_purchases_of_equities_by_ticker, 순매수거래대금) → 선정일 직전
    # FOREIGN_WINDOW_CAL_DAYS 창의 외국인 net 누적. per-ticker(~5만콜·7시간)를 ~38콜(19개월×2시장)로 역전.
    # 캐시 키에 window 포함(omxy S1-R1 #1: 다른 window run이 stale 캐시 재사용 방지). 콜 실패→fail-soft.
    foreign_dir = cache_dir / "foreign"
    _foreign_mkt_mem: dict[tuple[str, str], Optional[dict]] = {}

    def _foreign_market_dict(market: str, sel: date) -> Optional[dict]:
        """(market, 선정일) 전종목 외국인 순매수대금 {ticker: won}. 콜 실패 시 None(penalty)."""
        skey = sel.strftime("%Y%m%d")
        mem_key = (market, skey)
        if mem_key in _foreign_mkt_mem:
            return _foreign_mkt_mem[mem_key]
        foreign_dir.mkdir(parents=True, exist_ok=True)
        cf = foreign_dir / f"{market}_{skey}_w{FOREIGN_WINDOW_CAL_DAYS}.json"
        if cf.exists():
            try:
                s = json.loads(cf.read_text())
                d = None if s.get("failed") else s.get("dict", {})
                _foreign_mkt_mem[mem_key] = d
                return d
            except (ValueError, OSError):
                pass
        frm = (sel - timedelta(days=FOREIGN_WINDOW_CAL_DAYS)).strftime("%Y%m%d")
        d: Optional[dict] = None
        try:
            S.ensure_pykrx()
            from pykrx import stock
            df = stock.get_market_net_purchases_of_equities_by_ticker(frm, skey, market, "외국인")
            d = foreign_dict_from_df(df)  # 스키마 기반: 컬럼 부재(삼킨 실패)→None / 존재→dict (omxy S1-R2)
        except Exception:  # noqa: BLE001 — pykrx 예외도 진짜 실패
            d = None
        try:
            cf.write_text(json.dumps({"failed": d is None, "dict": d or {}}))
        except OSError:
            pass
        _foreign_mkt_mem[mem_key] = d
        return d

    def foreign_at(tk: str, sel: date) -> tuple[float, bool]:
        if not with_foreign:
            return (math.nan, True)  # neutralized via penalty tier (no pykrx); recorded as foreign_failed
        market = _ticker_market.get(tk)
        if not market:
            return (math.nan, True)  # market 미상 → fetch 불가 → penalty
        return classify_foreign(_foreign_market_dict(market, sel), tk)

    def dart_at(tk: str, sel: date):
        if not with_earnings or not dart_key:
            return D.DartSignalsResult()  # earnings off → 구조적 결측 neutral-50 (0 아님), 깨끗한 A/B 토글
        return D.fetch_dart_signals(mem_client, tk, sel, dart_key, as_of_date=sel, cache_only=True)

    coverage_meta = {
        "dart_cache_only": bool(dart_key and with_earnings), "dart_cache_rows": len(mem_fin),
        "earnings_enabled": with_earnings, "dart_cache_provenance": cache_provenance,
        "foreign_enabled": with_foreign,
        "foreign_note": "disabled→penalty-tier neutralized" if not with_foreign else "per-market net (schema-classified)",
    }
    return panel, universe_at, foreign_at, dart_at, coverage_meta


def _load_shadow_json_file(path: Path, label: str, input_error_cls):
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError, UnicodeDecodeError) as exc:
        raise input_error_cls(f"{label} JSON invalid at {path}: {exc}") from exc


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Tier 0 B++ 삼중 게이트 하버스트 (§4·§5 step 2). "
                    "Smoke: --start-month 2026-04-01 --end-month 2026-06-01 --smoke --universe-limit 300. "
                    "Full (forward 데이터 존재 필수, end-month ≤ today-6M): "
                    "--start-month 2024-06-01 --end-month 2025-12-01.")
    parser.add_argument("--start-month", required=True, type=_parse_month_arg, help="YYYY-MM-01 (PIT 첫 선정월)")
    parser.add_argument("--end-month", required=True, type=_parse_month_arg, help="YYYY-MM-01 (마지막 선정월)")
    parser.add_argument("--cache-dir", default="scripts/out/pit_cache", help="bydd_trd 디스크 캐시 디렉토리")
    parser.add_argument("--out", default="scripts/out/tier0_ic_report.json", help="게이트 리포트 JSON")
    parser.add_argument("--smoke", action="store_true",
                        help="패널/포워드 로직 smoke (게이트 임계 미적용 — metrics-only, PASS≠실 통과)")
    parser.add_argument("--universe-limit", type=int, default=None, help="universe cap (smoke 전용)")
    parser.add_argument("--with-foreign", action="store_true",
                        help="외국인 시그널 활성 (기본 OFF → penalty-tier neutralize). 활성 시 per-(market,month) net.")
    parser.add_argument("--earnings", action="store_true",
                        help="DART 실적·퀄리티 활성 (기본 OFF → neutral-50). 활성 시 cache-only PIT(availability "
                             "rcept_dt 게이트). --dart-backfill-path로 rcept_dt 로컬 캐시 overlay.")
    parser.add_argument("--dart-backfill-path", default=None,
                        help="로컬 DART 백필(JSONL, rcept_dt) 경로 — production 위에 overlay (earnings PIT 활성).")
    parser.add_argument("--select-count", type=int, default=None,
                        help="TASK 가 SELECTIVE LARGEMID — largemid+cfg1 선정을 cfg1 score 상위 N개(pooled, "
                             "cross-bucket-disjoint union)로 제한. default None = 현 동작 byte-identical(전 픽). "
                             "50만 adjudicated, 30/75는 non-adjudicated sensitivity. universe=largemid + "
                             "generator=bpp 에서만 허용. SoT: docs/superpowers/2026-06-18-tier0-selective-largemid.md.")
    parser.add_argument("--generator", choices=("bpp", "cfg5", "cfg6", "cfg7"), default="bpp",
                        help="후보 생성기. bpp(기본·frozen cfg1-4 경로 byte-identical) / cfg5(regime "
                             "leading-sector tilt, EXPLORATORY) / cfg6(multi-net union, EXPLORATORY) / "
                             "cfg7(daily surge proxy, EXPLORATORY — NOT prism). "
                             "cfg5/cfg6/cfg7 = diagnostic-only, 어떤 PASS도 'EXPLORATORY PASS'로 라벨 + no-apply.")
    parser.add_argument("--universe", choices=("all", "largemid"), default="all",
                        help="후보 universe. all(기본·byte-identical) / largemid(TASK A FROZEN PROTOCOL — "
                             "선정일 PIT large+mid로 candidate+winner 제한, Gate C 교체, pre-registered baselines). "
                             "largemid = diagnostic, no-apply. SoT: docs/superpowers/2026-06-17-tier0-largemid-freeze.md.")
    parser.add_argument("--winner-universe", choices=("all", "tradable"), default="all",
                        help="재검증 (a) Gate A 분모. all(기본·byte-identical) / tradable(승자 집합을 펀들 자체 "
                             "유동성 floor ADV≥₩2B로 제한 = apples-to-apples 분모). tradable = universe=all + "
                             "generator=bpp 에서만 허용, select_count과 상호배타. 바인딩 = recall-LIFT CI90 lower>0 "
                             "+ IC IR≥0.30 (gate_a_pass_selective_largemid 그대로 재사용, 임계 무변경). "
                             "diagnostic-only, no-apply. SoT: docs/superpowers/2026-06-18-tier0-tradable-winner-denominator.md.")
    # === PR-B5 Track 2 shadow forward-recall evaluator (additive, default-OFF → frozen path byte-identical) ===
    # Evaluator lives in the sibling module scripts/shadow_eval.py (imports this module for leaf reuse);
    # these flags + the early-return dispatch below are the ONLY edits to main(). SoT:
    # docs/superpowers/specs/2026-06-22-pathA-track2-prb5-forward-recall-evaluator.md.
    parser.add_argument("--shadow-eval", action="store_true",
                        help="PR-B5: shadow forward-recall post-process (default OFF = frozen B+C byte-identical).")
    parser.add_argument("--shadow-extract-json", default=None,
                        help="owner-psql Query-2 facts: JSON ARRAY of per-period objects (§1.2).")
    parser.add_argument("--shadow-coverage-json", default=None,
                        help="PR-B4 reconcile report JSON (eligibility gate; only 'complete' periods score).")
    parser.add_argument("--shadow-arms", default="production-mirror,sector-soft-tilt,sector-hard-gate",
                        help="active arms; production-mirror anchors FIX-J + is the paired baseline.")
    parser.add_argument("--kill-rule-file", default=None,
                        help="frozen pre-registration: tracks{primary_horizon,power_floor_n}, regimes, freeze_tag (§7.5a).")
    parser.add_argument("--survivorship-artifact", default=None,
                        help="probe_pit_survivorship --emit-artifact JSON (per-market list, §5).")
    parser.add_argument("--shadow-out", default="scripts/out/tier0_shadow_recall_verdict.json",
                        help="PR-B5 verdict report (NOT --out; never overwrites the frozen harvest).")
    parser.add_argument("--print-shadow-sql", action="store_true", help="emit PR-B5 Query 2 and exit.")
    parser.add_argument("--print-shadow-sql-inline", action="store_true",
                        help="emit PR-B5 Query 2 single-line (json_agg wrap) and exit.")
    # === PR-A5 Track 1 in-pool 30-reranking forward VERDICT evaluator (additive, default-OFF → frozen
    # path byte-identical). Evaluator lives in the sibling module scripts/shadow_arm_eval.py (imports this
    # module for leaf reuse); these flags + the early-return dispatch below are the ONLY edits to main().
    # SoT: docs/superpowers/specs/2026-06-23-pathA-track1-pra5-verdict-evaluator.md. ===
    parser.add_argument("--shadow-arm-eval", action="store_true",
                        help="PR-A5: Track 1 shadow-arm forward verdict (default OFF = frozen B+C byte-identical).")
    parser.add_argument("--shadow-arm-extract-json", default=None,
                        help="owner/service-role-psql shadow-arm facts: JSON ARRAY of per-period objects (§1).")
    parser.add_argument("--shadow-arm-coverage-json", default=None,
                        help="PR-A4 reconcile report JSON (eligibility gate; only 'complete' periods score).")
    parser.add_argument("--shadow-arm-arms",
                        default="production-snapshot,sector-soft-reserve,regime-sector-soft-reserve,candidate-pool-hard-gate",
                        help="active arms; production-snapshot is the paired baseline.")
    parser.add_argument("--shadow-arm-out", default="scripts/out/shadow_arm_verdict.json",
                        help="PR-A5 verdict report (NOT --out; never overwrites the frozen harvest).")
    parser.add_argument("--print-shadow-arm-sql", action="store_true", help="emit PR-A5 extract SQL and exit.")
    parser.add_argument("--print-shadow-arm-sql-inline", action="store_true",
                        help="emit PR-A5 extract SQL single-line (json_agg wrap) and exit.")
    args = parser.parse_args()
    if args.generator == "cfg6" and not args.with_foreign:
        parser.error("--generator cfg6 requires --with-foreign because cfg6's frozen screen set includes foreign")
    if args.generator == "cfg7" and (args.with_foreign or args.earnings):
        parser.error("--generator cfg7 is frozen as a daily-surge-only proxy; do not pass --with-foreign/--earnings")
    # cfg8 UN-DEFER (2026-06-18): allow generator=cfg7 + --universe largemid (cfg8 = surge-on-largemid,
    # USER falsification). cfg5/cfg6 + largemid remain deferred (no PIT-safe combo defined).
    if args.universe == "largemid" and args.generator not in ("bpp", "cfg7"):
        parser.error("--universe largemid allows only --generator bpp or cfg7 (cfg8 surge-on-largemid); "
                     "cfg5/cfg6+largemid remain deferred")
    if args.universe == "largemid" and (args.with_foreign or args.earnings):
        parser.error("--universe largemid protocols are frozen offline with foreign/earnings OFF")
    # TASK 가: --select-count is a post-generation truncation of the largemid+cfg1(bpp) selection only.
    if args.select_count is not None:
        if args.select_count <= 0:
            parser.error("--select-count must be a positive integer")
        if args.select_count not in SELECTIVE_LARGEMID_ALLOWED_COUNTS:
            parser.error(f"--select-count must be one of {SELECTIVE_LARGEMID_ALLOWED_COUNTS} "
                         "(50 adjudicated; 30/75 sensitivity-only)")
        if not (args.universe == "largemid" and args.generator == "bpp"):
            parser.error("--select-count only applies to --universe largemid + --generator bpp "
                         "(TASK 가 selective largemid)")
    # 재검증 (a): --winner-universe tradable is an additive variant on the all-universe bpp path.
    if args.winner_universe == "tradable":
        if args.select_count is not None:
            parser.error("--winner-universe tradable is mutually exclusive with --select-count")
        if args.universe != "all":
            parser.error("--winner-universe tradable applies only to --universe all (재검증 (a))")
        if args.generator != "bpp":
            parser.error("--winner-universe tradable applies only to --generator bpp (재검증 (a))")

    _shadow_b5_mode = args.shadow_eval or args.print_shadow_sql or args.print_shadow_sql_inline
    _shadow_a5_mode = args.shadow_arm_eval or args.print_shadow_arm_sql or args.print_shadow_arm_sql_inline
    if _shadow_b5_mode and _shadow_a5_mode:
        parser.error("PR-B5 shadow and PR-A5 shadow-arm modes are mutually exclusive")

    # === PR-B5 shadow dispatch (early-return BEFORE _load_env/_build_real_providers/harvest_pit_months
    # — the frozen B+C path never runs on the shadow path; inert when --shadow-eval absent). ===
    if args.print_shadow_sql or args.print_shadow_sql_inline:
        import shadow_eval as SE
        print(SE.SHADOW_RUN_EXTRACT_SQL if args.print_shadow_sql else SE.shadow_sql_inline())
        return
    if args.shadow_eval:
        import shadow_eval as SE
        _bad = [n for n, v in (("--universe largemid", args.universe == "largemid"),
                               ("--select-count", args.select_count is not None),
                               ("--winner-universe tradable", args.winner_universe == "tradable"),
                               ("--generator!=bpp", args.generator != "bpp"),
                               ("--with-foreign", args.with_foreign), ("--earnings", args.earnings),
                               ("--shadow-arm-eval", args.shadow_arm_eval)) if v]
        if _bad:
            parser.error(f"--shadow-eval is incompatible with frozen-path flags: {_bad}")
        for req in ("shadow_extract_json", "shadow_coverage_json", "kill_rule_file", "survivorship_artifact"):
            if getattr(args, req) is None:
                parser.error(f"--shadow-eval requires --{req.replace('_', '-')}")
        _load_env()
        _sh_root = Path(__file__).resolve().parents[1]

        def _sh_rp(raw: str) -> Path:
            p = Path(raw)
            return p if p.is_absolute() else _sh_root / p

        arms = [a for a in args.shadow_arms.split(",") if a]
        try:
            kill_rule = _load_shadow_json_file(_sh_rp(args.kill_rule_file), "kill_rule", SE.ShadowEvalInputError)
            panel = load_pit_panel(SE.shadow_panel_days(args.start_month, args.end_month),
                                   cache_dir=_sh_rp(args.cache_dir), progress=True)
            extract = SE.parse_shadow_extract(_load_shadow_json_file(
                _sh_rp(args.shadow_extract_json), "shadow_extract", SE.ShadowEvalInputError))
            coverage = _load_shadow_json_file(_sh_rp(args.shadow_coverage_json), "shadow_coverage",
                                              SE.ShadowEvalInputError)
            survivorship = SE.read_survivorship_artifact(
                _load_shadow_json_file(_sh_rp(args.survivorship_artifact), "survivorship_artifact",
                                       SE.ShadowEvalInputError),
                forward_window=SE.shadow_forward_window(
                    extract, kill_rule, panel, fallback=(args.start_month, args.end_month)))
            period_results = SE.harvest_shadow_periods(
                panel=panel, extract=extract, coverage=coverage, kill_rule=kill_rule, arms=arms)
            report = SE.aggregate_shadow_harvest(
                period_results, kill_rule=kill_rule, arms=arms,
                generated_at=datetime.now().isoformat(timespec="seconds"), survivorship=survivorship)
        except SE.ShadowEvalInputError as exc:
            sys.exit(f"[ABORT] PR-B5 shadow eval input invalid (fail-closed): {exc}")
        SE.emit_shadow_verdict(report, _sh_rp(args.shadow_out))
        print(f"[PR-B5] shadow forward-recall verdict → {_sh_rp(args.shadow_out)} · "
              f"run_verdict={report['run_verdict']} · per_track={report.get('per_track_verdict')} · "
              f"user_review_required={report.get('user_review_required')}", file=sys.stderr)
        return

    # === PR-A5 Track 1 shadow-arm dispatch (early-return BEFORE _load_env/_build_real_providers/
    # harvest_pit_months — the frozen B+C path never runs on the shadow-arm path; inert when
    # --shadow-arm-eval absent). Mirrors the PR-B5 dispatch structure above. ===
    if args.print_shadow_arm_sql or args.print_shadow_arm_sql_inline:
        import shadow_arm_eval as SAE
        print(SAE.SHADOW_ARM_EXTRACT_SQL if args.print_shadow_arm_sql else SAE.shadow_arm_sql_inline())
        return
    if args.shadow_arm_eval:
        import shadow_arm_eval as SAE
        _bad = [n for n, v in (("--universe largemid", args.universe == "largemid"),
                               ("--select-count", args.select_count is not None),
                               ("--winner-universe tradable", args.winner_universe == "tradable"),
                               ("--generator!=bpp", args.generator != "bpp"),
                               ("--with-foreign", args.with_foreign), ("--earnings", args.earnings),
                               ("--shadow-eval", args.shadow_eval)) if v]
        if _bad:
            parser.error(f"--shadow-arm-eval is incompatible with frozen-path flags: {_bad}")
        for req in ("shadow_arm_extract_json", "shadow_arm_coverage_json", "kill_rule_file",
                    "survivorship_artifact"):
            if getattr(args, req) is None:
                parser.error(f"--shadow-arm-eval requires --{req.replace('_', '-')}")
        _load_env()
        _sa_root = Path(__file__).resolve().parents[1]

        def _sa_rp(raw: str) -> Path:
            p = Path(raw)
            return p if p.is_absolute() else _sa_root / p

        arms = [a for a in args.shadow_arm_arms.split(",") if a]
        try:
            kill_rule = _load_shadow_json_file(_sa_rp(args.kill_rule_file), "kill_rule",
                                               SAE.ShadowArmEvalInputError)
            panel = load_pit_panel(SAE.shadow_arm_panel_days(args.start_month, args.end_month),
                                   cache_dir=_sa_rp(args.cache_dir), progress=True)
            extract = SAE.parse_shadow_arm_extract(_load_shadow_json_file(
                _sa_rp(args.shadow_arm_extract_json), "shadow_arm_extract", SAE.ShadowArmEvalInputError))
            coverage = _load_shadow_json_file(_sa_rp(args.shadow_arm_coverage_json), "shadow_arm_coverage",
                                              SAE.ShadowArmEvalInputError)
            survivorship = SAE.read_survivorship_artifact(
                _load_shadow_json_file(_sa_rp(args.survivorship_artifact), "survivorship_artifact",
                                       SAE.ShadowArmEvalInputError),
                forward_window=SAE.shadow_arm_forward_window(
                    extract, panel, fallback=(args.start_month, args.end_month)))
            period_results = SAE.harvest_shadow_arm_periods(
                panel=panel, extract=extract, coverage=coverage, kill_rule=kill_rule, arms=arms)
            report = SAE.aggregate_shadow_arm_verdict(
                period_results, kill_rule=kill_rule, arms=arms,
                generated_at=datetime.now().isoformat(timespec="seconds"), survivorship=survivorship)
            SAE.assert_verdict_integrity(report)
        except SAE.ShadowArmEvalInputError as exc:
            sys.exit(f"[ABORT] PR-A5 shadow-arm eval input invalid (fail-closed): {exc}")
        SAE.emit_shadow_arm_verdict(report, _sa_rp(args.shadow_arm_out))
        print(f"[PR-A5] shadow-arm forward verdict → {_sa_rp(args.shadow_arm_out)} · "
              f"run_verdict={report['run_verdict']} · per_track={report.get('per_track_verdict')} · "
              f"user_review_required={report.get('user_review_required')}", file=sys.stderr)
        return

    # FROZEN provenance 스탬프 — adjudicator load_matrix가 요구(없으면 INVALID_INPUT fail-closed).
    # additive: bpp 경로에도 동일 적용(기존 cfg1-4 JSON과 동일 필드, 비파괴).
    PARAM_LOCK_COMMIT_HASH = "17dc6d9"
    FREEZE_TAG = "tier0-multiregime-freeze"

    generator = None
    if args.generator in ("cfg5", "cfg6", "cfg7"):
        import tier0_cfg56 as C56
        generator = {"cfg5": C56.select_cfg5_for_harvest,
                     "cfg6": C56.select_cfg6_for_harvest,
                     "cfg7": C56.select_cfg7_for_harvest}[args.generator]

    repo_root = Path(__file__).resolve().parents[1]

    def repo_path(raw: str) -> Path:
        p = Path(raw)
        return p if p.is_absolute() else repo_root / p

    cache_dir = repo_path(args.cache_dir)
    out_path = repo_path(args.out)

    _load_env()

    # forward-data 가드: end_month + 6M(long horizon)이 미래면 마지막 월들의 long forward 부재 → 경고.
    six_months_ago = date.today() - timedelta(days=183)
    if args.end_month > six_months_ago and not args.smoke:
        print(f"[warn] end-month {args.end_month} + 6M(long)이 today({date.today()})를 넘습니다 — "
              f"후반 월의 long horizon forward 데이터 부재 → insufficient로 제외 보고됩니다. "
              f"완전한 6M forward를 원하면 end-month ≤ {six_months_ago.replace(day=1)} 권장.", file=sys.stderr)

    # allow_supabase only on the frozen all-universe bpp path. largemid (TASK A) + cfg5/6/7 (exploratory)
    # run offline (allow_supabase=False) → cost 0, no Supabase (HARD CONSTRAINT).
    # 재검증 (a) omxy ROUND-1 HIGH fix: the tradable variant MUST use the SAME provider wiring as the
    # 2026-06-17 bc run — allow_supabase=True so live_client is created and the DART backfill overlay loads
    # (_build_real_providers gates the DART preload+overlay behind `live_client is not None`; forcing False
    # silently zeroed earnings → cfg3/cfg4 collapsed to trend+size, defeating the 5-signal experiment). The
    # ONLY delta vs bc is the winner denominator. Supabase READ is not AI cost (cost 0 preserved) and not a
    # production write (no --apply). So tradable (bpp + all) takes the SAME allow_supabase as the frozen path.
    allow_supabase = (args.generator == "bpp" and args.universe == "all")
    panel, universe_at, foreign_at, dart_at, coverage_meta = _build_real_providers(
        args.start_month, args.end_month, cache_dir, args.universe_limit, args.with_foreign,
        with_earnings=args.earnings, dart_backfill_path=args.dart_backfill_path,
        allow_supabase=allow_supabase)

    report = harvest_pit_months(
        args.start_month, args.end_month, panel,
        universe_at=universe_at, foreign_at=foreign_at, dart_at=dart_at,
        smoke=args.smoke, generated_at=datetime.now().isoformat(timespec="seconds"),
        coverage_meta=coverage_meta, progress=True,
        generator=generator, generator_label=args.generator, universe=args.universe,
        select_count=args.select_count, winner_universe=args.winner_universe)

    # provenance 스탬프 (additive) — adjudicator load_matrix가 두 필드를 요구.
    report["parameter_lock_commit_hash"] = PARAM_LOCK_COMMIT_HASH
    report["freeze_tag"] = FREEZE_TAG

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2))

    ga, gb, gc = report["gate_a"], report["gate_b"], report["gate_c"]
    print("\n=== Tier0 B++ 삼중 게이트 하버스트 결과 ===", file=sys.stderr)
    print(f"  months: {report['harvest']['months_analyzed']} · smoke={args.smoke}", file=sys.stderr)
    print(f"  Gate A (recall): {ga['verdict']} · overall={ga['overall_recall']} · random_ratio={ga['random_ratio']} · "
          f"largemid={ga['largemid_recall']} · baseline(bind)={ga['binding_baseline_recall']} · leaders={ga['leader_hits_total']}/{ga['leader_total']}",
          file=sys.stderr)
    print(f"  Gate B (IC):     {gb['verdict']} · ic_mean={gb.get('ic_mean')} · ic_ir={gb.get('ic_ir')} · "
          f"baseline_ir={gb.get('baseline_equal_ic_ir')}", file=sys.stderr)
    print(f"  Gate C (size):   {gc.get('verdict')} · dist={gc.get('dist')} · small={gc.get('small_fraction')}", file=sys.stderr)
    print(f"  TRIPLE GATE ALL PASS: {report['triple_gate_all_pass']}", file=sys.stderr)
    if not args.smoke and ga.get("fails"):
        print(f"  Gate A fails: {ga['fails']}", file=sys.stderr)
    if not args.smoke and gb.get("fails"):
        print(f"  Gate B fails: {gb['fails']}", file=sys.stderr)
    print(f"  report → {out_path}", file=sys.stderr)
    print("\n⚠️  삼중 게이트 ALL PASS + omxy 적대검토 전까지 --apply/Tier1/'상승 예측' claim 금지 (§5 step 5).",
          file=sys.stderr)


if __name__ == "__main__":
    main()
