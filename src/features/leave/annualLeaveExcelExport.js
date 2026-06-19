import ExcelJS from "exceljs";
import {
  ANNUAL_LEAVE_EMP,
} from "./annualLeaveFields";
import {
  formatAnnualLeaveDecimal,
  formatAnnualLeaveDisplayDate,
} from "./annualLeaveCalculated";

const HEADER_FILL = "C6E0B4";
const BONUS_HEADER_COLOR = "FF0000";
const BALANCE_HEADER_FILL = "FFFF00";

/**
 * Xuất Excel phép năm — layout khớp form HR.
 * @param {object[]} rows
 * @param {number} year
 */
export async function exportAnnualLeaveExcel(rows, year) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Annual Leave ${year}`);

  const headers = [
    "No",
    "EMPL. CODE",
    "",
    "Full Name",
    "Date of Birth",
    "SUB-DEPARTMENT",
    "START WORKING DATE",
    "ANNUAL LEAVE IN CURRENT YEAR",
    "BONUS ANNUAL LEAVE (Environment)",
    "Compensatory day off NGHỈ BÙ",
    "TOTAL ANNUAL LEAVE",
    "ANNUAL LEAVE USED",
    "BALANCE",
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    if (colNumber === 9) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
      cell.font = { bold: true, size: 10, color: { argb: BONUS_HEADER_COLOR } };
    } else if (colNumber === 13) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BALANCE_HEADER_FILL } };
    } else {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    }
  });

  sheet.mergeCells(1, 2, 1, 3);

  rows.forEach((row, idx) => {
    const dataRow = sheet.addRow([
      row.rowNo ?? idx + 1,
      row[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? "",
      row[ANNUAL_LEAVE_EMP.MNV_SUFFIX] ?? "",
      row[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "",
      formatAnnualLeaveDisplayDate(row[ANNUAL_LEAVE_EMP.DATE_OF_BIRTH]),
      row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] ?? "",
      formatAnnualLeaveDisplayDate(row[ANNUAL_LEAVE_EMP.START_WORKING_DATE], {
        fullYear: true,
      }),
      row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR] ?? 0,
      row[ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV] || "-",
      row[ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF] || "-",
      formatAnnualLeaveDecimal(row[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]),
      formatAnnualLeaveDecimal(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]),
      formatAnnualLeaveDecimal(row[ANNUAL_LEAVE_EMP.BALANCE]),
    ]);
    dataRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      if (colNumber === 4 || colNumber === 6) {
        cell.alignment.horizontal = "left";
      }
      if (colNumber === 13) {
        cell.font = { color: { argb: BONUS_HEADER_COLOR } };
      }
    });
  });

  sheet.columns = [
    { width: 5 },
    { width: 10 },
    { width: 8 },
    { width: 28 },
    { width: 12 },
    { width: 14 },
    { width: 16 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 10 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
