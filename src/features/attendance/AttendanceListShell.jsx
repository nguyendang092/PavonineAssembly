import { memo, useMemo, Suspense } from "react";
import AttendanceSidebarClock from "./AttendanceSidebarClock";
import useAttendanceSidebarCollapse from "./useAttendanceSidebarCollapse";
import SidebarNavLink from "./SidebarNavLink";
import ProductionRouteFallback from "@/features/production/ProductionRouteFallback";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUserIdentity, useUserPermissions } from "@/contexts/UserContext";
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
  koreanTimesheet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <path d="M7 13h3M14 13h3M7 17h10" />
    </svg>
  ),
  seasonal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      <circle cx="3" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
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
  const { user } = useUserIdentity();
  const { userRole } = useUserPermissions();
  const canAccessKoreanTimesheet = canViewKoreanTimesheet(user, userRole);
  const {
    navRef,
    forceCollapsed,
    handleNavClick,
    handleNavMouseLeave,
    handleMainMouseEnter,
  } = useAttendanceSidebarCollapse();

  const displayLocale = useMemo(() => {
    const lang = (i18n.language || "vi").toLowerCase();
    if (lang.startsWith("ko")) return "ko-KR";
    return "vi-VN";
  }, [i18n.language]);

  const dateKey = useMemo(() => {
    if (contextDate && /^\d{4}-\d{2}-\d{2}$/.test(contextDate)) {
      return contextDate;
    }
    return new Date().toISOString().slice(0, 10);
  }, [contextDate]);

  const isAttendanceActive =
    pathname === "/attendance-list" || pathname.startsWith("/attendance-list");

  const isSeasonalActive =
    pathname === "/seasonal-staff-attendance" ||
    pathname.startsWith("/seasonal-staff-attendance");

  const isKoreanTimesheetActive =
    pathname === "/korean-timesheet" ||
    pathname.startsWith("/korean-timesheet");

  const isWorkHoursActive =
    pathname === "/attendance-salary" ||
    pathname.startsWith("/attendance-salary");

  const isAnnualLeaveActive =
    pathname === "/annual-leave" || pathname.startsWith("/annual-leave");

  const isDashboardActive =
    pathname === "/attendance-dashboard" ||
    pathname.startsWith("/attendance-dashboard");

  const itemClass = (active, tone) =>
    `attendance-with-sidebar__item attendance-with-sidebar__item--${tone}${
      active ? " attendance-with-sidebar__item--active" : ""
    }`;

  return (
    <div
      className={`attendance-with-sidebar${
        forceCollapsed ? " attendance-with-sidebar--force-collapsed" : ""
      }`}
    >
      <aside
        ref={navRef}
        onClickCapture={handleNavClick}
        onMouseLeave={handleNavMouseLeave}
        className="attendance-with-sidebar__nav"
        aria-label={t("attendanceList.sidebarAria", "Menu nhân sự")}
      >
        <div className="attendance-with-sidebar__brand">
          <span className="attendance-with-sidebar__brand-mark" aria-hidden>
            P
          </span>
          <div className="attendance-with-sidebar__brand-copy">
            <span className="attendance-with-sidebar__brand-title">
              Pavonine
            </span>
            <span className="attendance-with-sidebar__brand-sub">
              {t("attendanceList.sidebarBrand", "HR Management")}
            </span>
          </div>
          <AttendanceSidebarClock displayLocale={displayLocale} />
        </div>

        <p className="attendance-with-sidebar__section">
          {t("attendanceList.sidebarSection", "Chấm công & nhân sự")}
        </p>

        <nav className="attendance-with-sidebar__links">
          <SidebarNavLink
            to="/attendance-list"
            className={itemClass(isAttendanceActive, "blue")}
          >
            <SidebarItemContent
              tone="blue"
              icon={ICONS.attendance}
              label={t("attendanceList.sidebarAttendance", "Điểm danh")}
            />
          </SidebarNavLink>

          <SidebarNavLink
            to={`/seasonal-staff-attendance?date=${encodeURIComponent(dateKey)}`}
            className={itemClass(isSeasonalActive, "teal")}
          >
            <SidebarItemContent
              tone="teal"
              icon={ICONS.seasonal}
              label={t("attendanceList.sidebarSeasonal", "Thời vụ")}
            />
          </SidebarNavLink>

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
            <SidebarNavLink
              to={`/attendance-list?date=${encodeURIComponent(dateKey)}`}
              className={itemClass(false, "violet")}
            >
              <SidebarItemContent
                tone="violet"
                icon={ICONS.statistics}
                label={t("attendanceList.sidebarStatistics", "Thống kê")}
              />
            </SidebarNavLink>
          )}

          <SidebarNavLink
            to={payrollPathForDateKey(dateKey)}
            className={itemClass(isWorkHoursActive, "emerald")}
          >
            <SidebarItemContent
              tone="emerald"
              icon={ICONS.workHours}
              label={t("attendanceList.sidebarWorkHours", "Giờ công")}
            />
          </SidebarNavLink>

          <SidebarNavLink
            to={annualLeavePathForDateKey(dateKey)}
            className={itemClass(isAnnualLeaveActive, "amber")}
          >
            <SidebarItemContent
              tone="amber"
              icon={ICONS.annualLeave}
              label={t("attendanceList.sidebarAnnualLeave", "Phép năm")}
            />
          </SidebarNavLink>

          <SidebarNavLink
            to={`/attendance-dashboard?date=${encodeURIComponent(dateKey)}`}
            className={itemClass(isDashboardActive, "indigo")}
          >
            <SidebarItemContent
              tone="indigo"
              icon={ICONS.dashboard}
              label={t("attendanceList.sidebarDashboard", "Dashboard")}
            />
          </SidebarNavLink>

          {canAccessKoreanTimesheet ? (
            <SidebarNavLink
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
            </SidebarNavLink>
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

        </nav>

        <div className="attendance-with-sidebar__footer">
          <span className="attendance-with-sidebar__footer-dot" aria-hidden />
          <span>{t("attendanceList.sidebarFooter", "Hệ thống quản lý")}</span>
        </div>
      </aside>
      <div
        id="hr-page-main-scroll"
        className="attendance-with-sidebar__main"
        onMouseEnter={handleMainMouseEnter}
      >
        <Suspense fallback={<ProductionRouteFallback />}>
          {children}
        </Suspense>
      </div>
    </div>
  );
}

export default memo(AttendanceListShell);
