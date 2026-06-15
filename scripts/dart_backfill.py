#!/usr/bin/env python3
"""주픽(JooPick) — DART 실적 PIT 백필 (B+C, 다중장세 4-config 검증용).

SoT: docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md (B+C)

목적: validate_tier0_ic 하버스트의 earnings(configs 3·4)를 PIT-정확히 활성화하기 위해, 표준 분기/연간
재무를 **공시일(rcept_dt = rcept_no[:8])과 함께** 로컬 JSONL 캐시로 백필한다. **production Supabase는
절대 안 건드린다**(read-only DART HTTP + 로컬 파일 쓰기만). 하버스트는 --dart-backfill-path로 이 파일을
production preload 위에 overlay → availability 게이트(rcept_dt ≤ as_of) 통과 → 실 earnings.

특징(설계 DART-BACKFILL):
- **rcept_dt 무료**: financial 응답의 rcept_no 앞 8자리 = 공시일. 별도 API 불필요.
- **resumable**: JSONL에 이미 있는 (corp, period_type, period_key)는 skip(--resume). 배치마다 flush.
- **rate-limit**: DART status 020(사용한도 초과)/429 → 즉시 hard-stop(다음 날 --resume). 013(무자료) →
  정상 기록(재시도 안 함). --max-calls 일일 상한.
- **범위**: 유동 universe(패널 ADV60 ≥ MIN_ADV)만 — B++는 유동 종목만 점수내므로. corp_code 매핑은
  dart_corp_codes. 빠진 ticker/period → 하버스트에서 neutral-50 구조적 결측(크래시 없음).
- **--dry-estimate**: 실제 fetch 전 콜 수·예상 시간만 출력.

사용:
    scripts/.venv/bin/python scripts/dart_backfill.py --start-month 2022-01-01 --end-month 2025-12-01 \
        --cache-dir scripts/out/pit_cache --out scripts/out/dart_backfill.jsonl --dry-estimate
    # 실제(여러 날 걸칠 수 있음): --dry-estimate 빼고 --max-calls 19000 --resume
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import date
from pathlib import Path
from typing import Optional

_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_DIR))


def _load_env() -> None:
    env = _DIR.parent / "tudal/.env.local"
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


def required_periods(start_month: date, end_month: date) -> list[tuple[str, str, str]]:
    """백필 대상 (period_type, period_key, reprt_code). determine_target_quarter + YoY + 퀄리티 annual을
    모두 덮도록: 연간 [start_year-2 .. end_year], 분기 Q1/H1/9M [start_year-1 .. end_year]."""
    import dart_signals as D
    # omxy BC-R1 #3: signal dependency closure. 가장 이른 선정월(예 2022-01)의
    # _latest_safe_annual_year → year-2 + 그 YoY base(-1) = annual start_year-3 까지. 분기 standalone +
    # YoY prior-year quarter = quarterly start_year-2 까지. (이하 범위는 모든 selection-month 의존을 덮음)
    out: list[tuple[str, str, str]] = []
    for yr in range(start_month.year - 3, end_month.year + 1):
        out.append(("annual", str(yr), D.REPORT_CODE_MAP["annual"]))
    for yr in range(start_month.year - 2, end_month.year + 1):
        for kind in ("Q1", "H1", "9M"):
            out.append(("quarterly", D.PERIOD_KEY_MAP[kind].format(year=yr), D.REPORT_CODE_MAP[kind]))
    return out


def liquid_corp_universe(start_month: date, end_month: date, cache_dir: Path,
                         supabase) -> dict[str, str]:
    """패널(캐시) + 월별 universe로 **유동(ADV60≥MIN_ADV)** ticker 합집합 → {ticker: corp_code}.

    패널은 cache_dir에서 로드(캐시 hit → fast). 월별 fetch_universe로 universe, 패널 슬라이스로 ADV60.
    """
    import validate_tier0_ic as V
    import tier0_factors as F
    import screen_shortlist_tier0 as S
    from datetime import timedelta

    # 패널 로드 (캐시). 백필 기간 전체 + lookback.
    panel_start = date(start_month.year, start_month.month, 1) - timedelta(days=S.BPP_LOOKBACK_CALENDAR_DAYS)
    panel_end = min(date.today(), end_month + timedelta(days=210))
    span = (panel_end - panel_start).days + 1
    all_days = [panel_end - timedelta(days=o) for o in range(span)]
    bas_dds = sorted(d.strftime("%Y%m%d") for d in all_days if d.weekday() < 5)
    print(f"[backfill] loading panel {bas_dds[0]}~{bas_dds[-1]} (cache hits expected) ...", file=sys.stderr, flush=True)
    panel = V.load_pit_panel(bas_dds, cache_dir=cache_dir, progress=True)
    dates = V.panel_trading_days(panel)
    series = V.build_series_by_ticker(panel, dates)

    liquid_tickers: set[str] = set()
    for t in V.iter_selection_months(start_month, end_month):
        sel_idx = V.selection_index(dates, t)
        if sel_idx < 0:
            continue
        sel_obj = date(int(dates[sel_idx][:4]), int(dates[sel_idx][4:6]), int(dates[sel_idx][6:8]))
        sliced = V.slice_series_at(series, dates[sel_idx])
        uni = S.fetch_universe(sel_obj)
        for u in uni:
            s = sliced.get(u["ticker"])
            if s and F.liquidity_floor_pass(F.adv60(s["trdvals"])):
                liquid_tickers.add(u["ticker"])
    print(f"[backfill] liquid universe union: {len(liquid_tickers)} tickers", file=sys.stderr, flush=True)

    # ticker → corp_code (dart_corp_codes, chunked)
    tk_to_corp: dict[str, str] = {}
    tickers = sorted(liquid_tickers)
    for i in range(0, len(tickers), 500):
        chunk = tickers[i:i + 500]
        res = supabase.table("dart_corp_codes").select("ticker, corp_code").in_("ticker", chunk).execute()
        for row in (res.data or []):
            if row.get("ticker") and row.get("corp_code"):
                tk_to_corp[row["ticker"]] = row["corp_code"]
    print(f"[backfill] corp_code resolved for {len(tk_to_corp)}/{len(tickers)} tickers", file=sys.stderr, flush=True)
    return tk_to_corp


class RateLimitError(RuntimeError):
    """rate/quota(020/021/한도/HTTP 429) — 오늘 소진. hard-stop, 내일 --resume."""


class FatalConfigError(RuntimeError):
    """credential/IP/account 결함(010/011/012/901) — 재시도 무의미. hard-stop, 사람이 키/IP 점검."""


# omxy BC-R3 #1: 재시도해도 안 풀리는 치명 status — skip-and-continue 하면 전 run을 태운다.
_FATAL_DART_STATUS = {"010", "011", "012", "901"}


def _redact(text: object, api_key: Optional[str]) -> str:
    """omxy BC-R3 #3: 예외/URL 문자열의 crtfc_key 노출 차단(raise_for_status는 query 포함 URL을 담는다)."""
    s = str(text)
    if api_key:
        s = s.replace(api_key, "***")
    return re.sub(r"(crtfc_key=)[^&\s]+", r"\1***", s)


def _fetch_one(corp_code: str, bsns_year: str, reprt_code: str, api_key: str) -> tuple[dict, int]:
    """단일 (corp, period) DART fetch (CFS→OFS) → (row, http_calls).

    omxy BC-R1/R3 정합:
    - #1 HTTP 429 → RateLimitError **hard-stop**(raise_for_status가 일반 예외로 삼키기 전에 검사).
    - #2 **양 scope 모두 013(무자료)** 일 때만 no_data 캐시(genuine). 예상외 status는 transient(RuntimeError →
      호출부 skip·미기록 → resume서 재시도) — 일시 오류를 영구 no_data로 poison하지 않는다.
    - status 020/021/한도 → RateLimitError hard-stop.
    - #4 http_calls 반환(CFS→OFS 최대 2) → 호출부 일일 예산 정확 계수.
    - R3#1 010/011/012/901(키/IP/계정) → FatalConfigError hard-stop(transient skip 금지 — run 태움).
    - R3#2 status 000 이라도 rcept_dt + 파싱된 재무 ≥1 없으면 'ok' 금지. 양 scope 모두 malformed-000 →
      'schema_empty'(ok 아님 → availability에서 disclosed-with-data 로 오인되지 않음, resume 안정 위해 기록).
    rcept_dt = list[0].rcept_no[:8] (공시일; 한 보고서 line item은 동일 rcept_no 공유).
    """
    import requests
    import dart_signals as D
    http_calls = 0
    saw_013 = False
    saw_malformed_000 = False
    for scope in ("CFS", "OFS"):
        params = {"crtfc_key": api_key, "corp_code": corp_code, "bsns_year": bsns_year,
                  "reprt_code": reprt_code, "fs_div": scope}
        resp = requests.get(D.DART_FNLTT_URL, params=params, timeout=30)
        http_calls += 1
        if resp.status_code == 429:
            raise RateLimitError("HTTP 429 rate limit")
        resp.raise_for_status()
        payload = resp.json()
        status = payload.get("status")
        if status == "000":
            parsed, _alias = D.parse_dart_financial_response(payload)
            items = payload.get("list", [])
            rcept_no = str(items[0].get("rcept_no", "")) if items else ""
            rcept_dt = rcept_no[:8] if len(rcept_no) >= 8 else None
            has_content = any(parsed.get(k) is not None for k in D.FINANCIAL_KEYS)
            # R3#2: rcept_dt + 실 재무 ≥1 둘 다 있어야 genuine 'ok'. 아니면 malformed-000(다음 scope 시도).
            if rcept_dt and has_content:
                row = {"status": "ok", "statement_scope": scope, "rcept_dt": rcept_dt}
                row.update({k: parsed.get(k) for k in D.FINANCIAL_KEYS})
                return row, http_calls
            saw_malformed_000 = True
            continue
        if status == "013":
            saw_013 = True
            continue  # CFS 무자료 → OFS 시도
        if status in ("020", "021") or "한도" in str(payload.get("message", "")):
            raise RateLimitError(f"DART rate/quota limit: status={status}")
        if status in _FATAL_DART_STATUS:
            raise FatalConfigError(f"DART fatal status={status} (키/IP/계정 점검 필요)")
        # 예상외 status(100/800/900 등) → transient(캐시 금지, resume서 재시도)
        raise RuntimeError(f"unexpected DART status={status} msg={payload.get('message', '')}")
    if saw_malformed_000:  # 000 이지만 양 scope 모두 rcept_dt/재무 결여 → schema_empty(ok 아님, 기록)
        return ({"status": "schema_empty", "statement_scope": "NONE", "rcept_dt": None,
                 **{k: None for k in D.FINANCIAL_KEYS}}, http_calls)
    if saw_013:  # 양 scope 모두 013 → 진짜 무자료(캐시)
        return ({"status": "no_data", "statement_scope": "NONE", "rcept_dt": None,
                 **{k: None for k in D.FINANCIAL_KEYS}}, http_calls)
    raise RuntimeError("no conclusive DART status (transient) — retry on resume")


def load_done(out_path: Path) -> set[tuple[str, str, str]]:
    """기존 JSONL에서 완료된 (corp, period_type, period_key) 집합 (resume)."""
    done: set[tuple[str, str, str]] = set()
    if not out_path.exists():
        return done
    for line in out_path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            r = json.loads(line)
            done.add((r.get("corp_code"), r.get("period_type"), r.get("period_key")))
        except ValueError:
            continue
    return done


def main() -> None:
    parser = argparse.ArgumentParser(description="DART 실적 PIT 백필 (rcept_dt 로컬 캐시, B+C)")
    parser.add_argument("--start-month", required=True, help="YYYY-MM-01")
    parser.add_argument("--end-month", required=True, help="YYYY-MM-01")
    parser.add_argument("--cache-dir", default="scripts/out/pit_cache")
    parser.add_argument("--out", default="scripts/out/dart_backfill.jsonl")
    parser.add_argument("--dry-estimate", action="store_true", help="콜 수·예상 시간만(fetch 안 함)")
    parser.add_argument("--max-calls", type=int, default=19000, help="이번 실행 콜 상한(일일 한도 대비 안전)")
    parser.add_argument("--resume", action="store_true", help="기존 out JSONL의 완료분 skip")
    parser.add_argument("--pace-sec", type=float, default=0.12, help="콜 간 간격(throttle)")
    args = parser.parse_args()

    _load_env()
    api_key = os.environ.get("DART_API_KEY")
    if not api_key:
        sys.exit("DART_API_KEY 필요")
    start_month = date.fromisoformat(args.start_month)
    end_month = date.fromisoformat(args.end_month)

    sys.path.insert(0, str(_DIR))
    import screen_shortlist_tier0 as S
    supabase = S.get_supabase_client()

    periods = required_periods(start_month, end_month)
    tk_to_corp = liquid_corp_universe(start_month, end_month, Path(args.cache_dir), supabase)
    corps = sorted(set(tk_to_corp.values()))
    total = len(corps) * len(periods)
    print(f"[backfill] {len(corps)} corps × {len(periods)} periods = {total:,} fetches "
          f"(periods: {[p[1] for p in periods]})", file=sys.stderr)

    out_path = Path(args.out)
    done = load_done(out_path) if args.resume else set()
    todo = [(c, pt, pk, rc) for c in corps for (pt, pk, rc) in periods if (c, pt, pk) not in done]
    # omxy BC-R2: 추정은 HTTP 콜 기준 (period당 1~2 HTTP: CFS, OFS fallback). 보수=×2.
    http_lo, http_hi = len(todo), len(todo) * 2
    print(f"[backfill] todo {len(todo):,} periods (done {len(done):,}) · HTTP est {http_lo:,}~{http_hi:,} "
          f"@ {args.pace_sec + 0.4:.2f}s/call = ~{http_lo * (args.pace_sec + 0.4) / 3600:.1f}~"
          f"{http_hi * (args.pace_sec + 0.4) / 3600:.1f}h · 일일 한도~2만 → ~{http_lo / 19000:.1f}~{http_hi / 19000:.1f}일",
          file=sys.stderr)
    if args.dry_estimate:
        print("[backfill] --dry-estimate: fetch 안 함. 위 추정치 확인 후 플래그 제거하고 실행하세요.", file=sys.stderr)
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)
    calls = 0           # 실제 HTTP 콜 수 (일일 예산)
    done_periods = 0    # 이번 실행 처리한 (corp, period) 수
    consec_skip = 0     # omxy BC-R3: 연속 transient skip — 임계 초과 시 systemic 결함으로 보고 abort
    with out_path.open("a") as f:
        for i, (corp, pt, pk, rc) in enumerate(todo):
            # omxy BC-R2: period당 최대 2 HTTP(CFS+OFS) → 시작 전 2 예약. 절대 max_calls 초과 안 함.
            if calls + 2 > args.max_calls:
                print(f"[backfill] --max-calls {args.max_calls} 도달(HTTP {calls:,}) → 중단. 내일 --resume 으로 재개.", file=sys.stderr)
                break
            yr = pk.split("-")[0]
            try:
                row, n_http = _fetch_one(corp, yr, rc, api_key)
            except RateLimitError as exc:
                print(f"[backfill] {_redact(exc, api_key)} → hard-stop. 내일 --resume.", file=sys.stderr)
                break
            except FatalConfigError as exc:  # omxy BC-R3 #1: 키/IP/계정 결함 → 즉시 중단(run 태움 방지)
                print(f"[backfill] {_redact(exc, api_key)} → FATAL hard-stop. 키/IP/계정 점검 후 --resume.", file=sys.stderr)
                break
            except Exception as exc:  # noqa: BLE001 — transient(네트워크/예상외 status): 기록 없이 skip(resume 재시도)
                consec_skip += 1
                print(f"[warn] {corp} {pk}: {type(exc).__name__} {_redact(exc, api_key)} — skip(미기록) [{consec_skip}연속]", file=sys.stderr)
                calls += 2  # 보수적(최대 2 HTTP 소비 가정)
                if consec_skip >= 50:  # omxy BC-R3: 연속 50 transient → systemic(네트워크/파서/잘못된 입력) → abort
                    print("[backfill] 연속 50 transient skip → systemic 결함 의심, abort. 로그 점검 후 --resume.", file=sys.stderr)
                    break
                time.sleep(args.pace_sec)
                continue
            consec_skip = 0
            row.update({"corp_code": corp, "period_type": pt, "period_key": pk})
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            calls += n_http  # omxy #4: 실제 HTTP 콜 수(CFS→OFS 최대 2)로 일일 예산 계수
            done_periods += 1
            if done_periods % 200 == 0:
                f.flush()
                print(f"[backfill] periods {done_periods:,}/{len(todo):,} · HTTP {calls:,} (이번 실행)",
                      file=sys.stderr, flush=True)
            time.sleep(args.pace_sec)
    print(f"[backfill] 이번 실행: periods {done_periods:,} · HTTP {calls:,} → {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
