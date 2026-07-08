import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ANNUAL_LEAVE_EMP,
  ANNUAL_LEAVE_MANAGER_MIN_YEAR,
} from "./annualLeaveFields";
import { buildEmployeeAttendanceTimeRows } from "./annualLeaveEmployeeTimeRows";
import { exportEmployeeAttendanceTimeExcel } from "./annualLeaveEmployeeTimeExcelExport";
import {
  getAttendanceYearSnapshot,
  isAttendanceYearSnapshotReady,
  subscribeAttendanceYear,
} from "./annualLeaveLiveStore";
import "./annualLeaveEmployeeTimePopup.css";
import "./annualLeaveDetailSidebar.css";

const MONTH_VALUES = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);

function formatDateKeyVi(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return dateKey;
  const [y, m, d] = dateKey.split("-");
  if (!y || !m || !d) return dateKey;
  return `${d}/${m}/${y}`;
}

function formatYearMonthLabel(yearMonth) {
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return yearMonth;
  return `${yearMonth.slice(5, 7)}/${yearMonth.slice(0, 4)}`;
}

function resolveDefaultMonth(year, throughDateKey) {
  const y = Number(year);
  if (
    throughDateKey &&
    String(throughDateKey).startsWith(`${year}-`) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(throughDateKey))
  ) {
    return throughDateKey.slice(5, 7);
  }
  const now = new Date();
  if (Number.isFinite(y) && now.getFullYear() === y) {
    return String(now.getMonth() + 1).padStart(2, "0");
  }
  return "";
}

function buildYearOptions(baseYear) {
  const max = Math.max(
    Number(baseYear) || ANNUAL_LEAVE_MANAGER_MIN_YEAR,
    new Date().getFullYear(),
  );
  const years = [];
  for (let y = max; y >= ANNUAL_LEAVE_MANAGER_MIN_YEAR; y -= 1) {
    years.push(y);
  }
  return years;
}

function groupRowsByMonth(rows) {
  const groups = [];
  let current = null;
  for (const row of rows) {
    const yearMonth = row.dateKey.slice(0, 7);
    if (!current || current.yearMonth !== yearMonth) {
      current = { yearMonth, rows: [] };
      groups.push(current);
    }
    current.rows.push(row);
  }
  return groups;
}

export default function AnnualLeaveEmployeeTimePopup({
  open,
  onClose,
  row,
  year,
  empKey,
  attendanceRootPath = "attendance",
  throughDateKey = null,
  t,
}) {
  const [loading, setLoading] = useState(false);
  const [allRows, setAllRows] = useState([]);
  const [selectedYear, setSelectedYear] = useState(Number(year));
  const [selectedMonth, setSelectedMonth] = useState("");

  const yearOptions = useMemo(() => buildYearOptions(year), [year]);

  useEffect(() => {
    if (!open) return;
    setSelectedYear(Number(year));
    setSelectedMonth(resolveDefaultMonth(year, throughDateKey));
  }, [open, year, throughDateKey]);

  const detailFilter = useMemo(() => {
    const filter = {};
    if (
      throughDateKey &&
      Number(selectedYear) === Number(year) &&
      String(throughDateKey).startsWith(`${selectedYear}-`)
    ) {
      filter.throughDateKey = throughDateKey;
    }
    if (selectedMonth) {
      filter.yearMonthPrefix = `${selectedYear}-${selectedMonth}`;
    }
    return Object.keys(filter).length ? filter : null;
  }, [selectedYear, selectedMonth, throughDateKey, year]);

  const effectiveThroughDateKey = useMemo(() => {
    if (Number(selectedYear) !== Number(year)) return null;
    return throughDateKey;
  }, [selectedYear, year, throughDateKey]);

  useEffect(() => {
    if (!open || !empKey) {
      setAllRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const rebuild = () => {
      if (
        !isAttendanceYearSnapshotReady(
          attendanceRootPath,
          selectedYear,
          effectiveThroughDateKey,
        )
      ) {
        return;
      }
      if (cancelled) return;

      const attendanceRoot =
        getAttendanceYearSnapshot(
          attendanceRootPath,
          selectedYear,
          effectiveThroughDateKey,
        ) ?? {};

      setAllRows(
        buildEmployeeAttendanceTimeRows(
          attendanceRoot,
          selectedYear,
          empKey,
          detailFilter,
        ),
      );
      setLoading(false);
    };

    setLoading(true);
    rebuild();

    const unsubscribe = subscribeAttendanceYear(
      attendanceRootPath,
      selectedYear,
      rebuild,
      effectiveThroughDateKey,
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [
    open,
    empKey,
    attendanceRootPath,
    selectedYear,
    effectiveThroughDateKey,
    detailFilter,
  ]);

  const rows = allRows;
  const groupedRows = useMemo(
    () => (selectedMonth ? null : groupRowsByMonth(rows)),
    [rows, selectedMonth],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const name = row?.[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "";
  const mnv = String(row?.[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? "").trim();

  const periodLabel = selectedMonth
    ? `${selectedMonth}/${selectedYear}`
    : t("annualLeave.workHoursAllMonthsInYear", {
        defaultValue: "Cả năm {{year}}",
        year: selectedYear,
      });

  const handleExportExcel = useCallback(async () => {
    if (!rows.length) return;
    try {
      await exportEmployeeAttendanceTimeExcel({
        rows,
        employeeName: name,
        mnv,
        year: selectedYear,
        month: selectedMonth,
        headers: {
          date: t("annualLeave.workHoursDateColumn", { defaultValue: "Ngày" }),
          timeIn: t("annualLeave.workHoursInColumn", { defaultValue: "Giờ vào" }),
          timeOut: t("annualLeave.workHoursOutColumn", { defaultValue: "Giờ ra" }),
          leaveType: t("annualLeave.workHoursLeaveColumn", {
            defaultValue: "Loại phép",
          }),
          shift: t("annualLeave.workHoursShiftColumn", { defaultValue: "Ca" }),
        },
      });
    } catch (err) {
      console.error("exportEmployeeAttendanceTimeExcel failed:", err);
    }
  }, [rows, name, mnv, selectedYear, selectedMonth, t]);

  if (!open || !row) return null;

  const renderRow = (item) => (
    <tr key={item.dateKey}>
      <td className="annual-leave-time-popup-date">
        {formatDateKeyVi(item.dateKey)}
      </td>
      <td>{item.timeIn}</td>
      <td>{item.timeOut}</td>
      <td>{item.leaveType}</td>
      <td>{item.shift}</td>
    </tr>
  );

  return createPortal(
    <div
      className="annual-leave-time-popup-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="annual-leave-time-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="annual-leave-time-popup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="annual-leave-time-popup-header">
          <div>
            <p className="annual-leave-time-popup-kicker">
              {t("annualLeave.workHoursPopupKicker", {
                defaultValue: "Chấm công",
              })}
            </p>
            <h3
              id="annual-leave-time-popup-title"
              className="annual-leave-time-popup-title"
            >
              {name}
            </h3>
            <p className="annual-leave-time-popup-meta">
              {mnv ? `MNV ${mnv}` : null}
            </p>
          </div>
          <button
            type="button"
            className="annual-leave-time-popup-close"
            onClick={onClose}
            aria-label={t("annualLeave.close", { defaultValue: "Đóng" })}
          >
            ✕
          </button>
        </div>

        <div className="annual-leave-time-popup-toolbar">
          <div className="annual-leave-time-popup-filters">
            <label className="annual-leave-time-popup-filter">
              <span className="annual-leave-time-popup-filter-label">
                {t("annualLeave.workHoursYearLabel", {
                  defaultValue: "Năm",
                })}
              </span>
              <select
                className="annual-leave-time-popup-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>

            <label className="annual-leave-time-popup-filter">
              <span className="annual-leave-time-popup-filter-label">
                {t("annualLeave.workHoursMonthLabel", {
                  defaultValue: "Tháng",
                })}
              </span>
              <select
                className="annual-leave-time-popup-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="">
                  {t("annualLeave.workHoursAllMonths", {
                    defaultValue: "Tất cả",
                  })}
                </option>
                {MONTH_VALUES.map((month) => (
                  <option key={month} value={month}>
                    {`${month}/${selectedYear}`}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="annual-leave-time-popup-export"
              onClick={handleExportExcel}
              disabled={loading || rows.length === 0}
            >
              {t("annualLeave.workHoursExportExcel", {
                defaultValue: "Xuất Excel",
              })}
            </button>
          </div>

          <p className="annual-leave-time-popup-summary">
            <span className="annual-leave-time-popup-summary-period">
              {periodLabel}
            </span>
            <span className="annual-leave-time-popup-summary-count">
              {t("annualLeave.workHoursRowCount", {
                defaultValue: "{{count}} ngày",
                count: rows.length,
              })}
            </span>
          </p>
        </div>

        {loading ? (
          <div className="annual-leave-time-popup-empty" aria-busy="true">
            {t("annualLeave.workHoursPopupLoading", {
              defaultValue: "Đang tải dữ liệu chấm công…",
            })}
          </div>
        ) : rows.length === 0 ? (
          <div className="annual-leave-time-popup-empty">
            {t("annualLeave.workHoursPopupEmpty", {
              defaultValue: "Chưa có dữ liệu giờ vào/ra trong kỳ đã chọn.",
            })}
          </div>
        ) : (
          <div className="annual-leave-time-popup-table-wrap">
            <table className="annual-leave-time-popup-table">
              <thead>
                <tr>
                  <th>
                    {t("annualLeave.workHoursDateColumn", {
                      defaultValue: "Ngày",
                    })}
                  </th>
                  <th>
                    {t("annualLeave.workHoursInColumn", {
                      defaultValue: "Giờ vào",
                    })}
                  </th>
                  <th>
                    {t("annualLeave.workHoursOutColumn", {
                      defaultValue: "Giờ ra",
                    })}
                  </th>
                  <th>
                    {t("annualLeave.workHoursLeaveColumn", {
                      defaultValue: "Loại phép",
                    })}
                  </th>
                  <th>
                    {t("annualLeave.workHoursShiftColumn", {
                      defaultValue: "Ca",
                    })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedRows
                  ? groupedRows.map((group) => (
                      <Fragment key={group.yearMonth}>
                        <tr className="annual-leave-time-popup-month-row">
                          <td colSpan={5}>
                            {formatYearMonthLabel(group.yearMonth)}
                            <span className="annual-leave-time-popup-month-count">
                              {t("annualLeave.workHoursRowCount", {
                                defaultValue: "{{count}} ngày",
                                count: group.rows.length,
                              })}
                            </span>
                          </td>
                        </tr>
                        {group.rows.map(renderRow)}
                      </Fragment>
                    ))
                  : rows.map(renderRow)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
