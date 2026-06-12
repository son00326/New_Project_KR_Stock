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

import json
import math
import os
import sys
from dataclasses import dataclass, field
from datetime import date, timedelta
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

def legacy_manual_weight_score(stock: F.StockRaw, bucket: str) -> float:
    """current 스코어링 근사 baseline: close/MA60 모멘텀 + MA5/MA60 거래량 + 수기 가중치.

    foreign/earnings/quality는 raw 그대로(정규화 전 비교용 단순 baseline). recall/IC가 B++ 대비
    얼마나 단순 baseline을 이기는지 보기 위함(§4). 완전 동치는 아님(정규화는 cross-section에서).
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

    legacy_manual_weight_score(close/MA60 momentum-only)보다 강한 control — B++가 size-sleeve·foreign·
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
# CLI driver (실 provider wiring — 장시간/게이트 step 2)
# ============================================================================

def _load_env() -> None:
    env = Path("/Users/yong/New_Project_KR_Stock/tudal/.env.local")
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


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Tier 0 B++ 삼중 게이트 하버스트 (§4)")
    parser.add_argument("--start-month", required=True, help="YYYY-MM-01 (PIT 첫 선정월)")
    parser.add_argument("--end-month", required=True, help="YYYY-MM-01 (마지막 선정월)")
    parser.add_argument("--cache-dir", default="scripts/out/pit_cache", help="bydd_trd 캐시 디렉토리")
    parser.add_argument("--out", default="scripts/out/tier0_ic_report.json", help="게이트 리포트 JSON")
    parser.add_argument("--smoke", action="store_true",
                        help="패널/포워드 로직 smoke (소수 월·universe-limit, 게이트 임계 미적용)")
    parser.add_argument("--universe-limit", type=int, default=None)
    args = parser.parse_args()

    _load_env()
    print(
        "NOT A GATE YET (step-2): 실 PIT 하버스트/삼중 게이트 집계는 아직 비활성입니다. "
        "--apply/Tier1 판단에 사용하지 마세요.",
        file=sys.stderr,
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
