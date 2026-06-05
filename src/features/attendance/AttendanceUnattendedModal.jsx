import React, { memo, useEffect } from "react";

function AttendanceUnattendedModal({
  showUnattendedPopup,
  unattendedEmployees,
  closeUnattendedPopup,
  unattendedSuppressSessionCheckbox,
  setUnattendedSuppressSessionCheckbox,
  setShowOnlyUnattendedFilter,
  selectedDate,
  displayLocale,
  tl,
  t,
}) {
  const isOpen = showUnattendedPopup && unattendedEmployees.length > 0;

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/55 p-3 backdrop-blur-sm sm:p-4"
      style={{ zIndex: "var(--z-modal-backdrop, 1200)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="unattended-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeUnattendedPopup();
      }}
    >
      <div
        className="flex max-h-[min(90vh,640px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-violet-300 bg-violet-50 shadow-xl shadow-violet-400/30 dark:border-violet-700 dark:bg-slate-900 dark:shadow-violet-950/50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-violet-500 via-violet-400 to-indigo-500 px-4 py-3 text-white dark:from-violet-800 dark:via-violet-900 dark:to-indigo-900 dark:text-violet-50">
          <h2
            id="unattended-modal-title"
            className="min-w-0 truncate text-lg font-bold leading-tight"
          >
            {tl("unattendedTitle", "Nhân viên chưa điểm danh")}
          </h2>
          <button
            type="button"
            onClick={closeUnattendedPopup}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/20 dark:text-violet-100 dark:hover:bg-white/15"
            aria-label={t("attendanceList.close")}
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-violet-50 px-4 py-4 dark:bg-slate-900">
          <p className="mb-3 text-sm leading-relaxed text-indigo-900 dark:text-violet-100">
            {tl(
              "unattendedSummary",
              "Hiện có {{count}} nhân viên chưa có thời gian vào trong ngày {{date}}.",
              {
                count: unattendedEmployees.length,
                date: new Date(selectedDate).toLocaleDateString(displayLocale),
              },
            )}
          </p>

          <div className="max-h-[min(48vh,380px)] overflow-auto rounded-xl border border-violet-200 bg-white dark:border-violet-800 dark:bg-slate-950">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-[1] bg-violet-400 text-white dark:bg-violet-800 dark:text-violet-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide">
                    {tl("colIndex", "STT")}
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide">
                    {tl("colCode", "MNV")}
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide">
                    {tl("colName", "Họ và tên")}
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide">
                    {tl("colDepartment", "Bộ phận")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {unattendedEmployees.map((emp, idx) => (
                  <tr
                    key={emp.id}
                    className={`transition-colors hover:bg-violet-100 dark:hover:bg-violet-900/50 ${
                      idx % 2 === 0
                        ? "bg-white dark:bg-slate-950"
                        : "bg-violet-50 dark:bg-violet-950/60"
                    }`}
                  >
                    <td className="px-3 py-2.5 font-medium tabular-nums text-slate-500 dark:text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-indigo-700 dark:text-violet-300">
                      {emp.mnv || "--"}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-200">
                      {emp.hoVaTen || "--"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {emp.boPhan || "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-violet-300 bg-violet-100 px-4 py-3 dark:border-violet-700 dark:bg-violet-950">
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left">
            <input
              type="checkbox"
              checked={unattendedSuppressSessionCheckbox}
              onChange={() => setUnattendedSuppressSessionCheckbox((v) => !v)}
              className="h-[18px] w-[18px] shrink-0 rounded border-violet-300 text-violet-600 focus:ring-2 focus:ring-violet-300/60 dark:border-violet-600 dark:text-violet-400"
            />
            <span className="min-w-0 text-[11px] font-medium leading-snug text-slate-600 dark:text-slate-400">
              {tl(
                "unattendedSuppressSession",
                "Không tự hiển thị lại hộp thoại này trong phiên đăng nhập hiện tại",
              )}
            </span>
          </label>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeUnattendedPopup}
              className="rounded-lg border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-violet-100 dark:border-violet-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {t("attendanceList.close")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowOnlyUnattendedFilter(true);
                closeUnattendedPopup();
              }}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-300/45 transition hover:from-violet-600 hover:to-indigo-600 dark:from-violet-600 dark:to-indigo-600 dark:shadow-violet-950/40"
            >
              {t("attendanceList.quickFilter")}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default memo(AttendanceUnattendedModal);
