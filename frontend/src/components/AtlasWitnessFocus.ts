/**
 * Presentation-only focus for a server-confirmed decision-changing record.
 *
 * This helper does not decide criticality, compute verdicts, grant permissions,
 * or mutate a review. Critical records and the result fingerprint must come from
 * the parent adapter's accepted backend response.
 */
import { useEffect, useRef } from 'react';

export type AtlasFocusStage = 'import' | 'review' | 'challenge' | 'verify';
export type AtlasFocusRecord = Readonly<{ id: string; kind: string }>;

export function firstVerifiedWitnessId(
  records: readonly AtlasFocusRecord[],
  stage: AtlasFocusStage,
  isLiveResult: boolean,
  hasAlternative: boolean,
): string | null {
  if (!isLiveResult || !hasAlternative || (stage !== 'challenge' && stage !== 'verify')) {
    return null;
  }
  return records.find((record) => record.kind === 'critical' && record.id.length > 0)?.id ?? null;
}

/**
 * A primitive signature prevents ordinary React re-renders from stealing the
 * user's manual selection. It also detects a new accepted result even when the
 * critical record IDs happen to be unchanged.
 */
export function verifiedFocusSignature(
  records: readonly AtlasFocusRecord[],
  stage: AtlasFocusStage,
  isLiveResult: boolean,
  hasAlternative: boolean,
  resultFingerprint: string,
): string | null {
  const firstId = firstVerifiedWitnessId(records, stage, isLiveResult, hasAlternative);
  if (firstId === null) return null;
  const criticalIds = records.filter((record) => record.kind === 'critical').map((record) => record.id);
  return JSON.stringify([resultFingerprint, criticalIds]);
}

export function useAtlasWitnessFocus(options: {
  records: readonly AtlasFocusRecord[];
  stage: AtlasFocusStage;
  isLiveResult: boolean;
  hasAlternative: boolean;
  /** Stable, accepted-result fingerprint; never an unverified display placeholder. */
  resultFingerprint: string;
  onFocus: (id: string) => void;
}): void {
  const { records, stage, isLiveResult, hasAlternative, resultFingerprint, onFocus } = options;
  const focusCallback = useRef(onFocus);
  const lastFocusedSignature = useRef<string | null>(null);
  focusCallback.current = onFocus;

  const firstId = firstVerifiedWitnessId(records, stage, isLiveResult, hasAlternative);
  const signature = verifiedFocusSignature(records, stage, isLiveResult, hasAlternative, resultFingerprint);

  useEffect(() => {
    if (signature === null || firstId === null) {
      lastFocusedSignature.current = null;
      return;
    }
    if (signature === lastFocusedSignature.current) return;
    lastFocusedSignature.current = signature;
    focusCallback.current(firstId);
  }, [signature, firstId]);
}
