import React from "react";
import { MC_DEFECT_FILTER_ALL } from "./lib/constants";
import FiltersSidebar from "./components/FiltersSidebar";
import KpiCards from "./components/KpiCards";
import ChartsTopRow from "./components/ChartsTopRow";
import ChartsHeatmapDonutRow from "./components/ChartsHeatmapDonutRow";
import {
  MCDefectReportEntrySection,
  MCDefectReportPivotSection,
} from "./components/DataTables";
import { useMcDefectDashboard } from "./hooks/useMcDefectDashboard";

function MessageBanner({ message, messageType }) {
  if (!message) return null;
  const tone =
    messageType === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
      : messageType === "error"
        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
        : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
  return (
    <div className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${tone}`}>
      {message}
    </div>
  );
}

/** Trang «Báo cáo hàng lỗi MC» — chỉ ghép layout; logic nằm trong hook + lib. */
export default function McDefectReportPage() {
  const {
    dashboardExportRef,
    loading,
    message,
    messageType,
    saving,
    reportOwner,
    setReportOwner,
    filters,
    kpi,
    charts,
    tables,
    form,
    actions,
  } = useMcDefectDashboard();

  return (
    <div className="min-h-full bg-slate-100 px-4 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div ref={dashboardExportRef} className="w-full space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                Sản xuất / MC
              </p>
              <h1 className="text-2xl font-black tracking-wide text-slate-900 dark:text-slate-100">
                BÁO CÁO HÀNG LỖI BỘ PHẬN MC
              </h1>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
                <p className="text-[10px] uppercase text-slate-500">Report Month</p>
                <p>
                  {filters.reportMonth === MC_DEFECT_FILTER_ALL
                    ? "All"
                    : filters.reportMonth}
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
                <p className="text-[10px] uppercase text-slate-500">Last Updated</p>
                <p>{new Date().toLocaleString("ko-KR")}</p>
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
                <p className="text-[10px] uppercase text-slate-500">Department</p>
                <p>
                  {filters.reportDepartment === MC_DEFECT_FILTER_ALL
                    ? "All"
                    : filters.reportDepartment}
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
                <p className="text-[10px] uppercase text-slate-500">Xuất báo cáo</p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={actions.handleDownloadImage}
                    className="w-full rounded bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-700"
                  >
                    Tải hình
                  </button>
                  <button
                    type="button"
                    onClick={actions.handleDownloadPdf}
                    className="w-full rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                  >
                    Xuất PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Đang tải dữ liệu từ Firebase...
          </div>
        ) : null}

        {!loading ? (
          <MessageBanner message={message} messageType={messageType} />
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          <FiltersSidebar
            {...filters}
            onResetFilters={filters.handleResetFilters}
          />

          <div className="min-w-0 flex-1 space-y-4">
            <KpiCards {...kpi} />
            <ChartsTopRow {...charts} />
            <ChartsHeatmapDonutRow {...charts} />
            <MCDefectReportEntrySection
              saving={saving}
              form={form.form}
              handleChange={form.handleChange}
              handleSubmit={form.handleSubmit}
              onDownloadTemplate={actions.handleDownloadTemplate}
              onImportExcel={actions.handleImportExcel}
              rawRowsPaged={tables.rawRowsPaged}
              filteredRows={tables.filteredRows}
              currentRawPage={tables.currentRawPage}
              totalRawPages={tables.totalRawPages}
              rowsPerPage={tables.rowsPerPage}
              onPrevRawPage={() =>
                tables.setCurrentRawPage((p) => Math.max(1, p - 1))
              }
              onNextRawPage={() =>
                tables.setCurrentRawPage((p) =>
                  Math.min(tables.totalRawPages, p + 1),
                )
              }
              onDelete={actions.handleDelete}
            />
            <MCDefectReportPivotSection
              detailRowsPaged={tables.detailRowsPaged}
              detailRows={tables.detailRows}
              currentDetailPage={tables.currentDetailPage}
              totalDetailPages={tables.totalDetailPages}
              rowsPerPage={tables.rowsPerPage}
              onPrevDetailPage={() =>
                tables.setCurrentDetailPage((p) => Math.max(1, p - 1))
              }
              onNextDetailPage={() =>
                tables.setCurrentDetailPage((p) =>
                  Math.min(tables.totalDetailPages, p + 1),
                )
              }
            />

            <footer className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Người tạo báo cáo:{" "}
                  <input
                    value={reportOwner}
                    onChange={(e) => setReportOwner(e.target.value)}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                  />
                </p>
                <p>Cập nhật lúc: {new Date().toLocaleString("vi-VN")}</p>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
