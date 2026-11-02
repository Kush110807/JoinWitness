/** G4 focused regression: Commerce Review workbench (queue + canvas + inspector).
 *
 * Locks the approved Decision Atlas contract:
 * - compact navigable queue, one selected relationship canvas, contextual inspector
 * - selecting a record only inspects (never authorises)
 * - all contract fields remain possible for the selected record
 * - progress reflects review actions, never selection
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CommerceReviewEditor from "./CommerceReviewEditor";
import type { CommerceCatalogTarget } from "../lib/commerceDraft";

function targets(): CommerceCatalogTarget[] {
  return [
    {
      recordKey: "payment:P1",
      recordType: "payment",
      recordId: "P1",
      targetId: "O1",
      targetType: "order",
      origins: ["SOURCE_REF"],
      metaEvidence: [],
      manualReason: null,
    },
    {
      recordKey: "payment:P1",
      recordType: "payment",
      recordId: "P1",
      targetId: "O2",
      targetType: "order",
      origins: ["META_SUGGESTED"],
      metaEvidence: [{ evidence: "alias", serverCallId: "c1" }],
      manualReason: null,
    },
    {
      recordKey: "delivery:D1",
      recordType: "delivery",
      recordId: "D1",
      targetId: "O1",
      targetType: "order",
      origins: ["SOURCE_REF"],
      metaEvidence: [],
      manualReason: null,
    },
  ];
}

function baseProps(overrides: Partial<Parameters<typeof CommerceReviewEditor>[0]> = {}) {
  const all = targets();
  const edges: Record<string, Record<string, "CONFIRMED" | "POSSIBLE" | "PROHIBITED">> = {
    "payment:P1": { O1: "POSSIBLE", O2: "PROHIBITED" },
    "delivery:D1": {},
  };
  return {
    records: [
      { recordKey: "payment:P1", recordLabel: "100.00 USD · SETTLED", sourceHint: "O1", sourceRowNumber: 2 },
      { recordKey: "delivery:D1", recordLabel: "DELIVERED", sourceHint: "O1", sourceRowNumber: 2 },
    ],
    targetsFor: (key: string) => all.filter((t) => t.recordKey === key),
    dispositionFor: (key: string, target: string) => edges[key]?.[target] ?? "PROHIBITED",
    unmatchedFor: () => "PROHIBITED" as const,
    onEdge: vi.fn(),
    onUnmatched: vi.fn(),
    onSeedRow: vi.fn(),
    baselineFor: () => undefined,
    baselineOptions: (key: string) => [
      ...(key === "payment:P1"
        ? [
            { value: "O1", label: "O1", allowed: true },
            { value: "O2", label: "O2", allowed: false },
          ]
        : [{ value: "O1", label: "O1", allowed: false }]),
      { value: null, label: "unmatched", allowed: false },
    ],
    onBaseline: vi.fn(),
    manual: [],
    onAddManual: vi.fn(() => null),
    onRemoveManual: vi.fn(),
    orderIds: ["O1", "O2"],
    paymentIds: [],
    thresholdK: 1,
    orderCount: 2,
    onThresholdK: vi.fn(),
    reviewerLabel: "",
    onReviewerLabel: vi.fn(),
    attestation: {
      all_rows_reviewed: false,
      understands_bounded_predicate: false,
      conflicting_source_ref_overrides_explained: false,
    },
    onAttestation: vi.fn(),
    baselinePreview: { assignments: [], warnings: [] },
    blockedRows: ["delivery:D1"],
    adoptedReviewSha: null,
    isDirty: true,
    epochs: { sourceRevision: 1, candidateRevision: 1, policyRevision: 0 },
    onAdopt: vi.fn(),
    adoptBusy: false,
    ...overrides,
  };
}

describe("G4 Commerce Review workbench", () => {
  it("renders a compact queue, one selected canvas, and a contextual inspector", () => {
    render(<CommerceReviewEditor {...baseProps()} />);
    // Queue: navigable, both records listed once
    const queue = screen.getByRole("listbox", { name: /source queue/i });
    const options = within(queue).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("payment:P1"), expect.stringContaining("delivery:D1")]),
    );
    // Center: only the selected record relationship is shown as the working canvas
    expect(screen.getByTestId("commerce-relationship-canvas")).toHaveTextContent("payment:P1");
    expect(screen.queryByTestId("commerce-relationship-canvas")).not.toHaveTextContent("delivery:D1");
    // Inspector: contextual controls for the selected record only
    const inspector = screen.getByRole("form", { name: /decision inspector/i });
    expect(within(inspector).getByLabelText(/link disposition for payment:P1 to O1/i)).toBeTruthy();
    expect(within(inspector).queryByLabelText(/link disposition for delivery:D1 to O1/i)).toBeNull();
    // Summary: honest progress from review actions (1 blocked), K + adopt visible
    expect(screen.getByTestId("commerce-review-summary")).toHaveTextContent(/1.*needs a decision/i);
    expect(screen.getByLabelText("Threshold K")).toBeTruthy();
    expect(screen.getByRole("button", { name: /adopt & freeze review/i })).toBeTruthy();
  });

  it("inspector sheet closes on Escape and returns focus to its trigger", async () => {
    render(<CommerceReviewEditor {...baseProps()} />);
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: /review decisions for payment:P1/i });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: /decision inspector/i })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /decision inspector/i })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("selecting a queue record only inspects and never authorises", async () => {
    const props = baseProps();
    render(<CommerceReviewEditor {...props} />);
    const user = userEvent.setup();
    const queue = screen.getByRole("listbox", { name: /source queue/i });
    await user.click(within(queue).getByRole("option", { name: /delivery:D1/i }));
    // Canvas + inspector follow the selection
    expect(screen.getByTestId("commerce-relationship-canvas")).toHaveTextContent("delivery:D1");
    expect(
      within(screen.getByRole("form", { name: /decision inspector/i })).getByLabelText(
        /unmatched rule for delivery:D1/i,
      ),
    ).toBeTruthy();
    // No permission changed: edge/unmatched/baseline/adopt callbacks untouched
    expect(props.onEdge).not.toHaveBeenCalled();
    expect(props.onUnmatched).not.toHaveBeenCalled();
    expect(props.onBaseline).not.toHaveBeenCalled();
    expect(props.onAdopt).not.toHaveBeenCalled();
  });
});
