import {
  computeMonthChecksum,
  extractMonthSlice,
  mergeMonthSliceIntoStore,
} from "./manualEntriesMonthUtils";

/** @param {unknown} raw */
export function parseManualEntriesSnapshot(raw) {
  if (!raw || typeof raw !== "object") return {};
  const { _meta, ...entries } = raw;
  void _meta;
  return entries;
}

/** @param {Record<string, unknown>} store */
export function serializeManualEntriesForFirebase(store) {
  return {
    ...store,
    _meta: {
      updatedAt: Date.now(),
    },
  };
}

/** @param {string} monthKey @param {string} checksum */
export function buildMonthMetaPatch(monthKey, checksum) {
  return {
    [`_meta/months/${monthKey}/checksum`]: checksum,
    [`_meta/months/${monthKey}/updatedAt`]: Date.now(),
    "_meta/updatedAt": Date.now(),
  };
}

/**
 * @param {Record<string, unknown>} store
 * @param {string} monthKey
 * @param {Record<string, unknown>} monthSlice
 */
export function applyMonthSliceIfChanged(store, monthKey, monthSlice) {
  const checksum = computeMonthChecksum(monthSlice);
  const localSlice = extractMonthSlice(store, monthKey);
  if (computeMonthChecksum(localSlice) === checksum) {
    return { store, changed: false, checksum };
  }
  return {
    store: mergeMonthSliceIntoStore(store, monthKey, monthSlice),
    changed: true,
    checksum,
  };
}

/** @param {Record<string, unknown>} store @param {string[]} monthKeys */
export function buildMonthMetaOnlyPatch(store, monthKeys) {
  /** @type {Record<string, unknown>} */
  const patch = {
    "_meta/updatedAt": Date.now(),
  };

  for (const monthKey of monthKeys) {
    const slice = extractMonthSlice(store, monthKey);
    Object.assign(patch, buildMonthMetaPatch(monthKey, computeMonthChecksum(slice)));
  }

  return patch;
}
