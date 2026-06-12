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
};

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
