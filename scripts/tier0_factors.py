#!/usr/bin/env python3
"""주픽(JooPick) — Tier 0 B++ 팩터/사이징/정규화 순수 로직 (D30, 77차 spec).

SoT: docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md

이 모듈은 **순수 함수**만 담는다 (KRX/DART/Supabase I/O 없음). screen_shortlist_tier0.py
(production 스크린)와 validate_tier0_ic.py (삼중 게이트 하버스트)가 **동일 팩터 정의**를
공유하도록 단일 소스로 분리한다 — current 스코어링과의 baseline 비교(§3D)도 같은 입력 위에서
이뤄져야 IC/recall이 의미를 갖는다.

B++ 설계 (§3 spec):
- §3A size sleeve: Large(top 20%) / Mid(next 40%) / Small-liquid(bottom 40%, 유동성 플로어 충족).
- §3B 유동성 플로어: ADV60(median 거래대금) + anti-pump(turnover/spike).
- §3C 시그널 재설계: winsorize+percentile rank, signed-log(fat-tail), 결측 tiering,
  risk-adjusted 멀티호라이즌 trend(12-1 skip 고정 21거래일), 52주 고가 근접도,
  foreign ADV 정규화, sector-relative quality, volume = trend 확인 시만 capped bonus(long 0).
- §3D rank ensemble (수기 가중치 폐기).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional, Sequence


# ============================================================================
# Constants (§3 spec — [assumption] markers는 §4 백테스트로 calibrate)
# ============================================================================

# 12-1 skip: 최근 1개월(≈21 거래일) 제외 — 단기 반전 오염 차단 (§3C, omxy LOW 단일값 고정).
SKIP_DAYS = 21

# 멀티호라이즌 trend lookback (거래일). short/mid/long bucket별 (§3C).
TREND_LOOKBACKS: dict[str, tuple[int, ...]] = {
    "short": (20, 60),
    "mid": (63, 126),
    "long": (126, 252),
}

HIGH_WINDOW_DAYS = 252  # 52주 고가 근접도 (long bucket leader 포착 시그널).
SPIKE_WINDOW_DAYS = 5   # 1~5D 단발 급등 penalty/anti-pump 창.
ADV_WINDOW_DAYS = 60    # ADV60 = 60거래일 median 거래대금.

# 유동성 플로어 [assumption — §4 calibrate]. omxy ₩20억 ~ Claude ₩5–10억 사이.
MIN_ADV_WON = 2_000_000_000.0

# size sleeve 쿼터 (horizon별) [assumption — §4 recall로 calibrate]. 전체 150 = L60/M60/S30.
SLEEVE_QUOTA: dict[str, int] = {"large": 20, "mid": 20, "small": 10}

# size tier 분할: Large = 시총 상위 20%, Mid = 다음 40%, Small = 하위 40%.
SIZE_TOP_FRACTION = 0.20
SIZE_MID_FRACTION = 0.40  # 누적 0.60까지 = mid의 상단.

# 결측 tiering (§3C): 구조적 결측 = neutral 50, fetch 실패 = penalty(하위 ~10%ile).
MISSING_STRUCTURAL_SCORE = 50.0
MISSING_FAILURE_SCORE = 5.0

# volume confirmation bonus 상한 (§3C — alpha driver 아님, capped).
VOLUME_BONUS_CAP = 10.0

# anti-pump turnover percentile 상위 컷 (§3B).
TURNOVER_TOP_PCT_CUT = 99.0


# ============================================================================
# §3C 정규화 — winsorize + percentile rank + signed-log
# ============================================================================

def _is_nan(x: object) -> bool:
    return isinstance(x, float) and math.isnan(x)


def _present(values: Sequence[float]) -> list[float]:
    return [v for v in values if not _is_nan(v)]


def quantile(sorted_vals: list[float], q: float) -> float:
    """선형보간 분위수 (numpy 'linear' 동등). sorted_vals는 오름차순, q∈[0,1]."""
    if not sorted_vals:
        return math.nan
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    pos = q * (len(sorted_vals) - 1)
    lo = math.floor(pos)
    hi = math.ceil(pos)
    if lo == hi:
        return sorted_vals[int(pos)]
    frac = pos - lo
    return sorted_vals[lo] * (1 - frac) + sorted_vals[hi] * frac


def winsorize(values: Sequence[float], lo: float = 0.01, hi: float = 0.99) -> list[float]:
    """[lo, hi] 분위수로 클램프. NaN은 통과. 극단치가 σ를 부풀려 나머지를 압축하는
    z-정규화 fat-tail 결함(§2.4)을 막는다."""
    present = sorted(_present(values))
    if len(present) < 2:
        return list(values)
    lo_v = quantile(present, lo)
    hi_v = quantile(present, hi)
    out: list[float] = []
    for v in values:
        if _is_nan(v):
            out.append(v)
        else:
            out.append(min(max(v, lo_v), hi_v))
    return out


def percentile_rank(values: Sequence[float]) -> list[float]:
    """cross-section percentile rank 0~100 (NaN 제외, 평균 순위 tie 처리).

    z-정규화 폐기(§3C). present 값만 순위 매기고 결측은 NaN 유지 → 결측 tiering이
    이후에 neutral/penalty를 채운다. 반환 = (avg_rank - 0.5)/n * 100 ∈ (0,100).
    """
    present_idx = [i for i, v in enumerate(values) if not _is_nan(v)]
    present_vals = [values[i] for i in present_idx]
    n = len(present_vals)
    out: list[float] = [math.nan] * len(values)
    if n == 0:
        return out
    if n == 1:
        out[present_idx[0]] = 50.0
        return out
    # 값 → 평균 순위 (1-based). ties = 평균.
    order = sorted(range(n), key=lambda k: present_vals[k])
    avg_rank = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and present_vals[order[j + 1]] == present_vals[order[i]]:
            j += 1
        # ranks i+1 .. j+1 (1-based) 평균
        r = (i + 1 + j + 1) / 2.0
        for k in range(i, j + 1):
            avg_rank[order[k]] = r
        i = j + 1
    for local, global_i in enumerate(present_idx):
        out[global_i] = (avg_rank[local] - 0.5) / n * 100.0
    return out


def signed_log(x: float) -> float:
    """sign(x)*log1p(|x|). fat-tail(거래량·외국인 won)을 percentile rank 전에 압축.

    NaN 통과. 부호 보존 (외국인 순매도 음수 정보 유지).
    """
    if _is_nan(x):
        return x
    return math.copysign(math.log1p(abs(x)), x)


def median(values: Sequence[float]) -> float:
    present = sorted(_present(values))
    if not present:
        return math.nan
    return quantile(present, 0.5)


def stdev_pop(values: Sequence[float]) -> float:
    """모집단 표준편차 (기존 screen 코드와 동일 convention: divide by n)."""
    present = _present(values)
    n = len(present)
    if n == 0:
        return math.nan
    mean = sum(present) / n
    var = sum((v - mean) ** 2 for v in present) / n
    return math.sqrt(var)


# ============================================================================
# §3C momentum 재설계 — risk-adjusted 멀티호라이즌 trend + 52주 고가
# ============================================================================

def daily_returns(closes: Sequence[float]) -> list[float]:
    """단순 일간 수익률 (오름차순 시계열)."""
    return [
        (closes[i] / closes[i - 1] - 1.0)
        for i in range(1, len(closes))
        if closes[i - 1] > 0
    ]


def risk_adjusted_trend(
    closes: Sequence[float], lookback: int, skip: int = SKIP_DAYS
) -> float:
    """위험조정 추세 = (lookback 누적수익률) / (해당 창 일간수익률 σ).

    closes = 오름차순 종가. 최근 `skip` 거래일을 제외(12-1)한 뒤 lookback 창의
    누적수익률을 그 창의 일간 변동성으로 나눈다. 지속 상승한 대형 주도주(방산·조선·원전)가
    close/MA60≈1.0로 구조적 배제되던 §2.1 결함을 직접 해소.

    데이터 부족(< lookback+skip+1) 또는 시작가≤0 → NaN.
    """
    need = lookback + skip + 1
    if len(closes) < need:
        return math.nan
    end = len(closes) - 1 - skip          # `skip` 거래일 전 가격 인덱스
    start = end - lookback
    if start < 0 or closes[start] <= 0 or closes[end] <= 0:
        return math.nan
    cum_ret = closes[end] / closes[start] - 1.0
    window = closes[start : end + 1]      # lookback+1 가격 → lookback 수익률
    rets = daily_returns(window)
    sigma = stdev_pop(rets)
    if _is_nan(sigma) or sigma <= 0:
        return math.nan
    return cum_ret / sigma


def high_proximity(series: Sequence[float], window: int = HIGH_WINDOW_DAYS) -> float:
    """52주(window 거래일) 고가 대비 현재 근접도 = last / max(window). ∈ (0,1].

    series = 종가 또는 일중 고가(TDD_HGPRC) 시계열(오름차순). 1.0에 가까울수록 신고가권.
    데이터 부족·비양수 → NaN.
    """
    if not series:
        return math.nan
    tail = [v for v in series[-window:] if v > 0]
    if not tail:
        return math.nan
    hi = max(tail)
    last = series[-1]
    if hi <= 0 or last <= 0:
        return math.nan
    return last / hi


def recent_return(closes: Sequence[float], window: int = SPIKE_WINDOW_DAYS) -> float:
    """최근 window 거래일 수익률 (1~5D 단발 급등/anti-pump 판정용). NaN if 부족."""
    if len(closes) < window + 1 or closes[-1 - window] <= 0:
        return math.nan
    return closes[-1] / closes[-1 - window] - 1.0


# ============================================================================
# §3B 유동성 플로어 — ADV60 + anti-pump
# ============================================================================

def adv60(trdvals: Sequence[float], window: int = ADV_WINDOW_DAYS) -> float:
    """ADV60 = 최근 window 거래일 거래대금(won) median. 데이터 부족 → 가용분 median."""
    tail = [v for v in trdvals[-window:] if not _is_nan(v) and v >= 0]
    if not tail:
        return math.nan
    return median(tail)


def turnover60(trdvals: Sequence[float], market_cap: float, window: int = ADV_WINDOW_DAYS) -> float:
    """ADV60 / 시총 = 회전율 프록시 (anti-pump). 시총≤0 → NaN."""
    a = adv60(trdvals, window)
    if _is_nan(a) or market_cap is None or market_cap <= 0:
        return math.nan
    return a / market_cap


def liquidity_floor_pass(adv_won: float, min_adv_won: float = MIN_ADV_WON) -> bool:
    """ADV60 ≥ floor 면 통과. NaN(데이터 없음) → 탈락(보수적)."""
    if _is_nan(adv_won):
        return False
    return adv_won >= min_adv_won


def anti_pump_penalty(
    turnover_pct: float, recent_5d_ret: float, *, turnover_top_cut: float = TURNOVER_TOP_PCT_CUT
) -> float:
    """단발 급등 펌프 penalty (0~). turnover percentile 상위컷 초과 + 최근 급등이면 가중.

    turnover_pct = cross-section turnover percentile(0~100). recent_5d_ret = 최근 5D 수익률.
    펌프 의심(고회전 + 단기 급등)일수록 큰 양수 penalty를 반환 → score에서 차감.
    """
    penalty = 0.0
    if not _is_nan(turnover_pct) and turnover_pct >= turnover_top_cut:
        penalty += 5.0
    if not _is_nan(recent_5d_ret) and recent_5d_ret > 0.25:  # 5일 +25% = 단발 급등 의심
        penalty += min(20.0, (recent_5d_ret - 0.25) * 40.0)
    return penalty


# ============================================================================
# §3A size sleeve — 시총 tier 분할 + sleeve 내부 경쟁
# ============================================================================

def size_breakpoints(
    market_caps: Sequence[float],
    top_fraction: float = SIZE_TOP_FRACTION,
    mid_fraction: float = SIZE_MID_FRACTION,
) -> tuple[float, float]:
    """시총 cross-section → (large_cut, mid_cut) 임계.

    large = 시총 상위 top_fraction · mid = 다음 mid_fraction · small = 나머지.
    large_cut = (1-top_fraction) 분위수, mid_cut = (1-top_fraction-mid_fraction) 분위수.
    """
    present = sorted(v for v in market_caps if not _is_nan(v) and v > 0)
    if not present:
        return (math.nan, math.nan)
    large_cut = quantile(present, 1.0 - top_fraction)
    mid_cut = quantile(present, 1.0 - top_fraction - mid_fraction)
    return (large_cut, mid_cut)


def size_tier(market_cap: float, large_cut: float, mid_cut: float) -> str:
    """시총 → 'large' | 'mid' | 'small'. 임계 NaN 또는 시총 결측 → 'small'(보수적)."""
    if _is_nan(market_cap) or market_cap is None or _is_nan(large_cut) or _is_nan(mid_cut):
        return "small"
    if market_cap >= large_cut:
        return "large"
    if market_cap >= mid_cut:
        return "mid"
    return "small"


# ============================================================================
# §3C sector-relative rank + 결측 tiering
# ============================================================================

def within_group_percentile_rank(
    values: Sequence[float], groups: Sequence[str]
) -> list[float]:
    """업종(group) 내부에서만 percentile rank (§3C quality·earnings).

    금융/제조/바이오를 cross-universe로 비교하지 않는다 — 같은 sector 내 순위.
    그룹 크기 1이면 50.0 (중립). NaN 통과.
    """
    if len(values) != len(groups):
        raise ValueError("values와 groups 길이가 다릅니다")
    out: list[float] = [math.nan] * len(values)
    by_group: dict[str, list[int]] = {}
    for i, g in enumerate(groups):
        by_group.setdefault(g, []).append(i)
    for _g, idxs in by_group.items():
        sub = percentile_rank([values[i] for i in idxs])
        for local, gi in enumerate(idxs):
            out[gi] = sub[local]
    return out


def fill_missing_rank(
    ranks: Sequence[float],
    failure_mask: Optional[Sequence[bool]] = None,
    structural_default: float = MISSING_STRUCTURAL_SCORE,
    failure_default: float = MISSING_FAILURE_SCORE,
) -> list[float]:
    """결측 tiering (§3C): 0주입 폐기.

    - rank가 NaN이고 failure_mask[i]=True (ticker-specific fetch 실패) → penalty(failure_default).
    - rank가 NaN이고 failure_mask[i]=False/None (구조적 결측: 신규상장·미공시) → neutral(structural_default).
    - rank present → 그대로.
    long bucket이 "공시 있는 종목"만 뽑던 구조적 selection(§2.3)을 차단한다.
    """
    out: list[float] = []
    for i, r in enumerate(ranks):
        if not _is_nan(r):
            out.append(r)
            continue
        is_failure = bool(failure_mask[i]) if failure_mask is not None else False
        out.append(failure_default if is_failure else structural_default)
    return out


# ============================================================================
# §3C foreign — ADV 정규화 + 대형 sponsorship 보조
# ============================================================================

def foreign_adv_normalized(foreign_net_won: float, adv_won: float) -> float:
    """외국인 순매수(60D won) / ADV60(won) = 거래대금 대비 강도 (size bias 제거 §3C).

    WON 절대합이 시총 프록시가 되던 §2.5 결함 해소. ADV≤0/NaN → NaN.
    """
    if _is_nan(foreign_net_won) or _is_nan(adv_won) or adv_won <= 0:
        return math.nan
    return foreign_net_won / adv_won


# ============================================================================
# §3D rank ensemble (수기 가중치 폐기)
# ============================================================================

def rank_ensemble_score(
    factor_ranks: dict[str, float],
    volume_bonus: float = 0.0,
    penalty: float = 0.0,
) -> float:
    """score = mean(가용 factor rank) + capped volume bonus − penalty.

    수기 가중치(0.40/0.30/…) 폐기(§3D). 모든 factor를 동등 rank 평균. 결측(NaN) factor는
    평균에서 제외(이미 fill_missing_rank로 채워졌다면 NaN 없음). 전 factor 결측 → NaN.
    """
    present = [v for v in factor_ranks.values() if not _is_nan(v)]
    if not present:
        return math.nan
    base = sum(present) / len(present)
    bonus = max(0.0, min(VOLUME_BONUS_CAP, volume_bonus))
    return base + bonus - max(0.0, penalty)


def capped_volume_bonus(
    volume_surge_rank: float, trend_rank: float, *, cap: float = VOLUME_BONUS_CAP,
    long_bucket: bool = False,
) -> float:
    """volume = trend 확인 시에만 capped confirmation bonus (§3C). long_bucket → 0.

    추세 동반 거래(축적)면 bonus, 단발 급등(추세 미확인)이면 0. long bucket volume bonus=0.
    """
    if long_bucket or _is_nan(volume_surge_rank) or _is_nan(trend_rank):
        return 0.0
    if trend_rank < 50.0:  # 추세 미확인 → confirmation 아님
        return 0.0
    # volume rank가 높을수록(축적) + trend 확인 → cap까지 선형 bonus.
    # volume rank<50(추세는 확인됐으나 거래 미동반)이면 bonus 0 (source clamp — 음수 반환 금지).
    return max(0.0, min(cap, (volume_surge_rank - 50.0) / 50.0 * cap))


# ============================================================================
# §3A sleeve 선정 — 쿼터 충족 + shortfall 시 무음 truncation 금지
# ============================================================================

class SleeveShortfallError(RuntimeError):
    """sleeve 쿼터를 backfill 후에도 못 채움 → 무음 완화 금지, report 후 중단 (§3A)."""


def select_size_sleeves(
    tickers: Sequence[str],
    scores: Sequence[float],
    sleeves: Sequence[str],
    quota: dict[str, int] = SLEEVE_QUOTA,
    *,
    exclude: Optional[set[str]] = None,
    backfill: bool = True,
) -> list[str]:
    """size sleeve별 쿼터만큼 score 상위 종목 선정 (§3A recall-first 퍼널).

    각 sleeve 내부 cross-sectional rank 경쟁 — 대형 주도주가 소형 로켓과 직접 경쟁하지 않음.
    tie-break = score desc, ticker asc (결정론, TS computeTier0Ranks localeCompare 정합).
    backfill=True면 쿼터 미달 sleeve를 다른 sleeve 잉여로 채우되 — 그래도 총량 미달이면
    SleeveShortfallError (무음 truncation 금지 §3A).

    Returns: 선정된 ticker 리스트 (sleeve 순서 large→mid→small, 내부 score desc).
    """
    if not (len(tickers) == len(scores) == len(sleeves)):
        raise ValueError("tickers/scores/sleeves 길이가 다릅니다")
    exclude = exclude or set()
    by_sleeve: dict[str, list[tuple[str, float]]] = {k: [] for k in quota}
    for t, sc, sl in zip(tickers, scores, sleeves):
        if t in exclude or _is_nan(sc):
            continue
        if sl in by_sleeve:
            by_sleeve[sl].append((t, sc))
    for sl in by_sleeve:
        by_sleeve[sl].sort(key=lambda ts: (-ts[1], ts[0]))

    picked: list[str] = []
    used: set[str] = set(exclude)
    shortfall: dict[str, int] = {}
    leftover: list[tuple[str, float]] = []
    for sl, want in quota.items():
        pool = by_sleeve.get(sl, [])
        take = [t for t, _ in pool[:want]]
        for t in take:
            picked.append(t)
            used.add(t)
        if len(take) < want:
            shortfall[sl] = want - len(take)
        # 잉여(쿼터 초과분)는 backfill 후보로 보관
        leftover.extend((t, sc) for t, sc in pool[want:] if t not in used)

    total_short = sum(shortfall.values())
    if total_short > 0:
        if not backfill:
            raise SleeveShortfallError(
                f"sleeve 쿼터 미달 (backfill 비활성): {shortfall}. universe를 늘리거나 쿼터를 재검토하세요."
            )
        leftover.sort(key=lambda ts: (-ts[1], ts[0]))
        for t, _sc in leftover:
            if total_short <= 0:
                break
            if t in used:
                continue
            picked.append(t)
            used.add(t)
            total_short -= 1
        if total_short > 0:
            raise SleeveShortfallError(
                f"sleeve 쿼터를 backfill 후에도 채우지 못함: 남은 부족 {total_short}, 부족 sleeve {shortfall}. "
                f"무음 완화 금지(§3A) — universe/유동성 플로어/쿼터 재검토 필요."
            )
    return picked


# ============================================================================
# §3C 상관 진단
# ============================================================================

def pairwise_correlation(
    factor_values: dict[str, Sequence[float]]
) -> dict[tuple[str, str], float]:
    """factor 쌍별 Pearson 상관 (둘 다 present인 종목만). trend-momentum >0.8 이면
    단일 factor로 통합 권고(§3C 이중계산 방지). 진단 출력 전용."""
    names = list(factor_values.keys())
    out: dict[tuple[str, str], float] = {}
    for a in range(len(names)):
        for b in range(a + 1, len(names)):
            na, nb = names[a], names[b]
            xs, ys = [], []
            va, vb = factor_values[na], factor_values[nb]
            for i in range(min(len(va), len(vb))):
                if not _is_nan(va[i]) and not _is_nan(vb[i]):
                    xs.append(va[i])
                    ys.append(vb[i])
            out[(na, nb)] = _pearson(xs, ys)
    return out


def _pearson(xs: list[float], ys: list[float]) -> float:
    n = len(xs)
    if n < 2:
        return math.nan
    mx = sum(xs) / n
    my = sum(ys) / n
    cov = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
    vx = sum((x - mx) ** 2 for x in xs)
    vy = sum((y - my) ** 2 for y in ys)
    if vx <= 0 or vy <= 0:
        return math.nan
    return cov / math.sqrt(vx * vy)


def spearman_ic(scores: Sequence[float], forward_returns: Sequence[float]) -> float:
    """Spearman rank IC = score rank와 forward return rank의 Pearson 상관 (§4 Gate B).

    둘 다 present인 종목만. n<3 → NaN. Alphalens식 cross-sectional IC.
    """
    xs, ys = [], []
    for i in range(min(len(scores), len(forward_returns))):
        if not _is_nan(scores[i]) and not _is_nan(forward_returns[i]):
            xs.append(scores[i])
            ys.append(forward_returns[i])
    if len(xs) < 3:
        return math.nan
    rx = percentile_rank(xs)
    ry = percentile_rank(ys)
    return _pearson(rx, ry)


# ============================================================================
# 공유 B++ cross-section scorer — screen + validate 하버스트 단일 소스 (§3 전체)
# ============================================================================

@dataclass
class StockRaw:
    """한 종목의 raw 입력 (PIT 시점 t 기준). screen/harness 공통.

    closes/highs/trdvals = 오름차순 시계열(t에서 끝). 결측 시그널은 NaN + *_fetch_failed로
    구조적 결측(neutral 50)과 fetch 실패(penalty)를 구분(§3C).
    """
    ticker: str
    sector: str
    market_cap: float
    closes: Sequence[float]
    trdvals: Sequence[float]                       # ACC_TRDVAL (won)
    highs: Optional[Sequence[float]] = None        # TDD_HGPRC; None이면 closes 사용
    foreign_net_60d: float = math.nan              # won, 60D 합
    foreign_fetch_failed: bool = False
    earnings_raw: float = math.nan                 # DART YoY; 결측 NaN
    earnings_fetch_failed: bool = False
    quality_composite_raw: float = math.nan        # DART quality composite; 결측 NaN
    quality_fetch_failed: bool = False


@dataclass
class ScoredStock:
    ticker: str
    sector: str
    market_cap: float
    sleeve: str                  # large/mid/small
    score: float                 # rank ensemble (NaN = 결측 과다)
    adv60: float
    factor_ranks: dict[str, float] = field(default_factory=dict)
    volume_bonus: float = 0.0
    penalty: float = 0.0
    eligible: bool = True        # 유동성 플로어 통과 여부


def _combine_ranks(rank_lists: list[list[float]]) -> list[float]:
    """여러 component rank 리스트를 종목별 평균(가용분만). 전부 NaN → NaN."""
    n = len(rank_lists[0]) if rank_lists else 0
    out: list[float] = []
    for i in range(n):
        present = [rl[i] for rl in rank_lists if not _is_nan(rl[i])]
        out.append(sum(present) / len(present) if present else math.nan)
    return out


def _rank_of(raw: Sequence[float]) -> list[float]:
    """winsorize → percentile rank (§3C 정규화 파이프라인).

    NOTE(적대검토 LOW): percentile rank는 단조변환 불변이라 winsorize는 rank를 바꾸지 않는다
    (극단치 magnitude만 클램프). 본 파이프라인의 실질 fat-tail 방어는 **percentile rank 자체 +
    (volume/foreign의) signed_log**다. winsorize는 §3C 문구 정합 + raw 값을 그대로 쓰는 다른 통계
    (decile_spread 등)와의 일관성을 위해 유지하되, rank 단계에선 no-op임을 명시한다."""
    return percentile_rank(winsorize(raw))


def score_bpp_universe(
    stocks: Sequence[StockRaw],
    bucket: str,
    *,
    min_adv_won: float = MIN_ADV_WON,
) -> list[ScoredStock]:
    """B++ 전체 cross-section 스코어링 (§3A~3D). 한 horizon(bucket)에 대해 1회.

    1. 유동성 플로어(§3B): ADV60 ≥ floor 종목만 eligible. 비eligible은 score=NaN/eligible=False.
    2. size sleeve(§3A): eligible 시총으로 breakpoint → large/mid/small.
    3. 시그널(§3C): risk-adj trend(bucket lookbacks; long은 52주 고가 결합) + foreign(ADV 정규화,
       large/mid sponsorship 병용) + earnings(sector-relative) + quality(sector-relative).
       모두 winsorize+percentile rank, 결측 tiering.
    4. score(§3D): rank ensemble + capped volume bonus(long 0) − anti-pump penalty.

    Returns: 입력 순서 유지 ScoredStock 리스트(비eligible 포함, score=NaN).
    """
    if bucket not in TREND_LOOKBACKS:
        raise ValueError(f"알 수 없는 bucket: {bucket}")
    n = len(stocks)
    is_long = bucket == "long"

    advs = [adv60(s.trdvals) for s in stocks]
    eligible = [liquidity_floor_pass(a, min_adv_won) for a in advs]

    # size sleeve — eligible 시총으로만 breakpoint 산정(§3A).
    elig_caps = [stocks[i].market_cap for i in range(n) if eligible[i]]
    large_cut, mid_cut = size_breakpoints(elig_caps)
    sleeves = [
        size_tier(stocks[i].market_cap, large_cut, mid_cut) if eligible[i] else "small"
        for i in range(n)
    ]

    def elig_mask(values: list[float]) -> list[float]:
        return [values[i] if eligible[i] else math.nan for i in range(n)]

    # --- trend (§3C) ---
    trend_components: list[list[float]] = []
    for lb in TREND_LOOKBACKS[bucket]:
        raw = [risk_adjusted_trend(s.closes, lb) for s in stocks]
        trend_components.append(_rank_of(elig_mask(raw)))
    if is_long:
        prox_raw = [high_proximity(s.highs if s.highs is not None else s.closes) for s in stocks]
        trend_components.append(_rank_of(elig_mask(prox_raw)))
    trend_rank = _combine_ranks(trend_components)

    # --- foreign (§3C: ADV 정규화 + large/mid sponsorship 병용) ---
    fadv_raw = [signed_log(foreign_adv_normalized(s.foreign_net_60d, advs[i])) for i, s in enumerate(stocks)]
    fadv_rank = _rank_of(elig_mask(fadv_raw))
    spons_raw = [signed_log(s.foreign_net_60d) for s in stocks]
    spons_rank = _rank_of(elig_mask(spons_raw))
    foreign_fail = [s.foreign_fetch_failed for s in stocks]
    foreign_rank: list[float] = []
    for i in range(n):
        if sleeves[i] in ("large", "mid"):
            comps = [v for v in (fadv_rank[i], spons_rank[i]) if not _is_nan(v)]
            foreign_rank.append(sum(comps) / len(comps) if comps else math.nan)
        else:
            foreign_rank.append(fadv_rank[i])
    foreign_rank = fill_missing_rank(foreign_rank, failure_mask=foreign_fail)

    # --- earnings / quality (§3C sector-relative + 결측 tiering) ---
    sectors = [s.sector for s in stocks]
    earn_raw = elig_mask([s.earnings_raw for s in stocks])
    earn_rank = within_group_percentile_rank(earn_raw, sectors)
    earn_rank = fill_missing_rank(earn_rank, failure_mask=[s.earnings_fetch_failed for s in stocks])
    qual_raw = elig_mask([s.quality_composite_raw for s in stocks])
    qual_rank = within_group_percentile_rank(qual_raw, sectors)
    qual_rank = fill_missing_rank(qual_rank, failure_mask=[s.quality_fetch_failed for s in stocks])

    # --- volume confirmation bonus (§3C, long 0) ---
    vol_surge_raw = [_volume_surge(s.trdvals) for s in stocks]
    vol_rank = _rank_of(elig_mask(vol_surge_raw))

    # --- anti-pump penalty (§3B) ---
    turn_raw = [turnover60(s.trdvals, s.market_cap) for s in stocks]
    turn_pct = _rank_of(elig_mask(turn_raw))
    recent5 = [recent_return(s.closes) for s in stocks]

    out: list[ScoredStock] = []
    for i, s in enumerate(stocks):
        if not eligible[i]:
            out.append(ScoredStock(s.ticker, s.sector, s.market_cap, "small", math.nan,
                                    advs[i], eligible=False))
            continue
        ranks = {
            "trend": trend_rank[i],
            "foreign": foreign_rank[i],
            "earnings": earn_rank[i],
            "quality": qual_rank[i],
        }
        bonus = capped_volume_bonus(vol_rank[i], trend_rank[i], long_bucket=is_long)
        penalty = anti_pump_penalty(turn_pct[i], recent5[i])
        score = rank_ensemble_score(ranks, volume_bonus=bonus, penalty=penalty)
        out.append(ScoredStock(
            ticker=s.ticker, sector=s.sector, market_cap=s.market_cap,
            sleeve=sleeves[i], score=score, adv60=advs[i],
            factor_ranks=ranks, volume_bonus=bonus, penalty=penalty, eligible=True,
        ))
    return out


def _volume_surge(trdvals: Sequence[float], short: int = 5, long: int = 60) -> float:
    """거래대금 급증 = MA5 / MA60 − 1 (confirmation 전용). 데이터 부족 → NaN."""
    tail_long = [v for v in trdvals[-long:] if not _is_nan(v)]
    tail_short = [v for v in trdvals[-short:] if not _is_nan(v)]
    if len(tail_long) < long or len(tail_short) < short:
        return math.nan
    ml = sum(tail_long) / len(tail_long)
    ms = sum(tail_short) / len(tail_short)
    if ml <= 0:
        return math.nan
    return ms / ml - 1.0
