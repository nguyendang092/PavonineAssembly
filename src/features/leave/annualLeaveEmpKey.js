import {
  attendanceFirebaseKeyFromMnv,
  attendanceMnvStorageKey,
  isEmpFirebaseKey,
  resolveEmpFirebaseKeyFromEmployee,
  resolveEmpFirebaseKeyFromPayrollMonthRowId,
  resolvePayrollMonthRowIdFromEmpKey,
} from "@/utils/attendanceEmployeeRecord";
import { ANNUAL_LEAVE_EMP, ANNUAL_LEAVE_META_KEY } from "./annualLeaveFields";

function trimPart(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

/** Khóa chuẩn Firebase: `emp_{mnv}` — đồng bộ điểm danh / phép năm. */
export function annualLeaveEmpFirebaseKey(mnv) {
  return attendanceFirebaseKeyFromMnv(attendanceMnvStorageKey(mnv));
}

/** Alias — cùng `annualLeaveEmpFirebaseKey`. */
export function annualLeaveFirebaseKeyForMnv(mnv) {
  return annualLeaveEmpFirebaseKey(mnv);
}

/** MNV / khóa lưới giờ công từ khóa phép năm `emp_{mnv}`. */
export function resolvePayrollMonthRowIdFromAnnualLeaveEmpKey(empKey) {
  return resolvePayrollMonthRowIdFromEmpKey(empKey);
}

export {
  resolveEmpFirebaseKeyFromEmployee,
  resolveEmpFirebaseKeyFromPayrollMonthRowId,
};

/**
 * Khóa `emp_{mnv}` từ MNV, `mnvPrefix`, `recordId` hoặc bản ghi NV.
 */
export function resolveAnnualLeaveEmpFirebaseKey({ mnv, recordId, raw } = {}) {
  const fromEmployee = resolveEmpFirebaseKeyFromEmployee({
    mnv: mnv ?? raw?.[ANNUAL_LEAVE_EMP.MNV_PREFIX],
    id: recordId ?? raw?.id,
    businessId: raw?.[ANNUAL_LEAVE_EMP.MNV_SUFFIX],
  });
  if (fromEmployee) return fromEmployee;

  const mnvKey = attendanceMnvStorageKey(
    mnv ?? raw?.[ANNUAL_LEAVE_EMP.MNV_PREFIX],
  );
  if (mnvKey) {
    const fromMnv = annualLeaveEmpFirebaseKey(mnvKey);
    if (fromMnv) return fromMnv;
  }

  const id = trimPart(recordId ?? raw?.id);
  if (isEmpFirebaseKey(id)) return id;

  return "";
}

/**
 * Gom bản ghi năm theo `emp_{mnv}` — gộp key legacy trùng MNV.
 */
export function indexAnnualLeaveYearByEmpKey(yearData) {
  const byEmpKey = {};
  if (!yearData || typeof yearData !== "object") return byEmpKey;

  for (const [recordId, raw] of Object.entries(yearData)) {
    if (recordId === ANNUAL_LEAVE_META_KEY || !raw || typeof raw !== "object") {
      continue;
    }

    const empKey = resolveAnnualLeaveEmpFirebaseKey({ recordId, raw });
    if (!empKey) continue;

    const entry = { recordId, raw, empKey };
    const existing = byEmpKey[empKey];
    if (!existing) {
      byEmpKey[empKey] = entry;
      continue;
    }
    if (recordId === empKey) {
      byEmpKey[empKey] = entry;
    }
  }

  return byEmpKey;
}
