import { memo, useMemo } from "react";
import { format } from "date-fns";
import { vi as viLocale, ko as koLocale } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import LoadingBlock from "@/components/ui/LoadingBlock";
import { getMachineDisplayName } from "@/features/dashboard/temperatureMachineDisplay";
import { TEMPERATURE_METRIC_THRESHOLDS } from "./temperatureMonitorConstants";
import TemperatureDayTable from "./TemperatureDayTable";
import {
  countDirtyFields,
  listWorkingDaysInMonth,
  splitWorkingDays,
  summarizeMachineMonth,
} from "./temperatureMonitorUtils";

function TemperatureEntryPanel({
  machine,
  selectedMonth,
  data,
  baseline,
  loading,
  canEdit,
  saving,
  onTemperatureChange,
  onHumidityChange,
  onCopyPrevious,
  onSave,
  i18nLanguage,
}) {
  const { t } = useTranslation();

  const days = useMemo(
    () => listWorkingDaysInMonth(selectedMonth),
    [selectedMonth],
  );
  const { firstHalf, secondHalf } = useMemo(
    () => splitWorkingDays(days),
    [days],
  );
  const summary = useMemo(
    () => summarizeMachineMonth(data, selectedMonth),
    [data, selectedMonth],
  );
  const dirtyCount = useMemo(
    () => countDirtyFields(baseline, data),
    [baseline, data],
  );

  const weekdayLocale =
    i18nLanguage === "ko" ? koLocale : i18nLanguage === "vi" ? viLocale : undefined;
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const tempThreshold = TEMPERATURE_METRIC_THRESHOLDS.temperature;
  const humThreshold = TEMPERATURE_METRIC_THRESHOLDS.humidity;

  if (loading) {
    return (
      <section className="tm-card tm-panel">
        <LoadingBlock
          className="py-16"
          message={t("temperatureMonitor.loading")}
        />
      </section>
    );
  }

  return (
    <section className="tm-card tm-panel">
      <div className="tm-panel__head">
        <h2 className="tm-panel__title">
          {getMachineDisplayName(t, machine)}
        </h2>
        <div className="tm-panel__chips">
          <span className="tm-chip">
            {t("temperatureMonitor.filledDays", {
              defaultValue: "{{count}} ngày đã nhập",
              count: summary.filled,
            })}
          </span>
          {summary.alerts > 0 ? (
            <span className="tm-chip tm-chip--warn">
              {t("temperatureMonitor.alertDays", {
                defaultValue: "{{count}} cảnh báo",
                count: summary.alerts,
              })}
            </span>
          ) : null}
        </div>
      </div>

      <div className="tm-thresholds">
        {t("temperatureMonitor.thresholdsLine", {
          defaultValue:
            "Ngưỡng cho phép — Nhiệt: {{tempMin}}–{{tempMax}}°C · Ẩm: {{humMin}}–{{humMax}}%",
          tempMin: tempThreshold.min,
          tempMax: tempThreshold.max,
          humMin: humThreshold.min,
          humMax: humThreshold.max,
        })}
      </div>

      <div className="tm-tables-wrap">
        <TemperatureDayTable
          title={t("temperatureMonitor.firstHalf", {
            defaultValue: "Ngày 1 – 16",
          })}
          days={firstHalf}
          data={data}
          todayKey={todayKey}
          canEdit={canEdit}
          onTemperatureChange={onTemperatureChange}
          onHumidityChange={onHumidityChange}
          onCopyPrevious={onCopyPrevious}
          weekdayLocale={weekdayLocale}
        />
        <TemperatureDayTable
          title={t("temperatureMonitor.secondHalf", {
            defaultValue: "Ngày 17 – cuối tháng",
          })}
          days={secondHalf}
          data={data}
          todayKey={todayKey}
          canEdit={canEdit}
          onTemperatureChange={onTemperatureChange}
          onHumidityChange={onHumidityChange}
          onCopyPrevious={onCopyPrevious}
          weekdayLocale={weekdayLocale}
        />
      </div>

      <div className="tm-panel__footer">
        <div>
          <div className="tm-legend">
            <span className="tm-legend__item">
              <span className="tm-legend__dot" style={{ background: "var(--tm-ok)" }} />
              {t("temperatureMonitor.legendOk", { defaultValue: "Đạt ✓" })}
            </span>
            <span className="tm-legend__item">
              <span className="tm-legend__dot" style={{ background: "var(--tm-warn)" }} />
              {t("temperatureMonitor.legendWarn", { defaultValue: "Gần vượt !" })}
            </span>
            <span className="tm-legend__item">
              <span className="tm-legend__dot" style={{ background: "var(--tm-danger)" }} />
              {t("temperatureMonitor.legendDanger", { defaultValue: "Vượt ✕" })}
            </span>
            <span className="tm-legend__item">
              <span className="tm-legend__dot" style={{ background: "var(--tm-empty)" }} />
              {t("temperatureMonitor.legendEmpty", { defaultValue: "Chưa nhập –" })}
            </span>
          </div>
          {dirtyCount > 0 ? (
            <p className="tm-dirty">
              {t("temperatureMonitor.unsavedChanges", {
                defaultValue: "{{count}} thay đổi chưa lưu",
                count: dirtyCount,
              })}
            </p>
          ) : null}
        </div>

        {canEdit ? (
          <button
            type="button"
            className="tm-save-btn"
            onClick={onSave}
            disabled={saving || dirtyCount === 0}
            title={t("temperatureMonitor.saveAllTitle", {
              defaultValue: "Lưu tất cả thay đổi",
            })}
          >
            💾{" "}
            {saving
              ? t("temperatureMonitor.saving")
              : t("temperatureMonitor.saveAll", { defaultValue: "Lưu tất cả" })}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export default memo(TemperatureEntryPanel);
