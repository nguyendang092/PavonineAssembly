import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useDeferredValue,
  startTransition,
} from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { canManageAnnualLeave } from "@/config/authRoles";
import { db, ref, remove, update } from "@/services/firebase";
import AlertMessage from "@/components/ui/AlertMessage";
import PayrollMonthGridLoadingOverlay from "@/features/payroll/PayrollMonthGridLoadingOverlay";
import {
  filterAnnualLeaveManagerRows,
  listAnnualLeaveManagerDepartments,
} from "./annualLeaveManagerFilter";
import AnnualLeaveManagerTablePanel from "./AnnualLeaveManagerTablePanel";
import {
  ANNUAL_LEAVE_MANAGER_MIN_YEAR,
} from "./annualLeaveFields";
import { formatAnnualLeaveMonthColumnLabel } from "./annualLeaveCalculated";
import {
  buildAnnualLeaveMonthlyUsageByEmpKey,
  buildStoredMonthlyLeaveUsageByEmpKey,
  normalizeAnnualLeaveRowLive,
} from "./annualLeaveDerived";
import { parseAnnualLeaveExcelFile } from "./annualLeaveExcelImport";
import { exportAnnualLeaveExcel } from "./annualLeaveExcelExport";
import { useAnnualLeaveLiveData } from "./useAnnualLeaveLiveData";
import { useAnnualLeaveYearReconcile } from "./useAnnualLeaveYearReconcile";
import { persistAnnualLeaveYearFromAttendance } from "./annualLeaveAttendanceSync";
import { indexAnnualLeaveYearByEmpKey } from "./annualLeaveEmpKey";
import {
  annualLeaveYearRefPath,
  buildAnnualLeaveMergeUploadUpdates,
} from "./annualLeaveYearDataOps";
import { attendanceListDateForAnnualLeaveYear } from "./annualLeaveCrossLinks";
import AttendanceHrPageShell from "@/features/attendance/AttendanceHrPageShell";
import { useAttendanceFilterDropdownPlacement } from "@/features/attendance/useAttendanceToolbarDropdownPlacement";
import { useCloseDropdownOnScroll } from "@/features/attendance/useCloseDropdownOnScroll";
import "@/features/attendance/attendanceToolbarFocus.css";
import "@/features/attendance/hrPageCompact.css";
import "./annualLeaveManager.css";

function currentYear() {
  return new Date().getFullYear();
}

function clampAnnualLeaveManagerYear(value) {
  const y = Number(value);
  const max = Math.max(currentYear(), ANNUAL_LEAVE_MANAGER_MIN_YEAR) + 2;
  if (!Number.isFinite(y)) return Math.max(currentYear(), ANNUAL_LEAVE_MANAGER_MIN_YEAR);
  return Math.min(Math.max(y, ANNUAL_LEAVE_MANAGER_MIN_YEAR), max);
}

function listAnnualLeaveManagerYearOptions() {
  const max = Math.max(currentYear(), ANNUAL_LEAVE_MANAGER_MIN_YEAR) + 2;
  return Array.from(
    { length: max - ANNUAL_LEAVE_MANAGER_MIN_YEAR + 1 },
    (_, i) => ANNUAL_LEAVE_MANAGER_MIN_YEAR + i,
  );
}

function normalizeAnnualLeaveRow(
  id,
  raw,
  deductionsByMnv,
  year,
  monthValues,
  joinMonthWorkSummary = null,
) {
  return normalizeAnnualLeaveRowLive(
    id,
    raw,
    deductionsByMnv,
    year,
    monthValues,
    joinMonthWorkSummary,
  );
}

const EMPTY_MONTH_VALUES = Object.freeze(Array.from({ length: 12 }, () => 0));

export default function AnnualLeaveManager() {
  const { t } = useTranslation();
  const { user, userRole } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const yearFromUrl = Number(searchParams.get("year"));
  const [year, setYear] = useState(() =>
    clampAnnualLeaveManagerYear(yearFromUrl),
  );
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [actionsOpen, setActionsOpen] = useState(false);
  const fileInputRef = useRef(null);
  const actionsAnchorRef = useRef(null);
  const actionsPanelRef = useRef(null);
  const actionsPlacement = useAttendanceFilterDropdownPlacement(
    actionsOpen,
    actionsAnchorRef,
  );

  const closeActionsMenu = useCallback(() => setActionsOpen(false), []);
  useCloseDropdownOnScroll(actionsOpen, actionsPanelRef, closeActionsMenu);

  const canManage = canManageAnnualLeave(user, userRole);
  const [attendanceDataEnabled, setAttendanceDataEnabled] = useState(false);

  const { yearData, deductionsByEmpKey, attendanceMonthlyByEmpKey, joinMonthWorkSummaryByEmpKey, loading } =
    useAnnualLeaveLiveData(year, {
      includeUsageDetail: false,
      includeBalanceMap: false,
      includeAttendance: attendanceDataEnabled,
    });

  useEffect(() => {
    setAttendanceDataEnabled(false);
  }, [year]);

  useAnnualLeaveYearReconcile({
    attendanceRootPath: "attendance",
    year,
    userEmail: user?.email ?? "",
    enabled: false,
  });

  useEffect(() => {
    const raw = searchParams.get("year");
    if (!raw) return;
    const y = clampAnnualLeaveManagerYear(Number(raw));
    setYear(y);
    if (String(y) !== raw) {
      setSearchParams({ year: String(y) }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const deferredYearData = useDeferredValue(yearData);
  const deferredDeductionsByEmpKey = useDeferredValue(deductionsByEmpKey);
  const deferredAttendanceMonthlyByEmpKey = useDeferredValue(
    attendanceMonthlyByEmpKey,
  );
  const deferredJoinMonthWorkSummaryByEmpKey = useDeferredValue(
    joinMonthWorkSummaryByEmpKey,
  );

  const storedMonthlyByEmpKey = useMemo(
    () => buildStoredMonthlyLeaveUsageByEmpKey(deferredYearData),
    [deferredYearData],
  );

  const { yearMonths, monthlyByEmpKey } = useMemo(
    () =>
      buildAnnualLeaveMonthlyUsageByEmpKey(
        year,
        storedMonthlyByEmpKey,
        deferredAttendanceMonthlyByEmpKey,
      ),
    [deferredAttendanceMonthlyByEmpKey, year, storedMonthlyByEmpKey],
  );

  const rows = useMemo(() => {
    const list = [];
    if (deferredYearData && typeof deferredYearData === "object") {
      const indexed = indexAnnualLeaveYearByEmpKey(deferredYearData);
      for (const [empKey, { raw }] of Object.entries(indexed)) {
        const row = normalizeAnnualLeaveRow(
          empKey,
          raw,
          deferredDeductionsByEmpKey,
          year,
          monthlyByEmpKey[empKey] ?? EMPTY_MONTH_VALUES,
          deferredJoinMonthWorkSummaryByEmpKey[empKey] ?? null,
        );
        if (row) list.push(row);
      }
    }
    list.sort((a, b) => {
      const na = Number(a.rowNo);
      const nb = Number(b.rowNo);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return String(a.rowNo ?? "").localeCompare(
        String(b.rowNo ?? ""),
        undefined,
        { numeric: true },
      );
    });
    return list;
  }, [deferredYearData, deferredDeductionsByEmpKey, monthlyByEmpKey, deferredJoinMonthWorkSummaryByEmpKey, year]);

  const deferredSearch = useDeferredValue(search);
  const deferredDeptFilter = useDeferredValue(deptFilter);
  const filterPending =
    search !== deferredSearch || deptFilter !== deferredDeptFilter;

  const detailThroughDateKey = useMemo(
    () => attendanceListDateForAnnualLeaveYear(year),
    [year],
  );

  const monthColumnLabels = useMemo(
    () => yearMonths.map(formatAnnualLeaveMonthColumnLabel),
    [yearMonths],
  );

  useEffect(() => {
    if (!actionsOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setActionsOpen(false);
    };
    const onClickOutside = (event) => {
      if (event.button != null && event.button !== 0) return;
      const raw = event.target;
      const target =
        raw instanceof Element
          ? raw
          : raw instanceof Node && raw.parentElement
            ? raw.parentElement
            : null;
      if (!target) return;
      if (
        actionsAnchorRef.current?.contains(target) ||
        actionsPanelRef.current?.contains(target)
      ) {
        return;
      }
      setActionsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClickOutside);
    };
  }, [actionsOpen]);

  const filteredRows = useMemo(
    () =>
      filterAnnualLeaveManagerRows(rows, {
        search: deferredSearch,
        deptFilter: deferredDeptFilter,
      }),
    [rows, deferredSearch, deferredDeptFilter],
  );

  const departments = useMemo(
    () => listAnnualLeaveManagerDepartments(rows),
    [rows],
  );

  const displayRowCount = filteredRows.length;

  const handleSearchChange = useCallback((event) => {
    startTransition(() => setSearch(event.target.value));
  }, []);

  const handleDeptFilterChange = useCallback((event) => {
    const value = event.target.value;
    startTransition(() => setDeptFilter(value));
  }, []);

  const handleRecalculate = useCallback(async () => {
    if (!canManage || syncing) return;
    setSyncing(true);
    try {
      const { appliedCount } = await persistAnnualLeaveYearFromAttendance(db, {
        year,
        attendanceRootPath: "attendance",
        updatedBy: user?.email ?? "",
      });
      setAlert({
        show: true,
        type: "success",
        message: t("annualLeave.recalculateSuccess", {
          defaultValue: "Đã cập nhật {{count}} bản ghi phép năm từ điểm danh.",
          count: appliedCount,
        }),
      });
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        message: err?.message || t("annualLeave.recalculateError", {
          defaultValue: "Không thể tính lại phép năm.",
        }),
      });
    } finally {
      setSyncing(false);
    }
  }, [canManage, syncing, year, user?.email, t]);

  const handleUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (e.target) e.target.value = "";
      if (!file || !canManage) return;

      setUploading(true);
      try {
        const { records, errors } = await parseAnnualLeaveExcelFile(file, { year });
        if (errors.length > 0 && records.length === 0) {
          setAlert({ show: true, type: "error", message: errors.join(" ") });
          return;
        }

        const { updates, importedCount } = buildAnnualLeaveMergeUploadUpdates({
          year,
          records,
          existingYearData: yearData,
          updatedBy: user?.email ?? "",
        });

        await update(ref(db), updates);
        await persistAnnualLeaveYearFromAttendance(db, {
          year,
          attendanceRootPath: "attendance",
          updatedBy: user?.email ?? "",
        });
        setAlert({
          show: true,
          type: "success",
          message: t("annualLeave.uploadSuccess", {
            count: importedCount,
            year,
          }),
        });
        if (errors.length > 0) {
          setAlert({
            show: true,
            type: "warning",
            message: errors.join(" "),
          });
        }
      } catch (err) {
        setAlert({
          show: true,
          type: "error",
          message: err?.message || t("annualLeave.uploadError"),
        });
      } finally {
        setUploading(false);
      }
    },
    [canManage, year, user?.email, yearData, t],
  );

  const handleDeleteYearData = useCallback(async () => {
    if (!canManage || deleting) return;
    const employeeCount = rows.length;
    const confirmed = window.confirm(
      t("annualLeave.deleteYearDataConfirm", {
        year,
        count: employeeCount,
      }),
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await remove(ref(db, annualLeaveYearRefPath(year)));
      setAlert({
        show: true,
        type: "success",
        message: t("annualLeave.deleteYearDataSuccess", { year }),
      });
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        message:
          err?.message ||
          t("annualLeave.deleteYearDataError", {
            defaultValue: "Không xóa được dữ liệu phép năm.",
          }),
      });
    } finally {
      setDeleting(false);
    }
  }, [canManage, deleting, rows.length, t, year]);

  const handleExport = useCallback(async () => {
    try {
      const exportRows = filterAnnualLeaveManagerRows(rows, {
        search,
        deptFilter,
      });
      const buffer = await exportAnnualLeaveExcel(exportRows, year, {
        monthColumnLabels,
        monthlyByEmpKey,
      });
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PAVONINE_annual_leave_${year}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        message: err?.message || t("annualLeave.exportError"),
      });
    }
  }, [rows, search, deptFilter, year, t, monthColumnLabels, monthlyByEmpKey]);

  const yearOptions = useMemo(() => listAnnualLeaveManagerYearOptions(), []);

  if (!user) {
    return (
      <AttendanceHrPageShell
        contextDate={attendanceListDateForAnnualLeaveYear(year)}
      >
        <div className="annual-leave-viewport hr-page-compact attendance-list-viewport w-full max-w-none">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t("annualLeave.pleaseLogin")}
          </p>
        </div>
      </AttendanceHrPageShell>
    );
  }

  return (
    <AttendanceHrPageShell
      contextDate={attendanceListDateForAnnualLeaveYear(year)}
    >
      <div className="annual-leave-viewport hr-page-compact attendance-list-viewport w-full max-w-none">
        <div className="mb-1 shrink-0">
          <div className="w-full border-t-4 border-blue-600 bg-white px-2 py-0.5 shadow-sm dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
            <h1 className="text-sm font-bold uppercase leading-snug tracking-wide text-[#1e293b] md:text-base dark:text-slate-100">
              {t("annualLeave.title")}
            </h1>
          </div>
        </div>

        <AlertMessage
          alert={alert}
          autoHideMs={4000}
          onClose={() => setAlert((a) => ({ ...a, show: false }))}
        />

        <div className="attendance-toolbar-controls sticky top-0 z-30 mb-1 flex shrink-0 flex-col gap-1 border-b border-slate-200/90 bg-white px-1.5 py-1 shadow-sm sm:mb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2 md:px-2 dark:border-slate-700/90 dark:bg-slate-900">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            <label className="flex h-7 items-center gap-1">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                {t("annualLeave.year")}
              </span>
              <select
                className="h-8 min-w-[4.5rem] rounded-md border bg-white px-2 text-sm font-semibold text-blue-800 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-300"
                value={year}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setYear(y);
                  setSearchParams({ year: String(y) }, { replace: true });
                }}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>

            <input
              type="search"
              placeholder={t("annualLeave.searchPlaceholder")}
              className="h-8 w-full min-w-0 rounded-md border px-2 text-sm focus:ring-2 focus:ring-blue-200 sm:w-44 dark:border-slate-600 dark:bg-slate-900"
              value={search}
              onChange={handleSearchChange}
            />

            <select
              className="h-8 max-w-full rounded-md border bg-white px-2 text-xs font-medium dark:border-slate-600 dark:bg-slate-900 sm:max-w-[11rem]"
              value={deptFilter}
              onChange={handleDeptFilterChange}
            >
              <option value="">{t("annualLeave.allDepartments")}</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1 sm:w-auto">
            <span className="inline-flex h-8 items-center rounded-md border border-blue-200/80 bg-blue-50 px-2 text-xs font-semibold text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
              {t("annualLeave.rowCount", { count: displayRowCount })}
            </span>

            <button
              type="button"
              className={`inline-flex h-8 items-center rounded-md border px-2 text-xs font-semibold transition ${
                attendanceDataEnabled
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              }`}
              onClick={() => setAttendanceDataEnabled(true)}
              disabled={attendanceDataEnabled}
              title={t("annualLeave.loadAttendanceHint", {
                defaultValue:
                  "Tải dữ liệu điểm danh để cập nhật cột tháng và phép đã dùng live.",
              })}
            >
              {attendanceDataEnabled
                ? t("annualLeave.attendanceLoaded", {
                    defaultValue: "Đã tải điểm danh",
                  })
                : t("annualLeave.loadAttendance", {
                    defaultValue: "Tải điểm danh",
                  })}
            </button>

            <div className="relative shrink-0">
              <button
                ref={actionsAnchorRef}
                type="button"
                className="inline-flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-[#1a73e8] px-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1557b0] sm:text-sm"
                onClick={() => setActionsOpen((open) => !open)}
                aria-expanded={actionsOpen}
                aria-haspopup="menu"
              >
                <span aria-hidden>⚙️</span>
                {t("annualLeave.actionsMenu", { defaultValue: "Chức năng" })}
                <span className="text-[10px] opacity-90" aria-hidden>
                  {actionsOpen ? "▲" : "▼"}
                </span>
              </button>

              {actionsOpen && actionsPlacement
                ? createPortal(
                    <div
                      ref={actionsPanelRef}
                      role="menu"
                      className="attendance-tools-dropdown attendance-toolbar-controls fixed flex flex-col overflow-hidden overscroll-contain rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
                      style={{
                        zIndex: "var(--z-navbar-dropdown, 110)",
                        top: actionsPlacement.top,
                        left: actionsPlacement.left,
                        width: actionsPlacement.width,
                        maxHeight: actionsPlacement.maxHeight,
                        minHeight: Math.min(actionsPlacement.maxHeight, 420),
                      }}
                    >
                      <div className="shrink-0 border-b border-[#1557b0] bg-[#1a73e8] px-4 py-2 text-sm font-bold text-white">
                        {t("annualLeave.actionsMenu", {
                          defaultValue: "Chức năng",
                        })}
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
                        {canManage ? (
                          <button
                            type="button"
                            role="menuitem"
                            disabled={syncing}
                            className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left text-gray-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200 dark:hover:bg-slate-800"
                            onClick={() => {
                              setActionsOpen(false);
                              handleRecalculate();
                            }}
                          >
                            <span className="shrink-0 text-lg" aria-hidden>
                              🔄
                            </span>
                            <span className="text-sm font-semibold">
                              {syncing
                                ? t("annualLeave.recalculating", {
                                    defaultValue: "Đang tính lại…",
                                  })
                                : t("annualLeave.recalculate", {
                                    defaultValue: "Tính lại từ điểm danh",
                                  })}
                            </span>
                          </button>
                        ) : null}

                        {canManage ? (
                          <>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".xlsx,.xls"
                              className="hidden"
                              onChange={(e) => {
                                setActionsOpen(false);
                                handleUpload(e);
                              }}
                            />
                            <button
                              type="button"
                              role="menuitem"
                              disabled={uploading}
                              className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left text-gray-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200 dark:hover:bg-slate-800"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <span className="shrink-0 text-lg" aria-hidden>
                                📤
                              </span>
                              <span className="text-sm font-semibold">
                                {uploading
                                  ? t("annualLeave.uploading")
                                  : t("annualLeave.uploadExcel")}
                              </span>
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              disabled={deleting || rows.length === 0}
                              className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-red-300 dark:hover:bg-red-950/40"
                              onClick={() => {
                                setActionsOpen(false);
                                void handleDeleteYearData();
                              }}
                            >
                              <span className="shrink-0 text-lg" aria-hidden>
                                🗑️
                              </span>
                              <span className="text-sm font-semibold">
                                {deleting
                                  ? t("annualLeave.deletingYearData", {
                                      defaultValue: "Đang xóa…",
                                    })
                                  : t("annualLeave.deleteYearData", {
                                      defaultValue: "Xóa dữ liệu phép năm",
                                    })}
                              </span>
                            </button>
                          </>
                        ) : null}

                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-gray-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200 dark:hover:bg-slate-800"
                          onClick={() => {
                            setActionsOpen(false);
                            handleExport();
                          }}
                          disabled={rows.length === 0}
                        >
                          <span className="shrink-0 text-lg" aria-hidden>
                            📥
                          </span>
                          <span className="text-sm font-semibold">
                            {t("annualLeave.exportExcel")}
                          </span>
                        </button>
                      </div>
                    </div>,
                    document.body,
                  )
                : null}
            </div>
          </div>
        </div>

        <PayrollMonthGridLoadingOverlay active={loading} mode="viewport" />

        {loading ? (
          <div
            className="annual-leave-table-compact min-h-0 flex-1"
            aria-hidden="true"
          />
        ) : (
          <AnnualLeaveManagerTablePanel
            filteredRows={filteredRows}
            monthlyByEmpKey={monthlyByEmpKey}
            year={year}
            monthColumnLabels={monthColumnLabels}
            detailThroughDateKey={detailThroughDateKey}
            filterPending={filterPending}
            t={t}
          />
        )}
      </div>
    </AttendanceHrPageShell>
  );
}
