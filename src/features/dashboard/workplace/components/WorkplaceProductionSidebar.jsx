import React, { memo } from "react";
import { FiUpload } from "react-icons/fi";
import Sidebar from "@/components/layout/Sidebar";
import { WORKPLACE_YEAR_OPTIONS } from "../lib/constants";

export const WorkplaceProductionSidebar = memo(function WorkplaceProductionSidebar({
  t,
  user,
  sidebarOpen,
  setSidebarOpen,
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
  pendingNgFaultyFile,
  setPendingNgFaultyFile,
  totalFileInputRef,
  detailFileInputRef,
  handleFileUpload,
  handleDetailUpload,
  handleDetailUploadToFirebase,
  handleTotalUploadClick,
  handleNgFaultyUpload,
  detailData,
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-expanded={sidebarOpen}
        aria-label={t("workplaceChart.toggleSidebar")}
        className="dashboard-no-print fixed left-4 top-20 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-md transition hover:bg-slate-50 hover:shadow-lg focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        style={{ zIndex: "var(--z-scroll-actions, 80)" }}
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      {sidebarOpen ? (
        <button
          type="button"
          className="dashboard-no-print fixed inset-x-0 bottom-0 top-[var(--app-navbar-height)] z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity dark:bg-black/50"
          aria-label={t("workplaceChart.toggleSidebar")}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        className="!z-50 !space-y-0 !border-r !border-white/10 !bg-black/70 !backdrop-blur-md"
      >
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-lg lg:text-2xl font-bold text-white mb-3 uppercase">
              {t("workplaceChart.menuTitle")}
            </h2>
          </div>

          {/* Year Selection */}
          <div>
            <label className="block text-white font-medium mb-2 text-sm">
              {t("workplaceChart.year")}
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              {WORKPLACE_YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            {Object.keys(weekData).length > 0 && (
              <>
                <label className="block text-white font-medium mb-2 text-sm">
                  {t("workplaceChart.selectWeek")}
                </label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  {[...Object.keys(weekData)]
                    .sort(
                      (a, b) =>
                        Number(a.split("_")[0]) - Number(b.split("_")[0]),
                    )
                    .map((week) => (
                      <option key={week} value={week}>
                        {week} {t("workplaceChart.week")}
                      </option>
                    ))}
                </select>
              </>
            )}
          </div>
        </div>

        {/* Upload section */}
        {user && (
          <div className="space-y-3">
            <p className="uppercase text-sm text-white tracking-wide">
              {t("workplaceChart.uploadData")}
            </p>
            <div className="flex items-center justify-between gap-2 bg-white/10 rounded-lg p-2">
              <label
                htmlFor="file-upload-total"
                className={`p-2 text-white rounded-lg ${
                  isReadingTotalFile || isUploadingTotal
                    ? "cursor-not-allowed bg-slate-400"
                    : "cursor-pointer bg-blue-500 hover:bg-blue-600"
                }`}
                title="Chọn file"
              >
                <FiUpload size={16} />
              </label>
              <span className="text-white text-xs font-medium flex-1 text-center">
                {t("workplaceChart.chooseExceltotal")}
              </span>
              <button
                onClick={handleTotalUploadClick}
                disabled={isUploadingTotal || isReadingTotalFile}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingTotal
                  ? "Đang upload..."
                  : t("workplaceChart.uploadFirebase")}
              </button>
              <input
                ref={totalFileInputRef}
                id="file-upload-total"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                disabled={isReadingTotalFile || isUploadingTotal}
                className="hidden"
              />
            </div>

            <div className="flex items-center justify-between gap-2 bg-white/10 rounded-lg p-2">
              <label
                htmlFor="file-upload-detail"
                className={`p-2 text-white rounded-lg ${
                  isReadingDetailFile || isUploadingDetail
                    ? "cursor-not-allowed bg-slate-400"
                    : "cursor-pointer bg-blue-500 hover:bg-blue-600"
                }`}
                title="Chọn file"
              >
                <FiUpload size={16} />
              </label>
              <span className="text-white text-xs font-medium flex-1 text-center">
                {t("workplaceChart.chooseExceldetail")}
              </span>
              <button
                onClick={handleDetailUploadToFirebase}
                disabled={
                  !detailData || isUploadingDetail || isReadingDetailFile
                }
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingDetail
                  ? "Đang upload..."
                  : t("workplaceChart.uploadFirebase")}
              </button>
              <input
                ref={detailFileInputRef}
                id="file-upload-detail"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleDetailUpload}
                disabled={isReadingDetailFile || isUploadingDetail}
                className="hidden"
              />
            </div>

            <div className="mt-2 border-t border-white/20 pt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-100">
                {t("workplaceChart.uploadNgDetailTitle")}
              </p>
              <p className="mb-2 text-[10px] leading-snug text-white/75">
                {t("workplaceChart.uploadNgDetailHint")}
              </p>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-white/10 p-2">
                <label
                  htmlFor="file-upload-ng-faulty"
                  className={`rounded-lg p-2 text-white ${
                    isUploadingNgFaulty
                      ? "cursor-not-allowed bg-slate-400"
                      : "cursor-pointer bg-rose-600 hover:bg-rose-700"
                  }`}
                  title={t("workplaceChart.chooseNgExcel")}
                >
                  <FiUpload size={16} />
                </label>
                <span className="flex-1 text-center text-xs font-medium text-white">
                  {pendingNgFaultyFile?.name ||
                    t("workplaceChart.chooseNgExcel")}
                </span>
                <button
                  type="button"
                  onClick={handleNgFaultyUpload}
                  disabled={isUploadingNgFaulty}
                  className="rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 px-3 py-1 text-xs font-medium text-white transition hover:from-rose-700 hover:to-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUploadingNgFaulty
                    ? "Đang upload..."
                    : t("workplaceChart.uploadFirebase")}
                </button>
                <input
                  id="file-upload-ng-faulty"
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setPendingNgFaultyFile(f || null);
                  }}
                  disabled={isUploadingNgFaulty}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        )}
      </Sidebar>
    </>
  );
});

export default WorkplaceProductionSidebar;
