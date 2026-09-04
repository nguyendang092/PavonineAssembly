import { useEffect, useState } from "react";
import {
  getTodayDateKeyLocal,
  msUntilNextLocalMidnight,
} from "@/utils/dateKey";

/**
 * Ngày hôm nay (local YYYY-MM-DD), tự cập nhật sau 00:00 hoặc khi tab được focus lại.
 */
export function useTodayDateKeyLocal() {
  const [todayKey, setTodayKey] = useState(() => getTodayDateKeyLocal());

  useEffect(() => {
    let timeoutId;
    let cancelled = false;

    const syncToday = () => {
      const current = getTodayDateKeyLocal();
      setTodayKey((prev) => (prev === current ? prev : current));
    };

    const scheduleNextMidnight = () => {
      if (cancelled) return;
      timeoutId = window.setTimeout(() => {
        syncToday();
        scheduleNextMidnight();
      }, msUntilNextLocalMidnight());
    };

    scheduleNextMidnight();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncToday();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return todayKey;
}
