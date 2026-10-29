"""JW-T07C synthetic-only tests: NO network access or provider credit usage."""
import json
import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from joinwitness.ingest import load_pair
from joinwitness.meta_live import _limited_metadata, _preview, run_one_meta_call, _CaptureCompletions
from joinwitness.meta_suggestions import MetaCallBlocked, MetaResponseRejected
from joinwitness.suggestions import SuggestionError

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "fixtures" / "flagship_flip"


@pytest.fixture
def bundle():
    return load_pair(FIXTURE / "registrations.csv", FIXTURE / "attendance.csv")


class FakeProvider:
    def __init__(self, payload=None, *, status="stop", model="muse-spark-1.3",
                 usage=True, fail=False):
        self.calls = []
        self.payload = payload or {"suggestions": [
            {"attendance_id": "T-02", "registration_id": "R-A2", "reason": "ambiguous name"},
            {"attendance_id": "T-02", "registration_id": "R-B2", "reason": "alternative spelling"},
        ]}
        self.status = status
        self.model = model
        self.usage = usage
        self.fail = fail
        self.chat = SimpleNamespace(completions=self)

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.fail:
            raise RuntimeError("SECRET never echo this upstream error")
        usage = (SimpleNamespace(prompt_tokens=91, completion_tokens=29, total_tokens=120)
                 if self.usage else None)
        return SimpleNamespace(
            id="chatcmpl-synthetic-only", _request_id="req-synthetic-only",
            model=self.model, usage=usage,
            choices=[SimpleNamespace(finish_reason=self.status,
                                     message=SimpleNamespace(content=json.dumps(self.payload)))],
        )


@pytest.fixture
def live_gate(monkeypatch):
    monkeypatch.setenv("JW_META_LIVE_ENABLED", "YES_EXPLICITLY_APPROVED")
    monkeypatch.delenv("MODEL_API_KEY", raising=False)


def test_preview_carries_provenance_but_no_network(bundle):
    record = _preview(bundle)
    assert record["status"] == "DRY_RUN_NO_NETWORK"
    assert record["network_requests"] == 0
    assert record["shortlist_candidate_count"] == 4
    assert record["requested_mode"] == "STANDARD"
    assert record["human_permissions_created"] is False


@pytest.mark.parametrize("approval,synthetic,env_open", [
    (False, True, True), (True, False, True), (True, True, False),
])
def test_gating_precedes_provider_call(bundle, monkeypatch, approval, synthetic, env_open):
    if env_open:
        monkeypatch.setenv("JW_META_LIVE_ENABLED", "YES_EXPLICITLY_APPROVED")
    else:
        monkeypatch.delenv("JW_META_LIVE_ENABLED", raising=False)
    fake = FakeProvider()
    with pytest.raises(MetaCallBlocked, match="SPEND_OR_DATA_GATE_CLOSED"):
        run_one_meta_call(bundle, owner_approved=approval,
                          synthetic_data_confirmed=synthetic, client=fake)
    assert fake.calls == []


def test_success_fake_is_never_labeled_authentic(bundle, live_gate):
    fake = FakeProvider()
    result = run_one_meta_call(bundle, owner_approved=True,
                               synthetic_data_confirmed=True, client=fake)
    assert result["status"] == "SIMULATED_TRANSPORT_VALIDATED"
    assert result["provider_evidence_type"] == "INJECTED_TEST_CLIENT"
    assert result["origin"] == "META_API_RESPONSE"  # caller labels transport, not authenticity
    assert result["requested_mode"] == "STANDARD"
    assert result["response_id"] == "chatcmpl-synthetic-only"
    assert result["request_id"] == "req-synthetic-only"
    assert result["usage"] == {
        "status": "USAGE_REPORTED", "prompt_tokens": 91,
        "completion_tokens": 29, "total_tokens": 120,
    }
    assert result["request_count"] == len(fake.calls) == 1
    assert result["shortlist_candidate_count"] == 4
    assert result["shortlist_truncated"] is False
    assert result["human_permissions_created"] is False
    assert result["analytical_verification"] == "NOT_RUN"
    assert "SECRET" not in json.dumps(result)
    kwargs = fake.calls[0]
    assert kwargs["store"] is False
    assert kwargs["max_completion_tokens"] <= 1200
    assert kwargs["model"] == "muse-spark-1.3"


def test_request_failure_no_retries_and_no_leak(bundle, live_gate):
    fake = FakeProvider(fail=True)
    with pytest.raises(MetaResponseRejected, match="MODEL_REQUEST_FAILED") as exc:
        run_one_meta_call(bundle, owner_approved=True, synthetic_data_confirmed=True, client=fake)
    assert "SECRET" not in str(exc.value)
    assert len(fake.calls) == 1


def test_shortlist_pair_omission_rejected(bundle, live_gate):
    fake = FakeProvider(payload={"suggestions": [
        {"attendance_id": "T-01", "registration_id": "R-B2", "reason": "not supplied"}
    ]})
    with pytest.raises(MetaResponseRejected, match="PAIR_OUTSIDE_SUPPLIED_SHORTLIST"):
        run_one_meta_call(bundle, owner_approved=True, synthetic_data_confirmed=True, client=fake)
    assert len(fake.calls) == 1


def test_fabricated_id_rejected(bundle, live_gate):
    fake = FakeProvider(payload={"suggestions": [
        {"attendance_id": "T-02", "registration_id": "R-FORGED", "reason": "invented"}
    ]})
    with pytest.raises(SuggestionError, match="UNKNOWN_ID"):
        run_one_meta_call(bundle, owner_approved=True, synthetic_data_confirmed=True, client=fake)


def test_truncated_provider_output_rejected(bundle, live_gate):
    fake = FakeProvider(status="length")
    with pytest.raises(MetaResponseRejected, match="UNFINISHED_RESPONSE"):
        run_one_meta_call(bundle, owner_approved=True, synthetic_data_confirmed=True, client=fake)


def test_response_model_mismatch_refused(bundle, live_gate):
    fake = FakeProvider(model="muse-spark-1.3-contributor")
    with pytest.raises(MetaResponseRejected, match="UNEXPECTED_RESPONSE_MODEL"):
        run_one_meta_call(bundle, owner_approved=True, synthetic_data_confirmed=True, client=fake)


def test_missing_usage_recorded_as_unavailable(bundle, live_gate):
    fake = FakeProvider(usage=False)
    result = run_one_meta_call(bundle, owner_approved=True,
                               synthetic_data_confirmed=True, client=fake)
    assert result["usage"]["status"] == "USAGE_UNAVAILABLE"
    assert result["usage"]["total_tokens"] is None


def test_nonadditive_usage_not_fabricated():
    response = SimpleNamespace(usage=SimpleNamespace(
        prompt_tokens=12, completion_tokens=8, total_tokens=30))
    metadata = _limited_metadata(response)
    assert metadata["total_tokens"] == 30


def test_bad_metadata_not_exposed():
    response = SimpleNamespace(id="\nsecret", _request_id="not printable\n", model="muse-spark-1.3",
                               usage=SimpleNamespace(prompt_tokens=True,
                                                     completion_tokens=-1, total_tokens="999"))
    md = _limited_metadata(response)
    assert md["provider_response_id"] is None
    assert md["provider_request_id"] is None
    assert md["total_tokens"] is None
    assert md["prompt_tokens"] is None


def test_capture_blocks_accidental_second_call():
    capture = _CaptureCompletions(FakeProvider())
    capture.create(model="muse-spark-1.3")
    with pytest.raises(MetaCallBlocked, match="MULTIPLE_CALLS_BLOCKED"):
        capture.create(model="muse-spark-1.3")
    assert capture.count == 1


def test_without_key_default_transport_is_blocked(bundle, live_gate):
    with pytest.raises(MetaCallBlocked, match="MODEL_API_KEY_MISSING"):
        run_one_meta_call(bundle, owner_approved=True, synthetic_data_confirmed=True)


def test_cli_default_is_offline_even_when_env_enabled(live_gate):
    proc = subprocess.run([
        sys.executable, "-m", "joinwitness.meta_live",
        "--registrations", str(FIXTURE / "registrations.csv"),
        "--attendance", str(FIXTURE / "attendance.csv"),
    ], capture_output=True, text=True, check=True)
    payload = json.loads(proc.stdout)
    assert payload["status"] == "DRY_RUN_NO_NETWORK"
    assert payload["network_requests"] == 0
    assert "suggestions" not in payload


def test_cli_explicit_but_keyless_rejected(live_gate):
    proc = subprocess.run([
        sys.executable, "-m", "joinwitness.meta_live",
        "--registrations", str(FIXTURE / "registrations.csv"),
        "--attendance", str(FIXTURE / "attendance.csv"),
        "--live-once", "--i-approve-credit-use", "--synthetic-data-only",
    ], capture_output=True, text=True)
    assert proc.returncode == 2
    assert json.loads(proc.stdout)["reason"] == "MODEL_API_KEY_MISSING"
    assert "secret" not in proc.stdout.lower()


def test_non_live_flag_does_not_persist_approval(bundle, live_gate):
    fake = FakeProvider()
    run_one_meta_call(bundle, owner_approved=True, synthetic_data_confirmed=True, client=fake)
    assert os.environ.get("MODEL_API_KEY") is None
    assert len(fake.calls) == 1


def test_missing_shortlist_never_calls_provider(bundle, live_gate, monkeypatch):
    # Force an absent shortlist by replacing a local-bound helper, not source authority.
    import joinwitness.meta_live as module
    original = module.build_shortlist
    short = original(bundle, per_row_limit=MODEL_PER_ROW_FOR_TEST(), total_limit=24)
    empty = short.model_copy(update={"candidates": ()})
    monkeypatch.setattr(module, "build_shortlist", lambda *a, **k: empty)
    fake = FakeProvider()
    with pytest.raises(MetaCallBlocked, match="NO_DETERMINISTIC_CANDIDATES"):
        run_one_meta_call(bundle, owner_approved=True, synthetic_data_confirmed=True, client=fake)
    assert fake.calls == []


def MODEL_PER_ROW_FOR_TEST():
    return 4
