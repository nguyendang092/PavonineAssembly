import React from "react";
import ManualProductionReportPage from "./productionReport/ManualProductionReportPage";
import { ProductionReportProvider } from "./productionReport/ProductionReportContext";
import { R95D_PRODUCTION_REPORT_CONFIG } from "./productionReport/productionReportConfigs";
import { useProductionManualEntries } from "./productionReport/useProductionManualEntries";

function R95DProductionReportContent() {
  const manualEntries = useProductionManualEntries(R95D_PRODUCTION_REPORT_CONFIG);

  return <ManualProductionReportPage manualEntries={manualEntries} />;
}

export default function R95DProductionReportPage() {
  return (
    <ProductionReportProvider config={R95D_PRODUCTION_REPORT_CONFIG}>
      <R95DProductionReportContent />
    </ProductionReportProvider>
  );
}
