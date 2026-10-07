import React, { Fragment, memo, useCallback } from "react";
import {
  compareMoneyDelta,
  signedDeltaClass,
} from "../lib/formatDelta";
import {
  InventoryQtyCell,
  InventoryWonCell,
} from "./InventoryValueCells";

function FilterField({ label, children, accent = "", compact = false }) {
  const cls = [
    "wah-inv-field",
    compact ? "wah-inv-field--compact" : "",
    accent ? `wah-inv-field--${accent}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      <label className="wah-inv-field__label">{label}</label>
      {children}
    </div>
  );
}

function monthSelectLabel(opt, yearFilter) {
  if (!yearFilter) return opt.label;
  const mm = String(opt.value).match(/^\d{4}-(\d{2})$/);
  return mm ? mm[1] : opt.label;
}

function compareTone(i) {
  return (i % 3) + 1;
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
    yearFilter = "",
    setYearFilter,
    yearOptions = [],
    monthTableOptions,
    monthOptionsForYear = monthTableOptions,
    monthCompareMode,
    setMonthCompareMode,
    compareMonthKeys = [],
    setCompareMonthKeys = () => {},
    toggleCompareMonth = () => {},
    codeSearch,
    setCodeSearch,
    hideZeroMonthlyDiff,
    setHideZeroMonthlyDiff,
    hideZeroActualQty,
    setHideZeroActualQty,
    qtySort = "desc",
    setQtySort = () => {},
    sortBy = "qty",
    setSortBy = () => {},
    warehouseOptions,
    categoryOptions,
    structuredSummary,
    pagedStructuredRows,
    tablePage,
    setTablePage,
    tablePageSize,
    setTablePageSize,
    tablePageSizeOptions,
    tableTotalPages,
  } = props;

  const totalRows = props.filteredStructuredRows.length;
  const pageStart = totalRows === 0 ? 0 : (tablePage - 1) * tablePageSize + 1;
  const pageEnd = Math.min(tablePage * tablePageSize, totalRows);
  const compareMonthsMeta = (compareMonthKeys ?? []).map((key) => ({
    key,
    label:
      monthTableOptions.find((m) => m.value === key)?.label ||
      key,
  }));
  const monthCompareNeedsPick =
    monthCompareMode && compareMonthsMeta.length < 2;
  const comparing = Boolean(monthCompareMode && !monthCompareNeedsPick);
  const tableColSpan = !monthCompareMode
    ? 13
    : comparing
      ? 4 + compareMonthsMeta.length * 3 + 2
      : 4;

  const compareFromLabel =
    props.filteredStructuredRows[0]?.compareFromMonth ||
    compareMonthsMeta[0]?.label ||
    "";
  const compareToLabel =
    props.filteredStructuredRows[0]?.compareToMonth ||
    compareMonthsMeta[compareMonthsMeta.length - 1]?.label ||
    "";

  const compareTotals = comparing
    ? props.filteredStructuredRows.reduce(
        (acc, r) => {
          (r.compareMonths ?? []).forEach((m, i) => {
            if (!acc.months[i]) {
              acc.months[i] = { qty: 0, amt: 0, erp: 0 };
            }
            acc.months[i].qty += m.actualQty ?? 0;
            acc.months[i].amt += m.amountActual ?? 0;
            acc.months[i].erp += m.amountErp ?? 0;
          });
          acc.qtyDelta += r.actualQty ?? 0;
          acc.moneyDelta += compareMoneyDelta(r);
          return acc;
        },
        {
          months: compareMonthsMeta.map(() => ({ qty: 0, amt: 0, erp: 0 })),
          qtyDelta: 0,
          moneyDelta: 0,
        },
      )
    : null;

  const setViewMode = (nextCompare) => {
    setMonthCompareMode((on) => {
      if (on === nextCompare) return on;
      if (nextCompare) setMonthFilter("");
      else setCompareMonthKeys([]);
      return nextCompare;
    });
  };

  const renderWarehouseRow = useCallback(
    (r, idx, rowNo) => (
      <tr
        key={`${r.whCode}-${r.warehouseName}-${r.category}-${r.monthKey}-${r.code}-${idx}`}
      >
        <td className="wah-inv-td-num wah-inv-td-muted">{rowNo}</td>
        <td className="wah-inv-td-month">
          <span className="wah-inv-month-pill">{r.month}</span>
        </td>
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
            <span className="wah-inv-dash">—</span>
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
          <InventoryQtyCell value={r.actualQty} />
        </td>
        <td className="wah-inv-td-num wah-inv-td-sys">
          <InventoryQtyCell value={r.sysQty} />
        </td>
        <td className="wah-inv-td-num wah-inv-td-money-cell wah-inv-td-money">
          <InventoryWonCell value={r.amountErp} />
        </td>
      </tr>
    ),
    [tl],
  );

  const renderCompareRow = useCallback(
    (r, idx) => {
      const moneyDelta = compareMoneyDelta(r);
      const months = r.compareMonths ?? [];
      return (
        <tr
          key={`${r.whCode}-${r.warehouseName}-${r.category}-${r.monthKey}-${r.code}-${idx}`}
        >
          <td className="wah-inv-td-code wah-inv-td-id">{r.whCode}</td>
          <td
            className="wah-inv-td-truncate wah-inv-td-left wah-inv-td-id"
            title={r.warehouseName !== "—" ? String(r.warehouseName) : undefined}
          >
            {r.warehouseName}
          </td>
          <td className="wah-inv-td-id">{r.category}</td>
          <td className="wah-inv-td-code wah-inv-td-id">
            {r.code === "∅" ? tl("codeEmptyLabel", "(코드 없음)") : r.code}
          </td>
          {months.map((m, i) => {
            const tone = compareTone(i);
            return (
              <Fragment key={m.monthKey}>
                <td className={`wah-inv-td-num wah-inv-td-m${tone}`}>
                  <InventoryQtyCell value={m.actualQty} />
                </td>
                <td className={`wah-inv-td-num wah-inv-td-money-cell wah-inv-td-m${tone}`}>
                  <InventoryWonCell value={m.amountActual} />
                </td>
                <td className={`wah-inv-td-num wah-inv-td-money-cell wah-inv-td-m${tone}`}>
                  <InventoryWonCell value={m.amountErp} />
                </td>
              </Fragment>
            );
          })}
          <td className={`wah-inv-td-num wah-inv-td-delta ${signedDeltaClass(r.actualQty)}`}>
            <InventoryQtyCell value={r.actualQty} delta />
          </td>
          <td className={`wah-inv-td-num wah-inv-td-money-cell wah-inv-td-delta ${signedDeltaClass(moneyDelta)}`}>
            <InventoryWonCell value={moneyDelta} signed />
          </td>
        </tr>
      );
    },
    [tl],
  );

  return (
    <>
      <div className={`dashboard-no-print wah-inv-panel${monthCompareMode ? " wah-inv-panel--compare" : " wah-inv-panel--month"}`}>
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
              {tl("viewModeCompare", "So sánh tháng")}
            </button>
          </div>

          <div
            className={`wah-inv-filter-bar${monthCompareMode ? " wah-inv-filter-bar--compare" : ""}`}
          >
            <div className="wah-inv-filter-row">
              <FilterField compact label={tl("filterYear", "Năm")} accent="year">
                <select
                  value={yearFilter}
                  onChange={(ev) => setYearFilter(ev.target.value)}
                  className="wah-inv-control"
                >
                  <option value="">{tl("filterAllYears", "Tất cả")}</option>
                  {(yearOptions ?? []).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </FilterField>

              {monthCompareMode ? null : (
                <FilterField
                  compact
                  label={tl("monthFilterLabel", "Tháng")}
                  accent="month"
                >
                  <select
                    value={monthFilter}
                    onChange={(ev) => setMonthFilter(ev.target.value)}
                    className="wah-inv-control"
                  >
                    <option value="">
                      {tl("filterAllMonths", "Tất cả")}
                    </option>
                    {monthOptionsForYear.map((m) => (
                      <option key={m.value} value={m.value}>
                        {monthSelectLabel(m, yearFilter)}
                      </option>
                    ))}
                  </select>
                </FilterField>
              )}

            <FilterField compact label={tl("filterWh", "Kho")}>
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

            <FilterField compact label={tl("colCategoryKr", "구분")}>
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
              compact
              label={tl("searchFieldLabel", "Tìm mã")}
              accent="search"
            >
              <input
                value={codeSearch}
                onChange={(ev) => setCodeSearch(ev.target.value)}
                placeholder={tl("searchCodePlaceholder", "CODE / ITEM")}
                className="wah-inv-control"
              />
            </FilterField>

            <FilterField
              compact
              label={tl("sortQtyLabel", "Sắp xếp")}
              accent="sort"
            >
              <select
                value={`${sortBy}-${qtySort}`}
                onChange={(ev) => {
                  const [nextBy, nextDir] = String(ev.target.value).split("-");
                  setSortBy(nextBy === "amount" ? "amount" : "qty");
                  setQtySort(nextDir === "asc" ? "asc" : "desc");
                }}
                className="wah-inv-control"
              >
                <option value="qty-desc">
                  {tl("sortByQtyDesc", "Số lượng giảm dần")}
                </option>
                <option value="qty-asc">
                  {tl("sortByQtyAsc", "Số lượng tăng dần")}
                </option>
                <option value="amount-desc">
                  {tl("sortByAmountDesc", "Số tiền giảm dần")}
                </option>
                <option value="amount-asc">
                  {tl("sortByAmountAsc", "Số tiền tăng dần")}
                </option>
              </select>
            </FilterField>

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
                  comparing ? "Ẩn SL không đổi" : "Ẩn SL 0",
                )}
              </label>
            </div>
            </div>
            {monthCompareMode ? (
              <div className="wah-inv-month-picks">
                <span className="wah-inv-field__label wah-inv-field--compact-label">
                  {tl("monthFilterLabel", "Tháng")}
                </span>
                <div className="wah-inv-month-picks__list">
                  {monthOptionsForYear.map((m) => {
                    const on = compareMonthKeys.includes(m.value);
                    return (
                      <button
                        key={m.value}
                        type="button"
                        className={`wah-inv-month-pick${on ? " wah-inv-month-pick--on" : ""}`}
                        onClick={() => toggleCompareMonth(m.value)}
                      >
                        {monthSelectLabel(m, yearFilter)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {kpi}

      {monthCompareNeedsPick ? (
        <p className="dashboard-no-print wah-inv-callout" role="status">
          {tl(
            "monthComparePickBoth",
            "Chọn từ 2 tháng trở lên để so sánh.",
          )}
        </p>
      ) : null}

      <div className={`wah-inv-table-section${monthCompareMode ? " wah-inv-table-section--compare" : " wah-inv-table-section--month"}`}>
        <div className="wah-inv-table-section__head">
          <p>
            {monthCompareMode
              ? tl("compareTableTitle", "So sánh tháng")
              : tl("structuredTableTitle", "Bảng chi tiết")}
          </p>
          <span>
            {structuredSummary.rows.toLocaleString("vi-VN")}{" "}
            {tl("tableRowsLabel", "dòng")}
          </span>
        </div>

        <div className="wah-inv-table-wrap">
          <table
            className={`wah-inv-table${
              monthCompareMode ? " wah-inv-table--compare" : " wah-inv-table--month"
            }${
              comparing && compareMonthsMeta.length >= 3
                ? " wah-inv-table--compare-wide"
                : ""
            }`}
          >
            {comparing ? (
              <colgroup>
                <col className="wah-inv-col-id" />
                <col className="wah-inv-col-wh" />
                <col className="wah-inv-col-cat" />
                <col className="wah-inv-col-code" />
                {compareMonthsMeta.map((m) => (
                  <Fragment key={`cols-${m.key}`}>
                    <col className="wah-inv-col-qty" />
                    <col className="wah-inv-col-amt" />
                    <col className="wah-inv-col-amt" />
                  </Fragment>
                ))}
                <col className="wah-inv-col-delta" />
                <col className="wah-inv-col-delta" />
              </colgroup>
            ) : null}
            <thead>
              {monthCompareMode && comparing ? (
                <>
                  <tr>
                    <th rowSpan={2} className="wah-inv-th-id">
                      {tl("colWarehouseCodeKr", "창고(Mã kho)")}
                    </th>
                    <th rowSpan={2} className="wah-inv-th-id">
                      WAREHOUSE
                    </th>
                    <th rowSpan={2} className="wah-inv-th-id">
                      {tl("colCategoryKr", "구분")}
                    </th>
                    <th rowSpan={2} className="wah-inv-th-id">
                      CODE
                    </th>
                    {compareMonthsMeta.map((m, i) => (
                      <th
                        key={m.key}
                        colSpan={3}
                        className={`wah-inv-th-group wah-inv-th-group--m${compareTone(i)}`}
                      >
                        {m.label}
                      </th>
                    ))}
                    <th rowSpan={2} className="wah-inv-th-delta">
                      <span className="wah-inv-th-delta__k">
                        {tl("colQtyDeltaTitle", "수량")}
                      </span>
                      <span className="wah-inv-th-delta__r">
                        {compareToLabel} − {compareFromLabel}
                      </span>
                    </th>
                    <th rowSpan={2} className="wah-inv-th-delta">
                      <span className="wah-inv-th-delta__k">
                        {tl("colAmtDeltaTitle", "금액")}
                      </span>
                      <span className="wah-inv-th-delta__r">
                        {compareToLabel} − {compareFromLabel}
                      </span>
                    </th>
                  </tr>
                  <tr>
                    {compareMonthsMeta.map((m, i) => (
                      <Fragment key={`sub-${m.key}`}>
                        <th className={`wah-inv-th-m${compareTone(i)}`}>
                          {tl("colActualQtySum", "THỰC TẾ")}
                        </th>
                        <th className={`wah-inv-th-m${compareTone(i)}`}>
                          {tl("colAmountActualKr", "재고금액(실사)")}
                        </th>
                        <th className={`wah-inv-th-m${compareTone(i)}`}>
                          {tl("colAmountErpKr", "재고금액(ERP)")}
                        </th>
                      </Fragment>
                    ))}
                  </tr>
                  {compareTotals && comparing && props.filteredStructuredRows.length ? (
                    <tr className="wah-inv-compare-total">
                      <th colSpan={4} className="wah-inv-compare-total__label">
                        {tl("compareGrandTotal", "Tổng")}
                      </th>
                      {compareTotals.months.map((m, i) => (
                        <Fragment key={`tot-${compareMonthsMeta[i]?.key ?? i}`}>
                          <th className={`wah-inv-td-num wah-inv-td-m${compareTone(i)}`}>
                            <InventoryQtyCell value={m.qty} />
                          </th>
                          <th className={`wah-inv-td-num wah-inv-td-money-cell wah-inv-td-m${compareTone(i)}`}>
                            <InventoryWonCell value={m.amt} />
                          </th>
                          <th className={`wah-inv-td-num wah-inv-td-money-cell wah-inv-td-m${compareTone(i)}`}>
                            <InventoryWonCell value={m.erp} />
                          </th>
                        </Fragment>
                      ))}
                      <th
                        className={`wah-inv-td-num wah-inv-td-delta ${signedDeltaClass(compareTotals.qtyDelta)}`}
                      >
                        <InventoryQtyCell value={compareTotals.qtyDelta} delta />
                      </th>
                      <th
                        className={`wah-inv-td-num wah-inv-td-money-cell wah-inv-td-delta ${signedDeltaClass(compareTotals.moneyDelta)}`}
                      >
                        <InventoryWonCell value={compareTotals.moneyDelta} signed />
                      </th>
                    </tr>
                  ) : null}
                </>
              ) : !monthCompareMode ? (
                <>
                  <tr>
                    <th className="wah-inv-th-id">{tl("colStt", "STT")}</th>
                    <th className="wah-inv-th-month">
                      {tl("monthFilterLabel", "Tháng")}
                    </th>
                    <th className="wah-inv-th-id">{tl("colCategoryKr", "구분")}</th>
                    <th className="wah-inv-th-id">{tl("colWarehouseCode", "Mã kho")}</th>
                    <th className="wah-inv-th-id">
                      {tl("colWarehouse", "Kho")}
                    </th>
                    <th className="wah-inv-th-id">
                      {tl("colItem", "ITEM")}
                    </th>
                    <th className="wah-inv-th-status">{tl("colStatus", "STATUS")}</th>
                    <th className="wah-inv-th-id">CODE</th>
                    <th className="wah-inv-th-id">{tl("colUnit", "Đơn vị")}</th>
                    <th className="wah-inv-th-id">
                      {tl("colReason", "Lý do")}
                    </th>
                    <th className="wah-inv-th-actual">{tl("colActualQty", "Thực tế")}</th>
                    <th className="wah-inv-th-sys">{tl("colSystemQtyKr", "Hệ thống")}</th>
                    <th className="wah-inv-th-money">{tl("colAmount", "Tiền")}</th>
                  </tr>
                </>
              ) : null}
            </thead>
            <tbody>
              {!monthCompareMode && pagedStructuredRows.length > 0
                ? pagedStructuredRows.map((r, idx) =>
                    renderWarehouseRow(r, idx, pageStart + idx),
                  )
                : comparing && pagedStructuredRows.length > 0
                  ? pagedStructuredRows.map((r, idx) =>
                      renderCompareRow(r, idx),
                    )
                  : (
                <tr>
                  <td colSpan={tableColSpan} className="wah-inv-empty-cell">
                    {monthCompareNeedsPick
                      ? tl(
                          "monthComparePickBoth",
                          "Chọn từ 2 tháng trở lên để so sánh.",
                        )
                      : monthCompareMode
                        ? tl(
                            "monthCompareNoMatches",
                            "Không có mã trùng trên các tháng đã chọn.",
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
