const LS_KEY = "pavonineWarehouseInvMonthSnapshots_v1";

export function loadMonthSnapshots() {
  try {
    const j = localStorage.getItem(LS_KEY);
    if (!j) return {};
    const o = JSON.parse(j);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

export function persistMonthSnapshots(store) {
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

/**
 * @param {Record<string, unknown>} store
 * @param {{ sortKey: string; displayLabel: string; fileName: string; rows: object[] }} snap
 */
export function upsertMonthSnapshot(store, snap) {
  return {
    ...store,
    [snap.sortKey]: {
      displayLabel: snap.displayLabel,
      fileName: snap.fileName,
      savedAt: new Date().toISOString(),
      rows: JSON.parse(JSON.stringify(snap.rows)),
    },
  };
}

/** @param {Record<string, unknown>} store */
export function removeMonthSnapshot(store, sortKey) {
  const next = { ...store };
  delete next[sortKey];
  return next;
}

export function clearAllMonthSnapshots() {
  localStorage.removeItem(LS_KEY);
}

/**
 * Gộp các kỳ đã lưu thành danh sách dòng (month gán theo nhãn kỳ).
 * @param {Record<string, { displayLabel: string; rows: object[] }>} store
 */
export function flattenSnapshotsToRows(store) {
  const keys = Object.keys(store).sort();
  const out = [];
  for (const k of keys) {
    const s = store[k];
    if (!s?.rows || !Array.isArray(s.rows)) continue;
    const label = String(s.displayLabel ?? k);
    for (const r of s.rows) {
      out.push({ ...r, month: label });
    }
  }
  return out;
}
