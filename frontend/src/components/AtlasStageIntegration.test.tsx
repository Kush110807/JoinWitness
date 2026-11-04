/** G4 Atlas unification: Import/Review/Verify stage integration.
 *
 * All backend traffic is intercepted with fetch mocks shaped like the frozen
 * transport. These prove UI behavior only — they are NOT evidence of a live
 * API or of any real analysis.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

const parseOk = {
  status: "PARSED_UNREVIEWED",
  registrations: [
    { registration_id: "R-A1", name: "Amara Shah", group: "A" },
    { registration_id: "R-A2", name: "Kim Rao", group: "A" },
    { registration_id: "R-B1", name: "Bryn Ellis", group: "B" },
    { registration_id: "R-B2", name: "Kym Rao", group: "B" },
  ],
  attendance: [
    { attendance_id: "T-01", recorded_name: "Amara Shah" },
    { attendance_id: "T-02", recorded_name: "Kim/Kym Rao" },
    { attendance_id: "T-03", recorded_name: "Bryn Ellis" },
  ],
  registrations_digest: {
    raw_sha256: "98c829b8d06caaf39e68ffe12f437c734291ccd2ce13da8e66deedb28747c2bf",
    row_count: 4,
  },
  attendance_digest: {
    raw_sha256: "c771e8ae9fd09b08f358ecf40678cf7ff53a448309fb927e1d2a3890be405ea3",
    row_count: 3,
  },
};

const validateOk = {
  status: "REVIEW_VALIDATED",
  coverage: "REVIEWED_CLOSED_SCOPE",
  review_sha256: "b".repeat(64),
  review_revision: 1,
  reference_sha256: "c".repeat(64),
  baseline_counts: { a: 2, b: 1, unmatched: 0, a_greater_than_b: true },
};

const analyzeFlagship = {
  status: "ANALYSIS_VERIFIED",
  coverage: "REVIEWED_CLOSED_SCOPE",
  baseline_counts: { a: 2, b: 1, unmatched: 0, a_greater_than_b: true },
  alternative_counts: { a: 1, b: 2, unmatched: 0, a_greater_than_b: false },
  witness_assignments: [
    ["T-01", "R-A1"],
    ["T-02", "R-B2"],
    ["T-03", "R-B1"],
  ],
  minimum_changed_assignments: 1,
  solver_status: "OPTIMAL",
  checker_status: "WITNESS_VALID",
  oracle_status: "ORACLE_REVERSIBLE",
  verdict: "REVERSIBLE_MINIMUM_PROVEN",
  proof_basis: "SOLVER_AND_SMALL_ORACLE",
  review_sha256: "b".repeat(64),
  reference_sha256: "c".repeat(64),
  receipt_sha256: "d".repeat(64),
  scope_caveat: "No real-world identity is determined.",
};

const receiptOk = {
  status: "RECEIPT_ISSUED",
  receipt: { receipt_sha256: "d".repeat(64), verdict: "REVERSIBLE_MINIMUM_PROVEN" },
};

const verifyOk = {
  status: "VERIFIED_REPLAY",
  verdict: "REVERSIBLE_MINIMUM_PROVEN",
  proof_basis: "SOLVER_AND_SMALL_ORACLE",
  receipt_sha256: "d".repeat(64),
  scope_caveat: "No real-world identity is determined.",
};

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data } as unknown as Response;
}

function queueResponses(responses: unknown[]) {
  globalThis.fetch = vi.fn().mockImplementation(async () => {
    const next = responses.shift() as unknown;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => next,
    }) as unknown as Response;
  });
}

async function loadDemoToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /try the fictional example/i }));
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: /which links are legitimately possible/i }),
    ).toBeTruthy(),
  );
}

async function waitForChallengeScene() {
  await waitFor(() =>
    expect(screen.getByRole("group", { name: /compare outcomes/i })).toBeTruthy(),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Atlas Import unification (Case A)", () => {
  it("renders the Atlas scene with source validation and no verdict pre-parse", async () => {
    queueResponses([parseOk]);
    render(<App />);
    const user = userEvent.setup();
    // Pre-parse Import is the Atlas scene (question + field + inspector).
    expect(
      screen.getByRole("heading", { name: /can one uncertain match change who came out ahead/i }),
    ).toBeTruthy();
    expect(screen.getByLabelText(/interactive uncertainty field/i)).toBeTruthy();
    expect(screen.queryByText(/REVERSIBLE_MINIMUM_PROVEN/)).toBeNull();
    expect(screen.getByRole("button", { name: /explore the verified event/i })).toBeTruthy();
    // Import advances to Review Atlas on demo load.
    await loadDemoToReview(user);
    expect(
      screen.getByRole("heading", { name: /which links are legitimately possible/i }),
    ).toBeTruthy();
    // Back to Import shows the server-validated source cards in the supplement.
    await user.click(screen.getByRole("button", { name: /back to import/i }));
    await waitFor(() => expect(screen.getByText(/PARSED_UNREVIEWED/)).toBeTruthy());
    expect(screen.getAllByText(/matches bundled original/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Registrations")).toBeTruthy();
    expect(screen.getByText("Attendance")).toBeTruthy();
  });

  it("keeps the investigation switcher reachable in bare Import", async () => {
    queueResponses([]);
    render(<App />);
    expect(screen.getByRole("button", { name: /case a · event decision/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /case b · commerce decision/i })).toBeTruthy();
  });
});

describe("Atlas Review unification (Case A)", () => {
  it("inspects uncertain relationships without backend calls or permissions", async () => {
    queueResponses([parseOk]);
    render(<App />);
    const user = userEvent.setup();
    await loadDemoToReview(user);
    const callsBefore = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length;
    // T-02 is uncertain; T-01 is settled.
    await user.click(screen.getByRole("button", { name: /inspect t-02, uncertain record/i }));
    const inspector = screen.getByRole("complementary", { name: /selected record inspector/i });
    expect(within(inspector).getByText("T-02")).toBeTruthy();
    expect(within(inspector).getByText(/possible link/i)).toBeTruthy();
    expect(screen.getByText(/inspection alone does not authorise/i)).toBeTruthy();
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(callsBefore);
    expect(screen.queryByText(/REVERSIBLE_MINIMUM_PROVEN/)).toBeNull();
    // Filters narrow visibility without backend calls.
    await user.click(screen.getByRole("button", { name: /1 uncertain/i }));
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(callsBefore);
  });

  it("adopts the prepared review and reaches Challenge without invented proof", async () => {
    queueResponses([parseOk, validateOk]);
    render(<App />);
    const user = userEvent.setup();
    await loadDemoToReview(user);
    await user.click(screen.getByRole("button", { name: /adopt fictional review rules/i }));
    await waitForChallengeScene();
    expect(screen.queryByText(/REVERSIBLE_MINIMUM_PROVEN/)).toBeNull();
    expect(screen.queryByText(/fewest changed assignments/i)).toBeNull();
  });
});

describe("Atlas Verify unification (Case A)", () => {
  it("issues and replays receipts through the real API in the Atlas scene", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/api/parse")) return okJson(parseOk);
      if (String(url).includes("/api/review/validate")) return okJson(validateOk);
      if (String(url).includes("/api/analyze")) return okJson(analyzeFlagship);
      if (String(url).includes("/api/receipt")) return okJson(receiptOk);
      if (String(url).includes("/api/verify")) return okJson(verifyOk);
      throw new Error(`unexpected fetch ${url}`);
    });
    render(<App />);
    const user = userEvent.setup();
    await loadDemoToReview(user);
    await user.click(screen.getByRole("button", { name: /adopt fictional review rules/i }));
    await waitForChallengeScene();
    await user.click(screen.getByRole("button", { name: /run challenge/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue to verify/i })).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: /continue to verify/i }));
    expect(
      screen.getByRole("heading", { name: /can anyone reproduce it/i }),
    ).toBeTruthy();
    expect(screen.queryByText(/we independently checked this alternative/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: /issue receipt/i }));
    await waitFor(() => expect(screen.getByText(/RECEIPT_ISSUED/)).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /verify replay/i }));
    await waitFor(() => expect(screen.getByText(/VERIFIED_REPLAY/)).toBeTruthy());
    expect(screen.getByText(/we independently checked this alternative/i)).toBeTruthy();
    expect(screen.getByText(/optimum is solver-proven| cross-checked by the small-case oracle/i)).toBeTruthy();
  });
});

const parseCommerce = {
  contract_version: "commerce.v1",
  state: "IMPORTED",
  session_id: "0".repeat(32),
  source_revision: 1,
  candidate_revision: 1,
  source_bundle_sha256: "e".repeat(64),
  file_sha256: {
    "orders.csv": "a".repeat(64),
    "payments.csv": "b".repeat(64),
    "deliveries.csv": "c".repeat(64),
    "refunds.csv": "d".repeat(64),
  },
  row_counts: { orders: 2, payments: 2, deliveries: 1, refunds: 0 },
  deterministic_candidates: [
    { record_key: "payment:P1", target_id: "O1", origin: "SOURCE_REF", authorised: false },
    { record_key: "payment:P2", target_id: "O2", origin: "SOURCE_REF", authorised: false },
    { record_key: "delivery:D1", target_id: "O1", origin: "SOURCE_REF", authorised: false },
  ],
  ai_status: "NOT_REQUESTED",
  limits: { orders: 50, each_other_file: 60, variables: 10, alternatives_per_variable: 2, raw_worlds: 4096 },
  validated_source_rows: {
    orders: [
      { source_row_number: 2, order_id: "O1", customer_id: "C1", order_total: "100.00", currency: "USD" },
      { source_row_number: 3, order_id: "O2", customer_id: "C2", order_total: "50.00", currency: "USD" },
    ],
    payments: [
      { source_row_number: 2, payment_id: "P1", order_ref: "O1", amount: "100.00", currency: "USD", status: "SETTLED" },
      { source_row_number: 3, payment_id: "P2", order_ref: "O2", amount: "50.00", currency: "USD", status: "SETTLED" },
    ],
    deliveries: [
      { source_row_number: 2, delivery_id: "D1", order_ref: "O1", status: "DELIVERED" },
    ],
    refunds: [],
  },
};

describe("Atlas Import unification (Case B)", () => {
  it("renders the Atlas scene with four-file validation and no verdict pre-parse", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => okJson(parseCommerce));
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /case b · commerce decision/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /are at least k of n orders/i })).toBeTruthy(),
    );
    expect(screen.getByLabelText(/interactive uncertainty field/i)).toBeTruthy();
    expect(screen.queryByText(/REVERSED_EXHAUSTIVE|STABLE_WITHIN_SCOPE/)).toBeNull();
    expect(screen.getByRole("button", { name: /explore fictional commerce example/i })).toBeTruthy();
    expect(screen.getByLabelText(/upload orders\.csv/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /explore fictional commerce example/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /adopt & freeze review/i })).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: /back to import/i }));
    await waitFor(() => expect(screen.getByText(/IMPORTED/)).toBeTruthy());
    expect(screen.getByText(/source bundle sha-256/i)).toBeTruthy();
    expect(screen.getByText(/orders layer/i)).toBeTruthy();
    expect(screen.getByText(/refunds layer/i)).toBeTruthy();
  });
});
