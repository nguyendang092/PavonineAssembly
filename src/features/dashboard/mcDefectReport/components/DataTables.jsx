import React, { memo } from "react";

/** Ô nhập — luôn có chữ tối / nền sáng (tránh chữ trắng trên nền trắng). */
const MC_DEFECT_FORM_FIELD =
  "box-border h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 leading-normal placeholder:text-slate-400 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 [color-scheme:light] dark:[color-scheme:dark]";

const MC_DEFECT_BTN_PRIMARY =
  "box-border flex h-10 flex-1 items-center justify-center rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60";

const MC_DEFECT_BTN_SECONDARY =
  "box-border flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-slate-400 bg-slate-200 px-4 text-sm font-semibold text-slate-900 hover:bg-slate-300 disabled:opacity-60 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600";

const PaginationBar = memo(function PaginationBar({
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
          className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          Trước
        </button>
        <span>{`Trang ${page}/${totalPages}`}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          Sau
        </button>
      </div>
    </div>
  );
});

export const MCDefectReportEntrySection = memo(function MCDefectReportEntrySection({
  saving,
  form,
  editingRecord,
  handleChange,
  handleSubmit,
  onCancelEdit,
  onDownloadTemplate,
  onImportExcel,
  rawRowsPaged,
  filteredRows,
  currentRawPage,
  totalRawPages,
  rowsPerPage,
  onPrevRawPage,
  onNextRawPage,
  onEdit,
  onDelete,
}) {
  const isEditing = Boolean(editingRecord);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
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
        {isEditing ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            Đang sửa bản ghi — chỉnh các ô bên dưới rồi bấm «Cập nhật». Đổi ngày / NV / BP / loại lỗi sẽ
            thay bản ghi cũ bằng bản ghi mới (không nhân đôi).
          </p>
        ) : null}
        <form
          onSubmit={handleSubmit}
          className={`grid grid-cols-1 gap-3 rounded-xl border p-4 md:grid-cols-6 ${
            isEditing
              ? "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30"
              : "border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/40"
          }`}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Ngày
            </span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => handleChange("date", e.target.value)}
              className={MC_DEFECT_FORM_FIELD}
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
              className={MC_DEFECT_FORM_FIELD}
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
              className={MC_DEFECT_FORM_FIELD}
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
              className={MC_DEFECT_FORM_FIELD}
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
              className={MC_DEFECT_FORM_FIELD}
            />
          </label>
          <div className="flex flex-col gap-1">
            <span
              className="text-xs font-semibold text-slate-600 opacity-0 dark:text-slate-300"
              aria-hidden
            >
              Thao tác
            </span>
            <div className="flex h-10 items-stretch gap-2">
              <button
                type="submit"
                className={MC_DEFECT_BTN_PRIMARY}
                disabled={saving}
              >
                {saving
                  ? "Đang lưu..."
                  : isEditing
                    ? "Cập nhật"
                    : "Thêm bản ghi"}
              </button>
              {isEditing ? (
                <button
                  type="button"
                  onClick={onCancelEdit}
                  disabled={saving}
                  className={MC_DEFECT_BTN_SECONDARY}
                >
                  Hủy sửa
                </button>
              ) : null}
            </div>
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
              className={MC_DEFECT_FORM_FIELD}
            />
          </label>
        </form>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm text-slate-900 dark:text-slate-100">
            <thead className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
              <tr>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  STT
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  Ngày
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  Nhân viên
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  Bộ phận
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  Loại lỗi
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  Số lỗi
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  Note
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {rawRowsPaged.map((row, idx) => {
                const rowIsEditing =
                  editingRecord?.date === row.date &&
                  editingRecord?.recordKey === row.recordKey;
                return (
                <tr
                  key={row.id}
                  className={`border-t border-slate-200 dark:border-slate-700 ${
                    rowIsEditing
                      ? "bg-amber-50/90 dark:bg-amber-950/25"
                      : ""
                  }`}
                >
                  <td className="px-3 py-2 text-center text-slate-900 dark:text-slate-100">
                    {(currentRawPage - 1) * rowsPerPage + idx + 1}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-900 dark:text-slate-100">
                    {row.date}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-900 dark:text-slate-100">
                    {row.employee}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-900 dark:text-slate-100">
                    {row.department}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-900 dark:text-slate-100">
                    {row.errorType}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold text-slate-900 dark:text-slate-100">
                    {row.errorCount}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-900 dark:text-slate-100">
                    {row.note || "-"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        disabled={saving}
                        className="rounded bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-200 disabled:opacity-50 dark:bg-sky-950/50 dark:text-sky-200"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onDelete({
                            date: row.date,
                            recordKey: row.recordKey,
                          })
                        }
                        disabled={saving}
                        className="rounded bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200 disabled:opacity-50"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
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
});

export const MCDefectReportPivotSection = memo(function MCDefectReportPivotSection({
  detailRowsPaged,
  detailRows,
  currentDetailPage,
  totalDetailPages,
  rowsPerPage,
  onPrevDetailPage,
  onNextDetailPage,
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
        Bảng chi tiết tổng hợp (Pivot)
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-slate-900 dark:text-slate-100">
          <thead className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
            <tr>
              <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                STT
              </th>
              <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                Nhân viên
              </th>
              <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                Bộ phận
              </th>
              <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                Tổng lỗi
              </th>
              <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                Ngày lỗi gần nhất
              </th>
              <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                Ghi chú
              </th>
            </tr>
          </thead>
          <tbody>
            {detailRowsPaged.map((row, idx) => (
              <tr
                key={`${row.employee}-${row.department}`}
                className="border-t border-slate-200 dark:border-slate-700"
              >
                <td className="px-3 py-2 text-center text-slate-900 dark:text-slate-100">
                  {(currentDetailPage - 1) * rowsPerPage + idx + 1}
                </td>
                <td className="px-3 py-2 text-center font-semibold text-slate-900 dark:text-slate-100">
                  {row.employee}
                </td>
                <td className="px-3 py-2 text-center text-slate-900 dark:text-slate-100">
                  {row.department}
                </td>
                <td className="px-3 py-2 text-center font-bold text-slate-900 dark:text-slate-100">
                  {row.totalError}
                </td>
                <td className="px-3 py-2 text-center text-slate-900 dark:text-slate-100">
                  {row.latestDate}
                </td>
                <td className="px-3 py-2 text-center text-slate-900 dark:text-slate-100">
                  {row.note || "-"}
                </td>
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
});
