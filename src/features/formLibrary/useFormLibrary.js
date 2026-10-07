import { useCallback, useEffect, useMemo, useState } from "react";
import {
  db,
  ref,
  onValue,
  push,
  set,
  remove,
  storage,
  storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "@/services/firebase";
import {
  FORM_LIBRARY_MAX_BYTES,
  FORM_LIBRARY_RTDB_ROOT,
  FORM_LIBRARY_STORAGE_PREFIX,
  filesFromFormLibrarySnapshot,
  isAllowedFormLibraryFile,
  sanitizeFormLibraryFileName,
} from "./formLibraryUtils";

export function useFormLibrary({ canManage = false } = {}) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const listRef = ref(db, FORM_LIBRARY_RTDB_ROOT);
    const unsub = onValue(
      listRef,
      (snap) => {
        setFiles(filesFromFormLibrarySnapshot(snap.val()));
        setLoading(false);
        setError("");
      },
      () => {
        setLoading(false);
        setError("load");
      },
    );
    return () => unsub();
  }, []);

  const uploadFile = useCallback(
    async (file, { title = "", uploadedBy = "" } = {}) => {
      if (!canManage) throw new Error("FORBIDDEN");
      if (!isAllowedFormLibraryFile(file)) throw new Error("INVALID_FILE");

      setBusy(true);
      setError("");
      try {
        const listRef = ref(db, FORM_LIBRARY_RTDB_ROOT);
        const newRef = push(listRef);
        const id = newRef.key;
        const safeName = sanitizeFormLibraryFileName(file.name);
        const storagePath = `${FORM_LIBRARY_STORAGE_PREFIX}/${id}/${safeName}`;
        const objectRef = storageRef(storage, storagePath);
        await uploadBytes(objectRef, file, {
          contentType: file.type || "application/octet-stream",
        });
        const downloadUrl = await getDownloadURL(objectRef);
        const displayTitle = String(title ?? "").trim() || file.name;
        await set(newRef, {
          title: displayTitle,
          fileName: file.name,
          contentType: file.type || "",
          size: file.size,
          storagePath,
          downloadUrl,
          uploadedBy,
          uploadedAt: new Date().toISOString(),
        });
        return { id };
      } catch (err) {
        setError(err?.message || "upload");
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [canManage],
  );

  const deleteFile = useCallback(
    async (item) => {
      if (!canManage || !item?.id) throw new Error("FORBIDDEN");
      setBusy(true);
      setError("");
      try {
        if (item.storagePath) {
          try {
            await deleteObject(storageRef(storage, item.storagePath));
          } catch {
            /* metadata still removed */
          }
        }
        await remove(ref(db, `${FORM_LIBRARY_RTDB_ROOT}/${item.id}`));
      } catch (err) {
        setError(err?.message || "delete");
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [canManage],
  );

  return useMemo(
    () => ({
      files,
      loading,
      busy,
      error,
      maxBytes: FORM_LIBRARY_MAX_BYTES,
      uploadFile,
      deleteFile,
    }),
    [busy, deleteFile, error, files, loading, uploadFile],
  );
}
