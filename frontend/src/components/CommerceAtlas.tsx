/** Case B — Commerce decision investigation (new four-CSV vertical slice).
 *
 * Owns only Commerce state and the frozen `commerce.v1` adapter. Case A keeps
 * its own state and adapter in `App`; switching scenarios never mixes proof
 * state. Every count, verdict, and digest shown here comes from a real
 * backend response. While the Commerce router is not integrated, Import
 * reports an explicit unavailable state instead of any fabricated result.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  COMMERCE_CONTRACT_VERSION,
  COMMERCE_FILE_NAMES,
  CommerceApiError,
  commerceChallenge,
  commerceParse,
  commerceReceipt,
  commerceReplay,
  commerceReviewValidate,
  commerceSuggest,
  isCommerceRouterMissing,
  type CommerceChallengeResponse,
  type CommerceDisposition,
  type CommerceFileBundle,
  type CommerceFileName,
  type CommerceManualCandidate,
  type CommerceParseResponse,
  type CommerceReceiptResponse,
  type CommerceRecordType,
  type CommerceReplayResponse,
  type CommerceReviewValidateResponse,
  type CommerceSuggestResponse,
} from "../lib/commerceApi";
import {
  blockedCommerceRows,
  buildCommerceCatalog,
  emptyCommerceDraft,
  makeRecordKey,
  previewCommerceBaseline,
  seedAllSourceRefs,
  seedRowFromSourceRefs,
  serializeCommerceReview,
  setCommerceBaseline,
  setCommerceEdge,
  setCommerceUnmatched,
  type CommerceBaselinePreview,
  type CommerceCatalogTarget,
  type CommerceDraftState,
} from "../lib/commerceDraft";
import {
  commerceDecisionText,
  commerceStatusCopy,
  isCommerceReceiptEligible,
  validateCommerceResult,
} from "../lib/commerceView";
import { bytesToBase64 } from "../lib/encoding";
import {
  FICTIONAL_COMMERCE_BLURB,
  fictionalCommerceBundle,
  loadFictionalCommerceFiles,
} from "../lib/commerceExample";
import ProductShell, { type Stage } from "./ProductShell";
import ProofDrawer from "./ProofDrawer";
import AtlasSwitcher, { type AtlasScenario } from "./AtlasSwitcher";
import CommerceSourceInspector from "./CommerceSourceInspector";
import CommerceDecisionCanvas from "./CommerceDecisionCanvas";
import CommerceReviewEditor, { type CommerceBaselineOption } from "./CommerceReviewEditor";
import "./CommerceAtlas.css";

const COMMERCE_QUESTION = "Are at least K of N orders cleanly fulfilled?";

const COMMERCE_STAGES: Array<{ n: Stage; label: string; help: string }> = [
  { n: 1, label: "Import", help: "Load four CSVs" },
  { n: 2, label: "Review", help: "Adopt links" },
  { n: 3, label: "Challenge", help: "Test K" },
  { n: 4, label: "Verify", help: "Receipt + replay" },
];

const COMMERCE_STAGE_NOW: Record<Stage, string> = {
  1: "Step 1 of 4 · Import — the four fictional commerce files.",
  2: "Step 2 of 4 · Review — which links may be considered?",
  3: "Step 3 of 4 · Challenge — does any permitted alternative cross K?",
  4: "Step 4 of 4 · Verify — receipt and stateless replay.",
};

interface LoadedFile {
  name: string;
  text: string;
  b64: string;
}

function errText(e: unknown): string {
  if (e instanceof CommerceApiError) return `${e.code} (HTTP ${e.status} at ${e.path})`;
  if (e instanceof Error) return e.message;
  return "UNKNOWN_ERROR";
}

function readUpload(file: File): Promise<LoadedFile> {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("FILE_READ_FAILED"));
      reader.onload = () => {
        try {
          const bytes = new Uint8Array(reader.result as ArrayBuffer);
          const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          resolve({ name: file.name, text, b64: bytesToBase64(bytes) });
        } catch {
          reject(new Error("FILE_NOT_UTF8_CSV"));
        }
      };
      reader.readAsArrayBuffer(file);
    } catch {
      reject(new Error("FILE_READ_FAILED"));
    }
  });
}

interface CommerceAtlasProps {
  scenario: AtlasScenario;
  onScenario: (s: AtlasScenario) => void;
}

export default function CommerceAtlas({ scenario, onScenario }: CommerceAtlasProps) {
  const [files, setFiles] = useState<Record<CommerceFileName, LoadedFile | null>>({
    "orders.csv": null,
    "payments.csv": null,
    "deliveries.csv": null,
    "refunds.csv": null,
  });
  const [parse, setParse] = useState<CommerceParseResponse | null>(null);
  const [suggest, setSuggest] = useState<CommerceSuggestResponse | null>(null);
  const [draft, setDraft] = useState<CommerceDraftState | null>(null);
  const [validation, setValidation] = useState<CommerceReviewValidateResponse | null>(null);
  /** Last-accepted authoritative server revisions. Survives draft edits and
   * failed requests; replaced only by a newer accepted response or a new import. */
  const [serverRevisions, setServerRevisions] = useState<{
    source_revision: number;
    candidate_revision: number;
    policy_revision: number;
  } | null>(null);
  const [challenge, setChallenge] = useState<CommerceChallengeResponse | null>(null);
  const [receipt, setReceipt] = useState<CommerceReceiptResponse | null>(null);
  const [replay, setReplay] = useState<CommerceReplayResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ stage: string; message: string; missing: boolean } | null>(null);
  const [stage, setStage] = useState<Stage>(1);
  const [staleNote, setStaleNote] = useState<string | null>(null);
  const [timeBudget, setTimeBudget] = useState(10000);
  const [maxSuggestions, setMaxSuggestions] = useState(5);
  const [isExample, setIsExample] = useState(false);
  const fileRefs = useRef<Record<CommerceFileName, HTMLInputElement | null>>({
    "orders.csv": null,
    "payments.csv": null,
    "deliveries.csv": null,
    "refunds.csv": null,
  });
  const opEpoch = useRef(0);
  /** Synchronous in-flight import guard: React state settles a render too late
   * to dedupe rapid clicks, so this ref is the duplicate-submission lock. */
  const importActive = useRef(false);
  const stageHeadRef = useRef<HTMLHeadingElement>(null);

  const manual: CommerceManualCandidate[] = draft?.manual ?? [];
  const catalog: CommerceCatalogTarget[] = useMemo(
    () =>
      buildCommerceCatalog(
        parse?.deterministic_candidates ?? [],
        suggest?.suggestions ?? [],
        manual,
      ).targets,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parse, suggest, draft?.manual],
  );

  /** Every non-order source row forms the review denominator, even without candidates. */
  const reviewRecords = useMemo(() => {
    const rows = parse?.validated_source_rows;
    if (!rows) return [];
    const out: Array<{
      recordKey: string;
      recordType: CommerceRecordType;
      recordId: string;
      recordLabel: string;
      sourceHint: string | null;
      sourceRowNumber: number;
    }> = [];
    for (const r of rows.payments) {
      out.push({
        recordKey: makeRecordKey("payment", r.payment_id),
        recordType: "payment",
        recordId: r.payment_id,
        recordLabel: `${r.amount} ${r.currency} · ${r.status}`,
        sourceHint: r.order_ref === "" ? null : r.order_ref,
        sourceRowNumber: r.source_row_number,
      });
    }
    for (const r of rows.deliveries) {
      out.push({
        recordKey: makeRecordKey("delivery", r.delivery_id),
        recordType: "delivery",
        recordId: r.delivery_id,
        recordLabel: r.status,
        sourceHint: r.order_ref === "" ? null : r.order_ref,
        sourceRowNumber: r.source_row_number,
      });
    }
    for (const r of rows.refunds) {
      out.push({
        recordKey: makeRecordKey("refund", r.refund_id),
        recordType: "refund",
        recordId: r.refund_id,
        recordLabel: `${r.amount} · ${r.status}`,
        sourceHint: r.payment_ref === "" ? null : r.payment_ref,
        sourceRowNumber: r.source_row_number,
      });
    }
    out.sort((a, b) => a.recordKey.localeCompare(b.recordKey));
    return out;
  }, [parse]);

  const orderIds = useMemo(
    () => (parse?.validated_source_rows.orders ?? []).map((r) => r.order_id),
    [parse],
  );
  const paymentIds = useMemo(
    () => (parse?.validated_source_rows.payments ?? []).map((r) => r.payment_id),
    [parse],
  );
  const orderCount = parse?.row_counts.orders ?? 0;

  const targetsByRecord = useMemo(() => {
    const m = new Map<string, CommerceCatalogTarget[]>();
    for (const t of catalog) {
      const list = m.get(t.recordKey) ?? [];
      list.push(t);
      m.set(t.recordKey, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.targetId.localeCompare(b.targetId));
    return m;
  }, [catalog]);

  const baselinePreview: CommerceBaselinePreview = useMemo(
    () =>
      draft
        ? previewCommerceBaseline(
            draft,
            reviewRecords.map((r) => r.recordKey),
          )
        : { assignments: [], warnings: [] },
    [draft, reviewRecords],
  );
  const blocked = useMemo(
    () =>
      draft
        ? blockedCommerceRows(
            draft,
            catalog,
            reviewRecords.map((r) => r.recordKey),
          )
        : [],
    [draft, catalog, reviewRecords],
  );

  const adopted = validation !== null;
  const maxStage: Stage = !parse ? 1 : !validation ? 2 : !challenge ? 3 : 4;

  useEffect(() => {
    if (stage > maxStage) setStage(maxStage);
  }, [stage, maxStage]);

  const stageFocusArmed = useRef(false);
  useEffect(() => {
    if (!stageFocusArmed.current) {
      stageFocusArmed.current = true;
      return;
    }
    const el = stageHeadRef.current;
    el?.focus({ preventScroll: true });
    if (typeof el?.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
  }, [stage]);

  function gotoStage(n: Stage) {
    if (n <= maxStage && !busy) setStage(n);
  }
  function goBack(n: Stage) {
    if (n <= maxStage) setStage(n);
  }

  function fail(stageName: string, e: unknown) {
    setError({ stage: stageName, message: errText(e), missing: isCommerceRouterMissing(e) });
  }

  /** A 409 means the server moved without us; no endpoint can re-sync revisions. */
  function noteIfStale(e: unknown) {
    if (e instanceof CommerceApiError && e.code === "STALE_STATE") {
      setStaleNote(
        "Server rejected stale revisions — Clear and re-import to restart from authoritative server state.",
      );
    }
  }

  function invalidateFrom(point: "source" | "catalog" | "review" | "challenge" | "receipt") {
    if (point === "source") {
      setSuggest(null);
      setDraft(null);
      setValidation(null);
      setChallenge(null);
      setReceipt(null);
      setReplay(null);
    } else if (point === "catalog") {
      setValidation(null);
      setChallenge(null);
      setReceipt(null);
      setReplay(null);
    } else if (point === "review") {
      setChallenge(null);
      setReceipt(null);
      setReplay(null);
    } else if (point === "challenge") {
      setReceipt(null);
      setReplay(null);
    } else {
      setReplay(null);
    }
  }

  function touchDraft(next: CommerceDraftState) {
    setDraft(next);
    if (validation || challenge || receipt || replay) {
      setValidation(null);
      invalidateFrom("review");
      setStaleNote("Review edited after adoption — re-adopt your review to continue.");
    }
  }

  async function runImport() {
    const picked = COMMERCE_FILE_NAMES.map((n) => fileRefs.current[n]?.files?.[0] ?? null);
    if (picked.some((f) => !f) || busy) {
      setError({ stage: "Import", message: "SELECT_ALL_FOUR_CSV_FILES", missing: false });
      return;
    }
    const epoch = ++opEpoch.current;
    setBusy("import");
    setError(null);
    try {
      const loaded = await Promise.all(picked.map((f) => readUpload(f as File)));
      const bundle: CommerceFileBundle = {
        "orders.csv": { content_base64: loaded[0].b64 },
        "payments.csv": { content_base64: loaded[1].b64 },
        "deliveries.csv": { content_base64: loaded[2].b64 },
        "refunds.csv": { content_base64: loaded[3].b64 },
      };
      const res = await commerceParse(bundle);
      if (opEpoch.current !== epoch) return;
      const keys: string[] = [];
      for (const r of res.validated_source_rows.payments) keys.push(makeRecordKey("payment", r.payment_id));
      for (const r of res.validated_source_rows.deliveries) keys.push(makeRecordKey("delivery", r.delivery_id));
      for (const r of res.validated_source_rows.refunds) keys.push(makeRecordKey("refund", r.refund_id));
      keys.sort();
      setFiles({
        "orders.csv": loaded[0],
        "payments.csv": loaded[1],
        "deliveries.csv": loaded[2],
        "refunds.csv": loaded[3],
      });
      invalidateFrom("source");
      setParse(res);
      setServerRevisions({
        source_revision: res.source_revision,
        candidate_revision: res.candidate_revision,
        policy_revision: 0,
      });
      setDraft(emptyCommerceDraft(keys));
      setIsExample(false);
      setStaleNote(null);
      setStage(2);
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      fail("Import", e);
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  /** One-click fictional example: bundled bytes through the real parse route.
   *
   * Import and parse only. Nothing is permitted, adopted, attested, or solved:
   * the user lands in Review with an empty draft and makes every human
   * decision in the Workbench. Always starts a fresh investigation: prior
   * sessions, revisions, proofs, and receipts are discarded first.
   */
  async function runExample() {
    if (busy || importActive.current) return;
    importActive.current = true;
    const epoch = ++opEpoch.current;
    setBusy("import");
    setError(null);
    try {
      const bundle = fictionalCommerceBundle();
      const res = await commerceParse(bundle);
      if (opEpoch.current !== epoch) return;
      const keys: string[] = [];
      for (const r of res.validated_source_rows.payments) keys.push(makeRecordKey("payment", r.payment_id));
      for (const r of res.validated_source_rows.deliveries) keys.push(makeRecordKey("delivery", r.delivery_id));
      for (const r of res.validated_source_rows.refunds) keys.push(makeRecordKey("refund", r.refund_id));
      keys.sort();
      const bundled = loadFictionalCommerceFiles();
      setFiles({
        "orders.csv": { name: "orders.csv (fictional example)", text: bundled[0].text, b64: bundled[0].b64 },
        "payments.csv": { name: "payments.csv (fictional example)", text: bundled[1].text, b64: bundled[1].b64 },
        "deliveries.csv": { name: "deliveries.csv (fictional example)", text: bundled[2].text, b64: bundled[2].b64 },
        "refunds.csv": { name: "refunds.csv (fictional example)", text: bundled[3].text, b64: bundled[3].b64 },
      });
      invalidateFrom("source");
      setParse(res);
      setServerRevisions({
        source_revision: res.source_revision,
        candidate_revision: res.candidate_revision,
        policy_revision: 0,
      });
      setDraft(emptyCommerceDraft(keys));
      setIsExample(true);
      setStaleNote(null);
      setStage(2);
      for (const n of COMMERCE_FILE_NAMES) {
        if (fileRefs.current[n]) fileRefs.current[n]!.value = "";
      }
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      fail("Import", e);
    } finally {
      importActive.current = false;
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  function clearAll() {
    opEpoch.current += 1;
    setBusy(null);
    setIsExample(false);
    setFiles({ "orders.csv": null, "payments.csv": null, "deliveries.csv": null, "refunds.csv": null });
    setParse(null);
    setServerRevisions(null);
    invalidateFrom("source");
    setError(null);
    setStaleNote(null);
    for (const n of COMMERCE_FILE_NAMES) {
      if (fileRefs.current[n]) fileRefs.current[n]!.value = "";
    }
    setStage(1);
  }

  async function requestSuggest() {
    if (!parse || !draft || !serverRevisions || busy) return;
    if (!Number.isInteger(maxSuggestions) || maxSuggestions < 1 || maxSuggestions > 5) {
      setError({ stage: "Review", message: "MAX_SUGGESTIONS_MUST_BE_1_TO_5", missing: false });
      return;
    }
    const epoch = ++opEpoch.current;
    setBusy("suggest");
    setError(null);
    try {
      const res = await commerceSuggest({
        contract_version: COMMERCE_CONTRACT_VERSION,
        session_id: parse.session_id,
        expected_source_revision: serverRevisions.source_revision,
        expected_candidate_revision: serverRevisions.candidate_revision,
        expected_policy_revision: serverRevisions.policy_revision,
        mode: "META",
        max_suggestions: maxSuggestions,
      });
      if (opEpoch.current !== epoch) return;
      setSuggest(res);
      setServerRevisions({
        source_revision: res.source_revision,
        candidate_revision: res.candidate_revision,
        policy_revision: res.policy_revision,
      });
      if (res.catalog_changed) {
        invalidateFrom("catalog");
        setStaleNote(
          "New suggestions changed the candidate catalog — review every row again, then re-adopt.",
        );
      }
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      fail("Review", e);
      noteIfStale(e);
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  async function adoptReview() {
    if (!parse || !draft || !serverRevisions || busy) return;
    const k = draft.thresholdK;
    if (!Number.isInteger(k) || (k as number) < 1 || (k as number) > orderCount) {
      setError({
        stage: "Review",
        message: `THRESHOLD_K_MUST_BE_1_TO_${orderCount} — no request was sent`,
        missing: false,
      });
      return;
    }
    if (draft.reviewerLabel.trim().length === 0 || draft.reviewerLabel.length > 200) {
      setError({
        stage: "Review",
        message: "REVIEWER_LABEL_REQUIRED_1_TO_200_CHARS — no request was sent",
        missing: false,
      });
      return;
    }
    const a = draft.attestation;
    if (!a.all_rows_reviewed || !a.understands_bounded_predicate || !a.conflicting_source_ref_overrides_explained) {
      setError({ stage: "Review", message: "ATTESTATION_INCOMPLETE — no request was sent", missing: false });
      return;
    }
    const epoch = ++opEpoch.current;
    setBusy("adopt");
    setError(null);
    try {
      const serialized = serializeCommerceReview(draft, catalog, reviewRecords);
      const res = await commerceReviewValidate({
        contract_version: COMMERCE_CONTRACT_VERSION,
        session_id: parse.session_id,
        expected_source_revision: serverRevisions.source_revision,
        expected_candidate_revision: serverRevisions.candidate_revision,
        expected_policy_revision: serverRevisions.policy_revision,
        threshold_k: k as number,
        reviewer_label: draft.reviewerLabel,
        review_attestation: { ...draft.attestation },
        manual_candidates: serialized.manual_candidates,
        rows: serialized.rows,
        reference_mapping: serialized.reference_mapping,
      });
      if (opEpoch.current !== epoch) return;
      invalidateFrom("review");
      setValidation(res);
      setServerRevisions({
        source_revision: res.source_revision,
        candidate_revision: res.candidate_revision,
        policy_revision: res.policy_revision,
      });
      setStaleNote(null);
      setStage(3);
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      setValidation(null);
      invalidateFrom("review");
      fail("Review", e);
      noteIfStale(e);
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  async function runChallenge() {
    if (!parse || !validation || busy) return;
    if (!Number.isInteger(timeBudget) || timeBudget < 100 || timeBudget > 10000) {
      setError({
        stage: "Challenge",
        message: "TIME_BUDGET_MUST_BE_100_TO_10000_MS — no request was sent",
        missing: false,
      });
      return;
    }
    const epoch = ++opEpoch.current;
    setBusy("challenge");
    setError(null);
    try {
      const res = await commerceChallenge({
        contract_version: COMMERCE_CONTRACT_VERSION,
        session_id: parse.session_id,
        expected_source_revision: validation.source_revision,
        expected_candidate_revision: validation.candidate_revision,
        expected_policy_revision: validation.policy_revision,
        expected_review_sha256: validation.review_sha256,
        time_budget_ms: timeBudget,
      });
      if (opEpoch.current !== epoch) return;
      invalidateFrom("challenge");
      setChallenge(res);
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      setChallenge(null);
      invalidateFrom("challenge");
      fail("Challenge", e);
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  async function exportReceipt() {
    if (!parse || !validation || !challenge || busy) return;
    if (!isCommerceReceiptEligible(challenge)) return;
    const epoch = ++opEpoch.current;
    setBusy("receipt");
    setError(null);
    try {
      const res = await commerceReceipt({
        contract_version: COMMERCE_CONTRACT_VERSION,
        session_id: parse.session_id,
        run_id: challenge.run_id as string,
        expected_review_sha256: validation.review_sha256,
      });
      if (opEpoch.current !== epoch) return;
      setReplay(null);
      setReceipt(res);
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      fail("Verify", e);
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  async function replayReceipt() {
    if (!receipt || busy) return;
    const bundle: CommerceFileBundle | null =
      files["orders.csv"] && files["payments.csv"] && files["deliveries.csv"] && files["refunds.csv"]
        ? {
            "orders.csv": { content_base64: (files["orders.csv"] as LoadedFile).b64 },
            "payments.csv": { content_base64: (files["payments.csv"] as LoadedFile).b64 },
            "deliveries.csv": { content_base64: (files["deliveries.csv"] as LoadedFile).b64 },
            "refunds.csv": { content_base64: (files["refunds.csv"] as LoadedFile).b64 },
          }
        : null;
    if (!bundle) {
      setError({
        stage: "Verify",
        message: "ORIGINAL_FILES_REQUIRED_FOR_REPLAY — re-import the same four CSVs",
        missing: false,
      });
      return;
    }
    const epoch = ++opEpoch.current;
    setBusy("replay");
    setError(null);
    try {
      const res = await commerceReplay({
        contract_version: COMMERCE_CONTRACT_VERSION,
        receipt: receipt.receipt,
        files: bundle,
      });
      if (opEpoch.current !== epoch) return;
      setReplay(res);
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      fail("Verify", e);
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  function downloadReceipt() {
    if (!receipt) return;
    const blob = new Blob([JSON.stringify(receipt.receipt, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commerce-receipt-${String(receipt.receipt.receipt_sha256).slice(0, 12)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function addManual(recordKey: string, targetId: string, reason: string): string | null {
    if (!draft) return "Review is not ready.";
    if (!targetId) return "Enter a target ID first.";
    if (!reason) return "A reason is required for a manual candidate.";
    if (reason.length > 200) return "Reason must be 1–200 characters.";
    const isRefund = recordKey.startsWith("refund:");
    const known = isRefund ? paymentIds : orderIds;
    if (!known.includes(targetId)) return `Unknown ${isRefund ? "payment" : "order"} ID ${targetId}.`;
    const dupCatalog = catalog.some((t) => t.recordKey === recordKey && t.targetId === targetId);
    const dupDraft = draft.manual.some(
      (m) => makeRecordKey(m.record_type, m.record_id) === recordKey && m.target_id === targetId,
    );
    if (dupCatalog || dupDraft) return `${targetId} is already registered for ${recordKey}.`;
    const idx = recordKey.indexOf(":");
    const recordType = recordKey.slice(0, idx) as CommerceRecordType;
    const recordId = recordKey.slice(idx + 1);
    touchDraft({ ...draft, manual: [...draft.manual, { record_type: recordType, record_id: recordId, target_id: targetId, reason }] });
    return null;
  }

  function baselineOptionsFor(recordKey: string): CommerceBaselineOption[] {
    const row = draft?.edges[recordKey] ?? {};
    const targets = targetsByRecord.get(recordKey) ?? [];
    const unmatchedRule = draft?.unmatched[recordKey] ?? "PROHIBITED";
    const options: CommerceBaselineOption[] = targets.map((t) => {
      const d = row[t.targetId] ?? "PROHIBITED";
      return {
        value: t.targetId,
        label: t.targetId,
        allowed: d === "CONFIRMED" || d === "POSSIBLE",
      };
    });
    options.push({ value: null, label: "unmatched", allowed: unmatchedRule !== "PROHIBITED" });
    return options;
  }

  const challengeProblems = challenge ? validateCommerceResult(challenge.result) : [];
  const challengeCopy = challenge ? commerceStatusCopy(challenge.result.status) : null;
  const receiptEligible = isCommerceReceiptEligible(challenge);
  const replayVerified = replay?.verification_status === "VERIFIED_REPLAY";

  const verdictSummary = challengeCopy && challenge && challengeProblems.length === 0 ? (
    <p className="contextbar-verdict">
      <span
        className={`pill pill-${
          challengeCopy.tone === "reversed"
            ? "minimum-verified"
            : challengeCopy.tone === "stable"
              ? "scoped-result"
              : "inconclusive"
        }`}
      >
        {challenge.result.status}
      </span>{" "}
      <strong>{challengeCopy.headline}</strong>{" "}
      <span className="contextbar-counts">
        {challenge.result.baseline
          ? commerceDecisionText(
              challenge.result.baseline.clean_fulfilled_count,
              orderCount,
              challenge.result.threshold_k,
              challenge.result.baseline.decision,
            )
          : "No verified baseline."}
      </span>
    </p>
  ) : null;

  const landing = (
    <header className="hero hero-landing">
      <p className="kicker">Fictional worked example · local only · new</p>
      <h1>Are at least K of N orders cleanly fulfilled?</h1>
      <p className="lede">
        Four related files — orders, payments, deliveries, refunds — hold uncertain links. You set
        a threshold K, review every permitted link by hand, then test whether any permitted
        alternative crosses K, using only fictional data.
      </p>
      <p className="lede-sub">
        Exactly four CSVs. Cleanly fulfilled means one full same-currency SETTLED payment, one
        DELIVERED delivery, and no linked COMPLETED refund. K stays a draft until you adopt it.
      </p>
      <p className="lede-sub">{FICTIONAL_COMMERCE_BLURB}</p>
      <div className="row hero-cta">
        <button
          type="button"
          className="primary"
          onClick={() => void runExample()}
          disabled={busy === "import"}
        >
          {busy === "import" ? "Loading fictional example…" : "Explore fictional commerce example"}
        </button>
        <button
          type="button"
          onClick={() => {
            stageHeadRef.current?.focus({ preventScroll: true });
            stageHeadRef.current?.scrollIntoView?.({ block: "start" });
          }}
        >
          Upload my own four CSV files
        </button>
      </div>
      <p className="honest-label" role="status">
        Fictional demonstration data · not real business information · not yet analyzed
      </p>
      <p className="trust-line">
        AI suggests · You decide · Mathematics checks. Commerce results appear only after the real
        backend answers.
      </p>
    </header>
  );

  return (
    <ProductShell
      stage={stage}
      maxStage={maxStage}
      busy={busy}
      stages={COMMERCE_STAGES}
      hasStarted={!!parse}
      landing={landing}
      analysis={null}
      gotoStage={gotoStage}
      atlasSwitcher={<AtlasSwitcher value={scenario} onChange={onScenario} disabled={!!busy} />}
      contextQuestion={`Fictional commerce · ${COMMERCE_QUESTION}`}
      stageNow={COMMERCE_STAGE_NOW}
      verdictSummary={verdictSummary}
    >
      {error && (
        <div className="alert" role="alert" aria-live="assertive">
          <strong>{error.stage} failed:</strong> <code>{error.message}</code>{" "}
          {error.missing ? (
            <span>
              The Commerce API router is not integrated in this build (Chat A HQ integration
              pending). No analysis was run and no result is shown.
            </span>
          ) : (
            <span className="muted">Fix the cause above, then retry the same stage action.</span>
          )}
        </div>
      )}

      {stage === 1 && (
        <section aria-labelledby="h-c-import" className="card commerce">
          <h2 id="h-c-import" ref={stageHeadRef} tabIndex={-1}>
            1 · Import — Which four files are we testing?
          </h2>
          {!parse && (
            <>
              <p>
                Select exactly the four named CSVs. Files are read byte-exactly in your browser and
                sent only to the local backend for validation. Required headers:{" "}
                <code>order_id,customer_id,order_total,currency</code>,{" "}
                <code>payment_id,order_ref,amount,currency,status</code>,{" "}
                <code>delivery_id,order_ref,status</code>,{" "}
                <code>refund_id,payment_ref,amount,status</code> (1–50 orders, 0–60 rows per other
                file, max 64 KiB each).
              </p>
              <div className="file-grid">
                {COMMERCE_FILE_NAMES.map((name) => (
                  <label key={name}>
                    {name}{" "}
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      aria-label={`Upload ${name}`}
                      ref={(el) => {
                        fileRefs.current[name] = el;
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="row">
                <button type="button" onClick={runImport} disabled={busy === "import"}>
                  {busy === "import" ? "Parsing…" : "Import and parse four CSVs"}
                </button>
              </div>
              <p className="muted">
                Commerce API status is checked on first Import. If the backend router is not yet
                integrated, Import reports unavailable — nothing is fabricated.
              </p>
            </>
          )}
          {parse && (
            <>
              <p>
                Four commerce files parsed. Reloading or clearing invalidates all review, challenge,
                and receipt state. Original bytes are retained locally only for this session and
                replay.
              </p>
              <div className="row">
                <button type="button" className="primary" onClick={() => gotoStage(2)}>
                  Continue to Review
                </button>
                <button type="button" onClick={clearAll}>
                  Clear commerce import
                </button>
              </div>
              <div aria-live="polite">
                <CommerceSourceInspector parse={parse} catalog={catalog} adopted={adopted} />
              </div>
            </>
          )}
        </section>
      )}

      {stage === 2 && (
        <section aria-labelledby="h-c-review" className="card commerce">
          <h2 id="h-c-review" ref={stageHeadRef} tabIndex={-1}>
            2 · Review — Which links may be considered?
          </h2>
          <div className="row row-nav">
            <button type="button" onClick={() => goBack(1)}>← Back to Import</button>
          </div>
          {isExample && parse && (
            <p className="fiction-note" role="status">
              Fictional demonstration data · not real business information. {FICTIONAL_COMMERCE_BLURB}
            </p>
          )}
          <div className="decision-guide">
            <span className="guide-icon" aria-hidden="true">?</span>
            <div>
              <strong>Every link needs your explicit permission</strong>
              <p>
                Source references are hints, Meta entries are untrusted suggestions, and manual
                entries are your own proposals. Set each disposition yourself — only the Adopt
                action below records the review, and K freezes only then.
              </p>
            </div>
          </div>
          <ul className="legend" aria-label="How to read the links">
            <li><span className="swatch swatch-baseline" aria-hidden="true" /> Source hint — a reference written in the file</li>
            <li><span className="swatch swatch-suggested" aria-hidden="true" /> Possible link — permitted only after adoption below</li>
            <li><span className="swatch swatch-allowed" aria-hidden="true" /> Original baseline — the reported matching</li>
            <li><span className="swatch swatch-alternative" aria-hidden="true" /> Checked alternative — only after Challenge verifies it</li>
          </ul>

          {staleNote && (
            <p className="stale-note" role="status">{staleNote}</p>
          )}

          <div className="suggest-panel">
            <h3>Optional Meta suggestions (untrusted until adopted)</h3>
            <div className="row">
              <label>
                Max suggestions (1–5){" "}
                <input
                  type="number"
                  aria-label="Max suggestions"
                  min={1}
                  max={5}
                  value={maxSuggestions}
                  onChange={(e) => setMaxSuggestions(Number(e.target.value))}
                />
              </label>
              <button type="button" onClick={() => void requestSuggest()} disabled={busy === "suggest"}>
                {busy === "suggest" ? "Requesting…" : "Request Meta suggestions"}
              </button>
            </div>
            {suggest && (
              <div aria-live="polite">
                {suggest.ai_status === "AI_UNAVAILABLE" ? (
                  <p>
                    Meta status: <code>AI_UNAVAILABLE</code> — deterministic review continues below.
                    No permissions changed.
                  </p>
                ) : (
                  <>
                    <p>
                      Meta status: <code>AI_SUGGESTED</code> ({suggest.suggestions.length}{" "}
                      {suggest.suggestions.length === 1 ? "proposal" : "proposals"}). These are
                      unreviewed suggestions — they grant <strong>no permission</strong> until your
                      full review adopts them.
                    </p>
                    {suggest.model_call && (
                      <p className="muted">
                        Server-reported call: provider <code>{suggest.model_call.provider}</code>,
                        model <code>{suggest.model_call.model}</code> (server claim, not an
                        independently verified trace).
                      </p>
                    )}
                    {suggest.suggestions.length > 0 && (
                      <ul className="candidate-list">
                        {suggest.suggestions.map((s) => (
                          <li key={`${s.record_key}-${s.target_id}-${s.server_call_id}`}>
                            <code>{s.record_key}</code> → <code>{s.target_id}</code> ·{" "}
                            {s.catalog_effect} · <code>authorised=false</code>
                            <span className="meta-evidence">Server note: {s.evidence}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {suggest.rejected_proposals.length > 0 && (
                      <p className="muted">
                        Rejected proposals:{" "}
                        {suggest.rejected_proposals.map((r) => `${r.reason_code}×${r.count}`).join(", ")}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {draft && (
            <CommerceReviewEditor
              records={reviewRecords}
              targetsFor={(key) => targetsByRecord.get(key) ?? []}
              dispositionFor={(key, target) =>
                (draft.edges[key] ?? {})[target] ?? "PROHIBITED"
              }
              unmatchedFor={(key) => draft.unmatched[key] ?? "PROHIBITED"}
              onEdge={(key, target, d: CommerceDisposition) =>
                touchDraft(setCommerceEdge(draft, key, target, d))
              }
              onUnmatched={(key, d: CommerceDisposition) =>
                touchDraft(setCommerceUnmatched(draft, key, d))
              }
              onSeedRow={(key) => touchDraft(seedRowFromSourceRefs(draft, catalog, key))}
              baselineFor={(key) => draft.baseline[key]}
              baselineOptions={baselineOptionsFor}
              onBaseline={(key, target) => touchDraft(setCommerceBaseline(draft, key, target))}
              manual={draft.manual}
              onAddManual={addManual}
              onRemoveManual={(i) =>
                touchDraft({ ...draft, manual: draft.manual.filter((_, j) => j !== i) })
              }
              orderIds={orderIds}
              paymentIds={paymentIds}
              thresholdK={draft.thresholdK}
              orderCount={orderCount}
              onThresholdK={(k) => touchDraft({ ...draft, thresholdK: k })}
              reviewerLabel={draft.reviewerLabel}
              onReviewerLabel={(s) => touchDraft({ ...draft, reviewerLabel: s })}
              attestation={draft.attestation}
              onAttestation={(key, v) =>
                touchDraft({ ...draft, attestation: { ...draft.attestation, [key]: v } })
              }
              baselinePreview={baselinePreview}
              blockedRows={blocked}
              adoptedReviewSha={validation?.review_sha256 ?? null}
              isDirty={!adopted || staleNote !== null}
              epochs={{
                sourceRevision: serverRevisions?.source_revision ?? parse?.source_revision ?? 1,
                candidateRevision:
                  serverRevisions?.candidate_revision ?? parse?.candidate_revision ?? 1,
                policyRevision: serverRevisions?.policy_revision ?? 0,
              }}
              onAdopt={() => void adoptReview()}
              adoptBusy={busy === "adopt"}
            />
          )}
          {draft && reviewRecords.length > 0 && (
            <div className="row">
              <button
                type="button"
                onClick={() => touchDraft(seedAllSourceRefs(draft, catalog))}
              >
                Seed all source hints as possible (draft only)
              </button>
            </div>
          )}
          {validation && (
            <div aria-live="polite">
              <p>
                Reviewed and frozen: K={validation.threshold_k} · policy rev{" "}
                {validation.policy_revision} · candidates rev {validation.candidate_revision}
              </p>
              <details className="evidence-details">
                <summary>Technical evidence · frozen review record</summary>
                <p>
                  Status: <code>{validation.state}</code> · review{" "}
                  <code>{validation.review_sha256.slice(0, 12)}…</code> · policy{" "}
                  <code>{validation.policy_sha256.slice(0, 12)}…</code> · baseline{" "}
                  <code>{validation.baseline_sha256.slice(0, 12)}…</code>
                </p>
                <p>
                  Review preflight (not challenge proof): {validation.raw_worlds} raw worlds ·{" "}
                  {validation.admissible_worlds} admissible · {validation.invalid_worlds} invalid ·{" "}
                  {validation.variable_records} variable{" "}
                  {validation.variable_records === 1 ? "record" : "records"} · baseline{" "}
                  {validation.baseline_valid ? "valid" : "INVALID"}
                </p>
                <p className="muted">Authorised by: {validation.authorised_by}</p>
              </details>
              <div className="row">
                <button type="button" onClick={() => gotoStage(3)}>
                  Continue to Challenge
                </button>
              </div>
            </div>
          )}
          <div className="meta-box">
            <h3>Not yet available here</h3>
            <p>
              Live Meta verification traces are not shipped: this page only shows what the local
              backend server reports. Human review above is fully available without Meta.
            </p>
          </div>
        </section>
      )}

      {stage === 3 && (
        <section aria-labelledby="h-c-challenge" className="card commerce">
          <h2 id="h-c-challenge" ref={stageHeadRef} tabIndex={-1}>
            3 · Challenge — Could the conclusion reverse?
          </h2>
          <div className="row row-nav">
            <button type="button" onClick={() => goBack(2)}>← Back to Review</button>
          </div>
          <p>
            Fixed question: <strong>{COMMERCE_QUESTION}</strong>
          </p>
          {validation && (
            <p aria-live="polite">
              Frozen threshold: <strong>K={validation.threshold_k}</strong> of {orderCount}{" "}
              {orderCount === 1 ? "order" : "orders"} · review{" "}
              <code>{validation.review_sha256.slice(0, 12)}…</code>
            </p>
          )}
          <div className="row">
            <label>
              Time budget, ms (100–10000){" "}
              <input
                type="number"
                aria-label="Time budget in milliseconds"
                min={100}
                max={10000}
                value={timeBudget}
                onChange={(e) => setTimeBudget(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="primary"
              onClick={runChallenge}
              disabled={!validation || busy === "challenge"}
            >
              {busy === "challenge" ? "Running…" : "Run Challenge"}
            </button>
          </div>
          {challenge && (
            <div aria-live="polite">
              {challengeProblems.length > 0 ? (
                <div className="alert" role="alert">
                  <strong>Unverified contract error:</strong> the backend response contradicts the
                  frozen result shape, so no verdict is shown.
                  <ul>
                    {challengeProblems.map((p, i) => (
                      <li key={i}>
                        <code>{p}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                challengeCopy && (
                  <CommerceDecisionCanvas result={challenge.result} orderCount={orderCount} />
                )
              )}
              <div className="row">
                <button type="button" onClick={() => gotoStage(4)}>
                  Continue to Verify
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {stage === 4 && (
        <section aria-labelledby="h-c-verify" className="card commerce">
          <h2 id="h-c-verify" ref={stageHeadRef} tabIndex={-1}>
            4 · Verify — Can anyone reproduce it?
          </h2>
          <div className="row row-nav">
            <button type="button" onClick={() => goBack(3)}>← Back to Challenge</button>
          </div>
          {!challenge && <p className="muted">Run the Challenge first; receipts and replay unlock after.</p>}
          {challenge && (
            <ProofDrawer
              statusBlock={
                replayVerified && replay ? (
                  <div aria-live="polite">
                    <ol className="ladder" aria-label="Proof checks">
                      <li>
                        <strong>The receipt came from the current checked run.</strong>
                        <span>
                          {" "}Export succeeded only after exhaustive enumeration and independent
                          recomputation passed for this exact review.
                        </span>
                      </li>
                      <li>
                        <strong>Stateless replay recomputed the same outcome.</strong>
                        <span>
                          {" "}Source, policy, receipt integrity, and the independent checker all
                          report <code>MATCH</code>/<code>PASSED</code> on the original file bytes.
                        </span>
                      </li>
                      <li>
                        <strong>Historical receipt only.</strong>
                        <span>
                          {" "}Replay is consistency evidence from the saved receipt — it does not
                          restore a live session or prove signer authenticity.
                        </span>
                      </li>
                    </ol>
                  </div>
                ) : replay ? (
                  <div aria-live="polite">
                    <p>
                      Replay status: <code>{replay.verification_status}</code> — not verified. No
                      proof is claimed.
                    </p>
                  </div>
                ) : (
                  <p className="muted">
                    Export a receipt and run the replay below. The independent check is claimed only
                    after the backend replay succeeds — never before.
                  </p>
                )
              }
              actions={
                <>
                  <button
                    type="button"
                    className="primary"
                    onClick={exportReceipt}
                    disabled={!receiptEligible || busy === "receipt"}
                    title={
                      receiptEligible
                        ? "Export the current checked run"
                        : "Available only after a complete checker-passed run"
                    }
                  >
                    {busy === "receipt" ? "Exporting…" : "Export receipt"}
                  </button>
                  {receipt && (
                    <>
                      <button type="button" onClick={downloadReceipt}>
                        Download receipt JSON
                      </button>
                      <button type="button" onClick={replayReceipt} disabled={busy === "replay"}>
                        {busy === "replay" ? "Replaying…" : "Replay receipt"}
                      </button>
                    </>
                  )}
                </>
              }
              evidence={
                <>
                  {receipt && (
                    <div aria-live="polite">
                      <p>
                        Receipt: <code>{receipt.receipt.receipt_sha256.slice(0, 12)}…</code> · result{" "}
                        <code>{receipt.receipt.result.status}</code> ·{" "}
                        <code>{receipt.attestation}</code>
                      </p>
                      <p className="muted">
                        Consistency hash only, not a signature: integrity comparison without
                        authentication. Source bundle{" "}
                        <code>{receipt.receipt.source_bundle_sha256.slice(0, 12)}…</code> · policy{" "}
                        <code>{receipt.receipt.policy_sha256.slice(0, 12)}…</code> · engine{" "}
                        <code>{receipt.receipt.engine_identity}</code>.
                      </p>
                    </div>
                  )}
                  {replay && (
                    <div aria-live="polite">
                      <p>
                        Replay: <code>{replay.verification_status}</code> · source{" "}
                        <code>{replay.source_binding}</code> · policy{" "}
                        <code>{replay.policy_binding}</code> · integrity{" "}
                        <code>{replay.receipt_integrity}</code> · checker{" "}
                        <code>{replay.independent_checker}</code>
                      </p>
                      <p>
                        Recomputed baseline clean count: {replay.recomputed.baseline_clean_count}
                        {replay.recomputed.witness_clean_count !== null && (
                          <> · witness clean count: {replay.recomputed.witness_clean_count}</>
                        )}
                        {replay.recomputed.link_distance !== null && (
                          <> · link distance: {replay.recomputed.link_distance}</>
                        )}
                      </p>
                      <p className="muted">
                        Historical receipt only: {String(replay.historical_receipt_only)}.
                      </p>
                    </div>
                  )}
                </>
              }
              hasEvidence={!!(receipt || replay)}
            />
          )}
        </section>
      )}
    </ProductShell>
  );
}
