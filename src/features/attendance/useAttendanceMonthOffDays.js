import { useCallback, useEffect, useMemo, useState } from "react";
import { isAdminAccess } from "@/config/authRoles";
import { fetchOffAndHolidayDateKeysInMonth } from "./attendanceMonthOffDays";
import { ISO_DATE_KEY_RE } from "./attendanceListShared";

/** Danh sách ngày off/lễ/nghỉ bù trong tháng (admin). */
export function useAttendanceMonthOffDays({
  user,
  userRole,
  selectedDate,
  attendanceRootPath,
  tl,
}) {
  const [monthOffAndHoliday, setMonthOffAndHoliday] = useState({
    off: [],
    holiday: [],
    compensatory: [],
  });
  const [monthOffDaysLoading, setMonthOffDaysLoading] = useState(false);

  const refreshMonthOffDays = useCallback(async () => {
    if (!user || !isAdminAccess(user, userRole)) {
      setMonthOffAndHoliday({ off: [], holiday: [], compensatory: [] });
      return;
    }
    if (!selectedDate || !ISO_DATE_KEY_RE.test(selectedDate)) {
      setMonthOffAndHoliday({ off: [], holiday: [], compensatory: [] });
      return;
    }
    setMonthOffDaysLoading(true);
    setMonthOffAndHoliday({ off: [], holiday: [], compensatory: [] });
    try {
      const oh = await fetchOffAndHolidayDateKeysInMonth(
        selectedDate,
        attendanceRootPath,
      );
      setMonthOffAndHoliday(oh);
    } catch (err) {
      console.error("refreshMonthOffDays:", err);
      setMonthOffAndHoliday({ off: [], holiday: [], compensatory: [] });
    } finally {
      setMonthOffDaysLoading(false);
    }
  }, [user, userRole, selectedDate, attendanceRootPath]);

  useEffect(() => {
    void refreshMonthOffDays();
  }, [refreshMonthOffDays]);

  const dayOffToolbarButtonTitle = useMemo(() => {
    const hint = tl(
      "dayOffToolbarHint",
      "Mở danh sách ngày off và ngày lễ trong tháng; chỉnh sửa trong cửa sổ đầy đủ.",
    );
    const { off, holiday, compensatory } = monthOffAndHoliday;
    if (off.length === 0 && holiday.length === 0 && compensatory.length === 0)
      return hint;
    return `${hint}\n${tl(
      "dayOffToolbarTitleDates",
      "Ngày off trong tháng (YYYY-MM-DD):",
    )} ${off.join(", ")}\n${tl(
      "dayOffToolbarTitleHolidayDates",
      "Ngày lễ trong tháng (YYYY-MM-DD):",
    )} ${holiday.join(", ")}\n${tl(
      "dayOffToolbarTitleCompensatoryDates",
      "Ngày nghỉ bù trong tháng (YYYY-MM-DD):",
    )} ${compensatory.join(", ")}`;
  }, [monthOffAndHoliday, tl]);

  return {
    monthOffAndHoliday,
    monthOffDaysLoading,
    refreshMonthOffDays,
    dayOffToolbarButtonTitle,
  };
}
