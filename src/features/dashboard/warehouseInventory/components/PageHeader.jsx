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
  fileName,
  periodLabel,
}) {
  return (
    <>
      <header className="dashboard-no-print wah-inv-page-header">
        <div className="wah-inv-page-header__copy">
          <h1 className="wah-inv-page-header__title">
            {tl("pageTitle", "Báo cáo kiểm kê")}
          </h1>
          {rows.length > 0 ? (
            <p className="wah-inv-page-header__meta">
              <span title={fileName || undefined}>{fileName || "—"}</span>
              {periodLabel ? (
                <>
                  <span className="wah-inv-meta-sep">·</span>
                  {periodLabel}
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="wah-inv-actions">
          <label className="wah-inv-btn wah-inv-btn--primary">
            <FiUpload aria-hidden />
            {tl("uploadBtn", "Mở Excel")}
            <input
              type="file"
              accept=".xlsx,.xls"
              hidden
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
              className={isRevalidatingCloud ? "is-spinning" : ""}
              aria-hidden
            />
            {isRevalidatingCloud
              ? tl("refreshingCloud", "Đang tải…")
              : tl("refreshCloud", "Làm mới")}
          </button>
          {rows.length > 0 ? (
            <button
              type="button"
              onClick={clearData}
              className="wah-inv-btn wah-inv-btn--ghost"
            >
              <FiTrash2 aria-hidden />
              {tl("clearBtn", "Xóa")}
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
        <p className="dashboard-no-print wah-inv-status">
          {tl("loading", "Đang đọc…")}
        </p>
      ) : null}

      {rows.length === 0 && !loading ? (
        <div className="dashboard-no-print wah-inv-empty">
          <p>{tl("emptyTitle", "Chưa có dữ liệu")}</p>
          <p>{tl("emptyHint", "Bấm «Mở Excel» để tải báo cáo tồn kho.")}</p>
        </div>
      ) : null}
    </>
  );
}
