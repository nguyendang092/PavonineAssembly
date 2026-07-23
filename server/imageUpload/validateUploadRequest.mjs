import {
  MAX_IMAGE_BYTES,
  MAX_NAME_LENGTH,
  UPLOAD_CONTEXTS,
  UPLOAD_PROVIDERS,
} from "./constants.mjs";
import { ImageUploadError } from "./errors.mjs";

function sanitizeName(rawName, fallback = "upload") {
  const safe = String(rawName ?? fallback)
    .trim()
    .replace(/[^\w-]+/g, "_")
    .slice(0, MAX_NAME_LENGTH);
  return safe || fallback;
}

/**
 * @param {Record<string, unknown>} body
 */
export function parseUploadRequest(body = {}) {
  const base64 = String(body.image ?? "").trim();
  if (!base64) throw new ImageUploadError("NO_IMAGE");

  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw new ImageUploadError("IMAGE_TOO_LARGE");
  }

  const context = String(body.context ?? "general").trim() || "general";
  if (!UPLOAD_CONTEXTS.includes(context)) {
    throw new ImageUploadError("INVALID_CONTEXT");
  }

  const provider = String(body.provider ?? "auto").trim() || "auto";
  if (!UPLOAD_PROVIDERS.includes(provider)) {
    throw new ImageUploadError("INVALID_PROVIDER");
  }

  return {
    imageBase64: base64,
    name: sanitizeName(body.name, context),
    context,
    provider,
    approxBytes,
  };
}
