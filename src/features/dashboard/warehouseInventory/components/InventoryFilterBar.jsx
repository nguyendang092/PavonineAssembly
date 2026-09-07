import React, { memo } from "react";
import { formatKRW } from "../lib/parse";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

function InventoryFilterBar({
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
}) {
  return (
    <section className="dashboard-no-print rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {tl("filtersSectionTitle", "Bộ lọc")}
        </h2>
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
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            monthCompareMode
              ? "bg-violet-600 text-white"
              : "border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          }`}
        >
          {tl("monthCompareModeButton", "So sánh 12 tháng")}
        </button>
      </div>

      {monthCompareMode ? (
        <p className="mb-3 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
          {tl(
            "monthCompareModeHint",
            "Chọn 2 tháng — hiển thị chênh lệch (tháng sau − tháng trước) cho mã trùng khớp.",
          )}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            {tl("filterWh", "Kho")}
          </span>
          <select
            value={whFilter}
            onChange={(ev) => setWhFilter(ev.target.value)}
            className={inputCls}
          >
            <option value="">{tl("filterWhAll", "Tất cả kho")}</option>
            {warehouseOptions.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            {tl("colCategoryKr", "구분")}
          </span>
          <select
            value={categoryFilter}
            onChange={(ev) => setCategoryFilter(ev.target.value)}
            className={inputCls}
          >
            <option value="">{tl("filterAll", "Tất cả")}</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {monthCompareMode ? (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">
                {tl("monthCompareFrom", "Tháng trước")}
              </span>
              <select
                value={monthCompareFrom}
                onChange={(ev) => setMonthCompareFrom(ev.target.value)}
                className={inputCls}
              >
                <option value="">—</option>
                {monthTableOptions.map((m) => (
                  <option key={`from-${m.value}`} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">
                {tl("monthCompareTo", "Tháng sau")}
              </span>
              <select
                value={monthCompareTo}
                onChange={(ev) => setMonthCompareTo(ev.target.value)}
                className={inputCls}
              >
                <option value="">—</option>
                {monthTableOptions.map((m) => (
                  <option key={`to-${m.value}`} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              {tl("monthFilterLabel", "Tháng")}
            </span>
            <select
              value={monthFilter}
              onChange={(ev) => setMonthFilter(ev.target.value)}
              className={inputCls}
            >
              <option value="">{tl("filterAllMonths", "Tất cả tháng")}</option>
              {monthTableOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block sm:col-span-2 lg:col-span-1">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            CODE / ITEM
          </span>
          <input
            value={codeSearch}
            onChange={(ev) => setCodeSearch(ev.target.value)}
            placeholder={tl("searchCodePlaceholder", "Tìm CODE, ITEM…")}
            className={inputCls}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={hideZeroMonthlyDiff}
            onChange={(e) => setHideZeroMonthlyDiff(e.target.checked)}
            className="rounded border-slate-300"
          />
          {tl("hideZeroMonthlyDiff", "Ẩn GAP = 0")}
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={hideZeroActualQty}
            onChange={(e) => setHideZeroActualQty(e.target.checked)}
            className="rounded border-slate-300"
          />
          {tl("hideZeroActualQty", "Ẩn SL thực tế & hệ thống = 0")}
        </label>
      </div>
    </section>
  );
}

export default memo(InventoryFilterBar);
