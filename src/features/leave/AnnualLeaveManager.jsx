import { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { canManageAnnualLeave } from "@/config/authRoles";
import { db, ref, set } from "@/services/firebase";
import AlertMessage from "@/components/ui/AlertMessage";
import LoadingBlock from "@/components/ui/LoadingBlock";
import HrTablePagination from "@/components/ui/HrTablePagination";
import { useHrTablePagination } from "@/hooks/useHrTablePagination";
import {
  ANNUAL_LEAVE_EMP,
  ANNUAL_LEAVE_META_KEY,
  ANNUAL_LEAVE_RTDB_ROOT,
  ANNUAL_LEAVE_MANAGER_MIN_YEAR,
} from "./annualLeaveFields";
import { normalizeAnnualLeaveRowLive } from "./annualLeaveDerived";
import { parseAnnualLeaveExcelFile } from "./annualLeaveExcelImport";
import { exportAnnualLeaveExcel } from "./annualLeaveExcelExport";
import { useAnnualLeaveLiveData } from "./useAnnualLeaveLiveData";
import { useAnnualLeaveYearReconcile } from "./useAnnualLeaveYearReconcile";
import { persistAnnualLeaveYearFromAttendance } from "./annualLeaveAttendanceSync";
import { indexAnnualLeaveYearByEmpKey } from "./annualLeaveEmpKey";
import AnnualLeaveManagerTableRow from "./AnnualLeaveManagerTableRow";
import { attendanceListDateForAnnualLeaveYear } from "./annualLeaveCrossLinks";
import {
  ANNUAL_LEAVE_TABLE_HEADER_GRADIENT,
  annualLeaveTableThClass,
} from "./annualLeaveTableStyles";
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

function normalizeAnnualLeaveRow(id, raw, deductionsByMnv) {
  return normalizeAnnualLeaveRowLive(id, raw, deductionsByMnv);
}

export default function AnnualLeaveManager() {
  const { t } = useTranslation();
  const { user, userRole } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const yearFromUrl = Number(searchParams.get("year"));
  const [year, setYear] = useState(() =>
    clampAnnualLeaveManagerYear(yearFromUrl),
  );
  const [uploading, setUploading] = useState(false);
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

  const { yearData, deductionsByEmpKey, loading } =
    useAnnualLeaveLiveData(year, {
      includeUsageDetail: false,
      includeBalanceMap: false,
    });

  useAnnualLeaveYearReconcile({
    attendanceRootPath: "attendance",
    year,
    userEmail: user?.email ?? "",
    enabled: canManage,
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

  const { rows, meta } = useMemo(() => {
    const list = [];
    let nextMeta = null;
    if (yearData && typeof yearData === "object") {
      if (yearData[ANNUAL_LEAVE_META_KEY]) {
        nextMeta = yearData[ANNUAL_LEAVE_META_KEY];
      }
      const indexed = indexAnnualLeaveYearByEmpKey(yearData);
      for (const [empKey, { raw }] of Object.entries(indexed)) {
        const row = normalizeAnnualLeaveRow(empKey, raw, deductionsByEmpKey);
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
    return { rows: list, meta: nextMeta };
  }, [yearData, deductionsByEmpKey]);

  const deferredSearch = useDeferredValue(search);

  const detailThroughDateKey = useMemo(
    () => attendanceListDateForAnnualLeaveYear(year),
    [year],
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

  const departments = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const d = r[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT];
      if (d) set.add(String(d));
    });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (deptFilter && r[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] !== deptFilter) {
        return false;
      }
      if (!q) return true;
      const name = String(r[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "").toLowerCase();
      const mnv = String(r[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? "").trim();
      return name.includes(q) || mnv.includes(q);
    });
  }, [rows, deferredSearch, deptFilter]);

  const tablePagination = useHrTablePagination(filteredRows, {
    resetDeps: [year, deferredSearch, deptFilter],
  });

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
        const { records, errors } = await parseAnnualLeaveExcelFile(file);
        if (errors.length > 0 && records.length === 0) {
          setAlert({ show: true, type: "error", message: errors.join(" ") });
          return;
        }

        const payload = {
          [ANNUAL_LEAVE_META_KEY]: {
            updatedAt: new Date().toISOString(),
            updatedBy: user?.email ?? "",
            rowCount: records.length,
          },
        };
        for (const rec of records) {
          const { id, rowNo, ...rest } = rec;
          payload[id] = { ...rest, rowNo };
        }

        await set(ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`), payload);
        await persistAnnualLeaveYearFromAttendance(db, {
          year,
          attendanceRootPath: "attendance",
          updatedBy: user?.email ?? "",
        });
        setAlert({
          show: true,
          type: "success",
          message: t("annualLeave.uploadSuccess", {
            count: records.length,
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
    [canManage, year, user?.email, t],
  );

  const handleExport = useCallback(async () => {
    try {
      const buffer = await exportAnnualLeaveExcel(filteredRows, year);
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
  }, [filteredRows, year, t]);

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
            {meta?.updatedAt ? (
              <p className="mt-0 hidden text-[10px] leading-snug text-slate-500 md:mt-0.5 md:block md:text-[11px]">
                {t("annualLeave.lastUpdated")}:{" "}
                {new Date(meta.updatedAt).toLocaleString()}
                {meta.updatedBy ? ` · ${meta.updatedBy}` : ""}
              </p>
            ) : null}
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
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="h-8 max-w-full rounded-md border bg-white px-2 text-xs font-medium dark:border-slate-600 dark:bg-slate-900 sm:max-w-[11rem]"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
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
              {t("annualLeave.rowCount", { count: filteredRows.length })}
            </span>

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
                          disabled={filteredRows.length === 0}
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

        {loading ? (
          <LoadingBlock />
        ) : (
          <div className="annual-leave-table-compact min-w-0 w-full max-w-none overflow-x-auto overscroll-x-contain bg-white dark:bg-slate-900">
            <div className="annual-leave-table-scroll max-h-[min(88vh,920px)] w-full min-w-0 max-w-full overflow-y-auto overflow-x-auto overscroll-x-contain">
              <table className="annual-leave-table w-full max-w-none table-fixed border-collapse">
                <colgroup>
                  <col className="annual-leave-col-no" />
                  <col className="annual-leave-col-code" />
                  <col className="annual-leave-col-code" />
                  <col className="annual-leave-name" />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col className="annual-leave-col-detail" />
                </colgroup>
                <thead className="sticky top-0 z-20">
                  <tr style={{ background: ANNUAL_LEAVE_TABLE_HEADER_GRADIENT }}>
                    <th rowSpan={2} className={annualLeaveTableThClass}>
                      No
                    </th>
                    <th colSpan={2} className={annualLeaveTableThClass}>
                      EMPL. CODE
                    </th>
                    <th rowSpan={2} className={annualLeaveTableThClass}>
                      Full Name
                    </th>
                    <th rowSpan={2} className={annualLeaveTableThClass}>
                      Date of Birth
                    </th>
                    <th rowSpan={2} className={annualLeaveTableThClass}>
                      SUB-DEPARTMENT
                    </th>
                    <th rowSpan={2} className={annualLeaveTableThClass}>
                      START WORKING DATE
                    </th>
                    <th rowSpan={2} className={annualLeaveTableThClass}>
                      ANNUAL LEAVE IN CURRENT YEAR
                    </th>
                    <th rowSpan={2} className={annualLeaveTableThClass}>
                      BONUS ANNUAL LEAVE (Environment)
                    </th>
                    <th rowSpan={2} className={annualLeaveTableThClass}>
                      Compensatory day off NGHỈ BÙ
                    </th>
                    <th rowSpan={2} className={annualLeaveTableThClass}>
                      TOTAL ANNUAL LEAVE
                    </th>
                    <th rowSpan={2} className={annualLeaveTableThClass}>
                      ANNUAL LEAVE USED
                    </th>
                    <th rowSpan={2} className={annualLeaveTableThClass}>
                      BALANCE
                    </th>
                    <th rowSpan={2} className={annualLeaveTableThClass}>
                      {t("annualLeave.detailColumn", {
                        defaultValue: "DETAIL",
                      })}
                    </th>
                  </tr>
                  <tr style={{ background: ANNUAL_LEAVE_TABLE_HEADER_GRADIENT }}>
                    <th className={annualLeaveTableThClass}>MNV</th>
                    <th className={annualLeaveTableThClass}>MVT</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={14}
                        className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        {t("annualLeave.noData")}
                      </td>
                    </tr>
                  ) : (
                    tablePagination.pagedItems.map((row, localIdx) => (
                      <AnnualLeaveManagerTableRow
                        key={row.id}
                        row={row}
                        index={tablePagination.rowIndexOffset + localIdx}
                        year={year}
                        throughDateKey={detailThroughDateKey}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <HrTablePagination
          rangeStart={tablePagination.rangeStart}
          rangeEnd={tablePagination.rangeEnd}
          totalItems={tablePagination.totalItems}
          page={tablePagination.page}
          totalPages={tablePagination.totalPages}
          pageNumbers={tablePagination.pageNumbers}
          pageSize={tablePagination.pageSize}
          onPageChange={tablePagination.setPage}
          onPageSizeChange={tablePagination.setPageSize}
        />
      </div>
    </AttendanceHrPageShell>
  );
}
