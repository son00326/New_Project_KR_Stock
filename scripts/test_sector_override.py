"""Schema validation tests for sector_override.json.

Covers plan §6.1 TDD invariant T3 — override schema validity:
  - JSON parse fail-fast
  - canonical ∈ CANONICAL_SECTORS 14
  - ticker key 6-digit numeric
  - reason non-empty string

T2 (override priority) is in test_canonical_sector_mapper.py.
"""
from __future__ import annotations

import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("canonical_sector_mapper.py")
SPEC = importlib.util.spec_from_file_location("canonical_sector_mapper", SCRIPT_PATH)
assert SPEC is not None
MAPPER = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MAPPER)


def _temp_json(content: str) -> Path:
    f = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
    try:
        f.write(content)
    finally:
        f.close()
    return Path(f.name)


class OverrideSchemaTest(unittest.TestCase):

    def tearDown(self):
        for p in getattr(self, "_temp_files", ()):
            try:
                os.unlink(p)
            except FileNotFoundError:
                pass

    def _make(self, content: str) -> Path:
        p = _temp_json(content)
        self._temp_files = (*getattr(self, "_temp_files", ()), p)
        return p

    def test_valid_override_loads(self):
        p = self._make(json.dumps({
            "override_version": "v1",
            "override_date": "2026-05-28",
            "override_source": "test",
            "tickers": {
                "452200": {"canonical": "2차전지", "reason": "민테크 배터리 진단장비"},
                "005930": {"canonical": "반도체", "reason": "삼성전자"},
            },
        }))
        result = MAPPER.load_override(p)
        self.assertEqual(result["452200"]["canonical"], "2차전지")
        self.assertEqual(result["005930"]["canonical"], "반도체")
        self.assertEqual(result["452200"]["reason"], "민테크 배터리 진단장비")

    def test_invalid_json_raises(self):
        p = self._make("not valid JSON {{{")
        with self.assertRaises(MAPPER.OverrideSchemaError) as ctx:
            MAPPER.load_override(p)
        self.assertIn("JSON parse", str(ctx.exception))

    def test_non_canonical_sector_raises(self):
        p = self._make(json.dumps({
            "tickers": {
                "005930": {"canonical": "테크", "reason": "fake sector"},
            }
        }))
        with self.assertRaises(MAPPER.OverrideSchemaError) as ctx:
            MAPPER.load_override(p)
        self.assertIn("CANONICAL_SECTORS", str(ctx.exception))

    def test_non_6_digit_ticker_raises(self):
        p = self._make(json.dumps({
            "tickers": {
                "ABC123": {"canonical": "반도체", "reason": "bad ticker"},
            }
        }))
        with self.assertRaises(MAPPER.OverrideSchemaError):
            MAPPER.load_override(p)
        # 5-digit
        p2 = self._make(json.dumps({
            "tickers": {
                "00593": {"canonical": "반도체", "reason": "short ticker"},
            }
        }))
        with self.assertRaises(MAPPER.OverrideSchemaError):
            MAPPER.load_override(p2)
        # 7-digit
        p3 = self._make(json.dumps({
            "tickers": {
                "0059300": {"canonical": "반도체", "reason": "long ticker"},
            }
        }))
        with self.assertRaises(MAPPER.OverrideSchemaError):
            MAPPER.load_override(p3)

    def test_empty_reason_raises(self):
        p = self._make(json.dumps({
            "tickers": {
                "005930": {"canonical": "반도체", "reason": ""},
            }
        }))
        with self.assertRaises(MAPPER.OverrideSchemaError) as ctx:
            MAPPER.load_override(p)
        self.assertIn("reason", str(ctx.exception))
        # whitespace-only
        p2 = self._make(json.dumps({
            "tickers": {
                "005930": {"canonical": "반도체", "reason": "   "},
            }
        }))
        with self.assertRaises(MAPPER.OverrideSchemaError):
            MAPPER.load_override(p2)

    def test_missing_tickers_field_raises(self):
        p = self._make(json.dumps({"override_version": "v1"}))
        with self.assertRaises(MAPPER.OverrideSchemaError) as ctx:
            MAPPER.load_override(p)
        self.assertIn("tickers", str(ctx.exception))

    def test_tickers_not_dict_raises(self):
        p = self._make(json.dumps({"tickers": ["005930"]}))
        with self.assertRaises(MAPPER.OverrideSchemaError):
            MAPPER.load_override(p)

    def test_non_string_canonical_raises(self):
        p = self._make(json.dumps({
            "tickers": {
                "005930": {"canonical": 123, "reason": "numeric"},
            }
        }))
        with self.assertRaises(MAPPER.OverrideSchemaError):
            MAPPER.load_override(p)


class ProductionOverrideFileTest(unittest.TestCase):
    """현재 commit된 scripts/sector_override.json이 schema 통과하는지 검증."""

    def test_production_override_loads(self):
        prod_path = SCRIPT_PATH.with_name("sector_override.json")
        result = MAPPER.load_override(prod_path)
        # mapper가 이미 맞히는 ticker가 override에 들어있으면 안 됨 (plan §4.2 rule 3 — fixture로만 사용).
        # 본 테스트는 schema validity만 검증; 실제 ticker별 효과는 별도 검증.
        self.assertIsInstance(result, dict)
        for ticker, entry in result.items():
            self.assertEqual(len(ticker), 6, f"ticker {ticker} not 6-digit")
            self.assertIn(entry["canonical"], MAPPER.CANONICAL_SECTORS)
            self.assertTrue(entry["reason"].strip())

    def test_current_row_false_positive_mapper_overrides_are_seeded(self):
        prod_path = SCRIPT_PATH.with_name("sector_override.json")
        override = MAPPER.load_override(prod_path)
        self.assertEqual(MAPPER.resolve_sector("322000", "2612", override=override), "에너지")
        self.assertEqual(MAPPER.resolve_sector("226330", "582", override=override), "바이오")
        # Without override, these current-row evidence cases are broad-rule false positives.
        self.assertEqual(MAPPER.resolve_sector("322000", "2612", override={}), "반도체")
        self.assertEqual(MAPPER.resolve_sector("226330", "582", override={}), "IT/SW")


class Migration0026ScopeTest(unittest.TestCase):
    """T8 — 0026 must not add short_list_30 sector CHECK before USER backfill PASS."""

    def test_0026_does_not_touch_short_list_30_or_rls_grants(self):
        repo_root = SCRIPT_PATH.parents[1]
        sql_path = repo_root / "tudal" / "supabase" / "migrations" / "0026_dart_corp_codes_induty_code.sql"
        sql = sql_path.read_text(encoding="utf-8")
        self.assertNotRegex(sql, r"(?im)^\s*alter\s+table\s+public\.short_list_30\b")
        self.assertNotRegex(sql, r"(?im)^\s*(grant|revoke|create\s+policy|alter\s+policy|drop\s+policy)\b")
        self.assertIn("dart_corp_codes_induty_code_format_check", sql)
        self.assertIn("^[0-9]{3,5}$", sql)


if __name__ == "__main__":
    unittest.main()
