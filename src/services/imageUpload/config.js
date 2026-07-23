export const IMAGE_UPLOAD_ROUTES = Object.freeze({
  upload: "/api/images/upload",
  health: "/api/images/health",
  legacyImgbb: "/api/imgbb/upload",
});

export const IMAGE_UPLOAD_CONTEXTS = Object.freeze({
  S90D_DEFECT: "s90d_defect",
  ATTENDANCE: "attendance",
  GENERAL: "general",
});

/** firebase-first | api-first | firebase-only | api-only */
export function resolveUploadStrategy() {
  const raw = String(import.meta.env.VITE_IMAGE_UPLOAD_STRATEGY ?? "")
    .trim()
    .toLowerCase();
  if (raw === "api-first" || raw === "firebase-only" || raw === "api-only") {
    return raw;
  }
  return "firebase-first";
}

export function resolveUploadApiBaseUrl() {
  const custom = String(import.meta.env.VITE_IMAGE_UPLOAD_API_URL ?? "").trim();
  if (custom) return custom.replace(/\/$/, "");
  return "";
}

export function resolveUploadEndpoint() {
  const base = resolveUploadApiBaseUrl();
  return base ? `${base}${IMAGE_UPLOAD_ROUTES.upload}` : IMAGE_UPLOAD_ROUTES.upload;
}

export function inferUploadContext(namePrefix = "") {
  const safe = String(namePrefix ?? "").trim();
  if (safe.startsWith("s90d_defect")) {
    return IMAGE_UPLOAD_CONTEXTS.S90D_DEFECT;
  }
  if (safe.startsWith("attendance")) {
    return IMAGE_UPLOAD_CONTEXTS.ATTENDANCE;
  }
  return IMAGE_UPLOAD_CONTEXTS.GENERAL;
}
