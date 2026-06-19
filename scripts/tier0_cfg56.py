#!/usr/bin/env python3
"""주픽(JooPick) — Tier 0 EXPLORATORY 후보 생성기 cfg5/cfg6/cfg7 (D30 후속, 2026-06-17).

⚠️ EXPLORATORY / DIAGNOSTIC ONLY. SoT addendum:
   docs/superpowers/2026-06-17-tier0-cfg5-cfg6-exploratory-addendum.md

이 모듈은 **순수 후보 생성기**만 담는다 (I/O 없음). frozen 측정 경로
(validate_tier0_ic.py::process_month/aggregate_harvest + tier0_factors.score_bpp_universe)는
**한 줄도 바꾸지 않는다**. 이 생성 변형들은 select_bpp_for_harvest와 **완전히 동일한 반환 shape**
({bucket: (scored_universe, selected_ranked)})를 내보내, frozen 게이트가 변경 없이 측정한다.

진단 목적(Claude↔omxy CONVERGED Round 2): frozen 19개월 삼중게이트가 4 factor-config × 3 regime
전부 FAIL(max recall 0.112)했다. binding recall 실패가 **단일-복합 AGGREGATION** 결함인지
**SIGNAL 부족**인지 구분하려고 생성 변형을 추가한다:

- cfg5 = REGIME / LEADING-SECTOR TILT: PIT-safe TRAILING 창(선정일 직전, 명시 lag)으로 coarse 시장
  regime + 선두 섹터를 산출 → 선두 섹터 후보 score에 additive bump. 단, **size sleeve(§3A) 안에서만**
  순위를 재배열한다 — select_size_sleeves가 20/20/10 쿼터를 강제하므로 Gate C size dist는 구조적으로
  보존되고, 섹터 cherry-pick으로 퇴화하지 않는다.
- cfg6 = MULTI-NET UNION: K개 사전등록 스크린의 top-N UNION → 최종 CAP=150으로 downselect(>150 아님).
  K/스크린/N/dedupe/tie-break/cap/쿼터/no-retry를 코드+doc에 FREEZE. (omxy 정정: 150 cap 때문에
  union>150이면 downselect가 강제되어 recall이 best member 미만으로 떨어질 수 있다 — cfg6는 recall
  향상을 보장하지 않으며, aggregation-vs-signal 질문에 답하려고 존재한다.)
- cfg7 = DAILY SURGE PROXY: offline daily surge/momentum/liquidity-control 진단. prism 복제가 아니라
  daily signal이 future-winner recall을 liquidity baseline보다 일찍 surfacing하는지 확인한다.

모든 생성 변형은 tier0_factors의 size-sleeve primitive(score_bpp_universe + select_size_sleeves +
SLEEVE_QUOTA)를 **그대로 재사용**한다(편집 금지) → Gate C size 분포 메커니즘 동일 보장.
"""
from __future__ import annotations

import math
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Optional, Sequence

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

if TYPE_CHECKING:
    from scripts import tier0_factors as F
else:
    if "tier0_factors" in sys.modules:
        F = sys.modules["tier0_factors"]
        sys.modules.setdefault("scripts.tier0_factors", F)
    else:
        from scripts import tier0_factors as F
        sys.modules.setdefault("tier0_factors", F)

HARVEST_BUCKETS = ("short", "mid", "long")
HarvestSelection = dict[str, tuple[list[F.ScoredStock], list[F.ScoredStock]]]


# ============================================================================
# cfg5 — REGIME / LEADING-SECTOR TILT (사전등록·동결 파라미터)
# ============================================================================

# PIT-safe trailing 창: 선정일 시계열의 **마지막 CFG5_TREND_LAG 거래일을 제외**한 뒤
# (명시 lag, 단기 반전·look-ahead 차단) CFG5_TREND_WINDOW 거래일 trailing 수익률로 섹터
# 모멘텀을 잰다. **forward/same-month return은 절대 쓰지 않는다.**
CFG5_TREND_LAG = F.SKIP_DAYS            # 21 — 12-1 skip과 동일 lag (frozen 재사용).
CFG5_TREND_WINDOW = 126                 # ~6개월 trailing 섹터 모멘텀 창 [frozen].

# 선두 섹터 정의: trailing 섹터-평균 수익률 상위 CFG5_LEADING_FRACTION 섹터 [frozen].
CFG5_LEADING_FRACTION = 0.30
CFG5_MIN_SECTOR_SIZE = 3                # 섹터 평균 산출 최소 종목 수 [frozen].

# 선두 섹터 score 가산 bump (rank 0~100 척도; sleeve 내부 재배열만 유도) [frozen].
CFG5_SECTOR_BUMP = 8.0


def _sector_trailing_momentum(stocks: Sequence[F.StockRaw]) -> dict[str, float]:
    """섹터별 trailing 모멘텀 (PIT-safe: 마지막 CFG5_TREND_LAG 거래일 제외).

    각 종목의 closes(선정일 t에서 끝)에서 [t-lag-window, t-lag] 구간 누적수익률을 구하고,
    섹터별 평균(min size 충족 시)을 반환한다. forward 가격은 슬라이스에 없으므로 구조적으로
    look-ahead 불가능. 데이터 부족 종목/섹터는 제외.
    """
    by_sector: dict[str, list[float]] = {}
    for s in stocks:
        closes = s.closes
        need = CFG5_TREND_WINDOW + CFG5_TREND_LAG + 1
        if len(closes) < need:
            continue
        end = len(closes) - 1 - CFG5_TREND_LAG       # lag 거래일 전 인덱스 (미래 제외)
        start = end - CFG5_TREND_WINDOW
        if start < 0 or closes[start] <= 0 or closes[end] <= 0:
            continue
        ret = closes[end] / closes[start] - 1.0
        by_sector.setdefault(s.sector, []).append(ret)
    return {
        sec: sum(rs) / len(rs)
        for sec, rs in by_sector.items()
        if len(rs) >= CFG5_MIN_SECTOR_SIZE
    }


def leading_sectors(stocks: Sequence[F.StockRaw]) -> set[str]:
    """trailing 모멘텀 상위 CFG5_LEADING_FRACTION 섹터 집합 (PIT-safe)."""
    mom = _sector_trailing_momentum(stocks)
    if not mom:
        return set()
    ordered = sorted(mom.items(), key=lambda kv: (-kv[1], kv[0]))
    k = max(1, math.ceil(len(ordered) * CFG5_LEADING_FRACTION))
    return {sec for sec, _ in ordered[:k]}


def select_cfg5_for_harvest(
    stocks: Sequence[F.StockRaw],
) -> HarvestSelection:
    """cfg5 regime/leading-sector tilt 생성기. 반환 shape = select_bpp_for_harvest 동일.

    score_bpp_universe(frozen) score를 유지하되, select_size_sleeves 직전에 선두 섹터 종목
    score에 +CFG5_SECTOR_BUMP를 가산한다. sleeve 쿼터(20/20/10)는 frozen select_size_sleeves가
    그대로 강제 → Gate C size 분포 보존, 섹터 cherry-pick 퇴화 불가.
    """
    lead = leading_sectors(stocks)
    used: set[str] = set()
    result: HarvestSelection = {}
    for b in HARVEST_BUCKETS:
        scored = F.score_bpp_universe(stocks, b)
        by_t = {sc.ticker: sc for sc in scored}
        # 선두 섹터 tilt — eligible(score present) 종목만, sleeve 내부 재배열용 score 사본.
        tilt_scores = []
        for sc in scored:
            s = sc.score
            if not _is_nan(s) and sc.sector in lead:
                s = s + CFG5_SECTOR_BUMP
            tilt_scores.append(s)
        picked = F.select_size_sleeves(
            [sc.ticker for sc in scored], tilt_scores,
            [sc.sleeve for sc in scored], quota=dict(F.SLEEVE_QUOTA), exclude=used,
        )
        # ranked는 frozen 측정이 IC/recall에 쓰는 **원본 score**(틸트 전)로 정렬·노출한다 —
        # 틸트는 selection(어떤 종목이 들어가나)에만 영향, 측정 score는 frozen 그대로.
        ranked = sorted((by_t[t] for t in picked), key=lambda sc: (-sc.score, sc.ticker))
        result[b] = (scored, ranked)
        for sc in ranked:
            used.add(sc.ticker)
    return result


# ============================================================================
# cfg6 — MULTI-NET UNION (사전등록·동결 파라미터)
# ============================================================================

# K개 스크린 (사전등록·FREEZE). 각 스크린은 score_bpp_universe의 component rank를 단독
# 정렬키로 쓴다(동일 입력·동일 sleeve, 신호만 분리). dedupe = ticker, tie-break = score desc,
# ticker asc (select_size_sleeves L448/L471 정합), final cap = 150, no-retry.
CFG6_SCREENS = ("composite", "trend", "foreign")  # K=3 [frozen]
CFG6_TOP_N_PER_SLEEVE = 30      # 각 스크린이 sleeve별 상위 N후보 emit [frozen].
CFG6_FINAL_CAP = 150            # 최종 후보 상한 (60/60/30 sleeve 쿼터 합) [frozen].


def _screen_sort_key(sc: F.ScoredStock, screen: str) -> float:
    """스크린별 정렬 키 (높을수록 우선). composite = ensemble score, 그 외 = factor rank."""
    if screen == "composite":
        return sc.score
    return sc.factor_ranks.get(screen, math.nan)


def _screen_top_n_per_sleeve(
    scored: Sequence[F.ScoredStock], screen: str, n: int
) -> set[str]:
    """한 스크린의 sleeve별 상위 n ticker UNION (eligible·키 present만)."""
    by_sleeve: dict[str, list[tuple[float, float, str]]] = {}
    for sc in scored:
        if not sc.eligible:
            continue
        key = _screen_sort_key(sc, screen)
        if _is_nan(key):
            continue
        composite = sc.score if not _is_nan(sc.score) else -math.inf
        by_sleeve.setdefault(sc.sleeve, []).append((key, composite, sc.ticker))
    out: set[str] = set()
    for _sleeve, rows in by_sleeve.items():
        rows.sort(key=lambda row: (-row[0], -row[1], row[2]))
        out.update(t for _key, _composite, t in rows[:n])
    return out


def select_cfg6_for_harvest(
    stocks: Sequence[F.StockRaw],
) -> HarvestSelection:
    """cfg6 multi-net union 생성기. 반환 shape = select_bpp_for_harvest 동일.

    bucket별: K개 스크린의 sleeve-top-N UNION → frozen select_size_sleeves로 20/20/10 downselect
    (union>150이면 cap이 강제 — recall이 best member 미만 가능, omxy 정정). selection score =
    frozen ensemble score(composite)로 통일 — sleeve 내부 경쟁·tie-break·측정 모두 frozen 정합.
    no-retry: select_size_sleeves가 backfill 후에도 못 채우면 SleeveShortfallError surface(무음 truncation 금지).
    """
    used: set[str] = set()
    result: HarvestSelection = {}
    for b in HARVEST_BUCKETS:
        scored = F.score_bpp_universe(stocks, b)
        by_t = {sc.ticker: sc for sc in scored}
        # K-screen union (dedupe by ticker).
        union: set[str] = set()
        for screen in CFG6_SCREENS:
            union |= _screen_top_n_per_sleeve(scored, screen, CFG6_TOP_N_PER_SLEEVE)
        # downselect: union 멤버만 frozen select_size_sleeves에 넘김(나머지는 NaN score로 배제).
        # selection score = frozen ensemble score (composite) — sleeve 내부 경쟁·측정 정합.
        sub_scores = [
            (sc.score if (sc.ticker in union and not _is_nan(sc.score)) else math.nan)
            for sc in scored
        ]
        picked = F.select_size_sleeves(
            [sc.ticker for sc in scored], sub_scores,
            [sc.sleeve for sc in scored], quota=dict(F.SLEEVE_QUOTA), exclude=used,
        )
        ranked = sorted((by_t[t] for t in picked), key=lambda sc: (-sc.score, sc.ticker))
        result[b] = (scored, ranked)
        for sc in ranked:
            used.add(sc.ticker)
    # final cap 방어 (사전등록 no-retry): 3 bucket disjoint 합이 cap 초과 불가(쿼터 합=150).
    total = sum(len(result[b][1]) for b in HARVEST_BUCKETS)
    if total > CFG6_FINAL_CAP:
        raise F.SleeveShortfallError(
            f"cfg6 최종 후보 {total} > cap {CFG6_FINAL_CAP} — 쿼터 합 불변식 위반(무음 truncation 금지)."
        )
    return result


# ============================================================================
# cfg7 — DAILY SURGE PROXY (TASK B, 사전등록·동결 파라미터, 2026-06-17)
# ============================================================================
#
# ⚠️ "daily surge proxy" — explicitly NOT prism replication. prism = intraday + P&L-judged;
# cfg7 = DAILY signals + recall-judged (funnel diagnostic). EXPLORATORY/diagnostic-only — no apply.
# Addendum: docs/superpowers/2026-06-17-tier0-cfg5-cfg6-exploratory-addendum.md §cfg7.
#
# 4 offline DAILY signals, PIT-safe trailing windows + explicit lag (no same-day leak). All FROZEN:
#  - volume_surge   = MA5/MA60-1 (F._volume_surge, no edit) — recent vol / trailing avg.
#  - short_return   = F.recent_return(closes, CFG7_SURGE_WINDOW) — short-horizon return.
#  - high_proximity = F.high_proximity(highs|closes, CFG7_HIGH_WINDOW) — proximity to recent high.
#  - recent_trend   = F.risk_adjusted_trend(closes, CFG7_TREND_LB, skip=F.SKIP_DAYS) — lagged trend (no leak).
# Combine = percentile-rank each present signal via F._rank_of, average present → per-sleeve surge rank,
# then F.select_size_sleeves top-N per sleeve (Gate C preserved by construction, identical to cfg5/cfg6).
# SELECTION uses the surge rank; the SCORE measured by frozen gates stays the original sc.score.

CFG7_SURGE_WINDOW = 5    # short-horizon return window (거래일) [frozen].
CFG7_HIGH_WINDOW = 252   # proximity-to-recent-high window (52주 ~거래일) [frozen].
CFG7_TREND_LB = 60       # recent-trend lookback (거래일), lagged by F.SKIP_DAYS=21 [frozen].


def _cfg7_surge_ranks(scored: Sequence[F.ScoredStock], stocks: Sequence[F.StockRaw]) -> dict[str, float]:
    """4 daily surge signals → eligible 종목별 평균 percentile-rank (present만).

    raw 신호는 전 universe에서 산출하되, eligible(score present)이 아닌 종목은 NaN 마스크 →
    select_size_sleeves가 자연 배제(frozen 정합). PIT-safe: 모든 창은 closes의 마지막(=선정일 t)에서
    끝나는 trailing 창이며, recent_trend는 SKIP_DAYS lag로 same-day leak 차단.
    """
    by_t = {s.ticker: s for s in stocks}
    elig = {sc.ticker: sc.eligible for sc in scored}

    def masked(fn) -> list[float]:
        out = []
        for sc in scored:
            s = by_t.get(sc.ticker)
            v = fn(s) if (s is not None and elig.get(sc.ticker)) else math.nan
            out.append(v)
        return out

    vol = F._rank_of(masked(lambda s: F._volume_surge(s.trdvals)))
    ret = F._rank_of(masked(lambda s: F.recent_return(s.closes, window=CFG7_SURGE_WINDOW)))
    prox = F._rank_of(masked(lambda s: F.high_proximity(
        s.highs if s.highs is not None else s.closes, window=CFG7_HIGH_WINDOW)))
    trend = F._rank_of(masked(lambda s: F.risk_adjusted_trend(s.closes, CFG7_TREND_LB, skip=F.SKIP_DAYS)))
    combined = F._combine_ranks([vol, ret, prox, trend])
    return {sc.ticker: combined[i] for i, sc in enumerate(scored)}


def select_cfg7_for_harvest(stocks: Sequence[F.StockRaw]) -> HarvestSelection:
    """cfg7 daily-surge-proxy 생성기. 반환 shape = select_bpp_for_harvest 동일.

    bucket별: frozen score_bpp_universe로 scored universe(측정 score = frozen sc.score 유지) →
    daily surge rank로 sleeve 내부 재배열 → frozen select_size_sleeves 20/20/10. ranked는 frozen
    sc.score로 정렬·노출(cfg5와 동일 패턴): surge는 SELECTION만, 측정 score는 frozen 그대로.
    """
    used: set[str] = set()
    result: HarvestSelection = {}
    for b in HARVEST_BUCKETS:
        scored = F.score_bpp_universe(stocks, b)
        by_t = {sc.ticker: sc for sc in scored}
        surge = _cfg7_surge_ranks(scored, stocks)
        # selection score = surge rank (eligible·present만; 그 외 NaN → select_size_sleeves 배제).
        sel_scores = [surge.get(sc.ticker, math.nan) for sc in scored]
        picked = F.select_size_sleeves(
            [sc.ticker for sc in scored], sel_scores,
            [sc.sleeve for sc in scored], quota=dict(F.SLEEVE_QUOTA), exclude=used,
        )
        # 측정 score = frozen ensemble score(surge 아님) — IC/recall은 frozen 그대로 측정.
        ranked = sorted((by_t[t] for t in picked), key=lambda sc: (-sc.score, sc.ticker))
        result[b] = (scored, ranked)
        for sc in ranked:
            used.add(sc.ticker)
    return result


def cfg7_high_volume_baseline(stocks: Sequence[F.StockRaw]) -> HarvestSelection:
    """cfg7 control: rank by F.adv60 ALONE (top-N per sleeve), reusing select_size_sleeves.

    PRE-REGISTERED high-volume baseline (addendum §cfg7). cfg7 must beat BOTH random AND this — else the
    surge signal is indistinguishable from mere liquidity (LIFT<=0 = honest FAIL, not tune-to-pass).
    """
    used: set[str] = set()
    result: HarvestSelection = {}
    for b in HARVEST_BUCKETS:
        scored = F.score_bpp_universe(stocks, b)
        by_t = {sc.ticker: sc for sc in scored}
        # ADV alone (eligible만 present; 비eligible은 adv 있어도 NaN-score라 sleeve 배제 정합).
        adv_scores = [sc.adv60 if sc.eligible and not _is_nan(sc.adv60) else math.nan for sc in scored]
        picked = F.select_size_sleeves(
            [sc.ticker for sc in scored], adv_scores,
            [sc.sleeve for sc in scored], quota=dict(F.SLEEVE_QUOTA), exclude=used,
        )
        ranked = sorted((by_t[t] for t in picked), key=lambda sc: (-sc.score, sc.ticker))
        result[b] = (scored, ranked)
        for sc in ranked:
            used.add(sc.ticker)
    return result


# ============================================================================
# 진단 (mandatory per-cell diagnostics) — Jaccard, leader hits, pre/post-cap, dist
# ============================================================================

def _is_nan(x: object) -> bool:
    return isinstance(x, float) and math.isnan(x)


@dataclass
class GenDiagnostics:
    """cfg5/cfg6 한 셀(=한 선정월·생성기) 진단. report 노출용 — 게이트 판정과 무관."""
    selected_count: int
    pre_cap_union_count: Optional[int]          # cfg6 union 크기 (cfg5 None)
    leader_hits: int                            # 선정 ∩ leader basket
    unique_leader_hits_vs_bpp: int
    leaders_dropped_post_cap: int               # union/tilt에 있었으나 cap으로 탈락한 leader
    unique_vs_bpp: int                          # bpp 선정엔 없고 본 생성기에만 있는 종목 수
    jaccard_vs_bpp: float                        # |∩| / |∪| (vs select_bpp_for_harvest 선정)
    size_dist: dict[str, int]                   # large/mid/small 분포
    sector_dist: dict[str, int]                 # 섹터별 선정 수
    random_baseline_ratio: float = math.nan     # selected/universe (frozen random_baseline와 동일 정의)


def _selected_set(sel: HarvestSelection) -> set[str]:
    out: set[str] = set()
    for b in HARVEST_BUCKETS:
        out |= {sc.ticker for sc in sel[b][1]}
    return out


def compute_diagnostics(
    stocks: Sequence[F.StockRaw],
    sel: HarvestSelection,
    bpp_sel: HarvestSelection,
    leader_basket: dict[str, str],
    *,
    pre_cap_union: Optional[set[str]] = None,
) -> GenDiagnostics:
    """생성기 결과 sel을 bpp 기준선과 비교한 진단. pre_cap_union = cfg6 cap 전 union(cfg5 None)."""
    selected = _selected_set(sel)
    bpp_selected = _selected_set(bpp_sel)
    inter = selected & bpp_selected
    uni = selected | bpp_selected
    jaccard = (len(inter) / len(uni)) if uni else math.nan
    leaders = set(leader_basket)
    leader_hits = len(selected & leaders)
    unique_leader_hits = len((selected & leaders) - bpp_selected)
    dropped = 0
    if pre_cap_union is not None:
        # union에 있던 leader 중 최종 선정 못 된 수.
        dropped = len((pre_cap_union & leaders) - selected)
    size_dist = {"large": 0, "mid": 0, "small": 0}
    sector_dist: dict[str, int] = {}
    sc_by_t = {sc.ticker: sc for b in HARVEST_BUCKETS for sc in sel[b][1]}
    for tk in selected:
        sc = sc_by_t.get(tk)
        if sc is not None:
            size_dist[sc.sleeve] = size_dist.get(sc.sleeve, 0) + 1
            sector_dist[sc.sector] = sector_dist.get(sc.sector, 0) + 1
    n_uni = len(stocks)
    return GenDiagnostics(
        selected_count=len(selected),
        pre_cap_union_count=(len(pre_cap_union) if pre_cap_union is not None else None),
        leader_hits=leader_hits,
        unique_leader_hits_vs_bpp=unique_leader_hits,
        leaders_dropped_post_cap=dropped,
        unique_vs_bpp=len(selected - bpp_selected),
        jaccard_vs_bpp=jaccard,
        size_dist=size_dist,
        sector_dist=sector_dist,
        random_baseline_ratio=(len(selected) / n_uni) if n_uni else math.nan,
    )


def cfg6_union_for_diagnostics(stocks: Sequence[F.StockRaw]) -> set[str]:
    """cfg6 pre-cap union (진단 leaders_dropped_post_cap 계산용). 생성과 동일 스크린 규칙."""
    union: set[str] = set()
    for b in HARVEST_BUCKETS:
        scored = F.score_bpp_universe(stocks, b)
        for screen in CFG6_SCREENS:
            union |= _screen_top_n_per_sleeve(scored, screen, CFG6_TOP_N_PER_SLEEVE)
    return union
