/** INT-02 editable review draft: pure draft model + baseline derivation.
 *
 * The browser holds a human-edited draft; the backend remains the authority:
 * every permission, baseline, and verdict is decided by /api/review/validate
 * and later stages. This module never authorizes anything — it only shapes
 * the request the human explicitly adopts.
 */
import type { ReferenceDraft, ReviewDraft } from "./api";

export type EdgeStatus = "CONFIRMED" | "POSSIBLE" | "PROHIBITED";
export type UnmatchedStatus = "ALLOWED" | "REQUIRED" | "FORBIDDEN";
export type Coverage = "UNREVIEWED" | "REVIEWED_PARTIAL" | "REVIEWED_CLOSED_SCOPE";

export interface DraftState {
  edges: Record<string, Record<string, EdgeStatus>>;
  unmatched: Record<string, UnmatchedStatus>;
  coverage: Coverage;
  scopeNote: string;
  attested: boolean;
  revision: number;
}

/** Empty draft: every row unmatched-ALLOWED, no candidate edges yet. */
export function emptyDraft(attendanceIds: string[]): DraftState {
  const unmatched: Record<string, UnmatchedStatus> = {};
  for (const att of attendanceIds) unmatched[att] = "ALLOWED";
  return {
    edges: {},
    unmatched,
    coverage: "REVIEWED_PARTIAL",
    scopeNote: "Custom CSV review in progress.",
    attested: false,
    revision: 1,
  };
}

export interface ShortlistCandidate {
  attendance_id: string;
  registration_id: string;
}

/** Seed POSSIBLE edges from the deterministic shortlist (advisory only). */
export function seedFromShortlist(
  draft: DraftState,
  candidates: ShortlistCandidate[],
): DraftState {
  const edges: DraftState["edges"] = { ...draft.edges };
  const unmatched = { ...draft.unmatched };
  for (const c of candidates) {
    if (!(c.attendance_id in unmatched)) continue;
    const row = { ...(edges[c.attendance_id] ?? {}) };
    if (!(c.registration_id in row)) row[c.registration_id] = "POSSIBLE";
    edges[c.attendance_id] = row;
    if (unmatched[c.attendance_id] === "ALLOWED") unmatched[c.attendance_id] = "FORBIDDEN";
  }
  return { ...draft, edges, unmatched };
}

/** Set one edge status. CONFIRMED demotes any other CONFIRMED edge in-row. */
export function setEdgeStatus(
  draft: DraftState,
  attendanceId: string,
  registrationId: string,
  status: EdgeStatus,
): DraftState {
  const row = { ...(draft.edges[attendanceId] ?? {}) };
  if (status === "CONFIRMED") {
    for (const rid of Object.keys(row)) {
      if (row[rid] === "CONFIRMED") row[rid] = "POSSIBLE";
    }
  }
  row[registrationId] = status;
  return { ...draft, edges: { ...draft.edges, [attendanceId]: row } };
}

export function setUnmatched(
  draft: DraftState,
  attendanceId: string,
  status: UnmatchedStatus,
): DraftState {
  return { ...draft, unmatched: { ...draft.unmatched, [attendanceId]: status } };
}

export interface DerivedBaseline {
  assignments: Array<{ attendance_id: string; registration_id: string | null }>;
  warnings: string[];
}

/**
 * Propose a baseline mirroring the backend choice order: confirmed first,
 * then REQUIRED-unmatched, then first free POSSIBLE (sorted), else
 * ALLOWED-unmatched, else first POSSIBLE even if claimed (the backend then
 * honestly rejects the duplicate). Greedy conflicts are possible and are
 * reported as warnings; the backend decides validity.
 */
export function deriveBaseline(draft: DraftState, attendanceIds: string[]): DerivedBaseline {
  const claimed = new Set<string>();
  const assignments: DerivedBaseline["assignments"] = [];
  const warnings: string[] = [];
  for (const att of attendanceIds) {
    const row = draft.edges[att] ?? {};
    const confirmed = Object.keys(row).filter((rid) => row[rid] === "CONFIRMED");
    const possible = Object.keys(row)
      .filter((rid) => row[rid] === "POSSIBLE")
      .sort();
    const rule = draft.unmatched[att] ?? "ALLOWED";
    let pick: string | null | undefined;
    if (confirmed.length > 0) {
      pick = confirmed.sort()[0];
      if (claimed.has(pick)) {
        warnings.push(`${att}: confirmed link already used elsewhere; the backend will reject it.`);
      }
    } else if (rule === "REQUIRED") {
      pick = null;
    } else {
      pick = possible.find((rid) => !claimed.has(rid));
      if (pick === undefined && rule === "ALLOWED") {
        pick = null;
        if (possible.length > 0) {
          warnings.push(`${att}: all candidates already used; left unmatched (allowed).`);
        }
      }
      if (pick === undefined) {
        pick = possible[0] ?? null;
        if (pick !== null) {
          warnings.push(`${att}: all candidates already used; the backend will reject the duplicate.`);
        }
      }
    }
    if (pick !== null && pick !== undefined) claimed.add(pick);
    assignments.push({ attendance_id: att, registration_id: pick ?? null });
  }
  return { assignments, warnings };
}

export function draftToReviewDraft(draft: DraftState): ReviewDraft {
  const edges: ReviewDraft["edges"] = [];
  for (const att of Object.keys(draft.edges).sort()) {
    for (const rid of Object.keys(draft.edges[att]).sort()) {
      edges.push({
        attendance_id: att,
        registration_id: rid,
        status: draft.edges[att][rid],
        operation: "EXPLICIT_REVIEW",
      });
    }
  }
  const unmatched: ReviewDraft["unmatched"] = Object.keys(draft.unmatched)
    .sort()
    .map((att) => ({
      attendance_id: att,
      status: draft.unmatched[att],
      operation: "EXPLICIT_REVIEW" as const,
    }));
  return {
    schema_version: "jw.review.v1",
    revision: draft.revision,
    edges,
    unmatched,
    coverage: draft.coverage,
    scope_note: draft.scopeNote,
    closed_scope_attested: draft.coverage === "REVIEWED_CLOSED_SCOPE" && draft.attested,
  };
}

export function baselineToReferenceDraft(baseline: DerivedBaseline): ReferenceDraft {
  return {
    schema_version: "jw.reference.v1",
    assignments: baseline.assignments,
  };
}
