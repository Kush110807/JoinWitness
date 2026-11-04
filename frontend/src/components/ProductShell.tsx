/** INT-01 product shell: skip link, top bar, contextual bar, stage nav, footer.
 * Presentational only: all state and backend operations live in App.
 */
import type { ReactNode } from "react";
import AtlasSignal from "./AtlasSignal";
import { nullAlternativeSuffix, verdictHeadline, verdictPill } from "../lib/decisionView";

export type Stage = 1 | 2 | 3 | 4;

export interface StageMeta {
  n: Stage;
  label: string;
  help: string;
}

export interface CanvasVerdict {
  verdict: string;
  baseline_counts: { a: number; b: number };
  alternative_counts: { a: number; b: number } | null;
  minimum_changed_assignments: number | null;
}

const STAGE_NOW: Record<Stage, string> = {
  1: "Step 1 of 4 · Import — the fictional source files.",
  2: "Step 2 of 4 · Review — which links are legitimately possible?",
  3: "Step 3 of 4 · Challenge — could the conclusion reverse?",
  4: "Step 4 of 4 · Verify — can anyone reproduce it?",
};

interface ProductShellProps {
  stage: Stage;
  maxStage: Stage;
  busy: string | null;
  stages: StageMeta[];
  hasStarted: boolean;
  landing: ReactNode;
  analysis: CanvasVerdict | null;
  gotoStage: (n: Stage) => void;
  children: ReactNode;
  /** Optional Decision Atlas scenario switcher, rendered below the top bar. */
  atlasSwitcher?: ReactNode;
  /** Optional override of the event context-bar question (Commerce mode). */
  contextQuestion?: string;
  /** Optional override of the event stage captions (Commerce mode). */
  stageNow?: Record<Stage, string>;
  /** Optional verdict summary used when no event `analysis` is present. */
  verdictSummary?: ReactNode;
  atlasMode?: "event" | "commerce";
  /** Full-viewport scene mode: skip link + stage content only, no shell chrome. */
  bare?: boolean;
}

export default function ProductShell({
  stage,
  maxStage,
  busy,
  stages,
  hasStarted,
  landing,
  analysis,
  gotoStage,
  children,
  atlasSwitcher,
  contextQuestion,
  stageNow,
  verdictSummary,
  atlasMode = "event",
  bare = false,
}: ProductShellProps) {
  if (bare) {
    return (
      <div className="page atlas-bare">
        <a className="skip" href="#main">
          Skip to main content
        </a>
        <main id="main" tabIndex={-1} aria-label="Decision canvas">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <a className="skip" href="#main">
        Skip to main content
      </a>
      <div className="topbar">
        <div className="brand" aria-label="JoinWitness">
          <span className="brandmark" aria-hidden="true">
            <svg viewBox="0 0 40 40" focusable="false"><path d="M8 8v24h10V19l14 13V8H22v13L8 8Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="20" cy="20" r="3" fill="#C9F06A"/></svg>
          </span>
          <span className="brand-type"><strong>joinwitness</strong><small>DECISION INTELLIGENCE</small></span>
        </div>
        <div className="topbar-meta">
          <span className="statusdot" aria-hidden="true" /> Local research preview{" "}
          <span className="demopill">Synthetic data</span>
        </div>
      </div>
      {atlasSwitcher && <div className="atlas-switcher-bar">{atlasSwitcher}</div>}

      {!hasStarted && !analysis ? (
        <div className="atlas-entry-layout">
          <div className="atlas-entry-content">{landing}</div>
          <AtlasSignal mode={atlasMode} />
        </div>
      ) : (
        <header className="contextbar" aria-label="Current question and result">
          <p className="contextbar-q">
            {contextQuestion ?? "Fictional event · Can one uncertain match change who came out ahead?"}
          </p>
          <p className="contextbar-now">{(stageNow ?? STAGE_NOW)[stage]}</p>
          {analysis && (
            <p className="contextbar-verdict">
              <span
                className={`pill pill-${verdictPill(analysis.verdict).toLowerCase().replace(/ /g, "-")}`}
              >
                {verdictPill(analysis.verdict)}
              </span>{" "}
              <strong>
                {verdictHeadline(analysis.verdict, analysis.minimum_changed_assignments)}
              </strong>{" "}
              <span className="contextbar-counts">
                Original A {analysis.baseline_counts.a} / B {analysis.baseline_counts.b}
                {analysis.alternative_counts
                  ? ` → alternative A ${analysis.alternative_counts.a} / B ${analysis.alternative_counts.b}`
                  : nullAlternativeSuffix(analysis.verdict)}
              </span>
            </p>
          )}
          {analysis && (
            <p className="scope-line">
              Only within the reviewed matching rules — nothing about real-world identity.
            </p>
          )}
          {!analysis && verdictSummary}
        </header>
      )}

      <nav className="journey" aria-label="Four-stage walkthrough">
        <ol>
          {stages.map((s) => {
            const locked = s.n > maxStage;
            return (
              <li key={s.n}>
                <button
                  type="button"
                  className={`journey-step ${stage === s.n ? "is-current" : ""} ${s.n < maxStage || (s.n === maxStage && maxStage === 4 && analysis) ? "is-done" : ""}`}
                  aria-current={stage === s.n ? "step" : undefined}
                  disabled={locked || !!busy}
                  title={locked ? `Complete stage ${s.n - 1} first` : `Go to stage ${s.n}: ${s.label}`}
                  onClick={() => gotoStage(s.n)}
                >
                  <span className="step-num" aria-hidden="true">
                    {s.n}
                  </span>
                  <span className="step-words">
                    <strong>{s.label}</strong>
                    <small>{s.help}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <main id="main" tabIndex={-1} aria-label="Decision canvas">
        {children}
      </main>

      <footer>
        <strong>JoinWitness</strong>
        <span>Question the link. Verify the decision.</span>
        <p>
          Fictional data · local backend only. Conclusions apply only to the reviewed
          candidate universe.
        </p>
      </footer>
    </div>
  );
}
