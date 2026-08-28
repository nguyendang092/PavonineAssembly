import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useDeferredValue,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUserIdentity, useUserPermissions } from "@/contexts/UserContext";
import { canManageAnnualLeave } from "@/config/authRoles";
import { db, ref, remove, update } from "@/services/firebase";
import AlertMessage from "@/components/ui/AlertMessage";
import PayrollMonthGridLoadingOverlay from "@/features/payroll/PayrollMonthGridLoadingOverlay";
import {
  buildAnnualLeaveManagerRowCatalog,
  filterAnnualLeaveManagerEntries,
  resolveAnnualLeaveManagerTableEntries,
} from "./annualLeaveManagerFilter";
import AnnualLeaveManagerActionsMenu from "./AnnualLeaveManagerActionsMenu";
import AnnualLeaveManagerTableSection from "./AnnualLeaveManagerTableSection";
import AnnualLeaveManagerToolbar from "./AnnualLeaveManagerToolbar";
import { ANNUAL_LEAVE_MANAGER_MIN_YEAR } from "./annualLeaveFields";
import {
  ANNUAL_LEAVE_MANAGER_MONTH_VALUES,
  parseAnnualLeaveManagerMonthFilter,
  resolveAnnualLeaveManagerThroughDateKey,
} from "./annualLeaveManagerMonthFilter";
import { parseAnnualLeaveExcelFile } from "./annualLeaveExcelImport";
import { exportAnnualLeaveExcel } from "./annualLeaveExcelExport";
import { useAnnualLeaveYearData } from "./useAnnualLeaveYearData";
import { persistAnnualLeaveYearFromAttendance } from "./annualLeaveAttendanceSync";
import {
  annualLeaveYearRefPath,
  buildAnnualLeaveMergeUploadUpdates,
} from "./annualLeaveYearDataOps";
import AttendanceHrPageShell from "@/features/attendance/AttendanceHrPageShell";
import { useDebouncedSearchQuery } from "@/hooks/useDebouncedSearchQuery";
import "@/features/attendance/attendanceToolbarFocus.css";
import "@/features/attendance/hrPageCompact.css";
import "./annualLeaveManager.css";

function currentYear() {
  return new Date().getFullYear();
}

function clampAnnualLeaveManagerYear(value) {
  const y = Number(value);
  const max = Math.max(currentYear(), ANNUAL_LEAVE_MANAGER_MIN_YEAR) + 2;
  if (!Number.isFinite(y))
    return Math.max(currentYear(), ANNUAL_LEAVE_MANAGER_MIN_YEAR);
  return Math.min(Math.max(y, ANNUAL_LEAVE_MANAGER_MIN_YEAR), max);
}

const YEAR_OPTIONS = Array.from(
  {
    length:
      Math.max(currentYear(), ANNUAL_LEAVE_MANAGER_MIN_YEAR) +
      2 -
      ANNUAL_LEAVE_MANAGER_MIN_YEAR +
      1,
  },
  (_, i) => ANNUAL_LEAVE_MANAGER_MIN_YEAR + i,
);

export default function AnnualLeaveManager() {
  const { t } = useTranslation();
  const { user } = useUserIdentity();
  const { userRole } = useUserPermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const yearFromUrl = Number(searchParams.get("year"));
  const monthFromUrl = parseAnnualLeaveManagerMonthFilter(
    searchParams.get("month"),
  );
  const [year, setYear] = useState(() =>
    clampAnnualLeaveManagerYear(yearFromUrl),
  );
  const [monthFilter, setMonthFilter] = useState(monthFromUrl);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { query: debouncedSearch, onDebouncedSearchChange } =
    useDebouncedSearchQuery(year);
  const [deptFilter, setDeptFilter] = useState("");
  const deferredDeptFilter = useDeferredValue(deptFilter);
  const deptFilterPending = deptFilter !== deferredDeptFilter;
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [actionsOpen, setActionsOpen] = useState(false);
  const fileInputRef = useRef(null);
  const exportRef = useRef(null);
  const actionsAnchorRef = useRef(null);
  const actionsPanelRef = useRef(null);

  const canManage = canManageAnnualLeave(user, userRole);
  const { yearData, yearLoading } = useAnnualLeaveYearData(year);

  useEffect(() => {
    const rawYear = searchParams.get("year");
    if (!rawYear) return;

    const nextYear = clampAnnualLeaveManagerYear(Number(rawYear));
    const nextMonth = parseAnnualLeaveManagerMonthFilter(
      searchParams.get("month"),
    );

    setYear(nextYear);
    setMonthFilter(nextMonth);

    const params = { year: String(nextYear) };
    if (nextMonth) params.month = nextMonth;

    const urlMonth = searchParams.get("month") ?? "";
    const needsReplace =
      String(nextYear) !== rawYear ||
      nextMonth !== parseAnnualLeaveManagerMonthFilter(urlMonth);

    if (needsReplace) {
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setDeptFilter("");
  }, [year]);

  const rowCatalog = useMemo(
    () => buildAnnualLeaveManagerRowCatalog(yearData),
    [yearData],
  );
  const { entries, deptIndex, departments, storedMonthlyByEmpKey } = rowCatalog;

  const exportFiltersRef = useRef({ search: "", deptFilter: "" });
  exportFiltersRef.current = {
    search: debouncedSearch,
    deptFilter: deferredDeptFilter,
  };

  const tableFilterKey = `${deferredDeptFilter}\0${debouncedSearch}`;

  const { tableEntries: filteredEntries, lazyLoadRequired } = useMemo(() => {
    const resolved = resolveAnnualLeaveManagerTableEntries(
      entries,
      {
        search: debouncedSearch,
        deptFilter: deferredDeptFilter,
      },
      deptIndex,
    );
    return {
      tableEntries: resolved.entries,
      lazyLoadRequired: resolved.lazyLoadRequired,
    };
  }, [entries, debouncedSearch, deferredDeptFilter, deptIndex]);

  const totalEmployeeCount = entries.length;
  const displayRowCount = useMemo(() => {
    const resolved = resolveAnnualLeaveManagerTableEntries(
      entries,
      {
        search: debouncedSearch,
        deptFilter,
      },
      deptIndex,
    );
    if (resolved.lazyLoadRequired) return totalEmployeeCount;
    return resolved.entries.length;
  }, [entries, debouncedSearch, deptFilter, deptIndex, totalEmployeeCount]);
  const detailThroughDateKey = useMemo(
    () => resolveAnnualLeaveManagerThroughDateKey(year, monthFilter),
    [year, monthFilter],
  );

  const syncSearchParams = useCallback(
    (nextYear, nextMonthFilter) => {
      const params = { year: String(nextYear) };
      const month = parseAnnualLeaveManagerMonthFilter(nextMonthFilter);
      if (month) params.month = month;
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const handleYearChange = useCallback(
    (event) => {
      const y = Number(event.target.value);
      setYear(y);
      setMonthFilter("");
      syncSearchParams(y, "");
    },
    [syncSearchParams],
  );

  const handleMonthFilterChange = useCallback(
    (event) => {
      const nextMonth = parseAnnualLeaveManagerMonthFilter(event.target.value);
      setMonthFilter(nextMonth);
      syncSearchParams(year, nextMonth);
    },
    [syncSearchParams, year],
  );

  const handleDeptFilterChange = useCallback((event) => {
    setDeptFilter(event.target.value);
  }, []);

  const handleRecalculate = useCallback(async () => {
    if (!canManage || syncing) return;
    setSyncing(true);
    try {
      const { appliedCount } = await persistAnnualLeaveYearFromAttendance(db, {
        year,
        attendanceRootPath: "attendance",
        updatedBy: user?.email ?? "",
        rebuildLeaveAgg: true,
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
        message:
          err?.message ||
          t("annualLeave.recalculateError", {
            defaultValue: "Không thể tính lại phép năm.",
          }),
      });
    } finally {
      setSyncing(false);
    }
  }, [canManage, syncing, year, user?.email, t]);

  const handleAdjustmentSaved = useCallback(() => {
    setAlert({
      show: true,
      type: "success",
      message: t("annualLeave.adjustmentSaveSuccess", {
        defaultValue: "Đã lưu điều chỉnh phép năm.",
      }),
    });
  }, [t]);

  const handleAdjustmentSaveError = useCallback((err, fallbackMessage) => {
    setAlert({
      show: true,
      type: "error",
      message: err?.message || fallbackMessage,
    });
  }, []);

  const handleUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (e.target) e.target.value = "";
      if (!file || !canManage) return;

      setUploading(true);
      try {
        const { records, errors } = await parseAnnualLeaveExcelFile(file, {
          year,
        });
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
    const employeeCount = entries.length;
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
  }, [canManage, deleting, entries.length, t, year]);

  const handleExport = useCallback(async () => {
    try {
      const { search: exportSearch, deptFilter: exportDeptFilter } =
        exportFiltersRef.current;
      const exportRows =
        exportRef.current?.getExportRows({
          search: exportSearch,
          deptFilter: exportDeptFilter,
        }) ?? [];
      if (!exportRows.length) return;
      const monthColumnLabels =
        exportRef.current?.getMonthColumnLabels?.() ?? [];
      const monthlyByEmpKey =
        exportRef.current?.getMonthlyByEmpKey?.({
          search: exportSearch,
          deptFilter: exportDeptFilter,
        }) ?? {};
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
  }, [year, t]);

  const actionsMenu = useMemo(
    () => (
      <AnnualLeaveManagerActionsMenu
        t={t}
        canManage={canManage}
        actionsOpen={actionsOpen}
        setActionsOpen={setActionsOpen}
        actionsAnchorRef={actionsAnchorRef}
        actionsPanelRef={actionsPanelRef}
        fileInputRef={fileInputRef}
        syncing={syncing}
        uploading={uploading}
        deleting={deleting}
        hasEntries={entries.length > 0}
        onRecalculate={handleRecalculate}
        onUpload={handleUpload}
        onDelete={() => void handleDeleteYearData()}
        onExport={() => void handleExport()}
      />
    ),
    [
      t,
      canManage,
      actionsOpen,
      syncing,
      uploading,
      deleting,
      entries.length,
      handleRecalculate,
      handleUpload,
      handleDeleteYearData,
      handleExport,
    ],
  );

  if (!user) {
    return (
      <AttendanceHrPageShell
        contextDate={resolveAnnualLeaveManagerThroughDateKey(year, monthFilter)}
      >
        <div className="annual-leave-viewport hr-page-viewport hr-page-compact attendance-list-viewport w-full max-w-none">
          <p className="text-sm text-black dark:text-slate-300">
            {t("annualLeave.pleaseLogin")}
          </p>
        </div>
      </AttendanceHrPageShell>
    );
  }

  return (
    <AttendanceHrPageShell
      contextDate={resolveAnnualLeaveManagerThroughDateKey(year, monthFilter)}
    >
      <div className="annual-leave-viewport hr-page-viewport hr-page-compact attendance-list-viewport w-full max-w-none">
        <div className="mb-1 shrink-0">
          <div className="w-full border-t-4 border-blue-600 bg-white px-2 py-0.5 shadow-sm dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
            <h1 className="text-sm font-bold uppercase leading-snug tracking-wide text-black md:text-base dark:text-slate-100">
              {t("annualLeave.title")}
            </h1>
          </div>
        </div>

        <AlertMessage
          alert={alert}
          autoHideMs={4000}
          onClose={() => setAlert((a) => ({ ...a, show: false }))}
        />

        <div className="hr-page-body">
          <AnnualLeaveManagerToolbar
            t={t}
            year={year}
            yearOptions={YEAR_OPTIONS}
            monthFilter={monthFilter}
            monthOptions={ANNUAL_LEAVE_MANAGER_MONTH_VALUES}
            searchResetKey={year}
            onDebouncedSearchChange={onDebouncedSearchChange}
            deptFilter={deptFilter}
            departments={departments}
            displayRowCount={displayRowCount}
            deptFilterPending={deptFilterPending}
            onYearChange={handleYearChange}
            onMonthFilterChange={handleMonthFilterChange}
            onDeptFilterChange={handleDeptFilterChange}
            actionsSlot={actionsMenu}
          />

          <div className="hr-page-main">
            <PayrollMonthGridLoadingOverlay
              active={yearLoading}
              mode="viewport"
            />

            {yearLoading ? (
              <div
                className="annual-leave-table-compact min-h-0 flex-1"
                aria-hidden="true"
              />
            ) : (
              <AnnualLeaveManagerTableSection
                year={year}
                monthFilter={monthFilter}
                yearData={yearData}
                entries={entries}
                deptIndex={deptIndex}
                filteredEntries={filteredEntries}
                tableFilterKey={tableFilterKey}
                filterPending={deptFilterPending}
                lazyLoadRequired={lazyLoadRequired}
                totalEmployeeCount={totalEmployeeCount}
                storedMonthlyByEmpKey={storedMonthlyByEmpKey}
                detailThroughDateKey={detailThroughDateKey}
                exportRef={exportRef}
                canManage={canManage}
                onAdjustmentSaved={handleAdjustmentSaved}
                onAdjustmentSaveError={handleAdjustmentSaveError}
              />
            )}
          </div>
        </div>
      </div>
    </AttendanceHrPageShell>
  );
}
