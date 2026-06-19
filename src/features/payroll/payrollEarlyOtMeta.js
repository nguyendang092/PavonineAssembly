import {
  effectivePayrollEarlyOtPaperwork,
  isEarlyArrivalForPaperworkOvertime,
} from "@/features/attendance/attendanceWorkingHours";
import { PAYROLL_EMP } from "@/features/payroll/payrollEmployeeFields";

/**
 * Cờ giấy TC sớm (`_meta.earlyOtPaperwork`) — khung mốc: {@link payrollEarlyOvertimeWindows.js}.
 *
 * @param {object} emp — dòng điểm danh / payroll
 * @param {boolean | undefined} [metaFlag] — giá trị từ `_meta` hoặc đã merge trên dòng
 * @returns {true | undefined}
 */
export function resolveEffectivePayrollEarlyOtPaperwork(emp, metaFlag) {
  const raw =
    metaFlag ?? emp?.[PAYROLL_EMP.PAYROLL_EARLY_OT_PAPERWORK];
  return effectivePayrollEarlyOtPaperwork(
    emp?.[PAYROLL_EMP.TIME_IN],
    emp?.[PAYROLL_EMP.SHIFT],
    raw,
  );
}

/**
 * Lọc map `_meta.earlyOtPaperwork` — bỏ id không đủ điều kiện giờ vào / ca.
 * @param {Record<string, boolean> | null | undefined} map
 * @param {object[]} employees
 * @returns {Record<string, boolean>}
 */
export function sanitizeEarlyOtPaperworkById(map, employees) {
  if (!map || typeof map !== "object") return {};
  const byId = new Map((employees || []).map((e) => [e.id, e]));
  const out = {};
  for (const [id, val] of Object.entries(map)) {
    if (val !== true) continue;
    const emp = byId.get(id);
    if (!emp) continue;
    if (
      isEarlyArrivalForPaperworkOvertime(
        emp[PAYROLL_EMP.TIME_IN],
        emp[PAYROLL_EMP.SHIFT],
      )
    ) {
      out[id] = true;
    }
  }
  return out;
}
