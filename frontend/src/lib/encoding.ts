/** Byte-exact Base64 for CSV source bytes (canonical encoding, no wrapping). */
export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function textToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

/** Parse a small CSV preview (header + rows) without a dependency. */
export function previewCsv(text: string, maxRows = 5): { header: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const split = (line: string) => line.split(",");
  return { header: split(lines[0]), rows: lines.slice(1, 1 + maxRows).map(split) };
}
