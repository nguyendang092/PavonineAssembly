import React from "react";
import { FiRefreshCw, FiTrash2, FiUpload } from "react-icons/fi";

export default function PageHeader({
  tl,
  rows,
  loading,
  isRevalidatingCloud,
  onRefreshCloud,
  error,
  handleFile,
  clearData,
}) {
  return (
    <>
      <header className="dashboard-no-print wah-inv-page-header">
        <div>
          <h1 className="wah-inv-page-header__title">
            {tl("pageTitle", "Báo cáo kiểm kê kho")}
          </h1>
          <p className="wah-inv-page-header__subtitle">
            {tl(
              "pageSubtitle",
              "Tải file Excel tồn kho, lọc theo kho/tháng/mã và so sánh chênh lệch giữa các kỳ.",
            )}
          </p>
        </div>
        <div className="wah-inv-actions">
          <label className="wah-inv-btn wah-inv-btn--primary cursor-pointer">
            <FiUpload aria-hidden />
            {tl("uploadBtn", "Chọn file Excel")}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFile}
              disabled={loading && rows.length === 0}
            />
          </label>
          <button
            type="button"
            onClick={onRefreshCloud}
            disabled={loading && rows.length === 0}
            aria-busy={isRevalidatingCloud}
            className="wah-inv-btn wah-inv-btn--ghost"
          >
            <FiRefreshCw
              className={isRevalidatingCloud ? "animate-spin" : ""}
              aria-hidden
            />
            {isRevalidatingCloud
              ? tl("refreshingCloud", "Đang làm mới…")
              : tl("refreshCloud", "Làm mới")}
          </button>
          {rows.length > 0 ? (
            <button
              type="button"
              onClick={clearData}
              className="wah-inv-btn wah-inv-btn--ghost"
            >
              <FiTrash2 aria-hidden />
              {tl("clearBtn", "Xóa dữ liệu")}
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="dashboard-no-print wah-inv-alert" role="alert">
          {error}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <p className="dashboard-no-print mb-4 text-sm font-medium text-slate-600 dark:text-slate-400">
          {tl("loading", "Đang đọc file…")}
        </p>
      ) : null}

      {rows.length === 0 && !loading ? (
        <div className="dashboard-no-print wah-inv-empty">
          <p className="text-base font-bold text-slate-800 dark:text-slate-100">
            {tl("emptyTitle", "Chưa có dữ liệu")}
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {tl(
              "emptyHint",
              "Xuất báo cáo tồn kho từ ERP/Excel (giữ cột THỰC TẾ, STATUS, mã kho, 재고금액…), rồi bấm «Chọn file Excel».",
            )}
          </p>
        </div>
      ) : null}
    </>
  );
}
