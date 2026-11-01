import { describe, expect, it, vi } from "vitest";
import {
  adaptWitnessAssignments,
  ApiError,
  changedWitnessRows,
  parseSource,
  runAnalysis,
  validateReview,
} from "./api";

type FetchMock = ReturnType<typeof vi.fn>;

function mockFetchOnce(payload: unknown, ok = true, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValueOnce({
    ok,
    status,
    json: async () => payload,
  } as unknown as Response);
}

function lastBody(): Record<string, unknown> {
  const mock = globalThis.fetch as unknown as FetchMock;
  const [, opts] = mock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(String(opts.body)) as Record<string, unknown>;
}

describe("exact request shapes", () => {
  it("parse sends only the two base64 fields", async () => {
    mockFetchOnce({ status: "PARSED_UNREVIEWED" });
    await parseSource({ registrations_b64: "AAA=", attendance_b64: "BBB=" });
    const mock = globalThis.fetch as unknown as FetchMock;
    const [, opts] = mock.mock.calls[0] as [string, RequestInit];
    expect(opts.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(opts.body))).toEqual({
      registrations_b64: "AAA=",
      attendance_b64: "BBB=",
    });
  });

  it("review validation sends policy plus reference and nothing else", async () => {
    mockFetchOnce({ status: "REVIEW_VALIDATED" });
    const policy = {
      schema_version: "jw.review.v1",
      revision: 1,
      edges: [],
      unmatched: [],
      coverage: "REVIEWED_PARTIAL",
      scope_note: "0123456789ab",
      closed_scope_attested: false,
    } as never;
    const reference = { schema_version: "jw.reference.v1", assignments: [] } as never;
    await validateReview({ registrations_b64: "R", attendance_b64: "A" }, policy, reference);
    expect(Object.keys(lastBody()).sort()).toEqual(
      ["attendance_b64", "policy", "reference", "registrations_b64"].sort(),
    );
  });

  it("analysis sends exact frozen-digest fields", async () => {
    mockFetchOnce({ status: "ANALYSIS_VERIFIED" });
    await runAnalysis({
      registrations_b64: "R",
      attendance_b64: "A",
      policy: { schema_version: "jw.review.v1" } as never,
      reference: { schema_version: "jw.reference.v1" } as never,
      expected_review_sha256: "a".repeat(64),
      expected_revision: 1,
    });
    const body = lastBody();
    expect(body.expected_review_sha256).toBe("a".repeat(64));
    expect(body.expected_revision).toBe(1);
    expect("receipt" in body).toBe(false);
  });

  it("adapts wire tuple witness pairs to typed UI objects", () => {
    expect(
      adaptWitnessAssignments([
        ["T-01", "R-A1"],
        ["T-02", "R-B2"],
        ["T-03", null],
      ]),
    ).toEqual([
      { attendance_id: "T-01", registration_id: "R-A1" },
      { attendance_id: "T-02", registration_id: "R-B2" },
      { attendance_id: "T-03", registration_id: null },
    ]);
    expect(adaptWitnessAssignments(null)).toBeNull();
  });

  it("detects changed rows from reference pairs versus wire witness pairs", () => {
    const reference = [
      { attendance_id: "T-01", registration_id: "R-A1" },
      { attendance_id: "T-02", registration_id: "R-A2" },
      { attendance_id: "T-03", registration_id: "R-B1" },
    ];
    expect(
      changedWitnessRows(reference, [
        ["T-01", "R-A1"],
        ["T-02", "R-B2"],
        ["T-03", "R-B1"],
      ]),
    ).toEqual([{ attendance_id: "T-02", from: "R-A2", to: "R-B2" }]);
    expect(changedWitnessRows(reference, null)).toEqual([]);
  });

  it("backend error codes surface exactly", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ detail: { code: "REVIEW_SNAPSHOT_STALE" } }),
    } as unknown as Response);
    await expect(
      parseSource({ registrations_b64: "R", attendance_b64: "A" }),
    ).rejects.toMatchObject({ name: "ApiError" } as Partial<ApiError>);
    try {
      await parseSource({ registrations_b64: "R", attendance_b64: "A" });
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).code).toBe("REVIEW_SNAPSHOT_STALE");
      expect((e as ApiError).status).toBe(409);
    }
  });
});
