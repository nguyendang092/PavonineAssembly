const EARLY_OT_SESSION_STORAGE_PREFIX =
  "payroll_earlyOt_prompt_suppress_session:";

function earlyOtSessionSuppressStorageKey(uid) {
  return `${EARLY_OT_SESSION_STORAGE_PREFIX}${uid || "anon"}`;
}

export function readEarlyOtSessionSuppressed(uid) {
  try {
    return sessionStorage.getItem(earlyOtSessionSuppressStorageKey(uid)) === "1";
  } catch {
    return false;
  }
}

export function writeEarlyOtSessionSuppressed(uid, value) {
  try {
    const k = earlyOtSessionSuppressStorageKey(uid);
    if (value) sessionStorage.setItem(k, "1");
    else sessionStorage.removeItem(k);
  } catch {
    /* ignore quota / private mode */
  }
}
