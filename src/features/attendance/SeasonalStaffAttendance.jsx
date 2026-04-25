import React from "react";
import AttendanceList from "./AttendanceList";

export default function SeasonalStaffAttendance() {
  return (
    <AttendanceList
      attendanceRootPath="seasonalAttendance"
      forceVirtualizedRows
      headerTitle="DANH SÁCH NHÂN VIÊN THỜI VỤ HIỆN DIỆN"
      headerSubtitle="List of Active Seasonal Employees"
      counterpartLinkTo="/attendance-list"
      counterpartLinkLabelKey="activeEmployeesTitleShort"
      counterpartLinkLabelDefault="Điểm danh nhân viên chính thức"
    />
  );
}
