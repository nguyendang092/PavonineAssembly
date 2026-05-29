import * as XLSX from "@e965/xlsx";
import { ref, set } from "@/services/firebase";
import {
  DEFAULT_DEPARTMENT,
  DEFAULT_ERROR_TYPE,
  MC_DEFECT_REPORT_PATH,
} from "./constants";
import {
  makeCompositeKey,
  makeReadableRecordKey,
  normalizeText,
} from "./dataAggregations";

function normalizeImportedDate(value) {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    const yyyy = parsed.y;
    const mm = String(parsed.m).padStart(2, "0");
    const dd = String(parsed.d).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(raw)) return raw.replaceAll("/", "-");
  return "";
}

function findValueByAlias(record, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(record, alias))
      return record[alias];
  }
  return "";
}

export function parseMcDefectExcelRows(records) {
  return records
    .map((record) => {
      const date = normalizeImportedDate(
        findValueByAlias(record, ["Date", "Ngày", "date", "ngày"]),
      );
      const employee = normalizeText(
        findValueByAlias(record, [
          "Employee",
          "Nhân viên",
          "employee",
          "nhân viên",
        ]),
      );
      const department = normalizeText(
        findValueByAlias(record, [
          "Department",
          "Bộ phận",
          "department",
          "bộ phận",
        ]) || DEFAULT_DEPARTMENT,
      );
      const errorType = normalizeText(
        findValueByAlias(record, [
          "Error Type",
          "Loại lỗi",
          "errorType",
          "loại lỗi",
        ]) || DEFAULT_ERROR_TYPE,
      );
      const errorCountRaw = findValueByAlias(record, [
        "Error Count",
        "Số lỗi",
        "errorCount",
        "số lỗi",
      ]);
      const note = normalizeText(
        findValueByAlias(record, ["Note", "Ghi chú", "note", "ghi chú"]) || "",
      );
      const errorCount = Number(errorCountRaw || 0);
      if (!date || !employee || !Number.isFinite(errorCount) || errorCount < 0) {
        return null;
      }
      return { date, employee, department, errorType, errorCount, note };
    })
    .filter(Boolean);
}

export async function importMcDefectExcelFile(file, existingRows, tl) {
  const text = (key, defaultValue, opts) =>
    typeof tl === "function" ? tl(key, defaultValue, opts) : defaultValue;
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new Error(text("excelNoSheet", "Không có sheet dữ liệu"));
  const sheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!records.length)
    throw new Error(text("excelNoData", "File Excel không có dữ liệu"));

  const parsedRows = parseMcDefectExcelRows(records);
  if (!parsedRows.length) {
    throw new Error(
      text(
        "excelNoValidRows",
        "Không có dòng hợp lệ. Cần tối thiểu: Date, Employee, Error Count.",
      ),
    );
  }

  const parsedMap = new Map();
  parsedRows.forEach((row) => {
    parsedMap.set(makeCompositeKey(row), row);
  });
  const dedupedRows = [...parsedMap.values()];

  const existingByKey = new Map(
    existingRows.map((row) => [makeCompositeKey(row), row]),
  );
  await Promise.all(
    dedupedRows.map((row) => {
      const key = makeCompositeKey(row);
      const existingRow = existingByKey.get(key);
      const recordKey =
        existingRow?.recordKey ||
        makeReadableRecordKey({
          employee: row.employee,
          department: row.department,
          errorType: row.errorType,
        });
      const targetRef = ref(
        db,
        `${MC_DEFECT_REPORT_PATH}/${row.date}/${recordKey}`,
      );
      return set(targetRef, { ...row, updatedAt: Date.now() });
    }),
  );
  return dedupedRows.length;
}

export function downloadMcDefectExcelTemplate(tl) {
  const text = (key, defaultValue, opts) =>
    typeof tl === "function" ? tl(key, defaultValue, opts) : defaultValue;
  const headers = [
    text("date", "Date"),
    text("employee", "Employee"),
    text("department", "Department"),
    text("errorType", "Error Type"),
    text("errorCount", "Error Count"),
    text("note", "Note"),
  ];
  const sampleRows = [
    [
      "2026-05-07",
      "NGUYEN VAN A",
      text("sampleDepartment", "Lắp ráp"),
      "Visual",
      2,
      text("sampleNote", "Lỗi ngoại quan"),
    ],
    ["2026-05-07", "TRAN THI B", "QC", "Dimension", 1, ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "MC_Defect_Template");
  XLSX.writeFile(wb, "MC_Defect_Template.xlsx");
}
