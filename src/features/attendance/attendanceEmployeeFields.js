import { PAYROLL_EMP } from "@/features/payroll/payrollEmployeeFields";

/**
 * Khóa trường RTDB / form điểm danh — giữ nguyên giá trị lưu trữ (tiếng Việt).
 * Mở rộng `PAYROLL_EMP` với trường chỉ dùng trên màn điểm danh.
 */
export const ATTENDANCE_EMP = {
  ...PAYROLL_EMP,
  SEASONAL_STT: "sttThoiVu",
  DEPT_WRONG_FLAG: "boPhanChuaDung",
  /** `"YES"` — tô nền vàng nhạt cột họ tên trên bảng. */
  NAME_YELLOW_BG: "hoVaTenNenVang",
  BUSINESS_ID: "businessId",
  CHAM_CONG: "chamCong",
  PHEP_NAM: "phepNam",
};

/** Đánh dấu PN/1/2PN đã đồng bộ sang `annualLeave/{year}`. */
export const ATTENDANCE_ANNUAL_LEAVE_SYNCED_DEDUCTION =
  "_annualLeaveSyncedDeduction";

/** `annualLeaveUsed` trên Firebase sau lần đồng bộ thành công — tránh marker lỗi. */
export const ATTENDANCE_ANNUAL_LEAVE_SYNCED_USED = "_annualLeaveSyncedUsed";

/**
 * Tham số ngày chuẩn cho điểm danh / giờ công — đồng bộ payroll (`PayrollOtDayParams` không gồm cờ OT).
 *
 * @typedef {{
 *   timeIn: unknown,
 *   timeOut: unknown,
 *   shiftCode: unknown,
 *   leaveType: unknown,
 *   lunchOtHours?: unknown,
 *   compLeaveAllowed?: unknown,
 *   deptWrongFlag?: unknown,
 * }} AttendanceDayFields
 */

/** Giờ vào/ra + ca + phép từ một dòng điểm danh (không gộp ngữ cảnh ngày). */
export function pickAttendanceEmployeeDayFields(record) {
  if (!record) {
    return {
      timeIn: undefined,
      timeOut: undefined,
      shiftCode: undefined,
      leaveType: undefined,
      lunchOtHours: undefined,
      compLeaveAllowed: undefined,
      deptWrongFlag: undefined,
    };
  }
  return {
    timeIn: record[ATTENDANCE_EMP.TIME_IN],
    timeOut: record[ATTENDANCE_EMP.TIME_OUT],
    shiftCode: record[ATTENDANCE_EMP.SHIFT],
    leaveType: record[ATTENDANCE_EMP.LEAVE_TYPE],
    lunchOtHours: record[ATTENDANCE_EMP.LUNCH_OT_HOURS],
    compLeaveAllowed: record[ATTENDANCE_EMP.COMP_LEAVE_ALLOWED],
    deptWrongFlag: record[ATTENDANCE_EMP.DEPT_WRONG_FLAG],
  };
}
