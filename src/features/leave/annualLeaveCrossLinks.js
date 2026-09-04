import { getTodayDateKeyLocal } from "@/utils/dateKey";
import { annualLeaveAttendanceCountStartDate } from "./annualLeaveFields";
import { annualLeaveYearFromDateKey } from "./annualLeaveBalanceLookup";

/** Ngày mặc định khi mở điểm danh từ quản lý phép năm (năm đang chọn). */
export function attendanceListDateForAnnualLeaveYear(
  year,
  todayKey = getTodayDateKeyLocal(),
) {
  const y = Number(year);
  const today = String(todayKey ?? getTodayDateKeyLocal()).trim();
  if (!Number.isFinite(y)) {
    return today || getTodayDateKeyLocal();
  }
  if (today.startsWith(`${y}-`)) return today;
  const start = annualLeaveAttendanceCountStartDate(y);
  return start || `${y}-01-01`;
}

export function annualLeavePathForDateKey(dateKey) {
  const year = annualLeaveYearFromDateKey(dateKey);
  return `/annual-leave?year=${encodeURIComponent(year)}`;
}

export function attendanceListPathForAnnualLeaveYear(year) {
  const date = attendanceListDateForAnnualLeaveYear(year);
  return `/attendance-list?date=${encodeURIComponent(date)}`;
}

export function payrollPathForDateKey(dateKey) {
  return `/attendance-salary?date=${encodeURIComponent(dateKey)}`;
}
