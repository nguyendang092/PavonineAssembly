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
    p.gioVao,
    p.gioRa,
    p.isOffDay,
    p.caLamViec,
    p.payrollEarlyOtPaperwork,
    p.isHolidayDay,
    p.payrollLateOtExcluded,
    p.includeTapVuInWorkingHours,
    p.includeThaiSanInWorkingHours,
    p.includeTaiXeInWorkingHours,
    p.includeTaiXeTongInWorkingHours,
    p.isCompensatoryDay,
    p.tangCaTrua,
  );
}

/** TC off (ca ngày) — GC + TC gộp. */
export function formatPayrollTableOffDayTcCellFromEmp(emp, dayCtx, maps) {
  const p = resolveOtDayParams(emp, dayCtx, maps);
  const strictOff = p.isOffDay || p.isCompensatoryDay;
  return formatPayrollTableOffDayTcCell(
    p.gioVao,
    p.gioRa,
    strictOff,
    p.caLamViec,
    p.payrollEarlyOtPaperwork,
    p.loaiPhep,
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
    p.gioVao,
    p.gioRa,
    p.isHolidayDay,
    p.caLamViec,
    p.payrollEarlyOtPaperwork,
    p.loaiPhep,
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
    p.gioVao,
    p.gioRa,
    strictOff,
    p.isHolidayDay,
    p.caLamViec,
    p.payrollEarlyOtPaperwork,
    p.loaiPhep,
    p.payrollLateOtExcluded,
    p.includeTapVuInWorkingHours,
    p.includeThaiSanInWorkingHours,
    p.includeTaiXeInWorkingHours,
    p.includeTaiXeTongInWorkingHours,
    p.tangCaTrua,
  );
}
