import React, { useEffect, useState } from "react";
import { FiDownload, FiRefreshCw, FiTrash2, FiUpload } from "react-icons/fi";
import { downloadWarehouseInventoryTemplate } from "../lib/downloadWarehouseInventoryTemplate";

export default function PageHeader({
  tl,
  rows,
  loading,
  isRevalidatingCloud,
  onRefreshCloud,
  error,
  handleFile,
  monthTableOptions = [],
  monthFilter = "",
  deleteMonth,
}) {
  const [deleteMonthKey, setDeleteMonthKey] = useState(monthFilter);

  useEffect(() => {
    if (monthFilter) {
      setDeleteMonthKey(monthFilter);
      return;
    }
    setDeleteMonthKey((cur) =>
      monthTableOptions.some((m) => m.value === cur) ? cur : "",
    );
  }, [monthFilter, monthTableOptions]);

  return (
    <>
      <header className="dashboard-no-print wah-inv-page-header">
        <div className="wah-inv-page-header__copy">
          <h1 className="wah-inv-page-header__title">
            {tl("pageTitle", "Báo cáo kiểm kê")}
          </h1>
        </div>
        <div className="wah-inv-header-tools">
          <div className="wah-inv-header-tools__file">
            <label className="wah-inv-btn wah-inv-btn--primary">
              <FiUpload aria-hidden />
              {tl("uploadBtn", "Upload Excel")}
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
              onClick={downloadWarehouseInventoryTemplate}
              className="wah-inv-btn wah-inv-btn--ghost"
            >
              <FiDownload aria-hidden />
              {tl("downloadTemplate", "Tải template")}
            </button>
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
          </div>
          {rows.length > 0 ? (
            <div className="wah-inv-month-del">
              <select
                className="wah-inv-month-del__select"
                value={deleteMonthKey}
                onChange={(ev) => setDeleteMonthKey(ev.target.value)}
                aria-label={tl("deleteMonthPick", "Chọn tháng")}
              >
                <option value="">{tl("deleteMonthPick", "Chọn tháng")}</option>
                {monthTableOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => deleteMonth(deleteMonthKey)}
                disabled={!deleteMonthKey || loading}
                className="wah-inv-month-del__btn"
              >
                <FiTrash2 aria-hidden />
                {tl("deleteMonthBtn", "Xóa tháng")}
              </button>
            </div>
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
          <p>
            {tl(
              "emptyHint",
              "Bấm «Upload Excel» để tải báo cáo, hoặc «Tải template» để lấy file mẫu.",
            )}
          </p>
        </div>
      ) : null}
    </>
  );
}
