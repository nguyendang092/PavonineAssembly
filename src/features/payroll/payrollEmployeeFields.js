import { pickAttendanceEmployeeDayFields } from "@/features/attendance/attendanceEmployeeFields";

/**
 * Khóa trường RTDB / Excel — giữ nguyên (dữ liệu lưu trữ).
 * Dùng hằng để tránh nhầm tên biến tiếng Việt khi đọc/ghi bản ghi.
 */
export const PAYROLL_EMP = {
  STT: "stt",
  MNV: "mnv",
  MVT: "mvt",
  EMPLOYEE_NAME: "hoVaTen",
  GENDER: "gioiTinh",
  DEPT_CODE: "maBoPhan",
  DEPARTMENT: "boPhan",
  JOIN_DATE: "ngayVaoLam",
  CONTRACT_DATE: "ngayHopDong",
  TIME_IN: "gioVao",
  TIME_OUT: "gioRa",
  LUNCH_OT_HOURS: "tangCaTrua",
  SHIFT: "caLamViec",
  LEAVE_TYPE: "loaiPhep",
  COMP_LEAVE_ALLOWED: "duocNghiBu",
  /** Cờ payroll trên dòng (từ `_meta` hoặc merge) — không phải khóa RTDB trên bản ghi NV. */
  PAYROLL_EARLY_OT_PAPERWORK: "payrollEarlyOtPaperwork",
  PAYROLL_LATE_OT_EXCLUDED: "payrollLateOtExcluded",
};

/**
 * Tham số ngày chuẩn cho tính GC/TC bảng lương — đồng bộ `payrollOtDayParamsFromEmp`.
 * Đọc từ bản ghi NV qua `PAYROLL_EMP`; cờ OT qua `PAYROLL_EMP.PAYROLL_*`.
 *
 * @typedef {{
 *   timeIn: unknown,
 *   timeOut: unknown,
 *   shiftCode: unknown,
 *   leaveType: unknown,
 *   isOffDay: boolean,
 *   isHolidayDay: boolean,
 *   isCompensatoryDay?: boolean,
 *   payrollEarlyOtPaperwork: boolean | undefined,
 *   payrollLateOtExcluded: boolean | undefined,
 *   lunchOtHours?: unknown,
 *   includeTapVuInWorkingHours?: boolean,
 *   includeThaiSanInWorkingHours?: boolean,
 *   includeTaiXeInWorkingHours?: boolean,
 *   includeTaiXeTongInWorkingHours?: boolean,
 * }} PayrollOtDayParams
 */

/** Giờ vào/ra + ca + phép từ một dòng payroll (không gộp ngữ cảnh ngày). */
export function pickPayrollEmployeeDayFields(record) {
  return {
    ...pickAttendanceEmployeeDayFields(record),
    payrollEarlyOtPaperwork:
      record?.[PAYROLL_EMP.PAYROLL_EARLY_OT_PAPERWORK],
    payrollLateOtExcluded: record?.[PAYROLL_EMP.PAYROLL_LATE_OT_EXCLUDED],
  };
}

/** Ngày vào làm / ngày HĐ — kiểu nội bộ tiếng Anh cho tính toán payroll. */
export function pickPayrollEmployeeProfileDates(record) {
  if (!record) return { joinDate: "", contractDate: "" };
  return {
    joinDate: record.joinDate ?? record[PAYROLL_EMP.JOIN_DATE] ?? "",
    contractDate:
      record.contractDate ?? record[PAYROLL_EMP.CONTRACT_DATE] ?? "",
  };
}

export function pickPayrollEmployeeJoinDate(record) {
  return pickPayrollEmployeeProfileDates(record).joinDate;
}
