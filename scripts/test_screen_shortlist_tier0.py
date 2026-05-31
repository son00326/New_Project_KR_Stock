import importlib.util
import unittest
from pathlib import Path


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


# Source 파일 string for grep-based tests (FetchUniverseSectorTest 전용)
MODULE_SOURCE = SCRIPT_PATH.read_text(encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
