import { ROUTES } from "./constants.mjs";
import { toErrorResponse } from "./errors.mjs";
import {
  readBearerToken,
  readJsonBody,
  sendJson,
  setCorsHeaders,
} from "./http.mjs";
import { isImgbbConfigured, uploadViaImgbb } from "./providers/imgbb.mjs";
import { parseUploadRequest } from "./validateUploadRequest.mjs";
import { verifyFirebaseIdToken } from "./verifyFirebaseToken.mjs";

export function buildHealthPayload() {
  return {
    success: true,
    data: {
      service: "pavonine-image-upload",
      version: 2,
      routes: ROUTES,
      providers: {
        imgbb: isImgbbConfigured(),
      },
      authRequired: String(process.env.IMAGE_UPLOAD_SKIP_AUTH ?? "") !== "1",
    },
  };
}

export async function handleHealthRequest(_req, res) {
  sendJson(res, 200, buildHealthPayload());
}

export async function handleUploadRequest(req, res) {
  const token = readBearerToken(req);
  const user = await verifyFirebaseIdToken(token);
  const body = await readJsonBody(req);
  const payload = parseUploadRequest(body);
  const data = await uploadViaImgbb(payload);

  sendJson(res, 200, {
    success: true,
    data: {
      ...data,
      uploadedBy: user.uid,
      uploadedByEmail: user.email ?? "",
    },
  });
}

export function createImageUploadMiddleware() {
  return async (req, res, next) => {
    const pathname = req.url?.split("?")[0] ?? "";
    const isLegacy = pathname === "/api/imgbb/upload";
    const isUpload = pathname === ROUTES.UPLOAD || isLegacy;
    const isHealth = pathname === ROUTES.HEALTH;

    if (!isUpload && !isHealth) return next();

    setCorsHeaders(res, req);

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      if (isHealth) {
        if (req.method !== "GET") {
          sendJson(res, 405, { success: false, error: "METHOD_NOT_ALLOWED" });
          return;
        }
        await handleHealthRequest(req, res);
        return;
      }

      if (req.method !== "POST") {
        sendJson(res, 405, { success: false, error: "METHOD_NOT_ALLOWED" });
        return;
      }

      await handleUploadRequest(req, res);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      sendJson(res, status, body);
    }
  };
}

/** @deprecated Dùng createImageUploadMiddleware */
export const createImgbbUploadMiddleware = createImageUploadMiddleware;
