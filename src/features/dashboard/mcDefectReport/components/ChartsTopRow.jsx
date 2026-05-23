import React, { memo, useCallback, useMemo } from "react";
import {
  Bar,
  BarChart,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MC_DEFECT_CHART_PRIMARY,
  MC_DEFECT_CHART_TEXT,
  MC_DEFECT_CHART_TOOLTIP_PROPS,
  MC_DEFECT_LINE_CHART_HEIGHT_PX,
} from "../lib/constants";
import {
  formatMcDefectChartDayMonth,
  formatMcDefectEmployeeAxisLabel,
} from "../lib/dataAggregations";

function MCDefectReportTopChartsSection({
  byEmployeeData,
  topEmployeeYAxisWidth,
  byDateData,
  chartByDatePeriodLabel,
  dailyAverage,
}) {
  const employeeBarMargin = useMemo(
    () => ({ top: 6, right: 8, left: 6, bottom: 3 }),
    [],
  );

  const employeeAxisTick = useCallback(
    ({ x, y, payload }) => (
      <text
        x={x - topEmployeeYAxisWidth + 4}
        y={y}
        dy={4}
        textAnchor="start"
        fill={MC_DEFECT_CHART_TEXT}
        fontSize={10}
        fontWeight={600}
      >
        {formatMcDefectEmployeeAxisLabel(payload.value)}
      </text>
    ),
    [topEmployeeYAxisWidth],
  );

  const employeeTooltipFormatter = useCallback(
    (value) => [`${value}`, "Số lỗi"],
    [],
  );
  const employeeTooltipLabelFormatter = useCallback(
    (label) => `Nhân viên: ${label}`,
    [],
  );

  const dateTooltipLabelFormatter = useCallback(
    (label) => `Ngày: ${String(label || "").trim()}`,
    [],
  );

  const referenceLineLabel = useMemo(
    () => ({
      value: "Trung bình",
      position: "insideTopRight",
      fill: MC_DEFECT_CHART_TEXT,
    }),
    [],
  );

  const lineDotStyle = useMemo(
    () => ({ r: 4, fill: MC_DEFECT_CHART_PRIMARY }),
    [],
  );

  const lineLabelStyle = useMemo(
    () => ({
      position: "top",
      fill: MC_DEFECT_CHART_TEXT,
      fontSize: 16,
      fontWeight: 700,
    }),
    [],
  );

  const axisTickStyle = useMemo(
    () => ({ fontSize: 10, fill: MC_DEFECT_CHART_TEXT }),
    [],
  );

  const tooltipCursor = useMemo(
    () => ({ fill: "rgba(15, 23, 42, 0.06)" }),
    [],
  );

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-900 xl:col-span-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-black">
          Top nhân viên lỗi cao
        </h3>
        <div style={{ height: MC_DEFECT_LINE_CHART_HEIGHT_PX }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={byEmployeeData}
              layout="vertical"
              margin={employeeBarMargin}
            >
              <XAxis
                type="number"
                allowDecimals={false}
                tick={axisTickStyle}
              />
              <YAxis
                type="category"
                dataKey="employee"
                width={topEmployeeYAxisWidth}
                interval={0}
                axisLine={false}
                tickLine={false}
                tick={employeeAxisTick}
              />
              <Tooltip
                {...MC_DEFECT_CHART_TOOLTIP_PROPS}
                cursor={tooltipCursor}
                formatter={employeeTooltipFormatter}
                labelFormatter={employeeTooltipLabelFormatter}
              />
              <Bar
                dataKey="errorCount"
                name="Số lỗi"
                fill={MC_DEFECT_CHART_PRIMARY}
                radius={[0, 8, 8, 0]}
                barSize={16}
              >
                <LabelList
                  dataKey="errorCount"
                  position="right"
                  fill={MC_DEFECT_CHART_TEXT}
                  fontSize={11}
                  fontWeight={700}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-7 xl:col-start-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-black">
            Biểu đổ tổng số lỗi theo ngày
          </h3>
          {chartByDatePeriodLabel ? (
            <span
              className="rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-bold text-black"
              title="Trục ngang hiển thị ngày/tháng (dd/mm)"
            >
              {chartByDatePeriodLabel}
            </span>
          ) : null}
        </div>
        <div style={{ height: MC_DEFECT_LINE_CHART_HEIGHT_PX }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byDateData}>
              <XAxis
                dataKey="date"
                tickFormatter={formatMcDefectChartDayMonth}
                tick={axisTickStyle}
              />
              <YAxis allowDecimals={false} tick={axisTickStyle} />
              <Tooltip
                {...MC_DEFECT_CHART_TOOLTIP_PROPS}
                labelFormatter={dateTooltipLabelFormatter}
              />
              <ReferenceLine
                y={dailyAverage}
                stroke="#16a34a"
                strokeDasharray="4 4"
                label={referenceLineLabel}
              />
              <Line
                type="monotone"
                dataKey="errorCount"
                stroke={MC_DEFECT_CHART_PRIMARY}
                strokeWidth={2.5}
                dot={lineDotStyle}
                label={lineLabelStyle}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

export default memo(MCDefectReportTopChartsSection);
