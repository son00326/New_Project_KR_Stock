"""Unit tests for canonical_sector_mapper.

Covers plan §6.1 TDD invariants:
  T1 — DART induty normalization + canonical coverage (3~5자리 혼재, no 5-digit-only fixture)
  T2 — override priority (override > mapper > unresolved)
  T4 — unknown handling (null / non-numeric / unmatched prefix → unresolved)
  T10 — re-run idempotency (same input → same output, byte-stable)
"""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("canonical_sector_mapper.py")
SPEC = importlib.util.spec_from_file_location("canonical_sector_mapper", SCRIPT_PATH)
assert SPEC is not None
MAPPER = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MAPPER)


class NormalizeIndutyTest(unittest.TestCase):
    """T1 — induty_code normalization. 3~5자리만 허용, trim, fail-fast None."""

    def test_accepts_3_to_5_digit_numeric(self):
        # Plan §4.1 live evidence: 264 / 108 / 211 / 2612 / 2642 / 29272 / 70113
        for code in ("264", "108", "211", "2612", "2642", "29272", "70113"):
            self.assertEqual(MAPPER.normalize_induty(code), code, code)

    def test_trims_whitespace(self):
        self.assertEqual(MAPPER.normalize_induty("  264  "), "264")
        self.assertEqual(MAPPER.normalize_induty("\t70113\n"), "70113")

    def test_rejects_too_short_or_too_long(self):
        for bad in ("", "1", "12", "123456", "1234567"):
            self.assertIsNone(MAPPER.normalize_induty(bad), bad)

    def test_rejects_non_numeric(self):
        for bad in ("ABC", "26A", "1.23", "-264", "26 4"):
            self.assertIsNone(MAPPER.normalize_induty(bad), bad)

    def test_rejects_none(self):
        self.assertIsNone(MAPPER.normalize_induty(None))


class MapperLongestPrefixTest(unittest.TestCase):
    """T1 — longest-prefix match + canonical 14 coverage via mapper rule or unresolved."""

    def test_specific_prefix_beats_broad(self):
        # 282* → 2차전지 (specific) beats 28x → 에너지 (broad fallback)
        self.assertEqual(MAPPER.resolve_sector("X", "282", None), "2차전지")
        self.assertEqual(MAPPER.resolve_sector("X", "2820", None), "2차전지")
        self.assertEqual(MAPPER.resolve_sector("X", "28202", None), "2차전지")
        # 281 → 에너지 (per rule)
        self.assertEqual(MAPPER.resolve_sector("X", "28100", None), "에너지")

    def test_5_digit_uses_longest_prefix(self):
        # 26110 → 261→반도체 wins over 26→반도체 (same result, longer prefix matched)
        self.assertEqual(MAPPER.resolve_sector("X", "26110", None), "반도체")
        # 26400 → 264→통신
        self.assertEqual(MAPPER.resolve_sector("X", "26400", None), "통신")
        # 26410 → 264 prefix → 통신
        self.assertEqual(MAPPER.resolve_sector("X", "26410", None), "통신")

    def test_canonical_14_coverage_via_mapper(self):
        """canonical 14 중 mapper rule이 직접 결정하는 sector 전부 sample.

        입력은 항상 3~5자리 (normalize_induty contract). 2자리 broad rule은 longest-prefix
        fallback으로만 매칭된다.
        """
        cases = (
            ("21000", "바이오"),
            ("26110", "반도체"),
            ("41000", "건설"),
            ("64000", "금융"),
            ("282", "2차전지"),
            ("30000", "자동차"),
            ("62000", "IT/SW"),
            ("10000", "유통/소비재"),
            ("19000", "에너지"),
            ("59000", "엔터/미디어"),
            ("61000", "통신"),
            ("20000", "철강/소재"),
            ("50000", "운송/물류"),
            ("65000", "보험/증권"),
        )
        for induty, expected in cases:
            with self.subTest(induty=induty, expected=expected):
                self.assertEqual(MAPPER.resolve_sector("X", induty, None), expected)
        # 모든 14가 expected 집합에 포함
        self.assertEqual({s for _, s in cases}, set(MAPPER.CANONICAL_SECTORS))

    def test_unresolved_prefixes(self):
        """ambiguous prefix → unresolved sentinel. 입력 3~5자리 정합."""
        # 3+ digit forms of unresolved 2-digit and explicit unresolved 3+ digit rules
        for induty in ("700", "701", "70113", "29000", "29272", "690", "750"):
            with self.subTest(induty=induty):
                self.assertEqual(MAPPER.resolve_sector("X", induty, None), MAPPER.UNRESOLVED)


class OverridePriorityTest(unittest.TestCase):
    """T2 — override > mapper > unresolved."""

    def test_override_beats_mapper(self):
        override = {"452200": {"canonical": "2차전지", "reason": "민테크 배터리 진단장비"}}
        # Without override, mapper would say 27212 → '27' broad → 바이오.
        self.assertEqual(MAPPER.resolve_sector("452200", "27212", None), "바이오")
        # With override, 2차전지 wins.
        self.assertEqual(MAPPER.resolve_sector("452200", "27212", override), "2차전지")

    def test_override_beats_unresolved(self):
        override = {"999999": {"canonical": "통신", "reason": "test"}}
        self.assertEqual(MAPPER.resolve_sector("999999", "70113", override), "통신")
        self.assertEqual(MAPPER.resolve_sector("999999", None, override), "통신")
        # Without override → unresolved.
        self.assertEqual(MAPPER.resolve_sector("999999", "70113", None), MAPPER.UNRESOLVED)


class UnknownHandlingTest(unittest.TestCase):
    """T4 — unresolved cases."""

    def test_null_induty(self):
        self.assertEqual(MAPPER.resolve_sector("X", None, None), MAPPER.UNRESOLVED)

    def test_non_numeric_induty(self):
        self.assertEqual(MAPPER.resolve_sector("X", "ABC", None), MAPPER.UNRESOLVED)

    def test_unmatched_prefix(self):
        # 4자리 999x — no rule, no broad 99 rule → unresolved.
        self.assertEqual(MAPPER.resolve_sector("X", "9999", None), MAPPER.UNRESOLVED)


class IdempotencyTest(unittest.TestCase):
    """T10 — same input → same output (byte-stable)."""

    def test_repeated_calls_same_result(self):
        override = {"452200": {"canonical": "2차전지", "reason": "test"}}
        inputs = [
            ("452200", "27212"),
            ("005930", "264"),
            ("X", "21"),
            ("X", None),
            ("X", "9999"),
        ]
        for ticker, induty in inputs:
            r1 = MAPPER.resolve_sector(ticker, induty, override)
            r2 = MAPPER.resolve_sector(ticker, induty, override)
            r3 = MAPPER.resolve_sector(ticker, induty, override)
            self.assertEqual(r1, r2)
            self.assertEqual(r2, r3)


class ExplainTest(unittest.TestCase):
    """diagnostic helper — review CSV용 trace."""

    def test_explain_override_path(self):
        override = {"005930": {"canonical": "반도체", "reason": "삼성전자 primary 반도체"}}
        result = MAPPER.explain("005930", "264", override)
        self.assertEqual(result["source"], "override")
        self.assertEqual(result["final_sector"], "반도체")
        self.assertEqual(result["override_canonical"], "반도체")
        # mapper trace는 explain에서 override branch에서 None
        self.assertIsNone(result["mapper_prefix"])

    def test_explain_mapper_path(self):
        # 26199 starts with "261" (not "2611" — longest-prefix doesn't extend past digit match).
        result = MAPPER.explain("X", "26199", None)
        self.assertEqual(result["source"], "mapper")
        self.assertEqual(result["mapper_prefix"], "261")
        self.assertEqual(result["mapper_sector"], "반도체")
        self.assertEqual(result["final_sector"], "반도체")

    def test_explain_longest_prefix_wins(self):
        # 26110 matches both "2611" and "261" — longest "2611" wins.
        result = MAPPER.explain("X", "26110", None)
        self.assertEqual(result["mapper_prefix"], "2611")
        self.assertEqual(result["mapper_sector"], "반도체")

    def test_explain_exact_28202_prefix_wins(self):
        # plan §4.1 lists 282/2820/28202; exact 5-digit rule should appear in review trace.
        result = MAPPER.explain("X", "28202", None)
        self.assertEqual(result["mapper_prefix"], "28202")
        self.assertEqual(result["mapper_sector"], "2차전지")

    def test_explain_unresolved_path(self):
        result = MAPPER.explain("X", None, None)
        self.assertEqual(result["source"], "unresolved")
        self.assertEqual(result["final_sector"], MAPPER.UNRESOLVED)
        self.assertIsNone(result["induty_normalized"])

    def test_explain_unresolved_via_mapper(self):
        # 701 → unresolved (mapper rule explicitly unresolved)
        result = MAPPER.explain("X", "70113", None)
        self.assertEqual(result["source"], "unresolved")
        self.assertEqual(result["mapper_prefix"], "70113")
        self.assertEqual(result["mapper_sector"], MAPPER.UNRESOLVED)
        self.assertEqual(result["final_sector"], MAPPER.UNRESOLVED)


if __name__ == "__main__":
    unittest.main()
