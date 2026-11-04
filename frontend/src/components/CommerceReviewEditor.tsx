/** Commerce human review workbench: queue + relationship canvas + inspector.
 *
 * Presentational only. Nothing here authorizes a link: the backend decides on
 * explicit adoption. Selecting, seeding, or previewing never calls the API.
 * Selection only inspects; only Adopt records the review.
 */
import { useEffect, useRef, useState } from "react";
import RelationshipField from "./RelationshipField";
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

function provenanceBadge(o: CommerceCandidateOrigin) {
  return (
    <span
      key={o}
      className={`prov prov-${o === "SOURCE_REF" ? "source" : o === "META_SUGGESTED" ? "meta" : "manual"}`}
    >
      {o === "SOURCE_REF" ? "Source hint" : o === "META_SUGGESTED" ? "Meta suggestion" : "Manual"}
    </span>
  );
}

function dispositionLabel(d: CommerceDisposition): string {
  return d === "CONFIRMED" ? "Confirmed" : d === "POSSIBLE" ? "Possible" : "Prohibited";
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
  const [selectedKey, setSelectedKey] = useState<string | null>(
    records.length > 0 ? records[0].recordKey : null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (records.length === 0) {
      setSelectedKey(null);
      return;
    }
    setSelectedKey((prev) =>
      prev && records.some((r) => r.recordKey === prev) ? prev : records[0].recordKey,
    );
  }, [records]);

  useEffect(() => {
    if (!sheetOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSheetOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const first = sheetRef.current?.querySelector<HTMLElement>("select, input, button");
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

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

  const selected = records.find((r) => r.recordKey === selectedKey) ?? records[0] ?? null;
  const selectedTargets = selected ? targetsFor(selected.recordKey) : [];
  const selectedUnmatched = selected ? unmatchedFor(selected.recordKey) : "PROHIBITED";
  const selectedPicked = selected ? baselineFor(selected.recordKey) : undefined;
  const selectedOptions = selected ? baselineOptions(selected.recordKey) : [];
  const hasSourceTargets = selectedTargets.some((t) => t.origins.includes("SOURCE_REF"));
  const selectedIndex = selected ? records.findIndex((r) => r.recordKey === selected.recordKey) : -1;

  function gotoRecord(delta: number) {
    if (records.length === 0) return;
    const next = (selectedIndex + delta + records.length) % records.length;
    setSelectedKey(records[next].recordKey);
  }

  const needsCount = blockedRows.length;
  const progressText =
    records.length === 0
      ? "No source records."
      : needsCount === 0
        ? `All ${records.length} rows have an allowed choice.`
        : `${needsCount} of ${records.length} ${needsCount === 1 ? "needs" : "need"} a decision.`;

  return (
    <div className="editor commerce-workbench">
      <div className="workbench-heading">
        <div><span className="atlas-eyebrow">02 / HUMAN REVIEW</span><h3>Map the uncertainty.</h3>
        <p>Inspect the source, compare its possible links, then authorise only the relationships you can defend.</p></div>
        <div className="workbench-safety"><span aria-hidden="true">◇</span><strong>Human authority</strong><small>Draft changes take effect only after Adopt.</small></div>
      </div>
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

      {needsCount > 0 && (
        <p className="stale-note" role="status">
          {needsCount} {needsCount === 1 ? "row has" : "rows have"} no allowed
          choice yet: <code>{blockedRows.slice(0, 8).join(", ")}</code>
          {blockedRows.length > 8 ? "…" : ""} — the server will reject an incomplete review.
        </p>
      )}

      <div className="workbench-grid">
        <div className="workbench-queue">
          <h4 id="commerce-queue-heading">Source queue</h4>
          <div role="listbox" aria-labelledby="commerce-queue-heading" aria-label="Source queue">
            {records.map((rec) => {
              const isSel = selected?.recordKey === rec.recordKey;
              const blocked = blockedRows.includes(rec.recordKey);
              return (
                <button
                  key={rec.recordKey}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  className={`queue-item ${isSel ? "is-selected" : ""}`}
                  onClick={() => setSelectedKey(rec.recordKey)}
                >
                  <code>{rec.recordKey}</code>
                  <span className="queue-name">{rec.recordLabel}</span>
                  <span className={`queue-status ${blocked ? "is-open" : "is-resolved"}`}>
                    {blocked ? "Needs a decision" : "Has an allowed choice"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="workbench-canvas">
          <div className="canvas-nav">
            <button type="button" onClick={() => gotoRecord(-1)} aria-label="Previous record">
              ← Prev
            </button>
            <span className="muted" aria-live="polite">
              {selectedIndex >= 0 ? `${selectedIndex + 1} of ${records.length}` : "No record"}
            </span>
            <button type="button" onClick={() => gotoRecord(1)} aria-label="Next record">
              Next →
            </button>
          </div>
          {selected && (
            <section
              data-testid="commerce-relationship-canvas"
              aria-label={`Relationship for ${selected.recordKey}`}
            >
              <h4>
                <code>{selected.recordKey}</code> · {selected.recordLabel}
              </h4>
              <p className="muted row-hint">
                {selected.sourceRowNumber !== null ? `Source row ${selected.sourceRowNumber}. ` : ""}
                {selected.sourceHint !== null ? (
                  <>Source hint: <code>{selected.sourceHint}</code> (hint only). </>
                ) : (
                  <>No source hint (missing reference). </>
                )}
                {selectedTargets.length === 0 && <>No candidates registered for this record.</>}
              </p>
              <RelationshipField
                recordKey={selected.recordKey}
                sourceHint={selected.sourceHint}
                targets={selectedTargets}
                dispositionFor={(targetId) => dispositionFor(selected.recordKey, targetId)}
                baselineTarget={selectedPicked}
              />
              {selectedTargets.length > 0 && (
                <ul className="editor-edges relationship-links" aria-label="Candidate links">
                  {selectedTargets.map((t) => {
                    const d = dispositionFor(selected.recordKey, t.targetId);
                    const isBaseline =
                      selectedPicked !== undefined &&
                      (selectedPicked === t.targetId ||
                        (selectedPicked === null && false));
                    return (
                      <li key={t.targetId} className={`rel-link rel-${d.toLowerCase()}`}>
                        <span className="rel-connector" aria-hidden="true" />
                        <code>{t.targetId}</code>{" "}
                        <span className="muted">({t.origins.map(originShort).join("+")})</span>{" "}
                        {t.origins.map(provenanceBadge)}{" "}
                        <span className={`tag ${d === "PROHIBITED" ? "" : "tag-alt"}`}>
                          {dispositionLabel(d)}
                        </span>{" "}
                        {isBaseline && <span className="tag tag-alt">Baseline</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="muted">
                Unmatched rule: <strong>{dispositionLabel(selectedUnmatched)}</strong>
                {selectedPicked !== undefined && (
                  <>
                    {" "}· Baseline:{" "}
                    <strong>{selectedPicked === null ? "unmatched" : selectedPicked}</strong>
                  </>
                )}
              </p>
              <p className="muted">Selecting = inspecting only. Decide in the inspector.</p>
              <button
                ref={triggerRef}
                type="button"
                className="primary inspector-open-btn"
                onClick={() => setSheetOpen(true)}
              >
                Review decisions for {selected.recordKey}
              </button>
            </section>
          )}
        </div>

        <div
          ref={sheetRef}
          className={`workbench-inspector ${sheetOpen ? "is-open" : ""}`}
          role={sheetOpen ? "dialog" : undefined}
          aria-modal={sheetOpen ? true : undefined}
          aria-label={sheetOpen ? "Decision inspector" : undefined}
        >
          <form aria-label="Decision inspector" onSubmit={(e) => e.preventDefault()}>
            <div className="inspector-head">
              <h4>Decision inspector</h4>
              <button
                type="button"
                className="inspector-close-btn"
                onClick={() => {
                  setSheetOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                Close
              </button>
            </div>
            {selected && (
              <>
                <p className="muted">
                  <code>{selected.recordKey}</code> · decisions are draft-only until Adopt.
                </p>
                {hasSourceTargets && (
                  <button type="button" onClick={() => onSeedRow(selected.recordKey)}>
                    Seed source hints as possible (draft only)
                  </button>
                )}
                {selectedTargets.length > 0 && (
                  <ul className="editor-edges">
                    {selectedTargets.map((t) => (
                      <li key={t.targetId}>
                        <code>{t.targetId}</code>{" "}
                        <span className="muted">({t.origins.map(originShort).join("+")})</span>{" "}
                        <label>
                          Link disposition{" "}
                          <select
                            aria-label={`Link disposition for ${selected.recordKey} to ${t.targetId}`}
                            value={dispositionFor(selected.recordKey, t.targetId)}
                            onChange={(e) =>
                              onEdge(selected.recordKey, t.targetId, e.target.value as CommerceDisposition)
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
                      aria-label={`Unmatched rule for ${selected.recordKey}`}
                      value={selectedUnmatched}
                      onChange={(e) => onUnmatched(selected.recordKey, e.target.value as CommerceDisposition)}
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
                      aria-label={`Baseline choice for ${selected.recordKey}`}
                      value={selectedPicked === null ? "__null__" : (selectedPicked ?? "")}
                      onChange={(e) =>
                        onBaseline(
                          selected.recordKey,
                          e.target.value === "__null__" ? null : e.target.value,
                        )
                      }
                    >
                      <option value="">Preview default</option>
                      {selectedOptions.map((o) => (
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
                      aria-label={`Add target ID for ${selected.recordKey}`}
                      value={targetInputs[selected.recordKey] ?? ""}
                      placeholder={selected.recordKey.startsWith("refund:") ? "P-…" : "O-…"}
                      onChange={(e) => setTargetInputs({ ...targetInputs, [selected.recordKey]: e.target.value })}
                    />
                  </label>
                  <label className="scope-note-label">
                    Reason{" "}
                    <input
                      type="text"
                      aria-label={`Manual reason for ${selected.recordKey}`}
                      value={reasonInputs[selected.recordKey] ?? ""}
                      maxLength={200}
                      placeholder="Why is this link possible?"
                      onChange={(e) => setReasonInputs({ ...reasonInputs, [selected.recordKey]: e.target.value })}
                    />
                  </label>
                  <button type="button" onClick={() => addFor(selected.recordKey)}>
                    Add manual candidate
                  </button>
                  {addErrors[selected.recordKey] && (
                    <p className="field-error" role="alert">
                      {addErrors[selected.recordKey]} — no request was sent.
                    </p>
                  )}
                </div>
              </>
            )}
          </form>
        </div>
      </div>

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
    </div>
  );
}
