const UNATTENDED_SESSION_STORAGE_PREFIX =
  "attendance_unattended_prompt_suppress_session:";

function unattendedSessionSuppressStorageKey(uid) {
  return `${UNATTENDED_SESSION_STORAGE_PREFIX}${uid || "anon"}`;
}

/** Popup «Nhân viên chưa điểm danh»: không tự mở lại sau khi user chọn ẩn trong phiên (sessionStorage). */
export function readUnattendedSessionSuppressed(uid) {
  try {
    return (
      sessionStorage.getItem(unattendedSessionSuppressStorageKey(uid)) === "1"
    );
  } catch {
    return false;
  }
}

export function writeUnattendedSessionSuppressed(uid, value) {
  try {
    const k = unattendedSessionSuppressStorageKey(uid);
    if (value) sessionStorage.setItem(k, "1");
    else sessionStorage.removeItem(k);
  } catch {
    /* ignore quota / private mode */
  }
}
