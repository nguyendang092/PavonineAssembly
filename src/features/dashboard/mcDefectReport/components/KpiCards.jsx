import React, { memo } from "react";
import { useTranslation } from "react-i18next";

function MCDefectReportKpiSection({
  totalErrorCount,
  employeeWithErrors,
  highestDay,
  topEmployee,
  improvementRate,
}) {
  const { t } = useTranslation();
  const tl = (key, defaultValue, opts) =>
    t(`mcDefectReport.${key}`, { defaultValue, ...opts });

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold text-slate-500">
          {tl("kpiTotalErrors", "Tổng lỗi trong tháng")}
        </p>
        <p className="mt-1 text-3xl font-black text-rose-600">{totalErrorCount}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold text-slate-500">
          {tl("kpiEmployeesWithErrors", "Số nhân viên có lỗi")}
        </p>
        <p className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">
          {employeeWithErrors}
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold text-slate-500">
          {tl("kpiHighestDay", "Ngày phát sinh lỗi nhiều nhất")}
        </p>
        <p className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
          {highestDay}
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold text-slate-500">
          {tl("kpiTopEmployee", "Nhân viên lỗi cao nhất")}
        </p>
        <p className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
          {topEmployee}
        </p>
      </div>
      <div
        className={`rounded-xl border p-4 shadow-sm ${
          improvementRate >= 0
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
            : "border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30"
        }`}
      >
        <p className="text-xs font-semibold text-slate-500">
          {tl("kpiImprovementRate", "Tỷ lệ cải thiện so với tháng trước")}
        </p>
        <p
          className={`mt-1 text-3xl font-black ${
            improvementRate >= 0 ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {`${improvementRate >= 0 ? "+" : ""}${improvementRate.toFixed(1)}%`}
        </p>
      </div>
    </section>
  );
}

export default memo(MCDefectReportKpiSection);
