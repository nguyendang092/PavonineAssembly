import React, { memo } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const tl = (key, defaultValue, opts) =>
    t(`mcDefectReport.${key}`, { defaultValue, ...opts });

  return (
    <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
      <span>{tl("paginationShown", "Hiển thị {{shown}} / {{total}} dòng", { shown, total })}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrev}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          {tl("prev", "Trước")}
        </button>
        <span>{tl("pageOf", "Trang {{page}}/{{totalPages}}", { page, totalPages })}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          {tl("next", "Sau")}
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
  const { t } = useTranslation();
  const tl = (key, defaultValue, opts) =>
    t(`mcDefectReport.${key}`, { defaultValue, ...opts });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
        {tl("entryTitle", "Nhập liệu + Import Excel (3-6 cột)")}
      </h3>
      <div className="space-y-5">
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/40">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {tl("templateHint", "Tải template Excel để import dữ liệu.")}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDownloadTemplate}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {tl("downloadTemplate", "Tải template")}
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                {saving ? tl("processing", "Đang xử lý...") : tl("importExcel", "Import Excel")}
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
            {tl(
              "editingHint",
              "Đang sửa bản ghi — chỉnh các ô bên dưới rồi bấm «Cập nhật». Đổi ngày / NV / BP / loại lỗi sẽ thay bản ghi cũ bằng bản ghi mới (không nhân đôi).",
            )}
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
              {tl("date", "Ngày")}
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
              {tl("employee", "Nhân viên")}
            </span>
            <input
              type="text"
              value={form.employee}
              onChange={(e) => handleChange("employee", e.target.value)}
              placeholder={tl("employeePlaceholder", "Nhập tên nhân viên")}
              className={MC_DEFECT_FORM_FIELD}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {tl("department", "Bộ phận")}
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
              {tl("errorType", "Loại lỗi")}
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
              {tl("errorCount", "Số lỗi")}
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
              {tl("actions", "Thao tác")}
            </span>
            <div className="flex h-10 items-stretch gap-2">
              <button
                type="submit"
                className={MC_DEFECT_BTN_PRIMARY}
                disabled={saving}
              >
                {saving
                  ? tl("saving", "Đang lưu...")
                  : isEditing
                    ? tl("updateRecord", "Cập nhật")
                    : tl("addRecord", "Thêm bản ghi")}
              </button>
              {isEditing ? (
                <button
                  type="button"
                  onClick={onCancelEdit}
                  disabled={saving}
                  className={MC_DEFECT_BTN_SECONDARY}
                >
                  {tl("cancelEdit", "Hủy sửa")}
                </button>
              ) : null}
            </div>
          </div>
          <label className="md:col-span-6">
            <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              {tl("note", "Ghi chú")}
            </span>
            <input
              type="text"
              value={form.note}
              onChange={(e) => handleChange("note", e.target.value)}
              placeholder={tl(
                "notePlaceholder",
                "Ghi chú xử lý / hành động khắc phục",
              )}
              className={MC_DEFECT_FORM_FIELD}
            />
          </label>
        </form>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm text-slate-900 dark:text-slate-100">
            <thead className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
              <tr>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  {tl("index", "STT")}
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  {tl("date", "Ngày")}
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  {tl("employee", "Nhân viên")}
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  {tl("department", "Bộ phận")}
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  {tl("errorType", "Loại lỗi")}
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  {tl("errorCount", "Số lỗi")}
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  Note
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                  {tl("actions", "Hành động")}
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
                        {tl("edit", "Sửa")}
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
                        {tl("delete", "Xóa")}
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
  const { t } = useTranslation();
  const tl = (key, defaultValue, opts) =>
    t(`mcDefectReport.${key}`, { defaultValue, ...opts });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
        {tl("pivotTitle", "Bảng chi tiết tổng hợp (Pivot)")}
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-slate-900 dark:text-slate-100">
          <thead className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
            <tr>
              <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                {tl("index", "STT")}
              </th>
              <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                {tl("employee", "Nhân viên")}
              </th>
              <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                {tl("department", "Bộ phận")}
              </th>
              <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                {tl("totalErrors", "Tổng lỗi")}
              </th>
              <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                {tl("latestErrorDate", "Ngày lỗi gần nhất")}
              </th>
              <th className="px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">
                {tl("note", "Ghi chú")}
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
