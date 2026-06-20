import * as XLSX from "@e965/xlsx";
import { annualLeaveFirebaseKeyForMnv } from "./annualLeaveEmpKey";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { computeAnnualLeaveTotals, parseAnnualLeaveNumber } from "./annualLeaveCalculated";

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
        let year = +dmyText[3];
        if (year < 100) year = year >= 70 ? 1900 + year : 2000 + year;
        return fmt(year, mon, day);
      }
    }
  }

  return "";
}

function findAnnualLeaveHeaderLayout(rows) {
  const scanMax = Math.min(rows.length, 8);
  for (let r = 0; r < scanMax; r++) {
    const row = rows[r] || [];
    const norms = row.map((c) => normalizeHeader(c));
    const fullNameIdx = norms.findIndex(
      (h) => h.includes("full name") || h === "ho va ten" || h.includes("họ tên"),
    );
    if (fullNameIdx < 0) continue;

    const col = {
      no: norms.findIndex((h) => h === "no" || h === "stt"),
      mnvPrefix: -1,
      mnvSuffix: -1,
      fullName: fullNameIdx,
      dateOfBirth: norms.findIndex(
        (h) => h.includes("date of birth") || h.includes("ngay sinh"),
      ),
      subDepartment: norms.findIndex(
        (h) =>
          h.includes("sub-department") ||
          h.includes("sub department") ||
          h.includes("bo phan"),
      ),
      startWorkingDate: norms.findIndex(
        (h) => h.includes("start working") || h.includes("ngay vao"),
      ),
      annualLeave: norms.findIndex(
        (h) =>
          h.includes("annual leave in current") ||
          (h.includes("annual leave") && h.includes("current")) ||
          h.includes("phep nam"),
      ),
      bonusEnv: norms.findIndex(
        (h) => h.includes("bonus") && h.includes("environment"),
      ),
      compensatory: norms.findIndex(
        (h) => h.includes("compensatory") || h.includes("nghi bu"),
      ),
      totalLeave: norms.findIndex((h) => h.includes("total annual leave")),
      used: norms.findIndex(
        (h) => h.includes("annual leave used") || h.includes("phep da dung"),
      ),
      balance: norms.findIndex((h) => h === "balance" || h.includes("ton phep")),
    };

    const emplIdx = norms.findIndex((h) => h.includes("empl") && h.includes("code"));
    if (emplIdx >= 0) {
      col.mnvPrefix = emplIdx;
      col.mnvSuffix = emplIdx + 1;
    } else {
      const codeIdx = norms.findIndex((h) => h.includes("code") || h === "mnv");
      if (codeIdx >= 0) {
        col.mnvPrefix = codeIdx;
        col.mnvSuffix = codeIdx + 1;
      }
    }

    return { headerRowIndex: r, col };
  }
  return null;
}

function rowIsEmpty(cells) {
  return !cells.some((c) => trimCell(c) !== "");
}

/**
 * Đọc file Excel phép năm — sheet đầu tiên, header như form HR.
 * @returns {Promise<{ records: object[], errors: string[] }>}
 */
export async function parseAnnualLeaveExcelFile(file) {
  const errors = [];
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) {
    return { records: [], errors: ["Không tìm thấy sheet trong file Excel."] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const layout = findAnnualLeaveHeaderLayout(rows);
  if (!layout) {
    return {
      records: [],
      errors: [
        "Không nhận diện được header (cần cột Full Name / ANNUAL LEAVE…).",
      ],
    };
  }

  const { headerRowIndex, col } = layout;
  const records = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    if (rowIsEmpty(row)) continue;

    const fullName = trimCell(row[col.fullName]);
    const mnvPrefix =
      col.mnvPrefix >= 0 ? trimCell(row[col.mnvPrefix]) : "";
    const mnvSuffix =
      col.mnvSuffix >= 0 ? trimCell(row[col.mnvSuffix]) : "";
    if (!fullName && !mnvPrefix) continue;

    const mnvCombined = `${mnvPrefix}${mnvSuffix}`.replace(/\s+/g, "");
    const firebaseKey = annualLeaveFirebaseKeyForMnv(mnvPrefix);
    if (!firebaseKey) {
      errors.push(
        `Dòng ${i + 1}: không tạo khóa emp_{mnv} (MNV: ${mnvPrefix || mnvCombined}).`,
      );
      continue;
    }

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
      [ANNUAL_LEAVE_EMP.START_WORKING_DATE]:
        col.startWorkingDate >= 0
          ? parseExcelDate(row[col.startWorkingDate], workbook)
          : "",
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]:
        col.annualLeave >= 0
          ? parseAnnualLeaveNumber(row[col.annualLeave])
          : 0,
      [ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV]:
        col.bonusEnv >= 0
          ? parseAnnualLeaveNumber(row[col.bonusEnv])
          : 0,
      [ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF]:
        col.compensatory >= 0
          ? parseAnnualLeaveNumber(row[col.compensatory])
          : 0,
    };

    const hrUsed =
      col.used >= 0 ? parseAnnualLeaveNumber(row[col.used]) : 0;
    base[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED] = hrUsed;
    base[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED] = 0;
    base[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED] = hrUsed;

    const totals = computeAnnualLeaveTotals(base);
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
