import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { db, ref, get } from "@/services/firebase";
import { buildPayrollMonthDayChunkFromRaw } from "@/features/payroll/buildPayrollDayFromRaw";
import {
  formatCoeffHoursForDisplay,
  getPayrollMonthlyCoeffHoursMap,
  getPayrollMonthlyMainRowCell,
  PAYROLL_MONTHLY_SUBROWS,
} from "@/features/payroll/payrollMonthlyCoefficientBuckets";
import { writePayrollMonthlyTimesheetWorkbook } from "@/features/payroll/payrollMonthlyTimesheetExcelGrid";
import {
  enumerateDateKeysInclusive,
  getFirstDayOfMonthKey,
  getLastDayOfMonthKey,
  parseLocalDateKey,
} from "@/utils/dateKey";
import {
  isDuocNghiBuExplicitlyNo,
  payrollMonthMainRowDashMark,
} from "@/features/attendance/attendanceDayMeta";
import { roundHoursForPayrollDisplay } from "@/features/attendance/attendanceWorkingHours";
import AttendanceEmployeeFormModal from "@/features/attendance/AttendanceEmployeeFormModal";
import {
  canAddAttendanceForDepartment,
  canEditAttendanceForEmployee,
  isAdminAccess,
} from "@/config/authRoles";
import { canEditPayrollMonthTimesheetGridCell } from "@/config/featurePermissions";

function parseSortableStt(raw) {
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  const m = String(raw ?? "").match(/-?\d+(\.\d+)?/);
  if (!m) return Number.POSITIVE_INFINITY;
  const parsed = Number(m[0]);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function collectSortedEmployeeIds(dayChunks) {
  const meta = new Map();
  for (const chunk of dayChunks) {
    for (const emp of chunk.employees) {
      const id = emp.monthEmployeeKey || emp.id;
      const stt = parseSortableStt(emp.stt);
      const prev = meta.get(id);
      if (!prev) {
        meta.set(id, {
          sttMin: stt,
          boPhan: String(emp.boPhan ?? ""),
          ngayVaoLam: String(emp.ngayVaoLam ?? "").trim(),
        });
      } else {
        meta.set(id, {
          sttMin: Math.min(prev.sttMin, stt),
          boPhan: prev.boPhan || String(emp.boPhan ?? ""),
          ngayVaoLam: prev.ngayVaoLam || String(emp.ngayVaoLam ?? "").trim(),
        });
      }
    }
  }
  return [...meta.keys()];
}

function representativeEmployee(dayChunks, id) {
  let out = null;
  for (const ch of dayChunks) {
    const e = (ch.byMonthEmployeeKey || ch.byId).get(id);
    if (!e) continue;
    if (!out) out = { ...e };
    else {
      out = {
        ...out,
        hoVaTen: out.hoVaTen || e.hoVaTen,
        boPhan: out.boPhan || e.boPhan,
        mnv: out.mnv || e.mnv,
        mvt: out.mvt || e.mvt,
        maBoPhan: out.maBoPhan || e.maBoPhan,
        ngayVaoLam: out.ngayVaoLam || e.ngayVaoLam,
        stt: out.stt != null && String(out.stt).trim() !== "" ? out.stt : e.stt,
      };
    }
  }
  return out;
}

/** Cột cố định trái: [px] — tổng ~564px trước cột ngày. */
const STICKY_COL_WIDTHS = [36, 176, 92, 92, 30, 30];
const MONTH_DAY_COL_WIDTH = 35;
const MONTH_DETAIL_COL_WIDTH = 45;
const MONTH_DETAIL_COLS_PER_BLOCK = 16;
const DETAIL_GROUP_KEYS = ["total", "trial", "official"];
/** Dưới ngưỡng này render đủ dòng; từ ngưỡng trở lên ảo hóa theo khối NV để tránh OOM. */
const MONTHLY_TIMESHEET_VIRTUAL_THRESHOLD = 14;
const MONTH_HEADER_ROW_TOPS_DEFAULT = {
  row1: 0,
  row2: 28,
  row3: 76,
};

/** Thu/phóng lưới: `zoom` trên khối bảng (ảnh hưởng cả sticky header / ảo hóa). */
const TIMESHEET_ZOOM_LEVELS = [0.79, 0.85, 1, 1.15, 1.35];
const TIMESHEET_ZOOM_STORAGE_KEY = "payrollMonthlyTimesheetZoomIdx";
const TIMESHEET_ZOOM_DEFAULT_IDX = TIMESHEET_ZOOM_LEVELS.indexOf(1);

function timesheetZoomCssSupported() {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("zoom", "1")
  );
}

const TIMESHEET_ZOOM_CSS_OK = timesheetZoomCssSupported();

function readStoredTimesheetZoomIdx() {
  if (!TIMESHEET_ZOOM_CSS_OK) return TIMESHEET_ZOOM_DEFAULT_IDX;
  if (typeof window === "undefined") return TIMESHEET_ZOOM_DEFAULT_IDX;
  try {
    const raw = window.localStorage.getItem(TIMESHEET_ZOOM_STORAGE_KEY);
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n < TIMESHEET_ZOOM_LEVELS.length) {
      return n;
    }
  } catch {
    /* ignore */
  }
  return TIMESHEET_ZOOM_DEFAULT_IDX;
}

/** Ô ngày trên lưới tháng — bấm mở form điểm danh (khi có quyền). */
const MONTH_DAY_CELL_INTERACTIVE =
  "cursor-pointer hover:bg-indigo-100/75 dark:hover:bg-indigo-950/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500";

/** Ô ngày: class + props a11y khi được phép sửa điểm danh. */
function payrollMonthTimesheetDayCellA11y({
  canEdit,
  dateKey,
  rowId,
  openDayCellEditor,
  tlPage,
}) {
  if (!canEdit) return { className: "", props: {} };
  const activate = () => openDayCellEditor(dateKey, rowId);
  return {
    className: MONTH_DAY_CELL_INTERACTIVE,
    props: {
      role: "button",
      tabIndex: 0,
      title: tlPage(
        "monthlyTimesheetDayCellEditHint",
        "Bấm để sửa điểm danh ngày này.",
      ),
      onClick: (e) => {
        e.preventDefault();
        activate();
      },
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      },
    },
  };
}

function stickyColStyle(colIndex) {
  let left = 0;
  for (let i = 0; i < colIndex; i++) left += STICKY_COL_WIDTHS[i];
  const isLastStickyCol = colIndex === STICKY_COL_WIDTHS.length - 1;
  return {
    position: "sticky",
    left,
    zIndex: 120 - colIndex,
    width: STICKY_COL_WIDTHS[colIndex],
    minWidth: STICKY_COL_WIDTHS[colIndex],
    maxWidth: colIndex === 1 ? 220 : STICKY_COL_WIDTHS[colIndex],
    boxSizing: "border-box",
    backgroundClip: "padding-box",
    transform: "translateZ(0)",
    borderRight: isLastStickyCol ? "2px solid #000" : "1px dashed #94a3b8",
  };
}

function monthDayCellStyle() {
  return {
    width: MONTH_DAY_COL_WIDTH,
    minWidth: MONTH_DAY_COL_WIDTH,
    maxWidth: MONTH_DAY_COL_WIDTH,
    boxSizing: "border-box",
  };
}

function monthDetailCellStyle() {
  return {
    width: MONTH_DETAIL_COL_WIDTH,
    minWidth: MONTH_DETAIL_COL_WIDTH,
    maxWidth: MONTH_DETAIL_COL_WIDTH,
    boxSizing: "border-box",
  };
}

function monthHeaderStickyStyle(top, zIndex) {
  return {
    position: "sticky",
    top,
    zIndex,
    backgroundClip: "padding-box",
    isolation: "isolate",
  };
}

function detailGroupHeaderTone(groupKey) {
  if (groupKey === "total") return "bg-slate-200 dark:bg-slate-700";
  if (groupKey === "trial") return "bg-cyan-100 dark:bg-cyan-900";
  return "bg-violet-100 dark:bg-violet-900";
}

function detailGroupBodyTone(groupIndex) {
  if (groupIndex === 0) return "bg-slate-50 dark:bg-slate-900";
  if (groupIndex === 1) return "bg-cyan-50/60 dark:bg-cyan-950/20";
  return "bg-violet-50/60 dark:bg-violet-950/20";
}

function isProbationStatus(raw) {
  return String(raw ?? "").trim() === "thu_viec";
}

function formatProfileDateKey(raw, displayLocale) {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  const d = parseLocalDateKey(s.slice(0, 10));
  if (!d) return s.slice(0, 10);
  return d.toLocaleDateString(displayLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatEnglishWeekday3(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
}

function leaveUnitsByCode(leaveShort, code) {
  const t = String(leaveShort ?? "")
    .trim()
    .toUpperCase();
  const c = String(code ?? "")
    .trim()
    .toUpperCase();
  if (!t || !c) return 0;
  if (t === c) return 1;
  if (t === `1/2${c}` || t === `1/2 ${c}`) return 0.5;
  return 0;
}

/** KL, KP, NV — không vào «Tổng ngày công bao gồm PN». */
function leaveExcludedFromIncludedWorkDays(leaveShort) {
  return (
    leaveUnitsByCode(leaveShort, "KL") > 0 ||
    leaveUnitsByCode(leaveShort, "KP") > 0 ||
    leaveUnitsByCode(leaveShort, "NV") > 0
  );
}

function countedLeaveUnitsForWorkDays(leaveShort) {
  const codes = ["PN", "TN", "PT", "PC", "NB", "NL", "CT"];
  let total = 0;
  for (const code of codes) total += leaveUnitsByCode(leaveShort, code);
  return total;
}

function sumPayrollMonthlyCoeffHours(coeffMap) {
  let s = 0;
  if (!coeffMap) return s;
  for (const v of coeffMap.values()) {
    if (Number.isFinite(v) && v > 0) s += v;
  }
  return s;
}

/** 1/2PN mặc định 0,5 ngày; đủ giờ làm thực tế thì được tính trọn 1 ngày công. */
const HALF_PN_FULL_DAY_WORKED_HOURS = 4;

function countSundaysInMonthKeys(monthKeys) {
  let n = 0;
  for (const dk of monthKeys) {
    const pd = parseLocalDateKey(dk);
    if (pd && pd.getDay() === 0) n += 1;
  }
  return n;
}

function buildMonthlyRuleSummary(dayChunks, monthKeys, id) {
  const baseCalendarWorkDays =
    monthKeys.length - countSundaysInMonthKeys(monthKeys);

  const out = {
    workDays: 0, // "Tổng ngày công bao gồm PN"
    workHours: 0, // "Tổng giờ công" chỉ tính giờ thực tế
    unpaidDays: 0,
    pnDays: 0,
    nbDays: 0,
    klDays: 0,
    kpDays: 0,
    coeff03: 0,
    coeff15: 0,
    coeff20: 0,
    coeff27: 0,
    coeff30: 0,
    coeff39: 0,
    sats20: 0,
    sats27: 0,
    soNgayCong: baseCalendarWorkDays,
  };

  const addCoeffHoursToTotals = (coeffMap) => {
    out.coeff03 += Number(coeffMap.get(0.3) || 0);
    out.coeff15 += Number(coeffMap.get(1.5) || 0);
    out.coeff20 += Number(coeffMap.get(2.0) || 0);
    out.coeff27 += Number(coeffMap.get(2.7) || 0);
    out.coeff30 += Number(coeffMap.get(3.0) || 0);
    out.coeff39 += Number(coeffMap.get(3.9) || 0);
  };

  /**
   * Có «NB» hiển thị trên ô lưới: tức là ngày nghỉ bù + NV chưa từ chối nhận NB
   * (`duocNghiBu !== "NO"`). Khi `emp` null → mặc định coi như có NB.
   */
  const isNbVisibleForCompDay = (ch, emp) => {
    if (!ch?.isCompensatoryDay) return false;
    if (emp == null) return true;
    return !isDuocNghiBuExplicitlyNo(emp.duocNghiBu);
  };

  const computeHolidayWorkCreditForDash = (ch, coeffSum, emp) => {
    // HOLIDAY: không có giờ công vẫn tính đủ 1 ngày công.
    if (ch.isHolidayDay) return 1;
    // NB: có «NB» hiển thị hoặc có giờ công của ngày NB → 1 ngày công.
    if (isNbVisibleForCompDay(ch, emp)) return 1;
    return coeffSum > 0 ? 1 : 0;
  };

  const computeIncludedWorkDayCreditForLeave = ({ ch, main, coeffSum }) => {
    const workedH =
      Number.isFinite(main.workedHours) && main.workedHours > 0
        ? main.workedHours
        : 0;

    const isHalfPnLeave = main.leaveShort === "1/2PN";
    const dayWorked =
      workedH > 0 &&
      (!isHalfPnLeave || workedH >= HALF_PN_FULL_DAY_WORKED_HOURS)
        ? 1
        : 0;

    let dayLeavePaid = 0;
    if (!leaveExcludedFromIncludedWorkDays(main.leaveShort)) {
      dayLeavePaid = countedLeaveUnitsForWorkDays(main.leaveShort);
    }

    let dayAdd = Math.max(dayWorked, dayLeavePaid);

    // HOLIDAY: nếu không có giờ công thì vẫn tính ít nhất 1 ngày công,
    // kể cả khi `loaiPhep` đang là phép (KL/KP/NV/...).
    if (ch.isHolidayDay && coeffSum <= 0 && dayWorked === 0) {
      dayAdd = Math.max(dayAdd, 1);
    }

    return dayAdd;
  };

  for (const dk of monthKeys) {
    const ch = dayChunks.get(dk);
    if (!ch) continue;

    const emp = (ch.byMonthEmployeeKey || ch.byId).get(id);
    // Nếu ngày đó có cờ HOLIDAY / nghỉ bù trong `_meta` nhưng không có dòng
    // nhân viên, vẫn phải tính 1 ngày công (đồng bộ NB & NL).
    if (!emp) {
      if (ch.isHolidayDay || isNbVisibleForCompDay(ch, null)) out.workDays += 1;
      continue;
    }

    const main = getPayrollMonthlyMainRowCell(emp, ch);
    const coeffMap = getPayrollMonthlyCoeffHoursMap({
      gioVao: emp.gioVao,
      gioRa: emp.gioRa,
      isOffDay: ch.isOffDay,
      isHolidayDay: ch.isHolidayDay,
      isCompensatoryDay: ch.isCompensatoryDay,
      caLamViec: emp.caLamViec,
      payrollEarlyOtPaperwork: emp.payrollEarlyOtPaperwork,
      payrollLateOtExcluded: emp.payrollLateOtExcluded,
      loaiPhep: emp.loaiPhep,
      includeTapVuInWorkingHours: emp.includeTapVuInWorkingHours,
      includeThaiSanInWorkingHours: emp.includeThaiSanInWorkingHours,
    });
    const coeffSum = sumPayrollMonthlyCoeffHours(coeffMap);
    const addWorkedHours = (hours) => {
      if (Number.isFinite(hours) && hours > 0) out.workHours += hours;
    };

    if (main.kind === "leave") {
      const pnUnits = leaveUnitsByCode(main.leaveShort, "PN");
      out.pnDays += pnUnits;
      out.nbDays += leaveUnitsByCode(main.leaveShort, "NB");
      out.klDays += leaveUnitsByCode(main.leaveShort, "KL");
      out.kpDays += leaveUnitsByCode(main.leaveShort, "KP");
      addWorkedHours(main.workedHours);

      out.workDays += computeIncludedWorkDayCreditForLeave({
        ch,
        main,
        coeffSum,
      });
    } else if (main.kind === "hours") {
      addWorkedHours(main.hours);
      addWorkedHours(coeffSum);
      out.workDays += 1;
    } else {
      addWorkedHours(coeffSum);
      out.workDays += computeHolidayWorkCreditForDash(ch, coeffSum, emp);
    }

    addCoeffHoursToTotals(coeffMap);
  }

  out.unpaidDays = out.klDays + out.kpDays;
  // "Tổng ngày công bao gồm PN" không được vượt "Số ngày công".
  out.workDays = Math.min(out.workDays, out.soNgayCong);
  return out;
}

function matchesRowFilter(
  emp,
  { searchTerm, departmentFilter, normalizeDepartment },
) {
  const empDeptKey = normalizeDepartment(emp.boPhan);
  const departmentFilterKey = normalizeDepartment(departmentFilter);
  if (departmentFilterKey && empDeptKey !== departmentFilterKey) return false;
  const q = searchTerm.trim().toLowerCase();
  if (!q) return true;
  return (
    (emp.hoVaTen || "").toLowerCase().includes(q) ||
    (emp.mnv || "").toLowerCase().includes(q) ||
    (emp.boPhan || "").toLowerCase().includes(q)
  );
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Cửa sổ in A3 ngang: chỉ cột cố định + ngày + khối «THỜI GIAN LÀM VIỆC»
 * (bỏ «THỜI GIAN THỬ VIỆC» / «THỜI GIAN HỢP ĐỒNG»).
 */
function buildPayrollMonthlyTimesheetA3WorkTimePrintDocument({
  monthKeys,
  filteredIds,
  repById,
  chunkByDate,
  summaryById,
  detailHeaders,
  displayLocale,
  labels,
}) {
  const fmt = (n) =>
    Number.isFinite(n) && roundHoursForPayrollDisplay(n) !== 0
      ? formatCoeffHoursForDisplay(n)
      : " ";

  const coeffColBySubrow = {
    1: 0,
    2: 1,
    3: 2,
    4: 3,
    5: 4,
    6: 5,
  };

  const dayCellBg = (ch, pd) => {
    if (!ch) return "#f8fafc";
    const sun = pd && pd.getDay() === 0;
    if (sun) return "#fef3c7";
    if (ch.isHolidayDay) return "#ffe4e6";
    if (ch.isCompensatoryDay) return "#ccfbf1";
    if (ch.isOffDay) return "#e0f2fe";
    return "#f1f5f9";
  };

  const appendDayCells = (id, sr, isLastSub, parts) => {
    for (const dk of monthKeys) {
      const ch = chunkByDate.get(dk);
      const pd = parseLocalDateKey(dk);
      const bg = dayCellBg(ch, pd);
      const btm = isLastSub ? "border-bottom:2px solid #000" : "";
      if (!ch) {
        parts.push(`<td style="background:${bg};${btm}"> </td>`);
        continue;
      }
      const emp = (ch.byMonthEmployeeKey || ch.byId).get(id);
      if (!emp) {
        const dayCode =
          sr.coeff == null
            ? escapeHtml(String(payrollMonthMainRowDashMark(ch, null)).trim())
            : " ";
        parts.push(
          `<td style="background:${bg};${btm};text-align:center;font-weight:700">${dayCode || " "}</td>`,
        );
        continue;
      }
      if (sr.coeff == null) {
        const main = getPayrollMonthlyMainRowCell(emp, ch);
        let inner = " ";
        if (main.kind === "leave") {
          inner = `<span style="font-weight:700;border:1px solid #334155;padding:1px 2px;border-radius:2px">${escapeHtml(main.leaveShort || "")}</span>`;
          if (Number.isFinite(main.workedHours) && main.workedHours > 0) {
            inner += `<br/><span style="font-weight:700">${escapeHtml(formatCoeffHoursForDisplay(main.workedHours))}</span>`;
          }
        } else if (main.kind === "hours") {
          inner = `<span style="font-weight:700">${escapeHtml(formatCoeffHoursForDisplay(main.hours))}</span>`;
        } else {
          const dayMark = payrollMonthMainRowDashMark(ch, emp);
          inner = `<span style="font-weight:700">${escapeHtml(String(dayMark))}</span>`;
        }
        parts.push(
          `<td style="background:${bg};${btm};text-align:center;vertical-align:middle;font-size:6.5pt">${inner}</td>`,
        );
        continue;
      }
      const coeffMap = getPayrollMonthlyCoeffHoursMap({
        gioVao: emp.gioVao,
        gioRa: emp.gioRa,
        isOffDay: ch.isOffDay,
        isHolidayDay: ch.isHolidayDay,
        isCompensatoryDay: ch.isCompensatoryDay,
        caLamViec: emp.caLamViec,
        payrollEarlyOtPaperwork: emp.payrollEarlyOtPaperwork,
        payrollLateOtExcluded: emp.payrollLateOtExcluded,
        loaiPhep: emp.loaiPhep,
        includeTapVuInWorkingHours: emp.includeTapVuInWorkingHours,
        includeThaiSanInWorkingHours: emp.includeThaiSanInWorkingHours,
      });
      const h = coeffMap.get(sr.coeff);
      const show =
        h != null && Number.isFinite(h) && roundHoursForPayrollDisplay(h) !== 0;
      const txt = show ? escapeHtml(formatCoeffHoursForDisplay(h)) : " ";
      parts.push(
        `<td style="background:${bg};${btm};text-align:center;font-family:monospace;font-weight:700;font-size:6.5pt">${txt}</td>`,
      );
    }
  };

  const theadParts = [];
  theadParts.push("<tr>");
  theadParts.push(`<th rowspan="3">${escapeHtml(labels.stt)}</th>`);
  theadParts.push(
    `<th rowspan="3" class="pct-print-name">${escapeHtml(labels.name)}</th>`,
  );
  theadParts.push(
    `<th rowspan="3" class="pct-print-join">${escapeHtml(labels.join)}</th>`,
  );
  theadParts.push(
    `<th rowspan="3" class="pct-print-contract">${escapeHtml(labels.contract)}</th>`,
  );
  theadParts.push(
    `<th rowspan="3">${escapeHtml(labels.dept)}</th><th rowspan="3">${escapeHtml(labels.coeff)}</th>`,
  );
  theadParts.push(
    `<th colspan="${monthKeys.length}" style="background:#e2e8f0">${escapeHtml(labels.daysBanner)}</th>`,
  );
  theadParts.push(
    `<th colspan="${MONTH_DETAIL_COLS_PER_BLOCK}" style="background:#e2e8f0;border-left:2px solid #000">${escapeHtml(labels.workTimeTitle)}</th>`,
  );
  theadParts.push("</tr><tr>");
  for (const dk of monthKeys) {
    const pd = parseLocalDateKey(dk);
    const dom = pd ? String(pd.getDate()).padStart(2, "0") : "";
    const wd = formatEnglishWeekday3(pd);
    const ch = chunkByDate.get(dk);
    const bg = dayCellBg(ch, pd);
    theadParts.push(
      `<th rowspan="2" style="background:${bg};font-size:6pt;font-weight:700">${escapeHtml(dom)}<br/><span style="font-size:5.5pt">${escapeHtml(wd)}</span></th>`,
    );
  }
  const gBg = "background:#e2e8f0";
  theadParts.push(
    `<th colspan="8" style="${gBg};border-left:2px solid #000">${escapeHtml(labels.groupWorkday)}</th>`,
  );
  theadParts.push(
    `<th colspan="6" style="${gBg}">${escapeHtml(labels.groupOt)}</th>`,
  );
  theadParts.push(
    `<th colspan="2" style="${gBg}">${escapeHtml(labels.groupSats)}</th>`,
  );
  theadParts.push("</tr><tr>");
  for (let i = 0; i < detailHeaders.length; i++) {
    const bl = i === 0 ? "border-left:2px solid #000" : "";
    theadParts.push(
      `<th style="background:#f1f5f9;${bl};font-size:5.5pt">${escapeHtml(detailHeaders[i])}</th>`,
    );
  }
  theadParts.push("</tr>");

  const bodyParts = [];
  for (let empBlockIdx = 0; empBlockIdx < filteredIds.length; empBlockIdx++) {
    const id = filteredIds[empBlockIdx];
    const rep = repById.get(id);
    const summary = summaryById.get(id);
    if (!rep || !summary) continue;
    const sttDisp =
      rep.stt != null && String(rep.stt).trim() !== ""
        ? rep.stt
        : empBlockIdx + 1;
    const joinStr = formatProfileDateKey(rep.ngayVaoLam, displayLocale);
    const tcByRow = [
      summary.coeff03,
      summary.coeff15,
      summary.coeff20,
      summary.coeff27,
      summary.coeff30,
      summary.coeff39,
    ];
    const valuesForTotal = (si) =>
      Array.from({ length: MONTH_DETAIL_COLS_PER_BLOCK }, (_, idx) => {
        if (si === 0) {
          if (idx === 0) return fmt(summary.soNgayCong);
          if (idx === 1) return fmt(summary.workHours);
          if (idx === 2) return fmt(summary.workDays);
          if (idx === 3) return fmt(summary.unpaidDays);
          if (idx === 4) return fmt(summary.pnDays);
          if (idx === 5) return fmt(summary.nbDays);
          if (idx === 6) return fmt(summary.klDays);
          if (idx === 7) return fmt(summary.kpDays);
        }
        const coeffIdx = coeffColBySubrow[si];
        if (coeffIdx != null && idx === 8 + coeffIdx) {
          return fmt(tcByRow[coeffIdx]);
        }
        return " ";
      });

    for (let si = 0; si < PAYROLL_MONTHLY_SUBROWS.length; si++) {
      const sr = PAYROLL_MONTHLY_SUBROWS[si];
      const isLastSub = si === PAYROLL_MONTHLY_SUBROWS.length - 1;
      const btm = isLastSub ? "border-bottom:2px solid #000" : "";
      const rowBg = empBlockIdx % 2 === 0 ? "#fff" : "#f8fafc";
      bodyParts.push(`<tr style="background:${rowBg}">`);
      if (si === 0) {
        bodyParts.push(
          `<td rowspan="${PAYROLL_MONTHLY_SUBROWS.length}" style="text-align:center;font-weight:700;${btm}">${escapeHtml(String(sttDisp))}</td>`,
        );
        bodyParts.push(
          `<td rowspan="${PAYROLL_MONTHLY_SUBROWS.length}" class="pct-print-name" style="text-align:left;font-weight:700;${btm}">${escapeHtml(rep.hoVaTen ?? "—")}${rep.mnv ? `<br/><span class="pct-print-mnv">${escapeHtml(rep.mnv)}</span>` : ""}</td>`,
        );
        bodyParts.push(
          `<td rowspan="${PAYROLL_MONTHLY_SUBROWS.length}" class="pct-print-join" style="text-align:center;${btm}">${escapeHtml(joinStr)}</td>`,
        );
        bodyParts.push(
          `<td rowspan="${PAYROLL_MONTHLY_SUBROWS.length}" class="pct-print-contract" style="text-align:center;${btm}">${escapeHtml(labels.contractDash)}</td>`,
        );
        bodyParts.push(
          `<td rowspan="${PAYROLL_MONTHLY_SUBROWS.length}" style="text-align:center;font-size:6pt;${btm}">${escapeHtml(rep.boPhan || "—")}</td>`,
        );
      }
      const coeffLabel =
        sr.coeff == null ? "\u00a0" : escapeHtml(Number(sr.coeff).toFixed(1));
      bodyParts.push(
        `<td style="text-align:center;font-family:monospace;font-weight:700;${btm}">${coeffLabel}</td>`,
      );
      appendDayCells(id, sr, isLastSub, bodyParts);
      const detailVals = valuesForTotal(si);
      for (let idx = 0; idx < detailVals.length; idx++) {
        const v = detailVals[idx];
        const bl = idx === 0 ? "border-left:2px solid #000" : "";
        bodyParts.push(
          `<td style="text-align:center;font-weight:700;font-size:6.5pt;${bl};${btm}">${escapeHtml(String(v))}</td>`,
        );
      }
      bodyParts.push("</tr>");
    }
  }

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(labels.docTitle)}</title>
  <style>
    @page { 
      size: A3 landscape; 
      margin: 6mm; 
    }
    
    body { 
      margin: 0; 
      font-family: Arial, Helvetica, sans-serif; 
      -webkit-print-color-adjust: exact; 
      print-color-adjust: exact; 
    }
    
    h1 { 
      font-size: 10pt; 
      margin: 0 0 4px 0; 
      text-align: center; 
    }
    
    table.print-ts { 
      width: 100%; 
      border-collapse: collapse; 
      table-layout: fixed; 
    }
    
    /* Đồng bộ tất cả th và td theo chuẩn MNV */
    .print-ts th,
    .print-ts td { 
      border: 1px solid #1e293b; 
      padding: 2px 3px;  /* đồng bộ padding */
      vertical-align: middle;
      font-family: Consolas, "Courier New", monospace;  /* đồng bộ font MNV */
      font-size: 9pt;  /* đồng bộ kích thước */
      font-weight: normal;
      text-align: center;
      word-break: break-word;
      line-height: 1.2;
    }
    
    /* Header giữ font đậm nhưng vẫn dùng chung font monospace */
    .print-ts th { 
      font-weight: 700;
      background-color: #f1f5f9;
    }
    
    /* Có thể thêm class đặc biệt nếu cần highlight MNV */
    .print-ts .pct-print-mnv {
      font-weight: 600;
      color: #1e40af;
    }
    
    .hint { 
      font-size: 6pt; 
      color: #475569; 
      text-align: center; 
      margin-bottom: 4px; 
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(labels.docTitle)}</h1>
  <p class="hint">${escapeHtml(labels.printHint)}</p>
  <table class="print-ts">
    <thead>${theadParts.join("")}</thead>
    <tbody>${bodyParts.join("")}</tbody>
  </table>
  <p class="hint">${escapeHtml(labels.generatedHint)}</p>
</body>
</html>`;
}

/**
 * Modal: lưới theo dõi cả tháng — dữ liệu mỗi ngày qua `buildPayrollMonthDayChunkFromRaw`
 * (cùng pipeline bảng lương: merge + `payrollEarlyOtPaperwork` trên dòng).
 */
export default function PayrollMonthlyTimesheetModal({
  open,
  onClose,
  anchorDateKey,
  displayLocale = "vi-VN",
  tlPage,
  searchTerm = "",
  departmentFilter = "",
  /** Danh sách BP trên trang lương (`PayrollSalaryCalculator`) — đồng bộ ô «Tất cả bộ phận». */
  payrollDepartmentOptions,
  /** Tập NV đang hiển thị ở bảng giờ công nhân viên (ngày đang chọn). */
  currentEmployeeIds,
  /** Gọi khi đổi BP trong modal — giữ một state với `departmentFilter` trên trang lương. */
  onDepartmentFilterChange,
  normalizeDepartment = (v) =>
    String(v || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase(),
  /** Mở form điểm danh khi bấm ô ngày — cùng quyền với bảng lương. */
  user = null,
  userRole = null,
  userDepartments = null,
  onAlert,
  /** Danh sách NV ngày đang chọn trên trang lương (fallback khi mở form). */
  employees = [],
}) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [dayChunks, setDayChunks] = useState([]);
  const [localNameFilter, setLocalNameFilter] = useState("");
  const [headerRowTops, setHeaderRowTops] = useState(
    MONTH_HEADER_ROW_TOPS_DEFAULT,
  );
  const [timesheetZoomIdx, setTimesheetZoomIdx] = useState(
    readStoredTimesheetZoomIdx,
  );
  const tableWrapRef = useRef(null);
  const tableBodyScrollRef = useRef(null);
  const loadSeqRef = useRef(0);
  const [dayCellFormOpen, setDayCellFormOpen] = useState(false);
  const [dayCellFormDate, setDayCellFormDate] = useState("");
  const [dayCellFormInitial, setDayCellFormInitial] = useState(null);
  const [dayCellFormEmployees, setDayCellFormEmployees] = useState([]);

  const monthRange = useMemo(() => {
    const first = getFirstDayOfMonthKey(anchorDateKey);
    const last = getLastDayOfMonthKey(anchorDateKey);
    const keys = enumerateDateKeysInclusive(first, last);
    return { first, last, keys };
  }, [anchorDateKey]);

  const monthTitle = useMemo(() => {
    const d = parseLocalDateKey(monthRange.first);
    if (!d) return anchorDateKey;
    return d.toLocaleDateString(displayLocale, {
      month: "long",
      year: "numeric",
    });
  }, [monthRange.first, anchorDateKey, displayLocale]);

  const timesheetZoom = TIMESHEET_ZOOM_LEVELS[timesheetZoomIdx];

  const bumpTimesheetZoom = useCallback((delta) => {
    setTimesheetZoomIdx((i) => {
      const n = Math.max(
        0,
        Math.min(TIMESHEET_ZOOM_LEVELS.length - 1, i + delta),
      );
      try {
        window.localStorage.setItem(TIMESHEET_ZOOM_STORAGE_KEY, String(n));
      } catch {
        /* ignore */
      }
      return n;
    });
  }, []);

  const resetTimesheetZoom = useCallback(() => {
    setTimesheetZoomIdx(TIMESHEET_ZOOM_DEFAULT_IDX);
    try {
      window.localStorage.setItem(
        TIMESHEET_ZOOM_STORAGE_KEY,
        String(TIMESHEET_ZOOM_DEFAULT_IDX),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const loadMonth = useCallback(async () => {
    const currentLoadSeq = loadSeqRef.current + 1;
    loadSeqRef.current = currentLoadSeq;
    setLoading(true);
    setLoadingMore(false);
    setError("");
    setDayChunks([]);
    try {
      const allChunks = [];
      const batchSize = 4;
      for (let i = 0; i < monthRange.keys.length; i += batchSize) {
        const batchKeys = monthRange.keys.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batchKeys.map(async (dateKey) => {
            const snap = await get(ref(db, `attendance/${dateKey}`));
            return buildPayrollMonthDayChunkFromRaw(snap.val(), dateKey);
          }),
        );
        if (loadSeqRef.current !== currentLoadSeq) return;
        const validBatch = batchResults.filter(Boolean);
        allChunks.push(...validBatch);
        if (i === 0) {
          setLoading(false);
        }
        if (i + batchSize < monthRange.keys.length) {
          setLoadingMore(true);
        }
      }
      if (loadSeqRef.current !== currentLoadSeq) return;
      setDayChunks(allChunks);
      if (!allChunks.length) {
        setError(
          tlPage(
            "monthlyTimesheetEmpty",
            "Không có dữ liệu điểm danh nào trong tháng này.",
          ),
        );
      }
    } catch (e) {
      if (loadSeqRef.current !== currentLoadSeq) return;
      setError(
        tlPage("monthlyTimesheetError", "Không tải được dữ liệu: {{error}}", {
          error: e?.message || String(e),
        }),
      );
    } finally {
      if (loadSeqRef.current === currentLoadSeq) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [monthRange.keys, tlPage]);

  useEffect(() => {
    if (!open) return;
    void loadMonth();
  }, [open, loadMonth]);

  /** Khóa cuộn trang sau — scroll nằm trên `#app-main-scroll`, không chỉ `body`. */
  useEffect(() => {
    if (!open) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const mainScroll = document.getElementById("app-main-scroll");
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevMainOverflow = mainScroll?.style.overflow ?? "";
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (mainScroll) mainScroll.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      if (mainScroll) mainScroll.style.overflow = prevMainOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    setDayCellFormOpen(false);
    setDayCellFormDate("");
    setDayCellFormInitial(null);
    setDayCellFormEmployees([]);
  }, [open]);

  const sortedIds = useMemo(
    () => collectSortedEmployeeIds(dayChunks),
    [dayChunks],
  );

  const repById = useMemo(() => {
    const m = new Map();
    for (const id of sortedIds) {
      m.set(id, representativeEmployee(dayChunks, id));
    }
    return m;
  }, [sortedIds, dayChunks]);

  const chunkByDate = useMemo(
    () => new Map(dayChunks.map((c) => [c.dateKey, c])),
    [dayChunks],
  );

  const openDayCellEditor = useCallback(
    (dateKey, rowId) => {
      if (!user) {
        onAlert?.({
          show: true,
          type: "error",
          message: tlPage(
            "monthlyTimesheetLoginToEdit",
            "Đăng nhập để chỉnh sửa điểm danh.",
          ),
        });
        return;
      }
      if (!isAdminAccess(user, userRole)) {
        onAlert?.({
          show: true,
          type: "error",
          message: tlPage(
            "monthlyTimesheetAdminHrOnlyEdit",
            "Chỉ Admin / HR được sửa điểm danh từ lưới tháng.",
          ),
        });
        return;
      }
      const ch = chunkByDate.get(dateKey);
      if (!ch) return;
      const rep = repById.get(rowId);
      if (!rep) return;
      const dayEmp = (ch.byMonthEmployeeKey || ch.byId).get(rowId);
      const dayEmps = Array.isArray(ch.employees) ? ch.employees : [];
      if (dayEmp) {
        const permEmp = {
          ...rep,
          ...dayEmp,
          boPhan: dayEmp.boPhan || rep.boPhan,
        };
        if (
          !canEditAttendanceForEmployee({
            user,
            userRole,
            userDepartments,
            employee: permEmp,
          })
        ) {
          onAlert?.({
            show: true,
            type: "error",
            message: tlPage(
              "monthlyTimesheetNoEditPermission",
              "Bạn không có quyền sửa nhân viên này.",
            ),
          });
          return;
        }
        setDayCellFormEmployees(dayEmps);
        setDayCellFormDate(dateKey);
        setDayCellFormInitial({ ...rep, ...dayEmp });
        setDayCellFormOpen(true);
        return;
      }
      if (
        !canAddAttendanceForDepartment({
          user,
          userRole,
          userDepartments,
          boPhan: rep.boPhan,
        })
      ) {
        onAlert?.({
          show: true,
          type: "error",
          message: tlPage(
            "monthlyTimesheetNoAddPermission",
            "Bạn không có quyền thêm điểm danh cho bộ phận này.",
          ),
        });
        return;
      }
      const { id: _omitId, ...repNoId } = rep;
      setDayCellFormEmployees(dayEmps);
      setDayCellFormDate(dateKey);
      setDayCellFormInitial({ ...repNoId, id: "" });
      setDayCellFormOpen(true);
    },
    [user, chunkByDate, repById, userRole, userDepartments, onAlert, tlPage],
  );

  const monthlySummaryById = useMemo(() => {
    const m = new Map();
    for (const id of sortedIds) {
      m.set(id, buildMonthlyRuleSummary(chunkByDate, monthRange.keys, id));
    }
    return m;
  }, [sortedIds, chunkByDate, monthRange.keys]);

  const departmentOptions = useMemo(() => {
    const set = new Set();
    if (Array.isArray(payrollDepartmentOptions)) {
      for (const raw of payrollDepartmentOptions) {
        const d = String(raw ?? "").trim();
        if (d) set.add(d);
      }
    }
    sortedIds.forEach((id) => {
      const rep = repById.get(id);
      const d = String(rep?.boPhan ?? "").trim();
      if (d) set.add(d);
    });
    return [...set].sort((a, b) => a.localeCompare(b, "vi"));
  }, [sortedIds, repById, payrollDepartmentOptions]);

  const effectiveDepartmentFilter = departmentFilter || "";
  const effectiveSearchTerm = localNameFilter || searchTerm || "";
  const visibleEmployeeIdSet = useMemo(
    () => new Set(Array.isArray(currentEmployeeIds) ? currentEmployeeIds : []),
    [currentEmployeeIds],
  );

  const filteredIds = useMemo(() => {
    return sortedIds
      .filter((id) => {
        if (visibleEmployeeIdSet.size > 0 && !visibleEmployeeIdSet.has(id)) {
          return false;
        }
        const rep = repById.get(id);
        return (
          rep &&
          matchesRowFilter(rep, {
            searchTerm: effectiveSearchTerm,
            departmentFilter: effectiveDepartmentFilter,
            normalizeDepartment,
          })
        );
      })
      .sort((a, b) => {
        const aRep = repById.get(a);
        const bRep = repById.get(b);
        return parseSortableStt(aRep?.stt) - parseSortableStt(bRep?.stt);
      });
  }, [
    sortedIds,
    repById,
    visibleEmployeeIdSet,
    effectiveSearchTerm,
    effectiveDepartmentFilter,
    normalizeDepartment,
  ]);

  const shouldVirtualizeTimesheetBody =
    filteredIds.length >= MONTHLY_TIMESHEET_VIRTUAL_THRESHOLD;

  const empBlockVirtualizer = useVirtualizer({
    count: shouldVirtualizeTimesheetBody ? filteredIds.length : 0,
    getScrollElement: () => tableBodyScrollRef.current,
    estimateSize: () =>
      (PAYROLL_MONTHLY_SUBROWS.length * 26 + 10) *
      (TIMESHEET_ZOOM_CSS_OK ? timesheetZoom : 1),
    overscan: 2,
  });

  const timesheetTotalColCount =
    6 +
    monthRange.keys.length +
    DETAIL_GROUP_KEYS.length * MONTH_DETAIL_COLS_PER_BLOCK;

  const stickyColsTotalWidth = useMemo(
    () => STICKY_COL_WIDTHS.reduce((sum, w) => sum + w, 0),
    [],
  );
  const monthDaysWidth = monthRange.keys.length * MONTH_DAY_COL_WIDTH;
  const modalMonthViewportWidth = stickyColsTotalWidth + monthDaysWidth + 320;
  const tableViewportHeight = 184 + PAYROLL_MONTHLY_SUBROWS.length * 24 * 4;

  useEffect(() => {
    if (!open) return;
    const computeHeaderTops = () => {
      const root = tableWrapRef.current;
      if (!root) return;
      const rows = root.querySelectorAll("thead tr");
      if (!rows || rows.length < 3) return;
      const h1 = rows[0].getBoundingClientRect().height || 0;
      const h2 = rows[1].getBoundingClientRect().height || 0;
      const nextTops = {
        row1: 0,
        row2: Math.round(h1),
        row3: Math.round(h1 + h2),
      };
      setHeaderRowTops((prev) =>
        prev.row2 === nextTops.row2 && prev.row3 === nextTops.row3
          ? prev
          : nextTops,
      );
    };
    computeHeaderTops();
    const rafId = window.requestAnimationFrame(computeHeaderTops);
    window.addEventListener("resize", computeHeaderTops);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", computeHeaderTops);
    };
  }, [
    open,
    monthRange.keys.length,
    filteredIds.length,
    loading,
    loadingMore,
    timesheetZoomIdx,
  ]);

  const stickyThBase =
    "relative border border-r-0 !border-solid border-[1px] border-slate-400 !bg-slate-100 bg-clip-padding px-1.5 py-1.5 text-left text-[10px] font-bold text-slate-900 dark:border-slate-500 dark:!bg-slate-800 dark:text-slate-100";
  const stickyTdBase =
    "relative border border-r-0 !border-solid border-[1px] border-slate-300 !bg-white bg-clip-padding px-1.5 py-1 align-middle text-[10px] font-medium text-slate-900 dark:border-slate-700 dark:!bg-slate-900 dark:text-slate-100";
  const strongBorder = "!border-2 !border-black !border-solid";
  const strongBorderBottom = "!border-b-2 !border-b-black !border-solid";
  const strongBorderLeft = "!border-l-2 !border-l-black !border-solid";
  const thinHeadBorder =
    "border !border-solid border-[1px] border-slate-400 dark:border-slate-600";
  const thinBodyBorder =
    "border !border-solid border-[1px] border-slate-300 dark:border-slate-700";
  const noTopBorder = "!border-t-0";
  const detailHeaders = useMemo(
    () => [
      tlPage("monthlyRuleColSoNgayCong", "Số ngày công chuẩn"),
      tlPage("monthlyRuleColWorkHours", "Tổng giờ công thực tế"),
      tlPage("monthlyRuleColWorkDays", "Số ngày công thực tế"),
      tlPage("monthlyRuleColUnpaid", "Tổng ngày nghỉ không lương"),
      tlPage("monthlyRuleColPn", "Phép năm (PN)"),
      tlPage("monthlyRuleColNb", "Nghỉ bù (NB)"),
      tlPage("monthlyRuleColKl", "Nghỉ KL (KL)"),
      tlPage("monthlyRuleColKp", "Nghỉ KP (KP)"),
      "Giờ làm (x0.3)",
      "TC ngày thường (x1.5)",
      "TC đêm/TC ngày nghỉ (x2.0)",
      "TC đêm ngày nghỉ (x2.7)",
      "TC ngày lễ (x3.0)",
      "TC đêm ngày lễ (x3.9)",
      "Sat.S (x2.0)",
      "Sat.S (x2.7)",
    ],
    [tlPage],
  );

  const handleExportExcel = useCallback(async () => {
    if (!filteredIds.length) return;
    try {
      const buf = await writePayrollMonthlyTimesheetWorkbook({
        tlPage,
        monthKeys: monthRange.keys,
        chunkByDate,
        filteredIds,
        repById,
        summaryById: monthlySummaryById,
        detailHeaders,
        displayLocale,
      });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
        2,
        "0",
      )}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(
        2,
        "0",
      )}${String(d.getMinutes()).padStart(2, "0")}`;
      a.href = url;
      a.download = `BangChamCongThang_${stamp}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(
        tlPage(
          "monthlyTimesheetExportError",
          "Không xuất được Excel: {{error}}",
          {
            error: e?.message || String(e),
          },
        ),
      );
    }
  }, [
    chunkByDate,
    detailHeaders,
    displayLocale,
    filteredIds,
    monthlySummaryById,
    monthRange.keys,
    repById,
    tlPage,
  ]);

  const handlePrintA3WorkTimeOnly = useCallback(() => {
    if (!filteredIds.length || !monthRange.keys.length) return;
    const labels = {
      docTitle: `${tlPage("monthlyTimesheetTitle", "Bảng giờ công")} — ${monthTitle}`,
      stt: tlPage("monthlyTimesheetColStt", "STT"),
      name: tlPage("monthlyTimesheetColName", "Họ và tên"),
      join: tlPage("monthlyTimesheetColJoinDate", "Ngày vào làm"),
      contract: tlPage("monthlyTimesheetColContract", "Ngày HĐ"),
      dept: tlPage("monthlyTimesheetColDept", "BP"),
      coeff: tlPage("monthlyTimesheetColCoeff", "Hệ số TC"),
      daysBanner: tlPage("monthlyTimesheetDaysInMonth", "Ngày trong tháng"),
      workTimeTitle: tlPage("monthlyRuleTotalTitle", "THỜI GIAN LÀM VIỆC"),
      groupWorkday: tlPage("monthlyRuleGroupWorkday", "NGÀY LÀM VIỆC"),
      groupOt: tlPage("monthlyRuleGroupOt", "TĂNG CA (Hrs)"),
      groupSats: "SAT.S",
      contractDash: tlPage("monthlyTimesheetContractDash", "—"),
      generatedHint: tlPage(
        "monthlyTimesheetPrintGenerated",
        "Theo bộ lọc hiện tại trên lưới.",
      ),
    };
    const html = buildPayrollMonthlyTimesheetA3WorkTimePrintDocument({
      monthKeys: monthRange.keys,
      filteredIds,
      repById,
      chunkByDate,
      summaryById: monthlySummaryById,
      detailHeaders,
      displayLocale,
      labels,
    });
    const w = window.open("", "_blank");
    if (!w) {
      onAlert?.({
        show: true,
        type: "error",
        message: tlPage(
          "monthlyTimesheetPrintBlocked",
          "Trình duyệt đã chặn cửa sổ mới — không thể mở bản in.",
        ),
      });
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    const run = () => {
      try {
        w.print();
      } finally {
        w.close();
      }
    };
    if (w.document.readyState === "complete") {
      window.setTimeout(run, 0);
    } else {
      w.onload = () => window.setTimeout(run, 0);
    }
  }, [
    filteredIds,
    monthRange.keys,
    repById,
    chunkByDate,
    monthlySummaryById,
    detailHeaders,
    displayLocale,
    monthTitle,
    tlPage,
    onAlert,
  ]);

  const virtualEmpItems = shouldVirtualizeTimesheetBody
    ? empBlockVirtualizer.getVirtualItems()
    : [];
  const tbodyPadTop =
    shouldVirtualizeTimesheetBody && virtualEmpItems.length > 0
      ? virtualEmpItems[0].start
      : 0;
  const tbodyPadBottom =
    shouldVirtualizeTimesheetBody && virtualEmpItems.length > 0
      ? empBlockVirtualizer.getTotalSize() -
        virtualEmpItems[virtualEmpItems.length - 1].end
      : 0;

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-black/50 p-2 backdrop-blur-[1px] sm:p-4"
        style={{ zIndex: "var(--z-modal-backdrop, 1200)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payroll-monthly-timesheet-title"
      >
        <div
          className="mx-auto flex w-full flex-col overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
          style={{
            maxWidth: `min(calc(100vw - 1rem), ${modalMonthViewportWidth}px)`,
            maxHeight: "calc(100vh - 1rem)",
          }}
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 dark:border-slate-700">
            <div className="min-w-0">
              <h2
                id="payroll-monthly-timesheet-title"
                className="truncate text-sm font-extrabold uppercase tracking-wide text-white sm:text-base"
              >
                {tlPage("monthlyTimesheetTitle", "Bảng chấm công tháng")}
                {` (${monthTitle})`}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void loadMonth()}
                disabled={loading}
                className="rounded-lg border border-white/40 bg-white/15 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-white/25 disabled:opacity-50"
              >
                {tlPage("monthlyTimesheetReload", "Tải lại")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border-2 border-white/80 bg-white px-3 py-1 text-xs font-bold text-indigo-700 shadow-sm hover:bg-indigo-50"
              >
                {tlPage("monthlyTimesheetClose", "Đóng")}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex flex-1 flex-col p-2 sm:p-3">
            <div className="mb-2 flex flex-wrap items-center justify-end gap-2 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-2 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <input
                type="text"
                value={localNameFilter}
                onChange={(e) => setLocalNameFilter(e.target.value)}
                placeholder={tlPage(
                  "monthlyTimesheetFilterNamePlaceholder",
                  "Lọc theo tên / MNV / bộ phận",
                )}
                className="w-[220px] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <select
                value={departmentFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  if (onDepartmentFilterChange) onDepartmentFilterChange(v);
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">
                  {tlPage("monthlyTimesheetDeptAll", "Tất cả bộ phận")}
                </option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {TIMESHEET_ZOOM_CSS_OK ? (
                <div
                  className="flex flex-wrap items-center gap-0.5 rounded-md border border-slate-300 bg-white/90 px-1 py-0.5 shadow-sm dark:border-slate-600 dark:bg-slate-800/80"
                  title={tlPage(
                    "monthlyTimesheetZoomHint",
                    "Thu nhỏ để xem tổng quan, phóng to để đọc rõ ô từng ngày. Cỡ chữ được lưu trên trình duyệt.",
                  )}
                >
                  <span className="hidden pl-0.5 pr-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:inline dark:text-slate-400">
                    {tlPage("monthlyTimesheetZoomLabel", "Cỡ lưới")}
                  </span>
                  <button
                    type="button"
                    className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-sm font-bold leading-none text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                    onClick={() => bumpTimesheetZoom(-1)}
                    disabled={timesheetZoomIdx <= 0}
                    aria-label={tlPage(
                      "monthlyTimesheetZoomOut",
                      "Thu nhỏ lưới",
                    )}
                  >
                    −
                  </button>
                  <span className="min-w-[2.75rem] select-none text-center text-[11px] font-extrabold tabular-nums text-slate-800 dark:text-slate-100">
                    {Math.round(timesheetZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-sm font-bold leading-none text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                    onClick={() => bumpTimesheetZoom(1)}
                    disabled={
                      timesheetZoomIdx >= TIMESHEET_ZOOM_LEVELS.length - 1
                    }
                    aria-label={tlPage(
                      "monthlyTimesheetZoomIn",
                      "Phóng to lưới",
                    )}
                  >
                    +
                  </button>
                  {timesheetZoomIdx !== TIMESHEET_ZOOM_DEFAULT_IDX ? (
                    <button
                      type="button"
                      className="ml-0.5 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-500/50 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
                      onClick={resetTimesheetZoom}
                    >
                      {tlPage("monthlyTimesheetZoomReset", "Mặc định")}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                onClick={handlePrintA3WorkTimeOnly}
                disabled={loading || !filteredIds.length || !dayChunks.length}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {tlPage("monthlyTimesheetPrintA3", "In A3 (TG làm việc)")}
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="rounded-md border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 shadow-sm hover:bg-emerald-200"
              >
                {tlPage("monthlyTimesheetExportExcel", "Xuất Excel")}
              </button>
            </div>
            <div
              ref={tableBodyScrollRef}
              className="min-h-0 overflow-auto"
              style={{
                height: `min(calc(100vh - 11.5rem), ${tableViewportHeight}px)`,
              }}
            >
              {loading && !dayChunks.length ? (
                <p className="py-8 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {tlPage(
                    "monthlyTimesheetLoading",
                    "Đang tải dữ liệu điểm danh…",
                  )}
                </p>
              ) : error && !dayChunks.length ? (
                <p className="py-8 text-center text-sm font-semibold text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : (
                <div
                  ref={tableWrapRef}
                  className="inline-block min-w-full align-middle"
                  style={
                    TIMESHEET_ZOOM_CSS_OK ? { zoom: timesheetZoom } : undefined
                  }
                >
                  <table
                    className={`w-max min-w-full border-collapse text-left text-[10px] text-slate-900 dark:text-slate-100 ${strongBorder}`}
                  >
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        {[0, 1, 2, 3, 4, 5].map((ci) => (
                          <th
                            key={`h1-${ci}`}
                            rowSpan={3}
                            style={{
                              ...stickyColStyle(ci),
                              ...monthHeaderStickyStyle(
                                headerRowTops.row1,
                                180 - ci,
                              ),
                            }}
                            className={`${stickyThBase} text-center align-middle`}
                          >
                            {ci === 4 ? (
                              <div className="flex h-[56px] items-center justify-center overflow-visible">
                                <div className="flex -rotate-90 items-center whitespace-nowrap text-center leading-tight tracking-[0.12em]">
                                  {tlPage("monthlyTimesheetColDept", "BP")}
                                </div>
                              </div>
                            ) : ci === 5 ? (
                              <div className="flex h-[56px] items-center justify-center overflow-visible">
                                <div className="flex -rotate-90 items-center whitespace-nowrap text-center font-bold leading-tight tracking-[0.12em]">
                                  {tlPage(
                                    "monthlyTimesheetColCoeff",
                                    "Hệ số TC",
                                  )}
                                </div>
                              </div>
                            ) : ci === 0 ? (
                              tlPage("monthlyTimesheetColStt", "STT")
                            ) : ci === 1 ? (
                              tlPage("monthlyTimesheetColName", "Họ và tên")
                            ) : ci === 2 ? (
                              tlPage(
                                "monthlyTimesheetColJoinDate",
                                "Ngày vào làm",
                              )
                            ) : (
                              tlPage("monthlyTimesheetColContract", "Ngày HĐ")
                            )}
                          </th>
                        ))}
                        <th
                          colSpan={monthRange.keys.length}
                          style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                          className={`${thinHeadBorder} bg-slate-200 px-1 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                        >
                          {tlPage(
                            "monthlyTimesheetDaysInMonth",
                            "Ngày trong tháng",
                          )}
                        </th>
                        <th
                          colSpan={MONTH_DETAIL_COLS_PER_BLOCK}
                          style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                          className={`${thinHeadBorder} ${strongBorderLeft} bg-slate-200 px-1 py-1.5 text-center text-[10px] font-extrabold text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                        >
                          {tlPage(
                            "monthlyRuleTotalTitle",
                            "THỜI GIAN LÀM VIỆC",
                          )}
                        </th>
                        <th
                          colSpan={MONTH_DETAIL_COLS_PER_BLOCK}
                          style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                          className={`${thinHeadBorder} ${strongBorderLeft} bg-slate-200 px-1 py-1.5 text-center text-[10px] font-extrabold text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                        >
                          {tlPage(
                            "monthlyRuleTrialTitle",
                            "THỜI GIAN THỬ VIỆC",
                          )}
                        </th>
                        <th
                          colSpan={MONTH_DETAIL_COLS_PER_BLOCK}
                          style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                          className={`${thinHeadBorder} ${strongBorderLeft} bg-slate-200 px-1 py-1.5 text-center text-[10px] font-extrabold text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                        >
                          {tlPage(
                            "monthlyRuleOfficialTitle",
                            "THỜI GIAN HỢP ĐỒNG",
                          )}
                        </th>
                      </tr>
                      <tr>
                        {monthRange.keys.map((dk) => {
                          const pd = parseLocalDateKey(dk);
                          const dom = pd ? pd.getDate() : "";
                          const sun = pd && pd.getDay() === 0;
                          const hol = chunkByDate.get(dk);
                          const offCol = sun
                            ? "bg-amber-100 dark:bg-amber-900/55"
                            : hol?.isHolidayDay
                              ? "bg-rose-100 dark:bg-rose-900/40"
                              : hol?.isCompensatoryDay
                                ? "bg-teal-100 dark:bg-teal-900/40"
                                : hol?.isOffDay
                                  ? "bg-cyan-100 dark:bg-cyan-900/35"
                                  : "bg-slate-100 dark:bg-slate-800";
                          return (
                            <th
                              key={dk}
                              rowSpan={2}
                              style={{
                                ...monthDayCellStyle(),
                                ...monthHeaderStickyStyle(
                                  headerRowTops.row2,
                                  85,
                                ),
                              }}
                              className={`${thinHeadBorder} ${noTopBorder} px-0.5 py-0.5 text-center text-[9px] font-bold leading-tight text-slate-900 dark:text-slate-100 ${offCol}`}
                            >
                              <div className="flex h-[52px] items-center justify-center overflow-visible">
                                <div className="flex -rotate-90 items-center whitespace-nowrap text-center font-bold leading-tight tracking-[0.12em]">
                                  <span className="font-bold">
                                    {String(dom).padStart(2, "0")}
                                  </span>
                                  <span className="ml-3 text-[9px] font-bold tracking-[0.16em] text-slate-900 dark:text-slate-100">
                                    {formatEnglishWeekday3(pd)}
                                  </span>
                                </div>
                              </div>
                            </th>
                          );
                        })}
                        {DETAIL_GROUP_KEYS.flatMap((groupKey) => {
                          const groupBg = detailGroupHeaderTone(groupKey);
                          return [
                            <th
                              key={`${groupKey}-workday`}
                              colSpan={8}
                              style={monthHeaderStickyStyle(
                                headerRowTops.row2,
                                85,
                              )}
                              className={`${thinHeadBorder} ${noTopBorder} ${groupBg} ${strongBorderLeft} px-1 py-1 text-center text-[9px] font-extrabold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
                            >
                              {tlPage(
                                "monthlyRuleGroupWorkday",
                                "NGÀY LÀM VIỆC",
                              )}
                            </th>,
                            <th
                              key={`${groupKey}-ot`}
                              colSpan={6}
                              style={monthHeaderStickyStyle(
                                headerRowTops.row2,
                                85,
                              )}
                              className={`${thinHeadBorder} ${noTopBorder} ${groupBg} px-1 py-1 text-center text-[9px] font-extrabold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
                            >
                              {tlPage("monthlyRuleGroupOt", "TĂNG CA (Hrs)")}
                            </th>,
                            <th
                              key={`${groupKey}-sats`}
                              colSpan={2}
                              style={monthHeaderStickyStyle(
                                headerRowTops.row2,
                                85,
                              )}
                              className={`${thinHeadBorder} ${noTopBorder} ${groupBg} px-1 py-1 text-center text-[9px] font-extrabold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
                            >
                              SAT.S
                            </th>,
                          ];
                        })}
                      </tr>
                      <tr>
                        {DETAIL_GROUP_KEYS.map((groupKey) =>
                          detailHeaders.map((h, idx) => (
                            <th
                              key={`${groupKey}-${h}`}
                              style={{
                                ...monthDetailCellStyle(idx),
                                ...monthHeaderStickyStyle(
                                  headerRowTops.row3,
                                  80,
                                ),
                              }}
                              className={`${thinHeadBorder} ${noTopBorder} ${detailGroupHeaderTone(groupKey)} ${idx === 0 ? strongBorderLeft : ""} px-1 py-1 text-center text-[9px] font-bold text-slate-900 dark:text-slate-100`}
                            >
                              {h}
                            </th>
                          )),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {tbodyPadTop > 0 ? (
                        <tr aria-hidden className="pointer-events-none">
                          <td
                            colSpan={timesheetTotalColCount}
                            style={{
                              height: tbodyPadTop,
                              padding: 0,
                              border: "none",
                              lineHeight: 0,
                            }}
                          />
                        </tr>
                      ) : null}
                      {(shouldVirtualizeTimesheetBody
                        ? virtualEmpItems
                        : filteredIds.map((_, idx) => ({
                            index: idx,
                          }))
                      ).flatMap((vi) => {
                        const id = filteredIds[vi.index];
                        const empBlockIdx = vi.index;
                        const rep = repById.get(id);
                        const summary = monthlySummaryById.get(id);
                        const sttDisp =
                          rep?.stt != null && String(rep.stt).trim() !== ""
                            ? rep.stt
                            : empBlockIdx + 1;
                        const joinStr = formatProfileDateKey(
                          rep?.ngayVaoLam,
                          displayLocale,
                        );
                        const fmt = (n) =>
                          Number.isFinite(n) &&
                          roundHoursForPayrollDisplay(n) !== 0
                            ? formatCoeffHoursForDisplay(n)
                            : " ";
                        return PAYROLL_MONTHLY_SUBROWS.map((sr, si) => {
                          const isLastSub =
                            si === PAYROLL_MONTHLY_SUBROWS.length - 1;
                          const isFirstSub = si === 0;
                          const subrowEdgeClass = isLastSub
                            ? strongBorderBottom
                            : "";
                          const blockStartClass =
                            isFirstSub && empBlockIdx > 0 ? "!border-t-0" : "";
                          const employeeStripe =
                            empBlockIdx % 2 === 0
                              ? "bg-white dark:bg-slate-900"
                              : "bg-slate-50 dark:bg-slate-900/80";
                          return (
                            <tr
                              key={`${id}-${sr.key}`}
                              className={`${employeeStripe} hover:bg-slate-50/70 dark:hover:bg-slate-800/35`}
                            >
                              {si === 0 ? (
                                <td
                                  rowSpan={PAYROLL_MONTHLY_SUBROWS.length}
                                  style={stickyColStyle(0)}
                                  className={`${stickyTdBase} text-center font-semibold tabular-nums ${strongBorderBottom}`}
                                >
                                  {sttDisp}
                                </td>
                              ) : null}
                              {si === 0 ? (
                                <td
                                  rowSpan={PAYROLL_MONTHLY_SUBROWS.length}
                                  style={stickyColStyle(1)}
                                  className={`${stickyTdBase} leading-tight ${strongBorderBottom}`}
                                  title={rep?.hoVaTen ?? ""}
                                >
                                  <div className="text-[11px] font-bold text-black dark:text-black">
                                    {rep?.hoVaTen ?? "—"}
                                  </div>
                                  {rep?.mnv ? (
                                    <div className="mt-0.5 font-mono text-[10px] font-bold text-black dark:text-black">
                                      {rep.mnv}
                                    </div>
                                  ) : null}
                                </td>
                              ) : null}
                              {si === 0 ? (
                                <td
                                  rowSpan={PAYROLL_MONTHLY_SUBROWS.length}
                                  style={stickyColStyle(2)}
                                  className={`${stickyTdBase} text-center tabular-nums ${strongBorderBottom}`}
                                >
                                  {joinStr}
                                </td>
                              ) : null}
                              {si === 0 ? (
                                <td
                                  rowSpan={PAYROLL_MONTHLY_SUBROWS.length}
                                  style={stickyColStyle(3)}
                                  className={`${stickyTdBase} text-center text-slate-900 dark:text-slate-100 ${strongBorderBottom}`}
                                >
                                  {tlPage("monthlyTimesheetContractDash", "—")}
                                </td>
                              ) : null}
                              {si === 0 ? (
                                <td
                                  rowSpan={PAYROLL_MONTHLY_SUBROWS.length}
                                  style={stickyColStyle(4)}
                                  className={`${stickyTdBase} text-center ${strongBorderBottom}`}
                                >
                                  <div className="flex h-full items-center justify-center overflow-visible">
                                    <div className="flex -rotate-90 items-center whitespace-nowrap text-center font-medium leading-tight tracking-[0.05em]">
                                      {rep?.boPhan ? (
                                        <span className="font-medium">
                                          {rep.boPhan}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">
                                          —
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              ) : null}
                              <td
                                style={{
                                  ...stickyColStyle(5),
                                  ...(isLastSub
                                    ? { borderBottom: "2px solid #000" }
                                    : null),
                                }}
                                className={`${stickyTdBase} text-center font-mono font-semibold text-black dark:text-black ${subrowEdgeClass} ${blockStartClass}`}
                              >
                                <span className="text-[10px]">
                                  {sr.coeff == null
                                    ? "\u00a0"
                                    : Number(sr.coeff).toFixed(1)}
                                </span>
                              </td>
                              {monthRange.keys.map((dk) => {
                                const ch = chunkByDate.get(dk);
                                const pd = parseLocalDateKey(dk);
                                const sun = pd && pd.getDay() === 0;
                                let baseBg = "";
                                if (sun) {
                                  baseBg = "bg-amber-100 dark:bg-amber-900/35";
                                } else if (ch?.isHolidayDay) {
                                  baseBg =
                                    "bg-amber-50/90 dark:bg-amber-950/25";
                                } else if (ch?.isCompensatoryDay) {
                                  baseBg = "bg-teal-50/85 dark:bg-teal-950/25";
                                } else if (ch?.isOffDay) {
                                  baseBg = "bg-sky-50/80 dark:bg-sky-950/20";
                                }
                                if (!ch) {
                                  return (
                                    <td
                                      key={dk}
                                      style={{
                                        ...monthDayCellStyle(),
                                        ...(isLastSub
                                          ? { borderBottom: "2px solid #000" }
                                          : null),
                                      }}
                                      className={`${thinBodyBorder} px-0.5 py-0.5 text-center text-[10px] text-slate-400 ${baseBg} ${subrowEdgeClass} ${blockStartClass}`}
                                    >
                                      {" "}
                                    </td>
                                  );
                                }
                                const emp = (
                                  ch.byMonthEmployeeKey || ch.byId
                                ).get(id);
                                const canEditThisDayCell =
                                  canEditPayrollMonthTimesheetGridCell({
                                    loading,
                                    user,
                                    rep,
                                    rowDayEmp: emp,
                                    userRole,
                                    userDepartments,
                                  });
                                const {
                                  className: dayCellInteractCls,
                                  props: dayCellInteract,
                                } = payrollMonthTimesheetDayCellA11y({
                                  canEdit: canEditThisDayCell,
                                  dateKey: dk,
                                  rowId: id,
                                  openDayCellEditor,
                                  tlPage,
                                });
                                if (!emp) {
                                  const dayCode =
                                    sr.coeff == null
                                      ? payrollMonthMainRowDashMark(ch, null)
                                      : " ";
                                  return (
                                    <td
                                      key={dk}
                                      style={{
                                        ...monthDayCellStyle(),
                                        ...(isLastSub
                                          ? { borderBottom: "2px solid #000" }
                                          : null),
                                      }}
                                      className={`${thinBodyBorder} px-0.5 py-0.5 text-center align-middle text-[10px] font-bold text-slate-900 dark:text-slate-100 ${baseBg} ${subrowEdgeClass} ${blockStartClass} ${dayCellInteractCls}`}
                                      {...dayCellInteract}
                                    >
                                      {dayCode}
                                    </td>
                                  );
                                }
                                if (sr.coeff == null) {
                                  const main = getPayrollMonthlyMainRowCell(
                                    emp,
                                    ch,
                                  );
                                  let inner;
                                  if (main.kind === "leave") {
                                    inner = (
                                      <span className="inline-flex flex-col items-center gap-0.5">
                                        <span
                                          className={`inline-flex max-w-full justify-center rounded border px-1 py-0.5 text-[10px] font-bold ${main.badgeClass}`}
                                          title={main.leaveRaw}
                                        >
                                          {main.leaveShort}
                                        </span>
                                        {Number.isFinite(main.workedHours) &&
                                        main.workedHours > 0 ? (
                                          <span className="font-bold tabular-nums text-black dark:text-black">
                                            {formatCoeffHoursForDisplay(
                                              main.workedHours,
                                            )}
                                          </span>
                                        ) : null}
                                      </span>
                                    );
                                  } else if (main.kind === "hours") {
                                    inner = (
                                      <span className="font-bold tabular-nums text-black dark:text-black">
                                        {formatCoeffHoursForDisplay(main.hours)}
                                      </span>
                                    );
                                  } else {
                                    const dayMark = payrollMonthMainRowDashMark(
                                      ch,
                                      emp,
                                    );
                                    inner = (
                                      <span
                                        className={
                                          dayMark !== " "
                                            ? "font-bold text-black dark:text-black"
                                            : "text-slate-300"
                                        }
                                      >
                                        {dayMark}
                                      </span>
                                    );
                                  }
                                  return (
                                    <td
                                      key={dk}
                                      style={{
                                        ...monthDayCellStyle(),
                                        ...(isLastSub
                                          ? { borderBottom: "2px solid #000" }
                                          : null),
                                      }}
                                      className={`${thinBodyBorder} px-0.5 py-0.5 text-center align-middle text-[10px] font-bold text-slate-900 dark:text-slate-100 ${baseBg} ${subrowEdgeClass} ${blockStartClass} ${dayCellInteractCls}`}
                                      {...dayCellInteract}
                                    >
                                      {inner}
                                    </td>
                                  );
                                }
                                const coeffMap = getPayrollMonthlyCoeffHoursMap(
                                  {
                                    gioVao: emp.gioVao,
                                    gioRa: emp.gioRa,
                                    isOffDay: ch.isOffDay,
                                    isHolidayDay: ch.isHolidayDay,
                                    isCompensatoryDay: ch.isCompensatoryDay,
                                    caLamViec: emp.caLamViec,
                                    payrollEarlyOtPaperwork:
                                      emp.payrollEarlyOtPaperwork,
                                    payrollLateOtExcluded:
                                      emp.payrollLateOtExcluded,
                                    loaiPhep: emp.loaiPhep,
                                    includeTapVuInWorkingHours:
                                      emp.includeTapVuInWorkingHours,
                                    includeThaiSanInWorkingHours:
                                      emp.includeThaiSanInWorkingHours,
                                  },
                                );
                                const h = coeffMap.get(sr.coeff);
                                const show =
                                  h != null &&
                                  Number.isFinite(h) &&
                                  roundHoursForPayrollDisplay(h) !== 0;
                                return (
                                  <td
                                    key={dk}
                                    style={{
                                      ...monthDayCellStyle(),
                                      ...(isLastSub
                                        ? { borderBottom: "2px solid #000" }
                                        : null),
                                    }}
                                    className={`${thinBodyBorder} px-0.5 py-0.5 text-center align-middle font-mono text-[10px] font-bold tabular-nums text-slate-900 dark:text-slate-100 ${baseBg} ${subrowEdgeClass} ${blockStartClass} ${dayCellInteractCls}`}
                                    {...dayCellInteract}
                                  >
                                    {show ? (
                                      <span className="font-bold text-black dark:text-black">
                                        {formatCoeffHoursForDisplay(h)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300"> </span>
                                    )}
                                  </td>
                                );
                              })}
                              {(() => {
                                const isTrial = isProbationStatus(
                                  rep?.trangThaiLamViec,
                                );
                                const tcByRow = [
                                  summary.coeff03,
                                  summary.coeff15,
                                  summary.coeff20,
                                  summary.coeff27,
                                  summary.coeff30,
                                  summary.coeff39,
                                ];
                                const coeffColBySubrow = {
                                  1: 0,
                                  2: 1,
                                  3: 2,
                                  4: 3,
                                  5: 4,
                                  6: 5,
                                };
                                const valuesForStatus = (enabled) =>
                                  Array.from(
                                    { length: MONTH_DETAIL_COLS_PER_BLOCK },
                                    (_, idx) => {
                                      if (!enabled) return " ";
                                      if (si === 0) {
                                        if (idx === 0)
                                          return fmt(summary.soNgayCong);
                                        if (idx === 1)
                                          return fmt(summary.workHours);
                                        if (idx === 2)
                                          return fmt(summary.workDays);
                                        if (idx === 3)
                                          return fmt(summary.unpaidDays);
                                        if (idx === 4)
                                          return fmt(summary.pnDays);
                                        if (idx === 5)
                                          return fmt(summary.nbDays);
                                        if (idx === 6)
                                          return fmt(summary.klDays);
                                        if (idx === 7)
                                          return fmt(summary.kpDays);
                                      }
                                      const coeffIdx = coeffColBySubrow[si];
                                      if (
                                        coeffIdx != null &&
                                        idx === 8 + coeffIdx
                                      ) {
                                        return fmt(tcByRow[coeffIdx]);
                                      }
                                      return " ";
                                    },
                                  );
                                const detailValues = [
                                  ...valuesForStatus(true),
                                  ...valuesForStatus(isTrial),
                                  ...valuesForStatus(!isTrial),
                                ];
                                const oneRow = detailValues.map((v, idx) => {
                                  const group = Math.floor(
                                    idx / MONTH_DETAIL_COLS_PER_BLOCK,
                                  );
                                  const groupBg = detailGroupBodyTone(group);
                                  return (
                                    <td
                                      key={`detail-${id}-${sr.key}-${idx}`}
                                      style={{
                                        ...monthDetailCellStyle(idx),
                                        ...(isLastSub
                                          ? { borderBottom: "2px solid #000" }
                                          : null),
                                      }}
                                      className={`${thinBodyBorder} ${groupBg} ${subrowEdgeClass} ${
                                        idx % MONTH_DETAIL_COLS_PER_BLOCK === 0
                                          ? strongBorderLeft
                                          : ""
                                      } ${blockStartClass} px-1 py-0.5 text-center text-[10px] font-bold text-slate-900 dark:text-slate-100`}
                                    >
                                      {v}
                                    </td>
                                  );
                                });
                                return oneRow;
                              })()}
                            </tr>
                          );
                        });
                      })}
                      {tbodyPadBottom > 0 ? (
                        <tr aria-hidden className="pointer-events-none">
                          <td
                            colSpan={timesheetTotalColCount}
                            style={{
                              height: tbodyPadBottom,
                              padding: 0,
                              border: "none",
                              lineHeight: 0,
                            }}
                          />
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                  {error && dayChunks.length ? (
                    <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-300">
                      {error}
                    </p>
                  ) : null}
                  {loadingMore ? (
                    <p className="mt-2 text-center text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                      {tlPage(
                        "monthlyTimesheetLoadingMore",
                        "Đang tải thêm dữ liệu của tháng...",
                      )}
                    </p>
                  ) : null}
                  {!filteredIds.length && dayChunks.length ? (
                    <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
                      {tlPage(
                        "monthlyTimesheetNoRowsAfterFilter",
                        "Không có nhân viên nào khớp bộ lọc tìm kiếm / bộ phận.",
                      )}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <AttendanceEmployeeFormModal
        open={dayCellFormOpen}
        onClose={() => {
          setDayCellFormOpen(false);
          setDayCellFormInitial(null);
        }}
        initialRecord={dayCellFormInitial}
        selectedDate={dayCellFormDate}
        employees={
          dayCellFormEmployees.length > 0 ? dayCellFormEmployees : employees
        }
        user={user}
        userRole={userRole}
        userDepartments={userDepartments}
        onAlert={onAlert}
        onSaved={() => void loadMonth()}
        dayIsCompensatory={Boolean(
          dayCellFormDate &&
          chunkByDate.get(dayCellFormDate)?.isCompensatoryDay,
        )}
      />
    </>,
    document.body,
  );
}
