import React, { memo, useMemo } from "react";
import {
  formatAttendanceGioVaoDisplay,
  getAttendanceLeaveTypeBadgeClassName,
  getAttendanceLeaveTypeRaw,
} from "./attendanceGioVaoTypeOptions";

function AttendanceListSummary({
  deferredFilteredEmployees,
  employeesCount = 0,
  tl,
}) {
  const shown = deferredFilteredEmployees.length;
  const loaded = Number(employeesCount) || 0;
  const filteredOut = loaded > 0 && shown < loaded;
  const { leaveTypeCounts, shiftCounts } = useMemo(() => {
    const timeCounts = {};
    const counts = {};
    for (const emp of deferredFilteredEmployees) {
      const time = formatAttendanceGioVaoDisplay(
        getAttendanceLeaveTypeRaw(emp),
      );
      if (time && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) {
        timeCounts[time] = (timeCounts[time] || 0) + 1;
      }
      const shift = emp.caLamViec;
      if (shift) counts[shift] = (counts[shift] || 0) + 1;
    }
    return { leaveTypeCounts: timeCounts, shiftCounts: counts };
  }, [deferredFilteredEmployees]);

  const leaveEntries = Object.entries(leaveTypeCounts);
  const shiftEntries = Object.entries(shiftCounts);

  return (
    <SummaryRoot>
      <div className="w-full">
        <div className="attendance-list-summary-inner flex flex-wrap items-center gap-2 border border-blue-100 rounded-md px-2 py-1 bg-gradient-to-r from-blue-50 to-blue-100 shadow-sm">
            <span className="flex items-center gap-1 text-xs font-bold text-gray-700 md:text-sm">
              <span className="text-blue-600 text-base">📊</span>
              {tl("totalEmployees", "Tổng số nhân viên")}:
              <span className="ml-1 text-base text-blue-700 md:text-lg">{shown}</span>
              {filteredOut ? (
                <span className="ml-1 text-xs font-semibold text-amber-700">
                  {tl(
                    "attendanceFilteredOfLoaded",
                    "/ {{loaded}} trên ngày (đang lọc)",
                    { loaded },
                  )}
                </span>
              ) : null}
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-gray-700 border-l border-blue-200 pl-3 md:text-sm">
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
            <span className="flex items-center gap-1 text-xs font-bold text-gray-700 border-l border-blue-200 pl-3 md:text-sm">
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
    </SummaryRoot>
  );
}

function SummaryRoot({ children }) {
  return (
    <div className="attendance-list-summary-root w-full max-w-none border-l-4 border-blue-600 border-t border-slate-200/90 bg-white py-1 pl-1.5 pr-0 sm:py-1.5 sm:pl-2 dark:border-slate-700/90 dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
      {children}
    </div>
  );
}

export default memo(AttendanceListSummary);
