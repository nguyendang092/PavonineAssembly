import React from "react";

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900";

export default function MCDefectReportFiltersSidebar({
  reportMonth,
  setReportMonth,
  reportDepartment,
  setReportDepartment,
  reportEmployee,
  setReportEmployee,
  reportErrorType,
  setReportErrorType,
  monthOptions,
  departmentOptions,
  employeeOptions,
  errorTypeOptions,
  onResetFilters,
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col self-stretch lg:sticky lg:top-4 lg:w-56 xl:w-60">
      <section className="flex h-full min-h-full w-full flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          Bộ lọc
        </h2>
        <div className="flex flex-1 flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-500">Tháng</span>
            <select
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">Tất cả</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-500">
              Bộ phận
            </span>
            <select
              value={reportDepartment}
              onChange={(e) => setReportDepartment(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">Tất cả</option>
              {departmentOptions.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-500">
              Nhân viên
            </span>
            <select
              value={reportEmployee}
              onChange={(e) => setReportEmployee(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">Tất cả</option>
              {employeeOptions.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-500">
              Loại lỗi
            </span>
            <select
              value={reportErrorType}
              onChange={(e) => setReportErrorType(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">Tất cả</option>
              {errorTypeOptions.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onResetFilters}
            className="w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      </section>
    </aside>
  );
}
