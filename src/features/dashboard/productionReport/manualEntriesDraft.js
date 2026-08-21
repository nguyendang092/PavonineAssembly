const DRAFT_SUFFIX = ":draft-v1";

function draftStorageKey(storageKey, process, monthKey) {
  return `${storageKey}${DRAFT_SUFFIX}:${process}:${monthKey}`;
}

/** @param {string} storageKey @param {string} process @param {string} monthKey */
export function loadProcessDraft(storageKey, process, monthKey) {
  try {
    const raw = window.localStorage.getItem(
      draftStorageKey(storageKey, process, monthKey),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** @param {string} storageKey @param {string} process @param {string} monthKey @param {{ localByDate: Record<string, unknown>, selectedDateKey: string, savedAt: number }} draft */
export function saveProcessDraft(storageKey, process, monthKey, draft) {
  try {
    window.localStorage.setItem(
      draftStorageKey(storageKey, process, monthKey),
      JSON.stringify({
        localByDate: draft.localByDate ?? {},
        selectedDateKey: draft.selectedDateKey ?? "",
        savedAt: draft.savedAt ?? Date.now(),
      }),
    );
  } catch {
    // ignore quota errors
  }
}

/** @param {string} storageKey @param {string} process @param {string} monthKey */
export function clearProcessDraft(storageKey, process, monthKey) {
  try {
    window.localStorage.removeItem(draftStorageKey(storageKey, process, monthKey));
  } catch {
    // ignore
  }
}
