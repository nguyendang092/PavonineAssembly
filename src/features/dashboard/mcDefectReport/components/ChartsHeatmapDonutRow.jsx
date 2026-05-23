import React, { memo, useCallback } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { MC_DEFECT_CHART_TOOLTIP_PROPS } from "../lib/constants";
import { renderMcDefectErrorTypePieLabel } from "../lib/pieChartLabel";
import {
  formatMcDefectPercent,
  heatColor,
  mcDefectErrorTypeColor,
} from "../lib/dataAggregations";

function MCDefectReportHeatmapDonutSection({
  heatmapData,
  donutByErrorTypeData,
  donutPlotHeightPx,
  donutRadii,
}) {
  const pieTooltipFormatter = useCallback((value, _name, item) => {
    const pct = item?.payload?.percent ?? 0;
    return [`${value} (${formatMcDefectPercent(pct)})`, "Số lỗi"];
  }, []);

  const pieTooltipLabelFormatter = useCallback(
    (label) => `Loại lỗi: ${label}`,
    [],
  );

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-8">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-black">
          Lỗi theo ngày
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-slate-200 px-2 py-1 text-left dark:border-slate-700">
                  Nhân viên
                </th>
                {heatmapData.days.map((d) => (
                  <th
                    key={d}
                    className="border border-slate-200 px-2 py-1 dark:border-slate-700"
                  >
                    {d.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.employees.map((emp) => (
                <tr key={emp}>
                  <td className="border border-slate-200 px-2 py-1 font-semibold dark:border-slate-700">
                    {emp}
                  </td>
                  {heatmapData.days.map((d) => {
                    const val = Number(
                      heatmapData.map.get(`${emp}__${d}`) || 0,
                    );
                    return (
                      <td
                        key={`${emp}-${d}`}
                        className="border border-slate-200 px-2 py-1 text-center font-bold dark:border-slate-700"
                        style={{ backgroundColor: heatColor(val) }}
                      >
                        {val || ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-black">
          Phân bổ lỗi theo loại lỗi
        </h3>
        <div
          className="flex flex-col gap-3 sm:flex-row sm:items-stretch"
          style={{ minHeight: donutPlotHeightPx }}
        >
          <div
            className="relative w-full shrink-0 sm:w-[46%]"
            style={{ height: donutPlotHeightPx }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutByErrorTypeData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={donutRadii.inner}
                  outerRadius={donutRadii.outer}
                  label={renderMcDefectErrorTypePieLabel}
                  labelLine={false}
                >
                  {donutByErrorTypeData.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={mcDefectErrorTypeColor(index)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  {...MC_DEFECT_CHART_TOOLTIP_PROPS}
                  formatter={pieTooltipFormatter}
                  labelFormatter={pieTooltipLabelFormatter}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div
            className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 overflow-y-auto px-1 pr-3 text-xs text-black sm:max-h-none sm:pl-2"
            style={{ maxHeight: donutPlotHeightPx }}
          >
            {donutByErrorTypeData.map((item, index) => (
              <div
                key={item.name}
                className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1 last:border-0 last:pb-0"
              >
                <span className="inline-flex min-w-0 flex-1 items-start gap-2 leading-tight">
                  <span
                    className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: mcDefectErrorTypeColor(index),
                    }}
                  />
                  <span className="break-words font-medium">{item.name}</span>
                </span>
                <span className="shrink-0 text-right font-bold tabular-nums">
                  {item.value}{" "}
                  <span className="block text-[10px] font-semibold text-slate-600">
                    {formatMcDefectPercent(item.percent)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(MCDefectReportHeatmapDonutSection);
