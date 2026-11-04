import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  changedWitnessRows,
  createReceipt,
  fetchSuggest,
  parseSource,
  runAnalysis,
  validateReview,
  verifyReceipt,
  type AnalyzeResponse,
  type ParseResponse,
  type ReceiptResponse,
  type ReviewValidateResponse,
  type SuggestResponse,
  type VerifyResponse,
} from "./lib/api";
import ProductShell from "./components/ProductShell";
import type { QueueRecord } from "./components/RecordQueue";
import ProofDrawer from "./components/ProofDrawer";
import DecisionAtlasExperience from "./components/DecisionAtlasExperience";
import { isReversibleVerdict } from "./lib/decisionView";
import { atlasToStage, buildEventChallengeExperience } from "./lib/atlasExperience";
import { EventRecordControls, EventReviewCommit } from "./components/EventRecordInspector";
import AtlasSwitcher, { type AtlasScenario } from "./components/AtlasSwitcher";
import CommerceAtlas from "./components/CommerceAtlas";
import {
  baselineToReferenceDraft,
  deriveBaseline,
  draftToReviewDraft,
  emptyDraft,
  seedFromShortlist,
  setEdgeStatus,
  setUnmatched,
  type DraftState,
} from "./lib/reviewDraft";
import {
  DEMO_ATTENDANCE_TEXT,
  DEMO_REFERENCE_TEXT,
  DEMO_REGISTRATIONS_TEXT,
  DEMO_REVIEW_POLICY_TEXT,
  DEMO60_ATTENDANCE_TEXT,
  DEMO60_REFERENCE_TEXT,
  DEMO60_REGISTRATIONS_TEXT,
  DEMO60_REVIEW_POLICY_TEXT,
  EXPECTED_ATT_SHA256,
  EXPECTED_REG_SHA256,
  EXPECTED60_ATT_SHA256,
  EXPECTED60_REG_SHA256,
  demo60Policy,
  demo60Reference,
  demo60SourcePayload,
  demoPolicy,
  demoReference,
  demoSourcePayload,
} from "./lib/demo";
import { bytesToBase64, previewCsv } from "./lib/encoding";
import "./App.css";
import "./DecisionAtlasSkin.css";
import "./components/DecisionAtlasBindings.css";

const FIXED_QUESTION = "Did Group A have more attendance records than Group B?";

type Stage = 1 | 2 | 3 | 4;

const STAGES: Array<{ n: Stage; label: string; help: string }> = [
  { n: 1, label: "Import", help: "Load the example" },
  { n: 2, label: "Review", help: "Allow matches" },
  { n: 3, label: "Challenge", help: "Test the answer" },
  { n: 4, label: "Verify", help: "Check the proof" },
];

function errText(e: unknown): string {
  if (e instanceof ApiError) return `${e.code} (HTTP ${e.status} at ${e.path})`;
  if (e instanceof Error) return e.message;
  return "UNKNOWN_ERROR";
}

export default function App() {
  const [sourceB64, setSourceB64] = useState<{ registrations_b64: string; attendance_b64: string } | null>(null);
  const [parse, setParse] = useState<ParseResponse | null>(null);
  const [suggest, setSuggest] = useState<SuggestResponse | null>(null);
  const [validation, setValidation] = useState<ReviewValidateResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [receipt, setReceipt] = useState<ReceiptResponse | null>(null);
  const [verify, setVerify] = useState<VerifyResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ stage: string; message: string } | null>(null);
  const [stage, setStage] = useState<Stage>(1);
  /** Decision Atlas scenario. Commerce mounts separately; event state persists. */
  const [scenario, setScenario] = useState<AtlasScenario>("event");
  /** Demo fixtures vs human-uploaded CSVs. Only the source cards and the
   * review path differ; Challenge/Verify consume the same validated state. */
  const [sourceKind, setSourceKind] = useState<"demo" | "demo60" | "custom">("demo");
  const [sourceText, setSourceText] = useState<{ reg: string; att: string } | null>(null);
  const [customNames, setCustomNames] = useState<{ reg: string; att: string } | null>(null);
  /** Human-edited review draft for custom sources; demo uses the prepared policy. */
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [staleNote, setStaleNote] = useState<string | null>(null);
  const regFileRef = useRef<HTMLInputElement>(null);
  const attFileRef = useRef<HTMLInputElement>(null);
  /**
   * Operation epoch: every async action captures the epoch at start and only
   * touches state when it is still current. Clearing or reloading the demo
   * bumps the epoch, so a stale out-of-order response can never repopulate
   * cleared state or overwrite a newer result.
   */
  const opEpoch = useRef(0);
  const stageHeadRef = useRef<HTMLHeadingElement>(null);

  const policy = useMemo(() => demoPolicy(), []);
  const reference = useMemo(() => demoReference(), []);
  const policy60 = useMemo(() => demo60Policy(), []);
  const reference60 = useMemo(() => demo60Reference(), []);
  /** Latest Atlas-inspected record (selection itself lives in the scene). */
  const [, setQueueSel] = useState<string | null>(null);

  /** Registration id → name/group, from the accepted parse (demo or upload). */
  const regTable = useMemo(() => {
    const m = new Map<string, { name: string; group: string }>();
    for (const r of parse?.registrations ?? []) {
      const id = r["registration_id"];
      if (id) m.set(id, { name: r["name"] ?? id, group: r["group"] ?? "?" });
    }
    return m;
  }, [parse]);
  /** Attendance id → recorded name, from the accepted parse (demo or upload). */
  const attTable = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of parse?.attendance ?? []) {
      const id = r["attendance_id"];
      if (id) m.set(id, r["recorded_name"] ?? id);
    }
    return m;
  }, [parse]);
  const regGroup = (id: string | null) => (id ? (regTable.get(id)?.group ?? "?") : "—");

  const adopted = validation !== null;

  /** Highest stage the current backend state legitimately unlocks. */
  const maxStage: Stage = !parse ? 1 : !validation ? 2 : !analysis ? 3 : 4;

  useEffect(() => {
    if (stage > maxStage) setStage(maxStage);
  }, [stage, maxStage]);

  const stageFocusArmed = useRef(false);
  /**
   * Move keyboard focus to the new stage heading after a user-driven stage
   * change. Skipped on first mount so the first keyboard Tab still lands on
   * the "Skip to main content" link instead of a programmatically focused heading.
   */
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

  /** Back navigation never mutates authority, so it stays available while busy. */
  function goBack(n: Stage) {
    if (n <= maxStage) setStage(n);
  }

  function invalidateFrom(stage_: "source" | "review" | "analysis" | "receipt") {
    if (stage_ === "source") {
      setSuggest(null);
      setValidation(null);
      setAnalysis(null);
      setReceipt(null);
      setVerify(null);
    } else if (stage_ === "review") {
      setAnalysis(null);
      setReceipt(null);
      setVerify(null);
    } else if (stage_ === "analysis") {
      setReceipt(null);
      setVerify(null);
    } else {
      setVerify(null);
    }
  }

  async function loadDemo() {
    const epoch = ++opEpoch.current;
    setBusy("import");
    setError(null);
    try {
      const payload = demoSourcePayload();
      const res = await parseSource(payload);
      if (opEpoch.current !== epoch) return;
      setSourceB64(payload);
      invalidateFrom("source");
      setParse(res);
      setSourceKind("demo");
      setSourceText({ reg: DEMO_REGISTRATIONS_TEXT, att: DEMO_ATTENDANCE_TEXT });
      setCustomNames(null);
      setDraft(null);
      setStaleNote(null);
      setQueueSel(null);
      setStage(2);
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      setError({ stage: "Import", message: errText(e) });
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  function clearDemo() {
    opEpoch.current += 1;
    setBusy(null);
    setSourceB64(null);
    setParse(null);
    invalidateFrom("source");
    setError(null);
    setSourceKind("demo");
    setSourceText(null);
    setCustomNames(null);
    setDraft(null);
    setStaleNote(null);
    setQueueSel(null);
    if (regFileRef.current) regFileRef.current.value = "";
    if (attFileRef.current) attFileRef.current.value = "";
    setStage(1);
  }

  /** Primary demonstration: the generated, independently verified 60/90 event. */
  async function loadDemo60() {
    const epoch = ++opEpoch.current;
    setBusy("import");
    setError(null);
    try {
      const payload = demo60SourcePayload();
      const res = await parseSource(payload);
      if (opEpoch.current !== epoch) return;
      setSourceB64(payload);
      invalidateFrom("source");
      setParse(res);
      setSourceKind("demo60");
      setSourceText({ reg: DEMO60_REGISTRATIONS_TEXT, att: DEMO60_ATTENDANCE_TEXT });
      setCustomNames(null);
      setDraft(null);
      setStaleNote(null);
      setQueueSel(null);
      setStage(2);
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      setError({ stage: "Import", message: errText(e) });
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  function readUpload(file: File): Promise<{ name: string; text: string; b64: string }> {
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

  /** Human CSV upload: both files are required; the backend validates contents. */
  async function loadCustom() {
    const regFile = regFileRef.current?.files?.[0] ?? null;
    const attFile = attFileRef.current?.files?.[0] ?? null;
    if (!regFile || !attFile || busy) {
      setError({ stage: "Import", message: "SELECT_BOTH_CSV_FILES" });
      return;
    }
    const epoch = ++opEpoch.current;
    setBusy("import");
    setError(null);
    try {
      const [reg, att] = await Promise.all([readUpload(regFile), readUpload(attFile)]);
      const payload = { registrations_b64: reg.b64, attendance_b64: att.b64 };
      const res = await parseSource(payload);
      if (opEpoch.current !== epoch) return;
      setSourceB64(payload);
      invalidateFrom("source");
      setParse(res);
      setSourceKind("custom");
      setSourceText({ reg: reg.text, att: att.text });
      setCustomNames({ reg: reg.name, att: att.name });
      const attIds = (res.attendance ?? [])
        .map((r) => r["attendance_id"])
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      setDraft(emptyDraft(attIds));
      setStaleNote(null);
      setQueueSel(null);
      setStage(2);
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      setError({ stage: "Import", message: errText(e) });
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  async function loadShortlist(): Promise<SuggestResponse | null> {
    if (!sourceB64 || busy) return null;
    const epoch = ++opEpoch.current;
    setBusy("suggest");
    setError(null);
    try {
      const res = await fetchSuggest(sourceB64);
      if (opEpoch.current !== epoch) return null;
      invalidateFrom("review");
      setSuggest(res);
      return res;
    } catch (e) {
      if (opEpoch.current !== epoch) return null;
      setError({ stage: "Review", message: errText(e) });
      return null;
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  /** Any draft edit after adoption invalidates downstream state (proven path). */
  function touchDraft(next: DraftState) {
    setDraft(next);
    if (validation || analysis || receipt || verify) {
      setValidation(null);
      invalidateFrom("review");
      setStaleNote("Policy edited after adoption — re-adopt your review to continue.");
    }
  }

  async function seedRow(attendanceId: string) {
    if (!draft || busy) return;
    let list = suggest;
    if (!list) {
      list = await loadShortlist();
      if (!list) return;
    }
    const cands = (list.shortlist.candidates ?? []).filter(
      (c) => c.attendance_id === attendanceId,
    );
    touchDraft(seedFromShortlist(draft, cands));
  }

  async function adoptCustom() {
    if (!sourceB64 || !draft || busy) return;
    const epoch = ++opEpoch.current;
    setBusy("adopt");
    setError(null);
    try {
      const attIds = Object.keys(draft.unmatched).sort();
      const baseline = deriveBaseline(draft, attIds);
      const res = await validateReview(
        sourceB64,
        draftToReviewDraft(draft),
        baselineToReferenceDraft(baseline),
      );
      if (opEpoch.current !== epoch) return;
      invalidateFrom("review");
      setValidation(res);
      setStaleNote(null);
      setStage(3);
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      setError({ stage: "Review", message: errText(e) });
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  async function adoptReview() {
    if (!sourceB64 || busy) return;
    const epoch = ++opEpoch.current;
    setBusy("adopt");
    setError(null);
    try {
      const res = await validateReview(sourceB64, effectivePolicy, effectiveReference);
      if (opEpoch.current !== epoch) return;
      invalidateFrom("review");
      setValidation(res);
      setStage(3);
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      setValidation(null);
      invalidateFrom("review");
      setError({ stage: "Review", message: errText(e) });
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  async function runChallenge() {
    if (!sourceB64 || !validation || busy) return;
    const epoch = ++opEpoch.current;
    setBusy("analyze");
    setError(null);
    try {
      const res = await runAnalysis({
        ...sourceB64,
        policy: effectivePolicy,
        reference: effectiveReference,
        expected_review_sha256: validation.review_sha256,
        expected_revision: validation.review_revision,
      });
      if (opEpoch.current !== epoch) return;
      invalidateFrom("analysis");
      setAnalysis(res);
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      // A failed fresh analysis must not leave the previous verdict visible.
      setAnalysis(null);
      invalidateFrom("analysis");
      setError({ stage: "Challenge", message: errText(e) });
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  async function issueReceipt() {
    if (!sourceB64 || !validation || busy) return;
    const epoch = ++opEpoch.current;
    setBusy("receipt");
    setError(null);
    try {
      const res = await createReceipt({
        ...sourceB64,
        policy: effectivePolicy,
        reference: effectiveReference,
        expected_review_sha256: validation.review_sha256,
        expected_revision: validation.review_revision,
      });
      if (opEpoch.current !== epoch) return;
      setVerify(null);
      setReceipt(res);
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      setError({ stage: "Verify", message: errText(e) });
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  async function replayVerify() {
    if (!sourceB64 || !receipt || busy) return;
    const epoch = ++opEpoch.current;
    setBusy("verify");
    setError(null);
    try {
      const res = await verifyReceipt(sourceB64, effectivePolicy, receipt.receipt);
      if (opEpoch.current !== epoch) return;
      setVerify(res);
    } catch (e) {
      if (opEpoch.current !== epoch) return;
      setError({ stage: "Verify", message: errText(e) });
    } finally {
      if (opEpoch.current === epoch) setBusy(null);
    }
  }

  const receiptFileName = receipt
    ? `joinwitness-receipt-${String(receipt.receipt.receipt_sha256).slice(0, 12)}.json`
    : "joinwitness-receipt.json";

  function downloadReceipt() {
    if (!receipt) return;
    const blob = new Blob([JSON.stringify(receipt.receipt, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = receiptFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const regText = sourceText?.reg ?? DEMO_REGISTRATIONS_TEXT;
  const attText = sourceText?.att ?? DEMO_ATTENDANCE_TEXT;
  const regPreview = previewCsv(regText);
  const attPreview = previewCsv(attText);
  /** Prepared digests pin to their manifests; uploads are backend-verified only. */
  const expectedReg = sourceKind === "demo60" ? EXPECTED60_REG_SHA256 : EXPECTED_REG_SHA256;
  const expectedAtt = sourceKind === "demo60" ? EXPECTED60_ATT_SHA256 : EXPECTED_ATT_SHA256;
  const regHashOk =
    sourceKind === "custom"
      ? null
      : parse?.registrations_digest.raw_sha256 === expectedReg;
  const attHashOk =
    sourceKind === "custom"
      ? null
      : parse?.attendance_digest.raw_sha256 === expectedAtt;
  /** Challenge/Verify authority: demo uses the prepared artifacts, custom
   * uploads use the human-adopted draft and its derived baseline. */
  const customPolicy = useMemo(
    () => (draft ? draftToReviewDraft(draft) : null),
    [draft],
  );
  const customReference = useMemo(() => {
    if (!draft) return null;
    return baselineToReferenceDraft(
      deriveBaseline(draft, Object.keys(draft.unmatched).sort()),
    );
  }, [draft]);
  /** Prepared 60/90 artifacts; custom uploads use the adopted human draft. */
  const preparedPolicy = sourceKind === "demo60" ? policy60 : policy;
  const preparedReference = sourceKind === "demo60" ? reference60 : reference;
  const effectivePolicy = sourceKind === "custom" && customPolicy ? customPolicy : preparedPolicy;
  const effectiveReference =
    sourceKind === "custom" && customReference ? customReference : preparedReference;
  const witnessChanged = analysis
    ? changedWitnessRows(effectiveReference.assignments, analysis.witness_assignments)
    : [];
  /** A checked reversibility verdict exists only after /api/analyze says so. */
  const reversible = isReversibleVerdict(analysis?.verdict);
  /** Original baseline registration per attendance record, from the active reference. */
  const baselineByAtt = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const a of effectiveReference.assignments) m.set(a.attendance_id, a.registration_id);
    return m;
  }, [effectiveReference]);
  /** Review working surface: every attendance record with its permitted candidates. */
  const queueRecords: QueueRecord[] = useMemo(() => {
    const byAtt = new Map<
      string,
      Array<{ rid: string; name: string; group: string; status: "CONFIRMED" | "POSSIBLE" }>
    >();
    for (const e of effectivePolicy.edges) {
      if (e.status !== "CONFIRMED" && e.status !== "POSSIBLE") continue;
      const info = regTable.get(e.registration_id);
      const list = byAtt.get(e.attendance_id) ?? [];
      list.push({
        rid: e.registration_id,
        name: info?.name ?? e.registration_id,
        group: info?.group ?? "?",
        status: e.status,
      });
      byAtt.set(e.attendance_id, list);
    }
    return [...attTable.entries()].map(([attendanceId, recordedName]) => {
      const candidates = byAtt.get(attendanceId) ?? [];
      const settled =
        candidates.length === 1 &&
        effectivePolicy.edges.some(
          (e) =>
            e.attendance_id === attendanceId &&
            e.registration_id === candidates[0].rid &&
            e.status === "CONFIRMED",
        );
      const changed = witnessChanged.find((c) => c.attendance_id === attendanceId);
      return {
        attendanceId,
        recordedName,
        candidates,
        resolved: settled,
        baselineReg: baselineByAtt.get(attendanceId) ?? null,
        alternativeReg: reversible && changed ? (changed.to ?? null) : null,
      };
    });
  }, [effectivePolicy, attTable, regTable, baselineByAtt, witnessChanged, reversible]);
  /** Custom-source queue: draft edges (non-prohibited) with derived baseline. */
  const customQueueRecords: QueueRecord[] = useMemo(() => {
    if (sourceKind !== "custom" || !draft) return [];
    const derived = customReference
      ? new Map(customReference.assignments.map((a) => [a.attendance_id, a.registration_id]))
      : new Map<string, string | null>();
    return [...attTable.entries()].map(([attendanceId, recordedName]) => {
      const row = draft.edges[attendanceId] ?? {};
      const candidates = Object.keys(row)
        .filter((rid) => row[rid] === "CONFIRMED" || row[rid] === "POSSIBLE")
        .sort()
        .map((rid) => ({
          rid,
          name: regTable.get(rid)?.name ?? rid,
          group: regTable.get(rid)?.group ?? "?",
          status: row[rid] as "CONFIRMED" | "POSSIBLE",
        }));
      const confirmed = Object.keys(row).filter((rid) => row[rid] === "CONFIRMED");
      const changed = witnessChanged.find((c) => c.attendance_id === attendanceId);
      return {
        attendanceId,
        recordedName,
        candidates,
        resolved: confirmed.length === 1 && candidates.length === 1,
        baselineReg: derived.get(attendanceId) ?? null,
        alternativeReg: reversible && changed ? (changed.to ?? null) : null,
      };
    });
  }, [sourceKind, draft, customReference, attTable, regTable, witnessChanged, reversible]);
  const activeQueueRecords = sourceKind === "custom" ? customQueueRecords : queueRecords;
  /** Shortlist suggestions grouped by attendance (advisory only, unreviewed). */
  const shortlistByAtt = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of suggest?.shortlist.candidates ?? []) {
      const list = m.get(c.attendance_id) ?? [];
      if (!list.includes(c.registration_id)) list.push(c.registration_id);
      m.set(c.attendance_id, list);
    }
    return m;
  }, [suggest]);
  const customBaseline = useMemo(
    () => (draft ? deriveBaseline(draft, Object.keys(draft.unmatched).sort()) : null),
    [draft],
  );
  const replayOk = verify?.status === "VERIFIED_REPLAY";
  const evidenceMismatch =
    replayOk && receipt && analysis
    ? verify!.verdict !== String(receipt.receipt.verdict) ||
      verify!.verdict !== analysis.verdict ||
      String(receipt.receipt.verdict) !== analysis.verdict ||
      verify!.receipt_sha256 !== String(receipt.receipt.receipt_sha256)
    : false;
  const replayVerdict =
    !evidenceMismatch && replayOk && verify ? verify.verdict : null;
  const replayBasis =
    !evidenceMismatch && replayOk && verify ? verify.proof_basis : null;

  const eventAtlasProps = buildEventChallengeExperience({
    queueRecords: activeQueueRecords,
    witnessChanged,
    validation,
    analysis,
    verify,
    replayOk,
    evidenceMismatch,
    sourceKind,
    sourceCounts: {
      attendance: parse?.attendance_digest.row_count ?? 0,
      registrations: parse?.registrations_digest.row_count ?? 0,
    },
    stage,
    maxStage,
  });

  const landing = (
    <header className="hero hero-landing">
      <p className="kicker">Fictional worked example · local only</p>
      <h1>Can one uncertain match change who came out ahead?</h1>
      <p className="lede">A report says Group A attended more. This page tests whether one human-permitted rematch could reverse that answer, using only fictional data.</p>
      <figure className="entry-figure" aria-label="Illustration of one uncertain record with two candidates">
        <svg viewBox="0 0 320 132" role="img" aria-hidden="true">
          <rect x="8" y="46" width="104" height="40" rx="8" className="fig-source" />
          <text x="60" y="63" textAnchor="middle" className="fig-id fig-on-dark">T-02</text>
          <text x="60" y="78" textAnchor="middle" className="fig-sub fig-on-dark">Kim/Kym Rao</text>
          <line x1="112" y1="58" x2="196" y2="30" className="fig-link fig-link-base" />
          <line x1="112" y1="68" x2="196" y2="102" className="fig-link fig-link-alt" />
          <rect x="196" y="12" width="116" height="36" rx="8" className="fig-cand" />
          <text x="254" y="28" textAnchor="middle" className="fig-id">R-A2 · A</text>
          <text x="254" y="41" textAnchor="middle" className="fig-sub">reported link</text>
          <rect x="196" y="84" width="116" height="36" rx="8" className="fig-cand fig-cand-alt" />
          <text x="254" y="100" textAnchor="middle" className="fig-id">R-B2 · B</text>
          <text x="254" y="113" textAnchor="middle" className="fig-sub">allowed alternative</text>
        </svg>
        <figcaption>Example — not analysed</figcaption>
      </figure>
      <p className="lede-sub">
        Primary demonstration: 60 attendance records · 90 registrations · 12
        ambiguous matches from the independently verified synthetic event. A
        3-record tutorial and your own CSVs remain available.
      </p>
      <div className="row hero-cta">
        <button type="button" className="primary" onClick={loadDemo60} disabled={busy === "import"}>
          {busy === "import" ? "Loading demo…" : "Explore the verified event"}
        </button>
        <button type="button" onClick={loadDemo} disabled={busy === "import"}>
          Try the fictional example
        </button>
        <button
          type="button"
          onClick={() => {
            stageHeadRef.current?.focus({ preventScroll: true });
            stageHeadRef.current?.scrollIntoView?.({ block: "start" });
          }}
        >
          Use my CSVs
        </button>
      </div>
      <p className="muted csvs-note">…or bring your own two CSVs in Import below.</p>
      <p className="honest-label" role="status">Fictional example · not yet analyzed</p>
      <p className="trust-line">AI suggests · You decide · Mathematics checks. Browser Meta assistance is not yet enabled.</p>
    </header>
  );

  if (scenario === "commerce") {
    return <CommerceAtlas scenario={scenario} onScenario={setScenario} />;
  }

  return (
    <ProductShell
      atlasMode="event"
      bare={true}
      stage={stage}
      maxStage={maxStage}
      busy={busy}
      stages={STAGES}
      hasStarted={!!parse}
      landing={landing}
      analysis={analysis}
      gotoStage={gotoStage}
      atlasSwitcher={<AtlasSwitcher value={scenario} onChange={setScenario} disabled={!!busy} />}
    >
        {error && (
          <div className="alert" role="alert" aria-live="assertive">
            <strong>{error.stage} failed:</strong> <code>{error.message}</code>{" "}
            <span className="muted">Fix the cause above, then retry the same stage action.</span>
          </div>
        )}

        {stage === 1 && (
          <>
            <DecisionAtlasExperience
              {...eventAtlasProps}
              onStage={(s) => gotoStage(atlasToStage(s))}
              onSelectRecord={setQueueSel}
              primaryAction={
                <div className="atlas-actions">
                  <h2 id="h-import" ref={stageHeadRef} tabIndex={-1}>1 · Import — What are we comparing?</h2>
                  {!parse && (
                    <>
                      <p className="kicker">Fictional worked example · local only</p>
                      <p className="lede">A report says Group A attended more. This page tests whether one human-permitted rematch could reverse that answer, using only fictional data.</p>
                      <p className="lede-sub">
                        Primary demonstration: 60 attendance records · 90 registrations · 12
                        ambiguous matches from the independently verified synthetic event. A
                        3-record tutorial and your own CSVs remain available.
                      </p>
                      <div className="row hero-cta">
                        <button type="button" className="primary" onClick={loadDemo60} disabled={busy === "import"}>
                          {busy === "import" ? "Loading demo…" : "Explore the verified event"}
                        </button>
                        <button type="button" onClick={loadDemo} disabled={busy === "import"}>
                          Try the fictional example
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            stageHeadRef.current?.focus({ preventScroll: true });
                            stageHeadRef.current?.scrollIntoView?.({ block: "start" });
                          }}
                        >
                          Use my CSVs
                        </button>
                      </div>
                      <p className="muted csvs-note">…or bring your own two CSVs in Import below.</p>
                      <p className="honest-label" role="status">Fictional example · not yet analyzed</p>
                      <p className="trust-line">AI suggests · You decide · Mathematics checks. Browser Meta assistance is not yet enabled.</p>
                      <p>
                        Start with the bundled fictional event, or bring your own two CSVs.
                        Uploads stay local: files are read in your browser and sent only to
                        the local backend for validation. Required headers:{" "}
                        <code>registration_id,name,group</code> and{" "}
                        <code>attendance_id,recorded_name</code> (max 150 / 100 rows).
                      </p>
                      <div className="upload-grid">
                        <label>
                          registrations.csv{" "}
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            aria-label="Upload registrations CSV"
                            ref={regFileRef}
                          />
                        </label>
                        <label>
                          attendance.csv{" "}
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            aria-label="Upload attendance CSV"
                            ref={attFileRef}
                          />
                        </label>
                      </div>
                      <div className="row">
                        <button type="button" onClick={loadCustom} disabled={busy === "import"}>
                          {busy === "import" ? "Parsing…" : "Upload and parse my CSVs"}
                        </button>
                      </div>
                    </>
                  )}
                  {parse && (
                    <>
                      <p>
                        {sourceKind === "demo60"
                          ? "Verified 60/90 demonstration source (generated seed 20261031). "
                          : sourceKind === "demo"
                            ? "Fictional demo source. "
                            : `Your uploads: ${customNames?.reg ?? "registrations.csv"} + ${customNames?.att ?? "attendance.csv"}. `}
                        Reloading or clearing invalidates all review, analysis and receipt state.
                      </p>
                      <div className="row">
                        <button type="button" className="primary" onClick={() => gotoStage(2)}>
                          Continue to Review
                        </button>
                        <button type="button" onClick={clearDemo}>
                          Clear{" "}
                          {sourceKind === "demo60"
                            ? "demonstration"
                            : sourceKind === "demo"
                              ? "demo"
                              : "upload"}
                        </button>
                      </div>
                      <div aria-live="polite">
                        <p>
                          Status: <code>{parse.status}</code> · Registrations:{" "}
                          <strong>{parse.registrations_digest.row_count}</strong> · Attendance:{" "}
                          <strong>{parse.attendance_digest.row_count}</strong>
                        </p>
                      </div>
                    </>
                  )}
                </div>
              }
            />
            <section className="atlas-supplement" aria-label="Import details">
              {!parse && (
                <figure className="entry-figure" aria-label="Illustration of one uncertain record with two candidates">
                  <svg viewBox="0 0 320 132" role="img" aria-hidden="true">
                    <rect x="8" y="46" width="104" height="40" rx="8" className="fig-source" />
                    <text x="60" y="63" textAnchor="middle" className="fig-id fig-on-dark">T-02</text>
                    <text x="60" y="78" textAnchor="middle" className="fig-sub fig-on-dark">Kim/Kym Rao</text>
                    <line x1="112" y1="58" x2="196" y2="30" className="fig-link fig-link-base" />
                    <line x1="112" y1="68" x2="196" y2="102" className="fig-link fig-link-alt" />
                    <rect x="196" y="12" width="116" height="36" rx="8" className="fig-cand" />
                    <text x="254" y="28" textAnchor="middle" className="fig-id">R-A2 · A</text>
                    <text x="254" y="41" textAnchor="middle" className="fig-sub">reported link</text>
                    <rect x="196" y="84" width="116" height="36" rx="8" className="fig-cand fig-cand-alt" />
                    <text x="254" y="100" textAnchor="middle" className="fig-id">R-B2 · B</text>
                    <text x="254" y="113" textAnchor="middle" className="fig-sub">allowed alternative</text>
                  </svg>
                  <figcaption>Example — not analysed</figcaption>
                </figure>
              )}
              {parse && (
                <div aria-live="polite">
                  <div className="source-cards">
                    <div className="source-card">
                      <h3>Registrations</h3>
                      <p className="source-count">
                        <strong>{parse.registrations_digest.row_count}</strong> rows · SHA-256{" "}
                        <code>{parse.registrations_digest.raw_sha256.slice(0, 12)}…</code>{" "}
                        {regHashOk === null
                          ? "(your upload — verified by the backend)"
                          : regHashOk
                            ? sourceKind === "demo60"
                              ? "(matches generated manifest)"
                              : "(matches bundled original)"
                            : "(MISMATCH — reload the example)"}
                      </p>
                      <details className="evidence-details">
                        <summary>Preview registrations.csv</summary>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>{regPreview.header.map((h) => <th key={h}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                              {regPreview.rows.map((r, i) => (
                                <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="muted mono-wrap">{parse.registrations_digest.raw_sha256}</p>
                      </details>
                    </div>
                    <div className="source-card">
                      <h3>Attendance</h3>
                      <p className="source-count">
                        <strong>{parse.attendance_digest.row_count}</strong> rows · SHA-256{" "}
                        <code>{parse.attendance_digest.raw_sha256.slice(0, 12)}…</code>{" "}
                        {attHashOk === null
                          ? "(your upload — verified by the backend)"
                          : attHashOk
                            ? sourceKind === "demo60"
                              ? "(matches generated manifest)"
                              : "(matches bundled original)"
                            : "(MISMATCH — reload the example)"}
                      </p>
                      <details className="evidence-details">
                        <summary>Preview attendance.csv</summary>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>{attPreview.header.map((h) => <th key={h}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                              {attPreview.rows.map((r, i) => (
                                <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="muted mono-wrap">{parse.attendance_digest.raw_sha256}</p>
                      </details>
                    </div>
                  </div>
                  <p className="muted">
                    Source: bundled fictional fixtures. Group A: Amara Shah, Kim Rao. Group B: Bryn Ellis,
                    Kym Rao. Reloading or clearing the demo invalidates all review, analysis and receipt state.
                  </p>
                </div>
              )}
            </section>
          </>
        )}

        {stage === 2 && (
          <>
            <DecisionAtlasExperience
              {...eventAtlasProps}
              onStage={(s) => gotoStage(atlasToStage(s))}
              onSelectRecord={setQueueSel}
              inspectorActions={
                sourceKind === "custom" && draft
                  ? (record) => {
                      const att = record.id;
                      const row = draft.edges[att] ?? {};
                      const cands = Object.keys(row)
                        .sort()
                        .map((rid) => ({
                          rid,
                          name: regTable.get(rid)?.name ?? rid,
                          group: regTable.get(rid)?.group ?? "?",
                          status: row[rid],
                        }));
                      return (
                        <form aria-label="Decision inspector" onSubmit={(e) => e.preventDefault()}>
                          <EventRecordControls
                            attendanceId={att}
                            recordedName={attTable.get(att) ?? att}
                            candidates={cands}
                            unmatched={draft.unmatched[att] ?? "ALLOWED"}
                            shortlist={shortlistByAtt.get(att) ?? []}
                            onEdgeStatus={(rid, status) =>
                              touchDraft(setEdgeStatus(draft, att, rid, status))
                            }
                            onUnmatched={(status) => touchDraft(setUnmatched(draft, att, status))}
                            onSeedRow={() => void seedRow(att)}
                            onAddCandidate={(rid) => {
                              if (!rid) return "Enter a registration ID first.";
                              if (!regTable.has(rid)) return `Unknown registration ID ${rid}.`;
                              if ((draft.edges[att] ?? {})[rid]) return `${rid} is already listed.`;
                              touchDraft(setEdgeStatus(draft, att, rid, "POSSIBLE"));
                              return null;
                            }}
                          />
                        </form>
                      );
                    }
                  : undefined
              }
              primaryAction={
                <div className="atlas-actions">
                  <div className="row row-nav">
                    <button type="button" onClick={() => goBack(1)}>← Back to Import</button>
                  </div>
                  <h2 id="h-review" ref={stageHeadRef} tabIndex={-1}>2 · Review — Which links are legitimately possible?</h2>
                  <div className="decision-guide"><span className="guide-icon" aria-hidden="true">?</span><div>{sourceKind === "demo60" ? (<><strong>Twelve genuinely ambiguous records</strong><p>Twelve attendance records each match two or more people across the groups — for example T-49 could be R-A07 or R-B12. A candidate is only a possibility, never an approval.</p></>) : (<><strong>The important ambiguity: Kim / Kym Rao</strong><p>For one attendance record, two different people could be a permissible match — one in each group. A candidate is only a possibility, never an approval.</p></>)}</div></div>
                  <p className="muted" aria-live="polite">
                    {adopted
                      ? "Each candidate is permitted under this example's reviewed policy. Only the explicit adoption below records the review decision."
                      : "Each candidate is a possible link awaiting review — not yet permitted — adoption required. Viewing or selecting it grants no permission."}
                  </p>
                  {sourceKind === "demo" ? (
                    <p className="muted">
                      The prepared policy below is a clearly identified <strong>fictional sample</strong>, not
                      independent human verification of real people. Selecting a record or candidate
                      only inspects it — only the explicit adoption button below records the review
                      decision.
                    </p>
                  ) : (
                    <p className="muted">
                      Your uploads are being reviewed by you, the human in this browser. Shortlist
                      entries are advisory only; every permission below is your explicit decision
                      until you adopt it.
                    </p>
                  )}
                  {staleNote && (
                    <p className="stale-note" role="status">
                      {staleNote}
                    </p>
                  )}
                  <div className="row">
                    <button type="button" onClick={() => void loadShortlist()} disabled={busy === "suggest"}>
                      {busy === "suggest" ? "Fetching…" : "Fetch deterministic shortlist"}
                    </button>
                  </div>
                  {sourceKind === "demo" || sourceKind === "demo60" || !draft ? (
                    <>
                      <h3>
                        {sourceKind === "demo60"
                          ? "Use the prepared 60/90 review for this demonstration"
                          : "Use the prepared review for this example"}
                      </h3>
                      <p className="muted">
                        {sourceKind === "demo60"
                          ? "This is the prepared synthetic policy and baseline for the generated 60-attendance event (seed 20261031). Adopting them replays the demonstration — it is not independent verification of any real identity, and viewing never approves anything."
                          : "These are the already-authored synthetic policy and baseline. Adopting them is not independent verification of any real identity."}
                      </p>
                      <div className="row">
                        <button
                          type="button"
                          className="primary"
                          onClick={adoptReview}
                          disabled={busy === "adopt"}
                        >
                          {busy === "adopt"
                            ? "Validating…"
                            : sourceKind === "demo60"
                              ? "Adopt the verified 60/90 review rules"
                              : "Adopt fictional review rules"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <EventReviewCommit
                      coverage={draft.coverage === "REVIEWED_CLOSED_SCOPE" ? draft.coverage : "REVIEWED_PARTIAL"}
                      onCoverage={(c) =>
                        touchDraft({ ...draft, coverage: c, attested: c === "REVIEWED_CLOSED_SCOPE" ? draft.attested : false })
                      }
                      scopeNote={draft.scopeNote}
                      onScopeNote={(s) => touchDraft({ ...draft, scopeNote: s })}
                      attested={draft.attested}
                      onAttested={(b) => touchDraft({ ...draft, attested: b })}
                      baseline={customBaseline ?? { assignments: [], warnings: [] }}
                      onAdopt={() => void adoptCustom()}
                      adoptBusy={busy === "adopt"}
                    />
                  )}
                  {validation && (
                    <div aria-live="polite">
                      <p>
                        Reviewed: baseline A={validation.baseline_counts?.a} B=
                        {validation.baseline_counts?.b} (A&gt;B:{" "}
                        {String(validation.baseline_counts?.a_greater_than_b)})
                      </p>
                      <details className="evidence-details">
                        <summary>Technical evidence · review record</summary>
                        <p>
                          Status: <code>{validation.status}</code> · coverage{" "}
                          <code>{validation.coverage}</code> · review{" "}
                          <code>{validation.review_sha256.slice(0, 12)}…</code> rev{" "}
                          {validation.review_revision} · reference{" "}
                          <code>{validation.reference_sha256?.slice(0, 12)}…</code>
                        </p>
                      </details>
                      <div className="row">
                        <button type="button" onClick={() => gotoStage(3)}>
                          Continue to Challenge
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              }
            />
            <section className="atlas-supplement" aria-label="Review details">
              <ul className="legend" aria-label="How to read the links">
                <li><span className="swatch swatch-baseline" aria-hidden="true" /> Confirmed link — settled by the prepared fictional policy</li>
                <li><span className="swatch swatch-suggested" aria-hidden="true" /> Possible link — a permitted alternative, allowed only after adoption below</li>
                <li><span className="swatch swatch-allowed" aria-hidden="true" /> Original baseline — the reported matching</li>
                <li><span className="swatch swatch-alternative" aria-hidden="true" /> Checked alternative — only after Challenge verifies it</li>
              </ul>
              {suggest && (
                <div aria-live="polite">
                  <p>
                    Shortlist status: <code>UNREVIEWED_SHORTLIST</code> (backend reports{" "}
                    <code>{suggest.model_status}</code>). These are unreviewed suggestions from
                    the deterministic shortlist — they grant <strong>no permission</strong> and
                    decide nothing.
                  </p>
                  <p className="muted">
                    Partial-coverage caveat: only explicitly reviewed pairs constrain the analysis.
                  </p>
                  <ul className="candidate-list">
                    {(suggest.shortlist.candidates ?? []).map((c) => (
                      <li key={`${c.attendance_id}-${c.registration_id}`}>
                        <code>{c.attendance_id}</code> ↔ <code>{c.registration_id}</code> (Group{" "}
                        {regGroup(c.registration_id)})<code> — unreviewed</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(sourceKind === "demo" || sourceKind === "demo60") && (
                <>
                  <details className="evidence-details">
                    <summary>Advanced · review_policy.json (jw.review.v1)</summary>
                    <pre>
                      {sourceKind === "demo60" ? DEMO60_REVIEW_POLICY_TEXT : DEMO_REVIEW_POLICY_TEXT}
                    </pre>
                  </details>
                  <details className="evidence-details">
                    <summary>Advanced · reference.json (jw.reference.v1)</summary>
                    <pre>
                      {sourceKind === "demo60" ? DEMO60_REFERENCE_TEXT : DEMO_REFERENCE_TEXT}
                    </pre>
                  </details>
                </>
              )}
              <div className="meta-box">
                <h3>Not yet available here</h3>
                <p>
                  The Meta browser integration is not shipped: this page makes zero
                  Meta requests. Human review of your own CSVs above is available;
                  the prepared fictional policy remains demo-only.
                </p>
              </div>
            </section>
          </>
        )}

        {stage === 3 && (
          <DecisionAtlasExperience
            {...buildEventChallengeExperience({
              queueRecords: activeQueueRecords,
              witnessChanged,
              validation,
              analysis,
              verify,
              replayOk,
              evidenceMismatch,
              sourceKind,
              sourceCounts: {
                attendance: parse?.attendance_digest.row_count ?? 0,
                registrations: parse?.registrations_digest.row_count ?? 0,
              },
              stage,
              maxStage,
            })}
            onStage={(s) => gotoStage(atlasToStage(s))}
            onSelectRecord={setQueueSel}
            primaryAction={
              <div className="atlas-actions">
                <div className="row row-nav">
                  <button type="button" onClick={() => goBack(2)}>← Back to Review</button>
                </div>
                <p>
                  Fixed question: <strong>{FIXED_QUESTION}</strong>
                </p>
                {validation && (
                  <p aria-live="polite">
                    Reference baseline (verified): A={validation.baseline_counts?.a} B=
                    {validation.baseline_counts?.b} → A greater than B:{" "}
                    <strong>{String(validation.baseline_counts?.a_greater_than_b)}</strong>
                  </p>
                )}
                <div className="row">
                  <button type="button" className="primary" onClick={runChallenge} disabled={!validation || busy === "analyze"}>
                    {busy === "analyze" ? "Running…" : "Run Challenge"}
                  </button>
                  {analysis && (
                    <button type="button" onClick={() => gotoStage(4)}>
                      Continue to Verify
                    </button>
                  )}
                </div>
              </div>
            }
          />
        )}

        {stage === 4 && (
          <>
            <DecisionAtlasExperience
              {...eventAtlasProps}
              onStage={(s) => gotoStage(atlasToStage(s))}
              onSelectRecord={setQueueSel}
              primaryAction={
                <div className="atlas-actions">
                  <div className="row row-nav">
                    <button type="button" onClick={() => goBack(3)}>← Back to Challenge</button>
                  </div>
                  <h2 id="h-verify" ref={stageHeadRef} tabIndex={-1}>4 · Verify — Can anyone reproduce it?</h2>
                  {!analysis && <p className="muted">Run the Challenge first; receipts and replay unlock after.</p>}
                  {analysis && !receipt && (
                    <p className="muted">
                      Issue a receipt and run the replay below. The independent check is claimed only
                      after the backend replay succeeds — never before.
                    </p>
                  )}
                </div>
              }
            />
            <section className="atlas-supplement" aria-label="Verification details">
              {analysis && (
                <ProofDrawer
                  statusBlock={
                  evidenceMismatch ? (
                    <div className="alert" role="alert" aria-live="assertive">
                      <strong>Evidence mismatch:</strong> the replayed verdict or receipt digest does
                      not match the issued receipt and the checked analysis. All proof claims are
                      withheld until the evidence agrees.
                    </div>
                  ) : replayVerdict === "REVERSIBLE_MINIMUM_PROVEN" ||
                    replayVerdict === "REVERSIBLE_WITNESS_ONLY" ? (
                    <div aria-live="polite">
                      <ol className="ladder" aria-label="Proof checks">
                        {analysis.checker_status === "WITNESS_VALID" && (
                          <li>
                            <strong>The assignment follows the approved matching rules.</strong>
                            <span>
                              {" "}We independently checked this alternative. The allowed
                              alternative gives every attendance record at most one registration
                              match, and it flips the fixed question (“{FIXED_QUESTION}”).
                            </span>
                          </li>
                        )}
                        <li>
                          <strong>The conclusion changes within the reviewed set.</strong>
                          {replayVerdict === "REVERSIBLE_MINIMUM_PROVEN" &&
                          replayBasis === "SOLVER_AND_SMALL_ORACLE" ? (
                            <span>
                              {" "}The smallest possible number of changed assignments was proven
                              by the completed solver and independently cross-checked by the
                              small-case oracle. The independent checker recomputed the witness.
                            </span>
                          ) : replayVerdict === "REVERSIBLE_MINIMUM_PROVEN" &&
                            replayBasis === "SOLVER_ATTRIBUTED_ONLY" ? (
                            <span>
                              {" "}The smallest possible number of changed assignments was proven
                              by the completed solver: the optimum is solver-proven, with no
                              separate small-oracle cross-check. The independent checker
                              recomputed the witness.
                            </span>
                          ) : (
                            <span>
                              {" "}Minimality is not proven for this result — it is shown as a
                              checked witness within the reviewed policy.
                            </span>
                          )}
                        </li>
                        <li>
                          <strong>Independent verification replay succeeded.</strong>
                        </li>
                      </ol>
                    </div>
                  ) : replayVerdict === "STABLE_WITHIN_REVIEWED_POLICY" ? (
                    <div aria-live="polite">
                      <ol className="ladder" aria-label="Proof checks">
                        <li>
                          <strong>The conclusion is stable within the reviewed set.</strong>
                          <span>
                            {" "}No permitted reversal exists within the reviewed model: no
                            allowed reassignment flips the fixed question under the reviewed
                            matching rules.
                          </span>
                        </li>
                        <li>
                          {replayBasis === "SOLVER_AND_SMALL_ORACLE" ? (
                            <span>
                              The small-case oracle independently confirmed stability.
                            </span>
                          ) : (
                            <span>
                              Infeasibility is solver-attributed, without a separate small-oracle
                              confirmation.
                            </span>
                          )}
                        </li>
                        <li>
                          <strong>Independent verification replay succeeded.</strong>
                        </li>
                      </ol>
                    </div>
                  ) : replayVerdict === "NOT_VERIFIED" ? (
                    <div aria-live="polite">
                      <p>
                        The replay completed without a verified result: no reversal is established
                        and no stability is proven for this policy.
                      </p>
                    </div>
                  ) : (
                    <p className="muted">
                      Issue a receipt and run the replay below. The independent check is claimed only
                      after the backend replay succeeds — never before.
                    </p>
                  )}
                  actions={
                    <>
                    <button type="button" className="primary" onClick={issueReceipt} disabled={busy === "receipt"}>
                      {busy === "receipt" ? "Issuing…" : "Issue receipt"}
                    </button>
                    {receipt && (
                      <>
                        <button type="button" onClick={downloadReceipt}>
                          Download verification receipt
                        </button>
                        <button type="button" onClick={replayVerify} disabled={busy === "verify"}>
                          {busy === "verify" ? "Verifying…" : "Verify replay"}
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
                            Status: <code>{receipt.status}</code> · verdict{" "}
                            <code>{String(receipt.receipt.verdict)}</code> · receipt{" "}
                            <code>{receipt.receipt.receipt_sha256.slice(0, 12)}…</code>
                          </p>
                          <p className="muted">
                            Downloaded file: <code>{receiptFileName}</code> — a serialized JSON copy
                            of the API receipt object saved by the browser (semantically the API
                            receipt, but not necessarily byte-identical provider response bytes).
                            Depends on the saved original registrations.csv, attendance.csv,
                            review_policy.json and reference.json above.
                          </p>
                        </div>
                      )}
                      {verify && (
                        <div aria-live="polite">
                          <p>
                            Status: <code>{verify.status}</code> · verdict <code>{verify.verdict}</code>{" "}
                            · receipt <code>{verify.receipt_sha256.slice(0, 12)}…</code>
                          </p>
                          <p>
                            Roles: solver proposes the witness · checker recomputes it · oracle
                            independently confirms small-case minimality. SHA-256 digests are
                            integrity bindings, <strong>not digital signatures</strong>.
                          </p>
                          <p className="muted">Qualifications: {verify.scope_caveat}</p>
                          <h3>Offline replay (run locally with saved original files)</h3>
                          <p className="muted">
                            The browser did not run this CLI; save the downloaded receipt and
                            originals, then run:
                          </p>
                          <pre>
                            {`.venv/Scripts/python.exe -m joinwitness.verify --receipt ${receiptFileName} --registrations registrations.csv --attendance attendance.csv --policy review_policy.json`}
                          </pre>
                        </div>
                      )}
                    </>
                  }
                  hasEvidence={!!(receipt || verify)}
                />
              )}
            </section>
          </>
        )}
    </ProductShell>
  );
}
