import { memo } from "react";
import { useTranslation } from "react-i18next";

function TemperatureAreaCard({ areaKeys, selectedArea, onSelectArea }) {
  const { t } = useTranslation();

  return (
    <section
      className="tm-card tm-area-card"
      aria-label={t("temperatureMonitor.area")}
    >
      <div className="tm-area-card__head">{t("temperatureMonitor.area")}</div>
      <div className="tm-area-card__body">
        <select
          id="tm-area-select"
          className="tm-area-card__select"
          value={selectedArea ?? ""}
          onChange={(e) => onSelectArea(e.target.value || null)}
        >
          <option value="">{t("temperatureMonitor.noArea")}</option>
          {areaKeys.map((areaKey) => (
            <option key={areaKey} value={areaKey}>
              {t(`areas.${areaKey}`, areaKey)}
            </option>
          ))}
        </select>
        {!selectedArea ? (
          <p className="tm-area-card__hint">
            {t("temperatureMonitor.noAreaGuide")}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default memo(TemperatureAreaCard);
