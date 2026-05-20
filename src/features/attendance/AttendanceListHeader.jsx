import React, { memo } from "react";
import { Link } from "react-router-dom";

function AttendanceListHeader({
  headerTitle,
  headerSubtitle,
  selectedDate,
  displayLocale,
  counterpartLinkTo,
  counterpartLinkLabelKey,
  counterpartLinkLabelDefault,
  tl,
}) {
  return (
    <div className="mb-1.5 md:mb-2">
      <div className="rounded-lg border-t-4 border-blue-600 bg-white px-2 py-1 shadow-md md:px-3 md:py-1.5 dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-2">
          <div className="min-w-0 text-left">
            <h1 className="text-balance text-sm font-bold uppercase leading-snug tracking-wide text-[#1e293b] md:text-base dark:text-slate-100">
              {headerTitle ??
                tl("activeEmployeesTitle", "DANH SÁCH NHÂN VIÊN HIỆN DIỆN")}
            </h1>
            <p className="mt-0.5 hidden text-[11px] leading-snug text-gray-600 md:mt-0.5 md:block md:text-xs">
              {headerSubtitle ??
                tl("activeEmployeesSubtitle", "List of Active Employees")}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-gray-500 md:mt-0.5 md:text-[11px]">
              {tl("headerDateLabel", "Ngày")}:{" "}
              {new Date(selectedDate).toLocaleDateString(displayLocale)}
            </p>
          </div>
          <nav
            className="flex w-full shrink-0 flex-row flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-slate-100 pt-1 text-left sm:mb-0.5 sm:w-auto sm:flex-nowrap sm:items-end sm:border-0 sm:pt-0 sm:text-right"
            aria-label={tl("headerQuickLinks", "Liên kết nhanh")}
          >
            <Link
              to={counterpartLinkTo}
              className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-blue-600 hover:text-blue-700 hover:underline sm:justify-end md:text-xs"
            >
              <span aria-hidden>→</span>
              {tl(counterpartLinkLabelKey, counterpartLinkLabelDefault)}
            </Link>
            <Link
              to={`/attendance-salary?date=${encodeURIComponent(selectedDate)}`}
              className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300 sm:justify-end md:text-xs"
            >
              <span aria-hidden>→</span>
              {tl("linkToAttendanceSalaryShort", "Giờ công / Lương")}
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}

export default memo(AttendanceListHeader);
