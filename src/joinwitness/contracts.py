"""Immutable, fail-closed T02 schema. No policy or inferred matches exist here."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictStr, field_validator

SCHEMA_VERSION = "jw.dataset.v1"
MAX_RECORD_ID = 128
MAX_DISPLAY_NAME = 200


def _validate_identifier(value: str) -> str:
    # Do not silently trim IDs: assignments and future receipts must use the original identity.
    if not value or value != value.strip() or any(ord(ch) < 32 or ord(ch) == 127 for ch in value):
        raise ValueError("ID must be nonempty, unpadded and contain no control characters")
    return value


def _validate_name(value: str) -> str:
    # Names may contain punctuation and Unicode. Preserve their exact contents.
    if not value.strip() or any(ord(ch) < 32 or ord(ch) == 127 for ch in value):
        raise ValueError("name must contain non-whitespace text and no control characters")
    return value


class FrozenSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)


class Registration(FrozenSchema):
    registration_id: StrictStr = Field(min_length=1, max_length=MAX_RECORD_ID)
    display_name: StrictStr = Field(min_length=1, max_length=MAX_DISPLAY_NAME)
    group: Literal["A", "B"]

    @field_validator("registration_id")
    @classmethod
    def valid_id(cls, value: str) -> str:
        return _validate_identifier(value)

    @field_validator("display_name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        return _validate_name(value)


class Attendance(FrozenSchema):
    attendance_id: StrictStr = Field(min_length=1, max_length=MAX_RECORD_ID)
    recorded_name: StrictStr = Field(min_length=1, max_length=MAX_DISPLAY_NAME)

    @field_validator("attendance_id")
    @classmethod
    def valid_id(cls, value: str) -> str:
        return _validate_identifier(value)

    @field_validator("recorded_name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        return _validate_name(value)


class SourceDigest(FrozenSchema):
    schema_version: Literal["jw.dataset.v1"] = SCHEMA_VERSION
    source_kind: Literal["registrations", "attendance"]
    raw_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")
    parsed_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")
    row_count: int = Field(ge=1)


class InputBundle(FrozenSchema):
    schema_version: Literal["jw.dataset.v1"] = SCHEMA_VERSION
    registrations: tuple[Registration, ...]
    attendance: tuple[Attendance, ...]
    registrations_digest: SourceDigest
    attendance_digest: SourceDigest
