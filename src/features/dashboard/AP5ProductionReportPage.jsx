import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ManualProductionReportPage from "./productionReport/ManualProductionReportPage";
import { ProductionReportProvider } from "./productionReport/ProductionReportContext";
import {
  AP5_PRODUCT_CONFIGS,
  AP5FF_PRODUCTION_REPORT_CONFIG,
  AP5FL_PRODUCTION_REPORT_CONFIG,
  AP5FZ_PRODUCTION_REPORT_CONFIG,
} from "./productionReport/productionReportConfigs";
import { useProductionManualEntries } from "./productionReport/useProductionManualEntries";

export default function AP5ProductionReportPage() {
  const { t } = useTranslation();
  const [selectedProductId, setSelectedProductId] = useState(
    AP5FF_PRODUCTION_REPORT_CONFIG.id,
  );

  const ap5ffEntries = useProductionManualEntries(AP5FF_PRODUCTION_REPORT_CONFIG);
  const ap5fzEntries = useProductionManualEntries(AP5FZ_PRODUCTION_REPORT_CONFIG);
  const ap5flEntries = useProductionManualEntries(AP5FL_PRODUCTION_REPORT_CONFIG);

  const entriesById = useMemo(
    () => ({
      [AP5FF_PRODUCTION_REPORT_CONFIG.id]: ap5ffEntries,
      [AP5FZ_PRODUCTION_REPORT_CONFIG.id]: ap5fzEntries,
      [AP5FL_PRODUCTION_REPORT_CONFIG.id]: ap5flEntries,
    }),
    [ap5ffEntries, ap5fzEntries, ap5flEntries],
  );

  const productConfig = useMemo(
    () =>
      AP5_PRODUCT_CONFIGS.find((config) => config.id === selectedProductId) ??
      AP5FF_PRODUCTION_REPORT_CONFIG,
    [selectedProductId],
  );

  const manualEntries = entriesById[selectedProductId];
  const { selectedMonthKey } = manualEntries;

  useEffect(() => {
    AP5_PRODUCT_CONFIGS.forEach((config) => {
      if (config.id === selectedProductId) return;
      const otherEntries = entriesById[config.id];
      if (otherEntries.selectedMonthKey !== selectedMonthKey) {
        otherEntries.setSelectedMonthKey(selectedMonthKey);
      }
    });
  }, [entriesById, selectedMonthKey, selectedProductId]);

  const syncMonthAcrossProducts = useCallback(
    (monthKey) => {
      AP5_PRODUCT_CONFIGS.forEach((config) => {
        entriesById[config.id].setSelectedMonthKey(monthKey);
      });
    },
    [entriesById],
  );

  const manualEntriesWithSync = useMemo(
    () => ({
      ...manualEntries,
      setSelectedMonthKey: syncMonthAcrossProducts,
    }),
    [manualEntries, syncMonthAcrossProducts],
  );

  const totalTabSections = useMemo(
    () =>
      AP5_PRODUCT_CONFIGS.map((config) => {
        const entries = entriesById[config.id];
        return {
          productCode: config.defaultProductCode,
          summary: entries.grandTotalSummary,
          monthDisplayLabel: entries.monthDisplayLabel,
          loading: entries.loading,
        };
      }),
    [entriesById],
  );

  const toolbarExtra = (
    <label className="s90d-toolbar-field s90d-toolbar-field--product">
      <span className="s90d-toolbar-field-label">
        {t("ap5Report.productFilter", "Mã hàng")}
      </span>
      <select
        value={selectedProductId}
        onChange={(event) => setSelectedProductId(event.target.value)}
      >
        {AP5_PRODUCT_CONFIGS.map((config) => (
          <option key={config.id} value={config.id}>
            {config.defaultProductCode}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <ProductionReportProvider config={productConfig}>
      <ManualProductionReportPage
        manualEntries={manualEntriesWithSync}
        toolbarExtra={toolbarExtra}
        dailyCardIdPrefix={`ap5-${productConfig.id}-day`}
        totalTabSections={totalTabSections}
      />
    </ProductionReportProvider>
  );
}
