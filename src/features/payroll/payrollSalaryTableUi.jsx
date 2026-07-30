/**
 * Bảng lương: bọc cùng layout với điểm danh nhưng `tableVariant="payroll"`
 * (cột Giờ công, Giờ TC, TC off). Tách file để cập nhật màn lương không đụng AttendanceList.
 */
import React from "react";
import AttendanceTableRow, {
  AttendanceTableColgroup,
  AttendanceTableThead,
} from "@/features/attendance/attendanceTableRow";

const PAYROLL = { tableVariant: "payroll" };

export function PayrollSalaryTableColgroup(props) {
  return <AttendanceTableColgroup {...props} {...PAYROLL} />;
}

export function PayrollSalaryTableThead(props) {
  return <AttendanceTableThead {...props} {...PAYROLL} />;
}

export default function PayrollSalaryTableRow(props) {
  return <AttendanceTableRow {...props} {...PAYROLL} />;
}
