import { memo, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { canViewKoreanTimesheet } from "@/config/featurePermissions";
import {
  annualLeavePathForDateKey,
  payrollPathForDateKey,
} from "@/features/leave/annualLeaveCrossLinks";

function SidebarItemContent({ icon, label, tone }) {
  return (
    <>
      <span className={`attendance-with-sidebar__icon attendance-with-sidebar__icon--${tone}`} aria-hidden>
        {icon}
      </span>
      <span className="attendance-with-sidebar__label">{label}</span>
    </>
  );
}

const ICONS = {
  attendance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  ),
  statistics: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <rect x="7" y="10" width="3" height="9" rx="0.5" />
      <rect x="12" y="7" width="3" height="12" rx="0.5" />
      <rect x="17" y="13" width="3" height="6" rx="0.5" />
    </svg>
  ),
  workHours: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  annualLeave: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M8 14h2M14 14h2M8 17h6" />
    </svg>
  ),
  personnel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M14 19c0-2.2 1.8-4 4-4" />
    </svg>
  ),
  koreanTimesheet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <path d="M7 13h3M14 13h3M7 17h10" />
    </svg>
  ),
};

function AttendanceListShell({
  children,
  contextDate,
  statisticsOpen = false,
  onOpenStatistics,
}) {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();
  const { user, userRole } = useUser();
  const canAccessKoreanTimesheet = canViewKoreanTimesheet(user, userRole);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const displayLocale = useMemo(() => {
    const lang = (i18n.language || "vi").toLowerCase();
    if (lang.startsWith("ko")) return "ko-KR";
    return "vi-VN";
  }, [i18n.language]);

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

  const dateKey = useMemo(() => {
    if (contextDate && /^\d{4}-\d{2}-\d{2}$/.test(contextDate)) {
      return contextDate;
    }
    return new Date().toISOString().slice(0, 10);
  }, [contextDate]);

  const isAttendanceActive =
    pathname === "/attendance-list" ||
    pathname === "/seasonal-staff-attendance" ||
    pathname.startsWith("/attendance-list");

  const isKoreanTimesheetActive =
    pathname === "/korean-timesheet" ||
    pathname.startsWith("/korean-timesheet");

  const isWorkHoursActive =
    pathname === "/attendance-salary" ||
    pathname.startsWith("/attendance-salary");

  const isAnnualLeaveActive =
    pathname === "/annual-leave" || pathname.startsWith("/annual-leave");

  const isPersonnelActive =
    pathname === "/user-department" ||
    pathname.startsWith("/user-department");

  const itemClass = (active, tone) =>
    `attendance-with-sidebar__item attendance-with-sidebar__item--${tone}${
      active ? " attendance-with-sidebar__item--active" : ""
    }`;

  return (
    <div className="attendance-with-sidebar">
      <aside
        className="attendance-with-sidebar__nav"
        aria-label={t("attendanceList.sidebarAria", "Menu nhân sự")}
      >
        <div className="attendance-with-sidebar__brand">
          <time
            className="attendance-with-sidebar__brand-datetime"
            dateTime={now.toISOString()}
          >
            <span className="attendance-with-sidebar__brand-date">
              {sidebarDate}
            </span>
            <span className="attendance-with-sidebar__brand-time">
              {sidebarTime}
            </span>
          </time>
          <div className="attendance-with-sidebar__brand-row">
            <span className="attendance-with-sidebar__brand-mark" aria-hidden>
              P
            </span>
            <div className="attendance-with-sidebar__brand-text">
              <span className="attendance-with-sidebar__brand-title">
                Pavonine
              </span>
              <span className="attendance-with-sidebar__brand-sub">
                {t("attendanceList.sidebarBrand", "HR Management")}
              </span>
            </div>
          </div>
        </div>

        <p className="attendance-with-sidebar__section">
          {t("attendanceList.sidebarSection", "Chấm công & nhân sự")}
        </p>

        <nav className="attendance-with-sidebar__links">
          <Link
            to="/attendance-list"
            className={itemClass(isAttendanceActive, "blue")}
          >
            <SidebarItemContent
              tone="blue"
              icon={ICONS.attendance}
              label={t("attendanceList.sidebarAttendance", "Điểm danh")}
            />
          </Link>

          {onOpenStatistics ? (
            <button
              type="button"
              className={itemClass(statisticsOpen, "violet")}
              onClick={onOpenStatistics}
            >
              <SidebarItemContent
                tone="violet"
                icon={ICONS.statistics}
                label={t("attendanceList.sidebarStatistics", "Thống kê")}
              />
            </button>
          ) : (
            <Link
              to={`/attendance-list?date=${encodeURIComponent(dateKey)}`}
              className={itemClass(false, "violet")}
            >
              <SidebarItemContent
                tone="violet"
                icon={ICONS.statistics}
                label={t("attendanceList.sidebarStatistics", "Thống kê")}
              />
            </Link>
          )}

          <Link
            to={payrollPathForDateKey(dateKey)}
            className={itemClass(isWorkHoursActive, "emerald")}
          >
            <SidebarItemContent
              tone="emerald"
              icon={ICONS.workHours}
              label={t("attendanceList.sidebarWorkHours", "Giờ công")}
            />
          </Link>

          <Link
            to={annualLeavePathForDateKey(dateKey)}
            className={itemClass(isAnnualLeaveActive, "amber")}
          >
            <SidebarItemContent
              tone="amber"
              icon={ICONS.annualLeave}
              label={t("attendanceList.sidebarAnnualLeave", "Phép năm")}
            />
          </Link>

          {canAccessKoreanTimesheet ? (
            <Link
              to={`/korean-timesheet?date=${encodeURIComponent(dateKey)}`}
              className={itemClass(isKoreanTimesheetActive, "sky")}
            >
              <SidebarItemContent
                tone="sky"
                icon={ICONS.koreanTimesheet}
                label={t(
                  "attendanceList.sidebarKoreanTimesheet",
                  "Korean Timesheet",
                )}
              />
            </Link>
          ) : (
            <span
              className={`${itemClass(false, "sky")} attendance-with-sidebar__item--disabled`}
              aria-disabled="true"
              title={t(
                "attendanceList.sidebarKoreanTimesheetDisabled",
                "Chỉ Admin hoặc HR mới truy cập được",
              )}
            >
              <SidebarItemContent
                tone="sky"
                icon={ICONS.koreanTimesheet}
                label={t(
                  "attendanceList.sidebarKoreanTimesheet",
                  "Korean Timesheet",
                )}
              />
            </span>
          )}

          <Link
            to="/user-department"
            className={itemClass(isPersonnelActive, "rose")}
          >
            <SidebarItemContent
              tone="rose"
              icon={ICONS.personnel}
              label={t("attendanceList.sidebarPersonnel", "Nhân sự")}
            />
          </Link>
        </nav>

        <div className="attendance-with-sidebar__footer">
          <span className="attendance-with-sidebar__footer-dot" aria-hidden />
          <span>{t("attendanceList.sidebarFooter", "Hệ thống quản lý")}</span>
        </div>
      </aside>
      <div className="attendance-with-sidebar__main">{children}</div>
    </div>
  );
}

export default memo(AttendanceListShell);
