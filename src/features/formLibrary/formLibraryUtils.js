export const FORM_LIBRARY_RTDB_ROOT = "formLibrary/files";
export const FORM_LIBRARY_STORAGE_PREFIX = "formLibrary";
export const FORM_LIBRARY_MAX_BYTES = 25 * 1024 * 1024;

export const FORM_LIBRARY_ALLOWED_EXTENSIONS = Object.freeze([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "png",
  "jpg",
  "jpeg",
  "txt",
  "zip",
]);

export function formLibraryExtension(fileName) {
  const name = String(fileName ?? "");
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function formLibraryKind(ext) {
  const value = String(ext ?? "").toLowerCase();
  if (value === "pdf") return "pdf";
  if (value === "xls" || value === "xlsx") return "excel";
  if (value === "doc" || value === "docx") return "word";
  if (value === "ppt" || value === "pptx") return "ppt";
  if (value === "png" || value === "jpg" || value === "jpeg") return "image";
  if (value === "zip") return "zip";
  if (value === "txt") return "text";
  return "file";
}

export function sanitizeFormLibraryFileName(fileName) {
  const raw = String(fileName ?? "").trim() || "form";
  const ext = formLibraryExtension(raw);
  const base = ext ? raw.slice(0, raw.length - ext.length - 1) : raw;
  const safeBase =
    base
      .replace(/[^\w.\u00C0-\u024F\u1E00-\u1EFF-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 80) || "form";
  return ext ? `${safeBase}.${ext}` : safeBase;
}

export function isAllowedFormLibraryFile(file) {
  if (!file) return false;
  const ext = formLibraryExtension(file.name);
  if (!FORM_LIBRARY_ALLOWED_EXTENSIONS.includes(ext)) return false;
  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0 || size > FORM_LIBRARY_MAX_BYTES) {
    return false;
  }
  return true;
}

export function formatFormLibraryFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function filesFromFormLibrarySnapshot(val) {
  if (!val || typeof val !== "object") return [];
  return Object.entries(val)
    .map(([id, raw]) => ({
      id,
      title: String(raw?.title ?? "").trim() || String(raw?.fileName ?? "form"),
      fileName: String(raw?.fileName ?? ""),
      contentType: String(raw?.contentType ?? ""),
      size: Number(raw?.size ?? 0),
      storagePath: String(raw?.storagePath ?? ""),
      downloadUrl: String(raw?.downloadUrl ?? ""),
      uploadedBy: String(raw?.uploadedBy ?? ""),
      uploadedAt: String(raw?.uploadedAt ?? ""),
    }))
    .filter((item) => item.downloadUrl)
    .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
}

export function filterFormLibraryFiles(files, query) {
  const q = String(query ?? "")
    .trim()
    .toLowerCase();
  if (!q) return files ?? [];
  return (files ?? []).filter((item) => {
    const hay = `${item.title} ${item.fileName} ${item.uploadedBy}`.toLowerCase();
    return hay.includes(q);
  });
}
