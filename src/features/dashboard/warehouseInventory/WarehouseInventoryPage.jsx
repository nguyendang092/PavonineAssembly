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
      yearFilter: data.yearFilter,
      setYearFilter: data.setYearFilter,
      yearOptions: data.yearOptions,
      monthOptionsForYear: data.monthOptionsForYear,
      monthCompareMode: data.monthCompareMode,
      setMonthCompareMode: data.setMonthCompareMode,
      compareMonthKeys: data.compareMonthKeys,
      setCompareMonthKeys: data.setCompareMonthKeys,
      toggleCompareMonth: data.toggleCompareMonth,
      codeSearch: data.codeSearch,
      setCodeSearch: data.setCodeSearch,
      hideZeroMonthlyDiff: data.hideZeroMonthlyDiff,
      setHideZeroMonthlyDiff: data.setHideZeroMonthlyDiff,
      hideZeroActualQty: data.hideZeroActualQty,
      setHideZeroActualQty: data.setHideZeroActualQty,
      qtySort: data.qtySort,
      setQtySort: data.setQtySort,
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
      data.yearFilter,
      data.setYearFilter,
      data.yearOptions,
      data.monthOptionsForYear,
      data.monthCompareMode,
      data.setMonthCompareMode,
      data.compareMonthKeys,
      data.setCompareMonthKeys,
      data.toggleCompareMonth,
      data.codeSearch,
      data.setCodeSearch,
      data.hideZeroMonthlyDiff,
      data.setHideZeroMonthlyDiff,
      data.hideZeroActualQty,
      data.setHideZeroActualQty,
      data.qtySort,
      data.setQtySort,
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
    <div className="dashboard-print-fill wah-inv-page">
      <PageHeader
        tl={data.tl}
        rows={data.rows}
        loading={data.loading}
        isRevalidatingCloud={data.isRevalidatingCloud}
        onRefreshCloud={data.refreshCloudSnapshot}
        error={data.error}
        handleFile={data.handleFile}
        monthTableOptions={data.monthTableOptions}
        monthFilter={data.monthFilter}
        deleteMonth={data.deleteMonth}
      />

      {data.rows.length > 0 ? (
        <ReportKpiSection
          tl={data.tl}
          structuredSummary={data.structuredSummary}
          tableSectionProps={tableSectionProps}
        />
      ) : null}
    </div>
  );
}
