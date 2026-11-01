# JoinWitness Commerce Decision Contract — G1-B03 bounded wire-correction draft

**Proposed repository destination:** `docs/COMMERCE_CONTRACT.md`  
**Authored by:** Chat B, Principal Commerce Decision-Modelling Lead  
**Date:** 2026-11-01 · **contract version:** `commerce.v1` · **state:** `G1_B03_DRAFT_FOR_A_AND_D_REVIEW`, **NOT FROZEN**  
**Authority:** proposed JW-HQ-4.0 Final Execution Charter + Chat B commerce brief + shared G1 interface checklist. These sources define the boundaries but do **not** predefine the API. Choices below are Chat B proposals, not inherited implementation facts. Preserve all frozen JW-RD-3.0 / T02–T08 event contracts. No production or repository write was made to prepare this document.

## 1. Invariants and scope

The commerce scenario is a separately namespaced, four-file vertical slice. Its **only** decision is `clean_fulfilled_count >= K`; **K must be declared, human reviewed and frozen before Challenge**. All **N** source orders form the denominator, including those without payments or deliveries. Clean fulfilment is a deliberately narrow predicate, not real accounting, reconciliation, tax, merchant settlement, or a generic CSV join engine.

- Exactly **four named files**. `1 <= N_orders <= 50`; each of payments, deliveries and refunds has **0–60** rows. All four files are required, including header-only files. Zero orders is rejected.
- Up to **10 variable source records** (each record chooses one target or null), at most **two alternatives in addition to its frozen baseline**; hence 1–3 authorised choices per variable. Null/unmatched is a choice and consumes one slot. No more than **4,096 raw Cartesian combinations before constraint filtering**; reject instead of truncating. A separate 4,096 admissible-world check is also enforced. Example: ten 3-choice variables exceed the cap even if constraints would later eliminate most combinations.
- Every non-order record is explicitly assigned **one** reviewed target or an explicitly authorised unmatched choice in each world; no multi-link allocation. Fixed records each have a single confirmed option and do not increase variable count. No implicit candidate, no silent fuzzy matching, no AI adoption. Only fully covered and human-attested reviews can freeze.
- All statuses/results must carry their **scope, proof basis, coverage, independent-checker state and revision**. A timeout, contradiction, cap failure, unavailable model or stale epoch must never appear as evidence of stability. Nothing in this contract changes the event path.
- All examples below are **contract-shaped hypothetical fixtures, not observed backend results**. Although fixture byte SHA-256 digests are computed from the shown sample bytes, search outcomes, timings, run IDs and checker outcomes are illustrations awaiting G2 execution.

### 1.1 CSV wire grammar (normative proposal)

Requests transport byte-exact files as padded RFC 4648 `content_base64` in JSON; frontend may use native file selection but **must read original bytes**, not decode/re-encode with silent replacement. Server strictly decodes Base64, then UTF-8 (no BOM or invalid encodings); 64 KiB maximum per file, 256 KiB combined. CSV uses comma delimiter, RFC-4180 quoting, LF or CRLF record separators, optional final newline; **no embedded newlines in fields**, blank physical lines, control characters, extra columns, duplicate headers, guessed headers, or extra files. Header order/names are exact and case-sensitive. Parsed cells must match the grammars below; whitespace is never trimmed silently. Only the three `*_ref` cells may be empty; empty means **missing source reference**, never an automatically authorised unmatched assignment.

| File / exact headers | Field validity / semantics |
|---|---|
| `orders.csv`: `order_id,customer_id,order_total,currency` | `order_id` globally unique *within orders*; customer may own multiple orders. `order_total` positive fixed two-decimal amount; currency `USD` or `INR`. |
| `payments.csv`: `payment_id,order_ref,amount,currency,status` | `payment_id` unique within payments. `order_ref` empty or an existing order ID, **source hint only**. `amount` positive two-decimal amount, currency `USD` or `INR`, `status` `SETTLED`, `PENDING`, `FAILED` or `VOIDED`. |
| `deliveries.csv`: `delivery_id,order_ref,status` | `delivery_id` unique within deliveries. `order_ref` empty or an existing order ID, source hint only. `status` `DELIVERED`, `IN_TRANSIT` or `CANCELLED`. |
| `refunds.csv`: `refund_id,payment_ref,amount,status` | `refund_id` unique within refunds. `payment_ref` empty or an existing payment ID, source hint only. `amount` positive two-decimal amount, `status` `COMPLETED`, `PENDING`, `FAILED` or `CANCELLED`. |

**Identifiers** (`order_id`, `customer_id`, `payment_id`, `delivery_id`, `refund_id`, nonempty references): ASCII regex `^[A-Z][A-Z0-9_-]{0,31}$`; case-sensitive, no Unicode confusables, no spaces. Different tables have **distinct namespaces**; `O1` as a customer ID and order ID is not by itself a collision. **Money**: ASCII regex `^(0|[1-9][0-9]{0,8})\.[0-9]{2}$`, must be strictly positive and at most `999999999.99`, exactly converted to integer cents (no floats, rounding, scientific notation, `NaN`, currency conversions or negative numbers). Source order matters for file hash only, not record/policy ordering.

**Import errors:** wrong/missing/extra headers or files → `INVALID_SCHEMA`/`MISSING_FILE`/`UNEXPECTED_FILE`; malformed Base64/UTF-8/CSV → `INVALID_SOURCE`; malformed field/status/money/ID → `INVALID_VALUE`; duplicate primary ID in a table → `DUPLICATE_ID`; *exact semantic duplicate* under distinct IDs with all remaining table columns equal → `DUPLICATE_EVENT` (conservative narrow policy); nonempty reference absent from its parent file → `MISSING_REFERENCED_RECORD`; size/row cap → `LIMIT_EXCEEDED`. No values or IDs are fixed or deduplicated silently; customer IDs are not unique by design. Header-only additional files and missing source references are supported.

### 1.2 Source hashes, reproducibility and canonicalisation

Compute per-file SHA-256 on **original decoded bytes** before parsing. Source bundle SHA-256 is the UTF-8 SHA-256 of the ASCII sequence `JW-COMMERCE-SOURCES-v1\n` followed by exactly four lines `filename:lowercase_hex_sha256\n` in the order orders, payments, deliveries, refunds. Thus LF/CRLF, quoting and record order remain byte-significant even when parsed meaning matches. No raw files need be embedded in the receipt; replay **requires** all four original bytes again.

For policy, baseline, review and receipt digests: `CJSON(object)` = JSON UTF-8 with keys sorted lexicographically, no insignificant whitespace, ASCII-only permitted string values for wire-owned identifiers/reasons in v1, integers/bools/null only (no floats). Hash `SHA256(UTF8(domain + "\n") || CJSON(payload))` with domains `JW-COMMERCE-CANDIDATES-v1`, `JW-COMMERCE-POLICY-v1`, `JW-COMMERCE-BASELINE-v1`, `JW-COMMERCE-REVIEW-v1`, `JW-COMMERCE-RECEIPT-v1`. Candidate catalog arrays are sorted by typed record order (payment, delivery, refund), ASCII ID, then target; policy row arrays have the same order, and edges are sorted by target; other array order is explicit and preserved. The receipt checksum excludes its own `receipt_sha256`. In v1 reason/reviewer strings are printable ASCII, 1–200 chars, to eliminate cross-language Unicode canonicalisation ambiguity. **SHA-256 is an integrity comparison, not authentication or a cryptographic signature.** Version/build identity must be taken from a deployed server manifest, not invented by UI.

### 1.3 G1-B02 exact baseline/review digest byte vectors (normative; deterministic test fixture)

The **hash payload** is the *minimal object below*, NOT the full review request or response and NOT the receipt. Compute `SHA256(ASCII(domain) + 0A + UTF8(CJSON(payload)))`, where `0A` is one LF byte **after the domain**, there is **no LF after the final `}`**, object keys are lexicographically sorted and JSON has no spaces. A `policy_sha256` binds `threshold_k`, the candidate catalog and human review contents as defined above; the baseline binds the selected mapping through that policy; the review binds both. Revisions and random session IDs are **not** fields in these two digest payloads: monotonic revision CAS and receipt epoch metadata provide separate anti-stale checks. Do not interpret a repeated hash after policy re-adoption as a current-session result.

**Baseline vector** — exact canonical JSON payload (UTF-8 ASCII), `234` bytes:

```json
{"policy_sha256":"cc07bdc869ad4c8f2ad1bbadbb8c853404cbd03701c6baee45111d998ca0ffba","reference_mapping":{"delivery:D1":"O1","delivery:D2":"O2","delivery:D3":"O3","payment:P1":"O1","payment:P2":"O2","payment:P3":"O3","refund:R1":"P3"}}
```

- Prefix bytes: UTF-8 `JW-COMMERCE-BASELINE-v1` then exactly `0a`.
- Expected baseline SHA-256: `49cf0a9061605aa42b5735d130a9c9eb1ad692860119fd62c753dd0538c8fd74`.

**Review vector** — exact canonical JSON payload (UTF-8 ASCII), `169` bytes:

```json
{"baseline_sha256":"49cf0a9061605aa42b5735d130a9c9eb1ad692860119fd62c753dd0538c8fd74","policy_sha256":"cc07bdc869ad4c8f2ad1bbadbb8c853404cbd03701c6baee45111d998ca0ffba"}
```

- Prefix bytes: UTF-8 `JW-COMMERCE-REVIEW-v1` then exactly `0a`.
- Expected review SHA-256: `152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9`.

Reproduction (specification-only example, no engine execution):

```python
import hashlib, json

def digest(domain, obj):
    canonical = json.dumps(obj, ensure_ascii=False, sort_keys=True,
                           separators=(',', ':'), allow_nan=False).encode('utf-8')
    return hashlib.sha256((domain + '\n').encode('ascii') + canonical).hexdigest()

from pathlib import Path
sample = json.loads(Path('docs/COMMERCE_API_EXAMPLES.json').read_text('utf-8'))
request = sample['review_validate']['valid_request']
response = sample['review_validate']['valid_response']
baseline_payload = {
    'policy_sha256': response['policy_sha256'],
    'reference_mapping': request['reference_mapping'],
}
review_payload = {
    'policy_sha256': response['policy_sha256'],
    'baseline_sha256': response['baseline_sha256'],
}
assert digest('JW-COMMERCE-BASELINE-v1', baseline_payload) == \
    '49cf0a9061605aa42b5735d130a9c9eb1ad692860119fd62c753dd0538c8fd74'
assert digest('JW-COMMERCE-REVIEW-v1', review_payload) == \
    '152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9'
```

Reject duplicate JSON keys at decode time, and canonicalise **parsed schema-authorised values**, never unsanitised client-supplied hashes. A human reason's original text is preserved inside policy bytes (no trimming), and ordering of arrays is as defined in §1.2. This vector is for the hypothetical fixture and is **not a witnessed engine run**.

### 1.4 W02 — backend-validated source inspector returned by `/parse` (normative)

Successful `201 /parse` **must** include `validated_source_rows`: an object with exactly four named array properties `orders`, `payments`, `deliveries`, `refunds`. Each element is a validated, **read-only copy of source cell text**, plus `source_row_number` (positive integer, header is physical row 1 and first data row is 2). Field names and wire types are fixed; every row contains exactly the listed keys (no omitted optional source column). Source records are returned **in original physical CSV row order**, including header-only files as `[]`. With embedded physical linebreaks prohibited by §1.1, `source_row_number` exactly identifies the original line. It does not refer to a sorted candidate index, frontend DOM key, reviewer row index, or runtime database ID:

| Table | Element keys / types (in addition to `source_row_number: integer`) | Validation and maximum items |
|---|---|---|
| `orders` | `order_id: string`, `customer_id: string`, `order_total: string`, `currency: "USD"|"INR"` | All original cell strings pass §1.1; 1–50 rows. |
| `payments` | `payment_id: string`, `order_ref: string`, `amount: string`, `currency: "USD"|"INR"`, `status: "SETTLED"|"PENDING"|"FAILED"|"VOIDED"` | `order_ref` may be the empty string; 0–60 rows. |
| `deliveries` | `delivery_id: string`, `order_ref: string`, `status: "DELIVERED"|"IN_TRANSIT"|"CANCELLED"` | `order_ref` may be empty; 0–60 rows. |
| `refunds` | `refund_id: string`, `payment_ref: string`, `amount: string`, `status: "COMPLETED"|"PENDING"|"FAILED"|"CANCELLED"` | `payment_ref` may be empty; 0–60 rows. |

Amounts remain validated **two-decimal ASCII strings**, not unsafe JSON floats; refs, statuses and identifiers are not silently normalised, guessed or edited. All rows are decoded **only** from the immutable uploaded file bytes already reflected in `file_sha256` and `source_bundle_sha256`, under `source_revision=1` and the returned `session_id`. The read view has **no independent, separately writable digest**: it is derived from the exact file bytes, and re-encoding it never replaces the authoritative source hash or original file. The server must not accept a caller-supplied `validated_source_rows` in any endpoint. `candidate_revision` and policy edits do not change this read view. A new import returns a **different session and bound source digest**; rows from a stale session cannot be mixed into a current review.

Expose all 4 tables to the same-origin **loopback-only** frontend under §3.2, never through a persistent/public source listing. The response is bounded to **230 source rows in total** and at most **64 KiB of UTF-8 JSON bytes for `validated_source_rows`**, with an additional overall **128 KiB parse response** limit; fail with safe `LIMIT_EXCEEDED` rather than truncate. Under §1.1 field grammars, the row caps constrain output; both response limits must still be checked. This does **not** add a hydration endpoint, cross-refresh restoration, public storage, or licence to call locally decoded previews `backend-validated`. Show `source_row_number` and `source_bundle_sha256` together in a read-only inspector.

## 2. Graph, candidate provenance and collision rules

Only three edge types exist: `payment:P -> order:O`, `delivery:D -> order:O`, and `refund:R -> payment:P`. `record_key` is the literal `payment:ID`, `delivery:ID`, `refund:ID`. All references are **hints**, not matching authority. On parse, produce exactly one deterministic `SOURCE_REF` candidate for each nonempty, existing source ref; no candidate is marked authorised. Blank refs yield no deterministic edge. Deterministic order is typed record order payment → delivery → refund, then ASCII ID, then ASCII target. There is **no hidden fuzzy fan-out or automatic all-to-all candidate set**. An alternative may be introduced by explicit human `manual_candidates` (reason required) or an optional bounded Meta suggestion. All proposals, including source-reference candidates and Meta proposals, must receive a visible reviewer disposition; unreviewed proposal presence blocks freeze. A candidate missing from sources or failing type/currency/amount guards is rejected, never auto-dropped.

- `payment -> order`: same currency mandatory. Payment amount **may be less than or equal** to order amount; payment amount greater than order amount is invalid for that edge. A `SETTLED` payment counts as payment proof only if amount equals the **full** order total. Partial settled payments do not combine into one full payment.
- `delivery -> order`: typed target must exist. A `DELIVERED` delivery counts only for its assigned order. `IN_TRANSIT` and `CANCELLED` do not count.
- `refund -> payment`: typed target must exist; refund amount <= payment amount in cents; no currency inference from the refund file (currency inherited from the linked payment). Any assigned `COMPLETED` positive refund disqualifies the payment's assigned order, **even if partial**. An explicitly permitted unmatched completed refund is disclosed, but cannot be used as evidence that an order is clean if that order otherwise lacks qualifying payment/delivery proof.
- **Hard per-world collisions:** more than one `SETTLED` payment assigned to one order, more than one `DELIVERED` delivery assigned to one order, or more than one `COMPLETED` refund assigned to one payment makes the entire world **inadmissible**. Other distinct-ID, nonqualifying events may coexist unless semantically exact duplicates on import. No first-wins / latest-wins / sum-of-payments / duplicate suppression.
- Zero qualifying settlement or delivery is a legitimate **not clean** outcome, not an import error. Reference records with missing *links* may be assigned only through explicitly reviewed choices. Referenced *unknown target IDs* are an import error; no synthetic placeholder parent creation.
- For each admissible world and each order `o`, clean iff (i) exactly one assigned `SETTLED` payment with matching full cents and currency; (ii) exactly one assigned `DELIVERED` delivery; and (iii) no `COMPLETED` refund linked to **any** payment assigned to `o`. Each clean order is counted **once**. Never count raw payment/delivery rows or infer cleanliness from an unmatched/unknown candidate.

### 2.1 W01/W03 — optional Meta proposals, immutable server provenance and distinct choices

`POST /suggest` is strictly optional, with `mode="META"` and integer `1 <= max_suggestions <= 5`. A successful bounded provider call returns HTTP `200`, `ai_status="AI_SUGGESTED"`, `model_call={provider:"META", model:"muse-spark-1.3", server_call_id:string, execution:"SERVER_RESPONSE_RECEIVED"}`, `rejected_proposals[]` (only safe `{reason_code,count}` aggregates), and `suggestions[]`. The server—not a browser or model text—generates an ASCII opaque **per-call** `server_call_id` and stores a token-redacted attribution record; this string in an example/response **claims** a call, but is **not evidence that a real G4 call occurred**. Actual proof needs a separately authenticated, time-bound server-side request/response trace and D's verification; the wire may never expose credentials, raw prompt, untrusted model prose, user-uploaded unredacted data, or hidden provider tokens. The example `example-srv-call-*` values are **illustrative**, not live call IDs.

Every accepted `suggestions[]` entry is a typed object with exactly `record_type` (`payment|delivery|refund`), `record_id` (valid source ID), derived `record_key`, `target_type` (`order` for payment/delivery, `payment` for refund), `target_id` (existing typed target), `origin="META_SUGGESTED"`, safe ASCII `evidence` (bounded 1–200 chars), server `server_call_id`, `catalog_effect` (`ADDED_TARGET|ADDED_PROVENANCE|EXISTING_PROVENANCE_NO_OP`) and `authorised=false`. Suggestion `record_key` must match the typed ID; validate target type, amount/currency guards and all §1.1 grammar before catalog publication. Server sanitises its own evidence summary; **no raw provider text** reaches the client. Invalid model-proposed rows are ignored **as candidates** and counted only by `rejected_proposals` codes such as `INVALID_TARGET`, never silently authorised or presented as matching facts. An invalid client request is a typed `422 INVALID_VALUE`; a provider failure can return `200 AI_UNAVAILABLE`, `model_call=null`, `suggestions=[]`, `catalog_changed=false`, with deterministic review still available (or safe `503`/`429` under service restrictions). A completed call proposing only duplicates or invalid targets may return `AI_SUGGESTED` with no catalogue change; no inference or network call is implied by a local fixture.

The *selection identity* is exactly `(record_key,target_id)`, regardless of origin. The *provenance identity* additionally includes an origin class. Canonical candidate catalog entries remain the §1.2 array: `SOURCE_REF` entries retain their existing B02 fields; `MANUAL` entries retain the reviewed reason; `META_SUGGESTED` entries include `record_key`, `target_id`, `origin`, safe `evidence`, `provider="META"`, `model="muse-spark-1.3"`, and the registered `server_call_id`. When source and Meta propose **the same pair**, preserve both distinct origin entries, sorted by typed record, ASCII ID, target and finally origin, but expose **one** selectable edge and exactly one `rows[].edges[]` disposition. `ADDED_PROVENANCE` increments `candidate_revision` once because the canonical catalog bytes changed; it does not add an option. A later repeated Meta proposal for an already registered Meta pair/origin returns `EXISTING_PROVENANCE_NO_OP`, with the current call's attribution in the *response* and append-only redacted server trace, but keeps the earliest registered candidate provenance unchanged, so the catalog digest and candidate revision do not change. A new target registers `ADDED_TARGET` and increments the revision. Multiple accepted proposals in a single call produce at most **one** revision increment. This applies even if suggestion origin duplicates an existing source edge. `catalog_changed` truthfully indicates a committed change and `authorisations_changed` is **always false** for `/suggest`. The response also returns `state`, copied from the actual locked session state: `IMPORTED` on a material suggestion change, otherwise the preserved current state (`IMPORTED` or `REVIEW_FROZEN`).

All candidate changes (including new provenance or a permitted server-side revocation due to invalid/withdrawn model-call attribution) must be serialised with §3.1 revision CAS, invalidate any earlier accepted review/run/receipt, and return to `IMPORTED`; no newly accepted edge is automatically permitted. A stale provider callback is rejected `STALE_STATE` with **no commit**. Revoked Meta proposals are absent from the *active* catalogue, have `candidate_revision` incremented, cannot be adopted by stale forms and need a complete re-review; the client cannot self-revoke a catalogue entry using `manual_candidates` or spoof a revoked origin. If a dropped proposal was the only permissible link, any old policy is stale and must be reconstructed or re-imported. No new revoke endpoint is granted.

## 3. Human review, frozen reference and state

`review/validate` accepts a **complete replacement snapshot**, not a patch. Exactly one `rows[]` entry is required for every payment/delivery/refund source row, even if a file has no candidates. Every surfaced `SOURCE_REF`, `META_SUGGESTED` and `MANUAL` candidate must be present with `disposition` `CONFIRMED`, `POSSIBLE`, or `PROHIBITED`. `unmatched` is `CONFIRMED`, `POSSIBLE`, or `PROHIBITED`, explicitly on every row. `CONFIRMED` means the **only** admissible choice for that row (all other candidates and unmatched must be `PROHIBITED`); no conflicting confirmations. At least one possible/confirmed choice must remain per row. `POSSIBLE` alternatives are authorised uncertainty, **not asserted truth**. Prohibited edges are never enumerated. A manual edge that contradicts a nonempty source reference requires a human reason and explicit `conflicting_source_ref_overrides_explained=true`; a suggested Meta edge must first be explicitly adopted into reviewed options. An `unmatched` choice is literal JSON `null` in `reference_mapping`.

`reference_mapping` must explicitly contain exactly one key for **every** non-order row; chosen target must be within admitted choices and must itself form an admissible world. It is the **human-adopted baseline**; no silent adoption of the source ref, model suggestion, or first candidate. `reviewer_label` is display metadata, **not authenticated identity**; public deployment must separately supply real authentication/authorisation (HQ/security gate). `review_attestation` is required as a human assertion and independently checked for complete row coverage; a checked box alone is never proof of review.

Freeze `threshold_k` as an integer `1 <= K <= N_orders`, not boolean/string. Freeze source digest, entire candidate registry and provenance, review decisions, attestation, reference mapping and K into one versioned state with `source_revision`, `candidate_revision`, and `policy_revision`. The candidate catalog begins at revision 1. A new distinct Meta suggestion increments `candidate_revision`, makes any existing review/challenge stale and requires re-review; no-op AI unavailability does not increment it. A manual candidate inserted in an accepted `review/validate` request likewise increments candidate revision **once for that atomic validated transaction**; the example starts at 1 and commits to 2. Every review request must compare `expected_candidate_revision` as well as both other expected revisions. A successful review snapshot derives and freezes a `candidate_catalog_sha256` over the complete typed source-reference, Meta and manual catalog. This catalog and its explanations must be copied into the receipt for stateless replay. On a new review snapshot, **increment policy revision and invalidate all prior Challenge/receipt availability in that session**, including if only threshold, reviewer permissions, candidate set, baseline or attestation changes. Reparse/new bytes create a new immutable session. A stale client response from older source/candidate/policy revision must be dropped; old exported receipts remain **historically replayable** with original data but cannot be presented as current-session findings. Never reuse a previous result after mutation.

**W05 — HQ decision:** `RECEIPT_READY` is **internal-only** in `commerce.v1`; `/receipt` is not required to return a `state` property. The UI may display “receipt exported” only when it actually receives a valid successful `/receipt` response, not on starting a request or from an invented server transition. No saved session hydration, refresh recovery or public persistence is promised; a reload with lost local session state or `SESSION_EXPIRED` requires a new Import/Review. An exported old receipt may still be historically replayed with exact original file bytes and is never a recovered live session.

State transitions: `IMPORTED` -> `REVIEW_FROZEN` -> `CHALLENGED` -> `RECEIPT_READY`. Failed validation leaves the prior frozen state unchanged; any valid replacement review reverts to `REVIEW_FROZEN` and invalidates downstream runs. Suggestions only add untrusted proposed candidates and force review refresh; an unavailable suggestion returns `AI_UNAVAILABLE` without granting permissions. Sessions are isolated, randomly identified, server-held, short-lived and never trust frontend-supplied digests. **Local development mode is not authenticated per-user isolation**; the development-only security boundary below is a proposed minimum and public deployment remains blocked pending HQ/D sign-off.

### 3.1 G1-B02 candidate insertion, version CAS and atomic stale-state rule (normative)

**Full replacement, never implicit mutation.** `manual_candidates[]` in each `POST /review/validate` request is the **complete desired manual-candidate catalog** for that session, not an append-only delta. A reviewer may propose a new typed, existing, guard-valid `record_key -> target_id` with a nonempty printable-ASCII reason. A proposed duplicate `(record_key,target_id)` already in a source or Meta catalog is **not** a second selectable alternative: reject it as `INVALID_REVIEW` with a candidate-collision path rather than silently double-count it. Exact duplicate manual entries are also rejected. Source-ref or Meta catalog entries are not deleted by a manual replacement. A change of manual reason is a material catalog change. The review `rows[]` must cover **every** distinct candidate target from the proposed post-insertion catalog, with exactly one disposition per `(record_key,target_id)` even when suggestions carry multiple provenance entries. All candidates remain untrusted until explicit review; `POSSIBLE` is permission for enumeration, not adjudicated identity truth.

**Compare-and-swap preconditions.** Lock the server-held session before reading or writing its mutable state. Under the **same lock**, verify request `session_id`, `expected_source_revision`, `expected_candidate_revision` and `expected_policy_revision` against current values, then build a **provisional** proposed candidate catalog, review policy, full mapping, threshold and hashes. Validate all types, row coverage, explicit source conflicts, authorised options, collision feasibility, world caps and baseline. On **any** validation failure, conflict or stale compare, commit **nothing**: preserve catalog, all revisions, current policy/run/receipt and state. Return the typed `422` or `409` error. No partial manual-candidate insertion is allowed.

On success, publish one indivisible state transition: (a) replace the manual catalog; (b) increment `candidate_revision` **by one iff its canonical catalog bytes changed**, including a manual addition/removal/reason edit; (c) increment `policy_revision` **by one for every accepted complete replacement**, even if the resulting review bytes are identical; (d) assign canonical candidate/policy/baseline/review digests; (e) invalidate the prior Challenge/current receipt/run eligibility; and (f) set `state=REVIEW_FROZEN`. Return only the committed revisions and hashes. The source epoch remains immutable in a session (`source_revision=1`; new upload = new session). All read/challenge/export operations must compare epoch and, for run export, current run identity under this same session lock (or equivalent serialisable snapshot check). An in-flight old Challenge must fail `STALE_STATE` on final commit if review or candidate revision changed; no obsolete result becomes current.

**`/suggest`** additionally requires `expected_policy_revision` in the JSON request (initial `0`), as well as source/candidate revisions. Under the session lock it adds only genuinely **new** untrusted proposals: on any changed canonical catalog, increase candidate revision once, immediately invalidate prior review/run/export, and return to `state=IMPORTED` until the human re-reviews *all* rows. No changes / `AI_UNAVAILABLE` leave catalog, policy revision and state untouched. A suggestion computed outside the lock must compare the original expected epochs again before committing, or fail `STALE_STATE`. Concurrent suggestion/review writes are serialised, not last-writer-wins. A successful full review after suggestion compares the new candidate revision; a stale form fails `409` without mutation. `review_sha256` equality does not override the revision checks.

**Illustrative epoch sequence, not an observed trace:** parse: `(source,candidate,policy)=(1,1,0)`; unsuccessful Meta request: `(1,1,0)`; accepted review inserting manual `delivery:D2 -> O3`: `(1,2,1)` and `REVIEW_FROZEN`; Challenge/receipt for that snapshot use `(1,2,1)`. A second accepted identical review is `(1,2,2)` and invalidates the earlier run despite unchanged digest. If an actual new suggestion is then committed, epochs are `(1,3,2)` with `IMPORTED`/review required; an old `(1,2,2)` form is rejected. Session IDs are never logged; generated receipt cores include the non-secret revision triple so historical scope is inspectable.

### 3.2 G1-B02 session and deployment security boundary (proposed gate)

**Development/local-only configuration (`LOCAL_DEV_UNAUTHENTICATED`):** bind only `127.0.0.1`/`::1` loopback (never `0.0.0.0`, LAN, container-public ports, or trusted forwarded proxy headers). Serve frontend and API from the **same scheme, host and port**. Disable CORS entirely, allow only known loopback `Host` values, reject browser requests with incorrect `Origin`/cross-site Fetch Metadata and require `Content-Type: application/json` plus a non-simple custom `X-JW-Local-Request: 1` header on all six POST endpoints. For native automation without `Origin`, require separately configured local development client permission, not default browser bypass. Use cryptographically random 128-bit+ opaque session IDs, stored in memory and treated as **bearer secrets**, not user identity. The demo sample session_id is a visibly fictional placeholder. Expire an idle session after 30 minutes and all sessions after 2 hours, whichever comes first; no persistence after restart; expired session requests return `SESSION_EXPIRED`/409. Redact tokens, CSV bytes, Meta credentials and receipts from request logs; limit request sizes, concurrency and inference rate. These are **proposed engineering controls, not observed safeguards**. A malicious same-device process may still reach loopback; **no multiuser, remote or public security assurance** exists in this mode.

**Public deployment is `BLOCKED` under this draft.** Before any externally reachable binding or release, HQ/security must approve and D must test: real verified identity/authentication with server-enforced per-user ownership of every session/run/receipt and replay access; short-lived non-predictable session credentials; browser CSRF and same-origin enforcement backed by configured allowed origins and correct cookies/tokens; HTTPS/WSS only and secure headers; protected server-side Meta key with egress, quotas and rate limits; ingress/upload/resource limits, bounded concurrent searches, failure isolation and appropriate logging without sensitive data; safe reverse proxy/Host configuration; authorisation checks on exports; expiry/deletion policy, abuse protection and reproducible build identity. `reviewer_label` and attestation are **display/audit claims**, never authentication. Merely meeting loopback checks is not a public readiness PASS. No new auth protocol or deployment implementation is authorised by this contract draft.

### 3.3 W03 — sole adoption rule for a registered Meta edge

The **only** operation that adopts an active, server-registered `META_SUGGESTED` edge into an admissible world is a **human-submitted, fully accepted** `POST /review/validate` replacement snapshot where its unique `(record_key,target_id)` appears once in `rows[].edges[]` with disposition **`POSSIBLE` or `CONFIRMED`**. It then participates according to those literal permissions; this is not an assertion of source truth. The selected candidate's existing server-side `META_SUGGESTED` entry and provider/call attribution **must persist** in the candidate catalogue, policy digest, receipt and replay. A review row does **not** carry client-authoritative `origin` or `provider`; unknown fields are rejected. The server derives provenance by joining the typed pair against the active catalog **under the CAS lock**; never recast a Meta edge as `MANUAL` or accept `manual_candidates[]` as a way to spoof a registered Meta proposal. An `origin` asserted by a browser is untrusted, and proposals with missing, stale or revoked registered provenance are rejected (`INVALID_REVIEW` or `STALE_STATE`) atomically.

Inspection, suggestion arrival, `POSSIBLE` in an **unsubmitted local draft**, or a model confidence score alone do **not** adopt an edge. A `PROHIBITED` review disposition records rejection and grants no choice. Existing manual-only B02 demo remains exactly the same; the separate **hypothetical** Meta-success → candidate revision `(1,2,0)` → full adopted review `(1,2,1)` vectors are in §5.7 and the companion `review_meta_adoption` fixtures. `CONFIRMED` still prohibits other choices as stated in §3, including on overlapping-source/Meta provenance. No extra adoption endpoint exists.

## 4. Search semantics and independent verifier

1. Build the **complete authorised option set** for each non-order row from a frozen review. Variable = more than one admissible option, including null; alternatives = option-count minus one, relative to the adopted baseline. Reject >10 variables or >2 alternatives for any variable.
2. Before filtering, multiply all permitted option counts over the variable rows using integer arithmetic. If product >4,096, return HTTP `422 LIMIT_EXCEEDED` **without starting a run or issuing any stability verdict**. Review validation also preflights this cap. No early stop based on a presumed small post-filter set.
3. Deterministically enumerate every raw Cartesian combination. Validate typed parent IDs, currency, amount and collision constraints for each. Record `raw_worlds`, `invalid_worlds` (and reason breakdown), `admissible_worlds` and `fully_enumerated`. Reject an entirely contradictory policy, an invalid baseline, or any authorised alternative that cannot occur in any admissible world; require an explicit reviewer correction rather than silently removing that option.
4. Calculate `clean_fulfilled_count` independently in each admissible world using integer cents. The baseline decision is Boolean `baseline_count >= K`. A **reversal** is any admissible world with an opposite Boolean. Define link distance `d(w,b) = # of non-order source records whose assigned target or null differs from baseline` (typed row Hamming distance, **not** individual edge flips). Report minimum `d` only after exhaustive completion. If multiple minimum-distance reversals, deterministically choose the lexicographically smallest ordered target tuple in typed-row/ASCII-ID order, null sorted before IDs.
5. **Independent checker** takes immutable files, frozen policy, reference mapping and candidate result; reconstructs the entire authorised Cartesian product independently (no reuse of search's world-scoring or filtering routine), verifies collision filtering and count for **every** world, baseline, reversal witness, distance, tie-break, digest bindings, and full coverage. `checker_status=PASSED` is evidence of independent **recomputation**, not external truth about a business record. If checker fails or is interrupted, return `NOT_VERIFIED` and preserve error evidence.
6. A completed, independently checked run returns `REVERSED_EXHAUSTIVE` if reversal exists, else `STABLE_WITHIN_SCOPE`. Both are strictly about this **reviewed finite universe**, not all possible real-world matches. Only exhaustive completion plus checker **and an actual reversing witness** allows `minimum_distance_proven_within_scope=true`; even then it is not a generic global optimum. Time budget is monotonic 10,000 ms default and maximum (lower request allowed, min 100 ms); if exceeded, return `NOT_VERIFIED / TIMEOUT` with partial counts marked **non-exhaustive**, never a stability or minimum claim. Runtime, search and checker timings are separate; no invented timings.

### 4.1 W04 — single status-discriminated result and proof taxonomy (normative)

`/challenge` successful **run-started** response is HTTP `200` with common envelope `{contract_version,session_id,state,run_id,source_revision,candidate_revision,policy_revision,review_sha256,result}`. On complete verification, `state="CHALLENGED"` and `run_id` is a non-null 32-hex identifier. On incomplete run, `state="REVIEW_FROZEN"`, `run_id=null` and no receipt can be exported. This does not authorise session mutation after an epoch mismatch. `result` **always** has precisely these fields and types across variants: `status` enum; `reason` (`null` or typed reason); `predicate` exact literal; `threshold_k` integer; `baseline` (`{clean_fulfilled_count:integer,decision:boolean}` when independently verified, otherwise **null**); `witness` (non-null object **only** for verified reversal, otherwise **null**); `coverage` as below; `checker_status` enum `PASSED|FAILED|UNRUN`; `proof_basis` enum `EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION|WITNESS_CHECKED_ONLY|NONE`; `minimum_distance_proven_within_scope` boolean; and `minimum_link_distance_within_scope` (integer for certified reversal, otherwise **null**). No omitted-but-assumed witness or minimum. For this v1 exhaustive contract `WITNESS_CHECKED_ONLY` is never enough for a complete status and is not an optimum claim.

`coverage` is **one schema only**, with these ten named fields, including explicit `null` for unknowable totals:

| Field | Type / meaning |
|---|---|
| `raw_worlds_total` | integer: exact pre-filter Cartesian product under frozen review, even before search; preflight 422 may report a value above cap in safe `error.details`. |
| `raw_worlds_checked` | integer: raw combinations actually visited by search before stop. |
| `invalid_worlds_total` | integer or `null`: total inadmissible raw worlds; only known when `fully_enumerated=true`. |
| `invalid_worlds_checked` | integer: invalid raw worlds actually checked. |
| `admissible_worlds_total` | integer or `null`: exact complete valid-world count; null until full enumeration. |
| `admissible_worlds_checked` | integer: valid worlds actually visited and evaluated. |
| `checker_worlds_total` | integer or `null`: expected independent checker workload, equals `admissible_worlds_total` only once the search is complete; null if unfinished. |
| `checker_worlds_checked` | integer: admissible worlds actually independently recomputed. |
| `fully_enumerated` | boolean: all raw worlds visited and categorised; only then are invalid/admissible totals non-null. |
| `checker_complete` | boolean: independent checker finished all admissible worlds **and** independently matched classification, counts, baseline, witness, tie-break, digests and coverage. False on failure or interruption, even when visit count happens to equal total. |

Invariants: `0 <= raw_worlds_checked <= raw_worlds_total <= 4096` for *run-started* responses; `raw_worlds_checked = invalid_worlds_checked + admissible_worlds_checked`; `0 <= checker_worlds_checked <= admissible_worlds_checked`; and when `fully_enumerated`, `invalid_worlds_total + admissible_worlds_total = raw_worlds_total` and checked equals total. When `checker_complete=true`, `fully_enumerated=true`, all world counts equal their complete totals and `checker_status=PASSED`. Never use the removed keys `coverage.raw_worlds`, `coverage.admissible_worlds`, `coverage.invalid_worlds`, `coverage.complete`, `coverage.worlds_checked_by_independent_checker`, or the old alternative `admissible_worlds_checked` paired with ambiguous `fully_enumerated` as a *different* shape. Partial counters are neither a denominator for stability nor a proof of no reversal.

| `result.status` | Required result fields / outcome language |
|---|---|
| `REVERSED_EXHAUSTIVE` | `reason=null`; **non-null** baseline and opposing-decision `witness` with `reference_changes[]`, `clean_fulfilled_count`, `decision`, `link_distance`; `minimum_link_distance_within_scope=witness.link_distance` (integer >=1), `minimum_distance_proven_within_scope=true`; both coverage flags true, checker `PASSED`, proof basis `EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION`. Minimum is **within the reviewer-authorised finite universe only**. |
| `STABLE_WITHIN_SCOPE` | `reason=null`, non-null independently checked baseline, **`witness=null`**, `minimum_link_distance_within_scope=null`, `minimum_distance_proven_within_scope=false`; both coverage flags true, checker `PASSED`, same exhaustive proof basis. Means only no reversal among all **reviewed admitted** worlds, not real-world linkage certainty. |
| `NOT_VERIFIED` | `reason` a typed code (`TIMEOUT|CHECKER_MISMATCH|ENGINE_INTERRUPTED`), `baseline=null`, `witness=null`, both minimum fields null/false, `checker_status=UNRUN|FAILED`, `checker_complete=false`, `proof_basis=NONE`. `fully_enumerated` may be true if search ended but independent checking failed. Never show stable/reversed/optimal proof or allow receipt. |

A contradiction, invalid baseline, invalid review or raw Cartesian cap detected **before a run** is **HTTP 422**, with the existing uniform error envelope; examples use `CONTRADICTORY_POLICY`, `INVALID_BASELINE`, `LIMIT_EXCEEDED`, `verified=false`, `error.details.result_status="NOT_VERIFIED"` where appropriate. Those are **not** 200 run-started `result` instances. If a cap is exceeded, report its calculated `raw_worlds_total` in safe error details and abort before filtering; never truncate. A session source/candidate/policy mismatch is a `409 STALE_STATE` and does not return a historical result. No optimum, replay or independent checker success may be claimed from these examples until G2 execution.

Other enum boundaries remain: `ai_status=NOT_REQUESTED|AI_UNAVAILABLE|AI_SUGGESTED`; replay `verification_status=VERIFIED_REPLAY|NOT_VERIFIED`; all hashes and candidate scope are as before. `checker_status=PASSED` describes completed separate recomputation, **not** a cryptographic signature, independently authenticated reviewer or global truth.

### 4.2 Receipt and replay

`receipt` is a standalone JSON core containing contract version; original file SHA-256 and bundle digest; human policy snapshot (choices, provenance, reviewer attestation, threshold); full baseline/reference mapping and hashes; non-secret `source_revision`, `candidate_revision` and `policy_revision` snapshot; run ID; exact engine/build identity; counts, permitted-world coverage, witness and changed links, deterministic tie-break/minimum scope; independent-checker status; measured timings (or null if unavailable); and a core checksum. The optional Meta transcript is **not** mathematical authority and must not include keys or hidden model prompts. Receipt/export is allowed only for a current, completed, checker-passed run. Receipt `receipt_sha256` binds the revision triple because it is part of the core; the baseline and review hash payloads intentionally do not bind monotonic epochs, so freshness is checked separately. Replay is **stateless**: takes receipt plus all four original file bytes, revalidates hash and code identity, recomputes the world search and independent checker, and compares **all** material outputs. Use `RECEIPT_TAMPERED`, `SOURCE_MISMATCH` or `ENGINE_VERSION_MISMATCH` on mismatch; no `VERIFIED_REPLAY` on partial recomputation. A modified receipt plus recomputed unsigned hash can deceive an unauthenticated reader; explicitly disclose that this is consistency evidence, not signer authenticity.

## 5. API v1 (all newly proposed; no existing implementation asserted)

Router-owned prefix `/api/commerce/v1`. JSON only; strict unknown-field rejection at all levels. Every route is POST to avoid leaking uploads/query strings. `session_id` = 32 lowercase hex random server token; `run_id` = 32 lowercase hex random server token. Digests = 64 lowercase hex. Integer revisions start at 1 (`expected_policy_revision=0` at initial freeze; `candidate_revision=1` after parse). Schema names and status casing are normative. Server must bind every session operation to its current state and enforce the mode-specific development or deployment security requirements in §3.2; a `session_id` by itself is not user authentication. **These endpoint examples illustrate valid/invalid JSON *bodies*, not HTTP security headers or trace logs.** The additional development-only `X-JW-Local-Request: 1` header and same-origin requirements from §3.2 apply uniformly; they do not appear inside JSON bodies. Public access is NOT APPROVED.

| Method and route | Success HTTP | Failure HTTP / purpose |
|---|---:|---|
| `POST /api/commerce/v1/parse` | `201` | `400/413/422`: validate four byte-exact source files; create isolated immutable session and unauthorised source-reference candidates. |
| `POST /api/commerce/v1/suggest` | `200` | `409/422/429/503`: explicitly optional Meta suggestions, never an authorisation; `AI_UNAVAILABLE` can be a `200` graceful no-AI response. |
| `POST /api/commerce/v1/review/validate` | `200` | `409/422`: server-side complete human policy, reference mapping, threshold and scope validation; success atomically freezes a new policy revision. |
| `POST /api/commerce/v1/challenge` | `200` | `409/422/429/503`: finite search/checker with typed `NOT_VERIFIED` on cap/timeout; no result based on stale review. |
| `POST /api/commerce/v1/receipt` | `200` | `409/404`: export current checker-passed run only. |
| `POST /api/commerce/v1/receipt/replay` | `200` | `400/409/422`: fully stateless byte-bound replay using original source files; no session prerequisite. |

**W06 — HQ decision (no new per-row error wire):** `error.path` retains the existing required generic, safe string locator **without a frozen per-row grammar**; `error.message` is display-safe plain text. Render both defensively as generic errors, escaping contents; never map `error.path` directly to DOM IDs or fabricate row diagnostic arrays, failure field indexes, missing backend error codes or a confident highlighted cell. `error.details` may contain **only safe typed, schema-specific hints** shown in existing examples and is not a generic trustable diagnostics array. Proposed stricter per-row diagnostics are deferred to G2 subject to HQ's compatibility review. Invalid input, 409 stale state and failed requests must visibly fail, not silently disappear. No new endpoint or error envelope redesign is approved.

**Uniform error envelope** (HTTP non-2xx): `{ "error": { "code": "UPPER_SNAKE_CASE", "message": "human safe text", "path": "JSON.path", "details": {} }, "verified": false }`. `NOT_VERIFIED` on search that started is `200` with `result.status=NOT_VERIFIED`, typed `reason` and partial counters; preflight `LIMIT_EXCEEDED` (or `INVALID_BASELINE`/`CONTRADICTORY_POLICY`) is `422` using the same error envelope with `error.details.result_status="NOT_VERIFIED"` where applicable. No run is started on these preflight failures. Do not send stack traces, raw CSV, API keys, user identifiers or secret prompt text in error envelopes. Error HTTP status is not itself the proof status.

#### 5.1 Parse: POST /parse — valid (illustrative, NOT EXECUTED)

Request (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "files": {
    "orders.csv": {
      "content_base64": "b3JkZXJfaWQsY3VzdG9tZXJfaWQsb3JkZXJfdG90YWwsY3VycmVuY3kKTzEsQzEsMTAwLjAwLFVTRApPMixDMiwxMDAuMDAsVVNECk8zLEMzLDgwLjAwLFVTRAo="
    },
    "payments.csv": {
      "content_base64": "cGF5bWVudF9pZCxvcmRlcl9yZWYsYW1vdW50LGN1cnJlbmN5LHN0YXR1cwpQMSxPMSwxMDAuMDAsVVNELFNFVFRMRUQKUDIsTzIsMTAwLjAwLFVTRCxTRVRUTEVEClAzLE8zLDgwLjAwLFVTRCxTRVRUTEVECg=="
    },
    "deliveries.csv": {
      "content_base64": "ZGVsaXZlcnlfaWQsb3JkZXJfcmVmLHN0YXR1cwpEMSxPMSxERUxJVkVSRUQKRDIsTzIsREVMSVZFUkVECkQzLE8zLElOX1RSQU5TSVQK"
    },
    "refunds.csv": {
      "content_base64": "cmVmdW5kX2lkLHBheW1lbnRfcmVmLGFtb3VudCxzdGF0dXMKUjEsUDMsNS4wMCxDT01QTEVURUQK"
    }
  }
}
```

Response (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "state": "IMPORTED",
  "session_id": "0123456789abcdef0123456789abcdef",
  "source_revision": 1,
  "candidate_revision": 1,
  "source_bundle_sha256": "e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50",
  "file_sha256": {
    "orders.csv": "8063a0ead1bdbf5764900e34009e9331847d7e74e57b541a6e554bdcfbf0ee95",
    "payments.csv": "9dbac299fb73598818afeef13d3827cb40da73de1fb38966399cc3a94100f441",
    "deliveries.csv": "e02c99782c8f02ae8b50572cc3fcadfec12d7c00d6f9b272711388fd4ec2c084",
    "refunds.csv": "aae37407144077385b8ad87b33d8d8faeb4b9d32f67988c4960c17b79469de56"
  },
  "row_counts": {
    "orders": 3,
    "payments": 3,
    "deliveries": 3,
    "refunds": 1
  },
  "deterministic_candidates": [
    {
      "record_key": "payment:P1",
      "target_id": "O1",
      "origin": "SOURCE_REF",
      "authorised": false
    },
    {
      "record_key": "payment:P2",
      "target_id": "O2",
      "origin": "SOURCE_REF",
      "authorised": false
    },
    {
      "record_key": "payment:P3",
      "target_id": "O3",
      "origin": "SOURCE_REF",
      "authorised": false
    },
    {
      "record_key": "delivery:D1",
      "target_id": "O1",
      "origin": "SOURCE_REF",
      "authorised": false
    },
    {
      "record_key": "delivery:D2",
      "target_id": "O2",
      "origin": "SOURCE_REF",
      "authorised": false
    },
    {
      "record_key": "delivery:D3",
      "target_id": "O3",
      "origin": "SOURCE_REF",
      "authorised": false
    },
    {
      "record_key": "refund:R1",
      "target_id": "P3",
      "origin": "SOURCE_REF",
      "authorised": false
    }
  ],
  "ai_status": "NOT_REQUESTED",
  "limits": {
    "orders": 50,
    "each_other_file": 60,
    "variables": 10,
    "alternatives_per_variable": 2,
    "raw_worlds": 4096
  },
  "validated_source_rows": {
    "orders": [
      {
        "source_row_number": 2,
        "order_id": "O1",
        "customer_id": "C1",
        "order_total": "100.00",
        "currency": "USD"
      },
      {
        "source_row_number": 3,
        "order_id": "O2",
        "customer_id": "C2",
        "order_total": "100.00",
        "currency": "USD"
      },
      {
        "source_row_number": 4,
        "order_id": "O3",
        "customer_id": "C3",
        "order_total": "80.00",
        "currency": "USD"
      }
    ],
    "payments": [
      {
        "source_row_number": 2,
        "payment_id": "P1",
        "order_ref": "O1",
        "amount": "100.00",
        "currency": "USD",
        "status": "SETTLED"
      },
      {
        "source_row_number": 3,
        "payment_id": "P2",
        "order_ref": "O2",
        "amount": "100.00",
        "currency": "USD",
        "status": "SETTLED"
      },
      {
        "source_row_number": 4,
        "payment_id": "P3",
        "order_ref": "O3",
        "amount": "80.00",
        "currency": "USD",
        "status": "SETTLED"
      }
    ],
    "deliveries": [
      {
        "source_row_number": 2,
        "delivery_id": "D1",
        "order_ref": "O1",
        "status": "DELIVERED"
      },
      {
        "source_row_number": 3,
        "delivery_id": "D2",
        "order_ref": "O2",
        "status": "DELIVERED"
      },
      {
        "source_row_number": 4,
        "delivery_id": "D3",
        "order_ref": "O3",
        "status": "IN_TRANSIT"
      }
    ],
    "refunds": [
      {
        "source_row_number": 2,
        "refund_id": "R1",
        "payment_ref": "P3",
        "amount": "5.00",
        "status": "COMPLETED"
      }
    ]
  }
}
```

#### 5.1 Parse: missing file — invalid (illustrative)

Request (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "files": {
    "orders.csv": {
      "content_base64": "b3JkZXJfaWQsY3VzdG9tZXJfaWQsb3JkZXJfdG90YWwsY3VycmVuY3kKTzEsQzEsMTAwLjAwLFVTRApPMixDMiwxMDAuMDAsVVNECk8zLEMzLDgwLjAwLFVTRAo="
    }
  }
}
```

Response (`application/json`):

```json
{
  "error": {
    "code": "MISSING_FILE",
    "message": "Exactly four named CSV files are required.",
    "path": "files.payments.csv",
    "details": {
      "required_files": [
        "orders.csv",
        "payments.csv",
        "deliveries.csv",
        "refunds.csv"
      ]
    }
  },
  "verified": false
}
```

#### 5.2 Optional Meta: POST /suggest, graceful no-AI result — valid (illustrative, NOT EXECUTED)

Request (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 1,
  "mode": "META",
  "max_suggestions": 5,
  "expected_policy_revision": 0
}
```

Response (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "ai_status": "AI_UNAVAILABLE",
  "suggestions": [],
  "source_revision": 1,
  "candidate_revision": 1,
  "authorisations_changed": false,
  "policy_revision": 0,
  "state": "IMPORTED",
  "model_call": null,
  "catalog_changed": false,
  "rejected_proposals": []
}
```

#### 5.2 Optional Meta: stale input — invalid (illustrative)

Request (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 0,
  "expected_candidate_revision": 1,
  "mode": "META",
  "max_suggestions": 5,
  "expected_policy_revision": 0
}
```

Response (`application/json`):

```json
{
  "error": {
    "code": "STALE_STATE",
    "message": "Source revision no longer matches.",
    "path": "expected_source_revision",
    "details": {
      "expected": 1,
      "received": 0
    }
  },
  "verified": false
}
```

#### 5.3 Human policy: POST /review/validate — valid (illustrative, NOT EXECUTED)

Request (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 1,
  "expected_policy_revision": 0,
  "threshold_k": 2,
  "reviewer_label": "demo-reviewer",
  "review_attestation": {
    "all_rows_reviewed": true,
    "understands_bounded_predicate": true,
    "conflicting_source_ref_overrides_explained": true
  },
  "manual_candidates": [
    {
      "record_type": "delivery",
      "record_id": "D2",
      "target_id": "O3",
      "reason": "Carrier reference may have been copied from a neighbouring order."
    }
  ],
  "rows": [
    {
      "record_type": "payment",
      "record_id": "P1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P2",
      "edges": [
        {
          "target_id": "O2",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P3",
      "edges": [
        {
          "target_id": "O3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D2",
      "edges": [
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D3",
      "edges": [
        {
          "target_id": "O3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "refund",
      "record_id": "R1",
      "edges": [
        {
          "target_id": "P3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    }
  ],
  "reference_mapping": {
    "payment:P1": "O1",
    "payment:P2": "O2",
    "payment:P3": "O3",
    "delivery:D1": "O1",
    "delivery:D2": "O2",
    "delivery:D3": "O3",
    "refund:R1": "P3"
  }
}
```

Response (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "state": "REVIEW_FROZEN",
  "source_revision": 1,
  "candidate_revision": 2,
  "policy_revision": 1,
  "candidate_catalog_sha256": "4c8646f8684112ba4cb3a1bfb072b73e8aa2b309ce199e1e9567a6cb99db5098",
  "source_bundle_sha256": "e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50",
  "policy_sha256": "cc07bdc869ad4c8f2ad1bbadbb8c853404cbd03701c6baee45111d998ca0ffba",
  "baseline_sha256": "49cf0a9061605aa42b5735d130a9c9eb1ad692860119fd62c753dd0538c8fd74",
  "review_sha256": "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9",
  "threshold_k": 2,
  "raw_worlds": 2,
  "admissible_worlds": 2,
  "invalid_worlds": 0,
  "variable_records": 1,
  "baseline_valid": true,
  "authorised_by": "HUMAN_REVIEW_ATTESTED_NOT_IDENTITY_VERIFIED"
}
```

#### 5.3 Human policy: invalid reference baseline — invalid (illustrative)

Request (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 1,
  "expected_policy_revision": 0,
  "threshold_k": 2,
  "reviewer_label": "demo-reviewer",
  "review_attestation": {
    "all_rows_reviewed": true,
    "understands_bounded_predicate": true,
    "conflicting_source_ref_overrides_explained": true
  },
  "manual_candidates": [
    {
      "record_type": "delivery",
      "record_id": "D2",
      "target_id": "O3",
      "reason": "Carrier reference may have been copied from a neighbouring order."
    }
  ],
  "rows": [
    {
      "record_type": "payment",
      "record_id": "P1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P2",
      "edges": [
        {
          "target_id": "O2",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P3",
      "edges": [
        {
          "target_id": "O3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D2",
      "edges": [
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D3",
      "edges": [
        {
          "target_id": "O3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "refund",
      "record_id": "R1",
      "edges": [
        {
          "target_id": "P3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    }
  ],
  "reference_mapping": {
    "payment:P1": "O1",
    "payment:P2": "O2",
    "payment:P3": "O3",
    "delivery:D1": "O1",
    "delivery:D2": "O9",
    "delivery:D3": "O3",
    "refund:R1": "P3"
  }
}
```

Response (`application/json`):

```json
{
  "error": {
    "code": "INVALID_BASELINE",
    "message": "Reference mapping selects a target outside reviewed permissions.",
    "path": "reference_mapping.delivery:D2",
    "details": {
      "target_id": "O9"
    }
  },
  "verified": false
}
```

#### 5.4 Challenge: POST /challenge — **HYPOTHETICAL reversal, NOT MEASURED** — valid (illustrative, NOT EXECUTED)

Request (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 2,
  "expected_policy_revision": 1,
  "expected_review_sha256": "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9",
  "time_budget_ms": 10000
}
```

Response (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "state": "CHALLENGED",
  "run_id": "abcdef0123456789abcdef0123456789",
  "source_revision": 1,
  "candidate_revision": 2,
  "policy_revision": 1,
  "review_sha256": "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9",
  "result": {
    "status": "REVERSED_EXHAUSTIVE",
    "predicate": "clean_fulfilled_count >= K",
    "threshold_k": 2,
    "baseline": {
      "clean_fulfilled_count": 2,
      "decision": true
    },
    "witness": {
      "reference_changes": [
        {
          "record_key": "delivery:D2",
          "from_target_id": "O2",
          "to_target_id": "O3"
        }
      ],
      "clean_fulfilled_count": 1,
      "decision": false,
      "link_distance": 1
    },
    "coverage": {
      "raw_worlds_total": 2,
      "raw_worlds_checked": 2,
      "invalid_worlds_total": 0,
      "invalid_worlds_checked": 0,
      "admissible_worlds_total": 2,
      "admissible_worlds_checked": 2,
      "checker_worlds_total": 2,
      "checker_worlds_checked": 2,
      "fully_enumerated": true,
      "checker_complete": true
    },
    "checker_status": "PASSED",
    "proof_basis": "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION",
    "minimum_distance_proven_within_scope": true,
    "reason": null,
    "minimum_link_distance_within_scope": 1
  }
}
```

#### 5.4 Challenge: stale policy hash — invalid (illustrative)

Request (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 2,
  "expected_policy_revision": 1,
  "expected_review_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "time_budget_ms": 10000
}
```

Response (`application/json`):

```json
{
  "error": {
    "code": "STALE_STATE",
    "message": "Review digest no longer matches the frozen policy and baseline.",
    "path": "expected_review_sha256",
    "details": {}
  },
  "verified": false
}
```

#### 5.5 Receipt: POST /receipt — **HYPOTHETICAL, NOT GENERATED BY ENGINE** — valid (illustrative, NOT EXECUTED)

Request (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "run_id": "abcdef0123456789abcdef0123456789",
  "expected_review_sha256": "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9"
}
```

Response (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "receipt": {
    "format": "jw.commerce.receipt.v1",
    "contract_version": "commerce.v1",
    "source_bundle_sha256": "e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50",
    "file_sha256": {
      "orders.csv": "8063a0ead1bdbf5764900e34009e9331847d7e74e57b541a6e554bdcfbf0ee95",
      "payments.csv": "9dbac299fb73598818afeef13d3827cb40da73de1fb38966399cc3a94100f441",
      "deliveries.csv": "e02c99782c8f02ae8b50572cc3fcadfec12d7c00d6f9b272711388fd4ec2c084",
      "refunds.csv": "aae37407144077385b8ad87b33d8d8faeb4b9d32f67988c4960c17b79469de56"
    },
    "candidate_catalog_sha256": "4c8646f8684112ba4cb3a1bfb072b73e8aa2b309ce199e1e9567a6cb99db5098",
    "policy": {
      "contract_version": "commerce.v1",
      "source_bundle_sha256": "e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50",
      "candidate_catalog_sha256": "4c8646f8684112ba4cb3a1bfb072b73e8aa2b309ce199e1e9567a6cb99db5098",
      "candidate_catalog": [
        {
          "record_key": "payment:P1",
          "target_id": "O1",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "payment:P2",
          "target_id": "O2",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "payment:P3",
          "target_id": "O3",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "delivery:D1",
          "target_id": "O1",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "delivery:D2",
          "target_id": "O2",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "delivery:D2",
          "target_id": "O3",
          "origin": "MANUAL",
          "reason": "Carrier reference may have been copied from a neighbouring order."
        },
        {
          "record_key": "delivery:D3",
          "target_id": "O3",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "refund:R1",
          "target_id": "P3",
          "origin": "SOURCE_REF"
        }
      ],
      "threshold_k": 2,
      "reviewer_label": "demo-reviewer",
      "review_attestation": {
        "all_rows_reviewed": true,
        "understands_bounded_predicate": true,
        "conflicting_source_ref_overrides_explained": true
      },
      "manual_candidates": [
        {
          "record_type": "delivery",
          "record_id": "D2",
          "target_id": "O3",
          "reason": "Carrier reference may have been copied from a neighbouring order."
        }
      ],
      "rows": [
        {
          "record_type": "payment",
          "record_id": "P1",
          "edges": [
            {
              "target_id": "O1",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "payment",
          "record_id": "P2",
          "edges": [
            {
              "target_id": "O2",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "payment",
          "record_id": "P3",
          "edges": [
            {
              "target_id": "O3",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "delivery",
          "record_id": "D1",
          "edges": [
            {
              "target_id": "O1",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "delivery",
          "record_id": "D2",
          "edges": [
            {
              "target_id": "O2",
              "disposition": "POSSIBLE"
            },
            {
              "target_id": "O3",
              "disposition": "POSSIBLE"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "delivery",
          "record_id": "D3",
          "edges": [
            {
              "target_id": "O3",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "refund",
          "record_id": "R1",
          "edges": [
            {
              "target_id": "P3",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        }
      ]
    },
    "reference_mapping": {
      "payment:P1": "O1",
      "payment:P2": "O2",
      "payment:P3": "O3",
      "delivery:D1": "O1",
      "delivery:D2": "O2",
      "delivery:D3": "O3",
      "refund:R1": "P3"
    },
    "policy_sha256": "cc07bdc869ad4c8f2ad1bbadbb8c853404cbd03701c6baee45111d998ca0ffba",
    "baseline_sha256": "49cf0a9061605aa42b5735d130a9c9eb1ad692860119fd62c753dd0538c8fd74",
    "review_sha256": "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9",
    "run_id": "abcdef0123456789abcdef0123456789",
    "engine_identity": "EXAMPLE-NOT-EXECUTED",
    "result": {
      "status": "REVERSED_EXHAUSTIVE",
      "predicate": "clean_fulfilled_count >= K",
      "threshold_k": 2,
      "baseline": {
        "clean_fulfilled_count": 2,
        "decision": true
      },
      "witness": {
        "reference_changes": [
          {
            "record_key": "delivery:D2",
            "from_target_id": "O2",
            "to_target_id": "O3"
          }
        ],
        "clean_fulfilled_count": 1,
        "decision": false,
        "link_distance": 1
      },
      "coverage": {
        "raw_worlds_total": 2,
        "raw_worlds_checked": 2,
        "invalid_worlds_total": 0,
        "invalid_worlds_checked": 0,
        "admissible_worlds_total": 2,
        "admissible_worlds_checked": 2,
        "checker_worlds_total": 2,
        "checker_worlds_checked": 2,
        "fully_enumerated": true,
        "checker_complete": true
      },
      "checker_status": "PASSED",
      "proof_basis": "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION",
      "minimum_distance_proven_within_scope": true,
      "reason": null,
      "minimum_link_distance_within_scope": 1
    },
    "timings_ms": {
      "parse": null,
      "search": null,
      "checker": null,
      "wall": null
    },
    "scope": {
      "max_orders": 50,
      "max_each_other_file": 60,
      "max_variable_records": 10,
      "max_alternatives_per_variable": 2,
      "max_raw_worlds": 4096
    },
    "receipt_sha256": "9f91554882665727c0d04112d7c8ebd9b77eb9f9be6fad7f7a9edde7633ce7e8",
    "source_revision": 1,
    "candidate_revision": 2,
    "policy_revision": 1
  },
  "attestation": "CONSISTENCY_HASH_ONLY_NOT_SIGNATURE"
}
```

#### 5.5 Receipt: unknown run — invalid (illustrative)

Request (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "run_id": "00000000000000000000000000000000",
  "expected_review_sha256": "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9"
}
```

Response (`application/json`):

```json
{
  "error": {
    "code": "RUN_NOT_FOUND",
    "message": "No completed current run has the supplied identifier.",
    "path": "run_id",
    "details": {}
  },
  "verified": false
}
```

#### 5.6 Portable replay: POST /receipt/replay — **HYPOTHETICAL, NOT VERIFIED** — valid (illustrative, NOT EXECUTED)

Request (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "receipt": {
    "format": "jw.commerce.receipt.v1",
    "contract_version": "commerce.v1",
    "source_bundle_sha256": "e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50",
    "file_sha256": {
      "orders.csv": "8063a0ead1bdbf5764900e34009e9331847d7e74e57b541a6e554bdcfbf0ee95",
      "payments.csv": "9dbac299fb73598818afeef13d3827cb40da73de1fb38966399cc3a94100f441",
      "deliveries.csv": "e02c99782c8f02ae8b50572cc3fcadfec12d7c00d6f9b272711388fd4ec2c084",
      "refunds.csv": "aae37407144077385b8ad87b33d8d8faeb4b9d32f67988c4960c17b79469de56"
    },
    "candidate_catalog_sha256": "4c8646f8684112ba4cb3a1bfb072b73e8aa2b309ce199e1e9567a6cb99db5098",
    "policy": {
      "contract_version": "commerce.v1",
      "source_bundle_sha256": "e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50",
      "candidate_catalog_sha256": "4c8646f8684112ba4cb3a1bfb072b73e8aa2b309ce199e1e9567a6cb99db5098",
      "candidate_catalog": [
        {
          "record_key": "payment:P1",
          "target_id": "O1",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "payment:P2",
          "target_id": "O2",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "payment:P3",
          "target_id": "O3",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "delivery:D1",
          "target_id": "O1",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "delivery:D2",
          "target_id": "O2",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "delivery:D2",
          "target_id": "O3",
          "origin": "MANUAL",
          "reason": "Carrier reference may have been copied from a neighbouring order."
        },
        {
          "record_key": "delivery:D3",
          "target_id": "O3",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "refund:R1",
          "target_id": "P3",
          "origin": "SOURCE_REF"
        }
      ],
      "threshold_k": 2,
      "reviewer_label": "demo-reviewer",
      "review_attestation": {
        "all_rows_reviewed": true,
        "understands_bounded_predicate": true,
        "conflicting_source_ref_overrides_explained": true
      },
      "manual_candidates": [
        {
          "record_type": "delivery",
          "record_id": "D2",
          "target_id": "O3",
          "reason": "Carrier reference may have been copied from a neighbouring order."
        }
      ],
      "rows": [
        {
          "record_type": "payment",
          "record_id": "P1",
          "edges": [
            {
              "target_id": "O1",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "payment",
          "record_id": "P2",
          "edges": [
            {
              "target_id": "O2",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "payment",
          "record_id": "P3",
          "edges": [
            {
              "target_id": "O3",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "delivery",
          "record_id": "D1",
          "edges": [
            {
              "target_id": "O1",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "delivery",
          "record_id": "D2",
          "edges": [
            {
              "target_id": "O2",
              "disposition": "POSSIBLE"
            },
            {
              "target_id": "O3",
              "disposition": "POSSIBLE"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "delivery",
          "record_id": "D3",
          "edges": [
            {
              "target_id": "O3",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "refund",
          "record_id": "R1",
          "edges": [
            {
              "target_id": "P3",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        }
      ]
    },
    "reference_mapping": {
      "payment:P1": "O1",
      "payment:P2": "O2",
      "payment:P3": "O3",
      "delivery:D1": "O1",
      "delivery:D2": "O2",
      "delivery:D3": "O3",
      "refund:R1": "P3"
    },
    "policy_sha256": "cc07bdc869ad4c8f2ad1bbadbb8c853404cbd03701c6baee45111d998ca0ffba",
    "baseline_sha256": "49cf0a9061605aa42b5735d130a9c9eb1ad692860119fd62c753dd0538c8fd74",
    "review_sha256": "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9",
    "run_id": "abcdef0123456789abcdef0123456789",
    "engine_identity": "EXAMPLE-NOT-EXECUTED",
    "result": {
      "status": "REVERSED_EXHAUSTIVE",
      "predicate": "clean_fulfilled_count >= K",
      "threshold_k": 2,
      "baseline": {
        "clean_fulfilled_count": 2,
        "decision": true
      },
      "witness": {
        "reference_changes": [
          {
            "record_key": "delivery:D2",
            "from_target_id": "O2",
            "to_target_id": "O3"
          }
        ],
        "clean_fulfilled_count": 1,
        "decision": false,
        "link_distance": 1
      },
      "coverage": {
        "raw_worlds_total": 2,
        "raw_worlds_checked": 2,
        "invalid_worlds_total": 0,
        "invalid_worlds_checked": 0,
        "admissible_worlds_total": 2,
        "admissible_worlds_checked": 2,
        "checker_worlds_total": 2,
        "checker_worlds_checked": 2,
        "fully_enumerated": true,
        "checker_complete": true
      },
      "checker_status": "PASSED",
      "proof_basis": "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION",
      "minimum_distance_proven_within_scope": true,
      "reason": null,
      "minimum_link_distance_within_scope": 1
    },
    "timings_ms": {
      "parse": null,
      "search": null,
      "checker": null,
      "wall": null
    },
    "scope": {
      "max_orders": 50,
      "max_each_other_file": 60,
      "max_variable_records": 10,
      "max_alternatives_per_variable": 2,
      "max_raw_worlds": 4096
    },
    "receipt_sha256": "9f91554882665727c0d04112d7c8ebd9b77eb9f9be6fad7f7a9edde7633ce7e8",
    "source_revision": 1,
    "candidate_revision": 2,
    "policy_revision": 1
  },
  "files": {
    "orders.csv": {
      "content_base64": "b3JkZXJfaWQsY3VzdG9tZXJfaWQsb3JkZXJfdG90YWwsY3VycmVuY3kKTzEsQzEsMTAwLjAwLFVTRApPMixDMiwxMDAuMDAsVVNECk8zLEMzLDgwLjAwLFVTRAo="
    },
    "payments.csv": {
      "content_base64": "cGF5bWVudF9pZCxvcmRlcl9yZWYsYW1vdW50LGN1cnJlbmN5LHN0YXR1cwpQMSxPMSwxMDAuMDAsVVNELFNFVFRMRUQKUDIsTzIsMTAwLjAwLFVTRCxTRVRUTEVEClAzLE8zLDgwLjAwLFVTRCxTRVRUTEVECg=="
    },
    "deliveries.csv": {
      "content_base64": "ZGVsaXZlcnlfaWQsb3JkZXJfcmVmLHN0YXR1cwpEMSxPMSxERUxJVkVSRUQKRDIsTzIsREVMSVZFUkVECkQzLE8zLElOX1RSQU5TSVQK"
    },
    "refunds.csv": {
      "content_base64": "cmVmdW5kX2lkLHBheW1lbnRfcmVmLGFtb3VudCxzdGF0dXMKUjEsUDMsNS4wMCxDT01QTEVURUQK"
    }
  }
}
```

Response (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "verification_status": "VERIFIED_REPLAY",
  "source_binding": "MATCH",
  "policy_binding": "MATCH",
  "receipt_integrity": "MATCH",
  "engine_identity": "EXAMPLE-NOT-EXECUTED",
  "independent_checker": "PASSED",
  "recomputed": {
    "baseline_clean_count": 2,
    "witness_clean_count": 1,
    "link_distance": 1,
    "coverage": {
      "raw_worlds_total": 2,
      "raw_worlds_checked": 2,
      "invalid_worlds_total": 0,
      "invalid_worlds_checked": 0,
      "admissible_worlds_total": 2,
      "admissible_worlds_checked": 2,
      "checker_worlds_total": 2,
      "checker_worlds_checked": 2,
      "fully_enumerated": true,
      "checker_complete": true
    }
  },
  "historical_receipt_only": true
}
```

#### 5.6 Portable replay: tamper — invalid (illustrative)

Request (`application/json`):

```json
{
  "contract_version": "commerce.v1",
  "receipt": {
    "format": "jw.commerce.receipt.v1",
    "contract_version": "commerce.v1",
    "source_bundle_sha256": "e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50",
    "file_sha256": {
      "orders.csv": "8063a0ead1bdbf5764900e34009e9331847d7e74e57b541a6e554bdcfbf0ee95",
      "payments.csv": "9dbac299fb73598818afeef13d3827cb40da73de1fb38966399cc3a94100f441",
      "deliveries.csv": "e02c99782c8f02ae8b50572cc3fcadfec12d7c00d6f9b272711388fd4ec2c084",
      "refunds.csv": "aae37407144077385b8ad87b33d8d8faeb4b9d32f67988c4960c17b79469de56"
    },
    "candidate_catalog_sha256": "4c8646f8684112ba4cb3a1bfb072b73e8aa2b309ce199e1e9567a6cb99db5098",
    "policy": {
      "contract_version": "commerce.v1",
      "source_bundle_sha256": "e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50",
      "candidate_catalog_sha256": "4c8646f8684112ba4cb3a1bfb072b73e8aa2b309ce199e1e9567a6cb99db5098",
      "candidate_catalog": [
        {
          "record_key": "payment:P1",
          "target_id": "O1",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "payment:P2",
          "target_id": "O2",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "payment:P3",
          "target_id": "O3",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "delivery:D1",
          "target_id": "O1",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "delivery:D2",
          "target_id": "O2",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "delivery:D2",
          "target_id": "O3",
          "origin": "MANUAL",
          "reason": "Carrier reference may have been copied from a neighbouring order."
        },
        {
          "record_key": "delivery:D3",
          "target_id": "O3",
          "origin": "SOURCE_REF"
        },
        {
          "record_key": "refund:R1",
          "target_id": "P3",
          "origin": "SOURCE_REF"
        }
      ],
      "threshold_k": 2,
      "reviewer_label": "demo-reviewer",
      "review_attestation": {
        "all_rows_reviewed": true,
        "understands_bounded_predicate": true,
        "conflicting_source_ref_overrides_explained": true
      },
      "manual_candidates": [
        {
          "record_type": "delivery",
          "record_id": "D2",
          "target_id": "O3",
          "reason": "Carrier reference may have been copied from a neighbouring order."
        }
      ],
      "rows": [
        {
          "record_type": "payment",
          "record_id": "P1",
          "edges": [
            {
              "target_id": "O1",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "payment",
          "record_id": "P2",
          "edges": [
            {
              "target_id": "O2",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "payment",
          "record_id": "P3",
          "edges": [
            {
              "target_id": "O3",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "delivery",
          "record_id": "D1",
          "edges": [
            {
              "target_id": "O1",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "delivery",
          "record_id": "D2",
          "edges": [
            {
              "target_id": "O2",
              "disposition": "POSSIBLE"
            },
            {
              "target_id": "O3",
              "disposition": "POSSIBLE"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "delivery",
          "record_id": "D3",
          "edges": [
            {
              "target_id": "O3",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        },
        {
          "record_type": "refund",
          "record_id": "R1",
          "edges": [
            {
              "target_id": "P3",
              "disposition": "CONFIRMED"
            }
          ],
          "unmatched": "PROHIBITED"
        }
      ]
    },
    "reference_mapping": {
      "payment:P1": "O1",
      "payment:P2": "O2",
      "payment:P3": "O3",
      "delivery:D1": "O1",
      "delivery:D2": "O2",
      "delivery:D3": "O3",
      "refund:R1": "P3"
    },
    "policy_sha256": "cc07bdc869ad4c8f2ad1bbadbb8c853404cbd03701c6baee45111d998ca0ffba",
    "baseline_sha256": "49cf0a9061605aa42b5735d130a9c9eb1ad692860119fd62c753dd0538c8fd74",
    "review_sha256": "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9",
    "run_id": "abcdef0123456789abcdef0123456789",
    "engine_identity": "EXAMPLE-NOT-EXECUTED",
    "result": {
      "status": "REVERSED_EXHAUSTIVE",
      "predicate": "clean_fulfilled_count >= K",
      "threshold_k": 2,
      "baseline": {
        "clean_fulfilled_count": 2,
        "decision": true
      },
      "witness": {
        "reference_changes": [
          {
            "record_key": "delivery:D2",
            "from_target_id": "O2",
            "to_target_id": "O3"
          }
        ],
        "clean_fulfilled_count": 1,
        "decision": false,
        "link_distance": 1
      },
      "coverage": {
        "raw_worlds_total": 2,
        "raw_worlds_checked": 2,
        "invalid_worlds_total": 0,
        "invalid_worlds_checked": 0,
        "admissible_worlds_total": 2,
        "admissible_worlds_checked": 2,
        "checker_worlds_total": 2,
        "checker_worlds_checked": 2,
        "fully_enumerated": true,
        "checker_complete": true
      },
      "checker_status": "PASSED",
      "proof_basis": "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION",
      "minimum_distance_proven_within_scope": true,
      "reason": null,
      "minimum_link_distance_within_scope": 1
    },
    "timings_ms": {
      "parse": null,
      "search": null,
      "checker": null,
      "wall": null
    },
    "scope": {
      "max_orders": 50,
      "max_each_other_file": 60,
      "max_variable_records": 10,
      "max_alternatives_per_variable": 2,
      "max_raw_worlds": 4096
    },
    "receipt_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "source_revision": 1,
    "candidate_revision": 2,
    "policy_revision": 1
  },
  "files": {
    "orders.csv": {
      "content_base64": "b3JkZXJfaWQsY3VzdG9tZXJfaWQsb3JkZXJfdG90YWwsY3VycmVuY3kKTzEsQzEsMTAwLjAwLFVTRApPMixDMiwxMDAuMDAsVVNECk8zLEMzLDgwLjAwLFVTRAo="
    },
    "payments.csv": {
      "content_base64": "cGF5bWVudF9pZCxvcmRlcl9yZWYsYW1vdW50LGN1cnJlbmN5LHN0YXR1cwpQMSxPMSwxMDAuMDAsVVNELFNFVFRMRUQKUDIsTzIsMTAwLjAwLFVTRCxTRVRUTEVEClAzLE8zLDgwLjAwLFVTRCxTRVRUTEVECg=="
    },
    "deliveries.csv": {
      "content_base64": "ZGVsaXZlcnlfaWQsb3JkZXJfcmVmLHN0YXR1cwpEMSxPMSxERUxJVkVSRUQKRDIsTzIsREVMSVZFUkVECkQzLE8zLElOX1RSQU5TSVQK"
    },
    "refunds.csv": {
      "content_base64": "cmVmdW5kX2lkLHBheW1lbnRfcmVmLGFtb3VudCxzdGF0dXMKUjEsUDMsNS4wMCxDT01QTEVURUQK"
    }
  }
}
```

Response (`application/json`):

```json
{
  "error": {
    "code": "RECEIPT_TAMPERED",
    "message": "Receipt digest does not match canonical receipt body.",
    "path": "receipt.receipt_sha256",
    "details": {}
  },
  "verification_status": "NOT_VERIFIED",
  "verified": false
}
```

### 5.7 G1-B03 supporting literal contract fixtures (W01–W04; no new routes)

The `suggest_cases`, `review_meta_adoption`, `challenge_cases`, and `canonical_hash_vectors` top-level entries in the **separately transferred complete** `COMMERCE_API_EXAMPLES.json` contain these exact request/response bodies plus the hash preimages. The examples are **synthetic declarations**, not evidence of an executed Meta call or working endpoint. `http_status` and scenario setup labels are **fixture metadata**, not JSON response members. For the existing 12 valid/invalid six-route pairs, §5.1–§5.6 remains the literal source; all 24 original request/response blocks still match their corresponding companion objects.


#### W01 POST /suggest — registered genuine-shaped Meta candidate — HYPOTHETICAL / UNRUN

Server may register `delivery:D2 -> O3` only after a bounded, sanitised provider response. Here `AI_SUGGESTED` and `server_call_id` are **illustrative claims only**; a live G4 trace is still mandatory before presenting a real provider outcome.

Request (`application/json`; POST route is specified in heading):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 1,
  "mode": "META",
  "max_suggestions": 5,
  "expected_policy_revision": 0
}
```

Response (`application/json`; illustrative HTTP 200):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "ai_status": "AI_SUGGESTED",
  "suggestions": [
    {
      "record_type": "delivery",
      "record_id": "D2",
      "record_key": "delivery:D2",
      "target_type": "order",
      "target_id": "O3",
      "origin": "META_SUGGESTED",
      "evidence": "Candidate relates D2 to O3; source references O2 and must be reviewed.",
      "server_call_id": "example-srv-call-001",
      "catalog_effect": "ADDED_TARGET",
      "authorised": false
    }
  ],
  "source_revision": 1,
  "candidate_revision": 2,
  "policy_revision": 0,
  "state": "IMPORTED",
  "catalog_changed": true,
  "authorisations_changed": false,
  "model_call": {
    "provider": "META",
    "model": "muse-spark-1.3",
    "server_call_id": "example-srv-call-001",
    "execution": "SERVER_RESPONSE_RECEIVED"
  },
  "rejected_proposals": []
}
```

#### W01 POST /suggest — duplicate target with different origin — HYPOTHETICAL / UNRUN

Existing `SOURCE_REF delivery:D2 -> O2` gains a distinct `META_SUGGESTED` provenance entry but still has one selectable target O2. Catalog changes and candidate revision becomes 2; human permissions do not change.

Request (`application/json`; POST route is specified in heading):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 1,
  "mode": "META",
  "max_suggestions": 5,
  "expected_policy_revision": 0
}
```

Response (`application/json`; illustrative HTTP 200):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "ai_status": "AI_SUGGESTED",
  "suggestions": [
    {
      "record_type": "delivery",
      "record_id": "D2",
      "record_key": "delivery:D2",
      "target_type": "order",
      "target_id": "O2",
      "origin": "META_SUGGESTED",
      "evidence": "Model also proposed the existing D2 source reference O2.",
      "server_call_id": "example-srv-call-003",
      "catalog_effect": "ADDED_PROVENANCE",
      "authorised": false
    }
  ],
  "source_revision": 1,
  "candidate_revision": 2,
  "policy_revision": 0,
  "state": "IMPORTED",
  "catalog_changed": true,
  "authorisations_changed": false,
  "model_call": {
    "provider": "META",
    "model": "muse-spark-1.3",
    "server_call_id": "example-srv-call-003",
    "execution": "SERVER_RESPONSE_RECEIVED"
  },
  "rejected_proposals": []
}
```

#### W01 POST /suggest — repeated Meta proposal/no new catalogue entry — HYPOTHETICAL / UNRUN

Hypothetical server already registered the same Meta pair at `candidate_revision=2`; a new call uses new server call attribution but does not mutate canonical candidate provenance, policy or revision. `EXISTING_PROVENANCE_NO_OP` is not adoption.

Request (`application/json`; POST route is specified in heading):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 2,
  "mode": "META",
  "max_suggestions": 5,
  "expected_policy_revision": 0
}
```

Response (`application/json`; illustrative HTTP 200):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "ai_status": "AI_SUGGESTED",
  "suggestions": [
    {
      "record_type": "delivery",
      "record_id": "D2",
      "record_key": "delivery:D2",
      "target_type": "order",
      "target_id": "O3",
      "origin": "META_SUGGESTED",
      "evidence": "Candidate relates D2 to O3; source references O2 and must be reviewed.",
      "server_call_id": "example-srv-call-002",
      "catalog_effect": "EXISTING_PROVENANCE_NO_OP",
      "authorised": false
    }
  ],
  "source_revision": 1,
  "candidate_revision": 2,
  "policy_revision": 0,
  "state": "IMPORTED",
  "catalog_changed": false,
  "authorisations_changed": false,
  "model_call": {
    "provider": "META",
    "model": "muse-spark-1.3",
    "server_call_id": "example-srv-call-002",
    "execution": "SERVER_RESPONSE_RECEIVED"
  },
  "rejected_proposals": []
}
```

#### W01 POST /suggest — malformed provider proposal quarantined — HYPOTHETICAL / UNRUN

A provider-suggested nonexistent target is **not** placed in `suggestions[]` or the active catalogue; only a safe aggregate rejection code is returned. No catalogue revision changes.

Request (`application/json`; POST route is specified in heading):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 1,
  "mode": "META",
  "max_suggestions": 5,
  "expected_policy_revision": 0
}
```

Response (`application/json`; illustrative HTTP 200):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "ai_status": "AI_SUGGESTED",
  "suggestions": [],
  "source_revision": 1,
  "candidate_revision": 1,
  "policy_revision": 0,
  "state": "IMPORTED",
  "catalog_changed": false,
  "authorisations_changed": false,
  "model_call": {
    "provider": "META",
    "model": "muse-spark-1.3",
    "server_call_id": "example-srv-call-004",
    "execution": "SERVER_RESPONSE_RECEIVED"
  },
  "rejected_proposals": [
    {
      "reason_code": "INVALID_TARGET",
      "count": 1
    }
  ]
}
```

#### W01 POST /suggest — invalid caller parameter (typed 422) — HYPOTHETICAL / UNRUN

Request (`application/json`; POST route is specified in heading):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 1,
  "mode": "META",
  "max_suggestions": 61,
  "expected_policy_revision": 0
}
```

Response (`application/json`; illustrative HTTP 422):

```json
{
  "error": {
    "code": "INVALID_VALUE",
    "message": "max_suggestions exceeds the bounded request limit.",
    "path": "max_suggestions",
    "details": {}
  },
  "verified": false
}
```

The existing §5.2 `AI_UNAVAILABLE` success example and `suggest_cases.unavailable` remain the **always-working no-Meta path**; no candidate/adoption/policy mutation is implied.

#### W03 POST /review/validate — explicit human adoption of registered Meta edge — HYPOTHETICAL / UNRUN

This independent fixture starts from W01 `meta_success` (`candidate_revision=2`), with the server-registered Meta candidate **instead of** B02's manual D2 alternative. The full human review alone adopts D2->O3 as `POSSIBLE`; `manual_candidates=[]`. Its digest values are separate from the existing B02 manual review, whose bytes and vectors remain untouched.

Request (`application/json`; POST route is specified in heading):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 2,
  "expected_policy_revision": 0,
  "threshold_k": 2,
  "reviewer_label": "demo-reviewer",
  "review_attestation": {
    "all_rows_reviewed": true,
    "understands_bounded_predicate": true,
    "conflicting_source_ref_overrides_explained": true
  },
  "manual_candidates": [],
  "rows": [
    {
      "record_type": "payment",
      "record_id": "P1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P2",
      "edges": [
        {
          "target_id": "O2",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P3",
      "edges": [
        {
          "target_id": "O3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D2",
      "edges": [
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D3",
      "edges": [
        {
          "target_id": "O3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "refund",
      "record_id": "R1",
      "edges": [
        {
          "target_id": "P3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    }
  ],
  "reference_mapping": {
    "payment:P1": "O1",
    "payment:P2": "O2",
    "payment:P3": "O3",
    "delivery:D1": "O1",
    "delivery:D2": "O2",
    "delivery:D3": "O3",
    "refund:R1": "P3"
  }
}
```

Response (`application/json`; illustrative HTTP 200):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "state": "REVIEW_FROZEN",
  "source_revision": 1,
  "candidate_revision": 2,
  "policy_revision": 1,
  "candidate_catalog_sha256": "c81a620e1d70389cfae5b41a2d5dc933293ecafb052fe55e2b427f6cd7a9daab",
  "source_bundle_sha256": "e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50",
  "policy_sha256": "91a0a5d819757b7b8b6b17b56a5c7b4526c246553c1642e367067c7366aaed0a",
  "baseline_sha256": "a88d21b120afd518dae8c359e6508c2ff11036da96360498576c5d8ed65a1b66",
  "review_sha256": "a11d1186c5de25cb42b048e7f2e124070ddbd1e2b24abc0d732680d0819d7b69",
  "threshold_k": 2,
  "raw_worlds": 2,
  "admissible_worlds": 2,
  "invalid_worlds": 0,
  "variable_records": 1,
  "baseline_valid": true,
  "authorised_by": "HUMAN_REVIEW_ATTESTED_NOT_IDENTITY_VERIFIED"
}
```

#### W03 POST /review/validate — stale pre-suggestion review rejected — HYPOTHETICAL / UNRUN

Request (`application/json`; POST route is specified in heading):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 1,
  "expected_policy_revision": 0,
  "threshold_k": 2,
  "reviewer_label": "demo-reviewer",
  "review_attestation": {
    "all_rows_reviewed": true,
    "understands_bounded_predicate": true,
    "conflicting_source_ref_overrides_explained": true
  },
  "manual_candidates": [],
  "rows": [
    {
      "record_type": "payment",
      "record_id": "P1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P2",
      "edges": [
        {
          "target_id": "O2",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P3",
      "edges": [
        {
          "target_id": "O3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D2",
      "edges": [
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D3",
      "edges": [
        {
          "target_id": "O3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "refund",
      "record_id": "R1",
      "edges": [
        {
          "target_id": "P3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    }
  ],
  "reference_mapping": {
    "payment:P1": "O1",
    "payment:P2": "O2",
    "payment:P3": "O3",
    "delivery:D1": "O1",
    "delivery:D2": "O2",
    "delivery:D3": "O3",
    "refund:R1": "P3"
  }
}
```

Response (`application/json`; illustrative HTTP 409):

```json
{
  "error": {
    "code": "STALE_STATE",
    "message": "Candidate revision no longer matches registered suggestions.",
    "path": "expected_candidate_revision",
    "details": {
      "expected": 2,
      "received": 1
    }
  },
  "verified": false
}
```

#### W03 POST /review/validate — revoked Meta provenance rejected — HYPOTHETICAL / UNRUN

Precondition: server retracted the Meta candidate, incrementing candidate revision to 3; the submitted complete review still claims the removed D2->O3 edge. Server rejects the entire review without granting permissions.

Request (`application/json`; POST route is specified in heading):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 3,
  "expected_policy_revision": 0,
  "threshold_k": 2,
  "reviewer_label": "demo-reviewer",
  "review_attestation": {
    "all_rows_reviewed": true,
    "understands_bounded_predicate": true,
    "conflicting_source_ref_overrides_explained": true
  },
  "manual_candidates": [],
  "rows": [
    {
      "record_type": "payment",
      "record_id": "P1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P2",
      "edges": [
        {
          "target_id": "O2",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P3",
      "edges": [
        {
          "target_id": "O3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D2",
      "edges": [
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D3",
      "edges": [
        {
          "target_id": "O3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "refund",
      "record_id": "R1",
      "edges": [
        {
          "target_id": "P3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    }
  ],
  "reference_mapping": {
    "payment:P1": "O1",
    "payment:P2": "O2",
    "payment:P3": "O3",
    "delivery:D1": "O1",
    "delivery:D2": "O2",
    "delivery:D3": "O3",
    "refund:R1": "P3"
  }
}
```

Response (`application/json`; illustrative HTTP 422):

```json
{
  "error": {
    "code": "INVALID_REVIEW",
    "message": "Candidate is not active in the current registered catalogue.",
    "path": "rows.delivery:D2.edges.O3",
    "details": {}
  },
  "verified": false
}
```

#### W04 POST /challenge — complete STABLE_WITHIN_SCOPE — HYPOTHETICAL / UNRUN

Separate **hypothetical** complete accepted policy with K=1, policy revision 2 and recomputed digests (not the existing K=2 policy): both authorised worlds have clean count at least 1, so `witness=null` and exact minimum null. Counts and decision are not measured.

Request (`application/json`; POST route is specified in heading):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 2,
  "expected_policy_revision": 2,
  "expected_review_sha256": "0c298a4f34adce5ee5fac514cefafcc1dd7a300fa066500eea9db7787b23a85b",
  "time_budget_ms": 10000
}
```

Response (`application/json`; illustrative HTTP 200):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "state": "CHALLENGED",
  "run_id": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "source_revision": 1,
  "candidate_revision": 2,
  "policy_revision": 2,
  "review_sha256": "0c298a4f34adce5ee5fac514cefafcc1dd7a300fa066500eea9db7787b23a85b",
  "result": {
    "status": "STABLE_WITHIN_SCOPE",
    "predicate": "clean_fulfilled_count >= K",
    "threshold_k": 1,
    "baseline": {
      "clean_fulfilled_count": 2,
      "decision": true
    },
    "witness": null,
    "coverage": {
      "raw_worlds_total": 2,
      "raw_worlds_checked": 2,
      "invalid_worlds_total": 0,
      "invalid_worlds_checked": 0,
      "admissible_worlds_total": 2,
      "admissible_worlds_checked": 2,
      "checker_worlds_total": 2,
      "checker_worlds_checked": 2,
      "fully_enumerated": true,
      "checker_complete": true
    },
    "checker_status": "PASSED",
    "proof_basis": "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION",
    "minimum_distance_proven_within_scope": false,
    "reason": null,
    "minimum_link_distance_within_scope": null
  }
}
```

#### W04 POST /challenge — incomplete TIMEOUT — HYPOTHETICAL / UNRUN

For the same K=2 admitted universe, a deliberately truncated search cannot establish anything. `raw_worlds_total` is known, full invalid/admissible totals remain null.

Request (`application/json`; POST route is specified in heading):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 2,
  "expected_policy_revision": 1,
  "expected_review_sha256": "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9",
  "time_budget_ms": 10000
}
```

Response (`application/json`; illustrative HTTP 200):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "state": "REVIEW_FROZEN",
  "run_id": null,
  "source_revision": 1,
  "candidate_revision": 2,
  "policy_revision": 1,
  "review_sha256": "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9",
  "result": {
    "status": "NOT_VERIFIED",
    "reason": "TIMEOUT",
    "predicate": "clean_fulfilled_count >= K",
    "threshold_k": 2,
    "baseline": null,
    "witness": null,
    "coverage": {
      "raw_worlds_total": 2,
      "raw_worlds_checked": 1,
      "invalid_worlds_total": null,
      "invalid_worlds_checked": 0,
      "admissible_worlds_total": null,
      "admissible_worlds_checked": 1,
      "checker_worlds_total": null,
      "checker_worlds_checked": 0,
      "fully_enumerated": false,
      "checker_complete": false
    },
    "checker_status": "UNRUN",
    "proof_basis": "NONE",
    "minimum_distance_proven_within_scope": false,
    "minimum_link_distance_within_scope": null
  }
}
```

#### W04 POST /challenge — independent checker mismatch — HYPOTHETICAL / UNRUN

Search hypothetically reached all raw worlds but checker completed only one of two checks and returned `FAILED`; result must remain `NOT_VERIFIED`, with null baseline/witness/minimum.

Request (`application/json`; POST route is specified in heading):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 2,
  "expected_policy_revision": 1,
  "expected_review_sha256": "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9",
  "time_budget_ms": 10000
}
```

Response (`application/json`; illustrative HTTP 200):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "state": "REVIEW_FROZEN",
  "run_id": null,
  "source_revision": 1,
  "candidate_revision": 2,
  "policy_revision": 1,
  "review_sha256": "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9",
  "result": {
    "status": "NOT_VERIFIED",
    "reason": "CHECKER_MISMATCH",
    "predicate": "clean_fulfilled_count >= K",
    "threshold_k": 2,
    "baseline": null,
    "witness": null,
    "coverage": {
      "raw_worlds_total": 2,
      "raw_worlds_checked": 2,
      "invalid_worlds_total": 0,
      "invalid_worlds_checked": 0,
      "admissible_worlds_total": 2,
      "admissible_worlds_checked": 2,
      "checker_worlds_total": 2,
      "checker_worlds_checked": 1,
      "fully_enumerated": true,
      "checker_complete": false
    },
    "checker_status": "FAILED",
    "proof_basis": "NONE",
    "minimum_distance_proven_within_scope": false,
    "minimum_link_distance_within_scope": null
  }
}
```

#### W04 POST /review/validate — typed 422 LIMIT_EXCEEDED before search (separate eight-payment fixture) — HYPOTHETICAL / UNRUN

This is **not** the 7-nonorder-row B02 demonstration session. It uses a fresh separately illustrated parse with 8 distinct PENDING payments. Every payment has three reviewed targets (source O1 plus manual O2/O3), so the raw product is exactly `3^8=6561`, above 4096 **before** collisions are checked. The parser first validates the following four input files; the literal file-bytes request is:

```json
{
  "contract_version": "commerce.v1",
  "files": {
    "orders.csv": {
      "content_base64": "b3JkZXJfaWQsY3VzdG9tZXJfaWQsb3JkZXJfdG90YWwsY3VycmVuY3kKTzEsQzEsMTAwLjAwLFVTRApPMixDMiwxMDAuMDAsVVNECk8zLEMzLDEwMC4wMCxVU0QK"
    },
    "payments.csv": {
      "content_base64": "cGF5bWVudF9pZCxvcmRlcl9yZWYsYW1vdW50LGN1cnJlbmN5LHN0YXR1cwpQMSxPMSwxLjAwLFVTRCxQRU5ESU5HClAyLE8xLDIuMDAsVVNELFBFTkRJTkcKUDMsTzEsMy4wMCxVU0QsUEVORElORwpQNCxPMSw0LjAwLFVTRCxQRU5ESU5HClA1LE8xLDUuMDAsVVNELFBFTkRJTkcKUDYsTzEsNi4wMCxVU0QsUEVORElORwpQNyxPMSw3LjAwLFVTRCxQRU5ESU5HClA4LE8xLDguMDAsVVNELFBFTkRJTkcK"
    },
    "deliveries.csv": {
      "content_base64": "ZGVsaXZlcnlfaWQsb3JkZXJfcmVmLHN0YXR1cwo="
    },
    "refunds.csv": {
      "content_base64": "cmVmdW5kX2lkLHBheW1lbnRfcmVmLGFtb3VudCxzdGF0dXMK"
    }
  }
}
```

The subsequent reviewer replacement request and its typed HTTP 422 are:

```json
{
  "contract_version": "commerce.v1",
  "session_id": "22222222222222222222222222222222",
  "expected_source_revision": 1,
  "expected_candidate_revision": 1,
  "expected_policy_revision": 0,
  "threshold_k": 1,
  "reviewer_label": "demo-reviewer",
  "review_attestation": {
    "all_rows_reviewed": true,
    "understands_bounded_predicate": true,
    "conflicting_source_ref_overrides_explained": true
  },
  "manual_candidates": [
    {
      "record_type": "payment",
      "record_id": "P1",
      "target_id": "O2",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P1",
      "target_id": "O3",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P2",
      "target_id": "O2",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P2",
      "target_id": "O3",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P3",
      "target_id": "O2",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P3",
      "target_id": "O3",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P4",
      "target_id": "O2",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P4",
      "target_id": "O3",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P5",
      "target_id": "O2",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P5",
      "target_id": "O3",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P6",
      "target_id": "O2",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P6",
      "target_id": "O3",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P7",
      "target_id": "O2",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P7",
      "target_id": "O3",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P8",
      "target_id": "O2",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    },
    {
      "record_type": "payment",
      "record_id": "P8",
      "target_id": "O3",
      "reason": "Reviewer permits a competing same-currency parent after record inspection."
    }
  ],
  "rows": [
    {
      "record_type": "payment",
      "record_id": "P1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P2",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P3",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P4",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P5",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P6",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P7",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P8",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    }
  ],
  "reference_mapping": {
    "payment:P1": "O1",
    "payment:P2": "O1",
    "payment:P3": "O1",
    "payment:P4": "O1",
    "payment:P5": "O1",
    "payment:P6": "O1",
    "payment:P7": "O1",
    "payment:P8": "O1"
  }
}
```

```json
{
  "error": {
    "code": "LIMIT_EXCEEDED",
    "message": "Raw Cartesian product exceeds the 4096 world cap.",
    "path": "review.options",
    "details": {
      "raw_worlds_total": 6561,
      "max_raw_worlds": 4096,
      "result_status": "NOT_VERIFIED"
    }
  },
  "verified": false
}
```

#### W04 POST /review/validate — contradictory reviewed policy — HYPOTHETICAL / UNRUN

A separate invalid attempt on the original demo forces two full `SETTLED` payments onto O1 (including an explicit manual source override for P2). With the remaining source rows confirmed, **no** admissible world survives; reject preflight, do not start a challenge.

Request (`application/json`; POST route is specified in heading):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 1,
  "expected_policy_revision": 0,
  "threshold_k": 2,
  "reviewer_label": "demo-reviewer",
  "review_attestation": {
    "all_rows_reviewed": true,
    "understands_bounded_predicate": true,
    "conflicting_source_ref_overrides_explained": true
  },
  "manual_candidates": [
    {
      "record_type": "delivery",
      "record_id": "D2",
      "target_id": "O3",
      "reason": "Carrier reference may have been copied from a neighbouring order."
    },
    {
      "record_type": "payment",
      "record_id": "P2",
      "target_id": "O1",
      "reason": "Reviewer disputes the payment source reference."
    }
  ],
  "rows": [
    {
      "record_type": "payment",
      "record_id": "P1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P2",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        },
        {
          "target_id": "O2",
          "disposition": "PROHIBITED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P3",
      "edges": [
        {
          "target_id": "O3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D2",
      "edges": [
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D3",
      "edges": [
        {
          "target_id": "O3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "refund",
      "record_id": "R1",
      "edges": [
        {
          "target_id": "P3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    }
  ],
  "reference_mapping": {
    "payment:P1": "O1",
    "payment:P2": "O1",
    "payment:P3": "O3",
    "delivery:D1": "O1",
    "delivery:D2": "O2",
    "delivery:D3": "O3",
    "refund:R1": "P3"
  }
}
```

Response (`application/json`; illustrative HTTP 422):

```json
{
  "error": {
    "code": "CONTRADICTORY_POLICY",
    "message": "No admissible world satisfies all reviewed constraints.",
    "path": "rows",
    "details": {
      "admissible_worlds": 0,
      "result_status": "NOT_VERIFIED"
    }
  },
  "verified": false
}
```

#### W04 POST /review/validate — invalid baseline mapping — HYPOTHETICAL / UNRUN

Baseline assigns D2 to nonexistent O9, so this is a typed 422 rather than a `200` incomplete result.

Request (`application/json`; POST route is specified in heading):

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "expected_source_revision": 1,
  "expected_candidate_revision": 1,
  "expected_policy_revision": 0,
  "threshold_k": 2,
  "reviewer_label": "demo-reviewer",
  "review_attestation": {
    "all_rows_reviewed": true,
    "understands_bounded_predicate": true,
    "conflicting_source_ref_overrides_explained": true
  },
  "manual_candidates": [
    {
      "record_type": "delivery",
      "record_id": "D2",
      "target_id": "O3",
      "reason": "Carrier reference may have been copied from a neighbouring order."
    }
  ],
  "rows": [
    {
      "record_type": "payment",
      "record_id": "P1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P2",
      "edges": [
        {
          "target_id": "O2",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "payment",
      "record_id": "P3",
      "edges": [
        {
          "target_id": "O3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D1",
      "edges": [
        {
          "target_id": "O1",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D2",
      "edges": [
        {
          "target_id": "O2",
          "disposition": "POSSIBLE"
        },
        {
          "target_id": "O3",
          "disposition": "POSSIBLE"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "delivery",
      "record_id": "D3",
      "edges": [
        {
          "target_id": "O3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    },
    {
      "record_type": "refund",
      "record_id": "R1",
      "edges": [
        {
          "target_id": "P3",
          "disposition": "CONFIRMED"
        }
      ],
      "unmatched": "PROHIBITED"
    }
  ],
  "reference_mapping": {
    "payment:P1": "O1",
    "payment:P2": "O2",
    "payment:P3": "O3",
    "delivery:D1": "O1",
    "delivery:D2": "O9",
    "delivery:D3": "O3",
    "refund:R1": "P3"
  }
}
```

Response (`application/json`; illustrative HTTP 422):

```json
{
  "error": {
    "code": "INVALID_BASELINE",
    "message": "Reference mapping selects a target outside reviewed permissions.",
    "path": "reference_mapping.delivery:D2",
    "details": {
      "target_id": "O9"
    }
  },
  "verified": false
}
```

**W03/W04 exact canonical digest vectors.** Compute `SHA256(ASCII(domain) || 0A || UTF8(CJSON(payload)))` for each entry under `canonical_hash_vectors` in the companion file. The `payload` property is the **full minimal canonical hash input**, not the example request envelope; ASCII minified JSON, sorted object keys, no terminal newline. The registered Meta candidate catalogue contains an additional `META_SUGGESTED` entry with server attribution; the revised **K=1 stable** case reuses the original B02 manual candidate registry but has a new policy/baseline/review digest. No output below is independently measured.

| Canonical preimage | Domain | Payload bytes | Expected SHA-256 |
|---|---|---:|---|
| `meta_candidate_catalog` | `JW-COMMERCE-CANDIDATES-v1` | 711 | `c81a620e1d70389cfae5b41a2d5dc933293ecafb052fe55e2b427f6cd7a9daab` |
| `meta_policy` | `JW-COMMERCE-POLICY-v1` | 2072 | `91a0a5d819757b7b8b6b17b56a5c7b4526c246553c1642e367067c7366aaed0a` |
| `meta_baseline` | `JW-COMMERCE-BASELINE-v1` | 234 | `a88d21b120afd518dae8c359e6508c2ff11036da96360498576c5d8ed65a1b66` |
| `meta_review` | `JW-COMMERCE-REVIEW-v1` | 169 | `a11d1186c5de25cb42b048e7f2e124070ddbd1e2b24abc0d732680d0819d7b69` |
| `stable_policy` | `JW-COMMERCE-POLICY-v1` | 2111 | `706acbcd45e5fb82c82a118f93daea9bb10dc685a003998679c7047660511c77` |
| `stable_baseline` | `JW-COMMERCE-BASELINE-v1` | 234 | `db2aa1b8d330e97582701585f0d55db5a3ac0e3cb4d4f25b1b049ccd5f885c3b` |
| `stable_review` | `JW-COMMERCE-REVIEW-v1` | 169 | `0c298a4f34adce5ee5fac514cefafcc1dd7a300fa066500eea9db7787b23a85b` |
| `reversal_receipt_core` | `JW-COMMERCE-RECEIPT-v1` | 4246 | `9f91554882665727c0d04112d7c8ebd9b77eb9f9be6fad7f7a9edde7633ce7e8` |

The B02 source bundle and manual-review policy/baseline/review content digests do not change. Only the **illustrative receipt core checksum** changes because the witnessed result/coverage object now uses the W04 normal form. Receipt/replay §5.5–§5.6 and companion input contain that recomputed checksum. Hash equality shows reproducible **fixture arithmetic only**, never server execution or authenticity.

## 6. Typed error/status catalogue and invalidation policy

| Code | HTTP / result | Required fail-closed behaviour |
|---|---|---|
| `MISSING_FILE`, `UNEXPECTED_FILE`, `INVALID_SCHEMA`, `INVALID_SOURCE`, `INVALID_VALUE` | `400/422` | Reject import, identify source/path, no session created. |
| `DUPLICATE_ID`, `DUPLICATE_EVENT`, `MISSING_REFERENCED_RECORD`, `CURRENCY_MISMATCH` | `422` | Reject bad source or reviewed candidate, never infer fix. |
| `MALFORMED_CANDIDATE`, `UNREVIEWED_CANDIDATE`, `REVIEW_INCOMPLETE` | `422` | No policy freeze; suggestions cannot grant permission. |
| `INVALID_REVIEW`, `INVALID_BASELINE`, `INCONSISTENT_REVIEW`, `UNREACHABLE_CHOICE` | `422` | Reject incomplete/contradictory policy; retain previous known-good state. |
| `LIMIT_EXCEEDED` | `413/422`, `NOT_VERIFIED` | Hard caps checked **before** search; no truncation or stability. |
| `TIMEOUT` | `200`, `result.status=NOT_VERIFIED` | Stop bounded execution, include counts marked partial and checker `UNRUN`, no minimum. |
| `CHECKER_MISMATCH`, `ENGINE_INTERRUPTED` | `200` `NOT_VERIFIED` or `503` | Fail closed; no proof claim or receipt. |
| `STALE_STATE`, `SESSION_EXPIRED` | `409` | No mutation of prior run, reject stale source/review/snapshot epoch. |
| `RUN_NOT_FOUND`, `RECEIPT_NOT_READY` | `404/409` | No premature receipt export. |
| `RECEIPT_TAMPERED`, `SOURCE_MISMATCH`, `ENGINE_VERSION_MISMATCH` | `422/409`, `NOT_VERIFIED` | Replay rejects; historical byte/version proof not recovered silently. |
| `AI_UNAVAILABLE` | `200 ai_status=AI_UNAVAILABLE` or `503` | Deterministic import/review/search still works. |
| `RATE_LIMITED`, `ACCESS_DENIED` | `429/401/403` | No unauthenticated inference or privileged session access. |

Challenge timeout example (`200` run-started, **hypothetical**, never measured); other full status and preflight examples are in §5.7 and companion JSON:

```json
{
  "contract_version": "commerce.v1",
  "session_id": "0123456789abcdef0123456789abcdef",
  "state": "REVIEW_FROZEN",
  "run_id": null,
  "source_revision": 1,
  "candidate_revision": 2,
  "policy_revision": 1,
  "review_sha256": "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9",
  "result": {
    "status": "NOT_VERIFIED",
    "reason": "TIMEOUT",
    "predicate": "clean_fulfilled_count >= K",
    "threshold_k": 2,
    "baseline": null,
    "witness": null,
    "coverage": {
      "raw_worlds_total": 2,
      "raw_worlds_checked": 1,
      "invalid_worlds_total": null,
      "invalid_worlds_checked": 0,
      "admissible_worlds_total": null,
      "admissible_worlds_checked": 1,
      "checker_worlds_total": null,
      "checker_worlds_checked": 0,
      "fully_enumerated": false,
      "checker_complete": false
    },
    "checker_status": "UNRUN",
    "proof_basis": "NONE",
    "minimum_distance_proven_within_scope": false,
    "minimum_link_distance_within_scope": null
  }
}
```

## 7. Planned deterministic synthetic evaluation (NOT EXECUTED)

**Fixture identity:** `commerce_demo_seed_20261101_v1`. Algorithm: fixed named rows in four CSVs in order `O1..O3`, `P1..P3`, `D1..D3`, `R1`, exact UTF-8 LF bytes shown in §5.1 Parse. Deterministic generator writes these literal bytes and separately derives a SHA-256 manifest; no PRNG needed for seed 0. A scalable future generator must be separately versioned and seeded; never use hidden `ground_truth.json` in the product or candidate algorithm.

- Orders: `O1=USD100`, `O2=USD100`, `O3=USD80`. Each has exactly one settled full-payment source reference. Deliveries `D1->O1` and `D2->O2` are `DELIVERED`; `D3->O3` is `IN_TRANSIT`. `R1->P3` is a **completed USD5 refund**. `K=2`.
- Reviewer confirms six straightforward row targets and explicitly admits exactly two possibilities for `D2`: source-reference `O2` and **manual** `O3`, with a logged reference-conflict reason. The **human-adopted baseline** chooses `D2->O2`. Other edges and unmatched are locked or forbidden. Raw choice product is two; both are predicted structurally admissible.
- **HYPOTHESIS ONLY:** Baseline `O1`,`O2` clean gives count 2 => `true`; alternative `D2->O3` removes clean delivery from `O2`, while `O3` remains disqualified by its linked completed refund, giving count 1 => `false`. Predicted minimum changed source relationships: one (`delivery:D2`). The results are **not independently verified or measured** by JoinWitness; both computed values and any timings must be derived from the actual G2 run and independent checker.
- Required further fixtures: stable-within-scope (same import and K=1 so both candidate worlds plausibly pass, reviewed again with fresh policy revision); contradiction (two settled payments necessarily assigned to same order, no admissible baseline); cap (`>=8` variables with three choices if raw product 3^8=6561); timeout with forced low monotonic budget; duplicate IDs, unknown refs, wrong currency, semantic duplicates, partial completed refund, null-only unmatched, stale K, tampered receipt, changed CRLF/LF, and no-Meta path. **Do not label any PASS until executed.**

**Digest register for the proposed literal fixture (byte arithmetic computed separately, not engine proof):**

| Item | SHA-256 |
|---|---|
| orders.csv | `8063a0ead1bdbf5764900e34009e9331847d7e74e57b541a6e554bdcfbf0ee95` |
| payments.csv | `9dbac299fb73598818afeef13d3827cb40da73de1fb38966399cc3a94100f441` |
| deliveries.csv | `e02c99782c8f02ae8b50572cc3fcadfec12d7c00d6f9b272711388fd4ec2c084` |
| refunds.csv | `aae37407144077385b8ad87b33d8d8faeb4b9d32f67988c4960c17b79469de56` |
| source bundle | `e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50` |
| reviewed candidate catalog (proposed canonical recipe) | `4c8646f8684112ba4cb3a1bfb072b73e8aa2b309ce199e1e9567a6cb99db5098` |
| policy snapshot (proposed canonical recipe) | `cc07bdc869ad4c8f2ad1bbadbb8c853404cbd03701c6baee45111d998ca0ffba` |
| reference baseline (proposed canonical recipe) | `49cf0a9061605aa42b5735d130a9c9eb1ad692860119fd62c753dd0538c8fd74` |
| review snapshot (exact §1.3 vector) | `152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9` |
| illustrative receipt core (revision-bound, not a live receipt) | `9f91554882665727c0d04112d7c8ebd9b77eb9f9be6fad7f7a9edde7633ce7e8` |

## 8. Remaining G1 decisions requiring A/D disposition

**G1-B03 W01–W04 are proposals awaiting an independent Chat D wire check, not an HQ freeze or a proven implementation. W05/W06 were decided by HQ and applied above.** Previously identified security, count semantics, receipt authenticity and runtime evidence gaps below remain outstanding; this G1 document does not resolve them by assertion.


1. **Human authority and session security:** §3.2 proposes a loopback-only unauthenticated development boundary and precise TTL; A/D must approve or amend those controls. Real public authentication/authorisation and identity ownership remain undefined and **deployment blocked**. `reviewer_label` is not identity proof.
2. **Currency and status vocabulary:** proposed strict `USD|INR` and literal per-table enum sets; A approves or changes now, before C integration.
3. **Unmatched completed refunds and source reference overrides:** accept explicit unmatched/contradictory-source choices only under visible manual review, or require an even stricter fail-closed policy? Current proposal explicitly permits reviewed unmatched; Chat D should adversarially test resultant coverage statements.
4. **One-to-one collision interpretation:** strict duplicate settlement/delivery/completed-refund ban per world, even for events that would otherwise be nonqualifying; confirm no multi-payment aggregation. Confirm review rejection for any permitted option impossible in all admissible worlds.
5. **Candidate completeness boundary:** v1 enumerates *reviewed candidate choices only*, not all conceivable cross-file links. An exact source ref is a proposal, blank refs are not silently inferred. Review cannot claim exhaustive universe of real-world relationships.
6. **Wire mechanics:** JSON with Base64 bytes (not multipart), isolated in-memory loopback sessions, 64 KiB/file, default/maximum 10s monotonic budget, strict headers, exact HTTP statuses and hash recipe; A must ratify before C consumes. Implementation/build identity and actual runtime expiry UX still require tests.
7. **Receipt trust wording:** hash-based consistency/replay without a signer is deliberately *not* authenticated provenance. A/D must approve explicit caveat, or scope a signing mechanism separately without compromising deadline.
8. **Proof scope and comparator:** independent checker re-enumerates every reviewed world; if implementation cannot support this with actual 10s cap, reduce row/variable cap through HQ decision rather than silently degrade claim.

**G1-B03 companion exact file identity:** `docs/COMMERCE_API_EXAMPLES.json` is a separately delivered detached document, **not** an automatically created repository file. SHA-256 `5aac810f4dd72fd2ee9db69d922fcc16a6e9cfeb565ffb31b5eb1d61fc518148`; all twelve original request/response pairs in §5 match its machine-readable `valid_request`, `valid_response`, `invalid_request`, `invalid_response` JSON objects byte-for-byte after canonical JSON serialisation (formatting indentation differs intentionally). The SHA belongs to the **JSON file bytes** including its single terminal LF, not a JSON semantic digest.

## 9. Precise cross-chat handoff (no permission to code yet)

**Chat A (HQ, sole integration authority):** Receive this entire G1-B03 corrected draft plus document SHA-256; record `G1_B03_DRAFT_READY_FOR_A_D_REVIEW`, **not** `G1_CONTRACT_FROZEN`. Obtain D's adversarial disposition and owner approval for any narrow changes. Publish exact approved hash/version and integration prefix. Do **not** allow B/C shared-worktree edits before protected T09 backup/staging. Only A later integrates `backend/commerce_api.py` into `backend/api.py`.

**Chat D (independent red team):** Test (a) raw-versus-admissible world completeness and 3^8 cap; (b) order/settlement/delivery/refund double-count prevention; (c) unmatched/partial refunds and currency mismatch; (d) source-hint vs manual override; (e) candidate universe coverage and unreachable options; (f) baseline hash/K invalidation; (g) source/policy/receipt tamper; (h) independent recomputation and earliest/min-distance tie-break; (i) failure statuses and lack of false `STABLE_WITHIN_SCOPE`; (j) unauthenticated reviewer/session abuse. Return PASS/HOLD/NO-GO with exact lines and changed terms only; **no QA PASS based on these hypothetical examples**.

**Chat C (after G1 freeze only):** Map literal `state`, `ai_status`, reviewer choices, `reference_mapping`, `result.status`, `checker_status`, proof/coverage and stale `expected_policy_revision` fields into Atlas. All fixtures are hypothetical; UI must not render them as live API data. Four source layers only. No fabricated Meta success or proof badge.

**Chat B next gate after owner/HQ approval:** Implement only `src/joinwitness/commerce/**`, `backend/commerce_api.py`, `fixtures/commerce_demo/**`, `tests/test_commerce_*.py`, `docs/COMMERCE_CONTRACT.md` in B-owned isolated worktree; provide actual code/run hashes, independent checker, reproducible reversal + stable/inconclusive/error evidence, timings and no-Meta run to A/D. Do not touch shared backend/api.py, event mathematical engine, current untracked T09 workspace, Git state or deployment without A/owner grant.

**Disposition:** `G1_B03_DRAFT_READY_FOR_A_D_REVIEW` — interface deliberately **NOT FROZEN**, engine **NOT IMPLEMENTED**, G2 tests **UNRUN**, no repo edits or deployment.

