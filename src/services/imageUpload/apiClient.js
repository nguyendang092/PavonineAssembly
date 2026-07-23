import { getAuth } from "firebase/auth";
import {
  inferUploadContext,
  resolveUploadEndpoint,
} from "./config";

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      const comma = raw.indexOf(",");
      resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
    };
    reader.onerror = () => reject(reader.error || new Error("READ_FILE_FAILED"));
    reader.readAsDataURL(file);
  });
}

async function buildAuthHeaders() {
  const user = getAuth().currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

/**
 * Upload qua API server — POST /api/images/upload
 */
export async function uploadImageViaApi(file, { name, context } = {}) {
  const image = await readFileAsBase64(file);
  const uploadContext = context || inferUploadContext(name);
  const endpoint = resolveUploadEndpoint();

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await buildAuthHeaders()),
      },
      body: JSON.stringify({
        image,
        name: name ? String(name).slice(0, 120) : undefined,
        context: uploadContext,
        provider: "imgbb",
      }),
    });
  } catch {
    throw new Error("UPLOAD_SERVER_UNAVAILABLE");
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error("UPLOAD_BAD_RESPONSE");
  }

  if (!res.ok || !json?.success || !json?.data?.url) {
    const code = String(json?.error ?? json?.message ?? "").trim();
    if (code === "AUTH_REQUIRED" || code === "AUTH_INVALID") {
      throw new Error("AUTH_REQUIRED");
    }
    if (code === "IMGBB_NOT_CONFIGURED" || code === "MISSING_IMGBB_API_KEY") {
      throw new Error("IMGBB_NOT_CONFIGURED");
    }
    if (res.status === 404) throw new Error("UPLOAD_SERVER_UNAVAILABLE");
    throw new Error(code || `Upload failed (${res.status})`);
  }

  return {
    url: String(json.data.url),
    displayUrl: String(json.data.displayUrl || json.data.url),
    viewerUrl: json.data.viewerUrl ? String(json.data.viewerUrl) : "",
    deleteUrl: json.data.deleteUrl ? String(json.data.deleteUrl) : "",
    provider: String(json.data.provider || "imgbb"),
    storagePath: json.data.storagePath ? String(json.data.storagePath) : "",
  };
}

export function shouldFallbackAfterApiError(error) {
  const code = String(error?.message ?? "");
  return (
    code === "UPLOAD_SERVER_UNAVAILABLE" ||
    code === "UPLOAD_BAD_RESPONSE" ||
    code === "IMGBB_NOT_CONFIGURED" ||
    code === "IMGBB_BAD_RESPONSE" ||
    code === "AUTH_REQUIRED" ||
    code === "SERVER_MISCONFIGURED"
  );
}

export function shouldFallbackAfterFirebaseError(error) {
  const code = String(error?.message ?? "");
  return (
    code === "STORAGE_PERMISSION_DENIED" ||
    code === "AUTH_REQUIRED"
  );
}
