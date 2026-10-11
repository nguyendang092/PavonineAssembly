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
        <div className="attendance-list-summary-inner flex flex-wrap items-center gap-2 rounded-md border border-blue-100 bg-gradient-to-r from-blue-50 to-blue-100 px-2 py-1 shadow-sm dark:border-slate-600 dark:from-slate-950 dark:to-slate-900 dark:shadow-none">
            <span className="flex items-center gap-1 text-xs font-bold text-gray-700 md:text-sm dark:text-slate-100">
              <span className="text-base text-blue-600 dark:text-sky-300">📊</span>
              {tl("totalEmployees", "Tổng số nhân viên")}:
              <span className="ml-1 text-base text-blue-700 md:text-lg dark:text-sky-300">{shown}</span>
              {filteredOut ? (
                <span className="ml-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {tl(
                    "attendanceFilteredOfLoaded",
                    "/ {{loaded}} trên ngày (đang lọc)",
                    { loaded },
                  )}
                </span>
              ) : null}
            </span>
            <span className="flex items-center gap-1 border-l border-blue-200 pl-3 text-xs font-bold text-gray-700 md:text-sm dark:border-slate-600 dark:text-slate-100">
              <span className="text-base text-indigo-500 dark:text-indigo-300">🏷️</span>
              {tl("classification", "Phân loại phép")}:
              <span className="ml-1 flex flex-wrap gap-1">
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
                  <span className="italic text-gray-400 dark:text-slate-400">
                    {tl("noClassification", "Không có phân loại")}
                  </span>
                )}
              </span>
            </span>
            <span className="flex items-center gap-1 border-l border-blue-200 pl-3 text-xs font-bold text-gray-700 md:text-sm dark:border-slate-600 dark:text-slate-100">
              <span className="text-base text-amber-500 dark:text-amber-300">🕒</span>
              {tl("workShiftStats", "Thống kê ca làm việc")}:
              <span className="ml-1 flex flex-wrap gap-1">
                {shiftEntries.length > 0 ? (
                  shiftEntries.map(([shift, count]) => (
                    <span
                      key={shift}
                      className="px-2 py-0.5 rounded border border-amber-200 bg-amber-100 text-2xs font-bold text-amber-700 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                    >
                      {shift}: {count}
                    </span>
                  ))
                ) : (
                  <span className="italic text-gray-400 dark:text-slate-400">
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
