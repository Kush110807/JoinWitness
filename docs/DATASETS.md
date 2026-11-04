# Datasets and example provenance

All bundled source records are **fictional or synthetic test fixtures**. They must not be presented as customer, financial or attendance records collected from real people. They are sufficient for reproducing specified *software behaviour*, not for estimating real-world matching accuracy.

## Demonstration datasets

| Path | Purpose | Notes |
| --- | --- | --- |
| [`fixtures/commerce_demo/`](../fixtures/commerce_demo/) | Four-file commerce illustration: orders, payments, deliveries and refunds | Original CSV bytes are pinned in `MANIFEST.json`; includes the D2 alternative used in the accepted K=2 challenge |
| [`fixtures/demo60_90/`](../fixtures/demo60_90/) | Larger event example: 60 attendance records and 90 registrations | Includes frozen policy/reference artefacts and a source manifest; its `ground_truth.json` is a **synthetic evaluation artefact**, not evidence the product recovered truth |
| [`frontend/src/fixtures/commerce_demo/`](../frontend/src/fixtures/commerce_demo/) | Browser-bundled commerce demonstration | These copies intentionally match the four source fixture files byte-for-byte |
| [`frontend/src/fixtures/demo60_90/`](../frontend/src/fixtures/demo60_90/) | Browser-bundled event demonstration | Historical CRLF bytes are preserved for source-identity checks |

## Test cases

The `fixtures/` directory also contains focused cases named `stable`, `tie`, `flagship_flip`, `two_changes`, `false_reference` and `invalid`. They exercise particular positive, negative and validation paths, not a population of real entities.

The `commerce_demo_cap8` and `commerce_demo_empty` files exercise bounded import/review cases, including empty auxiliary sources. The `ai_mock` folder contains offline model-suggestion fixture data; it is **not** a recorded real provider response.

## How to interpret hashes and labels

- A manifest hash validates **byte identity** under the declared canonicalisation recipe.
- A policy or reference file records **a review scenario**, not external ground truth.
- A minimal counterexample is valid only in the admitted review universe.
- A generated or intentionally incorrect source remains a fixture even when tests pass against it.

Do not normalise line endings, overwrite source fixtures or change the frozen Commerce contract to improve presentation. The original bytes participate in the verification record.

See [Methodology](METHODOLOGY.md) for the formal interpretation of the candidate universe, and [Verification](../VERIFICATION_MANIFEST.md) for the reported local results.
