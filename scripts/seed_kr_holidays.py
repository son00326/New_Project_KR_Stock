#!/usr/bin/env python3
"""
주픽(JooPick) — KRX 영업일 SQL seed 생성기
==========================================

목적
----
pykrx에서 KRX 공식 개장일을 조회해 Supabase `public.kr_business_days` 테이블을
갱신하는 SQL UPDATE 블록을 `stdout`으로 출력한다.

사용 맥락
---------
- **T3.1 (2026-04 S3 킥오프)**: 본 스크립트의 산출 SQL 대신 0004 마이그레이션에
  2024~2026 수기 UPDATE 블록이 이미 포함됨 (Homebrew Python 3.14 PEP 668 제약으로
  개발 시점에는 venv 설치 없이 수기 커버리지 우선).
- **S5 M10 월간 배치 (향후)**: 매월 다음달 영업일을 리프레시할 때 본 스크립트를
  venv 환경에서 실행. 2027년 이후 공휴일도 본 스크립트로 생성.
- **임시공휴일 대응**: 정부 발표 후 `--from YYYY-MM-DD --to YYYY-MM-DD` 재실행 →
  산출 SQL을 수기 또는 배치 파이프라인으로 주입.

설치 (venv 필수)
----------------
```bash
cd /Users/yong/New_Project_KR_Stock
python3 -m venv scripts/.venv
source scripts/.venv/bin/activate
pip install pykrx
python3 scripts/seed_kr_holidays.py --from 2027-01-01 --to 2030-12-31 \
    > scripts/kr_holidays_2027_2030.sql
```

주의
----
- Homebrew Python 3.14는 PEP 668로 system pip 설치 차단 → venv 필수.
- pykrx 공식 지원 파이썬 ≤ 3.13 (2026-04 기준). 3.14 호환성은 런타임 검증 필요.
- 본 스크립트는 주말은 로컬 판정, 평일 공휴일은 pykrx `get_nearest_business_day_in_a_week`로
  일자별 판정. 임시공휴일은 pykrx 배포 스냅샷 시점 한정 — 공휴일 명칭은 플레이스홀더
  (`KRX 휴장`)로 기록되고, 사후 수기 갱신 권장.
- 0004 마이그레이션의 수기 UPDATE 블록과 충돌 시 본 스크립트 산출이 **후속 적용**됨
  (UPDATE는 멱등).
"""
import argparse
import sys
from datetime import date, timedelta


def ensure_pykrx():
    try:
        from pykrx import stock  # noqa: F401
    except ImportError:
        sys.stderr.write(
            "pykrx가 설치되지 않았습니다. venv 환경에서 `pip install pykrx` 후 재실행하세요.\n"
            "Homebrew Python은 PEP 668 제약이 있으므로 시스템 pip 설치는 실패합니다.\n"
        )
        sys.exit(1)


def generate_sql(start: date, end: date) -> str:
    """start..end 범위의 UPDATE SQL 블록 생성.

    - 주말(ISO weekday 6·7)은 `is_business_day = false` (holiday_name NULL 유지).
    - 평일 중 pykrx가 '가장 가까운 개장일'로 자기 자신을 리턴하지 않으면 휴장일로 판정.
    """
    from pykrx import stock

    lines: list[str] = []
    current = start
    while current <= end:
        iso = current.isoformat()
        if current.weekday() >= 5:
            lines.append(
                f"update public.kr_business_days set is_business_day = false "
                f"where date = '{iso}';"
            )
        else:
            try:
                nearest = stock.get_nearest_business_day_in_a_week(current.strftime("%Y%m%d"))
                is_biz = nearest == current.strftime("%Y%m%d")
            except Exception as exc:  # noqa: BLE001
                sys.stderr.write(f"[warn] pykrx 조회 실패 {iso}: {exc}. 평일=영업일로 간주.\n")
                is_biz = True
            if not is_biz:
                lines.append(
                    f"update public.kr_business_days set is_business_day = false, "
                    f"holiday_name = 'KRX 휴장' where date = '{iso}';"
                )
        current += timedelta(days=1)
    return "\n".join(lines)


def main() -> None:
    ensure_pykrx()

    parser = argparse.ArgumentParser(description="KRX 영업일 SQL seed 생성기")
    parser.add_argument("--from", dest="start", required=True, help="YYYY-MM-DD")
    parser.add_argument("--to", dest="end", required=True, help="YYYY-MM-DD")
    args = parser.parse_args()

    start = date.fromisoformat(args.start)
    end = date.fromisoformat(args.end)
    if start > end:
        sys.exit("--from 이 --to 보다 이후입니다.")

    print("-- 생성 도구: scripts/seed_kr_holidays.py")
    print(f"-- 범위: {start.isoformat()} ~ {end.isoformat()}")
    print("-- holiday_name 은 'KRX 휴장' 플레이스홀더 — 공식 명칭은 수기 갱신.")
    print("-- 본 블록은 0004 마이그레이션의 §3 generate_series seed 선행이 전제.")
    print()
    print(generate_sql(start, end))


if __name__ == "__main__":
    main()
