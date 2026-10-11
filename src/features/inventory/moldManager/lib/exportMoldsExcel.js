import ExcelJS from "exceljs";
import { downloadXlsxBuffer } from "@/utils/downloadXlsxBuffer";
import { MOLD_COLUMNS, MOLD_IMAGE_COLUMNS } from "./moldConstants";
import { getImagePath } from "./moldUtils";

const IMAGE_COL_WIDTH = 18;
const IMAGE_ROW_HEIGHT = 78;
const TEXT_ROW_HEIGHT = 18;

export function resolveMoldExcelImageUrl(cellValue, origin = "") {
  const path = getImagePath(cellValue);
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const base = String(origin ?? "").replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

export function excelImageExtension(src, contentType = "") {
  const type = String(contentType ?? "").toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpeg";
  if (type.includes("gif")) return "gif";
  if (type.includes("webp")) return "webp";
  const name = String(src ?? "").split("?")[0].toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpeg";
  if (name.endsWith(".gif")) return "gif";
  if (name.endsWith(".webp")) return "webp";
  return "png";
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function withCacheBypassQuery(src) {
  if (!src || /^(data:|blob:)/i.test(src)) return src;
  const join = src.includes("?") ? "&" : "?";
  return `${src}${join}_nocache=${Date.now()}`;
}

async function fetchImageResponse(src) {
  const attempts = [
    { url: src, cache: "no-store" },
    { url: withCacheBypassQuery(src), cache: "reload" },
  ];
  let lastError = null;
  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, {
        cache: attempt.cache,
        credentials: "same-origin",
      });
      if (res.ok) return res;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  return null;
}

async function convertSrcToPngDataUrl(src) {
  if (typeof document === "undefined") return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 1;
        canvas.height = img.naturalHeight || 1;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function convertBufferToPngDataUrl(buffer, mime) {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return null;
  }
  const blob = new Blob([buffer], { type: mime || "image/png" });
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await convertSrcToPngDataUrl(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function loadMoldImageForExcel(src) {
  if (!src) return null;
  try {
    if (String(src).startsWith("data:image/")) {
      const match = String(src).match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
      const ext = excelImageExtension("", `image/${match?.[1] || "png"}`);
      if (ext === "webp") {
        const png = await convertSrcToPngDataUrl(src);
        return png ? { base64: png, extension: "png" } : null;
      }
      return {
        base64: src,
        extension: ext === "jpg" ? "jpeg" : ext,
      };
    }

    const res = await fetchImageResponse(src);
    if (!res?.ok) return null;
    const buffer = await res.arrayBuffer();
    if (!buffer.byteLength) return null;
    let extension = excelImageExtension(src, res.headers.get("content-type") || "");
    if (extension === "jpg") extension = "jpeg";
    if (extension === "webp" || !["png", "jpeg", "gif"].includes(extension)) {
      const png = await convertBufferToPngDataUrl(
        buffer,
        res.headers.get("content-type") || "image/png",
      );
      if (!png) return null;
      return { base64: png, extension: "png" };
    }
    return {
      base64: `data:image/${extension};base64,${arrayBufferToBase64(buffer)}`,
      extension,
    };
  } catch {
    return null;
  }
}

async function mapPool(items, limit, mapper) {
  const list = [...items];
  const results = new Array(list.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, list.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < list.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(list[index], index);
      }
    }),
  );
  return results;
}

/**
 * @param {object} options
 * @param {object[]} options.molds
 * @param {string[]} [options.columns]
 * @param {(col: string) => string} options.headerLabel
 * @param {string} [options.origin]
 * @param {(src: string) => Promise<{base64: string, extension: string}|null>} [options.loadImage]
 * @param {boolean} [options.download=true]
 */
export async function exportMoldsExcel({
  molds,
  columns = MOLD_COLUMNS,
  headerLabel,
  origin,
  loadImage = loadMoldImageForExcel,
  download = true,
  fileName,
} = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Molds");
  const headers = columns.map((col) => headerLabel(col));
  sheet.addRow(headers);

  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  const imageCache = new Map();
  const uniqueSrcs = new Set();
  for (const mold of molds ?? []) {
    for (const col of columns) {
      if (!MOLD_IMAGE_COLUMNS.has(col)) continue;
      const src = resolveMoldExcelImageUrl(mold?.[col], origin);
      if (src) uniqueSrcs.add(src);
    }
  }
  await mapPool([...uniqueSrcs], 4, async (src) => {
    imageCache.set(src, await loadImage(src));
  });

  const workbookImageIds = new Map();
  const getWorkbookImageId = (src, payload) => {
    if (workbookImageIds.has(src)) return workbookImageIds.get(src);
    const imageId = workbook.addImage({
      base64: payload.base64,
      extension: payload.extension,
    });
    workbookImageIds.set(src, imageId);
    return imageId;
  };

  (molds ?? []).forEach((mold, rowIdx) => {
    const excelRow = rowIdx + 2;
    const values = columns.map((col) => {
      if (MOLD_IMAGE_COLUMNS.has(col)) {
        const src = resolveMoldExcelImageUrl(mold?.[col], origin);
        if (src && imageCache.get(src)) return "";
        return mold?.[col] ?? "";
      }
      return mold?.[col] ?? "";
    });
    const row = sheet.addRow(values);
    const hasEmbeddedImage = columns.some((col) => {
      if (!MOLD_IMAGE_COLUMNS.has(col)) return false;
      const src = resolveMoldExcelImageUrl(mold?.[col], origin);
      return Boolean(src && imageCache.get(src));
    });
    row.height = hasEmbeddedImage ? IMAGE_ROW_HEIGHT : TEXT_ROW_HEIGHT;
    row.alignment = { vertical: "middle" };

    columns.forEach((col, colIdx) => {
      if (!MOLD_IMAGE_COLUMNS.has(col)) return;
      const src = resolveMoldExcelImageUrl(mold?.[col], origin);
      const payload = src ? imageCache.get(src) : null;
      if (!payload) return;
      const imageId = getWorkbookImageId(src, payload);
      sheet.addImage(imageId, {
        tl: { col: colIdx + 0.08, row: excelRow - 1 + 0.08 },
        br: { col: colIdx + 0.92, row: excelRow - 0.08 },
        editAs: "oneCell",
      });
    });
  });

  columns.forEach((col, idx) => {
    const column = sheet.getColumn(idx + 1);
    if (MOLD_IMAGE_COLUMNS.has(col)) {
      column.width = IMAGE_COL_WIDTH;
    } else if (col === "Production Name" || col === "Model") {
      column.width = 22;
    } else if (col === "No") {
      column.width = 6;
    } else {
      column.width = 14;
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const outName =
    fileName || `molds_${new Date().toISOString().slice(0, 10)}.xlsx`;
  if (download && typeof window !== "undefined") {
    downloadXlsxBuffer(buffer, outName);
  }
  return { buffer, workbook };
}
