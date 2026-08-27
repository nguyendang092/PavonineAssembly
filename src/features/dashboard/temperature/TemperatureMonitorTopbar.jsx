import { memo } from "react";
import { useTranslation } from "react-i18next";

function TemperatureMonitorTopbar({
  selectedArea,
  selectedMonth,
  onSelectMonth,
  searchMachine,
  onSearchMachineChange,
  onOpenChart,
}) {
  const { t } = useTranslation();

  return (
    <header className="tm-topbar">
      <div className="tm-topbar__inner">
        <div className="tm-topbar__title-block">
          <h1>{t("temperatureMonitor.header")}</h1>
          <p>
            {t("temperatureMonitor.pageSubtitle", {
              defaultValue: "Nhập liệu hàng ngày theo thiết bị và tháng",
            })}
          </p>
        </div>

        <div className="tm-topbar__controls">
          <label className="tm-topbar__control">
            <span className="tm-topbar__control-label">
              {t("temperatureMonitor.month")}
            </span>
            <input
              type="month"
              className="tm-topbar__input tm-topbar__input--month"
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
            />
          </label>

          {selectedArea ? (
            <label className="tm-topbar__control">
              <span className="tm-topbar__control-label">
                {t("temperatureMonitor.searchMachineShort", {
                  defaultValue: "Tìm máy",
                })}
              </span>
              <input
                type="search"
                className="tm-topbar__input tm-topbar__input--search"
                value={searchMachine}
                onChange={(e) => onSearchMachineChange(e.target.value)}
                placeholder={t("temperatureMonitor.searchMachinePlaceholder", {
                  defaultValue: "Tìm máy…",
                })}
                autoComplete="off"
              />
            </label>
          ) : null}

          <div className="tm-topbar__control">
            <span className="tm-topbar__control-label tm-topbar__control-label--ghost">
              {t("temperatureMonitor.month")}
            </span>
            <button
              type="button"
              className="tm-topbar__btn"
              onClick={onOpenChart}
              disabled={!selectedArea}
            >
              {t("temperatureMonitor.viewChart")}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default memo(TemperatureMonitorTopbar);
