/** Mocked UI tests for the Decision Atlas launcher and Case B commerce flow.
 *
 * All backend traffic is intercepted with fetch mocks shaped like the frozen
 * transport. These prove UI behavior only — they are NOT evidence of a live
 * Commerce API or of any real analysis.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

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
  limits: {
    orders: 50,
    each_other_file: 60,
    variables: 10,
    alternatives_per_variable: 2,
    raw_worlds: 4096,
  },
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

const validateCommerce = {
  contract_version: "commerce.v1",
  session_id: "0".repeat(32),
  state: "REVIEW_FROZEN",
  source_revision: 1,
  candidate_revision: 1,
  policy_revision: 1,
  candidate_catalog_sha256: "c".repeat(64),
  source_bundle_sha256: "e".repeat(64),
  policy_sha256: "f".repeat(64),
  baseline_sha256: "b".repeat(64),
  review_sha256: "a".repeat(64),
  threshold_k: 1,
  raw_worlds: 1,
  admissible_worlds: 1,
  invalid_worlds: 0,
  variable_records: 0,
  baseline_valid: true,
  authorised_by: "HUMAN_REVIEW_ATTESTED_NOT_IDENTITY_VERIFIED",
};

const challengeTimeout = {
  contract_version: "commerce.v1",
  session_id: "0".repeat(32),
  state: "REVIEW_FROZEN",
  run_id: null,
  source_revision: 1,
  candidate_revision: 1,
  policy_revision: 1,
  review_sha256: "a".repeat(64),
  result: {
    status: "NOT_VERIFIED",
    reason: "TIMEOUT",
    predicate: "clean_fulfilled_count >= K",
    threshold_k: 1,
    baseline: null,
    witness: null,
    coverage: {
      raw_worlds_total: 1,
      raw_worlds_checked: 0,
      invalid_worlds_total: null,
      invalid_worlds_checked: 0,
      admissible_worlds_total: null,
      admissible_worlds_checked: 0,
      checker_worlds_total: null,
      checker_worlds_checked: 0,
      fully_enumerated: false,
      checker_complete: false,
    },
    checker_status: "UNRUN",
    proof_basis: "NONE",
    minimum_distance_proven_within_scope: false,
    minimum_link_distance_within_scope: null,
  },
};

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data } as unknown as Response;
}

function errJson(status: number, data: unknown) {
  return { ok: false, status, json: async () => data } as unknown as Response;
}

const CSVS: Array<[RegExp, string, string]> = [
  [/upload orders\.csv/i, "orders.csv", "order_id,customer_id,order_total,currency\nO1,C1,100.00,USD\nO2,C2,50.00,USD\n"],
  [/upload payments\.csv/i, "payments.csv", "payment_id,order_ref,amount,currency,status\nP1,O1,100.00,USD,SETTLED\nP2,O2,50.00,USD,SETTLED\n"],
  [/upload deliveries\.csv/i, "deliveries.csv", "delivery_id,order_ref,status\nD1,O1,DELIVERED\n"],
  [/upload refunds\.csv/i, "refunds.csv", "refund_id,payment_ref,amount,status\n"],
];

async function switchToCommerce(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /case b · commerce decision/i }));
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: /are at least k of n orders/i })).toBeTruthy(),
  );
}

async function uploadFour(user: ReturnType<typeof userEvent.setup>) {
  for (const [label, name, text] of CSVS) {
    await user.upload(screen.getByLabelText(label), new File([text], name, { type: "text/csv" }));
  }
}

async function importCommerce(user: ReturnType<typeof userEvent.setup>) {
  await switchToCommerce(user);
  await uploadFour(user);
  await user.click(screen.getByRole("button", { name: /import and parse four csvs/i }));
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: /which links may be considered/i }),
    ).toBeTruthy(),
  );
}

async function fillAndAdopt(user: ReturnType<typeof userEvent.setup>) {
  const k = screen.getByLabelText("Threshold K");
  await user.clear(k);
  await user.type(k, "1");
  await user.type(screen.getByLabelText("Reviewer label"), "mock-reviewer");
  await user.click(screen.getByRole("checkbox", { name: /reviewed every source record/i }));
  await user.click(screen.getByRole("checkbox", { name: /bounded clean-fulfilment rule/i }));
  await user.click(screen.getByRole("checkbox", { name: /conflicting source-reference overrides/i }));
  await user.click(
    screen.getByRole("button", { name: /seed all source hints as possible/i }),
  );
  await user.click(screen.getByRole("button", { name: /adopt & freeze review/i }));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("G2-C01 Decision Atlas launcher", () => {
  it("offers both genuine investigations with the event path as default", async () => {
    globalThis.fetch = vi.fn();
    render(<App />);
    const user = userEvent.setup();
    const caseA = screen.getByRole("button", { name: /case a · event decision/i });
    const caseB = screen.getByRole("button", { name: /case b · commerce decision/i });
    expect(caseA.getAttribute("aria-pressed")).toBe("true");
    expect(caseB.getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.getByRole("heading", { name: /can one uncertain match change who came out ahead/i }),
    ).toBeTruthy();

    await user.click(caseB);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /are at least k of n orders/i })).toBeTruthy(),
    );
    expect(screen.getByLabelText(/upload orders\.csv/i)).toBeTruthy();
    expect(screen.getByLabelText(/upload refunds\.csv/i)).toBeTruthy();
    // Switching performs no backend call and shows no verdict.
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0);
    expect(screen.queryByText(/REVERSED_EXHAUSTIVE|STABLE_WITHIN_SCOPE/)).toBeNull();

    await user.click(screen.getByRole("button", { name: /case a · event decision/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /can one uncertain match change who came out ahead/i }),
      ).toBeTruthy(),
    );
  });
});

describe("G2-C01 commerce unavailable and import honesty", () => {
  it("requires all four files before parsing", async () => {
    globalThis.fetch = vi.fn();
    render(<App />);
    const user = userEvent.setup();
    await switchToCommerce(user);
    await user.click(screen.getByRole("button", { name: /import and parse four csvs/i }));
    await waitFor(() => expect(screen.getByText(/SELECT_ALL_FOUR_CSV_FILES/)).toBeTruthy());
    expect(
      (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length,
    ).toBe(0);
  });

  it("missing router renders an integration-pending state, never a success", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => errJson(404, { detail: "Not Found" }));
    render(<App />);
    const user = userEvent.setup();
    await switchToCommerce(user);
    await uploadFour(user);
    await user.click(screen.getByRole("button", { name: /import and parse four csvs/i }));
    await waitFor(() => expect(screen.getByText(/HTTP_404/)).toBeTruthy());
    expect(screen.getByText(/router is not integrated in this build/i)).toBeTruthy();
    expect(screen.getByText(/no analysis was run/i)).toBeTruthy();
    expect(screen.queryByText(/IMPORTED/)).toBeNull();
    expect(screen.queryByText(/source bundle sha-256/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /continue to review/i })).toBeNull();
  });

  it("successful parse renders the server-validated inspector with unreviewed hints", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => okJson(parseCommerce));
    render(<App />);
    const user = userEvent.setup();
    await importCommerce(user);
    await user.click(screen.getByRole("button", { name: /back to import/i }));
    await waitFor(() => expect(screen.getByText(/IMPORTED/)).toBeTruthy());
    expect(screen.getByText(/source bundle sha-256/i)).toBeTruthy();
    expect(screen.getByText(/orders layer/i)).toBeTruthy();
    expect(screen.getByText(/refunds layer/i)).toBeTruthy();
    expect(screen.getAllByText(/unreviewed — not permitted/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/permitted under/i)).toBeNull();
    expect(screen.queryByText(/REVERSED_EXHAUSTIVE|STABLE_WITHIN_SCOPE/)).toBeNull();
  });
});

describe("G2-C01 commerce human-only adoption and inconclusive challenge", () => {
  it("failed adoption surfaces the backend code with no frozen review", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/api/commerce/v1/parse")) return okJson(parseCommerce);
      return errJson(409, {
        error: { code: "STALE_STATE", message: "stale", path: "expected_candidate_revision", details: {} },
        verified: false,
      });
    });
    render(<App />);
    const user = userEvent.setup();
    await importCommerce(user);
    await fillAndAdopt(user);
    await waitFor(() => expect(screen.getByText(/STALE_STATE/)).toBeTruthy());
    expect(screen.queryByText(/REVIEW_FROZEN/)).toBeNull();
    expect(
      screen.getByRole("heading", { name: /which links may be considered/i }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /run challenge/i })).toBeNull();
  });

  it("NOT_VERIFIED challenge stays inconclusive with receipt export disabled", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/api/commerce/v1/parse")) return okJson(parseCommerce);
      if (String(url).includes("/api/commerce/v1/review/validate")) return okJson(validateCommerce);
      if (String(url).includes("/api/commerce/v1/challenge")) return okJson(challengeTimeout);
      throw new Error(`unexpected fetch ${url}`);
    });
    render(<App />);
    const user = userEvent.setup();
    await importCommerce(user);
    await fillAndAdopt(user);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /could the conclusion reverse/i })).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: /run challenge/i }));
    await waitFor(() =>
      expect(screen.getAllByText(/analysis incomplete/i).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText(/TIMEOUT/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/fewest changed assignments/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: /continue to verify/i }));
    const exportBtn = screen.getByRole("button", { name: /export receipt/i });
    expect(exportBtn).toHaveProperty("disabled", true);
  });
});

describe("G2-C02 re-adopt revision regression (PRE-009)", () => {
  function staleError() {
    return errJson(409, {
      error: {
        code: "STALE_STATE",
        message: "Candidate revision no longer matches registered suggestions.",
        path: "expected_candidate_revision",
        details: {},
      },
      verified: false,
    });
  }

  /** CAS-enforcing server mock: rejects any review whose revisions are not current. */
  function casReviewMock(
    server: { candidate: number; policy: number },
    reviewBodies: Array<Record<string, unknown>>,
  ) {
    return async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/commerce/v1/parse")) return okJson(parseCommerce);
      if (u.includes("/api/commerce/v1/review/validate")) {
        const body = JSON.parse(String((init as { body: string }).body)) as Record<string, unknown>;
        reviewBodies.push(body);
        if (
          body.expected_candidate_revision !== server.candidate ||
          body.expected_policy_revision !== server.policy
        ) {
          return staleError();
        }
        server.candidate = 2;
        server.policy += 1;
        return okJson({
          ...validateCommerce,
          candidate_revision: 2,
          policy_revision: server.policy,
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };
  }

  async function adoptThenEdit(user: ReturnType<typeof userEvent.setup>) {
    await importCommerce(user);
    await fillAndAdopt(user);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /could the conclusion reverse/i })).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: /back to review/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /which links may be considered/i }),
      ).toBeTruthy(),
    );
    const k = screen.getByLabelText("Threshold K");
    await user.clear(k);
    await user.type(k, "2");
  }

  it("repeated valid adoption echoes the server current revisions (2,1)", async () => {
    const server = { candidate: 1, policy: 0 };
    const reviewBodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = vi.fn().mockImplementation(casReviewMock(server, reviewBodies));
    render(<App />);
    const user = userEvent.setup();
    await adoptThenEdit(user);
    await user.click(screen.getByRole("button", { name: /adopt & freeze review/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /could the conclusion reverse/i })).toBeTruthy(),
    );
    expect(reviewBodies.length).toBe(2);
    expect(reviewBodies[0].expected_candidate_revision).toBe(1);
    expect(reviewBodies[0].expected_policy_revision).toBe(0);
    expect(reviewBodies[1].expected_candidate_revision).toBe(2);
    expect(reviewBodies[1].expected_policy_revision).toBe(1);
    expect(screen.queryByText(/STALE_STATE/)).toBeNull();
  });

  it("genuinely stale re-adoption still fails closed with STALE_STATE", async () => {
    const server = { candidate: 1, policy: 0 };
    const reviewBodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = vi.fn().mockImplementation(casReviewMock(server, reviewBodies));
    render(<App />);
    const user = userEvent.setup();
    await adoptThenEdit(user);
    // Server-side advancement the client cannot see (e.g. revoked provenance).
    server.candidate = 3;
    await user.click(screen.getByRole("button", { name: /adopt & freeze review/i }));
    await waitFor(() => expect(screen.getByText(/STALE_STATE/)).toBeTruthy());
    expect(reviewBodies.length).toBe(2);
    // The client sent its best-known authoritative revisions; the server genuinely rejected them.
    expect(reviewBodies[1].expected_candidate_revision).toBe(2);
    expect(reviewBodies[1].expected_policy_revision).toBe(1);
    expect(screen.queryByText(/REVIEW_FROZEN/)).toBeNull();
    expect(
      screen.getByRole("heading", { name: /which links may be considered/i }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /run challenge/i })).toBeNull();
  });
});
