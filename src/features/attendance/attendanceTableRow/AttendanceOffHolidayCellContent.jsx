import React, { memo } from "react";
import {
  getAttendanceLeaveTypeColorClassName,
} from "../attendanceGioVaoTypeOptions";
import { PAYROLL_EMPTY_CELL, ATTENDANCE_EMPTY_CELL } from "./constants";

function AttendanceOffHolidayCellContent({
  isPayroll,
  isMinimal,
  payrollTimeShiftFont,
  kind,
  active,
}) {
  const empty = isPayroll ? PAYROLL_EMPTY_CELL : ATTENDANCE_EMPTY_CELL;
  const leaveTypeRedClass = getAttendanceLeaveTypeColorClassName("Không phép");
  const sizeCls = isPayroll
    ? payrollTimeShiftFont
    : isMinimal
      ? "text-[10px] md:text-base"
      : "text-xs md:text-base";
  if (!active) {
    return (
      <span
        className={`tabular-nums ${isPayroll ? "text-gray-500" : "font-normal text-gray-400"}`}
      >
        {empty}
      </span>
    );
  }
  const label =
    kind === "off" ? "OFF" : kind === "holiday" ? "HOLIDAY" : "NB";
  return (
    <span className={`font-bold ${sizeCls} ${leaveTypeRedClass}`}>
      {label}
    </span>
  );
}

export default memo(AttendanceOffHolidayCellContent);
