import { describe, expect, it } from "vitest";
import {
  changedLinkText,
  formatCanvasCounts,
  isReversibleVerdict,
  isValidMinimum,
  leadText,
  nullAlternativeSuffix,
  singleCanvasLabel,
  verdictHeadline,
  verdictPill,
} from "./decisionView";

describe("decisionView display derivation", () => {
  it("maps each receipt verdict to honest distinct copy", () => {
    expect(verdictHeadline("REVERSIBLE_MINIMUM_PROVEN", 1)).toMatch(/reverses the result/);
    expect(verdictHeadline("REVERSIBLE_WITNESS_ONLY")).toMatch(/smallest change is unproven/);
    expect(verdictHeadline("STABLE_WITHIN_REVIEWED_POLICY")).toMatch(/No permitted alternative/);
    expect(verdictHeadline("NOT_VERIFIED")).toMatch(/not verified/);
    expect(verdictPill("REVERSIBLE_MINIMUM_PROVEN")).toBe("MINIMUM VERIFIED");
    expect(verdictPill("NOT_VERIFIED")).toBe("INCONCLUSIVE");
    expect(verdictPill("REVERSIBLE_WITNESS_ONLY")).toBe("SCOPED RESULT");
    expect(verdictPill("STABLE_WITHIN_REVIEWED_POLICY")).toBe("SCOPED RESULT");
  });

  it("renders the server-reported minimum count, never a hardcoded one", () => {
    expect(verdictHeadline("REVERSIBLE_MINIMUM_PROVEN", 1)).toBe(
      "One permitted identity change reverses the result.",
    );
    expect(verdictHeadline("REVERSIBLE_MINIMUM_PROVEN", 2)).toBe(
      "Two permitted identity changes reverse the result.",
    );
    expect(verdictHeadline("REVERSIBLE_MINIMUM_PROVEN", 3)).toBe(
      "3 permitted identity changes reverse the result.",
    );
  });

  it("suppresses the numerical claim for null or invalid minimums", () => {
    for (const bad of [null, undefined, 0, -1, 1.5, Number.NaN]) {
      expect(verdictHeadline("REVERSIBLE_MINIMUM_PROVEN", bad)).toBe(
        "A permitted alternative reverses the result.",
      );
    }
    expect(isValidMinimum(1)).toBe(true);
    expect(isValidMinimum(2)).toBe(true);
    expect(isValidMinimum(null)).toBe(false);
    expect(isValidMinimum(0)).toBe(false);
    expect(isValidMinimum(1.5)).toBe(false);
  });

  it("treats only checked reversible verdicts as reversible", () => {
    expect(isReversibleVerdict("REVERSIBLE_MINIMUM_PROVEN")).toBe(true);
    expect(isReversibleVerdict("REVERSIBLE_WITNESS_ONLY")).toBe(true);
    expect(isReversibleVerdict("STABLE_WITHIN_REVIEWED_POLICY")).toBe(false);
    expect(isReversibleVerdict("NOT_VERIFIED")).toBe(false);
    expect(isReversibleVerdict(undefined)).toBe(false);
  });

  it("leads ties to neither group, since A>B is false on a tie", () => {
    expect(leadText({ a: 2, b: 1 })).toBe("Group A leads");
    expect(leadText({ a: 1, b: 2 })).toBe("Group B leads");
    expect(leadText({ a: 1, b: 1 })).toBe("Groups are tied");
  });

  it("formats exact canvas counts with and without an alternative", () => {
    expect(
      formatCanvasCounts({ a: 2, b: 1 }, { a: 1, b: 2 }, "REVERSIBLE_MINIMUM_PROVEN"),
    ).toBe("Original: Group A 2 · Group B 1 → Permitted alternative: Group A 1 · Group B 2");
    expect(formatCanvasCounts({ a: 2, b: 1 }, null, "STABLE_WITHIN_REVIEWED_POLICY")).toBe(
      "Original: Group A 2 · Group B 1 · no permitted reversal exists within the reviewed set",
    );
  });

  it("keeps null-alternative copy verdict-aware: stable is not inconclusive", () => {
    expect(formatCanvasCounts({ a: 2, b: 1 }, null, "NOT_VERIFIED")).toBe(
      "Original: Group A 2 · Group B 1 · Inconclusive — no reversal or stability established",
    );
    expect(nullAlternativeSuffix("STABLE_WITHIN_REVIEWED_POLICY")).toMatch(
      /no permitted reversal exists within the reviewed set/,
    );
    expect(nullAlternativeSuffix("NOT_VERIFIED")).toMatch(
      /Inconclusive — no reversal or stability established/,
    );
    expect(singleCanvasLabel("STABLE_WITHIN_REVIEWED_POLICY")).toMatch(
      /no permitted reversal within the reviewed set/,
    );
    expect(singleCanvasLabel("NOT_VERIFIED")).toBe("Original matching: result inconclusive");
  });

  it("renders decisive links from witness data, unmatched-aware", () => {
    expect(changedLinkText([{ attendance_id: "T-02", from: "R-A2", to: "R-B2" }])).toBe(
      "T-02: R-A2 → R-B2",
    );
    expect(changedLinkText([{ attendance_id: "T-09", from: null, to: "R-A1" }])).toBe(
      "T-09: unmatched → R-A1",
    );
    expect(changedLinkText([])).toBe("");
  });
});
