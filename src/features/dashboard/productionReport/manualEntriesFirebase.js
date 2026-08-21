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

/**
 * Firebase RTDB patch for partial writes (only changed date nodes + meta).
 * @param {ReturnType<typeof normalizeManualStore>} store
 * @param {ReturnType<typeof normalizeManualStore>} previousStore
 * @param {string[]} touchedDateKeys
 */
export function buildManualEntriesFirebasePatch(
  store,
  previousStore,
  touchedDateKeys,
) {
  /** @type {Record<string, unknown>} */
  const patch = {
    "_meta/updatedAt": Date.now(),
  };

  for (const dateKey of touchedDateKeys) {
    const nextDay = store?.[dateKey];
    const prevDay = previousStore?.[dateKey];

    if (nextDay === undefined) {
      if (prevDay !== undefined) {
        patch[dateKey] = null;
      }
      continue;
    }

    if (JSON.stringify(nextDay) !== JSON.stringify(prevDay)) {
      patch[dateKey] = nextDay;
    }
  }

  return patch;
}

/** @param {Record<string, unknown>} patch */
export function patchHasManualEntryChanges(patch) {
  return Object.keys(patch).some((key) => key !== "_meta/updatedAt");
}
