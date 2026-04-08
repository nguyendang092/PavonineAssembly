import React from "react";
import { useTranslation } from "react-i18next";
import Sidebar from "@/components/layout/Sidebar";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import {
  calculateTotal,
  calculatePercentage,
  isRemovableTeam,
} from "@/utils/performanceChartData";

const INPUT_CLASS =
  "w-12 md:w-16 px-1 md:px-2 py-0.5 md:py-1 text-center text-[10px] md:text-xs border border-gray-200 rounded focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-all outline-none font-medium text-gray-700 disabled:bg-gray-100 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/30 dark:disabled:bg-slate-800";

const INPUT_WEEK_CLASS =
  "w-12 md:w-16 px-1 md:px-2 py-0.5 md:py-1 text-center text-[10px] md:text-xs border border-gray-200 rounded focus:border-pink-400 focus:ring-1 focus:ring-pink-200 transition-all outline-none font-medium text-gray-700 disabled:bg-gray-100 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-pink-500 dark:focus:ring-pink-500/30 dark:disabled:bg-slate-800";

export function PerformanceYearSidebar({
  open,
  onClose,
  years,
  selectedYear,
  onSelectYear,
  currentCalendarYear,
}) {
  return (
    <Sidebar isOpen={open} onClose={onClose}>
      <div className="flex h-full flex-col p-4">
        <div className="mb-4 text-center">
          <h2 className="mb-2 flex items-center justify-center gap-2 text-sm font-bold text-white">
            <span>📅</span>
            <span>년도 선택</span>
          </h2>
          <p className="text-[10px] text-gray-300">Select Year</p>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2 space-y-2 overflow-y-auto md:block md:space-y-2">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => {
                onSelectYear(year);
                if (window.innerWidth < 768) onClose();
              }}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition-all ${
                selectedYear === year
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{year}</span>
                {year === currentCalendarYear && (
                  <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px]">
                    현재
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Sidebar>
  );
}

export function PerformanceDataTable({
  data,
  currentWeekNumber,
  selectedYear,
  canEdit,
  hasUnsavedChanges,
  saving,
  onSave,
  onChangeCell,
  newTeamName = "",
  onNewTeamNameChange,
  onAddTeam,
  onRemoveTeam,
}) {
  const prevWeek = currentWeekNumber - 1;

  return (
    <div className="mb-2 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 md:mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 px-2 py-2 md:px-4">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-white md:text-sm">
          <span>📊</span>
          <span className="hidden sm:inline">데이터 입력 테이블</span>
          <span className="sm:hidden">테이블</span>
        </h3>
        <div className="flex flex-wrap items-center justify-end gap-1.5 md:gap-2">
          {canEdit ? (
            <div className="flex max-w-full flex-wrap items-center gap-1.5 text-[10px] md:text-xs">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => onNewTeamNameChange?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAddTeam?.();
                  }
                }}
                placeholder="Tên team"
                className="min-w-[8rem] max-w-[12rem] rounded-md border border-white/40 bg-white/95 px-2 py-1 text-gray-800 placeholder:text-gray-400 focus:border-white focus:outline-none focus:ring-2 focus:ring-white/50 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500"
                title="Tên team mới (chỉ admin)"
                aria-label="Tên team cải tiến mới"
              />
              <button
                type="button"
                onClick={() => onAddTeam?.()}
                className="shrink-0 rounded bg-white/90 px-2 py-1 font-semibold text-indigo-700 shadow hover:bg-white dark:bg-slate-200/90 dark:text-indigo-900 dark:hover:bg-white"
                title="Thêm team vào danh sách (chưa lưu — bấm Lưu)"
              >
                + Team
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={!hasUnsavedChanges || saving || !canEdit}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-all md:gap-2 md:px-3 md:py-1.5 md:text-xs ${
              hasUnsavedChanges && !saving && canEdit
                ? "bg-white text-indigo-600 shadow-md hover:bg-gray-100 dark:bg-slate-100 dark:text-indigo-700 dark:hover:bg-white"
                : "cursor-not-allowed bg-white/20 text-white/50"
            }`}
            title={
              !canEdit
                ? "Chỉ admin mới có quyền lưu dữ liệu"
                : hasUnsavedChanges
                  ? "Lưu dữ liệu vào Firebase"
                  : "Không có thay đổi"
            }
          >
            {saving ? (
              <>
                <LoadingSpinner size="xs" className="text-white/90" />
                <span className="hidden sm:inline">
                  {t("performanceChart.saving")}
                </span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span className="hidden sm:inline">저장</span>
                {hasUnsavedChanges && (
                  <span className="rounded-full bg-red-500 px-1 text-[10px] text-white">
                    ●
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px] md:text-xs">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-slate-800 dark:to-slate-800/90">
              <th className="border-b border-indigo-200 px-2 py-1 text-left text-[9px] font-bold uppercase tracking-wider text-gray-700 dark:border-indigo-800 dark:text-slate-200 md:px-3 md:py-2 md:text-[10px]">
                TEAM
              </th>
              <th className="border-b border-indigo-200 px-2 py-1 text-center text-[9px] font-bold uppercase tracking-wider text-gray-700 dark:border-indigo-800 dark:text-slate-200 md:px-3 md:py-2 md:text-[10px]">
                <span className="hidden sm:inline">TARGET</span>
                <span className="sm:hidden">TGT</span>
              </th>
              <th className="border-b border-indigo-200 px-2 py-1 text-center text-[9px] font-bold uppercase tracking-wider text-gray-700 dark:border-indigo-800 dark:text-slate-200 md:px-3 md:py-2 md:text-[10px]">
                <span className="hidden md:inline">
                  TOTAL (W1~W{prevWeek}/{selectedYear})
                </span>
                <span className="md:hidden">TOTAL</span>
              </th>
              <th className="border-b border-indigo-200 px-2 py-1 text-center text-[9px] font-bold uppercase tracking-wider text-gray-700 dark:border-indigo-800 dark:text-slate-200 md:px-3 md:py-2 md:text-[10px]">
                <span className="hidden sm:inline">Achievement Rate</span>
                <span className="sm:hidden">%</span>
              </th>
              <th className="border-b border-indigo-200 px-2 py-1 text-center text-[9px] font-bold uppercase tracking-wider text-gray-700 dark:border-indigo-800 dark:text-slate-200 md:px-3 md:py-2 md:text-[10px]">
                <span className="hidden sm:inline">
                  WEEK {prevWeek}/{selectedYear}
                </span>
                <span className="sm:hidden">WK</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {data.map((row, i) => {
              const total = calculateTotal(row, currentWeekNumber);
              const currentWeekValue = row.weeks[`W${prevWeek}`] || 0;
              const pctRaw = calculatePercentage(total, row.target);
              const pct = Number(pctRaw);
              const canRemove =
                canEdit &&
                onRemoveTeam &&
                isRemovableTeam(selectedYear, row.team);

              return (
                <tr
                  key={row.team || i}
                  className="transition-all duration-200 hover:bg-indigo-50/50 dark:hover:bg-slate-800/60"
                >
                  <td className="whitespace-nowrap px-2 py-1 md:px-3 md:py-2">
                    <div className="flex max-w-[14rem] items-center gap-1">
                      <span className="inline-flex min-w-0 flex-1 items-center rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-800 dark:from-indigo-900/60 dark:to-purple-900/50 dark:text-indigo-200 md:px-2 md:text-[11px]">
                        <span className="truncate">{row.team}</span>
                      </span>
                      {canRemove ? (
                        <button
                          type="button"
                          onClick={() => onRemoveTeam(i)}
                          className="shrink-0 rounded p-0.5 text-[11px] font-bold leading-none text-red-600 hover:bg-red-50 hover:text-red-700"
                          title="Xóa team (chỉ team thêm — bấm Lưu)"
                          aria-label={`Xóa team ${row.team}`}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-1 text-center md:px-3 md:py-2">
                    <input
                      type="number"
                      value={row.target}
                      onChange={(e) =>
                        onChangeCell(i, "target", e.target.value)
                      }
                      disabled={!canEdit}
                      title={
                        !canEdit ? "Chỉ admin mới chỉnh sửa được" : undefined
                      }
                      className={INPUT_CLASS}
                    />
                  </td>
                  <td className="px-2 py-1 text-center md:px-3 md:py-2">
                    <div className="mx-auto w-12 rounded bg-purple-50 px-1 py-0.5 text-center text-[10px] font-bold text-purple-600 dark:bg-purple-950/50 dark:text-purple-300 md:w-16 md:px-2 md:py-1 md:text-xs">
                      {total}
                    </div>
                  </td>
                  <td className="px-2 py-1 text-center md:px-3 md:py-2">
                    <div className="inline-flex items-center gap-1">
                      <div
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold md:px-2 md:py-1 md:text-[11px] ${
                          pct >= 100
                            ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-sm"
                            : pct >= 75
                              ? "bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-sm"
                              : "bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-sm"
                        }`}
                      >
                        {pctRaw}%
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1 text-center md:px-3 md:py-2">
                    <input
                      type="number"
                      value={currentWeekValue}
                      onChange={(e) =>
                        onChangeCell(i, `W${prevWeek}`, e.target.value)
                      }
                      disabled={!canEdit}
                      title={
                        !canEdit ? "Chỉ admin mới chỉnh sửa được" : undefined
                      }
                      className={INPUT_WEEK_CLASS}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PerformanceBarChartCard({
  cardRef,
  chartRef,
  chartRows,
  onDownloadPng,
  onDownloadSvg,
}) {
  return (
    <div
      ref={cardRef}
      className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-pink-500 to-rose-600 px-2 py-2 md:px-4">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-white md:text-sm">
          <span>📈</span>
          <span className="hidden sm:inline">성과 비교 차트</span>
          <span className="sm:hidden">차트</span>
        </h3>
        <div className="flex items-center gap-1 md:gap-2">
          <button
            type="button"
            onClick={onDownloadPng}
            data-no-export="true"
            className="rounded border border-white/30 bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold text-white/90 transition hover:bg-white/30 hover:text-white md:px-2 md:py-1 md:text-[11px]"
            title="Tải ảnh PNG"
          >
            <span className="hidden sm:inline">⬇️ PNG</span>
            <span className="sm:hidden">PNG</span>
          </button>
          <button
            type="button"
            onClick={onDownloadSvg}
            data-no-export="true"
            className="rounded border border-white/30 bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold text-white/90 transition hover:bg-white/30 hover:text-white md:px-2 md:py-1 md:text-[11px]"
            title="Tải ảnh SVG"
          >
            <span className="hidden sm:inline">⬇️ SVG</span>
            <span className="sm:hidden">SVG</span>
          </button>
        </div>
      </div>

      <div
        ref={chartRef}
        className="h-64 rounded-lg bg-gradient-to-br from-slate-50 to-indigo-50 p-2 dark:from-slate-900 dark:to-slate-800 md:h-96 md:p-4"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartRows}
            margin={{ top: 20, right: 10, left: 10, bottom: 20 }}
            barGap={4}
            barCategoryGap={10}
          >
            <defs>
              <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.9} />
              </linearGradient>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.9} />
              </linearGradient>
              <linearGradient id="colorPercentage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9} />
                <stop offset="95%" stopColor="#d97706" stopOpacity={0.9} />
              </linearGradient>
              <linearGradient id="colorWeek" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ec4899" stopOpacity={0.9} />
                <stop offset="95%" stopColor="#db2777" stopOpacity={0.9} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="team"
              tick={{ fill: "#1e293b", fontSize: 12, fontWeight: 700 }}
              axisLine={{ stroke: "#cbd5e1" }}
            />
            <YAxis
              tick={{ fill: "#1e293b", fontSize: 12, fontWeight: 700 }}
              axisLine={{ stroke: "#cbd5e1" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                padding: "8px",
              }}
              labelStyle={{
                fontWeight: "bold",
                color: "#1e293b",
                marginBottom: "4px",
                fontSize: "11px",
              }}
              itemStyle={{ padding: "2px 0", fontSize: "10px" }}
            />
            <Legend
              wrapperStyle={{
                paddingTop: "8px",
                fontSize: "10px",
                fontWeight: 600,
              }}
              iconType="circle"
            />
            <Bar
              dataKey="target"
              fill="url(#colorTarget)"
              name="Target"
              radius={[8, 8, 0, 0]}
              maxBarSize={50}
            >
              <LabelList
                dataKey="target"
                position="top"
                style={{
                  fill: "#059669",
                  fontWeight: "bold",
                  fontSize: 12,
                }}
              />
            </Bar>
            <Bar
              dataKey="total"
              fill="url(#colorTotal)"
              name="Total"
              radius={[8, 8, 0, 0]}
              maxBarSize={50}
            >
              <LabelList
                dataKey="total"
                position="top"
                style={{
                  fill: "#4f46e5",
                  fontWeight: "bold",
                  fontSize: 12,
                }}
              />
            </Bar>
            <Bar
              dataKey="percentage"
              fill="url(#colorPercentage)"
              name="Achievement Rate"
              radius={[8, 8, 0, 0]}
              maxBarSize={50}
            >
              <LabelList
                dataKey="percentage"
                position="top"
                formatter={(value) => `${value}%`}
                style={{
                  fill: "#d97706",
                  fontWeight: "bold",
                  fontSize: 12,
                }}
              />
            </Bar>
            <Bar
              dataKey="currentWeek"
              fill="url(#colorWeek)"
              name="Current Week"
              radius={[8, 8, 0, 0]}
              maxBarSize={50}
            >
              <LabelList
                dataKey="currentWeek"
                position="top"
                style={{
                  fill: "#db2777",
                  fontWeight: "bold",
                  fontSize: 12,
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function buildChartRows(data, currentWeekNumber) {
  return data.map((row) => {
    const total = calculateTotal(row, currentWeekNumber);
    const currentWeekValue = row.weeks[`W${currentWeekNumber - 1}`] || 0;
    return {
      team: row.team,
      target: row.target,
      total,
      currentWeek: currentWeekValue,
      percentage: parseFloat(calculatePercentage(total, row.target)),
    };
  });
}
