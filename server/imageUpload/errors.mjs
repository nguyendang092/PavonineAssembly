export const ERROR_STATUS = Object.freeze({
  AUTH_REQUIRED: 401,
  AUTH_INVALID: 401,
  METHOD_NOT_ALLOWED: 405,
  NO_IMAGE: 400,
  INVALID_JSON: 400,
  INVALID_CONTEXT: 400,
  INVALID_PROVIDER: 400,
  IMAGE_TOO_LARGE: 413,
  PAYLOAD_TOO_LARGE: 413,
  IMGBB_NOT_CONFIGURED: 503,
  IMGBB_BAD_RESPONSE: 502,
  SERVER_MISCONFIGURED: 503,
  NOT_FOUND: 404,
});

export class ImageUploadError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "ImageUploadError";
    this.code = code;
  }
}

export function toErrorResponse(err) {
  const code = err instanceof ImageUploadError
    ? err.code
    : String(err?.message ?? "UPLOAD_FAILED");
  const status = ERROR_STATUS[code] ?? 500;
  return { status, body: { success: false, error: code, message: code } };
}
