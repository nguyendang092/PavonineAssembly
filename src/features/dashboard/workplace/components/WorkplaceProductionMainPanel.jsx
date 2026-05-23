import React, { memo } from "react";
import {
  FiCalendar,
  FiLayers,
  FiTrendingUp,
  FiAlertTriangle,
  FiTable,
} from "react-icons/fi";
import WorkplaceAreaChartCard from "./WorkplaceAreaChartCard";

export const WorkplaceProductionMainPanel = memo(function WorkplaceProductionMainPanel({
  t,
  sidebarOpen,
  weekMeta,
  dashboardStats,
  chartData,
  setDataTableOpen,
  chartAreasOrdered,
  areaComboDataByArea,
  comboChartOptions,
  workplaceDragOverArea,
  setWorkplaceDragOverArea,
  handleWorkplaceAreaReorder,
}) {
  return (
    <>
      <div
        className={`dashboard-print-fill flex flex-1 flex-col min-h-0 px-3 sm:px-5 pb-3 transition-all duration-300 ${
          sidebarOpen ? "ml-72" : "ml-0"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="dashboard-chart-panel dashboard-report-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
            <div className="shrink-0 border-b border-slate-300/80 bg-gradient-to-b from-slate-200/95 to-slate-100 px-4 pt-4 pb-3 dark:border-slate-800 dark:from-slate-950 dark:to-slate-950">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-400">
                    {t("workplaceChart.dashboardBadge")}
                  </p>
                  <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl dark:text-slate-50">
                    {t("workplaceChart.dashboardTitle")}
                  </h1>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-600 dark:text-slate-400">
                    {t("workplaceChart.dashboardSubtitle")}
                  </p>
                </div>
                {weekMeta.weekNum ? (
                  <div className="shrink-0 sm:text-right">
                    <span className="inline-flex items-center rounded-full border border-slate-300/80 bg-slate-50/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm tabular-nums dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-200">
                      {t("workplaceChart.weekPeriod", {
                        week: weekMeta.weekNum,
                        year: weekMeta.year,
                      })}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 shadow-sm dark:border-slate-700/90 dark:bg-slate-900/95">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <FiTrendingUp
                      className="shrink-0 text-emerald-600 dark:text-emerald-400"
                      size={14}
                    />
                    {t("workplaceChart.kpiTotalGood")}
                  </div>
                  <p className="mt-0.5 text-base font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-50">
                    {dashboardStats.totalGood.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 shadow-sm dark:border-slate-700/90 dark:bg-slate-900/95">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <FiAlertTriangle
                      className="shrink-0 text-rose-600 dark:text-rose-400"
                      size={14}
                    />
                    {t("workplaceChart.kpiTotalNG")}
                  </div>
                  <p className="mt-0.5 text-base font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-50">
                    {dashboardStats.totalNG.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 shadow-sm dark:border-slate-700/90 dark:bg-slate-900/95">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <FiLayers
                      className="shrink-0 text-indigo-600 dark:text-indigo-400"
                      size={14}
                    />
                    {t("workplaceChart.kpiAreas")}
                  </div>
                  <p className="mt-0.5 text-base font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-50">
                    {dashboardStats.areaCount}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 shadow-sm dark:border-slate-700/90 dark:bg-slate-900/95">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <FiCalendar
                      className="shrink-0 text-sky-600 dark:text-sky-400"
                      size={14}
                    />
                    {t("workplaceChart.kpiDays")}
                  </div>
                  <p className="mt-0.5 text-base font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-50">
                    {dashboardStats.dayCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-300/80 bg-slate-200/35 px-4 py-2 dark:border-slate-800 dark:bg-black/20">
              <div className="min-w-0 flex-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                  {t("workplaceChart.chartSectionTitle")}
                </h2>
                <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                  {t("workplaceChart.chartSectionHint")}
                </p>
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-500">
                  {t("workplaceChart.chartDragHint")}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDataTableOpen(true)}
                  disabled={!chartData?.labels?.length}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-sky-600 dark:hover:bg-sky-500"
                >
                  <FiTable size={14} strokeWidth={2.5} />
                  {t("workplaceChart.openDataTable")}
                </button>
                {chartData?.areas?.length ? (
                  <span className="inline-flex items-baseline gap-1.5 rounded-md border border-slate-300/80 bg-slate-50/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 tabular-nums dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-300">
                    <span className="text-slate-600 dark:text-slate-400">
                      {t("workplaceChart.grandTotal")}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-50">
                      {dashboardStats.grandTotal.toLocaleString()}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>

            {chartData?.areas?.length ? (
              <div className="min-h-[200px] flex-1 overflow-y-auto bg-slate-200/35 p-3 dark:bg-black/35 sm:p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {chartAreasOrdered.map((area) => {
                    const combo = areaComboDataByArea[area];
                    if (!combo) return null;
                    return (
                      <WorkplaceAreaChartCard
                        key={area}
                        area={area}
                        combo={combo}
                        comboChartOptions={comboChartOptions}
                        workplaceDragOverArea={workplaceDragOverArea}
                        setWorkplaceDragOverArea={setWorkplaceDragOverArea}
                        handleWorkplaceAreaReorder={handleWorkplaceAreaReorder}
                        panelLabel={t("workplaceChart.panelLabel")}
                        chartDragHandleTitle={t(
                          "workplaceChart.chartDragHandle",
                        )}
                        areaLabel={t(`areas.${area}`)}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center bg-slate-200/35 px-4 py-10 dark:bg-black/35">
                <p className="max-w-sm text-center text-sm text-slate-600 dark:text-slate-400">
                  {t("workplaceChart.pleaseSelectExcel")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
});

export default WorkplaceProductionMainPanel;
