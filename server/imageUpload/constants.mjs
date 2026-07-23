export const API_BASE = "/api/images";

export const ROUTES = Object.freeze({
  UPLOAD: `${API_BASE}/upload`,
  HEALTH: `${API_BASE}/health`,
});

/** @deprecated Giữ tương thích dev cũ */
export const LEGACY_IMGBB_ROUTE = "/api/imgbb/upload";

export const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
export const MAX_JSON_BYTES = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8192;
export const MAX_NAME_LENGTH = 120;

export const UPLOAD_CONTEXTS = Object.freeze([
  "s90d_defect",
  "attendance",
  "general",
]);

export const UPLOAD_PROVIDERS = Object.freeze(["auto", "imgbb"]);
