import React from "react";
import ManualProductionReportPage from "./productionReport/ManualProductionReportPage";
import { ProductionReportProvider } from "./productionReport/ProductionReportContext";
import { S95H_PRODUCTION_REPORT_CONFIG } from "./productionReport/productionReportConfigs";
import { useProductionManualEntries } from "./productionReport/useProductionManualEntries";

function S95HProductionReportContent() {
  const manualEntries = useProductionManualEntries(S95H_PRODUCTION_REPORT_CONFIG);

  return <ManualProductionReportPage manualEntries={manualEntries} />;
}

export default function S95HProductionReportPage() {
  return (
    <ProductionReportProvider config={S95H_PRODUCTION_REPORT_CONFIG}>
      <S95HProductionReportContent />
    </ProductionReportProvider>
  );
}
