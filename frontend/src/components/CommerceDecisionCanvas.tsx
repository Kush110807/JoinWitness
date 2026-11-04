/** G4 Commerce Decision Canvas: baseline -> inspected change -> alternative.
 *
 * Presentational and inspect-only: selecting a changed link never mutates
 * review state and never reruns analysis. Every count, ID, and status comes
 * from the live server challenge response. Nothing is hardcoded.
 */
import { useState } from "react";
import DecisionShift from "./DecisionShift";
import type { CommerceChallengeResult } from "../lib/commerceApi";
import {
  commerceDecisionText,
  commerceStatusCopy,
} from "../lib/commerceView";

interface CommerceDecisionCanvasProps {
  result: CommerceChallengeResult;
  orderCount: number;
}

function MetricBar({ clean, total, thresholdK }: { clean: number; total: number; thresholdK: number }) {
  const pct = total > 0 ? Math.min(100, (100 * clean) / total) : 0;
  const kPct = total > 0 ? Math.min(100, (100 * thresholdK) / Math.max(total, 1)) : 0;
  return (
    <div className="metric-row" aria-hidden="true">
      <span>Clean</span>
      <span className="track" style={{ position: "relative" }}>
        <span className="fill a" style={{ width: `${pct}%` }} />
        <span
          className="fill k-marker"
          style={{
            position: "absolute",
            left: `${kPct}%`,
            width: "2px",
            height: "100%",
            background: "#1d2220",
          }}
        />
      </span>
      <strong>
        {clean}/{total}
      </strong>
    </div>
  );
}

export default function CommerceDecisionCanvas({ result, orderCount }: CommerceDecisionCanvasProps) {
  const copy = commerceStatusCopy(result.status);
  const changes = result.witness?.reference_changes ?? [];
  const [selectedKey, setSelectedKey] = useState<string | null>(
    changes.length > 0 ? `${changes[0].record_key}→${changes[0].to_target_id ?? "unmatched"}` : null,
  );
  const selected =
    changes.find((c) => `${c.record_key}→${c.to_target_id ?? "unmatched"}` === selectedKey) ??
    changes[0] ??
    null;

  const baseline = result.baseline;
  const witness = result.witness;

  return (
    <div data-testid="commerce-decision-canvas" aria-label="Commerce decision canvas">
      <p>
        <strong>{copy.headline}</strong> {copy.detail}
      </p>

      {result.status === "REVERSED_EXHAUSTIVE" && baseline && witness && (
        <>
          <DecisionShift
            baseline={baseline}
            alternative={witness}
            total={orderCount}
            thresholdK={result.threshold_k}
            changedLinks={witness.link_distance}
          />
          <div className="canvas" aria-label="Decision canvas: original and permitted alternative">
            <div className="comparison-panel">
              <span className="comparison-caption">ORIGINAL MATCHING</span>
              <h3>{baseline.decision ? "Meets K" : "Does not meet K"}</h3>
              <p className="canvas-counts">
                {commerceDecisionText(
                  baseline.clean_fulfilled_count,
                  orderCount,
                  result.threshold_k,
                  baseline.decision,
                )}
              </p>
              <MetricBar
                clean={baseline.clean_fulfilled_count}
                total={orderCount}
                thresholdK={result.threshold_k}
              />
            </div>
            <div className="canvas-change" aria-label="Decisive permitted change">
              <p className="change-caption">The change that flips the answer</p>
              <ul className="change-rows" aria-label="Changed records, select to inspect">
                {changes.map((c) => {
                  const key = `${c.record_key}→${c.to_target_id ?? "unmatched"}`;
                  const isSel = key === (selected ? `${selected.record_key}→${selected.to_target_id ?? "unmatched"}` : null);
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        className={`change-row ${isSel ? "is-selected" : ""}`}
                        aria-pressed={isSel}
                        onClick={() => setSelectedKey(key)}
                      >
                        {c.record_key}: {c.from_target_id ?? "unmatched"} → {c.to_target_id ?? "unmatched"}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {selected && (
                <p className="change-detail" aria-live="polite">
                  {selected.record_key}: {selected.from_target_id ?? "unmatched"} →{" "}
                  {selected.to_target_id ?? "unmatched"}. Selecting inspects only.
                </p>
              )}
              <p className="change-claim">
                One reviewer-permitted reassignment changes the decision.
              </p>
            </div>
            <div className="comparison-panel alternative">
              <span className="comparison-caption">PERMITTED ALTERNATIVE</span>
              <h3>{witness.decision ? "Meets K" : "Does not meet K"}</h3>
              <p className="canvas-counts">
                {commerceDecisionText(
                  witness.clean_fulfilled_count,
                  orderCount,
                  result.threshold_k,
                  witness.decision,
                )}
              </p>
              <MetricBar
                clean={witness.clean_fulfilled_count}
                total={orderCount}
                thresholdK={result.threshold_k}
              />
            </div>
          </div>
          <p>
            Fewest changed assignments: <strong>{witness.link_distance}</strong> — proven minimum
            within the reviewed scope.
          </p>
          <p className="muted">Only within these reviewed possibilities.</p>
        </>
      )}

      {result.status === "STABLE_WITHIN_SCOPE" && baseline && (
        <>
          <div className="canvas canvas-single" aria-label="Decision canvas: stable within reviewed scope">
            <div className="comparison-panel">
              <span className="comparison-caption">ORIGINAL MATCHING</span>
              <h3>{baseline.decision ? "Meets K" : "Does not meet K"}</h3>
              <p className="canvas-counts">
                {commerceDecisionText(
                  baseline.clean_fulfilled_count,
                  orderCount,
                  result.threshold_k,
                  baseline.decision,
                )}
              </p>
              <MetricBar
                clean={baseline.clean_fulfilled_count}
                total={orderCount}
                thresholdK={result.threshold_k}
              />
            </div>
          </div>
          <p className="muted">
            No permitted alternative was found in the reviewer-authorised finite worlds. This is not
            real-world linkage certainty.
          </p>
        </>
      )}

      {result.status === "NOT_VERIFIED" && (
        <div className="canvas canvas-single" aria-label="Decision canvas: analysis inconclusive">
          <div className="comparison-panel">
            <span className="comparison-caption">NO CHECKED RESULT</span>
            <h3>No proof claimed</h3>
            <p>
              {result.reason === "TIMEOUT" &&
                "The bounded check did not finish in time. No stability or reversal is established."}
              {result.reason === "CHECKER_MISMATCH" &&
                "Independent recomputation disagreed. No proof is claimed."}
              {result.reason === "ENGINE_INTERRUPTED" &&
                "The engine stopped before completing. No stability or reversal is established."}
            </p>
            <p className="muted">Review inputs or retry the bounded check. Partial counters are not a complete denominator.</p>
          </div>
        </div>
      )}

      <details className="evidence-details">
        <summary>Technical evidence</summary>
        <p>
          Status: <code>{result.status}</code>
          {result.reason && (
            <> · reason <code>{result.reason}</code></>
          )}{" "}
          · checker <code>{result.checker_status}</code> · proof{" "}
          <code>{result.proof_basis}</code>
        </p>
        <div className="table-scroll">
          <table aria-label="Challenge coverage">
            <thead>
              <tr>
                <th>Coverage key</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(result.coverage) as Array<keyof typeof result.coverage>).map((key) => (
                <tr key={key}>
                  <td>
                    <code>{key}</code>
                  </td>
                  <td>{String(result.coverage[key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Scope: reviewer-authorised finite worlds only — nothing about real-world identity or all
          possible links.
        </p>
      </details>
    </div>
  );
}
