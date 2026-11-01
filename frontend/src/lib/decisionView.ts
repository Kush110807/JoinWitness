/** INT-01 pure UI view-model: formatting/display derivation only.
 *
 * These helpers translate accepted backend verdicts and counts into
 * human-readable display strings. They own no permission, no mathematics,
 * and no matching computation: every verdict, count, and changed row shown
 * here originates from a real API response passed in by the caller.
 */
import type { WitnessChange } from "./api";

export interface GroupCounts {
  a: number;
  b: number;
}

/**
 * A server-reported minimum is usable only when it is a positive integer.
 * Anything else (null, non-integer, non-positive) is treated as unusable and
 * the caller must suppress the numerical proof claim. The UI never derives a
 * minimum from the changed-row count.
 */
export function isValidMinimum(minimum: number | null | undefined): minimum is number {
  return typeof minimum === "number" && Number.isInteger(minimum) && minimum >= 1;
}

function countWord(minimum: number): string {
  if (minimum === 2) return "Two";
  if (minimum > 2 && minimum <= 20) return String(minimum);
  return String(minimum);
}

/**
 * Count-aware headline. The number of changes is rendered only for
 * REVERSIBLE_MINIMUM_PROVEN with a valid server-reported minimum: a 2-change
 * minimum says "two", never "one". Null/invalid minimum suppresses the number.
 */
export function verdictHeadline(verdict: string, minimum?: number | null): string {
  if (verdict === "REVERSIBLE_MINIMUM_PROVEN") {
    if (minimum === 1) return "One permitted identity change reverses the result.";
    if (isValidMinimum(minimum))
      return `${countWord(minimum)} permitted identity changes reverse the result.`;
    return "A permitted alternative reverses the result.";
  }
  if (verdict === "REVERSIBLE_WITNESS_ONLY")
    return "A permitted alternative reverses the result; the smallest change is unproven.";
  if (verdict === "STABLE_WITHIN_REVIEWED_POLICY")
    return "No permitted alternative reverses the result.";
  return "This result is not verified.";
}

export function verdictPill(verdict: string): string {
  if (verdict === "REVERSIBLE_MINIMUM_PROVEN") return "MINIMUM VERIFIED";
  if (verdict === "NOT_VERIFIED") return "INCONCLUSIVE";
  return "SCOPED RESULT";
}

/** True only for checked reversibility verdicts from /api/analyze. */
export function isReversibleVerdict(verdict: string | undefined): boolean {
  return verdict === "REVERSIBLE_MINIMUM_PROVEN" || verdict === "REVERSIBLE_WITNESS_ONLY";
}

/** Plain-language leader for a pair of group counts. Ties lead nowhere: A>B is false. */
export function leadText(counts: GroupCounts): string {
  if (counts.a > counts.b) return "Group A leads";
  if (counts.b > counts.a) return "Group B leads";
  return "Groups are tied";
}

/**
 * Exact canvas counts line, e.g. "Original: Group A 2 · Group B 1 → …".
 * Verdict-aware for null alternatives: only STABLE_WITHIN_REVIEWED_POLICY may
 * say no reversal exists (qualified to the reviewed set); NOT_VERIFIED must
 * say inconclusive instead. NOT_VERIFIED is never synonymous with stability.
 */
export function formatCanvasCounts(
  baseline: GroupCounts,
  alternative: GroupCounts | null,
  verdict?: string,
): string {
  const base = `Original: Group A ${baseline.a} · Group B ${baseline.b}`;
  if (alternative)
    return `${base} → Permitted alternative: Group A ${alternative.a} · Group B ${alternative.b}`;
  if (verdict === "STABLE_WITHIN_REVIEWED_POLICY")
    return `${base} · no permitted reversal exists within the reviewed set`;
  if (verdict === "NOT_VERIFIED")
    return `${base} · Inconclusive — no reversal or stability established`;
  return `${base} · result not established by analysis`;
}

/** Verdict-aware suffix for the compact contextual bar when there is no alternative. */
export function nullAlternativeSuffix(verdict: string): string {
  if (verdict === "STABLE_WITHIN_REVIEWED_POLICY")
    return " · no permitted reversal exists within the reviewed set";
  if (verdict === "NOT_VERIFIED") return " · Inconclusive — no reversal or stability established";
  return " · result not established by analysis";
}

/** Verdict-aware label for a single-panel (null-alternative) canvas. */
export function singleCanvasLabel(verdict: string): string {
  if (verdict === "STABLE_WITHIN_REVIEWED_POLICY")
    return "Original matching: no permitted reversal within the reviewed set";
  if (verdict === "NOT_VERIFIED") return "Original matching: result inconclusive";
  return "Original matching: result not established";
}

/** Exact decisive-link renders, e.g. "T-02: R-A2 → R-B2". Data-driven, never hardcoded. */
export function changedLinkText(changes: WitnessChange[]): string {
  return changes
    .map((c) => `${c.attendance_id}: ${c.from ?? "unmatched"} → ${c.to ?? "unmatched"}`)
    .join(", ");
}
