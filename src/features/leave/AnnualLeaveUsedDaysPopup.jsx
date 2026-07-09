import { Fragment, useEffect, useMemo, useState } from "react";

import { createPortal } from "react-dom";

import { formatAnnualLeaveDecimal } from "./annualLeaveCalculated";

import { buildAttendanceAnnualLeaveUsageDetailForEmpKey } from "./annualLeaveBalanceLookup";

import { ANNUAL_LEAVE_EMP, ANNUAL_LEAVE_MANAGER_MIN_YEAR } from "./annualLeaveFields";

import {

  getAttendanceYearSnapshot,

  isAttendanceYearSnapshotReady,

  subscribeAttendanceYear,

} from "./annualLeaveLiveStore";

import { buildAnnualLeaveUsedDayRows } from "./annualLeaveUsedDaysRows";

import "./annualLeaveUsedDaysPopup.css";



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

    const yearMonth = row.yearMonth || row.dateKey.slice(0, 7);

    if (!current || current.yearMonth !== yearMonth) {

      current = { yearMonth, rows: [] };

      groups.push(current);

    }

    current.rows.push(row);

  }

  return groups;

}



export default function AnnualLeaveUsedDaysPopup({

  open,

  onClose,

  row,

  detail,

  year,

  empKey = null,

  attendanceRootPath = "attendance",

  throughDateKey = null,

  t,

}) {

  const [selectedYear, setSelectedYear] = useState(Number(year));

  const [selectedMonth, setSelectedMonth] = useState("");

  const [yearDetail, setYearDetail] = useState(detail);

  const [loading, setLoading] = useState(false);



  const yearOptions = useMemo(() => buildYearOptions(year), [year]);



  useEffect(() => {

    if (!open) return;

    setSelectedYear(Number(year));

    setSelectedMonth("");

    setYearDetail(detail);

  }, [open, year, detail]);



  const effectiveThroughDateKey = useMemo(() => {

    if (Number(selectedYear) !== Number(year)) return null;

    return throughDateKey;

  }, [selectedYear, year, throughDateKey]);



  useEffect(() => {

    if (!open) {

      setLoading(false);

      return;

    }



    if (!empKey) {

      setYearDetail(detail);

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



      setYearDetail(

        buildAttendanceAnnualLeaveUsageDetailForEmpKey(

          attendanceRoot,

          selectedYear,

          empKey,

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

    detail,

    attendanceRootPath,

    selectedYear,

    effectiveThroughDateKey,

  ]);



  const allRows = useMemo(

    () => buildAnnualLeaveUsedDayRows(yearDetail),

    [yearDetail],

  );



  const rows = useMemo(() => {

    if (!selectedMonth) return allRows;

    const prefix = `${selectedYear}-${selectedMonth}`;

    return allRows.filter((r) => r.dateKey.startsWith(`${prefix}-`));

  }, [allRows, selectedMonth, selectedYear]);



  const groupedRows = useMemo(

    () => (selectedMonth ? null : groupRowsByMonth(rows)),

    [rows, selectedMonth],

  );



  const totalDeduction = useMemo(

    () => rows.reduce((sum, r) => sum + (Number(r.deduction) || 0), 0),

    [rows],

  );



  useEffect(() => {

    if (!open) return;

    const onKey = (e) => {

      if (e.key === "Escape") onClose();

    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);

  }, [open, onClose]);



  if (!open || !row) return null;



  const name = row[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "";
  const mnv = String(row[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? "").trim();
  const dept = String(row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] ?? "").trim();
  const dayUnit = t("annualLeave.dayUnit", { defaultValue: "Ngày" });



  const renderRow = (item) => (

    <tr key={item.dateKey}>

      <td className="al-used-days-date">{formatDateKeyVi(item.dateKey)}</td>

      <td>

        <span

          className={`al-used-days-type al-used-days-type-${item.type === "PN" ? "pn" : "half"}`}

        >

          {item.type}

        </span>

      </td>

      <td className="al-used-days-deduction">

        {formatAnnualLeaveDecimal(item.deduction)}

      </td>

    </tr>

  );



  return createPortal(

    <div className="al-used-days-overlay" onClick={onClose} role="presentation">

      <div

        className="al-used-days-popup"

        role="dialog"

        aria-modal="true"

        aria-labelledby="al-used-days-popup-title"

        onClick={(e) => e.stopPropagation()}

      >

        <header className="al-used-days-header">
          <div className="al-used-days-header-top">
            <p className="al-used-days-kicker">
              {t("annualLeave.usedDaysPopupKicker", {
                defaultValue: "Phép năm đã sử dụng",
              })}
            </p>
            <button
              type="button"
              className="al-used-days-close"
              onClick={onClose}
              aria-label={t("annualLeave.close", { defaultValue: "Đóng" })}
            >
              ✕
            </button>
          </div>
          <div className="al-used-days-employee">
            <h3 id="al-used-days-popup-title" className="al-used-days-employee-name">
              {name || "—"}
            </h3>
            <div className="al-used-days-employee-meta">
              <span className="al-used-days-meta-chip">
                <span className="al-used-days-meta-label">MNV</span>
                <span className="al-used-days-meta-value">{mnv || "—"}</span>
              </span>
              <span className="al-used-days-meta-chip">
                <span className="al-used-days-meta-label">
                  {t("annualLeave.subDepartmentShort", { defaultValue: "BP" })}
                </span>
                <span className="al-used-days-meta-value">{dept || "—"}</span>
              </span>
            </div>
          </div>
        </header>



        <div className="al-used-days-toolbar">

          <div className="al-used-days-metrics">

            <div className="al-used-days-metric">

              <span className="al-used-days-metric-label">

                {t("annualLeave.workHoursYearLabel", {

                  defaultValue: "Năm",

                })}

              </span>

              <select

                className="al-used-days-metric-select"

                value={selectedYear}

                onChange={(e) => setSelectedYear(Number(e.target.value))}

                aria-label={t("annualLeave.workHoursYearLabel", {

                  defaultValue: "Năm",

                })}

              >

                {yearOptions.map((y) => (

                  <option key={y} value={y}>

                    {y}

                  </option>

                ))}

              </select>

            </div>

            <div className="al-used-days-metric">

              <span className="al-used-days-metric-label">

                {t("annualLeave.workHoursMonthLabel", {

                  defaultValue: "Tháng",

                })}

              </span>

              <select

                className="al-used-days-metric-select"

                value={selectedMonth}

                onChange={(e) => setSelectedMonth(e.target.value)}

                aria-label={t("annualLeave.workHoursMonthLabel", {

                  defaultValue: "Tháng",

                })}

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

            </div>

            <div className="al-used-days-metric">

              <span className="al-used-days-metric-label">

                {t("annualLeave.usedDaysCountLabel", {

                  defaultValue: "Số ngày",

                })}

              </span>

              <span className="al-used-days-metric-value">{rows.length}</span>

            </div>

            <div className="al-used-days-metric">

              <span className="al-used-days-metric-label">

                {t("annualLeave.usedDaysTotalLabel", {

                  defaultValue: "Tổng trừ",

                })}

              </span>

              <span className="al-used-days-metric-value">

                {formatAnnualLeaveDecimal(totalDeduction)}

                <span className="al-used-days-metric-unit">{dayUnit}</span>

              </span>

            </div>

          </div>

        </div>



        <div className="al-used-days-body">

          {loading ? (

            <p className="al-used-days-empty" aria-busy="true">

              {t("annualLeave.usageDetailLoading", {

                defaultValue: "Đang tải dữ liệu...",

              })}

            </p>

          ) : rows.length === 0 ? (

            <p className="al-used-days-empty">

              {t("annualLeave.usedDaysEmpty", {

                defaultValue: "Chưa có ngày nghỉ phép năm",

              })}

            </p>

          ) : (

            <div className="al-used-days-table-wrap">

              <table className="al-used-days-table">

                <thead>

                  <tr>

                    <th>

                      {t("annualLeave.usedDaysDateColumn", {

                        defaultValue: "Ngày",

                      })}

                    </th>

                    <th>

                      {t("annualLeave.usedDaysTypeColumn", {

                        defaultValue: "Loại",

                      })}

                    </th>

                    <th>

                      {t("annualLeave.usedDaysDeductionColumn", {

                        defaultValue: "Trừ phép",

                      })}

                    </th>

                  </tr>

                </thead>

                <tbody>

                  {groupedRows

                    ? groupedRows.map((group) => (

                        <Fragment key={group.yearMonth}>

                          <tr className="al-used-days-month-row">

                            <td colSpan={3}>

                              {formatYearMonthLabel(group.yearMonth)}

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

      </div>

    </div>,

    document.body,

  );

}


