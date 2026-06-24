import importlib.util
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


SCRIPT_PATH = Path(__file__).with_name("screen_shortlist_tier0.py")
SPEC = importlib.util.spec_from_file_location("screen_shortlist_tier0", SCRIPT_PATH)
assert SPEC is not None
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def stock_signal(ticker: str, score: float, sector: str = "테스트"):
    return MODULE.StockSignal(
        ticker=ticker,
        name=ticker,
        sector=sector,
        market_cap_won=1,
        momentum=score,
        volume_surge=score,
        foreign_net=score,
        earnings=score,
        quality=score,
    )


class ScreenShortlistTier0Test(unittest.TestCase):
    def test_resolve_target_date_defaults_to_previous_completed_weekday(self):
        self.assertEqual(
            MODULE.resolve_target_date(
                run_date=MODULE.date(2026, 5, 12),
                requested_as_of=None,
            ),
            MODULE.date(2026, 5, 11),
        )
        self.assertEqual(
            MODULE.resolve_target_date(
                run_date=MODULE.date(2026, 5, 11),
                requested_as_of=None,
            ),
            MODULE.date(2026, 5, 8),
        )

    def test_resolve_target_date_uses_explicit_as_of_snapshot(self):
        self.assertEqual(
            MODULE.resolve_target_date(
                run_date=MODULE.date(2026, 5, 12),
                requested_as_of=MODULE.date(2026, 5, 12),
            ),
            MODULE.date(2026, 5, 12),
        )

    def test_select_top_per_bucket_keeps_unique_month_tickers(self):
        signals = [
            stock_signal("A", 100),
            stock_signal("B", 99),
            stock_signal("C", 98),
        ] + [stock_signal(f"T{i:02d}", i) for i in range(1, 80)]

        selections = MODULE.select_top_per_bucket(signals)
        rows = MODULE.build_rows(
            selections,
            MODULE.date(2026, 5, 1),
            prior_tickers=set(),
            dart_available=False,
        )

        self.assertEqual(len(rows), 30)
        self.assertEqual(len({(row.month, row.ticker) for row in rows}), 30)
        self.assertEqual(
            {bucket: len(picks) for bucket, picks in selections.items()},
            {"short": 10, "mid": 10, "long": 10},
        )
        self.assertAlmostEqual(sum(row.suggested_weight for row in rows), 1.0)
        MODULE.validate_shortlist_rows(rows)

    def test_csv_dict_has_diagnostics_but_db_dict_does_not(self):
        row = MODULE.ShortListRow(
            month="2026-05-01",
            ticker="005930",
            name="삼성전자",
            sector="반도체",
            bucket="long",
            rank=1,
            composite_score=90,
            trend_score=80,
            momentum_score=80,
            volatility_score=60,
            signal_label="퀄리티",
            delta_status="new",
            delta_reason="Tier 0 신규 진입",
            summary_3line="테스트",
            suggested_weight=0.0333,
            signal_4_basis="standalone",
            quality_insufficient=False,
        )
        self.assertNotIn("signal_4_basis", MODULE.row_to_db_dict(row))
        self.assertEqual(MODULE.row_to_csv_dict(row)["signal_4_basis"], "standalone")
        self.assertEqual(MODULE.row_to_csv_dict(row)["quality_insufficient"], False)

    def test_upsert_rejects_duplicate_payload_before_supabase_call(self):
        row = MODULE.ShortListRow(
            month="2026-05-01",
            ticker="005930",
            name="삼성전자",
            sector="반도체",
            bucket="short",
            rank=1,
            composite_score=90,
            trend_score=80,
            momentum_score=80,
            volatility_score=60,
            signal_label="모멘텀",
            delta_status="new",
            delta_reason="Tier 0 신규 진입",
            summary_3line="테스트",
            suggested_weight=0.1,
        )

        with self.assertRaisesRegex(ValueError, "중복 ticker payload"):
            MODULE.upsert_supabase(None, [row, row])

    def test_upsert_replaces_current_month_rows(self):
        row = MODULE.ShortListRow(
            month="2026-05-01",
            ticker="005930",
            name="삼성전자",
            sector="반도체",
            bucket="short",
            rank=1,
            composite_score=90,
            trend_score=80,
            momentum_score=80,
            volatility_score=60,
            signal_label="모멘텀",
            delta_status="new",
            delta_reason="Tier 0 신규 진입",
            summary_3line="테스트",
            suggested_weight=0.0333,
        )
        rows = []
        for bucket in MODULE.BUCKETS:
            for i in range(1, MODULE.TOP_K_PER_BUCKET + 1):
                rows.append(
                    MODULE.ShortListRow(
                        **{
                            **MODULE.row_to_db_dict(row),
                            "ticker": f"{bucket}{i:02d}",
                            "name": f"{bucket}{i:02d}",
                            "bucket": bucket,
                            "rank": i,
                        }
                    )
                )

        class FakeTable:
            def __init__(self, calls):
                self.calls = calls

            def delete(self):
                self.calls.append(("delete",))
                return self

            def eq(self, column, value):
                self.calls.append(("eq", column, value))
                return self

            def upsert(self, payload, on_conflict=None):
                self.calls.append(("upsert", len(payload), on_conflict))
                return self

            def execute(self):
                self.calls.append(("execute",))
                return None

        class FakeSupabase:
            def __init__(self):
                self.calls = []

            def table(self, name):
                self.calls.append(("table", name))
                return FakeTable(self.calls)

        supabase = FakeSupabase()
        MODULE.upsert_supabase(supabase, rows)

        self.assertEqual(
            supabase.calls[:5],
            [
                ("table", "short_list_30"),
                ("delete",),
                ("eq", "month", "2026-05-01"),
                ("execute",),
                ("table", "short_list_30"),
            ],
        )
        self.assertIn(("upsert", 30, "month,ticker"), supabase.calls)


class FetchUniverseSectorTest(unittest.TestCase):
    """B66 C 하이브리드 (plan PR #55) — fetch_universe는 sector를 placeholder로 채우지 않는다.

    sector는 resolve_sectors_for_universe 별도 단계에서 induty + override로 결정.
    """

    def test_fetch_universe_does_not_set_sector_placeholder(self):
        """fetch_universe 출력 row에 placeholder sector('코스피'/'코스닥') 박제되지 않아야 한다.

        실제 fetch_universe는 pykrx 호출이 필요해 unit에서는 mock 불가 — 함수 source를 grep으로 검증.
        """
        source = MODULE_SOURCE
        # B66 R1 lock-in: 'sector = "코스피"' 및 'sector = "코스닥"' string 박제 잔존 0.
        self.assertNotIn('sector = "코스피"', source)
        self.assertNotIn('sector = "코스닥"', source)
        # 신규 mapper API import 존재
        self.assertIn("from canonical_sector_mapper import", source)
        self.assertIn("resolve_sectors_for_universe", source)


class ResolveSectorsForUniverseTest(unittest.TestCase):
    """plan §5.3 priority: override → mapper → unresolved."""

    def test_resolve_with_mapper_only(self):
        # supabase_client=None → induty_by_ticker empty → mapper input None → unresolved
        universe = [{"ticker": "005930", "name": "삼성전자", "market": "KOSPI", "market_cap_won": 1}]
        result = MODULE.resolve_sectors_for_universe(universe, supabase_client=None)
        # supabase 없으면 induty None → unresolved
        self.assertEqual(result[0]["sector"], MODULE.UNRESOLVED)
        self.assertEqual(result[0]["sector_source"], "unresolved")

    def test_resolve_with_supabase_induty(self):
        # mock supabase chain that returns induty_code for ticker
        class FakeChain:
            def __init__(self, data):
                self._data = data

            def select(self, _):
                return self

            def in_(self, _, __):
                return self

            def execute(self):
                class R:
                    pass

                r = R()
                r.data = self._data
                return r

        class FakeSupabase:
            def __init__(self, induty_map):
                self._induty = induty_map

            def table(self, _):
                return FakeChain([{"ticker": t, "induty_code": c} for t, c in self._induty.items()])

        # 005930 induty=264 → mapper '264' → 통신
        fake = FakeSupabase({"005930": "264"})
        universe = [{"ticker": "005930", "name": "삼성전자", "market": "KOSPI", "market_cap_won": 1}]
        result = MODULE.resolve_sectors_for_universe(universe, supabase_client=fake)
        self.assertEqual(result[0]["sector"], "통신")
        self.assertEqual(result[0]["sector_source"], "mapper")
        self.assertEqual(result[0]["induty_code"], "264")

    def test_resolve_with_supabase_induty_chunks_beyond_postgrest_default_limit(self):
        universe = [
            {"ticker": f"{i:06d}", "name": f"mock-{i}", "market": "KOSPI", "market_cap_won": 1}
            for i in range(1500)
        ]

        class FakeChain:
            def __init__(self, induty_by_ticker, calls):
                self._induty_by_ticker = induty_by_ticker
                self._calls = calls
                self._tickers = []

            def select(self, _):
                return self

            def in_(self, _, tickers):
                self._tickers = list(tickers)
                self._calls.append(len(self._tickers))
                return self

            def execute(self):
                class R:
                    pass

                r = R()
                # Supabase/PostgREST default cap emulation: a naive one-shot in_ with
                # 1500 tickers would only return the first 1000 rows.
                capped = self._tickers[:1000]
                r.data = [
                    {"ticker": ticker, "induty_code": self._induty_by_ticker[ticker]}
                    for ticker in capped
                    if ticker in self._induty_by_ticker
                ]
                return r

        class FakeSupabase:
            def __init__(self):
                self.calls = []
                self._induty_by_ticker = {row["ticker"]: "264" for row in universe}

            def table(self, _):
                return FakeChain(self._induty_by_ticker, self.calls)

        fake = FakeSupabase()
        result = MODULE.resolve_sectors_for_universe(universe, supabase_client=fake)
        self.assertEqual(fake.calls, [500, 500, 500])
        self.assertTrue(all(row["sector"] == "통신" for row in result))
        self.assertTrue(all(row["induty_code"] == "264" for row in result))

    def test_resolve_unresolved_when_induty_unmatched(self):
        class FakeChain:
            def select(self, _):
                return self

            def in_(self, _, __):
                return self

            def execute(self):
                class R:
                    pass

                r = R()
                # induty 70113 → mapper '70113' → UNRESOLVED
                r.data = [{"ticker": "X12345", "induty_code": "70113"}]
                return r

        class FakeSupabase:
            def table(self, _):
                return FakeChain()

        universe = [{"ticker": "X12345", "name": "X", "market": "KOSPI", "market_cap_won": 1}]
        result = MODULE.resolve_sectors_for_universe(universe, supabase_client=FakeSupabase())
        self.assertEqual(result[0]["sector"], MODULE.UNRESOLVED)
        self.assertEqual(result[0]["sector_source"], "unresolved")


class SeedPipelineIntegrationTest(unittest.TestCase):
    """T5 — mock universe + mock dart_corp_codes induty → canonical 30 rows when unresolved 0."""

    def test_mock_30_ticker_pipeline_resolves_canonical_14(self):
        induty_samples = [
            "21000", "26110", "41000", "64000", "28202", "30000", "62000", "10000", "19000", "59000",
            "61000", "20000", "50000", "65000", "86000", "26290", "42000", "66000", "28100", "56000",
            "49000", "35000", "55000", "32000", "33000", "45000", "47000", "51000", "52000", "85000",
        ]
        universe = [
            {
                "ticker": f"{i:06d}",
                "name": f"mock-{i}",
                "market": "KOSPI" if i % 2 == 0 else "KOSDAQ",
                "market_cap_won": 100_000_000_000 - i,
            }
            for i in range(1, 31)
        ]

        class FakeChain:
            def select(self, _):
                return self

            def in_(self, _, __):
                return self

            def execute(self):
                class R:
                    pass

                r = R()
                r.data = [
                    {"ticker": row["ticker"], "induty_code": induty}
                    for row, induty in zip(universe, induty_samples)
                ]
                return r

        class FakeSupabase:
            def table(self, _):
                return FakeChain()

        MODULE.resolve_sectors_for_universe(universe, supabase_client=FakeSupabase())
        self.assertNotIn(MODULE.UNRESOLVED, {row["sector"] for row in universe})
        self.assertTrue(all(row["sector"] in MODULE.CANONICAL_SECTORS for row in universe))
        self.assertNotIn("코스피", {row["sector"] for row in universe})
        self.assertNotIn("코스닥", {row["sector"] for row in universe})

        signals = [stock_signal(row["ticker"], 100 - idx, sector=row["sector"]) for idx, row in enumerate(universe)]
        selections = MODULE.select_top_per_bucket(signals)
        rows = MODULE.build_rows(selections, MODULE.date(2026, 5, 1), prior_tickers=set(), dart_available=True)
        MODULE.validate_shortlist_rows(rows)
        self.assertEqual(len(rows), 30)
        self.assertNotIn(MODULE.UNRESOLVED, {row.sector for row in rows})


class WriteSectorReviewCsvTest(unittest.TestCase):
    """B89 strict block — review CSV 생성 + unresolved count."""

    def test_review_csv_includes_unresolved_and_override(self):
        import tempfile

        rows = [
            {"ticker": "005930", "name": "삼성", "market": "KOSPI", "induty_code": "264", "sector": "통신", "sector_source": "mapper"},
            {"ticker": "999999", "name": "Unknown", "market": "KOSDAQ", "induty_code": None, "sector": MODULE.UNRESOLVED, "sector_source": "unresolved"},
            {"ticker": "452200", "name": "민테크", "market": "KOSDAQ", "induty_code": "27212", "sector": "2차전지", "sector_source": "override"},
        ]
        f = tempfile.NamedTemporaryFile("r", suffix=".csv", delete=False, encoding="utf-8")
        f.close()
        try:
            count = MODULE.write_sector_review_csv(rows, f.name)
            self.assertEqual(count, 1)
            with open(f.name, encoding="utf-8") as r:
                content = r.read()
            # mapper-resolved 005930은 review에 안 들어감
            self.assertNotIn("005930", content)
            # unresolved + override만 들어감
            self.assertIn("999999", content)
            self.assertIn("452200", content)
            self.assertIn("unresolved", content)
            self.assertIn("2차전지", content)
        finally:
            import os
            os.unlink(f.name)


class B89StrictBlockTest(unittest.TestCase):
    """plan §4.3 — unresolved 1+ returns exit code 2 for dry-run and apply."""

    def test_dry_run_unresolved_exits_2(self):
        with self.assertRaises(SystemExit) as ctx:
            MODULE.enforce_b89_strict_block(1, apply=False, review_csv_path="/tmp/review.csv")
        self.assertEqual(ctx.exception.code, MODULE.EXIT_CODE_UNRESOLVED)

    def test_apply_unresolved_exits_2(self):
        with self.assertRaises(SystemExit) as ctx:
            MODULE.enforce_b89_strict_block(1, apply=True, review_csv_path="/tmp/review.csv")
        self.assertEqual(ctx.exception.code, MODULE.EXIT_CODE_UNRESOLVED)

    def test_zero_unresolved_does_not_exit(self):
        MODULE.enforce_b89_strict_block(0, apply=True, review_csv_path="/tmp/review.csv")


class Tier0CandidatesEmitTest(unittest.TestCase):
    """PR-D (ADR D-3/B1) — tier0_candidates_150 producer (단/중/장 disjoint 50씩 = 150)."""

    def test_select_candidate_pool_disjoint_and_full(self):
        # 모든 signal의 시그널이 동일 score → 모든 bucket이 동일 정렬 → short/mid/long이
        # 자연스럽게 disjoint 50씩 (used_tickers 누적). 200종목 universe → 150 distinct.
        signals = [stock_signal(f"{i:06d}", 1000 - i) for i in range(200)]
        selections = MODULE.select_candidate_pool_per_bucket(signals, pool_size=50)
        self.assertEqual(
            {b: len(p) for b, p in selections.items()},
            {"short": 50, "mid": 50, "long": 50},
        )
        all_tickers = [s.ticker for picks in selections.values() for s, _ in picks]
        self.assertEqual(len(all_tickers), 150)
        self.assertEqual(len(set(all_tickers)), 150)  # cross-bucket disjoint

    def test_select_candidate_pool_raises_when_universe_too_small(self):
        signals = [stock_signal(f"{i:06d}", 1000 - i) for i in range(100)]  # < 150
        with self.assertRaisesRegex(ValueError, "채우지 못했습니다"):
            MODULE.select_candidate_pool_per_bucket(signals, pool_size=50)

    def test_build_candidate_rows_150_validates(self):
        signals = [stock_signal(f"{i:06d}", 1000 - i) for i in range(200)]
        selections = MODULE.select_candidate_pool_per_bucket(signals, pool_size=50)
        rows = MODULE.build_candidate_rows(selections, MODULE.date(2026, 6, 1))
        self.assertEqual(len(rows), 150)
        self.assertEqual(len({(r.month, r.ticker) for r in rows}), 150)
        # rank는 bucket별 1..50
        for bucket in MODULE.BUCKETS:
            ranks = sorted(r.rank for r in rows if r.bucket == bucket)
            self.assertEqual(ranks, list(range(1, 51)))
        MODULE.validate_candidate_rows(rows)  # raise 없어야 함

    def test_validate_candidate_rows_rejects_non_150(self):
        rows = [
            MODULE.Tier0CandidateRow(
                month="2026-06-01", ticker=f"{i:06d}", name="x", sector="반도체",
                bucket="short", rank=i + 1, tier0_score=1.0, signal_label="모멘텀",
            )
            for i in range(10)
        ]
        with self.assertRaisesRegex(ValueError, "150개가 아닙니다"):
            MODULE.validate_candidate_rows(rows)

    def test_validate_candidate_rows_rejects_duplicate_ticker(self):
        base = MODULE.Tier0CandidateRow(
            month="2026-06-01", ticker="000001", name="x", sector="반도체",
            bucket="short", rank=1, tier0_score=1.0, signal_label="모멘텀",
        )
        with self.assertRaisesRegex(ValueError, "중복 ticker"):
            MODULE.validate_candidate_rows([base, base])

    def test_candidate_db_dict_shape(self):
        row = MODULE.Tier0CandidateRow(
            month="2026-06-01", ticker="005930", name="삼성전자", sector="반도체",
            bucket="short", rank=1, tier0_score=88.5, signal_label="모멘텀",
        )
        d = MODULE.candidate_row_to_db_dict(row)
        self.assertEqual(
            set(d.keys()),
            {"month", "ticker", "name", "sector", "bucket", "rank", "tier0_score", "signal_label"},
        )
        self.assertEqual(d["tier0_score"], 88.5)
        # short_list_30 전용 컬럼(composite_score/delta_status 등)은 candidate dict에 없어야 함.
        self.assertNotIn("composite_score", d)
        self.assertNotIn("delta_status", d)

    def test_upsert_candidates_replaces_month_rows(self):
        rows = []
        for bidx, bucket in enumerate(MODULE.BUCKETS):
            for i in range(1, MODULE.CANDIDATE_POOL_PER_BUCKET + 1):
                rows.append(
                    MODULE.Tier0CandidateRow(
                        month="2026-06-01",
                        ticker=f"{bidx}{i:05d}",  # 6-digit unique across 150
                        name=f"name-{bidx}-{i}",
                        sector="반도체",
                        bucket=bucket,
                        rank=i,
                        tier0_score=float(100 - i),
                        signal_label="모멘텀",
                    )
                )

        class FakeTable:
            def __init__(self, calls):
                self.calls = calls

            def delete(self):
                self.calls.append(("delete",))
                return self

            def eq(self, column, value):
                self.calls.append(("eq", column, value))
                return self

            def upsert(self, payload, on_conflict=None):
                self.calls.append(("upsert", len(payload), on_conflict))
                return self

            def execute(self):
                self.calls.append(("execute",))
                return None

        class FakeSupabase:
            def __init__(self):
                self.calls = []

            def table(self, name):
                self.calls.append(("table", name))
                return FakeTable(self.calls)

        supabase = FakeSupabase()
        MODULE.upsert_candidates_supabase(supabase, rows)

        self.assertEqual(
            supabase.calls[:5],
            [
                ("table", "tier0_candidates_150"),
                ("delete",),
                ("eq", "month", "2026-06-01"),
                ("execute",),
                ("table", "tier0_candidates_150"),
            ],
        )
        self.assertIn(("upsert", 150, "month,ticker"), supabase.calls)

    def test_upsert_candidates_rejects_duplicate_before_supabase_call(self):
        base = MODULE.Tier0CandidateRow(
            month="2026-06-01", ticker="005930", name="삼성전자", sector="반도체",
            bucket="short", rank=1, tier0_score=1.0, signal_label="모멘텀",
        )
        # validate 선행 → supabase(None) 접근 전에 raise.
        with self.assertRaisesRegex(ValueError, "중복 ticker"):
            MODULE.upsert_candidates_supabase(None, [base, base])


class FetchUniverseKrxTest(unittest.TestCase):
    """§5.3 — KRX 공식 API 전환 후 fetch_universe.

    krx_openapi.fetch_bydd_trd / fetch_isu_base 를 패치(fetch_universe가 lazy import 하므로
    매 호출 재import → 패치된 모듈 심볼 사용)해서 보통주 필터 + 4키 계약을 검증.
    """

    def _patch_krx(self, bydd_by_market, base_rows_by_market):
        import importlib.util as _ilu
        krx_path = SCRIPT_PATH.with_name("krx_openapi.py")
        spec = _ilu.spec_from_file_location("krx_openapi", krx_path)
        krx = _ilu.module_from_spec(spec)
        spec.loader.exec_module(krx)

        def fake_bydd(market, bas_dd, **kwargs):
            return bydd_by_market.get(market, [])

        def fake_base(market, bas_dd, **kwargs):
            rows = base_rows_by_market.get(market, [])
            return {r["ISU_SRT_CD"]: r for r in rows if r.get("ISU_SRT_CD")}

        krx.fetch_bydd_trd = fake_bydd
        krx.fetch_isu_base = fake_base
        return krx

    def test_fetch_universe_krx_common_filter(self):
        import sys as _sys
        # 시총: 보통주 1조, 우선주 5천억, ETF 2조, 저시총 보통주 100억(컷오프 300억 미만)
        bydd = {
            "KOSPI": [
                {"ISU_CD": "005930", "ISU_NM": "삼성전자", "MKT_NM": "KOSPI", "MKTCAP": "1000000000000"},
                {"ISU_CD": "005935", "ISU_NM": "삼성전자우", "MKT_NM": "KOSPI", "MKTCAP": "500000000000"},
                {"ISU_CD": "069500", "ISU_NM": "KODEX 200", "MKT_NM": "KOSPI", "MKTCAP": "2000000000000"},
                {"ISU_CD": "111111", "ISU_NM": "저시총주", "MKT_NM": "KOSPI", "MKTCAP": "10000000000"},
                {"ISU_CD": "123456", "ISU_NM": "미래에셋비전스팩1호", "MKT_NM": "KOSPI", "MKTCAP": "900000000000"},
                {"ISU_CD": "222222", "ISU_NM": "맥쿼리인프라", "MKT_NM": "KOSPI", "MKTCAP": "800000000000"},
                {"ISU_CD": "333333", "ISU_NM": "누락기본정보", "MKT_NM": "KOSPI", "MKTCAP": "700000000000"},
                {"ISU_NM": "부분응답", "MKT_NM": "KOSPI", "MKTCAP": "600000000000"},
            ],
            "KOSDAQ": [
                {"ISU_CD": "035720", "ISU_NM": "카카오게임", "MKT_NM": "KOSDAQ", "MKTCAP": "800000000000"},
            ],
        }
        base = {
            "KOSPI": [
                {"ISU_SRT_CD": "005930", "KIND_STKCERT_TP_NM": "보통주", "SECUGRP_NM": "주권"},
                {"ISU_SRT_CD": "005935", "KIND_STKCERT_TP_NM": "우선주", "SECUGRP_NM": "주권"},
                {"ISU_SRT_CD": "069500", "KIND_STKCERT_TP_NM": "보통주", "SECUGRP_NM": "수익증권"},
                {"ISU_SRT_CD": "111111", "KIND_STKCERT_TP_NM": "보통주", "SECUGRP_NM": "주권"},
                {"ISU_SRT_CD": "123456", "KIND_STKCERT_TP_NM": "보통주", "SECUGRP_NM": "주권"},
                {"ISU_SRT_CD": "222222", "KIND_STKCERT_TP_NM": "보통주", "SECUGRP_NM": "주권"},
            ],
            "KOSDAQ": [
                {"ISU_SRT_CD": "035720", "KIND_STKCERT_TP_NM": "보통주", "SECUGRP_NM": "주권"},
            ],
        }
        krx = self._patch_krx(bydd, base)
        saved = _sys.modules.get("krx_openapi")
        _sys.modules["krx_openapi"] = krx
        try:
            result = MODULE.fetch_universe(MODULE.date(2026, 5, 11))
        finally:
            if saved is not None:
                _sys.modules["krx_openapi"] = saved
            else:
                _sys.modules.pop("krx_openapi", None)

        tickers = {r["ticker"] for r in result}
        # 보통주+주권+시총통과: 삼성전자(005930), 카카오게임(035720)
        self.assertIn("005930", tickers)
        self.assertIn("035720", tickers)
        # 우선주(005935), ETF/수익증권(069500), 저시총(111111) 배제
        self.assertNotIn("005935", tickers)
        self.assertNotIn("069500", tickers)
        self.assertNotIn("111111", tickers)
        # 보통주+주권이어도 스팩/인프라펀드 안전망과 base 누락 보수배제 적용
        self.assertNotIn("123456", tickers)
        self.assertNotIn("222222", tickers)
        self.assertNotIn("333333", tickers)
        # sector 미설정
        for r in result:
            self.assertNotIn("sector", r)
        # 시총 desc 정렬 (카카오게임 8천억 < 삼성전자 1조)
        self.assertEqual([r["ticker"] for r in result], ["005930", "035720"])

    def test_fetch_universe_returns_4key_contract(self):
        import sys as _sys
        bydd = {
            "KOSPI": [
                {"ISU_CD": "005930", "ISU_NM": "삼성전자", "MKT_NM": "KOSPI", "MKTCAP": "1000000000000"},
            ],
            "KOSDAQ": [],
        }
        base = {
            "KOSPI": [
                {"ISU_SRT_CD": "005930", "KIND_STKCERT_TP_NM": "보통주", "SECUGRP_NM": "주권"},
            ],
            "KOSDAQ": [],
        }
        krx = self._patch_krx(bydd, base)
        saved = _sys.modules.get("krx_openapi")
        _sys.modules["krx_openapi"] = krx
        try:
            result = MODULE.fetch_universe(MODULE.date(2026, 5, 11))
        finally:
            if saved is not None:
                _sys.modules["krx_openapi"] = saved
            else:
                _sys.modules.pop("krx_openapi", None)

        self.assertEqual(len(result), 1)
        self.assertEqual(set(result[0].keys()), {"ticker", "name", "market", "market_cap_won"})
        self.assertNotIn("sector", result[0])
        self.assertEqual(result[0]["market"], "KOSPI")
        self.assertEqual(result[0]["market_cap_won"], 1_000_000_000_000.0)


class PrefetchPriceSeriesTest(unittest.TestCase):
    """§5.3 — prefetch_price_series 빈 응답일 스킵 + ticker별 시계열 축적."""

    def test_prefetch_price_series_skips_empty_days(self):
        import sys as _sys
        import importlib.util as _ilu
        krx_path = SCRIPT_PATH.with_name("krx_openapi.py")
        spec = _ilu.spec_from_file_location("krx_openapi", krx_path)
        krx = _ilu.module_from_spec(spec)
        spec.loader.exec_module(krx)

        call_log = []

        def fake_bydd(market, bas_dd, **kwargs):
            call_log.append((market, bas_dd))
            # 모든 호출 중 절반은 빈 응답(휴장) → 스킵돼야 함.
            if int(bas_dd) % 2 == 0:
                return []
            return [
                {"ISU_CD": "005930", "TDD_CLSPRC": "70000", "ACC_TRDVOL": "1000000"},
                {"ISU_CD": "000000", "TDD_CLSPRC": "0", "ACC_TRDVOL": "1000000"},
                {"TDD_CLSPRC": "12345", "ACC_TRDVOL": "1000000"},
            ]

        krx.fetch_bydd_trd = fake_bydd
        saved = _sys.modules.get("krx_openapi")
        _sys.modules["krx_openapi"] = krx
        try:
            series = MODULE.prefetch_price_series(MODULE.date(2026, 5, 11), markets=("KOSPI",))
        finally:
            if saved is not None:
                _sys.modules["krx_openapi"] = saved
            else:
                _sys.modules.pop("krx_openapi", None)

        # 빈 응답일은 series에 안 들어감 → 005930 시계열 길이 = 홀수일 수만큼.
        self.assertIn("005930", series)
        odd_days = sum(1 for (_m, d) in call_log if int(d) % 2 == 1)
        self.assertEqual(len(series["005930"]["closes"]), odd_days)
        self.assertEqual(len(series["005930"]["volumes"]), odd_days)
        self.assertNotIn("000000", series)
        # 빈 응답이 실제로 발생했는지 (스킵 경로 검증)
        self.assertTrue(any(int(d) % 2 == 0 for (_m, d) in call_log))


class FetchPriceSignalsFromSeriesTest(unittest.TestCase):
    """§5.3 — fetch_price_signals(price_series=...) 주입 경로."""

    def _series_61(self, base_close=100.0, last_close=110.0, vol=1000.0, last_vol=3000.0):
        # MOMENTUM_MA_WINDOW(60) + 1 = 61일 시계열. 마지막 5일 거래량 급증.
        n = MODULE.MOMENTUM_MA_WINDOW + 1
        closes = [base_close] * (n - 1) + [last_close]
        volumes = [vol] * (n - MODULE.VOLUME_MA_SHORT) + [last_vol] * MODULE.VOLUME_MA_SHORT
        return {"closes": closes, "volumes": volumes}

    def test_fetch_price_signals_from_series(self):
        series = {"005930": self._series_61()}
        result = MODULE.fetch_price_signals("005930", MODULE.date(2026, 5, 11), price_series=series)
        self.assertEqual(set(result.keys()), {"momentum_raw", "volume_surge_raw", "volatility_raw"})
        # momentum: last_close(110) / MA60 계산. MA60 = (59*100 + 110)/60 ≈ 100.1667
        ma60 = (59 * 100.0 + 110.0) / 60.0
        self.assertAlmostEqual(result["momentum_raw"], 110.0 / ma60 - 1.0, places=6)
        # volume_surge: MA5(3000) / MA60 - 1. MA60 = (55*1000 + 5*3000)/60
        ma_long = (55 * 1000.0 + 5 * 3000.0) / 60.0
        self.assertAlmostEqual(result["volume_surge_raw"], 3000.0 / ma_long - 1.0, places=6)
        # 가격 거의 평탄 → 변동성 매우 작음(>=0)
        self.assertGreaterEqual(result["volatility_raw"], 0.0)

    def test_fetch_price_signals_insufficient_series(self):
        # MOMENTUM_MA_WINDOW + 1 미만 시계열 → {0,0,0}
        short = {"closes": [100.0] * 10, "volumes": [1000.0] * 10}
        result = MODULE.fetch_price_signals("005930", MODULE.date(2026, 5, 11), price_series={"005930": short})
        self.assertEqual(result, {"momentum_raw": 0.0, "volume_surge_raw": 0.0, "volatility_raw": 0.0})
        # ticker 자체가 series에 없을 때도 {0,0,0}
        missing = MODULE.fetch_price_signals("999999", MODULE.date(2026, 5, 11), price_series={})
        self.assertEqual(missing, {"momentum_raw": 0.0, "volume_surge_raw": 0.0, "volatility_raw": 0.0})
        malformed = MODULE.fetch_price_signals("005930", MODULE.date(2026, 5, 11), price_series={"005930": []})
        self.assertEqual(malformed, {"momentum_raw": 0.0, "volume_surge_raw": 0.0, "volatility_raw": 0.0})

    def test_fetch_price_signals_rejects_partial_or_zero_series(self):
        short_volumes = self._series_61()
        short_volumes["volumes"] = short_volumes["volumes"][: MODULE.VOLUME_MA_LONG - 1]
        result = MODULE.fetch_price_signals("005930", MODULE.date(2026, 5, 11), price_series={"005930": short_volumes})
        self.assertEqual(result, {"momentum_raw": 0.0, "volume_surge_raw": 0.0, "volatility_raw": 0.0})

        zero_close = self._series_61()
        zero_close["closes"][-2] = 0.0
        result = MODULE.fetch_price_signals("005930", MODULE.date(2026, 5, 11), price_series={"005930": zero_close})
        self.assertEqual(result, {"momentum_raw": 0.0, "volume_surge_raw": 0.0, "volatility_raw": 0.0})


import math


def _bpp_series(n, drift, wiggle=0.01, phase=0.0):
    return [100.0 * ((1 + drift) ** t) * (1.0 + wiggle * math.sin(t * 0.7 + phase)) for t in range(n)]


class BppIntegrationTest(unittest.TestCase):
    """B++ (D30) screen 통합: build_stock_raw_list 매핑 + select_bpp_candidates 150 distinct +
    size-sleeve 쿼터 + Gate C smoke. 실 KRX fetch 없이 합성 universe로 통합 로직 검증."""

    N = 280

    def _universe(self, count=350):
        # 시총 spread(20/40/40 split 명확) + 고ADV(플로어 통과) + 다양 drift(점수 변별).
        return [
            MODULE.TF.StockRaw(
                ticker=f"{k:06d}",
                sector=["제조", "바이오", "IT/SW", "금융"][k % 4],
                market_cap=float(k + 1) * 5e10,
                closes=_bpp_series(self.N, 0.0005 + 0.00002 * k, phase=k * 0.1),
                trdvals=[5e9 + k * 1e7] * self.N,
                highs=_bpp_series(self.N, 0.0005 + 0.00002 * k, phase=k * 0.1),
                foreign_net_60d=1e9 + k * 1e6,
                earnings_raw=0.05 + 0.001 * k,
                quality_composite_raw=40.0 + (k % 30),
            )
            for k in range(count)
        ]

    def test_select_bpp_candidates_150_distinct(self):
        stocks = self._universe(350)
        selections = MODULE.select_bpp_candidates(stocks)
        all_tickers = [sc.ticker for picks in selections.values() for sc in picks]
        self.assertEqual(len(all_tickers), 150)
        self.assertEqual(len(set(all_tickers)), 150)  # cross-bucket disjoint
        for bucket in MODULE.BUCKETS:
            self.assertEqual(len(selections[bucket]), 50)

    def test_gate_c_distribution_60_60_30(self):
        stocks = self._universe(350)
        selections = MODULE.select_bpp_candidates(stocks)
        gc = MODULE.gate_c_smoke(selections)
        self.assertEqual(gc["dist"], {"large": 60, "mid": 60, "small": 30})
        self.assertEqual(gc["total"], 150)
        self.assertAlmostEqual(gc["small_fraction"], 0.2)

    def test_run_bpp_candidates_exits_nonzero_when_gate_c_fails(self):
        selections = {}
        for bucket in MODULE.BUCKETS:
            selections[bucket] = [
                MODULE.TF.ScoredStock(
                    ticker=f"{bucket}{i:03d}",
                    sector="제조",
                    market_cap=1e12 + i,
                    sleeve="large",
                    score=100.0 - i,
                    adv60=5e9,
                    factor_ranks={"trend": 80.0},
                )
                for i in range(50)
            ]
        universe = [
            {"ticker": sc.ticker, "name": sc.ticker, "market": "KOSPI"}
            for picks in selections.values()
            for sc in picks
        ]
        with tempfile.TemporaryDirectory() as td:
            args = SimpleNamespace(
                emit_candidates=True,
                apply=False,
                csv_backup=str(Path(td) / "bpp.csv"),
                sector_review_csv=None,
                month=MODULE.date(2026, 6, 1),
            )
            with patch.object(MODULE, "select_bpp_candidates", return_value=selections):
                with self.assertRaises(SystemExit) as cm:
                    MODULE.run_bpp_candidates(args, [], {}, universe, dart_available=False)
        self.assertNotEqual(cm.exception.code, 0)

    def test_select_bpp_shortfall_when_universe_too_small(self):
        # 100 종목 < 150 필요 → backfill 후에도 부족 → SleeveShortfallError (무음 truncation 금지)
        stocks = self._universe(100)
        with self.assertRaises(MODULE.TF.SleeveShortfallError):
            MODULE.select_bpp_candidates(stocks)

    def test_build_stock_raw_list_missing_tiering(self):
        sigs = [
            MODULE.StockSignal(ticker="A", name="A", sector="제조", market_cap_won=1e12,
                               foreign_net_raw=1e9, earnings_raw=0.1, signal_4_basis="standalone",
                               quality_insufficient=False, foreign_fetch_failed=False),
            MODULE.StockSignal(ticker="B", name="B", sector="제조", market_cap_won=1e12,
                               foreign_net_raw=0.0, earnings_raw=0.0, signal_4_basis="not_applicable",
                               quality_insufficient=True, foreign_fetch_failed=True),   # fetch 실패
            MODULE.StockSignal(ticker="C", name="C", sector="제조", market_cap_won=1e12,
                               foreign_net_raw=0.0, earnings_raw=0.2, signal_4_basis="standalone",
                               quality_insufficient=False, foreign_fetch_failed=False),  # genuine 0
        ]
        price_series = {
            t: {"closes": [100.0] * 5, "highs": [100.0] * 5, "trdvals": [5e9] * 5}
            for t in ("A", "B", "C")
        }
        raws = MODULE.build_stock_raw_list(sigs, price_series, [80.0, 80.0, 80.0])
        # A: 전부 present.
        self.assertEqual(raws[0].earnings_raw, 0.1)
        # B: earnings basis=not_applicable → NaN, quality_insufficient → NaN, foreign FETCH 실패 → NaN+flag
        self.assertTrue(math.isnan(raws[1].earnings_raw))
        self.assertTrue(math.isnan(raws[1].quality_composite_raw))
        self.assertTrue(math.isnan(raws[1].foreign_net_60d))
        self.assertTrue(raws[1].foreign_fetch_failed)
        # C: genuine foreign 0.0 (not failed) → 0.0 그대로 전달(NaN 아님)
        self.assertEqual(raws[2].foreign_net_60d, 0.0)
        self.assertFalse(raws[2].foreign_fetch_failed)

    def test_build_stock_raw_list_cfg1_lock_neutralizes_foreign_dart(self):
        # D30 funnel: cfg1_lock=True 면 present-data 시그널이어도 foreign/earnings/quality 전부 neutral.
        sigs = [
            MODULE.StockSignal(ticker="A", name="A", sector="제조", market_cap_won=1e12,
                               foreign_net_raw=9e9, earnings_raw=0.3, signal_4_basis="standalone",
                               quality_insufficient=False, foreign_fetch_failed=False),
        ]
        price_series = {"A": {"closes": [100.0] * 5, "highs": [100.0] * 5, "trdvals": [5e9] * 5}}
        raws = MODULE.build_stock_raw_list(sigs, price_series, [80.0], cfg1_lock=True)
        self.assertTrue(math.isnan(raws[0].earnings_raw))
        self.assertTrue(math.isnan(raws[0].quality_composite_raw))
        self.assertTrue(math.isnan(raws[0].foreign_net_60d))
        # structural neutral (NOT penalty): foreign_fetch_failed=False → fill_missing_rank → neutral 50.
        self.assertFalse(raws[0].foreign_fetch_failed)


class BppFunnelApplyTest(unittest.TestCase):
    """D30 B++ funnel 적용(2026-06-19 USER 결정): --scoring bpp + --apply 가드 완화 + 강제 disclosure +
    cfg1 + B89 strict + production write. 삼중 게이트 미통과(예측 claim 금지)지만 USER 승인 토큰으로 apply 허용."""

    def _gate_c_pass_selection(self, sector="제조"):
        """20 large + 20 mid + 10 small per bucket = 60/60/30 Gate-C-PASS, cross-bucket disjoint."""
        sel = {}
        for bucket in MODULE.BUCKETS:
            picks = []
            n = 0
            for sleeve, count in (("large", 20), ("mid", 20), ("small", 10)):
                for i in range(count):
                    picks.append(MODULE.TF.ScoredStock(
                        ticker=f"{bucket[0]}{sleeve[0]}{i:03d}",  # unique across bucket+sleeve
                        sector=sector,
                        market_cap=1e12 + n,
                        sleeve=sleeve,
                        score=100.0 - n,
                        adv60=5e9,
                        factor_ranks={"trend": 80.0},
                    ))
                    n += 1
            sel[bucket] = picks
        return sel

    def _args(self, td, *, apply, approval_basis):
        return SimpleNamespace(
            emit_candidates=True,
            apply=apply,
            apply_approval_basis=approval_basis,
            csv_backup=str(Path(td) / "bpp.csv"),
            sector_review_csv=None,
            month=MODULE.date(2026, 6, 1),
        )

    def _universe_for(self, selections):
        return [
            {"ticker": sc.ticker, "name": sc.ticker, "market": "KOSPI"}
            for picks in selections.values() for sc in picks
        ]

    def test_apply_blocked_without_approval_basis(self):
        sel = self._gate_c_pass_selection()
        uni = self._universe_for(sel)
        with tempfile.TemporaryDirectory() as td:
            args = self._args(td, apply=True, approval_basis=None)
            with patch.object(MODULE, "select_bpp_candidates", return_value=sel), \
                 patch.object(MODULE, "upsert_candidates_supabase") as up, \
                 patch.object(MODULE, "get_supabase_client") as gc:
                with self.assertRaises(SystemExit) as cm:
                    MODULE.run_bpp_candidates(args, [], {}, uni, dart_available=False)
            self.assertNotEqual(cm.exception.code, 0)
            up.assert_not_called()
            gc.assert_not_called()

    def test_apply_blocked_with_wrong_approval_basis(self):
        sel = self._gate_c_pass_selection()
        uni = self._universe_for(sel)
        with tempfile.TemporaryDirectory() as td:
            args = self._args(td, apply=True, approval_basis="WRONG_TOKEN")
            with patch.object(MODULE, "select_bpp_candidates", return_value=sel), \
                 patch.object(MODULE, "upsert_candidates_supabase") as up, \
                 patch.object(MODULE, "get_supabase_client") as gc:
                with self.assertRaises(SystemExit):
                    MODULE.run_bpp_candidates(args, [], {}, uni, dart_available=False)
            up.assert_not_called()
            gc.assert_not_called()

    def test_apply_writes_with_correct_approval_basis(self):
        sel = self._gate_c_pass_selection(sector="제조")
        uni = self._universe_for(sel)
        with tempfile.TemporaryDirectory() as td:
            args = self._args(td, apply=True, approval_basis=MODULE.BPP_FUNNEL_APPROVAL_BASIS)
            sentinel = object()
            with patch.object(MODULE, "select_bpp_candidates", return_value=sel), \
                 patch.object(MODULE, "get_supabase_client", return_value=sentinel) as gc, \
                 patch.object(MODULE, "_backup_existing_candidates_before_write") as bk, \
                 patch.object(MODULE, "upsert_candidates_supabase") as up:
                MODULE.run_bpp_candidates(args, [], {}, uni, dart_available=False)
            gc.assert_called_once()
            up.assert_called_once()
            # Claude review MEDIUM fix: 자동 rollback 백업이 write 전에 실행됐는지.
            bk.assert_called_once()
            call_args = up.call_args[0]
            self.assertIs(call_args[0], sentinel)
            self.assertEqual(len(call_args[1]), 150)  # 150 rows written

    def test_backup_existing_candidates_before_write_dumps_current_rows(self):
        # Claude review MEDIUM fix: 자동 백업이 현 production rows를 JSON으로 dump.
        import json

        class _Exec:
            def __init__(self, data):
                self._data = data
            def execute(self):
                return SimpleNamespace(data=self._data)

        class _Q:
            def __init__(self, data):
                self._data = data
            def select(self, *a, **k):
                return self
            def eq(self, *a, **k):
                return _Exec(self._data)

        class _Client:
            def __init__(self, data):
                self._data = data
            def table(self, name):
                assert name == "tier0_candidates_150"
                return _Q(self._data)

        rows = [{"month": "2026-06-01", "ticker": "000660", "sector": "반도체"}]
        with tempfile.TemporaryDirectory() as td:
            csv_backup = str(Path(td) / "bpp.csv")
            path = MODULE._backup_existing_candidates_before_write(_Client(rows), "2026-06-01", csv_backup)
            self.assertTrue(Path(path).exists())
            self.assertIn(".prod-rollback-", path)
            self.assertEqual(json.loads(Path(path).read_text(encoding="utf-8")), rows)

    def test_cfg1_lock_score_level_uniform_nontrend_factors(self):
        # Claude review LOW fix: cfg1 neutralization을 score 레벨에서 검증 — foreign/earnings/quality rank가
        # eligible 전종목 uniform, trend만 변별. build → score_bpp_universe로 실제 랭킹 확인.
        sigs = [
            MODULE.StockSignal(
                ticker=f"{k:06d}", name=f"n{k}", sector="제조", market_cap_won=float(k + 1) * 5e10,
                foreign_net_raw=9e9 + k * 1e7, earnings_raw=0.1 + 0.01 * k, signal_4_basis="standalone",
                quality_insufficient=False, foreign_fetch_failed=False,
            )
            for k in range(40)
        ]
        price_series = {
            s.ticker: {
                "closes": _bpp_series(280, 0.0005 + 0.00003 * i),
                "highs": _bpp_series(280, 0.0005 + 0.00003 * i),
                "trdvals": [5e9 + i * 1e7] * 280,
            }
            for i, s in enumerate(sigs)
        }
        quality_composites = [50.0 + (k % 20) for k in range(40)]
        stocks = MODULE.build_stock_raw_list(sigs, price_series, quality_composites, cfg1_lock=True)
        scored = [s for s in MODULE.TF.score_bpp_universe(stocks, "short") if s.eligible]
        self.assertGreater(len(scored), 5)
        for factor in ("foreign", "earnings", "quality"):
            vals = {round(s.factor_ranks[factor], 6) for s in scored}
            self.assertEqual(len(vals), 1, f"{factor} should be uniform under cfg1_lock, got {vals}")
        trend_vals = {round(s.factor_ranks["trend"], 6) for s in scored}
        self.assertGreater(len(trend_vals), 1, "trend must differentiate under cfg1")

    def test_apply_b89_blocks_unresolved_sector(self):
        # 한 종목이 unresolved sector → B89 strict block (apply) → SystemExit, write 없음.
        sel = self._gate_c_pass_selection(sector="제조")
        sel["short"][0].sector = MODULE.UNRESOLVED
        uni = self._universe_for(sel)
        with tempfile.TemporaryDirectory() as td:
            args = self._args(td, apply=True, approval_basis=MODULE.BPP_FUNNEL_APPROVAL_BASIS)
            with patch.object(MODULE, "select_bpp_candidates", return_value=sel), \
                 patch.object(MODULE, "get_supabase_client") as gc, \
                 patch.object(MODULE, "upsert_candidates_supabase") as up:
                with self.assertRaises(SystemExit) as cm:
                    MODULE.run_bpp_candidates(args, [], {}, uni, dart_available=False)
            self.assertNotEqual(cm.exception.code, 0)
            up.assert_not_called()
            gc.assert_not_called()

    def test_dry_run_does_not_write_and_no_approval_needed(self):
        sel = self._gate_c_pass_selection()
        uni = self._universe_for(sel)
        with tempfile.TemporaryDirectory() as td:
            args = self._args(td, apply=False, approval_basis=None)
            with patch.object(MODULE, "select_bpp_candidates", return_value=sel), \
                 patch.object(MODULE, "upsert_candidates_supabase") as up, \
                 patch.object(MODULE, "get_supabase_client") as gc:
                MODULE.run_bpp_candidates(args, [], {}, uni, dart_available=False)
            up.assert_not_called()
            gc.assert_not_called()

    def test_disclosure_forced_in_output(self):
        # 예측 미통과(diagnostic funnel) 사실이 출력에 강제되는지 (dry-run에서도).
        import io
        from contextlib import redirect_stdout
        sel = self._gate_c_pass_selection()
        uni = self._universe_for(sel)
        buf = io.StringIO()
        with tempfile.TemporaryDirectory() as td:
            args = self._args(td, apply=False, approval_basis=None)
            with patch.object(MODULE, "select_bpp_candidates", return_value=sel):
                with redirect_stdout(buf):
                    MODULE.run_bpp_candidates(args, [], {}, uni, dart_available=False)
        out = buf.getvalue()
        self.assertIn("예측 게이트 미통과", out)
        self.assertIn("DIAGNOSTIC FUNNEL", out)
        self.assertIn("claim 아님", out)

    def test_provenance_sidecar_written_durable_disclosure(self):
        # omxy MEDIUM fix: CSV 옆 provenance.json 이 funnel/cfg1/NO-CONFIG-PASSES 사실을 durable 보존.
        import json
        sel = self._gate_c_pass_selection()
        uni = self._universe_for(sel)
        with tempfile.TemporaryDirectory() as td:
            args = self._args(td, apply=False, approval_basis=None)
            with patch.object(MODULE, "select_bpp_candidates", return_value=sel):
                MODULE.run_bpp_candidates(args, [], {}, uni, dart_available=False)
            prov = Path(td) / "bpp.provenance.json"
            self.assertTrue(prov.exists())
            data = json.loads(prov.read_text(encoding="utf-8"))
            self.assertEqual(data["scoring"], "bpp")
            self.assertIn("cfg1", data["config"])
            self.assertTrue(data["diagnostic_funnel"])
            self.assertFalse(data["applied_to_production_tier0_candidates_150"])
            self.assertIn("NO-CONFIG-PASSES", data["prediction_gate"])
            self.assertEqual(data["rows"], 150)


class KrxPrefetchRetryTest(unittest.TestCase):
    """B++ 450d prefetch throttle 내성: _fetch_bydd_with_retry는 일시 RuntimeError를 backoff
    재시도하고, 소진 시 None(휴장 취급), 4xx는 전파(키 문제 surface). _krx_get contract 불변."""

    def test_transient_then_success(self):
        calls = {"n": 0}
        sleeps = []

        def flaky(market, dd):
            calls["n"] += 1
            if calls["n"] < 3:
                raise RuntimeError("KRX API JSON 파싱 실패")  # throttle 200-non-JSON
            return [{"ISU_CD": "005930"}]

        rows = MODULE._fetch_bydd_with_retry(flaky, "KOSPI", "20260501", attempts=3,
                                             _sleep=lambda s: sleeps.append(s))
        self.assertEqual(rows, [{"ISU_CD": "005930"}])
        self.assertEqual(len(sleeps), 2)

    def test_exhaustion_returns_none(self):
        sleeps = []

        def always_fail(market, dd):
            raise RuntimeError("throttle")

        rows = MODULE._fetch_bydd_with_retry(always_fail, "KOSPI", "20260501", attempts=3,
                                             _sleep=lambda s: sleeps.append(s))
        self.assertIsNone(rows)            # 휴장처럼 skip (전체 abort 방지)
        self.assertEqual(len(sleeps), 2)   # attempts-1 backoff

    def test_http_error_propagates_not_retried(self):
        import requests
        sleeps = []

        def auth_fail(market, dd):
            raise requests.HTTPError("401")

        with self.assertRaises(requests.HTTPError):
            MODULE._fetch_bydd_with_retry(auth_fail, "KOSPI", "20260501", attempts=3,
                                          _sleep=lambda s: sleeps.append(s))
        self.assertEqual(sleeps, [])  # 4xx 재시도 안 함


# Source 파일 string for grep-based tests (FetchUniverseSectorTest 전용)
MODULE_SOURCE = SCRIPT_PATH.read_text(encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
