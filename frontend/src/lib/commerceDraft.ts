/** Commerce human-review draft: pure draft model + request serialization.
 *
 * The browser holds a human-edited draft; the server remains the authority.
 * Inspecting a candidate, seeding a draft value, or previewing a baseline
 * never authorizes anything: only a fully accepted `review/validate`
 * replacement snapshot adopts dispositions into an admissible world.
 */
import type {
  CommerceCandidateOrigin,
  CommerceDeterministicCandidate,
  CommerceDisposition,
  CommerceManualCandidate,
  CommerceRecordType,
  CommerceReviewRow,
  CommerceSuggestion,
} from "./commerceApi";
import { COMMERCE_CONTRACT_VERSION } from "./commerceApi";

/** Selection identity is exactly `(record_key,target_id)`; provenance is separate. */
export interface CommerceCatalogTarget {
  recordKey: string;
  recordType: CommerceRecordType;
  recordId: string;
  targetId: string;
  targetType: "order" | "payment";
  origins: CommerceCandidateOrigin[];
  /** Server-registered Meta evidence, only when actually returned. */
  metaEvidence: Array<{ evidence: string; serverCallId: string }>;
  manualReason: string | null;
}

function splitKey(recordKey: string): { recordType: CommerceRecordType; recordId: string } | null {
  const idx = recordKey.indexOf(":");
  if (idx <= 0) return null;
  const recordType = recordKey.slice(0, idx);
  const recordId = recordKey.slice(idx + 1);
  if (
    (recordType === "payment" || recordType === "delivery" || recordType === "refund") &&
    recordId.length > 0
  ) {
    return { recordType, recordId };
  }
  return null;
}

export function makeRecordKey(recordType: CommerceRecordType, recordId: string): string {
  return `${recordType}:${recordId}`;
}

function targetTypeFor(recordType: CommerceRecordType): "order" | "payment" {
  return recordType === "refund" ? "payment" : "order";
}

/**
 * Merge server-registered SOURCE_REF + META_SUGGESTED candidates into one
 * selectable target per `(record_key,target_id)`, preserving every distinct
 * provenance. Local manual entries are layered on top; duplicates of an
 * already-registered pair are reported, never double-counted.
 */
export function buildCommerceCatalog(
  deterministic: CommerceDeterministicCandidate[],
  suggestions: CommerceSuggestion[],
  manual: CommerceManualCandidate[],
): { targets: CommerceCatalogTarget[]; duplicateManual: CommerceManualCandidate[] } {
  const byPair = new Map<string, CommerceCatalogTarget>();
  const upsert = (
    recordKey: string,
    targetId: string,
    origin: CommerceCandidateOrigin,
    extra?: { evidence?: string; serverCallId?: string; reason?: string },
  ): boolean => {
    const split = splitKey(recordKey);
    if (!split || targetId.length === 0) return false;
    const key = `${recordKey}	${targetId}`;
    const existing = byPair.get(key);
    if (!existing) {
      byPair.set(key, {
        recordKey,
        recordType: split.recordType,
        recordId: split.recordId,
        targetId,
        targetType: targetTypeFor(split.recordType),
        origins: [origin],
        metaEvidence:
          origin === "META_SUGGESTED" && extra?.evidence && extra?.serverCallId
            ? [{ evidence: extra.evidence, serverCallId: extra.serverCallId }]
            : [],
        manualReason: origin === "MANUAL" ? (extra?.reason ?? null) : null,
      });
      return true;
    }
    if (!existing.origins.includes(origin)) existing.origins.push(origin);
    if (origin === "META_SUGGESTED" && extra?.evidence && extra?.serverCallId) {
      const dup = existing.metaEvidence.some(
        (e) => e.evidence === extra.evidence && e.serverCallId === extra.serverCallId,
      );
      if (!dup) existing.metaEvidence.push({ evidence: extra.evidence, serverCallId: extra.serverCallId });
    }
    if (origin === "MANUAL" && extra?.reason) existing.manualReason = extra.reason;
    return true;
  };

  for (const c of deterministic) {
    if (c.origin === "SOURCE_REF") upsert(c.record_key, c.target_id, "SOURCE_REF");
  }
  for (const s of suggestions) {
    if (s.origin === "META_SUGGESTED") {
      upsert(s.record_key, s.target_id, "META_SUGGESTED", {
        evidence: s.evidence,
        serverCallId: s.server_call_id,
      });
    }
  }
  const duplicateManual: CommerceManualCandidate[] = [];
  for (const m of manual) {
    const recordKey = makeRecordKey(m.record_type, m.record_id);
    const key = `${recordKey}	${m.target_id}`;
    if (byPair.has(key)) {
      duplicateManual.push(m);
      continue;
    }
    upsert(recordKey, m.target_id, "MANUAL", { reason: m.reason });
  }
  const targets = [...byPair.values()].sort(
    (a, b) =>
      a.recordType.localeCompare(b.recordType) ||
      a.recordId.localeCompare(b.recordId) ||
      a.targetId.localeCompare(b.targetId),
  );
  return { targets, duplicateManual };
}

export interface CommerceDraftState {
  /** recordKey -> targetId -> disposition. Absent rows are unreviewed. */
  edges: Record<string, Record<string, CommerceDisposition>>;
  unmatched: Record<string, CommerceDisposition>;
  manual: CommerceManualCandidate[];
  thresholdK: number | null;
  reviewerLabel: string;
  attestation: {
    all_rows_reviewed: boolean;
    understands_bounded_predicate: boolean;
    conflicting_source_ref_overrides_explained: boolean;
  };
  /** recordKey -> baseline target, or null for an explicitly unmatched baseline. */
  baseline: Record<string, string | null>;
}

/** Empty draft: nothing reviewed, nothing permitted, nothing adopted. */
export function emptyCommerceDraft(recordKeys: string[]): CommerceDraftState {
  const unmatched: Record<string, CommerceDisposition> = {};
  for (const key of recordKeys) unmatched[key] = "PROHIBITED";
  return {
    edges: {},
    unmatched,
    manual: [],
    thresholdK: null,
    reviewerLabel: "",
    attestation: {
      all_rows_reviewed: false,
      understands_bounded_predicate: false,
      conflicting_source_ref_overrides_explained: false,
    },
    baseline: {},
  };
}

/** Seed one record's SOURCE_REF targets as POSSIBLE (explicit draft action). */
export function seedRowFromSourceRefs(
  draft: CommerceDraftState,
  targets: CommerceCatalogTarget[],
  recordKey: string,
): CommerceDraftState {
  const row = { ...(draft.edges[recordKey] ?? {}) };
  for (const t of targets) {
    if (t.recordKey !== recordKey) continue;
    if (!t.origins.includes("SOURCE_REF")) continue;
    if (!(t.targetId in row)) row[t.targetId] = "POSSIBLE";
  }
  return { ...draft, edges: { ...draft.edges, [recordKey]: row } };
}

/** Seed every record's SOURCE_REF targets as POSSIBLE (explicit draft action). */
export function seedAllSourceRefs(
  draft: CommerceDraftState,
  targets: CommerceCatalogTarget[],
): CommerceDraftState {
  let next = draft;
  const keys = new Set(targets.map((t) => t.recordKey));
  for (const key of keys) next = seedRowFromSourceRefs(next, targets, key);
  return next;
}

/** Set one edge disposition. CONFIRMED demotes every other choice in-row. */
export function setCommerceEdge(
  draft: CommerceDraftState,
  recordKey: string,
  targetId: string,
  disposition: CommerceDisposition,
): CommerceDraftState {
  const row = { ...(draft.edges[recordKey] ?? {}) };
  let unmatched = draft.unmatched[recordKey] ?? "PROHIBITED";
  if (disposition === "CONFIRMED") {
    for (const tid of Object.keys(row)) row[tid] = "PROHIBITED";
    unmatched = "PROHIBITED";
  }
  row[targetId] = disposition;
  return {
    ...draft,
    edges: { ...draft.edges, [recordKey]: row },
    unmatched: { ...draft.unmatched, [recordKey]: unmatched },
  };
}

export function setCommerceUnmatched(
  draft: CommerceDraftState,
  recordKey: string,
  disposition: CommerceDisposition,
): CommerceDraftState {
  const row = { ...(draft.edges[recordKey] ?? {}) };
  if (disposition === "CONFIRMED") {
    for (const tid of Object.keys(row)) row[tid] = "PROHIBITED";
  }
  return {
    ...draft,
    edges: { ...draft.edges, [recordKey]: row },
    unmatched: { ...draft.unmatched, [recordKey]: disposition },
  };
}

export function setCommerceBaseline(
  draft: CommerceDraftState,
  recordKey: string,
  targetId: string | null,
): CommerceDraftState {
  return { ...draft, baseline: { ...draft.baseline, [recordKey]: targetId } };
}

export interface CommerceBaselinePreview {
  assignments: Array<{ record_key: string; target_id: string | null }>;
  warnings: string[];
}

/**
 * Preview a baseline from the current draft: CONFIRMED first, else the
 * human-picked baseline choice when it is still allowed, else first allowed
 * POSSIBLE, else explicit unmatched when allowed. The server decides validity.
 */
export function previewCommerceBaseline(
  draft: CommerceDraftState,
  recordKeys: string[],
): CommerceBaselinePreview {
  const assignments: CommerceBaselinePreview["assignments"] = [];
  const warnings: string[] = [];
  for (const key of recordKeys) {
    const row = draft.edges[key] ?? {};
    const confirmed = Object.keys(row).filter((t) => row[t] === "CONFIRMED").sort();
    const possible = Object.keys(row).filter((t) => row[t] === "POSSIBLE").sort();
    const unmatchedRule = draft.unmatched[key] ?? "PROHIBITED";
    const picked = draft.baseline[key];
    let choice: string | null | undefined;
    if (confirmed.length > 0) {
      choice = confirmed[0];
    } else if (
      picked !== undefined &&
      (picked === null ? unmatchedRule !== "PROHIBITED" : row[picked] === "POSSIBLE")
    ) {
      choice = picked;
    } else if (possible.length > 0) {
      choice = possible[0];
      if (picked !== undefined && picked !== choice) {
        warnings.push(`${key}: picked baseline is no longer allowed; previewing ${choice}.`);
      }
    } else if (unmatchedRule !== "PROHIBITED") {
      choice = null;
    } else {
      choice = null;
      warnings.push(`${key}: no allowed choice; the server will reject this row.`);
    }
    assignments.push({ record_key: key, target_id: choice ?? null });
  }
  return { assignments, warnings };
}

/** Rows that currently have no allowed choice (blocked until fixed). */
export function blockedCommerceRows(
  draft: CommerceDraftState,
  targets: CommerceCatalogTarget[],
  recordKeys: string[],
): string[] {
  const byRecord = new Map<string, string[]>();
  for (const t of targets) {
    const list = byRecord.get(t.recordKey) ?? [];
    list.push(t.targetId);
    byRecord.set(t.recordKey, list);
  }
  const blocked: string[] = [];
  for (const key of recordKeys) {
    const row = draft.edges[key] ?? {};
    const known = byRecord.get(key) ?? [];
    const allowedEdge = known.some((t) => row[t] === "CONFIRMED" || row[t] === "POSSIBLE");
    const allowedUnmatched = (draft.unmatched[key] ?? "PROHIBITED") !== "PROHIBITED";
    if (!allowedEdge && !allowedUnmatched) blocked.push(key);
  }
  return blocked;
}

export interface CommerceSerializedReview {
  manual_candidates: CommerceManualCandidate[];
  rows: CommerceReviewRow[];
  reference_mapping: Record<string, string | null>;
}

/**
 * Serialize the complete replacement snapshot: every record row, every known
 * candidate target exactly once, and an explicit baseline mapping. Unknown
 * row keys or missing dispositions are caller errors, never silent defaults.
 */
export function serializeCommerceReview(
  draft: CommerceDraftState,
  targets: CommerceCatalogTarget[],
  recordKeys: Array<{ recordKey: string; recordType: CommerceRecordType; recordId: string }>,
): CommerceSerializedReview {
  const byRecord = new Map<string, CommerceCatalogTarget[]>();
  for (const t of targets) {
    const list = byRecord.get(t.recordKey) ?? [];
    list.push(t);
    byRecord.set(t.recordKey, list);
  }
  const rows: CommerceReviewRow[] = recordKeys.map(({ recordKey, recordType, recordId }) => {
    const row = draft.edges[recordKey] ?? {};
    const known = (byRecord.get(recordKey) ?? []).map((t) => t.targetId).sort();
    return {
      record_type: recordType,
      record_id: recordId,
      edges: known.map((target_id) => ({
        target_id,
        disposition: row[target_id] ?? "PROHIBITED",
      })),
      unmatched: draft.unmatched[recordKey] ?? "PROHIBITED",
    };
  });
  const preview = previewCommerceBaseline(
    draft,
    recordKeys.map((r) => r.recordKey),
  );
  const reference_mapping: Record<string, string | null> = {};
  for (const a of preview.assignments) reference_mapping[a.record_key] = a.target_id;
  return {
    manual_candidates: draft.manual.map((m) => ({ ...m })),
    rows,
    reference_mapping,
  };
}

export function commerceRecordKeysOf(targets: CommerceCatalogTarget[]): string[] {
  return [...new Set(targets.map((t) => t.recordKey))].sort();
}

export { COMMERCE_CONTRACT_VERSION };
