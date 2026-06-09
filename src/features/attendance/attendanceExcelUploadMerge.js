/**
 * Quy tắc merge upload Excel → Firebase (điểm danh):
 * **Một nguồn đúng cho mỗi trường:** chỉ hợp nhất **(1) bản ghi đã có** tại `attendance/{ngày}`
 * và **(2) dòng Excel** vừa parse — không trộn ngày khác vào bước merge này.
 *
 * - Trường trên Firebase **trống** và Excel **có** dữ liệu → điền từ Excel.
 * - Firebase **đã có** dữ liệu → **không** ghi đè bởi Excel (giữ chỉnh tay / lần upload trước cùng ngày).
 * - Sau merge: `normalizeAttendanceDayRecord` đồng bộ `gioVao` ↔ `loaiPhep` (giờ HH:MM xóa loại phép, trừ 1/2PN).
 */

import {
  attendanceFirebaseKeyFromMnv,
  attendanceMnvStorageKey,
} from "@/utils/attendanceEmployeeRecord";
import {
  isAttendanceGioVaoClockTime,
  isAttendanceHalfAnnualLeave,
  normalizeAttendanceDayRecord,
  reconcileAttendanceGioVaoLoaiPhep,
} from "./attendanceGioVaoTypeOptions";

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
function reconcileAttendanceGioVaoLoaiPhepAfterExcelMerge(emp, filledFromExcel) {
  const gioVao = String(emp.gioVao ?? "").trim();
  const loaiPhep = String(emp.loaiPhep ?? "").trim();
  const clockAdded =
    filledFromExcel.has("gioVao") && isAttendanceGioVaoClockTime(gioVao);
  const leaveAdded =
    filledFromExcel.has("loaiPhep") &&
    loaiPhep &&
    !isAttendanceHalfAnnualLeave(loaiPhep);

  if (clockAdded && loaiPhep && !isAttendanceHalfAnnualLeave(loaiPhep)) {
    return { ...emp, loaiPhep: "" };
  }
  if (leaveAdded && isAttendanceGioVaoClockTime(gioVao)) {
    return { ...emp, gioVao: "", gioRa: "" };
  }
  return reconcileAttendanceGioVaoLoaiPhep(emp);
}

export function mergeAttendanceExcelIntoExistingRecord(
  oldEmp,
  newEmp,
  options = {},
) {
  const seasonal = options.seasonal === true;
  const sttTargetField = seasonal ? "sttThoiVu" : "stt";
  const mergedEmp = { ...oldEmp };
  const filledFromExcel = new Set();

  Object.keys(newEmp).forEach((field) => {
    if (field === "id" || field === "mnv") return;
    if (field.startsWith("_excel")) return;

    if (field === "stt") {
      if (!newEmp._excelHasStt) return;
      if (!hasAttendanceExcelCellValue(mergedEmp[sttTargetField])) {
        mergedEmp[sttTargetField] = newEmp.stt;
        filledFromExcel.add("stt");
      }
      if (seasonal) delete mergedEmp.stt;
      return;
    }

    const nv = newEmp[field];
    if (
      !hasAttendanceExcelCellValue(mergedEmp[field]) &&
      hasAttendanceExcelCellValue(nv)
    ) {
      mergedEmp[field] = nv;
      filledFromExcel.add(field);
    }
  });

  const normalized = normalizeAttendanceDayRecord(mergedEmp, {
    reconcileGioVaoLoaiPhep: false,
  });
  return reconcileAttendanceGioVaoLoaiPhepAfterExcelMerge(
    normalized,
    filledFromExcel,
  );
}

/**
 * Gộp `dataToUpload` (đã parse Excel, key `emp_{mnv}`) vào snapshot ngày hiện có.
 * Trùng MNV → merge field; chuyển về `emp_{mnv}` và xóa key legacy nếu khác.
 *
 * @returns {{ mergedData: Record<string, object>; uploadedCount: number; duplicateCount: number }}
 */
export function mergeAttendanceExcelUploadIntoDaySnapshot(
  existingData,
  dataToUpload,
  options = {},
) {
  const seasonal = options.seasonal === true;
  let uploadedCount = 0;
  let duplicateCount = 0;
  const existingKeyByMNV = {};
  Object.entries(existingData || {}).forEach(([key, emp]) => {
    const normalizedMNV = attendanceMnvStorageKey(emp?.mnv);
    if (normalizedMNV && !existingKeyByMNV[normalizedMNV]) {
      existingKeyByMNV[normalizedMNV] = key;
    }
  });

  const mergedData = { ...(existingData || {}) };

  Object.entries(dataToUpload || {}).forEach(([, newEmp]) => {
    const normalizedNewMNV = attendanceMnvStorageKey(newEmp?.mnv);
    const canonicalKey = attendanceFirebaseKeyFromMnv(normalizedNewMNV);
    if (!canonicalKey) return;

    const existingKey = existingKeyByMNV[normalizedNewMNV];
    if (existingKey) {
      const oldEmp = mergedData[existingKey] || {};
      const mergedEmp = mergeAttendanceExcelIntoExistingRecord(
        oldEmp,
        newEmp,
        { seasonal },
      );
      mergedEmp.id = canonicalKey;
      mergedData[canonicalKey] = mergedEmp;
      if (existingKey !== canonicalKey) {
        delete mergedData[existingKey];
      }
      existingKeyByMNV[normalizedNewMNV] = canonicalKey;
      duplicateCount++;
    } else {
      let rec = normalizeAttendanceDayRecord(
        stripAttendanceExcelUploadInternalFields({ ...newEmp }),
      );
      if (seasonal && hasAttendanceExcelCellValue(rec.stt)) {
        rec.sttThoiVu = rec.stt;
        delete rec.stt;
      }
      if (!hasAttendanceExcelCellValue(rec.gioiTinh)) rec.gioiTinh = "YES";
      rec.id = canonicalKey;
      mergedData[canonicalKey] = rec;
      existingKeyByMNV[normalizedNewMNV] = canonicalKey;
      uploadedCount++;
    }
  });

  if (seasonal) {
    for (const [key, rec] of Object.entries(mergedData)) {
      if (!rec || typeof rec !== "object") continue;
      if (
        !hasAttendanceExcelCellValue(rec.sttThoiVu) &&
        hasAttendanceExcelCellValue(rec.stt)
      ) {
        rec.sttThoiVu = rec.stt;
      }
      delete rec.stt;
    }
  }

  return { mergedData, uploadedCount, duplicateCount };
}
