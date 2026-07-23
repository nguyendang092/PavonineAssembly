import { prepareUploadImage } from "@/services/prepareUploadImage";
import {
  shouldFallbackAfterApiError,
  shouldFallbackAfterFirebaseError,
  uploadImageViaApi,
} from "./apiClient";
import { inferUploadContext, resolveUploadStrategy } from "./config";
import { uploadImageViaFirebaseStorage } from "./firebaseProvider";

export { IMAGE_UPLOAD_CONTEXTS, IMAGE_UPLOAD_ROUTES } from "./config";

/**
 * Upload ảnh thống nhất.
 * @param {File} file
 * @param {{ name?: string, context?: string }} options
 */
export async function uploadImage(file, { name, context } = {}) {
  const preparedFile = await prepareUploadImage(file);
  const uploadContext = context || inferUploadContext(name);
  const strategy = resolveUploadStrategy();
  const payload = { name, context: uploadContext };

  if (strategy === "firebase-only") {
    return uploadImageViaFirebaseStorage(preparedFile, payload);
  }

  if (strategy === "api-only") {
    return uploadImageViaApi(preparedFile, payload);
  }

  if (strategy === "api-first") {
    try {
      return await uploadImageViaApi(preparedFile, payload);
    } catch (error) {
      if (!shouldFallbackAfterApiError(error)) throw error;
      return uploadImageViaFirebaseStorage(preparedFile, payload);
    }
  }

  // firebase-first (mặc định production)
  try {
    return await uploadImageViaFirebaseStorage(preparedFile, payload);
  } catch (error) {
    if (!shouldFallbackAfterFirebaseError(error)) throw error;
    return uploadImageViaApi(preparedFile, payload);
  }
}

/** Giữ tên cũ cho code hiện tại */
export async function uploadImageToImgbb(file, options = {}) {
  return uploadImage(file, options);
}
