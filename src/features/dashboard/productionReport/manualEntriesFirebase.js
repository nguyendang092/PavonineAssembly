/** @param {unknown} raw */
export function parseManualEntriesSnapshot(raw) {
  if (!raw || typeof raw !== "object") return {};
  const { _meta, ...entries } = raw;
  void _meta;
  return entries;
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
