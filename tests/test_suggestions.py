import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from joinwitness.ingest import load_pair
from joinwitness.contracts import InputBundle
from joinwitness.suggestions import (
    SuggestionBatch, SuggestionCode, SuggestionError, validate_model_suggestions,
)
from joinwitness.meta_suggestions import (
    META_BASE_URL, MODEL, RESPONSE_FORMAT, MetaCallBlocked, MetaResponseRejected,
    make_messages, request_live_meta, _parse_meta_response,
)

F = Path(__file__).resolve().parents[1] / 'fixtures/flagship_flip'
J = Path(__file__).resolve().parents[1] / 'fixtures/ai_mock/flagship_suggestions.json'


@pytest.fixture
def bundle():
    return load_pair(F / 'registrations.csv', F / 'attendance.csv')


@pytest.fixture
def payload():
    return json.loads(J.read_text(encoding='utf8'))


def refusal(code, bundle, obj):
    with pytest.raises(SuggestionError) as e:
        validate_model_suggestions(bundle, json.dumps(obj))
    assert e.value.code is code


def test_offline_fixture_produces_unreviewed_batch(bundle):
    result = validate_model_suggestions(bundle, J.read_text())
    assert result.status == 'UNREVIEWED_SUGGESTIONS'
    assert result.origin == 'OFFLINE_FIXTURE'
    assert result.human_permissions_created is False
    assert result.analytical_verification == 'NOT_RUN'
    assert len(result.suggestions) == 4
    assert result.registrations_raw_sha256 == bundle.registrations_digest.raw_sha256
    assert result.attendance_parsed_sha256 == bundle.attendance_digest.parsed_sha256


def test_names_are_not_identity_authority(bundle):
    batch = validate_model_suggestions(bundle, J.read_text())
    assert any(item.registration_id == 'R-B2' for item in batch.suggestions)
    assert all(item.attendance_id.startswith('T-') for item in batch.suggestions)
    assert not hasattr(batch, 'review_snapshot')
    assert not hasattr(batch, 'confirmed')


def test_unknown_attendance_rejected(bundle, payload):
    payload['suggestions'][0]['attendance_id'] = 'T-FAKE'
    refusal(SuggestionCode.UNKNOWN_ID, bundle, payload)


def test_unknown_registration_rejected(bundle, payload):
    payload['suggestions'][0]['registration_id'] = 'R-FAKE'
    refusal(SuggestionCode.UNKNOWN_ID, bundle, payload)


def test_duplicate_suggestion_rejected(bundle, payload):
    payload['suggestions'].append(payload['suggestions'][0])
    refusal(SuggestionCode.DUPLICATE_PAIR, bundle, payload)


def test_extra_root_field_rejected(bundle, payload):
    payload['auto_approve'] = True
    refusal(SuggestionCode.INVALID_MODEL_SCHEMA, bundle, payload)


def test_extra_suggestion_field_rejected(bundle, payload):
    payload['suggestions'][0]['confidence'] = 0.99
    refusal(SuggestionCode.INVALID_MODEL_SCHEMA, bundle, payload)


def test_blank_reason_rejected(bundle, payload):
    payload['suggestions'][0]['reason'] = '  '
    refusal(SuggestionCode.INVALID_MODEL_SCHEMA, bundle, payload)


def test_control_character_reason_rejected(bundle, payload):
    payload['suggestions'][0]['reason'] = 'name\nunsafe'
    refusal(SuggestionCode.INVALID_MODEL_SCHEMA, bundle, payload)


def test_oversized_reason_rejected(bundle, payload):
    payload['suggestions'][0]['reason'] = 'x' * 241
    refusal(SuggestionCode.INVALID_MODEL_SCHEMA, bundle, payload)


def test_empty_suggestions_not_evidence(bundle):
    refusal(SuggestionCode.NO_SUGGESTIONS, bundle, {'suggestions': []})


def test_too_many_suggestions(bundle):
    choices = [dict(attendance_id='T-02', registration_id=f'R-B{i}', reason='candidate') for i in range(13)]
    refusal(SuggestionCode.TOO_MANY, bundle, {'suggestions': choices})


def test_non_json_rejected(bundle):
    with pytest.raises(SuggestionError) as e:
        validate_model_suggestions(bundle, '```json\n{}\n```')
    assert e.value.code is SuggestionCode.INVALID_MODEL_JSON


def test_oversized_json_rejected(bundle):
    with pytest.raises(SuggestionError) as e:
        validate_model_suggestions(bundle, ' ' * 17_000)
    assert e.value.code is SuggestionCode.INVALID_MODEL_JSON


def test_tampered_source_digest_rejected(bundle):
    altered = InputBundle(
        registrations=bundle.registrations,
        attendance=bundle.attendance,
        registrations_digest=bundle.registrations_digest.model_copy(update={'parsed_sha256': '0'*64}),
        attendance_digest=bundle.attendance_digest,
    )
    with pytest.raises(SuggestionError) as e:
        validate_model_suggestions(altered, J.read_text())
    assert e.value.code is SuggestionCode.INVALID_SOURCE


def test_tampered_source_rows_rejected(bundle):
    altered = InputBundle(
        registrations=(bundle.registrations[0],bundle.registrations[0]) + bundle.registrations[2:],
        attendance=bundle.attendance,
        registrations_digest=bundle.registrations_digest,
        attendance_digest=bundle.attendance_digest,
    )
    with pytest.raises(SuggestionError) as e:
        validate_model_suggestions(altered, J.read_text())
    assert e.value.code is SuggestionCode.INVALID_SOURCE


def test_batch_is_frozen(bundle):
    batch = validate_model_suggestions(bundle, J.read_text())
    with pytest.raises(ValidationError):
        batch.status = 'CONFIRMED'
    with pytest.raises(ValidationError):
        batch.suggestions[0].registration_id = 'R-OTHER'


def test_live_gate_closed_before_api_access(bundle, monkeypatch):
    monkeypatch.delenv('JW_META_LIVE_ENABLED', raising=False)
    with pytest.raises(MetaCallBlocked, match='SPEND_OR_DATA_GATE_CLOSED'):
        request_live_meta(bundle)
    with pytest.raises(MetaCallBlocked):
        request_live_meta(bundle, owner_approved=True, synthetic_data_confirmed=True)


def test_synthetic_consent_also_required(bundle, monkeypatch):
    monkeypatch.setenv('JW_META_LIVE_ENABLED', 'YES_EXPLICITLY_APPROVED')
    with pytest.raises(MetaCallBlocked):
        request_live_meta(bundle, owner_approved=True, synthetic_data_confirmed=False)
    with pytest.raises(MetaCallBlocked):
        request_live_meta(bundle, owner_approved=False, synthetic_data_confirmed=True)


def test_message_context_uses_exact_ids_not_fake_ids(bundle):
    msgs = make_messages(bundle)
    assert msgs[0]['role'] == 'developer'
    assert msgs[1]['role'] == 'user'
    assert 'T-02' in msgs[1]['content']
    assert 'R-B2' in msgs[1]['content']
    assert 'approve' not in msgs[1]['content'].lower()


def test_structured_schema_requires_all_fields():
    assert META_BASE_URL == 'https://api.meta.ai/v1'
    assert MODEL == 'muse-spark-1.3'
    assert RESPONSE_FORMAT['json_schema']['strict'] is True
    root = RESPONSE_FORMAT['json_schema']['schema']
    assert root['additionalProperties'] is False
    inner = root['properties']['suggestions']['items']
    assert inner['additionalProperties'] is False
    assert set(inner['required']) == {'attendance_id','registration_id','reason'}


class FakeClient:
    def __init__(self, content: str, finish_reason='stop'):
        self.calls = []
        def create(**kwargs):
            self.calls.append(kwargs)
            return SimpleNamespace(choices=[SimpleNamespace(
                finish_reason=finish_reason, message=SimpleNamespace(content=content)
            )])
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))


def test_mocked_meta_transport_path_has_no_network(bundle, monkeypatch):
    monkeypatch.setenv('JW_META_LIVE_ENABLED', 'YES_EXPLICITLY_APPROVED')
    client = FakeClient(J.read_text())
    result = request_live_meta(bundle, owner_approved=True, synthetic_data_confirmed=True, client=client)
    assert result.origin == 'META_API_RESPONSE'
    assert result.human_permissions_created is False
    assert client.calls[0]['model'] == 'muse-spark-1.3'
    assert client.calls[0]['store'] is False
    assert len(client.calls) == 1


@pytest.mark.parametrize('finish', ['length', 'content_filter', 'tool_calls', 'unknown'])
def test_truncated_or_nonfinal_meta_response_rejected(bundle,finish):
    client = FakeClient(J.read_text(), finish_reason=finish)
    with pytest.raises(MetaResponseRejected, match='UNFINISHED_RESPONSE'):
        _parse_meta_response(bundle, client.chat.completions.create())


def test_empty_response_rejected(bundle):
    with pytest.raises(MetaResponseRejected, match='INVALID_PROVIDER_RESPONSE'):
        _parse_meta_response(bundle, SimpleNamespace(choices=[]))


def test_api_request_exception_does_not_retry(bundle, monkeypatch):
    monkeypatch.setenv('JW_META_LIVE_ENABLED', 'YES_EXPLICITLY_APPROVED')
    calls = []
    def create(**kwargs):
        calls.append(kwargs)
        raise RuntimeError('synthetic upstream failure')
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    with pytest.raises(MetaResponseRejected, match='MODEL_REQUEST_FAILED'):
        request_live_meta(bundle, owner_approved=True, synthetic_data_confirmed=True, client=client)
    assert len(calls) == 1


def test_cli_is_offline_and_classified_as_fixture():
    p = subprocess.run([sys.executable,'-m','joinwitness.suggestions',
        '--registrations',str(F/'registrations.csv'),
        '--attendance',str(F/'attendance.csv'),
        '--mock-response',str(J)],capture_output=True,text=True,check=True)
    obj=json.loads(p.stdout)
    assert obj['status']=='UNREVIEWED_SUGGESTIONS'
    assert obj['origin']=='OFFLINE_FIXTURE'
    assert obj['human_permissions_created'] is False
    assert obj['analytical_verification']=='NOT_RUN'
