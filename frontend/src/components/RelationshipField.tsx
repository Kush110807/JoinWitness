/** Read-only visualisation of current human draft; no authority is granted here. */
import type { CommerceDisposition } from "../lib/commerceApi";
import type { CommerceCatalogTarget } from "../lib/commerceDraft";

interface RelationshipFieldProps {
  recordKey: string;
  sourceHint: string | null;
  targets: CommerceCatalogTarget[];
  dispositionFor: (targetId: string) => CommerceDisposition;
  baselineTarget: string | null | undefined;
}

function shortId(id: string, size = 24) {
  return id.length > size ? `${id.slice(0, size - 1)}…` : id;
}

export default function RelationshipField({ recordKey, sourceHint, targets, dispositionFor, baselineTarget }: RelationshipFieldProps) {
  const visible = targets.slice(0, 3);
  const positions = visible.length === 1 ? [147] : visible.length === 2 ? [96, 204] : [66, 150, 234];
  return (
    <div className="relationship-field" data-testid="atlas-relationship-field">
      <div className="field-top">
        <span><i aria-hidden="true" className="field-live-dot"/> RELATIONSHIP FIELD</span>
        <span>INSPECTION · DRAFT ONLY</span>
      </div>
      <svg viewBox="0 0 690 300" className="relationship-svg" role="img"
        aria-label={`${recordKey}: ${targets.length} known candidates. Lines show draft dispositions only; review is not adopted.`}>
        <defs>
          <pattern id="jw-rel-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#455777" /></pattern>
        </defs>
        <rect x="0" y="0" width="690" height="300" fill="url(#jw-rel-grid)" />
        {visible.map((t,i) => {
          const y = positions[i];
          const status = dispositionFor(t.targetId);
          const active = status !== "PROHIBITED";
          const baseline = t.targetId === baselineTarget;
          return (
            <g key={t.targetId}>
              <path d={`M282 150 C343 150 356 ${y} 408 ${y}`} fill="none"
                stroke={active ? (baseline ? "#A5BAFF" : "#90D9C7") : "#73809B"}
                strokeWidth={active ? 3 : 2} strokeDasharray={active ? undefined : "5 7"} />
              <circle cx="349" cy={(150+y)/2} r={active ? 4.5 : 3} fill={active ? "#A5BAFF" : "#73809B"}/>
              <rect x="408" y={y-32} width="254" height="64" rx="13"
                fill={active ? "#25375A" : "#1C2B44"}
                stroke={active ? "#728FF0" : "#4B5B76"}/>
              <text x="424" y={y-8} className="rel-svg-target">{shortId(t.targetId)}</text>
              <text x="424" y={y+16} className="rel-svg-caption">{status === "PROHIBITED" ? "Excluded in draft" : status === "POSSIBLE" ? "Possible in draft" : "Confirmed in draft"}{baseline ? "  ·  baseline" : ""}</text>
              <title>{t.targetId}: {status} (unadopted draft)</title>
            </g>
          );
        })}
        <rect x="25" y="110" width="257" height="80" rx="14" fill="#374ACF" stroke="#A6BCFF" strokeWidth="1.5" />
        <text x="43" y="137" className="rel-svg-eyebrow">SELECTED SOURCE</text>
        <text x="43" y="164" className="rel-svg-source">{shortId(recordKey, 27)}</text>
        <title>{recordKey}</title>
        {visible.length === 0 && <text x="328" y="150" className="rel-svg-empty">No candidate links registered</text>}
      </svg>
      <div className="field-bottom">
        <span>Source hint: <strong>{sourceHint ?? "None"}</strong></span>
        <span>{targets.length > 3 ? `+${targets.length - 3} more listed below` : `${targets.length} candidate${targets.length === 1 ? "" : "s"}`}</span>
      </div>
      <p className="field-authority-note">Visual inspection does not approve a match. Only explicit adoption submits decisions to the server.</p>
    </div>
  );
}
