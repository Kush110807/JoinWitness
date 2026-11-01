/** Commerce server-validated source inspector: four read-only source layers.
 * Presentational and view-only: every row comes from the accepted `/parse`
 * `validated_source_rows`. Selecting or viewing a row never grants link
 * permission. Candidates are source hints, not accepted links.
 */
import type { CommerceParseResponse } from "../lib/commerceApi";
import type { CommerceCatalogTarget } from "../lib/commerceDraft";

function provenanceBadges(origins: CommerceCatalogTarget["origins"]) {
  return origins.map((o) => (
    <span
      key={o}
      className={`prov prov-${o === "SOURCE_REF" ? "source" : o === "META_SUGGESTED" ? "meta" : "manual"}`}
    >
      {o === "SOURCE_REF" ? "Source hint" : o === "META_SUGGESTED" ? "Meta suggestion" : "Manual"}
    </span>
  ));
}

interface CommerceSourceInspectorProps {
  parse: CommerceParseResponse;
  catalog: CommerceCatalogTarget[];
  adopted: boolean;
}

export default function CommerceSourceInspector({
  parse,
  catalog,
  adopted,
}: CommerceSourceInspectorProps) {
  const rows = parse.validated_source_rows;
  const counts = parse.row_counts;
  return (
    <div className="commerce-inspector">
      <p aria-live="polite">
        Status: <code>{parse.state}</code> · Orders: <strong>{counts.orders}</strong> · Payments:{" "}
        <strong>{counts.payments}</strong> · Deliveries: <strong>{counts.deliveries}</strong> ·
        Refunds: <strong>{counts.refunds}</strong>
      </p>
      <p className="muted mono-wrap">
        Source bundle SHA-256: <code>{parse.source_bundle_sha256}</code>
      </p>
      <div className="digest-grid" aria-label="Per-file source digests">
        {(Object.keys(parse.file_sha256) as Array<keyof typeof parse.file_sha256>).map((name) => (
          <p key={name} className="muted mono-wrap">
            {name}: <code>{parse.file_sha256[name].slice(0, 12)}…</code>
          </p>
        ))}
      </div>

      <div className="inspector-scroll">
        <details className="evidence-details" open>
          <summary>
            Orders layer · {rows.orders.length} validated {rows.orders.length === 1 ? "row" : "rows"}
          </summary>
          <div className="table-scroll">
            <table aria-label="Validated orders source rows">
              <thead>
                <tr>
                  <th>Source row</th>
                  <th>order_id</th>
                  <th>customer_id</th>
                  <th>order_total</th>
                  <th>currency</th>
                </tr>
              </thead>
              <tbody>
                {rows.orders.map((r) => (
                  <tr key={r.order_id}>
                    <td>{r.source_row_number}</td>
                    <td>
                      <code>{r.order_id}</code>
                    </td>
                    <td>
                      <code>{r.customer_id}</code>
                    </td>
                    <td>{r.order_total}</td>
                    <td>{r.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <details className="evidence-details" open>
          <summary>
            Payments layer · {rows.payments.length} validated{" "}
            {rows.payments.length === 1 ? "row" : "rows"}
          </summary>
          <div className="table-scroll">
            <table aria-label="Validated payments source rows">
              <thead>
                <tr>
                  <th>Source row</th>
                  <th>payment_id</th>
                  <th>order_ref</th>
                  <th>amount</th>
                  <th>currency</th>
                  <th>status</th>
                </tr>
              </thead>
              <tbody>
                {rows.payments.map((r) => (
                  <tr key={r.payment_id}>
                    <td>{r.source_row_number}</td>
                    <td>
                      <code>{r.payment_id}</code>
                    </td>
                    <td>{r.order_ref === "" ? <em>missing hint</em> : <code>{r.order_ref}</code>}</td>
                    <td>{r.amount}</td>
                    <td>{r.currency}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <details className="evidence-details" open>
          <summary>
            Deliveries layer · {rows.deliveries.length} validated{" "}
            {rows.deliveries.length === 1 ? "row" : "rows"}
          </summary>
          <div className="table-scroll">
            <table aria-label="Validated deliveries source rows">
              <thead>
                <tr>
                  <th>Source row</th>
                  <th>delivery_id</th>
                  <th>order_ref</th>
                  <th>status</th>
                </tr>
              </thead>
              <tbody>
                {rows.deliveries.map((r) => (
                  <tr key={r.delivery_id}>
                    <td>{r.source_row_number}</td>
                    <td>
                      <code>{r.delivery_id}</code>
                    </td>
                    <td>{r.order_ref === "" ? <em>missing hint</em> : <code>{r.order_ref}</code>}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <details className="evidence-details" open>
          <summary>
            Refunds layer · {rows.refunds.length} validated{" "}
            {rows.refunds.length === 1 ? "row" : "rows"}
          </summary>
          <div className="table-scroll">
            <table aria-label="Validated refunds source rows">
              <thead>
                <tr>
                  <th>Source row</th>
                  <th>refund_id</th>
                  <th>payment_ref</th>
                  <th>amount</th>
                  <th>status</th>
                </tr>
              </thead>
              <tbody>
                {rows.refunds.map((r) => (
                  <tr key={r.refund_id}>
                    <td>{r.source_row_number}</td>
                    <td>
                      <code>{r.refund_id}</code>
                    </td>
                    <td>
                      {r.payment_ref === "" ? <em>missing hint</em> : <code>{r.payment_ref}</code>}
                    </td>
                    <td>{r.amount}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <h3>Candidate relationships under review ({catalog.length})</h3>
      <p className="muted">
        {adopted
          ? "Each candidate below was covered by your accepted review snapshot. Only the explicit Adopt action records review decisions."
          : "Each candidate below is an unreviewed proposal — a source hint, a Meta suggestion, or your manual draft. Viewing it grants no permission."}
      </p>
      {catalog.length === 0 ? (
        <p className="muted">No candidates registered. Every row can still be explicitly unmatched.</p>
      ) : (
        <ul className="candidate-list">
          {catalog.map((t) => (
            <li key={`${t.recordKey}-${t.targetId}`}>
              <code>{t.recordKey}</code> → <code>{t.targetId}</code>{" "}
              {provenanceBadges(t.origins)}{" "}
              <small className="unrev">
                {adopted ? "covered by accepted review" : "unreviewed — not permitted"}
              </small>
              {t.metaEvidence.map((m) => (
                <span key={m.serverCallId} className="meta-evidence">
                  Server note: {m.evidence} (call <code>{m.serverCallId.slice(0, 12)}…</code>)
                </span>
              ))}
              {t.manualReason && <span className="meta-evidence">Reason: {t.manualReason}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
