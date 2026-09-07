import React, { memo } from "react";
import { FiRefreshCw, FiTrash2, FiUpload } from "react-icons/fi";
import { formatKRW } from "../lib/parse";
import InventoryFilterBar from "./InventoryFilterBar";
import InventoryTablePanel from "./InventoryTablePanel";

function KpiTile({ label, value, accent = "slate" }) {
  const accents = {
    slate: "border-slate-200",
    amber: "border-amber-200 bg-amber-50/50",
    rose: "border-rose-200 bg-rose-50/50",
    emerald: "border-emerald-200 bg-emerald-50/50",
  };
  return (
    <div
      className={`rounded-xl border bg-white p-3 shadow-sm dark:bg-slate-900 ${accents[accent] ?? accents.slate}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function InventoryWorkbench({
  tl,
  fileName,
  stats,
  structuredSummary,
  loading,
  isRevalidatingCloud,
  onRefreshCloud,
  handleFile,
  clearData,
  ...tableProps
}) {
  const qtyRate =
    structuredSummary.qtyDiffRate == null
      ? "—"
      : `${(structuredSummary.qtyDiffRate * 100).toLocaleString("vi-VN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}%`;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-3 py-4 sm:px-4">
      <header className="dashboard-no-print rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {tl("pageTitle", "Báo cáo kiểm kê")}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {tl("fileLabel", "File")}:
              </span>{" "}
              <span className="font-mono text-xs">{fileName || "—"}</span>
              <span className="mx-2 text-slate-300">|</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {tl("period", "Kỳ")}:
              </span>{" "}
              {stats.periodLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">
              <FiUpload aria-hidden />
              {tl("uploadBtn", "Chọn Excel")}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFile}
                disabled={loading}
              />
            </label>
            <button
              type="button"
              onClick={onRefreshCloud}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <FiRefreshCw
                className={isRevalidatingCloud ? "animate-spin" : ""}
                aria-hidden
              />
              {isRevalidatingCloud
                ? tl("refreshingCloud", "Đang làm mới…")
                : tl("refreshCloud", "Làm mới")}
            </button>
            <button
              type="button"
              onClick={clearData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <FiTrash2 aria-hidden />
              {tl("clearBtn", "Xóa")}
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiTile
          label={tl("colActualQty", "SL thực tế")}
          value={structuredSummary.actual.toLocaleString("vi-VN", {
            maximumFractionDigits: 4,
          })}
          accent="amber"
        />
        <KpiTile
          label={tl("colSystemQtyKr", "SL hệ thống")}
          value={structuredSummary.sys.toLocaleString("vi-VN", {
            maximumFractionDigits: 4,
          })}
        />
        <KpiTile
          label={tl("colMonthlyDiffKr", "GAP")}
          value={structuredSummary.monthlyDiff.toLocaleString("vi-VN", {
            maximumFractionDigits: 4,
          })}
          accent="rose"
        />
        <KpiTile
          label={tl("gapAmountLabel", "Số tiền GAP")}
          value={formatKRW(structuredSummary.gapAmount)}
          accent="emerald"
        />
        <KpiTile
          label={tl("qtyDiffRateLabel", "Tỉ lệ chênh lệch")}
          value={qtyRate}
        />
      </div>

      <InventoryFilterBar tl={tl} {...tableProps} />

      <InventoryTablePanel
        tl={tl}
        structuredSummary={structuredSummary}
        {...tableProps}
      />
    </div>
  );
}

export default memo(InventoryWorkbench);
