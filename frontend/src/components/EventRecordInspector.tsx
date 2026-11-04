/** Shared Case A human-review controls: one implementation, Atlas hosts.
 *
 * These controls are rendered by the prototype-faithful `DecisionAtlasExperience`
 * inspector (`inspectorActions`) and narrative action slot for custom CSV
 * uploads. There is exactly one authoritative draft state in the parent: these
 * components only call the parent callbacks and never adopt, fetch, or
 * re-derive authority.
 *
 * Presentational only. Nothing here authorizes a link: the backend decides on
 * explicit adoption. Seeding or previewing never calls the API.
 */
import { useState } from "react";
import type { DerivedBaseline, EdgeStatus, UnmatchedStatus } from "../lib/reviewDraft";
import type { EditorCandidate } from "./ReviewEditor";

const EDGE_STATES: EdgeStatus[] = ["CONFIRMED", "POSSIBLE", "PROHIBITED"];
const UNMATCHED_STATES: UnmatchedStatus[] = ["ALLOWED", "REQUIRED", "FORBIDDEN"];

export interface EventRecordControlsProps {
  attendanceId: string;
  recordedName: string;
  candidates: EditorCandidate[];
  unmatched: UnmatchedStatus;
  shortlist: string[];
  onEdgeStatus: (rid: string, status: EdgeStatus) => void;
  onUnmatched: (status: UnmatchedStatus) => void;
  onSeedRow: () => void;
  onAddCandidate: (rid: string) => string | null;
}

/** Per-record review controls: seed, edge statuses, unmatched, manual add. */
export function EventRecordControls(props: EventRecordControlsProps) {
  const {
    attendanceId, recordedName, candidates, unmatched, shortlist,
    onEdgeStatus, onUnmatched, onSeedRow, onAddCandidate,
  } = props;
  const [input, setInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const suggested = shortlist.filter((rid) => !candidates.some((c) => c.rid === rid));

  function addFor() {
    const err = onAddCandidate(input.trim());
    setAddError(err);
    if (!err) setInput("");
  }

  return (
    <>
      <p className="muted">
        <code>{attendanceId}</code> · {recordedName} · decisions are draft-only until Adopt.
      </p>
      {suggested.length > 0 && (
        <button type="button" onClick={onSeedRow}>
          Seed {suggested.length} shortlist suggestion{suggested.length === 1 ? "" : "s"} as
          possible (advisory only)
        </button>
      )}
      {candidates.length > 0 && (
        <ul className="editor-edges">
          {candidates.map((c) => (
            <li key={c.rid}>
              <code>{c.rid}</code> · {c.name} · Group {c.group}{" "}
              <label>
                Link status{" "}
                <select
                  aria-label={`Link status for ${attendanceId} to ${c.rid}`}
                  value={c.status}
                  onChange={(e) => onEdgeStatus(c.rid, e.target.value as EdgeStatus)}
                >
                  {EDGE_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s === "CONFIRMED" ? "Confirmed" : s === "POSSIBLE" ? "Possible" : "Prohibited"}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="editor-unmatched">
        <label>
          If unmatched{" "}
          <select
            aria-label={`Unmatched rule for ${attendanceId}`}
            value={unmatched}
            onChange={(e) => onUnmatched(e.target.value as UnmatchedStatus)}
          >
            {UNMATCHED_STATES.map((s) => (
              <option key={s} value={s}>
                {s === "ALLOWED" ? "Allowed" : s === "REQUIRED" ? "Required" : "Forbidden"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Add registration ID{" "}
          <input
            type="text"
            aria-label={`Add registration ID for ${attendanceId}`}
            value={input}
            placeholder="R-…"
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button type="button" onClick={addFor}>
          Add candidate
        </button>
        {addError && (
          <p className="field-error" role="alert">
            {addError} — no request was sent.
          </p>
        )}
      </div>
    </>
  );
}

export function EventBaselinePreviewDetails({ baseline }: { baseline: DerivedBaseline }) {
  return (
    <details className="evidence-details">
      <summary>Proposed baseline (preview only — the backend validates it)</summary>
      {baseline.warnings.length > 0 && (
        <ul className="warnings" aria-label="Baseline warnings">
          {baseline.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      <div className="table-scroll">
        <table aria-label="Proposed baseline preview">
          <thead>
            <tr>
              <th>Attendance</th>
              <th>Baseline link</th>
            </tr>
          </thead>
          <tbody>
            {baseline.assignments.map((a) => (
              <tr key={a.attendance_id}>
                <td>
                  <code>{a.attendance_id}</code>
                </td>
                <td>
                  {a.registration_id ? <code>{a.registration_id}</code> : <em>unmatched</em>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export interface EventReviewCommitProps {
  coverage: string;
  onCoverage: (c: "REVIEWED_PARTIAL" | "REVIEWED_CLOSED_SCOPE") => void;
  scopeNote: string;
  onScopeNote: (s: string) => void;
  attested: boolean;
  onAttested: (b: boolean) => void;
  baseline: DerivedBaseline;
  onAdopt: () => void;
  adoptBusy: boolean;
}

/** Draft commit block: coverage, scope note, attestation, baseline, Adopt. */
export function EventReviewCommit(props: EventReviewCommitProps) {
  const {
    coverage, onCoverage, scopeNote, onScopeNote, attested, onAttested,
    baseline, onAdopt, adoptBusy,
  } = props;
  return (
    <div data-testid="event-review-summary" className="review-summary" aria-live="polite">
      <div className="editor-scope">
        <label>
          Coverage{" "}
          <select
            aria-label="Review coverage"
            value={coverage}
            onChange={(e) => onCoverage(e.target.value as "REVIEWED_PARTIAL" | "REVIEWED_CLOSED_SCOPE")}
          >
            <option value="REVIEWED_PARTIAL">Partially reviewed</option>
            <option value="REVIEWED_CLOSED_SCOPE">Closed scope (complete)</option>
          </select>
        </label>
        <label className="scope-note-label">
          Scope note{" "}
          <input
            type="text"
            aria-label="Scope note"
            value={scopeNote}
            minLength={12}
            maxLength={1000}
            onChange={(e) => onScopeNote(e.target.value)}
          />
        </label>
        <label className="attest-label">
          <input
            type="checkbox"
            checked={attested}
            disabled={coverage !== "REVIEWED_CLOSED_SCOPE"}
            onChange={(e) => onAttested(e.target.checked)}
          />{" "}
          I attest this review covers the whole closed scope
        </label>
      </div>
      <EventBaselinePreviewDetails baseline={baseline} />
      <div className="row summary-actions">
        <button type="button" className="primary" onClick={onAdopt} disabled={adoptBusy}>
          {adoptBusy ? "Validating…" : "Adopt my review and baseline"}
        </button>
      </div>
    </div>
  );
}
