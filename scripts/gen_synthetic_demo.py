"""JW-T10-EVAL01 bounded synthetic demonstration generator (stdlib only).

Builds a deterministic 60-attendance / 90-registration fictional dataset with
controlled ambiguities, a complete reviewed policy, and a valid baseline --
without touching the solver, checker, oracle, API, UI, or configured limits.

Outputs (under --out, default fixtures/demo60_90/):
  registrations.csv, attendance.csv          exact-ingest inputs
  review_policy.json   (jw.review.v1)        CONFIRMED/POSSIBLE edges + unmatched rules
  reference.json       (jw.reference.v1)     complete one-to-one baseline
  ground_truth.json                       synthetic truth map (NEVER an engine input)
  MANIFEST.json                           seed, SHA-256, counts, disclaimers

Usage (repo root, accepted Python venv):
  python scripts/gen_synthetic_demo.py --seed 20261031 --out fixtures/demo60_90

Exit codes: 0 = files written and every runnable self-check passed;
2 = a self-check failed (no partial output is left behind).
Contract validation via the repo packages runs when importable, else SKIPPED.
No engine execution happens here: feasibility/minimum are engine-determined.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from pathlib import Path

SEED_DEFAULT = 20261031
ATT_TOTAL = 60
REG_PER_GROUP = 45
# Ambiguous attendance rows T-49..T-60 (12 rows, within the 8-15 target band).

FIRST_NAMES = [
    "Amara", "Bryn", "Jon", "Priya", "Dev", "Mara", "Niko", "Lena", "Omar",
    "Tessa", "Ravi", "Ines", "Marco", "Yuki", "Zane", "Alina", "Kofi",
    "Sana", "Emil", "Noa", "Felix", "Mira", "Arjun", "Cleo", "Dante",
    "Elif", "Farah", "Gus", "Hana", "Ivan", "Jaya", "Kiran", "Lila",
    "Mateo", "Nadia", "Osei", "Pria", "Quinn", "Rhea", "Soren", "Tara",
    "Umar", "Vera", "Wren", "Xander", "Yara", "Zola", "Aldo", "Bea",
]

LAST_NAMES = [
    "Shah", "Ellis", "Rao", "Smyth", "Carter", "Cooper", "Kim", "Patel",
    "Novak", "Garcia", "Haddad", "Okafor", "Silva", "Moreau", "Tanaka",
    "Weber", "Costa", "Adeyemi", "Larsen", "Mehta", "Diallo", "Fontaine",
    "Sato", "Bakker", "Rossi", "Nasser", "Lindqvist", "Duarte", "Ferreira",
    "Kaur", "Mensah", "Osei", "Bakker", "Naser", "Elis", "Kosta", "Webber",
    "Metha", "Hadad", "Haddadi", "Okafer", "Nico", "Kyra", "Aleks",
]

# Hand-specified alias families: (att, recorded, truth(reg,name,group),
# alternatives[(reg,name,group)...], unmatched_rule). Alternatives are drawn
# from registrations unused by the baseline, so every flip below is
# arithmetically one-to-one; the engine still decides feasibility/minimum.
FAMILIES = [
    ("T-49", "Kira/Kyra Rao", ("R-A07", "Kira Rao", "A"),
     [("R-B12", "Kyra Rao", "B")], "FORBIDDEN"),
    ("T-50", "Jon Smyth", ("R-A15", "Jon Smyth", "A"),
     [("R-B21", "John Smyth", "B")], "FORBIDDEN"),
    ("T-51", "Alex Kim", ("R-A23", "Alex Kim", "A"),
     [("R-B30", "Alex Kim", "B")], "FORBIDDEN"),
    ("T-52", "Sam Carter", ("R-A31", "Sam Carter", "A"),
     [("R-B33", "Sam Cooper", "B"), ("R-B45", "Sam Carter", "B")], "FORBIDDEN"),
    ("T-53", "Mara Ellis", ("R-B09", "Mara Ellis", "B"),
     [("R-A40", "Mara Elis", "A")], "FORBIDDEN"),
    ("T-54", "Niko Silva", ("R-A11", "Niko Silva", "A"),
     [("R-B14", "Nico Silva", "B")], "FORBIDDEN"),
    ("T-55", "Priya Nasser", ("R-B41", "Priya Nasser", "B"),
     [("R-A42", "Priya Naser", "A"), ("R-B44", "Priya Nasser", "B")], "ALLOWED"),
    ("T-56", "Dev Okafor", ("R-A17", "Dev Okafor", "A"),
     [("R-B18", "Dev Okafer", "B")], "FORBIDDEN"),
    ("T-57", "Lena Costa", ("R-B25", "Lena Costa", "B"),
     [("R-A26", "Lena Kosta", "A")], "FORBIDDEN"),
    ("T-58", "Omar Haddad", ("R-A35", "Omar Haddad", "A"),
     [("R-B36", "Omar Hadad", "B"), ("R-B37", "Omar Haddadi", "B")], "FORBIDDEN"),
    ("T-59", "Tessa Weber", ("R-B28", "Tessa Weber", "B"),
     [("R-A29", "Tessa Webber", "A")], "FORBIDDEN"),
    ("T-60", "Ravi Mehta", ("R-A19", "Ravi Mehta", "A"),
     [("R-B20", "Ravi Metha", "B")], "ALLOWED"),
]

SETTLED_ATT = [f"T-{i:02d}" for i in range(1, 49)]
SCOPE_NOTE = (
    "Synthetic T10-EVAL01 closed review universe: 60 attendance rows, 90 "
    "registrations, 12 controlled ambiguities. Applies to this model only; "
    "no claim about real-world identity completeness."
)


def _family_regs():
    """All explicitly hand-placed registration IDs (truth + alternatives)."""
    regs = {}
    for _att, _rec, truth, alts, _rule in FAMILIES:
        regs[truth[0]] = (truth[1], truth[2])
        for alt in alts:
            regs[alt[0]] = (alt[1], alt[2])
    return regs


def build_registrations(rng):
    """90 registrations: 45 per group; family IDs hand-placed, rest pooled."""
    fixed = _family_regs()
    used_names = {name for name, _group in fixed.values()}
    # Intentional exact-shared name across groups (documented collision case).
    shared = ("Alex Kim",)
    regs = []
    counters = {"A": 0, "B": 0}
    pool = [f"{f} {l}" for f in FIRST_NAMES for l in LAST_NAMES]
    rng.shuffle(pool)
    pool_iter = iter(pool)
    for group in ("A", "B"):
        for n in range(1, REG_PER_GROUP + 1):
            rid = f"R-{group}{n:02d}"
            if rid in fixed:
                name, fixed_group = fixed[rid]
                assert fixed_group == group, f"family group mismatch for {rid}"
            else:
                name = next(pool_iter)
                while name in used_names and name not in shared:
                    name = next(pool_iter)
                used_names.add(name)
            regs.append((rid, name, group))
            counters[group] += 1
    assert counters == {"A": 45, "B": 45}, counters
    rids = [r[0] for r in regs]
    assert len(set(rids)) == 90, "registration IDs must be unique"
    return regs


def build_attendance(reg_by_id):
    """60 attendance rows: 48 settled exact matches + 12 alias families."""
    truth_regs = {truth[0] for _a, _r, truth, _alts, _u in FAMILIES}
    alt_regs = {a[0] for _a, _r, _t, alts, _u in FAMILIES for a in alts}
    settled_pool = sorted(
        rid for rid in reg_by_id if rid not in truth_regs and rid not in alt_regs
    )
    # 24 settled per group keeps the designed 32/28 baseline split.
    by_group = {"A": [r for r in settled_pool if r.startswith("R-A")],
                "B": [r for r in settled_pool if r.startswith("R-B")]}
    assert len(by_group["A"]) >= 24 and len(by_group["B"]) >= 24
    settled_regs = by_group["A"][:24] + by_group["B"][:24]
    rows, truth = [], {}
    for att, reg in zip(SETTLED_ATT, sorted(settled_regs)):
        rows.append((att, reg_by_id[reg][0]))
        truth[att] = reg
    for att, recorded, t, _alts, _rule in FAMILIES:
        rows.append((att, recorded))
        truth[att] = t[0]
    assert len(rows) == ATT_TOTAL and len(set(truth)) == ATT_TOTAL
    return rows, truth


def build_policy(truth):
    """CONFIRMED settled edges; POSSIBLE family edges; unmatched for all 60."""
    edges, unmatched = [], []
    for att in SETTLED_ATT:
        reg = truth[att]
        edges.append({"attendance_id": att, "registration_id": reg,
                      "status": "CONFIRMED", "operation": "EXPLICIT_REVIEW"})
        unmatched.append({"attendance_id": att, "status": "FORBIDDEN",
                          "operation": "EXPLICIT_REVIEW"})
    for att, _recorded, t, alts, rule in FAMILIES:
        for alt in [t] + alts:
            edges.append({"attendance_id": att, "registration_id": alt[0],
                          "status": "POSSIBLE", "operation": "EXPLICIT_REVIEW"})
        unmatched.append({"attendance_id": att, "status": rule,
                          "operation": "EXPLICIT_REVIEW"})
        assert len([t] + alts) <= 10, "candidate cap"
    assert len(edges) <= 1000, "shortlist total cap"
    return ({"schema_version": "jw.review.v1", "revision": 1, "edges": edges,
             "unmatched": unmatched, "coverage": "REVIEWED_CLOSED_SCOPE",
             "scope_note": SCOPE_NOTE, "closed_scope_attested": True},
            {"schema_version": "jw.reference.v1",
             "assignments": [{"attendance_id": a, "registration_id": truth[a]}
                             for a in sorted(truth)]})


def _augmenting_match(graph, needed):
    """Bipartite feasibility for forced-matched rows (mirrors policy gates)."""
    owner = {}

    def place(att, seen):
        for reg in graph[att]:
            if reg in seen:
                continue
            seen.add(reg)
            if reg not in owner or place(owner[reg], seen):
                owner[reg] = att
                return True
        return False

    return all(place(att, set()) for att in needed)


def self_check(regs, rows, truth, policy, reference):
    """Structural + arithmetic pre-checks. Raises AssertionError on failure.

    This verifies construction honesty (counts, one-to-one baseline, policy
    consistency, bipartite feasibility, challengeable shape). It is NOT a
    solver result: feasibility optima and minimum distance are engine work.
    """
    reg_by_id = dict((r[0], (r[1], r[2])) for r in regs)
    assert len(regs) == 90 and len(rows) == ATT_TOTAL
    assert len({a for a, _r in rows}) == ATT_TOTAL, "attendance IDs unique"
    assert all(len(r[0]) <= 128 and len(r[1]) <= 200 for r in regs)
    assert all(len(a) <= 128 and len(n) <= 200 for a, n in rows)
    assert policy["coverage"] == "REVIEWED_CLOSED_SCOPE"
    assert policy["closed_scope_attested"] is True
    assert 12 <= len(SCOPE_NOTE) <= 1000
    assert {u["attendance_id"] for u in policy["unmatched"]} == set(truth)
    by_att = {}
    for e in policy["edges"]:
        assert e["registration_id"] in reg_by_id, f"unknown reg {e['registration_id']}"
        by_att.setdefault(e["attendance_id"], []).append(e)
    assert all(len(v) <= 10 for v in by_att.values())
    # Baseline: complete, allowed, one-to-one; count A>B with a margin.
    counts = {"A": 0, "B": 0, "unmatched": 0}
    claimed = set()
    for item in reference["assignments"]:
        reg = item["registration_id"]
        opts = [e["registration_id"] for e in by_att[item["attendance_id"]]
                if e["status"] in ("CONFIRMED", "POSSIBLE")]
        assert reg in opts, f"baseline not permitted for {item['attendance_id']}"
        assert reg not in claimed, f"baseline one-to-one violated at {reg}"
        claimed.add(reg)
        counts[reg_by_id[reg][1]] += 1
    assert counts["unmatched"] == 0 and counts["A"] > counts["B"], counts
    margin = counts["A"] - counts["B"]
    # Challengeable shape: A-truth ambiguous rows with baseline-unused B alts.
    flippable = []
    for att, _rec, t, alts, _rule in FAMILIES:
        if reg_by_id[t[0]][1] != "A":
            continue
        free_b = [a[0] for a in alts
                  if reg_by_id[a[0]][1] == "B" and a[0] not in claimed]
        if free_b:
            flippable.append((att, t[0], free_b[0]))
    # Each A->B flip nets 2; a tie already makes A>B false (reversal).
    need = (margin + 1) // 2
    assert len(flippable) >= need, "no challengeable shape by construction"
    # Bipartite feasibility for forced-matched (FORBIDDEN-unmatched) rows.
    confirmed_claimed = {truth[a] for a in SETTLED_ATT}
    graph, needed = {}, []
    for att in sorted(truth):
        opts = [e["registration_id"] for e in by_att[att] if e["status"] == "POSSIBLE"]
        rule = next(u["status"] for u in policy["unmatched"] if u["attendance_id"] == att)
        if rule == "FORBIDDEN" and att not in SETTLED_ATT:
            graph[att] = sorted(r for r in opts if r not in confirmed_claimed)
            needed.append(att)
    assert _augmenting_match(graph, needed), "policy infeasible by construction"
    return {"baseline_counts": counts, "margin": margin,
            "flippable_rows": [f[0] for f in flippable],
            "flips_needed_for_tie_or_reversal": need,
            "feasibility": "CONSTRUCTION_FEASIBLE_ENGINE_UNRUN"}


def _sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def write_files(out, seed, regs, rows, policy, reference, truth, report):
    out.mkdir(parents=True, exist_ok=True)
    reg_csv = ("registration_id,name,group\n" +
               "".join(f"{r},{n},{g}\n" for r, n, g in regs))
    att_csv = ("attendance_id,recorded_name\n" +
               "".join(f"{a},{n}\n" for a, n in rows))
    (out / "registrations.csv").write_text(reg_csv, encoding="utf-8")
    (out / "attendance.csv").write_text(att_csv, encoding="utf-8")
    (out / "review_policy.json").write_text(json.dumps(policy, indent=2) + "\n",
                                            encoding="utf-8")
    (out / "reference.json").write_text(json.dumps(reference, indent=2) + "\n",
                                        encoding="utf-8")
    ground_truth = {
        "note": ("Synthetic truth map for evaluation design. NEVER an engine "
                 "input; the engine sees only the CSVs, the reviewed policy, "
                 "and the reference. No Meta provenance exists anywhere here."),
        "seed": seed,
        "truth_assignments": truth,
        "ambiguous_rows": [a for a, _r, _t, _al, _u in FAMILIES],
        "flippable_rows": report["flippable_rows"],
    }
    (out / "ground_truth.json").write_text(json.dumps(ground_truth, indent=2) + "\n",
                                           encoding="utf-8")
    files = {}
    for name in ("registrations.csv", "attendance.csv", "review_policy.json",
                 "reference.json", "ground_truth.json"):
        files[name] = _sha256_bytes((out / name).read_bytes())
    manifest = {
        "generator": "scripts/gen_synthetic_demo.py",
        "seed": seed,
        "counts": {"attendance": len(rows), "registrations": len(regs),
                   "ambiguous_rows": len(FAMILIES)},
        "files": files,
        "construction_report": report,
        "owner_benchmark_commands": [
            "python scripts/gen_synthetic_demo.py --seed 20261031 --out fixtures/demo60_90",
            "python -m joinwitness.solver --registrations fixtures/demo60_90/registrations.csv --attendance fixtures/demo60_90/attendance.csv --policy fixtures/demo60_90/review_policy.json --reference fixtures/demo60_90/reference.json --time-limit 10",
            "python -m joinwitness.verify --receipt <issued-receipt>.json --registrations fixtures/demo60_90/registrations.csv --attendance fixtures/demo60_90/attendance.csv --policy fixtures/demo60_90/review_policy.json",
        ],
        "disclaimers": [
            "No engine execution happened during generation.",
            "Feasibility/minimum verdicts are engine-determined and UNRUN.",
            "The small-case oracle refuses above 12 rows: expect solver-attributed proof only.",
        ],
    }
    (out / "MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n",
                                       encoding="utf-8")
    return files


def validate_contracts(out):
    """Run generated bytes through the real T02/T03 gates when importable."""
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
        from joinwitness.baseline import ReferenceDraft, freeze_reference
        from joinwitness.contracts import InputBundle
        from joinwitness.ingest import load_csv_bytes
        from joinwitness.policy import ReviewDraft, freeze_review
    except ImportError as exc:
        return f"CONTRACT_VALIDATION_SKIPPED ({exc})"
    reg_rows, reg_digest = load_csv_bytes((out / "registrations.csv").read_bytes(),
                                          "registrations")
    att_rows, att_digest = load_csv_bytes((out / "attendance.csv").read_bytes(),
                                          "attendance")
    bundle = InputBundle(registrations=reg_rows, attendance=att_rows,
                         registrations_digest=reg_digest, attendance_digest=att_digest)
    policy = ReviewDraft.model_validate_json((out / "review_policy.json").read_bytes())
    snapshot = freeze_review(bundle, policy)
    reference, counts = freeze_reference(
        bundle, snapshot,
        ReferenceDraft.model_validate_json((out / "reference.json").read_bytes()))
    assert counts.a_greater_than_b, "baseline must satisfy A>B"
    return (f"CONTRACT_VALIDATION_PASSED baseline A={counts.a} B={counts.b} "
            f"unmatched={counts.unmatched}")


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Generate the deterministic 60/90 synthetic demo (stdlib only)")
    parser.add_argument("--seed", type=int, default=SEED_DEFAULT)
    parser.add_argument("--out", type=Path, default=Path("fixtures/demo60_90"))
    args = parser.parse_args(argv)
    if args.out.exists() and any(args.out.iterdir()):
        print(f"REFUSE_NONEMPTY_OUT: {args.out} already exists; remove it first.")
        return 2
    rng = random.Random(args.seed)
    regs = build_registrations(rng)
    reg_by_id = dict((r[0], (r[1], r[2])) for r in regs)
    rows, truth = build_attendance(reg_by_id)
    policy, reference = build_policy(truth)
    try:
        report = self_check(regs, rows, truth, policy, reference)
    except AssertionError as exc:
        print(f"SELF_CHECK_FAILED: {exc}")
        return 2
    files = write_files(args.out, args.seed, regs, rows, policy, reference,
                        truth, report)
    try:
        contract = validate_contracts(args.out)
    except Exception as exc:  # noqa: BLE001 -- fail closed, report, remove output
        import shutil
        print(f"CONTRACT_VALIDATION_FAILED: {type(exc).__name__}: {exc}")
        shutil.rmtree(args.out, ignore_errors=True)
        return 2
    print(f"seed={args.seed} attendance={len(rows)} registrations={len(regs)} "
          f"ambiguous={len(FAMILIES)} baseline={report['baseline_counts']} "
          f"flippable={report['flippable_rows']}")
    for name, digest in files.items():
        print(f"sha256 {digest}  {name}")
    print(contract)
    print("ENGINE_UNRUN: no solver/checker/oracle/receipt executed by this script.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
