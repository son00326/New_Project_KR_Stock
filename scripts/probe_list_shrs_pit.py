#!/usr/bin/env python3
"""BLOCKING PRECONDITION 1 — LIST_SHRS(상장주식수) PIT-safety proof (C net-issuance, 2026-06-18).

SoT: docs/superpowers/2026-06-18-tier0-net-issuance.md §2 (pre-registered, frozen before run)

목적(omxy lock): net-issuance 시그널은 LIST_SHRS 시계열에서 산출된다. 이 필드가 **PIT-safe**
(과거 날짜 파일이 그 시점의 as-of 발행주식수 → 효력 발생일 이후에만 변동, 미래 누설 없음)인지를
재현 가능하게 증명한다. backfill된 current-master 필드라면(= 모든 과거 날짜에 오늘의 주식수가 박혀
있으면) look-ahead leak이므로 시그널 전체가 무효다.

증거는 전부 **offline `scripts/out/pit_cache/{MARKET}_{YYYYMMDD}.json`** 에서(비용 0, HTTP 없음).
인증키·비밀은 출력하지 않는다(구조적 정보·티커/종목명만).

PRE-REGISTERED ASSERTIONS (frozen, no tune-to-pass):
  (a) flat-before-effective  — 알려진 corporate-action 효력일 **직전** LIST_SHRS가 평평(변동 없음).
  (b) change-on-effective    — 효력일 **당일/이후**에만 LIST_SHRS가 변동(더 이른 날짜에 미리 안 나타남).
  (c) stable control         — 무이벤트 대형주(삼성전자)는 한 해 내내 LIST_SHRS 불변.
  (d) newly-listed-no-history — IPO 종목은 상장일 **이전** 캐시에 부재(pre-history 없음 → 구조적 결측).

판정: 4개 모두 PASS → pit_status="PIT_PROVEN". 하나라도 FAIL(예: 변동이 효력일보다 먼저 등장) →
pit_status="PIT_ASSUMED" + 하버스트/adjudicator에서 어떤 triple-gate PASS도 decision-grade로 읽지 못하게
fail-closed(§2 HARD GUARD).

사용:
    scripts/.venv/bin/python scripts/probe_list_shrs_pit.py
    scripts/.venv/bin/python scripts/probe_list_shrs_pit.py --json scripts/out/net_issuance/list_shrs_pit.json
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Optional

CACHE_DIR_DEFAULT = Path(__file__).resolve().parent.parent / "scripts" / "out" / "pit_cache"


# ---------------------------------------------------------------------------
# PRE-REGISTERED corporate-action sample table (frozen — known KRX effective dates).
# 각 샘플은 (market, code, name, kind, before_dates, on_or_after_dates) — before_dates는 효력일 직전
# 거래일들(여기서 LIST_SHRS는 옛 값으로 평평해야 함), on_or_after_dates는 효력일/이후(새 값이어야 함).
# ---------------------------------------------------------------------------
SAMPLES_DILUTION = [
    {
        "market": "KOSPI", "code": "042660", "name": "한화오션(구 대우조선해양)",
        "kind": "유상증자/자본확충 (rights/capital increase)",
        # 107,290,669 → 211,729,312 효력 2023-06-13 (close ~flat → 진성 희석, 분할 아님).
        "before": ["20230609", "20230612"], "effective": "20230613", "after": ["20230614"],
    },
]
SAMPLES_EXTREME = [
    {
        "market": "KOSDAQ", "code": "247540", "name": "에코프로비엠",
        "kind": "발행주식수 4x corporate-action (분할/무상증자류 — extreme jump)",
        # 24,450,336 → 97,801,344 효력 2022-07-15 (≈4x, mcap도 ≈4x).
        "before": ["20220708", "20220714"], "effective": "20220715", "after": ["20220718"],
    },
]
SAMPLE_CONTROL = {
    "market": "KOSPI", "code": "005930", "name": "삼성전자",
    "kind": "stable control (무이벤트)",
    "dates": ["20220103", "20220701", "20221229"],
}
SAMPLE_IPO = {
    "market": "KOSPI", "code": "373220", "name": "LG에너지솔루션",
    "kind": "IPO 2022-01-27 (newly-listed)",
    "pre_listing": ["20220126"], "post_listing": ["20220127", "20220128"],
}


def _to_float(x: object) -> float:
    try:
        if x is None or x == "":
            return math.nan
        return float(str(x).replace(",", ""))
    except (ValueError, TypeError):
        return math.nan


def _load(cache_dir: Path, market: str, dd: str) -> Optional[list[dict]]:
    f = cache_dir / f"{market}_{dd}.json"
    if not f.exists():
        return None
    try:
        return json.loads(f.read_text())
    except (ValueError, OSError):
        return None


def _shrs_at(cache_dir: Path, market: str, code: str, dd: str) -> tuple[str, float]:
    """('present'|'nofile'|'absent', LIST_SHRS). absent = 파일은 있으나 종목 부재(상장 전 등)."""
    rows = _load(cache_dir, market, dd)
    if rows is None:
        return ("nofile", math.nan)
    for r in rows:
        if r.get("ISU_CD") == code:
            return ("present", _to_float(r.get("LIST_SHRS")))
    return ("absent", math.nan)


def main() -> int:
    parser = argparse.ArgumentParser(description="LIST_SHRS PIT-safety proof (offline, cost 0)")
    parser.add_argument("--cache-dir", default=str(CACHE_DIR_DEFAULT))
    parser.add_argument("--json", default=None, help="아티팩트 JSON 출력 경로(하버스트가 consume)")
    args = parser.parse_args()
    cache_dir = Path(args.cache_dir)

    evidence: list[dict] = []
    fails: list[str] = []

    # (a)+(b) dilution + extreme: flat-before + change-on-effective + no-earlier-appearance.
    for grp_name, grp in (("dilution", SAMPLES_DILUTION), ("extreme", SAMPLES_EXTREME)):
        for s in grp:
            mk, code = s["market"], s["code"]
            before_vals = [(_d, _shrs_at(cache_dir, mk, code, _d)) for _d in s["before"]]
            eff_status, eff_val = _shrs_at(cache_dir, mk, code, s["effective"])
            after_vals = [(_d, _shrs_at(cache_dir, mk, code, _d)) for _d in s["after"]]
            old_present = [v for _d, (st, v) in before_vals if st == "present" and not math.isnan(v)]
            row = {
                "group": grp_name, "code": code, "name": s["name"], "kind": s["kind"],
                "effective": s["effective"],
                "before": {d: (st, None if math.isnan(v) else v) for d, (st, v) in before_vals},
                "on_effective": [eff_status, None if math.isnan(eff_val) else eff_val],
                "after": {d: (st, None if math.isnan(v) else v) for d, (st, v) in after_vals},
            }
            # (a) flat-before: 모든 before 값이 동일(변동 없음).
            if not old_present:
                fails.append(f"{code}: before-effective LIST_SHRS 미가용")
            elif len(set(old_present)) != 1:
                fails.append(f"{code}: before-effective LIST_SHRS가 평평하지 않음 {old_present}")
            # (b) change-on-effective: 효력일 값이 옛 값과 다르고(변동 발생), 효력일 직전엔 옛 값(미리 안 나타남).
            if eff_status != "present" or math.isnan(eff_val):
                fails.append(f"{code}: 효력일 {s['effective']} LIST_SHRS 미가용")
            elif old_present and eff_val == old_present[-1]:
                fails.append(f"{code}: 효력일 {s['effective']}에 변동이 없음(효력일 정의 오류 또는 미반영)")
            elif old_present and eff_val <= max(old_present):
                # dilution/extreme = 발행주식 증가. 감소면 알려진 이벤트와 불일치.
                fails.append(f"{code}: 효력일 변동이 증가가 아님 (old={old_present[-1]} eff={eff_val})")
            evidence.append(row)

    # (c) stable control — 무이벤트 종목은 LIST_SHRS 불변.
    ctrl = SAMPLE_CONTROL
    ctrl_vals = [(_d, _shrs_at(cache_dir, ctrl["market"], ctrl["code"], _d)[1]) for _d in ctrl["dates"]]
    ctrl_present = [v for _d, v in ctrl_vals if not math.isnan(v)]
    ctrl_row = {"group": "control", "code": ctrl["code"], "name": ctrl["name"],
                "values": {d: (None if math.isnan(v) else v) for d, v in ctrl_vals}}
    if len(ctrl_present) < 2:
        fails.append(f"{ctrl['code']}: control LIST_SHRS 표본 부족")
    elif len(set(ctrl_present)) != 1:
        fails.append(f"{ctrl['code']}: control LIST_SHRS가 변동함 {ctrl_present} (backfilled-master 의심)")
    evidence.append(ctrl_row)

    # (d) newly-listed-no-history — IPO 전엔 캐시에 부재.
    ipo = SAMPLE_IPO
    pre = [(_d, _shrs_at(cache_dir, ipo["market"], ipo["code"], _d)) for _d in ipo["pre_listing"]]
    post = [(_d, _shrs_at(cache_dir, ipo["market"], ipo["code"], _d)) for _d in ipo["post_listing"]]
    ipo_row = {"group": "ipo", "code": ipo["code"], "name": ipo["name"],
               "pre_listing": {d: st for d, (st, _v) in pre},
               "post_listing": {d: [st, None if math.isnan(v) else v] for d, (st, v) in post}}
    if any(st == "present" for _d, (st, _v) in pre):
        fails.append(f"{ipo['code']}: IPO 상장일 이전 캐시에 존재(pre-history 누설)")
    if not any(st == "present" for _d, (st, _v) in post):
        fails.append(f"{ipo['code']}: IPO 상장일 이후 캐시에 부재(샘플/캐시 오류)")
    evidence.append(ipo_row)

    pit_status = "PIT_PROVEN" if not fails else "PIT_ASSUMED"

    print(f"[probe-list-shrs] cache_dir={cache_dir}")
    for ev in evidence:
        if ev["group"] in ("dilution", "extreme"):
            print(f"  [{ev['group']}] {ev['code']} {ev['name']} eff={ev['effective']} "
                  f"before={ev['before']} on_eff={ev['on_effective']} after={ev['after']}")
        elif ev["group"] == "control":
            print(f"  [control] {ev['code']} {ev['name']} values={ev['values']}")
        elif ev["group"] == "ipo":
            print(f"  [ipo] {ev['code']} {ev['name']} pre={ev['pre_listing']} post={ev['post_listing']}")
    print(f"[probe-list-shrs] assertions: (a)flat-before (b)change-on-effective (c)stable-control (d)ipo-no-history")
    if fails:
        for f in fails:
            print(f"  [FAIL] {f}")
    print(f"[probe-list-shrs] pit_status={pit_status}")

    artifact = {
        "probe": "list_shrs_pit",
        "pit_status": pit_status,
        "cache_dir": str(cache_dir.resolve()),
        "fails": fails,
        "evidence": evidence,
        "assertions": [
            "flat-before-effective", "change-on-effective",
            "stable-control-unchanged", "newly-listed-no-pre-history",
        ],
        "note": (
            "LIST_SHRS는 KRX bydd_trd 일별 스냅샷(close/mcap과 동일 provenance, 이미 PIT-proven). "
            "PIT_ASSUMED이면 HARD GUARD: 어떤 triple-gate PASS도 decision-grade 아님(fail-closed)."
        ),
    }
    if args.json:
        out = Path(args.json)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(artifact, ensure_ascii=False, indent=2))
        print(f"[probe-list-shrs] artifact → {out}")

    return 0 if pit_status == "PIT_PROVEN" else 1


if __name__ == "__main__":
    sys.exit(main())
