import {
  formatPayrollTableDayShiftOvertimeCell,
  formatPayrollTableHolidayDayWorkingCell,
  formatPayrollTableOffDayTcCell,
  formatPayrollTableTotalDayGcCell,
} from "@/features/attendance/attendanceWorkingHours";
import {
  payrollOtDayParamsFromEmp,
  payrollOtDayParamsFromEmpWithMaps,
} from "@/features/payroll/payrollOtDayParams";

function resolveOtDayParams(emp, dayCtx, maps) {
  return maps
    ? payrollOtDayParamsFromEmpWithMaps(emp, dayCtx, maps)
    : payrollOtDayParamsFromEmp(emp, dayCtx);
}

/** TC ca ngày ×1.5 — từ dòng NV + ngữ cảnh ngày. */
export function formatPayrollTableDayShiftOvertimeCellFromEmp(
  emp,
  dayCtx,
  maps,
) {
  const p = resolveOtDayParams(emp, dayCtx, maps);
  return formatPayrollTableDayShiftOvertimeCell(
    p.timeIn,
    p.timeOut,
    p.isOffDay,
    p.shiftCode,
    p.payrollEarlyOtPaperwork,
    p.isHolidayDay,
    p.payrollLateOtExcluded,
    p.includeTapVuInWorkingHours,
    p.includeThaiSanInWorkingHours,
    p.includeTaiXeInWorkingHours,
    p.includeTaiXeTongInWorkingHours,
    p.isCompensatoryDay,
    p.lunchOtHours,
  );
}

/** TC off (ca ngày) — GC + TC gộp. */
export function formatPayrollTableOffDayTcCellFromEmp(emp, dayCtx, maps) {
  const p = resolveOtDayParams(emp, dayCtx, maps);
  const strictOff = p.isOffDay || p.isCompensatoryDay;
  return formatPayrollTableOffDayTcCell(
    p.timeIn,
    p.timeOut,
    strictOff,
    p.shiftCode,
    p.payrollEarlyOtPaperwork,
    p.leaveType,
    p.payrollLateOtExcluded,
    p.includeTapVuInWorkingHours,
    p.includeThaiSanInWorkingHours,
    p.includeTaiXeInWorkingHours,
    p.includeTaiXeTongInWorkingHours,
  );
}

/** GC ngày lễ (ca ngày) — GC + TC gộp. */
export function formatPayrollTableHolidayDayWorkingCellFromEmp(
  emp,
  dayCtx,
  maps,
) {
  const p = resolveOtDayParams(emp, dayCtx, maps);
  return formatPayrollTableHolidayDayWorkingCell(
    p.timeIn,
    p.timeOut,
    p.isHolidayDay,
    p.shiftCode,
    p.payrollEarlyOtPaperwork,
    p.leaveType,
    p.payrollLateOtExcluded,
    p.includeTapVuInWorkingHours,
    p.includeThaiSanInWorkingHours,
    p.includeTaiXeInWorkingHours,
    p.includeTaiXeTongInWorkingHours,
  );
}

/** Tổng GC khối ngày. */
export function formatPayrollTableTotalDayGcCellFromEmp(emp, dayCtx, maps) {
  const p = resolveOtDayParams(emp, dayCtx, maps);
  const strictOff = p.isOffDay || p.isCompensatoryDay;
  return formatPayrollTableTotalDayGcCell(
    p.timeIn,
    p.timeOut,
    strictOff,
    p.isHolidayDay,
    p.shiftCode,
    p.payrollEarlyOtPaperwork,
    p.leaveType,
    p.payrollLateOtExcluded,
    p.includeTapVuInWorkingHours,
    p.includeThaiSanInWorkingHours,
    p.includeTaiXeInWorkingHours,
    p.includeTaiXeTongInWorkingHours,
    p.lunchOtHours,
  );
}
