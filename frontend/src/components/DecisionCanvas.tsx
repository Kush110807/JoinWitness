/** INT-01 Decision Canvas: original vs checked alternative with the decisive change.
 * Presentational and inspect-only: selecting a row never mutates review state
 * and never reruns analysis. All counts and rows come from the API response.
 */
import { useState } from "react";
import { leadText } from "../lib/decisionView";

export interface CanvasChangedRow {
  attendanceId: string;
  from: string | null;
  to: string | null;
  fromName: string;
  fromGroup: string;
  toName: string;
  toGroup: string;
  recordedName: string;
}

function MetricRows({ a, b }: { a: number; b: number }) {
  const rows: Array<[string, number, string]> = [
    ["Group A", a, "a"],
    ["Group B", b, "b"],
  ];
  const total = Math.max(1, a + b);
  return (
    <>
      {rows.map(([label, number, group]) => (
        <div className="metric-row" key={label}>
          <span>{label}</span>
          <span className="track">
            <span className={`fill ${group}`} style={{ width: `${(100 * number) / total}%` }} />
          </span>
          <strong>{number}</strong>
        </div>
      ))}
    </>
  );
}

interface DecisionCanvasProps {
  baseline: { a: number; b: number };
  alternative: { a: number; b: number } | null;
  changedRows: CanvasChangedRow[];
  changedLinkText: string;
  /** True only for a checked reversible verdict with exactly one changed row. */
  claimReversal: boolean;
  countsLine: string;
  /** Verdict-aware label for the null-alternative panel (never claims stability for inconclusive). */
  singleAriaLabel: string;
  inspect: "baseline" | "witness";
  onInspectChange: (v: "baseline" | "witness") => void;
}

export default function DecisionCanvas({
  baseline,
  alternative,
  changedRows,
  changedLinkText,
  claimReversal,
  countsLine,
  singleAriaLabel,
  inspect,
  onInspectChange,
}: DecisionCanvasProps) {
  const [selectedAtt, setSelectedAtt] = useState<string | null>(
    changedRows.length > 0 ? changedRows[0].attendanceId : null,
  );
  const selected = changedRows.find((c) => c.attendanceId === selectedAtt) ?? null;

  return (
    <>
      {alternative ? (
        <div className="canvas" aria-label="Decision canvas: original and permitted alternative">
          <div className={`comparison-panel ${inspect === "baseline" ? "is-inspected" : ""}`}>
            <span className="comparison-caption">ORIGINAL MATCHING</span>
            <h3>{leadText(baseline)}</h3>
            <MetricRows a={baseline.a} b={baseline.b} />
          </div>
          <div className="canvas-change" aria-label="Decisive permitted change">
            <p className="change-caption">The change that flips the answer</p>
            <p>
              Changed row{changedRows.length === 1 ? "" : "s"}:{" "}
              <strong>{changedLinkText}</strong>
            </p>
            <ul className="change-rows" aria-label="Changed rows, select to inspect">
              {changedRows.map((c) => (
                <li key={c.attendanceId}>
                  <button
                    type="button"
                    className={`change-row ${c.attendanceId === selected?.attendanceId ? "is-selected" : ""}`}
                    aria-pressed={c.attendanceId === selected?.attendanceId}
                    onClick={() => setSelectedAtt(c.attendanceId)}
                  >
                    {c.attendanceId} (recorded “{c.recordedName}”): {c.fromName} of Group{" "}
                    {c.fromGroup} → {c.toName} of Group {c.toGroup}
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <p className="change-detail" aria-live="polite">
                {selected.attendanceId}: {selected.fromName} (Group {selected.fromGroup}) →{" "}
                {selected.toName} (Group {selected.toGroup}). Selecting inspects only.
              </p>
            )}
            {claimReversal && (
              <p className="change-claim">This one permitted change reverses which group leads.</p>
            )}
          </div>
          <div
            className={`comparison-panel alternative ${inspect === "witness" ? "is-inspected" : ""}`}
          >
            <span className="comparison-caption">PERMITTED ALTERNATIVE</span>
            <h3>{leadText(alternative)}</h3>
            <MetricRows a={alternative.a} b={alternative.b} />
          </div>
        </div>
      ) : (
        <div className="canvas canvas-single" aria-label={singleAriaLabel}>
          <div className="comparison-panel">
            <span className="comparison-caption">ORIGINAL MATCHING</span>
            <h3>{leadText(baseline)}</h3>
            <MetricRows a={baseline.a} b={baseline.b} />
          </div>
        </div>
      )}
      <p className="canvas-counts">{countsLine}</p>
      {alternative && (
        <fieldset className="view-toggle">
          <legend>Inspect the already-checked result (view only — not a new analysis)</legend>
          <label>
            <input
              type="radio"
              name="inspect-result"
              checked={inspect === "baseline"}
              onChange={() => onInspectChange("baseline")}
            />{" "}
            View baseline matching
          </label>
          <label>
            <input
              type="radio"
              name="inspect-result"
              checked={inspect === "witness"}
              onChange={() => onInspectChange("witness")}
            />{" "}
            View permitted alternative
          </label>
        </fieldset>
      )}
    </>
  );
}
