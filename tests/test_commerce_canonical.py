"""Frozen commerce.v1 digest vectors: the canonical recipe must reproduce them.

Pins section 1.3 B02 vectors, the section 7 digest register and every section
5.7 canonical_hash_vectors entry. Expected hashes are the frozen values; the
payloads are rebuilt from module primitives plus small embedded literals.
"""
import copy

from joinwitness.commerce import canonical
from joinwitness.commerce import candidates as cand
from joinwitness.commerce import meta_suggestions as meta
from joinwitness.commerce import review as review_mod
from joinwitness.commerce.source_import import import_sources

from tests.test_commerce_helpers import (
    ATTESTATION,
    BASELINE_MAP,
    MANUAL_D2_O3,
    REASON_D2_O3,
    ROWS_7,
    files_payload,
    fixture_bytes,
)

POLICY_SHA_B02 = "cc07bdc869ad4c8f2ad1bbadbb8c853404cbd03701c6baee45111d998ca0ffba"
CATALOG_SHA_MANUAL = "4c8646f8684112ba4cb3a1bfb072b73e8aa2b309ce199e1e9567a6cb99db5098"
BASELINE_SHA_B02 = "49cf0a9061605aa42b5735d130a9c9eb1ad692860119fd62c753dd0538c8fd74"
REVIEW_SHA_B02 = "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9"
BUNDLE_SHA = "e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50"

META_CATALOG_SHA = "c81a620e1d70389cfae5b41a2d5dc933293ecafb052fe55e2b427f6cd7a9daab"
META_POLICY_SHA = "91a0a5d819757b7b8b6b17b56a5c7b4526c246553c1642e367067c7366aaed0a"
META_BASELINE_SHA = "a88d21b120afd518dae8c359e6508c2ff11036da96360498576c5d8ed65a1b66"
META_REVIEW_SHA = "a11d1186c5de25cb42b048e7f2e124070ddbd1e2b24abc0d732680d0819d7b69"

STABLE_POLICY_SHA = "706acbcd45e5fb82c82a118f93daea9bb10dc685a003998679c7047660511c77"
STABLE_BASELINE_SHA = "db2aa1b8d330e97582701585f0d55db5a3ac0e3cb4d4f25b1b049ccd5f885c3b"
STABLE_REVIEW_SHA = "0c298a4f34adce5ee5fac514cefafcc1dd7a300fa066500eea9db7787b23a85b"
RECEIPT_SHA_FROZEN = "9f91554882665727c0d04112d7c8ebd9b77eb9f9be6fad7f7a9edde7633ce7e8"

META_EVIDENCE = "Candidate relates D2 to O3; source references O2 and must be reviewed."


def _bundle():
    return import_sources(files_payload()["files"])


def _manual_catalog():
    bundle = _bundle()
    source = cand.build_source_candidates(bundle)
    manual = [cand.Candidate("delivery:D2", "O3", cand.ORIGIN_MANUAL, reason=REASON_D2_O3)]
    return bundle, cand.sort_catalog(source + manual)


def test_b02_baseline_vector():
    payload = {"policy_sha256": POLICY_SHA_B02, "reference_mapping": dict(BASELINE_MAP)}
    assert len(canonical.cjson_bytes(payload)) == 234
    assert canonical.domain_digest(canonical.DOMAIN_BASELINE, payload) == BASELINE_SHA_B02


def test_b02_review_vector():
    payload = {"policy_sha256": POLICY_SHA_B02, "baseline_sha256": BASELINE_SHA_B02}
    assert len(canonical.cjson_bytes(payload)) == 169
    assert canonical.domain_digest(canonical.DOMAIN_REVIEW, payload) == REVIEW_SHA_B02


def test_source_bundle_register():
    bundle = _bundle()
    assert bundle.file_sha256 == {
        "orders.csv": "8063a0ead1bdbf5764900e34009e9331847d7e74e57b541a6e554bdcfbf0ee95",
        "payments.csv": "9dbac299fb73598818afeef13d3827cb40da73de1fb38966399cc3a94100f441",
        "deliveries.csv": "e02c99782c8f02ae8b50572cc3fcadfec12d7c00d6f9b272711388fd4ec2c084",
        "refunds.csv": "aae37407144077385b8ad87b33d8d8faeb4b9d32f67988c4960c17b79469de56",
    }
    assert bundle.bundle_sha256 == BUNDLE_SHA


def test_manual_catalog_digest():
    _, catalog = _manual_catalog()
    assert canonical.domain_digest(
        canonical.DOMAIN_CANDIDATES, [cand.entry_digest_dict(e) for e in catalog]
    ) == CATALOG_SHA_MANUAL


def test_manual_policy_digest_k2():
    _, catalog = _manual_catalog()
    payload = review_mod.policy_payload(
        BUNDLE_SHA,
        [cand.entry_digest_dict(e) for e in catalog],
        CATALOG_SHA_MANUAL,
        2,
        "demo-reviewer",
        copy.deepcopy(MANUAL_D2_O3),
        copy.deepcopy(ROWS_7),
    )
    assert canonical.domain_digest(canonical.DOMAIN_POLICY, payload) == POLICY_SHA_B02


def test_meta_catalog_digest():
    bundle = _bundle()
    source = cand.build_source_candidates(bundle)
    accepted, rejected = meta.validate_proposals(
        bundle,
        [{"record_type": "delivery", "record_id": "D2", "target_type": "order",
          "target_id": "O3", "evidence": META_EVIDENCE}],
        "example-srv-call-001",
        5,
    )
    assert rejected == []
    merged, suggestions, changed = meta.merge_proposals(source, accepted)
    assert changed and suggestions[0]["catalog_effect"] == "ADDED_TARGET"
    assert len(canonical.cjson_bytes([cand.entry_digest_dict(e) for e in merged])) == 711
    assert cand.catalog_sha256(merged) == META_CATALOG_SHA


def test_meta_policy_baseline_review_digests():
    bundle = _bundle()
    source = cand.build_source_candidates(bundle)
    meta_entry = cand.Candidate(
        "delivery:D2", "O3", cand.ORIGIN_META, evidence=META_EVIDENCE,
        provider="META", model="muse-spark-1.3", server_call_id="example-srv-call-001",
    )
    catalog = cand.sort_catalog(source + [meta_entry])
    catalog_dicts = [cand.entry_digest_dict(e) for e in catalog]
    payload = review_mod.policy_payload(
        BUNDLE_SHA, catalog_dicts, META_CATALOG_SHA, 2, "demo-reviewer", [], copy.deepcopy(ROWS_7)
    )
    assert len(canonical.cjson_bytes(payload)) == 2072
    assert canonical.domain_digest(canonical.DOMAIN_POLICY, payload) == META_POLICY_SHA
    base = {"policy_sha256": META_POLICY_SHA, "reference_mapping": dict(BASELINE_MAP)}
    assert len(canonical.cjson_bytes(base)) == 234
    assert canonical.domain_digest(canonical.DOMAIN_BASELINE, base) == META_BASELINE_SHA
    rev = {"policy_sha256": META_POLICY_SHA, "baseline_sha256": META_BASELINE_SHA}
    assert len(canonical.cjson_bytes(rev)) == 169
    assert canonical.domain_digest(canonical.DOMAIN_REVIEW, rev) == META_REVIEW_SHA


def test_stable_policy_baseline_review_digests():
    _, catalog = _manual_catalog()
    catalog_dicts = [cand.entry_digest_dict(e) for e in catalog]
    payload = review_mod.policy_payload(
        BUNDLE_SHA, catalog_dicts, CATALOG_SHA_MANUAL, 1, "demo-reviewer",
        copy.deepcopy(MANUAL_D2_O3), copy.deepcopy(ROWS_7),
    )
    assert len(canonical.cjson_bytes(payload)) == 2111
    assert canonical.domain_digest(canonical.DOMAIN_POLICY, payload) == STABLE_POLICY_SHA
    base = {"policy_sha256": STABLE_POLICY_SHA, "reference_mapping": dict(BASELINE_MAP)}
    assert canonical.domain_digest(canonical.DOMAIN_BASELINE, base) == STABLE_BASELINE_SHA
    rev = {"policy_sha256": STABLE_POLICY_SHA, "baseline_sha256": STABLE_BASELINE_SHA}
    assert canonical.domain_digest(canonical.DOMAIN_REVIEW, rev) == STABLE_REVIEW_SHA


def test_reversal_receipt_core_vector():
    _, catalog = _manual_catalog()
    catalog_dicts = [cand.entry_digest_dict(e) for e in catalog]
    policy = review_mod.policy_payload(
        BUNDLE_SHA, catalog_dicts, CATALOG_SHA_MANUAL, 2, "demo-reviewer",
        copy.deepcopy(MANUAL_D2_O3), copy.deepcopy(ROWS_7),
    )
    core = {
        "format": "jw.commerce.receipt.v1",
        "contract_version": "commerce.v1",
        "source_bundle_sha256": BUNDLE_SHA,
        "file_sha256": {
            "orders.csv": "8063a0ead1bdbf5764900e34009e9331847d7e74e57b541a6e554bdcfbf0ee95",
            "payments.csv": "9dbac299fb73598818afeef13d3827cb40da73de1fb38966399cc3a94100f441",
            "deliveries.csv": "e02c99782c8f02ae8b50572cc3fcadfec12d7c00d6f9b272711388fd4ec2c084",
            "refunds.csv": "aae37407144077385b8ad87b33d8d8faeb4b9d32f67988c4960c17b79469de56",
        },
        "candidate_catalog_sha256": CATALOG_SHA_MANUAL,
        "policy": policy,
        "reference_mapping": dict(BASELINE_MAP),
        "policy_sha256": POLICY_SHA_B02,
        "baseline_sha256": BASELINE_SHA_B02,
        "review_sha256": REVIEW_SHA_B02,
        "run_id": "abcdef0123456789abcdef0123456789",
        "engine_identity": "EXAMPLE-NOT-EXECUTED",
        "result": {
            "status": "REVERSED_EXHAUSTIVE",
            "predicate": "clean_fulfilled_count >= K",
            "threshold_k": 2,
            "baseline": {"clean_fulfilled_count": 2, "decision": True},
            "witness": {
                "reference_changes": [
                    {"record_key": "delivery:D2", "from_target_id": "O2", "to_target_id": "O3"}
                ],
                "clean_fulfilled_count": 1,
                "decision": False,
                "link_distance": 1,
            },
            "coverage": {
                "raw_worlds_total": 2, "raw_worlds_checked": 2,
                "invalid_worlds_total": 0, "invalid_worlds_checked": 0,
                "admissible_worlds_total": 2, "admissible_worlds_checked": 2,
                "checker_worlds_total": 2, "checker_worlds_checked": 2,
                "fully_enumerated": True, "checker_complete": True,
            },
            "checker_status": "PASSED",
            "proof_basis": "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION",
            "minimum_distance_proven_within_scope": True,
            "reason": None,
            "minimum_link_distance_within_scope": 1,
        },
        "timings_ms": {"parse": None, "search": None, "checker": None, "wall": None},
        "scope": {
            "max_orders": 50, "max_each_other_file": 60, "max_variable_records": 10,
            "max_alternatives_per_variable": 2, "max_raw_worlds": 4096,
        },
        "source_revision": 1,
        "candidate_revision": 2,
        "policy_revision": 1,
    }
    assert len(canonical.cjson_bytes(core)) == 4246
    assert canonical.domain_digest(canonical.DOMAIN_RECEIPT, core) == RECEIPT_SHA_FROZEN


def test_lf_crlf_byte_significant():
    lf = fixture_bytes("commerce_demo", "orders.csv")
    crlf = lf.replace(b"\n", b"\r\n")
    assert lf != crlf
    import hashlib
    assert hashlib.sha256(lf).hexdigest() != hashlib.sha256(crlf).hexdigest()
