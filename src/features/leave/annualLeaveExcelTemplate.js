import {
  formatAnnualLeaveMonthColumnLabel,
  listAnnualLeaveCalendarYearMonths,
} from "./annualLeaveCalculated";

/** Số cột cố định trước 12 tháng (No → BALANCE). */
export const ANNUAL_LEAVE_EXCEL_FIXED_COLUMN_COUNT = 10;

/** Chỉ số cột (0-based) trong sheet. */
export const ANNUAL_LEAVE_EXCEL_COL = {
  NO: 0,
  MNV_PREFIX: 1,
  MNV_SUFFIX: 2,
  FULL_NAME: 3,
  DATE_OF_BIRTH: 4,
  SUB_DEPARTMENT: 5,
  START_WORKING_DATE: 6,
  ANNUAL_LEAVE_CURRENT_YEAR: 7,
  ANNUAL_LEAVE_USED: 8,
  BALANCE: 9,
  MONTHS_START: 10,
};

export function resolveAnnualLeaveExcelAdjustColumnIndex(monthCount = 12) {
  return ANNUAL_LEAVE_EXCEL_COL.MONTHS_START + monthCount;
}

export function buildAnnualLeaveExcelMonthColumnLabels(year) {
  return listAnnualLeaveCalendarYearMonths(year).map(
    formatAnnualLeaveMonthColumnLabel,
  );
}

/** Header hàng 1 — khớp bảng quản lý phép năm. */
export function buildAnnualLeaveExcelHeaderRow1(year) {
  return [
    "No",
    "EMPL. CODE",
    "",
    "Full Name",
    "Date of Birth",
    "SUB-DEPARTMENT",
    "START WORKING DATE",
    "ANNUAL LEAVE IN CURRENT YEAR",
    "ANNUAL LEAVE USED",
    "BALANCE",
    ...buildAnnualLeaveExcelMonthColumnLabels(year),
    "ADJUST",
  ];
}

/** Header hàng 2 — MNV / MVT dưới EMPL. CODE. */
export function buildAnnualLeaveExcelHeaderRow2(year) {
  const monthCount = buildAnnualLeaveExcelMonthColumnLabels(year).length;
  return ["", "MNV", "MVT", ...Array(7 + monthCount + 1).fill("")];
}

export function annualLeaveExcelMonthColumnCount(year) {
  return buildAnnualLeaveExcelMonthColumnLabels(year).length;
}

export function isAnnualLeaveExcelMonthHeader(headerNorm, year) {
  if (!headerNorm) return false;
  const labels = buildAnnualLeaveExcelMonthColumnLabels(year).map((label) =>
    label.toLowerCase(),
  );
  if (labels.includes(headerNorm)) return true;
  return /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)-\d{2}$/.test(
    headerNorm.replace(/\s+/g, ""),
  );
}
