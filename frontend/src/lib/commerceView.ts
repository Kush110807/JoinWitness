/** Commerce pure UI view-model: status discrimination and display derivation.
 *
 * These helpers translate accepted backend results into honest display
 * strings. They own no permission and no mathematics: every status, count,
 * witness, and coverage value shown originates from a real API response.
 * Anything that contradicts the frozen shape fails closed as an unverified
 * contract error, never as a false green proof.
 */
import type {
  CommerceChallengeResponse,
  CommerceChallengeResult,
  CommerceCoverage,
} from "./commerceApi";
import { COMMERCE_COVERAGE_KEYS, COMMERCE_PREDICATE } from "./commerceApi";

export interface CommerceStatusCopy {
  headline: string;
  detail: string;
  tone: "reversed" | "stable" | "inconclusive";
}

export function commerceStatusCopy(status: CommerceChallengeResult["status"]): CommerceStatusCopy {
  if (status === "REVERSED_EXHAUSTIVE") {
    return {
      headline: "A reviewed, permitted alternative crosses K.",
      detail:
        "Minimum number of changed source-record assignments is proven within this reviewed finite scope only.",
      tone: "reversed",
    };
  }
  if (status === "STABLE_WITHIN_SCOPE") {
    return {
      headline: "No decision reversal was found.",
      detail:
        "Complete independent checking of the reviewer-authorised finite worlds found no reversal. This is not real-world linkage certainty.",
      tone: "stable",
    };
  }
  return {
    headline: "Analysis incomplete; no result has been proved.",
    detail:
      "No stability, reversal, or minimum is established. Partial counters are not a complete denominator.",
    tone: "inconclusive",
  };
}

function isCountedInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

/** Defensive check of the exact ten-key coverage shape plus its invariants. */
export function validateCommerceCoverage(coverage: unknown): string[] {
  const problems: string[] = [];
  if (typeof coverage !== "object" || coverage === null) {
    return ["coverage is missing or not an object"];
  }
  const c = coverage as Record<string, unknown>;
  for (const key of COMMERCE_COVERAGE_KEYS) {
    if (!(key in c)) problems.push(`coverage.${key} is missing`);
  }
  if (problems.length > 0) return problems;
  const ints: Array<keyof CommerceCoverage> = [
    "raw_worlds_total",
    "raw_worlds_checked",
    "invalid_worlds_checked",
    "admissible_worlds_checked",
    "checker_worlds_checked",
  ];
  for (const key of ints) {
    if (!isCountedInt(c[key])) problems.push(`coverage.${key} is not a non-negative integer`);
  }
  const nullable: Array<keyof CommerceCoverage> = [
    "invalid_worlds_total",
    "admissible_worlds_total",
    "checker_worlds_total",
  ];
  for (const key of nullable) {
    if (c[key] !== null && !isCountedInt(c[key])) {
      problems.push(`coverage.${key} is neither null nor a non-negative integer`);
    }
  }
  if (typeof c.fully_enumerated !== "boolean") {
    problems.push("coverage.fully_enumerated is not a boolean");
  }
  if (typeof c.checker_complete !== "boolean") {
    problems.push("coverage.checker_complete is not a boolean");
  }
  if (problems.length > 0) return problems;
  const cov = c as unknown as CommerceCoverage;
  if (cov.raw_worlds_checked > cov.raw_worlds_total) {
    problems.push("raw_worlds_checked exceeds raw_worlds_total");
  }
  if (cov.raw_worlds_checked !== cov.invalid_worlds_checked + cov.admissible_worlds_checked) {
    problems.push("raw_worlds_checked does not equal invalid + admissible checked");
  }
  if (cov.checker_worlds_checked > cov.admissible_worlds_checked) {
    problems.push("checker_worlds_checked exceeds admissible_worlds_checked");
  }
  if (cov.fully_enumerated) {
    if (
      cov.invalid_worlds_total === null ||
      cov.admissible_worlds_total === null ||
      cov.invalid_worlds_total + cov.admissible_worlds_total !== cov.raw_worlds_total
    ) {
      problems.push("fully enumerated totals do not sum to raw_worlds_total");
    }
    if (
      cov.invalid_worlds_checked !== cov.invalid_worlds_total ||
      cov.admissible_worlds_checked !== cov.admissible_worlds_total
    ) {
      problems.push("fully enumerated checked counts differ from totals");
    }
  } else if (
    cov.invalid_worlds_total !== null ||
    cov.admissible_worlds_total !== null ||
    cov.checker_worlds_total !== null
  ) {
    problems.push("incomplete enumeration must leave world totals null");
  }
  if (cov.checker_complete) {
    if (!cov.fully_enumerated) problems.push("checker_complete requires fully_enumerated");
    if (cov.checker_worlds_total === null || cov.checker_worlds_checked !== cov.checker_worlds_total) {
      problems.push("checker_complete requires all checker worlds recomputed");
    }
  }
  return problems;
}

/**
 * Status-discriminated validation of a Challenge result. Returns the list of
 * contradictions; non-empty means the UI must render an unverified contract
 * error instead of any verdict.
 */
export function validateCommerceResult(result: unknown): string[] {
  const problems: string[] = [];
  if (typeof result !== "object" || result === null) {
    return ["result is missing or not an object"];
  }
  const r = result as Record<string, unknown>;
  const status = r.status;
  if (status !== "REVERSED_EXHAUSTIVE" && status !== "STABLE_WITHIN_SCOPE" && status !== "NOT_VERIFIED") {
    return [`result.status ${JSON.stringify(status)} is not a frozen status`];
  }
  if (r.predicate !== COMMERCE_PREDICATE) problems.push("result.predicate is not the frozen predicate");
  if (typeof r.threshold_k !== "number" || !Number.isInteger(r.threshold_k)) {
    problems.push("result.threshold_k is not an integer");
  }
  problems.push(...validateCommerceCoverage(r.coverage));
  const cov = r.coverage as CommerceCoverage;
  const covOk =
    typeof cov === "object" &&
    cov !== null &&
    cov.fully_enumerated === true &&
    cov.checker_complete === true;

  if (status === "REVERSED_EXHAUSTIVE") {
    if (r.reason !== null) problems.push("reversed result must carry reason null");
    const baseline = r.baseline as { clean_fulfilled_count?: unknown; decision?: unknown } | null;
    if (
      typeof baseline !== "object" ||
      baseline === null ||
      !isCountedInt(baseline.clean_fulfilled_count) ||
      typeof baseline.decision !== "boolean"
    ) {
      problems.push("reversed result requires a verified non-null baseline");
    }
    const witness = r.witness as {
      reference_changes?: unknown;
      clean_fulfilled_count?: unknown;
      decision?: unknown;
      link_distance?: unknown;
    } | null;
    if (
      typeof witness !== "object" ||
      witness === null ||
      !Array.isArray(witness.reference_changes) ||
      witness.reference_changes.length === 0 ||
      !isCountedInt(witness.clean_fulfilled_count) ||
      typeof witness.decision !== "boolean" ||
      !isCountedInt(witness.link_distance) ||
      (witness.link_distance as number) < 1
    ) {
      problems.push("reversed result requires a non-null witness with changes and distance");
    }
    if (r.checker_status !== "PASSED") problems.push("reversed result requires checker PASSED");
    if (r.proof_basis !== "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION") {
      problems.push("reversed result requires exhaustive proof basis");
    }
    if (!covOk) problems.push("reversed result requires complete enumeration and checker");
    if (r.minimum_distance_proven_within_scope !== true) {
      problems.push("reversed result requires a proven within-scope minimum");
    }
    const witnessDistance =
      witness && typeof witness === "object" ? (witness as { link_distance?: unknown }).link_distance : null;
    if (r.minimum_link_distance_within_scope !== witnessDistance) {
      problems.push("reversed minimum must equal the witness link distance");
    }
  } else if (status === "STABLE_WITHIN_SCOPE") {
    if (r.reason !== null) problems.push("stable result must carry reason null");
    const baseline = r.baseline as { clean_fulfilled_count?: unknown; decision?: unknown } | null;
    if (
      typeof baseline !== "object" ||
      baseline === null ||
      !isCountedInt(baseline.clean_fulfilled_count) ||
      typeof baseline.decision !== "boolean"
    ) {
      problems.push("stable result requires a verified non-null baseline");
    }
    if (r.witness !== null) problems.push("stable result must carry witness null");
    if (r.checker_status !== "PASSED") problems.push("stable result requires checker PASSED");
    if (r.proof_basis !== "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION") {
      problems.push("stable result requires exhaustive proof basis");
    }
    if (!covOk) problems.push("stable result requires complete enumeration and checker");
    if (r.minimum_distance_proven_within_scope !== false) {
      problems.push("stable result must not claim a proven minimum");
    }
    if (r.minimum_link_distance_within_scope !== null) {
      problems.push("stable result must carry minimum null");
    }
  } else {
    if (r.reason !== "TIMEOUT" && r.reason !== "CHECKER_MISMATCH" && r.reason !== "ENGINE_INTERRUPTED") {
      problems.push("NOT_VERIFIED result requires a typed reason");
    }
    if (r.baseline !== null) problems.push("NOT_VERIFIED result must carry baseline null");
    if (r.witness !== null) problems.push("NOT_VERIFIED result must carry witness null");
    if (r.checker_status !== "UNRUN" && r.checker_status !== "FAILED") {
      problems.push("NOT_VERIFIED result requires checker UNRUN or FAILED");
    }
    if (r.proof_basis !== "NONE") problems.push("NOT_VERIFIED result requires proof basis NONE");
    if (r.minimum_distance_proven_within_scope !== false) {
      problems.push("NOT_VERIFIED result must not claim a proven minimum");
    }
    if (r.minimum_link_distance_within_scope !== null) {
      problems.push("NOT_VERIFIED result must carry minimum null");
    }
    if (cov !== null && typeof cov === "object" && cov.checker_complete === true) {
      problems.push("NOT_VERIFIED result must not claim a complete checker");
    }
  }
  return problems;
}

/** True only for a genuinely complete, checker-passed, shape-valid result. */
export function isCommerceProofComplete(result: CommerceChallengeResult): boolean {
  if (result.status !== "REVERSED_EXHAUSTIVE" && result.status !== "STABLE_WITHIN_SCOPE") {
    return false;
  }
  return validateCommerceResult(result).length === 0;
}

/**
 * Receipt export is eligible only for the current completed checker-passed
 * run: CHALLENGED state, non-null run id, and a complete proof result.
 */
export function isCommerceReceiptEligible(challenge: CommerceChallengeResponse | null): boolean {
  if (!challenge) return false;
  if (challenge.state !== "CHALLENGED") return false;
  if (typeof challenge.run_id !== "string" || challenge.run_id.length === 0) return false;
  return isCommerceProofComplete(challenge.result);
}

/** Exact witness change renders, e.g. "delivery:D2: O2 → O3". Data-driven. */
export function commerceWitnessChangeText(
  changes: Array<{ record_key: string; from_target_id: string | null; to_target_id: string | null }>,
): string {
  return changes
    .map((c) => `${c.record_key}: ${c.from_target_id ?? "unmatched"} → ${c.to_target_id ?? "unmatched"}`)
    .join(", ");
}

export function commerceDecisionText(
  cleanCount: number,
  orderCount: number,
  thresholdK: number,
  decision: boolean,
): string {
  const meets = decision ? "meets" : "does not meet";
  return `${cleanCount} of ${orderCount} orders cleanly fulfilled — ${meets} K=${thresholdK}.`;
}
