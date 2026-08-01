import {
  isNightOtPaperworkEligible,
} from "@/features/attendance/attendanceWorkingHours";
import { PAYROLL_EMP } from "@/features/payroll/payrollEmployeeFields";

/**
 * Cờ xác nhận TC đêm (`_meta.nightOtPaperwork`) — giờ vào 22:00–05:00, hệ số ×2.7.
 *
 * @param {object} emp — dòng điểm danh / payroll
 * @param {boolean | undefined} [metaFlag]
 * @returns {true | undefined}
 */
export function resolveEffectivePayrollNightOtPaperwork(emp, metaFlag) {
  const raw =
    metaFlag ?? emp?.[PAYROLL_EMP.PAYROLL_NIGHT_OT_PAPERWORK];
  if (raw !== true) return undefined;
  if (!isNightOtPaperworkEligible(emp?.[PAYROLL_EMP.TIME_IN])) {
    return undefined;
  }
  return true;
}

/**
 * Lọc map `_meta.nightOtPaperwork` — bỏ id không đủ điều kiện giờ vào / ca.
 * @param {Record<string, boolean> | null | undefined} map
 * @param {object[]} employees
 * @returns {Record<string, boolean>}
 */
export function sanitizeNightOtPaperworkById(map, employees) {
  if (!map || typeof map !== "object") return {};
  const byId = new Map((employees || []).map((e) => [e.id, e]));
  const out = {};
  for (const [id, val] of Object.entries(map)) {
    if (val !== true) continue;
    const emp = byId.get(id);
    if (!emp) continue;
    if (
      isNightOtPaperworkEligible(emp[PAYROLL_EMP.TIME_IN])
    ) {
      out[id] = true;
    }
  }
  return out;
}
