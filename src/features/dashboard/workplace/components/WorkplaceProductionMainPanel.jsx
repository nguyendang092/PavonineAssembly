import React, { memo, useCallback } from "react";
import {
  FiCalendar,
  FiLayers,
  FiTrendingUp,
  FiAlertTriangle,
  FiEye,
} from "react-icons/fi";
import WorkplaceAreaChartCard from "./WorkplaceAreaChartCard";

function formatPct(value) {
  if (!value) return "0%";
  return `${Number(value).toLocaleString("vi-VN", {
    maximumFractionDigits: 1,
  })}%`;
}

export const WorkplaceProductionMainPanel = memo(function WorkplaceProductionMainPanel({
  t,
  weekMeta,
  dashboardStats,
  chartData,
  chartAreasOrdered,
  openDetailModal,
  areaComboDataByArea,
  comboChartOptions,
  workplaceDragOverArea,
  setWorkplaceDragOverArea,
  handleWorkplaceAreaReorder,
  areaMetricsByArea,
}) {
  const ngShare =
    dashboardStats.grandTotal > 0
      ? (dashboardStats.totalNG / dashboardStats.grandTotal) * 100
      : 0;

  const handleOpenDetail = useCallback(() => {
    const area = chartAreasOrdered[0] || chartData?.areas?.[0];
    if (area) openDetailModal(area);
  }, [chartAreasOrdered, chartData?.areas, openDetailModal]);

  return (
    <main className="wpd-main dashboard-print-fill">
      <div className="wpd-main__scroll">
        <header className="wpd-topbar">
          <div className="min-w-0">
            <p className="wpd-topbar__eyebrow">{t("workplaceChart.dashboardBadge")}</p>
            <h1 className="wpd-topbar__title">{t("workplaceChart.dashboardTitle")}</h1>
          </div>
          {weekMeta.weekNum ? (
            <span className="wpd-week-pill">
              {t("workplaceChart.weekPeriod", {
                week: weekMeta.weekNum,
                year: weekMeta.year,
              })}
            </span>
          ) : null}
        </header>

        <div className="wpd-kpi-grid">
          <article
            className="wpd-kpi-card"
            style={{ "--wpd-kpi-accent": "var(--wpd-accent-ok)" }}
          >
            <div className="wpd-kpi-card__head">
              <span className="wpd-kpi-card__icon">
                <FiTrendingUp size={15} />
              </span>
              <span className="wpd-kpi-card__label">{t("workplaceChart.kpiTotalGood")}</span>
            </div>
            <p className="wpd-kpi-card__value">
              {dashboardStats.totalGood.toLocaleString("vi-VN")}
            </p>
            <p className="wpd-kpi-card__note">{t("workplaceChart.kpiGoodNote")}</p>
          </article>

          <article
            className="wpd-kpi-card"
            style={{ "--wpd-kpi-accent": "var(--wpd-accent-ng)" }}
          >
            <div className="wpd-kpi-card__head">
              <span className="wpd-kpi-card__icon">
                <FiAlertTriangle size={15} />
              </span>
              <span className="wpd-kpi-card__label">{t("workplaceChart.kpiTotalNG")}</span>
            </div>
            <p className="wpd-kpi-card__value">
              {dashboardStats.totalNG.toLocaleString("vi-VN")}
            </p>
            <p className="wpd-kpi-card__note">
              {t("workplaceChart.kpiNgNote", { rate: formatPct(ngShare) })}
            </p>
          </article>

          <article className="wpd-kpi-card" style={{ "--wpd-kpi-accent": "#6366F1" }}>
            <div className="wpd-kpi-card__head">
              <span className="wpd-kpi-card__icon">
                <FiLayers size={15} />
              </span>
              <span className="wpd-kpi-card__label">{t("workplaceChart.kpiAreas")}</span>
            </div>
            <p className="wpd-kpi-card__value">{dashboardStats.areaCount}</p>
            <p className="wpd-kpi-card__note">{t("workplaceChart.kpiAreasNote")}</p>
          </article>

          <article className="wpd-kpi-card" style={{ "--wpd-kpi-accent": "#0EA5E9" }}>
            <div className="wpd-kpi-card__head">
              <span className="wpd-kpi-card__icon">
                <FiCalendar size={15} />
              </span>
              <span className="wpd-kpi-card__label">{t("workplaceChart.kpiDays")}</span>
            </div>
            <p className="wpd-kpi-card__value">{dashboardStats.dayCount}</p>
            <p className="wpd-kpi-card__note">{t("workplaceChart.kpiDaysNote")}</p>
          </article>
        </div>

        <div className="wpd-section-head">
          <div>
            <h2 className="wpd-section-head__title">{t("workplaceChart.chartSectionTitle")}</h2>
            <p className="wpd-section-head__hint">
              {t("workplaceChart.chartSectionHint")}
            </p>
          </div>
          <div className="wpd-section-head__actions">
            <button
              type="button"
              onClick={handleOpenDetail}
              disabled={!chartData?.labels?.length}
              className="wpd-action-btn dashboard-no-print"
            >
              <FiEye size={14} strokeWidth={2.5} />
              {t("workplaceChart.viewDetail")}
            </button>
            {chartData?.areas?.length ? (
              <span className="wpd-grand-total">
                {t("workplaceChart.grandTotal")}
                <strong>{dashboardStats.grandTotal.toLocaleString("vi-VN")}</strong>
              </span>
            ) : null}
          </div>
        </div>

        {chartData?.areas?.length ? (
          <div className="wpd-chart-grid">
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
                  chartDragHandleTitle={t("workplaceChart.chartDragHandle")}
                  areaLabel={t(`areas.${area}`)}
                  areaMetrics={areaMetricsByArea[area]}
                  statusStableLabel={t("workplaceChart.statusStable")}
                  statusWatchLabel={t("workplaceChart.statusWatch")}
                  statusWarningLabel={t("workplaceChart.statusWarning")}
                  footerGoodLabel={t("workplaceChart.chartFooterGood")}
                  footerNgLabel={t("workplaceChart.chartFooterNG")}
                  footerPeakLabel={t("workplaceChart.chartFooterPeak")}
                  panelDesc={t("workplaceChart.panelLabel")}
                />
              );
            })}
          </div>
        ) : (
          <div className="wpd-empty">{t("workplaceChart.pleaseSelectExcel")}</div>
        )}
      </div>
    </main>
  );
});

export default WorkplaceProductionMainPanel;
