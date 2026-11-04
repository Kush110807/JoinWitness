/** Fail-closed binding rules for the prototype-faithful Atlas scene.
 *
 * Every assertion pins one integration-map rule: no invented alternative,
 * no inferred criticality, no early replay claim, no hardcoded demo numbers,
 * and no verdict on a contradictory result. Distinctive values (5:7, K=9,
 * T-77) prove pass-through instead of defaults.
 */
import { describe, expect, it } from "vitest";
import type { QueueRecord } from "../components/RecordQueue";
import type { AnalyzeResponse, VerifyResponse, WitnessChange } from "./api";
import {
  COMMERCE_PREDICATE,
  type CommerceChallengeResponse,
  type CommerceChallengeResult,
  type CommerceCoverage,
  type CommerceReplayResponse,
} from "./commerceApi";
import type { CommerceCatalogTarget, CommerceDraftState } from "./commerceDraft";
import {
  atlasToStage,
  availableAtlasStages,
  buildCommerceExperience,
  buildEventChallengeExperience,
  stageToAtlas,
  type CommerceExperienceInput,
  type EventExperienceInput,
} from "./atlasExperience";

function queueRecord(partial: Partial<QueueRecord> & { attendanceId: string }): QueueRecord {
  return {
    recordedName: partial.attendanceId,
    candidates: [],
    resolved: true,
    baselineReg: null,
    alternativeReg: null,
    ...partial,
  };
}

function analysis(partial: Partial<AnalyzeResponse>): AnalyzeResponse {
  return {
    status: "ANALYSIS_VERIFIED",
    coverage: "REVIEWED_CLOSED_SCOPE",
    baseline_counts: { a: 5, b: 7, unmatched: 0, a_greater_than_b: false },
    alternative_counts: null,
    witness_assignments: null,
    minimum_changed_assignments: null,
    solver_status: "OPTIMAL",
    checker_status: "WITNESS_VALID",
    oracle_status: "NOT_RUN",
    verdict: "NOT_VERIFIED",
    proof_basis: "NONE",
    review_sha256: "aa".repeat(32),
    reference_sha256: "bb".repeat(32),
    receipt_sha256: "cc".repeat(32),
    scope_caveat: "test caveat",
    ...partial,
  };
}

function eventInput(partial: Partial<EventExperienceInput>): EventExperienceInput {
  return {
    queueRecords: [],
    witnessChanged: [],
    validation: null,
    analysis: null,
    verify: null,
    replayOk: false,
    evidenceMismatch: false,
    sourceKind: "demo",
    sourceCounts: { attendance: 3, registrations: 4 },
    stage: 3,
    maxStage: 3,
    ...partial,
  };
}

const VALID_COVERAGE: CommerceCoverage = {
  raw_worlds_total: 4,
  raw_worlds_checked: 4,
  invalid_worlds_total: 1,
  invalid_worlds_checked: 1,
  admissible_worlds_total: 3,
  admissible_worlds_checked: 3,
  checker_worlds_total: 3,
  checker_worlds_checked: 3,
  fully_enumerated: true,
  checker_complete: true,
};

function commerceResult(partial: Partial<CommerceChallengeResult>): CommerceChallengeResult {
  return {
    status: "REVERSED_EXHAUSTIVE",
    reason: null,
    predicate: COMMERCE_PREDICATE,
    threshold_k: 9,
    baseline: { clean_fulfilled_count: 9, decision: true },
    witness: {
      reference_changes: [
        { record_key: "delivery:D9", from_target_id: "O9", to_target_id: "O1" },
      ],
      clean_fulfilled_count: 8,
      decision: false,
      link_distance: 1,
    },
    coverage: { ...VALID_COVERAGE },
    checker_status: "PASSED",
    proof_basis: "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION",
    minimum_distance_proven_within_scope: true,
    minimum_link_distance_within_scope: 1,
    ...partial,
  };
}

function commerceChallenge(result: CommerceChallengeResult): CommerceChallengeResponse {
  return {
    contract_version: "commerce.v1",
    session_id: "session-1",
    state: "CHALLENGED",
    run_id: "run-1",
    source_revision: 1,
    candidate_revision: 1,
    policy_revision: 1,
    review_sha256: "dd".repeat(32),
    result,
  };
}

function commerceDraft(): CommerceDraftState {
  return {
    edges: {},
    unmatched: {},
    manual: [],
    thresholdK: null,
    reviewerLabel: "",
    attestation: {
      all_rows_reviewed: false,
      understands_bounded_predicate: false,
      conflicting_source_ref_overrides_explained: false,
    },
    baseline: {},
  };
}

function commerceInput(partial: Partial<CommerceExperienceInput>): CommerceExperienceInput {
  return {
    reviewRecords: [],
    targetsFor: () => [],
    draft: commerceDraft(),
    blockedRows: [],
    validation: null,
    challenge: null,
    replay: null,
    suggest: null,
    orderCount: 10,
    isExample: true,
    stage: 2,
    maxStage: 2,
    ...partial,
  };
}

describe("stage mapping", () => {
  it("maps app stages to rail stages and back", () => {
    expect(stageToAtlas(1)).toBe("import");
    expect(stageToAtlas(3)).toBe("challenge");
    expect(atlasToStage("verify")).toBe(4);
    expect(atlasToStage("review")).toBe(2);
  });

  it("mirrors the guarded max stage on the rail", () => {
    expect(availableAtlasStages(1)).toEqual(["import"]);
    expect(availableAtlasStages(3)).toEqual(["import", "review", "challenge"]);
  });
});

describe("event challenge experience", () => {
  it("keeps the alternative null and claims nothing before analysis", () => {
    const props = buildEventChallengeExperience(
      eventInput({
        queueRecords: [queueRecord({ attendanceId: "T-77", resolved: false })],
        validation: {
          status: "REVIEW_ACCEPTED",
          coverage: "REVIEWED_CLOSED_SCOPE",
          review_sha256: "ee".repeat(32),
          review_revision: 1,
          baseline_counts: { a: 5, b: 7, unmatched: 0, a_greater_than_b: false },
        },
      }),
    );
    expect(props.alternative).toBeNull();
    expect(props.isLiveResult).toBe(false);
    expect(props.replayStatus).toBeNull();
    expect(props.original.prominentMetric).toBe("5 : 7");
    expect(props.proofHeadline).toBe("No verified result yet.");
    expect(props.records).toHaveLength(1);
    expect(props.records[0].kind).toBe("uncertain");
  });

  it("marks critical only the server-reported changed rows", () => {
    const changed: WitnessChange[] = [{ attendance_id: "T-77", from: "R-A1", to: "R-B1" }];
    const props = buildEventChallengeExperience(
      eventInput({
        queueRecords: [
          queueRecord({ attendanceId: "T-77", resolved: false }),
          queueRecord({ attendanceId: "T-78", resolved: false }),
          queueRecord({ attendanceId: "T-01", resolved: true }),
        ],
        witnessChanged: changed,
        analysis: analysis({
          verdict: "REVERSIBLE_MINIMUM_PROVEN",
          alternative_counts: { a: 4, b: 8, unmatched: 0, a_greater_than_b: false },
          minimum_changed_assignments: 1,
          proof_basis: "SOLVER_AND_SMALL_ORACLE",
        }),
      }),
    );
    expect(props.records.find((r) => r.id === "T-77")?.kind).toBe("critical");
    expect(props.records.find((r) => r.id === "T-78")?.kind).toBe("uncertain");
    expect(props.records.find((r) => r.id === "T-01")?.kind).toBe("settled");
    expect(props.alternative?.prominentMetric).toBe("4 : 8");
    expect(props.proofHeadline).toMatch(/one permitted identity change/i);
  });

  it("preserves the solver-attributed caveat without an oracle claim", () => {
    const props = buildEventChallengeExperience(
      eventInput({
        analysis: analysis({
          verdict: "REVERSIBLE_MINIMUM_PROVEN",
          alternative_counts: { a: 4, b: 8, unmatched: 0, a_greater_than_b: false },
          minimum_changed_assignments: 2,
          proof_basis: "SOLVER_ATTRIBUTED_ONLY",
        }),
        witnessChanged: [{ attendance_id: "T-77", from: "R-A1", to: "R-B1" }],
      }),
    );
    expect(props.proofDescription).toMatch(/no separate small-oracle cross-check/i);
    expect(props.evidenceRows.find((r) => r.label === "Proof basis")?.value).toBe(
      "SOLVER_ATTRIBUTED_ONLY",
    );
  });

  it("withholds proof language on an evidence mismatch", () => {
    const verify: VerifyResponse = {
      status: "VERIFIED_REPLAY",
      verdict: "REVERSIBLE_MINIMUM_PROVEN",
      proof_basis: "SOLVER_AND_SMALL_ORACLE",
      receipt_sha256: "ff".repeat(32),
      scope_caveat: "test",
    };
    const props = buildEventChallengeExperience(
      eventInput({
        analysis: analysis({
          verdict: "REVERSIBLE_MINIMUM_PROVEN",
          alternative_counts: { a: 4, b: 8, unmatched: 0, a_greater_than_b: false },
          minimum_changed_assignments: 1,
        }),
        verify,
        replayOk: true,
        evidenceMismatch: true,
      }),
    );
    expect(props.proofHeadline).toBe("Evidence mismatch.");
    expect(props.evidenceRows.find((r) => r.label === "Receipt replay")?.value).toBe(
      "not verified in this investigation",
    );
  });
});

describe("commerce experience", () => {
  const reviewRecords = [
    {
      recordKey: "delivery:D9",
      recordType: "delivery" as const,
      recordLabel: "DELIVERED",
      sourceHint: "O9",
      sourceRowNumber: 2,
    },
    {
      recordKey: "payment:P1",
      recordType: "payment" as const,
      recordLabel: "10.00 USD · SETTLED",
      sourceHint: null,
      sourceRowNumber: 1,
    },
  ];
  const targets: CommerceCatalogTarget[] = [
    {
      recordKey: "delivery:D9",
      recordType: "delivery",
      recordId: "D9",
      targetId: "O9",
      targetType: "order",
      origins: ["SOURCE_REF"],
      metaEvidence: [],
      manualReason: null,
    },
  ];

  it("shows draft state with no alternative before adoption", () => {
    const props = buildCommerceExperience(
      commerceInput({
        reviewRecords,
        targetsFor: (key) => targets.filter((t) => t.recordKey === key),
        blockedRows: ["delivery:D9", "payment:P1"],
      }),
    );
    expect(props.alternative).toBeNull();
    expect(props.isLiveResult).toBe(false);
    expect(props.original.prominentMetric).toBe("K — draft");
    expect(props.records.find((r) => r.id === "delivery:D9")?.kind).toBe("uncertain");
    expect(props.records.find((r) => r.id === "delivery:D9")?.sourceLayer).toBe("deliveries");
    expect(
      props.records.find((r) => r.id === "delivery:D9")?.choices[0]?.status,
    ).toBe("prohibited");
    expect(props.proofHeadline).toBe("No frozen review yet.");
  });

  it("passes distinctive server counts and witness IDs through", () => {
    const props = buildCommerceExperience(
      commerceInput({
        reviewRecords,
        targetsFor: (key) => targets.filter((t) => t.recordKey === key),
        challenge: commerceChallenge(commerceResult({})),
        stage: 3,
        maxStage: 3,
      }),
    );
    expect(props.original.prominentMetric).toBe("9 / 10");
    expect(props.alternative?.prominentMetric).toBe("8 / 10");
    expect(props.records.find((r) => r.id === "delivery:D9")?.kind).toBe("critical");
    expect(props.proofDescription).toMatch(/delivery:D9: O9 → O1/);
    expect(
      props.evidenceRows.find((r) => r.label === "Witness changes")?.value,
    ).toBe("delivery:D9: O9 → O1");
  });

  it("renders fail-closed on a contradictory challenge result", () => {
    const bad = commerceResult({ checker_status: "PASSED" });
    bad.witness = { ...bad.witness!, link_distance: 2 }; // minimum (1) no longer matches
    const props = buildCommerceExperience(
      commerceInput({
        reviewRecords,
        targetsFor: () => [],
        challenge: commerceChallenge(bad),
        stage: 3,
        maxStage: 3,
      }),
    );
    expect(props.isLiveResult).toBe(false);
    expect(props.alternative).toBeNull();
    expect(props.proofHeadline).toBe("Unverified contract error.");
    expect(props.original.headline).toBe("Threshold is a draft");
    expect(props.records.find((r) => r.id === "delivery:D9")?.kind).not.toBe("critical");
    expect(props.evidenceRows.some((r) => r.label === "Contradiction")).toBe(true);
  });

  it("keeps replay null until a live replay response arrives", () => {
    const noReplay = buildCommerceExperience(
      commerceInput({ challenge: commerceChallenge(commerceResult({})) }),
    );
    expect(noReplay.replayStatus).toBeNull();
    const replay = buildCommerceExperience(
      commerceInput({
        challenge: commerceChallenge(commerceResult({})),
        replay: { verification_status: "VERIFIED_REPLAY" } as CommerceReplayResponse,
      }),
    );
    expect(replay.replayStatus).toBe("VERIFIED_REPLAY");
  });
});
