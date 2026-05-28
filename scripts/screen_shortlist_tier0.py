#!/usr/bin/env python3
"""
주픽(JooPick) — Tier 0 인디케이터 자동 스크리닝 (T7e.8 B-1)
=============================================================

목적
----
AI 키 없이도 동작하는 "진짜 코스피·코스닥 30종목" 산출 파이프라인.
현재 구현은 pykrx 기반 가격·거래량·외국인 3개 시그널을 산출하고, DART 기반
실적·퀄리티 2개 시그널은 후속 hook으로 남겨둔다. 5-Signal Composite
인터페이스는 유지하되, DART hook 구현 전에는 S4/S5를 0으로 두고 시간대별
가중치(단/중/장)를 적용한다. 단/중/장 후보 50씩 → 최종 10/10/10 = 30 종목을
`short_list_30` 테이블에 idempotent upsert한다.

박제
----
- `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D19`
- `Document/Service/Report/ReportFramework.md §8 Step 0`
- `Document/Build/Slices/S7-RealData.md T7e.8`
- 마이그 0012 (`short_list_30` name/sector 컬럼) 적용 필수.

설치 (venv 필수)
-----------------
```bash
cd /Users/yong/New_Project_KR_Stock
python3 -m venv scripts/.venv
source scripts/.venv/bin/activate
pip install pykrx supabase requests
```

환경 변수
---------
- `SUPABASE_URL` — 예: https://rbrpcynhphrpljbjirfo.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY` — `--apply` 시 필수. anon 키로는 RLS에 막힘.
- `DART_API_KEY` — DART OpenAPI key. Signal 4(실적 모멘텀)·Signal 5(퀄리티) 산출에 필수.
  키가 없으면 두 시그널은 0으로 fail-soft 처리되고 단/중/장 라벨은 모멘텀·거래량만 반영.
- `KRX_ID`, `KRX_PW` — pykrx KRX 인증. universe fetch + OHLCV/외국인 조회에 필수.
  미설정 시 KRX 응답이 비어 universe 0건으로 종료된다 (44차 root cause).

사용 예
-------
```bash
# dry-run: Supabase write 없이 CSV 백업만 출력
python3 scripts/screen_shortlist_tier0.py \
    --month 2026-05-01 \
    --as-of 2026-05-11 \
    --dry-run \
    --csv-backup scripts/out/short_list_30_2026-05_dryrun.csv

# 실 적용: 백업 CSV는 항상 필수
python3 scripts/screen_shortlist_tier0.py \
    --month 2026-05-01 \
    --as-of 2026-05-11 \
    --apply \
    --csv-backup scripts/out/short_list_30_2026-05.csv
```

알고리즘 (5-Signal Composite × 시간대별 가중치)
------------------------------------------------
| 시그널 | 단기(short) | 중기(mid) | 장기(long) | 데이터 소스 |
|---|---|---|---|---|
| S1 모멘텀 (종가/MA60) | 0.40 | 0.20 | 0.10 | pykrx OHLCV |
| S2 거래량 급증 (5일 vs 60일) | 0.30 | 0.15 | 0.05 | pykrx OHLCV |
| S3 외국인 순매수 강도 | 0.20 | 0.15 | 0.05 | pykrx 외국인 |
| S4 실적 모멘텀 (YoY OP %) | 0.05 | 0.30 | 0.20 | DART hook (follow-up) |
| S5 퀄리티 (ROE/FCF/부채) | 0.05 | 0.20 | 0.60 | DART hook (follow-up) |

각 시그널은 cross-section z-score → 0~100 scale로 정규화 후 가중 합산.
단/중/장 bucket별 상위 10씩 선정 → 30종목.

Idempotency
-----------
- UPSERT는 `short_list_30` UNIQUE (month, ticker) 위에서 동작.
- 같은 month로 재실행 시 점수만 갱신, 새 row 안 만듦.
- `delta_status`: 전월 동일 ticker 있으면 `hold`, 없으면 `new`.
- `removed` delta는 본 스크립트 범위 밖 (별도 후속 작업 — bucket별 rank
  컬럼 NOT NULL 제약이 있어 sentinel 정책이 필요).

스코프 제외
-----------
- 자동 cron 등록 (수동 월 1회 실행 가정).
- AI 키 plug-in (S7a Tier 1 Core 11 페르소나 평가는 별도).
- removed delta 처리 (T7e.8 follow-up).
- pykrx rate-limit 회피 backoff (월 1회라 현재 불필요).
"""

# --- Standard lib ---
import argparse
import csv
import math
import os
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional


# --- B66 C 하이브리드 (plan PR #55 `bbf102d`) ---
_MAPPER_DIR = Path(__file__).parent
try:
    from canonical_sector_mapper import (
        CANONICAL_SECTORS,
        UNRESOLVED,
        load_override,
        resolve_sector,
        explain as explain_sector,
        OverrideSchemaError,
    )
except ImportError:
    # 일부 환경에서 scripts/가 sys.path에 안 들어있을 수 있음.
    sys.path.insert(0, str(_MAPPER_DIR))
    from canonical_sector_mapper import (  # noqa: E402
        CANONICAL_SECTORS,
        UNRESOLVED,
        load_override,
        resolve_sector,
        explain as explain_sector,
        OverrideSchemaError,
    )

# B89 strict block exit code (plan §4.3 R1 lock-in)
EXIT_CODE_UNRESOLVED = 2


# ============================================================================
# Configuration
# ============================================================================

BUCKETS: tuple[str, ...] = ("short", "mid", "long")

WEIGHTS: dict[str, dict[str, float]] = {
    "short": {"momentum": 0.40, "volume_surge": 0.30, "foreign_net": 0.20, "earnings": 0.05, "quality": 0.05},
    "mid":   {"momentum": 0.20, "volume_surge": 0.15, "foreign_net": 0.15, "earnings": 0.30, "quality": 0.20},
    "long":  {"momentum": 0.10, "volume_surge": 0.05, "foreign_net": 0.05, "earnings": 0.20, "quality": 0.60},
}

UNIVERSE_FILTERS = {
    # 시총 ≥ 300억원 — 유동성/조작 위험 컷오프
    "min_market_cap_won": 30_000_000_000,
    # 종목명 키워드로 ETF/리츠/SPAC 등 제외 (보통주 only)
    "exclude_keywords": (
        "ETF", "ETN", "KODEX", "TIGER", "KBSTAR", "HANARO", "ARIRANG", "ACE", "SOL",
        "리츠", "스팩", "SPAC", "우B", "우C",
    ),
    # 종목명 끝이 "우"로 끝나는 우선주 제외 (예: "삼성전자우")
    "exclude_pref_suffix": True,
}

TOP_K_PER_BUCKET = 10
CANDIDATE_POOL_PER_BUCKET = 50  # 단/중/장 후보 50씩 (HANDOFF §2.A 박제)

PRICE_WINDOW_DAYS = 90  # 60-day 모멘텀 계산용 여유 buffer (영업일 60일 ≈ 달력 90일)
VOLUME_MA_SHORT = 5
VOLUME_MA_LONG = 60
MOMENTUM_MA_WINDOW = 60

# postgrest HTTP/2 connection의 stream limit(약 20,000) 회피.
# 1 ticker ≈ 24 supabase REST 요청 → 300 ticker마다 client를 갱신해 7K streams/conn 유지.
# 44차 풀 dry-run에서 846번째 ticker(last_stream_id:19999) ConnectionTerminated가 root cause.
SUPABASE_CLIENT_REFRESH_EVERY_N_TICKERS = 300


# ============================================================================
# Lazy imports (venv 없이도 --help 동작하도록)
# ============================================================================

def ensure_pykrx():
    try:
        from pykrx import stock  # noqa: F401
    except ImportError:
        sys.stderr.write(
            "pykrx가 설치되지 않았습니다. venv 환경에서 `pip install pykrx` 후 재실행하세요.\n"
            "Homebrew Python은 PEP 668 제약이 있으므로 시스템 pip 설치는 실패합니다.\n"
        )
        sys.exit(1)


def ensure_supabase():
    try:
        from supabase import create_client  # noqa: F401
    except ImportError:
        sys.stderr.write(
            "supabase-py가 설치되지 않았습니다. `pip install supabase` 후 재실행하세요.\n"
        )
        sys.exit(1)


def get_supabase_client():
    """SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY → supabase-py client."""
    ensure_supabase()
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("--apply에는 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.")
    return create_client(url, key)


# ============================================================================
# Data classes
# ============================================================================

@dataclass
class StockSignal:
    ticker: str
    name: str
    sector: str
    market_cap_won: float
    # raw 0~1 또는 임의 단위 — z-normalize 전
    momentum_raw: float = 0.0
    volume_surge_raw: float = 0.0
    foreign_net_raw: float = 0.0
    earnings_raw: float = 0.0
    quality_raw: float = 0.0
    volatility_raw: float = 0.0
    quality_metrics: dict[str, float] = field(default_factory=dict)
    signal_4_basis: str = "not_applicable"
    quality_insufficient: bool = True
    # 0~100 normalized — z-normalize 후
    momentum: float = 0.0
    volume_surge: float = 0.0
    foreign_net: float = 0.0
    earnings: float = 0.0
    quality: float = 0.0
    volatility: float = 50.0


@dataclass
class ShortListRow:
    month: str          # YYYY-MM-DD (1일 고정)
    ticker: str
    name: str
    sector: str
    bucket: str         # short / mid / long
    rank: int           # 1~10
    composite_score: float
    trend_score: float
    momentum_score: float
    volatility_score: float
    signal_label: str
    delta_status: str   # new / hold
    delta_reason: str
    summary_3line: str
    suggested_weight: float
    signal_4_basis: str = "not_applicable"
    quality_insufficient: bool = True


# ============================================================================
# Date helpers
# ============================================================================

def parse_month(s: str) -> date:
    try:
        d = date.fromisoformat(s)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"--month 는 YYYY-MM-01 형식이어야 합니다 ({exc})")
    if d.day != 1:
        raise argparse.ArgumentTypeError("--month 는 매월 1일이어야 합니다 (예: 2026-05-01)")
    return d


def parse_as_of(s: str) -> date:
    try:
        return date.fromisoformat(s)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"--as-of 는 YYYY-MM-DD 형식이어야 합니다 ({exc})")


def prev_month_first(m: date) -> date:
    """2026-05-01 → 2026-04-01."""
    if m.month == 1:
        return date(m.year - 1, 12, 1)
    return date(m.year, m.month - 1, 1)


def last_business_day_on_or_before(d: date) -> date:
    """주말 보정만 (공휴일은 pykrx가 알아서 가장 가까운 영업일 반환하도록 위임)."""
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def resolve_target_date(run_date: date, requested_as_of: Optional[date]) -> date:
    """Resolve stable market-data snapshot date.

    기본값은 실행일의 전 영업일이다. 장중 실행 시 pykrx가 당일 변동 데이터를
    반환해 dry-run/apply 결과가 달라질 수 있으므로, 명시적 --as-of가 없으면
    완료된 장 마감 데이터만 사용한다. 당일 장마감 후 데이터를 쓰고 싶으면
    --as-of YYYY-MM-DD로 명시한다.
    """
    if requested_as_of is not None:
        return last_business_day_on_or_before(requested_as_of)
    return last_business_day_on_or_before(run_date - timedelta(days=1))


# ============================================================================
# Universe fetch
# ============================================================================

def fetch_universe(target_date: date, limit: Optional[int] = None) -> list[dict]:
    """KOSPI + KOSDAQ 종목을 시총 + 종목명 기반으로 필터링.

    Returns: [{ticker, name, market, market_cap_won}, ...]

    NOTE: sector field는 **본 함수에서 채우지 않는다** (B66 C 하이브리드, plan PR #55 `bbf102d`).
    sector는 후속 단계에서 `dart_corp_codes.induty_code` + `canonical_sector_mapper.resolve_sector`로
    채워진다 (resolve_sectors_for_universe). 임시 market label 박제는 placeholder leak 위험.
    """
    ensure_pykrx()
    from pykrx import stock

    asof = last_business_day_on_or_before(target_date).strftime("%Y%m%d")
    result: list[dict] = []

    for market in ("KOSPI", "KOSDAQ"):
        cap_df = stock.get_market_cap_by_ticker(asof, market=market)
        for ticker in cap_df.index:
            mcap = float(cap_df.at[ticker, "시가총액"])
            if mcap < UNIVERSE_FILTERS["min_market_cap_won"]:
                continue
            try:
                name = stock.get_market_ticker_name(ticker)
            except Exception:  # noqa: BLE001
                continue
            if not name:
                continue
            # 종목명 키워드 필터
            if any(kw in name for kw in UNIVERSE_FILTERS["exclude_keywords"]):
                continue
            if UNIVERSE_FILTERS["exclude_pref_suffix"] and name.endswith("우"):
                continue
            result.append({
                "ticker": ticker,
                "name": name,
                "market": market,                          # 'KOSPI' or 'KOSDAQ' (B66 후 sector resolve의 fallback 정보 X — induty 기반)
                "market_cap_won": mcap,
                # sector 필드는 의도적으로 미설정 — resolve_sectors_for_universe에서 induty 기반 결정.
            })

    # 시총 큰 순으로 정렬 후 옵션 limit 적용 (디버깅용 작은 universe)
    result.sort(key=lambda r: r["market_cap_won"], reverse=True)
    if limit is not None and limit > 0:
        result = result[:limit]
    return result


# ============================================================================
# B66 sector resolution (plan PR #55 `bbf102d`)
# ============================================================================

def resolve_sectors_for_universe(
    universe: list[dict],
    supabase_client: Any = None,  # type: ignore[name-defined]
    override_path: Optional[Path] = None,
) -> list[dict]:
    """`canonical_sector_mapper.resolve_sector`로 universe에 sector 채우기.

    각 row에 `sector` (CanonicalSector OR UNRESOLVED) + diagnostic fields 추가.

    Args:
      universe: fetch_universe 출력.
      supabase_client: dart_corp_codes에서 induty_code lookup. None이면 induty=None 처리.
      override_path: sector_override.json path. None이면 default (scripts/sector_override.json).

    Returns: in-place mutation + return same list. Each row gains:
      - sector: str (CanonicalSector or "unresolved")
      - induty_code: str | None
      - sector_source: "override" | "mapper" | "unresolved"
    """
    try:
        override = load_override(override_path) if override_path or (Path(__file__).parent / "sector_override.json").exists() else {}
    except OverrideSchemaError as exc:
        sys.exit(f"sector_override.json schema 위반: {exc}")
    except FileNotFoundError:
        override = {}

    # batch fetch induty_code from dart_corp_codes (단일 SELECT)
    induty_by_ticker: dict[str, Optional[str]] = {}
    if supabase_client is not None and universe:
        tickers = [u["ticker"] for u in universe]
        # supabase-py는 .in_("ticker", [...])로 batch 가능
        res = (
            supabase_client.table("dart_corp_codes")
            .select("ticker, induty_code")
            .in_("ticker", tickers)
            .execute()
        )
        for row in (res.data or []):
            induty_by_ticker[row["ticker"]] = row.get("induty_code")

    for row in universe:
        ticker = row["ticker"]
        induty = induty_by_ticker.get(ticker)
        diag = explain_sector(ticker, induty, override)
        row["sector"] = diag["final_sector"]
        row["induty_code"] = induty
        row["sector_source"] = diag["source"]

    return universe


def write_sector_review_csv(rows: list[dict], path: str) -> int:
    """unresolved + override 적용 trace를 review CSV로 출력. Returns: unresolved count.

    Plan §4.3 R1 lock-in: --apply 직전에 호출되어 unresolved > 0이면 write block 신호.
    dry-run에서도 동일 CSV를 출력해 운영자가 다음 PR에서 override 추가하도록 가이드.
    """
    unresolved_count = sum(1 for r in rows if r.get("sector") == UNRESOLVED)
    review_rows = [r for r in rows if r.get("sector") == UNRESOLVED or r.get("sector_source") == "override"]

    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["ticker", "name", "market", "induty_code", "sector", "sector_source", "note"],
        )
        writer.writeheader()
        for r in review_rows:
            note = ""
            if r.get("sector") == UNRESOLVED:
                if r.get("induty_code") is None:
                    note = "induty_code 미수집 — seed_dart_corp_codes.py --backfill-induty 실행 후 재시도"
                else:
                    note = "mapper rule 또는 override 미정합 — sector_override.json에 추가 권장"
            elif r.get("sector_source") == "override":
                note = "override 적용 — sector_override.json 적용 확인"
            writer.writerow({
                "ticker": r["ticker"],
                "name": r.get("name", ""),
                "market": r.get("market", ""),
                "induty_code": r.get("induty_code", ""),
                "sector": r["sector"],
                "sector_source": r.get("sector_source", ""),
                "note": note,
            })
    return unresolved_count


def enforce_b89_strict_block(unresolved_count: int, *, apply: bool, review_csv_path: str) -> None:
    """B89 strict block: unresolved selected rows must stop both dry-run and apply.

    Plan §4.3 R1 lock-in:
      - dry-run: review CSV + warning + exit code 2
      - --apply: DB write 전면 거부 + exit code 2
    """
    if unresolved_count <= 0:
        return
    if apply:
        print(
            f"[ABORT] B89 strict block: selected 30 rows 중 {unresolved_count}개가 unresolved sector. "
            f"sector_override.json에 ticker 추가 후 재실행하거나 mapper rule을 보강하세요. "
            f"review CSV: {review_csv_path}",
            file=sys.stderr,
        )
        sys.exit(EXIT_CODE_UNRESOLVED)
    print(
        f"[warn] dry-run: selected 30 rows 중 {unresolved_count}개 unresolved (review CSV 참조). "
        f"--apply 전에 해소 필요. review CSV: {review_csv_path}",
        file=sys.stderr,
    )
    sys.exit(EXIT_CODE_UNRESOLVED)


# ============================================================================
# Signal compute
# ============================================================================

def fetch_price_signals(ticker: str, target_date: date) -> dict:
    """pykrx OHLCV → momentum (close / MA60), volume_surge (MA5 / MA60), volatility (60d sigma).

    Returns dict with raw values or None when insufficient data.
    """
    from pykrx import stock

    end = last_business_day_on_or_before(target_date)
    start = end - timedelta(days=PRICE_WINDOW_DAYS + 20)  # 영업일 buffer

    try:
        df = stock.get_market_ohlcv_by_date(
            start.strftime("%Y%m%d"),
            end.strftime("%Y%m%d"),
            ticker,
        )
    except Exception:  # noqa: BLE001
        return {"momentum_raw": 0.0, "volume_surge_raw": 0.0, "volatility_raw": 0.0}

    if df is None or df.empty or len(df) < MOMENTUM_MA_WINDOW + 1:
        return {"momentum_raw": 0.0, "volume_surge_raw": 0.0, "volatility_raw": 0.0}

    closes = df["종가"].astype(float).tolist()
    volumes = df["거래량"].astype(float).tolist()

    ma60 = sum(closes[-MOMENTUM_MA_WINDOW:]) / MOMENTUM_MA_WINDOW
    last_close = closes[-1]
    momentum_raw = (last_close / ma60 - 1.0) if ma60 > 0 else 0.0

    vol_short = sum(volumes[-VOLUME_MA_SHORT:]) / VOLUME_MA_SHORT
    vol_long = sum(volumes[-VOLUME_MA_LONG:]) / VOLUME_MA_LONG
    volume_surge_raw = (vol_short / vol_long - 1.0) if vol_long > 0 else 0.0

    # 60-day daily return σ → 연환산 안 함, 원시값
    returns = [(closes[i] / closes[i - 1] - 1.0) for i in range(-MOMENTUM_MA_WINDOW + 1, 0)]
    if returns:
        mean = sum(returns) / len(returns)
        var = sum((r - mean) ** 2 for r in returns) / len(returns)
        volatility_raw = math.sqrt(var)
    else:
        volatility_raw = 0.0

    return {
        "momentum_raw": momentum_raw,
        "volume_surge_raw": volume_surge_raw,
        "volatility_raw": volatility_raw,
    }


def fetch_foreign_signal(ticker: str, target_date: date) -> float:
    """pykrx 외국인 순매수 합계 (최근 60 영업일).

    Returns raw won 합계. 양수면 매수 우위, 음수면 매도 우위.
    """
    from pykrx import stock

    end = last_business_day_on_or_before(target_date)
    start = end - timedelta(days=PRICE_WINDOW_DAYS + 20)

    try:
        df = stock.get_market_trading_value_by_date(
            start.strftime("%Y%m%d"),
            end.strftime("%Y%m%d"),
            ticker,
        )
    except Exception:  # noqa: BLE001
        return 0.0

    if df is None or df.empty:
        return 0.0
    if "외국인합계" in df.columns:
        return float(df["외국인합계"].astype(float).tail(MOMENTUM_MA_WINDOW).sum())
    if "외국인" in df.columns:
        return float(df["외국인"].astype(float).tail(MOMENTUM_MA_WINDOW).sum())
    return 0.0


def fetch_dart_signals(ticker: str, target_date: date, dart_api_key: Optional[str], supabase=None):
    """DART OpenAPI를 통한 Signal 4·5 raw data.

    DART key 또는 Supabase cache client가 없으면 fail-soft로 0/NaN 결과를 반환한다.
    """
    try:
        from scripts.dart_signals import DartSignalsResult, fetch_dart_signals as fetch_real_dart_signals
    except ModuleNotFoundError:
        from dart_signals import DartSignalsResult, fetch_dart_signals as fetch_real_dart_signals

    if not dart_api_key or supabase is None:
        return DartSignalsResult()
    return fetch_real_dart_signals(supabase, ticker=ticker, target_date=target_date, api_key=dart_api_key)


# ============================================================================
# Normalization (cross-section z-score → 0~100 scale)
# ============================================================================

def z_normalize_to_0_100(values: list[float]) -> list[float]:
    """평균 0, 시그마 1로 표준화 후 (z+3)/6 * 100 clamp."""
    if not values:
        return []
    mean = sum(values) / len(values)
    var = sum((v - mean) ** 2 for v in values) / len(values)
    sigma = math.sqrt(var) if var > 0 else 1e-9
    result = []
    for v in values:
        z = (v - mean) / sigma
        scaled = (z + 3.0) / 6.0 * 100.0  # ±3σ → 0~100
        result.append(max(0.0, min(100.0, scaled)))
    return result


def normalize_signals(signals: list[StockSignal]) -> None:
    """In-place: signals 리스트의 raw 값을 0~100 scaled 값으로 채운다."""
    if not signals:
        return
    for field_raw, field_norm, invert in (
        ("momentum_raw", "momentum", False),
        ("volume_surge_raw", "volume_surge", False),
        ("foreign_net_raw", "foreign_net", False),
        ("earnings_raw", "earnings", False),
        ("volatility_raw", "volatility", True),  # 변동성은 낮을수록 좋다 → 반전
    ):
        raw = [getattr(s, field_raw) for s in signals]
        norm = z_normalize_to_0_100(raw)
        if invert:
            norm = [100.0 - v for v in norm]
        for s, v in zip(signals, norm):
            setattr(s, field_norm, v)


# ============================================================================
# Bucket selection
# ============================================================================

def compose_bucket_score(s: StockSignal, bucket: str) -> float:
    w = WEIGHTS[bucket]
    return (
        s.momentum * w["momentum"]
        + s.volume_surge * w["volume_surge"]
        + s.foreign_net * w["foreign_net"]
        + s.earnings * w["earnings"]
        + s.quality * w["quality"]
    )


def select_top_per_bucket(
    signals: list[StockSignal],
) -> dict[str, list[tuple[StockSignal, float]]]:
    """각 bucket별 (1) compose_score 계산 → (2) 후보 50 정렬 → (3) 상위 10 선정.

    DB UNIQUE(month, ticker) 계약상 한 ticker는 한 bucket에만 들어갈 수 있다.
    앞 bucket에서 이미 선정된 ticker는 뒤 bucket에서 제외하고 다음 후보로 backfill한다.
    """
    used_tickers: set[str] = set()
    result: dict[str, list[tuple[StockSignal, float]]] = {}
    for bucket in BUCKETS:
        scored = [(s, compose_bucket_score(s, bucket)) for s in signals]
        scored.sort(key=lambda t: t[1], reverse=True)
        pool = scored[:CANDIDATE_POOL_PER_BUCKET]
        picks: list[tuple[StockSignal, float]] = []

        for s, score in pool:
            if s.ticker in used_tickers:
                continue
            picks.append((s, score))
            used_tickers.add(s.ticker)
            if len(picks) == TOP_K_PER_BUCKET:
                break

        # 후보 50 안에서 중복이 많아 10개를 못 채우는 극단 상황 대비.
        # 운영 universe는 충분히 크지만, --universe-limit 디버깅에서도 실패 원인을 명확히 한다.
        if len(picks) < TOP_K_PER_BUCKET:
            for s, score in scored[CANDIDATE_POOL_PER_BUCKET:]:
                if s.ticker in used_tickers:
                    continue
                picks.append((s, score))
                used_tickers.add(s.ticker)
                if len(picks) == TOP_K_PER_BUCKET:
                    break

        if len(picks) < TOP_K_PER_BUCKET:
            raise ValueError(
                f"{bucket} bucket을 {TOP_K_PER_BUCKET}개로 채우지 못했습니다 "
                f"(선정 {len(picks)}개). universe를 늘리세요."
            )

        result[bucket] = picks
    return result


# ============================================================================
# Delta status (vs 전월)
# ============================================================================

def fetch_prior_month_tickers(supabase, month: date) -> set[str]:
    prior = prev_month_first(month)
    res = (
        supabase.table("short_list_30")
        .select("ticker")
        .eq("month", prior.isoformat())
        .execute()
    )
    rows = res.data or []
    return {r["ticker"] for r in rows if r.get("ticker")}


# ============================================================================
# Row construction
# ============================================================================

def primary_signal_label(s: StockSignal, bucket: str) -> str:
    """bucket weight 적용 후 기여도가 가장 높은 시그널 한국어 라벨."""
    w = WEIGHTS[bucket]
    contrib = {
        "모멘텀": s.momentum * w["momentum"],
        "거래량 급증": s.volume_surge * w["volume_surge"],
        "외국인 매수": s.foreign_net * w["foreign_net"],
        "실적 모멘텀": s.earnings * w["earnings"],
        "퀄리티": s.quality * w["quality"],
    }
    return max(contrib.items(), key=lambda kv: kv[1])[0]


def build_summary(s: StockSignal, bucket: str, composite: float, dart_available: bool) -> str:
    parts = [
        f"Tier 0 {bucket} 점수 {composite:.1f} (모멘텀 {s.momentum:.0f}/거래량 {s.volume_surge:.0f}/외국인 {s.foreign_net:.0f})",
    ]
    if dart_available:
        parts.append(f"실적 {s.earnings:.0f} · 퀄리티 {s.quality:.0f}")
    else:
        parts.append("실적·퀄리티 시그널은 DART 연동 후 채워짐")
    parts.append("AI 분석 대기 중")
    return " | ".join(parts)


def build_rows(
    selections: dict[str, list[tuple[StockSignal, float]]],
    month: date,
    prior_tickers: set[str],
    dart_available: bool,
) -> list[ShortListRow]:
    rows: list[ShortListRow] = []
    for bucket, ranked in selections.items():
        for idx, (s, composite) in enumerate(ranked, start=1):
            is_hold = s.ticker in prior_tickers
            rows.append(ShortListRow(
                month=month.isoformat(),
                ticker=s.ticker,
                name=s.name,
                sector=s.sector,
                bucket=bucket,
                rank=idx,
                composite_score=round(composite, 2),
                trend_score=round(s.momentum, 2),
                momentum_score=round(s.momentum, 2),
                volatility_score=round(s.volatility, 2),
                signal_label=primary_signal_label(s, bucket),
                delta_status="hold" if is_hold else "new",
                delta_reason="전월 유지" if is_hold else "Tier 0 신규 진입",
                summary_3line=build_summary(s, bucket, composite, dart_available),
                suggested_weight=1.0 / (TOP_K_PER_BUCKET * len(BUCKETS)),
                signal_4_basis=s.signal_4_basis,
                quality_insufficient=s.quality_insufficient,
            ))
    return rows


# ============================================================================
# Output
# ============================================================================

def row_to_db_dict(row: ShortListRow) -> dict:
    return {
        "month": row.month,
        "ticker": row.ticker,
        "name": row.name,
        "sector": row.sector,
        "bucket": row.bucket,
        "rank": row.rank,
        "composite_score": row.composite_score,
        "trend_score": row.trend_score,
        "momentum_score": row.momentum_score,
        "volatility_score": row.volatility_score,
        "signal_label": row.signal_label,
        "delta_status": row.delta_status,
        "delta_reason": row.delta_reason,
        "summary_3line": row.summary_3line,
        "suggested_weight": row.suggested_weight,
    }


def row_to_csv_dict(row: ShortListRow) -> dict:
    """CSV backup includes diagnostics that are intentionally not DB columns."""
    return {
        **row_to_db_dict(row),
        "signal_4_basis": row.signal_4_basis,
        "quality_insufficient": row.quality_insufficient,
    }


def validate_shortlist_rows(rows: list[ShortListRow]) -> None:
    """T7e.8 shape contract: exactly 30 rows, 10 per bucket, unique (month,ticker)."""
    bucket_counts = {bucket: 0 for bucket in BUCKETS}
    seen: set[tuple[str, str]] = set()
    duplicates: list[tuple[str, str]] = []
    months = {row.month for row in rows}
    for row in rows:
        if row.bucket not in bucket_counts:
            raise ValueError(f"알 수 없는 bucket입니다: {row.bucket}")
        bucket_counts[row.bucket] += 1
        key = (row.month, row.ticker)
        if key in seen:
            duplicates.append(key)
        seen.add(key)

    if len(months) != 1:
        raise ValueError(f"한 번의 seed payload에는 하나의 month만 허용됩니다: {sorted(months)}")
    if duplicates:
        raise ValueError(f"중복 ticker payload가 감지되었습니다: {duplicates[:5]}")

    expected_total = TOP_K_PER_BUCKET * len(BUCKETS)
    if len(rows) != expected_total:
        raise ValueError(f"Short List row 수가 {expected_total}개가 아닙니다: {len(rows)}개")

    bad_buckets = {
        bucket: count for bucket, count in bucket_counts.items()
        if count != TOP_K_PER_BUCKET
    }
    if bad_buckets:
        raise ValueError(f"bucket별 {TOP_K_PER_BUCKET}개 계약 위반: {bad_buckets}")


def write_csv(path: str, rows: list[ShortListRow]) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(row_to_csv_dict(rows[0]).keys()) if rows else [])
        writer.writeheader()
        for r in rows:
            writer.writerow(row_to_csv_dict(r))


def upsert_supabase(supabase, rows: list[ShortListRow]) -> None:
    """현재 month를 latest 30 rows로 교체한다.

    단순 upsert만 하면 같은 month 재실행 시 이전 실행에서 빠진 ticker가 stale row로
    남을 수 있다. 수동 seed + CSV 백업 전제에서는 month 단위 delete → insert가
    가장 명확한 set-based idempotency다.
    """
    validate_shortlist_rows(rows)
    month = rows[0].month
    payload = [row_to_db_dict(r) for r in rows]
    supabase.table("short_list_30").delete().eq("month", month).execute()
    (
        supabase.table("short_list_30")
        .upsert(payload, on_conflict="month,ticker")
        .execute()
    )


# ============================================================================
# Orchestration
# ============================================================================

def main() -> None:
    parser = argparse.ArgumentParser(description="Tier 0 인디케이터 자동 스크리닝 (T7e.8)")
    parser.add_argument("--month", required=True, type=parse_month, help="YYYY-MM-01")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Supabase write 없이 CSV만 생성")
    mode.add_argument("--apply", action="store_true", help="Supabase upsert 실행")
    parser.add_argument("--csv-backup", required=True, help="CSV 백업 경로 (apply/dry-run 모두 필수)")
    parser.add_argument("--as-of", type=parse_as_of, default=None,
                        help="시장 데이터 기준일 YYYY-MM-DD (기본: 실행일의 전 영업일, 장중 drift 방지)")
    parser.add_argument("--universe-limit", type=int, default=None,
                        help="universe 사이즈 cap (디버깅용, prod 미사용)")
    parser.add_argument(
        "--sector-review-csv",
        default=None,
        help="(B89 strict block, B66 C 하이브리드) unresolved/override trace를 출력할 CSV 경로. "
             "미설정 시 --csv-backup의 stem + '_sector_review.csv'.",
    )
    args = parser.parse_args()

    target_date = resolve_target_date(date.today(), args.as_of)
    if args.month > target_date:
        print(f"[warn] --month {args.month} 이 기준일({target_date})보다 미래입니다 — 기준일 데이터로 산출됩니다.",
              file=sys.stderr)
    print(f"[info] market data as-of: {target_date.isoformat()} "
          f"({'explicit --as-of' if args.as_of else 'previous completed weekday'})",
          file=sys.stderr)

    print(f"[1/7] universe fetch (KOSPI+KOSDAQ, 시총 ≥ {UNIVERSE_FILTERS['min_market_cap_won']:,}원) ...",
          file=sys.stderr, flush=True)
    universe = fetch_universe(target_date, limit=args.universe_limit)
    print(f"      → {len(universe)}개 종목", file=sys.stderr, flush=True)

    dart_key = os.environ.get("DART_API_KEY")
    dart_supabase = None
    dart_available = bool(dart_key)
    if dart_key:
        print("[info] DART Signal 4·5 enabled — Supabase dart_* cache tables required",
              file=sys.stderr)
        dart_supabase = get_supabase_client()
    else:
        print("[warn] DART_API_KEY 없음 — 실적/퀄리티 시그널은 0 처리 "
              "(장기 bucket 의미 약화)",
              file=sys.stderr)

    # B66 C 하이브리드: universe에 sector resolve. dart_supabase로 induty_code lookup.
    # induty 없으면 sector="unresolved" → 후속 B89 strict block 트리거.
    print(f"[1.5/7] B66 sector resolve — dart_corp_codes.induty_code → canonical 14 mapper + override ...",
          file=sys.stderr, flush=True)
    resolve_sectors_for_universe(universe, supabase_client=dart_supabase)
    sector_dist: dict[str, int] = {}
    for u in universe:
        sector_dist[u["sector"]] = sector_dist.get(u["sector"], 0) + 1
    print(f"      → sector 분포: {dict(sorted(sector_dist.items()))}", file=sys.stderr, flush=True)

    print(f"[2/7] per-ticker signals (pykrx OHLCV + 외국인 + DART hook) — {len(universe)}회 호출, 수 분 소요 ...",
          file=sys.stderr, flush=True)
    signals: list[StockSignal] = []
    for i, u in enumerate(universe, start=1):
        if (
            dart_supabase is not None
            and i > 1
            and (i - 1) % SUPABASE_CLIENT_REFRESH_EVERY_N_TICKERS == 0
        ):
            dart_supabase = get_supabase_client()
            print(f"      [refresh] supabase client recreated at ticker {i}",
                  file=sys.stderr, flush=True)
        price = fetch_price_signals(u["ticker"], target_date)
        foreign = fetch_foreign_signal(u["ticker"], target_date)
        dart = fetch_dart_signals(u["ticker"], target_date, dart_key, dart_supabase)
        signals.append(StockSignal(
            ticker=u["ticker"],
            name=u["name"],
            sector=u["sector"],
            market_cap_won=u["market_cap_won"],
            momentum_raw=price["momentum_raw"],
            volume_surge_raw=price["volume_surge_raw"],
            volatility_raw=price["volatility_raw"],
            foreign_net_raw=foreign,
            earnings_raw=dart.earnings_raw,
            quality_metrics=dart.quality_raw_metrics,
            signal_4_basis=dart.signal_4_basis,
            quality_insufficient=dart.quality_insufficient,
        ))
        if i % 100 == 0:
            print(f"      [{i}/{len(universe)}]", file=sys.stderr, flush=True)

    print(f"[3/7] normalize signals (cross-section z → 0~100) ...", file=sys.stderr, flush=True)
    normalize_signals(signals)
    if dart_available:
        try:
            from scripts.dart_signals import compute_quality_composite_for_universe
        except ModuleNotFoundError:
            from dart_signals import compute_quality_composite_for_universe

        quality_scores = compute_quality_composite_for_universe([s.quality_metrics for s in signals])
        for signal, quality_score in zip(signals, quality_scores):
            signal.quality = quality_score

    print(f"[4/7] bucket selection (단/중/장 각 후보 {CANDIDATE_POOL_PER_BUCKET} → 상위 {TOP_K_PER_BUCKET}) ...",
          file=sys.stderr, flush=True)
    selections = select_top_per_bucket(signals)

    prior_tickers: set[str] = set()
    if args.apply:
        print(f"[5/7] prior month tickers fetch ({prev_month_first(args.month).isoformat()}) ...",
              file=sys.stderr, flush=True)
        supabase = get_supabase_client()
        prior_tickers = fetch_prior_month_tickers(supabase, args.month)
        print(f"      → {len(prior_tickers)}개 전월 ticker (delta_status hold 판정용)",
              file=sys.stderr, flush=True)
    else:
        supabase = None

    rows = build_rows(selections, args.month, prior_tickers, dart_available)
    validate_shortlist_rows(rows)

    # B89 strict block (plan §4.3 R1 lock-in): selected 30 rows에 unresolved 있는지 검사.
    # build_rows는 signals를 사용하고, signals.sector는 universe.sector를 그대로 받는다.
    # resolve_sectors_for_universe가 universe에 sector를 설정했으므로 signals/rows의 sector는 정확.
    review_csv_path = args.sector_review_csv or args.csv_backup.replace(".csv", "_sector_review.csv")
    if review_csv_path == args.csv_backup:
        review_csv_path = args.csv_backup + ".sector_review.csv"
    selected_universe_view = [
        {
            "ticker": s.ticker,
            "name": s.name,
            "market": next((u.get("market", "") for u in universe if u["ticker"] == s.ticker), ""),
            "induty_code": next((u.get("induty_code") for u in universe if u["ticker"] == s.ticker), None),
            "sector": s.sector,
            "sector_source": next((u.get("sector_source") for u in universe if u["ticker"] == s.ticker), "unresolved"),
        }
        for s in (signal for bucket_picks in selections.values() for signal, _ in bucket_picks)
    ]
    unresolved_count = write_sector_review_csv(selected_universe_view, review_csv_path)
    print(f"      [B89] sector review CSV → {review_csv_path} (unresolved selected={unresolved_count})",
          file=sys.stderr, flush=True)
    enforce_b89_strict_block(unresolved_count, apply=args.apply, review_csv_path=review_csv_path)

    print(f"[6/7] write CSV backup → {args.csv_backup}", file=sys.stderr, flush=True)
    write_csv(args.csv_backup, rows)

    if args.apply:
        assert supabase is not None
        print(f"[7/7] replace month rows → short_list_30 ({len(rows)} rows, on_conflict=month,ticker)",
              file=sys.stderr, flush=True)
        upsert_supabase(supabase, rows)
        print(f"[done] applied · month={args.month} · rows={len(rows)} · bucket dist short/mid/long="
              f"{sum(1 for r in rows if r.bucket=='short')}/"
              f"{sum(1 for r in rows if r.bucket=='mid')}/"
              f"{sum(1 for r in rows if r.bucket=='long')}",
              file=sys.stderr)
    else:
        print(f"[done] dry-run · month={args.month} · rows={len(rows)} · CSV={args.csv_backup}",
              file=sys.stderr)
        # dry-run: 상위 3종목씩 stdout으로 미리보기
        print("\n--- preview (bucket별 top 3) ---")
        for bucket in BUCKETS:
            picks = [r for r in rows if r.bucket == bucket][:3]
            print(f"[{bucket}]")
            for r in picks:
                print(f"  #{r.rank} {r.ticker} {r.name} ({r.sector}) "
                      f"composite={r.composite_score} signal={r.signal_label} delta={r.delta_status}")


if __name__ == "__main__":
    main()
