/**
 * Khóa trường RTDB / Excel payroll — tách file để tránh circular import
 * với attendanceEmployeeFields (ATTENDANCE_EMP mở rộng PAYROLL_EMP).
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
  /** Phút TC tài xế nhập thủ công — quy đổi tỷ lệ phút/60, cộng vào TC ca ngày. */
  DRIVER_OT_MINUTES: "tangCaTaiXePhut",
  SHIFT: "caLamViec",
  LEAVE_TYPE: "loaiPhep",
  COMP_LEAVE_ALLOWED: "duocNghiBu",
  /** Cờ payroll trên dòng (từ `_meta` hoặc merge) — không phải khóa RTDB trên bản ghi NV. */
  PAYROLL_EARLY_OT_PAPERWORK: "payrollEarlyOtPaperwork",
  PAYROLL_LATE_OT_EXCLUDED: "payrollLateOtExcluded",
  PAYROLL_NIGHT_OT_PAPERWORK: "payrollNightOtPaperwork",
};
