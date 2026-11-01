/** Mocked transport-shape tests for the frozen commerce.v1 adapter.
 *
 * These verify exact request fields, headers, routes, and error-envelope
 * parsing against injectable fetch mocks. They are NOT evidence of a live
 * backend: no real Commerce API is contacted here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMMERCE_BASE,
  COMMERCE_COVERAGE_KEYS,
  CommerceApiError,
  commerceChallenge,
  commerceParse,
  commerceReceipt,
  commerceReplay,
  commerceReviewValidate,
  commerceSuggest,
  isCommerceRouterMissing,
} from "./commerceApi";

type FetchMock = ReturnType<typeof vi.fn>;

function lastCall(): { url: string; init: RequestInit; body: Record<string, unknown> } {
  const mock = globalThis.fetch as unknown as FetchMock;
  const [url, init] = mock.mock.calls[0] as [string, RequestInit];
  return { url, init, body: JSON.parse(String(init.body)) as Record<string, unknown> };
}

function mockOk(payload: unknown) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  } as unknown as Response);
}

function mockErr(status: number, payload: unknown) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => payload,
  } as unknown as Response);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("commerce.v1 exact request shapes", () => {
  it("parse posts the four named byte-exact files with the local-only header", async () => {
    mockOk({ contract_version: "commerce.v1" });
    await commerceParse({
      "orders.csv": { content_base64: "T0l==" },
      "payments.csv": { content_base64: "UDA=" },
      "deliveries.csv": { content_base64: "RDA=" },
      "refunds.csv": { content_base64: "UjA=" },
    });
    const { url, init, body } = lastCall();
    expect(url).toBe(`${COMMERCE_BASE}/parse`);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "content-type": "application/json",
      "X-JW-Local-Request": "1",
    });
    expect(body.contract_version).toBe("commerce.v1");
    expect(Object.keys(body.files as object).sort()).toEqual([
      "deliveries.csv",
      "orders.csv",
      "payments.csv",
      "refunds.csv",
    ]);
  });

  it("suggest sends the frozen seven fields including expected_policy_revision", async () => {
    mockOk({ contract_version: "commerce.v1" });
    await commerceSuggest({
      contract_version: "commerce.v1",
      session_id: "s",
      expected_source_revision: 1,
      expected_candidate_revision: 1,
      expected_policy_revision: 0,
      mode: "META",
      max_suggestions: 5,
    });
    const { url, body } = lastCall();
    expect(url).toBe(`${COMMERCE_BASE}/suggest`);
    expect(Object.keys(body).sort()).toEqual(
      [
        "contract_version",
        "session_id",
        "expected_source_revision",
        "expected_candidate_revision",
        "expected_policy_revision",
        "mode",
        "max_suggestions",
      ].sort(),
    );
    expect(body.mode).toBe("META");
  });

  it("review/validate sends the complete replacement snapshot and nothing else", async () => {
    mockOk({ contract_version: "commerce.v1" });
    await commerceReviewValidate({
      contract_version: "commerce.v1",
      session_id: "s",
      expected_source_revision: 1,
      expected_candidate_revision: 1,
      expected_policy_revision: 0,
      threshold_k: 1,
      reviewer_label: "r",
      review_attestation: {
        all_rows_reviewed: true,
        understands_bounded_predicate: true,
        conflicting_source_ref_overrides_explained: true,
      },
      manual_candidates: [],
      rows: [],
      reference_mapping: { "payment:P1": null },
    });
    const { url, body } = lastCall();
    expect(url).toBe(`${COMMERCE_BASE}/review/validate`);
    expect(Object.keys(body).sort()).toEqual(
      [
        "contract_version",
        "session_id",
        "expected_source_revision",
        "expected_candidate_revision",
        "expected_policy_revision",
        "threshold_k",
        "reviewer_label",
        "review_attestation",
        "manual_candidates",
        "rows",
        "reference_mapping",
      ].sort(),
    );
    // Literal JSON null for an unmatched baseline, never a missing key.
    expect((body.reference_mapping as Record<string, unknown>)["payment:P1"]).toBeNull();
    expect("origin" in body).toBe(false);
  });

  it("challenge sends the frozen review digest and time budget", async () => {
    mockOk({ contract_version: "commerce.v1" });
    await commerceChallenge({
      contract_version: "commerce.v1",
      session_id: "s",
      expected_source_revision: 1,
      expected_candidate_revision: 2,
      expected_policy_revision: 1,
      expected_review_sha256: "a".repeat(64),
      time_budget_ms: 10000,
    });
    const { url, body } = lastCall();
    expect(url).toBe(`${COMMERCE_BASE}/challenge`);
    expect(body.expected_review_sha256).toBe("a".repeat(64));
    expect(body.time_budget_ms).toBe(10000);
    expect("receipt" in body).toBe(false);
  });

  it("receipt exports by run id plus review digest only", async () => {
    mockOk({ contract_version: "commerce.v1" });
    await commerceReceipt({
      contract_version: "commerce.v1",
      session_id: "s",
      run_id: "r",
      expected_review_sha256: "b".repeat(64),
    });
    const { url, body } = lastCall();
    expect(url).toBe(`${COMMERCE_BASE}/receipt`);
    expect(Object.keys(body).sort()).toEqual(
      ["contract_version", "session_id", "run_id", "expected_review_sha256"].sort(),
    );
  });

  it("replay is stateless: receipt plus original bytes, no session id", async () => {
    mockOk({ contract_version: "commerce.v1" });
    await commerceReplay({
      contract_version: "commerce.v1",
      receipt: { format: "jw.commerce.receipt.v1" } as never,
      files: {
        "orders.csv": { content_base64: "T0l==" },
        "payments.csv": { content_base64: "UDA=" },
        "deliveries.csv": { content_base64: "RDA=" },
        "refunds.csv": { content_base64: "UjA=" },
      },
    });
    const { url, body } = lastCall();
    expect(url).toBe(`${COMMERCE_BASE}/receipt/replay`);
    expect(Object.keys(body).sort()).toEqual(["contract_version", "receipt", "files"].sort());
    expect("session_id" in body).toBe(false);
  });

  it("exposes exactly the frozen ten coverage keys", () => {
    expect([...COMMERCE_COVERAGE_KEYS].sort()).toEqual(
      [
        "raw_worlds_total",
        "raw_worlds_checked",
        "invalid_worlds_total",
        "invalid_worlds_checked",
        "admissible_worlds_total",
        "admissible_worlds_checked",
        "checker_worlds_total",
        "checker_worlds_checked",
        "fully_enumerated",
        "checker_complete",
      ].sort(),
    );
  });
});

describe("commerce.v1 error envelope", () => {
  it("parses typed error code, path, message, and details", async () => {
    mockErr(422, {
      error: {
        code: "INVALID_BASELINE",
        message: "Reference mapping selects a target outside reviewed permissions.",
        path: "reference_mapping.delivery:D2",
        details: { target_id: "O9" },
      },
      verified: false,
    });
    try {
      await commerceChallenge({
        contract_version: "commerce.v1",
        session_id: "s",
        expected_source_revision: 1,
        expected_candidate_revision: 1,
        expected_policy_revision: 1,
        expected_review_sha256: "a".repeat(64),
        time_budget_ms: 10000,
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CommerceApiError);
      const err = e as CommerceApiError;
      expect(err.code).toBe("INVALID_BASELINE");
      expect(err.status).toBe(422);
      expect(err.errorPath).toBe("reference_mapping.delivery:D2");
      expect(err.details).toEqual({ target_id: "O9" });
      expect(isCommerceRouterMissing(err)).toBe(false);
    }
  });

  it("marks a 404 as a missing router (integration pending), not a verdict", async () => {
    mockErr(404, { detail: "Not Found" });
    try {
      await commerceParse({
        "orders.csv": { content_base64: "T0l==" },
        "payments.csv": { content_base64: "UDA=" },
        "deliveries.csv": { content_base64: "RDA=" },
        "refunds.csv": { content_base64: "UjA=" },
      });
      expect.unreachable();
    } catch (e) {
      const err = e as CommerceApiError;
      expect(err.code).toBe("HTTP_404");
      expect(err.status).toBe(404);
      expect(isCommerceRouterMissing(err)).toBe(true);
    }
  });

  it("maps network failure to an unreachable code with status 0", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    try {
      await commerceParse({
        "orders.csv": { content_base64: "T0l==" },
        "payments.csv": { content_base64: "UDA=" },
        "deliveries.csv": { content_base64: "RDA=" },
        "refunds.csv": { content_base64: "UjA=" },
      });
      expect.unreachable();
    } catch (e) {
      const err = e as CommerceApiError;
      expect(err.code).toBe("COMMERCE_API_UNREACHABLE");
      expect(err.status).toBe(0);
      expect(isCommerceRouterMissing(err)).toBe(false);
    }
  });

  it("preserves replay verification_status on tamper failures", async () => {
    mockErr(422, {
      error: {
        code: "RECEIPT_TAMPERED",
        message: "Receipt digest does not match canonical receipt body.",
        path: "receipt.receipt_sha256",
        details: {},
      },
      verification_status: "NOT_VERIFIED",
      verified: false,
    });
    try {
      await commerceReplay({
        contract_version: "commerce.v1",
        receipt: {} as never,
        files: {
          "orders.csv": { content_base64: "T0l==" },
          "payments.csv": { content_base64: "UDA=" },
          "deliveries.csv": { content_base64: "RDA=" },
          "refunds.csv": { content_base64: "UjA=" },
        },
      });
      expect.unreachable();
    } catch (e) {
      const err = e as CommerceApiError;
      expect(err.code).toBe("RECEIPT_TAMPERED");
      expect(err.verificationStatus).toBe("NOT_VERIFIED");
    }
  });
});
