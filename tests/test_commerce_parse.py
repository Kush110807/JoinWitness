"""Strict four-CSV import matrix over service.op_parse (fresh store per test)."""
import copy

import pytest

from joinwitness.commerce.errors import CommerceError
from joinwitness.commerce.service import op_parse
from joinwitness.commerce.session_state import Store

from tests.test_commerce_helpers import b64_bytes, files_payload, fixture_bytes

BUNDLE = "e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50"


def parse(bundle="commerce_demo", mutate=None):
    payload = files_payload(bundle)
    if mutate:
        mutate(payload)
    return op_parse(payload, Store())


def expect_error(payload, code, path=None, status=None):
    with pytest.raises(CommerceError) as caught:
        op_parse(payload, Store())
    assert caught.value.code == code
    if path is not None:
        assert caught.value.path == path
    if status is not None:
        assert caught.value.http_status == status
    envelope = caught.value.envelope()
    assert envelope["verified"] is False
    assert set(envelope["error"]) == {"code", "message", "path", "details"}
    return caught.value


def test_valid_demo3_import():
    body = parse()
    assert body["contract_version"] == "commerce.v1"
    assert body["state"] == "IMPORTED"
    assert len(body["session_id"]) == 32
    assert (body["source_revision"], body["candidate_revision"]) == (1, 1)
    assert body["source_bundle_sha256"] == BUNDLE
    assert body["row_counts"] == {"orders": 3, "payments": 3, "deliveries": 3, "refunds": 1}
    assert body["deterministic_candidates"] == [
        {"record_key": "payment:P1", "target_id": "O1", "origin": "SOURCE_REF", "authorised": False},
        {"record_key": "payment:P2", "target_id": "O2", "origin": "SOURCE_REF", "authorised": False},
        {"record_key": "payment:P3", "target_id": "O3", "origin": "SOURCE_REF", "authorised": False},
        {"record_key": "delivery:D1", "target_id": "O1", "origin": "SOURCE_REF", "authorised": False},
        {"record_key": "delivery:D2", "target_id": "O2", "origin": "SOURCE_REF", "authorised": False},
        {"record_key": "delivery:D3", "target_id": "O3", "origin": "SOURCE_REF", "authorised": False},
        {"record_key": "refund:R1", "target_id": "P3", "origin": "SOURCE_REF", "authorised": False},
    ]
    assert body["ai_status"] == "NOT_REQUESTED"
    assert body["limits"] == {"orders": 50, "each_other_file": 60, "variables": 10,
                              "alternatives_per_variable": 2, "raw_worlds": 4096}
    view = body["validated_source_rows"]
    assert [row["order_id"] for row in view["orders"]] == ["O1", "O2", "O3"]
    assert view["orders"][0] == {"source_row_number": 2, "order_id": "O1",
                                 "customer_id": "C1", "order_total": "100.00", "currency": "USD"}
    assert view["payments"][2]["source_row_number"] == 4
    assert view["refunds"][0]["payment_ref"] == "P3"


def test_missing_file():
    payload = files_payload()
    del payload["files"]["payments.csv"]
    expect_error(payload, "MISSING_FILE", "files.payments.csv", 400)


def test_unexpected_file():
    payload = files_payload()
    payload["files"]["extra.csv"] = {"content_base64": b64_bytes(b"a\n")}
    expect_error(payload, "UNEXPECTED_FILE", "files.extra.csv", 400)


def test_bad_contract_version():
    payload = files_payload()
    payload["contract_version"] = "commerce.v2"
    expect_error(payload, "INVALID_VALUE", "contract_version", 422)


def test_unknown_top_level_field():
    payload = files_payload()
    payload["validated_source_rows"] = {}
    expect_error(payload, "INVALID_VALUE", "validated_source_rows", 422)


def test_malformed_base64():
    payload = files_payload()
    payload["files"]["orders.csv"] = {"content_base64": "!!!not-base64!!!"}
    expect_error(payload, "INVALID_SOURCE", "files.orders.csv", 422)


def test_non_canonical_base64_rejected():
    payload = files_payload()
    raw = fixture_bytes("commerce_demo", "orders.csv")
    padded = b64_bytes(raw)
    assert padded.endswith("=")
    tampered = padded[:-1] + ("A" if not padded.endswith("A") else "B")
    payload["files"]["orders.csv"] = {"content_base64": tampered}
    expect_error(payload, "INVALID_SOURCE", "files.orders.csv", 422)


def test_bom_rejected():
    payload = files_payload()
    raw = b"\xef\xbb\xbf" + fixture_bytes("commerce_demo", "orders.csv")
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(raw)}
    expect_error(payload, "INVALID_SOURCE", "files.orders.csv", 422)


def test_invalid_utf8_rejected():
    payload = files_payload()
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(b"order_id,\xff\n")}
    expect_error(payload, "INVALID_SOURCE", "files.orders.csv", 422)


def test_control_character_rejected():
    payload = files_payload()
    raw = fixture_bytes("commerce_demo", "orders.csv").replace(b"O1", b"O\x011", 1)
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(raw)}
    expect_error(payload, "INVALID_SOURCE", "files.orders.csv", 422)


def test_lone_cr_rejected():
    payload = files_payload()
    raw = fixture_bytes("commerce_demo", "orders.csv").replace(b"\n", b"\r", 1)
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(raw)}
    expect_error(payload, "INVALID_SOURCE", "files.orders.csv", 422)


def test_blank_line_rejected():
    payload = files_payload()
    raw = fixture_bytes("commerce_demo", "orders.csv").replace(b"O2,", b"\nO2,", 1)
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(raw)}
    expect_error(payload, "INVALID_SOURCE", "files.orders.csv", 422)


def test_wrong_headers_rejected():
    payload = files_payload()
    raw = fixture_bytes("commerce_demo", "orders.csv").replace(b"order_total", b"total", 1)
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(raw)}
    expect_error(payload, "INVALID_SCHEMA", "files.orders.csv", 422)


def test_extra_column_rejected():
    payload = files_payload()
    raw = fixture_bytes("commerce_demo", "orders.csv").replace(b"80.00,USD\n", b"80.00,USD,X\n", 1)
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(raw)}
    expect_error(payload, "INVALID_SCHEMA", "files.orders.csv", 422)


def test_crlf_accepted_with_different_bundle():
    payload = files_payload()
    for name in payload["files"]:
        raw = fixture_bytes("commerce_demo", name).replace(b"\n", b"\r\n")
        payload["files"][name] = {"content_base64": b64_bytes(raw)}
    body = op_parse(payload, Store())
    assert body["source_bundle_sha256"] != BUNDLE
    assert body["row_counts"] == {"orders": 3, "payments": 3, "deliveries": 3, "refunds": 1}


def test_invalid_identifier():
    payload = files_payload()
    raw = fixture_bytes("commerce_demo", "orders.csv").replace(b"O1,C1", b"o1,C1", 1)
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(raw)}
    expect_error(payload, "INVALID_VALUE", "files.orders.csv", 422)


@pytest.mark.parametrize("bad", ["0.00", "1.0", "1.000", "-1.00", "01.00", " 100.00", "NaN", "1e2"])
def test_invalid_money(bad):
    payload = files_payload()
    raw = fixture_bytes("commerce_demo", "orders.csv").replace(b"100.00", bad.encode(), 1)
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(raw)}
    expect_error(payload, "INVALID_VALUE", "files.orders.csv", 422)


def test_invalid_status():
    payload = files_payload()
    raw = fixture_bytes("commerce_demo", "payments.csv").replace(b"SETTLED", b"PAID", 1)
    payload["files"]["payments.csv"] = {"content_base64": b64_bytes(raw)}
    expect_error(payload, "INVALID_VALUE", "files.payments.csv", 422)


def test_invalid_currency():
    payload = files_payload()
    raw = fixture_bytes("commerce_demo", "orders.csv").replace(b",USD\n", b",EUR\n", 1)
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(raw)}
    expect_error(payload, "INVALID_VALUE", "files.orders.csv", 422)


def test_duplicate_id():
    payload = files_payload()
    raw = fixture_bytes("commerce_demo", "payments.csv").replace(b"P2,O2", b"P1,O2", 1)
    payload["files"]["payments.csv"] = {"content_base64": b64_bytes(raw)}
    err = expect_error(payload, "DUPLICATE_ID", "files.payments.csv", 422)
    assert err.details == {"record_id": "P1"}


def test_semantic_duplicate_distinct_ids():
    payload = files_payload()
    raw = fixture_bytes("commerce_demo", "payments.csv").replace(b"P2,O2,100.00", b"P9,O1,100.00", 1)
    payload["files"]["payments.csv"] = {"content_base64": b64_bytes(raw)}
    expect_error(payload, "DUPLICATE_EVENT", "files.payments.csv", 422)


def test_missing_referenced_record():
    payload = files_payload()
    raw = fixture_bytes("commerce_demo", "payments.csv").replace(b"P1,O1", b"P1,O9", 1)
    payload["files"]["payments.csv"] = {"content_base64": b64_bytes(raw)}
    expect_error(payload, "MISSING_REFERENCED_RECORD", "files.payments.csv", 422)


def test_blank_ref_allowed_without_candidate():
    payload = files_payload()
    raw = fixture_bytes("commerce_demo", "deliveries.csv").replace(b"D3,O3", b"D3,", 1)
    payload["files"]["deliveries.csv"] = {"content_base64": b64_bytes(raw)}
    body = op_parse(payload, Store())
    keys = [(c["record_key"], c["target_id"]) for c in body["deterministic_candidates"]]
    assert ("delivery:D3", "O3") not in keys
    assert len(keys) == 6


def test_header_only_optionals_accepted():
    body = parse("commerce_demo_empty")
    assert body["row_counts"] == {"orders": 2, "payments": 0, "deliveries": 0, "refunds": 0}
    assert body["deterministic_candidates"] == []
    assert body["validated_source_rows"]["payments"] == []


def test_zero_orders_rejected():
    payload = files_payload()
    payload["files"]["orders.csv"] = {
        "content_base64": b64_bytes(b"order_id,customer_id,order_total,currency\n")
    }
    expect_error(payload, "INVALID_VALUE", "files.orders.csv", 422)


def _big_orders(count):
    lines = ["order_id,customer_id,order_total,currency"]
    for i in range(1, count + 1):
        lines.append(f"O{i},C{i},10.00,USD")
    return ("\n".join(lines) + "\n").encode()


def _big_payments(count):
    lines = ["payment_id,order_ref,amount,currency,status"]
    for i in range(1, count + 1):
        lines.append(f"P{i},O1,{i}.00,USD,PENDING")
    return ("\n".join(lines) + "\n").encode()


def test_row_caps_boundary():
    payload = files_payload()
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(_big_orders(50))}
    payload["files"]["payments.csv"] = {"content_base64": b64_bytes(_big_payments(60))}
    for name in ("deliveries.csv", "refunds.csv"):
        header = fixture_bytes("commerce_demo_empty", name)
        payload["files"][name] = {"content_base64": b64_bytes(header)}
    body = op_parse(payload, Store())
    assert body["row_counts"]["orders"] == 50
    assert body["row_counts"]["payments"] == 60


def test_51_orders_rejected():
    payload = files_payload()
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(_big_orders(51))}
    expect_error(payload, "LIMIT_EXCEEDED", "files.orders.csv", 422)


def test_61_payments_rejected():
    payload = files_payload()
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(_big_orders(1))}
    payload["files"]["payments.csv"] = {"content_base64": b64_bytes(_big_payments(61))}
    expect_error(payload, "LIMIT_EXCEEDED", "files.payments.csv", 422)


def test_oversize_file_rejected():
    payload = files_payload()
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(b"A" * (64 * 1024 + 1))}
    expect_error(payload, "LIMIT_EXCEEDED", "files.orders.csv", 413)
