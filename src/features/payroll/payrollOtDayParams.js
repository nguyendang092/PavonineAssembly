import { employeeRegimeWorkingHoursFlags } from "@/features/attendance/employeeRegime";

/**
 * Tham số ngày cho tính TC / hệ số lương — một nguồn từ dòng NV + ngữ cảnh ngày.
 * Chỉ gom dữ liệu (không thay đổi công thức); logic tính giờ nằm trong `attendanceWorkingHours.js`.
 * Dùng cho bảng giờ công ngày, bảng tháng, xuất Excel.
 *
 * @param {object} emp — dòng điểm danh / payroll (có `payrollEarlyOtPaperwork`, `tangCaTrua`…)
 * @param {{ isOffDay?: boolean, isHolidayDay?: boolean, isCompensatoryDay?: boolean }} dayCtx
 */
export function payrollOtDayParamsFromEmp(emp, dayCtx) {
  const flags = employeeRegimeWorkingHoursFlags(emp);
  return {
    gioVao: emp.gioVao,
    gioRa: emp.gioRa,
    isOffDay: dayCtx.isOffDay ?? false,
    isHolidayDay: dayCtx.isHolidayDay ?? false,
    isCompensatoryDay: dayCtx.isCompensatoryDay ?? false,
    caLamViec: emp.caLamViec,
    loaiPhep: emp.loaiPhep,
    payrollEarlyOtPaperwork: emp.payrollEarlyOtPaperwork,
    payrollLateOtExcluded: emp.payrollLateOtExcluded,
    tangCaTrua: emp.tangCaTrua,
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
        emp.payrollEarlyOtPaperwork ?? earlyOtPaperworkById[emp.id],
      payrollLateOtExcluded:
        emp.payrollLateOtExcluded ?? lateOtExcludedById[emp.id],
    },
    dayCtx,
  );
}
