import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  buildSparklineSeries,
  computeMonthlyAverages,
  summarizeMachineMonth,
} from "./temperatureMonitorUtils";

function formatSparkMetric(value, suffix) {
  if (value === "" || value == null || value === undefined) return "–";
  const num = Number(value);
  if (!Number.isFinite(num)) return "–";
  const text = Number.isInteger(num) ? String(num) : num.toFixed(1);
  return `${text}${suffix}`;
}

function TemperatureInsightsPanel({ data, selectedMonth }) {
  const { t } = useTranslation();

  const averages = useMemo(
    () => computeMonthlyAverages(data, selectedMonth),
    [data, selectedMonth],
  );
  const sparkline = useMemo(
    () => buildSparklineSeries(data, selectedMonth, 7),
    [data, selectedMonth],
  );
  const { alertRows } = useMemo(
    () => summarizeMachineMonth(data, selectedMonth),
    [data, selectedMonth],
  );

  const maxBar = Math.max(
    ...sparkline.map((item) => Number(item.temperature) || 0),
    1,
  );

  return (
    <aside className="tm-insights" aria-label={t("temperatureMonitor.insights")}>
      <div className="tm-card tm-insight-card">
        <h3 className="tm-insight-card__title">
          {t("temperatureMonitor.monthAverage", {
            defaultValue: "Trung bình tháng",
          })}
        </h3>
        <div className="tm-insight-grid">
          <div className="tm-insight-stat">
            <div className="tm-insight-stat__label">
              {t("temperatureMonitor.temperature")}
            </div>
            <div className="tm-insight-stat__value">
              {averages.temperature != null
                ? `${averages.temperature}°C`
                : "–"}
            </div>
          </div>
          <div className="tm-insight-stat">
            <div className="tm-insight-stat__label">
              {t("temperatureMonitor.humidity")}
            </div>
            <div className="tm-insight-stat__value">
              {averages.humidity != null ? `${averages.humidity}%` : "–"}
            </div>
          </div>
        </div>
      </div>

      <div className="tm-card tm-insight-card">
        <h3 className="tm-insight-card__title">
          {t("temperatureMonitor.trend7Days", {
            defaultValue: "Xu hướng 7 ngày gần nhất",
          })}
        </h3>
        {sparkline.length === 0 ? (
          <p className="tm-empty-state" style={{ padding: "12px 0" }}>
            {t("temperatureMonitor.noTrendData", {
              defaultValue: "Chưa có dữ liệu",
            })}
          </p>
        ) : (
          <div className="tm-sparkline">
            {sparkline.map((item) => {
              const height = Math.max(
                8,
                Math.round(((Number(item.temperature) || 0) / maxBar) * 48),
              );
              const tempText = formatSparkMetric(item.temperature, "°");
              const humText = formatSparkMetric(item.humidity, "%");

              return (
                <div key={item.day} className="tm-sparkline__col">
                  <div className="tm-sparkline__metrics">
                    <span className="tm-sparkline__value">{tempText}</span>
                    <span className="tm-sparkline__value tm-sparkline__value--hum">
                      {humText}
                    </span>
                  </div>
                  <div className="tm-sparkline__bar-wrap">
                    <div
                      className={`tm-sparkline__bar tm-sparkline__bar--${item.status}`}
                      style={{ height }}
                      title={t("temperatureMonitor.sparklineTooltip", {
                        defaultValue: "Ngày {{day}} — {{temp}}°C / {{hum}}%",
                        day: item.day,
                        temp: item.temperature ?? "–",
                        hum: item.humidity ?? "–",
                      })}
                    />
                  </div>
                  <span className="tm-sparkline__label">{item.day}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="tm-card tm-insight-card">
        <h3 className="tm-insight-card__title">
          {t("temperatureMonitor.needsAttention", {
            defaultValue: "Cần chú ý",
          })}
        </h3>
        {alertRows.length === 0 ? (
          <p className="tm-empty-state" style={{ padding: "12px 0" }}>
            {t("temperatureMonitor.noAlerts", {
              defaultValue: "Không có cảnh báo",
            })}
          </p>
        ) : (
          <ul className="tm-alert-list">
            {alertRows.map((row) => (
              <li
                key={row.dateKey}
                className={`tm-alert-item tm-alert-item--${row.status}`}
              >
                {t("temperatureMonitor.alertRow", {
                  defaultValue: "Ngày {{day}} — {{temp}}°C / {{hum}}%",
                  day: row.day,
                  temp: row.temperature ?? "–",
                  hum: row.humidity ?? "–",
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

export default memo(TemperatureInsightsPanel);
