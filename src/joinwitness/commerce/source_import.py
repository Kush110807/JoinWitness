"""Strict four-CSV source import (contract sections 1.1-1.2, 1.4).

Byte-exact Base64 transport, per-file and bundle SHA-256 over original decoded
bytes, strict UTF-8, RFC-4180 single-line records, exact headers, fixed field
grammars, integer-cent money and deterministic SOURCE_REF candidates. Nothing
is trimmed, guessed or silently normalised.
"""
from __future__ import annotations

import base64
import binascii
import csv
import re
from dataclasses import dataclass
from typing import Any

from . import canonical
from .errors import (
    FILE_ORDER,
    MAX_COMBINED_BYTES,
    MAX_FILE_BYTES,
    MAX_OTHER_ROWS,
    MAX_ORDERS,
    REQUIRED_FILES,
    CommerceError,
)

ORDERS_HEADERS = ("order_id", "customer_id", "order_total", "currency")
PAYMENTS_HEADERS = ("payment_id", "order_ref", "amount", "currency", "status")
DELIVERIES_HEADERS = ("delivery_id", "order_ref", "status")
REFUNDS_HEADERS = ("refund_id", "payment_ref", "amount", "status")

HEADERS = {
    "orders.csv": ORDERS_HEADERS,
    "payments.csv": PAYMENTS_HEADERS,
    "deliveries.csv": DELIVERIES_HEADERS,
    "refunds.csv": REFUNDS_HEADERS,
}

CURRENCIES = ("USD", "INR")
PAYMENT_STATUSES = ("SETTLED", "PENDING", "FAILED", "VOIDED")
DELIVERY_STATUSES = ("DELIVERED", "IN_TRANSIT", "CANCELLED")
REFUND_STATUSES = ("COMPLETED", "PENDING", "FAILED", "CANCELLED")

ID_RE = re.compile(r"^[A-Z][A-Z0-9_-]{0,31}$")
MONEY_RE = re.compile(r"^(0|[1-9][0-9]{0,8})\.[0-9]{2}$")
MAX_CENTS = 99999999999  # 999999999.99

_UTF8_BOM = b"\xef\xbb\xbf"


def _invalid_source(message: str, path: str) -> CommerceError:
    return CommerceError("INVALID_SOURCE", message, path, {}, 422)


def _invalid_schema(message: str, path: str) -> CommerceError:
    return CommerceError("INVALID_SCHEMA", message, path, {}, 422)


def _invalid_value(message: str, path: str) -> CommerceError:
    return CommerceError("INVALID_VALUE", message, path, {}, 422)


def decode_file_entry(entry: Any, name: str) -> bytes:
    """Strictly decode one files.<name> entry to its original bytes."""
    path = f"files.{name}"
    if not isinstance(entry, dict) or set(entry) != {"content_base64"}:
        raise _invalid_source("File entry must carry exactly content_base64.", path)
    encoded = entry["content_base64"]
    if not isinstance(encoded, str) or not encoded:
        raise _invalid_source("File content must be padded Base64 text.", path)
    try:
        if len(encoded) % 4:
            raise ValueError
        raw = base64.b64decode(encoded, validate=True)
        if base64.b64encode(raw).decode("ascii") != encoded:
            raise ValueError
    except (ValueError, binascii.Error):
        raise _invalid_source("File content must be padded Base64 text.", path)
    if len(raw) > MAX_FILE_BYTES:
        raise CommerceError(
            "LIMIT_EXCEEDED",
            "Source file exceeds the 64 KiB bound.",
            path,
            {"file": name, "max_file_bytes": MAX_FILE_BYTES},
            413,
        )
    return raw


def split_physical_lines(raw: bytes, name: str) -> list[str]:
    """Decode UTF-8 and split into physical lines, rejecting BOM/controls."""
    path = f"files.{name}"
    if raw.startswith(_UTF8_BOM):
        raise _invalid_source("Source file must be plain UTF-8 without BOM.", path)
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise _invalid_source("Source file must be valid UTF-8.", path)
    for char in text:
        ordinal = ord(char)
        if char in ("\n", "\r"):
            continue
        if ordinal < 0x20 or ordinal == 0x7F:
            raise _invalid_source("Source file contains control characters.", path)
    for index, char in enumerate(text):
        if char == "\r" and (index + 1 >= len(text) or text[index + 1] != "\n"):
            raise _invalid_source("Source file must use LF or CRLF line endings.", path)
    text = text.replace("\r\n", "\n")
    lines = text.split("\n")
    if text.endswith("\n"):
        lines = lines[:-1]
    return lines


def parse_csv_lines(lines: list[str], name: str) -> list[list[str]]:
    """Parse each physical line as one RFC-4180 record with exact columns."""
    path = f"files.{name}"
    expected = HEADERS[name]
    if not lines or (len(lines) == 1 and lines[0] == ""):
        raise _invalid_schema("Source file is missing its header row.", path)
    for line in lines:
        if line == "":
            raise _invalid_source("Source file contains a blank physical line.", path)
    try:
        header = next(csv.reader([lines[0]], strict=True))
    except csv.Error:
        raise _invalid_source("Source file contains malformed CSV.", path)
    if tuple(header) != expected:
        raise _invalid_schema("Source file has wrong, missing or extra headers.", path)
    rows: list[list[str]] = []
    for line in lines[1:]:
        try:
            record = next(csv.reader([line], strict=True))
        except csv.Error:
            raise _invalid_source("Source file contains malformed CSV.", path)
        if len(record) != len(expected):
            raise _invalid_schema("Source row has missing or extra columns.", path)
        rows.append(record)
    return rows


def money_to_cents(value: str) -> int | None:
    """Convert a grammar-valid money string to integer cents, else None."""
    if not MONEY_RE.match(value):
        return None
    dollars, cents = value.split(".")
    total = int(dollars) * 100 + int(cents)
    if total <= 0 or total > MAX_CENTS:
        return None
    return total


@dataclass(frozen=True)
class OrderRow:
    source_row_number: int
    order_id: str
    customer_id: str
    order_total: str
    currency: str
    total_cents: int


@dataclass(frozen=True)
class PaymentRow:
    source_row_number: int
    payment_id: str
    order_ref: str
    amount: str
    currency: str
    status: str
    amount_cents: int


@dataclass(frozen=True)
class DeliveryRow:
    source_row_number: int
    delivery_id: str
    order_ref: str
    status: str


@dataclass(frozen=True)
class RefundRow:
    source_row_number: int
    refund_id: str
    payment_ref: str
    amount: str
    status: str
    amount_cents: int


@dataclass(frozen=True)
class SourceBundle:
    files: dict[str, bytes]
    file_sha256: dict[str, str]
    bundle_sha256: str
    orders: tuple[OrderRow, ...]
    payments: tuple[PaymentRow, ...]
    deliveries: tuple[DeliveryRow, ...]
    refunds: tuple[RefundRow, ...]

    @property
    def order_ids(self) -> frozenset[str]:
        return frozenset(row.order_id for row in self.orders)

    @property
    def payment_ids(self) -> frozenset[str]:
        return frozenset(row.payment_id for row in self.payments)


def _check_id(value: str, field_name: str, name: str) -> None:
    if not ID_RE.match(value):
        raise _invalid_value(f"Field {field_name} has an invalid identifier.", f"files.{name}")


def _check_ref(value: str, field_name: str, name: str) -> None:
    if value != "" and not ID_RE.match(value):
        raise _invalid_value(f"Field {field_name} has an invalid reference.", f"files.{name}")


def _check_duplicates(records: list[list[str]], id_index: int, name: str) -> None:
    seen: dict[str, int] = {}
    for lineno, record in enumerate(records, start=2):
        ident = record[id_index]
        if ident in seen:
            raise CommerceError(
                "DUPLICATE_ID",
                "Source file contains a duplicate primary identifier.",
                f"files.{name}",
                {"record_id": ident},
                422,
            )
        seen[ident] = lineno
    signatures: dict[tuple[str, ...], str] = {}
    for lineno, record in enumerate(records, start=2):
        signature = tuple(cell for index, cell in enumerate(record) if index != id_index)
        ident = record[id_index]
        if signature in signatures:
            raise CommerceError(
                "DUPLICATE_EVENT",
                "Source file contains a semantic duplicate under distinct IDs.",
                f"files.{name}",
                {"record_id": ident},
                422,
            )
        signatures[signature] = ident


def _validate_orders(records: list[list[str]]) -> tuple[OrderRow, ...]:
    _check_duplicates(records, 0, "orders.csv")
    rows: list[OrderRow] = []
    for lineno, (order_id, customer_id, order_total, currency) in enumerate(records, start=2):
        _check_id(order_id, "order_id", "orders.csv")
        _check_id(customer_id, "customer_id", "orders.csv")
        cents = money_to_cents(order_total)
        if cents is None:
            raise _invalid_value("Field order_total has an invalid amount.", "files.orders.csv")
        if currency not in CURRENCIES:
            raise _invalid_value("Field currency has an invalid value.", "files.orders.csv")
        rows.append(OrderRow(lineno, order_id, customer_id, order_total, currency, cents))
    return tuple(rows)


def _validate_payments(records: list[list[str]], orders: frozenset[str]) -> tuple[PaymentRow, ...]:
    _check_duplicates(records, 0, "payments.csv")
    rows: list[PaymentRow] = []
    for lineno, (payment_id, order_ref, amount, currency, status) in enumerate(records, start=2):
        _check_id(payment_id, "payment_id", "payments.csv")
        _check_ref(order_ref, "order_ref", "payments.csv")
        cents = money_to_cents(amount)
        if cents is None:
            raise _invalid_value("Field amount has an invalid amount.", "files.payments.csv")
        if currency not in CURRENCIES:
            raise _invalid_value("Field currency has an invalid value.", "files.payments.csv")
        if status not in PAYMENT_STATUSES:
            raise _invalid_value("Field status has an invalid value.", "files.payments.csv")
        if order_ref and order_ref not in orders:
            raise CommerceError(
                "MISSING_REFERENCED_RECORD",
                "Source reference has no matching parent record.",
                "files.payments.csv",
                {},
                422,
            )
        rows.append(PaymentRow(lineno, payment_id, order_ref, amount, currency, status, cents))
    return tuple(rows)


def _validate_deliveries(records: list[list[str]], orders: frozenset[str]) -> tuple[DeliveryRow, ...]:
    _check_duplicates(records, 0, "deliveries.csv")
    rows: list[DeliveryRow] = []
    for lineno, (delivery_id, order_ref, status) in enumerate(records, start=2):
        _check_id(delivery_id, "delivery_id", "deliveries.csv")
        _check_ref(order_ref, "order_ref", "deliveries.csv")
        if status not in DELIVERY_STATUSES:
            raise _invalid_value("Field status has an invalid value.", "files.deliveries.csv")
        if order_ref and order_ref not in orders:
            raise CommerceError(
                "MISSING_REFERENCED_RECORD",
                "Source reference has no matching parent record.",
                "files.deliveries.csv",
                {},
                422,
            )
        rows.append(DeliveryRow(lineno, delivery_id, order_ref, status))
    return tuple(rows)


def _validate_refunds(records: list[list[str]], payments: frozenset[str]) -> tuple[RefundRow, ...]:
    _check_duplicates(records, 0, "refunds.csv")
    rows: list[RefundRow] = []
    for lineno, (refund_id, payment_ref, amount, status) in enumerate(records, start=2):
        _check_id(refund_id, "refund_id", "refunds.csv")
        _check_ref(payment_ref, "payment_ref", "refunds.csv")
        cents = money_to_cents(amount)
        if cents is None:
            raise _invalid_value("Field amount has an invalid amount.", "files.refunds.csv")
        if status not in REFUND_STATUSES:
            raise _invalid_value("Field status has an invalid value.", "files.refunds.csv")
        if payment_ref and payment_ref not in payments:
            raise CommerceError(
                "MISSING_REFERENCED_RECORD",
                "Source reference has no matching parent record.",
                "files.refunds.csv",
                {},
                422,
            )
        rows.append(RefundRow(lineno, refund_id, payment_ref, amount, status, cents))
    return tuple(rows)


def _check_row_caps(bundle_counts: dict[str, int]) -> None:
    if bundle_counts["orders.csv"] < 1:
        raise _invalid_value("At least one order is required.", "files.orders.csv")
    if bundle_counts["orders.csv"] > MAX_ORDERS:
        raise CommerceError(
            "LIMIT_EXCEEDED",
            "Source file exceeds its row bound.",
            "files.orders.csv",
            {"rows": bundle_counts["orders.csv"], "max_rows": MAX_ORDERS},
            422,
        )
    for name in ("payments.csv", "deliveries.csv", "refunds.csv"):
        if bundle_counts[name] > MAX_OTHER_ROWS:
            raise CommerceError(
                "LIMIT_EXCEEDED",
                "Source file exceeds its row bound.",
                f"files.{name}",
                {"rows": bundle_counts[name], "max_rows": MAX_OTHER_ROWS},
                422,
            )


def validated_source_rows(bundle: SourceBundle) -> dict[str, list[dict[str, Any]]]:
    """Read-only copy of validated source cell text in physical row order."""
    return {
        "orders": [
            {
                "source_row_number": row.source_row_number,
                "order_id": row.order_id,
                "customer_id": row.customer_id,
                "order_total": row.order_total,
                "currency": row.currency,
            }
            for row in bundle.orders
        ],
        "payments": [
            {
                "source_row_number": row.source_row_number,
                "payment_id": row.payment_id,
                "order_ref": row.order_ref,
                "amount": row.amount,
                "currency": row.currency,
                "status": row.status,
            }
            for row in bundle.payments
        ],
        "deliveries": [
            {
                "source_row_number": row.source_row_number,
                "delivery_id": row.delivery_id,
                "order_ref": row.order_ref,
                "status": row.status,
            }
            for row in bundle.deliveries
        ],
        "refunds": [
            {
                "source_row_number": row.source_row_number,
                "refund_id": row.refund_id,
                "payment_ref": row.payment_ref,
                "amount": row.amount,
                "status": row.status,
            }
            for row in bundle.refunds
        ],
    }


def import_sources(files: Any) -> SourceBundle:
    """Validate the four-file bundle and return the immutable source bundle."""
    if not isinstance(files, dict):
        raise CommerceError(
            "MISSING_FILE",
            "Exactly four named CSV files are required.",
            "files.orders.csv",
            {"required_files": REQUIRED_FILES},
            400,
        )
    for name in sorted(files):
        if name not in HEADERS:
            raise CommerceError(
                "UNEXPECTED_FILE",
                "Exactly four named CSV files are required.",
                f"files.{name}",
                {"required_files": REQUIRED_FILES},
                400,
            )
    for name in FILE_ORDER:
        if name not in files:
            raise CommerceError(
                "MISSING_FILE",
                "Exactly four named CSV files are required.",
                f"files.{name}",
                {"required_files": REQUIRED_FILES},
                400,
            )
    decoded = {name: decode_file_entry(files[name], name) for name in FILE_ORDER}
    if sum(len(raw) for raw in decoded.values()) > MAX_COMBINED_BYTES:
        raise CommerceError(
            "LIMIT_EXCEEDED",
            "Combined source files exceed the 256 KiB bound.",
            "files",
            {"max_combined_bytes": MAX_COMBINED_BYTES},
            413,
        )
    parsed = {
        name: parse_csv_lines(split_physical_lines(decoded[name], name), name)
        for name in FILE_ORDER
    }
    _check_row_caps({name: len(parsed[name]) for name in FILE_ORDER})
    orders = _validate_orders(parsed["orders.csv"])
    order_ids = frozenset(row.order_id for row in orders)
    payments = _validate_payments(parsed["payments.csv"], order_ids)
    payment_ids = frozenset(row.payment_id for row in payments)
    deliveries = _validate_deliveries(parsed["deliveries.csv"], order_ids)
    refunds = _validate_refunds(parsed["refunds.csv"], payment_ids)
    hashes = {name: canonical.file_sha256(decoded[name]) for name in FILE_ORDER}
    return SourceBundle(
        files=decoded,
        file_sha256=hashes,
        bundle_sha256=canonical.source_bundle_sha256(hashes),
        orders=orders,
        payments=payments,
        deliveries=deliveries,
        refunds=refunds,
    )
