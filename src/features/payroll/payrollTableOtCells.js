import {
  formatPayrollTableDayShiftOvertimeCell,
  formatPayrollTableHolidayDayWorkingCell,
  formatPayrollTableHolidayNightWorkingCell,
  formatPayrollTableNightShiftOffDayWorkingCell,
  formatPayrollTableNightShiftOvertimeCell,
  formatPayrollTableNightShiftWorkingCell,
  formatPayrollTableOffDayTcCell,
  formatPayrollTableTotalDayGcCell,
  formatPayrollTableTotalNightGcCell,
} from "@/features/attendance/attendanceWorkingHours";
import {
  payrollOtDayParamsFromEmp,
  payrollOtDayParamsFromEmpWithMaps,
  payrollDayOvertimeOptionsFromParams,
} from "@/features/payroll/payrollOtDayParams";

function resolveOtDayParams(emp, dayCtx, maps) {
  return maps
    ? payrollOtDayParamsFromEmpWithMaps(emp, dayCtx, maps)
    : payrollOtDayParamsFromEmp(emp, dayCtx);
}

function payrollOffLikeFromParams(p) {
  return p.isOffDay || p.isHolidayDay || p.isCompensatoryDay;
}

function strictOffFromParams(p) {
  return p.isOffDay || p.isCompensatoryDay;
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
    payrollDayOvertimeOptionsFromParams(p),
  );
}

/** TC off (ca ngày) — GC + TC gộp. */
export function formatPayrollTableOffDayTcCellFromEmp(emp, dayCtx, maps) {
  const p = resolveOtDayParams(emp, dayCtx, maps);
  return formatPayrollTableOffDayTcCell(
    p.timeIn,
    p.timeOut,
    strictOffFromParams(p),
    p.shiftCode,
    p.payrollEarlyOtPaperwork,
    p.leaveType,
    p.payrollLateOtExcluded,
    p.includeTapVuInWorkingHours,
    p.includeThaiSanInWorkingHours,
    p.includeTaiXeInWorkingHours,
    p.includeTaiXeTongInWorkingHours,
    p.lunchOtHours,
    payrollDayOvertimeOptionsFromParams(p),
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
    p.lunchOtHours,
  );
}

/** Tổng GC khối ngày. */
export function formatPayrollTableTotalDayGcCellFromEmp(emp, dayCtx, maps) {
  const p = resolveOtDayParams(emp, dayCtx, maps);
  return formatPayrollTableTotalDayGcCell(
    p.timeIn,
    p.timeOut,
    strictOffFromParams(p),
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
    payrollDayOvertimeOptionsFromParams(p),
  );
}

/** GC ca đêm (ngày thường). */
export function formatPayrollTableNightShiftWorkingCellFromEmp(
  emp,
  dayCtx,
  maps,
) {
  const p = resolveOtDayParams(emp, dayCtx, maps);
  return formatPayrollTableNightShiftWorkingCell(
    p.timeIn,
    p.timeOut,
    payrollOffLikeFromParams(p),
    p.shiftCode,
    p.leaveType,
    p.includeTapVuInWorkingHours,
    p.includeThaiSanInWorkingHours,
    p.includeTaiXeInWorkingHours,
    p.includeTaiXeTongInWorkingHours,
    p.payrollEarlyOtPaperwork,
  );
}

/** TC ca đêm (sau 05:00 + TC 18:40–19:40 khi có giấy). */
export function formatPayrollTableNightShiftOvertimeCellFromEmp(
  emp,
  dayCtx,
  maps,
) {
  const p = resolveOtDayParams(emp, dayCtx, maps);
  return formatPayrollTableNightShiftOvertimeCell(
    p.timeIn,
    p.timeOut,
    payrollOffLikeFromParams(p),
    p.shiftCode,
    p.leaveType,
    p.includeTapVuInWorkingHours,
    p.includeThaiSanInWorkingHours,
    p.includeTaiXeInWorkingHours,
    p.includeTaiXeTongInWorkingHours,
    p.payrollEarlyOtPaperwork,
  );
}

/** GC ca đêm ngày off — GC + TC gộp. */
export function formatPayrollTableNightShiftOffDayWorkingCellFromEmp(
  emp,
  dayCtx,
  maps,
) {
  const p = resolveOtDayParams(emp, dayCtx, maps);
  return formatPayrollTableNightShiftOffDayWorkingCell(
    p.timeIn,
    p.timeOut,
    strictOffFromParams(p),
    p.shiftCode,
    p.leaveType,
    p.includeTapVuInWorkingHours,
    p.includeThaiSanInWorkingHours,
    p.includeTaiXeInWorkingHours,
    p.includeTaiXeTongInWorkingHours,
    p.payrollEarlyOtPaperwork,
  );
}

/** GC ca đêm ngày lễ — GC + TC gộp. */
export function formatPayrollTableHolidayNightWorkingCellFromEmp(
  emp,
  dayCtx,
  maps,
) {
  const p = resolveOtDayParams(emp, dayCtx, maps);
  return formatPayrollTableHolidayNightWorkingCell(
    p.timeIn,
    p.timeOut,
    p.isHolidayDay,
    p.shiftCode,
    p.leaveType,
    p.includeTapVuInWorkingHours,
    p.includeThaiSanInWorkingHours,
    p.includeTaiXeInWorkingHours,
    p.includeTaiXeTongInWorkingHours,
    p.payrollEarlyOtPaperwork,
  );
}

/** Tổng GC khối ca đêm. */
export function formatPayrollTableTotalNightGcCellFromEmp(emp, dayCtx, maps) {
  const p = resolveOtDayParams(emp, dayCtx, maps);
  return formatPayrollTableTotalNightGcCell(
    p.timeIn,
    p.timeOut,
    payrollOffLikeFromParams(p),
    p.shiftCode,
    p.leaveType,
    p.includeTapVuInWorkingHours,
    p.includeThaiSanInWorkingHours,
    p.includeTaiXeInWorkingHours,
    p.includeTaiXeTongInWorkingHours,
    p.payrollEarlyOtPaperwork,
  );
}
