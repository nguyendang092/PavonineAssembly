const DEFAULT_IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_JSON_BYTES = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4096;

function getImgbbUploadUrl() {
  return String(process.env.IMGBB_UPLOAD_URL ?? "").trim() || DEFAULT_IMGBB_UPLOAD_URL;
}

function getImgbbApiKey() {
  return String(process.env.IMGBB_API_KEY ?? "").trim();
}

function readJsonBody(req, maxBytes = MAX_JSON_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

/**
 * @param {{ image?: string, name?: string }} body
 */
export async function uploadImageToImgbbServer(body = {}) {
  const apiKey = getImgbbApiKey();
  if (!apiKey) throw new Error("MISSING_IMGBB_API_KEY");

  const base64 = String(body.image ?? "").trim();
  if (!base64) throw new Error("NO_IMAGE");

  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");

  const form = new FormData();
  form.append("key", apiKey);
  form.append("image", base64);
  const name = String(body.name ?? "").trim();
  if (name) form.append("name", name.slice(0, 120));

  const res = await fetch(getImgbbUploadUrl(), {
    method: "POST",
    body: form,
  });

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error("IMGBB_BAD_RESPONSE");
  }

  if (!res.ok || !json?.success || !json?.data?.url) {
    const msg =
      json?.error?.message ||
      json?.status_txt ||
      `ImgBB upload failed (${res.status})`;
    throw new Error(msg);
  }

  return {
    url: String(json.data.url),
    displayUrl: String(json.data.display_url || json.data.url),
    viewerUrl: json.data.url_viewer ? String(json.data.url_viewer) : "",
    deleteUrl: json.data.delete_url ? String(json.data.delete_url) : "",
  };
}

const ERROR_STATUS = {
  MISSING_IMGBB_API_KEY: 503,
  NO_IMAGE: 400,
  IMAGE_TOO_LARGE: 413,
  PAYLOAD_TOO_LARGE: 413,
  INVALID_JSON: 400,
};

/** Middleware Connect — POST /api/imgbb/upload */
export function createImgbbUploadMiddleware() {
  return async (req, res, next) => {
    const url = req.url?.split("?")[0] ?? "";
    if (url !== "/api/imgbb/upload") return next();
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.end();
      return;
    }
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, error: "METHOD_NOT_ALLOWED" });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const data = await uploadImageToImgbbServer(body);
      sendJson(res, 200, { success: true, data });
    } catch (err) {
      const code = String(err?.message ?? "UPLOAD_FAILED");
      const status = ERROR_STATUS[code] ?? 500;
      sendJson(res, status, { success: false, error: code, message: code });
    }
  };
}
