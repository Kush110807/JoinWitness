"""Optional Meta path: deterministic AI_UNAVAILABLE plus provenance merge rules."""
import pytest

from joinwitness.commerce import candidates as cand
from joinwitness.commerce import meta_suggestions as meta
from joinwitness.commerce.errors import CommerceError
from joinwitness.commerce.service import op_parse, op_review, op_suggest
from joinwitness.commerce.session_state import Store
from joinwitness.commerce.source_import import import_sources

from tests.test_commerce_helpers import files_payload, review_request


def suggest_request(session_id, candidate_revision=1, policy_revision=0,
                    mode="META", max_suggestions=5):
    return {
        "contract_version": "commerce.v1",
        "session_id": session_id,
        "expected_source_revision": 1,
        "expected_candidate_revision": candidate_revision,
        "mode": mode,
        "max_suggestions": max_suggestions,
        "expected_policy_revision": policy_revision,
    }


def test_suggest_unavailable_without_mutation():
    store = Store()
    session_id = op_parse(files_payload(), store)["session_id"]
    body = op_suggest(suggest_request(session_id), store)
    assert body["ai_status"] == "AI_UNAVAILABLE"
    assert body["suggestions"] == []
    assert body["model_call"] is None
    assert body["catalog_changed"] is False
    assert body["authorisations_changed"] is False
    assert body["rejected_proposals"] == []
    assert (body["source_revision"], body["candidate_revision"], body["policy_revision"]) == (1, 1, 0)
    assert body["state"] == "IMPORTED"
    session = store.get(session_id)
    assert (session.candidate_revision, session.policy_revision) == (1, 0)
    assert session.meta_entries == [] and session.state == "IMPORTED"


def test_suggest_after_review_preserves_frozen_state():
    store = Store()
    session_id = op_parse(files_payload(), store)["session_id"]
    op_review(review_request(session_id), store)
    body = op_suggest(suggest_request(session_id, candidate_revision=2, policy_revision=1), store)
    assert body["ai_status"] == "AI_UNAVAILABLE"
    assert body["state"] == "REVIEW_FROZEN"
    assert store.get(session_id).policy is not None


def test_suggest_stale_revision_rejected():
    store = Store()
    session_id = op_parse(files_payload(), store)["session_id"]
    with pytest.raises(CommerceError) as caught:
        op_suggest(suggest_request(session_id, candidate_revision=0), store)
    assert caught.value.code == "STALE_STATE"
    assert caught.value.http_status == 409


def test_suggest_bad_mode_rejected():
    store = Store()
    session_id = op_parse(files_payload(), store)["session_id"]
    with pytest.raises(CommerceError) as caught:
        op_suggest(suggest_request(session_id, mode="AUTO"), store)
    assert caught.value.code == "INVALID_VALUE"


def test_suggest_bad_max_rejected():
    store = Store()
    session_id = op_parse(files_payload(), store)["session_id"]
    with pytest.raises(CommerceError) as caught:
        op_suggest(suggest_request(session_id, max_suggestions=61), store)
    assert caught.value.code == "INVALID_VALUE"
    assert caught.value.path == "max_suggestions"


def _bundle():
    return import_sources(files_payload()["files"])


def test_merge_added_target():
    bundle = _bundle()
    source = cand.build_source_candidates(bundle)
    accepted, rejected = meta.validate_proposals(
        bundle,
        [{"record_type": "delivery", "record_id": "D2", "target_type": "order",
          "target_id": "O3", "evidence": "Plausible alternative home."}],
        "srv-1", 5)
    assert rejected == []
    merged, suggestions, changed = meta.merge_proposals(source, accepted)
    assert changed is True
    assert suggestions[0]["catalog_effect"] == "ADDED_TARGET"
    assert suggestions[0]["authorised"] is False
    assert len(merged) == len(source) + 1


def test_merge_added_provenance_single_selectable_edge():
    bundle = _bundle()
    source = cand.build_source_candidates(bundle)
    accepted, _ = meta.validate_proposals(
        bundle,
        [{"record_type": "delivery", "record_id": "D2", "target_type": "order",
          "target_id": "O2", "evidence": "Model agrees with the source ref."}],
        "srv-3", 5)
    merged, suggestions, changed = meta.merge_proposals(source, accepted)
    assert changed is True
    assert suggestions[0]["catalog_effect"] == "ADDED_PROVENANCE"
    assert cand.distinct_targets(merged)["delivery:D2"] == ["O2"]


def test_merge_existing_provenance_no_op():
    bundle = _bundle()
    source = cand.build_source_candidates(bundle)
    first, _ = meta.validate_proposals(
        bundle,
        [{"record_type": "delivery", "record_id": "D2", "target_type": "order",
          "target_id": "O3", "evidence": "First call evidence."}],
        "srv-1", 5)
    merged, _, _ = meta.merge_proposals(source, first)
    before = [cand.entry_digest_dict(entry) for entry in merged]
    second, _ = meta.validate_proposals(
        bundle,
        [{"record_type": "delivery", "record_id": "D2", "target_type": "order",
          "target_id": "O3", "evidence": "Second call evidence."}],
        "srv-2", 5)
    merged_again, suggestions, changed = meta.merge_proposals(merged, second)
    assert changed is False
    assert suggestions[0]["catalog_effect"] == "EXISTING_PROVENANCE_NO_OP"
    after = [cand.entry_digest_dict(entry) for entry in merged_again]
    assert after == before
    assert merged_again[5].server_call_id == "srv-1"


def test_invalid_proposals_quarantined_with_counts():
    bundle = _bundle()
    accepted, rejected = meta.validate_proposals(
        bundle,
        [{"record_type": "delivery", "record_id": "D2", "target_type": "order",
          "target_id": "O9", "evidence": "Unknown target."},
         {"record_type": "payment", "record_id": "P9", "target_type": "order",
          "target_id": "O1", "evidence": "Unknown record."},
         {"record_type": "delivery", "record_id": "D2", "target_type": "payment",
          "target_id": "P1", "evidence": "Wrong target type."}],
        "srv-4", 5)
    assert accepted == []
    assert {entry["reason_code"]: entry["count"] for entry in rejected} == {
        "INVALID_TARGET": 2, "INVALID_RECORD": 1}


def test_max_suggestions_bounds_proposals():
    bundle = _bundle()
    proposals = [{"record_type": "delivery", "record_id": "D2", "target_type": "order",
                  "target_id": "O3", "evidence": f"Evidence {i}."} for i in range(4)]
    accepted, _ = meta.validate_proposals(bundle, proposals, "srv-5", 2)
    assert len(accepted) == 2
