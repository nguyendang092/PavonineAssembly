const QUEUE_SUFFIX = ":pending-writes-v1";

function queueStorageKey(storageKey) {
  return `${storageKey}${QUEUE_SUFFIX}`;
}

/** @typedef {{ id: string, enqueuedAt: number, dateKeys: string[], days: Record<string, unknown>, process: string }} PendingManualWrite */

/** @param {string} storageKey */
export function loadPendingWrites(storageKey) {
  try {
    const raw = window.localStorage.getItem(queueStorageKey(storageKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {string} storageKey @param {PendingManualWrite[]} queue */
export function savePendingWrites(storageKey, queue) {
  try {
    window.localStorage.setItem(queueStorageKey(storageKey), JSON.stringify(queue));
  } catch {
    // ignore quota errors
  }
}

/** @param {string} storageKey @param {Omit<PendingManualWrite, 'id'|'enqueuedAt'>} write */
export function enqueuePendingWrite(storageKey, write) {
  const queue = loadPendingWrites(storageKey);
  queue.push({
    ...write,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enqueuedAt: Date.now(),
  });
  savePendingWrites(storageKey, queue);
  return queue.length;
}

/** @param {string} storageKey @param {string} writeId */
export function dequeuePendingWrite(storageKey, writeId) {
  const queue = loadPendingWrites(storageKey).filter((item) => item.id !== writeId);
  savePendingWrites(storageKey, queue);
  return queue.length;
}

/** @param {string} storageKey */
export function pendingWriteCount(storageKey) {
  return loadPendingWrites(storageKey).length;
}
