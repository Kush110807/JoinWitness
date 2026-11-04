/** Verified challenge visual, rendered exclusively from server-provided result fields. */
interface DecisionShiftProps {
  baseline: { clean_fulfilled_count: number; decision: boolean };
  alternative: { clean_fulfilled_count: number; decision: boolean };
  total: number;
  thresholdK: number;
  changedLinks: number;
}
export default function DecisionShift({ baseline, alternative, total, thresholdK, changedLinks }: DecisionShiftProps) {
  const width = 360;
  const x = (v: number) => 28 + (width * Math.min(Math.max(v, 0), Math.max(total, 1))) / Math.max(total, 1);
  return (
    <section className="decision-shift" aria-label="Verified impact of the permitted matching change">
      <div className="shift-head">
        <span className="shift-eyebrow">VERIFIED DECISION SHIFT</span>
        <span className="shift-scope">Within reviewed alternatives only</span>
      </div>
      <div className="shift-metrics">
        <div><span>ORIGINAL</span><strong>{baseline.clean_fulfilled_count}<small> / {total}</small></strong><em>{baseline.decision ? "Meets threshold" : "Below threshold"}</em></div>
        <div className="shift-arrow" aria-hidden="true">→<small>{changedLinks} link{changedLinks === 1 ? "" : "s"} changed</small></div>
        <div><span>ALTERNATIVE</span><strong>{alternative.clean_fulfilled_count}<small> / {total}</small></strong><em>{alternative.decision ? "Meets threshold" : "Below threshold"}</em></div>
      </div>
      <svg className="shift-plot" viewBox="0 0 420 104" role="img"
        aria-label={`Clean fulfilment moves from ${baseline.clean_fulfilled_count} to ${alternative.clean_fulfilled_count} of ${total} orders. Threshold is ${thresholdK}.`}>
        <line x1="28" y1="24" x2="388" y2="24" stroke="#D7E0ED" strokeWidth="8" strokeLinecap="round" />
        <line x1="28" y1="77" x2="388" y2="77" stroke="#D7E0ED" strokeWidth="8" strokeLinecap="round" />
        <line x1="28" y1="24" x2={x(baseline.clean_fulfilled_count)} y2="24" stroke="#536AF5" strokeWidth="8" strokeLinecap="round" />
        <line x1="28" y1="77" x2={x(alternative.clean_fulfilled_count)} y2="77" stroke="#16A389" strokeWidth="8" strokeLinecap="round" />
        <line x1={x(thresholdK)} y1="7" x2={x(thresholdK)} y2="94" stroke="#9C6920" strokeWidth="2" strokeDasharray="4 4"/>
        <circle cx={x(baseline.clean_fulfilled_count)} cy="24" r="8" fill="#344ED4" stroke="#fff" strokeWidth="3" />
        <circle cx={x(alternative.clean_fulfilled_count)} cy="77" r="8" fill="#12896F" stroke="#fff" strokeWidth="3" />
        <text x="28" y="101" fontSize="10" fill="#637083">0</text>
        <text x="388" y="101" fontSize="10" textAnchor="end" fill="#637083">{total}</text>
        <text x={x(thresholdK)} y="7" fontSize="10" textAnchor="middle" fill="#9C6920">K={thresholdK}</text>
      </svg>
      <p>Each count and decision comes from the completed, independently checked server challenge.</p>
    </section>
  );
}
