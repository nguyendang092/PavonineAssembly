import { useCallback } from "react";

import { comboStatI18nKey } from "./attendanceComboChartConfig";

/** `tl` + locale hiển thị ngày cho AttendanceList. */
export function useAttendanceListI18n(t, i18n) {
  const tl = useCallback(
    (key, defaultValue, options = {}) =>
      t(`attendanceList.${key}`, {
        ...(defaultValue !== undefined ? { defaultValue } : {}),
        ...options,
      }),
    [t],
  );
  const tlComboStat = useCallback(
    (metricKey) => t(`attendanceList.${comboStatI18nKey(metricKey)}`),
    [t],
  );
  const displayLocale = i18n.language?.startsWith("ko") ? "ko-KR" : "vi-VN";
  return { tl, tlComboStat, displayLocale };
}
