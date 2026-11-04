/** G4-B03: one-click fictional commerce example.
 *
 * One click loads the byte-exact fictional fixtures through the real frozen
 * `commerce.v1` parse route and lands in Review with server-returned data.
 * Import grants no permission, policy, or attestation: every human decision
 * stays explicit in the Review Workbench.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import {
  FICTIONAL_COMMERCE_BLURB,
  loadFictionalCommerceFiles,
} from "../lib/commerceExample";

// Expected literals below were verified byte-identical to the authoritative
// fixtures/commerce_demo/*.csv (LF, trailing newline; lengths 92/118/78/57;
// SHA-256 8063a0ea…/9dbac299…/e02c9978…/aae37407… matching MANIFEST.json).
const EXPECTED_FIXTURE_TEXT: Record<string, string> = {
  "orders.csv":
    "order_id,customer_id,order_total,currency\nO1,C1,100.00,USD\nO2,C2,100.00,USD\nO3,C3,80.00,USD\n",
  "payments.csv":
    "payment_id,order_ref,amount,currency,status\nP1,O1,100.00,USD,SETTLED\nP2,O2,100.00,USD,SETTLED\nP3,O3,80.00,USD,SETTLED\n",
  "deliveries.csv":
    "delivery_id,order_ref,status\nD1,O1,DELIVERED\nD2,O2,DELIVERED\nD3,O3,IN_TRANSIT\n",
  "refunds.csv": "refund_id,payment_ref,amount,status\nR1,P3,5.00,COMPLETED\n",
};

function b64ToText(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const parseOk = {
  contract_version: "commerce.v1",
  state: "IMPORTED",
  session_id: "1".repeat(32),
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

const validateOk = {
  contract_version: "commerce.v1",
  session_id: "1".repeat(32),
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

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data } as unknown as Response;
}
function errJson(status: number, data: unknown) {
  return { ok: false, status, json: async () => data } as unknown as Response;
}

async function switchToCommerce(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /case b · commerce decision/i }));
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: /are at least k of n orders/i })).toBeTruthy(),
  );
}

async function clickExample(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /explore fictional commerce example/i }));
  await waitForReviewScene();
}

/** Review renders the prototype-faithful scene: the Adopt action marks it. */
async function waitForReviewScene() {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /adopt & freeze review/i })).toBeTruthy(),
  );
}

/** Challenge renders the scene with run controls: the time budget marks it. */
async function waitForChallengeScene() {
  await waitFor(() =>
    expect(screen.getByLabelText(/time budget in milliseconds/i)).toBeTruthy(),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("G4-B03 bundled fictional fixtures", () => {
  it("loads the exact four authoritative fixture byte sequences", () => {
    const bundled = loadFictionalCommerceFiles();
    expect(bundled.map((f) => f.fileName)).toEqual([
      "orders.csv",
      "payments.csv",
      "deliveries.csv",
      "refunds.csv",
    ]);
    for (const f of bundled) {
      expect(f.text).toBe(EXPECTED_FIXTURE_TEXT[f.fileName]);
      expect(b64ToText(f.b64)).toBe(EXPECTED_FIXTURE_TEXT[f.fileName]);
    }
    expect(FICTIONAL_COMMERCE_BLURB).toContain("One delivery may belong to a different order");
  });
});

describe("G4-B03 one-click example import", () => {
  it("sends the frozen commerce.v1 parse wire format with exact bytes", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return okJson(parseOk);
    });
    render(<App />);
    const user = userEvent.setup();
    await switchToCommerce(user);
    await clickExample(user);
    expect(calls.length).toBe(1);
    expect(calls[0].url).toContain("/api/commerce/v1/parse");
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["X-JW-Local-Request"]).toBe("1");
    const body = JSON.parse(String(calls[0].init.body)) as {
      contract_version: string;
      files: Record<string, { content_base64: string }>;
    };
    expect(body.contract_version).toBe("commerce.v1");
    for (const name of ["orders.csv", "payments.csv", "deliveries.csv", "refunds.csv"]) {
      expect(b64ToText(body.files[name].content_base64)).toBe(EXPECTED_FIXTURE_TEXT[name]);
    }
  });

  it("opens Review with server-returned data and a fictional label", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => okJson(parseOk));
    render(<App />);
    const user = userEvent.setup();
    await switchToCommerce(user);
    expect(screen.getByText(/fictional demonstration data/i)).toBeTruthy();
    await clickExample(user);
    expect(screen.getByRole("button", { name: /inspect payment:P1/i })).toBeTruthy();
    expect(screen.getByText(/fictional demonstration data · not real business information/i)).toBeTruthy();
  });

  it("grants no permission, policy freeze, or attestation", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => okJson(parseOk));
    render(<App />);
    const user = userEvent.setup();
    await switchToCommerce(user);
    await clickExample(user);
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(1);
    expect((screen.getByLabelText("Threshold K") as HTMLInputElement).value).toBe("");
    for (const name of [/reviewed every source record/i, /bounded clean-fulfilment rule/i, /conflicting source-reference overrides/i]) {
      expect((screen.getByRole("checkbox", { name }) as HTMLInputElement).checked).toBe(false);
    }
    const inspector = screen.getByRole("form", { name: /decision inspector/i });
    expect(
      (within(inspector).getByLabelText(/link disposition for delivery:D1 to O1/i) as HTMLSelectElement).value,
    ).toBe("PROHIBITED");
    const k = screen.getByLabelText("Threshold K");
    await user.clear(k);
    await user.type(k, "1");
    await user.type(screen.getByLabelText("Reviewer label"), "example-reviewer");
    await user.click(screen.getByRole("button", { name: /adopt & freeze review/i }));
    await waitFor(() => expect(screen.getByText(/ATTESTATION_INCOMPLETE/)).toBeTruthy());
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(1);
    expect(screen.getByRole("button", { name: /adopt & freeze review/i })).toBeTruthy();
  });

  it("keeps manual four-file import working", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => okJson(parseOk));
    render(<App />);
    const user = userEvent.setup();
    await switchToCommerce(user);
    await user.click(screen.getByRole("button", { name: /upload my own four csv files/i }));
    const uploads: Array<[RegExp, string, string]> = [
      [/upload orders\.csv/i, "orders.csv", "order_id,customer_id,order_total,currency\nO1,C1,100.00,USD\n"],
      [/upload payments\.csv/i, "payments.csv", "payment_id,order_ref,amount,currency,status\nP1,O1,100.00,USD,SETTLED\n"],
      [/upload deliveries\.csv/i, "deliveries.csv", "delivery_id,order_ref,status\nD1,O1,DELIVERED\n"],
      [/upload refunds\.csv/i, "refunds.csv", "refund_id,payment_ref,amount,status\n"],
    ];
    for (const [label, name, text] of uploads) {
      await user.upload(screen.getByLabelText(label), new File([text], name, { type: "text/csv" }));
    }
    await user.click(screen.getByRole("button", { name: /import and parse four csvs/i }));
    await waitForReviewScene();
    expect(screen.queryByText(/fictional demonstration data · not real business information/i)).toBeNull();
  });

  it("shows a backend parse error without advancing", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () =>
      errJson(422, {
        error: { code: "COMMERCE_CSV_INVALID", message: "bad header", path: "files", details: {} },
        verified: false,
      }),
    );
    render(<App />);
    const user = userEvent.setup();
    await switchToCommerce(user);
    await user.click(screen.getByRole("button", { name: /explore fictional commerce example/i }));
    await waitFor(() => expect(screen.getByText(/COMMERCE_CSV_INVALID/)).toBeTruthy());
    expect(screen.getByRole("heading", { name: /which four files are we testing/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /inspect payment:P1/i })).toBeNull();
  });

  it("rapid repeated clicks trigger a single active import", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => okJson(parseOk));
    render(<App />);
    const user = userEvent.setup();
    await switchToCommerce(user);
    const btn = screen.getByRole("button", { name: /explore fictional commerce example/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitForReviewScene();
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(1);
  });

  it("switching investigations is locked mid-flight and drops commerce state", async () => {
    let resolveParse!: (value: unknown) => void;
    const gate = new Promise<unknown>((resolve) => {
      resolveParse = resolve;
    });
    globalThis.fetch = vi.fn().mockImplementation(async () => gate as unknown as Response);
    render(<App />);
    const user = userEvent.setup();
    await switchToCommerce(user);
    const btn = screen.getByRole("button", { name: /explore fictional commerce example/i });
    fireEvent.click(btn);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    // Scenario switching is disabled while the import is in flight: no stale
    // navigation is possible, so the pending response cannot land elsewhere.
    expect(
      (screen.getByRole("button", { name: /case a · event decision/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    resolveParse(okJson(parseOk));
    await waitForReviewScene();
    // Commerce mounts separately: leaving and returning starts over, with no
    // reused session, review, or proof state. Case switching lives on the
    // full shell, so the flow returns via Import before switching.
    await user.click(screen.getByRole("button", { name: /back to import/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /which four files are we testing/i })).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: /case a · event decision/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /can one uncertain match change/i })).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: /case b · commerce decision/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /are at least k of n orders/i })).toBeTruthy(),
    );
    expect(screen.queryByRole("button", { name: /adopt & freeze review/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /inspect payment:P1/i })).toBeNull();
  });

  it("restarting the example starts a fresh investigation", async () => {
    const sessions = ["a".repeat(32), "b".repeat(32)];
    let n = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/commerce/v1/parse")) {
        const session = sessions[Math.min(n, 1)];
        n += 1;
        return okJson({ ...parseOk, session_id: session });
      }
      if (u.includes("/api/commerce/v1/review/validate")) return okJson(validateOk);
      throw new Error(`unexpected fetch ${u}`);
    });
    render(<App />);
    const user = userEvent.setup();
    await switchToCommerce(user);
    await clickExample(user);
    const k = screen.getByLabelText("Threshold K");
    await user.clear(k);
    await user.type(k, "1");
    await user.type(screen.getByLabelText("Reviewer label"), "example-reviewer");
    await user.click(screen.getByRole("checkbox", { name: /reviewed every source record/i }));
    await user.click(screen.getByRole("checkbox", { name: /bounded clean-fulfilment rule/i }));
    await user.click(screen.getByRole("checkbox", { name: /conflicting source-reference overrides/i }));
    await user.click(screen.getByRole("button", { name: /seed all source hints as possible/i }));
    await user.click(screen.getByRole("button", { name: /adopt & freeze review/i }));
    await waitForChallengeScene();
    await user.click(screen.getByRole("button", { name: /back to review/i }));
    await waitForReviewScene();
    await user.click(screen.getByRole("button", { name: /back to import/i }));
    await user.click(screen.getByRole("button", { name: /clear commerce import/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /explore fictional commerce example/i })).toBeTruthy(),
    );
    await clickExample(user);
    expect(screen.queryByText(/reviewed and frozen/i)).toBeNull();
    expect((screen.getByLabelText("Threshold K") as HTMLInputElement).value).toBe("");
    const parseCalls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter(
      (c) => String(c[0]).includes("/api/commerce/v1/parse"),
    );
    expect(parseCalls.length).toBe(2);
  });
});
