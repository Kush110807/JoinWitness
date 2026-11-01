/** Exact JW-T08A request/response shapes. No extra fields are ever sent. */

export interface SourcePayload {
  registrations_b64: string;
  attendance_b64: string;
}

export interface ReviewDraft {
  schema_version: "jw.review.v1";
  revision: number;
  edges: Array<{
    attendance_id: string;
    registration_id: string;
    status: "CONFIRMED" | "POSSIBLE" | "PROHIBITED";
    operation: "EXPLICIT_REVIEW";
    evidence_reference?: string | null;
  }>;
  unmatched: Array<{
    attendance_id: string;
    status: "ALLOWED" | "REQUIRED" | "FORBIDDEN";
    operation: "EXPLICIT_REVIEW";
  }>;
  coverage: "UNREVIEWED" | "REVIEWED_PARTIAL" | "REVIEWED_CLOSED_SCOPE";
  scope_note: string;
  closed_scope_attested: boolean;
}

export interface ReferenceDraft {
  schema_version: "jw.reference.v1";
  assignments: Array<{
    attendance_id: string;
    registration_id: string | null;
  }>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as T & {
    detail?: { code?: string } | string;
  } | null;
  if (!res.ok) {
    const code =
      typeof data?.detail === "object" && data?.detail
        ? (data.detail.code ?? `HTTP_${res.status}`)
        : typeof data?.detail === "string"
          ? data.detail
          : `HTTP_${res.status}`;
    throw new ApiError(code, res.status, path);
  }
  return data as T;
}

export class ApiError extends Error {
  readonly status: number;
  readonly path: string;
  constructor(code: string, status: number, path: string) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
  }
  get code(): string {
    return this.message;
  }
}

export interface ParseResponse {
  status: string;
  registrations: Array<Record<string, string>>;
  attendance: Array<Record<string, string>>;
  registrations_digest: { raw_sha256: string; row_count: number };
  attendance_digest: { raw_sha256: string; row_count: number };
}

export interface SuggestResponse {
  model_status: string;
  shortlist: {
    status?: string;
    candidates?: Array<{
      attendance_id: string;
      registration_id: string;
      reason?: string;
    }>;
    coverage_note?: string;
    [k: string]: unknown;
  };
}

export interface ReviewValidateResponse {
  status: string;
  coverage: string;
  review_sha256: string;
  review_revision: number;
  reference_sha256?: string;
  baseline_counts?: { a: number; b: number; unmatched: number; a_greater_than_b: boolean };
}

/**
 * Wire shape of `witness_assignments` in `/api/analyze`: JSON has no tuples,
 * so the backend tuple `tuple[tuple[str, str | None], ...]` arrives as an
 * array of 2-element arrays. Never access `.attendance_id` on these pairs.
 */
export type WitnessAssignmentWire = [string, string | null];

export interface WitnessAssignmentUi {
  attendance_id: string;
  registration_id: string | null;
}

/** Normalize wire tuple arrays to typed UI objects. Returns null when the backend sent no witness. */
export function adaptWitnessAssignments(
  wire: WitnessAssignmentWire[] | null | undefined,
): WitnessAssignmentUi[] | null {
  if (wire == null) return null;
  return wire.map(([attendance_id, registration_id]) => ({
    attendance_id,
    registration_id,
  }));
}

export interface WitnessChange {
  attendance_id: string;
  from: string | null;
  to: string | null;
}

/** Changed rows from original reference pairs versus wire witness pairs. */
export function changedWitnessRows(
  reference: Array<{ attendance_id: string; registration_id: string | null }>,
  wire: WitnessAssignmentWire[] | null | undefined,
): WitnessChange[] {
  const witness = adaptWitnessAssignments(wire);
  if (!witness) return [];
  const ref = new Map(reference.map((r) => [r.attendance_id, r.registration_id]));
  const out: WitnessChange[] = [];
  for (const w of witness) {
    if (!ref.has(w.attendance_id)) continue;
    const from = ref.get(w.attendance_id) ?? null;
    if (from !== w.registration_id) {
      out.push({ attendance_id: w.attendance_id, from, to: w.registration_id });
    }
  }
  return out;
}

export interface AnalyzeResponse {
  status: string;
  coverage: string;
  baseline_counts: { a: number; b: number; unmatched: number; a_greater_than_b: boolean };
  alternative_counts: { a: number; b: number; unmatched: number; a_greater_than_b: boolean } | null;
  witness_assignments: WitnessAssignmentWire[] | null;
  minimum_changed_assignments: number | null;
  solver_status: string;
  checker_status: string;
  oracle_status: string;
  verdict: string;
  proof_basis: string;
  review_sha256: string;
  reference_sha256: string;
  receipt_sha256: string;
  scope_caveat: string;
}

export interface ReceiptResponse {
  status: string;
  receipt: Record<string, unknown> & { receipt_sha256: string; verdict: string };
}

export interface VerifyResponse {
  status: string;
  verdict: string;
  proof_basis: string;
  receipt_sha256: string;
  scope_caveat: string;
}

export function parseSource(payload: SourcePayload): Promise<ParseResponse> {
  return post<ParseResponse>("/api/parse", {
    registrations_b64: payload.registrations_b64,
    attendance_b64: payload.attendance_b64,
  });
}

export function fetchSuggest(payload: SourcePayload): Promise<SuggestResponse> {
  return post<SuggestResponse>("/api/suggest", {
    registrations_b64: payload.registrations_b64,
    attendance_b64: payload.attendance_b64,
  });
}

export function validateReview(
  payload: SourcePayload,
  policy: ReviewDraft,
  reference: ReferenceDraft,
): Promise<ReviewValidateResponse> {
  return post<ReviewValidateResponse>("/api/review/validate", {
    registrations_b64: payload.registrations_b64,
    attendance_b64: payload.attendance_b64,
    policy,
    reference,
  });
}

export interface AnalysisPayload extends SourcePayload {
  policy: ReviewDraft;
  reference: ReferenceDraft;
  expected_review_sha256: string;
  expected_revision: number;
}

export function runAnalysis(payload: AnalysisPayload): Promise<AnalyzeResponse> {
  return post<AnalyzeResponse>("/api/analyze", {
    registrations_b64: payload.registrations_b64,
    attendance_b64: payload.attendance_b64,
    policy: payload.policy,
    reference: payload.reference,
    expected_review_sha256: payload.expected_review_sha256,
    expected_revision: payload.expected_revision,
  });
}

export function createReceipt(payload: AnalysisPayload): Promise<ReceiptResponse> {
  return post<ReceiptResponse>("/api/receipt", {
    registrations_b64: payload.registrations_b64,
    attendance_b64: payload.attendance_b64,
    policy: payload.policy,
    reference: payload.reference,
    expected_review_sha256: payload.expected_review_sha256,
    expected_revision: payload.expected_revision,
  });
}

export function verifyReceipt(
  payload: SourcePayload,
  policy: ReviewDraft,
  receipt: Record<string, unknown>,
): Promise<VerifyResponse> {
  return post<VerifyResponse>("/api/verify", {
    registrations_b64: payload.registrations_b64,
    attendance_b64: payload.attendance_b64,
    policy,
    receipt,
  });
}
