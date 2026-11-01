/** INT-01 record queue: attendance records, selected-record links, permission inspector.
 * Presentational and view-only: selecting a record never mutates review state.
 */
import { useState } from "react";

export interface QueueCandidate {
  rid: string;
  name: string;
  group: string;
  /** Exact edge status from the prepared policy: never a model suggestion. */
  status: "CONFIRMED" | "POSSIBLE";
}

export interface QueueRecord {
  attendanceId: string;
  recordedName: string;
  candidates: QueueCandidate[];
  resolved: boolean;
  /** Original baseline registration for this record, from the authored reference. */
  baselineReg: string | null;
  /** Checked alternative registration, only when a reversible verdict exists. */
  alternativeReg: string | null;
}

interface RecordQueueProps {
  records: QueueRecord[];
  adopted: boolean;
  onSelect?: (attendanceId: string) => void;
  /** Controlled selection for large sets (roster drives it); else internal. */
  selectedId?: string | null;
}

export default function RecordQueue({ records, adopted, onSelect, selectedId }: RecordQueueProps) {
  const firstOpen = records.find((r) => !r.resolved) ?? records[0] ?? null;
  const [innerId, setInnerId] = useState<string | null>(null);
  const wanted = selectedId !== undefined ? selectedId : innerId;
  const selected =
    records.find((r) => r.attendanceId === wanted) ??
    records.find((r) => r.attendanceId === innerId) ??
    firstOpen;

  function select(id: string) {
    setInnerId(id);
    onSelect?.(id);
  }

  if (!selected) return null;

  return (
    <div className="queue-layout">
      <div className="queue-list" role="group" aria-label="Attendance records">
        {records.map((r) => (
          <button
            key={r.attendanceId}
            type="button"
            aria-pressed={r.attendanceId === selected.attendanceId}
            className={`queue-item ${r.attendanceId === selected.attendanceId ? "is-selected" : ""}`}
            onClick={() => select(r.attendanceId)}
          >
            <code>{r.attendanceId}</code>
            <span className="queue-name">{r.recordedName}</span>
            <span className={`queue-status ${r.resolved ? "is-resolved" : "is-open"}`}>
              {r.resolved ? "Resolved" : `Unresolved · ${r.candidates.length} candidates`}
            </span>
          </button>
        ))}
      </div>

      <div className="queue-center" aria-label={`Candidate links for ${selected.attendanceId}`}>
        <div className="fault-row">
          <div className="fault-node fault-source">
            <span className="fault-id">{selected.attendanceId}</span>
            <strong>{selected.recordedName}</strong>
            <small>Recorded attendance</small>
          </div>
          <div
            className="fault-edges"
            role="list"
            aria-label={`Candidates for ${selected.attendanceId}`}
          >
            {selected.candidates.map((c) => (
              <div className="fault-edge" role="listitem" key={c.rid}>
                <span className="fault-connector" aria-hidden="true" />
                <div className="fault-node fault-candidate">
                  <span className="fault-id">{c.rid}</span>
                  <strong>
                    {c.name} · Group {c.group}
                  </strong>
                  <small className="edge-status">
                    {c.status === "CONFIRMED" ? "Confirmed link" : "Possible link"}
                  </small>
                  <small className="edge-origin">Origin: prepared fictional policy</small>
                  <small className={adopted ? "perm" : "unrev"}>
                    {adopted
                      ? "permitted under this example's reviewed policy"
                      : "not yet permitted — adoption required"}
                  </small>
                  {adopted && c.rid === selected.baselineReg && (
                    <span className="tag">Original baseline</span>
                  )}
                  {selected.alternativeReg === c.rid && (
                    <span className="tag tag-alt">Checked alternative</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {selected.resolved && (
          <p className="muted queue-settled">
            Settled link — no alternative candidate is permitted for this record.
          </p>
        )}
      </div>

      <details className="queue-inspector" open aria-label="Why these links are allowed">
        <summary>Why these links are allowed</summary>
        <p>
          {adopted
            ? "Each candidate above is permitted under this example's reviewed policy. Only the explicit adoption button below records the review decision."
            : "Each candidate above is a possible link from the prepared fictional policy, awaiting review. Viewing or selecting it grants no permission."}
        </p>
        {selected.baselineReg && (
          <p>
            Reported link for {selected.attendanceId}: <code>{selected.baselineReg}</code>
            {selected.alternativeReg && (
              <>
                {" "}· checked alternative: <code>{selected.alternativeReg}</code>
              </>
            )}
          </p>
        )}
      </details>
    </div>
  );
}
