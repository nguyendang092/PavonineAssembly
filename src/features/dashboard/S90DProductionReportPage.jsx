import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import AlertMessage from "@/components/ui/AlertMessage";
import LoadingBlock from "@/components/ui/LoadingBlock";
import S90dProcessTabPanel from "./s90d/components/S90dProcessTabPanel";
import S90dSummaryChartModal from "./s90d/components/S90dSummaryChartModal";
import S90dSummaryTable from "./s90d/components/S90dSummaryTable";
import { useS90dManualEntries } from "./s90d/hooks/useS90dManualEntries";
import { S90D_PROCESSES } from "./s90d/lib/s90dDefectColumns";
import { formatS90dMonthDisplayLabel } from "./s90d/lib/s90dDateUtils";
import "./s90d/s90dProductionReport.css";

const TABS = Object.freeze({
  TOTAL: "total",
  DAILY: "daily",
  ...Object.fromEntries(S90D_PROCESSES.map((process) => [process, process])),
});

const TAB_ORDER = Object.freeze([TABS.TOTAL, TABS.DAILY, ...S90D_PROCESSES]);

export default function S90DProductionReportPage() {
  const { t } = useTranslation();
  const excelInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState(TABS.TOTAL);
  const [saveAlert, setSaveAlert] = useState({
    show: false,
    type: "success",
    message: "",
  });
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const {
    loading,
    saving,
    importing,
    syncError,
    storeRevision,
    saveProcessMonth,
    exportMonthToExcel,
    importMonthFromExcel,
    getProcessEntry,
    monthDisplayLabel,
    monthOptions,
    selectedMonthKey,
    setSelectedMonthKey,
    monthDayKeys,
    monthDailySummaries,
    grandTotalSummary,
    hasAnyData,
  } = useS90dManualEntries();

  const isProcessTab = S90D_PROCESSES.includes(activeTab);
  const isSummaryTab = activeTab === TABS.TOTAL || activeTab === TABS.DAILY;
  const excelBusy = saving || importing;

  const handleProcessSave = useCallback(
    async (localByDate) => {
      try {
        await saveProcessMonth(activeTab, monthDayKeys, localByDate);
        setSaveAlert({
          show: true,
          type: "success",
          message: t("s90dReport.saveSuccess", "✅ Lưu thành công"),
        });
      } catch {
        setSaveAlert({
          show: true,
          type: "error",
          message: t(
            "s90dReport.saveFailed",
            "❌ Lưu thất bại — kiểm tra kết nối và thử lại",
          ),
        });
        throw new Error("SAVE_FAILED");
      }
    },
    [activeTab, monthDayKeys, saveProcessMonth, t],
  );

  const handleExportExcel = useCallback(() => {
    exportMonthToExcel(isProcessTab ? activeTab : null);
    setSaveAlert({
      show: true,
      type: "success",
      message: t("s90dReport.exportSuccess", "✅ Đã xuất file Excel"),
    });
  }, [activeTab, exportMonthToExcel, isProcessTab, t]);

  const handleExcelFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      try {
        const { importedCount } = await importMonthFromExcel(file);
        setSaveAlert({
          show: true,
          type: "success",
          message: t("s90dReport.importSuccess", "✅ Đã nhập {{count}} dòng từ Excel", {
            count: importedCount,
          }),
        });
      } catch (error) {
        if (String(error?.message) === "EMPTY_IMPORT") {
          setSaveAlert({
            show: true,
            type: "error",
            message: t(
              "s90dReport.importEmpty",
              "❌ File Excel không có dòng dữ liệu hợp lệ",
            ),
          });
          return;
        }
        setSaveAlert({
          show: true,
          type: "error",
          message: t(
            "s90dReport.importFailed",
            "❌ Không đọc được file Excel — kiểm tra định dạng",
          ),
        });
      }
    },
    [importMonthFromExcel, t],
  );

  const tabLabels = useMemo(
    () => ({
      [TABS.TOTAL]: t("s90dReport.tabTotal", "Tổng"),
      [TABS.DAILY]: t("s90dReport.tabDaily", "Theo ngày"),
      ...Object.fromEntries(
        S90D_PROCESSES.map((process) => [
          process,
          t(`areas.${process}`, { defaultValue: process }),
        ]),
      ),
    }),
    [t],
  );

  return (
    <div className="s90d-report-page">
      <AlertMessage
        alert={saveAlert}
        onClose={() => setSaveAlert((prev) => ({ ...prev, show: false }))}
      />
      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleExcelFileChange}
      />

      <div className="s90d-report-header dashboard-no-print">
        <div>
          <h1 className="s90d-report-title">
            {t("s90dReport.pageTitle", "Báo cáo sản lượng S90D")}
          </h1>
          <p className="s90d-report-subtitle">
            {t(
              "s90dReport.pageSubtitle",
              "Nhập số liệu ở tab công đoạn; tab Theo ngày và Tổng tự tính tổng",
            )}
          </p>
        </div>

        <div className="s90d-toolbar">
          <label>
            {t("s90dReport.monthYearFilter", "Tháng/Năm")}
            <select
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
            >
              {monthOptions.map((monthKey) => (
                <option key={monthKey} value={monthKey}>
                  {formatS90dMonthDisplayLabel(monthKey)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="s90d-excel-btn"
            disabled={loading || excelBusy}
            onClick={handleExportExcel}
          >
            {t("s90dReport.exportExcel", "Xuất Excel")}
          </button>
          <button
            type="button"
            className="s90d-excel-btn s90d-excel-btn--import"
            disabled={loading || excelBusy}
            onClick={() => excelInputRef.current?.click()}
          >
            {importing
              ? t("s90dReport.importingExcel", "Đang nhập…")
              : t("s90dReport.importExcel", "Nhập Excel")}
          </button>

          {isSummaryTab ? (
            <button
              type="button"
              className="s90d-chart-btn"
              disabled={loading || !hasAnyData}
              onClick={() => setChartModalOpen(true)}
            >
              {t("s90dReport.viewChart", "Xem biểu đồ")}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="s90d-tabs dashboard-no-print"
        role="tablist"
        aria-label={t("s90dReport.tabsLabel", "Loại báo cáo S90D")}
      >
        {TAB_ORDER.map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            role="tab"
            aria-selected={activeTab === tabKey}
            className={`s90d-tab${activeTab === tabKey ? " s90d-tab--active" : ""}`}
            onClick={() => setActiveTab(tabKey)}
          >
            {tabLabels[tabKey]}
          </button>
        ))}
      </div>

      {syncError ? (
        <div className="s90d-sync-banner dashboard-no-print">{syncError}</div>
      ) : null}

      <S90dSummaryChartModal
        isOpen={chartModalOpen && isSummaryTab}
        onClose={() => setChartModalOpen(false)}
        variant={activeTab === TABS.DAILY ? "daily" : "total"}
        grandTotalSummary={grandTotalSummary}
        monthDailySummaries={monthDailySummaries}
        monthDisplayLabel={monthDisplayLabel}
      />

      {loading ? (
        <LoadingBlock
          label={t("s90dReport.loadingManual", "Đang tải dữ liệu S90D…")}
        />
      ) : (
        <>
          {!hasAnyData ? (
            <div className="s90d-demo-banner dashboard-no-print">
              {t(
                "s90dReport.manualEntryHint",
                "Chưa có số liệu. Mở tab PRESS, HAIRLINE, ANODIZING hoặc ASSEMBLY để nhập số lượng theo ngày.",
              )}
            </div>
          ) : null}

          {activeTab === TABS.TOTAL ? (
            <section
              className="s90d-report-section"
              role="tabpanel"
              aria-label={tabLabels[TABS.TOTAL]}
            >
              <S90dSummaryTable
                summary={grandTotalSummary}
                variant="total"
                monthLabel={monthDisplayLabel}
              />
            </section>
          ) : activeTab === TABS.DAILY ? (
            <section
              className="s90d-report-section"
              role="tabpanel"
              aria-label={tabLabels[TABS.DAILY]}
            >
              <div className="s90d-daily-grid">
                {monthDailySummaries.map((dailySummary) => (
                  <div
                    key={dailySummary.dateKey}
                    className="s90d-daily-card"
                    id={`s90d-day-${dailySummary.dateKey}`}
                  >
                    <S90dSummaryTable
                      summary={dailySummary}
                      variant="daily"
                      dateLabel={dailySummary.dateLabel}
                      dateKey={dailySummary.dateKey}
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : isProcessTab ? (
            <S90dProcessTabPanel
              key={`${activeTab}-${selectedMonthKey}`}
              process={activeTab}
              monthDayKeys={monthDayKeys}
              storeRevision={storeRevision}
              getProcessEntry={getProcessEntry}
              onSave={handleProcessSave}
              saving={saving}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
