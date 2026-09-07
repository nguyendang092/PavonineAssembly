import React, { useMemo } from "react";
import "../dashboard.css";
import "./warehouseInventory.css";
import PageHeader from "./components/PageHeader";
import ReportKpiSection from "./components/ReportKpiSection";
import { useWarehouseInventoryDashboard } from "./hooks/useWarehouseInventoryDashboard";

export default function WarehouseInventoryPage() {
  const data = useWarehouseInventoryDashboard();

  const tableSectionProps = useMemo(
    () => ({
      tl: data.tl,
      whFilter: data.whFilter,
      setWhFilter: data.setWhFilter,
      categoryFilter: data.categoryFilter,
      setCategoryFilter: data.setCategoryFilter,
      monthFilter: data.monthFilter,
      setMonthFilter: data.setMonthFilter,
      monthCompareMode: data.monthCompareMode,
      setMonthCompareMode: data.setMonthCompareMode,
      monthCompareFrom: data.monthCompareFrom,
      setMonthCompareFrom: data.setMonthCompareFrom,
      monthCompareTo: data.monthCompareTo,
      setMonthCompareTo: data.setMonthCompareTo,
      codeSearch: data.codeSearch,
      setCodeSearch: data.setCodeSearch,
      hideZeroMonthlyDiff: data.hideZeroMonthlyDiff,
      setHideZeroMonthlyDiff: data.setHideZeroMonthlyDiff,
      hideZeroActualQty: data.hideZeroActualQty,
      setHideZeroActualQty: data.setHideZeroActualQty,
      warehouseOptions: data.warehouseOptions,
      categoryOptions: data.categoryOptions,
      monthTableOptions: data.monthTableOptions,
      structuredSummary: data.structuredSummary,
      filteredStructuredRows: data.filteredStructuredRows,
      pagedStructuredRows: data.pagedStructuredRows,
      tablePage: data.tablePage,
      setTablePage: data.setTablePage,
      tablePageSize: data.tablePageSize,
      setTablePageSize: data.setTablePageSize,
      tablePageSizeOptions: data.tablePageSizeOptions,
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
      data.monthCompareMode,
      data.setMonthCompareMode,
      data.monthCompareFrom,
      data.setMonthCompareFrom,
      data.monthCompareTo,
      data.setMonthCompareTo,
      data.codeSearch,
      data.setCodeSearch,
      data.hideZeroMonthlyDiff,
      data.setHideZeroMonthlyDiff,
      data.hideZeroActualQty,
      data.setHideZeroActualQty,
      data.warehouseOptions,
      data.categoryOptions,
      data.monthTableOptions,
      data.structuredSummary,
      data.filteredStructuredRows,
      data.pagedStructuredRows,
      data.tablePage,
      data.setTablePage,
      data.tablePageSize,
      data.setTablePageSize,
      data.tablePageSizeOptions,
      data.tableTotalPages,
      data.codeDiffSoftScale,
    ],
  );

  return (
    <div className="dashboard-print-fill wah-inv-page w-full px-3 py-4 sm:px-5">
      <PageHeader
        tl={data.tl}
        rows={data.rows}
        loading={data.loading}
        isRevalidatingCloud={data.isRevalidatingCloud}
        onRefreshCloud={data.refreshCloudSnapshot}
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
          tableSectionProps={tableSectionProps}
        />
      ) : null}
    </div>
  );
}
