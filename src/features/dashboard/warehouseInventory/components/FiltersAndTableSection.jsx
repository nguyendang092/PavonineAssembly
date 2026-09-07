import React, { memo, useCallback } from "react";
import { formatKRW } from "../lib/parse";

function FilterField({ label, children, compare = false }) {
  return (
    <div className={compare ? "wah-inv-field wah-inv-field--compare" : "wah-inv-field"}>
      <label className="wah-inv-field__label">{label}</label>
      {children}
    </div>
  );
}

function FiltersAndTableSection(props) {
  const {
    tl,
    whFilter,
    setWhFilter,
    categoryFilter,
    setCategoryFilter,
    monthFilter,
    setMonthFilter,
    monthCompareMode,
    setMonthCompareMode,
    monthCompareFrom,
    setMonthCompareFrom,
    monthCompareTo,
    setMonthCompareTo,
    codeSearch,
    setCodeSearch,
    hideZeroMonthlyDiff,
    setHideZeroMonthlyDiff,
    hideZeroActualQty,
    setHideZeroActualQty,
    warehouseOptions,
    categoryOptions,
    monthTableOptions,
    structuredSummary,
    pagedStructuredRows,
    tablePage,
    setTablePage,
    tablePageSize,
    setTablePageSize,
    tablePageSizeOptions,
    tableTotalPages,
    codeDiffSoftScale,
  } = props;

  const totalRows = props.filteredStructuredRows.length;
  const pageStart = totalRows === 0 ? 0 : (tablePage - 1) * tablePageSize + 1;
  const pageEnd = Math.min(tablePage * tablePageSize, totalRows);
  const monthCompareNeedsPick =
    monthCompareMode && (!monthCompareFrom || !monthCompareTo);
  const tableColSpan = 13;

  const rowBackground = useCallback(
    (r, idx) => {
      const ratio = Math.min(
        1,
        Math.abs(r.gapAmount ?? 0) / codeDiffSoftScale,
      );
      const alpha = 0.04 + ratio * 0.12;
      if ((r.gapAmount ?? 0) > 0) {
        return `rgba(254, 202, 202, ${alpha})`;
      }
      if ((r.gapAmount ?? 0) < 0) {
        return `rgba(191, 219, 254, ${alpha})`;
      }
      return idx % 2 === 0 ? "transparent" : "rgba(148, 163, 184, 0.06)";
    },
    [codeDiffSoftScale],
  );

  const renderWarehouseRow = useCallback(
    (r, idx, rowNo) => (
      <tr
        key={`${r.whCode}-${r.warehouseName}-${r.category}-${r.monthKey}-${r.code}-${idx}`}
        style={{ backgroundColor: rowBackground(r, idx) }}
      >
        <td className="wah-inv-td-num text-slate-500">{rowNo}</td>
        <td className="text-left text-slate-700 dark:text-slate-200">{r.month}</td>
        <td>{r.category}</td>
        <td className="wah-inv-td-code">{r.whCode}</td>
        <td
          className="wah-inv-td-truncate text-left"
          title={r.warehouseName !== "—" ? String(r.warehouseName) : undefined}
        >
          {r.warehouseName}
        </td>
        <td
          className="wah-inv-td-truncate text-left"
          title={r.item !== "—" ? String(r.item) : undefined}
        >
          {r.item}
        </td>
        <td
          className="wah-inv-td-truncate font-semibold uppercase text-violet-700 dark:text-violet-300"
          title={r.status !== "—" ? String(r.status) : undefined}
        >
          {r.status}
        </td>
        <td className="wah-inv-td-code">
          {r.code === "∅" ? tl("codeEmptyLabel", "(코드 없음)") : r.code}
        </td>
        <td
          className="wah-inv-td-truncate"
          title={r.unit !== "—" ? String(r.unit) : undefined}
        >
          {r.unit}
        </td>
        <td
          className="wah-inv-td-truncate text-left"
          title={r.reason !== "—" ? String(r.reason) : undefined}
        >
          {r.reason}
        </td>
        <td className="wah-inv-td-num text-amber-800 dark:text-amber-200">
          {r.actualQty.toLocaleString("vi-VN", { maximumFractionDigits: 4 })}
        </td>
        <td className="wah-inv-td-num text-slate-700 dark:text-slate-200">
          {r.sysQty.toLocaleString("vi-VN", { maximumFractionDigits: 4 })}
        </td>
        <td className="wah-inv-td-num text-emerald-800 dark:text-emerald-200">
          {formatKRW(r.amountActual ?? 0)}
        </td>
      </tr>
    ),
    [rowBackground, tl],
  );

  return (
    <>
      <div className="dashboard-no-print wah-inv-panel">
        <div className="wah-inv-panel__head">
          <div>
            <p className="wah-inv-panel__title">
              {tl("filtersSectionTitle", "Bộ lọc")}
            </p>
            <p className="wah-inv-panel__hint">
              {tl(
                "filtersSectionHint",
                "Lọc theo điều kiện — KPI và bảng cập nhật ngay.",
              )}
            </p>
          </div>
        </div>

        <div className="wah-inv-panel__body">
          <div className="wah-inv-filter-grid">
            <FilterField label={tl("filterWh", "Kho")}>
              <select
                value={whFilter}
                onChange={(ev) => setWhFilter(ev.target.value)}
                className="wah-inv-control"
              >
                <option value="">{tl("filterWhAll", "Tất cả kho")}</option>
                {warehouseOptions.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label={tl("colCategoryKr", "구분")}>
              <select
                value={categoryFilter}
                onChange={(ev) => setCategoryFilter(ev.target.value)}
                className="wah-inv-control"
              >
                <option value="">{tl("filterAll", "Tất cả")}</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField
              label={
                monthCompareMode
                  ? tl("monthCompareSectionTitle", "So sánh 2 tháng")
                  : tl("monthFilterLabel", "Tháng")
              }
              compare={monthCompareMode}
            >
              {monthCompareMode ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    value={monthCompareFrom}
                    onChange={(ev) => setMonthCompareFrom(ev.target.value)}
                    className="wah-inv-control"
                  >
                    <option value="">
                      {tl("monthCompareFrom", "Tháng trước")}
                    </option>
                    {monthTableOptions.map((m) => (
                      <option key={`from-${m.value}`} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={monthCompareTo}
                    onChange={(ev) => setMonthCompareTo(ev.target.value)}
                    className="wah-inv-control"
                  >
                    <option value="">
                      {tl("monthCompareTo", "Tháng sau")}
                    </option>
                    {monthTableOptions.map((m) => (
                      <option key={`to-${m.value}`} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <select
                  value={monthFilter}
                  onChange={(ev) => setMonthFilter(ev.target.value)}
                  className="wah-inv-control"
                >
                  <option value="">{tl("filterAllMonths", "Tất cả tháng")}</option>
                  {monthTableOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </FilterField>

            <FilterField label="CODE / ITEM">
              <input
                value={codeSearch}
                onChange={(ev) => setCodeSearch(ev.target.value)}
                placeholder={tl("searchCodePlaceholder", "Tìm CODE, ITEM…")}
                className="wah-inv-control"
              />
            </FilterField>
          </div>

          <div className="wah-inv-toolbar">
            <div className="wah-inv-chips">
              <label
                className={`wah-inv-chip ${hideZeroMonthlyDiff ? "wah-inv-chip--active" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={hideZeroMonthlyDiff}
                  onChange={(e) => setHideZeroMonthlyDiff(e.target.checked)}
                />
                {tl("hideZeroMonthlyDiff", "Ẩn GAP = 0")}
              </label>
              <label
                className={`wah-inv-chip ${hideZeroActualQty ? "wah-inv-chip--active" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={hideZeroActualQty}
                  onChange={(e) => setHideZeroActualQty(e.target.checked)}
                />
                {tl("hideZeroActualQty", "Ẩn SL thực tế & hệ thống = 0")}
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                setMonthCompareMode((on) => {
                  const next = !on;
                  if (next) setMonthFilter("");
                  else {
                    setMonthCompareFrom("");
                    setMonthCompareTo("");
                  }
                  return next;
                });
              }}
              className={`wah-inv-toggle ${monthCompareMode ? "wah-inv-toggle--active" : ""}`}
            >
              {tl("monthCompareModeButton", "So sánh 12 tháng")}
            </button>
          </div>
        </div>
      </div>

      <div className="wah-inv-table-section">
        <div className="wah-inv-table-section__head">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            {tl("structuredTableTitle", "Chi tiết theo tháng × mã")}
          </p>
          <span className="text-[11px] font-semibold tabular-nums text-slate-500">
            {structuredSummary.rows.toLocaleString("vi-VN")}{" "}
            {tl("tableRowsLabel", "dòng")}
          </span>
        </div>

        <div className="wah-inv-table-wrap">
          <table className="wah-inv-table">
            <thead>
              <tr>
                <th>{tl("colStt", "STT")}</th>
                <th className="text-left">Month</th>
                <th>{tl("colCategoryKr", "구분")}</th>
                <th>{tl("colWarehouseCode", "Mã kho")}</th>
                <th className="text-left">{tl("colWarehouse", "Kho")}</th>
                <th className="text-left">{tl("colItem", "ITEM")}</th>
                <th>{tl("colStatus", "STATUS")}</th>
                <th>CODE</th>
                <th>{tl("colUnit", "Đơn vị")}</th>
                <th className="text-left">{tl("colReason", "Lý do")}</th>
                <th>{tl("colActualQty", "SL thực tế")}</th>
                <th>{tl("colSystemQtyKr", "SL hệ thống")}</th>
                <th>{tl("colAmount", "Số tiền")}</th>
              </tr>
            </thead>
            <tbody>
              {pagedStructuredRows.length > 0 ? (
                pagedStructuredRows.map((r, idx) =>
                  renderWarehouseRow(r, idx, pageStart + idx),
                )
              ) : (
                <tr>
                  <td colSpan={tableColSpan} className="py-10 text-sm text-slate-500">
                    {monthCompareNeedsPick
                      ? tl(
                          "monthComparePickBoth",
                          "Chọn đủ tháng trước và tháng sau để xem chênh lệch.",
                        )
                      : monthCompareMode
                        ? tl(
                            "monthCompareNoMatches",
                            "Không có mã trùng khớp giữa hai tháng đã chọn.",
                          )
                        : tl("tableEmpty", "Không có dòng phù hợp bộ lọc.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="wah-inv-pagination dashboard-no-print">
          <span className="tabular-nums">
            {tl(
              "tablePageRangeSummary",
              "Dòng {{from}}–{{to}} / {{count}} · trang {{page}}/{{total}}",
              {
                from: pageStart,
                to: pageEnd,
                count: totalRows,
                page: tablePage,
                total: tableTotalPages,
              },
            )}
          </span>
          <div className="wah-inv-pagination__actions">
            <label className="flex items-center gap-1.5">
              <span>{tl("rowsPerPage", "Dòng/trang")}</span>
              <select
                value={tablePageSize}
                onChange={(ev) => setTablePageSize(Number(ev.target.value))}
                className="wah-inv-control !w-auto py-1"
              >
                {tablePageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setTablePage((p) => Math.max(1, p - 1))}
              disabled={tablePage <= 1}
              className="wah-inv-page-btn"
            >
              {tl("paginationPrev", "Trước")}
            </button>
            <button
              type="button"
              onClick={() =>
                setTablePage((p) => Math.min(tableTotalPages, p + 1))
              }
              disabled={tablePage >= tableTotalPages}
              className="wah-inv-page-btn"
            >
              {tl("paginationNext", "Sau")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(FiltersAndTableSection);
