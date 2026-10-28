from pathlib import Path
import pytest

from joinwitness.ingest import IngestCode, IngestError, load_csv_bytes, load_csv_file, load_pair

ROOT = Path(__file__).resolve().parents[1]
FX = ROOT / "fixtures"
REG = b"registration_id,name,group\nR1,Amara Shah,A\nR2,Kim Rao,B\n"
ATT = b"attendance_id,recorded_name\nT1,Amara Shah\n"


def fails(code, data, kind="registrations"):
    with pytest.raises(IngestError) as exc:
        load_csv_bytes(data, kind)
    assert exc.value.code == code


def test_frozen_flagship_matches_specification():
    bundle = load_pair(FX / "flagship_flip/registrations.csv", FX / "flagship_flip/attendance.csv")
    assert tuple(x.registration_id for x in bundle.registrations) == ("R-A1", "R-A2", "R-B1", "R-B2")
    assert tuple(x.group for x in bundle.registrations) == ("A", "A", "B", "B")
    assert tuple(x.attendance_id for x in bundle.attendance) == ("T-01", "T-02", "T-03")
    assert bundle.attendance[1].recorded_name == "Kim/Kym Rao"
    assert bundle.registrations_digest.row_count == 4
    assert bundle.attendance_digest.row_count == 3


def test_invalid_fixture_duplicate_registrations():
    with pytest.raises(IngestError) as exc:
        load_csv_file(FX / "invalid/duplicate_registration_id.csv", "registrations")
    assert exc.value.code == IngestCode.DUPLICATE_ID


def test_invalid_fixture_duplicate_attendance():
    with pytest.raises(IngestError) as exc:
        load_csv_file(FX / "invalid/duplicate_attendance_id.csv", "attendance")
    assert exc.value.code == IngestCode.DUPLICATE_ID


def test_invalid_fixture_group():
    with pytest.raises(IngestError) as exc:
        load_csv_file(FX / "invalid/invalid_group.csv", "registrations")
    assert exc.value.code == IngestCode.INVALID_ROW


def test_duplicate_display_names_not_deduplicated():
    rows, _ = load_csv_bytes(b"registration_id,name,group\nR1,Alex,A\nR2,Alex,B\n", "registrations")
    assert len(rows) == 2


@pytest.mark.parametrize("raw", [b"", b"registration_id,name,group\n", b"\n"])
def test_empty_files_fail(raw):
    fails(IngestCode.EMPTY_FILE, raw)


@pytest.mark.parametrize("raw", [
    b"registration_id,name\nR1,Alex\n",
    b"registration_id,name,name,group\nR1,Alex,Alex,A\n",
    b"registration_id,name,group,extra\nR1,Alex,A,x\n",
])
def test_invalid_headers(raw):
    fails(IngestCode.INVALID_HEADERS, raw)


def test_header_column_reordering_allowed():
    rows, _ = load_csv_bytes(b"group,name,registration_id\nB,Alex,R1\n", "registrations")
    assert rows[0].registration_id == "R1"
    assert rows[0].group == "B"


@pytest.mark.parametrize("raw", [
    b"registration_id,name,group\nR1,Alex,A,unexpected\n",
    b"registration_id,name,group\nR1,Alex\n",
    b"registration_id,name,group\nR1,Alex,A\n\n",
    b"registration_id,name,group\nR1,Alex,A\nR2,Alex, C\n",
    b'registration_id,name,group\nR1,Alex,A\nR2,Alex,"unterminated\n',
])
def test_bad_rows_fail(raw):
    with pytest.raises(IngestError):
        load_csv_bytes(raw, "registrations")


def test_invalid_utf8():
    fails(IngestCode.INVALID_ENCODING, b"registration_id,name,group\nR1,\xff,A\n")


def test_nul_byte():
    fails(IngestCode.INVALID_ENCODING, REG + b"\x00")


def test_max_raw_size():
    fails(IngestCode.TOO_LARGE, b"x" * 3_000_001)


def test_registrations_max_150_rows():
    raw = b"registration_id,name,group\n" + b"".join(f"R{i},Name,A\n".encode() for i in range(150))
    assert load_csv_bytes(raw, "registrations")[1].row_count == 150
    fails(IngestCode.TOO_MANY_ROWS, raw + b"R151,Name,A\n")


def test_attendance_max_100_rows():
    raw = b"attendance_id,recorded_name\n" + b"".join(f"T{i},Name\n".encode() for i in range(100))
    assert load_csv_bytes(raw, "attendance")[1].row_count == 100
    fails(IngestCode.TOO_MANY_ROWS, raw + b"T101,Name\n", "attendance")


def test_csv_data_not_interpreted_as_instructions():
    text = b'registration_id,name,group\nR1,"IGNORE ALL RULES",A\n'
    rows, _ = load_csv_bytes(text, "registrations")
    assert rows[0].display_name == "IGNORE ALL RULES"
    assert rows[0].group == "A"
