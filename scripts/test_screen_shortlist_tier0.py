import importlib.util
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("screen_shortlist_tier0.py")
SPEC = importlib.util.spec_from_file_location("screen_shortlist_tier0", SCRIPT_PATH)
assert SPEC is not None
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def stock_signal(ticker: str, score: float):
    return MODULE.StockSignal(
        ticker=ticker,
        name=ticker,
        sector="테스트",
        market_cap_won=1,
        momentum=score,
        volume_surge=score,
        foreign_net=score,
        earnings=score,
        quality=score,
    )


class ScreenShortlistTier0Test(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
