import ExcelJS from "exceljs";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  formatAnnualLeaveDecimal,
  formatAnnualLeaveDisplayDate,
  parseAnnualLeaveAdjustment,
  roundAnnualLeaveHours,
} from "./annualLeaveCalculated";
import {
  ANNUAL_LEAVE_EXCEL_COL,
  buildAnnualLeaveExcelHeaderRow1,
  buildAnnualLeaveExcelHeaderRow2,
  buildAnnualLeaveExcelMonthColumnLabels,
  resolveAnnualLeaveExcelAdjustColumnIndex,
} from "./annualLeaveExcelTemplate";

const HEADER_FILL = "C6E0B4";
const BALANCE_HEADER_FILL = "FFFF00";
const BALANCE_HEADER_COLOR = "FF0000";
const ANNUAL_LEAVE_DECIMAL_FMT = "0.00";

function annualLeaveExcelNumeric(value) {
  const n = roundAnnualLeaveHours(value);
  return Number.isFinite(n) ? n : 0;
}

function annualLeaveExcelAdjustment(value) {
  const n = parseAnnualLeaveAdjustment(value);
  if (n === 0) return "";
  return annualLeaveExcelNumeric(n);
}

function applyHeaderCellStyle(cell, colNumber) {
  cell.font = { bold: true, size: 10 };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
  if (colNumber === ANNUAL_LEAVE_EXCEL_COL.BALANCE + 1) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BALANCE_HEADER_FILL },
    };
  } else {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
  }
}

function applyDataCellStyle(cell, colNumber) {
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
  cell.alignment = { vertical: "middle", horizontal: "center" };
  if (
    colNumber === ANNUAL_LEAVE_EXCEL_COL.FULL_NAME + 1 ||
    colNumber === ANNUAL_LEAVE_EXCEL_COL.SUB_DEPARTMENT + 1
  ) {
    cell.alignment.horizontal = "left";
  }
  if (colNumber === ANNUAL_LEAVE_EXCEL_COL.BALANCE + 1) {
    cell.font = { color: { argb: BALANCE_HEADER_COLOR } };
  }
  if (
    colNumber === ANNUAL_LEAVE_EXCEL_COL.ANNUAL_LEAVE_USED + 1 ||
    colNumber === ANNUAL_LEAVE_EXCEL_COL.BALANCE + 1
  ) {
    cell.numFmt = ANNUAL_LEAVE_DECIMAL_FMT;
  }
}

function applyAdjustDataCellStyle(cell, adjustColNumber) {
  applyDataCellStyle(cell, adjustColNumber);
  if (cell.value !== "" && cell.value != null) {
    cell.numFmt = ANNUAL_LEAVE_DECIMAL_FMT;
  }
}

/**
 * Xuất Excel phép năm — template 2 hàng header, 12 cột tháng (read-only).
 * Cột phép năm = tích lũy theo tháng (+ thâm niên), tính từ START WORKING DATE.
 * @param {object[]} rows
 * @param {number} year
 * @param {{ monthColumnLabels?: string[], monthlyByEmpKey?: Record<string, number[]> }} [options]
 */
export async function exportAnnualLeaveExcel(rows, year, options = {}) {
  const headerRow1 = buildAnnualLeaveExcelHeaderRow1(year);
  const headerRow2 = buildAnnualLeaveExcelHeaderRow2(year);
  const monthColumnLabels =
    options.monthColumnLabels ?? buildAnnualLeaveExcelMonthColumnLabels(year);
  const monthlyByEmpKey = options.monthlyByEmpKey ?? {};
  const adjustColIndex = resolveAnnualLeaveExcelAdjustColumnIndex(
    monthColumnLabels.length,
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Annual Leave ${year}`);

  const header1 = sheet.addRow(headerRow1);
  header1.height = 22;
  header1.eachCell((cell, colNumber) => applyHeaderCellStyle(cell, colNumber));

  const header2 = sheet.addRow(headerRow2);
  header2.height = 18;
  header2.eachCell((cell, colNumber) => applyHeaderCellStyle(cell, colNumber));

  sheet.mergeCells(1, 2, 1, 3);
  sheet.mergeCells(1, 1, 2, 1);
  sheet.mergeCells(1, 4, 2, 4);
  sheet.mergeCells(1, 5, 2, 5);
  sheet.mergeCells(1, 6, 2, 6);
  sheet.mergeCells(1, 7, 2, 7);
  sheet.mergeCells(1, 8, 2, 8);
  sheet.mergeCells(1, 9, 2, 9);
  sheet.mergeCells(1, 10, 2, 10);

  for (let m = 0; m < monthColumnLabels.length; m += 1) {
    sheet.mergeCells(1, ANNUAL_LEAVE_EXCEL_COL.MONTHS_START + 1 + m, 2, ANNUAL_LEAVE_EXCEL_COL.MONTHS_START + 1 + m);
  }
  sheet.mergeCells(1, adjustColIndex + 1, 2, adjustColIndex + 1);

  sheet.views = [{ state: "frozen", ySplit: 2, xSplit: ANNUAL_LEAVE_EXCEL_COL.MONTHS_START }];

  rows.forEach((row, idx) => {
    const monthValues = monthlyByEmpKey[row.id] ?? [];
    const annualDisplay =
      row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR] ?? 0;

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
      annualDisplay,
      annualLeaveExcelNumeric(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]),
      annualLeaveExcelNumeric(row[ANNUAL_LEAVE_EMP.BALANCE]),
      ...monthValues.map((value) =>
        value > 0 ? formatAnnualLeaveDecimal(value) : "-",
      ),
      annualLeaveExcelAdjustment(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT]),
    ]);
    dataRow.eachCell((cell, colNumber) => {
      if (colNumber === adjustColIndex + 1) {
        applyAdjustDataCellStyle(cell, adjustColIndex + 1);
        return;
      }
      applyDataCellStyle(cell, colNumber);
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
    { width: 14 },
    { width: 12 },
    { width: 10 },
    ...monthColumnLabels.map(() => ({ width: 11 })),
    { width: 10 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
