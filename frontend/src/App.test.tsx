import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const parseOk = {
  status: "PARSED_UNREVIEWED",
  registrations: [
    { registration_id: "R-A1", name: "Amara Shah", group: "A" },
    { registration_id: "R-A2", name: "Kim Rao", group: "A" },
    { registration_id: "R-B1", name: "Bryn Ellis", group: "B" },
    { registration_id: "R-B2", name: "Kym Rao", group: "B" },
  ],
  attendance: [
    { attendance_id: "T-01", recorded_name: "Amara Shah" },
    { attendance_id: "T-02", recorded_name: "Kim/Kym Rao" },
    { attendance_id: "T-03", recorded_name: "Bryn Ellis" },
  ],
  registrations_digest: {
    raw_sha256: "98c829b8d06caaf39e68ffe12f437c734291ccd2ce13da8e66deedb28747c2bf",
    row_count: 4,
  },
  attendance_digest: {
    raw_sha256: "c771e8ae9fd09b08f358ecf40678cf7ff53a448309fb927e1d2a3890be405ea3",
    row_count: 3,
  },
};

const validateOk = {
  status: "REVIEW_VALIDATED",
  coverage: "REVIEWED_CLOSED_SCOPE",
  review_sha256: "b".repeat(64),
  review_revision: 1,
  reference_sha256: "c".repeat(64),
  baseline_counts: { a: 2, b: 1, unmatched: 0, a_greater_than_b: true },
};

/** Contract-faithful flagship: wire tuples, receipt verdict, oracle status. */
const analyzeFlagship = {
  status: "ANALYSIS_VERIFIED",
  coverage: "REVIEWED_CLOSED_SCOPE",
  baseline_counts: { a: 2, b: 1, unmatched: 0, a_greater_than_b: true },
  alternative_counts: { a: 1, b: 2, unmatched: 0, a_greater_than_b: false },
  witness_assignments: [
    ["T-01", "R-A1"],
    ["T-02", "R-B2"],
    ["T-03", "R-B1"],
  ],
  minimum_changed_assignments: 1,
  solver_status: "OPTIMAL",
  checker_status: "WITNESS_VALID",
  oracle_status: "ORACLE_REVERSIBLE",
  verdict: "REVERSIBLE_MINIMUM_PROVEN",
  proof_basis: "SOLVER_AND_SMALL_ORACLE",
  review_sha256: "b".repeat(64),
  reference_sha256: "c".repeat(64),
  receipt_sha256: "d".repeat(64),
  scope_caveat:
    "No real-world identity is determined. All findings are conditional on the reviewed candidate universe.",
};

const analyzeStable = {
  status: "ANALYSIS_VERIFIED",
  coverage: "REVIEWED_CLOSED_SCOPE",
  baseline_counts: { a: 2, b: 1, unmatched: 0, a_greater_than_b: true },
  alternative_counts: null,
  witness_assignments: null,
  minimum_changed_assignments: null,
  solver_status: "INFEASIBLE",
  checker_status: "SCOPED_INFEASIBILITY_SOLVER_ATTRIBUTED",
  oracle_status: "ORACLE_STABLE",
  verdict: "STABLE_WITHIN_REVIEWED_POLICY",
  proof_basis: "SOLVER_AND_SMALL_ORACLE",
  review_sha256: "b".repeat(64),
  reference_sha256: "c".repeat(64),
  receipt_sha256: "d".repeat(64),
  scope_caveat:
    "No real-world identity is determined. All findings are conditional on the reviewed candidate universe.",
};

const analyzeWitnessOnly = {
  status: "ANALYSIS_VERIFIED",
  coverage: "REVIEWED_CLOSED_SCOPE",
  baseline_counts: { a: 2, b: 1, unmatched: 0, a_greater_than_b: true },
  alternative_counts: { a: 1, b: 2, unmatched: 0, a_greater_than_b: false },
  witness_assignments: [
    ["T-01", "R-A1"],
    ["T-02", "R-B2"],
    ["T-03", "R-B1"],
  ],
  minimum_changed_assignments: 1,
  solver_status: "FEASIBLE",
  checker_status: "WITNESS_VALID",
  oracle_status: "ORACLE_REVERSIBLE",
  verdict: "REVERSIBLE_WITNESS_ONLY",
  proof_basis: "CHECKED_WITNESS_ONLY",
  review_sha256: "b".repeat(64),
  reference_sha256: "c".repeat(64),
  receipt_sha256: "d".repeat(64),
  scope_caveat:
    "No real-world identity is determined. All findings are conditional on the reviewed candidate universe.",
};

const analyzeNotVerified = {
  status: "NOT_VERIFIED",
  coverage: "REVIEWED_CLOSED_SCOPE",
  baseline_counts: { a: 2, b: 1, unmatched: 0, a_greater_than_b: true },
  alternative_counts: null,
  witness_assignments: null,
  minimum_changed_assignments: null,
  solver_status: "UNKNOWN",
  checker_status: "NOT_VERIFIED",
  oracle_status: "NOT_VERIFIED",
  verdict: "NOT_VERIFIED",
  proof_basis: "INCOMPLETE",
  review_sha256: "b".repeat(64),
  reference_sha256: "c".repeat(64),
  receipt_sha256: "d".repeat(64),
  scope_caveat:
    "No real-world identity is determined. All findings are conditional on the reviewed candidate universe.",
};

const receiptOk = {
  status: "RECEIPT_ISSUED",
  receipt: { receipt_sha256: "d".repeat(64), verdict: "REVERSIBLE_MINIMUM_PROVEN" },
};

const verifyOk = {
  status: "VERIFIED_REPLAY",
  verdict: "REVERSIBLE_MINIMUM_PROVEN",
  proof_basis: "SOLVER_AND_SMALL_ORACLE",
  receipt_sha256: "d".repeat(64),
  scope_caveat:
    "No real-world identity is determined. All findings are conditional on the reviewed candidate universe.",
};

function queueResponses(responses: unknown[]) {
  globalThis.fetch = vi.fn().mockImplementation(async () => {
    const next = responses.shift() as unknown;
    if (next && typeof next === "object" && "__error" in (next as Record<string, unknown>)) {
      const err = (next as { __error: { status: number; body: unknown } }).__error;
      return {
        ok: false,
        status: err.status,
        json: async () => err.body,
      } as unknown as Response;
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => next,
    }) as unknown as Response;
  });
}

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data } as unknown as Response;
}

async function loadDemoToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /try the fictional example/i }));
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: /which links are legitimately possible/i }),
    ).toBeTruthy(),
  );
}

async function adoptToChallenge(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: /adopt fictional review rules/i }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: /could the conclusion reverse/i }),
    ).toBeTruthy(),
  );
}

async function reachChallenge(user: ReturnType<typeof userEvent.setup>) {
  await loadDemoToReview(user);
  await adoptToChallenge(user);
}

async function runChallenge(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /run challenge/i }));
  await waitFor(() =>
    expect(screen.getAllByText(/ANALYSIS_VERIFIED|NOT_VERIFIED/).length).toBeGreaterThan(0),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("T09A browser states", () => {
  it("shows no verdict before any backend call and never auto-adopts review", async () => {
    queueResponses([]);
    render(<App />);
    expect(screen.queryByText(/REVERSIBLE_MINIMUM_PROVEN/)).toBeNull();
    expect(screen.getByText(/fictional example · not yet analyzed/i)).toBeTruthy();
  });

  it("import loads the demo then guides to Review with the parse visible via Back", async () => {
    queueResponses([parseOk]);
    render(<App />);
    const user = userEvent.setup();
    await loadDemoToReview(user);
    expect(
      screen.queryByRole("heading", { name: /what are we comparing/i }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: /back to import/i }));
    await waitFor(() => expect(screen.getByText(/PARSED_UNREVIEWED/)).toBeTruthy());
    expect(screen.getAllByText(/matches bundled original/i).length).toBeGreaterThanOrEqual(2);
  });

  it("flagship shows the proven-minimum verdict, changed link T-02, proof source, and no inconclusive label", async () => {
    queueResponses([parseOk, validateOk, analyzeFlagship]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    expect(screen.getAllByText(/REVERSIBLE_MINIMUM_PROVEN/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Changed row/)).toBeTruthy();
    // Data-driven old → new registration IDs for the changed row.
    expect(screen.getByText("T-02: R-A2 → R-B2")).toBeTruthy();
    // The same change explained by name and group.
    expect(screen.getByText(/Kim Rao of Group A → Kym Rao of Group B/)).toBeTruthy();
    expect(screen.getAllByText(/R-A2/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R-B2/).length).toBeGreaterThan(0);
    expect(screen.getByText(/SOLVER_AND_SMALL_ORACLE/)).toBeTruthy();
    expect(screen.queryByText(/Inconclusive/)).toBeNull();
  });

  it("stable policy shows the scoped-stability verdict without changed rows", async () => {
    queueResponses([parseOk, validateOk, analyzeStable]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await waitFor(() =>
      expect(screen.getAllByText(/STABLE_WITHIN_REVIEWED_POLICY/).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/Changed row/)).toBeNull();
    expect(screen.queryByText(/Inconclusive/)).toBeNull();
    expect(screen.queryByText(/minimum verified/i)).toBeNull();
  });

  it("witness-only response shows the witness-only verdict without claiming a proven minimum", async () => {
    queueResponses([parseOk, validateOk, analyzeWitnessOnly]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await waitFor(() =>
      expect(screen.getAllByText(/REVERSIBLE_WITNESS_ONLY/).length).toBeGreaterThan(0),
    );
    expect(screen.getByText(/CHECKED_WITNESS_ONLY/)).toBeTruthy();
    expect(screen.queryByText(/Inconclusive/)).toBeNull();
    expect(screen.queryByText(/minimum verified/i)).toBeNull();
  });

  it("not-verified response stays inconclusive and never claims a reversal", async () => {
    queueResponses([parseOk, validateOk, analyzeNotVerified]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await waitFor(() =>
      expect(screen.getAllByText(/NOT_VERIFIED/).length).toBeGreaterThan(0),
    );
    expect(screen.getByText(/inconclusive: the backend/i)).toBeTruthy();
    expect(screen.queryByText(/Changed row/)).toBeNull();
    expect(screen.queryByText(/minimum verified/i)).toBeNull();
  });

  it("clearing the demo removes old verdicts (no stale presentation)", async () => {
    queueResponses([parseOk, validateOk, analyzeFlagship]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await user.click(screen.getByRole("button", { name: /continue to verify/i }));
    await user.click(screen.getByRole("button", { name: /back to challenge/i }));
    await user.click(screen.getByRole("button", { name: /back to review/i }));
    await user.click(screen.getByRole("button", { name: /back to import/i }));
    await user.click(screen.getByRole("button", { name: /clear demo/i }));
    await waitFor(() => expect(screen.queryByText(/ANALYSIS_VERIFIED/)).toBeNull());
    expect(screen.queryByText(/REVERSIBLE_MINIMUM_PROVEN/)).toBeNull();
    expect(
      screen.getByRole("heading", { name: /can one uncertain match change who came out ahead/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /try the fictional example/i }),
    ).toBeTruthy();
  });

  it("discards a stale out-of-order analysis response that arrives after Clear", async () => {
    let resolveAnalyze!: (value: unknown) => void;
    const analyzeGate = new Promise<unknown>((res) => {
      resolveAnalyze = res;
    });
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/api/parse")) return okJson(parseOk);
      if (String(url).includes("/api/review/validate")) return okJson(validateOk);
      if (String(url).includes("/api/analyze")) {
        const data = await analyzeGate;
        return okJson(data);
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await user.click(screen.getByRole("button", { name: /run challenge/i }));
    await user.click(screen.getByRole("button", { name: /back to review/i }));
    await user.click(screen.getByRole("button", { name: /back to import/i }));
    await user.click(screen.getByRole("button", { name: /clear demo/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /can one uncertain match change who came out ahead/i }),
      ).toBeTruthy(),
    );
    resolveAnalyze(analyzeFlagship);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/ANALYSIS_VERIFIED/)).toBeNull();
    expect(screen.queryByText(/REVERSIBLE_MINIMUM_PROVEN/)).toBeNull();
  });

  it("a failed fresh analysis does not leave the old verdict visible", async () => {
    let analyzeCalls = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/api/parse")) return okJson(parseOk);
      if (String(url).includes("/api/review/validate")) return okJson(validateOk);
      if (String(url).includes("/api/analyze")) {
        analyzeCalls += 1;
        if (analyzeCalls === 1) return okJson(analyzeFlagship);
        return {
          ok: false,
          status: 409,
          json: async () => ({ detail: { code: "REVIEW_SNAPSHOT_STALE" } }),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await user.click(screen.getByRole("button", { name: /run challenge/i }));
    await waitFor(() => expect(screen.getByText(/REVIEW_SNAPSHOT_STALE/)).toBeTruthy());
    expect(screen.queryByText(/ANALYSIS_VERIFIED/)).toBeNull();
    expect(screen.queryByText(/REVERSIBLE_MINIMUM_PROVEN/)).toBeNull();
  });

  it("failed review adoption surfaces the backend code and keeps analysis disabled", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/api/parse")) {
        return { ok: true, status: 200, json: async () => parseOk } as unknown as Response;
      }
      return {
        ok: false,
        status: 409,
        json: async () => ({ detail: { code: "REVIEW_SNAPSHOT_STALE" } }),
      } as unknown as Response;
    });
    render(<App />);
    const user = userEvent.setup();
    await loadDemoToReview(user);
    await user.click(
      screen.getByRole("button", { name: /adopt fictional review rules/i }),
    );
    await waitFor(() => expect(screen.getByText(/REVIEW_SNAPSHOT_STALE/)).toBeTruthy());
    expect(screen.queryByText(/ANALYSIS_VERIFIED/)).toBeNull();
    // Challenge stage is unreachable without a validated review.
    expect(screen.queryByRole("button", { name: /run challenge/i })).toBeNull();
  });
});

describe("T09-UX02 guided experience", () => {
  it("landing states the consequence, offers one primary action, and claims no proof", () => {
    queueResponses([]);
    render(<App />);
    expect(
      screen.getByRole("heading", {
        name: /can one uncertain match change who came out ahead/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(/a report says group a attended more.*using only fictional data/i),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /try the fictional example/i }),
    ).toBeTruthy();
    expect(
      screen.getByText(/fictional example · not yet analyzed/i),
    ).toBeTruthy();
    expect(screen.queryByText(/minimum verified/i)).toBeNull();
    expect(screen.queryByText(/REVERSIBLE_MINIMUM_PROVEN/)).toBeNull();
  });

  it("gates dependent stages: inactive panels are absent and locked steps are disabled", async () => {
    queueResponses([parseOk]);
    render(<App />);
    const user = userEvent.setup();
    expect(
      screen.getByRole("heading", { name: /can one uncertain match change who came out ahead/i }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: /which links are legitimately possible/i }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /run challenge/i })).toBeNull();
    const challengeStep = screen.getByRole("button", { name: /challenge.*test the answer/i });
    expect(challengeStep).toHaveProperty("disabled", true);
    await loadDemoToReview(user);
    expect(
      screen.getByRole("heading", { name: /which links are legitimately possible/i }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: /can one uncertain match change who came out ahead/i }),
    ).toBeNull();
  });

  it("labels prepared-policy edges by status and permission, never as model suggestions", async () => {
    queueResponses([parseOk, validateOk]);
    render(<App />);
    const user = userEvent.setup();
    await loadDemoToReview(user);
    // T-02's prepared-policy candidates are Possible links with a stated origin.
    expect(screen.getAllByText("Possible link").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Origin: prepared fictional policy").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not yet permitted — adoption required/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/permitted under this example's reviewed policy/i),
    ).toBeNull();
    await adoptToChallenge(user);
    await user.click(screen.getByRole("button", { name: /back to review/i }));
    expect(
      screen.getAllByText(/permitted under this example's reviewed policy/i).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/not yet permitted/i)).toBeNull();
  });

  it("after analysis a compact bar carries the real verdict, counts, and scope — not the landing billboard", async () => {
    queueResponses([parseOk, validateOk, analyzeFlagship]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    expect(
      screen.queryByRole("heading", {
        name: /can one uncertain match change who came out ahead/i,
      }),
    ).toBeNull();
    expect(
      screen.getByText(/one permitted identity change reverses the result/i),
    ).toBeTruthy();
    expect(screen.getByText(/minimum verified/i)).toBeTruthy();
    expect(screen.getByText(/only within the reviewed matching rules/i)).toBeTruthy();
  });

  it("challenge offers a labeled view toggle between the checked baseline and witness", async () => {
    queueResponses([parseOk, validateOk, analyzeFlagship]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    expect(screen.getByText("ORIGINAL MATCHING")).toBeTruthy();
    expect(screen.getByText("PERMITTED ALTERNATIVE")).toBeTruthy();
    expect(screen.getByText("T-02: R-A2 → R-B2")).toBeTruthy();
    const baselineView = screen.getByRole("radio", { name: /view baseline matching/i });
    const witnessView = screen.getByRole("radio", { name: /view permitted alternative/i });
    expect(witnessView).toHaveProperty("checked", true);
    await user.click(baselineView);
    expect(baselineView).toHaveProperty("checked", true);
    // Still the same checked result — the toggle never reruns analysis.
    expect(screen.getByText("T-02: R-A2 → R-B2")).toBeTruthy();
  });

  it("issues and replays receipts through the real API, never fabricated browser proof", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      seen.push(String(url));
      if (String(url).includes("/api/parse")) return okJson(parseOk);
      if (String(url).includes("/api/review/validate")) return okJson(validateOk);
      if (String(url).includes("/api/analyze")) return okJson(analyzeFlagship);
      if (String(url).includes("/api/receipt")) return okJson(receiptOk);
      if (String(url).includes("/api/verify")) return okJson(verifyOk);
      throw new Error(`unexpected fetch ${url}`);
    });
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await user.click(screen.getByRole("button", { name: /continue to verify/i }));
    expect(
      screen.queryByText(/we independently checked this alternative/i),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: /issue receipt/i }));
    await waitFor(() => expect(screen.getByText(/RECEIPT_ISSUED/)).toBeTruthy());
    expect(
      screen.getByRole("button", { name: /download verification receipt/i }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /verify replay/i }));
    await waitFor(() => expect(screen.getByText(/VERIFIED_REPLAY/)).toBeTruthy());
    expect(
      screen.getByText(/we independently checked this alternative/i),
    ).toBeTruthy();
    expect(seen.some((u) => u.includes("/api/receipt"))).toBe(true);
    expect(seen.some((u) => u.includes("/api/verify"))).toBe(true);
  });
});

describe("T09-UX02-FIX01 verdict-faithful verification copy", () => {
  const analyzeSolverOnly = {
    ...analyzeFlagship,
    oracle_status: "NOT_VERIFIED",
    proof_basis: "SOLVER_ATTRIBUTED_ONLY",
  };

  const receiptFor = (verdict: string) => ({
    status: "RECEIPT_ISSUED",
    receipt: { receipt_sha256: "d".repeat(64), verdict },
  });

  const verifyFor = (verdict: string, proof_basis: string, receipt_sha256 = "d".repeat(64)) => ({
    status: "VERIFIED_REPLAY",
    verdict,
    proof_basis,
    receipt_sha256,
    scope_caveat:
      "No real-world identity is determined. All findings are conditional on the reviewed candidate universe.",
  });

  function routeFetch(routes: Record<string, unknown>) {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      for (const [key, data] of Object.entries(routes)) {
        if (String(url).includes(key)) return okJson(data);
      }
      throw new Error(`unexpected fetch ${url}`);
    });
  }

  async function reachReplayedVerify(user: ReturnType<typeof userEvent.setup>) {
    await reachChallenge(user);
    await runChallenge(user);
    await user.click(screen.getByRole("button", { name: /continue to verify/i }));
    await user.click(screen.getByRole("button", { name: /issue receipt/i }));
    await waitFor(() => expect(screen.getByText(/RECEIPT_ISSUED/)).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /verify replay/i }));
    await waitFor(
      () =>
        expect(
          screen.getAllByText(/VERIFIED_REPLAY|Evidence mismatch/).length,
        ).toBeGreaterThan(0),
    );
  }

  it("stable replay states reviewed-model stability, never a reversal", async () => {
    routeFetch({
      "/api/parse": parseOk,
      "/api/review/validate": validateOk,
      "/api/analyze": analyzeStable,
      "/api/receipt": receiptFor("STABLE_WITHIN_REVIEWED_POLICY"),
      "/api/verify": verifyFor("STABLE_WITHIN_REVIEWED_POLICY", "SOLVER_AND_SMALL_ORACLE"),
    });
    render(<App />);
    const user = userEvent.setup();
    await reachReplayedVerify(user);
    expect(
      screen.getByText(/no permitted reversal exists within the reviewed model/i),
    ).toBeTruthy();
    expect(screen.queryByText(/and it flips the fixed question/i)).toBeNull();
    expect(screen.queryByText(/we independently checked this alternative/i)).toBeNull();
    expect(screen.queryByText(/smallest possible number/i)).toBeNull();
    expect(screen.queryByText(/evidence mismatch/i)).toBeNull();
  });

  it("solver-plus-oracle reversal retains minimum proof with oracle attribution", async () => {
    routeFetch({
      "/api/parse": parseOk,
      "/api/review/validate": validateOk,
      "/api/analyze": analyzeFlagship,
      "/api/receipt": receiptFor("REVERSIBLE_MINIMUM_PROVEN"),
      "/api/verify": verifyFor("REVERSIBLE_MINIMUM_PROVEN", "SOLVER_AND_SMALL_ORACLE"),
    });
    render(<App />);
    const user = userEvent.setup();
    await reachReplayedVerify(user);
    expect(
      screen.getByText(/cross-checked by the small-case oracle/i),
    ).toBeTruthy();
    expect(screen.getByText(/we independently checked this alternative/i)).toBeTruthy();
  });

  it("solver-only reversal states a solver-proven optimum without an oracle claim", async () => {
    routeFetch({
      "/api/parse": parseOk,
      "/api/review/validate": validateOk,
      "/api/analyze": analyzeSolverOnly,
      "/api/receipt": receiptFor("REVERSIBLE_MINIMUM_PROVEN"),
      "/api/verify": verifyFor("REVERSIBLE_MINIMUM_PROVEN", "SOLVER_ATTRIBUTED_ONLY"),
    });
    render(<App />);
    const user = userEvent.setup();
    await reachReplayedVerify(user);
    expect(screen.getByText(/optimum is solver-proven/i)).toBeTruthy();
    expect(screen.getByText(/no separate small-oracle cross-check/i)).toBeTruthy();
    expect(screen.queryByText(/cross-checked by the small-case oracle/i)).toBeNull();
  });

  it("witness-only replay never upgrades to minimum-proven", async () => {
    routeFetch({
      "/api/parse": parseOk,
      "/api/review/validate": validateOk,
      "/api/analyze": analyzeWitnessOnly,
      "/api/receipt": receiptFor("REVERSIBLE_WITNESS_ONLY"),
      "/api/verify": verifyFor("REVERSIBLE_WITNESS_ONLY", "CHECKED_WITNESS_ONLY"),
    });
    render(<App />);
    const user = userEvent.setup();
    await reachReplayedVerify(user);
    expect(screen.getByText(/minimality is not proven/i)).toBeTruthy();
    expect(screen.queryByText(/was proven by the completed solver/i)).toBeNull();
    expect(screen.queryByText(/smallest possible number/i)).toBeNull();
  });

  it("verdict mismatch suppresses proof language and shows a mismatch state", async () => {
    routeFetch({
      "/api/parse": parseOk,
      "/api/review/validate": validateOk,
      "/api/analyze": analyzeFlagship,
      "/api/receipt": receiptFor("REVERSIBLE_MINIMUM_PROVEN"),
      "/api/verify": verifyFor("STABLE_WITHIN_REVIEWED_POLICY", "SOLVER_AND_SMALL_ORACLE"),
    });
    render(<App />);
    const user = userEvent.setup();
    await reachReplayedVerify(user);
    expect(screen.getByText(/evidence mismatch/i)).toBeTruthy();
    expect(screen.queryByText(/we independently checked this alternative/i)).toBeNull();
    expect(screen.queryByText(/smallest possible number/i)).toBeNull();
    expect(screen.queryByText(/no permitted reversal exists/i)).toBeNull();
  });

  it("digest mismatch suppresses proof language and shows a mismatch state", async () => {
    routeFetch({
      "/api/parse": parseOk,
      "/api/review/validate": validateOk,
      "/api/analyze": analyzeFlagship,
      "/api/receipt": receiptFor("REVERSIBLE_MINIMUM_PROVEN"),
      "/api/verify": verifyFor(
        "REVERSIBLE_MINIMUM_PROVEN",
        "SOLVER_AND_SMALL_ORACLE",
        "e".repeat(64),
      ),
    });
    render(<App />);
    const user = userEvent.setup();
    await reachReplayedVerify(user);
    expect(screen.getByText(/evidence mismatch/i)).toBeTruthy();
    expect(screen.queryByText(/we independently checked this alternative/i)).toBeNull();
    expect(screen.queryByText(/smallest possible number/i)).toBeNull();
  });
});

describe("T09A UX presentation contract", () => {
  it("explains the purpose before any backend response without presenting a proof", () => {
    queueResponses([]);
    render(<App />);
    expect(
      screen.getByRole("heading", {
        name: /can one uncertain match change who came out ahead/i,
      }),
    ).toBeTruthy();
    expect(screen.getByText(/fictional example · not yet analyzed/i)).toBeTruthy();
    expect(screen.queryByText(/minimum verified/i)).toBeNull();
  });

  it("shows human-readable original and alternative panels only after the real response", async () => {
    queueResponses([parseOk, validateOk, analyzeFlagship]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await waitFor(() =>
      expect(
        screen.getByText(/one permitted identity change reverses the result/i),
      ).toBeTruthy(),
    );
    expect(screen.getByText("ORIGINAL MATCHING")).toBeTruthy();
    expect(screen.getByText("PERMITTED ALTERNATIVE")).toBeTruthy();
    expect(screen.getByText("T-02: R-A2 → R-B2")).toBeTruthy();
  });
});

describe("T09-UX03 decision canvas", () => {
  it("(a) first screen shows the human-language heading, one-sentence purpose, and a single prominent CTA", () => {
    queueResponses([]);
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Can one uncertain match change who came out ahead?" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "A report says Group A attended more. This page tests whether one human-permitted rematch could reverse that answer, using only fictional data.",
      ),
    ).toBeTruthy();
    const cta = screen.getByRole("button", { name: /explore the verified event/i });
    expect(cta).toBeTruthy();
    expect(cta.className).toMatch(/primary/);
    expect(
      screen.getByRole("button", { name: /try the fictional example/i }),
    ).toBeTruthy();
    // Exactly one primary action on the first screen.
    expect(document.querySelectorAll("button.primary").length).toBe(1);
  });

  it("(b) baseline never claims a verified reversal before /api/analyze returns", async () => {
    queueResponses([parseOk, validateOk]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    expect(screen.queryByText(/reverses which group leads/i)).toBeNull();
    expect(screen.queryByText(/minimum verified/i)).toBeNull();
    expect(screen.queryByText(/fewest changed assignments/i)).toBeNull();
    expect(screen.queryByText(/REVERSIBLE_MINIMUM_PROVEN/)).toBeNull();
  });

  it("(c) prepared-policy candidates carry status and origin until adoption", async () => {
    queueResponses([parseOk, validateOk]);
    render(<App />);
    const user = userEvent.setup();
    await loadDemoToReview(user);
    // Legend names the four link meanings for the reader.
    expect(screen.getByText(/possible link — a permitted alternative/i)).toBeTruthy();
    expect(screen.getByText(/original baseline/i)).toBeTruthy();
    expect(screen.getByText(/checked alternative/i)).toBeTruthy();
    await adoptToChallenge(user);
    await user.click(screen.getByRole("button", { name: /back to review/i }));
    // The reported link is badged as the baseline only after adoption.
    expect(screen.getAllByText("Original baseline").length).toBeGreaterThan(0);
    // Viewing the diagram never reruns analysis: no verdict appears from adoption alone.
    expect(screen.queryByText(/REVERSIBLE_MINIMUM_PROVEN/)).toBeNull();
  });

  it("(d) verified flagship shows exact T-02 link, group counts, and proven minimum", async () => {
    queueResponses([parseOk, validateOk, analyzeFlagship]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await waitFor(() => expect(screen.getByText("T-02: R-A2 → R-B2")).toBeTruthy());
    expect(screen.getByText(/Original: Group A 2 · Group B 1/)).toBeTruthy();
    expect(screen.getByText(/Permitted alternative: Group A 1 · Group B 2/)).toBeTruthy();
    expect(
      screen.getByText(/this one permitted change reverses which group leads/i),
    ).toBeTruthy();
    expect(screen.getByText(/fewest changed assignments/i)).toBeTruthy();
  });

  it("(e) stable replay keeps honest stability copy with no minimum claim", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/api/parse")) return okJson(parseOk);
      if (String(url).includes("/api/review/validate")) return okJson(validateOk);
      if (String(url).includes("/api/analyze")) return okJson(analyzeStable);
      if (String(url).includes("/api/receipt"))
        return okJson({
          status: "RECEIPT_ISSUED",
          receipt: { receipt_sha256: "d".repeat(64), verdict: "STABLE_WITHIN_REVIEWED_POLICY" },
        });
      if (String(url).includes("/api/verify"))
        return okJson({
          status: "VERIFIED_REPLAY",
          verdict: "STABLE_WITHIN_REVIEWED_POLICY",
          proof_basis: "SOLVER_AND_SMALL_ORACLE",
          receipt_sha256: "d".repeat(64),
          scope_caveat: "scope",
        });
      throw new Error(`unexpected fetch ${url}`);
    });
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    // Challenge itself must not claim a minimum or a reversal sentence.
    expect(screen.queryByText(/this one permitted change reverses which group leads/i)).toBeNull();
    expect(screen.queryByText(/fewest changed assignments/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: /continue to verify/i }));
    await user.click(screen.getByRole("button", { name: /issue receipt/i }));
    await waitFor(() => expect(screen.getByText(/RECEIPT_ISSUED/)).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /verify replay/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/the conclusion is stable within the reviewed set/i),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(/fewest changed assignments/i)).toBeNull();
    expect(screen.queryByText(/the conclusion changes within the reviewed set/i)).toBeNull();
  });

  it("(f) a failed replay withholds proof and surfaces the error", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/api/parse")) return okJson(parseOk);
      if (String(url).includes("/api/review/validate")) return okJson(validateOk);
      if (String(url).includes("/api/analyze")) return okJson(analyzeFlagship);
      if (String(url).includes("/api/receipt")) return okJson(receiptOk);
      if (String(url).includes("/api/verify")) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ detail: { code: "VERIFY_FAILED" } }),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await user.click(screen.getByRole("button", { name: /continue to verify/i }));
    await user.click(screen.getByRole("button", { name: /issue receipt/i }));
    await waitFor(() => expect(screen.getByText(/RECEIPT_ISSUED/)).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /verify replay/i }));
    await waitFor(() => expect(screen.getByText(/VERIFY_FAILED/)).toBeTruthy());
    expect(screen.queryByText(/independent verification replay succeeded/i)).toBeNull();
    expect(screen.queryByText(/we independently checked this alternative/i)).toBeNull();
  });

  it("(g) reloading the demo after verify returns to the unproven first screen", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/api/parse")) return okJson(parseOk);
      if (String(url).includes("/api/review/validate")) return okJson(validateOk);
      if (String(url).includes("/api/analyze")) return okJson(analyzeFlagship);
      if (String(url).includes("/api/receipt")) return okJson(receiptOk);
      if (String(url).includes("/api/verify")) return okJson(verifyOk);
      throw new Error(`unexpected fetch ${url}`);
    });
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await user.click(screen.getByRole("button", { name: /continue to verify/i }));
    await user.click(screen.getByRole("button", { name: /issue receipt/i }));
    await waitFor(() => expect(screen.getByText(/RECEIPT_ISSUED/)).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /back to challenge/i }));
    await user.click(screen.getByRole("button", { name: /back to review/i }));
    await user.click(screen.getByRole("button", { name: /back to import/i }));
    await user.click(screen.getByRole("button", { name: /clear demo/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /can one uncertain match change who came out ahead/i }),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(/independent verification replay succeeded/i)).toBeNull();
    expect(screen.queryByText(/this one permitted change reverses which group leads/i)).toBeNull();
  });

  it("(h) the skip link is the first tabbable element and targets the main canvas", () => {
    queueResponses([]);
    render(<App />);
    const skip = document.querySelector("a.skip");
    expect(skip).toBeTruthy();
    expect(skip?.getAttribute("href")).toBe("#main");
    expect(skip?.textContent).toMatch(/skip to main content/i);
    const main = document.querySelector("main#main");
    expect(main).toBeTruthy();
    // The skip target must be focusable so activation moves keyboard focus.
    expect(main?.getAttribute("tabindex")).toBe("-1");
    // First Tab order check: the first focusable element in DOM order is the skip link.
    const focusables = document.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    );
    expect(focusables.length).toBeGreaterThan(0);
    expect(focusables[0]).toBe(skip);
  });
});

describe("T09-INT-01 integrated shell", () => {
  function fetchUrls(): string[] {
    const mock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
    return mock.mock.calls.map((c) => String(c[0]));
  }

  it("entry shows one labelled illustration, trust line, and a working CSV path", async () => {
    queueResponses([]);
    render(<App />);
    const user = userEvent.setup();
    expect(screen.getByText("Example — not analysed")).toBeTruthy();
    expect(screen.getByText(/ai suggests · you decide · mathematics checks/i)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /explore the verified event/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /try the fictional example/i }),
    ).toBeTruthy();
    const csvs = screen.getByRole("button", { name: /use my csvs/i });
    expect(csvs).toHaveProperty("disabled", false);
    await user.click(csvs);
    expect(
      screen.getByRole("heading", { name: /what are we comparing/i }),
    ).toBeTruthy();
    // Still exactly one primary action on the first screen.
    expect(document.querySelectorAll("button.primary").length).toBe(1);
  });

  it("makes zero browser Meta requests across the full flagship flow", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/api/parse")) return okJson(parseOk);
      if (String(url).includes("/api/review/validate")) return okJson(validateOk);
      if (String(url).includes("/api/analyze")) return okJson(analyzeFlagship);
      if (String(url).includes("/api/receipt")) return okJson(receiptOk);
      if (String(url).includes("/api/verify")) return okJson(verifyOk);
      throw new Error(`unexpected fetch ${url}`);
    });
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await user.click(screen.getByRole("button", { name: /continue to verify/i }));
    await user.click(screen.getByRole("button", { name: /issue receipt/i }));
    await waitFor(() => expect(screen.getByText(/RECEIPT_ISSUED/)).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /verify replay/i }));
    await waitFor(() => expect(screen.getByText(/VERIFIED_REPLAY/)).toBeTruthy());
    expect(fetchUrls().some((u) => u.includes("/api/meta"))).toBe(false);
  });

  it("record queue opens on the ambiguous record and selection is view-only", async () => {
    queueResponses([parseOk]);
    render(<App />);
    const user = userEvent.setup();
    await loadDemoToReview(user);
    const queue = screen.getByRole("group", { name: /attendance records/i });
    expect(queue).toBeTruthy();
    // T-02 is unresolved and selected by default; T-01/T-03 are settled.
    const t02 = screen.getByRole("button", { name: /t-02.*unresolved/i });
    expect(t02.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByText("Possible link").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Origin: prepared fictional policy").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not yet permitted — adoption required/i).length).toBeGreaterThan(0);
    const callsBefore = fetchUrls().length;
    await user.click(screen.getByRole("button", { name: /t-01.*resolved/i }));
    expect(screen.getByText(/settled link — no alternative/i)).toBeTruthy();
    // Inspecting records performs no backend call and grants nothing.
    expect(fetchUrls().length).toBe(callsBefore);
    expect(screen.queryByText(/REVERSIBLE_MINIMUM_PROVEN/)).toBeNull();
  });

  it("canvas changed-row selection inspects without rerunning analysis", async () => {
    queueResponses([parseOk, validateOk, analyzeFlagship]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await waitFor(() => expect(screen.getByText("T-02: R-A2 → R-B2")).toBeTruthy());
    const callsBefore = fetchUrls().length;
    const row = screen.getByRole("button", { name: /kim rao of group a → kym rao of group b/i });
    await user.click(row);
    expect(row.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/selecting inspects only/i)).toBeTruthy();
    expect(fetchUrls().length).toBe(callsBefore);
    expect(screen.getByText("T-02: R-A2 → R-B2")).toBeTruthy();
  });

  it("inconclusive analysis blocks receipt issuance with an honest error", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/api/parse")) return okJson(parseOk);
      if (String(url).includes("/api/review/validate")) return okJson(validateOk);
      if (String(url).includes("/api/analyze")) return okJson(analyzeNotVerified);
      if (String(url).includes("/api/receipt")) {
        return {
          ok: false,
          status: 409,
          json: async () => ({ detail: { code: "ANALYSIS_NOT_VERIFIED" } }),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    expect(screen.getByText(/inconclusive: the backend/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /continue to verify/i }));
    await user.click(screen.getByRole("button", { name: /issue receipt/i }));
    await waitFor(() => expect(screen.getByText(/ANALYSIS_NOT_VERIFIED/)).toBeTruthy());
    expect(screen.queryByText(/RECEIPT_ISSUED/)).toBeNull();
    expect(screen.queryByText(/independent verification replay succeeded/i)).toBeNull();
  });

describe("T09-INT-02 real import and human review", () => {
  const REG_CSV = "registration_id,name,group\nR-X1,Ann Lee,A\nR-X2,Bob Ray,B\n";
  const ATT_CSV = "attendance_id,recorded_name\nT-1,Ann Lee\nT-2,Bob Ray\n";
  const parseCustom = {
    status: "PARSED_UNREVIEWED",
    registrations: [
      { registration_id: "R-X1", name: "Ann Lee", group: "A" },
      { registration_id: "R-X2", name: "Bob Ray", group: "B" },
    ],
    attendance: [
      { attendance_id: "T-1", recorded_name: "Ann Lee" },
      { attendance_id: "T-2", recorded_name: "Bob Ray" },
    ],
    registrations_digest: { raw_sha256: "e".repeat(64), row_count: 2 },
    attendance_digest: { raw_sha256: "f".repeat(64), row_count: 2 },
  };
  const suggestCustom = {
    model_status: "DETERMINISTIC_LOCAL",
    shortlist: {
      status: "UNREVIEWED_SHORTLIST",
      candidates: [
        { attendance_id: "T-1", registration_id: "R-X1" },
        { attendance_id: "T-2", registration_id: "R-X2" },
      ],
    },
  };
  const validateCustom = {
    status: "REVIEW_VALIDATED",
    coverage: "REVIEWED_PARTIAL",
    review_sha256: "b".repeat(64),
    review_revision: 1,
    reference_sha256: "c".repeat(64),
    baseline_counts: { a: 1, b: 1, unmatched: 0, a_greater_than_b: false },
  };
  const analyzeCustom = {
    status: "ANALYSIS_VERIFIED",
    coverage: "REVIEWED_PARTIAL",
    baseline_counts: { a: 1, b: 1, unmatched: 0, a_greater_than_b: false },
    alternative_counts: { a: 0, b: 2, unmatched: 0, a_greater_than_b: false },
    witness_assignments: [
      ["T-1", "R-X2"],
      ["T-2", "R-X2"],
    ],
    minimum_changed_assignments: 1,
    solver_status: "OPTIMAL",
    checker_status: "WITNESS_VALID",
    oracle_status: "ORACLE_REVERSIBLE",
    verdict: "REVERSIBLE_MINIMUM_PROVEN",
    proof_basis: "SOLVER_AND_SMALL_ORACLE",
    review_sha256: "b".repeat(64),
    reference_sha256: "c".repeat(64),
    receipt_sha256: "d".repeat(64),
    scope_caveat: "Custom upload scope.",
  };

  function validateBody(): Record<string, unknown> {
    const mock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
    const call = mock.mock.calls.find((c) => String(c[0]).includes("/api/review/validate"));
    expect(call).toBeTruthy();
    const init = call as unknown as [string, { body: string }];
    return JSON.parse(init[1].body) as Record<string, unknown>;
  }

  async function seedFirstRow(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /fetch deterministic shortlist/i }));
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /seed \d shortlist suggestion/i }).length,
      ).toBeGreaterThan(0),
    );
    const seeds = screen.getAllByRole("button", { name: /seed \d shortlist suggestion/i });
    await user.click(seeds[0]);
  }

  async function uploadCustom(
    user: ReturnType<typeof userEvent.setup>,
    regText = REG_CSV,
    attText = ATT_CSV,
    expectSuccess = true,
  ) {
    await user.upload(
      screen.getByLabelText(/upload registrations csv/i),
      new File([regText], "registrations.csv", { type: "text/csv" }),
    );
    await user.upload(
      screen.getByLabelText(/upload attendance csv/i),
      new File([attText], "attendance.csv", { type: "text/csv" }),
    );
    await user.click(screen.getByRole("button", { name: /upload and parse my csvs/i }));
    if (!expectSuccess) return;
    // A successful upload advances straight to Review, like the demo does.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /which links are legitimately possible/i }),
      ).toBeTruthy(),
    );
  }

  it("uploads and parses valid custom CSVs with backend-verified digests", async () => {
    queueResponses([parseCustom]);
    render(<App />);
    const user = userEvent.setup();
    await uploadCustom(user);
    await user.click(screen.getByRole("button", { name: /back to import/i }));
    await waitFor(() => expect(screen.getByText(/PARSED_UNREVIEWED/)).toBeTruthy());
    expect(screen.getByText(/your uploads: registrations.csv \+ attendance.csv/i)).toBeTruthy();
    expect(screen.getAllByText(/your upload — verified by the backend/i).length).toBe(2);
    await user.click(screen.getByRole("button", { name: /continue to review/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /which links are legitimately possible/i }),
      ).toBeTruthy(),
    );
  });

  it("requires both files before parsing", async () => {
    queueResponses([]);
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /upload and parse my csvs/i }));
    await waitFor(() => expect(screen.getByText(/SELECT_BOTH_CSV_FILES/)).toBeTruthy());
    expect(globalThis.fetch as unknown).toBeTruthy();
    const mock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
    expect(mock.mock.calls.length).toBe(0);
  });

  it("surfaces backend CSV validation errors without advancing", async () => {
    queueResponses([
      { __error: { status: 422, body: { detail: { code: "CSV_BAD_HEADER" } } } },
    ]);
    render(<App />);
    const user = userEvent.setup();
    await uploadCustom(user, "badheader\n1,2,3\n", ATT_CSV, false);
    await waitFor(() => expect(screen.getByText(/CSV_BAD_HEADER/)).toBeTruthy());
    expect(screen.queryByText(/PARSED_UNREVIEWED/)).toBeNull();
  });

  it("surfaces oversize uploads as reported by the backend", async () => {
    queueResponses([
      { __error: { status: 413, body: { detail: { code: "UPLOAD_TOO_LARGE" } } } },
    ]);
    render(<App />);
    const user = userEvent.setup();
    await uploadCustom(user, REG_CSV, ATT_CSV, false);
    await waitFor(() => expect(screen.getByText(/UPLOAD_TOO_LARGE/)).toBeTruthy());
    expect(screen.queryByText(/PARSED_UNREVIEWED/)).toBeNull();
  });

  it("human CONFIRMED adoption reaches Challenge on real backend data", async () => {
    queueResponses([parseCustom, suggestCustom, validateCustom, analyzeCustom]);
    render(<App />);
    const user = userEvent.setup();
    await uploadCustom(user);
    await seedFirstRow(user);
    await user.selectOptions(screen.getByLabelText("Link status for T-1 to R-X1"), "CONFIRMED");
    await user.click(screen.getByRole("button", { name: /adopt my review and baseline/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /could the conclusion reverse/i }),
      ).toBeTruthy(),
    );
    const body = validateBody();
    const policy = body["policy"] as { edges: Array<{ status: string; operation: string }> };
    expect(
      policy.edges.some((e) => e.status === "CONFIRMED" && e.operation === "EXPLICIT_REVIEW"),
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: /run challenge/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/permitted alternative: group a 0 · group b 2/i),
      ).toBeTruthy(),
    );
    const mock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
    expect(mock.mock.calls.some((c) => String(c[0]).includes("/api/meta"))).toBe(false);
  });

  it("editing after adoption invalidates downstream state with a notice", async () => {
    queueResponses([parseCustom, suggestCustom, validateCustom]);
    render(<App />);
    const user = userEvent.setup();
    await uploadCustom(user);
    await seedFirstRow(user);
    await user.click(screen.getByRole("button", { name: /adopt my review and baseline/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /could the conclusion reverse/i }),
      ).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: /back to review/i }));
    await user.selectOptions(screen.getByLabelText("Unmatched rule for T-1"), "REQUIRED");
    await waitFor(() =>
      expect(screen.getByText(/re-adopt your review/i)).toBeTruthy(),
    );
    expect(
      screen.getByRole("heading", { name: /which links are legitimately possible/i }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /continue to challenge/i })).toBeNull();
  });

  it("prohibiting everything honestly fails validation without adopting", async () => {
    queueResponses([
      parseCustom,
      suggestCustom,
      { __error: { status: 422, body: { detail: { code: "POLICY_INFEASIBLE" } } } },
    ]);
    render(<App />);
    const user = userEvent.setup();
    await uploadCustom(user);
    await seedFirstRow(user);
    await user.selectOptions(screen.getByLabelText("Link status for T-1 to R-X1"), "PROHIBITED");
    await user.click(screen.getByRole("button", { name: /adopt my review and baseline/i }));
    await waitFor(() => expect(screen.getByText(/POLICY_INFEASIBLE/)).toBeTruthy());
    expect(screen.queryByText(/REVIEW_VALIDATED/)).toBeNull();
  });

  it("duplicate greedy baselines are rejected by the backend, not hidden", async () => {
    const suggestConflict = {
      model_status: "DETERMINISTIC_LOCAL",
      shortlist: {
        status: "UNREVIEWED_SHORTLIST",
        candidates: [
          { attendance_id: "T-1", registration_id: "R-X1" },
          { attendance_id: "T-2", registration_id: "R-X1" },
        ],
      },
    };
    queueResponses([
      parseCustom,
      suggestConflict,
      { __error: { status: 422, body: { detail: { code: "BASELINE_INVALID" } } } },
    ]);
    render(<App />);
    const user = userEvent.setup();
    await uploadCustom(user);
    await user.click(screen.getByRole("button", { name: /fetch deterministic shortlist/i }));
    // Both rows share one candidate; the greedy preview warns, the backend decides.
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /seed 1 shortlist suggestion/i }).length,
      ).toBe(2),
    );
    for (const seed of screen.getAllByRole("button", { name: /seed 1 shortlist suggestion/i })) {
      await user.click(seed);
    }
    await waitFor(() =>
      expect(screen.getByText(/the backend will reject the duplicate/i)).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: /adopt my review and baseline/i }));
    await waitFor(() => expect(screen.getByText(/BASELINE_INVALID/)).toBeTruthy());
    expect(screen.queryByText(/REVIEW_VALIDATED/)).toBeNull();
  });

  it("unknown registration IDs are rejected inline with no request", async () => {
    queueResponses([parseCustom, suggestCustom]);
    render(<App />);
    const user = userEvent.setup();
    await uploadCustom(user);
    const mock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
    const before = mock.mock.calls.length;
    await user.type(screen.getByLabelText("Add registration ID for T-1"), "R-NOPE");
    const addButtons = screen.getAllByRole("button", { name: /add candidate/i });
    await user.click(addButtons[0]);
    await waitFor(() => expect(screen.getByText(/unknown registration id/i)).toBeTruthy());
    expect(mock.mock.calls.length).toBe(before);
  });

  it("shell renders source cards, queue, canvas, and drawer across the four stages", async () => {
    queueResponses([parseOk, validateOk, analyzeFlagship]);
    render(<App />);
    const user = userEvent.setup();
    await loadDemoToReview(user);
    await user.click(screen.getByRole("button", { name: /back to import/i }));
    await waitFor(() =>
      expect(screen.getAllByText(/registrations/i).length).toBeGreaterThan(0),
    );
    expect(screen.getByText("Attendance")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /continue to review/i }));
    await waitFor(() =>
      expect(screen.getByRole("group", { name: /attendance records/i })).toBeTruthy(),
    );
    await adoptToChallenge(user);
    await runChallenge(user);
    await waitFor(() =>
      expect(screen.getByLabelText(/decision canvas: original and permitted alternative/i)).toBeTruthy(),
    );
    expect(screen.getByText(/fewest changed assignments/i)).toBeTruthy();
  });
});

describe("T09-INT-01-FIX01 verdict-copy and provenance correction", () => {
  const analyzeTwoChange = {
    ...analyzeFlagship,
    alternative_counts: { a: 1, b: 2, unmatched: 0, a_greater_than_b: false },
    witness_assignments: [
      ["T-01", "R-A2"],
      ["T-02", "R-B2"],
      ["T-03", "R-B1"],
    ],
    minimum_changed_assignments: 2,
  };

  const analyzeNullMinimum = {
    ...analyzeFlagship,
    minimum_changed_assignments: null,
  };

  it("two-change minimum says two in the banner, never one", async () => {
    queueResponses([parseOk, validateOk, analyzeTwoChange]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await waitFor(() =>
      expect(
        screen.getByText(/two permitted identity changes reverse the result/i),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(/one permitted identity change reverses/i)).toBeNull();
  });

  it("one-change flagship still shows the minimum of 1", async () => {
    queueResponses([parseOk, validateOk, analyzeFlagship]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await waitFor(() =>
      expect(
        screen.getByText(/one permitted identity change reverses the result/i),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(/two permitted identity changes/i)).toBeNull();
  });

  it("null minimum suppresses the numerical proof claim", async () => {
    queueResponses([parseOk, validateOk, analyzeNullMinimum]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await waitFor(() =>
      expect(screen.getByText(/a permitted alternative reverses the result/i)).toBeTruthy(),
    );
    expect(screen.queryByText(/one permitted identity change/i)).toBeNull();
    expect(screen.queryByText(/two permitted identity changes/i)).toBeNull();
    expect(screen.queryByText(/fewest changed assignments/i)).toBeNull();
  });

  it("stable alone may claim no permitted reversal, always qualified", async () => {
    queueResponses([parseOk, validateOk, analyzeStable]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await waitFor(() =>
      expect(
        screen.getAllByText(/no permitted reversal exists within the reviewed set/i).length,
      ).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/inconclusive/i)).toBeNull();
  });

  it("not-verified never reads as stability anywhere visible or in ARIA", async () => {
    queueResponses([parseOk, validateOk, analyzeNotVerified]);
    render(<App />);
    const user = userEvent.setup();
    await reachChallenge(user);
    await runChallenge(user);
    await waitFor(() =>
      expect(
        screen.getAllByText(/inconclusive — no reversal or stability established/i).length,
      ).toBeGreaterThan(0),
    );
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/no permitted alternative reverses/i);
    expect(html).not.toMatch(/no reversing alternative/i);
    expect(html).not.toMatch(/no permitted reversal exists/i);
  });

  it("confirmed and possible links are distinct and selection grants nothing", async () => {
    queueResponses([parseOk]);
    render(<App />);
    const user = userEvent.setup();
    await loadDemoToReview(user);
    expect(screen.queryAllByText("Confirmed link").length).toBe(0);
    await user.click(screen.getByRole("button", { name: /t-01.*resolved/i }));
    expect(screen.getAllByText("Confirmed link").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Origin: prepared fictional policy").length).toBeGreaterThan(0);
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .length;
    await user.click(screen.getByRole("button", { name: /t-02.*unresolved/i }));
    expect(screen.getAllByText("Possible link").length).toBeGreaterThan(0);
    expect(
      (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length,
    ).toBe(calls);
    expect(screen.queryByText(/permitted under this example's reviewed policy/i)).toBeNull();
  });
}); // close T09-INT-01-FIX01 describe
}); // close T09-INT-01 integrated shell describe

describe("T09-DEMO01 verified flagship demonstration", () => {
  // Faithful row shape of a real 60/90 parse response (digests carry the pins).
  const regs60 = Array.from({ length: 45 }, (_, i) => ({
    registration_id: `R-A${String(i + 1).padStart(2, "0")}`,
    name: `Ash Person ${i + 1}`,
    group: "A",
  })).concat(
    Array.from({ length: 45 }, (_, i) => ({
      registration_id: `R-B${String(i + 1).padStart(2, "0")}`,
      name: `Bell Person ${i + 1}`,
      group: "B",
    })),
  );
  const atts60 = Array.from({ length: 60 }, (_, i) => ({
    attendance_id: `T-${String(i + 1).padStart(2, "0")}`,
    recorded_name: `Recorded Person ${i + 1}`,
  }));
  const parse60 = {
    status: "PARSED_UNREVIEWED",
    registrations: regs60,
    attendance: atts60,
    registrations_digest: {
      raw_sha256: "48feedb1ac550a048a0da4126c0e720ced658675f3e8adf89c9c80c1aea0b7cb",
      row_count: 90,
    },
    attendance_digest: {
      raw_sha256: "e7db50d0fa6c2a2902f0629abe0b291f118f13ee14eef6b76b5f472242e40b66",
      row_count: 60,
    },
  };
  const validate60 = {
    status: "REVIEW_VALIDATED",
    coverage: "REVIEWED_CLOSED_SCOPE",
    review_sha256: "9".repeat(64),
    review_revision: 1,
    reference_sha256: "8".repeat(64),
    baseline_counts: { a: 32, b: 28, unmatched: 0, a_greater_than_b: true },
  };
  const analyze60 = {
    status: "ANALYSIS_VERIFIED",
    coverage: "REVIEWED_CLOSED_SCOPE",
    baseline_counts: { a: 32, b: 28, unmatched: 0, a_greater_than_b: true },
    alternative_counts: { a: 30, b: 30, unmatched: 0, a_greater_than_b: false },
    witness_assignments: [
      ["T-49", "R-B12"],
      ["T-52", "R-B45"],
    ],
    minimum_changed_assignments: 2,
    solver_status: "OPTIMAL",
    checker_status: "WITNESS_VALID",
    oracle_status: "NOT_VERIFIED",
    verdict: "REVERSIBLE_MINIMUM_PROVEN",
    proof_basis: "SOLVER_ATTRIBUTED_ONLY",
    review_sha256: "9".repeat(64),
    reference_sha256: "8".repeat(64),
    receipt_sha256: "7".repeat(64),
    scope_caveat: "Generated 60/90 scope.",
  };

  async function loadVerifiedEvent(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /explore the verified event/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /which links are legitimately possible/i }),
      ).toBeTruthy(),
    );
  }

  function fetchUrls(): string[] {
    const mock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
    return mock.mock.calls.map((c) => String(c[0]));
  }

  it("loads 60/90 with real counts, manifest pins, and a usable ambiguous roster", async () => {
    queueResponses([parse60]);
    render(<App />);
    const user = userEvent.setup();
    await loadVerifiedEvent(user);
    // Overview states actual imported counts from the live parse response.
    const overview = within(screen.getByLabelText(/demonstration overview/i));
    expect(overview.getByText(/60 attendance records/i)).toBeTruthy();
    expect(overview.getByText(/90 registrations/i)).toBeTruthy();
    expect(overview.getByText(/12 unresolved ambiguous matches/i)).toBeTruthy();
    // Manifest pins live on the Import source cards.
    await user.click(screen.getByRole("button", { name: /back to import/i }));
    await waitFor(() => expect(screen.getByText(/PARSED_UNREVIEWED/)).toBeTruthy());
    expect(screen.getAllByText(/matches generated manifest/i).length).toBe(2);
    await user.click(screen.getByRole("button", { name: /continue to review/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /which links are legitimately possible/i }),
      ).toBeTruthy(),
    );
    // The parse request itself carries the 60-row attendance file.
    const parseCall = fetchUrls().find((u) => u.includes("/api/parse"));
    expect(parseCall).toBeTruthy();
    // All twelve ambiguous records are listed without dumping sixty rows.
    const roster = screen.getByRole("list", { name: /ambiguous records/i });
    expect(roster.querySelectorAll("button").length).toBe(12);
    // Roster selection drives the queue below.
    await user.click(screen.getByRole("button", { name: "T-49" }));
    expect(screen.getAllByText(/T-49/).length).toBeGreaterThan(0);
    // Ground truth is never requested or displayed.
    expect(fetchUrls().some((u) => u.includes("ground_truth"))).toBe(false);
    expect(screen.queryByText(/ground truth/i)).toBeNull();
  });

  it("adopts the prepared 60/90 policy and shows engine-returned counts", async () => {
    queueResponses([parse60, validate60, analyze60]);
    render(<App />);
    const user = userEvent.setup();
    await loadVerifiedEvent(user);
    await user.click(
      screen.getByRole("button", { name: /adopt the verified 60\/90 review rules/i }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /could the conclusion reverse/i }),
      ).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: /run challenge/i }));
    await waitFor(() =>
      expect(screen.getByText(/T-49: R-A07 → R-B12/)).toBeTruthy(),
    );
    // Second real changed link from the observed engine witness.
    expect(screen.getByText(/T-52: R-A31 → R-B45/)).toBeTruthy();
    // Every analytical number below comes from the mocked engine response.
    expect(screen.getByText(/original: group a 32 · group b 28/i)).toBeTruthy();
    expect(screen.getByText(/permitted alternative: group a 30 · group b 30/i)).toBeTruthy();
    expect(screen.getByText(/two permitted identity changes reverse the result/i)).toBeTruthy();
    expect(screen.getByText(/fewest changed assignments/i)).toBeTruthy();
    expect(fetchUrls().some((u) => u.includes("/api/meta"))).toBe(false);
  });

  it("replays the 60/90 receipt and switches back to the simple tutorial", async () => {
    const receipt60 = {
      status: "RECEIPT_ISSUED",
      receipt: { receipt_sha256: "6".repeat(64), verdict: "REVERSIBLE_MINIMUM_PROVEN" },
    };
    const verify60 = {
      status: "VERIFIED_REPLAY",
      verdict: "REVERSIBLE_MINIMUM_PROVEN",
      proof_basis: "SOLVER_ATTRIBUTED_ONLY",
      receipt_sha256: "6".repeat(64),
      scope_caveat: "Generated 60/90 scope.",
    };
    queueResponses([parse60, validate60, analyze60, receipt60, verify60, parseOk]);
    render(<App />);
    const user = userEvent.setup();
    await loadVerifiedEvent(user);
    await user.click(
      screen.getByRole("button", { name: /adopt the verified 60\/90 review rules/i }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /could the conclusion reverse/i }),
      ).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: /run challenge/i }));
    await waitFor(() =>
      expect(screen.getByText(/two permitted identity changes/i)).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: /continue to verify/i }));
    await user.click(screen.getByRole("button", { name: /issue receipt/i }));
    await waitFor(() => expect(screen.getByText(/RECEIPT_ISSUED/)).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /verify replay/i }));
    await waitFor(() => expect(screen.getByText(/VERIFIED_REPLAY/)).toBeTruthy());
    expect(
      screen.getByText(/independent verification replay succeeded/i),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /back to challenge/i }));
    await user.click(screen.getByRole("button", { name: /back to review/i }));
    await user.click(screen.getByRole("button", { name: /back to import/i }));
    await user.click(screen.getByRole("button", { name: /clear demonstration/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /explore the verified event/i }),
      ).toBeTruthy(),
    );
    // Simple tutorial still works and shows its own three-record scope.
    await user.click(screen.getByRole("button", { name: /try the fictional example/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /which links are legitimately possible/i }),
      ).toBeTruthy(),
    );
    expect(screen.queryByLabelText(/demonstration overview/i)).toBeNull();
    expect(screen.getByText(/kim \/ kym rao/i)).toBeTruthy();
  });
});
