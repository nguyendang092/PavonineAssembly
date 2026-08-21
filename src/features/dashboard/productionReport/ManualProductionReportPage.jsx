import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import AlertMessage from "@/components/ui/AlertMessage";
import LoadingBlock from "@/components/ui/LoadingBlock";
import S90dProcessTabPanel from "../s90d/components/S90dProcessTabPanel";
import S90dDailyTabPanel from "../s90d/components/S90dDailyTabPanel";
import S90dSummaryChartModal from "../s90d/components/S90dSummaryChartModal";
import {
  buildProductScopedGrandTotalSummary,
  buildProductScopedMonthDailySummaries,
} from "../s90d/lib/buildS90dFromManual";
import { S90D_PROCESSES } from "../s90d/lib/s90dDefectColumns";
import { formatS90dMonthDisplayLabel } from "../s90d/lib/s90dDateUtils";
import { useReportT } from "./useReportTranslation";
import "../s90d/s90dProductionReport.css";

const BASE_TABS = Object.freeze({
  TOTAL: "total",
  DAILY: "daily",
});

export default function ManualProductionReportPage({
  manualEntries,
  toolbarExtra = null,
}) {
  const { t } = useTranslation();
  const rt = useReportT();
  const excelInputRef = useRef(null);
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [activeTab, setActiveTab] = useState(BASE_TABS.TOTAL);
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
    pendingSyncCount,
    processSyncRevision,
    saveProcessMonth,
    exportMonthToExcel,
    importMonthFromExcel,
    getProcessEntry,
    saveProcessDraft,
    loadProcessDraft,
    clearProcessDraft,
    monthDisplayLabel,
    monthOptions,
    selectedMonthKey,
    setSelectedMonthKey,
    monthDayKeys,
    monthDailySummaries,
    grandTotalSummary,
    hasAnyData,
    processes = S90D_PROCESSES,
    manualEntryConfig,
  } = manualEntries;

  const productBoardSpecs = useMemo(() => {
    if (
      !manualEntryConfig?.fixedBoardSpecsAllProcesses ||
      !manualEntryConfig?.fixedBoardSpecs?.length
    ) {
      return [];
    }
    return manualEntryConfig.fixedBoardSpecs;
  }, [manualEntryConfig]);

  const usesMultiProductSummary = productBoardSpecs.length >= 2;

  const productSummarySections = useMemo(() => {
    if (!usesMultiProductSummary) return null;

    return productBoardSpecs.map((spec) => ({
      productCode: spec.productCode,
      label: spec.label ?? spec.productCode,
      monthDailySummaries: buildProductScopedMonthDailySummaries(
        monthDailySummaries,
        spec.productCode,
        manualEntryConfig,
      ),
      grandTotalSummary: buildProductScopedGrandTotalSummary(
        monthDailySummaries,
        spec.productCode,
        manualEntryConfig,
      ),
    }));
  }, [
    manualEntryConfig,
    monthDailySummaries,
    productBoardSpecs,
    usesMultiProductSummary,
  ]);

  const tabOrder = useMemo(
    () => [BASE_TABS.TOTAL, BASE_TABS.DAILY, ...processes],
    [processes],
  );

  const isProcessTab = processes.includes(activeTab);
  const isSummaryTab =
    activeTab === BASE_TABS.TOTAL || activeTab === BASE_TABS.DAILY;
  const excelBusy = saving || importing;

  useLayoutEffect(() => {
    const node = headerRef.current;
    if (!node) return undefined;

    const syncHeight = () => {
      setHeaderHeight(node.offsetHeight);
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(node);
    window.addEventListener("resize", syncHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, [syncError, isSummaryTab, activeTab, loading, toolbarExtra]);

  const handleProcessSave = useCallback(
    async (localByDate) => {
      try {
        await saveProcessMonth(activeTab, monthDayKeys, localByDate);
        setSaveAlert({
          show: true,
          type: "success",
          message: rt("saveSuccess", "✅ Lưu thành công"),
        });
      } catch {
        setSaveAlert({
          show: true,
          type: "error",
          message: rt(
            "saveFailed",
            "❌ Lưu thất bại — kiểm tra kết nối và thử lại",
          ),
        });
        throw new Error("SAVE_FAILED");
      }
    },
    [activeTab, monthDayKeys, rt, saveProcessMonth],
  );

  const handleExportExcel = useCallback(() => {
    exportMonthToExcel(isProcessTab ? activeTab : null);
    setSaveAlert({
      show: true,
      type: "success",
      message: rt("exportSuccess", "✅ Đã xuất file Excel"),
    });
  }, [activeTab, exportMonthToExcel, isProcessTab, rt]);

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
          message: rt("importSuccess", "✅ Đã nhập {{count}} dòng từ Excel", {
            count: importedCount,
          }),
        });
      } catch (error) {
        if (String(error?.message) === "EMPTY_IMPORT") {
          setSaveAlert({
            show: true,
            type: "error",
            message: rt(
              "importEmpty",
              "❌ File Excel không có dòng dữ liệu hợp lệ",
            ),
          });
          return;
        }
        setSaveAlert({
          show: true,
          type: "error",
          message: rt(
            "importFailed",
            "❌ Không đọc được file Excel — kiểm tra định dạng",
          ),
        });
      }
    },
    [importMonthFromExcel, rt],
  );

  const tabLabels = useMemo(
    () => ({
      [BASE_TABS.TOTAL]: rt("tabTotal", "Tổng"),
      [BASE_TABS.DAILY]: rt("tabDaily", "Theo ngày"),
      ...Object.fromEntries(
        processes.map((process) => [
          process,
          t(`areas.${process}`, { defaultValue: process }),
        ]),
      ),
    }),
    [processes, rt, t],
  );

  const pageSubtitle = rt("pageSubtitle", "");

  const summaryPanelProps = {
    monthDailySummaries,
    grandTotalSummary,
    monthDisplayLabel,
    productSections: productSummarySections,
  };

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

      <div ref={headerRef} className="s90d-report-sticky dashboard-no-print">
        <div className="s90d-report-header">
          <div>
            <h1 className="s90d-report-title">
              {rt("pageTitle", "Báo cáo sản lượng")}
            </h1>
            {pageSubtitle ? (
              <p className="s90d-report-subtitle">{pageSubtitle}</p>
            ) : null}
          </div>

          <div className="s90d-toolbar">
            <div className="s90d-toolbar-filters">
              {toolbarExtra}
              <label className="s90d-toolbar-field">
                <span className="s90d-toolbar-field-label">
                  {rt("monthYearFilter", "Tháng/Năm")}
                </span>
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
            </div>

            <div className="s90d-toolbar-actions">
              <span className="s90d-toolbar-field-label s90d-toolbar-actions-label">
                {rt("toolbarActions", "Thao tác")}
              </span>
              <div className="s90d-toolbar-actions-row">
                <button
                  type="button"
                  className="s90d-excel-btn"
                  disabled={loading || excelBusy}
                  onClick={handleExportExcel}
                >
                  {rt("exportExcel", "Xuất Excel")}
                </button>
                <button
                  type="button"
                  className="s90d-excel-btn s90d-excel-btn--import"
                  disabled={loading || excelBusy}
                  onClick={() => excelInputRef.current?.click()}
                >
                  {importing
                    ? rt("importingExcel", "Đang nhập…")
                    : rt("importExcel", "Nhập Excel")}
                </button>

                {isSummaryTab ? (
                  <button
                    type="button"
                    className="s90d-chart-btn"
                    disabled={loading || !hasAnyData}
                    onClick={() => setChartModalOpen(true)}
                  >
                    {rt("viewChart", "Xem biểu đồ")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div
          className="s90d-tabs"
          role="tablist"
          aria-label={rt("tabsLabel", "Loại báo cáo sản lượng")}
        >
          {tabOrder.map((tabKey) => (
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
          <div className="s90d-sync-banner">{syncError}</div>
        ) : null}
        {!syncError && pendingSyncCount > 0 ? (
          <div className="s90d-sync-banner s90d-sync-banner--pending">
            {rt(
              "pendingSyncBanner",
              "Có {{count}} thay đổi chờ đồng bộ Firebase khi có mạng.",
              { count: pendingSyncCount },
            )}
          </div>
        ) : null}
      </div>

      <div
        className="s90d-report-sticky-spacer"
        style={{ height: headerHeight || undefined }}
        aria-hidden="true"
      />

      <S90dSummaryChartModal
        isOpen={chartModalOpen && isSummaryTab}
        onClose={() => setChartModalOpen(false)}
        variant={activeTab === BASE_TABS.DAILY ? "daily" : "total"}
        grandTotalSummary={grandTotalSummary}
        monthDailySummaries={monthDailySummaries}
        monthDisplayLabel={monthDisplayLabel}
      />

      {loading ? (
        <LoadingBlock label={rt("loadingManual", "Đang tải dữ liệu…")} />
      ) : (
        <>
          {!hasAnyData ? (
            <div className="s90d-demo-banner dashboard-no-print">
              {rt(
                "manualEntryHint",
                "Chưa có số liệu. Mở tab PRESS, HAIRLINE, ANODIZING hoặc ASSEMBLY để nhập số lượng theo ngày.",
              )}
            </div>
          ) : null}

          {activeTab === BASE_TABS.TOTAL ? (
            <section
              className="s90d-report-section"
              role="tabpanel"
              aria-label={tabLabels[BASE_TABS.TOTAL]}
            >
              <S90dDailyTabPanel variant="total" {...summaryPanelProps} />
            </section>
          ) : activeTab === BASE_TABS.DAILY ? (
            <section
              className="s90d-report-section"
              role="tabpanel"
              aria-label={tabLabels[BASE_TABS.DAILY]}
            >
              <S90dDailyTabPanel {...summaryPanelProps} />
            </section>
          ) : isProcessTab ? (
            <S90dProcessTabPanel
              key={`${activeTab}-${selectedMonthKey}`}
              process={activeTab}
              monthKey={selectedMonthKey}
              monthDayKeys={monthDayKeys}
              processSyncRevision={processSyncRevision}
              getProcessEntry={getProcessEntry}
              onSave={handleProcessSave}
              saving={saving}
              saveProcessDraft={saveProcessDraft}
              loadProcessDraft={loadProcessDraft}
              clearProcessDraft={clearProcessDraft}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
