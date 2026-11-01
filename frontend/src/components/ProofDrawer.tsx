/** INT-01 proof drawer: human summary first, technical evidence second.
 * Presentational only. Raw digests, enum codes, and replay commands live
 * inside the collapsed disclosure; the summary never carries them.
 */
import type { ReactNode } from "react";

interface ProofDrawerProps {
  statusBlock: ReactNode;
  actions: ReactNode;
  evidence: ReactNode;
  hasEvidence: boolean;
}

export default function ProofDrawer({ statusBlock, actions, evidence, hasEvidence }: ProofDrawerProps) {
  return (
    <>
      <p className="scope-line">
        Reviewed candidate set only — this says nothing about real-world identity.
      </p>
      {statusBlock}
      <div className="row">{actions}</div>
      {hasEvidence && (
        <details className="evidence-details proof-evidence">
          <summary>Technical evidence</summary>
          <div className="proof-scroll">{evidence}</div>
        </details>
      )}
    </>
  );
}
