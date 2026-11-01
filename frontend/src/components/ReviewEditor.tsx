/** INT-02 human review editor: per-edge permissions, unmatched rules, baseline preview.
 * Presentational only. Nothing here authorizes a link: the backend decides on
 * explicit adoption. Selecting, seeding, or previewing never calls the API.
 */
import { useState } from "react";
import type { DerivedBaseline, EdgeStatus, UnmatchedStatus } from "../lib/reviewDraft";

export interface EditorCandidate {
  rid: string;
  name: string;
  group: string;
  status: EdgeStatus;
}

interface ReviewEditorProps {
  attIds: string[];
  recordedName: (att: string) => string;
  candidates: (att: string) => EditorCandidate[];
  unmatched: (att: string) => UnmatchedStatus;
  shortlistFor: (att: string) => string[];
  onEdgeStatus: (att: string, rid: string, status: EdgeStatus) => void;
  onUnmatched: (att: string, status: UnmatchedStatus) => void;
  onSeedRow: (att: string) => void;
  onAddCandidate: (att: string, rid: string) => string | null;
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

const EDGE_STATES: EdgeStatus[] = ["CONFIRMED", "POSSIBLE", "PROHIBITED"];
const UNMATCHED_STATES: UnmatchedStatus[] = ["ALLOWED", "REQUIRED", "FORBIDDEN"];

export default function ReviewEditor(props: ReviewEditorProps) {
  const {
    attIds, recordedName, candidates, unmatched, shortlistFor,
    onEdgeStatus, onUnmatched, onSeedRow, onAddCandidate,
    coverage, onCoverage, scopeNote, onScopeNote, attested, onAttested,
    baseline, onAdopt, adoptBusy,
  } = props;
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [addErrors, setAddErrors] = useState<Record<string, string | null>>({});

  function addFor(att: string) {
    const rid = (inputs[att] ?? "").trim();
    const err = onAddCandidate(att, rid);
    setAddErrors({ ...addErrors, [att]: err });
    if (!err) setInputs({ ...inputs, [att]: "" });
  }

  return (
    <div className="editor">
      <h3>Your review decisions</h3>
      <p className="muted">
        Set each candidate link and unmatched rule yourself. Nothing below takes
        effect until you explicitly adopt it; the backend validates every choice.
      </p>
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

      {attIds.map((att) => {
        const cands = candidates(att);
        const suggested = shortlistFor(att).filter(
          (rid) => !cands.some((c) => c.rid === rid),
        );
        return (
          <div className="editor-row" key={att}>
            <h4>
              <code>{att}</code> · {recordedName(att)}
            </h4>
            {suggested.length > 0 && (
              <button type="button" onClick={() => onSeedRow(att)}>
                Seed {suggested.length} shortlist suggestion{suggested.length === 1 ? "" : "s"} as
                possible (advisory only)
              </button>
            )}
            <ul className="editor-edges">
              {cands.map((c) => (
                <li key={c.rid}>
                  <code>{c.rid}</code> · {c.name} · Group {c.group}{" "}
                  <label>
                    Link status{" "}
                    <select
                      aria-label={`Link status for ${att} to ${c.rid}`}
                      value={c.status}
                      onChange={(e) =>
                        onEdgeStatus(att, c.rid, e.target.value as EdgeStatus)
                      }
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
            <div className="editor-unmatched">
              <label>
                If unmatched{" "}
                <select
                  aria-label={`Unmatched rule for ${att}`}
                  value={unmatched(att)}
                  onChange={(e) => onUnmatched(att, e.target.value as UnmatchedStatus)}
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
                  aria-label={`Add registration ID for ${att}`}
                  value={inputs[att] ?? ""}
                  placeholder="R-…"
                  onChange={(e) => setInputs({ ...inputs, [att]: e.target.value })}
                />
              </label>
              <button type="button" onClick={() => addFor(att)}>
                Add candidate
              </button>
              {addErrors[att] && (
                <p className="field-error" role="alert">
                  {addErrors[att]} — no request was sent.
                </p>
              )}
            </div>
          </div>
        );
      })}

      <h3>Proposed baseline (preview only — the backend validates it)</h3>
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
      <div className="row">
        <button type="button" className="primary" onClick={onAdopt} disabled={adoptBusy}>
          {adoptBusy ? "Validating…" : "Adopt my review and baseline"}
        </button>
      </div>
    </div>
  );
}
