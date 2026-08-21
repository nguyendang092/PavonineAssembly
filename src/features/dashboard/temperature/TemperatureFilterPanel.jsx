import { memo } from "react";
import { FaChartLine, FaCheck, FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { getMachineDisplayName } from "@/features/dashboard/temperatureMachineDisplay";

function TemperatureFilterPanel({
  areaKeys,
  selectedArea,
  onSelectArea,
  selectedMonth,
  onSelectMonth,
  onOpenChart,
  searchMachine,
  onSearchMachineChange,
  filteredMachines,
  pagedMachines,
  machinePage,
  totalMachinePages,
  onPrevMachinePage,
  onNextMachinePage,
  showMachinePanel,
  onToggleMachinePanel,
  editingMachine,
  editMachineName,
  onEditMachineNameChange,
  onStartEditMachine,
  onCancelEditMachine,
  onConfirmEditMachine,
  onDeleteMachine,
  canManageMachines,
  isAddingMachine,
  onStartAddMachine,
  onCancelAddMachine,
  newMachineName,
  onNewMachineNameChange,
  onAddMachine,
  isLoading,
}) {
  const { t } = useTranslation();
  const machineCount = filteredMachines.length;

  return (
    <section
      className="temperature-filter-panel"
      aria-label={t("temperatureMonitor.filters", "Bộ lọc")}
    >
      <div className="temperature-filter-panel__toolbar">
        <p className="temperature-filter-panel__kicker">
          {t("temperatureMonitor.dashboard", "Bảng điều khiển")}
        </p>

        <label className="temperature-filter-field temperature-filter-field--inline">
          <span className="temperature-filter-field__label">
            {t("temperatureMonitor.area")}
          </span>
          <select
            value={selectedArea ?? ""}
            onChange={(e) => onSelectArea(e.target.value || null)}
            className="temperature-filter-field__input"
          >
            <option value="">
              {t("temperatureMonitor.noArea", "Chưa chọn khu vực")}
            </option>
            {areaKeys.map((areaKey) => (
              <option key={areaKey} value={areaKey}>
                {t(`areas.${areaKey}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="temperature-filter-field temperature-filter-field--inline">
          <span className="temperature-filter-field__label">
            {t("temperatureMonitor.month")}
          </span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => onSelectMonth(e.target.value)}
            className="temperature-filter-field__input temperature-filter-field__input--month"
          />
        </label>

        <button
          type="button"
          onClick={onOpenChart}
          disabled={!selectedArea}
          className="temperature-filter-chart-btn"
          title={t("temperatureMonitor.viewChart")}
        >
          <FaChartLine aria-hidden />
          <span className="temperature-filter-chart-btn__text">
            {t("temperatureMonitor.viewChart")}
          </span>
        </button>

        {selectedArea ? (
          <>
            <label className="temperature-filter-field temperature-filter-field--inline temperature-filter-field--grow">
              <span className="sr-only">
                {t("temperatureMonitor.searchMachine")}
              </span>
              <input
                type="search"
                value={searchMachine}
                onChange={(e) => onSearchMachineChange(e.target.value)}
                placeholder={t("temperatureMonitor.searchMachine")}
                className="temperature-filter-field__input"
                autoComplete="off"
              />
            </label>

            <button
              type="button"
              className="temperature-filter-toggle-btn"
              aria-expanded={showMachinePanel}
              onClick={onToggleMachinePanel}
            >
              {t("temperatureMonitor.machineListToggle", "Máy")} ({machineCount})
              <span aria-hidden>{showMachinePanel ? " ▴" : " ▾"}</span>
            </button>

            {canManageMachines && !isAddingMachine ? (
              <button
                type="button"
                onClick={onStartAddMachine}
                className="temperature-filter-icon-btn"
                title={t("temperatureMonitor.addMachine")}
                disabled={isLoading}
              >
                <FaPlus aria-hidden />
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {selectedArea && showMachinePanel ? (
        <div className="temperature-machine-panel">
          {filteredMachines.length === 0 && !isAddingMachine ? (
            <p className="temperature-machine-panel__empty">
              {t(
                "temperatureMonitor.noMachineGuide",
                "Chưa có máy — bấm + để thêm.",
              )}
            </p>
          ) : null}

          <ul className="temperature-machine-list">
            {pagedMachines.map((machine) => (
              <li key={machine} className="temperature-machine-list__item">
                {editingMachine === machine ? (
                  <>
                    <input
                      value={editMachineName}
                      onChange={(e) => onEditMachineNameChange(e.target.value)}
                      className="temperature-filter-field__input temperature-machine-list__edit"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onConfirmEditMachine(machine);
                        if (e.key === "Escape") onCancelEditMachine();
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => onConfirmEditMachine(machine)}
                      className="temperature-machine-list__action"
                      aria-label={t("temperatureMonitor.save", "Lưu")}
                    >
                      <FaCheck />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="temperature-machine-list__name">
                      {getMachineDisplayName(t, machine)}
                    </span>
                    {canManageMachines ? (
                      <div className="temperature-machine-list__actions">
                        <button
                          type="button"
                          onClick={() => onStartEditMachine(machine)}
                          className="temperature-machine-list__action"
                          aria-label={t("temperatureMonitor.editMachine", "Sửa máy")}
                        >
                          <FaEdit />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMachine(machine)}
                          className="temperature-machine-list__action temperature-machine-list__action--danger"
                          aria-label={t("temperatureMonitor.deleteMachine", "Xóa máy")}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="temperature-machine-panel__footer">
            {totalMachinePages > 1 ? (
              <div className="temperature-machine-panel__pager">
                <button
                  type="button"
                  onClick={onPrevMachinePage}
                  disabled={machinePage === 1}
                  className="temperature-machine-panel__pager-btn"
                  aria-label={t("temperatureMonitor.previous")}
                >
                  ‹
                </button>
                <span className="temperature-machine-panel__pager-label">
                  {machinePage}/{totalMachinePages}
                </span>
                <button
                  type="button"
                  onClick={onNextMachinePage}
                  disabled={machinePage === totalMachinePages}
                  className="temperature-machine-panel__pager-btn"
                  aria-label={t("temperatureMonitor.next")}
                >
                  ›
                </button>
              </div>
            ) : (
              <span />
            )}

            {canManageMachines && isAddingMachine ? (
              <div className="temperature-machine-panel__add-row">
                <input
                  type="text"
                  value={newMachineName}
                  onChange={(e) => onNewMachineNameChange(e.target.value)}
                  placeholder={t("temperatureMonitor.newMachine")}
                  className="temperature-filter-field__input"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={onAddMachine}
                  disabled={isLoading}
                  className="temperature-machine-panel__add-btn"
                >
                  {isLoading
                    ? t("temperatureMonitor.saving")
                    : t("temperatureMonitor.add")}
                </button>
                <button
                  type="button"
                  onClick={onCancelAddMachine}
                  disabled={isLoading}
                  className="temperature-machine-panel__cancel-btn"
                >
                  {t("temperatureMonitor.cancel")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default memo(TemperatureFilterPanel);
