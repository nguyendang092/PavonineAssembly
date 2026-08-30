import React, { memo } from "react";
import { Chart } from "react-chartjs-2";
import { CHART_DRAG_MIME } from "@/utils/chartOrderStorage";
import {
  resolveWorkplaceAreaStatus,
  resolveWorkplaceAreaTheme,
} from "../lib/workplaceAreaTheme";

function WorkplaceAreaChartCard({
  area,
  combo,
  comboChartOptions,
  workplaceDragOverArea,
  setWorkplaceDragOverArea,
  handleWorkplaceAreaReorder,
  chartDragHandleTitle,
  areaLabel,
  areaMetrics,
  statusStableLabel,
  statusWatchLabel,
  statusWarningLabel,
  footerGoodLabel,
  footerNgLabel,
  footerPeakLabel,
  panelDesc,
}) {
  const theme = resolveWorkplaceAreaTheme(area);
  const status = resolveWorkplaceAreaStatus(areaMetrics?.ngRate);
  const statusLabel =
    status === "stable"
      ? statusStableLabel
      : status === "watch"
        ? statusWatchLabel
        : status === "warning"
          ? statusWarningLabel
          : null;

  return (
    <article
      className={`wpd-chart-card${
        workplaceDragOverArea === area ? " wpd-chart-card--drag-over" : ""
      }`}
      style={{ "--wpd-area-accent": theme.accent }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setWorkplaceDragOverArea(area);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setWorkplaceDragOverArea((d) => (d === area ? null : d));
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        const from = e.dataTransfer.getData(CHART_DRAG_MIME);
        setWorkplaceDragOverArea(null);
        if (from) handleWorkplaceAreaReorder(from, area);
      }}
    >
      <header
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(CHART_DRAG_MIME, area);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => setWorkplaceDragOverArea(null)}
        className="wpd-chart-card__header"
        title={chartDragHandleTitle}
      >
        <div className="wpd-chart-card__title-wrap">
          <h3 className="wpd-chart-card__title">
            <span className="wpd-chart-card__drag" aria-hidden>
              ⋮⋮
            </span>
            <span className="wpd-chart-card__title-dot" aria-hidden />
            <span className="wpd-chart-card__title-main truncate">{areaLabel}</span>
            <span className="wpd-chart-card__title-sep" aria-hidden>
              ·
            </span>
            <span className="wpd-chart-card__title-sub">{panelDesc}</span>
          </h3>
        </div>
        {statusLabel ? (
          <span className={`wpd-status-badge wpd-status-badge--${status}`}>
            {statusLabel}
          </span>
        ) : null}
      </header>

      <div className="wpd-chart-card__canvas">
        <Chart type="bar" data={combo} options={comboChartOptions} />
      </div>

      <footer className="wpd-chart-card__footer">
        <div className="wpd-chart-foot">
          <p className="wpd-chart-foot__label">{footerGoodLabel}</p>
          <p className="wpd-chart-foot__value">
            {(areaMetrics?.totalGood ?? 0).toLocaleString("vi-VN")}
          </p>
        </div>
        <div className="wpd-chart-foot">
          <p className="wpd-chart-foot__label">{footerNgLabel}</p>
          <p className="wpd-chart-foot__value">
            {(areaMetrics?.totalNG ?? 0).toLocaleString("vi-VN")}
          </p>
        </div>
        <div className="wpd-chart-foot">
          <p className="wpd-chart-foot__label">{footerPeakLabel}</p>
          <p className="wpd-chart-foot__value">
            {areaMetrics?.peakDay
              ? `${areaMetrics.peakDay} · ${(areaMetrics.peakGood ?? 0).toLocaleString("vi-VN")}`
              : "—"}
          </p>
        </div>
      </footer>
    </article>
  );
}

export default memo(WorkplaceAreaChartCard);
