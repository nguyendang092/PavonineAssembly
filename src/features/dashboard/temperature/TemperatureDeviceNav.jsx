import { memo } from "react";
import { useTranslation } from "react-i18next";
import { getMachineDisplayName } from "@/features/dashboard/temperatureMachineDisplay";
import { navBadgeForSummary } from "./temperatureMonitorUtils";

function TemperatureDeviceNav({
  selectedArea,
  machines,
  summariesByMachine,
  selectedMachine,
  onSelectMachine,
  canManageMachines,
  isLoading,
  editingMachine,
  editMachineName,
  onEditMachineNameChange,
  onStartEditMachine,
  onCancelEditMachine,
  onConfirmEditMachine,
  onDeleteMachine,
  isAddingMachine,
  onStartAddMachine,
  onCancelAddMachine,
  newMachineName,
  onNewMachineNameChange,
  onAddMachine,
}) {
  const { t } = useTranslation();

  return (
    <nav
      className="tm-card tm-nav"
      aria-label={t("temperatureMonitor.deviceNav")}
    >
      <div className="tm-nav__head">
        {t("temperatureMonitor.deviceList", {
          defaultValue: "Danh sách thiết bị",
        })}{" "}
        ({machines.length})
      </div>

      {!selectedArea ? (
        <p className="tm-nav__empty-hint">
          {t("temperatureMonitor.selectAreaForDevices", {
            defaultValue: "Chọn khu vực để xem thiết bị",
          })}
        </p>
      ) : machines.length === 0 ? (
        <p className="tm-nav__empty-hint">
          {t("temperatureMonitor.noMachineGuide", {
            defaultValue: "Chưa có máy — bấm + để thêm.",
          })}
        </p>
      ) : (
        <ul className="tm-nav__list">
          {machines.map((machine) => {
            const summary = summariesByMachine[machine] ?? {
              filled: 0,
              alerts: 0,
            };
            const badge = navBadgeForSummary(summary);
            const isActive = machine === selectedMachine;

            if (editingMachine === machine) {
              return (
                <li key={machine} className="tm-nav__edit-row">
                  <input
                    className="tm-nav__edit-input"
                    value={editMachineName}
                    onChange={(e) => onEditMachineNameChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onConfirmEditMachine(machine);
                      if (e.key === "Escape") onCancelEditMachine();
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="tm-nav__footer-btn"
                    onClick={() => onConfirmEditMachine(machine)}
                  >
                    ✓
                  </button>
                </li>
              );
            }

            return (
              <li
                key={machine}
                className={`tm-nav__row${isActive ? " tm-nav__row--active" : ""}`}
              >
                <button
                  type="button"
                  className={`tm-nav__item${isActive ? " tm-nav__item--active" : ""}`}
                  onClick={() => onSelectMachine(machine)}
                >
                  <span className="tm-nav__item-name">
                    {getMachineDisplayName(t, machine)}
                  </span>
                  <span
                    className={`tm-nav__badge tm-nav__badge--${badge}`}
                    title={t(`temperatureMonitor.navBadge.${badge}`, badge)}
                  >
                    {summary.filled}
                  </span>
                </button>
                {canManageMachines && isActive ? (
                  <div className="tm-nav__item-actions">
                    <button
                      type="button"
                      className="tm-nav__footer-btn"
                      onClick={() => onStartEditMachine(machine)}
                      disabled={isLoading}
                    >
                      {t("temperatureMonitor.editMachine", { defaultValue: "Sửa" })}
                    </button>
                    <button
                      type="button"
                      className="tm-nav__footer-btn tm-nav__footer-btn--danger"
                      onClick={() => onDeleteMachine(machine)}
                      disabled={isLoading}
                    >
                      {t("temperatureMonitor.deleteMachine", { defaultValue: "Xóa" })}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {selectedArea ? (
        <div className="tm-nav__footer">
          {canManageMachines && !isAddingMachine ? (
            <button
              type="button"
              className="tm-nav__footer-btn"
              onClick={onStartAddMachine}
              disabled={isLoading}
            >
              + {t("temperatureMonitor.addMachine")}
            </button>
          ) : null}

          {canManageMachines && isAddingMachine ? (
            <>
              <input
                type="text"
                className="tm-nav__edit-input"
                value={newMachineName}
                onChange={(e) => onNewMachineNameChange(e.target.value)}
                placeholder={t("temperatureMonitor.newMachine")}
                disabled={isLoading}
              />
              <button
                type="button"
                className="tm-nav__footer-btn"
                onClick={onAddMachine}
                disabled={isLoading}
              >
                {isLoading
                  ? t("temperatureMonitor.saving")
                  : t("temperatureMonitor.add")}
              </button>
              <button
                type="button"
                className="tm-nav__footer-btn"
                onClick={onCancelAddMachine}
                disabled={isLoading}
              >
                {t("temperatureMonitor.cancel")}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}

export default memo(TemperatureDeviceNav);
