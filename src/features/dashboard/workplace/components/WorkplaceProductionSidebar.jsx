import React, { memo, useMemo } from "react";
import { FiUpload } from "react-icons/fi";
import { WORKPLACE_YEAR_OPTIONS } from "../lib/constants";

function parseWeekKey(weekKey) {
  const [weekNum, year] = String(weekKey ?? "").split("_");
  return { weekNum: Number(weekNum), year: Number(year) };
}

function UploadRow({
  title,
  description,
  inputId,
  inputRef,
  accept = ".xlsx,.xls",
  busy = false,
  busyLabel,
  actionLabel,
  onChange,
  disabled = false,
}) {
  return (
    <div className="wpd-upload-row">
      <div className="wpd-upload-row__body">
        <p className="wpd-upload-row__title">{title}</p>
        <p className="wpd-upload-row__desc">{description}</p>
      </div>
      <div className="wpd-upload-row__actions">
        <label
          htmlFor={inputId}
          className={`wpd-btn wpd-btn--accent${busy || disabled ? " wpd-btn--disabled" : ""}`}
        >
          <FiUpload size={14} />
          {busy ? busyLabel : actionLabel}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          onChange={onChange}
          disabled={busy || disabled}
          className="hidden"
        />
      </div>
    </div>
  );
}

export const WorkplaceProductionSidebar = memo(function WorkplaceProductionSidebar({
  t,
  user,
  selectedYear,
  setSelectedYear,
  selectedWeek,
  setSelectedWeek,
  weekData,
  isReadingTotalFile,
  isUploadingTotal,
  isReadingDetailFile,
  isUploadingDetail,
  isUploadingNgFaulty,
  totalFileInputRef,
  detailFileInputRef,
  ngFaultyFileInputRef,
  handleFileUpload,
  handleDetailUpload,
  handleNgFaultyFileUpload,
  hasChartData,
}) {
  const weekKeysForYear = useMemo(() => {
    return Object.keys(weekData ?? {})
      .filter((key) => parseWeekKey(key).year === Number(selectedYear))
      .sort((a, b) => parseWeekKey(a).weekNum - parseWeekKey(b).weekNum);
  }, [weekData, selectedYear]);

  const uploadingLabel = t("workplaceChart.uploading");
  const uploadActionLabel = t("workplaceChart.chooseFileAndUpload");

  return (
    <aside className="wpd-sidebar dashboard-no-print">
      <div className="wpd-sidebar__brand">
        <div className="wpd-sidebar__brand-mark">
          <span className="wpd-sidebar__brand-dot" aria-hidden />
          <h2 className="wpd-sidebar__brand-title">{t("workplaceChart.sidebarBrand")}</h2>
        </div>
        <p className="wpd-sidebar__brand-sub">{t("workplaceChart.sidebarBrandSub")}</p>
      </div>

      <div className="wpd-sidebar__block">
        <h3 className="wpd-sidebar__block-title">{t("workplaceChart.timeBlockTitle")}</h3>
        <div className="wpd-sidebar__field">
          <label className="wpd-sidebar__label" htmlFor="wpd-year-select">
            {t("workplaceChart.year")}
          </label>
          <select
            id="wpd-year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="wpd-sidebar__select"
          >
            {WORKPLACE_YEAR_OPTIONS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {weekKeysForYear.length > 0 ? (
          <>
            <div className="wpd-sidebar__field">
              <label className="wpd-sidebar__label" htmlFor="wpd-week-select">
                {t("workplaceChart.selectWeek")}
              </label>
              <select
                id="wpd-week-select"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="wpd-sidebar__select"
              >
                {weekKeysForYear.map((week) => (
                  <option key={week} value={week}>
                    {week} {t("workplaceChart.week")}
                  </option>
                ))}
              </select>
            </div>

            <div
              className="wpd-week-strip"
              role="listbox"
              aria-label={t("workplaceChart.weekStripLabel")}
            >
              {weekKeysForYear.map((week) => {
                const { weekNum } = parseWeekKey(week);
                const active = week === selectedWeek;
                return (
                  <button
                    key={week}
                    type="button"
                    role="option"
                    aria-selected={active}
                    title={`${t("workplaceChart.week")} ${weekNum}`}
                    className={`wpd-week-strip__dot${active ? " wpd-week-strip__dot--active" : ""}`}
                    onClick={() => setSelectedWeek(week)}
                  />
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      {user ? (
        <div className="wpd-sidebar__block">
          <h3 className="wpd-sidebar__block-title">{t("workplaceChart.uploadData")}</h3>
          <p className="wpd-upload-block__hint">{t("workplaceChart.uploadBlockHint")}</p>

          <UploadRow
            title={t("workplaceChart.chooseExceltotal")}
            description={t("workplaceChart.uploadTotalDesc")}
            inputId="file-upload-total"
            inputRef={totalFileInputRef}
            busy={isReadingTotalFile || isUploadingTotal}
            busyLabel={uploadingLabel}
            actionLabel={uploadActionLabel}
            onChange={handleFileUpload}
          />

          <UploadRow
            title={t("workplaceChart.chooseExceldetail")}
            description={t("workplaceChart.uploadDetailDesc")}
            inputId="file-upload-detail"
            inputRef={detailFileInputRef}
            busy={isReadingDetailFile || isUploadingDetail}
            busyLabel={uploadingLabel}
            actionLabel={uploadActionLabel}
            onChange={handleDetailUpload}
          />

          <UploadRow
            title={t("workplaceChart.uploadNgDetailTitle")}
            description={t("workplaceChart.uploadNgDetailHint")}
            inputId="file-upload-ng-faulty"
            inputRef={ngFaultyFileInputRef}
            busy={isUploadingNgFaulty}
            busyLabel={uploadingLabel}
            actionLabel={uploadActionLabel}
            onChange={handleNgFaultyFileUpload}
          />
        </div>
      ) : null}

      <div className="wpd-sidebar__footer">
        <span
          className={`wpd-status-dot${hasChartData ? "" : " wpd-status-dot--idle"}`}
          aria-hidden
        />
        <span>
          {hasChartData
            ? t("workplaceChart.syncLive")
            : t("workplaceChart.syncWaiting")}
        </span>
      </div>
    </aside>
  );
});

export default WorkplaceProductionSidebar;
