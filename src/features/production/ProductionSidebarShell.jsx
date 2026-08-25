import { memo, useMemo } from "react";
import { useLocation } from "react-router-dom";
import SidebarNavLink from "@/features/attendance/SidebarNavLink";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { isAdminAccess } from "@/config/authRoles";
import { canViewKoreanTimesheet } from "@/config/featurePermissions";
import {
  annualLeavePathForDateKey,
  payrollPathForDateKey,
} from "@/features/leave/annualLeaveCrossLinks";
import AttendanceSidebarClock from "@/features/attendance/AttendanceSidebarClock";
import useAttendanceSidebarCollapse from "@/features/attendance/useAttendanceSidebarCollapse";
import { PRODUCTION_SIDEBAR_SECTIONS } from "./productionSidebarConfig";

function SidebarItemContent({ icon, label, tone }) {
  return (
    <>
      <span
        className={`attendance-with-sidebar__icon attendance-with-sidebar__icon--${tone}`}
        aria-hidden
      >
        {icon}
      </span>
      <span className="attendance-with-sidebar__label">{label}</span>
    </>
  );
}

const ICONS = {
  temperature: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M14 4v8.5a4 4 0 1 1-4 0V4a2 2 0 1 1 4 0Z" />
    </svg>
  ),
  mold: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  qr: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="4" y="4" width="6" height="6" />
      <rect x="14" y="4" width="6" height="6" />
      <rect x="4" y="14" width="6" height="6" />
      <path d="M14 14h2v2h-2zM18 14h2v6h-6v-2h4zM14 18h2v2h-2z" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <rect x="7" y="10" width="3" height="9" rx="0.5" />
      <rect x="12" y="7" width="3" height="12" rx="0.5" />
      <rect x="17" y="13" width="3" height="6" rx="0.5" />
    </svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  ),
  inventory: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M3 9l9-5 9 5v10l-9 5-9-5V9Z" />
      <path d="M12 4v20M3 9l9 5 9-5" />
    </svg>
  ),
  defect: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  ),
  attendance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M8 14h2M14 14h2M8 17h6" />
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
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  ),
  koreanTimesheet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <path d="M7 13h3M14 13h3M7 17h10" />
    </svg>
  ),
  certificate: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="8" r="4" />
      <path d="M8 14h8l-1 7-3-2-3 2-1-7Z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-2.2 2.7-4 6-4s6 1.8 6 4" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21 19c0-1.5-1.8-2.8-4-3" />
    </svg>
  ),
  permissions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3 4 7v6c0 5 3.5 7.7 8 8 4.5-.3 8-3 8-8V7l-8-4Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
};

const ITEM_ICONS = {
  "/nhietdo": ICONS.temperature,
  "/mold": ICONS.mold,
  "/qr-code-generator": ICONS.qr,
  "/normal": ICONS.chart,
  "/s90d-production-report": ICONS.report,
  "/ap5-production-report": ICONS.report,
  "/performance": ICONS.chart,
  "/stock-variance": ICONS.inventory,
  "/mc-defect-report": ICONS.defect,
  "/attendance-daily-report": ICONS.attendance,
  "/attendance-list": ICONS.attendance,
  "/seasonal-staff-attendance": ICONS.seasonal,
  "/attendance-salary": ICONS.workHours,
  "/annual-leave": ICONS.annualLeave,
  "/attendance-dashboard": ICONS.dashboard,
  "/korean-timesheet": ICONS.koreanTimesheet,
  "/bangkhen1": ICONS.certificate,
  "/bangkhen2": ICONS.certificate,
  "/user-department": ICONS.users,
  "/permission-catalog": ICONS.permissions,
};

function isItemVisible(item, user, userRole) {
  if (item.adminOnly && !isAdminAccess(user, userRole)) return false;
  if (item.koreanOnly && !canViewKoreanTimesheet(user, userRole)) return false;
  return true;
}

function ProductionSidebarShell({ children }) {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();
  const { user, userRole } = useUser();

  const displayLocale = useMemo(() => {
    const lang = (i18n.language || "vi").toLowerCase();
    return lang.startsWith("ko") ? "ko-KR" : "vi-VN";
  }, [i18n.language]);

  const todayKey = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );

  const itemClass = (active, tone) =>
    `attendance-with-sidebar__item attendance-with-sidebar__item--${tone}${
      active ? " attendance-with-sidebar__item--active" : ""
    }`;

  const isPathActive = (path) =>
    pathname === path || pathname.startsWith(`${path}/`);

  const resolveTo = (item) => {
    if (item.resolvePayrollPath) {
      return payrollPathForDateKey(todayKey);
    }
    if (item.resolveAnnualLeavePath) {
      return annualLeavePathForDateKey(todayKey);
    }
    if (item.appendTodayDate) {
      return `${item.path}?date=${encodeURIComponent(todayKey)}`;
    }
    return item.path;
  };

  const visibleSections = useMemo(
    () =>
      PRODUCTION_SIDEBAR_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => isItemVisible(item, user, userRole)),
      })).filter((section) => section.items.length > 0),
    [user, userRole],
  );

  const {
    navRef,
    forceCollapsed,
    handleNavClick,
    handleNavMouseLeave,
    handleMainMouseEnter,
  } = useAttendanceSidebarCollapse();

  return (
    <div
      className={`attendance-with-sidebar production-with-sidebar${
        forceCollapsed ? " attendance-with-sidebar--force-collapsed" : ""
      }`}
    >
      <aside
        ref={navRef}
        onClickCapture={handleNavClick}
        onMouseLeave={handleNavMouseLeave}
        className="attendance-with-sidebar__nav"
        aria-label={t("productionSidebar.aria", "Menu sản xuất")}
      >
        <div className="attendance-with-sidebar__brand production-with-sidebar__brand">
          <span className="attendance-with-sidebar__brand-mark" aria-hidden>
            P
          </span>
          <div className="attendance-with-sidebar__brand-copy">
            <span className="attendance-with-sidebar__brand-title">
              Pavonine
            </span>
            <span className="attendance-with-sidebar__brand-sub">
              {t("productionSidebar.brand", "Production")}
            </span>
          </div>
          <AttendanceSidebarClock displayLocale={displayLocale} />
        </div>

        <nav className="attendance-with-sidebar__links production-with-sidebar__links">
          {visibleSections.map((section) => (
            <div key={section.sectionKey} className="production-with-sidebar__group">
              <p className="production-with-sidebar__group-title">
                {t(section.sectionKey, section.sectionDefault)}
              </p>
              {section.items.map((item) => (
                <SidebarNavLink
                  key={item.path}
                  to={resolveTo(item)}
                  className={itemClass(isPathActive(item.path), item.tone)}
                >
                  <SidebarItemContent
                    tone={item.tone}
                    icon={ITEM_ICONS[item.path]}
                    label={t(item.labelKey, item.labelDefault)}
                  />
                </SidebarNavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="attendance-with-sidebar__footer">
          <span className="attendance-with-sidebar__footer-dot" aria-hidden />
          <span>
            {t("productionSidebar.footer", "Hệ thống quản lý")}
          </span>
        </div>
      </aside>
      <div
        className="attendance-with-sidebar__main production-with-sidebar__main"
        onMouseEnter={handleMainMouseEnter}
      >
        {children}
      </div>
    </div>
  );
}

export default memo(ProductionSidebarShell);
