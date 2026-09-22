import React from "react";
import ManualProductionReportPage from "./ManualProductionReportPage";
import { ProductionReportProvider } from "./ProductionReportContext";
import { useProductionManualEntries } from "./useProductionManualEntries";

export function createManualProductionReportPage(reportConfig) {
  function ManualProductionReportContent() {
    const manualEntries = useProductionManualEntries(reportConfig);
    return <ManualProductionReportPage manualEntries={manualEntries} />;
  }

  function ManualProductionReportRoute() {
    return (
      <ProductionReportProvider config={reportConfig}>
        <ManualProductionReportContent />
      </ProductionReportProvider>
    );
  }

  ManualProductionReportRoute.displayName = `ManualProductionReport(${
    reportConfig?.id || reportConfig?.defaultProductCode || "report"
  })`;

  return ManualProductionReportRoute;
}
