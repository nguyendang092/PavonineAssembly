export function sanitizeDownloadFilenameSegment(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}
