import React from "react";
import ManualProductionReportPage from "./productionReport/ManualProductionReportPage";
import { ProductionReportProvider } from "./productionReport/ProductionReportContext";
import { AP5_PRODUCTION_REPORT_CONFIG } from "./productionReport/productionReportConfigs";
import { useProductionManualEntries } from "./productionReport/useProductionManualEntries";

function AP5ProductionReportContent() {
  const manualEntries = useProductionManualEntries(AP5_PRODUCTION_REPORT_CONFIG);

  return (
    <ManualProductionReportPage
      manualEntries={manualEntries}
      dailyViewMode="dashboard"
    />
  );
}

export default function AP5ProductionReportPage() {
  return (
    <ProductionReportProvider config={AP5_PRODUCTION_REPORT_CONFIG}>
      <AP5ProductionReportContent />
    </ProductionReportProvider>
  );
}
