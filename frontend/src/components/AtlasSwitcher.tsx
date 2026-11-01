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
      <button
        type="button"
        className={`atlas-option ${value === "event" ? "is-selected" : ""}`}
        aria-pressed={value === "event"}
        disabled={disabled}
        onClick={() => onChange("event")}
      >
        <strong>Case A · Event decision</strong>
        <small>Attendance vs registrations · two files · verified path</small>
      </button>
      <button
        type="button"
        className={`atlas-option ${value === "commerce" ? "is-selected" : ""}`}
        aria-pressed={value === "commerce"}
        disabled={disabled}
        onClick={() => onChange("commerce")}
      >
        <strong>Case B · Commerce decision</strong>
        <small>Orders, payments, deliveries, refunds · four files · new</small>
      </button>
    </div>
  );
}
