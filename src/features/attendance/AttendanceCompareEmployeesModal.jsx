import React, { memo } from "react";
import { createPortal } from "react-dom";

function AttendanceCompareEmployeesModal({
  isOpen,
  onClose,
  compareBusy,
  result,
  criteria,
  onChangeCriteria,
  onCompare,
  tl,
}) {
  if (!isOpen) return null;

  const rows = result?.rows || [];
  const totals = rows.reduce(
    (acc, row) => {
      acc.previous += Number(row.previousCount || 0);
      acc.current += Number(row.currentCount || 0);
      acc.same += Number(row.sameCount || 0);
      acc.previousOnly += row.previousOnly?.length || 0;
      acc.currentOnly += row.currentOnly?.length || 0;
      return acc;
    },
    { previous: 0, current: 0, same: 0, previousOnly: 0, currentOnly: 0 },
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[1210] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-compare-employees-title"
    >
      <div className="relative flex h-[min(90vh,860px)] w-full max-w-7xl min-h-0 flex-col overflow-hidden rounded-2xl border border-white/45 bg-white/95 shadow-[0_35px_90px_rgba(2,8,23,0.42)] ring-1 ring-slate-900/5 backdrop-blur dark:border-slate-700/90 dark:bg-slate-900/95 dark:ring-slate-100/10">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-20 -top-24 h-52 w-52 rounded-full bg-cyan-300/25 blur-3xl dark:bg-cyan-500/20" />
          <div className="absolute -right-20 -top-16 h-56 w-56 rounded-full bg-fuchsia-300/25 blur-3xl dark:bg-fuchsia-500/20" />
          <div className="absolute bottom-0 left-1/3 h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/20" />
        </div>

        <div className="relative shrink-0 border-b border-white/40 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-700 px-5 py-4 text-white dark:border-slate-700/80">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3
                id="attendance-compare-employees-title"
                className="text-base font-black tracking-tight md:text-xl"
              >
                {tl("compareEmployeesTitle", "So sánh nhân viên theo bộ phận")}
              </h3>
              <p className="mt-1 text-xs font-medium text-blue-50/95 md:text-sm">
                {tl(
                  "compareEmployeesDateRange",
                  "Ngày trước: {{previous}} • Ngày hiện tại: {{current}}",
                  {
                    previous: result?.previousDate || "—",
                    current: result?.currentDate || "—",
                  },
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-semibold transition hover:bg-white/20 active:scale-[0.98]"
              >
                {tl("close", "Đóng")}
              </button>
            </div>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden p-3 md:p-4">
          <div className="flex h-full min-h-0 flex-col gap-3 md:flex-row">
            <aside className="w-full shrink-0 rounded-2xl border border-slate-200/80 bg-white/85 p-3 shadow-sm ring-1 ring-slate-100/90 md:w-80 dark:border-slate-700/80 dark:bg-slate-800/65 dark:ring-slate-700/40">
              <div className="mb-3 rounded-xl bg-slate-100/85 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-700/70 dark:text-slate-200">
                {tl("compareEmployeesSidebar", "Bộ lọc so sánh")}
              </div>
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {tl("compareEmployeesPickPreviousDate", "Ngày trước")}
                  <input
                    type="date"
                    value={criteria?.previousDate || ""}
                    onChange={(e) =>
                      onChangeCriteria?.((prev) => ({
                        ...prev,
                        previousDate: e.target.value,
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-400/35 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {tl("compareEmployeesPickDate", "Chọn ngày")}
                  <input
                    type="date"
                    value={criteria?.compareDate || ""}
                    onChange={(e) =>
                      onChangeCriteria?.((prev) => ({
                        ...prev,
                        compareDate: e.target.value,
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-400/35 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {tl("department", "Bộ phận")}
                  <select
                    value={criteria?.department || ""}
                    onChange={(e) =>
                      onChangeCriteria?.((prev) => ({
                        ...prev,
                        department: e.target.value,
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-400/35 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">
                      {tl("compareEmployeesAllDepartments", "Tất cả bộ phận")}
                    </option>
                    {(result?.departments || []).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={() => onCompare?.(criteria)}
                disabled={compareBusy}
                className="mt-4 h-11 w-full rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 px-3 text-sm font-bold text-white shadow-lg shadow-cyan-600/25 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {compareBusy
                  ? tl("compareEmployeesLoading", "Đang so sánh dữ liệu...")
                  : tl("compareEmployeesRun", "So sánh")}
              </button>
            </aside>

            <div className="min-h-0 flex-1 overflow-auto pr-0 md:pr-1">
              {!compareBusy && rows.length > 0 ? (
                <div className="mb-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                  <SummaryCard
                    tone="slate"
                    label={tl("compareEmployeesPrevTotal", "Tổng ngày trước")}
                    value={totals.previous}
                  />
                  <SummaryCard
                    tone="sky"
                    label={tl("compareEmployeesCurrentTotal", "Tổng hiện tại")}
                    value={totals.current}
                  />
                  <SummaryCard
                    tone="emerald"
                    label={tl("compareEmployeesSameTotal", "Tổng trùng")}
                    value={totals.same}
                  />
                  <SummaryCard
                    tone="rose"
                    label={tl(
                      "compareEmployeesOnlyPreviousTotal",
                      "Ngày trước",
                    )}
                    value={totals.previousOnly}
                  />
                  <SummaryCard
                    tone="blue"
                    label={tl(
                      "compareEmployeesOnlyCurrentTotal",
                      "Ngày hiện tại",
                    )}
                    value={totals.currentOnly}
                  />
                </div>
              ) : null}

              {compareBusy ? (
                <div className="rounded-2xl border border-slate-200/80 bg-white/70 py-12 text-center text-sm font-medium text-slate-600 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/40 dark:text-slate-300">
                  {tl("compareEmployeesLoading", "Đang so sánh dữ liệu...")}
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/85 py-12 text-center text-sm font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                  {tl("compareEmployeesNoData", "Không có dữ liệu để so sánh.")}
                </div>
              ) : (
                <div className="space-y-3.5">
                  {rows.map((row) => (
                    <div
                      key={row.department}
                      className="rounded-2xl border border-slate-200/90 bg-white/90 p-3.5 shadow-sm ring-1 ring-slate-100/60 transition hover:shadow-md dark:border-slate-700/80 dark:bg-slate-800/50 dark:ring-slate-700/40"
                    >
                      <div className="mb-2.5 flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-lg bg-gradient-to-r from-slate-700 to-slate-900 px-2.5 py-1 font-bold text-white dark:from-slate-500 dark:to-slate-700">
                          {row.department}
                        </span>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                          {tl("compareEmployeesPrevCount", "Trước: {{count}}", {
                            count: row.previousCount,
                          })}
                        </span>
                        <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800 ring-1 ring-cyan-200">
                          {tl(
                            "compareEmployeesCurrentCount",
                            "Hiện tại: {{count}}",
                            {
                              count: row.currentCount,
                            },
                          )}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                          {tl("compareEmployeesSameCount", "Trùng: {{count}}", {
                            count: row.sameCount,
                          })}
                        </span>
                      </div>

                      <div className="grid gap-3.5 md:grid-cols-2">
                        <div className="rounded-xl border border-rose-200/90 bg-gradient-to-b from-rose-50 to-white p-3.5 dark:border-rose-800/70 dark:from-rose-950/40 dark:to-slate-900">
                          <div className="mb-1.5 text-xs font-black uppercase tracking-wide text-rose-700 dark:text-rose-300">
                            {tl("compareEmployeesOnlyPrevious", "Ngày trước")}
                          </div>
                          {row.previousOnly.length === 0 ? (
                            <div className="rounded-lg bg-white/75 px-2.5 py-2 text-xs text-slate-500 ring-1 ring-rose-200/70 dark:bg-slate-900/70 dark:text-slate-400 dark:ring-rose-800/60">
                              —
                            </div>
                          ) : (
                            <div className="max-h-44 overflow-auto rounded-lg border border-rose-200/70 bg-white/70 p-2 pr-1.5 dark:border-rose-800/60 dark:bg-slate-900/40">
                              <div className="space-y-1.5">
                                {row.previousOnly.map((emp) => (
                                  <div
                                    key={emp}
                                    className="rounded-lg bg-white px-3 py-2 text-xs font-medium leading-relaxed text-slate-700 shadow-sm ring-1 ring-rose-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-rose-800/60"
                                  >
                                    {emp}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl border border-blue-200/90 bg-gradient-to-b from-blue-50 to-white p-3.5 dark:border-blue-800/70 dark:from-blue-950/35 dark:to-slate-900">
                          <div className="mb-1.5 text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                            {tl("compareEmployeesOnlyCurrent", "Ngày hiện tại")}
                          </div>
                          {row.currentOnly.length === 0 ? (
                            <div className="rounded-lg bg-white/75 px-2.5 py-2 text-xs text-slate-500 ring-1 ring-blue-200/70 dark:bg-slate-900/70 dark:text-slate-400 dark:ring-blue-800/60">
                              —
                            </div>
                          ) : (
                            <div className="max-h-44 overflow-auto rounded-lg border border-blue-200/70 bg-white/70 p-2 pr-1.5 dark:border-blue-800/60 dark:bg-slate-900/40">
                              <div className="space-y-1.5">
                                {row.currentOnly.map((emp) => (
                                  <div
                                    key={emp}
                                    className="rounded-lg bg-white px-3 py-2 text-xs font-medium leading-relaxed text-slate-700 shadow-sm ring-1 ring-blue-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-blue-800/60"
                                  >
                                    {emp}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SummaryCard({ tone, label, value }) {
  const toneCls = {
    slate:
      "border-slate-200 bg-gradient-to-b from-slate-50 to-white text-slate-700 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900 dark:text-slate-200",
    sky: "border-sky-200 bg-gradient-to-b from-sky-50 to-white text-sky-700 dark:border-sky-800 dark:from-sky-950/45 dark:to-slate-900 dark:text-sky-300",
    emerald:
      "border-emerald-200 bg-gradient-to-b from-emerald-50 to-white text-emerald-700 dark:border-emerald-800 dark:from-emerald-950/45 dark:to-slate-900 dark:text-emerald-300",
    rose: "border-rose-200 bg-gradient-to-b from-rose-50 to-white text-rose-700 dark:border-rose-800 dark:from-rose-950/45 dark:to-slate-900 dark:text-rose-300",
    blue: "border-blue-200 bg-gradient-to-b from-blue-50 to-white text-blue-700 dark:border-blue-800 dark:from-blue-950/45 dark:to-slate-900 dark:text-blue-300",
  };
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 shadow-sm ring-1 ring-white/60 ${toneCls[tone] || toneCls.slate}`}
    >
      <div className="text-[11px] font-bold uppercase tracking-wide opacity-85">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black leading-none tabular-nums">
        {value}
      </div>
    </div>
  );
}

export default memo(AttendanceCompareEmployeesModal);
