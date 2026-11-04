/**
 * JoinWitness Decision Atlas — prototype-faithful interior scene.
 *
 * Presentational and inspect-only. It never grants permissions, computes a
 * verdict, imports data, freezes policy or claims a receipt is verified.
 * The parent must bind all visible facts to verified engine/API responses.
 *
 * This component intentionally replaces the INTERIOR of an investigation,
 * not merely the colours of the existing dashboard.
 *
 * Integration note (G4): invisible pointer hit-targets were added around
 * non-settled dots only, matching the owner prototype's hit circles. No
 * visual, layout, or copy change.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import './DecisionAtlasExperience.css';

export type AtlasStage = 'import' | 'review' | 'challenge' | 'verify';
export type AtlasRecordKind = 'settled' | 'uncertain' | 'critical';
export type AtlasScenario = 'event' | 'commerce';
export type AtlasLens = 'original' | 'alternative';

export interface AtlasChoice {
  targetId: string;
  label: string;
  description: string;
  /** Display only. Any reviewer permission remains controlled by the parent. */
  status: 'original' | 'possible' | 'confirmed' | 'prohibited' | 'unmatched';
}
export interface AtlasRecord {
  id: string;
  label: string;
  kind: AtlasRecordKind;
  sourceLayer: 'attendance' | 'registration' | 'orders' | 'payments' | 'deliveries' | 'refunds';
  description: string;
  choices: AtlasChoice[];
}
export interface AtlasOutcome {
  eyebrow: string;
  headline: string;
  /** Already formatted for display by an existing, trusted response adapter. */
  prominentMetric: string;
  explanation: string;
  claim: string;
}
export interface AtlasEvidenceRow {
  label: string;
  value: string;
}
export interface AtlasExperienceProps {
  scenario: AtlasScenario;
  workspaceLabel: string;
  question: string;
  subtitle: string;
  sourceLabel: string;
  sourceSummary: string;
  records: AtlasRecord[];
  /** Set critical only for relationships specifically supported by verified results. */
  original: AtlasOutcome;
  /** Null before successful analysis. Never supply an invented example result. */
  alternative: AtlasOutcome | null;
  isLiveResult: boolean;
  /** e.g. 'VERIFIED_REPLAY'. Must come from the actual replay response. */
  replayStatus: string | null;
  proofHeadline: string;
  proofDescription: string;
  evidenceRows: AtlasEvidenceRow[];
  evidenceQualification: string;
  stage: AtlasStage;
  /** Parent enforces available stages, not the visual component. */
  availableStages: AtlasStage[];
  onStage: (stage: AtlasStage) => void;
  onSelectRecord?: (id: string) => void;
  /** Can host the existing real reviewer controls for the selected record. */
  inspectorActions?: (record: AtlasRecord) => ReactNode;
  /** Optional precise next action under the narrative. */
  primaryAction?: ReactNode;
  statusLabel?: string;
}

const STAGES: { key: AtlasStage; title: string; n: string }[] = [
  { key: 'import', title: 'Import', n: '01' },
  { key: 'review', title: 'Review', n: '02' },
  { key: 'challenge', title: 'Challenge', n: '03' },
  { key: 'verify', title: 'Verify', n: '04' },
];
const TAU = Math.PI * 2;

/** Deterministic SCHEMATIC positions. Proximity is not a match/probability. */
function geometry(records: AtlasRecord[]) {
  return records.map((r, i) => {
    const theta = i * 2.399963229728653;
    const ring = 72 + Math.sqrt((i + .65) / Math.max(1, records.length)) * 172;
    const wiggle = ((i * 17) % 11 - 5) * 2;
    return {
      ...r,
      x: 340 + Math.cos(theta) * (ring + wiggle),
      y: 355 + Math.sin(theta) * (ring + wiggle) * .9,
    };
  });
}

function Mark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M6 9.5H13C17 9.5 18 13.3 21.2 13.3H26" stroke="#def7e6" strokeWidth="2.7" strokeLinecap="round" />
      <path d="M6 22.5H13C17 22.5 18 18.7 21.2 18.7H26" stroke="#87d8b2" strokeWidth="2.7" strokeLinecap="round" />
      {[ [6,9.5], [6,22.5], [26,13.3], [26,18.7] ].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="2" fill={i%2 ? '#8fe6bf':'#e8f9ee'} />
      ))}
    </svg>
  );
}

export default function DecisionAtlasExperience(props: AtlasExperienceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(props.records[0]?.id ?? null);
  const [filter, setFilter] = useState<'all' | 'uncertain' | 'critical'>('all');
  const [lens, setLens] = useState<AtlasLens>('original');
  const [proofOpen, setProofOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const evidenceTrigger = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const dots = useMemo(() => geometry(props.records), [props.records]);
  const selected = dots.find(d => d.id === selectedId) ?? dots[0] ?? null;
  const chosen = lens === 'alternative' && props.alternative ? props.alternative : props.original;
  const altAvailable = props.alternative !== null;
  const uncertainCount = dots.filter(d => d.kind !== 'settled').length;
  const criticalCount = dots.filter(d => d.kind === 'critical').length;

  useEffect(() => {
    setSelectedId(prev => props.records.some(r => r.id === prev) ? prev : props.records[0]?.id ?? null);
  }, [props.records]);
  useEffect(() => { if (!altAvailable) setLens('original'); }, [altAvailable]);
  useEffect(() => {
    if (!proofOpen) return;
    const before = document.activeElement;
    previousFocus.current = before instanceof HTMLElement ? before : evidenceTrigger.current;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setProofOpen(false); }
      if (event.key === 'Tab') {
        const dialog = closeRef.current?.closest<HTMLElement>('[role="dialog"]');
        const focusable = [...(dialog?.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])') ?? [])];
        if (focusable.length === 0) return;
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length-1].focus(); }
        else if (!event.shiftKey && document.activeElement === focusable[focusable.length-1]) { event.preventDefault(); focusable[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previousFocus.current?.focus(); };
  }, [proofOpen]);

  const select = (id: string) => {
    setSelectedId(id);
    props.onSelectRecord?.(id);
  };
  const isDim = (kind: AtlasRecordKind) => (filter === 'uncertain' && kind === 'settled') || (filter === 'critical' && kind !== 'critical');
  return (
    <div className="jw-atlas-experience" data-atlas-scenario={props.scenario}>
      <a className="jw-atlas-skip" href="#jw-atlas-main">Skip to investigation</a>
      <div className="jw-atlas-shell">
        <header className="jw-atlas-header">
          <div className="jw-atlas-brand">
            <div className="jw-atlas-symbol"><Mark /></div>
            <div><div className="jw-atlas-brandname">join<span>witness</span></div><div className="jw-atlas-brandmeta">Decision Intelligence</div></div>
          </div>
          <div className="jw-atlas-breadcrumb"><span>Workspace</span><b>/</b><strong>Decision Atlas</strong><b>/</b><span>{props.workspaceLabel}</span></div>
          <div className="jw-atlas-status"><i />{props.statusLabel ?? 'Fictional investigation'}</div>
        </header>
        <main id="jw-atlas-main" className="jw-atlas-main">
          <section className="jw-atlas-narrative" aria-label="The decision question">
            <div>
              <div className="jw-atlas-eyebrow">01 <span>/</span> THE QUESTION</div>
              <h1>{props.question}</h1>
              <p className="jw-atlas-subtitle">{props.subtitle}</p>
              <p className="jw-atlas-source-qualifier">◇ {props.isLiveResult ? 'Actual backend response' : 'Awaiting a verified challenge'} · {props.sourceLabel}</p>
            </div>
            <div className="jw-atlas-narrative-bottom">
              <div className="jw-atlas-thin-label">{chosen.eyebrow}</div>
              <div className="jw-atlas-big-number" aria-live="polite">{chosen.prominentMetric}</div>
              <p className="jw-atlas-microcopy">{chosen.explanation}</p>
              <div className="jw-atlas-summary">{props.sourceSummary}</div>
              {props.primaryAction && <div className="jw-atlas-action">{props.primaryAction}</div>}
            </div>
          </section>
          <section className="jw-atlas-field" aria-label="Interactive uncertainty field">
            <div className="jw-atlas-field-head">
              <div><strong>The uncertainty field</strong><small>{dots.length} RECORDS / {uncertainCount} UNCERTAIN</small></div>
              <span className="jw-atlas-outline-pill">● Inspect relationships</span>
            </div>
            <div className="jw-atlas-claim" aria-live="polite">{chosen.claim}</div>
            <svg className="jw-atlas-constellation" viewBox="0 0 680 690" preserveAspectRatio="xMidYMid meet" aria-label={`Schematic display of ${dots.length} records. Positions do not indicate match confidence.`}>
              <defs><radialGradient id="jw-atlas-rad"><stop stopColor="#73c6a0" stopOpacity=".11"/><stop offset="1" stopColor="#73c6a0" stopOpacity="0"/></radialGradient></defs>
              <circle cx="340" cy="355" r="225" fill="url(#jw-atlas-rad)"/>
              <circle cx="340" cy="355" r="154" className="jw-atlas-orbit-light"/>
              <ellipse cx="340" cy="355" rx="244" ry="208" className="jw-atlas-orbit"/>
              <ellipse cx="340" cy="355" rx="182" ry="245" className="jw-atlas-orbit" transform="rotate(-31 340 355)"/>
              {selected?.choices.filter(c => c.status !== 'prohibited').slice(0,3).map((c, i) => {
                // Visually connect only the selected record to an explicitly enumerated choice.
                const angle = (TAU * (i+1) / 5) - Math.PI / 2;
                const endX = selected.x + 67 * Math.cos(angle);
                const endY = selected.y + 67 * Math.sin(angle);
                return <g key={`${selected.id}:${c.targetId}`} className="jw-atlas-selection-edge">
                  <path d={`M ${selected.x} ${selected.y} Q ${(selected.x+endX)/2+7} ${(selected.y+endY)/2-7} ${endX} ${endY}`} stroke={c.status==='original'?'#9ceac2':'#f3b974'} strokeWidth="1.8" fill="none" strokeDasharray={c.status==='possible'?'4 5':undefined}/>
                  <circle cx={endX} cy={endY} r="4" fill={c.status==='original'?'#9ceac2':'#f3b974'}/>
                  <text x={endX+7} y={endY-8} className="jw-atlas-node-label">{c.targetId}</text>
                </g>;
              })}
              {dots.map(d => <circle
                key={d.id} cx={d.x} cy={d.y}
                r={d.id===selected?.id?7:d.kind==='critical'?6.4:d.kind==='uncertain'?5:3.1}
                className={`jw-atlas-node jw-atlas-node-${d.kind} ${d.id===selected?.id?'is-selected':''} ${isDim(d.kind)?'is-dim':''}`}
                role="button" tabIndex={d.kind==='settled' ? -1 : 0}
                aria-label={`Inspect ${d.id}, ${d.kind} record`}
                onClick={() => select(d.id)}
                onKeyDown={e => { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); select(d.id); } }}
              />)}
              {dots.filter(d => d.kind !== 'settled').map(d => <circle
                key={`hit:${d.id}`} cx={d.x} cy={d.y}
                r={d.kind === 'critical' ? 17 : 13}
                fill="transparent" aria-hidden="true" style={{ cursor: 'pointer' }}
                onClick={() => select(d.id)}
              />)}
              <text x="340" y="346" textAnchor="middle" className="jw-atlas-orbit-title">THE REVIEWED UNIVERSE</text>
              <text x="340" y="366" textAnchor="middle" className="jw-atlas-orbit-caption">Select a record to inspect its possible links</text>
            </svg>
            <div className="jw-atlas-field-footer">
              <div className="jw-atlas-filters" role="group" aria-label="Record visibility filter">
                {([
                  ['all',`All ${dots.length}`],
                  ['uncertain',`${uncertainCount} uncertain`],
                  ['critical',`${criticalCount} critical`]
                ] as const).map(([id,label]) => <button key={id} type="button" aria-pressed={filter===id} className={filter===id?'is-active':''} onClick={() => setFilter(id)}>{label}</button>)}
              </div>
              <div className="jw-atlas-legend"><i className="jw-atlas-legend-amber"/>Uncertain <i className="jw-atlas-legend-mint"/>Decision-changing</div>
            </div>
          </section>
          <aside className="jw-atlas-inspector" aria-label="Selected record inspector">
            <div className="jw-atlas-inspector-intro">
              <div className="jw-atlas-eyebrow">02 <span>/</span> INVESTIGATE</div>
              <h2>Follow the link.</h2>
              <p>Select a record to inspect its candidates. Inspection alone does not authorise a relationship.</p>
            </div>
            {selected ? <div className="jw-atlas-selected">
              <div className="jw-atlas-record-flag">{selected.kind === 'critical' ? 'DECISION-CHANGING RECORD' : selected.kind === 'uncertain' ? 'UNCERTAIN RECORD' : 'SETTLED RECORD'}</div>
              <strong className="jw-atlas-record-id">{selected.label}</strong>
              <p className="jw-atlas-record-desc">{selected.description}</p>
              <div className="jw-atlas-record-choices">{selected.choices.map(c => <div className="jw-atlas-choice" key={`${selected.id}:${c.targetId}`}>
                <i className={c.status==='possible'?'is-possible':''}/>
                <div><strong>{c.label}</strong><small>{c.description}</small></div><em>{c.status}</em>
              </div>)}</div>
              {props.inspectorActions?.(selected)}
            </div> : <p className="jw-atlas-empty">Import or select a source record to inspect permitted relationships.</p>}
            <div className="jw-atlas-proof-summary">
              <div className="jw-atlas-proof-status">◇ {props.replayStatus === 'VERIFIED_REPLAY' ? 'Receipt replay verified' : props.isLiveResult ? 'Backend result available' : 'Proof pending'}</div>
              <h3>{props.proofHeadline}</h3>
              <p>{props.proofDescription}</p>
              <button ref={evidenceTrigger} type="button" className="jw-atlas-proof-link" onClick={() => setProofOpen(true)}>Open verification evidence ↗</button>
            </div>
          </aside>
        </main>
        <footer className="jw-atlas-rail">
          <div className="jw-atlas-rail-label">● {props.sourceLabel} · source-pinned</div>
          <nav className="jw-atlas-stages" aria-label="Investigation stages">{STAGES.map(s => <button
            key={s.key} type="button" aria-current={props.stage===s.key?'step':undefined}
            className={props.stage===s.key?'is-current':''}
            disabled={!props.availableStages.includes(s.key)}
            onClick={() => props.onStage(s.key)}><span>{s.n}</span> {s.title}</button>)}</nav>
          <div className="jw-atlas-outcome-controls"><span>Outcome lens</span><div className="jw-atlas-outcome-toggle" role="group" aria-label="Compare outcomes">
            <button type="button" className={lens==='original'?'is-active':''} aria-pressed={lens==='original'} onClick={() => setLens('original')}>Original</button>
            <button type="button" className={lens==='alternative'?'is-active':''} aria-pressed={lens==='alternative'} disabled={!altAvailable} onClick={() => setLens('alternative')}>Checked alternative</button>
          </div></div>
        </footer>
      </div>
      {proofOpen && <div className="jw-atlas-modal-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)setProofOpen(false);}}>
        <section role="dialog" aria-modal="true" aria-label="Verification evidence" className="jw-atlas-drawer">
          <div className="jw-atlas-drawer-top"><span className="jw-atlas-eyebrow">EVIDENCE / {props.sourceLabel}</span><button type="button" ref={closeRef} aria-label="Close evidence" onClick={() => setProofOpen(false)}>×</button></div>
          <h2>What was actually proved.</h2>
          <p>{props.proofDescription}</p>
          <div className="jw-atlas-drawer-headline">{chosen.prominentMetric}</div>
          {props.evidenceRows.map(row => <div className="jw-atlas-evidence-row" key={row.label}><span>{row.label}</span><strong>{row.value}</strong></div>)}
          <p className="jw-atlas-evidence-qualification">{props.evidenceQualification}</p>
          {props.replayStatus !== 'VERIFIED_REPLAY' && <p className="jw-atlas-evidence-caution">Receipt replay has not been verified in this investigation.</p>}
        </section>
      </div>}
    </div>
  );
}
