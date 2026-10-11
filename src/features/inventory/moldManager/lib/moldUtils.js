import { MOLD_COLUMNS, MOLD_COLUMN_TRANSLATION_KEYS } from "./moldConstants";

export const toSafeKey = (col) => col.replace(/[^a-zA-Z0-9_]/g, "_");

export const fromSafeKey = (key, columns = MOLD_COLUMNS) => {
  const map = {};
  columns.forEach((c) => {
    map[toSafeKey(c)] = c;
  });
  return map[key] || key;
};

export const getImagePath = (cellValue) => {
  const raw = String(cellValue ?? "").trim();
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  return `/picture/molds/${raw}`;
};

/** Chrome/OneDrive đôi khi lỗi ERR_CACHE_READ_FAILURE — thử lại 1 lần, bỏ cache. */
export function retryImageSrcOnce(event, originalSrc) {
  const el = event?.currentTarget;
  const src = String(originalSrc ?? "").trim();
  if (!el || !src || el.dataset.cacheRetry === "1") return false;
  el.dataset.cacheRetry = "1";
  const join = src.includes("?") ? "&" : "?";
  el.src = `${src}${join}_r=${Date.now()}`;
  return true;
}

export const formatMoldNumber = (value) => {
  if (value == null || value === "") return "—";
  const num = parseInt(String(value).replace(/,/g, ""), 10);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("vi-VN");
};

export const formatMoldNumberCompact = (value) => {
  const num = parseInt(String(value ?? "").replace(/,/g, ""), 10);
  if (Number.isNaN(num)) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString("vi-VN");
};

export const getMoldFilterOptions = (molds, columnName) =>
  Array.from(
    new Set(
      molds
        .map((m) => m[columnName])
        .filter((v) => v !== undefined && v !== ""),
    ),
  ).sort();

export const getColumnTranslationKey = (col) => {
  if (col.startsWith("Prev ") && col.includes("Shots")) return "prevShots";
  return MOLD_COLUMN_TRANSLATION_KEYS[col] || col;
};

export const getPrevMonthLabel = () => {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (month === 0) {
    year -= 1;
    month = 11;
  } else {
    month -= 1;
  }
  const mm = String(month + 1).padStart(2, "0");
  return `Prev ${mm} Shots`;
};

export const normalizeMoldForSave = (obj, id, no, columns = MOLD_COLUMNS) => {
  const result = { id, No: no };
  columns.forEach((col) => {
    if (col === "No") return;
    result[toSafeKey(col)] = obj[col] ?? "";
  });
  return result;
};
