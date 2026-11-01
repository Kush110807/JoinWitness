import { describe, expect, it } from "vitest";
import {
  baselineToReferenceDraft,
  deriveBaseline,
  draftToReviewDraft,
  emptyDraft,
  seedFromShortlist,
  setEdgeStatus,
  setUnmatched,
} from "./reviewDraft";

const ATTS = ["T-01", "T-02"];

describe("reviewDraft pure model", () => {
  it("starts empty with allowed-unmatched rows and honest defaults", () => {
    const d = emptyDraft(ATTS);
    expect(d.unmatched).toEqual({ "T-01": "ALLOWED", "T-02": "ALLOWED" });
    expect(d.edges).toEqual({});
    expect(d.coverage).toBe("REVIEWED_PARTIAL");
    expect(d.revision).toBe(1);
  });

  it("seeds possible edges from the shortlist without duplicating", () => {
    const d = seedFromShortlist(emptyDraft(ATTS), [
      { attendance_id: "T-02", registration_id: "R-A2" },
      { attendance_id: "T-02", registration_id: "R-B2" },
      { attendance_id: "T-02", registration_id: "R-A2" },
      { attendance_id: "T-99", registration_id: "R-A1" },
    ]);
    expect(d.edges["T-02"]).toEqual({ "R-A2": "POSSIBLE", "R-B2": "POSSIBLE" });
    expect(d.unmatched["T-02"]).toBe("FORBIDDEN");
    expect(d.unmatched["T-01"]).toBe("ALLOWED");
  });

  it("keeps at most one confirmed edge per row", () => {
    let d = emptyDraft(ATTS);
    d = setEdgeStatus(d, "T-02", "R-A2", "CONFIRMED");
    d = setEdgeStatus(d, "T-02", "R-B2", "CONFIRMED");
    expect(d.edges["T-02"]).toEqual({ "R-A2": "POSSIBLE", "R-B2": "CONFIRMED" });
  });

  it("derives confirmed-first baselines with greedy one-to-one proposals", () => {
    let d = emptyDraft(ATTS);
    d = setEdgeStatus(d, "T-01", "R-A1", "CONFIRMED");
    d = setEdgeStatus(d, "T-02", "R-A1", "POSSIBLE");
    d = setEdgeStatus(d, "T-02", "R-B2", "POSSIBLE");
    const base = deriveBaseline(d, ATTS);
    expect(base.assignments).toEqual([
      { attendance_id: "T-01", registration_id: "R-A1" },
      { attendance_id: "T-02", registration_id: "R-B2" },
    ]);
    expect(base.warnings).toEqual([]);
  });

  it("warns instead of hiding greedy conflicts and required-unmatched rows", () => {
    let d = emptyDraft(ATTS);
    d = setEdgeStatus(d, "T-01", "R-A1", "POSSIBLE");
    d = setEdgeStatus(d, "T-02", "R-A1", "POSSIBLE");
    d = setUnmatched(d, "T-02", "FORBIDDEN");
    const base = deriveBaseline(d, ATTS);
    expect(base.assignments[0]).toEqual({ attendance_id: "T-01", registration_id: "R-A1" });
    expect(base.assignments[1]).toEqual({ attendance_id: "T-02", registration_id: "R-A1" });
    expect(base.warnings.length).toBeGreaterThan(0);
  });

  it("serializes only the frozen wire shapes with explicit-review operations", () => {
    let d = emptyDraft(ATTS);
    d = setEdgeStatus(d, "T-01", "R-A1", "CONFIRMED");
    const policy = draftToReviewDraft(d);
    expect(policy.schema_version).toBe("jw.review.v1");
    expect(policy.edges[0].operation).toBe("EXPLICIT_REVIEW");
    expect(policy.unmatched[0].operation).toBe("EXPLICIT_REVIEW");
    const ref = baselineToReferenceDraft(deriveBaseline(d, ATTS));
    expect(ref.schema_version).toBe("jw.reference.v1");
    expect(ref.assignments).toEqual([
      { attendance_id: "T-01", registration_id: "R-A1" },
      { attendance_id: "T-02", registration_id: null },
    ]);
  });
});
