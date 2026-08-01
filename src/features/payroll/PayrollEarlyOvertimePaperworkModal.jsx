import React, { useEffect, useMemo, useState } from "react";

/**
 * Xác nhận có giấy tăng ca sớm (ca ngày: trước 06:00 → 2h; từ 06:00 → 1h theo mốc).
 * @param {{ open: boolean, rows: object[], initialChecked: (id: string) => boolean, onDismiss: (opts?: { suppressSession?: boolean }) => void, onSave: (updates: Record<string, boolean>, opts?: { suppressSession?: boolean }) => void | Promise<void>, title: string, description: string, dateLabel?: string, dateCaption?: string, rulesAside?: boolean, rulesTitle?: string, saveLabel: string, skipAllLabel: string, selectAllLabel?: string, closeLabel?: string, saving?: boolean, readOnly?: boolean, viewOnlyHint?: string, showSuppressSession?: boolean, suppressSessionLabel?: string, timeLabel?: string, timeField?: string, searchPlaceholder?: string, departmentPlaceholder?: string }} props
 */
export default function PayrollEarlyOvertimePaperworkModal({
  open,
  rows,
  initialChecked,
  onDismiss,
  onSave,
  title,
  description,
  dateLabel = "",
  dateCaption = "",
  rulesAside = false,
  rulesTitle = "",
  saveLabel,
  skipAllLabel,
  selectAllLabel,
  closeLabel = "Đóng",
  saving = false,
  readOnly = false,
  viewOnlyHint = "",
  showSuppressSession = false,
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
  const [rulesOpen, setRulesOpen] = useState(false);

  const showRulesAside = rulesAside && Boolean(String(description ?? "").trim());

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
    setRulesOpen(false);
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
    if (readOnly) return;
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

  const bulkSelectLocalOnly = Boolean(selectAllLabel);

  const handleSelectAll = () => {
    if (saving || readOnly) return;
    setChecks((prev) => {
      const next = { ...prev };
      for (const emp of rows) {
        next[emp.id] = true;
      }
      return next;
    });
  };

  const handleDeselectAll = () => {
    if (saving || readOnly) return;
    setChecks((prev) => {
      const next = { ...prev };
      for (const emp of rows) {
        next[emp.id] = false;
      }
      return next;
    });
  };

  const handleSkipAllNo = async () => {
    if (saving) return;
    if (bulkSelectLocalOnly) {
      handleDeselectAll();
      return;
    }
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

  const footerBtnClass =
    "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-md border-2 border-sky-200/90 bg-white px-2.5 text-[11px] font-semibold text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-700/80 dark:bg-slate-800 dark:text-sky-100 dark:hover:border-sky-600 dark:hover:bg-sky-950/50";
  const footerBtnCloseClass =
    "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-md border-2 border-sky-200/90 bg-white px-2.5 text-[11px] font-semibold text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-700/80 dark:bg-slate-800 dark:text-sky-200 dark:hover:border-sky-600 dark:hover:bg-sky-950/50";
  const footerBtnSaveClass =
    "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-md border-2 border-blue-600/90 bg-gradient-to-b from-sky-500 to-blue-600 px-3 text-[11px] font-bold text-white shadow-md shadow-sky-600/30 transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/80 dark:from-sky-600 dark:to-blue-700 dark:shadow-sky-950/40 dark:hover:from-sky-500 dark:hover:to-blue-600";

  const hasFooterMeta =
    (readOnly && viewOnlyHint) || (showSuppressSession && !readOnly);

  const rulesPanelBody = (
    <>
      {rulesTitle ? (
        <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-sky-950 dark:text-sky-50">
          {rulesTitle}
        </h3>
      ) : null}
      <p className="whitespace-pre-line text-[10px] font-normal leading-relaxed text-sky-900/82 dark:text-sky-200/88">
        {description}
      </p>
    </>
  );

  const rulesPanelShellClass =
    "relative overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-100/95 via-blue-50/90 to-indigo-50/70 shadow-xl shadow-sky-200/25 ring-1 ring-sky-100/90 dark:border-slate-600/80 dark:from-sky-950/90 dark:via-blue-950/75 dark:to-slate-900 dark:shadow-black/40 dark:ring-sky-900/30";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden overscroll-none bg-slate-950/75 p-3 backdrop-blur-sm"
      style={{ zIndex: "var(--z-modal-backdrop, 1200)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payroll-early-ot-title"
      onClick={saving ? undefined : handleDismiss}
    >
      <div
        className="flex w-full max-w-[42rem] items-stretch justify-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {showRulesAside ? (
          <aside className="hidden w-[11.25rem] shrink-0 self-center sm:block">
            <div
              className={`max-h-[min(96vh,780px)] overflow-y-auto p-3 ${rulesPanelShellClass}`}
            >
              <div
                className="pointer-events-none absolute -right-3 -top-4 h-20 w-20 rounded-full bg-sky-300/25 blur-2xl dark:bg-sky-500/10"
                aria-hidden
              />
              <div className="relative">{rulesPanelBody}</div>
            </div>
          </aside>
        ) : null}

        <div className="flex min-h-0 max-w-xl flex-1 flex-col overflow-hidden rounded-2xl border border-sky-200/80 bg-white shadow-xl shadow-sky-200/25 ring-1 ring-sky-100/90 max-h-[min(96vh,780px)] dark:border-slate-600/80 dark:bg-slate-900 dark:shadow-black/40 dark:ring-sky-900/30">
        <div className="relative shrink-0 overflow-hidden border-b border-sky-200/80 bg-gradient-to-br from-sky-100/95 via-blue-50/90 to-indigo-50/70 px-3 py-2 dark:border-sky-800/40 dark:from-sky-950/90 dark:via-blue-950/75 dark:to-slate-900">
          <div
            className="pointer-events-none absolute -right-4 -top-6 h-32 w-32 rounded-full bg-sky-300/30 blur-2xl dark:bg-sky-500/15"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-2 bottom-0 h-16 w-24 rounded-full bg-blue-200/25 blur-xl dark:bg-blue-500/8"
            aria-hidden
          />
          <div className="relative flex items-start gap-2">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-200/95 text-xs font-bold tracking-tight text-sky-950 shadow-sm ring-1 ring-sky-300/60 dark:bg-sky-800/75 dark:text-sky-50 dark:ring-sky-600/45"
              aria-hidden
            >
              TC
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-start gap-1">
                  <h2
                    id="payroll-early-ot-title"
                    className="min-w-0 flex-1 text-sm font-semibold leading-tight text-sky-950 dark:text-sky-50"
                  >
                    {title}
                  </h2>
                  {showRulesAside ? (
                    <div className="relative shrink-0 sm:hidden">
                      <button
                        type="button"
                        onClick={() => setRulesOpen((openRules) => !openRules)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/15 bg-white/95 text-[11px] font-bold text-black shadow-sm dark:border-slate-500/50 dark:bg-slate-900/90 dark:text-slate-100"
                        aria-expanded={rulesOpen}
                        aria-label={rulesTitle || "Quy tắc tính giờ"}
                        title={rulesTitle || "Quy tắc tính giờ"}
                      >
                        i
                      </button>
                      {rulesOpen ? (
                        <div
                          className={`absolute left-0 top-full z-10 mt-1 w-[min(16rem,calc(100vw-2rem))] p-2.5 ${rulesPanelShellClass}`}
                        >
                          <div className="relative">{rulesPanelBody}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {dateLabel ? (
                  <div className="shrink-0 text-right leading-tight">
                    {dateCaption ? (
                      <span className="block text-[9px] font-semibold uppercase tracking-wide text-black dark:text-slate-100">
                        {dateCaption}
                      </span>
                    ) : null}
                    <span className="mt-0.5 inline-flex items-center rounded-md border border-black/15 bg-white/95 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-black shadow-sm dark:border-slate-500/50 dark:bg-slate-900/90 dark:text-slate-100">
                      {dateLabel}
                    </span>
                  </div>
                ) : null}
              </div>
              {!showRulesAside && description ? (
                <p className="mt-1 whitespace-pre-line text-[10px] font-normal leading-snug text-sky-900/82 dark:text-sky-200/88">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="shrink-0 border-b border-sky-200/70 bg-white/90 px-2.5 py-2 dark:border-sky-900/40 dark:bg-slate-900/95">
          <div className="flex flex-col gap-1.5 sm:flex-row">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 min-w-0 flex-1 rounded-md border border-sky-200 bg-white px-2.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200/70 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:ring-sky-900/50"
            />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-8 rounded-md border border-sky-200 bg-white px-2.5 text-xs text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200/70 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-500 dark:focus:ring-sky-900/50"
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
        <div className="min-h-0 flex-1 overflow-y-auto bg-stone-50/40 px-2 py-1.5 dark:bg-slate-950/50">
          <ul className="space-y-1.5">
            {filteredRows.map((emp) => (
              <li
                key={emp.id}
                className="flex flex-wrap items-stretch gap-1 rounded-lg border border-stone-200/70 bg-white pl-0.5 shadow-sm shadow-stone-300/15 dark:border-slate-700/70 dark:bg-slate-800/50 dark:shadow-none"
              >
                <div
                  className="w-0.5 shrink-0 rounded-l-full bg-gradient-to-b from-sky-300/85 to-blue-200/70 dark:from-sky-600/60 dark:to-blue-900/50"
                  aria-hidden
                />
                <label
                  className={`flex min-w-0 flex-1 items-start gap-2 px-1.5 py-1.5 sm:items-center${readOnly ? "" : " cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    disabled={saving || readOnly}
                    checked={!!checks[emp.id]}
                    onChange={() => toggle(emp.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-sky-300 text-sky-600 focus:ring-2 focus:ring-sky-300/70 focus:ring-offset-0 disabled:opacity-50 dark:border-sky-600 dark:text-sky-500 dark:focus:ring-sky-800/60"
                  />
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="flex flex-wrap items-center gap-1 gap-y-0.5">
                      <span className="text-[13px] font-bold tracking-tight text-slate-900 dark:text-white">
                        {emp.hoVaTen || "—"}
                      </span>
                      {String(emp.boPhan ?? "").trim() ? (
                        <span className="inline-flex max-w-full items-center rounded border border-violet-200/70 bg-violet-50/90 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-violet-800/90 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-200/90">
                          {String(emp.boPhan).trim()}
                        </span>
                      ) : (
                        <span className="inline-flex rounded border border-dashed border-stone-300/80 bg-stone-100/80 px-1 py-px text-[9px] font-medium text-stone-500 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-500">
                          BP —
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block tabular-nums text-[10px] text-slate-600 dark:text-slate-400">
                      <span className="font-medium text-slate-600 dark:text-slate-400">
                        MNV
                      </span>{" "}
                      <span className="text-[11px] font-extrabold text-sky-900 tabular-nums dark:text-sky-200">
                        {emp.mnv ?? "—"}
                      </span>
                      <span className="mx-1 text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="font-medium text-slate-600 dark:text-slate-400">
                        {timeLabel}
                      </span>{" "}
                      <span className="text-[11px] font-extrabold text-sky-900 tabular-nums dark:text-sky-200">
                        {emp?.[timeField] ?? "—"}
                      </span>
                    </span>
                  </span>
                </label>
              </li>
            ))}
            {filteredRows.length === 0 ? (
              <li className="rounded-lg border border-dashed border-slate-300 bg-white px-2 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                Không có nhân viên phù hợp bộ lọc.
              </li>
            ) : null}
          </ul>
        </div>
        <div className="shrink-0 border-t border-sky-200/70 bg-gradient-to-r from-sky-50/90 via-blue-50/50 to-indigo-50/40 px-2.5 py-2 dark:border-sky-900/50 dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-950">
          <div
            className={`flex flex-col gap-2${hasFooterMeta ? " sm:flex-row sm:items-center sm:justify-between" : ""}`}
          >
            {hasFooterMeta ? (
              <div className="min-w-0 sm:flex-1 sm:pr-2">
                {readOnly && viewOnlyHint ? (
                  <p className="text-[10px] leading-snug text-sky-900/75 dark:text-sky-200/80">
                    {viewOnlyHint}
                  </p>
                ) : null}
                {showSuppressSession && !readOnly ? (
                  <label className="flex cursor-pointer items-center gap-2 text-left">
                    <input
                      type="checkbox"
                      disabled={saving}
                      checked={suppressSessionChecked}
                      onChange={() => setSuppressSessionChecked((v) => !v)}
                      className="h-4 w-4 shrink-0 rounded border-sky-300 text-sky-600 focus:ring-2 focus:ring-sky-300/70 focus:ring-offset-0 disabled:opacity-50 dark:border-sky-600 dark:text-sky-500 dark:focus:ring-sky-800/60"
                    />
                    <span className="min-w-0 text-[10px] font-medium leading-snug text-slate-700 dark:text-slate-300">
                      {suppressSessionLabel}
                    </span>
                  </label>
                ) : null}
              </div>
            ) : null}
            <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1.5 sm:w-auto">
              {!readOnly ? (
                <>
                  {selectAllLabel ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSelectAll}
                      className={footerBtnClass}
                    >
                      {selectAllLabel}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSkipAllNo}
                    className={footerBtnClass}
                  >
                    {skipAllLabel}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                disabled={saving}
                onClick={handleDismiss}
                className={footerBtnCloseClass}
              >
                {closeLabel}
              </button>
              {!readOnly ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className={footerBtnSaveClass}
                >
                  {saving ? "…" : saveLabel}
                </button>
              ) : null}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
