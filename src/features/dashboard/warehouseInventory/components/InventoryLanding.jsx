import React from "react";
import { FiUpload } from "react-icons/fi";

export default function InventoryLanding({
  tl,
  loading,
  error,
  handleFile,
  rows,
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      {error ? (
        <div
          className="dashboard-no-print mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <p className="text-sm text-slate-500">{tl("loading", "Đang đọc file…")}</p>
      ) : null}

      {!loading && rows.length === 0 ? (
        <div className="dashboard-no-print rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-12 shadow-sm dark:border-slate-600 dark:bg-slate-900">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {tl("pageTitle", "Báo cáo kiểm kê")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {tl(
              "emptyHint",
              "Xuất báo cáo tồn kho từ ERP/Excel, rồi tải file lên để xem chênh lệch.",
            )}
          </p>
          <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-500">
            <FiUpload aria-hidden />
            {tl("uploadBtn", "Chọn file Excel")}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
