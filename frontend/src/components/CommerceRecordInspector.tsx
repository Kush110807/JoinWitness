/** Shared Commerce human-review controls: one implementation, two hosts.
 *
 * These controls are rendered both by the existing `CommerceReviewEditor`
 * workbench and by the prototype-faithful `DecisionAtlasExperience`
 * inspector (`inspectorActions`) and narrative action slot. There is exactly
 * one authoritative draft state in the parent: these components only call the
 * parent callbacks and never adopt, fetch, or re-derive authority.
 *
 * Presentational only. Nothing here authorizes a link: the backend decides
 * on explicit adoption. Seeding or previewing never calls the API.
 */
import type {
  CommerceCandidateOrigin,
  CommerceDisposition,
  CommerceManualCandidate,
} from "../lib/commerceApi";
import type { CommerceBaselinePreview, CommerceCatalogTarget } from "../lib/commerceDraft";
import type { CommerceBaselineOption } from "./CommerceReviewEditor";

const DISPOSITIONS: CommerceDisposition[] = ["CONFIRMED", "POSSIBLE", "PROHIBITED"];

export function originShort(o: CommerceCandidateOrigin): string {
  return o === "SOURCE_REF" ? "source" : o === "META_SUGGESTED" ? "meta" : "manual";
}

export function provenanceBadge(o: CommerceCandidateOrigin) {
  return (
    <span
      key={o}
      className={`prov prov-${o === "SOURCE_REF" ? "source" : o === "META_SUGGESTED" ? "meta" : "manual"}`}
    >
      {o === "SOURCE_REF" ? "Source hint" : o === "META_SUGGESTED" ? "Meta suggestion" : "Manual"}
    </span>
  );
}

export function dispositionLabel(d: CommerceDisposition): string {
  return d === "CONFIRMED" ? "Confirmed" : d === "POSSIBLE" ? "Possible" : "Prohibited";
}

export interface CommerceDraftInputs {
  targetInputs: Record<string, string>;
  reasonInputs: Record<string, string>;
  addErrors: Record<string, string | null>;
  setTargetInputs: (v: Record<string, string>) => void;
  setReasonInputs: (v: Record<string, string>) => void;
  setAddErrors: (v: Record<string, string | null>) => void;
}

export interface CommerceRecordControlsProps {
  recordKey: string;
  targets: CommerceCatalogTarget[];
  dispositionFor: (targetId: string) => CommerceDisposition;
  unmatched: CommerceDisposition;
  onEdge: (targetId: string, d: CommerceDisposition) => void;
  onUnmatched: (d: CommerceDisposition) => void;
  onSeedRow: () => void;
  baselinePicked: string | null | undefined;
  baselineOptions: CommerceBaselineOption[];
  onBaseline: (targetId: string | null) => void;
  onAddManual: (targetId: string, reason: string) => string | null;
  inputs: CommerceDraftInputs;
}

/** Per-record review controls: seed, edge dispositions, unmatched, baseline, manual add. */
export function CommerceRecordControls(props: CommerceRecordControlsProps) {
  const {
    recordKey, targets, dispositionFor, unmatched, onEdge, onUnmatched, onSeedRow,
    baselinePicked, baselineOptions, onBaseline, onAddManual, inputs,
  } = props;
  const { targetInputs, reasonInputs, addErrors, setTargetInputs, setReasonInputs, setAddErrors } = inputs;
  const hasSourceTargets = targets.some((t) => t.origins.includes("SOURCE_REF"));

  function addFor() {
    const err = onAddManual(
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
    <>
      <p className="muted">
        <code>{recordKey}</code> · decisions are draft-only until Adopt.
      </p>
      {hasSourceTargets && (
        <button type="button" onClick={onSeedRow}>
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
                  aria-label={`Link disposition for ${recordKey} to ${t.targetId}`}
                  value={dispositionFor(t.targetId)}
                  onChange={(e) =>
                    onEdge(t.targetId, e.target.value as CommerceDisposition)
                  }
                >
                  {DISPOSITIONS.map((d) => (
                    <option key={d} value={d}>
                      {dispositionLabel(d)}
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
            aria-label={`Unmatched rule for ${recordKey}`}
            value={unmatched}
            onChange={(e) => onUnmatched(e.target.value as CommerceDisposition)}
          >
            {DISPOSITIONS.map((d) => (
              <option key={d} value={d}>
                {dispositionLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Baseline choice{" "}
          <select
            aria-label={`Baseline choice for ${recordKey}`}
            value={baselinePicked === null ? "__null__" : (baselinePicked ?? "")}
            onChange={(e) =>
              onBaseline(
                e.target.value === "__null__" ? null : e.target.value,
              )
            }
          >
            <option value="">Preview default</option>
            {baselineOptions.map((o) => (
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
            aria-label={`Add target ID for ${recordKey}`}
            value={targetInputs[recordKey] ?? ""}
            placeholder={recordKey.startsWith("refund:") ? "P-…" : "O-…"}
            onChange={(e) => setTargetInputs({ ...targetInputs, [recordKey]: e.target.value })}
          />
        </label>
        <label className="scope-note-label">
          Reason{" "}
          <input
            type="text"
            aria-label={`Manual reason for ${recordKey}`}
            value={reasonInputs[recordKey] ?? ""}
            maxLength={200}
            placeholder="Why is this link possible?"
            onChange={(e) => setReasonInputs({ ...reasonInputs, [recordKey]: e.target.value })}
          />
        </label>
        <button type="button" onClick={addFor}>
          Add manual candidate
        </button>
        {addErrors[recordKey] && (
          <p className="field-error" role="alert">
            {addErrors[recordKey]} — no request was sent.
          </p>
        )}
      </div>
    </>
  );
}

export interface CommerceManualListProps {
  manual: CommerceManualCandidate[];
  onRemoveManual: (index: number) => void;
}

export function CommerceManualList({ manual, onRemoveManual }: CommerceManualListProps) {
  if (manual.length === 0) return null;
  return (
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
  );
}

export function CommerceBaselinePreviewDetails({
  baselinePreview,
}: {
  baselinePreview: CommerceBaselinePreview;
}) {
  return (
    <details className="evidence-details">
      <summary>Proposed baseline (preview only — the backend validates it)</summary>
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
    </details>
  );
}

export interface CommerceReviewCommitProps {
  progressText: string;
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
  onAttestation: (
    key: keyof CommerceReviewCommitProps["attestation"],
    v: boolean,
  ) => void;
  onAdopt: () => void;
  adoptBusy: boolean;
}

/** Draft commit block: progress, K, reviewer label, attestations, Adopt. */
export function CommerceReviewCommit(props: CommerceReviewCommitProps) {
  const {
    progressText, thresholdK, orderCount, onThresholdK, reviewerLabel, onReviewerLabel,
    attestation, onAttestation, onAdopt, adoptBusy,
  } = props;
  return (
    <div data-testid="commerce-review-summary" className="review-summary" aria-live="polite">
      <p className="summary-progress">
        <strong>{progressText}</strong>
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
      <div className="row summary-actions">
        <button type="button" className="primary" onClick={onAdopt} disabled={adoptBusy}>
          {adoptBusy ? "Validating…" : "Adopt & freeze review"}
        </button>
      </div>
    </div>
  );
}
