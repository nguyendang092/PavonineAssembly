import React, { memo, useMemo } from "react";
import {
  formatAttendanceGioVaoDisplay,
  getAttendanceLeaveTypeBadgeClassName,
  getAttendanceLeaveTypeRaw,
} from "./attendanceGioVaoTypeOptions";

function AttendanceListSummary({
  deferredFilteredEmployees,
  displayLocale,
  selectedDate,
  tl,
}) {
  const leaveTypeCounts = useMemo(() => {
    const timeCounts = {};
    deferredFilteredEmployees.forEach((emp) => {
      const time = formatAttendanceGioVaoDisplay(getAttendanceLeaveTypeRaw(emp));
      if (time && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) {
        timeCounts[time] = (timeCounts[time] || 0) + 1;
      }
    });
    return timeCounts;
  }, [deferredFilteredEmployees]);

  const shiftCounts = useMemo(() => {
    const counts = {};
    deferredFilteredEmployees.forEach((emp) => {
      const shift = emp.caLamViec;
      if (shift) counts[shift] = (counts[shift] || 0) + 1;
    });
    return counts;
  }, [deferredFilteredEmployees]);

  const leaveEntries = Object.entries(leaveTypeCounts);
  const shiftEntries = Object.entries(shiftCounts);

  return (
    <SummaryRoot>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="w-full">
          <div className="flex flex-wrap items-center gap-4 border border-blue-100 rounded-lg px-3 py-2 bg-gradient-to-r from-blue-50 to-blue-100 shadow-sm">
            <span className="flex items-center gap-1 text-sm font-bold text-gray-700">
              <span className="text-blue-600 text-lg">📊</span>
              {tl("totalEmployees", "Tổng số nhân viên")}:
              <span className="ml-1 text-lg text-blue-700">
                {deferredFilteredEmployees.length}
              </span>
            </span>
            <span className="flex items-center gap-1 text-sm font-bold text-gray-700 border-l border-blue-200 pl-4">
              <span className="text-indigo-500 text-base">🏷️</span>
              {tl("classification", "Phân loại phép")}:
              <span className="flex flex-wrap gap-1 ml-1">
                {leaveEntries.length > 0 ? (
                  leaveEntries.map(([time, count]) => (
                    <span
                      key={time}
                      className={`px-2 py-0.5 rounded font-bold text-2xs border ${getAttendanceLeaveTypeBadgeClassName(time)}`}
                    >
                      {time}: {count}
                    </span>
                  ))
                ) : (
                  <span className="italic text-gray-400">
                    {tl("noClassification", "Không có phân loại")}
                  </span>
                )}
              </span>
            </span>
            <span className="flex items-center gap-1 text-sm font-bold text-gray-700 border-l border-blue-200 pl-4">
              <span className="text-amber-500 text-base">🕒</span>
              {tl("workShiftStats", "Thống kê ca làm việc")}:
              <span className="flex flex-wrap gap-1 ml-1">
                {shiftEntries.length > 0 ? (
                  shiftEntries.map(([shift, count]) => (
                    <span
                      key={shift}
                      className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-bold text-2xs border border-amber-200"
                    >
                      {shift}: {count}
                    </span>
                  ))
                ) : (
                  <span className="italic text-gray-400">
                    {tl("noShiftStats", "Không có ca làm việc")}
                  </span>
                )}
              </span>
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 self-start sm:self-auto">
          {tl("date", "Ngày")}:{" "}
          {new Date(selectedDate).toLocaleDateString(displayLocale)}
        </p>
      </div>
    </SummaryRoot>
  );
}

function SummaryRoot({ children }) {
  return (
    <div className="mt-2 rounded-lg border-l-4 border-blue-600 bg-white p-4 shadow-md dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
      {children}
    </div>
  );
}

export default memo(AttendanceListSummary);
