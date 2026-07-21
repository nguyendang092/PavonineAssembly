import { WORKPLACE_PRODUCTION_PATHS_S90D } from "../../workplace/workplaceProductionPaths";
import { normalizeManualStore } from "./s90dManualEntries";

export const S90D_MANUAL_ENTRIES_FIREBASE_ROOT =
  WORKPLACE_PRODUCTION_PATHS_S90D.manualEntriesRoot;

/** @param {unknown} raw */
export function parseS90dManualEntriesSnapshot(raw) {
  if (!raw || typeof raw !== "object") return {};
  const { _meta, ...entries } = raw;
  void _meta;
  return normalizeManualStore(entries);
}

/** @param {ReturnType<typeof normalizeManualStore>} store */
export function serializeS90dManualEntriesForFirebase(store) {
  return {
    ...store,
    _meta: {
      updatedAt: Date.now(),
    },
  };
}

export function buildS90dDefectImageUploadPrefix({
  dateKey,
  boardId = "",
  process,
  shiftSlot,
  defectKey,
}) {
  const safe = (value) =>
    String(value ?? "")
      .trim()
      .replace(/[^\w-]+/g, "_");
  return [
    "s90d_defect",
    safe(dateKey),
    safe(boardId),
    safe(process),
    safe(shiftSlot),
    safe(defectKey),
  ]
    .filter(Boolean)
    .join("_");
}
