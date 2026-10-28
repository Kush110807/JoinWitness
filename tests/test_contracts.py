import pytest
from pydantic import ValidationError

from joinwitness.contracts import Attendance, Registration, SourceDigest


def test_frozen_records():
    r = Registration(registration_id="R1", display_name="Kim/Kym", group="A")
    with pytest.raises(ValidationError):
        r.group = "B"


@pytest.mark.parametrize("bad", ["", " R1", "R1 ", "R\n1", "R\t1", "R1\x00", "X" * 129])
def test_invalid_ids_rejected(bad):
    with pytest.raises(ValidationError):
        Registration(registration_id=bad, display_name="x", group="A")


@pytest.mark.parametrize("bad", ["", " ", "\n", "a\tb", "\x00x", "x" * 201])
def test_invalid_names_rejected(bad):
    with pytest.raises(ValidationError):
        Attendance(attendance_id="T-1", recorded_name=bad)


def test_unicode_names_are_preserved_exactly():
    item = Registration(registration_id="R1", display_name="Zoë Ní", group="B")
    assert item.display_name == "Zoë Ní"


def test_extra_fields_fail_closed():
    with pytest.raises(ValidationError):
        Registration(registration_id="R1", display_name="Test", group="A", confidence=0.99)


def test_non_string_id_rejected():
    with pytest.raises(ValidationError):
        Attendance(attendance_id=3, recorded_name="name")


def test_invalid_digest_rejected():
    with pytest.raises(ValidationError):
        SourceDigest(source_kind="attendance", raw_sha256="a", parsed_sha256="f"*64, row_count=1)
