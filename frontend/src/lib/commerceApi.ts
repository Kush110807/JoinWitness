/** Exact frozen `commerce.v1` request/response shapes (G1-B03, HQ-frozen).
 *
 * This adapter owns the Commerce wire only. It sends exactly the frozen field
 * names, uses the frozen router prefix `/api/commerce/v1`, and never invents
 * endpoints, response states, or per-row diagnostics. Case A keeps its own
 * adapter in `./api` and is never routed through these paths.
 *
 * All six routes are POST with `Content-Type: application/json` plus the
 * development-only local header `X-JW-Local-Request: 1` required by the
 * frozen contract. `RECEIPT_READY` is server-internal and is never read from
 * any response.
 */

export const COMMERCE_CONTRACT_VERSION = "commerce.v1";
export const COMMERCE_BASE = "/api/commerce/v1";
export const COMMERCE_PREDICATE = "clean_fulfilled_count >= K";
export const COMMERCE_LOCAL_HEADER = "X-JW-Local-Request";
export const COMMERCE_RECEIPT_FORMAT = "jw.commerce.receipt.v1";
export const COMMERCE_RECEIPT_ATTESTATION = "CONSISTENCY_HASH_ONLY_NOT_SIGNATURE";
export const COMMERCE_REVIEW_AUTHORISED_BY = "HUMAN_REVIEW_ATTESTED_NOT_IDENTITY_VERIFIED";
export const COMMERCE_META_PROVIDER = "META";
export const COMMERCE_META_MODEL = "muse-spark-1.3";

export type CommerceFileName = "orders.csv" | "payments.csv" | "deliveries.csv" | "refunds.csv";
export const COMMERCE_FILE_NAMES: CommerceFileName[] = [
  "orders.csv",
  "payments.csv",
  "deliveries.csv",
  "refunds.csv",
];

export interface CommerceFileObject {
  content_base64: string;
}

export type CommerceFileBundle = Record<CommerceFileName, CommerceFileObject>;

export type CommerceRecordType = "payment" | "delivery" | "refund";
export type CommerceCandidateOrigin = "SOURCE_REF" | "META_SUGGESTED" | "MANUAL";
export type CommerceDisposition = "CONFIRMED" | "POSSIBLE" | "PROHIBITED";
export type CommerceAiStatus = "NOT_REQUESTED" | "AI_SUGGESTED" | "AI_UNAVAILABLE";
export type CommerceCatalogEffect =
  | "ADDED_TARGET"
  | "ADDED_PROVENANCE"
  | "EXISTING_PROVENANCE_NO_OP";
/** Server states ever exposed on the wire. `RECEIPT_READY` is internal-only. */
export type CommerceSessionState = "IMPORTED" | "REVIEW_FROZEN" | "CHALLENGED";
export type CommerceResultStatus =
  | "REVERSED_EXHAUSTIVE"
  | "STABLE_WITHIN_SCOPE"
  | "NOT_VERIFIED";
export type CommerceResultReason = "TIMEOUT" | "CHECKER_MISMATCH" | "ENGINE_INTERRUPTED";
export type CommerceCheckerStatus = "PASSED" | "FAILED" | "UNRUN";
export type CommerceProofBasis =
  | "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION"
  | "WITNESS_CHECKED_ONLY"
  | "NONE";
export type CommerceVerificationStatus = "VERIFIED_REPLAY" | "NOT_VERIFIED";

export type CommerceCurrency = "USD" | "INR";
export type CommercePaymentStatus = "SETTLED" | "PENDING" | "FAILED" | "VOIDED";
export type CommerceDeliveryStatus = "DELIVERED" | "IN_TRANSIT" | "CANCELLED";
export type CommerceRefundStatus = "COMPLETED" | "PENDING" | "FAILED" | "CANCELLED";

/** Server-validated read-only source rows. Amounts stay two-decimal strings. */
export interface CommerceOrderRow {
  source_row_number: number;
  order_id: string;
  customer_id: string;
  order_total: string;
  currency: CommerceCurrency;
}
export interface CommercePaymentRow {
  source_row_number: number;
  payment_id: string;
  order_ref: string;
  amount: string;
  currency: CommerceCurrency;
  status: CommercePaymentStatus;
}
export interface CommerceDeliveryRow {
  source_row_number: number;
  delivery_id: string;
  order_ref: string;
  status: CommerceDeliveryStatus;
}
export interface CommerceRefundRow {
  source_row_number: number;
  refund_id: string;
  payment_ref: string;
  amount: string;
  status: CommerceRefundStatus;
}
export interface CommerceValidatedSourceRows {
  orders: CommerceOrderRow[];
  payments: CommercePaymentRow[];
  deliveries: CommerceDeliveryRow[];
  refunds: CommerceRefundRow[];
}

export interface CommerceDeterministicCandidate {
  record_key: string;
  target_id: string;
  origin: "SOURCE_REF";
  authorised: false;
}

export interface CommerceParseResponse {
  contract_version: typeof COMMERCE_CONTRACT_VERSION;
  state: "IMPORTED";
  session_id: string;
  source_revision: number;
  candidate_revision: number;
  source_bundle_sha256: string;
  file_sha256: Record<CommerceFileName, string>;
  row_counts: { orders: number; payments: number; deliveries: number; refunds: number };
  deterministic_candidates: CommerceDeterministicCandidate[];
  ai_status: "NOT_REQUESTED";
  limits: {
    orders: number;
    each_other_file: number;
    variables: number;
    alternatives_per_variable: number;
    raw_worlds: number;
  };
  validated_source_rows: CommerceValidatedSourceRows;
}

export interface CommerceSuggestRequest {
  contract_version: typeof COMMERCE_CONTRACT_VERSION;
  session_id: string;
  expected_source_revision: number;
  expected_candidate_revision: number;
  expected_policy_revision: number;
  mode: "META";
  max_suggestions: number;
}

export interface CommerceSuggestion {
  record_type: CommerceRecordType;
  record_id: string;
  record_key: string;
  target_type: "order" | "payment";
  target_id: string;
  origin: "META_SUGGESTED";
  evidence: string;
  server_call_id: string;
  catalog_effect: CommerceCatalogEffect;
  authorised: false;
}

export interface CommerceSuggestResponse {
  contract_version: typeof COMMERCE_CONTRACT_VERSION;
  session_id: string;
  ai_status: "AI_SUGGESTED" | "AI_UNAVAILABLE";
  suggestions: CommerceSuggestion[];
  source_revision: number;
  candidate_revision: number;
  policy_revision: number;
  state: CommerceSessionState;
  catalog_changed: boolean;
  authorisations_changed: false;
  model_call: {
    provider: typeof COMMERCE_META_PROVIDER;
    model: typeof COMMERCE_META_MODEL;
    server_call_id: string;
    execution: "SERVER_RESPONSE_RECEIVED";
  } | null;
  rejected_proposals: Array<{ reason_code: string; count: number }>;
}

export interface CommerceManualCandidate {
  record_type: CommerceRecordType;
  record_id: string;
  target_id: string;
  reason: string;
}

export interface CommerceReviewRow {
  record_type: CommerceRecordType;
  record_id: string;
  edges: Array<{ target_id: string; disposition: CommerceDisposition }>;
  unmatched: CommerceDisposition;
}

export interface CommerceReviewAttestation {
  all_rows_reviewed: boolean;
  understands_bounded_predicate: boolean;
  conflicting_source_ref_overrides_explained: boolean;
}

export interface CommerceReviewValidateRequest {
  contract_version: typeof COMMERCE_CONTRACT_VERSION;
  session_id: string;
  expected_source_revision: number;
  expected_candidate_revision: number;
  expected_policy_revision: number;
  threshold_k: number;
  reviewer_label: string;
  review_attestation: CommerceReviewAttestation;
  manual_candidates: CommerceManualCandidate[];
  rows: CommerceReviewRow[];
  /** Every non-order record key maps to its baseline target, or null when unmatched. */
  reference_mapping: Record<string, string | null>;
}

export interface CommerceReviewValidateResponse {
  contract_version: typeof COMMERCE_CONTRACT_VERSION;
  session_id: string;
  state: "REVIEW_FROZEN";
  source_revision: number;
  candidate_revision: number;
  policy_revision: number;
  candidate_catalog_sha256: string;
  source_bundle_sha256: string;
  policy_sha256: string;
  baseline_sha256: string;
  review_sha256: string;
  threshold_k: number;
  /** Review preflight counts, not the Challenge coverage shape. */
  raw_worlds: number;
  admissible_worlds: number;
  invalid_worlds: number;
  variable_records: number;
  baseline_valid: boolean;
  authorised_by: typeof COMMERCE_REVIEW_AUTHORISED_BY;
}

export interface CommerceChallengeRequest {
  contract_version: typeof COMMERCE_CONTRACT_VERSION;
  session_id: string;
  expected_source_revision: number;
  expected_candidate_revision: number;
  expected_policy_revision: number;
  expected_review_sha256: string;
  time_budget_ms: number;
}

/** Exact ten-key coverage shape. Never reuse removed B01 aliases. */
export interface CommerceCoverage {
  raw_worlds_total: number;
  raw_worlds_checked: number;
  invalid_worlds_total: number | null;
  invalid_worlds_checked: number;
  admissible_worlds_total: number | null;
  admissible_worlds_checked: number;
  checker_worlds_total: number | null;
  checker_worlds_checked: number;
  fully_enumerated: boolean;
  checker_complete: boolean;
}

export const COMMERCE_COVERAGE_KEYS: Array<keyof CommerceCoverage> = [
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
];

export interface CommerceChallengeResult {
  status: CommerceResultStatus;
  reason: CommerceResultReason | null;
  predicate: typeof COMMERCE_PREDICATE;
  threshold_k: number;
  baseline: { clean_fulfilled_count: number; decision: boolean } | null;
  witness: {
    reference_changes: Array<{
      record_key: string;
      from_target_id: string | null;
      to_target_id: string | null;
    }>;
    clean_fulfilled_count: number;
    decision: boolean;
    link_distance: number;
  } | null;
  coverage: CommerceCoverage;
  checker_status: CommerceCheckerStatus;
  proof_basis: CommerceProofBasis;
  minimum_distance_proven_within_scope: boolean;
  minimum_link_distance_within_scope: number | null;
}

export interface CommerceChallengeResponse {
  contract_version: typeof COMMERCE_CONTRACT_VERSION;
  session_id: string;
  state: CommerceSessionState;
  run_id: string | null;
  source_revision: number;
  candidate_revision: number;
  policy_revision: number;
  review_sha256: string;
  result: CommerceChallengeResult;
}

export interface CommerceReceiptRequest {
  contract_version: typeof COMMERCE_CONTRACT_VERSION;
  session_id: string;
  run_id: string;
  expected_review_sha256: string;
}

export interface CommerceCandidateCatalogEntry {
  record_key: string;
  target_id: string;
  origin: CommerceCandidateOrigin;
  reason?: string;
  evidence?: string;
  provider?: string;
  model?: string;
  server_call_id?: string;
}

export interface CommerceReceipt {
  format: typeof COMMERCE_RECEIPT_FORMAT;
  contract_version: typeof COMMERCE_CONTRACT_VERSION;
  source_bundle_sha256: string;
  file_sha256: Record<CommerceFileName, string>;
  candidate_catalog_sha256: string;
  policy: {
    contract_version: typeof COMMERCE_CONTRACT_VERSION;
    source_bundle_sha256: string;
    candidate_catalog_sha256: string;
    candidate_catalog: CommerceCandidateCatalogEntry[];
    threshold_k: number;
    reviewer_label: string;
    review_attestation: CommerceReviewAttestation;
    manual_candidates: CommerceManualCandidate[];
    rows: CommerceReviewRow[];
  };
  reference_mapping: Record<string, string | null>;
  policy_sha256: string;
  baseline_sha256: string;
  review_sha256: string;
  run_id: string;
  engine_identity: string;
  result: CommerceChallengeResult;
  timings_ms: {
    parse: number | null;
    search: number | null;
    checker: number | null;
    wall: number | null;
  };
  scope: {
    max_orders: number;
    max_each_other_file: number;
    max_variable_records: number;
    max_alternatives_per_variable: number;
    max_raw_worlds: number;
  };
  receipt_sha256: string;
  source_revision: number;
  candidate_revision: number;
  policy_revision: number;
}

/** No `state` member: receipt readiness is server-internal only (W05). */
export interface CommerceReceiptResponse {
  contract_version: typeof COMMERCE_CONTRACT_VERSION;
  receipt: CommerceReceipt;
  attestation: typeof COMMERCE_RECEIPT_ATTESTATION;
}

export interface CommerceReplayRequest {
  contract_version: typeof COMMERCE_CONTRACT_VERSION;
  receipt: CommerceReceipt;
  files: CommerceFileBundle;
}

export interface CommerceReplayResponse {
  contract_version: typeof COMMERCE_CONTRACT_VERSION;
  verification_status: CommerceVerificationStatus;
  source_binding: string;
  policy_binding: string;
  receipt_integrity: string;
  engine_identity: string;
  independent_checker: string;
  recomputed: {
    baseline_clean_count: number;
    witness_clean_count: number | null;
    link_distance: number | null;
    coverage: CommerceCoverage;
  };
  historical_receipt_only: true;
}

/** Frozen uniform error envelope for HTTP non-2xx Commerce responses. */
export interface CommerceErrorEnvelope {
  error: { code: string; message: string; path: string; details: Record<string, unknown> };
  verified: false;
  verification_status?: CommerceVerificationStatus;
}

export class CommerceApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly errorPath: string | null;
  readonly errorMessage: string | null;
  readonly details: Record<string, unknown>;
  readonly verificationStatus: CommerceVerificationStatus | null;

  constructor(
    code: string,
    status: number,
    path: string,
    opts?: {
      errorPath?: string | null;
      errorMessage?: string | null;
      details?: Record<string, unknown>;
      verificationStatus?: CommerceVerificationStatus | null;
    },
  ) {
    super(code);
    this.name = "CommerceApiError";
    this.status = status;
    this.path = path;
    this.errorPath = opts?.errorPath ?? null;
    this.errorMessage = opts?.errorMessage ?? null;
    this.details = opts?.details ?? {};
    this.verificationStatus = opts?.verificationStatus ?? null;
  }

  get code(): string {
    return this.message;
  }
}

/** True when the Commerce router itself is absent (integration pending). */
export function isCommerceRouterMissing(err: unknown): boolean {
  return err instanceof CommerceApiError && err.status === 404;
}

async function postCommerce<T>(route: string, body: unknown): Promise<T> {
  const path = `${COMMERCE_BASE}${route}`;
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [COMMERCE_LOCAL_HEADER]: "1",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new CommerceApiError("COMMERCE_API_UNREACHABLE", 0, path, {
      errorMessage: "Local backend unreachable.",
    });
  }
  const data = (await res.json().catch(() => null)) as
    | (T & Partial<CommerceErrorEnvelope>)
    | null;
  if (!res.ok) {
    const envelope = (data ?? null) as Partial<CommerceErrorEnvelope> | null;
    const code =
      envelope && typeof envelope.error === "object" && envelope.error
        ? (envelope.error.code ?? `HTTP_${res.status}`)
        : `HTTP_${res.status}`;
    throw new CommerceApiError(code, res.status, path, {
      errorPath: envelope?.error?.path ?? null,
      errorMessage: envelope?.error?.message ?? null,
      details:
        envelope?.error?.details && typeof envelope.error.details === "object"
          ? (envelope.error.details as Record<string, unknown>)
          : {},
      verificationStatus: envelope?.verification_status ?? null,
    });
  }
  return data as T;
}

export function commerceParse(files: CommerceFileBundle): Promise<CommerceParseResponse> {
  return postCommerce<CommerceParseResponse>("/parse", {
    contract_version: COMMERCE_CONTRACT_VERSION,
    files: {
      "orders.csv": files["orders.csv"],
      "payments.csv": files["payments.csv"],
      "deliveries.csv": files["deliveries.csv"],
      "refunds.csv": files["refunds.csv"],
    },
  });
}

export function commerceSuggest(req: CommerceSuggestRequest): Promise<CommerceSuggestResponse> {
  return postCommerce<CommerceSuggestResponse>("/suggest", {
    contract_version: req.contract_version,
    session_id: req.session_id,
    expected_source_revision: req.expected_source_revision,
    expected_candidate_revision: req.expected_candidate_revision,
    expected_policy_revision: req.expected_policy_revision,
    mode: req.mode,
    max_suggestions: req.max_suggestions,
  });
}

export function commerceReviewValidate(
  req: CommerceReviewValidateRequest,
): Promise<CommerceReviewValidateResponse> {
  return postCommerce<CommerceReviewValidateResponse>("/review/validate", {
    contract_version: req.contract_version,
    session_id: req.session_id,
    expected_source_revision: req.expected_source_revision,
    expected_candidate_revision: req.expected_candidate_revision,
    expected_policy_revision: req.expected_policy_revision,
    threshold_k: req.threshold_k,
    reviewer_label: req.reviewer_label,
    review_attestation: req.review_attestation,
    manual_candidates: req.manual_candidates,
    rows: req.rows,
    reference_mapping: req.reference_mapping,
  });
}

export function commerceChallenge(
  req: CommerceChallengeRequest,
): Promise<CommerceChallengeResponse> {
  return postCommerce<CommerceChallengeResponse>("/challenge", {
    contract_version: req.contract_version,
    session_id: req.session_id,
    expected_source_revision: req.expected_source_revision,
    expected_candidate_revision: req.expected_candidate_revision,
    expected_policy_revision: req.expected_policy_revision,
    expected_review_sha256: req.expected_review_sha256,
    time_budget_ms: req.time_budget_ms,
  });
}

export function commerceReceipt(req: CommerceReceiptRequest): Promise<CommerceReceiptResponse> {
  return postCommerce<CommerceReceiptResponse>("/receipt", {
    contract_version: req.contract_version,
    session_id: req.session_id,
    run_id: req.run_id,
    expected_review_sha256: req.expected_review_sha256,
  });
}

export function commerceReplay(req: CommerceReplayRequest): Promise<CommerceReplayResponse> {
  return postCommerce<CommerceReplayResponse>("/receipt/replay", {
    contract_version: req.contract_version,
    receipt: req.receipt,
    files: {
      "orders.csv": req.files["orders.csv"],
      "payments.csv": req.files["payments.csv"],
      "deliveries.csv": req.files["deliveries.csv"],
      "refunds.csv": req.files["refunds.csv"],
    },
  });
}
