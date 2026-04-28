import React, { useEffect, useMemo, useState } from "react";

/**
 * Xác nhận có giấy tăng ca khung 06:00–08:00 (vào ≤ 06:00, ca ngày).
 * @param {{ open: boolean, rows: object[], initialChecked: (id: string) => boolean, onDismiss: (opts?: { suppressSession?: boolean }) => void, onSave: (updates: Record<string, boolean>, opts?: { suppressSession?: boolean }) => void | Promise<void>, title: string, description: string, saveLabel: string, skipAllLabel: string, closeLabel?: string, saving?: boolean, suppressSessionLabel?: string, timeLabel?: string, timeField?: string, searchPlaceholder?: string, departmentPlaceholder?: string }} props
 */
export default function PayrollEarlyOvertimePaperworkModal({
  open,
  rows,
  initialChecked,
  onDismiss,
  onSave,
  title,
  description,
  saveLabel,
  skipAllLabel,
  closeLabel = "Đóng",
  saving = false,
  suppressSessionLabel = "Không tự hiển thị lại hộp thoại này trong phiên đăng nhập hiện tại",
  timeLabel = "Vào",
  timeField = "gioVao",
  searchPlaceholder = "Lọc theo tên / MNV / bộ phận",
  departmentPlaceholder = "Tất cả bộ phận",
}) {
  const [checks, setChecks] = useState({});
  const [suppressSessionChecked, setSuppressSessionChecked] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  useEffect(() => {
    if (!open || !rows?.length) return;
    const next = {};
    for (const emp of rows) {
      next[emp.id] = initialChecked(emp.id);
    }
    setChecks(next);
    setSuppressSessionChecked(false);
    setSearchTerm("");
    setDepartmentFilter("");
  }, [open, rows, initialChecked]);

  const departmentOptions = useMemo(() => {
    const set = new Set();
    for (const emp of rows || []) {
      const dept = String(emp?.boPhan ?? "").trim();
      if (dept) set.add(dept);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = String(searchTerm ?? "").trim().toLowerCase();
    const deptNeedle = String(departmentFilter ?? "").trim().toLowerCase();
    return (rows || []).filter((emp) => {
      const dept = String(emp?.boPhan ?? "").trim();
      if (deptNeedle && dept.toLowerCase() !== deptNeedle) return false;
      if (!q) return true;
      return (
        String(emp?.hoVaTen ?? "").toLowerCase().includes(q) ||
        String(emp?.mnv ?? "").toLowerCase().includes(q) ||
        dept.toLowerCase().includes(q)
      );
    });
  }, [rows, searchTerm, departmentFilter]);

  /** Khóa cuộn nền: scroll nằm trên `#app-main-scroll`, không chỉ `body`. */
  useEffect(() => {
    if (!open) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const mainScroll = document.getElementById("app-main-scroll");
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevMainOverflow = mainScroll?.style.overflow ?? "";
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (mainScroll) mainScroll.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      if (mainScroll) mainScroll.style.overflow = prevMainOverflow;
    };
  }, [open]);

  if (!open) return null;

  const toggle = (id) => {
    setChecks((c) => ({ ...c, [id]: !c[id] }));
  };

  const handleSave = async () => {
    if (saving) return;
    const updates = {};
    for (const emp of rows) {
      updates[emp.id] = !!checks[emp.id];
    }
    await Promise.resolve(
      onSave(updates, { suppressSession: suppressSessionChecked }),
    );
  };

  const handleSkipAllNo = async () => {
    if (saving) return;
    const updates = {};
    for (const emp of rows) {
      updates[emp.id] = false;
    }
    await Promise.resolve(
      onSave(updates, { suppressSession: suppressSessionChecked }),
    );
  };

  const handleDismiss = () => {
    onDismiss({ suppressSession: suppressSessionChecked });
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden overscroll-none bg-slate-950/75 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payroll-early-ot-title"
      onClick={saving ? undefined : handleDismiss}
    >
      <div
        className="max-h-[min(96vh,700px)] w-full max-w-xl overflow-hidden rounded-2xl border border-sky-200/80 bg-white shadow-xl shadow-sky-200/25 ring-1 ring-sky-100/90 dark:border-slate-600/80 dark:bg-slate-900 dark:shadow-black/40 dark:ring-sky-900/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden border-b border-sky-200/80 bg-gradient-to-br from-sky-100/95 via-blue-50/90 to-indigo-50/70 px-4 py-3.5 dark:border-sky-800/40 dark:from-sky-950/90 dark:via-blue-950/75 dark:to-slate-900">
          <div
            className="pointer-events-none absolute -right-4 -top-6 h-32 w-32 rounded-full bg-sky-300/30 blur-2xl dark:bg-sky-500/15"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-2 bottom-0 h-16 w-24 rounded-full bg-blue-200/25 blur-xl dark:bg-blue-500/8"
            aria-hidden
          />
          <div className="relative flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-200/95 text-sm font-bold tracking-tight text-sky-950 shadow-sm ring-1 ring-sky-300/60 dark:bg-sky-800/75 dark:text-sky-50 dark:ring-sky-600/45"
              aria-hidden
            >
              TC
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2
                id="payroll-early-ot-title"
                className="text-base font-semibold leading-tight text-sky-950 dark:text-sky-50"
              >
                {title}
              </h2>
              <p className="mt-1.5 text-[11px] font-normal leading-snug text-sky-900/82 dark:text-sky-200/88">
                {description}
              </p>
            </div>
          </div>
        </div>
        <div className="border-b border-sky-200/70 bg-white/90 px-3 py-3 dark:border-sky-900/40 dark:bg-slate-900/95">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 min-w-0 flex-1 rounded-lg border border-sky-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200/70 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:ring-sky-900/50"
            />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-9 rounded-lg border border-sky-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200/70 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-500 dark:focus:ring-sky-900/50"
            >
              <option value="">{departmentPlaceholder}</option>
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="max-h-[min(62vh,480px)] overflow-y-auto bg-stone-50/40 px-3 py-3 dark:bg-slate-950/50">
          <ul className="space-y-2.5">
            {filteredRows.map((emp) => (
              <li
                key={emp.id}
                className="flex flex-wrap items-stretch gap-2 rounded-xl border border-stone-200/70 bg-white pl-1 shadow-sm shadow-stone-300/20 dark:border-slate-700/70 dark:bg-slate-800/50 dark:shadow-none"
              >
                <div
                  className="w-1 shrink-0 rounded-l-full bg-gradient-to-b from-sky-300/85 to-blue-200/70 dark:from-sky-600/60 dark:to-blue-900/50"
                  aria-hidden
                />
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 px-2 py-2.5 sm:items-center">
                  <input
                    type="checkbox"
                    disabled={saving}
                    checked={!!checks[emp.id]}
                    onChange={() => toggle(emp.id)}
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded border-sky-300 text-sky-600 focus:ring-2 focus:ring-sky-300/70 focus:ring-offset-1 disabled:opacity-50 dark:border-sky-600 dark:text-sky-500 dark:focus:ring-sky-800/60"
                  />
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="flex flex-wrap items-center gap-1.5 gap-y-1">
                      <span className="text-[14px] font-bold tracking-tight text-slate-900 sm:text-[14px] dark:text-white">
                        {emp.hoVaTen || "—"}
                      </span>
                      {String(emp.boPhan ?? "").trim() ? (
                        <span className="inline-flex max-w-full items-center rounded-md border border-violet-200/70 bg-violet-50/90 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-violet-800/90 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-200/90">
                          {String(emp.boPhan).trim()}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md border border-dashed border-stone-300/80 bg-stone-100/80 px-1.5 py-px text-[10px] font-medium text-stone-500 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-500">
                          BP —
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block tabular-nums text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="font-medium text-slate-600 dark:text-slate-400">
                        MNV
                      </span>{" "}
                      <span className="text-[12px] font-extrabold text-sky-900 tabular-nums sm:text-[14px] dark:text-sky-200">
                        {emp.mnv ?? "—"}
                      </span>
                      <span className="mx-1.5 text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="font-medium text-slate-600 dark:text-slate-400">
                        {timeLabel}
                      </span>{" "}
                      <span className="text-[12px] font-extrabold text-sky-900 tabular-nums sm:text-[14px] dark:text-sky-200">
                        {emp?.[timeField] ?? "—"}
                      </span>
                    </span>
                  </span>
                </label>
              </li>
            ))}
            {filteredRows.length === 0 ? (
              <li className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                Không có nhân viên phù hợp bộ lọc.
              </li>
            ) : null}
          </ul>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-sky-200/70 bg-gradient-to-r from-sky-50/90 via-blue-50/50 to-indigo-50/40 px-3 py-3 dark:border-sky-900/50 dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-950">
          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 text-left sm:items-center">
            <input
              type="checkbox"
              disabled={saving}
              checked={suppressSessionChecked}
              onChange={() => setSuppressSessionChecked((v) => !v)}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded border-sky-300 text-sky-600 focus:ring-2 focus:ring-sky-300/70 focus:ring-offset-1 disabled:opacity-50 sm:mt-0 dark:border-sky-600 dark:text-sky-500 dark:focus:ring-sky-800/60"
            />
            <span className="min-w-0 flex-1 text-[11px] font-medium leading-snug text-slate-700 dark:text-slate-300">
              {suppressSessionLabel}
            </span>
          </label>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSkipAllNo}
              className="rounded-lg border-2 border-sky-200/90 bg-white px-3 py-2 text-xs font-semibold text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-700/80 dark:bg-slate-800 dark:text-sky-100 dark:hover:border-sky-600 dark:hover:bg-sky-950/50"
            >
              {skipAllLabel}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleDismiss}
              className="rounded-lg border-2 border-sky-200/90 bg-white px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-700/80 dark:bg-slate-800 dark:text-sky-200 dark:hover:border-sky-600 dark:hover:bg-sky-950/50"
            >
              {closeLabel}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-lg border-2 border-blue-600/90 bg-gradient-to-b from-sky-500 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-sky-600/30 transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/80 dark:from-sky-600 dark:to-blue-700 dark:shadow-sky-950/40 dark:hover:from-sky-500 dark:hover:to-blue-600"
            >
              {saving ? "…" : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
