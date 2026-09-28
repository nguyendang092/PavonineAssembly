import React, { memo, useCallback } from "react";
import { formatKRW } from "../lib/parse";
import {
  formatPctChange,
  formatPlainQty,
  formatSignedKRW,
  formatSignedQty,
  signedDeltaClass,
} from "../lib/formatDelta";

function FilterField({ label, children, accent = "" }) {
  return (
    <div className={accent ? `wah-inv-field wah-inv-field--${accent}` : "wah-inv-field"}>
      <label className="wah-inv-field__label">{label}</label>
      {children}
    </div>
  );
}

function FiltersAndTableSection(props) {
  const {
    tl,
    kpi,
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
  const comparing = Boolean(monthCompareMode && !monthCompareNeedsPick);
  const tableColSpan = monthCompareMode ? 13 : 13;

  const setViewMode = (nextCompare) => {
    setMonthCompareMode((on) => {
      if (on === nextCompare) return on;
      if (nextCompare) setMonthFilter("");
      else {
        setMonthCompareFrom("");
        setMonthCompareTo("");
      }
      return nextCompare;
    });
  };

  const rowBackground = useCallback(
    (r, idx) => {
      const value = comparing ? (r.actualQty ?? 0) : (r.gapAmount ?? 0);
      const ratio = Math.min(1, Math.abs(value) / codeDiffSoftScale);
      const alpha = 0.05 + ratio * 0.16;
      if (value > 0) return `rgba(167, 243, 208, ${alpha})`;
      if (value < 0) return `rgba(254, 205, 211, ${alpha})`;
      return idx % 2 === 0 ? "transparent" : "rgba(148, 163, 184, 0.08)";
    },
    [codeDiffSoftScale, comparing],
  );

  const renderWarehouseRow = useCallback(
    (r, idx, rowNo) => (
      <tr
        key={`${r.whCode}-${r.warehouseName}-${r.category}-${r.monthKey}-${r.code}-${idx}`}
        style={{ backgroundColor: rowBackground(r, idx) }}
      >
        <td className="wah-inv-td-num wah-inv-td-muted">{rowNo}</td>
        <td className="wah-inv-td-left wah-inv-td-month">{r.month}</td>
        <td>{r.category}</td>
        <td className="wah-inv-td-code">{r.whCode}</td>
        <td
          className="wah-inv-td-truncate wah-inv-td-left"
          title={r.warehouseName !== "—" ? String(r.warehouseName) : undefined}
        >
          {r.warehouseName}
        </td>
        <td
          className="wah-inv-td-truncate wah-inv-td-left"
          title={r.item !== "—" ? String(r.item) : undefined}
        >
          {r.item}
        </td>
        <td className="wah-inv-td-truncate wah-inv-td-status">
          {r.status !== "—" ? (
            <span className="wah-inv-status-pill">{r.status}</span>
          ) : (
            r.status
          )}
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
          className="wah-inv-td-truncate wah-inv-td-left"
          title={r.reason !== "—" ? String(r.reason) : undefined}
        >
          {r.reason}
        </td>
        <td className="wah-inv-td-num wah-inv-td-qty">
          {r.actualQty.toLocaleString("vi-VN", { maximumFractionDigits: 4 })}
        </td>
        <td className="wah-inv-td-num wah-inv-td-sys">
          {r.sysQty.toLocaleString("vi-VN", { maximumFractionDigits: 4 })}
        </td>
        <td className="wah-inv-td-num wah-inv-td-money">
          {formatKRW(r.amountActual ?? 0)}
        </td>
      </tr>
    ),
    [rowBackground, tl],
  );

  const renderCompareRow = useCallback(
    (r, idx, rowNo) => {
      const qtyPct = formatPctChange(r.actualQtyFrom, r.actualQty);
      const amtPct = formatPctChange(r.amountActualFrom, r.amountActual);
      return (
        <tr
          key={`${r.whCode}-${r.warehouseName}-${r.category}-${r.monthKey}-${r.code}-${idx}`}
          style={{ backgroundColor: rowBackground(r, idx) }}
        >
          <td className="wah-inv-td-num wah-inv-td-muted">{rowNo}</td>
          <td className="wah-inv-td-period">{r.month}</td>
          <td>{r.category}</td>
          <td className="wah-inv-td-code">{r.whCode}</td>
          <td
            className="wah-inv-td-truncate wah-inv-td-left"
            title={r.warehouseName !== "—" ? String(r.warehouseName) : undefined}
          >
            {r.warehouseName}
          </td>
          <td
            className="wah-inv-td-truncate wah-inv-td-left"
            title={r.item !== "—" ? String(r.item) : undefined}
          >
            {r.item}
          </td>
          <td className="wah-inv-td-code">
            {r.code === "∅" ? tl("codeEmptyLabel", "(코드 없음)") : r.code}
          </td>
          <td className="wah-inv-td-num wah-inv-td-from">
            {formatPlainQty(r.actualQtyFrom)}
          </td>
          <td className="wah-inv-td-num wah-inv-td-to">
            {formatPlainQty(r.actualQtyTo)}
          </td>
          <td className={`wah-inv-td-num ${signedDeltaClass(r.actualQty)}`}>
            {formatSignedQty(r.actualQty)}
            {qtyPct ? <span className="wah-inv-delta-pct">{qtyPct}</span> : null}
          </td>
          <td className="wah-inv-td-num wah-inv-td-from">
            {formatKRW(r.amountActualFrom ?? 0)}
          </td>
          <td className="wah-inv-td-num wah-inv-td-to">
            {formatKRW(r.amountActualTo ?? 0)}
          </td>
          <td className={`wah-inv-td-num ${signedDeltaClass(r.amountActual)}`}>
            {formatSignedKRW(r.amountActual)}
            {amtPct ? <span className="wah-inv-delta-pct">{amtPct}</span> : null}
          </td>
        </tr>
      );
    },
    [rowBackground, tl],
  );

  return (
    <>
      <div className={`dashboard-no-print wah-inv-panel${monthCompareMode ? " wah-inv-panel--compare" : ""}`}>
        <div className="wah-inv-panel__body">
          <div className="wah-inv-modes" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!monthCompareMode}
              className={`wah-inv-mode wah-inv-mode--list${!monthCompareMode ? " wah-inv-mode--on" : ""}`}
              onClick={() => setViewMode(false)}
            >
              {tl("viewModeList", "Xem theo tháng")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={monthCompareMode}
              className={`wah-inv-mode wah-inv-mode--cmp${monthCompareMode ? " wah-inv-mode--on" : ""}`}
              onClick={() => setViewMode(true)}
            >
              {tl("viewModeCompare", "So sánh 2 tháng")}
            </button>
          </div>

          <div
            className={`wah-inv-filter-grid${monthCompareMode ? " wah-inv-filter-grid--compare" : ""}`}
          >
            <FilterField label={tl("filterWh", "Kho")}>
              <select
                value={whFilter}
                onChange={(ev) => setWhFilter(ev.target.value)}
                className="wah-inv-control"
              >
                <option value="">{tl("filterWhAll", "Tất cả")}</option>
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

            {monthCompareMode ? (
              <>
                <FilterField label={tl("monthCompareFrom", "Tháng trước")} accent="from">
                  <select
                    value={monthCompareFrom}
                    onChange={(ev) => setMonthCompareFrom(ev.target.value)}
                    className="wah-inv-control"
                  >
                    <option value="">
                      {tl("monthComparePick", "Chọn tháng")}
                    </option>
                    {monthTableOptions.map((m) => (
                      <option key={`from-${m.value}`} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label={tl("monthCompareTo", "Tháng sau")} accent="to">
                  <select
                    value={monthCompareTo}
                    onChange={(ev) => setMonthCompareTo(ev.target.value)}
                    className="wah-inv-control"
                  >
                    <option value="">
                      {tl("monthComparePick", "Chọn tháng")}
                    </option>
                    {monthTableOptions.map((m) => (
                      <option key={`to-${m.value}`} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </>
            ) : (
              <FilterField label={tl("monthFilterLabel", "Tháng")}>
                <select
                  value={monthFilter}
                  onChange={(ev) => setMonthFilter(ev.target.value)}
                  className="wah-inv-control"
                >
                  <option value="">{tl("filterAllMonths", "Tất cả")}</option>
                  {monthTableOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </FilterField>
            )}

            <FilterField label={tl("searchFieldLabel", "Tìm mã")} accent="search">
              <input
                value={codeSearch}
                onChange={(ev) => setCodeSearch(ev.target.value)}
                placeholder={tl("searchCodePlaceholder", "CODE hoặc ITEM")}
                className="wah-inv-control"
              />
            </FilterField>
          </div>

          <div className="wah-inv-toolbar">
            <p className="wah-inv-toolbar__label">
              {tl("filtersHideLabel", "Ẩn dòng")}
            </p>
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
                {tl(
                  comparing ? "hideUnchangedQty" : "hideZeroActualQty",
                  comparing
                    ? "Ẩn số lượng không đổi"
                    : "Ẩn số lượng 0",
                )}
              </label>
            </div>
          </div>
        </div>
      </div>

      {kpi}

      {monthCompareNeedsPick ? (
        <p className="dashboard-no-print wah-inv-callout" role="status">
          {tl(
            "monthComparePickBoth",
            "Chọn tháng trước và tháng sau để xem chênh lệch.",
          )}
        </p>
      ) : null}

      <div className="wah-inv-table-section">
        <div className="wah-inv-table-section__head">
          <p>
            {monthCompareMode
              ? tl("compareTableTitle", "Chênh lệch hai tháng")
              : tl("structuredTableTitle", "Bảng chi tiết")}
          </p>
          {monthCompareMode ? (
            <span className="wah-inv-compare-legend">
              <span className="wah-inv-delta wah-inv-delta--up">
                {tl("legendIncrease", "Tăng")}
              </span>
              <span className="wah-inv-delta wah-inv-delta--down">
                {tl("legendDecrease", "Giảm")}
              </span>
              <span className="wah-inv-delta wah-inv-delta--flat">
                {tl("legendUnchanged", "Không đổi")}
              </span>
            </span>
          ) : (
            <span>
              {structuredSummary.rows.toLocaleString("vi-VN")}{" "}
              {tl("tableRowsLabel", "dòng")}
            </span>
          )}
        </div>

        <div className="wah-inv-table-wrap">
          <table
            className={`wah-inv-table${monthCompareMode ? " wah-inv-table--compare" : ""}`}
          >
            <thead>
              {monthCompareMode ? (
                <>
                  <tr>
                    <th rowSpan={2}>{tl("colStt", "STT")}</th>
                    <th rowSpan={2} className="wah-inv-td-left">
                      {tl("colComparePeriod", "Kỳ")}
                    </th>
                    <th rowSpan={2}>{tl("colCategoryKr", "구분")}</th>
                    <th rowSpan={2}>{tl("colWarehouseCode", "Mã kho")}</th>
                    <th rowSpan={2} className="wah-inv-td-left">
                      {tl("colWarehouse", "Kho")}
                    </th>
                    <th rowSpan={2} className="wah-inv-td-left">
                      {tl("colItem", "ITEM")}
                    </th>
                    <th rowSpan={2}>CODE</th>
                    <th
                      colSpan={3}
                      className="wah-inv-th-group wah-inv-th-group--qty"
                    >
                      {tl("colActualQty", "Thực tế")}
                    </th>
                    <th
                      colSpan={3}
                      className="wah-inv-th-group wah-inv-th-group--amt"
                    >
                      {tl("colAmount", "Tiền")}
                    </th>
                  </tr>
                  <tr>
                    <th className="wah-inv-th-from">
                      {tl("colCompareFrom", "Trước")}
                    </th>
                    <th className="wah-inv-th-to">
                      {tl("colCompareTo", "Sau")}
                    </th>
                    <th className="wah-inv-th-delta">
                      {tl("colCompareDelta", "Δ")}
                    </th>
                    <th className="wah-inv-th-from">
                      {tl("colCompareFrom", "Trước")}
                    </th>
                    <th className="wah-inv-th-to">
                      {tl("colCompareTo", "Sau")}
                    </th>
                    <th className="wah-inv-th-delta">
                      {tl("colCompareDelta", "Δ")}
                    </th>
                  </tr>
                </>
              ) : (
                <tr>
                  <th>{tl("colStt", "STT")}</th>
                  <th className="wah-inv-th-month wah-inv-td-left">
                    {tl("monthFilterLabel", "Tháng")}
                  </th>
                  <th>{tl("colCategoryKr", "구분")}</th>
                  <th>{tl("colWarehouseCode", "Mã kho")}</th>
                  <th className="wah-inv-td-left">{tl("colWarehouse", "Kho")}</th>
                  <th className="wah-inv-td-left">{tl("colItem", "ITEM")}</th>
                  <th className="wah-inv-th-status">{tl("colStatus", "STATUS")}</th>
                  <th>CODE</th>
                  <th>{tl("colUnit", "Đơn vị")}</th>
                  <th className="wah-inv-td-left">{tl("colReason", "Lý do")}</th>
                  <th className="wah-inv-th-actual">{tl("colActualQty", "Thực tế")}</th>
                  <th className="wah-inv-th-sys">{tl("colSystemQtyKr", "Hệ thống")}</th>
                  <th className="wah-inv-th-money">{tl("colAmount", "Tiền")}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {!monthCompareMode && pagedStructuredRows.length > 0
                ? pagedStructuredRows.map((r, idx) =>
                    renderWarehouseRow(r, idx, pageStart + idx),
                  )
                : comparing && pagedStructuredRows.length > 0
                  ? pagedStructuredRows.map((r, idx) =>
                      renderCompareRow(r, idx, pageStart + idx),
                    )
                  : (
                <tr>
                  <td colSpan={tableColSpan} className="wah-inv-empty-cell">
                    {monthCompareNeedsPick
                      ? tl(
                          "monthComparePickBoth",
                          "Chọn tháng trước và tháng sau để xem chênh lệch.",
                        )
                      : monthCompareMode
                        ? tl(
                            "monthCompareNoMatches",
                            "Không có mã trùng giữa hai tháng.",
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
            {tl("tablePageRangeSummary", "{{from}}–{{to}} / {{count}}", {
              from: pageStart,
              to: pageEnd,
              count: totalRows,
            })}
          </span>
          <div className="wah-inv-pagination__actions">
            <label className="wah-inv-page-size">
              <span>{tl("rowsPerPage", "Dòng/trang")}</span>
              <select
                value={tablePageSize}
                onChange={(ev) => setTablePageSize(Number(ev.target.value))}
                className="wah-inv-control wah-inv-control--sm"
              >
                {tablePageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <span className="wah-inv-page-num">
              {tl("tablePageSummary", "Trang {{page}}/{{total}}", {
                page: tablePage,
                total: tableTotalPages,
              })}
            </span>
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
