# Methodology: robustness under record-linkage ambiguity

## 1. Research question

Let **D** be an imported set of source records, **P** a human-reviewed policy defining permissible relationships, and **b** the explicit reference assignment. Let **W(D, P)** be the finite set of assignments admitted by the validated sources, candidate catalogue, review policy and relevant uniqueness/consistency constraints.

A decision rule **f(w)** produces a claim for an assignment **w**. JoinWitness asks:

> Does there exist an admissible **w ∈ W(D, P)** such that **f(w) differs from f(b)**? If so, what is the smallest permitted change needed?

The reported distance is measured between source-record assignments, not textual similarity between names or a statistical confidence score. For an assignment vector, the relevant distance counts changed links relative to the frozen reference.

The question is only meaningful once the candidate universe, allowed unmatched states, reference mapping and decision threshold have been frozen. None of those is a model-inferred fact.

## 2. Evidence pipeline

| Stage | Invariant | Failure mode prevented |
| --- | --- | --- |
| Source import | Strict schemas, size bounds, source-byte digests and separate parsed-data identities | Silent data normalisation or unexplained input drift |
| Candidate catalogue | Source hints and suggestions remain distinguishable from authorised edges | Treating a likely match as a reviewed fact |
| Human review | Complete, revised, explicitly adopted candidate/permission state | Silent approval or a stale policy challenge |
| Challenge | Search only admitted worlds; report completeness and proof basis | Claiming global robustness from truncated enumeration |
| Independent check | Recompute the proposed witness without trusting the search result alone | Unchecked solver or search output |
| Receipt / replay | Bind to source, policy, baseline and reported evidence | Replay of mismatched or tampered inputs |

A valid receipt checks consistency of those bytes and fields. SHA-256 digests do not identify a trusted issuer and do not prove that an alternative linkage is true in the world.

## 3. Case B: finite commerce relation worlds

The Commerce `commerce.v1` scenario accepts exactly four file types: **orders, payments, deliveries and refunds**. Its narrow decision predicate is `clean_fulfilled_count >= K`, with **K** explicitly chosen and frozen.

For this model a clean fulfilment requires a qualifying settled payment and delivered shipment satisfying the frozen matching requirements, without a disqualifying linked completed refund. This is deliberately **not** a general accounting, tax, chargeback, inventory or shipping reconciliation system.

The frozen contract limits the number of orders, records, variable relationships and raw Cartesian combinations; cases outside the caps fail closed rather than being sampled while labelled exhaustive. See the [normative Commerce contract](COMMERCE_CONTRACT.md) for exact admissibility and bounds.

In the demonstration policy, **K = 2**. The reference mapping has **2/3** cleanly fulfilled orders. A single permitted change in the delivery mapping, **D2: O2 → O3**, gives **1/3**. The reported result `REVERSED_EXHAUSTIVE` and independent recomputation support a minimal **one-link** reversal **within that frozen finite scope**. This does not suggest O3 is the true recipient of D2.

## 4. Case A: event membership and lead stability

The event investigation starts from bounded registration/attendance data and a frozen human-reviewed set of permitted identity assignments. The illustrated 60/90 example has **12 ambiguous attendance records**, an original **32:28** result, and an admissible **30:30** alternative after two changed assignments.

The OR-Tools CP-SAT search seeks a minimal reversal under its accepted constraints. Independent checking evaluates the returned assignments and the decision. The published evidence distinguishes **solver-attributed minimum proof** from small-instance exhaustive oracle testing; a successfully checked witness alone does not independently establish the optimum for every possible dataset.

This alternative removes the original lead: a **tie**, not a demonstrated Group B victory.

## 5. AI and human authority

Candidate suggestions may assist inspection but never enter the admitted-world model automatically. Adopting a suggestion, allowing an alternative, choosing a reference, fixing K and attesting review completeness are separate human decisions. Invalid revisions fail closed.

The released demonstration does not exercise successful live Meta inference: it operates in `OFFLINE_ONLY` mode and displays `AI_UNAVAILABLE` when suggestion transport is unavailable. Therefore the observed robustness findings are **not model-generated judgements**.

## 6. Threats to validity

- **Candidate completeness.** Missing real-world alternatives can make a within-scope stable result misleading outside that scope.
- **Policy sensitivity.** A different reviewer or approval threshold may admit different worlds.
- **Source provenance.** A source digest detects changes to bytes, not whether records were originally truthful.
- **Search qualification.** Exhaustive finite enumeration and solver-reported optima require different proof language; timeouts and caps must not be labelled stable.
- **External validity.** The provided examples are synthetic. There is no field study of real reconciliation quality, reviewer behaviour or decision impact.
- **Security.** The local single-machine harness is not a multi-user production system.
- **Reproducibility.** The final test totals are local recorded evidence, not independently reproduced public CI.

## 7. Next experiments

Useful future work would evaluate candidate-set coverage against independently labelled datasets, measure sensitivity to a deliberately withheld plausible match, study how reviewers interpret proof qualifications, and add authenticated production-grade review/audit storage. Live model suggestions would require a separately evaluated provider integration and explicit privacy/billing controls.

Those are research directions, not functionality claimed in the submitted release.
