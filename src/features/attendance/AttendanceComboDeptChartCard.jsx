import React, { memo } from "react";
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
import { COMBO_CHART_METRIC_KEYS } from "./attendanceComboChartConfig";
import {
  getAttendanceLeaveTypeBadgeClassNameForComboStatKey,
  getAttendanceComboBarFillForMetricKey,
} from "./attendanceGioVaoTypeOptions";

function AttendanceComboDeptChartCard({
  row,
  comboDashboardGroup,
  getComboProductionDeptChartRank,
  activeComboMetricKeys,
  comboStatLabelByKey,
  tl,
  onOpenDeptAttendance,
}) {
  return (
    <div className="rounded-xl border border-slate-300/85 bg-slate-80 p-1 transition dark:border-slate-700/90 dark:bg-slate-900/90">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/90 pb-1.5 dark:border-slate-700/80">
        <h4 className="min-w-0 flex flex-1 items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-50">
          {comboDashboardGroup === "production" &&
          typeof getComboProductionDeptChartRank === "function" &&
          getComboProductionDeptChartRank(row.department) != null ? (
            <span
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500 text-[10px] font-black text-white"
              title={tl(
                "comboProductionDeptRankHint",
                "Thứ tự BP sản xuất đã chọn",
              )}
            >
              {getComboProductionDeptChartRank(row.department)}
            </span>
          ) : null}
          <span className="min-w-0 truncate">{row.department}</span>
        </h4>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-black dark:bg-slate-800 dark:text-slate-300">
            {tl("totalEmployees", "Tổng số nhân viên")}: {row.total}
          </span>
          {row.total > 0 ? (
            <button
              type="button"
              onClick={() => onOpenDeptAttendance?.(row.department)}
              className="rounded border border-sky-500/70 bg-sky-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white transition hover:bg-sky-700 dark:border-sky-400/60 dark:bg-sky-700 dark:hover:bg-sky-600"
            >
              {tl("comboDeptAttendanceDetail", "Xem chi tiết")}
            </button>
          ) : null}
        </div>
      </div>
      <div className="mb-1.5 flex flex-wrap gap-1 text-[10px]">
        {activeComboMetricKeys.map((k) => {
          const n = row[k];
          if (!n || n <= 0) return null;
          const lab =
            k === "nonStandardTimeIn"
              ? tl("nonStandardTimeInShort", "≠ HH:MM")
              : (comboStatLabelByKey[k] ?? k);
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
      <div className="mx-auto h-[180px] w-full sm:h-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={[row]}
            margin={{ top: 8, right: 10, left: 6, bottom: 18 }}
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
            <Tooltip
              formatter={(value, name) => {
                if (name === "total") {
                  return [value, tl("totalEmployees", "Tổng số nhân viên")];
                }
                if (COMBO_CHART_METRIC_KEYS.includes(name)) {
                  return [value, comboStatLabelByKey[name] ?? name];
                }
                return [value, name];
              }}
            />
            {activeComboMetricKeys.map((dataKey) =>
              row[dataKey] > 0 ? (
                <Bar
                  key={dataKey}
                  yAxisId="left"
                  dataKey={dataKey}
                  barSize={45}
                  fill={getAttendanceComboBarFillForMetricKey(dataKey)}
                  radius={[4, 4, 0, 0]}
                />
              ) : null,
            )}
            {row.total > 0 ? (
              <Line
                yAxisId="left"
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
  );
}

export default memo(AttendanceComboDeptChartCard);
