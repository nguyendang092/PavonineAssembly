import imageCompression from "browser-image-compression";

const VALID_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/bmp",
  "image/tiff",
]);

const EXTENSION_TO_MIME = Object.freeze({
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
});

export const MAX_UPLOAD_IMAGE_BYTES = 32 * 1024 * 1024;

function readExtension(fileName = "") {
  const match = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function resolveUploadImageMime(file) {
  const type = String(file?.type ?? "").toLowerCase().trim();
  if (VALID_IMAGE_TYPES.has(type)) return type;

  const extMime = EXTENSION_TO_MIME[readExtension(file?.name)];
  if (extMime) return extMime;

  return type;
}

export function isSupportedUploadImage(file) {
  if (!file) return false;
  const mime = resolveUploadImageMime(file);
  if (VALID_IMAGE_TYPES.has(mime)) return true;
  if (!mime && readExtension(file.name)) {
    return Boolean(EXTENSION_TO_MIME[readExtension(file.name)]);
  }
  return false;
}

function withResolvedMime(file) {
  const mime = resolveUploadImageMime(file);
  if (!mime || mime === file.type) return file;
  try {
    return new File([file], file.name, {
      type: mime,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

/**
 * Chuẩn hóa ảnh trước upload: hỗ trợ HEIC/ảnh chụp điện thoại, nén về JPEG.
 */
export async function prepareUploadImage(file) {
  if (!file) throw new Error("NO_FILE");
  if (!isSupportedUploadImage(file)) throw new Error("INVALID_IMAGE_TYPE");
  if (file.size > MAX_UPLOAD_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");

  const normalized = withResolvedMime(file);

  try {
    const compressed = await imageCompression(normalized, {
      maxSizeMB: 4,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: "image/jpeg",
      initialQuality: 0.85,
    });
    if (compressed.size > MAX_UPLOAD_IMAGE_BYTES) {
      throw new Error("IMAGE_TOO_LARGE");
    }
    return compressed;
  } catch (error) {
    if (String(error?.message) === "IMAGE_TOO_LARGE") throw error;
    return normalized;
  }
}
