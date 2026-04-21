import React from "react";
import ExcelJS from "exceljs";
import { toPng } from "html-to-image";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { CHART_DRAG_MIME } from "@/utils/chartOrderStorage";
import {
  COMBO_DASHBOARD_TILES,
  COMBO_DASHBOARD_TILE_KEYS_HR,
  COMBO_DASHBOARD_TILE_KEYS_PRODUCTION,
  COMBO_STAT_LABEL_DEFAULTS,
} from "./attendanceComboChartConfig";
import {
  getAttendanceLeaveTypeBadgeClassNameForComboStatKey,
  getAttendanceLeaveTypeColorClassNameForComboStatKey,
  getAttendanceComboBarFillForMetricKey,
  formatAttendanceLeaveTypeColumnForEmployee,
} from "./attendanceGioVaoTypeOptions";

export default function AttendanceComboChartModal({
  open,
  onClose,
  comboDashboardGroup,
  setComboDashboardGroup,
  selectedDate,
  setSelectedDate,
  tl,
  t,
  comboDashboardStats,
  comboChartData,
  comboChartBodyReady,
  comboChartRowsVisible,
  comboDragOverDept,
  setComboDragOverDept,
  handleComboDeptReorder,
  comboChartCardsVisibleCount,
  comboChartDataOrdered,
  comboStatDetailKey,
  setComboStatDetailKey,
  comboStatLabelByKey,
  comboStatEmployeesByKey,
}) {
  const detailTableCaptureRef = React.useRef(null);

  const comboDashboardTileKeySet = React.useMemo(() => {
    const keys =
      comboDashboardGroup === "production"
        ? COMBO_DASHBOARD_TILE_KEYS_HR
        : COMBO_DASHBOARD_TILE_KEYS_PRODUCTION;
    return new Set(keys);
  }, [comboDashboardGroup]);
  const activeComboMetricKeys = React.useMemo(
    () =>
      comboDashboardGroup === "production"
        ? COMBO_DASHBOARD_TILE_KEYS_PRODUCTION
        : COMBO_DASHBOARD_TILE_KEYS_HR,
    [comboDashboardGroup],
  );

  if (!open) return null;

  const detailEmployees =
    comboStatDetailKey != null
      ? (comboStatEmployeesByKey[comboStatDetailKey] ?? [])
      : [];

  const detailMetricLabel =
    comboStatDetailKey != null
      ? (comboStatLabelByKey[comboStatDetailKey] ?? "")
      : "";

  const buildDetailExportFileBase = () => {
    const metric = String(comboStatDetailKey ?? "detail")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    return `thong-ke-chi-tiet_${metric || "detail"}_${stamp}`;
  };

  const handleExportDetailImage = async () => {
    try {
      const node = detailTableCaptureRef.current;
      if (!node) return;
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: Math.min(2, window.devicePixelRatio || 1.5),
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${buildDetailExportFileBase()}.png`;
      a.click();
    } catch (err) {
      alert(tl("exportImageFail", "Không thể xuất hình. Vui lòng thử lại."));
    }
  };

  const handleExportDetailExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Detail");
      ws.addRow([
        tl("colIndex", "STT"),
        tl("colCode", "MNV"),
        tl("colName", "Họ và tên"),
        tl("colDepartment", "Bộ phận"),
        tl("colTimeIn", "Giờ vào"),
        tl("leaveTypeColumn", "Loại phép"),
        tl("comboStatColShift", "Ca làm việc"),
      ]);
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" },
      };
      detailEmployees.forEach((emp, idx) => {
        ws.addRow([
          idx + 1,
          emp.mnv ?? "",
          emp.hoVaTen ?? "",
          emp.boPhan ?? "",
          emp.gioVao ?? "",
          formatAttendanceLeaveTypeColumnForEmployee(emp) || "",
          emp.caLamViec ?? "",
        ]);
      });
      ws.columns = [
        { width: 6 },
        { width: 14 },
        { width: 28 },
        { width: 24 },
        { width: 14 },
        { width: 16 },
        { width: 14 },
      ];
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${buildDetailExportFileBase()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(tl("exportExcelFail", "Không thể xuất Excel. Vui lòng thử lại."));
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4">
      <div className="relative flex h-[94vh] w-[min(100vw,1700px)] max-w-none flex-col overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-100 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-300/80 bg-gradient-to-b from-slate-200/95 to-slate-100 px-4 pb-3 pt-4 dark:border-slate-800 dark:from-slate-950 dark:to-slate-950">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-400">
                {tl("comboChartBadge", "Dashboard điểm danh nhân viên")}
              </p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 sm:text-xl">
                {tl(
                  "comboChartTitle",
                  "Thống kê toàn bộ nhân viên theo bộ phận",
                )}
              </h3>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {tl("comboChartDragHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-300/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label={t("attendanceList.close")}
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setComboDashboardGroup("production")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 ${
                comboDashboardGroup === "production"
                  ? "border-amber-500 bg-amber-500/15 text-amber-950 shadow-sm dark:border-amber-400 dark:bg-amber-500/15 dark:text-amber-100"
                  : "border-slate-300/90 bg-white/70 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {tl("comboDashboardGroupProduction", "Sản xuất")}
            </button>
            <button
              type="button"
              onClick={() => setComboDashboardGroup("hr")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 ${
                comboDashboardGroup === "hr"
                  ? "border-sky-500 bg-sky-500/15 text-sky-900 shadow-sm dark:border-sky-400 dark:bg-sky-500/20 dark:text-sky-100"
                  : "border-slate-300/90 bg-white/70 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {tl("comboDashboardGroupHr", "Nhân sự")}
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {tl("date", "Ngày")}:
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/35 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {comboDashboardGroup === "production" &&
            comboDashboardStats.total > 0 ? (
              <button
                type="button"
                onClick={() => setComboStatDetailKey("total")}
                className="min-w-[calc(50%-0.16rem)] flex-1 basis-[108px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-1.5 py-1.5 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[100px] sm:max-w-[156px] dark:border-slate-700/90 dark:bg-slate-900/95"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  {tl("totalEmployees", "Tổng số nhân viên")}
                </p>
                <p className="text-base font-bold text-slate-900 dark:text-slate-50">
                  {comboDashboardStats.total}
                </p>
              </button>
            ) : null}
            {COMBO_DASHBOARD_TILES.filter((tile) =>
              comboDashboardTileKeySet.has(tile.key),
            ).map((tile) => {
              const v = comboDashboardStats[tile.key];
              if (!v || v <= 0) return null;
              const label = tl(tile.tlKey, COMBO_STAT_LABEL_DEFAULTS[tile.key]);
              const baseBtn =
                "min-w-[calc(50%-0.16rem)] flex-1 basis-[108px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-1.5 py-1.5 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[100px] sm:max-w-[156px] dark:border-slate-700/90 dark:bg-slate-900/95";
              return (
                <button
                  key={tile.key}
                  type="button"
                  onClick={() => setComboStatDetailKey(tile.key)}
                  className={`${baseBtn} hover:ring-2 hover:ring-sky-500/35`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    {label}
                  </p>
                  <p
                    className={`text-base font-bold ${getAttendanceLeaveTypeColorClassNameForComboStatKey(tile.key)}`}
                  >
                    {v}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-200/35 p-3 dark:bg-black/35 sm:p-5">
          {comboChartData.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-600 dark:text-slate-400">
              {tl("noData", "Không có dữ liệu")}
            </div>
          ) : !comboChartBodyReady ||
            (comboChartRowsVisible.length === 0 &&
              comboChartData.length > 0) ? (
            <div
              className="flex min-h-0 flex-1 flex-col"
              aria-busy="true"
              aria-live="polite"
            >
              <p className="mb-3 text-center text-xs text-slate-500 dark:text-slate-400">
                {tl("comboChartLoading", "Đang tải biểu đồ theo bộ phận…")}
              </p>
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={`combo-skel-${i}`}
                    className="animate-pulse rounded-xl border border-slate-300/60 bg-slate-100/90 p-2 dark:border-slate-700/80 dark:bg-slate-900/80"
                  >
                    <div className="mb-2 h-3 w-2/3 rounded bg-slate-300 dark:bg-slate-600" />
                    <div className="mb-3 flex gap-1">
                      <div className="h-6 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-6 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-6 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
                    </div>
                    <div className="h-[180px] rounded-lg bg-slate-200/80 dark:bg-slate-800/80 sm:h-[190px]" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1 transition-opacity duration-200">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {comboChartRowsVisible.map((row) => (
                  <div
                    key={row.department}
                    className={`rounded-xl border border-slate-300/85 bg-slate-80 p-1 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition dark:border-slate-700/90 dark:bg-slate-900/90 ${
                      comboDragOverDept === row.department
                        ? "ring-2 ring-sky-400 ring-offset-1 dark:ring-offset-slate-900"
                        : ""
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setComboDragOverDept(row.department);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        setComboDragOverDept((d) =>
                          d === row.department ? null : d,
                        );
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = e.dataTransfer.getData(CHART_DRAG_MIME);
                      setComboDragOverDept(null);
                      if (from) handleComboDeptReorder(from, row.department);
                    }}
                  >
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(CHART_DRAG_MIME, row.department);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setComboDragOverDept(null)}
                      className="mb-1 flex cursor-grab items-center justify-between gap-2 border-b border-slate-200/90 pb-1.5 active:cursor-grabbing dark:border-slate-700/80"
                    >
                      <span
                        className="shrink-0 select-none text-slate-400"
                        aria-hidden
                        title={tl("comboChartDragHandle", "Kéo để sắp xếp")}
                      >
                        ⋮⋮
                      </span>
                      <h4 className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-50">
                        {row.department}
                      </h4>
                      <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-black dark:bg-slate-800 dark:text-slate-300">
                        {tl("totalEmployees", "Tổng")}: {row.total}
                      </span>
                    </div>
                    <div className="mb-1.5 flex flex-wrap gap-1 text-[10px]">
                      {activeComboMetricKeys.map((k) => {
                        const n = row[k];
                        if (!n || n <= 0) return null;
                        const lab =
                          k === "nonStandardTimeIn"
                            ? tl("nonStandardTimeInShort", "≠ HH:MM")
                            : k === "resignedLeave"
                              ? tl("resigned", COMBO_STAT_LABEL_DEFAULTS[k])
                              : tl(k, COMBO_STAT_LABEL_DEFAULTS[k]);
                        return (
                          <span
                            key={k}
                            className={`rounded border px-1.5 py-1 font-semibold uppercase ${getAttendanceLeaveTypeBadgeClassNameForComboStatKey(k)}`}
                          >
                            {lab}: {n}
                          </span>
                        );
                      })}
                    </div>
                    <div className="mx-auto h-[180px] w-full sm:h-[190px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={[row]}
                          margin={{
                            top: 8,
                            right: 10,
                            left: 6,
                            bottom: 18,
                          }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#64748b"
                            strokeOpacity={0.35}
                          />
                          <XAxis dataKey="department" hide />
                          <YAxis
                            yAxisId="left"
                            allowDecimals={false}
                            width={22}
                            tick={{ fill: "#94a3b8", fontSize: 10 }}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            allowDecimals={false}
                            width={22}
                            tick={{ fill: "#94a3b8", fontSize: 10 }}
                          />
                          <Tooltip
                            formatter={(value, name) => {
                              if (name === "total")
                                return [
                                  value,
                                  tl("totalEmployees", "Tổng số nhân viên"),
                                ];
                              if (
                                Object.prototype.hasOwnProperty.call(
                                  COMBO_STAT_LABEL_DEFAULTS,
                                  name,
                                )
                              ) {
                                const label =
                                  name === "resignedLeave"
                                    ? tl(
                                        "resigned",
                                        COMBO_STAT_LABEL_DEFAULTS[name],
                                      )
                                    : tl(name, COMBO_STAT_LABEL_DEFAULTS[name]);
                                return [value, label];
                              }
                              return [value, name];
                            }}
                          />
                          {activeComboMetricKeys.map((dataKey) =>
                            row[dataKey] > 0 ? (
                              <Bar
                                key={dataKey}
                                yAxisId="left"
                                dataKey={dataKey}
                                barSize={45}
                                fill={getAttendanceComboBarFillForMetricKey(
                                  dataKey,
                                )}
                                radius={[4, 4, 0, 0]}
                              />
                            ) : null,
                          )}
                          {row.total > 0 ? (
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="total"
                              stroke="#7c3aed"
                              strokeWidth={2.25}
                              dot={{ r: 3 }}
                            />
                          ) : null}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
              {comboChartCardsVisibleCount < comboChartDataOrdered.length ? (
                <div className="flex justify-center py-3 text-xs text-slate-500 dark:text-slate-400">
                  {tl("comboChartLoadingMore", "Đang tải thêm biểu đồ…")}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {comboStatDetailKey && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="combo-stat-detail-title"
            className="absolute inset-0 z-[1300] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
            onClick={() => setComboStatDetailKey(null)}
          >
            <div
              className="flex max-h-[min(90vh,940px)] w-full max-w-[min(96vw,80rem)] flex-col overflow-hidden rounded-xl border-2 border-sky-400/60 bg-white shadow-[0_20px_40px_-12px_rgba(14,165,233,0.22)] ring-2 ring-sky-200/50 dark:border-sky-500/40 dark:bg-slate-900 dark:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.55)] dark:ring-sky-900/50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 bg-gradient-to-r from-sky-600 via-sky-500 to-teal-500 px-3 py-2.5 shadow-md sm:px-4 sm:py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase leading-none tracking-[0.12em] text-sky-100/95 text-black">
                    {tl("comboStatDetailBadge", "Chi tiết danh sách")}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h4
                      id="combo-stat-detail-title"
                      className="text-base font-extrabold leading-tight text-white drop-shadow-sm sm:text-[1.05rem]"
                    >
                      {detailMetricLabel}
                    </h4>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/35">
                      {tl("peopleCount", "{{count}} người", {
                        count: detailEmployees.length ?? 0,
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportDetailImage}
                    className="inline-flex h-7 items-center justify-center rounded-md bg-white/15 px-2 text-[11px] font-bold text-white ring-1 ring-white/40 transition hover:bg-white/25 sm:h-8 sm:px-2.5"
                    title={tl("exportImage", "Xuất hình")}
                  >
                    🖼️ {tl("exportImage", "Xuất hình")}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportDetailExcel}
                    className="inline-flex h-7 items-center justify-center rounded-md bg-white/15 px-2 text-[11px] font-bold text-white ring-1 ring-white/40 transition hover:bg-white/25 sm:h-8 sm:px-2.5"
                    title={tl("exportExcel", "Xuất Excel")}
                  >
                    📊 {tl("exportExcel", "Xuất Excel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setComboStatDetailKey(null)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-base leading-none text-white ring-1 ring-white/40 transition hover:bg-white/25 sm:h-9 sm:w-9 sm:text-lg"
                    aria-label={t("attendanceList.close")}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-sky-50/90 to-emerald-50/40 px-2 py-3 sm:px-4 dark:from-slate-950 dark:to-slate-900">
                <div
                  ref={detailTableCaptureRef}
                  className="overflow-hidden rounded-xl border-2 border-sky-200/80 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900"
                >
                  <div className="max-h-[min(68vh,760px)] overflow-y-auto overflow-x-hidden">
                    <table className="w-full table-fixed border-collapse text-left text-[14px] leading-snug sm:text-[15px]">
                      <thead className="sticky top-0 z-10 shadow-md">
                        <tr className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white">
                          <th className="w-12 whitespace-nowrap px-2 py-3 text-center text-xs font-extrabold uppercase tracking-wider text-white">
                            {tl("colIndex", "STT")}
                          </th>
                          <th className="w-20 whitespace-nowrap px-2 py-3 text-xs font-extrabold uppercase tracking-wider text-white">
                            {tl("colCode", "MNV")}
                          </th>
                          <th className="w-[24%] px-2 py-3 text-xs font-extrabold uppercase tracking-wider text-white">
                            {tl("colName", "Họ và tên")}
                          </th>
                          <th className="w-[20%] px-2 py-3 text-xs font-extrabold uppercase tracking-wider text-white">
                            {tl("colDepartment", "Bộ phận")}
                          </th>
                          <th className="w-24 whitespace-nowrap px-2 py-3 text-center text-xs font-extrabold uppercase tracking-wider text-amber-100">
                            {tl("colTimeIn", "Giờ vào")}
                          </th>
                          <th className="w-24 px-2 py-3 text-xs font-extrabold uppercase tracking-wider text-rose-100">
                            {tl("leaveTypeColumn", "Loại phép")}
                          </th>
                          <th className="w-24 px-2 py-3 text-xs font-extrabold uppercase tracking-wider text-emerald-100">
                            {tl("comboStatColShift", "Ca làm việc")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sky-100 dark:divide-slate-700">
                        {detailEmployees.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="bg-amber-50/80 px-4 py-14 text-center text-base font-medium text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                            >
                              {tl("noData", "Không có dữ liệu")}
                            </td>
                          </tr>
                        ) : (
                          detailEmployees.map((emp, idx) => (
                            <tr
                              key={emp.id ?? `${emp.mnv}-${idx}`}
                              className="odd:bg-white even:bg-sky-50/90 transition-colors hover:bg-amber-50/80 dark:odd:bg-slate-900 dark:even:bg-slate-800/90 dark:hover:bg-slate-700/80"
                            >
                              <td className="bg-sky-100/50 px-2 py-3 text-center text-base font-bold tabular-nums text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-3">
                                <span className="inline-block rounded-md bg-indigo-100 px-2 py-0.5 font-mono text-sm font-bold tabular-nums text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-200">
                                  {emp.mnv ?? ""}
                                </span>
                              </td>
                              <td className="break-words px-2 py-2.5 text-sm font-bold text-slate-900 dark:text-white sm:px-3 sm:py-3 sm:text-base">
                                {emp.hoVaTen ?? ""}
                              </td>
                              <td className="break-words px-2 py-2.5 text-sm font-medium text-violet-900 dark:text-violet-200 sm:px-3 sm:py-3 sm:text-base">
                                {emp.boPhan ?? ""}
                              </td>
                              <td className="whitespace-nowrap bg-emerald-50/70 px-3 py-3 text-center font-mono text-base font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                {emp.gioVao ?? ""}
                              </td>
                              <td className="whitespace-nowrap bg-rose-50/70 px-3 py-3 text-center text-base font-semibold text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
                                {formatAttendanceLeaveTypeColumnForEmployee(
                                  emp,
                                ) || "—"}
                              </td>
                              <td className="bg-amber-50/60 px-3 py-3 text-base font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                                {emp.caLamViec ?? ""}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
