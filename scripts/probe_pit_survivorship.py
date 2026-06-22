#!/usr/bin/env python3
"""Step 0 (blocking) — KRX bydd_trd PIT / survivorship feasibility probe (D30, 77차).

SoT: docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md §4/§5 step 0

목적: Tier0 B++ recall 검증이 survivorship-bias-free한지의 **선결 조건**을 재현 가능하게 증명한다.
KRX 공식 Open API `bydd_trd`(일별 전종목 시세)가 과거 날짜에 대해 **그 시점의 universe(이후
상폐/합병된 종목 포함)**를 반환하는지를 확인한다. 반환하면 historical universe 구성이
survivorship-bias-free 이고(상폐 종목이 빠지지 않음), recall 수치가 upper-bound가 아닌 유효값이 된다.

출력은 **구조적 정보만**(카운트·필드명·티커/종목명) — 인증키 등 비밀은 절대 출력하지 않는다.

사용:
    scripts/.venv/bin/python scripts/probe_pit_survivorship.py
    # 또는 --old YYYYMMDD --recent YYYYMMDD 로 날짜 지정

판정:
    PASS = old snapshot이 recent universe에 없는 티커(상폐/합병-at-time)를 포함 → PIT survivorship-free.
    FAIL/UNKNOWN = old=recent universe(생존자만) → harvest에 "recall=upper-bound" 라벨 필요(§4/§5).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


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


def main() -> int:
    parser = argparse.ArgumentParser(description="KRX bydd_trd PIT/survivorship feasibility probe")
    parser.add_argument("--old", default="20241216", help="과거 기준일 YYYYMMDD (월요일 권장)")
    parser.add_argument("--recent", default="20260610", help="최근 기준일 YYYYMMDD")
    parser.add_argument("--market", default="KOSPI", choices=["KOSPI", "KOSDAQ"])
    parser.add_argument("--emit-artifact", default=None,
                        help="(PR-B5) write a per-market 1-element list JSON "
                             "[{market,old_date,recent_date,old_count,recent_count,gone_count,exit_status,schema_version}] "
                             "for shadow_eval.read_survivorship_artifact. Run per market + merge the lists. "
                             "Default None → no file, exit codes/prints byte-identical.")
    args = parser.parse_args()

    _load_env()
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from krx_openapi import fetch_bydd_trd

    rows_recent = fetch_bydd_trd(args.market, args.recent)
    rows_old = fetch_bydd_trd(args.market, args.old)
    print(f"[probe] {args.market} recent={args.recent}: {len(rows_recent)} rows · old={args.old}: {len(rows_old)} rows")

    def _emit(status: int, gone_count) -> None:
        """(PR-B5) additive — write the per-market artifact iff --emit-artifact set. import json
        inside the guard so the default path is statement-identical (behavioral byte-identical)."""
        if not args.emit_artifact:
            return
        import json
        Path(args.emit_artifact).write_text(json.dumps([{
            "market": args.market, "old_date": args.old, "recent_date": args.recent,
            "old_count": len(rows_old), "recent_count": len(rows_recent),
            "gone_count": gone_count, "exit_status": status, "schema_version": 1}], ensure_ascii=False))

    if not rows_recent or not rows_old:
        print("[UNKNOWN] 한쪽 snapshot이 비어있음(휴장/미갱신?) — 다른 날짜로 재시도.")
        _emit(2, None)   # gone undefined on this path → gone_count None
        return 2

    # 필드 가용성 (B++ ADV/size/52주고가의 무비용 소스).
    sample = rows_recent[0]
    for fld in ("ACC_TRDVAL", "MKTCAP", "LIST_SHRS", "TDD_HGPRC"):
        print(f"[probe] field {fld} present: {fld in sample}")

    set_recent = {r.get("ISU_CD") for r in rows_recent}
    set_old = {r.get("ISU_CD") for r in rows_old}
    gone = set_old - set_recent  # old에 거래됐으나 recent universe엔 부재 = 상폐/합병/개명-at-time
    new = set_recent - set_old
    print(f"[probe] old-only tickers (gone by recent — delisted/merged at-time): {len(gone)}")
    print(f"[probe] recent-only tickers (listed since): {len(new)}")
    examples = [(r.get("ISU_CD"), r.get("ISU_NM")) for r in rows_old if r.get("ISU_CD") in gone][:8]
    print(f"[probe] examples of PIT-only (in old, absent now): {examples}")

    if gone:
        print("[PASS] old snapshot이 이후 사라진 종목을 포함 → KRX bydd_trd historical = PIT universe "
              "(survivorship-bias-free). recall 검증 유효(upper-bound 라벨 불요).")
        _emit(0, len(gone))
        return 0
    print("[FAIL] old=recent universe(생존자만 반환 정황) → harvest는 'recall=upper-bound' 라벨 + "
          "신뢰도 하향 필요(§4/§5).")
    _emit(1, len(gone))
    return 1


if __name__ == "__main__":
    sys.exit(main())
