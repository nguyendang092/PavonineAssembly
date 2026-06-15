import { employeeRegimeWorkingHoursFlags } from "@/features/attendance/employeeRegime";
import { PAYROLL_EMP } from "@/features/payroll/payrollEmployeeFields";

/**
 * Tham số ngày cho tính TC / hệ số lương — một nguồn từ dòng NV + ngữ cảnh ngày.
 * Khóa trả về tiếng Anh (nội bộ); đọc từ bản ghi RTDB qua `PAYROLL_EMP`.
 * Logic tính giờ nằm trong `attendanceWorkingHours.js`.
 *
 * @param {object} emp — dòng điểm danh / payroll
 * @param {{ isOffDay?: boolean, isHolidayDay?: boolean, isCompensatoryDay?: boolean }} dayCtx
 */
export function payrollOtDayParamsFromEmp(emp, dayCtx) {
  const flags = employeeRegimeWorkingHoursFlags(emp);
  return {
    timeIn: emp[PAYROLL_EMP.TIME_IN],
    timeOut: emp[PAYROLL_EMP.TIME_OUT],
    isOffDay: dayCtx.isOffDay ?? false,
    isHolidayDay: dayCtx.isHolidayDay ?? false,
    isCompensatoryDay: dayCtx.isCompensatoryDay ?? false,
    shiftCode: emp[PAYROLL_EMP.SHIFT],
    leaveType: emp[PAYROLL_EMP.LEAVE_TYPE],
    payrollEarlyOtPaperwork: emp[PAYROLL_EMP.PAYROLL_EARLY_OT_PAPERWORK],
    payrollLateOtExcluded: emp[PAYROLL_EMP.PAYROLL_LATE_OT_EXCLUDED],
    lunchOtHours: emp[PAYROLL_EMP.LUNCH_OT_HOURS],
    ...flags,
  };
}

/**
 * Khi xuất Excel từ `baseEmployees` — gộp cờ TC từ `_meta` nếu row chưa có.
 */
export function payrollOtDayParamsFromEmpWithMaps(
  emp,
  dayCtx,
  { earlyOtPaperworkById = {}, lateOtExcludedById = {} } = {},
) {
  return payrollOtDayParamsFromEmp(
    {
      ...emp,
      payrollEarlyOtPaperwork:
        emp[PAYROLL_EMP.PAYROLL_EARLY_OT_PAPERWORK] ??
        earlyOtPaperworkById[emp.id],
      payrollLateOtExcluded:
        emp[PAYROLL_EMP.PAYROLL_LATE_OT_EXCLUDED] ??
        lateOtExcludedById[emp.id],
    },
    dayCtx,
  );
}

/**
 * Lưới tháng / tổng hợp tháng: dòng slim + cờ TC từ `_meta` trên chunk ngày.
 * @param {object} emp
 * @param {{
 *   isOffDay?: boolean,
 *   isHolidayDay?: boolean,
 *   isCompensatoryDay?: boolean,
 *   earlyOtPaperworkById?: Record<string, boolean>,
 *   lateOtExcludedById?: Record<string, boolean>,
 * } | null | undefined} monthDayChunk
 */
export function payrollOtDayParamsFromMonthChunkEmp(emp, monthDayChunk) {
  if (!monthDayChunk) return payrollOtDayParamsFromEmp(emp, {});
  return payrollOtDayParamsFromEmpWithMaps(emp, monthDayChunk, {
    earlyOtPaperworkById: monthDayChunk.earlyOtPaperworkById,
    lateOtExcludedById: monthDayChunk.lateOtExcludedById,
  });
}
