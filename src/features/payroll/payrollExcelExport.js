import ExcelJS from "exceljs";
import { parseLocalDateKey } from "@/utils/dateKey";
import {
  formatPayrollDayOvertimeHoursCell,
  formatPayrollTableHolidayDayWorkingCell,
  formatPayrollTableHolidayNightWorkingCell,
  formatPayrollTableNightShiftOffDayWorkingCell,
  formatPayrollTableNightShiftOvertimeCell,
  formatPayrollTableNightShiftWorkingCell,
  formatPayrollTableOffDayTcCell,
  formatPayrollTableTotalDayGcCell,
  formatPayrollTableTotalNightGcCell,
  formatPayrollTableWorkingHoursCell,
  roundHoursToTenths,
} from "@/features/attendance/attendanceWorkingHours";
import {
  formatAttendanceLeaveTypeColumnForEmployee,
  formatAttendanceTimeInColumnDisplay,
} from "@/features/attendance/attendanceGioVaoTypeOptions";
import { formatTrangThaiLamViecPlain } from "@/features/attendance/attendanceEmploymentStatus";

/** Một ngày & nhiều ngày: 3 cột (ngày / tháng / năm) + 25 cột bảng. */
const PAYROLL_EXCEL_COL_COUNT = 28;

/**
 * Trong `payrollEmployeeRowValues`, cột giờ (Giờ công … Tổng GC ca đêm) bắt đầu ở index này.
 * @see payrollEmployeeRowValues
 */
const PAYROLL_ROW_HOURS_START = 15;
const PAYROLL_ROW_HOURS_COUNT = 10;

/** Cột giờ trong sheet (1-based): sau Ngày/Tháng/Năm + … + Ngày lễ = cột 19 … 28. */
const PAYROLL_EXCEL_HOURS_COL_FIRST = 19;
const PAYROLL_EXCEL_HOURS_COL_LAST = 28;

/**
 * Một chữ số thập phân — tránh Excel hiển thị 3.5 thành 4 khi định dạng 0 chữ số thập phân.
 * @see https://support.microsoft.com (định dạng số)
 */
const PAYROLL_EXCEL_HOURS_NUM_FMT = "0.0";

function applyPayrollExcelHourColumnNumberFormats(worksheet) {
  for (
    let c = PAYROLL_EXCEL_HOURS_COL_FIRST;
    c <= PAYROLL_EXCEL_HOURS_COL_LAST;
    c++
  ) {
    worksheet.getColumn(c).numFmt = PAYROLL_EXCEL_HOURS_NUM_FMT;
  }
}

/**
 * Chuỗi ô giờ từ formatters («-», số) → số để Excel lưu kiểu number; không có số → null (ô trống).
 * @param {unknown} formatted
 * @returns {number | null}
 */
export function payrollExcelHourValueToNumber(formatted) {
  if (formatted == null) return null;
  const s = String(formatted).trim();
  if (s === "" || s === "-" || s === "—") return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return roundHoursToTenths(n);
}

/**
 * @param {unknown[]} rest — mảng 24 phần tử (không gồm STT) từ `payrollEmployeeRowValues`
 * @returns {unknown[]}
 */
function coercePayrollHourRestToNumbers(rest) {
  return rest.map((v, i) => {
    if (
      i < PAYROLL_ROW_HOURS_START ||
      i >= PAYROLL_ROW_HOURS_START + PAYROLL_ROW_HOURS_COUNT
    ) {
      return v;
    }
    return payrollExcelHourValueToNumber(v);
  });
}

/**
 * ExcelJS đôi khi giữ ô giờ dạng chuỗi sau `addRow` — ép lại từng ô (cột giờ 19–28) về number + numFmt,
 * đồng bộ xuất 1 ngày / nhiều ngày và tránh hiển thị như text.
 */
function applyPayrollHourNumericCellsToRow(row) {
  for (
    let c = PAYROLL_EXCEL_HOURS_COL_FIRST;
    c <= PAYROLL_EXCEL_HOURS_COL_LAST;
    c++
  ) {
    const cell = row.getCell(c);
    const n = payrollExcelHourValueToNumber(cell.value);
    cell.value = n;
    if (n != null) {
      cell.numFmt = PAYROLL_EXCEL_HOURS_NUM_FMT;
    }
  }
}

function appendPayrollWorksheetDataRow(
  worksheet,
  day,
  month,
  year,
  emp,
  idx,
  ctx,
) {
  const rest = coercePayrollHourRestToNumbers(
    payrollEmployeeRowValues(emp, idx, ctx),
  );
  const [stt, ...withoutStt] = rest;
  const dataRow = worksheet.addRow([stt, day, month, year, ...withoutStt]);
  stylePayrollDataRow(dataRow, { nameCol: 7, hoursFromCol: 19 });
  applyPayrollHourNumericCellsToRow(dataRow);
}

/** Giới hạn cùng logic xuất khoảng điểm danh. */
export const PAYROLL_EXCEL_MAX_RANGE_DAYS = 366;

/**
 * @param {string} dateKey YYYY-MM-DD
 * @param {string} [displayLocale]
 */
export function formatPayrollExcelDateCell(dateKey, displayLocale) {
  const d = parseLocalDateKey(dateKey);
  if (!d) return String(dateKey ?? "");
  return d.toLocaleDateString(displayLocale || "vi-VN");
}

/**
 * Tách ngày / tháng / năm từ `dateKey` (YYYY-MM-DD) theo lịch local — dùng cho xuất Excel.
 * @returns {{ day: number | ""; month: number | ""; year: number | "" }}
 */
export function getPayrollExcelDateParts(dateKey) {
  const d = parseLocalDateKey(dateKey);
  if (!d) return { day: "", month: "", year: "" };
  return {
    day: d.getDate(),
    month: d.getMonth() + 1,
    year: d.getFullYear(),
  };
}

/**
 * @param {object} emp
 * @param {number} idx
 * @param {{
 *   isPayrollOffLikeDay?: boolean,
 *   isOffDay?: boolean,
 *   isHolidayDay?: boolean,
 *   earlyOtPaperworkById?: Record<string, boolean>,
 * }} ctx — `isPayrollOffLikeDay`: off hoặc lễ (TC off). Hiển thị OFF/HOLIDAY từ isOffDay / isHolidayDay.
 */
export function payrollEmployeeRowValues(emp, idx, ctx) {
  const {
    isPayrollOffLikeDay,
    isOffDay = false,
    isHolidayDay = false,
    earlyOtPaperworkById = {},
  } = ctx;
  const offLike =
    isPayrollOffLikeDay !== undefined
      ? isPayrollOffLikeDay
      : Boolean(isOffDay) || Boolean(isHolidayDay);
  const stt =
    emp.stt != null && String(emp.stt).trim() !== "" ? emp.stt : idx + 1;
  return [
    stt,
    emp.mnv ?? "",
    emp.mvt ?? "",
    emp.hoVaTen ?? "",
    emp.gioiTinh ?? "",
    emp.ngayVaoLam ?? "",
    formatTrangThaiLamViecPlain(emp.trangThaiLamViec),
    emp.maBoPhan ?? "",
    emp.boPhan ?? "",
    formatAttendanceTimeInColumnDisplay(emp.gioVao ?? ""),
    emp.gioRa ?? "",
    formatAttendanceLeaveTypeColumnForEmployee(emp) || "",
    emp.caLamViec ?? "",
    isOffDay ? "OFF" : "",
    isHolidayDay ? "HOLIDAY" : "",
    formatPayrollTableWorkingHoursCell(
      emp.gioVao,
      emp.gioRa,
      offLike,
      emp.caLamViec,
    ),
    formatPayrollDayOvertimeHoursCell(
      emp.gioVao,
      emp.gioRa,
      isOffDay,
      emp.caLamViec,
      earlyOtPaperworkById[emp.id],
      isHolidayDay,
    ),
    formatPayrollTableOffDayTcCell(
      emp.gioVao,
      emp.gioRa,
      isOffDay,
      emp.caLamViec,
      earlyOtPaperworkById[emp.id],
    ),
    formatPayrollTableHolidayDayWorkingCell(
      emp.gioVao,
      emp.gioRa,
      isHolidayDay,
      emp.caLamViec,
      earlyOtPaperworkById[emp.id],
    ),
    formatPayrollTableTotalDayGcCell(
      emp.gioVao,
      emp.gioRa,
      isOffDay,
      isHolidayDay,
      emp.caLamViec,
      earlyOtPaperworkById[emp.id],
    ),
    formatPayrollTableNightShiftWorkingCell(
      emp.gioVao,
      emp.gioRa,
      offLike,
      emp.caLamViec,
    ),
    formatPayrollTableNightShiftOvertimeCell(
      emp.gioVao,
      emp.gioRa,
      offLike,
      emp.caLamViec,
    ),
    formatPayrollTableNightShiftOffDayWorkingCell(
      emp.gioVao,
      emp.gioRa,
      isOffDay,
      emp.caLamViec,
    ),
    formatPayrollTableHolidayNightWorkingCell(
      emp.gioVao,
      emp.gioRa,
      isHolidayDay,
      emp.caLamViec,
    ),
    formatPayrollTableTotalNightGcCell(
      emp.gioVao,
      emp.gioRa,
      offLike,
      emp.caLamViec,
    ),
  ];
}

/** Header đầy đủ (đồng bộ xuất 1 ngày / nhiều ngày): STT đứng đầu. */
function buildPayrollExcelFullHeaders(tlTable) {
  return [
    tlTable("stt", "STT"),
    tlTable("workDateDay", "Ngày"),
    tlTable("workDateMonth", "Tháng"),
    tlTable("workDateYear", "Năm"),
    tlTable("mnv", "MNV"),
    tlTable("mvt", "MVT"),
    tlTable("fullName", "Họ và tên"),
    tlTable("gender", "Giới tính"),
    tlTable("joinDate", "Ngày vào làm"),
    tlTable("workStatusColumn", "Trạng thái LV"),
    tlTable("departmentCode", "Mã BP"),
    tlTable("department", "Bộ phận"),
    tlTable("timeIn", "Thời gian vào"),
    tlTable("timeOut", "Thời gian ra"),
    tlTable("leaveTypeColumn", "Loại phép"),
    tlTable("workShift", "Ca làm việc"),
    tlTable("offDayColumn", "Ngày off"),
    tlTable("holidayDayColumn", "Ngày lễ"),
    tlTable("workingHours", "Giờ công"),
    tlTable("overtimeHours", "Giờ TC"),
    tlTable("offDayOvertimeHours", "TC off"),
    tlTable("holidayDayWorkingHours", "GC ngày lễ"),
    tlTable("payrollTotalGcDay", "Tổng GC"),
    tlTable("nightShiftWorkingHours", "GC ca đêm"),
    tlTable("nightShiftOvertimeHours", "TC ca đêm"),
    tlTable("nightShiftOffDayWorkingHours", "GC ca đêm off"),
    tlTable("holidayNightWorkingHours", "GC ca đêm lễ"),
    tlTable("payrollTotalGcNight", "Tổng GC ca đêm"),
  ];
}

const PAYROLL_EXCEL_FULL_COLUMN_WIDTHS = [
  { width: 5 },
  { width: 6 },
  { width: 6 },
  { width: 5 },
  { width: 10 },
  { width: 8 },
  { width: 22 },
  { width: 8 },
  { width: 12 },
  { width: 14 },
  { width: 10 },
  { width: 18 },
  { width: 10 },
  { width: 10 },
  { width: 10 },
  { width: 14 },
  { width: 12 },
  { width: 12 },
  { width: 10 },
  { width: 10 },
  { width: 10 },
  { width: 10 },
  { width: 10 },
  { width: 10 },
  { width: 11 },
  { width: 11 },
  { width: 10 },
  { width: 12 },
];

function stylePayrollDataRow(row, { nameCol, hoursFromCol }) {
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
    const isHoursCol = colNumber >= hoursFromCol;
    cell.font = { size: 10, bold: isHoursCol };
    cell.alignment = {
      vertical: "middle",
      horizontal: colNumber === nameCol ? "left" : "center",
      wrapText: false,
    };
  });
}

function applyHeaderRowStyles(headerRow) {
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF6366F1" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

/** Workbook + sheet «Payroll» với dòng tiêu đề và hàng header cột (dùng chung 1 ngày / nhiều ngày). */
function createPayrollSalaryWorksheetBase(tlTable, sheetTitle) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Payroll", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  worksheet.mergeCells(1, 1, 1, PAYROLL_EXCEL_COL_COUNT);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = sheetTitle;
  titleCell.font = { bold: true, size: 12, color: { argb: "FF1E293B" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  worksheet.getRow(1).height = 22;

  const headers = buildPayrollExcelFullHeaders(tlTable);
  const headerRow = worksheet.getRow(2);
  headers.forEach((text, i) => {
    headerRow.getCell(i + 1).value = text;
  });
  applyHeaderRowStyles(headerRow);
  headerRow.height = 18;

  return { workbook, worksheet };
}

function finalizePayrollWorksheetColumns(worksheet) {
  worksheet.columns = PAYROLL_EXCEL_FULL_COLUMN_WIDTHS;
  applyPayrollExcelHourColumnNumberFormats(worksheet);
}

/**
 * Xuất Excel bảng lương (một ngày): ba cột Ngày / Tháng / Năm + đủ cột giống bảng desktop, cùng layout với xuất nhiều ngày.
 * @param {{ employees: object[], selectedDate: string, isPayrollOffLikeDay: boolean, isOffDay?: boolean, isHolidayDay?: boolean, tlTable: function, sheetTitle: string, earlyOtPaperworkById?: Record<string, boolean> }} opts
 */
export async function buildPayrollSalaryExcelWorkbook({
  employees,
  selectedDate,
  isPayrollOffLikeDay,
  isOffDay = false,
  isHolidayDay = false,
  tlTable,
  sheetTitle,
  earlyOtPaperworkById = {},
}) {
  const { workbook, worksheet } = createPayrollSalaryWorksheetBase(
    tlTable,
    sheetTitle,
  );

  const { day, month, year } = getPayrollExcelDateParts(selectedDate);
  const ctx = {
    isPayrollOffLikeDay,
    isOffDay,
    isHolidayDay,
    earlyOtPaperworkById,
  };
  employees.forEach((emp, idx) => {
    appendPayrollWorksheetDataRow(worksheet, day, month, year, emp, idx, ctx);
  });

  finalizePayrollWorksheetColumns(worksheet);

  return workbook;
}

/**
 * Nhiều ngày: một sheet; ba cột đầu là Ngày / Tháng / Năm (số, từ `dateKey` local).
 * @param {{ dayChunks: { dateKey: string, employees: object[], isPayrollOffLikeDay: boolean, isOffDay?: boolean, isHolidayDay?: boolean, earlyOtPaperworkById: Record<string, boolean> }[], tlTable: function, sheetTitle: string }} opts
 */
export async function buildPayrollSalaryExcelWorkbookMultiDay({
  dayChunks,
  tlTable,
  sheetTitle,
}) {
  const { workbook, worksheet } = createPayrollSalaryWorksheetBase(
    tlTable,
    sheetTitle,
  );

  for (const chunk of dayChunks) {
    const ctx = {
      isPayrollOffLikeDay: chunk.isPayrollOffLikeDay,
      isOffDay: chunk.isOffDay ?? false,
      isHolidayDay: chunk.isHolidayDay ?? false,
      earlyOtPaperworkById: chunk.earlyOtPaperworkById || {},
    };
    const { day, month, year } = getPayrollExcelDateParts(chunk.dateKey);
    chunk.employees.forEach((emp, idx) => {
      appendPayrollWorksheetDataRow(worksheet, day, month, year, emp, idx, ctx);
    });
  }

  finalizePayrollWorksheetColumns(worksheet);

  return workbook;
}

const PAYROLL_XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function triggerDownloadXlsxBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: PAYROLL_XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPayrollSalaryExcel(opts) {
  const { selectedDate } = opts;
  const workbook = await buildPayrollSalaryExcelWorkbook(opts);
  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownloadXlsxBuffer(buffer, `Bang-gio-cong_${selectedDate}.xlsx`);
}

/** @param {{ workbook: object, filename: string }} opts */
export async function downloadPayrollWorkbookToFile({ workbook, filename }) {
  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownloadXlsxBuffer(buffer, filename);
}
