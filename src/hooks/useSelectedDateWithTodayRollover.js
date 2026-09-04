import { useCallback, useEffect, useRef, useState } from "react";
import { getTodayDateKeyLocal } from "@/utils/dateKey";
import { ISO_DATE_KEY_RE } from "@/features/attendance/attendanceListShared";
import { useTodayDateKeyLocal } from "./useTodayDateKeyLocal";

/**
 * `selectedDate` tự chuyển sang ngày mới lúc 00:00 nếu user đang xem «hôm nay»
 * (chưa chọn ngày khác bằng tay).
 * @param {string | null | undefined} urlDateKey — `?date=` từ URL, nếu có.
 */
export function useSelectedDateWithTodayRollover(urlDateKey = null) {
  const todayKey = useTodayDateKeyLocal();
  const urlPinned = Boolean(urlDateKey && ISO_DATE_KEY_RE.test(urlDateKey));
  const followTodayRef = useRef(
    !urlPinned || urlDateKey === getTodayDateKeyLocal(),
  );
  const [selectedDate, setSelectedDateState] = useState(() =>
    urlPinned ? urlDateKey : getTodayDateKeyLocal(),
  );

  useEffect(() => {
    if (!urlDateKey || !ISO_DATE_KEY_RE.test(urlDateKey)) return;
    followTodayRef.current = urlDateKey === getTodayDateKeyLocal();
    setSelectedDateState(urlDateKey);
  }, [urlDateKey]);

  useEffect(() => {
    if (!followTodayRef.current) return;
    setSelectedDateState(todayKey);
  }, [todayKey]);

  const setSelectedDate = useCallback((next) => {
    setSelectedDateState((prev) => {
      const raw =
        typeof next === "function"
          ? next(prev)
          : String(next ?? "").trim();
      const value = ISO_DATE_KEY_RE.test(raw) ? raw : getTodayDateKeyLocal();
      followTodayRef.current = value === getTodayDateKeyLocal();
      return value;
    });
  }, []);

  return { selectedDate, setSelectedDate, todayKey };
}
