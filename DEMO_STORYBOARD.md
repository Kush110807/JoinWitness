# JoinWitness — Three-minute demonstration storyboard

**Target:** ~170 seconds (maximum 180 seconds).  
**Environment:** verified R2 local release, fictional fixture data, Chrome; backend \`127.0.0.1:8001\`, frontend \`127.0.0.1:5178\`.  
**Purpose:** show decision robustness rather than a generic reconciliation dashboard. This document is a freshly authored public demo guide based on observed release evidence.

| Time | Screen / live action | Suggested narration |
|---|---|---|
| 0:00–0:20 | Decision Atlas home; show Case A and Case B launchers. | “A result can look certain even when its underlying record matches are not. JoinWitness tests whether a conclusion survives permissible uncertainty.” |
| 0:20–0:40 | Select **Commerce**. Click **Explore fictional commerce example**, showing the four CSV sources. | “We begin with fictional orders, payments, deliveries and refunds. Importing them creates a draft, not an approval.” |
| 0:40–1:15 | Review: inspect delivery **D2**, candidate **O2** versus **O3**, and actual human permission controls. Show adoption/attestations/K=2. | “Suggestions and source hints are only possibilities. A person must explicitly permit the alternatives and freeze the review. The threshold is two cleanly fulfilled orders.” |
| 1:15–1:45 | Challenge: show the interactive constellation and the decision-changing server witness. | “Within the reviewed finite scope, the original **2/3** falls to **1/3** if D2 is assigned to O3 instead of O2. The exhaustive search proves one change suffices; the independent checker validates it.” |
| 1:45–2:10 | Open verification evidence, export receipt and replay it. | “Proof claims show their bounded scope. A receipt supports verification and replay, but does not claim which real-world match is true.” |
| 2:10–2:38 | Switch to Event 60/90, prepared review → Challenge. Show **32:28 → 30:30** and minimum two. | “A different engine tests an event result. Two permitted identity changes remove the original lead. We qualify the solver's proof basis rather than pretending every proof is exhaustive.” |
| 2:38–2:50 | Show explicit offline AI status and closing scene. | “The release demonstrates deterministic analysis and human control. Meta Muse Code supported development; live Model API suggestions are not active in this recorded build.” |

## Before recording

1. Start the verified backend and frontend using [Windows setup](SETUP_AND_LAUNCH_WINDOWS.md).
2. Rehearse the exact human-review actions before recording; the Case B frozen policy requires explicit candidate permissions, baselines and attestations.
3. Keep the application in its truthful offline mode and do not invent a successful Meta API response.
4. Record **actual product interactions** rather than still-image slides. Cuts are permissible to keep the video under three minutes, but avoid deceptive cuts that imply a step happened when it did not.
5. Prefer a 1440px or 1728px desktop viewport and zoom/pan carefully so reviewers can read the central relationship and proof qualification.
6. If a live action fails, repeat it transparently; do not label screenshots or mocks as proof of the successful call.

## Final upload and accessibility

- Export an MP4 under three minutes; check the final duration.
- Publish on YouTube as **Unlisted** or Public, ensuring judges can view it without logging in or requesting access.
- Title suggestion: **JoinWitness — Can Your Decision Survive Uncertainty? | Meta AI Hackathon 2026**.
- Provide captions or clear spoken narration for the key outcome/witness claims.
- Paste the actual YouTube URL into the mandatory submission field. No video URL exists until the owner uploads it.

## Honest limitations to state if asked

The demonstration is local, uses synthetic records, and is not production-hosted. A model may eventually suggest candidate links, but it cannot make review decisions; during verified release tests the app showed \`AI_UNAVAILABLE\`. In particular, coding with Muse Code is genuine development-tool use, **not** evidence of live inference inside JoinWitness.