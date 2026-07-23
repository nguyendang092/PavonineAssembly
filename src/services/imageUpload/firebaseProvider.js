import { getAuth } from "firebase/auth";
import {
  getDownloadURL,
  storage,
  storageRef,
  uploadBytes,
} from "@/services/firebase";

function buildStorageObjectPath(namePrefix = "upload") {
  const safePrefix = String(namePrefix || "upload")
    .replace(/[^\w-]+/g, "_")
    .slice(0, 96);
  const stamp = Date.now();
  if (safePrefix.startsWith("s90d_defect")) {
    return `s90d/defectImages/${safePrefix}_${stamp}.jpg`;
  }
  return `attendance/images/${safePrefix}_${stamp}.jpg`;
}

export async function uploadImageViaFirebaseStorage(file, { name } = {}) {
  const user = getAuth().currentUser;
  if (!user) throw new Error("AUTH_REQUIRED");

  const objectPath = buildStorageObjectPath(name);
  const objectRef = storageRef(storage, objectPath);
  const contentType = String(file.type || "image/jpeg").toLowerCase();

  try {
    await uploadBytes(objectRef, file, { contentType });
    const url = await getDownloadURL(objectRef);

    return {
      url,
      displayUrl: url,
      viewerUrl: url,
      deleteUrl: "",
      provider: "firebase",
      storagePath: objectPath,
    };
  } catch (error) {
    const code = String(error?.code ?? "");
    if (code === "storage/unauthorized" || code === "storage/unauthenticated") {
      throw new Error("STORAGE_PERMISSION_DENIED");
    }
    throw error;
  }
}
