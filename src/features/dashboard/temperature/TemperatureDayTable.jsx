import { memo } from "react";
import { format } from "date-fns";
import { vi as viLocale } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { TEMPERATURE_METRIC_THRESHOLDS } from "./temperatureMonitorConstants";
import {
  evaluateDayStatus,
  evaluateMetricStatus,
  metricGaugeRatio,
} from "./temperatureMonitorUtils";

const STATUS_ICON = {
  ok: "✓",
  warn: "!",
  danger: "✕",
  empty: "–",
};

function TemperatureValueCell({
  metricKey,
  day,
  value,
  disabled,
  onChange,
}) {
  const thresholds = TEMPERATURE_METRIC_THRESHOLDS[metricKey];
  const status = evaluateMetricStatus(value, thresholds);
  const ratio = metricGaugeRatio(value, thresholds);

  return (
    <div className="tm-value-cell">
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        className={`tm-value-input tm-value-input--${status}`}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(day, e.target.value)}
        aria-label={`${metricKey} ${day}`}
      />
      <div className="tm-gauge" aria-hidden>
        <div
          className={`tm-gauge__fill tm-gauge__fill--${status}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

function TemperatureDayTable({
  title,
  days,
  data,
  todayKey,
  canEdit,
  onTemperatureChange,
  onHumidityChange,
  onCopyPrevious,
  weekdayLocale,
}) {
  const { t } = useTranslation();

  return (
    <div className="tm-table-block">
      <div className="tm-thresholds tm-thresholds--half">
        <strong>{title}</strong>
      </div>
      <div className="tm-table-scroll">
        <table className="tm-table">
          <colgroup>
            <col className="tm-col-day" />
            <col className="tm-col-metric" />
            <col className="tm-col-metric" />
            <col className="tm-col-status" />
            <col className="tm-col-action" />
          </colgroup>
          <thead>
            <tr>
              <th>{t("temperatureMonitor.date")}</th>
              <th>{t("temperatureMonitor.temperatureShort", { defaultValue: "Nhiệt °C" })}</th>
              <th>{t("temperatureMonitor.humidityShort", { defaultValue: "Ẩm %" })}</th>
              <th>{t("temperatureMonitor.statusColumn", { defaultValue: "TT" })}</th>
              <th aria-label={t("temperatureMonitor.copyPrevious", { defaultValue: "Sao chép" })} />
            </tr>
          </thead>
          <tbody>
            {days.map((date, index) => {
              const day = format(date, "dd");
              const dateKey = format(date, "yyyy-MM-dd");
              const isToday = dateKey === todayKey;
              const temp = data.temperature?.[day] ?? "";
              const hum = data.humidity?.[day] ?? "";
              const dayStatus = evaluateDayStatus(temp, hum);
              const prevDate = index > 0 ? days[index - 1] : null;
              const prevDay = prevDate ? format(prevDate, "dd") : null;

              return (
                <tr
                  key={dateKey}
                  className={isToday ? "tm-row--today" : undefined}
                >
                  <td className="tm-day-cell">
                    <span className="tm-day-cell__num">{day}</span>
                    <span className="tm-day-cell__week">
                      {format(date, "EEE", { locale: weekdayLocale })}
                    </span>
                    {isToday ? (
                      <span className="tm-day-cell__today">
                        {t("temperatureMonitor.today", { defaultValue: "Hôm nay" })}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <TemperatureValueCell
                      metricKey="temperature"
                      day={day}
                      value={temp}
                      disabled={!canEdit}
                      onChange={onTemperatureChange}
                    />
                  </td>
                  <td>
                    <TemperatureValueCell
                      metricKey="humidity"
                      day={day}
                      value={hum}
                      disabled={!canEdit}
                      onChange={onHumidityChange}
                    />
                  </td>
                  <td>
                    <span
                      className={`tm-status tm-status--${dayStatus}`}
                      title={t(`temperatureMonitor.statusTitle.${dayStatus}`, dayStatus)}
                    >
                      {STATUS_ICON[dayStatus]}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="tm-copy-btn"
                      disabled={!canEdit || !prevDay}
                      onClick={() => onCopyPrevious(day, prevDay)}
                      title={t("temperatureMonitor.copyPreviousTitle", {
                        defaultValue: "Sao chép giá trị ngày trước",
                      })}
                    >
                      ⧉
                    </button>
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

export default memo(TemperatureDayTable);
