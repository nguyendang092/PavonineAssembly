const VALID_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

const MAX_IMAGE_BYTES = 32 * 1024 * 1024;

const UPLOAD_API_PATH = "/api/imgbb/upload";

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

/**
 * Upload ảnh qua backend proxy — API key ImgBB chỉ nằm trên server (.env).
 */
export async function uploadImageToImgbb(file, { name } = {}) {
  if (!file) throw new Error("NO_FILE");

  if (!VALID_IMAGE_TYPES.has(String(file.type || "").toLowerCase())) {
    throw new Error("INVALID_IMAGE_TYPE");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  const image = await readFileAsBase64(file);

  let res;
  try {
    res = await fetch(UPLOAD_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image,
        name: name ? String(name).slice(0, 120) : undefined,
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
    if (code === "MISSING_IMGBB_API_KEY") throw new Error("MISSING_IMGBB_API_KEY");
    throw new Error(code || `Upload failed (${res.status})`);
  }

  return {
    url: String(json.data.url),
    displayUrl: String(json.data.display_url || json.data.url),
    viewerUrl: json.data.viewerUrl ? String(json.data.viewerUrl) : "",
    deleteUrl: json.data.deleteUrl ? String(json.data.deleteUrl) : "",
  };
}
