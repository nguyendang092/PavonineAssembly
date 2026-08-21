import {
  extractMonthSlice,
  manualEntriesArchiveRoot,
  removeMonthFromStore,
} from "./manualEntriesMonthUtils";

/**
 * Build Firebase patch: copy tháng sang archive node, xóa khỏi node chính.
 * @param {string} firebaseRoot
 * @param {string} monthKey
 * @param {Record<string, unknown>} store
 */
export function buildArchiveMonthPatch(firebaseRoot, monthKey, store) {
  const slice = extractMonthSlice(store, monthKey);
  const archiveRoot = manualEntriesArchiveRoot(firebaseRoot);
  /** @type {Record<string, unknown>} */
  const patch = {
    [`${archiveRoot}/${monthKey}/_archivedAt`]: Date.now(),
  };

  for (const [dateKey, day] of Object.entries(slice)) {
    patch[`${archiveRoot}/${monthKey}/${dateKey}`] = day;
    patch[`${firebaseRoot}/${dateKey}`] = null;
  }

  patch[`${firebaseRoot}/_meta/archive/${monthKey}`] = Date.now();
  return patch;
}

/** @param {Record<string, unknown>} store @param {string} monthKey */
export function applyArchiveMonthLocally(store, monthKey) {
  return removeMonthFromStore(store, monthKey);
}
