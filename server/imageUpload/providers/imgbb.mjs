import { ImageUploadError } from "../errors.mjs";

const DEFAULT_IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";

function getImgbbUploadUrl() {
  return String(process.env.IMGBB_UPLOAD_URL ?? "").trim() || DEFAULT_IMGBB_UPLOAD_URL;
}

function getImgbbApiKey() {
  return String(process.env.IMGBB_API_KEY ?? "").trim();
}

export function isImgbbConfigured() {
  return Boolean(getImgbbApiKey());
}

/**
 * @param {{ imageBase64: string, name: string, context: string }} payload
 */
export async function uploadViaImgbb(payload) {
  const apiKey = getImgbbApiKey();
  if (!apiKey) throw new ImageUploadError("IMGBB_NOT_CONFIGURED");

  const form = new FormData();
  form.append("key", apiKey);
  form.append("image", payload.imageBase64);
  form.append("name", payload.name);

  const res = await fetch(getImgbbUploadUrl(), {
    method: "POST",
    body: form,
  });

  let json;
  try {
    json = await res.json();
  } catch {
    throw new ImageUploadError("IMGBB_BAD_RESPONSE");
  }

  if (!res.ok || !json?.success || !json?.data?.url) {
    const msg =
      json?.error?.message ||
      json?.status_txt ||
      `ImgBB upload failed (${res.status})`;
    throw new ImageUploadError("IMGBB_BAD_RESPONSE", msg);
  }

  return {
    url: String(json.data.url),
    displayUrl: String(json.data.display_url || json.data.url),
    viewerUrl: json.data.url_viewer ? String(json.data.url_viewer) : "",
    deleteUrl: json.data.delete_url ? String(json.data.delete_url) : "",
    provider: "imgbb",
    name: payload.name,
    context: payload.context,
  };
}

/** @deprecated */
export async function uploadImageToImgbbServer(body = {}) {
  const { parseUploadRequest } = await import("../validateUploadRequest.mjs");
  const payload = parseUploadRequest(body);
  const result = await uploadViaImgbb(payload);
  return {
    url: result.url,
    displayUrl: result.displayUrl,
    viewerUrl: result.viewerUrl,
    deleteUrl: result.deleteUrl,
  };
}
