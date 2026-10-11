import React from "react";
import PayrollSalaryCalculator from "@/features/payroll/PayrollSalaryCalculator";
import { SEASONAL_ATTENDANCE_ROOT } from "@/features/attendance/attendanceSeasonalStt";

/** Trang giờ công nhân viên thời vụ — cùng UI với Giờ công, dữ liệu `seasonalAttendance`. */
export default function SeasonalPayrollSalaryPage() {
  return (
    <PayrollSalaryCalculator attendanceRootPath={SEASONAL_ATTENDANCE_ROOT} />
  );
}
