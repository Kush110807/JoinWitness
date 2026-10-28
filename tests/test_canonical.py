import hashlib
import json
import math
import pytest

from joinwitness.canonical import canonical_json_bytes, parsed_records_sha256
from joinwitness.ingest import load_csv_bytes

REG = b"registration_id,name,group\nR1,Zo\xc3\xab,A\nR2,Kim,B\n"


def test_raw_hash_exact_bytes():
    _, digest = load_csv_bytes(REG, "registrations")
    assert digest.raw_sha256 == hashlib.sha256(REG).hexdigest()


def test_crlf_changes_raw_not_parsed():
    _, a = load_csv_bytes(REG, "registrations")
    _, b = load_csv_bytes(REG.replace(b"\n", b"\r\n"), "registrations")
    assert a.raw_sha256 != b.raw_sha256
    assert a.parsed_sha256 == b.parsed_sha256


def test_bom_changes_raw_not_parsed():
    _, a = load_csv_bytes(REG, "registrations")
    _, b = load_csv_bytes(b"\xef\xbb\xbf" + REG, "registrations")
    assert a.raw_sha256 != b.raw_sha256
    assert a.parsed_sha256 == b.parsed_sha256


def test_row_reorder_changes_parsed_hash():
    _, a = load_csv_bytes(REG, "registrations")
    changed = b"registration_id,name,group\nR2,Kim,B\nR1,Zo\xc3\xab,A\n"
    _, b = load_csv_bytes(changed, "registrations")
    assert a.parsed_sha256 != b.parsed_sha256


def test_header_reorder_same_parsed_hash():
    _, a = load_csv_bytes(REG, "registrations")
    changed = "name,group,registration_id\nZoë,A,R1\nKim,B,R2\n".encode()
    _, b = load_csv_bytes(changed, "registrations")
    assert a.raw_sha256 != b.raw_sha256
    assert a.parsed_sha256 == b.parsed_sha256


def test_fields_changed_trigger_changed_parsed_hash():
    _, a = load_csv_bytes(REG, "registrations")
    _, b = load_csv_bytes(REG.replace(b",B\n", b",A\n"), "registrations")
    assert a.parsed_sha256 != b.parsed_sha256


def test_canonical_object_key_order_independent():
    assert canonical_json_bytes({"b": 1, "a": 2}) == canonical_json_bytes({"a": 2, "b": 1})
    assert canonical_json_bytes({"b": 1, "a": 2}) == b'{"a":2,"b":1}'


def test_canonical_does_not_sort_arrays():
    assert canonical_json_bytes(["a", "b"]) != canonical_json_bytes(["b", "a"])


def test_nonfinite_float_rejected():
    with pytest.raises(ValueError):
        canonical_json_bytes({"p": math.nan})


def test_parsed_digest_is_domain_separated():
    rows, _ = load_csv_bytes(REG, "registrations")
    with pytest.raises(ValueError):
        parsed_records_sha256("unrecognized", rows)


def test_exact_canonical_encoding_is_reproducible():
    rows, digest = load_csv_bytes(REG, "registrations")
    payload = {"schema_version": "jw.dataset.v1", "source_kind": "registrations",
               "records": [r.model_dump(mode="json") for r in rows]}
    expected = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode("utf-8")
    assert digest.parsed_sha256 == hashlib.sha256(expected).hexdigest()


def test_flagship_known_sha256_golden():
    from pathlib import Path
    from joinwitness.ingest import load_pair
    fx = Path(__file__).resolve().parents[1] / "fixtures/flagship_flip"
    bundle = load_pair(fx / "registrations.csv", fx / "attendance.csv")
    assert bundle.registrations_digest.raw_sha256 == "98c829b8d06caaf39e68ffe12f437c734291ccd2ce13da8e66deedb28747c2bf"
    assert bundle.registrations_digest.parsed_sha256 == "b86addf1a9ba77bf220e8a108919c5cb2879b474bc3f8c3cdc7f20de67e4d618"
    assert bundle.attendance_digest.raw_sha256 == "c771e8ae9fd09b08f358ecf40678cf7ff53a448309fb927e1d2a3890be405ea3"
    assert bundle.attendance_digest.parsed_sha256 == "91356c5629efb0b43ccecb8390e86d9d47fdd80f4c851469acd868e193e93ea8"
