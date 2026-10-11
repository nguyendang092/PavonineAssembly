import React, { memo, useCallback, useRef } from "react";
import {
  formatAttendanceLeaveTypeColumnForEmployee,
  getAttendanceLeaveTypeColorClassNameForEmployee,
} from "./attendanceGioVaoTypeOptions";
import { resolveAttendanceDisplayStt } from "./attendanceSeasonalStt";
import {
  buildComboStatDetailExportFileBase,
  exportComboStatDetailExcel,
  exportComboStatDetailImage,
} from "./attendanceComboStatDetailExport";
import { loadAttendanceEmployeeFormModal } from "./loadAttendanceEmployeeFormModal";
import { toast } from "@/components/ui/toast";

function AttendanceComboStatDetailPanel({
  comboStatDetailKey,
  detailMetricLabel,
  detailEmployees,
  isSeasonalAttendance,
  setComboStatDetailKey,
  tl,
  t,
  onEditEmployee,
  canEditEmployee,
}) {
  const showEditColumn = typeof onEditEmployee === "function";
  const colCount = showEditColumn ? 8 : 7;
  const captureRef = useRef(null);

  const handleExportImage = useCallback(() => {
    void exportComboStatDetailImage(
      captureRef.current,
      buildComboStatDetailExportFileBase(comboStatDetailKey),
      () => toast.error(tl("exportImageFail", "Không thể xuất hình. Vui lòng thử lại.")),
    );
  }, [comboStatDetailKey, tl]);

  const handleExportExcel = useCallback(() => {
    void exportComboStatDetailExcel({
      employees: detailEmployees,
      fileBase: buildComboStatDetailExportFileBase(comboStatDetailKey),
      tl,
      isSeasonalAttendance,
      onFail: () =>
        toast.error(tl("exportExcelFail", "Không thể xuất Excel. Vui lòng thử lại.")),
    });
  }, [comboStatDetailKey, detailEmployees, isSeasonalAttendance, tl]);

  if (!comboStatDetailKey) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="combo-stat-detail-title"
      className="absolute inset-0 flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-6"
      style={{ zIndex: "var(--z-modal-content, 1210)" }}
      onClick={() => setComboStatDetailKey(null)}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[98vw] flex-col overflow-hidden rounded-lg border border-sky-400/60 bg-white sm:max-h-[min(90vh,940px)] sm:max-w-[min(96vw,80rem)] sm:rounded-xl sm:border-2 dark:border-sky-500/40 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center bg-gradient-to-r from-sky-600 via-sky-500 to-teal-500 px-16 py-2.5 sm:px-28 sm:py-3">
          <div className="min-w-0 text-center">
            <p className="text-[8px] font-bold uppercase leading-none tracking-[0.1em] text-sky-100/95 sm:text-[9px] sm:tracking-[0.12em]">
              {tl("comboStatDetailBadge", "Chi tiết danh sách")}
            </p>
            <h4
              id="combo-stat-detail-title"
              className="mt-1 text-sm font-extrabold leading-tight text-white sm:text-[1.05rem]"
            >
              {detailMetricLabel}
            </h4>
            <span className="mt-1 inline-flex items-center justify-center rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold text-white ring-1 ring-white/35 sm:px-2 sm:text-[11px]">
              {tl("peopleCount", "{{count}} người", {
                count: detailEmployees.length ?? 0,
              })}
            </span>
          </div>
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 sm:right-4">
            <button
              type="button"
              onClick={handleExportImage}
              className="inline-flex h-7 items-center justify-center rounded-md bg-white/15 px-1.5 text-[10px] font-bold text-white ring-1 ring-white/40 transition hover:bg-white/25 sm:h-8 sm:px-2.5 sm:text-[11px]"
            >
              {tl("exportImage", "Xuất hình")}
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex h-7 items-center justify-center rounded-md bg-white/15 px-1.5 text-[10px] font-bold text-white ring-1 ring-white/40 transition hover:bg-white/25 sm:h-8 sm:px-2.5 sm:text-[11px]"
            >
              {tl("exportExcel", "Xuất Excel")}
            </button>
            <button
              type="button"
              onClick={() => setComboStatDetailKey(null)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-sm leading-none text-white ring-1 ring-white/40 transition hover:bg-white/25 sm:h-9 sm:w-9 sm:rounded-lg sm:text-lg"
              aria-label={t("attendanceList.close")}
            >
              ✕
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50 px-1.5 py-2 sm:px-4 sm:py-3 dark:bg-slate-950">
          <div
            ref={captureRef}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900"
          >
            <div className="max-h-[70vh] overflow-auto sm:max-h-[min(68vh,760px)]">
              <table className="min-w-[720px] table-fixed border-collapse text-center text-[11px] leading-snug sm:min-w-0 sm:w-full sm:text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-800 text-white">
                    <th className="w-9 px-1 py-2 text-center text-[10px] font-extrabold uppercase sm:w-12 sm:px-2 sm:py-2.5">
                      {tl("colIndex", "STT")}
                    </th>
                    <th className="w-11 px-1 py-2 text-center text-[10px] font-extrabold uppercase sm:w-20 sm:px-2">
                      {tl("colCode", "MNV")}
                    </th>
                    <th className="w-[26%] px-1 py-2 text-center text-[10px] font-extrabold uppercase sm:w-[22%] sm:px-2">
                      {tl("colName", "Họ và tên")}
                    </th>
                    <th className="w-[14%] px-1 py-2 text-center text-[10px] font-extrabold uppercase sm:w-[18%] sm:px-2">
                      {tl("colDepartment", "Bộ phận")}
                    </th>
                    <th className="w-16 px-1 py-2 text-center text-[10px] font-extrabold uppercase sm:w-24 sm:px-2">
                      {tl("colTimeIn", "Giờ vào")}
                    </th>
                    <th className="w-16 px-1 py-2 text-center text-[10px] font-extrabold uppercase sm:w-24 sm:px-2">
                      {tl("leaveTypeColumn", "Loại phép")}
                    </th>
                    <th className="w-16 px-1 py-2 text-center text-[10px] font-extrabold uppercase sm:w-24 sm:px-2">
                      {tl("comboStatColShift", "Ca làm việc")}
                    </th>
                    {showEditColumn ? (
                      <th className="w-20 px-1 py-2 text-center text-[10px] font-extrabold uppercase sm:w-28 sm:px-2">
                        {tl("comboStatEdit", "Chỉnh sửa")}
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {detailEmployees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={colCount}
                        className="px-3 py-10 text-center text-sm text-slate-500 sm:px-4 sm:py-14"
                      >
                        {tl("noData", "Không có dữ liệu")}
                      </td>
                    </tr>
                  ) : (
                    detailEmployees.map((emp, idx) => {
                      const leaveTypeCol =
                        formatAttendanceLeaveTypeColumnForEmployee(emp);
                      return (
                      <tr
                        key={emp.id ?? `${emp.mnv}-${idx}`}
                        className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/90"
                      >
                        <td className="px-1 py-2 text-center text-sm font-bold tabular-nums sm:px-2 sm:py-2.5">
                          {resolveAttendanceDisplayStt(
                            emp,
                            idx + 1,
                            isSeasonalAttendance,
                          ) ?? idx + 1}
                        </td>
                        <td className="px-1.5 py-2 text-center font-mono text-[11px] font-bold sm:px-3 sm:text-sm">
                          {emp.mnv ?? ""}
                        </td>
                        <td className="px-1 py-2 text-center text-[11px] font-semibold sm:px-3 sm:text-sm">
                          {emp.hoVaTen ?? ""}
                        </td>
                        <td className="px-1 py-2 text-center text-[11px] sm:px-3 sm:text-sm">
                          {emp.boPhan ?? ""}
                        </td>
                        <td className="px-1.5 py-2 text-center font-mono text-[11px] font-bold sm:px-3 sm:text-sm">
                          {emp.gioVao ?? ""}
                        </td>
                        <td className="px-1.5 py-2 text-center text-[11px] sm:px-3 sm:text-sm">
                          {leaveTypeCol ? (
                            <span
                              className={getAttendanceLeaveTypeColorClassNameForEmployee(
                                emp,
                              )}
                            >
                              {leaveTypeCol}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-1.5 py-2 text-center text-[11px] sm:px-3 sm:text-sm">
                          {emp.caLamViec ?? ""}
                        </td>
                        {showEditColumn ? (
                          <td className="px-1 py-2 text-center sm:px-2">
                            {canEditEmployee?.(emp) !== false ? (
                              <button
                                type="button"
                                onPointerEnter={() => {
                                  void loadAttendanceEmployeeFormModal();
                                }}
                                onClick={() => onEditEmployee(emp)}
                                className="inline-flex items-center justify-center rounded-md bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white transition hover:bg-blue-600 sm:px-2 sm:text-[11px]"
                              >
                                {tl("comboStatEdit", "Chỉnh sửa")}
                              </button>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400">
                                —
                              </span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(AttendanceComboStatDetailPanel);
