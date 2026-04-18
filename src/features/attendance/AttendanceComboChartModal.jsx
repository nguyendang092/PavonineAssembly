import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { CHART_DRAG_MIME } from "@/utils/chartOrderStorage";
import {
  COMBO_DASHBOARD_TILES,
  COMBO_BAR_SERIES,
  COMBO_CHART_METRIC_KEYS,
  COMBO_STAT_LABEL_DEFAULTS,
} from "./attendanceComboChartConfig";
import {
  getAttendanceLeaveTypeBadgeClassNameForComboStatKey,
  getAttendanceLeaveTypeColorClassNameForComboStatKey,
  getAttendanceComboBarFillForMetricKey,
} from "./attendanceGioVaoTypeOptions";

export default function AttendanceComboChartModal({
  open,
  onClose,
  tl,
  t,
  comboDashboardStats,
  comboChartData,
  comboChartBodyReady,
  comboChartRowsVisible,
  comboDragOverDept,
  setComboDragOverDept,
  handleComboDeptReorder,
  comboChartCardsVisibleCount,
  comboChartDataOrdered,
  comboStatDetailKey,
  setComboStatDetailKey,
  comboStatLabelByKey,
  comboStatEmployeesByKey,
}) {
  if (!open) return null;
  return (
  <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4">
    <div className="relative flex h-[94vh] w-[min(98vw,1680px)] max-w-none flex-col overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-100 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-300/80 bg-gradient-to-b from-slate-200/95 to-slate-100 px-4 pb-3 pt-4 dark:border-slate-800 dark:from-slate-950 dark:to-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-400">
              {tl("comboChartBadge", "Attendance Dashboard")}
            </p>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 sm:text-xl">
              {tl(
                "comboChartTitle",
                "Thống kê toàn bộ nhân viên theo bộ phận",
              )}
            </h3>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {tl(
                "comboChartHint",
                "Cột: đủ loại chọn ở Giờ vào (điểm danh, Có đi làm, phép, Thai sản, Phép cưới, Dưỡng sức, …) + Giờ vào ≠ HH:MM + Ca đêm • Đường: Tổng nhân viên",
              )}
            </p>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              {tl(
                "comboChartDragHint",
                "Kéo thanh tiêu đề (⋮⋮) để đổi thứ tự biểu đồ — lưu theo tài khoản trên Firebase (đồng bộ mọi máy).",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-300/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={t("attendanceList.close")}
          >
            ✕
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {comboDashboardStats.total > 0 ? (
            <button
              type="button"
              onClick={() => setComboStatDetailKey("total")}
              className="min-w-[calc(50%-0.25rem)] flex-1 basis-[140px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[120px] sm:max-w-[200px] dark:border-slate-700/90 dark:bg-slate-900/95"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {tl("totalEmployees", "Tổng số nhân viên")}
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-slate-50">
                {comboDashboardStats.total}
              </p>
            </button>
          ) : null}
          {COMBO_DASHBOARD_TILES.map((tile) => {
            const v = comboDashboardStats[tile.key];
            if (!v || v <= 0) return null;
            const label = tl(
              tile.tlKey,
              COMBO_STAT_LABEL_DEFAULTS[tile.key],
            );
            const baseBtn =
              "min-w-[calc(50%-0.25rem)] flex-1 basis-[140px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[120px] sm:max-w-[200px] dark:border-slate-700/90 dark:bg-slate-900/95";
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => setComboStatDetailKey(tile.key)}
                className={`${baseBtn} hover:ring-2 hover:ring-sky-500/35`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  {label}
                </p>
                <p
                  className={`text-base font-bold ${getAttendanceLeaveTypeColorClassNameForComboStatKey(tile.key)}`}
                >
                  {v}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-200/35 p-3 dark:bg-black/35 sm:p-5">
        {comboChartData.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-600 dark:text-slate-400">
            {tl("noData", "Không có dữ liệu")}
          </div>
        ) : !comboChartBodyReady ||
          (comboChartRowsVisible.length === 0 &&
            comboChartData.length > 0) ? (
          <div
            className="flex min-h-0 flex-1 flex-col"
            aria-busy="true"
            aria-live="polite"
          >
            <p className="mb-3 text-center text-xs text-slate-500 dark:text-slate-400">
              {tl(
                "comboChartLoading",
                "Đang tải biểu đồ theo bộ phận…",
              )}
            </p>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`combo-skel-${i}`}
                  className="animate-pulse rounded-xl border border-slate-300/60 bg-slate-100/90 p-3 dark:border-slate-700/80 dark:bg-slate-900/80"
                >
                  <div className="mb-2 h-3 w-2/3 rounded bg-slate-300 dark:bg-slate-600" />
                  <div className="mb-3 flex gap-1">
                    <div className="h-6 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-6 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-6 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                  <div className="h-[210px] rounded-lg bg-slate-200/80 dark:bg-slate-800/80 sm:h-[220px]" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 transition-opacity duration-200">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {comboChartRowsVisible.map((row) => (
                <div
                  key={row.department}
                  className={`rounded-xl border border-slate-300/85 bg-slate-80 p-2 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition dark:border-slate-700/90 dark:bg-slate-900/90 ${
                    comboDragOverDept === row.department
                      ? "ring-2 ring-sky-400 ring-offset-1 dark:ring-offset-slate-900"
                      : ""
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setComboDragOverDept(row.department);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      setComboDragOverDept((d) =>
                        d === row.department ? null : d,
                      );
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = e.dataTransfer.getData(
                      CHART_DRAG_MIME,
                    );
                    setComboDragOverDept(null);
                    if (from)
                      handleComboDeptReorder(from, row.department);
                  }}
                >
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        CHART_DRAG_MIME,
                        row.department,
                      );
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setComboDragOverDept(null)}
                    className="mb-1 flex cursor-grab items-center justify-between gap-2 border-b border-slate-200/90 pb-1.5 active:cursor-grabbing dark:border-slate-700/80"
                  >
                    <span
                      className="shrink-0 select-none text-slate-400"
                      aria-hidden
                      title={tl(
                        "comboChartDragHandle",
                        "Kéo để sắp xếp",
                      )}
                    >
                      ⋮⋮
                    </span>
                    <h4 className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-50">
                      {row.department}
                    </h4>
                    <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-black dark:bg-slate-800 dark:text-slate-300">
                      {tl("totalEmployees", "Tổng")}: {row.total}
                    </span>
                  </div>
                  <div className="mb-1.5 flex flex-wrap gap-1 text-[10px]">
                    {COMBO_CHART_METRIC_KEYS.map((k) => {
                      const n = row[k];
                      if (!n || n <= 0) return null;
                      const lab =
                        k === "nonStandardTimeIn"
                          ? tl("nonStandardTimeInShort", "≠ HH:MM")
                          : k === "resignedLeave"
                            ? tl(
                                "resigned",
                                COMBO_STAT_LABEL_DEFAULTS[k],
                              )
                            : tl(k, COMBO_STAT_LABEL_DEFAULTS[k]);
                      return (
                        <span
                          key={k}
                          className={`rounded border px-1.5 py-1 font-semibold uppercase ${getAttendanceLeaveTypeBadgeClassNameForComboStatKey(k)}`}
                        >
                          {lab}: {n}
                        </span>
                      );
                    })}
                  </div>
                  <div className="h-[210px] w-full sm:h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={[row]}
                        margin={{
                          top: 8,
                          right: 10,
                          left: 6,
                          bottom: 18,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#64748b"
                          strokeOpacity={0.35}
                        />
                        <XAxis dataKey="department" hide />
                        <YAxis
                          yAxisId="left"
                          allowDecimals={false}
                          width={22}
                          tick={{ fill: "#94a3b8", fontSize: 10 }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          allowDecimals={false}
                          width={22}
                          tick={{ fill: "#94a3b8", fontSize: 10 }}
                        />
                        <Tooltip
                          formatter={(value, name) => {
                            if (name === "total")
                              return [
                                value,
                                tl(
                                  "totalEmployees",
                                  "Tổng số nhân viên",
                                ),
                              ];
                            if (
                              Object.prototype.hasOwnProperty.call(
                                COMBO_STAT_LABEL_DEFAULTS,
                                name,
                              )
                            ) {
                              const label =
                                name === "resignedLeave"
                                  ? tl(
                                      "resigned",
                                      COMBO_STAT_LABEL_DEFAULTS[name],
                                    )
                                  : tl(
                                      name,
                                      COMBO_STAT_LABEL_DEFAULTS[name],
                                    );
                              return [value, label];
                            }
                            return [value, name];
                          }}
                        />
                        {COMBO_BAR_SERIES.map(({ dataKey }) =>
                          row[dataKey] > 0 ? (
                            <Bar
                              key={dataKey}
                              yAxisId="left"
                              dataKey={dataKey}
                              fill={getAttendanceComboBarFillForMetricKey(dataKey)}
                              radius={[4, 4, 0, 0]}
                            />
                          ) : null,
                        )}
                        {row.total > 0 ? (
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="total"
                            stroke="#7c3aed"
                            strokeWidth={2.25}
                            dot={{ r: 3 }}
                          />
                        ) : null}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
            {comboChartCardsVisibleCount <
            comboChartDataOrdered.length ? (
              <div className="flex justify-center py-3 text-xs text-slate-500 dark:text-slate-400">
                {tl("comboChartLoadingMore", "Đang tải thêm biểu đồ…")}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {comboStatDetailKey && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="combo-stat-detail-title"
          className="absolute inset-0 z-[1300] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
          onClick={() => setComboStatDetailKey(null)}
        >
          <div
            className="flex max-h-[min(82vh,820px)] w-full max-w-[min(100%,42rem)] flex-col overflow-hidden rounded-xl border-2 border-sky-400/60 bg-white shadow-[0_20px_40px_-12px_rgba(14,165,233,0.22)] ring-2 ring-sky-200/50 dark:border-sky-500/40 dark:bg-slate-900 dark:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.55)] dark:ring-sky-900/50 sm:max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 bg-gradient-to-r from-sky-600 via-sky-500 to-teal-500 px-3 py-2.5 shadow-md sm:px-4 sm:py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase leading-none tracking-[0.12em] text-sky-100/95 text-black">
                  {tl("comboStatDetailBadge", "Chi tiết danh sách")}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h4
                    id="combo-stat-detail-title"
                    className="text-base font-extrabold leading-tight text-white drop-shadow-sm sm:text-[1.05rem]"
                  >
                    {comboStatLabelByKey[comboStatDetailKey] ?? ""}
                  </h4>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/35">
                    {tl("peopleCount", "{{count}} người", {
                      count:
                        comboStatEmployeesByKey[comboStatDetailKey]
                          ?.length ?? 0,
                    })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setComboStatDetailKey(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-base leading-none text-white ring-1 ring-white/40 transition hover:bg-white/25 sm:h-9 sm:w-9 sm:text-lg"
                aria-label={t("attendanceList.close")}
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-sky-50/90 to-emerald-50/40 px-2 py-3 sm:px-4 dark:from-slate-950 dark:to-slate-900">
              <div className="overflow-hidden rounded-xl border-2 border-sky-200/80 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900">
                <div className="max-h-[min(52vh,480px)] overflow-auto sm:max-h-[min(56vh,520px)]">
                  <table className="w-full min-w-[560px] border-collapse text-left text-[15px] leading-snug">
                    <thead className="sticky top-0 z-10 shadow-md">
                      <tr className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white">
                        <th className="w-14 whitespace-nowrap px-2 py-3.5 text-center text-xs font-extrabold uppercase tracking-wider text-white">
                          {tl("colIndex", "STT")}
                        </th>
                        <th className="whitespace-nowrap px-3 py-3.5 text-xs font-extrabold uppercase tracking-wider text-white">
                          {tl("colCode", "MNV")}
                        </th>
                        <th className="min-w-[150px] px-3 py-3.5 text-xs font-extrabold uppercase tracking-wider text-white">
                          {tl("colName", "Họ và tên")}
                        </th>
                        <th className="min-w-[120px] px-3 py-3.5 text-xs font-extrabold uppercase tracking-wider text-white">
                          {tl("colDepartment", "Bộ phận")}
                        </th>
                        <th className="whitespace-nowrap px-3 py-3.5 text-center text-xs font-extrabold uppercase tracking-wider text-amber-100">
                          {tl("colTimeIn", "Giờ vào")}
                        </th>
                        <th className="min-w-[100px] px-3 py-3.5 text-xs font-extrabold uppercase tracking-wider text-emerald-100">
                          {tl("comboStatColShift", "Ca làm việc")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100 dark:divide-slate-700">
                      {(
                        comboStatEmployeesByKey[comboStatDetailKey] ??
                        []
                      ).length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="bg-amber-50/80 px-4 py-14 text-center text-base font-medium text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                          >
                            {tl("noData", "Không có dữ liệu")}
                          </td>
                        </tr>
                      ) : (
                        (
                          comboStatEmployeesByKey[comboStatDetailKey] ??
                          []
                        ).map((emp, idx) => (
                          <tr
                            key={emp.id ?? `${emp.mnv}-${idx}`}
                            className="odd:bg-white even:bg-sky-50/90 transition-colors hover:bg-amber-50/80 dark:odd:bg-slate-900 dark:even:bg-slate-800/90 dark:hover:bg-slate-700/80"
                          >
                            <td className="bg-sky-100/50 px-2 py-3 text-center text-base font-bold tabular-nums text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-3">
                              <span className="inline-block rounded-md bg-indigo-100 px-2 py-0.5 font-mono text-sm font-bold tabular-nums text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-200">
                                {emp.mnv ?? ""}
                              </span>
                            </td>
                            <td className="max-w-[220px] truncate px-3 py-3 text-base font-bold text-slate-900 dark:text-white sm:max-w-none">
                              {emp.hoVaTen ?? ""}
                            </td>
                            <td className="max-w-[180px] truncate px-3 py-3 text-base font-medium text-violet-900 dark:text-violet-200 sm:max-w-none">
                              {emp.boPhan ?? ""}
                            </td>
                            <td className="whitespace-nowrap bg-emerald-50/70 px-3 py-3 text-center font-mono text-base font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                              {emp.gioVao ?? ""}
                            </td>
                            <td className="bg-amber-50/60 px-3 py-3 text-base font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                              {emp.caLamViec ?? ""}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
