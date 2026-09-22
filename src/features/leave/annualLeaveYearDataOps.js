import {
  ANNUAL_LEAVE_EMP,
  ANNUAL_LEAVE_META_KEY,
  ANNUAL_LEAVE_RTDB_ROOT,
} from "./annualLeaveFields";
import { indexAnnualLeaveYearByEmpKey } from "./annualLeaveEmpKey";
import { parseAnnualLeaveNumber } from "./annualLeaveCalculated";

/** Trường điểm danh / HR đã tính — không ghi đè khi upload Excel. */
export const ANNUAL_LEAVE_UPLOAD_PRESERVE_KEYS = Object.freeze([
  ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT,
  ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED,
  ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED,
  ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED,
  ANNUAL_LEAVE_EMP.BALANCE,
  ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE,
  ANNUAL_LEAVE_EMP.MONTHLY_LEAVE_USAGE,
]);

const PRESERVE_KEY_SET = new Set(ANNUAL_LEAVE_UPLOAD_PRESERVE_KEYS);

function isPresentUploadValue(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function shouldKeepExistingNumber(existingValue, incomingValue) {
  const incoming = parseAnnualLeaveNumber(incomingValue);
  const existing = parseAnnualLeaveNumber(existingValue);
  return incoming === 0 && existing !== 0;
}

function stripDerivedUsageFromNewEmployee(incoming) {
  const next = { ...incoming };
  delete next[ANNUAL_LEAVE_EMP.MONTHLY_LEAVE_USAGE];
  delete next[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED];
  delete next[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED];
  delete next[ANNUAL_LEAVE_EMP.BALANCE];
  delete next[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE];
  if (parseAnnualLeaveNumber(next[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]) === 0) {
    delete next[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED];
  }
  return next;
}

/** Gộp 1 NV: NV mới thì thêm; NV cũ giữ phép đã dùng / điều chỉnh / tháng. */
export function mergeAnnualLeaveUploadEmployee(existing, incoming) {
  const record = incoming && typeof incoming === "object" ? incoming : {};
  if (!existing || typeof existing !== "object") {
    return stripDerivedUsageFromNewEmployee(record);
  }

  const next = { ...existing };
  for (const [key, value] of Object.entries(record)) {
    if (key === "id" || key === "rowNo") continue;
    if (PRESERVE_KEY_SET.has(key)) continue;
    if (!isPresentUploadValue(value)) continue;
    if (
      (key === ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR ||
        key === ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV ||
        key === ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF) &&
      shouldKeepExistingNumber(existing[key], value)
    ) {
      continue;
    }
    next[key] = value;
  }

  next.id = record.id ?? existing.id;
  if (isPresentUploadValue(record.rowNo)) next.rowNo = record.rowNo;
  return next;
}

/**
 * Gộp upload Excel vào `annualLeave/{year}` — chỉ cập nhật NV có trong file, giữ NV khác
 * và không xóa số liệu phép đã có.
 * @returns {{ updates: Record<string, object>, mergedCount: number, importedCount: number, newEmpKeys: string[] }}
 */
export function buildAnnualLeaveMergeUploadUpdates({
  year,
  records,
  existingYearData = null,
  updatedBy = "",
}) {
  const basePath = `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`;
  const updates = {};
  const indexed = indexAnnualLeaveYearByEmpKey(existingYearData ?? {});
  const empKeys = new Set(Object.keys(indexed));
  const newEmpKeys = [];

  for (const rec of records) {
    const { id, rowNo, ...rest } = rec;
    if (!id) continue;
    const existing = indexed[id]?.raw ?? existingYearData?.[id] ?? null;
    const isNew = !existing;
    if (isNew) newEmpKeys.push(id);
    empKeys.add(id);
    updates[`${basePath}/${id}`] = mergeAnnualLeaveUploadEmployee(existing, {
      ...rest,
      rowNo,
      id,
    });
  }

  updates[`${basePath}/${ANNUAL_LEAVE_META_KEY}`] = {
    ...(existingYearData?.[ANNUAL_LEAVE_META_KEY] &&
    typeof existingYearData[ANNUAL_LEAVE_META_KEY] === "object"
      ? existingYearData[ANNUAL_LEAVE_META_KEY]
      : {}),
    updatedAt: new Date().toISOString(),
    updatedBy,
    rowCount: empKeys.size,
  };

  return {
    updates,
    mergedCount: empKeys.size,
    importedCount: records.length,
    newEmpKeys,
  };
}

export function annualLeaveYearRefPath(year) {
  return `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`;
}
