import { useCallback } from "react";

/** `tl` + locale hiển thị ngày cho AttendanceList. */
export function useAttendanceListI18n(t, i18n) {
  const tl = useCallback(
    (key, defaultValue, options = {}) =>
      t(`attendanceList.${key}`, { defaultValue, ...options }),
    [t],
  );
  const displayLocale = i18n.language?.startsWith("ko") ? "ko-KR" : "vi-VN";
  return { tl, displayLocale };
}
