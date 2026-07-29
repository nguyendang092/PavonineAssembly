import * as XLSX from "@e965/xlsx";
import { annualLeaveFirebaseKeyForMnv } from "./annualLeaveEmpKey";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  computeAnnualLeaveTotals,
  parseAnnualLeaveNumber,
  resolveAnnualLeaveCurrentYear,
} from "./annualLeaveCalculated";
import { sumAnnualLeaveMonthlyUsageValues } from "./annualLeaveDerived";
import {
  ANNUAL_LEAVE_EXCEL_COL,
  isAnnualLeaveExcelMonthHeader,
} from "./annualLeaveExcelTemplate";

function trimCell(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizeHeader(value) {
  return trimCell(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function parseExcelDate(value, workbook) {
  if (value == null || value === "") return "";

  const fmt = (y, m, d) =>
    y && m && d
      ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      : "";

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value, {
      date1904: workbook?.Workbook?.WBProps?.date1904 || false,
    });
    if (parsed?.y && parsed?.m && parsed?.d) {
      return fmt(parsed.y, parsed.m, parsed.d);
    }
  }

  if (value instanceof Date && !Number.isNaN(value)) {
    return fmt(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
    );
  }

  if (typeof value === "string") {
    const str = value.trim();
    if (!str) return "";

    const iso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (iso) return fmt(+iso[1], +iso[2], +iso[3]);

    const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) return fmt(+dmy[3], +dmy[2], +dmy[1]);

    const monthNames = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };
    const dmyText = str.match(/^(\d{1,2})[-\s]?([a-zA-Z]{3})[-\s]?(\d{2,4})$/i);
    if (dmyText) {
      const day = +dmyText[1];
      const mon = monthNames[dmyText[2].toLowerCase()];
      if (mon) {
        let yr = +dmyText[3];
        if (yr < 100) yr = yr >= 70 ? 1900 + yr : 2000 + yr;
        return fmt(yr, mon, day);
      }
    }
  }

  return "";
}

function resolveEmplCodeColumns(norms) {
  const emplIdx = norms.findIndex((h) => h.includes("empl") && h.includes("code"));
  if (emplIdx >= 0) {
    return { mnvPrefix: emplIdx, mnvSuffix: emplIdx + 1 };
  }
  const mnvIdx = norms.findIndex((h) => h === "mnv");
  const mvtIdx = norms.findIndex((h) => h === "mvt");
  if (mnvIdx >= 0) {
    return { mnvPrefix: mnvIdx, mnvSuffix: mvtIdx >= 0 ? mvtIdx : mnvIdx + 1 };
  }
  const codeIdx = norms.findIndex((h) => h.includes("code"));
  if (codeIdx >= 0) {
    return { mnvPrefix: codeIdx, mnvSuffix: codeIdx + 1 };
  }
  return { mnvPrefix: -1, mnvSuffix: -1 };
}

function findColumnByNorms(norms, matchers) {
  for (const match of matchers) {
    const idx = norms.findIndex(match);
    if (idx >= 0) return idx;
  }
  return -1;
}

function isLegacyBonusHeader(norm) {
  return norm.includes("bonus") && norm.includes("environment");
}

function isLegacyCompensatoryHeader(norm) {
  return norm.includes("compensatory") || norm.includes("nghi bu");
}

function findMonthColumnIndices(headerNorms, year) {
  if (!year) return [];

  const indices = [];
  headerNorms.forEach((norm, idx) => {
    if (isAnnualLeaveExcelMonthHeader(norm, year)) indices.push(idx);
  });
  if (indices.length === 12) return indices;

  const balanceIdx = headerNorms.findIndex(
    (h) => h === "balance" || h.includes("ton phep"),
  );
  if (balanceIdx >= 0) {
    return Array.from(
      { length: 12 },
      (_, i) => balanceIdx + 1 + i,
    );
  }

  return indices;
}

function parseAnnualLeaveExcelMonthCell(value) {
  const text = trimCell(value);
  if (!text || text === "-") return 0;
  return parseAnnualLeaveNumber(value);
}

export function readMonthlyLeaveUsageFromRow(row, monthIndices) {
  if (!Array.isArray(monthIndices) || monthIndices.length !== 12) return null;
  return monthIndices.map((idx) => parseAnnualLeaveExcelMonthCell(row[idx]));
}

function parseOptionalAnnualLeaveNumber(row, colIndex) {
  if (colIndex < 0) return null;
  const text = trimCell(row[colIndex]);
  if (!text || text === "-") return null;
  return parseAnnualLeaveNumber(row[colIndex]);
}

function findAnnualLeaveHeaderLayout(rows, year = null) {
  const scanMax = Math.min(rows.length, 10);
  for (let r = 0; r < scanMax; r++) {
    const row = rows[r] || [];
    const norms = row.map((c) => normalizeHeader(c));
    const fullNameIdx = findColumnByNorms(norms, [
      (h) => h.includes("full name"),
      (h) => h === "ho va ten",
      (h) => h.includes("ho ten"),
    ]);
    if (fullNameIdx < 0) continue;

    const codeCols = resolveEmplCodeColumns(norms);
    let dataStartRow = r + 1;
    const subRow = rows[r + 1] || [];
    const subNorms = subRow.map((c) => normalizeHeader(c));
    if (subNorms.includes("mnv") && subNorms.includes("mvt")) {
      dataStartRow = r + 2;
      if (codeCols.mnvPrefix < 0) {
        codeCols.mnvPrefix = subNorms.indexOf("mnv");
        codeCols.mnvSuffix = subNorms.indexOf("mvt");
      }
    }

    const col = {
      no: findColumnByNorms(norms, [(h) => h === "no", (h) => h === "stt"]),
      ...codeCols,
      fullName: fullNameIdx,
      dateOfBirth: findColumnByNorms(norms, [
        (h) => h.includes("date of birth"),
        (h) => h.includes("ngay sinh"),
      ]),
      subDepartment: findColumnByNorms(norms, [
        (h) => h.includes("sub-department"),
        (h) => h.includes("sub department"),
        (h) => h.includes("bo phan"),
      ]),
      startWorkingDate: findColumnByNorms(norms, [
        (h) => h.includes("start working"),
        (h) => h.includes("ngay vao"),
      ]),
      annualLeave: findColumnByNorms(norms, [
        (h) => h.includes("annual leave in current"),
        (h) => h.includes("annual leave in current year"),
        (h) =>
          h.includes("annual leave") &&
          h.includes("current") &&
          !h.includes("used"),
        (h) => h.includes("phep nam"),
      ]),
      used: findColumnByNorms(norms, [
        (h) => h.includes("annual leave used"),
        (h) => h.includes("phep da dung"),
      ]),
      balance: findColumnByNorms(norms, [
        (h) => h === "balance",
        (h) => h.includes("ton phep"),
      ]),
      monthIndices: findMonthColumnIndices(norms, year),
    };

    return { headerRowIndex: r, dataStartRow, col, year };
  }
  return null;
}

function rowIsEmpty(cells) {
  return !cells.some((c) => trimCell(c) !== "");
}

/** Phép gốc từ Excel — thâm niên được cộng khi hiển thị. */
export function resolveImportedAnnualLeaveBase(importedValue) {
  return parseAnnualLeaveNumber(importedValue);
}

/**
 * Đọc file Excel phép năm — template mới (2 hàng header, 12 cột tháng read-only).
 * @param {File} file
 * @param {{ year?: number|null }} [options]
 * @returns {Promise<{ records: object[], errors: string[] }>}
 */
export async function parseAnnualLeaveExcelFile(file, options = {}) {
  const { year = null } = options;
  const errors = [];
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) {
    return { records: [], errors: ["Không tìm thấy sheet trong file Excel."] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const layout = findAnnualLeaveHeaderLayout(rows, year);
  if (!layout) {
    return {
      records: [],
      errors: [
        "Không nhận diện được header template mới (cần cột Full Name, ANNUAL LEAVE IN CURRENT YEAR…).",
      ],
    };
  }

  const { dataStartRow, col } = layout;
  const records = [];

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i] || [];
    if (rowIsEmpty(row)) continue;

    const headerNorms = (rows[layout.headerRowIndex] || []).map((c) =>
      normalizeHeader(c),
    );
    const hasLegacyBonus = headerNorms.some(isLegacyBonusHeader);
    const hasLegacyComp = headerNorms.some(isLegacyCompensatoryHeader);

    const fullName = trimCell(row[col.fullName]);
    const mnvPrefix = col.mnvPrefix >= 0 ? trimCell(row[col.mnvPrefix]) : "";
    const mnvSuffix = col.mnvSuffix >= 0 ? trimCell(row[col.mnvSuffix]) : "";
    if (!fullName && !mnvPrefix) continue;

    const mnvCombined = `${mnvPrefix}${mnvSuffix}`.replace(/\s+/g, "");
    const firebaseKey = annualLeaveFirebaseKeyForMnv(mnvPrefix);
    if (!firebaseKey) {
      errors.push(
        `Dòng ${i + 1}: không tạo khóa emp_{mnv} (MNV: ${mnvPrefix || mnvCombined}).`,
      );
      continue;
    }

    const startWorkingDate =
      col.startWorkingDate >= 0
        ? parseExcelDate(row[col.startWorkingDate], workbook)
        : "";

    const monthValues = readMonthlyLeaveUsageFromRow(row, col.monthIndices);
    const monthlyUsed = sumAnnualLeaveMonthlyUsageValues(monthValues);

    const importedAnnual = parseOptionalAnnualLeaveNumber(row, col.annualLeave);
    const importedUsed = parseOptionalAnnualLeaveNumber(row, col.used);

    const attendanceUsed =
      monthlyUsed != null ? monthlyUsed : (importedUsed ?? 0);

    const base = {
      id: firebaseKey,
      [ANNUAL_LEAVE_EMP.MNV_PREFIX]: mnvPrefix,
      [ANNUAL_LEAVE_EMP.MNV_SUFFIX]: mnvSuffix,
      [ANNUAL_LEAVE_EMP.FULL_NAME]: fullName,
      [ANNUAL_LEAVE_EMP.DATE_OF_BIRTH]:
        col.dateOfBirth >= 0
          ? parseExcelDate(row[col.dateOfBirth], workbook)
          : "",
      [ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]:
        col.subDepartment >= 0 ? trimCell(row[col.subDepartment]) : "",
      [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: startWorkingDate,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 0,
      [ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV]: 0,
      [ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF]: 0,
    };

    if (monthValues) {
      base[ANNUAL_LEAVE_EMP.MONTHLY_LEAVE_USAGE] = monthValues;
    }

    if (year != null && startWorkingDate) {
      base[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR] =
        resolveAnnualLeaveCurrentYear(base, year);
    } else {
      base[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR] = importedAnnual ?? 0;
    }

    if (hasLegacyBonus) {
      const bonusIdx = headerNorms.findIndex(isLegacyBonusHeader);
      if (bonusIdx >= 0) {
        base[ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV] = parseAnnualLeaveNumber(
          row[bonusIdx],
        );
      }
    }
    if (hasLegacyComp) {
      const compIdx = headerNorms.findIndex(isLegacyCompensatoryHeader);
      if (compIdx >= 0) {
        base[ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF] = parseAnnualLeaveNumber(
          row[compIdx],
        );
      }
    }

    base[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED] = 0;
    base[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED] = attendanceUsed;
    base[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED] = attendanceUsed;

    const totals = computeAnnualLeaveTotals(base, year);
    records.push({
      ...base,
      ...totals,
      rowNo: col.no >= 0 ? trimCell(row[col.no]) : String(records.length + 1),
    });
  }

  if (records.length === 0) {
    errors.push("Không có dòng nhân viên hợp lệ trong file.");
  }

  return { records, errors };
}

export {
  findAnnualLeaveHeaderLayout,
  normalizeHeader,
  isAnnualLeaveExcelMonthHeader,
  findMonthColumnIndices,
  ANNUAL_LEAVE_EXCEL_COL,
};
