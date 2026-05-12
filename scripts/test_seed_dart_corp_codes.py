"""Unittest for scripts/seed_dart_corp_codes.py — corp_cls mapping + filtering."""
from __future__ import annotations

import io
import unittest
import zipfile
from unittest.mock import MagicMock


class TestParseCorpCodeXml(unittest.TestCase):
    def test_kospi_kosdaq_konex_mapping(self):
        from scripts.seed_dart_corp_codes import parse_corp_code_xml

        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <result>
          <list>
            <corp_code>00126380</corp_code>
            <corp_name>삼성전자</corp_name>
            <stock_code>005930</stock_code>
            <corp_cls>Y</corp_cls>
          </list>
          <list>
            <corp_code>00164779</corp_code>
            <corp_name>셀트리온헬스케어</corp_name>
            <stock_code>091990</stock_code>
            <corp_cls>K</corp_cls>
          </list>
          <list>
            <corp_code>00111111</corp_code>
            <corp_name>코넥스기업</corp_name>
            <stock_code>222222</stock_code>
            <corp_cls>N</corp_cls>
          </list>
        </result>
        """
        rows = parse_corp_code_xml(xml)
        markets = {r["ticker"]: r["market"] for r in rows}
        self.assertEqual(markets["005930"], "KOSPI")
        self.assertEqual(markets["091990"], "KOSDAQ")
        self.assertEqual(markets["222222"], "KONEX")
        self.assertEqual(len(rows), 3)

    def test_exclude_unlisted_e_class(self):
        from scripts.seed_dart_corp_codes import parse_corp_code_xml

        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <result>
          <list>
            <corp_code>99999999</corp_code>
            <corp_name>유한회사예시</corp_name>
            <stock_code> </stock_code>
            <corp_cls>E</corp_cls>
          </list>
          <list>
            <corp_code>00126380</corp_code>
            <corp_name>삼성전자</corp_name>
            <stock_code>005930</stock_code>
            <corp_cls>Y</corp_cls>
          </list>
        </result>
        """
        rows = parse_corp_code_xml(xml)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["ticker"], "005930")

    def test_unknown_corp_cls_excluded(self):
        from scripts.seed_dart_corp_codes import parse_corp_code_xml

        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <result>
          <list>
            <corp_code>00126380</corp_code>
            <corp_name>알수없는회사</corp_name>
            <stock_code>123456</stock_code>
            <corp_cls>X</corp_cls>
          </list>
        </result>
        """
        rows = parse_corp_code_xml(xml)
        self.assertEqual(rows, [])


class TestDownloadAndUpsert(unittest.TestCase):
    def test_extract_xml_from_zip_bytes(self):
        from scripts.seed_dart_corp_codes import extract_xml_from_zip

        xml_body = "<result><list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><stock_code>005930</stock_code><corp_cls>Y</corp_cls></list></result>"
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("CORPCODE.xml", xml_body)
        text = extract_xml_from_zip(buf.getvalue())
        self.assertIn("삼성전자", text)
        self.assertIn("005930", text)

    def test_upsert_batches_rows(self):
        from scripts.seed_dart_corp_codes import upsert_corp_codes

        client = MagicMock()
        table = MagicMock()
        client.table.return_value = table
        table.upsert.return_value = table
        table.execute.return_value = MagicMock(data=[{}])

        rows = [
            {"ticker": f"{i:06d}", "corp_code": f"{i:08d}", "corp_name": f"co{i}", "market": "KOSPI"}
            for i in range(1200)
        ]
        n = upsert_corp_codes(client, rows, batch_size=500)
        self.assertEqual(n, 1200)
        self.assertEqual(table.upsert.call_count, 3)


if __name__ == "__main__":
    unittest.main()
