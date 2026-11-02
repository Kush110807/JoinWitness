/** Fictional commerce example: byte-exact bundled fixtures.
 *
 * The four CSVs under `../fixtures/commerce_demo/` are byte-exact copies of
 * the authoritative `fixtures/commerce_demo/` datasets. They are inlined by
 * the bundler (`?raw`, no config change) and encoded through the same
 * canonical `textToBase64` path as manual uploads. A maintained test verifies
 * the decoded bytes against the authoritative files and their SHA-256 manifest.
 */
import type { CommerceFileBundle, CommerceFileName } from "./commerceApi";
import { COMMERCE_FILE_NAMES } from "./commerceApi";
import { textToBase64 } from "./encoding";
import ordersCsv from "../fixtures/commerce_demo/orders.csv?raw";
import paymentsCsv from "../fixtures/commerce_demo/payments.csv?raw";
import deliveriesCsv from "../fixtures/commerce_demo/deliveries.csv?raw";
import refundsCsv from "../fixtures/commerce_demo/refunds.csv?raw";

export const FICTIONAL_COMMERCE_BLURB =
  "One delivery may belong to a different order. Explore whether that uncertainty can change the business conclusion.";

const BUNDLED_TEXT: Record<CommerceFileName, string> = {
  "orders.csv": ordersCsv,
  "payments.csv": paymentsCsv,
  "deliveries.csv": deliveriesCsv,
  "refunds.csv": refundsCsv,
};

export interface FictionalCommerceFile {
  fileName: CommerceFileName;
  text: string;
  b64: string;
}

/** The four fictional datasets in canonical file order, exactly as stored. */
export function loadFictionalCommerceFiles(): FictionalCommerceFile[] {
  return COMMERCE_FILE_NAMES.map((fileName) => ({
    fileName,
    text: BUNDLED_TEXT[fileName],
    b64: textToBase64(BUNDLED_TEXT[fileName]),
  }));
}

/** Frozen `commerce.v1` parse file bundle for the fictional example. */
export function fictionalCommerceBundle(): CommerceFileBundle {
  return {
    "orders.csv": { content_base64: textToBase64(BUNDLED_TEXT["orders.csv"]) },
    "payments.csv": { content_base64: textToBase64(BUNDLED_TEXT["payments.csv"]) },
    "deliveries.csv": { content_base64: textToBase64(BUNDLED_TEXT["deliveries.csv"]) },
    "refunds.csv": { content_base64: textToBase64(BUNDLED_TEXT["refunds.csv"]) },
  };
}
