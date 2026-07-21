import React, { useCallback, useMemo } from "react";
import Modal from "react-modal";
import { useTranslation } from "react-i18next";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import S90dKpiCards from "./S90dKpiCards";
import { S90D_DEFECT_COLUMNS, S90D_PROCESSES } from "../lib/s90dDefectColumns";
import {
  buildS90dChartKpiSummary,
  buildS90dDailyDefectSummary,
  buildS90dDailyKpiSummary,
  buildS90dDailyProcessStackData,
  buildS90dDailyTrendChartData,
  buildS90dDefectByProcessData,
  buildS90dOkNgPieData,
  buildS90dTopDefectChartData,
  buildS90dTotalProcessChartData,
  buildS90dYieldComparisonData,
  computeAverageYield,
} from "../lib/s90dChartData";
import {
  formatS90dChartPct,
  formatS90dChartQty,
  resolveS90dChartLocale,
  S90D_CHART,
} from "../lib/s90dChartTheme";

Modal.setAppElement("#root");

function S90dChartPanel({ title, subtitle, children, wide = false, className = "" }) {
  return (
    <section
      className={`s90d-chart-panel${wide ? " s90d-chart-panel--wide" : ""}${className ? ` ${className}` : ""}`}
    >
      <header className="s90d-chart-panel-head">
        <h3 className="s90d-chart-panel-title">{title}</h3>
        {subtitle ? (
          <p className="s90d-chart-panel-subtitle">{subtitle}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function S90dRichTooltip({ active, payload, label, locale, pctKeys = [] }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="s90d-chart-tooltip s90d-chart-tooltip--rich">
      <div className="s90d-chart-tooltip-title">{label}</div>
      <div className="s90d-chart-tooltip-rows">
        {payload.map((entry) => {
          const isPct = pctKeys.includes(entry.dataKey);
          const value = isPct
            ? formatS90dChartPct(entry.value, locale)
            : formatS90dChartQty(entry.value, locale);
          return (
            <div key={`${entry.dataKey}-${entry.name}`} className="s90d-chart-tooltip-row">
              <span
                className="s90d-chart-tooltip-dot"
                style={{ background: entry.color || entry.payload?.fill }}
              />
              <span className="s90d-chart-tooltip-name">{entry.name}</span>
              <strong className="s90d-chart-tooltip-value">{value}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function S90dPieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}) {
  if (!percent || percent <= 0) return null;

  const pctText = `${(percent * 100).toFixed(1)}%`;
  const isSmallSlice = percent < 0.06;
  const radius = isSmallSlice
    ? outerRadius + 14
    : innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

  return (
    <text
      x={x}
      y={y}
      fill="#0f172a"
      textAnchor={isSmallSlice ? (x > cx ? "start" : "end") : "middle"}
      dominantBaseline="central"
      fontSize={isSmallSlice ? 11 : 12}
      fontWeight={800}
    >
      {pctText}
    </text>
  );
}

function S90dChartLegend({ items }) {
  return (
    <div className="s90d-chart-legend">
      {items.map((item) => (
        <span key={item.key} className="s90d-chart-legend-item">
          <span
            className="s90d-chart-legend-dot"
            style={{ background: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function S90dDefectBarLabel({ x, y, width, height, value, index, data, locale }) {
  if (!value) return null;
  const pct = data?.[index]?.pct ?? 0;
  return (
    <text
      x={(x ?? 0) + (width ?? 0) + 8}
      y={(y ?? 0) + (height ?? 0) / 2}
      fill={S90D_CHART.text}
      fontSize={10}
      fontWeight={700}
      dominantBaseline="middle"
    >
      {`${formatS90dChartQty(value, locale)} · ${formatS90dChartPct(pct, locale)}`}
    </text>
  );
}

export default function S90dSummaryChartModal({
  isOpen,
  onClose,
  variant = "total",
  grandTotalSummary,
  monthDailySummaries = [],
  monthDisplayLabel = "",
}) {
  const { t, i18n } = useTranslation();
  const isDaily = variant === "daily";
  const locale = resolveS90dChartLocale(i18n.language);
  const displayLocale = i18n.language?.startsWith("ko") ? "ko" : "vi";

  const processLabelFn = useCallback(
    (process) => t(`areas.${process}`, { defaultValue: process }),
    [t],
  );

  const defectLabelFn = useCallback(
    (key) => {
      const column = S90D_DEFECT_COLUMNS.find((item) => item.key === key);
      if (!column) return key;
      return displayLocale === "ko" ? column.ko : column.vi;
    },
    [displayLocale],
  );

  const totalSummary = useMemo(() => {
    if (!isDaily) {
      const activeProcesses = (grandTotalSummary?.processRows ?? []).filter(
        (row) => row.totalQty > 0,
      ).length;
      return {
        ...buildS90dChartKpiSummary(grandTotalSummary),
        activeProcesses,
        activeDays: monthDailySummaries.filter((daily) => daily.hasData).length,
      };
    }
    return buildS90dDailyKpiSummary(monthDailySummaries);
  }, [grandTotalSummary, isDaily, monthDailySummaries]);

  const summaryForCharts = useMemo(() => {
    if (!isDaily) return grandTotalSummary;
    return buildS90dDailyDefectSummary(monthDailySummaries);
  }, [grandTotalSummary, isDaily, monthDailySummaries]);

  const processChartData = useMemo(
    () => buildS90dTotalProcessChartData(grandTotalSummary, processLabelFn),
    [grandTotalSummary, processLabelFn],
  );

  const yieldComparisonData = useMemo(
    () => buildS90dYieldComparisonData(grandTotalSummary, processLabelFn),
    [grandTotalSummary, processLabelFn],
  );

  const dailyTrendData = useMemo(
    () => buildS90dDailyTrendChartData(monthDailySummaries),
    [monthDailySummaries],
  );

  const dailyProcessStackData = useMemo(
    () => buildS90dDailyProcessStackData(monthDailySummaries, processLabelFn),
    [monthDailySummaries, processLabelFn],
  );

  const okNgPieData = useMemo(() => {
    const source = isDaily
      ? {
          totalRow: {
            okQty: totalSummary.okQty,
            ngQty: totalSummary.ngQty,
          },
        }
      : grandTotalSummary;
    return buildS90dOkNgPieData(source).map((row) => ({
      ...row,
      name:
        row.nameKey === "ok"
          ? t("s90dReport.kpiOkQty", "Số lượng đạt")
          : t("s90dReport.kpiNgQty", "Số lượng NG"),
      fill: row.nameKey === "ok" ? S90D_CHART.ok : S90D_CHART.ng,
    }));
  }, [grandTotalSummary, isDaily, t, totalSummary]);

  const defectChartData = useMemo(
    () => buildS90dTopDefectChartData(summaryForCharts, defectLabelFn, 12),
    [defectLabelFn, summaryForCharts],
  );

  const defectByProcess = useMemo(
    () =>
      buildS90dDefectByProcessData(
        grandTotalSummary,
        defectLabelFn,
        processLabelFn,
        5,
      ),
    [defectLabelFn, grandTotalSummary, processLabelFn],
  );

  const avgYield = useMemo(
    () =>
      computeAverageYield(isDaily ? dailyTrendData : processChartData),
    [dailyTrendData, isDaily, processChartData],
  );

  const kpiTotalRow = useMemo(
    () => ({
      totalQty: totalSummary.totalQty,
      okQty: totalSummary.okQty,
      ngQty: totalSummary.ngQty,
      yieldPct: totalSummary.yieldPct,
      ngRatePct: totalSummary.ngRatePct,
    }),
    [totalSummary],
  );

  const hasProcessData = processChartData.some((row) => row.totalQty > 0);
  const hasDailyData = dailyTrendData.length > 0;
  const hasDefectData = defectChartData.length > 0;
  const hasPieData = okNgPieData.length > 0;
  const hasAnyChart = isDaily
    ? hasDailyData || hasDefectData || hasPieData
    : hasProcessData || hasDefectData || hasPieData;

  const title = isDaily
    ? t("s90dReport.chartDailyTitle", "Biểu đồ theo ngày — {{month}}", {
        month: monthDisplayLabel,
      })
    : t("s90dReport.chartTotalTitle", "Biểu đồ tổng — {{month}}", {
        month: monthDisplayLabel,
      });

  const reportDate = useMemo(
    () =>
      new Date().toLocaleDateString(locale, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [locale],
  );

  const qtyLegend = [
    { key: "ok", color: S90D_CHART.ok, label: t("s90dReport.kpiOkQty", "Số lượng đạt") },
    { key: "ng", color: S90D_CHART.ng, label: t("s90dReport.kpiNgQty", "Số lượng NG") },
    {
      key: "yield",
      color: S90D_CHART.yield,
      label: t("s90dReport.kpiAvgYield", "Hiệu suất"),
    },
  ];

  const processLegend = S90D_PROCESSES.map((process) => ({
    key: process,
    color: S90D_CHART.process[process],
    label: processLabelFn(process),
  }));

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel={title}
      className="s90d-chart-modal"
      overlayClassName="s90d-chart-modal-overlay"
      bodyOpenClassName="s90d-chart-modal-open"
    >
      <header className="s90d-chart-modal-hero">
        <div className="s90d-chart-modal-hero-main">
          <span className="s90d-chart-modal-badge">
            {t("s90dReport.chartReportBadge", "Báo cáo S90D")}
          </span>
          <h2 className="s90d-chart-modal-title">{title}</h2>
          <p className="s90d-chart-modal-subtitle">
            {isDaily
              ? t(
                  "s90dReport.chartDailySubtitle",
                  "Xu hướng số lượng và lỗi theo từng ngày trong tháng",
                )
              : t(
                  "s90dReport.chartTotalSubtitle",
                  "So sánh số lượng đạt / NG và hiệu suất theo công đoạn",
                )}
          </p>
          <div className="s90d-chart-modal-meta">
            <span>{monthDisplayLabel}</span>
            <span aria-hidden="true">·</span>
            <span>
              {t("s90dReport.chartGeneratedAt", "Xuất ngày {{date}}", {
                date: reportDate,
              })}
            </span>
            {totalSummary.activeDays > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {t("s90dReport.chartActiveDays", "{{count}} ngày có dữ liệu", {
                    count: totalSummary.activeDays,
                  })}
                </span>
              </>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="s90d-chart-modal-close"
          onClick={onClose}
          aria-label={t("temperatureMonitor.close", "Đóng")}
        >
          ×
        </button>
      </header>

      {!hasAnyChart ? (
        <p className="s90d-chart-empty">
          {t("s90dReport.chartNoData", "Chưa có dữ liệu để vẽ biểu đồ.")}
        </p>
      ) : (
        <div className="s90d-chart-dashboard">
          <div className="s90d-chart-kpi-wrap">
            <S90dKpiCards totalRow={kpiTotalRow} />
          </div>

          <div className="s90d-chart-grid s90d-chart-grid--hero">
            {isDaily ? (
              hasDailyData ? (
                <S90dChartPanel
                  wide
                  title={t("s90dReport.chartDailyQtyTitle", "Số lượng theo ngày")}
                  subtitle={t(
                    "s90dReport.chartDailyQtyHint",
                    "Cột xanh = đạt · đỏ = NG · đường xanh dương = hiệu suất (%)",
                  )}
                >
                  <S90dChartLegend items={qtyLegend} />
                  <ResponsiveContainer width="100%" height={360}>
                    <ComposedChart
                      data={dailyTrendData}
                      margin={{ top: 20, right: 20, left: 8, bottom: 8 }}
                    >
                      <defs>
                        <linearGradient id="s90dOkArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={S90D_CHART.ok} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={S90D_CHART.ok} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke={S90D_CHART.grid} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: S90D_CHART.axis, fontWeight: 600 }}
                        axisLine={{ stroke: S90D_CHART.grid }}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="qty"
                        tick={{ fontSize: 11, fill: S90D_CHART.axis }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => formatS90dChartQty(value, locale)}
                      />
                      <YAxis
                        yAxisId="pct"
                        orientation="right"
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: S90D_CHART.yield }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip
                        content={
                          <S90dRichTooltip
                            locale={locale}
                            pctKeys={["yieldPct", "ngRatePct"]}
                          />
                        }
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.fullLabel ?? _
                        }
                      />
                      <ReferenceLine
                        yAxisId="pct"
                        y={avgYield}
                        stroke={S90D_CHART.yieldTarget}
                        strokeDasharray="6 4"
                        label={{
                          value: t("s90dReport.chartAvgYield", "TB {{value}}%", {
                            value: avgYield,
                          }),
                          fill: S90D_CHART.axis,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      />
                      <Area
                        yAxisId="qty"
                        type="monotone"
                        dataKey="okQty"
                        name={t("s90dReport.kpiOkQty", "Số lượng đạt")}
                        stroke={S90D_CHART.ok}
                        fill="url(#s90dOkArea)"
                        strokeWidth={2}
                      />
                      <Bar
                        yAxisId="qty"
                        dataKey="ngQty"
                        name={t("s90dReport.kpiNgQty", "Số lượng NG")}
                        fill={S90D_CHART.ng}
                        radius={[6, 6, 0, 0]}
                        barSize={14}
                      />
                      <Line
                        yAxisId="pct"
                        type="monotone"
                        dataKey="yieldPct"
                        name={t("s90dReport.kpiAvgYield", "Hiệu suất")}
                        stroke={S90D_CHART.yield}
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#fff", strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </S90dChartPanel>
              ) : null
            ) : hasProcessData ? (
              <S90dChartPanel
                wide
                title={t(
                  "s90dReport.chartProcessQtyTitle",
                  "Số lượng theo công đoạn",
                )}
                subtitle={t(
                  "s90dReport.chartProcessQtyHint",
                  "So sánh OK / NG và hiệu suất từng công đoạn trong tháng",
                )}
              >
                <S90dChartLegend items={qtyLegend} />
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart
                    data={processChartData}
                    margin={{ top: 20, right: 20, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="4 4" stroke={S90D_CHART.grid} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: S90D_CHART.axis, fontWeight: 700 }}
                      axisLine={{ stroke: S90D_CHART.grid }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="qty"
                      tick={{ fontSize: 11, fill: S90D_CHART.axis }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => formatS90dChartQty(value, locale)}
                    />
                    <YAxis
                      yAxisId="pct"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: S90D_CHART.yield }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      content={
                        <S90dRichTooltip
                          locale={locale}
                          pctKeys={["yieldPct", "ngRatePct", "cumulativeYieldPct"]}
                        />
                      }
                    />
                    <ReferenceLine
                      yAxisId="pct"
                      y={avgYield}
                      stroke={S90D_CHART.yieldTarget}
                      strokeDasharray="6 4"
                    />
                    <Bar
                      yAxisId="qty"
                      dataKey="okQty"
                      name={t("s90dReport.kpiOkQty", "Số lượng đạt")}
                      fill={S90D_CHART.ok}
                      radius={[8, 8, 0, 0]}
                      barSize={28}
                    >
                      <LabelList
                        dataKey="okQty"
                        position="top"
                        formatter={(value) =>
                          value > 0 ? formatS90dChartQty(value, locale) : ""
                        }
                        style={{ fill: S90D_CHART.ok, fontSize: 10, fontWeight: 800 }}
                      />
                    </Bar>
                    <Bar
                      yAxisId="qty"
                      dataKey="ngQty"
                      name={t("s90dReport.kpiNgQty", "Số lượng NG")}
                      fill={S90D_CHART.ng}
                      radius={[8, 8, 0, 0]}
                      barSize={28}
                    >
                      <LabelList
                        dataKey="ngQty"
                        position="top"
                        formatter={(value) =>
                          value > 0 ? formatS90dChartQty(value, locale) : ""
                        }
                        style={{ fill: S90D_CHART.ng, fontSize: 10, fontWeight: 800 }}
                      />
                    </Bar>
                    <Line
                      yAxisId="pct"
                      type="monotone"
                      dataKey="yieldPct"
                      name={t("s90dReport.kpiAvgYield", "Hiệu suất")}
                      stroke={S90D_CHART.yield}
                      strokeWidth={3}
                      dot={{ r: 5, fill: "#fff", strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </S90dChartPanel>
            ) : null}

            {hasPieData ? (
              <S90dChartPanel
                title={t("s90dReport.chartOkNgShareTitle", "Tỷ lệ OK / NG")}
                subtitle={t(
                  "s90dReport.chartOkNgShareHint",
                  "Phân bổ số lượng đạt và NG trong kỳ",
                )}
                className="s90d-chart-panel--pie"
              >
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart margin={{ top: 16, right: 28, bottom: 8, left: 28 }}>
                    <Pie
                      data={okNgPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={96}
                      paddingAngle={3}
                      labelLine={false}
                      label={S90dPieLabel}
                    >
                      {okNgPieData.map((entry) => (
                        <Cell key={entry.key} fill={entry.fill} stroke="#fff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        formatS90dChartQty(value, locale),
                        name,
                      ]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      formatter={(value) => (
                        <span className="s90d-chart-pie-legend">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="s90d-chart-pie-stats">
                  {okNgPieData.map((row) => (
                    <div key={row.key} className={`s90d-chart-pie-stat s90d-chart-pie-stat--${row.key}`}>
                      <span>{row.name}</span>
                      <strong>{formatS90dChartQty(row.value, locale)}</strong>
                      <em>{formatS90dChartPct(row.pct, locale)}</em>
                    </div>
                  ))}
                </div>
              </S90dChartPanel>
            ) : null}
          </div>

          {!isDaily && (yieldComparisonData.length > 0 || defectByProcess.rows.length > 0) ? (
            <div className="s90d-chart-grid s90d-chart-grid--pair">
              {yieldComparisonData.length > 0 ? (
                <S90dChartPanel
                  className="s90d-chart-panel--pair"
                  title={t(
                    "s90dReport.chartYieldCompareTitle",
                    "Hiệu suất & hiệu suất luỹ kế",
                  )}
                  subtitle={t(
                    "s90dReport.chartYieldCompareHint",
                    "Cột = hiệu suất công đoạn · đường = hiệu suất luỹ kế qua các công đoạn",
                  )}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart
                      data={yieldComparisonData}
                      margin={{ top: 16, right: 12, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="4 4" stroke={S90D_CHART.grid} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: S90D_CHART.axis, fontWeight: 700 }}
                        axisLine={{ stroke: S90D_CHART.grid }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: S90D_CHART.axis }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip
                        content={
                          <S90dRichTooltip
                            locale={locale}
                            pctKeys={["yieldPct", "cumulativeYieldPct", "ngRatePct"]}
                          />
                        }
                      />
                      <Bar
                        dataKey="yieldPct"
                        name={t("s90dReport.kpiAvgYield", "Hiệu suất")}
                        fill={S90D_CHART.ok}
                        radius={[8, 8, 0, 0]}
                        barSize={32}
                      >
                        <LabelList
                          dataKey="yieldPct"
                          position="top"
                          formatter={(value) => formatS90dChartPct(value, locale)}
                          style={{ fill: S90D_CHART.text, fontSize: 10, fontWeight: 800 }}
                        />
                      </Bar>
                      <Line
                        type="monotone"
                        dataKey="cumulativeYieldPct"
                        name={t("s90dReport.chartCumulativeYield", "Hiệu suất luỹ kế")}
                        stroke={S90D_CHART.total}
                        strokeWidth={3}
                        dot={{ r: 5, fill: "#fff", strokeWidth: 2 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </S90dChartPanel>
              ) : null}

              {defectByProcess.rows.length > 0 ? (
                <S90dChartPanel
                  className="s90d-chart-panel--pair"
                  title={t(
                    "s90dReport.chartDefectByProcessTitle",
                    "Lỗi theo công đoạn (Top 5 loại)",
                  )}
                  subtitle={t(
                    "s90dReport.chartDefectByProcessHint",
                    "Phân bổ các loại lỗi chính trên từng công đoạn",
                  )}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={defectByProcess.rows}
                      margin={{ top: 12, right: 12, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="4 4" stroke={S90D_CHART.grid} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: S90D_CHART.axis, fontWeight: 700 }}
                        axisLine={{ stroke: S90D_CHART.grid }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: S90D_CHART.axis }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<S90dRichTooltip locale={locale} />} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                      {defectByProcess.topKeys.map((key, index) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          name={defectByProcess.keyLabels[key]}
                          stackId="defect"
                          fill={
                            S90D_CHART.defectPalette[
                              index % S90D_CHART.defectPalette.length
                            ]
                          }
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </S90dChartPanel>
              ) : null}
            </div>
          ) : null}

          <div className="s90d-chart-grid s90d-chart-grid--secondary">
            {isDaily && dailyProcessStackData.length > 0 ? (
              <S90dChartPanel
                wide
                title={t(
                  "s90dReport.chartDailyProcessTitle",
                  "Sản lượng theo công đoạn / ngày",
                )}
                subtitle={t(
                  "s90dReport.chartDailyProcessHint",
                  "Tổng SL từng công đoạn theo từng ngày",
                )}
              >
                <S90dChartLegend items={processLegend} />
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={dailyProcessStackData}
                    margin={{ top: 12, right: 12, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="4 4" stroke={S90D_CHART.grid} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: S90D_CHART.axis, fontWeight: 600 }}
                      axisLine={{ stroke: S90D_CHART.grid }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: S90D_CHART.axis }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => formatS90dChartQty(value, locale)}
                    />
                    <Tooltip
                      content={<S90dRichTooltip locale={locale} />}
                    />
                    {S90D_PROCESSES.map((process) => (
                      <Bar
                        key={process}
                        dataKey={process}
                        name={processLabelFn(process)}
                        stackId="process"
                        fill={S90D_CHART.process[process]}
                        radius={
                          process === S90D_PROCESSES[S90D_PROCESSES.length - 1]
                            ? [6, 6, 0, 0]
                            : [0, 0, 0, 0]
                        }
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </S90dChartPanel>
            ) : null}

            {isDaily && hasDailyData ? (
              <S90dChartPanel
                title={t("s90dReport.chartNgRateTrendTitle", "Tỷ lệ NG theo ngày")}
                subtitle={t(
                  "s90dReport.chartNgRateTrendHint",
                  "Theo dõi biến động tỷ lệ NG hàng ngày",
                )}
              >
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart
                    data={dailyTrendData}
                    margin={{ top: 16, right: 12, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="4 4" stroke={S90D_CHART.grid} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: S90D_CHART.axis }}
                      axisLine={{ stroke: S90D_CHART.grid }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, "auto"]}
                      tick={{ fontSize: 10, fill: S90D_CHART.ng }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      content={
                        <S90dRichTooltip locale={locale} pctKeys={["ngRatePct"]} />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="ngRatePct"
                      name={t("s90dReport.kpiNgRate", "Tỷ lệ NG")}
                      stroke={S90D_CHART.ng}
                      fill={S90D_CHART.ngLight}
                      fillOpacity={0.35}
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="ngRatePct"
                      name={t("s90dReport.kpiNgRate", "Tỷ lệ NG")}
                      stroke={S90D_CHART.ng}
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#fff", strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </S90dChartPanel>
            ) : null}
          </div>

          {hasDefectData ? (
            <S90dChartPanel
              wide
              title={t("s90dReport.chartTopDefectsTitle", "Phân tích lỗi chi tiết")}
              subtitle={t(
                "s90dReport.chartTopDefectsHint",
                "Top loại lỗi theo số lượng và tỷ trọng (%)",
              )}
            >
              <ResponsiveContainer width="100%" height={Math.max(280, defectChartData.length * 36)}>
                <BarChart
                  data={defectChartData}
                  layout="vertical"
                  margin={{ top: 8, right: 120, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke={S90D_CHART.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: S90D_CHART.axis }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={130}
                    tick={{ fontSize: 10, fill: S90D_CHART.text, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value, name, props) => [
                      `${formatS90dChartQty(value, locale)} (${formatS90dChartPct(props.payload.pct, locale)})`,
                      t("s90dReport.chartDefectCount", "Số lỗi"),
                    ]}
                  />
                  <Bar
                    dataKey="count"
                    name={t("s90dReport.chartDefectCount", "Số lỗi")}
                    radius={[0, 8, 8, 0]}
                    barSize={18}
                  >
                    {defectChartData.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={
                          S90D_CHART.defectPalette[
                            index % S90D_CHART.defectPalette.length
                          ]
                        }
                      />
                    ))}
                    <LabelList
                      dataKey="count"
                      content={
                        <S90dDefectBarLabel data={defectChartData} locale={locale} />
                      }
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </S90dChartPanel>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
