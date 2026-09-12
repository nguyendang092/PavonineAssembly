import React from "react";
import ManualProductionReportPage from "./productionReport/ManualProductionReportPage";
import { ProductionReportProvider } from "./productionReport/ProductionReportContext";
import { R95H_PRODUCTION_REPORT_CONFIG } from "./productionReport/productionReportConfigs";
import { useProductionManualEntries } from "./productionReport/useProductionManualEntries";

function R95HProductionReportContent() {
  const manualEntries = useProductionManualEntries(R95H_PRODUCTION_REPORT_CONFIG);

  return <ManualProductionReportPage manualEntries={manualEntries} />;
}

export default function R95HProductionReportPage() {
  return (
    <ProductionReportProvider config={R95H_PRODUCTION_REPORT_CONFIG}>
      <R95HProductionReportContent />
    </ProductionReportProvider>
  );
}
