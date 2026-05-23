import React, { useMemo } from "react";
import "../dashboard.css";
import "./registerChartJs";
import PageHeader from "./components/PageHeader";
import ReportKpiSection from "./components/ReportKpiSection";
import { useWarehouseInventoryDashboard } from "./hooks/useWarehouseInventoryDashboard";

export default function WarehouseInventoryPage() {
  const data = useWarehouseInventoryDashboard();

  const chartSectionProps = useMemo(
    () => ({
      tl: data.tl,
      statusChart: data.statusChart,
      whBar: data.whBar,
      whBarChartHeightPx: data.whBarChartHeightPx,
      overviewTopCodeDiffChart: data.overviewTopCodeDiffChart,
      overviewTopCodeAmountChart: data.overviewTopCodeAmountChart,
      overviewTopCodeAmountChartHeightPx: data.overviewTopCodeAmountChartHeightPx,
    }),
    [
      data.tl,
      data.statusChart,
      data.whBar,
      data.whBarChartHeightPx,
      data.overviewTopCodeDiffChart,
      data.overviewTopCodeAmountChart,
      data.overviewTopCodeAmountChartHeightPx,
    ],
  );

  const tableSectionProps = useMemo(
    () => ({
      tl: data.tl,
      whFilter: data.whFilter,
      setWhFilter: data.setWhFilter,
      categoryFilter: data.categoryFilter,
      setCategoryFilter: data.setCategoryFilter,
      monthFilter: data.monthFilter,
      setMonthFilter: data.setMonthFilter,
      codeSearch: data.codeSearch,
      setCodeSearch: data.setCodeSearch,
      hideZeroMonthlyDiff: data.hideZeroMonthlyDiff,
      setHideZeroMonthlyDiff: data.setHideZeroMonthlyDiff,
      hideZeroActualQty: data.hideZeroActualQty,
      setHideZeroActualQty: data.setHideZeroActualQty,
      softSortMode: data.softSortMode,
      setSoftSortMode: data.setSoftSortMode,
      warehouseOptions: data.warehouseOptions,
      categoryOptions: data.categoryOptions,
      monthTableOptions: data.monthTableOptions,
      structuredSummary: data.structuredSummary,
      filteredStructuredRows: data.filteredStructuredRows,
      pagedStructuredRows: data.pagedStructuredRows,
      tablePage: data.tablePage,
      setTablePage: data.setTablePage,
      tableTotalPages: data.tableTotalPages,
      codeDiffSoftScale: data.codeDiffSoftScale,
    }),
    [
      data.tl,
      data.whFilter,
      data.setWhFilter,
      data.categoryFilter,
      data.setCategoryFilter,
      data.monthFilter,
      data.setMonthFilter,
      data.codeSearch,
      data.setCodeSearch,
      data.hideZeroMonthlyDiff,
      data.setHideZeroMonthlyDiff,
      data.hideZeroActualQty,
      data.setHideZeroActualQty,
      data.softSortMode,
      data.setSoftSortMode,
      data.warehouseOptions,
      data.categoryOptions,
      data.monthTableOptions,
      data.structuredSummary,
      data.filteredStructuredRows,
      data.pagedStructuredRows,
      data.tablePage,
      data.setTablePage,
      data.tableTotalPages,
      data.codeDiffSoftScale,
    ],
  );

  return (
    <div className="dashboard-print-fill w-full px-2 py-3 sm:px-3">
      <PageHeader
        tl={data.tl}
        rows={data.rows}
        loading={data.loading}
        error={data.error}
        handleFile={data.handleFile}
        clearData={data.clearData}
      />

      {data.rows.length > 0 ? (
        <ReportKpiSection
          tl={data.tl}
          fileName={data.fileName}
          stats={data.stats}
          structuredSummary={data.structuredSummary}
          chartSectionProps={chartSectionProps}
          tableSectionProps={tableSectionProps}
        />
      ) : null}
    </div>
  );
}
