# Design notes: making uncertainty inspectable

These notes explain the product choices made while developing JoinWitness. They are not a retrospective claim that the system has been evaluated with real customers, and they do not supersede the [methodology](METHODOLOGY.md) or versioned contracts.

## The question came before the interface

The starting point was not a dashboard. It was a failure of interpretation: a conclusion can look settled because the software silently picks one record linkage. A viewer sees a count but cannot see how many different legitimate interpretations might produce a different count.

The product therefore needed to answer three questions in sequence:

- What result is currently being asserted?
- Which underlying relationships remain genuinely open to review?
- If those relationships are reassigned within a *permitted* set, does the result change—and what evidence supports the claim?

A visualisation that looks compelling but cannot answer those questions is not sufficient.

## Why the four stages are distinct

**Import** establishes source identity and validation; it does not grant permissions. **Review** is the only place where permissible relationships and the reference policy are authorised. **Challenge** interrogates the frozen reviewed world. **Verify** examines the result, checker and replay evidence.

The separation is intentional. Combining candidate generation, permission and verification into a single model action would make it difficult to tell which part of a conclusion came from a person, an algorithm or a data source.

That is also why clicking a point in the constellation is inspect-only. A graphical selection must never become a hidden policy mutation.

## What the early interfaces failed to explain

The first functioning browser slices demonstrated the API flow but remained dominated by forms, raw status values and stacked controls. They could be *functionally* correct and still fail the central product job: helping somebody understand why a particular record could change a decision.

The Decision Atlas was developed to repair that gap, not simply to apply a dark theme. It places the **question** alongside a visible **uncertainty field**, provides a **selected-record inspector**, compares **reference and alternative outcomes**, and keeps proof details within reach.

Later desktop and mobile review exposed layout problems: critical parts of the scene below the fold, review controls stretching the canvas, and long evidence labels clipping horizontally. The audited R2 revision addressed those concrete defects in Challenge and Commerce Review. A **subsequent unified frontend** extended the dark Atlas to Import, Review and Verify for both scenarios, with a separate Case A Review and keyboard refinement. Local screenshots cover 1440×900, 1728×1080, 390×844 and 375×812. The revised visual system is coherent across stages, but independent usability research and complete accessibility attestation remain outstanding.

## Why two investigations

The event case tests whether an apparent winner keeps a lead after permissible identity changes. The commerce case tests a threshold predicate over four differently typed sources. They are deliberately different.

They share the same **reasoning pattern**—source → review → alternative → checker → receipt—but not the same search proof. That contrast is useful: a consistent product interaction should not force mathematical claims into a one-size-fits-all label.

The examples remain fictional. They were chosen to make the consequence of an alternative relationship understandable in a short demonstration, not to establish market demand or empirical accuracy.

## Design principles that survived the iterations

| Choice | Reason |
| --- | --- |
| Show the original assignment and the proposed alternative together | A bare “reversed” label hides what actually changed |
| Make human adoption explicit | A model's confidence, or the appearance of a line, is not authorisation |
| Preserve proof-basis labels | A verified witness and an independently established minimum are different claims |
| Default to truthful unavailable states | A failed or disabled model transport should not generate a fabricated candidate |
| Keep receipts inspectable and replayable | An outcome needs a route back to the source and policy used to produce it |
| Retain deliberate bounds | A small, fully examined universe is preferable to an unbounded claim based on incomplete search |

## What I would test next

A useful next study would put the interface in front of reviewers who have **not** read the specifications. I would measure whether they can distinguish a suggested link from an authorised one; explain the D2 counterexample without treating it as factual truth; and correctly interpret a solver-attributed result versus an exhaustive result. Another experiment would intentionally hide a plausible candidate to quantify how much a “stable” judgement depends on catalogue completeness.

Those are unresolved questions, not unreported successes.

## Maintainer and tool use

The project direction, constraints, scene acceptance criteria and release choices were driven by **Kushaagra Gupta**. Implementation, debugging and editorial work were supported by **Muse Code** and **ChatGPT**. The record of changes, tests and rejected designs is retained rather than recasting the project as the output of a single author working alone or as a product that needed no human review.
