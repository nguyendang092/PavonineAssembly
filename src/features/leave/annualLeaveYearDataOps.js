import {
  ANNUAL_LEAVE_META_KEY,
  ANNUAL_LEAVE_RTDB_ROOT,
} from "./annualLeaveFields";
import { indexAnnualLeaveYearByEmpKey } from "./annualLeaveEmpKey";

export function countAnnualLeaveEmployeesInYearData(yearData) {
  if (!yearData || typeof yearData !== "object") return 0;
  return Object.keys(indexAnnualLeaveYearByEmpKey(yearData)).length;
}

/**
 * Gộp upload Excel vào `annualLeave/{year}` — chỉ cập nhật NV có trong file, giữ NV khác.
 * @returns {{ updates: Record<string, object>, mergedCount: number, importedCount: number }}
 */
export function buildAnnualLeaveMergeUploadUpdates({
  year,
  records,
  existingYearData = null,
  updatedBy = "",
}) {
  const basePath = `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`;
  const updates = {};
  const empKeys = new Set(
    Object.keys(indexAnnualLeaveYearByEmpKey(existingYearData ?? {})),
  );

  for (const rec of records) {
    const { id, rowNo, ...rest } = rec;
    if (!id) continue;
    empKeys.add(id);
    updates[`${basePath}/${id}`] = { ...rest, rowNo, id };
  }

  updates[`${basePath}/${ANNUAL_LEAVE_META_KEY}`] = {
    updatedAt: new Date().toISOString(),
    updatedBy,
    rowCount: empKeys.size,
  };

  return {
    updates,
    mergedCount: empKeys.size,
    importedCount: records.length,
  };
}

export function annualLeaveYearRefPath(year) {
  return `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`;
}
