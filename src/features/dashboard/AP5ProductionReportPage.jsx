import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ManualProductionReportPage from "./productionReport/ManualProductionReportPage";
import { ProductionReportProvider } from "./productionReport/ProductionReportContext";
import {
  AP5_PRODUCT_CONFIGS,
  AP5FF_PRODUCTION_REPORT_CONFIG,
} from "./productionReport/productionReportConfigs";
import { useProductionManualEntries } from "./productionReport/useProductionManualEntries";

function AP5ReportBody({ productConfig, toolbarExtra }) {
  const manualEntries = useProductionManualEntries(productConfig);

  return (
    <ManualProductionReportPage
      manualEntries={manualEntries}
      toolbarExtra={toolbarExtra}
      dailyCardIdPrefix={`ap5-${productConfig.id}-day`}
    />
  );
}

export default function AP5ProductionReportPage() {
  const { t } = useTranslation();
  const [selectedProductId, setSelectedProductId] = useState(
    AP5FF_PRODUCTION_REPORT_CONFIG.id,
  );

  const productConfig = useMemo(
    () =>
      AP5_PRODUCT_CONFIGS.find((config) => config.id === selectedProductId) ??
      AP5FF_PRODUCTION_REPORT_CONFIG,
    [selectedProductId],
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
    <ProductionReportProvider key={productConfig.id} config={productConfig}>
      <AP5ReportBody
        productConfig={productConfig}
        toolbarExtra={toolbarExtra}
      />
    </ProductionReportProvider>
  );
}
