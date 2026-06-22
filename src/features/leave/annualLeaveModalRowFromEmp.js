import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  annualLeaveEmpFirebaseKey,
  indexAnnualLeaveYearByEmpKey,
} from "./annualLeaveEmpKey";

/** Hàng modal chi tiết từ bản ghi điểm danh / lương. */
export function buildAnnualLeaveDetailModalRowFromEmp(emp, yearData = null) {
  const empKey = annualLeaveEmpFirebaseKey(emp?.mnv);
  let raw = null;
  if (yearData && typeof yearData === "object" && empKey) {
    const indexed = indexAnnualLeaveYearByEmpKey(yearData);
    raw = indexed[empKey]?.raw ?? null;
  }

  const mnv = String(emp?.mnv ?? "").trim();
  const mvt = String(emp?.mvt ?? "").trim();

  return {
    id: empKey || emp?.id || mnv,
    [ANNUAL_LEAVE_EMP.MNV_PREFIX]:
      raw?.[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? mnv,
    [ANNUAL_LEAVE_EMP.MNV_SUFFIX]:
      raw?.[ANNUAL_LEAVE_EMP.MNV_SUFFIX] ?? mvt,
    [ANNUAL_LEAVE_EMP.FULL_NAME]:
      raw?.[ANNUAL_LEAVE_EMP.FULL_NAME] ?? emp?.hoVaTen ?? "",
    [ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]:
      raw?.[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] ?? emp?.boPhan ?? "",
  };
}

/** Hàng modal chi tiết từ bảng quản lý phép năm. */
export function buildAnnualLeaveDetailModalRowFromManagerRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: row.id,
    [ANNUAL_LEAVE_EMP.MNV_PREFIX]: row[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? "",
    [ANNUAL_LEAVE_EMP.MNV_SUFFIX]: row[ANNUAL_LEAVE_EMP.MNV_SUFFIX] ?? "",
    [ANNUAL_LEAVE_EMP.FULL_NAME]: row[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "",
    [ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]: row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] ?? "",
  };
}
