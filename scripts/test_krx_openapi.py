"""Unit tests for scripts/krx_openapi.py — KRX 공식 Open API client.

KRX 공식 Open API 전환 (Tier 0 스크리닝). 실 네트워크 호출 0 — 가짜 응답/키만 주입.
- _krx_get: 모듈의 `requests.get`을 monkeypatch + fake resp 객체(status_code/json/raise_for_status).
- _sleep: 인자로 주입(retry 테스트 즉시).
- _get_auth_key: os.environ monkeypatch.

테스트 러너 = python -m unittest (pytest 없음).
"""

import importlib.util
import os
import unittest
from pathlib import Path
from unittest import mock


SCRIPT_PATH = Path(__file__).with_name("krx_openapi.py")
SPEC = importlib.util.spec_from_file_location("krx_openapi", SCRIPT_PATH)
assert SPEC is not None
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class _FakeResp:
    """status_code / json() / raise_for_status() 를 흉내내는 가짜 requests 응답."""

    def __init__(self, status_code=200, payload=None, raise_exc=None, json_exc=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self._raise_exc = raise_exc
        self._json_exc = json_exc

    def json(self):
        if self._json_exc is not None:
            raise self._json_exc
        return self._payload

    def raise_for_status(self):
        if self._raise_exc is not None:
            raise self._raise_exc
        if self.status_code >= 400:
            import requests

            raise requests.HTTPError(f"{self.status_code} error")


class ToFloatTest(unittest.TestCase):
    def test_to_float_parsing(self):
        self.assertEqual(MODULE._to_float("317000"), 317000.0)
        self.assertEqual(MODULE._to_float("1,234,567"), 1234567.0)
        self.assertEqual(MODULE._to_float(""), 0.0)
        self.assertEqual(MODULE._to_float("-"), 0.0)
        self.assertEqual(MODULE._to_float("N/A"), 0.0)
        self.assertEqual(MODULE._to_float(None), 0.0)
        self.assertEqual(MODULE._to_float("12.5"), 12.5)


class KrxGetEmptyOutblockTest(unittest.TestCase):
    def test_krx_get_empty_outblock(self):
        # OutBlock_1 키 자체가 없는 응답 → [] (주말/휴장/미갱신 정상)
        with mock.patch.dict(os.environ, {"KRX_OPENAPI_KEY": "fake-key"}):
            with mock.patch.object(MODULE.requests, "get", return_value=_FakeResp(200, {})):
                result = MODULE._krx_get("sto/stk_bydd_trd", {"basDd": "20260501"})
        self.assertEqual(result, [])

    def test_krx_get_json_parse_failure_raises_runtime_error(self):
        with mock.patch.dict(os.environ, {"KRX_OPENAPI_KEY": "fake-key"}):
            with mock.patch.object(
                MODULE.requests,
                "get",
                return_value=_FakeResp(200, json_exc=ValueError("not json")),
            ):
                with self.assertRaisesRegex(RuntimeError, "JSON 파싱 실패"):
                    MODULE._krx_get("sto/stk_bydd_trd", {"basDd": "20260501"})

    def test_krx_get_non_list_outblock_raises_runtime_error(self):
        with mock.patch.dict(os.environ, {"KRX_OPENAPI_KEY": "fake-key"}):
            with mock.patch.object(
                MODULE.requests,
                "get",
                return_value=_FakeResp(200, {"OutBlock_1": {"ISU_CD": "005930"}}),
            ):
                with self.assertRaisesRegex(RuntimeError, "OutBlock_1이 list가 아닙니다"):
                    MODULE._krx_get("sto/stk_bydd_trd", {"basDd": "20260501"})

    def test_krx_get_non_object_outblock_row_raises_runtime_error(self):
        with mock.patch.dict(os.environ, {"KRX_OPENAPI_KEY": "fake-key"}):
            with mock.patch.object(
                MODULE.requests,
                "get",
                return_value=_FakeResp(200, {"OutBlock_1": ["bad-row"]}),
            ):
                with self.assertRaisesRegex(RuntimeError, "row가 object가 아닙니다"):
                    MODULE._krx_get("sto/stk_bydd_trd", {"basDd": "20260501"})


class KrxGetRetryTest(unittest.TestCase):
    def test_krx_get_retry_then_success(self):
        responses = [
            _FakeResp(503),
            _FakeResp(503),
            _FakeResp(200, {"OutBlock_1": [{"ISU_CD": "005930"}]}),
        ]
        sleep_calls = []

        def fake_get(*args, **kwargs):
            return responses.pop(0)

        with mock.patch.dict(os.environ, {"KRX_OPENAPI_KEY": "fake-key"}):
            with mock.patch.object(MODULE.requests, "get", side_effect=fake_get):
                result = MODULE._krx_get(
                    "sto/stk_bydd_trd",
                    {"basDd": "20260501"},
                    _sleep=lambda s: sleep_calls.append(s),
                )
        self.assertEqual(result, [{"ISU_CD": "005930"}])
        self.assertEqual(len(sleep_calls), 2)  # 503 두 번 → backoff 두 번


class KrxGet4xxNoRetryTest(unittest.TestCase):
    def test_krx_get_4xx_no_retry(self):
        # 401 → 즉시 raise (키문제 숨기지 않음), _sleep 호출 0회
        sleep_calls = []
        import requests

        resp = _FakeResp(401, raise_exc=requests.HTTPError("401 Unauthorized"))
        with mock.patch.dict(os.environ, {"KRX_OPENAPI_KEY": "fake-key"}):
            with mock.patch.object(MODULE.requests, "get", return_value=resp):
                with self.assertRaises(requests.HTTPError):
                    MODULE._krx_get(
                        "sto/stk_bydd_trd",
                        {"basDd": "20260501"},
                        _sleep=lambda s: sleep_calls.append(s),
                    )
        self.assertEqual(sleep_calls, [])


class KrxGetMaxRetriesTest(unittest.TestCase):
    def test_krx_get_max_retries_exhausted(self):
        # 503 4회(MAX_RETRIES) → RuntimeError
        sleep_calls = []

        def fake_get(*args, **kwargs):
            return _FakeResp(503)

        with mock.patch.dict(os.environ, {"KRX_OPENAPI_KEY": "fake-key"}):
            with mock.patch.object(MODULE.requests, "get", side_effect=fake_get):
                with self.assertRaises(RuntimeError):
                    MODULE._krx_get(
                        "sto/stk_bydd_trd",
                        {"basDd": "20260501"},
                        _sleep=lambda s: sleep_calls.append(s),
                    )
        # 마지막 시도 뒤에는 더 재시도할 수 없으므로 sleep하지 않는다.
        self.assertEqual(len(sleep_calls), MODULE.MAX_RETRIES - 1)


class IsCommonStockTest(unittest.TestCase):
    def test_is_common_stock(self):
        self.assertTrue(
            MODULE.is_common_stock({"KIND_STKCERT_TP_NM": "보통주", "SECUGRP_NM": "주권"})
        )
        self.assertFalse(
            MODULE.is_common_stock({"KIND_STKCERT_TP_NM": "우선주", "SECUGRP_NM": "주권"})
        )
        self.assertFalse(
            MODULE.is_common_stock({"KIND_STKCERT_TP_NM": "보통주", "SECUGRP_NM": "수익증권"})
        )
        self.assertFalse(MODULE.is_common_stock(None))


class FetchIsuBaseTest(unittest.TestCase):
    def test_fetch_isu_base_keyed_by_srt_cd(self):
        rows = [
            {"ISU_SRT_CD": "005930", "ISU_NM": "삼성전자", "KIND_STKCERT_TP_NM": "보통주", "SECUGRP_NM": "주권"},
            {"ISU_SRT_CD": "000660", "ISU_NM": "SK하이닉스", "KIND_STKCERT_TP_NM": "보통주", "SECUGRP_NM": "주권"},
            {"ISU_SRT_CD": "", "ISU_NM": "no-srt-cd"},  # ISU_SRT_CD 없는 row → 스킵
        ]
        captured = {}

        def fake_fetch(endpoint, params):
            captured["endpoint"] = endpoint
            captured["params"] = params
            return rows

        result = MODULE.fetch_isu_base("KOSPI", "20260501", _fetch=fake_fetch)
        self.assertEqual(set(result.keys()), {"005930", "000660"})
        self.assertEqual(result["005930"]["ISU_NM"], "삼성전자")
        self.assertEqual(captured["endpoint"], MODULE.EP_STK_BASE)
        self.assertEqual(captured["params"], {"basDd": "20260501"})


class AuthKeyMissingTest(unittest.TestCase):
    def test_auth_key_missing_exits(self):
        # env 미설정 → SystemExit (친절 메시지)
        with mock.patch.dict(os.environ, {}, clear=True):
            os.environ.pop("KRX_OPENAPI_KEY", None)
            with self.assertRaises(SystemExit):
                MODULE._get_auth_key()


if __name__ == "__main__":
    unittest.main()
