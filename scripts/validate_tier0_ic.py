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
            e = series.setdefault(tk, {"dates": [], "closes": [], "highs": [], "trdvals": [], "mktcap": []})
            e["dates"].append(d)
            e["closes"].append(row.close)
            e["highs"].append(row.high)
            e["trdvals"].append(row.trdval)
            e["mktcap"].append(row.mktcap)
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
    selection_perf: dict = field(default_factory=dict)  # horizon별 픽 실현수익률 (selection_performance)


def process_month(
    t: date, panel: Panel, dates: Sequence[str], series: dict[str, dict],
    universe_rows: Sequence[dict], *, foreign_at, dart_at, prior_factor_ic: dict[str, float],
    leader_basket: dict[str, str],
) -> Optional[MonthResult]:
    """한 선정월의 선정 + forward + Gate A/B 월별 메트릭. 패널/universe 부족 시 None."""
    sel_idx = selection_index(dates, t)
    if sel_idx < 0:
        return None
    sel_date = dates[sel_idx]
    sel_date_obj = datetime.strptime(sel_date, "%Y%m%d").date()  # 실제 패널 거래일 (공휴일 인지)
    stocks, name_by, qmeta = build_month_stockraws(
        sel_date_obj, series, sel_date, universe_rows, foreign_at=foreign_at, dart_at=dart_at)
    if not stocks:
        return None
    tickers = [s.ticker for s in stocks]
    n_eligible = sum(1 for s in stocks if F.liquidity_floor_pass(F.adv60(s.trdvals)))

    fwd, status = compute_month_forward(panel, dates, tickers, sel_idx)
    winners_by_h = {h: top_decile_winners(fwd[h]) for h in HARVEST_BUCKETS}
    winners_all: set[str] = set().union(*winners_by_h.values()) if winners_by_h else set()
    insufficient = [h for h in HARVEST_BUCKETS if not fwd[h]]  # horizon별 forward 전무 = 데이터 부족

    sel = select_bpp_for_harvest(stocks)
    selected_by_h = {b: {sc.ticker for sc in sel[b][1]} for b in HARVEST_BUCKETS}
    selected_all: set[str] = set().union(*selected_by_h.values())
    tier_of = canonical_size_tiers(stocks)
    largemid_winners = {tk for tk in winners_all if tier_of.get(tk) in ("large", "mid")}
    largemid_selected = {tk for tk in selected_all if tier_of.get(tk) in ("large", "mid")}

    # selected 150 sleeve/score/mcap (Gate C entry-month). sleeve = 선정 시점 ScoredStock.sleeve.
    selected_sleeve, selected_score, selected_mcap = {}, {}, {}
    for b in HARVEST_BUCKETS:
        for sc in sel[b][1]:
            selected_sleeve[sc.ticker] = sc.sleeve
            selected_score[sc.ticker] = sc.score
            selected_mcap[sc.ticker] = sc.market_cap

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
    legacy_by_h = _select_by_horizon(
        lambda ss, b: {s.ticker: legacy_momentum_proxy_score(s, b) for s in ss}, stocks)
    baseline_current = set().union(*[set(v) for v in legacy_by_h.values()]) if legacy_by_h else set()
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
        # 벤치마크 + sleeve 평균 = B++ scored eligible universe (선정 sleeve 기준, 일관)
        elig_ret = [fwd_h[sc.ticker] for sc in scored_h if sc.eligible and sc.ticker in fwd_h]
        eqw_mean = (sum(elig_ret) / len(elig_ret)) if elig_ret else math.nan
        sleeve_ret: dict[str, list[float]] = {"large": [], "mid": [], "small": []}
        for sc in scored_h:
            if sc.eligible and sc.ticker in fwd_h:
                sleeve_ret.setdefault(sc.sleeve, []).append(fwd_h[sc.ticker])
        sleeve_mean = {s: (sum(v) / len(v) if v else math.nan) for s, v in sleeve_ret.items()}
        bpp_ret, bpp_sleeve_exc = [], []
        for sc in ranked_h:  # 실제 선정 픽(ScoredStock) — 각 픽의 실제 선정 sleeve로 벤치마크
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
    )


def _pooled_recall(num: int, den: int) -> float:
    return (num / den) if den > 0 else math.nan


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


def _select_by_horizon(score_fn, stocks: Sequence[F.StockRaw], pool: int = 50) -> dict[str, list[str]]:
    """bucket별 score 상위 pool개, cross-bucket disjoint → {bucket: [ticker]} (select_bpp 정합).

    선정-종목 수익률 비교(selection_performance)에서 B++ 픽과 동일 규칙으로 baseline 픽을 뽑기 위함.
    """
    used: set[str] = set()
    out: dict[str, list[str]] = {}
    for b in HARVEST_BUCKETS:
        scores = score_fn(stocks, b)
        ranked = sorted(((tk, sc) for tk, sc in scores.items() if not _is_nan(sc)), key=lambda x: (-x[1], x[0]))
        picks: list[str] = []
        for tk, _sc in ranked:
            if tk in used:
                continue
            picks.append(tk)
            used.add(tk)
            if len(picks) >= pool:
                break
        out[b] = picks
    return out


def aggregate_harvest(
    results: Sequence[MonthResult], *, smoke: bool, generated_at: str,
    coverage_meta: dict, survivorship_label: str, leader_basket_size: int = len(LEADER_BASKET_2026_06),
) -> dict:
    """월별 MonthResult → 삼중 게이트 verdict + per-month + CI + 데이터품질 리포트 (§4·§9)."""
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
    if smoke:
        gate_a_verdict, gate_a_fails = ("SMOKE", ["smoke: 임계 미적용(metrics-only)"])
    else:
        ok_a, fails_a = gate_a_pass(rep_a)
        gate_a_verdict, gate_a_fails = ("PASS" if ok_a else "FAIL"), fails_a

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
            "score_logmcap_corr": entry_c["score_logmcap_corr"],
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

    return {
        "version": "bpp-step2-harvest-1",
        "generated_at": generated_at,
        "harvest": {
            "months_analyzed": n,
            "months": [r.month for r in res],
            "smoke": smoke,
            "forward_insufficient_by_month": {r.month: r.forward_insufficient_horizons for r in res if r.forward_insufficient_horizons},
        },
        "gate_a": {
            "verdict": gate_a_verdict, "fails": gate_a_fails,
            "overall_recall": overall, "random_baseline": random_baseline, "random_ratio": random_ratio,
            "per_horizon": per_h, "largemid_recall": largemid_recall, "largemid_vs_overall": largemid_vs_overall,
            "baseline_legacy_momentum_proxy_recall": baseline_current_recall,  # close/MA60 proxy, NOT 73차 incumbent
            "baseline_equal_recall": baseline_equal_recall,
            "binding_baseline_recall": binding_baseline_recall,
            "leader_hits_total": leader_hits_total, "leader_total": leader_basket_size * n,
            "leader_per_month": {r.month: r.leader_in_selected for r in res},
            "recall_ci90": _ci90([_pooled_recall(len(r.selected_all & r.winners_all), len(r.winners_all)) for r in res]),
            "per_month": [
                {"month": r.month, "n_universe": r.n_universe, "n_eligible": r.n_eligible,
                 "n_winners": len(r.winners_all),
                 "recall": _pooled_recall(len(r.selected_all & r.winners_all), len(r.winners_all)),
                 "largemid_recall": _pooled_recall(len(r.largemid_selected & r.largemid_winners), len(r.largemid_winners)),
                 "leader_hits": len(r.leader_in_selected)} for r in res],
        },
        "gate_b": {
            "verdict": gate_b_verdict, "fails": gate_b_fails, **gate_b_metrics,
            "baseline_equal_ic_ir": baseline_equal_ir,
            "ic_ir_ci90": _ci90(monthly_ics),
            "monthly": [{"month": r.month, "composite_ic": r.composite_ic, "sleeve_ic": r.sleeve_ic,
                         "spread": r.spread, "top_tercile_ic": r.top_tercile_ic,
                         "baseline_equal_ic": r.baseline_equal_ic,
                         "baseline_ic_weighted_ic": r.baseline_ic_weighted_ic} for r in res],
        },
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


def harvest_pit_months(
    start_month: date, end_month: date, panel: Panel, *,
    universe_at: Callable[[date], list[dict]],
    foreign_at: Callable[[str, date], tuple[float, bool]],
    dart_at: Callable[[str, date], object],
    smoke: bool = False, leader_basket: dict[str, str] = LEADER_BASKET_2026_06,
    generated_at: str = "", coverage_meta: Optional[dict] = None,
    progress: bool = False,
) -> dict:
    """월 반복 PIT 하버스트 오케스트레이터 (§5 step 2). 순수 — 모든 I/O는 주입 provider/panel.

    panel = load_pit_panel 출력(실행 시) 또는 테스트 fake. universe_at(t)/foreign_at(tk,t)/dart_at(tk,t).
    forward 데이터 부족 월(end_month + 6M이 미래)은 horizon별 insufficient로 보고(무음 통과 금지).
    """
    dates = panel_trading_days(panel)
    if len(dates) < 2:
        raise RuntimeError("panel 거래일이 부족합니다 (≥2 필요).")
    series = build_series_by_ticker(panel, dates)
    months = iter_selection_months(start_month, end_month)
    results: list[MonthResult] = []
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
                           prior_factor_ic=dict(prior_factor_ic), leader_basket=leader_basket)
        if r is None:
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
        raise RuntimeError("처리된 선정월이 0개입니다 (universe/패널/forward 데이터 확인).")
    return aggregate_harvest(results, smoke=smoke, generated_at=generated_at,
                             coverage_meta=coverage_meta or {},
                             survivorship_label="clean (KRX bydd_trd=PIT, step-0 probe PASS)",
                             leader_basket_size=len(leader_basket))


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
                          with_earnings: bool = False, dart_backfill_path: Optional[str] = None):
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
    live_client = S.get_supabase_client() if dart_key else None
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
    args = parser.parse_args()

    _load_env()

    # forward-data 가드: end_month + 6M(long horizon)이 미래면 마지막 월들의 long forward 부재 → 경고.
    six_months_ago = date.today() - timedelta(days=183)
    if args.end_month > six_months_ago and not args.smoke:
        print(f"[warn] end-month {args.end_month} + 6M(long)이 today({date.today()})를 넘습니다 — "
              f"후반 월의 long horizon forward 데이터 부재 → insufficient로 제외 보고됩니다. "
              f"완전한 6M forward를 원하면 end-month ≤ {six_months_ago.replace(day=1)} 권장.", file=sys.stderr)

    panel, universe_at, foreign_at, dart_at, coverage_meta = _build_real_providers(
        args.start_month, args.end_month, Path(args.cache_dir), args.universe_limit, args.with_foreign,
        with_earnings=args.earnings, dart_backfill_path=args.dart_backfill_path)

    report = harvest_pit_months(
        args.start_month, args.end_month, panel,
        universe_at=universe_at, foreign_at=foreign_at, dart_at=dart_at,
        smoke=args.smoke, generated_at=datetime.now().isoformat(timespec="seconds"),
        coverage_meta=coverage_meta, progress=True)

    out_path = Path(args.out)
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
