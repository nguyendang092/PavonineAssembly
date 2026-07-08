import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  formatAnnualLeaveDecimal,
  parseAnnualLeaveNumber,
} from "./annualLeaveCalculated";
import {
  annualLeavePathForDateKey,
  attendanceListPathForAnnualLeaveYear,
} from "./annualLeaveCrossLinks";
import "./annualLeaveManager.css";
import "./annualLeaveDetailSidebar.css";
import AnnualLeaveEmployeeTimePopup from "./AnnualLeaveEmployeeTimePopup";

function getEmployeeInitials(fullName) {
  const parts = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function AnnualLeaveDetailSidebar({ row, year, t, onClose, onOpenWorkHours }) {
  const name = row[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "";
  const mnv = String(row[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? "").trim();
  const dept = String(row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] ?? "").trim();
  const annualLeavePath = annualLeavePathForDateKey(`${year}-06-01`);
  const attendancePath = attendanceListPathForAnnualLeaveYear(year);

  const navItems = [
    {
      key: "home",
      to: attendancePath,
      label: t("annualLeave.sidebarHome", { defaultValue: "Trang chủ" }),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
        </svg>
      ),
      active: false,
    },
    {
      key: "leave",
      to: annualLeavePath,
      label: t("annualLeave.sidebarLeave", { defaultValue: "Nghỉ phép" }),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 11h18" />
        </svg>
      ),
      active: true,
    },
    {
      key: "attendance",
      action: "workHours",
      label: t("annualLeave.sidebarWorkHours", { defaultValue: "Chấm công" }),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      ),
      active: false,
    },
    {
      key: "personal",
      disabled: true,
      label: t("annualLeave.sidebarPersonal", { defaultValue: "Cá nhân" }),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
        </svg>
      ),
      active: false,
    },
  ];

  return (
    <aside className="annual-leave-detail-sidebar" aria-label={t("annualLeave.sidebarAria", { defaultValue: "Menu phép năm" })}>
      <div className="annual-leave-detail-sidebar-brand">
        <span className="annual-leave-detail-sidebar-brand-logo">Pavonine</span>
      </div>

      <div className="annual-leave-detail-sidebar-profile">
        <div className="annual-leave-detail-sidebar-avatar" aria-hidden>
          {getEmployeeInitials(name)}
        </div>
        <div className="annual-leave-detail-sidebar-profile-text">
          <p className="annual-leave-detail-sidebar-profile-name">{name}</p>
          <p className="annual-leave-detail-sidebar-profile-meta">
            {mnv ? `MNV ${mnv}` : "—"}
            {dept ? ` · ${dept}` : ""}
          </p>
        </div>
      </div>

      <nav className="annual-leave-detail-sidebar-nav">
        {navItems.map((item) =>
          item.active ? (
            <span
              key={item.key}
              className="annual-leave-detail-sidebar-link annual-leave-detail-sidebar-link-active"
              aria-current="page"
            >
              <span className="annual-leave-detail-sidebar-link-icon">{item.icon}</span>
              <span>{item.label}</span>
            </span>
          ) : item.action === "workHours" ? (
            <button
              key={item.key}
              type="button"
              className="annual-leave-detail-sidebar-link"
              onClick={onOpenWorkHours}
            >
              <span className="annual-leave-detail-sidebar-link-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ) : item.disabled ? (
            <span
              key={item.key}
              className="annual-leave-detail-sidebar-link annual-leave-detail-sidebar-link-disabled"
              aria-disabled="true"
            >
              <span className="annual-leave-detail-sidebar-link-icon">{item.icon}</span>
              <span>{item.label}</span>
            </span>
          ) : (
            <Link
              key={item.key}
              to={item.to}
              className="annual-leave-detail-sidebar-link"
              onClick={onClose}
            >
              <span className="annual-leave-detail-sidebar-link-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ),
        )}
      </nav>

      <Link
        to={annualLeavePath}
        className="annual-leave-detail-sidebar-cta"
        onClick={onClose}
      >
        <span aria-hidden>+</span>
        {t("annualLeave.sidebarCreateRequest", {
          defaultValue: "Tạo yêu cầu mới",
        })}
      </Link>
    </aside>
  );
}

function formatDateKeyDayMonth(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return dateKey;
  const [, m, d] = dateKey.split("-");
  if (!m || !d) return dateKey;
  return `${d}/${m}`;
}

function formatYearMonthVi(yearMonth) {
  if (!yearMonth || typeof yearMonth !== "string") return yearMonth;
  const [y, m] = yearMonth.split("-");
  if (!y || !m) return yearMonth;
  return `${m}/${y}`;
}

function normalizeUsageDetailMonths(detail) {
  if (!detail?.months) return [];
  return Array.isArray(detail.months) ? detail.months : [];
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatSummaryDayCount(value, t) {
  const n = parseAnnualLeaveNumber(value);
  const display = Number.isInteger(n) ? String(n) : formatAnnualLeaveDecimal(n);
  return { display, unit: t("annualLeave.dayUnit", { defaultValue: "Ngày" }) };
}

function monthHasUsage(month) {
  const days = Array.isArray(month?.days) ? month.days : [];
  return (
    days.length > 0 ||
    (month?.pnCount ?? 0) > 0 ||
    (month?.halfPnCount ?? 0) > 0
  );
}

const ANNUAL_LEAVE_DETAIL_RECENT_MONTH_COUNT = 3;

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M12 2 4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1.03 13.54-3.2-3.15 1.41-1.42 1.79 1.76 4.38-4.38 1.42 1.42-5.8 5.77z"
      />
    </svg>
  );
}

function CalendarCardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11zM7 11h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"
      />
    </svg>
  );
}

function BriefcaseCardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M10 4h4a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V6a2 2 0 0 1 2-2zm4 3V6h-4v1h4z"
      />
    </svg>
  );
}

function ChecklistCardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M7 4h14v2H7V4zm0 6h14v2H7v-2zm0 6h14v2H7v-2zM3 5h2v2H3V5zm0 6h2v2H3v-2zm0 6h2v2H3v-2z"
      />
    </svg>
  );
}

function ChartSectionIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M3 13h2v8H3v-8zm4-6h2v14H7V7zm4 4h2v10h-2V11zm4-7h2v17h-2V4z"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h6V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6h-2v6H5V5z"
      />
    </svg>
  );
}

function SummaryCard({ tone, icon, label, value, unit, sub, progress }) {
  return (
    <div className={`annual-leave-detail-summary-card annual-leave-detail-summary-card-${tone}`}>
      <div className="annual-leave-detail-summary-card-top">
        <span className="annual-leave-detail-summary-card-icon">{icon}</span>
        <span className="annual-leave-detail-summary-card-eyebrow">{label}</span>
      </div>
      <div className="annual-leave-detail-summary-value-wrap">
        <span className="annual-leave-detail-summary-value">{value}</span>
        <span className="annual-leave-detail-summary-unit">{unit}</span>
      </div>
      <span className="annual-leave-detail-summary-sub">{sub}</span>
      <div className="annual-leave-detail-summary-progress" aria-hidden>
        <div
          className="annual-leave-detail-summary-progress-fill"
          style={{ width: `${clampPercent(progress)}%` }}
        />
      </div>
    </div>
  );
}

export default function AnnualLeaveUsageDetailModal({
  open,
  onClose,
  row,
  detail,
  year,
  t,
  loading = false,
  empKey = null,
  attendanceRootPath = "attendance",
  throughDateKey = null,
}) {
  const tableWrapRef = useRef(null);
  const [workHoursOpen, setWorkHoursOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    if (!open) {
      setWorkHoursOpen(false);
      setShowAllHistory(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const html = document.documentElement;
    const body = document.body;
    const mainScroll = document.getElementById("app-main-scroll");
    const scrollY = window.scrollY;
    const mainScrollY = mainScroll?.scrollTop ?? 0;

    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      mainOverflow: mainScroll?.style.overflow ?? "",
    };

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    if (mainScroll) mainScroll.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      if (mainScroll) {
        mainScroll.style.overflow = prev.mainOverflow;
        mainScroll.scrollTop = mainScrollY;
      }
      window.scrollTo(0, scrollY);
    };
  }, [open, onClose]);

  const months = useMemo(
    () => normalizeUsageDetailMonths(detail),
    [detail],
  );

  const visibleMonths = useMemo(() => {
    if (showAllHistory) return months;
    return months.slice(0, ANNUAL_LEAVE_DETAIL_RECENT_MONTH_COUNT);
  }, [months, showAllHistory]);

  const canExpandHistory = months.length > ANNUAL_LEAVE_DETAIL_RECENT_MONTH_COUNT;

  const activeMonthKey = useMemo(() => {
    const hit = visibleMonths.find(
      (month) => !month.displayOnly && monthHasUsage(month),
    );
    return hit?.yearMonth ?? null;
  }, [visibleMonths]);

  if (!open || !row) return null;

  const name = row[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "";

  const balance = parseAnnualLeaveNumber(row[ANNUAL_LEAVE_EMP.BALANCE]);
  const totalAnnualLeave = parseAnnualLeaveNumber(
    row[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE],
  );
  const annualLeaveUsed = parseAnnualLeaveNumber(
    row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED],
  );
  const totalDeduction =
    detail?.totalDeduction != null
      ? parseAnnualLeaveNumber(detail.totalDeduction)
      : annualLeaveUsed;
  const totalHalfPn = detail?.totalHalfPn ?? 0;

  const balanceSummary = formatSummaryDayCount(balance, t);
  const halfPnSummary = formatSummaryDayCount(totalHalfPn, t);
  const usedSummary = {
    display: formatAnnualLeaveDecimal(totalDeduction),
    unit: t("annualLeave.dayUnit", { defaultValue: "Ngày" }),
  };

  const totalLeaveCap = totalAnnualLeave > 0 ? totalAnnualLeave : 1;
  const balanceProgress = (balance / totalLeaveCap) * 100;
  const halfPnProgress =
    totalDeduction > 0 ? ((totalHalfPn * 0.5) / totalDeduction) * 100 : 0;
  const usedProgress = (totalDeduction / totalLeaveCap) * 100;

  const scrollToHistory = () => {
    const el = tableWrapRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const handleToggleHistory = () => {
    if (showAllHistory) {
      setShowAllHistory(false);
      return;
    }
    setShowAllHistory(true);
    window.requestAnimationFrame(() => scrollToHistory());
  };

  const modalContent = (
    <div
      className="annual-leave-detail-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="annual-leave-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="annual-leave-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="annual-leave-detail-layout">
          <AnnualLeaveDetailSidebar
            row={row}
            year={year}
            t={t}
            onClose={onClose}
            onOpenWorkHours={() => setWorkHoursOpen(true)}
          />

          <div className="annual-leave-detail-main">
        <div className="annual-leave-detail-header">
          <div className="annual-leave-detail-header-main">
            <div className="annual-leave-detail-header-icon" aria-hidden>
              <ShieldIcon />
            </div>
            <div className="annual-leave-detail-header-text">
              <p className="annual-leave-detail-kicker">
                {t("annualLeave.usageDetailTitle", {
                  defaultValue: "Chi tiết phép năm",
                })}
              </p>
              <h2
                id="annual-leave-detail-title"
                className="annual-leave-detail-title"
              >
                {name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="annual-leave-detail-close"
            onClick={onClose}
            aria-label={t("annualLeave.close", { defaultValue: "Đóng" })}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="annual-leave-detail-empty" aria-busy="true">
            <span className="annual-leave-detail-empty-icon" aria-hidden>
              ⏳
            </span>
            <p className="annual-leave-detail-empty-text">
              {t("annualLeave.usageDetailLoading", {
                defaultValue: "Đang tải dữ liệu...",
              })}
            </p>
          </div>
        ) : (
          <>
            <div className="annual-leave-detail-summary">
              <SummaryCard
                tone="balance"
                icon={<CalendarCardIcon />}
                label={t("annualLeave.mainAnnualLeave", {
                  defaultValue: "Phép năm chính",
                })}
                value={balanceSummary.display}
                unit={balanceSummary.unit}
                sub={t("annualLeave.balanceRemaining", {
                  defaultValue: "Khả dụng còn lại",
                })}
                progress={balanceProgress}
              />
              <SummaryCard
                tone="half"
                icon={<BriefcaseCardIcon />}
                label="1/2 PHÉP NĂM"
                value={halfPnSummary.display}
                unit={halfPnSummary.unit}
                sub={t("annualLeave.halfAnnualLeaveApproved", {
                  defaultValue: "Đã được phê duyệt",
                })}
                progress={halfPnProgress}
              />
              <SummaryCard
                tone="used"
                icon={<ChecklistCardIcon />}
                label={t("annualLeave.totalUsed", {
                  defaultValue: "Tổng đã dùng",
                })}
                value={usedSummary.display}
                unit={usedSummary.unit}
                sub={t("annualLeave.totalUsedYear", {
                  defaultValue: "Tổng cộng năm {{year}}",
                  year,
                })}
                progress={usedProgress}
              />
            </div>

            <div className="annual-leave-detail-section">
              <div className="annual-leave-detail-section-card">
                <div className="annual-leave-detail-section-head">
                  <div className="annual-leave-detail-section-head-main">
                    <span
                      className="annual-leave-detail-section-icon"
                      aria-hidden
                    >
                      <ChartSectionIcon />
                    </span>
                    <div>
                      <h3 className="annual-leave-detail-section-title">
                        {t("annualLeave.monthlyBreakdown", {
                          defaultValue: "Thống kê theo tháng",
                        })}
                      </h3>
                      <p className="annual-leave-detail-section-subtitle">
                        {t("annualLeave.monthlyBreakdownSubtitle", {
                          defaultValue:
                            "Lịch sử nghỉ phép chi tiết trong năm {{year}}",
                          year,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="annual-leave-detail-legend">
                    <span className="annual-leave-detail-legend-item annual-leave-detail-legend-pn">
                      {t("annualLeave.legendPn", { defaultValue: "PN (1.0)" })}
                    </span>
                    <span className="annual-leave-detail-legend-item annual-leave-detail-legend-half">
                      {t("annualLeave.legendHalfPn", {
                        defaultValue: "1/2 PN (0.5)",
                      })}
                    </span>
                  </div>
                </div>

                <div
                  className="annual-leave-detail-table-wrap"
                  ref={tableWrapRef}
                >
                  <table className="annual-leave-detail-table">
                    <thead>
                      <tr>
                        <th>
                          {t("annualLeave.monthColumn", {
                            defaultValue: "Tháng",
                          })}
                        </th>
                        <th>PN</th>
                        <th>1/2 PN</th>
                        <th>
                          {t("annualLeave.monthTotal", {
                            defaultValue: "Tổng dùng",
                          })}
                        </th>
                        <th>
                          {t("annualLeave.daysColumn", {
                            defaultValue: "Chi tiết ngày nghỉ",
                          })}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMonths.map((month) => {
                        const days = Array.isArray(month.days) ? month.days : [];
                        const hasData = monthHasUsage(month);
                        const isActive =
                          month.yearMonth === activeMonthKey && hasData;
                        const pnCount = month.pnCount ?? 0;
                        const halfPnCount = month.halfPnCount ?? 0;

                        return (
                          <tr
                            key={month.yearMonth}
                            className={[
                              month.displayOnly
                                ? "annual-leave-detail-row-display-only"
                                : "",
                              isActive ? "annual-leave-detail-row-active" : "",
                            ]
                              .filter(Boolean)
                              .join(" ") || undefined}
                          >
                            <td className="annual-leave-detail-month">
                              <span className="annual-leave-detail-month-pill">
                                {formatYearMonthVi(month.yearMonth)}
                              </span>
                              {month.displayOnly ? (
                                <span className="annual-leave-detail-month-tag">
                                  {t("annualLeave.displayOnlyMonthTag", {
                                    defaultValue: "Lịch sử cũ",
                                  })}
                                </span>
                              ) : null}
                            </td>
                            <td>
                              {pnCount > 0 ? (
                                <span className="annual-leave-detail-count annual-leave-detail-count-pn">
                                  {pnCount}
                                </span>
                              ) : (
                                <span className="annual-leave-detail-count-empty">
                                  --
                                </span>
                              )}
                            </td>
                            <td>
                              {halfPnCount > 0 ? (
                                <span className="annual-leave-detail-count annual-leave-detail-count-half">
                                  {halfPnCount}
                                </span>
                              ) : (
                                <span className="annual-leave-detail-count-empty">
                                  --
                                </span>
                              )}
                            </td>
                            <td className="annual-leave-detail-month-total">
                              <span
                                className={`annual-leave-detail-total-pill ${
                                  hasData && !month.displayOnly
                                    ? "annual-leave-detail-total-pill-active"
                                    : ""
                                }`}
                              >
                                {month.displayOnly
                                  ? "—"
                                  : formatAnnualLeaveDecimal(
                                      month.totalDeduction ?? 0,
                                    )}
                              </span>
                            </td>
                            <td className="annual-leave-detail-days">
                              {days.length === 0 ? (
                                <span className="annual-leave-detail-days-empty">
                                  {t("annualLeave.noMonthUsage", {
                                    defaultValue: "Không có dữ liệu nghỉ phép",
                                  })}
                                </span>
                              ) : (
                                <ul className="annual-leave-detail-day-list">
                                  {days.map((day) => (
                                    <li
                                      key={day.dateKey}
                                      className={`annual-leave-detail-day-item annual-leave-detail-day-item-${day.type === "PN" ? "pn" : "half"}`}
                                    >
                                      {formatDateKeyDayMonth(day.dateKey)}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="annual-leave-detail-section-footer">
                  {canExpandHistory || showAllHistory ? (
                    <button
                      type="button"
                      className="annual-leave-detail-history-link"
                      onClick={handleToggleHistory}
                    >
                      {showAllHistory
                        ? t("annualLeave.collapseHistory", {
                            defaultValue: "Thu gọn lịch sử",
                          })
                        : t("annualLeave.viewAllHistory", {
                            defaultValue: "Xem chi tiết tất cả lịch sử",
                          })}
                      <ExternalLinkIcon />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}
      <AnnualLeaveEmployeeTimePopup
        open={workHoursOpen}
        onClose={() => setWorkHoursOpen(false)}
        row={row}
        year={year}
        empKey={empKey}
        attendanceRootPath={attendanceRootPath}
        throughDateKey={throughDateKey}
        t={t}
      />
    </>
  );
}
