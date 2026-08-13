import { memo, useEffect, useMemo, useState } from "react";

/**
 * Đồng hồ sidebar — state riêng để không re-render cả trang Điểm danh mỗi giây.
 */
function AttendanceSidebarClock({ displayLocale }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const sidebarDate = useMemo(
    () =>
      now.toLocaleDateString(displayLocale, {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [now, displayLocale],
  );

  const sidebarTime = useMemo(
    () =>
      now.toLocaleTimeString(displayLocale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [now, displayLocale],
  );

  return (
    <time
      className="attendance-with-sidebar__brand-datetime"
      dateTime={now.toISOString()}
    >
      <span className="attendance-with-sidebar__brand-date">{sidebarDate}</span>
      <span className="attendance-with-sidebar__brand-time">{sidebarTime}</span>
    </time>
  );
}

export default memo(AttendanceSidebarClock);
