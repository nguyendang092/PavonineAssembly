/**
 * Ma trận xuất Excel bảng chấm công tháng — cùng layout cột với PayrollMonthlyTimesheetModal.
 */
import ExcelJS from "exceljs";
import { roundHoursToTenths } from "@/features/attendance/attendanceWorkingHours";
import {
  getPayrollMonthlyMainRowCell,
  getPayrollMonthlyCoeffHoursMap,
  PAYROLL_MONTHLY_SUBROWS,
} from "@/features/payroll/payrollMonthlyCoefficientBuckets";
import { payrollMonthMainRowDashMark } from "@/features/attendance/attendanceDayMeta";
import { payrollOtDayParamsFromMonthChunkEmp } from "@/features/payroll/payrollOtDayParams";
import { payrollExcelHourValueToNumber } from "@/features/payroll/payrollExcelExport";
import {
  buildMonthlyDetailMatrixForEmployee,
  isPayrollMonthDayCellBeforeJoinWithoutAttendance,
} from "@/features/payroll/payrollMonthlyRuleSummary";
import {
  DETAIL_GROUP_KEYS,
  MONTH_DETAIL_COLS_PER_BLOCK,
  MONTHLY_TIMESHEET_STICKY_COL_COUNT,
  payrollMonthlyTimesheetLayoutOffsets,
} from "@/features/payroll/payrollMonthlyTimesheetLayout";
import {
  buildPayrollMonthlyTimesheetExcelBorders,
  resolvePayrollMonthlyTimesheetExcelCellFill,
} from "@/features/payroll/payrollMonthlyTimesheetGridStyle";
import { pickPayrollEmployeeJoinDate } from "@/features/payroll/payrollEmployeeFields";
import { resolvePayrollMonthDayEmployee } from "@/features/payroll/payrollMonthlyGridData";
import { parseLocalDateKey } from "@/utils/dateKey";

/** Một hàng tiêu đề (không gộp ô) — đủ nhãn cột, tránh lặp 3 hàng header. */
const HEADER_ROW_COUNT = 1;
const EXCEL_HEADER_ROW_HEIGHT = 42;
const EXCEL_BODY_ROW_HEIGHT = 24;
/** Dòng giờ thường + phép (hệ số TC trống) — cao hơn một chút để dễ đọc. */
const EXCEL_MAIN_SUBROW_HEIGHT = 26;

/** Một chữ số thập phân — đồng bộ xuất bảng lương ngày. */
const PAYROLL_MONTHLY_EXCEL_HOURS_NUM_FMT = "0.0";

function excelHoursOrEmpty(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  return roundHoursToTenths(n);
}

function excelLeaveCountOrEmpty(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n);
  return roundHoursToTenths(n);
}

function excelDashMarkOrEmpty(mark) {
  const s = String(mark ?? "").trim();
  return s === "" || s === " " ? null : s;
}

/** Giá trị ô ngày Excel — số cho giờ công; chữ cho mã phép / NB / NL. */
export function formatPayrollMonthlyTimesheetDayCellText({
  emp,
  ch,
  dateKey,
  sr,
  joinDate,
}) {
  if (
    isPayrollMonthDayCellBeforeJoinWithoutAttendance(dateKey, joinDate, emp)
  ) {
    return null;
  }
  if (!ch) return null;
  if (!emp) {
    return sr.coeff == null
      ? excelDashMarkOrEmpty(payrollMonthMainRowDashMark(ch, null))
      : null;
  }
  const coeffMap = getPayrollMonthlyCoeffHoursMap(
    payrollOtDayParamsFromMonthChunkEmp(emp, ch),
  );
  if (sr.coeff == null) {
    const main = getPayrollMonthlyMainRowCell(emp, ch);
    if (main.kind === "leave") {
      if (Number.isFinite(main.workedHours) && main.workedHours > 0) {
        return excelHoursOrEmpty(main.workedHours);
      }
      const leaveLabel = String(main.leaveShort ?? "").trim();
      return leaveLabel || null;
    }
    if (main.kind === "hours") {
      return excelHoursOrEmpty(main.hours);
    }
    return excelDashMarkOrEmpty(payrollMonthMainRowDashMark(ch, emp));
  }
  const h = coeffMap.get(sr.coeff);
  return excelHoursOrEmpty(h);
}

function formatEnglishWeekday3(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
}

function coercePayrollMonthlyExcelNumericCell(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = payrollExcelHourValueToNumber(value);
  if (n != null) return n;
  return value;
}

function applyPayrollMonthlyTimesheetExcelNumberFormats(
  sheet,
  { layout, monthKeys, maxRow, maxCols },
) {
  const L = MONTHLY_TIMESHEET_STICKY_COL_COUNT;
  const dayColFirst = L + 1;
  const dayColLast = L + monthKeys.length;
  const detailColFirst = layout.totalDetailStart + 1;
  const coeffCol = L;

  sheet.getColumn(coeffCol).numFmt = PAYROLL_MONTHLY_EXCEL_HOURS_NUM_FMT;
  for (let c = dayColFirst; c <= dayColLast; c += 1) {
    sheet.getColumn(c).numFmt = PAYROLL_MONTHLY_EXCEL_HOURS_NUM_FMT;
  }
  for (let c = detailColFirst; c <= maxCols; c += 1) {
    sheet.getColumn(c).numFmt = PAYROLL_MONTHLY_EXCEL_HOURS_NUM_FMT;
  }

  for (let r = HEADER_ROW_COUNT + 1; r <= maxRow; r += 1) {
    const row = sheet.getRow(r);
    const sttCell = row.getCell(1);
    sttCell.value = coercePayrollMonthlyExcelNumericCell(sttCell.value);

    const coeffCell = row.getCell(coeffCol);
    coeffCell.value = coercePayrollMonthlyExcelNumericCell(coeffCell.value);
    if (typeof coeffCell.value === "number") {
      coeffCell.numFmt = PAYROLL_MONTHLY_EXCEL_HOURS_NUM_FMT;
    }

    for (let c = dayColFirst; c <= dayColLast; c += 1) {
      const cell = row.getCell(c);
      const coerced = coercePayrollMonthlyExcelNumericCell(cell.value);
      cell.value = coerced;
      if (typeof coerced === "number") {
        cell.numFmt = PAYROLL_MONTHLY_EXCEL_HOURS_NUM_FMT;
      }
    }

    for (let c = detailColFirst; c <= maxCols; c += 1) {
      const cell = row.getCell(c);
      const coerced = coercePayrollMonthlyExcelNumericCell(cell.value);
      cell.value = coerced;
      if (typeof coerced === "number") {
        cell.numFmt = PAYROLL_MONTHLY_EXCEL_HOURS_NUM_FMT;
      }
    }
  }
}

export function buildPayrollMonthlyTimesheetExcelGrid({
  tlPage,
  monthKeys,
  chunkByDate,
  filteredIds,
  repById,
  summaryById,
  detailHeaders,
}) {
  const days = monthKeys.length;
  const layout = payrollMonthlyTimesheetLayoutOffsets(days);
  const cols = layout.totalCols;
  const grid = [];

  const emptyRow = () => Array(cols).fill(null);
  const L = MONTHLY_TIMESHEET_STICKY_COL_COUNT;

  const header = emptyRow();
  header[0] = tlPage("monthlyTimesheetColStt", "STT");
  header[1] = tlPage("monthlyTimesheetColName", "Họ và tên");
  header[2] = tlPage("monthlyTimesheetColMnv", "MNV");
  header[3] = tlPage("monthlyTimesheetColDept", "BP");
  header[4] = tlPage("monthlyTimesheetColCoeff", "Hệ số TC");

  monthKeys.forEach((dk, i) => {
    const pd = parseLocalDateKey(dk);
    const dom = pd ? pd.getDate() : "";
    const wd = formatEnglishWeekday3(pd);
    header[L + i] = `${String(dom).padStart(2, "0")}` + (wd ? ` ${wd}` : "");
  });

  for (let g = 0; g < DETAIL_GROUP_KEYS.length; g++) {
    const base = layout.totalDetailStart + g * MONTH_DETAIL_COLS_PER_BLOCK;
    detailHeaders.forEach((h, idx) => {
      header[base + idx] = h;
    });
  }
  grid.push(header);

  filteredIds.forEach((id, empBlockIdx) => {
    const rep = repById.get(id);
    const summaries = summaryById.get(id);
    const detailMatrix = buildMonthlyDetailMatrixForEmployee(summaries, {
      fmt: excelHoursOrEmpty,
      fmtLeave: excelLeaveCountOrEmpty,
    });
    const nameDisp = String(rep?.hoVaTen ?? "—");
    const mnvDisp =
      rep?.mnv != null && String(rep.mnv).trim() ? String(rep.mnv) : "—";
    const deptDisp = rep?.boPhan ? String(rep.boPhan) : "—";

    PAYROLL_MONTHLY_SUBROWS.forEach((sr, si) => {
      const row = emptyRow();
      row[0] = empBlockIdx + 1;
      row[1] = nameDisp;
      row[2] = mnvDisp;
      row[3] = deptDisp;
      row[4] = sr.coeff == null ? null : roundHoursToTenths(sr.coeff);

      monthKeys.forEach((dk, di) => {
        const ch = chunkByDate.get(dk);
        const cidx = L + di;
        if (!ch) {
          row[cidx] = null;
          return;
        }
        const emp = resolvePayrollMonthDayEmployee(ch, id, rep);
        row[cidx] = formatPayrollMonthlyTimesheetDayCellText({
          emp,
          ch,
          dateKey: dk,
          sr,
          joinDate: pickPayrollEmployeeJoinDate(rep),
        });
      });

      const detailFlat = detailMatrix[si];

      detailFlat.forEach((v, i) => {
        row[layout.totalDetailStart + i] = v;
      });

      grid.push(row);
    });
  });

  return { grid, layout };
}

export function applyPayrollMonthlyTimesheetExcelSheetStyles(
  sheet,
  { layout, monthKeys, chunkByDate, filteredIds, repById, maxCols },
) {
  const maxRow = sheet.rowCount;
  const maxCol = maxCols ?? Math.max(sheet.columnCount || 0, layout.totalCols);
  const subrowCount = PAYROLL_MONTHLY_SUBROWS.length;
  const L = MONTHLY_TIMESHEET_STICKY_COL_COUNT;
  const daysEnd = L + monthKeys.length;

  for (let r = 1; r <= maxRow; r += 1) {
    let empBlockIdx = 0;
    let subrowIndex = 0;
    let empId = null;
    if (r > HEADER_ROW_COUNT) {
      const bodyIdx = r - HEADER_ROW_COUNT - 1;
      empBlockIdx = Math.floor(bodyIdx / subrowCount);
      subrowIndex = bodyIdx % subrowCount;
      empId = filteredIds[empBlockIdx] ?? null;
    }

    if (r <= HEADER_ROW_COUNT) {
      sheet.getRow(r).height = EXCEL_HEADER_ROW_HEIGHT;
    } else if (subrowIndex === 0) {
      sheet.getRow(r).height = EXCEL_MAIN_SUBROW_HEIGHT;
    } else {
      sheet.getRow(r).height = EXCEL_BODY_ROW_HEIGHT;
    }

    for (let c = 1; c <= maxCol; c += 1) {
      const cell = sheet.getCell(r, c);

      let isLeaveCell = false;
      let leaveRaw;
      if (
        empId &&
        r > HEADER_ROW_COUNT &&
        c > L &&
        c <= daysEnd &&
        PAYROLL_MONTHLY_SUBROWS[subrowIndex]?.coeff == null
      ) {
        const dk = monthKeys[c - L - 1];
        const ch = chunkByDate.get(dk);
        const rep = repById.get(empId);
        if (ch) {
          const emp = resolvePayrollMonthDayEmployee(ch, empId, rep);
          if (
            emp &&
            !isPayrollMonthDayCellBeforeJoinWithoutAttendance(
              dk,
              pickPayrollEmployeeJoinDate(rep),
              emp,
            )
          ) {
            const main = getPayrollMonthlyMainRowCell(emp, ch);
            if (main.kind === "leave") {
              isLeaveCell = true;
              leaveRaw = main.leaveRaw;
            }
          }
        }
      }

      const fillArgb = resolvePayrollMonthlyTimesheetExcelCellFill({
        r,
        c,
        layout,
        headerRowCount: HEADER_ROW_COUNT,
        monthKeys,
        chunkByDate,
        empBlockIdx,
        subrowIndex,
        leaveRaw,
        isLeaveCell,
      });
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fillArgb },
      };

      cell.border = buildPayrollMonthlyTimesheetExcelBorders({
        row1Based: r,
        col1Based: c,
        maxRow,
        maxCol,
        layout,
        headerRowCount: HEADER_ROW_COUNT,
        subrowCount,
        subrowIndex: r > HEADER_ROW_COUNT ? subrowIndex : null,
        monthKeyCount: monthKeys.length,
        empBlockIdx: r > HEADER_ROW_COUNT ? empBlockIdx : 0,
      });

      const isHeader = r <= HEADER_ROW_COUNT;
      const isNameCol = c === 2;
      const isMnvCol = c === 3;
      const isCoeffCol = c === L;
      const isDayOrDetail = c > L;
      cell.alignment = {
        vertical: "middle",
        horizontal: isNameCol && !isHeader ? "left" : "center",
        wrapText: true,
      };
      cell.font = {
        name:
          isMnvCol || isCoeffCol || (isDayOrDetail && !isHeader)
            ? "Consolas"
            : "Arial",
        size: isHeader ? 10 : 9,
        bold: isHeader || isCoeffCol || (isDayOrDetail && !isHeader),
        color: { argb: "FF0F172A" },
      };
    }
  }
}

export async function writePayrollMonthlyTimesheetWorkbook({
  tlPage,
  monthKeys,
  chunkByDate,
  filteredIds,
  repById,
  summaryById,
  detailHeaders,
}) {
  const { grid, layout } = buildPayrollMonthlyTimesheetExcelGrid({
    tlPage,
    monthKeys,
    chunkByDate,
    filteredIds,
    repById,
    summaryById,
    detailHeaders,
  });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("MonthlyTimesheet");

  grid.forEach((row) => {
    sheet.addRow(row.map((v) => (v == null ? null : v)));
  });

  const maxRow = sheet.rowCount;
  const maxCols = grid.reduce((m, row) => Math.max(m, row.length), 0);
  for (let c = 1; c <= maxCols; c += 1) {
    if (c === 1) sheet.getColumn(c).width = 6;
    else if (c === 2) sheet.getColumn(c).width = 22;
    else if (c === 3) sheet.getColumn(c).width = 12;
    else if (c <= MONTHLY_TIMESHEET_STICKY_COL_COUNT)
      sheet.getColumn(c).width = 12;
    else sheet.getColumn(c).width = 6;
  }

  applyPayrollMonthlyTimesheetExcelSheetStyles(sheet, {
    layout,
    monthKeys,
    chunkByDate,
    filteredIds,
    repById,
    maxCols,
  });

  applyPayrollMonthlyTimesheetExcelNumberFormats(sheet, {
    layout,
    monthKeys,
    maxRow,
    maxCols,
  });

  return workbook.xlsx.writeBuffer();
}
