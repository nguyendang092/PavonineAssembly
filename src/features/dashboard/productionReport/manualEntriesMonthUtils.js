import { addMonths, format, getDaysInMonth, parseISO } from "date-fns";
import { parseMonthKey } from "../s90d/lib/s90dDateUtils";

/** Số tháng giữ ở node chính trước khi đủ điều kiện archive (lazy). */
export const MANUAL_ENTRIES_ARCHIVE_AFTER_MONTHS = 12;

/** @param {string} monthKey yyyy-MM */
export function monthKeyToDateRange(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  const start = format(new Date(year, month, 1), "yyyy-MM-dd");
  const end = format(
    new Date(year, month, getDaysInMonth(new Date(year, month, 1))),
    "yyyy-MM-dd",
  );
  return { start, end };
}

/** @param {string} monthKey */
export function adjacentMonthKeys(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  const anchor = new Date(year, month, 1);
  return {
    prev: format(addMonths(anchor, -1), "yyyy-MM"),
    next: format(addMonths(anchor, 1), "yyyy-MM"),
  };
}

/** Tháng cần subscribe: đang xem + liền kề (prefetch). */
export function subscriptionMonthKeys(selectedMonthKey) {
  const { prev, next } = adjacentMonthKeys(selectedMonthKey);
  return [prev, selectedMonthKey, next];
}

/** @param {Record<string, unknown>} store */
export function extractMonthSlice(store, monthKey) {
  /** @type {Record<string, unknown>} */
  const slice = {};
  for (const dateKey of Object.keys(store ?? {})) {
    if (dateKey.startsWith(`${monthKey}-`)) {
      slice[dateKey] = store[dateKey];
    }
  }
  return slice;
}

/** @param {Record<string, unknown>} store */
export function removeMonthFromStore(store, monthKey) {
  const next = { ...store };
  for (const dateKey of Object.keys(next)) {
    if (dateKey.startsWith(`${monthKey}-`)) {
      delete next[dateKey];
    }
  }
  return next;
}

/** @param {Record<string, unknown>} store */
export function mergeMonthSliceIntoStore(store, monthKey, monthSlice) {
  const next = removeMonthFromStore(store ?? {}, monthKey);
  for (const [dateKey, day] of Object.entries(monthSlice ?? {})) {
    next[dateKey] = day;
  }
  return next;
}

/** Hash nhẹ cho so sánh tháng — tránh JSON.stringify toàn store. */
export function computeMonthChecksum(monthSlice) {
  const keys = Object.keys(monthSlice ?? {}).sort();
  let hash = 5381;
  for (const key of keys) {
    const payload = JSON.stringify(monthSlice[key]);
    hash = (hash * 33) ^ key.charCodeAt(0);
    for (let index = 0; index < payload.length; index += 1) {
      hash = (hash * 33) ^ payload.charCodeAt(index);
    }
  }
  return `${keys.length}:${(hash >>> 0).toString(36)}`;
}

/** @param {Record<string, unknown>} store */
export function listMonthKeysInStore(store) {
  const keys = new Set();
  for (const dateKey of Object.keys(store ?? {})) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      keys.add(dateKey.slice(0, 7));
    }
  }
  return Array.from(keys).sort();
}

/** Tháng đủ cũ để archive (lazy job). */
export function listArchivableMonthKeys(
  store,
  referenceDate = new Date(),
  thresholdMonths = MANUAL_ENTRIES_ARCHIVE_AFTER_MONTHS,
) {
  const cutoff = addMonths(
    new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1),
    -thresholdMonths,
  );
  const cutoffKey = format(cutoff, "yyyy-MM");

  return listMonthKeysInStore(store).filter((monthKey) => {
    try {
      const { year, month } = parseMonthKey(monthKey);
      const monthStart = new Date(year, month, 1);
      const cutoffStart = parseISO(`${cutoffKey}-01`);
      return monthStart < cutoffStart;
    } catch {
      return false;
    }
  });
}

/** @param {string} firebaseRoot e.g. s90d/manualEntries */
export function manualEntriesArchiveRoot(firebaseRoot) {
  return `${firebaseRoot}Archive`;
}
