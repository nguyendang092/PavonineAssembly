import React from "react";
import ManualProductionReportPage from "./productionReport/ManualProductionReportPage";
import { ProductionReportProvider } from "./productionReport/ProductionReportContext";
import { S90D_PRODUCTION_REPORT_CONFIG } from "./productionReport/productionReportConfigs";
import { useProductionManualEntries } from "./productionReport/useProductionManualEntries";

function S90DProductionReportContent() {
  const manualEntries = useProductionManualEntries(S90D_PRODUCTION_REPORT_CONFIG);

  return <ManualProductionReportPage manualEntries={manualEntries} dailyViewMode="dashboard" />;
}

export default function S90DProductionReportPage() {
  return (
    <ProductionReportProvider config={S90D_PRODUCTION_REPORT_CONFIG}>
      <S90DProductionReportContent />
    </ProductionReportProvider>
  );
}
