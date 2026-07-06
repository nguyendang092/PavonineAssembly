import React, { memo } from "react";
import { Link } from "react-router-dom";

function AttendanceListHeader({
  headerTitle,
  headerSubtitle,
  counterpartLinkTo,
  counterpartLinkLabelKey,
  counterpartLinkLabelDefault,
  tl,
}) {
  return (
    <div className="shrink-0">
      <div className="w-full border-t-4 border-blue-600 bg-white pl-2 pr-1.5 py-0.5 shadow-sm md:pr-2 dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-1">
          <div className="min-w-0 text-left">
            <h1 className="text-balance text-sm font-bold uppercase leading-snug tracking-wide text-[#1e293b] md:text-base dark:text-slate-100">
              {headerTitle ??
                tl("activeEmployeesTitle", "DANH SÁCH NHÂN VIÊN HIỆN DIỆN")}
            </h1>
            <p className="mt-0 hidden text-[10px] leading-snug text-gray-600 md:mt-0.5 md:block md:text-[11px]">
              {headerSubtitle ??
                tl("activeEmployeesSubtitle", "List of Active Employees")}
            </p>
          </div>
          <nav
            className="flex w-full shrink-0 flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5 border-t border-slate-100 pt-0.5 text-left sm:mb-0 sm:w-auto sm:flex-nowrap sm:items-end sm:border-0 sm:pt-0 sm:text-right"
            aria-label={tl("headerQuickLinks", "Liên kết nhanh")}
          >
            <Link
              to={counterpartLinkTo}
              className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-blue-600 hover:text-blue-700 hover:underline sm:justify-end md:text-xs"
            >
              <span aria-hidden>→</span>
              {tl(counterpartLinkLabelKey, counterpartLinkLabelDefault)}
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}

export default memo(AttendanceListHeader);
