import React from "react";

function PaginationBar({
  shown,
  total,
  page,
  totalPages,
  onPrev,
  onNext,
}) {
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
      <span>{`Hiển thị ${shown} / ${total} dòng`}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrev}
          className="rounded border border-slate-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
        >
          Trước
        </button>
        <span>{`Trang ${page}/${totalPages}`}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
          className="rounded border border-slate-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
        >
          Sau
        </button>
      </div>
    </div>
  );
}

export function MCDefectReportEntrySection({
  saving,
  form,
  handleChange,
  handleSubmit,
  onDownloadTemplate,
  onImportExcel,
  rawRowsPaged,
  filteredRows,
  currentRawPage,
  totalRawPages,
  rowsPerPage,
  onPrevRawPage,
  onNextRawPage,
  onDelete,
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
        Nhập liệu + Import Excel (3-6 cột)
      </h3>
      <div className="space-y-5">
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/40">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Tải template Excel để import dữ liệu.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDownloadTemplate}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Tải template
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                {saving ? "Đang xử lý..." : "Import Excel"}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  disabled={saving}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    void onImportExcel(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </div>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40 md:grid-cols-6"
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Ngày
            </span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => handleChange("date", e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Nhân viên
            </span>
            <input
              type="text"
              value={form.employee}
              onChange={(e) => handleChange("employee", e.target.value)}
              placeholder="Nhập tên nhân viên"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Bộ phận
            </span>
            <input
              type="text"
              value={form.department}
              onChange={(e) => handleChange("department", e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Loại lỗi
            </span>
            <input
              type="text"
              value={form.errorType}
              onChange={(e) => handleChange("errorType", e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Số lỗi
            </span>
            <input
              type="number"
              min="0"
              value={form.errorCount}
              onChange={(e) => handleChange("errorCount", e.target.value)}
              placeholder="0"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="h-[42px] w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Thêm bản ghi"}
            </button>
          </div>
          <label className="md:col-span-6">
            <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Ghi chú
            </span>
            <input
              type="text"
              value={form.note}
              onChange={(e) => handleChange("note", e.target.value)}
              placeholder="Ghi chú xử lý / hành động khắc phục"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
        </form>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2 text-center font-bold">STT</th>
                <th className="px-3 py-2 text-center font-bold">Ngày</th>
                <th className="px-3 py-2 text-center font-bold">Nhân viên</th>
                <th className="px-3 py-2 text-center font-bold">Bộ phận</th>
                <th className="px-3 py-2 text-center font-bold">Loại lỗi</th>
                <th className="px-3 py-2 text-center font-bold">Số lỗi</th>
                <th className="px-3 py-2 text-center font-bold">Note</th>
                <th className="px-3 py-2 text-center font-bold">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {rawRowsPaged.map((row, idx) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-200 dark:border-slate-700"
                >
                  <td className="px-3 py-2 text-center">
                    {(currentRawPage - 1) * rowsPerPage + idx + 1}
                  </td>
                  <td className="px-3 py-2 text-center">{row.date}</td>
                  <td className="px-3 py-2 text-center">{row.employee}</td>
                  <td className="px-3 py-2 text-center">{row.department}</td>
                  <td className="px-3 py-2 text-center">{row.errorType}</td>
                  <td className="px-3 py-2 text-center font-semibold">
                    {row.errorCount}
                  </td>
                  <td className="px-3 py-2 text-center">{row.note || "-"}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        onDelete({
                          date: row.date,
                          recordKey: row.recordKey,
                        })
                      }
                      className="rounded bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar
          shown={rawRowsPaged.length}
          total={filteredRows.length}
          page={currentRawPage}
          totalPages={totalRawPages}
          onPrev={() => onPrevRawPage()}
          onNext={() => onNextRawPage()}
        />
      </div>
    </section>
  );
}

export function MCDefectReportPivotSection({
  detailRowsPaged,
  detailRows,
  currentDetailPage,
  totalDetailPages,
  rowsPerPage,
  onPrevDetailPage,
  onNextDetailPage,
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
        Bảng chi tiết tổng hợp (Pivot)
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="px-3 py-2 text-center font-bold">STT</th>
              <th className="px-3 py-2 text-center font-bold">Nhân viên</th>
              <th className="px-3 py-2 text-center font-bold">Bộ phận</th>
              <th className="px-3 py-2 text-center font-bold">Tổng lỗi</th>
              <th className="px-3 py-2 text-center font-bold">
                Ngày lỗi gần nhất
              </th>
              <th className="px-3 py-2 text-center font-bold">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {detailRowsPaged.map((row, idx) => (
              <tr
                key={`${row.employee}-${row.department}`}
                className="border-t border-slate-200 dark:border-slate-700"
              >
                <td className="px-3 py-2 text-center">
                  {(currentDetailPage - 1) * rowsPerPage + idx + 1}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {row.employee}
                </td>
                <td className="px-3 py-2 text-center">{row.department}</td>
                <td className="px-3 py-2 text-center font-bold">
                  {row.totalError}
                </td>
                <td className="px-3 py-2 text-center">{row.latestDate}</td>
                <td className="px-3 py-2 text-center">{row.note || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationBar
        shown={detailRowsPaged.length}
        total={detailRows.length}
        page={currentDetailPage}
        totalPages={totalDetailPages}
        onPrev={onPrevDetailPage}
        onNext={onNextDetailPage}
      />
    </section>
  );
}
