export function scheduleManualStorePersist(storageKey, store) {
  const payload = JSON.stringify(store);

  const write = () => {
    try {
      window.localStorage.setItem(storageKey, payload);
    } catch {
      // Ignore quota / private mode errors — Firebase remains source of truth.
    }
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(write, { timeout: 2000 });
    return;
  }

  queueMicrotask(write);
}
