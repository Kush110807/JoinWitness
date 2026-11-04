/** Prototype-faithful Decision Atlas view-model: display derivation only.
 *
 * These adapters translate accepted backend verdicts, validated source rows,
 * and the human-owned draft into `AtlasExperienceProps` for the supplied
 * `DecisionAtlasExperience` scene. They own no permission, no mathematics,
 * and no matching computation: every record, count, changed assignment,
 * proof claim, and replay status shown originates from a real API response
 * (or the explicit human draft) passed in by the caller.
 *
 * Fail-closed rules, enforced here and covered by `atlasExperience.test.ts`:
 * - `alternative` is null until a reversible, accepted challenge result exists.
 * - `critical` marks only relationships changed by a server-reported witness.
 * - `replayStatus` is null until a live replay response arrives.
 * - A contradictory commerce result renders an unverified contract error and
 *   no verdict numbers (the caller shows the problem list, not the outcome).
 * - No counts, IDs, or proof strings are invented: distinctive test values
 *   pass straight through, and nothing defaults to a "nice" demo number.
 */
import type {
  AtlasChoice,
  AtlasExperienceProps,
  AtlasOutcome,
  AtlasRecord,
  AtlasStage,
} from "../components/DecisionAtlasExperience";
import type { QueueRecord } from "../components/RecordQueue";
import type {
  AnalyzeResponse,
  ReviewValidateResponse,
  VerifyResponse,
  WitnessChange,
} from "./api";
import {
  changedLinkText,
  formatCanvasCounts,
  isReversibleVerdict,
  isValidMinimum,
  leadText,
  verdictHeadline,
} from "./decisionView";
import type {
  CommerceChallengeResponse,
  CommerceDisposition,
  CommerceReplayResponse,
  CommerceReviewValidateResponse,
  CommerceSuggestResponse,
} from "./commerceApi";
import type { CommerceCatalogTarget, CommerceDraftState } from "./commerceDraft";
import {
  commerceDecisionText,
  commerceStatusCopy,
  commerceWitnessChangeText,
  validateCommerceResult,
} from "./commerceView";

export type AppStage = 1 | 2 | 3 | 4;

const ATLAS_STAGES: AtlasStage[] = ["import", "review", "challenge", "verify"];

/** Map an app stage number to the scene rail stage. */
export function stageToAtlas(stage: AppStage): AtlasStage {
  return ATLAS_STAGES[stage - 1];
}

/** Map a scene rail stage back to the app stage number. */
export function atlasToStage(stage: AtlasStage): AppStage {
  return ((ATLAS_STAGES.indexOf(stage) + 1) as AppStage) || 1;
}

/** Rail availability mirrors the parent's guarded max stage. */
export function availableAtlasStages(maxStage: AppStage): AtlasStage[] {
  return ATLAS_STAGES.filter((_, i) => i + 1 <= maxStage);
}

/* ------------------------------------------------------------------ */
/* Case A (event) Challenge                                            */
/* ------------------------------------------------------------------ */

export interface EventExperienceInput {
  queueRecords: QueueRecord[];
  witnessChanged: WitnessChange[];
  validation: ReviewValidateResponse | null;
  analysis: AnalyzeResponse | null;
  verify: VerifyResponse | null;
  /** True only when the backend replay response verified the receipt. */
  replayOk: boolean;
  /** True when replay/analysis/receipt evidence disagrees; suppresses proof. */
  evidenceMismatch: boolean;
  sourceKind: "demo" | "demo60" | "custom";
  sourceCounts: { attendance: number; registrations: number };
  stage: AppStage;
  maxStage: AppStage;
}

function eventRecordChoices(
  rec: QueueRecord,
  changed: WitnessChange | undefined,
): AtlasChoice[] {
  const choices: AtlasChoice[] = [];
  const seen = new Set<string>();
  const push = (c: AtlasChoice) => {
    if (seen.has(c.targetId)) return;
    seen.add(c.targetId);
    choices.push(c);
  };
  if (rec.baselineReg) {
    push({
      targetId: rec.baselineReg,
      label: "Original assignment",
      description: "Reported link in the reviewed baseline",
      status: "original",
    });
  }
  for (const c of rec.candidates) {
    if (c.rid === rec.baselineReg) continue;
    push({
      targetId: c.rid,
      label: c.status === "CONFIRMED" ? "Confirmed link" : "Possible link",
      description:
        c.rid === rec.alternativeReg
          ? "Checked alternative from the completed challenge"
          : `${c.name} · Group ${c.group}`,
      status: c.status === "CONFIRMED" ? "confirmed" : "possible",
    });
  }
  if (changed && changed.to && !seen.has(changed.to)) {
    push({
      targetId: changed.to,
      label: "Checked alternative",
      description: "Server-reported witness reassignment",
      status: "possible",
    });
  }
  if (choices.length === 0) {
    push({
      targetId: "unmatched",
      label: "Settled link",
      description: "No alternative candidate is permitted for this record",
      status: "unmatched",
    });
  }
  return choices;
}

function eventOutcome(
  counts: { a: number; b: number },
  eyebrow: string,
  claimPrefix: string,
): AtlasOutcome {
  const lead = leadText(counts);
  const margin = Math.abs(counts.a - counts.b);
  return {
    eyebrow,
    headline: lead,
    prominentMetric: `${counts.a} : ${counts.b}`,
    explanation:
      margin === 0
        ? "The original lead disappears. It is a tie."
        : counts.a > counts.b
          ? `Group A is ahead by ${margin}.`
          : `Group B is ahead by ${margin}.`,
    claim: `${claimPrefix} · ${lead}`,
  };
}

function eventProofCopy(input: EventExperienceInput): {
  headline: string;
  description: string;
} {
  const { analysis } = input;
  if (!analysis) {
    return {
      headline: "No verified result yet.",
      description:
        "Run the Challenge to test whether any permitted alternative reverses the answer. Nothing here is proved until the backend answers.",
    };
  }
  const headline = verdictHeadline(analysis.verdict, analysis.minimum_changed_assignments);
  const links = changedLinkText(input.witnessChanged);
  if (analysis.verdict === "REVERSIBLE_MINIMUM_PROVEN") {
    const minimum = isValidMinimum(analysis.minimum_changed_assignments)
      ? `Fewest changed assignments: ${analysis.minimum_changed_assignments} — proven minimum. `
      : "The server did not report a valid minimum — no number of changed assignments is claimed. ";
    const basis =
      analysis.proof_basis === "SOLVER_AND_SMALL_ORACLE"
        ? "The completed solver proved the minimum and the small-case oracle independently cross-checked it."
        : "The optimum is solver-proven, with no separate small-oracle cross-check.";
    return {
      headline,
      description: `${minimum}${basis}${links ? ` Changed: ${links}.` : ""}`,
    };
  }
  if (analysis.verdict === "REVERSIBLE_WITNESS_ONLY") {
    return {
      headline,
      description: `A checked witness flips the answer, but minimality is not proven.${links ? ` Changed: ${links}.` : ""}`,
    };
  }
  if (analysis.verdict === "STABLE_WITHIN_REVIEWED_POLICY") {
    return {
      headline,
      description:
        "No permitted reassignment flips the answer within this reviewed policy only — not a claim about real-world identity.",
    };
  }
  return {
    headline,
    description: "Inconclusive: the backend returned no verified reversal for this policy.",
  };
}

/**
 * Build the Case A Challenge scene props. The caller attaches `onStage`,
 * `onSelectRecord`, and `primaryAction`; everything else is derived here
 * from accepted responses only.
 */
export function buildEventChallengeExperience(
  input: EventExperienceInput,
): Omit<AtlasExperienceProps, "onStage" | "onSelectRecord" | "inspectorActions" | "primaryAction"> {
  const { analysis, validation } = input;
  const changedById = new Map(input.witnessChanged.map((c) => [c.attendance_id, c]));
  const reversible = isReversibleVerdict(analysis?.verdict);
  const baseline = analysis?.baseline_counts ?? validation?.baseline_counts ?? null;
  const altCounts = reversible ? (analysis?.alternative_counts ?? null) : null;

  const records: AtlasRecord[] = input.queueRecords.map((rec) => {
    const changed = changedById.get(rec.attendanceId);
    return {
      id: rec.attendanceId,
      label: rec.attendanceId,
      kind: changed ? "critical" : rec.resolved ? "settled" : "uncertain",
      sourceLayer: "attendance",
      description: changed
        ? `One attendance record. Changed by the checked alternative: ${changed.from ?? "unmatched"} → ${changed.to ?? "unmatched"}.`
        : rec.resolved
          ? "A settled record. No alternative candidate is permitted."
          : `One attendance record. ${rec.candidates.length} permitted ${rec.candidates.length === 1 ? "identity" : "identities"}.`,
      choices: eventRecordChoices(rec, reversible ? changed : undefined),
    };
  });

  const original: AtlasOutcome = baseline
    ? eventOutcome(baseline, "ORIGINAL OUTCOME", "Current claim")
    : {
        eyebrow: "ORIGINAL OUTCOME",
        headline: "Baseline unavailable",
        prominentMetric: "—",
        explanation: "No verified baseline is available for this investigation.",
        claim: "Current claim · unknown",
      };
  const alternative: AtlasOutcome | null =
    altCounts !== null
      ? eventOutcome(altCounts, "CHECKED ALTERNATIVE", "Checked alternative")
      : null;

  const proof = eventProofCopy(input);
  const evidenceRows: AtlasExperienceProps["evidenceRows"] = [];
  if (analysis) {
    evidenceRows.push({ label: "Verdict", value: analysis.verdict });
    evidenceRows.push({
      label: "Fewest changed assignments",
      value: isValidMinimum(analysis.minimum_changed_assignments)
        ? `${analysis.minimum_changed_assignments} — solver-proven`
        : "not claimed",
    });
    evidenceRows.push({ label: "Solver status", value: analysis.solver_status });
    evidenceRows.push({ label: "Independent checker", value: analysis.checker_status });
    evidenceRows.push({ label: "Small-case oracle", value: analysis.oracle_status });
    evidenceRows.push({ label: "Proof basis", value: analysis.proof_basis });
    evidenceRows.push({ label: "Coverage", value: analysis.coverage });
    if (input.witnessChanged.length > 0) {
      evidenceRows.push({
        label: "Changed assignments",
        value: changedLinkText(input.witnessChanged),
      });
    }
    if (baseline) {
      evidenceRows.push({
        label: "Counts",
        value: formatCanvasCounts(baseline, altCounts, analysis.verdict),
      });
    }
    evidenceRows.push({
      label: "Review",
      value: `${analysis.review_sha256.slice(0, 12)}…`,
    });
  }
  evidenceRows.push({
    label: "Receipt replay",
    value:
      input.evidenceMismatch || !input.replayOk
        ? "not verified in this investigation"
        : "VERIFIED_REPLAY",
  });

  const ambiguous = input.queueRecords.filter((r) => !r.resolved).length;
  return {
    scenario: "event",
    workspaceLabel: input.sourceKind === "demo60" ? "01 — 60/90 event" : "01 — Attendance",
    question: "Can one uncertain match change who came out ahead?",
    subtitle:
      "One event. Two imperfect lists. A result that changes when permitted identity links change.",
    sourceLabel:
      input.sourceKind === "demo60"
        ? "60 / 90 case"
        : input.sourceKind === "custom"
          ? "Uploaded CSVs"
          : "Fictional example",
    sourceSummary: `${input.sourceCounts.attendance} attendance records · ${input.sourceCounts.registrations} registrations · ${ambiguous} ambiguous · all results conditional on the reviewed permissions.`,
    records,
    original,
    alternative,
    isLiveResult: analysis !== null,
    replayStatus: input.verify?.status ?? null,
    proofHeadline: input.evidenceMismatch ? "Evidence mismatch." : proof.headline,
    proofDescription: input.evidenceMismatch
      ? "The replayed verdict or receipt digest does not match the issued receipt and the checked analysis. All proof claims are withheld until the evidence agrees."
      : proof.description,
    evidenceRows,
    evidenceQualification:
      analysis?.scope_caveat ??
      "The claim holds within the explicitly reviewed candidates, baseline and policy — not as a statement about real-world identity.",
    stage: stageToAtlas(input.stage),
    availableStages: availableAtlasStages(input.maxStage),
    statusLabel: "Fictional investigation",
  };
}

/* ------------------------------------------------------------------ */
/* Case B (commerce) Review / Challenge                                */
/* ------------------------------------------------------------------ */

export interface CommerceExperienceInput {
  reviewRecords: Array<{
    recordKey: string;
    recordType: "payment" | "delivery" | "refund";
    recordLabel: string;
    sourceHint: string | null;
    sourceRowNumber: number;
  }>;
  targetsFor: (recordKey: string) => CommerceCatalogTarget[];
  draft: CommerceDraftState | null;
  blockedRows: string[];
  validation: CommerceReviewValidateResponse | null;
  challenge: CommerceChallengeResponse | null;
  replay: CommerceReplayResponse | null;
  suggest: CommerceSuggestResponse | null;
  orderCount: number;
  isExample: boolean;
  stage: AppStage;
  maxStage: AppStage;
}

function commerceLayer(recordType: "payment" | "delivery" | "refund"): AtlasRecord["sourceLayer"] {
  return recordType === "payment" ? "payments" : recordType === "delivery" ? "deliveries" : "refunds";
}

function dispositionToChoiceStatus(d: CommerceDisposition): AtlasChoice["status"] {
  return d === "CONFIRMED" ? "confirmed" : d === "POSSIBLE" ? "possible" : "prohibited";
}

function commerceRecordChoices(
  recordKey: string,
  targets: CommerceCatalogTarget[],
  draft: CommerceDraftState | null,
  witnessTo: string | null,
): AtlasChoice[] {
  const row = draft?.edges[recordKey] ?? {};
  const baseline = draft?.baseline[recordKey];
  const choices: AtlasChoice[] = [];
  for (const t of targets) {
    const d: CommerceDisposition = row[t.targetId] ?? "PROHIBITED";
    const isBaseline = baseline !== undefined && baseline === t.targetId;
    const origin =
      t.origins.includes("SOURCE_REF") && t.origins.includes("MANUAL")
        ? "Source hint + manual"
        : t.origins.includes("SOURCE_REF")
          ? "Source hint"
          : t.origins.includes("META_SUGGESTED")
            ? "Meta suggestion (untrusted)"
            : "Manual proposal";
    choices.push({
      targetId: t.targetId,
      label: isBaseline ? "Original assignment" : t.targetId,
      description:
        t.targetId === witnessTo
          ? "Checked alternative from the completed challenge"
          : isBaseline
            ? `Baseline link · ${origin}`
            : origin,
      status: isBaseline ? "original" : dispositionToChoiceStatus(d),
    });
  }
  if (choices.length === 0) {
    choices.push({
      targetId: "unmatched",
      label: "No registered candidates",
      description: "The unmatched rule decides this record",
      status: "unmatched",
    });
  }
  return choices;
}

/** Server-backed witness change per record key; empty unless REVERSED + valid. */
function commerceWitnessByKey(
  challenge: CommerceChallengeResponse | null,
): Map<string, { from: string | null; to: string | null }> {
  const m = new Map<string, { from: string | null; to: string | null }>();
  if (!challenge || challenge.result.status !== "REVERSED_EXHAUSTIVE") return m;
  if (validateCommerceResult(challenge.result).length > 0) return m;
  for (const c of challenge.result.witness?.reference_changes ?? []) {
    m.set(c.record_key, { from: c.from_target_id, to: c.to_target_id });
  }
  return m;
}

function commerceOutcome(
  cleanCount: number,
  orderCount: number,
  thresholdK: number,
  decision: boolean,
  eyebrow: string,
  claimPrefix: string,
): AtlasOutcome {
  return {
    eyebrow,
    headline: decision ? `Meets K=${thresholdK}` : `Below K=${thresholdK}`,
    prominentMetric: `${cleanCount} / ${orderCount}`,
    explanation: commerceDecisionText(cleanCount, orderCount, thresholdK, decision),
    claim: `${claimPrefix} · ${decision ? `Meets K=${thresholdK}` : `Below K=${thresholdK}`}`,
  };
}

/**
 * Build the Case B scene props for Review or Challenge. The caller attaches
 * `onStage`, `onSelectRecord`, `inspectorActions` (the real review controls),
 * and `primaryAction`; everything else derives from validated rows, the
 * human draft, and accepted responses only.
 */
export function buildCommerceExperience(
  input: CommerceExperienceInput,
): Omit<AtlasExperienceProps, "onStage" | "onSelectRecord" | "inspectorActions" | "primaryAction"> {
  const { challenge, validation, draft } = input;
  const problems = challenge ? validateCommerceResult(challenge.result) : [];
  const resultValid = challenge !== null && problems.length === 0;
  const witnessByKey = commerceWitnessByKey(challenge);
  const blocked = new Set(input.blockedRows);
  const frozenK = validation?.threshold_k ?? null;

  const records: AtlasRecord[] = input.reviewRecords.map((rec) => {
    const witness = witnessByKey.get(rec.recordKey);
    const targets = input.targetsFor(rec.recordKey);
    const hint = rec.sourceHint === null ? "No source hint (missing reference)." : `Source hint: ${rec.sourceHint} (hint only).`;
    return {
      id: rec.recordKey,
      label: rec.recordKey,
      kind: witness ? "critical" : blocked.has(rec.recordKey) ? "uncertain" : "settled",
      sourceLayer: commerceLayer(rec.recordType),
      description: `${rec.recordLabel}. ${hint}${witness ? ` Changed by the checked alternative: ${witness.from ?? "unmatched"} → ${witness.to ?? "unmatched"}.` : ""}`,
      choices: commerceRecordChoices(rec.recordKey, targets, draft, witness?.to ?? null),
    };
  });

  const baseline = resultValid ? challenge!.result.baseline : null;
  const witness = resultValid ? challenge!.result.witness : null;
  const thresholdK = resultValid ? challenge!.result.threshold_k : null;

  let original: AtlasOutcome;
  if (baseline && thresholdK !== null) {
    original = commerceOutcome(
      baseline.clean_fulfilled_count,
      input.orderCount,
      thresholdK,
      baseline.decision,
      "ORIGINAL OUTCOME",
      "Current claim",
    );
  } else if (frozenK !== null) {
    original = {
      eyebrow: "ORIGINAL OUTCOME",
      headline: `Frozen review · K=${frozenK}`,
      prominentMetric: `K = ${frozenK}`,
      explanation: `Threshold K=${frozenK} of ${input.orderCount} orders. Run the Challenge to count clean fulfilment.`,
      claim: `Current claim · K=${frozenK}, awaiting challenge`,
    };
  } else {
    original = {
      eyebrow: "ORIGINAL OUTCOME",
      headline: "Threshold is a draft",
      prominentMetric: draft?.thresholdK ? `K = ${draft.thresholdK}` : "K — draft",
      explanation: "K stays a draft until you adopt it. Counts appear after the backend answers.",
      claim: "Current claim · no frozen review yet",
    };
  }

  let alternative: AtlasOutcome | null = null;
  if (
    resultValid &&
    challenge!.result.status === "REVERSED_EXHAUSTIVE" &&
    witness &&
    thresholdK !== null
  ) {
    alternative = commerceOutcome(
      witness.clean_fulfilled_count,
      input.orderCount,
      thresholdK,
      witness.decision,
      "CHECKED ALTERNATIVE",
      "Checked alternative",
    );
  }

  let proofHeadline: string;
  let proofDescription: string;
  if (challenge && !resultValid) {
    proofHeadline = "Unverified contract error.";
    proofDescription =
      "The backend response contradicts the frozen result shape, so no verdict is shown. No reversal, stability, or minimum is established.";
  } else if (resultValid) {
    const copy = commerceStatusCopy(challenge!.result.status);
    proofHeadline = copy.headline;
    proofDescription = copy.detail;
    if (challenge!.result.status === "REVERSED_EXHAUSTIVE" && witness) {
      proofDescription += ` Changed: ${commerceWitnessChangeText(witness.reference_changes)}. Minimum within scope: ${challenge!.result.minimum_link_distance_within_scope}.`;
    }
  } else if (validation) {
    proofHeadline = "Review frozen. Challenge not run.";
    proofDescription = `K=${validation.threshold_k} is frozen under policy rev ${validation.policy_revision}. Run the Challenge to test whether any permitted alternative crosses K.`;
  } else {
    proofHeadline = "No frozen review yet.";
    proofDescription =
      "Review every source record, set K, attest, and adopt. Nothing here is proved until the backend answers.";
  }

  const evidenceRows: AtlasExperienceProps["evidenceRows"] = [];
  if (challenge && resultValid) {
    const r = challenge.result;
    evidenceRows.push({ label: "Status", value: r.status });
    if (r.reason) evidenceRows.push({ label: "Reason", value: r.reason });
    evidenceRows.push({ label: "Threshold K", value: String(r.threshold_k) });
    if (r.baseline) {
      evidenceRows.push({
        label: "Baseline",
        value: commerceDecisionText(
          r.baseline.clean_fulfilled_count,
          input.orderCount,
          r.threshold_k,
          r.baseline.decision,
        ),
      });
    }
    if (r.witness) {
      evidenceRows.push({
        label: "Witness changes",
        value: commerceWitnessChangeText(r.witness.reference_changes),
      });
      evidenceRows.push({
        label: "Witness",
        value: commerceDecisionText(
          r.witness.clean_fulfilled_count,
          input.orderCount,
          r.threshold_k,
          r.witness.decision,
        ),
      });
      evidenceRows.push({
        label: "Minimum within scope",
        value: String(r.minimum_link_distance_within_scope),
      });
    }
    evidenceRows.push({ label: "Independent checker", value: r.checker_status });
    evidenceRows.push({ label: "Proof basis", value: r.proof_basis });
    const cov = r.coverage;
    evidenceRows.push({
      label: "Coverage",
      value: `${cov.admissible_worlds_checked} admissible / ${cov.raw_worlds_checked} raw checked · checker ${cov.checker_worlds_checked} · fully enumerated ${cov.fully_enumerated ? "yes" : "no"} · checker complete ${cov.checker_complete ? "yes" : "no"}`,
    });
    evidenceRows.push({ label: "Review", value: `${challenge.review_sha256.slice(0, 12)}…` });
  } else if (challenge) {
    evidenceRows.push({ label: "Status", value: "NOT_VERIFIED (contract error)" });
    for (const p of problems.slice(0, 6)) {
      evidenceRows.push({ label: "Contradiction", value: p });
    }
  }
  if (input.suggest) {
    evidenceRows.push({
      label: "Meta suggestions",
      value:
        input.suggest.ai_status === "AI_UNAVAILABLE"
          ? "AI_UNAVAILABLE — no permissions changed"
          : `${input.suggest.suggestions.length} unreviewed proposals — no permission granted`,
    });
  }
  if (validation && !challenge) {
    evidenceRows.push({
      label: "Frozen review",
      value: `K=${validation.threshold_k} · policy rev ${validation.policy_revision} · ${validation.review_sha256.slice(0, 12)}…`,
    });
    evidenceRows.push({
      label: "Review preflight",
      value: `${validation.raw_worlds} raw worlds · ${validation.admissible_worlds} admissible · ${validation.invalid_worlds} invalid · baseline ${validation.baseline_valid ? "valid" : "INVALID"}`,
    });
  }
  evidenceRows.push({
    label: "Receipt replay",
    value:
      input.replay?.verification_status === "VERIFIED_REPLAY"
        ? "VERIFIED_REPLAY"
        : "not verified in this investigation",
  });

  const counts = { payments: 0, deliveries: 0, refunds: 0 };
  for (const rec of input.reviewRecords) {
    if (rec.recordType === "payment") counts.payments += 1;
    else if (rec.recordType === "delivery") counts.deliveries += 1;
    else counts.refunds += 1;
  }
  return {
    scenario: "commerce",
    workspaceLabel: "02 — Commerce",
    question: "Are at least K of N orders cleanly fulfilled?",
    subtitle:
      "Four related files — orders, payments, deliveries, refunds — hold uncertain links. You set a threshold K, review every permitted link by hand, then test whether any permitted alternative crosses K.",
    sourceLabel: input.isExample ? "Fictional commerce example" : "Commerce CSVs",
    sourceSummary: `${input.orderCount} orders · ${counts.payments} payments · ${counts.deliveries} deliveries · ${counts.refunds} refunds · ${input.blockedRows.length} need a decision · source references are hints, never permissions.`,
    records,
    original,
    alternative,
    isLiveResult: resultValid,
    replayStatus: input.replay?.verification_status ?? null,
    proofHeadline,
    proofDescription,
    evidenceRows,
    evidenceQualification:
      "The claim holds within the reviewer-authorised finite worlds only — not as a statement about real-world linkage. Minimum distance is proven within this reviewed finite scope only.",
    stage: stageToAtlas(input.stage),
    availableStages: availableAtlasStages(input.maxStage),
    statusLabel: "Fictional investigation",
  };
}

