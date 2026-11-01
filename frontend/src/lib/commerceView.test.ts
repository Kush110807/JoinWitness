import { describe, expect, it } from "vitest";
import {
  commerceDecisionText,
  commerceStatusCopy,
  commerceWitnessChangeText,
  isCommerceReceiptEligible,
  validateCommerceCoverage,
  validateCommerceResult,
} from "./commerceView";

const FULL_COVERAGE = {
  raw_worlds_total: 2,
  raw_worlds_checked: 2,
  invalid_worlds_total: 0,
  invalid_worlds_checked: 0,
  admissible_worlds_total: 2,
  admissible_worlds_checked: 2,
  checker_worlds_total: 2,
  checker_worlds_checked: 2,
  fully_enumerated: true,
  checker_complete: true,
};

const REVERSED = {
  status: "REVERSED_EXHAUSTIVE",
  reason: null,
  predicate: "clean_fulfilled_count >= K",
  threshold_k: 2,
  baseline: { clean_fulfilled_count: 2, decision: true },
  witness: {
    reference_changes: [{ record_key: "delivery:D2", from_target_id: "O2", to_target_id: "O3" }],
    clean_fulfilled_count: 1,
    decision: false,
    link_distance: 1,
  },
  coverage: FULL_COVERAGE,
  checker_status: "PASSED",
  proof_basis: "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION",
  minimum_distance_proven_within_scope: true,
  minimum_link_distance_within_scope: 1,
};

describe("commerceView status discrimination", () => {
  it("keeps reversed, stable, and inconclusive copy distinct and scoped", () => {
    const reversed = commerceStatusCopy("REVERSED_EXHAUSTIVE");
    expect(reversed.tone).toBe("reversed");
    expect(reversed.headline).toMatch(/crosses K/);
    expect(reversed.detail).toMatch(/within this reviewed finite scope only/);
    expect(reversed.detail).not.toMatch(/global|universal/i);
    const stable = commerceStatusCopy("STABLE_WITHIN_SCOPE");
    expect(stable.tone).toBe("stable");
    expect(stable.detail).toMatch(/not real-world linkage certainty/i);
    const inconclusive = commerceStatusCopy("NOT_VERIFIED");
    expect(inconclusive.tone).toBe("inconclusive");
    expect(inconclusive.headline).toMatch(/no result has been proved/i);
  });

  it("accepts the exact ten-key complete coverage", () => {
    expect(validateCommerceCoverage(FULL_COVERAGE)).toEqual([]);
  });

  it("rejects missing keys, removed aliases, and broken invariants", () => {
    const { raw_worlds_total: _drop, ...missing } = FULL_COVERAGE;
    expect(validateCommerceCoverage(missing).length).toBeGreaterThan(0);
    // A removed-alias-only shape carries none of the frozen keys.
    expect(
      validateCommerceCoverage({ raw_worlds: 2, admissible_worlds: 2 }).length,
    ).toBeGreaterThan(0);
    expect(
      validateCommerceCoverage({ ...FULL_COVERAGE, raw_worlds_checked: 3 }).length,
    ).toBeGreaterThan(0);
    expect(
      validateCommerceCoverage({ ...FULL_COVERAGE, checker_worlds_checked: 3 }).length,
    ).toBeGreaterThan(0);
    // Incomplete enumeration must leave totals null.
    expect(
      validateCommerceCoverage({
        ...FULL_COVERAGE,
        fully_enumerated: false,
        checker_complete: false,
      }).length,
    ).toBeGreaterThan(0);
  });

  it("accepts a shape-valid reversed result and rejects contradictions", () => {
    expect(validateCommerceResult(REVERSED)).toEqual([]);
    expect(validateCommerceResult({ ...REVERSED, witness: null }).length).toBeGreaterThan(0);
    expect(
      validateCommerceResult({ ...REVERSED, minimum_link_distance_within_scope: 2 }).length,
    ).toBeGreaterThan(0);
    expect(validateCommerceResult({ ...REVERSED, checker_status: "UNRUN" }).length).toBeGreaterThan(0);
  });

  it("requires stable results to carry witness null and no minimum", () => {
    const stable = {
      ...REVERSED,
      status: "STABLE_WITHIN_SCOPE",
      witness: null,
      minimum_distance_proven_within_scope: false,
      minimum_link_distance_within_scope: null,
    };
    expect(validateCommerceResult(stable)).toEqual([]);
    expect(
      validateCommerceResult({ ...stable, minimum_link_distance_within_scope: 1 }).length,
    ).toBeGreaterThan(0);
    expect(validateCommerceResult({ ...stable, witness: REVERSED.witness }).length).toBeGreaterThan(0);
  });

  it("requires NOT_VERIFIED results to carry nulls, a typed reason, and no proof", () => {
    const timeout = {
      status: "NOT_VERIFIED",
      reason: "TIMEOUT",
      predicate: "clean_fulfilled_count >= K",
      threshold_k: 2,
      baseline: null,
      witness: null,
      coverage: {
        raw_worlds_total: 2,
        raw_worlds_checked: 1,
        invalid_worlds_total: null,
        invalid_worlds_checked: 0,
        admissible_worlds_total: null,
        admissible_worlds_checked: 1,
        checker_worlds_total: null,
        checker_worlds_checked: 0,
        fully_enumerated: false,
        checker_complete: false,
      },
      checker_status: "UNRUN",
      proof_basis: "NONE",
      minimum_distance_proven_within_scope: false,
      minimum_link_distance_within_scope: null,
    };
    expect(validateCommerceResult(timeout)).toEqual([]);
    expect(validateCommerceResult({ ...timeout, reason: null }).length).toBeGreaterThan(0);
    expect(
      validateCommerceResult({ ...timeout, baseline: { clean_fulfilled_count: 1, decision: false } })
        .length,
    ).toBeGreaterThan(0);
  });

  it("gates receipt eligibility on a current complete checker-passed run", () => {
    const base = {
      contract_version: "commerce.v1",
      session_id: "s",
      source_revision: 1,
      candidate_revision: 2,
      policy_revision: 1,
      review_sha256: "a".repeat(64),
    } as const;
    expect(
      isCommerceReceiptEligible({ ...base, state: "CHALLENGED", run_id: "r", result: REVERSED } as never),
    ).toBe(true);
    expect(
      isCommerceReceiptEligible({ ...base, state: "REVIEW_FROZEN", run_id: null, result: REVERSED } as never),
    ).toBe(false);
    expect(
      isCommerceReceiptEligible({ ...base, state: "CHALLENGED", run_id: "r", result: { ...REVERSED, status: "NOT_VERIFIED" } } as never),
    ).toBe(false);
    expect(isCommerceReceiptEligible(null)).toBe(false);
  });

  it("renders witness changes and decisions from data", () => {
    expect(
      commerceWitnessChangeText([
        { record_key: "delivery:D2", from_target_id: "O2", to_target_id: "O3" },
        { record_key: "payment:P9", from_target_id: null, to_target_id: "O1" },
      ]),
    ).toBe("delivery:D2: O2 → O3, payment:P9: unmatched → O1");
    expect(commerceDecisionText(2, 3, 2, true)).toBe("2 of 3 orders cleanly fulfilled — meets K=2.");
    expect(commerceDecisionText(1, 3, 2, false)).toBe(
      "1 of 3 orders cleanly fulfilled — does not meet K=2.",
    );
  });
});
