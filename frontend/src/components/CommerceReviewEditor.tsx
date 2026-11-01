/** Commerce human review editor: per-edge dispositions, unmatched rules, baseline.
 * Presentational only. Nothing here authorizes a link: the backend decides on
 * explicit adoption. Selecting, seeding, or previewing never calls the API.
 */
import { useState } from "react";
import type {
  CommerceCandidateOrigin,
  CommerceDisposition,
  CommerceManualCandidate,
} from "../lib/commerceApi";
import type { CommerceCatalogTarget, CommerceBaselinePreview } from "../lib/commerceDraft";

const DISPOSITIONS: CommerceDisposition[] = ["CONFIRMED", "POSSIBLE", "PROHIBITED"];

export interface CommerceReviewRecord {
  recordKey: string;
  recordLabel: string;
  sourceHint: string | null;
  sourceRowNumber: number | null;
}

export interface CommerceBaselineOption {
  value: string | null;
  label: string;
  allowed: boolean;
}

interface CommerceReviewEditorProps {
  records: CommerceReviewRecord[];
  targetsFor: (recordKey: string) => CommerceCatalogTarget[];
  dispositionFor: (recordKey: string, targetId: string) => CommerceDisposition;
  unmatchedFor: (recordKey: string) => CommerceDisposition;
  onEdge: (recordKey: string, targetId: string, d: CommerceDisposition) => void;
  onUnmatched: (recordKey: string, d: CommerceDisposition) => void;
  onSeedRow: (recordKey: string) => void;
  baselineFor: (recordKey: string) => string | null | undefined;
  baselineOptions: (recordKey: string) => CommerceBaselineOption[];
  onBaseline: (recordKey: string, targetId: string | null) => void;
  manual: CommerceManualCandidate[];
  onAddManual: (recordKey: string, targetId: string, reason: string) => string | null;
  onRemoveManual: (index: number) => void;
  orderIds: string[];
  paymentIds: string[];
  thresholdK: number | null;
  orderCount: number;
  onThresholdK: (k: number | null) => void;
  reviewerLabel: string;
  onReviewerLabel: (s: string) => void;
  attestation: {
    all_rows_reviewed: boolean;
    understands_bounded_predicate: boolean;
    conflicting_source_ref_overrides_explained: boolean;
  };
  onAttestation: (key: keyof CommerceReviewEditorProps["attestation"], v: boolean) => void;
  baselinePreview: CommerceBaselinePreview;
  blockedRows: string[];
  adoptedReviewSha: string | null;
  isDirty: boolean;
  epochs: { sourceRevision: number; candidateRevision: number; policyRevision: number };
  onAdopt: () => void;
  adoptBusy: boolean;
}

function originShort(o: CommerceCandidateOrigin): string {
  return o === "SOURCE_REF" ? "source" : o === "META_SUGGESTED" ? "meta" : "manual";
}

export default function CommerceReviewEditor(props: CommerceReviewEditorProps) {
  const {
    records, targetsFor, dispositionFor, unmatchedFor, onEdge, onUnmatched, onSeedRow,
    baselineFor, baselineOptions, onBaseline, manual, onAddManual, onRemoveManual,
    thresholdK, orderCount, onThresholdK, reviewerLabel, onReviewerLabel,
    attestation, onAttestation, baselinePreview, blockedRows,
    adoptedReviewSha, isDirty, epochs, onAdopt, adoptBusy,
  } = props;
  const [targetInputs, setTargetInputs] = useState<Record<string, string>>({});
  const [reasonInputs, setReasonInputs] = useState<Record<string, string>>({});
  const [addErrors, setAddErrors] = useState<Record<string, string | null>>({});

  function addFor(recordKey: string) {
    const err = onAddManual(
      recordKey,
      (targetInputs[recordKey] ?? "").trim(),
      (reasonInputs[recordKey] ?? "").trim(),
    );
    setAddErrors({ ...addErrors, [recordKey]: err });
    if (!err) {
      setTargetInputs({ ...targetInputs, [recordKey]: "" });
      setReasonInputs({ ...reasonInputs, [recordKey]: "" });
    }
  }

  return (
    <div className="editor">
      <h3>Your review decisions</h3>
      <p className="muted">
        Set each candidate link, unmatched rule, and baseline choice yourself for every source
        record. Nothing below takes effect until you explicitly adopt it; the backend validates
        every choice. Selecting a record only inspects it.
      </p>
      <p className="muted" aria-live="polite">
        Reviewing session revisions: source {epochs.sourceRevision} · candidates{" "}
        {epochs.candidateRevision} · policy {epochs.policyRevision}.{" "}
        {adoptedReviewSha ? (
          <>
            Accepted review: <code>{adoptedReviewSha.slice(0, 12)}…</code>.{" "}
          </>
        ) : (
          <>No accepted review yet. </>
        )}
        {isDirty && (
          <strong className="draft-badge">UNCOMMITTED DRAFT — not yet adopted</strong>
        )}
      </p>

      <div className="editor-scope">
        <label>
          Threshold K (1–{orderCount}){" "}
          <input
            type="number"
            aria-label="Threshold K"
            min={1}
            max={Math.max(orderCount, 1)}
            value={thresholdK ?? ""}
            placeholder="draft until adopted"
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              onThresholdK(Number.isInteger(v) ? v : null);
            }}
          />
        </label>
        <label className="scope-note-label">
          Reviewer label (display only, not identity){" "}
          <input
            type="text"
            aria-label="Reviewer label"
            value={reviewerLabel}
            maxLength={200}
            placeholder="e.g. demo-reviewer"
            onChange={(e) => onReviewerLabel(e.target.value)}
          />
        </label>
      </div>
      <fieldset className="attest-group">
        <legend>Human attestation (all three required)</legend>
        <label className="attest-label">
          <input
            type="checkbox"
            checked={attestation.all_rows_reviewed}
            onChange={(e) => onAttestation("all_rows_reviewed", e.target.checked)}
          />{" "}
          I reviewed every source record above
        </label>
        <label className="attest-label">
          <input
            type="checkbox"
            checked={attestation.understands_bounded_predicate}
            onChange={(e) => onAttestation("understands_bounded_predicate", e.target.checked)}
          />{" "}
          I understand the bounded clean-fulfilment rule being tested
        </label>
        <label className="attest-label">
          <input
            type="checkbox"
            checked={attestation.conflicting_source_ref_overrides_explained}
            onChange={(e) => onAttestation("conflicting_source_ref_overrides_explained", e.target.checked)}
          />{" "}
          Conflicting source-reference overrides are explained by my reasons
        </label>
      </fieldset>

      {blockedRows.length > 0 && (
        <p className="stale-note" role="status">
          {blockedRows.length} {blockedRows.length === 1 ? "row has" : "rows have"} no allowed
          choice yet: <code>{blockedRows.slice(0, 8).join(", ")}</code>
          {blockedRows.length > 8 ? "…" : ""} — the server will reject an incomplete review.
        </p>
      )}

      {records.map((rec) => {
        const targets = targetsFor(rec.recordKey);
        const unmatched = unmatchedFor(rec.recordKey);
        const picked = baselineFor(rec.recordKey);
        const options = baselineOptions(rec.recordKey);
        const hasSourceTargets = targets.some((t) => t.origins.includes("SOURCE_REF"));
        return (
          <div className="editor-row" key={rec.recordKey}>
            <h4>
              <code>{rec.recordKey}</code> · {rec.recordLabel}
            </h4>
            <p className="muted row-hint">
              {rec.sourceRowNumber !== null ? `Source row ${rec.sourceRowNumber}. ` : ""}
              {rec.sourceHint !== null ? (
                <>Source hint: <code>{rec.sourceHint}</code> (hint only). </>
              ) : (
                <>No source hint (missing reference). </>
              )}
              {targets.length === 0 && <>No candidates registered for this record.</>}
            </p>
            {hasSourceTargets && (
              <button type="button" onClick={() => onSeedRow(rec.recordKey)}>
                Seed source hints as possible (draft only)
              </button>
            )}
            {targets.length > 0 && (
              <ul className="editor-edges">
                {targets.map((t) => (
                  <li key={t.targetId}>
                    <code>{t.targetId}</code>{" "}
                    <span className="muted">({t.origins.map(originShort).join("+")})</span>{" "}
                    <label>
                      Link disposition{" "}
                      <select
                        aria-label={`Link disposition for ${rec.recordKey} to ${t.targetId}`}
                        value={dispositionFor(rec.recordKey, t.targetId)}
                        onChange={(e) =>
                          onEdge(rec.recordKey, t.targetId, e.target.value as CommerceDisposition)
                        }
                      >
                        {DISPOSITIONS.map((d) => (
                          <option key={d} value={d}>
                            {d === "CONFIRMED" ? "Confirmed" : d === "POSSIBLE" ? "Possible" : "Prohibited"}
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
                  aria-label={`Unmatched rule for ${rec.recordKey}`}
                  value={unmatched}
                  onChange={(e) => onUnmatched(rec.recordKey, e.target.value as CommerceDisposition)}
                >
                  {DISPOSITIONS.map((d) => (
                    <option key={d} value={d}>
                      {d === "CONFIRMED" ? "Confirmed" : d === "POSSIBLE" ? "Possible" : "Prohibited"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Baseline choice{" "}
                <select
                  aria-label={`Baseline choice for ${rec.recordKey}`}
                  value={picked === null ? "__null__" : (picked ?? "")}
                  onChange={(e) =>
                    onBaseline(
                      rec.recordKey,
                      e.target.value === "__null__" ? null : e.target.value,
                    )
                  }
                >
                  <option value="">Preview default</option>
                  {options.map((o) => (
                    <option key={o.value ?? "__null__"} value={o.value ?? "__null__"} disabled={!o.allowed}>
                      {o.label}
                      {o.allowed ? "" : " (not allowed)"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="editor-unmatched">
              <label>
                Add target ID{" "}
                <input
                  type="text"
                  aria-label={`Add target ID for ${rec.recordKey}`}
                  value={targetInputs[rec.recordKey] ?? ""}
                  placeholder={rec.recordKey.startsWith("refund:") ? "P-…" : "O-…"}
                  onChange={(e) => setTargetInputs({ ...targetInputs, [rec.recordKey]: e.target.value })}
                />
              </label>
              <label className="scope-note-label">
                Reason{" "}
                <input
                  type="text"
                  aria-label={`Manual reason for ${rec.recordKey}`}
                  value={reasonInputs[rec.recordKey] ?? ""}
                  maxLength={200}
                  placeholder="Why is this link possible?"
                  onChange={(e) => setReasonInputs({ ...reasonInputs, [rec.recordKey]: e.target.value })}
                />
              </label>
              <button type="button" onClick={() => addFor(rec.recordKey)}>
                Add manual candidate
              </button>
              {addErrors[rec.recordKey] && (
                <p className="field-error" role="alert">
                  {addErrors[rec.recordKey]} — no request was sent.
                </p>
              )}
            </div>
          </div>
        );
      })}

      {manual.length > 0 && (
        <div className="manual-list">
          <h3>Manual candidates in this draft ({manual.length})</h3>
          <ul className="editor-edges">
            {manual.map((m, i) => (
              <li key={`${m.record_type}:${m.record_id}-${m.target_id}-${i}`}>
                <code>
                  {m.record_type}:{m.record_id}
                </code>{" "}
                → <code>{m.target_id}</code> · {m.reason}{" "}
                <button type="button" onClick={() => onRemoveManual(i)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3>Proposed baseline (preview only — the backend validates it)</h3>
      {baselinePreview.warnings.length > 0 && (
        <ul className="warnings" aria-label="Baseline warnings">
          {baselinePreview.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      <div className="table-scroll">
        <table aria-label="Proposed commerce baseline preview">
          <thead>
            <tr>
              <th>Source record</th>
              <th>Baseline link</th>
            </tr>
          </thead>
          <tbody>
            {baselinePreview.assignments.map((a) => (
              <tr key={a.record_key}>
                <td>
                  <code>{a.record_key}</code>
                </td>
                <td>{a.target_id ? <code>{a.target_id}</code> : <em>unmatched</em>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <button type="button" className="primary" onClick={onAdopt} disabled={adoptBusy}>
          {adoptBusy ? "Validating…" : "Adopt & freeze review"}
        </button>
      </div>
    </div>
  );
}
