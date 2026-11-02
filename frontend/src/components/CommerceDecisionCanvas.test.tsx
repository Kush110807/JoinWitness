/** G4 focused regression: Commerce Decision Canvas is source-driven.
 *
 * Locks that Challenge renders the live server response only:
 * - baseline -> inspected change -> alternative, never hardcoded D2/O2/O3/K
 * - REVERSED vs STABLE vs NOT_VERIFIED honestly distinguished
 * - raw enums only under Technical evidence
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import CommerceDecisionCanvas from "./CommerceDecisionCanvas";
import type { CommerceChallengeResult } from "../lib/commerceApi";

function coverage() {
  return {
    raw_worlds_total: 4,
    raw_worlds_checked: 4,
    invalid_worlds_total: 1,
    invalid_worlds_checked: 1,
    admissible_worlds_total: 3,
    admissible_worlds_checked: 3,
    checker_worlds_total: 3,
    checker_worlds_checked: 3,
    fully_enumerated: true,
    checker_complete: true,
  };
}

function reversed(): CommerceChallengeResult {
  return {
    status: "REVERSED_EXHAUSTIVE",
    reason: null,
    predicate: "clean_fulfilled_count >= K",
    threshold_k: 1,
    baseline: { clean_fulfilled_count: 2, decision: true },
    witness: {
      reference_changes: [
        { record_key: "payment:P9", from_target_id: "O9", to_target_id: "O8" },
      ],
      clean_fulfilled_count: 0,
      decision: false,
      link_distance: 1,
    },
    coverage: coverage(),
    checker_status: "PASSED",
    proof_basis: "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION",
    minimum_distance_proven_within_scope: true,
    minimum_link_distance_within_scope: 1,
  };
}

describe("G4 Commerce Decision Canvas", () => {
  it("renders the live witness change, never hardcoded fixture IDs", async () => {
    render(<CommerceDecisionCanvas result={reversed()} orderCount={2} />);
    // Live IDs from the response
    expect(screen.getByTestId("commerce-decision-canvas")).toHaveTextContent("payment:P9");
    expect(screen.getByTestId("commerce-decision-canvas")).toHaveTextContent("O9");
    expect(screen.getByTestId("commerce-decision-canvas")).toHaveTextContent("O8");
    // Hardcoded G3 demo IDs must not appear as live output
    expect(screen.queryByText(/delivery:D2/)).toBeNull();
    expect(screen.getByTestId("commerce-decision-canvas")).not.toHaveTextContent("D2: O2 → O3");
    // Human headline leads; raw enum lives under Technical evidence
    expect(screen.getByText(/permitted alternative crosses K/i)).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByText(/technical evidence/i));
    expect(screen.getByText(/REVERSED_EXHAUSTIVE/)).toBeTruthy();
  });

  it("stable and inconclusive states never claim a reversal", () => {
    const stable: CommerceChallengeResult = {
      ...reversed(),
      status: "STABLE_WITHIN_SCOPE",
      witness: null,
      proof_basis: "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION",
      minimum_distance_proven_within_scope: false,
      minimum_link_distance_within_scope: null,
    };
    const { rerender } = render(<CommerceDecisionCanvas result={stable} orderCount={2} />);
    expect(screen.getByTestId("commerce-decision-canvas")).toHaveTextContent(/no decision reversal was found/i);
    expect(screen.queryByText(/fewest changed assignments/i)).toBeNull();

    rerender(
      <CommerceDecisionCanvas
        result={{
          ...stable,
          status: "NOT_VERIFIED",
          reason: "TIMEOUT",
          baseline: null,
          checker_status: "UNRUN",
          proof_basis: "NONE",
          coverage: { ...coverage(), fully_enumerated: false, checker_complete: false },
        }}
        orderCount={2}
      />,
    );
    expect(screen.getByTestId("commerce-decision-canvas")).toHaveTextContent(/analysis incomplete/i);
    expect(screen.queryByText(/fewest changed assignments/i)).toBeNull();
  });
});
