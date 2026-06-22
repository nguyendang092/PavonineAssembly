import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { formatAnnualLeaveDecimal } from "./annualLeaveCalculated";

/** Icon gần nghĩa: PN = nghỉ phép cả ngày · 1/2 PN = nghỉ nửa ngày. */
const ANNUAL_LEAVE_PN_ICON = "🏖️";
const ANNUAL_LEAVE_HALF_PN_ICON = "🌤️";

function formatDateKeyVi(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return dateKey;
  const [y, m, d] = dateKey.split("-");
  if (!y || !m || !d) return dateKey;
  return `${d}/${m}/${y}`;
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

export default function AnnualLeaveUsageDetailModal({
  open,
  onClose,
  row,
  detail,
  year,
  t,
  loading = false,
}) {
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

  if (!open || !row) return null;

  const mnv = String(row[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? "").trim();
  const name = row[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "";
  const dept = row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] ?? "";
  const months = normalizeUsageDetailMonths(detail);
  const hasUsage =
    !loading &&
    detail &&
    ((detail.totalDeduction ?? 0) > 0 ||
      months.some((m) => (m.days?.length ?? 0) > 0));

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
        <div className="annual-leave-detail-header">
          <div className="annual-leave-detail-header-main">
            <div className="annual-leave-detail-header-icon" aria-hidden>
              📋
            </div>
            <div className="annual-leave-detail-header-text">
              <h2
                id="annual-leave-detail-title"
                className="annual-leave-detail-title"
              >
                {t("annualLeave.usageDetailTitle", {
                  defaultValue: "Chi tiết phép năm",
                })}
              </h2>
              <div className="annual-leave-detail-meta">
                <span className="annual-leave-detail-emp-name">{name}</span>
                {mnv ? (
                  <span className="annual-leave-detail-badge annual-leave-detail-badge-code">
                    MNV {mnv}
                  </span>
                ) : null}
                <span className="annual-leave-detail-badge annual-leave-detail-badge-year">
                  {year}
                </span>
                {dept ? (
                  <span className="annual-leave-detail-badge annual-leave-detail-badge-dept">
                    {dept}
                  </span>
                ) : null}
              </div>
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
                defaultValue: "Đang tải chi tiết từ điểm danh…",
              })}
            </p>
          </div>
        ) : hasUsage ? (
          <>
            <div className="annual-leave-detail-summary">
              <div
                className="annual-leave-detail-summary-card annual-leave-detail-summary-card-pn"
              >
                <span className="annual-leave-detail-summary-icon" aria-hidden>
                  {ANNUAL_LEAVE_PN_ICON}
                </span>
                <div className="annual-leave-detail-summary-body">
                  <span className="annual-leave-detail-summary-label">PN</span>
                  <span className="annual-leave-detail-summary-value">
                    {detail.totalPn}
                    <small>
                      {t("annualLeave.dayUnit", { defaultValue: " ngày" })}
                    </small>
                  </span>
                </div>
              </div>

              <div
                className="annual-leave-detail-summary-card annual-leave-detail-summary-card-half"
              >
                <span className="annual-leave-detail-summary-icon" aria-hidden>
                  {ANNUAL_LEAVE_HALF_PN_ICON}
                </span>
                <div className="annual-leave-detail-summary-body">
                  <span className="annual-leave-detail-summary-label">
                    1/2 PN
                  </span>
                  <span className="annual-leave-detail-summary-value">
                    {detail.totalHalfPn}
                    <small>
                      {t("annualLeave.dayUnit", { defaultValue: " ngày" })}
                    </small>
                  </span>
                </div>
              </div>

              <div
                className="annual-leave-detail-summary-card annual-leave-detail-summary-card-total"
              >
                <span className="annual-leave-detail-summary-icon" aria-hidden>
                  📊
                </span>
                <div className="annual-leave-detail-summary-body">
                  <span className="annual-leave-detail-summary-label">
                    {t("annualLeave.totalDeducted", {
                      defaultValue: "Tổng phép năm sử dụng",
                    })}
                  </span>
                  <span className="annual-leave-detail-summary-value">
                    {formatAnnualLeaveDecimal(detail.totalDeduction)}
                  </span>
                </div>
              </div>
            </div>

            <div className="annual-leave-detail-section">
              <div className="annual-leave-detail-section-head">
                <h3 className="annual-leave-detail-section-title">
                  {t("annualLeave.monthlyBreakdown", {
                    defaultValue: "Thống kê theo tháng",
                  })}
                </h3>
                <span className="annual-leave-detail-section-hint">
                  {t("annualLeave.monthlyBreakdownHint")}
                </span>
              </div>

              <div className="annual-leave-detail-table-wrap">
                <table className="annual-leave-detail-table">
                  <thead>
                    <tr>
                      <th>
                        {t("annualLeave.monthColumn", { defaultValue: "Tháng" })}
                      </th>
                      <th className="annual-leave-detail-th-pn">
                        <span className="annual-leave-detail-th-icon" aria-hidden>
                          {ANNUAL_LEAVE_PN_ICON}
                        </span>
                        PN
                      </th>
                      <th className="annual-leave-detail-th-half">
                        <span className="annual-leave-detail-th-icon" aria-hidden>
                          {ANNUAL_LEAVE_HALF_PN_ICON}
                        </span>
                        1/2 PN
                      </th>
                      <th>
                        {t("annualLeave.monthTotal", {
                          defaultValue: "Tổng phép năm sử dụng",
                        })}
                      </th>
                      <th>
                        {t("annualLeave.daysColumn", {
                          defaultValue: "Các ngày",
                        })}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((month) => {
                      const days = Array.isArray(month.days) ? month.days : [];
                      return (
                        <tr
                          key={month.yearMonth}
                          className={
                            month.displayOnly
                              ? "annual-leave-detail-row-display-only"
                              : undefined
                          }
                        >
                          <td className="annual-leave-detail-month">
                            <span className="annual-leave-detail-month-pill">
                              {formatYearMonthVi(month.yearMonth)}
                            </span>
                            {month.displayOnly ? (
                              <span className="annual-leave-detail-month-tag">
                                {t("annualLeave.displayOnlyMonthTag", {
                                  defaultValue: "Chỉ hiển thị",
                                })}
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <span className="annual-leave-detail-count annual-leave-detail-count-pn">
                              {month.pnCount}
                            </span>
                          </td>
                          <td>
                            <span className="annual-leave-detail-count annual-leave-detail-count-half">
                              {month.halfPnCount}
                            </span>
                          </td>
                          <td className="annual-leave-detail-month-total">
                            {month.displayOnly
                              ? "—"
                              : formatAnnualLeaveDecimal(month.totalDeduction)}
                          </td>
                          <td className="annual-leave-detail-days">
                            {days.length === 0 ? (
                              <span className="annual-leave-detail-days-empty">
                                —
                              </span>
                            ) : (
                              days.map((day) => (
                                <span
                                  key={day.dateKey}
                                  className={`annual-leave-detail-day-chip annual-leave-detail-day-chip-${day.type === "PN" ? "pn" : "half"}`}
                                >
                                  <span className="annual-leave-detail-day-date">
                                    {formatDateKeyVi(day.dateKey)}
                                  </span>
                                  <span className="annual-leave-detail-day-type">
                                    <span
                                      className="annual-leave-detail-day-type-icon"
                                      aria-hidden
                                    >
                                      {day.type === "PN"
                                        ? ANNUAL_LEAVE_PN_ICON
                                        : ANNUAL_LEAVE_HALF_PN_ICON}
                                    </span>
                                    {day.type}
                                  </span>
                                </span>
                              ))
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="annual-leave-detail-empty">
            <span className="annual-leave-detail-empty-icon" aria-hidden>
              📭
            </span>
            <p className="annual-leave-detail-empty-text">
              {t("annualLeave.noUsageDetail", {
                defaultValue:
                  "Không có ngày PN / 1/2 PN từ điểm danh trong tháng này.",
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
