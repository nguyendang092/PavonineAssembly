/**
 * Xây ma trận ô cho xuất Excel bảng giờ công tháng — không đọc DOM (tương thích ảo hóa tbody).
 */
import ExcelJS from "exceljs";
import {
  formatCoeffHoursForDisplay,
  getPayrollMonthlyMainRowCell,
  getPayrollMonthlyCoeffHoursMap,
  PAYROLL_MONTHLY_SUBROWS,
} from "@/features/payroll/payrollMonthlyCoefficientBuckets";
import { roundHoursForPayrollDisplay } from "@/features/attendance/attendanceWorkingHours";
import { parseLocalDateKey } from "@/utils/dateKey";

const MONTH_DETAIL_COLS_PER_BLOCK = 15;
const DETAIL_GROUP_KEYS = ["total", "trial", "official"];

function formatEnglishWeekday3(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
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

export function buildPayrollMonthlyTimesheetExcelGrid({
  tlPage,
  monthKeys,
  chunkByDate,
  filteredIds,
  repById,
  summaryById,
  detailHeaders,
  displayLocale = "vi-VN",
}) {
  const days = monthKeys.length;
  const cols = 6 + days + DETAIL_GROUP_KEYS.length * MONTH_DETAIL_COLS_PER_BLOCK;
  const grid = [];
  const merges = [];

  const pushMerge = (r1, c1, r2, c2) => {
    merges.push({
      from: { row: r1 + 1, col: c1 + 1 },
      to: { row: r2 + 1, col: c2 + 1 },
    });
  };

  const emptyRow = () => Array(cols).fill(null);

  const r0 = emptyRow();
  r0[0] = tlPage("monthlyTimesheetColStt", "STT");
  r0[1] = tlPage("monthlyTimesheetColName", "Họ và tên");
  r0[2] = tlPage("monthlyTimesheetColJoinDate", "Ngày vào làm");
  r0[3] = tlPage("monthlyTimesheetColContract", "Ngày HĐ");
  r0[4] = tlPage("monthlyTimesheetColDept", "BP");
  r0[5] = tlPage("monthlyTimesheetColCoeff", "Hệ số TC");
  const dayTitle = tlPage("monthlyTimesheetDaysInMonth", "Ngày trong tháng");
  r0[6] = dayTitle;
  for (let c = 7; c < 6 + days; c++) r0[c] = null;
  r0[6 + days] = tlPage("monthlyRuleTotalTitle", "THỜI GIAN LÀM VIỆC");
  for (let c = 6 + days + 1; c < 6 + days + MONTH_DETAIL_COLS_PER_BLOCK; c++)
    r0[c] = null;
  r0[6 + days + MONTH_DETAIL_COLS_PER_BLOCK] = tlPage(
    "monthlyRuleTrialTitle",
    "THỜI GIAN THỬ VIỆC",
  );
  for (
    let c = 6 + days + MONTH_DETAIL_COLS_PER_BLOCK + 1;
    c < 6 + days + 2 * MONTH_DETAIL_COLS_PER_BLOCK;
    c++
  )
    r0[c] = null;
  r0[6 + days + 2 * MONTH_DETAIL_COLS_PER_BLOCK] = tlPage(
    "monthlyRuleOfficialTitle",
    "THỜI GIAN HỢP ĐỒNG",
  );
  for (
    let c = 6 + days + 2 * MONTH_DETAIL_COLS_PER_BLOCK + 1;
    c < cols;
    c++
  )
    r0[c] = null;
  grid.push(r0);

  for (let i = 0; i < 6; i++) pushMerge(0, i, 2, i);
  if (days >= 1) pushMerge(0, 6, 0, 6 + days - 1);
  pushMerge(
    0,
    6 + days,
    0,
    6 + days + MONTH_DETAIL_COLS_PER_BLOCK - 1,
  );
  pushMerge(
    0,
    6 + days + MONTH_DETAIL_COLS_PER_BLOCK,
    0,
    6 + days + 2 * MONTH_DETAIL_COLS_PER_BLOCK - 1,
  );
  pushMerge(
    0,
    6 + days + 2 * MONTH_DETAIL_COLS_PER_BLOCK,
    0,
    6 + days + 3 * MONTH_DETAIL_COLS_PER_BLOCK - 1,
  );

  const r1 = emptyRow();
  monthKeys.forEach((dk, i) => {
    const pd = parseLocalDateKey(dk);
    const dom = pd ? pd.getDate() : "";
    const wd = formatEnglishWeekday3(pd);
    r1[6 + i] =
      `${String(dom).padStart(2, "0")}` + (wd ? ` ${wd}` : "");
    pushMerge(1, 6 + i, 2, 6 + i);
  });

  let col = 6 + days;
  for (let gi = 0; gi < DETAIL_GROUP_KEYS.length; gi++) {
    r1[col] = tlPage("monthlyRuleGroupWorkday", "NGÀY LÀM VIỆC");
    pushMerge(1, col, 1, col + 6);
    col += 7;
    r1[col] = tlPage("monthlyRuleGroupOt", "TĂNG CA (Hrs)");
    pushMerge(1, col, 1, col + 5);
    col += 6;
    r1[col] = "SAT.S";
    pushMerge(1, col, 1, col + 1);
    col += 2;
  }
  grid.push(r1);

  const r2 = emptyRow();
  for (let g = 0; g < DETAIL_GROUP_KEYS.length; g++) {
    const base = 6 + days + g * MONTH_DETAIL_COLS_PER_BLOCK;
    detailHeaders.forEach((h, idx) => {
      r2[base + idx] = h;
    });
  }
  grid.push(r2);

  const fmt = (n) =>
    Number.isFinite(n) && roundHoursForPayrollDisplay(n) !== 0
      ? formatCoeffHoursForDisplay(n)
      : " ";

  filteredIds.forEach((id, empBlockIdx) => {
    const rep = repById.get(id);
    const summary = summaryById.get(id);
    const sttDisp =
      rep?.stt != null && String(rep.stt).trim() !== ""
        ? String(rep.stt)
        : String(empBlockIdx + 1);
    const joinStr = formatProfileDateKey(rep?.ngayVaoLam, displayLocale);
    const isTrial = isProbationStatus(rep?.trangThaiLamViec);
    const tcByRow = summary
      ? [
          summary.coeff03,
          summary.coeff15,
          summary.coeff20,
          summary.coeff27,
          summary.coeff30,
          summary.coeff39,
        ]
      : [0, 0, 0, 0, 0, 0];

    PAYROLL_MONTHLY_SUBROWS.forEach((sr, si) => {
      const row = emptyRow();
      if (si === 0) {
        row[0] = sttDisp;
        row[1] =
          rep?.mnv != null && String(rep.mnv).trim()
            ? `${rep?.hoVaTen ?? "—"}\n${rep.mnv}`
            : String(rep?.hoVaTen ?? "—");
        row[2] = joinStr;
        row[3] = tlPage("monthlyTimesheetContractDash", "—");
        row[4] = rep?.boPhan ? String(rep.boPhan) : "—";
      }
      row[5] = sr.coeff == null ? "\u00a0" : Number(sr.coeff).toFixed(1);

      monthKeys.forEach((dk, di) => {
        const ch = chunkByDate.get(dk);
        const cidx = 6 + di;
        if (!ch) {
          row[cidx] = " ";
          return;
        }
        const emp = (ch.byMonthEmployeeKey || ch.byId).get(id);
        if (!emp) {
          row[cidx] = "";
          return;
        }
        if (sr.coeff == null) {
          const main = getPayrollMonthlyMainRowCell(emp, ch);
          if (main.kind === "leave") {
            const leaveLabel = main.leaveShort || "";
            if (Number.isFinite(main.workedHours) && main.workedHours > 0) {
              row[cidx] = `${leaveLabel}\n${formatCoeffHoursForDisplay(main.workedHours)}`;
            } else {
              row[cidx] = leaveLabel;
            }
          }
          else if (main.kind === "hours")
            row[cidx] = formatCoeffHoursForDisplay(main.hours);
          else row[cidx] = " ";
          return;
        }
        const coeffMap = getPayrollMonthlyCoeffHoursMap({
          gioVao: emp.gioVao,
          gioRa: emp.gioRa,
          isOffDay: ch.isOffDay,
          isHolidayDay: ch.isHolidayDay,
          caLamViec: emp.caLamViec,
          payrollEarlyOtPaperwork: emp.payrollEarlyOtPaperwork,
          payrollLateOtPaperwork: emp.payrollLateOtPaperwork,
          loaiPhep: emp.loaiPhep,
        });
        const h = coeffMap.get(sr.coeff);
        const show =
          h != null &&
          Number.isFinite(h) &&
          roundHoursForPayrollDisplay(h) !== 0;
        row[cidx] = show ? formatCoeffHoursForDisplay(h) : " ";
      });

      const coeffColBySubrow = {
        1: 0,
        2: 1,
        3: 2,
        4: 3,
        5: 4,
        6: 5,
      };

      const valuesForStatus = (enabled) =>
        Array.from({ length: MONTH_DETAIL_COLS_PER_BLOCK }, (_, idx) => {
          if (!enabled) return " ";
          if (!summary) return " ";
          if (si === 0) {
            if (idx === 0) return fmt(summary.workDays * 8);
            if (idx === 1) return fmt(summary.workDays);
            if (idx === 2) return fmt(summary.unpaidDays);
            if (idx === 3) return fmt(summary.pnDays);
            if (idx === 4) return fmt(summary.nbDays);
            if (idx === 5) return fmt(summary.klDays);
            if (idx === 6) return fmt(summary.kpDays);
          }
          const coeffIdx = coeffColBySubrow[si];
          if (coeffIdx != null && idx === 7 + coeffIdx)
            return fmt(tcByRow[coeffIdx]);
          return " ";
        });

      const detailFlat = [
        ...valuesForStatus(true),
        ...valuesForStatus(isTrial),
        ...valuesForStatus(!isTrial),
      ];

      detailFlat.forEach((v, i) => {
        row[6 + days + i] = v;
      });

      grid.push(row);
    });

    const startBody = grid.length - PAYROLL_MONTHLY_SUBROWS.length;
    if (startBody >= 3) {
      for (let i = 0; i < 5; i++)
        pushMerge(startBody, i, startBody + PAYROLL_MONTHLY_SUBROWS.length - 1, i);
    }
  });

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === null) grid[r][c] = "";
    }
  }

  return { grid, merges };
}

/** Áp grid + merge + định dạng cơ bản giống export từ HTML (không đọc getComputedStyle). */
export async function writePayrollMonthlyTimesheetWorkbook({
  tlPage,
  monthKeys,
  chunkByDate,
  filteredIds,
  repById,
  summaryById,
  detailHeaders,
  displayLocale,
}) {
  const { grid, merges } = buildPayrollMonthlyTimesheetExcelGrid({
    tlPage,
    monthKeys,
    chunkByDate,
    filteredIds,
    repById,
    summaryById,
    detailHeaders,
    displayLocale,
  });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("MonthlyTimesheet");
  const monthRange = { keys: monthKeys };

  grid.forEach((row) => {
    sheet.addRow(row.map((v) => (v == null ? "" : v)));
  });

  merges.forEach((m) => {
    sheet.mergeCells(m.from.row, m.from.col, m.to.row, m.to.col);
  });

  const maxCols = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const fixedCols = 6;
  const daysCols = monthRange.keys.length;
  const detailBlock = MONTH_DETAIL_COLS_PER_BLOCK;
  const firstTotalCol = fixedCols + daysCols + 1;
  const firstTrialCol = firstTotalCol + detailBlock;
  const firstOfficialCol = firstTrialCol + detailBlock;

  for (let c = 1; c <= maxCols; c += 1) {
    sheet.getColumn(c).width = c <= 6 ? 16 : 6;
  }

  const setSide = (cell, side, style, argb = "FF000000") => {
    const cur = cell.border || {};
    cell.border = {
      ...cur,
      [side]: { style, color: { argb } },
    };
  };

  for (let r = 1; r <= sheet.rowCount; r += 1) {
    for (let c = 1; c <= maxCols; c += 1) {
      const cell = sheet.getCell(r, c);
      cell.border = {
        top: { style: "thin", color: { argb: "FFB8C1CC" } },
        left: { style: "thin", color: { argb: "FFB8C1CC" } },
        bottom: { style: "thin", color: { argb: "FFB8C1CC" } },
        right: { style: "thin", color: { argb: "FFB8C1CC" } },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: c <= 2 ? "left" : "center",
        wrapText: true,
      };
      cell.font = { size: r <= 3 ? 10 : 9, bold: r <= 3 };
    }
  }

  for (let c = 1; c <= maxCols; c += 1) {
    setSide(sheet.getCell(1, c), "top", "medium");
    setSide(sheet.getCell(sheet.rowCount, c), "bottom", "medium");
  }
  for (let r = 1; r <= sheet.rowCount; r += 1) {
    setSide(sheet.getCell(r, 1), "left", "medium");
    setSide(sheet.getCell(r, maxCols), "right", "medium");
  }

  [firstTotalCol, firstTrialCol, firstOfficialCol].forEach((col) => {
    if (col > maxCols) return;
    for (let r = 1; r <= sheet.rowCount; r += 1) {
      setSide(sheet.getCell(r, col), "left", "medium");
    }
  });

  const headerRows = 3;
  const bodyRows = filteredIds.length * PAYROLL_MONTHLY_SUBROWS.length;
  for (let i = 1; i <= filteredIds.length; i += 1) {
    const row = headerRows + i * PAYROLL_MONTHLY_SUBROWS.length;
    if (row > headerRows + bodyRows) continue;
    for (let c = 1; c <= maxCols; c += 1) {
      setSide(sheet.getCell(row, c), "bottom", "medium");
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  return buf;
}
