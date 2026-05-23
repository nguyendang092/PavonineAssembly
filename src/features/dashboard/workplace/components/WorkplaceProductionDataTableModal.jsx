import React, { memo } from "react";
import { FiX } from "react-icons/fi";
import { dayNormalTotal, dayNGTotal } from "../lib/dayTotals";

export const WorkplaceProductionDataTableModal = memo(function WorkplaceProductionDataTableModal({
  t,
  dataTableOpen,
  setDataTableOpen,
  tableView,
  setTableView,
  selectedArea,
  setSelectedArea,
  dataMap,
  chartData,
  openDetailModal,
  exportToExcel,
  getCurrentWeekNumber,
}) {
  if (!dataTableOpen) return null;
  return (
    <>
              <div
          className="fixed inset-0 flex items-center justify-center overflow-y-auto overscroll-contain p-2 sm:p-4"
          style={{ zIndex: "var(--z-modal-backdrop, 1200)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="workplace-data-table-title"
        >
          <button
            type="button"
            className="absolute inset-0 min-h-full bg-black/70 backdrop-blur-sm"
            onClick={() => setDataTableOpen(false)}
            aria-label={t("workplaceChart.closeDataTable")}
          />
          <div
            className="relative z-10 flex min-h-0 max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-100 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-300/80 bg-gradient-to-b from-slate-200/95 to-slate-100 px-4 py-3 dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 sm:px-5">
              <div className="min-w-0">
                <h2
                  id="workplace-data-table-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-50 sm:text-lg"
                >
                  {t("workplaceChart.tableSectionTitle")}
                </h2>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                  {t("workplaceChart.tableSectionHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDataTableOpen(false)}
                className="shrink-0 rounded-lg p-2 text-slate-600 transition hover:bg-slate-300/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label={t("workplaceChart.closeDataTable")}
              >
                <FiX size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-b border-slate-300/80 bg-slate-50/90 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex rounded-lg border border-slate-300/80 bg-slate-100/90 p-0.5 text-[11px] font-semibold dark:border-slate-700/90 dark:bg-slate-950/80">
                <button
                  type="button"
                  onClick={() => setTableView("detailed")}
                  className={`rounded-md px-2.5 py-1.5 transition sm:px-3 ${
                    tableView === "detailed"
                      ? "bg-slate-50 text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  }`}
                >
                  {t("workplaceChart.viewDetailed")}
                </button>
                <button
                  type="button"
                  onClick={() => setTableView("summary")}
                  className={`rounded-md px-2.5 py-1.5 transition sm:px-3 ${
                    tableView === "summary"
                      ? "bg-slate-50 text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  }`}
                >
                  {t("workplaceChart.viewSummary")}
                </button>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="w-full rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/35 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-100 sm:w-[220px]"
                >
                  <option value="">{t("workplaceChart.selectArea")}</option>
                  {Object.keys(dataMap).map((area) => (
                    <option key={area} value={area}>
                      {t(`areas.${area}`)}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openDetailModal("Assembly", getCurrentWeekNumber())
                    }
                    className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700"
                  >
                    {t("workplaceChart.viewDetail")}
                  </button>
                  <button
                    type="button"
                    onClick={exportToExcel}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    {t("workplaceChart.exportExcel")}
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-200/35 px-4 py-3 dark:bg-black/35 sm:px-5">
              {chartData ? (
                tableView === "detailed" ? (
                  <div className="space-y-5">
                    <div>
                      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        {t("workplaceChart.viewSummary")}
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-slate-300/85 dark:border-slate-700/90">
                        <table className="w-full min-w-[520px] border-collapse text-left text-xs text-slate-700 dark:text-slate-200">
                          <thead>
                            <tr className="uppercase">
                              <th className="border-b border-slate-300/80 bg-slate-200/90 px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-700 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-300">
                                {t("workplaceChart.area")}
                              </th>
                              <th className="border-b border-slate-300/80 bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-700 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-300">
                                {t("workplaceChart.normal")}
                              </th>
                              <th className="border-b border-slate-300/80 bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-700 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-300">
                                {t("workplaceChart.rework")}
                              </th>
                              <th className="border-b border-slate-300/80 bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-800 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-200">
                                {t("workplaceChart.total")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(dataMap)
                              .filter(
                                ([area]) =>
                                  selectedArea === "" ||
                                  selectedArea === area,
                              )
                              .map(([area, dayArr]) => {
                                let totalNormal = 0;
                                let totalRework = 0;
                                dayArr.forEach(({ Day, Night }, idx) => {
                                  let normal = Day.normal;
                                  let rework = Day.rework;
                                  if (area === "CNC") {
                                    const nextNight =
                                      idx + 1 < dayArr.length
                                        ? dayArr[idx + 1].Night
                                        : { normal: 0, rework: 0 };
                                    normal += nextNight.normal;
                                    rework += nextNight.rework;
                                  } else {
                                    normal += Night.normal;
                                    rework += Night.rework;
                                  }
                                  totalNormal += normal;
                                  totalRework += rework;
                                });
                                return (
                                  <tr
                                    key={area}
                                    className="border-b border-slate-100 text-[11px] font-medium text-slate-800 transition hover:bg-slate-50/90 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/80"
                                  >
                                    <td className="px-3 py-2">
                                      {t(`areas.${area}`)}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                      {totalNormal.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                      {totalRework.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                                      {(
                                        totalNormal + totalRework
                                      ).toLocaleString()}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        {t("workplaceChart.viewDetailed")}
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-slate-300/85 dark:border-slate-700/90">
                        <table className="w-full min-w-[520px] border-collapse text-left text-xs text-slate-700 dark:text-slate-200">
                          <thead>
                            <tr className="uppercase">
                              <th className="sticky top-0 z-[1] bg-slate-200/90 px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-700 dark:bg-slate-900/95 dark:text-slate-300">
                                {t("workplaceChart.areaDay")}
                              </th>
                              <th className="sticky top-0 z-[1] bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-700 dark:bg-slate-900/95 dark:text-slate-300">
                                {t("workplaceChart.comboBarLabel")}
                              </th>
                              <th className="sticky top-0 z-[1] bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-700 dark:bg-slate-900/95 dark:text-slate-300">
                                {t("workplaceChart.ngColumn")}
                              </th>
                              <th className="sticky top-0 z-[1] bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-800 dark:bg-slate-900/95 dark:text-slate-200">
                                {t("workplaceChart.total")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(dataMap)
                              .filter(
                                ([area]) =>
                                  selectedArea === "" ||
                                  selectedArea === area,
                              )
                              .map(([area, dayArr]) => {
                                let totalNormal = 0;
                                let totalNG = 0;
                                chartData.labels.forEach((label, idx) => {
                                  totalNormal += dayNormalTotal(
                                    area,
                                    dayArr,
                                    idx,
                                  );
                                  totalNG += dayNGTotal(area, dayArr, idx);
                                });
                                return (
                                  <React.Fragment key={area}>
                                    <tr className="bg-slate-200/80 text-[11px] font-semibold uppercase text-slate-800 dark:bg-slate-900/90 dark:text-slate-100">
                                      <td className="px-3 py-2">
                                        {t(`areas.${area}`)}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums">
                                        {totalNormal.toLocaleString()}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums">
                                        {totalNG.toLocaleString()}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums">
                                        {(
                                          totalNormal + totalNG
                                        ).toLocaleString()}
                                      </td>
                                    </tr>
                                    {chartData.labels.map((label, idx) => {
                                      const good = dayNormalTotal(
                                        area,
                                        dayArr,
                                        idx,
                                      );
                                      const ng = dayNGTotal(area, dayArr, idx);
                                      const total = good + ng;
                                      if (total === 0) return null;
                                      return (
                                        <tr
                                          key={idx}
                                          className="border-b border-slate-100/90 text-[11px] text-slate-600 transition hover:bg-sky-50/50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/50"
                                        >
                                          <td className="pl-8 pr-3 py-1.5 text-slate-600 dark:text-slate-400">
                                            {label}
                                          </td>
                                          <td className="px-3 py-1.5 text-right tabular-nums">
                                            {good.toLocaleString()}
                                          </td>
                                          <td className="px-3 py-1.5 text-right tabular-nums">
                                            {ng.toLocaleString()}
                                          </td>
                                          <td className="px-3 py-1.5 text-right tabular-nums font-medium text-slate-800 dark:text-slate-100">
                                            {total.toLocaleString()}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </React.Fragment>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-300/85 dark:border-slate-700/90">
                    <table className="w-full min-w-[520px] border-collapse text-left text-xs text-slate-700 dark:text-slate-200">
                      <thead>
                        <tr className="uppercase">
                          <th className="border-b border-slate-300/80 bg-slate-200/90 px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-700 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-300">
                            {t("workplaceChart.area")}
                          </th>
                          <th className="border-b border-slate-300/80 bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-700 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-300">
                            {t("workplaceChart.normal")}
                          </th>
                          <th className="border-b border-slate-300/80 bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-700 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-300">
                            {t("workplaceChart.rework")}
                          </th>
                          <th className="border-b border-slate-300/80 bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-800 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-200">
                            {t("workplaceChart.total")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(dataMap)
                          .filter(
                            ([area]) =>
                              selectedArea === "" || selectedArea === area,
                          )
                          .map(([area, dayArr]) => {
                          let totalNormal = 0;
                          let totalRework = 0;
                          dayArr.forEach(({ Day, Night }, idx) => {
                            let normal = Day.normal;
                            let rework = Day.rework;
                            if (area === "CNC") {
                              const nextNight =
                                idx + 1 < dayArr.length
                                  ? dayArr[idx + 1].Night
                                  : { normal: 0, rework: 0 };
                              normal += nextNight.normal;
                              rework += nextNight.rework;
                            } else {
                              normal += Night.normal;
                              rework += Night.rework;
                            }
                            totalNormal += normal;
                            totalRework += rework;
                          });
                          return (
                            <tr
                              key={area}
                              className="border-b border-slate-100 text-[11px] font-medium text-slate-800 transition hover:bg-slate-50/90 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/80"
                            >
                              <td className="px-3 py-2">
                                {t(`areas.${area}`)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {totalNormal.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {totalRework.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold">
                                {(totalNormal + totalRework).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <p className="py-6 text-center text-sm text-slate-600 dark:text-slate-400">
                  {t("workplaceChart.noData")}
                </p>
              )}
            </div>
          </div>
        </div>
      
    </>
  );
});

export default WorkplaceProductionDataTableModal;
