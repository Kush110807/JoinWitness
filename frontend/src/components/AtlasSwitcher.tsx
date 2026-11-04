/** Decision Atlas scenario switcher: two explicit investigations.
 * Presentational only. Selecting a scenario never runs analysis, never
 * adopts a review, and never mixes proof state across investigations.
 */
export type AtlasScenario = "event" | "commerce";

interface AtlasSwitcherProps {
  value: AtlasScenario;
  onChange: (s: AtlasScenario) => void;
  disabled?: boolean;
}

export default function AtlasSwitcher({ value, onChange, disabled }: AtlasSwitcherProps) {
  return (
    <div className="atlas-switcher" role="group" aria-label="Choose investigation">
      <div className="atlas-switcher-label" aria-hidden="true">
        <span>01 / 02</span><strong>INVESTIGATIONS</strong>
      </div>
      <button type="button" className={`atlas-option ${value === "event" ? "is-selected" : ""}`}
        aria-pressed={value === "event"} disabled={disabled} onClick={() => onChange("event")}>
        <span className="atlas-option-mark" aria-hidden="true">A</span>
        <span className="atlas-option-copy"><strong>Case A · Event decision</strong><small>Attendance / registrations</small></span>
        <span className="atlas-option-arrow" aria-hidden="true">↗</span>
      </button>
      <button type="button" className={`atlas-option ${value === "commerce" ? "is-selected" : ""}`}
        aria-pressed={value === "commerce"} disabled={disabled} onClick={() => onChange("commerce")}>
        <span className="atlas-option-mark" aria-hidden="true">B</span>
        <span className="atlas-option-copy"><strong>Case B · Commerce decision</strong><small>Orders / payments / delivery / refunds</small></span>
        <span className="atlas-option-arrow" aria-hidden="true">↗</span>
      </button>
    </div>
  );
}
