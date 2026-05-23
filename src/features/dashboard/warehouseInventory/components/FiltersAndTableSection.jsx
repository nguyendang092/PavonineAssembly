import React, { memo } from "react";
import { FiFilter } from "react-icons/fi";
import { formatKRW } from "../lib/parse";
function FiltersAndTableSection(props) {
  const {
    tl,
    whFilter,
    setWhFilter,
    categoryFilter,
    setCategoryFilter,
    monthFilter,
    setMonthFilter,
    codeSearch,
    setCodeSearch,
    hideZeroMonthlyDiff,
    setHideZeroMonthlyDiff,
    hideZeroActualQty,
    setHideZeroActualQty,
    softSortMode,
    setSoftSortMode,
    warehouseOptions,
    categoryOptions,
    monthTableOptions,
    structuredSummary,
    filteredStructuredRows,
    pagedStructuredRows,
    tablePage,
    setTablePage,
    tableTotalPages,
    codeDiffSoftScale,
  } = props;
  return (
    <>
      <div className="dashboard-no-print mt-6 rounded-2xl border-2 border-indigo-400/55 bg-gradient-to-br from-white via-indigo-50/80 to-violet-50/70 p-4 dark:border-indigo-500/40 dark:from-slate-950 dark:via-indigo-950/50 dark:to-violet-950/35">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-200/70 pb-3 dark:border-indigo-800/80">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <FiFilter
                className="h-[1.125rem] w-[1.125rem]"
                aria-hidden
              />
            </span>
            <div>
              <p className="text-[13px] font-black uppercase tracking-wide text-indigo-950 dark:text-indigo-100">
                {tl("filtersSectionTitle", "Bộ lọc báo cáo")}
              </p>
              <p className="text-[11px] font-semibold text-indigo-800/85 dark:text-indigo-200/80">
                {tl(
                  "filtersSectionHint",
                  "기간과 조건을 선택하면 KPI, 차트, 표가 필터 기준으로 함께 갱신됩니다.",
                )}
              </p>
            </div>
          </div>
          <div className="rounded-full border-2 border-emerald-300/90 bg-emerald-50 px-4 py-1.5 text-center text-xs font-black tabular-nums text-emerald-900 dark:border-emerald-600/60 dark:bg-emerald-950/80 dark:text-emerald-100">
            {tl("comparisonRowsCount", "{{count}} dòng", {
              count: structuredSummary.rows,
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="group rounded-xl border border-indigo-200/90 bg-white/95 p-3 transition hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-900/95 dark:hover:border-indigo-500">
            <label className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-indigo-900 dark:text-indigo-100">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-indigo-500"
                aria-hidden
              />
              {tl("filterWh", "창고 필터")}
            </label>
            <select
              value={whFilter}
              onChange={(ev) => setWhFilter(ev.target.value)}
              className="wah-inv-filter-control w-full cursor-pointer rounded-lg border-2 border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400"
            >
              <option value="">{tl("filterWhAll", "전체")}</option>
              {warehouseOptions.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div className="group rounded-xl border border-indigo-200/90 bg-white/95 p-3 transition hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-900/95 dark:hover:border-indigo-500">
            <label className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-indigo-900 dark:text-indigo-100">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-violet-500"
                aria-hidden
              />
              {tl("colCategoryKr", "구분")}
            </label>
            <select
              value={categoryFilter}
              onChange={(ev) => setCategoryFilter(ev.target.value)}
              className="wah-inv-filter-control w-full cursor-pointer rounded-lg border-2 border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400"
            >
              <option value="">{tl("filterAll", "전체")}</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="group rounded-xl border border-indigo-200/90 bg-white/95 p-3 transition hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-900/95 dark:hover:border-indigo-500">
            <label className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-indigo-900 dark:text-indigo-100">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-sky-500"
                aria-hidden
              />
              Month
            </label>
            <select
              value={monthFilter}
              onChange={(ev) => setMonthFilter(ev.target.value)}
              className="wah-inv-filter-control w-full cursor-pointer rounded-lg border-2 border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400"
            >
              <option value="">{tl("filterAll", "전체")}</option>
              {monthTableOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="group rounded-xl border border-indigo-200/90 bg-white/95 p-3 transition hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-900/95 dark:hover:border-indigo-500">
            <label className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-indigo-900 dark:text-indigo-100">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                aria-hidden
              />
              CODE
            </label>
            <input
              value={codeSearch}
              onChange={(ev) => setCodeSearch(ev.target.value)}
              placeholder={tl("searchCodePlaceholder", "CODE 입력...")}
              className="wah-inv-filter-control w-full rounded-lg border-2 border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400"
            />
          </div>
        </div>

        <div className="mt-4 border-t border-indigo-200/60 pt-3 dark:border-indigo-800/70">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-indigo-200/70 bg-white/70 p-3 dark:border-indigo-800/70 dark:bg-slate-900/40">
              <p className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-indigo-900 dark:text-indigo-100">
                <span
                  className="inline-block h-px w-4 bg-gradient-to-r from-indigo-500 to-violet-500"
                  aria-hidden
                />
                {tl("filtersHideLabel", "불필요한 행 숨기기")}
              </p>
              <div className="flex flex-wrap gap-2.5">
                <label
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-2 text-xs font-bold transition focus-within:ring-4 focus-within:ring-indigo-500/25 ${
                    hideZeroMonthlyDiff
                      ? "border-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                      : "border-slate-200/90 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/90 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={hideZeroMonthlyDiff}
                    onChange={(e) =>
                      setHideZeroMonthlyDiff(e.target.checked)
                    }
                    className={`h-4 w-4 shrink-0 rounded-md border-2 focus:ring-offset-0 ${
                      hideZeroMonthlyDiff
                        ? "border-white/70 bg-white/20 text-white accent-white"
                        : "border-slate-300 accent-indigo-600 dark:border-slate-500"
                    }`}
                  />
                  {tl("hideZeroMonthlyDiff", "GAP = 0 숨기기")}
                </label>
                <label
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-2 text-xs font-bold transition focus-within:ring-4 focus-within:ring-indigo-500/25 ${
                    hideZeroActualQty
                      ? "border-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                      : "border-slate-200/90 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/90 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={hideZeroActualQty}
                    onChange={(e) =>
                      setHideZeroActualQty(e.target.checked)
                    }
                    className={`h-4 w-4 shrink-0 rounded-md border-2 focus:ring-offset-0 ${
                      hideZeroActualQty
                        ? "border-white/70 bg-white/20 text-white accent-white"
                        : "border-slate-300 accent-indigo-600 dark:border-slate-500"
                    }`}
                  />
                  {tl("hideZeroActualQty", "실사수량 = 0 숨기기")}
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-200/70 bg-white/70 p-3 dark:border-indigo-800/70 dark:bg-slate-900/40">
              <p className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-indigo-900 dark:text-indigo-100">
                <span
                  className="inline-block h-px w-4 bg-gradient-to-r from-indigo-500 to-violet-500"
                  aria-hidden
                />
                {tl("softSortSectionTitle", "Sắp xếp")}
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setSoftSortMode("abs_desc")}
                  className={`rounded-xl border-2 px-3.5 py-2 text-xs font-bold transition ${
                    softSortMode === "abs_desc"
                      ? "border-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                      : "border-slate-200/90 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/90 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40"
                  }`}
                >
                  {tl("codeDiffSoftTop", "절대값 정렬")}
                </button>
                <button
                  type="button"
                  onClick={() => setSoftSortMode("pos_desc")}
                  className={`rounded-xl border-2 px-3.5 py-2 text-xs font-bold transition ${
                    softSortMode === "pos_desc"
                      ? "border-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                      : "border-slate-200/90 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/90 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40"
                  }`}
                >
                  {tl("codeDiffSoftPositive", "큰값 -> 작은값")}
                </button>
                <button
                  type="button"
                  onClick={() => setSoftSortMode("neg_asc")}
                  className={`rounded-xl border-2 px-3.5 py-2 text-xs font-bold transition ${
                    softSortMode === "neg_asc"
                      ? "border-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                      : "border-slate-200/90 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/90 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40"
                  }`}
                >
                  {tl("codeDiffSoftNegative", "작은값 -> 큰값")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border-2 border-indigo-400/55 bg-gradient-to-br from-white via-indigo-50/70 to-violet-50/60 dark:border-indigo-500/40 dark:from-slate-950 dark:via-indigo-950/45 dark:to-violet-950/30">
        <div className="overflow-x-auto">
          <table className="wah-inv-data-table min-w-[1640px] w-full border-collapse text-center text-xs sm:text-sm">
            <thead>
              <tr className="border-b-2 border-indigo-400/90 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 text-white dark:border-indigo-500 dark:from-indigo-700 dark:via-violet-700 dark:to-indigo-700">
                <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-white/95">
                  {tl("colWarehouseCode", "창고 (Mã kho)")}
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-white/95">
                  {tl("colWarehouse", "창고")}
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-white/95">
                  {tl("colCategoryKr", "구분")}
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-white/95">
                  Month
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-white/95">
                  CODE
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-cyan-100">
                  {tl("colReason", "LÝ DO")}
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-sky-100">
                  {tl("colUnit", "단위")}
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-amber-100">
                  {tl("colActualQty", "실사수량")}
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-white/95">
                  {tl("colSystemQtyKr", "SL 전산수량")}
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-amber-200">
                  {tl("colMonthlyDiffKr", "GAP")}
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-rose-100">
                  {tl("colCodeMonthSwingKr", "월별 차이")}
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-emerald-100">
                  {tl("colInventoryAmountPhysicalKr", "재고금액(실사)")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/90 dark:bg-slate-950/75">
              {pagedStructuredRows.map((r, idx) => (
                <tr
                  key={`${r.whCode}-${r.warehouseName}-${r.category}-${r.monthKey}-${r.code}-${tablePage}-${idx}`}
                  className="border-b border-indigo-100/90 transition-colors hover:bg-indigo-100/55 dark:border-indigo-900/50 dark:hover:bg-indigo-900/45"
                  style={{
                    backgroundColor: (() => {
                      const ratio = Math.min(
                        1,
                        Math.abs(r.codeDelta ?? 0) / codeDiffSoftScale,
                      );
                      const alpha = 0.06 + ratio * 0.16;
                      if ((r.codeDelta ?? 0) > 0) {
                        return `rgba(254, 226, 226, ${alpha})`;
                      }
                      if ((r.codeDelta ?? 0) < 0) {
                        return `rgba(219, 234, 254, ${alpha})`;
                      }
                      return idx % 2 === 0
                        ? "rgba(255,255,255,0.8)"
                        : "rgba(238,242,255,0.45)";
                    })(),
                  }}
                >
                  <td className="px-2 py-1.5 font-mono text-xs font-bold text-indigo-950 dark:text-indigo-100">
                    {r.whCode}
                  </td>
                  <td
                    className="max-w-[220px] truncate px-2 py-1.5 text-slate-800 dark:text-slate-200"
                    title={
                      r.warehouseName !== "—"
                        ? String(r.warehouseName)
                        : undefined
                    }
                  >
                    {r.warehouseName}
                  </td>
                  <td className="px-2 py-1.5 text-slate-800 dark:text-slate-200">
                    {r.category}
                  </td>
                  <td className="px-2 py-1.5 font-semibold text-indigo-900 dark:text-indigo-200">
                    {r.month}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-slate-800 dark:text-slate-200">
                    {r.code === "∅"
                      ? tl("codeEmptyLabel", "(코드 없음)")
                      : r.code}
                  </td>
                  <td
                    className="max-w-[160px] truncate px-2 py-1.5 text-[11px] font-semibold text-cyan-900 dark:text-cyan-200"
                    title={
                      r.reason !== "—" ? String(r.reason) : undefined
                    }
                  >
                    {r.reason}
                  </td>
                  <td
                    className="max-w-[100px] truncate px-2 py-1.5 text-[11px] font-semibold text-sky-900 dark:text-sky-200"
                    title={r.unit !== "—" ? String(r.unit) : undefined}
                  >
                    {r.unit}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums font-semibold text-amber-900 dark:text-amber-200">
                    {r.actualQty.toLocaleString("vi-VN", {
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-800 dark:text-slate-200">
                    {r.sysQty.toLocaleString("vi-VN", {
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums font-bold text-orange-700 dark:text-orange-400">
                    {r.monthlyDiff.toLocaleString("vi-VN", {
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums font-bold text-rose-700 dark:text-rose-400">
                    {r.codeDelta.toLocaleString("vi-VN", {
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                    {formatKRW(r.amountDelta ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-indigo-200/80 bg-white/85 px-3 py-2 text-[11px] font-bold text-indigo-950 dark:border-indigo-800/90 dark:bg-slate-950/85 dark:text-indigo-100">
          <span className="tabular-nums">
            {tl(
              "tablePageSummary",
              "페이지 {{page}}/{{total}} · {{count}}행",
              {
                page: tablePage,
                total: tableTotalPages,
                count: filteredStructuredRows.length,
              },
            )}
          </span>
          <div className="dashboard-no-print flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTablePage((p) => Math.max(1, p - 1))}
              disabled={tablePage <= 1}
              className="rounded-lg border-2 border-indigo-400/70 bg-white px-3 py-1 text-[11px] font-black text-indigo-800 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-indigo-500 dark:bg-indigo-950/80 dark:text-indigo-100 dark:hover:bg-indigo-900"
            >
              {tl("paginationPrev", "이전")}
            </button>
            <button
              type="button"
              onClick={() =>
                setTablePage((p) => Math.min(tableTotalPages, p + 1))
              }
              disabled={tablePage >= tableTotalPages}
              className="rounded-lg border-2 border-indigo-400/70 bg-white px-3 py-1 text-[11px] font-black text-indigo-800 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-indigo-500 dark:bg-indigo-950/80 dark:text-indigo-100 dark:hover:bg-indigo-900"
            >
              {tl("paginationNext", "다음")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(FiltersAndTableSection);
