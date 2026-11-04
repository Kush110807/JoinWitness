/** Illustrative entry graphic. Never shows a computed or verified result. */
interface AtlasSignalProps { mode: "event" | "commerce" }

export default function AtlasSignal({ mode }: AtlasSignalProps) {
  const commerce = mode === "commerce";
  return (
    <aside className="atlas-signal" aria-label="Illustration of an uncertain relationship">
      <div className="signal-topline">
        <span className="signal-pip" aria-hidden="true" />
        <span>DECISION FIELD / {commerce ? "COMMERCE" : "EVENT"}</span>
        <span className="signal-demo">ILLUSTRATIVE</span>
      </div>
      <div className="signal-heading">
        <span className="signal-overline">THE POSSIBILITY SPACE</span>
        <strong>One uncertain link.<br /><em>Different outcomes.</em></strong>
      </div>
      <svg className="signal-chart" viewBox="0 0 500 340" role="img"
        aria-label="Illustration: one source record connects to an original link and an alternative link. No actual data is analysed here.">
        <defs>
          <pattern id="atlas-dots" width="25" height="25" patternUnits="userSpaceOnUse">
            <circle cx="1.6" cy="1.6" r="1" fill="#324363" opacity=".7" />
          </pattern>
          <linearGradient id="atlas-wire" x1="0" x2="1">
            <stop offset="0" stopColor="#536bf5" />
            <stop offset="1" stopColor="#9ec6ff" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="500" height="340" fill="url(#atlas-dots)" />
        <path d="M178 160 C235 160 245 92 302 92" stroke="#8796b5" strokeWidth="2.5" strokeDasharray="6 8" fill="none" />
        <path d="M178 180 C232 180 250 250 302 250" stroke="url(#atlas-wire)" strokeWidth="3.5" fill="none" />
        <circle cx="236" cy="192" r="6" fill="#a4b8ff" />
        <circle cx="236" cy="192" r="15" fill="none" stroke="#8ba3ff" opacity=".5" />
        <rect x="24" y="122" width="154" height="106" rx="15" fill="#263653" stroke="#677caa" strokeWidth="1.5" />
        <text x="42" y="149" className="signal-svg-eyebrow">SOURCE RECORD</text>
        <text x="42" y="182" className="signal-svg-id">{commerce ? "DELIVERY D2" : "CHECK-IN T49"}</text>
        <text x="42" y="204" className="signal-svg-small">Relationship uncertain</text>
        <rect x="302" y="41" width="174" height="99" rx="15" fill="#1e2d45" stroke="#61708c" />
        <text x="320" y="66" className="signal-svg-eyebrow">ORIGINAL MATCH</text>
        <text x="320" y="95" className="signal-svg-id">{commerce ? "ORDER O2" : "GROUP A"}</text>
        <text x="320" y="118" className="signal-svg-small">Reported relationship</text>
        <rect x="302" y="200" width="174" height="99" rx="15" fill="#374acf" stroke="#a4b8ff" strokeWidth="1.5" />
        <text x="320" y="225" className="signal-svg-eyebrow alt">ALTERNATIVE</text>
        <text x="320" y="255" className="signal-svg-id">{commerce ? "ORDER O3" : "GROUP B"}</text>
        <text x="320" y="278" className="signal-svg-small alt">Requires human approval</text>
      </svg>
      <div className="signal-footline">
        <span><i className="signal-legend-dash" aria-hidden="true" /> Original</span>
        <span><i className="signal-legend-line" aria-hidden="true" /> Possible alternative</span>
        <span className="signal-notice">Not a verified result</span>
      </div>
    </aside>
  );
}
