import React, { memo, useCallback } from "react";
import { formatKRW } from "../lib/parse";

function InventoryTablePanel({
  tl,
  monthCompareMode,
  monthCompareFrom,
  monthCompareTo,
  structuredSummary,
  filteredStructuredRows,
  pagedStructuredRows,
  tablePage,
  setTablePage,
  tablePageSize,
  setTablePageSize,
  tablePageSizeOptions,
  tableTotalPages,
  codeDiffSoftScale,
}) {
  const totalRows = filteredStructuredRows.length;
  const pageStart = totalRows === 0 ? 0 : (tablePage - 1) * tablePageSize + 1;
  const pageEnd = Math.min(tablePage * tablePageSize, totalRows);
  const monthCompareNeedsPick =
    monthCompareMode && (!monthCompareFrom || !monthCompareTo);
  const tableColSpan = 13;

  const rowClass = useCallback(
    (r) => {
      const ratio = Math.min(
        1,
        Math.abs(r.gapAmount ?? 0) / codeDiffSoftScale,
      );
      if ((r.gapAmount ?? 0) > 0) {
        return ratio > 0.5
          ? "bg-rose-50 dark:bg-rose-950/30"
          : "bg-rose-50/50 dark:bg-rose-950/15";
      }
      if ((r.gapAmount ?? 0) < 0) {
        return ratio > 0.5
          ? "bg-sky-50 dark:bg-sky-950/30"
          : "bg-sky-50/50 dark:bg-sky-950/15";
      }
      return "";
    },
    [codeDiffSoftScale],
  );

  const emptyMessage = monthCompareNeedsPick
    ? tl(
        "monthComparePickBoth",
        "Chọn đủ tháng trước và tháng sau để xem chênh lệch.",
      )
    : monthCompareMode
      ? tl(
          "monthCompareNoMatches",
          "Không có mã trùng khớp giữa hai tháng đã chọn.",
        )
      : tl("tableEmpty", "Không có dòng phù hợp bộ lọc.");

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {monthCompareMode
            ? tl("monthCompareSectionTitle", "So sánh 2 tháng")
            : tl("structuredTableTitle", "Chi tiết theo tháng × mã")}
        </h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {structuredSummary.rows.toLocaleString("vi-VN")}{" "}
          {tl("tableRowsLabel", "dòng")}
        </span>
      </div>

      <div className="wah-inv-table-scroll overflow-x-auto">
        <table className="min-w-[1280px] w-full border-collapse text-center text-xs">
          <thead>
            <tr className="bg-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <th className="px-2 py-2.5">{tl("colStt", "STT")}</th>
              <th className="px-2 py-2.5 text-left">Month</th>
              <th className="px-2 py-2.5">{tl("colCategoryKr", "구분")}</th>
              <th className="px-2 py-2.5">{tl("colWarehouseCode", "Mã kho")}</th>
              <th className="px-2 py-2.5 text-left">{tl("colWarehouse", "Kho")}</th>
              <th className="px-2 py-2.5 text-left">{tl("colItem", "ITEM")}</th>
              <th className="px-2 py-2.5">{tl("colStatus", "STATUS")}</th>
              <th className="px-2 py-2.5">CODE</th>
              <th className="px-2 py-2.5">{tl("colUnit", "Đơn vị")}</th>
              <th className="px-2 py-2.5 text-left">{tl("colReason", "Lý do")}</th>
              <th className="px-2 py-2.5">{tl("colActualQty", "SL TT")}</th>
              <th className="px-2 py-2.5">{tl("colSystemQtyKr", "SL HT")}</th>
              <th className="px-2 py-2.5">{tl("colAmount", "Số tiền")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {pagedStructuredRows.length > 0 ? (
              pagedStructuredRows.map((r, idx) => (
                <tr
                  key={`${r.whCode}-${r.warehouseName}-${r.category}-${r.monthKey}-${r.code}-${idx}`}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${rowClass(r)}`}
                >
                  <td className="px-2 py-2 tabular-nums text-slate-500">
                    {pageStart + idx}
                  </td>
                  <td className="max-w-[120px] truncate px-2 py-2 text-left font-medium text-slate-700 dark:text-slate-200">
                    {r.month}
                  </td>
                  <td className="px-2 py-2 text-slate-700 dark:text-slate-200">
                    {r.category}
                  </td>
                  <td className="px-2 py-2 font-mono text-slate-800 dark:text-slate-100">
                    {r.whCode}
                  </td>
                  <td
                    className="max-w-[140px] truncate px-2 py-2 text-left"
                    title={
                      r.warehouseName !== "—"
                        ? String(r.warehouseName)
                        : undefined
                    }
                  >
                    {r.warehouseName}
                  </td>
                  <td
                    className="max-w-[140px] truncate px-2 py-2 text-left"
                    title={r.item !== "—" ? String(r.item) : undefined}
                  >
                    {r.item}
                  </td>
                  <td
                    className="max-w-[80px] truncate px-2 py-2 text-[10px] font-bold uppercase text-violet-700 dark:text-violet-300"
                    title={r.status !== "—" ? String(r.status) : undefined}
                  >
                    {r.status}
                  </td>
                  <td className="px-2 py-2 font-mono">
                    {r.code === "∅"
                      ? tl("codeEmptyLabel", "(코드 없음)")
                      : r.code}
                  </td>
                  <td
                    className="max-w-[72px] truncate px-2 py-2"
                    title={r.unit !== "—" ? String(r.unit) : undefined}
                  >
                    {r.unit}
                  </td>
                  <td
                    className="max-w-[120px] truncate px-2 py-2 text-left"
                    title={r.reason !== "—" ? String(r.reason) : undefined}
                  >
                    {r.reason}
                  </td>
                  <td className="px-2 py-2 tabular-nums font-semibold text-amber-800 dark:text-amber-200">
                    {r.actualQty.toLocaleString("vi-VN", {
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td className="px-2 py-2 tabular-nums text-slate-700 dark:text-slate-200">
                    {r.sysQty.toLocaleString("vi-VN", {
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td className="px-2 py-2 tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
                    {formatKRW(r.amountActual ?? 0)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={tableColSpan}
                  className="px-4 py-12 text-sm text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="dashboard-no-print flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
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
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5">
            <span>{tl("rowsPerPage", "Dòng/trang")}</span>
            <select
              value={tablePageSize}
              onChange={(ev) => setTablePageSize(Number(ev.target.value))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold dark:border-slate-600 dark:bg-slate-800"
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
            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-bold disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
          >
            {tl("paginationPrev", "Trước")}
          </button>
          <button
            type="button"
            onClick={() =>
              setTablePage((p) => Math.min(tableTotalPages, p + 1))
            }
            disabled={tablePage >= tableTotalPages}
            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-bold disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
          >
            {tl("paginationNext", "Sau")}
          </button>
        </div>
      </div>
    </section>
  );
}

export default memo(InventoryTablePanel);
