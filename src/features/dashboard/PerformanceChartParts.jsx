import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import {
  PERF_THEME,
  buildPerformanceKpiSummary,
  resolveAchievementStatus,
} from "./performanceChartTheme";

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.0";
  return n.toFixed(1);
}

function AchievementPctCell({ pctRaw }) {
  const pct = Number(pctRaw);
  const status = resolveAchievementStatus(pct);
  const barPct = Math.min(100, Math.max(0, pct));

  return (
    <div className="perf-board__pct-cell">
      <div className="perf-board__pct-row">
        <span
          className="perf-board__pct-value"
          style={{ color: status.color }}
        >
          {formatPct(pct)}%
        </span>
        <div className="perf-board__progress" aria-hidden>
          <div
            className="perf-board__progress-fill"
            style={{
              width: `${barPct}%`,
              background: status.color,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function AchievementStatusCell({ pctRaw, t }) {
  const status = resolveAchievementStatus(Number(pctRaw));

  return (
    <span
      className="perf-board__badge"
      style={{ color: status.color, background: status.bg }}
    >
      {t(status.labelKey, status.labelDefault)}
    </span>
  );
}

export function PerformanceYearSidebar({
  open,
  onClose,
  years,
  selectedYear,
  onSelectYear,
  currentCalendarYear,
}) {
  const { t } = useTranslation();

  return (
    <aside
      className={`perf-board__sidebar${open ? " perf-board__sidebar--open" : ""}`}
      aria-label={t("performanceChart.sidebarTitle")}
    >
      <div className="perf-board__sidebar-head">
        <h2 className="perf-board__sidebar-title">
          {t("performanceChart.sidebarTitle")}
        </h2>
        <p className="perf-board__sidebar-sub">
          {t("performanceChart.sidebarSubtitle")}
        </p>
      </div>
      <div className="perf-board__year-list">
        {years.map((year) => (
          <button
            key={year}
            type="button"
            onClick={() => {
              onSelectYear(year);
              if (window.innerWidth < 1024) onClose();
            }}
            className={`perf-board__year-btn${
              selectedYear === year ? " perf-board__year-btn--active" : ""
            }`}
          >
            {year}
            {year === currentCalendarYear ? (
              <span className="perf-board__year-badge">
                {t("performanceChart.currentYearBadge")}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </aside>
  );
}

export function PerformanceKpiCards({ data, currentWeekNumber }) {
  const { t } = useTranslation();
  const summary = useMemo(
    () => buildPerformanceKpiSummary(data, currentWeekNumber),
    [data, currentWeekNumber],
  );

  const cards = [
    {
      label: t("performanceChart.kpiAvgAchievement", "Tỷ lệ đạt TB"),
      value: `${formatPct(summary.avgPct)}%`,
      meta: t("performanceChart.kpiAvgHint", {
        defaultValue: "{{count}} team",
        count: summary.teamCount,
      }),
      accent: summary.avgStatus.color,
    },
    {
      label: t("performanceChart.kpiGoodTeams", "Team đạt tốt"),
      value: String(summary.goodTeams),
      meta: t("performanceChart.kpiGoodTeamsHint", {
        defaultValue: "/ {{total}} team ≥ 100%",
        total: summary.teamCount,
      }),
      accent: PERF_THEME.good,
    },
    {
      label: t("performanceChart.kpiCumulative", "Lũy kế / Mục tiêu"),
      value: `${summary.cumulativeTotal}`,
      meta: t("performanceChart.kpiCumulativeHint", {
        defaultValue: "Mục tiêu {{target}}",
        target: summary.cumulativeTarget,
      }),
      accent: PERF_THEME.accent,
    },
    {
      label: t("performanceChart.kpiWeekOutput", {
        defaultValue: "Tuần W{{week}}",
        week: summary.prevWeek,
      }),
      value: String(summary.weekTotal),
      meta: t("performanceChart.kpiWeekHint", "Tổng sản lượng tuần gần nhất"),
      accent: PERF_THEME.warn,
    },
  ];

  return (
    <section className="perf-board__kpi-grid" aria-label={t("performanceChart.kpiSection", "Chỉ số tổng quan")}>
      {cards.map((card) => (
        <article
          key={card.label}
          className="perf-board__kpi-card"
          style={{ "--kpi-accent": card.accent }}
        >
          <p className="perf-board__kpi-label">{card.label}</p>
          <p className="perf-board__kpi-value">{card.value}</p>
          <p className="perf-board__kpi-meta">{card.meta}</p>
        </article>
      ))}
    </section>
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
  const { t } = useTranslation();
  const prevWeek = currentWeekNumber - 1;

  return (
    <section className="perf-board__panel">
      <div className="perf-board__panel-head">
        <h3 className="perf-board__panel-title">
          {t("performanceChart.tableToolbar")}
        </h3>
        <div className="perf-board__panel-tools">
          {canEdit ? (
            <>
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
                placeholder={t("performanceChart.addTeamPlaceholder")}
                className="perf-board__input"
                aria-label={t("performanceChart.addTeamPlaceholder")}
              />
              <button
                type="button"
                onClick={() => onAddTeam?.()}
                className="perf-board__btn perf-board__btn--ghost"
              >
                + Team
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={!hasUnsavedChanges || saving || !canEdit}
            className="perf-board__btn perf-board__btn--accent"
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
                <LoadingSpinner size="xs" className="inline-block" />
                <span>{t("performanceChart.saving")}</span>
              </>
            ) : (
              <>
                {t("performanceChart.saveButton")}
                {hasUnsavedChanges ? " ●" : ""}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="perf-board__table-wrap">
        <table className="perf-board__table">
          <thead>
            <tr>
              <th>{t("performanceChart.colTeam")}</th>
              <th>{t("performanceChart.colTarget")}</th>
              <th>
                <span className="hidden md:inline">
                  {t("performanceChart.colTotalLong", {
                    prevWeek,
                    year: selectedYear,
                  })}
                </span>
                <span className="md:hidden">
                  {t("performanceChart.colTotalShort")}
                </span>
              </th>
              <th>{t("performanceChart.colAchievement")}</th>
              <th>{t("performanceChart.colStatus", "Tình trạng")}</th>
              <th>
                <span className="hidden sm:inline">
                  {t("performanceChart.colWeekLong", {
                    week: prevWeek,
                    year: selectedYear,
                  })}
                </span>
                <span className="sm:hidden">
                  {t("performanceChart.colWeekShort")}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const total = calculateTotal(row, currentWeekNumber);
              const currentWeekValue = row.weeks[`W${prevWeek}`] || 0;
              const pctRaw = calculatePercentage(total, row.target);
              const canRemove =
                canEdit &&
                onRemoveTeam &&
                isRemovableTeam(selectedYear, row.team);

              return (
                <tr key={row.team || i}>
                  <td>
                    <div className="perf-board__team">
                      <span className="truncate">{row.team}</span>
                      {canRemove ? (
                        <button
                          type="button"
                          onClick={() => onRemoveTeam(i)}
                          className="perf-board__btn perf-board__btn--ghost"
                          style={{ padding: "2px 6px", minWidth: 0 }}
                          title="Xóa team"
                          aria-label={`Xóa team ${row.team}`}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="text-center">
                    <input
                      type="number"
                      value={row.target}
                      onChange={(e) =>
                        onChangeCell(i, "target", e.target.value)
                      }
                      disabled={!canEdit}
                      className="perf-board__input perf-board__input--mono"
                    />
                  </td>
                  <td className="text-center">
                    <span className="perf-board__num">{total}</span>
                  </td>
                  <td>
                    <AchievementPctCell pctRaw={pctRaw} />
                  </td>
                  <td className="text-center">
                    <AchievementStatusCell pctRaw={pctRaw} t={t} />
                  </td>
                  <td className="text-center">
                    <input
                      type="number"
                      value={currentWeekValue}
                      onChange={(e) =>
                        onChangeCell(i, `W${prevWeek}`, e.target.value)
                      }
                      disabled={!canEdit}
                      className="perf-board__input perf-board__input--mono"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PerformanceBarChartCard({
  cardRef,
  chartRef,
  chartRows,
  onDownloadPng,
  onDownloadSvg,
}) {
  const { t } = useTranslation();
  const [isMobileChart, setIsMobileChart] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const onResize = () => setIsMobileChart(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const mobileChartMinWidth = useMemo(() => {
    if (!isMobileChart) return 0;
    return Math.max(560, chartRows.length * 116);
  }, [isMobileChart, chartRows.length]);

  const axisFontSize = isMobileChart ? 10 : 11;
  const labelFontSize = isMobileChart ? 10 : 11;
  const xAxisHeight = isMobileChart ? 58 : 36;
  const barMaxSize = isMobileChart ? 32 : 44;

  return (
    <section ref={cardRef} className="perf-board__panel">
      <div className="perf-board__panel-head">
        <h3 className="perf-board__panel-title">
          {t("performanceChart.chartToolbar")}
        </h3>
        <div className="perf-board__panel-tools">
          <button
            type="button"
            onClick={onDownloadPng}
            data-no-export="true"
            className="perf-board__btn perf-board__btn--ghost"
          >
            PNG
          </button>
          <button
            type="button"
            onClick={onDownloadSvg}
            data-no-export="true"
            className="perf-board__btn perf-board__btn--ghost"
          >
            SVG
          </button>
        </div>
      </div>

      <div ref={chartRef} className="perf-board__chart-body">
        <div
          className="perf-board__chart-canvas"
          style={{
            minWidth: isMobileChart ? `${mobileChartMinWidth}px` : undefined,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartRows}
              margin={{
                top: 16,
                right: isMobileChart ? 4 : 12,
                left: isMobileChart ? 0 : 4,
                bottom: isMobileChart ? 8 : 12,
              }}
              barGap={4}
              barCategoryGap={12}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={PERF_THEME.border}
                strokeOpacity={0.8}
                vertical={false}
              />
              <XAxis
                dataKey="team"
                interval={0}
                height={xAxisHeight}
                tickMargin={8}
                tick={{
                  fill: PERF_THEME.textMuted,
                  fontSize: axisFontSize,
                  fontFamily: "IBM Plex Sans, sans-serif",
                  fontWeight: 600,
                }}
                tickFormatter={(value) => {
                  const s = String(value ?? "");
                  return s.length > 12 ? `${s.slice(0, 12)}…` : s;
                }}
                axisLine={{ stroke: PERF_THEME.border }}
                tickLine={{ stroke: PERF_THEME.border }}
              />
              <YAxis
                width={isMobileChart ? 34 : 44}
                tick={{
                  fill: PERF_THEME.textMuted,
                  fontSize: axisFontSize,
                  fontFamily: "IBM Plex Mono, monospace",
                  fontWeight: 600,
                }}
                axisLine={{ stroke: PERF_THEME.border }}
                tickLine={{ stroke: PERF_THEME.border }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: PERF_THEME.panelHeader,
                  border: `1px solid ${PERF_THEME.border}`,
                  borderRadius: "4px",
                  boxShadow: "0 8px 24px rgb(0 0 0 / 0.35)",
                  padding: "8px 12px",
                }}
                labelStyle={{
                  fontWeight: 700,
                  color: PERF_THEME.text,
                  marginBottom: "4px",
                  fontSize: "11px",
                  fontFamily: "IBM Plex Sans, sans-serif",
                }}
                itemStyle={{
                  padding: "2px 0",
                  fontSize: "11px",
                  fontFamily: "IBM Plex Mono, monospace",
                  color: PERF_THEME.text,
                }}
              />
              <Legend
                wrapperStyle={{
                  paddingTop: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  fontFamily: "IBM Plex Sans, sans-serif",
                  color: PERF_THEME.textMuted,
                }}
                iconType="square"
              />
              <Bar
                dataKey="target"
                fill={PERF_THEME.accent}
                name={t("performanceChart.chartTarget")}
                radius={[2, 2, 0, 0]}
                maxBarSize={barMaxSize}
              >
                {!isMobileChart ? (
                  <LabelList
                    dataKey="target"
                    position="top"
                    style={{
                      fill: PERF_THEME.accent,
                      fontWeight: 700,
                      fontSize: labelFontSize,
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  />
                ) : null}
              </Bar>
              <Bar
                dataKey="total"
                fill={PERF_THEME.good}
                name={t("performanceChart.chartTotal")}
                radius={[2, 2, 0, 0]}
                maxBarSize={barMaxSize}
              >
                {!isMobileChart ? (
                  <LabelList
                    dataKey="total"
                    position="top"
                    style={{
                      fill: PERF_THEME.good,
                      fontWeight: 700,
                      fontSize: labelFontSize,
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  />
                ) : null}
              </Bar>
              <Bar
                dataKey="percentage"
                fill={PERF_THEME.warn}
                name={t("performanceChart.chartAchievement")}
                radius={[2, 2, 0, 0]}
                maxBarSize={barMaxSize}
              >
                {!isMobileChart ? (
                  <LabelList
                    dataKey="percentage"
                    position="top"
                    formatter={(value) => `${value}%`}
                    style={{
                      fill: PERF_THEME.warn,
                      fontWeight: 700,
                      fontSize: labelFontSize,
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  />
                ) : null}
              </Bar>
              <Bar
                dataKey="currentWeek"
                fill={PERF_THEME.textMuted}
                name={t("performanceChart.chartCurrentWeek")}
                radius={[2, 2, 0, 0]}
                maxBarSize={barMaxSize}
              >
                {!isMobileChart ? (
                  <LabelList
                    dataKey="currentWeek"
                    position="top"
                    style={{
                      fill: PERF_THEME.textMuted,
                      fontWeight: 700,
                      fontSize: labelFontSize,
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  />
                ) : null}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
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
