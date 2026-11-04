/** G4 presentation-only contract: source data and user authority remain separate. */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import RelationshipField from "./RelationshipField";
import DecisionShift from "./DecisionShift";
import AtlasSignal from "./AtlasSignal";
import type { CommerceCatalogTarget } from "../lib/commerceDraft";

const targets: CommerceCatalogTarget[] = [
  { recordKey: "delivery:D77", recordType: "delivery", recordId: "D77", targetId: "O12", targetType: "order", origins: ["SOURCE_REF"], metaEvidence: [], manualReason: null },
  { recordKey: "delivery:D77", recordType: "delivery", recordId: "D77", targetId: "O19", targetType: "order", origins: ["MANUAL"], metaEvidence: [], manualReason: "Plausible link" },
];

describe("Decision Atlas presentation-only diagrams", () => {
  it("renders current draft relationships without a button that could authorise them", () => {
    const { container } = render(
      <RelationshipField recordKey="delivery:D77" sourceHint="O12" targets={targets}
        dispositionFor={id => id === "O12" ? "CONFIRMED" : "POSSIBLE"} baselineTarget="O12" />,
    );
    expect(screen.getByTestId("atlas-relationship-field")).toHaveTextContent("O12");
    expect(screen.getByTestId("atlas-relationship-field")).toHaveTextContent("O19");
    expect(screen.getByTestId("atlas-relationship-field")).toHaveTextContent(/does not approve/i);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
  it("shows data-driven before/after counts, not fixture-specific numbers", () => {
    render(<DecisionShift baseline={{ clean_fulfilled_count: 7, decision: true }}
      alternative={{ clean_fulfilled_count: 3, decision: false }} total={9} thresholdK={5} changedLinks={2}/>);
    expect(screen.getByRole("img", { name: /moves from 7 to 3 of 9 orders/i })).toBeTruthy();
    expect(screen.getByText(/2 links changed/)).toBeTruthy();
    expect(screen.getByText(/server challenge/i)).toBeTruthy();
  });
  it("labels the entry visual as illustrative rather than a verified output", () => {
    render(<AtlasSignal mode="commerce"/>);
    expect(screen.getByText("ILLUSTRATIVE")).toBeTruthy();
    expect(screen.getByText("Not a verified result")).toBeTruthy();
  });
});
