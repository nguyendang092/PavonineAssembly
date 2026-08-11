import { normalizeManualStore } from "../s90d/lib/s90dManualEntries";

/** @param {unknown} raw */
export function parseManualEntriesSnapshot(raw) {
  if (!raw || typeof raw !== "object") return {};
  const { _meta, ...entries } = raw;
  void _meta;
  return normalizeManualStore(entries);
}

/** @param {ReturnType<typeof normalizeManualStore>} store */
export function serializeManualEntriesForFirebase(store) {
  return {
    ...store,
    _meta: {
      updatedAt: Date.now(),
    },
  };
}
