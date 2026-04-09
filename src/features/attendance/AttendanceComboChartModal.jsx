import React from "react";
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

export default function AttendanceComboChartModal({
  open,
  onClose,
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
  if (!open) return null;
  return (
  <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4">
    <div className="relative flex h-[94vh] w-[min(98vw,1680px)] max-w-none flex-col overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-100 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-300/80 bg-gradient-to-b from-slate-200/95 to-slate-100 px-4 pb-3 pt-4 dark:border-slate-800 dark:from-slate-950 dark:to-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-400">
              {tl("comboChartBadge", "Attendance Dashboard")}
            </p>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 sm:text-xl">
              {tl(
                "comboChartTitle",
                "Thống kê toàn bộ nhân viên theo bộ phận",
              )}
            </h3>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {tl(
                "comboChartHint",
                "Cột: Điểm danh / Giờ vào ≠ HH:MM / Vào trễ / Phép năm / Ca đêm / Tai nạn / Thai sản / Không phép / Không lương / Phép ốm / Nghỉ việc • Đường: Tổng nhân viên",
              )}
            </p>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              {tl(
                "comboChartDragHint",
                "Kéo thanh tiêu đề (⋮⋮) để đổi thứ tự biểu đồ — lưu theo tài khoản trên Firebase (đồng bộ mọi máy).",
              )}
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

        <div className="mt-3 flex flex-wrap gap-2">
          {comboDashboardStats.total > 0 ? (
            <button
              type="button"
              onClick={() => setComboStatDetailKey("total")}
              className="min-w-[calc(50%-0.25rem)] flex-1 basis-[140px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[120px] sm:max-w-[200px] dark:border-slate-700/90 dark:bg-slate-900/95"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {tl("totalEmployees", "Tổng số nhân viên")}
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-slate-50">
                {comboDashboardStats.total}
              </p>
            </button>
          ) : null}
          {comboDashboardStats.checkedIn > 0 ? (
            <button
              type="button"
              onClick={() => setComboStatDetailKey("checkedIn")}
              className="min-w-[calc(50%-0.25rem)] flex-1 basis-[140px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[120px] sm:max-w-[200px] dark:border-slate-700/90 dark:bg-slate-900/95"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {tl("checkedIn", "Đã chấm công")}
              </p>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {comboDashboardStats.checkedIn}
              </p>
            </button>
          ) : null}
          {comboDashboardStats.nonStandardTimeIn > 0 ? (
            <button
              type="button"
              onClick={() => setComboStatDetailKey("nonStandardTimeIn")}
              className="min-w-[calc(50%-0.25rem)] flex-1 basis-[140px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[120px] sm:max-w-[200px] dark:border-slate-700/90 dark:bg-slate-900/95"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {tl("nonStandardTimeIn", "Giờ vào ≠ HH:MM")}
              </p>
              <p className="text-base font-bold text-cyan-600 dark:text-cyan-400">
                {comboDashboardStats.nonStandardTimeIn}
              </p>
            </button>
          ) : null}
          {comboDashboardStats.late > 0 ? (
            <button
              type="button"
              onClick={() => setComboStatDetailKey("late")}
              className="min-w-[calc(50%-0.25rem)] flex-1 basis-[140px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[120px] sm:max-w-[200px] dark:border-slate-700/90 dark:bg-slate-900/95"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {tl("late", "Vào trễ")}
              </p>
              <p className="text-base font-bold text-lime-700 dark:text-lime-400">
                {comboDashboardStats.late}
              </p>
            </button>
          ) : null}
          {comboDashboardStats.annualLeave > 0 ? (
            <button
              type="button"
              onClick={() => setComboStatDetailKey("annualLeave")}
              className="min-w-[calc(50%-0.25rem)] flex-1 basis-[140px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[120px] sm:max-w-[200px] dark:border-slate-700/90 dark:bg-slate-900/95"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {tl("annualLeave", "Phép năm")}
              </p>
              <p className="text-base font-bold text-amber-600 dark:text-amber-400">
                {comboDashboardStats.annualLeave}
              </p>
            </button>
          ) : null}
          {comboDashboardStats.nightShift > 0 ? (
            <button
              type="button"
              onClick={() => setComboStatDetailKey("nightShift")}
              className="min-w-[calc(50%-0.25rem)] flex-1 basis-[140px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[120px] sm:max-w-[200px] dark:border-slate-700/90 dark:bg-slate-900/95"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {tl("nightShift", "Ca đêm")}
              </p>
              <p className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                {comboDashboardStats.nightShift}
              </p>
            </button>
          ) : null}
          {comboDashboardStats.laborAccident > 0 ? (
            <button
              type="button"
              onClick={() => setComboStatDetailKey("laborAccident")}
              className="min-w-[calc(50%-0.25rem)] flex-1 basis-[140px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[120px] sm:max-w-[200px] dark:border-slate-700/90 dark:bg-slate-900/95"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {tl("laborAccident", "Tai nạn")}
              </p>
              <p className="text-base font-bold text-rose-600 dark:text-rose-400">
                {comboDashboardStats.laborAccident}
              </p>
            </button>
          ) : null}
          {comboDashboardStats.maternity > 0 ? (
            <button
              type="button"
              onClick={() => setComboStatDetailKey("maternity")}
              className="min-w-[calc(50%-0.25rem)] flex-1 basis-[140px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[120px] sm:max-w-[200px] dark:border-slate-700/90 dark:bg-slate-900/95"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {tl("maternity", "Thai sản")}
              </p>
              <p className="text-base font-bold text-fuchsia-600 dark:text-fuchsia-400">
                {comboDashboardStats.maternity}
              </p>
            </button>
          ) : null}
          {comboDashboardStats.noPermit > 0 ? (
            <button
              type="button"
              onClick={() => setComboStatDetailKey("noPermit")}
              className="min-w-[calc(50%-0.25rem)] flex-1 basis-[140px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[120px] sm:max-w-[200px] dark:border-slate-700/90 dark:bg-slate-900/95"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {tl("noPermit", "Không phép")}
              </p>
              <p className="text-base font-bold text-red-600 dark:text-red-400">
                {comboDashboardStats.noPermit}
              </p>
            </button>
          ) : null}
          {comboDashboardStats.unpaidLeave > 0 ? (
            <button
              type="button"
              onClick={() => setComboStatDetailKey("unpaidLeave")}
              className="min-w-[calc(50%-0.25rem)] flex-1 basis-[140px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[120px] sm:max-w-[200px] dark:border-slate-700/90 dark:bg-slate-900/95"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {tl("unpaidLeave", "Không lương")}
              </p>
              <p className="text-base font-bold text-orange-600 dark:text-orange-400">
                {comboDashboardStats.unpaidLeave}
              </p>
            </button>
          ) : null}
          {comboDashboardStats.sickLeave > 0 ? (
            <button
              type="button"
              onClick={() => setComboStatDetailKey("sickLeave")}
              className="min-w-[calc(50%-0.25rem)] flex-1 basis-[140px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[120px] sm:max-w-[200px] dark:border-slate-700/90 dark:bg-slate-900/95"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {tl("sickLeave", "Phép ốm")}
              </p>
              <p className="text-base font-bold text-teal-600 dark:text-teal-400">
                {comboDashboardStats.sickLeave}
              </p>
            </button>
          ) : null}
          {comboDashboardStats.resignedLeave > 0 ? (
            <button
              type="button"
              onClick={() => setComboStatDetailKey("resignedLeave")}
              className="min-w-[calc(50%-0.25rem)] flex-1 basis-[140px] rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-left shadow-sm transition hover:ring-2 hover:ring-sky-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 sm:min-w-[120px] sm:max-w-[200px] dark:border-slate-700/90 dark:bg-slate-900/95"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {tl("resigned", "Nghỉ việc")}
              </p>
              <p className="text-base font-bold text-slate-700 dark:text-slate-300">
                {comboDashboardStats.resignedLeave}
              </p>
            </button>
          ) : null}
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
              {tl(
                "comboChartLoading",
                "Đang tải biểu đồ theo bộ phận…",
              )}
            </p>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`combo-skel-${i}`}
                  className="animate-pulse rounded-xl border border-slate-300/60 bg-slate-100/90 p-3 dark:border-slate-700/80 dark:bg-slate-900/80"
                >
                  <div className="mb-2 h-3 w-2/3 rounded bg-slate-300 dark:bg-slate-600" />
                  <div className="mb-3 flex gap-1">
                    <div className="h-6 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-6 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-6 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                  <div className="h-[210px] rounded-lg bg-slate-200/80 dark:bg-slate-800/80 sm:h-[220px]" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 transition-opacity duration-200">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {comboChartRowsVisible.map((row) => (
                <div
                  key={row.department}
                  className={`rounded-xl border border-slate-300/85 bg-slate-80 p-2 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition dark:border-slate-700/90 dark:bg-slate-900/90 ${
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
                    const from = e.dataTransfer.getData(
                      CHART_DRAG_MIME,
                    );
                    setComboDragOverDept(null);
                    if (from)
                      handleComboDeptReorder(from, row.department);
                  }}
                >
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        CHART_DRAG_MIME,
                        row.department,
                      );
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setComboDragOverDept(null)}
                    className="mb-1 flex cursor-grab items-center justify-between gap-2 border-b border-slate-200/90 pb-1.5 active:cursor-grabbing dark:border-slate-700/80"
                  >
                    <span
                      className="shrink-0 select-none text-slate-400"
                      aria-hidden
                      title={tl(
                        "comboChartDragHandle",
                        "Kéo để sắp xếp",
                      )}
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
                    {row.checkedIn > 0 ? (
                      <span className="rounded bg-emerald-50 px-1.5 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold uppercase">
                        {tl("checkedIn", "Điểm danh")}: {row.checkedIn}
                      </span>
                    ) : null}
                    {row.nonStandardTimeIn > 0 ? (
                      <span className="rounded bg-cyan-50 px-1.5 py-1 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300 font-semibold uppercase">
                        {tl("nonStandardTimeInShort", "≠ HH:MM")}:{" "}
                        {row.nonStandardTimeIn}
                      </span>
                    ) : null}
                    {row.late > 0 ? (
                      <span className="rounded bg-lime-50 px-1.5 py-1 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300 font-semibold uppercase">
                        {tl("late", "Vào trễ")}: {row.late}
                      </span>
                    ) : null}
                    {row.annualLeave > 0 ? (
                      <span className="rounded bg-amber-50 px-1.5 py-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-semibold uppercase">
                        {tl("annualLeave", "Phép năm")}:{" "}
                        {row.annualLeave}
                      </span>
                    ) : null}
                    {row.nightShift > 0 ? (
                      <span className="rounded bg-indigo-50 px-1.5 py-1 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-semibold uppercase">
                        {tl("nightShift", "Ca đêm")}: {row.nightShift}
                      </span>
                    ) : null}
                    {row.laborAccident > 0 ? (
                      <span className="rounded bg-rose-50 px-1.5 py-1 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-semibold uppercase">
                        {tl("laborAccident", "Tai nạn")}:{" "}
                        {row.laborAccident}
                      </span>
                    ) : null}
                    {row.maternity > 0 ? (
                      <span className="rounded bg-fuchsia-50 px-1.5 py-1 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 font-semibold uppercase">
                        {tl("maternity", "Thai sản")}: {row.maternity}
                      </span>
                    ) : null}
                    {row.noPermit > 0 ? (
                      <span className="rounded bg-red-50 px-1.5 py-1 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-semibold uppercase">
                        {tl("noPermit", "Không phép")}: {row.noPermit}
                      </span>
                    ) : null}
                    {row.unpaidLeave > 0 ? (
                      <span className="rounded bg-orange-50 px-1.5 py-1 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 font-semibold uppercase">
                        {tl("unpaidLeave", "Không lương")}:{" "}
                        {row.unpaidLeave}
                      </span>
                    ) : null}
                    {row.sickLeave > 0 ? (
                      <span className="rounded bg-teal-50 px-1.5 py-1 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 font-semibold uppercase">
                        {tl("sickLeave", "Phép ốm")}: {row.sickLeave}
                      </span>
                    ) : null}
                    {row.resignedLeave > 0 ? (
                      <span className="rounded bg-slate-100 px-1.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold uppercase">
                        {tl("resigned", "Nghỉ việc")}:{" "}
                        {row.resignedLeave}
                      </span>
                    ) : null}
                  </div>
                  <div className="h-[210px] w-full sm:h-[220px]">
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
                                tl(
                                  "totalEmployees",
                                  "Tổng số nhân viên",
                                ),
                              ];
                            if (name === "checkedIn")
                              return [
                                value,
                                tl("checkedIn", "Đã điểm danh"),
                              ];
                            if (name === "nonStandardTimeIn")
                              return [
                                value,
                                tl(
                                  "nonStandardTimeIn",
                                  "Giờ vào ≠ HH:MM",
                                ),
                              ];
                            if (name === "late")
                              return [value, tl("late", "Vào trễ")];
                            if (name === "annualLeave")
                              return [
                                value,
                                tl("annualLeave", "Phép năm"),
                              ];
                            if (name === "nightShift")
                              return [
                                value,
                                tl("nightShift", "Ca đêm"),
                              ];
                            if (name === "laborAccident")
                              return [
                                value,
                                tl("laborAccident", "Tai nạn"),
                              ];
                            if (name === "maternity")
                              return [
                                value,
                                tl("maternity", "Thai sản"),
                              ];
                            if (name === "noPermit")
                              return [
                                value,
                                tl("noPermit", "Không phép"),
                              ];
                            if (name === "unpaidLeave")
                              return [
                                value,
                                tl("unpaidLeave", "Không lương"),
                              ];
                            if (name === "sickLeave")
                              return [
                                value,
                                tl("sickLeave", "Phép ốm"),
                              ];
                            if (name === "resignedLeave")
                              return [
                                value,
                                tl("resigned", "Nghỉ việc"),
                              ];
                            return [value, name];
                          }}
                        />
                        {row.checkedIn > 0 ? (
                          <Bar
                            yAxisId="left"
                            dataKey="checkedIn"
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                          />
                        ) : null}
                        {row.nonStandardTimeIn > 0 ? (
                          <Bar
                            yAxisId="left"
                            dataKey="nonStandardTimeIn"
                            fill="#06b6d4"
                            radius={[4, 4, 0, 0]}
                          />
                        ) : null}
                        {row.late > 0 ? (
                          <Bar
                            yAxisId="left"
                            dataKey="late"
                            fill="#65a30d"
                            radius={[4, 4, 0, 0]}
                          />
                        ) : null}
                        {row.annualLeave > 0 ? (
                          <Bar
                            yAxisId="left"
                            dataKey="annualLeave"
                            fill="#f59e0b"
                            radius={[4, 4, 0, 0]}
                          />
                        ) : null}
                        {row.nightShift > 0 ? (
                          <Bar
                            yAxisId="left"
                            dataKey="nightShift"
                            fill="#6366f1"
                            radius={[4, 4, 0, 0]}
                          />
                        ) : null}
                        {row.laborAccident > 0 ? (
                          <Bar
                            yAxisId="left"
                            dataKey="laborAccident"
                            fill="#f43f5e"
                            radius={[4, 4, 0, 0]}
                          />
                        ) : null}
                        {row.maternity > 0 ? (
                          <Bar
                            yAxisId="left"
                            dataKey="maternity"
                            fill="#d946ef"
                            radius={[4, 4, 0, 0]}
                          />
                        ) : null}
                        {row.noPermit > 0 ? (
                          <Bar
                            yAxisId="left"
                            dataKey="noPermit"
                            fill="#dc2626"
                            radius={[4, 4, 0, 0]}
                          />
                        ) : null}
                        {row.unpaidLeave > 0 ? (
                          <Bar
                            yAxisId="left"
                            dataKey="unpaidLeave"
                            fill="#ea580c"
                            radius={[4, 4, 0, 0]}
                          />
                        ) : null}
                        {row.sickLeave > 0 ? (
                          <Bar
                            yAxisId="left"
                            dataKey="sickLeave"
                            fill="#0d9488"
                            radius={[4, 4, 0, 0]}
                          />
                        ) : null}
                        {row.resignedLeave > 0 ? (
                          <Bar
                            yAxisId="left"
                            dataKey="resignedLeave"
                            fill="#475569"
                            radius={[4, 4, 0, 0]}
                          />
                        ) : null}
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
            {comboChartCardsVisibleCount <
            comboChartDataOrdered.length ? (
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
            className="flex max-h-[min(82vh,820px)] w-full max-w-[min(100%,42rem)] flex-col overflow-hidden rounded-xl border-2 border-sky-400/60 bg-white shadow-[0_20px_40px_-12px_rgba(14,165,233,0.22)] ring-2 ring-sky-200/50 dark:border-sky-500/40 dark:bg-slate-900 dark:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.55)] dark:ring-sky-900/50 sm:max-w-3xl"
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
                    {comboStatLabelByKey[comboStatDetailKey] ?? ""}
                  </h4>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/35">
                    {tl("peopleCount", "{{count}} người", {
                      count:
                        comboStatEmployeesByKey[comboStatDetailKey]
                          ?.length ?? 0,
                    })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setComboStatDetailKey(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-base leading-none text-white ring-1 ring-white/40 transition hover:bg-white/25 sm:h-9 sm:w-9 sm:text-lg"
                aria-label={t("attendanceList.close")}
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-sky-50/90 to-emerald-50/40 px-2 py-3 sm:px-4 dark:from-slate-950 dark:to-slate-900">
              <div className="overflow-hidden rounded-xl border-2 border-sky-200/80 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900">
                <div className="max-h-[min(52vh,480px)] overflow-auto sm:max-h-[min(56vh,520px)]">
                  <table className="w-full min-w-[560px] border-collapse text-left text-[15px] leading-snug">
                    <thead className="sticky top-0 z-10 shadow-md">
                      <tr className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white">
                        <th className="w-14 whitespace-nowrap px-2 py-3.5 text-center text-xs font-extrabold uppercase tracking-wider text-white">
                          {tl("colIndex", "STT")}
                        </th>
                        <th className="whitespace-nowrap px-3 py-3.5 text-xs font-extrabold uppercase tracking-wider text-white">
                          {tl("colCode", "MNV")}
                        </th>
                        <th className="min-w-[150px] px-3 py-3.5 text-xs font-extrabold uppercase tracking-wider text-white">
                          {tl("colName", "Họ và tên")}
                        </th>
                        <th className="min-w-[120px] px-3 py-3.5 text-xs font-extrabold uppercase tracking-wider text-white">
                          {tl("colDepartment", "Bộ phận")}
                        </th>
                        <th className="whitespace-nowrap px-3 py-3.5 text-center text-xs font-extrabold uppercase tracking-wider text-amber-100">
                          {tl("colTimeIn", "Giờ vào")}
                        </th>
                        <th className="min-w-[100px] px-3 py-3.5 text-xs font-extrabold uppercase tracking-wider text-emerald-100">
                          {tl("comboStatColShift", "Ca làm việc")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100 dark:divide-slate-700">
                      {(
                        comboStatEmployeesByKey[comboStatDetailKey] ??
                        []
                      ).length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="bg-amber-50/80 px-4 py-14 text-center text-base font-medium text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                          >
                            {tl("noData", "Không có dữ liệu")}
                          </td>
                        </tr>
                      ) : (
                        (
                          comboStatEmployeesByKey[comboStatDetailKey] ??
                          []
                        ).map((emp, idx) => (
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
                            <td className="max-w-[220px] truncate px-3 py-3 text-base font-bold text-slate-900 dark:text-white sm:max-w-none">
                              {emp.hoVaTen ?? ""}
                            </td>
                            <td className="max-w-[180px] truncate px-3 py-3 text-base font-medium text-violet-900 dark:text-violet-200 sm:max-w-none">
                              {emp.boPhan ?? ""}
                            </td>
                            <td className="whitespace-nowrap bg-emerald-50/70 px-3 py-3 text-center font-mono text-base font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                              {emp.gioVao ?? ""}
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
