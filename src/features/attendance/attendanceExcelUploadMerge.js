/**
 * Quy tắc merge upload Excel → Firebase (điểm danh):
 * - Ô / trường trên Firebase **trống** và Excel **có** dữ liệu → điền từ Excel.
 * - Firebase **đã có** dữ liệu → **không** ghi đè bởi Excel.
 */

/**
 * Giá trị ô được coi là đã có dữ liệu (sau trim; số hợp lệ tính là có).
 */
export function hasAttendanceExcelCellValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return String(value).trim() !== "";
}

/** Bỏ trường nội bộ phục vụ merge (không lưu Firebase). */
export function stripAttendanceExcelUploadInternalFields(record) {
  if (!record || typeof record !== "object") return record;
  const o = { ...record };
  Object.keys(o).forEach((k) => {
    if (k.startsWith("_excel")) delete o[k];
  });
  return o;
}

/**
 * Merge một dòng Excel vào bản ghi đã có (cùng MNV).
 * `newEmp` có thể chứa `_excelHasStt`: chỉ ghi STT khi Excel có STT hợp lệ và STT trên Firebase trống.
 */
export function mergeAttendanceExcelIntoExistingRecord(oldEmp, newEmp) {
  const mergedEmp = { ...oldEmp };

  Object.keys(newEmp).forEach((field) => {
    if (field === "id" || field === "mnv") return;
    if (field.startsWith("_excel")) return;

    if (field === "stt") {
      if (
        !hasAttendanceExcelCellValue(mergedEmp.stt) &&
        newEmp._excelHasStt
      ) {
        mergedEmp.stt = newEmp.stt;
      }
      return;
    }

    const nv = newEmp[field];
    if (
      !hasAttendanceExcelCellValue(mergedEmp[field]) &&
      hasAttendanceExcelCellValue(nv)
    ) {
      mergedEmp[field] = nv;
    }
  });

  return mergedEmp;
}
