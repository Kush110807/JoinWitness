import { describe, expect, it } from "vitest";
import {
  blockedCommerceRows,
  buildCommerceCatalog,
  emptyCommerceDraft,
  makeRecordKey,
  previewCommerceBaseline,
  seedAllSourceRefs,
  seedRowFromSourceRefs,
  serializeCommerceReview,
  setCommerceBaseline,
  setCommerceEdge,
  setCommerceUnmatched,
} from "./commerceDraft";

const SOURCE = [
  { record_key: "payment:P1", target_id: "O1", origin: "SOURCE_REF", authorised: false },
  { record_key: "delivery:D2", target_id: "O2", origin: "SOURCE_REF", authorised: false },
] as const;

const META = [
  {
    record_type: "delivery",
    record_id: "D2",
    record_key: "delivery:D2",
    target_type: "order",
    target_id: "O3",
    origin: "META_SUGGESTED",
    evidence: "Server note.",
    server_call_id: "call-1",
    catalog_effect: "ADDED_TARGET",
    authorised: false,
  },
] as const;

describe("commerceDraft catalog and permissions", () => {
  it("starts empty with nothing permitted and no baseline", () => {
    const d = emptyCommerceDraft(["payment:P1"]);
    expect(d.unmatched).toEqual({ "payment:P1": "PROHIBITED" });
    expect(d.edges).toEqual({});
    expect(d.thresholdK).toBeNull();
    expect(d.attestation).toEqual({
      all_rows_reviewed: false,
      understands_bounded_predicate: false,
      conflicting_source_ref_overrides_explained: false,
    });
  });

  it("merges source and meta pairs into one selectable target with both provenances", () => {
    const metaSamePair = [
      { ...META[0], target_id: "O2", catalog_effect: "ADDED_PROVENANCE" },
    ] as never;
    const { targets, duplicateManual } = buildCommerceCatalog(
      SOURCE as never,
      metaSamePair,
      [],
    );
    expect(duplicateManual).toEqual([]);
    const d2o2 = targets.filter((t) => t.recordKey === "delivery:D2" && t.targetId === "O2");
    expect(d2o2.length).toBe(1);
    expect([...d2o2[0].origins].sort()).toEqual(["META_SUGGESTED", "SOURCE_REF"]);
    expect(d2o2[0].metaEvidence.length).toBe(1);
  });

  it("reports manual duplicates of registered pairs instead of double-counting", () => {
    const { targets, duplicateManual } = buildCommerceCatalog(SOURCE as never, [], [
      { record_type: "payment", record_id: "P1", target_id: "O1", reason: "r" },
      { record_type: "payment", record_id: "P1", target_id: "O2", reason: "r" },
    ]);
    expect(duplicateManual.length).toBe(1);
    expect(duplicateManual[0].target_id).toBe("O1");
    const p1 = targets.filter((t) => t.recordKey === "payment:P1");
    expect(p1.map((t) => t.targetId).sort()).toEqual(["O1", "O2"]);
    expect(p1.find((t) => t.targetId === "O2")?.origins).toEqual(["MANUAL"]);
  });

  it("keeps at most one confirmed choice per row", () => {
    let d = emptyCommerceDraft(["delivery:D2"]);
    d = setCommerceEdge(d, "delivery:D2", "O2", "POSSIBLE");
    d = setCommerceUnmatched(d, "delivery:D2", "POSSIBLE");
    d = setCommerceEdge(d, "delivery:D2", "O3", "CONFIRMED");
    expect(d.edges["delivery:D2"]).toEqual({ O2: "PROHIBITED", O3: "CONFIRMED" });
    expect(d.unmatched["delivery:D2"]).toBe("PROHIBITED");
  });

  it("seeding only writes draft values and never authorizes", () => {
    const { targets } = buildCommerceCatalog(SOURCE as never, META as never, []);
    let d = emptyCommerceDraft(["payment:P1", "delivery:D2"]);
    d = seedRowFromSourceRefs(d, targets, "payment:P1");
    expect(d.edges["payment:P1"]).toEqual({ O1: "POSSIBLE" });
    // Untouched rows stay absent (unreviewed); meta targets are never seeded.
    expect(d.edges["delivery:D2"]).toBeUndefined();
    d = seedAllSourceRefs(d, targets);
    expect(d.edges["delivery:D2"]).toEqual({ O2: "POSSIBLE" });
    // Draft values are plain local state; no adoption happened.
    expect(d.unmatched["payment:P1"]).toBe("PROHIBITED");
  });

  it("serializes a complete snapshot with explicit null baselines", () => {
    const { targets } = buildCommerceCatalog(SOURCE as never, META as never, []);
    let d = emptyCommerceDraft(["payment:P1", "delivery:D2"]);
    d = setCommerceEdge(d, "payment:P1", "O1", "CONFIRMED");
    d = setCommerceEdge(d, "delivery:D2", "O2", "POSSIBLE");
    d = setCommerceEdge(d, "delivery:D2", "O3", "POSSIBLE");
    d = setCommerceBaseline(d, "delivery:D2", "O2");
    const records = [
      { recordKey: "payment:P1", recordType: "payment", recordId: "P1" },
      { recordKey: "delivery:D2", recordType: "delivery", recordId: "D2" },
    ] as const;
    const snap = serializeCommerceReview(
      d,
      targets,
      records.map((r) => ({ ...r })),
    );
    expect(snap.rows.length).toBe(2);
    const d2 = snap.rows.find((r) => r.record_id === "D2");
    expect(d2?.edges).toEqual([
      { target_id: "O2", disposition: "POSSIBLE" },
      { target_id: "O3", disposition: "POSSIBLE" },
    ]);
    expect(d2?.unmatched).toBe("PROHIBITED");
    expect(snap.reference_mapping).toEqual({ "payment:P1": "O1", "delivery:D2": "O2" });
    // No client-supplied origin on review edges.
    expect(JSON.stringify(snap.rows)).not.toContain("origin");
  });

  it("flags rows with no allowed choice and warns on unresolvable baselines", () => {
    const { targets } = buildCommerceCatalog(SOURCE as never, [], []);
    const d = emptyCommerceDraft(["payment:P1", "delivery:D2"]);
    const blocked = blockedCommerceRows(d, targets, ["payment:P1", "delivery:D2"]);
    expect(blocked.sort()).toEqual(["delivery:D2", "payment:P1"]);
    const preview = previewCommerceBaseline(d, ["payment:P1"]);
    expect(preview.warnings.length).toBeGreaterThan(0);
    expect(makeRecordKey("refund", "R1")).toBe("refund:R1");
  });
});
