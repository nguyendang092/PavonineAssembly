import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { buildPayrollMonthDayCellFormRecord } from "@/features/payroll/buildPayrollDayFromRaw";
import {
  comparePayrollMonthRowsByDepartment,
  formatPayrollMonthWeekday3,
  matchesPayrollMonthRowFilter,
  resolvePayrollMonthDayEmployee,
} from "@/features/payroll/payrollMonthlyGridData";
import {
  formatCoeffHoursForDisplay,
  formatPayrollMonthlyCoeffSubrowDayCell,
  getPayrollMonthlyCoeffHoursMap,
  getPayrollMonthlyMainRowCell,
  PAYROLL_MONTHLY_SUBROWS,
} from "@/features/payroll/payrollMonthlyCoefficientBuckets";
import { pickPayrollEmployeeJoinDate } from "@/features/payroll/payrollEmployeeFields";
import { payrollOtDayParamsFromMonthChunkEmp } from "@/features/payroll/payrollOtDayParams";
import { writePayrollMonthlyTimesheetWorkbook } from "@/features/payroll/payrollMonthlyTimesheetExcelGrid";
import {
  buildMonthlyDetailMatrixForEmployee,
  isPayrollMonthDayCellBeforeJoinWithoutAttendance,
  isPayrollMonthDayOnOrAfterJoin,
} from "@/features/payroll/payrollMonthlyRuleSummary";
import {
  buildPayrollMonthlyTimesheetDetailHeaders,
  DETAIL_GROUP_KEYS,
  MONTH_DETAIL_COLS_PER_BLOCK,
  MONTH_DETAIL_OT_COL_COUNT,
  MONTH_DETAIL_SATS_COL_COUNT,
  MONTH_DETAIL_WORKDAY_COL_COUNT,
  PAYROLL_MONTHLY_DETAIL_GROUP_SATS_LABEL,
  payrollMonthlyTimesheetTotalColCount,
} from "@/features/payroll/payrollMonthlyTimesheetLayout";
import {
  payrollMonthlyTimesheetDayBodyBgClass,
  payrollMonthlyTimesheetDayHeaderBgClass,
  payrollMonthlyTimesheetDetailGroupBodyClass,
  payrollMonthlyTimesheetDetailGroupHeaderClass,
} from "@/features/payroll/payrollMonthlyTimesheetGridStyle";
import {
  enumerateDateKeysInclusive,
  getFirstDayOfMonthKey,
  getLastDayOfMonthKey,
  parseLocalDateKey,
} from "@/utils/dateKey";
import { payrollMonthMainRowDashMark } from "@/features/attendance/attendanceDayMeta";
import {
  getAttendanceLeaveTypeCompactBadgeClassName,
  getAttendanceLeaveTypeEmphasisBadgeClassName,
  getAttendanceLeaveTypeEmphasisCellClassName,
  getAttendanceLeaveTypeEmphasisPrintCellBg,
  getAttendanceLeaveTypeEmphasisPrintStyleAttr,
} from "@/features/attendance/attendanceGioVaoTypeOptions";
import AttendanceEmployeeFormModal from "@/features/attendance/AttendanceEmployeeFormModal";
import { canEditPayrollMonthTimesheetGridCell } from "@/config/featurePermissions";
import PayrollMonthGridLoadingOverlay from "@/features/payroll/PayrollMonthGridLoadingOverlay";
import {
  buildPayrollMonthGridOverlayCopy,
  usePayrollMonthModalScrollLock,
} from "@/features/payroll/payrollMonthModalUi";
import { usePayrollMonthDayChunks } from "@/features/payroll/usePayrollMonthDayChunks";
import { usePayrollMonthEmployeeIndex } from "@/features/payroll/usePayrollMonthEmployeeIndex";
import { usePayrollMonthSummaries } from "@/features/payroll/usePayrollMonthSummaries";
import "./payrollMonthlyTimesheetModal.css";

/** Cột cố định trái: STT, Họ tên, MNV, BP, Hệ số TC [px]. */
const STICKY_COL_WIDTHS = [36, 176, 72, 80, 64];
const MONTH_DAY_COL_WIDTH = 42;
const MONTH_DETAIL_COL_WIDTH = 45;

/** Chiều cao scroll mỗi khối NV (N dòng × ô ngày) — khớp `.pm-ts-data-cell`. */
function payrollMonthlyEmpBlockScrollHeight(zoom = 1) {
  return PAYROLL_MONTHLY_SUBROWS.length * MONTH_DAY_COL_WIDTH * zoom;
}
/** Độ rộng mỗi cột khối «THỜI GIAN LÀM VIỆC» trên bản in A3 (mm). */
const A3_PRINT_DETAIL_COL_WIDTH_MM = 9;
/** Dưới ngưỡng này render đủ dòng; từ ngưỡng trở lên ảo hóa theo khối NV để tránh OOM. */
const MONTHLY_TIMESHEET_VIRTUAL_THRESHOLD = 14;
const MONTH_HEADER_ROW_TOPS_DEFAULT = {
  row1: 0,
  row2: 28,
  row3: 76,
};

/** Thu/phóng lưới: `zoom` trên khối bảng (ảnh hưởng cả sticky header / ảo hóa). */
const TIMESHEET_ZOOM_LEVELS = [0.78, 0.85, 1, 1.15, 1.35];
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

const STICKY_TH_BASE_CLASS =
  "relative border border-r-0 !border-solid border-[1px] border-slate-400 !bg-slate-100 bg-clip-padding px-1.5 py-1.5 text-left font-bold text-slate-900 dark:border-slate-500 dark:!bg-slate-800 dark:text-slate-100";
const STICKY_TD_BASE_CLASS =
  "relative border border-r-0 !border-solid border-[1px] border-slate-300 !bg-white bg-clip-padding px-1.5 py-1 align-middle font-medium text-slate-900 dark:border-slate-700 dark:!bg-slate-900 dark:text-slate-100";
const STRONG_BORDER_CLASS = "!border-2 !border-black !border-solid";
const STRONG_BORDER_BOTTOM_CLASS = "!border-b-2 !border-b-black !border-solid";
const STRONG_BORDER_LEFT_CLASS = "!border-l-2 !border-l-black !border-solid";
const THIN_HEAD_BORDER_CLASS =
  "border !border-solid border-[1px] border-slate-400 dark:border-slate-600";
const THIN_BODY_BORDER_CLASS =
  "border !border-solid border-[1px] border-slate-300 dark:border-slate-700";
const NO_TOP_BORDER_CLASS = "!border-t-0";

/** Dòng chính ô ngày (loại phép / giờ công / gạch): một cỡ chữ, tránh lệch giữa các mã phép. */
const MONTH_DAY_MAIN_CELL_CLASS =
  "pm-ts-day-cell pm-ts-data-cell text-center align-middle leading-none text-slate-900 dark:text-slate-100";

const MONTH_DAY_MAIN_VALUE_CLASS =
  "pm-ts-day-value tabular-nums text-black dark:text-black";

const MONTH_DAY_LEAVE_BADGE_BASE_CLASS =
  "pm-ts-leave-badge";

/** In A3 — cùng cỡ với ô ngày dòng chính (6.5pt). */
const MONTH_DAY_PRINT_MAIN_FONT_STYLE =
  "font-size:6.5pt;line-height:1;font-weight:700";

/** Ô ngày: class + props a11y khi được phép mở form điểm danh. */
function payrollMonthTimesheetDayCellA11y({
  canOpen,
  dateKey,
  rowId,
  openDayCellEditor,
  tlPage,
}) {
  if (!canOpen) return { className: "", props: {} };
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
    maxWidth: colIndex === 1 ? 248 : STICKY_COL_WIDTHS[colIndex],
    boxSizing: "border-box",
    backgroundClip: "padding-box",
    transform: "translateZ(0)",
    borderRight: isLastStickyCol ? "2px solid #000" : "1px dashed #94a3b8",
  };
}

function stickyColClass(colIndex) {
  return colIndex === STICKY_COL_WIDTHS.length - 1 ? "pm-ts-sticky-edge" : "";
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

/** Màu nền ô ngày — bản in A3. */
function monthTimesheetDayBgPrint(ch, pd) {
  if (pd?.getDay() === 0) return "#C7C7C7";
  if (!ch) return "#f8fafc";
  if (ch.isHolidayDay) return "#ffe4e6";
  if (ch.isCompensatoryDay) return "#ccfbf1";
  if (ch.isOffDay) return "#fef9c3";
  if (pd?.getDay() === 6) return "#94a3b8";
  return "#f1f5f9";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Tách nhãn cột chi tiết in A3 thành 2 dòng ngang (dòng 2 thường là hệ số / mã viết tắt). */
function splitA3PrintDetailHeaderTwoLines(text) {
  const s = String(text ?? "").trim();
  if (!s) return ["", ""];
  const coeffParen = s.match(/^(.+?)\s*(\(x[\d.]+\))\s*$/i);
  if (coeffParen) return [coeffParen[1].trim(), coeffParen[2].trim()];
  const genericParen = s.match(/^(.+?)\s*(\([^)]+\))\s*$/);
  if (genericParen) return [genericParen[1].trim(), genericParen[2].trim()];
  const slashBreak = s.match(/^(.+?\/)\s*(.+)$/);
  if (slashBreak && slashBreak[2].length > 4) {
    return [slashBreak[1].trim(), slashBreak[2].trim()];
  }
  const words = s.split(/\s+/);
  if (words.length <= 1) return [s, ""];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

function a3PrintDetailHeadTwoLines(text) {
  const [line1, line2] = splitA3PrintDetailHeaderTwoLines(text);
  const l2 = line2
    ? `<br/><span class="pct-print-detail-line2">${escapeHtml(line2)}</span>`
    : "";
  return `<div class="pct-print-detail-2line"><span class="pct-print-detail-line1">${escapeHtml(line1)}</span>${l2}</div>`;
}

/**
 * Cửa sổ in A3 ngang: STT, tên, BP, hệ số TC + ngày trong tháng + khối «THỜI GIAN LÀM VIỆC»
 * (không in «Ngày vào làm» / «Ngày HĐ»; không in khối «THỜI GIAN THỬ VIỆC» / «THỜI GIAN HỢP ĐỒNG»).
 */
function buildPayrollMonthlyTimesheetA3WorkTimePrintDocument({
  monthKeys,
  filteredIds,
  repById,
  chunkByDate,
  summaryById,
  detailHeaders,
  labels,
  employeeDayCellsById,
}) {
  const dayCellBg = (ch, pd) => monthTimesheetDayBgPrint(ch, pd);

  const appendDayCells = (rowDays, sr, isLastSub, parts) => {
    for (const dayCell of rowDays) {
      const pd = parseLocalDateKey(dayCell.dateKey);
      const ch = dayCell.chunk;
      const bg = dayCellBg(ch, pd);
      const btm = isLastSub ? "border-bottom:2px solid #000" : "";
      if (dayCell.beforeJoin || !ch) {
        parts.push(`<td style="background:${bg};${btm}"> </td>`);
        continue;
      }
      if (!dayCell.emp) {
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
        const main = dayCell.main;
        let inner = " ";
        if (main.kind === "leave") {
          inner = `<span style="${getAttendanceLeaveTypeEmphasisPrintStyleAttr(main.leaveRaw, main.leaveShort)}">${escapeHtml(main.leaveShort || "")}</span>`;
        } else if (main.kind === "hours") {
          inner = `<span style="${MONTH_DAY_PRINT_MAIN_FONT_STYLE}">${escapeHtml(formatCoeffHoursForDisplay(main.hours))}</span>`;
        } else {
          const dayMark = payrollMonthMainRowDashMark(ch, dayCell.emp);
          inner = `<span style="${MONTH_DAY_PRINT_MAIN_FONT_STYLE}">${escapeHtml(String(dayMark))}</span>`;
        }
        parts.push(
          `<td style="background:${main.kind === "leave" ? getAttendanceLeaveTypeEmphasisPrintCellBg(main.leaveRaw) : bg};${btm};text-align:center;vertical-align:middle;${MONTH_DAY_PRINT_MAIN_FONT_STYLE}">${inner}</td>`,
        );
        continue;
      }
      const coeffTxt = formatPayrollMonthlyCoeffSubrowDayCell({
        emp: dayCell.emp,
        ch,
        sr,
        coeffMap: dayCell.coeffMap,
        main: dayCell.main,
      });
      const txt = coeffTxt ? escapeHtml(String(coeffTxt)) : " ";
      parts.push(
        `<td style="background:${bg};${btm};text-align:center;font-family:monospace;font-weight:700;font-size:6.5pt">${txt}</td>`,
      );
    }
  };

  const rot = (inner) =>
    `<div class="pct-print-rot-wrap"><span class="pct-print-vneg90">${inner}</span></div>`;

  const vmode = (inner) => `<div class="pct-print-vmode">${inner}</div>`;

  const theadParts = [];
  theadParts.push("<tr>");
  theadParts.push(
    `<th rowspan="3" class="pct-print-rot-cell pct-print-rot-stt">${rot(escapeHtml(labels.stt))}</th>`,
  );
  theadParts.push(
    `<th rowspan="3" class="pct-print-rot-cell pct-print-rot-name">${vmode(escapeHtml(labels.name))}</th>`,
  );
  theadParts.push(
    `<th rowspan="3" class="pct-print-rot-cell pct-print-rot-mnv">${vmode(escapeHtml(labels.mnv))}</th>`,
  );
  theadParts.push(
    `<th rowspan="3" class="pct-print-rot-cell pct-print-rot-dept">${vmode(escapeHtml(labels.dept))}</th><th rowspan="3">${escapeHtml(labels.coeff)}</th>`,
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
    const wd = formatPayrollMonthWeekday3(pd);
    const ch = chunkByDate.get(dk);
    const bg = dayCellBg(ch, pd);
    theadParts.push(
      `<th rowspan="2" style="background:${bg};font-size:6pt;font-weight:700">${escapeHtml(dom)}<br/><span style="font-size:5.5pt">${escapeHtml(wd)}</span></th>`,
    );
  }
  const gBg = "background:#e2e8f0";
  theadParts.push(
    `<th colspan="${MONTH_DETAIL_WORKDAY_COL_COUNT}" style="${gBg};border-left:2px solid #000">${escapeHtml(labels.groupWorkday)}</th>`,
  );
  theadParts.push(
    `<th colspan="${MONTH_DETAIL_OT_COL_COUNT}" style="${gBg}">${escapeHtml(labels.groupOt)}</th>`,
  );
  if (MONTH_DETAIL_SATS_COL_COUNT > 0) {
    theadParts.push(
      `<th colspan="${MONTH_DETAIL_SATS_COL_COUNT}" style="${gBg}">${escapeHtml(labels.groupSats)}</th>`,
    );
  }
  theadParts.push("</tr><tr>");
  for (let i = 0; i < detailHeaders.length; i++) {
    const bl = i === 0 ? "border-left:2px solid #000" : "";
    theadParts.push(
      `<th class="pct-print-detail-head" style="background:#f1f5f9;${bl}">${a3PrintDetailHeadTwoLines(detailHeaders[i])}</th>`,
    );
  }
  theadParts.push("</tr>");

  const bodyParts = [];
  for (let empBlockIdx = 0; empBlockIdx < filteredIds.length; empBlockIdx++) {
    const id = filteredIds[empBlockIdx];
    const rep = repById.get(id);
    const summaries = summaryById.get(id);
    if (!rep || !summaries?.total) continue;
    // Bản in A3 chỉ in tới hết khối "THỜI GIAN LÀM VIỆC" đầu tiên.
    const detailMatrix = buildMonthlyDetailMatrixForEmployee(summaries).map(
      (row) => row.slice(0, MONTH_DETAIL_COLS_PER_BLOCK),
    );
    const sttDisp = empBlockIdx + 1;

    for (let si = 0; si < PAYROLL_MONTHLY_SUBROWS.length; si++) {
      const sr = PAYROLL_MONTHLY_SUBROWS[si];
      const isLastSub = si === PAYROLL_MONTHLY_SUBROWS.length - 1;
      const btm = isLastSub ? "border-bottom:2px solid #000" : "";
      const rowBg = empBlockIdx % 2 === 0 ? "#fff" : "#f8fafc";
      bodyParts.push(`<tr style="background:${rowBg}">`);
      if (si === 0) {
        bodyParts.push(
          `<td rowspan="${PAYROLL_MONTHLY_SUBROWS.length}" class="pct-print-rot-cell pct-print-rot-stt" style="font-weight:700;${btm}">${rot(escapeHtml(String(sttDisp)))}</td>`,
        );
        bodyParts.push(
          `<td rowspan="${PAYROLL_MONTHLY_SUBROWS.length}" class="pct-print-rot-cell pct-print-rot-name" style="font-weight:700;${btm}">${vmode(`<span class="pct-print-name-text">${escapeHtml(rep.hoVaTen ?? "—")}</span>`)}</td>`,
        );
        bodyParts.push(
          `<td rowspan="${PAYROLL_MONTHLY_SUBROWS.length}" class="pct-print-rot-cell pct-print-rot-mnv" style="font-weight:700;${btm}">${vmode(escapeHtml(rep.mnv || "—"))}</td>`,
        );
        bodyParts.push(
          `<td rowspan="${PAYROLL_MONTHLY_SUBROWS.length}" class="pct-print-rot-cell pct-print-rot-dept" style="font-weight:700;${btm}">${vmode(escapeHtml(rep.boPhan || "—"))}</td>`,
        );
      }
      const coeffLabel =
        sr.coeff == null ? "\u00a0" : escapeHtml(Number(sr.coeff).toFixed(1));
      bodyParts.push(
        `<td style="text-align:center;font-family:monospace;font-weight:700;${btm}">${coeffLabel}</td>`,
      );
      appendDayCells(employeeDayCellsById.get(id) ?? [], sr, isLastSub, bodyParts);
      const detailVals = detailMatrix[si] ?? [];
      for (let idx = 0; idx < detailVals.length; idx++) {
        const v = detailVals[idx];
        const bl = idx === 0 ? "border-left:2px solid #000" : "";
        bodyParts.push(
          `<td class="pct-print-detail-col" style="text-align:center;vertical-align:top;font-weight:700;font-size:6.5pt;${bl};${btm}">${escapeHtml(String(v))}</td>`,
        );
      }
      bodyParts.push("</tr>");
    }
  }

  const colgroupParts = ["<colgroup>"];
  colgroupParts.push('<col style="width:6mm" />');
  colgroupParts.push('<col style="width:14mm" />');
  colgroupParts.push('<col style="width:8mm" />');
  colgroupParts.push('<col style="width:6mm;min-width:6mm" />');
  for (let i = 0; i < monthKeys.length; i++) colgroupParts.push("<col />");
  for (let i = 0; i < MONTH_DETAIL_COLS_PER_BLOCK; i++) {
    colgroupParts.push(
      `<col style="width:${A3_PRINT_DETAIL_COL_WIDTH_MM}mm" />`,
    );
  }
  colgroupParts.push("</colgroup>");

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
    
    /* Đồng bộ tất cả th và td */
    .print-ts th,
    .print-ts td { 
      border: 1px solid #1e293b; 
      padding: 2px 3px;
      vertical-align: middle;
      font-family: Consolas, "Courier New", monospace;
      font-size: 9pt;
      font-weight: normal;
      text-align: center;
      word-break: break-word;
      line-height: 1.2;
    }

    /* Cột cố định đầu bảng — gói nội dung, không tràn sang cột ngày */
    .print-ts th.pct-print-rot-cell,
    .print-ts td.pct-print-rot-cell {
      box-sizing: border-box;
      word-break: break-word;
      overflow: hidden;
      padding: 2px 1px;
      vertical-align: middle;
    }

    .print-ts th.pct-print-rot-stt,
    .print-ts td.pct-print-rot-stt {
      width: 6mm;
      max-width: 6mm;
    }

    .print-ts th.pct-print-rot-name,
    .print-ts td.pct-print-rot-name {
      width: 12mm;
      max-width: 12mm;
      font-family: Arial, Helvetica, "DejaVu Sans", sans-serif;
    }

    .print-ts th.pct-print-rot-mnv,
    .print-ts td.pct-print-rot-mnv {
      width: 8mm;
      max-width: 8mm;
      font-family: Consolas, "Courier New", monospace;
    }

    .print-ts th.pct-print-rot-dept,
    .print-ts td.pct-print-rot-dept {
      width: 10mm;
      max-width: 10mm;
      font-family: Arial, Helvetica, "DejaVu Sans", sans-serif;
    }

    /* Chữ dọc bằng writing-mode — luôn nằm trong bề ngang ô */
    .print-ts .pct-print-vmode {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      font-size: 6.5pt;
      font-weight: 700;
      line-height: 1.15;
      max-height: 68mm;
      margin: 0 auto;
      text-align: center;
      overflow: hidden;
      word-break: break-word;
      font-family: Arial, Helvetica, "DejaVu Sans", sans-serif;
    }

    .print-ts th .pct-print-vmode {
      font-size: 6pt;
    }

    /* STT: xoay -90° trong ô hẹp */
    .print-ts .pct-print-rot-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      min-height: 10mm;
      box-sizing: border-box;
    }

    .print-ts .pct-print-vneg90 {
      display: inline-block;
      transform: rotate(0deg);
      transform-origin: center center;
      white-space: nowrap;
      line-height: 1.05;
    }

    .print-ts .pct-print-name-text {
      text-align: center;
    }

    .print-ts th .pct-print-name-text {
      white-space: nowrap;
    }

    .print-ts td.pct-print-rot-name .pct-print-name-text {
      white-space: normal;
    }

    .print-ts .pct-print-vmode .pct-print-mnv {
      font-size: 0.78em;
      font-weight: 600;
      color: #1e40af;
    }

    /* Khối THỜI GIAN LÀM VIỆC — cột rộng hơn, tiêu đề 2 dòng ngang */
    .print-ts th.pct-print-detail-head,
    .print-ts td.pct-print-detail-col {
      width: ${A3_PRINT_DETAIL_COL_WIDTH_MM}mm;
      max-width: ${A3_PRINT_DETAIL_COL_WIDTH_MM}mm;
      box-sizing: border-box;
      padding: 2px 2px;
      word-break: normal;
      vertical-align: top;
    }

    .print-ts th.pct-print-detail-head {
      padding: 3px 2px 2px;
    }

    .print-ts th.pct-print-detail-head .pct-print-detail-2line {
      display: block;
      font-family: Arial, Helvetica, "DejaVu Sans", sans-serif;
      font-size: 5.25pt;
      font-weight: 700;
      line-height: 1.12;
      text-align: center;
      white-space: normal;
      word-break: keep-all;
    }

    .print-ts th.pct-print-detail-head .pct-print-detail-line2 {
      font-size: 4.85pt;
      font-weight: 700;
    }
    
    .print-ts th { 
      font-weight: 700;
      background-color: #f1f5f9;
    }
    
    .hint { 
      font-size: 6pt; 
      color: #475569; 
      text-align: center; 
      margin-bottom: 4px; 
    }

    @media print {
      .pct-print-screen-hint {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(labels.docTitle)}</h1>
  <p class="hint pct-print-screen-hint">${escapeHtml(labels.printHint)}</p>
  <table class="print-ts">
    ${colgroupParts.join("")}
    <thead>${theadParts.join("")}</thead>
    <tbody>${bodyParts.join("")}</tbody>
  </table>
  <p class="hint pct-print-screen-hint">${escapeHtml(labels.generatedHint)}</p>
</body>
</html>`;
}

function buildPayrollMonthEmployeeDayCells({ monthDayMeta, rep, rowId }) {
  return monthDayMeta.map(({ dateKey, chunk, bodyBg }) => {
    if (!chunk) {
      return {
        dateKey,
        chunk,
        baseBg: bodyBg,
        beforeJoin: false,
        emp: null,
        main: null,
        coeffMap: null,
      };
    }
    const emp = resolvePayrollMonthDayEmployee(chunk, rowId, rep);
    const beforeJoin = isPayrollMonthDayCellBeforeJoinWithoutAttendance(
      dateKey,
      pickPayrollEmployeeJoinDate(rep),
      emp,
    );
    if (beforeJoin) {
      return {
        dateKey,
        chunk,
        baseBg: bodyBg,
        beforeJoin,
        emp: null,
        main: null,
        coeffMap: null,
      };
    }
    const main = emp ? getPayrollMonthlyMainRowCell(emp, chunk) : null;
    const coeffMap = emp
      ? getPayrollMonthlyCoeffHoursMap(
          payrollOtDayParamsFromMonthChunkEmp(emp, chunk),
        )
      : null;
    return {
      dateKey,
      chunk,
      baseBg: bodyBg,
      beforeJoin,
      emp,
      main,
      coeffMap,
    };
  });
}

function buildPayrollMonthEmployeeDayCellsMap(rowIds, monthDayMeta, repById) {
  const m = new Map();
  for (const rowId of rowIds) {
    m.set(
      rowId,
      buildPayrollMonthEmployeeDayCells({
        monthDayMeta,
        rep: repById.get(rowId),
        rowId,
      }),
    );
  }
  return m;
}

const PayrollMonthlyTimesheetDayCell = memo(
  function PayrollMonthlyTimesheetDayCell({
    dayCell,
    rowId,
    rep,
    sr,
    loading,
    user,
    userRole,
    userDepartments,
    isLastSub,
    subrowEdgeClass,
    blockStartClass,
    openDayCellEditor,
    tlPage,
  }) {
    const cellStyle = {
      ...monthDayCellStyle(),
      ...(isLastSub ? { borderBottom: "2px solid #000" } : null),
    };

    if (dayCell.beforeJoin) {
      return (
        <td
          style={cellStyle}
          className={`${THIN_BODY_BORDER_CLASS} pm-ts-day-cell pm-ts-data-cell text-center text-slate-300 ${dayCell.baseBg} ${subrowEdgeClass} ${blockStartClass}`}
        >
          {" "}
        </td>
      );
    }

    if (!dayCell.chunk) {
      return (
        <td
          style={cellStyle}
          className={`${THIN_BODY_BORDER_CLASS} pm-ts-day-cell pm-ts-data-cell text-center text-slate-400 ${dayCell.baseBg} ${subrowEdgeClass} ${blockStartClass}`}
        >
          {" "}
        </td>
      );
    }

    const canOpenThisDayCell = canEditPayrollMonthTimesheetGridCell({
      loading,
      user,
      rep,
      rowDayEmp: dayCell.emp,
      userRole,
      userDepartments,
    });
    const { className: dayCellInteractCls, props: dayCellInteract } =
      payrollMonthTimesheetDayCellA11y({
        canOpen: canOpenThisDayCell,
        dateKey: dayCell.dateKey,
        rowId,
        openDayCellEditor,
        tlPage,
      });

    if (!dayCell.emp) {
      const dayCode =
        sr.coeff == null
          ? payrollMonthMainRowDashMark(dayCell.chunk, null)
          : " ";
      return (
        <td
          style={cellStyle}
          className={`${THIN_BODY_BORDER_CLASS} pm-ts-day-cell pm-ts-data-cell text-center align-middle font-bold text-slate-900 dark:text-slate-100 ${dayCell.baseBg} ${subrowEdgeClass} ${blockStartClass} ${dayCellInteractCls}`}
          {...dayCellInteract}
        >
          {dayCode}
        </td>
      );
    }

    if (sr.coeff == null) {
      const main = dayCell.main;
      let inner;
      const isLeaveCell = main.kind === "leave";
      if (isLeaveCell) {
        inner = (
          <div className="pm-ts-leave-wrap">
            <span
              className={`${MONTH_DAY_LEAVE_BADGE_BASE_CLASS} ${getAttendanceLeaveTypeEmphasisBadgeClassName(main.leaveRaw)} ${getAttendanceLeaveTypeCompactBadgeClassName(main.leaveShort)}`}
              title={main.leaveRaw}
            >
              {main.leaveShort}
            </span>
          </div>
        );
      } else if (main.kind === "hours") {
        inner = (
          <div className="pm-ts-day-value-wrap">
            <span className={MONTH_DAY_MAIN_VALUE_CLASS}>
              {formatCoeffHoursForDisplay(main.hours)}
            </span>
          </div>
        );
      } else {
        const dayMark = payrollMonthMainRowDashMark(dayCell.chunk, dayCell.emp);
        inner = (
          <div className="pm-ts-day-value-wrap">
            <span
              className={
                dayMark !== " "
                  ? MONTH_DAY_MAIN_VALUE_CLASS
                  : "pm-ts-day-empty"
              }
            >
              {dayMark}
            </span>
          </div>
        );
      }
      return (
        <td
          style={cellStyle}
          className={`${THIN_BODY_BORDER_CLASS} ${
            isLeaveCell ? "pm-ts-leave-cell" : ""
          } ${MONTH_DAY_MAIN_CELL_CLASS} ${
            isLeaveCell
              ? getAttendanceLeaveTypeEmphasisCellClassName(main.leaveRaw)
              : dayCell.baseBg
          } ${subrowEdgeClass} ${blockStartClass} ${dayCellInteractCls}`}
          {...dayCellInteract}
        >
          {inner}
        </td>
      );
    }

    const coeffTxt = formatPayrollMonthlyCoeffSubrowDayCell({
      emp: dayCell.emp,
      ch: dayCell.chunk,
      sr,
      coeffMap: dayCell.coeffMap,
      main: dayCell.main,
    });
    const show = coeffTxt != null && String(coeffTxt).trim() !== "";
    return (
      <td
        style={cellStyle}
        className={`${THIN_BODY_BORDER_CLASS} pm-ts-day-cell pm-ts-data-cell text-center align-middle ${dayCell.baseBg} ${subrowEdgeClass} ${blockStartClass} ${dayCellInteractCls}`}
        {...dayCellInteract}
      >
        {show ? (
          <div className="pm-ts-day-value-wrap">
            <span className="pm-ts-coeff-value">{coeffTxt}</span>
          </div>
        ) : (
          <div className="pm-ts-day-value-wrap">
            <span className="pm-ts-day-empty"> </span>
          </div>
        )}
      </td>
    );
  },
);

const PayrollMonthlyTimesheetDetailCells = memo(
  function PayrollMonthlyTimesheetDetailCells({
    rowId,
    sr,
    detailValues,
    isLastSub,
    subrowEdgeClass,
    blockStartClass,
  }) {
    return detailValues.map((v, idx) => {
      const group = Math.floor(idx / MONTH_DETAIL_COLS_PER_BLOCK);
      const groupBg = payrollMonthlyTimesheetDetailGroupBodyClass(group);
      return (
        <td
          key={`detail-${rowId}-${sr.key}-${idx}`}
          style={{
            ...monthDetailCellStyle(idx),
            ...(isLastSub ? { borderBottom: "2px solid #000" } : null),
          }}
          className={`${THIN_BODY_BORDER_CLASS} ${groupBg} ${subrowEdgeClass} ${
            idx % MONTH_DETAIL_COLS_PER_BLOCK === 0
              ? STRONG_BORDER_LEFT_CLASS
              : ""
          } ${blockStartClass} pm-ts-data-cell pm-ts-detail-cell text-center font-bold text-slate-900 dark:text-slate-100`}
        >
          {v}
        </td>
      );
    });
  },
);

const PayrollMonthlyTimesheetEmployeeBlock = memo(
  function PayrollMonthlyTimesheetEmployeeBlock({
    rowId,
    empBlockIdx,
    rep,
    monthDayMeta,
    summaries,
    loading,
    user,
    userRole,
    userDepartments,
    openDayCellEditor,
    tlPage,
  }) {
    const rowDays = useMemo(
      () =>
        buildPayrollMonthEmployeeDayCells({
          monthDayMeta,
          rep,
          rowId,
        }),
      [monthDayMeta, rep, rowId],
    );
    const sttDisp = empBlockIdx + 1;
    const employeeStripe =
      empBlockIdx % 2 === 0
        ? "bg-white dark:bg-slate-900"
        : "bg-slate-50 dark:bg-slate-900/80";

    const detailValuesBySubrow = useMemo(
      () => buildMonthlyDetailMatrixForEmployee(summaries),
      [summaries],
    );

    return (
      <>
        {PAYROLL_MONTHLY_SUBROWS.map((sr, si) => {
          const isLastSub = si === PAYROLL_MONTHLY_SUBROWS.length - 1;
          const isFirstSub = si === 0;
          const subrowEdgeClass = isLastSub ? STRONG_BORDER_BOTTOM_CLASS : "";
          const blockStartClass =
            isFirstSub && empBlockIdx > 0 ? "!border-t-0" : "";
          return (
            <tr
              key={`${rowId}-${sr.key}`}
              className={`pm-ts-row ${si === 0 ? "pm-ts-row--main" : "pm-ts-row--coeff"} ${employeeStripe} hover:bg-slate-50/70 dark:hover:bg-slate-800/35`}
            >
              {si === 0 ? (
                <td
                  rowSpan={PAYROLL_MONTHLY_SUBROWS.length}
                  style={stickyColStyle(0)}
                  className={`${STICKY_TD_BASE_CLASS} ${stickyColClass(0)} text-center font-semibold tabular-nums ${STRONG_BORDER_BOTTOM_CLASS}`}
                >
                  {sttDisp}
                </td>
              ) : null}
              {si === 0 ? (
                <td
                  rowSpan={PAYROLL_MONTHLY_SUBROWS.length}
                  style={stickyColStyle(1)}
                  className={`${STICKY_TD_BASE_CLASS} ${stickyColClass(1)} pm-ts-name-col text-center align-middle leading-tight ${STRONG_BORDER_BOTTOM_CLASS}`}
                  title={rep?.hoVaTen ?? ""}
                >
                  <div className="pm-ts-name-cell">
                    {rep?.hoVaTen ?? "—"}
                  </div>
                </td>
              ) : null}
              <td
                style={{
                  ...stickyColStyle(2),
                  ...(isLastSub ? { borderBottom: "2px solid #000" } : null),
                }}
                className={`${STICKY_TD_BASE_CLASS} ${stickyColClass(2)} pm-ts-sticky-data-cell pm-ts-data-cell pm-ts-mnv-cell text-center ${subrowEdgeClass} ${blockStartClass}`}
                title={rep?.mnv ?? ""}
              >
                {rep?.mnv ? rep.mnv : "—"}
              </td>
              <td
                style={{
                  ...stickyColStyle(3),
                  ...(isLastSub ? { borderBottom: "2px solid #000" } : null),
                }}
                className={`${STICKY_TD_BASE_CLASS} ${stickyColClass(3)} pm-ts-sticky-data-cell pm-ts-data-cell pm-ts-bp-cell text-center ${subrowEdgeClass} ${blockStartClass}`}
                title={rep?.boPhan ?? ""}
              >
                {rep?.boPhan ? rep.boPhan : "—"}
              </td>
              <td
                style={{
                  ...stickyColStyle(4),
                  ...(isLastSub ? { borderBottom: "2px solid #000" } : null),
                }}
                className={`${STICKY_TD_BASE_CLASS} ${stickyColClass(4)} pm-ts-sticky-data-cell pm-ts-data-cell pm-ts-coeff-col-cell text-center ${subrowEdgeClass} ${blockStartClass}`}
              >
                {sr.coeff == null ? "\u00a0" : Number(sr.coeff).toFixed(1)}
              </td>
              {rowDays.map((dayCell) => (
                <PayrollMonthlyTimesheetDayCell
                  key={dayCell.dateKey}
                  dayCell={dayCell}
                  rowId={rowId}
                  rep={rep}
                  sr={sr}
                  loading={loading}
                  user={user}
                  userRole={userRole}
                  userDepartments={userDepartments}
                  isLastSub={isLastSub}
                  subrowEdgeClass={subrowEdgeClass}
                  blockStartClass={blockStartClass}
                  openDayCellEditor={openDayCellEditor}
                  tlPage={tlPage}
                />
              ))}
              <PayrollMonthlyTimesheetDetailCells
                rowId={rowId}
                sr={sr}
                detailValues={detailValuesBySubrow[si]}
                isLastSub={isLastSub}
                subrowEdgeClass={subrowEdgeClass}
                blockStartClass={blockStartClass}
              />
            </tr>
          );
        })}
      </>
    );
  },
);

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
  const [localNameFilter, setLocalNameFilter] = useState("");
  const [headerRowTops, setHeaderRowTops] = useState(
    MONTH_HEADER_ROW_TOPS_DEFAULT,
  );
  const [timesheetZoomIdx, setTimesheetZoomIdx] = useState(
    readStoredTimesheetZoomIdx,
  );
  const tableWrapRef = useRef(null);
  const tableBodyScrollRef = useRef(null);
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

  const {
    dayChunks,
    displayDayChunks,
    loading,
    loadingMore,
    isGridBusy,
    isDisplayStale,
    error,
    setError,
    loadMonth,
  } = usePayrollMonthDayChunks({
    monthKeys: monthRange.keys,
    tlPage,
  });

  useEffect(() => {
    if (!open) return;
    void loadMonth();
  }, [open, loadMonth]);

  usePayrollMonthModalScrollLock(open);

  useEffect(() => {
    if (open) return;
    setDayCellFormOpen(false);
    setDayCellFormDate("");
    setDayCellFormInitial(null);
    setDayCellFormEmployees([]);
  }, [open]);

  const { sortedIds, repById, chunkByDate, chunkByDateLive } =
    usePayrollMonthEmployeeIndex(dayChunks, displayDayChunks);

  const openDayCellForm = useCallback(
    (dateKey, dayEmps, formInitial) => {
      setDayCellFormEmployees(dayEmps);
      setDayCellFormDate(dateKey);
      setDayCellFormInitial(formInitial);
      setDayCellFormOpen(true);
    },
    [],
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
      const ch = chunkByDateLive.get(dateKey);
      if (!ch) return;
      const rep = repById.get(rowId);
      if (!rep) return;
      const dayEmp = resolvePayrollMonthDayEmployee(ch, rowId, rep);
      const dayEmps =
        Array.isArray(ch.baseEmployees) && ch.baseEmployees.length > 0
          ? ch.baseEmployees
          : Array.isArray(ch.employees)
            ? ch.employees
            : [];
      const formInitial = buildPayrollMonthDayCellFormRecord({
        chunk: ch,
        rowId,
        rep,
        dayEmp,
      });

      const canEditCell = canEditPayrollMonthTimesheetGridCell({
        loading: false,
        user,
        rep,
        rowDayEmp: dayEmp,
        userRole,
        userDepartments,
      });

      if (!canEditCell) {
        onAlert?.({
          show: true,
          type: "error",
          message: dayEmp
            ? tlPage(
                "monthlyTimesheetNoEditPermission",
                "Bạn không có quyền sửa nhân viên này.",
              )
            : tlPage(
                "monthlyTimesheetNoAddPermission",
                "Bạn không có quyền thêm điểm danh cho bộ phận này.",
              ),
        });
        return;
      }

      openDayCellForm(dateKey, dayEmps, formInitial);
    },
    [
      user,
      chunkByDateLive,
      repById,
      userRole,
      userDepartments,
      onAlert,
      tlPage,
      openDayCellForm,
    ],
  );

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
      for (const dept of rep?.boPhanAll ?? []) {
        const t = String(dept ?? "").trim();
        if (t) set.add(t);
      }
    });
    return [...set].sort((a, b) => a.localeCompare(b, "vi"));
  }, [sortedIds, repById, payrollDepartmentOptions]);

  const effectiveDepartmentFilter = departmentFilter || "";
  const effectiveSearchTerm = localNameFilter || searchTerm || "";

  const filteredIds = useMemo(() => {
    return sortedIds
      .filter((id) => {
        const rep = repById.get(id);
        return (
          rep &&
          matchesPayrollMonthRowFilter(rep, {
            searchTerm: effectiveSearchTerm,
            departmentFilter: effectiveDepartmentFilter,
            normalizeDepartment,
          })
        );
      })
      .sort((a, b) =>
        comparePayrollMonthRowsByDepartment(repById.get(a), repById.get(b)),
      );
  }, [
    sortedIds,
    repById,
    effectiveSearchTerm,
    effectiveDepartmentFilter,
    normalizeDepartment,
  ]);

  const {
    monthlySummaryById,
    isSummariesBusy,
    summaryProgress,
  } = usePayrollMonthSummaries({
    enabled: open,
    monthKeys: monthRange.keys,
    chunkByDate,
    filteredIds,
    repById,
  });

  const isGridFullyBusy = isGridBusy || isSummariesBusy;

  const gridOverlayCopy = useMemo(
    () =>
      buildPayrollMonthGridOverlayCopy({
        tlPage,
        loadingMore,
        isDisplayStale,
        isSummariesBusy,
        summaryProgress,
      }),
    [
      tlPage,
      loadingMore,
      isDisplayStale,
      isSummariesBusy,
      summaryProgress,
    ],
  );

  const monthDayMeta = useMemo(
    () =>
      monthRange.keys.map((dateKey) => {
        const parsedDate = parseLocalDateKey(dateKey);
        const chunk = chunkByDate.get(dateKey);
        return {
          dateKey,
          parsedDate,
          dayOfMonth: parsedDate ? parsedDate.getDate() : "",
          weekdayLabel: formatPayrollMonthWeekday3(parsedDate),
          isSunday: parsedDate?.getDay() === 0,
          chunk,
          headerBg: payrollMonthlyTimesheetDayHeaderBgClass(parsedDate, chunk),
          bodyBg: payrollMonthlyTimesheetDayBodyBgClass(parsedDate, chunk),
        };
      }),
    [monthRange.keys, chunkByDate],
  );

  const shouldVirtualizeTimesheetBody =
    filteredIds.length >= MONTHLY_TIMESHEET_VIRTUAL_THRESHOLD;

  const empBlockVirtualizer = useVirtualizer({
    count: shouldVirtualizeTimesheetBody ? filteredIds.length : 0,
    getScrollElement: () => tableBodyScrollRef.current,
    estimateSize: () =>
      payrollMonthlyEmpBlockScrollHeight(
        TIMESHEET_ZOOM_CSS_OK ? timesheetZoom : 1,
      ),
    measureElement: (el) => el?.getBoundingClientRect().height ?? 0,
    overscan: 3,
  });

  useLayoutEffect(() => {
    if (!open || !shouldVirtualizeTimesheetBody) return;
    empBlockVirtualizer.measure();
  }, [
    open,
    shouldVirtualizeTimesheetBody,
    filteredIds.length,
    timesheetZoomIdx,
    isGridFullyBusy,
    monthRange.keys.length,
  ]);

  const timesheetTotalColCount = payrollMonthlyTimesheetTotalColCount(
    monthRange.keys.length,
  );

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

  const detailHeaders = useMemo(
    () => buildPayrollMonthlyTimesheetDetailHeaders(tlPage),
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
    filteredIds,
    monthlySummaryById,
    monthRange.keys,
    repById,
    tlPage,
  ]);

  const handlePrintA3WorkTimeOnly = useCallback(() => {
    if (!filteredIds.length || !monthRange.keys.length) return;
    const labels = {
      docTitle: `${tlPage("monthlyTimesheetTitle", "PAVONINE - Bảng chấm công")} — ${monthTitle}`,
      stt: tlPage("monthlyTimesheetColStt", "STT"),
      name: tlPage("monthlyTimesheetColName", "Họ và tên"),
      mnv: tlPage("monthlyTimesheetColMnv", "MNV"),
      dept: tlPage("monthlyTimesheetColDept", "BP"),
      coeff: tlPage("monthlyTimesheetColCoeff", "Hệ số TC"),
      daysBanner: tlPage("monthlyTimesheetDaysInMonth", "Ngày trong tháng"),
      workTimeTitle: tlPage("monthlyRuleTotalTitle", "THỜI GIAN LÀM VIỆC"),
      groupWorkday: tlPage("monthlyRuleGroupWorkday", "NGÀY LÀM VIỆC"),
      groupOt: tlPage("monthlyRuleGroupOt", "TĂNG CA (Hrs)"),
      groupSats: PAYROLL_MONTHLY_DETAIL_GROUP_SATS_LABEL,
      printHint: tlPage(
        "monthlyTimesheetPrintA3Hint",
        "Khổ A3 ngang — chỉ in khối THỜI GIAN LÀM VIỆC (không in thử việc / hợp đồng).",
      ),
      generatedHint: tlPage(
        "monthlyTimesheetPrintGenerated",
        "Theo bộ lọc đang hiển thị trên lưới.",
      ),
    };
    const html = buildPayrollMonthlyTimesheetA3WorkTimePrintDocument({
      monthKeys: monthRange.keys,
      filteredIds,
      repById,
      chunkByDate,
      summaryById: monthlySummaryById,
      detailHeaders,
      labels,
      employeeDayCellsById: buildPayrollMonthEmployeeDayCellsMap(
        filteredIds,
        monthDayMeta,
        repById,
      ),
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
    monthDayMeta,
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
                disabled={
                  isGridFullyBusy ||
                  !filteredIds.length ||
                  !displayDayChunks.length
                }
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
              className="pm-ts-scroll min-h-0 overflow-auto"
              style={{
                height: `min(calc(100vh - 11.5rem), ${tableViewportHeight}px)`,
              }}
            >
              {loading && !displayDayChunks.length ? (
                <PayrollMonthGridLoadingOverlay
                  active
                  mode="inline"
                  message={tlPage(
                    "monthlyTimesheetLoading",
                    "Đang tải dữ liệu...",
                  )}
                />
              ) : error && !displayDayChunks.length ? (
                <p className="py-8 text-center text-sm font-semibold text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : (
                <div
                  ref={tableWrapRef}
                  className="pm-ts-table-wrap relative inline-block min-w-full align-middle"
                  style={{
                    "--pm-ts-day-cell-size": `${MONTH_DAY_COL_WIDTH}px`,
                    ...(TIMESHEET_ZOOM_CSS_OK ? { zoom: timesheetZoom } : {}),
                  }}
                >
                  <PayrollMonthGridLoadingOverlay
                    active={isGridFullyBusy && displayDayChunks.length > 0}
                    message={gridOverlayCopy.message}
                    subtitle={gridOverlayCopy.subtitle}
                  />
                  <table
                    className={`pm-ts-table w-max min-w-full border-collapse text-left text-slate-900 dark:text-slate-100 ${STRONG_BORDER_CLASS}`}
                  >
                    <thead className="pm-ts-thead">
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        {[0, 1, 2, 3, 4].map((ci) => (
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
                            className={`${STICKY_TH_BASE_CLASS} ${stickyColClass(ci)} text-center align-middle`}
                          >
                            {ci === 3 ? (
                              tlPage("monthlyTimesheetColDept", "BP")
                            ) : ci === 4 ? (
                              tlPage(
                                "monthlyTimesheetColCoeff",
                                "Hệ số TC",
                              )
                            ) : ci === 0 ? (
                              tlPage("monthlyTimesheetColStt", "STT")
                            ) : ci === 1 ? (
                              tlPage("monthlyTimesheetColName", "Họ và tên")
                            ) : (
                              tlPage("monthlyTimesheetColMnv", "MNV")
                            )}
                          </th>
                        ))}
                        <th
                          colSpan={monthRange.keys.length}
                          style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                          className={`${THIN_HEAD_BORDER_CLASS} pm-ts-banner-head bg-slate-200 px-1 py-1.5 text-center font-extrabold uppercase tracking-wide text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                        >
                          {tlPage(
                            "monthlyTimesheetDaysInMonth",
                            "Ngày trong tháng",
                          )}
                        </th>
                        <th
                          colSpan={MONTH_DETAIL_COLS_PER_BLOCK}
                          style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                          className={`${THIN_HEAD_BORDER_CLASS} ${STRONG_BORDER_LEFT_CLASS} pm-ts-banner-head bg-slate-200 px-1 py-1.5 text-center font-extrabold text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                        >
                          {tlPage(
                            "monthlyRuleTotalTitle",
                            "THỜI GIAN LÀM VIỆC",
                          )}
                        </th>
                        <th
                          colSpan={MONTH_DETAIL_COLS_PER_BLOCK}
                          style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                          className={`${THIN_HEAD_BORDER_CLASS} ${STRONG_BORDER_LEFT_CLASS} pm-ts-banner-head bg-slate-200 px-1 py-1.5 text-center font-extrabold text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                        >
                          {tlPage(
                            "monthlyRuleTrialTitle",
                            "THỜI GIAN THỬ VIỆC",
                          )}
                        </th>
                        <th
                          colSpan={MONTH_DETAIL_COLS_PER_BLOCK}
                          style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                          className={`${THIN_HEAD_BORDER_CLASS} ${STRONG_BORDER_LEFT_CLASS} pm-ts-banner-head bg-slate-200 px-1 py-1.5 text-center font-extrabold text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                        >
                          {tlPage(
                            "monthlyRuleOfficialTitle",
                            "THỜI GIAN HỢP ĐỒNG",
                          )}
                        </th>
                      </tr>
                      <tr>
                        {monthDayMeta.map((dayMeta) => {
                          return (
                            <th
                              key={dayMeta.dateKey}
                              rowSpan={2}
                              style={{
                                ...monthDayCellStyle(),
                                ...monthHeaderStickyStyle(
                                  headerRowTops.row2,
                                  85,
                                ),
                              }}
                              className={`${THIN_HEAD_BORDER_CLASS} ${NO_TOP_BORDER_CLASS} pm-ts-day-header px-1 py-1.5 text-center ${dayMeta.headerBg}`}
                            >
                              <div className="pm-ts-header-day">
                                {String(dayMeta.dayOfMonth).padStart(2, "0")}
                              </div>
                              <div
                                className={`pm-ts-header-wd ${dayMeta.isSunday ? "pm-ts-header-wd--sun" : ""}`}
                              >
                                {dayMeta.weekdayLabel}
                              </div>
                            </th>
                          );
                        })}
                        {DETAIL_GROUP_KEYS.flatMap((groupKey) => {
                          const groupBg =
                            payrollMonthlyTimesheetDetailGroupHeaderClass(
                              groupKey,
                            );
                          return [
                            <th
                              key={`${groupKey}-workday`}
                              colSpan={MONTH_DETAIL_WORKDAY_COL_COUNT}
                              style={monthHeaderStickyStyle(
                                headerRowTops.row2,
                                85,
                              )}
                              className={`${THIN_HEAD_BORDER_CLASS} ${NO_TOP_BORDER_CLASS} pm-ts-detail-group-head ${groupBg} ${STRONG_BORDER_LEFT_CLASS} px-1 py-1 text-center font-extrabold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
                            >
                              {tlPage(
                                "monthlyRuleGroupWorkday",
                                "NGÀY LÀM VIỆC",
                              )}
                            </th>,
                            <th
                              key={`${groupKey}-ot`}
                              colSpan={MONTH_DETAIL_OT_COL_COUNT}
                              style={monthHeaderStickyStyle(
                                headerRowTops.row2,
                                85,
                              )}
                              className={`${THIN_HEAD_BORDER_CLASS} ${NO_TOP_BORDER_CLASS} pm-ts-detail-group-head ${groupBg} px-1 py-1 text-center font-extrabold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
                            >
                              {tlPage("monthlyRuleGroupOt", "TĂNG CA (Hrs)")}
                            </th>,
                            ...(MONTH_DETAIL_SATS_COL_COUNT > 0
                              ? [
                                  <th
                                    key={`${groupKey}-sats`}
                                    colSpan={MONTH_DETAIL_SATS_COL_COUNT}
                                    style={monthHeaderStickyStyle(
                                      headerRowTops.row2,
                                      85,
                                    )}
                                    className={`${THIN_HEAD_BORDER_CLASS} ${NO_TOP_BORDER_CLASS} pm-ts-detail-group-head ${groupBg} px-1 py-1 text-center font-extrabold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
                                  >
                                    SAT.S
                                  </th>,
                                ]
                              : []),
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
                              className={`${THIN_HEAD_BORDER_CLASS} ${NO_TOP_BORDER_CLASS} pm-ts-detail-col-head ${payrollMonthlyTimesheetDetailGroupHeaderClass(groupKey)} ${idx === 0 ? STRONG_BORDER_LEFT_CLASS : ""} px-1 py-1 text-center font-bold text-slate-900 dark:text-slate-100`}
                            >
                              {h}
                            </th>
                          )),
                        )}
                      </tr>
                    </thead>
                    {shouldVirtualizeTimesheetBody ? (
                      <>
                        {tbodyPadTop > 0 ? (
                          <tbody aria-hidden className="pointer-events-none">
                            <tr>
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
                          </tbody>
                        ) : null}
                        {virtualEmpItems.map((vi) => {
                          const rowId = filteredIds[vi.index];
                          return (
                            <tbody
                              key={rowId}
                              ref={empBlockVirtualizer.measureElement}
                              data-index={vi.index}
                            >
                              <PayrollMonthlyTimesheetEmployeeBlock
                                rowId={rowId}
                                empBlockIdx={vi.index}
                                rep={repById.get(rowId)}
                                monthDayMeta={monthDayMeta}
                                summaries={monthlySummaryById.get(rowId)}
                                loading={loading}
                                user={user}
                                userRole={userRole}
                                userDepartments={userDepartments}
                                openDayCellEditor={openDayCellEditor}
                                tlPage={tlPage}
                              />
                            </tbody>
                          );
                        })}
                        {tbodyPadBottom > 0 ? (
                          <tbody aria-hidden className="pointer-events-none">
                            <tr>
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
                          </tbody>
                        ) : null}
                      </>
                    ) : (
                      <tbody>
                        {filteredIds.map((rowId, idx) => (
                          <PayrollMonthlyTimesheetEmployeeBlock
                            key={rowId}
                            rowId={rowId}
                            empBlockIdx={idx}
                            rep={repById.get(rowId)}
                            monthDayMeta={monthDayMeta}
                            summaries={monthlySummaryById.get(rowId)}
                            loading={loading}
                            user={user}
                            userRole={userRole}
                            userDepartments={userDepartments}
                            openDayCellEditor={openDayCellEditor}
                            tlPage={tlPage}
                          />
                        ))}
                      </tbody>
                    )}
                  </table>
                  {error && displayDayChunks.length ? (
                    <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-300">
                      {error}
                    </p>
                  ) : null}
                  {!filteredIds.length && displayDayChunks.length ? (
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
