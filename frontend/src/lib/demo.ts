import attendanceRaw from "../fixtures/attendance.csv?raw";
import referenceRaw from "../fixtures/reference.json?raw";
import registrationsRaw from "../fixtures/registrations.csv?raw";
import reviewPolicyRaw from "../fixtures/review_policy.json?raw";
import type { ReferenceDraft, ReviewDraft } from "./api";
import { textToBase64 } from "./encoding";

export const DEMO_REGISTRATIONS_TEXT = registrationsRaw;
export const DEMO_ATTENDANCE_TEXT = attendanceRaw;
export const DEMO_REVIEW_POLICY_TEXT = reviewPolicyRaw;
export const DEMO_REFERENCE_TEXT = referenceRaw;

/** Pinned T08B raw-file hashes of the fictional flagship fixture. */
export const EXPECTED_REG_SHA256 =
  "98c829b8d06caaf39e68ffe12f437c734291ccd2ce13da8e66deedb28747c2bf";
export const EXPECTED_ATT_SHA256 =
  "c771e8ae9fd09b08f358ecf40678cf7ff53a448309fb927e1d2a3890be405ea3";

export function demoSourcePayload(): {
  registrations_b64: string;
  attendance_b64: string;
} {
  return {
    registrations_b64: textToBase64(DEMO_REGISTRATIONS_TEXT),
    attendance_b64: textToBase64(DEMO_ATTENDANCE_TEXT),
  };
}

export function demoPolicy(): ReviewDraft {
  const parsed = JSON.parse(DEMO_REVIEW_POLICY_TEXT) as ReviewDraft;
  if (parsed.schema_version !== "jw.review.v1") {
    throw new Error("DEMO_POLICY_SCHEMA_MISMATCH");
  }
  return parsed;
}

export function demoReference(): ReferenceDraft {
  const parsed = JSON.parse(DEMO_REFERENCE_TEXT) as ReferenceDraft;
  if (parsed.schema_version !== "jw.reference.v1") {
    throw new Error("DEMO_REFERENCE_SCHEMA_MISMATCH");
  }
  return parsed;
}

/** Registration group lookup for labeling ID pairs with A/B groups. */
export function groupOf(registrationId: string): string {
  const lines = DEMO_REGISTRATIONS_TEXT.trim().split("\n").slice(1);
  for (const line of lines) {
    const [id, , group] = line.split(",");
    if (id === registrationId) return group ?? "?";
  }
  return "?";
}

import attendance60Raw from "../fixtures/demo60_90/attendance.csv?raw";
import reference60Raw from "../fixtures/demo60_90/reference.json?raw";
import registrations60Raw from "../fixtures/demo60_90/registrations.csv?raw";
import reviewPolicy60Raw from "../fixtures/demo60_90/review_policy.json?raw";

export const DEMO60_REGISTRATIONS_TEXT = registrations60Raw;
export const DEMO60_ATTENDANCE_TEXT = attendance60Raw;
export const DEMO60_REVIEW_POLICY_TEXT = reviewPolicy60Raw;
export const DEMO60_REFERENCE_TEXT = reference60Raw;

/** Pinned manifest hashes of the generated 60/90 demonstration inputs.
 * ground_truth.json is deliberately NOT bundled and never read here. */
export const EXPECTED60_REG_SHA256 =
  "48feedb1ac550a048a0da4126c0e720ced658675f3e8adf89c9c80c1aea0b7cb";
export const EXPECTED60_ATT_SHA256 =
  "e7db50d0fa6c2a2902f0629abe0b291f118f13ee14eef6b76b5f472242e40b66";

export function demo60SourcePayload(): {
  registrations_b64: string;
  attendance_b64: string;
} {
  return {
    registrations_b64: textToBase64(DEMO60_REGISTRATIONS_TEXT),
    attendance_b64: textToBase64(DEMO60_ATTENDANCE_TEXT),
  };
}

export function demo60Policy(): ReviewDraft {
  const parsed = JSON.parse(DEMO60_REVIEW_POLICY_TEXT) as ReviewDraft;
  if (parsed.schema_version !== "jw.review.v1") {
    throw new Error("DEMO60_POLICY_SCHEMA_MISMATCH");
  }
  return parsed;
}

export function demo60Reference(): ReferenceDraft {
  const parsed = JSON.parse(DEMO60_REFERENCE_TEXT) as ReferenceDraft;
  if (parsed.schema_version !== "jw.reference.v1") {
    throw new Error("DEMO60_REFERENCE_SCHEMA_MISMATCH");
  }
  return parsed;
}
